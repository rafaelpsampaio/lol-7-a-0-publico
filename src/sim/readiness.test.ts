import { describe, it, expect } from "vitest";
import { createInitialMatchState, recomputeDerived, ROLES, DEFAULT_SIM_CONFIG, type MatchState } from "./matchState";
import {
  junglerFirstClearSec, junglerReady, laneEdge, bestEdgeLane, laneAllInChance, phasePickScale,
  updateObjectivePrep, prepGain, takeAttempt, PREP_FULL, isObjectivePreparable,
  bloodScale, fightResetSec, fightReason, towerUnderSiege,
} from "./readiness";
import {
  simulateMatch, resolveLaneAllIn, resolveObjectiveSetup, resolveConversion, teamfightAllowed, stealChanceFor,
} from "./engine";
import { updateObjectiveTimers, isObjectiveAvailable, takeObjective } from "./objectives";
import { DEFAULT_REALISM_TUNING } from "./tuning";
import { mulberry32 } from "./rng";
import type { PlayerVersion, Role } from "../data/schema";

function roster(prefix: string, stat: number, over: Partial<Record<Role, number>> = {}): PlayerVersion[] {
  return ROLES.map((role: Role) => {
    const s = over[role] ?? stat;
    return {
      id: `${prefix}-${role}`, personId: `${prefix}-${role}`, displayName: `${prefix}-${role}`, year: 2024,
      roles: [role], primaryRole: role,
      roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: s },
      lanePhase: s, midGame: s, lateGame: s, traits: [],
      championPool: [{ championId: "c0", mastery: 3 as const }],
    };
  });
}

function stateAt(sec: number, u: PlayerVersion[], r: PlayerVersion[]): MatchState {
  const s = createInitialMatchState(u, r, { config: DEFAULT_SIM_CONFIG });
  s.gameTimeSec = sec;
  return s;
}

const jungleOf = (rs: PlayerVersion[]) => rs.find((p) => p.primaryRole === "jungle")!;

describe("relogio do jungler (spec calendario secao 2)", () => {
  it("1o clear: 190 s em early 75, mais cedo para jungler forte de early, com teto e piso", () => {
    expect(junglerFirstClearSec(jungleOf(roster("u", 75)))).toBe(190);
    expect(junglerFirstClearSec(jungleOf(roster("u", 80)))).toBe(187);
    expect(junglerFirstClearSec(jungleOf(roster("u", 100)))).toBe(175);
    expect(junglerFirstClearSec(jungleOf(roster("u", 1)))).toBe(225);
    expect(junglerFirstClearSec({ ...jungleOf(roster("u", 75)), lanePhase: 200 })).toBe(170);
  });

  it("junglerReady vira verdadeiro no instante do clear", () => {
    const u = roster("u", 75);
    expect(junglerReady(stateAt(175, u, u), "user")).toBe(false);
    expect(junglerReady(stateAt(190, u, u), "user")).toBe(true);
  });
});

