/**
 * src/sim/objectives.test.ts
 *
 * Phase 4 — objective timers + HARD RULES. These tests are the contract that
 * impossible events stay impossible.
 */

import { describe, it, expect } from "vitest";
import { makePlayer } from "../draft/orchestrator.test";
import { mulberry32 } from "./rng";
import {
  createInitialMatchState,
  TIMERS,
  ROLES,
  type MatchState,
} from "./matchState";
import {
  updateObjectiveTimers,
  isObjectiveAvailable,
  canStealObjective,
  takeObjective,
  stealObjective,
} from "./objectives";

function freshState(): MatchState {
  const user = ROLES.map((r) => makePlayer(r, { personId: `u-${r}`, id: `u-${r}-1` }));
  const rival = ROLES.map((r) => makePlayer(r, { personId: `r-${r}`, id: `r-${r}-1` }));
  return createInitialMatchState(user, rival);
}

/** Advance the clock in fixed ticks, updating objective timers each step. */
function advanceTo(state: MatchState, targetSec: number, tick = 15): void {
  const rng = mulberry32(1);
  while (state.gameTimeSec < targetSec) {
    state.gameTimeSec = Math.min(targetSec, state.gameTimeSec + tick);
    updateObjectiveTimers(state, rng);
  }
}

// ---------------------------------------------------------------------------
// Baron — NEVER before 20:00
// ---------------------------------------------------------------------------

