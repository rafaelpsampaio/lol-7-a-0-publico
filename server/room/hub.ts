/**
 * server/room/hub.ts
 *
 * Traduz mensagens de cliente em mudancas de sala e em mensagens de saida.
 * Nao conhece WebSocket: recebe socketIds e devolve Outbound. Isso torna o
 * fluxo inteiro testavel sem abrir uma porta.
 */

import { randomUUID } from "node:crypto";
import {
  ClientMessageSchema,
  DISCONNECTED_GRACE_SECONDS,
  HOST_RECONNECT_GRACE_SECONDS,
  PICKS_PER_SEAT,
  PROTOCOL_VERSION,
  type ClientMessage,
  type ErrorCode,
  type PlaybackAction,
  type RoomPhase,
  type ServerMessage,
  type TournamentWire,
  type VoteChoice,
} from "../protocol";
import type { ChampionEntry, PlayerVersion, SlotId } from "../engine/schema";
import { baseStatus, baseStatusMessage } from "./baseCheck";
import {
  applyPick,
  autoPick,
  capTurnDeadline,
  createDraft,
  currentSeat,
  currentSeatIndex,
  handCards,
  incompleteSeats,
  isFinished,
  toDraftWire,
  type DraftSeat,
  type DraftState,
  type TurnBudget,
} from "./draft";
import {
  allHumansEliminated,
  applyVoteResult,
  autoWatch,
  autoWatchEspectadores,
  barrierMembers,
  barrierSatisfied,
  castVote,
  createRoomTournament,
  forceVoteResult,
  humanSeatIndexes,
  isFinished as isTorneioFinished,
  openVote,
  readySlots,
  runWave,
  setReady,
  setWatch,
  sincronizarTodos,
  apontarPlateia,
  rodarAteOFim,
  toTournamentWire,
  voteResult,
  withTimelineCached,
  type RoomTournament,
} from "./tournament";
import { hasTimelines, timelineOf } from "./replay";

type HelloMessage = Extract<ClientMessage, { type: "hello" }>;
import {
  canStart,
  assignHost,
  joinRoom,
  rematch,
  removePlayer,
  transferHost,
  renamePlayer,
  setConnected,
  setSettings,
  toWire,
  type Room,
  type WireExtras,
} from "./state";

export interface Outbound {
  /** "all" difunde; um array envia so para aqueles socketIds */
  to: "all" | string[];
  message: ServerMessage;
}

/**
 * Orcamento puro do turno por assento (D-17): bot nao tem relogio, humano
 * conectado tem o turno cheio, humano caido tem so a carencia curta.
 *
 * Extraida do metodo de instancia de proposito: depois do #driveDraft, o
 * assento de bot nunca fica visivel de novo (a vez ja passou por ele e foi
 * embora) — entao nenhum teste que so olhe o estado final da sala consegue
 * provar que um bot recebeu deadline nulo. Como funcao pura e exportada, o
 * ramo do bot e o ramo do desconectado dao pra testar direto, sem depender de
 * qual assento sobra visivel (F5 da revisao de qualidade da Tarefa 6).
 */
export function turnBudgetFor(
  seat: DraftSeat,
  turnSeconds: number,
  conectados: ReadonlySet<string>
): number | null {
  if (seat.clientId === null) return null;
  const cheio = turnSeconds * 1000;
  if (conectados.has(seat.clientId)) return cheio;
  return Math.min(cheio, DISCONNECTED_GRACE_SECONDS * 1000);
}

export interface HubDeps {
  makeClientId: () => string;
  makePublicId: () => string;
  /** Semente do draft. Declarada aqui, usada a partir da Tarefa 6. */
  makeSeed: () => string;
  now: () => number;
  /** Agenda um disparo unico e devolve como cancelar. Usada a partir da Tarefa 7. */
  schedule: (ms: number, fn: () => void) => () => void;
  onRoomChanged: (room: Room) => void;
  /** Grava a base publicada e devolve quantos jogadores ela tem. Lanca se invalida. */
  publishBase: (raw: unknown) => Promise<number>;
  /** Rele a base do disco depois de uma publicacao. */
  loadPlayers: () => Promise<PlayerVersion[]>;
  /**
   * Catalogo de campeoes, lido uma vez no arranque (server/main.ts). So
   * alimenta o retrato na tela das partidas do torneio (D-26) — a simulacao
   * em si nao depende dele, entao um catalogo vazio nunca muda um resultado.
   */
  catalogue: ChampionEntry[];
}

export class RoomHub {
  #room: Room;
  /** Base da sala em memoria. O disco e a fonte; isto e a copia que o fio usa. */
  #cards: PlayerVersion[];
  #deps: HubDeps;
  /** socketId → clientId, para saber quem fala sem confiar no cliente */
  #sockets = new Map<string, string>();
  #sender: (out: Outbound[]) => void = () => {};
  #cancelClock: (() => void) | null = null;
  #cancelHostClock: (() => void) | null = null;
  #absentHostId: string | null = null;
  #hostAbsentSince: number | null = null;
  /**
   * Assento cuja ultima escolha foi forcada pelo relogio, so pro broadcast que
   * segue o timeout (Fase 6, DraftWire.timedOutSeat) — setado e desarmado
   * dentro de #onTurnTimeout, na mesma chamada sincrona.
   */
  #ultimoTimeoutAssento: number | null = null;

  constructor(room: Room, players: PlayerVersion[], deps: HubDeps) {
    this.#deps = deps;
    this.#cards = players;
    this.#room = this.#aquecerTimelines(this.#normalizarArranque(room));
    // O relogio tem que estar armado desde o arranque (M-2 da revisao final):
    // ele so era rearmado dentro do #commit, e o main.ts monta o hub a partir
    // do loadRoom sem nenhum commit de abertura. Uma sala restaurada no meio do
    // draft ficava sem cronometro nenhum entre o listen() e a primeira mensagem
    // de cliente — parada por construcao, nao por decisao.
    this.#rearmClock();
    // Após reiniciar, o host salvo tem o mesmo prazo para reconectar.
    this.#room = this.#updateAutoHost(this.#room);
  }

  /**
   * Sala restaurada do disco chega sem as timelines (D-25 poda os eventos na
   * escrita). Elas voltam sob demanda quando alguem assiste uma serie -- mas os
   * destaques do torneio (MVP/Bagre, media por jogo) leem o ultimo evento de
   * TODO jogo, e uma serie que ninguem reviu ficava fora da conta: o podio dizia
   * "em 5 jogos" para quem jogou 12 (achado do teste de ponta a ponta do
   * Rundown da Sala 2). Refaz tudo uma vez, na subida: ~33 ms por serie, no
   * maximo 14. Serie que nao bate com o hash gravado (D-26) fica como estava.
   */
  #aquecerTimelines(room: Room): Room {
    let t = room.tournament;
    if (t === null) return room;
    for (const slotId of Object.keys(t.bracket.slots) as SlotId[]) {
      const games = t.bracket.slots[slotId]!.series.games;
      if (games.length === 0 || hasTimelines(games)) continue;
      const r = timelineOf(t, slotId, this.#deps.catalogue);
      if (r.ok) t = withTimelineCached(t, slotId, r.games);
    }
    return t === room.tournament ? room : { ...room, tournament: t };
  }

  /**
   * Reancora o relogio de uma sala restaurada de snapshot (M-2).
   *
   * `deadline` e `turnStartedAt` gravados sao epochs do processo ANTERIOR e nao
   * significam nada neste. Se o servidor ficou fora do ar mais que o turno, o
   * prazo ja nasce vencido e o primeiro #commit — o `hello` de QUALQUER um, nao
   * necessariamente do dono da vez — tomaria a vez de quem nem teve chance de
   * voltar. No instante do arranque ninguem tem socket aberto, entao quem esta
   * na vez e, por definicao, alguem caido: dar exatamente a carencia do D-17 e
   * o mesmo tratamento que ele teria numa queda comum. Nada de epoch vai para o
   * fio (D-16) — estes sao internos.
   */
  #normalizarArranque(room: Room): Room {
    const draft = room.draft;
    if (draft === null || draft.deadline === null) return room;

