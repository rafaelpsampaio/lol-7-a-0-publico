/**
 * src/sim/power.ts
 *
 * Phase 5 — CONTEXTUAL power derivation.
 *
 * Instead of adding ~15 "power slice" rating fields per player to the data
 * schema (product direction: keep the data lean), we DERIVE a small set of
 * contextual strengths from the fields cards already have:
 *   lanePhase, midGame, lateGame, roleStrength, traits.
 *
 * Every function here is pure and reads only the card + live match state, so the
 * engine can ask "how strong is this team at X right now?" without storing X.
 */

import type { PlayerVersion, Role, PlayerTrait } from "../data/schema";
import {
  ROLES,
  type TeamState,
  type Side,
  type Lane,
  type MatchState,
  type PlayerState,
  aliveBaronBuffHolders,
  aliveElderBuffHolders,
  hasLivingCaptain,
  phaseBlend,
  teamOf,
} from "./matchState";
import { expectedPassiveGold } from "./economy";
import { DEFAULT_REALISM_TUNING, type RealismTuning } from "./tuning";
import type { ChampionClass } from "./championMeta";
import { compFightMult, compSecureMult } from "./teamComp";
import { teamfightsSliceBonus } from "./traitEffects";

// ---------------------------------------------------------------------------
// Per-player derived slices (0..~100)
// ---------------------------------------------------------------------------

/** Small additive bonus from a trait for a given slice. */
function traitBonus(traits: PlayerTrait[], slice: Slice): number {
  let b = 0;
  for (const t of traits) {
    b += TRAIT_SLICE_BONUS[t]?.[slice] ?? 0;
  }
  return b;
}

export type Slice =
  | "laning"
  | "skirmish"
  | "teamfight"
  | "objective"
  | "pickoff"
  | "siege"
  | "scaling";

/** Per-trait, per-slice flat bonuses (small — traits flavour, not dominate). */
const TRAIT_SLICE_BONUS: Partial<Record<PlayerTrait, Partial<Record<Slice, number>>>> = {
  lane_bully: { laning: 8, skirmish: 4 },
  strong_laner: { laning: 6, objective: 2 },
  clutch_player: { teamfight: 8, pickoff: 3 },
  mental_fort: { teamfight: 3, scaling: 3 },
  objective_focused: { objective: 8, siege: 4 },
  baron_stealer: { objective: 9 },
  // The two "negative when behind" traits carry no positive slice bonus; their
  // effect is situational and handled in the engine's resolution noise.
};

/**
 * Derive a single contextual slice value for one card.
 *
 * `blend` (0..1) is the time-based EARLY→LATE weight from matchState.phaseBlend.
 * When provided, the combat slices (skirmish/teamfight) shift their weighting so
 * that early in the game a card's lanePhase carries the fight, and late its
 * lateGame does. When omitted (selection weighting, etc.) the original static
 * blend is used. On flat-stat cards (lanePhase = midGame = lateGame) the result
 * is identical with or without `blend`, so calibration fixtures are unaffected.
 */
export function playerSlice(card: PlayerVersion, slice: Slice, blend?: number): number {
  const { lanePhase, midGame, lateGame } = card;
  let base: number;
  switch (slice) {
    case "laning":
      base = lanePhase;
      break;
    case "skirmish":
      if (blend === undefined) {
        base = lanePhase * 0.45 + midGame * 0.55;
      } else {
        // Early skirmishes (ganks/2v2) are won by laners; late ones by scalers.
        const early = lanePhase * 0.6 + midGame * 0.4;
        const late = midGame * 0.55 + lateGame * 0.45;
        base = early * (1 - blend) + late * blend;
      }
      break;
    case "teamfight":
      if (blend === undefined) {
        base = midGame * 0.45 + lateGame * 0.55;
      } else {
        // Early teamfights are only MILDLY tilted toward lane power — the early
        // game edge should come from lane pressure / objectives (handled in the
        // engine), NOT from a lane-heavy team also stomping 5v5s. Late fights, by
        // contrast, clearly belong to the scaling team.
        const early = lanePhase * 0.25 + midGame * 0.55 + lateGame * 0.2;
        const late = midGame * 0.3 + lateGame * 0.7;
        base = early * (1 - blend) + late * blend;
      }
      break;
    case "objective":
      base = midGame * 0.7 + lateGame * 0.3;
      break;
    case "pickoff":
      base = lanePhase * 0.35 + midGame * 0.5 + lateGame * 0.15;
      break;
    case "siege":
      base = midGame * 0.5 + lateGame * 0.5;
      break;
    case "scaling":
      base = lateGame;
      break;
  }
  return base + traitBonus(card.traits, slice);
}

/**
 * O jogador de maior fatia `slice` do time, com os vivos valendo 1 e os mortos 0,2. Empate: o
 * primeiro na ordem de ROLES.
 */
