import { playerName } from "../data/playerPresentation";
/**
 * src/playback/RiftMap.tsx
 *
 * The real League minimap (public/rift/minimap.png) with champion portraits
 * positioned by role on top of it, plus the Dragon and Baron pits drawn with
 * the real objective icons (public/objectives/) and their live timers.
 *
 * Renders from 00:00 using DEFAULT_MAP when no event has fired yet, so the map
 * is on screen the moment playback starts. No emojis — only real LoL art.
 */

import { For, Show } from "solid-js";
import type { GameEvent } from "../sim/types";
import type { PlayerVersion, ChampionEntry, Role } from "../data/schema";
import { DEFAULT_MAP, dragonIcon, BARON_ICON, HERALD_ICON, fmtClock, deadLabel } from "./playbackDefaults";

// ---------------------------------------------------------------------------
// Strongside indicator helpers (LANE-04 / D-05 — continuous, read-only)
// ---------------------------------------------------------------------------

// Midpoints along each lane used to anchor the strongside arc. Values chosen
// to sit on the lane path in the minimap image (100x100 viewBox).
const LANE_MIDPOINTS: Record<"top" | "mid" | "bot", XY> = {
  top: { x: 24, y: 22 },
  mid: { x: 50, y: 50 },
  bot: { x: 76, y: 78 },
};

// Side colours match the existing rift design tokens.
const SIDE_COLOR: Record<"user" | "rival", string> = {
  user: "#4a9eff",
  rival: "#e84057",
};

interface Props {
  event: GameEvent | null;
  userRoster: PlayerVersion[];
  rivalRoster: PlayerVersion[];
  userChampions: Record<string, string>;
  rivalChampions: Record<string, string>;
  catalogue: ChampionEntry[];
}

type XY = { x: number; y: number };

const BLUE_NEXUS: XY = { x: 13, y: 87 };
const RED_NEXUS: XY = { x: 87, y: 13 };
const DRAGON_PIT: XY = { x: 65, y: 66 };
const BARON_PIT: XY = { x: 35, y: 34 };

const CHAMP_POS: Record<"user" | "rival", Record<Role, XY>> = {
  user: {
    top: { x: 13, y: 34 },
    jungle: { x: 27, y: 60 },
    mid: { x: 43, y: 55 },
    adc: { x: 45, y: 88 },
    support: { x: 59, y: 85 },
  },
  rival: {
    top: { x: 57, y: 12 },
    jungle: { x: 73, y: 40 },
    mid: { x: 57, y: 45 },
    adc: { x: 88, y: 56 },
    support: { x: 75, y: 60 },
  },
};

const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

function roleChampions(
  roster: PlayerVersion[],
  champions: Record<string, string>,
  catalogue: ChampionEntry[]
): Record<Role, { name: string; player: string; image?: string }> {
  const byId = new Map(catalogue.map((c) => [c.id, c]));
  const out = {} as Record<Role, { name: string; player: string; image?: string }>;
  for (const p of roster) {
    const entry = champions[p.id] ? byId.get(champions[p.id]) : undefined;
    const player = playerName(p);
    out[p.primaryRole] = { name: entry?.name ?? p.displayName, player, image: entry?.image };
  }
  return out;
}

