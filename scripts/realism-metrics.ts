/**
 * scripts/realism-metrics.ts
 *
 * Biblioteca da regua de realismo (specs docs/superpowers/specs/2026-10-02-luta-mapa-vitoria-design.md
 * e docs/superpowers/specs/2026-10-02-calendario-e-volume-design.md, secoes "Medicao e aceite"). Importada pelo relatorio (realism-audit.ts), pelo gate
 * (calibrate-realism.ts) e pela varredura (sweep-realism.ts), para que a definicao de cada
 * metrica viva num lugar so (mesma regra de scripts/lift.ts, scripts/README.md secao 4).
 *
 * Sem assercao e sem I/O: quem le public/players.json e o chamador. Nao importa
 * scripts/bands.ts porque aquele modulo importa o expect do vitest, e esta biblioteca
 * tambem roda fora do vitest (npx tsx).
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = indice da partida, nunca seed compartilhada
 *   - Sem Math.random: apenas mulberry32(seed)
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { simulateMatch, type SimulationResult } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { playerSlice } from "../src/sim/power";
import { ROLES, DEFAULT_SIM_CONFIG, type SimConfig } from "../src/sim/matchState";
import { assignFearlessChampionsBothTeams } from "../src/sim/fearless";
import type { PlayerVersion, Role } from "../src/data/schema";
import type { EventScore, SimEvent } from "../src/sim/simEvents";
import { mean, percentile } from "./stats";

export type Scenario = "app" | "even75";

export interface GameRecord {
  result: SimulationResult;
  /** rating medio (lanePhase, midGame, lateGame) do roster user menos o do rival; 0 no even75 */
  ratingGap: number;
}

// ---------------------------------------------------------------------------
// Fixtures: copiadas de scripts/diagnose-engine.ts (makePlayer, flatRoster, realTeams),
// conforme scripts/README.md secao 3. realTeams recebe o pool por rota em vez de ler o
// arquivo, porque esta biblioteca nao faz I/O.
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
    championPool: Array.from({ length: 8 }, (_, i) => ({ championId: `c${i}`, mastery: 3 as const })),
  };
}

function flatRoster(prefix: string, stat: number): PlayerVersion[] {
  return ROLES.map((r) => makePlayer(`${prefix}-${r}`, r, stat));
}

