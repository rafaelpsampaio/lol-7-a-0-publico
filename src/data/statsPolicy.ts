import { z } from "zod";
export const StatsModeSchema = z.enum(["never", "overall", "overall_after", "full", "full_after"]);
export type StatsMode = z.infer<typeof StatsModeSchema>;
export const STATS_OPTIONS: { value: StatsMode; label: string }[] = [
  { value: "never", label: "Nunca ver" },
  { value: "overall", label: "Somente Overall" },
  { value: "overall_after", label: "Somente Overall · Depois do draft" },
  { value: "full", label: "Estatísticas completas" },
  { value: "full_after", label: "Estatísticas completas depois do draft" },
];
export function visibleStats(mode: StatsMode = "never", picked = false): "none" | "overall" | "full" {
  if (mode === "never" || (mode.endsWith("_after") && !picked)) return "none";
  return mode.startsWith("overall") ? "overall" : "full";
}
