import { describe, it, expect } from "vitest";
import type { z } from "zod";
import { createRoomStore } from "./store";
import {
  PROTOCOL_VERSION,
  SEATS,
  TOTAL_WAVES,
  StoredGameSchema,
  type ClientMessage,
  type RoomWire,
  type ServerMessage,
  type TournamentWire,
} from "../../server/protocol";
import { makeCard } from "../../server/room/cards.fixture";
import type { RoomSocket } from "./client";

type StoredGame = z.infer<typeof StoredGameSchema>;

/** Mesmo WebSocket de mentira do client.test.ts: o teste dirige os eventos. */
class SocketFalso {
  readyState = 0; // CONNECTING
  readonly enviadas: string[] = [];
  fechado = false;
  #ouvintes = new Map<string, ((ev: never) => void)[]>();

  addEventListener(tipo: string, ouvinte: (ev: never) => void): void {
    const lista = this.#ouvintes.get(tipo) ?? [];
    lista.push(ouvinte);
    this.#ouvintes.set(tipo, lista);
  }

  send(data: string): void {
    this.enviadas.push(data);
  }

  close(): void {
    this.fechado = true;
    this.readyState = 3; // CLOSED
    this.#disparar("close", undefined);
  }

  abrir(): void {
    this.readyState = 1; // OPEN
    this.#disparar("open", undefined);
  }

  receber(msg: unknown): void {
    this.#disparar("message", { data: JSON.stringify(msg) });
  }

  #disparar(tipo: string, ev: unknown): void {
    for (const ouvinte of this.#ouvintes.get(tipo) ?? []) (ouvinte as (e: unknown) => void)(ev);
  }
}

function novoStore() {
  const sockets: SocketFalso[] = [];
  const store = createRoomStore({
    socketUrl: () => "ws://teste/ws",
    socketFactory: () => {
      const s = new SocketFalso();
      sockets.push(s);
      return s;
    },
  });
  return { store, sockets };
}

const ESTADO = {
  phase: "lobby" as const,
  players: [
    {
      publicId: "pub1",
      nickname: "rafa",
      teamName: "Macacos",
      isHost: true,
      connected: true,
      spectator: false,
    },
  ],
  settings: { turnSeconds: 60 },
  baseStatus: {
    ready: false,
    needed: 8,
    spareByRole: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0 },
  },
  draft: null,
  tournament: null,
};

describe("createRoomStore — despacho das mensagens do servidor", () => {
  it("guarda clientId e papel de host no welcome", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();

    sockets[0]!.receber({
      type: "welcome",
      clientId: "c1",
      publicId: "pub1",
      isHost: true,
      protocolVersion: PROTOCOL_VERSION,
    });

    expect(store.clientId()).toBe("c1");
    expect(store.isHost()).toBe(true);
  });

  it("guarda o publicId que veio no welcome", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();

    sockets[0]!.receber({
      type: "welcome",
      clientId: "c1",
      publicId: "pub-9",
      isHost: false,
      protocolVersion: PROTOCOL_VERSION,
    });

    expect(store.publicId()).toBe("pub-9");
    expect(store.clientId()).toBe("c1");
  });

  it("espelha o roomState", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();

    sockets[0]!.receber({ type: "roomState", state: ESTADO });

    expect(store.state()?.players).toHaveLength(1);
    expect(store.state()?.players[0]!.teamName).toBe("Macacos");
  });

  it("mostra a mensagem de erro do servidor", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();

    sockets[0]!.receber({
      type: "error",
      code: "team_name_taken",
      message: "Esse nome de time já está em uso. Escolha outro.",
    });

    expect(store.error()).toBe("Esse nome de time já está em uso. Escolha outro.");
  });

  it("transforma basePublished em confirmacao com a contagem", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();

    sockets[0]!.receber({ type: "basePublished", playerCount: 137 });

    expect(store.baseMessage()).toContain("137");
    expect(store.error()).toBeNull();
  });

  it("limpa a confirmacao anterior quando uma nova publicacao comeca", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();
    sockets[0]!.receber({ type: "basePublished", playerCount: 137 });
    expect(store.baseMessage()).not.toBeNull();

    store.publishBase({ players: [] });

    expect(store.baseMessage()).toBeNull();
  });

  it("mensagem que nao bate com nenhum schema nao muda o estado e avisa quem esta jogando", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();
    sockets[0]!.receber({ type: "roomState", state: ESTADO });
    expect(store.state()?.players).toHaveLength(1);
    expect(store.error()).toBeNull();

    // Nem JSON valido nem um `type` que a versao 3 do protocolo conhece —
    // o mesmo caminho de uma mensagem truncada ou de um servidor mais novo.
    sockets[0]!.receber({ type: "explodir", campo: 1 });

    // O estado anterior nao mexeu: a mensagem quebrada foi descartada, nao
    // aplicada em cima do que ja estava na tela.
    expect(store.state()?.players).toHaveLength(1);
    expect(store.error()).toBe(
      "O servidor mandou uma mensagem que esta versão do jogo não entende. Recarregue a página."
    );
  });

  it("marca desconectado quando o socket fecha", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();
    expect(store.connected()).toBe(true);

    sockets[0]!.close();

    expect(store.connected()).toBe(false);
  });
});

