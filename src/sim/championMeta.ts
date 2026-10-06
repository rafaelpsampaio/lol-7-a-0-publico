/**
 * src/sim/championMeta.ts
 *
 * Fonte da verdade do ARCHETYPE de campeao (CHAMP-01). O archetype e uma
 * propriedade INTRINSECA do campeao (nao do player nem do roster), por isso a
 * tabela vive aqui, independente de players.json (D-07).
 *
 * Design (igual PlayerState em matchState.ts: "State is plain TypeScript
 * interfaces, NOT Zod"):
 *  - ChampionMeta e uma interface plana, resolvida uma unica vez no build do
 *    match. Nunca e input de usuario, nunca persiste, nunca cruza a fronteira
 *    de storage/UI. Por isso nao usa Zod.
 *  - NENHUM campo opcional. Todos os 7 campos sempre presentes em toda entrada
 *    (CHAMPION_META, ROLE_DEFAULTS, NEUTRAL_META). Isso evita NaN propagando
 *    quando a engine (Phase 8+) multiplicar por um bias ausente (Armadilha 2).
 *  - championMetaFor e uma lookup PURA: nunca chama rng() nem Math.random
 *    (DET-02). A resolucao por role e a rede de seguranca sempre-finita para
 *    qualquer championId ausente, null ou desconhecido (CHAMP-02).
 *
 * INERTE NA PHASE 7: nada na engine consome estes valores ainda. O plumbing que
 * liga `meta` ao PlayerState e do plano 07-03; o consumo real e Phase 8+.
 *
 * Cobertura (CHAMP-04, escopo expandido pelo usuario no checkpoint 07-01):
 * CHAMPION_META cobre TODOS os campeoes de League of Legends que conhecemos
 * (nao apenas os 73 usados no players.json de teste). Justificativa: o roster
 * atual e temporario; o archetype e propriedade do campeao, entao a tabela deve
 * ser independente do roster e a prova de futuro. O fallback por role continua
 * obrigatorio para campeoes lancados depois desta data (CHAMP-02).
 */

import type { Role } from "../data/schema";

// ---------------------------------------------------------------------------
// Tipos do shape (D-06) — aprovados no checkpoint 07-01
// ---------------------------------------------------------------------------

/** Classe primaria do campeao (a "funcao" mecanica dominante). */
export type ChampionClass =
  | "tank"
  | "fighter"
  | "mage"
  | "assassin"
  | "marksman"
  | "support"
  | "enchanter"
  | "skirmisher"
  | "diver"
  | "engage-support"
  | "poke-support";

/** Etiquetas funcionais (como o campeao gera vantagem no jogo). */
export type ChampionFunctionalTag =
  | "teamfight"
  | "pick"
  | "poke"
  | "siege"
  | "split"
  | "dive"
  | "protect-carry"
  | "early-snowball"
  | "scaling"
  | "front-to-back"
  | "wombo"
  | "disengage"
  | "skirmish"
  | "objective-control"
  | "engage";

/** Como o campeao consome/depende de recursos (ouro, itens). */
export type ChampionEconProfile =
  | "resource-hungry"
  | "self-sufficient"
  | "scaling-dependent"
  | "item-spike";

/** Curva de poder ao longo do jogo. */
export type ChampionScalingCurve = "early" | "mid" | "late" | "hyperscaling";

/**
 * Archetype completo de um campeao. NENHUM campo opcional — todos sempre
 * presentes. Os tres biases numericos sao multiplicadores neutros em 1.0:
 *  - killBias   > 1.0 = tende a levar abates / >1.0 favorece kills proprios
 *  - assistBias > 1.0 = tende a participar de abates (suportes/engage altos)
 *  - deathRisk  > 1.0 = morre mais (mergulha, expoe-se); <1.0 = seguro
 */
export interface ChampionMeta {
  primaryClass: ChampionClass;
  functionalTags: ChampionFunctionalTag[];
  econProfile: ChampionEconProfile;
  scalingCurve: ChampionScalingCurve;
  killBias: number;
  assistBias: number;
  deathRisk: number;
}

// ---------------------------------------------------------------------------
// Neutros — base para fallback (todos os campos explicitos, biases 1.0)
// ---------------------------------------------------------------------------

/** Meta totalmente neutro: nenhum vies, scaling medio, auto-suficiente. */
export const NEUTRAL_META: ChampionMeta = {
  primaryClass: "fighter",
  functionalTags: [],
  econProfile: "self-sufficient",
  scalingCurve: "mid",
  killBias: 1.0,
  assistBias: 1.0,
  deathRisk: 1.0,
};

/**
 * Default neutro por role — rede de seguranca sempre-finita (CHAMP-02). Os 5
 * roles sao explicitos (sem undefined possivel). O support carrega o vies de
 * facilitador proposto na RESEARCH (kill baixo, assist alto, morte um pouco
 * acima) por refletir o papel medio do role na ausencia de archetype.
 */
