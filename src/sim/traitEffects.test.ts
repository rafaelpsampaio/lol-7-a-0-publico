import { describe, it, expect } from "vitest";
import { traitState } from "../__tests__/helpers/traitRoster";
import { fightPower } from "./power";
import { killerScore, victimScore, type FightContext } from "./selection";
import type { MatchState } from "./matchState";
import type { EventKind } from "./simEvents";
import { PREP_ANNOUNCE_AT, prepGain } from "./readiness";
import { stealChanceFor } from "./engine";
import type { MacroIntent } from "./engine";
import type { ObjectiveKind } from "./objectives";
import {
  TRAIT_TUNING,
  activeHolder,
  applyRoamCost,
  applyTraitIntentBiases,
  objectiveLoverExposure,
  objectiveLoverPrepMult,
  objectiveLoverStealBonus,
  roamerFor,
  sideForceBonus,
  sidePressureBonus,
  sidePressureShift,
  sideSplitLane,
  flipsDuels,
  flipsWinChance,
  teamfightsSliceBonus,
  traitActive,
  traitKillerWeight,
  traitVictimWeight,
} from "./traitEffects";

function ctx(state: MatchState, eventType: EventKind): FightContext {
  return { eventType, minute: 20, state, goldLead: 0, teamDeaths: 0, lowHpTargets: false, gameSec: 1200 };
}

describe("traitActive e activeHolder", () => {
  it("so vale com o portador vivo e sem quit", () => {
    const s = traitState({ mid: ["teamfights"] });
    const mid = s.user.players.mid;
    expect(traitActive(mid, "teamfights")).toBe(true);
    expect(activeHolder(s.user, "teamfights")).toBe(mid);
    mid.alive = false;
    expect(traitActive(mid, "teamfights")).toBe(false);
    mid.alive = true;
    mid.away = true;
    expect(traitActive(mid, "teamfights")).toBe(false);
    expect(activeHolder(s.user, "teamfights")).toBeNull();
    expect(activeHolder(s.rival, "teamfights")).toBeNull();
  });
});

describe("teamfights (3.1)", () => {
  it("bonus de fatia so no portador em jogo", () => {
    const s = traitState({ mid: ["teamfights"] });
    expect(teamfightsSliceBonus(s.user.players.mid)).toBe(TRAIT_TUNING.teamfightsSliceBonus);
    expect(teamfightsSliceBonus(s.rival.players.mid)).toBe(0);
    s.user.players.mid.alive = false;
    expect(teamfightsSliceBonus(s.user.players.mid)).toBe(0);
  });

  it("fightPower sobe com o portador vivo e volta ao neutro com ele morto", () => {
    const comTrait = traitState({ mid: ["teamfights"] });
    const semTrait = traitState();
    expect(fightPower(comTrait, "user")).toBeGreaterThan(fightPower(semTrait, "user"));
    comTrait.user.players.mid.alive = false;
    semTrait.user.players.mid.alive = false;
    expect(fightPower(comTrait, "user")).toBe(fightPower(semTrait, "user"));
  });

  it("pesos so na luta em grupo (comeback_fight)", () => {
    const s = traitState({ mid: ["teamfights"] });
    const mid = s.user.players.mid;
    expect(traitKillerWeight(mid, ctx(s, "comeback_fight"))).toBe(TRAIT_TUNING.teamfightsKillerWeight);
    expect(traitVictimWeight(mid, ctx(s, "comeback_fight"))).toBe(TRAIT_TUNING.teamfightsVictimWeight);
    expect(traitKillerWeight(mid, ctx(s, "solo_kill"))).toBe(1);
    expect(traitVictimWeight(mid, ctx(s, "gank"))).toBe(1);
    expect(traitKillerWeight(s.rival.players.mid, ctx(s, "comeback_fight"))).toBe(1);
  });

  it("killerScore e victimScore aplicam o peso", () => {
    const s = traitState({ mid: ["teamfights"] });
    const c = ctx(s, "comeback_fight");
    expect(killerScore(s.user.players.mid, c) / killerScore(s.rival.players.mid, c)).toBeCloseTo(1.4, 10);
    expect(victimScore(s.user.players.mid, c) / victimScore(s.rival.players.mid, c)).toBeCloseTo(0.85, 10);
  });
});

