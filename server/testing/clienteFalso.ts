/**
 * server/testing/clienteFalso.ts
 *
 * Infraestrutura compartilhada dos testes de integracao via WebSocket
 * (draft e torneio): sobe um servidor HTTP+WS real e fala com ele por um
 * socket de verdade. Nada de dublê aqui — http real, ws real, hub real.
 *
 * Sem `.test.` no nome de proposito: o Vitest so coleta `*.test.ts`
 * (vitest.config.ts), entao este arquivo nunca vira uma suite por engano.
 */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { attachWebSocketServer } from "../ws";
import { RoomHub } from "../room/hub";
import { createRoom, type Room } from "../room/state";
import { isFinished } from "../room/draft";
import { makeBase } from "../room/cards.fixture";
import type { PlayerVersion } from "../engine/schema";
import {
  PROTOCOL_VERSION,
  ServerMessageSchema,
  type ClientMessage,
  type ServerMessage,
} from "../protocol";

export const HOST_TOKEN = "token-do-host";
/** Base sintetica com 8 pessoas por rota (D-14): o baralho de um draft de 8 times. */
export const BASE = makeBase(8);

export interface Fixture {
  url: string;
  hub: RoomHub;
  fechar: () => Promise<void>;
}

/**
 * `room`, quando passado, substitui a sala vazia padrao — e como se simula um
 * REINICIO real (server/main.ts: `new RoomHub(loadRoom(dir), ...)`): a sala ja
 * chega com fase, draft e/ou torneio prontos, exatamente como um snapshot
 * restaurado do disco entregaria. Sem isto, o unico jeito de testar a
 * regeneracao de timeline (D-25/D-26) por WebSocket seria fingir que ela
 * nunca precisa rodar — o cache em memoria do processo que acabou de gerar o
 * jogo sempre serviria o atalho.
 */
export async function subirServidor(
  players: PlayerVersion[] = BASE,
  room: Room = createRoom(HOST_TOKEN)
): Promise<Fixture> {
  const http: Server = createServer((_req, res) => {
    res.statusCode = 404;
    res.end();
  });

  const hub = new RoomHub(room, players, {
    makeClientId: () => randomUUID(),
    makePublicId: () => randomUUID(),
    makeSeed: () => "semente-de-integracao",
    now: () => Date.now(),
    onRoomChanged: () => {},
    publishBase: async () => players.length,
    loadPlayers: async () => players,
    schedule: (ms, fn) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    catalogue: [],
  });

  // pingMs alto: o heartbeat nao interessa aqui e so poluiria as mensagens.
  const ws = attachWebSocketServer(http, hub, { pingMs: 60_000, timeoutMs: 300_000 });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const { port } = http.address() as AddressInfo;

  return {
    url: `ws://127.0.0.1:${port}/ws`,
    hub,
    fechar: async () => {
      ws.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}

type Do<T extends ServerMessage["type"]> = Extract<ServerMessage, { type: T }>;

export class ClienteFalso {
  readonly recebidas: ServerMessage[] = [];
  /**
   * O texto bruto de cada mensagem recebida, ANTES do parse/validacao. Existe
   * para os testes de vazamento (D-27, D-20): validar so o objeto ja
   * parseado corre o risco de um schema `.strict()` engolir silenciosamente
   * uma mensagem malformada (ex.: um roomState com uma chave `events` a mais
   * cairia fora do array `recebidas` sem erro nenhum) e o teste passar por
   * ausencia de dado, nao por ausencia de vazamento.
   */
  readonly brutas: string[] = [];
  readonly #socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.on("message", (data) => {
      const texto = String(data);
      this.brutas.push(texto);
      let bruto: unknown;
      try {
        bruto = JSON.parse(texto) as unknown;
      } catch {
        return;
      }
      const msg = ServerMessageSchema.safeParse(bruto);
      if (msg.success) this.recebidas.push(msg.data);
    });
  }

  static async abrir(url: string): Promise<ClienteFalso> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
    return new ClienteFalso(socket);
  }

  enviar(msg: ClientMessage): void {
    this.#socket.send(JSON.stringify(msg));
  }

  todas<T extends ServerMessage["type"]>(type: T): Do<T>[] {
    return this.recebidas.filter((m): m is Do<T> => m.type === type);
  }

  ultima<T extends ServerMessage["type"]>(type: T): Do<T> | null {
    const todas = this.todas(type);
    return todas[todas.length - 1] ?? null;
  }

  /** Os textos brutos das mensagens de um tipo, na ordem em que chegaram. */
  brutasDoTipo(type: ServerMessage["type"]): string[] {
    return this.brutas.filter((texto) => {
      try {
        return (JSON.parse(texto) as { type?: unknown }).type === type;
      } catch {
        return false;
      }
    });
  }

  limpar(type: ServerMessage["type"]): void {
    for (let i = this.recebidas.length - 1; i >= 0; i--) {
      if (this.recebidas[i]!.type === type) this.recebidas.splice(i, 1);
    }
  }

  /**
   * Espera uma mensagem do tipo que satisfaca `ok` chegar. Sincroniza por
   * CONDICAO, nao por chegada: uma mensagem do tipo certo que ja estava na
   * lista mas nao serve (ex.: um roomState de antes do draft comecar) e
   * ignorada, e o poll continua ate uma que sirva aparecer. Estoura em 5s em
   * vez de pendurar a suite.
   */
  async esperarQue<T extends ServerMessage["type"]>(
    type: T,
    ok: (m: Do<T>) => boolean
  ): Promise<Do<T>> {
    const limite = Date.now() + 5_000;
    for (;;) {
      const candidatas = this.todas(type);
      for (let i = candidatas.length - 1; i >= 0; i--) {
        if (ok(candidatas[i]!)) return candidatas[i]!;
      }
      if (Date.now() > limite) {
        throw new Error(`nunca chegou uma mensagem '${type}' que satisfizesse a condicao esperada`);
      }
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  /** Espera qualquer mensagem do tipo chegar — quando nao importa qual. */
  async esperar<T extends ServerMessage["type"]>(type: T): Promise<Do<T>> {
    return this.esperarQue(type, () => true);
  }

  fechar(): void {
    this.#socket.close();
  }
}

/** Entra na sala e espera o welcome — a abertura comum a todo teste de integracao. */
export async function entrar(
  url: string,
  nickname: string,
  teamName: string,
  hostToken?: string
): Promise<ClienteFalso> {
  const c = await ClienteFalso.abrir(url);
  c.enviar({ type: "hello", protocolVersion: PROTOCOL_VERSION, nickname, teamName, hostToken });
  await c.esperar("welcome");
  return c;
}

/** Quem tiver mao na mesa escolhe a primeira carta, ate o draft fechar. */
export async function jogarAteAcabar(hub: RoomHub, clientes: ClienteFalso[]): Promise<void> {
  const limite = Date.now() + 15_000;
  while (Date.now() < limite) {
    const draft = hub.room.draft;
    if (draft !== null && isFinished(draft)) return;

    for (const c of clientes) {
      const mao = c.ultima("hand");
      if (mao === null || mao.cards.length === 0) continue;
      c.limpar("hand");
      c.enviar({ type: "pick", cardId: mao.cards[0]!.card.id });
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("o draft nao fechou em 15s");
}
