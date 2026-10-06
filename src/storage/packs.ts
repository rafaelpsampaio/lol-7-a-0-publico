/**
 * src/storage/packs.ts
 *
 * Qual pacote o solo usa: uma preferencia deste navegador. Os pacotes em si
 * moram em arquivos e chegam pela API do servidor (E-01 da spec
 * 2026-10-05-editor-de-pacotes-design). Os pacotes que antes ficavam no
 * localStorage sao ignorados (E-02).
 */

import { createSignal, type Accessor, type Setter } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import { z } from "zod";

export const ACTIVE_PACK_STORAGE_KEY = "lolseteazero:active-pack";
/** Pacote dos Pros, que mora em public/players.json. */
export const PROS_PACK_ID = "pros";
export const PROS_PACK_NAME = "Pros / Mundial";

/** Ids guardados por versoes anteriores -> id do arquivo (A-09 chamava o Amigos de "amigos-embutido"). */
const IDS_ANTIGOS: Record<string, string> = { "amigos-embutido": "amigos" };

export function normalizarIdDoPacote(raw: unknown): string {
  const r = z.string().min(1).safeParse(raw);
  if (!r.success) return PROS_PACK_ID;
  return IDS_ANTIGOS[r.data] ?? r.data;
}

function resolveStorage(): Storage {
  if (typeof localStorage !== "undefined") return localStorage;
  const mem = new Map<string, string>();
  return {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    key: (i: number) => Array.from(mem.keys())[i] ?? null,
    removeItem: (k: string) => mem.delete(k),
    setItem: (k: string, v: string) => void mem.set(k, v),
  } as Storage;
}

const [activePackId, setActivePackId] = makePersisted(createSignal<string>(PROS_PACK_ID), {
  name: ACTIVE_PACK_STORAGE_KEY,
  storage: resolveStorage(),
  serialize: (value: string) => JSON.stringify(value),
  deserialize: (raw: string) => {
    try {
      return normalizarIdDoPacote(JSON.parse(raw));
    } catch {
      return PROS_PACK_ID;
    }
  },
});

/** Pacote ativo do solo (padrao: os Pros). */
export const activePackIdSignal: Accessor<string> = activePackId;
export const setActivePackIdSignal: Setter<string> = setActivePackId;
