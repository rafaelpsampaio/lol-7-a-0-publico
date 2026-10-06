/**
 * src/sim/runMatch.ts
 *
 * Pure match simulation engine — runMatch(input, seed) → MatchResult.
 *
 * SIM-01: Deterministic — same input + seed always produces identical output.
 * SIM-02: Role-weighted phase scoring (support→lanePhase, jungle→midGame, ADC+mid→lateGame).
 * SIM-03: Timestamped event timeline using the locked vocabulary (D-15).
 * SIM-07: Incremental winProbAfter per event, anchored to avoid early pinning (Pitfall 6).
 * D-09/D-10: Closeness drives duration (close→longer, stomp→shorter) and epic events.
 * D-11: Mechanism is in place; calibration constants are marked as Phase-3-tunable.
 *
 * IMPORTANT: Never call Math.random() in this file. All randomness flows through
 * the mulberry32 seeded RNG for reproducibility and testability (T-02-04 mitigation).
 */

import type { PlayerVersion, ChampionTrait, ChampionEntry } from "../data/schema";
import type { MatchInput, MatchResult, GameEvent, EventType, SpeedPreset } from "./types";
import { mulberry32 } from "./rng";
import {
  playerTraitScoreDelta,
  playerTraitSwingBias,
  championTraitEventWeight,
} from "./traits";

// ---------------------------------------------------------------------------
// Speed preset durations (D-09) — exported for test assertions
// ---------------------------------------------------------------------------

/** Average playback duration in milliseconds for each speed preset (D-09). */
export const SPEED_PRESET_MS: Record<SpeedPreset, number> = {
  super_fast: 15_000,
  fast: 30_000,
  slow: 60_000,
  super_slow: 90_000,
};

// ---------------------------------------------------------------------------
// Phase-3-tunable calibration constants (D-11 — mechanism ships; calibration deferred)
// ---------------------------------------------------------------------------

/**
 * Composite score difference that constitutes a "stomp" (closeness → 0).
 * Phase 3: replace linear decay with sigmoid; calibrate threshold.
 */
const STOMP_DIFF = 60; // Phase-3-tunable

/**
 * Closeness threshold above which epic events (baron, elder_dragon) can appear.
 * Phase 3: calibrate via win-rate histograms.
 */
const EPIC_EVENT_CLOSENESS_THRESHOLD = 0.35; // Phase-3-tunable

/**
 * Additional threshold for elder_dragon (requires very close game).
 * Phase 3: calibrate.
 */
const ELDER_DRAGON_THRESHOLD = 0.60; // Phase-3-tunable

/**
 * Duration range multipliers: stomp = 0.5x preset, epic = 1.5x preset.
 * Phase 3: calibrate via observed match length distributions.
 */
const DURATION_MIN_MULT = 0.5; // Phase-3-tunable
const DURATION_MAX_MULT = 1.5; // Phase-3-tunable

/**
 * Sigmoid k — controls how sharply win probability reacts to event momentum.
 * Phase 3: calibrate.
 */
const WIN_PROB_SIGMOID_K = 1; // Phase-3-tunable

/**
 * Default comeback intensity (D-10). Scales the pro-comeback mean-reversion
 * force in updateWinProbability — 0 = no comeback, 1 = strong rubber-band.
 * Targets ~25% comeback rate per D-09.
 */
const DEFAULT_CHAOS_LEVEL = 0.25; // Phase-3-tunable

/**
 * Gain on the comeback swing DIRECTION bias. Direction-only tilt at
 * chaosLevel≈0.25 was far too weak to reach the D-09 comeback band (Pitfall 6:
 * the anchor + gg-commit pin the leader), so the bias is amplified here.
 */
const COMEBACK_BIAS_GAIN = 2; // Phase-3-tunable

/**
 * Gain on the comeback swing MAGNITUDE when an event favors the trailing team.
 * This is the lever that actually lets a 3-event leader be overtaken before gg
 * while leaving the favorite's baseline win-rate tiers (D-08) intact.
 */
const COMEBACK_MAGNITUDE_GAIN = 50; // Phase-3-tunable

/**
 * Per-trait comeback-dampening fraction for negative-when-behind player traits
 * (plays_worse_when_behind, tilts_on_death). A 5-player stack removes
 * 5 × this fraction of the comeback rubber-band while the team is behind —
 * tuned via traitCalibration.test.ts to clear the >5pp criterion (D-05/SIM-05).
 */
const COMEBACK_DAMPEN_PER_TRAIT = 0.08; // Phase-3-tunable

