/**
 * src/playback/GameTimer.tsx
 *
 * LoL-style game timer with a requestAnimationFrame loop (PLAY-01, PLAY-05).
 *
 * Design decisions applied:
 *   D-12: smooth continuous tick with a momentary slow-down on each event reached
 *   UI-SPEC: timer in accent color, Display size (28px), MM:SS format
 *   UI-SPEC Animation Budget: pulse 1.0 → 1.05 → 1.0 over 300ms on event slow-down
 *   Pitfall 2: cancelAnimationFrame called in onCleanup to prevent runaway loop (T-04-07)
 *   Threat T-02-07: onComplete guarded against multiple fires
 *   PLAY-05: reactive speed multiplier (1x/2x) + skip-to-end command preserving in-order
 *            fire-once event sequence (T-04-08)
 *
 * SolidJS conventions: class= (not className); signals called as functions.
 *
 * Test surface: `createTimerDriver` is exported so unit tests can drive the tick
 * loop with synthetic timestamps without mounting the component.
 */

import { createSignal, onCleanup } from "solid-js";
import type { GameEvent } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** Pre-computed event timeline from runMatch */
  events: GameEvent[];
  /** Total real-world playback duration in ms (from MatchResult.totalPlaybackMs) */
  totalPlaybackMs: number;
  /** Called each time a GameEvent's playbackMs is reached */
  onEventReached: (event: GameEvent, index: number) => void;
  /** Called once when the timer reaches totalPlaybackMs */
  onComplete: () => void;
  /**
   * PLAY-05: reactive speed multiplier.
   * An accessor returning 1 or 2 — read on each tick so the change takes effect
   * immediately on the next frame without resetting playbackMs or re-firing past events.
   */
  speed?: () => 1 | 2;
  /**
   * PLAY-05: skip-to-end signal.
   * A monotonically increasing counter; whenever its value is greater than when the
   * driver last checked, the timer fast-forwards to totalPlaybackMs, firing all pending
   * events in ascending index order, then calls onComplete once.
   * Modelled as a counter so the parent can increment to request skip.
   */
  skipSignal?: () => number;
  paused?: () => boolean;
}

// ---------------------------------------------------------------------------
// createTimerDriver — exported stateful core (used by component and tests)
// ---------------------------------------------------------------------------

/**
 * Configuration for createTimerDriver (mirrors Props minus JSX render surface).
 * Exposed so GameTimer.test.tsx can drive the loop with synthetic timestamps.
 */
export interface TimerDriverConfig {
  /**
   * Reactive events accessor — read on each tick so a new match's timeline is
   * picked up if the driver outlives a `result` swap (WR-01). In SolidJS props
   * are reactive getters; snapshotting them eagerly would freeze the previous
   * game's timeline.
   */
  events: () => GameEvent[];
  /** Reactive total-playback-duration accessor — read on each tick (WR-01). */
  totalPlaybackMs: () => number;
  /** Reactive speed accessor — read on each tick */
  speed: () => 1 | 2;
  /** Monotonic skip counter — driver acts when this increases */
  skipSignal: () => number;
  paused?: () => boolean;
  onEventReached: (event: GameEvent, index: number) => void;
  onComplete: () => void;
}

/**
 * TimerDriver — call `tick(timestamp)` to advance the simulation.
 * Mirrors the requestAnimationFrame callback signature.
 */
export interface TimerDriver {
  tick: (timestamp: number) => void;
  /** Returns the current internal playback position (ms) */
  getPlaybackMs: () => number;
  /** True once onComplete has been fired */
  isDone: () => boolean;
}

// Cinematic pacing constants.
// SLOW_FACTOR=2 → playback advances at HALF speed during a big-moment beat (was 4,
// i.e. quarter-speed-of-perceived but the beat was too short to register). Combined
// with a longer hold below this makes barons / aces / pentas / elders visibly linger.
const SLOW_FACTOR = 2;
/**
 * How long to hold the slow-mo beat after a BIG event, in ms of REAL time.
 * Raised from 900 → 1600 so the dramatic moment is clearly felt (~0.8s of game time
 * stretched over 1.6s of wall time) without dragging the whole match.
 */
const BIG_SLOW_MS = 1600;
/** Fraction of total playback used as the "ease-in" window before each event. */
const DWELL_FRACTION = 0.05;
/** Max fast-forward multiplier for long quiet stretches. */
const WARP_MAX = 10;

/** Event types worth holding a beat on (the rest fly by at warped speed). */
const BIG_EVENT_TYPES = new Set<GameEvent["type"]>([
  "first_blood", "ace", "penta_kill", "quadra_kill", "triple_kill",
  "baron_taken", "baron_steal", "elder_taken", "elder_steal", "dragon_steal",
  "nexus_exposed", "inhibitor_destroyed", "gg",
]);

