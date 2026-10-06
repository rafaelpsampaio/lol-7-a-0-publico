/**
 * src/sim/conversion.ts
 *
 * Decisoes puras da janela de conversao (spec 2026-10-02-luta-mapa-vitoria, secao 4).
 * Depois de uma luta ou pick, o lado com mais gente viva (e pelo menos 3 vivos) converte a
 * vantagem: Barao ou Anciao, dragao, Arauto ou larvas, senao torre. O objetivo de jungle
 * continua disputavel pelo time em desvantagem, principalmente com o jungler vivo (Smite).
 *
 * Tudo aqui e rng-free. Quem sorteia e aplica e resolveConversion em engine.ts.
 */

import type { Lane, MatchState, Side } from "./matchState";
import { aliveCount, LANES, teamOf, opponent, hasBaronBuff, hasElderBuff } from "./matchState";
import type { Region } from "./simEvents";
import { isObjectiveAvailable, type ObjectiveKind } from "./objectives";
import type { RealismTuning } from "./tuning";
import { structureTimePlausibility, tierModifierFor, turretDamageFactor } from "./structures";
import { ACE_MIN_SEC } from "./combat";
import { placeLabel } from "./ticker";
import { PREP_ANNOUNCE_AT } from "./readiness";

/**
 * Regra dura: nenhuma torre cai antes de 7:00 (so placa e tower_low). A constante e a garantia
 * moram em structures.ts (holdPoolBeforeTowerWindow); aqui so reexporta, para ter um valor so.
 */
export { NO_TOWER_BEFORE_SEC } from "./structures";

export type ConversionTarget = ObjectiveKind | "push";

const OBJECTIVE_PRIORITY: readonly ObjectiveKind[] = ["baron", "elder", "dragon", "herald", "voidgrubs"];

/** Lado do mapa de cada poco de objetivo. */
const PIT_SIDE: Record<ObjectiveKind, "top" | "bot"> = {
  baron: "top",
  herald: "top",
  voidgrubs: "top",
  dragon: "bot",
  elder: "bot",
};

/** Lado do mapa de cada lugar de luta; mid alcanca os dois pocos, base nenhum. */
const PLACE_SIDE: Record<Lane | Region, "top" | "bot" | "mid" | null> = {
  top: "top",
  river_top: "top",
  top_jg: "top",
  mid: "mid",
  bot: "bot",
  river_bot: "bot",
  bot_jg: "bot",
  base: null,
};

/** Rota estrutural de cada lugar de luta (mesmo mapa que engine.placeToLane). */
const PLACE_LANE: Record<Lane | Region, Lane | null> = {
  top: "top",
  river_top: "top",
  top_jg: "top",
  mid: "mid",
  bot: "bot",
  river_bot: "bot",
  bot_jg: "bot",
  base: null,
};

export function numbersAdvantage(state: MatchState, side: Side): number {
  return aliveCount(teamOf(state, side)) - aliveCount(teamOf(state, opponent(side)));
}

/** Lado em janela agora: mais gente viva que o outro e pelo menos 3 vivos; senao null. */
export function conversionSide(state: MatchState): Side | null {
  for (const side of ["user", "rival"] as Side[]) {
    if (numbersAdvantage(state, side) >= 1 && aliveCount(teamOf(state, side)) >= 3) return side;
  }
  return null;
}

/**
 * Objetivo que a janela converte, na prioridade do LoL. Com 1 de vantagem so vale o poco do
 * lado do mapa onde a luta foi (ou qualquer um, se a luta foi no meio); Barao e Anciao exigem 2
 * a mais, ou 1 a mais com o jungler inimigo morto; com 2 ou mais, qualquer.
 * So vale objetivo que o lado ja comecou a preparar (preparo >= 50, emenda de 2026-10-02).
 */
export function conversionTarget(
  state: MatchState,
  side: Side,
  place: Lane | Region | null
): ConversionTarget {
  const adv = numbersAdvantage(state, side);
  const placeSide = place === null ? null : PLACE_SIDE[place];
  for (const kind of OBJECTIVE_PRIORITY) {
    if (!isObjectiveAvailable(state, kind)) continue;
    // Emenda da spec (2026-10-02): a janela so converte objetivo que o lado ja comecou a
    // preparar (preparo de pelo menos 50, o ponto do aviso); sem isso a vantagem vira pressao de torre.
    if (state.objectivePrep[side][kind] < PREP_ANNOUNCE_AT) continue;
    const onSide = placeSide === "mid" || placeSide === PIT_SIDE[kind];
    if (kind === "baron" || kind === "elder") {
      // Spec calendario secao 4: epico pela janela so com 2 a mais, ou 1 a mais com o jungler
      // inimigo morto (ninguem para dar Smite), no lado do poco.
      const enemyJunglerDead = !teamOf(state, opponent(side)).players.jungle.alive;
      if (adv >= 2 || (adv >= 1 && enemyJunglerDead && onSide)) return kind;
      continue;
    }
    if (adv >= 2 || onSide) return kind;
  }
  return "push";
}

