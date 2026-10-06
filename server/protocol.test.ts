import { describe, it, expect } from "vitest";
import {
  PROTOCOL_VERSION,
  MIN_TURN_SECONDS,
  MAX_TURN_SECONDS,
  DEFAULT_TURN_SECONDS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  TOTAL_WAVES,
  ClientMessageSchema,
  ServerMessageSchema,
  RoomWireSchema,
  ErrorCodeSchema,
  RoomPlayerWireSchema,
  DraftWireSchema,
  DraftSeatWireSchema,
  RosterWireSchema,
  BaseStatusSchema,
  StartDraftSchema,
  PickSchema,
  HandMessageSchema,
  TournamentSeriesWireSchema,
  GamesMessageSchema,
  TournamentWireSchema,
  TournamentTeamWireSchema,
  VoteWireSchema,
  SlotIdSchema,
  type TournamentWire,
} from "./protocol";

describe("PROTOCOL_VERSION", () => {
  it("e 5", () => {
    expect(PROTOCOL_VERSION).toBe(8);
  });
});

describe("ClientMessageSchema", () => {
  it("aceita um hello completo", () => {
    const result = ClientMessageSchema.safeParse({
      type: "hello",
      protocolVersion: 1,
      nickname: "rafa",
      teamName: "Macacos",
      hostToken: "abc",
    });
    expect(result.success).toBe(true);
  });

  it("aceita hello sem hostToken e sem clientId", () => {
    const result = ClientMessageSchema.safeParse({
      type: "hello",
      protocolVersion: 1,
      nickname: "amigo",
      teamName: "Pernetas",
    });
    expect(result.success).toBe(true);
  });

  it("recusa apelido vazio", () => {
    const result = ClientMessageSchema.safeParse({
      type: "hello",
      protocolVersion: 1,
      nickname: "",
      teamName: "Pernetas",
    });
    expect(result.success).toBe(false);
  });

  it("recusa turnSeconds fora do intervalo", () => {
    expect(
      ClientMessageSchema.safeParse({ type: "setSettings", turnSeconds: 5 }).success
    ).toBe(false);
    expect(
      ClientMessageSchema.safeParse({ type: "setSettings", turnSeconds: 60 }).success
    ).toBe(true);
  });

  it("recusa tipo desconhecido", () => {
    const result = ClientMessageSchema.safeParse({ type: "explodir" });
    expect(result.success).toBe(false);
  });

  it("recusa campo extra (strict)", () => {
    const result = ClientMessageSchema.safeParse({ type: "pong", surpresa: 1 });
    expect(result.success).toBe(false);
  });
});

const BASE_STATUS_VAZIA = {
  ready: false,
  needed: 8,
  spareByRole: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0 },
};

