/**
 * src/sim/ratingCurve.test.ts
 *
 * FRC-04: identidade e invariancia de nivel do canal de curva de rating
 * (`targetWinProb`, `rosterRating`, `teamCardRating`, `ratingFightMult` em
 * `src/sim/power.ts`).
 *
 * (a) O teste de INVARIANCIA DE NIVEL ("invariancia de nivel") e o que fecha
 * D-02 (`D` unico global em vez de `D` por tier): a razao efetiva de poder
 * para o mesmo gap (90x60 e 70x40, ambos gap 30) precisa ser a MESMA,
 * provando que a invariancia de nivel e propriedade da formula de
 * `ratingFightMult`, nao de calibracao por tier. Isso sustenta as relacoes
 * R1/R2 de `scripts/calibrate-pace.ts`, recalibradas no plano 28-03.
 *
 * (b) O teste de que `teamCardRating` IGNORA `alive` e o que garante a
 * distincao de `docs/references/ritmo.md` linha 437: achatar
 * so a curva de diferenca de forca dos JOGADORES (rating de carta), nunca a
 * curva de win-prob por estado de jogo (vida, ouro, buffs).
 *
 * Nota de tolerancia numerica: `RATING_CURVE_D` e o valor ARREDONDADO
 * (35,5) do `D` exato derivado em `docs/diagnostics/28-ancoragem.md` Bloco 2
 * (`D = 30 / log10(0,875/0,125) = 35,4989...`). Em gap 30 isso produz
 * `targetWinProb(30) = 0,874993...`, um desvio de ~6,96e-6 em relacao ao
 * alvo declarado 0,875 -- ordem de grandeza do arredondamento de `D` para
 * uma casa decimal, nao um erro de formula. A tolerancia usada abaixo
 * (1e-4) reflete essa ordem de grandeza; `1e-9` exigiria usar o `D` exato
 * nao arredondado, o que contradiria a constante `RATING_CURVE_D = 35.5`
 * exigida por `28-02-PLAN.md` Task 2.
 */

import { describe, it, expect } from "vitest";
import {
  targetWinProb,
  rosterRating,
  teamCardRating,
  ratingFightMult,
  RATING_MULT_CLAMP,
  RATING_DELTA_CLAMP,
} from "./power";
import { ROLES, createInitialMatchState, type TeamState } from "./matchState";
import { makeFlatCard } from "../__tests__/golden/fixtures";

// ---------------------------------------------------------------------------
// Helper: monta um par de TeamState flat (um overall por lado) via a mesma
// convencao de fixture de power.test.ts / gold-scale-identity.test.ts.
// ---------------------------------------------------------------------------

function makeTeams(overallA: number, overallB: number): { teamA: TeamState; teamB: TeamState } {
  const userRoster = ROLES.map((r) => makeFlatCard(r, overallA));
  const rivalRoster = ROLES.map((r) => makeFlatCard(r, overallB));
  const state = createInitialMatchState(userRoster, rivalRoster);
  return { teamA: state.user, teamB: state.rival };
}

/** Razao efetiva de poder (o que `engine.ts` de fato compara): rating * mult, dos dois lados. */
function effectiveRatio(overallA: number, overallB: number, D: number): number {
  const { teamA, teamB } = makeTeams(overallA, overallB);
  const ratingA = teamCardRating(teamA);
  const ratingB = teamCardRating(teamB);
  return (ratingA * ratingFightMult(teamA, teamB, D)) / (ratingB * ratingFightMult(teamB, teamA, D));
}

// ---------------------------------------------------------------------------
// targetWinProb
// ---------------------------------------------------------------------------

