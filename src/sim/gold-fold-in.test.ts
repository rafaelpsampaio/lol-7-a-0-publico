import { describe, it, expect } from "vitest";
import { createInitialMatchState, ROLES, DEFAULT_SIM_CONFIG, type MatchState } from "./matchState";
import { goldFightMult, goldSecureMult, goldRelevance } from "./power";
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

function stateWithGold(userGold: number, rivalGold: number, minute = 20): MatchState {
  const s = createInitialMatchState(flat("u"), flat("r"), { config: DEFAULT_SIM_CONFIG });
  s.gameTimeSec = minute * 60;
  for (const [team, total] of [[s.user, userGold], [s.rival, rivalGold]] as const) {
    team.gold = total;
    for (const r of ROLES) team.players[r].gold = total / 5;
  }
  return s;
}

describe("ouro relativo no poder de luta (spec secao 2)", () => {
  it("paridade de ouro vale exatamente 1", () => {
    const s = stateWithGold(34000, 34000);
    expect(goldFightMult(s.user, s)).toBe(1);
    expect(goldSecureMult(s.user, s)).toBe(1);
  });

  it("monotono: mais ouro relativo, mais poder; o lado de tras perde poder", () => {
    const a = stateWithGold(35500, 32500);
    const b = stateWithGold(38000, 30000);
    expect(goldFightMult(a.user, a)).toBeGreaterThan(1);
    expect(goldFightMult(b.user, b)).toBeGreaterThan(goldFightMult(a.user, a));
    expect(goldFightMult(a.rival, a)).toBeLessThan(1);
  });

  it("invariante a escala abaixo da build completa: multiplicar o ouro dos dois lados nao muda nada", () => {
    const a = stateWithGold(22000, 20000);
    const b = stateWithGold(44000, 40000);
    expect(goldFightMult(a.user, a)).toBeCloseTo(goldFightMult(b.user, b), 12);
  });

  it("saturacao de item: com build completa dos dois lados o ouro para de pesar", () => {
    const cedo = stateWithGold(37500, 35000);
    const meio = stateWithGold(75000, 70000);
    const cheio = stateWithGold(95000, 90000);
    expect(goldRelevance(cedo)).toBe(1);
    expect(goldRelevance(meio)).toBeGreaterThan(0);
    expect(goldRelevance(meio)).toBeLessThan(1);
    expect(goldRelevance(cheio)).toBe(0);
    expect(goldFightMult(meio.user, meio)).toBeLessThan(goldFightMult(cedo.user, cedo));
    expect(goldFightMult(cheio.user, cheio)).toBe(1);
    expect(goldSecureMult(cheio.user, cheio)).toBe(1);
  });

  it("time inteiro morto devolve 1 (sem jogador para pesar)", () => {
    const s = stateWithGold(40000, 30000);
    for (const r of ROLES) s.user.players[r].alive = false;
    expect(goldFightMult(s.user, s)).toBe(1);
  });

  it("respeita piso e teto mesmo com diferenca absurda", () => {
    const s = stateWithGold(90000, 10000);
    expect(goldFightMult(s.user, s)).toBeLessThanOrEqual(1.6);
    expect(goldFightMult(s.rival, s)).toBeGreaterThanOrEqual(0.6);
  });
});

describe("goldRelevance com faixa degenerada", () => {
  const withBand = (start: number, end: number, perPlayerGold: number): MatchState => {
    const s = stateWithGold(perPlayerGold * 5, perPlayerGold * 5);
    s.tuning = { ...s.tuning, fullBuildStartPerPlayer: start, fullBuildEndPerPlayer: end };
    return s;
  };

  it("largura zero ou negativa vira degrau em start, sem dividir por zero", () => {
    for (const end of [10000, 8000]) {
      expect(goldRelevance(withBand(10000, end, 9000))).toBe(1);
      expect(goldRelevance(withBand(10000, end, 10000))).toBe(0);
      expect(goldRelevance(withBand(10000, end, 11000))).toBe(0);
    }
    const s = withBand(10000, 10000, 10000);
    expect(Number.isFinite(goldFightMult(s.user, s))).toBe(true);
  });
});
