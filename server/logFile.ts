/**
 * server/logFile.ts
 *
 * Espelha console.log/warn/error num arquivo em disco. Achado do teste
 * inicial da sala multiplayer (2026-08-27): o servidor so imprimia no
 * terminal, entao o rastro de uma sessao de teste sumia assim que o terminal
 * fechava, sem jeito de investigar depois o que deu errado.
 */

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const NIVEIS = ["log", "warn", "error"] as const;
type Nivel = (typeof NIVEIS)[number];

function paraTexto(valor: unknown): string {
  if (typeof valor === "string") return valor;
  if (valor instanceof Error) return valor.stack ?? `${valor.name}: ${valor.message}`;
  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}

function formatarLinha(nivel: Nivel, args: unknown[]): string {
  const texto = args.map(paraTexto).join(" ");
  return `[${new Date().toISOString()}] [${nivel}] ${texto}\n`;
}

/**
 * Sobrescreve `roomDataDir/server.log` (comeca zerado a cada subida do
 * servidor) e passa a duplicar toda chamada de console.log/warn/error nesse
 * arquivo, sem deixar de imprimir no terminal como sempre.
 */
export function espelharConsoleEmArquivo(roomDataDir: string): void {
  mkdirSync(roomDataDir, { recursive: true });
  const arquivo = join(roomDataDir, "server.log");
  writeFileSync(arquivo, "");

  for (const nivel of NIVEIS) {
    const original = console[nivel].bind(console);
    console[nivel] = (...args: unknown[]) => {
      original(...args);
      try {
        appendFileSync(arquivo, formatarLinha(nivel, args));
      } catch {
        // best-effort -- nunca derruba o servidor por causa do log
      }
    };
  }
}