/**
 * Gain converting the champion-trait event-weight advantage (a log-ratio of the
 * two teams' density-scaled multipliers, SIM-06/D-04) into a swing-DIRECTION
 * tilt on the matching event. A full 5/5 high_first_blood stack vs a neutral
 * rival gives log(1.4)≈0.336; at this gain that adds ≈0.10 to the coin flip
 * that decides which team the event favors — enough to lift the first-blood
 * rate measurably (criterion 3) without overpowering score/comeback forces.
 * 0 when no catalogue is passed (trait-neutral) → calibration unchanged.
 */
const CHAMPION_TRAIT_SWING_GAIN = 0.3; // Phase-3-tunable

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Simulate a single game.
 *
 * Pure function: deterministic given the same input + seed (SIM-01).
 * No DOM, no I/O, no side effects. Safe to call in unit tests.
 */
export function runMatch(
  input: MatchInput,
  seed: number,
  chaosLevel: number = DEFAULT_CHAOS_LEVEL
): MatchResult {
  const rng = mulberry32(seed);

  // Resolve effective chaos: input field (D-10) overrides the param, which
  // defaults to DEFAULT_CHAOS_LEVEL. Either drives the comeback force.
  const effectiveChaosLevel = input.chaosLevel ?? chaosLevel;

  // 1. Score each team with role-weighted phase formulas (SIM-02)
  const userScore = scoreTeam(input.userRoster);
  const rivalScore = scoreTeam(input.rivalRoster);

  // 2. Determine match closeness [0, 1] (D-10 driver)
  const closeness = computeCloseness(userScore.composite, rivalScore.composite);

  // 3. Determine total playback duration (D-09/D-10)
  const presetMs = SPEED_PRESET_MS[input.speedPreset];
  const totalPlaybackMs = computeDurationMs(presetMs, closeness, rng);

  // 4. Select epic events (baron/elder_dragon only in close games — D-10/D-15)
  const epicEvents = selectEpicEvents(closeness, rng);

  // 4b. Champion-trait densities per team (SIM-06 / D-04). Build a championId→
  // traits lookup from the optional catalogue (empty when absent → trait-neutral,
  // Pitfall 7) and count how many of each team's picked champions carry each
  // trait. Missing IDs contribute nothing and never throw.
  const championLookup = buildChampionLookup(input.championCatalogue);
  const userChampionTraitCounts = countTeamChampionTraits(
    input.userChampions,
    championLookup
  );
  const rivalChampionTraitCounts = countTeamChampionTraits(
    input.rivalChampions,
    championLookup
  );

  // 5. Build the event timeline (SIM-03)
  const baseline = computeBaseline(userScore.composite, rivalScore.composite);
  const events = buildEventTimeline(
    totalPlaybackMs,
    epicEvents,
    baseline,
    closeness,
    effectiveChaosLevel,
    input.userRoster,
    input.rivalRoster,
    userChampionTraitCounts,
    rivalChampionTraitCounts,
    rng
  );

  // 6. Determine winner from the final win probability (SIM-07)
  const finalWinProb = events[events.length - 1].winProbAfter;
  const winner: "user" | "rival" = finalWinProb > 0.5 ? "user" : "rival";

  return { winner, events, totalPlaybackMs };
}

// ---------------------------------------------------------------------------
// Internal helpers — scoring
// ---------------------------------------------------------------------------

interface TeamScore {
  lane: number;
  mid: number;
  late: number;
  composite: number;
}

/**
 * Compute a team's composite score using role-based phase weights (SIM-02).
 *
 * Role weight rationale (PROJECT.md premise):
 * - support: heavy weight on lanePhase (lane bully/sustain)
 * - jungle: heavy weight on midGame (objectives, dragon control)
 * - ADC + mid: heavy weight on lateGame (carry potential)
 * - top: moderate across all phases
 */