export function bestPlayer(team: TeamState, slice: Slice): PlayerState {
  let best = team.players.mid;
  let bestVal = -Infinity;
  for (const r of ROLES) {
    const p = team.players[r];
    const v = playerSlice(p.card, slice) * (p.alive ? 1 : p.away ? 0 : 0.2);
    if (v > bestVal) {
      bestVal = v;
      best = p;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Role weighting per context (which roles matter most for a given slice)
// ---------------------------------------------------------------------------

const ROLE_WEIGHTS: Record<Slice, Record<Role, number>> = {
  // Laning: solo lanes + bot 2v2 carry early tempo.
  laning: { top: 0.22, jungle: 0.14, mid: 0.24, adc: 0.22, support: 0.18 },
  // Skirmishes: jungle + mid + a roaming support.
  skirmish: { top: 0.16, jungle: 0.3, mid: 0.26, adc: 0.13, support: 0.15 },
  // Teamfight: adc + mid carries, jungle/support engage & peel.
  teamfight: { top: 0.16, jungle: 0.2, mid: 0.24, adc: 0.26, support: 0.14 },
  // Objective secure: jungle (Smite) dominates, mid/bot prio matters.
  objective: { top: 0.12, jungle: 0.4, mid: 0.2, adc: 0.16, support: 0.12 },
  // Pickoffs: jungle + support catch, mid burst.
  pickoff: { top: 0.14, jungle: 0.28, mid: 0.26, adc: 0.14, support: 0.18 },
  // Siege: adc dps + everyone, top side pressure.
  siege: { top: 0.22, jungle: 0.16, mid: 0.2, adc: 0.28, support: 0.14 },
  // Scaling: adc + mid late carries.
  scaling: { top: 0.18, jungle: 0.16, mid: 0.26, adc: 0.28, support: 0.12 },
};

/**
 * Team strength in a contextual slice — role-weighted sum of living players'
 * slice values. Dead players contribute a fraction (they're not present) so a
 * team fighting down a member is genuinely weaker.
 */
export function teamSlice(team: TeamState, slice: Slice, blend?: number): number {
  const weights = ROLE_WEIGHTS[slice];
  let total = 0;
  for (const role of ROLES) {
    const ps = team.players[role];
    const presence = ps.alive ? 1 : ps.away ? 0 : 0.15; // dead = mostly absent; quit = ausente (spec traits 3.6)
    total += playerSlice(ps.card, slice, blend) * weights[role] * presence;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Lane laning power (for early pressure)
// ---------------------------------------------------------------------------

/** Which roles occupy a map lane for laning-power purposes. */
const LANE_ROLES: Record<Lane, Role[]> = {
  top: ["top"],
  mid: ["mid"],
  bot: ["adc", "support"],
};

/** A team's laning strength in a specific map lane. */
export function laneLaningPower(team: TeamState, lane: Lane): number {
  const roles = LANE_ROLES[lane];
  let total = 0;
  for (const role of roles) {
    const ps = team.players[role];
    const presence = ps.alive ? 1 : ps.away ? 0 : 0.15;
    total += playerSlice(ps.card, "laning") * presence;
  }
  return total / roles.length;
}

// ---------------------------------------------------------------------------
// Buff-aware fight power (the number the engine resolves fights with)
// ---------------------------------------------------------------------------

/**
 * Full fight power for a side: teamfight slice + active epic buffs + map edge.
 * This is the headline combat number used in fight resolution (Phase 5) and is
 * also the backbone of the win-probability estimate (Phase 7).
 */
export function fightPower(state: MatchState, side: Side): number {
  const team = teamOf(state, side);
  const enemy = teamOf(state, side === "user" ? "rival" : "user");
  // Time-based blend: early fights weight lane power, late fights weight scaling.
  const blend = phaseBlend(state.gameTimeSec);
  let p = teamSlice(team, "teamfight", blend);
  // Spec traits no motor (3.1): o `teamfights` soma na fatia teamfight do portador em jogo.
  // Sem portador soma 0 (T-02).
  for (const role of ROLES) p += teamfightsSliceBonus(team.players[role]) * ROLE_WEIGHTS.teamfight[role];

  // Epic buffs scale with how many buffed players are still ALIVE (lost on
  // death), so a Baron/Elder team that got picked apart loses the edge.
  // Baron: a modest combat boost. Elder: a brutal execute — a full-team Elder
  // makes the next fights almost un-loseable.
  const baronFrac = aliveBaronBuffHolders(team) / 5;
  const elderFrac = aliveElderBuffHolders(team) / 5;
  p *= 1 + 0.14 * baronFrac;
  p *= 1 + 0.55 * elderFrac;

  // Dragon soul is a permanent fight edge.
  if (team.soul) p *= 1.1;
  // Each dragon stack is a small permanent buff.
  p *= 1 + team.dragons.length * 0.02;

  // Situational PLAYER TRAITS (hard-coded behaviours) folded into combat.
  const winProbSide = side === "user" ? state.winProbUser : 1 - state.winProbUser;
  const phaseFraction = Math.min(1, state.gameTimeSec / 1800);
  p *= traitCombatMultiplier(team, enemy, winProbSide, phaseFraction);

  // CAPTAIN: a living shotcaller tightens the team's coordination in fights.
  if (hasLivingCaptain(team)) p *= 1.04;

  // GOLD-02 canal primario (D-06): ouro inclina a luta; identidade em flat (INV-2).
  p *= goldFightMult(team, state);

  // COMP-03 canal de comp: tilt por matchup de comp (identidade em flat, INV-2).
  // Posterior ao canal de ouro — tempero apos o prato, sem double-counting.
  p *= compFightMult(team, enemy, state);

  // FRC-04 canal de curva de rating: achata a razao de poder por DIFERENCA de
  // rating de carta (nao por nivel). Identidade exata (INV-2) enquanto
  // state.ratingPowerD for null (canal desligado, valor neutro desta onda).
  p *= ratingFightMult(team, enemy, state.ratingPowerD);

  return p;
}

/**
 * Situational, hard-coded player-trait effect on a team's fight power, read from
 * the LIVE ahead/behind state (never a flat pre-match modifier). Returns a small
 * multiplier around 1.0. A trait-less roster always returns exactly 1.0, so the
 * engine's calibration fixtures are unaffected.
 *
 *   plays_worse_when_behind → weaker while behind
 *   tilts_on_death          → weaker while behind once it has died
 *   clutch_player           → stronger when deep behind AND late
 *   mental_fort             → resists the collapse while behind
 *   (opponent) trash_talker → tilts THIS team a little (cross-team, D-07)
 */
export function traitCombatMultiplier(
  team: TeamState,
  opponentTeam: TeamState,
  winProb: number,
  phaseFraction: number
): number {
  let m = 1;
  const behind = winProb < 0.5;
  const deepBehindLate = winProb < 0.4 && phaseFraction > 0.6;

  for (const role of ROLES) {
    const ps = team.players[role];
    if (!ps.alive) continue;
    for (const t of ps.card.traits) {
      if (t === "plays_worse_when_behind" && behind) m -= 0.03;
      else if (t === "tilts_on_death" && behind && ps.deaths > 0) m -= 0.025;
      else if (t === "clutch_player" && deepBehindLate) m += 0.04;
      else if (t === "mental_fort" && behind) m += 0.02;
    }
  }

  // Cross-team: every living trash_talker on the OPPONENT chips at this team.
  for (const role of ROLES) {
    const op = opponentTeam.players[role];
    if (!op.alive) continue;
    if (op.card.traits.includes("trash_talker")) m -= 0.015;
  }

  return Math.max(0.7, Math.min(1.3, m));
}

/**
 * Objective-secure power for a side: objective slice + jungle Smite emphasis +
 * baron_stealer trait already folded into the slice. Used for dragon/baron
 * secure & steal contests.
 */
export function securePower(state: MatchState, side: Side): number {
  const team = teamOf(state, side);
  const enemy = teamOf(state, side === "user" ? "rival" : "user");
  let p = teamSlice(team, "objective");
  // A living jungler is essential for the Smite contest.
  if (!team.players.jungle.alive) p *= 0.7;
  // CAPTAIN: a living shotcaller coordinates objective setups a touch better.
  if (hasLivingCaptain(team)) p *= 1.05;

  // GOLD-02 canal secundario (D-06): time rico segura objetivo melhor; roubo fica mais raro.
  p *= goldSecureMult(team, state);

  // COMP-03 canal de comp — canal secundario (identidade em flat, INV-2).
  // Posterior ao canal de ouro; clamp mais estreito [0.95,1.05] analogo a goldSecureMult.
  p *= compSecureMult(team, enemy, state);

  return p;
}

// ---------------------------------------------------------------------------
// effectiveGoldPower — 8-component gold-driven power (GOLD-01/04)
//
// Ancorado em diferenca relativa: goldDelta = p.gold - expectedGoldForRoleAtMinute.
// INERTE nesta fase (Phase 8): nenhum resolver chama esta funcao.
// Consumo isolado: Phase 9 (fold-in ao canal de luta).
// ---------------------------------------------------------------------------

/**
 * Decomposicao do poder derivado do ouro em 8 componentes.
 * Todos os valores flutuam em torno de 1.0 (neutro em diferenca zero).
 * Escala: ~0..2 (1.0 = jogador no ouro esperado para o role/minuto).
 * GOLD-01
 */
export interface GoldPowerComponents {
  /** Ameaca de dano direto — alto para carries de farm (adc/mid). */
  damageThreat: number;
  /** Capacidade de sobreviver — alto para tanks (top/jungle). */
  survivability: number;
  /** DPS em objetivos — alto para junglers e top. */
  objectiveDps: number;
  /** Ameaca de siege — alto para carries late. */
  siegeThreat: number;
  /** Valor em teamfight — distribuido por role. */
  teamfightValue: number;
  /** Ameaca de pick — alto para burst/assassins. */
  pickThreat: number;
  /** Controle de visao — alto para support. */
  visionControl: number;
  /** Setup de objetivo — alto para jungle/support. */
  objectiveSetup: number;
}

/**
 * Aproximacao sigmoide sem dependencias externas.
 * sigmoid(0) = 0 (garantia de neutralidade INV-2).
 * Aproxima tanh(x/2): monotonica, limitada em (-1, +1).
 */
const sigmoid = (x: number): number => x / (1 + Math.abs(x));

/**
 * Media do slice de laning dos DEZ jogadores da partida (as duas equipes,
 * vivos ou nao). ECO-05.
 *
 * Vivos-ou-nao e deliberado: a ancora economica e uma propriedade do ROSTER
 * da partida (quem foi draftado), nao do estado momentaneo de vida. Se
 * dependesse de quem esta vivo agora, a ancora oscilaria a cada morte/respawn
 * dentro da mesma partida, introduzindo dependencia temporal numa referencia
 * que precisa ser estavel do minuto 0 ao fim. Rng-free, sem mutacao de estado.
 */
export function averageLaningSlice(state: MatchState): number {
  let total = 0;
  for (const side of ["user", "rival"] as const) {
    const team = teamOf(state, side);
    for (const role of ROLES) {
      total += playerSlice(team.players[role].card, "laning");
    }
  }
  return total / (ROLES.length * 2);
}

/**
 * Ouro esperado para um role no minuto especificado, em ouro real: o farm passivo
 * integrado ate o minuto (economy.expectedPassiveGold, mesma formula de
 * engine.ts:passiveIncome com lead de rota zero), mais o ouro inicial.
 *
 * ECO-05: re-ancorada no nivel medio REAL dos dez jogadores da partida
 * (`avgLaningSlice`, ver `averageLaningSlice`), nunca numa constante fixa; assim
 * pros e amadores nao carregam vies economico permanente contra a ancora.
 *
 * O parametro `tuning` carrega o farm calibrado da partida (state.tuning).
 * Retorno arredondado: coerente com p.gold, sempre inteiro.
 */
export function expectedGoldForRoleAtMinute(
  role: Role,
  minute: number,
  avgLaningSlice: number,
  tuning: RealismTuning = DEFAULT_REALISM_TUNING
): number {
  // Mesma formula do farm passivo de engine.ts (economy.passiveGoldPerMinute), integrada
  // ate o minuto, com lead de rota zero. Ouro real.
  return expectedPassiveGold(role, minute, avgLaningSlice, tuning);
}

// ---------------------------------------------------------------------------
// Tabelas de elasticidade por role + primaryClass (priors RE_ANCHOR_PHASE9)
//
// Seguem o padrao de ROLE_WEIGHTS: Record por dimensao, sem campos opcionais.
// Derivadas da tabela de pesquisa2.md §"effectiveGoldPower" + RESEARCH.md.
// Serao re-ancoradas na Fase 9 apos medicao com economia flat real.
// ---------------------------------------------------------------------------

// Ameaca de dano direto — carries de farm lideram.
// RE_ANCHOR_PHASE9
const GOLD_DAMAGE_ELASTICITY: Partial<Record<ChampionClass, number>> = {
  marksman: 0.40,
  mage: 0.35,
  assassin: 0.40,
  tank: 0.10,
  fighter: 0.30,
  skirmisher: 0.30,
  diver: 0.25,
  support: 0.05,
  enchanter: 0.05,
  "engage-support": 0.05,
  "poke-support": 0.20,
};

// Survivability — tanks absorvem bem o ouro em defesa.
// RE_ANCHOR_PHASE9
const GOLD_TANKINESS_ELASTICITY: Partial<Record<ChampionClass, number>> = {
  marksman: 0.15,
  mage: 0.15,
  assassin: 0.10,
  tank: 0.40,
  fighter: 0.25,
  skirmisher: 0.20,
  diver: 0.30,
  support: 0.20,
  enchanter: 0.20,
  "engage-support": 0.25,
  "poke-support": 0.10,
};

// DPS em objetivos — jungle + top dominam perto do pit.
// RE_ANCHOR_PHASE9
const GOLD_OBJECTIVE_ELASTICITY: Partial<Record<ChampionClass, number>> = {
  marksman: 0.35,
  mage: 0.20,
  assassin: 0.15,
  tank: 0.10,
  fighter: 0.15,
  skirmisher: 0.30,
  diver: 0.20,
  support: 0.05,
  enchanter: 0.05,
  "engage-support": 0.05,
  "poke-support": 0.10,
};

// Siege — carries late (adc/mage) desequilibram mais com ouro.
// RE_ANCHOR_PHASE9
const GOLD_SIEGE_ELASTICITY: Partial<Record<ChampionClass, number>> = {
  marksman: 0.35,
  mage: 0.30,
  assassin: 0.15,
  tank: 0.10,
  fighter: 0.20,
  skirmisher: 0.15,
  diver: 0.10,
  support: 0.10,
  enchanter: 0.10,
  "engage-support": 0.10,
  "poke-support": 0.20,
};

// Teamfight value — distribuida, com um leve favor para carries e engagers.
// RE_ANCHOR_PHASE9
const GOLD_TEAMFIGHT_ELASTICITY: Partial<Record<ChampionClass, number>> = {
  marksman: 0.30,
  mage: 0.30,
  assassin: 0.25,
  tank: 0.20,
  fighter: 0.25,
  skirmisher: 0.25,
  diver: 0.20,
  support: 0.15,
  enchanter: 0.15,
  "engage-support": 0.20,
  "poke-support": 0.20,
};

// Pick threat — burst/assassins beneficiam mais de ouro.
// RE_ANCHOR_PHASE9
const GOLD_PICK_ELASTICITY: Partial<Record<ChampionClass, number>> = {
  marksman: 0.15,
  mage: 0.25,
  assassin: 0.40,
  tank: 0.05,
  fighter: 0.15,
  skirmisher: 0.25,
  diver: 0.20,
  support: 0.10,
  enchanter: 0.05,
  "engage-support": 0.15,
  "poke-support": 0.15,
};

// Vision control — support converte ouro em visao (wards, items).
// RE_ANCHOR_PHASE9
const GOLD_VISION_ELASTICITY: Partial<Record<ChampionClass, number>> = {
  marksman: 0.05,
  mage: 0.10,
  assassin: 0.05,
  tank: 0.15,
  fighter: 0.05,
  skirmisher: 0.15,
  diver: 0.10,
  support: 0.45,
  enchanter: 0.45,
  "engage-support": 0.40,
  "poke-support": 0.25,
};

// Objective setup — jungle/support organizam o time em torno de objetivos.
// RE_ANCHOR_PHASE9
const GOLD_OBJECTIVE_SETUP_ELASTICITY: Partial<Record<ChampionClass, number>> = {
  marksman: 0.10,
  mage: 0.10,
  assassin: 0.05,
  tank: 0.20,
  fighter: 0.15,
  skirmisher: 0.30,
  diver: 0.20,
  support: 0.35,
  enchanter: 0.25,
  "engage-support": 0.35,
  "poke-support": 0.15,
};

// ---------------------------------------------------------------------------
// goldFightMult / goldSecureMult: ouro RELATIVO no poder de luta (spec 2026-10-02 secao 2)
//
// Canal primario: fightPower * goldFightMult (D-06).
// Canal secundario: securePower * goldSecureMult (D-06, peso menor).
// Rng-free: nao chama Math.random nem mulberry32 (DET-02).
// Identidade: paridade de ouro => fatia 0,5 => (2 x 0,5)^k == 1 exato (INV-2).
// O ouro entra como fatia do time no total da partida, entao a escala do ouro nao importa;
// goldRelevance apaga o efeito quando todo mundo fechou a build.
// ---------------------------------------------------------------------------

/** Referencia de elasticidade de luta (media das tabelas early e late). */
const GOLD_ELASTICITY_REFERENCE = 0.25;
/** Referencia de elasticidade de objetivo (media de GOLD_SECURE_ELASTICITY). */
const GOLD_SECURE_REFERENCE = 0.18;
const GOLD_FIGHT_FLOOR = 0.6;
const GOLD_FIGHT_CEIL = 1.6;
const GOLD_SECURE_FLOOR = 0.8;
const GOLD_SECURE_CEIL = 1.25;

/**
 * Saturacao de item (spec 2026-10-02 secao 2, pedido do dono do produto): em partida muito
 * longa todo mundo fecha a build e o ouro para de fazer diferenca; sobram mapa, dragoes,
 * habilidade e comp (os outros termos de fightPower). Vale 1 enquanto o time MAIS POBRE tem
 * menos que fullBuildStartPerPlayer por jogador e cai linearmente ate 0 em fullBuildEndPerPlayer.
 * Rng-free.
 */
export function goldRelevance(state: MatchState): number {
  const poorerPerPlayer = Math.min(state.user.gold, state.rival.gold) / ROLES.length;
  const start = state.tuning.fullBuildStartPerPlayer;
  const end = state.tuning.fullBuildEndPerPlayer;
  const width = end - start;
  // Faixa degenerada (largura zero ou negativa): degrau em start, sem divisao por zero.
  if (width <= 0) return poorerPerPlayer < start ? 1 : 0;
  return Math.max(0, Math.min(1, 1 - (poorerPerPlayer - start) / width));
}

/** Fatia do time no ouro total da partida; 0,5 quando ninguem tem ouro. */
function goldShare(team: TeamState, state: MatchState): number {
  const enemy = team.side === "user" ? state.rival : state.user;
  const total = team.gold + enemy.gold;
  return total === 0 ? 0.5 : team.gold / total;
}

/** Fator de reducao do canal secundario (securePower) vs primario (fightPower). D-06. */
const GOLD_SECURE_FACTOR = 0.40;

// Elasticidade de ouro→luta por archetype, early game (priors RE_ANCHOR_FASE9).
// Carries (mid/assassin) beneficiam cedo; tanks/supports tem peso menor.
const GOLD_FIGHT_ELASTICITY_EARLY: Partial<Record<ChampionClass, number>> = {
  marksman:        0.15,
  mage:            0.22,
  assassin:        0.28,
  tank:            0.30,
  fighter:         0.25,
  skirmisher:      0.25,
  diver:           0.25,
  support:         0.22,
  enchanter:       0.22,
  "engage-support": 0.25,
  "poke-support":  0.20,
};

// Elasticidade de ouro→luta por archetype, late game (re-tunado Wave 2).
// Carries (marksman/mage) lideram fortemente; tanks/supports quase nao escalam.
// Wave 2: valores mantidos proximos dos priors originais para preservar GOLD-03
// (carry vs support: a elasticidade media dos vivos escala o expoente do ouro relativo).
const GOLD_FIGHT_ELASTICITY_LATE: Partial<Record<ChampionClass, number>> = {
  marksman:        0.45,
  mage:            0.38,
  assassin:        0.30,
  tank:            0.10,
  fighter:         0.20,
  skirmisher:      0.18,
  diver:           0.15,
  support:         0.07,
  enchanter:       0.07,
  "engage-support": 0.11,
  "poke-support":  0.14,
};

// Elasticidade de ouro→objetivo por archetype (estatica, sem blend temporal).
// Skirmisher/diver: bom em objetivos; support: acima da media (setup); carries: dps.
const GOLD_SECURE_ELASTICITY: Partial<Record<ChampionClass, number>> = {
  marksman:        0.18,
  mage:            0.12,
  assassin:        0.08,
  tank:            0.18,
  fighter:         0.16,
  skirmisher:      0.30,
  diver:           0.22,
  support:         0.18,
  enchanter:       0.14,
  "engage-support": 0.22,
  "poke-support":  0.14,
};

/**
 * Interpola a elasticidade de fight entre early e late pelo phaseBlend.
 * Modulada pelo scalingCurve do jogador (D-02): hypercarry (scalingCurve~1.0)
 * adianta o crossover; lane-bully (scalingCurve~0.0) atrasa.
 * Coeficiente 0.6 e prior calibravel na Wave 2.
 */
function goldFightElasticity(cls: ChampionClass, blend: number): number {
  return (GOLD_FIGHT_ELASTICITY_EARLY[cls] ?? 0) * (1 - blend)
    + (GOLD_FIGHT_ELASTICITY_LATE[cls] ?? 0) * blend;
}

/**
 * Multiplicador de poder de luta pelo ouro RELATIVO ao inimigo (spec 2026-10-02 secao 2).
 * (2 x fatia) ^ (expoente x elasticidade media dos vivos / referencia), entre piso e teto.
 * Paridade vale 1 por identidade; invariante a escala do ouro; carry escala mais com ouro.
 * Rng-free.
 */
export function goldFightMult(team: TeamState, state: MatchState): number {
  const blend = phaseBlend(state.gameTimeSec);
  const weights = ROLE_WEIGHTS["teamfight"];
  let e = 0;
  let w = 0;
  for (const role of ROLES) {
    const p = team.players[role];
    if (!p.alive) continue;
    const scalingAdj = p.metricsBase.scalingCurve - 0.5;
    const effectiveBlend = Math.max(0, Math.min(1, blend + scalingAdj * 0.6));
    e += goldFightElasticity(p.meta.primaryClass, effectiveBlend) * weights[role];
    w += weights[role];
  }
  if (w === 0) return 1.0;
  const exponent =
    ((state.tuning.goldFightExponent * (e / w)) / GOLD_ELASTICITY_REFERENCE) * goldRelevance(state);
  const m = Math.pow(2 * goldShare(team, state), exponent);
  return Math.max(GOLD_FIGHT_FLOOR, Math.min(GOLD_FIGHT_CEIL, m));
}

/** Mesmo contrato de goldFightMult para o poder de objetivo, mais fraco (GOLD_SECURE_FACTOR). */
export function goldSecureMult(team: TeamState, state: MatchState): number {
  const weights = ROLE_WEIGHTS["objective"];
  let e = 0;
  let w = 0;
  for (const role of ROLES) {
    const p = team.players[role];
    if (!p.alive) continue;
    e += (GOLD_SECURE_ELASTICITY[p.meta.primaryClass] ?? 0) * weights[role];
    w += weights[role];
  }
  if (w === 0) return 1.0;
  const exponent =
    ((state.tuning.goldFightExponent * GOLD_SECURE_FACTOR * (e / w)) / GOLD_SECURE_REFERENCE) *
    goldRelevance(state);
  const m = Math.pow(2 * goldShare(team, state), exponent);
  return Math.max(GOLD_SECURE_FLOOR, Math.min(GOLD_SECURE_CEIL, m));
}

// ---------------------------------------------------------------------------
// ratingFightMult (curva de forca por diferenca de rating, FRC-04)
//
// Canal separado de goldFightMult/compFightMult: le rating de CARTA (roster),
// nunca estado vivo de partida (STACK.md linha 437, achatar so a curva de
// diferenca de forca dos JOGADORES, nunca a curva de win-prob por estado de
// jogo). Rng-free (DET-02). Identidade exata em diferenca zero (INV-2).
// ---------------------------------------------------------------------------

/**
 * Inclinacao declarada da curva ALVO de win-rate de PARTIDA,
 * `P(gap) = 1/(1 + 10^(-gap/D))`, derivada por escrito do alvo "gap 30 vale
 * 0,875" em `docs/diagnostics/28-ancoragem.md` Bloco 2
 * (`D = 30 / log10(0,875/0,125) = 35,4989...`, arredondado para 35,5), e
 * validada contra as tres bandas legadas de `scripts/calibrate.ts:46-48`
 * (0,8350 / 0,7257 / 0,5486). FRC-04.
 */
export const RATING_CURVE_D = 35.5;

/**
 * Bracket de inclinacao aceitavel de `D`, do qual toda banda da tabela de 6
 * pontos-ancora (`docs/diagnostics/28-ancoragem.md` Bloco 3) e imagem.
 * Derivado aplicando tolerancia de +-7 pontos percentuais em gap 30
 * (0,805 e 0,945) e resolvendo `D` para cada lado.
 */
export const RATING_D_BRACKET = [24, 49] as const;

/**
 * Clamp do `delta` de rating usado em `ratingFightMult`, em pontos de overall.
 * Nem este nem `RATING_MULT_CLAMP` mordem dentro da tabela de 6 pontos-ancora
 * (gap maximo 40) nem na faixa de overall suportada de 35 a 100; existem so
 * para degradacao graciosa fora dela.
 */
export const RATING_DELTA_CLAMP = 45;

/**
 * Clamp do multiplicador retornado por `ratingFightMult`. Ver nota de
 * `RATING_DELTA_CLAMP` sobre nao morder dentro do dominio suportado.
 */
export const RATING_MULT_CLAMP = [0.6, 1.6] as const;

/**
 * Logistica base 10 alvo de win-rate de PARTIDA para uma diferenca de rating
 * `gap`, com a inclinacao declarada `RATING_CURVE_D`. Pura, rng-free. Serve
 * ao motor (via `ratingFightMult`), ao harness de calibracao e ao limiar de
 * zebra do plano 28-04.
 */
export function targetWinProb(gap: number): number {
  return 1 / (1 + Math.pow(10, -gap / RATING_CURVE_D));
}

/**
 * Media ponderada por `ROLE_WEIGHTS["teamfight"]` de `playerSlice(card,
 * "teamfight")` SEM blend, sobre as cinco cartas de um roster, indexadas por
 * `card.primaryRole`. Pura, rng-free, independente de `MatchState`, para
 * poder ser chamada de `src/tournament/` no plano 28-04.
 *
 * Esta e a UNICA definicao de "rating de time" do projeto. E proposital que
 * ela ignore vida, ouro, buffs e tempo de jogo, porque `STACK.md` linha 437
 * manda achatar so a curva de diferenca de forca dos JOGADORES, nunca a
 * curva de estado de jogo.
 */
export function rosterRating(roster: PlayerVersion[]): number {
  const weights = ROLE_WEIGHTS.teamfight;
  let total = 0;
  let totalWeight = 0;
  for (const card of roster) {
    const weight = weights[card.primaryRole];
    total += playerSlice(card, "teamfight") * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return total / totalWeight;
}

/**
 * Mesma medida de `rosterRating`, lida das cartas de `team.players[role].card`
 * de um `TeamState` vivo, ignorando `alive`. Ignorar `alive` e o que impede o
 * canal de achatar a vantagem de estado (time em vantagem numerica continua
 * ganhando o que ja ganhava por `teamSlice`).
 */
export function teamCardRating(team: TeamState): number {
  const weights = ROLE_WEIGHTS.teamfight;
  let total = 0;
  let totalWeight = 0;
  for (const role of ROLES) {
    const card = team.players[role].card;
    const weight = weights[role];
    total += playerSlice(card, "teamfight") * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return total / totalWeight;
}

/**
 * Multiplicador de poder de luta derivado da DIFERENCA de rating de carta
 * entre `team` e `enemy` (FRC-04). Contrato:
 *
 * - se `ratingPowerD` for `null` ou nao finito, retorna `1.0` imediatamente
 *   (canal desligado, identidade byte a byte);
 * - calcula `rOwn = teamCardRating(team)`, `rFoe = teamCardRating(enemy)`,
 *   `rBar = Math.sqrt(rOwn * rFoe)` (media GEOMETRICA, nao aritmetica: e o
 *   que torna `ratingFightMult(A, B, D) * ratingFightMult(B, A, D)` igual a
 *   `1.0` de forma EXATA para qualquer par -- `rBar^2 = rOwn * rFoe` por
 *   construcao, entao o produto colapsa para `(rOwn*rFoe)/(rOwn*rFoe) = 1`.
 *   Media aritmetica quebraria essa simetria, `rBar^2 >= rOwn*rFoe` por
 *   AM-GM com igualdade so quando `rOwn === rFoe`);
 * - se `rBar` for zero ou nao finito, retorna `1.0`;
 * - calcula `delta = rOwn - rFoe`, limitado a +-`RATING_DELTA_CLAMP`;
 * - retorna `(rBar / rOwn) * Math.pow(10, delta / (2 * ratingPowerD))`,
 *   limitado a `RATING_MULT_CLAMP`.
 *
 * Por que esta forma e a certa: `fightPower` de um lado e comparado contra o
 * do outro em `engine.ts:1146-1147`, entao o que decide a luta e a RAZAO de
 * poder. Multiplicando cada lado por `(rBar / r_lado)` a razao crua
 * `rOwn/rFoe` e cancelada, e o fator `10^(delta/(2*D_poder))` a substitui,
 * deixando a razao efetiva igual a `10^(delta / ratingPowerD)`, funcao so da
 * DIFERENCA. Em `delta` zero os dois fatores valem exatamente 1
 * (`rBar / rOwn` com `rOwn === rBar` e `Math.pow(10, 0)`), o que da
 * identidade exata em neutro (INV-2) em qualquer nivel. E essa forma que
 * resolve D-02 com `D` unico global: a invariancia de nivel vira propriedade
 * da formula, nao de calibracao por tier.
 */
export function ratingFightMult(
  team: TeamState,
  enemy: TeamState,
  ratingPowerD: number | null
): number {
  if (ratingPowerD === null || !Number.isFinite(ratingPowerD)) return 1.0;

  const rOwn = teamCardRating(team);
  const rFoe = teamCardRating(enemy);
  const rBar = Math.sqrt(rOwn * rFoe);
  if (rBar === 0 || !Number.isFinite(rBar)) return 1.0;

  const rawDelta = rOwn - rFoe;
  const delta = Math.max(-RATING_DELTA_CLAMP, Math.min(RATING_DELTA_CLAMP, rawDelta));

  const mult = (rBar / rOwn) * Math.pow(10, delta / (2 * ratingPowerD));
  return Math.max(RATING_MULT_CLAMP[0], Math.min(RATING_MULT_CLAMP[1], mult));
}

// ---------------------------------------------------------------------------
// isUpset (limiar de zebra derivado de RATING_CURVE_D, plano 28-04 D-03/D-04/D-05)
//
// Adicao de escopo da Fase 28, registrada em 28-CONTEXT.md D-03/D-04/D-05, nao
// um dos quatro criterios do ROADMAP.md. Serve so ao destaque narrativo de
// zebra (src/sim/upset.ts): o limiar de "favoritismo notavel" abaixo do qual um
// resultado passa a ser tratado como zebra na UI.
// ---------------------------------------------------------------------------

/**
 * Piso de "favoritismo notavel" declarado: o menor multiplo de 0,05
 * estritamente acima do teto da banda de gap 0 do Bloco 3 da ancoragem
 * (0,56), com folga, para que um jogo praticamente equilibrado nunca vire
 * manchete de zebra.
 */
export const UPSET_MIN_FAVORITE_P = 0.65;

/**
 * Gap de rating de carta cuja win-rate alvo de `targetWinProb` e exatamente
 * `UPSET_MIN_FAVORITE_P`, derivada e nao escrita a mao: e a inversa de
 * `targetWinProb`. Vale aproximadamente 9,53 pontos de overall com
 * `RATING_CURVE_D = 35,5`.
 */
export const UPSET_MIN_GAP =
  RATING_CURVE_D * Math.log10(UPSET_MIN_FAVORITE_P / (1 - UPSET_MIN_FAVORITE_P));

/**
 * Verdadeiro quando o `winnerRating` (rating de CARTA de quem venceu) esta
 * `UPSET_MIN_GAP` ou mais pontos ABAIXO do `loserRating` (rating de CARTA de
 * quem perdeu). Pura, rng-free. Os dois argumentos sao sempre ratings de
 * CARTA (`rosterRating` ou `teamCardRating`), nunca poder de luta vivo,
 * porque D-05 proibe qualquer leitura de estado momentaneo.
 */
export function isUpset(winnerRating: number, loserRating: number): boolean {
  return loserRating - winnerRating >= UPSET_MIN_GAP;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

/**
 * Derivar o poder do ouro de um jogador decomposto em 8 componentes.
 *
 * Ancoragem em diferenca relativa (GOLD-04):
 *   goldDelta = p.gold - expectedGoldForRoleAtMinute(role, minute)
 *   goldTerm  = sigmoid(goldDelta / K) onde K = 1375 (prior RE_ANCHOR_PHASE9, ouro real)
 *
 * Neutralidade (INV-2):
 *   goldDelta == 0 => goldTerm == 0 => todos os componentes == 1.0 exato.
 *
 * INERTE: nenhum resolver chama esta funcao (Armadilha 6 / D-09).
 * Consumo isolado: Phase 9.
 *
 * Rng-free: nao chama Math.random nem mulberry32 (DET-02).
 */
export function effectiveGoldPower(p: PlayerState, state: MatchState): GoldPowerComponents {
  const minute = state.gameTimeSec / 60;
  // ECO-05: calculado uma unica vez por chamada.
  const avgLaningSlice = averageLaningSlice(state);
  const expectedGold = expectedGoldForRoleAtMinute(p.role, minute, avgLaningSlice, state.tuning);
  const goldDelta = p.gold - expectedGold;

  // RE_ANCHOR_PHASE9: prior que mantem o sigmoid em zona linear para as faixas de ouro
  // dos amadores (K=1200 seria prior de pro play, Armadilha 1).
  // economia antiga x 2,75 (ouro real desde a spec 2026-10-02); a Task 4 substitui o canal de luta
  const K = 1375;
  const goldTerm = sigmoid(goldDelta / K);

  const cls = p.meta.primaryClass;

  // Fallback seguro: se primaryClass nao esta na tabela, elasticidade = 0
  // (componente retorna 1.0 — comportamento neutro).
  const dmgE   = GOLD_DAMAGE_ELASTICITY[cls]          ?? 0;
  const tankE  = GOLD_TANKINESS_ELASTICITY[cls]       ?? 0;
  const objE   = GOLD_OBJECTIVE_ELASTICITY[cls]       ?? 0;
  const siegeE = GOLD_SIEGE_ELASTICITY[cls]           ?? 0;
  const tfE    = GOLD_TEAMFIGHT_ELASTICITY[cls]       ?? 0;
  const pickE  = GOLD_PICK_ELASTICITY[cls]            ?? 0;
  const visE   = GOLD_VISION_ELASTICITY[cls]          ?? 0;
  const objSE  = GOLD_OBJECTIVE_SETUP_ELASTICITY[cls] ?? 0;

  return {
    damageThreat:  1.0 * (1 + goldTerm * dmgE),
    survivability: 1.0 * (1 + goldTerm * tankE),
    objectiveDps:  1.0 * (1 + goldTerm * objE),
    siegeThreat:   1.0 * (1 + goldTerm * siegeE),
    teamfightValue:1.0 * (1 + goldTerm * tfE),
    pickThreat:    1.0 * (1 + goldTerm * pickE),
    visionControl: 1.0 * (1 + goldTerm * visE),
    objectiveSetup:1.0 * (1 + goldTerm * objSE),
  };
}