describe("flips (3.2)", () => {
  it("pesos de quem mata e de vitima em qualquer evento", () => {
    const s = traitState({ mid: ["flips"] });
    const mid = s.user.players.mid;
    for (const ev of ["comeback_fight", "solo_kill", "gank"] as const) {
      expect(traitKillerWeight(mid, ctx(s, ev))).toBe(TRAIT_TUNING.flipsKillerWeight);
      expect(traitVictimWeight(mid, ctx(s, ev))).toBe(TRAIT_TUNING.flipsVictimWeight);
    }
  });

  it("flipsWinChance: 0,5 parelho, limites 0,15 e 0,85", () => {
    expect(flipsWinChance(0, 0)).toBe(0.5);
    expect(flipsWinChance(8, 12)).toBeCloseTo(0.8, 10);
    expect(flipsWinChance(40, 0)).toBe(0.85);
    expect(flipsWinChance(-40, 0)).toBe(0.15);
  });

  it("flipsDuels: janela de 1:30 a 14:00, portador e inimigo vivos na rota", () => {
    const s = traitState({ mid: ["flips"] });
    s.gameTimeSec = 60;
    expect(flipsDuels(s)).toEqual([]);
    s.gameTimeSec = 120;
    expect(flipsDuels(s)).toEqual([{ holderSide: "user", holder: s.user.players.mid, lane: "mid" }]);
    s.rival.players.mid.alive = false;
    expect(flipsDuels(s)).toEqual([]);
    s.rival.players.mid.alive = true;
    s.user.players.mid.alive = false;
    expect(flipsDuels(s)).toEqual([]);
    s.user.players.mid.alive = true;
    s.gameTimeSec = 840;
    expect(flipsDuels(s)).toEqual([]);
  });

  it("flipsDuels: dois portadores na mesma rota viram uma entrada, do lado user (Review Focus 1)", () => {
    const s = traitState({ mid: ["flips"] }, { mid: ["flips"] });
    s.gameTimeSec = 300;
    const duels = flipsDuels(s);
    expect(duels).toHaveLength(1);
    expect(duels[0].holderSide).toBe("user");
  });

  it("flipsDuels: na rota de baixo basta um inimigo vivo", () => {
    const s = traitState({ support: ["flips"] });
    s.gameTimeSec = 300;
    s.rival.players.adc.alive = false;
    expect(flipsDuels(s)).toEqual([{ holderSide: "user", holder: s.user.players.support, lane: "bot" }]);
  });

  it("sem portador: lista vazia", () => {
    const s = traitState();
    s.gameTimeSec = 300;
    expect(flipsDuels(s)).toEqual([]);
  });
});

