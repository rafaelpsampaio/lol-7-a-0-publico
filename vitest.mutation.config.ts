import { defineConfig } from "vitest/config";

/**
 * Config dedicada para o teste de mutacao da alavanca primaria (plano 26-08
 * Task 2). Include estreito em scripts/mutation-maxcasualties.test.ts, no
 * mesmo formato das demais configs dedicadas por gate/teste deste projeto
 * (ex.: vitest.calibrate-pace.config.ts), para que rode isolado:
 * npx vitest run -c vitest.mutation.config.ts (o script npm
 * mutation:maxcasualties entra no mesmo Task).
 *
 * testTimeout em 300s: quatro configuracoes completas de N=500 partidas cada
 * (base, perturbada, controle negativo, ruido base-base), cada uma via
 * import() dinamico depois de vi.resetModules()/vi.doMock(), justificam
 * margem sobre o tempo medido em desenvolvimento (~20s para as quatro
 * configuracoes).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/mutation-maxcasualties.test.ts"], // caminho literal, nunca curinga
    testTimeout: 300_000,
  },
});
