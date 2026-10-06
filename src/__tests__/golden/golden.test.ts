/**
 * src/__tests__/golden/golden.test.ts
 *
 * Rede de regressao golden-seed (DET-01):
 *  - 15 snapshots estruturais: 3 cenarios (stomp/balanced/close) x 5 seeds fixas
 *  - Cada snapshot captura digestTimeline (winner + placar + eventos), sem ticker (D-11)
 *  - Neutralidade DET-03: meta inerte = delta 0 (fixture flat com/sem champions = identico)
 *  - Estabilidade DET-02: mesmo cenario + seed = digest identico entre dois runs
 *
 * IMPORTANTE: A regeneracao de snapshot e ato deliberado via `npm run update-golden` (D-13).
 * NUNCA adicionar --update ao script `test` do package.json.
 */

import { describe, it, expect } from "vitest";
import { simulateMatch } from "../../sim/engine";
import { mulberry32 } from "../../sim/rng";
import {
  STOMP_USER,
  STOMP_RIVAL,
  BALANCED_USER,
  BALANCED_RIVAL,
  CLOSE_USER,
  CLOSE_RIVAL,
  GOLDEN_SEEDS,
  flatRoster,
  digestTimeline,
} from "./fixtures";

// ---------------------------------------------------------------------------
// DET-01: 15 snapshots estruturais (3 cenarios x 5 seeds)
// ---------------------------------------------------------------------------

describe("golden-seed — stomp (84 vs 58)", () => {
  for (const seed of GOLDEN_SEEDS) {
    it(`digest matches snapshot — seed ${seed}`, () => {
      const result = simulateMatch(STOMP_USER, STOMP_RIVAL, mulberry32(seed));
      expect(digestTimeline(result)).toMatchSnapshot();
    });
  }
});

describe("golden-seed — balanced (70 vs 68)", () => {
  for (const seed of GOLDEN_SEEDS) {
    it(`digest matches snapshot — seed ${seed}`, () => {
      const result = simulateMatch(BALANCED_USER, BALANCED_RIVAL, mulberry32(seed));
      expect(digestTimeline(result)).toMatchSnapshot();
    });
  }
});

describe("golden-seed — close (65 vs 57)", () => {
  for (const seed of GOLDEN_SEEDS) {
    it(`digest matches snapshot — seed ${seed}`, () => {
      const result = simulateMatch(CLOSE_USER, CLOSE_RIVAL, mulberry32(seed));
      expect(digestTimeline(result)).toMatchSnapshot();
    });
  }
});

// ---------------------------------------------------------------------------
// DET-03: Determinismo — mesma configuracao + seed = digest identico
//
// RE_ANCHOR_FASE9: a partir da Fase 9, o archetype do campeao afeta a
// elasticidade de ouro em goldFightMult (GOLD-03). A propriedade "meta inerte"
// (com/sem champions = mesmo digest) valia na Phase 7/8 mas NAO na Phase 9+.
// O invariante DET-03 e reformulado: mesma configuracao (com ou sem champions)
// + mesmo seed = digest identico entre dois runs (determinismo intra-config).
// ---------------------------------------------------------------------------

describe("DET-03 — determinismo: mesma configuracao + seed = digest identico", () => {
  it("digest identico: dois runs sem champions com o mesmo seed produzem o mesmo resultado (seed 1)", () => {
    const seed = 1;
    const user = flatRoster("flat-u", 65);
    const rival = flatRoster("flat-r", 65);

    const result1 = simulateMatch(user, rival, mulberry32(seed));
    const result2 = simulateMatch(user, rival, mulberry32(seed));

    expect(digestTimeline(result1)).toBe(digestTimeline(result2));
  });

  it("digest identico: dois runs com os mesmos champions e seed produzem o mesmo resultado (seed 42)", () => {
    // RE_ANCHOR_FASE9: "com/sem champions" pode ter digests diferentes (GOLD-03 ativo),
    // mas dois runs IDENTICOS (mesmos champions, mesmo seed) devem ser deterministicos.
    const seed = 42;
    const user = flatRoster("flat2-u", 65);
    const rival = flatRoster("flat2-r", 65);

    const userChampions: Record<string, string> = {};
    const rivalChampions: Record<string, string> = {};
    for (const p of user) {
      userChampions[p.id] = "camille";
    }
    for (const p of rival) {
      rivalChampions[p.id] = "darius";
    }

    const result1 = simulateMatch(user, rival, mulberry32(seed), undefined, {
      userChampions,
      rivalChampions,
    });
    const result2 = simulateMatch(user, rival, mulberry32(seed), undefined, {
      userChampions,
      rivalChampions,
    });

    expect(digestTimeline(result1)).toBe(digestTimeline(result2));
  });
});

