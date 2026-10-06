/**
 * src/sim/economyPayouts.test.ts
 *
 * Pagamentos de ouro dos pontos de chamada reais (spec 2026-10-02-luta-mapa-vitoria, secao
 * "Testes", linha de economia): torre por degrau, bonus de primeira torre, placa, ouro do Barao
 * e dos objetivos (patch 26), assistencia dividida e a recompensa de objetivo paga exatamente uma vez por
 * tomada, por roubo e por estrutura. economy.test.ts cobre as funcoes puras; aqui o que se
 * prova e que o motor chama cada uma na hora certa e uma vez so.
 *
 * Como o abate e alcancado: applyKill nao e exportado e nenhuma entrada publica chega nele
 * sem rodar a partida inteira. Em vez de exportar um helper so para teste, o modulo
 * ./economy e embrulhado por um espiao de passagem (vi.mock com importOriginal, o
 * comportamento real e preservado) que, durante simulateMatch, registra cada abate: o valor
 * do abate, os creditos feitos e a divisao da assistencia. Os pontos de chamada de
 * killGoldFor e settleVictimBounty sao unicos e abrem e fecham applyKill, entao tudo entre
 * os dois pertence a um unico abate.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { simulateMatch } from "./engine";
import { mulberry32 } from "./rng";
import {
  createInitialMatchState, DEFAULT_SIM_CONFIG, ROLES, TIMERS,
  type MatchState, type Lane, type TeamState,
} from "./matchState";
import { damageStructure, collectPlates } from "./structures";
import { takeObjective, stealObjective } from "./objectives";
import { objectiveBountyGold, type StructureTier } from "./economy";
import { effectiveChaos } from "./tuning";
import { makeFlatCard } from "../__tests__/golden/fixtures";

// ---------------------------------------------------------------------------
// Espiao de abate (so grava enquanto `on` esta ligado)
// ---------------------------------------------------------------------------

interface KillRow {
  isFirstBlood: boolean;
  killGold: number;
  /** Cada creditPlayer do abate, em ordem: primeiro o abatedor, depois os assistentes. */
  credits: number[];
  /** Chamada de splitEvenly do abate (a divisao da assistencia), se houve assistente. */
  split: { total: number; n: number; shares: number[] } | null;
  /** O que a vitima entregou, repassado a settleVictimBounty. */
  settledWith: number | null;
}

const killLog = vi.hoisted(() => ({
  on: false,
  rows: [] as KillRow[],
  cur: null as KillRow | null,
}));

