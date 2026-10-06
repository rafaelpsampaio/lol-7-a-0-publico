/**
 * src/sim/quits.ts
 *
 * O `quits` (spec 2026-10-05-traits-no-motor, 3.6): numa morte dele, com partida ruim E momento
 * ruim, um sorteio no fim do tick decide se ele sai da partida. Fora, nao renasce, nao farma e
 * ganha so o ouro passivo do LoL (engine.ts, passiveIncome). Metade das vezes volta depois de 2 a
 * 5 minutos, pelo processRespawns de sempre.
 *
 * T-02: so quem tem a trait carrega `quitTrack`; sem pendente, nenhum sorteio.
 * Puro: sem Math.random e sem I/O. Quem cria os eventos e o engine.ts (makeQuitEvent).
 */

import type { MatchState, PlayerState, Side } from "./matchState";
import { ROLES, teamOf } from "./matchState";
import { TRAIT_TUNING } from "./traitEffects";

/** Abate dele: a sequencia de mortes recomeca. */
export function noteKillForQuits(killer: PlayerState): void {
  if (killer.quitTrack !== undefined) killer.quitTrack.deathsSinceKillSec = [];
}

/** Morte dele (chamar com `deaths` ja somado): registra e marca o sorteio se as condicoes batem. */
export function noteDeathForQuits(state: MatchState, victim: PlayerState): void {
  const q = victim.quitTrack;
  if (q === undefined || q.used) return;
  q.deathsSinceKillSec.push(state.gameTimeSec);
  if (quitEligible(state, victim)) q.pending = true;
}

/**
 * Partida ruim (mortes >= quitMinDeaths e >= quitDeathRatio x (abates + assistencias)) E momento
 * ruim (quitStreakDeaths mortes nos ultimos quitStreakWindowSec, sem abate dele no meio).
 */
export function quitEligible(state: MatchState, p: PlayerState): boolean {
  const q = p.quitTrack;
  if (q === undefined || q.used) return false;
  const t = TRAIT_TUNING;
  const badGame = p.deaths >= t.quitMinDeaths && p.deaths >= t.quitDeathRatio * (p.kills + p.assists);
  const recent = q.deathsSinceKillSec.filter((s) => s > state.gameTimeSec - t.quitStreakWindowSec).length;
  return badGame && recent >= t.quitStreakDeaths;
}

export interface QuitOutcome {
  side: Side;
  player: PlayerState;
  returnsAtSec: number | null;
}

/**
 * Fim do tick: sorteia o quit de quem ficou pendente (ordem user, rival e ROLES). Sorteios:
 * quitChance; se quita, quitReturnChance; se volta, o atraso entre quitReturnMinSec e
 * quitReturnMaxSec. Sem pendente, nenhum sorteio (T-02).
 */
export function rollPendingQuits(state: MatchState, rng: () => number): QuitOutcome[] {
  const t = TRAIT_TUNING;
  const out: QuitOutcome[] = [];
  for (const side of ["user", "rival"] as Side[]) {
    const team = teamOf(state, side);
    for (const role of ROLES) {
      const p = team.players[role];
      const q = p.quitTrack;
      if (q === undefined || !q.pending) continue;
      q.pending = false;
      if (rng() >= t.quitChance) continue;
      q.used = true;
      q.deathsSinceKillSec = [];
      const returns = rng() < t.quitReturnChance;
      const returnsAtSec = returns
        ? Math.round(state.gameTimeSec + t.quitReturnMinSec + rng() * (t.quitReturnMaxSec - t.quitReturnMinSec))
        : null;
      p.away = true;
      p.alive = false;
      p.respawnAtSec = returnsAtSec;
      out.push({ side, player: p, returnsAtSec });
    }
  }
  return out;
}
