/**
 * scripts/sweep-realism.ts
 *
 * Varredura da regua de realismo sobre pontos de RealismTuning (spec 2026-10-02). Sem assercao.
 * Executar: npx tsx scripts/sweep-realism.ts '<json: array de Partial<RealismTuning>>' [N] ['<json: Partial<SimConfig>>']
 * Exemplo:  npx tsx scripts/sweep-realism.ts '[{"passiveBasePerMin":240},{"passiveBasePerMin":290}]' 600
 * Exemplo:  npx tsx scripts/sweep-realism.ts '[{}]' 1500 '{"ratingPowerD":250}'
 *
 * O terceiro argumento (opcional) sobrescreve campos de SimConfig por cima de DEFAULT_SIM_CONFIG
 * em todos os pontos; o ponto de tuning de cada linha continua valendo por cima de
 * DEFAULT_REALISM_TUNING. Cada ponto imprime as metricas e uma linha FORA (k) com as bandas de
 * REALISM_BAND_SPECS (travas incluidas) fora no ponto.
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = indice da partida; todos os pontos usam as mesmas seeds
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { readFileSync } from "node:fs";
import type { PlayerVersion } from "../src/data/schema";
import { DEFAULT_SIM_CONFIG, type SimConfig } from "../src/sim/matchState";
import type { RealismTuning } from "../src/sim/tuning";
import {
  runCorpus,
  computeRealismMetrics,
  REALISM_BAND_SPECS,
  type RealismMetrics,
} from "./realism-metrics";

const points: Partial<RealismTuning>[] = JSON.parse(process.argv[2] ?? "[{}]");
const N = Number(process.argv[3] ?? 600);
const configOverrides: Partial<SimConfig> = JSON.parse(process.argv[4] ?? "{}");
const players: PlayerVersion[] = JSON.parse(readFileSync("public/players.json", "utf-8")).players;

const COLS: (keyof RealismMetrics)[] = [
  "durationMeanMin", "capFraction", "hardRuleViolations", "gpmTeamMean", "teamGoldAt10", "teamGoldAt20",
  "killsPerGame", "killsAt10", "killsAt15", "killsAt20", "killsPerMin20to25", "firstBloodMedianSec",
  "firstBloodP10Sec", "firstBloodBefore90Frac", "noKillBy10Frac", "firstDragonMedianSec",
  "firstDragonBefore360Frac", "dragonsPerGame", "soulFrac", "elderFrac", "baronsPerGame", "gamesWithBaronFrac",
  "baronAtSpawnFrac", "firstTowerMedianSec", "firstTowerP10Sec", "towersAt15", "towersAt20", "towersPerGame",
  "killLeaderAt20Wins", "goldLeaderAt20Wins", "goldLeaderAt25Wins", "killRatioWinnerLoser",
  "winnerBehindGoldFrac", "goldDiffWinnerLoserMean", "gpmRatioWinnerLoser", "favoriteGap5Wins",
  "favoriteGapUnder1Wins", "firstBaronWins", "soulWins", "firstTowerWins", "stealFraction",
  "goldLeaderAt15Wins", "winnerMoreKillsFrac",
];

const fmt = (x: number) => (Number.isNaN(x) ? "n/a" : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(3));

const extra = Object.keys(configOverrides).length > 0 ? `, SimConfig ${JSON.stringify(configOverrides)}` : "";
console.log(`N=${N} por ponto, cenario app${extra}`);
for (const p of points) {
  const config: SimConfig = { ...DEFAULT_SIM_CONFIG, ...configOverrides, tuning: p };
  const m = computeRealismMetrics(runCorpus(players, "app", N, config));
  const out = REALISM_BAND_SPECS.filter((b) => {
    const v = m[b.key] as number;
    return Number.isNaN(v) || v < b.floor || v > b.ceiling;
  }).map((b) => b.key);
  console.log(`\nponto ${JSON.stringify(p)}`);
  console.log("  " + COLS.map((c) => `${c}=${fmt(m[c] as number)}`).join(" | "));
  console.log(`  FORA (${out.length}): ${out.join(", ")}`);
}
