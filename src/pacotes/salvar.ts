/**
 * src/pacotes/salvar.ts
 *
 * O Salvar do editor (E-05, secao 3.5): sobe as fotos pendentes, grava o
 * pacote e so depois apaga as fotos que sairam. Todo resultado devolve o
 * rascunho atualizado, com as fotos que ja subiram marcadas como enviadas.
 */

import type { ApiDePacotes } from "./api";
import { FalhaDaApi } from "./api";
import type { ErrosDaCarta } from "./regrasDaCarta";
import {
  criarRascunho,
  fotosParaApagar,
  fotosParaSubir,
  marcarFotoEnviada,
  paraSalvar,
  type Rascunho,
} from "./rascunho";

export type ResultadoDoSalvar =
  | { tipo: "salvo"; rascunho: Rascunho }
  | { tipo: "conflito"; rascunho: Rascunho }
  | { tipo: "sem-permissao"; rascunho: Rascunho }
  | { tipo: "invalido"; erro: string; cartas: ErrosDaCarta[]; rascunho: Rascunho }
  | { tipo: "falha"; mensagem: string; rascunho: Rascunho };

export async function salvarRascunho(
  r: Rascunho,
  api: ApiDePacotes,
  opcoes: { forcar?: boolean } = {}
): Promise<ResultadoDoSalvar> {
  let atual = r;
  try {
    for (const [personId, dados] of fotosParaSubir(atual)) {
      await api.subirFoto(personId, dados);
      atual = marcarFotoEnviada(atual, personId);
    }
    const { nome, players } = paraSalvar(atual);
    const { versao } = await api.salvar(atual.id, {
      nome,
      players,
      versaoBase: atual.versaoBase,
      forcar: opcoes.forcar === true,
    });
    for (const personId of fotosParaApagar(atual)) {
      // 409 = outro pacote ainda usa a foto; o servidor faz certo em nao apagar.
      await api.apagarFoto(personId).catch(() => undefined);
    }
    return { tipo: "salvo", rascunho: criarRascunho({ id: atual.id, nome, versao, players }) };
  } catch (e) {
    // Revisao final I-1: erro inesperado (JSON truncado, TypeError) nao pode
    // travar a tela. Mantem `atual` para as fotos ja enviadas nao subirem de novo.
    if (!(e instanceof FalhaDaApi)) {
      const motivo = e instanceof Error && e.message !== "" ? e.message : "erro inesperado";
      return { tipo: "falha", mensagem: `Não consegui gravar o arquivo (${motivo}).`, rascunho: atual };
    }
    const d = e.detalhe;
    if (d.tipo === "http" && d.status === 409) return { tipo: "conflito", rascunho: atual };
    if (d.tipo === "http" && d.status === 403) return { tipo: "sem-permissao", rascunho: atual };
    if (d.tipo === "http" && d.status === 422) return { tipo: "invalido", erro: d.erro, cartas: d.cartas ?? [], rascunho: atual };
    const mensagem =
      d.tipo === "rede"
        ? "Sem conexão com o servidor. Suas alterações continuam aqui."
        : `Não consegui gravar o arquivo (${d.erro}).`;
    return { tipo: "falha", mensagem, rascunho: atual };
  }
}

/** Descartar: apaga as fotos que subiram num Salvar que nao terminou (secao 8). */
export async function descartarRascunho(r: Rascunho, api: ApiDePacotes): Promise<void> {
  for (const [personId, f] of Object.entries(r.fotos)) {
    if (f.tipo === "nova" && f.enviada) await api.apagarFoto(personId).catch(() => undefined);
  }
}
