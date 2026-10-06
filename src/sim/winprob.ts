/**
 * src/sim/winprob.ts
 *
 * Phase 7 — state-driven WIN PROBABILITY.
 *
 * This is an INDICATOR of the live state, never the decider of the match. The
 * engine resolves events from power + state; win probability is recomputed FROM
 * the resulting state so a real comeback path always remains (a trailing team
 * that takes Baron/Elder, lands a steal, or wins a fight genuinely moves the
 * number). Calibrated in Phase 8.
 *
 * Formula follows pesquisa.md: a weighted sum through a sigmoid, framed in the
 * USER's favour (+ raises the user's win probability).
 */

import {
  goldDiff,
  towerDiff,
  dragonDiff,
  aliveCount,
  aliveBaronBuffHolders,
  aliveElderBuffHolders,
  type MatchState,
} from "./matchState";
import { teamSlice } from "./power";

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Tunable weights (Phase 8 calibrates). These also feed match resolution
 * (chooseIntent), so they are kept at their calibrated values;
 * only the output clamp below was widened so a near-certain win reads ~100%.
 */
export const WINPROB_WEIGHTS = {
  gold: 0, // GOLD-02 / D-07: substituido por fold-in em fightPower/securePower; evita double-counting
  tower: 0.16,
  inhibitor: 0.42,
  dragon: 0.1,
  soul: 0.55,
  baronHolder: 0.08,
  elderHolder: 0.18,
  vision: 0.05,
  aliveEdge: 0.2,
  scaling: 0.085,
  momentum: 0.14,
  nexusExposed: 0.5,
} as const;

/**
 * Compute the user-team win probability from the live state.
 *
 * Clamped within [0.005, 0.995] so the game is never "mathematically" decided
 * before the Nexus, yet a near-certain victory (exposed Nexus + big lead) reads
 * close to 100% instead of stalling at 98%.
 */
export function computeWinProbability(state: MatchState): number {
  const w = WINPROB_WEIGHTS;

  const inhibDiff =
    state.user.inhibitorsDestroyed - state.rival.inhibitorsDestroyed;
  const soulDiff = (state.user.soul ? 1 : 0) - (state.rival.soul ? 1 : 0);
  const baronHolderDiff =
    aliveBaronBuffHolders(state.user) - aliveBaronBuffHolders(state.rival);
  const elderHolderDiff =
    aliveElderBuffHolders(state.user) - aliveElderBuffHolders(state.rival);
  const aliveEdge = aliveCount(state.user) - aliveCount(state.rival);
  // Scaling = who will be stronger later (normalised to a small per-point edge).
  const scalingEdge =
    (teamSlice(state.user, "scaling") - teamSlice(state.rival, "scaling")) / 50;
  const nexusEdge =
    (state.rival.nexusExposed ? 1 : 0) - (state.user.nexusExposed ? 1 : 0);

  const x =
    goldDiff(state) * w.gold +
    towerDiff(state) * w.tower +
    inhibDiff * w.inhibitor +
    dragonDiff(state) * w.dragon +
    soulDiff * w.soul +
    baronHolderDiff * w.baronHolder +
    elderHolderDiff * w.elderHolder +
    (state.mapControl / 100) * w.vision +
    aliveEdge * w.aliveEdge +
    scalingEdge * w.scaling +
    (state.momentum / 100) * w.momentum +
    nexusEdge * w.nexusExposed;

  return Math.max(0.005, Math.min(0.995, sigmoid(x)));
}
