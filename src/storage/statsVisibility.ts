/**
 * src/storage/statsVisibility.ts
 *
 * Persisted "show player stats" signal — a championship-creation choice. When the
 * creator turns this OFF, the draft hides the revealed numeric attributes (lane/
 * mid/late) so players pick on intuition and the public hints alone, not numbers.
 *
 * Persistence: @solid-primitives/storage `makePersisted` under the namespaced
 * LocalStorage key `lolseteazero:stats-visible`. Deliberately distinct from the
 * tournament key (never share a LocalStorage key across subsystems — T-03-10),
 * mirroring src/storage/chaosLevel.ts exactly.
 *
 * Security (T-03-09): the value read back is `safeParse`d through `z.boolean()`
 * before use — a tampered / malformed stored value falls back to the default.
 */

import { createSignal, type Accessor, type Setter } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import { z } from "zod";

/** Namespaced LocalStorage key — distinct from tournament state (T-03-10). */
export const STATS_VISIBLE_STORAGE_KEY = "lolseteazero:stats-visible";

/** Default: stats visible (preserves the established draft behaviour). */
export const DEFAULT_STATS_VISIBLE = true;

/** Stats visibility is a plain boolean flag. */
const StatsVisibleSchema = z.boolean();

/**
 * safeParse a value read back from LocalStorage (T-03-09). Returns the boolean on
 * success, or the default on any malformed / tampered value.
 */
function parseStatsVisible(raw: unknown): boolean {
  const result = StatsVisibleSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_STATS_VISIBLE;
}

/**
 * Storage backend resolver: `localStorage` in the browser/dev, in-memory no-op
 * store under non-DOM environments (node vitest) so import never throws.
 */
function resolveStorage(): Storage {
  if (typeof localStorage !== "undefined") return localStorage;
  const mem = new Map<string, string>();
  return {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    key: (i: number) => Array.from(mem.keys())[i] ?? null,
    removeItem: (k: string) => mem.delete(k),
    setItem: (k: string, v: string) => void mem.set(k, v),
  } as Storage;
}

/**
 * The persisted stats-visibility signal. Defaults to {@link DEFAULT_STATS_VISIBLE}
 * and round-trips to LocalStorage under {@link STATS_VISIBLE_STORAGE_KEY}.
 * Every deserialized value is `safeParse`d (T-03-09).
 */
const [statsVisible, setStatsVisible] = makePersisted(
  createSignal<boolean>(DEFAULT_STATS_VISIBLE),
  {
    name: STATS_VISIBLE_STORAGE_KEY,
    storage: resolveStorage(),
    serialize: (value: boolean) => JSON.stringify(value),
    deserialize: (raw: string) => {
      try {
        return parseStatsVisible(JSON.parse(raw));
      } catch {
        return DEFAULT_STATS_VISIBLE;
      }
    },
  }
);

/** Persisted stats-visibility accessor — the draft reads it to reveal/hide numbers. */
export const statsVisibleSignal: Accessor<boolean> = statsVisible;
/** Persisted stats-visibility setter — the options toggle writes through it. */
export const setStatsVisibleSignal: Setter<boolean> = setStatsVisible;