describe("all-in de rota e pick no early", () => {
  it("vantagem de rota e a rota de maior vantagem", () => {
    const s = stateAt(120, roster("u", 75, { mid: 95 }), roster("r", 75));
    expect(laneEdge(s, "user", "mid")).toBeGreaterThan(15);
    expect(bestEdgeLane(s, "user")).toBe("mid");
    expect(laneEdge(s, "rival", "mid")).toBeLessThan(0);
  });

  it("chance zero antes de 1:30, zero sem vantagem acima do piso, cresce com a vantagem, teto 0,5", () => {
    const u = roster("u", 75, { mid: 95 });
    const r = roster("r", 75);
    expect(laneAllInChance(stateAt(75, u, r), "user", "mid")).toBe(0);
    expect(laneAllInChance(stateAt(120, u, r), "user", "top")).toBe(0);
    const forte = laneAllInChance(stateAt(120, u, r), "user", "mid");
    const fraca = laneAllInChance(stateAt(120, roster("u", 75, { mid: 85 }), r), "user", "mid");
    expect(forte).toBeGreaterThan(fraca);
    expect(fraca).toBeGreaterThan(0);
    expect(forte).toBeLessThanOrEqual(0.5);
  });

  it("pick mais caro ate 14:00", () => {
    const u = roster("u", 75);
    expect(phasePickScale(stateAt(600, u, u))).toBe(DEFAULT_REALISM_TUNING.earlyPickScale);
    expect(phasePickScale(stateAt(840, u, u))).toBe(1);
  });

  it("all-in com o jogador da rota inimiga morto nao gera abate; com ele vivo, gera o first blood na rota", () => {
    const u = roster("u", 75, { mid: 95 });
    const r = roster("r", 75);
    const morto = stateAt(120, u, r);
    morto.rival.players.mid.alive = false;
    expect(resolveLaneAllIn(morto, "user", "mid", mulberry32(1))).toBeNull();
    expect(morto.user.kills).toBe(0);
    const vivo = stateAt(120, u, r);
    const e = resolveLaneAllIn(vivo, "user", "mid", mulberry32(1));
    expect(e?.kind).toBe("first_blood");
    expect(e?.lane).toBe("mid");
    expect(vivo.user.kills).toBe(1);
  });

  it("all-in com a mesma persona nos dois lados (cards diferentes) mata e loga duplicidade-roster", () => {
    const u = roster("u", 75, { mid: 95 });
    const r = roster("r", 75).map((p) => (p.primaryRole === "mid" ? { ...p, personId: u[ROLES.indexOf("mid")].personId } : p));
    const s = stateAt(120, u, r);
    const e = resolveLaneAllIn(s, "user", "mid", mulberry32(1));
    expect(e?.kind).toBe("first_blood");
    expect(s.user.kills).toBe(1);
    expect(s.rival.players.mid.alive).toBe(false);
    expect(s.diagnostics).toEqual([
      {
        tipo: "duplicidade-roster",
        cardId: "u-mid",
        personId: "u-mid",
        displayName: "u-mid",
        teamId: "user",
        timeSec: 120,
      },
    ]);
  });

  it("all-in com o mesmo card nos dois lados e suprimido e loga self-kill-ilegal", () => {
    const u = roster("u", 75, { mid: 95 });
    const r = roster("r", 75).map((p) => (p.primaryRole === "mid" ? { ...u[ROLES.indexOf("mid")] } : p));
    const s = stateAt(120, u, r);
    expect(resolveLaneAllIn(s, "user", "mid", mulberry32(1))).toBeNull();
    expect(s.user.kills).toBe(0);
    expect(s.rival.players.mid.alive).toBe(true);
    expect(s.firstBloodDone).toBe(false);
    expect(s.diagnostics).toEqual([
      {
        tipo: "self-kill-ilegal",
        cardId: "u-mid",
        personId: "u-mid",
        displayName: "u-mid",
        teamId: "user",
        timeSec: 120,
      },
    ]);
  });
});

describe("relogio do early na partida inteira", () => {
  const MATCHUPS: Array<[number, number]> = [[75, 75], [90, 60], [60, 90]];

  it("nenhum abate antes de 1:30; antes do 1o clear do primeiro jungler, abate so em rota (all-in)", () => {
    for (const [a, b] of MATCHUPS) {
      for (let seed = 1; seed <= 80; seed++) {
        const u = roster("u", a);
        const r = roster("r", b);
        const res = simulateMatch(u, r, mulberry32(seed));
        // Depois do clear de um jungler, o lado dele ja pode fazer pick no rio; antes do primeiro
        // clear, so o all-in de rota mata.
        const firstReady = Math.min(junglerFirstClearSec(jungleOf(u)), junglerFirstClearSec(jungleOf(r)));
        let prev = 0;
        for (const e of res.timeline) {
          const k = e.score.userKills + e.score.rivalKills;
          if (k > prev) {
            expect(e.timeSec).toBeGreaterThanOrEqual(90);
            if (e.timeSec < firstReady) expect(["top", "mid", "bot"]).toContain(e.lane);
          }
          prev = k;
        }
      }
    }
  });

  it("sem gank antes do 1o clear do jungler do lado", () => {
    for (const [a, b] of MATCHUPS) {
      for (let seed = 1; seed <= 80; seed++) {
        const u = roster("u", a);
        const r = roster("r", b);
        const res = simulateMatch(u, r, mulberry32(seed));
        for (const e of res.timeline) {
          if (e.kind !== "gank") continue;
          const clear = junglerFirstClearSec(jungleOf(e.side === "user" ? u : r));
          expect(e.timeSec).toBeGreaterThanOrEqual(clear);
        }
      }
    }
  });

});

