import { playerName } from "../data/playerPresentation";
/**
 * src/tournament/SeriesResultScreen.tsx
 *
 * Series result screen — shown after each Bo5 completes.
 * Displays the game-by-game score table + per-game champion portraits.
 *
 * BRKT-04: game-by-game score + champion portraits per game.
 * Pitfall 1: champion data comes from StoredGame.champions — NEVER calls
 *   assignFearlessChampions (that would re-compute, not re-use stored data).
 * T-05-07: team names and winner name via {} JSX — no innerHTML.
 * Accessibility: <table> with <caption> "Resultado da série".
 *
 * SolidJS conventions: class= not className; <For> for lists; signals called as functions.
 */

import { createMemo, For, Show } from "solid-js";
import type { SlotId, SeriesState, TournamentState } from "./schema";
import { SLOT_FEED_IN } from "./schema";
import type { ChampionEntry, Role } from "../data/schema";
import { RosterPortraits } from "../playback/RosterPortraits";
import { awardScore, objectiveValue } from "../playback/awards";
import { rosterRating, isUpset } from "../sim/power";

// ---------------------------------------------------------------------------
// Zebra helpers (Phase 28, plano 28-04, D-03/D-04/D-05): ADICAO DE ESCOPO
//
// Pura, sem accessors do Solid, para ser testavel isoladamente sem montar o
// componente (nao ha convencao de teste de componente Solid neste projeto).
// Recebem os ratings JA CALCULADOS (nao o roster) de proposito: o chamador
// (o componente abaixo) calcula rosterRating uma UNICA VEZ por render, em
// accessor memoizado, e passa o numero pronto -- para que isGameUpset,
// chamada uma vez por celula em gameCells(), nunca recalcule rosterRating.
// rosterRating/isUpset SAO a UNICA definicao de rating e de zebra do
// projeto (src/sim/power.ts); nada aqui redefine nocao propria de rating.
// D-05: os dois derivam so de estado FINAL (winnerId de SeriesState/
// StoredGame), nunca de win probability momentanea.
// ---------------------------------------------------------------------------

/**
 * Verdadeiro quando `winnerId` (vencedor da SERIE, D-04 primeira metade)
 * aponta para o time de MENOR rating entre `teamAId`/`teamBId`, com gap
 * igual ou acima de `UPSET_MIN_GAP` (via `isUpset`).
 */
export function isSeriesUpset(
  ratingA: number,
  ratingB: number,
  teamAId: string,
  teamBId: string,
  winnerId: string | null
): boolean {
  if (!winnerId) return false;
  if (winnerId !== teamAId && winnerId !== teamBId) return false;
  const winnerIsA = winnerId === teamAId;
  const winnerRating = winnerIsA ? ratingA : ratingB;
  const loserRating = winnerIsA ? ratingB : ratingA;
  return isUpset(winnerRating, loserRating);
}

/**
 * Verdadeiro quando `gameWinnerId` (vencedor de UM `StoredGame`, D-04
 * segunda metade: "mesmo perdendo a serie no fim") aponta para o time de
 * MENOR rating entre `teamAId`/`teamBId`. Independente de `isSeriesUpset`:
 * um jogo pode ser zebra numa serie que o azarao perdeu no fim.
 */
export function isGameUpset(
  ratingA: number,
  ratingB: number,
  teamAId: string,
  teamBId: string,
  gameWinnerId: string
): boolean {
  const winnerIsA = gameWinnerId === teamAId;
  const winnerIsB = gameWinnerId === teamBId;
  if (!winnerIsA && !winnerIsB) return false;
  const winnerRating = winnerIsA ? ratingA : ratingB;
  const loserRating = winnerIsA ? ratingB : ratingA;
  return isUpset(winnerRating, loserRating);
}

/**
 * Id do time cuja perspectiva a linha de W/L da tabela deve mostrar: o meu
 * (`isUser`), quando eu tenho time nesta serie; `null` caso nenhum dos dois
 * seja meu (espectador puro, ou solo -- la sempre ha exatamente um isUser).
 * Achado do teste de sala (2026-08-27): a linha da tabela rotulava sempre
 * teamA, mas `gameCells()` mostrava a perspectiva do MEU time quando ele
 * era teamB -- rotulo de um time, dado de outro, na mesma linha.
 */
