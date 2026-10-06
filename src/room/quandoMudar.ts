/**
 * src/room/quandoMudar.ts
 *
 * Reage a uma MUDANCA DE VALOR, nao a cada mensagem do servidor.
 *
 * Todo roomState chega como um objeto novo. Um createEffect que le
 * `store.tournament()` reexecuta a cada mensagem -- alguem marcar pronto, cair
 * ou reconectar -- mesmo quando o que ele vigia (a serie que eu assisto, o
 * jogo da tela) nao mudou. Foi assim que todo mundo voltava para o Jogo 1 a
 * cada "Estou pronto" (Rundown da Sala 2, achado 1).
 *
 * `createMemo` compara por `===`: com chave primitiva, o efeito so roda quando
 * o valor muda. Com chave objeto, roda a cada objeto novo DAQUELE sinal (util
 * para a mensagem `games`, que so chega quando a minha serie muda ou e
 * reenviada). `defer: true` pula a primeira execucao: o estado inicial de quem
 * chama ja e o de "acabou de mudar".
 *
 * As primitivas entram por parametro so para o teste usar o nucleo reativo do
 * cliente: a suite roda o Solid em modo SSR, onde createEffect nunca executa.
 */

import { createEffect, createMemo, on, type Accessor } from "solid-js";

export interface PrimitivasReativas {
  createMemo: typeof createMemo;
  createEffect: typeof createEffect;
  on: typeof on;
}

const SOLID: PrimitivasReativas = { createMemo, createEffect, on };

export function quandoMudar<T>(
  chave: Accessor<T>,
  aoMudar: (atual: T) => void,
  p: PrimitivasReativas = SOLID
): void {
  const valor = p.createMemo(chave);
  p.createEffect(p.on(valor, (atual) => aoMudar(atual), { defer: true }));
}
