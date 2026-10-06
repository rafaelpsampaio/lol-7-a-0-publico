/**
 * server/room/cards.fixture.ts
 *
 * Cartas sinteticas para os testes do servidor. Um draft de 8 times precisa de
 * 8 cartas de folga por rota (A-02); a base sintetica tem pessoas de uma rota
 * so, entao 8 por rota bastam.
 */

import { ALL_ROLES, type PlayerVersion, type Role } from "../engine/schema";

export interface CardOverrides {
  id: string;
  personId: string;
  primaryRole: Role;
  displayName?: string;
  forca?: number;
  roles?: Role[];
}

const CAMPEOES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function makeCard(over: CardOverrides): PlayerVersion {
  const forca = over.forca ?? 50;
  return {
    id: over.id,
    personId: over.personId,
    displayName: over.displayName ?? over.id,
    year: 2020,
    roles: over.roles ?? [over.primaryRole],
    primaryRole: over.primaryRole,
    roleStrength: {
      top: over.primaryRole === "top" ? forca : 0,
      jungle: over.primaryRole === "jungle" ? forca : 0,
      mid: over.primaryRole === "mid" ? forca : 0,
      adc: over.primaryRole === "adc" ? forca : 0,
      support: over.primaryRole === "support" ? forca : 0,
    },
    lanePhase: 50,
    midGame: 50,
    lateGame: 50,
    traits: [],
    championPool: CAMPEOES.map((c) => ({ championId: c, mastery: 3 as const })),
  };
}

/** Base com `pessoasPorRota` pessoas distintas em cada uma das 5 rotas. */
export function makeBase(pessoasPorRota = 8): PlayerVersion[] {
  const cartas: PlayerVersion[] = [];
  for (const role of ALL_ROLES) {
    for (let i = 0; i < pessoasPorRota; i++) {
      cartas.push(
        makeCard({
          id: `${role}-${i}`,
          personId: `p-${role}-${i}`,
          primaryRole: role,
          displayName: `${role.toUpperCase()} ${i}`,
          forca: 20 + i * 5,
        })
      );
    }
  }
  return cartas;
}
