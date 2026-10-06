/**
 * src/sim/upset.test.ts
 *
 * Phase 28 (plano 28-04): cobertura do destaque narrativo de zebra
 * (D-03/D-04/D-05). Cobre `UPSET_MIN_GAP`/`isUpset` (src/sim/power.ts) e
 * `buildUpsetEvent`/`UPSET_TICKERS` (src/sim/upset.ts): contrato de null,
 * conteudo do evento devolvido, determinismo por seed (INV-1), posicao
 * unica no fim da timeline, e a verificacao de nao-vacuidade do gate (no
 * espirito do criterio 5 da Fase 26): toda partida com gap acima de UPSET_MIN_GAP em que o
 * azarao venceu tem exatamente um `upset_win`, e toda em que o favorito
 * venceu nao tem nenhum.
 */

import { describe, it, expect } from "vitest";
import {
  RATING_CURVE_D,
  UPSET_MIN_FAVORITE_P,
  UPSET_MIN_GAP,
  isUpset,
  teamCardRating,
} from "./power";
import { buildUpsetEvent, UPSET_TICKERS } from "./upset";
import { simulateMatch, baseEvent } from "./engine";
import { ROLES, createInitialMatchState, type MatchState } from "./matchState";
import { makeFlatCard } from "../__tests__/golden/fixtures";
import { mulberry32 } from "./rng";
import type { PlayerVersion } from "../data/schema";

function roster(overall: number): PlayerVersion[] {
  return ROLES.map((r) => makeFlatCard(r, overall));
}

function makeState(overallUser: number, overallRival: number): MatchState {
  return createInitialMatchState(roster(overallUser), roster(overallRival));
}

// ---------------------------------------------------------------------------
// UPSET_MIN_GAP (derivado de RATING_CURVE_D, nao literal)
// ---------------------------------------------------------------------------

describe("UPSET_MIN_GAP", () => {
  // Nota: o texto do plano 28-04-PLAN.md aproxima o valor como "9,534"; o
  // produto exato de RATING_CURVE_D * log10(0,65/0,35) e 9,54400858...
  // (verificado por calculo direto). O que este teste protege e que
  // UPSET_MIN_GAP e SEMPRE o produto exato da formula (derivado, nao
  // literal), nao um numero especifico escrito a mao.
  it("vale RATING_CURVE_D * log10(0.65/0.35), aproximadamente 9,544, tolerancia 1e-3", () => {
    const expected = RATING_CURVE_D * Math.log10(UPSET_MIN_FAVORITE_P / (1 - UPSET_MIN_FAVORITE_P));
    expect(Math.abs(UPSET_MIN_GAP - expected)).toBeLessThan(1e-9);
    expect(Math.abs(UPSET_MIN_GAP - 9.544)).toBeLessThan(1e-3);
  });

  it("UPSET_MIN_FAVORITE_P vale exatamente 0.65", () => {
    expect(UPSET_MIN_FAVORITE_P).toBe(0.65);
  });
});

// ---------------------------------------------------------------------------
// isUpset
// ---------------------------------------------------------------------------

