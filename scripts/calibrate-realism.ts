/**
 * scripts/calibrate-realism.ts
 *
 * Gate da regua de realismo (spec 2026-10-02-luta-mapa-vitoria, secao Medicao e aceite).
 * Executar: npm run calibrate:realism  (via vitest, config dedicada)
 *
 * Gate das duas specs de 2026-10-02 (luta-mapa-vitoria e calendario-e-volume). As bandas do calendario
 * nascem VERMELHAS de proposito na Task 1 do plano do calendario e ficam verdes na Task 7.
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = indice da partida, nunca seed compartilhada
 *   - Sem Math.random: apenas mulberry32(seed)
 *   - Assert duro separado visualmente do assert tolerante (banda)
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { PlayerVersion } from "../src/data/schema";
import { checkBand, expectBands, formatBandTable } from "./bands";
import {
  runCorpus,
  computeRealismMetrics,
  chaosKillsCurve,
  CHAOS_SLIDERS,
  REALISM_BAND_SPECS,
  REALISM_SOURCE,
} from "./realism-metrics";

const N = 1500;
const players: PlayerVersion[] = JSON.parse(readFileSync("public/players.json", "utf-8")).players;

describe("calibrate-realism", () => {
  const games = runCorpus(players, "app", N);
  const m = computeRealismMetrics(games);

  it("ASSERT DURO: zero violacao de regra dura", () => {
    expect(m.hardRuleViolations).toBe(0);
  });

  it("ASSERT DURO: mesma seed gera a mesma partida", () => {
    // SimEvent.id vem de um contador global do modulo do motor (__eventCounter) e muda entre
    // execucoes mesmo com a mesma seed; por isso o id sai da comparacao.
    const strip = (g: { result: { timeline: { id: string }[] } }) =>
      JSON.stringify(g.result.timeline.map(({ id: _id, ...rest }) => rest));
    const a = runCorpus(players, "app", 3);
    const b = runCorpus(players, "app", 3);
    expect(a.map(strip)).toEqual(b.map(strip));
  });

  it("BANDAS: travas e aceite no cenario app", () => {
    const results = REALISM_BAND_SPECS.map((b) =>
      checkBand(b.label, m[b.key] as number, {
        floor: b.floor,
        ceiling: b.ceiling,
        target: b.target,
        source: REALISM_SOURCE,
        owner: "specs luta-mapa-vitoria e calendario-e-volume",
      })
    );
    console.log(formatBandTable(results));
    expectBands(results);
  });

  it("CAOS: abates por partida sobem com o slider e passam de 38 no maximo", () => {
    const curve = chaosKillsCurve(players, 600, CHAOS_SLIDERS);
    console.log(
      `abates por partida no slider ${CHAOS_SLIDERS.join(" / ")}: ${curve.map((x) => x.toFixed(2)).join(" / ")}`
    );
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThan(curve[i - 1]);
    expect(curve[curve.length - 1]).toBeGreaterThan(38);
  });

  it("EMENDA: o preparo do Barao leva mais tempo que o do dragao (do nascimento ao aviso)", () => {
    console.log(`aviso de preparo: dragao ${m.dragonSetupDelaySec} s, Barao ${m.baronSetupDelaySec} s depois de nascer`);
    expect(m.baronSetupDelaySec).toBeGreaterThan(m.dragonSetupDelaySec);
  });
});
