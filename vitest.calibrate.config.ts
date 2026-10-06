import { defineConfig } from "vitest/config";

/**
 * Config dedicada para o gate de aceite `npm run calibrate` (Fase 23 / INST-01).
 *
 * Ate esta correcao, o include usava um padrao amplo que casava com todos os
 * harnesses de scripts/, e o arquivo nao declarava testTimeout. Sem tempo
 * limite explicito, o default de 5000ms do vitest matava os harnesses mais
 * pesados por estouro de tempo antes de qualquer assert ser avaliado, e o
 * resultado se misturava com o dos harnesses mais rapidos, que completavam
 * normalmente: o comando quebrava em silencio em vez de reprovar de forma
 * legivel.
 *
 * A convencao que evita a repeticao deste bug (include sempre literal, nunca
 * curinga; testTimeout sempre declarado) esta registrada em scripts/README.md.
 *
 * `npm run calibrate` roda os dois harnesses originais do gate de aceite:
 * scripts/calibrate.ts e scripts/calibrate-engine.ts. O comando que roda
 * todos os gates de calibracao juntos e `npm run calibrate:all` (Plano 23-06).
 *
 * A margem de testTimeout e deliberadamente muito maior que o tempo medido
 * hoje (poucos segundos): ela existe para que crescimento futuro de N nunca
 * mais produza desfecho por tempo em vez de desfecho por assert, que e
 * literalmente o requisito INST-01.
 *
 * Fase 28 (plano 28-01, Task 2): scripts/calibrate-engine.ts passou de 3 tiers
 * com N=300 (900 partidas) para 6 tiers-ancora com N=600 (3600 partidas de
 * motor completo por rodada). testTimeout elevado de 300_000 para 900_000
 * para manter a mesma margem de duas ordens de grandeza sobre o tempo real
 * medido nesta execucao (ver docs/diagnostics/28-ancoragem.md Bloco 5).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/calibrate.ts", "scripts/calibrate-engine.ts"],
    testTimeout: 900_000, // 900s: margem sobre o tempo medido com 3600 partidas (Fase 28)
  },
});
