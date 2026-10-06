/**
 * src/net/client.ts
 *
 * Transporte do modo sala no navegador. Valida tudo que chega do servidor
 * com o mesmo schema que o servidor usa para enviar.
 */

import {
  ServerMessageSchema,
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from "../../server/protocol";

const CLIENT_ID_KEY = "lolseteazero:roomClientId";
const IDENTITY_KEY = "lolseteazero:roomIdentity";

export interface MinimalStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/** Storage que nunca faz nada — usado quando o acesso ao real lanca. */
const NOOP_STORAGE: MinimalStorage = {
  getItem: () => null,
  setItem: () => {},
};

/**
 * Le a propriedade de storage (ex.: window.localStorage) com seguranca: em
 * alguns navegadores/configuracoes (contextos sandboxed, "bloquear todos os
 * cookies") o proprio acesso a propriedade lanca, nao so getItem/setItem.
 * Devolve um storage inofensivo nesse caso em vez de propagar a excecao.
 */
export function safeStorage(getStorage: () => MinimalStorage = () => window.localStorage): MinimalStorage {
  try {
    // `?? NOOP_STORAGE`: um provedor pode devolver undefined sem lancar, e um
    // undefined solto aqui viraria um TypeError longe daqui.
    return getStorage() ?? NOOP_STORAGE;
  } catch {
    return NOOP_STORAGE;
  }
}

/** localStorage pode lancar (aba privada, cookies bloqueados) — nunca propagar. */
export function storedClientId(storage: MinimalStorage): string | null {
  try {
    return storage.getItem(CLIENT_ID_KEY);
  } catch {
    return null;
  }
}

export function rememberClientId(storage: MinimalStorage, clientId: string): void {
  try {
    storage.setItem(CLIENT_ID_KEY, clientId);
  } catch {
    // sem memoria de reconexao neste navegador; a sala ainda funciona
  }
}

/** Apelido e time da ultima entrada -- para voltar a sala sem refazer o formulario. */
export interface RoomIdentity {
  nickname: string;
  /** Vazio para quem entrou como espectador. */
  teamName: string;
}

export function storedIdentity(storage: MinimalStorage): RoomIdentity | null {
  try {
    const raw = storage.getItem(IDENTITY_KEY);
    if (raw === null) return null;
    const data = JSON.parse(raw) as Partial<RoomIdentity>;
    if (typeof data.nickname !== "string" || data.nickname.trim() === "") return null;
    return { nickname: data.nickname, teamName: typeof data.teamName === "string" ? data.teamName : "" };
  } catch {
    return null;
  }
}

export function rememberIdentity(storage: MinimalStorage, identity: RoomIdentity): void {
  try {
    storage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // sem memoria neste navegador: na proxima visita o formulario volta
  }
}

/** Devolve null em vez de lancar: mensagem estranha e descartada, nao quebra a tela. */
export function parseServerMessage(raw: string): ServerMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  const parsed = ServerMessageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export interface RoomClientHandlers {
  onMessage: (msg: ServerMessage) => void;
  onClose: () => void;
  /**
   * Chegou alguma coisa pelo socket que nao virou um ServerMessage — JSON
   * quebrado ou um `type` que esta versao do protocolo nao conhece (por
   * exemplo, um servidor mais novo). Sem isso a mensagem simplesmente some:
   * a tela fica presa no ultimo roomState valido e ninguem sabe por que.
   * Opcional para nao quebrar quem construiu RoomClientHandlers antes desta
   * mensagem existir.
   */
  onUnparseable?: (raw: string) => void;
}

/** O tanto de WebSocket que o RoomClient usa — permite injetar um falso nos testes. */
export interface RoomSocket {
  readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "message", listener: (ev: { data: string }) => void): void;
  addEventListener(type: "close", listener: () => void): void;
}

export type RoomSocketFactory = (url: string) => RoomSocket;

/** Estados do WebSocket, fixados pela especificacao. */
const CONNECTING = 0;
const OPEN = 1;

const abrirSocketReal: RoomSocketFactory = (url) => new WebSocket(url);

export class RoomClient {
  #socket: RoomSocket;
  /** Mensagens enviadas antes do socket abrir — sem isso o hello se perde. */
  #pendentes: ClientMessage[] = [];

  constructor(
    url: string,
    handlers: RoomClientHandlers,
    abrirSocket: RoomSocketFactory = abrirSocketReal
  ) {
    this.#socket = abrirSocket(url);

    this.#socket.addEventListener("open", () => {
      const fila = this.#pendentes;
      this.#pendentes = [];
      for (const msg of fila) this.#socket.send(JSON.stringify(msg));
    });

    this.#socket.addEventListener("message", (ev: { data: string }) => {
      const msg = parseServerMessage(ev.data);
      if (msg === null) {
        console.error("[rede] mensagem do servidor nao reconhecida:", ev.data);
        handlers.onUnparseable?.(ev.data);
        return;
      }
      if (msg.type === "ping") {
        this.send({ type: "pong" });
        return;
      }
      handlers.onMessage(msg);
    });
    this.#socket.addEventListener("close", handlers.onClose);
  }

  /**
   * Devolve `true` quando a mensagem foi enfileirada (socket ainda CONNECTING)
   * ou mandada de verdade (OPEN), `false` quando foi descartada por falta de
   * conexao. Quem chama decide o que fazer com um envio que nao aconteceu —
   * aqui so se sabe se o fio existia.
   */
  send(msg: ClientMessage): boolean {
    if (this.#socket.readyState === CONNECTING) {
      this.#pendentes.push(msg);
      return true;
    }
    if (this.#socket.readyState !== OPEN) return false;
    this.#socket.send(JSON.stringify(msg));
    return true;
  }

  close(): void {
    this.#socket.close();
  }
}

/** URL do WebSocket da sala derivada da pagina atual. */
export function roomSocketUrl(location: Location): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws`;
}

export { PROTOCOL_VERSION };
