/**
 * src/sim/teamComp.test.ts
 *
 * Cobertura do modulo teamComp (COMP-01/02/03):
 *  - deriveCompProfile retorna dominantTags: [] para roster flat/ROLE_DEFAULTS (INV-2)
 *  - ROLE_DEFAULTS excluidos (D-03): nenhuma tag de roster generico vira identidade
 *  - Roster curado com tag dominante: tags corretas acima do limiar
 *  - compFightMult retorna 1.0 exato em ROLE_DEFAULTS (INV-2)
 *  - Par de counter: dive bate scaling (D-05)
 *  - Multiplicador dentro de [COMP_FIGHT_CLAMP[0], COMP_FIGHT_CLAMP[1]]
 *  - Rng-free: todos os testes sao estaticos, sem seed (DET-02)
 *
 * ESTADO ESPERADO NESTE PLANO: RED — os simbolos abaixo sao importados de
 * "./teamComp" que ainda nao existe. Este arquivo ficara em RED ate o Plano 02
 * criar o modulo, conforme a estrategia Wave 0 da Fase 11.
 *
 * Requisitos cobertos: COMP-01, COMP-03, DET-03 (identidade 1.0 exata em flat).
 */

import { describe, it, expect } from "vitest";
import {
  deriveCompProfile,
  compFightMult,
  COMP_FIGHT_CLAMP,
  DOMINANCE_THRESHOLD,
} from "./teamComp";

// fixture helpers — padrao de laneState.test.ts e gold-fold-in.test.ts:
import { makeFlatCard } from "../__tests__/golden/fixtures";
import { ROLES, createInitialMatchState } from "./matchState";
import { ROLE_DEFAULTS } from "./championMeta";

// ---------------------------------------------------------------------------
// Helper: MatchState flat (roster sem champions atribuidos => meta = ROLE_DEFAULTS)
// Usado pelos testes de identidade (INV-2) e clamp.
// ---------------------------------------------------------------------------

function buildFlatMatchState() {
  const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
  const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
  // Sem userChampions/rivalChampions => championMetaFor retorna ROLE_DEFAULTS[role]
  return createInitialMatchState(userRoster, rivalRoster);
}

// ---------------------------------------------------------------------------
// Helper: construir players com meta de champion real (para testes curados).
// Usa o createInitialMatchState com championAssignments para injetar champion ids.
// ---------------------------------------------------------------------------

function buildDiveMatchState() {
  // Time "dive" curado: 4 campeoes com tag "dive" explicita
  // top: irelia (dive), jungle: hecarim (dive), mid: diana (dive),
  // adc: kaisa (dive), support: leona (dive)
  const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
  const userChampions: Record<string, string> = {
    [`flat-top-65`]: "irelia",
    [`flat-jungle-65`]: "hecarim",
    [`flat-mid-65`]: "diana",
    [`flat-adc-65`]: "kaisa",
    [`flat-support-65`]: "leona",
  };

  // Time "scaling" curado: 4 campeoes com tag "scaling" explicita
  // top: gangplank (scaling), jungle: kindred (scaling), mid: cassiopeia (scaling),
  // adc: jinx (scaling), support: malphite (teamfight/wombo — NAO scaling)
  // => 4 roles com "scaling" e 1 sem => dominancia clara de scaling
  const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
  const rivalChampions: Record<string, string> = {
    [`flat-top-65`]: "gangplank",
    [`flat-jungle-65`]: "kindred",
    [`flat-mid-65`]: "cassiopeia",
    [`flat-adc-65`]: "jinx",
    [`flat-support-65`]: "lulu", // protect-carry/disengage, NAO scaling => 4/5 com scaling
  };

  return createInitialMatchState(userRoster, rivalRoster, {
    userName: "DiveTeam",
    rivalName: "ScalingTeam",
    userChampions,
    rivalChampions,
  });
}

