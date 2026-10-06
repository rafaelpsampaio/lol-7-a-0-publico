/**
 * server/engine/index.test.ts
 *
 * A restricao global do plano e literal: escritas em server/data/ sao atomicas
 * (tmp + rename, unlink do tmp se o rename falhar), sem excecao. A revisao
 * final mostrou que ela era a propriedade mais citada do plano e a unica que
 * nenhum teste observava: trocar `writeFile(tmp) + rename` por `writeFile(file)`
 * direto deixava a suite inteira verde (mutacao M7). Estes testes fecham isso.
 */

import { describe, it, expect } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validatePlayerDatabase, writePlayerDatabase } from "./index";

const SEED = resolve(process.cwd(), "public/players.json");

async function dirTemp(): Promise<string> {
  return mkdtemp(join(tmpdir(), "lol7a0-engine-"));
}

async function baseValida(): Promise<unknown> {
  return JSON.parse(await readFile(SEED, "utf8")) as unknown;
}

async function existe(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

describe("writePlayerDatabase", () => {
  it("grava uma base valida e ela volta a ler igual", async () => {
    const dir = await dirTemp();
    const file = join(dir, "players.json");
    const raw = await baseValida();

    await writePlayerDatabase(file, raw);

    const lido = JSON.parse(await readFile(file, "utf8")) as unknown;
    expect(validatePlayerDatabase(lido).ok).toBe(true);
    expect(lido).toEqual(raw);
  });

  it("recusa base invalida sem encostar no arquivo antigo", async () => {
    const dir = await dirTemp();
    const file = join(dir, "players.json");
    await writePlayerDatabase(file, await baseValida());
    const antes = await readFile(file, "utf8");

    await expect(writePlayerDatabase(file, { players: [{ id: "quebrado" }] })).rejects.toThrow();

    expect(await readFile(file, "utf8")).toBe(antes);
  });

  it("nao deixa arquivo .tmp para tras numa gravacao que deu certo", async () => {
    const dir = await dirTemp();
    const file = join(dir, "players.json");
    await writePlayerDatabase(file, await baseValida());
    expect(await existe(`${file}.tmp`)).toBe(false);
  });

  it("escreve primeiro no .tmp: se essa gravacao falhar, a base antiga fica inteira", async () => {
    // Mata a mutacao M7 da revisao (tmp + rename -> writeFile direto no
    // arquivo final). Com um DIRETORIO ocupando o caminho do .tmp, a gravacao
    // do temporario falha e nada chega ao players.json — que e exatamente o
    // ponto da atomicidade: uma queda no meio da escrita nunca deixa a base
    // truncada, e uma base truncada derruba o arranque do servidor
    // (readPlayerDatabase falha e o main.ts faz process.exit(1)).
    //
    // Sem tmp + rename, a escrita cai direto no arquivo final, o diretorio
    // preso no caminho do .tmp nao atrapalha nada, a promessa RESOLVE e a base
    // antiga vai embora — as duas assercoes abaixo caem.
    const dir = await dirTemp();
    const file = join(dir, "players.json");
    await writePlayerDatabase(file, await baseValida());
    const antes = await readFile(file, "utf8");

    await mkdir(`${file}.tmp`);

    await expect(writePlayerDatabase(file, { players: [] })).rejects.toThrow();
    expect(await readFile(file, "utf8")).toBe(antes);
  });

  it("apaga o .tmp quando o rename falha, em vez de deixar lixo para sempre", async () => {
    // A restricao global pede o unlink do tmp quando o rename falha — um
    // rename que falha de verdade (EPERM por antivirus no Windows, EXDEV,
    // disco cheio) deixava server/data/players.json.tmp para tras para sempre.
    // O persistence.ts e o base.ts ja faziam o unlink; este arquivo nao fazia.
    //
    // Aqui o rename falha porque o destino e um diretorio: a gravacao do tmp
    // da certo, o rename nao tem como substituir uma pasta por um arquivo.
    const dir = await dirTemp();
    const alvo = join(dir, "players.json");
    await mkdir(alvo);

    await expect(writePlayerDatabase(alvo, await baseValida())).rejects.toThrow();

    expect(await existe(`${alvo}.tmp`)).toBe(false);
  });

  it("uma base invalida nem chega a criar o .tmp", async () => {
    const dir = await dirTemp();
    const file = join(dir, "players.json");
    await writeFile(file, "{}", "utf8");

    await expect(writePlayerDatabase(file, { players: [{ id: "quebrado" }] })).rejects.toThrow();

    expect(await existe(`${file}.tmp`)).toBe(false);
  });
});
