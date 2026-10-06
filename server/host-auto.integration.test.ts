import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createHttpServer } from "./http";
import { HOST_RECONNECT_GRACE_SECONDS, PROTOCOL_VERSION } from "./protocol";
import { attachWebSocketServer } from "./ws";
import { RoomHub } from "./room/hub";
import { createRoom } from "./room/state";
import { saveRoom, loadRoom } from "./room/persistence";
import { publishRoomBase } from "./room/base";
import { checagemDoDono, lembrarTokenDoDono } from "./pacotes/dono";
import { criarHandlerDosPacotes } from "./pacotes/handler";
import { BASE, ClienteFalso, entrar } from "./testing/clienteFalso";

it("link comum dá controle da sala por HTTP/WS, troca o host e mantém arquivos restritos ao dono", async () => {
  const root = await mkdtemp(join(tmpdir(), "lol7a0-host-auto-"));
  const publicDir = join(root, "public");
  const dataDir = join(root, "data");
  const distDir = join(root, "dist");
  await mkdir(join(publicDir, "packs"), { recursive: true });
  await mkdir(dataDir);
  await mkdir(distDir);
  await writeFile(join(distDir, "index.html"), "<h1>Sala</h1>");
  await writeFile(join(publicDir, "players.json"), JSON.stringify({ name: "Pros", players: BASE }));
  const packFile = join(publicDir, "packs", "amigos.json");
  await writeFile(packFile, JSON.stringify({ name: "Amigos", players: [] }));
  const roomBaseFile = join(dataDir, "players.json");
  await writeFile(roomBaseFile, JSON.stringify({ players: BASE }));
  const room = createRoom(randomUUID(), true);
  const ownerToken = await lembrarTokenDoDono(dataDir, room.hostToken, true, true);

  let now = 0;
  const timers = new Set<{ at: number; fn: () => void }>();
  const hub = new RoomHub(room, BASE, {
    makeClientId: randomUUID, makePublicId: randomUUID, makeSeed: randomUUID,
    now: () => now,
    schedule: (ms, fn) => {
      const timer = { at: now + ms, fn };
      timers.add(timer);
      return () => { timers.delete(timer); };
    },
    onRoomChanged: () => {},
    publishBase: (raw) => publishRoomBase(dataDir, raw),
    loadPlayers: async () => BASE,
    catalogue: [],
  });
  const http = createHttpServer({
    distDir, roomBaseFile,
    hostAuto: () => hub.room.hostAuto === true,
    fase: () => hub.room.phase,
    pacotes: criarHandlerDosPacotes({ raizPublic: publicDir, ehDono: checagemDoDono(ownerToken) }),
  });
  const ws = attachWebSocketServer(http, hub, { pingMs: 60_000, timeoutMs: 300_000 });
  const clients: ClienteFalso[] = [];
  try {
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    if (address === null || typeof address === "string") throw new Error("sem porta");
    const base = `http://127.0.0.1:${address.port}`;
    const url = `ws://127.0.0.1:${address.port}/ws`;
    expect(await (await fetch(`${base}/api/room-info`)).json()).toMatchObject({ hostAuto: true });
    expect(await (await fetch(`${base}/server/data/dono.token`)).text()).not.toContain(ownerToken);
    const a = await entrar(url, "Ana", "A");
    clients.push(a);
    const b = await entrar(url, "Bia", "B");
    clients.push(b);
    expect(a.ultima("welcome")!.isHost).toBe(true);
    expect(b.ultima("welcome")!.isHost).toBe(false);

    const patchPack = (token?: string) => fetch(`${base}/api/pacotes/amigos`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...(token ? { "x-dono": token } : {}) },
      body: JSON.stringify({ nome: "Alterado", players: [], forcar: true }),
    });
    const originalPack = await readFile(packFile, "utf8");
    expect((await patchPack()).status).toBe(403);
    expect((await patchPack(room.hostToken)).status).toBe(403);
    expect(await readFile(packFile, "utf8")).toBe(originalPack);

    const anaId = a.ultima("welcome")!.clientId;
    const biaPublicId = b.ultima("welcome")!.publicId;
    a.fechar();
    await b.esperarQue("roomState", (m) => m.state.players.some((p) => p.nickname === "Ana" && !p.connected));
    now += HOST_RECONNECT_GRACE_SECONDS * 1000;
    for (const timer of [...timers]) {
      if (timer.at <= now) { timers.delete(timer); timer.fn(); }
    }
    await b.esperarQue("roomState", (m) => m.state.players.some((p) => p.publicId === biaPublicId && p.isHost));
    expect((await patchPack(hub.room.hostToken)).status).toBe(403);
    expect((await patchPack(ownerToken)).status).toBe(200);
    expect(JSON.parse(await readFile(packFile, "utf8")).name).toBe("Alterado");

    b.enviar({ type: "publishBase", database: { players: BASE }, name: "Base remota" });
    await b.esperarQue("roomState", (m) => m.state.settings.baseName === "Base remota");
    expect(JSON.parse(await readFile(roomBaseFile, "utf8")).players).toEqual(BASE);
    const back = await ClienteFalso.abrir(url);
    clients.push(back);
    back.enviar({ type: "hello", protocolVersion: PROTOCOL_VERSION, nickname: "Ana", teamName: "A", clientId: anaId, hostToken: room.hostToken });
    expect((await back.esperar("welcome")).isHost).toBe(false);
    back.enviar({ type: "setSettings", turnSeconds: 90 });
    expect((await back.esperar("error")).code).toBe("not_host");
    b.enviar({ type: "startDraft", turnSeconds: 90 });
    await b.esperarQue("roomState", (m) => m.state.phase === "draft");
    await saveRoom(dataDir, hub.room);
    const restored = await loadRoom(dataDir);
    expect(restored?.hostAuto).toBe(true);
    expect(restored?.players.find((p) => p.isHost)?.publicId).toBe(biaPublicId);
    for (const client of clients) {
      expect(client.brutas.join("\n")).not.toContain(ownerToken);
      expect(client.brutas.join("\n")).not.toContain(hub.room.hostToken);
    }
  } finally {
    for (const client of clients) client.fechar();
    ws.close();
    await new Promise<void>((resolve) => http.close(() => resolve()));
  }
});

