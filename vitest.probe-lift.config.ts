import { defineConfig } from "vitest/config";

/**
 * Config dedicada para a sonda da matriz de lift (Fase 25C, onda 1).
 *
 * Include estreito em scripts/probe-lift.ts, caminho literal e nunca curinga (convencao
 * da secao 1 de scripts/README.md). O curinga foi exatamente o defeito que fez
 * vitest.calibrate.config.ts arrastar seis harnesses numa rodada so.
 *
 * ESTA CONFIG NAO E DE GATE. O arquivo incluido nao contem assercao nenhuma: ele mede e
 * escreve tmp/lift-{TAG}.txt. A sonda tambem NAO entra em scripts/calibrate-all.mjs,
 * cuja lista fixa de sete gates fica intacta: as bandas de acoplamento nascem na onda 2,
 * em scripts/calibrate-pace.ts.
 *
 * testTimeout em 600 s, justificado por ancora de escala contra os harnesses existentes e
 * contra o custo MEDIDO do instrumento:
 *
 *   scripts/probe-shape.ts        1.600 simulacoes, quase nenhuma conta depois        180 s
 *   scripts/calibrate-pace.ts     4.800 simulacoes mais bandas                        300 s
 *   scripts/diagnose-engine.ts    cerca de 15.500 simulacoes                          600 s
 *   ESTA SONDA                    800 simulacoes MAIS a matriz de lift                600 s
 *
 * A sonda tem poucas simulacoes e MUITA conta depois delas, que e o oposto do perfil das
 * outras tres: a pesquisa da fase mediu 114 s so para a matriz de 24 pares com varredura
 * em N = 2000, e este arquivo roda cerca de 60 analises de par mais 32 celulas de
 * varredura, com bootstrap de 600 reamostras em cada uma. Com LIFT_N = 2000 (a leitura de
 * OBSERVACAO) o custo sobe na mesma proporcao, e e esse o pior caso que o limite cobre.
 *
 * A margem e deliberadamente larga e nao custa nada: um tempo limite so age quando a
 * rodada TRAVA, e nesse caso o que importa e o desfecho ser um estouro explicito em vez
 * de uma sessao pendurada. Margem apertada trocaria um risco que nao existe (rodada
 * lenta) por um que existe (falso estouro numa maquina carregada), e as leituras PRE e
 * POS desta fase precisam ser comparaveis entre si.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/probe-lift.ts"], // caminho literal, nunca curinga
    testTimeout: 600_000,
  },
});
