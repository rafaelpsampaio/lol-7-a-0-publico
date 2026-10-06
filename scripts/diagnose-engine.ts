/**
 * scripts/diagnose-engine.ts
 *
 * Harness de diagnostico amplo da engine (Fase 23 / INST-02 + INST-04).
 * Executar: npx vitest run -c vitest.diagnose.config.ts
 * (o script npm "diagnose" entra no package.json no Plano 23-06)
 *
 * Roda milhares de partidas deterministicas em cinco cenarios e imprime um
 * panorama amplo de metricas para comparacao com referencias de pro play.
 * Relatorio escrito em docs/diagnostics/engine-diagnose.txt, caminho rastreado
 * pelo git: existe em todo clone e o drift entre fases aparece como diff.
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = i por partida, nunca seed compartilhada
 *   - Sem Math.random: apenas mulberry32(seed)
 *   - Este arquivo NAO CONTEM NENHUMA ASSERCAO por design: e relatorio, nao
 *     gate. Os asserts de aceite vivem em scripts/calibrate-pace.ts (Plano
 *     23-04), separacao de responsabilidade descrita em scripts/README.md
 *     secao 4 ("Dois tipos de artefato, nunca misturados")
 *   - Relatorio pt-BR sem o caractere travessao
 *
 * Migrado de tmp/diagnose.test.ts (arquivo ad-hoc, gitignorado). Duas
 * mudancas de comportamento em relacao a origem, registradas aqui porque
 * comparar os dois relatorios linha a linha sem saber disso da resultado
 * errado:
 *
 *   1. Percentil: tmp/diagnose.test.ts:248-252 usava indexacao por piso
 *      (floor(q*n)). Este arquivo usa scripts/stats.ts, metodo canonico do
 *      projeto (indice arredondado sobre n-1, DEC-04). Os valores de p5,
 *      p25, p50, p75 e p95 aqui NAO SAO comparaveis linha a linha com o
 *      antigo tmp/diagnostic-report.txt: o metodo de calculo mudou, nao a
 *      engine.
 *   2. Cenario E (impacto de jogador unico) rodava as mesmas 600 sementes
 *      duas vezes: uma para o acumulador, outra so para reextrair K/D/A do
 *      jogador reforcado. Aqui e uma passada unica: mesmo resultado, um
 *      terco menos custo.
 */

import { describe, it } from "vitest";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES } from "../src/sim/matchState";
import type { PlayerVersion, Role } from "../src/data/schema";
import type { SimulationResult } from "../src/sim/engine";
import { summarize, ci95, shareWhere, BC_UNIMODAL_THRESHOLD } from "./stats";

const OUT: string[] = [];
function p(s = ""): void {
  OUT.push(s);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlayer(id: string, role: Role, stat: number): PlayerVersion {
  return {
    id,
    personId: id,
    displayName: `${id} 2024`,
    year: 2024,
    roles: [role],
    primaryRole: role,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: stat },
    lanePhase: stat,
    midGame: stat,
    lateGame: stat,
    traits: [],
    championPool: Array.from({ length: 8 }, (_, i) => ({
      championId: `c${i}`,
      mastery: 3 as const,
    })),
  };
}

function flatRoster(prefix: string, stat: number): PlayerVersion[] {
  return ROLES.map((r) => makePlayer(`${prefix}-${r}`, r, stat));
}

// Rosters reais de public/players.json (4 por role)
const REAL: PlayerVersion[] = JSON.parse(
  readFileSync("public/players.json", "utf-8")
).players;

const REAL_BY_ROLE: Record<Role, PlayerVersion[]> = Object.fromEntries(
  ROLES.map((r) => [r, REAL.filter((pl) => pl.primaryRole === r)])
) as Record<Role, PlayerVersion[]>;

