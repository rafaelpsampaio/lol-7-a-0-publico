/**
 * src/pacotes/Selos.tsx
 *
 * Pecas pequenas repetidas na lista e no editor: contagem por rota com icone,
 * selo do baralho e avatar redondo.
 */

import { For, Show, type JSX } from "solid-js";
import type { PlayerVersion } from "../data/schema";
import { ROTAS } from "./regrasDaCarta";
import { NOME_DA_ROTA, contagemPorRota, seloDoBaralho } from "./resumo";
import { Icone, IconeDeRota } from "./Icones";
import { urlDaFoto } from "./fotoCache";

export function ContagemPorRota(props: { cartas: readonly PlayerVersion[] }) {
  const n = () => contagemPorRota(props.cartas);
  return (
    <span class="pk-contagem">
      <For each={ROTAS}>
        {(r) => (
          <span title={NOME_DA_ROTA[r]}>
            <IconeDeRota rota={r} tamanho={16} />
            <b>{n()[r]}</b>
          </span>
        )}
      </For>
    </span>
  );
}

export function Selo(props: { cartas: readonly PlayerVersion[] }) {
  const s = () => seloDoBaralho(props.cartas);
  return (
    <span class="pk-selo" classList={{ "pk-selo--ok": s().pronto, "pk-selo--alerta": !s().pronto }}>
      <Icone nome={s().pronto ? "ok" : "alerta"} tamanho={15} />
      {s().texto}
    </span>
  );
}

export function Avatar(props: { src?: string; nome: string; class?: string; children?: JSX.Element }) {
  return (
    <span class={`pk-avatar ${props.class ?? ""}`}>
      <Show when={props.src} fallback={<span class="pk-avatar__iniciais">{props.nome.slice(0, 2).toUpperCase()}</span>}>
        {(src) => <img src={urlDaFoto(src())} alt={props.nome} />}
      </Show>
      {props.children}
    </span>
  );
}