function scoreTeam(roster: PlayerVersion[]): TeamScore {
  const byRole: Partial<Record<string, PlayerVersion>> = {};
  for (const p of roster) {
    byRole[p.primaryRole] = p;
  }

  // Lane phase weights — support 30%, top 25%, jungle 20%, mid 15%, adc 10%
  const lane =
    (byRole["support"]?.lanePhase ?? 50) * 0.30 +
    (byRole["top"]?.lanePhase ?? 50) * 0.25 +
    (byRole["jungle"]?.lanePhase ?? 50) * 0.20 +
    (byRole["mid"]?.lanePhase ?? 50) * 0.15 +
    (byRole["adc"]?.lanePhase ?? 50) * 0.10;

  // Mid game weights — jungle 35%, mid 25%, top 20%, adc 10%, support 10%
  const mid =
    (byRole["jungle"]?.midGame ?? 50) * 0.35 +
    (byRole["mid"]?.midGame ?? 50) * 0.25 +
    (byRole["top"]?.midGame ?? 50) * 0.20 +
    (byRole["adc"]?.midGame ?? 50) * 0.10 +
    (byRole["support"]?.midGame ?? 50) * 0.10;

  // Late game weights — adc 30%, mid 25%, jungle 20%, top 15%, support 10%
  const late =
    (byRole["adc"]?.lateGame ?? 50) * 0.30 +
    (byRole["mid"]?.lateGame ?? 50) * 0.25 +
    (byRole["jungle"]?.lateGame ?? 50) * 0.20 +
    (byRole["top"]?.lateGame ?? 50) * 0.15 +
    (byRole["support"]?.lateGame ?? 50) * 0.10;

  // Phase-gated player-trait deltas (SIM-05 / D-05). Each trait lands in the
  // phase it belongs to — NOT as a flat composite modifier (Pitfall 2). Behind/
  // ahead traits are intentionally absent here; they fire situationally in
  // updateWinProbability instead.
  let laneTraitDelta = 0;
  let midTraitDelta = 0;
  let lateTraitDelta = 0;
  for (const p of roster) {
    for (const t of p.traits) {
      laneTraitDelta += playerTraitScoreDelta(t, "lane");
      midTraitDelta += playerTraitScoreDelta(t, "mid");
      lateTraitDelta += playerTraitScoreDelta(t, "late");
    }
  }
  const laneAdj = lane + laneTraitDelta;
  const midAdj = mid + midTraitDelta;
  const lateAdj = late + lateTraitDelta;

  // Composite — equal weighting of game phases
  const composite = laneAdj * 0.30 + midAdj * 0.35 + lateAdj * 0.35;

  return { lane: laneAdj, mid: midAdj, late: lateAdj, composite };
}

/**
 * Traits whose effect is a NEGATIVE-when-behind drag. These are NOT applied as a
 * raw additive probability nudge — doing so makes a behind team hit the 0.05
 * floor, which the comeback magnitude boost catapults back to 0.95, inverting
 * the trait's sign. Instead they are routed through a comeback DAMPENER (a team
 * that "plays worse when behind" / "tilts" simply gets a weaker rubber-band),
 * which is monotone-negative and catapult-free.
 */
const COMEBACK_DAMPENING_TRAITS = new Set(["plays_worse_when_behind", "tilts_on_death"]);

/**
 * Sum the situational player-trait swing biases across a roster at the current
 * game state. Pure aggregation over playerTraitSwingBias (D-05) — each trait
 * contributes 0 unless its live-state firing condition is met.
 *
 * Comeback-dampening traits are EXCLUDED here (they are applied via
 * comebackDampenFactor instead) so their effect is never double-counted.
 *
 * @param roster   The team whose own traits are evaluated (winProb is THIS team's).
 * @param winProb  This team's current win probability (the ahead/behind thermometer).
 */
function sumOwnTraitSwingBias(
  roster: PlayerVersion[],
  winProb: number,
  phaseFraction: number
): number {
  let bias = 0;
  for (const p of roster) {
    for (const t of p.traits) {
      if (COMEBACK_DAMPENING_TRAITS.has(t)) continue;
      bias += playerTraitSwingBias(t, winProb, phaseFraction);
    }
  }
  return bias;
}

/**
 * Comeback-dampening factor in (0, 1] for a team's negative-when-behind traits.
 * Returns 1 (no dampening) when the team is even/ahead (winProb >= 0.5) — the
 * traits are situational (D-05) and only bite while behind. Each behind-firing
 * dampening trait shaves COMEBACK_DAMPEN_PER_TRAIT off the rubber-band, so a
 * 5-player stack noticeably weakens the team's comeback without flooring it.
 */
function comebackDampenFactor(
  roster: PlayerVersion[],
  winProb: number
): number {
  if (winProb >= 0.5) return 1;
  let count = 0;
  for (const p of roster) {
    for (const t of p.traits) {
      if (COMEBACK_DAMPENING_TRAITS.has(t)) count++;
    }
  }
  return Math.max(0, 1 - count * COMEBACK_DAMPEN_PER_TRAIT);
}

