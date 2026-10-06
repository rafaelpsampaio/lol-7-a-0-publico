/**
 * src/sim/winprob.test.ts
 *
 * Phase 7 — state-driven win probability. It must be a monotonic INDICATOR of
 * the live state (favourable state → higher number) that never pins to 0/1, so a
 * real comeback path always exists.
 */

import { describe, it, expect } from "vitest";
import { makePlayer } from "../draft/orchestrator.test";
import { createInitialMatchState, ROLES, type MatchState } from "./matchState";
import { computeWinProbability } from "./winprob";

function freshState(): MatchState {
  const user = ROLES.map((r) => makePlayer(r, { personId: `u-${r}`, id: `u-${r}-1` }));
  const rival = ROLES.map((r) => makePlayer(r, { personId: `r-${r}`, id: `r-${r}-1` }));
  return createInitialMatchState(user, rival);
}

describe("computeWinProbability — indicator, not decider", () => {
  it("an even state is ~50%", () => {
    const p = computeWinProbability(freshState());
    expect(p).toBeGreaterThan(0.45);
    expect(p).toBeLessThan(0.55);
  });

  it("team gold nao influencia diretamente winprob (GOLD-02/D-07: substituido por fold-in em fightPower)", () => {
    // GOLD-02 / D-07: o peso direto de ouro na win-prob foi zerado (gold: 0).
    // O ouro agora influencia a win-prob INDIRETAMENTE via fightPower/securePower.
    // Modificar s.user.gold (gold de time) nao move o indicador diretamente.
    const s = freshState();
    const before = computeWinProbability(s);
    s.user.gold += 8000;
    // Winprob nao sobe com gold de time: o indicador e neutro a team.gold quando
    // o ouro nao se manifesta em towers/kills/dragons/buffs
    expect(computeWinProbability(s)).toBeCloseTo(before, 3);
  });

  it("destroyed towers and inhibitors raise win probability", () => {
    const s = freshState();
    const before = computeWinProbability(s);
    s.user.towersDestroyed = 5;
    const afterTowers = computeWinProbability(s);
    expect(afterTowers).toBeGreaterThan(before);
    s.user.inhibitorsDestroyed = 2;
    expect(computeWinProbability(s)).toBeGreaterThan(afterTowers);
  });

  it("a soul is a large, but not deciding, swing", () => {
    const s = freshState();
    const before = computeWinProbability(s);
    s.user.soul = "infernal";
    const after = computeWinProbability(s);
    expect(after).toBeGreaterThan(before + 0.08);
    expect(after).toBeLessThan(0.98); // never a guarantee
  });

  it("alive epic-buff holders raise win probability", () => {
    const s = freshState();
    const before = computeWinProbability(s);
    s.gameTimeSec = 1300;
    s.buffs.baronUntilSec.user = 1480;
    for (const r of ROLES) s.user.players[r].hasBaronBuff = true;
    expect(computeWinProbability(s)).toBeGreaterThan(before);
  });

  it("a numbers advantage (enemy dead) raises win probability", () => {
    const s = freshState();
    const before = computeWinProbability(s);
    s.rival.players.adc.alive = false;
    s.rival.players.mid.alive = false;
    expect(computeWinProbability(s)).toBeGreaterThan(before);
  });

  it("exposing the enemy Nexus pushes strongly toward the user", () => {
    const s = freshState();
    s.rival.nexusExposed = true;
    expect(computeWinProbability(s)).toBeGreaterThan(0.5);
  });

  it("a total stomp reads near 100% but is still clamped within [0.005, 0.995]", () => {
    const s = freshState();
    s.user.gold += 50000;
    s.user.towersDestroyed = 11;
    s.user.inhibitorsDestroyed = 3;
    s.user.soul = "infernal";
    s.rival.nexusExposed = true;
    const p = computeWinProbability(s);
    expect(p).toBeGreaterThan(0.97); // near-certain victory should read near 100%
    expect(p).toBeLessThanOrEqual(0.995);
    expect(p).toBeGreaterThanOrEqual(0.005);
  });

  it("a trailing team's comeback genuinely moves the number (Baron + Elder + numbers)", () => {
    const s = freshState();
    // User is behind: rival ahead on gold + towers.
    s.rival.gold += 9000;
    s.rival.towersDestroyed = 6;
    const behind = computeWinProbability(s);
    expect(behind).toBeLessThan(0.4);

    // User lands the comeback: Baron + Elder buffs, and aces the enemy.
    s.gameTimeSec = 1800;
    s.buffs.baronUntilSec.user = 1980;
    s.buffs.elderUntilSec.user = 1950;
    for (const r of ROLES) {
      s.user.players[r].hasBaronBuff = true;
      s.user.players[r].hasElderBuff = true;
      s.rival.players[r].alive = false;
    }
    const afterComeback = computeWinProbability(s);
    expect(afterComeback).toBeGreaterThan(behind + 0.15);
  });
});
