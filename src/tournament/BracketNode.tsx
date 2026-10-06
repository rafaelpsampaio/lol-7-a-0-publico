/**
 * src/tournament/BracketNode.tsx
 *
 * Secondary card representing a single bracket matchup slot.
 * Shows team A vs team B with win counts; active node is a <button>.
 * Eliminated team shows "Eliminado" text (not color-only — accessibility).
 *
 * UI-SPEC: Secondary card, accent left-border for user team, accent full-border
 * for active series, opacity 0.5 + "Eliminado" label for eliminated nodes.
 * Accessibility: active node uses <button aria-label="Iniciar série: A vs B">;
 * eliminated nodes carry text "Eliminado" (never color alone).
 *
 * SolidJS conventions: class= not className; signals called as functions.
 */

import { Show } from "solid-js";
import type { BracketSlot, TournamentTeam } from "./schema";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** The bracket slot to render */
  slot: BracketSlot;
  /** All teams in the tournament (id → TournamentTeam) */
  teams: Record<string, TournamentTeam>;
  /** Whether this is the active (user's current) series */
  isActive: boolean;
  /** Whether the user team is in this slot */
  isUserSlot: boolean;
  /** Callback when user clicks "Iniciar série" */
  onStart: () => void;
  /** Callback when user clicks "Ver replay" */
  onReplay: () => void;
}

// ---------------------------------------------------------------------------
// BracketNode component
// ---------------------------------------------------------------------------

export function BracketNode(props: Props) {
  const series = () => props.slot.series;
  const teamA = () => (series().teamAId ? props.teams[series().teamAId!] : null);
  const teamB = () => (series().teamBId ? props.teams[series().teamBId!] : null);

  const teamAName = () => teamA()?.displayName ?? "A definir";
  const teamBName = () => teamB()?.displayName ?? "A definir";

  const winsA = () => series().wins[series().teamAId ?? ""] ?? 0;
  const winsB = () => series().wins[series().teamBId ?? ""] ?? 0;

  const isComplete = () => series().status === "complete";
  const isReady = () => series().status === "ready";
  const isPending = () => series().status === "pending";

  const teamAEliminated = () => {
    if (!isComplete()) return false;
    return series().winnerId !== series().teamAId && series().teamAId !== null;
  };

  const teamBEliminated = () => {
    if (!isComplete()) return false;
    return series().winnerId !== series().teamBId && series().teamBId !== null;
  };

  const teamAWon = () => isComplete() && series().winnerId === series().teamAId;
  const teamBWon = () => isComplete() && series().winnerId === series().teamBId;

  const teamAIsUser = () => teamA()?.isUser ?? false;
  const teamBIsUser = () => teamB()?.isUser ?? false;

  const nodeClass = () => {
    let cls = "bracket-node";
    if (props.isActive) cls += " bracket-node--active";
    if (props.isUserSlot) cls += " bracket-node--user";
    if (isPending()) cls += " bracket-node--pending";
    return cls;
  };

  return (
    <div class={nodeClass()}>
      {/* Team A row */}
      <div class={`bracket-node__team${teamAEliminated() ? " bracket-node__team--eliminated" : ""}${teamAIsUser() ? " bracket-node__team--user" : ""}`}>
        <span class="bracket-node__team-name">{teamAName()}</span>
        <Show when={teamAEliminated()}>
          <span class="bracket-node__eliminated-label">Eliminado</span>
        </Show>
        <span class={`bracket-node__score${teamAWon() ? " bracket-node__score--winner" : ""}`}>
          {winsA()}
        </span>
      </div>

      {/* VS separator */}
      <div class="bracket-node__vs">vs</div>

      {/* Team B row */}
      <div class={`bracket-node__team${teamBEliminated() ? " bracket-node__team--eliminated" : ""}${teamBIsUser() ? " bracket-node__team--user" : ""}`}>
        <span class="bracket-node__team-name">{teamBName()}</span>
        <Show when={teamBEliminated()}>
          <span class="bracket-node__eliminated-label">Eliminado</span>
        </Show>
        <span class={`bracket-node__score${teamBWon() ? " bracket-node__score--winner" : ""}`}>
          {winsB()}
        </span>
      </div>

      {/* Active series: start button */}
      <Show when={props.isActive && isReady()}>
        <button
          type="button"
          class="bracket-node__start-btn"
          aria-label={`Iniciar série: ${teamAName()} vs ${teamBName()}`}
          onClick={props.onStart}
        >
          Iniciar série
        </button>
      </Show>

      {/* Completed series: replay button — only for the user's own games. Bot-vs-bot
          results are auto-simulated, so offering a "replay" of a match the user never
          watched reads as a replay of something that never happened to them. */}
      <Show when={isComplete() && props.isUserSlot}>
        <button
          type="button"
          class="bracket-node__replay-btn"
          aria-label={`Ver replay: ${teamAName()} vs ${teamBName()}, jogo 1`}
          onClick={props.onReplay}
        >
          Ver replay
        </button>
      </Show>

      {/* Pending state */}
      <Show when={isPending()}>
        <span class="bracket-node__pending-label">A definir</span>
      </Show>
    </div>
  );
}
