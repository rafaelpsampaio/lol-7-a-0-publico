/**
 * src/sim/cascade.test.ts
 *
 * Testes unit (TDD Wave 0 -- RED) para as funcoes rng-free de freio de cascata
 * estrutural (STR-05, Phase 18):
 *   - cascadeDamageMultiplier -- fator multiplicativo por-lane e global cross-lane
 *   - deriveBypass             -- detecta snowball legitimo que anula o freio
 *
 * Estas funcoes ainda nao existem em structures.ts (passo RED do TDD).
 * A execucao DEVE falhar por simbolo ausente.
 *
 * Per 18-VALIDATION.md Wave 0 Requirements e 18-RESEARCH.md Code Examples 1 e 2.
 */

import { describe, it, expect } from "vitest";
import {
  cascadeDamageMultiplier,
  deriveBypass,
  CASCADE_REDUCAO_MAX,
  CASCADE_N_LANE_SEC,
  CASCADE_REDUCAO_GLOBAL,
  CASCADE_N_GLOBAL_SEC,
} from "./structures";
import {
  freshStructureDamageState,
  createInitialMatchState,
  ROLES,
} from "./matchState";
import type { MatchState, TeamState } from "./matchState";
import { makePlayer } from "../draft/orchestrator.test";
import type { PlayerVersion } from "../data/schema";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function roster(prefix: string, s: number): PlayerVersion[] {
  return ROLES.map((r) =>
    makePlayer(r, {
      id: `${prefix}-${r}`,
      personId: `${prefix}-${r}`,
      displayName: `${prefix}-${r} 2024`,
      lanePhase: s,
      midGame: s,
      lateGame: s,
    })
  );
}

/** Cria um MatchState minimo com gameTimeSec e lastAnyStructureDestroyedAtSec controlados. */
function makeState(
  gameTimeSec: number,
  lastAnyStructureDestroyedAtSec: number | null = null,
  opts: {
    baronUntilSec?: number | null;
    elderUntilSec?: number | null;
    rivalAliveCount?: number;
    rivalNexusExposed?: boolean;
  } = {}
): MatchState {
  const ur = roster("u", 70);
  const rr = roster("r", 70);
  const state = createInitialMatchState(ur, rr);
  state.gameTimeSec = gameTimeSec;
  state.lastAnyStructureDestroyedAtSec = lastAnyStructureDestroyedAtSec;

  if (opts.baronUntilSec !== undefined) {
    state.buffs.baronUntilSec.user = opts.baronUntilSec;
  }
  if (opts.elderUntilSec !== undefined) {
    state.buffs.elderUntilSec.user = opts.elderUntilSec;
  }
  if (opts.rivalAliveCount !== undefined) {
    // Matar jogadores rival para atingir o aliveCount desejado
    let toKill = 5 - opts.rivalAliveCount;
    for (const r of ROLES) {
      if (toKill <= 0) break;
      state.rival.players[r].alive = false;
      toKill--;
    }
  }
  if (opts.rivalNexusExposed !== undefined) {
    state.rival.nexusExposed = opts.rivalNexusExposed;
  }
  return state;
}

// ---------------------------------------------------------------------------
// Testes de cascadeDamageMultiplier
// ---------------------------------------------------------------------------

