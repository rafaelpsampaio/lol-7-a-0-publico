/**
 * src/playback/SpeedControls.tsx
 *
 * Playback speed control row (PLAY-05):
 *   1x / 2x toggle buttons + "Pular para o fim" skip button.
 *
 * Design decisions applied:
 *   - Mirrors DraftScreen speed-btn / speed-btn--selected button-row pattern
 *   - class= (not className); aria-pressed on toggle buttons; pt-BR copy
 *   - Disabled once match is complete (disabled prop)
 *   - No innerHTML
 *
 * SolidJS conventions: class= (not className); signals called as functions.
 */

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** Currently selected speed */
  speed: 1 | 2;
  /** Called when the user selects a new speed */
  onSpeedChange: (s: 1 | 2) => void;
  /** Called when the user requests skip-to-end */
  onSkip: () => void;
  /** When true (match complete), all buttons are disabled */
  disabled?: boolean;
  paused?: boolean;
  onPauseToggle?: () => void;
}

// ---------------------------------------------------------------------------
// SpeedControls component
// ---------------------------------------------------------------------------

export function SpeedControls(props: Props) {
  return (
    <div class="speed-controls" role="group" aria-label="Controle de velocidade">
      <button class="speed-controls__btn" disabled={props.disabled || !props.onPauseToggle}
        aria-pressed={props.paused ?? false} onClick={() => props.onPauseToggle?.()}>
        {props.paused ? "Retomar" : "Pausar"}
      </button>
      <button
        class={`speed-controls__btn${props.speed === 1 ? " speed-controls__btn--active" : ""}`}
        aria-pressed={props.speed === 1}
        disabled={props.disabled}
        onClick={() => props.onSpeedChange(1)}
      >
        1x
      </button>
      <button
        class={`speed-controls__btn${props.speed === 2 ? " speed-controls__btn--active" : ""}`}
        aria-pressed={props.speed === 2}
        disabled={props.disabled}
        onClick={() => props.onSpeedChange(2)}
      >
        2x
      </button>
      <button
        class="speed-controls__btn"
        disabled={props.disabled}
        onClick={() => props.onSkip()}
      >
        Pular para o fim
      </button>
    </div>
  );
}
