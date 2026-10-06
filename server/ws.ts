/**
 * server/ws.ts
 *
 * Adaptador entre o WebSocket e o RoomHub. A regra de negocio nao mora aqui:
 * este arquivo so identifica sockets, serializa e entrega.
 */

import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import type { Outbound, RoomHub } from "./room/hub";

/**
 * Teto de tamanho por mensagem. O padrao do `ws` e 100MB e o JSON.parse roda
 * antes de qualquer validacao: sem teto, um cliente qualquer faz o processo do
 * host alocar centenas de megabytes. A base real tem ~17KB — 4MB sobra.
 */
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

export interface WsOptions {
  /** Intervalo entre pings (padrao 10s) */
  pingMs?: number;
  /** Silencio tolerado antes de considerar o cliente caido (padrao 30s) */
  timeoutMs?: number;
}

interface Client {
  socketId: string;
  socket: WebSocket;
  lastSeen: number;
}

export function attachWebSocketServer(
  server: Server,
  hub: RoomHub,
  opts: WsOptions = {}
): { close: () => void } {
  const pingMs = opts.pingMs ?? 10_000;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: MAX_PAYLOAD_BYTES });
  const clients = new Map<string, Client>();

  function send(socketId: string, message: unknown): void {
    const client = clients.get(socketId);
    if (client === undefined || client.socket.readyState !== client.socket.OPEN) return;
    client.socket.send(JSON.stringify(message));
  }

  function deliver(outbound: Outbound[]): void {
    for (const item of outbound) {
      const targets = item.to === "all" ? [...clients.keys()] : item.to;
      for (const socketId of targets) {
        send(socketId, item.message);
      }
    }
  }

  // O relogio do draft muda o estado sem ninguem ter falado — o hub precisa de
  // um caminho de saida proprio.
  hub.attachSender(deliver);

  wss.on("connection", (socket: WebSocket) => {
    const socketId = randomUUID();
    clients.set(socketId, { socketId, socket, lastSeen: Date.now() });

    socket.on("message", (data) => {
      const client = clients.get(socketId);
      if (client !== undefined) client.lastSeen = Date.now();

      let raw: unknown;
      try {
        raw = JSON.parse(String(data)) as unknown;
      } catch {
        // Texto que nao e JSON: ignora sem derrubar a conexao.
        return;
      }

      void hub
        .handle(socketId, raw)
        .then(deliver)
        .catch((err: unknown) => {
          console.error("[sala] falha ao tratar mensagem:", err);
        });
    });

    socket.on("close", () => {
      clients.delete(socketId);
      deliver(hub.disconnect(socketId));
    });

    socket.on("error", (err) => {
      console.error("[sala] erro de socket:", err);
    });
  });

  const timer = setInterval(() => {
    const agora = Date.now();
    for (const client of [...clients.values()]) {
      if (agora - client.lastSeen > timeoutMs) {
        client.socket.terminate();
        clients.delete(client.socketId);
        deliver(hub.disconnect(client.socketId));
        continue;
      }
      send(client.socketId, { type: "ping" });
    }
  }, pingMs);

  return {
    close: () => {
      clearInterval(timer);
      for (const client of clients.values()) client.socket.terminate();
      clients.clear();
      hub.attachSender(() => {});
      // O canal de push tem dois lados: calar a saida nao basta, o relogio em
      // si precisa ser desarmado, senao o timer real dispara depois do close.
      hub.dispose();
      wss.close();
    },
  };
}