/**
 * Sum the cross-team trash_talker tilt a team imposes on its OPPONENT (D-07 /
 * Pitfall 5). Only trash_talker contributes (isOpponent=true); all other traits
 * return 0 in opponent mode, so this never doubles a holder's own-team effect.
 *
 * @param holderRoster The team CARRYING trash_talker.
 * @param oppWinProb   The OPPONENT's current win probability.
 */
function sumTrashTalkOpponentTilt(
  holderRoster: PlayerVersion[],
  oppWinProb: number,
  phaseFraction: number
): number {
  let tilt = 0;
  for (const p of holderRoster) {
    for (const t of p.traits) {
      // ONLY trash_talker is a cross-team trait. Restrict the opponent-tilt sum
      // to it explicitly — every other trait keys off winProb in playerTrait-
      // SwingBias regardless of the isOpponent flag, so without this guard a
      // behind-trait on the holder would leak into the opponent-tilt term and
      // invert the holder's own effect (the bug found in calibration).
      if (t !== "trash_talker") continue;
      tilt += playerTraitSwingBias(t, oppWinProb, phaseFraction, true);
    }
  }
  return tilt;
}

// ---------------------------------------------------------------------------
// Internal helpers — champion-trait event weighting (SIM-06 / D-04)
// ---------------------------------------------------------------------------

/** The five champion traits, used to tally per-team trait density. */
const CHAMPION_TRAITS: ChampionTrait[] = [
  "high_first_blood",
  "objective_control",
  "late_scaling",
  "early_dominant",
  "teamfight",
];

/**
 * Per-team champion-trait density: for each ChampionTrait, how many of the
 * team's picked champions carry it. Built from the team's championId map and a
 * championId→traits lookup. A championId with no catalogue entry contributes
 * nothing and does NOT throw (Pitfall 7 — trait-neutral on missing IDs).
 *
 * @param championMap  playerId→championId for this team (userChampions/rivalChampions).
 * @param lookup       championId→ChampionTrait[] built from the catalogue (empty when absent).
 */
function countTeamChampionTraits(
  championMap: Record<string, string>,
  lookup: Map<string, ChampionTrait[]>
): Record<ChampionTrait, number> {
  const counts: Record<ChampionTrait, number> = {
    high_first_blood: 0,
    objective_control: 0,
    late_scaling: 0,
    early_dominant: 0,
    teamfight: 0,
  };
  for (const championId of Object.values(championMap)) {
    // Missing ID → undefined → trait-neutral (Pitfall 7), never a crash.
    const traits = lookup.get(championId);
    if (!traits) continue;
    for (const t of traits) {
      counts[t] += 1;
    }
  }
  return counts;
}

/**
 * Build a championId→traits lookup from an optional champion catalogue.
 * Absent catalogue → empty map → every champion is trait-neutral (Pitfall 7).
 */
function buildChampionLookup(
  catalogue: ChampionEntry[] | undefined
): Map<string, ChampionTrait[]> {
  const lookup = new Map<string, ChampionTrait[]>();
  if (!catalogue) return lookup;
  for (const entry of catalogue) {
    lookup.set(entry.id, entry.traits);
  }
  return lookup;
}

/**
 * Net champion-trait event-weight advantage for an event type, expressed as a
 * signed log-ratio in the USER's frame (+ favors the user, - favors the rival).
 *
 * For the given event type, the user team's density-scaled multiplier
 * (championTraitEventWeight summed across the five traits) is compared to the
 * rival's. A user multiplier > rival multiplier tilts the event toward the user.
 * Using log keeps the combination symmetric (a 1.4× user boost and a 1.4× rival
 * boost cancel) and bounded for the small swing-bias nudge below.
 *
 * Returns 0 when neither team has any matching champion trait for this event —
 * the no-catalogue / trait-neutral case (Pitfall 7), preserving determinism and
 * the Plan-02/03 calibration when no catalogue is passed.
 */
function championTraitEventAdvantage(
  eventType: EventType,
  userCounts: Record<ChampionTrait, number>,
  rivalCounts: Record<ChampionTrait, number>
): number {
  let userWeight = 1;
  let rivalWeight = 1;
  for (const trait of CHAMPION_TRAITS) {
    userWeight *= championTraitEventWeight(trait, eventType, userCounts[trait]);
    rivalWeight *= championTraitEventWeight(trait, eventType, rivalCounts[trait]);
  }
  if (userWeight === rivalWeight) return 0;
  return Math.log(userWeight / rivalWeight);
}

// ---------------------------------------------------------------------------
// Internal helpers — closeness, duration, events
// ---------------------------------------------------------------------------

