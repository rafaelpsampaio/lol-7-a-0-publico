/**
 * server/engine/index.ts
 *
 * UNICO arquivo do servidor autorizado a importar codigo do jogo (src/).
 * Se o outro builder mudar uma assinatura, quebra aqui e em contract.test.ts —
 * nao espalhado pelo servidor inteiro.
 *
 * NAO usar src/data/loader.ts: ele faz fetch("/players.json"), caminho de
 * navegador. No servidor a base vem do disco.
 */

import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { PlayerDatabaseSchema, ChampionCatalogueSchema, type PlayerVersion, type ChampionEntry } from "./schema";

// Reexporta o portal inteiro para quem ja importava de "./index" continuar
// funcionando. Sem um `export type { PlayerVersion }` extra: o `export *` ja
// leva o tipo, e a segunda linha seria identificador duplicado.
export * from "./schema";

export type ValidateResult =
  | { ok: true; players: PlayerVersion[] }
  | { ok: false; error: string };

/** Valida um objeto bruto no formato players.json. Nunca lanca. */
export function validatePlayerDatabase(raw: unknown): ValidateResult {
  const parsed = PlayerDatabaseSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join(".") ?? "(raiz)";
    return { ok: false, error: `${path}: ${first?.message ?? "formato invalido"}` };
  }
  return { ok: true, players: parsed.data.players };
}

/** Le e valida uma base do disco. Arquivo ausente ou JSON quebrado vira ok:false. */
export async function readPlayerDatabase(file: string): Promise<ValidateResult> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return { ok: false, error: `nao foi possivel ler ${file}` };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: `${file} nao e um JSON valido` };
  }

  return validatePlayerDatabase(raw);
}

/**
 * Grava uma base validada de forma atomica (tmp + rename).
 * Lanca se a base for invalida — o arquivo antigo fica intacto.
 *
 * O unlink do tmp quando o rename falha e o que a restricao global pede e o que
 * o persistence.ts e o base.ts ja faziam; aqui faltava (M-1 da revisao final).
 * Um rename que falha de verdade — EPERM por antivirus no Windows, EXDEV, disco
 * cheio — deixava server/data/players.json.tmp para tras para sempre. O erro
 * original e relancado: quem chama precisa saber que a base NAO foi publicada.
 */
export async function writePlayerDatabase(file: string, raw: unknown): Promise<void> {
  const result = validatePlayerDatabase(raw);
  if (!result.ok) {
    throw new Error(`base invalida: ${result.error}`);
  }
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(raw, null, 2), "utf8");
  try {
    await rename(tmp, file);
  } catch (err) {
    await unlink(tmp).catch(() => undefined);
    throw err;
  }
}

export type CatalogueResult =
  | { ok: true; champions: ChampionEntry[] }
  | { ok: false; error: string };

/** Le e valida um champions.json do disco. Nunca lanca. */
export async function readChampionCatalogue(file: string): Promise<CatalogueResult> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (e) {
    return { ok: false, error: `nao consegui ler ${file}: ${(e as Error).message}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (e) {
    return { ok: false, error: `${file} nao e JSON valido: ${(e as Error).message}` };
  }
  const result = ChampionCatalogueSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }
  return { ok: true, champions: result.data.champions };
}
