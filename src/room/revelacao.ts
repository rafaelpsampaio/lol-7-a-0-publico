/**
 * src/room/revelacao.ts
 *
 * Nada revela um resultado antes da partida que o decide (Rundown da Sala 2,
 * D1). A onda simula as series inteiras no servidor no instante em que roda
 * (D-24), e o roomState chega com placares, vencedores e "Eliminado" antes de
 * qualquer pessoa assistir. Aqui mora a regra de quando cada coisa pode
 * aparecer na tela DESTA pessoa:
 *
 *  - serie de onda anterior a atual: revelada (os confrontos novos ja contam
 *    quem passou -- esconder seria fingir);
 *  - serie da onda atual: revelada so depois que a pessoa viu o jogo que a
 *    decidiu, ou clicou "Mostrar resultados desta rodada";
 *  - "Pular para o pódio" (D2): tudo revelado.
 *
 * Funcoes puras: o conjunto de series vistas vem de fora (vistas.ts).
 */

import type { SlotId } from "../net/store";
import type { TournamentSeriesWire, TournamentTeamWire, TournamentWire } from "../../server/protocol";
import { ONDA_DO_SLOT } from "../../server/protocol";
import { SLOT_FEED_IN } from "../tournament/schema";

export interface ContextoDeRevelacao {
  /** Onda que acabou de rodar (TournamentWire.wave). */
  onda: number;
  resultadosLiberados?: boolean;
  /** Series que esta pessoa ja viu ate o jogo decisivo (ou mandou mostrar). */
  vistas: ReadonlySet<SlotId>;
  /** A sala pulou para o podio: nada a esconder. */
  pulado: boolean;
}

export function contextoDe(t: TournamentWire, vistas: ReadonlySet<SlotId>): ContextoDeRevelacao {
  return { onda: t.wave, vistas, pulado: t.pulado, resultadosLiberados: t.resultadosLiberados };
}

/** O resultado desta serie ja pode aparecer para esta pessoa? */
export function serieRevelada(serie: Pick<TournamentSeriesWire, "slotId" | "gamesPlayed">, ctx: ContextoDeRevelacao): boolean {
  if (serie.gamesPlayed === 0) return true; // nao jogada: nao ha resultado a esconder
  if (ctx.pulado) return true;
  if (ctx.resultadosLiberados && ONDA_DO_SLOT[serie.slotId] === ctx.onda) return true;
  if (ONDA_DO_SLOT[serie.slotId] < ctx.onda) return true;
  return ctx.vistas.has(serie.slotId);
}

/** As series da onda atual que esta pessoa ainda nao viu. */
export function seriesEscondidas(t: TournamentWire, ctx: ContextoDeRevelacao): SlotId[] {
  return t.series.filter((s) => !serieRevelada(s, ctx)).map((s) => s.slotId);
}

/**
 * O lado A/B de uma serie pode mostrar o nome do time? So quando a serie que
 * o alimenta (vencedor/perdedor de outra) ja esta revelada -- senao o card da
 * semifinal contaria quem ganhou a quartas.
 */
export function ladoRevelado(
  slotId: SlotId,
  lado: "teamA" | "teamB",
  t: TournamentWire,
  ctx: ContextoDeRevelacao
): boolean {
  const origem = SLOT_FEED_IN[slotId][lado];
  const de = "winFrom" in origem ? origem.winFrom : "loseFrom" in origem ? origem.loseFrom : null;
  if (de === null) return true;
  const alimentadora = t.series.find((s) => s.slotId === de);
  return alimentadora === undefined || serieRevelada(alimentadora, ctx);
}

/**
 * "Eliminado" so aparece quando todas as series do time ja estao reveladas
 * para esta pessoa -- a ultima delas e a que o eliminou.
 */
export function eliminadoVisivel(time: TournamentTeamWire, t: TournamentWire, ctx: ContextoDeRevelacao): boolean {
  if (!time.eliminated) return false;
  return t.series
    .filter((s) => s.teamAId === time.id || s.teamBId === time.id)
    .every((s) => serieRevelada(s, ctx));
}

/** A Grande Final (e portanto o campeao) ja pode aparecer? */
export function finalRevelada(t: TournamentWire, ctx: ContextoDeRevelacao): boolean {
  const gf = t.series.find((s) => s.slotId === "GF");
  return gf === undefined || serieRevelada(gf, ctx);
}

/**
 * O que cada rodada disputa -- a composicao e fixa (ONDA_DO_SLOT). "Rodada" e
 * a palavra da onda na tela (D8); por isso as etapas da chave inferior viram
 * "fases" e nunca "Rodada 1/2", que colidiria com "Rodada 2 de 6".
 */
const ROTULO_DA_RODADA: Record<number, string> = {
  1: "Quartas de final da chave superior",
  2: "Semifinais da chave superior e 1ª fase da chave inferior",
  3: "Final da chave superior e 2ª fase da chave inferior",
  4: "Semifinal da chave inferior",
  5: "Final da chave inferior",
  6: "Grande Final",
};

export function rotuloDaRodada(onda: number): string | null {
  return ROTULO_DA_RODADA[onda] ?? null;
}

/**
 * Situacao do meu time numa frase, respeitando a revelacao: "chave superior",
 * "chave inferior", "eliminado", "campeão". Enquanto a serie da rodada atual
 * nao foi vista, mostra a situacao de ANTES dela.
 */
export function situacaoDoTime(time: TournamentTeamWire, t: TournamentWire, ctx: ContextoDeRevelacao): string {
  const reveladas = t.series.filter(
    (s) => (s.teamAId === time.id || s.teamBId === time.id) && s.winnerId !== null && serieRevelada(s, ctx)
  );
  if (reveladas.some((s) => s.slotId === "GF" && s.winnerId === time.id)) return "campeão";
  if (eliminadoVisivel(time, t, ctx)) return "eliminado";
  const perdeuAlguma = reveladas.some((s) => s.winnerId !== time.id);
  return perdeuAlguma ? "na chave inferior" : "na chave superior";
}
