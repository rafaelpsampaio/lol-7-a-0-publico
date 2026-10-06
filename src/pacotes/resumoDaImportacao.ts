/**
 * src/pacotes/resumoDaImportacao.ts
 *
 * Texto que a lista de pacotes mostra depois de importar uma planilha
 * (revisao final M1): quantas cartas entraram, quantas linhas ficaram de fora
 * por erro e quantos pools foram completados com campeoes de preenchimento.
 * Usa o relatorio do parseWorkbook, sem mudar o parser.
 */

import type { ImportResult } from "../data/packImport";
import type { ErrosDaCarta } from "./regrasDaCarta";

/** O parser avisa "Pool com N campeões, completado até 8." em cada pool completado. */
const PADRAO_POOL_COMPLETADO = /^Pool com \d+ campeões, completado/;

export function resumoDaImportacao(r: Pick<ImportResult, "players" | "report">): string {
  const cartas = r.players.length;
  const comErro = r.report.filter((l) => l.status === "error").length;
  const pools = r.report.filter((l) => l.status !== "error" && l.messages.some((m) => PADRAO_POOL_COMPLETADO.test(m))).length;
  const partes = [cartas === 1 ? "1 carta importada" : `${cartas} cartas importadas`];
  if (comErro > 0) partes.push(comErro === 1 ? "1 linha com erro ficou de fora" : `${comErro} linhas com erro ficaram de fora`);
  if (pools > 0) partes.push(pools === 1 ? "1 pool completado com campeões de preenchimento" : `${pools} pools completados com campeões de preenchimento`);
  return `${partes.join("; ")}.`;
}

/** Texto do 422 do servidor: diz quais cartas falharam em vez de so contar. */
export function textoDoErro422(erro: string, cartas: readonly ErrosDaCarta[] | undefined): string {
  const ids = (cartas ?? []).map((c) => c.id);
  if (ids.length === 0) return erro;
  const mostrados = ids.slice(0, 8).join(", ");
  return `${erro} Cartas com problema: ${mostrados}${ids.length > 8 ? ` e mais ${ids.length - 8}` : ""}.`;
}
