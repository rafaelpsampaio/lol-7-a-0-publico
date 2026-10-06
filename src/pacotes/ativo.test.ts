import { describe, it, expect } from "vitest";
import { FalhaDaApi } from "./api";
import { reacaoAoErroDoAtivo, soValidos } from "./ativo";

describe("soValidos", () => {
  it("tira so os pacotes marcados como invalidos", () => {
    const lista = [{ id: "a" }, { id: "b", invalido: true }, { id: "c", invalido: false }];
    expect(soValidos(lista).map((p) => p.id)).toEqual(["a", "c"]);
  });
});

describe("reacaoAoErroDoAtivo", () => {
  it("404 apaga a preferencia", () => {
    expect(reacaoAoErroDoAtivo(new FalhaDaApi({ tipo: "http", status: 404, erro: "x" }))).toBe("apagar-preferencia");
  });
  it("500, rede e erro qualquer so valem nesta sessao", () => {
    expect(reacaoAoErroDoAtivo(new FalhaDaApi({ tipo: "http", status: 500, erro: "x" }))).toBe("so-nesta-sessao");
    expect(reacaoAoErroDoAtivo(new FalhaDaApi({ tipo: "rede" }))).toBe("so-nesta-sessao");
    expect(reacaoAoErroDoAtivo(new TypeError("x"))).toBe("so-nesta-sessao");
  });
});
