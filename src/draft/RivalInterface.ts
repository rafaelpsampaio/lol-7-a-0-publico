/**
 * src/draft/RivalInterface.ts
 *
 * Seam interface for rival roster generation.
 * Bot in v1 (BotTeamBuilder), human adapter in v2 — no orchestrator changes needed (D-08).
 *
 * This file exports only a TypeScript interface — zero runtime code.
 * Mirrors src/data/schema.ts as a type authority with no business logic.
 */

import type { PlayerVersion } from "../data/schema";
import type { Roster } from "./types";

/**
 * Seam for rival roster generation.
 *
 * The draft orchestrator always talks to RivalInterface, never to BotTeamBuilder directly.
 * Swap in a HumanAdapter in v2 without touching any orchestrator code (D-08, DRFT-04).
 */
export interface RivalInterface {
  /**
   * Build a complete 5-role roster from the available player pool.
   *
   * @param players           Validated PlayerVersion[] from the Phase 1 loader.
   * @param seed              Deterministic seed for reproducible roster generation.
   * @param excludedPersonIds PersonIds already on the user's team — must not be picked.
   * @param excludedCardIds   Card ids already taken by other teams (A-01): must not be picked.
   * @returns                 A complete Roster with all 5 roles filled.
   */
  buildRoster(
    players: PlayerVersion[],
    seed: number,
    excludedPersonIds?: Set<string>,
    excludedCardIds?: ReadonlySet<string>
  ): Roster;
}
