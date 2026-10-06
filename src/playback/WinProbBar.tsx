/**
 * src/playback/WinProbBar.tsx
 *
 * Animated two-sided win-probability bar for match playback (PLAY-04).
 *
 * Renders a horizontal bar split user%/rival% driven by the latest reached
 * event's winProbAfter (pre-computed in runMatch — NOT recomputed here).
 *
 * The CSS width transition (defined in styles.css) animates the split after
 * each event, providing the visible "win-prob shifts after each event" behavior.
 *
 * Design decisions applied:
 *   D-14: winProbAfter sourced from GameEvent (pre-computed, not re-derived)
 *   T-04-04: all values rendered as JSX text nodes — no innerHTML
 *   PLAY-04: bar updates visibly after each event via CSS transition on width
 *
 * SolidJS conventions: class= (not className); signals called as functions.
 */

import { formatWinProb } from "./EventTicker";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /**
   * The latest reached event's winProbAfter in [0, 1] (user-team probability).
   * Null before the first event reaches — renders a neutral 50/50 state.
   */
  winProb: number | null;
  /**
   * Como chamar cada lado para quem assiste (rotulosDosLados, PlaybackScreen).
   * Omitidos = "Você"/"Rival", o de sempre no solo.
   */
  rotuloUser?: string;
  rotuloRival?: string;
}

// ---------------------------------------------------------------------------
// WinProbBar component
// ---------------------------------------------------------------------------

export function WinProbBar(props: Props) {
  // Derive user/rival percentages from the pre-computed winProbAfter value.
  // When null (no event reached yet), show a neutral 50/50 split.
  // formatWinProb is the single source of split math — mirrors EventTicker's text.
  // The bar shows the exact win probability (reaching ~100% on a near-certain win).
  // Visual smoothing comes from the eased CSS width transition (styles.css), which
  // animates each change instead of snapping, taming the "jumpy" feel.
  const userPct = () => (props.winProb === null ? 50 : formatWinProb(props.winProb).userPct);
  const rivalPct = () => 100 - userPct();

  return (
    <div
      class="win-prob-bar"
      role="meter"
      aria-label={`Probabilidade de vitória: ${props.rotuloUser ?? "Você"} ${userPct()}% · ${rivalPct()}% ${props.rotuloRival ?? "Rival"}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={userPct()}
    >
      {/* User segment — Accent #c89b3c, width transitions via CSS */}
      <div
        class="win-prob-bar__user"
        style={{ width: `${userPct()}%` }}
      >
        {/* Accessible numeric label rendered as JSX text — no innerHTML */}
        <span class="win-prob-bar__label win-prob-bar__label--user">
          {`${props.rotuloUser ?? "Você"} ${userPct()}%`}
        </span>
      </div>

      {/* Rival segment — Destructive #d73a49, width transitions via CSS */}
      <div
        class="win-prob-bar__rival"
        style={{ width: `${rivalPct()}%` }}
      >
        <span class="win-prob-bar__label win-prob-bar__label--rival">
          {`${rivalPct()}% ${props.rotuloRival ?? "Rival"}`}
        </span>
      </div>
    </div>
  );
}
