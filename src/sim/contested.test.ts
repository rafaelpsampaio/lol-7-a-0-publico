import { describe, it, expect } from "vitest";
import { createInitialMatchState, ROLES, DEFAULT_SIM_CONFIG, aliveCount, type MatchState, type Side } from "./matchState";
import { resolveContestedObjective, resolveConversion, decidePitOwner } from "./engine";
import { securePower } from "./power";
import { mulberry32 } from "./rng";
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

function matar(s: MatchState, side: Side, roles: Role[]): void {
  for (const r of roles) {
    s[side].players[r].alive = false;
    s[side].players[r].respawnAtSec = s.gameTimeSec + 40;
  }
}

/**
 * rng que devolve 0 assim que algum time esta todo morto. Isso faz o sorteio de roubo disparar
 * sempre que ele for sorteado, entao so a guarda de vivos do motor pode impedir o roubo de um
 * time varrido (sem isso o teste passaria mesmo sem a guarda).
 */
function forcaRouboSeVarrido(s: MatchState, base: () => number): () => number {
  return () => (aliveCount(s.user) === 0 || aliveCount(s.rival) === 0 ? 0 : base());
}

describe("objetivo disputado (spec secao 6)", () => {
  it("decidePitOwner: quem tem mais gente viva leva, sem sorteio", () => {
    const s = createInitialMatchState(flat("u", 75), flat("r", 75), { config: DEFAULT_SIM_CONFIG });
    s.rival.players.mid.alive = false;
    expect(decidePitOwner(s, "rival", () => 0.99)).toBe("user");
    expect(decidePitOwner(s, "user", () => 0)).toBe("user");
  });

  it("o time que vence a luta no poco leva o dragao na grande maioria das vezes", () => {
    let dono = 0;
    let total = 0;
    for (let seed = 0; seed < 400; seed++) {
      const s = createInitialMatchState(flat("u", 85), flat("r", 65), { config: DEFAULT_SIM_CONFIG });
      s.gameTimeSec = 1100;
      s.objectives.dragonAlive = true;
      s.objectives.dragonElement = "infernal";
      const evs = resolveContestedObjective(s, "dragon", mulberry32(seed));
      const obj = evs.find((e) => e.objectiveKind === "dragon" && e.actors.length > 0)!;
      const vivosU = ROLES.filter((r) => s.user.players[r].alive).length;
      const vivosR = ROLES.filter((r) => s.rival.players[r].alive).length;
      if (vivosU === vivosR || obj.stolen) continue;
      total++;
      if ((vivosU > vivosR ? "user" : "rival") === obj.side) dono++;
    }
    expect(total).toBeGreaterThan(100);
    expect(dono / total).toBe(1);
  });

  it("decidePitOwner: com o mesmo numero de vivos decide o duelo de Smite (securePower com sorteio)", () => {
    const s = createInitialMatchState(flat("u", 80), flat("r", 65), { config: DEFAULT_SIM_CONFIG });
    s.gameTimeSec = 1100;
    s.user.players.top.alive = false;
    s.rival.players.top.alive = false;
    expect(aliveCount(s.user)).toBe(aliveCount(s.rival));
    const fraco = securePower(s, "rival");
    const forte = securePower(s, "user");
    expect(forte).toBeGreaterThan(fraco);
    // O sorteio multiplica o poder por 0,8 + draw x 0,4. Com os draws [0,999; 0] abaixo, o fraco
    // vence quando fraco x 1,1996 >= forte x 0,8, ou seja, razao <= 1,1996 / 0,8 = 1,4995. Os
    // limites de 1,05 e 1,45 deixam folga dos dois lados (esta dupla da razao de cerca de 1,23): o
    // forte vence no sorteio neutro com sobra, e o fraco ainda vence no sorteio extremo.
    const razao = forte / fraco;
    expect(razao).toBeGreaterThan(1.05);
    expect(razao).toBeLessThan(1.45);

    // Sorteio neutro nos dois lados: vence o de mais poder, de qualquer lado que "tente".
    expect(decidePitOwner(s, "user", () => 0.5)).toBe("user");
    expect(decidePitOwner(s, "rival", () => 0.5)).toBe("user");

    // O sorteio conta: o fraco tentando com o draw alto e o forte com o draw baixo leva o poco.
    const draws = [0.999, 0];
    let usados = 0;
    expect(decidePitOwner(s, "rival", () => draws[usados++])).toBe("rival");
    expect(usados).toBe(2);
  });

  it("nunca ha roubo por time varrido na luta do poco, mesmo com o sorteio de roubo forcado a disparar", () => {
    let varridos = 0;
    for (let seed = 0; seed < 400; seed++) {
      const s = createInitialMatchState(flat("u", 95), flat("r", 55), { config: DEFAULT_SIM_CONFIG });
      s.gameTimeSec = 1500;
      s.objectives.baronAlive = true;
      matar(s, "rival", ["top", "mid", "adc"]); // sobram o jungler e o suporte, que a luta varre
      const evs = resolveContestedObjective(s, "baron", forcaRouboSeVarrido(s, mulberry32(seed)));
      const obj = evs.find((e) => e.objectiveKind === "baron")!;
      // Quem roubou (obj.side num roubo) tem de ter alguem vivo.
      if (obj.stolen) expect(aliveCount(s[obj.side])).toBeGreaterThan(0);
      if (aliveCount(s.user) === 0 || aliveCount(s.rival) === 0) {
        varridos++;
        expect(obj.stolen).toBeFalsy();
      }
    }
    expect(varridos).toBeGreaterThan(100);
  });

  it("a janela de conversao tambem nao deixa um time varrido na luta roubar o objetivo", () => {
    let varridos = 0;
    let disputados = 0;
    for (let seed = 0; seed < 400; seed++) {
      const s = createInitialMatchState(flat("u", 95), flat("r", 55), { config: DEFAULT_SIM_CONFIG });
      s.gameTimeSec = 1100;
      s.objectives.dragonAlive = true;
      s.objectives.dragonElement = "infernal";
      // Emenda de 2026-10-02: a janela so converte objetivo com o preparo do lado comecado.
      s.objectivePrep.user.dragon = 50;
      // 2 contra 1 (so o jungler do rival vivo, para a contestacao do dragao ser provavel).
      matar(s, "user", ["top", "mid", "adc"]);
      matar(s, "rival", ["top", "mid", "adc", "support"]);
      s.lastFightWon = { side: "user", place: "river_bot", atSec: s.gameTimeSec };
      const evs = resolveConversion(s, "user", forcaRouboSeVarrido(s, mulberry32(seed)));
      const obj = evs.find((e) => e.objectiveKind === "dragon")!;
      if (!obj.contested) continue;
      disputados++;
      if (obj.stolen) expect(aliveCount(s[obj.side])).toBeGreaterThan(0);
      if (aliveCount(s.user) === 0 || aliveCount(s.rival) === 0) {
        varridos++;
        expect(obj.stolen).toBeFalsy();
      }
    }
    expect(disputados).toBeGreaterThan(100);
    expect(varridos).toBeGreaterThan(50);
  });
});
