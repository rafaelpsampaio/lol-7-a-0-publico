import { describe, it, expect } from "vitest";
import { parseArgs, hostUrls, ordenarLan } from "./cli";

describe("parseArgs", () => {
  it("usa a porta 7070 por padrao", () => {
    expect(parseArgs([])).toEqual({ port: 7070, tunnel: false, novaSala: false, hostAuto: false });
  });

  it("le --port", () => {
    expect(parseArgs(["--port", "9000"]).port).toBe(9000);
  });

  it("le --port=9000", () => {
    expect(parseArgs(["--port=9000"]).port).toBe(9000);
  });

  it("ignora porta invalida e volta ao padrao", () => {
    expect(parseArgs(["--port", "abacaxi"]).port).toBe(7070);
  });

  it("le --tunnel", () => {
    expect(parseArgs(["--tunnel"]).tunnel).toBe(true);
  });

  it("le --nova-sala", () => {
    expect(parseArgs(["--nova-sala"]).novaSala).toBe(true);
  });

  it("sem --nova-sala, a sala anterior continua sendo restaurada", () => {
    expect(parseArgs([]).novaSala).toBe(false);
    expect(parseArgs(["--tunnel"]).novaSala).toBe(false);
  });

  it("combina --nova-sala com --port", () => {
    expect(parseArgs(["--nova-sala", "--port", "9000"])).toEqual({
      port: 9000,
      tunnel: false,
      novaSala: true,
      hostAuto: false,
    });
    expect(parseArgs(["--port=9000", "--nova-sala"])).toEqual({
      port: 9000,
      tunnel: false,
      novaSala: true,
      hostAuto: false,
    });
  });

  it("host automático é opcional e combina com o túnel", () => {
    expect(parseArgs(["--host-auto", "--tunnel", "--port=8080"])).toEqual({
      port: 8080, tunnel: true, novaSala: false, hostAuto: true,
    });
  });
});

describe("hostUrls", () => {
  it("poe o hostToken so na URL local", () => {
    const urls = hostUrls(7070, "segredo");
    expect(urls.local).toBe("http://localhost:7070/?host=segredo");
    expect(urls.lan.every((u) => !u.includes("segredo"))).toBe(true);
  });
});

describe("ordenarLan", () => {
  it("poe a rede de casa primeiro e o adaptador virtual (172.16-31) por ultimo", () => {
    expect(
      ordenarLan([
        "http://172.31.48.1:7070/",
        "http://10.0.0.5:7070/",
        "http://192.168.15.23:7070/",
      ])
    ).toEqual(["http://192.168.15.23:7070/", "http://10.0.0.5:7070/", "http://172.31.48.1:7070/"]);
  });

  it("nao perde nem inventa endereco", () => {
    const entrada = ["http://172.20.0.1:7070/", "http://192.168.0.2:7070/"];
    expect(ordenarLan(entrada).sort()).toEqual([...entrada].sort());
  });
});
