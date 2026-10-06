import { describe, it, expect, vi } from "vitest";
import {
  DISCONNECTED_GRACE_SECONDS,
  HOST_RECONNECT_GRACE_SECONDS,
  PROTOCOL_VERSION,
  RoomWireSchema,
  TOTAL_WAVES,
  type ClientMessage,
  type ServerMessage,
} from "../protocol";
import { createRoom, type Room } from "./state";
import { RoomHub, turnBudgetFor, type HubDeps, type Outbound } from "./hub";
import { makeBase } from "./cards.fixture";
import {
  createDraft,
  autoPick,
  currentSeat,
  handCards,
  incompleteSeats,
  isFinished,
  type DraftSeat,
} from "./draft";
import {
  teamIdOfSeat,
  allHumansEliminated,
  barrierMembers,
  createRoomTournament,
  runWave,
  type RoomTournament,
} from "./tournament";
import { hasTimelines, stripTimelines } from "./replay";
import type { SlotId } from "../engine/schema";

const BASE = makeBase(8);

/**
 * Com 2 humanos e a semente padrao dos testes, turns[0] cai num humano e o
 * #driveDraft nao roda nenhuma iteracao — testes que dependem do driveDraft
 * ter avancado ficam vazios por sorte da semente (F3 da revisao de qualidade
 * da Tarefa 6). Esta semente foi escolhida por busca: com 2 humanos (assentos
 * 0 e 1) e 6 bots (assentos 2 a 7), turns[0] e o assento 2, um bot.
 */
const SEMENTE_PRIMEIRO_TURNO_BOT = "semente-0";

/**
 * Sala com os apelidos dados. O primeiro entra pelo socket `s1` com o hostToken,
 * os demais por `s2`, `s3`… — o indice do socket segue a ordem de entrada, e e
 * isso que o socketDaVez usa para achar o socket de quem esta na vez.
 */
async function salaCom(
  nicks: string[],
  players = BASE,
  over: Partial<HubDeps> = {}
): Promise<RoomHub> {
  const hub = new RoomHub(createRoom("t"), players, deps(over));
  for (let i = 0; i < nicks.length; i++) {
    await hub.handle(`s${i + 1}`, hello(nicks[i]!, `Time ${i}`, i === 0 ? "t" : undefined));
  }
  return hub;
}

function clientIdDe(hub: RoomHub, nickname: string): string {
  const p = hub.room.players.find((x) => x.nickname === nickname);
  if (p === undefined) throw new Error(`${nickname} nao esta na sala`);
  return p.clientId;
}

/** O socket de quem esta na vez, seguindo a ordem de entrada da sala. */
function socketDaVez(hub: RoomHub): string {
  const dono = currentSeat(hub.room.draft!)?.clientId;
  if (dono === null || dono === undefined) throw new Error("a vez e de um bot ou o draft acabou");
  const i = hub.room.players.findIndex((p) => p.clientId === dono);
  return `s${i + 1}`;
}

export function deps(over: Partial<HubDeps> = {}): HubDeps {
  let clientes = 0;
  let publicos = 0;
  return {
    makeClientId: () => `c${++clientes}`,
    makePublicId: () => `pub${++publicos}`,
    makeSeed: () => "semente-de-teste",
    now: () => 0,
    schedule: () => () => {},
    onRoomChanged: () => {},
    publishBase: async () => 0,
    loadPlayers: async () => makeBase(8),
    catalogue: [],
    ...over,
  };
}

export function hello(nickname: string, teamName: string, hostToken?: string): ClientMessage {
  return { type: "hello", protocolVersion: PROTOCOL_VERSION, nickname, teamName, hostToken };
}

export function estadoDe(out: Outbound[]): Extract<ServerMessage, { type: "roomState" }> {
  const item = out.find((o) => o.message.type === "roomState");
  if (item === undefined) throw new Error("nenhum roomState na saida");
  return item.message as Extract<ServerMessage, { type: "roomState" }>;
}

export function erroDe(out: Outbound[]): string | null {
  const item = out.find((o) => o.message.type === "error");
  if (item === undefined) return null;
  return (item.message as Extract<ServerMessage, { type: "error" }>).code;
}

export function mensagemDe(out: Outbound[]): string {
  const item = out.find((o) => o.message.type === "error");
  if (item === undefined) return "";
  return (item.message as Extract<ServerMessage, { type: "error" }>).message;
}

/** Relogio falso: `now` so muda com `avancar`, `schedule` guarda os disparos pendentes. */
function relogioFalso() {
  let agora = 0;
  const agendados: { em: number; fn: () => void }[] = [];
  return {
    now: () => agora,
    schedule: (ms: number, fn: () => void) => {
      const item = { em: agora + ms, fn };
      agendados.push(item);
      return () => {
        const i = agendados.indexOf(item);
        if (i >= 0) agendados.splice(i, 1);
      };
    },
    /** Dispara os callbacks SEM mexer no relogio — simula um setTimeout adiantado. */
    dispararTodos() {
      for (const item of [...agendados]) {
        const i = agendados.indexOf(item);
        if (i >= 0) agendados.splice(i, 1);
        item.fn();
      }
    },
    avancar(ms: number) {
      agora += ms;
      for (const item of [...agendados]) {
        if (item.em <= agora) {
          agendados.splice(agendados.indexOf(item), 1);
          item.fn();
        }
      }
    },
    pendentes: () => agendados.length,
  };
}

async function salaComRelogio(nicks: string[]) {
  const relogio = relogioFalso();
  const enviadas: Outbound[] = [];
  const hub = await salaCom(nicks, BASE, { now: relogio.now, schedule: relogio.schedule });
  // Sem o sender ligado, o disparo do relogio mudaria a sala em silencio.
  hub.attachSender((out) => enviadas.push(...out));
  return { hub, relogio, enviadas };
}

/** Reconexao: reaproveita apelido e time que ja estao na sala, senao o nome
 * de time colide com o do proprio jogador e o joinRoom recusa. */
function helloDeVolta(hub: RoomHub, clientId: string): ClientMessage {
  const p = hub.room.players.find((x) => x.clientId === clientId);
  if (p === undefined) throw new Error("clientId desconhecido");
  return {
    type: "hello",
    protocolVersion: PROTOCOL_VERSION,
    clientId,
    nickname: p.nickname,
    teamName: p.teamName,
  };
}

describe("RoomHub.handle", () => {
  it("responde welcome + roomState a um hello valido", async () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    const out = await hub.handle("s1", hello("rafa", "Macacos"));

    expect(out[0]!.message.type).toBe("welcome");
    expect(out[0]!.to).toEqual(["s1"]);
    expect(out[1]!.message.type).toBe("roomState");
    expect(out[1]!.to).toBe("all");
  });

  it("recusa versao de protocolo diferente", async () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    const out = await hub.handle("s1", { ...hello("rafa", "Macacos"), protocolVersion: 99 });

    expect(out).toHaveLength(1);
    expect(out[0]!.message.type).toBe("protocolMismatch");
    expect(hub.room.players).toHaveLength(0);
  });

  it("descarta mensagem malformada com error, sem quebrar", async () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    const out = await hub.handle("s1", { type: "explodir" });

    expect(out).toHaveLength(1);
    expect(out[0]!.message).toMatchObject({ type: "error", code: "bad_message" });
  });

  it("recusa comandos antes do hello", async () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    const out = await hub.handle("s1", { type: "setSettings", turnSeconds: 90 });

    expect(out[0]!.message).toMatchObject({ type: "error", code: "unknown_client" });
  });

  it("avisa a persistencia a cada mudanca", async () => {
    const onRoomChanged = vi.fn();
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps({ onRoomChanged }));
    await hub.handle("s1", hello("rafa", "Macacos"));
    expect(onRoomChanged).toHaveBeenCalledWith(hub.room);
  });

  it("propaga o erro da sala cheia como error", async () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    for (let i = 0; i < 8; i++) {
      await hub.handle(`s${i}`, hello(`p${i}`, `Time ${i}`));
    }
    const out = await hub.handle("s99", hello("tarde", "Time tarde"));

    expect(out[0]!.message).toMatchObject({ type: "error", code: "room_full" });
  });

  it("deixa o host mudar turnSeconds e avisa a sala toda", async () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    await hub.handle("s1", hello("rafa", "Macacos", "segredo"));
    const out = await hub.handle("s1", { type: "setSettings", turnSeconds: 120 });

    expect(hub.room.settings.turnSeconds).toBe(120);
    expect(out[0]!.to).toBe("all");
  });

  it("recusa setSettings de quem nao e host", async () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    await hub.handle("s1", hello("rafa", "Macacos"));
    const out = await hub.handle("s1", { type: "setSettings", turnSeconds: 120 });

    expect(out[0]!.message).toMatchObject({ type: "error", code: "not_host" });
    expect(hub.room.settings.turnSeconds).toBe(60);
  });

  it("publica a base quando o host manda", async () => {
    const publishBase = vi.fn(async () => 42);
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps({ publishBase }));
    await hub.handle("s1", hello("rafa", "Macacos", "segredo"));
    const out = await hub.handle("s1", { type: "publishBase", database: { players: [] } });

    expect(publishBase).toHaveBeenCalledOnce();
    expect(out[0]!.message).toMatchObject({ type: "basePublished", playerCount: 42 });
  });

  it("recusa publishBase de quem nao e host", async () => {
    const publishBase = vi.fn(async () => 42);
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps({ publishBase }));
    await hub.handle("s1", hello("rafa", "Macacos"));
    const out = await hub.handle("s1", { type: "publishBase", database: { players: [] } });

    expect(publishBase).not.toHaveBeenCalled();
    expect(out[0]!.message).toMatchObject({ type: "error", code: "not_host" });
  });

  it("transforma base invalida em error, sem derrubar a sala", async () => {
    const hub = new RoomHub(
      createRoom("segredo"),
      makeBase(8),
      deps({
        publishBase: async () => {
          throw new Error("base invalida: players: obrigatorio");
        },
      })
    );
    await hub.handle("s1", hello("rafa", "Macacos", "segredo"));
    const out = await hub.handle("s1", { type: "publishBase", database: { lixo: true } });

    expect(out[0]!.message).toMatchObject({ type: "error", code: "invalid_base" });
  });

  it("nao transforma falha ao reler a base em invalid_base — a gravacao ja deu certo", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const hub = new RoomHub(
      createRoom("segredo"),
      makeBase(8),
      deps({
        publishBase: async () => 42,
        loadPlayers: async () => {
          throw new Error("disco caiu");
        },
      })
    );
    await hub.handle("s1", hello("rafa", "Macacos", "segredo"));
    const out = await hub.handle("s1", { type: "publishBase", database: { players: [] } });

    expect(out[0]!.message).toMatchObject({ type: "basePublished", playerCount: 42 });
    expect(erroDe(out)).toBeNull();
    consoleError.mockRestore();
  });

  it("recusa publishBase fora do lobby", async () => {
    const publishBase = vi.fn(async () => 42);
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps({ publishBase }));
    await hub.handle("s1", hello("rafa", "Macacos", "segredo"));
    hub.setPhase("draft");
    const out = await hub.handle("s1", { type: "publishBase", database: { players: [] } });

    expect(publishBase).not.toHaveBeenCalled();
    expect(out[0]!.message).toMatchObject({ type: "error", code: "in_progress" });
  });

  it("o welcome entrega clientId e publicId", async () => {
    const hub = new RoomHub(createRoom("t"), makeBase(8), deps());
    const out = await hub.handle("s1", hello("rafa", "Time"));
    const w = out.find((o) => o.message.type === "welcome")!;
    const msg = w.message as Extract<ServerMessage, { type: "welcome" }>;
    expect(msg.clientId.length).toBeGreaterThan(0);
    expect(msg.publicId.length).toBeGreaterThan(0);
    expect(msg.publicId).not.toBe(msg.clientId);
    expect(w.to).toEqual(["s1"]);
  });

  it("o roomState carrega o diagnostico da base", async () => {
    const hub = new RoomHub(createRoom("t"), makeBase(4), deps());
    const out = await hub.handle("s1", hello("rafa", "Time"));
    const msg = estadoDe(out);
    expect(msg.state.baseStatus.ready).toBe(false);
    expect(msg.state.baseStatus.spareByRole.top).toBe(4);
  });

  it("publicar uma base nova atualiza o diagnostico de todo mundo", async () => {
    const nova = makeBase(8);
    const hub = new RoomHub(
      createRoom("t"),
      makeBase(4),
      deps({
        publishBase: async () => nova.length,
        loadPlayers: async () => nova,
      })
    );
    await hub.handle("s1", hello("rafa", "Time", "t"));
    const out = await hub.handle("s1", { type: "publishBase", database: { players: nova } });
    expect(out.some((o) => o.message.type === "basePublished")).toBe(true);
    expect(estadoDe(out).state.baseStatus.ready).toBe(true);
  });

  it("nenhum roomState difundido contem um clientId (D-20)", async () => {
    const hub = new RoomHub(createRoom("t"), makeBase(8), deps());
    const out = await hub.handle("s1", hello("rafa", "Time"));
    const w = out.find((o) => o.message.type === "welcome")!;
    const clientId = (w.message as Extract<ServerMessage, { type: "welcome" }>).clientId;
    for (const item of out) {
      if (item.to !== "all") continue;
      expect(JSON.stringify(item.message)).not.toContain(clientId);
    }
  });

  it("o roomState do broadcast bate com o RoomWireSchema", async () => {
    const hub = new RoomHub(createRoom("t"), makeBase(8), deps());
    const out = await hub.handle("s1", hello("rafa", "Time"));
    const msg = estadoDe(out);
    expect(() => RoomWireSchema.parse(msg.state)).not.toThrow();
  });
});

describe("RoomHub.disconnect", () => {
  it("marca desconectado e avisa a sala", async () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    await hub.handle("s1", hello("rafa", "Macacos"));

    const out = hub.disconnect("s1");

    expect(hub.room.players[0]!.connected).toBe(false);
    expect(out[0]!.to).toBe("all");
  });

  it("ignora socket desconhecido", () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    expect(hub.disconnect("fantasma")).toEqual([]);
  });

  it("reconexao pelo clientId retoma o mesmo jogador", async () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    const primeiro = await hub.handle("s1", hello("rafa", "Macacos"));
    const welcome = primeiro[0]!.message;
    if (welcome.type !== "welcome") throw new Error("esperava welcome");
    hub.disconnect("s1");

    await hub.handle("s2", { ...hello("rafa", "Macacos"), clientId: welcome.clientId });

    expect(hub.room.players).toHaveLength(1);
    expect(hub.room.players[0]!.connected).toBe(true);
  });
});

describe("RoomHub.disconnect com dois sockets do mesmo jogador", () => {
  it("mantem o jogador conectado quando um dos sockets fecha", async () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    const primeiro = await hub.handle("s1", hello("rafa", "Macacos"));
    const welcome = primeiro[0]!.message;
    if (welcome.type !== "welcome") throw new Error("esperava welcome");

    // Mesma pessoa em outra aba/socket, antes do socket velho morrer.
    await hub.handle("s2", { ...hello("rafa", "Macacos"), clientId: welcome.clientId });

    const out = hub.disconnect("s1");

    expect(hub.room.players[0]!.connected).toBe(true);
    expect(out).toEqual([]);
  });

  it("marca offline quando o ultimo socket do jogador fecha", async () => {
    const hub = new RoomHub(createRoom("segredo"), makeBase(8), deps());
    const primeiro = await hub.handle("s1", hello("rafa", "Macacos"));
    const welcome = primeiro[0]!.message;
    if (welcome.type !== "welcome") throw new Error("esperava welcome");

    await hub.handle("s2", { ...hello("rafa", "Macacos"), clientId: welcome.clientId });
    hub.disconnect("s1");
    const out = hub.disconnect("s2");

    expect(hub.room.players[0]!.connected).toBe(false);
    expect(out[0]!.to).toBe("all");
  });
});

