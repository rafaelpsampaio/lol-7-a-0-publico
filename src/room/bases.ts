/**
 * src/room/bases.ts
 *
 * As bases de jogadores que o host pode publicar no lobby (D10): os pacotes
 * lidos dos arquivos pela API e a base padrao do jogo. A cobertura
 * usa a mesma conta do servidor (server/room/baseCheck.ts): o pior caso do
 * baralho com carta unica no torneio, em src/draft/deckSafety.ts (A-01/A-02 de
 * 2026-10-02-pack-amigos-design). Ela mora em src/, entao importar daqui nao
 * fere o D-30 (src/room/** so importa do servidor o contrato de rede).
 */

import type { PlayerVersion, Role } from "../data/schema";
import { SEATS } from "../../server/protocol";
import { deckSafety } from "../draft/deckSafety";

/** Um pacote que o host pode publicar como base da sala. */
export interface BaseDisponivel {
  id: string;
  nome: string;
  jogadores: PlayerVersion[];
  /** Le o pacote de novo na hora de publicar, para ir com as ultimas edicoes (secao 7.1). */
  atualizar?: () => Promise<PlayerVersion[]>;
}

const ROTAS: Role[] = ["top", "jungle", "mid", "adc", "support"];

export interface CoberturaDaBase {
  pronta: boolean;
  /** Rotas com folga menor que `SEATS`, e quantas cartas faltam em cada. */
  faltas: { rota: Role; faltam: number }[];
}

export function coberturaDaBase(jogadores: PlayerVersion[], necessario = SEATS): CoberturaDaBase {
  const s = deckSafety(jogadores, necessario);
  const faltas = ROTAS.map((rota) => ({ rota, faltam: necessario - s.spareByRole[rota] })).filter(
    (f) => f.faltam > 0
  );
  return { pronta: s.ready, faltas };
}
