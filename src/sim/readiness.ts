/**
 * src/sim/readiness.ts
 *
 * Prontidao de cada canal (spec 2026-10-02-calendario-e-volume): funcoes puras que respondem
 * "este canal esta pronto agora?". Nada aqui sorteia; quem sorteia e o motor (engine.ts).
 */

import type { PlayerVersion } from "../data/schema";
import type { Lane, MatchState, Side } from "./matchState";
import { LANES, TIMERS, teamOf, opponent, aliveCount, hasBaronBuff, hasElderBuff } from "./matchState";
import { isObjectiveAvailable, type ObjectiveKind } from "./objectives";
import { laneLaningPower } from "./power";
import { effectiveChaos, CHAOS_REFERENCE } from "./tuning";
import { currentTierField, TOWER_LOW_THRESHOLD } from "./structures";
import { objectiveLoverPrepMult } from "./traitEffects";

/** 1o clear do jungler (campos aos 0:55, patch 26): 190 s num jungler de early 75. */
export const FIRST_CLEAR_BASE_SEC = 190;
export const FIRST_CLEAR_SEC_PER_POINT = 0.6;
export const FIRST_CLEAR_MIN_SEC = 170;
export const FIRST_CLEAR_MAX_SEC = 225;
/** All-in de rota so a partir do nivel 2 das rotas (tropas aos 0:30, patch 26). */
export const LANE_ALL_IN_FROM_SEC = 90;
/** Vantagem de laning (pontos) abaixo da qual nao ha all-in. */
export const LANE_ALL_IN_EDGE_FLOOR = 4;

/** Instante em que o jungler termina o 1o clear: mais cedo para quem e forte de early. */
export function junglerFirstClearSec(card: PlayerVersion): number {
  const raw = FIRST_CLEAR_BASE_SEC - (card.lanePhase - 75) * FIRST_CLEAR_SEC_PER_POINT;
  return Math.max(FIRST_CLEAR_MIN_SEC, Math.min(FIRST_CLEAR_MAX_SEC, raw));
}

/** O jungler do lado (o que comecou a partida) ja terminou o 1o clear. */
export function junglerReady(state: MatchState, side: Side): boolean {
  return state.gameTimeSec >= junglerFirstClearSec(teamOf(state, side).players.jungle.card);
}

/** Vantagem de laning do lado na rota (positiva = o lado e mais forte). */
export function laneEdge(state: MatchState, side: Side, lane: Lane): number {
  return laneLaningPower(teamOf(state, side), lane) - laneLaningPower(teamOf(state, opponent(side)), lane);
}

/** Rota de maior vantagem de laning do lado; desempate na ordem de LANES. */
export function bestEdgeLane(state: MatchState, side: Side): Lane {
  let best: Lane = LANES[0];
  let bestEdge = -Infinity;
  for (const lane of LANES) {
    const e = laneEdge(state, side, lane);
    if (e > bestEdge) {
      bestEdge = e;
      best = lane;
    }
  }
  return best;
}

/**
 * Chance do all-in de rota antes do 1o clear (spec calendario secao 2): zero antes de 1:30 e com
 * vantagem ate o piso; acima dele, laneAllInBase por 10 pontos de vantagem, teto 0,5.
 */
export function laneAllInChance(state: MatchState, side: Side, lane: Lane): number {
  if (state.gameTimeSec < LANE_ALL_IN_FROM_SEC) return 0;
  const edge = laneEdge(state, side, lane);
  if (edge <= LANE_ALL_IN_EDGE_FLOOR) return 0;
  return Math.min(0.5, state.tuning.laneAllInBase * ((edge - LANE_ALL_IN_EDGE_FLOOR) / 10) * bloodScale(state));
}

/** Fator de fase da chance de pick e gank: mais caro ate 14:00. */
export function phasePickScale(state: MatchState): number {
  return state.gameTimeSec < TIMERS.MID_PHASE_AT ? state.tuning.earlyPickScale : 1;
}

// ---------------------------------------------------------------------------
// Preparo de objetivo (spec calendario secao 4)
// ---------------------------------------------------------------------------

export const OBJECTIVE_KINDS: readonly ObjectiveKind[] = ["dragon", "voidgrubs", "herald", "baron", "elder"];
export const PREP_FULL = 100;
export const PREP_ANNOUNCE_AT = 50;

