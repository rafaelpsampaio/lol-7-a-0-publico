/**
 * src/sim/runMatch.test.ts
 *
 * TDD RED tests for runMatch() — SIM-01, SIM-02, SIM-03, SIM-07, D-09/D-10 pacing.
 * Tests describe behavior before implementation exists.
 *
 * SIM-01: runMatch(input, seed) called twice returns deep-equal results (determinism gate).
 * SIM-02: Role-weighted phase scoring — support→lanePhase, jungle→midGame, ADC+mid→lateGame.
 * SIM-03: Timeline contains first_blood, gg; only locked vocabulary; close games get baron/elder_dragon.
 * SIM-07: Every GameEvent.winProbAfter in [0,1], changes across events, not pinned early.
 * D-09/D-10 pacing: totalPlaybackMs near preset average; closer match yields longer duration.
 */

import { describe, it, expect } from "vitest";
import { runMatch, SPEED_PRESET_MS } from "./runMatch";
import type { MatchInput } from "./types";
import type { PlayerVersion } from "../data/schema";

// ---------------------------------------------------------------------------
// Fixture helpers
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
  overrides: Partial<
    Pick<PlayerVersion, "lanePhase" | "midGame" | "lateGame" | "roleStrength">
  > = {}
): PlayerVersion {
  const defaultStats = {
    lanePhase: 75,
    midGame: 75,
    lateGame: 75,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: 75 },
  };
  return {
    id,
    personId: id,
    displayName: `Player ${id}`,
    year: 2023,
    roles: [role],
    primaryRole: role,
    ...defaultStats,
    ...overrides,
    roleStrength: {
      ...defaultStats.roleStrength,
      ...(overrides.roleStrength ?? {}),
    },
    traits: [],
    championPool: makeChampionPool([
      `${id}-c1`, `${id}-c2`, `${id}-c3`, `${id}-c4`,
      `${id}-c5`, `${id}-c6`, `${id}-c7`, `${id}-c8`,
    ]),
  };
}

/** Build a balanced 5-player roster with equal stats. */
function makeEvenRoster(prefix: string): PlayerVersion[] {
  return [
    makePlayer(`${prefix}-top`, "top"),
    makePlayer(`${prefix}-jgl`, "jungle"),
    makePlayer(`${prefix}-mid`, "mid"),
    makePlayer(`${prefix}-adc`, "adc"),
    makePlayer(`${prefix}-sup`, "support"),
  ];
}

/** Build a roster with very high stats (dominant team). */
function makeStrongRoster(prefix: string): PlayerVersion[] {
  return [
    makePlayer(`${prefix}-top`, "top", { lanePhase: 95, midGame: 95, lateGame: 95 }),
    makePlayer(`${prefix}-jgl`, "jungle", { lanePhase: 95, midGame: 95, lateGame: 95 }),
    makePlayer(`${prefix}-mid`, "mid", { lanePhase: 95, midGame: 95, lateGame: 95 }),
    makePlayer(`${prefix}-adc`, "adc", { lanePhase: 95, midGame: 95, lateGame: 95 }),
    makePlayer(`${prefix}-sup`, "support", { lanePhase: 95, midGame: 95, lateGame: 95 }),
  ];
}

/** Build a roster with very weak stats. */
function makeWeakRoster(prefix: string): PlayerVersion[] {
  return [
    makePlayer(`${prefix}-top`, "top", { lanePhase: 30, midGame: 30, lateGame: 30 }),
    makePlayer(`${prefix}-jgl`, "jungle", { lanePhase: 30, midGame: 30, lateGame: 30 }),
    makePlayer(`${prefix}-mid`, "mid", { lanePhase: 30, midGame: 30, lateGame: 30 }),
    makePlayer(`${prefix}-adc`, "adc", { lanePhase: 30, midGame: 30, lateGame: 30 }),
    makePlayer(`${prefix}-sup`, "support", { lanePhase: 30, midGame: 30, lateGame: 30 }),
  ];
}

function makeChampionMap(roster: PlayerVersion[]): Record<string, string> {
  return Object.fromEntries(roster.map((p) => [p.id, `${p.id}-c1`]));
}

