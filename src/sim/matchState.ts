/**
 * src/sim/matchState.ts
 *
 * Rich in-memory MATCH STATE for the state-driven engine (Phase 3).
 *
 * Design choices (kept deliberately lean per product direction — we model only
 * what makes the match feel like real LoL and drives an exciting story, NOT
 * every field the research lists):
 *
 *  - State is plain TypeScript interfaces, NOT Zod. It is mutated every tick;
 *    per-tick schema validation would be wasted cost. This follows the existing
 *    precedent (DraftState is a plain interface). The CONTRACT that crosses to
 *    storage/UI — the event timeline / MatchResult — stays Zod-validated
 *    (sim/types.ts), so the boundary is still safe.
 *  - Two sides are "user" / "rival" (same frame as the current engine + storage),
 *    so no mapping layer is needed.
 *  - Signed match-level scalars (+ favours user, − favours rival) for pressure,
 *    map control and momentum instead of duplicating per-team arrays.
 *  - Player power "slices" are DERIVED from existing card fields at simulation
 *    time (see power.ts) — we do NOT add new rating fields to the data schema.
 *
 * Timer constants here are the single source of truth for Phase 4 objective
 * rules (spawn / respawn / despawn / availability).
 */

import type { PlayerVersion, Role } from "../data/schema";
import { championMetaFor, type ChampionMeta, ROLE_DEFAULTS } from "./championMeta";
import { baseMetrics, overlayChampion, resolveMastery, type MetricsBase } from "./microMetrics";
import type { LaneStateEntry } from "./laneState";
import { freshLaneState } from "./laneState";
import { STARTING_GOLD_PER_PLAYER } from "./economy";
import { resolveTuning, type RealismTuning } from "./tuning";
import { deriveCompProfile, type CompProfile } from "./teamComp";
import type { Region } from "./simEvents";
import type { ObjectiveKind } from "./objectives";

// ---------------------------------------------------------------------------
// Primitive unions
// ---------------------------------------------------------------------------

export type Side = "user" | "rival";
export type Lane = "top" | "mid" | "bot";
export type Phase = "early" | "mid" | "late";

export const LANES: Lane[] = ["top", "mid", "bot"];
export const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

export type DragonElement =
  | "infernal"
  | "mountain"
  | "ocean"
  | "cloud"
  | "hextech"
  | "chemtech";

export const DRAGON_ELEMENTS: DragonElement[] = [
  "infernal",
  "mountain",
  "ocean",
  "cloud",
  "hextech",
  "chemtech",
];

// ---------------------------------------------------------------------------
// DiagnosticEntry — metadado de saude da simulacao (D-07, Fase 21, TKR-03)
// ---------------------------------------------------------------------------

/**
 * Entrada de diagnostico estruturado gerada pelo guard de self-kill/duplicidade
 * em engine.ts durante a simulacao. Nao e evento de timeline -- e metadado
 * auditavel de saude da sim, testavel pelo retorno de simulateMatch (D-07).
 *
 * Campos:
 *  - tipo: "self-kill-ilegal" = killer/victim no mesmo team state (suprimido);
 *          "duplicidade-roster" = mesmo personId em lados opostos (evento segue).
 *  - cardId: card.id do killer (identificador unico do card).
 *  - personId: card.personId do killer (persona compartilhada nos dois lados).
 *  - displayName: nome legivel do killer para investigacao.
 *  - teamId: side ("user" | "rival") do killer no momento do evento.
 *  - timeSec: state.gameTimeSec no momento do guard (rastreabilidade temporal).
 */
export interface DiagnosticEntry {
  tipo: "self-kill-ilegal" | "duplicidade-roster";
  cardId: string;
  personId: string;
  displayName: string;
  teamId: string;
  timeSec: number;
}

// ---------------------------------------------------------------------------
// Timer constants (seconds) — real Summoner's Rift rules (pesquisa.md)
// Single source of truth shared by Phase 4 objective logic.
// ---------------------------------------------------------------------------

