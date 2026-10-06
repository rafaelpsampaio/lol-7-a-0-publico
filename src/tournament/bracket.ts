/**
 * src/tournament/bracket.ts
 *
 * Pure double-elimination bracket engine — no side effects, no LocalStorage,
 * no signals. All randomness via mulberry32 from src/sim/rng.ts.
 *
 * IMPORTANT: Never call Math.random() here. All randomness via mulberry32.
 *
 * Exports:
 *   RunGameFn  — injected callback type (pinned for Plan 03)
 *   createTournament  — build initial TournamentState for 8 teams
 *   advanceSlot       — record a series result + route winner/loser
 *   autoSimBotSeries  — auto-resolve all bot-vs-bot ready slots
 *   buildBotRosters   — build 7 bot TournamentTeams from the player pool
 */

import { mulberry32, seedFromString } from "../sim/rng";
import { BotTeamBuilder } from "../draft/BotTeamBuilder";
import type { PlayerVersion } from "../data/schema";
import type {
  TournamentState,
  TournamentTeam,
  StoredGame,
  BracketSlot,
  SlotId,
} from "./schema";
import { SLOT_FEED_IN, SlotIdSchema, isUserTeam, USER_TEAM_ID } from "./schema";
import { assignTeamIdentities } from "./teamNames";

// ---------------------------------------------------------------------------
// RunGameFn — pinned integration seam (Plan 03 supplies the implementation)
//
// Plan 03 provides the real runGame callback wrapping series.ts's Bo5 loop.
// This plan's bracket.test.ts passes a deterministic stub.
// DO NOT change this exported type signature.
// ---------------------------------------------------------------------------

/**
 * Callback supplied by the caller (Plan 03) to run a single game within a
 * bot-vs-bot series. autoSimBotSeries calls this until one team reaches 3 wins.
 *
 * @param state   Current tournament state (read-only from the function's perspective)
 * @param slotId  The slot being played
 * @returns       StoredGame with the game result
 */
export type RunGameFn = (state: TournamentState, slotId: SlotId) => StoredGame;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates shuffle using mulberry32 — never Math.random().
 */
