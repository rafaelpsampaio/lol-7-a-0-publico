/**
 * server/main.ts
 *
 * Arranque do servidor de salas: base, snapshot, HTTP, WebSocket e links.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createHttpServer } from "./http";
import { attachWebSocketServer } from "./ws";
import { RoomHub } from "./room/hub";
import { HOST_RECONNECT_GRACE_SECONDS } from "./protocol";
import { createRoom } from "./room/state";
import {
  criarGravadorDeSala,
  deleteRoom,
  loadRoom,
  roomSnapshotAgeMs,
} from "./room/persistence";
import { ensureRoomBase, publishRoomBase } from "./room/base";
import { baseStatus, baseStatusMessage } from "./room/baseCheck";
import { readChampionCatalogue, readPlayerDatabase } from "./engine/index";
import { parseArgs, hostUrls } from "./cli";
import { espelharConsoleEmArquivo } from "./logFile";
import { criarHandlerDosPacotes } from "./pacotes/handler";
import { checagemDoDono, lembrarTokenDoDono } from "./pacotes/dono";
import { idsDosPacotes } from "./pacotes/registro";
import { lerPacote } from "./pacotes/arquivos";
import { appPaths } from "./appPaths";

/** Snapshot mais velho que isso e de outra noite de jogo — nao serve mais. */
const SNAPSHOT_VALIDO_MS = 12 * 60 * 60 * 1000;

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = process.env.LOL_APP_ROOT || resolve(here, "..");
const { port, tunnel, novaSala, hostAuto } = parseArgs(process.argv.slice(2));

const distDir = resolve(projectRoot, "dist");
const { roomDataDir, raizPublic } = await appPaths(projectRoot, process.env.LOL_DATA_DIR);

// Fechar a janela ou Ctrl+C tambem encerra os processos de tunel no exit.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.once(signal, () => process.exit(0));
}

// Antes de qualquer console.log/warn/error da subida: assim a subida inteira
// (links impressos, avisos de base, etc.) tambem fica no arquivo.
espelharConsoleEmArquivo(roomDataDir);

const roomBaseFile = await ensureRoomBase(
  roomDataDir,
  resolve(projectRoot, "public/players.json")
);

// Snapshot anterior mantem a sala viva entre reinicios — mas so o de hoje, e
// so se ninguem pediu sala nova. Sala velha significa nomes de time ocupados e
// vagas presas por gente que nem vai jogar.
async function abrirSala() {
  if (novaSala) {
    await deleteRoom(roomDataDir);
    console.log("Sala nova: o snapshot anterior foi apagado.");
    return { room: createRoom(randomUUID(), hostAuto), restaurada: false };
  }

  const idadeMs = await roomSnapshotAgeMs(roomDataDir, Date.now());
  if (idadeMs !== null && idadeMs > SNAPSHOT_VALIDO_MS) {
    await deleteRoom(roomDataDir);
    const horas = Math.round(idadeMs / (60 * 60 * 1000));
    console.log(`Sala anterior tinha ${horas}h - velha demais. Comecando uma sala nova.`);
    return { room: createRoom(randomUUID(), hostAuto), restaurada: false };
  }

  const restaurada = await loadRoom(roomDataDir);
  if (restaurada !== null) {
    console.log("Sala anterior restaurada do snapshot. Use --nova-sala para comecar do zero.");
    return { room: restaurada, restaurada: true };
  }

  return { room: createRoom(randomUUID(), hostAuto), restaurada: false };
}

const { room, restaurada: salaRestaurada } = await abrirSala();
// O modo sobrevive ao reinício. A flag também pode ativá-lo numa sala manual.
if (hostAuto) room.hostAuto = true;

// E-11: no modo manual, o dono começa com o token do link de host. No
// automático, recebe um segredo independente. Transferir o host nunca muda
// o dono: server/data/dono.token sobrevive ao reinício da sala restaurada.
const tokenDoDono = await lembrarTokenDoDono(roomDataDir, room.hostToken, !salaRestaurada, room.hostAuto);

const baseInicial = await readPlayerDatabase(roomBaseFile);
if (!baseInicial.ok) {
  console.error(`\nA base da sala esta invalida: ${baseInicial.error}`);
  console.error(`Apague ${roomBaseFile} para o servidor copiar a base do jogo de novo.\n`);
  process.exit(1);
}