describe("Baron — hard rule: never before 20:00", () => {
  it("baron is not available at any second before 1200", () => {
    const s = freshState();
    const rng = mulberry32(7);
    for (let t = 0; t < 1200; t += 15) {
      s.gameTimeSec = t;
      updateObjectiveTimers(s, rng);
      expect(isObjectiveAvailable(s, "baron")).toBe(false);
      expect(s.objectives.baronAlive).toBe(false);
    }
  });

  it("baron becomes available at exactly 20:00", () => {
    const s = freshState();
    advanceTo(s, TIMERS.BARON_SPAWN);
    expect(s.objectives.baronAlive).toBe(true);
    expect(isObjectiveAvailable(s, "baron")).toBe(true);
  });

  it("takeObjective('baron') throws before 20:00", () => {
    const s = freshState();
    s.gameTimeSec = 1000;
    expect(() => takeObjective(s, "user", "baron", mulberry32(1))).toThrow();
  });

  it("after a baron is taken it respawns 6:00 later, not before", () => {
    const s = freshState();
    advanceTo(s, TIMERS.BARON_SPAWN);
    takeObjective(s, "user", "baron", mulberry32(1));
    expect(s.objectives.baronAlive).toBe(false);
    advanceTo(s, TIMERS.BARON_SPAWN + 300); // +5:00 only
    expect(s.objectives.baronAlive).toBe(false);
    advanceTo(s, TIMERS.BARON_SPAWN + TIMERS.BARON_RESPAWN);
    expect(s.objectives.baronAlive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dragon element rule — first two differ, 3rd+ is the soul element
// ---------------------------------------------------------------------------

describe("Dragon elements — 1st ≠ 2nd, 3rd+ = soul element", () => {
  /** Advance until a dragon is up, then take it for `side`; returns its element. */
  function takeNextDragon(s: MatchState, side: "user" | "rival", rng: () => number) {
    while (!s.objectives.dragonAlive && s.objectives.dragonRespawnAtSec !== null) {
      s.gameTimeSec += 15;
      updateObjectiveTimers(s, rng);
      if (s.gameTimeSec > 6000) break;
    }
    const el = s.objectives.dragonElement;
    takeObjective(s, side, "dragon", rng);
    return el;
  }

  it("the first two dragons are always different elements (50 seeds)", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = freshState();
      const rng = mulberry32(seed);
      const el1 = takeNextDragon(s, "user", rng);
      const el2 = takeNextDragon(s, "rival", rng);
      expect(el1).not.toBeNull();
      expect(el2).not.toBeNull();
      expect(el1).not.toBe(el2);
    }
  });

  it("locks the soul element the moment the 2nd dragon dies", () => {
    const s = freshState();
    const rng = mulberry32(5);
    takeNextDragon(s, "user", rng);
    expect(s.objectives.soulElement).toBeNull(); // not yet after the 1st
    takeNextDragon(s, "rival", rng);
    expect(s.objectives.soulElement).not.toBeNull(); // locked on the 2nd kill
  });

  it("every dragon from the 3rd on is the locked soul element", () => {
    const s = freshState();
    const rng = mulberry32(8);
    takeNextDragon(s, "user", rng); // 1st
    takeNextDragon(s, "user", rng); // 2nd → locks soul
    const soul = s.objectives.soulElement;
    expect(soul).not.toBeNull();
    const el3 = takeNextDragon(s, "user", rng); // 3rd (user's 3rd)
    expect(el3).toBe(soul);
    // 4th gives the user the soul; element still matches.
    expect(s.objectives.dragonRespawnAtSec).not.toBeNull();
    const el4 = takeNextDragon(s, "user", rng);
    expect(el4).toBe(soul);
    expect(s.user.soul).toBe(soul);
  });
});

// ---------------------------------------------------------------------------
// Elder — NEVER before a soul exists
// ---------------------------------------------------------------------------

describe("Elder — hard rule: only after a soul", () => {
  it("elder stays locked through the whole game with no soul", () => {
    const s = freshState();
    advanceTo(s, 2400); // 40:00
    expect(s.objectives.elderUnlocked).toBe(false);
    expect(s.objectives.elderAlive).toBe(false);
    expect(isObjectiveAvailable(s, "elder")).toBe(false);
  });

  it("taking the 4th dragon grants soul and unlocks elder", () => {
    const s = freshState();
    const rng = mulberry32(3);
    // Force four dragons for the user.
    for (let i = 0; i < 4; i++) {
      s.objectives.dragonAlive = true;
      s.objectives.dragonElement = "infernal";
      const r = takeObjective(s, "user", "dragon", rng);
      if (i === 3) expect(r.grantedSoul).toBe(true);
    }
    expect(s.user.soul).not.toBeNull();
    expect(s.objectives.elderUnlocked).toBe(true);
    // Patch 26: o 1o Elder nasce 5:00 depois da Alma.
    const soulAt = s.gameTimeSec;
    advanceTo(s, soulAt + TIMERS.ELDER_FIRST_SPAWN_AFTER_SOUL - 15);
    expect(s.objectives.elderAlive).toBe(false);
    advanceTo(s, soulAt + TIMERS.ELDER_FIRST_SPAWN_AFTER_SOUL);
    expect(s.objectives.elderAlive).toBe(true);
  });

  it("depois de tomado, o Elder volta 6:00 depois", () => {
    const s = freshState();
    s.user.soul = "infernal";
    s.objectives.elderUnlocked = true;
    s.objectives.elderAlive = true;
    s.gameTimeSec = 1800;
    takeObjective(s, "user", "elder", mulberry32(1));
    expect(s.objectives.elderRespawnAtSec).toBe(1800 + TIMERS.ELDER_RESPAWN);
  });
});

// ---------------------------------------------------------------------------
// Herald — 14:00–19:45 only, never with Baron
// ---------------------------------------------------------------------------

describe("Herald: janela 15:00 a 19:45 (patch 26)", () => {
  it("nao nasce antes de 15:00", () => {
    const s = freshState();
    advanceTo(s, TIMERS.HERALD_SPAWN - 15);
    expect(isObjectiveAvailable(s, "herald")).toBe(false);
  });

  it("nasce as 15:00 e some as 19:45 se ninguem tomar", () => {
    const s = freshState();
    advanceTo(s, TIMERS.HERALD_SPAWN);
    expect(s.objectives.heraldAlive).toBe(true);
    advanceTo(s, TIMERS.HERALD_DESPAWN + 15);
    expect(s.objectives.heraldAlive).toBe(false);
    expect(s.objectives.heraldDone).toBe(true);
  });

  it("herald and baron never coexist", () => {
    const s = freshState();
    const rng = mulberry32(5);
    for (let t = 0; t <= 1400; t += 15) {
      s.gameTimeSec = t;
      updateObjectiveTimers(s, rng);
      expect(s.objectives.heraldAlive && s.objectives.baronAlive).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Voidgrubs — window + 2nd-wave rule
// ---------------------------------------------------------------------------

describe("Voidgrubs: leva unica as 8:00 (patch 26)", () => {
  it("nascem 3 as 8:00, nao antes, e somem de vez as 14:45", () => {
    const s = freshState();
    advanceTo(s, TIMERS.VOIDGRUBS_SPAWN - 15);
    expect(s.objectives.voidgrubsAlive).toBe(0);
    advanceTo(s, TIMERS.VOIDGRUBS_SPAWN);
    expect(s.objectives.voidgrubsAlive).toBe(3);
    advanceTo(s, TIMERS.VOIDGRUBS_DESPAWN);
    expect(s.objectives.voidgrubsAlive).toBe(0);
    expect(s.objectives.voidgrubsDespawned).toBe(true);
    expect(isObjectiveAvailable(s, "voidgrubs")).toBe(false);
  });

  it("depois de tomadas, nunca voltam", () => {
    const s = freshState();
    advanceTo(s, TIMERS.VOIDGRUBS_SPAWN);
    s.gameTimeSec = 540;
    takeObjective(s, "user", "voidgrubs", mulberry32(1));
    expect(s.user.voidgrubs).toBe(3);
    expect(s.objectives.voidgrubsDespawned).toBe(true);
    advanceTo(s, 840);
    expect(s.objectives.voidgrubsAlive).toBe(0);
    expect(isObjectiveAvailable(s, "voidgrubs")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Steals — only with active attempt + contest
// ---------------------------------------------------------------------------

describe("Steal — requires active attempt + contest", () => {
  it("canStealObjective is false without a contest", () => {
    const s = freshState();
    advanceTo(s, TIMERS.BARON_SPAWN);
    expect(canStealObjective(s, "baron", { attemptingSide: "rival", contesting: false })).toBe(false);
    expect(canStealObjective(s, "baron", { attemptingSide: null, contesting: true })).toBe(false);
  });

  it("stealObjective throws without contestation", () => {
    const s = freshState();
    advanceTo(s, TIMERS.BARON_SPAWN);
    expect(() =>
      stealObjective(s, "user", "baron", { attemptingSide: "rival", contesting: false }, mulberry32(1))
    ).toThrow();
  });

  it("a legal contested steal flips the objective to the contesting side", () => {
    const s = freshState();
    advanceTo(s, TIMERS.BARON_SPAWN);
    const r = stealObjective(
      s,
      "user",
      "baron",
      { attemptingSide: "rival", contesting: true },
      mulberry32(1)
    );
    expect(r.side).toBe("user");
    expect(s.user.baronsTaken).toBe(1);
  });

  it("the attempting side cannot steal from itself", () => {
    const s = freshState();
    advanceTo(s, TIMERS.BARON_SPAWN);
    expect(() =>
      stealObjective(s, "rival", "baron", { attemptingSide: "rival", contesting: true }, mulberry32(1))
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Inhibitor respawn — 5:00 after destruction
// ---------------------------------------------------------------------------

describe("Inhibitor — respawns 5:00 after destruction", () => {
  it("a destroyed inhibitor is down, then alive again exactly 5:00 later", () => {
    const s = freshState();
    s.gameTimeSec = 1500;
    // Destroy the user's mid inhibitor directly.
    s.user.structures.mid.inhibitorAlive = false;
    s.user.structures.mid.inhibitorRespawnAtSec = 1500 + TIMERS.INHIBITOR_RESPAWN;

    // Still down before the timer.
    advanceTo(s, 1500 + TIMERS.INHIBITOR_RESPAWN - 30);
    expect(s.user.structures.mid.inhibitorAlive).toBe(false);

    // Back up at/after the timer.
    advanceTo(s, 1500 + TIMERS.INHIBITOR_RESPAWN + 15);
    expect(s.user.structures.mid.inhibitorAlive).toBe(true);
    expect(s.user.structures.mid.inhibitorRespawnAtSec).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Buff expiry — lost over time
// ---------------------------------------------------------------------------

describe("Buffs — expire on their timer", () => {
  it("baron buff expires 180s after the take", () => {
    const s = freshState();
    advanceTo(s, TIMERS.BARON_SPAWN);
    takeObjective(s, "user", "baron", mulberry32(1));
    expect(s.user.players.mid.hasBaronBuff).toBe(true);
    advanceTo(s, TIMERS.BARON_SPAWN + TIMERS.BARON_BUFF_DURATION + 15);
    expect(s.buffs.baronUntilSec.user).toBeNull();
    expect(s.user.players.mid.hasBaronBuff).toBe(false);
  });
});
