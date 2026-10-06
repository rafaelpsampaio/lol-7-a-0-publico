/**
 * server/room/baseCheck.ts
 *
 * Diagnostico da base da sala (A-02, spec 2026-10-02-pack-amigos-design). Com a
 * carta unica no torneio e a pessoa unica so dentro do time (A-01), a base serve
 * quando nenhuma sequencia de escolhas deixa um dos 8 times sem rota. A conta
 * mora em src/draft/deckSafety.ts (o lobby e o solo usam a mesma) e chega aqui
 * pelo server/engine/schema.ts.
 */

import { deckSafety, deckShortfalls, type PlayerVersion } from "../engine/schema";
import { SEATS, type BaseStatus } from "../protocol";

/** Folga por rota e se isso basta para `needed` times. */
export function baseStatus(players: PlayerVersion[], needed = SEATS): BaseStatus {
  return deckSafety(players, needed);
}

/** Frase pronta para o console e para o erro do startDraft. */
export function baseStatusMessage(status: BaseStatus): string {
  if (status.ready) {
    return `Base pronta: nenhuma sequência de escolhas deixa um dos ${status.needed} times sem rota.`;
  }
  return (
    `A base da sala pode deixar um dos ${status.needed} times sem rota no draft. ` +
    `Faltam cartas em: ${deckShortfalls(status).join(", ")}. ` +
    `Escolha uma base maior no lobby antes de começar.`
  );
}
