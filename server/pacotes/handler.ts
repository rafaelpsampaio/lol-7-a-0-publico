/**
 * server/pacotes/handler.ts
 *
 * Rotas do editor de pacotes (secao 6 da spec 2026-10-05-editor-de-pacotes-design).
 * Le e grava os pacotes em public/ e as fotos em public/players/. Leitura e
 * livre; escrita so para o dono (E-11). Usado pelo servidor da sala
 * (server/http.ts) e pelo plugin do Vite (npm run dev).
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  ID_VALIDO,
  TAMANHO_MAXIMO_DA_FOTO,
  caminhoDaFoto,
  conferirPacote,
  ehJpeg,
  novoIdDePacote,
} from "../engine/pacotes";
import { ID_DOS_PROS, arquivoDoPacote, idsDosPacotes } from "./registro";
import {
  apagarArquivo,
  criarFilasPorChave,
  gravarAtomico,
  gravarPacote,
  lerPacote,
  motivoDoErroDeDisco,
  SCHEMA_DOS_PACOTES_NOVOS,
  type Leitura,
} from "./arquivos";
import { CorpoGrandeDemais, lerCorpo } from "./corpo";

export interface OpcoesDosPacotes {
  /** Pasta public/ do projeto (pacotes, players.json e fotos). */
  raizPublic: string;
  ehDono: (req: IncomingMessage) => boolean;
}

type Rota = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export function responder(res: ServerResponse, status: number, corpo?: unknown): void {
  if (corpo === undefined) {
    res.writeHead(status, { "cache-control": "no-store" });
    res.end();
    return;
  }
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(corpo));
}

/** Segmento da URL decodificado, ou "" se a codificacao estiver quebrada. */
function segmento(bruto: string): string {
  try {
    return decodeURIComponent(bruto);
  } catch {
    return "";
  }
}

const NAO_ENCONTRADO = { erro: "Pacote não encontrado." };

const LIMITE_DO_JSON = 2 * 1024 * 1024;
const SO_O_DONO = { erro: "Só o dono pode salvar. Abra pelo link de host que o servidor mostra ao subir." };

const PedidoDeGravacao = z.object({
  nome: z.string(),
  players: z.unknown(),
  versaoBase: z.string().optional(),
  forcar: z.boolean().optional(),
});
const PedidoDeCriacao = z.object({ nome: z.string(), players: z.unknown() });

/** Nome do pacote: 1 a 60 letras depois de aparar, ou null. */
function nomeValido(nome: string): string | null {
  const n = nome.trim();
  return n.length >= 1 && n.length <= 60 ? n : null;
}