describe("createRoomStore — nova tentativa de entrada", () => {
  it("fecha o socket anterior antes de abrir outro", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();
    sockets[0]!.receber({
      type: "error",
      code: "team_name_taken",
      message: "Esse nome de time já está em uso. Escolha outro.",
    });

    store.connect("rafa", "Gorilas");

    expect(sockets).toHaveLength(2);
    expect(sockets[0]!.fechado).toBe(true);
    expect(sockets[1]!.fechado).toBe(false);
    // O socket velho nao apaga a luz da conexao nova.
    expect(store.connected()).toBe(true);
  });

  it("o socket velho nao escreve mais na tela depois da nova tentativa", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();

    store.connect("rafa", "Gorilas");
    sockets[1]!.abrir();
    sockets[1]!.receber({ type: "roomState", state: ESTADO });

    // Nada do socket velho pode chegar aqui — ele foi fechado.
    expect(sockets[0]!.readyState).toBe(3);
    expect(store.state()?.players[0]!.teamName).toBe("Macacos");
  });
});

// ---------------------------------------------------------------------------
// Sinais do draft
// ---------------------------------------------------------------------------

const BASE_PRONTA = {
  ready: true,
  needed: SEATS,
  spareByRole: { top: 8, jungle: 8, mid: 8, adc: 8, support: 8 },
};

function cartaExemplo() {
  return makeCard({ id: "top-0", personId: "p-top-0", primaryRole: "top" });
}

function assento(index: number, publicId: string | null) {
  return {
    index,
    teamName: `Time ${index}`,
    isBot: publicId === null,
    connected: true,
    publicId,
    picks: {},
  };
}

/** roomState em fase de draft com a vez do assento de `publicIdDaVez`. */
function estadoComVezDe(publicIdDaVez: string, turnMsRemaining: number | null = 60_000): RoomWire {
  return {
    phase: "draft",
    players: [],
    settings: { turnSeconds: 60 },
    baseStatus: BASE_PRONTA,
    draft: {
      round: 1,
      turnIndex: 0,
      totalTurns: 40,
      currentSeat: 0,
      turnMsRemaining,
      remainingCards: 40,
      finished: false,
      order: [0, 1],
      timedOutSeat: null,
      seats: [assento(0, publicIdDaVez), assento(1, "outro-pub-qualquer")],
    },
    tournament: null,
  };
}

const estadoComTempo = (ms: number) => estadoComVezDe("meu-pub", ms);

/** Conecta o store a um socket falso e devolve como injetar mensagens nele. */
function conectado(publicId = "meu-pub") {
  const enviadas: ClientMessage[] = [];
  let onMessage: ((ev: { data: string }) => void) | null = null;

  const socket = {
    readyState: 1, // OPEN
    send: (data: string) => enviadas.push(JSON.parse(data) as ClientMessage),
    close: () => {},
    addEventListener: (type: string, listener: unknown) => {
      if (type === "message") onMessage = listener as (ev: { data: string }) => void;
    },
  } as unknown as RoomSocket & { readyState: number };

  const store = createRoomStore({
    socketUrl: () => "ws://teste/ws",
    socketFactory: () => socket,
  });

  const receber = (msg: ServerMessage) => onMessage?.({ data: JSON.stringify(msg) });

  store.connect("rafa", "Time");
  receber({
    type: "welcome",
    clientId: "c1",
    publicId,
    isHost: false,
    protocolVersion: PROTOCOL_VERSION,
  });
  enviadas.length = 0; // o hello ja cumpriu o papel; o resto do teste olha o que vem depois

  return { store, socket, enviadas, receber };
}

