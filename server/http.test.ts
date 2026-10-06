import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createHttpServer } from "./http";
import { PROTOCOL_VERSION } from "./protocol";

let server: Server;
let baseUrl: string;
let roomBaseFile: string;

beforeAll(async () => {
  const distDir = await mkdtemp(join(tmpdir(), "lol7a0-dist-"));
  await writeFile(join(distDir, "index.html"), "<h1>7 a 0</h1>", "utf8");

  const roomDir = await mkdtemp(join(tmpdir(), "lol7a0-roomdata-"));
  roomBaseFile = join(roomDir, "players.json");
  await writeFile(roomBaseFile, '{"players":[]}', "utf8");

  server = createHttpServer({ distDir, roomBaseFile });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("servidor nao obteve porta");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

describe("createHttpServer", () => {
  it("responde /healthz com ok", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("serve o index.html do distDir na raiz", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("7 a 0");
  });

  it("cai no index.html em rota desconhecida (SPA)", async () => {
    const res = await fetch(`${baseUrl}/qualquer/coisa`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("7 a 0");
  });
});

describe("base da sala", () => {
  it("serve /players.json do arquivo da sala, nao do dist", async () => {
    const res = await fetch(`${baseUrl}/players.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ players: [] });
  });

  it("responde /api/room-info anunciando o modo sala", async () => {
    const res = await fetch(`${baseUrl}/api/room-info`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ room: true, protocolVersion: PROTOCOL_VERSION });
  });

  it("/api/room-info nunca e cacheada: o conteudo muda (link do tunel) e e consultada em repeticao", async () => {
    const res = await fetch(`${baseUrl}/api/room-info`);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("/api/room-info com convites", () => {
  let srv: Server;
  let url: string;

  beforeAll(async () => {
    const distDir = await mkdtemp(join(tmpdir(), "lol7a0-dist-"));
    await writeFile(join(distDir, "index.html"), "<h1>7 a 0</h1>", "utf8");
    srv = createHttpServer({
      distDir,
      roomBaseFile,
      convites: () => ["https://algo.trycloudflare.com", "http://192.168.0.10:7070/"],
      aguardandoTunel: () => true,
      hostAuto: () => true,
      fase: () => "tournament",
      defaultBaseFile: await (async () => {
        const f = join(await mkdtemp(join(tmpdir(), "lol7a0-padrao-")), "players.json");
        await writeFile(f, '{"players":[{"padrao":true}]}', "utf8");
        return f;
      })(),
    });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const address = srv.address();
    if (address === null || typeof address === "string") throw new Error("sem porta");
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => srv.close((err) => (err ? reject(err) : resolve())));
  });

  it("anuncia os links que os amigos abrem", async () => {
    const info = (await (await fetch(`${url}/api/room-info`)).json()) as { convites: string[] };
    expect(info.convites).toEqual(["https://algo.trycloudflare.com", "http://192.168.0.10:7070/"]);
  });

  it("anuncia o modo de host sem segredos nem token nos convites", async () => {
    const info = await (await fetch(`${url}/api/room-info`)).json();
    expect(info).toMatchObject({ hostAuto: true });
    expect(JSON.stringify(info)).not.toContain("hostToken");
    expect(await (await fetch(`${baseUrl}/api/room-info`)).json()).toMatchObject({ hostAuto: false });
  });

  it("sem a opcao, convites vem vazio (e nunca com token)", async () => {
    const info = (await (await fetch(`${baseUrl}/api/room-info`)).json()) as { convites: string[] };
    expect(info.convites).toEqual([]);
  });

  it("avisa que o tunel ainda esta subindo quando a opcao diz que sim", async () => {
    const info = (await (await fetch(`${url}/api/room-info`)).json()) as { aguardandoTunel: boolean };
    expect(info.aguardandoTunel).toBe(true);
  });

  it("sem a opcao, nao esta aguardando tunel nenhum", async () => {
    const info = (await (await fetch(`${baseUrl}/api/room-info`)).json()) as { aguardandoTunel: boolean };
    expect(info.aguardandoTunel).toBe(false);
  });

  it("diz a fase da sala para quem ainda nao entrou (lobby x assistir)", async () => {
    const info = (await (await fetch(`${url}/api/room-info`)).json()) as { fase: string };
    expect(info.fase).toBe("tournament");
  });

  it("sem a opcao, a fase e lobby", async () => {
    const info = (await (await fetch(`${baseUrl}/api/room-info`)).json()) as { fase: string };
    expect(info.fase).toBe("lobby");
  });

  it("serve a base padrao do jogo em /api/base-padrao, separada da base da sala", async () => {
    const res = await fetch(`${url}/api/base-padrao`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"players":[{"padrao":true}]}');
  });
});

describe("editor de pacotes ligado ao servidor da sala", () => {
  let srv: Server;
  let base: string;

  beforeAll(async () => {
    const distDir = await mkdtemp(join(tmpdir(), "lol7a0-dist-"));
    await writeFile(join(distDir, "index.html"), "<h1>7 a 0</h1>", "utf8");
    const roomDir = await mkdtemp(join(tmpdir(), "lol7a0-roomdata-"));
    const arquivoDaSala = join(roomDir, "players.json");
    await writeFile(arquivoDaSala, '{"players":[]}', "utf8");
    srv = createHttpServer({
      distDir,
      roomBaseFile: arquivoDaSala,
      conectados: () => 3,
      pacotes: (req, res) => {
        if (req.url !== "/api/pacotes") return false;
        res.writeHead(200, { "content-type": "application/json" });
        res.end("[]");
        return true;
      },
    });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const address = srv.address();
    if (address === null || typeof address === "string") throw new Error("servidor nao obteve porta");
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  });

  it("/api/room-info conta quem esta na sala", async () => {
    expect(await (await fetch(`${base}/api/room-info`)).json()).toMatchObject({ conectados: 3 });
  });

  it("as rotas do editor vem antes do dist", async () => {
    const res = await fetch(`${base}/api/pacotes`);
    expect(await res.json()).toEqual([]);
  });

  it("o /players.json continua sendo a base da sala", async () => {
    expect(await (await fetch(`${base}/players.json`)).json()).toEqual({ players: [] });
  });
});
