import { describe, it, expect } from "vitest";
import { BotTeamBuilder } from "../../src/draft/BotTeamBuilder";
import { mulberry32, type PlayerVersion } from "./schema";
import { weightedPick, botPick } from "./botPick";
import { makeCard } from "../room/cards.fixture";

/**
 * O BotTeamBuilder percorre as rotas na ordem top, jungle, mid, adc, support e
 * cria o rng dentro do buildRoster. Com duas cartas de top e uma de cada outra
 * rota, a PRIMEIRA chamada de rng dele decide o top — a mesma primeira chamada
 * que o nosso weightedPick faz sobre o mesmo par, na mesma ordem.
 */
function baseComEmpateNoTop(): { players: PlayerVersion[]; topPool: PlayerVersion[] } {
  const fraco = makeCard({ id: "top-fraco", personId: "pf", primaryRole: "top", forca: 0 });
  const forte = makeCard({ id: "top-forte", personId: "pt", primaryRole: "top", forca: 1 });
  const players = [
    fraco,
    forte,
    makeCard({ id: "jg", personId: "pj", primaryRole: "jungle" }),
    makeCard({ id: "mid", personId: "pm", primaryRole: "mid" }),
    makeCard({ id: "adc", personId: "pa", primaryRole: "adc" }),
    makeCard({ id: "sup", personId: "ps", primaryRole: "support" }),
  ];
  return { players, topPool: [fraco, forte] };
}

describe("botPick — paridade com a regra do jogo (D-12)", () => {
  it("escolhe exatamente a mesma carta que o BotTeamBuilder em 200 sementes", () => {
    const { players, topPool } = baseComEmpateNoTop();
    const builder = new BotTeamBuilder();

    for (let seed = 1; seed <= 200; seed++) {
      const doJogo = builder.buildRoster(players, seed);
      const nosso = weightedPick(topPool, mulberry32(seed));
      expect(nosso.id, `divergencia na semente ${seed}`).toBe(doJogo.top.id);
    }
  });

  it("usa peso = roleStrength + 1, entao a carta de forca 0 ainda sai as vezes", () => {
    const { topPool } = baseComEmpateNoTop();
    let fracas = 0;
    for (let seed = 1; seed <= 600; seed++) {
      if (weightedPick(topPool, mulberry32(seed)).id === "top-fraco") fracas++;
    }
    // pesos 1 e 2 => ~1/3 das vezes. Sem o "+1" seria zero.
    expect(fracas).toBeGreaterThan(100);
  });
});

describe("botPick — escolha dentro da mao", () => {
  it("devolve a rota junto com a carta", () => {
    const mao = {
      top: makeCard({ id: "t", personId: "pt", primaryRole: "top", forca: 90 }),
      mid: makeCard({ id: "m", personId: "pm", primaryRole: "mid", forca: 0 }),
    };
    const escolha = botPick(mao, mulberry32(7));
    expect(escolha).not.toBeNull();
    expect(["top", "mid"]).toContain(escolha!.role);
    expect(escolha!.card.id).toBe(escolha!.role === "top" ? "t" : "m");
  });

  it("devolve null com a mao vazia em vez de lancar", () => {
    expect(botPick({}, mulberry32(1))).toBeNull();
  });

  it("nao depende da ordem das chaves do objeto da mao", () => {
    const top = makeCard({ id: "t", personId: "pt", primaryRole: "top", forca: 50 });
    const sup = makeCard({ id: "s", personId: "ps", primaryRole: "support", forca: 50 });
    const a = botPick({ top, support: sup }, mulberry32(11));
    const b = botPick({ support: sup, top }, mulberry32(11));
    expect(a!.card.id).toBe(b!.card.id);
  });
});
