/**
 * server/room/base.ts
 *
 * Base de jogadores da sala: copiada do repositorio na primeira subida,
 * publicada pelo host, servida em /players.json.
 */

import { copyFile, mkdir, access, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { validatePlayerDatabase, writePlayerDatabase } from "../engine/index";

const BASE_FILE = "players.json";
const BACKUP_FILE = "players.backup.json";

async function existe(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** Garante uma base na sala e devolve o caminho dela. */
export async function ensureRoomBase(roomDataDir: string, seedFile: string): Promise<string> {
  await mkdir(roomDataDir, { recursive: true });
  const file = join(roomDataDir, BASE_FILE);
  if (!(await existe(file))) {
    await copyFile(seedFile, file);
  }
  return file;
}

/**
 * Valida e publica a base nova, guardando a anterior em players.backup.json.
 * Lanca com mensagem legivel quando a base e invalida — nada e sobrescrito.
 */
export async function publishRoomBase(roomDataDir: string, raw: unknown): Promise<number> {
  const result = validatePlayerDatabase(raw);
  if (!result.ok) {
    throw new Error(result.error);
  }

  const file = join(roomDataDir, BASE_FILE);
  if (await existe(file)) {
    const backup = join(roomDataDir, BACKUP_FILE);
    const tmp = `${backup}.tmp`;
    await writeFile(tmp, await readFile(file, "utf8"), "utf8");
    try {
      await rename(tmp, backup);
    } catch (err) {
      await unlink(tmp).catch(() => undefined);
      throw err;
    }
  }

  await writePlayerDatabase(file, raw);
  return result.players.length;
}