/**
 * createTimerDriver — the entire timer simulation logic, decoupled from the
 * SolidJS component lifecycle so it can be unit-tested with synthetic timestamps.
 *
 * Invariants maintained:
 *   - nextEventIndex only ever increases (fire-once, monotonic — T-04-08)
 *   - completeFired ensures onComplete fires at most once (T-02-07 / T-04-07)
 *   - skip fast-forwards playbackMs to totalPlaybackMs then runs the SAME event-firing
 *     loop — events are never teleported past without firing (T-04-08)
 *   - The loop halts after skip completes (cancelAnimationFrame is the caller's job)
 */
export function createTimerDriver(config: TimerDriverConfig): TimerDriver {
  let playbackMs = 0;
  let nextEventIndex = 0;
  let slowDownRemaining = 0;
  let prevTimestamp: number | null = null;
  let completeFired = false;
  // Snapshot the skip counter at creation time so the first call is baseline
  let lastSeenSkipSignal = config.skipSignal();

  /** Fire all pending events whose playbackMs <= currentPlaybackMs, in index order. */
  function fireEventsBelowOrAt(currentMs: number): void {
    const events = config.events();
    while (
      nextEventIndex < events.length &&
      currentMs >= events[nextEventIndex].playbackMs
    ) {
      const event = events[nextEventIndex];
      config.onEventReached(event, nextEventIndex);
      nextEventIndex++;
    }
  }

  /**
   * Drain ALL remaining events in index order, regardless of their playbackMs.
   * Used on terminal completion and on skip so an event whose playbackMs exceeds
   * totalPlaybackMs (e.g. a terminal `gg` event after a rounding skew in the
   * duration math) is still fired exactly once and never teleported past
   * unfired (T-04-08). The playbackMs clamp can never satisfy
   * `currentMs >= event.playbackMs` for such an event, so fireEventsBelowOrAt
   * alone would silently drop it.
   */
  function drainAll(): void {
    const events = config.events();
    while (nextEventIndex < events.length) {
      const event = events[nextEventIndex];
      config.onEventReached(event, nextEventIndex);
      nextEventIndex++;
    }
  }

  function tick(timestamp: number): void {
    // Guard: once complete, the tick is a no-op (handles post-complete calls)
    if (completeFired) return;

    // -------------------------------------------------------------------
    // Skip-to-end detection (PLAY-05 / T-04-08)
    // -------------------------------------------------------------------
    const currentSkip = config.skipSignal();
    if (currentSkip > lastSeenSkipSignal) {
      lastSeenSkipSignal = currentSkip;
      // Fast-forward: set playbackMs to end, then drain ALL remaining events in
      // index order so no event is dropped or reordered (T-04-08). drainAll
      // (not fireEventsBelowOrAt) is used so a terminal event whose playbackMs
      // exceeds totalPlaybackMs still fires.
      playbackMs = config.totalPlaybackMs();
      drainAll();
      // Fire onComplete exactly once
      if (!completeFired) {
        completeFired = true;
        config.onComplete();
      }
      return;
    }

    // -------------------------------------------------------------------
    // Normal frame advance
    // -------------------------------------------------------------------
    if (prevTimestamp === null) {
      prevTimestamp = timestamp;
    }

    if (config.paused?.()) {
      prevTimestamp = timestamp;
      return;
    }
    const wallDelta = timestamp - prevTimestamp;
    prevTimestamp = timestamp;

    // Cinematic pacing: dwell (slow) on a recent BIG event, otherwise FAST-
    // FORWARD the quiet stretch toward the next event so dead air flies by.
    const totalPlaybackMs = config.totalPlaybackMs();
    let playbackDelta = wallDelta;
    if (slowDownRemaining > 0) {
      // Holding a beat on a big moment.
      const inSlow = Math.min(wallDelta, slowDownRemaining);
      const outSlow = wallDelta - inSlow;
      playbackDelta = inSlow / SLOW_FACTOR + outSlow;
      slowDownRemaining = Math.max(0, slowDownRemaining - wallDelta);
    } else {
      // Warp through the gap to the next event. The closer the event, the less
      // warp (so we ease into it at normal speed); long quiet gaps collapse.
      const events = config.events();
      if (nextEventIndex < events.length) {
        const gap = events[nextEventIndex].playbackMs - playbackMs;
        const dwell = totalPlaybackMs * DWELL_FRACTION;
        if (gap > dwell) playbackDelta *= Math.min(WARP_MAX, gap / dwell);
      }
    }

    // Apply reactive speed multiplier (PLAY-05)
    const speedMultiplier = config.speed();
    playbackMs = Math.min(
      playbackMs + playbackDelta * speedMultiplier,
      totalPlaybackMs
    );

    // Fire crossed events (monotonic index cursor guarantees fire-once, T-04-08)
    const prevIndex = nextEventIndex;
    fireEventsBelowOrAt(playbackMs);
    // Hold a beat ONLY on big events; minor events pass at full (warped) speed.
    if (nextEventIndex > prevIndex) {
      let big = false;
      const events = config.events();
      for (let i = prevIndex; i < nextEventIndex; i++) {
        if (BIG_EVENT_TYPES.has(events[i].type)) { big = true; break; }
      }
      if (big) slowDownRemaining = BIG_SLOW_MS;
    }

    // Check completion
    if (playbackMs >= totalPlaybackMs) {
      // Drain any events whose playbackMs exceeds totalPlaybackMs before
      // completing — the clamp on playbackMs means fireEventsBelowOrAt can
      // never reach them, so without this they would be silently dropped
      // (e.g. a terminal `gg` event). Fire-once is preserved by the monotonic
      // nextEventIndex cursor (T-04-08).
      drainAll();
      if (!completeFired) {
        completeFired = true;
        config.onComplete();
      }
      // Caller (rAF wrapper) will see isDone()=true and stop scheduling
    }
  }

  return {
    tick,
    getPlaybackMs: () => playbackMs,
    isDone: () => completeFired,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format milliseconds as LoL-style MM:SS (game clock).
 * Input is in-game ms (0 = 00:00, 2_100_000 = 35:00).
 */
function formatGameTime(gameTimeMs: number): string {
  const totalSec = Math.floor(gameTimeMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Full game duration mapped to 35 minutes (2_100_000 ms) — matches runMatch constant. */
const GAME_DURATION_MS = 35 * 60 * 1000;

/**
 * Map playback position to in-game time (same linear mapping as runMatch).
 */
function playbackToGameTime(playbackMs: number, totalPlaybackMs: number): number {
  if (totalPlaybackMs === 0) return 0;
  return Math.round((playbackMs / totalPlaybackMs) * GAME_DURATION_MS);
}

// ---------------------------------------------------------------------------
// GameTimer component
// ---------------------------------------------------------------------------

export function GameTimer(props: Props) {
  // Displayed game time (ms in-game)
  const [gameTimeMs, setGameTimeMs] = createSignal(0);
  // Whether the pulse animation is active
  const [isPulsing, setIsPulsing] = createSignal(false);

  // Resolve optional props with defaults
  const speed: () => 1 | 2 = props.speed ?? (() => 1);
  const skipSignal: () => number = props.skipSignal ?? (() => 0);

  // rAF handle for cancelAnimationFrame (Pitfall 2 / T-04-07)
  let rafId = 0;
  // Pending pulse-reset timeout handle — cleared on unmount and on each new
  // event so a late timeout never calls setIsPulsing on a disposed scope (WR-02).
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;

  // Create the stateful driver.
  // events/totalPlaybackMs are threaded as accessors (not snapshotted) so the
  // driver stays reactive to a new match's timeline if PlaybackScreen ever
  // outlives a `result` swap (WR-01), mirroring speed/skipSignal.
  const driver = createTimerDriver({
    events: () => props.events,
    totalPlaybackMs: () => props.totalPlaybackMs,
    speed,
    skipSignal,
    paused: () => props.paused?.() ?? false,
    onEventReached: (event, index) => {
      props.onEventReached(event, index);
      // Trigger pulse animation. Clear any in-flight reset so rapid successive
      // events don't leak timers, and track the handle so onCleanup can cancel
      // it on unmount (WR-02).
      clearTimeout(pulseTimer);
      setIsPulsing(true);
      pulseTimer = setTimeout(() => setIsPulsing(false), 300);
    },
    onComplete: () => {
      props.onComplete();
    },
  });

  // rAF loop wrapper — advances driver and updates the displayed game time
  function tick(timestamp: number) {
    driver.tick(timestamp);

    // Update displayed game time from the driver's current playback position
    setGameTimeMs(playbackToGameTime(driver.getPlaybackMs(), props.totalPlaybackMs));

    // Continue loop only if not done (skip or normal completion halts here)
    if (!driver.isDone()) {
      rafId = requestAnimationFrame(tick);
    }
  }

  // Start the rAF loop immediately on mount
  rafId = requestAnimationFrame(tick);

  // CRITICAL: cancel on unmount to prevent runaway loop (Pitfall 2 / T-04-07)
  // and clear any pending pulse-reset timeout so it cannot fire after disposal (WR-02).
  onCleanup(() => {
    cancelAnimationFrame(rafId);
    clearTimeout(pulseTimer);
  });

  return (
    <div
      class={`game-timer${isPulsing() ? " game-timer--pulse" : ""}`}
      aria-label="Relógio da partida"
      aria-live="off"
    >
      {formatGameTime(gameTimeMs())}
    </div>
  );
}
