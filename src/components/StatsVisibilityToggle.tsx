import { For } from "solid-js";
import { STATS_OPTIONS, type StatsMode } from "../data/statsPolicy";
import { statsMode, setStatsMode } from "../storage/statsMode";
export function StatsVisibilityToggle(props: { value?: () => StatsMode; onChange?: (v: StatsMode) => void } = {}) {
  return <label class="stats-toggle">Atributos dos jogadores
    <select value={props.value?.() ?? statsMode()} onChange={e => (props.onChange ?? setStatsMode)(e.currentTarget.value as StatsMode)}>
      <For each={STATS_OPTIONS}>{o => <option value={o.value}>{o.label}</option>}</For>
    </select>
    <small>Nas opções depois do draft, cada carta revela seus atributos após ser escolhida.</small>
  </label>;
}
