/**
 * src/room/BracketScreen.tsx
 *
 * Tela do chaveamento da sala: em que rodada a noite esta e o que ela disputa,
 * como esta o meu time, as 14 series, a votacao quando todos os times da sala
 * ja cairam, e a barra de acao ("Ready — terminei de assistir", quem ainda falta).
 *
 * O servidor manda o estado da sala e a timeline de uma serie em mensagens
 * separadas (D-27) — a timeline chega ate 1,7 MB e mandar junto do estado
 * faria cada clique de "pronto" custar 1,7 MB para todo mundo na sala.
 * Consequencia: entre escolher uma serie e a timeline chegar, o torneio ja
 * esta atualizado e `games()` ainda esta null. Esse null NAO significa "sem
 * torneio" (esse e o de `tournament()`) — significa "carregando".
 *
 * Sem spoiler (Rundown da Sala 2, D1): o que vem do roomState so aparece
 * depois que esta pessoa viu a serie que o decide -- ver revelacao.ts.
 */

import { For, Show } from "solid-js";
import type { RoomStore, SlotId } from "../net/store";
import type { TournamentSeriesWire } from "../../server/protocol";
import { BracketSeriesList, nomeDoTime, revelacaoDaSala } from "./BracketSeriesList";
import { VotePanel } from "./VotePanel";
import { eliminadoVisivel, finalRevelada, rotuloDaRodada, seriesEscondidas, situacaoDoTime } from "./revelacao";


interface Props {
  store: RoomStore;
}

/**
 * Melhor serie pra oferecer a quem foi eliminado e nao esta assistindo nada
 * agora: prefere uma em andamento (a acao do momento); senao, a ultima
 * jogada — `series` vem na ordem do bracket (UB antes de LB, rodada 1 antes
 * da 2, GF por ultimo), entao "ultima" acompanha o progresso do torneio.
 * Achado do teste de sala (2026-08-27): antes caia no primeiro elemento
 * (`series[0]` com jogo), que a partir da Onda 1 e sempre UB_QF_1.
 */
export function serieMaisRecenteJogavel(series: TournamentSeriesWire[]): SlotId | null {
  const jogaveis = series.filter((s) => s.gamesPlayed > 0);
  const emAndamento = jogaveis.find((s) => s.status === "in_progress");
  if (emAndamento !== undefined) return emAndamento.slotId;
  return jogaveis[jogaveis.length - 1]?.slotId ?? null;
}

/** "Esperando: Bia (DRA), Caio (FUR)" -- uma frase so (SSR). */
export function textoEsperando(nomes: string[]): string {
  if (nomes.length === 0) return "Todos prontos.";
  return `Esperando: ${nomes.join(", ")}.`;
}

