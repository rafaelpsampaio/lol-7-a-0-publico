/**
 * src/storage/championOverrides.ts
 *
 * Persisted champion-trait override store (D-03). The champion-trait editor
 * writes per-champion trait overrides here; `mergeOverrides` applies them over
 * the loaded `champions.json` catalogue so user edits actually drive the engine.
 *
 * Persistence: @solid-primitives/storage `makePersisted` under the namespaced
 * LocalStorage key `lolseteazero:champion-overrides` — distinct from the chaos
 * key and from any future Phase 5 `lolseteazero:tournament` key (T-03-10,
 * RESEARCH anti-pattern: never share a LocalStorage key across subsystems).
 *
 * Security (T-03-09): every value read back from LocalStorage is `safeParse`d
 * through a Zod schema before use; a tampered / malformed store deserializes to
 * an empty override map rather than poisoning the catalogue (prototype-pollution
 * mitigation — never spread a raw parsed object into game state).
 */

import { createStore, type SetStoreFunction } from "solid-js/store";
import { makePersisted } from "@solid-primitives/storage";
import { z } from "zod";
import {
  ChampionTraitSchema,
  type ChampionEntry,
  type ChampionTrait,
} from "../data/schema";

/** Namespaced LocalStorage key — distinct from Phase 5 tournament state (T-03-10). */
export const CHAMPION_OVERRIDES_STORAGE_KEY = "lolseteazero:champion-overrides";

/**
 * championId → overridden traits (max 2, matching ChampionEntrySchema). A
 * champion absent from this map keeps its catalogue traits unchanged.
 */
export type ChampionOverrides = Record<string, ChampionTrait[]>;

/**
 * Override store shape: a plain record of championId → ChampionTrait[]. Each
 * value is capped at 2 traits to match the catalogue's `traits.max(2)` invariant.
 */
const ChampionOverridesSchema = z.record(
  z.string().min(1),
  z.array(ChampionTraitSchema).max(2)
);

/**
 * safeParse a value read back from LocalStorage (T-03-09). Returns the validated
 * override map on success, or an empty map on any malformed / tampered value.
 * Never spreads the raw parsed object into game state.
 */
function parseOverrides(raw: unknown): ChampionOverrides {
  const result = ChampionOverridesSchema.safeParse(raw);
  return result.success ? result.data : {};
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
 * The persisted champion-override store. Round-trips to LocalStorage under
 * {@link CHAMPION_OVERRIDES_STORAGE_KEY}; every deserialized value is
 * `safeParse`d (T-03-09).
 */
const [championOverrides, setChampionOverrides] = makePersisted(
  createStore<ChampionOverrides>({}),
  {
    name: CHAMPION_OVERRIDES_STORAGE_KEY,
    storage: resolveStorage(),
    serialize: (value: ChampionOverrides) => JSON.stringify(value),
    deserialize: (raw: string) => {
      try {
        return parseOverrides(JSON.parse(raw));
      } catch {
        return {};
      }
    },
  }
);

export {
  /** Persisted champion-override store — the editor reads/writes it. */
  championOverrides,
  /** Persisted champion-override setter — the editor writes trait edits through it. */
  setChampionOverrides,
};

// Re-export the store setter type for downstream typing of the editor props.
export type ChampionOverridesSetter = SetStoreFunction<ChampionOverrides>;

/**
 * Pure helper (D-03): apply user trait overrides over a loaded catalogue.
 *
 * Returns a NEW catalogue array — an overridden champion's `traits` are replaced
 * wholesale by the override; champions without an override pass through
 * unchanged (referentially copied, not mutated). The input catalogue is never
 * mutated. Override entries for unknown champion IDs are ignored (the catalogue
 * is the source of truth for which champions exist).
 *
 * @param catalogue loadChampions() output
 * @param overrides championId → ChampionTrait[] override map
 */
export function mergeOverrides(
  catalogue: ChampionEntry[],
  overrides: ChampionOverrides
): ChampionEntry[] {
  return catalogue.map((entry) => {
    const override = overrides[entry.id];
    if (!override) return entry;
    // Override wins: replace traits wholesale (capped at 2 by the editor/schema).
    return { ...entry, traits: [...override].slice(0, 2) };
  });
}
