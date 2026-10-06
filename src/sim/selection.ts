/**
 * src/sim/selection.ts
 *
 * Modulo puro de selecao de killer/vitima/assists (KDA-01/02/03/04, Phase 12).
 * INV-arity D-06: mesma quantidade e ordem de draws que pickActor/livingTarget (KDA-05).
 *
 * Design:
 *  - Toda a camada e rng-free EXCETO selectKiller e selectVictim (1 draw cada,
 *    identico ao pickActor/livingTarget originais, Strategy A, D-06).
 *  - assignAssists nunca recebe rng: re-rank deterministico puro (KDA-03).
 *  - softCapDamp nunca chama rng: modifica o peso pre-draw, nao a saida (KDA-04).
 *  - Constantes marcadas [ASSUMED] sao priors FLAT sujeitos a recalibracao ad-hoc
 *    (Plan 06) e gate formal da Fase 13.
 *  - Plan 03: softCapDamp + PLAUSIBLE_BAND implementados e aplicados em
 *    killerScore/victimScore. Fecha KDA-04 (D-01/D-02).
 *  - Fase 24 (AST-01/AST-03): assistWeight troca EXCLUSAO por PENALIZACAO.
 *    A tabela de score minimo por evento guarda os mesmos valores; ela deixa de
 *    cortar a lista e passa a ser o joelho de uma rampa. Nenhuma rota fica com
 *    peso zero.
 *    A camada continua livre de aleatoriedade: assignAssists NAO recebe gerador
 *    e nao consome nenhum draw, nem antes nem depois desta mudanca (INV-1).
 */

import type { Role } from "../data/schema";
import type { MatchState, PlayerState, Lane } from "./matchState";
import type { EventKind } from "./simEvents";
import type { ChampionClass } from "./championMeta";
import type { CompProfile } from "./teamComp";
import type { ObjectiveKind } from "./objectives";
import { traitKillerWeight, traitVictimWeight } from "./traitEffects";

// ---------------------------------------------------------------------------
// Utilitario local: autocontido, sem deps externas (padrao teamComp.ts)
// ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// softCapDamp: tipos, constantes e tabela de bandas (KDA-04, D-01/D-02)
// ---------------------------------------------------------------------------

/**
 * Banda de ArchBand: mapeia ChampionClass para categoria de soft-cap.
 * Cada role/ArchBand tem bandas independentes por stat (kills/deaths/assists).
 * [ASSUMED]: re-ancoradas na economia flat amadora (overalls 35-70).
 */
export type ArchBand =
  | "tank"
  | "carry"
  | "mage"
  | "assassin"
  | "standard"
  | "hypercarry"
  | "engage"
  | "enchanter"
  | "poke";

/** Eixo de stat para lookup na banda. */
export type StatBand = "kills" | "deaths" | "assists";

/** Intervalo de soft cap: hiSoft = inicio do damp; hiHard = damp maximo. */
export interface BandRange {
  hiSoft: number;
  hiHard: number;
}

/**
 * Tabela de bandas plausíveis por role/archBand/stat.
 * [CITED: 12-RESEARCH.md secao 2; ASSUMED: hiSoft/hiHard re-ancorados para flat amador]
 * Nota: jogo flat amador tem 1/3-1/2 dos kills de pro play; bandas comprimidas.
 *
 * Exported para leitura nos testes de banda (acceptance criteria).
 */
export const PLAUSIBLE_BAND: Record<
  Role,
  Partial<Record<ArchBand, Record<StatBand, BandRange>>>
> = {
  top: {
    tank:  { kills:{hiSoft:4,  hiHard:8},  deaths:{hiSoft:6, hiHard:10}, assists:{hiSoft:12,hiHard:20} },
    carry: { kills:{hiSoft:7,  hiHard:12}, deaths:{hiSoft:5, hiHard:9},  assists:{hiSoft:9, hiHard:16} },
  },
  jungle: {
    tank:  { kills:{hiSoft:4,  hiHard:8},  deaths:{hiSoft:6, hiHard:10}, assists:{hiSoft:14,hiHard:22} },
    carry: { kills:{hiSoft:8,  hiHard:14}, deaths:{hiSoft:5, hiHard:9},  assists:{hiSoft:10,hiHard:17} },
  },
  mid: {
    mage:    { kills:{hiSoft:8, hiHard:13},  deaths:{hiSoft:4, hiHard:8},  assists:{hiSoft:10,hiHard:17} },
    assassin:{ kills:{hiSoft:10,hiHard:16},  deaths:{hiSoft:6, hiHard:10}, assists:{hiSoft:7, hiHard:13} },
  },
  adc: {
    standard:   { kills:{hiSoft:9, hiHard:14},  deaths:{hiSoft:4, hiHard:7},  assists:{hiSoft:8, hiHard:14} },
    hypercarry: { kills:{hiSoft:12,hiHard:18},  deaths:{hiSoft:4, hiHard:7},  assists:{hiSoft:7, hiHard:13} },
  },
  support: {
    engage:    { kills:{hiSoft:3, hiHard:7},  deaths:{hiSoft:8, hiHard:15}, assists:{hiSoft:18,hiHard:30} },
    enchanter: { kills:{hiSoft:2, hiHard:5},  deaths:{hiSoft:5, hiHard:10}, assists:{hiSoft:18,hiHard:30} },
    poke:      { kills:{hiSoft:6, hiHard:10}, deaths:{hiSoft:6, hiHard:11}, assists:{hiSoft:12,hiHard:22} },
  },
};

/**
 * Peso minimo de damp (nunca zero): D-01 "absurdo fica raro, nao impossivel".
 * [ASSUMED]: prior flat. Validar no Plan 06.
 */
export const DAMP_FLOOR = 0.15;

/**
 * Mapeia ChampionClass para ArchBand.
 * Default "standard" para classes nao mapeadas (seguranca para campeoes novos).
 */
