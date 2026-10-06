/**
 * src/tournament/series.test.ts
 *
 * TDD unit tests for the Bo5 series orchestrator (BRKT-02, BRKT-04, D-05, D-06).
 *
 * RED phase — written before series.ts exists; must fail until Task 1 GREEN.
 *
 * Validates:
 *   - seriesWinnerId: advance at exactly 3 wins; series stores at most 5 games
 *   - runSeriesGame: returns StoredGame with per-game champion data from assignFearlessChampions
 *   - fearless: no player repeats a champion across a full 5-game assignment
 *   - determinism: same state+slot+gameIndex → identical StoredGame.seed and winnerId
 *   - fearlessUsedAfter: returns updated Record<string,string[]> appending each player's champion
 */

import { describe, it, expect } from "vitest";
import { StoredGameSchema, type TournamentState, type TournamentTeam, type SeriesState, type StoredGame } from "./schema";
import { createTournament } from "./bracket";
import { runSeriesGame, seriesWinnerId, fearlessUsedAfter } from "./series";
import { assignFearlessChampions, assignFearlessChampionsBothTeams } from "../sim/fearless";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makePlayer(id: string, role: string) {
  return {
    id,
    personId: id,
    displayName: `Player ${id}`,
    year: 2020,
    roles: [role],
    primaryRole: role,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: 70 },
    lanePhase: 70,
    midGame: 65,
    lateGame: 60,
    traits: [] as string[],
    championPool: [
      { championId: "lux", mastery: 5 as const },
      { championId: "ezreal", mastery: 4 as const },
      { championId: "thresh", mastery: 4 as const },
      { championId: "zed", mastery: 3 as const },
      { championId: "orianna", mastery: 3 as const },
      { championId: "syndra", mastery: 2 as const },
      { championId: "viktor", mastery: 2 as const },
      { championId: "ryze", mastery: 1 as const },
    ],
  };
}

function makeTeam(id: string, isUser: boolean): TournamentTeam {
  const roles = ["top", "jungle", "mid", "adc", "support"] as const;
  return {
    id,
    isUser,
    displayName: isUser ? "Meu Time" : `Bot ${id}`,
    roster: roles.map((role) => makePlayer(`${id}-${role}`, role)),
  };
}

/** Build an 8-team TournamentState; user team is always "user" in UB_QF_1 */
function makeTournament(): TournamentState {
  const teams: TournamentTeam[] = [
    makeTeam("user", true),
    ...Array.from({ length: 7 }, (_, i) => makeTeam(`bot-${i}`, false)),
  ];
  return createTournament(12345, teams);
}

/**
 * Build a player with a role-specific, non-overlapping champion pool.
 * Pool A and Pool B champion ids are completely disjoint so cross-team
 * uniqueness is always mathematically achievable for a 5-game series.
 */
function makePlayerDistinctPool(
  id: string,
  role: string,
  poolSuffix: "a" | "b"
) {
  // Each role gets 10 distinct champions; A-pool and B-pool do not overlap.
  const rolePools: Record<string, { a: string[]; b: string[] }> = {
    top: {
      a: ["aatrox", "camille", "fiora", "garen", "irelia", "jax", "kennen", "malphite", "nasus", "ornn"],
      b: ["darius", "gnar", "gwen", "illaoi", "jayce", "mordekaiser", "quinn", "renekton", "sett", "sion"],
    },
    jungle: {
      a: ["amumu", "ekko", "elise", "graves", "hecarim", "jarvaniv", "kayn", "kha6", "lee", "nidalee"],
      b: ["diana", "fiddlesticks", "gragas", "ivern", "master", "nocturne", "nunu", "rammus", "sejuani", "trundle"],
    },
    mid: {
      a: ["ahri", "akali", "azir", "cassio", "corki", "fizz", "galio", "katarina", "leblanc", "lissandra"],
      b: ["anivia", "annie", "aurelion", "ekko2", "galio2", "malzahar", "neeko", "qiyana", "sylas", "twisted"],
    },
    adc: {
      a: ["ashe", "caitlyn", "draven", "ezreal", "jhin", "jinx", "kai", "lucian", "miss", "sivir"],
      b: ["aphelios", "cogmaw", "kalista", "kogmaw", "nilah", "samira", "seraphine", "tristana", "twitch", "varus"],
    },
    support: {
      a: ["alistar", "bard", "blitzcrank", "braum", "janna", "karma", "lulu", "nami", "soraka", "thresh"],
      b: ["lulu2", "milio", "morgana", "nautilus", "pyke", "rakan", "renata", "sona", "vel", "zyra"],
    },
  };
  const pool = rolePools[role]?.[poolSuffix] ?? rolePools["top"][poolSuffix];
  return {
    id,
    personId: id,
    displayName: `Player ${id}`,
    year: 2020,
    roles: [role],
    primaryRole: role,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: 70 },
    lanePhase: 70,
    midGame: 65,
    lateGame: 60,
    traits: [] as string[],
    championPool: pool.map((championId, i) => ({
      championId,
      mastery: (Math.min(5, (i % 5) + 1) as 1 | 2 | 3 | 4 | 5),
    })),
  };
}

