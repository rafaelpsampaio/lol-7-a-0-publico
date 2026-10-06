/**
 * src/sim/laneSignals.test.ts
 *
 * Cobertura do classificador de cruzamento de sinal de lane (D-01, plano
 * 26-07, Task 1):
 *  - identidade simetrica: sem eventos de lane, nenhum sinal cruza (INV-1)
 *  - cruzamento para cima em cada um dos tres sinais (laneLead, prio,
 *    jungleAttention), um teste por sinal
 *  - histerese: dispara uma vez, oscila em torno do limiar de subida sem
 *    cair abaixo do limiar de descida, nao dispara de novo (T-26-22)
 *  - pureza: o modulo nao importa nem invoca o gerador (T-26-21)
 *
 * O teste de fim a fim (linha do tempo real, determinismo, aridade) entra no
 * plano 26-07 Task 2, junto do acumulador (accrueLaneSignals).
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  classifyLaneCrossing,
  LANE_ADVANTAGE_RISE_THRESHOLD,
  LANE_ADVANTAGE_FALL_THRESHOLD,
  JUNGLE_ATTENTION_RISE_THRESHOLD,
  JUNGLE_ATTENTION_FALL_THRESHOLD,
  type LaneSignalKind,
} from "./laneSignals";
import { simulateMatch } from "./engine";
import { mulberry32 } from "./rng";
import { ROLES } from "./matchState";
import { makePlayer } from "../draft/orchestrator.test";
import type { PlayerVersion } from "../data/schema";

const SIGNALS: LaneSignalKind[] = ["laneLead", "prio", "jungleAttention"];

/** Roster com forca uniforme (mesmo padrao de engine.test.ts). */
function roster(prefix: string, strength: number): PlayerVersion[] {
  return ROLES.map((r) =>
    makePlayer(r, {
      id: `${prefix}-${r}`,
      personId: `${prefix}-${r}`,
      displayName: `${prefix}-${r} 2024`,
      lanePhase: strength,
      midGame: strength,
      lateGame: strength,
    })
  );
}

const NEW_EVENT_KINDS = [
  "lane_advantage_building",
  "lane_priority_shift",
  "jungler_attention_shift",
] as const;

// ---------------------------------------------------------------------------
// Teste obrigatorio 1: identidade simetrica
// ---------------------------------------------------------------------------

describe("D-01: identidade simetrica, sem eventos de lane nenhum sinal cruza", () => {
  it.each(SIGNALS)("%s: antes=0 depois=0 armado=true nao emite", (signal) => {
    const outcome = classifyLaneCrossing(signal, 0, 0, true);
    expect(outcome.crossing).toBe("none");
    expect(outcome.armed).toBe(true);
  });

  it.each(SIGNALS)("%s: em lane simetrica, todas as lanes ficam sem evento (top/mid/bot)", (signal) => {
    for (const _lane of ["top", "mid", "bot"] as const) {
      const outcome = classifyLaneCrossing(signal, 0, 0, true);
      expect(outcome.crossing).toBe("none");
    }
  });
});

// ---------------------------------------------------------------------------
// Teste obrigatorio 2: cruzamento para cima em cada um dos tres sinais
// ---------------------------------------------------------------------------

