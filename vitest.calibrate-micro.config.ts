import { defineConfig } from "vitest/config";

/**
 * Config dedicada para o harness de calibracao micro (Phase 13 / CAL-01 + CAL-02 + CAL-03).
 *
 * Include estreito em scripts/calibrate-micro.ts para que o gate micro rode
 * de forma isolada (npm run calibrate:micro) sem arrastar calibrate.ts ou
 * calibrate-engine.ts. Preserva a separacao de responsabilidade de D-01.
 *
 * testTimeout aumentado para acomodar 5 cenarios nomeados (CAL-03) alem dos
 * 3 tiers existentes (CAL-01 + CAL-02): ~8 lotes de N=800 partidas = ~15s tipico.
 *
 * Task 9 da linha luta-mapa-vitoria: o Cenario 4 comportamental roda mais duas comps
 * com N=6000 cada (12.000 partidas, ~42 s medidos); a rodada inteira passou de ~22 s
 * para ~65 s. testTimeout sobe para 180 s, mesma folga relativa de antes.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/calibrate-micro.ts"],
    testTimeout: 180_000, // 180s: 8 * N=800 + 2 * N=6000 partidas deterministicas
  },
});
