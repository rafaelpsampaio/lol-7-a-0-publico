/**
 * scripts/calibrate-traits.ts
 *
 * Relatorio de impacto das traits novas (spec 2026-10-05-traits-no-motor, secao 6). Sem assercao:
 * quem aprova os numeros e o dono do produto (T-10).
 * Executar: npm run calibrate:traits   (TRAITS_N=300 npm run calibrate:traits para uma rodada rapida)
 * Escreve docs/diagnostics/traits-calibracao.md.
 *
 * Invariantes: seed = indice da partida (mulberry32), sem Math.random, texto pt-BR sem travessao.
 */

import { readFileSync, writeFileSync } from "node:fs";
import type { PlayerTrait, PlayerVersion, Role } from "../src/data/schema";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES, type MatchState } from "../src/sim/matchState";
import { LOVER_KINDS, TRAIT_TUNING, withoutNewTraits } from "../src/sim/traitEffects";
import type { SimEvent } from "../src/sim/simEvents";
import { shortName } from "../src/sim/ticker";
import { runCorpus, computeRealismMetrics, isObjectiveTake, scoreAt, type GameRecord } from "./realism-metrics";

const N = Number(process.env.TRAITS_N ?? 1000);
const ROAM_RE = /com o roam de|saiu da rota/;
type Result = ReturnType<typeof simulateMatch>;

function flat(prefix: string, overall: number, holder?: Role, trait?: PlayerTrait): PlayerVersion[] {
  return ROLES.map((r) => ({
    id: `${prefix}-${r}`,
    personId: `${prefix}-${r}`,
    // sem espaco: shortName tira o sufixo de funcao ("U top" viraria "U"), e todo card do user casaria
    displayName: `${prefix.toUpperCase()}${r}`,
    year: 2024,
    roles: [r],
    primaryRole: r,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [r]: overall },
    lanePhase: overall,
    midGame: overall,
    lateGame: overall,
    traits: r === holder && trait !== undefined ? [trait] : [],
    championPool: Array.from({ length: 8 }, (_, i) => ({ championId: `c${i}`, mastery: 3 as const })),
  }));
}

function play(holder: Role, trait: PlayerTrait | undefined, userOverall: number, rivalOverall: number, seed: number): Result {
  return simulateMatch(flat("u", userOverall, holder, trait), flat("r", rivalOverall), mulberry32(seed), undefined, {
    recordStats: true,
  });
}

const fs = (r: Result) => r.finalState as MatchState;
const userWon = (r: Result) => (r.winner === "user" ? 1 : 0);
const mean = (xs: number[]) => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length);
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "-");
/** Linhas de contagem (partidas, violacoes): inteiro, sem casas. */
const int = (x: number) => (Number.isFinite(x) ? String(Math.round(x)) : "-");
const median = (xs: number[]) => quantile(xs, 0.5);
function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "-");
const delta = (a: number, b: number) =>
  !Number.isFinite(a) || !Number.isFinite(b) || b === 0 ? "-" : `${(((a - b) / b) * 100).toFixed(1)}%`;

