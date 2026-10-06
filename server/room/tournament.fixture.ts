/**
 * server/room/tournament.fixture.ts
 *
 * Draft de mentira ja terminado, para os testes do torneio da sala. Sem
 * `.test.` no nome de proposito: o Vitest nao coleta este arquivo como suite.
 *
 * As Tarefas 4, 5, 6 e 7 usam exatamente este fixture — nao escrevem o seu
 * proprio draft de mentira.
 */

import { createDraft, autoPick, isFinished as draftTerminou, type DraftState } from "./draft";
import { makeBase } from "./cards.fixture";
import { createRoomTournament, type RoomTournament } from "./tournament";
import type { PlayerVersion } from "../engine/schema";

/** Um draft ja terminado: 8 assentos, 5 cartas cada, sem pessoa repetida (D-13). */
export function draftCompleto(humanos: number): { draft: DraftState; players: PlayerVersion[] } {
  const players = makeBase(8);
  let d = createDraft({
    players,
    humans: Array.from({ length: humanos }, (_, i) => ({ clientId: `c${i}`, teamName: `Time ${i}` })),
    seed: "semente-de-teste",
    now: 0,
    budget: () => null,
  });
  while (!draftTerminou(d)) d = autoPick(d, players, 0, () => null);
  return { draft: d, players };
}

/** Um torneio da sala pronto, direto do draft de mentira acima. */
export function criar(humanos: number): RoomTournament {
  return createRoomTournament({ ...draftCompleto(humanos), chaosLevel: 0.25 });
}
