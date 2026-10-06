/**
 * src/sim/runMatchEngine.test.ts
 *
 * Phase 6 — the bridge from the engine to the persisted/playback contract.
 * Guarantees every produced GameEvent validates against the stored schema (so
 * saveTournament can't throw) and carries the rich ticker fields.
 *
 * Phase 7 (CHAMP-03) — adiciona cobertura de champions atribuidos: prova que
 * meta e inerte (resultado identico com e sem champions para o mesmo seed).
 */

import { describe, it, expect } from "vitest";
import { makePlayer } from "../draft/orchestrator.test";
import { runMatchEngine } from "./runMatchEngine";
import { GameEventSchema, MatchResultSchema } from "./types";
import { ROLES } from "./matchState";
import type { PlayerVersion } from "../data/schema";

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

function input(us: number, rs: number) {
  return {
    userRoster: roster("u", us),
    rivalRoster: roster("r", rs),
    userChampions: {},
    rivalChampions: {},
    speedPreset: "fast" as const,
  };
}

describe("runMatchEngine — engine → persisted contract bridge", () => {
  it("returns a MatchResult that validates against the schema", () => {
    const res = runMatchEngine(input(72, 68), 42);
    expect(() => MatchResultSchema.parse(res)).not.toThrow();
  });

  it("every event validates against GameEventSchema (persistence-safe)", () => {
    const res = runMatchEngine(input(75, 65), 7);
    for (const ev of res.events) {
      expect(() => GameEventSchema.parse(ev)).not.toThrow();
    }
  });

  it("every event carries a rich ticker line", () => {
    const res = runMatchEngine(input(70, 70), 3);
    for (const ev of res.events) {
      expect(typeof ev.ticker).toBe("string");
      expect(ev.ticker!.length).toBeGreaterThan(0);
    }
  });

  it("playback positions are monotonic and end at totalPlaybackMs", () => {
    const res = runMatchEngine(input(70, 66), 11);
    let prev = -1;
    for (const ev of res.events) {
      expect(ev.playbackMs).toBeGreaterThanOrEqual(prev);
      prev = ev.playbackMs;
      expect(ev.playbackMs).toBeLessThanOrEqual(res.totalPlaybackMs);
    }
    expect(res.events[res.events.length - 1].playbackMs).toBe(res.totalPlaybackMs);
  });

  it("is deterministic for a given seed", () => {
    const a = runMatchEngine(input(73, 67), 99);
    const b = runMatchEngine(input(73, 67), 99);
    expect(a.events.map((e) => e.ticker)).toEqual(b.events.map((e) => e.ticker));
    expect(a.winner).toBe(b.winner);
  });

  it("ends on a gg event", () => {
    const res = runMatchEngine(input(80, 60), 5);
    // Phase 28 (plano 28-04): a timeline termina em "gg", opcionalmente
    // seguido de exatamente um "upset_win" (destaque de zebra, D-03/D-04/D-05).
    // Continua reprovando qualquer outro tipo na ultima posicao.
    const lastEvent = res.events[res.events.length - 1];
    if (lastEvent.type === "upset_win") {
      expect(res.events[res.events.length - 2].type).toBe("gg");
    } else {
      expect(lastEvent.type).toBe("gg");
    }
  });

  it("the live map snapshot agrees with the engine truth (Baron timer, gating)", () => {
    const res = runMatchEngine(input(74, 66), 13);
    for (const ev of res.events) {
      const m = ev.map!;
      // Baron is never alive before 20:00 on the map either.
      if (ev.gameTimeMs < 20 * 60 * 1000) expect(m.baronAlive).toBe(false);
      // A nexus-exposed event means that team's map shows it exposed with a
      // cleared lane (some inhibitor down) — the structural gating, visualised.
      if (ev.type === "nexus_exposed") {
        const exposedTeam = m.user.nexusExposed ? m.user : m.rival;
        expect(exposedTeam.nexusExposed).toBe(true);
        expect(exposedTeam.nexusTurrets).toBe(0);
        const anyLaneOpen =
          !exposedTeam.top.inhibitor || !exposedTeam.mid.inhibitor || !exposedTeam.bot.inhibitor;
        expect(anyLaneOpen).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// CHAMP-03 — champions atribuidos chegam a simulacao sem erro; meta inerte
// ---------------------------------------------------------------------------

describe("runMatchEngine — CHAMP-03 champion assignments (meta inerte)", () => {
  // Rosters com IDs deterministas para mapear playerId -> championId
  const SEED = 77;
  const STRENGTH_USER = 71;
  const STRENGTH_RIVAL = 69;

  function rosterWithIds(prefix: string, s: number): PlayerVersion[] {
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

  // Mapeamento playerId -> championId real (IDs em lowercase-kebab do CHAMPION_META)
  // Exercita o caminho CHAMPION_META[id] para cada role
  const USER_CHAMPIONS: Record<string, string> = {
    "u2-top":     "camille",   // diver/split — entrada explicita em CHAMPION_META
    "u2-jungle":  "lee-sin",   // skirmisher/early — entrada explicita
    "u2-mid":     "akali",     // assassin/pick — entrada explicita
    "u2-adc":     "jinx",      // marksman/scaling — entrada explicita
    "u2-support": "alistar",   // engage-support/wombo — entrada explicita
  };

  const RIVAL_CHAMPIONS: Record<string, string> = {
    "r2-top":     "darius",   // fighter/early-snowball
    "r2-jungle":  "graves",   // skirmisher/objective-control
    "r2-mid":     "azir",     // mage/scaling
    "r2-adc":     "caitlyn",  // marksman/poke
    "r2-support": "braum",    // engage-support/protect
  };

  const userRoster = rosterWithIds("u2", STRENGTH_USER);
  const rivalRoster = rosterWithIds("r2", STRENGTH_RIVAL);

  it("roda sem erro com champions atribuidos e retorna timeline nao-vazia (CHAMP-03)", () => {
    const inputWithChampions = {
      userRoster,
      rivalRoster,
      userChampions: USER_CHAMPIONS,
      rivalChampions: RIVAL_CHAMPIONS,
      speedPreset: "fast" as const,
    };
    const res = runMatchEngine(inputWithChampions, SEED);
    expect(res.winner).toMatch(/^(user|rival)$/);
    expect(res.events.length).toBeGreaterThan(0);
    // Phase 28 (plano 28-04): a timeline termina em "gg", opcionalmente
    // seguido de exatamente um "upset_win" (destaque de zebra, D-03/D-04/D-05).
    // Continua reprovando qualquer outro tipo na ultima posicao.
    const lastEvent = res.events[res.events.length - 1];
    if (lastEvent.type === "upset_win") {
      expect(res.events[res.events.length - 2].type).toBe("gg");
    } else {
      expect(lastEvent.type).toBe("gg");
    }
  });

  it("resultado deterministico: dois runs com os mesmos champions e seed produzem resultado identico (DET-02 + CHAMP-03)", () => {
    // RE_ANCHOR_FASE9: a partir da Fase 9 o archetype do campeao afeta a elasticidade
    // de ouro (GOLD-03), portanto "com champions" e "sem champions" podem ter resultados
    // diferentes (meta nao e mais inerte para fights — ela altera goldFightMult).
    // O que DET-02 garante e que dois runs com OS MESMOS champions e seed produzem
    // resultado identico — determinismo intra-configuracao, nao neutralidade de meta.
    const inputA = {
      userRoster,
      rivalRoster,
      userChampions: USER_CHAMPIONS,
      rivalChampions: RIVAL_CHAMPIONS,
      speedPreset: "fast" as const,
    };
    const inputB = {
      userRoster,
      rivalRoster,
      userChampions: USER_CHAMPIONS,
      rivalChampions: RIVAL_CHAMPIONS,
      speedPreset: "fast" as const,
    };

    const resA = runMatchEngine(inputA, SEED);
    const resB = runMatchEngine(inputB, SEED);

    // Vencedor identico entre dois runs com a mesma configuracao
    expect(resA.winner).toBe(resB.winner);

    // Sequencia estrutural de eventos identica — prova DET-02 intra-configuracao
    expect(resA.events.map((e) => ({ type: e.type, team: e.team, gameTimeMs: e.gameTimeMs }))).toEqual(
      resB.events.map((e) => ({ type: e.type, team: e.team, gameTimeMs: e.gameTimeMs }))
    );
  });
});
