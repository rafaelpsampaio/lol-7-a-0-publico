/**
 * src/net/store.ts
 *
 * Sinais SolidJS espelhando o estado da sala. Nenhuma regra vive aqui:
 * o servidor manda o estado, o store so guarda.
 */

import { createSignal, type Accessor } from "solid-js";
import type { z } from "zod";
import {
  HandCardSchema,
  SlotIdSchema,
  StoredGameSchema,
  type DraftSeatWire,
  type DraftWire,
  type PlaybackAction,
  type RoomWire,
  type TournamentWire,
  type VoteChoice,
} from "../../server/protocol";
import {
  PROTOCOL_VERSION,
  RoomClient,
  rememberClientId,
  rememberIdentity,
  roomSocketUrl,
  safeStorage,
  storedClientId,
  storedIdentity,
  type MinimalStorage,
  type RoomIdentity,
  type RoomSocketFactory,
} from "./client";

export type HandCard = z.infer<typeof HandCardSchema>;

/**
 * Onde a conexao com a sala esta, para a faixa de status (Rundown da Sala 2,
 * S10). `connected()` continua dizendo so se o fio existe; isto diz o resto.
 *  - fora: ainda nao tentou entrar (formulario na tela);
 *  - entrando: socket aberto, hello enviado, esperando o welcome;
 *  - na-sala: welcome recebido;
 *  - reconectando: estava na sala, o fio caiu, a proxima tentativa esta marcada;
 *  - recusado: o servidor recusou a entrada (nome repetido, sala cheia...);
 *  - versao-diferente: esta pagina e de outra versao do jogo -- recarregar.
 */
export type StatusDaSala = "fora" | "entrando" | "na-sala" | "reconectando" | "recusado" | "versao-diferente";

/** Espera entre tentativas de reconexao, em ms: cresce e para no teto. */
export const ESPERAS_DE_RECONEXAO = [1000, 2000, 4000, 8000, 10000];

export function esperaDaTentativa(tentativa: number): number {
  return ESPERAS_DE_RECONEXAO[Math.min(tentativa, ESPERAS_DE_RECONEXAO.length - 1)]!;
}
export type SlotId = z.infer<typeof SlotIdSchema>;
export type StoredGame = z.infer<typeof StoredGameSchema>;

