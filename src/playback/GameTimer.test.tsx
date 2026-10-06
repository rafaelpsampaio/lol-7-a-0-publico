/**
 * src/playback/GameTimer.test.tsx
 *
 * Tests for GameTimer: fire-once + in-order event invariant at 1x, 2x, and skip-to-end.
 *
 * Strategy: drive the loop with synthetic timestamps via the exported `createTimerDriver`.
 *
 * Slow-down note: when an event fires, the driver activates a 300ms slow-down period
 * (1/4 effective speed). Tests account for this by providing enough frames or by using
 * skip-to-end which bypasses the rAF loop entirely.
 *
 * Frame accounting: the very first tick(ts) call sets prevTimestamp=ts with delta=0.
 * Subsequent calls advance by wallDelta=ts-prevTs. Helper `advanceMs` runs enough
 * synthetic ticks to accumulate at least the requested playback ms.
 *
 * Test cases:
 *   1. At speed=2, the timer reaches totalPlaybackMs in fewer frames than speed=1
 *   2. At 2x, events fire in ascending order
 *   3. Mid-run speed change does not re-fire an already-fired event
 *   4. skip-to-end fires all remaining events once in ascending order, then onComplete once
 *   5. completeFired guard: onComplete fires exactly once
 *   6. nextEventIndex monotonic: events fire in ascending playbackMs order under skip
 */

import { describe, it, expect } from "vitest";
import type { GameEvent } from "./types";
import { createTimerDriver } from "./GameTimer";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeEvent(playbackMs: number, index: number): GameEvent {
  return {
    gameTimeMs: index * 10_000,
    playbackMs,
    type: "dragon" as const,
    team: "user" as const,
    winProbAfter: 0.5 + index * 0.05,
  };
}

function makeEvents(playbackMsList: number[]): GameEvent[] {
  return playbackMsList.map((ms, i) => makeEvent(ms, i));
}

it("pausa sem avançar nem acumular tempo e permite pular enquanto pausado", () => {
  let paused = false, skip = 0, completed = 0;
  const reached: number[] = [];
  const events = makeEvents([500, 1500]);
  const driver = createTimerDriver({ events: () => events, totalPlaybackMs: () => 2000,
    speed: () => 1, skipSignal: () => skip, paused: () => paused,
    onEventReached: (_, i) => reached.push(i), onComplete: () => completed++ });
  driver.tick(0); driver.tick(100);
  const before = driver.getPlaybackMs();
  const beforeEvents = [...reached];
  paused = true; driver.tick(10000);
  expect(driver.getPlaybackMs()).toBe(before);
  expect(reached).toEqual(beforeEvents);
  paused = false; driver.tick(10016);
  expect(driver.getPlaybackMs() - before).toBeLessThan(500);
  expect(driver.isDone()).toBe(false);
  paused = true; skip++; driver.tick(10032); driver.tick(10048);
  expect(reached).toEqual([0, 1]);
  expect(completed).toBe(1);
});

/**
 * Advance driver by many small frames until it's done or maxFrames reached.
 * Returns number of frames used to reach completion.
 * Uses 16ms frames (≈60fps) to approximate real rAF behavior.
 */
function runUntilComplete(
  driver: ReturnType<typeof createTimerDriver>,
  maxFrames: number = 10_000,
  frameMs: number = 16
): number {
  let ts = 0;
  let frames = 0;
  driver.tick(ts); // seed prevTimestamp
  frames++;
  while (!driver.isDone() && frames < maxFrames) {
    ts += frameMs;
    driver.tick(ts);
    frames++;
  }
  return frames;
}

// ---------------------------------------------------------------------------
// Tests: speed multiplier
// ---------------------------------------------------------------------------

