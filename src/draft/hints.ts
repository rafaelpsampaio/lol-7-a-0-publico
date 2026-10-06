/**
 * src/draft/hints.ts
 *
 * Pre-pick PUBLIC hint derivation for the draft (Phase 2 — DRFT).
 *
 * The draft screen must show ONLY position, tags, year/phase, style and a short
 * description BEFORE a pick; full numeric stats (lanePhase/midGame/lateGame,
 * roleStrength) are revealed AFTER the pick. This module turns a PlayerVersion
 * into that public-safe `PublicHints` view.
 *
 * Authored data may set `tags` / `style` / `shortDescription` on the card
 * (optional schema fields). When absent we DERIVE them deterministically from
 * the card so no data migration is required and the pre-pick view never leaks
 * raw numbers. Pure + deterministic — safe in tests.
 */

import type { PlayerVersion, PlayerTrait, Role } from "../data/schema";

// ---------------------------------------------------------------------------
// pt-BR label maps (shared by the draft UI)
// ---------------------------------------------------------------------------

/** Role display labels (uppercase short form for badges). */
export const ROLE_LABELS: Record<Role, string> = {
  top: "TOP",
  jungle: "JGL",
  mid: "MID",
  adc: "ADC",
  support: "SUP",
};

/** Role display labels (long pt-BR form for prose). */
export const ROLE_LONG_LABELS: Record<Role, string> = {
  top: "Topo",
  jungle: "Caçador",
  mid: "Meio",
  adc: "Atirador",
  support: "Suporte",
};

/** pt-BR labels for every player trait (covers the full catalogue). */
export const TRAIT_LABELS: Record<PlayerTrait, string> = {
  tilts_on_death: "Tilta ao morrer",
  plays_worse_when_behind: "Piora atrás",
  clutch_player: "Clutch",
  objective_focused: "Foco em objetivos",
  baron_stealer: "Rouba barão",
  strong_laner: "Forte na lane",
  mental_fort: "Cabeça fria",
  lane_bully: "Bully de lane",
  trash_talker: "Provocador",
  // Pack dos amigos (A-04): mesmos rotulos do TRAIT_INFO
  teamfights: "Bom de teamfight",
  flips: "Flipa a lane",
  dragon_lover: "Ama dragão",
  roamer: "Roamer",
  side: "Joga side",
  quits: "Quita",
};

// ---------------------------------------------------------------------------
// PublicHints — the only fields shown BEFORE a pick (DRFT)
// ---------------------------------------------------------------------------

export interface PublicHints {
  position: Role;
  /** Short uppercase role badge, e.g. "MID". */
  positionLabel: string;
  /** Ano da carta; ausente quando a carta nao tem (A-06). */
  year?: number;
  /** Inferred game phase this card peaks in. */
  phase: "Início" | "Meio" | "Fim" | "Versátil";
  /** 2–4 short tags (trait labels + phase). */
  tags: string[];
  /** Short play-style label, e.g. "Carregador de late". */
  style: string;
  /** One-line pt-BR blurb — never reveals raw numbers. */
  shortDescription: string;
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/** Which game phase the card peaks in, with a "Versátil" band when close. */
function inferPhase(p: PlayerVersion): PublicHints["phase"] {
  const { lanePhase, midGame, lateGame } = p;
  const max = Math.max(lanePhase, midGame, lateGame);
  const min = Math.min(lanePhase, midGame, lateGame);
  // Tight spread → no single phase dominates.
  if (max - min <= 4) return "Versátil";
  if (max === lanePhase) return "Início";
  if (max === midGame) return "Meio";
  return "Fim";
}

/** Deterministic style label from the peak phase + a leading trait, if any. */
function deriveStyle(p: PlayerVersion, phase: PublicHints["phase"]): string {
  // A few traits carry a strong stylistic signature — prefer those.
  if (p.traits.includes("lane_bully")) return "Bully de lane";
  if (p.traits.includes("baron_stealer")) return "Especialista em objetivos";
  if (p.traits.includes("objective_focused")) return "Macro e objetivos";
  if (p.traits.includes("clutch_player")) return "Clutch em teamfight";
  switch (phase) {
    case "Início":
      return "Dominador de rota";
    case "Meio":
      return "Controlador de meio-jogo";
    case "Fim":
      return "Carregador de late";
    default:
      return "Versátil";
  }
}

/** Deterministic, number-free pt-BR blurb. */
function deriveDescription(
  p: PlayerVersion,
  phase: PublicHints["phase"],
  style: string
): string {
  const role = ROLE_LONG_LABELS[p.primaryRole];
  const phaseProse: Record<PublicHints["phase"], string> = {
    Início: "brilha cedo e quer abrir vantagem na rota",
    Meio: "decide o jogo nas rotações do meio-jogo",
    Fim: "cresce com o tempo e domina as lutas finais",
    Versátil: "se adapta a qualquer fase da partida",
  };
  return `${role} · ${style.toLowerCase()}; ${phaseProse[phase]}.`;
}

/** Build the up-to-4 tag chips shown pre-pick. */
function deriveTags(p: PlayerVersion, phase: PublicHints["phase"]): string[] {
  if (p.tags && p.tags.length > 0) return p.tags.slice(0, 6);
  const tags: string[] = [phase];
  for (const t of p.traits) tags.push(TRAIT_LABELS[t]);
  return tags.slice(0, 4);
}

/**
 * Turn a PlayerVersion into its pre-pick PUBLIC view. Uses authored
 * tags/style/shortDescription when present, else derives them. Never includes
 * any raw numeric rating.
 */
export function playerHints(p: PlayerVersion): PublicHints {
  const phase = inferPhase(p);
  const style = p.style ?? deriveStyle(p, phase);
  const shortDescription =
    p.shortDescription ?? deriveDescription(p, phase, style);
  return {
    position: p.primaryRole,
    positionLabel: ROLE_LABELS[p.primaryRole],
    year: p.year,
    phase,
    tags: deriveTags(p, phase),
    style,
    shortDescription,
  };
}

/** Linha "ano · fase" da carta, sem o ano quando a carta nao tem (A-06). */
export function cardMetaLine(h: PublicHints): string {
  return h.year === undefined ? h.phase : `${h.year} · ${h.phase}`;
}
