/**
 * src/pacotes/regrasDaCarta.ts
 *
 * Regras de toda carta salva por um pacote (secao 4 da spec
 * 2026-10-05-editor-de-pacotes-design). Modulo puro, sem Solid e sem node:,
 * usado pelo editor e pelo servidor (via server/engine/pacotes.ts, D-04).
 */

import {
  PlayerDatabaseSchema,
  PlayerVersionSchema,
  RoleSchema,
  MAX_PLAYER_TRAITS,
  type PlayerVersion,
  type Role,
} from "../data/schema";
import { playerName, playerOverall } from "../data/playerPresentation";
import { slug } from "../data/slug";

export const ROTAS: Role[] = RoleSchema.options;
export const POOL_MINIMO = 8;
/** Ids de pacote e de pessoa: viram nome de arquivo, entao so isto passa. */
export const ID_VALIDO = /^[a-z0-9-]{1,60}$/;
export const TAMANHO_MAXIMO_DA_FOTO = 1024 * 1024;

/** Palavra da rota no displayName, no padrao dos Amigos ("Rafa Top 2018"). */
const PALAVRA_DA_ROTA: Record<Role, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "Adc",
  support: "Sup",
};

export type Fases = Pick<PlayerVersion, "lanePhase" | "midGame" | "lateGame">;

/** E-07: a nota geral e a forca da carta na rota. */
export function notaGeral(c: Fases): number {
  return playerOverall(c);
}

/** E-08: a foto e da pessoa e mora em public/players/<personId>.jpg. */
export function caminhoDaFoto(personId: string): string {
  return `/players/${personId}.jpg`;
}

/** E-06 e E-07: uma rota so, forca = nota geral, as outras rotas em 0. */
export function normalizarCarta(c: PlayerVersion): PlayerVersion {
  const forca = { top: 0, jungle: 0, mid: 0, adc: 0, support: 0 };
  forca[c.primaryRole] = notaGeral(c);
  return { ...c, roles: [c.primaryRole], roleStrength: forca };
}

export function nomeDaCarta(nome: string, rota: Role, ano?: number): string {
  return [nome.trim(), PALAVRA_DA_ROTA[rota], ano === undefined ? "" : String(ano)]
    .filter((parte) => parte !== "")
    .join(" ");
}

/** A carta segue o padrao "<Nome> <Rota> [<Ano>]"? */
export function seguePadrao(c: Pick<PlayerVersion, "displayName" | "primaryRole" | "year">): boolean {
  return c.displayName.trim() === nomeDaCarta(playerName(c), c.primaryRole, c.year);
}

/** E-09: troca so o nome da pessoa, mantendo o resto ("Faker 2016" vira "Lee 2016"). */
export function renomearNaCarta(c: PlayerVersion, nomeNovo: string): string {
  if (seguePadrao(c)) return nomeDaCarta(nomeNovo, c.primaryRole, c.year);
  const atual = playerName(c);
  const nome = c.displayName.trim();
  return nome.startsWith(atual) ? nomeNovo.trim() + nome.slice(atual.length) : nomeNovo.trim();
}

/** displayName depois de mudar rota ou ano (secao 4). */
export function nomeAposMudanca(c: PlayerVersion, rota: Role, ano: number | undefined): string {
  if (seguePadrao(c)) return nomeDaCarta(playerName(c), rota, ano);
  const nome = c.displayName.trim();
  if (c.year !== undefined && ano !== c.year && nome.endsWith(` ${c.year}`)) {
    const semAno = nome.slice(0, -` ${c.year}`.length);
    return ano === undefined ? semAno : `${semAno} ${ano}`;
  }
  return c.displayName;
}

