import { defineConfig } from "vitest/config";

/**
 * Config dedicada para a sonda da distribuicao dos niveis de peso do evento
 * (Fase 26 plano 26-09, Task 3).
 *
 * Include estreito em scripts/probe-event-weight.ts, caminho literal e nunca
 * curinga (convencao da secao 1 de scripts/README.md).
 *
 * ESTA CONFIG NAO E DE GATE. O arquivo incluido nao contem assercao nenhuma: ele
 * mede e escreve tmp/event-weight.txt. A sonda tambem nao entra em
 * scripts/calibrate-all.mjs.
 *
 * testTimeout em 180s, mesma margem ja usada por vitest.probe-shape.config.ts para
 * uma unica rodada de N = 800 simulacoes completas (aqui um tier so, contra dois
 * tiers daquela sonda), com folga confortavel sobre o tempo medido.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/probe-event-weight.ts"], // caminho literal, nunca curinga
    testTimeout: 180_000,
  },
});
