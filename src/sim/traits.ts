/**
 * src/sim/traits.ts
 *
 * Player-trait behavior map for the Phase 3 sim engine.
 * Pure functions — no side effects, no Math.random(), no I/O.
 *
 * SIM-05: Player traits act SITUATIONALLY — they read live win probability as
 *   an ahead/behind thermometer (D-05), never as flat pre-match modifiers.
 * D-06: 9 player traits (8 Phase-1 traits + trash_talker).
 * D-07: trash_talker is the first cross-team trait — it tilts the OPPONENT, not
 *   the holder's own team (modeled here via the isOpponent flag).
 *
 * Two responsibilities, mirroring the role split in runMatch:
 *   - playerTraitScoreDelta: phase-gated additive score bonuses, summed into the
 *     matching phase score inside scoreTeam (lane_bully / strong_laner / objective_focused).
 *   - playerTraitSwingBias: situational win-prob swing biases, folded into
 *     updateWinProbability per event. Each returns 0 unless its live-state
 *     firing condition is met (the situational gate that proves traits are not flat).
 */

import type { PlayerTrait, ChampionTrait } from "../data/schema";
// EventType drives the champion-trait event-weight map (championTraitEventWeight);
// player swing biases key off win probability + phase fraction, not event type.
import type { EventType } from "./types";

// ---------------------------------------------------------------------------
// Phase-3-tunable trait magnitudes
// ---------------------------------------------------------------------------

/** Full phase-score bonus (composite points) for lane_bully / objective_focused. */
export const TRAIT_MAGNITUDE = 3.0; // Phase-3-tunable

/** Additive positive swing-bias delta for comeback traits (clutch_player, baron_stealer). */
export const COMEBACK_MAGNITUDE = 0.012; // Phase-3-tunable

/** Additive negative swing-bias delta for tilt traits (tilts_on_death). */
export const TILT_MAGNITUDE = 0.04; // Phase-3-tunable

/** Small positive stabilize bias for mental_fort. */
export const STABILIZE_MAGNITUDE = 0.012; // Phase-3-tunable

/** Effective swing-bias penalty for plays_worse_when_behind when firing. */
export const BEHIND_PENALTY = 2.0; // Phase-3-tunable

/**
 * The behind-penalty expressed as a per-player swing-bias delta so it composes
 * with the other swing biases in updateWinProbability. BEHIND_PENALTY is the
 * felt "composite deduction"; the 0.006 scale keeps a 5-player stack (~0.03
 * total per event) in the comeback's LINEAR regime. A larger nudge floors the
 * prob and triggers the 50× comeback magnitude catapult (Pitfall 6 over-
 * correction), inverting the trait's sign. Tuned via traitCalibration.test.ts.
 */
const BEHIND_PENALTY_BIAS = BEHIND_PENALTY * 0.018; // Phase-3-tunable scale

/** Cross-team tilt applied to the OPPONENT by trash_talker (D-07). */
const TRASH_TALK_TILT = TILT_MAGNITUDE * 0.12; // Phase-3-tunable

// ---------------------------------------------------------------------------
// Champion-trait event-probability multipliers (SIM-06 / D-04)
// ---------------------------------------------------------------------------

/**
 * Full event-weight multiplier per (champion trait → event type) at FULL team
 * density (all 5 picked champions carry the trait). A pair with no entry has no
 * effect (multiplier 1.0). Density scaling is applied in championTraitEventWeight.
 *
 * Mapping is D-04:
 *   - high_first_blood  → first_blood (assassin/aggressive openers)
 *   - objective_control → dragon / baron (tanks/bruisers contest objectives)
 *   - teamfight         → dragon_steal / baron (area control contests epics)
 *   - late_scaling, early_dominant → no event-type multiplier here. They shape
 *     timing / win-prob rather than which event fires, so they are deliberately
 *     a no-op for event SELECTION (documented, not forgotten).
 */
const CHAMPION_TRAIT_WEIGHTS: Partial<
  Record<ChampionTrait, Partial<Record<EventType, number>>>
> = {
  // Phase-3-tunable multipliers (RESEARCH Pattern 3 CHAMPION_TRAIT_WEIGHTS table)
  high_first_blood: { first_blood: 1.4 },
  objective_control: { dragon: 1.3, baron: 1.25 },
  teamfight: { dragon_steal: 1.35, baron: 1.2 },
};

/** Team composition denominator — 5 picked champions per team (Pitfall 4). */
const TEAM_SIZE = 5;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Phase-gated score delta for a player trait.
 *
 * Returns a positive composite-score bonus only for the phase-specific traits
 * in their own phase, and 0 for every other trait/phase combination:
 *   - lane_bully       → +TRAIT_MAGNITUDE in "lane"
 *   - strong_laner     → smaller bonus in "lane"
 *   - objective_focused→ +TRAIT_MAGNITUDE in "mid"
 *
 * Behind/ahead and cross-team traits never contribute here — they fire
 * situationally in playerTraitSwingBias instead (D-05).
 */
