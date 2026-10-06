/**
 * scripts/stats.ts
 *
 * Modulo de estatistica puro (Fase 23 / INST-04 + INST-06).
 * Zero import, zero I/O, zero dependencia externa: matematica pura, importavel
 * tanto por harness de vitest quanto por script rodado direto no node.
 *
 * Origem: derivado das 3 implementacoes identicas de percentile() ja existentes
 * em calibrate-combat.ts:63, calibrate-objectives.ts:69, calibrate-structures.ts:255
 * (byte-identicas), mais a formula de Kang (2019) / Pfister et al. (2013) para o
 * coeficiente de bimodalidade.
 *
 * Invariante nao negociavel:
 *   - INST-06 recusa dependencia externa de estatistica: um bump de minor version
 *     que mude o metodo de interpolacao de percentil moveria todas as bandas de
 *     calibracao em silencio, sem que a engine tivesse mudado.
 */

export function mean(a: readonly number[]): number {
  return a.length === 0 ? 0 : a.reduce((s, x) => s + x, 0) / a.length;
}

/** Desvio padrao POPULACIONAL (divisor n, nao n-1), convencao ja usada no projeto. */
export function stdev(a: readonly number[]): number {
  if (a.length === 0) return 0;
  const m = mean(a);
  const variance = a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length;
  return Math.sqrt(variance);
}

/**
 * Percentil por indice arredondado (NAO interpolado): sempre retorna um valor
 * efetivamente observado na amostra. Metodo canonico do projeto, identico ao ja
 * usado em nove callsites de calibrate-combat.ts / calibrate-objectives.ts /
 * calibrate-structures.ts (DEC-04). Trocar por interpolacao moveria silenciosamente
 * todas as bandas de calibracao (o motivo de INST-06 recusar dependencia externa).
 *
 * PRECONDICAO: `sorted` deve estar ordenado ascendente pelo chamador.
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

export interface Summary {
  n: number;
  mean: number;
  sd: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  min: number;
  max: number;
  /** null quando n < BC_MIN_N (skew/kurtose nao confiaveis com denominador pequeno) */
  bc: number | null;
}

/** Ordena uma copia do vetor antes de calcular: aceita entrada nao ordenada. */
export function summarize(a: readonly number[]): Summary {
  const sorted = [...a].sort((x, y) => x - y);
  return {
    n: sorted.length,
    mean: mean(sorted),
    sd: stdev(sorted),
    p5: percentile(sorted, 5),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p95: percentile(sorted, 95),
    min: sorted.length ? sorted[0] : 0,
    max: sorted.length ? sorted[sorted.length - 1] : 0,
    bc: bimodalityCoefficient(sorted),
  };
}

/** Intervalo de confianca 95% da MEDIA (aproximacao normal, sd populacional). */
export function ci95(a: readonly number[]): { lower: number; upper: number } {
  const n = a.length;
  if (n <= 1) return { lower: mean(a), upper: mean(a) };
  const halfWidth = (1.96 * stdev(a)) / Math.sqrt(n);
  return { lower: mean(a) - halfWidth, upper: mean(a) + halfWidth };
}

/** Buckets meio-abertos [edges[0],edges[1]), ..., com o ultimo bucket fechado nas duas pontas. */
export function histogram(a: readonly number[], edges: readonly number[]): number[] {
  const counts = new Array(Math.max(0, edges.length - 1)).fill(0) as number[];
  for (const x of a) {
    for (let i = 0; i < edges.length - 1; i++) {
      const isLast = i === edges.length - 2;
      if (x >= edges[i] && (isLast ? x <= edges[i + 1] : x < edges[i + 1])) {
        counts[i]++;
        break;
      }
    }
  }
  return counts;
}

export function shareWhere(a: readonly number[], pred: (x: number) => boolean): number {
  return a.length === 0 ? 0 : a.filter(pred).length / a.length;
}

/** Inclusivo nas duas pontas: value === floor ou value === ceiling contam como dentro. */
export function inBand(value: number, floor: number, ceiling: number): boolean {
  return value >= floor && value <= ceiling;
}

/** Amostra minima abaixo da qual skew/kurtose de amostra sao instaveis. */
const BC_MIN_N = 10;

/** Limiar unimodal/bimodal (uniforme = 5/9). Kang (2019); Pfister et al. (2013). */
export const BC_UNIMODAL_THRESHOLD = 5 / 9;

/**
 * Coeficiente de bimodalidade: BC = (skew^2 + 1) / (kurtose_excesso + correcao(n))
 * onde correcao(n) = 3*(n-1)^2 / ((n-2)*(n-3)).
 * BC <= 5/9 (~0.5556) sugere unimodal; BC > 5/9 sugere bimodal ou multimodal.
 * Retorna null se n < BC_MIN_N ou variancia zero (todas as amostras identicas).
 */
export function bimodalityCoefficient(a: readonly number[]): number | null {
  const n = a.length;
  if (n < BC_MIN_N) return null;
  const m = mean(a);
  const m2 = a.reduce((s, x) => s + (x - m) ** 2, 0) / n;
  if (m2 === 0) return null;
  const m3 = a.reduce((s, x) => s + (x - m) ** 3, 0) / n;
  const m4 = a.reduce((s, x) => s + (x - m) ** 4, 0) / n;
  const skew = m3 / Math.pow(m2, 1.5);
  const kurtosisExcess = m4 / (m2 * m2) - 3;
  const correction = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return (skew ** 2 + 1) / (kurtosisExcess + correction);
}
