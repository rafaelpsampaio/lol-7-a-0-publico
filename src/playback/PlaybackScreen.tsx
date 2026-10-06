import { playerName } from "../data/playerPresentation";
/**
 * src/playback/PlaybackScreen.tsx
 *
 * Playback orchestration: AttributionNotice → RosterPortraits → GameTimer →
 * SpeedControls → WinProbBar → EventTicker → result overlay.
 *
 * PLAY-03: both teams' champion portraits visible throughout the match.
 * PLAY-04: win-probability bar updates visibly after each event (CSS transition).
 * PLAY-05: 1x/2x speed controls + skip-to-end wired into GameTimer.
 * PLAY-06: AttributionNotice renders FIRST, before any portrait or img mounts.
 *
 * Design decisions applied:
 *   D-12: GameTimer onEventReached drives win-prob update and ticker append
 *   D-14: winProbAfter sourced from last reached event (pre-computed — NOT recomputed)
 *   T-04-04: event/winner text via {value} JSX — no innerHTML
 *   T-04-06: AttributionNotice is rendered before any portrait (PLAY-06 ordering)
 *   T-04-07: cancelAnimationFrame still in onCleanup via GameTimer (runaway-loop guard)
 *   T-04-08: skip fires events in order via GameTimer skipSignal counter
 *   UI-SPEC PlaybackScreen: max-width 640px centered, timer + win-prob inline, ticker below
 *   UI-SPEC Match result overlay: fixed backdrop, Display-size winner text, "Jogar de novo"
 *   Copywriting Contract: all copy in pt-BR
 *
 * SolidJS conventions: class= (not className); signals called as functions.
 */

import { createSignal, Show } from "solid-js";
import type { MatchResult, GameEvent } from "./types";
import type { SpeedPreset } from "../sim/types";
import type { PlayerVersion, ChampionEntry } from "../data/schema";
import { GameTimer } from "./GameTimer";
import { EventTicker } from "./EventTicker";
import { BroadcastBar } from "./BroadcastBar";
import { TeamPanel } from "./TeamPanel";
import { RiftMap } from "./RiftMap";
import { EventHighlight } from "./EventHighlight";
import { WinProbBar } from "./WinProbBar";
import { AttributionNotice } from "./AttributionNotice";
import { SpeedControls } from "./SpeedControls";
import { awardScore, objectiveValue } from "./awards";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** The pre-computed match result from runMatch */
  result: MatchResult;
  /** Speed preset chosen before the draft (used by GameTimer for context; durations from MatchResult) */
  speedPreset: SpeedPreset;
  /** Called when the user clicks "Jogar de novo" to restart the draft */
  onPlayAgain: () => void;

  // PLAY-03: champion portrait data threaded from App.tsx
  /** User team's 5 players */
  userRoster: PlayerVersion[];
  /** Rival team's 5 players */
  rivalRoster: PlayerVersion[];
  /** User team playerId → championId assignments for this game */
  userChampions: Record<string, string>;
  /** Rival team playerId → championId assignments for this game */
  rivalChampions: Record<string, string>;
  /** Merged champion catalogue for id → {name, image} lookup */
  catalogue: ChampionEntry[];
  /** Team identities for the broadcast HUD */
  userTeamName: string;
  rivalTeamName: string;
  userTeamTag: string;
  rivalTeamTag: string;
  /** Current Bo5 series score (after this game). */
  seriesUserWins: number;
  seriesRivalWins: number;
  /**
   * Quem, de verdade, torce por qual lado — "user"/"rival" quando quem
   * assiste tem time nesta série (o enquadramento do motor, que so decide
   * qual lado veste de azul, pode nao bater com isso), `null` quando quem
   * assiste nao tem time nenhum na partida (espectador puro). Omitido =
   * `"user"`, o comportamento de sempre no solo (o time do jogador humano
   * e sempre o enquadramento "user" — ver series.ts:91-93).
   */
  perspectiva?: Perspectiva;
  /**
   * Texto do botao de continuar. Omitido = "Continuar", o de sempre no solo.
   * A sala (Fase 4) troca por "Proximo jogo" no meio da serie -- o mesmo
   * clique, so o rotulo muda conforme o contexto que so quem chama enxerga.
   */
  continueLabel?: string;
  /**
   * Chamado quando a partida termina de passar (o mesmo instante em que o
   * cartao de resultado aparece). A sala usa para saber que a pessoa viu o
   * jogo que decidiu a serie e pode revelar o resultado no chaveamento (D1).
   */
  onFimDaPartida?: () => void;
  /**
   * Segunda saida do cartao de resultado. O cartao cobre a tela inteira, e na
   * sala a unica saida era "Proximo jogo" -- quem queria voltar ao chaveamento
   * no meio da serie ficava preso (achado do teste de ponta a ponta do Rundown
   * da Sala 2). Omitidos = so o botao principal, como sempre no solo.
   */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

