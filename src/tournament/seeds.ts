/**
 * src/tournament/seeds.ts
 *
 * Deterministic seed derivation for the tournament layer.
 * All randomness flows through seedFromString (FNV-1a → 32-bit int).
 *
 * D-02: Random seeding via mulberry32/seedFromString; deterministic from top-level seed.
 * D-08: Stored game seed enables exact replay without re-simulation.
 *
 * IMPORTANT: Never call Math.random() in this module or any downstream sim code.
 */

import { seedFromString } from "../sim/rng";
import type { SlotId } from "./schema";

/**
 * Creates the top-level tournament seed from the current timestamp.
 * Stored in TournamentState.seed and used to derive all downstream seeds.
 *
 * Returns a non-negative 32-bit integer.
 */
export function makeTournamentSeed(): number {
  return seedFromString(`tournament-${Date.now()}`);
}

/**
 * Derives a deterministic seed for a specific bracket series.
 *
 * @param tournamentSeed - Top-level seed from TournamentState.seed
 * @param slotId - The bracket slot identifier (e.g. "UB_QF_1")
 * @returns A non-negative 32-bit integer seed for this series
 */
export function seriesSeed(tournamentSeed: number, slotId: SlotId): number {
  return seedFromString(`${tournamentSeed}-series-${slotId}`);
}

/**
 * Derives a deterministic seed for a specific game within a series.
 * Stored in StoredGame.seed for replay (D-08, D-13).
 *
 * @param tournamentSeed - Top-level seed from TournamentState.seed
 * @param slotId - The bracket slot identifier
 * @param gameIndex - Zero-based index of the game within the series (0 = game 1)
 * @returns A non-negative 32-bit integer seed for this game
 */
export function gameSeed(
  tournamentSeed: number,
  slotId: SlotId,
  gameIndex: number
): number {
  return seedFromString(`${tournamentSeed}-series-${slotId}-game-${gameIndex}`);
}