export const TIMERS = {
  /** First elemental dragon spawns at 5:00; respawns 5:00 after a kill. */
  DRAGON_FIRST_SPAWN: 300,
  DRAGON_RESPAWN: 300,
  /** Soul is granted to the team that takes its 4th dragon. */
  SOUL_DRAGON_COUNT: 4,
  /**
   * Elder: so depois de uma Alma. Patch 26: o 1o nasce 5:00 depois da Alma; os seguintes
   * 6:00 depois da tomada. O buff dura 150 s.
   */
  ELDER_FIRST_SPAWN_AFTER_SOUL: 300,
  ELDER_RESPAWN: 360,
  ELDER_BUFF_DURATION: 150,
  /** Larvas (patch 26): uma leva so, de 3, as 8:00, sem respawn; o acampamento some as 14:45. */
  VOIDGRUBS_SPAWN: 480,
  VOIDGRUBS_DESPAWN: 885,
  /** Arauto (patch 26): nasce as 15:00 (uma vez), some as 19:45; nunca junto com o Barao. */
  HERALD_SPAWN: 900,
  HERALD_DESPAWN: 1185,
  /** Baron Nashor: NEVER before 20:00; respawns 6:00; buff lasts 180s. */
  BARON_SPAWN: 1200,
  BARON_RESPAWN: 360,
  BARON_BUFF_DURATION: 180,
  /** Inhibitor respawn after destruction. */
  INHIBITOR_RESPAWN: 300,
  /** Phase boundaries (inferred — pesquisa.md: no official hard cut). */
  MID_PHASE_AT: 840, // 14:00
  LATE_PHASE_AT: 1500, // 25:00
} as const;

// ---------------------------------------------------------------------------
// Structures
// ---------------------------------------------------------------------------

export interface LaneStructures {
  outerAlive: boolean;
  innerAlive: boolean;
  inhibTurretAlive: boolean;
  inhibitorAlive: boolean;
  /** Game-time second the inhibitor respawns, or null when it is up. */
  inhibitorRespawnAtSec: number | null;
}

function freshLaneStructures(): LaneStructures {
  return {
    outerAlive: true,
    innerAlive: true,
    inhibTurretAlive: true,
    inhibitorAlive: true,
    inhibitorRespawnAtSec: null,
  };
}

// ---------------------------------------------------------------------------
// Structure damage accumulation state (STR-01, Phase 17 Plan 02)
// ---------------------------------------------------------------------------

/**
 * Estado de dano acumulado por lane, por tier de estrutura.
 *
 * Campos de dano (0..100): a estrutura cai ao atingir 100; nunca por roll unico.
 * Timestamps: null enquanto nenhum evento ocorreu nesta lane.
 *
 * Inicializado deterministicamente (zero/null) em freshTeamState — nenhuma
 * chamada a rng(). O acoplamento do pool a queda real vem no Plano 03.
 *
 * Ref: ENGINE-HARDENING-SPEC.md §52, STR-01.
 */
export interface StructureDamageState {
  /** Dano acumulado na torre externa, 0..100. Queda ocorre ao atingir 100. */
  outerDamage: number;
  /** Dano acumulado na torre interna, 0..100. */
  innerDamage: number;
  /** Dano acumulado na torre do inibidor, 0..100. */
  inhibTurretDamage: number;
  /** Dano acumulado nas torres do Nexus (compartilhado entre as duas), 0..100. */
  nexusTurretDamage: number;
  /** Placas ja coletadas da torre externa desta lane (0..5, patch 26). A 5a e a queda. */
  outerPlates: number;
  /** Placas ja coletadas da torre interna desta lane (0..5, patch 26). */
  innerPlates: number;
  /** Placas ja coletadas da torre do inibidor desta lane (0..5, patch 26). */
  inhibTurretPlates: number;
  /**
   * gameTimeSec do ultimo tick que aplicou qualquer dano estrutural nesta lane.
   * null enquanto nenhum dano foi sofrido.
   */
  lastStructureDamageAtSec: number | null;
  /**
   * gameTimeSec da ultima estrutura destruida nesta lane.
   * null enquanto nenhuma caiu. Usado pela Fase 18 (cascata cooldown STR-05).
   */
  lastStructureDestroyedAtSec: number | null;
}

