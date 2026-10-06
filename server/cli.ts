/**
 * server/cli.ts
 *
 * Leitura de flags e montagem dos links impressos no arranque.
 * Puro: nao le processo nem rede alem de networkInterfaces.
 */

import { networkInterfaces } from "node:os";

export const DEFAULT_PORT = 7070;

export interface CliArgs {
  port: number;
  tunnel: boolean;
  /** Ignora e apaga o snapshot anterior: comeca uma sala limpa. */
  novaSala: boolean;
  /** Primeiro jogador assume a sala; quedas prolongadas transferem o controle. */
  hostAuto: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  let port = DEFAULT_PORT;
  let tunnel = false;
  let novaSala = false;
  let hostAuto = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg === "--host-auto") {
      hostAuto = true;
      continue;
    }

    if (arg === "--tunnel") {
      tunnel = true;
      continue;
    }

    if (arg === "--nova-sala") {
      novaSala = true;
      continue;
    }

    const valor = arg.startsWith("--port=") ? arg.slice("--port=".length) : arg === "--port" ? argv[++i] : undefined;

    if (valor !== undefined) {
      const n = Number(valor);
      if (Number.isInteger(n) && n > 0 && n < 65536) port = n;
    }
  }

  return { port, tunnel, novaSala, hostAuto };
}

/**
 * Ordem de preferencia dos links de LAN impressos e oferecidos no lobby: a
 * rede de casa primeiro (192.168, depois 10.*), 172.16-31 por ultimo -- e a
 * faixa dos adaptadores virtuais (Hyper-V, WSL, Docker), que nenhum amigo
 * alcanca. No teste de 2026-10-01 o 172.31.48.1 saia antes do 192.168.
 */
export function ordenarLan(urls: string[]): string[] {
  const peso = (u: string): number => {
    const ip = new URL(u).hostname;
    if (ip.startsWith("192.168.")) return 0;
    if (ip.startsWith("10.")) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 3;
    return 2;
  };
  return [...urls].sort((a, b) => peso(a) - peso(b));
}

export function hostUrls(port: number, hostToken: string): { local: string; lan: string[] } {
  const lan: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        lan.push(`http://${addr.address}:${port}/`);
      }
    }
  }
  return { local: `http://localhost:${port}/?host=${hostToken}`, lan: ordenarLan(lan) };
}
