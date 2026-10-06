/**
 * src/draft/orchestrator.test.ts
 *
 * Tests for generateRound() — DRFT-01 (one candidate per open role),
 * DRFT-02 (person-uniqueness enforcement), D-06 (within-round personId de-dup).
 */

import { describe, it, expect } from "vitest";
import type { PlayerVersion, Role } from "../data/schema";
import { generateRound, ALL_ROLES } from "./orchestrator";

// ---------------------------------------------------------------------------
// Fixture helper — reusable across draft + sim tests.
// Reexportado a partir de um modulo neutro (fora de qualquer *.test.ts) para
// que consumidores no grafo de build (golden/fixtures.ts) nao arrastem este
// arquivo de teste para o tsc. Os demais *.test.ts seguem importando daqui.
// ---------------------------------------------------------------------------

export { makePlayer } from "../__tests__/helpers/makePlayer";
import { makePlayer } from "../__tests__/helpers/makePlayer";

// ---------------------------------------------------------------------------
// Test data: two players per role = 10 total cards
// ---------------------------------------------------------------------------

function makePlayers(): PlayerVersion[] {
  return [
    makePlayer("top", { id: "zeus-2022", personId: "zeus", displayName: "Zeus 2022", roleStrength: { top: 85, jungle: 0, mid: 0, adc: 0, support: 0 } }),
    makePlayer("top", { id: "khan-2018", personId: "khan", displayName: "Khan 2018", roleStrength: { top: 78, jungle: 0, mid: 0, adc: 0, support: 0 } }),
    makePlayer("jungle", { id: "bengi-2015", personId: "bengi", displayName: "Bengi 2015", roleStrength: { top: 0, jungle: 82, mid: 0, adc: 0, support: 0 } }),
    makePlayer("jungle", { id: "canyon-2021", personId: "canyon", displayName: "Canyon 2021", roleStrength: { top: 0, jungle: 90, mid: 0, adc: 0, support: 0 } }),
    makePlayer("mid", { id: "faker-2016", personId: "faker", displayName: "Faker 2016", roleStrength: { top: 0, jungle: 0, mid: 96, adc: 0, support: 0 } }),
    makePlayer("mid", { id: "caps-2019", personId: "caps", displayName: "Caps 2019", roleStrength: { top: 0, jungle: 0, mid: 88, adc: 0, support: 0 } }),
    makePlayer("adc", { id: "uzi-2018", personId: "uzi", displayName: "Uzi 2018", roleStrength: { top: 0, jungle: 0, mid: 0, adc: 93, support: 0 } }),
    makePlayer("adc", { id: "ruler-2022", personId: "ruler", displayName: "Ruler 2022", roleStrength: { top: 0, jungle: 0, mid: 0, adc: 87, support: 0 } }),
    makePlayer("support", { id: "wolf-2016", personId: "wolf", displayName: "Wolf 2016", roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 79 } }),
    makePlayer("support", { id: "beryl-2021", personId: "beryl", displayName: "Beryl 2021", roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 84 } }),
  ];
}

