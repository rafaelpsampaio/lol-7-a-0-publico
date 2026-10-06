import { createSignal } from "solid-js";
import { StatsModeSchema, type StatsMode } from "../data/statsPolicy";
function initial(): StatsMode {
  try { return StatsModeSchema.parse(localStorage.getItem("lolseteazero:stats-mode")); } catch { return "never"; }
}
export const [statsMode, updateStatsMode] = createSignal<StatsMode>(initial());
export function setStatsMode(mode: StatsMode) {
  updateStatsMode(mode);
  try { localStorage.setItem("lolseteazero:stats-mode", mode); } catch { /* storage unavailable */ }
}
