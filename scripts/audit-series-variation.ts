/** Read-only audit. Usage: node --import tsx scripts/audit-series-variation.ts [snapshot] [--legacy] */
﻿import {readFileSync} from 'node:fs';
import {rosterRating} from '../src/sim/power.ts';
import {runSeriesGame} from '../src/tournament/series.ts';
const snapshotPath = process.argv.slice(2).find(arg => !arg.startsWith("--")) ?? "server/data/room.json";
const saved=JSON.parse(readFileSync(snapshotPath,'utf8')).tournament;
for(const id of ['UB_QF_1','UB_QF_2','UB_QF_3','UB_QF_4'] as const){
 const source=saved.bracket.slots[id].series;const a=saved.bracket.teams[source.teamAId],b=saved.bracket.teams[source.teamBId];let sweep=0;const scores:Record<string,number>={};
 for(let n=0;n<50;n++){const s={...source,games:[],wins:{},fearlessUsed:{}} as any;const state={...saved.bracket,seed:n,slots:{...saved.bracket.slots,[id]:{...saved.bracket.slots[id],series:s}}};
 while(Math.max(0,...Object.values(s.wins) as number[])<3){const game=runSeriesGame(state,id,saved.chaosLevel,[],process.argv.includes("--legacy") ? 0 : 1);s.games.push(game);s.wins[game.winnerId]=(s.wins[game.winnerId]??0)+1;}
 if(s.games.length===3)sweep++;const score=Object.values(s.wins).sort().join('-');scores[score]=(scores[score]??0)+1;}
 console.log({id,ratings:[rosterRating(a.roster),rosterRating(b.roster)].map(Math.round),sweeps:sweep,series:50,scores});
}