const deltaPp = (a: number, b: number) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "-";
  const d = (a - b) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)} pp`;
};

interface Pair {
  com: Result[];
  sem: Result[];
}

function pairs(holder: Role, trait: PlayerTrait, uo: number, ro: number, n: number): Pair {
  const com: Result[] = [];
  const sem: Result[] = [];
  for (let i = 0; i < n; i++) {
    com.push(play(holder, trait, uo, ro, i));
    sem.push(play(holder, undefined, uo, ro, i));
  }
  return { com, sem };
}

/** Uma linha de tabela "medida | com | sem | diferenca". */
function row(label: string, com: number, sem: number, fmt: (x: number) => string = f2): string {
  // linhas de fracao (formatador pct) comparam em pontos percentuais, as demais em variacao relativa
  const diff = fmt === pct ? deltaPp(com, sem) : delta(com, sem);
  return `| ${label} | ${fmt(com)} | ${fmt(sem)} | ${diff} |`;
}

const TABLE_HEAD = ["| Medida | Com a trait | Sem a trait | Diferenca |", "|---|---|---|---|"];

function holderStats(rs: Result[], role: Role) {
  const ps = rs.map((r) => fs(r).user.players[role]);
  return { k: mean(ps.map((p) => p.kills)), d: mean(ps.map((p) => p.deaths)), a: mean(ps.map((p) => p.assists)) };
}

function fightShare(rs: Result[]): number {
  const u = rs.reduce((s, r) => s + (fs(r).harnessStats?.fightWins.user ?? 0), 0);
  const t = rs.reduce((s, r) => s + (fs(r).harnessStats?.fightWins.user ?? 0) + (fs(r).harnessStats?.fightWins.rival ?? 0), 0);
  return t === 0 ? NaN : u / t;
}

const perGame = (rs: Result[], pred: (e: SimEvent) => boolean) => mean(rs.map((r) => r.timeline.filter(pred).length));

/** Abates dos dois times ate `sec` (placar do ultimo evento ate la). */
function killsBefore(r: Result, sec: number): number {
  const s = scoreAt(r.timeline, sec);
  return s === null ? 0 : s.userKills + s.rivalKills;
}
const totalKills = (r: Result) => fs(r).user.kills + fs(r).rival.kills;

/** Efeitos colaterais medidos em toda trait (spec 6): conversao, abates por fase e duracao. */
function sideEffects(p: Pair): string[] {
  const conv = (rs: Result[]) => mean(rs.map((r) => fs(r).harnessStats?.conversions ?? 0));
  const early = (rs: Result[]) => mean(rs.map((r) => killsBefore(r, 840)));
  const later = (rs: Result[]) => mean(rs.map((r) => totalKills(r) - killsBefore(r, 840)));
  const dur = (rs: Result[]) => mean(rs.map((r) => r.durationSec / 60));
  return [
    row("Janelas de conversao por partida", conv(p.com), conv(p.sem)),
    row("Abates antes de 14:00 (os dois times)", early(p.com), early(p.sem)),
    row("Abates depois de 14:00 (os dois times)", later(p.com), later(p.sem)),
    row("Duracao (min)", dur(p.com), dur(p.sem)),
  ];
}

const lines: string[] = [
  "# Calibracao das traits novas",
  "",
  `Gerado por \`npm run calibrate:traits\` com N=${N} partidas por cenario (seed = indice). Spec: \`docs/superpowers/specs/2026-10-05-traits-no-motor-design.md\`, secao 6.`,
  "",
  "Valores em uso (`TRAIT_TUNING`):",
  "",
  "```json",
  JSON.stringify(TRAIT_TUNING, null, 2),
  "```",
  "",
];

// --- Trava geral: taxa de vitoria no parelho 75 x 75 ---------------------------------------
lines.push("## Trava geral: taxa de vitoria no parelho 75 x 75", "",
  "O erro padrao (EP) da diferenca e sqrt(p1(1-p1)/N + p2(1-p2)/N). Diferenca menor que 2 EP nao se distingue do acaso.", "",
  "| Trait | Com | Sem | Diferenca (pp) | EP da diferenca (pp) | Dentro de 5 pp |", "|---|---|---|---|---|---|");
const HOLDER: Record<string, Role> = { teamfights: "adc", flips: "mid", dragon_lover: "jungle", roamer: "mid", side: "top", quits: "mid" };
for (const trait of Object.keys(HOLDER) as PlayerTrait[]) {
  const p = pairs(HOLDER[trait], trait, 75, 75, N);
  const wc = mean(p.com.map(userWon));
  const ws = mean(p.sem.map(userWon));
  const pp = (wc - ws) * 100;
  const ok = trait === "quits" ? "(pode derrubar)" : Math.abs(pp) <= 5 ? "sim" : "NAO";
  const se = Math.sqrt((wc * (1 - wc)) / N + (ws * (1 - ws)) / N) * 100;
  lines.push(`| \`${trait}\` | ${pct(wc)} | ${pct(ws)} | ${Number.isFinite(pp) ? pp.toFixed(1) : "-"} | ${Number.isFinite(se) ? se.toFixed(1) : "-"} | ${ok} |`);
}
lines.push("");

