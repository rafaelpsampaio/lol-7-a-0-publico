/**
 * src/data/starter.test.ts
 *
 * Validates that the starter players.json and typed template:
 *   1. Parse successfully through PlayerDatabaseSchema
 *   2. Collectively demonstrate every schema field
 *   3. Meet minimum pool requirements for fearless Bo5
 *
 * DATA-06: starter template demonstrates all fields; user can add a card in under 5 min.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { PlayerDatabaseSchema, type PlayerVersion } from "./schema";
import { starterPlayers } from "./starter-template";

// ---------------------------------------------------------------------------
// Helper — read players.json from disk (tests run in Node, not browser)
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadStarterJson(): unknown {
  const filePath = join(process.cwd(), "public", "players.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Suite 1: players.json parses through the schema
// ---------------------------------------------------------------------------
describe("public/players.json", () => {
  it("parses through PlayerDatabaseSchema with success: true", () => {
    const raw = loadStarterJson();
    const result = PlayerDatabaseSchema.safeParse(raw);
    if (!result.success) {
      // Surface friendly error if test fails
      const issues = result.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`
      );
      throw new Error(
        `Starter players.json failed schema validation:\n${issues.join("\n")}`
      );
    }
    expect(result.success).toBe(true);
  });

  it("contains at least 10 cards (2+ per role for Phase 2 draft)", () => {
    const raw = loadStarterJson() as { players: unknown[] };
    expect(raw.players.length).toBeGreaterThanOrEqual(10);
  });

  it("every card has a championPool of at least 8 entries", () => {
    const raw = loadStarterJson();
    const result = PlayerDatabaseSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      for (const card of result.data.players) {
        expect(card.championPool.length).toBeGreaterThanOrEqual(8);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 2: starter-template.ts typed objects pass schema validation
// ---------------------------------------------------------------------------
describe("starterPlayers (typed template)", () => {
  it("exports starterPlayers array with 3 entries", () => {
    expect(Array.isArray(starterPlayers)).toBe(true);
    expect(starterPlayers).toHaveLength(3);
  });

  it("passes PlayerDatabaseSchema.safeParse", () => {
    const result = PlayerDatabaseSchema.safeParse({ players: starterPlayers });
    if (!result.success) {
      const issues = result.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`
      );
      throw new Error(
        `starterPlayers failed schema validation:\n${issues.join("\n")}`
      );
    }
    expect(result.success).toBe(true);
  });

  it("every card has a championPool of at least 8 entries", () => {
    for (const card of starterPlayers) {
      expect(card.championPool.length).toBeGreaterThanOrEqual(8);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 3: demonstrates every field (behavioral coverage)
// ---------------------------------------------------------------------------
describe("starter collectively demonstrates every field", () => {
  let cards: PlayerVersion[];

  beforeAll(() => {
    const result = PlayerDatabaseSchema.safeParse({ players: starterPlayers });
    expect(result.success).toBe(true);
    if (result.success) {
      cards = result.data.players;
    }
  });

  it("includes at least one single-role card", () => {
    const hasSingleRole = cards.some((c) => c.roles.length === 1);
    expect(hasSingleRole).toBe(true);
  });

  it("includes at least one multi-role card (2+ roles)", () => {
    const hasMultiRole = cards.some((c) => c.roles.length >= 2);
    expect(hasMultiRole).toBe(true);
  });

  it("includes at least one card with exactly 2 traits", () => {
    const hasTwoTraits = cards.some((c) => c.traits.length === 2);
    expect(hasTwoTraits).toBe(true);
  });

  it("includes at least one card with fewer than 2 traits (shows 2 is a ceiling)", () => {
    const hasFewTraits = cards.some((c) => c.traits.length < 2);
    expect(hasFewTraits).toBe(true);
  });

  it("all five roleStrength keys present on every card", () => {
    const requiredKeys = ["top", "jungle", "mid", "adc", "support"] as const;
    for (const card of cards) {
      for (const key of requiredKeys) {
        expect(Object.prototype.hasOwnProperty.call(card.roleStrength, key)).toBe(true);
      }
    }
  });

  it("primaryRole is a member of each card's roles array", () => {
    for (const card of cards) {
      expect(card.roles).toContain(card.primaryRole);
    }
  });

  it("mastery spread across the pool includes values 1 through 5 in aggregate", () => {
    const allMasteries = cards.flatMap((c) => c.championPool.map((e) => e.mastery));
    expect(allMasteries).toContain(1);
    expect(allMasteries).toContain(2);
    expect(allMasteries).toContain(3);
    expect(allMasteries).toContain(4);
    expect(allMasteries).toContain(5);
  });
});
