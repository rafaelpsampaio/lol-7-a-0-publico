import { describe, it, expect } from "vitest";
import { createInitialMatchState, ROLES, DEFAULT_SIM_CONFIG, type MatchState } from "./matchState";
import {
  numbersAdvantage, conversionSide, conversionTarget, contestChance, conversionStealFactor,
  conversionLane, conversionLead, prefixLead, conversionSiegeDamage,
} from "./conversion";
import { DEFAULT_REALISM_TUNING } from "./tuning";
import { resolveConversion } from "./engine";
import { mulberry32 } from "./rng";
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

function at(min: number): MatchState {
  const s = createInitialMatchState(flat("u"), flat("r"), { config: DEFAULT_SIM_CONFIG });
  s.gameTimeSec = min * 60;
  return s;
}

function kill(s: MatchState, side: "user" | "rival", roles: Role[]): void {
  for (const r of roles) {
    s[side].players[r].alive = false;
    s[side].players[r].respawnAtSec = s.gameTimeSec + 40;
  }
}

describe("janela de conversao: quem converte", () => {
  it("empate numerico nao abre janela", () => {
    const s = at(25);
    kill(s, "user", ["top"]);
    kill(s, "rival", ["mid"]);
    expect(conversionSide(s)).toBeNull();
  });

  it("vantagem com pelo menos 3 vivos abre janela para o lado com mais gente", () => {
    const s = at(25);
    kill(s, "rival", ["mid", "adc"]);
    expect(conversionSide(s)).toBe("user");
    expect(numbersAdvantage(s, "user")).toBe(2);
  });

  it("vantagem com menos de 3 vivos nao abre janela (2 contra 1 no fim de luta)", () => {
    const s = at(25);
    kill(s, "user", ["top", "jungle", "mid"]);
    kill(s, "rival", ["top", "jungle", "mid", "adc"]);
    expect(conversionSide(s)).toBeNull();
  });
});

describe("janela de conversao: o que converte", () => {
  it("prioridade: Barao antes de dragao com 2 ou mais de vantagem", () => {
    const s = at(26);
    s.objectives.baronAlive = true;
    s.objectives.dragonAlive = true;
    s.objectives.dragonElement = "infernal";
    s.objectivePrep.user.baron = 50;
    s.objectivePrep.user.dragon = 50;
    kill(s, "rival", ["mid", "adc"]);
    expect(conversionTarget(s, "user", "river_bot")).toBe("baron");
  });

  it("com 1 de vantagem: dragao do lado da luta; Barao so com o jungler inimigo morto", () => {
    const s = at(26);
    s.objectives.baronAlive = true;
    s.objectives.dragonAlive = true;
    s.objectives.dragonElement = "infernal";
    s.objectivePrep.user.dragon = 50;
    s.objectivePrep.user.baron = 50;
    kill(s, "rival", ["mid"]);
    expect(conversionTarget(s, "user", "river_bot")).toBe("dragon");
    // jungler inimigo vivo: com 1 a mais, nada de Barao (spec calendario secao 4)
    expect(conversionTarget(s, "user", "river_top")).toBe("push");
    const t = at(26);
    t.objectives.baronAlive = true;
    t.objectivePrep.user.baron = 50;
    kill(t, "rival", ["jungle"]);
    expect(conversionTarget(t, "user", "river_top")).toBe("baron");
  });

  it("Elder pela janela segue a regra do Barao", () => {
    const s = at(32);
    s.objectives.elderUnlocked = true;
    s.objectives.elderAlive = true;
    s.objectivePrep.user.elder = 50;
    kill(s, "rival", ["mid"]);
    expect(conversionTarget(s, "user", "river_bot")).toBe("push");
    kill(s, "rival", ["adc"]);
    expect(conversionTarget(s, "user", "river_bot")).toBe("elder");
  });

  it("sem objetivo disponivel, empurra torre", () => {
    const s = at(26);
    kill(s, "rival", ["mid"]);
    expect(conversionTarget(s, "user", "mid")).toBe("push");
  });

  it("rota de cerco: a da luta se ela tem estrutura; senao a mais avancada", () => {
    const s = at(26);
    expect(conversionLane(s, "user", "river_top")).toBe("top");
    s.rival.structures.bot.outerAlive = false;
    expect(conversionLane(s, "user", "base")).toBe("bot");
  });
});

