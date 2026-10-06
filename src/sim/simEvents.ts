/**
 * src/sim/simEvents.ts
 *
 * Phase 5/6 — the RICH event the state-driven engine emits. This is the internal
 * timeline entry (protagonist-aware). Phase 6 maps it to the persisted GameEvent
 * contract (sim/types.ts) consumed by the playback UI.
 */

import type { Side, Lane } from "./matchState";
import type { ObjectiveKind } from "./objectives";
import type { MapSnapshot } from "./types";

/** Map regions used when an event isn't tied to a structural lane. */
export type Region = "river_top" | "river_bot" | "top_jg" | "bot_jg" | "base";

/** Rich event taxonomy (pesquisa.md). */
export type EventKind =
  | "first_blood"
  | "kill"
  | "death"
  | "solo_kill"
  | "gank"
  | "dive"
  | "double_kill"
  | "triple_kill"
  | "quadra_kill"
  | "penta_kill"
  | "shutdown"
  | "ace"
  | "dragon_taken"
  | "dragon_fight"
  | "dragon_steal"
  | "voidgrubs_taken"
  | "herald_taken"
  | "herald_used"
  | "tower_destroyed"
  | "first_tower"
  | "baron_fight"
  | "baron_taken"
  | "baron_steal"
  | "elder_fight"
  | "elder_taken"
  | "elder_steal"
  | "inhibitor_destroyed"
  | "nexus_exposed"
  | "comeback_fight"
  | "gg"
  // Phase 12 — eventos contextuais (EVT-01/02, D-05):
  | "ctx_support_died_warding"
  | "ctx_adc_caught_no_flash"
  | "ctx_top_dive_weakside"
  | "ctx_bot_won_2v2"
  | "ctx_support_engage_decisive"
  | "ctx_enchanter_saved_carry"
  | "ctx_adc_cleaned_fight"
  | "ctx_scaling_survived_early"
  // Phase 17 — eventos estruturais intermediarios visiveis (STR-04, D-01):
  // plate_taken: placa coletada da torre externa antes da queda (exibida na timeline).
  // tower_low: torre com pool de dano >= limiar critico (~70) — alerta de iminencia.
  // tower_chipped, siege_defended, wave_crashed: internos — NAO entram no EventKind (D-01).
  | "plate_taken"
  | "tower_low"
  // Phase 26 (plano 26-07): recheio narrativo do early game (D-01), sinais que a
  // engine ja calcula internamente (laneLead, prioScore, jungleAttentionReceived),
  // transformados em evento visivel por cruzamento de limiar com histerese
  // (classifyLaneCrossing em laneSignals.ts). Restritos a antes de 840s (14:00).
  // lane_advantage_building: laneLead cruzou o limiar de subida, vantagem
  //   persistente de lane deixou de ser marginal (o sinal que produz: laneLead).
  // lane_priority_shift: prioScore cruzou o limiar de subida, a lane liberou
  //   prioridade suficiente para permitir roam/pressao de mapa (o sinal: prioScore).
  // jungler_attention_shift: jungleAttentionReceived cruzou o limiar de subida,
  //   a lane comecou a receber atencao/pressao assimetrica do jungler, derivada
  //   de state.pressure[lane] (o sinal: jungleAttentionReceived).
  | "lane_advantage_building"
  | "lane_priority_shift"
  | "jungler_attention_shift"
  // Phase 28 (plano 28-04, D-03/D-04/D-05): destaque narrativo de zebra, adicao
  // de escopo declarada em 28-CONTEXT.md, fora dos quatro criterios do
  // ROADMAP.md. Dispara quando o time de rating de CARTA menor venceu o jogo,
  // com gap de rating (isUpset em power.ts) maior ou igual a UPSET_MIN_GAP.
  // Avaliado UMA UNICA VEZ, depois do fim da partida (state.ended), e NUNCA
  // por win probability momentanea, essa track e escopo da Fase 29.
  | "upset_win"
  // Spec 2026-10-02-calendario-e-volume (secao 4): aviso de preparo de objetivo. Sai uma vez por
  // nascimento e por lado, quando o preparo passa de 50. Nao mexe em placar nem em ouro.
  | "objective_setup"
  // Spec 2026-10-05-traits-no-motor (3.6 e 4): o `quits` saiu ou voltou. Nao mexem em placar nem em ouro.
  | "player_quit"
  | "player_returned";

// Conferencia (plano 26-07, Task 1; plano 28-04, Task 1): todos os registros por
// EventKind do projeto (KILLER_ROLE_WEIGHTS, VICTIM_ROLE_WEIGHTS,
// ARCHETYPE_KILL_FIT, ASSIST_COUNT_BY_EVENT, ASSIST_MIN_SCORE em selection.ts)
// sao Partial<Record<EventKind, ...>> com fallback explicito, acrescentar os
// tipos novos acima (incluindo upset_win) NAO obriga nenhum deles a ganhar
// entrada.

/** A compact scoreboard snapshot at the moment of an event (for the live UI). */
export interface EventScore {
  userKills: number;
  rivalKills: number;
  userTowers: number;
  rivalTowers: number;
  userDragons: number;
  rivalDragons: number;
  /** Active team Baron buff right now. */
  userBaron: boolean;
  rivalBaron: boolean;
  /** Active team Elder buff right now. */
  userElder: boolean;
  rivalElder: boolean;
  userGold: number;
  rivalGold: number;
  /** Elements of dragons each team has taken, in order. */
  userDragonEls: string[];
  rivalDragonEls: string[];
}

/** The protagonist-aware timeline entry. */
export interface SimEvent {
  id: string;
  timeSec: number;
  kind: EventKind;
  /** Team that performed the action (null for neutral/structural notes). */
  side: Side | null;
  /** Display names of the protagonists. */
  actors: string[];
  /** Display names of the victims, if any. */
  victims: string[];
  /** Lane or map region the event happened in. */
  lane: Lane | Region | null;
  /** Objective involved, if any. */
  objectiveKind: ObjectiveKind | null;
  /** Whether the objective/fight was contested by both teams. */
  contested: boolean;
  /** Whether an objective was stolen. */
  stolen: boolean;
  /** Short pt-BR "who did what" line for the ticker. */
  ticker: string;
  /** User-team win probability AFTER this event [0,1]. */
  winProbUserAfter: number;
  /** Scoreboard snapshot at this moment (for the live playback UI). */
  score: EventScore;
  /** Live map snapshot (structures + objective timers) at this moment. */
  map: MapSnapshot;
  /** @internal Qualidade da morte que originou este evento (D-03). NUNCA renderizado
   *  na UI — campo de debug/diagnostico apenas. */
  _deathQuality?: "good" | "neutral" | "bad";
  /** @internal Peso do abate que originou este evento (D-02, Fase 26 plano 26-09).
   *  NUNCA renderizado na UI, campo de debug/diagnostico apenas, mesmo padrao de
   *  _deathQuality. */
  _eventWeight?: "virada" | "decisivo" | "rotina";
}