// O catalogo de campeoes so alimenta o retrato na tela (D-26): a simulacao em
// si nao depende dele. Por isso um catalogo ilegivel nao derruba o servidor —
// so avisa e segue com [], igual ja acontece nos testes que rodam runWave
// sem catalogo nenhum.
const catalogoResult = await readChampionCatalogue(resolve(projectRoot, "public/champions.json"));
if (!catalogoResult.ok) {
  console.warn(
    `[sala] catalogo de campeoes invalido (${catalogoResult.error}) - seguindo sem retrato dos campeoes.`
  );
}
const catalogue = catalogoResult.ok ? catalogoResult.champions : [];

if (!room.settings.baseName) {
  // Os pacotes em arquivo (public/packs) entram como candidatos ao nome da base.
  // So nome: qualquer falha aqui nao pode impedir a sala de abrir.
  const candidates: [string, string][] = [["public/players.json", "Base padrão do jogo"]];
  try {
    for (const id of await idsDosPacotes(raizPublic)) {
      if (id === "pros") continue;
      const l = await lerPacote(raizPublic, id).catch(() => null);
      if (l?.tipo === "ok") candidates.push([`public/packs/${id}.json`, l.pacote.nome]);
    }
  } catch {
    // fica so com o candidato dos pros
  }
  room.settings.baseName = "Base personalizada da sala";
  for (const [path, name] of candidates) {
    const candidate = await readPlayerDatabase(resolve(raizPublic, path.slice("public/".length)));
    if (candidate.ok && JSON.stringify(candidate.players) === JSON.stringify(baseInicial.players)) {
      room.settings.baseName = name;
      break;
    }
  }
}
const gravarSala = criarGravadorDeSala(roomDataDir);

const hub = new RoomHub(room, baseInicial.players, {
  makeClientId: () => randomUUID(),
  makePublicId: () => randomUUID(),
  makeSeed: () => randomUUID(),
  now: () => Date.now(),
  schedule: (ms, fn) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
  onRoomChanged: (atual) => {
    // Serializado (M-3 da revisao final): o onRoomChanged dispara a cada
    // mudanca de sala e duas gravacoes na mesma volta do event loop sao
    // normais -- o #commit da onda e o #commit do cache de timeline dentro do
    // #gamesOutbound. Sem fila, as duas corriam e a mais velha podia vencer o
    // rename, deixando no disco um estado que a sala ja passou.
    void gravarSala(atual).catch((err: unknown) => {
      console.error("[sala] falha ao salvar snapshot:", err);
    });
  },
  publishBase: (raw) => publishRoomBase(roomDataDir, raw),
  loadPlayers: async () => {
    const r = await readPlayerDatabase(roomBaseFile);
    if (!r.ok) throw new Error(r.error);
    return r.players;
  },
  catalogue,
});
// Salva também a ativação por flag numa sala restaurada, mesmo sem entradas.
if (room.hostAuto) await gravarSala(hub.room);

// Links que o lobby mostra para o host mandar ao grupo. O do tunel entra
// quando o cloudflared anunciar (anunciarLinkPublico, abaixo), na frente.
const linksDeLan = hostUrls(port, room.hostToken).lan;
let linkPublico: string | null = null;
// Verdadeiro quando o tunel foi pedido mas nao vai sair (cloudflared ausente ou
// morreu antes de anunciar o link): o lobby para de esperar por ele.
let tunelFalhou = false;

const server = createHttpServer({
  distDir,
  roomBaseFile,
  defaultBaseFile: resolve(projectRoot, "public/players.json"),
  convites: () => (linkPublico === null ? linksDeLan : [linkPublico, ...linksDeLan]),
  aguardandoTunel: () => tunnel && linkPublico === null && !tunelFalhou,
  fase: () => hub.room.phase,
  conectados: () => hub.room.players.filter((p) => p.connected && !p.spectator).length,
  hostAuto: () => hub.room.hostAuto === true,
  pacotes: criarHandlerDosPacotes({ raizPublic, ehDono: checagemDoDono(tokenDoDono) }),
});