describe("comecar o draft", () => {
  it("so o host comeca", async () => {
    const hub = await salaCom(["rafa", "amigo"]); // rafa e host
    const out = await hub.handle("s2", { type: "startDraft", turnSeconds: 60 });
    expect(erroDe(out)).toBe("not_host");
  });

  it("recusa com menos de dois conectados", async () => {
    const hub = await salaCom(["rafa"]);
    const out = await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    expect(erroDe(out)).toBe("not_enough_players");
  });

  it("recusa com base insuficiente e diz o que falta (D-14)", async () => {
    const hub = await salaCom(["rafa", "amigo"], makeBase(4));
    const out = await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    expect(erroDe(out)).toBe("base_insuficiente");
    expect(mensagemDe(out)).toContain("8");
  });

  it("abre o draft com 8 assentos e aplica o turnSeconds da mensagem", async () => {
    const hub = await salaCom(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 45 });
    expect(hub.room.phase).toBe("draft");
    expect(hub.room.draft?.seats).toHaveLength(8);
    expect(hub.room.settings.turnSeconds).toBe(45);
  });

  it("recusa comecar duas vezes", async () => {
    const hub = await salaCom(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const out = await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    expect(erroDe(out)).toBe("in_progress");
  });

  it("quem esta desconectado no momento de comecar nao ganha assento fantasma (achado do teste de sala, 2026-08-27)", async () => {
    const hub = await salaCom(["rafa", "amigo", "sumido"]);
    // "sumido" caiu antes do host comecar -- fechou a aba sem nunca mais voltar.
    hub.disconnect("s3");

    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });

    const seats = hub.room.draft!.seats;
    expect(seats).toHaveLength(8);
    const clientIdsHumanos = seats.map((s) => s.clientId).filter((c): c is string => c !== null);
    expect(clientIdsHumanos).not.toContain(clientIdDe(hub, "sumido"));
    // So os 2 conectados viraram assento; os outros 6 sao bots (clientId null).
    expect(clientIdsHumanos).toHaveLength(2);
  });

  it("o turnSeconds aplicado vira o orcamento real do turno humano (nao so o campo settings)", async () => {
    // Reforco: uma mutacao que troca `turnSeconds` por `this.#room.settings.turnSeconds`
    // (o valor antigo) no #handleStartDraft passaria despercebida se so
    // conferissemos `hub.room.settings.turnSeconds` — o relogio do draft e outro
    // campo (draft.deadline), calculado a partir do orcamento no momento da
    // criacao. Aqui o turno novo (20s) e bem menor que o padrao (60s) usado nos
    // outros testes, entao um turnMsRemaining perto de 60000 denunciaria o bug.
    const now = () => 1_000_000;
    const hub = await salaCom(["rafa", "amigo"], BASE, { now });
    await hub.handle("s1", { type: "startDraft", turnSeconds: 20 });
    const draft = hub.room.draft!;
    // A vez sempre cai num humano depois do driveDraft (nunca para num bot),
    // entao o assento da vez sempre tem orcamento e portanto deadline != null.
    expect(draft.deadline).not.toBeNull();
    expect(draft.deadline! - now()).toBeLessThanOrEqual(20_000);
    expect(draft.deadline! - now()).toBeGreaterThan(0);
  });
});

describe("a mao e privada (spec secao 13)", () => {
  it("nunca sai como broadcast", async () => {
    const hub = await salaCom(["rafa", "amigo"]);
    const out = await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const maos = out.filter((o) => o.message.type === "hand");
    expect(maos.length).toBeGreaterThan(0);
    for (const m of maos) expect(m.to).not.toBe("all");
  });

  it("vai so para os sockets de quem esta na vez, seja qual for o indice do primeiro turno", async () => {
    // Semente forcada onde turns[0] e bot (F3 da revisao): com a semente
    // padrao turns[0] ja e humano e esta asserção so valia por sorte de
    // turnIndex ser 0. Aqui usamos currentSeat (o assento real da vez depois
    // do driveDraft) em vez de seats[turns[0]], entao o teste vale qualquer
    // que seja o indice do primeiro turno.
    const hub = await salaCom(["rafa", "amigo"], BASE, { makeSeed: () => SEMENTE_PRIMEIRO_TURNO_BOT });
    const out = await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    expect(hub.room.draft!.turnIndex).toBeGreaterThan(0); // driveDraft de fato avancou
    const mao = out.find((o) => o.message.type === "hand")!;
    const daVez = currentSeat(hub.room.draft!)!;
    const socketEsperado = daVez.clientId === clientIdDe(hub, "rafa") ? "s1" : "s2";
    expect(mao.to).toEqual([socketEsperado]);
  });

  it("sai exatamente uma mao por rodada de mensagens, para um humano so", async () => {
    const hub = await salaCom(["rafa", "amigo"]);
    const out = await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    expect(out.filter((o) => o.message.type === "hand")).toHaveLength(1);
    // Assentos de bot no comeco da ordem ja escolheram sozinhos: a vez nunca
    // para num bot, entao sempre ha exatamente um destinatario de mao.
    expect(currentSeat(hub.room.draft!)?.clientId).not.toBeNull();
  });

  it("bots no comeco da ordem ja escolheram quando o estado sai", async () => {
    // Semente forcada (F3 da revisao): com a semente padrao turnIndex fica em
    // 0 e o for abaixo roda zero vezes, sem provar nada. Precisamos que pelo
    // menos um bot va na frente do primeiro humano.
    const hub = await salaCom(["rafa", "amigo"], BASE, { makeSeed: () => SEMENTE_PRIMEIRO_TURNO_BOT });
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const draft = hub.room.draft!;
    expect(draft.turnIndex).toBeGreaterThan(0);
    // Todo assento pulado antes da vez atual e de bot e ja tem uma carta.
    for (let t = 0; t < draft.turnIndex; t++) {
      const seat = draft.seats[draft.turns[t]!]!;
      expect(seat.clientId).toBeNull();
      expect(Object.keys(seat.picks).length).toBeGreaterThan(0);
    }
    // Reforco: a soma de picks de todo mundo bate com turnIndex, provando que
    // foi o #driveDraft quem fez essas escolhas (nao um acaso de estado
    // inicial vazio que o for acima nem chegaria a percorrer).
    const totalPicks = draft.seats.reduce((soma, s) => soma + Object.keys(s.picks).length, 0);
    expect(totalPicks).toBe(draft.turnIndex);
  });

  it("nao manda hand quando quem esta na vez nao tem nenhum socket conectado", async () => {
    // Prova concreta da restricao mais importante da Tarefa 6: o ws.ts entrega
    // `to: "all"` ate para socket que nunca deu hello, entao a mao NUNCA pode
    // sair assim — e, quando a lista de sockets do dono da vez esta vazia (ele
    // caiu no MEIO do draft, sem reconectar), nada de "hand" pode sair.
    //
    // "terceiro" precisa estar CONECTADO no momento do startDraft (achado do
    // teste de sala 2026-08-27, F-1 desta tarefa: quem esta desconectado ali
    // nao ganha mais assento nenhum) -- o cenario desta prova e cair DEPOIS,
    // com o assento ja existindo.
    const hub = await salaCom(["rafa", "amigo", "terceiro"]);
    const terceiroId = clientIdDe(hub, "terceiro");

    let out = await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    // Agora sim: terceiro cai no meio do draft, sem reconectar.
    hub.disconnect("s3");

    let guarda = 0;
    while (currentSeat(hub.room.draft!)?.clientId !== terceiroId && guarda++ < 200) {
      if (isFinished(hub.room.draft!)) throw new Error("draft acabou sem passar por terceiro");
      const dono = currentSeat(hub.room.draft!)!.clientId!;
      const i = hub.room.players.findIndex((p) => p.clientId === dono);
      const socket = `s${i + 1}`;
      const carta = handCards(hub.room.draft!, BASE)[0]![1].id;
      out = await hub.handle(socket, { type: "pick", cardId: carta });
    }

    expect(currentSeat(hub.room.draft!)?.clientId).toBe(terceiroId);
    // O turno acabou de cair no assento sem socket: a saida que fez essa
    // transicao nao pode conter nenhuma mensagem de mao.
    expect(out.filter((o) => o.message.type === "hand")).toHaveLength(0);
  });
});

