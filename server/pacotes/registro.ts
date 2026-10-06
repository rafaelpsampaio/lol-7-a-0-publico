/**
 * server/pacotes/registro.ts
 *
 * Onde mora cada pacote (secao 5 da spec 2026-10-05-editor-de-pacotes-design):
 * "pros" e public/players.json; os outros sao public/packs/<id>.json.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ID_VALIDO } from "../engine/pacotes";

export const ID_DOS_PROS = "pros";

/** Caminho do arquivo do pacote, ou null se o id nao pode virar nome de arquivo. */
export function arquivoDoPacote(raizPublic: string, id: string): string | null {
  if (id === ID_DOS_PROS) return join(raizPublic, "players.json");
  if (!ID_VALIDO.test(id)) return null;
  return join(raizPublic, "packs", `${id}.json`);
}

/** Pros primeiro, depois os arquivos de public/packs em ordem alfabetica. */
export async function idsDosPacotes(raizPublic: string): Promise<string[]> {
  let nomes: string[] = [];
  try {
    nomes = await readdir(join(raizPublic, "packs"));
  } catch (e) {
    // sem a pasta: so os pros. Qualquer outro erro propaga: listar errado faria
    // a checagem de foto em uso (Review Focus 5) olhar so os pros.
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const ids = nomes
    .filter((n) => n.endsWith(".json"))
    .map((n) => n.slice(0, -".json".length))
    .filter((id) => ID_VALIDO.test(id) && id !== ID_DOS_PROS)
    .sort();
  return [ID_DOS_PROS, ...ids];
}
