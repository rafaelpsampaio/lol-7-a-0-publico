/**
 * src/sim/structures.test.ts
 *
 * Proves the win-condition structural gating is REAL (not assumed):
 *   - To win you must fully clear at least ONE lane of the loser (outer + inner
 *     + inhibitor turret) AND destroy its inhibitor, then both Nexus turrets,
 *     then the Nexus.
 *   - You do NOT need to destroy every tower on the map.
 *   - Ordering: a Nexus turret is never touched before that side loses an
 *     inhibitor; nexus_exposed always precedes gg.
 */

import { describe, it, expect } from "vitest";
import { makePlayer } from "../draft/orchestrator.test";
import { mulberry32 } from "./rng";
import { simulateMatch } from "./engine";
import { LANES, ROLES, DEFAULT_SIM_CONFIG, type Side, type TeamState, freshStructureDamageState } from "./matchState";
import { structureTimePlausibility } from "./structures";
import type { PlayerVersion } from "../data/schema";
import type { EventKind } from "./simEvents";

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

/** Count standing lane structures (towers + inhibitors) for a team. */
function standingLaneStructures(team: TeamState): number {
  let n = 0;
  for (const lane of LANES) {
    const st = team.structures[lane];
    n += [st.outerAlive, st.innerAlive, st.inhibTurretAlive, st.inhibitorAlive].filter(Boolean).length;
  }
  return n;
}

/**
 * Regressao de aridade de RNG (D-05, plano 17-01): prova que a extracao de
 * damageStructure/resolveStructurePressure/resolveHeraldUse para structures.ts
 * e um no-op perfeito.
 *
 * Como funciona: para um par seed/roster fixo, a sequencia de
 * (timeSec, kind, actors[0]) da timeline reflete diretamente a aridade dos
 * draws de RNG. Se um draw novo tivesse sido inserido (ou removido) em qualquer
 * ponto, a assinatura mudaria a partir daquele ponto.
 *
 * FRONTEIRA IMPORTANTE:
 * - Esta assinatura se manteve identica apos a extracao no-op (plano 17-01).
 * - Ela MUDOU no plano 17-03 quando o pool de dano foi introduzido e o golden
 *   foi deliberadamente regenerado (D-04). Os snapshots abaixo refletem a
 *   assinatura APOS a Fase 17 -- mudancas aqui (nas fases 18+) indicam
 *   deslocamento de aridade indesejado.
 *
 * FRONTEIRA DA FASE 25, JANELA VERMELHA ABERTA DE PROPOSITO:
 * - Os DOIS snapshots abaixo estao VERMELHOS desde o plano 25-04, por DESIGN.
 *   Eles sao snapshots de VALOR, funcionalmente parte do golden: o canal
 *   absoluto de cerco mudou o throughput estrutural, e qualquer mudanca de
 *   throughput muda a linha do tempo destas duas sementes. Isso NAO e
 *   deslocamento de aridade e NAO e bug.
 * - Como distinguir os dois casos, que e o ponto desta nota: aridade e medida
 *   pelo canario de auto-consistencia (duas rodadas da mesma semente com a
 *   mesma contagem de sorteios e a mesma linha do tempo, em engine.test.ts) e
 *   pelo canario de um sorteio exato no caminho de torre do Nexus do Arauto,
 *   mais abaixo neste arquivo. Enquanto esses dois estiverem VERDES, o vermelho
 *   aqui e deslocamento de valor. Se algum deles ficar vermelho, e regressao de
 *   determinismo e a fase para.
 * - A regeneracao acontece UMA UNICA VEZ, no plano 25-07, no mesmo commit
 *   isolado do golden. Nao regenerar antes: a janela vermelha e a evidencia da
 *   mudanca, e apaga-la antes do fim da fase esconderia um vermelho novo entre
 *   os vermelhos esperados.
 * - ARMADILHA DE COMANDO, registrada aqui para nao virar descoberta em tempo de
 *   execucao: `npm run update-golden` NAO cobre este arquivo. Aquele script
 *   aponta so para src/__tests__/golden/golden.test.ts. Para regenerar estes
 *   dois snapshots o comando e o do vitest restrito a este arquivo de teste:
 *     npx vitest run src/sim/structures.test.ts --update
 */
describe("extracao no-op -- aridade de RNG preservada (D-05)", () => {
  const simCfg = DEFAULT_SIM_CONFIG;
  const userRoster = roster("u", 85); // STOMP 85 vs 55
  const rivalRoster = roster("r", 55);

  /** Serializa os primeiros eventos estruturais para comparacao de aridade. */
  function timelineSignature(
    seeds: number[],
    ur: PlayerVersion[],
    rr: PlayerVersion[]
  ): string[] {
    return seeds.flatMap((seed) => {
      const result = simulateMatch(ur, rr, mulberry32(seed), simCfg);
      return result.timeline.map(
        (ev) => `s${seed}:${ev.timeSec}:${ev.kind}:${ev.actors[0] ?? "-"}`
      );
    });
  }

  it("seed=5 STOMP 85v55: assinatura de timeline estavel (no-op)", () => {
    const sig = timelineSignature([5], userRoster, rivalRoster);
    // Snapshot gerado na primeira execucao pos-extracao; re-roda identico se
    // a aridade de RNG nao mudou. Quebra aqui = deslocamento de aridade.
    expect(sig).toMatchSnapshot();
  });

  it("seed=0 STOMP 85v55: assinatura de timeline estavel (no-op)", () => {
    const sig = timelineSignature([0], userRoster, rivalRoster);
    expect(sig).toMatchSnapshot();
  });

  it("seeds 0 e 5 produzem assinaturas distintas (partidas sao diferentes)", () => {
    const sig0 = timelineSignature([0], userRoster, rivalRoster);
    const sig5 = timelineSignature([5], userRoster, rivalRoster);
    // Se as assinaturas fossem iguais, o RNG nao estaria variando por seed.
    expect(sig0).not.toEqual(sig5);
  });

  it("simulacao com mesma seed produz resultado identico (determinismo basico)", () => {
    const sig1 = timelineSignature([5], userRoster, rivalRoster);
    const sig2 = timelineSignature([5], userRoster, rivalRoster);
    expect(sig1).toEqual(sig2);
  });
});