function withDragon(sec: number, u = roster("u", 75), r = roster("r", 75)): MatchState {
  const s = stateAt(sec, u, r);
  s.objectives.dragonAlive = true;
  s.objectives.dragonElement = "infernal";
  s.objectives.dragonRespawnAtSec = null;
  return s;
}

describe("preparo de objetivo (spec calendario secao 4)", () => {
  it("ganho: zero sem jungler vivo ou com gente a menos; maior com prioridade; epico com taxa propria", () => {
    const s = withDragon(400);
    const base = prepGain(s, "user", "dragon");
    expect(base).toBeGreaterThan(0);
    const semJg = withDragon(400);
    semJg.user.players.jungle.alive = false;
    expect(prepGain(semJg, "user", "dragon")).toBe(0);
    const menos = withDragon(400);
    menos.user.players.top.alive = false;
    expect(prepGain(menos, "user", "dragon")).toBe(0);
    const forte = withDragon(400, roster("u", 75, { mid: 90, adc: 90, support: 90 }));
    expect(prepGain(forte, "user", "dragon")).toBeGreaterThan(base);
    s.objectives.baronAlive = true;
    s.gameTimeSec = 1300;
    // Emenda de 2026-10-02: o epico tem taxa propria; o que precisa ser mais lento e o tempo de
    // preparo, conferido no gate (baronSetupDelaySec > dragonSetupDelaySec).
    expect(prepGain(s, "user", "baron") / prepGain(s, "user", "dragon")).toBeCloseTo(
      DEFAULT_REALISM_TUNING.prepRateEpic / DEFAULT_REALISM_TUNING.prepRateMinor,
      10
    );
  });

  it("cresce com a intencao, decai sem ela, teto 100, e o aviso sai uma vez por nascimento", () => {
    const s = withDragon(400);
    let avisos = 0;
    for (let i = 0; i < 40; i++) avisos += updateObjectivePrep(s, { user: "dragon", rival: null }).length;
    expect(s.objectivePrep.user.dragon).toBe(PREP_FULL);
    expect(avisos).toBe(1);
    updateObjectivePrep(s, { user: null, rival: null });
    expect(s.objectivePrep.user.dragon).toBe(PREP_FULL - DEFAULT_REALISM_TUNING.prepDecay);
    expect(s.objectivePrep.rival.dragon).toBe(0);
  });

  it("objetivo que some no meio do preparo zera o preparo e rearma o aviso", () => {
    const s = stateAt(1170, roster("u", 75), roster("r", 75));
    s.objectives.heraldAlive = true;
    for (let i = 0; i < 10; i++) updateObjectivePrep(s, { user: "herald", rival: null });
    expect(s.prepAnnounced.user.herald).toBe(true);
    s.gameTimeSec = 1185;
    updateObjectiveTimers(s, mulberry32(1));
    expect(isObjectiveAvailable(s, "herald")).toBe(false);
    updateObjectivePrep(s, { user: null, rival: null });
    expect(s.objectivePrep.user.herald).toBe(0);
    expect(s.prepAnnounced.user.herald).toBe(false);
  });

  it("tentativa de tomada: so com preparo cheio e escolhendo preparar; o de maior prioridade primeiro", () => {
    const s = withDragon(600);
    s.objectivePrep.user.dragon = 99;
    expect(takeAttempt(s, { user: "dragon", rival: null })).toBeNull();
    s.objectivePrep.user.dragon = PREP_FULL;
    expect(takeAttempt(s, { user: null, rival: null })).toBeNull();
    expect(takeAttempt(s, { user: "dragon", rival: null })).toEqual({ side: "user", kind: "dragon" });
    s.objectives.voidgrubsAlive = 3;
    s.objectivePrep.rival.voidgrubs = PREP_FULL;
    expect(takeAttempt(s, { user: "dragon", rival: "voidgrubs" })).toEqual({ side: "user", kind: "dragon" });
  });
});

