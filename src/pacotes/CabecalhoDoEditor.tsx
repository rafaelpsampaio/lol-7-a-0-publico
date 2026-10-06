/**
 * src/pacotes/CabecalhoDoEditor.tsx
 *
 * Barra do editor (secao 3.4): voltar, nome com lapis, selo e contagem ao
 * vivo, alteracoes e erros, Descartar e Salvar.
 */

import { Show } from "solid-js";
import type { PlayerVersion } from "../data/schema";
import { Icone } from "./Icones";
import { ContagemPorRota, Selo } from "./Selos";

export function CabecalhoDoEditor(props: {
  nome: string;
  cartas: readonly PlayerVersion[];
  alteracoes: number;
  cartasComErro: number;
  salvando: boolean;
  onVoltar: () => void;
  onRenomear: () => void;
  onDescartar: () => void;
  onSalvar: () => void;
}) {
  const podeSalvar = () => props.alteracoes > 0 && props.cartasComErro === 0 && !props.salvando;
  return (
    <header class="pk-barra">
      <button type="button" class="pk-voltar" disabled={props.salvando} onClick={() => props.onVoltar()}>
        <Icone nome="voltar" tamanho={18} />
        Pacotes
      </button>
      <h1 class="pk-barra__titulo">
        {props.nome}
        <button type="button" class="pk-icone-btn" aria-label="Renomear pacote" disabled={props.salvando} onClick={() => props.onRenomear()}>
          <Icone nome="lapis" tamanho={16} />
        </button>
      </h1>
      <Selo cartas={props.cartas} />
      <ContagemPorRota cartas={props.cartas} />
      <span class="pk-espaco" />
      <Show when={props.cartasComErro > 0}>
        <span class="pk-barra__erros">
          {props.cartasComErro === 1 ? "1 carta com erro" : `${props.cartasComErro} cartas com erro`}
        </span>
      </Show>
      <Show when={props.alteracoes > 0}>
        <span class="pk-barra__sujo">
          <i />
          {props.alteracoes === 1 ? "1 alteração" : `${props.alteracoes} alterações`}
        </span>
      </Show>
      <button type="button" class="pk-btn pk-btn--texto" disabled={props.alteracoes === 0 || props.salvando} onClick={() => props.onDescartar()}>
        Descartar
      </button>
      <button type="button" class="pk-btn pk-btn--primaria" disabled={!podeSalvar()} onClick={() => props.onSalvar()}>
        {props.salvando ? "Salvando..." : "Salvar"}
      </button>
    </header>
  );
}