// Registrado ANTES de attachWebSocketServer: o `ws` repassa o 'error' do
// servidor HTTP para si mesmo, e sem ouvinte antes dele o Node imprime um
// stack trace cru. Nunca despejar isso na cara de quem so quer jogar.
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nA porta ${port} ja esta ocupada por outro programa.`);
    console.error(`Feche o outro servidor ou rode com outra porta, por exemplo:`);
    console.error(`  npm run server -- --port ${port + 1}\n`);
  } else if (err.code === "EACCES") {
    console.error(`\nSem permissao para usar a porta ${port}.`);
    console.error(`Escolha uma porta acima de 1024, por exemplo: npm run server -- --port 7070\n`);
  } else {
    console.error(`\nNao foi possivel abrir a sala: ${err.message}\n`);
  }
  process.exit(1);
});

attachWebSocketServer(server, hub);

server.listen(port, () => {
  const urls = hostUrls(port, room.hostToken);
  console.log("\n=== LoL 7 a 0 - sala aberta ===");
  if (room.hostAuto) {
    console.log(`Sala: http://localhost:${port}/`);
    console.log(`Host automatico: o primeiro jogador assume; queda de ${HOST_RECONNECT_GRACE_SECONDS}s passa o controle para outro jogador.`);
  } else {
    console.log(`Voce (host): ${urls.local}`);
  }
  if (room.hostAuto || tokenDoDono !== room.hostToken) {
    console.log(`Editar pacotes (dono): ${hostUrls(port, tokenDoDono).local}`);
  }
  for (const url of urls.lan) {
    console.log(`Amigos na sua rede: ${url}`);
  }
  if (!tunnel) {
    console.log(
      "\nPara amigos fora da sua rede, rode com --tunnel (precisa do cloudflared instalado)."
    );
  }

  const status = baseStatus(baseInicial.players);
  if (!status.ready) {
    console.log(`Atencao: ${baseStatusMessage(status)}`);
  }

  console.log("");

  if (process.env.LOL_OPEN_BROWSER === "1" && process.platform === "win32") {
    const browser = spawn("explorer.exe", [room.hostAuto ? hostUrls(port, tokenDoDono).local : urls.local]);
    browser.on("error", () => console.log("Abra o link local acima no navegador."));
  }

  if (tunnel) {
    // O `cloudflared` acabou de ser instalado (winget) pode nao estar no PATH
    // ainda nesta sessao -- so um novo login pega a variavel de ambiente
    // atualizada. Falls back pros caminhos de instalacao mais comuns do
    // Windows antes de desistir.
    const candidatos = [
      ...(process.env.LOL_CLOUDFLARED ? [process.env.LOL_CLOUDFLARED] : []),
      "cloudflared",
      "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
      "C:\\Program Files\\cloudflared\\cloudflared.exe",
    ];

    const tentar = (i: number): void => {
      if (i >= candidatos.length) {
        tunelFalhou = true;
        console.error(
          "cloudflared nao encontrado. Instale com `winget install --id Cloudflare.cloudflared` " +
            "(depois feche e abra este terminal de novo) ou baixe em " +
            "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
        );
        return;
      }
      const proc = spawn(candidatos[i]!, ["tunnel", "--url", `http://localhost:${port}`], {
        stdio: ["ignore", "ignore", "pipe"],
      });
      proc.on("error", () => tentar(i + 1));
      // Nao deixar o tunel vivo depois de fechar o aplicativo.
      process.once("exit", () => proc.kill());

      // O cloudflared narra a conexao inteira em INF antes de ficar quieto; o
      // link publico fica perdido no meio disso. So um regex na saida e
      // anunciar limpo assim que aparecer -- o resto (ERR) ainda passa.
      let buffer = "";
      let anunciado = false;
      proc.stderr?.on("data", (chunk: Buffer) => {
        const texto = chunk.toString("utf8");

        if (!anunciado) {
          buffer += texto;
          const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(buffer);
          if (match) {
            anunciado = true;
            buffer = "";
            anunciarLinkPublico(match[0]);
          }
        }

        if (/\bERR\b/.test(texto)) {
          process.stderr.write(texto);
        }
      });
      // 'exit' e nao 'close': com binario inexistente o Node emite 'error' e
      // 'close' (sem 'exit'), e ai a proxima tentativa ainda esta de pe.
      proc.on("exit", () => {
        if (!anunciado) tunelFalhou = true;
      });
    };

    tentar(0);
  }
});

function anunciarLinkPublico(url: string): void {
  linkPublico = url;
  console.log("\n=== Link publico (manda pros seus amigos) ===");
  console.log(url);
  console.log("Eles so precisam abrir esse link no navegador -- nao instala nada.\n");

  // Conveniencia best-effort: se falhar, o link ja esta impresso acima.
  try {
    const clip = spawn("clip");
    clip.on("spawn", () => console.log("(link copiado para a area de transferencia)"));
    clip.on("error", () => undefined);
    clip.stdin.write(url);
    clip.stdin.end();
  } catch {
    // sem clip.exe disponivel -- sem problema, o link ja foi impresso
  }
}