    const agora = this.#deps.now();
    const carencia = agora + DISCONNECTED_GRACE_SECONDS * 1000;
    return {
      ...room,
      draft: {
        ...draft,
        deadline: draft.deadline > agora ? Math.min(draft.deadline, carencia) : carencia,
        turnStartedAt: agora,
      },
    };
  }

  /**
   * O ws.ts liga o canal de saida aqui. Sem ele o relogio mudaria o estado da
   * sala sem ninguem ficar sabendo: o `handle` so devolve mensagens para quem
   * falou, e um disparo de timer nao tem ninguem falando.
   */
  attachSender(send: (out: Outbound[]) => void): void {
    this.#sender = send;
  }

  /**
   * Desarma o relogio para sempre (Q3 da revisao). O attachSender(() => {})
   * cala so a SAIDA — o #cancelClock continua armado num setTimeout de
   * verdade. Sem isto, o timer dispara depois do servidor fechar, muta a
   * sala, chama onRoomChanged (grava snapshot de um servidor desligado) e
   * segura o event loop aberto. O ws.ts chama isto junto com attachSender no
   * close.
   */
  dispose(): void {
    this.#cancelClock?.();
    this.#cancelClock = null;
    this.#clearHostClock();
  }

  #clearHostClock(): void {
    this.#cancelHostClock?.();
    this.#cancelHostClock = null;
    this.#absentHostId = null;
    this.#hostAbsentSince = null;
  }

  /** Não renova a carência quando outro jogador envia mensagens ou entra. */
  #updateAutoHost(room: Room): Room {
    // Um snapshot manual pode ter mais de um usuário do mesmo link de host.
    // Ativar o modo automático mantém apenas um deles no controle.
    if (room.hostAuto && room.players.filter((p) => p.isHost).length > 1) {
      const current = room.players.find((p) => p.isHost && p.connected)
        ?? room.players.find((p) => p.isHost)!;
      room = assignHost(room, current.publicId, randomUUID());
    }
    const host = room.players.find((p) => p.isHost);
    if (!room.hostAuto || host?.connected) {
      this.#clearHostClock();
      return room;
    }

    if (host !== undefined) {
      if (this.#absentHostId !== host.clientId) {
        this.#clearHostClock();
        this.#absentHostId = host.clientId;
        this.#hostAbsentSince = this.#deps.now();
      }
      const remaining = this.#hostAbsentSince! + HOST_RECONNECT_GRACE_SECONDS * 1000 - this.#deps.now();
      if (remaining > 0) {
        if (this.#cancelHostClock === null) {
          this.#cancelHostClock = this.#deps.schedule(remaining, () => {
            this.#cancelHostClock = null;
            const before = this.#room;
            const after = this.#updateAutoHost(before);
            if (after !== before) {
              this.#commit(after);
              this.#sender([this.#broadcastState()]);
            }
          });
        }
        return room;
      }
    }

    // Se ninguém está conectado, mantém o host e o prazo vencido. A próxima
    // entrada de um jogador elegível resolve, sem timers repetindo em vazio.
    const candidate = room.players.find((p) => p.connected && !p.spectator);
    if (candidate === undefined) return room;

    this.#clearHostClock();
    const next = assignHost(room, candidate.publicId, randomUUID());
    // A exibição deixa de depender da pessoa que caiu. Cada um continua na
    // própria série; o novo host pode ligar "Assistir juntos" novamente.
    return next.tournament?.sync
      ? { ...next, tournament: { ...next.tournament, sync: null } }
      : next;
  }

  /** Desarma e rearma o relogio conforme o prazo do turno atual. */
  #rearmClock(): void {
    this.#cancelClock?.();
    this.#cancelClock = null;

    const draft = this.#room.draft;
    if (draft === null || draft.deadline === null) return;

    const ms = Math.max(0, draft.deadline - this.#deps.now());
    this.#cancelClock = this.#deps.schedule(ms, () => this.#onTurnTimeout());
  }

  #onTurnTimeout(): void {
    this.#cancelClock = null;
    const draft = this.#room.draft;
    if (draft === null || draft.deadline === null) return;

    // Um setTimeout pode disparar cedo. Sem esta guarda, um disparo adiantado
    // tiraria a vez de quem ainda tinha tempo.
    if (this.#deps.now() < draft.deadline) {
      this.#rearmClock();
      return;
    }

    const assentoNoRelogio = currentSeatIndex(draft);
    const depois = autoPick(draft, this.#cards, this.#deps.now(), this.#budget);
    this.#commit({ ...this.#room, draft: this.#driveDraft(depois) });
    this.#ultimoTimeoutAssento = assentoNoRelogio;
    this.#sender(this.#draftOutbound());
    this.#ultimoTimeoutAssento = null;
  }

  get room(): Room {
    return this.#room;
  }

  /**
   * Usado pelos planos seguintes (draft/torneio) e pelos testes.
   *
   * Rearma o relogio (Tarefa 7): virou a unica porta de mudanca de fase que
   * ficava fora do #commit, e por isso a unica que nao reancorava o
   * cronometro do draft. Ate agora era inofensivo porque nada chamava isto
   * com um draft de relogio armado; nao ha garantia nenhuma de que continue
   * assim.
   */
  setPhase(phase: RoomPhase): void {
    this.#room = { ...this.#room, phase };
    this.#deps.onRoomChanged(this.#room);
    this.#rearmClock();
  }

  #socketsOf(clientId: string): string[] {
    const saida: string[] = [];
    for (const [socketId, dono] of this.#sockets) {
      if (dono === clientId) saida.push(socketId);
    }
    return saida;
  }

  #conectados(): Set<string> {
    return new Set(this.#room.players.filter((p) => p.connected).map((p) => p.clientId));
  }

  #publicIds(): Map<string, string> {
    return new Map(this.#room.players.map((p) => [p.clientId, p.publicId]));
  }

  /** Orcamento do turno por assento, com o turnSeconds ATUAL da sala (D-17). */
  #budget: TurnBudget = (seat) =>
    turnBudgetFor(seat, this.#room.settings.turnSeconds, this.#conectados());

  /**
   * Faz os bots escolherem ate a vez cair num humano (conectado ou nao) ou o
   * draft acabar. O humano que caiu NAO e resolvido aqui: o relogio o resolve
   * depois da carencia, para quem recarregou a pagina nao perder a vez.
   *
   * Recebe o orcamento por parametro (padrao `this.#budget`) em vez de sempre
   * ler `this.#room.settings.turnSeconds`: no #handleStartDraft o turnSeconds
   * novo so entra na sala depois que o draft inteiro ja foi criado com sucesso
   * (F7 da revisao) — nesse momento `this.#room` ainda tem o valor antigo.
   */
  #driveDraft(draft: DraftState, budget: TurnBudget = this.#budget): DraftState {
    let atual = draft;
    for (let i = 0; i <= atual.turns.length; i++) {
      const seat = currentSeat(atual);
      if (seat === null || seat.clientId !== null) break;
      atual = autoPick(atual, this.#cards, this.#deps.now(), budget);
    }
    return atual;
  }

  /**
   * A mao do assento da vez. NUNCA `to: "all"` — o ws.ts difunde ate para
   * socket que nunca mandou hello (spec secao 13).
   */
  #handOutbound(): Outbound | null {
    const draft = this.#room.draft;
    if (draft === null) return null;
    const seat = currentSeat(draft);
    if (seat === null || seat.clientId === null) return null;

    const sockets = this.#socketsOf(seat.clientId);
    if (sockets.length === 0) return null;

    return {
      to: sockets,
      message: {
        type: "hand",
        cards: handCards(draft, this.#cards).map(([role, card]) => ({ role, card })),
        turnMsRemaining:
          draft.deadline === null ? null : Math.max(0, draft.deadline - this.#deps.now()),
      },
    };
  }

  /** Estado para todos + mao para quem esta na vez. */
  #draftOutbound(): Outbound[] {
    const saida: Outbound[] = [this.#broadcastState()];
    const mao = this.#handOutbound();
    if (mao !== null) saida.push(mao);
    return saida;
  }

  /**
   * A timeline de uma serie, so para os sockets de um clientId. NUNCA
   * `to: "all"` (spec §13, D-27): o ws.ts entrega broadcast ate para socket
   * que nunca mandou hello, e aqui viajam ate 1,7 MB por serie.
   */
  #gamesOutbound(clientId: string, slotId: SlotId): Outbound | null {
    const t = this.#room.tournament;
    if (t === null) return null;
    const sockets = this.#socketsOf(clientId);
    if (sockets.length === 0) return null;

    const r = timelineOf(t, slotId, this.#deps.catalogue);
    if (!r.ok) return null;

    // Cache em memoria (nao no disco -- a persistencia poda os eventos na
    // escrita, D-25, entao o snapshot continua pequeno): se a serie tinha
    // chegado sem timeline (sala recem-restaurada), guarda o jogo regenerado
    // de volta no bracket. A proxima chamada acha hasTimelines() verdadeiro e
    // pega o atalho sem regenerar de novo -- ~33ms por serie evitados a
    // partir do segundo pedido, medido pelo revisor.
    if (!hasTimelines(t.bracket.slots[slotId]!.series.games)) {
      this.#commit({ ...this.#room, tournament: withTimelineCached(t, slotId, r.games) });
    }

    return { to: sockets, message: { type: "games", slotId, games: r.games } };
  }

  /**
   * Estado para todos + a timeline de quem MUDOU de serie desde `anterior`.
   *
   * `anterior` e o torneio de ANTES do commit que motivou esta chamada; null
   * quando nao havia torneio nenhum ainda (a primeira onda do
   * startTournament, onde toda entrada de `watching` e nova por definicao).
   * Sem o diff, `ready`/`forceAdvance`/`setSyncMode` reenviavam a timeline de
   * TODO MUNDO a cada chamada, mesmo para quem nao mudou de serie -- ate 1,7
   * MB por pessoa a cada clique de "pronto" de qualquer um (achado da
   * revisao da Tarefa 8). `reiniciar` nao entra aqui: o cliente ja tem a
   * timeline na mao e remonta pelo `restartCount` que o roomState carrega.
   */
  #tournamentOutbound(anterior: RoomTournament | null): Outbound[] {
    const saida: Outbound[] = [this.#broadcastState()];
    const t = this.#room.tournament;
    if (t === null) return saida;
    for (const [clientId, slotId] of Object.entries(t.watching)) {
      if (anterior?.watching[clientId] === slotId) continue;
      const g = this.#gamesOutbound(clientId, slotId);
      if (g !== null) saida.push(g);
    }
    return saida;
  }

  #extras(): WireExtras {
    return {
      baseStatus: baseStatus(this.#cards),
      draft:
        this.#room.draft === null
          ? null
          : toDraftWire(
              this.#room.draft,
              this.#cards,
              this.#deps.now(),
              this.#conectados(),
              this.#publicIds(),
              this.#ultimoTimeoutAssento
            ),
      tournament: this.#tournamentExtras(),
    };
  }

  /** Traduz os participantes e as confirmações da rodada para IDs públicos.
   * A barreira inclui desconectados: o celular pode suspender a conexão. */
  #tournamentExtras(): TournamentWire | null {
    const t = this.#room.tournament;
    if (t === null) return null;

    const publicIds = this.#publicIds();
    const fio = toTournamentWire(t, (c) => publicIds.get(c) ?? null, this.#deps.catalogue);
    const conectado = (c: string) => this.#conectados().has(c);
    // Com a urna aberta ninguem "marca pronto": a decisao e o voto.
    const membros = t.vote === null ? barrierMembers(t, conectado) : [];
    const eleitores =
      t.vote === null ? [] : humanSeatIndexes(t).map((i) => t.seatClientIds[i]!).filter(conectado);

    return {
      ...fio,
      readyFaltam: membros.filter((c) => !t.ready.includes(c)).length,
      readyTotal: membros.length,
      barreira: membros.map((c) => publicIds.get(c)).filter((p): p is string => p !== undefined),
      vote:
        fio.vote === null
          ? null
          : { ...fio.vote, faltam: eleitores.filter((c) => t.vote!.votes[c] === undefined).length },
    };
  }

  async handle(socketId: string, raw: unknown): Promise<Outbound[]> {
    const parsed = ClientMessageSchema.safeParse(raw);
    if (!parsed.success) {
      return [this.#error(socketId, "bad_message", "Mensagem em formato desconhecido.")];
    }

    const msg = parsed.data;

    if (msg.type === "hello") {
      return this.#handleHello(socketId, msg);
    }

    if (msg.type === "pong") {
      return [];
    }

    const clientId = this.#sockets.get(socketId);
    if (clientId === undefined) {
      return [this.#error(socketId, "unknown_client", "Entre na sala antes (hello).")];
    }

    if (msg.type === "setSettings") {
      const result = setSettings(this.#room, clientId, msg.turnSeconds);
      if (!result.ok) return [this.#error(socketId, result.code, result.message)];
      this.#commit(result.room);
      return [this.#broadcastState()];
    }

    if (msg.type === "publishBase") {
      return this.#handlePublishBase(socketId, clientId, msg.database, msg.name);
    }

    if (msg.type === "startDraft") {
      return this.#handleStartDraft(socketId, clientId, msg.turnSeconds, msg.statsMode, msg.chaosLevel);
    }

    if (msg.type === "pick") {
      return this.#handlePick(socketId, clientId, msg.cardId);
    }

    if (msg.type === "startTournament") {
      return this.#handleStartTournament(socketId, clientId, msg.chaosLevel);
    }

    if (msg.type === "ready") {
      return this.#handleReady(socketId, clientId, msg.ready);
    }

    if (msg.type === "forceAdvance") {
      return this.#handleForceAdvance(socketId, clientId);
    }

    if (msg.type === "vote") {
      return this.#handleVote(socketId, clientId, msg.choice);
    }

    if (msg.type === "setWatch") {
      return this.#handleSetWatch(socketId, clientId, msg.slotId);
    }

    if (msg.type === "setSyncMode") {
      return this.#handleSetSyncMode(socketId, clientId, msg.enabled);
    }

    if (msg.type === "playbackControl") {
      return this.#handlePlaybackControl(socketId, clientId, msg.action);
    }

    if (msg.type === "rename") {
      const result = renamePlayer(this.#room, clientId, msg.nickname.trim(), msg.teamName.trim());
      if (!result.ok) return [this.#error(socketId, result.code, result.message)];
      this.#commit(result.room);
      return [this.#broadcastState()];
    }

    if (msg.type === "rematch") {
      const result = rematch(this.#room, clientId);
      if (!result.ok) return [this.#error(socketId, result.code, result.message)];
      this.#cancelClock?.();
      this.#cancelClock = null;
      this.#commit(result.room);
      return [this.#broadcastState()];
    }

    if (msg.type === "transferHost") {
      const result = transferHost(this.#room, clientId, msg.publicId, randomUUID());
      if (!result.ok) return [this.#error(socketId, result.code, result.message)];
      this.#commit(result.room);
      return [this.#broadcastState()];
    }

    if (msg.type === "removePlayer") {
      const result = removePlayer(this.#room, clientId, msg.publicId);
      if (!result.ok) return [this.#error(socketId, result.code, result.message)];
      this.#commit(result.room);
      return [this.#broadcastState()];
    }

    return [];
  }

  disconnect(socketId: string): Outbound[] {
    const clientId = this.#sockets.get(socketId);
    if (clientId === undefined) return [];

    this.#sockets.delete(socketId);

    // O mesmo jogador pode ter mais de um socket (outra aba, ou um socket morto
    // que o heartbeat so vai enterrar depois da reconexao). Se ainda resta um,
    // ele continua online — derrubar aqui apagaria um jogador vivo.
    if (this.#socketsOf(clientId).length > 0) return [];

    this.#commit(setConnected(this.#room, clientId, false));

    // Se caiu na propria vez, o prazo encolhe para a carencia (D-17): a sala
    // nao espera um minuto por quem fechou a aba, mas quem so deu F5 volta.
    const draft = this.#room.draft;
    const seat = draft === null ? null : currentSeat(draft);
    if (draft !== null && seat?.clientId === clientId && draft.deadline !== null) {
      const carencia = this.#deps.now() + DISCONNECTED_GRACE_SECONDS * 1000;
      if (carencia < draft.deadline) {
        this.#commit({ ...this.#room, draft: { ...draft, deadline: carencia } });
      }
    }

    const progresso = this.#reavaliarProgresso();
    if (progresso !== null) return progresso;

    return [this.#broadcastState()];
  }

  /** Reavalia a votação e a confirmação da rodada ao reconectar. Uma queda
   * não retira participantes da barreira nem inicia outra rodada. */
  #reavaliarProgresso(): Outbound[] | null {
    const t = this.#room.tournament;
    if (t === null || this.#room.phase === "finished") return null;

    const conectado = (c: string) => this.#conectados().has(c);

    if (t.vote !== null) {
      // Sem novo voto: so a lista de CONECTADOS mudou. Se quem caiu era
      // exatamente quem faltava votar, a urna fecha sozinha com quem
      // sobrou -- sem isso, um unico navegador fechado sem votar travaria
      // o podio para sempre, mesmo com todo mundo que ficou ja tendo
      // decidido.
      const resultado = voteResult(t, conectado);
      if (resultado === null) return null;
      return this.#aplicarUrna(t, resultado);
    }

    if (t.resultadosLiberados) return null;

    if (barrierSatisfied(t, conectado)) {
      this.#commit({ ...this.#room, tournament: { ...t, resultadosLiberados: true } });
      return this.#aposOnda(t);
    }

    if (this.#urnaSemNinguemNaBarreira(t)) {
      this.#commit({ ...this.#room, tournament: { ...openVote(t), ready: [] } });
      return this.#tournamentOutbound(t);
    }

    return null;
  }

  /**
   * Todo humano fora, a urna ainda fechada e a barreira VAZIA -- quem caiu na
   * rodada atual saiu sem marcar pronto (ou ja tinha saido quando a rodada
   * rodou). Ninguem mais vai marcar pronto, entao a urna abre para quem ficou;
   * sem isto a sala congelava ate o host forcar, e para sempre se o host era
   * quem tinha saido (revisao final, achado 4).
   */
  #urnaSemNinguemNaBarreira(t: RoomTournament): boolean {
    if (isTorneioFinished(t) || t.vote !== null || t.espectadoresContam || !allHumansEliminated(t)) return false;
    const conectado = (c: string) => this.#conectados().has(c);
    if (barrierMembers(t, conectado).length > 0) return false;
    return humanSeatIndexes(t).some((i) => conectado(t.seatClientIds[i]!));
  }

  /**
   * O que a barreira satisfeita faz (D2): com todo humano ja fora e a sala
   * ainda sem ter decidido continuar, abre a urna -- so agora, depois de todo
   * mundo ter assistido a serie em que caiu e marcado pronto (antes ela abria
   * no instante da onda e tomava a tela de todos, S6). Fora isso, roda a
   * proxima onda.
   */
  #avancar(t: RoomTournament): RoomTournament {
    if (t.vote === null && !t.espectadoresContam && allHumansEliminated(t)) {
      return { ...openVote(t), ready: [] };
    }
    return this.#rodarOnda(t);
  }

  /**
   * Resultado da urna (D2). "continuar": a proxima onda roda na hora -- todo
   * mundo ja tinha marcado pronto para a urna abrir, pedir pronto de novo
   * seria um clique a toa. "parar" ("Pular para o pódio"): o resto e simulado
   * de uma vez, o campeao e coroado e a sala vai para o podio.
   */
  #aplicarUrna(t: RoomTournament, resultado: VoteChoice): Outbound[] {
    const decidido = applyVoteResult(t, resultado);
    if (resultado === "parar") {
      this.#commit({ ...this.#room, phase: "finished", tournament: rodarAteOFim(decidido, this.#deps.catalogue) });
      return this.#tournamentOutbound(t);
    }
    this.#commit({ ...this.#room, tournament: this.#rodarOnda(decidido) });
    return this.#aposOnda(t);
  }

  // -------------------------------------------------------------------------

  #handleHello(socketId: string, msg: HelloMessage): Outbound[] {
    if (msg.protocolVersion !== PROTOCOL_VERSION) {
      return [
        {
          to: [socketId],
          message: {
            type: "protocolMismatch",
            serverVersion: PROTOCOL_VERSION,
            message: "Sua versão do jogo está diferente da do servidor. Recarregue a página.",
          },
        },
      ];
    }

    // Capturado ANTES do joinRoom (Q1 da revisao): o joinRoom aceita hello de
    // um clientId JA conectado — segunda aba, ou so um reenvio — e so re-marca
    // connected:true. Sem esta foto de antes, um jogador que nunca caiu e
    // manda hello de novo na propria vez reesticaria o prazo para sempre: o
    // turno nunca estoura, o draft trava. So esticamos para quem de fato
    // estava caido.
    const estavaCaido =
      msg.clientId !== undefined &&
      this.#room.players.some((p) => p.clientId === msg.clientId && !p.connected);

    const result = joinRoom(
      this.#room,
      { clientId: msg.clientId, nickname: msg.nickname, teamName: msg.teamName, hostToken: msg.hostToken },
      this.#deps.makeClientId(),
      this.#deps.makePublicId()
    );

    if (!result.ok) {
      return [this.#error(socketId, result.code, result.message)];
    }

    this.#sockets.set(socketId, result.clientId);
    this.#commit(result.room);

    const player = this.#room.players.find((p) => p.clientId === result.clientId);
    if (player === undefined) {
      return [this.#error(socketId, "unknown_client", "Não consegui te colocar na sala.")];
    }

    // Quem estava caido e volta na propria vez recupera o turno cheio (D-17).
    // So estica se estava caido (Q1) — uma segunda aba de quem nunca
    // desconectou nao mexe no prazo, so recebe a mao de novo mais abaixo.
    const draft = this.#room.draft;
    const seat = draft === null ? null : currentSeat(draft);
    const eADonoDaVez = draft !== null && seat?.clientId === result.clientId;
    if (eADonoDaVez && estavaCaido) {
      // O teto por turno (G-1 da revisao final): devolver o turno cheio e o
      // D-17 e continua valendo, mas nunca alem de TURN_WALL_CLOCK_CAP vezes o
      // turno contados do inicio dele. Sem o corte, alternar queda e volta
      // (Wi-Fi instavel resolve isso sozinho, sem ma-fe) segura o turno para
      // sempre: nao ha contador de reconexoes nem forceAdvance neste plano.
      // Passado o teto o prazo sai no passado e o #rearmClock agenda o
      // autoPick para o proximo tique — o draft segue.
      const turnoMs = this.#room.settings.turnSeconds * 1000;
      this.#commit({
        ...this.#room,
        draft: {
          ...draft!,
          deadline: capTurnDeadline(draft!, this.#deps.now() + turnoMs, turnoMs),
        },
      });
    }

    // Voltar muda o conjunto de conectados tanto quanto cair (M-2 da revisao
    // final): a urna e a barreira sao reavaliadas aqui pela MESMA funcao que o
    // disconnect usa. Roda ANTES de montar a saida para que o roomState abaixo
    // ja saia com a onda nova — um estado velho no meio da mesma rodada de
    // mensagens desenharia a tela anterior por um quadro sem motivo.
    const progresso = this.#reavaliarProgresso();

    // O broadcastState so e montado AQUI, depois de qualquer estico de prazo
    // (Q2 da revisao) e da reavaliacao acima: monta-lo antes deixaria o
    // roomState de todo mundo com o turnMsRemaining antigo (curto, da
    // carencia) parado ate a proxima mudanca de sala — nao ha broadcast
    // periodico que corrija isso sozinho, o ws.ts so manda ping.
    const saida: Outbound[] = [
      {
        to: [socketId],
        message: {
          type: "welcome",
          clientId: result.clientId,
          publicId: player.publicId,
          isHost: player.isHost,
          protocolVersion: PROTOCOL_VERSION,
        },
      },
      this.#broadcastState(),
    ];

    // A mao e reenviada sempre que for a vez dele, caido ou nao: ela e
    // privada e este socket novo nunca a viu, e reenviar pra quem ja tinha e
    // inofensivo.
    if (eADonoDaVez) {
      const mao = this.#handOutbound();
      if (mao !== null) saida.push(mao);
    }

    // Quem estava acompanhando uma serie do torneio e reconecta recupera a
    // timeline, nao so o chaveamento: o roomState acima ja carrega o bracket,
    // mas a timeline em si so viaja enderecada e sob demanda (D-27), e este
    // socket novo nunca a viu. Sem isto, quem cai no meio de um jogo volta
    // vendo o chaveamento e nada de partida — a Tarefa 7 deixou esse buraco,
    // porque antes do setWatch desta tarefa nao havia como escolher serie.
    // Espectador recem-chegado com "Assistir juntos" ligado vai direto para a
    // serie da sala: os cards ficam travados em sincronia e ele ficaria no
    // chaveamento sem poder abrir nada (revisao final, achado 6).
    const sincronia = this.#room.tournament?.sync ?? null;
    if (player.spectator && sincronia !== null && this.#room.tournament!.watching[result.clientId] === undefined) {
      const tt = this.#room.tournament!;
      this.#commit({
        ...this.#room,
        tournament: { ...tt, watching: { ...tt.watching, [result.clientId]: sincronia.slotId } },
      });
    }

    const t = this.#room.tournament;
    const slotAssistido = t === null ? undefined : t.watching[result.clientId];
    if (slotAssistido !== undefined) {
      const g = this.#gamesOutbound(result.clientId, slotAssistido);
      if (g !== null) saida.push(g);
    }

    // O que a reavaliacao acima produziu, SEM o roomState dela (o `saida[1]` ja
    // foi montado depois dela e carrega exatamente o mesmo estado) e sem a
    // timeline deste socket (o bloco acima ja mandou a serie que ele acompanha
    // AGORA, depois da onda). O que sobra e a timeline de quem MUDOU de serie
    // com a onda nova — outras pessoas, que precisam dela tanto quanto quem
    // acabou de voltar. Duplicar aqui custaria ate 1,7 MB por serie (D-27).
    if (progresso !== null) {
      saida.push(
        ...progresso.filter(
          (o) =>
            o.message.type !== "roomState" &&
            !(o.message.type === "games" && o.to !== "all" && o.to.includes(socketId))
        )
      );
    }

    return saida;
  }

  async #handlePublishBase(
    socketId: string,
    clientId: string,
    database: unknown, name?: string
  ): Promise<Outbound[]> {
    const player = this.#room.players.find((p) => p.clientId === clientId);
    if (!player?.isHost) {
      return [this.#error(socketId, "not_host", "Só quem hospeda publica a base.")];
    }
    if (this.#room.phase !== "lobby") {
      return [
        this.#error(socketId, "in_progress", "A base só pode mudar antes do draft começar."),
      ];
    }

    let playerCount: number;
    try {
      playerCount = await this.#deps.publishBase(database);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "base inválida";
      return [this.#error(socketId, "invalid_base", `Base recusada: ${detail}`)];
    }

    // A gravacao ja deu certo aqui — o disco esta correto e e ele que o
    // /players.json serve. Uma falha ao reler so deixa a copia em memoria
    // (usada pelo baseStatus do roomState) atrasada em relacao ao disco; isso
    // nao e a mesma coisa que a publicacao ter sido recusada, entao nao pode
    // virar invalid_base — isso mentiria pro host que acabou de conferir que
    // deu certo. So registra e segue com a copia antiga ate a proxima leitura.
    try {
      this.#cards = await this.#deps.loadPlayers();
    } catch (err) {
      console.error("[sala] falha ao reler a base depois de publicar:", err);
    }

    this.#commit({ ...this.#room, settings: { ...this.#room.settings, baseName: name ?? "Base importada" } });
    return [
      { to: "all", message: { type: "basePublished", playerCount } },
      this.#broadcastState(),
    ];
  }

  #handleStartDraft(socketId: string, clientId: string, turnSeconds: number, statsMode?: import("../../src/data/statsPolicy").StatsMode, chaosLevel?: number): Outbound[] {
    const player = this.#room.players.find((p) => p.clientId === clientId);
    if (player === undefined || !player.isHost) {
      return [this.#error(socketId, "not_host", "Só quem hospeda começa o draft.")];
    }
    if (this.#room.phase !== "lobby") {
      return [this.#error(socketId, "in_progress", "O draft já começou.")];
    }
    if (!canStart(this.#room)) {
      return [
        this.#error(
          socketId,
          "not_enough_players",
          "Precisa de pelo menos 2 jogadores conectados para começar."
        ),
      ];
    }

    const status = baseStatus(this.#cards);
    if (!status.ready) {
      return [this.#error(socketId, "base_insuficiente", baseStatusMessage(status))];
    }

    // O turnSeconds da mensagem vale a partir de agora — evita uma ida e volta
    // de setSettings so para ajustar o relogio na hora de comecar. Passado
    // como orcamento local (turnBudgetFor) em vez de mutar this.#room aqui:
    // se createDraft lancasse, a sala tinha que continuar intacta no lobby,
    // nao presa em "draft" sem draft nenhum e sem onRoomChanged (F7 da
    // revisao) — so ha UM #commit, no fim, com tudo pronto.
    const orcamentoDeAbertura: TurnBudget = (seat) =>
      turnBudgetFor(seat, turnSeconds, this.#conectados());

    // So quem esta CONECTADO agora ganha assento (achado do teste de sala,
    // 2026-08-27): sem este filtro, um jogador que entrou e caiu antes do
    // draft comecar (link velho, aba fechada, reconexao com outro clientId)
    // vira um assento fantasma permanente -- ninguem mais controla aquele
    // clientId, e ele consome o turno inteiro (nunca a carencia curta de
    // desconectado, D-17, porque so passa a existir DEPOIS do draft criado)
    // em toda rodada, para sempre. Mesmo criterio que `canStart` ja usa pro
    // minimo de jogadores.
    const draft = createDraft({
      players: this.#cards,
      humans: this.#room.players
        .filter((p) => p.connected && !p.spectator)
        .map((p) => ({ clientId: p.clientId, teamName: p.teamName })),
      seed: this.#deps.makeSeed(),
      now: this.#deps.now(),
      budget: orcamentoDeAbertura,
    });

    const comRelogio: Room = {
      ...this.#room,
      phase: "draft",
      settings: { ...this.#room.settings, turnSeconds, statsMode: statsMode ?? "never", chaosLevel: chaosLevel ?? 0.25 },
      draft: this.#driveDraft(draft, orcamentoDeAbertura),
    };

    this.#commit(comRelogio);
    return this.#draftOutbound();
  }

  #handlePick(socketId: string, clientId: string, cardId: string): Outbound[] {
    const draft = this.#room.draft;
    if (draft === null || this.#room.phase !== "draft") {
      return [this.#error(socketId, "in_progress", "O draft não está rolando.")];
    }

    const seat = currentSeat(draft);
    if (seat === null || seat.clientId !== clientId) {
      return [this.#error(socketId, "not_your_turn", "Não é a sua vez.")];
    }

    const r = applyPick(draft, this.#cards, cardId, this.#deps.now(), this.#budget);
    if (!r.ok) {
      // A mao volta junto com o erro (m-1 da revisao final). O cliente limpa a
      // mao otimisticamente no envio, entao um pick recusado deixava a tela sem
      // carta e sem botao ate o relogio tomar o turno. O caso comum
      // (not_your_turn) ja saiu la em cima e nem chega aqui; o que chega e o
      // card_not_in_hand com a vez ainda sendo desta pessoa — que nao tem cura
      // nenhuma sem isto. Continua enderecada (#handOutbound so fala com os
      // sockets do dono da vez, que aqui e quem pediu), nunca difundida.
      const mao = this.#handOutbound();
      const erro = this.#error(socketId, r.code, r.message);
      return mao === null ? [erro] : [erro, mao];
    }

    this.#commit({ ...this.#room, draft: this.#driveDraft(r.state) });
    return this.#draftOutbound();
  }

  #handleStartTournament(socketId: string, clientId: string, chaosLevel: number): Outbound[] {
    const jogador = this.#room.players.find((p) => p.clientId === clientId);
    if (jogador === undefined || !jogador.isHost) {
      return [this.#error(socketId, "not_host", "Só o host começa o torneio.")];
    }
    if (this.#room.tournament !== null) {
      return [this.#error(socketId, "in_progress", "O torneio já começou.")];
    }
    const draft = this.#room.draft;
    if (draft === null || !isFinished(draft)) {
      return [this.#error(socketId, "draft_incompleto", "O draft ainda não acabou.")];
    }

    let torneio: RoomTournament;
    try {
      torneio = createRoomTournament({ draft, players: this.#cards, chaosLevel: this.#room.settings.chaosLevel ?? chaosLevel });
    } catch (e) {
      return [this.#error(socketId, "draft_incompleto", (e as Error).message)];
    }

    // O relogio do draft e desarmado aqui (defensivo): quando o draft termina,
    // dealHand ja zera o `deadline` e o #rearmClock do ultimo #commit ja
    // desarma o timer — hoje nao ha um setTimeout sobrevivente para cancelar.
    // Mas #handleStartTournament e o unico lugar que muda a fase para
    // "tournament", e o draft nao tem mais turno nenhum para vigiar depois
    // disso: um setTimeout sobrevivente disparando #onTurnTimeout no meio do
    // torneio acharia `room.draft` terminado e faria besteira silenciosa.
    this.#cancelClock?.();
    this.#cancelClock = null;
    this.#commit({ ...this.#room, phase: "tournament", tournament: this.#rodarOnda(torneio) });
    // Nao havia torneio nenhum antes deste commit -- toda entrada de
    // `watching` que o autoWatch acabou de criar e nova por definicao.
    return this.#tournamentOutbound(null);
  }

  #handleReady(socketId: string, clientId: string, ready: boolean): Outbound[] {
    const t = this.#room.tournament;
    if (t === null) return [this.#error(socketId, "torneio_nao_comecou", "O torneio ainda não começou.")];
    if (this.#room.phase === "finished") {
      return [this.#error(socketId, "torneio_nao_comecou", "O torneio já acabou.")];
    }

    if (t.vote !== null) {
      return [this.#error(socketId, "votacao_fechada", "A sala está votando agora. Vote em vez de marcar pronto.")];
    }
    if (t.resultadosLiberados) return [this.#broadcastState()];
    if (!barrierMembers(t, () => true).includes(clientId)) return [this.#broadcastState()];
    let proximo = setReady(t, clientId, ready);
    const conectado = (c: string) => this.#conectados().has(c);
    if (barrierSatisfied(proximo, conectado)) proximo = { ...proximo, resultadosLiberados: true };

    this.#commit({ ...this.#room, tournament: proximo });
    return this.#aposOnda(t);
  }

  /** Inicia a próxima rodada após a confirmação coletiva. Durante uma votação,
   * preserva a ação do host de apurar os votos disponíveis. */
  #handleForceAdvance(socketId: string, clientId: string): Outbound[] {
    const jogador = this.#room.players.find((p) => p.clientId === clientId);
    if (jogador === undefined || !jogador.isHost) {
      return [this.#error(socketId, "not_host", "Só o host começa a próxima rodada.")];
    }
    const t = this.#room.tournament;
    if (t === null) return [this.#error(socketId, "torneio_nao_comecou", "O torneio ainda não começou.")];

    // Sala encerrada nao volta a andar (M-1 da revisao final). As duas
    // terminacoes chegam em `finished`, e so uma delas tem campeao: depois de a
    // urna apurar "parar", `applyVoteResult` so zera `vote` -- `championId`
    // continua null e `isTorneioFinished` e falso, entao nada aqui barrava o
    // forceAdvance. O host retomava um torneio que a sala tinha acabado de
    // votar para encerrar, e o podio trocava "parou pela metade" por um campeao
    // que ninguem quis. A fase e a unica testemunha das DUAS terminacoes.
    if (this.#room.phase === "finished") {
      return [this.#error(socketId, "torneio_nao_comecou", "O torneio já acabou.")];
    }

    if (t.vote !== null) {
      return this.#aplicarUrna(t, forceVoteResult(t));
    }

    if (!t.resultadosLiberados) {
      return [this.#error(socketId, "bad_message", "Espere todos marcarem Ready antes de iniciar a próxima rodada.")];
    }

    if (readySlots(t).length === 0) {
      return [this.#error(socketId, "torneio_nao_comecou", "Não há rodada para começar.")];
    }
    this.#commit({ ...this.#room, tournament: this.#avancar(t) });
    return this.#aposOnda(t);
  }

  /**
   * O voto da urna (D-33): so quem tem assento (humano ou nao, elemento de
   * `seatClientIds`) vota, e so enquanto a urna estiver aberta. Votar de novo
   * troca o voto anterior -- `castVote` sobrescreve, nao acumula.
   *
   * Fecha sozinha quando todo humano CONECTADO ja votou (`voteResult`); quem
   * nao votou nao entra na conta, e empate mantem o torneio rodando (D-33). Se
   * ainda falta voto, so devolve o roomState -- sem `#tournamentOutbound`
   * porque castVote nunca muda `watching`, entao nao ha timeline nova pra
   * ninguem.
   */
  #handleVote(socketId: string, clientId: string, choice: VoteChoice): Outbound[] {
    const t = this.#room.tournament;
    if (t === null || t.vote === null) {
      return [this.#error(socketId, "votacao_fechada", "Não há votação aberta.")];
    }
    if (t.seatClientIds.indexOf(clientId) === -1) {
      return [this.#error(socketId, "votacao_fechada", "Só quem tem time na sala vota.")];
    }

    let proximo = castVote(t, clientId, choice);
    const conectado = (c: string) => this.#conectados().has(c);
    const resultado = voteResult(proximo, conectado);
    if (resultado === null) {
      this.#commit({ ...this.#room, tournament: proximo });
      return [this.#broadcastState()];
    }

    return this.#aplicarUrna(proximo, resultado);
  }

  /**
   * A ordem importa, e ela e: CONFERIR e so entao MUDAR.
   *
   * `setWatch` (puro, so olha o bracket) pode aceitar uma serie cuja gravacao o
   * `timelineOf` nao consiga refazer (regeneracao, nao bracket). Responder
   * gravacao_indisponivel e melhor que mandar um roomState dizendo que a pessoa
   * assiste a algo que nunca chega.
   *
   * Ate a revisao final o codigo fazia o contrario do que essa frase manda:
   * comitava a escolha e SO DEPOIS conferia a gravacao -- o aviso e o defeito
   * na mesma pagina do plano. Ficou barato enquanto o estrago era de uma pessoa
   * so; com a sincronia movendo a sala inteira (abaixo), um pedido que o
   * servidor ja sabia que ia falhar arrastava os oito para uma tela sem
   * partida. Agora nada muda de estado antes da conferencia passar: falhou,
   * a sala continua exatamente onde estava e so quem pediu recebe o erro.
   *
   * Com a sincronia ligada, so o host escolhe (D-28: "em sincronia ninguem
   * escolhe") -- G-1 da revisao final. Antes disto o servidor aceitava o
   * setWatch de qualquer um enquanto a tela do convidado afirmava o oposto,
   * e o estrago nao parava na frase falsa: `sync` continuava apontando para a
   * serie do host, entao a tela do fugitivo lia o `sync.gameIndex` do host
   * indexando a serie DELE -- num indice inexistente, tela travada sem saida.
   *
   * E a escolha do host em sincronia MOVE a sincronia: sincronia tem um
   * significado so -- a sala inteira assiste ao que o host assiste. Aceitar a
   * troca dele e deixar `sync` para tras deixava o host vendo uma serie e
   * IMPONDO outra aos sete restantes: o mesmo estado incoerente da G-1, por
   * outra porta. Recusar seria a resposta errada (o interruptor e dele); a
   * resposta e obedecer, como quando ele liga a sincronia -- `sync.slotId`
   * acompanha, `gameIndex` volta a zero (o jogo 2 da serie velha nao significa
   * nada na nova) e todo humano e reapontado. So o `restartCount` atravessa
   * intacto: ele so cresce, por contrato com o botao de reiniciar.
   */
  #handleSetWatch(socketId: string, clientId: string, slotId: SlotId): Outbound[] {
    const t = this.#room.tournament;
    if (t === null) return [this.#error(socketId, "torneio_nao_comecou", "O torneio ainda não começou.")];

    if (t.sync !== null) {
      const jogador = this.#room.players.find((p) => p.clientId === clientId);
      if (jogador === undefined || !jogador.isHost) {
        return [
          this.#error(
            socketId,
            "not_host",
            "A sala está sincronizada: só quem hospeda escolhe a série."
          ),
        ];
      }
    }

    // Conferencia 1 (bracket): a serie existe e ja foi jogada? Vem primeiro
    // para que uma serie que nunca rolou responda serie_desconhecida, e nao
    // gravacao_indisponivel -- sao coisas diferentes para quem le a frase.
    if (setWatch(t, clientId, slotId) === null) {
      return [this.#error(socketId, "serie_desconhecida", "Essa série ainda não foi jogada.")];
    }

    // Conferencia 2 (regeneracao): a gravacao pode ser refeita? Ainda antes de
    // qualquer mudanca de estado.
    const g = this.#gamesOutbound(clientId, slotId);
    if (g === null) {
      return [this.#error(socketId, "gravacao_indisponivel", "A gravação dessa série não pode ser refeita.")];
    }

    // A partir daqui nada mais falha. `#gamesOutbound` pode ter comitado o
    // cache da timeline regenerada, entao a base e o torneio ATUAL, nunca o `t`
    // lido la em cima -- que agora esta velho. O bracket e o mesmo (o cache so
    // devolve os `events` de uma serie que ja tinha jogo), entao este setWatch
    // repete a decisao da conferencia 1 e nao tem como recusar.
    const base = this.#room.tournament!;
    const escolhido = setWatch(base, clientId, slotId)!;

    // Chegou aqui com sincronia: quem escolheu e o host (a guarda la em cima ja
    // barrou o resto). A sincronia vai junto, e com ela todo mundo.
    const proximo: RoomTournament =
      base.sync === null
        ? escolhido
        : {
            ...escolhido,
            sync: { ...base.sync, slotId, gameIndex: 0, stage: "select" },
            watching: sincronizarTodos(escolhido, slotId, this.#plateia()),
          };

    this.#commit({ ...this.#room, tournament: proximo });

    // Em sincronia a troca mexeu no `watching` de todo mundo: quem foi
    // arrastado junto precisa da timeline nova, ou fica com o chaveamento novo
    // e partida nenhuma. O #tournamentOutbound manda so para quem MUDOU de
    // serie de fato (diff contra `base`), sempre enderecada (D-27).
    if (base.sync !== null) return this.#tournamentOutbound(base);

    return [this.#broadcastState(), g];
  }

  /**
   * Em sincronia ninguem escolhe (D-28): ligar aponta todo humano para a
   * serie que o proprio host esta acompanhando; desligar so devolve o
   * controle a cada tela, sem mexer no `watching` de ninguem.
   */
  #handleSetSyncMode(socketId: string, clientId: string, enabled: boolean): Outbound[] {
    const jogador = this.#room.players.find((p) => p.clientId === clientId);
    if (jogador === undefined || !jogador.isHost) {
      return [this.#error(socketId, "not_host", "Só o host liga o modo sincronizado.")];
    }
    const t = this.#room.tournament;
    if (t === null) return [this.#error(socketId, "torneio_nao_comecou", "O torneio ainda não começou.")];

    if (!enabled) {
      this.#commit({ ...this.#room, tournament: { ...t, sync: null } });
      return [this.#broadcastState()];
    }

    const slotId = t.watching[clientId];
    if (slotId === undefined) {
      return [this.#error(socketId, "serie_desconhecida", "Escolha uma série antes de sincronizar.")];
    }
    const proximo: RoomTournament = {
      ...t,
      sync: { slotId, gameIndex: 0, restartCount: 0, stage: "select" },
      watching: sincronizarTodos(t, slotId, this.#plateia()),
    };
    this.#commit({ ...this.#room, tournament: proximo });
    return this.#tournamentOutbound(t);
  }

  /**
   * So o host, e so quando ha sincronia ativa: sem ela cada um controla a
   * propria tela e a mensagem nem precisa chegar ao servidor (o cliente nao a
   * manda). Chegando mesmo assim, e um no-op silencioso — nao ha o que
   * controlar.
   *
   * Todas as quatro acoes mexem so em `sync`, nunca em `watching`: a sincronia
   * ja fixou todo mundo na mesma serie quando foi ligada.
   */
  #handlePlaybackControl(socketId: string, clientId: string, action: PlaybackAction): Outbound[] {
    const jogador = this.#room.players.find((p) => p.clientId === clientId);
    if (jogador === undefined || !jogador.isHost) {
      return [this.#error(socketId, "not_host", "Só o host controla a exibição sincronizada.")];
    }
    const t = this.#room.tournament;
    if (t === null) return [this.#error(socketId, "torneio_nao_comecou", "O torneio ainda não começou.")];
    // Sem sincronia ativa, esta mensagem so chega ao servidor por engano: em
    // modo normal a navegacao entre jogos e local do cliente e nem sai da
    // tela dele. Nao vale um ErrorCode novo no protocolo so para um caso que
    // a UI ja evita gerar -- ignorar de proposito, nao por esquecimento.
    if (t.sync === null) return [];

    const totalJogos = t.bracket.slots[t.sync.slotId]!.series.games.length;
    let sync: RoomTournament["sync"] = t.sync;
    switch (action) {
      case "proximoJogo":
        // Jogo novo: a selecao de campeoes volta a valer para todo mundo
        // (Fase 3) -- sem isto quem chegasse no jogo seguinte herdaria o
        // "playback" do jogo anterior e nunca veria a introducao dele.
        sync = { ...t.sync, gameIndex: Math.min(t.sync.gameIndex + 1, totalJogos - 1), stage: "select" };
        break;
      case "jogoAnterior":
        sync = { ...t.sync, gameIndex: Math.max(t.sync.gameIndex - 1, 0), stage: "select" };
        break;
      case "reiniciar":
        // So cresce (schema): sem isto o roomState sairia identico ao
        // anterior e nenhum cliente remontaria a tela — o botao nao faria
        // nada. `stage` volta a "select" pelo mesmo motivo do gameIndex: e
        // o MESMO jogo, mas do zero.
        sync = { ...t.sync, restartCount: t.sync.restartCount + 1, stage: "select" };
        break;
      case "voltarAoChaveamento":
        // Desliga a sincronia (nao so zera o gameIndex): o cliente decide a
        // tela olhando so se `sync` e nulo ou nao, e um `sync` vivo apontando
        // pra a mesma serie devolveria a pessoa pra ela no proximo quadro --
        // o botao nao faria nada, o mesmo problema que o restartCount existe
        // pra evitar em "reiniciar".
        sync = null;
        break;
      case "pularSelecao":
        // So o host manda (guarda no topo da funcao) -- e por isso que da
        // pra confiar cegamente: ninguem pula a introducao sozinho, so a
        // sala inteira de uma vez (Fase 3, achado do usuario sobre a
        // sincronia ser "todo mundo obrigado a ir junto").
        sync = { ...t.sync, stage: "playback" };
        break;
    }

    this.#commit({ ...this.#room, tournament: { ...t, sync } });
    return [this.#broadcastState()];
  }

  /**
   * O que acontece depois de toda onda (`ready`, `forceAdvance` e a barreira
   * reavaliada no `disconnect`): campeao coroado encerra a sala; senao, o
   * ultimo humano caindo abre a urna.
   *
   * A ordem importa (Tarefa 9): o campeao coroado e conferido PRIMEIRO e
   * retorna cedo -- um torneio que acabou nao abre votacao nenhuma, mesmo que
   * allHumansEliminated(t) tambem seja verdade (o time campeao pode nao ter
   * humano nenhum, e os outros sete estao todos fora por definicao).
   *
   * A urna so abre quando `!t.espectadoresContam`: depois que a votacao
   * decide "continuar", os times eliminados passam a contar na barreira
   * (D-29) e allHumansEliminated(t) continua verdadeiro para sempre dali pra
   * frente (eliminacao nao se desfaz) -- sem essa guarda, toda onda seguinte
   * tentaria reabrir uma urna que ja foi decidida.
   *
   * `anterior` e o torneio de antes da chamada que motivou esta onda —
   * repassado para #tournamentOutbound so reenviar timeline de quem mudou de
   * serie de fato.
   */
  #aposOnda(anterior: RoomTournament | null): Outbound[] {
    const t = this.#room.tournament;
    if (t === null) return this.#tournamentOutbound(anterior);

    if (isTorneioFinished(t) && (t.resultadosLiberados || t.pulado)) {
      if (this.#room.phase !== "finished") {
        this.#commit({ ...this.#room, phase: "finished" });
      }
      return this.#tournamentOutbound(anterior);
    }

    // A urna NAO abre mais aqui (D2): ver #avancar. So a excecao da barreira
    // vazia -- quem caiu nesta rodada ja estava fora quando ela rodou.
    if (this.#urnaSemNinguemNaBarreira(t)) {
      this.#commit({ ...this.#room, tournament: { ...openVote(t), ready: [] } });
    }
    return this.#tournamentOutbound(anterior);
  }

  /**
   * Roda a onda e loga quanto demorou — o D-24 se apoia nessa medicao. Guarda
   * a lista de series liberadas ANTES de rodar (readySlots) e usa exatamente
   * essa lista para o autoWatch: depois de rodar, aquelas series ja nao estao
   * mais em `ready` — outras podem ter acabado de se liberar no lugar delas.
   */
  #rodarOnda(t: RoomTournament): RoomTournament {
    const daOnda = readySlots(t);
    const antes = this.#deps.now();
    const depois = runWave(t, this.#deps.catalogue);
    const ms = this.#deps.now() - antes;
    if (ms > 2_000) {
      console.warn(`[sala] onda ${depois.wave} levou ${ms}ms - acima do medido (335ms)`);
    }
    const apontado = apontarPlateia(autoWatchEspectadores(autoWatch(depois, daOnda), daOnda), this.#plateia(), daOnda);
    return this.#sincroniaSegueOHost(apontado, daOnda);
  }

  /**
   * "Assistir juntos" sobrevive a onda nova (S16): a sincronia passa para a
   * serie que o host acompanha agora (o autoWatch acabou de aponta-lo para a
   * do time dele) e leva a sala inteira junto, do primeiro jogo. Antes ela
   * ficava presa na serie da onda anterior e o host tinha de religar a cada
   * rodada.
   */
  #sincroniaSegueOHost(t: RoomTournament, daOnda: SlotId[]): RoomTournament {
    if (t.sync === null || daOnda.length === 0) return t;
    const host = this.#room.players.find((p) => p.isHost);
    const doHost = host === undefined ? undefined : t.watching[host.clientId];
    // Time do host folgando nesta rodada (ou host sem serie): a sala vai para
    // a primeira serie da rodada nova, nunca fica presa na antiga enquanto os
    // convidados eram mandados cada um para a sua (revisao final, achado 7).
    const slot = doHost !== undefined && daOnda.includes(doHost) ? doHost : daOnda[0]!;
    if (slot === t.sync.slotId) return t;
    return {
      ...t,
      sync: { ...t.sync, slotId: slot, gameIndex: 0, stage: "select" },
      watching: sincronizarTodos(t, slot, this.#plateia()),
    };
  }

  /** clientIds de quem entrou para assistir depois do lobby (S19). */
  #plateia(): string[] {
    return this.#room.players.filter((p) => p.spectator).map((p) => p.clientId);
  }

  #commit(room: Room): void {
    const anterior = this.#room.draft;
    this.#room = this.#updateAutoHost(room);
    this.#deps.onRoomChanged(this.#room);
    this.#rearmClock();
    this.#avisarSeFechouIncompleto(anterior, this.#room.draft);
  }

  /**
   * O autoPick pula o turno quando a mao vem vazia (baralho insuficiente) em
   * vez de travar a sala — decisao certa. Mas o assento termina com menos de
   * PICKS_PER_SEAT cartas e nada sinalizava isso: nem log, nem campo no fio,
   * nem invariante no fim (m-6 da revisao final). O D-14 torna o caso
   * inalcancavel hoje; o torneio do proximo plano vai converter estes rosters
   * em times, e um buraco calado vira erro longe daqui.
   *
   * Avisa uma vez so, no commit que fecha o draft — nao a cada mudanca de sala
   * depois disso.
   */
  #avisarSeFechouIncompleto(antes: DraftState | null, depois: DraftState | null): void {
    if (depois === null || !isFinished(depois)) return;
    if (antes !== null && isFinished(antes)) return;

    const incompletos = incompleteSeats(depois);
    if (incompletos.length === 0) return;

    console.warn(
      `[sala] draft encerrado com roster incompleto nos assentos ${incompletos.join(", ")} - ` +
        `o baralho acabou antes de fechar as ${PICKS_PER_SEAT} rodadas.`
    );
  }

  #broadcastState(): Outbound {
    const state = toWire(this.#room, this.#extras());
    state.baseSummary = { cards: this.#cards.length, people: new Set(this.#cards.map(c => c.personId)).size, examples: this.#cards.slice(0, 3).map(c => c.displayName) };
    if (state.draft && this.#room.draft) state.draft.options = handCards(this.#room.draft, this.#cards).map(([role, card]) => ({ role, card }));
    return { to: "all", message: { type: "roomState", state } };
  }

  #error(socketId: string, code: ErrorCode, message: string): Outbound {
    return { to: [socketId], message: { type: "error", code, message } };
  }
}
