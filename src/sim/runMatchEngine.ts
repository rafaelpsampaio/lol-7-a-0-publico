import { gameForm } from "./gameForm";
/**
 * src/sim/runMatchEngine.ts
 *
 * Phase 6 — bridge between the state-driven engine (engine.ts → SimEvent[]) and
 * the persisted/playback contract (MatchResult / GameEvent in sim/types.ts).
 *
 * This is the function the live game path (tournament/series.ts) calls instead
 * of the legacy runMatch. It is a drop-in: same MatchInput + seed in, same
 * MatchResult out — but the timeline is now rich and protagonist-aware.
 *
 * Determinism: all randomness flows through the seeded rng built from `seed`.
 */

import { mulberry32 } from "./rng";
import { simulateMatch } from "./engine";
import { withoutNewTraits } from "./traitEffects";
import { DEFAULT_SIM_CONFIG } from "./matchState";
import { SPEED_PRESET_MS } from "./runMatch";
import type { MatchInput, MatchResult, GameEvent } from "./types";
import type { SimEvent } from "./simEvents";

/**
 * Run one match through the state-driven engine and return a MatchResult whose
 * `events` are GameEvents carrying the rich ticker/actor fields.
 */
export function runMatchEngine(input: MatchInput, seed: number): MatchResult {
  const rng = mulberry32(seed);

  const config = {
    ...DEFAULT_SIM_CONFIG,
    comebackElasticity: input.chaosLevel ?? DEFAULT_SIM_CONFIG.comebackElasticity,
  };

  const userRoster = input.formVersion === 1 ? gameForm(input.userRoster, seed, input.chaosLevel ?? 0.25) : input.userRoster;
  const rivalRoster = input.formVersion === 1 ? gameForm(input.rivalRoster, seed, input.chaosLevel ?? 0.25) : input.rivalRoster;
  // Spec traits no motor (5): com a chave desligada, ninguem tem as traits novas nesta partida.
  const strip = (roster: typeof userRoster) => (input.newTraitEffects === false ? withoutNewTraits(roster) : roster);
  const sim = simulateMatch(strip(userRoster), strip(rivalRoster), rng, config, {
    userCaptainPersonId: input.userCaptainPersonId,
    rivalCaptainPersonId: input.rivalCaptainPersonId,
    userChampions: input.userChampions,
    rivalChampions: input.rivalChampions,
  });

  // Playback duration is a UI choice driven by the speed preset; the in-game
  // clock comes from the engine's own timeline.
  const totalPlaybackMs = SPEED_PRESET_MS[input.speedPreset];
  const finalGameSec = Math.max(1, sim.timeline[sim.timeline.length - 1]?.timeSec ?? sim.durationSec);

  const events: GameEvent[] = sim.timeline.map((ev) =>
    toGameEvent(ev, totalPlaybackMs, finalGameSec)
  );

  return {
    winner: sim.winner,
    events,
    totalPlaybackMs,
  };
}

/** Map a rich SimEvent onto the persisted GameEvent contract. */
function toGameEvent(
  ev: SimEvent,
  totalPlaybackMs: number,
  finalGameSec: number
): GameEvent {
  // Distribute playback position proportionally to in-game time so the speed
  // presets and the existing GameTimer rAF loop keep working unchanged.
  const playbackMs = Math.min(
    totalPlaybackMs,
    Math.round((ev.timeSec / finalGameSec) * totalPlaybackMs)
  );

  const team: "user" | "rival" =
    ev.side ?? (ev.winProbUserAfter >= 0.5 ? "user" : "rival");

  return {
    gameTimeMs: ev.timeSec * 1000,
    playbackMs,
    type: ev.kind,
    team,
    winProbAfter: ev.winProbUserAfter,
    ticker: ev.ticker,
    actors: ev.actors.length > 0 ? ev.actors : undefined,
    victims: ev.victims.length > 0 ? ev.victims : undefined,
    lane: ev.lane ?? undefined,
    objectiveKind: ev.objectiveKind ?? undefined,
    contested: ev.contested || undefined,
    stolen: ev.stolen || undefined,
    score: ev.score,
    map: ev.map,
  };
}
