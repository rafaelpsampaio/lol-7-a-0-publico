/**
 * src/room/telaEstavel.ts
 *
 * Escolhe QUAL tela desenhar a partir de uma chave primitiva, e so recria a
 * tela quando a chave muda.
 *
 * `{tela()}` no JSX reexecuta a funcao sempre que um sinal lido nela muda. As
 * funcoes `tela()` de RoomEntry e RoomScreen liam `store.state()` /
 * `store.tournament()` -- objetos novos a cada roomState --, entao cada
 * mensagem do servidor (alguem marcar pronto, cair, reconectar) descartava e
 * recriava a tela inteira: a SeriesWatch voltava para o Jogo 1 e a RoomScreen
 * esquecia "voltei ao chaveamento". Achado no teste de mesa do Pacote 1
 * (2026-10-01), depois que a Tarefa 1 corrigiu os efeitos.
 *
 * `createMemo(chave)` compara por `===`: com chave string, a tela so e
 * recriada quando a chave muda de verdade. `untrack` garante que o que a tela
 * le ao ser montada nao vira dependencia da escolha.
 *
 * As primitivas entram por parametro so para o teste usar o nucleo reativo do
 * cliente (mesmo motivo de quandoMudar.ts).
 */

import { createMemo, untrack, type Accessor, type JSX } from "solid-js";

export interface PrimitivasDeTela {
  createMemo: typeof createMemo;
  untrack: typeof untrack;
}

const SOLID: PrimitivasDeTela = { createMemo, untrack };

export function telaEstavel<K extends string>(
  chave: Accessor<K>,
  desenhar: (atual: K) => JSX.Element,
  p: PrimitivasDeTela = SOLID
): Accessor<JSX.Element> {
  const atual = p.createMemo(chave);
  return p.createMemo(() => {
    const k = atual();
    return p.untrack(() => desenhar(k));
  });
}
