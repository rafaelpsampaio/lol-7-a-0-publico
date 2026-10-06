/**
 * scripts/normalizar-pacotes.ts
 *
 * Migracao unica da spec 2026-10-05-editor-de-pacotes-design (secao 9): toda
 * carta passa a ter uma rota so e forca = nota geral (E-06, E-07), e os
 * arquivos ganham o campo name. Rodar de novo nao muda nada.
 *
 * Uso: npx tsx scripts/normalizar-pacotes.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PlayerDatabaseSchema } from "../src/data/schema";
import { normalizarCarta, validarPacote } from "../src/pacotes/regrasDaCarta";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALVOS = [
  ["public/players.json", "Pros / Mundial"],
  ["public/packs/amigos.json", "Amigos"],
] as const;

for (const [caminho, nome] of ALVOS) {
  const arquivo = resolve(RAIZ, caminho);
  const db = PlayerDatabaseSchema.parse(JSON.parse(readFileSync(arquivo, "utf8")));
  const players = db.players.map(normalizarCarta);
  const erros = validarPacote(players);
  if (erros.length > 0) throw new Error(`${caminho} fora das regras: ${JSON.stringify(erros, null, 2)}`);

  const saida =
    db.$schema === undefined
      ? { name: db.name ?? nome, players }
      : { $schema: db.$schema, name: db.name ?? nome, players };
  writeFileSync(arquivo, `${JSON.stringify(saida, null, 2)}\n`, "utf8");

  const mudaram = players.filter((c, i) => c.roleStrength[c.primaryRole] !== db.players[i]!.roleStrength[c.primaryRole]);
  console.log(`${caminho}: ${mudaram.length} de ${players.length} cartas mudaram de forca.`);
  for (const c of mudaram) {
    const antes = db.players.find((a) => a.id === c.id)!;
    console.log(`  ${c.id}: ${antes.roleStrength[c.primaryRole]} -> ${c.roleStrength[c.primaryRole]}`);
  }
}
