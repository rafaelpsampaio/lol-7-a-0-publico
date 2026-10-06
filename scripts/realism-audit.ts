/**
 * scripts/realism-audit.ts
 *
 * Relatorio da regua de realismo (spec 2026-10-02-luta-mapa-vitoria). Sem assercao.
 * Executar: npm run realism   (REALISM_N=600 npm run realism para uma rodada rapida)
 * Escreve docs/diagnostics/realism-audit.txt.
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = indice da partida
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { readFileSync, writeFileSync } from "node:fs";
import type { PlayerVersion } from "../src/data/schema";
import {
  runCorpus,
  computeRealismMetrics,
  formatMetrics,
  chaosKillsCurve,
  CHAOS_SLIDERS,
} from "./realism-metrics";

const N = Number(process.env.REALISM_N ?? 1500);
const players: PlayerVersion[] = JSON.parse(readFileSync("public/players.json", "utf-8")).players;

const lines: string[] = [];
for (const scenario of ["app", "even75"] as const) {
  lines.push(...formatMetrics(scenario, computeRealismMetrics(runCorpus(players, scenario, N))));
  lines.push("");
}
const curve = chaosKillsCurve(players, Math.min(600, N), CHAOS_SLIDERS);
lines.push(
  `=== curva do Caos (cenario app, N=${Math.min(600, N)} por ponto) ===`,
  `abates por partida no slider ${CHAOS_SLIDERS.join(" / ")}: ${curve.map((x) => x.toFixed(2)).join(" / ")}`,
  ""
);
writeFileSync("docs/diagnostics/realism-audit.txt", lines.join("\n"));
console.log(lines.join("\n"));