describe("zera na tomada (spec calendario secao 4)", () => {
  it("depois de uma tomada, o proximo tick zera o preparo e rearma o aviso", () => {
    const s = withDragon(600);
    s.objectivePrep.user.dragon = PREP_FULL;
    s.prepAnnounced.user.dragon = true;
    takeObjective(s, "user", "dragon", mulberry32(1));
    expect(isObjectiveAvailable(s, "dragon")).toBe(false);
    // Mesmo com a intencao de preparar o dragao, o objetivo tomado nao aceita preparo.
    updateObjectivePrep(s, { user: "dragon", rival: null });
    expect(s.objectivePrep.user.dragon).toBe(0);
    expect(s.prepAnnounced.user.dragon).toBe(false);
  });

  it("depois de uma tomada pela janela de conversao, o proximo tick zera o preparo e rearma o aviso", () => {
    const s = withDragon(600);
    // Mais um vivo do lado do user, na rota do poco do dragao (bot); preparo acima do ponto do aviso.
    s.rival.players.top.alive = false;
    s.lastFightWon = { side: "user", place: "bot", atSec: s.gameTimeSec };
    s.objectivePrep.user.dragon = 60;
    s.prepAnnounced.user.dragon = true;
    // rng alto: sem contestacao, a janela toma o dragao direto.
    const evs = resolveConversion(s, "user", () => 0.999);
    expect(evs.some((e) => e.kind === "dragon_taken" && e.side === "user" && !e.contested)).toBe(true);
    expect(isObjectiveAvailable(s, "dragon")).toBe(false);
    updateObjectivePrep(s, { user: null, rival: null });
    expect(s.objectivePrep.user.dragon).toBe(0);
    expect(s.prepAnnounced.user.dragon).toBe(false);
  });
});

describe("tomada com preparo (resolveObjectiveSetup)", () => {
  it("lado com preparo cheio e o outro longe: toma sem disputa", () => {
    const s = withDragon(600);
    s.objectivePrep.user.dragon = PREP_FULL;
    const out = resolveObjectiveSetup(s, "setup_dragon", "farm", mulberry32(3));
    expect(out.done).toBe(true);
    expect(out.events.some((e) => e.kind === "dragon_taken" && e.side === "user" && !e.contested)).toBe(true);
    expect(isObjectiveAvailable(s, "dragon")).toBe(false);
  });

  it("os dois preparando ate encher: vira luta no poco e o objetivo sai (sem impasse)", () => {
    const s = withDragon(600);
    s.objectivePrep.user.dragon = 95;
    s.objectivePrep.rival.dragon = 95;
    const out = resolveObjectiveSetup(s, "setup_dragon", "setup_dragon", mulberry32(7));
    expect(out.done).toBe(true);
    expect(out.events.some((e) => (e.kind === "dragon_taken" || e.kind === "dragon_steal") && e.contested)).toBe(true);
    expect(isObjectiveAvailable(s, "dragon")).toBe(false);
  });

  it("outro lado com preparo de pelo menos metade, mesmo sem escolher preparar: disputa", () => {
    const s = withDragon(600);
    s.objectivePrep.user.dragon = PREP_FULL;
    s.objectivePrep.rival.dragon = 60;
    const out = resolveObjectiveSetup(s, "setup_dragon", "farm", mulberry32(5));
    expect(out.done).toBe(true);
    expect(out.events.some((e) => e.objectiveKind === "dragon" && e.contested)).toBe(true);
  });

  it("preparo incompleto nao toma; outro lado agressivo impede a tomada e o tick segue", () => {
    const s = withDragon(600);
    s.objectivePrep.user.dragon = 40;
    expect(resolveObjectiveSetup(s, "setup_dragon", "farm", mulberry32(1)).done).toBe(false);
    const t = withDragon(600);
    t.objectivePrep.user.dragon = PREP_FULL;
    expect(resolveObjectiveSetup(t, "setup_dragon", "pickoff", mulberry32(1)).done).toBe(false);
    expect(isObjectiveAvailable(t, "dragon")).toBe(true);
  });

  it("na partida inteira, toda tomada sem disputa e fora da janela vem depois de um aviso de preparo do mesmo lado", () => {
    for (const [a, b] of [[75, 75], [85, 70]] as Array<[number, number]>) {
      for (let seed = 1; seed <= 40; seed++) {
        const res = simulateMatch(roster("u", a), roster("r", b), mulberry32(seed));
        const lastTake: Record<string, number> = {};
        const announced = new Map<string, number>();
        for (const e of res.timeline) {
          if (e.kind === "objective_setup") announced.set(`${e.side}:${e.objectiveKind}`, e.timeSec);
          const take = e.objectiveKind !== null && e.actors.length > 0 && (e.kind.endsWith("_taken") || e.kind.endsWith("_steal"));
          if (!take) continue;
          const kind = e.objectiveKind as string;
          const fromWindow = /^(Com |Após o ACE)/.test(e.ticker);
          if (!e.contested && !fromWindow) {
            const at = announced.get(`${e.side}:${kind}`);
            expect(at).toBeDefined();
            expect(at!).toBeGreaterThan(lastTake[kind] ?? -1);
          }
          lastTake[kind] = e.timeSec;
        }
      }
    }
  });
});