describe("store — draft", () => {
  it("guarda a mao que chega e limpa quando a vez passa", () => {
    const { store, receber } = conectado();
    receber({ type: "hand", cards: [{ role: "top", card: cartaExemplo() }], turnMsRemaining: 60_000 });
    expect(store.hand()).toHaveLength(1);

    receber({ type: "roomState", state: estadoComVezDe("outro-pub") });
    expect(store.hand()).toHaveLength(0);
  });

  it("isMyTurn segue o publicId do welcome", () => {
    const { store, receber } = conectado("meu-pub");
    receber({ type: "roomState", state: estadoComVezDe("meu-pub") });
    expect(store.isMyTurn()).toBe(true);
    receber({ type: "roomState", state: estadoComVezDe("outro-pub") });
    expect(store.isMyTurn()).toBe(false);
  });

  it("mySeat acha o assento pelo publicId", () => {
    const { store, receber } = conectado("meu-pub");
    receber({ type: "roomState", state: estadoComVezDe("meu-pub") });
    expect(store.mySeat()?.publicId).toBe("meu-pub");
  });

  it("pick manda a mensagem e limpa a mao na hora", () => {
    const { store, enviadas, receber } = conectado();
    receber({ type: "hand", cards: [{ role: "top", card: cartaExemplo() }], turnMsRemaining: 60_000 });
    store.pick("top-0");
    expect(enviadas).toContainEqual({ type: "pick", cardId: "top-0" });
    // some na hora para o botao nao continuar clicavel esperando o servidor
    expect(store.hand()).toHaveLength(0);
  });

  it("startDraft manda o turnSeconds escolhido", () => {
    const { store, enviadas } = conectado();
    store.startDraft(45);
    expect(enviadas).toContainEqual({ type: "startDraft", turnSeconds: 45 });
  });

  // F1: com o socket fechado, o clique em "Escolher" nao pode mentir que
  // funcionou. Sem isso a mao some, o servidor nunca recebe nada e a pessoa
  // fica travada em "Esperando..." achando que jogou.
  it("com o socket fechado, pick() NAO limpa a mao e deixa um erro dizendo que foi a conexao", () => {
    const { store, socket, enviadas, receber } = conectado();
    receber({ type: "hand", cards: [{ role: "top", card: cartaExemplo() }], turnMsRemaining: 60_000 });
    expect(store.hand()).toHaveLength(1);

    socket.readyState = 3; // CLOSED — nem CONNECTING nem OPEN

    store.pick("top-0");

    // Nada foi para o fio: o pick nunca chegou perto do servidor.
    expect(enviadas).toEqual([]);
    // A mao continua ali — o clique nao pode fingir que funcionou.
    expect(store.hand()).toHaveLength(1);
    expect(store.error()).toContain("conexão");
  });

  it("com o socket fechado, startDraft() e publishBase() tambem avisam da conexao em vez de ficar calados", () => {
    const { store, socket, enviadas } = conectado();
    socket.readyState = 3; // CLOSED

    store.startDraft(45);
    expect(enviadas).toEqual([]);
    expect(store.error()).toContain("conexão");

    store.publishBase({ players: [] });
    expect(enviadas).toEqual([]);
    expect(store.error()).toContain("conexão");
  });

  it("um pick recusado mostra o erro e a mao NAO volta sozinha", () => {
    const { store, receber } = conectado();
    receber({ type: "hand", cards: [{ role: "top", card: cartaExemplo() }], turnMsRemaining: 60_000 });
    store.pick("top-0");
    receber({ type: "error", code: "card_not_in_hand", message: "nao esta na sua mao" });
    // Quem devolve a mao e o servidor, no proximo `hand`. Reconstruir a mao
    // aqui no cliente deixaria a tela discordando do servidor.
    expect(store.hand()).toHaveLength(0);
    expect(store.error()).toContain("mao");
  });

  it("uma mao nova depois do erro volta a habilitar a escolha", () => {
    const { store, receber } = conectado();
    receber({ type: "hand", cards: [{ role: "top", card: cartaExemplo() }], turnMsRemaining: 60_000 });
    store.pick("top-0");
    receber({ type: "error", code: "card_not_in_hand", message: "nao esta na sua mao" });
    receber({ type: "hand", cards: [{ role: "mid", card: cartaExemplo() }], turnMsRemaining: 40_000 });
    expect(store.hand()).toHaveLength(1);
    expect(store.turnMsRemaining()).toBe(40_000);
  });

  it("turnMsRemaining vem da mao e do roomState", () => {
    const { store, receber } = conectado();
    receber({ type: "hand", cards: [], turnMsRemaining: 30_000 });
    expect(store.turnMsRemaining()).toBe(30_000);
    receber({ type: "roomState", state: estadoComTempo(12_000) });
    expect(store.turnMsRemaining()).toBe(12_000);
  });

  it("reconectar limpa a mao e o tempo restante antes de qualquer mensagem nova", () => {
    const { store, receber } = conectado();
    receber({ type: "hand", cards: [{ role: "top", card: cartaExemplo() }], turnMsRemaining: 60_000 });
    expect(store.hand()).toHaveLength(1);
    expect(store.turnMsRemaining()).toBe(60_000);

    // A conexao caiu e o jogador reenviou o formulario do lobby. Sem limpar
    // aqui, a mao velha ficaria clicavel na tela ate chegar um estado novo.
    store.connect("rafa", "Time");

    expect(store.hand()).toHaveLength(0);
    expect(store.turnMsRemaining()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sinais do torneio
// ---------------------------------------------------------------------------

/** RoomWire de torneio, com overrides pontuais. */
function roomStateCom(overrides: Partial<RoomWire> = {}): RoomWire {
  return {
    phase: "tournament",
    players: [],
    settings: { turnSeconds: 60 },
    baseStatus: BASE_PRONTA,
    draft: null,
    tournament: null,
    ...overrides,
  };
}

/** TournamentWire minimo e valido, com overrides pontuais. */
function fioDeTorneio(overrides: Partial<TournamentWire> = {}): TournamentWire {
  return {
    wave: 1,
    totalWaves: TOTAL_WAVES,
    series: [],
    teams: [],
    ready: [],
    readyFaltam: 0,
    readyTotal: 0,
    espectadoresContam: false,
    watching: {},
    sync: null,
    vote: null,
    championId: null,
    id: "torneio-teste",
    barreira: [],
    pulado: false,
    awards: null,
    ...overrides,
  };
}

/** Um StoredGame minimo e valido — o suficiente para passar no schema. */
function jogoFalso(): StoredGame {
  return {
    seed: 1,
    winnerId: "assento-0",
    events: [],
    totalPlaybackMs: 0,
    champions: { teamA: {}, teamB: {} },
  };
}

describe("store — torneio", () => {
  it("espelha o torneio que chega no roomState", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();

    sockets[0]!.receber({
      type: "roomState",
      state: roomStateCom({ tournament: fioDeTorneio({ wave: 2 }) }),
    });

    expect(store.tournament()?.wave).toBe(2);
  });

  it("tournament() acompanha o roomState mais recente, nao trava na primeira mensagem", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();

    sockets[0]!.receber({
      type: "roomState",
      state: roomStateCom({ tournament: fioDeTorneio({ wave: 1 }) }),
    });
    expect(store.tournament()?.wave).toBe(1);

    sockets[0]!.receber({
      type: "roomState",
      state: roomStateCom({ tournament: fioDeTorneio({ wave: 2 }) }),
    });
    // Se tournament() fosse sinal proprio preso na primeira mensagem, a onda
    // continuaria 1 aqui — exatamente a tela mostrando a onda 2 com o placar
    // da onda 1.
    expect(store.tournament()?.wave).toBe(2);
  });

  it("sem torneio no estado, tournament() e null", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();

    sockets[0]!.receber({ type: "roomState", state: roomStateCom({ tournament: null }) });

    expect(store.tournament()).toBeNull();
  });

  it("guarda a timeline que chega na mensagem games", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();

    sockets[0]!.receber({ type: "games", slotId: "UB_QF_1", games: [jogoFalso()] });

    expect(store.games()?.slotId).toBe("UB_QF_1");
    expect(store.games()?.games).toHaveLength(1);
  });

  it("games substitui a timeline anterior, nao acumula", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();

    sockets[0]!.receber({ type: "games", slotId: "UB_QF_1", games: [jogoFalso()] });
    sockets[0]!.receber({
      type: "games",
      slotId: "UB_QF_2",
      games: [jogoFalso(), jogoFalso()],
    });

    // So a ultima serie recebida fica guardada — cachear as duas seria o
    // comeco dos 17 MB que a decisao evita.
    expect(store.games()?.slotId).toBe("UB_QF_2");
    expect(store.games()?.games).toHaveLength(2);
  });

  it("reconectar joga fora a timeline guardada", () => {
    const { store, sockets } = novoStore();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();
    sockets[0]!.receber({ type: "games", slotId: "UB_QF_1", games: [jogoFalso()] });
    expect(store.games()).not.toBeNull();

    // Mesmo raciocinio da mao e do tempo de turno: a timeline guardada pode
    // ser de uma serie que o servidor nem esta mais mandando depois da
    // reconexao.
    store.connect("rafa", "Macacos");

    expect(store.games()).toBeNull();
  });

  it("mudar de serie limpa a timeline antiga antes da nova chegar", () => {
    const { store, receber } = conectado("pub-eu");
    receber({ type: "games", slotId: "UB_QF_1", games: [jogoFalso()] });
    expect(store.games()).not.toBeNull();

    receber({
      type: "roomState",
      state: roomStateCom({ tournament: fioDeTorneio({ watching: { "pub-eu": "UB_QF_2" } }) }),
    });

    expect(store.games()).toBeNull();
  });

  it("continuar acompanhando a mesma serie nao apaga a timeline guardada", () => {
    const { store, receber } = conectado("pub-eu");
    receber({ type: "games", slotId: "UB_QF_1", games: [jogoFalso()] });

    receber({
      type: "roomState",
      state: roomStateCom({ tournament: fioDeTorneio({ wave: 2, watching: { "pub-eu": "UB_QF_1" } }) }),
    });

    expect(store.games()).not.toBeNull();
  });

  it("cada acao manda exatamente uma mensagem com a forma certa", () => {
    const { store, enviadas } = conectado();
    store.setReady(true);
    store.setWatch("UB_QF_1");
    store.vote("continuar");
    store.forceAdvance();
    expect(enviadas).toEqual([
      { type: "ready", ready: true },
      { type: "setWatch", slotId: "UB_QF_1" },
      { type: "vote", choice: "continuar" },
      { type: "forceAdvance" },
    ]);
  });

  it("startTournament manda o chaosLevel escolhido", () => {
    const { store, enviadas } = conectado();
    store.startTournament(0.5);
    expect(enviadas).toEqual([{ type: "startTournament", chaosLevel: 0.5 }]);
  });

  it("setSyncMode manda o modo escolhido", () => {
    const { store, enviadas } = conectado();
    store.setSyncMode(true);
    expect(enviadas).toEqual([{ type: "setSyncMode", enabled: true }]);
  });

  it("playbackControl manda a acao escolhida", () => {
    const { store, enviadas } = conectado();
    store.playbackControl("proximoJogo");
    expect(enviadas).toEqual([{ type: "playbackControl", action: "proximoJogo" }]);
  });

  it("com o socket fechado, as acoes do torneio avisam da conexao em vez de ficar caladas", () => {
    const { store, socket, enviadas } = conectado();
    socket.readyState = 3; // CLOSED

    store.setReady(true);

    expect(enviadas).toEqual([]);
    expect(store.error()).toContain("conexão");
  });
});

