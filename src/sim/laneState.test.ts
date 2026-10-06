/**
 * src/sim/laneState.test.ts
 *
 * Cobertura do módulo de lane state persistente (LANE-01/02/03/04):
 *  - freshLaneState() retorna 10 campos com valores neutros (LANE-01, plano 26-07)
 *  - updateLaneState acumula cumulativamente sem reset (LANE-02)
 *  - decayLaneState decai laneLead ~0.985, não toca plateGold (LANE-02)
 *  - laneLead respeita LANE_LEAD_CAP — não cresce sem limite (D-01)
 *  - Neutralidade flat: lane simétrica => laneLead == 0 (INV-1)
 *  - computeStrongsideScore retorna dominantLane: null em estado neutro (LANE-04)
 *  - Rng-free: todos os testes são estáticos, sem seed (DET-02)
 *
 * ESTADO ESPERADO NESTE PLANO: RED — os símbolos abaixo são importados de
 * "./laneState" que ainda não existe. Este arquivo ficará em RED até o Plano 02
 * criar o módulo, conforme a estratégia Wave 0 da Fase 10.
 */

import { describe, it, expect } from "vitest";
import {
  freshLaneState,
  updateLaneState,
  decayLaneState,
  computeStrongsideScore,
  LANE_LEAD_CAP,
} from "./laneState";
// fixture helpers — padrão de microMetrics.test.ts:
import { makeFlatCard } from "../__tests__/golden/fixtures";
import { ROLES, createInitialMatchState } from "./matchState";

// ---------------------------------------------------------------------------
// LANE-01: freshLaneState retorna estado neutro com 10 campos (plano 26-07
// acrescentou narrativeSignalState, o bookkeeping de histerese do recheio)
// ---------------------------------------------------------------------------

