/**
 * src/pacotes/rascunho.ts
 *
 * O estado do editor de pacotes como funcoes puras (E-05 da spec
 * 2026-10-05-editor-de-pacotes-design): toda mudanca devolve um rascunho novo,
 * e nada vai para o disco ate o Salvar (salvar.ts).
 */

import {
  MAX_PLAYER_TRAITS,
  type Mastery,
  type PlayerTrait,
  type PlayerVersion,
  type Role,
} from "../data/schema";
import { playerName } from "../data/playerPresentation";
import {
  ROTAS,
  caminhoDaFoto,
  nomeAposMudanca,
  nomeDaCarta,
  normalizarCarta,
  notaGeral,
  novoIdDeCarta,
  novoIdDePessoa,
  renomearNaCarta,
  validarPacote,
} from "./regrasDaCarta";

export interface FotoNova {
  tipo: "nova";
  dados: Blob;
  /** URL que a tela usa enquanto a foto nao foi salva (blob:). */
  previa: string;
  /** Ja subiu para o servidor (um Salvar anterior falhou depois dela). */
  enviada: boolean;
}
export interface FotoRemovida {
  tipo: "remover";
}
export type MudancaDeFoto = FotoNova | FotoRemovida;

export interface Rascunho {
  readonly id: string;
  readonly nomeOriginal: string;
  readonly nome: string;
  readonly versaoBase: string;
  readonly original: readonly PlayerVersion[];
  readonly cartas: readonly PlayerVersion[];
  /** personId -> mudanca de foto pendente. */
  readonly fotos: Readonly<Record<string, MudancaDeFoto>>;
}

export type FaseDaCarta = "lanePhase" | "midGame" | "lateGame";

export interface Pessoa {
  personId: string;
  nome: string;
  cartas: PlayerVersion[];
  melhorNota: number;
}

export function criarRascunho(p: { id: string; nome: string; versao: string; players: PlayerVersion[] }): Rascunho {
  return { id: p.id, nomeOriginal: p.nome, nome: p.nome, versaoBase: p.versao, original: p.players, cartas: p.players, fotos: {} };
}

function trocarCarta(r: Rascunho, id: string, f: (c: PlayerVersion) => PlayerVersion): Rascunho {
  return { ...r, cartas: r.cartas.map((c) => (c.id === id ? f(c) : c)) };
}

function trocarCartasDaPessoa(r: Rascunho, personId: string, f: (c: PlayerVersion) => PlayerVersion): Rascunho {
  return { ...r, cartas: r.cartas.map((c) => (c.personId === personId ? f(c) : c)) };
}

function semFoto(c: PlayerVersion): PlayerVersion {
  const { photo: _photo, ...resto } = c;
  return resto;
}

function semAno(c: PlayerVersion): PlayerVersion {
  const { year: _year, ...resto } = c;
  return resto;
}

function cartaNova(personId: string, nome: string, rota: Role, ids: ReadonlySet<string>, foto?: string): PlayerVersion {
  const c: PlayerVersion = normalizarCarta({
    id: novoIdDeCarta(personId, rota, undefined, ids),
    personId,
    displayName: nomeDaCarta(nome, rota),
    roles: [rota],
    primaryRole: rota,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0 },
    lanePhase: 70,
    midGame: 70,
    lateGame: 70,
    traits: [],
    championPool: [],
  });
  return foto === undefined ? c : { ...c, photo: foto };
}

export function renomearPacote(r: Rascunho, nome: string): Rascunho {
  return { ...r, nome };
}

export function adicionarPessoa(r: Rascunho, nome: string): { rascunho: Rascunho; personId: string; cartaId: string } {
  const personId = novoIdDePessoa(nome, new Set(r.cartas.map((c) => c.personId)));
  const c = cartaNova(personId, nome, "top", new Set(r.cartas.map((x) => x.id)));
  return { rascunho: { ...r, cartas: [...r.cartas, c] }, personId, cartaId: c.id };
}

