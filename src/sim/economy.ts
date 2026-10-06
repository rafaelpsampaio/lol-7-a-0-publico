/**
 * src/sim/economy.ts
 *
 * Economia em ouro real (spec 2026-10-02-luta-mapa-vitoria, secao 3). Substitui o
 * multiplicador goldScale: todo valor aqui e ouro do jogo de verdade, conferido na wiki
 * oficial (torre, assistencia) e no patch 14.21 (bounty baseado em ouro).
 *
 * Duas regras que valem para o motor inteiro:
 *   1. ouro do time = soma do ouro dos jogadores. Todo credito passa por creditPlayer ou
 *      creditTeamSplit, que mexem nos dois juntos.
 *   2. nenhuma funcao aqui consome sorteio nem le o relogio: tudo e funcao pura de entrada.
 *
 * Este modulo so importa TIPOS de matchState, para nao criar ciclo de valor com ele
 * (matchState importa STARTING_GOLD_PER_PLAYER daqui).
 */

import type { Role } from "../data/schema";
import type { Lane } from "./matchState";
import { CHAOS_REFERENCE, type RealismTuning } from "./tuning";

export const STARTING_GOLD_PER_PLAYER = 500;
export const KILL_GOLD = 300;
export const FIRST_BLOOD_GOLD = 400;
/** Piso do valor de um abate: KILL_GOLD mais o bounty negativo minimo (-200). */
export const MIN_KILL_GOLD = 100;
/** Assistencias dividem metade do ouro do abate. */
export const ASSIST_SHARE = 0.5;
export const FIRST_TURRET_BONUS = 300;
/** Patch 26: cada placa vale 120 ate 11:00 e perde 10 por minuto completo depois, ate 80 (15:00). */
export const PLATE_BASE_GOLD = 120;
export const PLATE_MIN_GOLD = 80;

export function plateGold(gameTimeSec: number): number {
  const minutesAfter11 = Math.max(0, Math.floor((gameTimeSec - 660) / 60));
  return Math.max(PLATE_MIN_GOLD, PLATE_BASE_GOLD - 10 * minutesAfter11);
}
/** Patch 26: ouro global do Barao e do Anciao, para cada jogador do time (vivo ou morto). */
export const EPIC_GOLD_PER_PLAYER = 150;
/** Patch 26: ouro de quem confirma o Barao ou o Anciao. */
export const EPIC_SECURE_GOLD = 100;
/** Patch 26: ouro de quem confirma o dragao elemental. */
export const DRAGON_SECURE_GOLD = 75;
/** Patch 26: ouro de cada larva do Vazio, para quem confirma. */
export const GRUB_GOLD = 30;
/** Patch 26: ouro de quem confirma o Arauto. */
export const HERALD_SECURE_GOLD = 100;

export type StructureTier = "outer" | "inner" | "inhibTurret" | "nexusTurret" | "inhibitor";

/** Patch 26: torres de rota nao pagam ao cair (o ouro delas vem nas 5 placas). */
export const TOWER_GOLD: Record<StructureTier, number> = {
  outer: 0,
  inner: 0,
  inhibTurret: 0,
  nexusTurret: 50,
  inhibitor: 50,
};

/** Bounty: 1 a cada 4 de ouro ganho em abate e assistencia; 1 a cada 4 entregue ao morrer. */
const BOUNTY_PER_GOLD = 0.25;
const BOUNTY_FLOOR = -200;
/** Shutdown paga no maximo isto; o excedente fica para a proxima vida (patch 14.21). */
export const BOUNTY_PAYOUT_CAP = 700;
/** Abaixo disto o abate nao e anunciado como shutdown. */
export const SHUTDOWN_MIN_BOUNTY = 150;

/** Fatia de farm por rota. Mesmos multiplicadores que power.ts usava no ouro esperado. */
export const PASSIVE_ROLE_SHARE: Record<Role, number> = {
  adc: 1.12,
  mid: 1.06,
  top: 1.0,
  jungle: 0.88,
  support: 0.6,
};

/** Rota cujo lead pesa no farm de cada funcao; o jungler nao tem rota propria. */
export const PASSIVE_LANE_OF_ROLE: Record<Role, Lane | null> = {
  top: "top",
  jungle: null,
  mid: "mid",
  adc: "bot",
  support: "bot",
};

export interface GoldHolder {
  gold: number;
}

export interface BountyHolder {
  bounty: number;
  shutdownGold: number;
}