// ---------------------------------------------------------------------------
// Pure result-framing helpers (Fase 2 — testaveis sem depender do
// GameTimer/rAF, que so completa `isComplete` no navegador de verdade)
// ---------------------------------------------------------------------------

export type Perspectiva = "user" | "rival" | null;

/**
 * `undefined` (prop omitida, o solo) vale "user"; `null` (espectador puro da
 * sala) continua null. `??` nao serve aqui: ele trata null igual a undefined,
 * e o espectador lia "Seu time venceu!" numa partida sem time dele.
 */
export function perspectivaEfetiva(p: Perspectiva | undefined): Perspectiva {
  return p === undefined ? "user" : p;
}

/** Bo5: decidida assim que um lado chega a 3 vitorias (BRKT-02 / D-05). */
export function serieEstaDecidida(seriesUserWins: number, seriesRivalWins: number): boolean {
  return seriesUserWins >= 3 || seriesRivalWins >= 3;
}

/** Quantas partidas faltam, no minimo, para a serie fechar — o lado na frente
 * so precisa desse tanto de vitorias a mais; pode durar mais se o outro lado
 * reagir. */
export function partidasRestantesMinimo(seriesUserWins: number, seriesRivalWins: number): number {
  return Math.max(0, 3 - Math.max(seriesUserWins, seriesRivalWins));
}

/** "A série continua — faltam pelo menos 2 partidas para decidir." (concordancia certa no singular). */
export function textoProximoPasso(seriesUserWins: number, seriesRivalWins: number): string {
  const n = partidasRestantesMinimo(seriesUserWins, seriesRivalWins);
  return n === 1
    ? "A série continua · falta pelo menos 1 partida para decidir."
    : `A série continua · faltam pelo menos ${n} partidas para decidir.`;
}

/**
 * Texto/classe do veredito, relativos a quem assiste (perspectiva) e ao
 * escopo (partida jogada agora vs serie inteira, quando esta a decide).
 * Achado do usuario: sem o escopo explicito, "Seu time venceu!" no meio de
 * uma MD5 pode ser lido como "venceu tudo" por quem nao percebeu que era
 * melhor-de-5.
 */
export function resultadoDoJogo(
  vencedor: "user" | "rival",
  perspectiva: Perspectiva,
  serieDecidida: boolean,
  nomeUser: string,
  nomeRival: string
): { texto: string; classeTitulo: string; classeCard: string | null } {
  const escopo = serieDecidida ? "a série" : "esta partida";
  // Trofeu so para quem venceu (ou para o espectador neutro): "🏆 Derrota"
  // aparecia no jogo que fechava a serie contra quem assistia.
  const marca = serieDecidida && (perspectiva === null || vencedor === perspectiva) ? "🏆 " : "";

  // O nome de quem venceu vai sempre no texto: "Seu time"/"Rival" sozinhos
  // dependem de quem esta lendo saber de que lado esta (Rundown da Sala 2, S9).
  const nomeVencedor = vencedor === "user" ? nomeUser : nomeRival;
  if (perspectiva === null) {
    return {
      texto: `${marca}${nomeVencedor} venceu ${escopo}.`,
      classeTitulo: "result-winner result-winner--neutral",
      classeCard: null,
    };
  }
  const euGanhei = vencedor === perspectiva;
  return euGanhei
    ? {
        texto: `${marca}Vitória · ${nomeVencedor} venceu ${escopo}!`,
        classeTitulo: "result-winner result-winner--user",
        classeCard: "result-card--vitoria",
      }
    : {
        texto: `${marca}Derrota · ${nomeVencedor} venceu ${escopo}.`,
        classeTitulo: "result-winner result-winner--rival",
        classeCard: "result-card--derrota",
      };
}