/**
 * Closeness in [0, 1]: 1 = perfectly even; 0 = complete stomp.
 * Drives duration variance and epic event selection (D-10).
 * Phase 3 calibrates: replace linear decay with sigmoid and tune STOMP_DIFF.
 */
function computeCloseness(userComposite: number, rivalComposite: number): number {
  const diff = Math.abs(userComposite - rivalComposite);
  return Math.max(0, 1 - diff / STOMP_DIFF);
}

/**
 * Pre-match win probability baseline derived from composite score ratio.
 * Used to anchor win probability updates so they don't pin early (Pitfall 6).
 */
function computeBaseline(userComposite: number, rivalComposite: number): number {
  // Sigmoid mapping of the composite-score differential to win probability
  // (D-08). With k=3, STOMP_DIFF=40 a ~25pt gap → baseline ~0.78-0.87, which
  // anchors a dominant team to ~85% wins; an even matchup → 0.5.
  const diff = (userComposite - rivalComposite) / STOMP_DIFF;
  return 1 / (1 + Math.exp(-WIN_PROB_SIGMOID_K * diff));
}

/**
 * Total playback duration in ms.
 * Close games run longer (up to DURATION_MAX_MULT × preset); stomps shorter (DURATION_MIN_MULT ×).
 * Phase 3 calibrates multiplier constants (D-09/D-10/D-11).
 */
function computeDurationMs(
  presetMs: number,
  closeness: number,
  rng: () => number
): number {
  const variance = (rng() - 0.5) * 0.2; // ±10% noise
  const closenessMultiplier =
    DURATION_MIN_MULT + closeness * (DURATION_MAX_MULT - DURATION_MIN_MULT);
  return Math.round(presetMs * closenessMultiplier * (1 + variance));
}

/**
 * Select which epic events appear in the timeline (D-10/D-15).
 * Baron and elder_dragon appear only in close games.
 * Phase 3 calibrates thresholds and probability curves.
 */
function selectEpicEvents(closeness: number, rng: () => number): EventType[] {
  const epics: EventType[] = [];
  if (closeness > EPIC_EVENT_CLOSENESS_THRESHOLD && rng() < closeness) {
    epics.push("baron");
  }
  if (closeness > ELDER_DRAGON_THRESHOLD && rng() < (closeness - 0.3)) {
    epics.push("elder_dragon");
  }
  return epics;
}

// ---------------------------------------------------------------------------
// Internal helpers — event timeline construction
// ---------------------------------------------------------------------------

/**
 * Build the full timestamped event timeline.
 *
 * Structure (SIM-03 + D-15):
 * - Always starts with first_blood
 * - Always ends with gg
 * - Middle: 2-4 dragon/dragon_steal/inhibitor events
 * - Epic events (baron, elder_dragon) inserted in mid-to-late window if selected
 *
 * Timestamps:
 * - gameTimeMs: linear mapping from playback position to 0–35 min game clock
 * - playbackMs: real-world playback position within totalPlaybackMs
 *
 * winProbAfter: anchored to baseline, updated incrementally so it does not
 * pin to 0/1 before the final event (Pitfall 6 mitigation).
 */
function buildEventTimeline(
  totalPlaybackMs: number,
  epicEvents: EventType[],
  baseline: number,
  closeness: number,
  chaosLevel: number,
  userRoster: PlayerVersion[],
  rivalRoster: PlayerVersion[],
  userChampionTraitCounts: Record<ChampionTrait, number>,
  rivalChampionTraitCounts: Record<ChampionTrait, number>,
  rng: () => number
): GameEvent[] {
  const events: GameEvent[] = [];

  // --- Choose middle events ---
  // Champion traits bias WHICH middle event types fire (SIM-06 / D-04): a team
  // heavy in objective_control/teamfight sees more dragon/baron/dragon_steal.
  // The combined (user+rival) density-scaled weights tilt the regular-event
  // pool selection; with no catalogue this is a no-op (weights all 1.0).
  const middleCount = 2 + Math.floor(rng() * 3); // 2, 3, or 4 middle events
  const middleEventTypes = chooseMiddleEvents(
    middleCount,
    epicEvents,
    userChampionTraitCounts,
    rivalChampionTraitCounts,
    rng
  );

  // Total event count = first_blood + middle + gg
  const allTypes: EventType[] = ["first_blood", ...middleEventTypes, "gg"];
  const eventCount = allTypes.length;

  // --- Distribute timestamps ---
  // first_blood in the first 20% of game time
  // gg is at exactly totalPlaybackMs
  // middle events spread between 20% and 90%

  const playbackPositions = distributeTimestamps(eventCount, totalPlaybackMs, rng);

  // --- Compute win probability for each event (SIM-07) ---
  // Baseline anchoring: probability starts near baseline and shifts with events.
  // Each event can swing the probability by a small amount; the game phase
  // (time position) determines how much the baseline "fades" into event momentum.

  let currentProb = baseline;

  for (let i = 0; i < eventCount; i++) {
    const type = allTypes[i];
    const playbackMs = playbackPositions[i];
    const isLast = i === eventCount - 1;

    // Game phase fraction [0, 1] — how far through the game we are
    const phaseFraction = playbackMs / totalPlaybackMs;

    // Win probability update:
    // - Each event slightly shifts probability toward the winning direction
    // - Magnitude varies by event importance and phase position
    // - The final event (gg) locks in the winner
    currentProb = updateWinProbability(
      currentProb,
      baseline,
      type,
      phaseFraction,
      isLast,
      closeness,
      chaosLevel,
      userRoster,
      rivalRoster,
      userChampionTraitCounts,
      rivalChampionTraitCounts,
      rng
    );

    events.push({
      gameTimeMs: playbackMsToGameTimeMs(playbackMs, totalPlaybackMs),
      playbackMs,
      type,
      team: currentProb > 0.5 ? "user" : "rival",
      winProbAfter: currentProb,
    });
  }

  return events;
}