function makeTeamDistinctPool(id: string, isUser: boolean, poolSuffix: "a" | "b"): TournamentTeam {
  const roles = ["top", "jungle", "mid", "adc", "support"] as const;
  return {
    id,
    isUser,
    displayName: isUser ? "Meu Time" : `Bot ${id}`,
    roster: roles.map((role) => makePlayerDistinctPool(`${id}-${role}`, role, poolSuffix)),
  };
}

/** Build a tournament where teamA and teamB champion pools are completely disjoint. */
function makeTournamentDistinctPools(): TournamentState {
  const teams: TournamentTeam[] = [
    makeTeamDistinctPool("user", true, "a"),
    makeTeamDistinctPool("bot-0", false, "b"),
    ...Array.from({ length: 6 }, (_, i) => makeTeamDistinctPool(`bot-${i + 1}`, false, i % 2 === 0 ? "a" : "b")),
  ];
  return createTournament(12345, teams);
}

/** Find the first "ready" slot whose teamAId or teamBId is "user" */
function findUserSlot(state: TournamentState): string {
  for (const [slotId, slot] of Object.entries(state.slots)) {
    const s = slot.series;
    if (s.status === "ready" && (s.teamAId === "user" || s.teamBId === "user")) {
      return slotId;
    }
  }
  throw new Error("No user-ready slot found in test state");
}

// ---------------------------------------------------------------------------
// seriesWinnerId
// ---------------------------------------------------------------------------