describe("GameTimer — speed multiplier", () => {
  it("at 2x, the timer completes in roughly half the frames of 1x", () => {
    // Use a game with no events so slow-down does not interfere
    const events: GameEvent[] = [];
    const totalPlaybackMs = 1000;

    let complete1x = false;
    const driver1x = createTimerDriver({
      events: () => events,
      totalPlaybackMs: () => totalPlaybackMs,
      speed: () => 1,
      skipSignal: () => 0,
      onEventReached: () => {},
      onComplete: () => { complete1x = true; },
    });

    let complete2x = false;
    const driver2x = createTimerDriver({
      events: () => events,
      totalPlaybackMs: () => totalPlaybackMs,
      speed: () => 2,
      skipSignal: () => 0,
      onEventReached: () => {},
      onComplete: () => { complete2x = true; },
    });

    const frames1x = runUntilComplete(driver1x);
    const frames2x = runUntilComplete(driver2x);

    expect(complete1x).toBe(true);
    expect(complete2x).toBe(true);
    // 2x should need fewer frames (roughly half)
    expect(frames2x).toBeLessThan(frames1x);
    // And specifically ~half (within a frame of rounding)
    expect(frames2x).toBeGreaterThanOrEqual(Math.floor(frames1x / 2) - 2);
    expect(frames2x).toBeLessThanOrEqual(Math.ceil(frames1x / 2) + 2);
  });

  it("at 2x, events fire in ascending index order", () => {
    const events = makeEvents([200, 600, 900]);
    const firedOrder: number[] = [];

    const driver = createTimerDriver({
      events: () => events,
      totalPlaybackMs: () => 2000,
      speed: () => 2,
      skipSignal: () => 0,
      onEventReached: (_e, i) => firedOrder.push(i),
      onComplete: () => {},
    });

    runUntilComplete(driver);

    expect(firedOrder).toEqual([0, 1, 2]);
  });

  it("at 2x, each event fires exactly once", () => {
    const events = makeEvents([100, 300, 600]);
    const fired: number[] = [];

    const driver = createTimerDriver({
      events: () => events,
      totalPlaybackMs: () => 1000,
      speed: () => 2,
      skipSignal: () => 0,
      onEventReached: (_e, i) => fired.push(i),
      onComplete: () => {},
    });

    runUntilComplete(driver);

    // No event should appear twice
    expect(fired.length).toBe(events.length);
    expect(new Set(fired).size).toBe(events.length);
  });
});

// ---------------------------------------------------------------------------
// Tests: mid-run speed change
// ---------------------------------------------------------------------------

describe("GameTimer — mid-run speed change", () => {
  it("changing speed mid-run does not re-fire an already-fired event", () => {
    // Event[0] at 300ms, event[1] at 2000ms — well separated
    const events = makeEvents([300, 2000]);
    const fired: number[] = [];
    let speedValue: 1 | 2 = 1;

    const driver = createTimerDriver({
      events: () => events,
      totalPlaybackMs: () => 3000,
      speed: () => speedValue,
      skipSignal: () => 0,
      onEventReached: (_e, i) => fired.push(i),
      onComplete: () => {},
    });

    // Run until event[0] fires (at 300ms with 1x, 16ms frames: ~19 frames + slow-down)
    let ts = 0;
    driver.tick(ts); // seed
    while (fired.length === 0) {
      ts += 16;
      driver.tick(ts);
    }
    expect(fired).toEqual([0]);

    // Now switch to 2x and run until event[1] fires
    speedValue = 2;
    let limit = 500;
    while (fired.length < 2 && limit-- > 0) {
      ts += 16;
      driver.tick(ts);
    }

    // event[0] must appear exactly once — NOT re-fired
    expect(fired.filter(i => i === 0).length).toBe(1);
    // event[1] should have fired
    expect(fired).toContain(1);
  });

  it("speed change does not reset playbackMs to zero", () => {
    // Single event at 500ms in a 1000ms game (no events for simplicity)
    const events: GameEvent[] = [];
    const totalPlaybackMs = 1000;
    let speedValue: 1 | 2 = 1;

    let complete = false;
    const driver = createTimerDriver({
      events: () => events,
      totalPlaybackMs: () => totalPlaybackMs,
      speed: () => speedValue,
      skipSignal: () => 0,
      onEventReached: () => {},
      onComplete: () => { complete = true; },
    });

    // Advance to ~500ms at 1x (≈32 frames at 16ms)
    let ts = 0;
    driver.tick(ts);
    for (let i = 0; i < 32; i++) {
      ts += 16;
      driver.tick(ts);
    }
    // playbackMs should be ~512ms (32 * 16ms = 512ms)
    const msAfter1x = driver.getPlaybackMs();
    expect(msAfter1x).toBeGreaterThan(400);
    expect(msAfter1x).toBeLessThan(1000);
    expect(complete).toBe(false);

    // Switch to 2x — should continue from current position, not reset
    speedValue = 2;
    // Advance a few more frames
    for (let i = 0; i < 5; i++) {
      ts += 16;
      driver.tick(ts);
    }
    // playbackMs should be higher than before, not reset
    expect(driver.getPlaybackMs()).toBeGreaterThan(msAfter1x);
  });
});

