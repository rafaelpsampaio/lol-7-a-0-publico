import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/** A distribuicao guarda arquivos editaveis fora da pasta da versao. */
export async function appPaths(projectRoot: string, dataRoot?: string) {
  if (!dataRoot) return {
    roomDataDir: resolve(projectRoot, "server/data"),
    raizPublic: resolve(projectRoot, "public"),
  };
  const raizPublic = resolve(dataRoot, "public");
  await mkdir(raizPublic, { recursive: true });
  // Copia inicial unica: nao ressuscita pacotes/fotos apagados pelo usuario.
  const marker = resolve(raizPublic, ".initialized");
  try {
    await readFile(marker);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    for (const name of ["players.json", "packs", "players"]) {
      await cp(resolve(projectRoot, "public", name), resolve(raizPublic, name), {
        recursive: true, force: false, errorOnExist: false,
      });
    }
    await writeFile(marker, "1\n");
  }
  return { roomDataDir: resolve(dataRoot, "room"), raizPublic };
}
