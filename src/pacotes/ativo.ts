/**
 * src/pacotes/ativo.ts
 *
 * Regras puras sobre a lista de pacotes e o pacote ativo do solo (revisao
 * final M2): pacote com arquivo quebrado aparece na lista do editor, mas nao
 * entra no solo nem no lobby, e um erro de leitura so apaga a preferencia
 * salva quando o pacote realmente deixou de existir.
 */

import { FalhaDaApi, type ResumoDoPacote } from "./api";

/** Pacotes que o jogo pode usar (solo, bases do lobby): sem os de arquivo quebrado. */
export function soValidos<T extends Pick<ResumoDoPacote, "invalido">>(lista: readonly T[]): T[] {
  return lista.filter((p) => p.invalido !== true);
}

/**
 * O que fazer com a preferencia salva quando o pacote ativo nao carrega:
 * 404 = o pacote acabou, volta aos Pros para sempre; qualquer outro erro
 * (rede, 500, arquivo quebrado) so usa os Pros nesta sessao e guarda a escolha.
 */
export function reacaoAoErroDoAtivo(err: unknown): "apagar-preferencia" | "so-nesta-sessao" {
  return err instanceof FalhaDaApi && err.detalhe.tipo === "http" && err.detalhe.status === 404
    ? "apagar-preferencia"
    : "so-nesta-sessao";
}
