import { describe, it, expect } from "vitest";
import {
  parseServerMessage,
  storedClientId,
  rememberClientId,
  safeStorage,
  type MinimalStorage,
  RoomClient,
  PROTOCOL_VERSION,
} from "./client";

describe("parseServerMessage", () => {
  it("aceita uma mensagem valida do servidor", () => {
    const msg = parseServerMessage(
      JSON.stringify({
        type: "welcome",
        clientId: "c1",
        publicId: "pub1",
        isHost: true,
        protocolVersion: 1,
      })
    );
    expect(msg).toMatchObject({ type: "welcome", clientId: "c1" });
  });

  it("devolve null para JSON quebrado", () => {
    expect(parseServerMessage("{ nao e json")).toBeNull();
  });

  it("devolve null para mensagem de tipo desconhecido", () => {
    expect(parseServerMessage(JSON.stringify({ type: "surpresa" }))).toBeNull();
  });
});

describe("memoria do clientId", () => {
  it("guarda e recupera do localStorage", () => {
    const store = new Map<string, string>();
    const fake = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };

    expect(storedClientId(fake)).toBeNull();
    rememberClientId(fake, "c42");
    expect(storedClientId(fake)).toBe("c42");
  });

  it("sobrevive a um localStorage que lanca", () => {
    const explosivo = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(storedClientId(explosivo)).toBeNull();
    expect(() => rememberClientId(explosivo, "c1")).not.toThrow();
  });

  it("safeStorage devolve um storage utilizavel quando o proprio acesso lanca", () => {
    const fonteExplosiva = () => {
      throw new Error("acesso ao localStorage bloqueado");
    };

    const storage = safeStorage(fonteExplosiva);

    expect(() => storage.getItem("qualquer")).not.toThrow();
    expect(storage.getItem("qualquer")).toBeNull();
    expect(() => storage.setItem("qualquer", "valor")).not.toThrow();
  });

  it("safeStorage cobre um provedor que devolve undefined sem lancar", () => {
    const storage = safeStorage(() => undefined as unknown as MinimalStorage);

    expect(storage).toBeDefined();
    expect(storage.getItem("qualquer")).toBeNull();
    expect(() => storage.setItem("qualquer", "valor")).not.toThrow();
  });
});

/**
 * WebSocket de mentira: o construtor guarda os ouvintes e o teste dirige
 * `open`/`message` na mao. Sem DOM, sem porta aberta, sem espera.
 */
class SocketFalso {
  readyState = 0; // CONNECTING
  readonly enviadas: string[] = [];
  readonly url: string;
  #ouvintes = new Map<string, ((ev: never) => void)[]>();

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(tipo: string, ouvinte: (ev: never) => void): void {
    const lista = this.#ouvintes.get(tipo) ?? [];
    lista.push(ouvinte);
    this.#ouvintes.set(tipo, lista);
  }

  send(data: string): void {
    this.enviadas.push(data);
  }

  close(): void {
    this.readyState = 3; // CLOSED
    this.#disparar("close", undefined);
  }

  /** O servidor aceitou a conexao. */
  abrir(): void {
    this.readyState = 1; // OPEN
    this.#disparar("open", undefined);
  }

  /** Uma mensagem chegou do servidor. */
  receber(msg: unknown): void {
    this.#disparar("message", { data: JSON.stringify(msg) });
  }

  #disparar(tipo: string, ev: unknown): void {
    for (const ouvinte of this.#ouvintes.get(tipo) ?? []) (ouvinte as (e: unknown) => void)(ev);
  }
}

function enviadasComo(socket: SocketFalso): unknown[] {
  return socket.enviadas.map((t) => JSON.parse(t) as unknown);
}

describe("RoomClient — fila de mensagens antes do socket abrir", () => {
  it("entrega o hello guardado assim que o socket abre", () => {
    let socket!: SocketFalso;
    const client = new RoomClient(
      "ws://teste/ws",
      { onMessage: () => {}, onClose: () => {} },
      (url) => {
        socket = new SocketFalso(url);
        return socket;
      }
    );

    client.send({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      nickname: "rafa",
      teamName: "Macacos",
    });

    // Ainda CONNECTING: nada foi para o fio.
    expect(socket.enviadas).toEqual([]);

    socket.abrir();

    expect(enviadasComo(socket)).toEqual([
      {
        type: "hello",
        protocolVersion: PROTOCOL_VERSION,
        nickname: "rafa",
        teamName: "Macacos",
      },
    ]);
  });

  it("entrega a mensagem guardada uma vez so, nao duas", () => {
    let socket!: SocketFalso;
    const client = new RoomClient(
      "ws://teste/ws",
      { onMessage: () => {}, onClose: () => {} },
      (url) => {
        socket = new SocketFalso(url);
        return socket;
      }
    );

    client.send({ type: "pong" });
    socket.abrir();
    // Um segundo 'open' (ou um flush repetido) nao pode reenviar a fila.
    socket.abrir();

    expect(enviadasComo(socket)).toEqual([{ type: "pong" }]);
  });

  it("responde ping com pong sozinho, sem entregar o ping a tela", () => {
    let socket!: SocketFalso;
    const recebidas: unknown[] = [];
    new RoomClient(
      "ws://teste/ws",
      { onMessage: (msg) => recebidas.push(msg), onClose: () => {} },
      (url) => {
        socket = new SocketFalso(url);
        return socket;
      }
    );

    socket.abrir();
    socket.receber({ type: "ping" });

    expect(enviadasComo(socket)).toEqual([{ type: "pong" }]);
    expect(recebidas).toEqual([]);

    // Uma mensagem de verdade continua chegando na tela.
    socket.receber({ type: "basePublished", playerCount: 7 });
    expect(recebidas).toEqual([{ type: "basePublished", playerCount: 7 }]);
  });
});

describe("RoomClient — send() devolve se a mensagem tinha para onde ir", () => {
  it("devolve true ao enfileirar (CONNECTING) e ao mandar de verdade (OPEN)", () => {
    let socket!: SocketFalso;
    const client = new RoomClient(
      "ws://teste/ws",
      { onMessage: () => {}, onClose: () => {} },
      (url) => {
        socket = new SocketFalso(url);
        return socket;
      }
    );

    expect(client.send({ type: "pong" })).toBe(true); // CONNECTING: entra na fila
    socket.abrir();
    expect(client.send({ type: "pong" })).toBe(true); // OPEN: vai direto pro fio
  });

  it("devolve false quando o socket ja fechou — nada foi para o fio", () => {
    let socket!: SocketFalso;
    const client = new RoomClient(
      "ws://teste/ws",
      { onMessage: () => {}, onClose: () => {} },
      (url) => {
        socket = new SocketFalso(url);
        return socket;
      }
    );

    socket.abrir();
    socket.close();
    const antes = socket.enviadas.length;

    expect(client.send({ type: "pong" })).toBe(false);
    expect(socket.enviadas.length).toBe(antes);
  });
});
