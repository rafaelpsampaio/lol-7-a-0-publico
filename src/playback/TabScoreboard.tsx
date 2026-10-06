import { playerName } from "../data/playerPresentation";
/**
 * src/playback/TabScoreboard.tsx
 *
 * Championship "tab" scoreboard (inspired by the in-client scoreboard): one row
 * per role, user player on the left and rival on the right, each with champion
 * portrait, KDA, gold and any shutdown bounty. Driven by the per-player map
 * snapshot. Collapsible.
 */

import { For, Show } from "solid-js";
import type { GameEvent } from "../sim/types";
import type { PlayerVersion, ChampionEntry, Role } from "../data/schema";
import { DEFAULT_MAP, fmtGold } from "./playbackDefaults";

interface Props {
  event: GameEvent | null;
  userRoster: PlayerVersion[];
  rivalRoster: PlayerVersion[];
  userChampions: Record<string, string>;
  rivalChampions: Record<string, string>;
  catalogue: ChampionEntry[];
}

const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];
const ROLE_LABEL: Record<Role, string> = {
  top: "TOP", jungle: "JG", mid: "MID", adc: "ADC", support: "SUP",
};

function shortName(p: PlayerVersion): string {
  return playerName(p);
}

function info(
  roster: PlayerVersion[],
  champions: Record<string, string>,
  catalogue: ChampionEntry[]
): Record<Role, { name: string; image?: string }> {
  const byId = new Map(catalogue.map((c) => [c.id, c]));
  const out = {} as Record<Role, { name: string; image?: string }>;
  for (const p of roster) {
    const e = champions[p.id] ? byId.get(champions[p.id]) : undefined;
    out[p.primaryRole] = { name: shortName(p), image: e?.image };
  }
  return out;
}

export function TabScoreboard(props: Props) {
  const m = () => props.event?.map ?? DEFAULT_MAP;
  const userInfo = () => info(props.userRoster, props.userChampions, props.catalogue);
  const rivalInfo = () => info(props.rivalRoster, props.rivalChampions, props.catalogue);

  const Portrait = (p: { image?: string; name: string; dead: boolean }) => (
    <Show when={p.image} fallback={<span class="tab-portrait tab-portrait--fallback">{p.name.slice(0, 3)}</span>}>
      <img class={`tab-portrait${p.dead ? " tab-portrait--dead" : ""}`} src={`/champions/${p.image}`} alt={p.name} />
    </Show>
  );

  return (
    <div class="tab-scoreboard" aria-label="Placar detalhado">
      <For each={ROLES}>
        {(role) => {
          const u = () => m().user.players[role];
          const r = () => m().rival.players[role];
          const ui = () => userInfo()[role];
          const ri = () => rivalInfo()[role];
          return (
            <div class="tab-row">
              {/* user (left) */}
              <div class="tab-side tab-side--user">
                <Portrait image={ui()?.image} name={ui()?.name ?? "?"} dead={!u().alive} />
                <div class="tab-meta">
                  <span class="tab-name">{ui()?.name}</span>
                  <span class="tab-kda">{u().kills}/{u().deaths}/{u().assists}</span>
                  <Show when={u().away}>
                    <span class="tab-away">saiu</span>
                  </Show>
                </div>
                <div class="tab-econ">
                  <span class="tab-gold">{fmtGold(u().gold)}</span>
                  <Show when={u().shutdownGold > 0}>
                    <span class="tab-shutdown">{u().shutdownGold}</span>
                  </Show>
                </div>
              </div>

              <span class="tab-role">{ROLE_LABEL[role]}</span>

              {/* rival (right) — mirrored */}
              <div class="tab-side tab-side--rival">
                <div class="tab-econ tab-econ--right">
                  <Show when={r().shutdownGold > 0}>
                    <span class="tab-shutdown">{r().shutdownGold}</span>
                  </Show>
                  <span class="tab-gold">{fmtGold(r().gold)}</span>
                </div>
                <div class="tab-meta tab-meta--right">
                  <span class="tab-name">{ri()?.name}</span>
                  <span class="tab-kda">{r().kills}/{r().deaths}/{r().assists}</span>
                  <Show when={r().away}>
                    <span class="tab-away">saiu</span>
                  </Show>
                </div>
                <Portrait image={ri()?.image} name={ri()?.name ?? "?"} dead={!r().alive} />
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
