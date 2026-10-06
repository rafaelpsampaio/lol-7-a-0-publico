/**
 * src/sim/objectives.ts
 *
 * Phase 4 — objective TIMERS and HARD RULES.
 *
 * Two responsibilities, both pure (mutate the passed state, no I/O):
 *  1. updateObjectiveTimers(state, rng) — advance spawn / respawn / despawn of
 *     every epic each tick, obeying real Summoner's Rift availability windows.
 *  2. take* / steal helpers — apply a confirmed objective to the state, with
 *     guards that make IMPOSSIBLE events impossible:
 *       - Baron NEVER before 20:00.
 *       - Elder NEVER before a soul exists.
 *       - Herald only inside 15:00–19:45 (patch 26) and never alongside Baron.
 *       - Voidgrubs: one wave of 3 at 8:00, never respawn, gone at 14:45 (patch 26).
 *       - An objective cannot be taken unless it is alive.
 *       - An objective cannot be STOLEN without an active attempt + contest.
 *
 * The engine (Phase 5) decides WHEN a team takes an objective; this module owns
 * WHETHER that is even legal and what it does to the state.
 */

import {
  TIMERS,
  DRAGON_ELEMENTS,
  LANES,
  ROLES,
  opponent,
  type MatchState,
  type Side,
  type DragonElement,
  type TeamState,
  type PlayerState,
} from "./matchState";
import {
  creditPlayer, creditTeamSplit, objectiveBountyGold,
  EPIC_GOLD_PER_PLAYER, EPIC_SECURE_GOLD, DRAGON_SECURE_GOLD, GRUB_GOLD, HERALD_SECURE_GOLD,
} from "./economy";
import { bestPlayer } from "./power";
import { effectiveChaos } from "./tuning";

// ---------------------------------------------------------------------------
// Objective kinds
// ---------------------------------------------------------------------------

export type ObjectiveKind =
  | "dragon"
  | "elder"
  | "voidgrubs"
  | "herald"
  | "baron";

// ---------------------------------------------------------------------------
// Element selection
// ---------------------------------------------------------------------------

function pickElement(rng: () => number): DragonElement {
  return DRAGON_ELEMENTS[Math.floor(rng() * DRAGON_ELEMENTS.length)];
}

/** Pick an element different from `not`, for flavour on the first two drakes. */
function pickElementExcept(rng: () => number, not: DragonElement | null): DragonElement {
  if (!not) return pickElement(rng);
  let e = pickElement(rng);
  // At most a couple of redraws — DRAGON_ELEMENTS has 6 entries.
  let guard = 0;
  while (e === not && guard < 8) {
    e = pickElement(rng);
    guard++;
  }
  return e;
}

/**
 * Pick an element different from every element in `exclude` (when possible).
 * Used to lock the soul as a THIRD distinct type, so a game reads as
 * "type A, type B, then C C C…" instead of the soul repeating an earlier drake.
 */
function pickElementExceptMany(
  rng: () => number,
  exclude: readonly DragonElement[]
): DragonElement {
  const pool = DRAGON_ELEMENTS.filter((e) => !exclude.includes(e));
  if (pool.length === 0) return pickElement(rng); // all 6 excluded — impossible with 2
  return pool[Math.floor(rng() * pool.length)];
}

// ---------------------------------------------------------------------------
// 1. Timer advancement — called once per tick
// ---------------------------------------------------------------------------

/**
 * Advance every epic's availability for the current `state.gameTimeSec`.
 * Spawns things whose timer has elapsed, despawns things past their window.
 * Mutates and returns `state`.
 */
