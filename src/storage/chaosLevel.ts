/**
 * src/storage/chaosLevel.ts
 *
 * Persisted chaos-level signal (D-10). The chaos slider binds to this signal;
 * `runMatch` consumes the persisted value as its comeback-intensity input.
 *
 * Persistence: @solid-primitives/storage `makePersisted` under the namespaced
 * LocalStorage key `lolseteazero:chaos-level`. The key is deliberately distinct
 * from any future Phase 5 `lolseteazero:tournament` key (RESEARCH anti-pattern:
 * never share a LocalStorage key across subsystems — T-03-10).
 *
 * Security (T-03-09): the value read back from LocalStorage is `safeParse`d
 * through a Zod `z.number().min(0).max(1)` schema before use — a tampered or
 * malformed stored value falls back to the default rather than poisoning the
 * engine input. No raw parsed object is ever spread into game state.
 */

import { createSignal, type Accessor, type Setter } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import { z } from "zod";

/** Namespaced LocalStorage key — distinct from Phase 5 tournament state (T-03-10). */
export const CHAOS_LEVEL_STORAGE_KEY = "lolseteazero:chaos-level";

/** Default comeback intensity (D-09) — mirrors runMatch's DEFAULT_CHAOS_LEVEL. */
export const DEFAULT_CHAOS_LEVEL = 0.25;

/** A chaos level is a real number in [0, 1] (matches MatchInput.chaosLevel). */
const ChaosLevelSchema = z.number().min(0).max(1);

/**
 * safeParse a value read back from LocalStorage (T-03-09 — prototype-pollution /
 * tampering mitigation). Returns the clamped number on success, or the default
 * on any malformed / out-of-range / tampered value.
 */
function parseChaosLevel(raw: unknown): number {
  const result = ChaosLevelSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_CHAOS_LEVEL;
}

/**
 * Storage backend resolver: use `localStorage` when present (browser/dev), and
 * fall back to an in-memory no-op store under non-DOM environments (e.g. the
 * `node` vitest environment) so importing this module never throws.
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
 * The persisted chaos-level signal. Defaults to {@link DEFAULT_CHAOS_LEVEL}
 * (D-09) and round-trips to LocalStorage under {@link CHAOS_LEVEL_STORAGE_KEY}.
 * Every deserialized value is `safeParse`d (T-03-09).
 */
const [chaosLevel, setChaosLevel] = makePersisted(
  createSignal<number>(DEFAULT_CHAOS_LEVEL),
  {
    name: CHAOS_LEVEL_STORAGE_KEY,
    storage: resolveStorage(),
    serialize: (value: number) => JSON.stringify(value),
    deserialize: (raw: string) => {
      try {
        return parseChaosLevel(JSON.parse(raw));
      } catch {
        return DEFAULT_CHAOS_LEVEL;
      }
    },
  }
);

/** Persisted chaos-level accessor — the slider binds to it; runMatch consumes it. */
export const chaosLevelSignal: Accessor<number> = chaosLevel;
/** Persisted chaos-level setter — the slider's range input writes through it. */
export const setChaosLevelSignal: Setter<number> = setChaosLevel;
