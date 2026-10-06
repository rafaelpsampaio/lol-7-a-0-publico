import { describe, it, expect } from "vitest";
import type { PlayerVersion, Role } from "../data/schema";
import {
  criarRascunho,
  renomearPacote,
  adicionarPessoa,
  adicionarCarta,
  removerCarta,
  renomearPessoa,
  mudarRota,
  mudarAno,
  mudarFase,
  alternarTrait,
  adicionarCampeao,
  removerCampeao,
  mudarConforto,
  marcarFoto,
  removerFoto,
  marcarFotoEnviada,
  contarAlteracoes,
  pessoasDoRascunho,
  errosPorCarta,
  fotoParaMostrar,
  paraSalvar,
  fotosParaSubir,
  fotosParaApagar,
} from "./rascunho";

const POOL = ["aatrox", "camille", "garen", "darius", "fiora", "jax", "malphite", "riven"].map((championId) => ({
  championId,
  mastery: 3 as const,
}));

function carta(id: string, personId: string, nome: string, rota: Role, ano?: number, foto?: string): PlayerVersion {
  const c: PlayerVersion = {
    id,
    personId,
    displayName: [nome, { top: "Top", jungle: "Jungle", mid: "Mid", adc: "Adc", support: "Sup" }[rota], ano ?? ""]
      .filter((x) => x !== "")
      .join(" "),
    roles: [rota],
    primaryRole: rota,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [rota]: 70 },
    lanePhase: 70,
    midGame: 70,
    lateGame: 70,
    traits: [],
    championPool: POOL,
  };
  if (ano !== undefined) c.year = ano;
  if (foto !== undefined) c.photo = foto;
  return c;
}

const base = () =>
  criarRascunho({
    id: "amigos",
    nome: "Amigos",
    versao: "v1",
    players: [
      carta("rafa-top-2018", "rafa", "Rafa", "top", 2018, "/players/rafa.jpg"),
      carta("rafa-support", "rafa", "Rafa", "support", undefined, "/players/rafa.jpg"),
      carta("ber-jungle-2019", "ber", "Ber", "jungle", 2019),
    ],
  });

describe("rascunho: sem mexer", () => {
  it("zero alteracoes e as pessoas na ordem do arquivo", () => {
    const r = base();
    expect(contarAlteracoes(r)).toBe(0);
    expect(pessoasDoRascunho(r).map((p) => [p.personId, p.nome, p.cartas.length])).toEqual([
      ["rafa", "Rafa", 2],
      ["ber", "Ber", 1],
    ]);
    expect(errosPorCarta(r).size).toBe(0);
  });
});

