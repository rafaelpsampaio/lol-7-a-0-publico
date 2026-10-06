/**
 * src/sim/fearless.test.ts
 *
 * TDD RED tests for assignFearlessChampions() — FEAR-01, FEAR-02.
 * Tests describe behavior before implementation exists.
 *
 * FEAR-01: every assigned championId for a player exists in that player's championPool.
 * FEAR-02: no player repeats a champion across their 5 game assignments;
 *          look-ahead does not deadlock with a minimum 8-champion pool.
 * Within-game uniqueness: no champion assigned to two players in the same game.
 */

import { describe, it, expect } from "vitest";
import { assignFearlessChampions, assignFearlessChampionsBothTeams } from "./fearless";
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
  championIds: string[]
): PlayerVersion {
  return {
    id,
    personId: id,
    displayName: `Player ${id}`,
    year: 2023,
    roles: [role],
    primaryRole: role,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: 80 },
    lanePhase: 80,
    midGame: 80,
    lateGame: 80,
    traits: [],
    championPool: makeChampionPool(championIds),
  };
}

/** Build a 5-player roster with distinct champion pools (10 champs each, no overlap). */
function makeRoster(): PlayerVersion[] {
  return [
    makePlayer("p-top", "top", [
      "aatrox", "camille", "fiora", "garen", "irelia",
      "jax", "kennen", "malphite", "nasus", "ornn",
    ]),
    makePlayer("p-jungle", "jungle", [
      "amumu", "ekko", "elise", "graves", "hecarim",
      "jarvaniv", "kayn", "kha6", "lee", "nidalee",
    ]),
    makePlayer("p-mid", "mid", [
      "ahri", "akali", "azir", "cassio", "corki",
      "fizz", "galio", "katarina", "leblanc", "lissandra",
    ]),
    makePlayer("p-adc", "adc", [
      "ashe", "caitlyn", "draven", "ezreal", "jhin",
      "jinx", "kai", "lucian", "miss", "sivir",
    ]),
    makePlayer("p-support", "support", [
      "alistar", "bard", "blitzcrank", "braum", "janna",
      "karma", "lulu", "nami", "soraka", "thresh",
    ]),
  ];
}

