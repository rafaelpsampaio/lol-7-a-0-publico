/**
 * src/sim/structureActor.test.ts
 *
 * Testes unit (TDD Wave 0 -- RED) para as funcoes de plausibilidade de ator
 * estrutural (STR-06, Phase 18 Plan 02):
 *   - buildStructureActorCandidates -- filtra candidatos por lane/fase/gank
 *   - deriveGankContext             -- sinal de gank/dive derivado de estado existente
 *   - laneToRole                    -- mapeamento lane -> role do laner natural
 *
 * Per 18-RESEARCH.md Pattern 2 e Pattern 3; 18-PATTERNS.md buildStructureActorCandidates
 * e deriveGankContext; calibracao "Pesos por lane".
 *
 * STEP RED: estas funcoes ainda NAO existem em structures.ts.
 * A execucao DEVE falhar por simbolo ausente.
 */

import { describe, it, expect } from "vitest";
import {
  buildStructureActorCandidates,
  deriveGankContext,
} from "./structures";
import {
  ROLES,
  createInitialMatchState,
} from "./matchState";
import type { TeamState, MatchState } from "./matchState";
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

/**
 * Cria um MatchState minimo com todos os 5 jogadores de cada time vivos.
 * gameTimeSec e laneLead sao controlaveis.
 */
function makeState(
  gameTimeSec: number,
  opts: {
    userLaneLeadTop?: number;
    userLaneLeadMid?: number;
    userLaneLeadBot?: number;
    rivalAliveCount?: number; // quantos inimigos ficam vivos (mata do final da lista)
    userAliveCount?: number;  // quantos aliados ficam vivos
    baronUntilSec?: number | null;
    heraldDone?: boolean;
  } = {}
): MatchState {
  const ur = roster("u", 70);
  const rr = roster("r", 70);
  const state = createInitialMatchState(ur, rr);
  state.gameTimeSec = gameTimeSec;

  // Controlar lane leads (proxy de gank context via A+C)
  if (opts.userLaneLeadTop !== undefined) {
    state.user.laneState["top"].laneLead = opts.userLaneLeadTop;
  }
  if (opts.userLaneLeadMid !== undefined) {
    state.user.laneState["mid"].laneLead = opts.userLaneLeadMid;
  }
  if (opts.userLaneLeadBot !== undefined) {
    state.user.laneState["bot"].laneLead = opts.userLaneLeadBot;
  }

  // Controlar vivos do time inimigo (para vantagem numerica)
  if (opts.rivalAliveCount !== undefined) {
    let toKill = 5 - opts.rivalAliveCount;
    for (const r of ROLES) {
      if (toKill <= 0) break;
      state.rival.players[r].alive = false;
      toKill--;
    }
  }

  // Controlar vivos do time user
  if (opts.userAliveCount !== undefined) {
    let toKill = 5 - opts.userAliveCount;
    for (const r of ROLES) {
      if (toKill <= 0) break;
      state.user.players[r].alive = false;
      toKill--;
    }
  }

  if (opts.baronUntilSec !== undefined) {
    state.buffs.baronUntilSec.user = opts.baronUntilSec;
  }

  if (opts.heraldDone !== undefined) {
    state.objectives.heraldDone = opts.heraldDone;
  }

  return state;
}

/** Extrai os roles dos candidatos retornados. */
function rolesOf(candidates: { role: string }[]): string[] {
  return candidates.map((p) => p.role);
}

// ---------------------------------------------------------------------------
// Testes de buildStructureActorCandidates
// ---------------------------------------------------------------------------

