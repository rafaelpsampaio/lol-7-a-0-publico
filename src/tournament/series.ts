/**
 * src/tournament/series.ts
 *
 * Pure Bo5 series orchestrator — no side effects, no LocalStorage, no Math.random().
 * All randomness flows through gameSeed → runMatch for determinism.
 *
 * BRKT-02: Bo5 series; advance at exactly 3 wins.
 * D-05: Loop runMatch per game.
 * D-06: Fearless per series only — resetted each new series; no repeats within a series.
 * D-08: StoredGame.seed enables deterministic replay.
 * D-12: StoredGame.champions carries per-game champion data for the result screen.
 *
 * IMPORTANT: Never call Math.random(). All randomness via gameSeed → runMatch.
 *
 * Exports:
 *   runSeriesGame       — run one game of a Bo5, returning a StoredGame
 *   seriesWinnerId      — check if a series has a winner (>= 3 wins)
 *   fearlessUsedAfter   — compute updated fearlessUsed after a game is appended
 */

import { assignFearlessChampionsBothTeams } from "../sim/fearless";
import { runMatchEngine } from "../sim/runMatchEngine";
import { gameSeed } from "./seeds";
import type { TournamentState, SlotId, StoredGame, SeriesState } from "./schema";
import type { ChampionEntry } from "../data/schema";

// ---------------------------------------------------------------------------
// runSeriesGame
// ---------------------------------------------------------------------------

/**
 * Run one game of a Bo5 series. Returns a StoredGame (caller persists it).
 *
 * The game index is derived from the current series.games.length so every game
 * in a series produces a unique, stable seed. Re-calling this function with the
 * same state + slotId is deterministic (SIM-01 / D-08).
 *
 * teamA is treated as the "user" frame in MatchResult.winner (Open Question 1):
 *   result.winner === "user"  → teamA wins  (teamA.id stored as winnerId)
 *   result.winner === "rival" → teamB wins  (teamB.id stored as winnerId)
 *
 * assignFearlessChampionsBothTeams is called once per game invocation with gameCount=5
 * so the full look-ahead table is available for any game index (D-06, Pitfall 1).
 * It is deterministic by mastery ordering, so calling it again for the same game
 * returns identical assignments. Both teams share a per-game taken-set so no
 * champion appears on both sides in the same game.
 *
 * @param state      Current tournament state (read-only)
 * @param slotId     The bracket slot to play
 * @param chaosLevel Comeback intensity [0,1] threaded from App.tsx chaosLevelSignal
 * @param catalogue  Merged champion catalogue from App.tsx (may be empty)
 */