/**
 * Cria um StructureDamageState vazio (deterministico, sem RNG).
 * Todos os campos numericos a 0; timestamps a null; placas a 0.
 */
export function freshStructureDamageState(): StructureDamageState {
  return {
    outerDamage: 0,
    innerDamage: 0,
    inhibTurretDamage: 0,
    nexusTurretDamage: 0,
    outerPlates: 0,
    innerPlates: 0,
    inhibTurretPlates: 0,
    lastStructureDamageAtSec: null,
    lastStructureDestroyedAtSec: null,
  };
}

// ---------------------------------------------------------------------------
// Player state (lean — derived power is computed at sim time, not stored here)
// ---------------------------------------------------------------------------

/** Spec traits no motor (3.6): rastro do `quits`, so em quem tem a trait. */
export interface QuitTrack {
  /** Horarios (gameTimeSec) das mortes desde o ultimo abate dele. */
  deathsSinceKillSec: number[];
  /** Sorteio de quit pendente para o fim deste tick. */
  pending: boolean;
  /** Ja quitou nesta partida (no maximo uma vez). */
  used: boolean;
}

export interface PlayerState {
  /** Reference to the source card (carries ratings, traits, name). */
  card: PlayerVersion;
  role: Role;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  alive: boolean;
  /** Game-time second the player respawns, or null when alive. */
  respawnAtSec: number | null;
  /** Shutdown que o abatedor recebe agora (0 abaixo de 150; no maximo 700). Derivado de bounty. */
  shutdownGold: number;
  /** Bounty acumulado (patch 14.21): positivo vira shutdown, negativo barateia o abate. */
  bounty: number;
  /** Carrying the Hand of Baron buff right now (lost on death). */
  hasBaronBuff: boolean;
  /** Carrying the Elder buff right now (lost on death). */
  hasElderBuff: boolean;
  /**
   * Team captain (shotcaller). Set at match build time from the team's chosen
   * captain. A living captain gives the team a small coordination edge (see
   * power.ts captain bonuses). Trait-less / captain-less rosters carry false.
   */
  isCaptain: boolean;
  /** Flash disponivel. Default true (flash up). Multiplicador noFlash do victimScore
   *  vale 1.0 quando true — INV-2 safe (comportamento identico ao atual). */
  flashUp: boolean;
  /**
   * WR-03: instante (gameTimeSec) em que o Flash volta a ficar disponivel apos uso.
   * null = Flash up agora (sem cooldown pendente). Modelado deterministicamente
   * (rng-free): setado quando o jogador usa Flash agressivo para garantir um abate;
   * restaurado em processRespawns quando gameTimeSec >= flashCooldownUntilSec.
   * Cria janelas reais em que um jogador VIVO esta sem Flash, ativando o peso
   * noFlash (victimScore) e o ticker ctx_adc_caught_no_flash (EVT-01).
   */
  flashCooldownUntilSec: number | null;
  /**
   * Spec traits no motor (3.6): true enquanto o jogador saiu da partida (`quits`). Fica sempre
   * morto (`alive` false) e conta 0 na forca do time. Ausente em quem nunca quitou, para nao mudar
   * o estado de quem nao tem a trait (T-02).
   */
  away?: boolean;
  /** Spec traits no motor (3.6): so existe em quem tem `quits` (T-02). */
  quitTrack?: QuitTrack;
  /**
   * Archetype meta resolved once in freshPlayerState via championMetaFor.
   * Inerte na Phase 7: nenhum resolver le este campo ainda.
   */
  meta: ChampionMeta;
  /**
   * Metricas de camadas 1+2 (baseMetrics + overlayChampion), resolvidas uma
   * unica vez em freshPlayerState e congeladas com Object.freeze.
   * Inerte na Fase 8: nenhum resolver le este campo ainda; consumo na Fase 9+.
   * Armadilha 4: NUNCA mutar durante a simulacao — mutacao lanca em strict mode.
   */
  metricsBase: MetricsBase;
}

