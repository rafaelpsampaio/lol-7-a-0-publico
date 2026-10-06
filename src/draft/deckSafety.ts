/**
 * src/draft/deckSafety.ts
 *
 * Garantia do baralho (A-02 da spec 2026-10-02-pack-amigos-design). Com a regra
 * "carta unica no torneio, pessoa unica so dentro do time" (A-01), um time trava
 * quando todas as cartas que sobraram numa rota sao de pessoas que ele ja tem.
 *
 * Para cada rota r: folga(r) = cartas(r) - bloqueaveis(r), onde bloqueaveis(r) e
 * o maximo de cartas de r que as 4 pessoas de um time nas outras 4 rotas tiram do
 * alcance dele. Os outros times levam no maximo (teams - 1) cartas de r; com
 * folga >= teams em toda rota, nenhuma sequencia de escolhas deixa um time sem
 * rota. Pura: usada pela sala (via server/engine/schema.ts) e pelo solo.
 */

import type { PlayerVersion, Role } from "../data/schema";

const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

export interface DeckSafety {
  /** true quando toda rota tem folga >= needed */
  ready: boolean;
  /** quantos times a base precisa garantir */
  needed: number;
  /** cartas de cada rota fora do alcance do pior time possivel */
  spareByRole: Record<Role, number>;
}

/** Cartas por pessoa em cada rota (pela primaryRole, como o draft). */
function cardsByRoleAndPerson(players: PlayerVersion[]): Record<Role, Map<string, number>> {
  const out: Record<Role, Map<string, number>> = {
    top: new Map(),
    jungle: new Map(),
    mid: new Map(),
    adc: new Map(),
    support: new Map(),
  };
  for (const p of players) {
    const m = out[p.primaryRole];
    m.set(p.personId, (m.get(p.personId) ?? 0) + 1);
  }
  return out;
}

/**
 * Maximo de cartas de `role` que um time tira do proprio alcance com as pessoas
 * que escolheu nas outras 4 rotas (uma por rota, todas diferentes). Forca bruta:
 * so entram pessoas com carta na outra rota E em `role`.
 *
 * Poda exata: em cada outra rota bastam as 4 pessoas com mais cartas em `role`.
 * As outras 3 rotas usam no maximo 3 pessoas, entao sempre sobra uma das 4 livre
 * e com pelo menos tantas cartas quanto qualquer pessoa de fora. Sem a poda, uma
 * base com dezenas de pessoas em todas as rotas levava segundos por chamada.
 */
const SLOTS_PER_ROLE = 4;

function blockable(role: Role, cards: Record<Role, Map<string, number>>): number {
  const inRole = cards[role];
  const others = ROLES.filter((r) => r !== role);
  const candidates = others.map((o) =>
    [...cards[o].keys()]
      .filter((p) => inRole.has(p))
      .sort((a, b) => inRole.get(b)! - inRole.get(a)!)
      .slice(0, SLOTS_PER_ROLE)
  );

  let best = 0;
  const used = new Set<string>();
  const walk = (i: number, sum: number): void => {
    if (i === candidates.length) {
      if (sum > best) best = sum;
      return;
    }
    // a rota i pode ser ocupada por alguem sem carta em `role`
    walk(i + 1, sum);
    for (const person of candidates[i]!) {
      if (used.has(person)) continue;
      used.add(person);
      walk(i + 1, sum + inRole.get(person)!);
      used.delete(person);
    }
  };
  walk(0, 0);
  return best;
}

export function deckSafety(players: PlayerVersion[], teams = 8): DeckSafety {
  const cards = cardsByRoleAndPerson(players);
  const spareByRole = {} as Record<Role, number>;
  for (const role of ROLES) {
    let total = 0;
    for (const n of cards[role].values()) total += n;
    spareByRole[role] = total - blockable(role, cards);
  }
  return {
    ready: ROLES.every((r) => spareByRole[r] >= teams),
    needed: teams,
    spareByRole,
  };
}

/**
 * Uma frase por rota curta, pronta para o lobby e para o menu do solo. Carta de
 * quem so joga aquela rota sempre aumenta a folga em 1; outra versao de quem ja
 * joga a rota pode nao aumentar, por isso a frase pede "de quem so joga".
 */
export function deckShortfalls(s: DeckSafety): string[] {
  return ROLES.filter((r) => s.spareByRole[r] < s.needed).map((r) => {
    const n = s.needed - s.spareByRole[r];
    return n === 1
      ? `${r} (falta 1 carta de quem só joga ${r})`
      : `${r} (faltam ${n} cartas de quem só joga ${r})`;
  });
}
