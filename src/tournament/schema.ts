/**
 * src/tournament/schema.ts
 *
 * Single source of truth for the tournament state model.
 * All TypeScript types are derived via z.infer — never hand-written.
 *
 * D-02: Deterministic seed derivation from top-level tournament seed.
 * D-13: Per-game saves; resume mid-Bo5 with fearless history intact.
 * D-15: LocalStorage key `lolseteazero:tournament`; Zod safeParse on every read.
 * T-05-01: .strict() on every object + literal version guard for tamper detection.
 * T-05-02: fearlessUsed as Record<string, string[]> — not Set — for JSON round-trip.
 */

import { z } from "zod";
import { PlayerVersionSchema } from "../data/schema";
import { GameEventSchema } from "../sim/types";

// ---------------------------------------------------------------------------
// SlotId — 14-slot double-elimination topology (8 teams, no bracket reset D-03)
// UB: 4 QF + 2 SF + 1 F = 7 matches
// LB: 2 R1 + 2 R2 + 1 SF + 1 F = 6 matches
// GF: 1 match
// Total: 14 matches (2×8 - 2 = 14; no reset means 1 GF series)
// ---------------------------------------------------------------------------

export const SlotIdSchema = z.enum([
  // Upper Bracket — Round 1 Quarterfinals (4 matches)
  "UB_QF_1",
  "UB_QF_2",
  "UB_QF_3",
  "UB_QF_4",
  // Upper Bracket — Semifinals (2 matches)
  "UB_SF_1",
  "UB_SF_2",
  // Upper Bracket Final (1 match)
  "UB_F",
  // Lower Bracket — Round 1 (2 matches, fed by UB_QF losers)
  "LB_R1_1",
  "LB_R1_2",
  // Lower Bracket — Round 2 (2 matches: LB_R1 winners + UB_SF losers)
  "LB_R2_1",
  "LB_R2_2",
  // Lower Bracket — Semifinal (1 match: LB_R2 winners)
  "LB_SF",
  // Lower Bracket Final (1 match: LB_SF winner vs UB_F loser)
  "LB_F",
  // Grand Final (1 match: UB_F winner vs LB_F winner — D-03: no reset)
  "GF",
]);

export type SlotId = z.infer<typeof SlotIdSchema>;

// ---------------------------------------------------------------------------
// TournamentTeam — immutable roster + identity for display
// ---------------------------------------------------------------------------

/** Id reservado do time do jogador no torneio solo (sempre "user"). */
export const USER_TEAM_ID = "user" as const;

/**
 * Um time é "do usuário" só quando bate com um id de referência conhecido.
 * O solo passa USER_TEAM_ID (sempre "user"); a sala passa null no servidor
 * (D-22: nenhum time da sala é inerentemente do usuário) ou o id do time de
 * quem está assistindo agora, no cliente. Nunca inferir isso de
 * userFrameTeamId — aquilo é uma decisão de enquadramento presa a um jogo já
 * simulado, não "quem está assistindo agora" (ver docs/superpowers/specs/
 * 2026-08-26-isuser-unification-design.md para o porquê de não unificar)
 * (userFrameTeamId decide qual lado de um jogo já simulado é o azul — ver
 * StoredGame.userFrameTeamId).
 */
export function isUserTeam(teamId: string, userTeamId: string | null): boolean {
  return userTeamId !== null && teamId === userTeamId;
}

export const TournamentTeamSchema = z
  .object({
    /** "user" for the player's team; a unique bot id (e.g. "bot-0") otherwise */
    id: z.string().min(1),
    isUser: z.boolean(),
    /** Display label shown in bracket nodes */
    displayName: z.string().min(1),
    /** Short broadcast tag (e.g. "DRC"). Optional for back-compat with old saves. */
    tag: z.string().min(1).max(4).optional(),
    /** Team accent colour (hex) for the HUD. Optional; defaults to broadcast blue. */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    roster: z.array(PlayerVersionSchema),
    /**
     * CAPTAIN: personId of the team captain (Feature 3b). The user designates one
     * of their 5 drafted players as captain on the completed-roster panel; it is
     * persisted as part of tournament state. Optional for back-compat with saves
     * written before this field existed and for bot teams (no captain). The engine
     * stream reads this to apply the captain's effect (see DraftScreen captain step).
     */
    captainPersonId: z.string().min(1).optional(),
  })
  .strict();

export type TournamentTeam = z.infer<typeof TournamentTeamSchema>;

// ---------------------------------------------------------------------------
// StoredGame — one completed game within a Bo5 series
// ---------------------------------------------------------------------------

