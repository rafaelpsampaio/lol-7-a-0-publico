import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gravarAtomico, motivoDoErroDeDisco, textoDoPacote } from "./arquivos";

describe("gravarAtomico", () => {
  it("duas gravacoes simultaneas: o arquivo fica com um conteudo inteiro e sem tmp sobrando", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lol7a0-atomico-"));
    try {
      const arquivo = join(dir, "pacote.json");
      const a = "A".repeat(200_000);
      const b = "B".repeat(200_000);
      await Promise.all([gravarAtomico(arquivo, a), gravarAtomico(arquivo, b)]);
      const final = await readFile(arquivo, "utf8");
      expect([a, b]).toContain(final);
      expect(await readdir(dir)).toEqual(["pacote.json"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rename que falha nao deixa o tmp para tras", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lol7a0-atomico-"));
    try {
      // Um diretorio no lugar do arquivo: o rename falha (EISDIR no Linux, EPERM no Windows).
      await mkdir(join(dir, "alvo.json"));
      await expect(gravarAtomico(join(dir, "alvo.json"), "{}")).rejects.toThrow();
      expect(await readdir(dir)).toEqual(["alvo.json"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  const travado = (code: string) => Object.assign(new Error(`${code}: trava`), { code });

  it("rename com EPERM duas vezes e depois ok: grava e nao deixa tmp (revisao final M8)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lol7a0-atomico-"));
    try {
      const arquivo = join(dir, "pacote.json");
      let chamadas = 0;
      await gravarAtomico(arquivo, "{}", {
        esperasMs: [1, 1, 1],
        renomear: async (de, para) => {
          if (++chamadas <= 2) throw travado("EPERM");
          await rename(de, para);
        },
      });
      expect(chamadas).toBe(3);
      expect(await readFile(arquivo, "utf8")).toBe("{}");
      expect(await readdir(dir)).toEqual(["pacote.json"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rename que trava sempre desiste depois de 1 + 3 tentativas e limpa o tmp", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lol7a0-atomico-"));
    try {
      let chamadas = 0;
      await expect(
        gravarAtomico(join(dir, "pacote.json"), "{}", {
          esperasMs: [1, 1, 1],
          renomear: async () => {
            chamadas++;
            throw travado("EBUSY");
          },
        })
      ).rejects.toThrow(/EBUSY/);
      expect(chamadas).toBe(4);
      expect(await readdir(dir)).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("erro que nao e de trava nao tenta de novo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lol7a0-atomico-"));
    try {
      let chamadas = 0;
      await expect(
        gravarAtomico(join(dir, "pacote.json"), "{}", {
          esperasMs: [1, 1, 1],
          renomear: async () => {
            chamadas++;
            throw travado("ENOSPC");
          },
        })
      ).rejects.toThrow(/ENOSPC/);
      expect(chamadas).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("motivoDoErroDeDisco", () => {
  const com = (code?: string) => Object.assign(new Error("C:/segredo/x"), code === undefined ? {} : { code });
  it("traduz o errno e nunca devolve o texto do erro", () => {
    expect(motivoDoErroDeDisco(com("EACCES"))).toBe("sem permissão no disco");
    expect(motivoDoErroDeDisco(com("EPERM"))).toBe("sem permissão no disco");
    expect(motivoDoErroDeDisco(com("EBUSY"))).toBe("arquivo em uso por outro programa");
    expect(motivoDoErroDeDisco(com("ENOSPC"))).toBe("disco cheio");
    expect(motivoDoErroDeDisco(com("ENOTDIR"))).toBe("falha de disco");
    expect(motivoDoErroDeDisco(com())).toBe("falha de disco");
    expect(motivoDoErroDeDisco("texto")).toBe("falha de disco");
    expect(motivoDoErroDeDisco(null)).toBe("falha de disco");
  });
});

describe("textoDoPacote", () => {
  it("$schema, name e players nessa ordem, com quebra de linha no fim", () => {
    const texto = textoDoPacote({ schema: "../x.json", nome: "Amigos", players: [] });
    expect(texto).toBe('{\n  "$schema": "../x.json",\n  "name": "Amigos",\n  "players": []\n}\n');
  });
});