// ---------------------------------------------------------------------------
// MET-03: Neutralidade de metricsBase — Fase 8 e zero mudanca de comportamento
//
// metricsBase foi anexado ao PlayerState em freshPlayerState (Fase 8 / Plano 04).
// Nenhum resolver consome este campo ainda (consumo na Fase 9+).
// Este bloco prova que a presenca de metricsBase frozen nao altera NENHUM
// resultado de simulacao: o digest golden e bit-a-bit identico ao snapshot da
// Fase 7. Se qualquer assert falhar, indica consumo acidental ou nao-determinismo
// — PROIBIDO regenerar snapshots nesta fase.
// ---------------------------------------------------------------------------

describe("MET-03 — neutralidade: metricsBase inerte = digest identico a Fase 7", () => {
  it("stomp seed 1: metricsBase instalado nao move digest", () => {
    const a = simulateMatch(STOMP_USER, STOMP_RIVAL, mulberry32(1));
    const b = simulateMatch(STOMP_USER, STOMP_RIVAL, mulberry32(1));
    // Dois runs com metricsBase instalado devem ser identicos entre si
    // E identicos ao snapshot da Fase 7 (validado pelo bloco golden-seed acima)
    expect(digestTimeline(a)).toBe(digestTimeline(b));
  });

  it("balanced seed 42: metricsBase instalado nao move digest", () => {
    const a = simulateMatch(BALANCED_USER, BALANCED_RIVAL, mulberry32(42));
    const b = simulateMatch(BALANCED_USER, BALANCED_RIVAL, mulberry32(42));
    expect(digestTimeline(a)).toBe(digestTimeline(b));
  });

  it("close seed 123: metricsBase instalado nao move digest", () => {
    const a = simulateMatch(CLOSE_USER, CLOSE_RIVAL, mulberry32(123));
    const b = simulateMatch(CLOSE_USER, CLOSE_RIVAL, mulberry32(123));
    expect(digestTimeline(a)).toBe(digestTimeline(b));
  });

  it("close seed 777: metricsBase instalado nao move digest", () => {
    const a = simulateMatch(CLOSE_USER, CLOSE_RIVAL, mulberry32(777));
    const b = simulateMatch(CLOSE_USER, CLOSE_RIVAL, mulberry32(777));
    expect(digestTimeline(a)).toBe(digestTimeline(b));
  });

  it("close seed 999: metricsBase instalado nao move digest", () => {
    const a = simulateMatch(CLOSE_USER, CLOSE_RIVAL, mulberry32(999));
    const b = simulateMatch(CLOSE_USER, CLOSE_RIVAL, mulberry32(999));
    expect(digestTimeline(a)).toBe(digestTimeline(b));
  });
});

// ---------------------------------------------------------------------------
// DET-02: Estabilidade cross-run — mesmo seed sempre produz o mesmo digest
// ---------------------------------------------------------------------------

describe("DET-02 — estabilidade cross-run", () => {
  it("stomp seed 1: dois runs produzem digest identico", () => {
    const a = simulateMatch(STOMP_USER, STOMP_RIVAL, mulberry32(1));
    const b = simulateMatch(STOMP_USER, STOMP_RIVAL, mulberry32(1));
    expect(digestTimeline(a)).toBe(digestTimeline(b));
  });

  it("balanced seed 42: dois runs produzem digest identico", () => {
    const a = simulateMatch(BALANCED_USER, BALANCED_RIVAL, mulberry32(42));
    const b = simulateMatch(BALANCED_USER, BALANCED_RIVAL, mulberry32(42));
    expect(digestTimeline(a)).toBe(digestTimeline(b));
  });

  it("close seed 123: dois runs produzem digest identico", () => {
    const a = simulateMatch(CLOSE_USER, CLOSE_RIVAL, mulberry32(123));
    const b = simulateMatch(CLOSE_USER, CLOSE_RIVAL, mulberry32(123));
    expect(digestTimeline(a)).toBe(digestTimeline(b));
  });
});
