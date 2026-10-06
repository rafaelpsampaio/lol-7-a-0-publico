import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ensureRoomBase, publishRoomBase } from "./base";

const SEED = resolve(process.cwd(), "public/players.json");

async function dirTemp(): Promise<string> {
  return mkdtemp(join(tmpdir(), "lol7a0-base-"));
}

describe("ensureRoomBase", () => {
  it("copia o players.json do repositorio na primeira vez", async () => {
    const dir = await dirTemp();
    const file = await ensureRoomBase(dir, SEED);

    expect(file).toBe(join(dir, "players.json"));
    expect(await readFile(file, "utf8")).toBe(await readFile(SEED, "utf8"));
  });

  it("nao sobrescreve uma base ja existente", async () => {
    const dir = await dirTemp();
    await ensureRoomBase(dir, SEED);
    const file = join(dir, "players.json");
    const conteudo = JSON.parse(await readFile(SEED, "utf8")) as { players: unknown[] };
    conteudo.players = conteudo.players.slice(0, 5);
    await writeFile(file, JSON.stringify(conteudo), "utf8");

    await ensureRoomBase(dir, SEED);

    const depois = JSON.parse(await readFile(file, "utf8")) as { players: unknown[] };
    expect(depois.players).toHaveLength(5);
  });
});

describe("publishRoomBase", () => {
  it("grava a base nova e devolve a contagem", async () => {
    const dir = await dirTemp();
    await ensureRoomBase(dir, SEED);
    const raw = JSON.parse(await readFile(SEED, "utf8")) as { players: unknown[] };

    const count = await publishRoomBase(dir, raw);

    expect(count).toBe(raw.players.length);
  });

  it("guarda backup da base anterior", async () => {
    const dir = await dirTemp();
    await ensureRoomBase(dir, SEED);
    const original = await readFile(join(dir, "players.json"), "utf8");
    const raw = JSON.parse(original) as { players: unknown[] };
    raw.players = raw.players.slice(0, 10);

    await publishRoomBase(dir, raw);

    expect(await readFile(join(dir, "players.backup.json"), "utf8")).toBe(original);
  });

  it("recusa base invalida e mantem a anterior intacta", async () => {
    const dir = await dirTemp();
    await ensureRoomBase(dir, SEED);
    const original = await readFile(join(dir, "players.json"), "utf8");

    await expect(publishRoomBase(dir, { players: [{ id: "quebrado" }] })).rejects.toThrow();

    expect(await readFile(join(dir, "players.json"), "utf8")).toBe(original);
  });

  it("nao deixa arquivo temporario de backup para tras", async () => {
    const dir = await dirTemp();
    await ensureRoomBase(dir, SEED);
    const raw = JSON.parse(await readFile(SEED, "utf8")) as { players: unknown[] };

    await publishRoomBase(dir, raw);

    await expect(readFile(join(dir, "players.backup.json.tmp"), "utf8")).rejects.toThrow();
  });
});
