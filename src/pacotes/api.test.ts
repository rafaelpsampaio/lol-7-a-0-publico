import { describe, it, expect } from "vitest";
import { criarApi, FalhaDaApi } from "./api";
import { guardarTokenDoLink, tokenDoDono } from "./dono";

function armazemNaMemoria(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

type Pedido = { url: string; init: RequestInit };

function fetchFalso(resposta: (p: Pedido) => Response) {
  const pedidos: Pedido[] = [];
  const fazer = (async (url: RequestInfo | URL, init: RequestInit = {}) => {
    const p = { url: String(url), init };
    pedidos.push(p);
    return resposta(p);
  }) as typeof fetch;
  return { fazer, pedidos };
}

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

describe("token do dono no navegador", () => {
  it("guarda o ?host= do link e le de volta", () => {
    const a = armazemNaMemoria();
    guardarTokenDoLink("?host=abc", a);
    expect(tokenDoDono(a)).toBe("abc");
    guardarTokenDoLink("?outra=1", a);
    expect(tokenDoDono(a)).toBe("abc");
  });

  it("sem armazem, sem token", () => {
    expect(tokenDoDono(null)).toBeNull();
  });
});

describe("criarApi", () => {
  it("manda o token do dono no cabecalho x-dono", async () => {
    const { fazer, pedidos } = fetchFalso(() => json(200, []));
    await criarApi(fazer, () => "tok").listar();
    expect(new Headers(pedidos[0]!.init.headers).get("x-dono")).toBe("tok");
  });

  it("salvar faz PUT com o corpo esperado", async () => {
    const { fazer, pedidos } = fetchFalso(() => json(200, { versao: "v2" }));
    const r = await criarApi(fazer, () => "tok").salvar("amigos", { nome: "A", players: [], versaoBase: "v1" });
    expect(r).toEqual({ versao: "v2" });
    expect(pedidos[0]!.url).toBe("/api/pacotes/amigos");
    expect(pedidos[0]!.init.method).toBe("PUT");
    expect(JSON.parse(String(pedidos[0]!.init.body))).toEqual({ nome: "A", players: [], versaoBase: "v1", forcar: false });
  });

  it("erro HTTP vira FalhaDaApi com status, erro e cartas", async () => {
    const { fazer } = fetchFalso(() => json(422, { erro: "Há cartas fora das regras do editor.", cartas: [{ id: "x", erros: ["e"] }] }));
    const falha = await criarApi(fazer, () => null).salvar("amigos", { nome: "A", players: [], versaoBase: "v1" }).catch((e: unknown) => e);
    expect(falha).toBeInstanceOf(FalhaDaApi);
    expect((falha as FalhaDaApi).detalhe).toEqual({
      tipo: "http",
      status: 422,
      erro: "Há cartas fora das regras do editor.",
      cartas: [{ id: "x", erros: ["e"] }],
    });
  });

  it("falha de rede vira FalhaDaApi do tipo rede", async () => {
    const fazer = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;
    const falha = await criarApi(fazer, () => null).listar().catch((e: unknown) => e);
    expect((falha as FalhaDaApi).detalhe).toEqual({ tipo: "rede" });
  });

  it("carregar recusa pacote invalido vindo do servidor", async () => {
    const { fazer } = fetchFalso(() => json(200, { id: "a", nome: "A", versao: "v", players: [{ id: 1 }] }));
    const falha = await criarApi(fazer, () => null).carregar("a").catch((e: unknown) => e);
    expect((falha as FalhaDaApi).detalhe).toMatchObject({ tipo: "http", status: 500 });
  });

  it("souDono nunca lanca: sem servidor, nao e dono", async () => {
    const fazer = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;
    expect(await criarApi(fazer, () => null).souDono()).toBe(false);
    const { fazer: ok } = fetchFalso(() => json(200, { dono: true }));
    expect(await criarApi(ok, () => "tok").souDono()).toBe(true);
  });

  it("subirFoto manda o JPEG cru", async () => {
    const { fazer, pedidos } = fetchFalso(() => new Response(null, { status: 204 }));
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
    await criarApi(fazer, () => "tok").subirFoto("rafa", blob);
    expect(pedidos[0]!.url).toBe("/api/fotos/rafa");
    expect(pedidos[0]!.init.method).toBe("PUT");
    expect(new Headers(pedidos[0]!.init.headers).get("content-type")).toBe("image/jpeg");
    expect(pedidos[0]!.init.body).toBe(blob);
  });
});