/** Chance de o time em desvantagem contestar o objetivo da janela (regra da Smite). */
export function contestChance(
  kind: ObjectiveKind,
  adv: number,
  junglerAlive: boolean,
  tuning: RealismTuning
): number {
  const base =
    kind === "baron" || kind === "elder"
      ? tuning.contestBaseEpic
      : kind === "dragon"
        ? tuning.contestBaseDragon
        : tuning.contestBaseMinor;
  const byNumbers = adv <= 1 ? 1 : adv === 2 ? 0.5 : 0.2;
  const bySmite = junglerAlive ? 1 : 0.3;
  return base * byNumbers * bySmite;
}

/** Quanto a diferenca numerica corta a chance de roubo por Smite (1 em paridade). */
export function conversionStealFactor(adv: number): number {
  return Math.max(0.2, 1 - 0.3 * Math.max(0, adv));
}

function standingOnLane(state: MatchState, side: Side, lane: Lane): number {
  const s = teamOf(state, opponent(side)).structures[lane];
  return (s.outerAlive ? 1 : 0) + (s.innerAlive ? 1 : 0) + (s.inhibTurretAlive ? 1 : 0) + (s.inhibitorAlive ? 1 : 0);
}

/** A rota ainda tem o que bater: estrutura de pe, ou caminho aberto ate torres do Nexus de pe. */
function laneHasTarget(state: MatchState, side: Side, lane: Lane): boolean {
  if (standingOnLane(state, side, lane) > 0) return true;
  return teamOf(state, opponent(side)).nexusTurretsAlive > 0;
}

/**
 * Rota em que a janela empurra: a da luta, se ela ainda tem o que bater; senao a mais
 * avancada (menos estruturas de pe; rota aberta ate o Nexus conta 0), com desempate
 * deterministico na ordem de LANES. Sem nenhuma rota com alvo, a da luta ou mid.
 */
export function conversionLane(state: MatchState, side: Side, place: Lane | Region | null): Lane {
  const fromPlace = place === null ? null : PLACE_LANE[place];
  if (fromPlace !== null && laneHasTarget(state, side, fromPlace)) return fromPlace;
  let best: Lane | null = null;
  let bestStanding = Infinity;
  for (const lane of LANES) {
    if (!laneHasTarget(state, side, lane)) continue;
    const n = standingOnLane(state, side, lane);
    if (n < bestStanding) {
      best = lane;
      bestStanding = n;
    }
  }
  return best ?? fromPlace ?? "mid";
}

/** Dano de cerco por tick da janela num tier de torre (pool de 100). */
export function conversionSiegeDamage(
  state: MatchState,
  side: Side,
  tierType: "outer" | "inner" | "inhibTurret" | "nexusTurret",
  adv: number
): number {
  const buff = 1 + (hasBaronBuff(state, side) ? 0.5 : 0) + (hasElderBuff(state, side) ? 0.1 : 0);
  return (
    state.tuning.conversionSiegeBase *
    (1 + 0.5 * Math.max(0, adv - 1)) *
    structureTimePlausibility(tierType, state.gameTimeSec) *
    tierModifierFor(tierType) *
    buff *
    turretDamageFactor(state, tierType)
  );
}

const NUMBER_WORD = ["", "um", "dois", "três", "quatro", "cinco"];

/** Abertura do texto de um evento de conversao: a causa vem antes do fato. */
export function conversionLead(
  state: MatchState,
  side: Side,
  adv: number,
  place: Lane | Region | null
): string {
  // So fala em ACE quando o evento ace existe (antes de ACE_MIN_SEC ele e suprimido; vale o numerico).
  if (aliveCount(teamOf(state, opponent(side))) === 0 && state.gameTimeSec >= ACE_MIN_SEC) {
    return "Após o ACE, ";
  }
  const where = place === null ? "" : ` depois da luta ${placeLabel(place)}`;
  return `Com ${NUMBER_WORD[Math.min(5, Math.max(1, adv))]} a mais${where}, `;
}

/** Junta a abertura com o texto do evento, baixando a caixa so de artigo no comeco. */
export function prefixLead(lead: string, ticker: string): string {
  const body = /^(O|A|Os|As) /.test(ticker) ? ticker.charAt(0).toLowerCase() + ticker.slice(1) : ticker;
  return lead + body;
}
