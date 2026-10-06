/**
 * src/sim/comeback.test.ts
 *
 * Statistical comeback-rate test (SC-4 / D-09).
 *
 * Behavior under test: when the user team wins the first 3 events of a match,
 * the pro-comeback mean-reversion mechanic (chaosLevel) must still let the user
 * LOSE 20-30% of the time. Under the old pro-winner bias this was impossible —
 * an early lead snowballed to a near-certain win.
 *
 * Discipline: distinct seeds 0..99 (never one shared seed — Pitfall 3). All
 * randomness is isolated to the seed via runMatch's mulberry32 RNG.
 */

import { describe, it, expect } from "vitest";
import { runMatch } from "./runMatch";
import type { MatchInput } from "./types";
import type { PlayerVersion } from "../data/schema";

// ---------------------------------------------------------------------------
// Fixture helpers (mirror src/sim/runMatch.test.ts style)
// ---------------------------------------------------------------------------

type Role = "top" | "jungle" | "mid" | "adc" | "support";
const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

function makePlayer(id: string, role: Role, stat: number): PlayerVersion {
  return {
    id,
    personId: id,
    displayName: `Player ${id}`,
    year: 2023,
    roles: [role],
    primaryRole: role,
    lanePhase: stat,
    midGame: stat,
    lateGame: stat,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: stat },
    traits: [],
    championPool: Array.from({ length: 8 }, (_, i) => ({
      championId: `${id}-c${i + 1}`,
      mastery: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
    })),
  };
}

/** Uniform-stat roster — team composite equals `stat`. */
function makeRoster(prefix: string, stat: number): PlayerVersion[] {
  return ROLES.map((role) => makePlayer(`${prefix}-${role}`, role, stat));
}

function makeChampionMap(roster: PlayerVersion[]): Record<string, string> {
  return Object.fromEntries(roster.map((p) => [p.id, `${p.id}-c1`]));
}

function makeInput(userStat: number, rivalStat: number): MatchInput {
  const userRoster = makeRoster("u", userStat);
  const rivalRoster = makeRoster("r", rivalStat);
  return {
    userRoster,
    rivalRoster,
    userChampions: makeChampionMap(userRoster),
    rivalChampions: makeChampionMap(rivalRoster),
    speedPreset: "fast",
  };
}

// ---------------------------------------------------------------------------
// SC-4 / D-09: comeback rate after a 3-0 event lead
// ---------------------------------------------------------------------------

describe("runMatch — comeback rate (SC-4 / D-09)", () => {
  it("a team that wins the first 3 events still loses 20-30% of runs", () => {
    // Evenly matched rosters maximise the number of runs that both produce a
    // 3-0 user event lead AND can flip — the regime the comeback mechanic targets.
    const input = makeInput(75, 75);

    let leadRuns = 0;
    let comebacks = 0; // user led 3-0 in events but lost the match

    for (let seed = 0; seed < 500; seed++) {
      const result = runMatch(input, seed);

      // "Wins the first 3 events" = the first 3 events all favor the user team.
      const firstThree = result.events.slice(0, 3);
      if (firstThree.length < 3) continue;
      const userLed3to0 = firstThree.every((e) => e.team === "user");
      if (!userLed3to0) continue;

      leadRuns++;
      if (result.winner === "rival") comebacks++;
    }

    expect(leadRuns).toBeGreaterThan(0);
    const comebackFraction = comebacks / leadRuns;

    // D-09 target band: 20-30% comebacks (inclusive).
    expect(comebackFraction).toBeGreaterThanOrEqual(0.2);
    expect(comebackFraction).toBeLessThanOrEqual(0.3);
  });
});