export function archBand(cls: ChampionClass): ArchBand {
  const map: Record<ChampionClass, ArchBand> = {
    tank:             "tank",
    fighter:          "carry",
    mage:             "mage",
    assassin:         "assassin",
    marksman:         "standard",
    skirmisher:       "carry",
    diver:            "carry",
    support:          "enchanter",
    enchanter:        "enchanter",
    "engage-support": "engage",
    "poke-support":   "poke",
  };
  return map[cls] ?? "standard";
}

/**
 * D-02: archetype certo + contexto certo relaxa o damp.
 *
 * Limiares ESTRITOS (Pitfall 6/INV-2): goldLead > 1500, teamDeaths > 8,
 * gameSec > 1800, nao incluem o estado neutro (0). Em fixture flat os
 * limiares nao disparam e a relaxation e 1.0.
 *
 * Pura: mesma entrada => mesma saida; nunca chama rng.
 */
export function archetypeContextRelaxation(p: PlayerState, ctx: FightContext): number {
  const cls = p.meta.primaryClass;
  // Limiares estritos (nao incluem 0), INV-2 preservado
  // 1500 da economia antiga x 2,75 (ouro real desde a spec 2026-10-02).
  const isStomping = (ctx.goldLead ?? 0) > 4125;
  const isFiesta   = ctx.teamDeaths > 8;
  const isLong     = (ctx.gameSec ?? 0) > 1800;

  // Extra-conservador sempre: top tank 15/0 quase impossivel
  if (cls === "tank" || cls === "engage-support" || cls === "enchanter") return 0.80;

  // Assassin/skirmisher em stomp ou fiesta: banda afrouxa
  if ((cls === "assassin" || cls === "skirmisher") && (isStomping || isFiesta)) return 1.60;

  // Marksman hypercarry em jogo longo + stomp
  if (cls === "marksman" && isLong && isStomping) return 1.50;

  // Mage/poke-support em fiesta
  if ((cls === "mage" || cls === "poke-support") && isFiesta) return 1.40;

  return 1.0; // neutro
}

/**
 * softCapDamp: amortece o peso PRE-DRAW quando K/D/A passa da banda plausivel
 * do role/archetype. Nunca hard cap (Pitfall 2), nunca zera o peso (D-01).
 *
 * Curva linear: 1.0 em hiSoft -> DAMP_FLOOR em hiHard+.
 * D-02: archetypeContextRelaxation relaxa o damp para combos corretos.
 * Pura, rng-free: mesma entrada sempre mesma saida.
 *
 * [KDA-04, Phase 12]
 */
export function softCapDamp(
  rawWeight: number,
  p: PlayerState,
  stat: StatBand,
  ctx: FightContext,
): number {
  const ab   = archBand(p.meta.primaryClass);
  const roleEntry  = PLAUSIBLE_BAND[p.role];
  const archEntry  = roleEntry?.[ab];

  // Se nao ha banda para este role/archBand: fallback "standard" (sem damp)
  if (archEntry == null) return rawWeight;

  const band    = archEntry[stat];
  const current = stat === "kills" ? p.kills
                : stat === "deaths" ? p.deaths
                : p.assists;

  // Abaixo ou igual ao limite soft: no-op (INV-2 em flat)
  if (current <= band.hiSoft) return rawWeight;

  // Curva linear de 1.0 (em hiSoft) a DAMP_FLOOR (em hiHard+)
  const excess = (current - band.hiSoft) / Math.max(1, band.hiHard - band.hiSoft);
  const damp   = Math.max(DAMP_FLOOR, 1.0 - excess * (1.0 - DAMP_FLOOR));

  // D-02: archetype + contexto relaxa
  const archBonus = archetypeContextRelaxation(p, ctx);

  // min(1.0, ...): relaxation nao pode superar o rawWeight original
  return rawWeight * Math.min(1.0, damp * archBonus);
}

// ---------------------------------------------------------------------------
// FightContext: interface exportada (construida inline no engine, sem rng)
// ---------------------------------------------------------------------------

/**
 * Contexto de uma luta. Construido pelo engine antes de chamar selectKiller/
 * selectVictim: puro, sem rng. Todos os campos derivados do estado existente.
 */
export interface FightContext {
  /** Tipo do evento que gerou a luta. */
  eventType: EventKind;
  /** Minuto do jogo (gameTimeSec / 60). */
  minute: number;
  /** Estado do jogo no momento da luta. */
  state: MatchState;
  /** Lane onde ocorre o evento (opcional: pickoff/gank tem lane). */
  lane?: Lane;
  /** Lead de ouro do time assassino vs vitima (+: assassino na frente). */
  goldLead: number;
  /** Total de mortes na partida ate agora (proxy de caos). */
  teamDeaths: number;
  /** Ha alvos com HP baixo na luta? */
  lowHpTargets: boolean;
  /** Exposicao de cada jogador (0..1). Chave = player card id. */
  exposure?: Record<string, number>;
  /** Jogadores isolados (longe do time). Chave = player card id. */
  isolated?: Record<string, boolean>;
  /** Perfil de comp do time assassino (para protectCarry damp). */
  killerTeamComp?: CompProfile;
  /** Perfil de comp do time vitima. */
  victimTeamComp?: CompProfile;
  /** Spec traits no motor (3.3): objetivo da luta, quando ela e uma disputa de poco. */
  pitObjective?: ObjectiveKind;
  /** Meta do alvo principal da luta (para targetFit de killerScore). */
  targetMeta?: { functionalTags: string[] };
  /** Segundos de jogo (redundante com minute * 60, mas conveniente para soft-cap). */
  gameSec?: number;
}

// ---------------------------------------------------------------------------
// Tabelas de priors [ASSUMED]: re-ancoradas na economia FLAT
// Comentadas como prior FLAT sujeito a recalibracao (Plan 06 / Fase 13)
// ---------------------------------------------------------------------------