/**
 * Choose middle events (between first_blood and gg).
 * Always includes some dragons; inserts epic events in the late window.
 *
 * Champion-trait event weighting (SIM-06 / D-04): each regular-pool candidate's
 * base weight is multiplied by the COMBINED density-scaled champion-trait
 * multiplier of both teams for that event type, then the slot is drawn from the
 * renormalized distribution via the seeded rng. With no catalogue every weight
 * is 1.0, so this reduces to a uniform draw and the timeline is unchanged
 * (determinism + calibration preserved, Pitfall 7).
 */
function chooseMiddleEvents(
  count: number,
  epicEvents: EventType[],
  userChampionTraitCounts: Record<ChampionTrait, number>,
  rivalChampionTraitCounts: Record<ChampionTrait, number>,
  rng: () => number
): EventType[] {
  // Distinct candidate event types for the regular pool, with base weights that
  // reproduce the previous pool composition (dragon ×3, dragon_steal ×1,
  // inhibitor ×1) when no champion traits apply.
  const regularCandidates: { type: EventType; baseWeight: number }[] = [
    { type: "dragon", baseWeight: 3 },
    { type: "dragon_steal", baseWeight: 1 },
    { type: "inhibitor", baseWeight: 1 },
  ];

  const chosen: EventType[] = [];

  // Place epics first (they go in the late window but we sort by time later)
  for (const epic of epicEvents) {
    chosen.push(epic);
  }

  // Fill remaining slots with champion-trait-weighted draws (renormalized).
  const remaining = Math.max(0, count - chosen.length);
  for (let i = 0; i < remaining; i++) {
    const weighted = regularCandidates.map(({ type, baseWeight }) => ({
      type,
      weight: baseWeight * combinedChampionEventWeight(
        type,
        userChampionTraitCounts,
        rivalChampionTraitCounts
      ),
    }));
    chosen.push(weightedPick(weighted, rng));
  }

  return chosen;
}

/**
 * Combined (user + rival) density-scaled champion-trait multiplier for an event
 * type. Both teams' compositions raise the likelihood that a contested event
 * fires (more objective_control on the field → more dragons overall). Returns
 * 1.0 when neither team carries a matching trait — the no-catalogue no-op.
 */
function combinedChampionEventWeight(
  eventType: EventType,
  userCounts: Record<ChampionTrait, number>,
  rivalCounts: Record<ChampionTrait, number>
): number {
  let weight = 1;
  for (const trait of CHAMPION_TRAITS) {
    weight *= championTraitEventWeight(trait, eventType, userCounts[trait]);
    weight *= championTraitEventWeight(trait, eventType, rivalCounts[trait]);
  }
  return weight;
}

/**
 * Deterministic weighted pick from a list of {type, weight} using the seeded rng.
 * Weights need not be normalized. Falls back to the last candidate for any
 * floating-point remainder (never returns undefined).
 */
function weightedPick(
  candidates: { type: EventType; weight: number }[],
  rng: () => number
): EventType {
  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = rng() * total;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) return c.type;
  }
  return candidates[candidates.length - 1].type;
}

