/**
 * src/__tests__/helpers/makePlayer.ts
 *
 * Helper de fixture compartilhado entre os testes de draft e de sim, e tambem
 * pelas fixtures da rede golden (src/__tests__/golden/fixtures.ts).
 *
 * Mora aqui (e nao dentro de um arquivo *.test.ts) de proposito: a fixtures.ts
 * faz parte do grafo de build do tsc (nao casa com o exclude "*.test.ts").
 * Se ela importasse o helper de dentro de um arquivo de teste, o tsc puxaria
 * esse arquivo de teste inteiro para o build. Mantendo o helper neste modulo
 * neutro, o build nao arrasta nenhum *.test.ts.
 */

import type { PlayerVersion, Role } from "../../data/schema";

export const BASE_CHAMPION_POOL = [
  { championId: "aatrox", mastery: 4 as const },
  { championId: "camille", mastery: 3 as const },
  { championId: "garen", mastery: 2 as const },
  { championId: "darius", mastery: 5 as const },
  { championId: "fiora", mastery: 3 as const },
  { championId: "grasp", mastery: 1 as const },
  { championId: "malphite", mastery: 2 as const },
  { championId: "riven", mastery: 4 as const },
];

export function makePlayer(
  role: Role,
  overrides: Partial<PlayerVersion> = {}
): PlayerVersion {
  const personId = overrides.personId ?? `person-${role}`;
  return {
    id: overrides.id ?? `${personId}-2020`,
    personId,
    displayName: overrides.displayName ?? `Player ${role} 2020`,
    year: 2020,
    roles: [role],
    primaryRole: role,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: 80 },
    lanePhase: 75,
    midGame: 70,
    lateGame: 65,
    traits: [],
    championPool: BASE_CHAMPION_POOL,
    ...overrides,
  };
}
