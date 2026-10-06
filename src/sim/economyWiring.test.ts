import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { simulateMatch } from "./engine";
import { mulberry32 } from "./rng";
import { ROLES, DEFAULT_SIM_CONFIG } from "./matchState";
import type { PlayerVersion } from "../data/schema";

const PLAYERS: PlayerVersion[] = JSON.parse(readFileSync("public/players.json", "utf-8")).players;
const byRole = (r: string) => PLAYERS.filter((p) => p.primaryRole === r);
const user = ROLES.map((r) => byRole(r)[0]);
const rival = ROLES.map((r) => byRole(r)[1]);

describe("economia real ligada no motor", () => {
  it("ouro do time e a soma do ouro dos jogadores em todas as partidas", () => {
    for (let seed = 0; seed < 20; seed++) {
      const res = simulateMatch(user, rival, mulberry32(seed));
      for (const side of ["user", "rival"] as const) {
        const t = res.finalState[side];
        const soma = ROLES.reduce((s, r) => s + t.players[r].gold, 0);
        expect(t.gold).toBe(soma);
      }
    }
  });

  it("o config nao tem mais goldScale e aceita tuning parcial", () => {
    expect("goldScale" in DEFAULT_SIM_CONFIG).toBe(false);
    const res = simulateMatch(user, rival, mulberry32(1), {
      ...DEFAULT_SIM_CONFIG,
      tuning: { passiveBasePerMin: 100 },
    });
    expect(res.finalState.tuning.passiveBasePerMin).toBe(100);
  });

  it("farm mais alto gera mais ouro na mesma seed", () => {
    const pouco = simulateMatch(user, rival, mulberry32(3), { ...DEFAULT_SIM_CONFIG, tuning: { passiveBasePerMin: 150 } });
    const muito = simulateMatch(user, rival, mulberry32(3), { ...DEFAULT_SIM_CONFIG, tuning: { passiveBasePerMin: 350 } });
    const ouroAos10 = (r: typeof pouco) => {
      const e = [...r.timeline].reverse().find((x) => x.timeSec <= 600)!;
      return e.score.userGold + e.score.rivalGold;
    };
    expect(ouroAos10(muito)).toBeGreaterThan(ouroAos10(pouco));
  });
});

describe("caos nos extremos", () => {
  for (const chaos of [0, 1]) {
    it(`caos ${chaos}: 40 partidas terminam com vencedor, sem NaN e longe do teto`, () => {
      let noTeto = 0;
      for (let seed = 0; seed < 40; seed++) {
        const res = simulateMatch(user, rival, mulberry32(seed), { ...DEFAULT_SIM_CONFIG, comebackElasticity: chaos });
        expect(res.winner === "user" || res.winner === "rival").toBe(true);
        expect(Number.isFinite(res.finalState.user.gold)).toBe(true);
        expect(Number.isFinite(res.finalState.rival.gold)).toBe(true);
        if (res.durationSec >= 3600) noTeto++;
      }
      expect(noTeto).toBeLessThanOrEqual(1);
    });
  }
});
