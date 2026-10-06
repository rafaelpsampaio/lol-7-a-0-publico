/**
 * src/pacotes/ListaDePessoas.tsx
 *
 * Coluna das pessoas (secao 3.4): busca, filtro por rota, foto, nome, maior
 * nota, rotas das cartas e alerta de carta com erro.
 */

import { createMemo, createSignal, For, Show } from "solid-js";
import type { Role } from "../data/schema";
import type { Pessoa } from "./rascunho";
import { ROTAS } from "./regrasDaCarta";
import { NOME_DA_ROTA } from "./resumo";
import { Icone, IconeDeRota } from "./Icones";
import { Avatar } from "./Selos";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function filtrarPessoas(pessoas: Pessoa[], busca: string, rota: Role | null): Pessoa[] {
  const q = semAcento(busca.trim().toLowerCase());
  return pessoas.filter(
    (p) =>
      (rota === null || p.cartas.some((c) => c.primaryRole === rota)) &&
      (q === "" ||
        semAcento(p.nome.toLowerCase()).includes(q) ||
        p.cartas.some((c) => semAcento(c.displayName.toLowerCase()).includes(q)))
  );
}

export function ListaDePessoas(props: {
  pessoas: Pessoa[];
  selecionada: string | null;
  comErro: ReadonlySet<string>;
  fotoDe: (personId: string) => string | undefined;
  onEscolher: (personId: string) => void;
  onNovaPessoa: () => void;
}) {
  const [busca, setBusca] = createSignal("");
  const [rota, setRota] = createSignal<Role | null>(null);
  const visiveis = createMemo(() => filtrarPessoas(props.pessoas, busca(), rota()));
  return (
    <nav class="pk-pessoas" aria-label="Pessoas do pacote">
      <label class="pk-busca">
        <Icone nome="busca" tamanho={16} />
        <input type="search" placeholder="Buscar" value={busca()} onInput={(e) => setBusca(e.currentTarget.value)} />
      </label>
      <div class="pk-segmentos" role="group" aria-label="Filtrar por rota">
        <button type="button" class="pk-segmento" classList={{ "pk-segmento--on": rota() === null }} onClick={() => setRota(null)}>
          Todas
        </button>
        <For each={ROTAS}>
          {(r) => (
            <button type="button" class="pk-segmento" classList={{ "pk-segmento--on": rota() === r }} aria-label={NOME_DA_ROTA[r]} onClick={() => setRota(r)}>
              <IconeDeRota rota={r} tamanho={17} />
            </button>
          )}
        </For>
      </div>
      <ul class="pk-pessoas__lista">
        <For each={visiveis()}>
          {(p) => (
            <li>
              <button
                type="button"
                class="pk-pessoa-linha"
                classList={{ "pk-pessoa-linha--on": props.selecionada === p.personId }}
                onClick={() => props.onEscolher(p.personId)}
              >
                <Avatar src={props.fotoDe(p.personId)} nome={p.nome} />
                <span class="pk-pessoa-linha__texto">
                  <span class="pk-pessoa-linha__nome">
                    {p.nome}
                    <b class="pk-nota-pilula">{p.melhorNota}</b>
                  </span>
                  <span class="pk-pessoa-linha__rotas">
                    <For each={p.cartas}>{(c) => <IconeDeRota rota={c.primaryRole} tamanho={14} />}</For>
                  </span>
                </span>
                <Show when={props.comErro.has(p.personId)}>
                  <span class="pk-pessoa-linha__alerta" role="img" aria-label="Tem carta com erro">
                    <Icone nome="alerta" tamanho={16} />
                  </span>
                </Show>
              </button>
            </li>
          )}
        </For>
      </ul>
      <button type="button" class="pk-nova-pessoa" onClick={() => props.onNovaPessoa()}>
        <span class="pk-nova-pessoa__circulo">
          <Icone nome="mais" tamanho={16} />
        </span>
        Nova pessoa
      </button>
    </nav>
  );
}