/** Monta 2 times reais disjuntos a partir de uma seed (sem repetir personId). */
function realTeams(seed: number): [PlayerVersion[], PlayerVersion[]] {
  const rng = mulberry32(seed * 7919 + 13);
  const a: PlayerVersion[] = [];
  const b: PlayerVersion[] = [];
  for (const role of ROLES) {
    const pool = [...REAL_BY_ROLE[role]];
    const i = Math.floor(rng() * pool.length);
    a.push(pool.splice(i, 1)[0]);
    const j = Math.floor(rng() * pool.length);
    b.push(pool.splice(j, 1)[0]);
  }
  return [a, b];
}

// ---------------------------------------------------------------------------
// Coletor
// ---------------------------------------------------------------------------

interface Acc {
  n: number;
  userWins: number;
  durations: number[];
  totalKills: number[];
  winnerKills: number[];
  loserKills: number[];
  winnerTowers: number[];
  loserTowers: number[];
  winnerDragons: number[];
  loserDragons: number[];
  winnerGold: number[];
  loserGold: number[];
  barons: number[];
  soulGames: number;
  baronGames: number;
  elderGames: number;
  heraldGames: number;
  inhibWinner: number[];
  firstBlood: number[];
  firstTower: number[];
  events: number[];
  // por role (soma dos dois lados)
  k: Record<Role, number>;
  d: Record<Role, number>;
  a: Record<Role, number>;
  // kill share por role (fracao do total do proprio time, media por jogo)
  killShare: Record<Role, number>;
  maxPlayerKills: number[];
  gamesWithA10KillPlayer: number;
  gamesWithA15KillPlayer: number;
  gamesWithDeathless: number;
  gamesWithZeroKillPlayer: number;
  // multikills
  doubles: number;
  triples: number;
  quadras: number;
  pentas: number;
  aces: number;
  // pacing: kills por janela de tempo
  killsEarly: number; // < 15 min
  killsMid: number; // 15-25
  killsLate: number; // > 25
  // violacoes
  vBaronPre20: number;
  vTowerPre5: number;
  vMultiPre8: number;
  vAcePre8: number;
  // comeback / stomp
  stomps: number;
  comebacks: number;
  balanced: number;
}

function emptyAcc(): Acc {
  const zr = () => Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  return {
    n: 0, userWins: 0, durations: [], totalKills: [], winnerKills: [], loserKills: [],
    winnerTowers: [], loserTowers: [], winnerDragons: [], loserDragons: [],
    winnerGold: [], loserGold: [], barons: [], soulGames: 0, baronGames: 0,
    elderGames: 0, heraldGames: 0, inhibWinner: [], firstBlood: [], firstTower: [],
    events: [], k: zr(), d: zr(), a: zr(), killShare: zr(), maxPlayerKills: [],
    gamesWithA10KillPlayer: 0, gamesWithA15KillPlayer: 0, gamesWithDeathless: 0,
    gamesWithZeroKillPlayer: 0,
    doubles: 0, triples: 0, quadras: 0, pentas: 0, aces: 0,
    killsEarly: 0, killsMid: 0, killsLate: 0,
    vBaronPre20: 0, vTowerPre5: 0, vMultiPre8: 0, vAcePre8: 0,
    stomps: 0, comebacks: 0, balanced: 0,
  };
}

/**
 * Coleta o resultado de uma partida no acumulador. `boosted`, quando
 * informado, tambem extrai K/D/A e kill-share do jogador reforcado do lado
 * user naquele role, na MESMA passada (elimina a dupla simulacao do cenario
 * E que existia em tmp/diagnose.test.ts).
 */
