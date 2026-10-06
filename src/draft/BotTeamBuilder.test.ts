/**
 * src/draft/BotTeamBuilder.test.ts
 *
 * Tests for BotTeamBuilder.buildRoster() — DRFT-04 (5-role roster via RivalInterface),
 * determinism, D-03/D-07 (excludedPersonIds, no personId repeats, weighted picks).
 */

import { describe, it, expect, afterEach } from "vitest";
import type { PlayerVersion, Role } from "../data/schema";
import { BotTeamBuilder } from "./BotTeamBuilder";
import type { Roster } from "./types";

// ---------------------------------------------------------------------------
// Fixture helper — shared with orchestrator.test.ts (reusable makePlayer)
// ---------------------------------------------------------------------------

const BASE_CHAMPION_POOL = [
  { championId: "aatrox", mastery: 4 as const },
  { championId: "camille", mastery: 3 as const },
  { championId: "garen", mastery: 2 as const },
  { championId: "darius", mastery: 5 as const },
  { championId: "fiora", mastery: 3 as const },
  { championId: "grasp", mastery: 1 as const },
  { championId: "malphite", mastery: 2 as const },
  { championId: "riven", mastery: 4 as const },
];

function makePlayer(role: Role, overrides: Partial<PlayerVersion> = {}): PlayerVersion {
  const personId = overrides.personId ?? `person-${role}`;
  return {
    id: overrides.id ?? `${personId}-2020`,
    personId,
    displayName: overrides.displayName ?? `Player ${role} 2020`,
    year: 2020,
    roles: [role],
    primaryRole: role,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: 80 },
    lanePhase: 75,
    midGame: 70,
    lateGame: 65,
    traits: [],
    championPool: BASE_CHAMPION_POOL,
    ...overrides,
  };
}

function makePlayers(): PlayerVersion[] {
  return [
    makePlayer("top", { id: "zeus-2022", personId: "zeus", roleStrength: { top: 85, jungle: 0, mid: 0, adc: 0, support: 0 } }),
    makePlayer("top", { id: "khan-2018", personId: "khan", roleStrength: { top: 78, jungle: 0, mid: 0, adc: 0, support: 0 } }),
    makePlayer("jungle", { id: "bengi-2015", personId: "bengi", roleStrength: { top: 0, jungle: 82, mid: 0, adc: 0, support: 0 } }),
    makePlayer("jungle", { id: "canyon-2021", personId: "canyon", roleStrength: { top: 0, jungle: 90, mid: 0, adc: 0, support: 0 } }),
    makePlayer("mid", { id: "faker-2016", personId: "faker", roleStrength: { top: 0, jungle: 0, mid: 96, adc: 0, support: 0 } }),
    makePlayer("mid", { id: "caps-2019", personId: "caps", roleStrength: { top: 0, jungle: 0, mid: 88, adc: 0, support: 0 } }),
    makePlayer("adc", { id: "uzi-2018", personId: "uzi", roleStrength: { top: 0, jungle: 0, mid: 0, adc: 93, support: 0 } }),
    makePlayer("adc", { id: "ruler-2022", personId: "ruler", roleStrength: { top: 0, jungle: 0, mid: 0, adc: 87, support: 0 } }),
    makePlayer("support", { id: "wolf-2016", personId: "wolf", roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 79 } }),
    makePlayer("support", { id: "beryl-2021", personId: "beryl", roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 84 } }),
  ];
}

afterEach(() => {
  // BotTeamBuilder has no shared state, but keep the pattern per PATTERNS.md
});

// ---------------------------------------------------------------------------
// DRFT-04: buildRoster fills all 5 roles
// ---------------------------------------------------------------------------