export function updateObjectiveTimers(
  state: MatchState,
  rng: () => number
): MatchState {
  const o = state.objectives;
  const t = state.gameTimeSec;

  // --- Dragon ---------------------------------------------------------------
  // Spawns when its (re)spawn timer elapses and none is currently up.
  if (!o.dragonAlive && o.dragonRespawnAtSec !== null && t >= o.dragonRespawnAtSec) {
    // Element rule: once 2 dragons are slain the Rift's element is locked (set on
    // the 2nd kill in takeObjective); from the 3rd dragon on, only that element
    // spawns. The first two drakes are DIFFERENT elements — the 2nd is forced to
    // differ from the 1st via lastSpawnedElement (which survives the take).
    if (o.dragonsTaken >= 2) {
      if (!o.soulElement) {
        // defensive fallback — a third type distinct from the first two drakes
        const taken = [...state.user.dragons, ...state.rival.dragons];
        o.soulElement = pickElementExceptMany(rng, taken);
      }
      o.dragonElement = o.soulElement;
    } else {
      o.dragonElement = pickElementExcept(rng, o.lastSpawnedElement);
    }
    o.lastSpawnedElement = o.dragonElement;
    o.dragonAlive = true;
    o.dragonRespawnAtSec = null;
  }

  // --- Voidgrubs ------------------------------------------------------------
  // Patch 26: uma leva so, de 3 larvas, as 8:00, sem respawn; o acampamento some as 14:45.
  if (!o.voidgrubsDespawned) {
    if (o.voidgrubsWave === 0 && o.voidgrubsRespawnAtSec !== null && t >= o.voidgrubsRespawnAtSec) {
      o.voidgrubsAlive = 3;
      o.voidgrubsWave = 1;
      o.voidgrubsRespawnAtSec = null;
    }
    if (t >= TIMERS.VOIDGRUBS_DESPAWN) {
      o.voidgrubsAlive = 0;
      o.voidgrubsRespawnAtSec = null;
      o.voidgrubsDespawned = true;
    }
  }

  // --- Rift Herald ----------------------------------------------------------
  // Spawns 15:00 (once, patch 26), despawns 19:45 if untouched. Never coexists with Baron.
  if (!o.heraldDone) {
    if (!o.heraldAlive && t >= TIMERS.HERALD_SPAWN && t < TIMERS.HERALD_DESPAWN) {
      o.heraldAlive = true;
    }
    if (t >= TIMERS.HERALD_DESPAWN && o.heraldAlive) {
      o.heraldAlive = false;
      o.heraldDone = true; // despawned unclaimed — never returns
    }
  }

  // --- Baron Nashor ---------------------------------------------------------
  // HARD: never alive before 20:00. Spawns at its (re)spawn timer.
  if (
    !o.baronAlive &&
    o.baronRespawnAtSec !== null &&
    t >= o.baronRespawnAtSec &&
    t >= TIMERS.BARON_SPAWN
  ) {
    o.baronAlive = true;
    o.baronRespawnAtSec = null;
  }

  // --- Elder Dragon ---------------------------------------------------------
  // HARD: only after a soul exists. Spawns when its timer elapses.
  if (
    o.elderUnlocked &&
    !o.elderAlive &&
    o.elderRespawnAtSec !== null &&
    t >= o.elderRespawnAtSec
  ) {
    o.elderAlive = true;
    o.elderRespawnAtSec = null;
  }

  // --- Inhibitor respawn ----------------------------------------------------
  // A destroyed inhibitor comes back 5:00 later (real SR rule). While it is down
  // the enemy's Nexus turrets/Nexus are reachable; once it respawns the base is
  // protected again until it is re-broken — so this naturally gives the losing
  // team a defensive window.
  respawnInhibitors(state, "user");
  respawnInhibitors(state, "rival");

  // --- Buff expiry ----------------------------------------------------------
  expireBuffs(state, "user");
  expireBuffs(state, "rival");

  return state;
}

function respawnInhibitors(state: MatchState, side: Side): void {
  const team = teamSide(state, side);
  for (const lane of LANES) {
    const st = team.structures[lane];
    if (
      !st.inhibitorAlive &&
      st.inhibitorRespawnAtSec !== null &&
      state.gameTimeSec >= st.inhibitorRespawnAtSec
    ) {
      st.inhibitorAlive = true;
      st.inhibitorRespawnAtSec = null;
    }
  }
}

function expireBuffs(state: MatchState, side: Side): void {
  const b = state.buffs;
  if (b.baronUntilSec[side] !== null && state.gameTimeSec >= b.baronUntilSec[side]!) {
    b.baronUntilSec[side] = null;
    for (const role of ["top", "jungle", "mid", "adc", "support"] as const) {
      teamSide(state, side).players[role].hasBaronBuff = false;
    }
  }
  if (b.elderUntilSec[side] !== null && state.gameTimeSec >= b.elderUntilSec[side]!) {
    b.elderUntilSec[side] = null;
    for (const role of ["top", "jungle", "mid", "adc", "support"] as const) {
      teamSide(state, side).players[role].hasElderBuff = false;
    }
  }
}

