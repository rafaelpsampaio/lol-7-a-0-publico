import { describe, it, expect } from "vitest";
import { gameForm } from "./gameForm";
import { makeCard } from "../../server/room/cards.fixture";
const roster = [makeCard({id:"a",personId:"a",primaryRole:"top",forca:65}),makeCard({id:"b",personId:"b",primaryRole:"mid",forca:65})];
describe("forma por partida",()=>{
 it("é reproduzível, varia com a seed e não muda as cartas cadastradas",()=>{
  const before=structuredClone(roster);
  expect(gameForm(roster,1,0.25)).toEqual(gameForm(roster,1,0.25));
  expect(gameForm(roster,1,0.25)).not.toEqual(gameForm(roster,2,0.25));
  expect(roster).toEqual(before);
 });
 it("independe da ordem do elenco e não favorece um lado fixo",()=>{
  expect(gameForm([...roster].reverse(),42,0.25).reverse()).toEqual(gameForm(roster,42,0.25));
 });
 it("mantém notas válidas e distribui dias bons e ruins sem direção fixa",()=>{
  const deltas=Array.from({length:400},(_,seed)=>gameForm(roster,seed,0.25)[0].lanePhase-roster[0].lanePhase);
  expect(Math.min(...deltas)).toBeLessThan(-10);expect(Math.max(...deltas)).toBeGreaterThan(10);
  expect(Math.abs(deltas.reduce((a,b)=>a+b,0)/deltas.length)).toBeLessThan(2);
  for(let seed=0;seed<100;seed++)for(const p of gameForm(roster,seed,1))for(const n of [p.lanePhase,p.midGame,p.lateGame])expect(n).toBeGreaterThanOrEqual(1);
 });
 it("mais caos amplia a variação",()=>{
  const spread=(c:number)=>Array.from({length:200},(_,seed)=>Math.abs(gameForm(roster,seed,c)[0].lanePhase-roster[0].lanePhase)).reduce((a,b)=>a+b,0);
  expect(spread(1)).toBeGreaterThan(spread(0));
 });
});


it("limita notas altas e baixas sem alterar os dados originais",()=>{
 for(const value of [1,100])for(let seed=0;seed<50;seed++){
  const original=roster.map(p=>({...p,lanePhase:value,midGame:value,lateGame:value}));
  for(const p of gameForm(original,seed,1))for(const n of [p.lanePhase,p.midGame,p.lateGame]){
   expect(n).toBeGreaterThanOrEqual(1);expect(n).toBeLessThanOrEqual(100);
  }
 }
});