function collect(
  res: SimulationResult,
  acc: Acc,
  boosted?: { role: Role; sink: { k: number; d: number; a: number; share: number } }
): void {
  acc.n++;
  if (res.winner === "user") acc.userWins++;
  acc.durations.push(res.durationSec);
  acc.events.push(res.timeline.length);

  const W = res.finalState[res.winner];
  const L = res.finalState[res.winner === "user" ? "rival" : "user"];

  acc.totalKills.push(W.kills + L.kills);
  acc.winnerKills.push(W.kills);
  acc.loserKills.push(L.kills);
  acc.winnerTowers.push(W.towersDestroyed);
  acc.loserTowers.push(L.towersDestroyed);
  acc.winnerDragons.push(W.dragons.length);
  acc.loserDragons.push(L.dragons.length);
  acc.winnerGold.push(W.gold);
  acc.loserGold.push(L.gold);
  acc.barons.push(W.baronsTaken + L.baronsTaken);
  acc.inhibWinner.push(W.inhibitorsDestroyed);
  if (W.soul || L.soul) acc.soulGames++;
  if (W.baronsTaken + L.baronsTaken > 0) acc.baronGames++;
  if (W.elderCount + L.elderCount > 0) acc.elderGames++;
  if (W.heraldTaken || L.heraldTaken) acc.heraldGames++;

  if (boosted) {
    const pl = res.finalState.user.players[boosted.role];
    boosted.sink.k += pl.kills;
    boosted.sink.d += pl.deaths;
    boosted.sink.a += pl.assists;
    boosted.sink.share += pl.kills / (res.finalState.user.kills || 1);
  }

  let maxK = 0;
  let deathless = false;
  let zeroKill = false;
  for (const side of ["user", "rival"] as const) {
    const T = res.finalState[side];
    const teamKills = T.kills || 1;
    for (const role of ROLES) {
      const pl = T.players[role];
      acc.k[role] += pl.kills;
      acc.d[role] += pl.deaths;
      acc.a[role] += pl.assists;
      acc.killShare[role] += pl.kills / teamKills;
      maxK = Math.max(maxK, pl.kills);
      if (pl.deaths === 0) deathless = true;
      if (pl.kills === 0) zeroKill = true;
    }
  }
  acc.maxPlayerKills.push(maxK);
  if (maxK >= 10) acc.gamesWithA10KillPlayer++;
  if (maxK >= 15) acc.gamesWithA15KillPlayer++;
  if (deathless) acc.gamesWithDeathless++;
  if (zeroKill) acc.gamesWithZeroKillPlayer++;

  let fb = -1;
  let ft = -1;
  let winnerMin = 1;
  for (const ev of res.timeline) {
    const wp = res.winner === "user" ? ev.winProbUserAfter : 1 - ev.winProbUserAfter;
    winnerMin = Math.min(winnerMin, wp);

    const t = ev.timeSec;
    if (ev.kind === "first_blood" && fb < 0) fb = t;
    if ((ev.kind === "first_tower" || ev.kind === "tower_destroyed") && ft < 0) ft = t;

    switch (ev.kind) {
      case "double_kill": acc.doubles++; break;
      case "triple_kill": acc.triples++; if (t < 480) acc.vMultiPre8++; break;
      case "quadra_kill": acc.quadras++; if (t < 480) acc.vMultiPre8++; break;
      case "penta_kill": acc.pentas++; if (t < 480) acc.vMultiPre8++; break;
      case "ace": acc.aces++; if (t < 480) acc.vAcePre8++; break;
      case "baron_taken":
      case "baron_steal":
        if (t < 1200) acc.vBaronPre20++;
        break;
      case "tower_destroyed":
      case "first_tower":
        if (t < 300) acc.vTowerPre5++;
        break;
    }

    // pacing por janela (conta eventos de abate)
    const isKill =
      ev.kind === "kill" || ev.kind === "first_blood" || ev.kind === "solo_kill" ||
      ev.kind === "gank" || ev.kind === "dive" || ev.kind === "shutdown" ||
      ev.kind.startsWith("ctx_");
    if (isKill) {
      if (t < 900) acc.killsEarly++;
      else if (t < 1500) acc.killsMid++;
      else acc.killsLate++;
    }
  }
  if (fb >= 0) acc.firstBlood.push(fb);
  if (ft >= 0) acc.firstTower.push(ft);

  if (winnerMin >= 0.42) acc.stomps++;
  else if (winnerMin < 0.32) acc.comebacks++;
  else acc.balanced++;
}

// ---------------------------------------------------------------------------
// Formatacao
// ---------------------------------------------------------------------------

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const pc = (num: number, den: number) => `${((num / den) * 100).toFixed(1)}%`;
const f2 = (x: number) => x.toFixed(2);
const int0 = (x: number) => String(Math.round(x));