export function playerTraitScoreDelta(
  trait: PlayerTrait,
  phase: "lane" | "mid" | "late"
): number {
  switch (trait) {
    case "lane_bully":
      return phase === "lane" ? TRAIT_MAGNITUDE : 0;
    case "strong_laner":
      // A "solid" laner — a smaller, steadier edge than the lane bully.
      return phase === "lane" ? TRAIT_MAGNITUDE * 0.7 : 0;
    case "objective_focused":
      return phase === "mid" ? TRAIT_MAGNITUDE : 0;
    default:
      return 0;
  }
}

/**
 * Situational swing-bias delta for a player trait given live game state.
 *
 * Folded into updateWinProbability per event. Each trait returns 0 unless its
 * live-state firing condition is met — this is the proof that traits are
 * situational, not flat pre-match modifiers (D-05).
 *
 * Firing conditions (D-06 behavior map):
 *   - plays_worse_when_behind: NEGATIVE only when winProb < 0.5, else 0.
 *   - tilts_on_death:          NEGATIVE only when winProb < 0.5, else 0.
 *   - clutch_player:           POSITIVE only when winProb < 0.4 AND phaseFraction > 0.6.
 *   - mental_fort:             small POSITIVE only when winProb < 0.45 (stabilize).
 *   - baron_stealer:           POSITIVE (comeback) only when winProb < 0.5.
 *   - trash_talker:            cross-team tilt — non-zero ONLY when isOpponent=true (D-07).
 *
 * @param trait         The player trait to evaluate.
 * @param winProb       Current team win probability [0, 1] (the ahead/behind thermometer).
 * @param phaseFraction Game progress [0, 1].
 * @param isOpponent    true when computing the cross-team effect (trash_talker only, D-07).
 */
export function playerTraitSwingBias(
  trait: PlayerTrait,
  winProb: number,
  phaseFraction: number,
  isOpponent: boolean = false
): number {
  switch (trait) {
    case "plays_worse_when_behind":
      // Sinks harder once actually behind; no effect while even or ahead.
      // Gate stays at 0.5 (contract: 0 at/above 0.5, < 0 below it). Persistence
      // comes from the magnitude + the baseline-shift wiring in updateWinProbability.
      return winProb < 0.5 ? -BEHIND_PENALTY_BIAS : 0;

    case "tilts_on_death":
      // Negative momentum compounds once losing.
      return winProb < 0.5 ? -TILT_MAGNITUDE : 0;

    case "clutch_player":
      // Steps up only when deep behind AND late in the game.
      return winProb < 0.4 && phaseFraction > 0.6 ? COMEBACK_MAGNITUDE : 0;

    case "mental_fort":
      // Resists losing momentum — a small stabilizing nudge when slipping.
      return winProb < 0.45 ? STABILIZE_MAGNITUDE : 0;

    case "baron_stealer":
      // Pulls off a clutch objective to claw back when behind.
      return winProb < 0.5 ? COMEBACK_MAGNITUDE : 0;

    case "trash_talker":
      // Cross-team (D-07): only bites the OPPONENT. On the holder's own side
      // (isOpponent=false) it is a no-op so the effect is never doubled.
      return isOpponent ? -TRASH_TALK_TILT : 0;

    default:
      // Phase-gated score traits and any unknown trait contribute no swing bias.
      return 0;
  }
}

/**
 * Density-scaled event-probability multiplier for a champion trait (SIM-06, D-04).
 *
 * Returns 1.0 (no effect) when the trait does not modify that event type, or
 * when teamTraitCount is 0 (no picked champion carries the trait — Pitfall 7
 * trait-neutral). For a matching (trait, eventType) pair, the FULL multiplier
 * from CHAMPION_TRAIT_WEIGHTS applies at full team density (count=5) and scales
 * DOWN linearly with density (Pitfall 4 — count/5, not all-or-nothing):
 *
 *   weight = 1 + (teamTraitCount / 5) * (fullMultiplier - 1)
 *
 * So count=5 → fullMultiplier, count=1 → ~20% of the boost, count=0 → exactly 1.0.
 *
 * @param trait          The champion trait to evaluate.
 * @param eventType      The candidate event type whose base weight is scaled.
 * @param teamTraitCount How many of the team's 5 picked champions carry this trait.
 */
export function championTraitEventWeight(
  trait: ChampionTrait,
  eventType: EventType,
  teamTraitCount: number
): number {
  const fullMultiplier = CHAMPION_TRAIT_WEIGHTS[trait]?.[eventType];
  // No entry for this (trait, event) pair → trait-neutral for this event.
  if (fullMultiplier === undefined) return 1;
  // Density scaling (Pitfall 4): clamp the count to [0, TEAM_SIZE] so a stray
  // out-of-range count cannot over/under-shoot the multiplier.
  const density = Math.max(0, Math.min(teamTraitCount, TEAM_SIZE)) / TEAM_SIZE;
  return 1 + density * (fullMultiplier - 1);
}

// Keep the EventType import meaningful for downstream type-aware wiring without
// widening this module's API surface in the current plan.
export type { EventType };
