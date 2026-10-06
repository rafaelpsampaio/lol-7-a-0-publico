import { describe, it, expect } from "vitest";
import type { PlayerVersion } from "../data/schema";
import type { ApiDePacotes } from "./api";
import { FalhaDaApi } from "./api";
import { criarRascunho, marcarFoto, removerFoto, renomearPacote, fotosParaSubir } from "./rascunho";
import { salvarRascunho, descartarRascunho } from "./salvar";

const POOL = ["aatrox", "camille", "garen", "darius", "fiora", "jax", "malphite", "riven"].map((championId) => ({
  championId,
  mastery: 3 as const,
}));
const rafa: PlayerVersion = {
  id: "rafa-top",
  personId: "rafa",
  displayName: "Rafa Top",
  roles: ["top"],
  primaryRole: "top",
  roleStrength: { top: 70, jungle: 0, mid: 0, adc: 0, support: 0 },
  lanePhase: 70,
  midGame: 70,
  lateGame: 70,
  traits: [],
  championPool: POOL,
  photo: "/players/rafa.jpg",
};
const base = () => criarRascunho({ id: "amigos", nome: "Amigos", versao: "v1", players: [rafa] });
const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });

function apiFalsa(over: Partial<ApiDePacotes> = {}) {
  const chamadas: string[] = [];
  const api: ApiDePacotes = {
    listar: async () => [],
    carregar: async () => {
      throw new Error("nao usado");
    },
    salvar: async (id, corpo) => {
      chamadas.push(`salvar ${id} ${corpo.versaoBase} ${corpo.forcar === true}`);
      return { versao: "v2" };
    },
    criar: async () => ({ id: "x", versao: "v" }),
    excluir: async () => undefined,
    subirFoto: async (p) => void chamadas.push(`foto ${p}`),
    apagarFoto: async (p) => void chamadas.push(`apagar ${p}`),
    souDono: async () => true,
    ...over,
  };
  return { api, chamadas };
}

describe("salvarRascunho", () => {
  it("grava o pacote e volta um rascunho limpo, na versao nova", async () => {
    const { api, chamadas } = apiFalsa();
    const res = await salvarRascunho(renomearPacote(base(), "Amigos 2"), api);
    expect(res.tipo).toBe("salvo");
    expect(res.rascunho.versaoBase).toBe("v2");
    expect(res.rascunho.nomeOriginal).toBe("Amigos 2");
    expect(chamadas).toEqual(["salvar amigos v1 false"]);
  });

  it("foto nova sobe antes de gravar o pacote", async () => {
    const { api, chamadas } = apiFalsa();
    const res = await salvarRascunho(marcarFoto(base(), "rafa", blob, "blob:x"), api);
    expect(res.tipo).toBe("salvo");
    expect(chamadas).toEqual(["foto rafa", "salvar amigos v1 false"]);
  });

  it("remover foto: grava primeiro e apaga depois", async () => {
    const { api, chamadas } = apiFalsa();
    await salvarRascunho(removerFoto(base(), "rafa"), api);
    expect(chamadas).toEqual(["salvar amigos v1 false", "apagar rafa"]);
  });

  it("409 vira conflito e mantem a foto ja enviada como enviada", async () => {
    const { api } = apiFalsa({
      salvar: async () => {
        throw new FalhaDaApi({ tipo: "http", status: 409, erro: "mudou" });
      },
    });
    const res = await salvarRascunho(marcarFoto(base(), "rafa", blob, "blob:x"), api);
    expect(res.tipo).toBe("conflito");
    expect(fotosParaSubir(res.rascunho)).toEqual([]);
  });

  it("forcar chega ao servidor", async () => {
    const { api, chamadas } = apiFalsa();
    await salvarRascunho(renomearPacote(base(), "B"), api, { forcar: true });
    expect(chamadas).toEqual(["salvar amigos v1 true"]);
  });

  it("403, 422 e rede viram os resultados certos", async () => {
    const falhar = (d: ConstructorParameters<typeof FalhaDaApi>[0]) =>
      apiFalsa({
        salvar: async () => {
          throw new FalhaDaApi(d);
        },
      }).api;
    expect((await salvarRascunho(base(), falhar({ tipo: "http", status: 403, erro: "x" }))).tipo).toBe("sem-permissao");
    const invalido = await salvarRascunho(base(), falhar({ tipo: "http", status: 422, erro: "regras", cartas: [{ id: "rafa-top", erros: ["e"] }] }));
    expect(invalido).toMatchObject({ tipo: "invalido", erro: "regras", cartas: [{ id: "rafa-top", erros: ["e"] }] });
    const rede = await salvarRascunho(base(), falhar({ tipo: "rede" }));
    expect(rede).toMatchObject({ tipo: "falha", mensagem: "Sem conexão com o servidor. Suas alterações continuam aqui." });
    const disco = await salvarRascunho(base(), falhar({ tipo: "http", status: 500, erro: "EPERM" }));
    expect(disco).toMatchObject({ tipo: "falha", mensagem: "Não consegui gravar o arquivo (EPERM)." });
  });

  it("erro que nao e da API vira falha e mantem a foto ja enviada como enviada", async () => {
    const { api, chamadas } = apiFalsa({
      salvar: async () => {
        throw new TypeError("corpo truncado");
      },
    });
    const res = await salvarRascunho(marcarFoto(base(), "rafa", blob, "blob:x"), api);
    expect(res).toMatchObject({ tipo: "falha", mensagem: "Não consegui gravar o arquivo (corpo truncado)." });
    expect(chamadas).toEqual(["foto rafa"]);
    expect(fotosParaSubir(res.rascunho)).toEqual([]);
  });

  it("apagar foto que falha (ainda em uso) nao derruba o salvo", async () => {
    const { api } = apiFalsa({
      apagarFoto: async () => {
        throw new FalhaDaApi({ tipo: "http", status: 409, erro: "em uso" });
      },
    });
    expect((await salvarRascunho(removerFoto(base(), "rafa"), api)).tipo).toBe("salvo");
  });
});

describe("descartarRascunho", () => {
  it("apaga so as fotos que ja subiram e nao foram salvas", async () => {
    const { api, chamadas } = apiFalsa({
      salvar: async () => {
        throw new FalhaDaApi({ tipo: "rede" });
      },
    });
    const depoisDaFalha = (await salvarRascunho(marcarFoto(base(), "rafa", blob, "blob:x"), api)).rascunho;
    await descartarRascunho(depoisDaFalha, api);
    expect(chamadas).toEqual(["foto rafa", "apagar rafa"]);
  });
});