export const ROLE_DEFAULTS: Record<Role, ChampionMeta> = {
  top: {
    primaryClass: "fighter",
    functionalTags: ["split"],
    econProfile: "self-sufficient",
    scalingCurve: "mid",
    killBias: 1.0,
    assistBias: 0.9,
    deathRisk: 1.0,
  },
  jungle: {
    primaryClass: "skirmisher",
    functionalTags: ["objective-control"],
    econProfile: "self-sufficient",
    scalingCurve: "mid",
    killBias: 1.1,
    assistBias: 1.0,
    deathRisk: 1.0,
  },
  mid: {
    primaryClass: "mage",
    functionalTags: ["teamfight"],
    econProfile: "self-sufficient",
    scalingCurve: "mid",
    killBias: 1.1,
    assistBias: 0.9,
    deathRisk: 1.0,
  },
  adc: {
    primaryClass: "marksman",
    functionalTags: ["teamfight", "front-to-back"],
    econProfile: "resource-hungry",
    scalingCurve: "late",
    killBias: 1.1,
    assistBias: 0.7,
    deathRisk: 0.9,
  },
  support: {
    primaryClass: "support",
    functionalTags: ["protect-carry"],
    econProfile: "self-sufficient",
    scalingCurve: "mid",
    killBias: 0.3,
    assistBias: 2.0,
    deathRisk: 1.2,
  },
};

// ---------------------------------------------------------------------------
// Resolucao sempre-finita (CHAMP-02 / DET-02)
// ---------------------------------------------------------------------------

/**
 * Resolve o ChampionMeta para um championId + role. SEMPRE retorna um meta
 * finito e completo:
 *  - id ausente/null/vazio  -> ROLE_DEFAULTS[role]
 *  - id desconhecido         -> ROLE_DEFAULTS[role]
 *  - id conhecido            -> CHAMPION_META[id]
 *
 * Lookup pura: nunca chama rng() nem Math.random (DET-02). O `??` e branch-free.
 */
export function championMetaFor(
  championId: string | undefined | null,
  role: Role
): ChampionMeta {
  if (!championId) return ROLE_DEFAULTS[role];
  return CHAMPION_META[championId] ?? ROLE_DEFAULTS[role];
}

// ---------------------------------------------------------------------------
// CHAMPION_META — tabela completa de archetypes (preenchida no Task 2)
// ---------------------------------------------------------------------------

/**
 * Archetype intrinseco por championId. Chaves SEMPRE em lowercase-kebab do
 * projeto (`jarvan-iv`, `lee-sin`, `kog-maw`), nunca PascalCase da Data Dragon
 * (Armadilha 4). Cobre todos os campeoes conhecidos (escopo expandido no
 * checkpoint 07-01). Campeoes ausentes caem em ROLE_DEFAULTS via championMetaFor.
 */