/** Ordem da tentativa de tomada quando os dois lados estao prontos em objetivos diferentes. */
const TAKE_PRIORITY: readonly ObjectiveKind[] = ["baron", "elder", "dragon", "herald", "voidgrubs"];

/** Rotas cuja prioridade ajuda a preparar cada poco. */
const PREP_LANES: Record<ObjectiveKind, Lane[]> = {
  dragon: ["bot", "mid"],
  elder: ["bot", "mid"],
  voidgrubs: ["top", "mid"],
  herald: ["top", "mid"],
  baron: ["top", "mid"],
};

/** Vantagem de laning do lado nas rotas do poco (soma das rotas). */
export function prepPrioEdge(state: MatchState, side: Side, kind: ObjectiveKind): number {
  return PREP_LANES[kind].reduce((sum, lane) => sum + laneEdge(state, side, lane), 0);
}

/**
 * Preparo ganho num tick em que o lado escolhe preparar o objetivo: zero sem jungler vivo ou com
 * gente a menos; senao a taxa do objetivo vezes a prioridade de rota (piso 0,25) vezes o
 * controle de mapa do lado (0,5 a 1,5).
 */
export function prepGain(state: MatchState, side: Side, kind: ObjectiveKind): number {
  const team = teamOf(state, side);
  if (!team.players.jungle.alive) return 0;
  if (aliveCount(team) < aliveCount(teamOf(state, opponent(side)))) return 0;
  const rate = kind === "baron" || kind === "elder" ? state.tuning.prepRateEpic : state.tuning.prepRateMinor;
  const prio = Math.max(0.25, 1 + prepPrioEdge(state, side, kind) / state.tuning.prepPrioScale);
  const mapEdge = side === "user" ? state.mapControl : -state.mapControl;
  // Spec traits no motor (3.3): o Ama objetivos acelera o preparo com o time a frente (1 sem portador).
  return rate * prio * (1 + mapEdge / 200) * objectiveLoverPrepMult(state, side, kind);
}

/** Antecedencia maxima do preparo de dragao antes do respawn (emenda 2 de 2026-10-02). */
export const DRAGON_PRESPAWN_PREP_SEC = 60;

/**
 * O objetivo aceita preparo agora: vivo, ou (emenda 2 de 2026-10-02) um dragao elemental a ate 60 s
 * de renascer, a partir do 2o (no meio de jogo o time ja agrupado monta visao antes do respawn).
 * O 1o dragao so com ele vivo. A tomada continua exigindo o objetivo vivo (takeAttempt).
 */
export function isObjectivePreparable(state: MatchState, kind: ObjectiveKind): boolean {
  if (isObjectiveAvailable(state, kind)) return true;
  if (kind !== "dragon") return false;
  const o = state.objectives;
  return (
    o.dragonsTaken >= 1 &&
    !o.dragonAlive &&
    o.dragonRespawnAtSec !== null &&
    o.dragonRespawnAtSec - state.gameTimeSec <= DRAGON_PRESPAWN_PREP_SEC
  );
}

/**
 * Atualiza o preparo dos dois lados num tick. Objetivo que nao aceita preparo (nem vivo nem dragao
 * perto do respawn): preparo e aviso zeram. Lado que escolheu preparar: sobe (teto 100). Lado que
 * nao escolheu: cai prepDecay (piso 0). Devolve os (lado, objetivo) cujo preparo passou de 50 pela
 * primeira vez neste nascimento.
 */
export function updateObjectivePrep(
  state: MatchState,
  setup: Record<Side, ObjectiveKind | null>
): { side: Side; kind: ObjectiveKind }[] {
  const crossed: { side: Side; kind: ObjectiveKind }[] = [];
  for (const side of ["user", "rival"] as Side[]) {
    const prep = state.objectivePrep[side];
    const flags = state.prepAnnounced[side];
    for (const kind of OBJECTIVE_KINDS) {
      if (!isObjectivePreparable(state, kind)) {
        prep[kind] = 0;
        flags[kind] = false;
        continue;
      }
      if (setup[side] === kind) {
        const before = prep[kind];
        prep[kind] = Math.min(PREP_FULL, before + prepGain(state, side, kind));
        if (!flags[kind] && before < PREP_ANNOUNCE_AT && prep[kind] >= PREP_ANNOUNCE_AT) {
          flags[kind] = true;
          crossed.push({ side, kind });
        }
      } else {
        prep[kind] = Math.max(0, prep[kind] - state.tuning.prepDecay);
      }
    }
  }
  return crossed;
}

