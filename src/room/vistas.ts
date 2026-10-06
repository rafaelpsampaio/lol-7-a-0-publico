/**
 * src/room/vistas.ts
 *
 * As series que esta pessoa ja viu ate o jogo decisivo, por torneio (D1).
 * Vive no navegador de cada um (localStorage) e nunca vai para o servidor:
 * o servidor sabe o resultado desde a onda, quem precisa esquecer e a tela.
 *
 * Por torneio (TournamentWire.id) de proposito: a Revanche usa os mesmos 14
 * slots, e herdar "ja vi a Grande Final" da noite anterior revelaria o
 * campeao novo no primeiro segundo.
 */

import { createSignal } from "solid-js";
import type { SlotId } from "../net/store";

const PREFIXO = "lolseteazero:sala:vistas:";

function armazenamento(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function ler(id: string): SlotId[] {
  try {
    const raw = armazenamento()?.getItem(PREFIXO + id);
    const lista = raw === null || raw === undefined ? [] : (JSON.parse(raw) as unknown);
    return Array.isArray(lista) ? lista.filter((x): x is SlotId => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function gravar(id: string, slots: SlotId[]): void {
  try {
    armazenamento()?.setItem(PREFIXO + id, JSON.stringify(slots));
  } catch {
    // sem memoria neste navegador: ao recarregar, a rodada atual volta escondida
  }
}

const [porTorneio, setPorTorneio] = createSignal<Record<string, SlotId[]>>({});
/** Leitura do disco por torneio, uma vez so por aba (nao reativa). */
const doDisco = new Map<string, SlotId[]>();

function lidoDoDisco(id: string): SlotId[] {
  let lista = doDisco.get(id);
  if (lista === undefined) {
    lista = ler(id);
    doDisco.set(id, lista);
  }
  return lista;
}

/** Series vistas neste torneio (reativo a marcarVistas). */
export function vistasDe(id: string | null | undefined): ReadonlySet<SlotId> {
  if (id === null || id === undefined) return new Set();
  return new Set(porTorneio()[id] ?? lidoDoDisco(id));
}

/** Marca series como vistas (vale tambem para "Mostrar resultados desta rodada"). */
export function marcarVistas(id: string | null | undefined, slots: SlotId[]): void {
  if (id === null || id === undefined || slots.length === 0) return;
  const atual = porTorneio()[id] ?? lidoDoDisco(id);
  const novas = slots.filter((s) => !atual.includes(s));
  if (novas.length === 0) return;
  const proximo = [...atual, ...novas];
  gravar(id, proximo);
  setPorTorneio((m) => ({ ...m, [id]: proximo }));
}

/** So para os testes: esquece tudo que esta em memoria. */
export function esquecerVistasEmMemoria(): void {
  setPorTorneio({});
  doDisco.clear();
}