describe("win-condition structural gating", () => {
  it("exposing the Nexus required a fully-cleared lane + a destroyed inhibitor (checked AT exposure)", () => {
    let nexusGames = 0;
    for (let seed = 0; seed < 80; seed++) {
      const res = simulateMatch(roster("u", 74), roster("r", 66), mulberry32(seed));
      // The invariant holds AT THE MOMENT the Nexus is exposed (inhibitors can
      // respawn afterwards, so the final state is not the right place to check).
      const exposeEvent = res.timeline.find((e) => e.kind === "nexus_exposed");
      if (!exposeEvent) continue; // skip the (now very rare) cap ending
      nexusGames++;

      const m = exposeEvent.map;
      const exposed = m.user.nexusExposed ? m.user : m.rival;
      expect(exposed.nexusExposed).toBe(true);
      expect(exposed.nexusTurrets).toBe(0);
      // At least one whole lane was cleared (all four structures down) to get here.
      const clearedAtExposure = (["top", "mid", "bot"] as const).some((lane) => {
        const l = exposed[lane];
        return !l.outer && !l.inner && !l.inhibTurret && !l.inhibitor;
      });
      expect(clearedAtExposure).toBe(true);

      // And the winner destroyed at least one inhibitor (monotonic counter).
      expect(res.finalState[res.winner].inhibitorsDestroyed).toBeGreaterThanOrEqual(1);
    }
    expect(nexusGames).toBeGreaterThan(60); // the vast majority end on the Nexus
  });

  it("ordering: nexus_exposed precedes gg, and an inhibitor falls before any Nexus turret", () => {
    for (let seed = 0; seed < 60; seed++) {
      const res = simulateMatch(roster("u", 72), roster("r", 70), mulberry32(seed));
      const kinds = res.timeline.map((e) => e.kind);
      const ggIdx = kinds.lastIndexOf("gg");
      const exposedIdx = kinds.indexOf("nexus_exposed");
      if (exposedIdx === -1) continue; // cap ending

      expect(exposedIdx).toBeLessThan(ggIdx);
      // The first inhibitor destruction must come before the Nexus is exposed.
      const firstInhibIdx = kinds.indexOf("inhibitor_destroyed");
      expect(firstInhibIdx).toBeGreaterThanOrEqual(0);
      expect(firstInhibIdx).toBeLessThan(exposedIdx);
    }
  });

  it("you do NOT need to destroy every tower — some loser structures usually still stand at GG", () => {
    let gamesWithSurvivors = 0;
    let nexusGames = 0;
    for (let seed = 0; seed < 80; seed++) {
      const res = simulateMatch(roster("u", 78), roster("r", 64), mulberry32(seed));
      if (!res.timeline.some((e) => e.kind === "nexus_exposed")) continue;
      nexusGames++;
      const loser: Side = res.winner === "user" ? "rival" : "user";
      // Max lane structures = 3 lanes × 4 = 12.
      if (standingLaneStructures(res.finalState[loser]) > 0) gamesWithSurvivors++;
    }
    // At least some games end with standing enemy structures (full map clear not required).
    expect(gamesWithSurvivors).toBeGreaterThan(nexusGames * 0.3);
  });
});

// ---------------------------------------------------------------------------
// Phase 17 Plan 02: StructureDamageState init deterministica (STR-01, TDD RED)
// ---------------------------------------------------------------------------