describe("escolher", () => {
  it("recusa quem nao esta na vez", async () => {
    const hub = await salaCom(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const daVez = currentSeat(hub.room.draft!)!;
    const socketErrado = daVez.clientId === clientIdDe(hub, "rafa") ? "s2" : "s1";
    const out = await hub.handle(socketErrado, { type: "pick", cardId: "top-0" });
    expect(erroDe(out)).toBe("not_your_turn");
  });

  it("recusa carta fora da mao", async () => {
    const hub = await salaCom(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const socket = socketDaVez(hub);
    const out = await hub.handle(socket, { type: "pick", cardId: "nao-existe" });
    expect(erroDe(out)).toBe("card_not_in_hand");
  });

  it("uma escolha valida difunde o estado e manda a mao para o proximo humano", async () => {
    const hub = await salaCom(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const socket = socketDaVez(hub);
    const carta = handCards(hub.room.draft!, BASE)[0]![1].id;
    const out = await hub.handle(socket, { type: "pick", cardId: carta });
    expect(out.some((o) => o.to === "all" && o.message.type === "roomState")).toBe(true);
  });

  it("a escolha realmente registra a carta no roster do assento (nao so avanca o turno)", async () => {
    // Reforco: um mutante que apagasse o corpo de applyPick mas ainda avancasse
    // turnIndex passaria pelo teste anterior (que so olha para o broadcast).
    // Aqui conferimos que a carta escolhida aparece nos picks do assento.
    const hub = await salaCom(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const seatIndexAntes = hub.room.draft!.turns[hub.room.draft!.turnIndex]!;
    const socket = socketDaVez(hub);
    const [role, carta] = handCards(hub.room.draft!, BASE)[0]!;
    await hub.handle(socket, { type: "pick", cardId: carta.id });
    const seatDepois = hub.room.draft!.seats[seatIndexAntes]!;
    expect(seatDepois.picks[role]).toBe(carta.id);
  });

  it("os bots escolhem sozinhos ate voltar num humano", async () => {
    // Semente forcada (F3 da revisao): com a semente padrao a vez ja comeca
    // num humano, o #driveDraft nao roda nenhuma iteracao, e o teste passava
    // sem provar que os bots escolhem sozinhos coisa nenhuma.
    const hub = await salaCom(["rafa", "amigo"], BASE, { makeSeed: () => SEMENTE_PRIMEIRO_TURNO_BOT });
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const draft = hub.room.draft!;
    expect(draft.turnIndex).toBeGreaterThan(0); // driveDraft de fato avancou
    const seat = currentSeat(draft);
    expect(seat?.clientId).not.toBeNull(); // nunca para num bot
  });

  it("um draft inteiro fecha com os 8 rosters completos e o fio marca finished (D-21)", async () => {
    const hub = await salaCom(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });

    let ultima: Outbound[] = [];
    let guarda = 0;
    while (!isFinished(hub.room.draft!) && guarda++ < 100) {
      const socket = socketDaVez(hub);
      const carta = handCards(hub.room.draft!, BASE)[0]![1].id;
      ultima = await hub.handle(socket, { type: "pick", cardId: carta });
    }

    expect(isFinished(hub.room.draft!)).toBe(true);
    expect(hub.room.draft!.seats.every((s) => Object.keys(s.picks).length === 5)).toBe(true);
    // A fase continua `draft`: a virada para `tournament` e do Plano 3 (D-21).
    expect(hub.room.phase).toBe("draft");
    expect(estadoDe(ultima).state.draft?.finished).toBe(true);
  });
});

describe("nao vaza clientId durante o draft (D-20, F1 da revisao)", () => {
  it("nenhum roomState difundido ao longo de um draft inteiro carrega um clientId", async () => {
    // O unico teste D-20 anterior olhava a saida de um hello no lobby, quando
    // draft ainda e null. Uma mutacao em #publicIds que trocasse p.publicId
    // por p.clientId vazaria o clientId em draft.seats[].publicId em todo
    // roomState difundido durante o draft, e essa suite continuaria verde sem
    // este teste.
    const hub = await salaCom(["rafa", "amigo"]);
    const clientIds = hub.room.players.map((p) => p.clientId);
    const difundidos: Outbound[] = [];

    difundidos.push(...(await hub.handle("s1", { type: "startDraft", turnSeconds: 60 })));

    let guarda = 0;
    while (!isFinished(hub.room.draft!) && guarda++ < 100) {
      const socket = socketDaVez(hub);
      const carta = handCards(hub.room.draft!, BASE)[0]![1].id;
      difundidos.push(...(await hub.handle(socket, { type: "pick", cardId: carta })));
    }

    const estados = difundidos.filter((o) => o.to === "all");
    expect(estados.length).toBeGreaterThan(0);
    for (const item of estados) {
      const texto = JSON.stringify(item.message);
      for (const clientId of clientIds) expect(texto).not.toContain(clientId);
    }
  });
});

describe("duas abas do mesmo jogador (F4 da revisao)", () => {
  it("os dois sockets do humano da vez recebem a mesma mao, e o outro jogador nao recebe nada", async () => {
    const hub = await salaCom(["rafa", "amigo"]);
    const rafaId = clientIdDe(hub, "rafa");
    // rafa abre uma segunda aba (mesmo clientId, socket novo) antes do draft
    // comecar — o welcome nao importa aqui, so o registro do segundo socket.
    await hub.handle("s1b", { ...hello("rafa", "Time 0"), clientId: rafaId });

    let out = await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });

    // Joga ate a vez cair em rafa, sem depender de qual seed calha de comecar
    // com ele — mantendo o teste deterministico com a semente padrao mesmo
    // assim, so avancando quando precisa.
    let guarda = 0;
    while (currentSeat(hub.room.draft!)?.clientId !== rafaId && guarda++ < 200) {
      if (isFinished(hub.room.draft!)) throw new Error("draft acabou sem passar por rafa");
      const socket = socketDaVez(hub);
      const carta = handCards(hub.room.draft!, BASE)[0]![1].id;
      out = await hub.handle(socket, { type: "pick", cardId: carta });
    }

    const maos = out.filter((o) => o.message.type === "hand");
    expect(maos).toHaveLength(1);
    const mao = maos[0]!;
    // As duas abas de rafa recebem a mao — nenhuma fica de fora vendo "sua
    // vez" com a mao vazia (a mutacao #socketsOf -> slice(0,1) so entregaria
    // a primeira).
    expect(mao.to).toEqual(expect.arrayContaining(["s1", "s1b"]));
    expect((mao.to as string[])).toHaveLength(2);
    // amigo (s2) nunca recebe a mao de rafa.
    expect(mao.to).not.toContain("s2");
  });
});

describe("o orcamento do turno (turnBudgetFor, F5 da revisao)", () => {
  it("assento de bot nao tem relogio", () => {
    const bot: DraftSeat = { clientId: null, teamName: "Bot 1", picks: {}, seenCardIds: [] };
    expect(turnBudgetFor(bot, 60, new Set())).toBeNull();
    expect(turnBudgetFor(bot, 60, new Set(["qualquer"]))).toBeNull();
  });

  it("humano conectado recebe o turno cheio", () => {
    const humano: DraftSeat = { clientId: "c1", teamName: "Time", picks: {}, seenCardIds: [] };
    expect(turnBudgetFor(humano, 60, new Set(["c1"]))).toBe(60_000);
  });

  it("humano desconectado recebe a carencia curta, nao o turno cheio (D-17)", () => {
    const humano: DraftSeat = { clientId: "c1", teamName: "Time", picks: {}, seenCardIds: [] };
    expect(turnBudgetFor(humano, 60, new Set())).toBe(DISCONNECTED_GRACE_SECONDS * 1000);
    expect(turnBudgetFor(humano, 60, new Set(["outro-cliente"]))).toBe(
      DISCONNECTED_GRACE_SECONDS * 1000
    );
  });

  it("a carencia nunca passa do turno cheio, mesmo com turno curto", () => {
    // turnSeconds no minimo permitido (10s), menor que a carencia de 15s: quem
    // caiu nao pode ganhar MAIS tempo do que quem esta de fato jogando.
    const humano: DraftSeat = { clientId: "c1", teamName: "Time", picks: {}, seenCardIds: [] };
    expect(turnBudgetFor(humano, 10, new Set())).toBe(10_000);
  });

  it("no fluxo real do hub, quem caiu no meio do draft tambem recebe a carencia (nao so a funcao pura)", async () => {
    // As tres asserções acima chamam turnBudgetFor direto, passando o Set de
    // conectados a mao — isso nao exercita o #conectados() de verdade do hub.
    // Uma mutacao em #conectados() que ignorasse p.connected (ex.: incluir
    // todo mundo sempre) passaria pelas asserções acima sem ser notada. Este
    // teste passa pelo #budget real do hub, que chama this.#conectados().
    const now = () => 5_000_000;
    const hub = await salaCom(["rafa", "amigo", "terceiro"], BASE, { now });
    const terceiroId = clientIdDe(hub, "terceiro");

    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    // terceiro cai no meio do draft (nao antes de comecar) — continua no
    // assento, so fica sem socket registrado.
    hub.disconnect("s3");

    let guarda = 0;
    while (currentSeat(hub.room.draft!)?.clientId !== terceiroId && guarda++ < 200) {
      if (isFinished(hub.room.draft!)) throw new Error("draft acabou sem passar por terceiro");
      const dono = currentSeat(hub.room.draft!)!.clientId!;
      const i = hub.room.players.findIndex((p) => p.clientId === dono);
      const socket = `s${i + 1}`;
      const carta = handCards(hub.room.draft!, BASE)[0]![1].id;
      await hub.handle(socket, { type: "pick", cardId: carta });
    }

    expect(currentSeat(hub.room.draft!)?.clientId).toBe(terceiroId);
    const restante = hub.room.draft!.deadline! - now();
    expect(restante).toBeGreaterThan(0);
    expect(restante).toBeLessThanOrEqual(DISCONNECTED_GRACE_SECONDS * 1000);
  });
});

describe("startDraft nao deixa a sala presa se a criacao do draft falhar (F7 da revisao)", () => {
  it("a sala continua no lobby, sem draft, se makeSeed lancar no meio do startDraft", async () => {
    // Reproduz o cenario do bug: um erro entre a validacao e o commit final.
    // Antes do F7, this.#room ja tinha sido mutado pra phase:"draft" antes
    // desse ponto — ficando presa la mesmo com a excecao, sem draft e sem
    // onRoomChanged. Depois do F7, so ha um #commit no fim: se algo lanca
    // antes dele, a sala nunca muda.
    const hub = await salaCom(["rafa", "amigo"], BASE, {
      makeSeed: () => {
        throw new Error("semente indisponivel");
      },
    });

    await expect(hub.handle("s1", { type: "startDraft", turnSeconds: 60 })).rejects.toThrow(
      "semente indisponivel"
    );

    expect(hub.room.phase).toBe("lobby");
    expect(hub.room.draft).toBeNull();

    // A sala nao ficou presa: um startDraft novo (sem o deps quebrado) segue
    // adiante normalmente.
    const hub2 = await salaCom(["rafa", "amigo"]);
    const out = await hub2.handle("s1", { type: "startDraft", turnSeconds: 60 });
    expect(erroDe(out)).toBeNull();
    expect(hub2.room.phase).toBe("draft");
  });
});

describe("relogio do turno", () => {
  it("estourar o prazo faz o bot escolher pelo jogador", async () => {
    const { hub, relogio, enviadas } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const antes = hub.room.draft!.turnIndex;
    const assentoAntes = hub.room.draft!.turns[antes]!;

    relogio.avancar(60_000);

    expect(hub.room.draft!.turnIndex).toBeGreaterThan(antes);
    // Reforco: prova que autoPick de fato registrou uma carta no assento que
    // estourou, e nao so avancou turnIndex por algum outro caminho.
    expect(Object.keys(hub.room.draft!.seats[assentoAntes]!.picks).length).toBeGreaterThan(0);
    expect(enviadas.some((o) => o.message.type === "roomState")).toBe(true);
    // Reforco (Q4 da revisao): so olhar pro roomState nao prova que a mao do
    // proximo humano saiu — um mutante que empurrasse so o roomState no
    // disparo do relogio passaria despercebido, e o humano que herdou a vez
    // ficaria olhando o cronometro correndo sem carta nenhuma pra clicar.
    // Tambem prova que a mao nao vaza como "all" so pelo caminho do relogio.
    const maos = enviadas.filter((o) => o.message.type === "hand");
    expect(maos.length).toBeGreaterThan(0);
    expect(maos.every((o) => o.to !== "all")).toBe(true);
  });

  it("estourar o prazo marca timedOutSeat no broadcast seguinte, e so nele (Fase 6)", async () => {
    const { hub, relogio, enviadas } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const assentoAntes = hub.room.draft!.turns[hub.room.draft!.turnIndex]!;

    relogio.avancar(60_000);

    expect(estadoDe(enviadas).state.draft?.timedOutSeat).toBe(assentoAntes);

    // Um roomState causado por outro evento (aqui, uma reconexao) nao carrega
    // mais a marca — ela vale so pro broadcast que segue o timeout em si.
    const outReconexao = await hub.handle(
      "s1-novo",
      helloDeVolta(hub, clientIdDe(hub, "rafa"))
    );
    expect(estadoDe(outReconexao).state.draft?.timedOutSeat ?? null).toBeNull();
  });

  it("escolher antes do prazo cancela o disparo", async () => {
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const socket = socketDaVez(hub);
    const carta = handCards(hub.room.draft!, BASE)[0]![1].id;
    await hub.handle(socket, { type: "pick", cardId: carta });
    // so o timer do turno novo continua armado
    expect(relogio.pendentes()).toBe(1);
  });

  it("quem cai na propria vez recebe carencia curta, nao o turno cheio (D-17)", async () => {
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const socket = socketDaVez(hub);
    const antes = hub.room.draft!.turnIndex;

    hub.disconnect(socket);
    relogio.avancar(15_000);

    expect(hub.room.draft!.turnIndex).toBeGreaterThan(antes);
  });

  it("quem cai perto do fim do proprio turno nao tem o prazo esticado (D-17, nunca alonga)", async () => {
    // Reforco: sem o `if (carencia < draft.deadline)`, cair a 2s do fim
    // esticaria o prazo ate a carencia inteira (15s) em vez de manter os 2s
    // que restavam — o jogador ganharia tempo por ter caido, o oposto do D-17.
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const socket = socketDaVez(hub);

    relogio.avancar(58_000); // sobram 2s, menos que os 15s de carencia
    const deadlineAntes = hub.room.draft!.deadline;

    hub.disconnect(socket);

    expect(hub.room.draft!.deadline).toBe(deadlineAntes);
  });

  it("reconectar na propria vez devolve o turno cheio e reenvia a mao", async () => {
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const socket = socketDaVez(hub);
    const dono = currentSeat(hub.room.draft!)!.clientId!;

    hub.disconnect(socket);
    relogio.avancar(10_000);
    const out = await hub.handle("s9", helloDeVolta(hub, dono));

    expect(out.some((o) => o.message.type === "hand" && o.to !== "all")).toBe(true);
    expect(hub.room.draft!.deadline).toBe(relogio.now() + 60_000);
  });

  it("reconectar fora da propria vez nao reenvia a mao nem mexe no prazo", async () => {
    // Reforco: prova que a devolucao do turno cheio e a reenvio da mao sao
    // condicionados a quem reconecta SER o dono da vez, nao qualquer hello.
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const donoDaVez = currentSeat(hub.room.draft!)!.clientId!;
    const outro = hub.room.players.find((p) => p.clientId !== donoDaVez)!;
    const indiceDoOutro = hub.room.players.findIndex((p) => p.clientId === outro.clientId);
    hub.disconnect(`s${indiceDoOutro + 1}`);
    const deadlineAntes = hub.room.draft!.deadline;

    relogio.avancar(1_000);
    const out = await hub.handle("s9", helloDeVolta(hub, outro.clientId));

    expect(out.some((o) => o.message.type === "hand")).toBe(false);
    expect(hub.room.draft!.deadline).toBe(deadlineAntes);
  });

  it("o draft terminado desarma o relogio", async () => {
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    for (let i = 0; i < 60 && !isFinished(hub.room.draft!); i++) relogio.avancar(60_000);
    expect(isFinished(hub.room.draft!)).toBe(true);
    expect(relogio.pendentes()).toBe(0);
  });

  it("um disparo adiantado nao rouba o turno de ninguem", async () => {
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const antes = hub.room.draft!.turnIndex;
    // dispara o callback sem avancar o relogio
    relogio.dispararTodos();
    expect(hub.room.draft!.turnIndex).toBe(antes);
    // Reforco (Q5 da revisao): confere que o relogio foi REARMADO, nao so que
    // o turno nao mudou. Um #onTurnTimeout que so retorna cedo sem rearmar
    // passaria na assercao acima e deixaria o turno sem timer nenhum — o
    // jogador ausente segurando a sala ate alguem agir por fora, tela
    // congelada que a suite nao veria.
    expect(relogio.pendentes()).toBe(1);
  });

  it("hello repetido de quem nunca desconectou nao estica o prazo (Q1 da revisao)", async () => {
    // Sem a checagem de "estava caido" antes do joinRoom, um hello de quem ja
    // esta conectado (segunda aba, ou so um reenvio) reesticaria o prazo pra
    // sempre — o cenario do revisor: 5 hellos intercalados com 50s de relogio
    // e, depois de 250s num turno de 60, o turno nunca estourava.
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const socket = socketDaVez(hub);
    const dono = currentSeat(hub.room.draft!)!.clientId!;

    for (let i = 0; i < 5; i++) {
      await hub.handle(socket, helloDeVolta(hub, dono));
      relogio.avancar(50_000);
    }

    // 250s se passaram num turno de 60s: o relogio tem que ter estourado bem
    // antes disso, nao ter ficado esticando pra sempre a cada hello.
    expect(hub.room.draft!.turnIndex).toBeGreaterThan(0);
  });

  it("reconectar na propria vez: o turnMsRemaining do roomState bate com o da mao (Q2 da revisao)", async () => {
    // Montar o broadcastState ANTES do commit que estica o prazo deixaria o
    // roomState de todo mundo com o turnMsRemaining antigo (curto, da
    // carencia) parado por ate 55s — sem broadcast periodico (so ha ping),
    // ninguem corrige isso sozinho. O roomState difundido e a mao privada tem
    // que sair com o MESMO prazo.
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const socket = socketDaVez(hub);
    const dono = currentSeat(hub.room.draft!)!.clientId!;

    hub.disconnect(socket);
    relogio.avancar(10_000);
    const out = await hub.handle("s9", helloDeVolta(hub, dono));

    const estado = estadoDe(out);
    const mao = out.find((o) => o.message.type === "hand");
    if (mao === undefined || mao.message.type !== "hand") throw new Error("esperava hand");
    expect(estado.state.draft?.turnMsRemaining).toBe(mao.message.turnMsRemaining);
  });

  it("alternar queda e volta na propria vez nao segura o turno para sempre (G-1)", async () => {
    // A sonda da revisao final virada em teste. Sem teto, os dois lados do D-17
    // se compoem num laco infinito: `disconnect` encurta o prazo para 15s e o
    // `hello` de volta devolve o turno CHEIO, para sempre. 20 ciclos de 15s sao
    // 300s de relogio de parede num turno de 60 — o teto de TURN_WALL_CLOCK_CAP
    // vezes o turno (120s) tem que ter estourado bem antes, e o autoPick tem
    // que ter escolhido pelo assento que segurava a sala.
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });

    const socket = socketDaVez(hub);
    const dono = currentSeat(hub.room.draft!)!.clientId!;
    const turnoInicial = hub.room.draft!.turnIndex;
    const assento = hub.room.draft!.turns[turnoInicial]!;

    for (let i = 0; i < 20; i++) {
      hub.disconnect(socket);
      relogio.avancar(14_000); // volta faltando 1s da carencia
      await hub.handle(socket, helloDeVolta(hub, dono));
      relogio.avancar(1_000);
    }

    expect(hub.room.draft!.turnIndex).toBeGreaterThan(turnoInicial);
    expect(Object.keys(hub.room.draft!.seats[assento]!.picks).length).toBeGreaterThan(0);
  });

  it("o teto nao tira o turno cheio de quem so deu F5 dentro dele (D-17 continua valendo)", async () => {
    // Contraprova do teste acima: o teto so morde na segunda metade do
    // orcamento. Uma queda e uma volta logo no comeco do turno devolvem os 60s
    // inteiros, porque 60s ainda cabem embaixo do teto de 120s.
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const socket = socketDaVez(hub);
    const dono = currentSeat(hub.room.draft!)!.clientId!;

    hub.disconnect(socket);
    relogio.avancar(5_000);
    await hub.handle(socket, helloDeVolta(hub, dono));

    expect(hub.room.draft!.deadline).toBe(relogio.now() + 60_000);
  });

  it("dispose desarma o relogio para sempre (Q3 da revisao)", async () => {
    const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const antes = hub.room.draft!.turnIndex;

    hub.dispose();
    relogio.avancar(60_000);

    // Sem dispose cancelando o #cancelClock, o disparo do relogio real ainda
    // aconteceria depois do close do servidor.
    expect(hub.room.draft!.turnIndex).toBe(antes);
    expect(relogio.pendentes()).toBe(0);
  });
});

describe("sala restaurada de snapshot (M-2 da revisao final)", () => {
  /** A sala como o loadRoom a devolve: mesmo estado, ninguem conectado. */
  function comoRestaurada(room: Room): Room {
    return { ...room, players: room.players.map((p) => ({ ...p, connected: false })) };
  }

  it("ja nasce com o cronometro armado, sem esperar a primeira mensagem", async () => {
    // O #rearmClock so era chamado dentro do #commit, e o main.ts monta o hub a
    // partir do loadRoom sem nenhum commit de arranque: entre o listen() e a
    // primeira mensagem de cliente nao existia timer nenhum, mesmo com a sala
    // restaurada em fase de draft e com prazo gravado. A maquina ficava parada
    // por construcao.
    const { hub } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const salva = comoRestaurada(hub.room);

    const relogio = relogioFalso();
    const restaurado = new RoomHub(
      salva,
      BASE,
      deps({ now: relogio.now, schedule: relogio.schedule })
    );
    restaurado.attachSender(() => {});

    expect(relogio.pendentes()).toBe(1);

    const antes = restaurado.room.draft!.turnIndex;
    relogio.avancar(DISCONNECTED_GRACE_SECONDS * 1000);
    expect(restaurado.room.draft!.turnIndex).toBeGreaterThan(antes);
  });

  it("o prazo de um snapshot velho vira a carencia do D-17, nao um turno ja vencido", async () => {
    // O deadline gravado e um epoch do processo ANTERIOR. Se o servidor ficou
    // fora do ar mais que o turno, ele ja nasce vencido: o primeiro #commit —
    // o hello de QUALQUER um, nao necessariamente do dono da vez — agendava
    // schedule(0) e o autoPick escolhia pelo dono da vez, que nunca teve os 15s
    // de carencia que o D-17 promete depois de um restart.
    const { hub } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const donoDaVez = currentSeat(hub.room.draft!)!.clientId!;
    const outro = hub.room.players.find((p) => p.clientId !== donoDaVez)!;
    const salva = comoRestaurada(hub.room);

    // Uma hora fora do ar.
    const relogio = relogioFalso();
    relogio.avancar(60 * 60 * 1000);
    const restaurado = new RoomHub(
      salva,
      BASE,
      deps({ now: relogio.now, schedule: relogio.schedule })
    );
    restaurado.attachSender(() => {});

    expect(restaurado.room.draft!.deadline!).toBeGreaterThan(relogio.now());

    const turnoAntes = restaurado.room.draft!.turnIndex;
    await restaurado.handle("x1", helloDeVolta(restaurado, outro.clientId));
    relogio.avancar(1_000);
    expect(restaurado.room.draft!.turnIndex).toBe(turnoAntes);

    // E o dono da vez ainda alcanca o proprio turno, com a mao de volta.
    const out = await restaurado.handle("x2", helloDeVolta(restaurado, donoDaVez));
    expect(out.some((o) => o.message.type === "hand" && o.to !== "all")).toBe(true);
    expect(restaurado.room.draft!.deadline).toBe(relogio.now() + 60_000);
  });

  it("a sala restaurada no lobby nao arma relogio nenhum", async () => {
    const relogio = relogioFalso();
    const hub = new RoomHub(
      createRoom("t"),
      BASE,
      deps({ now: relogio.now, schedule: relogio.schedule })
    );
    hub.attachSender(() => {});
    expect(relogio.pendentes()).toBe(0);
  });
});

describe("roster incompleto no fim do draft (m-6 da revisao final)", () => {
  it("avisa no log quando o baralho acaba e algum assento fecha com menos de 5 cartas", async () => {
    // O autoPick pula o turno quando a mao vem vazia — decisao certa, e a
    // alternativa a travar a sala. Mas o assento termina com menos de
    // PICKS_PER_SEAT cartas e NADA sinalizava isso: nem log, nem campo no fio,
    // nem invariante no fim. O D-14 torna o caso inalcancavel hoje; o torneio
    // do proximo plano vai converter estes rosters em times, e um buraco calado
    // vira erro longe daqui.
    const pobre = makeBase(2);
    const humanos = Array.from({ length: 8 }, (_, i) => ({ clientId: `c${i}`, teamName: `T${i}` }));
    const draft = createDraft({
      players: pobre,
      humans: humanos,
      seed: "baralho-curto",
      now: 0,
      budget: () => 60_000,
    });
    const sala: Room = {
      phase: "draft",
      players: humanos.map((h, i) => ({
        clientId: h.clientId,
        publicId: `pub${i}`,
        nickname: `p${i}`,
        teamName: h.teamName,
        isHost: i === 0,
        connected: false,
        spectator: false,
      })),
      settings: { turnSeconds: 60 },
      draft,
      tournament: null,
      hostToken: "t",
    };

    const relogio = relogioFalso();
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const hub = new RoomHub(
        sala,
        pobre,
        deps({ now: relogio.now, schedule: relogio.schedule })
      );
      hub.attachSender(() => {});
      for (let i = 0; i < 100 && !isFinished(hub.room.draft!); i++) relogio.avancar(60_000);

      expect(isFinished(hub.room.draft!)).toBe(true);
      expect(incompleteSeats(hub.room.draft!).length).toBeGreaterThan(0);
      // Um aviso so, no commit que fechou o draft — nao um por mudanca de sala
      // depois disso.
      expect(avisos).toHaveBeenCalledTimes(1);
      expect(String(avisos.mock.calls[0]![0])).toContain("roster incompleto");
    } finally {
      avisos.mockRestore();
    }
  });

  it("um draft que fecha completo nao avisa nada", async () => {
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { hub, relogio } = await salaComRelogio(["rafa", "amigo"]);
      await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
      for (let i = 0; i < 60 && !isFinished(hub.room.draft!); i++) relogio.avancar(60_000);

      expect(isFinished(hub.room.draft!)).toBe(true);
      expect(avisos).not.toHaveBeenCalled();
    } finally {
      avisos.mockRestore();
    }
  });
});

