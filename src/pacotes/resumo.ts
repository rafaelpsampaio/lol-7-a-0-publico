/**
 * src/pacotes/resumo.ts
 *
 * O que a lista e o editor mostram de um pacote: contagem por rota, selo do
 * baralho (a mesma conta do menu e do lobby, deckSafety) e a capa de fotos.
 */

import type { PlayerVersion, Role } from "../data/schema";
import { deckSafety } from "../draft/deckSafety";
import { playerName } from "../data/playerPresentation";
import { ROTAS } from "./regrasDaCarta";

export const NOME_DA_ROTA: Record<Role, string> = {
  top: "Topo",
  jungle: "Selva",
  mid: "Meio",
  adc: "Atirador",
  support: "Suporte",
};

export function contagemPorRota(cartas: readonly PlayerVersion[]): Record<Role, number> {
  const n: Record<Role, number> = { top: 0, jungle: 0, mid: 0, adc: 0, support: 0 };
  for (const c of cartas) n[c.primaryRole]++;
  return n;
}

export function juntarComE(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

export interface SeloDoBaralho {
  pronto: boolean;
  texto: string;
}

export function seloDoBaralho(cartas: readonly PlayerVersion[]): SeloDoBaralho {
  const s = deckSafety([...cartas]);
  if (s.ready) return { pronto: true, texto: "Pronto para torneio" };
  const faltam = ROTAS.filter((r) => s.spareByRole[r] < s.needed).map((r) => NOME_DA_ROTA[r]);
  return { pronto: false, texto: `Faltam cartas em ${juntarComE(faltam)}` };
}

export type ItemDaCapa = { tipo: "foto"; src: string } | { tipo: "iniciais"; texto: string };

/** Ate `max` pessoas, com foto primeiro; se sobrar gente, o ultimo vira "+N". */
export function capaDoPacote(cartas: readonly PlayerVersion[], max = 5): ItemDaCapa[] {
  const vistas = new Set<string>();
  const fotos: ItemDaCapa[] = [];
  const iniciais: ItemDaCapa[] = [];
  for (const c of cartas) {
    if (vistas.has(c.personId)) continue;
    vistas.add(c.personId);
    if (c.photo !== undefined) fotos.push({ tipo: "foto", src: c.photo });
    else iniciais.push({ tipo: "iniciais", texto: playerName(c).slice(0, 2).toUpperCase() });
  }
  const capa = [...fotos, ...iniciais].slice(0, max);
  const fora = vistas.size - capa.length;
  if (fora > 0 && capa.length === max) capa[max - 1] = { tipo: "iniciais", texto: `+${fora + 1}` };
  return capa;
}