export interface RoomStore {
  state: Accessor<RoomWire | null>;
  clientId: Accessor<string | null>;
  publicId: Accessor<string | null>;
  isHost: Accessor<boolean>;
  error: Accessor<string | null>;
  /** Confirmacao da ultima publicacao de base, em portugues. */
  baseMessage: Accessor<string | null>;
  connected: Accessor<boolean>;
  /** Estado da conexao para a faixa de status (ver StatusDaSala). */
  status: Accessor<StatusDaSala>;
  /** Instante (Date.now) da proxima tentativa de reconexao; null sem tentativa marcada. */
  proximaTentativaEm: Accessor<number | null>;
  /** Apelido e time lembrados deste navegador (prefill do formulario). */
  identidadeGuardada: () => RoomIdentity | null;
  /**
   * Volta para a sala com a identidade lembrada, sem formulario. Devolve false
   * quando este navegador nunca entrou (nao ha o que lembrar).
   */
  entrarComIdentidadeGuardada: (hostToken?: string) => boolean;
  /** Reconecta agora, sem esperar a proxima tentativa marcada. */
  tentarAgora: () => void;
  /** Estado do draft, direto do roomState; null fora da fase de draft. */
  draft: Accessor<DraftWire | null>;
  /** Mao privada de quem esta na vez; vazia fora da minha vez. */
  hand: Accessor<HandCard[]>;
  /** Tempo restante do turno atual em ms, da ultima mensagem recebida. */
  turnMsRemaining: Accessor<number | null>;
  /** Assento cujo publicId e o meu; null antes do welcome ou fora do draft. */
  mySeat: Accessor<DraftSeatWire | null>;
  isMyTurn: Accessor<boolean>;
  /** Torneio, direto do roomState; null fora da fase de torneio. */
  tournament: Accessor<TournamentWire | null>;
  /** Timeline da ultima serie recebida via mensagem `games`; null sem nenhuma. */
  games: Accessor<{ slotId: SlotId; games: StoredGame[] } | null>;
  /**
   * Quantas vezes esta pessoa PEDIU uma serie (setWatch). Distingue a timeline
   * que chegou por um clique da que chegou sozinha (onda nova, reconexao) --
   * a RoomScreen usa para nao reabrir o replay da Grande Final em cima do
   * podio de quem so recarregou a pagina (S20).
   */
  pedidosDeSerie: Accessor<number>;
  connect: (nickname: string, teamName: string, hostToken?: string) => void;
  publishBase: (database: unknown, name?: string) => void;
  startDraft: (turnSeconds: number, statsMode?: import("../data/statsPolicy").StatsMode, chaosLevel?: number) => void;
  pick: (cardId: string) => void;
  startTournament: (chaosLevel: number) => void;
  setReady: (ready: boolean) => void;
  setWatch: (slotId: SlotId) => void;
  setSyncMode: (enabled: boolean) => void;
  playbackControl: (action: PlaybackAction) => void;
  vote: (choice: VoteChoice) => void;
  forceAdvance: () => void;
  /** Host tira do lobby quem caiu (S26). */
  removePlayer: (publicId: string) => void;
  transferHost: (publicId: string) => void;
  /** Host volta a sala ao lobby com a mesma turma (D9, Revanche). */
  rematch: () => void;
  /** Troca o proprio apelido/time no lobby, pelo socket aberto (sem cair). */
  rename: (nickname: string, teamName: string) => void;
  /** Some com a faixa de erro (a pessoa leu e fechou). */
  limparErro: () => void;
}

export interface RoomStoreDeps {
  /** URL do WebSocket. Por padrao, derivada da pagina aberta. */
  socketUrl?: () => string;
  /** Como abrir o socket. Por padrao, um WebSocket de verdade. */
  socketFactory?: RoomSocketFactory;
  /** Agenda a proxima tentativa de reconexao. Por padrao, setTimeout. */
  agendar?: (ms: number, fn: () => void) => () => void;
  /** Relogio para `proximaTentativaEm`. Por padrao, Date.now. */
  agora?: () => number;
  /** Onde lembrar clientId e identidade. Por padrao, o localStorage. */
  storage?: () => MinimalStorage;
}

const agendarPadrao = (ms: number, fn: () => void): (() => void) => {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
};

