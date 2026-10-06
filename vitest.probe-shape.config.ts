import { defineConfig } from "vitest/config";

/**
 * Config dedicada para a sonda de dispersao e forma (Fase 25B, onda 1).
 *
 * Include estreito em scripts/probe-shape.ts, caminho literal e nunca curinga
 * (convencao da secao 1 de scripts/README.md). O curinga foi exatamente o defeito que
 * fez vitest.calibrate.config.ts arrastar seis harnesses numa rodada so.
 *
 * ESTA CONFIG NAO E DE GATE. O arquivo incluido nao contem assercao nenhuma: ele mede e
 * escreve tmp/shape.txt. A sonda tambem nao entra em scripts/calibrate-all.mjs, cuja
 * lista fixa de sete gates fica intacta.
 *
 * testTimeout em 180s, justificado por ancora de escala contra os harnesses existentes:
 * scripts/calibrate-pace.ts roda 6 tiers vezes N = 800, ou seja 4.800 simulacoes
 * completas, com testTimeout de 300s; scripts/diagnose-engine.ts roda cerca de 15.500
 * simulacoes com 600s. As 1.600 simulacoes desta sonda (2 tiers vezes N = 800) ficam
 * abaixo das duas, e a mesma escala de 1.500 simulacoes da sonda de vies de lado ja
 * roda com 180s de folga confortavel.
 *
 * A margem e deliberadamente larga e nao custa nada: um tempo limite so age quando a
 * rodada TRAVA, e nesse caso o que importa e o desfecho ser um estouro de tempo
 * explicito em vez de uma sessao pendurada. Margem apertada trocaria um risco que nao
 * existe (rodada lenta) por um que existe (falso estouro numa maquina carregada), e as
 * duas leituras desta onda (hoje e pre-Fase-25) precisam ser comparaveis entre si.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/probe-shape.ts"], // caminho literal, nunca curinga
    testTimeout: 180_000,
  },
});