/**
 * Peso base por role × eventType para o killer.
 * [ASSUMED]: re-ancorado de pesquisa2.md em economia flat (overall 35-70).
 * Direcionalidade: support~0.1 (raro finalizar); ADC/mid mais alto no mid/late;
 * jungle concentra kills em gank/dive; top variavel.
 * Nota: solo_kill corresponde ao conceito "pickoff" (catch 1v1);
 *       comeback_fight corresponde ao conceito "teamfight".
 */
export const KILLER_ROLE_WEIGHTS: Partial<Record<EventKind, Partial<Record<Role, number>>>> = {
  gank:          { top: 0.20, jungle: 0.55, mid: 0.30, adc: 0.15, support: 0.10 },
  solo_kill:     { top: 0.25, jungle: 0.40, mid: 0.45, adc: 0.25, support: 0.10 }, // pickoff
  comeback_fight:{ top: 0.30, jungle: 0.32, mid: 0.42, adc: 0.50, support: 0.30 }, // teamfight, recalibracao Plan 06: support 0.15->0.30 / jungle 0.30->0.32 / mid 0.40->0.42 (paridade Phase 11 killer dist; adc restaurado para 0.50)
  kill:          { top: 0.22, jungle: 0.28, mid: 0.38, adc: 0.45, support: 0.12 },
  dive:          { top: 0.35, jungle: 0.45, mid: 0.25, adc: 0.20, support: 0.12 },
  first_blood:   { top: 0.28, jungle: 0.42, mid: 0.38, adc: 0.22, support: 0.12 },
};
// Fallback para eventTypes nao listados: usar "kill"
const KILLER_ROLE_FALLBACK: Partial<Record<Role, number>> = {
  top: 0.22, jungle: 0.28, mid: 0.38, adc: 0.45, support: 0.12,
};

/**
 * Peso base por role × eventType para a vitima.
 * [ASSUMED]: re-ancorado de pesquisa2.md em economia flat.
 * Direcionalidade: support e ADC mais vulneraveis em gank/solo_kill; top em dive.
 */
export const VICTIM_ROLE_WEIGHTS: Partial<Record<EventKind, Partial<Record<Role, number>>>> = {
  gank:          { top: 0.30, jungle: 0.25, mid: 0.30, adc: 0.35, support: 0.40 },
  solo_kill:     { top: 0.25, jungle: 0.30, mid: 0.30, adc: 0.45, support: 0.50 }, // pickoff
  comeback_fight:{ top: 0.20, jungle: 0.25, mid: 0.30, adc: 0.30, support: 0.45 }, // teamfight
  kill:          { top: 0.22, jungle: 0.25, mid: 0.28, adc: 0.32, support: 0.42 },
  dive:          { top: 0.45, jungle: 0.20, mid: 0.25, adc: 0.20, support: 0.30 },
  first_blood:   { top: 0.25, jungle: 0.22, mid: 0.28, adc: 0.28, support: 0.40 },
};
// Fallback para eventTypes nao listados: usar "kill"
const VICTIM_ROLE_FALLBACK: Partial<Record<Role, number>> = {
  top: 0.22, jungle: 0.25, mid: 0.28, adc: 0.32, support: 0.42,
};

/**
 * Fit de archetype para matar por tipo de evento.
 * [ASSUMED]: derivado de pesquisa2.md + functionalTags de championMeta.
 * Default 1.0 para entradas ausentes (Partial records).
 * Nota: solo_kill=pickoff, comeback_fight=teamfight nos valores originais.
 */
export const ARCHETYPE_KILL_FIT: Partial<Record<ChampionClass, Partial<Record<EventKind, number>>>> = {
  assassin:          { solo_kill: 1.40, gank: 1.20, kill: 1.20, comeback_fight: 0.90, dive: 1.10 },
  marksman:          { comeback_fight: 1.10, kill: 1.10, solo_kill: 0.80, gank: 0.75, dive: 0.70 }, // recalibracao Plan 06: comeback_fight 1.35->1.10 (banda DOMINANTE; kills mais distribuidos)
  mage:              { comeback_fight: 1.10, solo_kill: 1.20, kill: 1.10, gank: 1.00, dive: 0.85 }, // recalibracao Plan 06: comeback_fight 1.20->1.10 kill 1.15->1.10
  fighter:           { dive: 1.25, gank: 1.15, comeback_fight: 1.05, solo_kill: 1.05, kill: 1.00 },
  skirmisher:        { gank: 1.30, solo_kill: 1.20, dive: 1.20, comeback_fight: 1.00, kill: 1.00 },
  diver:             { dive: 1.35, gank: 1.25, comeback_fight: 1.10, solo_kill: 1.00, kill: 1.05 },
  tank:              { dive: 1.10, comeback_fight: 0.80, solo_kill: 0.70, gank: 0.80, kill: 0.75 },
  "engage-support":  { dive: 0.90, comeback_fight: 0.70, gank: 0.65, solo_kill: 0.55, kill: 0.45 },
  enchanter:         { comeback_fight: 0.60, kill: 0.40, solo_kill: 0.40, gank: 0.40, dive: 0.35 },
  support:           { comeback_fight: 0.65, kill: 0.45, solo_kill: 0.45, gank: 0.50, dive: 0.45 },
  "poke-support":    { comeback_fight: 0.80, kill: 0.65, solo_kill: 0.70, gank: 0.55, dive: 0.50 },
};

/**
 * Cap de assists por tipo de evento (nao por alive-count, Pitfall 2).
 * [ASSUMED] ancora: ~2.3-2.6 assists/kill medio em jogo flat.
 * Nota: comeback_fight=teamfight (3-4 assists); gank/solo_kill=pickoff (1-3 assists).
 * 26-06 elevou gank e solo_kill de 2 para 3 (o ponto 2 do criterio 6 do roadmap);
 * first_blood, dive e kill continuam inertes, ver comentario em cada linha.
 */
