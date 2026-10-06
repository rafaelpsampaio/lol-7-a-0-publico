/**
 * src/storage/statsVisibility.test.ts
 *
 * Unit tests for the persisted stats-visibility signal. Covers the default value
 * and the toggle behaviour the championship-creation options panel relies on.
 * (The node vitest environment has no DOM, so makePersisted falls back to the
 * in-memory store and the signal behaves like a plain createSignal here.)
 */

import { describe, it, expect } from "vitest";
import {
  statsVisibleSignal,
  setStatsVisibleSignal,
  DEFAULT_STATS_VISIBLE,
  STATS_VISIBLE_STORAGE_KEY,
} from "./statsVisibility";

describe("statsVisibility store", () => {
  it("defaults to visible (preserves established draft behaviour)", () => {
    expect(DEFAULT_STATS_VISIBLE).toBe(true);
    expect(statsVisibleSignal()).toBe(true);
  });

  it("uses a LocalStorage key distinct from the tournament key (T-03-10)", () => {
    expect(STATS_VISIBLE_STORAGE_KEY).toBe("lolseteazero:stats-visible");
    expect(STATS_VISIBLE_STORAGE_KEY).not.toBe("lolseteazero:tournament");
  });

  it("toggles off and back on through the setter", () => {
    setStatsVisibleSignal(false);
    expect(statsVisibleSignal()).toBe(false);
    setStatsVisibleSignal((v) => !v);
    expect(statsVisibleSignal()).toBe(true);
  });
});
