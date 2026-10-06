import { describe, it, expect } from "vitest";
import { createInitialMatchState, ROLES, DEFAULT_SIM_CONFIG } from "./matchState";
import { accrueSiegePressure } from "./structures";
import type { PlayerVersion, Role } from "../data/schema";

function flat(prefix: string, stat: number): PlayerVersion[] {
  return ROLES.map((role: Role) => ({
    id: `${prefix}-${role}`, personId: `${prefix}-${role}`, displayName: `${prefix}-${role}`, year: 2024,
    roles: [role], primaryRole: role,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: stat },
    lanePhase: stat, midGame: stat, lateGame: stat, traits: [],
    championPool: [{ championId: "c0", mastery: 3 as const }],
  }));
}

describe("canal de cerco so na fase de rota (spec secao 5)", () => {
  it("depois de 14:00 nao acumula dano nem emite evento", () => {
    const s = createInitialMatchState(flat("u", 90), flat("r", 60), { config: DEFAULT_SIM_CONFIG });
    s.gameTimeSec = 900;
    s.pressure = { top: 60, mid: 60, bot: 60 };
    const ev = accrueSiegePressure(s);
    expect(ev).toEqual([]);
    expect(s.rival.structureDamage.top.outerDamage).toBe(0);
  });

  it("antes de 14:00 so toca a torre externa", () => {
    const s = createInitialMatchState(flat("u", 90), flat("r", 60), { config: DEFAULT_SIM_CONFIG });
    s.gameTimeSec = 600;
    s.pressure = { top: 60, mid: 60, bot: 60 };
    s.rival.structures.top.outerAlive = false;
    accrueSiegePressure(s);
    expect(s.rival.structureDamage.top.innerDamage).toBe(0);
    expect(s.rival.structureDamage.mid.outerDamage).toBeGreaterThan(0);
  });
});