export function idDoTimeNaLinha(
  teamA: { id: string; isUser: boolean } | undefined,
  teamB: { id: string; isUser: boolean } | undefined
): string | null {
  return (teamA?.isUser ? teamA.id : teamB?.isUser ? teamB.id : null) ?? null;
}

/**
 * Quem perde esta serie sai do torneio? So se nenhum outro slot o recebe por
 * `loseFrom` (SLOT_FEED_IN). Perder na chave superior derruba para a
 * inferior; a tela dizia "Sua equipe foi eliminada" para isso tambem.
 */
export function perdedorEliminado(slotId: SlotId): boolean {
  return !Object.values(SLOT_FEED_IN).some(
    (f) =>
      ("loseFrom" in f.teamA && f.teamA.loseFrom === slotId) ||
      ("loseFrom" in f.teamB && f.teamB.loseFrom === slotId)
  );
}

/**
 * Titulo para quem NAO tem time na serie (espectador puro da sala): so
 * informa quem venceu. Na Grande Final o vencedor nao "avanca" para lugar
 * nenhum -- e o campeao.
 */
export function tituloNeutro(slotId: SlotId, nomeVencedor: string): string {
  return slotId === "GF" ? `${nomeVencedor} é o campeão!` : `${nomeVencedor} avançou.`;
}

/**
 * Titulo para quem TEM time na serie. Sempre com o nome do time: "Sua equipe
 * venceu" sozinho depende de quem le saber de que lado estava, e na sala o
 * seu time pode estar em qualquer lado da tela (Rundown da Sala 2, S9).
 */
export function tituloDoMeuTime(
  slotId: SlotId,
  venci: boolean,
  nomeMeuTime: string,
  nomeVencedor: string
): string {
  if (venci) {
    return slotId === "GF"
      ? `🏆 ${nomeMeuTime} é o campeão do torneio!`
      : `Vitória · ${nomeMeuTime} venceu a série!`;
  }
  if (slotId === "GF") return `Derrota na Grande Final · ${nomeVencedor} é o campeão. ${nomeMeuTime} termina como vice.`;
  return perdedorEliminado(slotId)
    ? `Derrota · ${nomeVencedor} venceu a série. ${nomeMeuTime} está eliminado.`
    : `Derrota · ${nomeVencedor} venceu a série. ${nomeMeuTime} cai para a chave inferior.`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  slotId: SlotId;
  series: SeriesState;
  teams: TournamentState["teams"];
  catalogue: ChampionEntry[];
  onContinue: () => void;
  onReplay: () => void;
  /** Texto do botao principal. Omitido = "Continuar", o de sempre no solo. */
  continueLabel?: string;
}

// ---------------------------------------------------------------------------
// SeriesResultScreen component
// ---------------------------------------------------------------------------

