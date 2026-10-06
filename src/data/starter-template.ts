/**
 * src/data/starter-template.ts
 *
 * Typed mirror of public/players.json — three example cards as in-memory
 * objects typed against PlayerVersion. If this file compiles, the objects
 * satisfy the schema at the TypeScript level; starter.test.ts verifies the
 * runtime Zod validation.
 *
 * Usage in downstream phases:
 *   import { starterPlayers } from "./starter-template";
 *
 * DATA-06: Starter template demonstrates every field for new-player onboarding.
 */

import type { PlayerVersion } from "./schema";

/**
 * Three starter cards that collectively demonstrate:
 *   - Single-role card (faker-2016: mid only)
 *   - Single-role card (uzi-2018: adc only)
 *   - Multi-role card (player-friend-2023: top + jungle)
 *   - All five roleStrength keys on every card (unplayed roles = 0) — D-S2
 *   - Explicit primaryRole field (member of roles array) — D-S1
 *   - 2-trait card (faker-2016, uzi-2018) and 1-trait card (player-friend-2023)
 *   - Champion pools of 8+ champions with mastery spread 1-5
 *   - All three phase overalls: lanePhase, midGame, lateGame
 */
export const starterPlayers: PlayerVersion[] = [
  {
    id: "faker-2016",
    personId: "faker",
    displayName: "Faker 2016",
    year: 2016,
    roles: ["mid"],
    primaryRole: "mid",
    roleStrength: {
      top: 0,
      jungle: 0,
      mid: 96,
      adc: 0,
      support: 0,
    },
    lanePhase: 95,
    midGame: 97,
    lateGame: 94,
    traits: ["clutch_player", "mental_fort"],
    championPool: [
      { championId: "leblanc", mastery: 5 },
      { championId: "zed", mastery: 5 },
      { championId: "ryze", mastery: 4 },
      { championId: "orianna", mastery: 4 },
      { championId: "twisted-fate", mastery: 3 },
      { championId: "cassiopeia", mastery: 3 },
      { championId: "galio", mastery: 2 },
      { championId: "corki", mastery: 1 },
    ],
  },
  {
    id: "uzi-2018",
    personId: "uzi",
    displayName: "Uzi 2018",
    year: 2018,
    roles: ["adc"],
    primaryRole: "adc",
    roleStrength: {
      top: 0,
      jungle: 0,
      mid: 0,
      adc: 98,
      support: 0,
    },
    lanePhase: 98,
    midGame: 89,
    lateGame: 97,
    traits: ["strong_laner", "lane_bully"],
    championPool: [
      { championId: "vayne", mastery: 5 },
      { championId: "ezreal", mastery: 5 },
      { championId: "kog-maw", mastery: 4 },
      { championId: "caitlyn", mastery: 4 },
      { championId: "jinx", mastery: 4 },
      { championId: "xayah", mastery: 3 },
      { championId: "draven", mastery: 2 },
      { championId: "lucian", mastery: 1 },
    ],
  },
  {
    id: "player-friend-2023",
    personId: "player-friend",
    displayName: "Friend (Top/Jungle 2023)",
    year: 2023,
    roles: ["top", "jungle"],
    primaryRole: "top",
    roleStrength: {
      top: 78,
      jungle: 65,
      mid: 0,
      adc: 0,
      support: 0,
    },
    lanePhase: 70,
    midGame: 62,
    lateGame: 58,
    traits: ["objective_focused"],
    championPool: [
      { championId: "darius", mastery: 5 },
      { championId: "garen", mastery: 4 },
      { championId: "malphite", mastery: 4 },
      { championId: "vi", mastery: 3 },
      { championId: "hecarim", mastery: 3 },
      { championId: "warwick", mastery: 2 },
      { championId: "camille", mastery: 2 },
      { championId: "sion", mastery: 1 },
    ],
  },
];
