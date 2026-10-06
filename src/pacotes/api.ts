/**
 * src/pacotes/api.ts
 *
 * Chamadas as rotas do editor de pacotes (secao 6 da spec
 * 2026-10-05-editor-de-pacotes-design). Todo erro vira FalhaDaApi, para a tela
 * decidir o que mostrar (secao 8).
 */

import { PlayerDatabaseSchema, type PlayerVersion } from "../data/schema";
import type { ErrosDaCarta } from "./regrasDaCarta";
import { tokenDoDono } from "./dono";

export interface ResumoDoPacote {
  id: string;
  nome: string;
  cartas: number;
  pessoas: number;
  versao: string;
  /** Arquivo quebrado (revisao final M2): vem com nome = id, erro e contagens zeradas (cartas 0, pessoas 0, versao vazia). */
  invalido?: boolean;
  erro?: string;
}

export interface PacoteCompleto {
  id: string;
  nome: string;
  players: PlayerVersion[];
  versao: string;
}

export type DetalheDaFalha =
  | { tipo: "rede" }
  | { tipo: "http"; status: number; erro: string; cartas?: ErrosDaCarta[] };

export class FalhaDaApi extends Error {
  readonly detalhe: DetalheDaFalha;
  constructor(detalhe: DetalheDaFalha) {
    super(detalhe.tipo === "rede" ? "Sem conexão com o servidor." : `${detalhe.status}: ${detalhe.erro}`);
    this.detalhe = detalhe;
  }
}

export interface ApiDePacotes {
  listar(): Promise<ResumoDoPacote[]>;
  carregar(id: string): Promise<PacoteCompleto>;
  salvar(
    id: string,
    corpo: { nome: string; players: PlayerVersion[]; versaoBase: string; forcar?: boolean }
  ): Promise<{ versao: string }>;
  criar(corpo: { nome: string; players: PlayerVersion[] }): Promise<{ id: string; versao: string }>;
  excluir(id: string): Promise<void>;
  subirFoto(personId: string, dados: Blob): Promise<void>;
  apagarFoto(personId: string): Promise<void>;
  souDono(): Promise<boolean>;
}

export function criarApi(
  fazer: typeof fetch = (url, init) => fetch(url, init),
  token: () => string | null = () => tokenDoDono()
): ApiDePacotes {
  async function pedir(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    const t = token();
    if (t !== null) headers.set("x-dono", t);
    let res: Response;
    try {
      res = await fazer(url, { ...init, headers });
    } catch {
      throw new FalhaDaApi({ tipo: "rede" });
    }
    if (!res.ok) {
      let corpo: { erro?: unknown; cartas?: unknown } = {};
      try {
        corpo = (await res.json()) as typeof corpo;
      } catch {
        // corpo vazio ou nao-JSON
      }
      throw new FalhaDaApi({
        tipo: "http",
        status: res.status,
        erro: typeof corpo.erro === "string" ? corpo.erro : res.statusText || `HTTP ${res.status}`,
        cartas: Array.isArray(corpo.cartas) ? (corpo.cartas as ErrosDaCarta[]) : undefined,
      });
    }
    return res;
  }

  const comJson = (metodo: string, corpo: unknown): RequestInit => ({
    method: metodo,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const caminho = (id: string) => `/api/pacotes/${encodeURIComponent(id)}`;

  return {
    async listar() {
      return (await (await pedir("/api/pacotes")).json()) as ResumoDoPacote[];
    },
    async carregar(id) {
      const bruto = (await (await pedir(caminho(id))).json()) as { id: string; nome: string; versao: string; players: unknown };
      const db = PlayerDatabaseSchema.safeParse({ players: bruto.players });
      if (!db.success) throw new FalhaDaApi({ tipo: "http", status: 500, erro: `o pacote ${id} no disco está inválido` });
      return { id: bruto.id, nome: bruto.nome, versao: bruto.versao, players: db.data.players };
    },
    async salvar(id, corpo) {
      const res = await pedir(caminho(id), comJson("PUT", { ...corpo, forcar: corpo.forcar === true }));
      return (await res.json()) as { versao: string };
    },
    async criar(corpo) {
      return (await (await pedir("/api/pacotes", comJson("POST", corpo))).json()) as { id: string; versao: string };
    },
    async excluir(id) {
      await pedir(caminho(id), { method: "DELETE" });
    },
    async subirFoto(personId, dados) {
      await pedir(`/api/fotos/${encodeURIComponent(personId)}`, {
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
        body: dados,
      });
    },
    async apagarFoto(personId) {
      await pedir(`/api/fotos/${encodeURIComponent(personId)}`, { method: "DELETE" });
    },
    async souDono() {
      try {
        const corpo = (await (await pedir("/api/dono")).json()) as { dono?: unknown };
        return corpo.dono === true;
      } catch {
        return false;
      }
    },
  };
}