export function runSeriesGame(
  state: TournamentState,
  slotId: SlotId,
  chaosLevel: number,
  catalogue: ChampionEntry[],
  formVersion: 0 | 1 = 1,
  newTraitEffects = true
): StoredGame {
  const slot = state.slots[slotId];
  if (!slot) {
    throw new Error(`runSeriesGame: slot ${slotId} not found in state`);
  }

  const series = slot.series;
  const gameIndex = series.games.length;
  const seed = gameSeed(state.seed, slotId, gameIndex);

  const teamAId = series.teamAId;
  const teamBId = series.teamBId;
  if (!teamAId || !teamBId) {
    throw new Error(`runSeriesGame: slot ${slotId} has unresolved team IDs (teamA=${teamAId}, teamB=${teamBId})`);
  }

  const teamA = state.teams[teamAId];
  const teamB = state.teams[teamBId];
  if (!teamA || !teamB) {
    throw new Error(`runSeriesGame: team not found in state (teamA=${teamAId}, teamB=${teamBId})`);
  }

  // assignFearlessChampionsBothTeams assigns both rosters together so the shared
  // pickedThisGame set prevents any champion from appearing on both teams in the
  // same game. Deterministic by mastery order — safe to re-derive on resume (D-06).
  const { teamA: teamAAssignment, teamB: teamBAssignment } =
    assignFearlessChampionsBothTeams(teamA.roster, teamB.roster, 5);

  // Slice the gameIndex row from the full assignment table (kept keyed by bracket
  // identity teamA/teamB so StoredGame.champions stays stable for the result screen).
  const teamAChampions: Record<string, string> = teamAAssignment[gameIndex] ?? {};
  const teamBChampions: Record<string, string> = teamBAssignment[gameIndex] ?? {};

  // Frame the HUMAN team as blue/"user" whenever it plays, so it never watches its
  // own series from the enemy's perspective. Bot-vs-bot games keep teamA as blue.
  const userFrameTeamId = teamBId === state.userTeamId ? teamBId : teamAId;
  const aIsUserFrame = userFrameTeamId === teamAId;

  const userTeam = aIsUserFrame ? teamA : teamB;
  const rivalTeam = aIsUserFrame ? teamB : teamA;
  const userChampions = aIsUserFrame ? teamAChampions : teamBChampions;
  const rivalChampions = aIsUserFrame ? teamBChampions : teamAChampions;

  // Run the state-driven engine (SIM-01 — deterministic for given seed).
  const result = runMatchEngine(
    {
      userRoster: userTeam.roster,
      rivalRoster: rivalTeam.roster,
      userChampions,
      rivalChampions,
      speedPreset: "fast",
      formVersion: formVersion === 1 ? 1 : undefined,
      ...(newTraitEffects ? {} : { newTraitEffects: false as const }),
      chaosLevel,
      championCatalogue: catalogue,
      // CAPTAIN: pass each framed team's designated shotcaller (personId) so the
      // engine grants its small living-captain coordination edge. Bots leave it
      // undefined (no captain).
      userCaptainPersonId: userTeam.captainPersonId,
      rivalCaptainPersonId: rivalTeam.captainPersonId,
    },
    seed
  );

  // result.winner is in FRAME terms; map back to the bracket teamId.
  const rivalFrameTeamId = aIsUserFrame ? teamBId : teamAId;
  const winnerId = result.winner === "user" ? userFrameTeamId : rivalFrameTeamId;

  return {
    ...(formVersion === 1 ? { formVersion: 1 as const } : {}),
    ...(newTraitEffects ? {} : { newTraitEffects: false as const }),
    seed,
    winnerId,
    userFrameTeamId,
    events: result.events,
    totalPlaybackMs: result.totalPlaybackMs,
    // Persisted so a replay can re-simulate the EXACT timeline after the events
    // array is stripped from the LocalStorage projection (see tournament/storage.ts).
    chaosLevel,
    champions: {
      teamA: teamAChampions,
      teamB: teamBChampions,
    },
  };
}

// ---------------------------------------------------------------------------
// seriesWinnerId
// ---------------------------------------------------------------------------

/**
 * Returns the teamId of the first team with >= 3 wins, or null if no team has
 * reached 3 wins yet. Bo5 advance-at-3 (BRKT-02, D-05).
 *
 * @param series  The current SeriesState (series.wins map)
 */
export function seriesWinnerId(series: SeriesState): string | null {
  for (const [teamId, wins] of Object.entries(series.wins)) {
    if (wins >= 3) return teamId;
  }
  return null;
}

// ---------------------------------------------------------------------------
// fearlessUsedAfter
// ---------------------------------------------------------------------------

/**
 * Compute the updated fearlessUsed record after a game is appended to the series.
 *
 * Reads champion assignments from the stored game's champions.teamA and
 * champions.teamB, and appends each player's champion to the fearlessUsed map.
 * Deduplicates — a champion already in the list is not appended again.
 *
 * Returns a NEW object (no mutation). D-06: fearlessUsed accumulates within the
 * Bo5 so mid-series resume restores the full fearless history (BRKT-05 / D-13).
 *
 * @param series     The series state BEFORE appending the game
 * @param storedGame The just-played game whose champion assignments to record
 */
export function fearlessUsedAfter(
  series: SeriesState,
  storedGame: StoredGame
): Record<string, string[]> {
  const updated: Record<string, string[]> = { ...series.fearlessUsed };

  // Merge teamA and teamB champion assignments
  const allChampions: Record<string, string> = {
    ...storedGame.champions.teamA,
    ...storedGame.champions.teamB,
  };

  for (const [playerId, championId] of Object.entries(allChampions)) {
    const current = updated[playerId] ?? [];
    if (!current.includes(championId)) {
      updated[playerId] = [...current, championId];
    }
  }

  return updated;
}