describe("RoomWireSchema", () => {
  it("aceita um estado de lobby valido", () => {
    const result = RoomWireSchema.safeParse({
      phase: "lobby",
      players: [
        {
          publicId: "pub-1",
          nickname: "rafa",
          teamName: "Macacos",
          isHost: true,
          connected: true,
          spectator: false,
        },
      ],
      settings: { turnSeconds: 60 },
      baseStatus: BASE_STATUS_VAZIA,
      draft: null,
      tournament: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("ServerMessageSchema", () => {
  it("aceita roomState", () => {
    const result = ServerMessageSchema.safeParse({
      type: "roomState",
      state: {
        phase: "lobby",
        players: [],
        settings: { turnSeconds: 60 },
        baseStatus: BASE_STATUS_VAZIA,
        draft: null,
        tournament: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it("aceita error com codigo", () => {
    const result = ServerMessageSchema.safeParse({
      type: "error",
      code: "room_full",
      message: "A sala esta cheia.",
    });
    expect(result.success).toBe(true);
  });

  it("aceita welcome com clientId, publicId, isHost e protocolVersion", () => {
    const result = ServerMessageSchema.safeParse({
      type: "welcome",
      clientId: "abc123",
      publicId: "pub-abc123",
      isHost: true,
      protocolVersion: 1,
    });
    expect(result.success).toBe(true);
  });

  it("aceita protocolMismatch com serverVersion e message", () => {
    const result = ServerMessageSchema.safeParse({
      type: "protocolMismatch",
      serverVersion: 1,
      message: "Versão do protocolo incompatível.",
    });
    expect(result.success).toBe(true);
  });

  it("aceita basePublished com playerCount", () => {
    const result = ServerMessageSchema.safeParse({
      type: "basePublished",
      playerCount: 5,
    });
    expect(result.success).toBe(true);
  });

  it("aceita ping", () => {
    const result = ServerMessageSchema.safeParse({
      type: "ping",
    });
    expect(result.success).toBe(true);
  });
});

describe("Constantes numericas do protocolo", () => {
  it("MIN_TURN_SECONDS e 10", () => {
    expect(MIN_TURN_SECONDS).toBe(10);
  });

  it("MAX_TURN_SECONDS e 300", () => {
    expect(MAX_TURN_SECONDS).toBe(300);
  });

  it("DEFAULT_TURN_SECONDS e 60", () => {
    expect(DEFAULT_TURN_SECONDS).toBe(60);
  });

  it("MAX_PLAYERS e 8", () => {
    expect(MAX_PLAYERS).toBe(8);
  });

  it("MIN_PLAYERS_TO_START e 2", () => {
    expect(MIN_PLAYERS_TO_START).toBe(2);
  });
});

describe("Limites de turnSeconds", () => {
  it("aceita turnSeconds no limite minimo (10)", () => {
    const result = ClientMessageSchema.safeParse({
      type: "setSettings",
      turnSeconds: 10,
    });
    expect(result.success).toBe(true);
  });

  it("aceita turnSeconds no limite maximo (300)", () => {
    const result = ClientMessageSchema.safeParse({
      type: "setSettings",
      turnSeconds: 300,
    });
    expect(result.success).toBe(true);
  });

  it("recusa turnSeconds abaixo do minimo (9)", () => {
    const result = ClientMessageSchema.safeParse({
      type: "setSettings",
      turnSeconds: 9,
    });
    expect(result.success).toBe(false);
  });

  it("recusa turnSeconds acima do maximo (301)", () => {
    const result = ClientMessageSchema.safeParse({
      type: "setSettings",
      turnSeconds: 301,
    });
    expect(result.success).toBe(false);
  });

  it("recusa turnSeconds nao-inteiro (60.5)", () => {
    const result = ClientMessageSchema.safeParse({
      type: "setSettings",
      turnSeconds: 60.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("ErrorCodeSchema cobertura completa", () => {
  it("aceita todos os 7 codigos de erro validos", () => {
    const validCodes = [
      "room_full",
      "team_name_taken",
      "in_progress",
      "not_host",
      "invalid_base",
      "unknown_client",
      "bad_message",
    ] as const;

    validCodes.forEach((code) => {
      const result = ErrorCodeSchema.safeParse(code);
      expect(result.success).toBe(true);
    });
  });

  it("recusa codigo de erro invalido", () => {
    const result = ErrorCodeSchema.safeParse("nao_existe");
    expect(result.success).toBe(false);
  });
});

describe("publishBase de ClientMessageSchema", () => {
  it("aceita publishBase com database", () => {
    const result = ClientMessageSchema.safeParse({
      type: "publishBase",
      database: { players: [{ name: "Player 1" }] },
    });
    expect(result.success).toBe(true);
  });

  it("recusa publishBase com campo extra (strict)", () => {
    const result = ClientMessageSchema.safeParse({
      type: "publishBase",
      database: { players: [] },
      extraField: "nao permitido",
    });
    expect(result.success).toBe(false);
  });
});

describe("protocolo v2", () => {
  it("o jogador no fio tem publicId e nao carrega clientId (D-20)", () => {
    const ok = RoomPlayerWireSchema.safeParse({
      publicId: "pub-1",
      nickname: "rafa",
      teamName: "Time",
      isHost: true,
      connected: true,
      spectator: false,
    });
    expect(ok.success).toBe(true);

    const comSegredo = RoomPlayerWireSchema.safeParse({
      publicId: "pub-1",
      clientId: "segredo",
      nickname: "rafa",
      teamName: "Time",
      isHost: true,
      connected: true,
      spectator: false,
    });
    expect(comSegredo.success).toBe(false);
  });

  it("o welcome entrega clientId e publicId juntos", () => {
    const ok = ServerMessageSchema.safeParse({
      type: "welcome",
      clientId: "c1",
      publicId: "pub-1",
      isHost: false,
      protocolVersion: 2,
    });
    expect(ok.success).toBe(true);
  });

  it("o fio do draft recusa round fora de 1..5", () => {
    const base = {
      round: 6,
      turnIndex: 0,
      totalTurns: 40,
      currentSeat: 0,
      turnMsRemaining: 1000,
      remainingCards: 40,
      finished: false,
      order: [0, 1],
      timedOutSeat: null,
      seats: [],
    };
    expect(DraftWireSchema.safeParse(base).success).toBe(false);
    expect(DraftWireSchema.safeParse({ ...base, round: 5 }).success).toBe(true);
  });

  it("turnMsRemaining aceita null e recusa negativo (D-16)", () => {
    const base = {
      round: 1,
      turnIndex: 0,
      totalTurns: 40,
      currentSeat: null,
      turnMsRemaining: null,
      remainingCards: 40,
      finished: true,
      order: [],
      timedOutSeat: null,
      seats: [],
    };
    expect(DraftWireSchema.safeParse(base).success).toBe(true);
    expect(DraftWireSchema.safeParse({ ...base, turnMsRemaining: -1 }).success).toBe(false);
  });

  it("startDraft respeita os limites de turno do lobby", () => {
    for (const s of [MIN_TURN_SECONDS, DEFAULT_TURN_SECONDS, MAX_TURN_SECONDS]) {
      expect(ClientMessageSchema.safeParse({ type: "startDraft", turnSeconds: s }).success).toBe(true);
    }
    expect(
      ClientMessageSchema.safeParse({ type: "startDraft", turnSeconds: MIN_TURN_SECONDS - 1 }).success
    ).toBe(false);
  });

  it("pick exige um cardId nao vazio", () => {
    expect(ClientMessageSchema.safeParse({ type: "pick", cardId: "faker-2016" }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ type: "pick", cardId: "" }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "pick" }).success).toBe(false);
  });

  it("as seis variantes novas de mensagem existem no discriminated union", () => {
    const tipos = ["hello", "setSettings", "publishBase", "pong", "startDraft", "pick"];
    for (const type of tipos) {
      const r = ClientMessageSchema.safeParse({ type });
      // pode falhar por campo faltando, mas nunca por tipo desconhecido
      const erro = r.success ? "" : JSON.stringify(r.error.issues);
      expect(erro).not.toContain("Invalid discriminator");
    }
  });

  it("os codigos de erro novos existem", () => {
    for (const code of [
      "not_your_turn",
      "card_not_in_hand",
      "not_enough_players",
      "base_insuficiente",
      "draft_over",
    ]) {
      expect(ErrorCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("baseStatus traz a folga por rota e diz se da para comecar (A-02)", () => {
    const ok = BaseStatusSchema.safeParse({
      ready: false,
      needed: 8,
      spareByRole: { top: 4, jungle: 4, mid: 4, adc: 4, support: 4 },
    });
    expect(ok.success).toBe(true);
    expect(
      BaseStatusSchema.safeParse({ ready: true, needed: 8, spareByRole: { top: 8 } }).success
    ).toBe(false);
  });

  it("startDraft recusa campo extra (strict)", () => {
    const ok = StartDraftSchema.safeParse({ type: "startDraft", turnSeconds: DEFAULT_TURN_SECONDS });
    expect(ok.success).toBe(true);
    expect(
      StartDraftSchema.safeParse({
        type: "startDraft",
        turnSeconds: DEFAULT_TURN_SECONDS,
        surpresa: 1,
      }).success
    ).toBe(false);
  });

  it("pick recusa campo extra (strict)", () => {
    const ok = PickSchema.safeParse({ type: "pick", cardId: "faker-2016" });
    expect(ok.success).toBe(true);
    expect(
      PickSchema.safeParse({ type: "pick", cardId: "faker-2016", surpresa: 1 }).success
    ).toBe(false);
  });

  it("o roster do fio recusa rota desconhecida (strict)", () => {
    expect(RosterWireSchema.safeParse({}).success).toBe(true);
    expect(RosterWireSchema.safeParse({ topo: {} }).success).toBe(false);
  });

  const ASSENTO_VALIDO = {
    index: 0,
    teamName: "Time",
    isBot: false,
    connected: true,
    publicId: "pub-1",
    picks: {},
  };

  it("o assento do fio recusa campo extra (strict)", () => {
    expect(DraftSeatWireSchema.safeParse(ASSENTO_VALIDO).success).toBe(true);
    expect(
      DraftSeatWireSchema.safeParse({ ...ASSENTO_VALIDO, surpresa: 1 }).success
    ).toBe(false);
  });

  it("o fio do draft recusa campo extra (strict)", () => {
    const draftValido = {
      round: 1,
      turnIndex: 0,
      totalTurns: 40,
      currentSeat: 0,
      turnMsRemaining: 1000,
      remainingCards: 40,
      finished: false,
      order: [0, 1],
      timedOutSeat: null,
      seats: [ASSENTO_VALIDO],
    };
    expect(DraftWireSchema.safeParse(draftValido).success).toBe(true);
    expect(DraftWireSchema.safeParse({ ...draftValido, surpresa: 1 }).success).toBe(false);
  });

  it("a mensagem hand recusa campo extra (strict)", () => {
    const ok = HandMessageSchema.safeParse({ type: "hand", cards: [], turnMsRemaining: null });
    expect(ok.success).toBe(true);
    expect(
      HandMessageSchema.safeParse({
        type: "hand",
        cards: [],
        turnMsRemaining: null,
        surpresa: 1,
      }).success
    ).toBe(false);
  });
});

describe("protocolo v3", () => {
  it("PROTOCOL_VERSION passou de 3 — cliente do plano 2 recebe protocolMismatch", () => {
    expect(PROTOCOL_VERSION).toBeGreaterThan(3);
  });

  it("TOTAL_WAVES e 6 (D-23)", () => {
    expect(TOTAL_WAVES).toBe(6);
  });

  it("a visao do torneio no fio nao tem onde colocar uma timeline (D-27)", () => {
    const campos = Object.keys(TournamentSeriesWireSchema.shape);
    expect(campos).toContain("gamesPlayed");
    expect(campos).not.toContain("games");
    expect(campos).not.toContain("events");
  });

  it("games aceita no maximo 5 jogos", () => {
    const jogo = {
      seed: 1,
      winnerId: "assento-0",
      events: [],
      totalPlaybackMs: 0,
      champions: { teamA: {}, teamB: {} },
    };
    const cinco = { type: "games", slotId: "UB_QF_1", games: Array(5).fill(jogo) };
    const seis = { type: "games", slotId: "UB_QF_1", games: Array(6).fill(jogo) };
    expect(GamesMessageSchema.safeParse(cinco).success).toBe(true);
    expect(GamesMessageSchema.safeParse(seis).success).toBe(false);
  });

  it("ready carrega o booleano — da pra desmarcar", () => {
    expect(ClientMessageSchema.safeParse({ type: "ready", ready: false }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ type: "ready" }).success).toBe(false);
  });

  it("toda mensagem nova e strict — campo extra e recusado", () => {
    expect(ClientMessageSchema.safeParse({ type: "vote", choice: "continuar", extra: 1 }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "setWatch", slotId: "UB_QF_1", extra: 1 }).success).toBe(false);
  });

  it("slotId invalido e recusado na entrada", () => {
    expect(ClientMessageSchema.safeParse({ type: "setWatch", slotId: "UB_QF_9" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture de um TournamentWire completo e valido, so para este arquivo. A
// Tarefa 4 vai gerar esses objetos de verdade a partir do estado do servidor
// — de la virao os testes que validam o conteudo. Aqui so precisamos de algo
// que passe no schema para provar que campo extra e recusado (mutacao do
// .strict()).
// ---------------------------------------------------------------------------

function serieVazia(slotId: (typeof SlotIdSchema.options)[number]) {
  return {
    slotId,
    status: "pending" as const,
    teamAId: null,
    teamBId: null,
    wins: {},
    winnerId: null,
    gamesPlayed: 0,
  };
}

function timeValido(seatIndex: number) {
  return {
    id: `assento-${seatIndex}`,
    seatIndex,
    displayName: `Time ${seatIndex}`,
    tag: `T${seatIndex}`,
    publicId: null,
    eliminated: false,
  };
}

function tournamentWireValido(): TournamentWire {
  return {
    wave: 0,
    totalWaves: TOTAL_WAVES,
    series: SlotIdSchema.options.map(serieVazia),
    teams: Array.from({ length: 8 }, (_, i) => timeValido(i)),
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
  };
}

describe("protocolo v3 — mutacao do .strict() (revisao)", () => {
  it("a fixture do torneio tem as 14 series e os 8 times (sanidade)", () => {
    expect(SlotIdSchema.options.length).toBe(14);
    expect(tournamentWireValido().teams.length).toBe(8);
  });

  it("VoteWireSchema recusa campo extra (strict)", () => {
    const votoValido = { votes: { "pub-1": "continuar" }, faltam: 0 };
    expect(VoteWireSchema.safeParse(votoValido).success).toBe(true);
    expect(VoteWireSchema.safeParse({ ...votoValido, extra: 1 }).success).toBe(false);
  });

  it("TournamentTeamWireSchema recusa campo extra (strict)", () => {
    const timeValidoObj = timeValido(0);
    expect(TournamentTeamWireSchema.safeParse(timeValidoObj).success).toBe(true);
    expect(TournamentTeamWireSchema.safeParse({ ...timeValidoObj, extra: 1 }).success).toBe(false);
  });

  it("TournamentWireSchema recusa campo extra (strict)", () => {
    const torneioValido = tournamentWireValido();
    expect(TournamentWireSchema.safeParse(torneioValido).success).toBe(true);
    expect(TournamentWireSchema.safeParse({ ...torneioValido, extra: 1 }).success).toBe(false);
  });
});