/**
 * Bloco estatistico completo de uma metrica: media, desvio, p5/p25/p50/p75/
 * p95, IC95 da media e coeficiente de bimodalidade (INST-04). Toda metrica
 * numerica com serie por partida no acumulador passa por aqui em vez de
 * media/percentil calculados a mao: unica fonte e scripts/stats.ts.
 */
function fmtStat(a: readonly number[], toStr: (x: number) => string = f2): string {
  const s = summarize(a);
  const ic = ci95(a);
  const bcTxt = s.bc === null
    ? "n/d"
    : `${s.bc.toFixed(3)} (${s.bc <= BC_UNIMODAL_THRESHOLD ? "unimodal" : "bimodal ou multimodal"})`;
  return (
    `media ${toStr(s.mean)} | dp ${toStr(s.sd)} | ` +
    `p5 ${toStr(s.p5)} p25 ${toStr(s.p25)} p50 ${toStr(s.p50)} p75 ${toStr(s.p75)} p95 ${toStr(s.p95)} | ` +
    `IC95 [${toStr(ic.lower)}, ${toStr(ic.upper)}] | bc (limiar bimodal ${BC_UNIMODAL_THRESHOLD.toFixed(4)}) ${bcTxt}`
  );
}

function report(title: string, acc: Acc): void {
  const n = acc.n;
  p();
  p(`==================================================================`);
  p(`  ${title}  (N=${n})`);
  p(`==================================================================`);
  p();
  p(`  MACRO`);
  p(`    win-rate lado user ....... ${pc(acc.userWins, n)}`);
  p(`    duracao .................. ${fmtStat(acc.durations, mmss)}`);
  p(`    duracao min/max .......... ${mmss(Math.min(...acc.durations))} / ${mmss(Math.max(...acc.durations))}`);
  p(`    jogos < 20 min ........... ${pc(acc.durations.filter((d) => d < 1200).length, n)}`);
  p(`    jogos > 40 min ........... ${pc(acc.durations.filter((d) => d > 2400).length, n)}`);
  p(`    eventos por jogo ......... ${fmtStat(acc.events, f2)}`);
  p(`    eventos/min (sobre media)  ${f2(mean(acc.events) / (mean(acc.durations) / 60))}`);
  p();
  p(`  PLACAR`);
  p(`    kills totais/jogo ........ ${fmtStat(acc.totalKills, f2)}`);
  p(`    kills vencedor ........... ${fmtStat(acc.winnerKills, f2)}`);
  p(`    kills perdedor ........... ${fmtStat(acc.loserKills, f2)}`);
  p(`    kills por minuto ......... ${f2(mean(acc.totalKills) / (mean(acc.durations) / 60))}`);
  p(`    distribuicao temporal .... <15min ${pc(acc.killsEarly, acc.killsEarly + acc.killsMid + acc.killsLate)} | 15-25min ${pc(acc.killsMid, acc.killsEarly + acc.killsMid + acc.killsLate)} | >25min ${pc(acc.killsLate, acc.killsEarly + acc.killsMid + acc.killsLate)}`);
  p();
  p(`  ESTRUTURAS E OBJETIVOS`);
  p(`    torres vencedor ........... ${fmtStat(acc.winnerTowers, f2)}`);
  p(`    torres perdedor ........... ${fmtStat(acc.loserTowers, f2)}`);
  p(`    inibidores do vencedor .... ${fmtStat(acc.inhibWinner, f2)}`);
  p(`    dragoes vencedor ........... ${fmtStat(acc.winnerDragons, f2)}`);
  p(`    dragoes perdedor ........... ${fmtStat(acc.loserDragons, f2)}`);
  p(`    jogos com Alma ............ ${pc(acc.soulGames, n)}`);
  p(`    baroes por jogo ............ ${fmtStat(acc.barons, f2)}`);
  p(`    jogos com >=1 Baron ........ ${pc(acc.baronGames, n)}`);
  p(`    jogos com Elder ............ ${pc(acc.elderGames, n)}`);
  p(`    jogos com Arauto ........... ${pc(acc.heraldGames, n)}`);
  p(`    ouro final vencedor ........ ${fmtStat(acc.winnerGold, int0)}`);
  p(`    ouro final perdedor ........ ${fmtStat(acc.loserGold, int0)}`);
  p(`    diferenca de ouro .......... ${int0(mean(acc.winnerGold) - mean(acc.loserGold))}`);
  p(`    ouro/min por time .......... ${int0(((mean(acc.winnerGold) + mean(acc.loserGold)) / 2) / (mean(acc.durations) / 60))}`);
  p();
  p(`  TIMINGS`);
  p(`    first blood ................ ${fmtStat(acc.firstBlood, mmss)}  [jogos com FB: ${pc(acc.firstBlood.length, n)}]`);
  p(`    primeira torre .............. ${fmtStat(acc.firstTower, mmss)}`);
  p();
  p(`  MICRO POR ROLE (soma dos 2 lados / jogo, agregado, sem serie por partida)`);
  p(`    role        K      D      A     KDA    kill-share   KP-proxy`);
  const totalK = ROLES.reduce((s, r) => s + acc.k[r], 0);
  for (const role of ROLES) {
    const K = acc.k[role] / n;
    const D = acc.d[role] / n;
    const A = acc.a[role] / n;
    const kda = D > 0 ? (K + A) / D : K + A;
    const share = acc.killShare[role] / (n * 2); // media por time
    p(`    ${role.padEnd(10)} ${f2(K).padStart(5)}  ${f2(D).padStart(5)}  ${f2(A).padStart(5)}  ${f2(kda).padStart(5)}   ${(share * 100).toFixed(1).padStart(6)}%     ${f2((K + A) / (mean(acc.totalKills) / 2))}`);
  }
  p(`    (kill-share = fracao das kills do proprio time; soma dos 5 = 100%)`);
  p(`    share global por role: ${ROLES.map((r) => `${r} ${((acc.k[r] / totalK) * 100).toFixed(1)}%`).join(" | ")}`);
  p();
  p(`  OUTLIERS INDIVIDUAIS`);
  p(`    max kills de 1 jogador ..... ${fmtStat(acc.maxPlayerKills, f2)}`);
  p(`    jogos c/ alguem >=10 kills . ${pc(acc.gamesWithA10KillPlayer, n)}`);
  p(`    jogos c/ alguem >=15 kills . ${pc(acc.gamesWithA15KillPlayer, n)}`);
  p(`    jogos c/ alguem 0 mortes ... ${pc(acc.gamesWithDeathless, n)}`);
  p(`    jogos c/ alguem 0 kills .... ${pc(acc.gamesWithZeroKillPlayer, n)}`);
  p();
  p(`  MULTIKILLS / RITMO DE LUTA (por jogo, agregado)`);
  p(`    double ${f2(acc.doubles / n)} | triple ${f2(acc.triples / n)} | quadra ${f2(acc.quadras / n)} | penta ${f2(acc.pentas / n)} | ace ${f2(acc.aces / n)}`);
  p();
  p(`  DINAMICA`);
  p(`    stomp / equilibrado / comeback: ${pc(acc.stomps, n)} / ${pc(acc.balanced, n)} / ${pc(acc.comebacks, n)}`);
  p();
  p(`  VIOLACOES DE PLAUSIBILIDADE (total absoluto em ${n} jogos)`);
  p(`    Baron < 20min ............ ${acc.vBaronPre20}`);
  p(`    torre < 5min .............. ${acc.vTowerPre5}`);
  p(`    triple+ < 8min ............ ${acc.vMultiPre8}`);
  p(`    ace < 8min ................ ${acc.vAcePre8}`);
}