describe("um pick recusado devolve a mao (m-1 da revisao final)", () => {
  it("erro de carta fora da mao vem acompanhado da mao de volta", async () => {
    // O cliente limpa a mao otimisticamente no envio (store.ts): sem a mao de
    // volta, a tela fica em "Preparando sua mao…" — sem botao nenhum — ate o
    // relogio tomar o turno. No caso comum (not_your_turn) o roomState do turno
    // novo cura a tela; no card_not_in_hand com a vez ainda sendo minha, nao ha
    // cura nenhuma.
    const { hub } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const socket = socketDaVez(hub);

    const out = await hub.handle(socket, { type: "pick", cardId: "nao-existe" });

    expect(erroDe(out)).toBe("card_not_in_hand");
    const mao = out.find((o) => o.message.type === "hand");
    expect(mao).toBeDefined();
    expect(mao!.to).toEqual([socket]);
    expect(mao!.message.type === "hand" && mao!.message.cards.length).toBeGreaterThan(0);
    // E o turno nao andou: a mao devolvida e a MESMA de antes.
    expect(hub.room.draft!.turnIndex).toBe(0);
  });

  it("quem nao esta na vez recebe so o erro, nunca a mao alheia", async () => {
    // A mao e privada (spec secao 13): devolver a mao no ramo de erro nao pode
    // virar uma porta para ler a mao de quem esta na vez.
    const { hub } = await salaComRelogio(["rafa", "amigo"]);
    await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
    const daVez = socketDaVez(hub);
    const outro = daVez === "s1" ? "s2" : "s1";

    const out = await hub.handle(outro, { type: "pick", cardId: "qualquer" });

    expect(erroDe(out)).toBe("not_your_turn");
    expect(out.some((o) => o.message.type === "hand")).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// startTournament (Tarefa 7)
// -----------------------------------------------------------------------------

/**
 * Sala com 2 humanos e um draft ja fechado, pronta para startTournament.
 * Fecha o draft direto com `autoPick` (a mesma tecnica de
 * tournament.fixture.ts) em vez de `pick` turno a turno: mais rapido, e nao
 * depende de qual assento cai a vez a cada iteracao. Os sockets sao
 * registrados depois via um "hello" de reconexao (helloDeVolta), para que
 * #socketsOf funcione nos testes que endereçam a `games`.
 */
async function salaComDraftPronto() {
  const relogio = relogioFalso();
  const clientIds = ["c0", "c1"];

  let draft = createDraft({
    players: BASE,
    humans: clientIds.map((clientId, i) => ({ clientId, teamName: `Time ${i}` })),
    seed: "semente-de-teste",
    now: 0,
    budget: () => null,
  });
  while (!isFinished(draft)) draft = autoPick(draft, BASE, 0, () => null);

  const room: Room = {
    phase: "draft",
    players: clientIds.map((clientId, i) => ({
      clientId,
      publicId: `pub${i}`,
      nickname: `p${i}`,
      teamName: `Time ${i}`,
      isHost: i === 0,
      connected: false,
      spectator: false,
    })),
    settings: { turnSeconds: 60 },
    draft,
    tournament: null,
    hostToken: "t",
  };

  const hub = new RoomHub(room, BASE, deps({ now: relogio.now, schedule: relogio.schedule }));
  const enviadas: Outbound[] = [];
  hub.attachSender((out) => enviadas.push(...out));

  for (let i = 0; i < clientIds.length; i++) {
    await hub.handle(`s${i + 1}`, helloDeVolta(hub, clientIds[i]!));
  }

  return { hub, clientIds, agendados: relogio, enviadas };
}

/** Sala com 2 humanos e o draft comecado, mas longe de terminar. */
async function salaComDraftPelaMetade() {
  const hub = await salaCom(["rafa", "amigo"]);
  await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
  return { hub };
}

describe("espectador que chega depois do lobby (S19)", () => {
  it("com 'Assistir juntos' ligado, o espectador recem-chegado vai para a serie da sala (achado 6)", async () => {
    const { hub } = await salaComDraftPronto();
    await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });
    await hub.handle("s1", { type: "setSyncMode", enabled: true });
    const slot = hub.room.tournament!.sync!.slotId;
    const entrada = await hub.handle("s9", hello("atrasada", ""));
    const id = clientIdDe(hub, "atrasada");
    expect(hub.room.tournament!.watching[id]).toBe(slot);
    expect(entrada.some((o) => o.message.type === "games")).toBe(true);
  });

  it("rename pelo socket aberto: troca o nome e a pessoa continua conectada", async () => {
    const hub = await salaCom(["rafa", "amigo"]);
    const out = await hub.handle("s2", { type: "rename", nickname: "Amigo", teamName: "Novo Time" });
    expect(erroDe(out)).toBeNull();
    const eu = hub.room.players.find((p) => p.nickname === "Amigo")!;
    expect(eu.teamName).toBe("Novo Time");
    expect(eu.connected).toBe(true);
  });

  it("entra sem time, acompanha a onda nova e nao vota nem conta na barreira", async () => {
    const { hub } = await salaComDraftPronto();
    await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });

    const entrada = await hub.handle("s9", hello("atrasada", ""));
    expect(entrada[0]!.message.type).toBe("welcome");
    const jogador = estadoDe(entrada).state.players.find((p) => p.nickname === "atrasada")!;
    expect(jogador.spectator).toBe(true);
    expect(jogador.teamName).toBe("");

    const espectadorId = clientIdDe(hub, "atrasada");
    expect(hub.room.tournament!.seatClientIds).not.toContain(espectadorId);

    // A barreira so espera os dois humanos com assento.
    await hub.handle("s1", { type: "ready", ready: true });
    const onda = hub.room.tournament!.wave;
    await hub.handle("s2", { type: "ready", ready: true });
    await hub.handle("s1", { type: "forceAdvance" });
    expect(hub.room.tournament!.wave).toBe(onda + 1);

    // Onda nova: o espectador e apontado para a primeira serie dela.
    expect(hub.room.tournament!.watching[espectadorId]).toBeDefined();
  });
});

describe("startTournament", () => {
  it("so o host comeca o torneio", async () => {
    const { hub } = await salaComDraftPronto();
    const saida = await hub.handle("s2", { type: "startTournament", chaosLevel: 0.25 });
    expect(erroDe(saida)).toBe("not_host");
    expect(hub.room.tournament).toBeNull();
  });

  it("startTournament com draft pela metade recusa", async () => {
    const { hub } = await salaComDraftPelaMetade();
    const saida = await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });
    expect(erroDe(saida)).toBe("draft_incompleto");
  });

  it("draft pela metade explica que o draft nao acabou, nao fala de carta faltando", async () => {
    // Sem a guarda explicita de isFinished, o caminho de excecao devolve o MESMO
    // codigo de erro — entao o teste acima passa dos dois jeitos e nao prende
    // nada. O que muda e a frase que a pessoa le: com a guarda, "o draft ainda
    // nao acabou"; sem ela, "assento 3 nao tem carta em mid", que e verdade e
    // nao ajuda ninguem. Este teste prende a frase.
    const { hub } = await salaComDraftPelaMetade();
    const saida = await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });
    const erro = saida.find((o) => o.message.type === "error")!;
    expect(erro.message).toMatchObject({ message: expect.stringContaining("draft") });
    expect(erro.message).not.toMatchObject({ message: expect.stringContaining("assento") });
  });

  it("comecar o torneio ja roda a primeira onda", async () => {
    const { hub } = await salaComDraftPronto();
    await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });
    expect(hub.room.phase).toBe("tournament");
    expect(hub.room.tournament!.wave).toBe(1);
    for (const s of ["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"] as SlotId[]) {
      expect(hub.room.tournament!.bracket.slots[s]!.series.status).toBe("complete");
    }
  });

  it("a timeline vai enderecada, nunca to: 'all' (D-27)", async () => {
    const { hub } = await salaComDraftPronto();
    const saida = await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });
    const games = saida.filter((o) => o.message.type === "games");
    expect(games.length).toBeGreaterThan(0);
    for (const g of games) expect(g.to).not.toBe("all");
  });

  it("nenhuma timeline entra no roomState (D-27)", async () => {
    const { hub } = await salaComDraftPronto();
    const saida = await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });
    const estado = saida.find((o) => o.message.type === "roomState")!;
    // Medido em 2026-08-25: 24.335 bytes (2 humanos + 6 bots, onda 1 rodada,
    // base sintetica de teste). O `draft` do fio continua no roomState mesmo
    // em fase "tournament" (os 8 rosters completos do draft, D-19) -- e o
    // maior contribuinte de tamanho aqui, nao o torneio em si. Conferido
    // tambem contra a base REAL (public/players.json, 20 cartas): cada carta
    // real pesa uns 15-20% a mais que a sintetica (displayName/personId mais
    // longos), o que projeta uns 28-29 KB reais -- ainda bem abaixo do teto
    // de 60 KB chutado no plano. Teto aqui com folga confortavel sobre o
    // medido, para nao disparar por um campo novo pequeno no fio, mas ainda
    // apertado o bastante para pegar um vazamento de verdade (uma timeline
    // inteira pesa centenas de KB a MB, nao dezenas).
    expect(JSON.stringify(estado.message).length).toBeLessThan(50_000);
  });

  it("cada humano ja comeca acompanhando a serie do proprio time", async () => {
    const { hub, clientIds } = await salaComDraftPronto();
    await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });
    const t = hub.room.tournament!;
    for (const c of clientIds) {
      const slotId = t.watching[c]!;
      const serie = t.bracket.slots[slotId]!.series;
      const meuTime = teamIdOfSeat(t.seatClientIds.indexOf(c));
      expect([serie.teamAId, serie.teamBId]).toContain(meuTime);
    }
  });

  it("o relogio do draft e desarmado ao entrar no torneio", async () => {
    const { hub, agendados } = await salaComDraftPronto();
    await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });
    expect(agendados.pendentes()).toBe(0);
  });

  it("comecar duas vezes nao remonta o torneio", async () => {
    const { hub } = await salaComDraftPronto();
    await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });
    const antes = hub.room.tournament;
    const saida = await hub.handle("s1", { type: "startTournament", chaosLevel: 0.9 });
    expect(erroDe(saida)).toBe("in_progress");
    expect(hub.room.tournament).toBe(antes);
  });
});

// -----------------------------------------------------------------------------
// prontos, barreira, espectador e sincronia (Tarefa 8)
// -----------------------------------------------------------------------------

/**
 * Sala com o torneio ja comecado e a primeira onda rodada: 2 humanos (host e
 * convidado) e 6 bots. Reaproveita salaComDraftPronto — mesma convencao de
 * sockets (s1 = host = c0, s2 = convidado = c1).
 */
async function salaEmTorneio() {
  const { hub, clientIds } = await salaComDraftPronto();
  await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });
  return { hub, sockets: { host: "s1", convidado: "s2" }, clientIds };
}

/**
 * Roda ondas ate coroar o campeao, so com forceAdvance do host. Com a semente
 * fixa de salaEmTorneio() os dois humanos (assento-0 e assento-1) sao
 * eliminados bem antes da Grande Final -- achado ao escrever os testes desta
 * tarefa, rodando a trilha wave a wave. A urna abre no meio do caminho; como
 * forceAdvance com urna aberta apura com o que tem (zero votos = empate 0 a
 * 0 = "continuar", D-33) em vez de travar, o MESMO forceAdvance repetido
 * atravessa a urna sozinho -- nao precisa de nenhum `vote` explicito aqui.
 */
async function ateCampeaoCoroado(hub: RoomHub, sockets: { host: string; convidado: string }) {
  for (let i = 0; i < TOTAL_WAVES + 2; i++) {
    if (hub.room.phase === "finished") return;
    await iniciarRodadaPronta(hub, sockets.host);
  }
}

async function iniciarRodadaPronta(hub: RoomHub, host: string) {
  if (hub.room.phase !== "finished" && hub.room.tournament?.vote === null) {
    for (let i = 0; i < hub.room.players.length; i++) {
      await hub.handle(`s${i + 1}`, { type: "ready", ready: true });
    }
  }
  return hub.handle(host, { type: "forceAdvance" });
}

describe("ready e a barreira", () => {
  it("todos confirmam, os resultados aparecem e o host inicia a próxima rodada", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "ready", ready: true });
    expect(hub.room.tournament!.wave).toBe(1);
    await hub.handle(sockets.convidado, { type: "ready", ready: true });
    expect(hub.room.tournament!.wave).toBe(1);
    expect(hub.room.tournament!.resultadosLiberados).toBe(true);
    await hub.handle(sockets.host, { type: "forceAdvance" });
    expect(hub.room.tournament!.wave).toBe(2);
  });

  it("desmarcar pronto segura a onda", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "ready", ready: true });
    await hub.handle(sockets.host, { type: "ready", ready: false });
    await hub.handle(sockets.convidado, { type: "ready", ready: true });
    expect(hub.room.tournament!.wave).toBe(1);
  });

  it("celular desconectado continua sendo esperado", async () => {
    const { hub, sockets, clientIds } = await salaEmTorneio();
    hub.disconnect(sockets.convidado);
    await hub.handle(sockets.host, { type: "ready", ready: true });
    const bloqueado = await hub.handle(sockets.host, { type: "forceAdvance" });
    expect(erroDe(bloqueado)).toBe("bad_message");
    expect(hub.room.tournament!.wave).toBe(1);
    expect(hub.room.tournament!.resultadosLiberados).toBe(false);
    await hub.handle("s9", helloDeVolta(hub, clientIds[1]!));
    await hub.handle("s9", { type: "ready", ready: true });
    expect(hub.room.tournament!.resultadosLiberados).toBe(true);
    expect(hub.room.tournament!.wave).toBe(1);
    await hub.handle(sockets.host, { type: "forceAdvance" });
    expect(hub.room.tournament!.wave).toBe(2);
    expect(hub.room.tournament!.ready).toEqual([]);
    expect(hub.room.tournament!.resultadosLiberados).toBe(false);
  });

  it("readyTotal mantém os participantes mesmo após uma desconexão", async () => {
    // O host marca pronto e cai ANTES do convidado marcar. `t.ready` continua
    // com o host — o disconnect nunca limpa essa lista, so a lista de quem
    // esta conectado — mas a barreira agora so espera o convidado. Deduzir o
    // total como `ready.length + readyFaltam` daria 1 + 1 = 2, uma sala de
    // dois humanos que nunca existiu depois que o host caiu.
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "ready", ready: true });
    const saida = hub.disconnect(sockets.host);

    const tournament = estadoDe(saida).state.tournament!;
    expect(tournament.ready).toHaveLength(1); // o host continua na lista, mesmo caido
    expect(tournament.readyFaltam).toBe(1); // so falta o convidado
    expect(tournament.readyTotal).toBe(2); // a barreira so espera 1, nao ready.length + readyFaltam (2)
  });
});

describe("a barreira se reavalia quando alguem cai (revisao da Tarefa 8)", () => {
  it("desconectar quem falta não libera resultados nem avança a rodada", async () => {
    // Ordem que importa aqui, ao contrario do teste "quem desconecta deixa de
    // ser esperado" acima: la o convidado ja tinha caido ANTES do host clicar
    // pronto, entao o proprio #handleReady fechava a barreira. Aqui o host ja
    // esta pronto e o convidado E quem falta -- o fechamento so pode vir do
    // proprio disconnect, sem handle() nenhum depois dele.
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "ready", ready: true });
    expect(hub.room.tournament!.wave).toBe(1);

    const saida = hub.disconnect(sockets.convidado);

    expect(hub.room.tournament!.wave).toBe(1);
    expect(saida.some((o) => o.message.type === "roomState")).toBe(true);
  });

  // M-2 da revisao final: a quinta sala presa. O `disconnect` reavalia a
  // barreira; o `hello` nao reavaliava. Quem muda o conjunto de conectados tem
  // que reavaliar -- e voltar muda esse conjunto tanto quanto cair.
  it("reconectar sem o Ready do outro participante não avança a rodada", async () => {
    const { hub, sockets, clientIds } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "ready", ready: true });
    expect(hub.room.tournament!.wave).toBe(1);

    // Com `membros = []` a barreira devolve false por construcao (sala vazia
    // nao corre o bracket sozinha) -- e certo, e e essa a janela.
    hub.disconnect(sockets.host);
    hub.disconnect(sockets.convidado);
    expect(hub.room.tournament!.wave).toBe(1);

    const saida = await hub.handle("s9", helloDeVolta(hub, clientIds[0]!));

    expect(hub.room.tournament!.wave).toBe(1);
    // Nenhum roomState desta rodada pode sair mostrando a onda velha: a tela
    // que ficava presa nao dava sinal nenhum (readyFaltam era 0, entao o
    // "esperando N de M" nem era desenhado).
    const estados = saida.filter((o) => o.message.type === "roomState");
    expect(estados.length).toBeGreaterThan(0);
    for (const e of estados) {
      const msg = e.message as Extract<ServerMessage, { type: "roomState" }>;
      expect(msg.state.tournament!.wave).toBe(1);
    }
  });

  it("voltar sem a barreira fechada nao anda onda nenhuma (contraprova)", async () => {
    const { hub, sockets, clientIds } = await salaEmTorneio();
    hub.disconnect(sockets.host);

    await hub.handle("s9", helloDeVolta(hub, clientIds[0]!));

    expect(hub.room.tournament!.wave).toBe(1);
  });

  it("desconectar sem ninguem pronto ainda nao fecha a barreira sozinho", async () => {
    // Contraprova: o disconnect nao forca a onda incondicionalmente, so
    // quando a barreira JA estava satisfeita por quem sobrou.
    const { hub, sockets } = await salaEmTorneio();
    hub.disconnect(sockets.convidado);
    expect(hub.room.tournament!.wave).toBe(1);
  });
});

