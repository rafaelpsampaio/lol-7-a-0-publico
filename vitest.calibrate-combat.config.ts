import { defineConfig } from "vitest/config";

/**
 * Config dedicada para o harness de calibracao de combate cedo (Fase 20 / FGT-01..FGT-02).
 *
 * Include estreito em scripts/calibrate-combat.ts para que o gate de combate
 * rode de forma isolada (npm run calibrate:combat) sem arrastar outros harnessess.
 *
 * testTimeout 120s: N=500 partidas deterministicas justificam a margem extra.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/calibrate-combat.ts"],
    testTimeout: 120_000,
  },
});
