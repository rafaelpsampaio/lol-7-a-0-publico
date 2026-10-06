/**
 * src/sim/types.ts
 *
 * Zod schemas and z.infer-derived types for the match simulation engine.
 * All TypeScript types are derived via z.infer — never hand-written.
 *
 * D-09: Playback speed presets (super_fast/fast/slow/super_slow)
 * D-15: Event vocabulary (first_blood, dragon, dragon_steal, inhibitor, baron, elder_dragon, gg)
 * D-14: winProbAfter stored on each GameEvent for Phase 4 animated bar
 */

import { z } from "zod";
import { PlayerVersionSchema, ChampionEntrySchema } from "../data/schema";

// ---------------------------------------------------------------------------
// SpeedPreset — D-09 playback speed presets
// ---------------------------------------------------------------------------

export const SpeedPresetSchema = z.enum([
  "super_fast",
  "fast",
  "slow",
  "super_slow",
]);

export type SpeedPreset = z.infer<typeof SpeedPresetSchema>;

// ---------------------------------------------------------------------------
// EventType — D-15 locked event vocabulary
// ---------------------------------------------------------------------------

export const EventTypeSchema = z.enum([
  // --- Legacy vocabulary (kept so pre-refactor stored games still validate) ---
  "dragon",
  "inhibitor",
  "baron",
  "elder_dragon",
  // --- Rich state-driven taxonomy (Phase 6) ---
  "first_blood",
  "kill",
  "death",
  "solo_kill",
  "gank",
  "dive",
  "double_kill",
  "triple_kill",
  "quadra_kill",
  "penta_kill",
  "shutdown",
  "ace",
  "dragon_taken",
  "dragon_fight",
  "dragon_steal",
  "voidgrubs_taken",
  "herald_taken",
  "herald_used",
  "tower_destroyed",
  "first_tower",
  "baron_fight",
  "baron_taken",
  "baron_steal",
  "elder_fight",
  "elder_taken",
  "elder_steal",
  "inhibitor_destroyed",
  "nexus_exposed",
  "comeback_fight",
  "gg",
  // Phase 12 — eventos contextuais (EVT-01/02, D-05):
  "ctx_support_died_warding",
  "ctx_adc_caught_no_flash",
  "ctx_top_dive_weakside",
  "ctx_bot_won_2v2",
  "ctx_support_engage_decisive",
  "ctx_enchanter_saved_carry",
  "ctx_adc_cleaned_fight",
  "ctx_scaling_survived_early",
  // Phase 17 — eventos estruturais intermediarios visiveis (STR-04, D-01):
  "plate_taken",
  "tower_low",
  // Phase 26 (plano 26-07): recheio narrativo do early game (D-01),
  // cruzamento de sinal de lane com histerese (laneSignals.ts).
  "lane_advantage_building",
  "lane_priority_shift",
  "jungler_attention_shift",
  // Phase 28 (plano 28-04): destaque narrativo de zebra (D-03/D-04/D-05).
  "upset_win",
  // Spec calendario (secao 4): aviso de preparo de objetivo.
  "objective_setup",
  // Spec traits no motor (3.6 e 4): o `quits` saiu ou voltou.
  "player_quit",
  "player_returned",
]);

export type EventType = z.infer<typeof EventTypeSchema>;

// ---------------------------------------------------------------------------
// MapSnapshot — live "what's on the map right now" state for the playback HUD
// (Phase 9 / live map). All timers are REMAINING SECONDS at this event's clock.
// ---------------------------------------------------------------------------

const LaneStructSnapshotSchema = z.object({
  outer: z.boolean(),
  inner: z.boolean(),
  inhibTurret: z.boolean(),
  inhibitor: z.boolean(),
  /** Seconds until the inhibitor respawns, or null when it is standing. */
  inhibInSec: z.number().nullable(),
});

const PlayerMapSnapshotSchema = z.object({
  alive: z.boolean(),
  respawnInSec: z.number().nullable(),
  kills: z.number().int().min(0),
  deaths: z.number().int().min(0),
  assists: z.number().int().min(0),
  gold: z.number().int().min(0),
  shutdownGold: z.number().int().min(0),
  /** Spec traits no motor (4): true enquanto o jogador saiu da partida. Ausente nos demais. */
  away: z.boolean().optional(),
});