function realTeams(byRole: Record<Role, PlayerVersion[]>, seed: number): [PlayerVersion[], PlayerVersion[]] {
  const rng = mulberry32(seed * 7919 + 13);
  const a: PlayerVersion[] = [];
  const b: PlayerVersion[] = [];
  for (const role of ROLES) {
    const pool = [...byRole[role]];
    a.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    b.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return [a, b];
}

export function rosterRating(roster: readonly PlayerVersion[]): number {
  return mean(roster.map((p) => (p.lanePhase + p.midGame + p.lateGame) / 3));
}

/**
 * Corpus deterministico. "app" e o caminho do jogo: dois times reais disjuntos de
 * players.json com campeoes de assignFearlessChampionsBothTeams (jogo i % 5 da serie).
 * "even75" e o controle sintetico 75 x 75 sem campeoes.
 */
export function runCorpus(
  players: readonly PlayerVersion[],
  scenario: Scenario,
  n: number,
  config: SimConfig = DEFAULT_SIM_CONFIG
): GameRecord[] {
  const byRole = Object.fromEntries(
    ROLES.map((r) => [r, players.filter((p) => p.primaryRole === r)])
  ) as Record<Role, PlayerVersion[]>;
  const out: GameRecord[] = [];
  for (let i = 0; i < n; i++) {
    if (scenario === "even75") {
      const result = simulateMatch(flatRoster("u", 75), flatRoster("r", 75), mulberry32(i), config);
      out.push({ result, ratingGap: 0 });
      continue;
    }
    const [u, r] = realTeams(byRole, i);
    const champs = assignFearlessChampionsBothTeams(u, r, 5);
    const result = simulateMatch(u, r, mulberry32(i), config, {
      userChampions: champs.teamA[i % 5],
      rivalChampions: champs.teamB[i % 5],
    });
    out.push({ result, ratingGap: rosterRating(u) - rosterRating(r) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Leitura da timeline
// ---------------------------------------------------------------------------

/** Placar da ultima entrada com timeSec <= sec, ou null se a timeline ainda nao tinha nada. */
export function scoreAt(
  timeline: readonly Pick<SimEvent, "timeSec" | "score">[],
  sec: number
): EventScore | null {
  let last: EventScore | null = null;
  for (const e of timeline) {
    if (e.timeSec > sec) break;
    last = e.score;
  }
  return last;
}

/** Tomada ou roubo de objetivo com protagonista (o evento de Alma tem actors vazio). */
export function isObjectiveTake(e: SimEvent): boolean {
  return (
    e.objectiveKind !== null &&
    e.actors.length > 0 &&
    (e.kind.endsWith("_taken") || e.kind.endsWith("_steal"))
  );
}

type Side = "user" | "rival";

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return percentile([...xs].sort((a, b) => a - b), 50);
}

/** Percentil p (0..100) de uma lista nao ordenada; NaN se vazia. */
function pct(xs: readonly number[], p: number): number {
  return xs.length === 0 ? NaN : percentile([...xs].sort((a, b) => a - b), p);
}

function frac(n: number, d: number): number {
  return d === 0 ? NaN : n / d;
}

/** Fracao de partidas vivas no instante, com lider definido, em que o lider venceu. */
function leaderWins(
  games: readonly GameRecord[],
  sec: number,
  lead: (s: EventScore) => number
): number {
  let hit = 0;
  let total = 0;
  for (const g of games) {
    if (g.result.durationSec <= sec) continue;
    const s = scoreAt(g.result.timeline, sec);
    if (!s) continue;
    const d = lead(s);
    if (d === 0) continue;
    total++;
    if ((d > 0) === (g.result.winner === "user")) hit++;
  }
  return frac(hit, total);
}

/** Fracao de partidas com o "primeiro" definido em que o dono do primeiro venceu. */
function firstWins(games: readonly GameRecord[], firstSide: (g: GameRecord) => Side | null): number {
  let hit = 0;
  let total = 0;
  for (const g of games) {
    const s = firstSide(g);
    if (!s) continue;
    total++;
    if (s === g.result.winner) hit++;
  }
  return frac(hit, total);
}

function firstScoreSide(
  g: GameRecord,
  u: (s: EventScore) => number,
  r: (s: EventScore) => number
): Side | null {
  for (const e of g.result.timeline) {
    if (u(e.score) + r(e.score) > 0) return u(e.score) > 0 ? "user" : "rival";
  }
  return null;
}

function firstScoreTime(g: GameRecord, total: (s: EventScore) => number): number | null {
  for (const e of g.result.timeline) if (total(e.score) > 0) return e.timeSec;
  return null;
}

/**
 * Vantagem inicial de rota: bot (media de adc e suporte) mais mid, positiva quando o user
 * tem a vantagem. Usa os cards do estado final (nunca mudam) e ignora quem esta vivo.
 */
function laningEdge(g: GameRecord): number {
  const lane = (side: Side) => {
    const p = g.result.finalState[side].players;
    const l = (role: Role) => playerSlice(p[role].card, "laning");
    return (l("adc") + l("support")) / 2 + l("mid");
  };
  return lane("user") - lane("rival");
}

function meanAliveAt(games: readonly GameRecord[], sec: number, f: (s: EventScore) => number): number {
  const xs: number[] = [];
  for (const g of games) {
    if (g.result.durationSec <= sec) continue;
    const s = scoreAt(g.result.timeline, sec);
    if (s) xs.push(f(s));
  }
  return xs.length === 0 ? NaN : mean(xs);
}

// ---------------------------------------------------------------------------
// Metricas
// ---------------------------------------------------------------------------

export interface RealismMetrics {
  n: number;
  // travas
  durationMeanMin: number;
  capFraction: number;
  firstTowerMedianSec: number;
  hardRuleViolations: number;
  // bandas de aceite
  killLeaderAt20Wins: number;
  goldLeaderAt15Wins: number;
  goldLeaderAt20Wins: number;
  goldLeaderAt25Wins: number;
  killRatioWinnerLoser: number;
  winnerMoreKillsFrac: number;
  winnerBehindGoldFrac: number;
  goldDiffWinnerLoserMean: number;
  gpmTeamMean: number;
  gpmRatioWinnerLoser: number;
  firstBaronWins: number;
  soulWins: number;
  firstTowerWins: number;
  stealFraction: number;
  favoriteGap5Wins: number;
  favoriteGapUnder1Wins: number;
  // acompanhadas sem gate
  killsPerGame: number;
  killsPerMin: number;
  firstBloodMedianSec: number;
  firstDragonMedianSec: number;
  baronAtSpawnFrac: number;
  elderFrac: number;
  towersPerGame: number;
  towerLeaderAt20Wins: number;
  teamGoldAt10: number;
  teamGoldAt15: number;
  teamGoldAt20: number;
  killsAt10: number;
  killsAt20: number;
  // bandas do calendario e do volume (spec 2026-10-02-calendario-e-volume)
  firstBloodP10Sec: number;
  firstBloodBefore90Frac: number;
  noKillBy10Frac: number;
  killsAt15: number;
  killsPerMin20to25: number;
  firstDragonBefore360Frac: number;
  dragonsPerGame: number;
  soulFrac: number;
  baronsPerGame: number;
  gamesWithBaronFrac: number;
  firstTowerP10Sec: number;
  towersAt15: number;
  towersAt20: number;
  // acompanhadas sem gate (spec 2026-10-02-calendario-e-volume)
  plateEventsPerGame: number;
  grubsTakenFrac: number;
  heraldTakenFrac: number;
  firstBaronMedianSec: number;
  adcKillsPerGame: number;
  midKillsPerGame: number;
  jungleKillsPerGame: number;
  shutdownsPerGame: number;
  killsP10: number;
  killsP90: number;
  durationP10Min: number;
  durationP90Min: number;
  under25Frac: number;
  dragonSetupDelaySec: number;
  baronSetupDelaySec: number;
  // spec secao 4: "1o dragao perto de 9:00 em jogo parelho, perto de 7:00 para quem domina as rotas"
  firstDragonEvenMedianSec: number;
  firstDragonDominantMedianSec: number;
}

export function computeRealismMetrics(games: readonly GameRecord[]): RealismMetrics {
  const n = games.length;
  const durMin = games.map((g) => g.result.durationSec / 60);
  const W = (g: GameRecord): Side => g.result.winner;
  const L = (g: GameRecord): Side => (g.result.winner === "user" ? "rival" : "user");
  const fs = (g: GameRecord) => g.result.finalState;

  const wk = games.map((g) => fs(g)[W(g)].kills);
  const lk = games.map((g) => fs(g)[L(g)].kills);
  const wGold = games.map((g) => fs(g)[W(g)].gold);
  const lGold = games.map((g) => fs(g)[L(g)].gold);

  const towerTotal = (s: EventScore) => s.userTowers + s.rivalTowers;
  const killTotal = (s: EventScore) => s.userKills + s.rivalKills;
  const dragonTotal = (s: EventScore) => s.userDragons + s.rivalDragons;

  const firstTowerTimes = games
    .map((g) => firstScoreTime(g, towerTotal))
    .filter((t): t is number => t !== null);

  let hard = 0;
  for (const g of games) {
    const ft = firstScoreTime(g, towerTotal);
    if (ft !== null && ft < 420) hard++;
    for (const e of g.result.timeline) {
      if ((e.kind === "baron_taken" || e.kind === "baron_steal") && e.timeSec < 1200) hard++;
      if ((e.kind === "triple_kill" || e.kind === "quadra_kill" || e.kind === "penta_kill") && e.timeSec < 480) hard++;
      if (e.kind === "ace" && e.timeSec < 480) hard++;
    }
  }

  let steals = 0;
  let takes = 0;
  for (const g of games) {
    for (const e of g.result.timeline) {
      if (!isObjectiveTake(e)) continue;
      takes++;
      if (e.stolen) steals++;
    }
  }

  const firstBaron = (g: GameRecord): Side | null => {
    const e = g.result.timeline.find((x) => (x.kind === "baron_taken" || x.kind === "baron_steal") && x.side);
    return e ? (e.side as Side) : null;
  };
  const firstBaronTimes = games
    .map((g) => g.result.timeline.find((x) => x.kind === "baron_taken" || x.kind === "baron_steal")?.timeSec)
    .filter((t): t is number => t !== undefined);

  const favorite = (g: GameRecord): Side | null =>
    g.ratingGap > 0 ? "user" : g.ratingGap < 0 ? "rival" : null;

  const fbTimes = games.map((g) => firstScoreTime(g, killTotal)).filter((t): t is number => t !== null);
  const fdTimes = games.map((g) => firstScoreTime(g, dragonTotal)).filter((t): t is number => t !== null);
  const totalKills = wk.map((k, i) => k + lk[i]);
  // Abates por minuto entre 20:00 e 25:00, so nas partidas vivas aos 25:00 (como o feed real).
  const kills2025 = games
    .filter((g) => g.result.durationSec > 1500)
    .map((g) => {
      const a = scoreAt(g.result.timeline, 1200);
      const b = scoreAt(g.result.timeline, 1500);
      return ((b ? killTotal(b) : 0) - (a ? killTotal(a) : 0)) / 5;
    });
  const barons = (g: GameRecord) => fs(g).user.baronsTaken + fs(g).rival.baronsTaken;
  const kindCount = (g: GameRecord, kind: string) => g.result.timeline.filter((e) => e.kind === kind).length;
  // Abates por jogador da funcao, por partida (media dos dois times, como a referencia real).
  const roleKills = (role: Role) =>
    mean(games.map((g) => (fs(g).user.players[role].kills + fs(g).rival.players[role].kills) / 2));
  // Mediana do 1o dragao (mesma definicao de firstDragonMedianSec) nas partidas do grupo.
  const firstDragonMedianWhere = (inGroup: (g: GameRecord) => boolean) =>
    median(
      games
        .filter(inGroup)
        .map((g) => firstScoreTime(g, dragonTotal))
        .filter((t): t is number => t !== null)
    );
  // Tempo de preparo (emenda de 2026-10-02): do nascimento ao 1o aviso de preparo do objetivo.
  const setupDelay = (kind: string, spawnSec: number) =>
    median(
      games
        .map((g) => g.result.timeline.find((e) => e.kind === "objective_setup" && e.objectiveKind === kind)?.timeSec)
        .filter((t): t is number => t !== undefined)
        .map((t) => t - spawnSec)
    );

  return {
    n,
    durationMeanMin: mean(durMin),
    capFraction: frac(games.filter((g) => g.result.durationSec >= 3600).length, n),
    firstTowerMedianSec: median(firstTowerTimes),
    hardRuleViolations: hard,

    killLeaderAt20Wins: leaderWins(games, 1200, (s) => s.userKills - s.rivalKills),
    goldLeaderAt15Wins: leaderWins(games, 900, (s) => s.userGold - s.rivalGold),
    goldLeaderAt20Wins: leaderWins(games, 1200, (s) => s.userGold - s.rivalGold),
    goldLeaderAt25Wins: leaderWins(games, 1500, (s) => s.userGold - s.rivalGold),
    killRatioWinnerLoser: mean(wk) / mean(lk),
    winnerMoreKillsFrac: frac(wk.filter((k, i) => k > lk[i]).length, n),
    winnerBehindGoldFrac: frac(wGold.filter((x, i) => x < lGold[i]).length, n),
    goldDiffWinnerLoserMean: mean(wGold.map((x, i) => x - lGold[i])),
    gpmTeamMean: mean(games.map((_g, i) => (wGold[i] + lGold[i]) / 2 / durMin[i])),
    gpmRatioWinnerLoser:
      mean(wGold.map((x, i) => x / durMin[i])) / mean(lGold.map((x, i) => x / durMin[i])),
    firstBaronWins: firstWins(games, firstBaron),
    soulWins: firstWins(games, (g) => (fs(g).user.soul ? "user" : fs(g).rival.soul ? "rival" : null)),
    firstTowerWins: firstWins(games, (g) => firstScoreSide(g, (s) => s.userTowers, (s) => s.rivalTowers)),
    stealFraction: frac(steals, takes),
    favoriteGap5Wins: firstWins(games.filter((g) => Math.abs(g.ratingGap) >= 5), favorite),
    favoriteGapUnder1Wins: firstWins(games.filter((g) => Math.abs(g.ratingGap) < 1), favorite),

    killsPerGame: mean(wk.map((k, i) => k + lk[i])),
    killsPerMin: mean(wk.map((k, i) => k + lk[i])) / mean(durMin),
    firstBloodMedianSec: median(
      games.map((g) => firstScoreTime(g, killTotal)).filter((t): t is number => t !== null)
    ),
    firstDragonMedianSec: median(
      games.map((g) => firstScoreTime(g, dragonTotal)).filter((t): t is number => t !== null)
    ),
    baronAtSpawnFrac: frac(firstBaronTimes.filter((t) => t <= 1260).length, firstBaronTimes.length),
    elderFrac: frac(games.filter((g) => fs(g).user.elderCount + fs(g).rival.elderCount > 0).length, n),
    // Torres do Nexus contam (a referencia real conta as 11 torres de cada lado); towersDestroyed so conta as de rota
    towersPerGame: mean(
      games.map(
        (g) =>
          fs(g).user.towersDestroyed +
          fs(g).rival.towersDestroyed +
          (4 - fs(g).user.nexusTurretsAlive - fs(g).rival.nexusTurretsAlive)
      )
    ),
    towerLeaderAt20Wins: leaderWins(games, 1200, (s) => s.userTowers - s.rivalTowers),
    teamGoldAt10: meanAliveAt(games, 600, (s) => (s.userGold + s.rivalGold) / 2),
    teamGoldAt15: meanAliveAt(games, 900, (s) => (s.userGold + s.rivalGold) / 2),
    teamGoldAt20: meanAliveAt(games, 1200, (s) => (s.userGold + s.rivalGold) / 2),
    killsAt10: meanAliveAt(games, 600, killTotal),
    killsAt20: meanAliveAt(games, 1200, killTotal),
    firstBloodP10Sec: pct(fbTimes, 10),
    firstBloodBefore90Frac: frac(fbTimes.filter((t) => t < 90).length, n),
    noKillBy10Frac: frac(
      games.filter((g) => {
        const t = firstScoreTime(g, killTotal);
        return t === null || t > 600;
      }).length,
      n
    ),
    killsAt15: meanAliveAt(games, 900, killTotal),
    killsPerMin20to25: kills2025.length === 0 ? NaN : mean(kills2025),
    firstDragonBefore360Frac: frac(fdTimes.filter((t) => t < 360).length, fdTimes.length),
    dragonsPerGame: mean(
      games.map(
        (g) => fs(g).user.dragons.length + fs(g).rival.dragons.length + fs(g).user.elderCount + fs(g).rival.elderCount
      )
    ),
    soulFrac: frac(games.filter((g) => fs(g).user.soul !== null || fs(g).rival.soul !== null).length, n),
    baronsPerGame: mean(games.map(barons)),
    gamesWithBaronFrac: frac(games.filter((g) => barons(g) > 0).length, n),
    firstTowerP10Sec: pct(firstTowerTimes, 10),
    towersAt15: meanAliveAt(games, 900, towerTotal),
    towersAt20: meanAliveAt(games, 1200, towerTotal),

    plateEventsPerGame: mean(games.map((g) => kindCount(g, "plate_taken"))),
    grubsTakenFrac: frac(games.filter((g) => kindCount(g, "voidgrubs_taken") > 0).length, n),
    heraldTakenFrac: frac(games.filter((g) => kindCount(g, "herald_taken") > 0).length, n),
    firstBaronMedianSec: median(firstBaronTimes),
    adcKillsPerGame: roleKills("adc"),
    midKillsPerGame: roleKills("mid"),
    jungleKillsPerGame: roleKills("jungle"),
    shutdownsPerGame: mean(games.map((g) => kindCount(g, "shutdown"))),
    killsP10: pct(totalKills, 10),
    killsP90: pct(totalKills, 90),
    durationP10Min: pct(durMin, 10),
    durationP90Min: pct(durMin, 90),
    under25Frac: frac(games.filter((g) => g.result.durationSec < 1500).length, n),
    dragonSetupDelaySec: setupDelay("dragon", 300),
    baronSetupDelaySec: setupDelay("baron", 1200),
    firstDragonEvenMedianSec: firstDragonMedianWhere((g) => Math.abs(laningEdge(g)) < 5),
    firstDragonDominantMedianSec: firstDragonMedianWhere((g) => Math.abs(laningEdge(g)) >= 15),
  };
}

// ---------------------------------------------------------------------------
// Bandas (fonte unica para relatorio e gate)
// ---------------------------------------------------------------------------

export interface RealismBandSpec {
  key: keyof RealismMetrics;
  label: string;
  floor: number;
  ceiling: number;
  target: number;
  /** "aceite" entra no gate como banda; "trava" tambem, mas nunca pode ser afrouxada */
  kind: "aceite" | "trava";
}

const SRC = "STACK.md secoes 3, 4.4, 4.5 e 6 + specs 2026-10-02 (luta-mapa-vitoria e calendario-e-volume)";
export const REALISM_SOURCE = SRC;

export const REALISM_BAND_SPECS: readonly RealismBandSpec[] = [
  { key: "durationMeanMin", label: "duracao media (min)", floor: 29, ceiling: 36, target: 32.3, kind: "trava" },
  { key: "capFraction", label: "fracao no teto de 60 min", floor: 0, ceiling: 0.005, target: 0, kind: "trava" },
  { key: "killLeaderAt20Wins", label: "lider de abates aos 20 vence", floor: 0.7, ceiling: 0.82, target: 0.764, kind: "aceite" },
  { key: "goldLeaderAt15Wins", label: "lider de ouro aos 15 vence", floor: 0.66, ceiling: 0.78, target: 0.716, kind: "aceite" },
  { key: "goldLeaderAt20Wins", label: "lider de ouro aos 20 vence", floor: 0.72, ceiling: 0.84, target: 0.782, kind: "aceite" },
  { key: "goldLeaderAt25Wins", label: "lider de ouro aos 25 vence", floor: 0.77, ceiling: 0.89, target: 0.83, kind: "aceite" },
  { key: "killRatioWinnerLoser", label: "abates vencedor / perdedor", floor: 1.8, ceiling: 2.6, target: 2.15, kind: "aceite" },
  { key: "winnerMoreKillsFrac", label: "vencedor com mais abates", floor: 0.85, ceiling: 1, target: 0.9, kind: "aceite" },
  { key: "winnerBehindGoldFrac", label: "vencedor atras no ouro", floor: 0, ceiling: 0.05, target: 0.02, kind: "aceite" },
  { key: "goldDiffWinnerLoserMean", label: "ouro vencedor menos perdedor", floor: 7000, ceiling: 13000, target: 10000, kind: "aceite" },
  { key: "gpmTeamMean", label: "GPM por time", floor: 1650, ceiling: 2050, target: 1833, kind: "aceite" },
  { key: "gpmRatioWinnerLoser", label: "GPM vencedor / perdedor", floor: 1.12, ceiling: 1.26, target: 1.19, kind: "aceite" },
  { key: "firstBaronWins", label: "time do 1o Barao vence", floor: 0.78, ceiling: 0.9, target: 0.854, kind: "aceite" },
  { key: "soulWins", label: "time da Alma vence", floor: 0.84, ceiling: 0.95, target: 0.908, kind: "aceite" },
  { key: "firstTowerWins", label: "time da 1a torre vence", floor: 0.62, ceiling: 0.75, target: 0.682, kind: "aceite" },
  { key: "stealFraction", label: "roubos / objetivos tomados", floor: 0, ceiling: 0.03, target: 0.02, kind: "aceite" },
  { key: "favoriteGap5Wins", label: "favorito com gap >= 5 vence", floor: 0.75, ceiling: 0.85, target: 0.8, kind: "aceite" },
  { key: "favoriteGapUnder1Wins", label: "favorito com gap < 1 vence", floor: 0.45, ceiling: 0.55, target: 0.5, kind: "aceite" },
  // calendario e volume (spec 2026-10-02-calendario-e-volume, secao Medicao e aceite)
  { key: "firstBloodMedianSec", label: "mediana do first blood (s)", floor: 240, ceiling: 390, target: 294, kind: "aceite" },
  { key: "firstBloodP10Sec", label: "p10 do first blood (s)", floor: 150, ceiling: 240, target: 193, kind: "aceite" },
  { key: "firstBloodBefore90Frac", label: "first blood antes de 1:30", floor: 0, ceiling: 0.02, target: 0, kind: "aceite" },
  { key: "noKillBy10Frac", label: "partidas sem abate ate 10:00", floor: 0.05, ceiling: 0.18, target: 0.11, kind: "aceite" },
  { key: "killsAt10", label: "abates aos 10", floor: 2.2, ceiling: 4.5, target: 3.2, kind: "aceite" },
  { key: "killsAt15", label: "abates aos 15", floor: 5, ceiling: 8.5, target: 6.5, kind: "aceite" },
  { key: "killsPerGame", label: "abates por partida", floor: 23, ceiling: 32, target: 27, kind: "aceite" },
  { key: "killsAt20", label: "abates aos 20", floor: 8.5, ceiling: 13, target: 10.7, kind: "aceite" },
  { key: "killsPerMin20to25", label: "abates por minuto entre 20 e 25", floor: 0.85, ceiling: 1.45, target: 1.13, kind: "aceite" },
  { key: "firstDragonMedianSec", label: "mediana do 1o dragao (s)", floor: 465, ceiling: 630, target: 550, kind: "aceite" },
  { key: "firstDragonBefore360Frac", label: "1o dragao antes de 6:00", floor: 0, ceiling: 0.03, target: 0, kind: "aceite" },
  { key: "dragonsPerGame", label: "dragoes por partida", floor: 3.8, ceiling: 5.2, target: 4.45, kind: "aceite" },
  { key: "soulFrac", label: "partidas com Alma", floor: 0.3, ceiling: 0.52, target: 0.42, kind: "aceite" },
  { key: "elderFrac", label: "partidas com Elder", floor: 0.04, ceiling: 0.14, target: 0.08, kind: "aceite" },
  { key: "baronsPerGame", label: "baroes por partida", floor: 1.1, ceiling: 1.7, target: 1.45, kind: "aceite" },
  { key: "gamesWithBaronFrac", label: "partidas com Barao", floor: 0.8, ceiling: 0.98, target: 0.96, kind: "aceite" },
  { key: "baronAtSpawnFrac", label: "1o Barao ate 21:00 (partidas com Barao)", floor: 0, ceiling: 0.15, target: 0.05, kind: "aceite" },
  { key: "firstTowerMedianSec", label: "mediana da 1a torre (s)", floor: 870, ceiling: 1110, target: 994, kind: "aceite" },
  // p10 da 1a torre: a spec fixa so o piso (12:00); o teto de 20:00 existe para a banda ter dois lados.
  { key: "firstTowerP10Sec", label: "p10 da 1a torre (s)", floor: 720, ceiling: 1200, target: 795, kind: "aceite" },
  { key: "towersAt15", label: "torres aos 15", floor: 0.4, ceiling: 1.4, target: 0.85, kind: "aceite" },
  { key: "towersAt20", label: "torres aos 20", floor: 2.5, ceiling: 5, target: 3.72, kind: "aceite" },
  { key: "towersPerGame", label: "torres por partida", floor: 10, ceiling: 14, target: 11.9, kind: "aceite" },
];

const TRACKED: readonly { key: keyof RealismMetrics; label: string; real: string }[] = [
  { key: "killsPerMin", label: "abates por minuto", real: "0,84" },
  { key: "towerLeaderAt20Wins", label: "lider de torres aos 20 vence", real: "sem fonte" },
  { key: "teamGoldAt10", label: "ouro por time aos 10", real: "15900" },
  { key: "teamGoldAt15", label: "ouro por time aos 15", real: "24700" },
  { key: "teamGoldAt20", label: "ouro por time aos 20", real: "34200" },
  { key: "plateEventsPerGame", label: "eventos de placa por partida", real: "8,2 na regra antiga" },
  { key: "grubsTakenFrac", label: "partidas com larvas tomadas", real: "sem fonte" },
  { key: "heraldTakenFrac", label: "partidas com Arauto tomado", real: "sem fonte" },
  { key: "firstBaronMedianSec", label: "mediana do 1o Barao (s)", real: "sem fonte firme" },
  { key: "adcKillsPerGame", label: "abates por ADC por partida", real: "4,6" },
  { key: "midKillsPerGame", label: "abates por mid por partida", real: "3,5" },
  { key: "jungleKillsPerGame", label: "abates por jungler por partida", real: "3,1" },
  { key: "shutdownsPerGame", label: "eventos de shutdown por partida", real: "sem fonte" },
  { key: "killsP10", label: "p10 de abates por partida", real: "16" },
  { key: "killsP90", label: "p90 de abates por partida", real: "38" },
  { key: "durationP10Min", label: "p10 da duracao (min)", real: "26,5" },
  { key: "durationP90Min", label: "p90 da duracao (min)", real: "39,5" },
  { key: "under25Frac", label: "partidas abaixo de 25 min", real: "0,06" },
  { key: "dragonSetupDelaySec", label: "tempo ate o 1o aviso de preparo do dragao (s)", real: "sem fonte" },
  { key: "baronSetupDelaySec", label: "tempo ate o 1o aviso de preparo do Barao (s)", real: "sem fonte" },
  { key: "firstDragonEvenMedianSec", label: "mediana do 1o dragao, jogo parelho (s)", real: "~550 (spec: ~9:00)" },
  { key: "firstDragonDominantMedianSec", label: "mediana do 1o dragao, quem domina bot+mid (s)", real: "~420 (spec: ~7:00)" },
];

function fmt(x: number): string {
  if (Number.isNaN(x)) return "n/a";
  return Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(3);
}

/** Linhas pt-BR do relatorio: bandas com OK/FORA e metricas acompanhadas. */
export function formatMetrics(scenario: string, m: RealismMetrics): string[] {
  const out = [`=== cenario ${scenario} (N=${m.n}) ===`, `violacoes de regra dura: ${m.hardRuleViolations}`];
  for (const b of REALISM_BAND_SPECS) {
    const v = m[b.key] as number;
    const ok = !Number.isNaN(v) && v >= b.floor && v <= b.ceiling;
    out.push(
      `${ok ? "OK  " : "FORA"} [${b.kind}] ${b.label}: ${fmt(v)}  banda [${fmt(b.floor)}; ${fmt(b.ceiling)}] alvo ${fmt(b.target)}`
    );
  }
  out.push("--- acompanhadas sem gate ---");
  for (const t of TRACKED) out.push(`     ${t.label}: ${fmt(m[t.key] as number)}  (real ${t.real})`);
  return out;
}

// ---------------------------------------------------------------------------
// Curva do Caos (spec 2026-10-02-calendario-e-volume): abates por partida por slider
// ---------------------------------------------------------------------------

/** Posicoes do slider de Caos da curva de volume. */
export const CHAOS_SLIDERS: readonly number[] = [0, 0.25, 0.5, 0.75, 1];

/** Abates por partida no cenario app em cada posicao do slider de Caos (mesmas seeds em todas). */
export function chaosKillsCurve(
  players: readonly PlayerVersion[],
  n: number,
  sliders: readonly number[] = CHAOS_SLIDERS,
  base: SimConfig = DEFAULT_SIM_CONFIG
): number[] {
  return sliders.map(
    (c) => computeRealismMetrics(runCorpus(players, "app", n, { ...base, comebackElasticity: c })).killsPerGame
  );
}
