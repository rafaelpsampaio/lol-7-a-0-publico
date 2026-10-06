/**
 * src/sim/traitEffects.ts
 *
 * Efeito no motor das traits novas do pack dos amigos (spec
 * docs/superpowers/specs/2026-10-05-traits-no-motor-design.md). O `quits` mora em quits.ts.
 *
 * Regras da spec:
 *   - T-02: sem portador, toda funcao devolve o valor neutro e nenhuma consome sorteio.
 *   - T-03: a trait muda o peso de um sorteio que ja existe; so o all-in do flips e o quit criam
 *     ocorrencia nova.
 *   - T-04: so age com o portador em jogo (vivo e sem quit).
 * Puro: sem Math.random e sem I/O. Os numeros ficam em TRAIT_TUNING, ponto de partida da
 * calibracao (scripts/calibrate-traits.ts).
 */

import type { PlayerTrait, PlayerVersion, Role } from "../data/schema";
import type { Lane, MatchState, PlayerState, Side, TeamState } from "./matchState";
import { LANES, ROLES, opponent, teamOf } from "./matchState";
import { LANE_LEAD_CAP } from "./laneState";
import type { FightContext } from "./selection";
import type { ObjectiveKind } from "./objectives";
import type { MacroIntent } from "./engine";

/** As 6 traits da A-04 (spec do pack dos amigos), as que esta spec liga no motor. */
export const NEW_TRAITS: readonly PlayerTrait[] = ["teamfights", "flips", "dragon_lover", "roamer", "side", "quits"];

/** Valores iniciais (spec 3.7). Mudar so com o relatorio de calibracao na mao. */
export const TRAIT_TUNING = {
  teamfightsSliceBonus: 5,
  teamfightsKillerWeight: 1.4,
  teamfightsVictimWeight: 0.85,
  flipsKillerWeight: 1.5,
  flipsVictimWeight: 2.2,
  flipsAllInChance: 0.04,
  flipsAllInFromSec: 90,
  flipsAllInUntilSec: 840,
  flipsEdgeScale: 40,
  flipsLeadScale: 120,
  flipsWinMin: 0.15,
  flipsWinMax: 0.85,
  objectiveLoverSetupBonus: 1.5,
  /** Igual a PREP_ANNOUNCE_AT (readiness.ts); copiado para nao criar import circular. */
  objectiveLoverContestAt: 50,
  objectiveLoverContestBonus: 2,
  objectiveLoverAheadAt: 0.55,
  objectiveLoverAheadPrepMult: 1.3,
  objectiveLoverStealBonus: 0.1,
  objectiveLoverExposure: 0.5,
  objectiveLoverPitVictimWeight: 1.4,
  roamerUntilSec: 840,
  roamerGankBonus: 1.5,
  roamerKillShare: 0.5,
  roamerLaneLeadCost: 6,
  sideSplitBonus: 1.0,
  sideForceBonus: 0.15,
  /**
   * Fora da tabela 3.7: ponto de partida da calibracao (redesenho da Task 5, alvo da secao 6).
   * 25 foi o menor valor com ganho claro nas torres da rota dele (relatorio da Task 5).
   */
  sidePressureBonus: 25,
  quitMinDeaths: 4,
  quitDeathRatio: 2,
  quitStreakDeaths: 3,
  quitStreakWindowSec: 300,
  quitChance: 1 / 3,
  quitReturnChance: 0.5,
  quitReturnMinSec: 120,
  quitReturnMaxSec: 300,
  afkGoldPerMin: 122.4,
};

/** Rota de cada funcao; o jungler nao tem rota (null). */
export const LANE_OF_ROLE: Record<Role, Lane | null> = {
  top: "top",
  jungle: null,
  mid: "mid",
  adc: "bot",
  support: "bot",
};

/** Objetivos do Ama objetivos (T-05): Barao e Elder ficam de fora, precisam do time. */
export const LOVER_KINDS: readonly ObjectiveKind[] = ["dragon", "voidgrubs", "herald"];

/** Portador da trait em jogo: vivo, sem quit e com a trait no card (T-04). */
export function traitActive(p: PlayerState, trait: PlayerTrait): boolean {
  return p.alive && p.away !== true && p.card.traits.includes(trait);
}

/** Primeiro portador em jogo do time, na ordem de ROLES; null sem nenhum. */
export function activeHolder(team: TeamState, trait: PlayerTrait): PlayerState | null {
  for (const role of ROLES) {
    const p = team.players[role];
    if (traitActive(p, trait)) return p;
  }
  return null;
}

/** teamfights (3.1): bonus na fatia teamfight do portador em jogo. */
export function teamfightsSliceBonus(p: PlayerState): number {
  return traitActive(p, "teamfights") ? TRAIT_TUNING.teamfightsSliceBonus : 0;
}

