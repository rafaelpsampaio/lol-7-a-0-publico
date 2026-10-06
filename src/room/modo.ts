/**
 * src/room/modo.ts
 *
 * Qual app esta na tela: a sala ou o jogo solo (Rundown da Sala 2, D3/U13).
 * Antes a sala era desenhada EM CIMA do menu solo, que continuava ali embaixo
 * o tempo todo, e o convidado que abria o link caia no menu solo com um botao
 * "Jogar com amigos" perdido no topo.
 *
 * Com a sala em primeiro plano, `App.tsx` nao desenha nada do solo. "Sair da
 * sala" leva ao menu solo, que mostra uma faixa "Voltar para a sala"; a
 * escolha vale para esta aba (sessionStorage), entao recarregar a pagina nao
 * joga a pessoa de volta para onde ela acabou de sair.
 */

import { createSignal } from "solid-js";

const CHAVE_FORA = "lolseteazero:sala:fora";

const [salaEmPrimeiroPlano, setSalaEmPrimeiroPlanoSinal] = createSignal(false);

export { salaEmPrimeiroPlano };

function sessao(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** A pessoa escolheu sair da sala nesta aba? */
export function saiuDaSalaNestaAba(): boolean {
  try {
    return sessao()?.getItem(CHAVE_FORA) === "1";
  } catch {
    return false;
  }
}

/** Mostra a sala (true) ou o jogo solo (false), lembrando a escolha nesta aba. */
export function setSalaEmPrimeiroPlano(aberta: boolean): void {
  setSalaEmPrimeiroPlanoSinal(aberta);
  try {
    if (aberta) sessao()?.removeItem(CHAVE_FORA);
    else sessao()?.setItem(CHAVE_FORA, "1");
  } catch {
    // sem sessionStorage: a escolha vale so ate recarregar
  }
}