function freshPlayerState(
  card: PlayerVersion,
  isCaptain = false,
  championId?: string
): PlayerState {
  const meta = championMetaFor(championId, card.primaryRole);
  const mastery = resolveMastery(card, championId);
  const base = baseMetrics(card);
  const overlaid = overlayChampion(base, meta, mastery);
  return {
    card,
    role: card.primaryRole,
    kills: 0,
    deaths: 0,
    assists: 0,
    gold: STARTING_GOLD_PER_PLAYER,
    alive: true,
    respawnAtSec: null,
    shutdownGold: 0,
    bounty: 0,
    hasBaronBuff: false,
    hasElderBuff: false,
    isCaptain,
    flashUp: true,
    flashCooldownUntilSec: null,
    meta,
    metricsBase: Object.freeze(overlaid),
    ...(card.traits.includes("quits") ? { quitTrack: { deathsSinceKillSec: [], pending: false, used: false } } : {}),
  };
}

// ---------------------------------------------------------------------------
// Team state
// ---------------------------------------------------------------------------

export interface TeamState {
  side: Side;
  name: string;
  players: Record<Role, PlayerState>;

  /** Team total gold (sum of player gold + passive income, tracked directly). */
  gold: number;
  kills: number;
  deaths: number;

  towersDestroyed: number;
  inhibitorsDestroyed: number;
  structures: Record<Lane, LaneStructures>;
  /** Pool de dano acumulado por lane (STR-01, Phase 17 Plan 02). Inicializado deterministicamente. */
  structureDamage: Record<Lane, StructureDamageState>;
  nexusTurretsAlive: number; // 0..2
  nexusExposed: boolean;

  /** Ordered list of dragons this team has taken. */
  dragons: DragonElement[];
  /** Soul element once this team reaches SOUL_DRAGON_COUNT, else null. */
  soul: DragonElement | null;
  elderCount: number;
  /** Voidgrubs killed by this team (0..6). */
  voidgrubs: number;
  heraldTaken: boolean;
  heraldUsed: boolean;
  baronsTaken: number;
  /** Persistent per-lane state (LANE-01). Initialized neutral in freshTeamState. */
  laneState: Record<Lane, LaneStateEntry>;
  /** Perfil de comp derivado uma vez no build a partir do draft (COMP-01). Time-invariante. */
  compProfile: CompProfile;
}

function freshTeamState(
  side: Side,
  name: string,
  roster: PlayerVersion[],
  captainPersonId?: string,
  championAssignments?: Record<string, string>
): TeamState {
  const players = {} as Record<Role, PlayerState>;
  for (const card of roster) {
    const isCaptain =
      captainPersonId !== undefined && card.personId === captainPersonId;
    const championId = championAssignments?.[card.id];
    players[card.primaryRole] = freshPlayerState(card, isCaptain, championId);
  }
  return {
    side,
    name,
    players,
    gold: STARTING_GOLD_PER_PLAYER * roster.length,
    kills: 0,
    deaths: 0,
    towersDestroyed: 0,
    inhibitorsDestroyed: 0,
    structures: {
      top: freshLaneStructures(),
      mid: freshLaneStructures(),
      bot: freshLaneStructures(),
    },
    structureDamage: {
      top: freshStructureDamageState(),
      mid: freshStructureDamageState(),
      bot: freshStructureDamageState(),
    },
    nexusTurretsAlive: 2,
    nexusExposed: false,
    dragons: [],
    soul: null,
    elderCount: 0,
    voidgrubs: 0,
    heraldTaken: false,
    heraldUsed: false,
    baronsTaken: 0,
    laneState: {
      top: freshLaneState(),
      mid: freshLaneState(),
      bot: freshLaneState(),
    },
    compProfile: Object.freeze(
      deriveCompProfile(
        players,
        (role) => players[role]?.meta === ROLE_DEFAULTS[role]
      )
    ),
  };
}

