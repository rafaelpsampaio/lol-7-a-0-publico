/**
 * src/room/narracao.ts
 *
 * A narracao de cada partida vem pronta do motor, escrita do ponto de vista do
 * lado "user" do enquadramento: "GG — o Seu time fechou a partida contra o
 * Rival." No solo isso e verdade (o humano e sempre o lado "user"). Na sala,
 * nao: o enquadramento e o time A da serie, e quem torce pelo time B lia "o
 * Seu time fechou a partida" justamente quando perdia (Rundown da Sala 2,
 * achado S9 -- "voce ganhou quando voce perdeu").
 *
 * O motor fica intocado (fora de escopo desde a Fase 1). A troca acontece so
 * na exibicao: "Seu time" vira o nome do lado A, "Rival" o nome do lado B.
 */

import type { GameEvent } from "../sim/types";

/** Os dois nomes-padrao que o motor da aos lados (src/sim/matchState.ts). */
const NOME_LADO_USER = /\bSeu time\b/g;
const NOME_LADO_RIVAL = /\bRival\b/g;

/** Uma linha da narracao com os nomes reais dos dois times. */
export function renomearLinha(texto: string, nomeUser: string, nomeRival: string): string {
  // Funcao de troca (e nao string): um nome de time com "$&" ou "$1" seria
  // lido como padrao de substituicao.
  return texto.replace(NOME_LADO_USER, () => nomeUser).replace(NOME_LADO_RIVAL, () => nomeRival);
}

/**
 * A timeline com a narracao reescrita. Evento sem `ticker` (formato legado)
 * passa intacto; nada alem do texto muda -- placar, mapa e probabilidade
 * continuam no enquadramento do motor, que e o que o resto da tela le.
 */
export function renomearNarracao(
  eventos: GameEvent[],
  nomeUser: string,
  nomeRival: string
): GameEvent[] {
  return eventos.map((ev) =>
    ev.ticker === undefined ? ev : { ...ev, ticker: renomearLinha(ev.ticker, nomeUser, nomeRival) }
  );
}

/**
 * `renomearNarracao` com memoria: a mesma timeline (mesmo array) com os mesmos
 * nomes devolve o MESMO array renomeado. A tela da partida e redesenhada a
 * cada roomState (alguem marca pronto, cai, volta); sem memoria, cada um
 * desses criaria uma timeline nova de ate centenas de eventos.
 */
export function criarNarracaoComMemoria(): (
  eventos: GameEvent[],
  nomeUser: string,
  nomeRival: string
) => GameEvent[] {
  const memoria = new WeakMap<GameEvent[], { chave: string; saida: GameEvent[] }>();
  return (eventos, nomeUser, nomeRival) => {
    const chave = `${nomeUser}\u0000${nomeRival}`;
    const guardado = memoria.get(eventos);
    if (guardado !== undefined && guardado.chave === chave) return guardado.saida;
    const saida = renomearNarracao(eventos, nomeUser, nomeRival);
    memoria.set(eventos, { chave, saida });
    return saida;
  };
}
