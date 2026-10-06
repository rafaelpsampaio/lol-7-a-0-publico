/**
 * src/sim/scenarios.test.ts
 *
 * Phase 8 — scenario coverage in the normal test run (a light slice of the
 * heavier scripts/calibrate-engine.ts harness). Asserts the match texture
 * (stomp / balanced / comeback all occur) and the negative rules end-to-end.
 */

import { describe, it, expect } from "vitest";
import { makePlayer } from "../draft/orchestrator.test";
import { mulberry32 } from "./rng";
import { simulateMatch } from "./engine";
import { ROLES } from "./matchState";
import type { PlayerVersion } from "../data/schema";
import type { SimulationResult } from "./engine";

function roster(prefix: string, s: number): PlayerVersion[] {
  return ROLES.map((r) =>
    makePlayer(r, {
      id: `${prefix}-${r}`,
      personId: `${prefix}-${r}`,
      displayName: `${prefix}-${r} 2024`,
      lanePhase: s,
      midGame: s,
      lateGame: s,
    })
  );
}

/** Winner's lowest win probability across the timeline (in winner frame). */
function winnerMin(res: SimulationResult): number {
  let m = 1;
  for (const ev of res.timeline) {
    const wp = res.winner === "user" ? ev.winProbUserAfter : 1 - ev.winProbUserAfter;
    m = Math.min(m, wp);
  }
  return m;
}

describe("scenarios — match texture", () => {
  it("dominant matchups produce stomps (winner rarely trailed)", () => {
    let stomps = 0;
    for (let s = 0; s < 40; s++) {
      const res = simulateMatch(roster("u", 84), roster("r", 58), mulberry32(s));
      if (winnerMin(res) >= 0.42) stomps++;
    }
    expect(stomps).toBeGreaterThan(15);
  });

  it("even matchups produce real comebacks (winner was clearly behind)", () => {
    let comebacks = 0;
    for (let s = 0; s < 40; s++) {
      const res = simulateMatch(roster("u", 70), roster("r", 70), mulberry32(s + 200));
      if (winnerMin(res) < 0.32) comebacks++;
    }
    expect(comebacks).toBeGreaterThan(3);
  });
});

describe("scenarios — negative rules (Atakhan never, and friends)", () => {
  it("Atakhan never appears in any ticker", () => {
    for (let s = 0; s < 50; s++) {
      const res = simulateMatch(roster("u", 73), roster("r", 67), mulberry32(s));
      for (const ev of res.timeline) {
        expect(ev.ticker.toLowerCase()).not.toContain("atakhan");
      }
    }
  });

  it("no objective is ever stolen without contestation, end-to-end", () => {
    for (let s = 0; s < 50; s++) {
      const res = simulateMatch(roster("u", 70), roster("r", 72), mulberry32(s + 9));
      for (const ev of res.timeline) {
        if (ev.stolen) expect(ev.contested).toBe(true);
      }
    }
  });
});