// ---------------------------------------------------------------------------
// Objective availability (the live "what can happen right now" window)
// ---------------------------------------------------------------------------

export interface ObjectiveState {
  // Dragon ------------------------------------------------------------------
  /** Element of the dragon currently up (or the one about to spawn). */
  dragonElement: DragonElement | null;
  dragonAlive: boolean;
  /** When the next dragon spawns (null while one is alive). */
  dragonRespawnAtSec: number | null;
  /** Number of dragons taken across BOTH teams (decides map/soul element). */
  dragonsTaken: number;
  /**
   * Element of the most recently SPAWNED dragon — retained even after it is
   * taken, so the 2nd dragon can be forced to differ from the 1st (real rule:
   * the first two drakes are different elements).
   */
  lastSpawnedElement: DragonElement | null;
  /** The Rift's soul element, locked the moment the 2nd dragon dies. */
  soulElement: DragonElement | null;

  // Elder -------------------------------------------------------------------
  elderUnlocked: boolean; // some team has soul
  elderAlive: boolean;
  elderRespawnAtSec: number | null;

  // Voidgrubs ---------------------------------------------------------------
  voidgrubsAlive: number; // 0..3 currently up
  voidgrubsWave: 0 | 1; // 0 = ainda nao nasceu (patch 26: leva unica)
  voidgrubsRespawnAtSec: number | null;
  voidgrubsDespawned: boolean;

  // Herald ------------------------------------------------------------------
  heraldAlive: boolean;
  heraldDone: boolean; // taken or despawned — never comes back

  // Baron -------------------------------------------------------------------
  baronAlive: boolean;
  baronRespawnAtSec: number | null;
}

function freshObjectiveState(): ObjectiveState {
  return {
    dragonElement: null,
    dragonAlive: false,
    dragonRespawnAtSec: TIMERS.DRAGON_FIRST_SPAWN,
    dragonsTaken: 0,
    lastSpawnedElement: null,
    soulElement: null,
    elderUnlocked: false,
    elderAlive: false,
    elderRespawnAtSec: null,
    voidgrubsAlive: 0,
    voidgrubsWave: 0,
    voidgrubsRespawnAtSec: TIMERS.VOIDGRUBS_SPAWN,
    voidgrubsDespawned: false,
    heraldAlive: false,
    heraldDone: false,
    baronAlive: false,
    baronRespawnAtSec: TIMERS.BARON_SPAWN,
  };
}

// ---------------------------------------------------------------------------
// Active buffs (team-level expiry; per-player carry is on PlayerState)
// ---------------------------------------------------------------------------

export interface BuffState {
  /** Game-time second the side's Baron buff expires, or null. */
  baronUntilSec: Record<Side, number | null>;
  /** Game-time second the side's Elder buff expires, or null. */
  elderUntilSec: Record<Side, number | null>;
}

function freshBuffState(): BuffState {
  return {
    baronUntilSec: { user: null, rival: null },
    elderUntilSec: { user: null, rival: null },
  };
}

// ---------------------------------------------------------------------------
// Engine config
// ---------------------------------------------------------------------------