describe("forceAdvance", () => {
  it("nem o host pode iniciar a rodada antes de todos confirmarem", async () => {
    const { hub, sockets } = await salaEmTorneio();
    const saida = await hub.handle(sockets.host, { type: "forceAdvance" });
    expect(erroDe(saida)).toBe("bad_message");
    expect(hub.room.tournament!.wave).toBe(1);
  });

  it("convidado nao forca", async () => {
    const { hub, sockets } = await salaEmTorneio();
    const saida = await hub.handle(sockets.convidado, { type: "forceAdvance" });
    expect(erroDe(saida)).toBe("not_host");
    expect(hub.room.tournament!.wave).toBe(1);
  });
});

describe("setWatch", () => {
  it("setWatch de serie nao jogada volta erro e nao muda nada", async () => {
    const { hub, sockets } = await salaEmTorneio();
    const antes = hub.room.tournament;
    const saida = await hub.handle(sockets.convidado, { type: "setWatch", slotId: "GF" });
    expect(erroDe(saida)).toBe("serie_desconhecida");
    expect(hub.room.tournament).toBe(antes);
  });

  it("setWatch entrega a timeline so para quem pediu (D-27)", async () => {
    const { hub, sockets } = await salaEmTorneio();
    const saida = await hub.handle(sockets.convidado, { type: "setWatch", slotId: "UB_QF_1" });
    const games = saida.filter((o) => o.message.type === "games");
    expect(games).toHaveLength(1);
    expect(games[0]!.to).toEqual([sockets.convidado]);
  });

  it("uma serie antiga continua assistivel ondas depois (D-32)", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await iniciarRodadaPronta(hub, sockets.host);
    await iniciarRodadaPronta(hub, sockets.host);
    const saida = await hub.handle(sockets.convidado, { type: "setWatch", slotId: "UB_QF_1" });
    expect(erroDe(saida)).toBeNull();
    expect(saida.some((o) => o.message.type === "games")).toBe(true);
  });

  it("setWatch reenvia a timeline mesmo pedindo a MESMA serie de novo -- contraste com o ready abaixo", async () => {
    // O pedido explicito sempre manda: diferente do #tournamentOutbound (que
    // so reenvia quem MUDOU de serie), o #handleSetWatch monta a `games` na
    // hora, incondicionalmente -- e assim que deve continuar sendo.
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.convidado, { type: "setWatch", slotId: "UB_QF_1" });
    const saida = await hub.handle(sockets.convidado, { type: "setWatch", slotId: "UB_QF_1" });
    expect(saida.some((o) => o.message.type === "games")).toBe(true);
  });
});

describe("a timeline so e reenviada para quem mudou de serie (revisao da Tarefa 8)", () => {
  it("um ready que nao fecha a barreira nao reenvia timeline nenhuma", async () => {
    // Achado do revisor: #tournamentOutbound mandava `games` para todo mundo
    // assistindo, toda vez que era chamado -- inclusive quando ninguem mudou
    // de serie. Com 2 humanos, um unico ready nao fecha a barreira (falta o
    // outro): watching fica exatamente igual, entao nao deveria sair timeline
    // nenhuma, so o roomState.
    const { hub, sockets } = await salaEmTorneio();
    const saida = await hub.handle(sockets.host, { type: "ready", ready: true });
    expect(saida.some((o) => o.message.type === "roomState")).toBe(true);
    expect(saida.some((o) => o.message.type === "games")).toBe(false);
  });

  it("desmarcar pronto tambem nao reenvia nada -- watching nao mudou", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "ready", ready: true });
    const saida = await hub.handle(sockets.host, { type: "ready", ready: false });
    expect(saida.some((o) => o.message.type === "games")).toBe(false);
  });

  it("quando a barreira fecha e o autoWatch troca a serie de alguem, a timeline nova chega", async () => {
    // O caso positivo: a onda que de fato muda quem assiste o que ainda tem
    // que reenviar -- o diff nao pode virar um "nunca mais manda nada".
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "ready", ready: true });
    const pronto = await hub.handle(sockets.convidado, { type: "ready", ready: true });
    expect(pronto.some(o => o.message.type === "games")).toBe(false);
    const saida = await hub.handle(sockets.host, { type: "forceAdvance" });
    expect(hub.room.tournament!.wave).toBe(2);
    expect(saida.some((o) => o.message.type === "games")).toBe(true);
  });
});

describe("modo sincronizado (D-28)", () => {
  it("sincronizar arrasta todo mundo para a serie do host", async () => {
    const { hub, sockets, clientIds } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
    const t = hub.room.tournament!;
    expect(t.sync!.slotId).toBe("UB_QF_1");
    for (const c of clientIds) expect(t.watching[c]).toBe("UB_QF_1");
  });

  it("convidado nao liga sincronia", async () => {
    const { hub, sockets } = await salaEmTorneio();
    const saida = await hub.handle(sockets.convidado, { type: "setSyncMode", enabled: true });
    expect(erroDe(saida)).toBe("not_host");
  });

  it("com a sincronia ligada, o convidado NAO escolhe serie -- o servidor recusa (D-28, G-1 da revisao final)", async () => {
    // A tela do convidado ja afirmava "a escolha de serie esta travada para
    // todo mundo" (BracketScreen.tsx), mas o servidor aceitava o setWatch dele:
    // `watching` virava {host: UB_QF_1, convidado: UB_QF_2} com `sync` ainda em
    // UB_QF_1. Dai o `indiceAtual` da tela do fugitivo passava a ler o
    // sync.gameIndex do HOST indexando a serie DELE -- e num indice
    // inexistente a tela travava em "Carregando a partida..." sem saida.
    // O servidor e a autoridade: e ele que tem que dizer nao.
    const { hub, sockets, clientIds } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });

    const saida = await hub.handle(sockets.convidado, { type: "setWatch", slotId: "UB_QF_2" });

    expect(erroDe(saida)).toBe("not_host");
    expect(hub.room.tournament!.watching[clientIds[1]!]).toBe("UB_QF_1");
    expect(hub.room.tournament!.sync!.slotId).toBe("UB_QF_1");
    // Nem a timeline da serie recusada pode vazar junto do erro.
    expect(saida.some((o) => o.message.type === "games")).toBe(false);
  });

  it("com a sincronia ligada, o host continua escolhendo -- a sincronia e o interruptor dele", async () => {
    // Contraste do teste acima: a recusa e de NAO-HOST, nao de todo mundo. Sem
    // isto, uma correcao que barrasse qualquer setWatch com `sync` ativo
    // passaria igual e tiraria do host a unica mao no leme.
    const { hub, sockets, clientIds } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });

    const saida = await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_2" });

    expect(erroDe(saida)).toBeNull();
    expect(hub.room.tournament!.watching[clientIds[0]!]).toBe("UB_QF_2");
  });

  it("com a sincronia ligada, o setWatch do host MOVE a sincronia -- todo mundo ve o que o host ve", async () => {
    // Sincronia so tem um significado: a sala inteira assiste ao que o host
    // assiste. Aceitar o setWatch do host e deixar `sync` para tras criava a
    // assimetria esquisita de ele estar vendo uma serie e IMPONDO outra aos
    // sete restantes -- o mesmo estado incoerente da G-1, entrando por outra
    // porta. Recusar seria a resposta errada: a resposta e obedecer.
    const { hub, sockets, clientIds } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });

    // Tira o gameIndex do zero para provar que ele volta -- o jogo 2 da serie
    // velha nao significa nada na serie nova (foi assim que a tela travou em
    // "Carregando a partida..." na sonda da G-1).
    await hub.handle(sockets.host, { type: "playbackControl", action: "proximoJogo" });
    expect(hub.room.tournament!.sync!.gameIndex).toBeGreaterThan(0);

    const saida = await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_2" });

    expect(erroDe(saida)).toBeNull();
    const t = hub.room.tournament!;
    expect(t.sync!.slotId).toBe("UB_QF_2");
    expect(t.sync!.gameIndex).toBe(0);
    for (const c of clientIds) expect(t.watching[c]).toBe("UB_QF_2");
  });

  it("a timeline da serie nova chega a quem foi arrastado junto, enderecada (D-27)", async () => {
    // Nao basta reapontar o `watching` de todo mundo: sem a mensagem `games`,
    // as outras telas ficariam com o chaveamento novo e partida nenhuma.
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });

    const saida = await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_2" });

    const paraConvidado = saida.filter(
      (o) => o.message.type === "games" && o.to !== "all" && o.to.includes(sockets.convidado)
    );
    expect(paraConvidado).toHaveLength(1);
    expect(paraConvidado[0]!.message).toMatchObject({ type: "games", slotId: "UB_QF_2" });
    for (const g of saida.filter((o) => o.message.type === "games")) expect(g.to).not.toBe("all");
  });

  it("sem sincronia, o setWatch do host nao arrasta ninguem nem inventa sincronia (contraprova)", async () => {
    const { hub, sockets, clientIds } = await salaEmTorneio();
    await hub.handle(sockets.convidado, { type: "setWatch", slotId: "UB_QF_1" });

    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_2" });

    expect(hub.room.tournament!.sync).toBeNull();
    expect(hub.room.tournament!.watching[clientIds[1]!]).toBe("UB_QF_1");
  });

  it("sem sincronia, o convidado escolhe a serie que quiser (contraprova)", async () => {
    const { hub, sockets, clientIds } = await salaEmTorneio();
    const saida = await hub.handle(sockets.convidado, { type: "setWatch", slotId: "UB_QF_2" });
    expect(erroDe(saida)).toBeNull();
    expect(hub.room.tournament!.watching[clientIds[1]!]).toBe("UB_QF_2");
  });

  /**
   * Sala restaurada de snapshot com o chaosLevel TROCADO por baixo: as
   * timelines foram podadas na gravacao (D-25) e a regeneracao nao bate mais
   * com `timelineHashes`, entao `timelineOf` reprova QUALQUER serie (D-26).
   * E o unico jeito honesto de fazer o #gamesOutbound devolver null sem mexer
   * no hub -- mesma tecnica do teste de ponta a ponta em
   * server/tournament.integration.test.ts.
   */
  async function salaComGravacaoIrrecuperavel() {
    const { hub, clientIds } = await salaEmTorneio();
    const t = hub.room.tournament!;
    const salva: Room = {
      ...hub.room,
      players: hub.room.players.map((p) => ({ ...p, connected: false })),
      tournament: {
        ...t,
        chaosLevel: t.chaosLevel > 0.5 ? 0 : 1,
        bracket: stripTimelines(t.bracket),
      },
    };

    const restaurado = new RoomHub(salva, BASE, deps());
    restaurado.attachSender(() => {});
    await restaurado.handle("s1", helloDeVolta(restaurado, clientIds[0]!));
    await restaurado.handle("s2", helloDeVolta(restaurado, clientIds[1]!));
    return { hub: restaurado, sockets: { host: "s1", convidado: "s2" }, clientIds };
  }

  /** Uma serie ja jogada da onda 1, diferente da que a pessoa ja acompanha. */
  function outraSerieJogada(exceto: SlotId): SlotId {
    const daOnda1: SlotId[] = ["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"];
    return daOnda1.find((s) => s !== exceto)!;
  }

  it("gravacao que nao regenera: com sincronia, nao move a sincronia nem reaponta ninguem", async () => {
    // A ordem estava invertida desde o plano: o handler comitava a escolha e
    // SO DEPOIS conferia se a gravacao regenera. Com a sincronia movendo todo
    // mundo junto, isso passou a arrastar os oito para uma tela sem partida
    // por causa de um pedido que o servidor ja sabia que ia falhar. Estado
    // nenhum pode mudar antes da conferencia.
    const { hub, sockets } = await salaComGravacaoIrrecuperavel();
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });

    const syncAntes = hub.room.tournament!.sync!;
    const watchingAntes = { ...hub.room.tournament!.watching };
    const alvo = outraSerieJogada(syncAntes.slotId);

    const saida = await hub.handle(sockets.host, { type: "setWatch", slotId: alvo });

    expect(erroDe(saida)).toBe("gravacao_indisponivel");
    expect(hub.room.tournament!.sync).toEqual(syncAntes);
    expect(hub.room.tournament!.watching).toEqual(watchingAntes);
    // So o erro sai, e so para quem pediu: nem timeline, nem roomState
    // anunciando uma mudanca que nao aconteceu.
    expect(saida).toHaveLength(1);
    expect(saida[0]!.to).toEqual([sockets.host]);
  });

  it("gravacao que nao regenera: sem sincronia, quem pediu recebe o erro e nao muda de serie", async () => {
    const { hub, sockets, clientIds } = await salaComGravacaoIrrecuperavel();
    expect(hub.room.tournament!.sync).toBeNull();

    const antes = hub.room.tournament!.watching[clientIds[1]!]!;
    const alvo = outraSerieJogada(antes);

    const saida = await hub.handle(sockets.convidado, { type: "setWatch", slotId: alvo });

    expect(erroDe(saida)).toBe("gravacao_indisponivel");
    expect(hub.room.tournament!.watching[clientIds[1]!]).toBe(antes);
    expect(saida).toHaveLength(1);
    expect(saida[0]!.to).toEqual([sockets.convidado]);
  });

  it("a timeline de quem entra em sincronia sai enderecada, nunca to: 'all'", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    const saida = await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
    const games = saida.filter((o) => o.message.type === "games");
    expect(games.length).toBeGreaterThan(0);
    for (const g of games) expect(g.to).not.toBe("all");
  });

  it("desligar a sincronia devolve sync para null", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: false });
    expect(hub.room.tournament!.sync).toBeNull();
  });

  it("reiniciar muda o estado — senao o botao nao faz nada", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
    const antes = hub.room.tournament!.sync!.restartCount;
    await hub.handle(sockets.host, { type: "playbackControl", action: "reiniciar" });
    expect(hub.room.tournament!.sync!.restartCount).toBe(antes + 1);
  });

  describe("Fase 3 — selecao de campeoes sincronizada (sync.stage)", () => {
    it("ligar a sincronia comeca sempre em 'select'", async () => {
      const { hub, sockets } = await salaEmTorneio();
      await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
      await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
      expect(hub.room.tournament!.sync!.stage).toBe("select");
    });

    it("pularSelecao (host) adianta a etapa para 'playback', pra sala inteira de uma vez", async () => {
      const { hub, sockets } = await salaEmTorneio();
      await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
      await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
      const saida = await hub.handle(sockets.host, { type: "playbackControl", action: "pularSelecao" });
      expect(erroDe(saida)).toBeNull();
      expect(hub.room.tournament!.sync!.stage).toBe("playback");
    });

    it("convidado nao pode pularSelecao -- so o host adianta a introducao (achado do usuario: ninguem pula sozinho)", async () => {
      const { hub, sockets } = await salaEmTorneio();
      await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
      await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
      const saida = await hub.handle(sockets.convidado, { type: "playbackControl", action: "pularSelecao" });
      expect(erroDe(saida)).toBe("not_host");
      expect(hub.room.tournament!.sync!.stage).toBe("select");
    });

    it("proximoJogo reseta a etapa para 'select' -- o jogo novo ganha a propria introducao", async () => {
      const { hub, sockets } = await salaEmTorneio();
      await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
      await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
      await hub.handle(sockets.host, { type: "playbackControl", action: "pularSelecao" });
      await hub.handle(sockets.host, { type: "playbackControl", action: "proximoJogo" });
      expect(hub.room.tournament!.sync!.stage).toBe("select");
    });

    it("jogoAnterior tambem reseta a etapa para 'select'", async () => {
      const { hub, sockets } = await salaEmTorneio();
      await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
      await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
      await hub.handle(sockets.host, { type: "playbackControl", action: "proximoJogo" });
      await hub.handle(sockets.host, { type: "playbackControl", action: "pularSelecao" });
      await hub.handle(sockets.host, { type: "playbackControl", action: "jogoAnterior" });
      expect(hub.room.tournament!.sync!.stage).toBe("select");
    });

    it("reiniciar tambem reseta a etapa para 'select' -- e o mesmo jogo, mas do zero", async () => {
      const { hub, sockets } = await salaEmTorneio();
      await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
      await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
      await hub.handle(sockets.host, { type: "playbackControl", action: "pularSelecao" });
      await hub.handle(sockets.host, { type: "playbackControl", action: "reiniciar" });
      expect(hub.room.tournament!.sync!.stage).toBe("select");
    });

    it("o host trocando de serie em sincronia tambem reseta a etapa para 'select'", async () => {
      const { hub, sockets } = await salaEmTorneio();
      await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
      await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
      await hub.handle(sockets.host, { type: "playbackControl", action: "pularSelecao" });
      await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_2" });
      expect(hub.room.tournament!.sync!.stage).toBe("select");
    });
  });

  it("convidado nao controla a exibicao, nem com sincronia ligada", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
    const saida = await hub.handle(sockets.convidado, {
      type: "playbackControl",
      action: "reiniciar",
    });
    expect(erroDe(saida)).toBe("not_host");
    expect(hub.room.tournament!.sync!.restartCount).toBe(0);
  });

  it("playbackControl sem sincronia ativa nao muda nada (o cliente nem deveria mandar)", async () => {
    const { hub, sockets } = await salaEmTorneio();
    const antes = hub.room.tournament;
    const saida = await hub.handle(sockets.host, { type: "playbackControl", action: "reiniciar" });
    expect(saida).toEqual([]);
    expect(hub.room.tournament).toBe(antes);
  });

  it("proximoJogo nao passa do numero de jogos da serie", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
    const totalJogos = hub.room.tournament!.bracket.slots.UB_QF_1!.series.games.length;
    for (let i = 0; i < totalJogos + 3; i++) {
      await hub.handle(sockets.host, { type: "playbackControl", action: "proximoJogo" });
    }
    expect(hub.room.tournament!.sync!.gameIndex).toBe(totalJogos - 1);
  });

  it("jogoAnterior nao passa de zero", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
    await hub.handle(sockets.host, { type: "playbackControl", action: "jogoAnterior" });
    expect(hub.room.tournament!.sync!.gameIndex).toBe(0);
  });

  it("voltarAoChaveamento desliga a sincronia -- sync vira null", async () => {
    // Decisao da revisao: um `sync` vivo apontando pra mesma serie devolveria
    // a pessoa pra ela no quadro seguinte (o cliente le "sync != null" como
    // "ainda estamos assistindo juntos") -- o botao nao faria nada. `sync`
    // nao-nulo passa a significar so uma coisa: todo mundo assistindo o
    // mesmo jogo agora.
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
    await hub.handle(sockets.host, { type: "playbackControl", action: "proximoJogo" });
    await hub.handle(sockets.host, { type: "playbackControl", action: "voltarAoChaveamento" });
    expect(hub.room.tournament!.sync).toBeNull();
  });

  it("depois de voltar ao chaveamento, um playbackControl que chegue nao faz nada", async () => {
    // A consequencia do teste acima: sem sincronia ativa (sync === null), o
    // handler nao tem o que controlar e ignora a mensagem de proposito (ver
    // comentario em #handlePlaybackControl) -- nao muda o torneio nem manda
    // nada de volta.
    const { hub, sockets } = await salaEmTorneio();
    await hub.handle(sockets.host, { type: "setWatch", slotId: "UB_QF_1" });
    await hub.handle(sockets.host, { type: "setSyncMode", enabled: true });
    await hub.handle(sockets.host, { type: "playbackControl", action: "voltarAoChaveamento" });
    const antes = hub.room.tournament;

    const saida = await hub.handle(sockets.host, { type: "playbackControl", action: "reiniciar" });

    expect(saida).toEqual([]);
    expect(hub.room.tournament).toBe(antes);
  });
});

