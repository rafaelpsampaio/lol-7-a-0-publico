import type { PlayerVersion } from "../data/schema";
import { mulberry32, seedFromString } from "./rng";

/** A fresh performance draw per game. Separate streams preserve replay and side symmetry.
 * Base cards are never mutated. Form changes performance, never selects a winner.
 * At default chaos, shared team form is within 18 points and individual form within 4.
 */
export function gameForm(roster: PlayerVersion[], seed: number, chaos: number): PlayerVersion[] {
  const level = Math.max(0, Math.min(1, chaos));
  const identity = roster.map(p => p.id).sort().join("|");
  const rng = mulberry32(seedFromString(seed + ":form:" + identity));
  const shared = (rng() * 2 - 1) * (12 + 24 * level);
  return roster.map(card => {
    const individual = mulberry32(seedFromString(seed + ":player-form:" + card.id));
    const volatility = card.advanced?.volatility ?? 0.5;
    const delta = shared + (individual() * 2 - 1) * (2 + 4 * volatility);
    const rating = (value: number) => Math.max(1, Math.min(100, Math.round(value + delta)));
    return { ...card, lanePhase: rating(card.lanePhase), midGame: rating(card.midGame), lateGame: rating(card.lateGame) };
  });
}