describe("buildStructureActorCandidates", () => {
  it("early, lane=top, sem gank, sem Baron/Herald: candidatos = [top laner] (sem support, sem ADC)", () => {
    const state = makeState(300); // 5:00 -- early
    const team = state.user;
    const roles = rolesOf(
      buildStructureActorCandidates(team, "top", 300, false, false)
    );
    // Apenas o laner de top deve aparecer
    expect(roles).toContain("top");
    expect(roles).toHaveLength(1);
    expect(roles).not.toContain("support");
    expect(roles).not.toContain("adc");
  });

  it("early, lane=top, com gank: candidatos = [top laner, jungler] (2 elementos)", () => {
    const state = makeState(300);
    const team = state.user;
    const roles = rolesOf(
      buildStructureActorCandidates(team, "top", 300, true, false)
    );
    expect(roles).toContain("top");
    expect(roles).toContain("jungle");
    expect(roles).toHaveLength(2);
    expect(roles).not.toContain("support");
    expect(roles).not.toContain("adc");
  });

  it("early, lane=bot, sem gank: candidatos = [adc] (bot laner natural; support ausente)", () => {
    const state = makeState(300);
    const team = state.user;
    const roles = rolesOf(
      buildStructureActorCandidates(team, "bot", 300, false, false)
    );
    expect(roles).toContain("adc");
    expect(roles).toHaveLength(1);
    expect(roles).not.toContain("support");
  });

  it("early, lane=mid, sem gank: candidatos = [mid] (sem support, sem ADC fora de bot)", () => {
    const state = makeState(300);
    const team = state.user;
    const roles = rolesOf(
      buildStructureActorCandidates(team, "mid", 300, false, false)
    );
    expect(roles).toContain("mid");
    expect(roles).toHaveLength(1);
    expect(roles).not.toContain("support");
    expect(roles).not.toContain("adc");
  });

  it("early, lane=top, com Baron/Herald ativo: distribuicao aberta = todos os vivos", () => {
    const state = makeState(300);
    const team = state.user;
    const roles = rolesOf(
      buildStructureActorCandidates(team, "top", 300, false, true)
    );
    // Todos os 5 vivos devem ser candidatos
    expect(roles).toHaveLength(5);
    expect(roles).toContain("support");
    expect(roles).toContain("adc");
    expect(roles).toContain("top");
  });

  it("pos-14:00 (gameSec>=840): distribuicao aberta = todos os vivos", () => {
    const state = makeState(900); // 15:00 -- mid/late
    const team = state.user;
    const roles = rolesOf(
      buildStructureActorCandidates(team, "top", 900, false, false)
    );
    // Todos os 5 vivos sao candidatos
    expect(roles).toHaveLength(5);
    expect(roles).toContain("support");
    expect(roles).toContain("adc");
  });

  it("support NUNCA aparece como candidato em early sem macro (lane=top)", () => {
    const state = makeState(600);
    const team = state.user;
    const roles = rolesOf(
      buildStructureActorCandidates(team, "top", 600, false, false)
    );
    expect(roles).not.toContain("support");
  });

  it("ADC NUNCA aparece como candidato de top em early sem Baron/Herald", () => {
    const state = makeState(600);
    const team = state.user;
    const roles = rolesOf(
      buildStructureActorCandidates(team, "top", 600, true, false) // com gank mas sem Baron
    );
    expect(roles).not.toContain("adc");
  });

  it("ADC NUNCA aparece como candidato de mid em early sem Baron/Herald", () => {
    const state = makeState(600);
    const team = state.user;
    const roles = rolesOf(
      buildStructureActorCandidates(team, "mid", 600, false, false)
    );
    expect(roles).not.toContain("adc");
  });

  it("fallback: se candidatos especificos = zero vivos aplicaveis, retorna todos os vivos", () => {
    // Matar o top laner do user para testar fallback
    const state = makeState(300);
    const team = state.user;
    team.players.top.alive = false;
    // Early, top, sem gank, sem macro -- top esta morto, fallback para alive
    const roles = rolesOf(
      buildStructureActorCandidates(team, "top", 300, false, false)
    );
    // Fallback: todos os vivos (4 restantes)
    expect(roles.length).toBeGreaterThan(0);
    expect(roles).not.toContain("top"); // top esta morto
  });
});

// ---------------------------------------------------------------------------
// Testes de deriveGankContext
// ---------------------------------------------------------------------------

describe("deriveGankContext", () => {
  it("aliveCount(team) > aliveCount(enemy): retorna true (vantagem numerica)", () => {
    // user com 5 vivos, rival com 3 vivos -> vantagem numerica
    const state = makeState(300, { rivalAliveCount: 3 });
    expect(deriveGankContext(state, "user", "top")).toBe(true);
  });

  it("laneState[lane].laneLead > 20: retorna true (lane lead alto como proxy de gank)", () => {
    // 5v5 (sem vantagem numerica), mas laneLead alto
    const state = makeState(300, { userLaneLeadTop: 25 });
    expect(deriveGankContext(state, "user", "top")).toBe(true);
  });

  it("sem vantagem numerica e laneLead baixo: retorna false", () => {
    // 5v5, laneLead=0 (equilibrado)
    const state = makeState(300, { userLaneLeadTop: 0 });
    expect(deriveGankContext(state, "user", "top")).toBe(false);
  });

  it("laneLead exatamente 20 (nao maior): retorna false (limiar e > 20, nao >=)", () => {
    const state = makeState(300, { userLaneLeadTop: 20 });
    // 5v5, laneLead=20 -- limiar e >20, entao deve retornar false
    expect(deriveGankContext(state, "user", "top")).toBe(false);
  });

  it("laneLead=21: retorna true (acima do limiar)", () => {
    const state = makeState(300, { userLaneLeadTop: 21 });
    expect(deriveGankContext(state, "user", "top")).toBe(true);
  });
});