/** Peso extra de quem mata no sorteio de selectKiller. 1 sem portador (T-02). */
export function traitKillerWeight(p: PlayerState, ctx: FightContext): number {
  let w = 1;
  if (ctx.eventType === "comeback_fight" && traitActive(p, "teamfights")) w *= TRAIT_TUNING.teamfightsKillerWeight;
  if (traitActive(p, "flips")) w *= TRAIT_TUNING.flipsKillerWeight;
  return w;
}

/** Peso extra de vitima no sorteio de selectVictim. 1 sem portador (T-02). */
export function traitVictimWeight(p: PlayerState, ctx: FightContext): number {
  let w = 1;
  if (ctx.eventType === "comeback_fight" && traitActive(p, "teamfights")) w *= TRAIT_TUNING.teamfightsVictimWeight;
  if (traitActive(p, "flips")) w *= TRAIT_TUNING.flipsVictimWeight;
  if (ctx.pitObjective !== undefined && LOVER_KINDS.includes(ctx.pitObjective) && traitActive(p, "dragon_lover")) {
    w *= TRAIT_TUNING.objectiveLoverPitVictimWeight;
  }
  return w;
}

/** Funcoes de cada rota no all-in: a de baixo tem ADC e suporte. */
const LANE_ROLES: Record<Lane, Role[]> = { top: ["top"], mid: ["mid"], bot: ["adc", "support"] };

/** Uma rota com all-in extra do flips possivel neste tick. */
export interface FlipsDuel {
  holderSide: Side;
  holder: PlayerState;
  lane: Lane;
}

/**
 * flips (3.2): uma entrada por rota (ordem de LANES) com portador em jogo e pelo menos um inimigo
 * vivo na rota, de flipsAllInFromSec ate antes de flipsAllInUntilSec. Com portador nos dois times
 * na mesma rota vale o do lado user. Lista vazia sem portador: o motor nao sorteia nada (T-02).
 */
export function flipsDuels(state: MatchState): FlipsDuel[] {
  const t = state.gameTimeSec;
  if (t < TRAIT_TUNING.flipsAllInFromSec || t >= TRAIT_TUNING.flipsAllInUntilSec) return [];
  const out: FlipsDuel[] = [];
  for (const lane of LANES) {
    for (const holderSide of ["user", "rival"] as Side[]) {
      const team = teamOf(state, holderSide);
      const enemy = teamOf(state, opponent(holderSide));
      const holder = LANE_ROLES[lane].map((r) => team.players[r]).find((p) => traitActive(p, "flips"));
      if (holder === undefined) continue;
      if (!LANE_ROLES[lane].some((r) => enemy.players[r].alive)) continue;
      out.push({ holderSide, holder, lane });
      break;
    }
  }
  return out;
}

/** Chance do portador ganhar o all-in do flips: 0,5 mais vantagem de laning e laneLead, limitada. */
export function flipsWinChance(edge: number, laneLead: number): number {
  const c = 0.5 + edge / TRAIT_TUNING.flipsEdgeScale + laneLead / TRAIT_TUNING.flipsLeadScale;
  return Math.max(TRAIT_TUNING.flipsWinMin, Math.min(TRAIT_TUNING.flipsWinMax, c));
}

/**
 * Vieses de intencao das traits novas, chamados pelo chooseIntent depois de todos os outros vieses
 * e antes do zero do gank. Muta `weights`; sem portador nao mexe em nada (T-02).
 *   - dragon_lover (3.3): +objectiveLoverSetupBonus no setup de cada objetivo dele preparavel, e
 *     +objectiveLoverContestBonus quando o inimigo ja tem preparo nele.
 *   - roamer (3.4): +roamerGankBonus no gank ate roamerUntilSec, com roamer de rota em jogo.
 *   - side (3.5): +sideSplitBonus no split_push no meio de jogo, com side de rota em jogo.
 */
export function applyTraitIntentBiases(
  state: MatchState,
  side: Side,
  weights: Partial<Record<MacroIntent, number>>,
  isPreparable: (kind: ObjectiveKind) => boolean
): void {
  const team = teamOf(state, side);
  const add = (intent: MacroIntent, w: number) => {
    weights[intent] = (weights[intent] ?? 0) + w;
  };
  if (activeHolder(team, "dragon_lover") !== null) {
    const enemyPrep = state.objectivePrep[opponent(side)];
    for (const kind of LOVER_KINDS) {
      if (!isPreparable(kind)) continue;
      const intent = `setup_${kind}` as MacroIntent;
      add(intent, TRAIT_TUNING.objectiveLoverSetupBonus);
      if (enemyPrep[kind] >= TRAIT_TUNING.objectiveLoverContestAt) add(intent, TRAIT_TUNING.objectiveLoverContestBonus);
    }
  }
  // roamer (3.4): mais gank ate 14:00; o chooseIntent zera o gank antes do 1o clear depois daqui.
  if (state.gameTimeSec < TRAIT_TUNING.roamerUntilSec && laneHolder(team, "roamer") !== null) {
    add("gank", TRAIT_TUNING.roamerGankBonus);
  }
  // side (3.5): mais split no meio de jogo.
  if (sideSplitLane(state, side) !== null) add("split_push", TRAIT_TUNING.sideSplitBonus);
}