/**
 * Bloco de metricas derivadas OBSERVADAS contra a banda de aceite final do
 * cenario equilibrado 75x75 (fonte: STACK.md secao 7). Somente texto, nunca
 * assercao: sao metricas derivadas de taxa, e dar meta propria a elas e o
 * double-counting que a v2.0 cometeu (ROADMAP.md, "Invariantes e Gates
 * Permanentes (v2.2)"; REQUIREMENTS.md, "Principio de escopo desta
 * milestone"). As alavancas legitimas da milestone sao as TAXAS (torres por
 * minuto, abates por minuto, ouro por minuto), gateadas em calibrate:pace
 * (Plano 23-04), nao os totais absolutos observados aqui.
 */
function observedMetricsBlock(acc: Acc): void {
  const n = acc.n;
  const durMin = mean(acc.durations) / 60;
  const shareAtCap = shareWhere(acc.durations, (d) => d >= 3600);
  const shareBelow25 = shareWhere(acc.durations, (d) => d < 1500);
  const shareAbove45 = shareWhere(acc.durations, (d) => d > 2700);
  const killsPerGame = mean(acc.totalKills);
  const towersPerGame = mean(acc.winnerTowers) + mean(acc.loserTowers);
  const baronsPerGame = mean(acc.barons);
  const shareAtLeastOneBaron = acc.baronGames / n;
  const dragonsPerGame = mean(acc.winnerDragons) + mean(acc.loserDragons);
  const shareSoul = acc.soulGames / n;
  const shareElder = acc.elderGames / n;
  const goldDiff = mean(acc.winnerGold) - mean(acc.loserGold);

  p();
  p(`==================================================================`);
  p(`  METRICAS DERIVADAS OBSERVADAS (Cenario A, sem veredito)`);
  p(`==================================================================`);
  p();
  p(`  Estas metricas sao OBSERVADAS contra a banda de aceite final do`);
  p(`  cenario equilibrado 75x75. Nenhuma linha abaixo e assercao: e`);
  p(`  medicao anotada ao lado da banda, para leitura humana. As alavancas`);
  p(`  legitimas desta milestone sao as taxas (torres/min, abates/min,`);
  p(`  ouro/min), gateadas em calibrate:pace, nao os totais absolutos aqui.`);
  p();
  p(`    duracao media da partida .............. ${f2(durMin)} min   [banda: 29 a 36 minutos]   fonte: STACK.md secao 7`);
  p(`    fracao no limite de 60 minutos ........ ${(shareAtCap * 100).toFixed(2)}%   [banda: abaixo de 0,5 por cento]   fonte: STACK.md secao 7`);
  p(`    fracao abaixo de 25 minutos ........... ${(shareBelow25 * 100).toFixed(1)}%   [banda: 1 a 12 por cento]   fonte: STACK.md secao 7`);
  p(`    fracao acima de 45 minutos ............ ${(shareAbove45 * 100).toFixed(1)}%   [banda: abaixo de 8 por cento]   fonte: STACK.md secao 7`);
  p(`    abates totais por partida ............. ${f2(killsPerGame)}   [banda: 22 a 34]   fonte: STACK.md secao 7`);
  p(`    torres totais por partida ............. ${f2(towersPerGame)}   [banda: 10 a 14]   fonte: STACK.md secao 7`);
  p(`    baroes por partida ..................... ${f2(baronsPerGame)}   [banda: 0,9 a 1,8]   fonte: STACK.md secao 7`);
  p(`    fracao de partidas com >=1 Baron ...... ${(shareAtLeastOneBaron * 100).toFixed(1)}%   [banda: 75 a 98 por cento]   fonte: STACK.md secao 7`);
  p(`    dragoes por partida .................... ${f2(dragonsPerGame)}   [banda: 3,8 a 5,2]   fonte: STACK.md secao 7`);
  p(`    fracao de partidas com Alma ........... ${(shareSoul * 100).toFixed(1)}%   [banda: 30 a 55 por cento]   fonte: STACK.md secao 7`);
  p(`    fracao de partidas com Elder .......... ${(shareElder * 100).toFixed(1)}%   [banda: 4 a 18 por cento]   fonte: STACK.md secao 7`);
  p(`    diferenca de ouro venc/perd no fim .... ${int0(goldDiff)}   [banda: 7 mil a 14 mil]   fonte: STACK.md secao 7`);
}

