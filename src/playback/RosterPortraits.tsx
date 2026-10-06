import { playerName } from "../data/playerPresentation";
/**
 * src/playback/RosterPortraits.tsx
 *
 * Per-team strip of 5 ChampionPortraits resolved from champion assignments + catalogue.
 * Used in PlaybackScreen to show both teams' picks throughout the match (PLAY-03).
 *
 * Design decisions applied:
 *   PLAY-03: portraits visible throughout the match (not only on draft screen)
 *   T-04-04: all names/ids rendered as JSX text — no innerHTML
 *   T-04-05: missing catalogue entry or missing assignment renders id/name text,
 *            never throws (Pitfall 7 pattern)
 *
 * SolidJS conventions: class= (not className); For for lists; signals called as functions.
 */

import { For, createMemo } from "solid-js";
import type { PlayerVersion, ChampionEntry } from "../data/schema";
import { ChampionPortrait } from "./ChampionPortrait";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** The team's 5 players — one per role */
  roster: PlayerVersion[];
  /**
   * Map of playerId → championId for this team's game assignments.
   * A player absent from this map renders with the championId as the fallback name.
   */
  champions: Record<string, string>;
  /** The merged champion catalogue (ChampionEntry array) for id → {name, image} lookup */
  catalogue: ChampionEntry[];
  /** Which team these portraits represent — drives aria-label and CSS modifier */
  team: "user" | "rival";
}

// ---------------------------------------------------------------------------
// RosterPortraits component
// ---------------------------------------------------------------------------

export function RosterPortraits(props: Props) {
  // Build a catalogue lookup (championId → ChampionEntry) memoized on the
  // catalogue so it is constructed once per catalogue change, not rebuilt once
  // per player inside the <For> below (WR-03). Missing IDs return undefined —
  // handled with text fallback (Pitfall 7).
  const catalogueLookup = createMemo(() => {
    const map = new Map<string, ChampionEntry>();
    for (const entry of props.catalogue) {
      map.set(entry.id, entry);
    }
    return map;
  });

  // pt-BR aria-label per team (PLAY-06 / accessibility)
  const ariaLabel =
    props.team === "user" ? "Campeões do seu time" : "Campeões do rival";

  return (
    <div
      class={`roster-portraits roster-portraits--${props.team}`}
      aria-label={ariaLabel}
    >
      <For each={props.roster}>
        {(player) => {
          // Resolve the assigned championId for this player.
          // Missing assignment → use empty string as id (will fall back to name text).
          const championId = props.champions[player.id] ?? "";

          // Resolve the catalogue entry for this championId.
          // Missing entry → fall back to the championId as the display name.
          // Never throws (T-04-05 / Pitfall 7).
          const entry = catalogueLookup().get(championId);
          const displayName = entry?.name ?? (championId || player.displayName);
          const image = entry?.image;

          return (
            <div class="roster-portraits__player">
              <ChampionPortrait
                championId={championId || player.id}
                name={displayName}
                image={image}
                size={48}
              />
              <span class="roster-portraits__role">
                {player.primaryRole}
              </span>
              <span class="roster-portraits__name">
                {playerName(player)}<small class="player-card__year">{player.year}</small>
              </span>
            </div>
          );
        }}
      </For>
    </div>
  );
}
