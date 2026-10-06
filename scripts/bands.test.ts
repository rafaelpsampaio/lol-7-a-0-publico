/**
 * scripts/bands.test.ts
 *
 * Testes unitarios de scripts/bands.ts (Fase 23 / INST-03).
 * Roda sob npm test (vitest.config.ts ampliado com "scripts/*.test.ts").
 */

import { describe, it, expect } from "vitest";
import { checkBand, formatBandTable, expectBands, expectInBand, type Band } from "./bands";

function band(overrides: Partial<Band> = {}): Band {
  return {
    floor: 0.3,
    ceiling: 0.45,
    target: 0.37,
    source: "STACK.md par. 7",
    owner: "Fase 25",
    ...overrides,
  };
}

describe("bands -- banda de dois lados com procedencia e fase dona (INST-03)", () => {
  it("checkBand devolve ok true e side null quando o valor esta dentro, inclusive exatamente no piso e exatamente no teto", () => {
    const b = band();
    expect(checkBand("torres/min", 0.37, b)).toMatchObject({ ok: true, side: null });
    expect(checkBand("torres/min", 0.3, b)).toMatchObject({ ok: true, side: null });
    expect(checkBand("torres/min", 0.45, b)).toMatchObject({ ok: true, side: null });
  });

  it("checkBand devolve side PISO quando o valor esta abaixo do piso e TETO quando esta acima", () => {
    const b = band();
    expect(checkBand("torres/min", 0.19, b)).toMatchObject({ ok: false, side: "PISO" });
    expect(checkBand("torres/min", 0.9, b)).toMatchObject({ ok: false, side: "TETO" });
  });

  it("checkBand lanca erro quando o piso e maior ou igual ao teto", () => {
    expect(() => checkBand("invalido", 1, band({ floor: 0.5, ceiling: 0.5 }))).toThrow();
    expect(() => checkBand("invalido", 1, band({ floor: 0.6, ceiling: 0.5 }))).toThrow();
  });

  it("a linha formatada contem sempre o rotulo, o valor, o par piso e teto, a fonte e a fase dona", () => {
    const b = band();
    const r = checkBand("torres/min", 0.19, b);
    expect(r.line).toContain("torres/min");
    expect(r.line).toContain("0.190");
    expect(r.line).toContain("0.300");
    expect(r.line).toContain("0.450");
    expect(r.line).toContain("STACK.md par. 7");
    expect(r.line).toContain("Fase 25");
  });

  it("a linha de uma banda marcada como provisoria carrega a marca PROVISORIA", () => {
    const b = band({ source: "engenharia (sem fonte externa citavel)", provisional: true });
    const r = checkBand("trocas de favorito/partida", 5, b);
    expect(r.line).toContain("PROVISORIA");
  });

  it("formatBandTable devolve uma linha por banda, na ordem em que foram verificadas", () => {
    const r1 = checkBand("primeiro", 0.37, band());
    const r2 = checkBand("segundo", 0.19, band());
    const table = formatBandTable([r1, r2]);
    const linhas = table.split("\n");
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toContain("primeiro");
    expect(linhas[1]).toContain("segundo");
  });

  it("expectBands nao lanca quando todas as bandas passam", () => {
    const results = [checkBand("a", 0.37, band()), checkBand("b", 0.3, band())];
    expect(() => expectBands(results)).not.toThrow();
  });

  it("expectBands lanca quando ha pelo menos uma violacao, e a mensagem cita cada banda violada com o lado estourado e a fase dona", () => {
    const results = [
      checkBand("torres/min", 0.37, band()),
      checkBand("kills/min", 0.19, band({ owner: "Fase 26" })),
    ];
    try {
      expectBands(results);
      throw new Error("expectBands deveria ter lancado");
    } catch (err) {
      const msg = String((err as Error).message);
      expect(msg).toContain("kills/min");
      expect(msg).toContain("PISO");
      expect(msg).toContain("Fase 26");
    }
  });

  it("expectInBand lanca para valor fora da banda e a mensagem cita a fonte", () => {
    try {
      expectInBand("torres/min", 0.19, band());
      throw new Error("expectInBand deveria ter lancado");
    } catch (err) {
      expect(String((err as Error).message)).toContain("STACK.md par. 7");
    }
  });

  it("nenhuma saida formatada contem o caractere travessao", () => {
    const emDash = String.fromCharCode(8212);
    const r1 = checkBand("torres/min", 0.19, band());
    const r2 = checkBand("kills/min", 0.9, band({ provisional: true }));
    expect(r1.line.includes(emDash)).toBe(false);
    expect(r2.line.includes(emDash)).toBe(false);
    expect(formatBandTable([r1, r2]).includes(emDash)).toBe(false);
  });
});