// --- teamfights --------------------------------------------------------------------------------
{
  const p = pairs("adc", "teamfights", 75, 75, N);
  const hc = holderStats(p.com, "adc");
  const hs = holderStats(p.sem, "adc");
  lines.push("## `teamfights` (ADC, 75 x 75)", "", "Alvo: lutas vencidas +5 a +8 pp.", "", ...TABLE_HEAD,
    row("Lutas de resolveTeamfight vencidas pelo user", fightShare(p.com), fightShare(p.sem), pct),
    row("Abates do portador por partida", hc.k, hs.k),
    row("Mortes do portador por partida", hc.d, hs.d), ...sideEffects(p), "");
}

// --- flips ---------------------------------------------------------------------------------------
{
  const p = pairs("mid", "flips", 80, 70, N);
  const stomp = (r: Result) => r.winner === "user" && fs(r).user.kills - fs(r).rival.kills >= 15;
  const hc = holderStats(p.com.filter(stomp), "mid");
  const hs = holderStats(p.sem.filter(stomp), "mid");
  const ac = holderStats(p.com, "mid");
  const as = holderStats(p.sem, "mid");
  lines.push("## `flips` (mid, favorito 80 x 70)", "", "Alvo: nos atropelos (vitoria com 15+ abates de diferenca), abates cerca de 2x e mortes de perto de 0 para perto de 3.", "", ...TABLE_HEAD,
    row("Partidas de atropelo", p.com.filter(stomp).length, p.sem.filter(stomp).length, int),
    row("Abates do portador nos atropelos", hc.k, hs.k),
    row("Mortes do portador nos atropelos", hc.d, hs.d),
    row("Abates do portador (todas)", ac.k, as.k),
    row("Mortes do portador (todas)", ac.d, as.d),
    row("Abates por partida (os dois times)", mean(p.com.map(totalKills)), mean(p.sem.map(totalKills))), ...sideEffects(p), "");
}

// --- dragon_lover --------------------------------------------------------------------------------
{
  const p = pairs("jungle", "dragon_lover", 75, 75, N);
  const lover = (e: SimEvent) => e.side === "user" && isObjectiveTake(e) && e.objectiveKind !== null && (LOVER_KINDS as readonly string[]).includes(e.objectiveKind);
  const steal = (e: SimEvent) => e.side === "user" && e.stolen;
  const firstDragon = (r: Result) => r.timeline.find((e) => e.side === "user" && isObjectiveTake(e) && e.objectiveKind === "dragon")?.timeSec ?? NaN;
  lines.push("## `dragon_lover`, Ama objetivos (jungle, 75 x 75)", "", "Alvo: mais objetivos, roubos cerca de 2x, mortes do portador de +10% a +25%.", "", ...TABLE_HEAD,
    row("Dragoes, larvas e Arautos do user por partida", perGame(p.com, lover), perGame(p.sem, lover)),
    row("Roubos do user por partida", perGame(p.com, steal), perGame(p.sem, steal)),
    row("Mortes do portador por partida", holderStats(p.com, "jungle").d, holderStats(p.sem, "jungle").d),
    row("1o dragao do user (s, media)",mean(p.com.map(firstDragon).filter(Number.isFinite)), mean(p.sem.map(firstDragon).filter(Number.isFinite))), ...sideEffects(p), "");
}

// --- roamer --------------------------------------------------------------------------------------
{
  const p = pairs("mid", "roamer", 75, 75, N);
  const gank = (e: SimEvent) => e.side === "user" && e.kind === "gank";
  // o texto de roam do engine (makeKillEvent): "saiu da rota" (o roamer abateu) ou "com o roam de" (assistiu)
  const roamKill = (e: SimEvent) => e.side === "user" && ROAM_RE.test(e.ticker);
  const midLost = (e: SimEvent) => e.side === "rival" && e.lane === "mid" && e.timeSec < 840
    && (e.kind === "plate_taken" || e.kind === "tower_destroyed" || e.kind === "first_tower");
  const hc = holderStats(p.com, "mid");
  const hs = holderStats(p.sem, "mid");
  lines.push("## `roamer` (mid, 75 x 75)", "", "Alvo: ganks e K+A do portador sobem; a rota dele perde (placas e torres cedidas no mid antes de 14:00).", "", ...TABLE_HEAD,
    row("Ganks do user por partida (so o evento gank)", perGame(p.com, gank), perGame(p.sem, gank)),
    row("Abates do user com roam por partida (gank, primeiro sangue e shutdown)", perGame(p.com, roamKill), perGame(p.sem, roamKill)),
    row("Abates + assistencias do portador", hc.k + hc.a, hs.k + hs.a),
    row("Placas e torres do mid cedidas antes de 14:00", perGame(p.com, midLost), perGame(p.sem, midLost)), ...sideEffects(p), "");
}

