/**
 * src/sim/traits.test.ts
 *
 * Unit tests for player-trait firing conditions and effects (SIM-05, D-05/D-06/D-07).
 *
 * Tests assert:
 * - phase-gated traits fire ONLY in their phase (lane_bully/strong_laner in "lane",
 *   objective_focused in "mid"); 0 otherwise.
 * - behind/ahead traits return 0 when the live-state condition is NOT met and
 *   non-zero when it IS met (the situational state-gate proof — D-05).
 * - plays_worse_when_behind returns 0 above 0.5 winProb and < 0 below it.
 * - trash_talker's effect only appears with isOpponent=true (cross-team, D-07).
 *
 * Pure module — no Math.random(), no I/O. Tested directly (not via runMatch).
 */

import { describe, it, expect } from "vitest";
import {
  playerTraitScoreDelta,
  playerTraitSwingBias,
  championTraitEventWeight,
  TRAIT_MAGNITUDE,
} from "./traits";

// ---------------------------------------------------------------------------
// playerTraitScoreDelta — phase-gated score bonuses (D-05: NOT flat pre-match)
// ---------------------------------------------------------------------------

describe("playerTraitScoreDelta — phase-gated score traits", () => {
  it("lane_bully fires only in the lane phase", () => {
    expect(playerTraitScoreDelta("lane_bully", "lane")).toBeGreaterThan(0);
    expect(playerTraitScoreDelta("lane_bully", "mid")).toBe(0);
    expect(playerTraitScoreDelta("lane_bully", "late")).toBe(0);
  });

  it("lane_bully returns the full TRAIT_MAGNITUDE in lane", () => {
    expect(playerTraitScoreDelta("lane_bully", "lane")).toBe(TRAIT_MAGNITUDE);
  });

  it("strong_laner fires only in the lane phase with a smaller bonus than lane_bully", () => {
    const sl = playerTraitScoreDelta("strong_laner", "lane");
    expect(sl).toBeGreaterThan(0);
    expect(sl).toBeLessThan(playerTraitScoreDelta("lane_bully", "lane"));
    expect(playerTraitScoreDelta("strong_laner", "mid")).toBe(0);
    expect(playerTraitScoreDelta("strong_laner", "late")).toBe(0);
  });

  it("objective_focused fires only in the mid phase", () => {
    expect(playerTraitScoreDelta("objective_focused", "mid")).toBeGreaterThan(0);
    expect(playerTraitScoreDelta("objective_focused", "lane")).toBe(0);
    expect(playerTraitScoreDelta("objective_focused", "late")).toBe(0);
  });

  it("behind/ahead and non-score traits return 0 from playerTraitScoreDelta in every phase", () => {
    for (const phase of ["lane", "mid", "late"] as const) {
      expect(playerTraitScoreDelta("plays_worse_when_behind", phase)).toBe(0);
      expect(playerTraitScoreDelta("clutch_player", phase)).toBe(0);
      expect(playerTraitScoreDelta("mental_fort", phase)).toBe(0);
      expect(playerTraitScoreDelta("tilts_on_death", phase)).toBe(0);
      expect(playerTraitScoreDelta("trash_talker", phase)).toBe(0);
      expect(playerTraitScoreDelta("baron_stealer", phase)).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// playerTraitSwingBias — situational firing (D-05 state-gate)
// ---------------------------------------------------------------------------

describe("playerTraitSwingBias — situational swing biases (D-05)", () => {
  it("plays_worse_when_behind: 0 above 0.5 winProb, < 0 below it (situational gate)", () => {
    expect(playerTraitSwingBias("plays_worse_when_behind", 0.7, 0.5)).toBe(0);
    expect(playerTraitSwingBias("plays_worse_when_behind", 0.5, 0.5)).toBe(0);
    expect(playerTraitSwingBias("plays_worse_when_behind", 0.3, 0.5)).toBeLessThan(0);
  });

  it("tilts_on_death: negative only when behind (winProb < 0.5), else 0", () => {
    expect(playerTraitSwingBias("tilts_on_death", 0.3, 0.5)).toBeLessThan(0);
    expect(playerTraitSwingBias("tilts_on_death", 0.7, 0.5)).toBe(0);
  });

  it("clutch_player: positive only when winProb < 0.4 AND phaseFraction > 0.6", () => {
    // Both conditions met
    expect(playerTraitSwingBias("clutch_player", 0.35, 0.7)).toBeGreaterThan(0);
    // winProb too high
    expect(playerTraitSwingBias("clutch_player", 0.45, 0.7)).toBe(0);
    // too early in the game
    expect(playerTraitSwingBias("clutch_player", 0.35, 0.4)).toBe(0);
  });

  it("mental_fort: small positive (stabilize) only when winProb < 0.45", () => {
    expect(playerTraitSwingBias("mental_fort", 0.4, 0.5)).toBeGreaterThan(0);
    expect(playerTraitSwingBias("mental_fort", 0.6, 0.5)).toBe(0);
  });

  it("baron_stealer: positive (comeback) only when behind (winProb < 0.5)", () => {
    expect(playerTraitSwingBias("baron_stealer", 0.3, 0.5)).toBeGreaterThan(0);
    expect(playerTraitSwingBias("baron_stealer", 0.7, 0.5)).toBe(0);
  });

  it("phase-gated score traits contribute no swing bias", () => {
    expect(playerTraitSwingBias("lane_bully", 0.3, 0.5)).toBe(0);
    expect(playerTraitSwingBias("strong_laner", 0.3, 0.5)).toBe(0);
    expect(playerTraitSwingBias("objective_focused", 0.3, 0.5)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// trash_talker — cross-team only (D-07)
// ---------------------------------------------------------------------------

describe("playerTraitSwingBias — trash_talker cross-team (D-07)", () => {
  it("trash_talker only has an effect with isOpponent=true", () => {
    // On the holder's own team (isOpponent omitted/false): no effect
    expect(playerTraitSwingBias("trash_talker", 0.5, 0.5)).toBe(0);
    expect(playerTraitSwingBias("trash_talker", 0.5, 0.5, false)).toBe(0);
    // As a cross-team tilt on the opponent: non-zero
    expect(playerTraitSwingBias("trash_talker", 0.5, 0.5, true)).not.toBe(0);
  });

  it("isOpponent=true has NO effect on non-trash_talker traits (no cross-team leak)", () => {
    // A behind trait still keys off winProb, not isOpponent
    expect(playerTraitSwingBias("tilts_on_death", 0.7, 0.5, true)).toBe(
      playerTraitSwingBias("tilts_on_death", 0.7, 0.5, false)
    );
    expect(playerTraitSwingBias("clutch_player", 0.35, 0.7, true)).toBe(
      playerTraitSwingBias("clutch_player", 0.35, 0.7, false)
    );
  });
});

// ---------------------------------------------------------------------------
// championTraitEventWeight — density-scaled event-probability multipliers
// (SIM-06, D-04, Pitfall 4)
// ---------------------------------------------------------------------------

describe("championTraitEventWeight — D-04 event multipliers (SIM-06)", () => {
  it("high_first_blood boosts first_blood at full team density (count=5)", () => {
    const w = championTraitEventWeight("high_first_blood", "first_blood", 5);
    expect(w).toBeGreaterThan(1);
    // Full multiplier from the D-04 table (1.4) applies at count=5.
    expect(w).toBeCloseTo(1.4, 5);
  });

  it("objective_control boosts dragon and baron (D-04)", () => {
    expect(championTraitEventWeight("objective_control", "dragon", 5)).toBeGreaterThan(1);
    expect(championTraitEventWeight("objective_control", "baron", 5)).toBeGreaterThan(1);
    // No effect on an unrelated event type.
    expect(championTraitEventWeight("objective_control", "first_blood", 5)).toBe(1);
  });

  it("teamfight boosts dragon_steal and baron (D-04)", () => {
    expect(championTraitEventWeight("teamfight", "dragon_steal", 5)).toBeGreaterThan(1);
    expect(championTraitEventWeight("teamfight", "baron", 5)).toBeGreaterThan(1);
    expect(championTraitEventWeight("teamfight", "dragon", 5)).toBe(1);
  });

  it("late_scaling and early_dominant carry no event-type multiplier here (timing/win-prob, not event selection)", () => {
    for (const ev of [
      "first_blood",
      "dragon",
      "dragon_steal",
      "inhibitor",
      "baron",
      "elder_dragon",
      "gg",
    ] as const) {
      expect(championTraitEventWeight("late_scaling", ev, 5)).toBe(1);
      expect(championTraitEventWeight("early_dominant", ev, 5)).toBe(1);
    }
  });

  it("density scaling: count=5 > count=1 > count=0 (Pitfall 4)", () => {
    const full = championTraitEventWeight("high_first_blood", "first_blood", 5);
    const partial = championTraitEventWeight("high_first_blood", "first_blood", 1);
    const none = championTraitEventWeight("high_first_blood", "first_blood", 0);
    expect(full).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(none);
  });

  it("count=1 applies ~20% of the boost (1 + (1/5)*(full-1))", () => {
    // full=1.4 → 1 + 0.2*(0.4) = 1.08
    expect(championTraitEventWeight("high_first_blood", "first_blood", 1)).toBeCloseTo(1.08, 5);
  });

  it("count=0 returns exactly 1.0 (no champions carry the trait — Pitfall 4)", () => {
    expect(championTraitEventWeight("high_first_blood", "first_blood", 0)).toBe(1);
    expect(championTraitEventWeight("objective_control", "dragon", 0)).toBe(1);
    expect(championTraitEventWeight("teamfight", "baron", 0)).toBe(1);
  });

  it("returns exactly 1.0 for a non-matching trait/event pair regardless of density", () => {
    expect(championTraitEventWeight("high_first_blood", "baron", 5)).toBe(1);
    expect(championTraitEventWeight("high_first_blood", "dragon", 3)).toBe(1);
    expect(championTraitEventWeight("teamfight", "first_blood", 5)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Purity guard — the module must not depend on Math.random()
// ---------------------------------------------------------------------------

describe("playerTrait functions — deterministic / pure", () => {
  it("return identical values on repeated calls (no hidden randomness)", () => {
    expect(playerTraitSwingBias("plays_worse_when_behind", 0.3, 0.5)).toBe(
      playerTraitSwingBias("plays_worse_when_behind", 0.3, 0.5)
    );
    expect(playerTraitScoreDelta("lane_bully", "lane")).toBe(
      playerTraitScoreDelta("lane_bully", "lane")
    );
  });
});
