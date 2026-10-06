/**
 * src/data/traitInfo.ts
 *
 * Shared pt-BR metadata for the player-trait catalogue (Feature 3c).
 *
 * For every `PlayerTrait` this exports a `label` (short chip text) and a one-line
 * `description` of WHAT THE TRAIT DOES in the simulation. This is the single
 * source of truth read by the Player Editor (tooltip / subtitle), the draft hints,
 * and the engine stream, so the displayed effect always matches intent.
 *
 * Dependency-light by design: imports ONLY the `PlayerTrait` type from schema, so
 * the engine and UI streams can consume it without dragging in store/UI code.
 */

import type { PlayerTrait } from "./schema";

/** pt-BR label + sim-effect description for one player trait. */
export interface TraitInfo {
  /** Short chip / badge text (pt-BR). */
  label: string;
  /** One-line pt-BR description of what the trait does in the sim. */
  description: string;
  /** Rotulos antigos ainda aceitos na importacao de planilha. */
  aliases?: string[];
}

/**
 * Catalogue metadata for all player traits. Keyed by the `PlayerTrait` enum value;
 * `Record` typing guarantees every trait is covered (a missing key is a type error).
 */
export const TRAIT_INFO: Record<PlayerTrait, TraitInfo> = {
  tilts_on_death: {
    label: "Tilta ao morrer",
    description: "Perde rendimento após morrer quando atrás",
  },
  plays_worse_when_behind: {
    label: "Piora atrás",
    description: "Rende menos quando o time está atrás",
  },
  clutch_player: {
    label: "Clutch",
    description: "Joga melhor quando atrás no fim de jogo",
  },
  objective_focused: {
    label: "Foco em objetivos",
    description: "Prioriza e garante objetivos",
  },
  baron_stealer: {
    label: "Rouba barão",
    description: "Mais chance de roubar objetivos com smite",
  },
  strong_laner: {
    label: "Forte na lane",
    description: "Vantagem estável na rota",
  },
  mental_fort: {
    label: "Cabeça fria",
    description: "Resiste a tilt quando atrás",
  },
  lane_bully: {
    label: "Bully de lane",
    description: "Mais forte na fase de rotas",
  },
  trash_talker: {
    label: "Provocador",
    description: "Provoca e abala o adversário",
  },
  teamfights: {
    label: "Bom de teamfight",
    description: "Rende mais e mata mais nas lutas em grupo",
  },
  flips: {
    label: "Flipa a lane",
    description: "Tudo ou nada: mata mais, morre mais e força all-in na rota até 14:00",
  },
  dragon_lover: {
    label: "Ama objetivos",
    description: "Insiste em dragão, larvas e Arauto: fecha rápido na frente, rouba mais e morre mais tentando",
    aliases: ["Ama dragão"],
  },
  roamer: {
    label: "Roamer",
    description: "Sai da rota para gankar até 14:00; a própria rota perde vantagem",
  },
  side: {
    label: "Joga side",
    description: "No meio de jogo, faz split na rota dele e derruba mais torres",
  },
  quits: {
    label: "Quita",
    description: "Feedando e num momento ruim, pode sair da partida; às vezes volta",
  },
};
