/**
 * Helpers dos testes das traits novas (spec 2026-10-05-traits-no-motor): elencos planos com
 * traits por funcao e um gerador que conta as chamadas (para provar T-02, zero sorteios).
 */
import type { PlayerTrait, PlayerVersion, Role } from "../../data/schema";
import { ROLES, createInitialMatchState, type MatchState } from "../../sim/matchState";
import { mulberry32 } from "../../sim/rng";
import { makeFlatCard } from "../golden/fixtures";

export type TraitMap = Partial<Record<Role, PlayerTrait[]>>;

export function traitRoster(prefix: string, traits: TraitMap = {}, overall = 75): PlayerVersion[] {
  return ROLES.map((r) => ({
    ...makeFlatCard(r, overall),
    id: `${prefix}-${r}`,
    personId: `${prefix}-${r}`,
    displayName: `${prefix.toUpperCase()} ${r}`,
    traits: traits[r] ?? [],
  }));
}

export function traitState(user: TraitMap = {}, rival: TraitMap = {}): MatchState {
  return createInitialMatchState(traitRoster("u", user), traitRoster("r", rival));
}

export function countingRng(seed = 1): { rng: () => number; calls: () => number } {
  const base = mulberry32(seed);
  let n = 0;
  return {
    rng: () => {
      n += 1;
      return base();
    },
    calls: () => n,
  };
}