// ---------------------------------------------------------------------------
// Conexao que se recupera sozinha (Rundown da Sala 2, S10)
// ---------------------------------------------------------------------------

function storageFalso() {
  const dados = new Map<string, string>();
  return {
    dados,
    storage: {
      getItem: (k: string) => dados.get(k) ?? null,
      setItem: (k: string, v: string) => void dados.set(k, v),
    },
  };
}

function storeComRelogio() {
  const sockets: SocketFalso[] = [];
  const agendados: { ms: number; fn: () => void; cancelado: boolean }[] = [];
  const { storage, dados } = storageFalso();
  let agora = 1_000;
  const store = createRoomStore({
    socketUrl: () => "ws://teste/ws",
    socketFactory: () => {
      const s = new SocketFalso();
      sockets.push(s);
      return s;
    },
    agendar: (ms, fn) => {
      const item = { ms, fn, cancelado: false };
      agendados.push(item);
      return () => {
        item.cancelado = true;
      };
    },
    agora: () => agora,
    storage: () => storage,
  });
  const disparar = () => {
    const item = agendados.filter((a) => !a.cancelado).pop();
    if (item === undefined) throw new Error("nenhuma tentativa marcada");
    item.cancelado = true;
    item.fn();
  };
  const welcome = (s: SocketFalso) => {
    s.abrir();
    s.receber({ type: "welcome", clientId: "c1", publicId: "pub1", isHost: false, protocolVersion: PROTOCOL_VERSION });
  };
  return { store, sockets, agendados, disparar, welcome, dados, avancar: (ms: number) => (agora += ms) };
}