describe("cascadeDamageMultiplier", () => {
  it("bypass=true retorna 1.0 sem freio (snowball legitimo)", () => {
    const pool = freshStructureDamageState();
    pool.lastStructureDestroyedAtSec = 300; // queda recente na lane
    const state = makeState(310, 300); // 10s apos queda
    expect(cascadeDamageMultiplier(pool, state, "user", true)).toBe(1.0);
  });

  it("pool.lastStructureDestroyedAtSec=null e lastAnyStructureDestroyedAtSec=null retornam 1.0 (nenhuma queda ainda)", () => {
    const pool = freshStructureDamageState(); // lastStructureDestroyedAtSec = null
    const state = makeState(600, null); // lastAnyStructureDestroyedAtSec = null
    expect(cascadeDamageMultiplier(pool, state, "user", false)).toBe(1.0);
  });

  it("gap por-lane = 0 (queda no mesmo instante) retorna CASCADE_REDUCAO_MAX", () => {
    const pool = freshStructureDamageState();
    pool.lastStructureDestroyedAtSec = 600;
    const state = makeState(600, null); // no mesmo instante, sem freio global
    const result = cascadeDamageMultiplier(pool, state, "user", false);
    // laneRatio = 0 -> laneMultiplier = CASCADE_REDUCAO_MAX + (1-CASCADE_REDUCAO_MAX)*0 = CASCADE_REDUCAO_MAX
    // globalMultiplier = 1.0 (sem queda global)
    // retorno = min(CASCADE_REDUCAO_MAX, 1.0) = CASCADE_REDUCAO_MAX
    expect(result).toBeCloseTo(CASCADE_REDUCAO_MAX, 5);
  });

  it("gap por-lane >= CASCADE_N_LANE_SEC retorna 1.0 (freio completamente decaido)", () => {
    const pool = freshStructureDamageState();
    pool.lastStructureDestroyedAtSec = 600;
    const state = makeState(600 + CASCADE_N_LANE_SEC, null); // exatamente na janela
    const result = cascadeDamageMultiplier(pool, state, "user", false);
    // laneRatio = min(1.0, N_LANE/N_LANE) = 1.0 -> laneMultiplier = CASCADE_REDUCAO_MAX + (1-CASCADE_REDUCAO_MAX)*1 = 1.0
    expect(result).toBeCloseTo(1.0, 5);
  });

  it("gap por-lane = CASCADE_N_LANE_SEC/2 retorna interpolacao linear esperada", () => {
    const pool = freshStructureDamageState();
    pool.lastStructureDestroyedAtSec = 600;
    const state = makeState(600 + CASCADE_N_LANE_SEC / 2, null);
    const result = cascadeDamageMultiplier(pool, state, "user", false);
    // laneRatio = 0.5 -> laneMultiplier = CASCADE_REDUCAO_MAX + (1 - CASCADE_REDUCAO_MAX) * 0.5
    const expected = CASCADE_REDUCAO_MAX + (1.0 - CASCADE_REDUCAO_MAX) * 0.5;
    expect(result).toBeCloseTo(expected, 5);
  });

  it("retorno final e o minimo entre freio por-lane e freio global", () => {
    // Cenario: lane completamente decaida (laneMultiplier=1.0), freio global ainda ativo
    const pool = freshStructureDamageState();
    // Queda na lane ha muito tempo (>= CASCADE_N_LANE_SEC antes do agora)
    const now = 1200;
    pool.lastStructureDestroyedAtSec = now - CASCADE_N_LANE_SEC; // lane completamente decaida
    // Queda global recente: exatamente metade da janela global antes de agora
    const lastGlobal = now - CASCADE_N_GLOBAL_SEC / 2;
    const state = makeState(now, lastGlobal);
    // laneRatio = 1.0 -> laneMultiplier = 1.0
    // globalRatio = 0.5 -> globalMultiplier = CASCADE_REDUCAO_GLOBAL + (1-CASCADE_REDUCAO_GLOBAL)*0.5
    const globalExpected = CASCADE_REDUCAO_GLOBAL + (1.0 - CASCADE_REDUCAO_GLOBAL) * 0.5;
    const result = cascadeDamageMultiplier(pool, state, "user", false);
    // min(1.0, globalExpected) = globalExpected (pois globalExpected < 1.0)
    expect(result).toBeCloseTo(globalExpected, 5);
  });
});

// ---------------------------------------------------------------------------
// Testes de deriveBypass
// ---------------------------------------------------------------------------

describe("deriveBypass", () => {
  it("enemy.nexusExposed=true retorna true", () => {
    const state = makeState(900, null, { rivalNexusExposed: true });
    const enemy = state.rival;
    expect(deriveBypass(state, "user", enemy)).toBe(true);
  });

  it("Baron ativo (hasBaronBuff) retorna true", () => {
    const state = makeState(900, null, { baronUntilSec: 900 + 180 }); // baron expira no futuro
    const enemy = state.rival;
    expect(deriveBypass(state, "user", enemy)).toBe(true);
  });

  it("Elder ativo (elderUntilSec[side] > gameTimeSec) retorna true", () => {
    const state = makeState(900, null, { elderUntilSec: 900 + 150 }); // elder expira no futuro
    const enemy = state.rival;
    expect(deriveBypass(state, "user", enemy)).toBe(true);
  });

  it("ace/wipe (aliveCount(enemy) <= 2) retorna true", () => {
    const state = makeState(900, null, { rivalAliveCount: 2 }); // 3 de 5 mortos
    const enemy = state.rival;
    expect(deriveBypass(state, "user", enemy)).toBe(true);
  });

  it("nenhum dos casos (5 inimigos vivos, sem buffs, nexus protegido) retorna false", () => {
    const state = makeState(900, null); // rival tem 5 jogadores vivos, sem buffs, sem nexus exposto
    const enemy = state.rival;
    // Confirmar que rival tem 5 vivos
    const aliveRival = ROLES.filter((r) => state.rival.players[r].alive).length;
    expect(aliveRival).toBe(5);
    expect(deriveBypass(state, "user", enemy)).toBe(false);
  });
});