/** Primeiro portador em jogo com rota (jungler fica de fora), na ordem de ROLES. */
function laneHolder(team: TeamState, trait: PlayerTrait): PlayerState | null {
  for (const role of ROLES) {
    const p = team.players[role];
    if (LANE_OF_ROLE[role] !== null && traitActive(p, trait)) return p;
  }
  return null;
}

/** roamer (3.4): o roamer em jogo do time quando o gank e numa rota que nao e a dele; senao null. */
export function roamerFor(team: TeamState, gankLane: Lane): PlayerState | null {
  for (const role of ROLES) {
    const lane = LANE_OF_ROLE[role];
    const p = team.players[role];
    if (lane !== null && lane !== gankLane && traitActive(p, "roamer")) return p;
  }
  return null;
}

/** roamer (3.4): custo do roam, a rota dele perde laneLead (piso -LANE_LEAD_CAP). */
export function applyRoamCost(team: TeamState, roamer: PlayerState): void {
  const lane = LANE_OF_ROLE[roamer.role];
  if (lane === null) return;
  const entry = team.laneState[lane];
  entry.laneLead = Math.max(-LANE_LEAD_CAP, entry.laneLead - TRAIT_TUNING.roamerLaneLeadCost);
}

/** dragon_lover (3.3): preparo mais rapido com o time a frente, so nos objetivos dele. */
export function objectiveLoverPrepMult(state: MatchState, side: Side, kind: ObjectiveKind): number {
  if (!LOVER_KINDS.includes(kind)) return 1;
  if (activeHolder(teamOf(state, side), "dragon_lover") === null) return 1;
  const winProb = side === "user" ? state.winProbUser : 1 - state.winProbUser;
  return winProb > TRAIT_TUNING.objectiveLoverAheadAt ? TRAIT_TUNING.objectiveLoverAheadPrepMult : 1;
}

/** dragon_lover (3.3): chance de roubo maior nos objetivos dele, com ele em jogo. */
export function objectiveLoverStealBonus(state: MatchState, side: Side, kind: ObjectiveKind): number {
  if (!LOVER_KINDS.includes(kind)) return 0;
  return activeHolder(teamOf(state, side), "dragon_lover") !== null ? TRAIT_TUNING.objectiveLoverStealBonus : 0;
}

/**
 * dragon_lover (3.3): no tick em que o time escolheu preparar um objetivo dele, o portador fica
 * exposto nos picks inimigos (FightContext.exposure). undefined quando nao se aplica.
 */
export function objectiveLoverExposure(team: TeamState, teamIntent: MacroIntent): Record<string, number> | undefined {
  if (!teamIntent.startsWith("setup_")) return undefined;
  const kind = teamIntent.slice("setup_".length) as ObjectiveKind;
  if (!LOVER_KINDS.includes(kind)) return undefined;
  const out: Record<string, number> = {};
  for (const role of ROLES) {
    const p = team.players[role];
    if (traitActive(p, "dragon_lover")) out[p.card.id] = TRAIT_TUNING.objectiveLoverExposure;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** side (3.5): rota do split no meio de jogo, a do portador de rota em jogo; senao null. */
export function sideSplitLane(state: MatchState, side: Side): Lane | null {
  if (state.phase !== "mid") return null;
  const holder = laneHolder(teamOf(state, side), "side");
  return holder === null ? null : LANE_OF_ROLE[holder.role];
}

/** side (3.5): forca extra para a pressao virar dano de torre na rota do split (0 fora dela). */
export function sideForceBonus(state: MatchState, side: Side, lane: Lane): number {
  return sideSplitLane(state, side) === lane ? TRAIT_TUNING.sideForceBonus : 0;
}

/**
 * side (3.5): pressao extra do lado na rota do portador no meio de jogo (0 fora dela). So o split
 * extra nao bastava: ele tirava ticks de press_* e a rota dele nao andava (relatorio da Task 5).
 */
export function sidePressureBonus(state: MatchState, side: Side, lane: Lane): number {
  return sideSplitLane(state, side) === lane ? TRAIT_TUNING.sidePressureBonus : 0;
}

/** Termo do side em state.pressure[lane], que e assinado (mais favorece user): user soma, rival subtrai. */
export function sidePressureShift(state: MatchState, lane: Lane): number {
  return sidePressureBonus(state, "user", lane) - sidePressureBonus(state, "rival", lane);
}

/** Chave do solo desligada (spec 5): os cards sem as 6 traits novas; as antigas ficam. */
export function withoutNewTraits(roster: readonly PlayerVersion[]): PlayerVersion[] {
  return roster.map((c) =>
    c.traits.some((t) => NEW_TRAITS.includes(t)) ? { ...c, traits: c.traits.filter((t) => !NEW_TRAITS.includes(t)) } : c
  );
}
