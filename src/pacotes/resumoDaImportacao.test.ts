import { describe, it, expect } from "vitest";
import type { PlayerVersion } from "../data/schema";
import type { RowReport } from "../data/packImport";
import { resumoDaImportacao, textoDoErro422 } from "./resumoDaImportacao";

const cartas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }) as PlayerVersion);
const linha = (status: RowReport["status"], ...messages: string[]): RowReport => ({ row: 2, name: "x", status, messages });

describe("resumoDaImportacao", () => {
  it("planilha limpa: so conta as cartas", () => {
    expect(resumoDaImportacao({ players: cartas(12), report: [linha("ok")] })).toBe("12 cartas importadas.");
    expect(resumoDaImportacao({ players: cartas(1), report: [] })).toBe("1 carta importada.");
  });

  it("conta linhas com erro e pools completados", () => {
    const report = [
      linha("ok"),
      linha("error", "Jogador inválido (roleStrength: x)."),
      linha("error", "Linha sem nome de jogador, ignorada."),
      linha("fixed", "Pool com 5 campeões, completado até 8."),
      linha("fixed", "Pool com 2 campeões, completado até 8.", "Campeão x entendido como Y."),
      linha("fixed", "Pool com 7 campeões, completado até 8."),
      linha("warning", 'Traço "zzz" não reconhecido, descartado.'),
    ];
    expect(resumoDaImportacao({ players: cartas(12), report })).toBe(
      "12 cartas importadas; 2 linhas com erro ficaram de fora; 3 pools completados com campeões de preenchimento."
    );
  });

  it("singular", () => {
    const report = [linha("error", "x"), linha("fixed", "Pool com 6 campeões, completado até 8.")];
    expect(resumoDaImportacao({ players: cartas(1), report })).toBe(
      "1 carta importada; 1 linha com erro ficou de fora; 1 pool completado com campeões de preenchimento."
    );
  });
});

describe("textoDoErro422", () => {
  it("nomeia as cartas que falharam", () => {
    expect(textoDoErro422("Há cartas fora das regras.", [{ id: "ber-top", erros: ["a"] }, { id: "ber-mid", erros: ["b"] }])).toBe(
      "Há cartas fora das regras. Cartas com problema: ber-top, ber-mid."
    );
  });
  it("sem cartas, devolve so o erro; com muitas, resume", () => {
    expect(textoDoErro422("Só isso.", undefined)).toBe("Só isso.");
    const muitas = Array.from({ length: 11 }, (_, i) => ({ id: `c${i}`, erros: [] }));
    expect(textoDoErro422("E.", muitas)).toBe("E. Cartas com problema: c0, c1, c2, c3, c4, c5, c6, c7 e mais 3.");
  });
});