describe("janela exige preparo comecado (emenda de 2026-10-02)", () => {
  it("sem preparo de pelo menos 50 do proprio lado, o objetivo nao e alvo e a janela empurra torre", () => {
    const s = at(26);
    s.objectives.dragonAlive = true;
    s.objectives.dragonElement = "infernal";
    kill(s, "rival", ["mid"]);
    expect(conversionTarget(s, "user", "river_bot")).toBe("push");
    s.objectivePrep.user.dragon = 49;
    expect(conversionTarget(s, "user", "river_bot")).toBe("push");
    s.objectivePrep.rival.dragon = 100; // o preparo do outro lado nao conta
    expect(conversionTarget(s, "user", "river_bot")).toBe("push");
    s.objectivePrep.user.dragon = 50;
    expect(conversionTarget(s, "user", "river_bot")).toBe("dragon");
  });

  it("a janela nao converte dragao que ainda nao nasceu, mesmo com preparo cheio", () => {
    const s = at(26);
    s.objectives.dragonAlive = false;
    s.objectives.dragonsTaken = 1;
    s.objectives.dragonRespawnAtSec = s.gameTimeSec + 30;
    s.objectivePrep.user.dragon = 100;
    kill(s, "rival", ["mid"]);
    expect(conversionTarget(s, "user", "river_bot")).toBe("push");
  });
});

describe("janela de conversao: regra da Smite", () => {
  const t = DEFAULT_REALISM_TUNING;
  it("contesta mais Barao que dragao que larvas, e menos com mais desvantagem", () => {
    expect(contestChance("baron", 1, true, t)).toBeGreaterThan(contestChance("dragon", 1, true, t));
    expect(contestChance("dragon", 1, true, t)).toBeGreaterThan(contestChance("voidgrubs", 1, true, t));
    expect(contestChance("baron", 3, true, t)).toBeLessThan(contestChance("baron", 1, true, t));
  });
  it("jungler morto derruba a chance de contestar", () => {
    expect(contestChance("baron", 1, false, t)).toBeLessThan(contestChance("baron", 1, true, t));
  });
  it("fator de roubo cai com a diferenca numerica e nunca passa de 1", () => {
    expect(conversionStealFactor(0)).toBe(1);
    expect(conversionStealFactor(2)).toBeLessThan(conversionStealFactor(1));
    expect(conversionStealFactor(4)).toBeGreaterThan(0);
  });
});

describe("janela de conversao: texto", () => {
  it("lead fala do ACE quando o inimigo esta todo morto", () => {
    const s = at(30);
    kill(s, "rival", ["top", "jungle", "mid", "adc", "support"]);
    expect(conversionLead(s, "user", 5, "mid")).toBe("Após o ACE, ");
  });
  it("antes de 8:00 o lead nao fala de ACE (o evento ace e suprimido), vale o numerico", () => {
    const s = at(7);
    kill(s, "rival", ["top", "jungle", "mid", "adc", "support"]);
    expect(conversionLead(s, "user", 5, "mid")).toBe("Com cinco a mais depois da luta no meio, ");
    s.gameTimeSec = 8 * 60;
    expect(conversionLead(s, "user", 5, "mid")).toBe("Após o ACE, ");
  });
  it("lead fala da vantagem numerica e do lugar da luta", () => {
    const s = at(30);
    kill(s, "rival", ["mid", "adc"]);
    expect(conversionLead(s, "user", 2, "river_top")).toMatch(/^Com dois a mais depois da luta /);
  });
  it("prefixLead baixa a caixa so de artigo no comeco", () => {
    expect(prefixLead("Após o ACE, ", "O Seu time venceu.")).toBe("Após o ACE, o Seu time venceu.");
    expect(prefixLead("Após o ACE, ", "Faker derrubou a torre.")).toBe("Após o ACE, Faker derrubou a torre.");
  });
});