function shuffleTeams(teamIds: string[], seed: number): string[] {
  const rng = mulberry32(seed);
  const arr = [...teamIds];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Build a default (pending) SeriesState for slots that are not yet seeded.
 */
function makePendingSeries(): BracketSlot["series"] {
  return {
    status: "pending",
    teamAId: null,
    teamBId: null,
    wins: {},
    games: [],
    winnerId: null,
    fearlessUsed: {},
  };
}

/**
 * Build all 14 BracketSlots with default pending state.
 */
function buildInitialSlots(): TournamentState["slots"] {
  const slots: Partial<TournamentState["slots"]> = {};
  for (const slotId of SlotIdSchema.options) {
    slots[slotId] = { id: slotId, series: makePendingSeries() };
  }
  return slots as TournamentState["slots"];
}

// ---------------------------------------------------------------------------
// createTournament
// ---------------------------------------------------------------------------

/**
 * Create a fresh TournamentState for an 8-team double-elimination bracket.
 *
 * - Shuffles the 8 team IDs deterministically using mulberry32(seed) → initialSeeding.
 * - Seeds the 4 UB_QF slots with adjacent pairs from initialSeeding (indices 0/1, 2/3, 4/5, 6/7).
 * - All other slots start as "pending".
 *
 * @param seed   Top-level tournament seed (from makeTournamentSeed)
 * @param teams  Exactly 8 TournamentTeam objects; one must have id "user" and isUser = true
 */
export function createTournament(
  seed: number,
  teams: TournamentTeam[]
): TournamentState {
  if (teams.length !== 8) {
    throw new Error(`createTournament requires exactly 8 teams; got ${teams.length}`);
  }

  // Build team map
  const teamsRecord: TournamentState["teams"] = {};
  for (const team of teams) {
    teamsRecord[team.id] = team;
  }

  // Fisher-Yates shuffle team IDs with mulberry32(seed) (D-02)
  const teamIds = teams.map((t) => t.id);
  const initialSeeding = shuffleTeams(teamIds, seed);

  // Build all 14 slots
  const slots = buildInitialSlots();

  // Seed the 4 UB_QF slots from initialSeeding pairs
  const qfSlots: SlotId[] = ["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"];
  for (let i = 0; i < 4; i++) {
    const slotId = qfSlots[i]!;
    const teamAId = initialSeeding[i * 2]!;
    const teamBId = initialSeeding[i * 2 + 1]!;
    slots[slotId] = {
      id: slotId,
      series: {
        status: "ready",
        teamAId,
        teamBId,
        wins: {},
        games: [],
        winnerId: null,
        fearlessUsed: {},
      },
    };
  }

  return {
    version: 1,
    seed,
    status: "active",
    teams: teamsRecord,
    initialSeeding,
    slots,
    activeSlotId: null,
    userTeamId: USER_TEAM_ID,
    championId: null,
  };
}

// ---------------------------------------------------------------------------
// advanceSlot
// ---------------------------------------------------------------------------

/**
 * Record the result of a completed series and route winner/loser to their
 * next slots per SLOT_FEED_IN. Returns a NEW state (no mutation).
 *
 * - Winner → all slots with { winFrom: slotId }
 * - Loser  → all slots with { loseFrom: slotId }, or eliminated if none
 * - Any slot whose both teams are now set flips status "pending" → "ready"
 * - Recomputes TournamentStatus (user_eliminated, complete)
 *
 * @param state    Current tournament state
 * @param slotId   The slot that just completed
 * @param winnerId The teamId of the series winner
 * @param loserId  The teamId of the series loser
 */
export function advanceSlot(
  state: TournamentState,
  slotId: SlotId,
  winnerId: string,
  loserId: string
): TournamentState {
  // Deep-copy slots (pure — no mutation)
  const newSlots: TournamentState["slots"] = {} as TournamentState["slots"];
  for (const [id, slot] of Object.entries(state.slots) as [SlotId, typeof state.slots[SlotId]][]) {
    newSlots[id] = {
      ...slot,
      series: { ...slot.series, wins: { ...slot.series.wins }, games: [...slot.series.games] },
    };
  }

  // Mark the completed slot
  newSlots[slotId] = {
    ...newSlots[slotId],
    series: {
      ...newSlots[slotId]!.series,
      status: "complete",
      winnerId,
    },
  };

  // Track whether the loser was routed anywhere (false = second loss = elimination)
  let loserRouted = false;

  // Route winner and loser into downstream slots
  for (const [destSlotId, feed] of Object.entries(SLOT_FEED_IN) as [SlotId, typeof SLOT_FEED_IN[SlotId]][]) {
    const destSeries = { ...newSlots[destSlotId]!.series };
    let updated = false;

    // teamA
    const feedA = feed.teamA;
    if ("winFrom" in feedA && feedA.winFrom === slotId) {
      destSeries.teamAId = winnerId;
      updated = true;
    } else if ("loseFrom" in feedA && feedA.loseFrom === slotId) {
      destSeries.teamAId = loserId;
      loserRouted = true;
      updated = true;
    }

    // teamB
    const feedB = feed.teamB;
    if ("winFrom" in feedB && feedB.winFrom === slotId) {
      destSeries.teamBId = winnerId;
      updated = true;
    } else if ("loseFrom" in feedB && feedB.loseFrom === slotId) {
      destSeries.teamBId = loserId;
      loserRouted = true;
      updated = true;
    }

    if (updated) {
      // Flip pending → ready if both teams are now known
      if (
        destSeries.teamAId !== null &&
        destSeries.teamBId !== null &&
        destSeries.status === "pending"
      ) {
        destSeries.status = "ready";
      }
      newSlots[destSlotId] = { ...newSlots[destSlotId]!, series: destSeries };
    }
  }

  // Determine new TournamentStatus
  let newStatus = state.status;
  let newChampionId = state.championId;

  if (slotId === "GF") {
    // Grand final complete → tournament complete
    newStatus = "complete";
    newChampionId = winnerId;
  } else if (!loserRouted && loserId === state.userTeamId) {
    // Loser was eliminated (second loss) and it's the user's team
    newStatus = "user_eliminated";
  }

  return {
    ...state,
    slots: newSlots,
    status: newStatus,
    championId: newChampionId,
  };
}

// ---------------------------------------------------------------------------
// autoSimBotSeries
// ---------------------------------------------------------------------------

/**
 * Auto-resolve all bot-vs-bot "ready" slots synchronously.
 *
 * Pinned signature (Plan 03 must NOT change this): autoSimBotSeries(state, runGame).
 *
 * Iterates until no bot-vs-bot "ready" slot remains:
 *   1. Find a "ready" slot where NEITHER team is the user team.
 *   2. Call runGame(state, slotId) repeatedly until one team reaches 3 wins.
 *   3. Call advanceSlot to route results and cascade "pending" → "ready".
 *   4. Repeat until no eligible slots remain.
 *
 * Does NOT import series.ts — driven entirely by the injected runGame callback.
 *
 * @param state    Current tournament state
 * @param runGame  Injected callback (Plan 03 supplies the real Bo5 runner)
 */
export function autoSimBotSeries(
  state: TournamentState,
  runGame: RunGameFn
): TournamentState {
  let current = state;

  // Pitfall 5: cascade — keep looping until no bot-vs-bot ready slots remain
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Find the first "ready" slot with no user team
    const botSlot = findNextBotSlot(current);
    if (!botSlot) break;

    // Simulate the series to completion (Bo5 advance at 3 wins)
    current = simBotSeries(current, botSlot, runGame);
  }

  return current;
}

/**
 * Find the first "ready" slot where neither team is the user's team.
 */
function findNextBotSlot(state: TournamentState): SlotId | null {
  for (const slotId of SlotIdSchema.options) {
    const series = state.slots[slotId]?.series;
    if (!series) continue;
    if (series.status !== "ready") continue;
    if (series.teamAId === state.userTeamId) continue;
    if (series.teamBId === state.userTeamId) continue;
    return slotId;
  }
  return null;
}

