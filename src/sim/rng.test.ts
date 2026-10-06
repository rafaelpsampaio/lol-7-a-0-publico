/**
 * src/sim/rng.test.ts
 *
 * Tests for mulberry32 seeded PRNG and seedFromString hash.
 * Covers determinism, range correctness, and string-seed stability.
 *
 * Runs in node environment — no DOM needed.
 */

import { describe, it, expect } from "vitest";
import { mulberry32, seedFromString } from "./rng";

describe("mulberry32 seeded RNG — determinism", () => {
  it("produces the same sequence for the same seed", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    expect(rng1()).toBe(rng2());
    expect(rng1()).toBe(rng2());
    expect(rng1()).toBe(rng2());
  });

  it("produces different first values for different seeds", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(43);
    expect(rng1()).not.toBe(rng2());
  });
});

describe("mulberry32 seeded RNG — output range", () => {
  it("produces 100 consecutive values all in [0, 1)", () => {
    const rng = mulberry32(1234);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("seedFromString — stability", () => {
  it("returns the same integer for the same string", () => {
    expect(seedFromString("hello")).toBe(seedFromString("hello"));
    expect(seedFromString("faker-2016")).toBe(seedFromString("faker-2016"));
  });

  it("returns different integers for different strings", () => {
    expect(seedFromString("hello")).not.toBe(seedFromString("world"));
  });

  it("returns a non-negative 32-bit integer", () => {
    const seed = seedFromString("test-string");
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(seed)).toBe(true);
  });
});
