import { describe, it, expect } from "vitest";
import { createInitialMatchState, ROLES, DEFAULT_SIM_CONFIG } from "./matchState";
import { effectiveChaos, fightNoiseHalfWidth, DEFAULT_REALISM_TUNING } from "./tuning";
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

const stateWithChaos = (chaos: number) =>
  createInitialMatchState(flat("u"), flat("r"), { config: { ...DEFAULT_SIM_CONFIG, comebackElasticity: chaos } });

describe("tuning: caos e largura do sorteio de luta", () => {
  it("caos efetivo fica em [0,1] e cresce com o slider", () => {
    const zero = effectiveChaos(stateWithChaos(0));
    const um = effectiveChaos(stateWithChaos(1));
    expect(zero).toBeGreaterThanOrEqual(0);
    expect(um).toBeLessThanOrEqual(1);
    expect(um).toBeGreaterThan(zero);
  });

  it("largura do sorteio segue base + coef x caos e respeita os limites", () => {
    const s = stateWithChaos(0.25);
    const esperado = DEFAULT_REALISM_TUNING.fightNoiseBase + DEFAULT_REALISM_TUNING.fightNoiseChaosCoef * effectiveChaos(s);
    expect(fightNoiseHalfWidth(s)).toBeCloseTo(Math.min(0.6, Math.max(0.02, esperado)), 10);
    expect(fightNoiseHalfWidth(stateWithChaos(1))).toBeLessThanOrEqual(0.6);
    expect(fightNoiseHalfWidth(stateWithChaos(0))).toBeGreaterThanOrEqual(0.02);
  });
});

describe("tuning: torre externa do patch 26", () => {
  it("o fator de dano da torre externa comeca em 0,5", () => {
    expect(DEFAULT_REALISM_TUNING.outerTurretEarlyFactor).toBe(0.5);
  });
});
