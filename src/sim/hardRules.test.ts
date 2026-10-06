/**
 * Regra dura de 7:00 (420 s): nenhuma torre cai antes disso por nenhum canal de pool.
 * A garantia vive em holdPoolBeforeTowerWindow (structures.ts) e e usada pelo canal absoluto
 * (accrueSiegePressure), pelo caminho do gate (resolveStructurePressure) e pela conversao.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  createInitialMatchState, ROLES, LANES, DEFAULT_SIM_CONFIG, teamOf, type MatchState, type Side,
} from "./matchState";
import {
  accrueSiegePressure, resolveStructurePressure, holdPoolBeforeTowerWindow, NO_TOWER_BEFORE_SEC,
} from "./structures";
import { resolveConversion } from "./engine";
import { mulberry32 } from "./rng";
import { runCorpus, computeRealismMetrics } from "../../scripts/realism-metrics";
import type { PlayerVersion, Role } from "../data/schema";

function flat(prefix: string): PlayerVersion[] {
  return ROLES.map((role: Role) => ({
    id: `${prefix}-${role}`, personId: `${prefix}-${role}`, displayName: `${prefix}-${role}`, year: 2024,
    roles: [role], primaryRole: role,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: 75 },
    lanePhase: 75, midGame: 75, lateGame: 75, traits: [],
    championPool: [{ championId: "c0", mastery: 3 as const }],
  }));
}

function at(sec: number): MatchState {
  const s = createInitialMatchState(flat("u"), flat("r"), { config: DEFAULT_SIM_CONFIG });
  s.gameTimeSec = sec;
  return s;
}

/**
 * Pool de torre externa em 99,9 nas tres rotas dos dois lados e pressao de rota a favor do user
 * (onda favoravel). Com `outerTurretEarlyFactor` (0,5 ate 11:00) o dano do canal absoluto aos
 * 7:00 fica abaixo de 1 por tick, mas acima dos 0,1 que faltam: um tick cruza 100 no lado rival.
 */
function primed(sec: number): MatchState {
  const s = at(sec);
  for (const lane of LANES) s.pressure[lane] = 50;
  for (const side of ["user", "rival"] as Side[]) {
    for (const lane of LANES) teamOf(s, side).structureDamage[lane].outerDamage = 99.9;
  }
  return s;
}

function towersStanding(s: MatchState): number {
  let n = 0;
  for (const side of ["user", "rival"] as Side[]) {
    for (const lane of LANES) if (teamOf(s, side).structures[lane].outerAlive) n++;
  }
  return n;
}

describe("holdPoolBeforeTowerWindow", () => {
  it("antes de 420 s, um pool que chegaria a 100 fica logo abaixo", () => {
    expect(holdPoolBeforeTowerWindow(99, 100, NO_TOWER_BEFORE_SEC - 15)).toBeLessThan(100);
    expect(holdPoolBeforeTowerWindow(99, 100, NO_TOWER_BEFORE_SEC - 15)).toBeGreaterThanOrEqual(99);
  });
  it("nunca baixa um pool que ja estava entre 99 e 100", () => {
    expect(holdPoolBeforeTowerWindow(99.95, 100, 300)).toBe(99.95);
    expect(holdPoolBeforeTowerWindow(99.5, 100, 300)).toBeGreaterThanOrEqual(99.5);
  });
  it("de 420 s em diante e identidade, e abaixo de 100 nunca mexe", () => {
    expect(holdPoolBeforeTowerWindow(99, 100, NO_TOWER_BEFORE_SEC)).toBe(100);
    expect(holdPoolBeforeTowerWindow(40, 55, 100)).toBe(55);
  });
});

describe("regra dura de 7:00 em cada ponto de queda por pool", () => {
  it("canal absoluto: pool em 99 aos 405 s nao derruba torre; o mesmo estado aos 420 s derruba", () => {
    const early = primed(NO_TOWER_BEFORE_SEC - 15);
    accrueSiegePressure(early);
    expect(towersStanding(early)).toBe(6);
    for (const side of ["user", "rival"] as Side[]) {
      for (const lane of LANES) {
        const p = teamOf(early, side).structureDamage[lane].outerDamage;
        expect(p).toBeGreaterThanOrEqual(99);
        expect(p).toBeLessThan(100);
      }
    }
    const late = primed(NO_TOWER_BEFORE_SEC);
    accrueSiegePressure(late);
    expect(towersStanding(late)).toBeLessThan(6);
  });

  it("caminho do gate (resolveStructurePressure): pool em 99 aos 405 s nao derruba; aos 420 s derruba", () => {
    for (const [sec, cai] of [[NO_TOWER_BEFORE_SEC - 15, false], [NO_TOWER_BEFORE_SEC, true]] as const) {
      const s = at(sec);
      s.pressure.top = 100;
      s.rival.structureDamage.top.outerDamage = 99;
      resolveStructurePressure(s, "user", "press_top", () => 0);
      expect(s.rival.structures.top.outerAlive).toBe(!cai);
      if (!cai) expect(s.rival.structureDamage.top.outerDamage).toBeLessThan(100);
    }
  });

  it("conversao: pool em 99,5 aos 405 s nao derruba e nao e baixado para 99", () => {
    const s = at(NO_TOWER_BEFORE_SEC - 15);
    s.rival.players.top.alive = false;
    s.rival.players.top.respawnAtSec = s.gameTimeSec + 40;
    s.rival.players.mid.alive = false;
    s.rival.players.mid.respawnAtSec = s.gameTimeSec + 40;
    s.lastFightWon = { side: "user", place: "top", atSec: s.gameTimeSec };
    s.rival.structureDamage.top.outerDamage = 99.5;
    for (let i = 0; i < 5; i++) resolveConversion(s, "user", mulberry32(i));
    expect(s.rival.structures.top.outerAlive).toBe(true);
    expect(s.rival.structureDamage.top.outerDamage).toBeGreaterThanOrEqual(99.5);
    expect(s.rival.structureDamage.top.outerDamage).toBeLessThan(100);
  });
});

describe("regressao: conversao agressiva nao abre a regra dura de 7:00", () => {
  it("600 partidas do cenario app com conversionSiegeBase 80: nenhuma primeira torre antes de 420 s", () => {
    const players: PlayerVersion[] = JSON.parse(readFileSync("public/players.json", "utf-8")).players;
    const games = runCorpus(players, "app", 600, { ...DEFAULT_SIM_CONFIG, tuning: { conversionSiegeBase: 80 } });
    let towerBefore7 = 0;
    for (const g of games) {
      const first = g.result.timeline.find((e) => e.score.userTowers + e.score.rivalTowers > 0);
      if (first && first.timeSec < NO_TOWER_BEFORE_SEC) towerBefore7++;
    }
    expect(towerBefore7).toBe(0);
    expect(computeRealismMetrics(games).hardRuleViolations).toBe(0);
  }, 120000);
});
