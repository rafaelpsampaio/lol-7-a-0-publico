/**
 * src/room/identidade.ts
 *
 * "Quem sou eu nesta sala" e "qual a sigla de cada time" -- a mesma resposta
 * em todas as telas (cabecalho da sala, lobby, chaveamento).
 */

import type { RoomWire } from "../../server/protocol";
import { tagsUnicos } from "../tournament/teamNames";

/**
 * Sigla de cada jogador no lobby, pela mesma regra que o servidor usa ao montar
 * os times (tagsUnicos, na ordem dos assentos). Os assentos humanos sao os
 * jogadores CONECTADOS na hora do draft, na ordem de entrada -- e tagsUnicos so
 * olha para tras, entao os bots que entram depois nao mudam a sigla de ninguem.
 * Quem caiu fica sem sigla: se nao voltar, nao ganha assento.
 */
export function siglasDoLobby(players: RoomWire["players"]): Map<string, string> {
  const comAssento = players.filter((p) => !p.spectator && p.connected);
  const tags = tagsUnicos(comAssento.map((p) => p.teamName));
  return new Map(comAssento.map((p, i) => [p.publicId, tags[i]!]));
}

export interface MeuLugar {
  apelido: string;
  /** Vazio para espectador. */
  time: string;
  sigla: string | null;
  espectador: boolean;
  host: boolean;
}

/**
 * Meu lugar na sala, pela fase: no lobby a sigla e a prevista; no draft vem do
 * assento; no torneio, do time (que tem a sigla definitiva).
 */
export function meuLugar(state: RoomWire | null, publicId: string | null): MeuLugar | null {
  if (state === null || publicId === null) return null;
  const eu = state.players.find((p) => p.publicId === publicId);
  if (eu === undefined) return null;

  let sigla: string | null = null;
  let time = eu.teamName;
  const doTorneio = state.tournament?.teams.find((t) => t.publicId === publicId);
  if (doTorneio !== undefined) {
    sigla = doTorneio.tag;
    time = doTorneio.displayName;
  } else if (state.draft !== null) {
    const assento = state.draft.seats.find((s) => s.publicId === publicId);
    if (assento !== undefined) {
      sigla = tagsUnicos(state.draft.seats.map((s) => s.teamName))[assento.index] ?? null;
      time = assento.teamName;
    }
  } else if (!eu.spectator) {
    sigla = siglasDoLobby(state.players).get(publicId) ?? null;
  }

  return { apelido: eu.nickname, time, sigla, espectador: eu.spectator, host: eu.isHost };
}