describe("rascunho: cartas", () => {
  it("mudar uma fase recalcula a forca e conta 1 alteracao", () => {
    const r = mudarFase(base(), "rafa-top-2018", "midGame", 100);
    const c = r.cartas.find((x) => x.id === "rafa-top-2018")!;
    expect(c.midGame).toBe(100);
    expect(c.roleStrength.top).toBe(80);
    expect(contarAlteracoes(r)).toBe(1);
    expect(pessoasDoRascunho(r)[0]!.melhorNota).toBe(80);
  });

  it("apagar o ano e digitar de novo volta a 0 alteracoes, mesmo com a chave em outra ordem (revisao final M4)", () => {
    const limpo = mudarAno(base(), "rafa-top-2018", undefined);
    expect(contarAlteracoes(limpo)).toBe(1);
    const de_volta = mudarAno(limpo, "rafa-top-2018", 2018);
    // year agora e a ultima chave do objeto.
    expect(Object.keys(de_volta.cartas[0]!).pop()).toBe("year");
    expect(contarAlteracoes(de_volta)).toBe(0);
  });

  it("fase fora de 1 a 100 fica presa na borda", () => {
    const r = mudarFase(base(), "rafa-top-2018", "lanePhase", 300);
    expect(r.cartas[0]!.lanePhase).toBe(100);
  });

  it("mudar a rota move a forca e regera o nome", () => {
    const r = mudarRota(base(), "rafa-top-2018", "mid");
    const c = r.cartas[0]!;
    expect(c.primaryRole).toBe("mid");
    expect(c.roles).toEqual(["mid"]);
    expect(c.roleStrength).toEqual({ top: 0, jungle: 0, mid: 70, adc: 0, support: 0 });
    expect(c.displayName).toBe("Rafa Mid 2018");
  });

  it("tirar o ano apaga o campo e o ano do nome", () => {
    const c = mudarAno(base(), "rafa-top-2018", undefined).cartas[0]!;
    expect("year" in c).toBe(false);
    expect(c.displayName).toBe("Rafa Top");
  });

  it("traits: liga, desliga e nao passa de 4", () => {
    let r = base();
    for (const t of ["mental_fort", "teamfights", "flips", "roamer", "side"] as const) r = alternarTrait(r, "ber-jungle-2019", t);
    expect(r.cartas[2]!.traits).toEqual(["mental_fort", "teamfights", "flips", "roamer"]);
    r = alternarTrait(r, "ber-jungle-2019", "flips");
    expect(r.cartas[2]!.traits).toEqual(["mental_fort", "teamfights", "roamer"]);
  });

  it("campeoes: adiciona com conforto 3, nao duplica, muda conforto, remove", () => {
    let r = adicionarCampeao(base(), "ber-jungle-2019", "lee-sin");
    r = adicionarCampeao(r, "ber-jungle-2019", "lee-sin");
    expect(r.cartas[2]!.championPool.filter((c) => c.championId === "lee-sin")).toEqual([{ championId: "lee-sin", mastery: 3 }]);
    r = mudarConforto(r, "ber-jungle-2019", "lee-sin", 5);
    expect(r.cartas[2]!.championPool.slice(-1)[0]).toEqual({ championId: "lee-sin", mastery: 5 });
    r = removerCampeao(r, "ber-jungle-2019", "aatrox");
    expect(r.cartas[2]!.championPool.some((c) => c.championId === "aatrox")).toBe(false);
  });

  it("pool abaixo de 8 vira erro da carta", () => {
    const r = removerCampeao(base(), "ber-jungle-2019", "aatrox");
    expect(errosPorCarta(r).get("ber-jungle-2019")).toContain("Escolha pelo menos 8 campeões (faltam 1).");
  });

  it("cartas com campos avancados preservam advanced, style, shortDescription e tags apos mudarFase e mudarRota", () => {
    const baseComCampos = criarRascunho({
      id: "test-id",
      nome: "Test",
      versao: "v1",
      players: [
        {
          id: "test-card-1",
          personId: "test-person",
          displayName: "Test Top",
          roles: ["top"],
          primaryRole: "top",
          roleStrength: { top: 70, jungle: 0, mid: 0, adc: 0, support: 0 },
          lanePhase: 70,
          midGame: 70,
          lateGame: 70,
          traits: [],
          championPool: POOL,
          advanced: { riskProfile: 0.5 },
          style: "Carry",
          shortDescription: "Jogador agressivo",
          tags: ["carry", "aggressive"],
        },
      ],
    });

    const r1 = mudarFase(baseComCampos, "test-card-1", "midGame", 80);
    const card1 = r1.cartas[0]!;
    expect(card1.advanced).toEqual({ riskProfile: 0.5 });
    expect(card1.style).toBe("Carry");
    expect(card1.shortDescription).toBe("Jogador agressivo");
    expect(card1.tags).toEqual(["carry", "aggressive"]);

    const r2 = mudarRota(r1, "test-card-1", "mid");
    const card2 = r2.cartas[0]!;
    expect(card2.advanced).toEqual({ riskProfile: 0.5 });
    expect(card2.style).toBe("Carry");
    expect(card2.shortDescription).toBe("Jogador agressivo");
    expect(card2.tags).toEqual(["carry", "aggressive"]);
  });
});

describe("rascunho: pessoas", () => {
  it("pessoa nova nasce com uma carta vazia de topo, que tem erro ate ter 8 campeoes", () => {
    const { rascunho: r, personId, cartaId } = adicionarPessoa(base(), "Igão");
    expect(personId).toBe("igao");
    const c = r.cartas.find((x) => x.id === cartaId)!;
    expect(c).toMatchObject({ personId: "igao", displayName: "Igão Top", primaryRole: "top", lanePhase: 70, traits: [], championPool: [] });
    expect(errosPorCarta(r).get(cartaId)?.[0]).toBe("Escolha pelo menos 8 campeões (faltam 8).");
  });

  it("carta nova vai para a primeira rota que a pessoa nao tem e herda a foto", () => {
    const { rascunho: r, cartaId } = adicionarCarta(base(), "rafa");
    const c = r.cartas.find((x) => x.id === cartaId)!;
    expect(c.primaryRole).toBe("jungle");
    expect(c.photo).toBe("/players/rafa.jpg");
    expect(c.displayName).toBe("Rafa Jungle");
  });

  it("renomear a pessoa troca o nome em todas as cartas dela", () => {
    const r = renomearPessoa(base(), "rafa", "Rafael");
    expect(r.cartas.filter((c) => c.personId === "rafa").map((c) => c.displayName)).toEqual(["Rafael Top 2018", "Rafael Sup"]);
  });

  it("remover a ultima carta tira a pessoa da lista", () => {
    const r = removerCarta(base(), "ber-jungle-2019");
    expect(pessoasDoRascunho(r).map((p) => p.personId)).toEqual(["rafa"]);
    expect(contarAlteracoes(r)).toBe(1);
  });
});

