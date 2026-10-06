/**
 * src/room/BracketSeriesList.tsx
 *
 * A listagem do chaveamento -- as 14 series agrupadas por chave (superior,
 * inferior, grande final) e, dentro de cada chave, por etapa (Quartas,
 * Semifinais, Final; 1ª fase, 2ª fase, Semifinal, Final), com placar, status,
 * vencedor, eliminado e o MEU time destacados. Usada pelo chaveamento e pelo
 * podio (a mesma listagem; o que muda e o que cada tela desenha ao redor).
 *
 * Sem spoiler (Rundown da Sala 2, D1): uma serie da rodada atual que esta
 * pessoa ainda nao viu aparece sem placar e sem vencedor ("jogada · assista"),
 * os cards que ela alimenta dizem "A definir" e "Eliminado" so aparece depois
 * de revelado -- ver revelacao.ts.
 *
 * As etapas da chave inferior sao "fases", nunca "Rodada 1/2": "rodada" e a
 * palavra das ondas na tela ("Rodada 2 de 6"), e as duas coisas nao sao a
 * mesma (D8).
 *
 * Nao reaproveita `tournament/BracketNode.tsx` (o no do solo): o modelo de
 * clique e diferente -- o solo usa um botao de canto so ativo em condicoes
 * especificas; a sala usa o cartao inteiro clicavel (`setWatch`) sempre que
 * ha jogo pra ver.
 */

import { For, Show } from "solid-js";
import type { RoomStore, SlotId } from "../net/store";
import type { TournamentSeriesWire, TournamentTeamWire } from "../../server/protocol";
import { contextoDe, eliminadoVisivel, ladoRevelado, serieRevelada, type ContextoDeRevelacao } from "./revelacao";
import { vistasDe } from "./vistas";

interface Etapa {
  title: string;
  slots: SlotId[];
}

const ETAPAS_SUPERIOR: Etapa[] = [
  { title: "Quartas", slots: ["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"] },
  { title: "Semifinais", slots: ["UB_SF_1", "UB_SF_2"] },
  { title: "Final", slots: ["UB_F"] },
];

const ETAPAS_INFERIOR: Etapa[] = [
  { title: "1ª fase", slots: ["LB_R1_1", "LB_R1_2"] },
  { title: "2ª fase", slots: ["LB_R2_1", "LB_R2_2"] },
  { title: "Semifinal", slots: ["LB_SF"] },
  { title: "Final", slots: ["LB_F"] },
];

const GRANDE_FINAL: SlotId[] = ["GF"];

interface ListaProps {
  store: RoomStore;
  /** Desenha os selos "Eliminado" (o podio desliga: la a classificacao ja diz). */
  mostrarEliminados?: boolean;
}

/** Contexto de revelacao desta pessoa para o torneio atual (null sem torneio). */
export function revelacaoDaSala(store: RoomStore): ContextoDeRevelacao | null {
  const t = store.tournament();
  return t === null ? null : contextoDe(t, vistasDe(t.id));
}

/** "TAG Nome" do time, ou "A definir". */
export function nomeDoTime(time: TournamentTeamWire | null): string {
  return time === null ? "A definir" : `${time.tag} ${time.displayName}`;
}

export function BracketSeriesList(props: ListaProps) {
  return (
    <>
      <Chave title="Chave superior" etapas={ETAPAS_SUPERIOR} lista={props} />
      <Chave title="Chave inferior" etapas={ETAPAS_INFERIOR} lista={props} />
      <SeriesGroup title="Grande Final" slots={GRANDE_FINAL} lista={props} />
    </>
  );
}

function Chave(props: { title: string; etapas: Etapa[]; lista: ListaProps }) {
  return (
    <section class="room-bracket__chave">
      <h3 class="room-bracket__chave-title">{props.title}</h3>
      <div class="room-bracket__rounds">
        <For each={props.etapas}>
          {(etapa) => <SeriesGroup title={etapa.title} slots={etapa.slots} lista={props.lista} />}
        </For>
      </div>
    </section>
  );
}

function SeriesGroup(props: { title: string; slots: SlotId[]; lista: ListaProps }) {
  return (
    <section class="room-bracket__group">
      <h3 class="room-bracket__group-title">{props.title}</h3>
      <ul class="room-bracket__series-list">
        <For each={props.slots}>{(slotId) => <SeriesCard lista={props.lista} slotId={slotId} />}</For>
      </ul>
    </section>
  );
}