// ---------------------------------------------------------------------------
// Helper: roster com tag dominante fraca (apenas 1 campeao com "scaling")
// Prova que 1 campeao fraco NAO vira identidade (D-01, sem cliff).
// ---------------------------------------------------------------------------

function buildWeakScalingState() {
  // Apenas o mid tem "scaling" (azir); os outros 4 ficam em ROLE_DEFAULTS
  const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
  const userChampions: Record<string, string> = {
    [`flat-mid-65`]: "azir", // scaling + siege, mas unico no time
  };
  const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
  return createInitialMatchState(userRoster, rivalRoster, {
    userChampions,
  });
}

// ---------------------------------------------------------------------------
// COMP-01: deriveCompProfile — estado neutro com ROLE_DEFAULTS
// ---------------------------------------------------------------------------

describe("COMP-01: deriveCompProfile — estado neutro com ROLE_DEFAULTS", () => {
  it("dominantTags e [] para roster flat/ROLE_DEFAULTS (D-03)", () => {
    const state = buildFlatMatchState();
    // Construir players com predicado: meta === ROLE_DEFAULTS[role]
    const profile = deriveCompProfile(
      state.user.players,
      (role) => state.user.players[role].meta === ROLE_DEFAULTS[role]
    );
    expect(profile.dominantTags).toHaveLength(0);
  });

  it("dominantTags e [] para rival flat/ROLE_DEFAULTS", () => {
    const state = buildFlatMatchState();
    const profile = deriveCompProfile(
      state.rival.players,
      (role) => state.rival.players[role].meta === ROLE_DEFAULTS[role]
    );
    expect(profile.dominantTags).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// COMP-01: deriveCompProfile — roster curado com tag dominante
// ---------------------------------------------------------------------------

describe("COMP-01: deriveCompProfile — roster curado com tag dominante", () => {
  it("time com 5 campeoes dive retorna 'dive' entre as dominantTags", () => {
    const state = buildDiveMatchState();
    // Time user: irelia/hecarim/diana/kaisa/leona — todos com tag "dive"
    const profile = deriveCompProfile(
      state.user.players,
      (role) => state.user.players[role].meta === ROLE_DEFAULTS[role]
    );
    expect(profile.dominantTags).toContain("dive");
  });

  it("time com 4/5 campeoes scaling retorna 'scaling' entre as dominantTags", () => {
    const state = buildDiveMatchState();
    // Time rival: gangplank/kindred/cassiopeia/jinx tem "scaling"; lulu nao
    const profile = deriveCompProfile(
      state.rival.players,
      (role) => state.rival.players[role].meta === ROLE_DEFAULTS[role]
    );
    expect(profile.dominantTags).toContain("scaling");
  });

  it("tag presente em apenas 1 campeao fraco NAO vira identidade (D-01)", () => {
    const state = buildWeakScalingState();
    // Apenas azir (mid) tem "scaling" => abaixo do limiar de dominancia
    const profile = deriveCompProfile(
      state.user.players,
      (role) => state.user.players[role].meta === ROLE_DEFAULTS[role]
    );
    // "scaling" com apenas 1/5 campeoes (e ROLE_DEFAULTS nos outros) nao deve ser dominante
    expect(profile.dominantTags).not.toContain("scaling");
  });

  it("profile tem campo dominantTags como array", () => {
    const state = buildFlatMatchState();
    const profile = deriveCompProfile(
      state.user.players,
      (role) => state.user.players[role].meta === ROLE_DEFAULTS[role]
    );
    expect(Array.isArray(profile.dominantTags)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// COMP-03 / DET-03: compFightMult — identidade em flat/ROLE_DEFAULTS (INV-2)
// ---------------------------------------------------------------------------

describe("COMP-03: compFightMult — identidade em flat/ROLE_DEFAULTS (INV-2)", () => {
  it("retorna 1.0 exato para roster flat (campeoes nao curados) — lado user", () => {
    const state = buildFlatMatchState();
    expect(compFightMult(state.user, state.rival, state)).toBeCloseTo(1.0, 10);
  });

  it("retorna 1.0 exato para roster flat (campeoes nao curados) — lado rival", () => {
    const state = buildFlatMatchState();
    expect(compFightMult(state.rival, state.user, state)).toBeCloseTo(1.0, 10);
  });

  it("simetria: ambos os lados retornam 1.0 em estado flat", () => {
    const state = buildFlatMatchState();
    const userMult = compFightMult(state.user, state.rival, state);
    const rivalMult = compFightMult(state.rival, state.user, state);
    expect(userMult).toBeCloseTo(1.0, 10);
    expect(rivalMult).toBeCloseTo(1.0, 10);
  });
});

// ---------------------------------------------------------------------------
// COMP-03 / D-05: compFightMult — par de counter dive>scaling (assimetria)
// ---------------------------------------------------------------------------

describe("COMP-03/D-05: compFightMult — par de counter dive>scaling", () => {
  it("time dive contra scaling recebe compFightMult > 1.0", () => {
    const state = buildDiveMatchState();
    // user = dive, rival = scaling
    const diveMult = compFightMult(state.user, state.rival, state);
    expect(diveMult).toBeGreaterThan(1.0);
  });

  it("time scaling contra dive NAO recebe bonus reciproco (assimetria D-05)", () => {
    const state = buildDiveMatchState();
    // rival = scaling, user = dive
    const scalingMult = compFightMult(state.rival, state.user, state);
    // scaling nao e counter de dive => deve receber <= 1.0 (sem bonus reciproco)
    expect(scalingMult).toBeLessThanOrEqual(1.0);
  });

  it("DOMINANCE_THRESHOLD e exportado e e um numero positivo", () => {
    expect(typeof DOMINANCE_THRESHOLD).toBe("number");
    expect(DOMINANCE_THRESHOLD).toBeGreaterThan(0);
    expect(DOMINANCE_THRESHOLD).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// COMP-03: compFightMult — clamp dentro de [COMP_FIGHT_CLAMP[0], COMP_FIGHT_CLAMP[1]]
// ---------------------------------------------------------------------------

describe("COMP-03: compFightMult — clamp", () => {
  it("COMP_FIGHT_CLAMP e exportado como array de dois numeros", () => {
    expect(Array.isArray(COMP_FIGHT_CLAMP)).toBe(true);
    expect(COMP_FIGHT_CLAMP).toHaveLength(2);
    expect(typeof COMP_FIGHT_CLAMP[0]).toBe("number");
    expect(typeof COMP_FIGHT_CLAMP[1]).toBe("number");
  });

  it("COMP_FIGHT_CLAMP[0] < COMP_FIGHT_CLAMP[1] (clamp valido)", () => {
    expect(COMP_FIGHT_CLAMP[0]).toBeLessThan(COMP_FIGHT_CLAMP[1]);
  });

  it("compFightMult flat esta dentro do clamp (tilt sutil)", () => {
    const state = buildFlatMatchState();
    const m = compFightMult(state.user, state.rival, state);
    expect(m).toBeGreaterThanOrEqual(COMP_FIGHT_CLAMP[0]);
    expect(m).toBeLessThanOrEqual(COMP_FIGHT_CLAMP[1]);
  });

  it("compFightMult dive>scaling esta dentro do clamp", () => {
    const state = buildDiveMatchState();
    const m = compFightMult(state.user, state.rival, state);
    expect(m).toBeGreaterThanOrEqual(COMP_FIGHT_CLAMP[0]);
    expect(m).toBeLessThanOrEqual(COMP_FIGHT_CLAMP[1]);
  });

  it("compFightMult scaling>dive esta dentro do clamp", () => {
    const state = buildDiveMatchState();
    const m = compFightMult(state.rival, state.user, state);
    expect(m).toBeGreaterThanOrEqual(COMP_FIGHT_CLAMP[0]);
    expect(m).toBeLessThanOrEqual(COMP_FIGHT_CLAMP[1]);
  });
});