function makeInput(
  userRoster: PlayerVersion[],
  rivalRoster: PlayerVersion[],
  speedPreset: MatchInput["speedPreset"] = "fast"
): MatchInput {
  return {
    userRoster,
    rivalRoster,
    userChampions: makeChampionMap(userRoster),
    rivalChampions: makeChampionMap(rivalRoster),
    speedPreset,
  };
}

// ---------------------------------------------------------------------------
// SIM-06: Champion catalogue threading (Pitfall 7 — missing IDs trait-neutral)
// ---------------------------------------------------------------------------

describe("runMatch — champion catalogue (SIM-06, Pitfall 7)", () => {
  it("does not throw when picked championIds are absent from the catalogue", () => {
    // The default makeInput maps every player to `${id}-c1`, none of which exist
    // in this catalogue. Missing IDs must be trait-neutral, never a crash.
    const input: MatchInput = {
      ...makeInput(makeEvenRoster("u"), makeEvenRoster("r")),
      championCatalogue: [
        { id: "ahri", name: "Ahri", traits: ["high_first_blood"] },
      ],
    };
    expect(() => runMatch(input, 42)).not.toThrow();
    const result = runMatch(input, 42);
    expect(result.events[result.events.length - 1].type).toBe("gg");
  });

  it("is a no-op when no catalogue is passed (determinism preserved)", () => {
    const base = makeInput(makeEvenRoster("u"), makeEvenRoster("r"));
    const withEmpty: MatchInput = { ...base, championCatalogue: [] };
    // An empty catalogue contributes no traits → identical to no catalogue.
    expect(runMatch(withEmpty, 7)).toEqual(runMatch(base, 7));
  });
});

// ---------------------------------------------------------------------------
// SIM-01: Determinism
// ---------------------------------------------------------------------------

describe("runMatch — determinism (SIM-01)", () => {
  it("called twice with the same input and seed returns deep-equal results", () => {
    const input = makeInput(makeEvenRoster("u"), makeEvenRoster("r"));
    const result1 = runMatch(input, 42);
    const result2 = runMatch(input, 42);
    expect(result1).toEqual(result2);
  });

  it("different seeds produce different results", () => {
    const input = makeInput(makeEvenRoster("u"), makeEvenRoster("r"));
    const result1 = runMatch(input, 42);
    const result2 = runMatch(input, 99);
    // At minimum the event timeline or winner should differ across seeds
    // (very unlikely to be identical with the same balanced rosters)
    expect(result1).not.toEqual(result2);
  });
});

// ---------------------------------------------------------------------------
// SIM-02: Role-weighted scoring
// ---------------------------------------------------------------------------

describe("runMatch — role-weighted team scoring (SIM-02)", () => {
  it("a team with higher support lanePhase has a higher lane score contribution", () => {
    // User: very high support lanePhase; Rival: average
    const userRoster = makeEvenRoster("u");
    const rivalRoster = makeEvenRoster("r");

    // Make the user support much stronger in lanePhase — reflects support→lanePhase weight
    const strongUserRoster = [
      ...userRoster.filter((p) => p.primaryRole !== "support"),
      makePlayer("u-sup-strong", "support", { lanePhase: 99, midGame: 50, lateGame: 50 }),
    ];
    const weakUserRoster = [
      ...userRoster.filter((p) => p.primaryRole !== "support"),
      makePlayer("u-sup-weak", "support", { lanePhase: 30, midGame: 50, lateGame: 50 }),
    ];

    // Run both configurations with same seed; stronger support should produce
    // more favorable lane outcomes on average (checked via win rate over many seeds)
    // For deterministic unit test: run multiple seeds and count wins
    let strongWins = 0;
    let weakWins = 0;
    for (let seed = 0; seed < 50; seed++) {
      const r1 = runMatch(makeInput(strongUserRoster, rivalRoster), seed);
      const r2 = runMatch(makeInput(weakUserRoster, rivalRoster), seed);
      if (r1.winner === "user") strongWins++;
      if (r2.winner === "user") weakWins++;
    }
    // Strong support lanePhase player should win more than weak support player
    expect(strongWins).toBeGreaterThan(weakWins);
  });

  it("a team with higher jungle midGame wins more often in mid-game heavy scenarios", () => {
    const rivalRoster = makeEvenRoster("r");

    const strongJglRoster = [
      ...makeEvenRoster("u").filter((p) => p.primaryRole !== "jungle"),
      makePlayer("u-jgl-strong", "jungle", { lanePhase: 50, midGame: 99, lateGame: 50 }),
    ];
    const weakJglRoster = [
      ...makeEvenRoster("u").filter((p) => p.primaryRole !== "jungle"),
      makePlayer("u-jgl-weak", "jungle", { lanePhase: 50, midGame: 30, lateGame: 50 }),
    ];

    let strongWins = 0;
    let weakWins = 0;
    for (let seed = 0; seed < 50; seed++) {
      const r1 = runMatch(makeInput(strongJglRoster, rivalRoster), seed);
      const r2 = runMatch(makeInput(weakJglRoster, rivalRoster), seed);
      if (r1.winner === "user") strongWins++;
      if (r2.winner === "user") weakWins++;
    }
    expect(strongWins).toBeGreaterThan(weakWins);
  });
});