const RolePlayersSchema = z.object({
  top: PlayerMapSnapshotSchema,
  jungle: PlayerMapSnapshotSchema,
  mid: PlayerMapSnapshotSchema,
  adc: PlayerMapSnapshotSchema,
  support: PlayerMapSnapshotSchema,
});

const TeamMapSnapshotSchema = z.object({
  top: LaneStructSnapshotSchema,
  mid: LaneStructSnapshotSchema,
  bot: LaneStructSnapshotSchema,
  nexusTurrets: z.number().int().min(0).max(2),
  nexusExposed: z.boolean(),
  players: RolePlayersSchema,
});

// ---------------------------------------------------------------------------
// CompProfileSnapshotSideSchema — shape de compProfile por time (D-06, COMP-03)
// ---------------------------------------------------------------------------

/**
 * Sub-schema do compProfile por time no MapSnapshot (D-06).
 * Definido ANTES de MapSnapshotSchema para forward-reference.
 * Sempre .optional() no MapSnapshotSchema — backward compat (T-10-03).
 */
const CompProfileSnapshotSideSchema = z.object({
  /** Tags dominantes derivadas do draft (vazias = comp neutra). */
  dominantTags: z.array(z.string()),
  /** Rotulo pt-BR gerado por labelCompProfile(). Vazio = comp neutra. */
  label: z.string(),
});

// ---------------------------------------------------------------------------
// StrongsideSideSchema — shape de strongside por time (LANE-04)
// ---------------------------------------------------------------------------

const StrongsideSideSchema = z.object({
  /** Qual lane é o strongside atual. null = estado neutro (score abaixo do limiar). */
  dominantLane: z.enum(["top", "mid", "bot"]).nullable(),
  /** Score de strongside por lane: -1..+1 (positivo = este time é o strong). */
  scores: z.object({
    top: z.number(),
    mid: z.number(),
    bot: z.number(),
  }),
  /** Atenção combinada do jungler: -1..+1. */
  junglerAttention: z.number(),
});

export const MapSnapshotSchema = z.object({
  user: TeamMapSnapshotSchema,
  rival: TeamMapSnapshotSchema,
  // Dragon / soul
  dragonAlive: z.boolean(),
  dragonInSec: z.number().nullable(),
  dragonElement: z.string().nullable(),
  soulElement: z.string().nullable(),
  userSoul: z.string().nullable(),
  rivalSoul: z.string().nullable(),
  dragonsTaken: z.number().int().min(0),
  // Baron / herald / voidgrubs / elder
  baronAlive: z.boolean(),
  baronInSec: z.number().nullable(),
  heraldAlive: z.boolean(),
  voidgrubsAlive: z.number().int().min(0).max(3),
  elderAlive: z.boolean(),
  elderUnlocked: z.boolean(),
  elderInSec: z.number().nullable(),
  // LANE-04: strongside/weakside por-tick (D-05 HUD).
  // .optional() obrigatório para backward compat — snapshots/GameEvents armazenados sem
  // o campo continuam validando (T-10-03). torná-lo required quebraria o parser Zod.
  strongside: z
    .object({
      user: StrongsideSideSchema,
      rival: StrongsideSideSchema,
    })
    .optional(),
  // COMP-03/D-06: compProfile por-tick para o HUD — rotulo pt-BR + tags dominantes.
  // Sempre .optional() — backward compat com eventos legados sem o campo (T-10-03).
  compProfile: z
    .object({
      user: CompProfileSnapshotSideSchema,
      rival: CompProfileSnapshotSideSchema,
    })
    .optional(),
});

export type MapSnapshot = z.infer<typeof MapSnapshotSchema>;

// ---------------------------------------------------------------------------
// GameEvent — SIM-07: winProbAfter in [0,1] on each event (D-14)
// ---------------------------------------------------------------------------

