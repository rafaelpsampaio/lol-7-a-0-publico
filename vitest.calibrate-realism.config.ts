import { defineConfig } from "vitest/config";

/**
 * Config dedicada do gate de realismo (spec 2026-10-02-luta-mapa-vitoria).
 * Include literal (scripts/README.md secao 1). testTimeout cobre N=1500 partidas
 * do cenario app (cerca de 40 s medidos) com folga.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/calibrate-realism.ts"], // caminho literal, nunca curinga
    testTimeout: 300_000,
  },
});
