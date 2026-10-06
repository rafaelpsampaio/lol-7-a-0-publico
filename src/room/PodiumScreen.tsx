/**
 * src/room/PodiumScreen.tsx
 *
 * Tela final (fase `finished`). Desde o Rundown da Sala 2 (D2) a noite sempre
 * termina com campeao -- "Pular para o pódio" simula o resto na hora. O ramo
 * sem campeao continua aqui so para salas gravadas antes disso (a urna antiga
 * encerrava sem campeao): ele nao inventa um vencedor que nao aconteceu.
 *
 * Com campeao: entrada animada (Fase 7), classificacao final dos 8 times
 * pelo chaveamento (D9), destaques do torneio por media por jogo (S22,
 * calculados no servidor -- D-27) e, para o host, a Revanche.
 *
 * As series continuam clicaveis (D-32): a noite acaba, o replay nao. O
 * clique so chama `setWatch` -- quem decide mostrar a serie e o RoomScreen.
 */

import { For, Show } from "solid-js";
import type { RoomStore } from "../net/store";
import type { TournamentSeriesWire, TournamentTeamWire } from "../../server/protocol";
import { BracketSeriesList } from "./BracketSeriesList";

interface Props {
  store: RoomStore;
}

export interface Colocacao {
  /** "1º", "2º", "3º", "4º", "5º–6º", "7º–8º" */
  posicao: string;
  teamId: string;
}

/** Quem perdeu a serie (null se ela nao terminou). */
function perdedor(s: TournamentSeriesWire | undefined): string | null {
  if (s === undefined || s.winnerId === null) return null;
  return s.teamAId === s.winnerId ? s.teamBId : s.teamAId;
}

/**
 * Classificacao final pela chave dupla de 8: campeao, vice (perdeu a Grande
 * Final), 3º (perdeu a final da inferior), 4º (semifinal da inferior), 5º–6º
 * (2ª fase da inferior), 7º–8º (1ª fase da inferior). Vazio sem campeao.
 */
export function classificacaoFinal(series: TournamentSeriesWire[], championId: string | null): Colocacao[] {
  if (championId === null) return [];
  const de = (slot: string) => series.find((s) => s.slotId === slot);
  const saida: Colocacao[] = [{ posicao: "1º", teamId: championId }];
  const empurra = (posicao: string, teamId: string | null) => {
    if (teamId !== null) saida.push({ posicao, teamId });
  };
  empurra("2º", perdedor(de("GF")));
  empurra("3º", perdedor(de("LB_F")));
  empurra("4º", perdedor(de("LB_SF")));
  empurra("5º–6º", perdedor(de("LB_R2_1")));
  empurra("5º–6º", perdedor(de("LB_R2_2")));
  empurra("7º–8º", perdedor(de("LB_R1_1")));
  empurra("7º–8º", perdedor(de("LB_R1_2")));
  return saida;
}

