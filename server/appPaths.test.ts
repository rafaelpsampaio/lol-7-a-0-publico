import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { appPaths } from "./appPaths";

test("atualizacao preserva edicoes e nao restaura pacotes apagados", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "lol-app-"));
  try {
    const project = resolve(root, "version");
    const data = resolve(root, "data");
    await mkdir(resolve(project, "public/packs"), { recursive: true });
    await mkdir(resolve(project, "public/players"));
    await writeFile(resolve(project, "public/players.json"), "original");
    await writeFile(resolve(project, "public/packs/amigos.json"), "original");
    const paths = await appPaths(project, data);
    await writeFile(resolve(paths.raizPublic, "players.json"), "editado");
    await unlink(resolve(paths.raizPublic, "packs/amigos.json"));
    await writeFile(resolve(project, "public/players.json"), "atualizado");
    expect(await appPaths(project, data)).toEqual(paths);
    expect(await readFile(resolve(paths.raizPublic, "players.json"), "utf8")).toBe("editado");
    await expect(readFile(resolve(paths.raizPublic, "packs/amigos.json"))).rejects.toMatchObject({ code: "ENOENT" });
    expect((await appPaths(project)).roomDataDir).toBe(resolve(project, "server/data"));
  } finally { await rm(root, { recursive: true, force: true }); }
});