describe("resolveConversion (integracao)", () => {
  it("ACE com Barao vivo: Barao sem luta, sem roubo, texto 'Após o ACE'", () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = at(26);
      s.objectives.baronAlive = true;
      s.objectivePrep.user.baron = 50;
      kill(s, "rival", ["top", "jungle", "mid", "adc", "support"]);
      const evs = resolveConversion(s, "user", mulberry32(seed));
      const obj = evs.find((e) => e.objectiveKind === "baron")!;
      expect(obj.kind).toBe("baron_taken");
      expect(obj.side).toBe("user");
      expect(obj.contested).toBe(false);
      expect(obj.ticker.startsWith("Após o ACE, ")).toBe(true);
    }
  });

  it("com 2 a mais e o jungler inimigo vivo ha roubo as vezes; com ele morto, quase nunca", () => {
    let vivo = 0;
    let morto = 0;
    for (let seed = 0; seed < 3000; seed++) {
      const a = at(26);
      a.objectives.baronAlive = true;
      a.objectivePrep.user.baron = 50;
      kill(a, "rival", ["mid", "adc"]);
      a.lastFightWon = { side: "user", place: "river_top", atSec: a.gameTimeSec };
      if (resolveConversion(a, "user", mulberry32(seed)).some((e) => e.kind === "baron_steal")) vivo++;
      const b = at(26);
      b.objectives.baronAlive = true;
      b.objectivePrep.user.baron = 50;
      kill(b, "rival", ["jungle", "mid"]);
      b.lastFightWon = { side: "user", place: "river_top", atSec: b.gameTimeSec };
      if (resolveConversion(b, "user", mulberry32(seed)).some((e) => e.kind === "baron_steal")) morto++;
    }
    expect(vivo).toBeGreaterThan(morto);
    expect(morto).toBeLessThanOrEqual(6);
  });

  it("proxima estrutura e inibidor: cai direto; depois as torres do Nexus acumulam pool", () => {
    const s = at(30);
    s.rival.structures.mid.outerAlive = false;
    s.rival.structures.mid.innerAlive = false;
    s.rival.structures.mid.inhibTurretAlive = false;
    kill(s, "rival", ["mid", "adc"]);
    s.lastFightWon = { side: "user", place: "mid", atSec: s.gameTimeSec };
    const e1 = resolveConversion(s, "user", mulberry32(1));
    expect(e1.map((e) => e.kind)).toContain("inhibitor_destroyed");
    expect(s.rival.structures.mid.inhibitorAlive).toBe(false);
    s.gameTimeSec += 15;
    resolveConversion(s, "user", mulberry32(2));
    expect(s.rival.structureDamage.mid.nexusTurretDamage).toBeGreaterThan(0);
    expect(s.rival.nexusTurretsAlive).toBe(2);
  });

  it("antes de 7:00 nenhuma torre cai por conversao", () => {
    const s = at(6.5);
    kill(s, "rival", ["top", "jungle"]);
    s.lastFightWon = { side: "user", place: "top", atSec: s.gameTimeSec };
    for (let i = 0; i < 10; i++) resolveConversion(s, "user", mulberry32(i));
    expect(s.rival.structures.top.outerAlive).toBe(true);
  });
});

describe("conversionSiegeDamage: resistencia da torre externa (patch 26)", () => {
  it("a torre externa leva o fator inicial ate 11:00 e as outras torres nao", () => {
    const s = at(10);
    const meia = conversionSiegeDamage(s, "user", "outer", 1);
    const interna = conversionSiegeDamage(s, "user", "inner", 1);
    s.tuning = { ...s.tuning, outerTurretEarlyFactor: 1 };
    const cheia = conversionSiegeDamage(s, "user", "outer", 1);
    expect(meia).toBeGreaterThan(0);
    expect(meia).toBeCloseTo(cheia * 0.5, 10);
    expect(conversionSiegeDamage(s, "user", "inner", 1)).toBe(interna);
  });
});
