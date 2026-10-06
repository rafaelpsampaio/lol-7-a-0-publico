/**
 * src/tournament/LaunchMenu.tsx
 *
 * Launch menu shown on app load. Offers "Continuar torneio" (if save exists)
 * and "Novo torneio" / "Iniciar torneio".
 *
 * D-14: Clicking "Novo torneio" when a save exists reveals an inline confirm
 * card (no window.confirm — accessibility).
 * T-05-07: All team names rendered via {} JSX — no innerHTML.
 * UI-SPEC Screen 1 / Copywriting Contract.
 *
 * SolidJS conventions: class= not className; signals called as functions.
 */

import { createSignal, For, Show } from "solid-js";
import type { TournamentState } from "./schema";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** Existing save to display (null = no save exists) */
  existingSave: TournamentState | null;
  onContinue: () => void;
  onNewTournament: () => void;
  /** Pacotes que o solo pode usar (lidos dos arquivos pela API). */
  pacotes: { id: string; nome: string }[];
  /** Id do pacote ativo. */
  pacoteAtivo: string;
  onTrocarPacote: (id: string) => void;
  /** Volta ao menu do dono (E-04); ausente para quem nao e o dono. */
  onVoltar?: () => void;
  /** Whether the active pack can fill a tournament (all 5 roles covered). */
  canStart: boolean;
  /** Why starting is blocked (shown when canStart is false). */
  blockReason: string;
}

// ---------------------------------------------------------------------------
// LaunchMenu component
// ---------------------------------------------------------------------------

export function LaunchMenu(props: Props) {
  // Local signal for the overwrite-confirm card (D-14)
  const [showConfirm, setShowConfirm] = createSignal(false);

  function handleNew() {
    if (props.existingSave !== null) {
      setShowConfirm(true);
    } else {
      props.onNewTournament();
    }
  }

  function handleConfirmNew() {
    setShowConfirm(false);
    props.onNewTournament();
  }

  function handleCancelNew() {
    setShowConfirm(false);
  }

  return (
    <div class="launch-menu">
      <h1 class="launch-menu__title">LoL 7 a 0</h1>
      <p class="launch-menu__subtitle">Simulador de torneio de pros</p>

      <Show when={props.onVoltar !== undefined}>
        <button type="button" class="launch-menu__btn launch-menu__btn--secondary" onClick={() => props.onVoltar?.()}>
          Início
        </button>
      </Show>

      <label class="launch-menu__active-pack">
        Pacote:{" "}
        <select value={props.pacoteAtivo} onChange={(e) => props.onTrocarPacote(e.currentTarget.value)}>
          <For each={props.pacotes}>{(p) => <option value={p.id} selected={p.id === props.pacoteAtivo}>{p.nome}</option>}</For>
        </select>
      </label>

      <Show when={!props.canStart}>
        <p class="launch-menu__active-pack" role="alert">{props.blockReason}</p>
      </Show>

      {/* Buttons — save exists: Continue + New; no save: single Iniciar */}
      <Show when={props.existingSave !== null}>
        <button
          type="button"
          class="launch-menu__btn launch-menu__btn--primary"
          onClick={props.onContinue}
        >
          Continuar torneio
        </button>
        <button
          type="button"
          class="launch-menu__btn launch-menu__btn--secondary"
          onClick={handleNew}
          disabled={!props.canStart}
        >
          Novo torneio
        </button>
      </Show>

      <Show when={props.existingSave === null}>
        <button
          type="button"
          class="launch-menu__btn launch-menu__btn--primary"
          onClick={handleNew}
          disabled={!props.canStart}
        >
          Iniciar torneio
        </button>
      </Show>

      {/* Overwrite-confirm inline card (D-14) */}
      <Show when={showConfirm()}>
        <div class="launch-menu__confirm-card">
          <h2 class="launch-menu__confirm-heading">Iniciar novo torneio?</h2>
          <p class="launch-menu__confirm-body">
            Isso vai apagar o torneio em andamento. Essa ação não pode ser desfeita.
          </p>
          <div class="launch-menu__confirm-actions">
            <button
              type="button"
              class="launch-menu__btn launch-menu__btn--destructive"
              onClick={handleConfirmNew}
            >
              Apagar e começar
            </button>
            <button
              type="button"
              class="launch-menu__btn launch-menu__btn--secondary"
              onClick={handleCancelNew}
            >
              Manter torneio atual
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