export const StoredGameSchema = z
  .object({
    formVersion: z.literal(1).optional(),
    /** Spec traits no motor (5): gravado so quando a chave do solo estava desligada. */
    newTraitEffects: z.literal(false).optional(),
    /** Deterministic seed — replay feeds this to runMatch (D-08, D-13) */
    seed: z.number().int(),
    /** teamId of the winner of this individual game */
    winnerId: z.string().min(1),
    /**
     * Which bracket team is the "user"/blue frame in the stored events. The human
     * team is always framed as blue when it plays (so it never watches from the
     * enemy's side); bot-vs-bot games default to teamA. Optional for back-compat
     * with saves written before this field existed (consumers fall back to teamA).
     * @see isUserTeam — conceito deliberadamente separado, não o confunda com
     * "quem está assistindo agora".
     */
    userFrameTeamId: z.string().min(1).optional(),
    /**
     * Full MatchResult event timeline. Held in memory for immediate playback,
     * but STRIPPED from the LocalStorage projection (see tournament/storage.ts):
     * the timeline carries per-event map/score snapshots and grows without bound
     * across a 14-slot bracket, blowing past the ~5MB LocalStorage quota
     * (QuotaExceededError). On resume/replay the timeline is re-simulated from
     * `seed` + `champions` + `chaosLevel` via runMatchEngine — fully deterministic
     * (SIM-01 / D-08), so an empty array here means "reconstruct on demand".
     */
    events: z.array(GameEventSchema),
    totalPlaybackMs: z.number().int().min(0),
    /**
     * Comeback intensity [0,1] this game was simulated with. Stored so a replay
     * reconstructs the EXACT timeline even if the user later changed the chaos
     * setting. Optional for back-compat with saves written before this field
     * (replay falls back to the current chaos level).
     */
    chaosLevel: z.number().min(0).max(1).optional(),
    /**
     * playerId → championId for each team in this game.
     * Sourced from assignFearlessChampions(); stored so result screen and replay
     * both have champion data without re-running fearless (D-12).
     */
    champions: z
      .object({
        teamA: z.record(z.string(), z.string()),
        teamB: z.record(z.string(), z.string()),
      })
      .strict(),
  })
  .strict();

export type StoredGame = z.infer<typeof StoredGameSchema>;

// ---------------------------------------------------------------------------
// SeriesStatus
// ---------------------------------------------------------------------------

export const SeriesStatusSchema = z.enum([
  "pending", // neither team determined yet (feed-in slots not resolved)
  "ready", // both teams known; series not yet started
  "in_progress", // series started; at least one game played
  "complete", // winner determined (≥3 wins)
]);

export type SeriesStatus = z.infer<typeof SeriesStatusSchema>;

// ---------------------------------------------------------------------------
// SeriesState — mutable state of one Bo5 series
// ---------------------------------------------------------------------------

export const SeriesStateSchema = z
  .object({
    status: SeriesStatusSchema,
    /** teamId of team A in this slot (null until determined by feed-in) */
    teamAId: z.string().nullable(),
    /** teamId of team B in this slot (null until determined by feed-in) */
    teamBId: z.string().nullable(),
    /** Wins per team: teamId → win count */
    wins: z.record(z.string(), z.number().int().min(0)),
    /**
     * Completed games in this series.
     * games[0] = game 1, games[1] = game 2, etc.
     * Length 0..5; length < 5 while series is in_progress.
     */
    games: z.array(StoredGameSchema),
    /** teamId of series winner (null until complete) */
    winnerId: z.string().nullable(),
    /**
     * Current series fearless champion usage: playerId → used champion IDs.
     * Stored as Record<string, string[]> for JSON round-trip (D-13).
     * T-05-02: NEVER a Set — not JSON-serializable (Pitfall 2).
     * Reset to {} at the start of each new series (D-06).
     * Populated after each game so mid-series resume restores fearless state.
     */
    fearlessUsed: z.record(z.string(), z.array(z.string())),
  })
  .strict();

export type SeriesState = z.infer<typeof SeriesStateSchema>;

// ---------------------------------------------------------------------------
// BracketSlot — a slot in the bracket with its series
// ---------------------------------------------------------------------------

export const BracketSlotSchema = z
  .object({
    id: SlotIdSchema,
    series: SeriesStateSchema,
  })
  .strict();

export type BracketSlot = z.infer<typeof BracketSlotSchema>;

// ---------------------------------------------------------------------------
// TournamentStatus
// ---------------------------------------------------------------------------

export const TournamentStatusSchema = z.enum([
  "draft", // user is in the draft screen (pre-tournament)
  "active", // tournament running; user still in it
  "user_eliminated", // user lost; can watch or quit (D-10)
  "watching", // user eliminated but chose to keep watching (D-10)
  "complete", // grand final done; champion crowned (D-11)
]);

export type TournamentStatus = z.infer<typeof TournamentStatusSchema>;

