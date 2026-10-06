/**
 * src/draft/orchestrator.ts
 *
 * Pure draft-round candidate generation (DRFT-01, DRFT-02, D-06).
 *
 * Imports PlayerVersion / Role from ../data/schema — never re-derives player fields.
 * Contains no Math.random — caller passes in a seeded RNG function.
 *
 * Design decisions applied here (from 02-CONTEXT.md):
 *   D-02: role pool = cards whose primaryRole matches the open role
 *   D-03: exclude any card whose personId is in usedPersonIds
 *   D-05: round flow shrinks 5→4→3→2→1; this function generates one round only
 *   D-06: within a single round, no two role candidates share the same personId
 *   DRFT (Phase 2): SOFT-DISCARD — cards already SHOWN (seenCardIds) are excluded
 *     from later rounds AS LONG AS the role still has fresh alternatives. Only when
 *     a role would otherwise be empty do we fall back to a seen card, so the draft
 *     never starves on a 4-per-role pool while every "next round" still feels new.
 *   Pitfall 1: empty pool → omit role gracefully (no crash); UI shows empty-state banner
 */

import type { PlayerVersion, Role } from "../data/schema";
import type { RoundCandidates } from "./types";

// ---------------------------------------------------------------------------
// ALL_ROLES — canonical ordered list of roles (D-05 round flow)
// ---------------------------------------------------------------------------

export const ALL_ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

// ---------------------------------------------------------------------------
// generateRound — pure, seeded, deterministic
// ---------------------------------------------------------------------------

/**
 * Generate one candidate per still-open role, excluding persons already on the team
 * and de-duplicating by personId within the same round (D-06).
 *
 * @param players       Validated PlayerVersion[] from the Phase 1 loader.
 * @param filledRoles   Roles already locked by the user — excluded from output.
 * @param usedPersonIds PersonIds already drafted by the user — excluded from pools.
 * @param rng           Seeded RNG function (mulberry32) — never uses Math.random.
 * @param seenCardIds   Cards already SHOWN to the user in earlier rounds. Soft-
 *                      excluded: skipped while a role still has fresh cards, but
 *                      allowed back only to avoid leaving a role empty (DRFT).
 *                      Optional — omit (default empty) for a fresh first round.
 * @returns             Partial RoundCandidates (roles with empty pools are omitted, not thrown).
 */
export function generateRound(
  players: PlayerVersion[],
  filledRoles: Set<Role>,
  usedPersonIds: Set<string>,
  rng: () => number,
  seenCardIds: Set<string> = new Set()
): RoundCandidates {
  const openRoles = ALL_ROLES.filter((r) => !filledRoles.has(r));
  const result: RoundCandidates = {};
  // Track personIds already assigned this round (D-06 within-round uniqueness)
  const usedInRound = new Set<string>();

  for (const role of openRoles) {
    // D-02: pool = cards with matching primaryRole
    // D-03: exclude cards whose personId is in usedPersonIds
    // D-06: exclude cards whose personId was already picked this round
    const eligible = players.filter(
      (p) =>
        p.primaryRole === role &&
        !usedPersonIds.has(p.personId) &&
        !usedInRound.has(p.personId)
    );

    // SOFT-DISCARD (DRFT): prefer cards the user has NOT seen yet so the next
    // round always feels new. Fall back to seen cards ONLY when every fresh
    // card is exhausted — this keeps a 4-per-role pool from starving across
    // five rounds without ever showing a discarded card while alternatives exist.
    const fresh = eligible.filter((p) => !seenCardIds.has(p.id));
    const pool = fresh.length > 0 ? fresh : eligible;

    // Pitfall 1: dataset too small → skip role; UI shows empty-state banner
    if (pool.length === 0) continue;

    // Pure index pick using seeded RNG — no Math.random
    const pick = pool[Math.floor(rng() * pool.length)];
    result[role] = pick;
    usedInRound.add(pick.personId);
  }

  return result;
}
