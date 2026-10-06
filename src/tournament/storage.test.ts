/**
 * src/tournament/storage.test.ts
 *
 * Unit tests for tournament persistence (BRKT-05).
 *
 * TDD Wave 0 — these tests are written BEFORE storage.ts exists and must
 * fail RED until Task 3 implements the module.
 *
 * Tests:
 *   1. TournamentState round-trips through JSON.stringify → safeParse with no data loss.
 *   2. Malformed raw string falls back safely (safeParse returns null).
 *   3. Mid-Bo5 state with games + fearlessUsed round-trips with full fidelity (resume).
 */

import { describe, it, expect } from "vitest";
import { TournamentStateSchema } from "./schema";
import type { TournamentState, TournamentTeam } from "./schema";
import { TOURNAMENT_STORAGE_KEY, saveTournament, loadTournament, clearTournament, projectForStorage } from "./storage";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeRosterEntry(role: string, id: string) {
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
  return {
    id,
    isUser,
    displayName: isUser ? "My Team" : `Bot Team ${id}`,
    roster: [
      makeRosterEntry("top", `${id}-top`),
      makeRosterEntry("jungle", `${id}-jungle`),
      makeRosterEntry("mid", `${id}-mid`),
      makeRosterEntry("adc", `${id}-adc`),
      makeRosterEntry("support", `${id}-support`),
    ],
  };
}

function makeMinimalSlots() {
  const slotIds = [
    "UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4",
    "UB_SF_1", "UB_SF_2", "UB_F",
    "LB_R1_1", "LB_R1_2", "LB_R2_1", "LB_R2_2",
    "LB_SF", "LB_F", "GF",
  ] as const;

  const slots: Record<string, { id: string; series: object }> = {};
  for (const id of slotIds) {
    slots[id] = {
      id,
      series: {
        status: "pending" as const,
        teamAId: null,
        teamBId: null,
        wins: {},
        games: [],
        winnerId: null,
        fearlessUsed: {},
      },
    };
  }
  return slots;
}

function makeMinimalState(): TournamentState {
  const teams: Record<string, TournamentTeam> = {
    user: makeTeam("user", true),
    "bot-0": makeTeam("bot-0", false),
    "bot-1": makeTeam("bot-1", false),
    "bot-2": makeTeam("bot-2", false),
    "bot-3": makeTeam("bot-3", false),
    "bot-4": makeTeam("bot-4", false),
    "bot-5": makeTeam("bot-5", false),
    "bot-6": makeTeam("bot-6", false),
  };

  const slots = makeMinimalSlots();
  // Set UB_QF slots as ready with seeded teams
  const seeding = ["user", "bot-0", "bot-1", "bot-2", "bot-3", "bot-4", "bot-5", "bot-6"];
  slots["UB_QF_1"].series = { ...slots["UB_QF_1"].series, status: "ready", teamAId: seeding[0], teamBId: seeding[1] };
  slots["UB_QF_2"].series = { ...slots["UB_QF_2"].series, status: "ready", teamAId: seeding[2], teamBId: seeding[3] };
  slots["UB_QF_3"].series = { ...slots["UB_QF_3"].series, status: "ready", teamAId: seeding[4], teamBId: seeding[5] };
  slots["UB_QF_4"].series = { ...slots["UB_QF_4"].series, status: "ready", teamAId: seeding[6], teamBId: seeding[7] };

  return {
    version: 1,
    seed: 12345,
    status: "active",
    teams,
    initialSeeding: seeding,
    slots: slots as TournamentState["slots"],
    activeSlotId: null,
    userTeamId: "user",
    championId: null,
  };
}

// ---------------------------------------------------------------------------
// BRKT-05: Round-trip serialization
// ---------------------------------------------------------------------------

describe("TournamentState round-trip (BRKT-05)", () => {
  it("JSON.stringify → JSON.parse → TournamentStateSchema.safeParse succeeds", () => {
    const original = makeMinimalState();
    const serialized = JSON.stringify(original);
    const parsed = JSON.parse(serialized);
    const result = TournamentStateSchema.safeParse(parsed);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(1);
      expect(result.data.seed).toBe(12345);
      expect(Object.keys(result.data.slots)).toHaveLength(14);
      expect(Object.keys(result.data.teams)).toHaveLength(8);
    }
  });

  it("serialized state deep-equals original after round-trip", () => {
    const original = makeMinimalState();
    const serialized = JSON.stringify(original);
    const parsed = JSON.parse(serialized);
    const result = TournamentStateSchema.safeParse(parsed);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(JSON.stringify(result.data)).toBe(serialized);
    }
  });

  it("TOURNAMENT_STORAGE_KEY is 'lolseteazero:tournament'", () => {
    expect(TOURNAMENT_STORAGE_KEY).toBe("lolseteazero:tournament");
  });
});

// ---------------------------------------------------------------------------
// BRKT-05: Tampered save fallback
// ---------------------------------------------------------------------------