export const CHAMPION_META: Record<string, ChampionMeta> = {
  // --- Entradas refinadas na RESEARCH (os 73 do players.json) ---------------
  akali: { primaryClass: "assassin", functionalTags: ["pick", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.4, assistBias: 0.6, deathRisk: 1.2 },
  alistar: { primaryClass: "engage-support", functionalTags: ["teamfight", "dive", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.2, assistBias: 2.0, deathRisk: 1.4 },
  annie: { primaryClass: "support", functionalTags: ["teamfight", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.5, assistBias: 1.6, deathRisk: 1.0 },
  aphelios: { primaryClass: "marksman", functionalTags: ["teamfight", "scaling", "front-to-back"], econProfile: "resource-hungry", scalingCurve: "late", killBias: 1.3, assistBias: 0.5, deathRisk: 0.9 },
  ashe: { primaryClass: "marksman", functionalTags: ["poke", "teamfight", "front-to-back"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 0.9, assistBias: 0.8, deathRisk: 0.8 },
  azir: { primaryClass: "mage", functionalTags: ["teamfight", "siege", "scaling"], econProfile: "resource-hungry", scalingCurve: "late", killBias: 1.1, assistBias: 0.9, deathRisk: 0.9 },
  blitzcrank: { primaryClass: "engage-support", functionalTags: ["pick", "teamfight"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 0.3, assistBias: 1.8, deathRisk: 1.1 },
  braum: { primaryClass: "engage-support", functionalTags: ["teamfight", "protect-carry", "disengage"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.2, assistBias: 2.0, deathRisk: 1.1 },
  caitlyn: { primaryClass: "marksman", functionalTags: ["poke", "siege", "early-snowball"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 1.1, assistBias: 0.6, deathRisk: 0.7 },
  camille: { primaryClass: "diver", functionalTags: ["pick", "split", "skirmish"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.3, assistBias: 0.5, deathRisk: 1.0 },
  cassiopeia: { primaryClass: "mage", functionalTags: ["teamfight", "scaling"], econProfile: "resource-hungry", scalingCurve: "late", killBias: 1.1, assistBias: 0.8, deathRisk: 0.9 },
  corki: { primaryClass: "marksman", functionalTags: ["poke", "siege"], econProfile: "item-spike", scalingCurve: "mid", killBias: 1.0, assistBias: 0.7, deathRisk: 0.8 },
  darius: { primaryClass: "fighter", functionalTags: ["early-snowball", "dive"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.4, assistBias: 0.5, deathRisk: 1.0 },
  draven: { primaryClass: "marksman", functionalTags: ["early-snowball", "skirmish"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.5, assistBias: 0.4, deathRisk: 1.1 },
  ekko: { primaryClass: "skirmisher", functionalTags: ["pick", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.3, assistBias: 0.6, deathRisk: 1.1 },
  elise: { primaryClass: "diver", functionalTags: ["early-snowball", "skirmish"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.3, assistBias: 0.7, deathRisk: 1.0 },
  ezreal: { primaryClass: "marksman", functionalTags: ["poke", "siege"], econProfile: "item-spike", scalingCurve: "mid", killBias: 1.0, assistBias: 0.7, deathRisk: 0.7 },
  fiora: { primaryClass: "fighter", functionalTags: ["split", "skirmish"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.4, assistBias: 0.4, deathRisk: 1.0 },
  galio: { primaryClass: "mage", functionalTags: ["teamfight", "disengage"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.7, assistBias: 1.3, deathRisk: 0.9 },
  gangplank: { primaryClass: "fighter", functionalTags: ["teamfight", "siege", "scaling"], econProfile: "item-spike", scalingCurve: "late", killBias: 1.1, assistBias: 0.7, deathRisk: 1.0 },
  garen: { primaryClass: "fighter", functionalTags: ["early-snowball"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.1, assistBias: 0.5, deathRisk: 0.8 },
  gnar: { primaryClass: "fighter", functionalTags: ["teamfight", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.9, assistBias: 0.9, deathRisk: 0.9 },
  gragas: { primaryClass: "mage", functionalTags: ["teamfight", "dive", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.8, assistBias: 1.1, deathRisk: 1.1 },
  graves: { primaryClass: "skirmisher", functionalTags: ["early-snowball", "objective-control"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.3, assistBias: 0.6, deathRisk: 1.0 },
  hecarim: { primaryClass: "diver", functionalTags: ["early-snowball", "dive", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.7, deathRisk: 1.1 },
  irelia: { primaryClass: "diver", functionalTags: ["early-snowball", "dive", "skirmish"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.4, assistBias: 0.5, deathRisk: 1.2 },
  janna: { primaryClass: "enchanter", functionalTags: ["protect-carry", "disengage"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.2, assistBias: 1.8, deathRisk: 0.8 },
  "jarvan-iv": { primaryClass: "diver", functionalTags: ["teamfight", "dive", "objective-control"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.0, assistBias: 1.0, deathRisk: 1.1 },
  jayce: { primaryClass: "fighter", functionalTags: ["poke", "siege", "skirmish"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.6, deathRisk: 0.9 },
  jhin: { primaryClass: "marksman", functionalTags: ["poke", "teamfight"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 1.1, assistBias: 0.7, deathRisk: 0.7 },
  jinx: { primaryClass: "marksman", functionalTags: ["scaling", "teamfight", "front-to-back"], econProfile: "resource-hungry", scalingCurve: "late", killBias: 1.2, assistBias: 0.6, deathRisk: 0.8 },
  kaisa: { primaryClass: "marksman", functionalTags: ["teamfight", "dive"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 1.2, assistBias: 0.6, deathRisk: 0.9 },
  kennen: { primaryClass: "mage", functionalTags: ["teamfight", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.9, assistBias: 1.0, deathRisk: 0.9 },
  kindred: { primaryClass: "marksman", functionalTags: ["objective-control", "scaling"], econProfile: "self-sufficient", scalingCurve: "late", killBias: 1.1, assistBias: 0.7, deathRisk: 1.0 },
  "kog-maw": { primaryClass: "marksman", functionalTags: ["scaling", "protect-carry", "front-to-back"], econProfile: "resource-hungry", scalingCurve: "hyperscaling", killBias: 1.0, assistBias: 0.7, deathRisk: 0.9 },
  leblanc: { primaryClass: "assassin", functionalTags: ["pick", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.5, assistBias: 0.5, deathRisk: 1.1 },
  "lee-sin": { primaryClass: "skirmisher", functionalTags: ["early-snowball", "dive", "objective-control"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.3, assistBias: 0.7, deathRisk: 1.2 },
  leona: { primaryClass: "engage-support", functionalTags: ["teamfight", "dive", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.2, assistBias: 1.9, deathRisk: 1.3 },
  lillia: { primaryClass: "mage", functionalTags: ["teamfight", "scaling"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.9, assistBias: 1.0, deathRisk: 0.9 },
  lucian: { primaryClass: "marksman", functionalTags: ["early-snowball", "skirmish"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.2, assistBias: 0.6, deathRisk: 0.9 },
  lulu: { primaryClass: "enchanter", functionalTags: ["protect-carry", "disengage"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.3, assistBias: 1.7, deathRisk: 0.8 },
  lux: { primaryClass: "mage", functionalTags: ["poke", "teamfight", "siege"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 0.8, assistBias: 1.1, deathRisk: 0.8 },
  malphite: { primaryClass: "tank", functionalTags: ["teamfight", "wombo", "dive"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.5, assistBias: 1.4, deathRisk: 0.9 },
  morgana: { primaryClass: "support", functionalTags: ["teamfight", "protect-carry"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.6, assistBias: 1.4, deathRisk: 0.9 },
  nautilus: { primaryClass: "engage-support", functionalTags: ["teamfight", "pick", "dive"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.2, assistBias: 1.9, deathRisk: 1.2 },
  nidalee: { primaryClass: "skirmisher", functionalTags: ["early-snowball", "poke"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.3, assistBias: 0.7, deathRisk: 1.2 },
  nunu: { primaryClass: "tank", functionalTags: ["objective-control", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.7, assistBias: 1.2, deathRisk: 1.0 },
  orianna: { primaryClass: "mage", functionalTags: ["teamfight", "wombo"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 0.9, assistBias: 1.1, deathRisk: 0.8 },
  ornn: { primaryClass: "tank", functionalTags: ["teamfight", "engage", "front-to-back"], econProfile: "self-sufficient", scalingCurve: "late", killBias: 0.5, assistBias: 1.4, deathRisk: 1.0 },
  pyke: { primaryClass: "assassin", functionalTags: ["pick", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 1.0, deathRisk: 1.2 },
  rakan: { primaryClass: "enchanter", functionalTags: ["teamfight", "dive", "protect-carry"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.4, assistBias: 1.8, deathRisk: 1.2 },
  "rek-sai": { primaryClass: "diver", functionalTags: ["early-snowball", "dive", "objective-control"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.7, deathRisk: 1.0 },
  rell: { primaryClass: "engage-support", functionalTags: ["teamfight", "dive"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.2, assistBias: 1.9, deathRisk: 1.3 },
  renekton: { primaryClass: "fighter", functionalTags: ["early-snowball", "dive"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.3, assistBias: 0.5, deathRisk: 1.0 },
  rengar: { primaryClass: "assassin", functionalTags: ["pick", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.4, assistBias: 0.5, deathRisk: 1.2 },
  ryze: { primaryClass: "mage", functionalTags: ["teamfight", "scaling"], econProfile: "resource-hungry", scalingCurve: "hyperscaling", killBias: 1.0, assistBias: 0.9, deathRisk: 0.9 },
  seraphine: { primaryClass: "enchanter", functionalTags: ["teamfight", "protect-carry", "poke"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.5, assistBias: 1.6, deathRisk: 0.8 },
  sion: { primaryClass: "tank", functionalTags: ["siege", "teamfight", "front-to-back"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.6, assistBias: 1.2, deathRisk: 1.1 },
  sivir: { primaryClass: "marksman", functionalTags: ["teamfight", "siege", "scaling"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 1.0, assistBias: 0.8, deathRisk: 0.7 },
  syndra: { primaryClass: "mage", functionalTags: ["pick", "early-snowball", "teamfight"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 1.2, assistBias: 0.7, deathRisk: 0.9 },
  thresh: { primaryClass: "support", functionalTags: ["pick", "protect-carry", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.3, assistBias: 1.8, deathRisk: 1.1 },
  tristana: { primaryClass: "marksman", functionalTags: ["early-snowball", "siege"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.5, deathRisk: 0.8 },
  "twisted-fate": { primaryClass: "mage", functionalTags: ["pick", "teamfight", "objective-control"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.1, assistBias: 0.8, deathRisk: 0.9 },
  twitch: { primaryClass: "marksman", functionalTags: ["scaling", "teamfight", "front-to-back"], econProfile: "resource-hungry", scalingCurve: "late", killBias: 1.3, assistBias: 0.6, deathRisk: 0.9 },
  vayne: { primaryClass: "marksman", functionalTags: ["scaling", "split", "pick"], econProfile: "resource-hungry", scalingCurve: "hyperscaling", killBias: 1.2, assistBias: 0.5, deathRisk: 1.0 },
  vi: { primaryClass: "diver", functionalTags: ["dive", "teamfight", "pick"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.1, assistBias: 0.8, deathRisk: 1.1 },
  viego: { primaryClass: "skirmisher", functionalTags: ["pick", "skirmish", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.4, assistBias: 0.5, deathRisk: 1.2 },
  viktor: { primaryClass: "mage", functionalTags: ["teamfight", "siege", "scaling"], econProfile: "resource-hungry", scalingCurve: "late", killBias: 1.0, assistBias: 0.9, deathRisk: 0.9 },
  volibear: { primaryClass: "fighter", functionalTags: ["teamfight", "dive", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.1, assistBias: 0.8, deathRisk: 1.1 },
  warwick: { primaryClass: "fighter", functionalTags: ["objective-control", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.1, assistBias: 0.7, deathRisk: 0.9 },
  xayah: { primaryClass: "marksman", functionalTags: ["teamfight", "scaling", "front-to-back"], econProfile: "resource-hungry", scalingCurve: "late", killBias: 1.1, assistBias: 0.7, deathRisk: 0.8 },
  zed: { primaryClass: "assassin", functionalTags: ["pick", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.5, assistBias: 0.4, deathRisk: 1.1 },
  zoe: { primaryClass: "mage", functionalTags: ["pick", "poke"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.3, assistBias: 0.6, deathRisk: 1.0 },

  // --- Expansao de escopo (checkpoint 07-01): demais campeoes do jogo -------
  // Mesmos criterios de valor da tabela dos 73 (consistencia killBias/assistBias/
  // deathRisk por classe). Inertes na Phase 7 como o resto.
  aatrox: { primaryClass: "fighter", functionalTags: ["teamfight", "dive", "skirmish"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.7, deathRisk: 1.1 },
  ahri: { primaryClass: "mage", functionalTags: ["pick", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.7, deathRisk: 0.9 },
  akshan: { primaryClass: "marksman", functionalTags: ["pick", "early-snowball", "skirmish"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.3, assistBias: 0.6, deathRisk: 1.1 },
  ambessa: { primaryClass: "fighter", functionalTags: ["early-snowball", "dive", "skirmish"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.3, assistBias: 0.5, deathRisk: 1.1 },
  amumu: { primaryClass: "tank", functionalTags: ["teamfight", "wombo", "dive"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.5, assistBias: 1.5, deathRisk: 1.1 },
  anivia: { primaryClass: "mage", functionalTags: ["teamfight", "siege", "scaling"], econProfile: "resource-hungry", scalingCurve: "late", killBias: 1.0, assistBias: 0.9, deathRisk: 0.8 },
  "aurelion-sol": { primaryClass: "mage", functionalTags: ["teamfight", "scaling", "objective-control"], econProfile: "scaling-dependent", scalingCurve: "hyperscaling", killBias: 1.0, assistBias: 0.9, deathRisk: 0.9 },
  aurora: { primaryClass: "mage", functionalTags: ["pick", "skirmish", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.7, deathRisk: 1.0 },
  bard: { primaryClass: "enchanter", functionalTags: ["pick", "protect-carry", "objective-control"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.4, assistBias: 1.7, deathRisk: 1.1 },
  belveth: { primaryClass: "skirmisher", functionalTags: ["objective-control", "scaling", "skirmish"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 1.2, assistBias: 0.6, deathRisk: 1.1 },
  brand: { primaryClass: "mage", functionalTags: ["poke", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.0, assistBias: 1.1, deathRisk: 0.9 },
  briar: { primaryClass: "diver", functionalTags: ["dive", "skirmish", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.3, assistBias: 0.6, deathRisk: 1.3 },
  chogath: { primaryClass: "tank", functionalTags: ["teamfight", "scaling", "front-to-back"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 0.8, assistBias: 1.1, deathRisk: 0.9 },
  diana: { primaryClass: "diver", functionalTags: ["dive", "teamfight", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.8, deathRisk: 1.1 },
  "dr-mundo": { primaryClass: "tank", functionalTags: ["front-to-back", "split", "scaling"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 0.8, assistBias: 0.7, deathRisk: 0.9 },
  evelynn: { primaryClass: "assassin", functionalTags: ["pick", "scaling", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.5, assistBias: 0.5, deathRisk: 1.1 },
  fiddlesticks: { primaryClass: "mage", functionalTags: ["teamfight", "wombo", "objective-control"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.9, assistBias: 1.2, deathRisk: 1.0 },
  fizz: { primaryClass: "assassin", functionalTags: ["pick", "dive", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.4, assistBias: 0.5, deathRisk: 1.2 },
  gwen: { primaryClass: "skirmisher", functionalTags: ["split", "skirmish", "scaling"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 1.2, assistBias: 0.5, deathRisk: 1.0 },
  heimerdinger: { primaryClass: "mage", functionalTags: ["siege", "poke", "objective-control"], econProfile: "resource-hungry", scalingCurve: "late", killBias: 0.9, assistBias: 1.0, deathRisk: 0.8 },
  hwei: { primaryClass: "mage", functionalTags: ["poke", "teamfight", "siege"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 0.9, assistBias: 1.0, deathRisk: 0.8 },
  illaoi: { primaryClass: "fighter", functionalTags: ["split", "teamfight", "skirmish"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.6, deathRisk: 1.0 },
  ivern: { primaryClass: "enchanter", functionalTags: ["protect-carry", "objective-control", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.2, assistBias: 1.9, deathRisk: 0.9 },
  jax: { primaryClass: "skirmisher", functionalTags: ["split", "skirmish", "scaling"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 1.3, assistBias: 0.5, deathRisk: 1.0 },
  kalista: { primaryClass: "marksman", functionalTags: ["skirmish", "early-snowball", "objective-control"], econProfile: "resource-hungry", scalingCurve: "early", killBias: 1.1, assistBias: 0.7, deathRisk: 1.0 },
  karma: { primaryClass: "enchanter", functionalTags: ["poke", "protect-carry", "disengage"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.5, assistBias: 1.6, deathRisk: 0.8 },
  karthus: { primaryClass: "mage", functionalTags: ["teamfight", "scaling", "objective-control"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 1.2, assistBias: 0.8, deathRisk: 0.9 },
  kassadin: { primaryClass: "assassin", functionalTags: ["pick", "scaling"], econProfile: "scaling-dependent", scalingCurve: "hyperscaling", killBias: 1.3, assistBias: 0.5, deathRisk: 0.9 },
  katarina: { primaryClass: "assassin", functionalTags: ["pick", "teamfight", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.5, assistBias: 0.5, deathRisk: 1.2 },
  kayle: { primaryClass: "marksman", functionalTags: ["scaling", "split", "front-to-back"], econProfile: "scaling-dependent", scalingCurve: "hyperscaling", killBias: 1.1, assistBias: 0.6, deathRisk: 0.9 },
  kayn: { primaryClass: "skirmisher", functionalTags: ["pick", "dive", "scaling"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.4, assistBias: 0.5, deathRisk: 1.1 },
  khazix: { primaryClass: "assassin", functionalTags: ["pick", "early-snowball", "skirmish"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.5, assistBias: 0.4, deathRisk: 1.1 },
  kled: { primaryClass: "fighter", functionalTags: ["early-snowball", "dive", "teamfight"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.2, assistBias: 0.7, deathRisk: 1.1 },
  "k-sante": { primaryClass: "tank", functionalTags: ["teamfight", "front-to-back", "split"], econProfile: "self-sufficient", scalingCurve: "late", killBias: 0.7, assistBias: 1.2, deathRisk: 0.9 },
  lissandra: { primaryClass: "mage", functionalTags: ["pick", "teamfight", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.8, assistBias: 1.2, deathRisk: 0.9 },
  locke: { primaryClass: "assassin", functionalTags: ["pick", "early-snowball", "skirmish"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.4, assistBias: 0.5, deathRisk: 1.1 },
  malzahar: { primaryClass: "mage", functionalTags: ["pick", "siege", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.0, assistBias: 0.9, deathRisk: 0.8 },
  maokai: { primaryClass: "tank", functionalTags: ["teamfight", "engage", "objective-control"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.4, assistBias: 1.6, deathRisk: 1.0 },
  "master-yi": { primaryClass: "skirmisher", functionalTags: ["split", "scaling", "skirmish"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 1.5, assistBias: 0.3, deathRisk: 1.1 },
  mel: { primaryClass: "mage", functionalTags: ["poke", "teamfight", "disengage"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 0.9, assistBias: 1.0, deathRisk: 0.8 },
  milio: { primaryClass: "enchanter", functionalTags: ["protect-carry", "disengage"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.2, assistBias: 1.8, deathRisk: 0.8 },
  "miss-fortune": { primaryClass: "marksman", functionalTags: ["teamfight", "poke", "wombo"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 1.1, assistBias: 0.7, deathRisk: 0.8 },
  mordekaiser: { primaryClass: "fighter", functionalTags: ["pick", "teamfight", "front-to-back"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.1, assistBias: 0.8, deathRisk: 1.0 },
  naafiri: { primaryClass: "assassin", functionalTags: ["pick", "early-snowball", "skirmish"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.4, assistBias: 0.5, deathRisk: 1.1 },
  nami: { primaryClass: "enchanter", functionalTags: ["protect-carry", "poke", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.4, assistBias: 1.7, deathRisk: 0.9 },
  nasus: { primaryClass: "fighter", functionalTags: ["split", "scaling", "front-to-back"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 1.0, assistBias: 0.6, deathRisk: 0.9 },
  neeko: { primaryClass: "mage", functionalTags: ["pick", "teamfight", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.9, assistBias: 1.1, deathRisk: 1.0 },
  nilah: { primaryClass: "skirmisher", functionalTags: ["teamfight", "skirmish", "scaling"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 1.2, assistBias: 0.6, deathRisk: 1.1 },
  nocturne: { primaryClass: "assassin", functionalTags: ["pick", "dive", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.4, assistBias: 0.5, deathRisk: 1.1 },
  olaf: { primaryClass: "fighter", functionalTags: ["early-snowball", "dive", "skirmish"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.3, assistBias: 0.5, deathRisk: 1.1 },
  pantheon: { primaryClass: "fighter", functionalTags: ["early-snowball", "dive", "pick"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.3, assistBias: 0.6, deathRisk: 1.0 },
  poppy: { primaryClass: "tank", functionalTags: ["disengage", "teamfight", "pick"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.6, assistBias: 1.3, deathRisk: 0.9 },
  qiyana: { primaryClass: "assassin", functionalTags: ["pick", "wombo", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.4, assistBias: 0.6, deathRisk: 1.2 },
  quinn: { primaryClass: "marksman", functionalTags: ["pick", "split", "early-snowball"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.3, assistBias: 0.5, deathRisk: 1.0 },
  rammus: { primaryClass: "tank", functionalTags: ["dive", "pick", "objective-control"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.6, assistBias: 1.3, deathRisk: 0.9 },
  renata: { primaryClass: "enchanter", functionalTags: ["teamfight", "disengage", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.3, assistBias: 1.8, deathRisk: 1.0 },
  riven: { primaryClass: "fighter", functionalTags: ["early-snowball", "skirmish", "split"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.4, assistBias: 0.5, deathRisk: 1.1 },
  rumble: { primaryClass: "mage", functionalTags: ["teamfight", "wombo", "siege"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.9, assistBias: 1.1, deathRisk: 0.9 },
  samira: { primaryClass: "marksman", functionalTags: ["teamfight", "dive", "early-snowball"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 1.4, assistBias: 0.6, deathRisk: 1.2 },
  sejuani: { primaryClass: "tank", functionalTags: ["teamfight", "engage", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.5, assistBias: 1.5, deathRisk: 1.0 },
  senna: { primaryClass: "marksman", functionalTags: ["poke", "scaling", "protect-carry"], econProfile: "scaling-dependent", scalingCurve: "hyperscaling", killBias: 0.9, assistBias: 1.1, deathRisk: 0.8 },
  sett: { primaryClass: "fighter", functionalTags: ["teamfight", "dive", "front-to-back"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.1, assistBias: 0.8, deathRisk: 1.0 },
  shaco: { primaryClass: "assassin", functionalTags: ["pick", "early-snowball", "split"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.4, assistBias: 0.5, deathRisk: 1.0 },
  shen: { primaryClass: "tank", functionalTags: ["protect-carry", "split", "teamfight"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.6, assistBias: 1.4, deathRisk: 0.9 },
  shyvana: { primaryClass: "fighter", functionalTags: ["dive", "scaling", "objective-control"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 1.1, assistBias: 0.6, deathRisk: 1.0 },
  singed: { primaryClass: "tank", functionalTags: ["split", "disengage", "scaling"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.7, assistBias: 0.9, deathRisk: 1.0 },
  skarner: { primaryClass: "diver", functionalTags: ["pick", "teamfight", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.8, assistBias: 1.2, deathRisk: 1.1 },
  smolder: { primaryClass: "marksman", functionalTags: ["scaling", "poke", "front-to-back"], econProfile: "scaling-dependent", scalingCurve: "hyperscaling", killBias: 1.1, assistBias: 0.6, deathRisk: 0.8 },
  sona: { primaryClass: "enchanter", functionalTags: ["protect-carry", "poke", "wombo"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 0.3, assistBias: 1.8, deathRisk: 0.9 },
  soraka: { primaryClass: "enchanter", functionalTags: ["protect-carry", "scaling"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.2, assistBias: 1.9, deathRisk: 0.9 },
  swain: { primaryClass: "mage", functionalTags: ["teamfight", "front-to-back", "poke"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.9, assistBias: 1.2, deathRisk: 0.9 },
  sylas: { primaryClass: "skirmisher", functionalTags: ["teamfight", "skirmish", "dive"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.8, deathRisk: 1.1 },
  "tahm-kench": { primaryClass: "tank", functionalTags: ["protect-carry", "teamfight", "disengage"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.4, assistBias: 1.5, deathRisk: 0.8 },
  taliyah: { primaryClass: "mage", functionalTags: ["teamfight", "wombo", "objective-control"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.0, assistBias: 1.0, deathRisk: 0.9 },
  talon: { primaryClass: "assassin", functionalTags: ["pick", "early-snowball", "split"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.5, assistBias: 0.4, deathRisk: 1.1 },
  taric: { primaryClass: "enchanter", functionalTags: ["protect-carry", "teamfight", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.3, assistBias: 1.8, deathRisk: 1.0 },
  teemo: { primaryClass: "marksman", functionalTags: ["split", "poke", "pick"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.1, assistBias: 0.6, deathRisk: 0.9 },
  trundle: { primaryClass: "fighter", functionalTags: ["split", "dive", "objective-control"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.1, assistBias: 0.7, deathRisk: 1.0 },
  tryndamere: { primaryClass: "skirmisher", functionalTags: ["split", "scaling", "skirmish"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 1.3, assistBias: 0.4, deathRisk: 1.1 },
  udyr: { primaryClass: "fighter", functionalTags: ["dive", "objective-control", "skirmish"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.6, deathRisk: 1.0 },
  urgot: { primaryClass: "fighter", functionalTags: ["teamfight", "front-to-back", "pick"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.1, assistBias: 0.7, deathRisk: 1.0 },
  varus: { primaryClass: "marksman", functionalTags: ["poke", "teamfight", "pick"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 1.1, assistBias: 0.8, deathRisk: 0.8 },
  veigar: { primaryClass: "mage", functionalTags: ["pick", "scaling", "teamfight"], econProfile: "scaling-dependent", scalingCurve: "hyperscaling", killBias: 1.2, assistBias: 0.7, deathRisk: 0.9 },
  velkoz: { primaryClass: "mage", functionalTags: ["poke", "siege", "teamfight"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 0.9, assistBias: 1.0, deathRisk: 0.8 },
  vex: { primaryClass: "mage", functionalTags: ["pick", "teamfight", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.1, assistBias: 0.9, deathRisk: 0.9 },
  vladimir: { primaryClass: "mage", functionalTags: ["teamfight", "scaling", "front-to-back"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 1.0, assistBias: 0.9, deathRisk: 0.9 },
  "monkey-king": { primaryClass: "diver", functionalTags: ["dive", "teamfight", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.8, deathRisk: 1.1 },
  xerath: { primaryClass: "mage", functionalTags: ["poke", "siege", "teamfight"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 0.9, assistBias: 1.0, deathRisk: 0.7 },
  "xin-zhao": { primaryClass: "diver", functionalTags: ["early-snowball", "dive", "skirmish"], econProfile: "self-sufficient", scalingCurve: "early", killBias: 1.3, assistBias: 0.6, deathRisk: 1.1 },
  yasuo: { primaryClass: "skirmisher", functionalTags: ["teamfight", "wombo", "skirmish"], econProfile: "scaling-dependent", scalingCurve: "mid", killBias: 1.3, assistBias: 0.6, deathRisk: 1.1 },
  yone: { primaryClass: "skirmisher", functionalTags: ["teamfight", "wombo", "skirmish"], econProfile: "scaling-dependent", scalingCurve: "mid", killBias: 1.3, assistBias: 0.6, deathRisk: 1.1 },
  yorick: { primaryClass: "fighter", functionalTags: ["split", "siege", "scaling"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.1, assistBias: 0.5, deathRisk: 0.9 },
  yunara: { primaryClass: "marksman", functionalTags: ["scaling", "teamfight", "front-to-back"], econProfile: "resource-hungry", scalingCurve: "late", killBias: 1.2, assistBias: 0.6, deathRisk: 0.9 },
  yuumi: { primaryClass: "enchanter", functionalTags: ["protect-carry", "scaling", "poke"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 0.2, assistBias: 1.9, deathRisk: 0.5 },
  zaahen: { primaryClass: "diver", functionalTags: ["dive", "early-snowball", "objective-control"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 1.2, assistBias: 0.7, deathRisk: 1.1 },
  zac: { primaryClass: "tank", functionalTags: ["teamfight", "engage", "dive"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.5, assistBias: 1.5, deathRisk: 1.1 },
  zeri: { primaryClass: "marksman", functionalTags: ["scaling", "skirmish", "front-to-back"], econProfile: "scaling-dependent", scalingCurve: "late", killBias: 1.2, assistBias: 0.6, deathRisk: 0.9 },
  ziggs: { primaryClass: "mage", functionalTags: ["poke", "siege", "objective-control"], econProfile: "resource-hungry", scalingCurve: "mid", killBias: 1.0, assistBias: 0.8, deathRisk: 0.8 },
  zilean: { primaryClass: "enchanter", functionalTags: ["protect-carry", "pick", "disengage"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.5, assistBias: 1.6, deathRisk: 0.8 },
  zyra: { primaryClass: "mage", functionalTags: ["poke", "teamfight", "wombo"], econProfile: "self-sufficient", scalingCurve: "mid", killBias: 0.9, assistBias: 1.1, deathRisk: 0.9 },
};
