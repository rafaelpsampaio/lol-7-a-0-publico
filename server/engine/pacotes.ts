/**
 * server/engine/pacotes.ts
 *
 * Portal leve do editor de pacotes (D-04): o schema do jogo e as regras da
 * carta, sem a metade pesada (server/engine/tournament.ts) e sem
 * server/engine/schema.ts (que arrasta o orquestrador do draft e o rng).
 * Reexporta direto de src/data/schema. Seguro no Node e no navegador: nada de
 * node:* aqui.
 */

export { PlayerDatabaseSchema } from "../../src/data/schema";
export type { PlayerVersion, Role } from "../../src/data/schema";
export {
  conferirPacote,
  novoIdDePacote,
  caminhoDaFoto,
  ehJpeg,
  ID_VALIDO,
  TAMANHO_MAXIMO_DA_FOTO,
  type ErrosDaCarta,
} from "../../src/pacotes/regrasDaCarta";