// --- side ------------------------------------------------------------------------------------------
{
  const p = pairs("top", "side", 75, 75, N);
  const topTower = (e: SimEvent) => e.side === "user" && e.lane === "top" && e.timeSec >= 840 && e.timeSec < 1500
    && (e.kind === "tower_destroyed" || e.kind === "first_tower");
  lines.push("## `side` (top, 75 x 75)", "", "Alvo: mais torres na rota dele no meio de jogo.", "", ...TABLE_HEAD,
    row("Torres do user no top entre 14:00 e 25:00", perGame(p.com, topTower), perGame(p.sem, topTower)), ...sideEffects(p), "");
}

// --- quits ------------------------------------------------------------------------------------------
{
  const p = pairs("mid", "quits", 70, 80, N);
  const quitGames = p.com.filter((r) => r.timeline.some((e) => e.kind === "player_quit"));
  const backGames = quitGames.filter((r) => r.timeline.some((e) => e.kind === "player_returned"));
  // Por que poucos voltam: o sorteio de volta (quitReturnChance) e o fim da partida antes da volta
  // sao coisas diferentes. Quem ficou fora ate o fim tem respawnAtSec !== null se sorteou volta.
  const midOf = (r: Result) => fs(r).user.players.mid;
  const drewReturn = (r: Result) => r.timeline.some((e) => e.kind === "player_returned") || midOf(r).respawnAtSec !== null;
  const drewGames = quitGames.filter(drewReturn);
  const endedFirst = drewGames.filter((r) => !r.timeline.some((e) => e.kind === "player_returned"));
  const quitToEnd = quitGames.map((r) => r.durationSec - (r.timeline.find((e) => e.kind === "player_quit")?.timeSec ?? r.durationSec));
  const share = (n: number) => pct(n / Math.max(1, quitGames.length));
  lines.push("## `quits` (mid, azarao 70 x 80)", "", "Alvo: cerca de 1 em 8 partidas do portador com quit (12%); metade volta.", "",
    "| Medida | Valor |", "|---|---|",
    `| Partidas com quit | ${pct(quitGames.length / N)} (${quitGames.length} de ${N}) |`,
    `| Das com quit, voltou | ${pct(backGames.length / Math.max(1, quitGames.length))} (${backGames.length}) |`,
    `| Das com quit, sorteou volta | ${share(drewGames.length)} (${drewGames.length}) |`,
    `| Das com quit, sorteou volta mas a partida acabou antes | ${share(endedFirst.length)} (${endedFirst.length}) |`,
    `| Das com quit, nao sorteou volta | ${share(quitGames.length - drewGames.length)} (${quitGames.length - drewGames.length}) |`,
    `| Tempo do quit ao fim da partida (s, mediana e p75) | ${f2(median(quitToEnd))} e ${f2(quantile(quitToEnd, 0.75))} |`,
    `| Janela de volta sorteada (s, minimo e maximo) | ${TRAIT_TUNING.quitReturnMinSec} e ${TRAIT_TUNING.quitReturnMaxSec} |`,
    `| Duracao media com quit (min) | ${f2(mean(quitGames.map((r) => r.durationSec / 60)))} |`,
    `| Duracao media sem a trait (min) | ${f2(mean(p.sem.map((r) => r.durationSec / 60)))} |`, "",
    ...TABLE_HEAD, ...sideEffects(p), "");
}