/** Build a roster where every player has exactly 8 champions (minimum pool). */
function makeMinPoolRoster(): PlayerVersion[] {
  return [
    makePlayer("m-top", "top", [
      "aatrox", "camille", "fiora", "garen", "irelia", "jax", "kennen", "malphite",
    ]),
    makePlayer("m-jungle", "jungle", [
      "amumu", "ekko", "elise", "graves", "hecarim", "jarvaniv", "kayn", "kha6",
    ]),
    makePlayer("m-mid", "mid", [
      "ahri", "akali", "azir", "cassio", "corki", "fizz", "galio", "katarina",
    ]),
    makePlayer("m-adc", "adc", [
      "ashe", "caitlyn", "draven", "ezreal", "jhin", "jinx", "kai", "lucian",
    ]),
    makePlayer("m-support", "support", [
      "alistar", "bard", "blitzcrank", "braum", "janna", "karma", "lulu", "nami",
    ]),
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("assignFearlessChampions — FEAR-01: picks from player pool", () => {
  it("every assigned championId exists in the corresponding player's championPool", () => {
    const roster = makeRoster();
    const assignment = assignFearlessChampions(roster, 5);

    for (const player of roster) {
      const poolIds = new Set(player.championPool.map((cm) => cm.championId));
      for (let gameIdx = 0; gameIdx < 5; gameIdx++) {
        const picked = assignment[gameIdx][player.id];
        expect(
          poolIds.has(picked),
          `Game ${gameIdx}: player ${player.id} was assigned "${picked}" which is not in their pool`
        ).toBe(true);
      }
    }
  });
});

describe("assignFearlessChampions — FEAR-02: no champion repeats in a series", () => {
  it("no player is assigned the same champion twice across 5 games", () => {
    const roster = makeRoster();
    const assignment = assignFearlessChampions(roster, 5);

    for (const player of roster) {
      const seen = new Set<string>();
      for (let gameIdx = 0; gameIdx < 5; gameIdx++) {
        const picked = assignment[gameIdx][player.id];
        expect(
          seen.has(picked),
          `Player ${player.id} got champion "${picked}" in game ${gameIdx} but it was already used`
        ).toBe(false);
        seen.add(picked);
      }
    }
  });

  it("does not deadlock with minimum 8-champion pool across 5 games (FEAR-02)", () => {
    const roster = makeMinPoolRoster();
    const assignment = assignFearlessChampions(roster, 5);

    // All 5 games must be fully populated — no "unknown" fallbacks
    for (const player of roster) {
      for (let gameIdx = 0; gameIdx < 5; gameIdx++) {
        const picked = assignment[gameIdx][player.id];
        expect(
          picked,
          `Player ${player.id} got undefined/null in game ${gameIdx}`
        ).toBeDefined();
        expect(
          picked,
          `Player ${player.id} got fallback "unknown" in game ${gameIdx} — look-ahead deadlocked`
        ).not.toBe("unknown");
        expect(picked.length).toBeGreaterThan(0);
      }
    }

    // Champions per player are still unique across games
    for (const player of roster) {
      const seen = new Set<string>();
      for (let gameIdx = 0; gameIdx < 5; gameIdx++) {
        const picked = assignment[gameIdx][player.id];
        expect(seen.has(picked)).toBe(false);
        seen.add(picked);
      }
    }
  });
});

describe("assignFearlessChampions — within-game uniqueness", () => {
  it("no champion is assigned to two different players in the same game", () => {
    const roster = makeRoster();
    const assignment = assignFearlessChampions(roster, 5);

    for (let gameIdx = 0; gameIdx < 5; gameIdx++) {
      const pickedThisGame = new Set<string>();
      for (const player of roster) {
        const picked = assignment[gameIdx][player.id];
        expect(
          pickedThisGame.has(picked),
          `Game ${gameIdx}: champion "${picked}" assigned to two players`
        ).toBe(false);
        pickedThisGame.add(picked);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// assignFearlessChampionsBothTeams — cross-team uniqueness within the same game
// ---------------------------------------------------------------------------

/** Two rosters that share the same champion pool (worst-case overlap scenario). */
function makeOverlappingRosters(): { teamA: PlayerVersion[]; teamB: PlayerVersion[] } {
  const sharedPool = [
    "aatrox", "ahri", "akali", "azir", "camille",
    "cassio", "corki", "fizz", "galio", "irelia",
    "jax", "katarina", "leblanc", "lissandra", "malphite",
    "nasus", "ornn", "syndra", "viktor", "zed",
  ];
  const roles = ["top", "jungle", "mid", "adc", "support"] as const;
  // Both teams draw from the same 20-champion pool (10 each player, distinct per role slice)
  const teamA = roles.map((role, i) =>
    makePlayer(`a-${role}`, role, sharedPool.slice(i * 4, i * 4 + 10).concat(sharedPool.slice(0, Math.max(0, 10 - (sharedPool.length - i * 4)))))
  );
  const teamB = roles.map((role, i) =>
    makePlayer(`b-${role}`, role, sharedPool.slice(i * 4, i * 4 + 10).concat(sharedPool.slice(0, Math.max(0, 10 - (sharedPool.length - i * 4)))))
  );
  return { teamA, teamB };
}

describe("assignFearlessChampionsBothTeams — cross-team uniqueness", () => {
  it("all 10 champion picks in the same game are globally unique across both teams", () => {
    const rosterA = makeRoster();
    // Build a second roster with a completely different pool to ensure both teams
    // can always find a valid pick across all 5 games
    const rosterB = [
      makePlayer("b-top", "top", [
        "darius", "gnar", "gwen", "illaoi", "jayce",
        "mordekaiser", "quinn", "renekton", "sett", "sion",
      ]),
      makePlayer("b-jungle", "jungle", [
        "diana", "fiddlesticks", "gragas", "ivern", "master",
        "nocturne", "nunu", "rammus", "sejuani", "trundle",
      ]),
      makePlayer("b-mid", "mid", [
        "anivia", "annie", "aurelion", "diana", "galio",
        "malzahar", "neeko", "qiyana", "sylas", "twisted",
      ]),
      makePlayer("b-adc", "adc", [
        "aphelios", "cogmaw", "kalista", "kogmaw", "nilah",
        "samira", "seraphine", "tristana", "twitch", "varus",
      ]),
      makePlayer("b-support", "support", [
        "lulu", "milio", "morgana", "nautilus", "pyke",
        "rakan", "renata", "seraphine", "sona", "zyra",
      ]),
    ];

    const { teamA, teamB } = assignFearlessChampionsBothTeams(rosterA, rosterB, 5);

    for (let gameIdx = 0; gameIdx < 5; gameIdx++) {
      const pickedThisGame = new Set<string>();

      for (const player of rosterA) {
        const picked = teamA[gameIdx][player.id];
        expect(
          pickedThisGame.has(picked),
          `Game ${gameIdx}: champion "${picked}" (teamA player ${player.id}) already taken`
        ).toBe(false);
        pickedThisGame.add(picked);
      }

      for (const player of rosterB) {
        const picked = teamB[gameIdx][player.id];
        expect(
          pickedThisGame.has(picked),
          `Game ${gameIdx}: champion "${picked}" (teamB player ${player.id}) already taken by teamA`
        ).toBe(false);
        pickedThisGame.add(picked);
      }
    }
  });

  it("each team's per-player fearless history is still independent across games", () => {
    const rosterA = makeRoster();
    const rosterB = [
      makePlayer("b-top", "top", [
        "darius", "gnar", "gwen", "illaoi", "jayce",
        "mordekaiser", "quinn", "renekton", "sett", "sion",
      ]),
      makePlayer("b-jungle", "jungle", [
        "diana", "fiddlesticks", "gragas", "ivern", "master",
        "nocturne", "nunu", "rammus", "sejuani", "trundle",
      ]),
      makePlayer("b-mid", "mid", [
        "anivia", "annie", "aurelion", "ekko", "galio2",
        "malzahar", "neeko", "qiyana", "sylas", "twisted",
      ]),
      makePlayer("b-adc", "adc", [
        "aphelios", "cogmaw", "kalista", "kogmaw", "nilah",
        "samira", "seraphine", "tristana", "twitch", "varus",
      ]),
      makePlayer("b-support", "support", [
        "lulu", "milio", "morgana", "nautilus", "pyke",
        "rakan", "renata", "sona", "thresh2", "zyra",
      ]),
    ];

    const { teamA, teamB } = assignFearlessChampionsBothTeams(rosterA, rosterB, 5);

    // No player in teamA repeats a champion across games
    for (const player of rosterA) {
      const seen = new Set<string>();
      for (let gameIdx = 0; gameIdx < 5; gameIdx++) {
        const picked = teamA[gameIdx][player.id];
        expect(seen.has(picked)).toBe(false);
        seen.add(picked);
      }
    }

    // No player in teamB repeats a champion across games
    for (const player of rosterB) {
      const seen = new Set<string>();
      for (let gameIdx = 0; gameIdx < 5; gameIdx++) {
        const picked = teamB[gameIdx][player.id];
        expect(seen.has(picked)).toBe(false);
        seen.add(picked);
      }
    }
  });

  it("multiple seeds (different pool orderings) all produce valid cross-team unique assignments", () => {
    // Simulate different "seeds" by varying mastery assignments (deterministic by mastery order)
    const roles = ["top", "jungle", "mid", "adc", "support"] as const;
    const poolA = [
      "aatrox", "ahri", "akali", "azir", "camille",
      "cassio", "corki", "fizz", "galio", "irelia",
    ];
    const poolB = [
      "darius", "gnar", "gwen", "illaoi", "jayce",
      "mordekaiser", "quinn", "renekton", "sett", "sion",
    ];

    // Three variations with different mastery orderings
    for (const offset of [0, 3, 7]) {
      const rosterA = roles.map((role) =>
        makePlayer(`a-${role}-${offset}`, role,
          [...poolA.slice(offset), ...poolA.slice(0, offset)])
      );
      const rosterB = roles.map((role) =>
        makePlayer(`b-${role}-${offset}`, role,
          [...poolB.slice(offset % poolB.length), ...poolB.slice(0, offset % poolB.length)])
      );

      const { teamA, teamB } = assignFearlessChampionsBothTeams(rosterA, rosterB, 5);

      for (let gameIdx = 0; gameIdx < 5; gameIdx++) {
        const pickedThisGame = new Set<string>();
        for (const player of rosterA) {
          const picked = teamA[gameIdx][player.id];
          expect(pickedThisGame.has(picked)).toBe(false);
          pickedThisGame.add(picked);
        }
        for (const player of rosterB) {
          const picked = teamB[gameIdx][player.id];
          expect(pickedThisGame.has(picked)).toBe(false);
          pickedThisGame.add(picked);
        }
      }
    }
  });
});
