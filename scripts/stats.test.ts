/**
 * scripts/stats.test.ts
 *
 * Testes unitarios de scripts/stats.ts (Fase 23 / INST-04 + INST-06).
 * Roda sob npm test (vitest.config.ts ampliado com "scripts/*.test.ts").
 * Cobre percentile/mean/stdev/ci95/histogram/shareWhere/inBand/bimodalityCoefficient
 * contra vetores conhecidos, sem nenhuma fonte de aleatoriedade.
 */

import { describe, it, expect } from "vitest";
import {
  mean,
  stdev,
  percentile,
  summarize,
  ci95,
  histogram,
  shareWhere,
  inBand,
  bimodalityCoefficient,
  BC_UNIMODAL_THRESHOLD,
} from "./stats";

describe("stats -- utilitarios estatisticos puros (INST-04 / INST-06)", () => {
  it("percentile de vetor vazio retorna 0", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("percentile([1,2,3,4,5], 50) retorna 3 (indice arredondado sobre n-1, nunca interpolado)", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it("percentile([1..10], 5) retorna 1 e percentile([1..10], 95) retorna 10", () => {
    const sorted = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(percentile(sorted, 5)).toBe(1);
    expect(percentile(sorted, 95)).toBe(10);
  });

  it("percentile sempre devolve um valor efetivamente presente na amostra", () => {
    const sorted = [3, 7, 11, 19, 23, 42, 99];
    for (const p of [0, 5, 25, 50, 75, 95, 100]) {
      expect(sorted).toContain(percentile(sorted, p));
    }
  });

  it("mean e stdev de vetor vazio retornam 0", () => {
    expect(mean([])).toBe(0);
    expect(stdev([])).toBe(0);
  });

  it("stdev usa divisor n (populacional): stdev([2,4,4,4,5,5,7,9]) e 2", () => {
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });

  it("ci95 de vetor constante devolve lower igual a upper igual a media", () => {
    const constante = [7, 7, 7, 7, 7];
    const ic = ci95(constante);
    expect(ic.lower).toBe(7);
    expect(ic.upper).toBe(7);
  });

  it("bimodalityCoefficient devolve null quando n menor que 10 e quando a variancia e zero", () => {
    expect(bimodalityCoefficient([1, 2, 3, 4, 5])).toBeNull();
    const constanteGrande = Array.from({ length: 20 }, () => 42);
    expect(bimodalityCoefficient(constanteGrande)).toBeNull();
  });

  it("bimodalityCoefficient de uma amostra uniforme densa (inteiros 0..999) fica a menos de 0,01 de 5/9", () => {
    const uniforme = Array.from({ length: 1000 }, (_, i) => i);
    const bc = bimodalityCoefficient(uniforme);
    expect(bc).not.toBeNull();
    expect(Math.abs((bc as number) - BC_UNIMODAL_THRESHOLD)).toBeLessThan(0.01);
  });

  it("bimodalityCoefficient de uma amostra estritamente bimodal (500 zeros e 500 uns) fica a menos de 0,01 de 1,0", () => {
    const bimodal = Array.from({ length: 1000 }, (_, i) => (i < 500 ? 0 : 1));
    const bc = bimodalityCoefficient(bimodal);
    expect(bc).not.toBeNull();
    expect(Math.abs((bc as number) - 1.0)).toBeLessThan(0.01);
  });

  it("summarize devolve exatamente as chaves n, mean, sd, p5, p25, p50, p75, p95, min, max, bc", () => {
    const s = summarize([5, 3, 1, 4, 2]);
    expect(Object.keys(s).sort()).toEqual(
      ["n", "mean", "sd", "p5", "p25", "p50", "p75", "p95", "min", "max", "bc"].sort()
    );
    expect(s.n).toBe(5);
    expect(s.min).toBe(1);
    expect(s.max).toBe(5);
  });

  it("histogram distribui nos buckets meio-abertos e fecha o ultimo bucket", () => {
    // buckets: [0,10), [10,20], ultimo fechado nas duas pontas
    const dados = [0, 5, 9.9, 10, 15, 20];
    const counts = histogram(dados, [0, 10, 20]);
    expect(counts).toEqual([3, 3]);
  });

  it("shareWhere devolve fracao entre 0 e 1 e 0 para vetor vazio", () => {
    expect(shareWhere([], (x) => x > 0)).toBe(0);
    expect(shareWhere([1, 2, 3, 4], (x) => x % 2 === 0)).toBe(0.5);
  });

  it("inBand e inclusivo nas duas pontas", () => {
    expect(inBand(5, 5, 10)).toBe(true);
    expect(inBand(10, 5, 10)).toBe(true);
    expect(inBand(4.999, 5, 10)).toBe(false);
    expect(inBand(10.001, 5, 10)).toBe(false);
  });
});