export interface SimConfig {
  /** Seconds of game time advanced per tick. */
  tickSeconds: number;
  /** Comeback elasticity [0,1] — how strongly trailing teams claw back. */
  comebackElasticity: number;
  /** Noise amplitude on contested resolutions [0,1]. */
  upsetNoise: number;
  /**
   * Inclinacao da curva de rating no dominio de PODER (FRC-04), em pontos de overall
   * por decada de razao de poder. `null` significa canal desligado, ou seja o motor
   * de antes desta fase, byte a byte. O valor padrao atual (140) vem da Task 8 da spec
   * 2026-10-02-luta-mapa-vitoria (docs/diagnostics/luta-mapa-vitoria-calibracao.md, secoes
   * 7.7 e 7.8): a varredura em N=1500 achou a banda "favorito com gap >= 5 vence" (0,75 a 0,85)
   * fechando so perto de 125; a checagem de robustez em {175, 160, 150, 140, 125} com N=3000
   * escolheu 140, que passa no gate de N=1500 e e o ponto com menos bandas fora e maior margem
   * minima no N=3000. O valor anterior (525) veio do sweep da Fase 28,
   * docs/diagnostics/28-sweep.md, minimizando a soma dos quadrados dos desvios contra
   * a tabela de 6 pontos-ancora (nenhum ponto da grade fechou as 8 bandas; ANCORA-30 e
   * ANCORA-40 tem regiao de fechamento VAZIA para este canal, provado por medicao no
   * mesmo arquivo). Ganho de agregacao (`ratingPowerD / RATING_CURVE_D`) derivado no
   * mesmo arquivo.
   */
  ratingPowerD: number | null;
  /** Sobrescreve parametros calibraveis (src/sim/tuning.ts). Ausente = valores padrao. */
  tuning?: Partial<RealismTuning>;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  tickSeconds: 15,
  comebackElasticity: 0.25,
  upsetNoise: 0.2,
  // FRC-04: valor da Task 8 (luta-mapa-vitoria-calibracao.md secoes 7.7 e 7.8); era 525 (28-sweep.md).
  ratingPowerD: 140,
};

// ---------------------------------------------------------------------------
// MatchState — the whole picture
// ---------------------------------------------------------------------------

export interface MatchState {
  gameTimeSec: number;
  phase: Phase;

  /**
   * So no harness de calibracao (simulateMatch com recordStats): lutas de resolveTeamfight vencidas
   * por lado e janelas de conversao abertas. Ausente em toda partida normal.
   */
  harnessStats?: { fightWins: Record<Side, number>; conversions: number };

  user: TeamState;
  rival: TeamState;
  objectives: ObjectiveState;
  buffs: BuffState;

  /** Lane pressure, signed: + favours user, − favours rival (−100..100). */
  pressure: Record<Lane, number>;
  /** Map/vision control edge, signed (+user). */
  mapControl: number;
  /** Psychological momentum, signed (+user). */
  momentum: number;
  /** User-team win probability [0,1] — an INDICATOR, not the decider. */
  winProbUser: number;

  firstBloodDone: boolean;
  firstTurretDone: boolean;

  /** Game-time of the last full teamfight — paces fights so they don't chain. */
  lastFightSec: number;

  /**
   * Ultima luta ou pick com vencedor: lado, lugar e instante (janela de conversao, spec secao 4).
   * A conversao (resolveConversion) le so `side` e `place`. `atSec` e gravado nos dois pontos de
   * escrita mas nenhuma leitura o usa hoje: fica de proposito, para diagnostico e para texto
   * futuro ("ha quanto tempo o time venceu a luta"), e para o formato do estado nao mudar.
   */
  lastFightWon: { side: Side; place: Lane | Region; atSec: number } | null;

  /** Preparo de cada objetivo por lado, 0..100 (spec calendario secao 4). */
  objectivePrep: Record<Side, Record<ObjectiveKind, number>>;
  /** O aviso de preparo ja saiu neste nascimento do objetivo, por lado. */
  prepAnnounced: Record<Side, Record<ObjectiveKind, boolean>>;

  /**
   * gameTimeSec da ultima estrutura destruida em QUALQUER lane (ambos os times).
   * null enquanto nenhuma caiu. Usado pelo freio global cross-lane (D-02, STR-05).
   */
  lastAnyStructureDestroyedAtSec: number | null;

  /** Comeback elasticity [0,1] copied from config — how hard a behind team claws back. */
  comebackElasticity: number;

