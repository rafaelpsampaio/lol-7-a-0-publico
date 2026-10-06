/**
 * src/room/VotePanel.tsx
 *
 * Votacao de quando todos os times da sala ja cairam (D-33, refeita no
 * Rundown da Sala 2, D2): a sala decide se continua assistindo o resto do
 * chaveamento rodada a rodada ou se pula direto para o podio -- o resto e
 * simulado na hora e um campeao e coroado.
 *
 * Fica DENTRO do chaveamento (BracketScreen), nunca tomando a tela: a urna so
 * abre depois que todo mundo assistiu a serie em que caiu e marcou pronto, e
 * quem ainda esta assistindo outra coisa nao e arrancado da partida (S6).
 *
 * Quem ja votou pode trocar de escolha enquanto a urna estiver aberta -- os
 * botoes nunca ficam desabilitados por ja ter votado.
 */

import { For, Show } from "solid-js";
import type { RoomStore } from "../net/store";
import type { VoteChoice } from "../../server/protocol";
import { revelacaoDaSala } from "./BracketSeriesList";
import { seriesEscondidas } from "./revelacao";

interface Props {
  store: RoomStore;
}

export const ESCOLHA_LABEL: Record<VoteChoice, string> = {
  continuar: "continuar assistindo",
  parar: "pular para o pódio",
};

export function VotePanel(props: Props) {
  const voto = () => props.store.tournament()?.vote ?? null;

  const nomeTime = (publicId: string): string => {
    const time = props.store.tournament()?.teams.find((t) => t.publicId === publicId);
    const apelido = props.store.state()?.players.find((p) => p.publicId === publicId)?.nickname;
    if (time === undefined) return apelido ?? "Alguém";
    return apelido === undefined ? `${time.tag} ${time.displayName}` : `${apelido} (${time.tag})`;
  };

  const meuVoto = (): VoteChoice | null => {
    const meu = props.store.publicId();
    if (meu === null) return null;
    return voto()?.votes[meu] ?? null;
  };

  /** Espectador (entrou depois do lobby) nao tem time e nao vota. */
  const possoVotar = () => {
    const meu = props.store.publicId();
    return meu !== null && (props.store.tournament()?.teams.some((t) => t.publicId === meu) ?? false);
  };

  /**
   * Uma unica string -- o SSR do Solid envolve cada expressao dinamica em
   * comentarios de hidratacao, entao "Faltam {n} votos" nunca fica contiguo.
   */
  const textoFaltam = () => {
    const n = voto()?.faltam ?? 0;
    if (n === 0) return "Todos votaram.";
    return n === 1 ? "Falta 1 voto para a votação fechar." : `Faltam ${n} votos para a votação fechar.`;
  };

  /**
   * "Todos os times da sala ja foram eliminados" conta o resultado de uma serie
   * que esta pessoa pode nao ter visto (espectador, quem caiu antes). Com
   * serie escondida, a pergunta fica neutra (revisao final, achado 9).
   */
  const textoDaPergunta = () => {
    const t = props.store.tournament();
    const ctx = revelacaoDaSala(props.store);
    const escondida = t !== null && ctx !== null && seriesEscondidas(t, ctx).length > 0;
    const escolha =
      "assistir ao resto do chaveamento rodada a rodada ou pular direto para o pódio · o resto é simulado na hora e o campeão aparece em seguida.";
    return escondida
      ? `A sala decide como a noite segue: ${escolha}`
      : `Todos os times da sala já foram eliminados. A sala escolhe entre ${escolha}`;
  };

  const votosLancados = () => Object.entries(voto()?.votes ?? {}) as [string, VoteChoice][];

  return (
    <Show when={voto() !== null}>
      <section class="room-vote room-card" aria-label="Votação">
        <h2 class="room-subtitle">Votação: como a noite segue?</h2>
        <p class="room-help">{textoDaPergunta()}</p>

        <Show
          when={possoVotar()}
          fallback={<p class="room-note">Você está assistindo: quem tem time na sala decide.</p>}
        >
          <div class="room-vote__choices">
            <button
              type="button"
              class="room-btn"
              classList={{ "room-btn--active": meuVoto() === "continuar" }}
              aria-pressed={meuVoto() === "continuar"}
              onClick={() => props.store.vote("continuar")}
            >
              Continuar assistindo
            </button>
            <button
              type="button"
              class="room-btn"
              classList={{ "room-btn--active": meuVoto() === "parar" }}
              aria-pressed={meuVoto() === "parar"}
              onClick={() => props.store.vote("parar")}
            >
              Pular para o pódio
            </button>
          </div>
        </Show>

        {/* D-33: um criterio de desempate invisivel gera discussao na sala --
            esta frase e a razao de existir deste paragrafo. */}
        <p class="room-vote__tie-note">Em caso de empate, a sala continua assistindo.</p>
        <p class="room-vote__pending" role="status">
          {textoFaltam()}
        </p>

        <Show when={votosLancados().length > 0}>
          <ul class="room-vote__list">
            <For each={votosLancados()}>
              {([publicId, choice]) => (
                <li class="room-vote__voter">{`${nomeTime(publicId)} votou para ${ESCOLHA_LABEL[choice]}.`}</li>
              )}
            </For>
          </ul>
        </Show>

        <Show when={props.store.isHost()}>
          <div class="room-vote__host">
            <button type="button" class="room-btn room-btn--small" onClick={() => props.store.forceAdvance()}>
              Encerrar a votação agora
            </button>
            <span class="room-help">Conta só os votos que já chegaram (sem votos, a sala continua assistindo).</span>
          </div>
        </Show>
      </section>
    </Show>
  );
}
