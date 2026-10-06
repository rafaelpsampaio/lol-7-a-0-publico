import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { espelharConsoleEmArquivo } from "./logFile";

async function dirTemp(): Promise<string> {
  return mkdtemp(join(tmpdir(), "lol7a0-log-"));
}

const originais = { log: console.log, warn: console.warn, error: console.error };

afterEach(() => {
  console.log = originais.log;
  console.warn = originais.warn;
  console.error = originais.error;
});

describe("espelharConsoleEmArquivo", () => {
  it("grava o que passa por console.log/warn/error em server.log", async () => {
    const dir = await dirTemp();
    espelharConsoleEmArquivo(dir);

    console.log("ola mundo");
    console.warn("cuidado");
    console.error("deu ruim");

    const conteudo = await readFile(join(dir, "server.log"), "utf8");
    expect(conteudo).toContain("[log] ola mundo");
    expect(conteudo).toContain("[warn] cuidado");
    expect(conteudo).toContain("[error] deu ruim");
  });

  it("formata Error com stack em vez de virar {}", async () => {
    const dir = await dirTemp();
    espelharConsoleEmArquivo(dir);

    console.error("falha ao salvar:", new Error("disco cheio"));

    const conteudo = await readFile(join(dir, "server.log"), "utf8");
    expect(conteudo).toContain("Error: disco cheio");
  });

  it("comeca um arquivo novo a cada chamada, sem herdar log da subida anterior", async () => {
    const dir = await dirTemp();
    espelharConsoleEmArquivo(dir);
    console.log("sessao 1");

    espelharConsoleEmArquivo(dir);
    console.log("sessao 2");

    const conteudo = await readFile(join(dir, "server.log"), "utf8");
    expect(conteudo).not.toContain("sessao 1");
    expect(conteudo).toContain("sessao 2");
  });

  it("ainda chama o destino original do console com o espelhamento ligado", async () => {
    const dir = await dirTemp();
    const chamadas: unknown[][] = [];
    console.log = (...args: unknown[]) => chamadas.push(args);

    espelharConsoleEmArquivo(dir);
    console.log("teste");

    expect(chamadas).toEqual([["teste"]]);
  });
});