// Deterministic seeded RNG (mulberry32 step)
function makeRng(seed: number): () => number {
  let a = seed;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// DRFT-01: one candidate per open role
// ---------------------------------------------------------------------------

describe("generateRound — DRFT-01 (one candidate per open role)", () => {
  it("returns exactly one candidate per open role when all 5 roles are open", () => {
    const players = makePlayers();
    const filledRoles = new Set<Role>();
    const usedPersonIds = new Set<string>();
    const rng = makeRng(42);

    const result = generateRound(players, filledRoles, usedPersonIds, rng);

    const resultRoles = Object.keys(result) as Role[];
    expect(resultRoles.length).toBe(5);
    expect(resultRoles).toContain("top");
    expect(resultRoles).toContain("jungle");
    expect(resultRoles).toContain("mid");
    expect(resultRoles).toContain("adc");
    expect(resultRoles).toContain("support");

    // Each value must be a PlayerVersion with the correct primaryRole
    for (const role of resultRoles) {
      expect(result[role as Role]!.primaryRole).toBe(role);
    }
  });

  it("returns candidates only for the 2 remaining open roles when 3 roles are filled", () => {
    const players = makePlayers();
    const filledRoles = new Set<Role>(["top", "jungle", "mid"]);
    const usedPersonIds = new Set<string>();
    const rng = makeRng(7);

    const result = generateRound(players, filledRoles, usedPersonIds, rng);

    const resultRoles = Object.keys(result) as Role[];
    expect(resultRoles.length).toBe(2);
    expect(resultRoles).toContain("adc");
    expect(resultRoles).toContain("support");
    expect(resultRoles).not.toContain("top");
    expect(resultRoles).not.toContain("jungle");
    expect(resultRoles).not.toContain("mid");
  });
});

// ---------------------------------------------------------------------------
// D-06: within-round personId de-duplication
// ---------------------------------------------------------------------------

describe("generateRound — D-06 (within-round personId uniqueness)", () => {
  it("no two role candidates in the same round share the same personId", () => {
    // Create players where some share personId across roles (shouldn't happen
    // in practice per D-01 but test the guard)
    const sharedPersonPlayer1 = makePlayer("top", {
      id: "rafael-2014-top",
      personId: "rafael",
      displayName: "Rafael Top 2014",
    });
    const sharedPersonPlayer2 = makePlayer("mid", {
      id: "rafael-2014-mid",
      personId: "rafael",
      displayName: "Rafael Mid 2014",
    });
    const players = [
      sharedPersonPlayer1,
      sharedPersonPlayer2,
      makePlayer("jungle", { id: "j-1", personId: "jungler1" }),
      makePlayer("adc", { id: "a-1", personId: "adcer1" }),
      makePlayer("support", { id: "s-1", personId: "supporter1" }),
    ];
    const rng = makeRng(99);
    const result = generateRound(players, new Set(), new Set(), rng);

    const personIds = Object.values(result).map((p) => p.personId);
    const uniquePersonIds = new Set(personIds);
    expect(personIds.length).toBe(uniquePersonIds.size);
  });
});

// ---------------------------------------------------------------------------
// DRFT-02: personId exclusion across rounds
// ---------------------------------------------------------------------------

describe("generateRound — DRFT-02 (personId exclusion across rounds)", () => {
  it("a personId placed in usedPersonIds never appears in a subsequent round's candidates", () => {
    const players = makePlayers();
    // Simulate that "faker" was already picked in a previous round
    const usedPersonIds = new Set<string>(["faker", "uzi"]);
    const filledRoles = new Set<Role>();

    // Run many rounds to ensure the exclusion holds
    for (let i = 0; i < 10; i++) {
      const result = generateRound(players, filledRoles, usedPersonIds, makeRng(i * 100 + 1));
      const candidatePersonIds = Object.values(result).map((p) => p.personId);
      expect(candidatePersonIds).not.toContain("faker");
      expect(candidatePersonIds).not.toContain("uzi");
    }
  });

  it("ALL_ROLES contains all 5 expected roles", () => {
    expect(ALL_ROLES).toHaveLength(5);
    expect(ALL_ROLES).toContain("top");
    expect(ALL_ROLES).toContain("jungle");
    expect(ALL_ROLES).toContain("mid");
    expect(ALL_ROLES).toContain("adc");
    expect(ALL_ROLES).toContain("support");
  });
});

// ---------------------------------------------------------------------------
// DRFT: soft-discard of already-shown cards (seenCardIds)
// ---------------------------------------------------------------------------

describe("generateRound — DRFT soft-discard (seenCardIds)", () => {
  it("does not show a seen card again while the role has fresh alternatives", () => {
    const players = makePlayers(); // 2 cards per role
    // Mark Zeus (top) as already shown. With Khan still fresh, the next round's
    // top candidate must be Khan, never Zeus.
    const seen = new Set<string>(["zeus-2022"]);
    for (let i = 0; i < 20; i++) {
      const result = generateRound(
        players,
        new Set(),
        new Set(),
        makeRng(i * 31 + 5),
        seen
      );
      expect(result.top?.id).toBe("khan-2018");
    }
  });

  it("falls back to a seen card only when every fresh card is exhausted", () => {
    const players = makePlayers();
    // Both top cards seen → no fresh option remains, so the role must still be
    // filled (fallback) rather than dropped.
    const seen = new Set<string>(["zeus-2022", "khan-2018"]);
    const result = generateRound(
      players,
      new Set(),
      new Set(),
      makeRng(77),
      seen
    );
    expect(result.top).toBeDefined();
    expect(["zeus-2022", "khan-2018"]).toContain(result.top!.id);
  });

  it("a card discarded in one round does not return in the immediately next round", () => {
    const players = makePlayers();
    // Round 1: all roles open, record what was shown.
    const r1 = generateRound(players, new Set(), new Set(), makeRng(101));
    const seen = new Set<string>(Object.values(r1).map((p) => p!.id));
    // User picks MID (faker/caps — whichever was shown). Lock that role+person.
    const pickedMid = r1.mid!;
    const filled = new Set<Role>(["mid"]);
    const usedPersons = new Set<string>([pickedMid.personId]);
    // Round 2: the non-picked round-1 cards (top/jungle/adc/support) are seen,
    // so each of those roles must show its OTHER card now.
    const r2 = generateRound(players, filled, usedPersons, makeRng(202), seen);
    for (const role of ["top", "jungle", "adc", "support"] as Role[]) {
      if (r1[role] && r2[role]) {
        expect(r2[role]!.id).not.toBe(r1[role]!.id);
      }
    }
  });

  it("omitting seenCardIds keeps the legacy 4-arg call working", () => {
    const players = makePlayers();
    const result = generateRound(players, new Set(), new Set(), makeRng(9));
    expect(Object.keys(result).length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Empty pool graceful handling
// ---------------------------------------------------------------------------

describe("generateRound — empty pool (graceful omission)", () => {
  it("omits a role from the result when that role's candidate pool is empty (no crash)", () => {
    // Only top and mid players — no jungle, adc, support
    const players = [
      makePlayer("top", { id: "t1", personId: "top1" }),
      makePlayer("mid", { id: "m1", personId: "mid1" }),
    ];
    const rng = makeRng(55);
    const result = generateRound(players, new Set(), new Set(), rng);

    // Should have top and mid, but NOT jungle/adc/support (pool empty)
    expect(Object.keys(result)).toContain("top");
    expect(Object.keys(result)).toContain("mid");
    expect(Object.keys(result)).not.toContain("jungle");
    expect(Object.keys(result)).not.toContain("adc");
    expect(Object.keys(result)).not.toContain("support");
  });

  it("returns an empty object without crashing when all pools are empty", () => {
    const players: PlayerVersion[] = [];
    const rng = makeRng(1);
    // Should not throw
    expect(() => generateRound(players, new Set(), new Set(), rng)).not.toThrow();
    const result = generateRound(players, new Set(), new Set(), rng);
    expect(Object.keys(result)).toHaveLength(0);
  });
});
