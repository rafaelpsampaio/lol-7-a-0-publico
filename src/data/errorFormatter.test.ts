/**
 * src/data/errorFormatter.test.ts
 *
 * Tests for formatZodErrors — SUCCESS CRITERION 2:
 * A deliberate error in players.json must produce a readable message
 * that names the offending card (by id) and field name.
 */

import { describe, it, expect } from "vitest";
import { formatZodErrors } from "./errorFormatter";
import { PlayerDatabaseSchema } from "./schema";

// ---------------------------------------------------------------------------
// Helpers — build a valid card to use as base, then mutate fields to break it
// ---------------------------------------------------------------------------

function validCard(overrides: Record<string, unknown> = {}) {
  return {
    id: "bad-player",
    personId: "bad",
    displayName: "Bad Player 2020",
    year: 2020,
    roles: ["mid"],
    primaryRole: "mid",
    roleStrength: { top: 0, jungle: 0, mid: 70, adc: 0, support: 0 },
    lanePhase: 70,
    midGame: 70,
    lateGame: 70,
    traits: [],
    championPool: [
      { championId: "zed", mastery: 5 },
      { championId: "leblanc", mastery: 4 },
      { championId: "orianna", mastery: 4 },
      { championId: "ryze", mastery: 3 },
      { championId: "twisted-fate", mastery: 3 },
      { championId: "galio", mastery: 2 },
      { championId: "corki", mastery: 2 },
      { championId: "cassiopeia", mastery: 1 },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// lateGame out-of-range (105 exceeds max 100)
// ---------------------------------------------------------------------------

describe("formatZodErrors — lateGame out-of-range", () => {
  it("includes the card id 'bad-player' in the message", () => {
    const raw = { players: [validCard({ lateGame: 105 })] };
    const result = PlayerDatabaseSchema.safeParse(raw);
    expect(result.success).toBe(false);

    const messages = formatZodErrors(result.error!, raw);
    expect(messages.length).toBeGreaterThan(0);

    const combined = messages.join("\n");
    expect(combined).toContain("bad-player");
  });

  it("includes the field name 'lateGame' in the message", () => {
    const raw = { players: [validCard({ lateGame: 105 })] };
    const result = PlayerDatabaseSchema.safeParse(raw);

    const messages = formatZodErrors(result.error!, raw);
    const combined = messages.join("\n");
    expect(combined).toContain("lateGame");
  });

  it("each message mentions both card id and field", () => {
    const raw = { players: [validCard({ lateGame: 105 })] };
    const result = PlayerDatabaseSchema.safeParse(raw);

    const messages = formatZodErrors(result.error!, raw);
    // At least one message should mention both
    const relevantMsg = messages.find(
      (m) => m.includes("lateGame") && m.includes("bad-player")
    );
    expect(relevantMsg).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// championPool too small (6 entries — min is 8)
// ---------------------------------------------------------------------------

describe("formatZodErrors — championPool too small", () => {
  const smallPool = [
    { championId: "zed", mastery: 5 },
    { championId: "leblanc", mastery: 4 },
    { championId: "orianna", mastery: 4 },
    { championId: "ryze", mastery: 3 },
    { championId: "twisted-fate", mastery: 3 },
    { championId: "galio", mastery: 2 },
  ] as const;

  it("includes the card id 'bad-player' in the message", () => {
    const raw = { players: [validCard({ championPool: [...smallPool] })] };
    const result = PlayerDatabaseSchema.safeParse(raw);
    expect(result.success).toBe(false);

    const messages = formatZodErrors(result.error!, raw);
    const combined = messages.join("\n");
    expect(combined).toContain("bad-player");
  });

  it("includes the field name 'championPool' in the message", () => {
    const raw = { players: [validCard({ championPool: [...smallPool] })] };
    const result = PlayerDatabaseSchema.safeParse(raw);

    const messages = formatZodErrors(result.error!, raw);
    const combined = messages.join("\n");
    expect(combined).toContain("championPool");
  });

  it("message references the 8-champion requirement", () => {
    const raw = { players: [validCard({ championPool: [...smallPool] })] };
    const result = PlayerDatabaseSchema.safeParse(raw);

    const messages = formatZodErrors(result.error!, raw);
    const combined = messages.join("\n");
    // The schema error message contains '8'
    expect(combined).toMatch(/8/);
  });
});

// ---------------------------------------------------------------------------
// Fallback: card id cannot be resolved (rawData not provided)
// ---------------------------------------------------------------------------

describe("formatZodErrors — fallback when rawData missing", () => {
  it("falls back to 'index N' when rawData is not provided", () => {
    const raw = { players: [validCard({ lateGame: 105 })] };
    const result = PlayerDatabaseSchema.safeParse(raw);

    // Call WITHOUT rawData
    const messages = formatZodErrors(result.error!);
    const combined = messages.join("\n");
    // Without rawData, should say "index 0" (not throw)
    expect(combined).toContain("index 0");
  });

  it("never throws on a well-formed ZodError", () => {
    const raw = { players: [validCard({ lateGame: 105 })] };
    const result = PlayerDatabaseSchema.safeParse(raw);

    expect(() => formatZodErrors(result.error!)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Return type: array of strings, one per issue
// ---------------------------------------------------------------------------

describe("formatZodErrors — return contract", () => {
  it("returns an array of strings", () => {
    const raw = { players: [validCard({ lateGame: 105 })] };
    const result = PlayerDatabaseSchema.safeParse(raw);

    const messages = formatZodErrors(result.error!, raw);
    expect(Array.isArray(messages)).toBe(true);
    messages.forEach((m) => expect(typeof m).toBe("string"));
  });
});
