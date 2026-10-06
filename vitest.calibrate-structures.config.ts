import { defineConfig } from "vitest/config";

/**
 * Config dedicada para o harness de calibracao estrutural e de combate (Fase 16 / CAL-01 + CAL-02).
 *
 * Include estreito em scripts/calibrate-structures.ts para que o gate estrutural rode
 * de forma isolada (npm run calibrate:structures) sem arrastar outros harnessess.
 *
 * testTimeout subiu para 120s em relacao ao calibrate-micro (60s): 3 tiers x N=800
 * partidas + passada de rosters reais + repro do sintoma 8 justificam a margem extra.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/calibrate-structures.ts"],
    testTimeout: 120_000, // 120s: 3 tiers x N=800 + passada de rosters reais + sintomas
  },
});
