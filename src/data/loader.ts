/**
 * src/data/loader.ts
 *
 * Runtime loader for players.json served as a Vite public/ static asset.
 *
 * DATA-07: Uses fetch('/players.json') — root-relative path works identically
 * in Vite dev server (localhost:5173), vite preview, dist/, and Cloudflare Pages.
 * NEVER uses `import data from '../public/players.json'` (Pitfall 1: that bundles
 * the file into the JS chunk and breaks user-editability post-build).
 *
 * DATA-05 / T-1-04: On validation failure, calls formatZodErrors to surface
 * human-readable "Card X, field Y" messages. A raw ZodError NEVER escapes
 * to the caller or to the UI layer.
 */

import {
  PlayerDatabaseSchema,
  ChampionCatalogueSchema,
  type PlayerVersion,
  type ChampionEntry,
} from "./schema";
import { formatZodErrors, type RawPlayerData } from "./errorFormatter";

/**
 * Carrega e valida qualquer arquivo no formato players.json: a base (/players.json)
 * e os pacotes embutidos, como /packs/amigos.json (A-09). Mesmas garantias do
 * loadPlayers: nunca devolve lista vazia ou errada calado.
 */
export async function loadPlayerDatabase(url: string): Promise<PlayerVersion[]> {
  const file = url.replace(/^\//, "");
  const response = await fetch(url);

  // T-1-05: Guard non-ok responses — never silently return an empty/wrong result
  if (!response.ok) {
    throw new Error(`Could not load ${file}: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as RawPlayerData;

  // T-1-06: safeParse (not parse) — never throws; always returns a typed result
  const result = PlayerDatabaseSchema.safeParse(raw);

  if (!result.success) {
    // T-1-04: Route through formatZodErrors — no raw ZodError escapes to the caller
    const messages = formatZodErrors(result.error, raw);
    throw new Error(`${file} has errors:\n${messages.join("\n")}`);
  }

  // Return typed players array — the only thing that ever leaves this function
  return result.data.players;
}

/**
 * Fetches and validates players.json from the public/ static asset path.
 *
 * @returns Promise resolving to a typed PlayerVersion[] on success.
 * @throws  Error with human-readable message on fetch failure or schema violation.
 *
 * @example
 * const players = await loadPlayers();
 * // → PlayerVersion[] (schema-validated, safe to consume)
 */
export async function loadPlayers(): Promise<PlayerVersion[]> {
  // DATA-07: root-relative fetch — works in dev, dist/, and Cloudflare Pages
  return loadPlayerDatabase("/players.json");
}

/**
 * Fetches and validates champions.json from the public/ static asset path.
 *
 * Mirrors loadPlayers() exactly (D-01 / SIM-06): root-relative fetch, safeParse
 * (never throws), human-readable error on failure. The committed
 * public/champions.json is the only runtime source — no CDN call (INTG-02).
 *
 * @returns Promise resolving to a typed ChampionEntry[] on success.
 * @throws  Error with human-readable message on fetch failure or schema violation.
 *
 * @example
 * const champions = await loadChampions();
 * // → ChampionEntry[] (schema-validated, safe to consume)
 */
export async function loadChampions(): Promise<ChampionEntry[]> {
  // Root-relative fetch — works in dev, dist/, and Cloudflare Pages
  const response = await fetch("/champions.json");

  // Guard non-ok responses — never silently return an empty/wrong result
  if (!response.ok) {
    throw new Error(
      `Could not load champions.json: ${response.status} ${response.statusText}`
    );
  }

  const raw = await response.json();

  // safeParse (not parse) — never throws; always returns a typed result
  const result = ChampionCatalogueSchema.safeParse(raw);

  if (!result.success) {
    // Route through formatZodErrors — no raw ZodError escapes to the caller.
    // The catalogue's top-level array key is `champions`, not `players`, so the
    // per-card id look-up does not apply; formatZodErrors falls back to a plain
    // field-path message, which is the readable behavior we want here.
    const messages = formatZodErrors(result.error);
    throw new Error(`champions.json has errors:\n${messages.join("\n")}`);
  }

  // Return typed champions array — the only thing that ever leaves this function
  return result.data.champions;
}
