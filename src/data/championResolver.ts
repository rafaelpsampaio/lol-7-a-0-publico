/**
 * src/data/championResolver.ts
 *
 * Smart champion-name -> champion-id resolver for the spreadsheet importer.
 *
 * Friends fill the upload sheet with messy free text: "miss fortune", "kha zix",
 * "gankplank" (typo), "yummi" (typo), "renata glasck" (typo). The canonical ids
 * in public/champions.json are inconsistent (`khazix` and `belveth` are joined,
 * but `miss-fortune` and `lee-sin` are kebab-case), so a plain slug() does not
 * line up. This resolver normalizes BOTH sides to an alphanumeric-only canonical
 * form, indexes every champion by canonical(id) AND canonical(name), and falls
 * back to a fuzzy (Levenshtein) match to absorb typos.
 *
 * Pure module — no DOM, no I/O. Unit-tested in championResolver.test.ts.
 */

import type { ChampionEntry } from "./schema";

export type ResolveStatus = "exact" | "normalized" | "fuzzy" | "unresolved";

export interface ChampionResolution {
  /** The raw cell text exactly as supplied. */
  raw: string;
  /** Resolved champion id (kebab/canonical as in champions.json); undefined if unresolved. */
  id?: string;
  /** Resolved champion display name; undefined if unresolved. */
  name?: string;
  /** How the match was reached (drives the import report copy). */
  status: ResolveStatus;
}

/** A resolver bound to a champion catalogue: maps free text -> ChampionResolution. */
export type ChampionResolver = (raw: string) => ChampionResolution;

/** Lowercase + strip every non-alphanumeric character. "Kha'Zix" -> "khazix". */
export function canonicalChampionKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Classic Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Similarity in [0,1]: 1 - distance/maxLen. */
function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Minimum similarity for a fuzzy match to count (absorbs 1-2 char typos). */
const FUZZY_THRESHOLD = 0.8;

/**
 * Build a resolver bound to the given champion catalogue.
 *
 * Resolution cascade:
 *   1. exact      — raw (trimmed, lowercased) equals a champion id verbatim
 *   2. normalized — canonical(raw) matches canonical(id) or canonical(name)
 *   3. fuzzy      — closest canonical key within FUZZY_THRESHOLD similarity
 *   4. unresolved — nothing close enough
 */
export function buildChampionResolver(champions: ChampionEntry[]): ChampionResolver {
  // canonical key -> entry (id keys win over name keys on collision; insert ids last)
  const byCanonical = new Map<string, ChampionEntry>();
  for (const c of champions) byCanonical.set(canonicalChampionKey(c.name), c);
  for (const c of champions) byCanonical.set(canonicalChampionKey(c.id), c);

  const idSet = new Set(champions.map((c) => c.id));
  const canonicalKeys = [...byCanonical.keys()];

  return (raw: string): ChampionResolution => {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) return { raw, status: "unresolved" };

    // 1. exact id
    const lower = trimmed.toLowerCase();
    if (idSet.has(lower)) {
      const c = champions.find((x) => x.id === lower)!;
      return { raw, id: c.id, name: c.name, status: "exact" };
    }

    // 2. normalized (canonical) match
    const key = canonicalChampionKey(trimmed);
    const hit = byCanonical.get(key);
    if (hit) {
      return { raw, id: hit.id, name: hit.name, status: "normalized" };
    }

    // 3. fuzzy — Levenshtein similarity, with a containment boost so common
    //    shorthands ("jarvan" -> jarvan-iv, "renata" -> renata) still resolve.
    let best: ChampionEntry | undefined;
    let bestSim = 0;
    for (const ck of canonicalKeys) {
      let sim = similarity(key, ck);
      if (
        key.length >= 4 &&
        (ck.includes(key) || key.includes(ck)) &&
        sim < 0.9
      ) {
        sim = 0.9;
      }
      if (sim > bestSim) {
        bestSim = sim;
        best = byCanonical.get(ck);
      }
    }
    if (best && bestSim >= FUZZY_THRESHOLD) {
      return { raw, id: best.id, name: best.name, status: "fuzzy" };
    }

    return { raw, status: "unresolved" };
  };
}
