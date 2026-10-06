/**
 * src/playback/EventTicker.tsx
 *
 * Animated event list for match playback (PLAY-02, SIM-07).
 *
 * Design decisions applied:
 *   D-13: animated ticker — new entries slide-up + fade over 200ms
 *   D-14: two-sided win-prob text "Você X% — Y% Rival" from event.winProbAfter (pre-computed)
 *   D-15: closed event-type vocabulary mapped to canonical pt-BR labels
 *   UI-SPEC: aria-live="polite", most recent event at top (prepend), Body text
 *   Threat T-02-06: event labels from a fixed pt-BR map; no innerHTML
 *
 * SolidJS conventions: class= (not className); signals called as functions.
 * NOT included (Phase 4): animated win-prob bar, champion portraits, speed controls.
 */

import { For, createMemo, createSignal } from "solid-js";
import type { GameEvent } from "./types";
import type { EventType } from "../sim/types";

// ---------------------------------------------------------------------------
// pt-BR event label map (D-15, UI-SPEC)
// All event keys from the locked EventType vocabulary; no raw strings rendered.
// ---------------------------------------------------------------------------

// Legacy fallback labels (used only for old stored games without a ticker line).
const EVENT_LABELS: Partial<Record<EventType, string>> = {
  first_blood: "Primeiro Sangue",
  player_quit: "Quitou",
  player_returned: "Voltou",
  dragon: "Dragão",
  dragon_taken: "Dragão",
  dragon_steal: "Dragão Roubado",
  inhibitor: "Inibidor",
  inhibitor_destroyed: "Inibidor",
  baron: "Barão",
  baron_taken: "Barão",
  baron_steal: "Barão Roubado",
  elder_dragon: "Dragão Ancião",
  elder_taken: "Dragão Ancião",
  gg: "GG · Fim de Jogo",
  // Phase 28 (plano 28-04): destaque narrativo de zebra (D-03/D-04/D-05).
  upset_win: "Zebra",
};

/** MM:SS from in-game milliseconds. */
function formatGameTime(gameTimeMs: number): string {
  const totalSec = Math.floor(gameTimeMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Rich event kinds that deserve a highlighted ticker row. */
const HIGHLIGHT_KINDS = new Set<string>([
  "first_blood",
  "penta_kill",
  "quadra_kill",
  "ace",
  "baron_taken",
  "baron_steal",
  "elder_taken",
  "elder_steal",
  "dragon_steal",
  "nexus_exposed",
  "gg",
  // Phase 28 (plano 28-04): destaque narrativo de zebra (D-03/D-04/D-05).
  "upset_win",
]);

const SUMMARY_KINDS = new Set<string>([
  ...HIGHLIGHT_KINDS, "dragon", "dragon_taken", "baron", "elder_dragon",
  "inhibitor", "inhibitor_destroyed", "tower_destroyed", "first_tower",
  "herald_taken", "voidgrubs_taken", "shutdown", "triple_kill", "comeback_fight",
  "player_quit", "player_returned",
]);

export function isSummaryEvent(event: Pick<GameEvent, "type">): boolean {
  return SUMMARY_KINDS.has(event.type);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /**
   * Ordered list of reached GameEvents (append-driven — new events are added
   * by PlaybackScreen after onEventReached fires). EventTicker renders most-
   * recent first (reverses the array).
   */
  events: GameEvent[];
  /** Nome de cada lado no texto de probabilidade (rotulosDosLados). Omitidos = "Você"/"Rival". */
  rotuloUser?: string;
  rotuloRival?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format win probability as "Você X% — Y% Rival".
 * X = round(winProbAfter * 100), Y = 100 - X.
 * Value sourced directly from event.winProbAfter (pre-computed in runMatch — not re-derived).
 */
export function formatWinProb(winProbAfter: number): { userPct: number; rivalPct: number } {
  const userPct = Math.round(winProbAfter * 100);
  // Ensure they always sum to 100 via complement (not re-computation)
  const rivalPct = 100 - userPct;
  return { userPct, rivalPct };
}

// ---------------------------------------------------------------------------
// EventTicker component
// ---------------------------------------------------------------------------

export function EventTicker(props: Props) {
  // Events are rendered most-recent first — reverse a copy for display.
  // SolidJS For iterates the accessor's current value reactively.
  const [showAll, setShowAll] = createSignal(false);
  const summary = createMemo(() => props.events.filter(isSummaryEvent));
  const reversedEvents = createMemo(() => [...(showAll() ? props.events : summary())].reverse());

  // Current win probability comes from the most-recently reached event.
  const latestEvent = () => props.events[props.events.length - 1];
  const winProb = () => {
    const ev = latestEvent();
    return ev ? formatWinProb(ev.winProbAfter) : null;
  };

  return (
    <div class="event-ticker-container">
      <div class="event-feed-tabs" role="group" aria-label="Filtrar narração">
        <button type="button" aria-pressed={!showAll()} onClick={() => setShowAll(false)}>Destaques <span>{summary().length}</span></button>
        <button type="button" aria-pressed={showAll()} onClick={() => setShowAll(true)}>Todos os eventos <span>{props.events.length}</span></button>
      </div>
      <p class="event-feed-hint">{showAll() ? "Histórico completo, com o mais recente no topo." : "Objetivos, estruturas e momentos decisivos."}</p>
      {/* ----------------------------------------------------------------- */}
      {/* Win probability display (SIM-07, D-14) — inline with ticker       */}
      {/* "Você X%" in accent; "— Y% Rival" in destructive                  */}
      {/* ----------------------------------------------------------------- */}
      <div class="win-prob-display" aria-label="Probabilidade de vitória">
        {winProb()
          ? (
            <span class="win-prob-text">
              <span class="win-prob-user">{`${props.rotuloUser ?? "Você"} ${winProb()!.userPct}%`}</span>
              <span class="win-prob-sep"> - </span>
              <span class="win-prob-rival">{`${winProb()!.rivalPct}% ${props.rotuloRival ?? "Rival"}`}</span>
            </span>
          )
          : (
            <span class="win-prob-placeholder">Aguardando primeiro evento...</span>
          )
        }
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Animated event list — most recent first (D-13)                    */}
      {/* ----------------------------------------------------------------- */}
      <div
        class="event-ticker"
        aria-live="polite"
        aria-label="Eventos da partida"
        role="log"
      >
        <For each={reversedEvents()} fallback={<p class="event-feed-empty">{showAll() ? "A partida vai começar." : "Aguardando o primeiro destaque. Acompanhe o placar e o mapa ao vivo."}</p>}>
          {(event, index) => {
            // The most recently added event (index 0 after reverse) gets the animation class
            const isNew = index() === 0;
            const teamClass =
              event.team === "user" ? "event-entry--user" : "event-entry--rival";
            const highlight = HIGHLIGHT_KINDS.has(event.type)
              ? " event-entry--highlight"
              : "";
            // Prefer the rich "who did what" ticker; fall back to a legacy label.
            const text =
              event.ticker ?? EVENT_LABELS[event.type] ?? event.type;

            return (
              <div
                class={`event-entry ${teamClass}${highlight}${isNew ? " event-entry--new" : ""}`}
                aria-label={text}
              >
                <span class="event-time">{formatGameTime(event.gameTimeMs)}</span>
                <span class="event-text">{text}</span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