export function criarHandlerDosPacotes(o: OpcoesDosPacotes): (req: IncomingMessage, res: ServerResponse) => boolean {
  async function servirArquivo(res: ServerResponse, arquivo: string, tipo: string): Promise<void> {
    try {
      const dados = await readFile(arquivo);
      res.writeHead(200, { "content-type": tipo, "cache-control": "no-cache" });
      res.end(dados);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") responder(res, 404, { erro: "Arquivo não encontrado." });
      else throw e;
    }
  }

  // Uma fila por pacote (chave = id, espaco diferente da fila por arquivo de
  // gravarAtomico): ler, conferir a versao e gravar viram um passo so, entao dois
  // PUT com a mesma versaoBase nao passam juntos e o segundo leva 409 (secao 6, Review Focus 2).
  const naFilaDoPacote = criarFilasPorChave();

  function negar(req: IncomingMessage, res: ServerResponse): void {
    req.resume();
    responder(res, 403, SO_O_DONO);
  }

  /** JSON do corpo, ou undefined depois de ja ter respondido 400/413. */
  async function lerJson(req: IncomingMessage, res: ServerResponse): Promise<unknown> {
    let bytes: Buffer;
    try {
      bytes = await lerCorpo(req, LIMITE_DO_JSON);
    } catch (e) {
      if (e instanceof CorpoGrandeDemais) {
        responder(res, 413, { erro: "Pacote grande demais (mais de 2 MB)." });
        return undefined;
      }
      throw e;
    }
    try {
      return JSON.parse(bytes.toString("utf8")) as unknown;
    } catch {
      responder(res, 400, { erro: "O corpo não é um JSON válido." });
      return undefined;
    }
  }

  /** Prologo comum de PUT e POST: JSON, formato do pedido e nome. Undefined depois de ja ter respondido. */
  async function lerPedido<S extends z.ZodType<{ nome: string }>>(
    req: IncomingMessage,
    res: ServerResponse,
    schema: S
  ): Promise<{ dados: z.output<S>; nome: string } | undefined> {
    const bruto = await lerJson(req, res);
    if (bruto === undefined) return undefined;
    const pedido = schema.safeParse(bruto);
    if (!pedido.success) {
      responder(res, 400, { erro: "Pedido malformado: falta nome ou players." });
      return undefined;
    }
    const nome = nomeValido(pedido.data.nome);
    if (nome === null) {
      responder(res, 400, { erro: "Dê um nome ao pacote (até 60 letras)." });
      return undefined;
    }
    return { dados: pedido.data, nome };
  }

  const listar: Rota = async (_req, res) => {
    // Revisao final M2: pacote com arquivo quebrado aparece como
    // { id, nome: id, invalido: true, erro } com contagens zeradas (mesmo formato
    // do resumo, o cliente nao as usa), para o dono ver o problema em vez de o
    // pacote sumir.
    const saida: {
      id: string;
      nome: string;
      cartas: number;
      pessoas: number;
      versao: string;
      invalido?: true;
      erro?: string;
    }[] = [];
    const quebrado = (id: string, erro: string) => ({ id, nome: id, cartas: 0, pessoas: 0, versao: "", invalido: true as const, erro });
    for (const id of await idsDosPacotes(o.raizPublic)) {
      let l: Leitura;
      try {
        l = await lerPacote(o.raizPublic, id);
      } catch (e) {
        console.warn(`[pacotes] nao consegui ler ${id}:`, e);
        saida.push(quebrado(id, motivoDoErroDeDisco(e)));
        continue;
      }
      if (l.tipo === "invalido") {
        console.warn(`[pacotes] arquivo com problema: ${l.erro}`);
        saida.push(quebrado(id, l.erro.startsWith(`${id}: `) ? l.erro.slice(id.length + 2) : l.erro));
        continue;
      }
      if (l.tipo !== "ok") continue;
      const p = l.pacote;
      saida.push({
        id: p.id,
        nome: p.nome,
        cartas: p.players.length,
        pessoas: new Set(p.players.map((c) => c.personId)).size,
        versao: p.versao,
      });
    }
    responder(res, 200, saida);
  };

  const ler = (id: string): Rota => async (_req, res) => {
    const l = await lerPacote(o.raizPublic, id);
    if (l.tipo === "ausente") return responder(res, 404, NAO_ENCONTRADO);
    if (l.tipo === "invalido") return responder(res, 500, { erro: l.erro });
    const p = l.pacote;
    responder(res, 200, { id: p.id, nome: p.nome, players: p.players, versao: p.versao });
  };

  const gravar = (id: string): Rota => async (req, res) => {
    if (!o.ehDono(req)) return negar(req, res);
    const pedido = await lerPedido(req, res, PedidoDeGravacao);
    if (pedido === undefined) return;
    const { dados, nome } = pedido;

    await naFilaDoPacote(id, async () => {
      const atual = await lerPacote(o.raizPublic, id);
      if (atual.tipo === "ausente") return responder(res, 404, NAO_ENCONTRADO);
      if (dados.forcar !== true) {
        const versaoNoDisco = atual.tipo === "ok" ? atual.pacote.versao : null;
        if (versaoNoDisco === null || dados.versaoBase !== versaoNoDisco) {
          return responder(res, 409, { erro: "Este pacote mudou fora do editor.", versao: versaoNoDisco });
        }
      }

      const schema = atual.tipo === "ok" ? atual.pacote.schema : undefined;
      const conferido = conferirPacote({
        ...(schema === undefined ? {} : { $schema: schema }),
        name: nome,
        players: dados.players,
      });
      if (!conferido.ok) return responder(res, 422, { erro: conferido.erro, cartas: conferido.cartas });
      const versao = await gravarPacote(o.raizPublic, id, { schema, nome, players: conferido.players });
      responder(res, 200, { versao });
    });
  };

  const criar: Rota = async (req, res) => {
    if (!o.ehDono(req)) return negar(req, res);
    const pedido = await lerPedido(req, res, PedidoDeCriacao);
    if (pedido === undefined) return;
    const { dados, nome } = pedido;
    const conferido = conferirPacote({ name: nome, players: dados.players });
    if (!conferido.ok) return responder(res, 422, { erro: conferido.erro, cartas: conferido.cartas });
    const id = novoIdDePacote(nome, new Set(await idsDosPacotes(o.raizPublic)));
    const versao = await gravarPacote(o.raizPublic, id, { schema: SCHEMA_DOS_PACOTES_NOVOS, nome, players: conferido.players });
    responder(res, 201, { id, versao });
  };

  const excluir = (id: string): Rota => async (req, res) => {
    if (!o.ehDono(req)) return negar(req, res);
    if (id === ID_DOS_PROS) return responder(res, 400, { erro: "A base padrão não pode ser excluída." });
    const arquivo = arquivoDoPacote(o.raizPublic, id);
    if (arquivo === null) return responder(res, 404, NAO_ENCONTRADO);
    await naFilaDoPacote(id, async () => {
      try {
        await unlink(arquivo);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return responder(res, 404, NAO_ENCONTRADO);
        throw e;
      }
      responder(res, 204);
    });
  };

  const ID_DE_FOTO_INVALIDO = { erro: "Id de pessoa inválido (use letras minúsculas, números e hífen)." };

  const subirFoto = (pessoa: string): Rota => async (req, res) => {
    if (!o.ehDono(req)) return negar(req, res);
    if (!ID_VALIDO.test(pessoa)) {
      req.resume();
      return responder(res, 400, ID_DE_FOTO_INVALIDO);
    }
    let bytes: Buffer;
    try {
      bytes = await lerCorpo(req, TAMANHO_MAXIMO_DA_FOTO);
    } catch (e) {
      if (e instanceof CorpoGrandeDemais) return responder(res, 413, { erro: "Foto grande demais (mais de 1 MB)." });
      throw e;
    }
    if (!ehJpeg(bytes)) return responder(res, 400, { erro: "Isso não é um JPEG." });
    await gravarAtomico(join(o.raizPublic, "players", `${pessoa}.jpg`), bytes);
    responder(res, 204);
  };

  /**
   * Nomes dos pacotes que ainda apontam para a foto da pessoa. Falha fechada
   * (Review Focus 5): pacote invalido conta se o texto cru cita a foto (listado
   * pelo id), e erro de leitura propaga em vez de virar "nao usa".
   */
  async function quemUsa(pessoa: string): Promise<string[]> {
    const usam: string[] = [];
    const caminho = caminhoDaFoto(pessoa);
    for (const id of await idsDosPacotes(o.raizPublic)) {
      const l = await lerPacote(o.raizPublic, id);
      if (l.tipo === "ok") {
        if (l.pacote.players.some((c) => c.photo === caminho)) usam.push(l.pacote.nome);
      } else if (l.tipo === "invalido") {
        const arquivo = arquivoDoPacote(o.raizPublic, id);
        const texto =
          arquivo === null
            ? ""
            : await readFile(arquivo, "utf8").catch((e: NodeJS.ErrnoException) => {
                if (e.code === "ENOENT") return "";
                throw e;
              });
        if (texto.includes(caminho)) usam.push(id);
      }
    }
    return usam;
  }

  const apagarFoto = (pessoa: string): Rota => async (req, res) => {
    if (!o.ehDono(req)) return negar(req, res);
    if (!ID_VALIDO.test(pessoa)) return responder(res, 400, ID_DE_FOTO_INVALIDO);
    const usam = await quemUsa(pessoa);
    if (usam.length > 0) return responder(res, 409, { erro: "A foto ainda é usada.", pacotes: usam });
    await apagarArquivo(join(o.raizPublic, "players", `${pessoa}.jpg`));
    responder(res, 204);
  };

  const naoSuportado: Rota = async (req, res) => {
    req.resume();
    responder(res, 405, { erro: "Método não suportado." });
  };

  function casar(metodo: string, caminho: string): Rota | null {
    if (caminho === "/api/dono") {
      return metodo === "GET" ? async (req, res) => responder(res, 200, { dono: o.ehDono(req) }) : naoSuportado;
    }
    if (caminho === "/api/pacotes") {
      if (metodo === "GET") return listar;
      if (metodo === "POST") return criar;
      return naoSuportado;
    }
    const mPacote = /^\/api\/pacotes\/([^/]+)$/.exec(caminho);
    if (mPacote !== null) {
      const id = segmento(mPacote[1]!);
      if (arquivoDoPacote(o.raizPublic, id) === null) {
        return async (req, res) => {
          req.resume();
          responder(res, 404, NAO_ENCONTRADO);
        };
      }
      if (metodo === "GET") return ler(id);
      if (metodo === "PUT") return gravar(id);
      if (metodo === "DELETE") return excluir(id);
      return naoSuportado;
    }
    const mFoto = /^\/api\/fotos\/([^/]+)$/.exec(caminho);
    if (mFoto !== null) {
      const pessoa = segmento(mFoto[1]!);
      if (metodo === "PUT") return subirFoto(pessoa);
      if (metodo === "DELETE") return apagarFoto(pessoa);
      return naoSuportado;
    }

    const mPack = /^\/packs\/([^/]+)\.json$/.exec(caminho);
    if (mPack !== null && metodo === "GET") {
      const id = segmento(mPack[1]!);
      if (!ID_VALIDO.test(id) || id === ID_DOS_PROS) return async (_req, res) => responder(res, 404, NAO_ENCONTRADO);
      return async (_req, res) => servirArquivo(res, join(o.raizPublic, "packs", `${id}.json`), "application/json; charset=utf-8");
    }
    const mFotoEstatica = /^\/players\/([^/]+)\.jpg$/.exec(caminho);
    if (mFotoEstatica !== null && metodo === "GET") {
      const pessoa = segmento(mFotoEstatica[1]!);
      if (!ID_VALIDO.test(pessoa)) return async (_req, res) => responder(res, 404, { erro: "Arquivo não encontrado." });
      return async (_req, res) => servirArquivo(res, join(o.raizPublic, "players", `${pessoa}.jpg`), "image/jpeg");
    }
    return null;
  }

  return function handle(req, res): boolean {
    // Alvo de pedido que o parser do Node aceita mas o URL recusa (//a:b/x):
    // nao e nosso, e nunca pode derrubar o servidor que nos chama.
    let caminho: string;
    try {
      caminho = new URL(req.url ?? "/", "http://local").pathname;
    } catch {
      return false;
    }
    const rota = casar(req.method ?? "GET", caminho);
    if (rota === null) return false;
    rota(req, res).catch((err: unknown) => {
      // Revisao final M8: o texto do erro traz caminho do disco; fica no log do servidor.
      console.error("[pacotes]", err);
      if (!res.headersSent) responder(res, 500, { erro: `Não consegui ler ou gravar o arquivo (${motivoDoErroDeDisco(err)}).` });
      else res.end();
    });
    return true;
  };
}