describe("store — reconexao automatica", () => {
  it("entrando ate o welcome, na-sala depois", () => {
    const { store, sockets, welcome } = storeComRelogio();
    expect(store.status()).toBe("fora");
    store.connect("rafa", "Macacos");
    expect(store.status()).toBe("entrando");
    welcome(sockets[0]!);
    expect(store.status()).toBe("na-sala");
  });

  it("queda depois do welcome marca reconexao com espera crescente, sem formulario", () => {
    const { store, sockets, agendados, disparar, welcome } = storeComRelogio();
    store.connect("rafa", "Macacos");
    welcome(sockets[0]!);

    sockets[0]!.close();
    expect(store.status()).toBe("reconectando");
    expect(agendados.at(-1)!.ms).toBe(1000);
    expect(store.proximaTentativaEm()).toBe(2_000);

    disparar();
    expect(sockets).toHaveLength(2);
    // A tentativa repete o hello com o mesmo clientId lembrado.
    sockets[1]!.abrir();
    const hello = JSON.parse(sockets[1]!.enviadas[0]!) as ClientMessage;
    expect(hello).toMatchObject({ type: "hello", clientId: "c1", nickname: "rafa", teamName: "Macacos" });

    // Caiu de novo sem welcome: a espera dobra.
    sockets[1]!.close();
    expect(agendados.at(-1)!.ms).toBe(2000);
  });

  it("o welcome da reconexao zera a espera", () => {
    const { store, sockets, agendados, disparar, welcome } = storeComRelogio();
    store.connect("rafa", "Macacos");
    welcome(sockets[0]!);
    sockets[0]!.close();
    disparar();
    welcome(sockets[1]!);
    expect(store.status()).toBe("na-sala");
    sockets[1]!.close();
    expect(agendados.at(-1)!.ms).toBe(1000);
  });

  it("tentarAgora nao espera a tentativa marcada", () => {
    const { store, sockets, agendados, welcome } = storeComRelogio();
    store.connect("rafa", "Macacos");
    welcome(sockets[0]!);
    sockets[0]!.close();
    store.tentarAgora();
    expect(sockets).toHaveLength(2);
    expect(agendados.every((a) => a.cancelado)).toBe(true);
  });

  it("socket que nunca entrou nao fica tentando: volta ao formulario com um erro", () => {
    const { store, sockets, agendados } = storeComRelogio();
    store.connect("rafa", "Macacos");
    sockets[0]!.close();
    expect(store.status()).toBe("fora");
    expect(store.error()).not.toBeNull();
    expect(agendados).toHaveLength(0);
  });

  it("recusa do servidor na entrada vira 'recusado' e nao reconecta", () => {
    const { store, sockets, agendados } = storeComRelogio();
    store.connect("rafa", "Macacos");
    sockets[0]!.abrir();
    sockets[0]!.receber({ type: "error", code: "team_name_taken", message: "Esse nome de time já está em uso." });
    expect(store.status()).toBe("recusado");
    sockets[0]!.close();
    expect(agendados).toHaveLength(0);
  });

  it("erro depois do welcome nao tira ninguem da sala", () => {
    const { store, sockets, welcome } = storeComRelogio();
    store.connect("rafa", "Macacos");
    welcome(sockets[0]!);
    sockets[0]!.receber({ type: "error", code: "not_host", message: "Só quem hospeda." });
    expect(store.status()).toBe("na-sala");
  });

  it("versao diferente para de tentar", () => {
    const { store, sockets, agendados, welcome } = storeComRelogio();
    store.connect("rafa", "Macacos");
    welcome(sockets[0]!);
    sockets[0]!.receber({ type: "protocolMismatch", serverVersion: 99, message: "Recarregue a página." });
    sockets[0]!.close();
    expect(store.status()).toBe("versao-diferente");
    expect(agendados.filter((a) => !a.cancelado)).toHaveLength(0);
  });

  it("trocar de nome (connect de novo) nao dispara reconexao pelo socket velho", () => {
    const { store, sockets, agendados, welcome } = storeComRelogio();
    store.connect("rafa", "Macacos");
    welcome(sockets[0]!);
    store.connect("rafa", "Gorilas");
    expect(sockets[0]!.fechado).toBe(true);
    expect(agendados).toHaveLength(0);
    expect(store.status()).toBe("entrando");
  });
});