  /** Parametros calibraveis resolvidos do config (src/sim/tuning.ts). */
  tuning: RealismTuning;

  /** Inclinacao da curva de rating copiada do config (FRC-04). Ver `SimConfig.ratingPowerD`. */
  ratingPowerD: number | null;

  /**
   * Diagnosticos estruturados acumulados durante a simulacao (D-07, Fase 21, TKR-03).
   * Campo OPCIONAL com default ausente (undefined = array vazio por convencao).
   * Nao e evento de timeline -- e metadado de saude da simulacao, invisivel ao HUD.
   * Tipos: "self-kill-ilegal" (suprimido antes de emitir) | "duplicidade-roster" (logado, evento segue).
   * Inicializado lazy pelo guard de engine.ts antes do primeiro push (state.diagnostics ?? []).
   * Testavel diretamente pelo retorno de simulateMatch via finalState.diagnostics (D-07).
   * Nao quebra consumidores existentes nem golden (campo opcional, ausente do estado inicial).
   */
  diagnostics?: DiagnosticEntry[];

  ended: boolean;
  winner: Side | null;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function freshPrep(): Record<ObjectiveKind, number> {
  return { dragon: 0, voidgrubs: 0, herald: 0, baron: 0, elder: 0 };
}

function freshPrepFlags(): Record<ObjectiveKind, boolean> {
  return { dragon: false, voidgrubs: false, herald: false, baron: false, elder: false };
}

/**
 * Build a consistent initial MatchState at 00:00 for two rosters.
 * Pure — no RNG, no I/O.
 */
export function createInitialMatchState(
  userRoster: PlayerVersion[],
  rivalRoster: PlayerVersion[],
  opts: {
    userName?: string;
    rivalName?: string;
    config?: SimConfig;
    /** personId of each team's designated captain (shotcaller), if any. */
    userCaptainPersonId?: string;
    rivalCaptainPersonId?: string;
    /** playerId -> championId assignments for each team (CHAMP-03). */
    userChampions?: Record<string, string>;
    rivalChampions?: Record<string, string>;
  } = {}
): MatchState {
  return {
    gameTimeSec: 0,
    phase: "early",
    user: freshTeamState("user", opts.userName ?? "Seu time", userRoster, opts.userCaptainPersonId, opts.userChampions),
    rival: freshTeamState("rival", opts.rivalName ?? "Rival", rivalRoster, opts.rivalCaptainPersonId, opts.rivalChampions),
    objectives: freshObjectiveState(),
    buffs: freshBuffState(),
    pressure: { top: 0, mid: 0, bot: 0 },
    mapControl: 0,
    momentum: 0,
    winProbUser: 0.5,
    firstBloodDone: false,
    firstTurretDone: false,
    lastFightSec: -999,
    lastFightWon: null,
    objectivePrep: { user: freshPrep(), rival: freshPrep() },
    prepAnnounced: { user: freshPrepFlags(), rival: freshPrepFlags() },
    lastAnyStructureDestroyedAtSec: null,
    comebackElasticity: (opts.config ?? DEFAULT_SIM_CONFIG).comebackElasticity,
    tuning: resolveTuning((opts.config ?? DEFAULT_SIM_CONFIG).tuning),
    ratingPowerD: (opts.config ?? DEFAULT_SIM_CONFIG).ratingPowerD,
    ended: false,
    winner: null,
  };
}

// ---------------------------------------------------------------------------
// Pure derived helpers (read-only views over state)
// ---------------------------------------------------------------------------

/** The opposing side. */
export function opponent(side: Side): Side {
  return side === "user" ? "rival" : "user";
}

/** Team accessor by side. */
export function teamOf(state: MatchState, side: Side): TeamState {
  return side === "user" ? state.user : state.rival;
}

/** Infer the game phase from the clock + structural milestones (pesquisa.md). */
export function computePhase(state: MatchState): Phase {
  const t = state.gameTimeSec;
  const anyInhibDown =
    state.user.inhibitorsDestroyed > 0 || state.rival.inhibitorsDestroyed > 0;
  const anySoul = state.user.soul !== null || state.rival.soul !== null;
  const anyBaron = state.user.baronsTaken > 0 || state.rival.baronsTaken > 0;
  if (t >= TIMERS.LATE_PHASE_AT || anyInhibDown || anySoul || anyBaron) {
    return "late";
  }
  if (t >= TIMERS.MID_PHASE_AT) return "mid";
  return "early";
}

/** Gold differential (+ = user ahead). */
export function goldDiff(state: MatchState): number {
  return state.user.gold - state.rival.gold;
}

/** Total towers a team has standing (own structures still alive). */
export function towersStanding(team: TeamState): number {
  let n = team.nexusTurretsAlive;
  for (const lane of LANES) {
    const s = team.structures[lane];
    if (s.outerAlive) n++;
    if (s.innerAlive) n++;
    if (s.inhibTurretAlive) n++;
  }
  return n;
}

/** Tower differential (+ = user has destroyed more of rival's towers). */
export function towerDiff(state: MatchState): number {
  return state.user.towersDestroyed - state.rival.towersDestroyed;
}

/** Count of living players on a team. */
export function aliveCount(team: TeamState): number {
  return ROLES.reduce((n, r) => n + (team.players[r].alive ? 1 : 0), 0);
}

/** Dragon-stack differential (+ = user has more dragons). */
export function dragonDiff(state: MatchState): number {
  return state.user.dragons.length - state.rival.dragons.length;
}

/** Whether a side currently holds an active team Baron buff. */
export function hasBaronBuff(state: MatchState, side: Side): boolean {
  const until = state.buffs.baronUntilSec[side];
  return until !== null && until > state.gameTimeSec;
}

/** Whether a side currently holds an active team Elder buff. */
export function hasElderBuff(state: MatchState, side: Side): boolean {
  const until = state.buffs.elderUntilSec[side];
  return until !== null && until > state.gameTimeSec;
}

/** Living players on a side carrying the Baron buff (buff lost on death). */
export function aliveBaronBuffHolders(team: TeamState): number {
  return ROLES.reduce(
    (n, r) => n + (team.players[r].alive && team.players[r].hasBaronBuff ? 1 : 0),
    0
  );
}

/** Living players on a side carrying the Elder buff. */
export function aliveElderBuffHolders(team: TeamState): number {
  return ROLES.reduce(
    (n, r) => n + (team.players[r].alive && team.players[r].hasElderBuff ? 1 : 0),
    0
  );
}

/** Whether the team's designated captain is currently alive (shotcalling edge). */
export function hasLivingCaptain(team: TeamState): boolean {
  return ROLES.some((r) => team.players[r].isCaptain && team.players[r].alive);
}

/**
 * Time-based phase blend [0,1] used to weight EARLY power (lanePhase) vs LATE
 * power (lateGame) by the clock. 0 at the opening, ramping linearly to 1.0 at
 * the late-phase boundary (25:00). At 5:00 ≈ 0.20, at 14:00 ≈ 0.56, ≥25:00 = 1.
 * On flat-stat cards (lanePhase = midGame = lateGame) the blend is a no-op, so
 * the calibration fixtures are unaffected; it only matters for cards with a real
 * early/late power curve.
 */
export function phaseBlend(gameTimeSec: number): number {
  return Math.max(0, Math.min(1, gameTimeSec / TIMERS.LATE_PHASE_AT));
}

/**
 * Recompute the cheap derived fields that are a pure function of other state.
 * Mutates `state` in place and returns it. Pressure / map control / momentum /
 * win probability are owned by later engine stages (Phases 5 & 7); here we only
 * keep the inferred game phase in sync with the clock + structural milestones.
 */
export function recomputeDerived(state: MatchState): MatchState {
  state.phase = computePhase(state);
  return state;
}

/** Format game seconds as MM:SS. */
export function formatGameClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
