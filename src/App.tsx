/**
 * src/App.tsx
 *
 * Top-level SolidJS screen router (expanded in Phase 5 to include the full
 * tournament bracket flow).
 *
 * Screen routing:
 *   "launch"       → LaunchMenu (Continue / New)
 *   "draft"        → DraftScreen (user builds their roster)
 *   "bracket"      → BracketView (tournament hub)
 *   "series-result"→ SeriesResultScreen (game-by-game score + champions)
 *   "playback"     → PlaybackScreen (live game replay — existing)
 *   (stubs for "champion" and "elimination" — Plan 04 replaces these)
 *
 * Phase 5 additions (this plan, 05-03):
 *   - tournamentStore signal from storage.ts for persisted state
 *   - runGame callback wrapping series.ts's runSeriesGame (injects into autoSimBotSeries)
 *   - onDraftComplete creates tournament + auto-sims Wave-1 bot slots → bracket
 *   - playNextGame: run one game, persist fearlessUsed + game, check series winner
 *   - Per-game save (saveTournament) after every game append (BRKT-05, D-13)
 *
 * CONSTRAINT: Does NOT change autoSimBotSeries's exported signature from bracket.ts.
 *
 * SolidJS conventions: class= (not className); signals called as functions.
 */

import { createSignal, createEffect, createResource, on, Show } from "solid-js";
import { loadChampions } from "./data/loader";
import { DraftScreen } from "./draft/DraftScreen";
import type { Roster } from "./draft/types";
import type { SpeedPreset as DraftSpeedPreset } from "./draft/DraftScreen";
import type { MatchResult } from "./sim/types";
import { PlaybackScreen } from "./playback/PlaybackScreen";
import { ChampionSelect } from "./playback/ChampionSelect";
import { RoomEntry, detectarSala } from "./room/RoomEntry";
import { salaEmPrimeiroPlano, setSalaEmPrimeiroPlano } from "./room/modo";
import type { PlayerVersion, ChampionEntry } from "./data/schema";
import { ChaosSlider } from "./components/ChaosSlider";
import { StatsVisibilityToggle } from "./components/StatsVisibilityToggle";
import { ChampionEditor } from "./components/ChampionEditor";
import { chaosLevelSignal } from "./storage/chaosLevel";

import {
  championOverrides,
  mergeOverrides,
} from "./storage/championOverrides";
import { activePackIdSignal, setActivePackIdSignal, PROS_PACK_ID, PROS_PACK_NAME } from "./storage/packs";
import { criarApi, type ResumoDoPacote } from "./pacotes/api";
import { reacaoAoErroDoAtivo, soValidos } from "./pacotes/ativo";
import { guardarTokenDoLink } from "./pacotes/dono";
import { MenuDoDono } from "./pacotes/MenuDoDono";
import { ListaDePacotes } from "./pacotes/ListaDePacotes";
import { EditorDoPacote } from "./pacotes/EditorDoPacote";
import { deckSafety, deckShortfalls, type DeckSafety } from "./draft/deckSafety";

// Phase 5 — tournament imports
import {
  tournamentStore,
  setTournamentStore,
  saveTournament,
  clearTournament,
} from "./tournament/storage";
import {
  createTournament,
  advanceSlot,
  autoSimBotSeries,
  buildBotRosters,
} from "./tournament/bracket";
import type { RunGameFn } from "./tournament/bracket";
import {
  runSeriesGame,
  seriesWinnerId,
  fearlessUsedAfter,
} from "./tournament/series";
import { runMatchEngine } from "./sim/runMatchEngine";
import { makeTournamentSeed } from "./tournament/seeds";
import { assignTeamIdentities, tagFromName } from "./tournament/teamNames";
import { replayMatchesStored } from "./tournament/replayGuard";
import type { SlotId, StoredGame, TournamentState } from "./tournament/schema";
import { isUserTeam, USER_TEAM_ID } from "./tournament/schema";
import { LaunchMenu } from "./tournament/LaunchMenu";
import { BracketView } from "./tournament/BracketView";
import { SeriesResultScreen } from "./tournament/SeriesResultScreen";
import { TeamEditScreen } from "./tournament/TeamEditScreen";
import type { TeamIdentityChoice } from "./tournament/TeamEditScreen";

// ---------------------------------------------------------------------------
// Screen union
// ---------------------------------------------------------------------------

type Screen =
  | "launch"
  | "menu"
  | "pacotes"
  | "editor-pacote"
  | "team-edit"
  | "draft"
  | "bracket"
  | "series-result"
  | "champ-select"
  | "playback"
  | "champion"     // TODO: Plan 04 replaces this stub
  | "elimination"; // TODO: Plan 04 replaces this stub