export function PodiumScreen(props: Props) {
  const torneio = () => props.store.tournament();
  const championId = () => torneio()?.championId ?? null;
  const timePorId = (id: string): TournamentTeamWire | null => torneio()?.teams.find((t) => t.id === id) ?? null;

  const campeao = (): TournamentTeamWire | null => {
    const id = championId();
    return id === null ? null : timePorId(id);
  };

  const apelidoDe = (time: TournamentTeamWire | null): string | null => {
    if (time === null || time.publicId === null) return null;
    return props.store.state()?.players.find((p) => p.publicId === time.publicId)?.nickname ?? null;
  };

  const eMeu = (time: TournamentTeamWire | null) => {
    const meu = props.store.publicId();
    return meu !== null && time !== null && time.publicId === meu;
  };

  const classificacao = () => classificacaoFinal(torneio()?.series ?? [], championId());

  /** Os times ainda vivos quando a sala parou -- so no ramo antigo, sem campeao. */
  const sobreviventes = () => (torneio()?.teams ?? []).filter((t) => !t.eliminated);

  /** Uma expressao so por texto (SSR do Solid separa expressoes vizinhas). */
  const nomeCompleto = (time: TournamentTeamWire) => `${time.tag} ${time.displayName}`;
  const tagDoTime = (teamId: string) => timePorId(teamId)?.tag ?? "";

  return (
    <Show when={torneio() !== null}>
      <section class="room-podium">
        <h2 class="room-title">Fim de noite</h2>

        <Show
          when={championId() !== null}
          fallback={
            <div class="room-podium__stopped room-card">
              <p class="room-podium__stopped-note">A sala encerrou por votação · o chaveamento parou pela metade.</p>
              <h3 class="room-podium__survivors-title">Quem chegou mais longe</h3>
              <ul class="room-podium__survivors">
                <For each={sobreviventes()}>{(time) => <li class="room-podium__survivor">{nomeCompleto(time)}</li>}</For>
              </ul>
            </div>
          }
        >
          <div class="room-podium__champion">
            <p class="room-podium__champion-label">Campeão</p>
            <Show when={campeao()} fallback={<p class="room-podium__champion-name">Time desconhecido</p>}>
              {(time) => (
                <>
                  <p class="room-podium__champion-name">
                    <strong>{nomeCompleto(time())}</strong>
                  </p>
                  <Show when={apelidoDe(time())}>
                    {(apelido) => <p class="room-podium__champion-nick">{`de ${apelido()}`}</p>}
                  </Show>
                </>
              )}
            </Show>
          </div>

          <div class="room-card">
            <h3 class="room-subtitle">Classificação final</h3>
            <ol class="room-podium__ranking">
              <For each={classificacao()}>
                {(c) => {
                  const time = () => timePorId(c.teamId);
                  return (
                    <li class="room-podium__rank" classList={{ "is-mine": eMeu(time()), "is-first": c.posicao === "1º" }}>
                      <span class="room-podium__rank-pos">{c.posicao}</span>
                      <span class="room-podium__rank-team">{time() === null ? c.teamId : nomeCompleto(time()!)}</span>
                      <span class="room-podium__rank-nick">{apelidoDe(time()) ?? "bot"}</span>
                      <Show when={eMeu(time())}>
                        <span class="room-badge room-badge--you">você</span>
                      </Show>
                    </li>
                  );
                }}
              </For>
            </ol>
          </div>
        </Show>

        <Show when={torneio()?.awards}>
          {(a) => (
            <div class="series-awards">
              <span class="series-awards-title">Destaques do torneio (média por jogo)</span>
              <div class="result-awards">
                <div class="award award--mvp">
                  <span class="award-label">MVP DO TORNEIO</span>
                  <Show
                    when={a().mvp.image}
                    fallback={<span class="award-portrait award-portrait--fallback">{a().mvp.name.slice(0, 3)}</span>}
                  >
                    <img class="award-portrait" src={`/champions/${a().mvp.image}`} alt={a().mvp.name} />
                  </Show>
                  <span class="award-player">{a().mvp.player}</span>
                  <span class="award-team">{tagDoTime(a().mvp.teamId)}</span>
                  <span class="award-line">{a().mvp.line}</span>
                </div>
                <div class="award award--bagre">
                  <span class="award-label">BAGRE DO TORNEIO</span>
                  <Show
                    when={a().bagre.image}
                    fallback={<span class="award-portrait award-portrait--fallback">{a().bagre.name.slice(0, 3)}</span>}
                  >
                    <img class="award-portrait" src={`/champions/${a().bagre.image}`} alt={a().bagre.name} />
                  </Show>
                  <span class="award-player">{a().bagre.player}</span>
                  <span class="award-team">{tagDoTime(a().bagre.teamId)}</span>
                  <span class="award-line">{a().bagre.line}</span>
                </div>
              </div>
            </div>
          )}
        </Show>

        <div class="room-card room-podium__next">
          <Show
            when={props.store.isHost()}
            fallback={
              <p class="room-help">
                Se o host começar uma revanche, todo mundo volta ao lobby com os mesmos times para um draft novo.
              </p>
            }
          >
            <button type="button" class="room-btn room-btn--primary" onClick={() => props.store.rematch()}>
              Revanche · jogar de novo com a mesma turma
            </button>
            <p class="room-help">Volta todo mundo ao lobby com os mesmos nomes de time, para um draft novo.</p>
          </Show>
        </div>

        <section class="room-podium__series-group">
          <h3 class="room-subtitle">Chaveamento (clique numa série para rever)</h3>
          <BracketSeriesList store={props.store} mostrarEliminados={false} />
        </section>
      </section>
    </Show>
  );
}
