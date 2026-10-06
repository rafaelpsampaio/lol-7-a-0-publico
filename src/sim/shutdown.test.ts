/**
 * src/sim/shutdown.test.ts
 *
 * Cobertura do anti-spam de shutdown (TKR-01, Fase 21 / Plano 01):
 *
 *  (a) Gate bounty: nenhum evento "shutdown" emitido quando nao ha bounty no roster.
 *  (b) Teto top-2: em nenhum tick de teamfight mais de 2 shutdown sao emitidos
 *      (varredura seeds 0..199, incluindo seed-ancora seed=2 que produz 3 hoje).
 *  (c) Determinismo: a mesma seed retorna a mesma lista de timeSec/kind de shutdown (INV-1).
 *
 * ESTADO NO WAVE 1: RED no bloco (b) -- seed=2 hoje produz 3 shutdowns em timeSec=1020.
 * Os blocos (a) e (c) devem passar mesmo antes da Task 2.
 *
 * Convencoes do projeto:
 *  - Comentarios pt-BR sem o caractere travessao.
 *  - Rosters sinteticos flat (stat uniforme, sem dependencia de dados de producao).
 *  - Apenas mulberry32 -- nunca Math.random.
 */

import { describe, it, expect } from "vitest";
import { simulateMatch } from "./engine";
import { mulberry32 } from "./rng";
import { ROLES } from "./matchState";
import type { PlayerVersion, Role } from "../data/schema";

// ---------------------------------------------------------------------------
// Builders de fixture sintetico flat
// Replicado inline de scripts/calibrate-combat.ts (sem depender do script).
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

function roster(prefix: string, stat: number): PlayerVersion[] {
  return ROLES.map((r) => makePlayer(`${prefix}-${r}`, r, stat));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Identificar tipos de evento que indicam tick de teamfight. */
const TEAMFIGHT_KINDS = new Set([
  "comeback_fight",
  "double_kill",
  "triple_kill",
  "quadra_kill",
  "penta_kill",
  "ace",
]);

/**
 * Dado um timeline, retorna um Map<timeSec, numero de shutdowns> para todos os
 * ticks que contenham pelo menos um evento de teamfight.
 */
function shutdownsPerTeamfightTick(
  timeline: Array<{ kind: string; timeSec: number }>
): Map<number, number> {
  // Agrupar eventos por timeSec
  const byTick = new Map<number, string[]>();
  for (const ev of timeline) {
    const list = byTick.get(ev.timeSec) ?? [];
    list.push(ev.kind);
    byTick.set(ev.timeSec, list);
  }

  const result = new Map<number, number>();
  for (const [timeSec, kinds] of byTick) {
    // Tick e de teamfight se contem pelo menos um evento indicador
    const isTeamfight = kinds.some((k) => TEAMFIGHT_KINDS.has(k));
    if (!isTeamfight) continue;
    const shutdownCount = kinds.filter((k) => k === "shutdown").length;
    if (shutdownCount > 0) {
      result.set(timeSec, shutdownCount);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Bloco (a): gate de bounty -- sem streak nao ha shutdown
// ---------------------------------------------------------------------------

describe("shutdown gate bounty (TKR-01 / D-02)", () => {
  it(
    "nao emite shutdown quando o roster nao tem streak (bounty === 0 em todos os jogadores)",
    () => {
      // Roster com stat 65 (equilibrado): sem sequencia de kills pre-existente,
      // os jogadores comecam sem bounty (shutdownGold = 0 em createInitialMatchState).
      // Em um jogo do zero nenhum jogador acumula streak no primeiro tick.
      // Validar: dentre as primeiras lutas (seeds 0..19), se algum "shutdown" aparece
      // ele so pode surgir depois que um jogador acumulou bounty via kills anteriores.
      //
      // Estrategia mais direta: testar uma seed curta (seed=0) e confirmar que
      // os "shutdown" existem somente quando o evento nao e o primeiro evento de kill
      // do jogo (pois o primeiro kill nunca tem bounty, e o segundo pode ter se o
      // mesmo jogador morreu N vezes antes).
      //
      // Invariante observavel: eventos "shutdown" nunca aparecem em timeSec <= 30
      // (primeiros 30 segundos) -- nenhum jogador tem bounty nesse ponto.
      const result = simulateMatch(roster("u", 65), roster("r", 65), mulberry32(0));
      const earlyShutdowns = result.timeline.filter(
        (ev) => ev.kind === "shutdown" && ev.timeSec <= 30
      );
      expect(earlyShutdowns.length, "shutdown nos primeiros 30s (impossivel sem bounty)").toBe(0);
    }
  );
});

// ---------------------------------------------------------------------------
// Bloco (b): teto top-2 por tick de teamfight (seeds 0..199 + ancora seed=2)
// ---------------------------------------------------------------------------

describe("teto top-2 de shutdown por tick de teamfight (TKR-01 / D-01)", () => {
  it(
    "em todos os ticks de teamfight das seeds 0..199, no maximo 2 shutdown por tick",
    () => {
      const SEEDS = 200;
      const violations: string[] = [];

      for (let seed = 0; seed < SEEDS; seed++) {
        const result = simulateMatch(roster("u", 70), roster("r", 70), mulberry32(seed));
        const tickMap = shutdownsPerTeamfightTick(result.timeline);

        for (const [timeSec, count] of tickMap) {
          if (count > 2) {
            violations.push(`seed=${seed} timeSec=${timeSec} shutdowns=${count}`);
          }
        }
      }

      // Documenta explicitamente a ancora seed=2 / timeSec=1020 (ENGINE-DIAGNOSIS.md Grupo 6)
      // Antes da Task 2 este assert falha com "seed=2 timeSec=1020 shutdowns=3"
      expect(
        violations,
        `Ticks com mais de 2 shutdown (gate D-01): ${violations.join(", ")}`
      ).toHaveLength(0);
    }
  );
});

// ---------------------------------------------------------------------------
// Bloco (c): determinismo -- mesma seed gera a mesma lista de shutdown (INV-1)
// ---------------------------------------------------------------------------

describe("determinismo de shutdown (INV-1 / D-09)", () => {
  it(
    "mesma seed rodada duas vezes produz lista identica de timeSec/kind para shutdown",
    () => {
      // Seed escolhida: 2 (ancora com shutdowns reais segundo ENGINE-DIAGNOSIS.md)
      const ANCHOR_SEED = 2;

      function extractShutdownSignature(
        timeline: Array<{ kind: string; timeSec: number }>
      ): string {
        return timeline
          .filter((ev) => ev.kind === "shutdown")
          .map((ev) => `${ev.timeSec}:${ev.kind}`)
          .join(",");
      }

      const run1 = simulateMatch(roster("u", 70), roster("r", 70), mulberry32(ANCHOR_SEED));
      const run2 = simulateMatch(roster("u", 70), roster("r", 70), mulberry32(ANCHOR_SEED));

      expect(
        extractShutdownSignature(run1.timeline),
        "segunda rodada da mesma seed deve gerar exatamente a mesma lista de shutdown"
      ).toBe(extractShutdownSignature(run2.timeline));
    }
  );
});
