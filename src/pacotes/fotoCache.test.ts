import { beforeEach, describe, expect, it } from "vitest";
import { marcarFotoTrocada, urlDaFoto, zerarFotosTrocadas } from "./fotoCache";

describe("fotoCache: foto trocada aparece na hora", () => {
  beforeEach(() => zerarFotosTrocadas());

  it("sem troca na sessao, devolve o caminho como veio", () => {
    expect(urlDaFoto("/players/rafa.jpg")).toBe("/players/rafa.jpg");
    expect(urlDaFoto(undefined)).toBeUndefined();
  });

  it("depois da troca, acrescenta um sufixo so na exibicao", () => {
    marcarFotoTrocada("rafa");
    expect(urlDaFoto("/players/rafa.jpg")).toMatch(/^\/players\/rafa\.jpg\?v=\d+$/);
    expect(urlDaFoto("/players/ber.jpg")).toBe("/players/ber.jpg");
  });

  it("cada troca muda o sufixo, mesmo na mesma milissegundo", () => {
    marcarFotoTrocada("rafa");
    const a = urlDaFoto("/players/rafa.jpg");
    marcarFotoTrocada("rafa");
    expect(urlDaFoto("/players/rafa.jpg")).not.toBe(a);
  });

  it("nao mexe em previa blob nem em outros caminhos", () => {
    marcarFotoTrocada("rafa");
    expect(urlDaFoto("blob:http://x/abc")).toBe("blob:http://x/abc");
    expect(urlDaFoto("/outro/rafa.jpg")).toBe("/outro/rafa.jpg");
  });
});