// ---------------------------------------------------------------------------
// Execucao
// ---------------------------------------------------------------------------

describe("diagnostico amplo da engine", () => {
  it(
    "roda milhares de partidas e imprime o panorama, sem nenhuma assercao",
    () => {
      const N = 1500;

      // --- Cenario A: times equilibrados sinteticos (neutralidade) ---
      const eq = emptyAcc();
      for (let seed = 0; seed < N; seed++) {
        collect(simulateMatch(flatRoster("u", 75), flatRoster("r", 75), mulberry32(seed)), eq);
      }
      report("A. SINTETICO EQUILIBRADO (75 vs 75)", eq);
      observedMetricsBlock(eq);

      // --- Cenario B: rosters reais sorteados (uso real do app) ---
      const real = emptyAcc();
      for (let seed = 0; seed < N; seed++) {
        const [A, B] = realTeams(seed);
        collect(simulateMatch(A, B, mulberry32(seed)), real);
      }
      report("B. ROSTERS REAIS SORTEADOS (players.json, 20 pros)", real);

      // --- Cenario C: favorito claro ---
      const fav = emptyAcc();
      for (let seed = 0; seed < N; seed++) {
        collect(simulateMatch(flatRoster("u", 85), flatRoster("r", 70), mulberry32(seed)), fav);
      }
      report("C. FAVORITO CLARO (85 vs 70)", fav);

      // --- Cenario D: curva de win-rate por gap ---
      p();
      p(`==================================================================`);
      p(`  D. CURVA DE WIN-RATE POR DIFERENCA DE FORCA (N=600 por ponto)`);
      p(`==================================================================`);
      p();
      p(`    user  rival   gap    win-rate user   duracao media   kills tot`);
      const curve: Array<[number, number]> = [
        [75, 75], [77, 73], [80, 70], [82, 68], [85, 65],
        [88, 62], [90, 60], [95, 55], [99, 50], [99, 40],
      ];
      for (const [us, rs] of curve) {
        const a = emptyAcc();
        for (let seed = 0; seed < 600; seed++) {
          collect(simulateMatch(flatRoster("u", us), flatRoster("r", rs), mulberry32(seed)), a);
        }
        p(
          `     ${String(us).padStart(3)}    ${String(rs).padStart(3)}   ${String(us - rs).padStart(3)}    ` +
          `${pc(a.userWins, a.n).padStart(8)}        ${mmss(mean(a.durations)).padStart(6)}       ${f2(mean(a.totalKills)).padStart(5)}`
        );
      }

      // --- Cenario E: sensibilidade a um jogador forte isolado (passada unica) ---
      p();
      p(`==================================================================`);
      p(`  E. IMPACTO DE UM UNICO JOGADOR FORTE (base 75; um role em 95)`);
      p(`==================================================================`);
      p();
      p(`    role sup.   win-rate   K/D/A do reforcado   kill-share dele`);
      for (const boosted of ROLES) {
        const a = emptyAcc();
        const up = ROLES.map((r) => makePlayer(`u-${r}`, r, r === boosted ? 95 : 75));
        const sink = { k: 0, d: 0, a: 0, share: 0 };
        for (let seed = 0; seed < 600; seed++) {
          collect(
            simulateMatch(up, flatRoster("r", 75), mulberry32(seed)),
            a,
            { role: boosted, sink }
          );
        }
        p(
          `    ${boosted.padEnd(10)}  ${pc(a.userWins, a.n).padStart(7)}    ` +
          `${f2(sink.k / 600)}/${f2(sink.d / 600)}/${f2(sink.a / 600)}`.padStart(18) +
          `        ${((sink.share / 600) * 100).toFixed(1)}%`
        );
      }

      const text = OUT.join("\n");
      console.log(text);
      try { mkdirSync("docs/diagnostics", { recursive: true }); } catch { /* ja existe */ }
      writeFileSync("docs/diagnostics/engine-diagnose.txt", text, "utf-8");
    },
    600_000
  );
});
