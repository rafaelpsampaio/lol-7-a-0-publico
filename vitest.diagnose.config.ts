import { defineConfig } from "vitest/config";

/**
 * Config dedicada para o harness de diagnostico amplo da engine (Fase 23 /
 * INST-02 + INST-04).
 *
 * Include estreito em scripts/diagnose-engine.ts para que o relatorio rode de
 * forma isolada (npx vitest run -c vitest.diagnose.config.ts) sem arrastar
 * outros harnesses.
 *
 * testTimeout generoso porque o volume total de partidas por rodada gira em
 * torno de treze mil e quinhentas (3 cenarios com N=1500, mais o cenario D
 * com dez pontos x 600 e o cenario E com cinco roles x 600).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/diagnose-engine.ts"],
    testTimeout: 600_000,
  },
});
