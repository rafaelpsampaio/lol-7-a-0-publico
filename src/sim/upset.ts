/**
 * src/sim/upset.ts
 *
 * Phase 28 (plano 28-04): destaque narrativo de zebra. ADICAO DE ESCOPO
 * declarada em 28-CONTEXT.md D-03/D-04/D-05, nao um dos quatro criterios de
 * sucesso do ROADMAP.md nem um dos requisitos FRC-01..04. Existe so para
 * tornar visivel, no HUD/playback e na tela de resultado da serie, o
 * desfecho que o canal de curva de rating (`ratingFightMult`, plano 28-02)
 * torna possivel: o time de menor rating de CARTA vencendo apesar de um gap
 * grande.
 *
 * D-05 e regra dura deste arquivo: a avaliacao acontece UMA UNICA VEZ, no
 * FIM da partida (`state.ended`/`state.winner`), e nunca por win
 * probability momentanea. `buildUpsetEvent` e `pickUpsetTicker` sao puras e
 * rng-free (a selecao de variante e determinista pelo gap, nunca por
 * `rng()`), para nao deslocar a timeline e nao quebrar INV-1.
 */

import { opponent, teamOf, type MatchState } from "./matchState";
import { isUpset, teamCardRating } from "./power";
import { baseEvent } from "./engine";
import type { SimEvent } from "./simEvents";

/**
 * Pool de variantes pt-BR do ticker de zebra (pelo menos tres, Task 1/Passo 3).
 * Cada variante recebe o nome do time VENCEDOR e o gap de rating arredondado
 * (sempre positivo: vencedor era o azarao). Tom de transmissao esportiva, sem
 * numero de probabilidade no texto (o ticker e narrativo, nao painel) e sem o
 * caractere de travessao. As tres dizem coisas diferentes: uma sobre o papel
 * de azarao, uma sobre o tamanho da diferenca no papel, uma sobre o
 * resultado contrariar a expectativa.
 */
export const UPSET_TICKERS: ReadonlyArray<(nome: string, gap: number) => string> = [
  (nome) => `ZEBRA: o ${nome} venceu jogando de azarao.`,
  (nome, gap) => `${nome} vira o jogo com ${gap} pontos de diferenca no papel contra ele.`,
  (nome) => `Resultado contraria a expectativa: o ${nome} leva a melhor.`,
];

/**
 * Selecao DETERMINISTICA de variante, sem gerador: indice igual ao gap
 * (arredondado, valor absoluto) modulo o tamanho do pool. Mesmo principio de
 * `pickWeightVariant` em `deathQuality.ts` (chave estavel do proprio
 * evento). Obrigatorio: qualquer chamada a `rng` aqui deslocaria toda a
 * timeline e quebraria INV-1 (T-28-04-03).
 */
function pickUpsetTicker(gap: number): (nome: string, gap: number) => string {
  const idx = Math.abs(Math.round(gap)) % UPSET_TICKERS.length;
  return UPSET_TICKERS[idx];
}

/**
 * Constroi o evento `upset_win` de fim de partida, ou `null` quando nenhuma
 * das condicoes de zebra bate. Pura, rng-free.
 *
 * Contrato:
 * - `null` se `state.ended` for falso ou `state.winner` for nulo (a
 *   avaliacao so acontece no FIM, D-05);
 * - `null` se `timeline` estiver vazia (nao ha ultimo evento de quem herdar
 *   `timeSec`/`winProbUserAfter`);
 * - `null` se `isUpset(teamCardRating(vencedor), teamCardRating(perdedor))`
 *   for falso (o vencedor nao era o azarao pelo limiar declarado);
 * - `null` se o nome do time vencedor for vazio ou indefinido (guard de
 *   nome, no espirito de `contextualTickerMustIncludePlayerName`: nunca
 *   emitir linha sem protagonista).
 *
 * Quando devolve evento: `kind` e `upset_win`, `side` e o lado vencedor,
 * `actors` e `[]`, `lane` e `"base"`. `timeSec` e `winProbUserAfter` sao
 * SOBRESCRITOS com os valores do ULTIMO evento da timeline (o `gg`), para
 * que o evento herde o instante e a leitura de fim de jogo em vez de
 * produzir leitura nova (D-05). `baseEvent` os preencheria a partir de
 * `state`, que na pratica coincide com o ultimo evento neste ponto de
 * chamada (fim do laco de ticks), mas a sobrescrita explicita torna o
 * contrato correto por construcao, nao por coincidencia de ordem de chamada.
 */
export function buildUpsetEvent(state: MatchState, timeline: SimEvent[]): SimEvent | null {
  if (!state.ended || state.winner === null) return null;
  if (timeline.length === 0) return null;

  const winnerSide = state.winner;
  const loserSide = opponent(winnerSide);
  const winnerTeam = teamOf(state, winnerSide);
  const loserTeam = teamOf(state, loserSide);

  const winnerRating = teamCardRating(winnerTeam);
  const loserRating = teamCardRating(loserTeam);
  if (!isUpset(winnerRating, loserRating)) return null;

  if (!winnerTeam.name) return null;

  const gap = Math.round(loserRating - winnerRating);
  const tickerFn = pickUpsetTicker(gap);
  const ticker = tickerFn(winnerTeam.name, gap);

  const lastEvent = timeline[timeline.length - 1];

  const event = baseEvent(state, "upset_win", winnerSide, {
    actors: [],
    lane: "base",
    ticker,
  });

  event.timeSec = lastEvent.timeSec;
  event.winProbUserAfter = lastEvent.winProbUserAfter;

  return event;
}