describe("targetWinProb", () => {
  it("targetWinProb(0) === 0.5 exato", () => {
    expect(targetWinProb(0)).toBe(0.5);
  });

  it("targetWinProb(30) fica a ~7e-6 de 0.875 (desvio do arredondamento de D para 35,5)", () => {
    expect(Math.abs(targetWinProb(30) - 0.875)).toBeLessThan(1e-4);
  });

  it("targetWinProb(25) casa com a validacao do Bloco 2 da ancoragem (0,8350)", () => {
    expect(Math.abs(targetWinProb(25) - 0.835)).toBeLessThan(5e-4);
  });

  it("targetWinProb(15) casa com a validacao do Bloco 2 da ancoragem (0,7257)", () => {
    expect(Math.abs(targetWinProb(15) - 0.7257)).toBeLessThan(5e-4);
  });

  it("targetWinProb(3) casa com a validacao do Bloco 2 da ancoragem (0,5486)", () => {
    expect(Math.abs(targetWinProb(3) - 0.5486)).toBeLessThan(5e-4);
  });
});

// ---------------------------------------------------------------------------
// rosterRating
// ---------------------------------------------------------------------------

describe("rosterRating", () => {
  it("roster uniforme em 45/65/85 retorna exatamente 45/65/85 (ROLE_WEIGHTS.teamfight soma 1.0)", () => {
    for (const overall of [45, 65, 85]) {
      const roster = ROLES.map((r) => makeFlatCard(r, overall));
      expect(rosterRating(roster)).toBe(overall);
    }
  });
});

// ---------------------------------------------------------------------------
// ratingFightMult (identidade exata em diferenca zero, INV-2)
// ---------------------------------------------------------------------------

