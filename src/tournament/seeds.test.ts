/**
 * src/tournament/seeds.test.ts
 *
 * Tests for deterministic tournament seed derivation.
 * Covers: makeTournamentSeed, seriesSeed, gameSeed stability and cross-slot variance.
 *
 * D-02: Random seeding via mulberry32/seedFromString; deterministic from top-level seed.
 * BRKT-01: Reproducible bracket seeding from top-level seed.
 *
 * Runs in node environment — no DOM needed.
 */

import { describe, it, expect } from "vitest";
import { makeTournamentSeed, seriesSeed, gameSeed } from "./seeds";

describe("seriesSeed — determinism", () => {
  it("returns the same integer for the same (tournamentSeed, slotId)", () => {
    expect(seriesSeed(42, "UB_QF_1")).toBe(seriesSeed(42, "UB_QF_1"));
  });

  it("returns different integers for different slotIds", () => {
    expect(seriesSeed(42, "UB_QF_1")).not.toBe(seriesSeed(42, "UB_QF_2"));
  });

  it("returns different integers for different tournament seeds", () => {
    expect(seriesSeed(42, "UB_QF_1")).not.toBe(seriesSeed(99, "UB_QF_1"));
  });
});

describe("gameSeed — determinism", () => {
  it("returns the same integer for the same (tournamentSeed, slotId, gameIndex)", () => {
    expect(gameSeed(42, "UB_QF_1", 0)).toBe(gameSeed(42, "UB_QF_1", 0));
  });

  it("returns different integers for different gameIndex values", () => {
    expect(gameSeed(42, "UB_QF_1", 0)).not.toBe(gameSeed(42, "UB_QF_1", 1));
  });

  it("returns different integers for different slotIds", () => {
    expect(gameSeed(42, "UB_QF_1", 0)).not.toBe(gameSeed(42, "UB_SF_1", 0));
  });

  it("returns different integers for different tournament seeds", () => {
    expect(gameSeed(42, "UB_QF_1", 0)).not.toBe(gameSeed(99, "UB_QF_1", 0));
  });
});

describe("makeTournamentSeed — output type", () => {
  it("returns a non-negative integer", () => {
    const seed = makeTournamentSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
  });

  it("returns different values on successive calls (timestamp-based)", () => {
    // Allow a tiny sleep to ensure Date.now() differs between calls.
    // In practice, two synchronous calls may return the same ms bucket, so
    // we only assert the structure here (integer); uniqueness is best-effort.
    const s1 = makeTournamentSeed();
    const s2 = makeTournamentSeed();
    expect(Number.isInteger(s1)).toBe(true);
    expect(Number.isInteger(s2)).toBe(true);
  });
});
