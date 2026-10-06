/** Read-only audit of full tournaments using the real match engine.
 * Usage: npx tsx scripts/audit-lower-comeback.ts [snapshot] [count]
 */
import { readFileSync } from "node:fs";
import { createTournament, advanceSlot } from "../src/tournament/bracket";
import { runSeriesGame, seriesWinnerId, fearlessUsedAfter } from "../src/tournament/series";
import { SlotIdSchema, type TournamentState } from "../src/tournament/schema";
import { makeCard } from "../server/room/cards.fixture";

const path = process.argv[2];
const count = Number(process.argv[3] ?? 50);
if (!Number.isInteger(count) || count < 1) throw new Error("count must be a positive integer");
const saved = path && path !== "--synthetic" ? JSON.parse(readFileSync(path, "utf8")).tournament : null;
if (path && path !== "--synthetic" && !saved) throw new Error("Snapshot has no active tournament; use --synthetic for test rosters");
const teams = saved ? Object.values((saved.bracket as TournamentState).teams) : Array.from({ length: 8 }, (_, i) => ({
  id: i === 0 ? "user" : `bot-${i}`, isUser: i === 0, displayName: `Team ${i}`,
  roster: (["top", "jungle", "mid", "adc", "support"] as const).map(role => ({
    ...makeCard({ id: `${i}-${role}`, personId: `${i}-${role}`, primaryRole: role, forca: 55 + i * 3 }),
    lanePhase: 55 + i * 3, midGame: 55 + i * 3, lateGame: 55 + i * 3,
  })),
}));
let lowerChampions = 0;
const earlyComebackSeeds: number[] = [];
for (let seed = 0; seed < count; seed++) {
  let state = createTournament(seed, teams);
  const earlyLosers = new Set<string>();
  while (state.status !== "complete") {
    const slot = SlotIdSchema.options.find(id => state.slots[id].series.status === "ready");
    if (!slot) throw new Error(`Tournament stalled at seed ${seed}`);
    const series = state.slots[slot].series;
    while (!seriesWinnerId(series)) {
      const game = runSeriesGame(state, slot, saved?.chaosLevel ?? 0.25, []);
      series.fearlessUsed = fearlessUsedAfter(series, game);
      series.games.push(game);
      series.wins[game.winnerId] = (series.wins[game.winnerId] ?? 0) + 1;
    }
    const winner = seriesWinnerId(series)!;
    const loser = winner === series.teamAId ? series.teamBId! : series.teamAId!;
    if (slot.startsWith("UB_QF")) earlyLosers.add(loser);
    state = advanceSlot(state, slot, winner, loser);
  }
  if (state.championId === state.slots.LB_F.series.winnerId) lowerChampions++;
  if (earlyLosers.has(state.championId!)) earlyComebackSeeds.push(seed);
  if ((seed + 1) % 10 === 0) console.log({ completed: seed + 1, lowerChampions, earlyComebacks: earlyComebackSeeds.length });
}
console.log(JSON.stringify({ tournaments: count, lowerChampions, earlyComebacks: earlyComebackSeeds.length, earlyComebackSeeds }, null, 2));
