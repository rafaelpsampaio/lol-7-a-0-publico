/**
 * src/sim/steals.test.ts
 *
 * Objective steals: possible, gated on contestation (hard rule) AND on a living
 * jungler (the Smite carrier). Plus: big objective moments are concomitant — a
 * contested Baron/Dragon resolves a fight in the SAME instant, so an ace or
 * multikill can land together with the objective event.
 */

import { describe, it, expect } from "vitest";
import { makePlayer } from "../draft/orchestrator.test";
import { mulberry32 } from "./rng";
import { simulateMatch, stealChanceFor } from "./engine";
import { createInitialMatchState, ROLES, type MatchState } from "./matchState";
import type { PlayerVersion, PlayerTrait } from "../data/schema";

function roster(prefix: string, s: number, jungleTraits: PlayerTrait[] = []): PlayerVersion[] {
  return ROLES.map((r) =>
    makePlayer(r, {
      id: `${prefix}-${r}`,
      personId: `${prefix}-${r}`,
      displayName: `${prefix}-${r} 2024`,
      lanePhase: s,
      midGame: s,
      lateGame: s,
      traits: r === "jungle" ? jungleTraits : [],
    })
  );
}

function stateWith(jungleTraits: PlayerTrait[] = []): MatchState {
  return createInitialMatchState(roster("u", 70, jungleTraits), roster("r", 70));
}

describe("stealChanceFor — gated on a living jungler", () => {
  it("is near zero when the jungler is dead (no Smite carrier)", () => {
    const s = stateWith();
    s.user.players.jungle.alive = false;
    expect(stealChanceFor(s, "user", "baron")).toBeLessThanOrEqual(0.03);
  });

  it("a living jungler gives a real steal chance", () => {
    const s = stateWith();
    expect(stealChanceFor(s, "user", "baron")).toBeGreaterThan(0.1);
  });

  it("a living jungler increases the chance vs a dead one", () => {
    const dead = stateWith();
    dead.user.players.jungle.alive = false;
    const alive = stateWith();
    expect(stealChanceFor(alive, "user", "baron")).toBeGreaterThan(
      stealChanceFor(dead, "user", "baron")
    );
  });

  it("a baron_stealer jungler steals more than a plain one", () => {
    const plain = stateWith();
    const stealer = stateWith(["baron_stealer"]);
    expect(stealChanceFor(stealer, "user", "baron")).toBeGreaterThan(
      stealChanceFor(plain, "user", "baron")
    );
  });

  it("bigger pits (baron/elder) are a touch more stealable than a dragon", () => {
    const s = stateWith();
    expect(stealChanceFor(s, "user", "baron")).toBeGreaterThan(
      stealChanceFor(s, "user", "dragon")
    );
  });
});

describe("steals & concomitant events occur end-to-end", () => {
  it("steals happen in a meaningful share of games, always contested", () => {
    let gamesWithSteal = 0;
    const N = 120;
    for (let seed = 0; seed < N; seed++) {
      const res = simulateMatch(roster("u", 72, ["baron_stealer"]), roster("r", 72), mulberry32(seed));
      let had = false;
      for (const ev of res.timeline) {
        if (ev.stolen) {
          had = true;
          expect(ev.contested).toBe(true); // hard rule preserved
        }
      }
      if (had) gamesWithSteal++;
    }
    expect(gamesWithSteal).toBeGreaterThan(8); // not every game, but a real share
  });

  it("an objective event can share its instant with an ace/multikill (concomitant)", () => {
    let coOccur = 0;
    const objKinds = new Set([
      "dragon_taken", "dragon_steal", "baron_taken", "baron_steal", "elder_taken", "elder_steal",
    ]);
    const bigKills = new Set(["ace", "penta_kill", "quadra_kill", "triple_kill", "double_kill"]);
    for (let seed = 0; seed < 120; seed++) {
      const res = simulateMatch(roster("u", 74), roster("r", 70), mulberry32(seed));
      const byTime = new Map<number, string[]>();
      for (const e of res.timeline) {
        const arr = byTime.get(e.timeSec) ?? [];
        arr.push(e.kind);
        byTime.set(e.timeSec, arr);
      }
      for (const kinds of byTime.values()) {
        if (kinds.some((k) => objKinds.has(k)) && kinds.some((k) => bigKills.has(k))) coOccur++;
      }
    }
    expect(coOccur).toBeGreaterThan(0);
  });
});
