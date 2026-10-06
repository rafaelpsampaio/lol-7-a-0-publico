import { defineConfig } from "vitest/config";

/**
 * Config dedicada para o gate de ritmo de dois lados (Fase 23 / INST-03, INST-05, INST-08).
 *
 * Include estreito em scripts/calibrate-pace.ts (Plano 23-04) para que o gate rode isolado
 * (npx vitest run -c vitest.calibrate-pace.config.ts; o script npm calibrate:pace entra no
 * Plano 23-06).
 *
 * testTimeout em 300s: seis tiers x N=800 partidas (4.800 simulacoes) mais a subamostra de
 * saturacao de goldFightMult/goldSecureMult nas primeiras 200 partidas do tier EQUILIBRADO
 * (2 lados x timeline de cada partida) justificam a margem sobre os 120s ja usados pelo
 * harness de tres tiers (calibrate-structures.ts).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/calibrate-pace.ts"], // caminho literal, nunca curinga
    testTimeout: 300_000,
  },
});
