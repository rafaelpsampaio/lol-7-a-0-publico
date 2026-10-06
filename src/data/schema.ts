/**
 * src/data/schema.ts
 *
 * Single source of truth for the LoL 7 a 0 data model.
 * All TypeScript types are derived via z.infer — never hand-written.
 *
 * Design decisions locked here (see PLAN 01-01):
 *   D-S1: explicit `primaryRole: Role` field (not implicit roles[0])
 *   D-S2: `roleStrength: Record<Role, 0-100>` — all five keys required; unplayed roles carry 0
 *   D-S3: 9-trait catalogue enum (max 2 per card; extended to 9 in Phase 3 with trash_talker)
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

export const RoleSchema = z.enum(["top", "jungle", "mid", "adc", "support"]);

export type Role = z.infer<typeof RoleSchema>;

// ---------------------------------------------------------------------------
// Mastery — literal union 1-5 (rejects 0 and 6)
// ---------------------------------------------------------------------------

export const MasterySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export type Mastery = z.infer<typeof MasterySchema>;

// ---------------------------------------------------------------------------
// Player trait catalogue (D-S3 — DATA-04)
// Max MAX_PLAYER_TRAITS (4) per card (A-05 do pack dos amigos; era 2).
// ---------------------------------------------------------------------------

export const PlayerTraitSchema = z.enum([
  "tilts_on_death",
  "plays_worse_when_behind",
  "clutch_player",
  "objective_focused",
  "baron_stealer",
  "strong_laner",
  "mental_fort",
  "lane_bully",
  // D-06: first cross-team trait — modifies the opponent (added Phase 3)
  "trash_talker",
  // Pack dos amigos (A-04, 2026-10-02): catalogadas SEM efeito na simulacao
  // ainda. O motor ignora traits sem entrada nos seus mapas (Partial/default).
  "teamfights",
  "flips",
  "dragon_lover",
  "roamer",
  "side",
  "quits",
]);

export type PlayerTrait = z.infer<typeof PlayerTraitSchema>;

/** Teto de traits por carta (A-05; era 2). Traits de campeao seguem com 2. */
export const MAX_PLAYER_TRAITS = 4;

// ---------------------------------------------------------------------------
// ChampionMastery
// ---------------------------------------------------------------------------

export const ChampionMasterySchema = z
  .object({
    championId: z.string().min(1),
    mastery: MasterySchema,
  })
  .strict();

export type ChampionMastery = z.infer<typeof ChampionMasterySchema>;

// ---------------------------------------------------------------------------
// AdvancedFieldsSchema — bloco `advanced` opcional do card (REG-01 / D-04 / D-15)
//
// Os 11 campos avancados de persona (D-04) vivem num sub-schema aninhado e
// OPCIONAL para manter o topo do PlayerVersion limpo (D-15) e o cadastro simples
// (REG). Cada campo e `z.number().min(0).max(1).optional()` — escala 0.0-1.0 — e
// TODOS sao opcionais: um campo novo NUNCA pode ser obrigatorio, senao o
// players.json atual deixaria de parsear (REG-01/D-16; guardado pelo round-trip
// em schema.test.ts). Ganchos neutros D-14: `notes` (texto livre, max 500) e
// `tags` (ate 10 etiquetas curtas). `.strict()` rejeita qualquer chave nao
// declarada dentro de advanced (T-07-06). PROIBIDO pre-criar campos de
// microMetrics/lane/KDA aqui (D-14) — sao escopo de fases futuras.
// ---------------------------------------------------------------------------

