import { playerName } from "../data/playerPresentation";
/**
 * src/playback/TeamPanel.tsx
 *
 * Broadcast-style vertical side panel for ONE team: header (tag + name) and the
 * five players (portrait, name, KDA, gold, shutdown bounty), driven by the live
 * per-player map snapshot. user side aligns left, rival side mirrors right.
 */

import { For, Show } from "solid-js";
import type { GameEvent } from "../sim/types";
import type { PlayerVersion, ChampionEntry, Role } from "../data/schema";
import { DEFAULT_MAP, fmtGold } from "./playbackDefaults";

interface Props {
  event: GameEvent | null;
  side: "user" | "rival";
  teamName: string;
  teamTag: string;
  roster: PlayerVersion[];
  champions: Record<string, string>;
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

export function TeamPanel(props: Props) {
  const m = () => props.event?.map ?? DEFAULT_MAP;
  const inf = () => info(props.roster, props.champions, props.catalogue);

  return (
    <div class={`tpanel tpanel--${props.side}`} aria-label={`Time ${props.teamName}`}>
      <div class="tpanel-head">
        <span class={`tpanel-tag tpanel-tag--${props.side}`}>{props.teamTag}</span>
        <span class="tpanel-name">{props.teamName}</span>
      </div>

      <For each={ROLES}>
        {(role) => {
          const ps = () => m()[props.side].players[role];
          const ci = () => inf()[role];
          return (
            <div class={`tpanel-row${ps().alive ? "" : " tpanel-row--dead"}`}>
              <Show
                when={ci()?.image}
                fallback={<span class="tpanel-portrait tpanel-portrait--fallback">{ci()?.name?.slice(0, 3)}</span>}
              >
                <img class="tpanel-portrait" src={`/champions/${ci()!.image}`} alt={ci()?.name} />
              </Show>
              <span class="tpanel-role">{ROLE_LABEL[role]}</span>
              <div class="tpanel-meta">
                <span class="tpanel-pname">{ci()?.name}</span>
                <span class="tpanel-kda">{ps().kills}/{ps().deaths}/{ps().assists}</span>
                <Show when={ps().away}>
                  <span class="tpanel-away">saiu</span>
                </Show>
              </div>
              <div class="tpanel-econ">
                <span class="tpanel-gold">{fmtGold(ps().gold)}</span>
                <Show when={ps().shutdownGold > 0}>
                  <span class="tpanel-shutdown">{ps().shutdownGold}</span>
                </Show>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