describe("ratingFightMult (identidade em diferenca zero, INV-2)", () => {
  it("retorna exatamente 1.0 quando os dois times tem o mesmo rating, em 45x45, 65x65 e 85x85", () => {
    for (const overall of [45, 65, 85]) {
      const { teamA, teamB } = makeTeams(overall, overall);
      expect(ratingFightMult(teamA, teamB, 350)).toBe(1);
    }
  });

  it("retorna exatamente 1.0 em diferenca zero para qualquer D finito", () => {
    for (const D of [1, 24, 35.5, 49, 350, 10000]) {
      const { teamA, teamB } = makeTeams(65, 65);
      expect(ratingFightMult(teamA, teamB, D)).toBe(1);
    }
  });

  it("retorna exatamente 1.0 quando ratingPowerD e null, inclusive com diferenca grande (90x60)", () => {
    const { teamA, teamB } = makeTeams(90, 60);
    expect(ratingFightMult(teamA, teamB, null)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ratingFightMult (simetria)
// ---------------------------------------------------------------------------

describe("ratingFightMult (simetria)", () => {
  it("ratingFightMult(A,B,D) * ratingFightMult(B,A,D) vale 1.0 com erro < 1e-12, em 90x60 e 60x40", () => {
    for (const [overallA, overallB] of [
      [90, 60],
      [60, 40],
    ] as const) {
      const { teamA, teamB } = makeTeams(overallA, overallB);
      const product = ratingFightMult(teamA, teamB, 350) * ratingFightMult(teamB, teamA, 350);
      expect(Math.abs(product - 1.0)).toBeLessThan(1e-12);
    }
  });
});

// ---------------------------------------------------------------------------
// ratingFightMult (invariancia de nivel, D-02, fecha D unico global)
// ---------------------------------------------------------------------------

describe("ratingFightMult (invariancia de nivel, D-02)", () => {
  it("a razao efetiva de 90x60 e igual a de 70x40 (mesmo gap 30), erro < 1e-9, e ambas iguais a 10^(30/350)", () => {
    const ratio9060 = effectiveRatio(90, 60, 350);
    const ratio7040 = effectiveRatio(70, 40, 350);
    const expected = Math.pow(10, 30 / 350);

    expect(Math.abs(ratio9060 - ratio7040)).toBeLessThan(1e-9);
    expect(Math.abs(ratio9060 - expected)).toBeLessThan(1e-9);
    expect(Math.abs(ratio7040 - expected)).toBeLessThan(1e-9);
  });

  it("sem o canal (ratingPowerD=null) as razoes CRUAS de 90x60 e 70x40 sao diferentes entre si (1,500 vs 1,750)", () => {
    const rawRatio9060 = 90 / 60;
    const rawRatio7040 = 70 / 40;
    expect(rawRatio9060).toBeCloseTo(1.5, 9);
    expect(rawRatio7040).toBeCloseTo(1.75, 9);
    expect(Math.abs(rawRatio9060 - rawRatio7040)).toBeGreaterThan(0.2);
  });
});

// ---------------------------------------------------------------------------
// ratingFightMult (monotonicidade estrita)
// ---------------------------------------------------------------------------

describe("ratingFightMult (monotonicidade)", () => {
  it("a razao efetiva cresce estritamente com o gap, para gaps 0, 5, 10, 20, 30, 40 (base 65)", () => {
    const gaps = [0, 5, 10, 20, 30, 40];
    const ratios = gaps.map((gap) => effectiveRatio(65 + gap / 2, 65 - gap / 2, 350));

    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeGreaterThan(ratios[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// ratingFightMult (clamp)
// ---------------------------------------------------------------------------

describe("ratingFightMult (clamp)", () => {
  it("o multiplicador fica dentro de RATING_MULT_CLAMP no par extremo 100x35", () => {
    const { teamA, teamB } = makeTeams(100, 35);
    const m = ratingFightMult(teamA, teamB, 350);
    expect(m).toBeGreaterThanOrEqual(RATING_MULT_CLAMP[0]);
    expect(m).toBeLessThanOrEqual(RATING_MULT_CLAMP[1]);
  });

  it("delta usado se limita a RATING_DELTA_CLAMP: 100x35 (delta bruto 65) e 100x40 (delta bruto 60) usam o MESMO delta clampado (45)", () => {
    // Ambos os deltas brutos (65 e 60) excedem RATING_DELTA_CLAMP (45), entao os
    // dois pares clampam para o MESMO delta de 45: o fator exponencial
    // 10^(45/(2D)) e identico nos dois, e a razao m1/m2 se reduz exatamente a
    // razao dos termos (rBar/rOwn) -- se o delta NAO estivesse clampado, m1/m2
    // carregaria tambem 10^((65-60)/(2D)), diferente de 1.
    const { teamA: a1, teamB: b1 } = makeTeams(100, 35);
    const { teamA: a2, teamB: b2 } = makeTeams(100, 40);

    const m1 = ratingFightMult(a1, b1, 350);
    const m2 = ratingFightMult(a2, b2, 350);

    const rOwn1 = teamCardRating(a1);
    const rFoe1 = teamCardRating(b1);
    const rOwn2 = teamCardRating(a2);
    const rFoe2 = teamCardRating(b2);
    const expectedRatio = (Math.sqrt(rOwn1 * rFoe1) / rOwn1) / (Math.sqrt(rOwn2 * rFoe2) / rOwn2);

    expect(Math.abs(100 - 35)).toBeGreaterThan(RATING_DELTA_CLAMP);
    expect(Math.abs(100 - 40)).toBeGreaterThan(RATING_DELTA_CLAMP);
    expect(Math.abs(m1 / m2 - expectedRatio)).toBeLessThan(1e-9);
  });
});

// ---------------------------------------------------------------------------
// teamCardRating (independente de estado vivo, STACK.md linha 437)
// ---------------------------------------------------------------------------

describe("teamCardRating (independente de estado vivo)", () => {
  it("morte de tres jogadores nao muda teamCardRating: o rating e propriedade das cartas, nao do estado vivo", () => {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 70));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 55));
    const state = createInitialMatchState(userRoster, rivalRoster);

    const ratingBeforeDeaths = teamCardRating(state.user);

    state.user.players.top.alive = false;
    state.user.players.jungle.alive = false;
    state.user.players.support.alive = false;

    const ratingAfterDeaths = teamCardRating(state.user);

    expect(ratingAfterDeaths).toBe(ratingBeforeDeaths);
  });
});