vi.mock("./economy", async (importOriginal) => {
  const real = await importOriginal<typeof import("./economy")>();
  return {
    ...real,
    killGoldFor: (victim: { bounty: number; shutdownGold: number }, isFirstBlood: boolean) => {
      const killGold = real.killGoldFor(victim, isFirstBlood);
      if (killLog.on) {
        killLog.cur = { isFirstBlood, killGold, credits: [], split: null, settledWith: null };
        killLog.rows.push(killLog.cur);
      }
      return killGold;
    },
    creditPlayer: (team: { gold: number }, p: { gold: number }, amount: number) => {
      if (killLog.on && killLog.cur) killLog.cur.credits.push(amount);
      return real.creditPlayer(team, p, amount);
    },
    splitEvenly: (total: number, n: number) => {
      const shares = real.splitEvenly(total, n);
      if (killLog.on && killLog.cur) killLog.cur.split = { total, n, shares };
      return shares;
    },
    settleVictimBounty: (victim: { bounty: number; shutdownGold: number }, given: number) => {
      if (killLog.on && killLog.cur) {
        killLog.cur.settledWith = given;
        killLog.cur = null;
      }
      return real.settleVictimBounty(victim, given);
    },
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const roster = (overall: number) => ROLES.map((r) => makeFlatCard(r, overall));

/** Limiar, fracao e teto escritos aqui para o teste nao depender da calibracao padrao. */
const BOUNTY_TUNING = {
  objectiveBountyMinDeficit: 1500,
  objectiveBountyFraction: 0.05,
  objectiveBountyCap: 2500,
};

/**
 * Estado limpo, em que a recompensa de objetivo vale exatamente o numero da tabela: slider de
 * Caos no padrao e volatilidade dos jogadores zerada, entao o caos efetivo e 0,25, a referencia,
 * e a escala da recompensa e 1. Relogio em 21:40, com a placa no piso (80, desde 15:00) e depois do Barao (20:00).
 * Os dois times comecam com o mesmo ouro, entao o deficit e zero e a recompensa e zero.
 */
function freshState(): MatchState {
  const state = createInitialMatchState(roster(70), roster(70), {
    config: { ...DEFAULT_SIM_CONFIG, comebackElasticity: 0.25, tuning: BOUNTY_TUNING },
  });
  for (const team of [state.user, state.rival]) {
    for (const r of ROLES) {
      team.players[r].metricsBase = { ...team.players[r].metricsBase, laneVolatility: 0 };
    }
  }
  state.gameTimeSec = 1300;
  return state;
}

function setGoldPerPlayer(team: TeamState, perPlayer: number): void {
  for (const r of ROLES) team.players[r].gold = perPlayer;
  team.gold = perPlayer * ROLES.length;
}

/** Coloca o time `user` 8.000 de ouro atras: a recompensa de objetivo passa a valer 400. */
function putUserBehind(state: MatchState): void {
  setGoldPerPlayer(state.user, 3000);
  setGoldPerPlayer(state.rival, 4600);
  expect(objectiveBountyGold(state.user.gold, state.rival.gold, effectiveChaos(state), state.tuning)).toBe(400);
}
const BOUNTY_WHEN_BEHIND = 400;

const goldOf = (team: TeamState) => ROLES.map((r) => team.players[r].gold);

/** Ouro do time e dos cinco jogadores antes de uma acao, para medir o que ela creditou. */
function snapshot(team: TeamState) {
  return { team: team.gold, players: goldOf(team) };
}

function deltaOf(team: TeamState, before: ReturnType<typeof snapshot>) {
  return {
    team: team.gold - before.team,
    players: goldOf(team).map((g, i) => g - before.players[i]),
  };
}

/** Ouro do time e a soma do ouro dos jogadores, depois de qualquer credito. */
function expectConsistent(team: TeamState): void {
  expect(team.gold).toBe(goldOf(team).reduce((s, g) => s + g, 0));
}

const TIER_ORDER: StructureTier[] = ["outer", "inner", "inhibTurret", "inhibitor", "nexusTurret"];

/** Derruba tudo que vem antes do degrau pedido, na rota, para o proximo golpe cair nele. */
function leaveOnlyTier(enemy: TeamState, lane: Lane, tier: StructureTier): void {
  const s = enemy.structures[lane];
  const at = TIER_ORDER.indexOf(tier);
  s.outerAlive = at <= 0;
  s.innerAlive = at <= 1;
  s.inhibTurretAlive = at <= 2;
  s.inhibitorAlive = at <= 3;
}

// ---------------------------------------------------------------------------
// Torre por degrau, bonus de primeira torre e placa
// ---------------------------------------------------------------------------

// Patch 26: a torre de rota paga as 5 placas ao cair (80 cada as 21:40); inibidor e torre do
// Nexus pagam 50.
const TIER_GOLD: Array<{ tier: StructureTier; gold: number }> = [
  { tier: "outer", gold: 400 },
  { tier: "inner", gold: 400 },
  { tier: "inhibTurret", gold: 400 },
  { tier: "inhibitor", gold: 50 },
  { tier: "nexusTurret", gold: 50 },
];

describe("ouro de estrutura (damageStructure)", () => {
  it.each(TIER_GOLD)("$tier credita $gold ao time, dividido entre os cinco, sem recompensa quando nao esta atras", ({ tier, gold }) => {
    const state = freshState();
    state.firstTurretDone = true; // isola o degrau do bonus de primeira torre
    const rival = state.rival;
    leaveOnlyTier(rival, "mid", tier);
    const before = snapshot(state.user);
    const rivalBefore = snapshot(rival);

    const res = damageStructure(state, "user", rival, "mid", 0);

    expect(res).not.toBeNull();
    const d = deltaOf(state.user, before);
    expect(d.team).toBe(gold);
    expect(d.players.reduce((s, g) => s + g, 0)).toBe(gold);
    // divisao igual entre os cinco: diferenca maxima de 1
    expect(Math.max(...d.players) - Math.min(...d.players)).toBeLessThanOrEqual(1);
    expectConsistent(state.user);
    // quem perdeu a estrutura nao ganha nem perde ouro
    expect(deltaOf(rival, rivalBefore)).toEqual({ team: 0, players: [0, 0, 0, 0, 0] });
  });

  it("a primeira torre do jogo paga 300 a mais, uma unica vez", () => {
    const state = freshState();
    expect(state.firstTurretDone).toBe(false);
    leaveOnlyTier(state.rival, "mid", "outer");
    leaveOnlyTier(state.rival, "top", "outer");

    const a = snapshot(state.user);
    damageStructure(state, "user", state.rival, "mid", 0);
    expect(deltaOf(state.user, a).team).toBe(400 + 300);
    expect(state.firstTurretDone).toBe(true);

    const b = snapshot(state.user);
    damageStructure(state, "user", state.rival, "top", 0);
    // o time ja esta na frente, entao sem recompensa, e sem segundo bonus
    expect(deltaOf(state.user, b).team).toBe(400);
    expectConsistent(state.user);
  });

  it("aos 10:00, a torre externa sem placa tirada paga as 5 placas a 120", () => {
    const state = freshState();
    state.gameTimeSec = 600;
    state.firstTurretDone = true;
    leaveOnlyTier(state.rival, "bot", "outer");
    const before = snapshot(state.user);

    damageStructure(state, "user", state.rival, "bot", 0);

    expect(deltaOf(state.user, before).team).toBe(600);
    expectConsistent(state.user);
  });

  it("torre que cai com placas parciais paga exatamente as 5 placas no total, nunca mais", () => {
    const state = freshState();
    state.firstTurretDone = true;
    leaveOnlyTier(state.rival, "mid", "inner");
    const before = snapshot(state.user);

    expect(collectPlates(state, "user", "mid", "inner", 2)).toBe(2); // a pressao tirou 2
    damageStructure(state, "user", state.rival, "mid", 0); // a queda (Arauto, janela ou press)
    expect(collectPlates(state, "user", "mid", "inner", 3)).toBe(0); // nada mais sai

    expect(deltaOf(state.user, before).team).toBe(5 * 80);
    expect(state.rival.structureDamage.mid.innerPlates).toBe(5);
    expectConsistent(state.user);
  });
});

describe("placa (collectPlates)", () => {
  it("credita o valor da placa da hora ao time (80 as 21:40), 16 por jogador, e nao mexe no outro time", () => {
    const state = freshState();
    const before = snapshot(state.user);
    const rivalBefore = snapshot(state.rival);

    expect(collectPlates(state, "user", "mid", "outer", 1)).toBe(1);

    const d = deltaOf(state.user, before);
    expect(d.team).toBe(80);
    expect(d.players).toEqual([16, 16, 16, 16, 16]);
    expectConsistent(state.user);
    expect(deltaOf(state.rival, rivalBefore)).toEqual({ team: 0, players: [0, 0, 0, 0, 0] });
  });

  it("nunca passa de 5 placas por torre", () => {
    const state = freshState();
    const before = snapshot(state.user);
    expect(collectPlates(state, "user", "top", "outer", 4)).toBe(4);
    expect(collectPlates(state, "user", "top", "outer", 3)).toBe(1);
    expect(deltaOf(state.user, before).team).toBe(5 * 80);
  });

  it("torre do Nexus nao tem placa", () => {
    const state = freshState();
    expect(collectPlates(state, "user", "top", "nexusTurret", 2)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Barao e objetivos (patch 26): ouro global por jogador e ouro de quem confirma
// ---------------------------------------------------------------------------

function baronReady(): MatchState {
  const state = freshState();
  state.gameTimeSec = TIMERS.BARON_SPAWN + 60;
  state.objectives.baronAlive = true;
  return state;
}

describe("ouro do Barao (patch 26)", () => {
  it("credita 150 a cada jogador do time, vivo ou morto, e 100 a quem confirma (o jungler vivo)", () => {
    const state = baronReady();
    state.user.players.top.alive = false;
    state.user.players.support.alive = false;
    const before = snapshot(state.user);

    takeObjective(state, "user", "baron", mulberry32(1));

    const d = deltaOf(state.user, before);
    expect(d.team).toBe(850);
    // ROLES = top, jungle, mid, adc, support
    expect(d.players).toEqual([150, 250, 150, 150, 150]);
    expectConsistent(state.user);
  });

  it("com o jungler morto, confirma o vivo de melhor fatia de objetivo", () => {
    const state = baronReady();
    state.user.players.jungle.alive = false;
    const before = snapshot(state.user);

    takeObjective(state, "user", "baron", mulberry32(1));

    // cards iguais: o primeiro vivo na ordem de ROLES (top) confirma
    expect(deltaOf(state.user, before).players).toEqual([250, 150, 150, 150, 150]);
    expectConsistent(state.user);
  });

  it("nao credita nada ao time rival", () => {
    const state = baronReady();
    const rivalBefore = snapshot(state.rival);
    takeObjective(state, "user", "baron", mulberry32(1));
    expect(deltaOf(state.rival, rivalBefore).team).toBe(0);
  });
});

describe("ouro de quem confirma o objetivo (patch 26)", () => {
  it("dragao: 75 para o jungler vivo", () => {
    const state = freshState();
    state.objectives.dragonAlive = true;
    state.objectives.dragonElement = "infernal";
    const before = snapshot(state.user);
    takeObjective(state, "user", "dragon", mulberry32(1));
    expect(deltaOf(state.user, before).players).toEqual([0, 75, 0, 0, 0]);
    expectConsistent(state.user);
  });

  it("larvas: 30 por larva para quem confirma", () => {
    const state = freshState();
    state.gameTimeSec = 600;
    state.objectives.voidgrubsAlive = 3;
    state.objectives.voidgrubsWave = 1;
    const before = snapshot(state.user);
    takeObjective(state, "user", "voidgrubs", mulberry32(1));
    expect(deltaOf(state.user, before).players).toEqual([0, 90, 0, 0, 0]);
  });

  it("Arauto: 100 para quem confirma", () => {
    const state = freshState();
    state.gameTimeSec = 1000;
    state.objectives.heraldAlive = true;
    const before = snapshot(state.user);
    takeObjective(state, "user", "herald", mulberry32(1));
    expect(deltaOf(state.user, before).players).toEqual([0, 100, 0, 0, 0]);
  });

  it("Anciao: 150 para cada jogador e 100 para quem confirma", () => {
    const state = freshState();
    state.user.soul = "infernal";
    state.objectives.elderUnlocked = true;
    state.objectives.elderAlive = true;
    const before = snapshot(state.user);
    takeObjective(state, "user", "elder", mulberry32(1));
    expect(deltaOf(state.user, before).players).toEqual([150, 250, 150, 150, 150]);
    expectConsistent(state.user);
  });
});

// ---------------------------------------------------------------------------
// Recompensa de objetivo: exatamente uma vez
// ---------------------------------------------------------------------------

describe("recompensa de objetivo paga exatamente uma vez", () => {
  it("tomada de dragao: a recompensa, uma vez, dividida entre os cinco, mais o ouro de quem confirma", () => {
    const state = freshState();
    state.objectives.dragonAlive = true;
    state.objectives.dragonElement = "infernal";
    putUserBehind(state);
    const before = snapshot(state.user);

    takeObjective(state, "user", "dragon", mulberry32(1));

    const d = deltaOf(state.user, before);
    expect(d.team).toBe(BOUNTY_WHEN_BEHIND + 75);
    expect(d.players).toEqual([80, 155, 80, 80, 80]);
    expectConsistent(state.user);
  });

  it("tomada de Barao: recompensa (uma vez) mais o ouro do patch 26", () => {
    const state = baronReady();
    state.user.players.top.alive = false;
    state.user.players.support.alive = false;
    putUserBehind(state);
    const before = snapshot(state.user);

    takeObjective(state, "user", "baron", mulberry32(1));

    // dois pagamentos da recompensa dariam 800 + 850
    expect(deltaOf(state.user, before).team).toBe(BOUNTY_WHEN_BEHIND + 850);
    expectConsistent(state.user);
  });

  it("roubo de Barao passa por takeObjective: recompensa uma vez mais o ouro do patch 26", () => {
    const state = baronReady();
    state.user.players.top.alive = false;
    state.user.players.support.alive = false;
    putUserBehind(state);
    const before = snapshot(state.user);

    stealObjective(state, "user", "baron", { attemptingSide: "rival", contesting: true }, mulberry32(1));

    expect(deltaOf(state.user, before).team).toBe(BOUNTY_WHEN_BEHIND + 850);
    expectConsistent(state.user);
  });

  it("quem esta na frente toma o objetivo sem recompensa", () => {
    const state = freshState();
    state.objectives.dragonAlive = true;
    state.objectives.dragonElement = "infernal";
    setGoldPerPlayer(state.user, 4600);
    setGoldPerPlayer(state.rival, 3000);
    const before = snapshot(state.user);

    takeObjective(state, "user", "dragon", mulberry32(1));

    // so o ouro de quem confirma (75), sem recompensa de objetivo
    expect(deltaOf(state.user, before).team).toBe(75);
  });

  it.each(TIER_GOLD.filter((t) => t.tier !== "nexusTurret"))(
    "estrutura $tier: recompensa uma vez mais $gold da propria estrutura",
    ({ tier, gold }) => {
      const state = freshState();
      state.firstTurretDone = true;
      leaveOnlyTier(state.rival, "mid", tier);
      putUserBehind(state);
      const before = snapshot(state.user);

      damageStructure(state, "user", state.rival, "mid", 0);

      const d = deltaOf(state.user, before);
      expect(d.team).toBe(BOUNTY_WHEN_BEHIND + gold);
      expect(d.players.reduce((s, g) => s + g, 0)).toBe(BOUNTY_WHEN_BEHIND + gold);
      expectConsistent(state.user);
    }
  );
});

// ---------------------------------------------------------------------------
// Assistencia dividida, dentro de uma partida de verdade
// ---------------------------------------------------------------------------

describe("assistencia dividida (applyKill, via simulateMatch)", () => {
  const SEEDS = Array.from({ length: 24 }, (_, i) => i);

  function runAndCollect(): { rows: KillRow[]; totalKills: number } {
    killLog.rows = [];
    killLog.cur = null;
    killLog.on = true;
    let totalKills = 0;
    try {
      for (const seed of SEEDS) {
        const res = simulateMatch(roster(70), roster(70), mulberry32(seed));
        totalKills += res.finalState.user.kills + res.finalState.rival.kills;
      }
    } finally {
      killLog.on = false;
    }
    return { rows: killLog.rows.slice(), totalKills };
  }

  let rows: KillRow[] = [];
  let totalKills = 0;
  beforeAll(() => {
    ({ rows, totalKills } = runAndCollect());
  });

  it("o espiao viu todos os abates das partidas", () => {
    expect(rows.length).toBe(totalKills);
    expect(rows.length).toBeGreaterThan(100);
  });

  it("o abatedor recebe o valor do abate e o pote de assistencia e a metade dele, arredondada", () => {
    for (const row of rows) {
      expect(row.credits[0]).toBe(row.killGold);
      if (row.split === null) continue;
      expect(row.split.total).toBe(Math.round(row.killGold * 0.5));
    }
  });

  it("o pote e dividido por splitEvenly entre 1 e 4 assistentes, sem perder ouro", () => {
    for (const row of rows) {
      if (row.split === null) continue;
      const { total, n, shares } = row.split;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
      expect(shares).toHaveLength(n);
      expect(shares.reduce((s, x) => s + x, 0)).toBe(total);
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      // as primeiras partes levam o resto
      expect([...shares].sort((a, b) => b - a)).toEqual(shares);
      // cada assistente foi creditado exatamente com a sua parte, na ordem
      expect(row.credits.slice(1)).toEqual(shares);
    }
  });

  it("a vitima entrega o abate mais o que os assistentes receberam (ou so o abate, sem assistente)", () => {
    for (const row of rows) {
      const assisted = row.split ? row.split.shares.reduce((s, x) => s + x, 0) : 0;
      expect(row.settledWith).toBe(row.killGold + assisted);
      expect(row.credits).toHaveLength(1 + (row.split?.n ?? 0));
    }
  });

  it("o primeiro abate de cada partida e o first blood: 400, com pote de 200", () => {
    const firstBloods = rows.filter((r) => r.isFirstBlood);
    expect(firstBloods).toHaveLength(SEEDS.length);
    for (const row of firstBloods) {
      expect(row.killGold).toBe(400);
      if (row.split) expect(row.split.total).toBe(200);
    }
  });

  it("aparecem as divisoes desiguais: pote impar entre 2 a 4 assistentes", () => {
    const uneven = rows.filter((r) => r.split && r.split.n >= 2 && r.split.total % r.split.n !== 0);
    expect(uneven.length).toBeGreaterThan(0);
    const counts = new Set(rows.filter((r) => r.split).map((r) => r.split!.n));
    expect(counts.has(1)).toBe(true);
    expect(counts.has(4)).toBe(true);
  });
});