export const ASSIST_COUNT_BY_EVENT: Partial<Record<EventKind, number>> = {
  first_blood:    1,  // inerte hoje: nenhum ponto de chamada de applyKill passa "first_blood" (26-02 A2); so ficaria alcancavel se um caminho novo passasse a citar esse tipo explicitamente
  gank:           3,  // 26-06 (roadmap criterio 6): 2 -> 3, pickoff alcancado, teto era o que saturava junto com o sorteio de 3
  dive:           2,  // inerte hoje: nenhum ponto de chamada de applyKill passa "dive" (26-02 A2); so ficaria alcancavel se a intencao de dive ganhasse eventKind proprio
  solo_kill:      3,  // 26-06 (roadmap criterio 6): 2 -> 3, pickoff alcancado, mesmo motivo de gank
  kill:           2,  // inerte hoje: "kill" e so o default de applyKill(), e os dois pontos de chamada existentes sempre passam um tipo explicito (26-02 A2); so ficaria alcancavel se um call site novo omitisse o argumento
  comeback_fight: 4,  // teamfight: ja elevado por construcao pelo ponto 1 (limite do sorteio 3 -> 4 em engine.ts), o teto da tabela nao e o gargalo aqui
};
// Fallback para eventTypes nao listados: 2
const ASSIST_COUNT_FALLBACK = 2;

/**
 * Score minimo de contribuicao para receber assist.
 * [ASSUMED]: validar vs distribuicao em 1 pass ad-hoc (Plan 06).
 */
export const ASSIST_MIN_SCORE: Partial<Record<EventKind, number>> = {
  comeback_fight: 0.60,  // mais permissivo: teammates distantes ainda participam
  gank:           0.80,  // so quem estava presente na lane
  dive:           0.75,
  solo_kill:      0.80,  // pickoff: so quem estava presente
  kill:           0.70,
  first_blood:    0.75,
};
// Fallback para eventTypes nao listados: 0.70
const ASSIST_MIN_FALLBACK = 0.70;

// ---------------------------------------------------------------------------
// Helpers de lookup (null-safe, com fallbacks)
// ---------------------------------------------------------------------------

function getKillerRoleWeight(eventType: EventKind, role: Role): number {
  const table = KILLER_ROLE_WEIGHTS[eventType] ?? KILLER_ROLE_FALLBACK;
  return table[role] ?? 0.25;
}

function getVictimRoleWeight(eventType: EventKind, role: Role): number {
  const table = VICTIM_ROLE_WEIGHTS[eventType] ?? VICTIM_ROLE_FALLBACK;
  return table[role] ?? 0.25;
}

function getArchetypeKillFit(cls: ChampionClass, eventType: EventKind): number {
  return ARCHETYPE_KILL_FIT[cls]?.[eventType] ?? 1.0;
}

function getAssistCountCap(eventType: EventKind): number {
  return ASSIST_COUNT_BY_EVENT[eventType] ?? ASSIST_COUNT_FALLBACK;
}

function getAssistMinScore(eventType: EventKind): number {
  return ASSIST_MIN_SCORE[eventType] ?? ASSIST_MIN_FALLBACK;
}

// ---------------------------------------------------------------------------
// Helpers de estado do jogo (laneState/weakside)
// ---------------------------------------------------------------------------

/**
 * Retorna true se o jogador esta em weakside na lane especificada.
 * Usa laneState.weaksideState da perspective do time inimigo (o weakside e
 * definido do ponto de vista de quem esta recebendo a pressao).
 */
function getWeaksideFor(state: MatchState, p: PlayerState, lane: Lane): boolean {
  // O weakside do jogador e o weakside do time dele naquela lane
  const teamSide = p.card.id && state.user.players
    ? Object.values(state.user.players).some(up => up.card.id === p.card.id) ? "user" : "rival"
    : "user";
  const teamState = state[teamSide];
  const laneEntry = teamState.laneState[lane];
  return laneEntry?.weaksideState?.active ?? false;
}

// ---------------------------------------------------------------------------
// killerScore: peso bruto (sem softCapDamp neste plano, Plan 03 adiciona)
// ---------------------------------------------------------------------------

/**
 * Calcula o peso bruto de um candidato a killer.
 * Factors: roleBase × archFit × goldPower × access × uptime × resetBonus × targetFit.
 * Range tipico em flat: 0.01..3.0 antes de qualquer damping.
 * [KDA-01/02, Phase 12]
 *
 * Plan 03: retorno embrulhado em softCapDamp(rawKiller, p, "kills", ctx).
 */
export function killerScore(p: PlayerState, ctx: FightContext): number {
  const roleBase  = getKillerRoleWeight(ctx.eventType, p.role);
  const archFit   = getArchetypeKillFit(p.meta.primaryClass, ctx.eventType);
  // goldPower: proxy via metricsBase.damageThreat (range 0..1 em flat)
  // Ancorado em [0.80..1.20] para range flat (Pitfall 4: nao colar pro-escalado)
  const goldPower = clamp(0.80 + p.metricsBase.damageThreat * 0.40, 0.80, 1.20);
  // access: proxy via pickThreat (capacidade de chegar no alvo)
  const access    = clamp(0.80 + p.metricsBase.pickThreat * 0.40, 0.80, 1.20);
  // uptime: proxy via damageThreat (sustain de dano na luta)
  const uptime    = clamp(0.80 + p.metricsBase.damageThreat * 0.40, 0.80, 1.20);
  // resetBonus: snowballer com alvos de baixo HP
  const resetBonus = (
    p.meta.functionalTags.includes("early-snowball") && ctx.lowHpTargets
  ) ? 1.10 : 1.0;
  // targetFit: pick comp encontrando alvo protect-carry
  const targetFit = (
    ctx.targetMeta?.functionalTags.includes("protect-carry") === true &&
    p.meta.functionalTags.includes("pick")
  ) ? 1.08 : 1.0;

  // Spec traits no motor: peso das traits novas, 1 sem portador (T-02).
  const rawKiller = roleBase * archFit * goldPower * access * uptime * resetBonus * targetFit * traitKillerWeight(p, ctx);
  // Plan 03: wrap em softCapDamp: amortece o peso quando kills passa da banda do role/archetype
  return softCapDamp(rawKiller, p, "kills", ctx);
}

