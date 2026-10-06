/**
 * src/tournament/storage.ts
 *
 * Persisted tournament state store under the reserved LocalStorage key
 * `lolseteazero:tournament` (D-15). Mirrors the pattern from:
 *   - src/storage/championOverrides.ts (makePersisted + createStore + safeParse)
 *   - src/storage/chaosLevel.ts (resolveStorage in-memory fallback)
 *
 * Security (T-05-03): every value read from LocalStorage is safeParse'd
 * through TournamentStateSchema before use; tampered/malformed saves return null
 * (LaunchMenu shows "no save"). Never spreads raw JSON into state (T-03-09).
 * Single reserved key — never shared with other subsystems (T-05-04, T-03-10).
 * JSON.parse wrapped in try/catch — malformed strings never throw (T-05-05).
 *
 * Exports:
 *   TOURNAMENT_STORAGE_KEY  — "lolseteazero:tournament"
 *   tournamentStore         — reactive store (TournamentState | null)
 *   setTournamentStore      — setter for the store
 *   saveTournament(state)   — persist a new state
 *   loadTournament()        — read the current stored value (null if none/invalid)
 *   clearTournament()       — remove the saved state
 */

import { createSignal, type Accessor, type Setter } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import { TournamentStateSchema, type TournamentState } from "./schema";

// ---------------------------------------------------------------------------
// projectForStorage — lean LocalStorage projection (quota guard)
//
// The full per-game `events` timeline carries map/score snapshots on EVERY event
// and accumulates across all 14 bracket slots (each Bo5 up to 5 games). Persisting
// it verbatim blows past the browser's ~5MB LocalStorage quota and throws
// QuotaExceededError mid-draft (the "Confirmar time" button crashed on this).
//
// The engine is deterministic (SIM-01 / D-08): every game can be re-simulated
// from `seed` + `champions` + `chaosLevel` via runMatchEngine. So we strip the
// timeline before writing and reconstruct it on demand at replay time. Everything
// the bracket/result screens need (winner, champions, seed, frame) is kept.
// ---------------------------------------------------------------------------

export function projectForStorage(state: TournamentState): TournamentState {
  const slots = {} as TournamentState["slots"];
  for (const [slotId, slot] of Object.entries(state.slots)) {
    slots[slotId as keyof TournamentState["slots"]] = {
      ...slot,
      series: {
        ...slot.series,
        games: slot.series.games.map((game) => ({ ...game, events: [] })),
      },
    };
  }
  return { ...state, slots };
}

// ---------------------------------------------------------------------------
// Storage key — single reserved key; never shared (T-05-04, T-03-10)
// ---------------------------------------------------------------------------

/** Namespaced LocalStorage key for tournament state (D-15). */
export const TOURNAMENT_STORAGE_KEY = "lolseteazero:tournament";

// ---------------------------------------------------------------------------
// resolveStorage — in-memory fallback for non-DOM environments (vitest/node)
// Copy verbatim from src/storage/chaosLevel.ts lines 46–59 (Pitfall 6)
// ---------------------------------------------------------------------------

/**
 * Storage backend resolver: `localStorage` in the browser/dev, in-memory
 * no-op store under non-DOM environments (node vitest) so import never throws.
 */
function resolveStorage(): Storage {
  if (typeof localStorage !== "undefined") return quotaSafe(localStorage);
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
 * Wrap a real Storage so a `setItem` that overflows the browser quota degrades
 * to a console warning instead of throwing. With projectForStorage in place this
 * should never fire, but it is the last line of defence that keeps the UI button
 * that triggered the save from crashing the whole app (QuotaExceededError).
 */
function quotaSafe(storage: Storage): Storage {
  return new Proxy(storage, {
    get(target, prop, receiver) {
      if (prop === "setItem") {
        return (key: string, value: string) => {
          try {
            target.setItem(key, value);
          } catch (err) {
            if (
              err instanceof DOMException &&
              (err.name === "QuotaExceededError" ||
                err.name === "NS_ERROR_DOM_QUOTA_REACHED")
            ) {
              console.warn(
                `[tournament] LocalStorage quota exceeded saving "${key}"; ` +
                  `state kept in memory only (will not survive reload).`
              );
              return;
            }
            throw err;
          }
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

// ---------------------------------------------------------------------------
// safeParse — never spreads raw JSON into state (T-05-03, T-05-05)
// ---------------------------------------------------------------------------

/**
 * Parse a value from LocalStorage through TournamentStateSchema (T-05-03).
 * Returns the validated state on success, or null on any malformed/tampered
 * value. Never spreads the raw parsed object into game state (prototype-pollution
 * mitigation — Zod constructs fresh objects).
 */
function parseTournamentState(raw: unknown): TournamentState | null {
  const result = TournamentStateSchema.safeParse(raw);
  return result.success ? result.data : null;
}

// ---------------------------------------------------------------------------
// Persisted store — mirrors championOverrides.ts pattern exactly
// ---------------------------------------------------------------------------

const resolvedStorage = resolveStorage();

const [tournamentSignal, setTournamentSignal] = makePersisted(
  createSignal<TournamentState | null>(null),
  {
    name: TOURNAMENT_STORAGE_KEY,
    storage: resolvedStorage,
    serialize: (value: TournamentState | null) =>
      JSON.stringify(value === null ? null : projectForStorage(value)),
    deserialize: (raw: string) => {
      try {
        return parseTournamentState(JSON.parse(raw));
      } catch {
        return null;
      }
    },
  }
);

/**
 * Reactive persisted tournament signal accessor — null if no valid save exists.
 * Read as tournamentStore() in reactive contexts (SolidJS signal pattern).
 */
export const tournamentStore: Accessor<TournamentState | null> = tournamentSignal;

/**
 * Setter for the tournament store — replaces the entire persisted state.
 * makePersisted writes to LocalStorage synchronously after every set.
 */
export const setTournamentStore: Setter<TournamentState | null> = setTournamentSignal;

// Re-export types for downstream prop typing.
export type TournamentStoreSetter = Setter<TournamentState | null>;

// ---------------------------------------------------------------------------
// saveTournament / loadTournament / clearTournament
// ---------------------------------------------------------------------------

/**
 * Persist the given TournamentState to LocalStorage (D-13).
 * makePersisted writes synchronously (resolveStorage is synchronous).
 */
export function saveTournament(state: TournamentState): void {
  setTournamentStore(state as TournamentState | null);
}

/**
 * Read the current persisted TournamentState, or null if no valid save exists.
 * The value has already been safeParse'd by the deserializer.
 * Calls the signal accessor (tournamentStore is an Accessor<TournamentState | null>).
 */
export function loadTournament(): TournamentState | null {
  return tournamentStore();
}

/**
 * Remove the saved tournament state (e.g. on "New Tournament" confirm, D-14).
 * Sets the store to null, which serializes as "null" and is recognized as
 * "no save" by parseTournamentState.
 */
export function clearTournament(): void {
  setTournamentStore(null);
}
