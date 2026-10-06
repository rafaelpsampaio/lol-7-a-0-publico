/**
 * src/tournament/TeamEditScreen.tsx
 *
 * Shown after "novo torneio" and before the draft, so the player can name their
 * org (name + short tag) and pick a team colour for the broadcast HUD. Pre-filled
 * with a suggested identity that the player can keep or overwrite.
 *
 * SolidJS conventions: class= not className; signals called as functions.
 */

import { createSignal, For } from "solid-js";

export interface TeamIdentityChoice {
  name: string;
  tag: string;
  color: string;
}

interface Props {
  /** Suggested starting identity (player can edit any field). */
  suggestion: TeamIdentityChoice;
  onConfirm: (identity: TeamIdentityChoice) => void;
}

/** Broadcast-friendly colour options (blue is the classic "user" side). */
const COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f59e0b", // amber
  "#ec4899", // pink
  "#14b8a6", // teal
  "#ef4444", // red
  "#e6edf3", // white
];

export function TeamEditScreen(props: Props) {
  const [name, setName] = createSignal(props.suggestion.name);
  const [tag, setTag] = createSignal(props.suggestion.tag);
  const [color, setColor] = createSignal(props.suggestion.color);

  const cleanTag = () => tag().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const canConfirm = () => name().trim().length > 0 && cleanTag().length >= 2;

  function confirm() {
    if (!canConfirm()) return;
    props.onConfirm({ name: name().trim(), tag: cleanTag(), color: color() });
  }

  return (
    <div class="team-edit" aria-label="Editar seu time">
      <h2 class="team-edit__title">Seu time</h2>
      <p class="team-edit__subtitle">Dê um nome, uma tag e uma cor antes do draft.</p>

      {/* Live preview */}
      <div class="team-edit__preview" style={{ "border-color": color() }}>
        <span class="team-edit__preview-tag" style={{ "background-color": color() }}>
          {cleanTag() || "TAG"}
        </span>
        <span class="team-edit__preview-name">{name().trim() || "Nome do time"}</span>
      </div>

      <label class="team-edit__field">
        <span class="team-edit__label">Nome</span>
        <input
          class="team-edit__input"
          type="text"
          maxLength={28}
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="Nome do time"
        />
      </label>

      <label class="team-edit__field">
        <span class="team-edit__label">Tag (2 a 4 letras)</span>
        <input
          class="team-edit__input team-edit__input--tag"
          type="text"
          maxLength={4}
          value={tag()}
          onInput={(e) => setTag(e.currentTarget.value)}
          placeholder="TAG"
        />
      </label>

      <div class="team-edit__field">
        <span class="team-edit__label">Cor</span>
        <div class="team-edit__colors" role="radiogroup" aria-label="Cor do time">
          <For each={COLORS}>
            {(c) => (
              <button
                type="button"
                class={`team-edit__color${color() === c ? " team-edit__color--selected" : ""}`}
                style={{ "background-color": c }}
                aria-label={`Cor ${c}`}
                aria-pressed={color() === c}
                onClick={() => setColor(c)}
              />
            )}
          </For>
        </div>
      </div>

      <button
        type="button"
        class="team-edit__confirm"
        disabled={!canConfirm()}
        onClick={confirm}
      >
        Ir para o draft
      </button>
    </div>
  );
}