// ---------------------------------------------------------------------------
// victimScore: peso bruto (sem softCapDamp neste plano)
// ---------------------------------------------------------------------------

/**
 * Calcula o peso bruto de um candidato a vitima.
 * Factors: roleBase × deathRisk × exposed × noFlash × isolated × weakside
 *          × noPeel × engageTax × bountyGreed × protectCarryDamp.
 * Range tipico em flat: 0.01..3.0.
 * [KDA-01/02, Phase 12]
 *
 * Plan 03: retorno embrulhado em softCapDamp(rawVictim, p, "deaths", ctx).
 */
export function victimScore(p: PlayerState, ctx: FightContext): number {
  const roleBase   = getVictimRoleWeight(ctx.eventType, p.role);
  // deathRisk: ancorado em [0.75..1.25] em flat (Pitfall 4)
  const deathRisk  = clamp(0.75 + p.metricsBase.deathRisk * 0.50, 0.75, 1.25);
  // exposed: 0..1 de exposicao individual
  const exposed    = 1.0 + (ctx.exposure?.[p.card.id] ?? 0);
  // noFlash: flashUp e boolean (default true = sem multiplicador)
  const noFlash    = p.flashUp === false ? 1.18 : 1.0;
  // isolated: longe do time
  const isolated   = ctx.isolated?.[p.card.id] ? 1.20 : 1.0;
  // weakside: usa laneState da Fase 10
  const weakside   = (ctx.lane != null && getWeaksideFor(ctx.state, p, ctx.lane)) ? 1.12 : 1.0;
  // noPeel: quem tem peelScore baixo e mais vulneravel
  const noPeel     = 1.0 + Math.max(0, 0.45 - (p.metricsBase.peelScore ?? 0.45));
  // engageTax: engage support em comeback_fight (teamfight) morre mais (entra primeiro)
  const engageTax  = (
    p.meta.functionalTags.includes("engage") && ctx.eventType === "comeback_fight"
  ) ? 1.15 : 1.0;
  // bountyGreed: alvo com shutdown gold alto e mais tentador
  // shutdown em ouro real (teto 700): 400 continua sendo "bounty alto".
  const bountyGreed = p.shutdownGold >= 400 ? 1.05 : 1.0;

  // protectCarry damp (secao 7 de 12-RESEARCH.md): comp adversaria protect-carry
  // reduz a chance de matar o carry do proprio time
  const protectCarryDamp = (
    ctx.killerTeamComp?.dominantTags?.includes("protect-carry") === true &&
    (p.role === "adc" || p.role === "mid")
  ) ? 0.80 : 1.0;

  // Spec traits no motor: peso das traits novas, 1 sem portador (T-02).
  const rawVictim = (
    roleBase * deathRisk * exposed * noFlash * isolated * weakside *
    noPeel * engageTax * bountyGreed * protectCarryDamp * traitVictimWeight(p, ctx)
  );
  // Plan 03: wrap em softCapDamp: amortece o peso quando deaths passa da banda do role/archetype
  return softCapDamp(rawVictim, p, "deaths", ctx);
}

// ---------------------------------------------------------------------------
// assistScore: re-rank deterministico de assists (sem rng)
// ---------------------------------------------------------------------------

/**
 * Expoente de compressao aplicado a meta.assistBias NO PONTO DE USO (alavanca 4
 * do sweep do Plano 24-03).
 *
 * O DEFEITO QUE ELE CORRIGE. A razao de meta.assistBias entre um suporte e um
 * carry vale 3,60 no conjunto controlado (thresh 1,80 contra vayne 0,50) e 2,86
 * nos ROLE_DEFAULTS (2,00 contra 0,70). A fonte diz outra coisa: em STACK.md
 * secao 4.7 a razao de assistencias medias entre suporte e ADC e 10,26 / 5,78 =
 * 1,78 em 2025 e 8,80 / 5,22 = 1,69 em 2024. O dado autoral esta com o dobro do
 * espalhamento que a referencia sustenta, e era isso que fazia o suporte absorver
 * de 39 a 45 por cento das assistencias do time contra 27,95 por cento da fonte.
 *
 * POR QUE NO PONTO DE USO E NAO NO DADO. championMeta.ts tem 176 entradas de
 * dado autoral, e a ordem relativa entre elas e uma decisao de design que esta
 * correta. O problema nao e a ordem, e a ESCALA. Um expoente na leitura corrige
 * a escala e PRESERVA a ordem por construcao: x elevado a k e monotona crescente
 * para qualquer k maior que zero, entao alistair (2,00) continua acima de
 * aphelios (0,50) e nenhuma das 176 entradas troca de posicao com outra.
 *
 * DERIVACAO DO VALOR. Alvo: levar a razao 3,60 do conjunto controlado para o
 * meio da faixa da fonte, 1,75. Como a compressao e (a/b)^k, basta resolver
 * k = ln(1,75) / ln(3,60) = 0,5596 / 1,2809 = 0,437, arredondado para 0,44.
 * Conferencia: 1,80^0,44 = 1,2950 e 0,50^0,44 = 0,7370, razao 1,757, dentro da
 * faixa 1,69 a 1,78 de STACK.md secao 4.7. Nos ROLE_DEFAULTS a razao 2,86 cai
 * para 2,00^0,44 / 0,70^0,44 = 1,3563 / 0,8562 = 1,584.
 *
 * FAIXA VALIDA DO PARAMETRO. Sair da faixa 1,69 a 1,78 na razao suporte sobre
 * carry e sair da fonte. No conjunto controlado isso limita o expoente ao
 * intervalo k de 0,4096 (razao 1,69) a 0,4502 (razao 1,78).
 *
 * SWEEP MEDIDO, e por que 0,44 e nao outro valor da faixa. As duas bordas da
 * faixa valida foram medidas com re-medicao completa de calibrate:assists e a
 * taxa do ADC por abate do time no conjunto controlado ficou em 0,266 nas duas:
 *   k = 0,41 (razao 1,691) -> 0,266
 *   k = 0,44 (razao 1,757) -> 0,266
 *   k = 0,45 (razao 1,780) -> 0,266
 * A metrica asserida e INSENSIVEL ao parametro dentro da faixa da fonte, porque
 * assignAssists escolhe os n primeiros por chave e uma variacao de 5 por cento no
 * peso nao inverte a ordem. Como a medicao nao distingue os tres, o valor fica no
 * DERIVADO, que e o centro da faixa da fonte, e nao numa borda escolhida a dedo.
 *
 * ONDE A BANDA FECHARIA, medido e registrado para a fase que herdar o assunto:
 *   k = 0,38 (razao 1,627) -> 0,266
 *   k = 0,34 (razao 1,546) -> 0,277
 *   k = 0,30 (razao 1,469) -> 0,284, DENTRO da banda
 * Ou seja, o piso de 0,280 so e alcancado com a razao suporte sobre carry entre
 * 1,47 e 1,55, que fica de 9 a 13 por cento ABAIXO do piso 1,69 da fonte. Fechar
 * a banda por aqui exigiria abandonar a ancora, e por isso NAO foi feito: o
 * residual esta escalado no 24-03-SUMMARY.md e o dono e a Fase 26.
 *
 * [MEDIDO] Plano 24-03, alavanca 4.
 */
