/**
 * src/pacotes/Modal.tsx
 *
 * Confirmacao propria das telas novas (secao 3.5): nunca o confirm do
 * navegador.
 */

import { For, type JSX } from "solid-js";

export interface AcaoDoModal {
  rotulo: string;
  tipo?: "primaria" | "perigo" | "neutra";
  onClick: () => void;
}

export function Modal(props: { titulo: string; children?: JSX.Element; acoes: AcaoDoModal[] }) {
  return (
    <div class="pk-modal-fundo" role="presentation">
      <div class="pk-modal" role="dialog" aria-modal="true" aria-label={props.titulo}>
        <h2 class="pk-modal__titulo">{props.titulo}</h2>
        <div class="pk-modal__corpo">{props.children}</div>
        <div class="pk-modal__acoes">
          <For each={props.acoes}>
            {(a) => (
              <button type="button" class={`pk-btn pk-btn--${a.tipo ?? "neutra"}`} onClick={() => a.onClick()}>
                {a.rotulo}
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