function teamSide(state: MatchState, side: Side) {
  return side === "user" ? state.user : state.rival;
}

// ---------------------------------------------------------------------------
// 2. Availability & legality (the HARD rules, queryable)
// ---------------------------------------------------------------------------

/** Is this objective alive and therefore legally takeable right now? */
export function isObjectiveAvailable(state: MatchState, kind: ObjectiveKind): boolean {
  const o = state.objectives;
  switch (kind) {
    case "dragon":
      return o.dragonAlive;
    case "elder":
      // Redundant with elderAlive (which already requires unlock) but explicit.
      return o.elderAlive && o.elderUnlocked;
    case "voidgrubs":
      return o.voidgrubsAlive > 0 && !o.voidgrubsDespawned;
    case "herald":
      return (
        o.heraldAlive &&
        state.gameTimeSec >= TIMERS.HERALD_SPAWN &&
        state.gameTimeSec < TIMERS.HERALD_DESPAWN
      );
    case "baron":
      // HARD: never before 20:00, and must be alive.
      return o.baronAlive && state.gameTimeSec >= TIMERS.BARON_SPAWN;
  }
}

/**
 * A steal is only legal when one side is actively attempting the objective and
 * the other side is contesting it (pesquisa.md). Never a free random event.
 */
export function canStealObjective(
  state: MatchState,
  kind: ObjectiveKind,
  ctx: { attemptingSide: Side | null; contesting: boolean }
): boolean {
  if (!isObjectiveAvailable(state, kind)) return false;
  return ctx.attemptingSide !== null && ctx.contesting === true;
}

// ---------------------------------------------------------------------------
// 3. Applying a confirmed take to the state
// ---------------------------------------------------------------------------

export interface TakeResult {
  kind: ObjectiveKind;
  side: Side;
  /** True when this take granted the Dragon Soul. */
  grantedSoul: boolean;
  /** Element involved (dragon/soul), if any. */
  element: DragonElement | null;
  /** Voidgrubs picked up in this take (0..3). */
  grubs: number;
}

/**
 * Quem confirma o objetivo (Smite): o jungler vivo; com ele morto, o jogador de melhor fatia de
 * objetivo, com os vivos valendo 1 e os mortos 0,2 (a mesma regra do texto do evento).
 */
export function objectiveSecurer(team: TeamState): PlayerState {
  return team.players.jungle.alive ? team.players.jungle : bestPlayer(team, "objective");
}

/**
 * Apply a confirmed objective take by `side`. THROWS if the objective is not
 * available — callers must gate on isObjectiveAvailable / canStealObjective so
 * an impossible event can never reach the timeline.
 */
