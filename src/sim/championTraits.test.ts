/**
 * src/sim/championTraits.test.ts
 *
 * Statistical test for champion-trait event-probability effects (SIM-06, criterion 3).
 *
 * Criterion 3: a team whose 5 picked champions all carry high_first_blood
 * generates first_blood at a measurably higher rate than a baseline (trait-less)
 * team across 100 seeded sims.
 *
 * Method (RESEARCH "Statistical test pattern" + Pitfall 3 distinct seeds):
 *   - Two MatchInputs share the same rosters/rivals but differ ONLY in the
 *     championCatalogue + userChampions: a baseline where the user's 5 picked
 *     champions have empty traits, and a test where all 5 carry high_first_blood.
 *   - Loop seeds 0..99 (distinct seeds), run each, tally how often the first_blood
 *     event credits the user team.
 *   - Assert the trait team's first-blood rate exceeds baseline by a margin.
 *
 * Randomness is seed-only — every match flows through runMatch(input, seed); no
 * Math.random() in the test or the engine (SIM-01 determinism preserved).
 */

import { describe, it, expect } from "vitest";
import { runMatch } from "./runMatch";
import type { MatchInput } from "./types";
import type { PlayerVersion, ChampionEntry } from "../data/schema";

// ---------------------------------------------------------------------------
// Fixtures — mirror src/sim/runMatch.test.ts style
// ---------------------------------------------------------------------------

function makeChampionPool(
  ids: string[]
): { championId: string; mastery: 1 | 2 | 3 | 4 | 5 }[] {
  return ids.map((id, i) => ({
    championId: id,
    mastery: Math.min(5, (i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
  }));
}

function makePlayer(
  id: string,
  role: "top" | "jungle" | "mid" | "adc" | "support"
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
    traits: [],
    championPool: makeChampionPool([
      `${id}-c1`, `${id}-c2`, `${id}-c3`, `${id}-c4`,
      `${id}-c5`, `${id}-c6`, `${id}-c7`, `${id}-c8`,
    ]),
  };
}

/** A balanced 5-role roster with equal stats (even matchup baseline). */
function makeEvenRoster(prefix: string): PlayerVersion[] {
  return [
    makePlayer(`${prefix}-top`, "top"),
    makePlayer(`${prefix}-jgl`, "jungle"),
    makePlayer(`${prefix}-mid`, "mid"),
    makePlayer(`${prefix}-adc`, "adc"),
    makePlayer(`${prefix}-sup`, "support"),
  ];
}

/** playerId → championId map, one distinct champion per player. */
function championMap(roster: PlayerVersion[]): Record<string, string> {
  return Object.fromEntries(roster.map((p) => [p.id, `${p.id}-champ`]));
}

/** A catalogue assigning the given traits to every champion the roster picks. */
function catalogueFor(
  roster: PlayerVersion[],
  traits: ChampionEntry["traits"]
): ChampionEntry[] {
  return roster.map((p) => ({
    id: `${p.id}-champ`,
    name: `${p.id}-champ`,
    traits,
  }));
}

function makeInput(
  userRoster: PlayerVersion[],
  rivalRoster: PlayerVersion[],
  championCatalogue: ChampionEntry[]
): MatchInput {
  return {
    userRoster,
    rivalRoster,
    userChampions: championMap(userRoster),
    rivalChampions: championMap(rivalRoster),
    speedPreset: "fast",
    championCatalogue,
  };
}

/** First-blood rate for the user team across 100 distinct seeds (0..99). */
function userFirstBloodRate(input: MatchInput, sims = 100): number {
  let userFirstBloods = 0;
  for (let seed = 0; seed < sims; seed++) {
    const result = runMatch(input, seed);
    const firstBlood = result.events.find((e) => e.type === "first_blood");
    if (firstBlood && firstBlood.team === "user") userFirstBloods++;
  }
  return userFirstBloods / sims;
}

// ---------------------------------------------------------------------------
// Criterion 3 — champion traits measurably alter event probabilities
// ---------------------------------------------------------------------------

describe("champion traits — first-blood rate (SIM-06 criterion 3)", () => {
  it("a 5× high_first_blood team gets first_blood more often than a baseline team across 100 sims", () => {
    const userRoster = makeEvenRoster("u");
    const rivalRoster = makeEvenRoster("r");

    // Baseline: user's 5 picked champions carry NO traits.
    const baselineInput = makeInput(
      userRoster,
      rivalRoster,
      catalogueFor(userRoster, [])
    );
    // Test: all 5 of the user's picked champions carry high_first_blood.
    const traitInput = makeInput(
      userRoster,
      rivalRoster,
      catalogueFor(userRoster, ["high_first_blood"])
    );

    const baselineRate = userFirstBloodRate(baselineInput);
    const traitRate = userFirstBloodRate(traitInput);

    // The high_first_blood stack must measurably raise the user's FB rate.
    expect(traitRate).toBeGreaterThan(baselineRate);
    // ...and by a non-trivial margin (criterion 3 "measurably higher").
    expect(traitRate - baselineRate).toBeGreaterThan(0.05);
  });

  it("the high_first_blood effect scales with team density (5/5 > 1/5)", () => {
    const userRoster = makeEvenRoster("u");
    const rivalRoster = makeEvenRoster("r");

    // Only ONE of the user's five picked champions carries the trait.
    const sparseCatalogue: ChampionEntry[] = catalogueFor(userRoster, []).map(
      (entry, i) =>
        i === 0 ? { ...entry, traits: ["high_first_blood"] } : entry
    );
    const sparseInput = makeInput(userRoster, rivalRoster, sparseCatalogue);
    const fullInput = makeInput(
      userRoster,
      rivalRoster,
      catalogueFor(userRoster, ["high_first_blood"])
    );

    const sparseRate = userFirstBloodRate(sparseInput);
    const fullRate = userFirstBloodRate(fullInput);

    // Density scaling (Pitfall 4): a full stack out-performs a single champion.
    expect(fullRate).toBeGreaterThan(sparseRate);
  });
});
