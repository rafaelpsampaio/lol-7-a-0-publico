import { defineConfig } from "vitest/config";

/**
 * Config dedicada para o sweep de seeds-ancora (Fase 16 / Plano 04).
 * Executar: npx vitest run -c vitest.seed-anchors.config.ts
 * Resultado em tmp/seed-anchors.txt
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/find-seed-anchors.ts"],
    testTimeout: 120_000,
  },
});