function SeriesCard(props: { lista: ListaProps; slotId: SlotId }) {
  const store = () => props.lista.store;
  const torneio = () => store().tournament();
  const serie = (): TournamentSeriesWire | null => torneio()?.series.find((s) => s.slotId === props.slotId) ?? null;
  const ctx = () => revelacaoDaSala(store());

  const timePorId = (id: string | null): TournamentTeamWire | null => {
    if (id === null) return null;
    return torneio()?.teams.find((t) => t.id === id) ?? null;
  };

  const revelada = () => {
    const s = serie();
    const c = ctx();
    return s === null || c === null || serieRevelada(s, c);
  };

  /** O lado so mostra o time quando a serie que o alimenta ja foi revelada. */
  const ladoVisivel = (lado: "teamA" | "teamB") => {
    const t = torneio();
    const c = ctx();
    return t === null || c === null || ladoRevelado(props.slotId, lado, t, c);
  };

  const timeA = () => (ladoVisivel("teamA") ? timePorId(serie()?.teamAId ?? null) : null);
  const timeB = () => (ladoVisivel("teamB") ? timePorId(serie()?.teamBId ?? null) : null);
  const winsDe = (id: string | null) => (id === null ? 0 : serie()?.wins[id] ?? 0);
  const gamesPlayed = () => serie()?.gamesPlayed ?? 0;

  /**
   * Em sincronia o convidado nao escolhe (D-28) -- o servidor recusaria (G-1
   * da revisao final). O host escolhe pelo card, e a sala inteira vai junto
   * (o servidor move a sincronia com a escolha dele, D-28 revisto).
   */
  const sincronizada = () => torneio()?.sync != null;
  const clicavel = () => gamesPlayed() > 0 && (!sincronizada() || store().isHost());
  const status = () => serie()?.status ?? "pending";
  const vencedorId = () => (revelada() ? serie()?.winnerId ?? null : null);

  /** Serie que EU estou acompanhando agora — vem do roomState, nunca do nome do time. */
  const assistindo = () => {
    const meu = store().publicId();
    if (meu === null) return false;
    return torneio()?.watching[meu] === props.slotId;
  };

  /**
   * O torneio ja mudou (watching aponta pra esta serie) mas a timeline ainda
   * nao chegou na mensagem `games` separada — sem isso a tela fica em branco
   * por um instante bem visivel logo depois do clique.
   */
  const carregando = () => {
    if (!assistindo()) return false;
    const jogos = store().games();
    return jogos === null || jogos.slotId !== props.slotId;
  };

  /**
   * O meu time, pelo publicId — com a guarda de nulo (m-3 da revisao final):
   * na janela entre a conexao e o `welcome`, `null === null` marcaria todo
   * time de bot como meu.
   */
  const eMeu = (time: TournamentTeamWire | null) => {
    const meu = store().publicId();
    return meu !== null && time !== null && time.publicId === meu;
  };

  const apelidoDe = (time: TournamentTeamWire | null): string | null => {
    if (time === null || time.publicId === null) return null;
    return store().state()?.players.find((p) => p.publicId === time.publicId)?.nickname ?? null;
  };

  const eliminado = (time: TournamentTeamWire | null) => {
    if (time === null || props.lista.mostrarEliminados === false) return false;
    const t = torneio();
    const c = ctx();
    return t !== null && c !== null && eliminadoVisivel(time, t, c);
  };

  /** Um so texto dinamico: "3 × 1" contiguo no SSR, sem comentario de hidratacao. */
  const placar = () => {
    if (gamesPlayed() === 0) return "vs";
    if (!revelada()) return "? × ?";
    return `${winsDe(serie()?.teamAId ?? null)} × ${winsDe(serie()?.teamBId ?? null)}`;
  };

  const rotuloStatus = () => {
    if (gamesPlayed() > 0 && !revelada()) return "jogada · assista para ver";
    switch (status()) {
      case "pending":
        return "aguardando";
      case "ready":
        return "próxima rodada";
      case "in_progress":
        return "em andamento";
      case "complete":
        return "encerrada";
    }
  };

  const lado = (time: () => TournamentTeamWire | null) => (
    <span
      class="room-bracket__team-name"
      classList={{
        "is-mine": eMeu(time()),
        "is-eliminated": eliminado(time()),
        "is-winner": vencedorId() !== null && vencedorId() === time()?.id,
      }}
    >
      {nomeDoTime(time())}
      <Show when={apelidoDe(time())}>
        {(apelido) => <span class="room-bracket__nick">{apelido()}</span>}
      </Show>
      <Show when={eliminado(time())}>
        <span class="room-bracket__badge room-bracket__badge--eliminated">Eliminado</span>
      </Show>
    </span>
  );

  const corpo = () => (
    <>
      {lado(timeA)}
      <span class="room-bracket__score">{placar()}</span>
      {lado(timeB)}
      <span class="room-bracket__status">{rotuloStatus()}</span>
    </>
  );

  return (
    <li class="room-bracket__series-item">
      <Show
        when={clicavel()}
        fallback={
          <div
            class="room-bracket__series room-bracket__series--locked"
            classList={{ "is-ready": status() === "ready", "is-pending": status() === "pending" }}
          >
            {corpo()}
          </div>
        }
      >
        <button
          type="button"
          class="room-bracket__series"
          classList={{
            "is-watching": assistindo(),
            "is-hidden": !revelada(),
            "is-ready": status() === "ready",
            "is-pending": status() === "pending",
          }}
          title={revelada() ? undefined : "Assistir esta série · o resultado só aparece no fim"}
          onClick={() => store().setWatch(props.slotId)}
        >
          {corpo()}
        </button>
      </Show>
      <Show when={carregando()}>
        <p class="room-bracket__loading">Carregando a partida…</p>
      </Show>
    </li>
  );
}