describe("Tampered/malformed save fallback (BRKT-05)", () => {
  it("malformed string '{\"version\":1,\"slots\":null}' → safeParse fails", () => {
    const tampered = '{"version":1,"slots":null}';
    const parsed = JSON.parse(tampered);
    const result = TournamentStateSchema.safeParse(parsed);
    expect(result.success).toBe(false);
  });

  it("completely invalid JSON string → safeParse fails", () => {
    const invalid = "not-json-at-all";
    let result;
    try {
      const parsed = JSON.parse(invalid);
      result = TournamentStateSchema.safeParse(parsed);
    } catch {
      // JSON.parse throws — this should be caught by the storage deserialize
      result = { success: false };
    }
    expect(result.success).toBe(false);
  });

  it("clearTournament → loadTournament returns null", () => {
    clearTournament();
    const loaded = loadTournament();
    expect(loaded).toBeNull();
  });

  it("saveTournament + loadTournament round-trips correctly", () => {
    const state = makeMinimalState();
    clearTournament();
    saveTournament(state);
    const loaded = loadTournament();
    expect(loaded).not.toBeNull();
    if (loaded) {
      expect(loaded.version).toBe(1);
      expect(loaded.seed).toBe(12345);
    }
  });
});

// ---------------------------------------------------------------------------
// BRKT-05: Resume mid-Bo5 (fearlessUsed + games preserved)
// ---------------------------------------------------------------------------

describe("Resume mid-Bo5 (BRKT-05)", () => {
  it("mid-series state with games and fearlessUsed round-trips with full fidelity", () => {
    const base = makeMinimalState();

    // Simulate a state mid-Bo5: score 2-0, 2 games played, fearlessUsed populated
    const midSeriesState: TournamentState = {
      ...base,
      slots: {
        ...base.slots,
        UB_QF_1: {
          ...base.slots["UB_QF_1"],
          series: {
            ...base.slots["UB_QF_1"].series,
            status: "in_progress",
            teamAId: "user",
            teamBId: "bot-0",
            wins: { user: 2, "bot-0": 0 },
            games: [
              {
                seed: 111,
                winnerId: "user",
                events: [],
                totalPlaybackMs: 1800000,
                champions: {
                  teamA: { "user-mid": "syndra", "user-adc": "jhin" },
                  teamB: { "bot-0-mid": "orianna", "bot-0-adc": "caitlyn" },
                },
              },
              {
                seed: 222,
                winnerId: "user",
                events: [],
                totalPlaybackMs: 2100000,
                champions: {
                  teamA: { "user-mid": "zed", "user-adc": "ezreal" },
                  teamB: { "bot-0-mid": "viktor", "bot-0-adc": "jinx" },
                },
              },
            ],
            winnerId: null,
            fearlessUsed: {
              "user-mid": ["syndra", "zed"],
              "user-adc": ["jhin", "ezreal"],
              "bot-0-mid": ["orianna", "viktor"],
              "bot-0-adc": ["caitlyn", "jinx"],
            },
          },
        },
      },
    };

    const serialized = JSON.stringify(midSeriesState);
    const parsed = JSON.parse(serialized);
    const result = TournamentStateSchema.safeParse(parsed);

    expect(result.success).toBe(true);
    if (result.success) {
      const resumedSlot = result.data.slots["UB_QF_1"].series;
      // games.length preserved
      expect(resumedSlot.games).toHaveLength(2);
      // fearlessUsed preserved
      expect(resumedSlot.fearlessUsed["user-mid"]).toEqual(["syndra", "zed"]);
      expect(resumedSlot.fearlessUsed["user-adc"]).toEqual(["jhin", "ezreal"]);
      // wins preserved
      expect(resumedSlot.wins["user"]).toBe(2);
      expect(resumedSlot.wins["bot-0"]).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Quota guard: projectForStorage strips event timelines (QuotaExceededError fix)
// ---------------------------------------------------------------------------

describe("projectForStorage (LocalStorage quota guard)", () => {
  function stateWithGame(): TournamentState {
    const base = makeMinimalState();
    return {
      ...base,
      slots: {
        ...base.slots,
        UB_QF_1: {
          ...base.slots["UB_QF_1"],
          series: {
            ...base.slots["UB_QF_1"].series,
            status: "in_progress",
            teamAId: "user",
            teamBId: "bot-0",
            wins: { user: 1, "bot-0": 0 },
            games: [
              {
                seed: 999,
                winnerId: "user",
                userFrameTeamId: "user",
                totalPlaybackMs: 1800000,
                chaosLevel: 0.4,
                champions: {
                  teamA: { "user-mid": "syndra" },
                  teamB: { "bot-0-mid": "orianna" },
                },
                // A heavy timeline — the thing that blows past the ~5MB quota.
                events: Array.from({ length: 50 }, (_, i) => ({
                  gameTimeMs: i * 1000,
                  playbackMs: i * 100,
                  type: "kill" as const,
                  team: "user" as const,
                  winProbAfter: 0.5,
                })),
              },
            ],
            winnerId: null,
            fearlessUsed: {},
          },
        },
      },
    };
  }

  it("strips game events but keeps seed, champions, chaosLevel and winner", () => {
    const projected = projectForStorage(stateWithGame());
    const game = projected.slots["UB_QF_1"].series.games[0];

    expect(game.events).toEqual([]); // timeline removed → fits the quota
    expect(game.seed).toBe(999); // re-simulation inputs preserved
    expect(game.chaosLevel).toBe(0.4);
    expect(game.winnerId).toBe("user");
    expect(game.champions.teamA["user-mid"]).toBe("syndra");
    expect(game.totalPlaybackMs).toBe(1800000);
  });

  it("does not mutate the in-memory state (events still present for this session)", () => {
    const original = stateWithGame();
    projectForStorage(original);
    expect(original.slots["UB_QF_1"].series.games[0].events).toHaveLength(50);
  });

  it("projected state still passes the schema (valid save)", () => {
    const projected = projectForStorage(stateWithGame());
    expect(TournamentStateSchema.safeParse(projected).success).toBe(true);
  });
});