/**
 * Distribute event timestamps across the playback window.
 * first_blood is in [5%, 20%]; gg is at 100%; middle events spread in [20%, 90%].
 */
function distributeTimestamps(
  eventCount: number,
  totalPlaybackMs: number,
  rng: () => number
): number[] {
  if (eventCount < 2) return [0];

  const positions: number[] = [];

  // first_blood: 5% to 20% of total
  const fbPos = Math.round(totalPlaybackMs * (0.05 + rng() * 0.15));
  positions.push(fbPos);

  // middle events: 20% to 90%, spread roughly evenly with some jitter
  const middleCount = eventCount - 2;
  if (middleCount > 0) {
    const windowStart = totalPlaybackMs * 0.20;
    const windowEnd = totalPlaybackMs * 0.90;
    const windowSize = windowEnd - windowStart;
    const step = windowSize / (middleCount + 1);

    for (let i = 0; i < middleCount; i++) {
      const jitter = (rng() - 0.5) * step * 0.5;
      const pos = Math.round(windowStart + step * (i + 1) + jitter);
      // Clamp to window
      positions.push(Math.max(fbPos + 1, Math.min(pos, Math.round(windowEnd))));
    }
  }

  // gg: at totalPlaybackMs
  positions.push(totalPlaybackMs);

  return positions;
}

/**
 * Update win probability after an event.
 *
 * Anchoring strategy (Pitfall 6 mitigation):
 * - Early game: probability stays close to baseline (high anchor weight)
 * - Late game: probability drifts more freely toward momentum
 * - Final event: commit to a definitive winner (probability crosses 0.5)
 */