export function takeObjective(
  state: MatchState,
  side: Side,
  kind: ObjectiveKind,
  // Used to lock the soul element on the 2nd dragon's death.
  rng: () => number
): TakeResult {
  if (!isObjectiveAvailable(state, kind)) {
    throw new Error(
      `takeObjective: ${kind} is not available at ${state.gameTimeSec}s (hard-rule violation)`
    );
  }

  const team = teamSide(state, side);
  const o = state.objectives;
  const t = state.gameTimeSec;
  const result: TakeResult = {
    kind,
    side,
    grantedSoul: false,
    element: null,
    grubs: 0,
  };

  // Recompensa de objetivo (spec secao 3): paga ANTES do efeito do objetivo, com o deficit
  // de antes da tomada. Vale para tomada e roubo (stealObjective passa por aqui).
  const enemyTeam = teamSide(state, opponent(side));
  creditTeamSplit(team, objectiveBountyGold(team.gold, enemyTeam.gold, effectiveChaos(state), state.tuning));

  switch (kind) {
    case "dragon": {
      const element = o.dragonElement!;
      result.element = element;
      team.dragons.push(element);
      o.dragonsTaken += 1;
      o.dragonAlive = false;
      o.dragonElement = null;
      // NB: keep o.lastSpawnedElement (the element just taken) so the next drake
      // can be forced to differ — do NOT clear it here.
      o.dragonRespawnAtSec = t + TIMERS.DRAGON_RESPAWN;
      creditPlayer(team, objectiveSecurer(team), DRAGON_SECURE_GOLD);

      // The Rift transforms the moment the 2nd dragon dies — lock the soul
      // element now (real rule), so the map reveals it before the 3rd spawns.
      // Soul is a THIRD distinct type: different from both of the first two drakes.
      if (o.dragonsTaken === 2 && !o.soulElement) {
        const taken = [...state.user.dragons, ...state.rival.dragons];
        o.soulElement = pickElementExceptMany(rng, taken);
      }

      // Soul on the 4th dragon for THIS team.
      if (team.dragons.length >= TIMERS.SOUL_DRAGON_COUNT && team.soul === null) {
        team.soul = o.soulElement ?? element;
        result.grantedSoul = true;
        // Elder unlocks once a soul exists; patch 26: first spawn 5:00 later.
        if (!o.elderUnlocked) {
          o.elderUnlocked = true;
          o.elderRespawnAtSec = t + TIMERS.ELDER_FIRST_SPAWN_AFTER_SOUL;
          // No elemental dragon spawns once soul is decided.
          o.dragonRespawnAtSec = null;
        }
      }
      break;
    }

    case "elder": {
      o.elderAlive = false;
      o.elderRespawnAtSec = t + TIMERS.ELDER_RESPAWN;
      team.elderCount += 1;
      // Elder buff (150s) to living players.
      state.buffs.elderUntilSec[side] = t + TIMERS.ELDER_BUFF_DURATION;
      for (const role of ROLES) {
        const p = team.players[role];
        if (p.alive) p.hasElderBuff = true;
        creditPlayer(team, p, EPIC_GOLD_PER_PLAYER);
      }
      creditPlayer(team, objectiveSecurer(team), EPIC_SECURE_GOLD);
      break;
    }

    case "voidgrubs": {
      const grabbed = o.voidgrubsAlive;
      result.grubs = grabbed;
      team.voidgrubs = Math.min(3, team.voidgrubs + grabbed);
      o.voidgrubsAlive = 0;
      // Patch 26: leva unica; tomada, o acampamento nao volta.
      o.voidgrubsRespawnAtSec = null;
      o.voidgrubsDespawned = true;
      creditPlayer(team, objectiveSecurer(team), GRUB_GOLD * grabbed);
      break;
    }

    case "herald": {
      o.heraldAlive = false;
      o.heraldDone = true;
      team.heraldTaken = true;
      creditPlayer(team, objectiveSecurer(team), HERALD_SECURE_GOLD);
      break;
    }

    case "baron": {
      o.baronAlive = false;
      o.baronRespawnAtSec = t + TIMERS.BARON_RESPAWN;
      team.baronsTaken += 1;
      // Hand of Baron (180s) to living players; patch 26: 150 gold to every player + 100 to the securer.
      state.buffs.baronUntilSec[side] = t + TIMERS.BARON_BUFF_DURATION;
      for (const role of ROLES) {
        const p = team.players[role];
        if (p.alive) p.hasBaronBuff = true;
        creditPlayer(team, p, EPIC_GOLD_PER_PLAYER);
      }
      creditPlayer(team, objectiveSecurer(team), EPIC_SECURE_GOLD);
      break;
    }
  }

  return result;
}

/**
 * Apply a STOLEN objective: the contesting side snatches it from the attempting
 * side. THROWS unless canStealObjective passes — guaranteeing steals only land
 * on a genuinely contested objective.
 */
export function stealObjective(
  state: MatchState,
  stealingSide: Side,
  kind: ObjectiveKind,
  ctx: { attemptingSide: Side | null; contesting: boolean },
  _rng: () => number
): TakeResult {
  if (!canStealObjective(state, kind, ctx)) {
    throw new Error(
      `stealObjective: ${kind} steal is illegal (needs active attempt + contest)`
    );
  }
  // The stealing side must be the one contesting the attempting side.
  if (ctx.attemptingSide !== null && stealingSide === ctx.attemptingSide) {
    throw new Error("stealObjective: the attempting side cannot steal from itself");
  }
  if (ctx.attemptingSide !== null && stealingSide !== opponent(ctx.attemptingSide)) {
    throw new Error("stealObjective: stealing side must be the contesting opponent");
  }
  return takeObjective(state, stealingSide, kind, _rng);
}
