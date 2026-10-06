import { describe, it, expect } from "vitest";
import { normalizarIdDoPacote, PROS_PACK_ID } from "./packs";

describe("pacote ativo do solo (E-01, secao 5)", () => {
  it("id antigo do Amigos embutido vira o id do arquivo", () => {
    expect(normalizarIdDoPacote("amigos-embutido")).toBe("amigos");
  });

  it("id atual passa direto", () => {
    expect(normalizarIdDoPacote("amigos")).toBe("amigos");
    expect(normalizarIdDoPacote("pros")).toBe("pros");
  });

  it("lixo no navegador cai para os pros", () => {
    expect(normalizarIdDoPacote(42)).toBe(PROS_PACK_ID);
    expect(normalizarIdDoPacote("")).toBe(PROS_PACK_ID);
    expect(normalizarIdDoPacote(null)).toBe(PROS_PACK_ID);
  });
});