export function BracketScreen(props: Props) {
  const torneio = () => props.store.tournament();
  const meuId = () => props.store.publicId();
  const ctx = () => revelacaoDaSala(props.store);

  const meuTime = () => {
    const meu = meuId();
    return meu === null ? null : torneio()?.teams.find((t) => t.publicId === meu) ?? null;
  };

  /** Fora do torneio, sem ter sabido disso ainda? So conta se ja foi revelado. */
  const souEliminadoVisivel = () => {
    const t = torneio();
    const c = ctx();
    const meu = meuTime();
    return t !== null && c !== null && meu !== null && eliminadoVisivel(meu, t, c);
  };

  const temCampeao = () => (torneio()?.championId ?? null) !== null;
  const votoAberto = () => (torneio()?.vote ?? null) !== null;
  const estaSincronizado = () => torneio()?.sync != null;

  const naBarreira = () => {
    const meu = meuId();
    return meu !== null && (torneio()?.barreira.includes(meu) ?? false);
  };
  const estouPronto = () => {
    const meu = meuId();
    return meu !== null && (torneio()?.ready.includes(meu) ?? false);
  };

  /** "apelido (SIGLA)" de quem a barreira ainda espera. */
  const nomesEsperando = (): string[] => {
    const t = torneio();
    if (t === null) return [];
    return t.barreira
      .filter((p) => !t.ready.includes(p))
      .map((p) => {
        if (p === meuId()) return "você";
        const apelido = props.store.state()?.players.find((x) => x.publicId === p)?.nickname ?? "alguém";
        const tag = t.teams.find((x) => x.publicId === p)?.tag;
        return tag === undefined ? apelido : `${apelido} (${tag})`;
      });
  };

  const textoRodada = () => `Rodada ${torneio()?.wave ?? 0} de ${torneio()?.totalWaves ?? 0}`;
  const textoTitulo = () => rotuloDaRodada(torneio()?.wave ?? 0) ?? "Chaveamento";
  const textoASeguir = () => {
    const proxima = rotuloDaRodada((torneio()?.wave ?? 0) + 1);
    return proxima === null || temCampeao() ? null : `A seguir: ${proxima}`;
  };

  const textoMeuTime = () => {
    const t = torneio();
    const c = ctx();
    const meu = meuTime();
    if (t === null || c === null || meu === null) return null;
    return `${nomeDoTime(meu)} · ${situacaoDoTime(meu, t, c)}`;
  };

  /** Series desta rodada que eu ainda nao vi (escondidas). */
  const escondidas = () => {
    const t = torneio();
    const c = ctx();
    return t === null || c === null ? [] : seriesEscondidas(t, c);
  };

  /** A serie do meu time nesta rodada, se eu ainda nao a vi. */
  const minhaSerieEscondida = (): SlotId | null => {
    const t = torneio();
    const meu = meuTime();
    if (t === null || meu === null) return null;
    return escondidas().find((slot) => {
      const s = t.series.find((x) => x.slotId === slot);
      return s !== undefined && (s.teamAId === meu.id || s.teamBId === meu.id);
    }) ?? null;
  };

  const finalEscondida = () => {
    const t = torneio();
    const c = ctx();
    return t !== null && c !== null && temCampeao() && !finalRevelada(t, c);
  };

  /**
   * Convite para quem ja sabe que caiu: acompanhar outro confronto. Em
   * sincronia a escolha e travada (D-28): sem convite.
   */
  const serieParaEspectador = () => {
    const t = torneio();
    if (t === null || estaSincronizado() || !souEliminadoVisivel()) return null;
    return serieMaisRecenteJogavel(t.series);
  };



  /** Sem time na sala (entrou depois do lobby) ou fora e sem contar na barreira. */
  const textoSemPronto = () => {
    if (torneio()?.resultadosLiberados) return "Todos prontos.";
    if (meuTime() === null) return "Você está assistindo: quem tem time na sala decide quando a noite segue.";
    return "Seu time está fora: a próxima rodada começa quando os times que seguem vivos marcarem pronto.";
  };

  return (
    <Show when={torneio() !== null}>
      <section class="room-bracket" aria-label="Chaveamento do torneio">
        <header class="room-bracket__head room-card">
          <p class="room-bracket__eyebrow">{textoRodada()}</p>
          <h2 class="room-title">{textoTitulo()}</h2>
          <p class="room-help">Cair na lower não encerra a disputa: mesmo perdendo a primeira série, seu time pode chegar à final e ser campeão.</p>
          <Show when={textoASeguir()}>{(t) => <p class="room-help">{t()}</p>}</Show>
          <Show when={textoMeuTime()}>
            {(texto) => (
              <p class="room-bracket__my-team">
                <span class="room-badge room-badge--you">seu time</span> {texto()}
              </p>
            )}
          </Show>
          <Show when={minhaSerieEscondida()}>
            {(slot) => (
              <button type="button" class="room-btn room-btn--primary" onClick={() => props.store.setWatch(slot())}>
                Assistir à série do seu time
              </button>
            )}
          </Show>
        </header>

        <Show when={votoAberto()}>
          <VotePanel store={props.store} />
        </Show>

        <Show when={finalEscondida()}>
          <div class="room-card room-bracket__cta">
            <p class="room-help">A Grande Final já foi jogada. Assista para conhecer o campeão.</p>
            <div class="room-bracket__cta-row">
              <button type="button" class="room-btn room-btn--primary" onClick={() => props.store.setWatch("GF")}>
                Assistir à Grande Final
              </button>
            </div>
          </div>
        </Show>

        <Show when={escondidas().length > 0 && !finalEscondida()}>
          <p class="room-note room-bracket__spoiler-note">
            Os resultados da rodada serão revelados quando todos marcarem Ready.{" "}
          </p>
        </Show>

        <Show when={serieParaEspectador()}>
          {(slot) => (
            <div class="room-bracket__spectator-cta room-card">
              <p>Seu time saiu. Acompanhar outro confronto agora?</p>
              <button type="button" class="room-btn" onClick={() => props.store.setWatch(slot())}>
                Assistir agora
              </button>
            </div>
          )}
        </Show>

        <Show when={estaSincronizado() && !props.store.isHost()}>
          <p class="room-note room-bracket__sync-warn" role="status">
            Assistindo juntos: o host escolhe a série e avança os jogos para a sala inteira.
          </p>
        </Show>

        <BracketSeriesList store={props.store} />

        <section class="room-bracket__teams">
          <h3 class="room-bracket__teams-title">Times</h3>
          <ul class="room-bracket__teams-list">
            <For each={torneio()?.teams ?? []}>
              {(time) => {
                const apelido = () =>
                  time.publicId === null
                    ? "bot"
                    : props.store.state()?.players.find((p) => p.publicId === time.publicId)?.nickname ?? "";
                const fora = () => {
                  const t = torneio();
                  const c = ctx();
                  return t !== null && c !== null && eliminadoVisivel(time, t, c);
                };
                return (
                  <li
                    class="room-bracket__team-item"
                    classList={{
                      "is-mine": time.publicId !== null && time.publicId === meuId(),
                      "is-eliminated": fora(),
                    }}
                  >
                    <span class="room-bracket__roster-tag">{time.tag}</span>
                    <span class="room-bracket__roster-name">{time.displayName}</span>
                    <span class="room-bracket__nick">{apelido()}</span>
                    <Show when={fora()}>
                      <span class="room-bracket__badge room-bracket__badge--eliminated">Eliminado</span>
                    </Show>
                  </li>
                );
              }}
            </For>
          </ul>
        </section>

        <Show when={props.store.isHost()}>
          <div class="room-bracket__sync room-card">
            <label class="room-bracket__sync-toggle">
              <input
                type="checkbox"
                checked={estaSincronizado()}
                onChange={(e) => {
                  const ligar = e.currentTarget.checked;
                  props.store.setSyncMode(ligar);
                  // Ligar leva o host junto para a serie que ele acompanha --
                  // antes a sala ia para la e ele ficava aqui no chaveamento.
                  const meu = meuId();
                  const slot = meu === null ? undefined : torneio()?.watching[meu];
                  if (ligar && slot !== undefined) props.store.setWatch(slot);
                }}
              />
              Assistir juntos (você controla)
            </label>
            <p class="room-help">
              Todo mundo vê a mesma série, no mesmo ponto, e só você avança os jogos e escolhe a série (clicando nela).
              Continua ligado nas próximas rodadas, seguindo a série do seu time.
            </p>
          </div>
        </Show>

        <Show when={!votoAberto() && props.store.state()?.phase !== "finished"}>
          <div class="room-bracket__actionbar">
            <Show when={naBarreira() && !torneio()?.resultadosLiberados} fallback={<p class="room-bracket__actionbar-text">{textoSemPronto()}</p>}>
              <button
                type="button"
                class="room-btn room-bracket__ready"
                classList={{ "room-btn--primary": !estouPronto(), "room-btn--active": estouPronto() }}
                aria-pressed={estouPronto()}
                onClick={() => props.store.setReady(!estouPronto())}
              >
                {estouPronto() ? "Pronto ✓ · clique para desfazer" : "Ready · terminei de assistir"}
              </button>
            </Show>
            <div class="room-bracket__actionbar-text">
              <span>{torneio()?.resultadosLiberados ? "Resultados liberados. O host pode iniciar a próxima rodada." : "Marque Ready quando terminar de assistir. Os resultados da rodada aparecem quando todos confirmarem."}</span>
              <span class="room-bracket__waiting" aria-live="polite">
                {textoEsperando(nomesEsperando())}
              </span>
            </div>
            <Show when={props.store.isHost()}>
              <button type="button" class="room-btn room-btn--small" disabled={!torneio()?.resultadosLiberados} onClick={() => props.store.forceAdvance()}>
                Iniciar próxima rodada
              </button>
            </Show>
          </div>
        </Show>
      </section>
    </Show>
  );
}
