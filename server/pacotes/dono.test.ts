import { describe, it, expect } from "vitest";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tokenConfere, checagemDoDono, ehLoopback, lembrarTokenDoDono, mesmaOrigem } from "./dono";

const pedido = (dono?: string) => ({ headers: dono === undefined ? {} : { "x-dono": dono } }) as unknown as IncomingMessage;

describe("token do dono (E-11)", () => {
  it("so confere com o token igual", () => {
    expect(tokenConfere("abc", "abc")).toBe(true);
    expect(tokenConfere("abd", "abc")).toBe(false);
    expect(tokenConfere("abcd", "abc")).toBe(false);
    expect(tokenConfere(undefined, "abc")).toBe(false);
    expect(tokenConfere(["abc"], "abc")).toBe(false);
  });

  it("vale o token do arranque, mesmo depois de a sala trocar o dela", () => {
    const ehDono = checagemDoDono("token-do-arranque");
    // Transferir o host gera um token novo na sala (state.ts, transferHost).
    // Quem ganhou o host nao vira dono do editor.
    expect(ehDono(pedido("token-novo-da-sala"))).toBe(false);
    expect(ehDono(pedido("token-do-arranque"))).toBe(true);
    expect(ehDono(pedido())).toBe(false);
  });

  it("loopback e so a maquina local", () => {
    expect(ehLoopback("127.0.0.1")).toBe(true);
    expect(ehLoopback("::1")).toBe(true);
    expect(ehLoopback("::ffff:127.0.0.1")).toBe(true);
    expect(ehLoopback("192.168.0.10")).toBe(false);
    expect(ehLoopback(undefined)).toBe(false);
  });
});

describe("mesmaOrigem (E-11, plugin do Vite so aceita escrita da propria pagina)", () => {
  it("sem origin e sem sec-fetch-site (curl, ferramentas) vale", () => {
    expect(mesmaOrigem({ host: "localhost:5173" })).toBe(true);
  });

  it("mesma origem vale", () => {
    expect(
      mesmaOrigem({
        origin: "http://localhost:5173",
        host: "localhost:5173",
        "sec-fetch-site": "same-origin",
      })
    ).toBe(true);
    expect(mesmaOrigem({ host: "localhost:5173", "sec-fetch-site": "none" })).toBe(true);
  });

  it("outro site nao vale", () => {
    expect(mesmaOrigem({ origin: "http://evil.example", host: "localhost:5173" })).toBe(false);
  });

  it("outra porta do localhost nao vale", () => {
    expect(mesmaOrigem({ origin: "http://localhost:3000", host: "localhost:5173" })).toBe(false);
  });

  it("sec-fetch-site cross-site sem origin nao vale", () => {
    expect(mesmaOrigem({ host: "localhost:5173", "sec-fetch-site": "cross-site" })).toBe(false);
  });

  it("origin malformado ou cabecalho repetido nao vale", () => {
    expect(mesmaOrigem({ origin: "nao e url", host: "localhost:5173" })).toBe(false);
    const repetido = { origin: ["http://localhost:5173"], host: "localhost:5173" } as unknown as IncomingHttpHeaders;
    expect(mesmaOrigem(repetido)).toBe(false);
  });
});

describe("lembrarTokenDoDono (E-11, sobrevive a transferencia de host e reinicio)", () => {
  const nova = () => mkdtemp(join(tmpdir(), "lol7a0-dono-"));

  it("sala nova grava o token e devolve o do host", async () => {
    const dir = await nova();
    expect(await lembrarTokenDoDono(dir, "token-host", true)).toBe("token-host");
    expect((await readFile(join(dir, "dono.token"), "utf8")).trim()).toBe("token-host");
  });

  it("sala nova troca um token antigo pelo do novo host (pina o --nova-sala)", async () => {
    const dir = await nova();
    await writeFile(join(dir, "dono.token"), "token-velho\n", "utf8");
    expect(await lembrarTokenDoDono(dir, "token-novo", true)).toBe("token-novo");
    expect((await readFile(join(dir, "dono.token"), "utf8")).trim()).toBe("token-novo");
  });

  it("sala restaurada com arquivo devolve o token do arquivo, mesmo com host trocado", async () => {
    const dir = await nova();
    await writeFile(join(dir, "dono.token"), "token-original\n", "utf8");
    expect(await lembrarTokenDoDono(dir, "token-do-amigo", false)).toBe("token-original");
  });

  it("sala restaurada sem arquivo (legado) usa o do host e grava", async () => {
    const dir = await nova();
    expect(await lembrarTokenDoDono(dir, "token-host", false)).toBe("token-host");
    expect((await readFile(join(dir, "dono.token"), "utf8")).trim()).toBe("token-host");
  });

  it("host automático ganha um segredo de editor independente, mantido após reinício", async () => {
    const dir = await nova();
    const dono = await lembrarTokenDoDono(dir, "token-sala", true, true);
    expect(dono).not.toBe("token-sala");
    const ehDono = checagemDoDono(dono);
    expect(ehDono(pedido())).toBe(false);
    expect(ehDono(pedido("token-sala"))).toBe(false);
    expect(ehDono(pedido(dono))).toBe(true);
    expect(await lembrarTokenDoDono(dir, "token-apos-transferencia", false, true)).toBe(dono);
  });

  it("snapshot automático sem arquivo de dono também recebe segredo separado", async () => {
    expect(await lembrarTokenDoDono(await nova(), "token-sala", false, true)).not.toBe("token-sala");
  });
});
