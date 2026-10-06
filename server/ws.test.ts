import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { PROTOCOL_VERSION, type ServerMessage } from "./protocol";
import { createRoom } from "./room/state";
import { RoomHub, type Outbound } from "./room/hub";
import { makeBase } from "./room/cards.fixture";
import { attachWebSocketServer } from "./ws";

let server: Server;
let close: () => void;
let url: string;

/** Abre um socket e resolve quando ele estiver pronto. */
async function conectar(): Promise<WebSocket> {
  const socket = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return socket;
}

/** Espera a proxima mensagem do servidor que case com o tipo pedido. */
async function esperar(socket: WebSocket, tipo: ServerMessage["type"]): Promise<ServerMessage> {
  return new Promise<ServerMessage>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout esperando ${tipo}`)), 2000);
    function onMessage(data: unknown) {
      const msg = JSON.parse(String(data)) as ServerMessage;
      if (msg.type === tipo) {
        clearTimeout(timer);
        socket.off("message", onMessage);
        resolve(msg);
      }
    }
    socket.on("message", onMessage);
  });
}

function hello(nickname: string, teamName: string) {
  return JSON.stringify({ type: "hello", protocolVersion: PROTOCOL_VERSION, nickname, teamName });
}

beforeEach(async () => {
  server = createServer();
  const hub = new RoomHub(createRoom("segredo"), makeBase(8), {
    makeClientId: (() => {
      let n = 0;
      return () => `c${n++}`;
    })(),
    makePublicId: (() => {
      let n = 0;
      return () => `pub${n++}`;
    })(),
    makeSeed: () => "semente-de-teste",
    now: () => 0,
    schedule: () => () => {},
    onRoomChanged: () => undefined,
    publishBase: async () => 0,
    loadPlayers: async () => makeBase(8),
    catalogue: [],
  });
  ({ close } = attachWebSocketServer(server, hub, { pingMs: 50, timeoutMs: 200 }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("sem porta");
  url = `ws://127.0.0.1:${address.port}/ws`;
});

afterEach(async () => {
  close();
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

describe("attachWebSocketServer", () => {
  it("responde welcome a um hello", async () => {
    const socket = await conectar();
    socket.send(hello("rafa", "Macacos"));

    const msg = await esperar(socket, "welcome");
    expect(msg).toMatchObject({ type: "welcome", protocolVersion: PROTOCOL_VERSION });
    socket.close();
  });

  it("difunde o estado para os dois clientes quando o segundo entra", async () => {
    const a = await conectar();
    a.send(hello("rafa", "Macacos"));
    await esperar(a, "welcome");

    const b = await conectar();
    b.send(hello("amigo", "Pernetas"));

    const msg = await esperar(a, "roomState");
    if (msg.type !== "roomState") throw new Error("esperava roomState");
    expect(msg.state.players.map((p) => p.teamName)).toContain("Pernetas");

    a.close();
    b.close();
  });

  it("marca desconectado quando o socket fecha", async () => {
    const a = await conectar();
    a.send(hello("rafa", "Macacos"));
    await esperar(a, "welcome");

    const b = await conectar();
    b.send(hello("amigo", "Pernetas"));
    await esperar(b, "welcome");

    a.close();

    const msg = await esperar(b, "roomState");
    if (msg.type !== "roomState") throw new Error("esperava roomState");
    const rafa = msg.state.players.find((p) => p.teamName === "Macacos");
    expect(rafa?.connected).toBe(false);

    b.close();
  });

  it("envia ping periodico", async () => {
    const socket = await conectar();
    socket.send(hello("rafa", "Macacos"));
    await esperar(socket, "welcome");

    const ping = await esperar(socket, "ping");
    expect(ping.type).toBe("ping");
    socket.close();
  });

  it("ignora texto que nao e JSON sem derrubar a conexao", async () => {
    const socket = await conectar();
    socket.send("isso nao e json");
    socket.send(hello("rafa", "Macacos"));

    const msg = await esperar(socket, "welcome");
    expect(msg.type).toBe("welcome");
    socket.close();
  });
});

/** Hub falso: attachWebSocketServer so usa handle, disconnect e attachSender. */
class HubEspiao {
  enviar: ((out: Outbound[]) => void) | null = null;
  disposed = false;

  attachSender(fn: (out: Outbound[]) => void): void {
    this.enviar = fn;
  }
  async handle(): Promise<Outbound[]> {
    return [];
  }
  disconnect(): Outbound[] {
    return [];
  }
  dispose(): void {
    this.disposed = true;
  }
}

describe("attachSender", () => {
  it("liga o canal de push do hub e o deixa inofensivo depois do close", async () => {
    const espiao = new HubEspiao();
    const http = createServer((_req, res) => {
      res.statusCode = 404;
      res.end();
    });
    const ws = attachWebSocketServer(http, espiao as unknown as RoomHub);
    await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
    const { port } = http.address() as AddressInfo;

    // O hub precisa de um caminho de saida proprio: o relogio muda a sala sem
    // ninguem ter falado, e o handle so responde a quem falou.
    expect(espiao.enviar).not.toBeNull();
    const enviarConectado = espiao.enviar;

    const cliente = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const recebidas: string[] = [];
    cliente.on("message", (d) => recebidas.push(String(d)));
    await new Promise<void>((r) => cliente.once("open", () => r()));

    espiao.enviar!([{ to: "all", message: { type: "basePublished", playerCount: 7 } }]);
    await new Promise((r) => setTimeout(r, 50));
    expect(recebidas.join("")).toContain("basePublished");

    ws.close();
    // Reforco: prova que o close chamou attachSender de novo com um canal
    // novo — sem essa linha, espiao.enviar continuaria sendo o `deliver`
    // original, e a assercao de "nao lanca" a seguir passaria so por sorte
    // (deliver ja tolera clients vazios sem lancar).
    expect(espiao.enviar).not.toBe(enviarConectado);
    // Q3 da revisao: o close tem que desarmar o relogio, nao so calar a
    // saida — senao o timer real do relogio ainda dispara depois do close.
    expect(espiao.disposed).toBe(true);
    // Depois do close o canal nao pode lancar nem escrever em socket terminado.
    expect(() => espiao.enviar!([{ to: "all", message: { type: "ping" } }])).not.toThrow();

    cliente.close();
    await new Promise<void>((r) => http.close(() => r()));
  });
});
