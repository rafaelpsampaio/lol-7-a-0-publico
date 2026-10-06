/**
 * src/sim/matchState.test.ts
 *
 * Phase 3 — MatchState shape, consistent initial state, pure derived helpers.
 */

import { describe, it, expect } from "vitest";
import { makePlayer } from "../draft/orchestrator.test";
import {
  createInitialMatchState,
  computePhase,
  recomputeDerived,
  towersStanding,
  goldDiff,
  dragonDiff,
  aliveCount,
  formatGameClock,
  DEFAULT_SIM_CONFIG,
  TIMERS,
  ROLES,
  type MatchState,
} from "./matchState";
import { freshLaneState } from "./laneState";
import { STARTING_GOLD_PER_PLAYER } from "./economy";
import { DEFAULT_REALISM_TUNING } from "./tuning";

function rosters() {
  const user = ROLES.map((r) => makePlayer(r, { personId: `u-${r}`, id: `u-${r}-1` }));
  const rival = ROLES.map((r) => makePlayer(r, { personId: `r-${r}`, id: `r-${r}-1` }));
  return { user, rival };
}

function freshState(): MatchState {
  const { user, rival } = rosters();
  return createInitialMatchState(user, rival);
}

describe("createInitialMatchState — consistent 00:00 state", () => {
  it("has 5 players per team keyed by role", () => {
    const s = freshState();
    for (const role of ROLES) {
      expect(s.user.players[role].role).toBe(role);
      expect(s.rival.players[role].role).toBe(role);
    }
  });

  it("starts even: 0:00, early phase, winProb 0.5, no momentum/pressure", () => {
    const s = freshState();
    expect(s.gameTimeSec).toBe(0);
    expect(s.phase).toBe("early");
    expect(s.winProbUser).toBe(0.5);
    expect(s.momentum).toBe(0);
    expect(goldDiff(s)).toBe(0);
  });

  it("starts with 11 towers standing per team and 5 alive players", () => {
    const s = freshState();
    expect(towersStanding(s.user)).toBe(11);
    expect(towersStanding(s.rival)).toBe(11);
    expect(aliveCount(s.user)).toBe(5);
    expect(dragonDiff(s)).toBe(0);
  });

  it("starts with NO epic objectives up and correct first-spawn timers", () => {
    const s = freshState();
    expect(s.objectives.baronAlive).toBe(false);
    expect(s.objectives.elderAlive).toBe(false);
    expect(s.objectives.elderUnlocked).toBe(false);
    expect(s.objectives.dragonAlive).toBe(false);
    // First dragon at 5:00, Baron pencilled for 20:00, grubs for 5:00.
    expect(s.objectives.dragonRespawnAtSec).toBe(TIMERS.DRAGON_FIRST_SPAWN);
    expect(s.objectives.baronRespawnAtSec).toBe(TIMERS.BARON_SPAWN);
    expect(s.objectives.voidgrubsRespawnAtSec).toBe(TIMERS.VOIDGRUBS_SPAWN);
  });
});

describe("tuning e ouro inicial em ouro real (spec 2026-10-02)", () => {
  it("DEFAULT_SIM_CONFIG nao tem goldScale e nao fixa tuning", () => {
    expect("goldScale" in DEFAULT_SIM_CONFIG).toBe(false);
    expect(DEFAULT_SIM_CONFIG.tuning).toBeUndefined();
  });

  it("createInitialMatchState sem opts.config produz state.tuning === DEFAULT_REALISM_TUNING", () => {
    const s = freshState();
    expect(s.tuning).toEqual(DEFAULT_REALISM_TUNING);
  });

  it("createInitialMatchState com config.tuning parcial sobrescreve so os campos dados", () => {
    const { user, rival } = rosters();
    const s = createInitialMatchState(user, rival, {
      config: { ...DEFAULT_SIM_CONFIG, tuning: { passiveBasePerMin: 123 } },
    });
    expect(s.tuning.passiveBasePerMin).toBe(123);
    expect(s.tuning.passiveSlopePerMin).toBe(DEFAULT_REALISM_TUNING.passiveSlopePerMin);
  });

  it("cada jogador nasce com 500 de ouro e bounty 0; o time com 2500", () => {
    const s = freshState();
    for (const side of ["user", "rival"] as const) {
      expect(s[side].gold).toBe(5 * STARTING_GOLD_PER_PLAYER);
      for (const role of ROLES) {
        expect(s[side].players[role].gold).toBe(STARTING_GOLD_PER_PLAYER);
        expect(s[side].players[role].bounty).toBe(0);
        expect(s[side].players[role].shutdownGold).toBe(0);
      }
    }
  });
});

describe("computePhase — inferred from clock + milestones", () => {
  it("early before 14:00, mid after 14:00, late after 25:00", () => {
    const s = freshState();
    s.gameTimeSec = 600;
    expect(computePhase(s)).toBe("early");
    s.gameTimeSec = 900;
    expect(computePhase(s)).toBe("mid");
    s.gameTimeSec = 1600;
    expect(computePhase(s)).toBe("late");
  });

  it("jumps to late early when an inhibitor falls or a soul/baron is taken", () => {
    const s = freshState();
    s.gameTimeSec = 700; // would be 'early' by clock
    s.user.inhibitorsDestroyed = 1;
    expect(computePhase(s)).toBe("late");
  });

  it("recomputeDerived syncs state.phase with the clock", () => {
    const s = freshState();
    s.gameTimeSec = 1000;
    recomputeDerived(s);
    expect(s.phase).toBe("mid");
  });
});

describe("formatGameClock", () => {
  it("formats seconds as MM:SS", () => {
    expect(formatGameClock(0)).toBe("00:00");
    expect(formatGameClock(65)).toBe("01:05");
    expect(formatGameClock(1200)).toBe("20:00");
  });
});

describe("TeamState.laneState — LANE-01: 3 lanes neutras em freshTeamState", () => {
  it("freshTeamState retorna laneState com as 3 lanes (top, mid, bot)", () => {
    const s = freshState();
    expect(s.user.laneState).toHaveProperty("top");
    expect(s.user.laneState).toHaveProperty("mid");
    expect(s.user.laneState).toHaveProperty("bot");
    expect(s.rival.laneState).toHaveProperty("top");
    expect(s.rival.laneState).toHaveProperty("mid");
    expect(s.rival.laneState).toHaveProperty("bot");
  });

  it("cada lane começa com laneLead === 0 (neutro) em ambos os times", () => {
    const s = freshState();
    for (const lane of ["top", "mid", "bot"] as const) {
      expect(s.user.laneState[lane].laneLead).toBe(0);
      expect(s.rival.laneState[lane].laneLead).toBe(0);
    }
  });

  it("cada lane tem exatamente 9 campos — igual a freshLaneState()", () => {
    const s = freshState();
    const expected = Object.keys(freshLaneState());
    for (const lane of ["top", "mid", "bot"] as const) {
      expect(Object.keys(s.user.laneState[lane])).toHaveLength(expected.length);
    }
  });

  it("gold permanece 2500 (ouro real, 5 x 500) após adicionar laneState (campos pré-existentes intactos)", () => {
    const s = freshState();
    expect(s.user.gold).toBe(2500);
    expect(s.rival.gold).toBe(2500);
  });

  it("weaksideState começa com active: false em todas as lanes de ambos os times", () => {
    const s = freshState();
    for (const lane of ["top", "mid", "bot"] as const) {
      expect(s.user.laneState[lane].weaksideState.active).toBe(false);
      expect(s.rival.laneState[lane].weaksideState.active).toBe(false);
    }
  });
});