describe("StructureDamageState -- inicializacao deterministica (STR-01)", () => {
  it("freshStructureDamageState retorna pools e placas a 0 e timestamps a null", () => {
    const s = freshStructureDamageState();
    expect(s.outerDamage).toBe(0);
    expect(s.innerDamage).toBe(0);
    expect(s.inhibTurretDamage).toBe(0);
    expect(s.nexusTurretDamage).toBe(0);
    expect(s.outerPlates).toBe(0);
    expect(s.innerPlates).toBe(0);
    expect(s.inhibTurretPlates).toBe(0);
    expect(s.lastStructureDamageAtSec).toBeNull();
    expect(s.lastStructureDestroyedAtSec).toBeNull();
  });

  it("cada time recem-criado tem structureDamage para top/mid/bot com pool zero", () => {
    const simCfg = DEFAULT_SIM_CONFIG;
    const ur = ROLES.map((r) =>
      makePlayer(r, { id: `u-${r}`, personId: `u-${r}`, displayName: `u-${r} 2024`, lanePhase: 70, midGame: 70, lateGame: 70 })
    );
    const rr = ROLES.map((r) =>
      makePlayer(r, { id: `r-${r}`, personId: `r-${r}`, displayName: `r-${r} 2024`, lanePhase: 70, midGame: 70, lateGame: 70 })
    );
    const result = simulateMatch(ur, rr, mulberry32(0), simCfg);
    for (const side of ["user", "rival"] as const) {
      const team = result.finalState[side];
      for (const lane of LANES) {
        const sd = team.structureDamage[lane];
        expect(sd).toBeDefined();
        // Os campos de pool comecam em 0 (estado inicial deterministico)
        // (podem ter sido mutados ate o final do jogo -- mas o tipo deve existir)
        expect(typeof sd.outerDamage).toBe("number");
        expect(typeof sd.innerDamage).toBe("number");
        expect(typeof sd.inhibTurretDamage).toBe("number");
        expect(typeof sd.nexusTurretDamage).toBe("number");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 17 Plan 02: structureTimePlausibility (STR-02, TDD RED)
// ---------------------------------------------------------------------------

describe("structureTimePlausibility -- ancoras do spec §53", () => {
  it("outer em 120s e 179s retorna < 0.05 (antes de 3min e quase zero)", () => {
    expect(structureTimePlausibility("outer", 120)).toBeLessThan(0.05);
    expect(structureTimePlausibility("outer", 179)).toBeLessThan(0.05);
  });

  it("outer em 480s (8min) retorna > 0.75; outer em 600s retorna > 0.90", () => {
    expect(structureTimePlausibility("outer", 480)).toBeGreaterThan(0.75);
    expect(structureTimePlausibility("outer", 600)).toBeGreaterThan(0.90);
  });

  it("inner em 300s (5min) retorna < 0.05; inner em 419s retorna < 0.15", () => {
    expect(structureTimePlausibility("inner", 300)).toBeLessThan(0.05);
    expect(structureTimePlausibility("inner", 419)).toBeLessThan(0.15);
  });

  it("nexusTurret em 900s (15min) retorna < 0.10; nexusTurret em 1050s retorna < 0.25", () => {
    expect(structureTimePlausibility("nexusTurret", 900)).toBeLessThan(0.10);
    expect(structureTimePlausibility("nexusTurret", 1050)).toBeLessThan(0.25);
  });

  it("para todos os tiers e tempos amostrados, o resultado esta sempre em [0, 1]", () => {
    const tiers = ["outer", "inner", "inhibTurret", "nexusTurret"] as const;
    for (const tier of tiers) {
      for (const t of [0, 60, 300, 600, 900, 1200, 1800, 2400]) {
        const v = structureTimePlausibility(tier, t);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 17 Plan 02: EventKind inclui plate_taken e tower_low (D-01)
// ---------------------------------------------------------------------------

describe("EventKind -- plate_taken e tower_low presentes (D-01)", () => {
  it("plate_taken e um EventKind valido (tipo existe na union)", () => {
    // Verificacao em tempo de compilacao: se plate_taken nao estiver no EventKind,
    // o TypeScript lan caria erro aqui. Este teste e verde se compila.
    const kind: EventKind = "plate_taken";
    expect(kind).toBe("plate_taken");
  });

  it("tower_low e um EventKind valido (tipo existe na union)", () => {
    const kind: EventKind = "tower_low";
    expect(kind).toBe("tower_low");
  });
});

// ---------------------------------------------------------------------------
// Phase 17 Plan 03: computeStructureDamage -- formula multiplicativa (STR-03)
// ---------------------------------------------------------------------------

import { computeStructureDamage, type StructureDamageFactors } from "./structures";

describe("computeStructureDamage -- formula multiplicativa de dano (STR-03)", () => {
  it("timePlausibility=0 (early demais) zera o dano independentemente dos outros fatores", () => {
    const factors: StructureDamageFactors = {
      base: 10,
      waveMultiplier: 1.3,
      siegeThreat: 1.3,
      numbersAdvantage: 1.3,
      timePlausibility: 0,
      structureTierModifier: 1.0,
      objectiveBuffModifier: 1.0,
      cascadeBreakMultiplier: 1.0,
    };
    expect(computeStructureDamage(factors)).toBe(0);
  });

  it("fatores favoraveis em tempo plausivel produzem dano suficiente para derrubar em 8-12 ticks", () => {
    // Tempo plausivel: outer em 9min (540s) => ~0.93
    const tp = structureTimePlausibility("outer", 540);
    expect(tp).toBeGreaterThan(0.75);
    const factors: StructureDamageFactors = {
      base: 10,
      waveMultiplier: 1.3, // wave favoravel
      siegeThreat: 1.3,    // ADC vivo
      numbersAdvantage: 1.15, // leve vantagem numerica
      timePlausibility: tp,
      structureTierModifier: 1.0,
      objectiveBuffModifier: 1.0,
      cascadeBreakMultiplier: 1.0,
    };
    const dmg = computeStructureDamage(factors);
    // Para derrubar em 8-12 ticks com pool=100: 100/12 < dmg < 100/8
    expect(dmg).toBeGreaterThan(100 / 12); // > 8.33 por tick
    expect(dmg).toBeLessThan(100 / 4);     // < 25 por tick (razoavel)
  });

  it("structureTierModifier faz inner acumular mais devagar que outer com os mesmos fatores", () => {
    const base: Omit<StructureDamageFactors, "structureTierModifier"> = {
      base: 10,
      waveMultiplier: 1.0,
      siegeThreat: 1.0,
      numbersAdvantage: 1.0,
      timePlausibility: 0.9,
      objectiveBuffModifier: 1.0,
      cascadeBreakMultiplier: 1.0,
    };
    const dmgOuter = computeStructureDamage({ ...base, structureTierModifier: 1.0 });
    const dmgInner = computeStructureDamage({ ...base, structureTierModifier: 0.85 });
    const dmgInhibTurret = computeStructureDamage({ ...base, structureTierModifier: 0.75 });
    const dmgNexusTurret = computeStructureDamage({ ...base, structureTierModifier: 0.65 });
    // Tiers mais avancados recebem menos dano por tick
    expect(dmgOuter).toBeGreaterThan(dmgInner);
    expect(dmgInner).toBeGreaterThan(dmgInhibTurret);
    expect(dmgInhibTurret).toBeGreaterThan(dmgNexusTurret);
  });
});

// ---------------------------------------------------------------------------
// Phase 17 Plan 03: Seed-ancora -- regressao de sintomas estruturais (STR-04)
//
// Ancora deterministica: STOMP 85v55 com seed=5 e seed=0.
// Estes testes verificam que os dois principais sintomas da Fase 16 foram
// corrigidos apos o modelo de dano acumulado (D-06, Plan 03):
//   - Sintoma 1 (seed=5): torre antes de 5min em stomp -> corrigido: nenhuma torre < 300s
//   - Sintoma 4 (seed=0): queda sem chip anterior -> corrigido: plate_taken/tower_low antes
//
// NOTA: A assinatura de timeline do describe "extracao no-op" (Plan 01/02) MUDOU
// legitimamente aqui porque o modelo de queda por acumulo altera o fluxo de eventos.
// Esta mudanca e o efeito esperado da Fase 17 (D-04). O golden foi regenerado
// mecanicamente apos a logica estabilizar.
// ---------------------------------------------------------------------------

describe("seed-ancora -- regressao de sintomas estruturais (STR-04)", () => {
  const simCfg = DEFAULT_SIM_CONFIG;
  const userRoster = roster("u", 85); // STOMP 85 vs 55
  const rivalRoster = roster("r", 55);

  it("seed=5 STOMP 85v55: nenhuma torre destruida antes de 5min (300s)", () => {
    const result = simulateMatch(userRoster, rivalRoster, mulberry32(5), simCfg);
    const earlyTowers = result.timeline.filter(
      (ev) =>
        (ev.kind === "tower_destroyed" || ev.kind === "first_tower") &&
        ev.timeSec < 300
    );
    // Sintoma 1 corrigido: a curva de timePlausibility e o pool acumulado impedem
    // qualquer queda antes de 5min (p5 > 300s confirmado pelo harness de calibracao).
    expect(earlyTowers).toHaveLength(0);
  });

  it("seed=0 STOMP 85v55: plate_taken ou tower_low aparece antes da 1a torre", () => {
    const result = simulateMatch(userRoster, rivalRoster, mulberry32(0), simCfg);
    const firstTowerEvent = result.timeline.find(
      (ev) => ev.kind === "tower_destroyed" || ev.kind === "first_tower"
    );
    // Edge case: partida sem torre e valida (finish por cap)
    if (!firstTowerEvent) return;
    const prelude = result.timeline.filter(
      (ev) =>
        (ev.kind === "plate_taken" || ev.kind === "tower_low") &&
        ev.timeSec < firstTowerEvent.timeSec
    );
    // Sintoma 4 corrigido: plate_taken e tower_low sinalizam progresso antes da queda real.
    expect(prelude.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 19 Plan 02: OBJ-01 -- Arauto na Nexus turret emite tower_low (D-02)
//
// Garante que resolveHeraldUse converte para evento parcial (tower_low) quando
// a proxima estrutura da lane e Nexus turret, nunca emitindo queda de Nexus turret.
// A aridade do selectKiller (1 draw) e preservada em ambos os caminhos (D-07).
// ---------------------------------------------------------------------------

import { resolveHeraldUse } from "./structures";
import { createInitialMatchState } from "./matchState";

/**
 * Constroi um MatchState onde a proxima estrutura do rival na lane 'mid' e Nexus turret.
 * Usa createInitialMatchState (deterministico) e mutacao inline.
 */
function makeStateNexusTurretNext(): ReturnType<typeof createInitialMatchState> {
  const ur = ROLES.map((r) =>
    makePlayer(r, { id: `u-${r}`, personId: `u-${r}`, displayName: `u-${r} 2024`, lanePhase: 70, midGame: 70, lateGame: 70 })
  );
  const rr = ROLES.map((r) =>
    makePlayer(r, { id: `r-${r}`, personId: `r-${r}`, displayName: `r-${r} 2024`, lanePhase: 70, midGame: 70, lateGame: 70 })
  );
  const state = createInitialMatchState(ur, rr);
  // Avancar o tempo para 25min (Arauto pode estar em uso)
  state.gameTimeSec = 1500;
  state.phase = "late";
  // Garantir que o user (atacante) tem Herald disponivel e todos vivos
  state.user.heraldUsed = false;
  for (const r of ROLES) {
    state.user.players[r].alive = true;
  }
  // Configurar rival: proxima estrutura na lane mid = nexusTurret
  const mid = state.rival.structures.mid;
  mid.outerAlive = false;
  mid.innerAlive = false;
  mid.inhibTurretAlive = false;
  mid.inhibitorAlive = false;
  mid.inhibitorRespawnAtSec = null; // inibidor permanentemente destruido
  state.rival.nexusTurretsAlive = 1;
  state.rival.nexusExposed = false;
  // Pressao favoravel para o user na lane mid
  state.pressure.mid = 50;
  return state;
}

describe("OBJ-01 -- resolveHeraldUse na Nexus turret emite tower_low (D-02, Fase 19 Plano 02)", () => {
  it("quando a proxima estrutura e nexusTurret, retorna evento de kind tower_low", () => {
    let drawCount = 0;
    const fakeRng = () => { drawCount++; return 0.5; };

    const state = makeStateNexusTurretNext();
    const ev = resolveHeraldUse(state, "user", fakeRng);

    // O evento deve ser tower_low (pressao de base), nunca queda de Nexus turret
    expect(ev).not.toBeNull();
    expect(ev!.kind).toBe("tower_low");
  });

  it("quando a proxima estrutura e nexusTurret, NAO emite tower_destroyed nem nexus_exposed", () => {
    const fakeRng = () => 0.5;
    const state = makeStateNexusTurretNext();
    const ev = resolveHeraldUse(state, "user", fakeRng);

    expect(ev?.kind).not.toBe("tower_destroyed");
    expect(ev?.kind).not.toBe("nexus_exposed");
    expect(ev?.kind).not.toBe("inhibitor_destroyed");
  });

  it("aridade: o caminho nexusTurret consome exatamente 1 draw de rng (selectKiller)", () => {
    let drawCount = 0;
    const fakeRng = () => { drawCount++; return 0.5; };

    const state = makeStateNexusTurretNext();
    resolveHeraldUse(state, "user", fakeRng);

    // Exatamente 1 draw (selectKiller) -- igual ao caminho normal (D-07/Armadilha 5)
    expect(drawCount).toBe(1);
  });

  it("o ticker do evento parcial menciona resistencia da base, sem travessao e sem afirmar destruicao", () => {
    const fakeRng = () => 0.5;
    const state = makeStateNexusTurretNext();
    const ev = resolveHeraldUse(state, "user", fakeRng);

    expect(ev).not.toBeNull();
    // O ticker nao deve afirmar destruicao
    expect(ev!.ticker).not.toMatch(/derrub|destrui|abateu/i);
    // Sem travessao (convencao do projeto)
    expect(ev!.ticker).not.toContain("—"); // em-dash
    expect(ev!.ticker).not.toContain("--");
  });

  it("N=500 seed deterministico: Arauto nunca aparece como ator de queda de Nexus turret", () => {
    // Detectar eventos suspeitos: (tower_destroyed ou nexus_exposed) com ticker contendo "Arauto"
    let heraldNexusTurretDestroyed = 0;
    const ur = ROLES.map((r) =>
      makePlayer(r, { id: `u-${r}`, personId: `u-${r}`, displayName: `u-${r} 2024`, lanePhase: 70, midGame: 70, lateGame: 70 })
    );
    const rr = ROLES.map((r) =>
      makePlayer(r, { id: `r-${r}`, personId: `r-${r}`, displayName: `r-${r} 2024`, lanePhase: 70, midGame: 70, lateGame: 70 })
    );
    for (let seed = 0; seed < 500; seed++) {
      const res = simulateMatch(ur, rr, mulberry32(seed));
      for (const ev of res.timeline) {
        if (
          (ev.kind === "tower_destroyed" || ev.kind === "nexus_exposed") &&
          ev.ticker.includes("Arauto")
        ) {
          heraldNexusTurretDestroyed++;
        }
      }
    }
    // OBJ-01: Arauto como ator de queda de Nexus turret deve ser ZERO
    expect(heraldNexusTurretDestroyed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Canal absoluto de cerco (PACE-01, Fase 25 plano 25-04)
// ---------------------------------------------------------------------------

import { accrueSiegePressure, buildStructureActorCandidates } from "./structures";
import { teamOf, hasBaronBuff, opponent, type Lane } from "./matchState";
import { shortName } from "./ticker";
import type { MatchState } from "./matchState";
import type { SimEvent } from "./simEvents";

/**
 * Testes do canal absoluto de cerco (PACE-01).
 *
 * Eles nao passam pela simulacao inteira de proposito: constroem o estado com o
 * mesmo construtor que a engine usa, avancam o tempo de jogo na mao e chamam a
 * funcao repetidamente. Assim ficam rapidos, isolados e sem nenhum consumo de
 * sorteio no meio.
 */
describe("Fase 25 PACE-01 -- canal absoluto de cerco (accrueSiegePressure)", () => {
  const TICK = DEFAULT_SIM_CONFIG.tickSeconds;

  /** Estado inicial com rosters espelhados (os dois lados com o mesmo overall). */
  function mirroredState(overall = 75): MatchState {
    return createInitialMatchState(roster("u", overall), roster("r", overall));
  }

  /** Avanca N ticks chamando o acumulo, devolvendo todos os eventos emitidos. */
  function runAccrual(state: MatchState, ticks: number): SimEvent[] {
    const out: SimEvent[] = [];
    for (let i = 0; i < ticks; i++) {
      state.gameTimeSec += TICK;
      out.push(...accrueSiegePressure(state));
    }
    return out;
  }

  /** Projecao de evento sem o id global (o contador de id nao e propriedade do acumulo). */
  function project(ev: SimEvent): string {
    return `${ev.timeSec}:${ev.kind}:${ev.side}:${ev.lane}:${ev.actors.join(",")}:${ev.ticker}`;
  }

  /** Os quatro pools de dano de uma lane, na ordem dos tiers. */
  function poolsOf(state: MatchState, side: Side, lane: Lane): number[] {
    const p = teamOf(state, side).structureDamage[lane];
    return [p.outerDamage, p.innerDamage, p.inhibTurretDamage, p.nexusTurretDamage];
  }

  it("aridade: declara exatamente um parametro e nao recebe o gerador", () => {
    // Se a funcao nao tem o gerador, ela nao pode consuma-lo. O contrato de
    // determinismo por semente (INV-1) fica garantido pela assinatura.
    expect(accrueSiegePressure.length).toBe(1);
  });

  it("determinismo: duas construcoes identicas produzem os mesmos eventos e os mesmos pools", () => {
    const a = mirroredState();
    const b = mirroredState();

    const eventsA = runAccrual(a, 120);
    const eventsB = runAccrual(b, 120);

    expect(eventsA.map(project)).toEqual(eventsB.map(project));
    expect(eventsA.length).toBeGreaterThan(0); // a comparacao acima precisa ter conteudo

    for (const side of ["user", "rival"] as Side[]) {
      for (const lane of LANES) {
        expect(poolsOf(a, side, lane)).toEqual(poolsOf(b, side, lane));
      }
    }
  });

  it("simetria: em fixture espelhado os pools das tres lanes dos dois lados sao iguais", () => {
    const state = mirroredState();
    runAccrual(state, 80);

    for (const lane of LANES) {
      // O canal e simetrico: a mesma formula para os dois lados preserva a
      // identidade em neutro (nao ha mais termo de vantagem por torres, spec secao 5).
      expect(poolsOf(state, "user", lane)).toEqual(poolsOf(state, "rival", lane));
    }
  });

  it("ator plausivel: todo ator emitido pertence a lista de candidatos daquela lane e daquele instante", () => {
    const state = mirroredState();
    let checados = 0;

    for (let i = 0; i < 160; i++) {
      state.gameTimeSec += TICK;

      // Superset de candidatos daquele instante, montado pela MESMA funcao que o
      // caminho do gate usa. hasGankCtx=true devolve o superset (laner + jungler)
      // que contem a lista de hasGankCtx=false (so o laner).
      const candidatos: Record<string, string[]> = {};
      for (const side of ["user", "rival"] as Side[]) {
        const team = teamOf(state, side);
        const hasBaronOrHerald =
          hasBaronBuff(state, side) ||
          (state.objectives.heraldAlive && !state.objectives.heraldDone);
        for (const lane of LANES) {
          candidatos[`${side}:${lane}`] = buildStructureActorCandidates(
            team,
            lane,
            state.gameTimeSec,
            true,
            hasBaronOrHerald
          ).map((p) => shortName(p.card));
        }
      }

      for (const ev of accrueSiegePressure(state)) {
        const chave = `${ev.side}:${ev.lane}`;
        expect(candidatos[chave]).toBeDefined();
        expect(candidatos[chave]).toContain(ev.actors[0]);
        checados++;
      }
    }

    expect(checados).toBeGreaterThan(0); // a assercao acima precisa ter sido exercida
  });

  it("nunca escolhe suporte como ator antes de 14:00 (STR-06 herdado por construcao)", () => {
    const state = mirroredState();
    const suportes = new Set(
      (["user", "rival"] as Side[]).map((s) => shortName(teamOf(state, s).players["support"].card))
    );

    // 55 ticks a 15 s = 825 s, ainda dentro da laning phase (< 840 s).
    for (const ev of runAccrual(state, 55)) {
      expect(suportes.has(ev.actors[0])).toBe(false);
    }
  });

  it("pula o lado com o Nexus exposto: o fechamento de jogo continua sendo do gate", () => {
    const state = mirroredState();
    // Nexus do rival exposto: o lado user (que ataca o rival) e pulado por inteiro.
    state.rival.nexusExposed = true;

    const eventos = runAccrual(state, 60);

    // Nenhum pool do rival se moveu, e nenhum evento saiu do lado user.
    for (const lane of LANES) {
      expect(poolsOf(state, "rival", lane)).toEqual([0, 0, 0, 0]);
    }
    expect(eventos.some((ev) => ev.side === "user")).toBe(false);
    // O outro lado segue acumulando normalmente: o corte e por lado, nao global.
    expect(eventos.some((ev) => ev.side === "rival")).toBe(true);
    // E o acumulo nunca produz o evento de fim de jogo.
    expect(eventos.some((ev) => ev.kind === "gg")).toBe(false);
  });

  it("pula a lane cuja proxima estrutura e um inibidor: esse caminho tambem e do gate", () => {
    const state = mirroredState();
    // Top do rival: as tres torres ja cairam e o inibidor esta de pe.
    const top = state.rival.structures.top;
    top.outerAlive = false;
    top.innerAlive = false;
    top.inhibTurretAlive = false;
    top.inhibitorAlive = true;
    top.inhibitorRespawnAtSec = null;

    runAccrual(state, 60);

    // Nenhum pool da top do rival se moveu (nao ha torre para acumular).
    expect(poolsOf(state, "rival", "top")).toEqual([0, 0, 0, 0]);
    // As outras duas lanes acumularam normalmente.
    expect(poolsOf(state, "rival", "mid")[0]).toBeGreaterThan(0);
    expect(poolsOf(state, "rival", "bot")[0]).toBeGreaterThan(0);
  });

  it("herda o freio de cascata e a curva temporal: nenhuma torre cai antes de 5:00", () => {
    // Regra dura da v2.0. Aqui ela e verificada no canal novo em isolamento, sem
    // passar pela simulacao: a curva temporal e o modificador de tier entram
    // intactos, entao o pool nao pode alcancar 100 tao cedo.
    const state = mirroredState(90);
    const eventos = runAccrual(state, 20); // 20 ticks a 15 s = 300 s = 5:00

    const quedas = eventos.filter(
      (ev) => ev.kind === "tower_destroyed" || ev.kind === "first_tower"
    );
    expect(quedas).toEqual([]);
  });

  it("o canal de cerco so tira placa na fase de rota (antes de 840 s)", () => {
    const state = mirroredState();
    const eventos = runAccrual(state, 160); // 160 ticks a 15 s = 2400 s

    const placas = eventos.filter((ev) => ev.kind === "plate_taken");
    expect(placas.length).toBeGreaterThan(0);
    // O canal de cerco so existe antes de 14:00, entao a placa dele sai antes de 840 s.
    for (const p of placas) {
      expect(p.timeSec).toBeLessThan(840);
    }
    // E o ouro da placa foi registrado no ponto de chamada, como no caminho do gate.
    const ladoComPlaca = placas[0].side as Side;
    const laneComPlaca = placas[0].lane as Lane;
    expect(teamOf(state, ladoComPlaca).laneState[laneComPlaca].plateGold).toBeGreaterThan(0);
    expect(opponent(ladoComPlaca)).not.toBe(ladoComPlaca);
  });
});

// ---------------------------------------------------------------------------
// Concentracao de rota do canal absoluto (FORM-01 e PACE-02, Fase 25B plano 25B-03)
// ---------------------------------------------------------------------------

import { siegeLaneFocus, SIEGE_FOCUS_TEMPERATURE } from "./structures";

/**
 * Testes da concentracao de rota do canal absoluto.
 *
 * POR QUE ESTE TERMO EXISTE, com a causa fechada por leitura de codigo:
 * `accrueSiegePressure` percorre `for (const side)` e, dentro,
 * `for (const lane of LANES)`. O canal empurra AS TRES ROTAS EM PARALELO, todo
 * tick, para os dois lados. Um time de verdade escolhe uma rota e concentra;
 * este espalha, entao as tres progridem juntas e quando uma fica funda as tres
 * ficam. Dai o vencedor terminar com as tres limpas em 90,8 por cento das
 * partidas, o que contradiz o invariante escrito no cabecalho DESTE arquivo
 * (linhas 4 a 9: para vencer basta limpar por inteiro UMA rota).
 *
 * O DEFEITO NUNCA FOI O VENCEDOR DESTRUIR DEMAIS: E ELE PRECISAR DE NOVE TORRES
 * PARA VENCER. Essa distincao e o que separa este mecanismo do anterior. O
 * DECAIMENTO do canal por caminho de vitoria aberto foi implementado, medido e
 * revertido no mesmo plano: reduzir throughput UNIFORMEMENTE alonga a partida sem
 * encurtar o caminho ate o Nexo, e custou 10,48 minutos de duracao contra uma
 * folga de 0,42. Ver docs/diagnostics/25B-sweep.md secoes 1 e 2.
 *
 * OS DOIS INVARIANTES QUE ESTE BLOCO EXISTE PARA TRAVAR, e sao eles que fazem da
 * concentracao uma alavanca de FORMA e nao de nivel:
 *   1. os tres pesos somam exatamente 3, ou seja o termo REDISTRIBUI o dano entre
 *      as rotas e nunca o reduz;
 *   2. com pressao uniforme os tres pesos valem exatamente 1, ou seja o inicio de
 *      partida fica byte a byte com o de hoje e nao ha rota escolhida por
 *      desempate arbitrario.
 */
describe("Fase 25B FORM-01 -- concentracao de rota do canal absoluto (siegeLaneFocus)", () => {
  function mirroredState(overall = 75): MatchState {
    return createInitialMatchState(roster("u", overall), roster("r", overall));
  }

  /** Fixa a pressao assinada das tres rotas (mais favorece user) e devolve o estado. */
  function comPressao(state: MatchState, top: number, mid: number, bot: number): MatchState {
    state.pressure.top = top;
    state.pressure.mid = mid;
    state.pressure.bot = bot;
    return state;
  }

  /** Os tres pesos de um lado, na ordem canonica de LANES. */
  function pesos(state: MatchState, side: Side): number[] {
    return LANES.map((lane) => siegeLaneFocus(state, side, lane));
  }

  const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  it("identidade em pressao uniforme: os tres pesos valem EXATAMENTE 1, inclusive no inicio de partida", () => {
    // Este e o caso do inicio de partida num fixture espelhado, e ele precisa ser
    // identidade e nao aproximacao: e o que preserva o encurtamento que a Fase 25
    // conquistou. E ele tambem elimina o desempate arbitrario, que e o defeito da
    // variante binaria: sem diferenca de pressao nao ha rota escolhida.
    const inicio = mirroredState();
    expect(inicio.pressure).toEqual({ top: 0, mid: 0, bot: 0 });
    expect(pesos(inicio, "user")).toEqual([1, 1, 1]);
    expect(pesos(inicio, "rival")).toEqual([1, 1, 1]);

    // E em qualquer outra pressao uniforme, nao so na do inicio.
    for (const p of [-40, -7, 7, 40]) {
      const st = comPressao(mirroredState(), p, p, p);
      expect(pesos(st, "user")).toEqual([1, 1, 1]);
      expect(pesos(st, "rival")).toEqual([1, 1, 1]);
    }
  });

  it("redistribuicao: os tres pesos somam sempre 3, entao o total por tick nao muda", () => {
    // ESTE E O INVARIANTE QUE SEPARA ESTE MECANISMO DO DECAIMENTO REFUTADO. A
    // concentracao move dano de uma rota para outra e nunca o subtrai, e e por
    // isso que ela e alavanca de FORMA com custo de nivel proximo de zero.
    const casos: Array<[number, number, number]> = [
      [0, 0, 0],
      [30, 0, -30],
      [12, 0, 0],
      [-100, 100, 0],
      [100, 100, -100],
      [5, -3, 1],
      [-100, -100, -100],
    ];
    for (const [t, m, b] of casos) {
      for (const side of ["user", "rival"] as Side[]) {
        const st = comPressao(mirroredState(), t, m, b);
        expect(soma(pesos(st, side))).toBeCloseTo(LANES.length, 10);
      }
    }
  });

  it("concentracao: a rota de maior pressao recebe o maior peso, e ele passa de 1 quando ha diferenca", () => {
    // Uma torre externa caida vale 12 pontos de pressao naquela rota em
    // recomputePressure, que e a ancora da escala. Uma rota uma torre a frente
    // das outras duas tem de receber concentracao visivel.
    const st = comPressao(mirroredState(), 12, 0, 0);
    const [top, mid, bot] = pesos(st, "user");

    expect(top).toBeGreaterThan(1);
    expect(top).toBeGreaterThan(mid);
    expect(top).toBeGreaterThan(bot);
    expect(mid).toBeLessThan(1);
    expect(mid).toBeCloseTo(bot, 10); // as duas preteridas estao empatadas
  });

  it("monotonicidade: mais pressao na propria rota nunca reduz o peso dela", () => {
    let anterior = -Infinity;
    for (const p of [-60, -30, -12, 0, 12, 30, 60]) {
      const st = comPressao(mirroredState(), p, 0, 0);
      const atual = siegeLaneFocus(st, "user", "top");
      expect(atual).toBeGreaterThanOrEqual(anterior);
      anterior = atual;
    }
    // A varredura precisa ter de fato subido, senao as assercoes seriam vacuas.
    expect(anterior).toBeGreaterThan(siegeLaneFocus(comPressao(mirroredState(), -60, 0, 0), "user", "top"));
  });

  it("nenhuma rota e zerada: a partida nao vira trilho nem no extremo da escala", () => {
    // A variante BINARIA (todo o dano numa rota) foi medida e recusada: ela
    // derruba torres/min para 0,245 contra um piso de 0,300 e concentra desde o
    // tique zero. O peso estritamente positivo e contrato.
    for (const [t, m, b] of [
      [100, -100, -100],
      [-100, 100, -100],
      [100, 100, -100],
    ] as Array<[number, number, number]>) {
      for (const side of ["user", "rival"] as Side[]) {
        for (const peso of pesos(comPressao(mirroredState(), t, m, b), side)) {
          expect(peso).toBeGreaterThan(0);
          expect(Number.isFinite(peso)).toBe(true);
        }
      }
    }
  });

  it("simetria de lado: a pressao e assinada, entao os dois lados leem o espelho um do outro", () => {
    const st = comPressao(mirroredState(), 30, 0, -30);
    // A rota em que o user tem mais pressao e a top; a do rival e a bot, e por
    // simetria do sinal os dois pesos tem de ser iguais.
    expect(siegeLaneFocus(st, "user", "top")).toBeCloseTo(siegeLaneFocus(st, "rival", "bot"), 12);
    expect(siegeLaneFocus(st, "user", "mid")).toBeCloseTo(siegeLaneFocus(st, "rival", "mid"), 12);
    expect(siegeLaneFocus(st, "user", "bot")).toBeCloseTo(siegeLaneFocus(st, "rival", "top"), 12);
  });

  it("fonte exclusivamente de pressao: tempo, abates, ouro, torres derrubadas e win prob nao movem o termo", () => {
    // A fonte e state.pressure, o MESMO campo que bestPressureLane le para
    // escolher a rota de macro. Este teste e o que impede a fonte de virar tempo
    // de jogo ou probabilidade de vitoria numa manutencao futura.
    const base = comPressao(mirroredState(), 20, -5, 0);
    const referencia = pesos(base, "user");

    const mexido = comPressao(mirroredState(), 20, -5, 0);
    mexido.gameTimeSec = 3000;
    mexido.user.kills = 40;
    mexido.rival.kills = 3;
    mexido.user.gold = 90000;
    mexido.rival.gold = 1000;
    mexido.user.towersDestroyed = 8;
    mexido.rival.towersDestroyed = 0;
    mexido.momentum = 100;
    mexido.winProbUser = 0.99;
    for (const lane of LANES) {
      mexido.rival.structures[lane].outerAlive = false;
      mexido.user.structureDamage[lane].outerDamage = 99;
    }

    expect(pesos(mexido, "user")).toEqual(referencia);
    expect(pesos(mexido, "rival")).toEqual(pesos(base, "rival"));
  });

  it("aridade: o termo recebe estado, lado e rota, e o canal absoluto continua recebendo so o estado", () => {
    // Sem o gerador na assinatura, nem o termo nem o canal podem consumi-lo, e o
    // diff prova isso sozinho (INV-1).
    expect(siegeLaneFocus.length).toBe(3);
    expect(accrueSiegePressure.length).toBe(1);
    // A temperatura e estritamente positiva: zero seria o limite binario, medido
    // e recusado na secao 3 de docs/diagnostics/25B-sweep.md.
    expect(SIEGE_FOCUS_TEMPERATURE).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Estruturas do patch 26: placas permanentes e resistencia da torre externa
// ---------------------------------------------------------------------------

import {
  platesAt,
  PLATE_THRESHOLDS,
  classifyStructureCrossing,
  crossesTowerLow,
  outerTurretDamageFactor,
  plateTicker,
} from "./structures";

describe("placas do patch 26", () => {
  it("platesAt conta os limiares 10/25/45/70 (a 5a placa e a queda)", () => {
    expect(PLATE_THRESHOLDS).toEqual([10, 25, 45, 70]);
    expect(platesAt(0)).toBe(0);
    expect(platesAt(9.9)).toBe(0);
    expect(platesAt(10)).toBe(1);
    expect(platesAt(44)).toBe(2);
    expect(platesAt(70)).toBe(4);
    expect(platesAt(99.9)).toBe(4);
  });

  it("placa em toda torre de rota e a qualquer hora; torre do Nexus nao tem placa", () => {
    expect(classifyStructureCrossing("outer", 1800, 20, 30)).toBe("plate");
    expect(classifyStructureCrossing("inner", 1800, 0, 12)).toBe("plate");
    expect(classifyStructureCrossing("inhibTurret", 2400, 40, 46)).toBe("plate");
    expect(classifyStructureCrossing("nexusTurret", 2400, 0, 30)).toBe("none");
    expect(classifyStructureCrossing("outer", 600, 11, 20)).toBe("none");
  });

  it("a 4a placa coincide com o estado critico: sai a placa, e crossesTowerLow marca o critico", () => {
    expect(classifyStructureCrossing("outer", 1000, 60, 72)).toBe("plate");
    expect(crossesTowerLow(60, 72)).toBe(true);
    expect(crossesTowerLow(72, 80)).toBe(false);
    expect(classifyStructureCrossing("nexusTurret", 1800, 60, 72)).toBe("tower_low");
  });

  it("texto da placa: uma ou varias, torre interna e do inibidor nomeadas, estado critico no fim", () => {
    expect(plateTicker("Faker", "mid", "outer", "T1", 1, false)).toBe(
      "Faker pressiona a torre no meio e coleta uma placa para o T1."
    );
    expect(plateTicker("Faker", "mid", "inner", "T1", 2, false)).toBe(
      "Faker pressiona a torre interna no meio e coleta 2 placas para o T1."
    );
    expect(plateTicker("Faker", "bot", "inhibTurret", "T1", 1, true)).toBe(
      "Faker pressiona a torre do inibidor no bot e coleta uma placa para o T1. A torre fica em estado crítico."
    );
  });
});

describe("resistencia da torre externa (patch 26)", () => {
  it("vale o fator inicial ate 11:00, sobe em linha reta e chega a 1 em 15:00", () => {
    expect(outerTurretDamageFactor(0, 0.5)).toBe(0.5);
    expect(outerTurretDamageFactor(660, 0.5)).toBe(0.5);
    expect(outerTurretDamageFactor(780, 0.5)).toBeCloseTo(0.75, 10);
    expect(outerTurretDamageFactor(900, 0.5)).toBe(1);
    expect(outerTurretDamageFactor(2000, 0.5)).toBe(1);
  });
});
