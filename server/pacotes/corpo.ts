/**
 * server/pacotes/corpo.ts
 *
 * Le o corpo do pedido com teto de tamanho. Passou do teto: rejeita, mas
 * continua drenando o pedido para a resposta 413 chegar inteira.
 */

import type { IncomingMessage } from "node:http";

export class CorpoGrandeDemais extends Error {
  constructor() {
    super("corpo grande demais");
  }
}

export function lerCorpo(req: IncomingMessage, limite: number): Promise<Buffer> {
  return new Promise((ok, falha) => {
    const partes: Buffer[] = [];
    let total = 0;
    let estourou = false;
    req.on("data", (parte: Buffer) => {
      if (estourou) return;
      total += parte.length;
      if (total > limite) {
        estourou = true;
        falha(new CorpoGrandeDemais());
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => {
      if (!estourou) ok(Buffer.concat(partes));
    });
    req.on("error", falha);
  });
}