// ---------------------------------------------------------------------------
// TournamentState — root state tree
// ---------------------------------------------------------------------------

export const TournamentStateSchema = z
  .object({
    /** Schema version — literal guard for T-05-01 tamper detection */
    version: z.literal(1),
    /** Top-level tournament seed (seedFromString of a timestamp string) */
    seed: z.number().int(),
    status: TournamentStatusSchema,
    /** All 8 teams indexed by teamId */
    teams: z.record(z.string(), TournamentTeamSchema),
    /**
     * Bracket seeding: index 0..7 → teamId.
     * Derived deterministically from the tournament seed at creation time (D-02).
     * Indices 0/1 → UB_QF_1, 2/3 → UB_QF_2, 4/5 → UB_QF_3, 6/7 → UB_QF_4.
     */
    initialSeeding: z.array(z.string()).length(8),
    /** All 14 series slots indexed by SlotId */
    slots: z.record(SlotIdSchema, BracketSlotSchema),
    /**
     * The slot currently being played by the user (or null when at bracket hub).
     * Used to restore "which series am I in?" on resume (D-13).
     */
    activeSlotId: SlotIdSchema.nullable(),
    /** teamId of the user's team (always "user") */
    userTeamId: z.literal(USER_TEAM_ID),
    /** teamId of the tournament champion (null until complete) */
    championId: z.string().nullable(),
  })
  .strict();

export type TournamentState = z.infer<typeof TournamentStateSchema>;

// ---------------------------------------------------------------------------
// SLOT_FEED_IN — routing table for the 14-slot double-elimination bracket
//
// Each slot entry describes where teamA and teamB come from:
//   seedIndex  — initial seeding index (UB_QF only)
//   winFrom    — slotId whose winner fills this team slot
//   loseFrom   — slotId whose loser fills this team slot
//
// Topology verified: 4 UB_QF + 2 UB_SF + 1 UB_F + 2 LB_R1 + 2 LB_R2 + 1 LB_SF + 1 LB_F + 1 GF = 14
// UB_F loser drops to LB_F (standard 8-team double-elim: UB finalist has 1 loss → faces LB_SF winner)
// ---------------------------------------------------------------------------

type FeedInDescriptor =
  | { seedIndex: number }
  | { winFrom: SlotId }
  | { loseFrom: SlotId };

export const SLOT_FEED_IN: Record<
  SlotId,
  { teamA: FeedInDescriptor; teamB: FeedInDescriptor }
> = {
  // Upper Bracket Quarterfinals — fed by initial seeding
  UB_QF_1: { teamA: { seedIndex: 0 }, teamB: { seedIndex: 1 } },
  UB_QF_2: { teamA: { seedIndex: 2 }, teamB: { seedIndex: 3 } },
  UB_QF_3: { teamA: { seedIndex: 4 }, teamB: { seedIndex: 5 } },
  UB_QF_4: { teamA: { seedIndex: 6 }, teamB: { seedIndex: 7 } },

  // Upper Bracket Semifinals — winners of QFs
  UB_SF_1: { teamA: { winFrom: "UB_QF_1" }, teamB: { winFrom: "UB_QF_2" } },
  UB_SF_2: { teamA: { winFrom: "UB_QF_3" }, teamB: { winFrom: "UB_QF_4" } },

  // Upper Bracket Final — winners of SFs
  UB_F: { teamA: { winFrom: "UB_SF_1" }, teamB: { winFrom: "UB_SF_2" } },

  // Lower Bracket Round 1 — losers of UB QFs
  LB_R1_1: { teamA: { loseFrom: "UB_QF_1" }, teamB: { loseFrom: "UB_QF_2" } },
  LB_R1_2: { teamA: { loseFrom: "UB_QF_3" }, teamB: { loseFrom: "UB_QF_4" } },

  // Lower Bracket Round 2 — LB_R1 winners + UB_SF losers
  LB_R2_1: {
    teamA: { winFrom: "LB_R1_1" },
    teamB: { loseFrom: "UB_SF_1" },
  },
  LB_R2_2: {
    teamA: { winFrom: "LB_R1_2" },
    teamB: { loseFrom: "UB_SF_2" },
  },

  // Lower Bracket Semifinal — LB_R2 winners
  LB_SF: { teamA: { winFrom: "LB_R2_1" }, teamB: { winFrom: "LB_R2_2" } },

  // Lower Bracket Final — LB_SF winner vs UB_F loser
  LB_F: { teamA: { winFrom: "LB_SF" }, teamB: { loseFrom: "UB_F" } },

  // Grand Final — UB_F winner vs LB_F winner (D-03: no bracket reset)
  GF: { teamA: { winFrom: "UB_F" }, teamB: { winFrom: "LB_F" } },
};