/** Divide `total` em `n` partes inteiras, as primeiras com 1 a mais quando sobra resto. */
export function splitEvenly(total: number, n: number): number[] {
  if (n <= 0) return [];
  const share = Math.floor(total / n);
  const rest = total - share * n;
  return Array.from({ length: n }, (_, i) => share + (i < rest ? 1 : 0));
}

export function creditPlayer(team: GoldHolder, p: GoldHolder, amount: number): void {
  p.gold += amount;
  team.gold += amount;
}

/** Ouro de time (torre, placa, recompensa de objetivo) dividido igualmente entre os cinco. */
export function creditTeamSplit(
  team: GoldHolder & { players: Record<Role, GoldHolder> },
  amount: number
): void {
  const players = Object.values(team.players);
  const shares = splitEvenly(amount, players.length);
  players.forEach((p, i) => creditPlayer(team, p, shares[i]));
}

function refreshShutdownGold(p: BountyHolder): void {
  p.shutdownGold = p.bounty >= SHUTDOWN_MIN_BOUNTY ? Math.min(BOUNTY_PAYOUT_CAP, p.bounty) : 0;
}

export function killGoldFor(victim: BountyHolder, isFirstBlood: boolean): number {
  const base = isFirstBlood ? FIRST_BLOOD_GOLD : KILL_GOLD;
  const bountyPart = victim.bounty > 0 ? Math.min(BOUNTY_PAYOUT_CAP, victim.bounty) : victim.bounty;
  return Math.max(MIN_KILL_GOLD, base + bountyPart);
}

export function earnBounty(p: BountyHolder, goldEarned: number): void {
  p.bounty += Math.round(goldEarned * BOUNTY_PER_GOLD);
  refreshShutdownGold(p);
}

export function settleVictimBounty(victim: BountyHolder, goldGivenAway: number): void {
  if (victim.bounty > 0) {
    victim.bounty = victim.bounty > BOUNTY_PAYOUT_CAP ? victim.bounty - BOUNTY_PAYOUT_CAP : 0;
  } else {
    victim.bounty = Math.max(BOUNTY_FLOOR, victim.bounty - Math.round(goldGivenAway * BOUNTY_PER_GOLD));
  }
  refreshShutdownGold(victim);
}

/** Multiplicador de farm pelo slice de laning (75 e neutro). */
export function laningFarmFactor(laningSlice: number): number {
  return 1 + (laningSlice - 75) / 250;
}

export function passiveGoldPerMinute(
  role: Role,
  minute: number,
  laningSlice: number,
  laneLead: number,
  tuning: RealismTuning
): number {
  const lead = Math.max(-60, Math.min(60, laneLead));
  return (
    (tuning.passiveBasePerMin + tuning.passiveSlopePerMin * minute) *
    PASSIVE_ROLE_SHARE[role] *
    laningFarmFactor(laningSlice) *
    (1 + lead / 600)
  );
}

/**
 * Ouro esperado de uma rota no minuto, so de farm (sem abates), para quem compara o ouro
 * de um jogador com o "normal" do minuto (microMetrics, effectiveGoldPower). E a integral
 * de passiveGoldPerMinute com lead zero, mais o ouro inicial.
 */
export function expectedPassiveGold(
  role: Role,
  minute: number,
  avgLaningSlice: number,
  tuning: RealismTuning
): number {
  const integral = tuning.passiveBasePerMin * minute + (tuning.passiveSlopePerMin * minute * minute) / 2;
  return Math.round(
    STARTING_GOLD_PER_PLAYER + integral * PASSIVE_ROLE_SHARE[role] * laningFarmFactor(avgLaningSlice)
  );
}

/**
 * Recompensa de objetivo (spec secao 3): o time atras no ouro alem do limiar ganha uma
 * fracao do deficit, com teto, quando conquista objetivo ou estrutura. O caos EFETIVO
 * (slider mais a volatilidade media dos jogadores, cerca de 0,017) escala o valor sobre
 * CHAOS_REFERENCE: no slider padrao a escala e cerca de 1,07 e no slider 0 sobra cerca de
 * 0,07, entao so um caos igual a 0 desliga de fato. Unico elastico de comeback do motor.
 */
export function objectiveBountyGold(
  teamGold: number,
  enemyGold: number,
  chaos: number,
  tuning: RealismTuning
): number {
  const deficit = enemyGold - teamGold;
  if (deficit < tuning.objectiveBountyMinDeficit) return 0;
  const base = Math.min(tuning.objectiveBountyCap, deficit * tuning.objectiveBountyFraction);
  return Math.round(base * (chaos / CHAOS_REFERENCE));
}