/**
 * Como chamar cada lado da partida na tela (barra e texto de probabilidade,
 * selo VOCÊ do placar). O motor so conhece "user" e "rival" -- quem e quem
 * para QUEM ASSISTE vem da `perspectiva`:
 *  - omitida (solo): o humano e sempre o lado "user" -> "Você" × "Rival";
 *  - "user"/"rival" (sala, quem assiste tem time na serie): o seu lado e
 *    "Você", o outro e a sigla do adversario;
 *  - null (sala, espectador sem time na serie): as duas siglas, sem "Você".
 * Antes a sala herdava o "Você X% — Y% Rival" do solo, preso ao lado A: quem
 * torcia pelo time B via "Você 90%" enquanto perdia (S9).
 */
export function rotulosDosLados(
  perspectiva: Perspectiva | undefined,
  userTag: string,
  rivalTag: string
): { user: string; rival: string; voce: "user" | "rival" | null } {
  if (perspectiva === undefined) return { user: "Você", rival: "Rival", voce: "user" };
  if (perspectiva === "user") return { user: "Você", rival: rivalTag, voce: "user" };
  if (perspectiva === "rival") return { user: userTag, rival: "Você", voce: "rival" };
  return { user: userTag, rival: rivalTag, voce: null };
}

/**
 * Resumo da partida em fatos brutos, com a sigla de cada lado no numero que e
 * dele: "12/8 em abates" nao diz de quem e o 12 (S9).
 */
export function resumoDaPartida(
  gameTimeMs: number,
  s: { userKills: number; rivalKills: number; userTowers: number; rivalTowers: number; userDragons: number; rivalDragons: number },
  userTag: string,
  rivalTag: string
): string {
  const mm = Math.floor(gameTimeMs / 60000);
  const ss = String(Math.floor(gameTimeMs / 1000) % 60).padStart(2, "0");
  return (
    `Partida encerrada em ${mm}:${ss} · ` +
    `Abates ${userTag} ${s.userKills} × ${s.rivalKills} ${rivalTag} · ` +
    `Torres ${s.userTowers} × ${s.rivalTowers} · ` +
    `Dragões ${s.userDragons} × ${s.rivalDragons}`
  );
}

// ---------------------------------------------------------------------------
// PlaybackScreen component
// ---------------------------------------------------------------------------

