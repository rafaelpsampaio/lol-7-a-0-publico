import type { PlayerVersion } from "./schema";
import { TRAIT_INFO } from "./traitInfo";
export function playerName(p: Pick<PlayerVersion, "displayName" | "year">): string {
  let name = p.displayName.trim();
  name = name.replace(/\s+(?:19|20)\d{2}$/, "").trim();
  name = name.replace(/\s+(top|topo|jungle|jungler|jgl|jg|caçador|mid|meio|adc|atirador|support|sup|suporte)$/i, "").trim();
  return name || p.displayName;
}
export function playerOverall(p: Pick<PlayerVersion, "lanePhase" | "midGame" | "lateGame">): number {
  return Math.round((p.lanePhase + p.midGame + p.lateGame) / 3);
}
export function playerTags(p: PlayerVersion): { label: string; description: string }[] {
  const traits = p.traits.map(t => TRAIT_INFO[t]);
  const custom = [...(p.tags ?? []), ...(p.advanced?.tags ?? [])].map(label => ({ label, description: p.shortDescription ?? p.advanced?.notes ?? "" }));
  return [...new Map([...traits, ...custom].map(t => [t.label, t])).values()];
}
