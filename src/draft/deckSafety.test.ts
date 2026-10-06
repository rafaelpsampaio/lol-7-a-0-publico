import { describe, it, expect } from "vitest";
import { deckSafety, deckShortfalls } from "./deckSafety";
import type { PlayerVersion, Role } from "../data/schema";
import { makePlayer } from "../__tests__/helpers/makePlayer";

const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];
const card = (id: string, personId: string, role: Role): PlayerVersion =>
  makePlayer(role, { id, personId });

/** n pessoas de uma rota so, em cada rota (o formato da base dos pros). */
function baseSimples(n: number): PlayerVersion[] {
  return ROLES.flatMap((r) => Array.from({ length: n }, (_, i) => card(`${r}-${i}`, `${r}-${i}`, r)));
}

/** O caso do ADC da planilha antes do Valdir: 13 cartas, 6 bloqueaveis. */
function casoAdc(): PlayerVersion[] {
  const outras = baseSimples(8).filter((p) => p.primaryRole !== "adc");
  return [
    ...outras,
    card("igor-mid", "igor", "mid"),
    card("igao-jg", "igao", "jungle"),
    card("rafa-top", "rafa", "top"),
    card("adabo-sup", "adabo", "support"),
    card("igor-adc-1", "igor", "adc"),
    card("igor-adc-2", "igor", "adc"),
    card("igao-adc-1", "igao", "adc"),
    card("igao-adc-2", "igao", "adc"),
    card("rafa-adc", "rafa", "adc"),
    card("adabo-adc", "adabo", "adc"),
    ...Array.from({ length: 7 }, (_, i) => card(`adc-${i}`, `adc-${i}`, "adc")),
  ];
}

describe("deckSafety", () => {
  it("base dos pros (8 pessoas de uma rota so por rota) esta pronta com folga 8", () => {
    const s = deckSafety(baseSimples(8));
    expect(s.ready).toBe(true);
    expect(s.needed).toBe(8);
    for (const r of ROLES) expect(s.spareByRole[r]).toBe(8);
  });

  it("duas versoes da mesma pessoa contam como duas cartas (A-01)", () => {
    const players = [
      ...baseSimples(7),
      ...ROLES.map((r) => card(`${r}-0-v2`, `${r}-0`, r)),
    ];
    expect(deckSafety(players).ready).toBe(true);
  });

  it("recusa o caso do ADC: 13 cartas, 6 de pessoas que jogam outras rotas", () => {
    const s = deckSafety(casoAdc());
    expect(s.spareByRole.adc).toBe(7);
    expect(s.ready).toBe(false);
    expect(deckShortfalls(s)).toEqual(["adc (falta 1 carta de quem só joga adc)"]);
  });

  it("uma carta de quem so joga adc resolve", () => {
    const s = deckSafety([...casoAdc(), card("novo-adc", "novo", "adc")]);
    expect(s.spareByRole.adc).toBe(8);
    expect(s.ready).toBe(true);
  });

  it("outra versao de quem ja joga adc nao resolve", () => {
    const s = deckSafety([...casoAdc(), card("rafa-adc-2", "rafa", "adc")]);
    expect(s.spareByRole.adc).toBe(7);
    expect(s.ready).toBe(false);
  });

  it("pacote antigo com 1 carta por rota lista as 5 rotas", () => {
    const s = deckSafety(baseSimples(1));
    expect(s.ready).toBe(false);
    expect(deckShortfalls(s)).toEqual(
      ROLES.map((r) => `${r} (faltam 7 cartas de quem só joga ${r})`)
    );
  });

  it("base vazia nao explode", () => {
    const s = deckSafety([]);
    expect(s.ready).toBe(false);
    for (const r of ROLES) expect(s.spareByRole[r]).toBe(0);
  });

  it("aceita um numero menor de times", () => {
    expect(deckSafety(baseSimples(4), 4).ready).toBe(true);
  });

  it("base pronta nao tem faltas", () => {
    expect(deckShortfalls(deckSafety(baseSimples(8)))).toEqual([]);
  });
});

describe("deckSafety: base grande com pessoas em varias rotas", () => {
  /** Conta de referencia, sem poda: todas as pessoas de cada rota entram. */
  function folgaDeReferencia(players: PlayerVersion[], role: Role): number {
    const porPessoa = (r: Role) => {
      const m = new Map<string, number>();
      for (const p of players) if (p.primaryRole === r) m.set(p.personId, (m.get(p.personId) ?? 0) + 1);
      return m;
    };
    const naRota = porPessoa(role);
    const outras = ROLES.filter((r) => r !== role).map((r) => [...porPessoa(r).keys()]);
    let melhor = 0;
    const usadas = new Set<string>();
    const anda = (i: number, soma: number): void => {
      if (i === outras.length) {
        melhor = Math.max(melhor, soma);
        return;
      }
      anda(i + 1, soma);
      for (const pessoa of outras[i]!) {
        if (usadas.has(pessoa)) continue;
        usadas.add(pessoa);
        anda(i + 1, soma + (naRota.get(pessoa) ?? 0));
        usadas.delete(pessoa);
      }
    };
    anda(0, 0);
    let total = 0;
    for (const n of naRota.values()) total += n;
    return total - melhor;
  }

  it("60 pessoas com carta nas 5 rotas (300 cartas) respondem rapido", () => {
    const players = Array.from({ length: 60 }, (_, i) =>
      ROLES.map((r) => card(`p${i}-${r}`, `p${i}`, r))
    ).flat();
    const inicio = performance.now();
    const s = deckSafety(players);
    expect(performance.now() - inicio).toBeLessThan(500);
    // 60 cartas por rota; o pior time tira do alcance 4 delas (uma de cada pessoa)
    for (const r of ROLES) expect(s.spareByRole[r]).toBe(56);
  });

  it("da a mesma folga da conta sem poda em bases sorteadas", () => {
    let semente = 7;
    const sorteio = (n: number) => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente % n;
    };
    for (let rodada = 0; rodada < 200; rodada++) {
      const pessoas = 3 + sorteio(8);
      const players: PlayerVersion[] = [];
      const cartas = 5 + sorteio(25);
      for (let c = 0; c < cartas; c++) {
        const r = ROLES[sorteio(5)]!;
        players.push(card(`c${rodada}-${c}`, `p${sorteio(pessoas)}`, r));
      }
      const s = deckSafety(players);
      for (const r of ROLES) expect(s.spareByRole[r], `rodada ${rodada} ${r}`).toBe(folgaDeReferencia(players, r));
    }
  });
});
