/**
 * src/playback/awards.ts
 *
 * Shared MVP / Bagre (worst player) scoring. Used by the per-game result overlay
 * (PlaybackScreen) and the per-series highlights (SeriesResultScreen) so both
 * rank players the same way.
 *
 * The score is a MIX (not pure KDA): combat KDA + gold (economic carry) +
 * objective participation (a share of the team's objective value, weighted by the
 * player's fight involvement) + a soft winner/loser bias so the MVP leans toward
 * the winning side and the Bagre toward the losing side, as in real broadcasts.
 */

export interface AwardLine {
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
}

export interface TeamAwardContext {
  /** Aggregate objective value of this player's team (see objectiveValue). */
  teamObjValue: number;
  /** Sum of (kills + assists) across this player's team — for participation share. */
  teamKA: number;
  /** Whether this player's team won the game/series. */
  onWinningTeam: boolean;
}

/** Objective value of a team's epics for a game (or summed across a series). */
export function objectiveValue(dragons: number, towers: number, barons: number): number {
  return dragons * 1.5 + towers * 0.35 + barons * 2;
}

/** Combined MVP/Bagre score for a single player. Higher = better. */
export function awardScore(p: AwardLine, ctx: TeamAwardContext): number {
  const combat = p.kills * 3 + p.assists * 1.5 - p.deaths * 2;
  const economy = p.gold / 1200;
  const participation = ctx.teamKA > 0 ? (p.kills + p.assists) / ctx.teamKA : 0;
  const objectives = ctx.teamObjValue * participation;
  const bias = ctx.onWinningTeam ? 2.5 : -2.5;
  return combat + economy + objectives + bias;
}
