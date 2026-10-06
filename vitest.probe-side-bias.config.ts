import { defineConfig } from "vitest/config";

/**
 * Config dedicada para a sonda de vies de lado (Fase 25 / PACE-02).
 *
 * Include estreito em scripts/probe-side-bias.ts, caminho literal e nunca curinga
 * (convencao da secao 1 de scripts/README.md). O curinga foi exatamente o defeito que
 * fez vitest.calibrate.config.ts arrastar seis harnesses numa rodada so.
 *
 * ESTA CONFIG NAO E DE GATE. O arquivo incluido nao contem assercao nenhuma: ele mede e
 * escreve tmp/side-bias.txt. A sonda tambem nao entra em scripts/calibrate-all.mjs.
 *
 * testTimeout em 180s, justificado em duas ancoras.
 *
 * A ancora de escala vem dos harnesses existentes: scripts/calibrate-pace.ts roda 6
 * tiers x N=800, ou seja 4.800 simulacoes completas, com testTimeout de 300s;
 * scripts/diagnose-engine.ts roda cerca de 15.500 simulacoes com 600s. As 1.500
 * simulacoes desta sonda ficam uma ordem de grandeza abaixo das duas.
 *
 * A ancora medida vem da propria rodada PRE desta fase: 1.500 partidas espelhadas
 * 75 contra 75 custaram 15,8 s de teste. Os 180s sao portanto cerca de onze vezes o
 * medido. A margem e deliberadamente larga e nao custa nada: um tempo limite so age
 * quando a rodada TRAVA, e nesse caso o que importa e o desfecho ser um estouro de
 * tempo explicito em vez de uma sessao pendurada. Margem apertada aqui trocaria um
 * risco que nao existe (rodada lenta) por um que existe (falso estouro de tempo numa
 * maquina carregada), e a leitura POS do fechamento precisa ser comparavel com esta.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/probe-side-bias.ts"], // caminho literal, nunca curinga
    testTimeout: 180_000,
  },
});