describe("seriesWinnerId", () => {
  it("returns null when no team has 3 wins", () => {
    const series: SeriesState = {
      status: "in_progress",
      teamAId: "user",
      teamBId: "bot-0",
      wins: { user: 2, "bot-0": 2 },
      games: [],
      winnerId: null,
      fearlessUsed: {},
    };
    expect(seriesWinnerId(series)).toBeNull();
  });

  it("returns teamId when that team reaches exactly 3 wins", () => {
    const series: SeriesState = {
      status: "in_progress",
      teamAId: "user",
      teamBId: "bot-0",
      wins: { user: 3, "bot-0": 1 },
      games: [],
      winnerId: null,
      fearlessUsed: {},
    };
    expect(seriesWinnerId(series)).toBe("user");
  });

  it("returns winner at 3-0 sweep", () => {
    const series: SeriesState = {
      status: "in_progress",
      teamAId: "user",
      teamBId: "bot-0",
      wins: { user: 3, "bot-0": 0 },
      games: [],
      winnerId: null,
      fearlessUsed: {},
    };
    expect(seriesWinnerId(series)).toBe("user");
  });

  it("returns winner at 3-2 (deciding game 5)", () => {
    const series: SeriesState = {
      status: "in_progress",
      teamAId: "user",
      teamBId: "bot-0",
      wins: { user: 2, "bot-0": 3 },
      games: [],
      winnerId: null,
      fearlessUsed: {},
    };
    expect(seriesWinnerId(series)).toBe("bot-0");
  });

  it("returns null for 2-2 (tied, no winner yet)", () => {
    const series: SeriesState = {
      status: "in_progress",
      teamAId: "user",
      teamBId: "bot-0",
      wins: { user: 2, "bot-0": 2 },
      games: [],
      winnerId: null,
      fearlessUsed: {},
    };
    expect(seriesWinnerId(series)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// runSeriesGame — champion data + determinism
// ---------------------------------------------------------------------------

describe("runSeriesGame", () => {
  it("grava newTraitEffects so quando desligada (Review Focus 4)", () => {
    const state = makeTournament();
    const slotId = findUserSlot(state) as Parameters<typeof runSeriesGame>[1];
    const ligado = runSeriesGame(state, slotId, 0.25, []);
    expect("newTraitEffects" in ligado).toBe(false);
    const desligado = runSeriesGame(state, slotId, 0.25, [], 1, false);
    expect(desligado.newTraitEffects).toBe(false);
    expect(StoredGameSchema.safeParse(ligado).success).toBe(true);
    expect(StoredGameSchema.safeParse(desligado).success).toBe(true);
  });

  it("returns a StoredGame for game 0 with champions.teamA/teamB from assignFearlessChampionsBothTeams", () => {
    const state = makeTournament();
    const slotId = findUserSlot(state) as Parameters<typeof runSeriesGame>[1];
    const slot = state.slots[slotId]!;

    const game = runSeriesGame(state, slotId, 0.25, []);

    // Champions must come from the coordinated both-teams assignment at game index 0
    const teamAId = slot.series.teamAId!;
    const teamA = state.teams[teamAId]!;
    const teamBId = slot.series.teamBId!;
    const teamB = state.teams[teamBId]!;
    const { teamA: teamAAssignment, teamB: teamBAssignment } =
      assignFearlessChampionsBothTeams(teamA.roster, teamB.roster, 5);
    const expectedTeamA = teamAAssignment[0]!;
    const expectedTeamB = teamBAssignment[0]!;

    expect(game.champions.teamA).toEqual(expectedTeamA);
    expect(game.champions.teamB).toEqual(expectedTeamB);
  });

  it("is deterministic — same state+slot+gameIndex produces identical seed and winnerId", () => {
    const state = makeTournament();
    const slotId = findUserSlot(state) as Parameters<typeof runSeriesGame>[1];

    const game1 = runSeriesGame(state, slotId, 0.25, []);
    const game2 = runSeriesGame(state, slotId, 0.25, []);

    expect(game1.seed).toBe(game2.seed);
    expect(game1.winnerId).toBe(game2.winnerId);
  });

  it("uses gameSeed (stores a seed derived from tournament seed + slotId + gameIndex)", () => {
    const state = makeTournament();
    const slotId = findUserSlot(state) as Parameters<typeof runSeriesGame>[1];

    const game = runSeriesGame(state, slotId, 0.25, []);

    // The seed must be a non-negative integer (derived from gameSeed)
    expect(typeof game.seed).toBe("number");
    expect(Number.isInteger(game.seed)).toBe(true);
    expect(game.seed).toBeGreaterThanOrEqual(0);
  });

  it("returns StoredGame with all required fields", () => {
    const state = makeTournament();
    const slotId = findUserSlot(state) as Parameters<typeof runSeriesGame>[1];

    const game = runSeriesGame(state, slotId, 0.25, []);

    expect(typeof game.seed).toBe("number");
    expect(typeof game.winnerId).toBe("string");
    expect(Array.isArray(game.events)).toBe(true);
    expect(typeof game.totalPlaybackMs).toBe("number");
    expect(game.champions).toBeDefined();
    expect(game.champions.teamA).toBeDefined();
    expect(game.champions.teamB).toBeDefined();
  });

  it("champions.teamA and champions.teamB share no champion id within the same game", () => {
    // Uses distinct champion pools per team so 10-unique-picks-per-game is always achievable.
    const state = makeTournamentDistinctPools();
    const slotId = findUserSlot(state) as Parameters<typeof runSeriesGame>[1];

    const game = runSeriesGame(state, slotId, 0.25, []);

    const teamAChampionIds = new Set(Object.values(game.champions.teamA));
    for (const [playerId, champId] of Object.entries(game.champions.teamB)) {
      expect(
        teamAChampionIds.has(champId),
        `Champion "${champId}" assigned to teamB player ${playerId} also appears in teamA's picks`
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// fearless: no champion repeats across 5 games (D-06)
// ---------------------------------------------------------------------------

describe("fearless (D-06): no player repeats a champion across all 5 games", () => {
  it("assignFearlessChampions produces no repeats across 5 game assignments", () => {
    const state = makeTournament();
    const slotId = findUserSlot(state) as Parameters<typeof runSeriesGame>[1];
    const slot = state.slots[slotId]!;
    const teamAId = slot.series.teamAId!;
    const teamA = state.teams[teamAId]!;

    const assignment = assignFearlessChampions(teamA.roster, 5);

    // For each player, collect all champions assigned across 5 games
    for (const player of teamA.roster) {
      const championsUsed = new Set<string>();
      for (let gameIdx = 0; gameIdx < 5; gameIdx++) {
        const champId = assignment[gameIdx]?.[player.id];
        if (!champId) continue;
        expect(championsUsed.has(champId)).toBe(false);
        championsUsed.add(champId);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// fearlessUsedAfter
// ---------------------------------------------------------------------------

describe("fearlessUsedAfter", () => {
  it("returns updated fearlessUsed with each player's champion from the just-played game", () => {
    const state = makeTournament();
    const slotId = findUserSlot(state) as Parameters<typeof runSeriesGame>[1];
    const slot = state.slots[slotId]!;

    const game = runSeriesGame(state, slotId, 0.25, []);

    // Start from empty fearlessUsed
    const emptySeries: SeriesState = {
      ...slot.series,
      fearlessUsed: {},
    };

    const updated = fearlessUsedAfter(emptySeries, game);

    // Every champion assigned in the game should appear in fearlessUsed
    const allChampions: Record<string, string> = {
      ...game.champions.teamA,
      ...game.champions.teamB,
    };
    for (const [playerId, championId] of Object.entries(allChampions)) {
      expect(updated[playerId]).toBeDefined();
      expect(updated[playerId]).toContain(championId);
    }
  });

  it("appends to existing fearlessUsed without duplicating", () => {
    const state = makeTournament();
    const slotId = findUserSlot(state) as Parameters<typeof runSeriesGame>[1];
    const slot = state.slots[slotId]!;

    const game = runSeriesGame(state, slotId, 0.25, []);

    // Pre-populate with the same champions that will be added
    const allChampions: Record<string, string> = {
      ...game.champions.teamA,
      ...game.champions.teamB,
    };
    const existingFearless: Record<string, string[]> = {};
    for (const [playerId, championId] of Object.entries(allChampions)) {
      existingFearless[playerId] = [championId]; // already used
    }

    const seriesWithFearless: SeriesState = {
      ...slot.series,
      fearlessUsed: existingFearless,
    };

    const updated = fearlessUsedAfter(seriesWithFearless, game);

    // No duplicates should be added
    for (const [playerId, championId] of Object.entries(allChampions)) {
      const list = updated[playerId] ?? [];
      const occurrences = list.filter((c) => c === championId).length;
      expect(occurrences).toBe(1);
    }
  });

  it("returns a new object (does not mutate the original series.fearlessUsed)", () => {
    const state = makeTournament();
    const slotId = findUserSlot(state) as Parameters<typeof runSeriesGame>[1];
    const slot = state.slots[slotId]!;

    const game = runSeriesGame(state, slotId, 0.25, []);
    const originalFearless = { ...slot.series.fearlessUsed };
    const updated = fearlessUsedAfter(slot.series, game);

    // The original must be unchanged
    expect(slot.series.fearlessUsed).toEqual(originalFearless);
    // The result must be a different reference
    expect(updated).not.toBe(slot.series.fearlessUsed);
  });
});