describe("torneio termina quando ha campeao", () => {
  it("a fase vai para finished quando a barreira coroa um campeao", async () => {
    const { hub, sockets } = await salaEmTorneio();
    // TOTAL_WAVES = 6: a onda 1 ja rodou no startTournament. ateCampeaoCoroado
    // forca as ondas que faltam -- se a urna abrir no meio do caminho,
    // forceAdvance a apura sozinho (D-33).
    await ateCampeaoCoroado(hub, sockets);
    expect(hub.room.tournament!.bracket.championId).not.toBeNull();
    expect(hub.room.phase).toBe("finished");
  });
});

describe("reconexao no meio do torneio reenvia a timeline (gap deixado pela Tarefa 7)", () => {
  it("quem estava assistindo uma serie recebe de volta o chaveamento E a timeline", async () => {
    const { hub, sockets, clientIds } = await salaEmTorneio();
    await hub.handle(sockets.convidado, { type: "setWatch", slotId: "UB_QF_1" });
    const convidadoId = clientIds[1]!;

    hub.disconnect(sockets.convidado);
    const saida = await hub.handle("s9", helloDeVolta(hub, convidadoId));

    const estado = estadoDe(saida);
    expect(estado.state.tournament).not.toBeNull();

    const games = saida.filter((o) => o.message.type === "games");
    expect(games).toHaveLength(1);
    expect(games[0]!.to).toEqual(["s9"]);
    expect(games[0]!.message).toMatchObject({ type: "games", slotId: "UB_QF_1" });
  });

  it("reconectar antes do torneio comecar nao manda games nenhuma", async () => {
    // Contraprova: sem torneio (t === null), o novo trecho do #handleHello nao
    // pode explodir nem inventar uma mensagem games do nada.
    const { hub } = await salaComDraftPelaMetade();
    const dono = currentSeat(hub.room.draft!)!.clientId!;
    const socket = socketDaVez(hub);
    hub.disconnect(socket);
    const saida = await hub.handle("s9", helloDeVolta(hub, dono));
    expect(saida.some((o) => o.message.type === "games")).toBe(false);
  });
});

describe("cache da timeline regenerada em memoria (revisor: ~33ms por serie sem cache)", () => {
  it("pedir a mesma serie duas vezes regenera uma vez -- a segunda bate no cache", async () => {
    const { hub, clientIds } = await salaEmTorneio();
    const antes = hub.room.tournament!;

    // Uma serie da onda 1 que nenhum humano esta assistindo (autoWatch so
    // aponta cada humano para a serie do proprio time): assim a reconexao
    // abaixo, que reenvia a serie de quem ja assistia algo, nao interfere no
    // experimento -- a primeira regeneracao DESTA serie especifica so pode
    // vir do setWatch explicito do teste.
    const outraSerie = (["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"] as SlotId[]).find(
      (s) => !Object.values(antes.watching).includes(s)
    )!;

    // Simula uma sala restaurada de snapshot: a persistencia poda os eventos
    // na escrita (D-25), entao um torneio recem-carregado do disco chega sem
    // timeline nenhuma em memoria -- exatamente o estado que faz o
    // timelineOf regenerar.
    const salva: Room = {
      ...hub.room,
      players: hub.room.players.map((p) => ({ ...p, connected: false })),
      tournament: { ...antes, bracket: stripTimelines(antes.bracket) },
    };
    expect(hasTimelines(salva.tournament!.bracket.slots[outraSerie]!.series.games)).toBe(false);

    const restaurado = new RoomHub(salva, BASE, deps());
    restaurado.attachSender(() => {});
    await restaurado.handle("x1", helloDeVolta(restaurado, clientIds[0]!));

    const primeira = await restaurado.handle("x1", { type: "setWatch", slotId: outraSerie });
    const jogosPrimeira = (
      primeira.find((o) => o.message.type === "games")!.message as Extract<
        ServerMessage,
        { type: "games" }
      >
    ).games;

    // A regeneracao sempre monta um array novo (`refeitos`, em replay.ts). O
    // cache SO existe se esse array voltar gravado no bracket -- entao provar
    // que a resposta seguinte usa a MESMA referencia prova que ela nao
    // regenerou nada. Nao depende de cronometro nenhum, so de identidade de
    // objeto.
    expect(hasTimelines(restaurado.room.tournament!.bracket.slots[outraSerie]!.series.games)).toBe(
      true
    );
    expect(restaurado.room.tournament!.bracket.slots[outraSerie]!.series.games).toBe(jogosPrimeira);

    const segunda = await restaurado.handle("x1", { type: "setWatch", slotId: outraSerie });
    const jogosSegunda = (
      segunda.find((o) => o.message.type === "games")!.message as Extract<
        ServerMessage,
        { type: "games" }
      >
    ).games;

    expect(jogosSegunda).toBe(jogosPrimeira);
  });
});

describe("sala restaurada refaz as timelines na subida (destaques contam todos os jogos)", () => {
  it("toda serie jogada volta com timeline em memoria, sem ninguem pedir", async () => {
    const { hub } = await salaEmTorneio();
    const antes = hub.room.tournament!;
    const salva: Room = {
      ...hub.room,
      players: hub.room.players.map((p) => ({ ...p, connected: false })),
      tournament: { ...antes, bracket: stripTimelines(antes.bracket) },
    };
    const restaurado = new RoomHub(salva, BASE, deps());
    for (const slot of Object.values(restaurado.room.tournament!.bracket.slots)) {
      if (slot.series.games.length > 0) expect(hasTimelines(slot.series.games)).toBe(true);
    }
  });
});

// -----------------------------------------------------------------------------
// votacao e fim do torneio (Tarefa 9)
// -----------------------------------------------------------------------------

/**
 * Tenta UMA semente: monta a sala igual a salaComDraftPronto (2 humanos, c0 e
 * c1), acrescenta um terceiro jogador ("fora") que entrou na sala mas nao tem
 * assento nenhum no torneio -- so pra provar que quem nao tem time nao vota --
 * e roda ondas via forceAdvance ate achar `allHumansEliminated` ou o campeao
 * ser coroado primeiro. Devolve null quando o campeao chega antes: quem chama
 * tenta a proxima semente.
 *
 * Tambem devolve null quando os humanos caem cedo demais para o teste: o voto
 * "continuar" roda a proxima onda na hora (hub.#aplicarUrna), entao a semente
 * so serve se ainda sobrarem pelo menos duas ondas (`t.wave <= TOTAL_WAVES - 2`).
 * Com uma so, o "continuar" roda a final e fecha o torneio, e os testes que
 * esperam a sala seguir em "tournament" nao conseguem medir o que querem. Isso
 * apareceu quando o motor novo (spec 2026-10-02) mudou as trajetorias.
 */
async function tentarSalaComHumanosEliminados(semente: string) {
  const relogio = relogioFalso();
  const clientIds = ["c0", "c1"];

  let draft = createDraft({
    players: BASE,
    humans: clientIds.map((clientId, i) => ({ clientId, teamName: `Time ${i}` })),
    seed: semente,
    now: 0,
    budget: () => null,
  });
  while (!isFinished(draft)) draft = autoPick(draft, BASE, 0, () => null);

  const room: Room = {
    phase: "draft",
    players: [
      ...clientIds.map((clientId, i) => ({
        clientId,
        publicId: `pub${i}`,
        nickname: `p${i}`,
        teamName: `Time ${i}`,
        isHost: i === 0,
        connected: false,
        spectator: false,
      })),
      {
        clientId: "fora",
        publicId: "pubFora",
        nickname: "fora",
        teamName: "Sem Time",
        isHost: false,
        connected: false,
        spectator: false,
      },
    ],
    settings: { turnSeconds: 60 },
    draft,
    tournament: null,
    hostToken: "t",
  };

  const hub = new RoomHub(room, BASE, deps({ now: relogio.now, schedule: relogio.schedule }));
  hub.attachSender(() => {});

  for (let i = 0; i < clientIds.length; i++) {
    await hub.handle(`s${i + 1}`, helloDeVolta(hub, clientIds[i]!));
  }
  const socketDeFora = "s9";
  await hub.handle(socketDeFora, helloDeVolta(hub, "fora"));

  await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });

  const sockets = { host: "s1", convidado: "s2" };
  for (let onda = 1; onda < TOTAL_WAVES; onda++) {
    const t = hub.room.tournament!;
    if (allHumansEliminated(t)) {
      return t.wave <= TOTAL_WAVES - 2 ? { hub, sockets, clientIds, socketDeFora } : null;
    }
    if (t.bracket.championId !== null) return null;
    await iniciarRodadaPronta(hub, sockets.host);
  }
  const t = hub.room.tournament!;
  // Mesma regra do laco: campeao coroado na ultima onda fecha o torneio e a urna
  // nao chega a abrir (hub.#aposOnda), e com menos de duas ondas restantes o
  // "continuar" fecha o torneio na hora, entao essa semente nao serve ao teste.
  if (t.bracket.championId === null && allHumansEliminated(t) && t.wave <= TOTAL_WAVES - 2) {
    return { hub, sockets, clientIds, socketDeFora };
  }
  return null;
}

/**
 * Sala em torneio com todo humano eliminado -- procurada por semente, porque
 * quem e campeao (e se os humanos caem antes disso) depende dela. Falha com
 * mensagem clara se nenhuma semente do pool chegar la, para nao estourar num
 * undefined tres testes depois quando o torneio da sorte de coroar o campeao
 * antes de eliminar os dois humanos.
 */
async function salaEmTorneioComHumanosEliminados() {
  const achado = await salaComTodosOsHumanosRecemEliminados();
  // D2: a urna so abre quando quem caiu marca pronto depois de assistir.
  await achado.hub.handle(achado.sockets.host, { type: "ready", ready: true });
  if (achado.hub.room.tournament!.vote === null) {
    await achado.hub.handle(achado.sockets.convidado, { type: "ready", ready: true });
  }
  await achado.hub.handle(achado.sockets.host, { type: "forceAdvance" });
  if (achado.hub.room.tournament!.vote === null) throw new Error("a urna nao abriu depois de todos marcarem pronto");
  return achado;
}

/** Logo depois da onda em que o ultimo humano caiu -- urna ainda fechada (D2). */
async function salaComTodosOsHumanosRecemEliminados() {
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    const achado = await tentarSalaComHumanosEliminados(`semente-votacao-${tentativa}`);
    if (achado !== null) return achado;
  }
  throw new Error(
    "nenhuma das 30 sementes tentadas chegou a todo-humano-eliminado antes do campeao -- " +
      "troque ou amplie o pool de sementes em salaEmTorneioComHumanosEliminados (hub.test.ts)."
  );
}

/**
 * Variante com 3 assentos humanos, sem o socketDeFora (que so a bateria
 * "quem nao tem time" precisa). Existe so para o teste de empate real com
 * voto pendente: com apenas 2 humanos, qualquer discordancia entre os dois JA
 * fecha a urna sozinha (voteResult ve os dois unicos conectados terem
 * votado) -- nao daria pra distinguir "forceAdvance resolveu" de "a votacao
 * ja tinha fechado normal". Com um terceiro humano conectado e calado, a
 * urna fica genuinamente pendente ate alguem forcar.
 */
async function tentarSalaComTresHumanosEliminados(semente: string) {
  const relogio = relogioFalso();
  const clientIds = ["c0", "c1", "c2"];

  let draft = createDraft({
    players: BASE,
    humans: clientIds.map((clientId, i) => ({ clientId, teamName: `Time ${i}` })),
    seed: semente,
    now: 0,
    budget: () => null,
  });
  while (!isFinished(draft)) draft = autoPick(draft, BASE, 0, () => null);

  const room: Room = {
    phase: "draft",
    players: clientIds.map((clientId, i) => ({
      clientId,
      publicId: `pub${i}`,
      nickname: `p${i}`,
      teamName: `Time ${i}`,
      isHost: i === 0,
      connected: false,
      spectator: false,
    })),
    settings: { turnSeconds: 60 },
    draft,
    tournament: null,
    hostToken: "t",
  };

  const hub = new RoomHub(room, BASE, deps({ now: relogio.now, schedule: relogio.schedule }));
  hub.attachSender(() => {});

  for (let i = 0; i < clientIds.length; i++) {
    await hub.handle(`s${i + 1}`, helloDeVolta(hub, clientIds[i]!));
  }

  await hub.handle("s1", { type: "startTournament", chaosLevel: 0.25 });

  const sockets = { host: "s1", segundo: "s2", terceiro: "s3" };
  for (let onda = 1; onda < TOTAL_WAVES; onda++) {
    const t = hub.room.tournament!;
    // Mesma regra de tentarSalaComHumanosEliminados: precisa sobrar pelo menos
    // duas ondas, senao o "continuar" roda a final na hora e fecha o torneio.
    if (allHumansEliminated(t)) return t.wave <= TOTAL_WAVES - 2 ? { hub, sockets, clientIds } : null;
    if (t.bracket.championId !== null) return null;
    await iniciarRodadaPronta(hub, sockets.host);
  }
  const t = hub.room.tournament!;
  // Mesma regra do laco: campeao coroado na ultima onda fecha o torneio e a urna
  // nao chega a abrir (hub.#aposOnda), e com menos de duas ondas restantes o
  // "continuar" fecha o torneio na hora, entao essa semente nao serve ao teste.
  if (t.bracket.championId === null && allHumansEliminated(t) && t.wave <= TOTAL_WAVES - 2) {
    return { hub, sockets, clientIds };
  }
  return null;
}