describe("isUpset", () => {
  it("isUpset(60, 90) e true (vencedor 60, perdedor 90, gap 30 acima do limiar)", () => {
    expect(isUpset(60, 90)).toBe(true);
  });

  it("isUpset(90, 60) e false (o favorito venceu)", () => {
    expect(isUpset(90, 60)).toBe(false);
  });

  it("isUpset(70, 75) e false (gap 5, abaixo do limiar)", () => {
    expect(isUpset(70, 75)).toBe(false);
  });

  it("isUpset(70, 80) e true (gap 10, acima de 9,534)", () => {
    expect(isUpset(70, 80)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildUpsetEvent (contrato de null)
// ---------------------------------------------------------------------------

describe("buildUpsetEvent (contrato de null)", () => {
  it("devolve null quando o time vencedor tem rating maior ou igual ao do perdedor", () => {
    const state = makeState(90, 60);
    state.ended = true;
    state.winner = "user"; // favorito venceu, sem zebra
    const timeline = [baseEvent(state, "gg", "user", { actors: [], lane: "base", ticker: "GG." })];
    expect(buildUpsetEvent(state, timeline)).toBeNull();
  });

  it("devolve null quando ratings sao iguais (sem zebra por definicao)", () => {
    const state = makeState(70, 70);
    state.ended = true;
    state.winner = "user";
    const timeline = [baseEvent(state, "gg", "user", { actors: [], lane: "base", ticker: "GG." })];
    expect(buildUpsetEvent(state, timeline)).toBeNull();
  });

  it("devolve null quando a partida ainda nao terminou (state.ended falso)", () => {
    const state = makeState(60, 90);
    state.ended = false;
    state.winner = null;
    const timeline = [baseEvent(state, "gg", "user", { actors: [], lane: "base", ticker: "GG." })];
    expect(buildUpsetEvent(state, timeline)).toBeNull();
  });

  it("devolve null quando state.winner e nulo mesmo com state.ended verdadeiro", () => {
    const state = makeState(60, 90);
    state.ended = true;
    state.winner = null;
    const timeline = [baseEvent(state, "gg", "user", { actors: [], lane: "base", ticker: "GG." })];
    expect(buildUpsetEvent(state, timeline)).toBeNull();
  });

  it("devolve null quando a timeline esta vazia", () => {
    const state = makeState(60, 90);
    state.ended = true;
    state.winner = "user";
    expect(buildUpsetEvent(state, [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildUpsetEvent (conteudo do evento devolvido)
// ---------------------------------------------------------------------------

describe("buildUpsetEvent (conteudo do evento)", () => {
  it("kind e upset_win, side e o lado vencedor, timeSec/winProbUserAfter herdam do ULTIMO evento (nao de state)", () => {
    const state = makeState(60, 90); // user e o azarao (rating 60 < rival 90)
    state.gameTimeSec = 1800;
    state.winProbUser = 0.5;
    state.ended = true;
    state.winner = "user"; // o azarao venceu: zebra

    // O ultimo evento e construido ANTES de mudar state.gameTimeSec/winProbUser
    // adiante, para provar que buildUpsetEvent le do EVENTO e nao de state.
    const lastEvent = baseEvent(state, "gg", "user", { actors: [], lane: "base", ticker: "GG." });
    const timeline = [lastEvent];

    state.gameTimeSec = 1900;
    state.winProbUser = 0.9;

    const ev = buildUpsetEvent(state, timeline);
    expect(ev).not.toBeNull();
    expect(ev!.kind).toBe("upset_win");
    expect(ev!.side).toBe("user");
    expect(ev!.timeSec).toBe(lastEvent.timeSec);
    expect(ev!.timeSec).not.toBe(1900);
    expect(ev!.winProbUserAfter).toBe(lastEvent.winProbUserAfter);
    expect(ev!.winProbUserAfter).not.toBe(0.9);
  });

  it("o ticker contem o nome do time vencedor e nao contem o caractere de travessao", () => {
    const state = makeState(60, 90);
    state.ended = true;
    state.winner = "user";
    const timeline = [baseEvent(state, "gg", "user", { actors: [], lane: "base", ticker: "GG." })];

    const ev = buildUpsetEvent(state, timeline);
    expect(ev).not.toBeNull();
    expect(ev!.ticker).toContain(state.user.name);
    expect(ev!.ticker).not.toContain("—");
  });

  it("UPSET_TICKERS tem pelo menos tres variantes, nenhuma com o caractere de travessao", () => {
    expect(UPSET_TICKERS.length).toBeGreaterThanOrEqual(3);
    for (const variant of UPSET_TICKERS) {
      expect(variant("Time Teste", 15)).not.toContain("—");
    }
  });

  it("a selecao de variante e deterministica: mesmo gap produz sempre o mesmo ticker", () => {
    const state = makeState(60, 90);
    state.ended = true;
    state.winner = "user";
    const timeline = [baseEvent(state, "gg", "user", { actors: [], lane: "base", ticker: "GG." })];

    const ev1 = buildUpsetEvent(state, timeline);
    const ev2 = buildUpsetEvent(state, timeline);
    expect(ev1!.ticker).toBe(ev2!.ticker);
  });
});

// ---------------------------------------------------------------------------
// Determinismo por seed (INV-1) via simulateMatch de ponta a ponta
// ---------------------------------------------------------------------------

describe("determinismo por seed (INV-1), rede fim a fim", () => {
  it("duas execucoes de simulateMatch com a mesma seed e gap grande produzem timelines identicas", () => {
    const resA = simulateMatch(roster(60), roster(90), mulberry32(41));
    const resB = simulateMatch(roster(60), roster(90), mulberry32(41));
    expect(resA.timeline.map((e) => e.kind)).toEqual(resB.timeline.map((e) => e.kind));
    expect(resA.timeline.map((e) => e.ticker)).toEqual(resB.timeline.map((e) => e.ticker));
    expect(resA.winner).toBe(resB.winner);
  });
});

// ---------------------------------------------------------------------------
// Corpus de zebra dos dois testes abaixo (Task 9, luta-mapa-vitoria)
//
// Era 60 contra 90 (gap 30). Com a curva de rating do motor novo
// (`ratingPowerD` 140, Task 8) o azarao de gap 30 nao vence nenhuma das seeds
// 1 a 2000, entao o corpus antigo deixou de exercitar o lado "zebra" e o teste
// de posicao abaixo passava vazio. O corpus passa a 70 contra 80: gap 10, acima
// de UPSET_MIN_GAP (~9,544), ainda zebra por definicao. Medido nas seeds 1 a
// 60: o azarao vence 4 (seeds 17, 34, 38 e 48) e o favorito as outras 56.
// ---------------------------------------------------------------------------

const ZEBRA_AZARAO = 70;
const ZEBRA_FAVORITO = 80;

// ---------------------------------------------------------------------------
// Posicao unica no fim da timeline
// ---------------------------------------------------------------------------

describe("posicao do upset_win na timeline", () => {
  it("upset_win, quando existe, e sempre o ultimo elemento e aparece no maximo uma vez", () => {
    let zebras = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const res = simulateMatch(roster(ZEBRA_AZARAO), roster(ZEBRA_FAVORITO), mulberry32(seed));
      const kinds = res.timeline.map((e) => e.kind);
      const count = kinds.filter((k) => k === "upset_win").length;
      expect(count).toBeLessThanOrEqual(1);
      if (count === 1) {
        zebras++;
        expect(kinds[kinds.length - 1]).toBe("upset_win");
      }
    }
    // Nao-vacuidade propria: sem nenhum upset_win nas seeds 1 a 50 o teste passaria
    // vazio, como passava no corpus 60 contra 90. Medido: 4 (seeds 17, 34, 38 e 48).
    expect(zebras).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Nao-vacuidade do gate (no espirito do criterio 5 da Fase 26)
// ---------------------------------------------------------------------------

describe("nao-vacuidade do gate de zebra", () => {
  it("toda partida com gap acima de UPSET_MIN_GAP (70 contra 80) em que o azarao venceu tem exatamente um upset_win, e toda em que o favorito venceu nao tem nenhum", () => {
    // Rating de carta e ESTATICO por roster flat (roster uniforme retorna
    // exatamente o overall, ver ratingCurve.test.ts): user=70 e sempre o
    // azarao, rival=80 e sempre o favorito, gap 10 > UPSET_MIN_GAP (~9,544).
    const state = makeState(ZEBRA_AZARAO, ZEBRA_FAVORITO);
    const userRating = teamCardRating(state.user);
    const rivalRating = teamCardRating(state.rival);
    expect(isUpset(userRating, rivalRating)).toBe(true); // user vencendo seria zebra
    expect(isUpset(rivalRating, userRating)).toBe(false); // rival vencendo NAO e zebra

    const SEEDS = 60;
    let underdogWins = 0;
    let favoriteWins = 0;

    for (let seed = 1; seed <= SEEDS; seed++) {
      const res = simulateMatch(roster(ZEBRA_AZARAO), roster(ZEBRA_FAVORITO), mulberry32(seed));
      const kinds = res.timeline.map((e) => e.kind);
      const upsetCount = kinds.filter((k) => k === "upset_win").length;

      if (res.winner === "user") {
        // O azarao (user, rating 70) venceu: zebra, deve ter exatamente um upset_win.
        underdogWins++;
        expect(upsetCount).toBe(1);
      } else {
        // O favorito (rival, rating 80) venceu: sem zebra, zero upset_win.
        favoriteWins++;
        expect(upsetCount).toBe(0);
      }
    }

    // Verificacao de nao-vacuidade, agora banda de dois lados (Task 9,
    // reancorada na spec 2026-10-02 "Medicao e aceite": favorito com gap de
    // elenco >= 5 vence 75% a 85%). Piso: ao menos uma zebra, senao o lado
    // "azarao venceu" do contrato nunca foi exercitado. Teto: o azarao vence
    // no maximo 25% do corpus (15 de 60), o complemento do piso de 75% do
    // favorito; acima disso o corpus deixou de ter favorito de verdade. Medido
    // no motor da Task 8: 4 zebras em 60.
    expect(underdogWins).toBeGreaterThanOrEqual(1);
    expect(underdogWins).toBeLessThanOrEqual(Math.floor(SEEDS * 0.25));
    expect(favoriteWins).toBeGreaterThan(0);
  });
});
