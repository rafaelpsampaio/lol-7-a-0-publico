/**
 * scripts/calibrate.ts
 *
 * 1,000-match calibration harness (SIM-04 / D-11).
 * Run: npm run calibrate  (executes this file via the vitest runner)
 *
 * For each of three matchup tiers (D-08), runs 1,000 deterministic matches
 * across seeds 0..999, computes the user-team win rate, and prints PASS/FAIL
 * against the tier's target band ("telinha preta", D-11). The vitest run exits
 * non-zero if any tier FAILs so CI / the phase gate detects a miscalibrated
 * engine.
 *
 * Runner note (RESEARCH A7 / Environment Availability): the project uses
 * `moduleResolution: "bundler"` with extensionless imports, which Node's
 * `--experimental-strip-types` loader cannot resolve. The documented fallback
 * is to execute the harness through vitest, which honors the bundler config.
 *
 * IMPORTANT: seed = i per match (Pitfall 3) — never a shared seed.
 */

import { describe, it, expect } from "vitest";
import { runMatch } from "../src/sim/runMatch";
import type { MatchInput } from "../src/sim/types";
import type { PlayerVersion } from "../src/data/schema";

const MATCH_COUNT = 1000;
const DEFAULT_CHAOS_LEVEL = 0.25;

type Role = "top" | "jungle" | "mid" | "adc" | "support";
const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

// ---------------------------------------------------------------------------
// Tier definitions (D-08 / D-11 / RESEARCH Pattern 4)
// ---------------------------------------------------------------------------

interface Tier {
  name: string;
  label: string;
  userComp: number;
  rivalComp: number;
  targetMin: number;
  targetMax: number;
}

const TIERS: Tier[] = [
  { name: "dominant", label: "20+ pt gap", userComp: 90, rivalComp: 65, targetMin: 0.8, targetMax: 0.9 },
  { name: "competitive", label: "10-20 pt gap", userComp: 82, rivalComp: 67, targetMin: 0.67, targetMax: 0.78 },
  { name: "close", label: "0-10 pt gap", userComp: 75, rivalComp: 72, targetMin: 0.48, targetMax: 0.62 },
];

// ---------------------------------------------------------------------------
// Fixture builders — composite-driven (uniform stats → composite == value)
// ---------------------------------------------------------------------------

function makePlayer(id: string, role: Role, stat: number): PlayerVersion {
  return {
    id,
    personId: id,
    displayName: `Player ${id}`,
    year: 2023,
    roles: [role],
    primaryRole: role,
    lanePhase: stat,
    midGame: stat,
    lateGame: stat,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: stat },
    traits: [],
    championPool: Array.from({ length: 8 }, (_, i) => ({
      championId: `${id}-c${i + 1}`,
      mastery: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
    })),
  };
}

/**
 * Uniform-stat roster. Because scoreTeam weights sum to 1.0 per phase and the
 * composite is a convex combination of phases, a roster where every stat equals
 * `composite` yields exactly `composite` as the team composite score.
 */
function makeRoster(prefix: string, composite: number): PlayerVersion[] {
  return ROLES.map((role) => makePlayer(`${prefix}-${role}`, role, composite));
}

function makeChampionMap(roster: PlayerVersion[]): Record<string, string> {
  return Object.fromEntries(roster.map((p) => [p.id, `${p.id}-c1`]));
}

function makeInput(userComp: number, rivalComp: number): MatchInput {
  const userRoster = makeRoster("u", userComp);
  const rivalRoster = makeRoster("r", rivalComp);
  return {
    userRoster,
    rivalRoster,
    userChampions: makeChampionMap(userRoster),
    rivalChampions: makeChampionMap(rivalRoster),
    speedPreset: "fast",
  };
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function runTier(tier: Tier): { winRate: number; pass: boolean } {
  const input = makeInput(tier.userComp, tier.rivalComp);
  let wins = 0;
  for (let i = 0; i < MATCH_COUNT; i++) {
    const result = runMatch(input, i, DEFAULT_CHAOS_LEVEL); // seed = i (Pitfall 3)
    if (result.winner === "user") wins++;
  }
  const winRate = wins / MATCH_COUNT;
  const pass = winRate >= tier.targetMin && winRate <= tier.targetMax;
  return { winRate, pass };
}

// ---------------------------------------------------------------------------
// Calibration run — executed via the vitest runner (npm run calibrate).
// Prints the PASS/FAIL "telinha preta" output (D-11) and fails the run if any
// tier misses its band, which gives the non-zero exit code the phase gate needs.
// ---------------------------------------------------------------------------

describe("calibration harness (SIM-04 / D-11)", () => {
  it(`runs ${MATCH_COUNT} matches per tier and every tier hits its win-rate band`, () => {
    console.log(`\n=== Calibration Results (${MATCH_COUNT} matches per tier) ===`);
    const failures: string[] = [];
    for (const tier of TIERS) {
      const { winRate, pass } = runTier(tier);
      const status = pass ? "PASS" : "FAIL";
      console.log(
        `[${status}] ${tier.name} (${tier.label}): ${(winRate * 100).toFixed(1)}% ` +
          `(target ${(tier.targetMin * 100).toFixed(0)}-${(tier.targetMax * 100).toFixed(0)}%)`
      );
      if (!pass) {
        failures.push(
          `${tier.name}: ${(winRate * 100).toFixed(1)}% outside ` +
            `${(tier.targetMin * 100).toFixed(0)}-${(tier.targetMax * 100).toFixed(0)}%`
        );
      }
    }
    console.log("");
    expect(failures, failures.join("; ")).toEqual([]);
  });
});
