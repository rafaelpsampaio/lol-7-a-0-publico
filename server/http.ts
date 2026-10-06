/**
 * server/http.ts
 *
 * Camada HTTP do servidor de salas: estatico do dist/ + /healthz.
 * Sem estado — recebe os caminhos por parametro.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import sirv from "sirv";
import { PROTOCOL_VERSION } from "./protocol";

export interface HttpOptions {
  /** Diretorio do build do app (normalmente dist/) */
  distDir: string;
  /** Arquivo players.json da sala — servido em /players.json */
  roomBaseFile: string;
  /**
   * A base que vem com o jogo (public/players.json), servida em
   * /api/base-padrao: o lobby oferece "Base padrão do jogo" para o host voltar
   * a ela depois de publicar outra (D10). /players.json nao serve para isso --
   * ali e a base da sala, que pode ja ser outra.
   */
  defaultBaseFile?: string;
  /**
   * Links que o lobby oferece aos amigos (LAN e, com --tunnel, o publico).
   * Funcao, nao lista: o link do tunel so aparece depois do arranque. Nunca
   * leva o token de host -- o convite antigo levava, e quem entrava por ele
   * virava host (Rundown da Sala 2, achado 3).
   */
  convites?: () => string[];
  /**
   * Verdadeiro enquanto o tunel (--tunnel) foi pedido mas o link publico ainda
   * nao saiu. O lobby usa isso para continuar perguntando ao servidor em vez
   * de ficar para sempre sem o link https.
   */
  aguardandoTunel?: () => boolean;
  /**
   * Fase atual da sala. Quem abre o link ainda nao entrou (nao tem socket) e
   * precisa saber se vai escolher um time (lobby) ou entrar para assistir.
   */
  fase?: () => string;
  /** Quantos jogadores estao conectados na sala (menu do dono, E-04). */
  conectados?: () => number;
  hostAuto?: () => boolean;
  /**
   * Rotas do editor de pacotes (server/pacotes/handler.ts). Devolve true quando
   * a rota e dele; vem antes do dist/ para /packs e /players sairem de public/.
   */
  pacotes?: (req: IncomingMessage, res: ServerResponse) => boolean;
}

export function createHttpHandler(
  opts: HttpOptions
): (req: IncomingMessage, res: ServerResponse) => void {
  // single: true — SPA, rota desconhecida cai no index.html
  const serveStatic = sirv(opts.distDir, { single: true, dev: false });

  return function handle(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? "/";

    if (url === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }

    if (opts.pacotes?.(req, res) === true) return;

    if (url === "/api/room-info") {
      // no-store: o conteudo muda (o link do tunel aparece depois do arranque)
      // e o lobby consulta a rota em repeticao.
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(
        JSON.stringify({
          room: true,
          protocolVersion: PROTOCOL_VERSION,
          convites: opts.convites?.() ?? [],
          aguardandoTunel: opts.aguardandoTunel?.() ?? false,
          fase: opts.fase?.() ?? "lobby",
          conectados: opts.conectados?.() ?? 0,
          hostAuto: opts.hostAuto?.() ?? false,
        })
      );
      return;
    }

    if (url === "/api/base-padrao" && opts.defaultBaseFile !== undefined) {
      readFile(opts.defaultBaseFile, "utf8")
        .then((text) => {
          res.writeHead(200, {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          });
          res.end(text);
        })
        .catch(() => {
          res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
          res.end("base padrao indisponivel");
        });
      return;
    }

    // A base da sala vence o arquivo estatico de mesmo nome: e ela que vale.
    if (url === "/players.json") {
      readFile(opts.roomBaseFile, "utf8")
        .then((text) => {
          res.writeHead(200, {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          });
          res.end(text);
        })
        .catch(() => {
          res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
          res.end("base da sala indisponivel");
        });
      return;
    }

    serveStatic(req, res, () => {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("nao encontrado");
    });
  };
}

export function createHttpServer(opts: HttpOptions): Server {
  return createServer(createHttpHandler(opts));
}