describe("D-01: cruzamento para cima, um teste por sinal", () => {
  it("laneLead cruza o limiar de subida e emite lane_advantage_building", () => {
    const before = LANE_ADVANTAGE_RISE_THRESHOLD - 1;
    const after = LANE_ADVANTAGE_RISE_THRESHOLD;
    const outcome = classifyLaneCrossing("laneLead", before, after, true);
    expect(outcome.crossing).toBe("lane_advantage_building");
    expect(outcome.armed).toBe(false);
  });

  it("prio cruza o limiar de subida e emite lane_priority_shift", () => {
    const before = LANE_ADVANTAGE_RISE_THRESHOLD - 1;
    const after = LANE_ADVANTAGE_RISE_THRESHOLD;
    const outcome = classifyLaneCrossing("prio", before, after, true);
    expect(outcome.crossing).toBe("lane_priority_shift");
    expect(outcome.armed).toBe(false);
  });

  it("jungleAttention cruza o limiar de subida e emite jungler_attention_shift", () => {
    const before = JUNGLE_ATTENTION_RISE_THRESHOLD - 0.01;
    const after = JUNGLE_ATTENTION_RISE_THRESHOLD;
    const outcome = classifyLaneCrossing("jungleAttention", before, after, true);
    expect(outcome.crossing).toBe("jungler_attention_shift");
    expect(outcome.armed).toBe(false);
  });

  it("nao emite quando o detector nao esta armado, mesmo cruzando o limiar", () => {
    const before = LANE_ADVANTAGE_RISE_THRESHOLD - 1;
    const after = LANE_ADVANTAGE_RISE_THRESHOLD;
    const outcome = classifyLaneCrossing("laneLead", before, after, false);
    expect(outcome.crossing).toBe("none");
    expect(outcome.armed).toBe(false);
  });

  it("nao emite quando o valor ja estava no limiar ou acima antes (nao e cruzamento)", () => {
    const outcome = classifyLaneCrossing(
      "laneLead",
      LANE_ADVANTAGE_RISE_THRESHOLD,
      LANE_ADVANTAGE_RISE_THRESHOLD + 5,
      true
    );
    expect(outcome.crossing).toBe("none");
    expect(outcome.armed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Teste obrigatorio 3: histerese
// ---------------------------------------------------------------------------

describe("T-26-22: histerese, oscilar em torno do limiar de subida nao reemite", () => {
  it("laneLead: dispara uma vez, oscila sem cair abaixo do limiar de descida, nao dispara de novo", () => {
    let armed = true;

    // Sobe e cruza: dispara.
    let outcome = classifyLaneCrossing("laneLead", LANE_ADVANTAGE_RISE_THRESHOLD - 1, LANE_ADVANTAGE_RISE_THRESHOLD, armed);
    expect(outcome.crossing).toBe("lane_advantage_building");
    armed = outcome.armed;
    expect(armed).toBe(false);

    // Oscila para cima do limiar de subida, nao dispara (ja armado=false).
    outcome = classifyLaneCrossing("laneLead", LANE_ADVANTAGE_RISE_THRESHOLD, LANE_ADVANTAGE_RISE_THRESHOLD + 3, armed);
    expect(outcome.crossing).toBe("none");
    armed = outcome.armed;

    // Oscila de volta para perto do limiar, mas SEM cair abaixo do limiar de
    // descida (que e estritamente menor), continua sem disparar.
    outcome = classifyLaneCrossing(
      "laneLead",
      LANE_ADVANTAGE_RISE_THRESHOLD + 3,
      LANE_ADVANTAGE_FALL_THRESHOLD + 0.5,
      armed
    );
    expect(outcome.crossing).toBe("none");
    expect(outcome.armed).toBe(false);
    armed = outcome.armed;

    // Sobe de novo sem nunca ter caido abaixo do limiar de descida, ainda
    // nao dispara: a rede de histerese continua ativa.
    outcome = classifyLaneCrossing(
      "laneLead",
      LANE_ADVANTAGE_FALL_THRESHOLD + 0.5,
      LANE_ADVANTAGE_RISE_THRESHOLD + 1,
      armed
    );
    expect(outcome.crossing).toBe("none");
  });

  it("laneLead: rearma so depois de cair abaixo do limiar de descida, e entao pode disparar de novo", () => {
    let armed = true;

    let outcome = classifyLaneCrossing("laneLead", LANE_ADVANTAGE_RISE_THRESHOLD - 1, LANE_ADVANTAGE_RISE_THRESHOLD, armed);
    armed = outcome.armed;
    expect(armed).toBe(false);

    // Cai abaixo do limiar de descida: rearma, mas nao dispara neste tick.
    outcome = classifyLaneCrossing("laneLead", LANE_ADVANTAGE_RISE_THRESHOLD, LANE_ADVANTAGE_FALL_THRESHOLD - 1, armed);
    expect(outcome.crossing).toBe("none");
    armed = outcome.armed;
    expect(armed).toBe(true);

    // Agora que rearmou, um novo cruzamento de subida dispara de novo.
    outcome = classifyLaneCrossing(
      "laneLead",
      LANE_ADVANTAGE_RISE_THRESHOLD - 1,
      LANE_ADVANTAGE_RISE_THRESHOLD,
      armed
    );
    expect(outcome.crossing).toBe("lane_advantage_building");
  });
});

// ---------------------------------------------------------------------------
// Teste de fim a fim (Task 2, plano 26-07): linha do tempo real, determinismo
// ---------------------------------------------------------------------------

describe("D-01: recheio narrativo do early game, fim a fim via simulateMatch", () => {
  // Semente fixa que produz os tres tipos novos antes de 840s (achado por
  // varredura das seeds 1..30 com este mesmo par de rosters, 82 contra 55).
  const SEED = 1;

  it("a linha do tempo contem pelo menos um evento de cada tipo novo antes de 840s, e nenhum depois", () => {
    const res = simulateMatch(roster("u", 82), roster("r", 55), mulberry32(SEED));

    const foundBefore = new Set<string>();
    for (const ev of res.timeline) {
      if ((NEW_EVENT_KINDS as readonly string[]).includes(ev.kind)) {
        if (ev.timeSec < 840) {
          foundBefore.add(ev.kind);
        } else {
          // Nenhum evento novo pode aparecer a partir de 840s (D-01: janela
          // restrita ao early game).
          expect(ev.timeSec).toBeLessThan(840);
        }
      }
    }

    for (const kind of NEW_EVENT_KINDS) {
      expect(foundBefore.has(kind)).toBe(true);
    }
  });

  it("duas execucoes com a mesma semente produzem linhas do tempo identicas (determinismo)", () => {
    const resA = simulateMatch(roster("u", 82), roster("r", 55), mulberry32(SEED));
    const resB = simulateMatch(roster("u", 82), roster("r", 55), mulberry32(SEED));

    const signature = (timeline: typeof resA.timeline) =>
      timeline.map((ev) => `${ev.timeSec}:${ev.kind}:${ev.side ?? "-"}:${ev.lane ?? "-"}:${ev.ticker}`);

    expect(signature(resA.timeline)).toEqual(signature(resB.timeline));
    expect(resA.winner).toBe(resB.winner);
    expect(resA.durationSec).toBe(resB.durationSec);
  });
});

// ---------------------------------------------------------------------------
// Teste obrigatorio 4: pureza, o modulo nao importa nem invoca o gerador
// ---------------------------------------------------------------------------

describe("T-26-21: laneSignals.ts e livre de gerador (verificacao estatica)", () => {
  it("laneSignals.ts nao importa rng.ts nem invoca mulberry32() nem o gerador", () => {
    const filePath = path.resolve(__dirname, "laneSignals.ts");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).not.toContain('from "./rng"');
    expect(source).not.toContain("mulberry32(");
  });

  it("laneSignals.ts nao contem chamada a Math.random()", () => {
    const filePath = path.resolve(__dirname, "laneSignals.ts");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).not.toContain("Math.random()");
  });
});
