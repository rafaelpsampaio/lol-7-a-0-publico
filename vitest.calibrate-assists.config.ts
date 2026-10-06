import { defineConfig } from "vitest/config";

/**
 * Config dedicada para o gate de assistencia por rota (Fase 24 / AST-01, AST-02).
 *
 * Include estreito em scripts/calibrate-assists.ts (caminho literal, nunca curinga:
 * convencao da secao 1 de scripts/README.md, escrita depois de o include com curinga
 * de vitest.calibrate.config.ts ter misturado desfecho real com estouro de tempo).
 *
 * testTimeout em 420s: tres conjuntos de campeoes x N=800 partidas, ou seja 2.400
 * simulacoes completas. A referencia medida do projeto e o gate de ritmo, que faz
 * 4.800 simulacoes em menos de 300s; a margem aqui cobre o custo extra de resolver
 * meta de campeao por jogador em dois lados e ainda deixa folga, para que o desfecho
 * seja sempre por assercao nomeada e nunca por estouro de tempo (T-24-06).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/calibrate-assists.ts"], // caminho literal, nunca curinga
    testTimeout: 420_000,
  },
});