export const GameEventSchema = z
  .object({
    /** In-game clock timestamp in milliseconds (0 = 00:00) */
    gameTimeMs: z.number().int().min(0),
    /** Real-world playback timestamp relative to match start in ms */
    playbackMs: z.number().int().min(0),
    /** Event type from the locked vocabulary (D-15) */
    type: EventTypeSchema,
    /** Which team triggered this event */
    team: z.enum(["user", "rival"]),
    /** Cumulative user-team win probability after this event [0, 1] (D-14) */
    winProbAfter: z.number().min(0).max(1),

    // --- Rich state-driven fields (Phase 6) — all OPTIONAL so legacy stored
    //     games and the old runMatch path remain valid without them. ---
    /** pt-BR "who did what" line — the primary ticker display when present. */
    ticker: z.string().optional(),
    /** Protagonist display names. */
    actors: z.array(z.string()).optional(),
    /** Victim display names, if any. */
    victims: z.array(z.string()).optional(),
    /** Lane or map region label. */
    lane: z.string().optional(),
    /** Objective involved, if any. */
    objectiveKind: z.string().optional(),
    /** Whether the event was contested by both teams. */
    contested: z.boolean().optional(),
    /** Whether an objective was stolen. */
    stolen: z.boolean().optional(),
    /** Scoreboard snapshot at this event (for the live playback HUD). */
    score: z
      .object({
        userKills: z.number().int().min(0),
        rivalKills: z.number().int().min(0),
        userTowers: z.number().int().min(0),
        rivalTowers: z.number().int().min(0),
        userDragons: z.number().int().min(0),
        rivalDragons: z.number().int().min(0),
        userBaron: z.boolean(),
        rivalBaron: z.boolean(),
        userElder: z.boolean(),
        rivalElder: z.boolean(),
        userGold: z.number().int().min(0),
        rivalGold: z.number().int().min(0),
        /** Elements of the dragons each team has taken, in order. */
        userDragonEls: z.array(z.string()),
        rivalDragonEls: z.array(z.string()),
      })
      .optional(),
    /** Live map snapshot (structures + objective timers) at this event. */
    map: MapSnapshotSchema.optional(),
  })
  .strict();

export type GameEvent = z.infer<typeof GameEventSchema>;

// ---------------------------------------------------------------------------
// MatchInput — inputs to runMatch(input, seed)
// ---------------------------------------------------------------------------

export const MatchInputSchema = z
  .object({
    formVersion: z.literal(1).optional(),
    /** Spec traits no motor (5): false desliga as 6 traits novas (chave do solo). Ausente = ligado. */
    newTraitEffects: z.literal(false).optional(),
    /** User team roster — 5 PlayerVersions, one per role */
    userRoster: z.array(PlayerVersionSchema),
    /** Rival team roster — 5 PlayerVersions, one per role */
    rivalRoster: z.array(PlayerVersionSchema),
    /** playerId → championId assigned for the user team this game */
    userChampions: z.record(z.string(), z.string()),
    /** playerId → championId assigned for the rival team this game */
    rivalChampions: z.record(z.string(), z.string()),
    /** Pre-match speed preset (D-09) */
    speedPreset: SpeedPresetSchema,
    /**
     * Comeback intensity [0, 1] (D-10). Optional — existing Phase 2 callers
     * need no change; runMatch falls back to DEFAULT_CHAOS_LEVEL when absent.
     * Clamped to [0, 1] at validation (T-03-03 mitigation).
     */
    chaosLevel: z.number().min(0).max(1).optional(),
    /**
     * Champion catalogue (SIM-06, D-04). Optional — callers that don't pass it
     * (App.tsx without overrides, scripts/calibrate.ts) keep working unchanged;
     * runMatch then applies NO champion-trait event weighting (trait-neutral).
     * Each entry is validated by ChampionEntrySchema (T-03-07). A championId
     * referenced in userChampions/rivalChampions but absent here is trait-neutral,
     * never a crash (Pitfall 7).
     */
    championCatalogue: z.array(ChampionEntrySchema).optional(),
    /**
     * personId of each team's designated captain (shotcaller), if any. Optional
     * — callers without a captain keep working unchanged. A living captain gives
     * a small in-engine coordination edge (see power.ts). The id matches one of
     * the roster's `personId`s.
     */
    userCaptainPersonId: z.string().optional(),
    rivalCaptainPersonId: z.string().optional(),
  })
  .strict();

export type MatchInput = z.infer<typeof MatchInputSchema>;

// ---------------------------------------------------------------------------
// MatchResult — output of runMatch(input, seed)
// ---------------------------------------------------------------------------

export const MatchResultSchema = z
  .object({
    /** Which team won this game */
    winner: z.enum(["user", "rival"]),
    /** Ordered timeline of game events with timestamps and win probabilities */
    events: z.array(GameEventSchema),
    /** Total real-world playback duration in ms (driven by closeness + preset) */
    totalPlaybackMs: z.number().int().min(0),
  })
  .strict();

export type MatchResult = z.infer<typeof MatchResultSchema>;