export function adicionarCarta(r: Rascunho, personId: string): { rascunho: Rascunho; cartaId: string } {
  const daPessoa = r.cartas.filter((c) => c.personId === personId);
  const primeira = daPessoa[0];
  const nome = primeira === undefined ? personId : playerName(primeira);
  const rota = ROTAS.find((x) => !daPessoa.some((c) => c.primaryRole === x)) ?? "top";
  const c = cartaNova(personId, nome, rota, new Set(r.cartas.map((x) => x.id)), primeira?.photo);
  return { rascunho: { ...r, cartas: [...r.cartas, c] }, cartaId: c.id };
}

export function removerCarta(r: Rascunho, cartaId: string): Rascunho {
  return { ...r, cartas: r.cartas.filter((c) => c.id !== cartaId) };
}

export function renomearPessoa(r: Rascunho, personId: string, nome: string): Rascunho {
  return trocarCartasDaPessoa(r, personId, (c) => ({ ...c, displayName: renomearNaCarta(c, nome) }));
}

export function mudarRota(r: Rascunho, cartaId: string, rota: Role): Rascunho {
  return trocarCarta(r, cartaId, (c) =>
    normalizarCarta({ ...c, primaryRole: rota, roles: [rota], displayName: nomeAposMudanca(c, rota, c.year) })
  );
}

export function mudarAno(r: Rascunho, cartaId: string, ano: number | undefined): Rascunho {
  return trocarCarta(r, cartaId, (c) => {
    const nome = nomeAposMudanca(c, c.primaryRole, ano);
    return ano === undefined ? { ...semAno(c), displayName: nome } : { ...c, year: ano, displayName: nome };
  });
}

export function mudarFase(r: Rascunho, cartaId: string, fase: FaseDaCarta, valor: number): Rascunho {
  const v = Math.min(100, Math.max(1, Math.round(valor)));
  return trocarCarta(r, cartaId, (c) => normalizarCarta({ ...c, [fase]: v }));
}

export function alternarTrait(r: Rascunho, cartaId: string, trait: PlayerTrait): Rascunho {
  return trocarCarta(r, cartaId, (c) => {
    if (c.traits.includes(trait)) return { ...c, traits: c.traits.filter((t) => t !== trait) };
    if (c.traits.length >= MAX_PLAYER_TRAITS) return c;
    return { ...c, traits: [...c.traits, trait] };
  });
}

export function adicionarCampeao(r: Rascunho, cartaId: string, championId: string): Rascunho {
  return trocarCarta(r, cartaId, (c) =>
    c.championPool.some((x) => x.championId === championId)
      ? c
      : { ...c, championPool: [...c.championPool, { championId, mastery: 3 }] }
  );
}

export function removerCampeao(r: Rascunho, cartaId: string, championId: string): Rascunho {
  return trocarCarta(r, cartaId, (c) => ({ ...c, championPool: c.championPool.filter((x) => x.championId !== championId) }));
}

export function mudarConforto(r: Rascunho, cartaId: string, championId: string, mastery: Mastery): Rascunho {
  return trocarCarta(r, cartaId, (c) => ({
    ...c,
    championPool: c.championPool.map((x) => (x.championId === championId ? { ...x, mastery } : x)),
  }));
}

export function marcarFoto(r: Rascunho, personId: string, dados: Blob, previa: string): Rascunho {
  const comCaminho = trocarCartasDaPessoa(r, personId, (c) => ({ ...c, photo: caminhoDaFoto(personId) }));
  return { ...comCaminho, fotos: { ...r.fotos, [personId]: { tipo: "nova", dados, previa, enviada: false } } };
}

export function removerFoto(r: Rascunho, personId: string): Rascunho {
  const semCaminho = trocarCartasDaPessoa(r, personId, semFoto);
  const fotoOriginal = r.original.find((c) => c.personId === personId)?.photo;
  const entradaAtual = r.fotos[personId];
  const eNovaEnviada = entradaAtual?.tipo === "nova" && entradaAtual.enviada;

  // Secao 8: so registra remocao se a pessoa tinha foto original ou ja enviou a foto nova.
  // Sem foto original e entrada nao e nova enviada: descarta a entrada.
  if (fotoOriginal === undefined && !eNovaEnviada) {
    const novasFortos = { ...semCaminho.fotos };
    delete novasFortos[personId];
    return { ...semCaminho, fotos: novasFortos };
  }

  return { ...semCaminho, fotos: { ...r.fotos, [personId]: { tipo: "remover" } } };
}

