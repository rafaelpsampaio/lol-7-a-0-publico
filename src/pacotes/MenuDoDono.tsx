/**
 * src/pacotes/MenuDoDono.tsx
 *
 * Menu do dono da instancia (E-04, secao 3.2): Jogo solo, Editar pacotes e,
 * quando ha sala, Multiplayer.
 */

import { For, Show } from "solid-js";
import { Icone, MolduraHex } from "./Icones";
import { urlDaFoto } from "./fotoCache";
import "./pacotes.css";

export function MenuDoDono(props: {
  pacoteAtivo: string;
  temSala: boolean;
  conectados: number;
  fotos: string[];
  onSolo: () => void;
  onEditar: () => void;
  onMultiplayer: () => void;
}) {
  return (
    <div class="pk-tela">
      <div class="pk-conteudo">
        <header class="pk-menu__topo">
          <p class="pk-menu__chamada">VOCÊ É O HOST</p>
          <h1 class="pk-menu__titulo">LoL 7 a 0</h1>
          <p class="pk-menu__sub">Escolha o que fazer nesta instância</p>
        </header>
        <div class="pk-menu__blocos">
          <button type="button" class="pk-bloco" onClick={() => props.onSolo()}>
            <MolduraHex>
              <Icone nome="espada" tamanho={26} />
            </MolduraHex>
            <span class="pk-bloco__titulo">Jogo solo</span>
            <span class="pk-bloco__texto">
              Torneio contra bots
              <br />
              Pacote: {props.pacoteAtivo}
            </span>
            <Icone nome="seguir" class="pk-bloco__seta" />
          </button>
          <button type="button" class="pk-bloco" onClick={() => props.onEditar()}>
            <Show
              when={props.fotos.length > 0}
              fallback={
                <MolduraHex>
                  <Icone nome="cartas" tamanho={26} />
                </MolduraHex>
              }
            >
              <span class="pk-mosaico" aria-hidden="true">
                <For each={props.fotos.slice(0, 6)}>{(f) => <img src={urlDaFoto(f)} alt="" />}</For>
              </span>
            </Show>
            <span class="pk-bloco__titulo">Editar pacotes</span>
            <span class="pk-bloco__texto">
              Cartas, fotos, fases, traits
              <br />e campeões
            </span>
            <Icone nome="seguir" class="pk-bloco__seta" />
          </button>
          <Show when={props.temSala}>
            <button type="button" class="pk-bloco" onClick={() => props.onMultiplayer()}>
              <MolduraHex>
                <Icone nome="espadas" tamanho={26} />
              </MolduraHex>
              <span class="pk-bloco__online">
                <i />
                {`${props.conectados} na sala`}
              </span>
              <span class="pk-bloco__titulo">Multiplayer</span>
              <span class="pk-bloco__texto">Abrir o lobby para os amigos</span>
              <Icone nome="seguir" class="pk-bloco__seta" />
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