describe("dragon_lover, Ama objetivos (3.3)", () => {
  const all = (_k: ObjectiveKind) => true;

  it("objectiveLoverContestAt e igual a PREP_ANNOUNCE_AT", () => {
    expect(TRAIT_TUNING.objectiveLoverContestAt).toBe(PREP_ANNOUNCE_AT);
  });

  it("insiste nos objetivos dele e vai ao poco quando o inimigo prepara", () => {
    const s = traitState({ jungle: ["dragon_lover"] });
    const w: Partial<Record<MacroIntent, number>> = { farm: 4 };
    applyTraitIntentBiases(s, "user", w, (k) => k === "dragon");
    expect(w).toEqual({ farm: 4, setup_dragon: 1.5 });
    s.objectivePrep.rival.dragon = 60;
    const w2: Partial<Record<MacroIntent, number>> = {};
    applyTraitIntentBiases(s, "user", w2, (k) => k === "dragon");
    expect(w2.setup_dragon).toBeCloseTo(3.5, 10);
    const w3: Partial<Record<MacroIntent, number>> = {};
    applyTraitIntentBiases(s, "user", w3, all);
    expect(Object.keys(w3).sort()).toEqual(["setup_dragon", "setup_herald", "setup_voidgrubs"]);
  });

  it("sem portador em jogo nao mexe nos pesos", () => {
    const s = traitState({ jungle: ["dragon_lover"] });
    s.user.players.jungle.alive = false;
    const w: Partial<Record<MacroIntent, number>> = { farm: 4 };
    applyTraitIntentBiases(s, "user", w, all);
    expect(w).toEqual({ farm: 4 });
    const plain = traitState();
    applyTraitIntentBiases(plain, "user", w, all);
    expect(w).toEqual({ farm: 4 });
  });

  it("preparo 1,3x so com o time a frente e so nos objetivos dele", () => {
    const s = traitState({ jungle: ["dragon_lover"] });
    s.winProbUser = 0.6;
    expect(objectiveLoverPrepMult(s, "user", "dragon")).toBe(1.3);
    expect(objectiveLoverPrepMult(s, "user", "baron")).toBe(1);
    s.winProbUser = 0.5;
    expect(objectiveLoverPrepMult(s, "user", "dragon")).toBe(1);
    const r = traitState({}, { jungle: ["dragon_lover"] });
    r.winProbUser = 0.3;
    expect(objectiveLoverPrepMult(r, "rival", "herald")).toBe(1.3);
  });

  it("prepGain do motor aplica o multiplicador", () => {
    const com = traitState({ jungle: ["dragon_lover"] });
    const sem = traitState();
    com.winProbUser = 0.7;
    sem.winProbUser = 0.7;
    expect(prepGain(com, "user", "dragon")).toBeCloseTo(prepGain(sem, "user", "dragon") * 1.3, 10);
  });

  it("roubo +0,10 nos objetivos dele", () => {
    const com = traitState({ jungle: ["dragon_lover"] });
    const sem = traitState();
    expect(objectiveLoverStealBonus(com, "user", "dragon")).toBe(0.1);
    expect(objectiveLoverStealBonus(com, "user", "baron")).toBe(0);
    expect(stealChanceFor(com, "user", "voidgrubs")).toBeCloseTo(stealChanceFor(sem, "user", "voidgrubs") + 0.1, 10);
  });

  it("fica exposto no tick em que o time prepara um objetivo dele", () => {
    const s = traitState({ jungle: ["dragon_lover"] });
    expect(objectiveLoverExposure(s.user, "setup_dragon")).toEqual({ "u-jungle": 0.5 });
    expect(objectiveLoverExposure(s.user, "setup_baron")).toBeUndefined();
    expect(objectiveLoverExposure(s.user, "farm")).toBeUndefined();
    expect(objectiveLoverExposure(traitState().user, "setup_dragon")).toBeUndefined();
  });

  it("peso de vitima 1,4 na luta no poco dos objetivos dele", () => {
    const s = traitState({ jungle: ["dragon_lover"] });
    const jg = s.user.players.jungle;
    expect(traitVictimWeight(jg, { ...ctx(s, "comeback_fight"), pitObjective: "dragon" })).toBe(1.4);
    expect(traitVictimWeight(jg, { ...ctx(s, "comeback_fight"), pitObjective: "baron" })).toBe(1);
    expect(traitVictimWeight(jg, ctx(s, "comeback_fight"))).toBe(1);
  });
});