// --- Sanidade do pack dos amigos ------------------------------------------------------------------
{
  const M = Math.min(N, 600);
  const amigos: PlayerVersion[] = JSON.parse(readFileSync("public/packs/amigos.json", "utf-8")).players;
  const recCom = runCorpus(amigos, "app", M);
  const recSem = runCorpus(withoutNewTraits(amigos), "app", M);
  const com = computeRealismMetrics(recCom);
  const sem = computeRealismMetrics(recSem);
  const early = (rs: GameRecord[]) => mean(rs.map((g) => killsBefore(g.result, 840)));
  lines.push(`## Pack dos amigos com e sem as traits novas (N=${M})`, "", "Trava: abates por partida e duracao a ate 15%.", "", ...TABLE_HEAD,
    row("Abates por partida", com.killsPerGame, sem.killsPerGame),
    row("Abates antes de 14:00", early(recCom), early(recSem)),
    row("Duracao media (min)", com.durationMeanMin, sem.durationMeanMin),
    row("1o dragao (s, mediana)", com.firstDragonMedianSec, sem.firstDragonMedianSec),
    row("1a torre (s, mediana)", com.firstTowerMedianSec, sem.firstTowerMedianSec),
    row("Fracao de roubos", com.stealFraction, sem.stealFraction, pct),
    row("Violacoes de regra dura", com.hardRuleViolations, sem.hardRuleViolations, int), "");
}

// --- Regua dos pros ----------------------------------------------------------------------------------
// O script nao reroda a auditoria de realismo: o resultado abaixo foi medido a parte (Task 11, passo 2).
lines.push("## Regua dos pros", "",
  "Sem nenhum portador das traits novas a partida e a mesma de antes (T-02). Medido em 2026-10-05 no commit c3175f5 (nao e rerodado por este script): `REALISM_N=600 npm run realism` na base ea9ea18 e neste ramo, e `docs/diagnostics/realism-audit.txt` ficou identico nos dois.", "");

// --- Partidas de exemplo lado a lado ---------------------------------------------------------------
lines.push("## Partidas de exemplo (mesma semente, com e sem a trait)", "");
const CASES: [PlayerTrait, Role, number, number][] = [
  ["flips", "mid", 80, 70], ["dragon_lover", "jungle", 75, 75], ["roamer", "mid", 75, 75],
  ["side", "top", 75, 75], ["teamfights", "adc", 75, 75], ["quits", "mid", 70, 80],
];
for (const [trait, role, uo, ro] of CASES) {
  lines.push(`### \`${trait}\``, "");
  let shown = 0;
  for (let seed = 0; seed < 200 && shown < 3; seed++) {
    const com = play(role, trait, uo, ro, seed);
    const sem = play(role, undefined, uo, ro, seed);
    const a = fs(com).user.players[role];
    const b = fs(sem).user.players[role];
    if (a.kills === b.kills && a.deaths === b.deaths && a.assists === b.assists && com.winner === sem.winner) continue;
    // as linhas-chave da trait (o quit e a volta; o texto de roam) tem de aparecer no exemplo
    const isKey = (e: SimEvent) =>
      trait === "quits" ? e.kind === "player_quit" || e.kind === "player_returned" : trait === "roamer" ? ROAM_RE.test(e.ticker) : false;
    if ((trait === "quits" || trait === "roamer") && !com.timeline.some((e) => e.side === "user" && isKey(e))) continue;
    shown += 1;
    const name = shortName(a.card);
    // os cards tem nome unico por funcao (flat), entao o nome do portador casa so os eventos dele
    const mine = com.timeline.filter((e) => e.ticker.includes(name) || e.actors.includes(name) || e.victims.includes(name));
    const key = mine.filter(isKey).slice(0, 3);
    const rest = mine.filter((e) => !key.includes(e)).slice(0, Math.max(0, 4 - key.length));
    const marks = [...key, ...rest]
      .sort((x, y) => x.timeSec - y.timeSec)
      .map((e) => `${Math.floor(e.timeSec / 60)}:${String(e.timeSec % 60).padStart(2, "0")} ${e.ticker}`);
    lines.push(
      `- Semente ${seed}. Com: ${com.winner === "user" ? "vitoria" : "derrota"} em ${f2(com.durationSec / 60)} min, portador ${a.kills}/${a.deaths}/${a.assists}. Sem: ${sem.winner === "user" ? "vitoria" : "derrota"} em ${f2(sem.durationSec / 60)} min, mesmo jogador ${b.kills}/${b.deaths}/${b.assists}.`,
      ...marks.map((m) => `  - ${m}`)
    );
  }
  lines.push("");
}

writeFileSync("docs/diagnostics/traits-calibracao.md", lines.join("\n"));
console.log(lines.join("\n"));