/**
 * Quem tenta tomar neste tick: o lado que escolheu preparar um objetivo e tem o preparo dele
 * cheio. Com os dois prontos, vai o objetivo de maior prioridade (no mesmo objetivo, o user, e a
 * tomada vira disputa no poco de qualquer forma). (A tomada exige o objetivo vivo, mesmo com o
 * preparo cheio antes do respawn.)
 */
export function takeAttempt(
  state: MatchState,
  setup: Record<Side, ObjectiveKind | null>
): { side: Side; kind: ObjectiveKind } | null {
  const ready = (["user", "rival"] as Side[]).filter((s) => {
    const k = setup[s];
    return k !== null && isObjectiveAvailable(state, k) && state.objectivePrep[s][k] >= PREP_FULL;
  });
  if (ready.length === 0) return null;
  ready.sort((a, b) => TAKE_PRIORITY.indexOf(setup[a]!) - TAKE_PRIORITY.indexOf(setup[b]!));
  return { side: ready[0], kind: setup[ready[0]]! };
}

// ---------------------------------------------------------------------------
// Motivo de luta, reset e escala de sangue (spec calendario secao 3)
// ---------------------------------------------------------------------------

/** Janela de "nascendo" e de cerco recente dos motivos de luta. */
export const FIGHT_REASON_WINDOW_SEC = 60;

/** Escala de sangue do Caos: 1 no Caos de referencia, piso 0,6. */
export function bloodScale(state: MatchState): number {
  return Math.max(0.6, 1 + state.tuning.bloodChaosCoef * (effectiveChaos(state) - CHAOS_REFERENCE));
}

/** Intervalo minimo entre lutas 5v5 (reset: voltar, comprar, reagrupar), encurtado pelo Caos. */
export function fightResetSec(state: MatchState): number {
  const t = state.tuning;
  const base = state.phase === "early" ? t.fightResetEarly : state.phase === "mid" ? t.fightResetMid : t.fightResetLate;
  return base / bloodScale(state);
}

function spawnsSoon(state: MatchState, at: number | null): boolean {
  return at !== null && at - state.gameTimeSec <= FIGHT_REASON_WINDOW_SEC;
}

/** Alguma torre (de qualquer lado) em estado critico e apanhando nos ultimos 60 s. */
export function towerUnderSiege(state: MatchState): boolean {
  for (const team of [state.user, state.rival]) {
    for (const lane of LANES) {
      const field = currentTierField(team.structures[lane], team);
      if (field === null) continue;
      const pool = team.structureDamage[lane];
      const last = pool.lastStructureDamageAtSec;
      if (pool[field] >= TOWER_LOW_THRESHOLD && last !== null && state.gameTimeSec - last <= FIGHT_REASON_WINDOW_SEC) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Ha motivo para um 5v5? Objetivo vivo ou nascendo em ate 60 s (dragao, Arauto, Barao, Elder),
 * time com buff de Barao ou Elder, ou torre sob cerco.
 */
export function fightReason(state: MatchState): boolean {
  const o = state.objectives;
  const t = state.gameTimeSec;
  if (o.dragonAlive || spawnsSoon(state, o.dragonRespawnAtSec)) return true;
  if (o.elderAlive || (o.elderUnlocked && spawnsSoon(state, o.elderRespawnAtSec))) return true;
  if (o.baronAlive || spawnsSoon(state, o.baronRespawnAtSec)) return true;
  if (!o.heraldDone && t >= TIMERS.HERALD_SPAWN - FIGHT_REASON_WINDOW_SEC && t < TIMERS.HERALD_DESPAWN) return true;
  if (hasBaronBuff(state, "user") || hasBaronBuff(state, "rival")) return true;
  if (hasElderBuff(state, "user") || hasElderBuff(state, "rival")) return true;
  return towerUnderSiege(state);
}