describe("rascunho: fotos (secao 3.5)", () => {
  const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });

  it("foto nova: cartas apontam para o caminho, a previa aparece e conta uma alteracao so", () => {
    const r = marcarFoto(base(), "ber", blob, "blob:previa");
    expect(r.cartas[2]!.photo).toBe("/players/ber.jpg");
    expect(fotoParaMostrar(r, "ber")).toBe("blob:previa");
    expect(fotosParaSubir(r)).toEqual([["ber", blob]]);
    // O campo photo das cartas nao conta de novo: a foto e uma alteracao.
    expect(contarAlteracoes(r)).toBe(1);
  });

  it("foto enviada nao sobe de novo", () => {
    const r = marcarFotoEnviada(marcarFoto(base(), "ber", blob, "blob:previa"), "ber");
    expect(fotosParaSubir(r)).toEqual([]);
  });

  it("remover a foto tira o campo das cartas e pede para apagar o arquivo", () => {
    const r = removerFoto(base(), "rafa");
    expect(r.cartas.filter((c) => c.personId === "rafa").every((c) => c.photo === undefined)).toBe(true);
    expect(fotoParaMostrar(r, "rafa")).toBeUndefined();
    expect(fotosParaApagar(r)).toEqual(["rafa"]);
  });

  it("pessoa com foto removida por inteiro tambem pede para apagar a foto", () => {
    let r = removerCarta(base(), "rafa-top-2018");
    r = removerCarta(r, "rafa-support");
    expect(fotosParaApagar(r)).toEqual(["rafa"]);
  });

  it("sem mudanca de foto, nada para apagar", () => {
    expect(fotosParaApagar(renomearPacote(base(), "Outro"))).toEqual([]);
  });

  it("pessoa nova com foto marcada tem cartas removidas: nao sobe, nao apaga, nao conta", () => {
    const { rascunho: r1, personId: novoId, cartaId: cartaId1 } = adicionarPessoa(base(), "Novo");
    const { rascunho: r2, cartaId: cartaId2 } = adicionarCarta(r1, novoId);
    const r3 = marcarFoto(r2, novoId, blob, "blob:previa");
    // Remover as duas cartas do novo
    let r4 = removerCarta(r3, cartaId1);
    r4 = removerCarta(r4, cartaId2);
    expect(fotosParaSubir(r4)).toEqual([]);
    expect(fotosParaApagar(r4)).not.toContain(novoId);
    expect(contarAlteracoes(r4)).toBe(0); // Pessoa nova foi totalmente removida
  });

  it("pessoa com foto original marcada nova tem cartas removidas: nao sobe, apaga uma vez", () => {
    let r = marcarFoto(base(), "rafa", blob, "blob:previa");
    // Remover as cartas de rafa
    r = removerCarta(r, "rafa-top-2018");
    r = removerCarta(r, "rafa-support");
    expect(fotosParaSubir(r)).toEqual([]);
    expect(fotosParaApagar(r)).toEqual(["rafa"]);
  });

  it("pessoa nova com foto enviada e cartas removidas: apaga", () => {
    const { rascunho: r1, personId: novoId, cartaId: cartaId1 } = adicionarPessoa(base(), "Novo");
    const { rascunho: r2, cartaId: cartaId2 } = adicionarCarta(r1, novoId);
    let r3 = marcarFoto(r2, novoId, blob, "blob:previa");
    r3 = marcarFotoEnviada(r3, novoId);
    // Remover as duas cartas
    r3 = removerCarta(r3, cartaId1);
    r3 = removerCarta(r3, cartaId2);
    expect(fotosParaApagar(r3)).toContain(novoId);
  });

  it("pessoa sem foto original: marcar e remover foto descarta a entrada, nao apaga", () => {
    let r = adicionarPessoa(base(), "SemFotoOriginal").rascunho;
    const pessoaId = "semfotooriginal";
    r = marcarFoto(r, pessoaId, blob, "blob:previa");
    expect(Object.keys(r.fotos)).toContain(pessoaId);
    r = removerFoto(r, pessoaId);
    expect(pessoaId in r.fotos).toBe(false);
    expect(contarAlteracoes(r)).toBe(1); // Apenas a nova carta adicionada
    expect(fotosParaApagar(r)).not.toContain(pessoaId);
  });

  it("pessoa sem foto original: marcar, enviar, remover pede apagar", () => {
    let r = adicionarPessoa(base(), "SemFotoOriginal").rascunho;
    const pessoaId = "semfotooriginal";
    r = marcarFoto(r, pessoaId, blob, "blob:previa");
    r = marcarFotoEnviada(r, pessoaId);
    r = removerFoto(r, pessoaId);
    expect(r.fotos[pessoaId]?.tipo).toBe("remover");
    expect(fotosParaApagar(r)).toContain(pessoaId);
  });

  it("pessoa removida sem foto original nao aparece em fotosParaApagar", () => {
    const { rascunho: r1, personId } = adicionarPessoa(base(), "Temporaria");
    const { rascunho: r2, cartaId } = adicionarCarta(r1, personId);
    // Remover a carta (nao marcou foto)
    const r3 = removerCarta(r2, cartaId);
    expect(fotosParaApagar(r3)).not.toContain(personId);
  });
});

describe("rascunho: salvar", () => {
  it("paraSalvar manda o nome aparado e as cartas atuais", () => {
    const r = renomearPacote(base(), "  Amigos 2 ");
    expect(contarAlteracoes(r)).toBe(1);
    expect(paraSalvar(r)).toEqual({ nome: "Amigos 2", players: r.cartas });
  });
});
