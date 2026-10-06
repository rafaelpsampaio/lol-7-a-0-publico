/**
 * src/sim/rng.ts
 *
 * Seeded deterministic PRNG (mulberry32) + string-to-seed hash (seedFromString).
 *
 * IMPORTANT: Simulation and bot code must NEVER call Math.random() directly.
 * Always use mulberry32(seed) to obtain a seeded RNG function for reproducible results.
 *
 * Source: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */

/**
 * Returns a seeded PRNG function. Each call to the returned function
 * yields a float in [0, 1) — deterministic given the same seed.
 *
 * Usage:
 *   const rng = mulberry32(42);
 *   const value = rng(); // always the same for seed 42
 */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hashes a string to a 32-bit unsigned integer seed.
 * Same string always returns the same integer; different strings differ.
 *
 * Uses FNV-1a algorithm for good distribution.
 *
 * Usage:
 *   const seed = seedFromString("match-round-1");
 *   const rng = mulberry32(seed);
 */
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}
