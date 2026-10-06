import { describe, it, expect } from "vitest";
import { corrigirLinhas, finalizarCartas } from "./amigos-pack";
import type { RawRow } from "../src/data/packImport";
import { makePlayer } from "../src/__tests__/helpers/makePlayer";

const champs = (): string[] => ["leona", "5", "braum", "1", "ashe", "1", "braum", "1", "morgana", "3", "karma", "2", "yummi", "2", "lulu", "1"];
const HEADER: RawRow = [
  "id", "personId", "displayName", "year", "primaryRole",
  ...Array.from({ length: 8 }, (_, i) => [`champ${i + 1}_id`, `champ${i + 1}_mastery`]).flat(),
];
const linhas = (): RawRow[] => [
  HEADER,
  ["louis_sup_2017", "louis", "Louis Sup", "2017", "support", ...champs()],
  ["louis_sup_2017", "louis", "Louis Sup", "2026", "support", ...champs()],
  ["rafa_top_2019", "rafa", "Rafa Top", "2018", "Top", ...champs()],
  ["junao_sup", "junao", "Junão Sup", "", "support", ...champs()],
];

describe("corrigirLinhas", () => {
  it("aplica as 3 correcoes combinadas", () => {
    const out = corrigirLinhas(linhas());
    expect(out[1]![0]).toBe("louis_sup_2017");
    expect(out[2]![0]).toBe("louis_sup_2026");
    expect(out[3]![0]).toBe("rafa_top_2018");
    const junao = out[4]!;
    // champ2 continua braum; o segundo braum (champ4) vira nautilus nota 1
    expect(junao[7]).toBe("braum");
    expect(junao[11]).toBe("nautilus");
    expect(junao[12]).toBe("1");
  });

  it("falha alto se uma correcao nao acontece (a planilha mudou)", () => {
    expect(() => corrigirLinhas(linhas().slice(0, 4))).toThrow(/junao/);
  });
});

describe("finalizarCartas", () => {
  it("nome = pessoa + rota, com ano so quando a pessoa repete a rota (A-08)", () => {
    const out = finalizarCartas([
      makePlayer("top", { id: "rafa-top-2018", personId: "rafa", year: 2018 }),
      makePlayer("top", { id: "rafa-top", personId: "rafa", year: 2026 }),
      makePlayer("support", { id: "rafa-sup", personId: "rafa" }),
      makePlayer("adc", { id: "igao-adc", personId: "raidenchups", year: 2017 }),
    ]);
    expect(out.map((p) => p.displayName)).toEqual(["Rafa Top 2018", "Rafa Top 2026", "Rafa Sup", "Igão Adc"]);
  });

  it("forca da rota principal = media arredondada das 3 fases (A-07)", () => {
    const [p] = finalizarCartas([
      makePlayer("mid", { id: "x", personId: "rafa", lanePhase: 65, midGame: 70, lateGame: 70 }),
    ]);
    expect(p!.roleStrength.mid).toBe(68);
    expect(p!.roleStrength.top).toBe(0);
  });

  it("pessoa sem nome na tabela falha alto", () => {
    expect(() => finalizarCartas([makePlayer("mid", { id: "x", personId: "desconhecido" })])).toThrow(/desconhecido/);
  });

  it("duas cartas na mesma rota sem ano falham (o nome sairia repetido)", () => {
    const semAno = (id: string) => {
      const { year: _y, ...p } = makePlayer("top", { id, personId: "rafa" });
      return p;
    };
    expect(() => finalizarCartas([semAno("a"), semAno("b")])).toThrow(/ano/);
  });
});