export const ASSIST_BIAS_COMPRESS = 0.44;

/**
 * Score de contribuicao para assist. Re-rank puro, deterministico.
 * [KDA-03, Phase 12; compressao de escala em ASSIST_BIAS_COMPRESS, Fase 24]
 */
export function assistScore(p: PlayerState, _ctx: Pick<FightContext, "eventType">): number {
  // metricsBase.assistBias: 0..1 em flat; neutro = 0.5
  const metricsBias = 0.5 + (p.metricsBase.assistBias ?? 0) * 0.5; // 0.5..1.0
  // meta.assistBias: bias de archetype, lido COMPRIMIDO. O dado de
  // championMeta.ts nao e alterado: a ordem entre os 176 campeoes e preservada
  // e so a escala do espalhamento entra na faixa da fonte. Ver a derivacao no
  // comentario de ASSIST_BIAS_COMPRESS.
  const metaFactor  = Math.pow(p.meta.assistBias ?? 1.0, ASSIST_BIAS_COMPRESS);

  // Role bias: support e jungle participam mais.
  //
  // NAO RE-ANCORAR SEM MEDICAO QUE EXIJA. O Plano 24-03 chegou a mover esta
  // tabela (alavanca 3 do sweep) e depois REVERTEU, porque a medicao mostrou que
  // ela ja estava certa: a razao suporte sobre ADC aqui e 1,20, e a razao das
  // participacoes de referencia em STACK.md secao 4.7 item 3 e 74,8 / 70,0 =
  // 1,07. A distancia e pequena e o defeito que a re-ancoragem tentava compensar
  // era outro, e estava em meta.assistBias, que tem correcao propria em
  // ASSIST_BIAS_COMPRESS. Empilhar as duas deixaria esta tabela fora da fonte
  // sem necessidade.
  const roleFactor  = p.role === "support" ? 1.20
                    : p.role === "jungle"  ? 1.10
                    : 1.0;

  return metricsBias * metaFactor * roleFactor;
}

// ---------------------------------------------------------------------------
// assistWeight: penalizacao de peso no lugar de exclusao (AST-01, Fase 24)
//
// O PONTO CENTRAL DESTA CAMADA, e a razao de ela existir:
// ASSIST_MIN_SCORE NAO muda de valor nem de significado numerico. O que muda e
// o PAPEL do limiar. Ate a Fase 24 ele era um criterio de EXCLUSAO: quem ficava
// abaixo dele saia da lista e virava estruturalmente inelegivel para assistencia.
// A medicao do Plano 24-01 mostrou o efeito real disso: no conjunto controlado de
// carries, QUATRO rotas (top, jungle, mid e adc) marcaram zero absoluto em 800
// partidas e o suporte absorveu 100% das assistencias do time, porque campeoes
// carry carregam meta.assistBias 0,50 e o produto do assistScore cai para cerca
// de 0,35, abaixo de qualquer entrada da tabela.
//
// A partir daqui o mesmo numero passa a ser o JOELHO de uma rampa de penalizacao:
// acima dele a funcao e identidade sobre o score (nada muda para quem ja era
// elegivel), abaixo dele o peso cai de forma continua e monotona, mas nunca zera.
// Nenhum limiar foi afrouxado; mudou o que acontece com quem fica abaixo dele.
// ---------------------------------------------------------------------------

/**
 * Piso do fator de penalizacao aplicado a quem fica ABAIXO do limiar do evento.
 * Espelha DAMP_FLOOR e a decisao D-01 do projeto ("o absurdo fica raro, nunca
 * impossivel"), aqui na forma "a contribuicao pequena fica improvavel, nunca
 * impossivel": mesmo com score tendendo a zero, o peso final guarda esta fracao
 * do score em vez de virar zero.
 *
 * [MEDIDO] Plano 24-03, alavanca 1 (NIVEL), serie 0,20 / 0,35 / 0,50 / 0,65 com
 * o expoente fixo em 1,0 e re-medicao completa de calibrate:assists entre
 * iteracoes. Resultado medido:
 *   0,20 -> taxa do ADC 0,236 no CONTROLE, 0,255 no MISTO, 0,196 no SEM-CAMPEOES
 *   0,35 -> 0,236 / 0,256 / 0,218
 *   0,50 -> 0,236 / 0,256 / 0,223
 *   0,65 -> 0,236 / 0,256 / 0,224
 * O conjunto CONTROLADO e INVARIANTE a este parametro, e a invariancia e
 * estrutural e nao ruido de amostra: ali as quatro rotas penalizadas tem score
 * proporcional entre si, entao o piso escala todos os pesos das penalizadas
 * junto e nao muda quem vence a chave de Efraimidis-Spirakis. O suporte fica
 * ACIMA do joelho e seu peso nao depende deste piso. Enumerando as 24
 * permutacoes de quatro companheiros com cap 2, o suporte entra nas 24 e cada
 * carry em 8 para qualquer valor do piso, inclusive 1,00 (penalizacao removida).
 * 0,65 e escolhido porque e o unico valor da serie que melhora as duas linhas
 * observadas ao mesmo tempo e o que menos deixa o suporte absorver assistencia
 * nos tres conjuntos, sem piorar nada.
 */
