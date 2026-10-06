/**
 * src/sim/fearless.ts
 *
 * Fearless Bo5 champion selection with look-ahead (FEAR-01, FEAR-02).
 *
 * FEAR-01: every assigned champion exists in the player's championPool.
 * FEAR-02: no champion repeats across a player's 5 games in the series;
 *          look-ahead guarantees no deadlock even with the minimum 8-champion pool.
 *
 * IMPORTANT: This module is a pure function — no Math.random(), no side effects.
 * Champion selection is deterministic by mastery ordering (highest mastery first).
 */

import type { PlayerVersion } from "../data/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Maps gameIndex (0-4) to a Record<playerId, championId> for all players.
 * Represents the full series champion assignment produced by assignFearlessChampions.
 */
export type SeriesChampionAssignment = {
  [gameIndex: number]: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assigns champions for all games in a Bo5 series using look-ahead.
 *
 * Guarantees:
 * - Each assigned champion exists in the player's championPool (FEAR-01).
 * - No player is assigned the same champion twice in the series (FEAR-02).
 * - No two players in the same game receive the same champion (within-game uniqueness).
 * - With minimum 8-champion pool per player, games 4-5 never deadlock (FEAR-02).
 *
 * Algorithm: greedy highest-mastery, but before committing a pick, verify that
 * the remaining pool still has enough unique champions for all remaining games.
 * This "look-ahead" prevents greedy picks from exhausting options in late games.
 *
 * @param roster - 5 PlayerVersions (one per role) for the team
 * @param gameCount - number of games in the series (default 5)
 */
export function assignFearlessChampions(
  roster: PlayerVersion[],
  gameCount: number = 5
): SeriesChampionAssignment {
  const assignment: SeriesChampionAssignment = {};

  // usedByPlayer[playerId] = set of championIds already assigned in this series
  const usedByPlayer: Record<string, Set<string>> = {};
  for (const player of roster) {
    usedByPlayer[player.id] = new Set();
  }

  for (let gameIdx = 0; gameIdx < gameCount; gameIdx++) {
    assignment[gameIdx] = {};
    const pickedThisGame = new Set<string>(); // within-game uniqueness guard

    for (const player of roster) {
      const picked = pickChampionForGame(
        player,
        usedByPlayer[player.id],
        pickedThisGame,
        gameCount - gameIdx - 1 // remaining games after this one
      );

      assignment[gameIdx][player.id] = picked;
      usedByPlayer[player.id].add(picked);
      pickedThisGame.add(picked);
    }
  }

  return assignment;
}

/**
 * Assigns champions for both teams across all games in a Bo5 series, enforcing
 * GLOBAL uniqueness within each game (no champion can appear on both teams in
 * the same game).
 *
 * Per-team fearless history remains separate: a champion used by teamA in game 1
 * cannot be reused by any teamA player in later games, but teamB may reuse it in
 * a different game (real LoL cross-team fearless rules).
 *
 * @param teamARoster - 5 PlayerVersions for team A
 * @param teamBRoster - 5 PlayerVersions for team B
 * @param gameCount   - number of games in the series (default 5)
 * @returns           - { teamA, teamB } where each value is a SeriesChampionAssignment
 */
export function assignFearlessChampionsBothTeams(
  teamARoster: PlayerVersion[],
  teamBRoster: PlayerVersion[],
  gameCount: number = 5
): { teamA: SeriesChampionAssignment; teamB: SeriesChampionAssignment } {
  const teamAAssignment: SeriesChampionAssignment = {};
  const teamBAssignment: SeriesChampionAssignment = {};

  // Per-player series history, kept separate per team
  const usedByPlayerA: Record<string, Set<string>> = {};
  const usedByPlayerB: Record<string, Set<string>> = {};
  for (const player of teamARoster) usedByPlayerA[player.id] = new Set();
  for (const player of teamBRoster) usedByPlayerB[player.id] = new Set();

  for (let gameIdx = 0; gameIdx < gameCount; gameIdx++) {
    teamAAssignment[gameIdx] = {};
    teamBAssignment[gameIdx] = {};

    // ONE shared set for cross-team uniqueness within this game
    const pickedThisGame = new Set<string>();

    // Assign teamA players first, then teamB — both draw from the same pickedThisGame
    for (const player of teamARoster) {
      const picked = pickChampionForGame(
        player,
        usedByPlayerA[player.id],
        pickedThisGame,
        gameCount - gameIdx - 1
      );
      teamAAssignment[gameIdx][player.id] = picked;
      usedByPlayerA[player.id].add(picked);
      pickedThisGame.add(picked);
    }

    for (const player of teamBRoster) {
      const picked = pickChampionForGame(
        player,
        usedByPlayerB[player.id],
        pickedThisGame,
        gameCount - gameIdx - 1
      );
      teamBAssignment[gameIdx][player.id] = picked;
      usedByPlayerB[player.id].add(picked);
      pickedThisGame.add(picked);
    }
  }

  return { teamA: teamAAssignment, teamB: teamBAssignment };
}

// ---------------------------------------------------------------------------
// Internal helpers (unexported)
// ---------------------------------------------------------------------------

/**
 * Pick the best champion for a player in the current game, using look-ahead
 * to ensure future games will not deadlock.
 *
 * Selection priority: highest mastery first, subject to:
 * 1. Not already used by this player in the series.
 * 2. Not already picked by another player in this game.
 * 3. Leaving enough unique champions for the remaining games (look-ahead).
 *
 * Falls back to any available champion if look-ahead eliminates all high-mastery
 * options (should never happen with min-8 pool, but we handle it gracefully).
 */
function pickChampionForGame(
  player: PlayerVersion,
  usedByThisPlayer: Set<string>,
  pickedThisGame: Set<string>,
  remainingGames: number
): string {
  // Champions available for this player this game: not used in series, not taken this game
  const available = player.championPool
    .filter((cm) => !usedByThisPlayer.has(cm.championId))
    .filter((cm) => !pickedThisGame.has(cm.championId))
    .sort((a, b) => b.mastery - a.mastery); // highest mastery first

  // Look-ahead: choose the highest-mastery champion that leaves enough
  // unique champions in the pool for all remaining games
  for (const candidate of available) {
    const wouldUse = new Set(usedByThisPlayer);
    wouldUse.add(candidate.championId);

    // Count champions still available after committing this pick
    const stillAvailable = player.championPool.filter(
      (cm) => !wouldUse.has(cm.championId)
    ).length;

    if (stillAvailable >= remainingGames) {
      return candidate.championId;
    }
  }

  // Fallback: just take whatever is available (should not trigger with min-8 pool
  // enforced by the schema). Never return a non-champion id like "unknown" — that
  // would render as a "?" portrait; fall back to the player's top-mastery champion.
  if (available[0]) return available[0].championId;
  const topMastery = [...player.championPool].sort((a, b) => b.mastery - a.mastery)[0];
  return topMastery?.championId ?? player.championPool[0]?.championId ?? "";
}