export function SeriesResultScreen(props: Props) {
  const teamA = () => props.teams[props.series.teamAId ?? ""];
  const teamB = () => props.teams[props.series.teamBId ?? ""];

  // --- Series MVP / Bagre: aggregate per-player stats across all games -------
  // Uses the shared mixed score (KDA + gold + objectives + winner/loser bias).
  const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];
  type Agg = { playerId: string; player: string; k: number; d: number; a: number; gold: number; champId?: string };

  const seriesAwards = () => {
    const a = teamA(), b = teamB();
    if (!a || !b) return null;
    const byId = new Map(props.catalogue.map((c) => [c.id, c]));
    const mk = (team: typeof a) => {
      const m = {} as Record<Role, Agg>;
      for (const p of team.roster) m[p.primaryRole] = { playerId: p.id, player: playerName(p), k: 0, d: 0, a: 0, gold: 0 };
      return m;
    };
    const aggA = mk(a), aggB = mk(b);
    // Team objective tallies across the series (frame-mapped per game).
    let dragA = 0, towA = 0, barA = 0, dragB = 0, towB = 0, barB = 0;

    for (const g of props.series.games) {
      const last = g.events[g.events.length - 1];
      if (!last?.map) continue;
      // The events are framed around userFrameTeamId (the human when it played);
      // map.user / score.user* belong to that team, not necessarily bracket teamA.
      const aIsUserFrame = (g.userFrameTeamId ?? a.id) === a.id;
      const aMap = aIsUserFrame ? last.map.user : last.map.rival;
      const bMap = aIsUserFrame ? last.map.rival : last.map.user;
      for (const role of ROLES) {
        const pa = aggA[role], pb = aggB[role];
        const sa = aMap.players[role], sb = bMap.players[role];
        if (pa) { pa.k += sa.kills; pa.d += sa.deaths; pa.a += sa.assists; pa.gold += sa.gold; pa.champId = g.champions.teamA[pa.playerId] ?? pa.champId; }
        if (pb) { pb.k += sb.kills; pb.d += sb.deaths; pb.a += sb.assists; pb.gold += sb.gold; pb.champId = g.champions.teamB[pb.playerId] ?? pb.champId; }
      }
      if (last.score) {
        const sc = last.score;
        const aDr = aIsUserFrame ? sc.userDragons : sc.rivalDragons;
        const aTw = aIsUserFrame ? sc.userTowers : sc.rivalTowers;
        const aBa = aIsUserFrame ? sc.userBaron : sc.rivalBaron;
        const bDr = aIsUserFrame ? sc.rivalDragons : sc.userDragons;
        const bTw = aIsUserFrame ? sc.rivalTowers : sc.userTowers;
        const bBa = aIsUserFrame ? sc.rivalBaron : sc.userBaron;
        dragA += aDr; towA += aTw; barA += aBa ? 1 : 0;
        dragB += bDr; towB += bTw; barB += bBa ? 1 : 0;
      }
    }

    const teamKA = (agg: Record<Role, Agg>) =>
      Object.values(agg).reduce((s, x) => s + x.k + x.a, 0);
    const ctxA = { teamObjValue: objectiveValue(dragA, towA, barA), teamKA: teamKA(aggA), onWinningTeam: props.series.winnerId === a.id };
    const ctxB = { teamObjValue: objectiveValue(dragB, towB, barB), teamKA: teamKA(aggB), onWinningTeam: props.series.winnerId === b.id };

    const scored = [
      ...Object.values(aggA).map((x) => ({ x, s: awardScore({ kills: x.k, deaths: x.d, assists: x.a, gold: x.gold }, ctxA) })),
      ...Object.values(aggB).map((x) => ({ x, s: awardScore({ kills: x.k, deaths: x.d, assists: x.a, gold: x.gold }, ctxB) })),
    ];
    if (scored.length === 0) return null;
    let mvp = scored[0], bagre = scored[0];
    for (const e of scored) { if (e.s > mvp.s) mvp = e; if (e.s < bagre.s) bagre = e; }
    const deco = (x: Agg) => {
      const e = x.champId ? byId.get(x.champId) : undefined;
      return { player: x.player, line: `${x.k}/${x.d}/${x.a}`, name: e?.name ?? "?", image: e?.image };
    };
    return { mvp: deco(mvp.x), bagre: deco(bagre.x) };
  };

  const winnerId = () => props.series.winnerId;
  const winnerTeam = () => (winnerId() ? props.teams[winnerId()!] : null);
  const winnerIsUser = () => winnerTeam()?.isUser ?? false;
  const loserIsUser = () => {
    if (!winnerId()) return false;
    if (teamA()?.isUser && winnerId() !== teamA()?.id) return true;
    if (teamB()?.isUser && winnerId() !== teamB()?.id) return true;
    return false;
  };

  // Copy variants per UI-SPEC Copywriting Contract
  const headlineCopy = () => {
    const nomeVencedor = winnerTeam()?.displayName ?? "Um time";
    if (winnerIsUser()) return tituloDoMeuTime(props.slotId, true, nomeVencedor, nomeVencedor);
    if (loserIsUser()) {
      const meu = teamA()?.isUser ? teamA() : teamB();
      return tituloDoMeuTime(props.slotId, false, meu?.displayName ?? "Seu time", nomeVencedor);
    }
    return tituloNeutro(props.slotId, nomeVencedor);
  };

  const headlineClass = () => {
    if (winnerIsUser()) return "series-result__headline series-result__headline--win";
    if (loserIsUser()) return "series-result__headline series-result__headline--loss";
    return "series-result__headline series-result__headline--neutral";
  };

  // --- Zebra (Phase 28, plano 28-04, D-03/D-04/D-05) --------------------------
  // Rating dos dois times e CONSTANTE durante a serie inteira: calculado uma
  // UNICA VEZ por render, em accessor memoizado (nao dentro do laco de
  // gameCells()). rosterRating e isUpset sao a UNICA definicao do projeto
  // (src/sim/power.ts); este componente nao redefine rating de time.
  const ratingA = createMemo(() => {
    const a = teamA();
    return a ? rosterRating(a.roster) : 0;
  });
  const ratingB = createMemo(() => {
    const b = teamB();
    return b ? rosterRating(b.roster) : 0;
  });

  /** D-04, primeira metade: a serie inteira vencida pelo azarao. */
  const seriesUpset = createMemo(() => {
    const a = teamA();
    const b = teamB();
    if (!a || !b) return null;
    if (!isSeriesUpset(ratingA(), ratingB(), a.id, b.id, winnerId())) return null;
    const winnerIsA = winnerId() === a.id;
    return { winnerName: winnerIsA ? a.displayName : b.displayName };
  });

  const idDaLinha = () => idDoTimeNaLinha(teamA(), teamB());
  const timeDaLinha = () => {
    const id = idDaLinha();
    return id ? props.teams[id] : teamA();
  };

  // Game cells: 5 max — fill unused with "–"
  const MAX_GAMES = 5;
  const gameCells = () => {
    const cells: Array<{ label: string; class: string; title?: string }> = [];
    const userTeamId = idDaLinha();
    for (let i = 0; i < MAX_GAMES; i++) {
      const game = props.series.games[i];
      if (!game) {
        cells.push({ label: "–", class: "series-result__game-cell series-result__game-cell--empty" });
      } else {
        // Nenhum time isUser (espectador puro, sala) cai no "else" abaixo,
        // perspectiva neutra pelo teamA -- antes este ramo nunca disparava no
        // solo (sempre ha exatamente um isUser), so alcancavel pela sala.
        const userWon = game.winnerId === userTeamId;
        // If neither team is the user team, show winner's perspective from teamA
        const teamAWon = game.winnerId === teamA()?.id;
        let label: string;
        let cellClass: string;
        if (userTeamId) {
          label = userWon ? "W" : "L";
          cellClass = `series-result__game-cell ${userWon ? "series-result__game-cell--win" : "series-result__game-cell--loss"}`;
        } else {
          label = teamAWon ? "W" : "L";
          cellClass = `series-result__game-cell ${teamAWon ? "series-result__game-cell--win" : "series-result__game-cell--loss"}`;
        }

        // Phase 28 (plano 28-04, D-04, segunda metade): marca por jogo,
        // independente do destaque de serie -- um jogo pode ser zebra numa
        // serie que o azarao perdeu no fim. Le so as ratings JA
        // memoizadas (ratingA()/ratingB()), nunca recalcula rosterRating
        // por celula.
        const a = teamA();
        const b = teamB();
        const cellUpset = a && b ? isGameUpset(ratingA(), ratingB(), a.id, b.id, game.winnerId) : false;
        if (cellUpset) {
          cellClass += " series-result__game-cell--upset";
          cells.push({ label, class: cellClass, title: "Jogo vencido pelo time azarao" });
          continue;
        }

        cells.push({ label, class: cellClass });
      }
    }
    return cells;
  };

  return (
    <div class="series-result">
      <h2 class={headlineClass()}>{headlineCopy()}</h2>

      {/* Score summary */}
      <div class="series-result__score-summary">
        <span class="series-result__score-team">{teamA()?.displayName ?? "Time A"}</span>
        <span class="series-result__score-value">
          {props.series.wins[props.series.teamAId ?? ""] ?? 0}
          {" × "}
          {props.series.wins[props.series.teamBId ?? ""] ?? 0}
        </span>
        <span class="series-result__score-team">{teamB()?.displayName ?? "Time B"}</span>
      </div>

      {/* Actions */}
      <div class="series-result__actions">
        <button
          type="button"
          class="series-result__btn series-result__btn--primary"
          onClick={props.onContinue}
        >
          {props.continueLabel ?? "Continuar"}
        </button>
        <button
          type="button"
          class="series-result__btn series-result__btn--secondary"
          onClick={props.onReplay}
        >
          Ver replay
        </button>
      </div>

      {/* Zebra da serie (Phase 28, plano 28-04, D-03/D-04): ADICAO DE ESCOPO,
          fora dos quatro criterios do ROADMAP.md. Sob <Show> para que a
          ausencia de zebra nao deixe marcacao vazia. */}
      <Show when={seriesUpset()}>
        {(u) => (
          <div class="series-result__upset">
            <span class="series-result__upset-title">ZEBRA DA SÉRIE</span>
            <span class="series-result__upset-text">
              {u().winnerName} venceu a série jogando de azarão.
            </span>
          </div>
        )}
      </Show>

      {/* Series MVP / Bagre */}
      <Show when={seriesAwards()}>
        {(a) => (
          <div class="series-awards">
            <span class="series-awards-title">Destaques da série</span>
            <div class="result-awards">
              <div class="award award--mvp">
                <span class="award-label">MVP DA SÉRIE</span>
                <Show when={a().mvp.image} fallback={<span class="award-portrait award-portrait--fallback">{a().mvp.name.slice(0, 3)}</span>}>
                  <img class="award-portrait" src={`/champions/${a().mvp.image}`} alt={a().mvp.name} />
                </Show>
                <span class="award-player">{a().mvp.player}</span>
                <span class="award-line">{a().mvp.line}</span>
              </div>
              <div class="award award--bagre">
                <span class="award-label">BAGRE DA SÉRIE</span>
                <Show when={a().bagre.image} fallback={<span class="award-portrait award-portrait--fallback">{a().bagre.name.slice(0, 3)}</span>}>
                  <img class="award-portrait" src={`/champions/${a().bagre.image}`} alt={a().bagre.name} />
                </Show>
                <span class="award-player">{a().bagre.player}</span>
                <span class="award-line">{a().bagre.line}</span>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Game-by-game score table */}
      <table class="series-result__table">
        <caption>Resultado da série</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <For each={[1, 2, 3, 4, 5]}>
              {(n) => <th scope="col">Jogo {n}</th>}
            </For>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="series-result__table-team">{timeDaLinha()?.displayName ?? "Time A"}</td>
            <For each={gameCells()}>
              {(cell) => <td class={cell.class} title={cell.title}>{cell.label}</td>}
            </For>
          </tr>
        </tbody>
      </table>

      {/* Champion portraits per game (BRKT-04) */}
      {/* Pitfall 1: use StoredGame.champions directly — do NOT re-call assignFearlessChampions */}
      <details class="series-result__details">
        <summary>Ver escalações de cada jogo</summary>
      <div class="series-result__games">
        <For each={props.series.games}>
          {(game, idx) => (
            <div class="series-result__game-block">
              <h3 class="series-result__game-title">Jogo {idx() + 1}</h3>
              <Show when={teamA()}>
                <RosterPortraits
                  roster={teamA()!.roster}
                  champions={game.champions.teamA}
                  catalogue={props.catalogue}
                  team={teamA()!.isUser ? "user" : "rival"}
                />
              </Show>
              <Show when={teamB()}>
                <RosterPortraits
                  roster={teamB()!.roster}
                  champions={game.champions.teamB}
                  catalogue={props.catalogue}
                  team={teamB()!.isUser ? "user" : "rival"}
                />
              </Show>
            </div>
          )}
        </For>
      </div>
      </details>
    </div>
  );
}