describe("store — identidade lembrada", () => {
  it("o welcome guarda apelido e time; a proxima visita entra sem formulario", () => {
    const primeira = storeComRelogio();
    primeira.store.connect("rafa", "Macacos");
    primeira.welcome(primeira.sockets[0]!);

    expect(primeira.store.identidadeGuardada()).toEqual({ nickname: "rafa", teamName: "Macacos" });
    expect(primeira.store.entrarComIdentidadeGuardada()).toBe(true);
    expect(primeira.store.status()).toBe("entrando");
  });

  it("navegador que nunca entrou nao tem o que lembrar", () => {
    const { store, sockets } = storeComRelogio();
    expect(store.entrarComIdentidadeGuardada()).toBe(false);
    expect(sockets).toHaveLength(0);
  });
});

describe("store — revisao final do Rundown da Sala 2", () => {
  it("a reconexao automatica nao apaga a timeline de quem assiste (achado 10)", () => {
    const { store, sockets, disparar, welcome } = storeComRelogio();
    store.connect("rafa", "Macacos");
    welcome(sockets[0]!);
    sockets[0]!.receber({ type: "games", slotId: "UB_QF_1", games: [] });
    expect(store.games()).not.toBeNull();
    sockets[0]!.close();
    disparar();
    expect(store.games()).not.toBeNull();
  });

  it("o nome que o servidor diz vira a identidade lembrada (achado 2)", () => {
    const { store, sockets, welcome, dados } = storeComRelogio();
    store.connect("bia", "");
    welcome(sockets[0]!);
    sockets[0]!.receber({
      type: "roomState",
      state: { ...ESTADO, players: [{ ...ESTADO.players[0]!, nickname: "bia", teamName: "Time de bia" }] },
    });
    expect(store.identidadeGuardada()).toEqual({ nickname: "bia", teamName: "Time de bia" });
    expect(dados.size).toBeGreaterThan(0);
  });

  it("rename vai pelo socket aberto, sem abrir outro", () => {
    const { store, sockets, welcome } = storeComRelogio();
    store.connect("rafa", "Macacos");
    welcome(sockets[0]!);
    store.rename("Rafa", "Gorilas");
    expect(sockets).toHaveLength(1);
    expect(JSON.parse(sockets[0]!.enviadas.at(-1)!)).toEqual({ type: "rename", nickname: "Rafa", teamName: "Gorilas" });
  });
});

it("atualiza o papel de host pelo estado sem precisar reconectar", () => {
  const { store, sockets } = novoStore();
  store.connect("rafa", "Macacos");
  const socket = sockets[0]!;
  socket.abrir();
  socket.receber({ type: "welcome", clientId: "c1", publicId: "pub1", isHost: false, protocolVersion: PROTOCOL_VERSION });
  socket.receber({ type: "roomState", state: ESTADO });
  expect(store.isHost()).toBe(true);
  store.transferHost("pub2");
  expect(JSON.parse(socket.enviadas.at(-1)!)).toEqual({ type: "transferHost", publicId: "pub2" });
  socket.receber({ type: "roomState", state: { ...ESTADO, players: ESTADO.players.map(p => ({ ...p, isHost: false })) } });
  expect(store.isHost()).toBe(false);
});