export const ASSIST_BELOW_MIN_FLOOR = 0.65;

/**
 * Expoente da rampa de penalizacao abaixo do joelho. 1,0 e a rampa linear:
 * o fator caminha em linha reta do piso (score zero) ate 1,0 (score no joelho).
 * Expoente maior que 1 penaliza mais perto do piso; menor que 1 penaliza menos.
 *
 * [MEDIDO] Plano 24-03, alavanca 2 (FORMA), serie 0,5 / 1,0 / 1,5 com o piso ja
 * fixado em 0,65 e re-medicao completa de calibrate:assists entre iteracoes:
 *   0,5 -> taxa do ADC 0,236 no CONTROLE, 0,257 no MISTO, 0,225 no SEM-CAMPEOES
 *   1,0 -> 0,236 / 0,256 / 0,224
 *   1,5 -> 0,236 / 0,256 / 0,223
 * Mesma invariancia estrutural do piso no conjunto CONTROLADO, e pela mesma
 * razao: o expoente tambem e uma transformacao monotona comum aos quatro scores
 * penalizados e nao altera quem vence a chave de Efraimidis-Spirakis ali.
 * 0,5 e escolhido por ser o valor da serie que mais aproxima as duas linhas
 * observadas do piso da banda, sem piorar nenhuma medida.
 */
export const ASSIST_BELOW_MIN_EXP = 0.5;

/**
 * Piso absoluto de peso, espelhando o Math.max(0.01, ...) que selectKiller e
 * selectVictim ja aplicam antes de mandar um peso para a roleta. Existe para
 * garantir que a chave de amostragem de assignAssists nunca receba peso zero,
 * o que tornaria o expoente 1/peso infinito.
 */
export const ASSIST_WEIGHT_FLOOR = 0.01;

/**
 * Peso de assistencia de um jogador: o assistScore com penalizacao continua
 * abaixo do limiar do tipo de evento, em vez de exclusao.
 *
 * Pura e livre de aleatoriedade: mesma entrada, mesma saida, sem gerador nos
 * parametros. Garante peso estritamente positivo para QUALQUER combinacao de
 * rota e campeao, que e exatamente o que fecha AST-01.
 *
 * [AST-01, Fase 24]
 */
export function assistWeight(p: PlayerState, ctx: Pick<FightContext, "eventType">): number {
  const score    = assistScore(p, ctx);
  const minScore = getAssistMinScore(ctx.eventType);

  // No joelho ou acima dele a funcao e identidade: quem ja era elegivel hoje
  // mantem exatamente o peso que o score sempre deu.
  if (score >= minScore) return Math.max(ASSIST_WEIGHT_FLOOR, score);

  // Abaixo do joelho: rampa continua de ASSIST_BELOW_MIN_FLOOR (score zero) ate
  // 1,0 (score igual ao limiar). A continuidade no joelho e o que impede um
  // degrau artificial na fronteira: em score == minScore o fator vale 1,0.
  const razao  = clamp(score / minScore, 0, 1);
  const fator  = ASSIST_BELOW_MIN_FLOOR +
                 (1 - ASSIST_BELOW_MIN_FLOOR) * Math.pow(razao, ASSIST_BELOW_MIN_EXP);

  return Math.max(ASSIST_WEIGHT_FLOOR, score * fator);
}

// ---------------------------------------------------------------------------
// selectKiller: roulette ponderada, 1 draw exato (KDA-01)
// ---------------------------------------------------------------------------

/**
 * Seleciona o killer de um conjunto de candidatos usando roulette ponderada.
 * Consome exatamente 1 draw de rng (via parametro), identico a pickActor (Strategy A, D-06).
 * Desempates deterministicos por ordem de ROLES (top>jungle>mid>adc>support).
 * [KDA-01/02, Phase 12]
 */
export function selectKiller(
  candidates: PlayerState[],
  ctx: FightContext,
  rng: () => number,
): PlayerState {
  // Fallback: se vazio, erro de uso, mas por seguranca retorna o primeiro disponivel
  if (candidates.length === 0) {
    throw new Error("selectKiller: candidates array must not be empty");
  }

  // Calcular pesos (identico ao pickActor, apenas expressao de peso muda)
  const weights = candidates.map(p => Math.max(0.01, killerScore(p, ctx)));
  const total   = weights.reduce((s, w) => s + w, 0);

  // 1 draw: aridade identica ao pickActor original
  let roll = rng() * total;

  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }

  // Fallback deterministico (floating point): retornar o ultimo (como pickActor)
  return candidates[candidates.length - 1];
}

// ---------------------------------------------------------------------------
// selectVictim: roulette ponderada, 1 draw exato, null se vazio (KDA-01)
// ---------------------------------------------------------------------------

/**
 * Seleciona a vitima de um conjunto de candidatos usando roulette ponderada.
 * Consome exatamente 1 draw de rng (via parametro), identico a livingTarget (Strategy A, D-06).
 * Retorna null se candidates for vazio (paridade com livingTarget).
 * [KDA-01/02, Phase 12]
 */
