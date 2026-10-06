/**
 * src/draft/types.ts
 *
 * Draft domain types — all derived via z.infer per PATTERNS.md "Schema-first type derivation".
 * Import PlayerVersion / Role from ../data/schema — never re-derive player fields here.
 *
 * Design decisions:
 *   DraftState: tracks round progress, filled roles, and personId exclusions per team.
 *   Roster: 5-slot filled team — Record<Role, PlayerVersion>.
 *   RoundCandidates: partial record (omit empty-pool roles) — one candidate per open role.
 */

import { z } from "zod";
import {
  PlayerVersionSchema,
  RoleSchema,
  type PlayerVersion,
  type Role,
} from "../data/schema";

// ---------------------------------------------------------------------------
// Roster — 5-slot complete team (one PlayerVersion per Role)
// ---------------------------------------------------------------------------

export const RosterSchema = z.object({
  top: PlayerVersionSchema,
  jungle: PlayerVersionSchema,
  mid: PlayerVersionSchema,
  adc: PlayerVersionSchema,
  support: PlayerVersionSchema,
});

export type Roster = z.infer<typeof RosterSchema>;

// ---------------------------------------------------------------------------
// RoundCandidates — one candidate per still-open role (partial: omits empty pools)
// ---------------------------------------------------------------------------

export const RoundCandidatesSchema = z.record(RoleSchema, PlayerVersionSchema);

export type RoundCandidates = Partial<Record<Role, PlayerVersion>>;

// ---------------------------------------------------------------------------
// DraftState — complete state of an in-progress draft for the user's team
// ---------------------------------------------------------------------------

// Note: Set<string> is not natively Zod-serialisable; DraftState is an
// in-memory only type used by DraftScreen.tsx signals — no JSON round-trip needed.
// Defined as a TypeScript interface (not z.infer) per the PATTERNS.md rule:
// "Types with no validation surface may use interface directly."
export interface DraftState {
  /** 1-based round counter (1..5) */
  round: number;
  /** Roles already locked by the user */
  filledRoles: Set<Role>;
  /** PersonIds the user has already drafted — excluded from future draws */
  usedPersonIds: Set<string>;
  /** The user's roster being assembled, keyed by role */
  roster: Partial<Record<Role, PlayerVersion>>;
}
