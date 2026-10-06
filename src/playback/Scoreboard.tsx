/**
 * src/playback/Scoreboard.tsx
 *
 * Phase 9 — live match HUD. Reads the scoreboard snapshot carried on the latest
 * reached GameEvent (event.score) and shows kills, towers, dragons and the
 * Baron/Elder buff state so the user can read the story of the match at a glance.
 *
 * Pure presentational component; all copy pt-BR; no innerHTML (text via {value}).
 */

import { Show } from "solid-js";
import type { GameEvent } from "./types";

interface Props {
  /** The most recently reached event, or null before the first event. */
  event: GameEvent | null;
}

export function Scoreboard(props: Props) {
  const score = () => props.event?.score ?? null;

  return (
    <Show when={score()}>
      {(s) => (
        <div class="scoreboard" aria-label="Placar da partida">
          {/* Kills */}
          <div class="sb-stat" aria-label="Abates">
            <span class="sb-icon">⚔️</span>
            <span class="sb-user">{s().userKills}</span>
            <span class="sb-sep">-</span>
            <span class="sb-rival">{s().rivalKills}</span>
          </div>

          {/* Towers */}
          <div class="sb-stat" aria-label="Torres">
            <span class="sb-icon">🗼</span>
            <span class="sb-user">{s().userTowers}</span>
            <span class="sb-sep">-</span>
            <span class="sb-rival">{s().rivalTowers}</span>
          </div>

          {/* Dragons */}
          <div class="sb-stat" aria-label="Dragões">
            <span class="sb-icon">🐉</span>
            <span class="sb-user">{s().userDragons}</span>
            <span class="sb-sep">-</span>
            <span class="sb-rival">{s().rivalDragons}</span>
          </div>

          {/* Active epic buffs — only shown while a side holds them */}
          <Show when={s().userBaron || s().rivalBaron}>
            <div class={`sb-buff ${s().userBaron ? "sb-buff--user" : "sb-buff--rival"}`}>
              Barão
            </div>
          </Show>
          <Show when={s().userElder || s().rivalElder}>
            <div class={`sb-buff sb-buff--elder ${s().userElder ? "sb-buff--user" : "sb-buff--rival"}`}>
              Ancião
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}