export function marcarFotoEnviada(r: Rascunho, personId: string): Rascunho {
  const f = r.fotos[personId];
  if (f === undefined || f.tipo !== "nova") return r;
  return { ...r, fotos: { ...r.fotos, [personId]: { ...f, enviada: true } } };
}

/** JSON com as chaves em ordem alfabetica, em qualquer fundo (revisao final M4). */
function serializarOrdenado(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(serializarOrdenado).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const chaves = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${serializarOrdenado(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** Cartas novas, mudadas ou removidas, mais o nome e cada foto mexida. */
export function contarAlteracoes(r: Rascunho): number {
  // A ordem das chaves nao conta: apagar o ano e digitar de novo manda "year"
  // para o fim do objeto, e isso nao e alteracao.
  const assinatura = (c: PlayerVersion) => serializarOrdenado(semFoto(c));
  const antes = new Map(r.original.map((c) => [c.id, assinatura(c)]));
  const agora = new Set(r.cartas.map((c) => c.id));
  const pessoasComCartas = new Set(r.cartas.map((c) => c.personId));
  let n = 0;
  for (const c of r.cartas) if (antes.get(c.id) !== assinatura(c)) n++;
  for (const id of antes.keys()) if (!agora.has(id)) n++;
  if (r.nome.trim() !== r.nomeOriginal) n++;
  // Secao 8: conta apenas fotos de pessoas que ainda tem cartas.
  for (const personId of Object.keys(r.fotos)) if (pessoasComCartas.has(personId)) n++;
  return n;
}

export function pessoasDoRascunho(r: Rascunho): Pessoa[] {
  const porId = new Map<string, Pessoa>();
  for (const c of r.cartas) {
    const p = porId.get(c.personId);
    if (p === undefined) {
      porId.set(c.personId, { personId: c.personId, nome: playerName(c), cartas: [c], melhorNota: notaGeral(c) });
    } else {
      p.cartas.push(c);
      p.melhorNota = Math.max(p.melhorNota, notaGeral(c));
    }
  }
  return [...porId.values()];
}

export function errosPorCarta(r: Rascunho): Map<string, string[]> {
  return new Map(validarPacote(r.cartas).map((e) => [e.id, e.erros]));
}

export function fotoParaMostrar(r: Rascunho, personId: string): string | undefined {
  const f = r.fotos[personId];
  if (f?.tipo === "nova") return f.previa;
  return r.cartas.find((c) => c.personId === personId)?.photo;
}

export function paraSalvar(r: Rascunho): { nome: string; players: PlayerVersion[] } {
  return { nome: r.nome.trim(), players: [...r.cartas] };
}

export function fotosParaSubir(r: Rascunho): [string, Blob][] {
  const pessoasComCartas = new Set(r.cartas.map((c) => c.personId));
  return Object.entries(r.fotos).flatMap(([personId, f]) =>
    // Secao 8: so sube fotos de pessoas que ainda tem cartas.
    f.tipo === "nova" && !f.enviada && pessoasComCartas.has(personId) ? [[personId, f.dados] as [string, Blob]] : []
  );
}

/** Fotos removidas, mais as de quem saiu do pacote por inteiro. O servidor so apaga se ninguem mais usa. */
export function fotosParaApagar(r: Rascunho): string[] {
  const pessoasComCartas = new Set(r.cartas.map((c) => c.personId));
  const saida = new Set<string>();

  // Secao 8: (a) remocoes explícitas
  for (const [personId, f] of Object.entries(r.fotos)) {
    if (f.tipo === "remover") saida.add(personId);
  }

  // Secao 8: (b) pessoas com foto original que saíram por inteiro
  for (const c of r.original) {
    if (c.photo !== undefined && !pessoasComCartas.has(c.personId)) {
      saida.add(c.personId);
    }
  }

  // Secao 8: (c) fotos novas enviadas de pessoas que saíram
  for (const [personId, f] of Object.entries(r.fotos)) {
    if (f.tipo === "nova" && f.enviada && !pessoasComCartas.has(personId)) {
      saida.add(personId);
    }
  }

  return [...saida];
}
