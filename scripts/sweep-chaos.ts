/**
 * scripts/sweep-chaos.ts
 *
 * Varredura da curva de abates por slider de Caos (spec 2026-10-02-calendario-e-volume) sobre
 * pontos de RealismTuning. Sem assercao.
 * Executar: npx tsx scripts/sweep-chaos.ts '<json: array de Partial<RealismTuning>>' [N]
 * Exemplo:  npx tsx scripts/sweep-chaos.ts '[{"bloodChaosCoef":0.6},{"bloodChaosCoef":1.0}]' 600
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = indice da partida; todos os pontos e sliders usam as mesmas seeds
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { readFileSync } from "node:fs";
import type { PlayerVersion } from "../src/data/schema";
import { DEFAULT_SIM_CONFIG } from "../src/sim/matchState";
import type { RealismTuning } from "../src/sim/tuning";
import { chaosKillsCurve, CHAOS_SLIDERS } from "./realism-metrics";

const points: Partial<RealismTuning>[] = JSON.parse(process.argv[2] ?? "[{}]");
const N = Number(process.argv[3] ?? 600);
const players: PlayerVersion[] = JSON.parse(readFileSync("public/players.json", "utf-8")).players;

console.log(`N=${N} por slider, cenario app, sliders ${CHAOS_SLIDERS.join(" / ")}`);
for (const p of points) {
  const curve = chaosKillsCurve(players, N, CHAOS_SLIDERS, { ...DEFAULT_SIM_CONFIG, tuning: p });
  const ok = curve.every((x, i) => i === 0 || x > curve[i - 1]) && curve[curve.length - 1] > 38;
  console.log(`ponto ${JSON.stringify(p)}: ${curve.map((x) => x.toFixed(2)).join(" / ")}  ${ok ? "OK" : "FORA"}`);
}