// ---------------------------------------------------------------------------
// Match context — champion data lifted into signals for PlaybackScreen (PLAY-03)
// ---------------------------------------------------------------------------

interface MatchContext {
  userRoster: PlayerVersion[];
  rivalRoster: PlayerVersion[];
  userChampions: Record<string, string>;
  rivalChampions: Record<string, string>;
  catalogue: ChampionEntry[];
  userTeamName: string;
  rivalTeamName: string;
  userTeamTag: string;
  rivalTeamTag: string;
  seriesUserWins: number;
  seriesRivalWins: number;
}

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

export function App() {
  // Screen routing — starts at "launch" (Phase 5; was "draft" before)
  const [currentScreen, setCurrentScreen] = createSignal<Screen>("launch");

  // Champion-trait editor visibility (D-03)
  const [showEditor, setShowEditor] = createSignal(false);
  // Advanced options (chaos slider + champion editor) tucked behind a toggle
  const [showOptions, setShowOptions] = createSignal(false);

  // Champion catalogue loaded on mount (D-03)
  const [championCatalogue, setChampionCatalogue] = createSignal<ChampionEntry[]>([]);

  // Match result from runMatch — set when transitioning to playback
  const [matchResult, setMatchResult] = createSignal<MatchResult | null>(null);
  // Speed preset chosen during draft — passed to PlaybackScreen
  const [speedPreset, setSpeedPreset] = createSignal<DraftSpeedPreset>("fast");

  // PLAY-03: champion/roster context for PlaybackScreen
  const [matchContext, setMatchContext] = createSignal<MatchContext | null>(null);

  // Active slot being played (tournament series context for playback)
  const [activeSeriesSlotId, setActiveSeriesSlotId] = createSignal<SlotId | null>(null);

  // Result slot to display in SeriesResultScreen
  const [resultSlotId, setResultSlotId] = createSignal<SlotId | null>(null);

  // The user's chosen team identity (name/tag/color), picked on the team-edit
  // screen before the draft. Null until chosen (then used by onDraftComplete).
  const [userIdentity, setUserIdentity] = createSignal<TeamIdentityChoice | null>(null);

  // Aviso do replay solo: jogo gravado por uma versao anterior do motor nao pode
  // ser refeito igual pela seed (ver tournament/replayGuard.ts).
  const [avisoReplay, setAvisoReplay] = createSignal<string | null>(null);
  // O aviso mora na raiz do app, entao sem isto ele seguiria o usuario por todas as telas
  // ate o proximo replay. Qualquer troca de tela o descarta (defer: a execucao inicial nao conta).
  createEffect(on(currentScreen, () => setAvisoReplay(null), { defer: true }));

  // E-01 (spec 2026-10-05-editor-de-pacotes-design): os pacotes moram em
  // arquivos e chegam pela API (servidor da sala ou plugin do Vite). O solo
  // joga o pacote ativo exatamente como esta no arquivo.
  const api = criarApi();
  guardarTokenDoLink();
  const [souDono] = createResource(() => api.souDono());
  const [infoDaSala, { refetch: recarregarSala }] = createResource(() => detectarSala());
  const [listaDePacotes, { refetch: recarregarLista }] = createResource(() =>
    api.listar().catch(() => [] as ResumoDoPacote[])
  );
  // Pros so nesta sessao (revisao final M2): erro de leitura que nao e "o pacote
  // acabou" nao pode apagar a escolha salva. Escolher outro pacote limpa a reserva.
  const [reservaDaSessao, setReservaDaSessao] = createSignal<string | null>(null);
  const pacoteAtivoId = (): string => reservaDaSessao() ?? activePackIdSignal();
  createEffect(on(activePackIdSignal, () => setReservaDaSessao(null), { defer: true }));
  const [cartasAtivas, { refetch: recarregarAtivo }] = createResource(pacoteAtivoId, async (id) => {
    try {
      return (await api.carregar(id)).players;
    } catch (err) {
      if (id === PROS_PACK_ID) throw err;
      if (reacaoAoErroDoAtivo(err) === "apagar-preferencia") setActivePackIdSignal(PROS_PACK_ID);
      else setReservaDaSessao(PROS_PACK_ID);
      return [] as PlayerVersion[];
    }
  });
  const players = (): PlayerVersion[] => (cartasAtivas.state === "errored" ? [] : (cartasAtivas.latest ?? []));
  const loadError = (): string | null => {
    if (cartasAtivas.state !== "errored") return null;
    const err = cartasAtivas.error as unknown;
    return err instanceof Error ? err.message : String(err);
  };
  const carregandoJogadores = (): boolean => cartasAtivas.loading;
  function recarregarPacotes(): void {
    void recarregarLista();
    void recarregarAtivo();
  }

  // Bases que o host pode publicar no lobby (D10): os pacotes em arquivo,
  // menos os Pros, que o lobby ja oferece como "Base padrao do jogo".
  const [basesDaSala] = createResource(listaDePacotes, async (lista) => {
    const bases = await Promise.all(
      soValidos(lista)
        .filter((p) => p.id !== PROS_PACK_ID)
        .map(async (p) => {
          const atualizar = async () => (await api.carregar(p.id)).players;
          try {
            return { id: p.id, nome: p.nome, jogadores: await atualizar(), atualizar };
          } catch {
            return null;
          }
        })
    );
    return bases.filter((b): b is NonNullable<typeof b> => b !== null);
  });
  const fotosDoMenu = (): string[] =>
    [
      ...new Set(
        [...players(), ...(basesDaSala.latest ?? []).flatMap((b) => b.jogadores)]
          .map((p) => p.photo)
          .filter((f): f is string => f !== undefined)
      ),
    ].slice(0, 6);

  // Editor de pacotes: qual pacote esta aberto.
  const [pacoteEmEdicao, setPacoteEmEdicao] = createSignal<string | null>(null);

  // Menu do dono (E-04): quem tem o token do dono cai nele uma vez, ao abrir.
  let jaAbriuMenu = false;
  createEffect(() => {
    if (jaAbriuMenu || souDono() !== true) return;
    jaAbriuMenu = true;
    // Revisao final: so puxa o dono se ele ainda esta na tela de abertura.
    if (!salaEmPrimeiroPlano() && currentScreen() === "launch") setCurrentScreen("menu");
  });
  // Saiu da sala: o dono volta para o menu.
  createEffect(
    on(
      salaEmPrimeiroPlano,
      (aberta, antes) => {
        if (antes === true && !aberta && souDono() === true) setCurrentScreen("menu");
      },
      { defer: true }
    )
  );
  // Ao voltar ao menu, atualiza quantos estao na sala.
  createEffect(
    on(
      currentScreen,
      (tela) => {
        if (tela === "menu") void recarregarSala();
      },
      { defer: true }
    )
  );

  // Load the champion catalogue on mount
  loadChampions()
    .then((c) => setChampionCatalogue(c))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Falha ao carregar campeões:", msg);
      setChampionCatalogue([]);
    });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Merge champion overrides over the loaded catalogue */
  function getMergedCatalogue(): ChampionEntry[] {
    return mergeOverrides(championCatalogue(), championOverrides);
  }

  /** O pool do solo: o pacote ativo como esta no arquivo (E-01). */
  function mergedPlayers(): PlayerVersion[] {
    return players();
  }

  /** Display name of the active pack (the universe the next tournament uses). */
  function activePackName(): string {
    return listaDePacotes.latest?.find((p) => p.id === pacoteAtivoId())?.nome ?? PROS_PACK_NAME;
  }

  /**
   * Garantia do baralho do pacote ativo (A-02): com carta unica no torneio
   * (A-01), o pacote precisa de folga para os 8 times em toda rota, senao o
   * BotTeamBuilder pode ficar sem candidato. null enquanto os jogadores
   * carregam: a tela fica neutra ate o fetch real responder (achado do teste de
   * sala, 2026-08-27).
   */
  function packSafety(): DeckSafety | null {
    if (carregandoJogadores()) return null;
    return deckSafety(mergedPlayers());
  }
  function packPlayable(): boolean {
    return packSafety()?.ready ?? true;
  }
  function packBlockReason(): string {
    const s = packSafety();
    if (s === null || s.ready) return "";
    return `O pacote "${activePackName()}" pode deixar um dos 8 times sem jogador numa rota. Faltam cartas em: ${deckShortfalls(s).join(", ")}. Ajuste o pacote em Editar pacotes.`;
  }

  /**
   * runGame callback satisfying the pinned RunGameFn seam from bracket.ts.
   * Wraps runSeriesGame with chaosLevel + merged catalogue from App context.
   * SAME callback injected into every autoSimBotSeries call.
   * App MUST NOT change autoSimBotSeries's exported signature — it only supplies runGame.
   */
  const runGame: RunGameFn = (state: TournamentState, slotId: SlotId): StoredGame => {
    return runSeriesGame(state, slotId, chaosLevelSignal(), getMergedCatalogue());
  };

  // ---------------------------------------------------------------------------
  // Launch menu handlers
  // ---------------------------------------------------------------------------

  function handleContinue() {
    setCurrentScreen("bracket");
  }

  function handleNewTournament() {
    // Guard: o pacote ativo precisa da folga do A-02 ou o BotTeamBuilder pode ficar sem candidato.
    if (!packPlayable()) return;
    // Clear any existing save (D-14 confirmed by LaunchMenu's confirm card)
    clearTournament();
    // Route to the team-edit screen first so the player can name their org.
    setCurrentScreen("team-edit");
  }

  /** A suggested identity to pre-fill the team-edit screen (player can change it). */
  function teamSuggestion(): TeamIdentityChoice {
    const id = assignTeamIdentities(makeTournamentSeed(), 1)[0];
    return { name: id.name, tag: id.tag, color: "#3b82f6" };
  }

  /** Team-edit confirmed → store the identity and continue to the draft. */
  function handleTeamEditConfirm(identity: TeamIdentityChoice) {
    setUserIdentity(identity);
    setCurrentScreen("draft");
  }

  // ---------------------------------------------------------------------------
  // Draft → Bracket
  // ---------------------------------------------------------------------------

  /**
   * Called by DraftScreen when the user completes all 5 role picks.
   *
   * Phase 5: creates the tournament, builds 7 bot rosters, auto-sims all
   * Wave-1 bot-vs-bot slots via autoSimBotSeries, persists, and routes to bracket.
   *
   * BRKT-03 / criterion 2: on first bracket load, all non-user Wave-1 slots are
   * already resolved — only the user's own first series remains "ready".
   */
  function onDraftComplete(
    userRoster: Roster,
    _rivalRoster: Roster,   // unused in tournament mode (bot rosters come from buildBotRosters)
    preset: DraftSpeedPreset,
    captainPersonId: string // CAPTAIN: personId of the user-designated captain (Feature 3b)
  ) {
    setSpeedPreset(preset);

    const tournamentSeed = makeTournamentSeed();

    // Build the user's TournamentTeam from the drafted roster, with an org-style
    // identity (index 0 is reserved for the user — bots take 1..7).
    const userRosterArray = Object.values(userRoster);
    // Use the identity the player chose on the team-edit screen; fall back to a
    // generated one if they somehow skipped it.
    const chosen = userIdentity() ?? { ...assignTeamIdentities(tournamentSeed, 8)[0], color: "#3b82f6" };
    const userTeam = {
      id: USER_TEAM_ID,
      isUser: isUserTeam(USER_TEAM_ID, USER_TEAM_ID),
      displayName: chosen.name,
      tag: chosen.tag,
      color: chosen.color,
      roster: userRosterArray,
      // CAPTAIN: persisted on the user's TournamentTeam (Feature 3b). The engine
      // integrator reads team.captainPersonId to apply the captain's effect; it is
      // a personId matching one of the 5 players in `roster`.
      captainPersonId,
    };

    // Build 7 bot TournamentTeams from the loaded player pool (with Player Editor
    // overrides applied), excluding the user's chosen name/tag so no bot shares
    // the user's identity.
    // A-01: os bots pulam as cartas do usuario e as dos bots anteriores.
    const botTeams = buildBotRosters(
      mergedPlayers(),
      tournamentSeed,
      { name: chosen.name, tag: chosen.tag },
      userRosterArray
    );

    // createTournament expects exactly 8 teams
    const allTeams = [userTeam, ...botTeams];
    let newState = createTournament(tournamentSeed, allTeams);

    // BRKT-03 / criterion 2: immediately auto-sim all non-user Wave-1 ready slots
    // so no empty/pending bot slots remain when the bracket first renders.
    // runGame is the seam — same callback used for user series.
    newState = autoSimBotSeries(newState, runGame);

    // Persist the initial bracket state
    setTournamentStore(newState);
    saveTournament(newState);

    setCurrentScreen("bracket");
  }

  // ---------------------------------------------------------------------------
  // Bracket hub handlers
  // ---------------------------------------------------------------------------

  function handleStartSeries(slotId: SlotId) {
    const state = tournamentStore();
    if (!state) return;

    // Mark the slot as active
    const updatedState: TournamentState = { ...state, activeSlotId: slotId };
    setTournamentStore(updatedState);
    saveTournament(updatedState);

    setActiveSeriesSlotId(slotId);

    // Play the first game immediately
    playNextGame(slotId, updatedState);
  }

  function handleReplaySeries(slotId: SlotId, gameIndex: number) {
    setAvisoReplay(null);
    const state = tournamentStore();
    if (!state) return;

    const slot = state.slots[slotId];
    if (!slot?.series.games[gameIndex]) return;

    const game = slot.series.games[gameIndex]!;
    const teamAId = slot.series.teamAId;
    const teamBId = slot.series.teamBId;
    if (!teamAId || !teamBId) return;

    // Blue/"user" side is whoever the events were framed around (the human team
    // when it played). Old saves without the field fall back to teamA.
    const userFrameId = game.userFrameTeamId ?? teamAId;
    const rivalFrameId = userFrameId === teamAId ? teamBId : teamAId;
    const aIsUserFrame = userFrameId === teamAId;

    const userTeam = state.teams[userFrameId];
    const rivalTeam = state.teams[rivalFrameId];
    if (!userTeam || !rivalTeam) return;

    // Stored games keep their event timeline in memory during the session, but the
    // LocalStorage projection strips it to stay under quota (see tournament/storage.ts).
    // After a reload the array is empty — re-simulate it deterministically from the
    // stored seed + champions + chaosLevel (SIM-01 / D-08) so replays still work.
    const userChampions = aIsUserFrame ? game.champions.teamA : game.champions.teamB;
    const rivalChampions = aIsUserFrame ? game.champions.teamB : game.champions.teamA;
    //
    // Se o motor mudou depois que o jogo foi gravado, a partida refeita pode ter outro
    // vencedor, enquanto o chaveamento mostra o vencedor gravado. Nesse caso o replay e
    // recusado (mesmo espirito de server/room/replay.ts, "gravacao indisponivel").
    let events = game.events;
    if (events.length === 0) {
      const refeito = runMatchEngine(
        {
          userRoster: userTeam.roster,
          rivalRoster: rivalTeam.roster,
          userChampions,
          rivalChampions,
          speedPreset: "fast",
          chaosLevel: game.chaosLevel ?? chaosLevelSignal(),
          formVersion: game.formVersion,
          newTraitEffects: game.newTraitEffects,
          championCatalogue: getMergedCatalogue(),
          userCaptainPersonId: userTeam.captainPersonId,
          rivalCaptainPersonId: rivalTeam.captainPersonId,
        },
        game.seed
      );
      if (!replayMatchesStored(game.winnerId, refeito.winner, userFrameId, rivalFrameId)) {
        setAvisoReplay(
          "Gravação indisponível: este jogo foi simulado por uma versão anterior do motor e não pode ser reproduzido igual."
        );
        return;
      }
      events = refeito.events;
    }

    // Reconstruct MatchResult from StoredGame for PlaybackScreen
    const fakeResult: MatchResult = {
      winner: game.winnerId === userFrameId ? "user" : "rival",
      events,
      totalPlaybackMs: game.totalPlaybackMs,
    };

    setMatchContext({
      userRoster: userTeam.roster,
      rivalRoster: rivalTeam.roster,
      userChampions,
      rivalChampions,
      catalogue: getMergedCatalogue(),
      userTeamName: userTeam.displayName,
      rivalTeamName: rivalTeam.displayName,
      userTeamTag: userTeam.tag ?? tagFromName(userTeam.displayName),
      rivalTeamTag: rivalTeam.tag ?? tagFromName(rivalTeam.displayName),
      seriesUserWins: slot.series.wins[userFrameId] ?? 0,
      seriesRivalWins: slot.series.wins[rivalFrameId] ?? 0,
    });
    setMatchResult(fakeResult);
    setActiveSeriesSlotId(slotId);
    setCurrentScreen("champ-select");
  }

  // ---------------------------------------------------------------------------
  // Series game loop
  // ---------------------------------------------------------------------------

  /**
   * Play the next game in the active series.
   *
   * - Calls runSeriesGame (pure — returns StoredGame)
   * - Appends game to state, updates wins
   * - Writes fearlessUsed via fearlessUsedAfter BEFORE saveTournament (BRKT-05/D-13)
   * - Persists via saveTournament after EVERY game (D-13 — synchronous)
   * - Routes to PlaybackScreen for the live game view
   * - When seriesWinnerId is set: advanceSlot + autoSimBotSeries → "series-result"
   */
  function playNextGame(slotId: SlotId, stateOverride?: TournamentState) {
    const state = stateOverride ?? tournamentStore();
    if (!state) return;

    const slot = state.slots[slotId];
    if (!slot) return;

    const series = slot.series;
    const teamAId = series.teamAId;
    const teamBId = series.teamBId;
    if (!teamAId || !teamBId) return;

    const teamA = state.teams[teamAId];
    const teamB = state.teams[teamBId];
    if (!teamA || !teamB) return;

    // Run one game — pure, deterministic
    const storedGame = runSeriesGame(state, slotId, chaosLevelSignal(), getMergedCatalogue());

    // Compute updated state: append game, update wins
    const updatedWins = {
      ...series.wins,
      [storedGame.winnerId]: (series.wins[storedGame.winnerId] ?? 0) + 1,
    };

    const updatedGames = [...series.games, storedGame];

    // Update fearless usage BEFORE saveTournament (BRKT-05 / criterion 4)
    const updatedFearlessUsed = fearlessUsedAfter(
      { ...series, wins: updatedWins, games: updatedGames },
      storedGame
    );

    const updatedSeries = {
      ...series,
      status: "in_progress" as const,
      wins: updatedWins,
      games: updatedGames,
      fearlessUsed: updatedFearlessUsed,
    };

    let updatedState: TournamentState = {
      ...state,
      slots: {
        ...state.slots,
        [slotId]: { ...slot, series: updatedSeries },
      } as TournamentState["slots"],
    };

    // Persist after every game (D-13 — synchronous)
    setTournamentStore(updatedState);
    saveTournament(updatedState);

    // Check if the series is now complete (3 wins reached)
    const winnerId = seriesWinnerId(updatedSeries);

    if (winnerId) {
      // Series complete — advance bracket and auto-sim remaining bot slots
      const loserId = teamAId === winnerId ? teamBId : teamAId;
      let advancedState = advanceSlot(updatedState, slotId, winnerId, loserId);

      // Auto-sim all newly available bot-vs-bot slots
      advancedState = autoSimBotSeries(advancedState, runGame);

      // Clear activeSlotId (back to bracket hub after result screen)
      advancedState = { ...advancedState, activeSlotId: null };

      setTournamentStore(advancedState);
      saveTournament(advancedState);

      setResultSlotId(slotId);
      setCurrentScreen("series-result");
      return;
    }

    // Series still in progress — show PlaybackScreen for this game.
    // The human team is framed as blue/"user" (see runSeriesGame.userFrameTeamId).
    const userFrameId = storedGame.userFrameTeamId ?? teamAId;
    const rivalFrameId = userFrameId === teamAId ? teamBId : teamAId;
    const aIsUserFrame = userFrameId === teamAId;
    const userTeam = state.teams[userFrameId]!;
    const rivalTeam = state.teams[rivalFrameId]!;

    const matchResultForPlayback: MatchResult = {
      winner: storedGame.winnerId === userFrameId ? "user" : "rival",
      events: storedGame.events,
      totalPlaybackMs: storedGame.totalPlaybackMs,
    };

    setMatchContext({
      userRoster: userTeam.roster,
      rivalRoster: rivalTeam.roster,
      userChampions: aIsUserFrame ? storedGame.champions.teamA : storedGame.champions.teamB,
      rivalChampions: aIsUserFrame ? storedGame.champions.teamB : storedGame.champions.teamA,
      catalogue: getMergedCatalogue(),
      userTeamName: userTeam.displayName,
      rivalTeamName: rivalTeam.displayName,
      userTeamTag: userTeam.tag ?? tagFromName(userTeam.displayName),
      rivalTeamTag: rivalTeam.tag ?? tagFromName(rivalTeam.displayName),
      seriesUserWins: updatedWins[userFrameId] ?? 0,
      seriesRivalWins: updatedWins[rivalFrameId] ?? 0,
    });
    setMatchResult(matchResultForPlayback);
    setCurrentScreen("champ-select");
  }

  /**
   * Called by PlaybackScreen's "Jogar de novo" / continue action.
   * If still in a tournament series, advances to the next game.
   * If no active series (legacy single-game mode), resets to draft.
   */
  function onPlayAgain() {
    const slotId = activeSeriesSlotId();
    if (slotId) {
      // Tournament mode: play the next game in the series
      const state = tournamentStore();
      if (state) {
        playNextGame(slotId, state);
        return;
      }
    }
    // Legacy single-game mode (no tournament active)
    setMatchResult(null);
    setMatchContext(null);
    setCurrentScreen("draft");
  }

  // ---------------------------------------------------------------------------
  // Series result → bracket
  // ---------------------------------------------------------------------------

  function handleResultContinue() {
    setResultSlotId(null);
    setCurrentScreen("bracket");
  }

  function handleResultReplay() {
    const slotId = resultSlotId();
    if (!slotId) return;
    handleReplaySeries(slotId, 0);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // The user's team accent colour, exposed as a CSS variable so the HUD/bracket
  // can tint the "your team" elements (falls back to broadcast blue).
  const userTeamColor = () => {
    const st = tournamentStore();
    const t = st ? st.teams[st.userTeamId] : undefined;
    return t?.color ?? userIdentity()?.color ?? "#3b82f6";
  };

  return (
    <div class="app" style={{ "--user-team-color": userTeamColor() }}>
      {/* A sala, quando servida pelo servidor de salas. Em primeiro plano, nada
          do solo e desenhado abaixo (Rundown da Sala 2, D3/U13); os pacotes
          lidos dos arquivos pela API vao para o lobby, onde o host escolhe a
          base (D10). A faixa de volta a sala some no menu do dono, na lista de
          pacotes e no editor: la, Voltar e a unica saida (ele descarta fotos
          enviadas e nao salvas). */}
      <RoomEntry
        bases={() => basesDaSala.latest ?? []}
        ehDono={() => (souDono.loading ? undefined : souDono() === true)}
        esconderFaixa={() =>
          currentScreen() === "menu" || currentScreen() === "pacotes" || currentScreen() === "editor-pacote"
        }
      />

      <Show when={!salaEmPrimeiroPlano()}>

      {/* ----------------------------------------------------------------- */}
      {/* Error state — player data failed to load                           */}
      {/* ----------------------------------------------------------------- */}
      <Show when={loadError()}>
        <div class="load-error" role="alert">
          Erro ao carregar os jogadores. Verifique o arquivo players.json e recarregue a página.
        </div>
      </Show>

      <Show when={avisoReplay()}>
        <div class="load-status load-status--aviso" role="status">
          {avisoReplay()}
          <button type="button" onClick={() => setAvisoReplay(null)}>
            Fechar
          </button>
        </div>
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Launch menu (initial screen — Phase 5)                             */}
      {/* ----------------------------------------------------------------- */}
      <Show when={currentScreen() === "launch" && !loadError()}>
        <LaunchMenu
          existingSave={tournamentStore()}
          onContinue={handleContinue}
          onNewTournament={handleNewTournament}
          pacotes={soValidos(listaDePacotes.latest ?? [])}
          pacoteAtivo={pacoteAtivoId()}
          onTrocarPacote={(id) => setActivePackIdSignal(id)}
          onVoltar={souDono() === true ? () => setCurrentScreen("menu") : undefined}
          canStart={packPlayable()}
          blockReason={packBlockReason()}
        />
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Menu do dono e editor de pacotes (spec 2026-10-05-editor-de-pacotes) */}
      {/* ----------------------------------------------------------------- */}
      <Show when={currentScreen() === "menu"}>
        <MenuDoDono
          pacoteAtivo={activePackName()}
          temSala={infoDaSala.latest != null}
          conectados={infoDaSala.latest?.conectados ?? 0}
          fotos={fotosDoMenu()}
          onSolo={() => setCurrentScreen("launch")}
          onEditar={() => setCurrentScreen("pacotes")}
          onMultiplayer={() => setSalaEmPrimeiroPlano(true)}
        />
      </Show>
      <Show when={currentScreen() === "pacotes"}>
        <ListaDePacotes
          api={api}
          campeoes={championCatalogue()}
          onVoltar={() => setCurrentScreen("menu")}
          onEditar={(id) => {
            setPacoteEmEdicao(id);
            setCurrentScreen("editor-pacote");
          }}
          onMudou={recarregarPacotes}
        />
      </Show>
      {/* keyed: outro id sempre remonta o editor (estado novo, sem sobras do anterior) */}
      <Show keyed when={currentScreen() === "editor-pacote" ? pacoteEmEdicao() : null}>
        {(id) => (
          <EditorDoPacote
            api={api}
            id={id}
            campeoes={championCatalogue()}
            onVoltar={() => setCurrentScreen("pacotes")}
            onMudou={recarregarPacotes}
          />
        )}
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Team-edit screen — name/tag/color before the draft                 */}
      {/* ----------------------------------------------------------------- */}
      <Show when={currentScreen() === "team-edit" && !loadError()}>
        <TeamEditScreen
          suggestion={userIdentity() ?? teamSuggestion()}
          onConfirm={handleTeamEditConfirm}
        />
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Draft screen — tournament flow (routes to bracket after complete)   */}
      {/* ----------------------------------------------------------------- */}
      <Show when={currentScreen() === "draft" && !loadError()}>
        {/* Advanced options tucked behind a toggle so the draft reads clean */}
        <div class="pre-match-controls">
          <button
            type="button"
            class="options-toggle"
            aria-pressed={showOptions()}
            onClick={() => setShowOptions((v) => !v)}
          >
            ⚙ Opções
          </button>
        </div>

        <Show when={showOptions()}>
          <div class="options-panel">
            <ChaosSlider />
            <StatsVisibilityToggle />
            <button
              type="button"
              class="champion-editor-toggle"
              onClick={() => setShowEditor((v) => !v)}
            >
              {showEditor() ? "Fechar editor de campeões" : "Editar traços de campeões"}
            </button>
            <Show when={showEditor()}>
              <ChampionEditor />
            </Show>
          </div>
        </Show>

        <DraftScreen
          players={mergedPlayers()}
          onDraftComplete={onDraftComplete}
          
        />
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Bracket hub (Phase 5)                                               */}
      {/* ----------------------------------------------------------------- */}
      <Show when={currentScreen() === "bracket" && tournamentStore() !== null}>
        <BracketView
          state={tournamentStore()!}
          onStartSeries={handleStartSeries}
          onReplaySeries={handleReplaySeries}
        />
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Series result screen (Phase 5)                                      */}
      {/* ----------------------------------------------------------------- */}
      <Show
        when={
          currentScreen() === "series-result" &&
          resultSlotId() !== null &&
          tournamentStore() !== null
        }
      >
        {(() => {
          const state = tournamentStore()!;
          const slotId = resultSlotId()!;
          return (
            <SeriesResultScreen
              slotId={slotId}
              series={state.slots[slotId]!.series}
              teams={state.teams}
              catalogue={getMergedCatalogue()}
              onContinue={handleResultContinue}
              onReplay={handleResultReplay}
            />
          );
        })()}
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Animated champion select — shown before each Bo5 game               */}
      {/* ----------------------------------------------------------------- */}
      <Show when={currentScreen() === "champ-select" && matchContext() !== null}>
        <ChampionSelect
          userRoster={matchContext()!.userRoster}
          rivalRoster={matchContext()!.rivalRoster}
          userChampions={matchContext()!.userChampions}
          rivalChampions={matchContext()!.rivalChampions}
          catalogue={matchContext()!.catalogue}
          userTeamName={matchContext()!.userTeamName}
          rivalTeamName={matchContext()!.rivalTeamName}
          userTeamTag={matchContext()!.userTeamTag}
          rivalTeamTag={matchContext()!.rivalTeamTag}
          onComplete={() => setCurrentScreen("playback")}
        />
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Playback screen — live game replay (reused from Phase 4)            */}
      {/* PLAY-03: receives full roster + champion + catalogue context        */}
      {/* ----------------------------------------------------------------- */}
      <Show when={currentScreen() === "playback" && matchResult() !== null && matchContext() !== null}>
        <PlaybackScreen
          result={matchResult()!}
          speedPreset={speedPreset()}
          onPlayAgain={onPlayAgain}
          userRoster={matchContext()!.userRoster}
          rivalRoster={matchContext()!.rivalRoster}
          userChampions={matchContext()!.userChampions}
          rivalChampions={matchContext()!.rivalChampions}
          catalogue={matchContext()!.catalogue}
          userTeamName={matchContext()!.userTeamName}
          rivalTeamName={matchContext()!.rivalTeamName}
          userTeamTag={matchContext()!.userTeamTag}
          rivalTeamTag={matchContext()!.rivalTeamTag}
          seriesUserWins={matchContext()!.seriesUserWins}
          seriesRivalWins={matchContext()!.seriesRivalWins}
        />
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Champion screen stub — TODO Plan 04 replaces with ChampionScreen   */}
      {/* ----------------------------------------------------------------- */}
      <Show when={currentScreen() === "champion"}>
        <div class="load-error" role="status">
          Campeão do torneio! (Tela completa disponível no próximo plano)
        </div>
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Elimination screen stub — TODO Plan 04 replaces with EliminationDialog */}
      {/* ----------------------------------------------------------------- */}
      <Show when={currentScreen() === "elimination"}>
        <div class="load-error" role="status">
          Eliminado. (Tela completa disponível no próximo plano)
        </div>
      </Show>
      </Show>
    </div>
  );
}
