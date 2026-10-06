/**
 * src/playback/playbackDefaults.ts
 *
 * Default snapshots so the map + HUD render from 00:00 (before the first event)
 * instead of staying blank until the first objective fires, plus the real
 * League objective-icon paths (downloaded to public/objectives/).
 */

import type { MapSnapshot } from "../sim/types";

/** Real minimap icon for a dragon element (or the generic pip when unknown). */
export function dragonIcon(element: string | null): string {
  const known = ["infernal", "mountain", "ocean", "cloud", "hextech", "chemtech"];
  return element && known.includes(element)
    ? `/objectives/dragon_${element}.png`
    : "/objectives/dragon.png";
}

export const ELDER_ICON = "/objectives/dragon_elder.png";
export const BARON_ICON = "/objectives/baron.png";
export const HERALD_ICON = "/objectives/riftherald.png";
export const GRUB_ICON = "/objectives/grub.png";

const freshLane = () => ({
  outer: true,
  inner: true,
  inhibTurret: true,
  inhibitor: true,
  inhibInSec: null,
});

const freshPlayer = () => ({
  alive: true,
  respawnInSec: null,
  kills: 0,
  deaths: 0,
  assists: 0,
  gold: 500,
  shutdownGold: 0,
});

const freshTeam = () => ({
  top: freshLane(),
  mid: freshLane(),
  bot: freshLane(),
  nexusTurrets: 2,
  nexusExposed: false,
  players: {
    top: freshPlayer(),
    jungle: freshPlayer(),
    mid: freshPlayer(),
    adc: freshPlayer(),
    support: freshPlayer(),
  },
});

const neutralStrongsideSide = () => ({
  dominantLane: null as null,
  scores: { top: 0, mid: 0, bot: 0 },
  junglerAttention: 0,
});

/** The Rift at 00:00 — everything standing, first dragon in 5:00, Baron at 20:00. */
export const DEFAULT_MAP: MapSnapshot = {
  user: freshTeam(),
  rival: freshTeam(),
  dragonAlive: false,
  dragonInSec: 300,
  dragonElement: null,
  soulElement: null,
  userSoul: null,
  rivalSoul: null,
  dragonsTaken: 0,
  baronAlive: false,
  baronInSec: 1200,
  heraldAlive: false,
  voidgrubsAlive: 0,
  elderAlive: false,
  elderUnlocked: false,
  elderInSec: null,
  // LANE-04 / D-05: neutral strongside at 00:00 — no dominant lane yet.
  // Field is .optional() in MapSnapshotSchema for backward compat, but we
  // provide an explicit neutral value so the HUD renders from the first tick
  // without a null-check gap.
  strongside: {
    user: neutralStrongsideSide(),
    rival: neutralStrongsideSide(),
  },
};

export interface ScoreSnapshot {
  userKills: number;
  rivalKills: number;
  userTowers: number;
  rivalTowers: number;
  userDragons: number;
  rivalDragons: number;
  userBaron: boolean;
  rivalBaron: boolean;
  userElder: boolean;
  rivalElder: boolean;
  userGold: number;
  rivalGold: number;
  userDragonEls: string[];
  rivalDragonEls: string[];
}

export const DEFAULT_SCORE: ScoreSnapshot = {
  userKills: 0, rivalKills: 0,
  userTowers: 0, rivalTowers: 0,
  userDragons: 0, rivalDragons: 0,
  userBaron: false, rivalBaron: false,
  userElder: false, rivalElder: false,
  userGold: 2500, rivalGold: 2500,
  userDragonEls: [], rivalDragonEls: [],
};

/** "27.7K" style gold formatting. */
export function fmtGold(g: number): string {
  return `${(g / 1000).toFixed(1)}K`;
}

/** MM:SS from seconds (or "" for null). */
export function fmtClock(sec: number | null): string {
  if (sec === null) return "";
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Spec traits no motor (4): texto sob o jogador fora do mapa; quem quitou mostra SAIU. */
export function deadLabel(p: { away?: boolean; respawnInSec: number | null }): string {
  return p.away === true ? "SAIU" : fmtClock(p.respawnInSec);
}