export function RiftMap(props: Props) {
  // Always have a snapshot — DEFAULT_MAP keeps the map on screen from 00:00.
  const m = () => props.event?.map ?? DEFAULT_MAP;

  // LANE-04 / D-05: continuous strongside accessor — undefined when field absent
  // (backward compat with snapshots produced before Plan 03).
  const ss = () => m().strongside;
  const userChamps = () => roleChampions(props.userRoster, props.userChampions, props.catalogue);
  const rivalChamps = () => roleChampions(props.rivalRoster, props.rivalChampions, props.catalogue);

  // Names involved in the latest event — those champions light up on the map.
  const involved = () => {
    const e = props.event;
    if (!e) return new Set<string>();
    return new Set<string>([...(e.actors ?? []), ...(e.victims ?? [])]);
  };
  const isHot = (name: string | undefined) => !!name && involved().has(name);

  return (
    <div class="rift">
      <svg viewBox="0 0 100 100" class="rift-svg" aria-label="Mapa da partida">
        {/* Real Summoner's Rift minimap */}
        <image href="/rift/minimap.png" x="0" y="0" width="100" height="100"
          preserveAspectRatio="xMidYMid slice" />

        {/* Nexus state (pulse when exposed) */}
        <For each={["user", "rival"] as const}>
          {(side) => (
            <Show when={m()[side].nexusExposed}>
              <circle
                cx={side === "user" ? BLUE_NEXUS.x : RED_NEXUS.x}
                cy={side === "user" ? BLUE_NEXUS.y : RED_NEXUS.y}
                r="5"
                class={`rift-nexus-warn rift-nexus-warn--${side}`}
              />
            </Show>
          )}
        </For>

        {/* Dragon pit — real elemental icon + timer */}
        <g>
          <image
            href={m().dragonAlive ? dragonIcon(m().dragonElement) : dragonIcon(null)}
            x={DRAGON_PIT.x - 5} y={DRAGON_PIT.y - 5} width="10" height="10"
            class={`rift-obj-icon${m().dragonAlive ? " rift-obj-icon--alive" : " rift-obj-icon--waiting"}`}
          />
          <text x={DRAGON_PIT.x} y={DRAGON_PIT.y + 9} class="rift-obj-timer">
            {m().dragonAlive ? "" : fmtClock(m().dragonInSec)}
          </text>
        </g>

        {/* Baron pit — Baron icon (or Herald during its window) + timer */}
        <g>
          <image
            href={m().heraldAlive ? HERALD_ICON : BARON_ICON}
            x={BARON_PIT.x - 5} y={BARON_PIT.y - 5} width="10" height="10"
            class={`rift-obj-icon${m().baronAlive || m().heraldAlive ? " rift-obj-icon--alive" : " rift-obj-icon--waiting"}`}
          />
          <text x={BARON_PIT.x} y={BARON_PIT.y + 9} class="rift-obj-timer">
            {m().heraldAlive ? "" : m().baronAlive ? "" : fmtClock(m().baronInSec)}
          </text>
        </g>

        {/* Champions by role */}
        <For each={["user", "rival"] as const}>
          {(side) => (
            <For each={ROLES}>
              {(role) => {
                const champ = () => (side === "user" ? userChamps() : rivalChamps())[role];
                const ps = () => m()[side].players[role];
                const pos = CHAMP_POS[side][role];
                const id = `clip-${side}-${role}`;
                const hot = () => ps().alive && isHot(champ()?.player);
                return (
                  <g class={`rift-champ${ps().alive ? "" : " rift-champ--dead"}${hot() ? " rift-champ--hot" : ""}`}>
                    {/* Action glow ring when this champion is in the latest event */}
                    <Show when={hot()}>
                      <circle cx={pos.x} cy={pos.y} r="6.2" class={`rift-champ-hot rift-champ-hot--${side}`} />
                    </Show>
                    <clipPath id={id}>
                      <circle cx={pos.x} cy={pos.y} r="4" />
                    </clipPath>
                    <circle cx={pos.x} cy={pos.y} r="4.5"
                      class={`rift-champ-ring rift-champ-ring--${side}`} />
                    <Show
                      when={champ()?.image}
                      fallback={
                        <>
                          <circle cx={pos.x} cy={pos.y} r="4" class="rift-champ-bg" />
                          <text x={pos.x} y={pos.y + 1.4} class="rift-champ-fallback">
                            {(champ()?.name ?? "?").slice(0, 3)}
                          </text>
                        </>
                      }
                    >
                      <image
                        href={`/champions/${champ()!.image}`}
                        x={pos.x - 4} y={pos.y - 4} width="8" height="8"
                        clip-path={`url(#${id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </Show>
                    <Show when={!ps().alive}>
                      <text x={pos.x} y={pos.y + 8} class="rift-champ-respawn">
                        {deadLabel(ps())}
                      </text>
                    </Show>
                  </g>
                );
              }}
            </For>
          )}
        </For>
        {/* ----------------------------------------------------------------
            Strongside / weakside continuous indicator (LANE-04 / D-05)
            Reads m().strongside per-tick - no discrete SimEvent, no ticker.
            Renders a subtle filled ring on the dominant lane midpoint for
            each side (user = blue, rival = red). Absent when strongside
            field is missing (.optional() - backward compat).
            ---------------------------------------------------------------- */}
        <Show when={ss()}>
          {(_strongside) => (
            <>
              <For each={["user", "rival"] as const}>
                {(side) => {
                  const lane = () => ss()![side].dominantLane;
                  const attention = () => ss()![side].junglerAttention;
                  return (
                    <Show when={lane() !== null}>
                      {(_lane) => {
                        const pos = LANE_MIDPOINTS[lane()!];
                        const color = SIDE_COLOR[side];
                        const r = 4 + Math.abs(attention()) * 1.5;
                        return (
                          <g class="rift-strongside" aria-label={`${side} strongside ${lane()}`}>
                            {/* Outer glow ring */}
                            <circle
                              cx={pos.x}
                              cy={pos.y}
                              r={r + 1.2}
                              fill="none"
                              stroke={color}
                              stroke-width="0.5"
                              opacity="0.25"
                            />
                            {/* Inner filled indicator */}
                            <circle
                              cx={pos.x}
                              cy={pos.y}
                              r={r}
                              fill={color}
                              opacity="0.18"
                              stroke={color}
                              stroke-width="0.8"
                            />
                          </g>
                        );
                      }}
                    </Show>
                  );
                }}
              </For>
            </>
          )}
        </Show>
      </svg>
    </div>
  );
}