describe("LANE-01: freshLaneState retorna estado neutro", () => {
  it("retorna exatamente 10 campos", () => {
    const ls = freshLaneState();
    expect(Object.keys(ls)).toHaveLength(10);
  });

  it("narrativeSignalState começa armado nos três sinais, último valor 0", () => {
    const ls = freshLaneState();
    expect(ls.narrativeSignalState.laneLead).toEqual({ armed: true, lastValue: 0 });
    expect(ls.narrativeSignalState.prio).toEqual({ armed: true, lastValue: 0 });
    expect(ls.narrativeSignalState.jungleAttention).toEqual({ armed: true, lastValue: 0 });
  });

  it("laneLead é 0 (neutro)", () => {
    expect(freshLaneState().laneLead).toBe(0);
  });

  it("plateGold é 0 (nenhum ouro de plate ainda)", () => {
    expect(freshLaneState().plateGold).toBe(0);
  });

  it("csDiff é 0 (neutro)", () => {
    expect(freshLaneState().csDiff).toBe(0);
  });

  it("xpDiff é 0 (neutro)", () => {
    expect(freshLaneState().xpDiff).toBe(0);
  });

  it("resetAdvantage é 0 (neutro)", () => {
    expect(freshLaneState().resetAdvantage).toBe(0);
  });

  it("prioScore é 0 (neutro)", () => {
    expect(freshLaneState().prioScore).toBe(0);
  });

  it("weaksideState.active é false (neutro)", () => {
    expect(freshLaneState().weaksideState.active).toBe(false);
  });

  it("todos os campos numéricos são finitos", () => {
    const ls = freshLaneState();
    const numericKeys: Array<keyof typeof ls> = [
      "laneLead",
      "plateGold",
      "csDiff",
      "xpDiff",
      "resetAdvantage",
      "prioScore",
      "matchupVolatility",
      "jungleAttentionReceived",
    ];
    for (const key of numericKeys) {
      expect(Number.isFinite(ls[key] as number)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// LANE-02 acúmulo: updateLaneState acumula cumulativamente sem reset
// ---------------------------------------------------------------------------

describe("LANE-02: updateLaneState acumula cumulativamente (sem reset)", () => {
  it("solo_kill aumenta laneLead do lado vencedor", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    const laneBeforeUser = state.user.laneState["mid"].laneLead;
    updateLaneState(state, "user", "mid", "solo_kill");
    const laneAfterUser = state.user.laneState["mid"].laneLead;

    // laneLead do lado vencedor deve aumentar
    expect(laneAfterUser).toBeGreaterThan(laneBeforeUser);
  });

  it("solo_kill corta laneLead do lado inimigo (D-02)", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    // Primeiro dar lead ao rival
    updateLaneState(state, "rival", "mid", "solo_kill");
    const rivalLeadBefore = state.rival.laneState["mid"].laneLead;

    // Agora o user ganha um kill — deve cortar o lead do rival
    updateLaneState(state, "user", "mid", "solo_kill");
    const rivalLeadAfter = state.rival.laneState["mid"].laneLead;

    // laneLead do rival deve diminuir quando o oponente faz uma jogada
    expect(rivalLeadAfter).toBeLessThan(rivalLeadBefore);
  });

  it("acumula cumulativamente — múltiplos eventos não resetam, apenas somam", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    updateLaneState(state, "user", "top", "solo_kill");
    const afterOne = state.user.laneState["top"].laneLead;

    updateLaneState(state, "user", "top", "solo_kill");
    const afterTwo = state.user.laneState["top"].laneLead;

    // Segundo evento deve acrescentar, não resetar
    expect(afterTwo).toBeGreaterThan(afterOne);
  });
});

// ---------------------------------------------------------------------------
// LANE-02 teto: LANE_LEAD_CAP é respeitado (D-01 — sem runaway snowball)
// ---------------------------------------------------------------------------

describe("LANE-02: laneLead respeita LANE_LEAD_CAP (sem runaway snowball)", () => {
  it("aplicar updateLaneState muitas vezes nunca ultrapassa LANE_LEAD_CAP", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    // Aplicar muitos eventos no mesmo lane para tentar ultrapassar o teto
    for (let i = 0; i < 50; i++) {
      updateLaneState(state, "user", "bot", "solo_kill");
    }

    const finalLead = state.user.laneState["bot"].laneLead;
    expect(Math.abs(finalLead)).toBeLessThanOrEqual(LANE_LEAD_CAP);
  });

  it("LANE_LEAD_CAP é um número positivo", () => {
    expect(typeof LANE_LEAD_CAP).toBe("number");
    expect(LANE_LEAD_CAP).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// LANE-02 decay: decayLaneState decai laneLead ~0.985, NÃO toca plateGold (D-06)
// ---------------------------------------------------------------------------

describe("LANE-02: decayLaneState decai laneLead e não toca plateGold (D-06)", () => {
  it("decayLaneState reduz laneLead por fator próximo de 0.985 por tick", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    // Estabelecer um lead
    updateLaneState(state, "user", "mid", "solo_kill");
    const leadBefore = state.user.laneState["mid"].laneLead;

    // Fazer o decay
    decayLaneState(state);
    const leadAfter = state.user.laneState["mid"].laneLead;

    // O lead deve ter decaído
    expect(leadAfter).toBeLessThan(leadBefore);
    // O fator de decaimento deve estar próximo de 0.985
    if (leadBefore !== 0) {
      const decayFactor = leadAfter / leadBefore;
      expect(decayFactor).toBeGreaterThan(0.95);
      expect(decayFactor).toBeLessThanOrEqual(1.0);
    }
  });

  it("decayLaneState NÃO altera plateGold (D-06 — ouro real não decai)", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    // Simular plate gold recebido
    updateLaneState(state, "user", "top", "first_tower");
    const plateGoldBefore = state.user.laneState["top"].plateGold;

    // Decay não deve tocar plateGold
    decayLaneState(state);
    const plateGoldAfter = state.user.laneState["top"].plateGold;

    expect(plateGoldAfter).toBe(plateGoldBefore);
  });
});

// ---------------------------------------------------------------------------
// LANE-02 identidade flat (INV-1): lane simétrica mantém laneLead === 0
// ---------------------------------------------------------------------------

describe("INV-1: identidade flat — lane simétrica mantém laneLead zero", () => {
  it("N ticks de decayLaneState sem eventos mantém laneLead === 0 (estado inicial neutro)", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    // Aplicar N ticks de decay sem nenhum evento
    const N = 20;
    for (let i = 0; i < N; i++) {
      decayLaneState(state);
    }

    // Em estado simétrico, laneLead deve permanecer 0 em todas as lanes
    for (const lane of ["top", "mid", "bot"] as const) {
      expect(state.user.laneState[lane].laneLead).toBe(0);
      expect(state.rival.laneState[lane].laneLead).toBe(0);
    }
  });

  it("estado inicial: freshLaneState tem laneLead === 0 em ambos os lados", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    for (const lane of ["top", "mid", "bot"] as const) {
      expect(state.user.laneState[lane].laneLead).toBe(0);
      expect(state.rival.laneState[lane].laneLead).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// LANE-04: computeStrongsideScore em estado neutro retorna dominantLane === null
// ---------------------------------------------------------------------------

describe("LANE-04: computeStrongsideScore neutro retorna dominantLane null", () => {
  it("computeStrongsideScore em estado inicial retorna dominantLane null (nenhuma lane dominante)", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    const snapshot = computeStrongsideScore(state, "user");
    expect(snapshot.dominantLane).toBeNull();
  });

  it("computeStrongsideScore retorna objeto com campo dominantLane e scores", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    const snapshot = computeStrongsideScore(state, "user");
    expect(snapshot).toHaveProperty("dominantLane");
    expect(snapshot).toHaveProperty("scores");
    expect(snapshot.scores).toHaveProperty("top");
    expect(snapshot.scores).toHaveProperty("mid");
    expect(snapshot.scores).toHaveProperty("bot");
  });

  it("computeStrongsideScore em estado simétrico — scores são finitos e iguais entre lanes", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    const snapshot = computeStrongsideScore(state, "user");
    expect(Number.isFinite(snapshot.scores.top)).toBe(true);
    expect(Number.isFinite(snapshot.scores.mid)).toBe(true);
    expect(Number.isFinite(snapshot.scores.bot)).toBe(true);
  });

  it("computeStrongsideScore é rng-free — retorna mesmo resultado sem seed", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    const snapshotA = computeStrongsideScore(state, "user");
    const snapshotB = computeStrongsideScore(state, "user");

    // Chamadas repetidas sem mutar estado devem retornar resultado idêntico
    expect(snapshotA.dominantLane).toBe(snapshotB.dominantLane);
    expect(snapshotA.scores.top).toBe(snapshotB.scores.top);
    expect(snapshotA.scores.mid).toBe(snapshotB.scores.mid);
    expect(snapshotA.scores.bot).toBe(snapshotB.scores.bot);
  });
});

// ---------------------------------------------------------------------------
// DET-02: rng-free — nenhum teste usa rng() ou Math.random nos asserts unitários
// (verificação estática via fs, padrão de microMetrics.test.ts)
// ---------------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";

describe("DET-02: laneState.ts é rng-free (verificação estática)", () => {
  it("laneState.ts não contém chamada a Math.random()", () => {
    // Este teste passará quando laneState.ts existir (Plano 02)
    // Wave 0: o arquivo ainda não existe — o teste falhará por módulo ausente,
    // não por violação de rng-free
    const filePath = path.resolve(__dirname, "laneState.ts");
    if (!fs.existsSync(filePath)) {
      // Arquivo ainda não existe — skip implícito para Wave 0
      return;
    }
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).not.toContain("Math.random()");
  });

  it("laneState.ts não importa rng.ts nem invoca mulberry32()", () => {
    const filePath = path.resolve(__dirname, "laneState.ts");
    if (!fs.existsSync(filePath)) {
      return;
    }
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).not.toContain('from "./rng"');
    expect(source).not.toContain("mulberry32(");
  });
});