function comSufixo(base: string, existentes: ReadonlySet<string>): string {
  if (!existentes.has(base)) return base;
  let n = 2;
  while (existentes.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function novoIdDePessoa(nome: string, existentes: ReadonlySet<string>): string {
  return comSufixo(slug(nome).slice(0, 50) || "pessoa", existentes);
}

export function novoIdDeCarta(
  personId: string,
  rota: Role,
  ano: number | undefined,
  existentes: ReadonlySet<string>
): string {
  return comSufixo(ano === undefined ? `${personId}-${rota}` : `${personId}-${rota}-${ano}`, existentes);
}

export function novoIdDePacote(nome: string, existentes: ReadonlySet<string>): string {
  return comSufixo(slug(nome).slice(0, 50) || "pacote", existentes);
}

const FASES = ["lanePhase", "midGame", "lateGame"] as const;

export function validarCarta(c: PlayerVersion): string[] {
  const erros: string[] = [];
  if (c.displayName.trim() === "") erros.push("A carta precisa de um nome.");
  if (c.championPool.length < POOL_MINIMO) {
    erros.push(`Escolha pelo menos ${POOL_MINIMO} campeões (faltam ${POOL_MINIMO - c.championPool.length}).`);
  }
  if (c.traits.length > MAX_PLAYER_TRAITS) erros.push(`No máximo ${MAX_PLAYER_TRAITS} traits.`);
  if (c.year !== undefined && (!Number.isInteger(c.year) || c.year < 2011 || c.year > 2035)) {
    erros.push("O ano precisa estar entre 2011 e 2035.");
  }
  if (FASES.some((f) => !Number.isInteger(c[f]) || c[f] < 1 || c[f] > 100)) erros.push("As fases vão de 1 a 100.");
  if (!ID_VALIDO.test(c.personId)) erros.push("Id da pessoa inválido (use letras minúsculas, números e hífen).");
  if (c.roles.length !== 1 || c.roles[0] !== c.primaryRole) erros.push("A carta precisa ter exatamente uma rota.");
  const nota = notaGeral(c);
  if (!ROTAS.every((r) => c.roleStrength[r] === (r === c.primaryRole ? nota : 0))) {
    erros.push(`A força na rota precisa ser a nota geral (${nota}).`);
  }
  if (c.photo !== undefined && c.photo !== caminhoDaFoto(c.personId)) {
    erros.push(`A foto precisa ser ${caminhoDaFoto(c.personId)}.`);
  }
  if (erros.length === 0) {
    const r = PlayerVersionSchema.safeParse(c);
    if (!r.success) erros.push(...r.error.issues.map((i) => `${i.path.map(String).join(".") || "carta"}: ${i.message}`));
  }
  return erros;
}

export interface ErrosDaCarta {
  id: string;
  erros: string[];
}

export function validarPacote(cartas: readonly PlayerVersion[]): ErrosDaCarta[] {
  const vezes = new Map<string, number>();
  for (const c of cartas) vezes.set(c.id, (vezes.get(c.id) ?? 0) + 1);
  const saida: ErrosDaCarta[] = [];
  for (const c of cartas) {
    const erros = validarCarta(c);
    if ((vezes.get(c.id) ?? 0) > 1) erros.push(`Id repetido no pacote: ${c.id}.`);
    if (erros.length > 0) saida.push({ id: c.id, erros });
  }
  return saida;
}

export type ResultadoDoPacote =
  | { ok: true; players: PlayerVersion[] }
  | { ok: false; erro: string; cartas: ErrosDaCarta[] };

/** O que o servidor aceita gravar: schema do jogo mais as regras do editor. */
export function conferirPacote(raw: unknown): ResultadoDoPacote {
  const parsed = PlayerDatabaseSchema.safeParse(raw);
  if (!parsed.success) {
    const lista = (raw as { players?: unknown } | null)?.players;
    const porCarta = new Map<string, string[]>();
    const geral: string[] = [];
    for (const issue of parsed.error.issues) {
      const [raiz, indice, ...resto] = issue.path;
      if (raiz === "players" && typeof indice === "number") {
        const bruta = Array.isArray(lista) ? (lista[indice] as { id?: unknown } | undefined) : undefined;
        const id = typeof bruta?.id === "string" ? bruta.id : `#${indice + 1}`;
        porCarta.set(id, [...(porCarta.get(id) ?? []), `${resto.map(String).join(".") || "carta"}: ${issue.message}`]);
      } else {
        geral.push(`${issue.path.map(String).join(".") || "pacote"}: ${issue.message}`);
      }
    }
    return {
      ok: false,
      erro: geral.length > 0 ? `O pacote não passou na validação (${geral.join("; ")}).` : "O pacote não passou na validação.",
      cartas: [...porCarta].map(([id, erros]) => ({ id, erros })),
    };
  }
  const cartas = validarPacote(parsed.data.players);
  if (cartas.length > 0) return { ok: false, erro: "Há cartas fora das regras do editor.", cartas };
  return { ok: true, players: parsed.data.players };
}

/** E-08: o servidor so grava foto que comeca como JPEG (FF D8 FF). */
export function ehJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