async function salaEmTorneioComTresHumanosEliminados() {
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    const achado = await tentarSalaComTresHumanosEliminados(`semente-votacao-3h-${tentativa}`);
    if (achado === null) continue;
    for (const s of [achado.sockets.host, achado.sockets.segundo, achado.sockets.terceiro]) {
      if (achado.hub.room.tournament!.vote === null) await achado.hub.handle(s, { type: "ready", ready: true });
    }
    await achado.hub.handle(achado.sockets.host, { type: "forceAdvance" });
    if (achado.hub.room.tournament!.vote === null) throw new Error("a urna nao abriu (3 humanos)");
    return achado;
  }
  throw new Error(
    "nenhuma das 30 sementes tentadas (3 humanos) chegou a todo-humano-eliminado antes do " +
      "campeao -- troque ou amplie o pool de sementes em salaEmTorneioComTresHumanosEliminados " +
      "(hub.test.ts)."
  );
}

describe("a urna abre quando o ultimo humano cai", () => {
  it("quem caiu nesta rodada continua sendo esperado se desconectar antes do Ready", async () => {
    // Precisa de um humano que caiu ANTES (fora da barreira, conectado) e outro
    // que caiu nesta rodada (o unico na barreira). Procura por semente.
    for (let tentativa = 0; tentativa < 40; tentativa++) {
      const achado = await tentarSalaComHumanosEliminados(`semente-achado4-${tentativa}`);
      if (achado === null) continue;
      const { hub, sockets } = achado;
      const membros = barrierMembers(hub.room.tournament!, () => true);
      if (membros.length !== 1) continue;
      const socketDoMembro = membros[0] === "c0" ? sockets.host : sockets.convidado;
      expect(hub.room.tournament!.vote).toBeNull();
      hub.disconnect(socketDoMembro);
      expect(hub.room.tournament!.vote).toBeNull();
      expect(hub.room.tournament!.resultadosLiberados).toBe(false);
      return;
    }
    throw new Error("nenhuma semente com um humano caido antes e outro nesta rodada");
  });

  it("nao abre no instante da onda: quem caiu nela continua na barreira (D2, S6)", async () => {
    const { hub } = await salaComTodosOsHumanosRecemEliminados();
    const t = hub.room.tournament!;
    expect(t.vote).toBeNull();
    // Pelo menos quem caiu NESTA onda ainda e esperado.
    expect(barrierMembers(t, () => true).length).toBeGreaterThan(0);
  });

  it("abre quando todo mundo marca pronto depois de assistir, vazia", async () => {
    const { hub } = await salaEmTorneioComHumanosEliminados();
    expect(hub.room.tournament!.vote).not.toBeNull();
    expect(hub.room.tournament!.vote!.votes).toEqual({});
  });

  it("com a urna aberta, 'pronto' e recusado: a decisao e o voto", async () => {
    const { hub, sockets } = await salaEmTorneioComHumanosEliminados();
    const saida = await hub.handle(sockets.host, { type: "ready", ready: true });
    expect(erroDe(saida)).toBe("votacao_fechada");
  });

  it("quem nao tem time na sala nao vota", async () => {
    const { hub, socketDeFora } = await salaEmTorneioComHumanosEliminados();
    const saida = await hub.handle(socketDeFora, { type: "vote", choice: "parar" });
    expect(erroDe(saida)).toBe("votacao_fechada");
  });

  it("sem urna aberta, o voto e recusado -- mesmo de quem tem assento", async () => {
    const { hub, sockets } = await salaEmTorneio();
    const saida = await hub.handle(sockets.host, { type: "vote", choice: "parar" });
    expect(erroDe(saida)).toBe("votacao_fechada");
    expect(hub.room.tournament!.vote).toBeNull();
  });

  it("maioria para 'Pular para o pódio' simula o resto e coroa um campeao (D2)", async () => {
    const { hub, sockets } = await salaEmTorneioComHumanosEliminados();
    await hub.handle(sockets.host, { type: "vote", choice: "parar" });
    await hub.handle(sockets.convidado, { type: "vote", choice: "parar" });
    expect(hub.room.phase).toBe("finished");
    expect(hub.room.tournament!.bracket.championId).not.toBeNull();
    expect(hub.room.tournament!.pulado).toBe(true);
  });

  it("'pular' completa o chaveamento inteiro, as 14 series", async () => {
    const { hub, sockets } = await salaEmTorneioComHumanosEliminados();
    const seriesCompletas = (t: RoomTournament) =>
      Object.values(t.bracket.slots).filter((s) => s.series.status === "complete").length;

    await hub.handle(sockets.host, { type: "vote", choice: "parar" });
    await hub.handle(sockets.convidado, { type: "vote", choice: "parar" });

    expect(seriesCompletas(hub.room.tournament!)).toBe(14);
  });

  it("empate continua (D-33): a proxima rodada roda na hora e os eliminados passam a contar na barreira (D-29)", async () => {
    const { hub, sockets } = await salaEmTorneioComHumanosEliminados();
    const antes = hub.room.tournament!.wave;
    await hub.handle(sockets.host, { type: "vote", choice: "continuar" });
    await hub.handle(sockets.convidado, { type: "vote", choice: "parar" });
    expect(hub.room.phase === "tournament" || hub.room.phase === "finished").toBe(true);
    expect(hub.room.tournament!.vote).toBeNull();
    expect(hub.room.tournament!.espectadoresContam).toBe(true);
    // Todo mundo ja tinha marcado pronto para a urna abrir: a rodada seguinte
    // nao pede pronto de novo.
    expect(hub.room.tournament!.wave).toBe(antes + 1);

    if (hub.room.phase === "tournament") {
      // e a seguinte so anda se os dois espectadores (os dois eliminados) marcarem pronto
      await hub.handle(sockets.host, { type: "ready", ready: true });
      const meio = hub.room.tournament!.wave;
      await hub.handle(sockets.convidado, { type: "ready", ready: true });
      expect(hub.room.tournament!.wave).toBe(meio);
      await hub.handle(sockets.host, { type: "forceAdvance" });
      expect(hub.room.tournament!.wave).toBe(meio + 1);
    }
  });

  it("votar de novo troca o voto enquanto a urna esta aberta", async () => {
    const { hub, sockets, clientIds } = await salaEmTorneioComHumanosEliminados();
    await hub.handle(sockets.host, { type: "vote", choice: "parar" });
    await hub.handle(sockets.host, { type: "vote", choice: "continuar" });
    expect(hub.room.tournament!.vote).not.toBeNull();
    expect(hub.room.tournament!.vote!.votes[clientIds[0]!]).toBe("continuar");
  });

  it("um so voto nao fecha a urna com dois humanos conectados", async () => {
    const { hub, sockets } = await salaEmTorneioComHumanosEliminados();
    await hub.handle(sockets.host, { type: "vote", choice: "parar" });
    expect(hub.room.tournament!.vote).not.toBeNull();
    expect(hub.room.phase).toBe("tournament");
  });
});

describe("quem falta votar desconecta -- a urna se reavalia igual a barreira", () => {
  it("so sobra gente que ja votou: a urna fecha sozinha, sem handle() nenhum depois", async () => {
    const { hub, sockets } = await salaEmTorneioComHumanosEliminados();
    await hub.handle(sockets.host, { type: "vote", choice: "continuar" });
    expect(hub.room.tournament!.vote).not.toBeNull();

    const saida = hub.disconnect(sockets.convidado);

    expect(hub.room.tournament!.vote).toBeNull();
    expect(hub.room.tournament!.espectadoresContam).toBe(true);
    expect(hub.room.phase).toBe("tournament");
    expect(saida.some((o) => o.message.type === "roomState")).toBe(true);
  });

  it("o mesmo vale para 'pular': o disconnect leva a sala ao podio, com campeao", async () => {
    const { hub, sockets } = await salaEmTorneioComHumanosEliminados();
    await hub.handle(sockets.host, { type: "vote", choice: "parar" });

    hub.disconnect(sockets.convidado);

    expect(hub.room.phase).toBe("finished");
    expect(hub.room.tournament!.bracket.championId).not.toBeNull();
  });

  it("contraprova: desconectar sem ninguem ter votado ainda nao fecha a urna sozinha", async () => {
    const { hub, sockets } = await salaEmTorneioComHumanosEliminados();
    hub.disconnect(sockets.convidado);
    expect(hub.room.tournament!.vote).not.toBeNull();
  });
});

describe("forceAdvance com a urna aberta apura com o que tem, nao bloqueia (correcao pos-revisao: bloquear travava a sala)", () => {
  it("um 'parar' contra silencio: o host forca, apura 'parar' (1 a 0), e a sala vai para finished", async () => {
    const { hub, sockets } = await salaEmTorneioComHumanosEliminados();
    // convidado vota; host fica calado (foi buscar cerveja) e forca mesmo assim.
    await hub.handle(sockets.convidado, { type: "vote", choice: "parar" });

    const saida = await iniciarRodadaPronta(hub, sockets.host);

    expect(erroDe(saida)).toBeNull();
    expect(hub.room.phase).toBe("finished");
    expect(hub.room.tournament!.bracket.championId).not.toBeNull();
    expect(hub.room.tournament!.vote).toBeNull();
  });

  it("ninguem votou: o host forca, e o resultado e 'continuar' -- empate de 0 a 0 mantem rodando (D-33)", async () => {
    const { hub, sockets } = await salaEmTorneioComHumanosEliminados();

    const saida = await iniciarRodadaPronta(hub, sockets.host);

    expect(erroDe(saida)).toBeNull();
    expect(hub.room.phase).toBe("tournament");
    expect(hub.room.tournament!.vote).toBeNull();
    expect(hub.room.tournament!.espectadoresContam).toBe(true);
  });

  it("empate de verdade (um 'continuar', um 'parar') com um terceiro conectado e calado: o host forca, resultado 'continuar'", async () => {
    // Precisa de 3 humanos: com so 2, os dois votarem (um de cada lado) ja
    // fecharia a urna sozinha (voteResult ve os dois conectados terem
    // votado) -- nao provaria nada sobre o forceAdvance. Com um terceiro
    // conectado e calado, a urna genuinamente NAO fecha sozinha (falta o
    // voto dele) ate o host forcar.
    const { hub, sockets } = await salaEmTorneioComTresHumanosEliminados();
    await hub.handle(sockets.segundo, { type: "vote", choice: "continuar" });
    await hub.handle(sockets.terceiro, { type: "vote", choice: "parar" });
    expect(hub.room.tournament!.vote).not.toBeNull();

    const saida = await iniciarRodadaPronta(hub, sockets.host);

    expect(erroDe(saida)).toBeNull();
    expect(hub.room.phase).toBe("tournament");
    expect(hub.room.tournament!.vote).toBeNull();
    expect(hub.room.tournament!.espectadoresContam).toBe(true);
  });

  it("sem urna aberta, o host inicia a próxima rodada após os Ready", async () => {
    const { hub, sockets } = await salaEmTorneio();
    expect(hub.room.tournament!.vote).toBeNull();
    const ondaAntes = hub.room.tournament!.wave;

    const saida = await iniciarRodadaPronta(hub, sockets.host);

    expect(erroDe(saida)).toBeNull();
    expect(hub.room.tournament!.wave).toBe(ondaAntes + 1);
  });
});

describe("forceAdvance depois de a sala encerrar (M-1 da revisao final)", () => {
  // Depois do "Pular para o pódio" (D2) a sala esta em finished com campeao;
  // forcar de novo nao pode rodar nada nem trocar o campeao. O botao nem e
  // desenhado no podio, mas o servidor e a autoridade.
  const seriesCompletas = (t: RoomTournament) =>
    Object.values(t.bracket.slots).filter((s) => s.series.status === "complete").length;

  async function salaQueVotouParar() {
    const achado = await salaEmTorneioComHumanosEliminados();
    await achado.hub.handle(achado.sockets.host, { type: "vote", choice: "parar" });
    await achado.hub.handle(achado.sockets.convidado, { type: "vote", choice: "parar" });
    expect(achado.hub.room.phase).toBe("finished");
    return achado;
  }

  it("com a sala em finished, forcar e recusado e nada anda", async () => {
    const { hub, sockets } = await salaQueVotouParar();
    const antes = seriesCompletas(hub.room.tournament!);

    const saida = await iniciarRodadaPronta(hub, sockets.host);

    expect(erroDe(saida)).toBe("torneio_nao_comecou");
    expect(seriesCompletas(hub.room.tournament!)).toBe(antes);
  });

  it("oito forceAdvance seguidos nao mexem no campeao nem no chaveamento (a sonda do revisor)", async () => {
    const { hub, sockets } = await salaQueVotouParar();
    const antes = seriesCompletas(hub.room.tournament!);
    const ondaAntes = hub.room.tournament!.wave;
    const campeao = hub.room.tournament!.bracket.championId;

    for (let i = 0; i < 8; i++) await iniciarRodadaPronta(hub, sockets.host);

    expect(seriesCompletas(hub.room.tournament!)).toBe(antes);
    expect(hub.room.tournament!.wave).toBe(ondaAntes);
    expect(hub.room.tournament!.bracket.championId).toBe(campeao);
    expect(hub.room.phase).toBe("finished");
  });
});

describe("campeao coroado encerra a sala mesmo com humano eliminado (a ordem do #aposOnda)", () => {
  it("campeao coroado leva a sala para finished", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await ateCampeaoCoroado(hub, sockets);
    expect(hub.room.tournament!.bracket.championId).not.toBeNull();
    expect(hub.room.phase).toBe("finished");
  });

  it("com campeao coroado a urna nao fica pendurada aberta -- foi decidida, nao ignorada", async () => {
    const { hub, sockets } = await salaEmTorneio();
    await ateCampeaoCoroado(hub, sockets);
    expect(hub.room.tournament!.bracket.championId).not.toBeNull();
    expect(hub.room.tournament!.vote).toBeNull();
  });
});

/**
 * Procura uma semente onde o campeao e coroado NA MESMA onda em que os dois
 * humanos passam a valer como eliminados -- nao antes. So acontece quando
 * nenhum dos dois perdeu duas series ate a onda final: ate ali,
 * `allHumansEliminated` e falso e a urna nunca abriu. A onda que coroa um BOT
 * como campeao elimina retroativamente todo mundo que nao e o campeao
 * (`eliminatedTeamIds`, D-03: sem bracket reset) -- inclusive os dois
 * humanos, no MESMO instante em que `championId` deixa de ser null.
 *
 * E o UNICO estado que expõe a ordem do #aposOnda. Nos fixtures normais
 * (salaEmTorneioComHumanosEliminados, ateCampeaoCoroado) a urna ja abriu — e
 * foi fechada — bem antes do campeao: nelas, inverter "campeao primeiro" por
 * "urna primeiro" no #aposOnda nao muda nada observavel, porque a guarda
 * `!espectadoresContam` ja bloqueia reabrir uma urna ja decidida. So quando os
 * dois nascem juntos, sem urna nenhuma aberta antes, a ordem passa a importar
 * de verdade.
 */
function buscarEstadoPreCampeaoSemUrna(): RoomTournament {
  for (let tentativa = 0; tentativa < 200; tentativa++) {
    const semente = `semente-ordem-${tentativa}`;
    let draft = createDraft({
      players: BASE,
      humans: ["c0", "c1"].map((clientId, i) => ({ clientId, teamName: `Time ${i}` })),
      seed: semente,
      now: 0,
      budget: () => null,
    });
    while (!isFinished(draft)) draft = autoPick(draft, BASE, 0, () => null);
    let t = createRoomTournament({ draft, players: BASE, chaosLevel: 0.25 });

    for (let onda = 0; onda < TOTAL_WAVES; onda++) {
      if (t.bracket.championId !== null || allHumansEliminated(t)) break;
      const antes = t;
      const depois = runWave(t, []);
      if (depois.bracket.championId !== null && allHumansEliminated(depois)) {
        return antes;
      }
      t = depois;
    }
  }
  throw new Error(
    "nenhuma das 200 sementes tentadas coroou o campeao no MESMO instante em que os dois " +
      "humanos ficam eliminados -- troque ou amplie o pool de sementes em " +
      "buscarEstadoPreCampeaoSemUrna (hub.test.ts)."
  );
}