it("CLI ativa --host-auto, imprime link comum e segredo do editor separado e restaura o modo sem entradas", async () => {
  // Executa main.ts em uma cópia temporária para preservar os dados e pacotes
  // reais da pessoa que está rodando os testes. Não abre túnel público.
  const root = await mkdtemp(join(tmpdir(), "lol7a0-host-auto-cli-"));
  const filter = (source: string) => !/\.test\.[^./\\]+$/.test(source);
  await cp(resolve("server"), join(root, "server"), { recursive: true, filter: (source) => basename(source) !== "data" && filter(source) });
  await cp(resolve("src"), join(root, "src"), { recursive: true, filter });
  await symlink(resolve("node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
  await mkdir(join(root, "public"));
  await writeFile(join(root, "public", "players.json"), JSON.stringify({ players: BASE }));
  await writeFile(join(root, "public", "champions.json"), JSON.stringify({ champions: [] }));
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "dist", "index.html"), "<h1>Sala</h1>");

  async function boot(flags: string[]) {
    const reservation = createServer();
    await new Promise<void>((ok) => reservation.listen(0, "127.0.0.1", ok));
    const address = reservation.address();
    if (address === null || typeof address === "string") throw new Error("sem porta");
    await new Promise<void>((ok) => reservation.close(() => ok()));
    const child = spawn(process.execPath, ["--import", "tsx", join(root, "server", "main.ts"), "--port", String(address.port), ...flags], {
      cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => { output += String(data); });
    child.stderr.resume();
    try {
      const deadline = Date.now() + 15_000;
      while (!output.includes("sala aberta")) {
        if (child.exitCode !== null || Date.now() > deadline) throw new Error("main.ts não abriu a sala temporária");
        await new Promise((ok) => setTimeout(ok, 20));
      }
      const info = await (await fetch(`http://127.0.0.1:${address.port}/api/room-info`)).json();
      expect(info).toMatchObject({ hostAuto: true });
      expect(output.includes("Voce (host):")).toBe(false);
      expect(output.includes("Editar pacotes (dono):")).toBe(true);
      expect(output.includes(`Sala: http://localhost:${address.port}/`)).toBe(true);
      const snapshot = await loadRoom(join(root, "server", "data"));
      expect(snapshot?.hostAuto).toBe(true);
      expect(snapshot?.players).toHaveLength(0);
      const owner = (await readFile(join(root, "server", "data", "dono.token"), "utf8")).trim();
      expect(owner).not.toBe(snapshot?.hostToken);
      return owner;
    } finally {
      if (child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill();
        await exited;
      }
    }
  }

  const owner = await boot(["--host-auto"]);
  expect(await boot([])).toBe(owner);
});
