/**
 * server/room/replay.ts
 *
 * A timeline de um jogo ocupa 346 KB; o torneio inteiro, 17 MB. Guardar isso a
 * cada mudanca da sala seria absurdo, entao o snapshot vai sem os events (D-25)
 * e a timeline volta refeita: runSeriesGame e deterministica.
 *
 * O que protege a sala de mostrar um jogo que nao aconteceu: cada jogo refeito
 * e conferido em duas camadas contra o que ficou guardado.
 *
 * Camada 1: todo campo de StoredGame menos `events` (seed, winnerId,
 * userFrameTeamId, totalPlaybackMs, champions) precisa bater. `seed` sozinho
 * nao basta -- ela sai de (semente do bracket, slotId, indice do jogo) e e
 * matematicamente independente do elenco; trocar as cartas de um time nao
 * muda a seed. `winnerId` sozinho tambem nao -- e binario e coincide por
 * acaso. `champions` mapeia jogador para campeao e e derivado do elenco, entao
 * uma troca de base o altera sempre: e ele que fecha esse buraco.
 *
 * Camada 2: o hash em `timelineHashes` (server/room/tournament.ts) precisa
 * bater com o hash do jogo refeito. Pega o que a camada 1 ainda deixaria
 * passar -- uma mudanca na propria engine de simulacao que mantivesse todos os
 * campos de fora de `events` iguais.
 *
 * Se a base ou o chaos tiverem mudado por baixo, ou a engine tiver mudado,
 * qualquer uma das duas camadas falha e a sala responde "gravacao
 * indisponivel" em vez de exibir outra partida com cara de original.
 *
 * PURO: sem Date.now, sem Math.random, sem disco.
 */

import { runSeriesGame } from "../engine/tournament";
import type { ChampionEntry, SlotId, StoredGame, TournamentState } from "../engine/schema";
import { hashTimeline, type RoomTournament } from "./tournament";

export type ReplayResult =
  | { ok: true; games: StoredGame[] }
  | { ok: false; error: "serie_desconhecida" | "gravacao_indisponivel" };

/** Um jogo sem evento nenhum e um jogo que veio do snapshot. */
export function hasTimelines(games: StoredGame[]): boolean {
  return games.length > 0 && games.every((g) => g.events.length > 0);
}

/** Zera os events de todo jogo — o que vai para o disco (D-25). */
export function stripTimelines(bracket: TournamentState): TournamentState {
  const slots = { ...bracket.slots };
  for (const slotId of Object.keys(slots) as SlotId[]) {
    const slot = slots[slotId]!;
    if (slot.series.games.length === 0) continue;
    slots[slotId] = {
      ...slot,
      series: { ...slot.series, games: slot.series.games.map((g) => ({ ...g, events: [] })) },
    };
  }
  return { ...bracket, slots };
}

export function timelineOf(
  t: RoomTournament,
  slotId: SlotId,
  catalogue: ChampionEntry[]
): ReplayResult {
  const serie = t.bracket.slots[slotId]?.series;
  if (serie === undefined || serie.games.length === 0) {
    return { ok: false, error: "serie_desconhecida" };
  }
  if (hasTimelines(serie.games)) return { ok: true, games: serie.games };

  // Refaz jogo a jogo. runSeriesGame le o indice de series.games.length, entao
  // o estado parcial precisa ter exatamente os jogos ja refeitos.
  const hashesGuardados = t.timelineHashes[slotId] ?? [];
  const refeitos: StoredGame[] = [];
  for (const guardado of serie.games) {
    const parcial = comJogos(t.bracket, slotId, refeitos);
    const refeito = runSeriesGame(parcial, slotId, t.chaosLevel, catalogue, guardado.formVersion ?? 0, guardado.newTraitEffects !== false);

    // Camada 1: todo campo menos events.
    if (JSON.stringify(semEvents(refeito)) !== JSON.stringify(semEvents(guardado))) {
      return { ok: false, error: "gravacao_indisponivel" };
    }
    // Camada 2: a impressao digital da timeline. Ausencia de hash guardado
    // nunca vira permissao -- e gravacao indisponivel, igual a um hash que nao bate.
    const hashGuardado = hashesGuardados[refeitos.length];
    if (hashGuardado === undefined || hashTimeline(refeito) !== hashGuardado) {
      return { ok: false, error: "gravacao_indisponivel" };
    }

    refeitos.push(refeito);
  }
  return { ok: true, games: refeitos };
}

/** Todo campo de um jogo guardado, menos a timeline (D-25 -- o que sobrevive ao strip). */
function semEvents(jogo: StoredGame): Omit<StoredGame, "events"> {
  const { events, ...resto } = jogo;
  void events;
  return resto;
}

function comJogos(bracket: TournamentState, slotId: SlotId, games: StoredGame[]): TournamentState {
  return {
    ...bracket,
    slots: {
      ...bracket.slots,
      [slotId]: {
        ...bracket.slots[slotId]!,
        series: { ...bracket.slots[slotId]!.series, games },
      },
    },
  };
}
