/**
 * src/playback/types.ts
 *
 * PlaybackState type for tracking the current position during match replay.
 * Re-exports MatchResult and GameEvent from sim/types so playback components
 * import from one place (PATTERNS.md "src/playback/types.ts").
 */

import type { MatchResult, GameEvent } from "../sim/types";

// ---------------------------------------------------------------------------
// PlaybackState — tracks the current position in the match replay
// ---------------------------------------------------------------------------

export type PlaybackState = {
  /** Index of the most recently reached event (-1 = none reached yet) */
  currentEventIndex: number;
  /** Current playback clock position in ms (advances with rAF loop) */
  currentPlaybackMs: number;
  /** True after the final GG event has been reached and timer completed */
  isComplete: boolean;
};

// Re-export sim types — components import from this single location
export type { MatchResult, GameEvent };