// ---------------------------------------------------------------------------
// SIM-03: Event vocabulary
// ---------------------------------------------------------------------------

describe("runMatch — event vocabulary (SIM-03)", () => {
  it("event timeline always includes first_blood and gg", () => {
    const input = makeInput(makeEvenRoster("u"), makeEvenRoster("r"));
    const result = runMatch(input, 42);
    const types = result.events.map((e) => e.type);
    expect(types).toContain("first_blood");
    expect(types).toContain("gg");
  });

  it("gg is the last event in the timeline", () => {
    const input = makeInput(makeEvenRoster("u"), makeEvenRoster("r"));
    const result = runMatch(input, 42);
    expect(result.events[result.events.length - 1].type).toBe("gg");
  });

  it("only locked event vocabulary appears in the timeline", () => {
    const validTypes = new Set([
      "first_blood", "dragon", "dragon_steal", "inhibitor", "baron", "elder_dragon", "gg",
    ]);
    const input = makeInput(makeEvenRoster("u"), makeEvenRoster("r"));
    // Run several seeds to cover varied timelines
    for (let seed = 0; seed < 10; seed++) {
      const result = runMatch(input, seed);
      for (const event of result.events) {
        expect(validTypes.has(event.type), `Invalid event type: ${event.type}`).toBe(true);
      }
    }
  });

  it("a close match (balanced teams) produces baron or elder_dragon in the timeline (D-10/D-15 mechanism)", () => {
    const evenInput = makeInput(makeEvenRoster("u"), makeEvenRoster("r"));
    // With balanced rosters, many seeds should produce close games with epic events
    let epicEventCount = 0;
    for (let seed = 0; seed < 50; seed++) {
      const result = runMatch(evenInput, seed);
      if (result.events.some((e) => e.type === "baron" || e.type === "elder_dragon")) {
        epicEventCount++;
      }
    }
    // At least some close games should have epic events
    expect(epicEventCount).toBeGreaterThan(0);
  });

  it("a one-sided stomp (very strong vs very weak) rarely produces baron or elder_dragon", () => {
    const stompInput = makeInput(makeStrongRoster("s"), makeWeakRoster("w"));
    let epicEventCount = 0;
    for (let seed = 0; seed < 50; seed++) {
      const result = runMatch(stompInput, seed);
      if (result.events.some((e) => e.type === "baron" || e.type === "elder_dragon")) {
        epicEventCount++;
      }
    }
    // Stomps should have fewer epic events than close games
    // We allow some (0-10%) since closeness threshold is Phase 3 calibration
    expect(epicEventCount).toBeLessThan(20); // less than 40% of 50
  });
});

// ---------------------------------------------------------------------------
// SIM-07: Win probability
// ---------------------------------------------------------------------------

