/**
 * server/engine/botPick.ts
 *
 * Copia deliberada da regra de escolha do BotTeamBuilder (D-12): peso =
 * roleStrength[primaryRole] + 1. O weightedPick do jogo e um helper de modulo,
 * nao exportado, e pedir a exportacao seria mexer no arquivo do outro builder.
 *
 * botPick.test.ts compara as duas implementacoes carta a carta em 200 sementes:
 * se a regra mudar no jogo, o npm test acusa aqui.
 */

import { ALL_ROLES, type PlayerVersion, type Role } from "./schema";

/** Escolha ponderada dentro de um conjunto de cartas. Espelha o jogo linha a linha. */
export function weightedPick(pool: PlayerVersion[], rng: () => number): PlayerVersion {
  const weights = pool.map((p) => p.roleStrength[p.primaryRole] + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;

  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return pool[i]!;
  }

  // Guarda de arredondamento de ponto flutuante — devolve o ultimo.
  return pool[pool.length - 1]!;
}

/**
 * Escolhe uma carta da mao de um assento. Percorre ALL_ROLES em vez das chaves
 * do objeto para que o resultado nao dependa da ordem de insercao.
 * Devolve null com a mao vazia — quem chama decide o que fazer.
 */
export function botPick(
  hand: Partial<Record<Role, PlayerVersion>>,
  rng: () => number
): { role: Role; card: PlayerVersion } | null {
  const entradas: [Role, PlayerVersion][] = [];
  for (const role of ALL_ROLES) {
    const card = hand[role];
    if (card !== undefined) entradas.push([role, card]);
  }
  if (entradas.length === 0) return null;

  const escolhida = weightedPick(
    entradas.map(([, card]) => card),
    rng
  );
  const achada = entradas.find(([, card]) => card.id === escolhida.id);
  return achada === undefined ? null : { role: achada[0], card: achada[1] };
}