export function createRoomStore(deps: RoomStoreDeps = {}): RoomStore {
  const [state, setState] = createSignal<RoomWire | null>(null);
  const [clientId, setClientId] = createSignal<string | null>(null);
  const [publicId, setPublicId] = createSignal<string | null>(null);
  const [isHost, setIsHost] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [baseMessage, setBaseMessage] = createSignal<string | null>(null);
  const [connected, setConnected] = createSignal(false);
  const [status, setStatus] = createSignal<StatusDaSala>("fora");
  const [proximaTentativaEm, setProximaTentativaEm] = createSignal<number | null>(null);
  const [hand, setHand] = createSignal<HandCard[]>([]);
  const [turnMsRemaining, setTurnMsRemaining] = createSignal<number | null>(null);
  const [games, setGames] = createSignal<{ slotId: SlotId; games: StoredGame[] } | null>(null);
  const [pedidosDeSerie, setPedidosDeSerie] = createSignal(0);

  const draft = (): DraftWire | null => state()?.draft ?? null;

  // Derivado, nao um sinal proprio: um segundo sinal guardando a mesma
  // verdade do roomState e a receita de tela mostrando a onda 2 com o
  // placar da onda 1.
  const tournament = (): TournamentWire | null => state()?.tournament ?? null;

  /** Serie que EU estou acompanhando, segundo o roomState atual; null sem torneio ou sem mim no mapa. */
  const minhaSerieAssistida = (): SlotId | null => {
    const meu = publicId();
    if (meu === null) return null;
    return tournament()?.watching[meu] ?? null;
  };

  const mySeat = (): DraftSeatWire | null => {
    const meu = publicId();
    if (meu === null) return null;
    return draft()?.seats.find((s) => s.publicId === meu) ?? null;
  };

  const isMyTurn = (): boolean => {
    const d = draft();
    const meu = mySeat();
    return d !== null && meu !== null && d.currentSeat === meu.index;
  };

  const socketUrl = deps.socketUrl ?? (() => roomSocketUrl(window.location));
  const agendar = deps.agendar ?? agendarPadrao;
  const agora = deps.agora ?? (() => Date.now());
  const storage = deps.storage ?? (() => safeStorage());

  let client: RoomClient | null = null;

  /** O que o ultimo connect() pediu -- a reconexao repete exatamente isso. */
  let entrada: { nickname: string; teamName: string; hostToken?: string } | null = null;
  /** Ja recebeu welcome com esta entrada: queda vira reconexao, nao formulario. */
  let jaEntrou = false;
  let tentativas = 0;
  let cancelarTentativa: (() => void) | null = null;

  function desmarcarTentativa(): void {
    cancelarTentativa?.();
    cancelarTentativa = null;
    setProximaTentativaEm(null);
  }

  function marcarTentativa(): void {
    desmarcarTentativa();
    const espera = esperaDaTentativa(tentativas);
    tentativas++;
    setProximaTentativaEm(agora() + espera);
    cancelarTentativa = agendar(espera, () => {
      cancelarTentativa = null;
      setProximaTentativaEm(null);
      abrir();
    });
  }

  function connect(nickname: string, teamName: string, hostToken?: string): void {
    entrada = { nickname, teamName, hostToken };
    jaEntrou = false;
    tentativas = 0;
    desmarcarTentativa();
    abrir();
  }

  function abrir(): void {
    if (entrada === null) return;
    const { nickname, teamName, hostToken } = entrada;
    setError(null);
    setStatus(jaEntrou ? "reconectando" : "entrando");
    setHand([]);
    setTurnMsRemaining(null);
    // A timeline guardada pode ser de uma serie que o servidor nem esta mais
    // mandando — mesmo raciocinio da mao e do tempo de turno, uma linha acima.
    // Na RECONEXAO automatica ela fica: o roomState que chega limpa se a
    // serie mudou, e apagar aqui jogava quem assistia de volta ao Jogo 1 a
    // cada piscada do wi-fi (revisao final, achado 10).
    if (!jaEntrou) setGames(null);

    // Uma tentativa recusada (nome de time repetido, por exemplo) deixava o
    // socket antigo aberto: ele continuava recebendo broadcasts, respondendo
    // pong sozinho — o heartbeat nunca o enterrava — e escrevendo nos mesmos
    // sinais desta tela.
    // `client = null` ANTES de fechar: o close dispara o onClose na hora, e
    // o socket velho nao pode ser confundido com a conexao atual (marcaria
    // uma reconexao que ninguem pediu).
    const velho = client;
    client = null;
    velho?.close();

    const novo = new RoomClient(
      socketUrl(),
      {
        onMessage: (msg) => {
          switch (msg.type) {
            case "welcome":
              setClientId(msg.clientId);
              setPublicId(msg.publicId);
              setIsHost(msg.isHost);
              rememberClientId(storage(), msg.clientId);
              rememberIdentity(storage(), { nickname, teamName });
              jaEntrou = true;
              tentativas = 0;
              setStatus("na-sala");
              break;
            case "roomState": {
              setState(msg.state);
              setTurnMsRemaining(msg.state.draft?.turnMsRemaining ?? null);
              // A mao e privada e vale so enquanto a vez e minha; deixar
              // cartas velhas na tela deixaria um botao de escolher clicavel
              // fora de hora.
              if (!isMyTurn()) setHand([]);
              // A serie que eu acompanho mudou (ou o torneio sumiu do
              // estado): a timeline guardada e de outra serie. Sem limpar
              // aqui, a tela pisca a serie anterior por um quadro antes da
              // nova `games` chegar.
              const jogosAtuais = games();
              if (jogosAtuais !== null && jogosAtuais.slotId !== minhaSerieAssistida()) {
                setGames(null);
              }
              // O servidor e quem sabe meu nome de verdade (a Revanche da um
              // time a quem so assistia; um rename muda os dois). A proxima
              // reconexao e a proxima visita usam o que ele diz (achado 2).
              const eu = msg.state.players.find((p) => p.publicId === publicId());
              setIsHost(eu?.isHost ?? false);
              if (eu !== undefined && entrada !== null && (eu.nickname !== entrada.nickname || eu.teamName !== entrada.teamName)) {
                entrada = { ...entrada, nickname: eu.nickname, teamName: eu.teamName };
                rememberIdentity(storage(), { nickname: eu.nickname, teamName: eu.teamName });
              }
              break;
            }
            case "hand":
              setHand(msg.cards);
              setTurnMsRemaining(msg.turnMsRemaining);
              break;
            case "games":
              setGames({ slotId: msg.slotId, games: msg.games });
              break;
            case "error":
              setError(msg.message);
              // Erro antes do welcome e recusa de entrada; depois dele, e so
              // uma acao que nao deu certo -- a pessoa continua na sala.
              if (status() === "entrando" || status() === "reconectando") {
                jaEntrou = false;
                setStatus("recusado");
              }
              break;
            case "protocolMismatch":
              setError(msg.message);
              jaEntrou = false;
              desmarcarTentativa();
              setStatus("versao-diferente");
              break;
            case "basePublished":
              setError(null);
              setBaseMessage(
                `Base publicada: ${msg.playerCount} jogador${msg.playerCount === 1 ? "" : "es"}. Todo mundo na sala já está usando ela.`
              );
              break;
            default:
              break;
          }
        },
        onUnparseable: () => {
          setError(
            "O servidor mandou uma mensagem que esta versão do jogo não entende. Recarregue a página."
          );
        },
        onClose: () => {
          // So a conexao atual pode apagar a luz; um socket velho fechando nao.
          if (client !== novo) return;
          setConnected(false);
          if (status() === "versao-diferente" || status() === "recusado") return;
          if (jaEntrou) {
            // Estava na sala: tenta voltar sozinho, com espera crescente
            // (S10 -- antes a tela mandava recarregar a pagina).
            setStatus("reconectando");
            marcarTentativa();
            return;
          }
          setStatus("fora");
          setError("Não consegui falar com a sala. Confira se o link está certo e tente de novo.");
        },
      },
      deps.socketFactory
    );

    client = novo;

    setConnected(true);
    client.send({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      clientId: storedClientId(storage()) ?? undefined,
      nickname,
      teamName,
      hostToken,
    });
  }

  function tentarAgora(): void {
    if (status() !== "reconectando") return;
    desmarcarTentativa();
    abrir();
  }

  function identidadeGuardada(): RoomIdentity | null {
    return storedIdentity(storage());
  }

  function entrarComIdentidadeGuardada(hostToken?: string): boolean {
    const id = storedIdentity(storage());
    if (id === null || storedClientId(storage()) === null) return false;
    connect(id.nickname, id.teamName, hostToken);
    return true;
  }

  function publishBase(database: unknown, name?: string): void {
    setError(null);
    setBaseMessage(null);
    const enviou = client?.send({ type: "publishBase", database, name }) ?? false;
    if (!enviou) setError("Não consegui publicar a base porque a conexão caiu.");
  }

  function startDraft(turnSeconds: number, statsMode?: import("../data/statsPolicy").StatsMode, chaosLevel?: number): void {
    setError(null);
    const enviou = client?.send({ type: "startDraft", turnSeconds, statsMode, chaosLevel }) ?? false;
    if (!enviou) setError("Não consegui começar o draft porque a conexão caiu.");
  }

  function pick(cardId: string): void {
    setError(null);
    // Some na hora so quando o envio deu certo: sem isso o botao continua
    // clicavel ate o roomState chegar e um clique duplo vira um pick recusado
    // com erro na cara de quem jogou. Quem devolve a mao e o servidor, no
    // proximo `hand` — uma recusa nao a reconstroi aqui, isso deixaria a tela
    // discordando do servidor.
    const enviou = client?.send({ type: "pick", cardId }) ?? false;
    if (enviou) {
      setHand([]);
    } else {
      // A conexao caiu entre o aviso aparecer e o clique: nao apagar a mao
      // aqui deixaria a pessoa achando que jogou quando nada chegou ao
      // servidor.
      setError("A escolha não foi enviada porque a conexão caiu.");
    }
  }

  function startTournament(chaosLevel: number): void {
    setError(null);
    const enviou = client?.send({ type: "startTournament", chaosLevel }) ?? false;
    if (!enviou) setError("Não consegui começar o torneio porque a conexão caiu.");
  }

  function setReady(ready: boolean): void {
    setError(null);
    const enviou = client?.send({ type: "ready", ready }) ?? false;
    if (!enviou) setError("Não consegui marcar pronto porque a conexão caiu.");
  }

  function setWatch(slotId: SlotId): void {
    setError(null);
    setPedidosDeSerie((n) => n + 1);
    const enviou = client?.send({ type: "setWatch", slotId }) ?? false;
    if (!enviou) setError("Não consegui trocar de série porque a conexão caiu.");
  }

  function setSyncMode(enabled: boolean): void {
    setError(null);
    const enviou = client?.send({ type: "setSyncMode", enabled }) ?? false;
    if (!enviou) setError("Não consegui mudar o modo sincronizado porque a conexão caiu.");
  }

  function playbackControl(action: PlaybackAction): void {
    setError(null);
    const enviou = client?.send({ type: "playbackControl", action }) ?? false;
    if (!enviou) setError("Não consegui enviar o comando de reprodução porque a conexão caiu.");
  }

  function vote(choice: VoteChoice): void {
    setError(null);
    const enviou = client?.send({ type: "vote", choice }) ?? false;
    if (!enviou) setError("Não consegui registrar o voto porque a conexão caiu.");
  }

  function forceAdvance(): void {
    setError(null);
    const enviou = client?.send({ type: "forceAdvance" }) ?? false;
    if (!enviou) setError("Não consegui forçar o avanço porque a conexão caiu.");
  }

  function removePlayer(publicId: string): void {
    setError(null);
    const enviou = client?.send({ type: "removePlayer", publicId }) ?? false;
    if (!enviou) setError("Não consegui remover essa pessoa porque a conexão caiu.");
  }

  function transferHost(publicId: string): void {
    setError(null);
    const enviou = client?.send({ type: "transferHost", publicId }) ?? false;
    if (!enviou) setError("Não consegui transferir o controle porque a conexão caiu.");
  }

  function rename(nickname: string, teamName: string): void {
    setError(null);
    const enviou = client?.send({ type: "rename", nickname, teamName }) ?? false;
    if (!enviou) setError("Não consegui trocar o nome porque a conexão caiu.");
  }

  function rematch(): void {
    setError(null);
    const enviou = client?.send({ type: "rematch" }) ?? false;
    if (!enviou) setError("Não consegui começar a revanche porque a conexão caiu.");
  }

  return {
    state,
    clientId,
    publicId,
    isHost,
    error,
    baseMessage,
    connected,
    status,
    proximaTentativaEm,
    identidadeGuardada,
    entrarComIdentidadeGuardada,
    tentarAgora,
    draft,
    hand,
    turnMsRemaining,
    mySeat,
    isMyTurn,
    tournament,
    games,
    pedidosDeSerie,
    connect,
    publishBase,
    startDraft,
    pick,
    startTournament,
    setReady,
    setWatch,
    setSyncMode,
    playbackControl,
    vote,
    forceAdvance,
    removePlayer,
    transferHost,
    rematch,
    rename,
    limparErro: () => setError(null),
  };
}