describe("runMatch — win probability (SIM-07)", () => {
  it("every GameEvent.winProbAfter is in [0, 1]", () => {
    const input = makeInput(makeEvenRoster("u"), makeEvenRoster("r"));
    for (let seed = 0; seed < 10; seed++) {
      const result = runMatch(input, seed);
      for (const event of result.events) {
        expect(event.winProbAfter).toBeGreaterThanOrEqual(0);
        expect(event.winProbAfter).toBeLessThanOrEqual(1);
      }
    }
  });

  it("winProbAfter changes across consecutive events (not pinned to 0/1 early)", () => {
    const input = makeInput(makeEvenRoster("u"), makeEvenRoster("r"));
    const result = runMatch(input, 42);
    // Must have at least 3 events to check change
    expect(result.events.length).toBeGreaterThanOrEqual(3);

    const probs = result.events.map((e) => e.winProbAfter);
    // Not all probabilities should be the same (probability should shift)
    const allSame = probs.every((p) => p === probs[0]);
    expect(allSame).toBe(false);

    // Win probability should not pin to exactly 0 or exactly 1 before the last event
    const nonFinalEvents = probs.slice(0, -1);
    for (const prob of nonFinalEvents) {
      expect(prob).not.toBe(0);
      expect(prob).not.toBe(1);
    }
  });

  it("the final event's winProbAfter agrees with the returned winner", () => {
    const input = makeInput(makeEvenRoster("u"), makeEvenRoster("r"));
    for (let seed = 0; seed < 10; seed++) {
      const result = runMatch(input, seed);
      const lastProb = result.events[result.events.length - 1].winProbAfter;
      if (result.winner === "user") {
        expect(lastProb).toBeGreaterThan(0.5);
      } else {
        expect(lastProb).toBeLessThan(0.5);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// D-09/D-10: Pacing — duration near preset average; close games run longer
// ---------------------------------------------------------------------------

describe("runMatch — pacing (D-09, D-10)", () => {
  it("totalPlaybackMs is in a reasonable range around the chosen speed preset", () => {
    const input = makeInput(makeEvenRoster("u"), makeEvenRoster("r"), "fast");
    const presetMs = SPEED_PRESET_MS["fast"]; // 30_000

    // Allow wide tolerance: 50% to 200% of preset (Phase 3 calibrates tighter)
    for (let seed = 0; seed < 20; seed++) {
      const result = runMatch(input, seed);
      expect(result.totalPlaybackMs).toBeGreaterThanOrEqual(presetMs * 0.5);
      expect(result.totalPlaybackMs).toBeLessThanOrEqual(presetMs * 2.0);
    }
  });

  it("close match yields longer duration than a stomp under the same preset", () => {
    const closeInput = makeInput(makeEvenRoster("u"), makeEvenRoster("r"), "fast");
    const stompInput = makeInput(makeStrongRoster("s"), makeWeakRoster("w"), "fast");

    let totalCloseDuration = 0;
    let totalStompDuration = 0;

    // Average over many seeds to account for RNG variance
    for (let seed = 0; seed < 30; seed++) {
      totalCloseDuration += runMatch(closeInput, seed).totalPlaybackMs;
      totalStompDuration += runMatch(stompInput, seed).totalPlaybackMs;
    }
    const avgClose = totalCloseDuration / 30;
    const avgStomp = totalStompDuration / 30;

    expect(avgClose).toBeGreaterThan(avgStomp);
  });

  it("event timestamps are ordered (ascending playbackMs)", () => {
    const input = makeInput(makeEvenRoster("u"), makeEvenRoster("r"));
    const result = runMatch(input, 42);
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i].playbackMs).toBeGreaterThanOrEqual(
        result.events[i - 1].playbackMs
      );
    }
  });

  it("SPEED_PRESET_MS has correct values for all presets", () => {
    expect(SPEED_PRESET_MS.super_fast).toBe(15_000);
    expect(SPEED_PRESET_MS.fast).toBe(30_000);
    expect(SPEED_PRESET_MS.slow).toBe(60_000);
    expect(SPEED_PRESET_MS.super_slow).toBe(90_000);
  });
});
