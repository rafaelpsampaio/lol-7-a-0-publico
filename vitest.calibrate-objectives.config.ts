import { defineConfig } from "vitest/config";

/**
 * Config dedicada para o harness de calibracao de objetivos (Fase 19 / OBJ-01..OBJ-04).
 *
 * Include estreito em scripts/calibrate-objectives.ts para que o gate de objetivos
 * rode de forma isolada (npm run calibrate:objectives) sem arrastar outros harnessess.
 *
 * testTimeout 120s: N=500 partidas deterministicas justificam a margem extra.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/calibrate-objectives.ts"],
    testTimeout: 120_000,
  },
});
