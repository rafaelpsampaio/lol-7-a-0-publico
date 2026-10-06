/**
 * src/playback/ChampionPortrait.tsx
 *
 * Reusable champion portrait component for match playback (PLAY-03).
 *
 * Renders a locally-served square champion image (from public/champions/).
 * On img load error or when the image filename is absent, falls back to the
 * champion's display name rendered as a text node (T-04-01: no innerHTML).
 *
 * SolidJS conventions: class= (not className); signals called as functions.
 */

import { createSignal, createEffect, Show } from "solid-js";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** Canonical champion ID (lowercase-kebab-case), e.g. "aatrox" */
  championId: string;
  /** Display name shown as fallback text and aria-label, e.g. "Aatrox" */
  name: string;
  /**
   * Data Dragon square-asset filename (e.g. "Aatrox.png").
   * When absent, the component renders the name text immediately without
   * mounting a broken img element.
   */
  image?: string;
  /** Side length in px (default 48 — small square suitable for team strips) */
  size?: number;
}

// ---------------------------------------------------------------------------
// ChampionPortrait component
// ---------------------------------------------------------------------------

export function ChampionPortrait(props: Props) {
  // hasError becomes true when the img fires an error event (asset missing/offline).
  const [hasError, setHasError] = createSignal(false);

  createEffect(() => { props.image; setHasError(false); });
  const size = () => props.size ?? 48;

  return (
    <div
      class="champion-portrait"
      aria-label={props.name}
      style={{ width: `${size()}px`, height: `${size()}px` }}
    >
      <Show
        when={props.image && !hasError()}
        fallback={
          <span class="champion-portrait__fallback">{props.name}</span>
        }
      >
        <img
          class="champion-portrait__img"
          src={`/champions/${props.image}`}
          alt={props.name}
          loading="lazy"
          width={size()}
          height={size()}
          onError={() => setHasError(true)}
        />
      </Show>
    </div>
  );
}
