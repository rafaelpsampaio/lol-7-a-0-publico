import { describe, it, expect } from "vitest";
import type { PlayerVersion, Role } from "../data/schema";
import { contagemPorRota, seloDoBaralho, capaDoPacote, juntarComE } from "./resumo";
import { recorteCentral } from "./foto";

const POOL = ["aatrox", "camille", "garen", "darius", "fiora", "jax", "malphite", "riven"].map((championId) => ({
  championId,
  mastery: 3 as const,
}));
function carta(personId: string, rota: Role, foto?: string): PlayerVersion {
  return {
    id: `${personId}-${rota}`,
    personId,
    displayName: `${personId[0]!.toUpperCase()}${personId.slice(1)} Top`,
    roles: [rota],
    primaryRole: rota,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [rota]: 70 },
    lanePhase: 70,
    midGame: 70,
    lateGame: 70,
    traits: [],
    championPool: POOL,
    ...(foto === undefined ? {} : { photo: foto }),
  };
}

describe("resumo do pacote", () => {
  it("conta cartas por rota", () => {
    expect(contagemPorRota([carta("a", "top"), carta("b", "top"), carta("c", "adc")])).toEqual({
      top: 2,
      jungle: 0,
      mid: 0,
      adc: 1,
      support: 0,
    });
  });

  it("selo do baralho: pacote pequeno lista as rotas com nome em pt-BR", () => {
    const selo = seloDoBaralho([carta("a", "top")]);
    expect(selo.pronto).toBe(false);
    expect(selo.texto).toBe("Faltam cartas em Topo, Selva, Meio, Atirador e Suporte");
  });

  it("junta com virgula e 'e'", () => {
    expect(juntarComE(["Atirador"])).toBe("Atirador");
    expect(juntarComE(["Atirador", "Suporte"])).toBe("Atirador e Suporte");
    expect(juntarComE([])).toBe("");
  });

  it("capa: fotos primeiro, depois iniciais, e '+N' quando sobra gente", () => {
    const cartas = ["ana", "bia", "caio", "duda", "eva", "fabi", "gus"].map((p, i) => carta(p, "mid", i === 3 ? `/players/${p}.jpg` : undefined));
    const capa = capaDoPacote(cartas);
    expect(capa[0]).toEqual({ tipo: "foto", src: "/players/duda.jpg" });
    expect(capa.slice(1, 4).map((c) => (c.tipo === "iniciais" ? c.texto : ""))).toEqual(["AN", "BI", "CA"]);
    expect(capa[4]).toEqual({ tipo: "iniciais", texto: "+3" });
  });

  it("capa: a mesma pessoa conta uma vez", () => {
    expect(capaDoPacote([carta("ana", "top"), carta("ana", "mid")])).toHaveLength(1);
  });
});

describe("recorteCentral", () => {
  it("quadrado central do lado menor", () => {
    expect(recorteCentral(1000, 600)).toEqual({ x: 200, y: 0, lado: 600 });
    expect(recorteCentral(400, 900)).toEqual({ x: 0, y: 250, lado: 400 });
  });
});