describe("campeao vem antes da urna quando os dois nascem juntos (mutacao de ordem no #aposOnda)", () => {
  it("campeao coroado e todo humano eliminado na mesma onda: finished, e NENHUMA urna abre", async () => {
    const antes = buscarEstadoPreCampeaoSemUrna();
    // pre-condicoes do estado buscado -- se alguma falhar, o helper achou o
    // estado errado.
    expect(antes.bracket.championId).toBeNull();
    expect(allHumansEliminated(antes)).toBe(false);
    expect(antes.vote).toBeNull();

    const room: Room = {
      phase: "tournament",
      players: [
        { clientId: "c0", publicId: "pub0", nickname: "p0", teamName: "Time 0", isHost: true, connected: true, spectator: false },
        { clientId: "c1", publicId: "pub1", nickname: "p1", teamName: "Time 1", isHost: false, connected: true, spectator: false },
      ],
      settings: { turnSeconds: 60 },
      draft: null,
      tournament: antes,
      hostToken: "t",
    };
    const hub = new RoomHub(room, BASE, deps());
    hub.attachSender(() => {});
    await hub.handle("s1", helloDeVolta(hub, "c0"));
    await hub.handle("s2", helloDeVolta(hub, "c1"));

    // A final só encerra a sala depois de todos confirmarem que assistiram.
    await iniciarRodadaPronta(hub, "s1");
    expect(hub.room.phase).toBe("tournament");
    const membros = barrierMembers(hub.room.tournament!, () => true);
    for (const id of membros) {
      expect(hub.room.phase).toBe("tournament");
      await hub.handle(id === "c0" ? "s1" : "s2", { type: "ready", ready: true });
    }

    expect(hub.room.tournament!.bracket.championId).not.toBeNull();
    expect(hub.room.phase).toBe("finished");
    expect(hub.room.tournament!.vote).toBeNull();
  }, 20_000); // a busca por semente (ate 200 tentativas) pode passar dos 5s padrao sob carga da suite inteira
});


describe("configuração e opções compartilhadas", () => {
  it("fixa atributos e caos antes de jogar e divulga as opções atuais", async () => {
    const hub=await salaCom(["Ana","Bia"]);
    const result=await hub.handle("s1", {type:"startDraft",turnSeconds:60,statsMode:"overall_after",chaosLevel:0.8});
    const state=estadoDe(result).state;
    expect(state.settings.statsMode).toBe("overall_after"); expect(state.settings.chaosLevel).toBe(0.8);
    expect(state.baseSummary?.cards).toBe(BASE.length);
    expect(state.draft?.options).toEqual(handCards(hub.room.draft!, BASE).map(([role,card])=>({role,card})));
    const denied=await hub.handle("s2", {type:"pick",cardId:"not-mine"});
    expect(erroDe(denied)).not.toBeNull();
  });
  it("publica o nome da base com os dados para todos",async()=>{
    const hub=await salaCom(["Ana","Bia"]);
    const result=await hub.handle("s1",{type:"publishBase",database:{players:BASE},name:"Amigos 2026"});
    expect(estadoDe(result).state.settings.baseName).toBe("Amigos 2026");
  });
});

describe("transferência de host", () => {
  it("transfere, persiste e revoga as permissões e o token anteriores", async () => {
    const salvar = vi.fn();
    const hub = await salaCom(["Ana", "Bia"], BASE, { onRoomChanged: salvar });
    const bia = hub.room.players[1]!;
    const ana = hub.room.players[0]!;
    const out = await hub.handle("s1", { type: "transferHost", publicId: bia.publicId });
    expect(estadoDe(out).state.players.map(p => p.isHost)).toEqual([false, true]);
    expect(salvar).toHaveBeenCalled();
    expect(hub.room.hostToken).not.toBe("t");
    const denied = await hub.handle("s1", { type: "setSettings", turnSeconds: 90 });
    expect(denied[0]?.message).toMatchObject({ type: "error", code: "not_host" });
    await hub.handle("s2", { type: "setSettings", turnSeconds: 90 });
    expect(hub.room.settings.turnSeconds).toBe(90);
    hub.disconnect("s1");
    await hub.handle("s3", { ...hello("Ana", ana.teamName, "t"), clientId: ana.clientId });
    expect(hub.room.players[0]?.isHost).toBe(false);
    hub.disconnect("s2");
    await hub.handle("s4", { ...hello("Bia", bia.teamName), clientId: bia.clientId });
    expect(hub.room.players[1]?.isHost).toBe(true);
  });

  it("recusa convidados, alvos ausentes, desconectados e o próprio host", async () => {
    const hub = await salaCom(["Ana", "Bia"]);
    const ana = hub.room.players[0]!;
    const bia = hub.room.players[1]!;
    expect((await hub.handle("s2", { type: "transferHost", publicId: bia.publicId }))[0]?.message).toMatchObject({ code: "not_host" });
    expect((await hub.handle("s1", { type: "transferHost", publicId: "ausente" }))[0]?.message).toMatchObject({ code: "unknown_client" });
    expect((await hub.handle("s1", { type: "transferHost", publicId: ana.publicId }))[0]?.message).toMatchObject({ code: "bad_message" });
    hub.disconnect("s2");
    expect((await hub.handle("s1", { type: "transferHost", publicId: bia.publicId }))[0]?.message).toMatchObject({ code: "bad_message" });
    expect(hub.room.players[0]?.isHost).toBe(true);
  });
});

it("não transfere o host depois do início do draft", async () => {
  const hub = await salaCom(["Ana", "Bia"]);
  await hub.handle("s1", { type: "startDraft", turnSeconds: 60 });
  expect(hub.room.phase).toBe("draft");
  const result = await hub.handle("s1", { type: "transferHost", publicId: hub.room.players[1]!.publicId });
  expect(result[0]?.message).toMatchObject({ code: "in_progress" });
  expect(hub.room.players[0]?.isHost).toBe(true);
});

describe("host automático", () => {
  const graceMs = HOST_RECONNECT_GRACE_SECONDS * 1000;

  async function salaAutomatica(nicks = ["Ana", "Bia", "Caio"]) {
    const clock = relogioFalso();
    const saved = vi.fn();
    const sent: Outbound[] = [];
    const hub = new RoomHub(createRoom("segredo-sala", true), BASE, deps({
      now: clock.now, schedule: clock.schedule, onRoomChanged: saved,
    }));
    hub.attachSender((out) => sent.push(...out));
    for (let i = 0; i < nicks.length; i++) {
      await hub.handle(`s${i + 1}`, hello(nicks[i]!, `Time ${i}`));
    }
    return { hub, clock, saved, sent };
  }

  const hosts = (hub: RoomHub) => hub.room.players.filter((p) => p.isHost).map((p) => p.nickname);

  it("somente a primeira entrada válida ganha host, mesmo com hellos simultâneos", async () => {
    const { hub } = await salaAutomatica([]);
    expect(erroDe(await hub.handle("invalido", hello("Ana", "")))).toBe("time_obrigatorio");
    expect(hub.room.players).toHaveLength(0);
    const [first, second] = await Promise.all([
      hub.handle("s1", hello("Ana", "A")),
      hub.handle("s2", hello("Bia", "B", "segredo-sala")),
    ]);
    expect(first[0]?.message).toMatchObject({ type: "welcome", isHost: true });
    expect(second[0]?.message).toMatchObject({ type: "welcome", isHost: false });
    expect(hosts(hub)).toEqual(["Ana"]);
    expect(estadoDe(second).state.hostAuto).toBe(true);
    expect(JSON.stringify(second)).not.toContain("segredo-sala");
    expect(RoomWireSchema.safeParse(estadoDe(second).state).success).toBe(true);
    expect(erroDe(await hub.handle("s2", { type: "setSettings", turnSeconds: 90 }))).toBe("not_host");
    expect(erroDe(await hub.handle("s1", { type: "setSettings", turnSeconds: 90 }))).toBeNull();
  });

  it("host reconecta antes do prazo sem perder controle; outros eventos não renovam o prazo", async () => {
    const { hub, clock } = await salaAutomatica();
    const ana = hub.room.players[0]!;
    hub.disconnect("s1");
    clock.avancar(graceMs - 1);
    await hub.handle("s4", hello("Dani", "D"));
    expect(hosts(hub)).toEqual(["Ana"]);
    await hub.handle("voltou", { ...hello(ana.nickname, ana.teamName), clientId: ana.clientId });
    clock.avancar(1);
    expect(hosts(hub)).toEqual(["Ana"]);
    hub.disconnect("voltou");
    clock.avancar(graceMs - 1);
    expect(hosts(hub)).toEqual(["Ana"]);
    clock.avancar(1);
    expect(hosts(hub)).toEqual(["Bia"]);
  });

  it("passa ao próximo conectado após 60s, persiste, difunde e não devolve ao host antigo", async () => {
    const { hub, clock, saved, sent } = await salaAutomatica();
    const ana = hub.room.players[0]!;
    hub.disconnect("s1");
    hub.disconnect("s2");
    clock.avancar(graceMs - 1);
    await hub.handle("s4", hello("Dani", "D"));
    expect(hosts(hub)).toEqual(["Ana"]);
    clock.avancar(1);
    expect(hosts(hub)).toEqual(["Caio"]);
    expect(hub.room.hostToken).not.toBe("segredo-sala");
    expect(saved.mock.lastCall?.[0].players.filter((p: { isHost: boolean }) => p.isHost)[0].nickname).toBe("Caio");
    expect(estadoDe(sent).state.players.find((p) => p.isHost)?.nickname).toBe("Caio");
    await hub.handle("voltou", { ...hello(ana.nickname, ana.teamName, "segredo-sala"), clientId: ana.clientId });
    expect(hosts(hub)).toEqual(["Caio"]);
    expect(erroDe(await hub.handle("voltou", { type: "setSettings", turnSeconds: 90 }))).toBe("not_host");
    expect(erroDe(await hub.handle("s3", { type: "setSettings", turnSeconds: 90 }))).toBeNull();
    expect(clock.pendentes()).toBe(0);
  });

  it("uma segunda aba mantém o host online; a carência só começa na última queda", async () => {
    const { hub, clock } = await salaAutomatica();
    const ana = hub.room.players[0]!;
    await hub.handle("aba", { ...hello(ana.nickname, ana.teamName), clientId: ana.clientId });
    hub.disconnect("s1");
    clock.avancar(graceMs);
    expect(hosts(hub)).toEqual(["Ana"]);
    expect(hub.room.players[0]?.connected).toBe(true);
    hub.disconnect("aba");
    clock.avancar(graceMs);
    expect(hosts(hub)).toEqual(["Bia"]);
  });

  it("sala vazia não repete timers; um jogador que volta após o prazo já recebe host no welcome", async () => {
    const { hub, clock } = await salaAutomatica();
    const bia = hub.room.players[1]!;
    for (const socket of ["s1", "s2", "s3"]) hub.disconnect(socket);
    clock.avancar(graceMs);
    expect(clock.pendentes()).toBe(0);
    expect(hosts(hub)).toEqual(["Ana"]);
    const out = await hub.handle("voltou", { ...hello(bia.nickname, bia.teamName), clientId: bia.clientId });
    expect(out[0]?.message).toMatchObject({ type: "welcome", isHost: true });
    expect(hosts(hub)).toEqual(["Bia"]);
  });

  it("reinício preserva o host durante a carência, mesmo se outro jogador reconectar primeiro", async () => {
    const { hub: original } = await salaAutomatica();
    const room = { ...original.room, players: original.room.players.map((p) => ({ ...p, connected: false })) };
    const clock = relogioFalso();
    const hub = new RoomHub(room, BASE, deps({ now: clock.now, schedule: clock.schedule }));
    const bia = room.players[1]!;
    await hub.handle("bia", { ...hello(bia.nickname, bia.teamName), clientId: bia.clientId });
    clock.avancar(graceMs - 1);
    expect(hosts(hub)).toEqual(["Ana"]);
    clock.avancar(1);
    expect(hosts(hub)).toEqual(["Bia"]);
  });

  it("transferência manual no lobby cancela a carência pendente", async () => {
    const { hub, clock } = await salaAutomatica();
    hub.disconnect("s1");
    clock.avancar(graceMs - 1);
    const ana = hub.room.players[0]!;
    await hub.handle("voltou", { ...hello(ana.nickname, ana.teamName), clientId: ana.clientId });
    await hub.handle("voltou", { type: "transferHost", publicId: hub.room.players[2]!.publicId });
    clock.avancar(1);
    expect(hosts(hub)).toEqual(["Caio"]);
  });

  it("transfere durante o draft sem reconstruir o baralho nem mudar o turno", async () => {
    const { hub, clock } = await salaAutomatica();
    await hub.handle("s1", { type: "startDraft", turnSeconds: 300 });
    hub.disconnect("s1");
    // Isola o timeout do host do relógio de escolha: avança primeiro para um
    // turno de jogador conectado, cujo prazo não vence durante a carência.
    while (currentSeat(hub.room.draft!)?.clientId === hub.room.players[0]!.clientId) {
      clock.avancar(DISCONNECTED_GRACE_SECONDS * 1000);
    }
    const draft = hub.room.draft;
    clock.avancar(graceMs);
    expect(hub.room.phase).toBe("draft");
    expect(hosts(hub)).toEqual(["Bia"]);
    expect(hub.room.draft).toBe(draft);
  });

  it("transfere no torneio, ignora espectadores, desliga sincronia e permite ao novo host seguir", async () => {
    const { hub: original } = await salaEmTorneio();
    const clock = relogioFalso();
    const hub = new RoomHub({ ...original.room, hostAuto: true }, BASE, deps({ now: clock.now, schedule: clock.schedule }));
    const [host, guest] = hub.room.players;
    await hub.handle("host", { ...hello(host!.nickname, host!.teamName), clientId: host!.clientId });
    await hub.handle("plateia", hello("Espectador", "", hub.room.hostToken));
    expect(hub.room.players[hub.room.players.length - 1]).toMatchObject({ spectator: true, isHost: false });
    await hub.handle("guest", { ...hello(guest!.nickname, guest!.teamName), clientId: guest!.clientId });
    await hub.handle("host", { type: "setSyncMode", enabled: true });
    expect(hub.room.tournament!.sync).not.toBeNull();
    const watching = hub.room.tournament!.watching;
    hub.disconnect("host");
    clock.avancar(graceMs);
    expect(hub.room.players.find((p) => p.isHost)?.clientId).toBe(guest!.clientId);
    expect(hub.room.tournament!.sync).toBeNull();
    expect(hub.room.tournament!.watching).toEqual(watching);
    expect(erroDe(await hub.handle("guest", { type: "setSyncMode", enabled: true }))).toBeNull();
    expect(hub.room.tournament!.sync).not.toBeNull();
    expect(erroDe(await hub.handle("plateia", { type: "forceAdvance" }))).toBe("not_host");
  });

  it("no pódio, o novo host pode começar revanche", async () => {
    const { hub, clock } = await salaAutomatica();
    // O estado final e a autorização da revanche não dependem da simulação.
    const finished = new RoomHub({ ...hub.room, phase: "finished" }, BASE, deps({ now: clock.now, schedule: clock.schedule }));
    const [ana, bia] = finished.room.players;
    await finished.handle("s1", { ...hello(ana!.nickname, ana!.teamName), clientId: ana!.clientId });
    await finished.handle("s2", { ...hello(bia!.nickname, bia!.teamName), clientId: bia!.clientId });
    finished.disconnect("s1");
    clock.avancar(graceMs);
    expect(erroDe(await finished.handle("s2", { type: "rematch" }))).toBeNull();
    expect(finished.room.phase).toBe("lobby");
    expect(finished.room.hostAuto).toBe(true);
    expect(hosts(finished)).toEqual(["Bia"]);
  });

  it("sem o modo automático, uma queda nunca promove convidados", async () => {
    const clock = relogioFalso();
    const hub = await salaCom(["Ana", "Bia"], BASE, { now: clock.now, schedule: clock.schedule });
    hub.disconnect("s1");
    clock.avancar(graceMs * 2);
    expect(hosts(hub)).toEqual(["Ana"]);
  });

  it("dispose cancela o timer do host sem gravar nem difundir mudanças posteriores", async () => {
    const { hub, clock, saved, sent } = await salaAutomatica();
    hub.disconnect("s1");
    hub.dispose();
    saved.mockClear();
    clock.avancar(graceMs);
    expect(hosts(hub)).toEqual(["Ana"]);
    expect(clock.pendentes()).toBe(0);
    expect(saved).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it("ativar o modo em uma sala manual com dois hosts mantém um único controlador", async () => {
    const manual = await salaCom(["Ana", "Bia"]);
    await manual.handle("s2", { ...hello("Bia", "Time 1", "t"), clientId: manual.room.players[1]!.clientId });
    expect(hosts(manual)).toEqual(["Ana", "Bia"]);
    const hub = new RoomHub({ ...manual.room, hostAuto: true }, BASE, deps());
    expect(hosts(hub)).toEqual(["Ana"]);
  });
});