/** Estado sem motivo de luta: nenhum objetivo vivo nem nascendo, sem buff, sem cerco. */
function quietState(sec: number, chaos = 0.25): MatchState {
  const s = createInitialMatchState(roster("u", 75), roster("r", 75), {
    config: { ...DEFAULT_SIM_CONFIG, comebackElasticity: chaos },
  });
  for (const team of [s.user, s.rival]) {
    for (const r of ROLES) team.players[r].metricsBase = { ...team.players[r].metricsBase, laneVolatility: 0 };
  }
  s.gameTimeSec = sec;
  recomputeDerived(s);
  const o = s.objectives;
  o.dragonAlive = false;
  o.dragonRespawnAtSec = sec + 200;
  o.baronAlive = false;
  o.baronRespawnAtSec = sec + 200;
  o.heraldAlive = false;
  o.heraldDone = true;
  s.lastFightSec = -999;
  return s;
}

describe("escala de sangue e reset (spec calendario secao 3)", () => {
  it("vale 1 no Caos de referencia, cresce com o slider e nunca cai abaixo de 0,6", () => {
    expect(bloodScale(quietState(1500, 0.25))).toBeCloseTo(1, 10);
    expect(bloodScale(quietState(1500, 1))).toBeGreaterThan(bloodScale(quietState(1500, 0.5)));
    expect(bloodScale(quietState(1500, 0))).toBeGreaterThanOrEqual(0.6);
    expect(Number.isFinite(bloodScale(quietState(1500, 1)))).toBe(true);
  });

  it("reset por fase, encurtado pela escala de sangue", () => {
    const t = DEFAULT_REALISM_TUNING;
    expect(fightResetSec(quietState(600))).toBeCloseTo(t.fightResetEarly, 10);
    expect(fightResetSec(quietState(1000))).toBeCloseTo(t.fightResetMid, 10);
    expect(fightResetSec(quietState(1600))).toBeCloseTo(t.fightResetLate, 10);
    expect(fightResetSec(quietState(1600, 1))).toBeLessThan(fightResetSec(quietState(1600, 0.25)));
  });
});

describe("motivo de luta (spec calendario secao 3)", () => {
  it("sem objetivo, buff ou cerco: nao ha motivo", () => {
    expect(fightReason(quietState(1600))).toBe(false);
  });

  it("cada motivo sozinho basta", () => {
    const dragao = quietState(1600);
    dragao.objectives.dragonAlive = true;
    expect(fightReason(dragao)).toBe(true);
    const nascendo = quietState(1600);
    nascendo.objectives.baronRespawnAtSec = 1650;
    expect(fightReason(nascendo)).toBe(true);
    const buff = quietState(1600);
    buff.buffs.baronUntilSec.user = 1700;
    expect(fightReason(buff)).toBe(true);
    const cerco = quietState(1600);
    cerco.rival.structureDamage.mid.outerDamage = 75;
    cerco.rival.structureDamage.mid.lastStructureDamageAtSec = 1570;
    expect(towerUnderSiege(cerco)).toBe(true);
    expect(fightReason(cerco)).toBe(true);
    cerco.rival.structureDamage.mid.lastStructureDamageAtSec = 1500;
    expect(towerUnderSiege(cerco)).toBe(false);
  });

  it("5v5 precisa de gatilho, reset passado e motivo", () => {
    const s = quietState(1600);
    expect(teamfightAllowed(s, "force_fight", "farm")).toBe(false);
    s.objectives.baronAlive = true;
    expect(teamfightAllowed(s, "force_fight", "farm")).toBe(true);
    expect(teamfightAllowed(s, "farm", "farm")).toBe(false);
    s.lastFightSec = 1590;
    expect(teamfightAllowed(s, "force_fight", "farm")).toBe(false);
  });
});

