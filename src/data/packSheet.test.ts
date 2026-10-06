import { describe, it, expect } from "vitest";
import { buildPackWorkbook } from "./packSheet";
import { buildPlayersFromRows, worksheetToRows } from "./packImport";
import type { ChampionEntry } from "./schema";
import { makePlayer } from "../__tests__/helpers/makePlayer";

const CHAMPS: ChampionEntry[] = ["aatrox", "camille", "garen", "darius", "fiora", "malphite", "riven", "zed"].map(
  (id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1), traits: [] })
);

describe("buildPackWorkbook", () => {
  it("tem as colunas trait1..trait4 (A-05)", () => {
    const ws = buildPackWorkbook(CHAMPS).getWorksheet("Jogadores")!;
    const header = worksheetToRows(ws)[0]!;
    for (const h of ["trait1", "trait2", "trait3", "trait4"]) expect(header).toContain(h);
  });

  it("a lista do menu de traits cabe no limite de 255 caracteres do Excel", () => {
    const ws = buildPackWorkbook(CHAMPS).getWorksheet("Jogadores")!;
    const header = worksheetToRows(ws)[0]!;
    const col = header.indexOf("trait1") + 1;
    const formula = ws.getCell(2, col).dataValidation.formulae![0] as string;
    expect(formula.length).toBeLessThanOrEqual(255);
  });

  it("ida e volta preserva 4 traits e ano vazio", () => {
    const { year: _year, ...semAno } = makePlayer("top", {
      id: "rafa-top",
      personId: "rafa",
      displayName: "Rafa Top",
      traits: ["mental_fort", "teamfights", "flips", "side"],
      championPool: CHAMPS.map((c) => ({ championId: c.id, mastery: 3 as const })),
    });
    const ws = buildPackWorkbook(CHAMPS, { name: "t", players: [semAno] }).getWorksheet("Jogadores")!;
    const { players } = buildPlayersFromRows(worksheetToRows(ws), CHAMPS);
    expect(players[0]!.traits).toEqual(["mental_fort", "teamfights", "flips", "side"]);
    expect(players[0]!.year).toBeUndefined();
  });
});
