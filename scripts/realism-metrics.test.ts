import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { PlayerVersion } from "../src/data/schema";
import type { SimEvent } from "../src/sim/simEvents";
import {
  scoreAt,
  isObjectiveTake,
  runCorpus,
  computeRealismMetrics,
  chaosKillsCurve,
  REALISM_BAND_SPECS,
} from "./realism-metrics";

const PLAYERS: PlayerVersion[] = JSON.parse(readFileSync("public/players.json", "utf-8")).players;

function ev(timeSec: number, userKills: number): Pick<SimEvent, "timeSec" | "score"> {
  return {
    timeSec,
    score: {
      userKills, rivalKills: 0, userTowers: 0, rivalTowers: 0, userDragons: 0, rivalDragons: 0,
      userBaron: false, rivalBaron: false, userElder: false, rivalElder: false,
      userGold: 0, rivalGold: 0, userDragonEls: [], rivalDragonEls: [],
    },
  };
}

describe("realism-metrics", () => {
  it("scoreAt devolve o placar da ultima entrada ate o instante, ou null antes da primeira", () => {
    const tl = [ev(60, 1), ev(120, 2), ev(300, 3)];
    expect(scoreAt(tl, 30)).toBeNull();
    expect(scoreAt(tl, 120)?.userKills).toBe(2);
    expect(scoreAt(tl, 299)?.userKills).toBe(2);
    expect(scoreAt(tl, 9999)?.userKills).toBe(3);
  });

  it("isObjectiveTake conta tomada e roubo com protagonista, e ignora o evento de Alma", () => {
    const base = { objectiveKind: "dragon", actors: ["X"] } as unknown as SimEvent;
    expect(isObjectiveTake({ ...base, kind: "dragon_taken" })).toBe(true);
    expect(isObjectiveTake({ ...base, kind: "baron_steal", objectiveKind: "baron" })).toBe(true);
    expect(isObjectiveTake({ ...base, kind: "dragon_taken", actors: [] })).toBe(false);
    expect(isObjectiveTake({ ...base, kind: "kill", objectiveKind: null })).toBe(false);
  });

  it("toda banda tem piso menor que teto e alvo dentro dela", () => {
    for (const b of REALISM_BAND_SPECS) {
      expect(b.floor).toBeLessThan(b.ceiling);
      expect(b.target).toBeGreaterThanOrEqual(b.floor);
      expect(b.target).toBeLessThanOrEqual(b.ceiling);
    }
  });

  it("metricas de um corpus pequeno sao deterministicas e fracoes ficam em [0,1]", () => {
    const a = computeRealismMetrics(runCorpus(PLAYERS, "app", 30));
    const b = computeRealismMetrics(runCorpus(PLAYERS, "app", 30));
    expect(a).toEqual(b);
    expect(a.n).toBe(30);
    for (const k of ["winnerMoreKillsFrac", "winnerBehindGoldFrac", "stealFraction", "capFraction"] as const) {
      expect(a[k]).toBeGreaterThanOrEqual(0);
      expect(a[k]).toBeLessThanOrEqual(1);
    }
  });

  it("bandas do calendario e do volume entram no gate com as faixas da spec", () => {
    const byKey = Object.fromEntries(REALISM_BAND_SPECS.map((b) => [b.key, b]));
    expect(REALISM_BAND_SPECS).toHaveLength(40);
    expect(byKey.firstBloodMedianSec).toMatchObject({ floor: 240, ceiling: 390, kind: "aceite" });
    expect(byKey.firstTowerMedianSec).toMatchObject({ floor: 870, ceiling: 1110, kind: "aceite" });
    expect(byKey.killsPerGame).toMatchObject({ floor: 23, ceiling: 32 });
    expect(byKey.elderFrac).toMatchObject({ floor: 0.04, ceiling: 0.14 });
    expect(byKey.baronAtSpawnFrac).toMatchObject({ floor: 0, ceiling: 0.15 });
    // a trava antiga da 1a torre (8:00 a 20:00) saiu
    expect(REALISM_BAND_SPECS.filter((b) => b.kind === "trava").map((b) => b.key)).toEqual([
      "durationMeanMin",
      "capFraction",
    ]);
  });

  it("metricas novas de um corpus pequeno: fracoes em [0,1] e contagens finitas", () => {
    const m = computeRealismMetrics(runCorpus(PLAYERS, "app", 30));
    for (const k of [
      "firstBloodBefore90Frac", "noKillBy10Frac", "firstDragonBefore360Frac", "soulFrac",
      "gamesWithBaronFrac", "grubsTakenFrac", "heraldTakenFrac", "under25Frac",
    ] as const) {
      expect(m[k]).toBeGreaterThanOrEqual(0);
      expect(m[k]).toBeLessThanOrEqual(1);
    }
    for (const k of [
      "firstBloodP10Sec", "killsAt15", "dragonsPerGame", "baronsPerGame", "firstTowerP10Sec",
      "towersAt15", "towersAt20", "killsP10", "killsP90", "durationP10Min", "durationP90Min",
      "adcKillsPerGame", "midKillsPerGame", "jungleKillsPerGame", "shutdownsPerGame", "plateEventsPerGame",
    ] as const) {
      expect(Number.isFinite(m[k])).toBe(true);
    }
    expect(m.killsP10).toBeLessThanOrEqual(m.killsP90);
  });

  it("torres por partida contam as torres do Nexus, como a referencia (11 por lado)", () => {
    const games = runCorpus(PLAYERS, "app", 30);
    const m = computeRealismMetrics(games);
    const laneOnly =
      games.reduce(
        (s, g) => s + g.result.finalState.user.towersDestroyed + g.result.finalState.rival.towersDestroyed,
        0
      ) / games.length;
    expect(m.towersPerGame).toBeGreaterThan(laneOnly);
    expect(Number.isFinite(m.dragonSetupDelaySec)).toBe(true);
  });

  it("1o dragao por grupo de vantagem de rota: finito em [0, 3600] quando o grupo existe", () => {
    const m = computeRealismMetrics(runCorpus(PLAYERS, "app", 30));
    const vals = [m.firstDragonEvenMedianSec, m.firstDragonDominantMedianSec];
    // NaN so e aceitavel para um grupo vazio; pelo menos um dos dois grupos tem partidas
    expect(vals.some((x) => Number.isFinite(x))).toBe(true);
    for (const x of vals) {
      if (Number.isNaN(x)) continue;
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(3600);
    }
  });

  it("curva de abates por slider de Caos: um ponto por slider e deterministica", () => {
    const a = chaosKillsCurve(PLAYERS, 6, [0, 1]);
    const b = chaosKillsCurve(PLAYERS, 6, [0, 1]);
    expect(a).toHaveLength(2);
    expect(a).toEqual(b);
  });
});