describe("Caos na partida inteira", () => {
  it("mais Caos, mais abates (60 partidas 75 x 75, slider 0,1 contra 0,9)", () => {
    const killsAt = (chaos: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const r = simulateMatch(roster("u", 75), roster("r", 75), mulberry32(seed), {
          ...DEFAULT_SIM_CONFIG,
          comebackElasticity: chaos,
        });
        sum += r.finalState.user.kills + r.finalState.rival.kills;
      }
      return sum / 60;
    };
    expect(killsAt(0.9)).toBeGreaterThan(killsAt(0.1));
  });
});

describe("preparo antes do respawn do dragao (emenda 2 de 2026-10-02)", () => {
  it("a partir do 2o dragao, aceita preparo ate 60 s antes de renascer; o 1o so vivo; depois da Alma, nao", () => {
    const s = stateAt(900, roster("u", 75), roster("r", 75));
    const o = s.objectives;
    o.dragonAlive = false;
    o.dragonsTaken = 1;
    o.dragonRespawnAtSec = 990; // 90 s
    expect(isObjectivePreparable(s, "dragon")).toBe(false);
    o.dragonRespawnAtSec = 950; // 50 s
    expect(isObjectivePreparable(s, "dragon")).toBe(true);
    o.dragonRespawnAtSec = null; // depois da Alma nao nasce mais dragao elemental
    expect(isObjectivePreparable(s, "dragon")).toBe(false);
    const primeiro = stateAt(250, roster("u", 75), roster("r", 75)); // o 1o nasce aos 300
    expect(isObjectivePreparable(primeiro, "dragon")).toBe(false);
  });

  it("o preparo cresce antes do respawn, mas a tomada so acontece com o dragao vivo", () => {
    const s = stateAt(900, roster("u", 75), roster("r", 75));
    const o = s.objectives;
    o.dragonAlive = false;
    o.dragonsTaken = 1;
    o.dragonRespawnAtSec = 950;
    for (let i = 0; i < 12; i++) updateObjectivePrep(s, { user: "dragon", rival: null });
    expect(s.objectivePrep.user.dragon).toBe(PREP_FULL);
    expect(takeAttempt(s, { user: "dragon", rival: null })).toBeNull();
    o.dragonAlive = true;
    o.dragonElement = "infernal";
    o.dragonRespawnAtSec = null;
    expect(takeAttempt(s, { user: "dragon", rival: null })).toEqual({ side: "user", kind: "dragon" });
  });

  it("na partida inteira, ha aviso de preparo de dragao antes do respawn", () => {
    let antes = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const res = simulateMatch(roster("u", 75), roster("r", 75), mulberry32(seed));
      for (const e of res.timeline) {
        if (e.kind === "objective_setup" && e.objectiveKind === "dragon" && !e.map.dragonAlive) antes++;
      }
    }
    expect(antes).toBeGreaterThan(0);
  });
});

describe("Caos alto e roubo (emenda 2 de 2026-10-02)", () => {
  it("Caos alto dispensa o motivo de luta; no Caos padrao, nao", () => {
    expect(teamfightAllowed(quietState(1600, 0.25), "force_fight", "farm")).toBe(false);
    expect(teamfightAllowed(quietState(1600, 1), "force_fight", "farm")).toBe(true);
  });

  it("a chance base de roubo vem do tuning (stealBase)", () => {
    // Dois overrides explicitos, sem depender do valor de DEFAULT_REALISM_TUNING.
    const comStealBase = (stealBase: number): MatchState => {
      const s = createInitialMatchState(roster("u", 75), roster("r", 75), {
        config: { ...DEFAULT_SIM_CONFIG, tuning: { stealBase } },
      });
      s.gameTimeSec = 600;
      return s;
    };
    expect(stealChanceFor(comStealBase(0.02), "rival", "dragon")).toBeLessThan(
      stealChanceFor(comStealBase(0.2), "rival", "dragon")
    );
  });
});
