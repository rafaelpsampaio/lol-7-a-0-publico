import { ReadyStatus } from "./ReadyStatus";
/**
 * src/room/RoomShell.tsx
 *
 * A moldura comum de todas as telas da sala (Rundown da Sala 2, S10/U13):
 * onde estou (etapas Lobby → Draft → Torneio → Pódio), quem sou (sigla, time,
 * apelido, host/espectador), como esta a conexao, e a saida ("Sair da sala").
 * Logo abaixo, uma faixa so para conexao e erro -- antes cada tela tinha a
 * sua (ou nenhuma: chaveamento e partida nao mostravam queda nem erro).
 */

import { createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import type { RoomStore } from "../net/store";
import type { RoomPhase } from "../../server/protocol";
import { HOST_RECONNECT_GRACE_SECONDS } from "../../server/protocol";
import { meuLugar } from "./identidade";

const ETAPAS: { fase: RoomPhase; nome: string }[] = [
  { fase: "lobby", nome: "Lobby" },
  { fase: "draft", nome: "Draft" },
  { fase: "tournament", nome: "Torneio" },
  { fase: "finished", nome: "Pódio" },
];

/** Indice da etapa da fase atual (lobby antes de entrar). */
export function etapaAtual(fase: RoomPhase | undefined): number {
  const i = ETAPAS.findIndex((e) => e.fase === fase);
  return i < 0 ? 0 : i;
}

/** Texto do indicador de conexao. */
export function textoDaConexao(status: ReturnType<RoomStore["status"]>): { texto: string; tom: "ok" | "warn" | "danger" } {
  switch (status) {
    case "na-sala":
      return { texto: "Conectado", tom: "ok" };
    case "entrando":
      return { texto: "Entrando…", tom: "warn" };
    case "reconectando":
      return { texto: "Reconectando…", tom: "warn" };
    case "versao-diferente":
      return { texto: "Versão diferente", tom: "danger" };
    default:
      return { texto: "Fora da sala", tom: "warn" };
  }
}

interface Props {
  store: RoomStore;
  onSair: () => void;
  children: JSX.Element;
}

export function RoomShell(props: Props) {
  const fase = () => props.store.state()?.phase;
  const eu = () => meuLugar(props.store.state(), props.store.publicId());
  const conexao = () => textoDaConexao(props.store.status());
  const hostAusente = () => props.store.state()?.hostAuto
    ? props.store.state()?.players.find((p) => p.isHost && !p.connected)
    : undefined;

  // Contagem da proxima tentativa: so anda enquanto ha tentativa marcada.
  const [agora, setAgora] = createSignal(Date.now());
  // Sem `window` (render no servidor, testes) nao ha relogio para andar.
  if (typeof window !== "undefined") {
    const relogio = setInterval(() => {
      if (props.store.proximaTentativaEm() !== null) setAgora(Date.now());
    }, 500);
    onCleanup(() => clearInterval(relogio));
  }

  const segundosParaTentar = () => {
    const em = props.store.proximaTentativaEm();
    return em === null ? null : Math.max(0, Math.ceil((em - agora()) / 1000));
  };

  /** Uma frase so (SSR do Solid separa expressoes vizinhas com comentarios). */
  const textoReconectando = () => {
    const s = segundosParaTentar();
    return s === null || s === 0
      ? "A conexão com a sala caiu. Tentando voltar agora…"
      : `A conexão com a sala caiu. Tentando voltar em ${s} s · seu lugar continua guardado.`;
  };

  function recarregar(): void {
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <div class="room-shell">
      <header class="room-shell__head">
        <div class="room-shell__brand">
          <span class="room-shell__brand-title">Sala com amigos</span>
          <span class="room-shell__brand-sub">LoL 7 a 0</span>
        </div>

        <ol class="room-shell__steps" aria-label="Etapas da noite">
          <For each={ETAPAS}>
            {(etapa, i) => (
              <li
                class="room-shell__step"
                classList={{
                  "is-current": i() === etapaAtual(fase()),
                  "is-done": i() < etapaAtual(fase()),
                }}
                aria-current={i() === etapaAtual(fase()) ? "step" : undefined}
              >
                <span class="room-shell__step-num">{i() + 1}</span>
                {etapa.nome}
              </li>
            )}
          </For>
        </ol>

        <div class="room-shell__me">
          <Show when={eu()}>
            {(lugar) => (
              <>
                <Show
                  when={!lugar().espectador}
                  fallback={<span class="room-badge">espectador</span>}
                >
                  <span class="room-shell__me-team">
                    <Show when={lugar().sigla}>
                      <span class="room-shell__me-tag">{lugar().sigla}</span>
                    </Show>
                    {lugar().time}
                  </span>
                </Show>
                <span class="room-shell__me-nick">{lugar().apelido}</span>
                <Show when={lugar().host}>
                  <span class="room-badge room-badge--gold">host</span>
                </Show>
              </>
            )}
          </Show>
          <span
            class="room-shell__conn"
            classList={{ "is-warn": conexao().tom === "warn", "is-danger": conexao().tom === "danger" }}
          >
            {conexao().texto}
          </span>
          <button type="button" class="room-btn room-btn--small room-btn--ghost" onClick={() => props.onSair()}>
            Sair da sala
          </button>
        </div>
      </header>

      <Show when={props.store.status() === "reconectando"}>
        <div class="room-status" role="status">
          <span class="room-status__text">{textoReconectando()}</span>
          <button type="button" class="room-btn room-btn--small" onClick={() => props.store.tentarAgora()}>
            Tentar agora
          </button>
        </div>
      </Show>

      <Show when={props.store.status() === "versao-diferente"}>
        <div class="room-status room-status--danger" role="alert">
          <span class="room-status__text">
            Esta página é de uma versão do jogo diferente da do servidor. Recarregue para continuar.
          </span>
          <button type="button" class="room-btn room-btn--small" onClick={recarregar}>
            Recarregar
          </button>
        </div>
      </Show>

      <Show when={props.store.status() !== "versao-diferente" && props.store.error()}>
        {(msg) => (
          <div class="room-status room-status--danger" role="alert">
            <span class="room-status__text">{msg()}</span>
            <button type="button" class="room-btn room-btn--small room-btn--ghost" onClick={() => props.store.limparErro()}>
              Fechar
            </button>
          </div>
        )}
      </Show>

      <Show when={props.store.status() === "na-sala" && hostAusente()}>
        <div class="room-status" role="status">
          <span class="room-status__text">
            {`O host ${hostAusente()!.nickname} desconectou. Se não voltar em ${HOST_RECONNECT_GRACE_SECONDS} s após a queda, o próximo jogador conectado assume a sala.`}
          </span>
        </div>
      </Show>
      <Show when={props.store.state()?.hostAuto && props.store.isHost()}>
        <div class="room-status" role="status">
          <span class="room-status__text">Você é o host desta sala: escolhe as regras e conduz a disputa.</span>
        </div>
      </Show>
      <ReadyStatus store={props.store} />
      {props.children}
    </div>
  );
}
