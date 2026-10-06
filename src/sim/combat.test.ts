/**
 * src/sim/combat.test.ts
 *
 * Testes unitarios das primitivas de combate cedo (Fase 20 / FGT-01, FGT-02).
 *
 * Cobre:
 *   - multikillTimePlausibility: casos canonicos do criterio 2 de FGT-01
 *   - multikillTimePlausibility: invariante quadra/penta illegal antes de 8min (criterio 1)
 *   - multikillTimePlausibility: retorno sempre em [2, 5]
 *   - maxCasualties: bandas de tempo FGT-02
 *   - ACE_MIN_SEC: valor de gate
 *
 * Funcoes testadas sao puras e rng-free: sem simulacao de partida, sem
 * importacao de engine ou simulateMatch necessaria.
 *
 * Ref: ENGINE-HARDENING-SPEC.md §60-61, FGT-01, FGT-02.
 */

import { describe, it, expect } from "vitest";
import { multikillTimePlausibility, maxCasualties, ACE_MIN_SEC } from "./combat";

// ---------------------------------------------------------------------------
// multikillTimePlausibility -- casos canonicos (spec §60 / FGT-01 criterio 2)
// ---------------------------------------------------------------------------

describe("multikillTimePlausibility -- casos canonicos FGT-01 criterio 2", () => {
  it("quadra@90s retorna teto 2 (double maximo; quadra illegal cedo)", () => {
    // Spec §60: quadra/penta antes de 8min deve ser impossivel.
    // O teto de concentracao retorna 2 (double) para qualquer tempo < 3min.
    expect(multikillTimePlausibility(4, 90, {})).toBe(2);
  });

  it("triple@600s retorna teto plausivel (>= 3)", () => {
    // Spec §60: triple em 10min deve ser plausivel.
    // 600s esta na banda 480-840s que retorna teto 3.
    expect(multikillTimePlausibility(3, 600, {})).toBeGreaterThanOrEqual(3);
  });

  it("penta@1320s retorna teto 5 (razoavel em 22min)", () => {
    // Spec §60: penta em 22min deve ser possivel (teto 5).
    // 1320s >= 1200s: retorna 5.
    expect(multikillTimePlausibility(5, 1320, {})).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// multikillTimePlausibility -- invariante quadra/penta illegal < 8min (FGT-01 criterio 1)
// ---------------------------------------------------------------------------

describe("multikillTimePlausibility -- invariante quadra/penta illegal antes de 8min (FGT-01 criterio 1)", () => {
  it("para qualquer tempo < 480s, teto de concentracao e <= 3 (quadra/penta illegal)", () => {
    // Varredura de gameTimeSec de 0 a 479s em passos representativos.
    // Nenhum destes tempos deve permitir concentracao de 4+ kills por killer.
    const amostras = [0, 60, 90, 120, 150, 179, 180, 240, 300, 360, 420, 479];
    for (const t of amostras) {
      const teto = multikillTimePlausibility(5, t, {});
      expect(
        teto,
        `multikillTimePlausibility(5, ${t}, {}) deve ser <= 3 (illegal antes de 8min)`
      ).toBeLessThanOrEqual(3);
    }
  });

  it("retorno sempre em [2, 5] para varredura ampla de gameTimeSec (0 a 1800)", () => {
    // Garante clamp defensivo: nenhum valor fora de [2,5] em toda a escala de jogo.
    for (let t = 0; t <= 1800; t += 30) {
      const teto = multikillTimePlausibility(5, t, {});
      expect(teto, `retorno em [2,5] para t=${t}`).toBeGreaterThanOrEqual(2);
      expect(teto, `retorno em [2,5] para t=${t}`).toBeLessThanOrEqual(5);
    }
  });
});

// ---------------------------------------------------------------------------
// maxCasualties -- bandas de tempo (FGT-02)
// ---------------------------------------------------------------------------

describe("maxCasualties -- bandas de tempo FGT-02 e Fase 26 Plano 04", () => {
  it("< 3min (< 180s) retorna 2 (first blood / trade 1-1 / double raro)", () => {
    // Spec §61, D-04: teto 2 antes de 3min.
    expect(maxCasualties(90)).toBe(2);
    expect(maxCasualties(0)).toBe(2);
    expect(maxCasualties(179)).toBe(2);
  });

  it("3-8min (180s a 479s) retorna 2 (skirmish controlado)", () => {
    // Calibrado na Fase 20 Plano 03: teto 2 (nao 3) na janela 3-8min.
    // Valor 3 gerava triple rate ~9-10% e casualty medio ~2.1, violando FGT-02.
    // Com teto 2, triple <8min = 0% e casualty medio < 2 -- ambos os asserts satisfeitos.
    expect(maxCasualties(180)).toBe(2);
    expect(maxCasualties(300)).toBe(2);
    expect(maxCasualties(479)).toBe(2);
  });

  it("8-20min (480s a 1199s) retorna 3 (banda intermediaria, Fase 26 Plano 04)", () => {
    // Calibrado por varredura em docs/diagnostics/26-sweep.md BLOCO 2/3/4:
    // candidata C (corte aos 20min) venceu A e B pela clausula 3 do criterio
    // (fracao de abates ate 20:00 mais perto do alvo 0,39).
    expect(maxCasualties(480)).toBe(3); // primeiro instante da banda intermediaria
    expect(maxCasualties(600)).toBe(3);
    expect(maxCasualties(1199)).toBe(3); // ultimo instante da banda intermediaria
  });

  it("20min+ (>= 1200s) retorna 5 (teamfights completas liberadas)", () => {
    // Spec §61, D-04, com o corte movido de 8min para 20min pela Fase 26 Plano 04.
    expect(maxCasualties(1200)).toBe(5); // primeiro instante do teto final
    expect(maxCasualties(1800)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// ACE_MIN_SEC
// ---------------------------------------------------------------------------

describe("ACE_MIN_SEC", () => {
  it("e 480 (8min) -- gate temporal de ace (D-04)", () => {
    // D-04: makeAceEvent so pode disparar a partir de 480s (8min).
    expect(ACE_MIN_SEC).toBe(480);
  });
});