export function selectVictim(
  candidates: PlayerState[],
  ctx: FightContext,
  rng: () => number,
): PlayerState | null {
  // Paridade com livingTarget: retorna null se ninguem vivo
  if (candidates.length === 0) return null;

  // Calcular pesos (identico ao livingTarget, apenas expressao de peso muda)
  const weights = candidates.map(p => Math.max(0.01, victimScore(p, ctx)));
  const total   = weights.reduce((s, w) => s + w, 0);

  // 1 draw: aridade identica ao livingTarget original
  let roll = rng() * total;

  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }

  // Fallback deterministico: retornar o ultimo (como livingTarget)
  return candidates[candidates.length - 1];
}

// ---------------------------------------------------------------------------
// permutationUniform: a fonte uniforme que a engine JA PAGA (AST-03, INV-1)
// ---------------------------------------------------------------------------

/**
 * Devolve a fonte uniforme associada a posicao de um elemento numa lista ja
 * embaralhada: (posicao + 1) / (tamanho + 1).
 *
 * DE ONDE VEM A ALEATORIEDADE. Nao daqui. Ela vem da permutacao Fisher-Yates
 * que src/sim/engine.ts:1236-1239 ja paga (n-1 draws) antes de chamar
 * assignAssists, e que ate a Fase 24 era DESCARTADA na pratica: o passo
 * seguinte reordenava tudo por score decrescente, entao a ordem embaralhada
 * nao influenciava mais nada. Esta funcao apenas recolhe aquele trabalho.
 *
 * POR QUE A GRADE FIXA E LEGITIMA. (i+1)/(tamanho+1) e exatamente o valor
 * esperado da i-esima estatistica de ordem de uma amostra de uniformes
 * independentes em [0,1]. Como a permutacao que chega e uniforme, espalhar essa
 * grade sobre a lista ja embaralhada equivale a uma amostragem ESTRATIFICADA
 * daquelas uniformes: mesma monotonicidade no peso (peso maior segue mais
 * provavel) e variancia menor, porque a grade nao repete nem agrupa valores.
 *
 * POR QUE ISSO HONRA INV-1. Zero draws novos: nenhuma chamada de gerador
 * acontece aqui nem em assignAssists. A aridade fica intacta, a ordem das
 * chamadas existentes fica intacta e src/sim/engine.ts nao e tocado.
 *
 * DEPENDENCIA DECLARADA (ameaca T-24-09). Esta funcao DEPENDE de a lista chegar
 * uniformemente embaralhada. Se algum dia o bloco Fisher-Yates de
 * src/sim/engine.ts:1236-1239 for removido por parecer redundante, a amostragem
 * vira deterministica em silencio. O teste exaustivo de cobertura por permutacao
 * em selection.test.ts falha se a lista deixar de variar.
 *
 * [AST-03, Fase 24]
 */
export function permutationUniform(index: number, size: number): number {
  return (index + 1) / (size + 1);
}

// ---------------------------------------------------------------------------
// assignAssists: amostragem ponderada SEM REPOSICAO, sem consumir draw (KDA-03/AST-01)
// ---------------------------------------------------------------------------

/**
 * Escolhe quem recebe assist na lista de mates que a engine ja embaralhou.
 *
 * CONTRATO NOVO (Fase 24). Ate aqui a funcao fazia re-rank deterministico:
 * filtrava por score minimo e cortava os primeiros por score decrescente. Isso
 * produzia dois defeitos somados. O filtro tornava rotas inteiras
 * ESTRUTURALMENTE inelegiveis (quatro rotas em zero absoluto com campeoes carry,
 * medido no Plano 24-01), e o sort tornava o resultado deterministico dado o
 * conjunto elegivel, entao a mesma rota ganhava sempre.
 *
 * Agora e AMOSTRAGEM PONDERADA SEM REPOSICAO por Efraimidis-Spirakis:
 *  - todo companheiro entra na disputa; a lista de candidatos NUNCA e reduzida
 *    antes da ordenacao. Nenhuma exclusao acontece em ponto algum;
 *  - o peso vem de assistWeight, onde o limiar por tipo de evento e o JOELHO de
 *    uma rampa de penalizacao e nao mais um criterio de corte;
 *  - a fonte uniforme vem de permutationUniform, ou seja, da permutacao que a
 *    engine ja pagou. Esta funcao continua sem receber gerador e sem consumir
 *    nenhum draw (invariante KDA-05 / INV-1);
 *  - o desempate e deterministico pela posicao original, para que um empate
 *    exato de ponto flutuante nunca vire dependencia da estabilidade do
 *    algoritmo de ordenacao da plataforma.
 *
 * A funcao continua PURA: mesma lista, mesmo numero e mesmo contexto devolvem
 * sempre a mesma saida.
 *
 * Cap: Math.min(nAssists, ASSIST_COUNT_BY_EVENT[eventType], shuffledMates.length).
 *
 * [KDA-03, Phase 12; AST-01/AST-03, Fase 24]
 */
export function assignAssists(
  _killerId: string,
  shuffledMates: PlayerState[],
  nAssists: number,
  ctx: Pick<FightContext, "eventType">,
): PlayerState[] {
  if (shuffledMates.length === 0) return [];

  const cap  = getAssistCountCap(ctx.eventType);
  const n    = Math.min(nAssists, cap, shuffledMates.length);
  const size = shuffledMates.length;

  // Chave de Efraimidis-Spirakis: u elevado a 1/peso. Peso maior empurra a chave
  // para perto de 1, entao o peso manda na probabilidade sem excluir ninguem.
  // A ordem de chegada E a ordem da permutacao ja paga pela engine.
  const chaveados = shuffledMates.map((p, i) => ({
    p,
    posicao: i,
    chave: Math.pow(permutationUniform(i, size), 1 / assistWeight(p, ctx)),
  }));

  // Chave decrescente; desempate deterministico pela posicao original crescente.
  chaveados.sort((a, b) => (b.chave - a.chave) || (a.posicao - b.posicao));

  return chaveados.slice(0, n).map((e) => e.p);
}