function updateWinProbability(
  current: number,
  baseline: number,
  type: EventType,
  phaseFraction: number,
  isLast: boolean,
  _closeness: number,
  chaosLevel: number,
  userRoster: PlayerVersion[],
  rivalRoster: PlayerVersion[],
  userChampionTraitCounts: Record<ChampionTrait, number>,
  rivalChampionTraitCounts: Record<ChampionTrait, number>,
  rng: () => number
): number {
  if (isLast) {
    // GG event: commit winner — push decisively to the winning side
    // Probability follows the current trend but stays away from 0.5
    if (current >= 0.5) {
      return Math.min(0.95, current + 0.1 + rng() * 0.1);
    } else {
      return Math.max(0.05, current - 0.1 - rng() * 0.1);
    }
  }

  // Event momentum: each event type has a base swing magnitude
  const swingMagnitude = eventSwingMagnitude(type);

  // Situational player-trait bias (SIM-05 / D-05). Each team's own behind/ahead
  // traits read its LIVE win probability (current for the user, 1-current for the
  // rival). trash_talker crosses the boundary (D-07 / Pitfall 5): the user's
  // trash_talker tilts the rival (evaluated at the rival's winProb) and vice
  // versa — applied to the OPPONENT only via isOpponent, never doubled onto the
  // holder. Everything is expressed in the USER's win-prob frame:
  //   + helps the user, - helps the rival.
  const rivalWinProb = 1 - current;
  const userOwnBias = sumOwnTraitSwingBias(userRoster, current, phaseFraction);
  const rivalOwnBias = sumOwnTraitSwingBias(rivalRoster, rivalWinProb, phaseFraction);
  // trash_talker tilts are NEGATIVE (they hurt the targeted opponent):
  const userTrashOnRival = sumTrashTalkOpponentTilt(userRoster, rivalWinProb, phaseFraction); // hurts rival → helps user
  const rivalTrashOnUser = sumTrashTalkOpponentTilt(rivalRoster, current, phaseFraction);      // hurts user
  const netUserTraitBias =
    userOwnBias - rivalOwnBias - userTrashOnRival + rivalTrashOnUser;

  // Pro-comeback mean reversion (Pitfall 1 — directionBias REMOVED, do not coexist).
  // CRITICAL: the comeback force is computed off the ORIGINAL baseline, never the
  // trait-adjusted one. Folding the trait into the comeback's overshoot lets the
  // magnitude boost amplify a trait-induced deficit and bounce the prob off the
  // clamp into the WRONG direction (the +/- sign inversion seen in calibration).
  // Keeping comeback on the clean baseline makes the trait a pure, monotone
  // overlay the rubber-band cannot invert.
  const comebackBias = (baseline - current) * chaosLevel * COMEBACK_BIAS_GAIN;

  // Champion-trait event tilt (SIM-06 / D-04): for this event type, the team
  // whose picked champions boost it (e.g. a high_first_blood stack on first_blood,
  // an objective_control stack on dragon/baron) is more likely to win the swing.
  // championTraitEventAdvantage is a signed log-ratio in the user frame (+ favors
  // the user); the gain converts it into a coin-flip tilt. It is exactly 0 when
  // neither team carries a matching trait for this event (no catalogue passed →
  // trait-neutral, Pitfall 7), so determinism + calibration are preserved.
  const championTilt =
    championTraitEventAdvantage(
      type,
      userChampionTraitCounts,
      rivalChampionTraitCounts
    ) * CHAMPION_TRAIT_SWING_GAIN;
  const swingDirection = rng() < 0.5 + comebackBias + championTilt ? 1 : -1;

  // Magnitude boost when this swing pushes a leader back toward its baseline.
  // Scaled by chaosLevel and the over-extension so even matchups rubber-band
  // hard enough to flip a 3-event leader before gg (D-09) while favorites are
  // only pulled toward their own high baseline (D-08 tiers preserved).
  const overshoot = baseline - current; // >0 when underperforming baseline
  const revertDir = overshoot >= 0 ? 1 : -1;
  // Cap the over-extension that feeds the magnitude boost. Without this cap a
  // trait that pushes the prob to the 0.05 floor produces a |overshoot|≈0.45,
  // which the 50× gain catapults straight to 0.95 — bouncing a trait penalty
  // into a net GAIN (the sign inversion seen during calibration). The cap keeps
  // the natural comeback rubber-band (deficits up to ~0.25 still amplify) while
  // refusing to reward a trait-induced floor with a runaway bounce.
  const cappedOvershoot = Math.min(Math.abs(overshoot), 0.25);

  // Comeback dampening (SIM-05 / D-05): a team that "plays worse when behind" or
  // "tilts on death" gets a WEAKER rubber-band while it is the one trailing. The
  // dampened side is whichever team is currently behind its baseline — in
  // user-frame, overshoot>0 means the USER is underperforming, so the user's
  // dampen factor applies; overshoot<0 means the RIVAL is the one clawing back,
  // so the rival's dampen factor applies. This is the monotone, catapult-free
  // model for the negative-when-behind traits.
  const dampen =
    overshoot > 0
      ? comebackDampenFactor(userRoster, current)
      : comebackDampenFactor(rivalRoster, rivalWinProb);
  const comebackPush =
    swingDirection === revertDir
      ? 1 + chaosLevel * COMEBACK_MAGNITUDE_GAIN * cappedOvershoot * dampen
      : 1;
  const swing =
    swingMagnitude * swingDirection * (0.5 + rng() * 0.5) * comebackPush;

  // Anchor weight decreases as game progresses (early → anchored, late → free).
  const anchorWeight = Math.max(0, 1 - phaseFraction * 1.2);
  const anchored = baseline * anchorWeight + current * (1 - anchorWeight);

  // The situational trait bias (SIM-05 / criterion 2) is a monotone overlay on
  // top of the comeback-driven swing. Because the comeback above is anchored to
  // the clean baseline, this nudge persists in its own direction instead of
  // being amplified/inverted by the rubber-band. The (1 - phaseFraction*0.x)
  // taper is intentionally absent: the trait reads live winProb each event, so
  // it self-gates (behind traits only fire while behind), which is the
  // situational requirement (D-05).
  const newProb = anchored + swing + netUserTraitBias;

  // Clamp to [0.05, 0.95] — never pin to 0 or 1 before gg
  return Math.max(0.05, Math.min(0.95, newProb));
}

/** Base swing magnitude per event type. Epic events swing more. */
function eventSwingMagnitude(type: EventType): number {
  switch (type) {
    case "baron":
      return 0.12; // significant objective
    case "elder_dragon":
      return 0.15; // most impactful epic event
    case "inhibitor":
      return 0.10; // major structural advantage
    case "dragon":
      return 0.05; // standard objective
    case "dragon_steal":
      return 0.08; // impactful reversal
    case "first_blood":
      return 0.04; // early small advantage
    case "gg":
      return 0.20; // handled separately in updateWinProbability
    default:
      return 0.05;
  }
}

/**
 * Map a playback position to in-game time (linear mapping per D-12 decision).
 * Full game = 35 minutes (2_100_000 ms in-game).
 */
function playbackMsToGameTimeMs(
  playbackMs: number,
  totalPlaybackMs: number
): number {
  const GAME_DURATION_MS = 35 * 60 * 1000; // 35 minutes
  return Math.round((playbackMs / totalPlaybackMs) * GAME_DURATION_MS);
}
