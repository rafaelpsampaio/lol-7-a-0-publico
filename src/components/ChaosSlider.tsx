/**
 * src/components/ChaosSlider.tsx
 *
 * Chaos slider (D-10): a single labeled `<input type="range">`. By default it
 * binds to the persisted chaos-level signal (LocalStorage via
 * src/storage/chaosLevel.ts) — this is the solo mode's zero-prop usage, kept
 * exactly as it was. Passing `value`/`onChange` switches it to controlled
 * mode instead (Fase 6, docs/PLANO-EXPERIENCIA-SALA.md: reused as-is in the
 * room's draft screen, which keeps its chosen level in local component state
 * and sends it once via `startTournament`, not through the global signal).
 *
 * No UI-SPEC this phase (planned with --skip-ui) — kept intentionally minimal:
 * end labels + a range input + the current value, no extra chrome.
 *
 * SolidJS conventions: class= (not className); signals called as functions.
 */

import type { Accessor } from "solid-js";
import {
  chaosLevelSignal,
  setChaosLevelSignal,
  DEFAULT_CHAOS_LEVEL,
} from "../storage/chaosLevel";

/** The default chaos level as a whole percent (0.25 → 25) — single source of truth. */
const DEFAULT_CHAOS_PERCENT = Math.round(DEFAULT_CHAOS_LEVEL * 100);

export interface ChaosSliderProps {
  /** Controlled mode when given (together with onChange); omit both for the solo/global-signal default. */
  value?: Accessor<number>;
  onChange?: (value: number) => void;
}

/**
 * Single labeled range input for the chaos level (D-10).
 * min 0, max 1, step 0.05.
 *
 * The current value is shown as a percentage ("Caos: 25%"), the 25% default is
 * made explicit via a "Padrão: 25%" marker, and a reset button restores
 * {@link DEFAULT_CHAOS_LEVEL} so the slider always agrees with runMatch's
 * real default — in both the uncontrolled (solo) and controlled (room) modes.
 */
export function ChaosSlider(props: ChaosSliderProps = {}) {
  const value = () => (props.value ? props.value() : chaosLevelSignal());
  const setValue = (v: number) => (props.onChange ? props.onChange(v) : setChaosLevelSignal(v));

  /** True when the current value already equals the default — disables reset. */
  const atDefault = () => value() === DEFAULT_CHAOS_LEVEL;

  return (
    <div class="chaos-slider">
      <div class="chaos-slider__heading">
        <label class="chaos-slider__label" for="chaos-level-input">
          Nível de caos
        </label>
        {/* String unica (nao "Caos: " + {valor} + "%" separados): SSR do
            Solid quebra texto e valor dinamico em nos separados por
            comentario de hidratacao quando ficam em expressoes JSX
            distintas, mesmo pra valores nao-reativos. */}
        <span class="chaos-slider__value">{`Caos: ${Math.round(value() * 100)}%`}</span>
      </div>
      <div class="chaos-slider__row">
        <span class="chaos-slider__end chaos-slider__end--low">Equilibrado</span>
        <input
          id="chaos-level-input"
          class="chaos-slider__input"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={value()}
          onInput={(e) => setValue(Number(e.currentTarget.value))}
          aria-label="Nível de caos: Equilibrado a Caótico"
        />
        <span class="chaos-slider__end chaos-slider__end--high">Caótico</span>
      </div>
      <div class="chaos-slider__footer">
        <span class="chaos-slider__default-marker">{`Padrão: ${DEFAULT_CHAOS_PERCENT}%`}</span>
        <button
          type="button"
          class="chaos-slider__reset"
          disabled={atDefault()}
          onClick={() => setValue(DEFAULT_CHAOS_LEVEL)}
        >
          {`Restaurar padrão (${DEFAULT_CHAOS_PERCENT}%)`}
        </button>
      </div>
    </div>
  );
}
