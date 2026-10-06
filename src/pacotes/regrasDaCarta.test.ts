import { describe, it, expect } from "vitest";
import type { PlayerVersion, Role } from "../data/schema";
import {
  notaGeral,
  normalizarCarta,
  nomeDaCarta,
  seguePadrao,
  renomearNaCarta,
  nomeAposMudanca,
  novoIdDePessoa,
  novoIdDeCarta,
  novoIdDePacote,
  validarCarta,
  validarPacote,
  conferirPacote,
  caminhoDaFoto,
  ehJpeg,
} from "./regrasDaCarta";

const POOL = ["aatrox", "camille", "garen", "darius", "fiora", "jax", "malphite", "riven"].map((championId) => ({
  championId,
  mastery: 3 as const,
}));

function carta(over: Partial<PlayerVersion> & { primaryRole?: Role } = {}): PlayerVersion {
  const rota = over.primaryRole ?? "top";
  const base: PlayerVersion = {
    id: "rafa-top-2018",
    personId: "rafa",
    displayName: "Rafa Top 2018",
    year: 2018,
    roles: [rota],
    primaryRole: rota,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [rota]: 82 },
    lanePhase: 75,
    midGame: 85,
    lateGame: 85,
    traits: ["mental_fort"],
    championPool: POOL,
  };
  return { ...base, ...over };
}

describe("notaGeral e normalizarCarta (E-06, E-07)", () => {
  it("nota geral e a media arredondada das tres fases", () => {
    expect(notaGeral({ lanePhase: 75, midGame: 85, lateGame: 85 })).toBe(82);
    expect(notaGeral({ lanePhase: 70, midGame: 75, lateGame: 75 })).toBe(73);
  });

  it("normalizar deixa uma rota so e forca igual a nota, o resto em 0", () => {
    const bagunca = carta({ roles: ["top", "mid"], roleStrength: { top: 90, jungle: 0, mid: 40, adc: 0, support: 0 } });
    const c = normalizarCarta(bagunca);
    expect(c.roles).toEqual(["top"]);
    expect(c.roleStrength).toEqual({ top: 82, jungle: 0, mid: 0, adc: 0, support: 0 });
  });
});

describe("nome da carta (E-09)", () => {
  it("monta o padrao dos Amigos, com e sem ano", () => {
    expect(nomeDaCarta("Rafa", "top", 2018)).toBe("Rafa Top 2018");
    expect(nomeDaCarta("Rafa", "support")).toBe("Rafa Sup");
  });

  it("reconhece quem segue o padrao e quem nao segue", () => {
    expect(seguePadrao(carta())).toBe(true);
    expect(seguePadrao(carta({ displayName: "Faker 2016", year: 2016, primaryRole: "mid" }))).toBe(false);
  });

  it("renomear troca so o nome da pessoa, nos dois padroes", () => {
    expect(renomearNaCarta(carta(), "Rafael")).toBe("Rafael Top 2018");
    expect(renomearNaCarta(carta({ displayName: "Faker 2016", year: 2016, primaryRole: "mid" }), "Lee")).toBe("Lee 2016");
  });

  it("mudar rota ou ano regera o sufixo no padrao; fora dele, so troca o ano no fim", () => {
    expect(nomeAposMudanca(carta(), "jungle", 2019)).toBe("Rafa Jungle 2019");
    expect(nomeAposMudanca(carta(), "top", undefined)).toBe("Rafa Top");
    const pro = carta({ displayName: "Faker 2016", year: 2016, primaryRole: "mid" });
    expect(nomeAposMudanca(pro, "mid", 2017)).toBe("Faker 2017");
    expect(nomeAposMudanca(pro, "top", 2016)).toBe("Faker 2016");
  });
});

describe("ids novos", () => {
  it("pessoa: slug do nome, com sufixo se ja existir", () => {
    expect(novoIdDePessoa("Igão", new Set())).toBe("igao");
    expect(novoIdDePessoa("Igão", new Set(["igao", "igao-2"]))).toBe("igao-3");
    expect(novoIdDePessoa("???", new Set())).toBe("pessoa");
  });

  it("carta: pessoa-rota[-ano], com sufixo se ja existir", () => {
    expect(novoIdDeCarta("rafa", "top", 2018, new Set())).toBe("rafa-top-2018");
    expect(novoIdDeCarta("rafa", "mid", undefined, new Set(["rafa-mid"]))).toBe("rafa-mid-2");
  });

  it("pacote: nunca reaproveita um id existente, nem o dos pros", () => {
    expect(novoIdDePacote("Pros", new Set(["pros"]))).toBe("pros-2");
    expect(novoIdDePacote("Amigos da Firma", new Set(["pros"]))).toBe("amigos-da-firma");
  });
});

describe("validarCarta e validarPacote (secao 4)", () => {
  it("carta nas regras nao tem erro", () => {
    expect(validarCarta(carta())).toEqual([]);
  });

  it("aponta pool curto, forca errada, duas rotas e foto fora do caminho", () => {
    const erros = validarCarta(
      carta({
        championPool: POOL.slice(0, 5),
        roleStrength: { top: 90, jungle: 0, mid: 0, adc: 0, support: 0 },
        photo: "/players/outra.jpg",
      })
    );
    expect(erros).toContain("Escolha pelo menos 8 campeões (faltam 3).");
    expect(erros).toContain("A força na rota precisa ser a nota geral (82).");
    expect(erros).toContain("A foto precisa ser /players/rafa.jpg.");
    expect(validarCarta(carta({ roles: ["top", "mid"] }))).toContain("A carta precisa ter exatamente uma rota.");
  });

  it("aponta ano fora da faixa e id de pessoa invalido", () => {
    expect(validarCarta(carta({ year: 2040 }))).toContain("O ano precisa estar entre 2011 e 2035.");
    expect(validarCarta(carta({ personId: "Rafa" }))).toContain(
      "Id da pessoa inválido (use letras minúsculas, números e hífen)."
    );
  });

  it("pacote aponta id repetido nas duas cartas", () => {
    const erros = validarPacote([carta(), carta()]);
    expect(erros).toHaveLength(2);
    expect(erros[0]!.erros).toContain("Id repetido no pacote: rafa-top-2018.");
  });

  it("caminho da foto e o da pessoa", () => {
    expect(caminhoDaFoto("rafa")).toBe("/players/rafa.jpg");
  });
});

describe("conferirPacote (o que o servidor aceita)", () => {
  it("aceita um pacote certo e devolve as cartas", () => {
    const r = conferirPacote({ name: "Amigos", players: [carta()] });
    expect(r.ok).toBe(true);
  });

  it("schema quebrado vira erro por carta, com o id da carta", () => {
    const r = conferirPacote({ players: [{ ...carta(), lanePhase: "alto" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.cartas[0]!.id).toBe("rafa-top-2018");
      expect(r.cartas[0]!.erros[0]).toMatch(/^lanePhase:/);
    }
  });

  it("schema certo mas fora das regras do editor tambem recusa", () => {
    const r = conferirPacote({ players: [carta({ roleStrength: { top: 10, jungle: 0, mid: 0, adc: 0, support: 0 } })] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe("Há cartas fora das regras do editor.");
  });

  it("nome com mais de 60 letras nao passa no schema", () => {
    expect(conferirPacote({ name: "x".repeat(61), players: [] }).ok).toBe(false);
  });
});

describe("ehJpeg", () => {
  it("confere os tres primeiros bytes", () => {
    expect(ehJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(ehJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(ehJpeg(new Uint8Array([0xff]))).toBe(false);
  });
});
