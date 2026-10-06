/**
 * server/pacotes/dono.ts
 *
 * Quem pode escrever nos arquivos do jogo (E-11). Pelo servidor da sala, só o
 * token privado do dono (no modo manual, começa igual ao do host). Checar
 * "veio do localhost" não serve: pelo túnel, o cloudflared também conecta
 * pelo localhost. No
 * npm run dev (sem tunel), o plugin do Vite usa ehLoopback.
 */

import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { gravarAtomico } from "./arquivos";

/**
 * O token do dono vive em dono.token na pasta de dados da sala. Sala nova:
 * usa o token do host no modo manual, ou gera outro no automático. Sala
 * restaurada: vale o do arquivo, porque o token da SALA
 * gira a cada transferencia de host e e salvo no snapshot (um amigo que ganhou
 * o host viraria dono depois de reiniciar). Sem arquivo (sala antiga): usa
 * o token do host no modo manual, ou gera outro no automático.
 * Outros erros de leitura propagam.
 */
export async function lembrarTokenDoDono(
  dir: string,
  hostToken: string,
  salaNova: boolean,
  hostAuto = false
): Promise<string> {
  const arquivo = join(dir, "dono.token");
  if (!salaNova) {
    try {
      const guardado = (await readFile(arquivo, "utf8")).trim();
      if (guardado !== "") return guardado;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  // O link comum e a promoção a host nunca autorizam escrita no editor.
  const token = hostAuto ? randomUUID() : hostToken;
  await gravarAtomico(arquivo, token);
  return token;
}

export function tokenConfere(recebido: unknown, esperado: string): boolean {
  if (typeof recebido !== "string") return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** O token e capturado uma vez: transferir o host da sala nao muda o dono. */
export function checagemDoDono(tokenDoArranque: string): (req: IncomingMessage) => boolean {
  return (req) => tokenConfere(req.headers["x-dono"], tokenDoArranque);
}

/**
 * Pedido da propria pagina (E-11, spec 6.3). Loopback sozinho nao basta no Vite:
 * qualquer site aberto no navegador do dono alcanca localhost. Sem origin (curl)
 * vale; com origin, tem de ser o mesmo host; sec-fetch-site so pode ser
 * same-origin ou none.
 */
export function mesmaOrigem(headers: IncomingHttpHeaders): boolean {
  const origin = headers.origin;
  const host = headers.host;
  const site = headers["sec-fetch-site"];
  if (Array.isArray(origin) || Array.isArray(host) || Array.isArray(site)) return false;
  if (origin !== undefined) {
    if (host === undefined) return false;
    try {
      if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) return false;
    } catch {
      return false;
    }
  }
  return site === undefined || site === "same-origin" || site === "none";
}

export function ehLoopback(endereco: string | undefined): boolean {
  return endereco === "127.0.0.1" || endereco === "::1" || endereco === "::ffff:127.0.0.1";
}
