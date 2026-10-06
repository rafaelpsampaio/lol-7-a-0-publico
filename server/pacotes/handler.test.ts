import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request, type Server } from "node:http";
import type { PlayerVersion, Role } from "../engine/pacotes";
import { criarHandlerDosPacotes } from "./handler";

const TOKEN = "token-certo";
const POOL = ["aatrox", "camille", "garen", "darius", "fiora", "jax", "malphite", "riven"].map((championId) => ({
  championId,
  mastery: 3 as const,
}));

function carta(id: string, personId: string, rota: Role = "top", foto?: string): PlayerVersion {
  const c: PlayerVersion = {
    id,
    personId,
    displayName: `${personId} Top`,
    roles: [rota],
    primaryRole: rota,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [rota]: 70 },
    lanePhase: 70,
    midGame: 70,
    lateGame: 70,
    traits: [],
    championPool: POOL,
  };
  if (foto !== undefined) c.photo = foto;
  return c;
}

let raiz: string;
let servidor: Server;
let url: string;

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), "lol7a0-pacotes-"));
  await mkdir(join(raiz, "packs"));
  await mkdir(join(raiz, "players"));
  await writeFile(
    join(raiz, "players.json"),
    JSON.stringify({ $schema: "../.vscode/players.schema.json", name: "Pros / Mundial", players: [carta("faker-2016", "faker", "mid")] }, null, 2)
  );
  await writeFile(
    join(raiz, "packs", "amigos.json"),
    JSON.stringify({ name: "Amigos", players: [carta("rafa-top", "rafa", "top", "/players/rafa.jpg"), carta("rafa-mid", "rafa", "mid", "/players/rafa.jpg")] })
  );
  await writeFile(join(raiz, "players", "rafa.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

  const handler = criarHandlerDosPacotes({ raizPublic: raiz, ehDono: (req) => req.headers["x-dono"] === TOKEN });
  servidor = createServer((req, res) => {
    if (!handler(req, res)) {
      res.writeHead(418);
      res.end("nao e do handler");
    }
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  const endereco = servidor.address();
  if (endereco === null || typeof endereco === "string") throw new Error("sem porta");
  url = `http://127.0.0.1:${endereco.port}`;
});

afterEach(async () => {
  await new Promise<void>((ok) => servidor.close(() => ok()));
  await rm(raiz, { recursive: true, force: true });
});

const comDono = (init: RequestInit = {}): RequestInit => ({ ...init, headers: { ...(init.headers as Record<string, string>), "x-dono": TOKEN } });

describe("leitura", () => {
  it("GET /api/dono diz se o cabecalho e o do dono", async () => {
    expect(await (await fetch(`${url}/api/dono`)).json()).toEqual({ dono: false });
    expect(await (await fetch(`${url}/api/dono`, comDono())).json()).toEqual({ dono: true });
  });

  it("GET /api/pacotes lista os pros primeiro, com contagem e versao", async () => {
    const res = await fetch(`${url}/api/pacotes`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const lista = (await res.json()) as { id: string; nome: string; cartas: number; pessoas: number; versao: string }[];
    expect(lista.map((p) => [p.id, p.nome, p.cartas, p.pessoas])).toEqual([
      ["pros", "Pros / Mundial", 1, 1],
      ["amigos", "Amigos", 2, 1],
    ]);
    expect(lista[0]!.versao).toMatch(/^[0-9a-f]{40}$/);
  });

  it("GET /api/pacotes mostra arquivo quebrado como invalido, com contagens zeradas e sem cair (revisao final M2)", async () => {
    await writeFile(join(raiz, "packs", "quebrado.json"), "{ nao e json");
    await writeFile(join(raiz, "packs", "torto.json"), JSON.stringify({ name: "Torto", players: "x" }));
    const lista = (await (await fetch(`${url}/api/pacotes`)).json()) as Record<string, unknown>[];
    expect(lista.map((p) => p.id)).toEqual(["pros", "amigos", "quebrado", "torto"]);
    expect(lista[2]).toEqual({ id: "quebrado", nome: "quebrado", cartas: 0, pessoas: 0, versao: "", invalido: true, erro: "JSON quebrado" });
    expect(lista[3]).toMatchObject({ id: "torto", nome: "torto", invalido: true });
    expect(typeof lista[3]!.erro).toBe("string");
    expect(lista[3]).toMatchObject({ cartas: 0, pessoas: 0 });
    // Os validos seguem iguais.
    expect(lista[1]).toMatchObject({ id: "amigos", nome: "Amigos", cartas: 2, pessoas: 1 });
    expect(lista[1]).not.toHaveProperty("invalido");
  });

  it("GET /api/pacotes/:id devolve nome, cartas e versao", async () => {
    const res = await fetch(`${url}/api/pacotes/amigos`);
    const corpo = (await res.json()) as { id: string; nome: string; players: PlayerVersion[]; versao: string };
    expect(corpo.id).toBe("amigos");
    expect(corpo.nome).toBe("Amigos");
    expect(corpo.players.map((c) => c.id)).toEqual(["rafa-top", "rafa-mid"]);
  });

  it("pacote que nao existe da 404", async () => {
    expect((await fetch(`${url}/api/pacotes/nada`)).status).toBe(404);
  });

  it("ids maliciosos nao saem de public/", async () => {
    // (".." puro nem chega aqui: a URL ja normaliza "/api/pacotes/%2E%2E" para "/api/".)
    for (const id of ["..%2Fsegredo", "PROS", "amigos.json", "a%C3%A7ao"]) {
      const res = await fetch(`${url}/api/pacotes/${id}`);
      expect(res.status, id).toBe(404);
    }
    expect((await fetch(`${url}/packs/..%2Fplayers.json`)).status).not.toBe(200);
  });

  it("serve /packs e /players direto de public, sem cache", async () => {
    const pack = await fetch(`${url}/packs/amigos.json`);
    expect(pack.status).toBe(200);
    expect(pack.headers.get("cache-control")).toBe("no-cache");
    expect(((await pack.json()) as { name: string }).name).toBe("Amigos");
    const foto = await fetch(`${url}/players/rafa.jpg`);
    expect(foto.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await foto.arrayBuffer())[0]).toBe(0xff);
    expect((await fetch(`${url}/players/ninguem.jpg`)).status).toBe(404);
  });

  it("alvo de pedido que o URL recusa nao derruba nem e do handler", async () => {
    const porta = new URL(url).port;
    for (const path of ["//a:b/api/dono", "http://a:b/x", "http://[/x", "http://%/x"]) {
      const status = await new Promise<number>((ok, falha) => {
        const r = request({ host: "127.0.0.1", port: Number(porta), path, method: "GET" }, (res) => {
          res.resume();
          ok(res.statusCode ?? 0);
        });
        r.on("error", falha);
        r.end();
      });
      expect(status, path).toBe(418);
    }
    expect((await fetch(`${url}/api/dono`)).status).toBe(200);
  });

  it("rotas de fora nao sao do handler (o /players.json da sala continua de quem serve a sala)", async () => {
    expect((await fetch(`${url}/players.json`)).status).toBe(418);
    expect((await fetch(`${url}/api/room-info`)).status).toBe(418);
  });
});

async function versaoDe(id: string): Promise<string> {
  return ((await (await fetch(`${url}/api/pacotes/${id}`)).json()) as { versao: string }).versao;
}

const json = (metodo: string, corpo: unknown, dono = true): RequestInit => {
  const init: RequestInit = { method: metodo, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
  return dono ? comDono(init) : init;
};

describe("escrita de pacotes", () => {
  it("PUT sem o cabecalho do dono da 403 e nao toca o arquivo", async () => {
    const antes = await readFile(join(raiz, "packs", "amigos.json"), "utf8");
    const res = await fetch(`${url}/api/pacotes/amigos`, json("PUT", { nome: "Hack", players: [], versaoBase: await versaoDe("amigos") }, false));
    expect(res.status).toBe(403);
    expect(await readFile(join(raiz, "packs", "amigos.json"), "utf8")).toBe(antes);
  });

  it("PUT do dono grava, devolve a versao nova e o GET passa a ver", async () => {
    const res = await fetch(
      `${url}/api/pacotes/amigos`,
      json("PUT", { nome: "Amigos 2", players: [carta("rafa-top", "rafa")], versaoBase: await versaoDe("amigos") })
    );
    expect(res.status).toBe(200);
    const { versao } = (await res.json()) as { versao: string };
    expect(versao).toBe(await versaoDe("amigos"));
    const texto = await readFile(join(raiz, "packs", "amigos.json"), "utf8");
    expect(texto.startsWith('{\n  "name": "Amigos 2",')).toBe(true);
    expect(texto.endsWith("}\n")).toBe(true);
  });

  it("PUT preserva o $schema que o arquivo ja tinha", async () => {
    const res = await fetch(
      `${url}/api/pacotes/pros`,
      json("PUT", { nome: "Pros 2", players: [carta("faker-2016", "faker", "mid")], versaoBase: await versaoDe("pros") })
    );
    expect(res.status).toBe(200);
    const gravado = JSON.parse(await readFile(join(raiz, "players.json"), "utf8")) as { $schema: string; name: string };
    expect(gravado.name).toBe("Pros 2");
    expect(gravado.$schema).toBe("../.vscode/players.schema.json");
  });

  it("PUT com versaoBase velha da 409 com a versao do disco; forcar grava por cima", async () => {
    const velha = await versaoDe("amigos");
    await writeFile(join(raiz, "packs", "amigos.json"), JSON.stringify({ name: "Mudou por fora", players: [] }));
    const res = await fetch(`${url}/api/pacotes/amigos`, json("PUT", { nome: "Meu", players: [], versaoBase: velha }));
    expect(res.status).toBe(409);
    expect(((await res.json()) as { versao: string }).versao).toBe(await versaoDe("amigos"));

    const forcado = await fetch(`${url}/api/pacotes/amigos`, json("PUT", { nome: "Meu", players: [], versaoBase: velha, forcar: true }));
    expect(forcado.status).toBe(200);
    expect(JSON.parse(await readFile(join(raiz, "packs", "amigos.json"), "utf8")).name).toBe("Meu");
  });

  it("dois PUT juntos com a mesma versaoBase: um grava (200), o outro leva 409 e o disco fica com o vencedor", async () => {
    const base = await versaoDe("amigos");
    const nomes = ["Primeiro", "Segundo"];
    const respostas = await Promise.all(
      nomes.map((nome) => fetch(`${url}/api/pacotes/amigos`, json("PUT", { nome, players: [], versaoBase: base })))
    );
    const status = respostas.map((r) => r.status).sort();
    expect(status).toEqual([200, 409]);
    const vencedor = nomes[respostas.findIndex((r) => r.status === 200)]!;
    expect(JSON.parse(await readFile(join(raiz, "packs", "amigos.json"), "utf8")).name).toBe(vencedor);
  });

  it("PUT com carta fora das regras da 422 com os erros da carta", async () => {
    const torta = { ...carta("rafa-top", "rafa"), roleStrength: { top: 99, jungle: 0, mid: 0, adc: 0, support: 0 } };
    const res = await fetch(`${url}/api/pacotes/amigos`, json("PUT", { nome: "Amigos", players: [torta], versaoBase: await versaoDe("amigos") }));
    expect(res.status).toBe(422);
    const corpo = (await res.json()) as { cartas: { id: string; erros: string[] }[] };
    expect(corpo.cartas[0]!.id).toBe("rafa-top");
  });

  it("PUT com nome vazio ou JSON quebrado da 400", async () => {
    expect((await fetch(`${url}/api/pacotes/amigos`, json("PUT", { nome: "  ", players: [] }))).status).toBe(400);
    const quebrado = await fetch(`${url}/api/pacotes/amigos`, comDono({ method: "PUT", body: "{ nao" }));
    expect(quebrado.status).toBe(400);
  });

  it("PUT acima de 2 MB da 413", async () => {
    const enorme = { nome: "x", players: [], lixo: "a".repeat(2 * 1024 * 1024) };
    expect((await fetch(`${url}/api/pacotes/amigos`, json("PUT", enorme))).status).toBe(413);
  });

  it("PUT num pacote que nao existe da 404 (PUT so atualiza)", async () => {
    expect((await fetch(`${url}/api/pacotes/novo`, json("PUT", { nome: "Novo", players: [] }))).status).toBe(404);
  });

  it("POST cria o arquivo com id derivado do nome, sem repetir", async () => {
    const res = await fetch(`${url}/api/pacotes`, json("POST", { nome: "Amigos", players: [] }));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(id).toBe("amigos-2");
    const criado = JSON.parse(await readFile(join(raiz, "packs", "amigos-2.json"), "utf8"));
    expect(criado).toEqual({ $schema: "../../.vscode/players.schema.json", name: "Amigos", players: [] });
  });

  it("DELETE apaga o pacote do dono; os pros nao saem", async () => {
    expect((await fetch(`${url}/api/pacotes/amigos`, comDono({ method: "DELETE" }))).status).toBe(204);
    expect(await readdir(join(raiz, "packs"))).toEqual([]);
    expect((await fetch(`${url}/api/pacotes/pros`, comDono({ method: "DELETE" }))).status).toBe(400);
    expect((await fetch(`${url}/api/pacotes/amigos`, comDono({ method: "DELETE" }))).status).toBe(404);
    expect((await fetch(`${url}/api/pacotes/pros`, { method: "DELETE" })).status).toBe(403);
  });
});

describe("fotos", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const foto = (corpo: BodyInit, dono = true): RequestInit => {
    const init: RequestInit = { method: "PUT", headers: { "content-type": "image/jpeg" }, body: corpo };
    return dono ? comDono(init) : init;
  };

  it("PUT do dono grava public/players/<pessoa>.jpg", async () => {
    expect((await fetch(`${url}/api/fotos/ber`, foto(jpeg))).status).toBe(204);
    expect(new Uint8Array(await readFile(join(raiz, "players", "ber.jpg")))).toEqual(jpeg);
  });

  it("PUT sem o dono da 403, e nada aparece no disco", async () => {
    expect((await fetch(`${url}/api/fotos/ber`, foto(jpeg, false))).status).toBe(403);
    expect(await readdir(join(raiz, "players"))).toEqual(["rafa.jpg"]);
  });

  it("PUT de algo que nao e JPEG da 400", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect((await fetch(`${url}/api/fotos/ber`, foto(png))).status).toBe(400);
    expect(await readdir(join(raiz, "players"))).toEqual(["rafa.jpg"]);
  });

  it("PUT acima de 1 MB da 413", async () => {
    const grande = new Uint8Array(1024 * 1024 + 10);
    grande.set([0xff, 0xd8, 0xff]);
    expect((await fetch(`${url}/api/fotos/ber`, foto(grande))).status).toBe(413);
    expect(await readdir(join(raiz, "players"))).toEqual(["rafa.jpg"]);
  });

  it("foto com id invalido da 400 e nao sai de public/players", async () => {
    for (const id of ["..%2Fplayers", "Ber", "ber.jpg"]) {
      expect((await fetch(`${url}/api/fotos/${id}`, foto(jpeg))).status, id).toBe(400);
    }
    expect((await readdir(raiz)).sort()).toEqual(["packs", "players", "players.json"]);
  });

  it("DELETE de foto em uso da 409 com os pacotes que usam", async () => {
    const res = await fetch(`${url}/api/fotos/rafa`, comDono({ method: "DELETE" }));
    expect(res.status).toBe(409);
    expect(((await res.json()) as { pacotes: string[] }).pacotes).toEqual(["Amigos"]);
    expect(await readdir(join(raiz, "players"))).toEqual(["rafa.jpg"]);
  });

  it("DELETE de foto sem uso apaga; foto que nao existe tambem da 204", async () => {
    await writeFile(join(raiz, "players", "ber.jpg"), jpeg);
    expect((await fetch(`${url}/api/fotos/ber`, comDono({ method: "DELETE" }))).status).toBe(204);
    expect(await readdir(join(raiz, "players"))).toEqual(["rafa.jpg"]);
    expect((await fetch(`${url}/api/fotos/ninguem`, comDono({ method: "DELETE" }))).status).toBe(204);
  });

  it("DELETE com pacote de JSON quebrado que cita a foto da 409 e mantem o arquivo", async () => {
    await writeFile(join(raiz, "players", "ber.jpg"), jpeg);
    await writeFile(join(raiz, "packs", "quebrado.json"), '{ "players": [ { "photo": "/players/ber.jpg" ');
    const res = await fetch(`${url}/api/fotos/ber`, comDono({ method: "DELETE" }));
    expect(res.status).toBe(409);
    expect(((await res.json()) as { pacotes: string[] }).pacotes).toContain("quebrado");
    expect(await readdir(join(raiz, "players"))).toContain("ber.jpg");
  });

  it("DELETE com pacote que e JSON mas falha o schema e cita a foto da 409 e mantem o arquivo", async () => {
    await writeFile(join(raiz, "players", "ber.jpg"), jpeg);
    await writeFile(join(raiz, "packs", "quebrado.json"), JSON.stringify({ players: "/players/ber.jpg" }));
    const res = await fetch(`${url}/api/fotos/ber`, comDono({ method: "DELETE" }));
    expect(res.status).toBe(409);
    expect(((await res.json()) as { pacotes: string[] }).pacotes).toContain("quebrado");
    expect(await readdir(join(raiz, "players"))).toContain("ber.jpg");
  });

  it("DELETE com packs ilegivel da 500 e nao apaga nada", async () => {
    await writeFile(join(raiz, "players", "ber.jpg"), jpeg);
    await rm(join(raiz, "packs"), { recursive: true });
    await writeFile(join(raiz, "packs"), "isto e um arquivo, nao uma pasta");
    const res = await fetch(`${url}/api/fotos/ber`, comDono({ method: "DELETE" }));
    expect(res.status).toBe(500);
    expect(await readdir(join(raiz, "players"))).toContain("ber.jpg");
  });

  it("500 nao manda caminho do disco ao cliente e responde em pt-BR (revisao final M8)", async () => {
    await rm(join(raiz, "packs"), { recursive: true });
    await writeFile(join(raiz, "packs"), "isto e um arquivo, nao uma pasta");
    const res = await fetch(`${url}/api/pacotes`);
    expect(res.status).toBe(500);
    const texto = await res.text();
    expect(texto).not.toContain(raiz);
    expect(texto).not.toMatch(/ENOTDIR|lol7a0|[A-Za-z]:[\\/]/);
    expect(JSON.parse(texto)).toEqual({ erro: "Não consegui ler ou gravar o arquivo (falha de disco)." });
  });

  it("DELETE sem o dono da 403 e nao apaga", async () => {
    expect((await fetch(`${url}/api/fotos/rafa`, { method: "DELETE" })).status).toBe(403);
    expect(await readdir(join(raiz, "players"))).toEqual(["rafa.jpg"]);
  });
});
