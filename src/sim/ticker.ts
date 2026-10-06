import { playerName } from "../data/playerPresentation";
/**
 * src/sim/ticker.ts
 *
 * Phase 5/6 — pt-BR ticker phrasing. Always "[quem] + [verbo] + [o quê] +
 * [em quem/onde]" so every line shows a protagonist (pesquisa.md).
 *
 * Pure string builders — no state mutation. Phase 6 enriches the vocabulary and
 * maps the rich SimEvent to the persisted GameEvent.
 */

import type { PlayerVersion } from "../data/schema";
import type { Lane } from "./matchState";
import type { Region } from "./simEvents";
import type { DragonElement } from "./matchState";

/** "Faker 2016" → "Faker"; "Hans Sama 2022" → "Hans Sama". */
export function shortName(card: PlayerVersion): string {
  return playerName(card);
}

/** pt-BR lane / region label for prose. */
export function placeLabel(place: Lane | Region | null): string {
  switch (place) {
    case "top":
      return "no topo";
    case "mid":
      return "no meio";
    case "bot":
      return "no bot";
    case "river_top":
      return "no rio superior";
    case "river_bot":
      return "no rio inferior";
    case "top_jg":
      return "na selva superior";
    case "bot_jg":
      return "na selva inferior";
    case "base":
      return "na base";
    default:
      return "";
  }
}

const DRAGON_LABELS: Record<DragonElement, string> = {
  infernal: "Infernal",
  mountain: "da Montanha",
  ocean: "do Oceano",
  cloud: "das Nuvens",
  hextech: "Hextech",
  chemtech: "Chemtech",
};

export function dragonLabel(el: DragonElement | null): string {
  return el ? `Dragão ${DRAGON_LABELS[el]}` : "Dragão";
}

export function soulLabel(el: DragonElement | null): string {
  return el ? `Alma ${DRAGON_LABELS[el]}` : "Alma do Dragão";
}