export function PlaybackScreen(props: Props) {
  // Track which events have been reached so far (append-driven list for EventTicker)
  const [reachedEvents, setReachedEvents] = createSignal<GameEvent[]>([]);
  // Whether the match is complete (GG fired + timer finished)
  const [isComplete, setIsComplete] = createSignal(false);

  // PLAY-05: playback speed signal (1x default)
  const [speed, setSpeed] = createSignal<1 | 2>(1);
  const [paused, setPaused] = createSignal(false);

  // PLAY-05: skip-to-end counter — increment to request a skip (monotonic signal)
  // GameTimer reads this as skipSignal; any increase triggers skip-to-end.
  const [skipCount, setSkipCount] = createSignal(0);
  function requestSkip() {
    setSkipCount((n) => n + 1);
  }

  // Called by GameTimer each time an event's playbackMs threshold is crossed
  function handleEventReached(event: GameEvent, _index: number) {
    setReachedEvents((prev) => [...prev, event]);
  }

  // Called by GameTimer when playback reaches totalPlaybackMs
  function handleComplete() {
    setIsComplete(true);
    props.onFimDaPartida?.();
  }

  // Derive current win probability from the latest reached event's winProbAfter.
  // DO NOT recompute — read winProbAfter only (D-14, PLAY-04).
  const currentWinProb = (): number | null => {
    const events = reachedEvents();
    if (events.length === 0) return null;
    return events[events.length - 1].winProbAfter;
  };

  // Latest reached event drives the live scoreboard HUD (Phase 9).
  const latestEvent = (): GameEvent | null => {
    const events = reachedEvents();
    return events.length === 0 ? null : events[events.length - 1];
  };

  // Veredito (pt-BR Copywriting Contract) — relativo a quem assiste e ao
  // escopo (partida vs serie), nao ao enquadramento cru do motor.
  const serieDecidida = () => serieEstaDecidida(props.seriesUserWins, props.seriesRivalWins);
  const resultado = () =>
    resultadoDoJogo(
      props.result.winner,
      perspectivaEfetiva(props.perspectiva),
      serieDecidida(),
      props.userTeamName,
      props.rivalTeamName
    );

  // --- MVP / Bagre + result summary, computed from the final event ----------
  type Award = {
    side: "user" | "rival";
    player: string;
    champName: string;
    champImage?: string;
    line: string; // "3/1/7"
  };

  const finalEvent = () => props.result.events[props.result.events.length - 1];

  const champInfo = (side: "user" | "rival") => {
    const roster = side === "user" ? props.userRoster : props.rivalRoster;
    const champs = side === "user" ? props.userChampions : props.rivalChampions;
    const byId = new Map(props.catalogue.map((c) => [c.id, c]));
    const out: Record<string, { player: string; name: string; image?: string }> = {};
    for (const p of roster) {
      const e = champs[p.id] ? byId.get(champs[p.id]) : undefined;
      out[p.primaryRole] = {
        player: playerName(p),
        name: e?.name ?? "?",
        image: e?.image,
      };
    }
    return out;
  };

  const awards = (): { mvp: Award; bagre: Award; summary: string } | null => {
    const ev = finalEvent();
    if (!ev?.map || !ev.score) return null;
    const roles: ("top" | "jungle" | "mid" | "adc" | "support")[] = ["top", "jungle", "mid", "adc", "support"];
    const sc = ev.score;
    const all: (Award & { score: number })[] = [];
    for (const side of ["user", "rival"] as const) {
      const info = champInfo(side);
      // Team-level context for the mixed MVP/Bagre score (gold + objectives + bias).
      const teamKA = roles.reduce((sum, r) => {
        const p = ev.map![side].players[r];
        return sum + p.kills + p.assists;
      }, 0);
      const teamObj =
        side === "user"
          ? objectiveValue(sc.userDragons, sc.userTowers, sc.userBaron ? 1 : 0)
          : objectiveValue(sc.rivalDragons, sc.rivalTowers, sc.rivalBaron ? 1 : 0);
      const onWinningTeam = side === props.result.winner;
      for (const role of roles) {
        const ps = ev.map[side].players[role];
        const i = info[role];
        const score = awardScore(
          { kills: ps.kills, deaths: ps.deaths, assists: ps.assists, gold: ps.gold },
          { teamObjValue: teamObj, teamKA, onWinningTeam }
        );
        all.push({
          side,
          player: i?.player ?? "?",
          champName: i?.name ?? "?",
          champImage: i?.image,
          line: `${ps.kills}/${ps.deaths}/${ps.assists}`,
          score,
        });
      }
    }
    let mvp = all[0], bagre = all[0];
    for (const a of all) {
      if (a.score > mvp.score) mvp = a;
      if (a.score < bagre.score) bagre = a;
    }
    // Fato bruto, sem veredito embutido (Fase 2 item 1) — o titulo acima ja
    // diz quem venceu; repetir isso colado no placar e o que faz uma virada
    // legitima do motor parecer contraditoria.
    const summary = resumoDaPartida(ev.gameTimeMs, ev.score, props.userTeamTag, props.rivalTeamTag);
    return { mvp, bagre, summary };
  };

  const rotulos = () => rotulosDosLados(props.perspectiva, props.userTeamTag, props.rivalTeamTag);
  const tagDoLado = (side: "user" | "rival") => (side === "user" ? props.userTeamTag : props.rivalTeamTag);

  return (
    <div class="playback-screen" aria-label="Tela de playback">
      {/* ----------------------------------------------------------------- */}
      {/* PLAY-06: AttributionNotice FIRST — before any portrait or img      */}
      {/* T-04-06: ordering gate — this node must precede all portrait nodes  */}
      {/* ----------------------------------------------------------------- */}
      <AttributionNotice />

      {/* ----------------------------------------------------------------- */}
      {/* LoL broadcast-style top bar — full width                          */}
      {/* ----------------------------------------------------------------- */}
      <BroadcastBar
        event={latestEvent()}
        userTeamName={props.userTeamName}
        rivalTeamName={props.rivalTeamName}
        userTeamTag={props.userTeamTag}
        rivalTeamTag={props.rivalTeamTag}
        ladoVoce={rotulos().voce}
      />
      <WinProbBar winProb={currentWinProb()} rotuloUser={rotulos().user} rotuloRival={rotulos().rival} />

      {/* ----------------------------------------------------------------- */}
      {/* Broadcast stage: team panel | map + clock | team panel            */}
      {/* ----------------------------------------------------------------- */}
      <div class="bcast-stage">
        <TeamPanel
          event={latestEvent()}
          side="user"
          teamName={props.userTeamName}
          teamTag={props.userTeamTag}
          roster={props.userRoster}
          champions={props.userChampions}
          catalogue={props.catalogue}
        />

        <div class="bcast-center-col">
          <div class="clock-row">
            <GameTimer
              events={props.result.events}
              totalPlaybackMs={props.result.totalPlaybackMs}
              onEventReached={handleEventReached}
              onComplete={handleComplete}
              speed={speed}
              paused={paused}
              skipSignal={skipCount}
            />
          </div>
          <div class="rift-stage">
            <RiftMap
              event={latestEvent()}
              userRoster={props.userRoster}
              rivalRoster={props.rivalRoster}
              userChampions={props.userChampions}
              rivalChampions={props.rivalChampions}
              catalogue={props.catalogue}
            />
            <EventHighlight event={latestEvent()} />
          </div>
          <SpeedControls
            speed={speed()}
            paused={paused()}
            onPauseToggle={() => setPaused(value => !value)}
            onSpeedChange={setSpeed}
            onSkip={requestSkip}
            disabled={isComplete()}
          />

        </div>

        <TeamPanel
          event={latestEvent()}
          side="rival"
          teamName={props.rivalTeamName}
          teamTag={props.rivalTeamTag}
          roster={props.rivalRoster}
          champions={props.rivalChampions}
          catalogue={props.catalogue}
        />
        <div class="bcast-feed">
          <EventTicker events={reachedEvents()} rotuloUser={rotulos().user} rotuloRival={rotulos().rival} />
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Match result overlay — shown after GG + timer complete             */}
      {/* ----------------------------------------------------------------- */}
      <Show when={isComplete()}>
        <div
          class="result-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Resultado da partida"
        >
          <div
            class="result-card"
            classList={{
              "result-card--vitoria": resultado().classeCard === "result-card--vitoria",
              "result-card--derrota": resultado().classeCard === "result-card--derrota",
            }}
          >
            <div
              class="result-series"
              classList={{ "result-series--encerrada": serieDecidida() }}
              aria-label="Placar da série"
            >
              <span class="result-series-tag result-series-tag--user">{props.userTeamTag}</span>
              <span class="result-series-score">{props.seriesUserWins} × {props.seriesRivalWins}</span>
              <span class="result-series-tag result-series-tag--rival">{props.rivalTeamTag}</span>
              <span class="result-series-label">
                {serieDecidida() ? "SÉRIE ENCERRADA · MELHOR DE 5" : "SÉRIE EM ANDAMENTO · MELHOR DE 5"}
              </span>
            </div>
            <p class={resultado().classeTitulo}>{resultado().texto}</p>
            <Show when={!serieDecidida()}>
              <p class="result-next-step">{textoProximoPasso(props.seriesUserWins, props.seriesRivalWins)}</p>
            </Show>
            <Show when={awards()}>
              {(a) => (
                <>
                  <p class="result-summary">{a().summary}</p>
                  <div class="result-awards">
                    <div class="award award--mvp">
                      <span class="award-label">MVP</span>
                      <Show when={a().mvp.champImage} fallback={<span class="award-portrait award-portrait--fallback">{a().mvp.champName.slice(0, 3)}</span>}>
                        <img class="award-portrait" src={`/champions/${a().mvp.champImage}`} alt={a().mvp.champName} />
                      </Show>
                      <span class="award-player">{a().mvp.player}</span>
                      <span class="award-team">{tagDoLado(a().mvp.side)}</span>
                      <span class="award-line">{a().mvp.line}</span>
                    </div>
                    <div class="award award--bagre">
                      <span class="award-label">BAGRE</span>
                      <Show when={a().bagre.champImage} fallback={<span class="award-portrait award-portrait--fallback">{a().bagre.champName.slice(0, 3)}</span>}>
                        <img class="award-portrait" src={`/champions/${a().bagre.champImage}`} alt={a().bagre.champName} />
                      </Show>
                      <span class="award-player">{a().bagre.player}</span>
                      <span class="award-team">{tagDoLado(a().bagre.side)}</span>
                      <span class="award-line">{a().bagre.line}</span>
                    </div>
                  </div>
                </>
              )}
            </Show>
            <div class="result-actions">
              <button
                class="play-again-btn"
                onClick={props.onPlayAgain}
                aria-label={props.continueLabel ?? "Continuar"}
              >
                {props.continueLabel ?? "Continuar"}
              </button>
              <Show when={props.onSecondary}>
                {(acao) => (
                  <button class="play-again-btn play-again-btn--secondary" onClick={() => acao()()}>
                    {props.secondaryLabel ?? "Voltar"}
                  </button>
                )}
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