// ---------------------------------------------------------------------------
// Tests: skip-to-end
// ---------------------------------------------------------------------------

describe("GameTimer — skip-to-end", () => {
  it("skip fires all remaining events once in ascending order, then onComplete once", () => {
    const events = makeEvents([200, 700, 1200]);
    const firedEvents: GameEvent[] = [];
    const firedIndices: number[] = [];
    let completeCount = 0;
    let skipCounter = 0;

    const driver = createTimerDriver({
      events: () => events,
      totalPlaybackMs: () => 2000,
      speed: () => 1,
      skipSignal: () => skipCounter,
      onEventReached: (e, i) => { firedEvents.push(e); firedIndices.push(i); },
      onComplete: () => { completeCount++; },
    });

    // Advance until event[0] fires (200ms)
    let ts = 0;
    driver.tick(ts);
    while (firedIndices.length === 0) {
      ts += 16;
      driver.tick(ts);
    }
    expect(firedIndices).toEqual([0]);

    // Request skip
    skipCounter = 1;
    ts += 16;
    driver.tick(ts);

    // event[1] and event[2] must have fired in order (via skip), then onComplete once
    expect(firedIndices).toEqual([0, 1, 2]);
    expect(firedEvents[1].playbackMs).toBeLessThan(firedEvents[2].playbackMs);
    expect(completeCount).toBe(1);
  });

  it("skip from the start fires all events in order then onComplete", () => {
    const events = makeEvents([100, 400, 800]);
    const firedMs: number[] = [];
    let completeCount = 0;
    let skipCounter = 0;

    const driver = createTimerDriver({
      events: () => events,
      totalPlaybackMs: () => 1000,
      speed: () => 1,
      skipSignal: () => skipCounter,
      onEventReached: (e) => firedMs.push(e.playbackMs),
      onComplete: () => { completeCount++; },
    });

    // Request skip before first tick — driver sees skipCounter increase from 0 to 1
    skipCounter = 1;
    // Single tick triggers skip detection on first call
    driver.tick(0);

    expect(firedMs).toEqual([100, 400, 800]);
    // Ascending order check
    for (let i = 1; i < firedMs.length; i++) {
      expect(firedMs[i]).toBeGreaterThan(firedMs[i - 1]);
    }
    expect(completeCount).toBe(1);
  });

  it("skip-to-end when timer already complete is a no-op (onComplete not fired again)", () => {
    const events = makeEvents([100]);
    let completeCount = 0;
    let skipCounter = 0;

    const driver = createTimerDriver({
      events: () => events,
      totalPlaybackMs: () => 500,
      speed: () => 1,
      skipSignal: () => skipCounter,
      onEventReached: () => {},
      onComplete: () => { completeCount++; },
    });

    // Run to natural completion
    runUntilComplete(driver);
    expect(completeCount).toBe(1);

    // Skip after completion — must be no-op
    skipCounter = 1;
    driver.tick(9999);
    expect(completeCount).toBe(1);
  });

  it("double-calling skip does not fire onComplete twice", () => {
    const events = makeEvents([100, 300]);
    let completeCount = 0;
    let skipCounter = 0;

    const driver = createTimerDriver({
      events: () => events,
      totalPlaybackMs: () => 600,
      speed: () => 1,
      skipSignal: () => skipCounter,
      onEventReached: () => {},
      onComplete: () => { completeCount++; },
    });

    // First skip: seed + first actual tick both see skipCounter=1 but lastSeenSkip=0
    driver.tick(0); // seed prevTs, delta=0; skip detected (skipCounter=1 > lastSeen=0? No — skipCounter=0 initially)
    // Wait, skipCounter is still 0 here. Let's set it before tick.
    skipCounter = 1;
    driver.tick(16); // skip fires here
    expect(completeCount).toBe(1);

    // Second skip increment — driver is already done
    skipCounter = 2;
    driver.tick(32);
    expect(completeCount).toBe(1);
  });
});