export const AdvancedFieldsSchema = z
  .object({
    /** Apetite a risco geral (0 cauteloso .. 1 agressivo). */
    riskProfile: z.number().min(0).max(1).optional(),
    /** Quanto o jogador exige de recursos do time (ouro/farm/atencao). */
    resourceDemand: z.number().min(0).max(1).optional(),
    /** Tolerancia a jogar o lado fraco com desvantagem. */
    weaksideTolerance: z.number().min(0).max(1).optional(),
    /** Potencial de carregar o jogo nas costas. */
    carryPotential: z.number().min(0).max(1).optional(),
    /** Volatilidade do resultado (consistente .. imprevisivel). */
    volatility: z.number().min(0).max(1).optional(),
    /** Capacidade de shotcalling / lideranca de calls. */
    shotcalling: z.number().min(0).max(1).optional(),
    /** Tendencia a roamar / abandonar a lane. */
    roamTendency: z.number().min(0).max(1).optional(),
    /** Disciplina de side lane (fica onde deve, joga o mapa certo). */
    sideLaneDiscipline: z.number().min(0).max(1).optional(),
    /** Vies para abates (busca a kill). */
    killBias: z.number().min(0).max(1).optional(),
    /** Vies para assistencias (joga pro time). */
    assistBias: z.number().min(0).max(1).optional(),
    /** Risco de morte (quanto morre). */
    deathRisk: z.number().min(0).max(1).optional(),

    /** Gancho neutro D-14: anotacoes livres do usuario sobre a persona. */
    notes: z.string().max(500).optional(),
    /** Gancho neutro D-14: etiquetas livres (ate 10, cada uma 1-30 chars). */
    tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  })
  .strict();

export type AdvancedFields = z.infer<typeof AdvancedFieldsSchema>;

// ---------------------------------------------------------------------------
// PlayerVersionSchema — full player card (DATA-01 to DATA-04)
// ---------------------------------------------------------------------------

export const PlayerVersionSchema = z
  .object({
    /** Unique card identifier, e.g. "faker-2016" */
    id: z.string().min(1),

    /** Person-level identifier for roster uniqueness, e.g. "faker" (DRFT-02) */
    personId: z.string().min(1),

    /** Display name shown in UI, e.g. "Faker 2016" */
    displayName: z.string().min(1),

    /**
     * Ano da carta (2011–2035). Opcional (A-06): carta sem ano nao mostra ano.
     */
    year: z.number().int().min(2011).max(2035).optional(),

    /**
     * Optional player photo (a data: URL or asset path). A property of the
     * PERSON: the Player Editor stores photos keyed by personId and applies the
     * same photo to every card sharing that personId. Optional so players.json
     * and generated/bot cards need no photo.
     */
    photo: z.string().min(1).optional(),

    /** Playable roles — at least 1, at most 5 */
    roles: z.array(RoleSchema).min(1).max(5),

    /**
     * D-S1: Explicit primary role field.
     * Unambiguous for Phase 2 draft slotting; immune to array-reorder bugs.
     */
    primaryRole: RoleSchema,

    /**
     * D-S2: Strength per role as a complete map — all five role keys required.
     * Unplayed roles carry explicit 0. Validates cleanly with fixed keys.
     */
    roleStrength: z.object({
      top: z.number().int().min(0).max(100),
      jungle: z.number().int().min(0).max(100),
      mid: z.number().int().min(0).max(100),
      adc: z.number().int().min(0).max(100),
      support: z.number().int().min(0).max(100),
    }),

    /** Lane phase overall (1–100) — DATA-02 */
    lanePhase: z.number().int().min(1).max(100),

    /** Mid game overall (1–100) — DATA-02 */
    midGame: z.number().int().min(1).max(100),

    /** Late game overall (1–100) — DATA-02 */
    lateGame: z.number().int().min(1).max(100),

    /**
     * Player traits: catalogue above, max MAX_PLAYER_TRAITS (4) per card (A-05).
     */
    traits: z.array(PlayerTraitSchema).max(MAX_PLAYER_TRAITS),

    /**
     * Pre-pick PUBLIC hints (Phase 2 draft — DRFT). Optional; when absent they
     * are DERIVED from the card (see src/draft/hints.ts) so authored data is
     * never required. The draft screen shows ONLY these (position, tags, year,
     * style, short description) BEFORE a pick — full stats are revealed AFTER.
     */
    tags: z.array(z.string().min(1)).max(6).optional(),
    /** Short play-style label shown pre-pick, e.g. "Carry de teamfight". */
    style: z.string().min(1).max(40).optional(),
    /** One-line pt-BR blurb shown pre-pick. Never reveals raw numbers. */
    shortDescription: z.string().min(1).max(160).optional(),

    /**
     * Champion pool with mastery 1–5 per champion.
     * Minimum 8 required for fearless Bo5 draft (DATA-03).
     */
    championPool: z
      .array(ChampionMasterySchema)
      .min(8, {
        error:
          "Champion pool must have at least 8 champions (required for fearless Bo5 draft)",
      }),

    /**
     * Bloco avancado opcional de persona (REG-01 / D-04 / D-15). Aninhado e
     * opcional para nao inflar o topo do card nem quebrar o players.json atual
     * (que nao tem este campo). Phase 14 escrevera presets por aqui via
     * overrides; a engine ainda nao le este bloco.
     */
    advanced: AdvancedFieldsSchema.optional(),
  })
  .strict();

