/**
 * src/draft/BotTeamBuilder.ts
 *
 * Weighted-random bot roster builder implementing RivalInterface (D-07, D-08, DRFT-04).
 *
 * Design decisions:
 *   D-07: Weight per candidate = roleStrength[primaryRole] + 1 (avoids zero weights).
 *   D-08: Implements RivalInterface — the draft orchestrator/DraftScreen references
 *         this only via the RivalInterface type, never the concrete class.
 *   Pitfall 5: mulberry32 initialized inside buildRoster (not on class) — pure per call,
 *              no mutable class state across invocations.
 */

import type { RivalInterface } from "./RivalInterface";
import type { PlayerVersion, Role } from "../data/schema";
import type { Roster } from "./types";
import { mulberry32 } from "../sim/rng";

const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

export class BotTeamBuilder implements RivalInterface {
  /**
   * Build a 5-role roster using weighted random selection per role.
   *
   * Pure per call: same inputs → same output.
   * mulberry32(seed) is initialized inside the method — no mutable class state.
   *
   * @param players           Validated PlayerVersion[] (already Zod-validated by Phase 1).
   * @param seed              Deterministic seed.
   * @param excludedPersonIds PersonIds already used by another team (D-03); defaults to empty.
   * @param excludedCardIds Ids de cartas ja levadas por outros times (A-01); defaults to empty.
   */
  buildRoster(
    players: PlayerVersion[],
    seed: number,
    excludedPersonIds: Set<string> = new Set(),
    excludedCardIds: ReadonlySet<string> = new Set()
  ): Roster {
    // Initialize rng inside the method — pure per call (no mutable state on class)
    const rng = mulberry32(seed);
    const roster: Partial<Roster> = {};
    // Track personIds picked into this bot roster to ensure within-roster uniqueness (D-03)
    const usedPersonIds = new Set<string>(excludedPersonIds);

    for (const role of ROLES) {
      const pool = players.filter(
        (p) =>
          p.primaryRole === role &&
          !usedPersonIds.has(p.personId) &&
          // A-01: carta ja levada por outro time nao volta
          !excludedCardIds.has(p.id)
      );

      if (pool.length === 0) {
        throw new Error(
          `BotTeamBuilder: no available ${role} candidate - expand players.json (Pitfall 1)`
        );
      }

      const pick = weightedPick(pool, rng);
      roster[role] = pick;
      usedPersonIds.add(pick.personId);
    }

    return roster as Roster;
  }
}

// ---------------------------------------------------------------------------
// weightedPick — unexported module helper (D-07)
// ---------------------------------------------------------------------------

/**
 * Select a candidate from pool using weighted random selection.
 * Weight = roleStrength[primaryRole] + 1 (the +1 prevents zero weight for strength-0 cards).
 * Higher roleStrength → proportionally higher selection probability (D-07).
 */
function weightedPick(pool: PlayerVersion[], rng: () => number): PlayerVersion {
  const weights = pool.map((p) => p.roleStrength[p.primaryRole] + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;

  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }

  // Floating-point rounding guard — return last element
  return pool[pool.length - 1];
}
