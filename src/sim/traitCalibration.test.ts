/**
 * src/sim/traitCalibration.test.ts
 *
 * Statistical trait-swap calibration test (SIM-05 criterion 2 / SC-2).
 *
 * Proves that stacking a single player trait onto all 5 user players measurably
 * moves the win rate: |winRate(control) - winRate(traitStack)| > 0.05 (>5pp)
 * across 100 seeded matches. Run for both polarities:
 *   - a NEGATIVE trait (plays_worse_when_behind) — expected to LOWER win rate
 *   - a POSITIVE trait (lane_bully) — expected to RAISE win rate
 *
 * Pitfall 3: every match uses a DISTINCT seed (0..99) — never a shared seed.
 */

import { describe, it, expect } from "vitest";
import { runMatch } from "./runMatch";
import type { MatchInput } from "./types";
import type { PlayerVersion, PlayerTrait } from "../data/schema";

// ---------------------------------------------------------------------------
// Fixture helpers (mirror src/sim/runMatch.test.ts style)
// ---------------------------------------------------------------------------

function makeChampionPool(
  ids: string[]
): { championId: string; mastery: 1 | 2 | 3 | 4 | 5 }[] {
  return ids.map((id, i) => ({
    championId: id,
    mastery: (Math.min(5, (i % 5) + 1) as 1 | 2 | 3 | 4 | 5),
  }));
}

function makePlayer(
  id: string,
  role: "top" | "jungle" | "mid" | "adc" | "support",
  traits: PlayerTrait[] = []
): PlayerVersion {
  return {
    id,
    personId: id,
    displayName: `Player ${id}`,
    year: 2023,
    roles: [role],
    primaryRole: role,
    lanePhase: 75,
    midGame: 75,
    lateGame: 75,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: 75 },
    traits,
    championPool: makeChampionPool([
      `${id}-c1`, `${id}-c2`, `${id}-c3`, `${id}-c4`,
      `${id}-c5`, `${id}-c6`, `${id}-c7`, `${id}-c8`,
    ]),
  };
}

/** Balanced 5-player roster, no traits (control group). */
function makeEvenRoster(prefix: string): PlayerVersion[] {
  return [
    makePlayer(`${prefix}-top`, "top"),
    makePlayer(`${prefix}-jgl`, "jungle"),
    makePlayer(`${prefix}-mid`, "mid"),
    makePlayer(`${prefix}-adc`, "adc"),
    makePlayer(`${prefix}-sup`, "support"),
  ];
}

/** Same balanced roster but every player carries the same single trait. */
function makeTraitRoster(prefix: string, trait: PlayerTrait): PlayerVersion[] {
  return [
    makePlayer(`${prefix}-top`, "top", [trait]),
    makePlayer(`${prefix}-jgl`, "jungle", [trait]),
    makePlayer(`${prefix}-mid`, "mid", [trait]),
    makePlayer(`${prefix}-adc`, "adc", [trait]),
    makePlayer(`${prefix}-sup`, "support", [trait]),
  ];
}

function makeChampionMap(roster: PlayerVersion[]): Record<string, string> {
  return Object.fromEntries(roster.map((p) => [p.id, `${p.id}-c1`]));
}

function makeInput(
  userRoster: PlayerVersion[],
  rivalRoster: PlayerVersion[]
): MatchInput {
  return {
    userRoster,
    rivalRoster,
    userChampions: makeChampionMap(userRoster),
    rivalChampions: makeChampionMap(rivalRoster),
    speedPreset: "fast",
  };
}

// ---------------------------------------------------------------------------
// Statistical harness: control vs trait-stack win-rate delta over 100 seeds
// ---------------------------------------------------------------------------

const N = 100;

/** Returns { control, trait } user-win counts over N distinct seeds. */
function winRateDelta(trait: PlayerTrait): {
  controlRate: number;
  traitRate: number;
  delta: number;
} {
  // Same prefix → identical player ids → identical control/seed behavior;
  // the ONLY difference between the two runs is the stacked trait.
  let winsControl = 0;
  let winsTrait = 0;

  for (let seed = 0; seed < N; seed++) {
    const control = runMatch(
      makeInput(makeEvenRoster("u"), makeEvenRoster("r")),
      seed
    );
    if (control.winner === "user") winsControl++;

    const traitMatch = runMatch(
      makeInput(makeTraitRoster("u", trait), makeEvenRoster("r")),
      seed
    );
    if (traitMatch.winner === "user") winsTrait++;
  }

  const controlRate = winsControl / N;
  const traitRate = winsTrait / N;
  return { controlRate, traitRate, delta: Math.abs(controlRate - traitRate) };
}

describe("trait-swap calibration (SIM-05 criterion 2 — >5pp across 100 sims)", () => {
  it("a NEGATIVE trait stack (plays_worse_when_behind) shifts win rate >5pp and LOWERS it", () => {
    const { controlRate, traitRate, delta } = winRateDelta(
      "plays_worse_when_behind"
    );
    expect(delta).toBeGreaterThan(0.05);
    // Negative trait should not raise the win rate
    expect(traitRate).toBeLessThan(controlRate);
  });

  it("a POSITIVE trait stack (lane_bully) shifts win rate >5pp and RAISES it", () => {
    const { controlRate, traitRate, delta } = winRateDelta("lane_bully");
    expect(delta).toBeGreaterThan(0.05);
    // Positive trait should not lower the win rate
    expect(traitRate).toBeGreaterThan(controlRate);
  });
});
