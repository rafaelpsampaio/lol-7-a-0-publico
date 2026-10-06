/**
 * server/pacotes/arquivos.ts
 *
 * Leitura e escrita dos arquivos de pacote. A versao e o sha1 do texto no
 * disco: o editor manda a versao em que comecou, e o servidor recusa se o
 * arquivo mudou por fora (E-05). Escrita atomica com tmp + rename, apagando o
 * tmp se o rename falhar (mesmo padrao de server/engine/index.ts).
 */

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { PlayerDatabaseSchema, type PlayerVersion } from "../engine/pacotes";
import { ID_DOS_PROS, arquivoDoPacote } from "./registro";

export const NOME_DOS_PROS = "Pros / Mundial";
/** $schema dos pacotes novos, relativo a public/packs/. */
export const SCHEMA_DOS_PACOTES_NOVOS = "../../.vscode/players.schema.json";

export interface PacoteNoDisco {
  id: string;
  nome: string;
  schema?: string;
  players: PlayerVersion[];
  versao: string;
}

export type Leitura =
  | { tipo: "ok"; pacote: PacoteNoDisco }
  | { tipo: "ausente" }
  | { tipo: "invalido"; erro: string };

/** Motivo curto em pt-BR para o cliente, sem caminho nem texto do sistema (revisao final M8). */
export function motivoDoErroDeDisco(e: unknown): string {
  switch ((e as NodeJS.ErrnoException | null)?.code) {
    case "EACCES":
    case "EPERM":
      return "sem permissão no disco";
    case "EBUSY":
      return "arquivo em uso por outro programa";
    case "ENOSPC":
      return "disco cheio";
    default:
      return "falha de disco";
  }
}

export function versaoDe(texto: string): string {
  return createHash("sha1").update(texto).digest("hex");
}

export async function lerPacote(raizPublic: string, id: string): Promise<Leitura> {
  const arquivo = arquivoDoPacote(raizPublic, id);
  if (arquivo === null) return { tipo: "ausente" };
  let texto: string;
  try {
    texto = await readFile(arquivo, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { tipo: "ausente" };
    throw e;
  }
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto) as unknown;
  } catch {
    return { tipo: "invalido", erro: `${id}: JSON quebrado` };
  }
  const r = PlayerDatabaseSchema.safeParse(bruto);
  if (!r.success) {
    const i = r.error.issues[0];
    return { tipo: "invalido", erro: `${id}: ${i?.path.map(String).join(".") ?? ""} ${i?.message ?? ""}`.trim() };
  }
  return {
    tipo: "ok",
    pacote: {
      id,
      nome: r.data.name ?? (id === ID_DOS_PROS ? NOME_DOS_PROS : id),
      schema: r.data.$schema,
      players: r.data.players,
      versao: versaoDe(texto),
    },
  };
}

/** Texto gravado: $schema, name, players, 2 espacos e quebra de linha no fim (diff limpo). */
export function textoDoPacote(d: { schema?: string; nome: string; players: PlayerVersion[] }): string {
  const obj =
    d.schema === undefined
      ? { name: d.nome, players: d.players }
      : { $schema: d.schema, name: d.nome, players: d.players };
  return `${JSON.stringify(obj, null, 2)}\n`;
}

/**
 * Filas por chave: tarefas da mesma chave rodam uma depois da outra, chaves
 * diferentes ficam em paralelo. Tarefa que falha propaga o erro a quem chamou
 * sem prender a fila (mesmo padrao de criarFilaSerial em server/room/persistence.ts).
 */
export function criarFilasPorChave(): <T>(chave: string, tarefa: () => Promise<T>) => Promise<T> {
  const filas = new Map<string, Promise<unknown>>();
  return <T>(chave: string, tarefa: () => Promise<T>): Promise<T> => {
    const proxima = (filas.get(chave) ?? Promise.resolve()).then(tarefa);
    const cauda = proxima.catch(() => undefined);
    filas.set(chave, cauda);
    // Fila vazia some do mapa, senao ele cresceria com cada arquivo ja gravado.
    void cauda.then(() => {
      if (filas.get(chave) === cauda) filas.delete(chave);
    });
    return proxima;
  };
}

/** Uma fila por arquivo de destino: no Windows dois rename no mesmo alvo juntos dao EPERM. */
const naFilaDoArquivo = criarFilasPorChave();

/** Esperas entre as tentativas extras do rename (revisao final M8). */
const ESPERAS_DO_RENAME_MS = [50, 100, 200];
const ERROS_DE_TRAVA = new Set(["EPERM", "EBUSY", "EACCES"]);

export interface OpcoesDeGravacao {
  /** Injetavel nos testes; por padrao o rename do node:fs. */
  renomear?: (de: string, para: string) => Promise<void>;
  /** Esperas entre tentativas (ms); por padrao 50, 100 e 200. */
  esperasMs?: readonly number[];
}

/**
 * No Windows antivirus ou indexador seguram o alvo por instantes e o rename
 * falha com EPERM/EBUSY/EACCES: tenta de novo algumas vezes antes de desistir.
 */
async function renomearComTentativas(de: string, para: string, o: OpcoesDeGravacao): Promise<void> {
  const renomear = o.renomear ?? rename;
  const esperas = o.esperasMs ?? ESPERAS_DO_RENAME_MS;
  for (let i = 0; ; i++) {
    try {
      await renomear(de, para);
      return;
    } catch (e) {
      const trava = ERROS_DE_TRAVA.has((e as NodeJS.ErrnoException).code ?? "");
      if (!trava || i >= esperas.length) throw e;
      await new Promise((ok) => setTimeout(ok, esperas[i]));
    }
  }
}

export async function gravarAtomico(
  arquivo: string,
  conteudo: string | Uint8Array,
  opcoes: OpcoesDeGravacao = {}
): Promise<void> {
  return naFilaDoArquivo(resolve(arquivo), async () => {
    await mkdir(dirname(arquivo), { recursive: true });
    // tmp unico: duas gravacoes do mesmo arquivo nunca dividem o mesmo tmp
    // (mesmo motivo de server/room/persistence.ts).
    const tmp = `${arquivo}.${randomUUID()}.tmp`;
    try {
      await writeFile(tmp, conteudo);
      await renomearComTentativas(tmp, arquivo, opcoes);
    } catch (err) {
      await unlink(tmp).catch(() => undefined);
      throw err;
    }
  });
}

/** Apaga na mesma fila de gravarAtomico: apagar e subir a mesma foto nunca se misturam. Arquivo ausente nao e erro. */
export async function apagarArquivo(arquivo: string): Promise<void> {
  return naFilaDoArquivo(resolve(arquivo), async () => {
    await unlink(arquivo).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
  });
}

/** Grava e devolve a versao nova. */
export async function gravarPacote(
  raizPublic: string,
  id: string,
  d: { schema?: string; nome: string; players: PlayerVersion[] }
): Promise<string> {
  const arquivo = arquivoDoPacote(raizPublic, id);
  if (arquivo === null) throw new Error(`id de pacote invalido: ${id}`);
  const texto = textoDoPacote(d);
  await gravarAtomico(arquivo, texto);
  return versaoDe(texto);
}