export type PlayerVersion = z.infer<typeof PlayerVersionSchema>;

// ---------------------------------------------------------------------------
// PlayerDatabaseSchema — root schema for players.json
// ---------------------------------------------------------------------------

export const PlayerDatabaseSchema = z
  .object({
    /**
     * Convenience key: allows $schema field in players.json for VS Code autocomplete.
     * Explicitly listed so .strict() does not reject it.
     */
    $schema: z.string().optional(),

    /** Nome do pacote (spec 2026-10-05-editor-de-pacotes-design, secao 5). Sem nome, vale o id. */
    name: z.string().min(1).max(60).optional(),

    players: z.array(PlayerVersionSchema),
  })
  .strict();

export type PlayerDatabase = z.infer<typeof PlayerDatabaseSchema>;

// ---------------------------------------------------------------------------
// ChampionTrait — 5-trait champion catalogue (D-04)
// A property of the champion, shared across all players picking it (D-01).
// ---------------------------------------------------------------------------

export const ChampionTraitSchema = z.enum([
  "high_first_blood",
  "objective_control",
  "late_scaling",
  "early_dominant",
  "teamfight",
]);

export type ChampionTrait = z.infer<typeof ChampionTraitSchema>;

// ---------------------------------------------------------------------------
// ChampionEntry — one row in champions.json
// ---------------------------------------------------------------------------

export const ChampionEntrySchema = z
  .object({
    /** Canonical ID matching players.json championId (lowercase-kebab-case) */
    id: z.string().min(1),

    /** Display name from Data Dragon */
    name: z.string().min(1),

    /** Derived champion traits — 0, 1, or 2 entries (max(2) per D-02) */
    traits: z.array(ChampionTraitSchema).max(2),

    /**
     * Data Dragon square-asset filename (e.g. "Aatrox.png").
     * Served locally from public/champions/{image} — no runtime CDN call (INTG-02).
     * Added in Phase 4 Plan 01 (PLAY-03 portrait infrastructure).
     */
    image: z.string().min(1).optional(),
  })
  .strict();

export type ChampionEntry = z.infer<typeof ChampionEntrySchema>;

// ---------------------------------------------------------------------------
// ChampionCatalogueSchema — root schema for champions.json (D-01)
// ---------------------------------------------------------------------------

export const ChampionCatalogueSchema = z
  .object({
    /**
     * Convenience key: allows $schema field in champions.json for VS Code
     * autocomplete. Explicitly listed so .strict() does not reject it.
     */
    $schema: z.string().optional(),

    champions: z.array(ChampionEntrySchema),
  })
  .strict();

export type ChampionCatalogue = z.infer<typeof ChampionCatalogueSchema>;