/**
 * Simulate a single bot-vs-bot series to completion using the injected runGame.
 * Returns the state after advanceSlot has been called with the series winner.
 */
function simBotSeries(
  state: TournamentState,
  slotId: SlotId,
  runGame: RunGameFn
): TournamentState {
  let current = state;
  const wins: Record<string, number> = {};

  // Track current series state to accumulate games
  let currentSeries = current.slots[slotId]!.series;

  // Bo5: advance at 3 wins
  while (true) {
    const game = runGame(current, slotId);
    const winnerId = game.winnerId;
    wins[winnerId] = (wins[winnerId] ?? 0) + 1;

    // Append the game to the series (pure — build new state)
    const updatedSeries = {
      ...currentSeries,
      status: "in_progress" as const,
      wins: { ...currentSeries.wins, [winnerId]: wins[winnerId]! },
      games: [...currentSeries.games, game],
      fearlessUsed: updateFearlessUsed(currentSeries.fearlessUsed, game),
    };

    // Shallow-update the slot in current state
    current = {
      ...current,
      slots: {
        ...current.slots,
        [slotId]: { ...current.slots[slotId]!, series: updatedSeries },
      } as TournamentState["slots"],
    };
    currentSeries = updatedSeries;

    // Check if series is complete (3 wins)
    const seriesWinner = findSeriesWinner(wins);
    if (seriesWinner) {
      // Determine loser (the other team)
      const loser =
        currentSeries.teamAId === seriesWinner
          ? currentSeries.teamBId!
          : currentSeries.teamAId!;

      current = advanceSlot(current, slotId, seriesWinner, loser);
      break;
    }
  }

  return current;
}

/**
 * Returns the teamId of the first team with 3 or more wins, or null.
 */
function findSeriesWinner(wins: Record<string, number>): string | null {
  for (const [teamId, count] of Object.entries(wins)) {
    if (count >= 3) return teamId;
  }
  return null;
}

/**
 * Update fearlessUsed from a completed game's champion assignments.
 * Returns a new fearlessUsed record (no mutation).
 */
function updateFearlessUsed(
  fearlessUsed: Record<string, string[]>,
  game: StoredGame
): Record<string, string[]> {
  const updated = { ...fearlessUsed };
  const allChampions = {
    ...game.champions.teamA,
    ...game.champions.teamB,
  };
  for (const [playerId, championId] of Object.entries(allChampions)) {
    const current = updated[playerId] ?? [];
    if (!current.includes(championId)) {
      updated[playerId] = [...current, championId];
    }
  }
  return updated;
}

// ---------------------------------------------------------------------------
// buildBotRosters
// ---------------------------------------------------------------------------

/**
 * Build 7 distinct bot TournamentTeams from the player pool.
 *
 * - Uses mulberry32/seedFromString to derive a distinct seed per bot.
 * - Calls BotTeamBuilder.buildRoster with an empty excludedPersonIds set and the
 *   cards already taken by the user and the earlier bots (A-01).
 * - Converts the returned Roster (Record<Role, PlayerVersion>) to PlayerVersion[] via Object.values.
 * - displayName: null-safe mid-laner lookup → "Equipe {displayName}" or "Bot {i}" fallback.
 *
 * @param players        Validated PlayerVersion[] from players.json
 * @param tournamentSeed Top-level tournament seed
 * @param userRoster     Cartas do time do usuario, que nenhum bot pode repetir (A-01)
 */
export function buildBotRosters(
  players: PlayerVersion[],
  tournamentSeed: number,
  reserved?: { name?: string; tag?: string },
  userRoster: PlayerVersion[] = []
): TournamentTeam[] {
  const builder = new BotTeamBuilder();
  const teams: TournamentTeam[] = [];
  // A-01: carta unica no torneio. Cada bot pula as cartas do usuario e dos bots
  // anteriores; pessoa repetida so e proibida dentro do proprio time.
  const takenCardIds = new Set(userRoster.map((p) => p.id));

  // Distinct org-style identities. The user now names their own team, so exclude
  // that name/tag from the bot pool to avoid two teams sharing an identity.
  const identities = assignTeamIdentities(tournamentSeed, 16).filter(
    (id) => id.name !== reserved?.name && id.tag !== reserved?.tag
  );

  for (let i = 0; i < 7; i++) {
    // Derive a distinct per-bot seed by hashing the tournament seed with the bot index
    const botSeed = seedFromString(`bot-${tournamentSeed}-${i}`);

    // Pessoa pode repetir entre times (D-04), carta nao (A-01)
    const roster = builder.buildRoster(players, botSeed, new Set<string>(), takenCardIds);

    // Convert Roster (Record<Role, PlayerVersion>) to PlayerVersion[]
    const rosterArray: PlayerVersion[] = Object.values(roster);
    for (const p of rosterArray) takenCardIds.add(p.id);

    const identity = identities[i] ?? identities[i % identities.length];
    const teamId = `bot-${i}`;
    teams.push({
      id: teamId,
      isUser: isUserTeam(teamId, USER_TEAM_ID),
      displayName: identity.name,
      tag: identity.tag,
      roster: rosterArray,
    });
  }

  return teams;
}