describe("BotTeamBuilder — DRFT-04 (5-role roster via RivalInterface)", () => {
  it("buildRoster returns a Roster with all 5 roles filled", () => {
    const builder = new BotTeamBuilder();
    const players = makePlayers();
    const roster = builder.buildRoster(players, 42);

    const roles: Role[] = ["top", "jungle", "mid", "adc", "support"];
    for (const role of roles) {
      expect(roster[role]).toBeDefined();
      expect(roster[role].primaryRole).toBe(role);
    }
  });

  it("all 5 roles in the returned roster have distinct personIds", () => {
    const builder = new BotTeamBuilder();
    const roster = builder.buildRoster(makePlayers(), 7);

    const personIds = (["top", "jungle", "mid", "adc", "support"] as Role[]).map(
      (r) => roster[r].personId
    );
    const unique = new Set(personIds);
    expect(personIds.length).toBe(unique.size);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("BotTeamBuilder — determinism", () => {
  it("same seed produces an identical roster on two calls", () => {
    const builder = new BotTeamBuilder();
    const players = makePlayers();

    const roster1 = builder.buildRoster(players, 7);
    const roster2 = builder.buildRoster(players, 7);

    expect(roster1).toEqual(roster2);
  });

  it("different seeds may produce different rosters", () => {
    // Not guaranteed to differ on every pair, but seeds 7 and 99 almost certainly will
    const builder = new BotTeamBuilder();
    const players = makePlayers();

    const roster1 = builder.buildRoster(players, 7);
    const roster2 = builder.buildRoster(players, 99);

    // Extract the full set of player IDs to compare
    const ids1 = (["top", "jungle", "mid", "adc", "support"] as Role[])
      .map((r) => roster1[r].id)
      .join(",");
    const ids2 = (["top", "jungle", "mid", "adc", "support"] as Role[])
      .map((r) => roster2[r].id)
      .join(",");

    // With 2 choices per role across 5 roles the chance of identical output is 2^-5 = 3%
    // We pick seeds known to differ; if this flakes, pick a larger seed pair
    expect(ids1).not.toBe(ids2);
  });
});

// ---------------------------------------------------------------------------
// D-03/D-07: excludedPersonIds respected, no personId repeats in bot roster
// ---------------------------------------------------------------------------

describe("BotTeamBuilder — D-03 (excludedPersonIds)", () => {
  it("excluded personIds are never picked in the bot roster", () => {
    const builder = new BotTeamBuilder();
    const players = makePlayers();
    // Exclude the strongest mid and one adc
    const excluded = new Set<string>(["faker", "uzi"]);

    for (let seed = 1; seed <= 20; seed++) {
      const roster = builder.buildRoster(players, seed, excluded);
      const personIds = (["top", "jungle", "mid", "adc", "support"] as Role[]).map(
        (r) => roster[r].personId
      );
      expect(personIds).not.toContain("faker");
      expect(personIds).not.toContain("uzi");
    }
  });
});

// ---------------------------------------------------------------------------
// D-07: weighted pick — stronger candidates picked more often
// ---------------------------------------------------------------------------

describe("BotTeamBuilder — D-07 (weighted pick by roleStrength)", () => {
  it("the stronger top candidate is selected more often than the weaker one across many seeds", () => {
    // zeus (roleStrength.top = 85) should beat khan (78) by frequency
    const builder = new BotTeamBuilder();
    const players = makePlayers();
    const SAMPLE_SIZE = 200;

    let zeusCount = 0;
    let khanCount = 0;

    for (let seed = 0; seed < SAMPLE_SIZE; seed++) {
      const roster = builder.buildRoster(players, seed);
      if (roster.top.personId === "zeus") zeusCount++;
      if (roster.top.personId === "khan") khanCount++;
    }

    // zeus (strength 85+1=86) vs khan (strength 78+1=79), ratio ≈ 52/48
    // Over 200 seeds, zeus should win strictly more than khan
    expect(zeusCount).toBeGreaterThan(khanCount);
  });
});

describe("BotTeamBuilder: A-01 (excludedCardIds)", () => {
  it("cartas excluidas nunca entram no roster do bot", () => {
    const builder = new BotTeamBuilder();
    const players = makePlayers();
    const topIds = players.filter((p) => p.primaryRole === "top").map((p) => p.id);
    const excluidas = new Set(topIds.slice(0, -1)); // sobra so uma carta de top
    for (let seed = 1; seed <= 20; seed++) {
      const roster = builder.buildRoster(players, seed, new Set(), excluidas);
      expect(excluidas.has(roster.top.id)).toBe(false);
    }
  });
});