describe("roamer (3.4)", () => {
  it("mais gank ate 14:00, so com roamer de rota em jogo", () => {
    const s = traitState({ mid: ["roamer"] });
    s.gameTimeSec = 400;
    const w: Partial<Record<MacroIntent, number>> = {};
    applyTraitIntentBiases(s, "user", w, () => false);
    expect(w).toEqual({ gank: TRAIT_TUNING.roamerGankBonus });
    s.gameTimeSec = 840;
    const w2: Partial<Record<MacroIntent, number>> = {};
    applyTraitIntentBiases(s, "user", w2, () => false);
    expect(w2).toEqual({});
  });

  it("roamer de jungle nao tem rota e nao roama (Review Focus 5)", () => {
    const s = traitState({ jungle: ["roamer"] });
    s.gameTimeSec = 400;
    const w: Partial<Record<MacroIntent, number>> = {};
    applyTraitIntentBiases(s, "user", w, () => false);
    expect(w).toEqual({});
    expect(roamerFor(s.user, "top")).toBeNull();
  });

  it("roamerFor: so em gank fora da rota dele", () => {
    const s = traitState({ mid: ["roamer"] });
    expect(roamerFor(s.user, "top")).toBe(s.user.players.mid);
    expect(roamerFor(s.user, "mid")).toBeNull();
    s.user.players.mid.alive = false;
    expect(roamerFor(s.user, "top")).toBeNull();
  });

  it("custo: a rota dele perde laneLead, com piso no teto negativo", () => {
    const s = traitState({ mid: ["roamer"] });
    s.user.laneState.mid.laneLead = 10;
    applyRoamCost(s.user, s.user.players.mid);
    expect(s.user.laneState.mid.laneLead).toBe(4);
    s.user.laneState.mid.laneLead = -58;
    applyRoamCost(s.user, s.user.players.mid);
    expect(s.user.laneState.mid.laneLead).toBe(-60);
  });
});

describe("side (3.5)", () => {
  it("so no meio de jogo, com o portador de rota em jogo", () => {
    const s = traitState({ top: ["side"] });
    s.phase = "early";
    expect(sideSplitLane(s, "user")).toBeNull();
    s.phase = "mid";
    expect(sideSplitLane(s, "user")).toBe("top");
    expect(sideForceBonus(s, "user", "top")).toBe(0.15);
    expect(sideForceBonus(s, "user", "bot")).toBe(0);
    const w: Partial<Record<MacroIntent, number>> = {};
    applyTraitIntentBiases(s, "user", w, () => false);
    expect(w).toEqual({ split_push: 1 });
    s.phase = "late";
    expect(sideSplitLane(s, "user")).toBeNull();
  });

  it("side de jungle nao tem rota (Review Focus 5)", () => {
    const s = traitState({ jungle: ["side"] });
    s.phase = "mid";
    expect(sideSplitLane(s, "user")).toBeNull();
    expect(sidePressureBonus(s, "user", "top")).toBe(0);
    expect(sidePressureShift(s, "top")).toBe(0);
  });

  it("pressao extra so na rota do portador em jogo, no meio de jogo", () => {
    const s = traitState({ top: ["side"] });
    s.phase = "mid";
    expect(TRAIT_TUNING.sidePressureBonus).toBeGreaterThan(0);
    expect(sidePressureBonus(s, "user", "top")).toBe(TRAIT_TUNING.sidePressureBonus);
    expect(sidePressureBonus(s, "user", "mid")).toBe(0);
    expect(sidePressureBonus(s, "user", "bot")).toBe(0);
    expect(sidePressureBonus(s, "rival", "top")).toBe(0);
    s.phase = "early";
    expect(sidePressureBonus(s, "user", "top")).toBe(0);
    s.phase = "late";
    expect(sidePressureBonus(s, "user", "top")).toBe(0);
    s.phase = "mid";
    s.user.players.top.alive = false;
    expect(sidePressureBonus(s, "user", "top")).toBe(0);
    s.user.players.top.alive = true;
    s.user.players.top.away = true;
    expect(sidePressureBonus(s, "user", "top")).toBe(0);
  });

  it("sinal na pressao assinada: portador user soma, portador rival subtrai", () => {
    const s = traitState({ top: ["side"] }, { adc: ["side"] });
    s.phase = "mid";
    expect(sidePressureShift(s, "top")).toBe(TRAIT_TUNING.sidePressureBonus);
    expect(sidePressureShift(s, "bot")).toBe(-TRAIT_TUNING.sidePressureBonus);
    expect(sidePressureShift(s, "mid")).toBe(0);
    const ambos = traitState({ mid: ["side"] }, { mid: ["side"] });
    ambos.phase = "mid";
    expect(sidePressureShift(ambos, "mid")).toBe(0);
    const ninguem = traitState();
    ninguem.phase = "mid";
    for (const lane of ["top", "mid", "bot"] as const) expect(sidePressureShift(ninguem, lane)).toBe(0);
  });
});
