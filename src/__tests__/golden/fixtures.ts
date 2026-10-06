/**
 * src/__tests__/golden/fixtures.ts
 *
 * Fixtures sinteticas para a rede de regressao golden-seed (DET-01/DET-03).
 *
 * Tres cenarios de matchup (D-09/D-12):
 *  - stomp:      time usuario claramente superior (overall 84 vs 58)
 *  - balanced:   matchup equilibrado (overall 70 vs 68)
 *  - close:      matchup apertado (overall 65 vs 57)
 *
 * Fixture flat (D-10, DET-03):
 *  - flatRoster: stats achatados (todos = 1.0 em termos de forca relativa),
 *    usada APENAS para provar neutralidade do meta (meta inerte = delta 0).
 *    Artefato distinto das fixtures do golden — nao entra nos 15 snapshots.
 *
 * Digest estrutural (D-11):
 *  - digestTimeline serializa APENAS: winner + finalScore + events.
 *  - PROIBIDO incluir campos de UI: winProbUserAfter, playbackMs, qualquer
 *    campo textual de apresentacao (texto pt-BR do evento).
 */

import type { PlayerVersion, Role } from "../../data/schema";
import { createInitialMatchState, ROLES } from "../../sim/matchState";
import type { MatchState } from "../../sim/matchState";
import { makePlayer, BASE_CHAMPION_POOL } from "../helpers/makePlayer";
import type { SimulationResult } from "../../sim/engine";

// ---------------------------------------------------------------------------
// Seeds fixas para os 15 snapshots (3 cenarios x 5 seeds)
// ---------------------------------------------------------------------------

export const GOLDEN_SEEDS = [1, 42, 123, 777, 999] as const;

// ---------------------------------------------------------------------------
// Cenario 1: STOMP — usuario claramente superior (84 vs 58)
// IDs estaveis e unicos para nao colidir com outros fixtures
// ---------------------------------------------------------------------------

export const STOMP_USER: PlayerVersion[] = ROLES.map((r) =>
  makePlayer(r, {
    id: `stomp-u-${r}`,
    personId: `stomp-u-${r}`,
    displayName: `StompUser-${r}`,
    lanePhase: 84,
    midGame: 84,
    lateGame: 84,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [r]: 84 },
  })
);

export const STOMP_RIVAL: PlayerVersion[] = ROLES.map((r) =>
  makePlayer(r, {
    id: `stomp-r-${r}`,
    personId: `stomp-r-${r}`,
    displayName: `StompRival-${r}`,
    lanePhase: 58,
    midGame: 58,
    lateGame: 58,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [r]: 58 },
  })
);

// ---------------------------------------------------------------------------
// Cenario 2: BALANCED — matchup equilibrado (70 vs 68)
// ---------------------------------------------------------------------------

export const BALANCED_USER: PlayerVersion[] = ROLES.map((r) =>
  makePlayer(r, {
    id: `balanced-u-${r}`,
    personId: `balanced-u-${r}`,
    displayName: `BalancedUser-${r}`,
    lanePhase: 70,
    midGame: 70,
    lateGame: 70,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [r]: 70 },
  })
);

export const BALANCED_RIVAL: PlayerVersion[] = ROLES.map((r) =>
  makePlayer(r, {
    id: `balanced-r-${r}`,
    personId: `balanced-r-${r}`,
    displayName: `BalancedRival-${r}`,
    lanePhase: 68,
    midGame: 68,
    lateGame: 68,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [r]: 68 },
  })
);

// ---------------------------------------------------------------------------
// Cenario 3: CLOSE — matchup muito apertado (65 vs 57)
// ---------------------------------------------------------------------------

export const CLOSE_USER: PlayerVersion[] = ROLES.map((r) =>
  makePlayer(r, {
    id: `close-u-${r}`,
    personId: `close-u-${r}`,
    displayName: `CloseUser-${r}`,
    lanePhase: 65,
    midGame: 65,
    lateGame: 65,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [r]: 65 },
  })
);

export const CLOSE_RIVAL: PlayerVersion[] = ROLES.map((r) =>
  makePlayer(r, {
    id: `close-r-${r}`,
    personId: `close-r-${r}`,
    displayName: `CloseRival-${r}`,
    lanePhase: 57,
    midGame: 57,
    lateGame: 57,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [r]: 57 },
  })
);

// ---------------------------------------------------------------------------
// Fixture flat (D-10, DET-03)
// Stats achatados: todos os atributos iguais para que nenhum multiplicador
// de meta produza diferenca (meta inerte = delta 0).
// APENAS para o teste de neutralidade DET-03 — NAO entra nos 15 snapshots.
// ---------------------------------------------------------------------------

export function flatRoster(prefix: string, strength: number): PlayerVersion[] {
  return ROLES.map((r) =>
    makePlayer(r, {
      id: `${prefix}-${r}`,
      personId: `${prefix}-${r}`,
      displayName: `Flat-${prefix}-${r}`,
      lanePhase: strength,
      midGame: strength,
      lateGame: strength,
      roleStrength: {
        top: strength,
        jungle: strength,
        mid: strength,
        adc: strength,
        support: strength,
      },
    })
  );
}

// ---------------------------------------------------------------------------
// makeFlatCard — helper sintetico Wave 0 (REG-02/04, MET-03, D-11)
//
// Produz um PlayerVersion "cru" sem bloco `advanced` e sem traits, ancorado
// em diferenca relativa: funciona para qualquer overall 35-70 sem calibracao
// nos numeros do roster real. Usado pelos testes de:
//  - neutralidade de overlay identity (MET-03): lanePhase=midGame=lateGame=overall
//  - derivacao automatica de advanced (REG-02/04): advanced ausente (nao emitido)
//  - todas as 5 chaves de roleStrength = overall
//
// PROIBIDO: nao chama rng()/Math.random; puro e deterministico (T-08-01).
// ---------------------------------------------------------------------------

export function makeFlatCard(role: Role, overall: number): PlayerVersion {
  return {
    id: `flat-${role}-${overall}`,
    personId: `flat-${role}`,
    displayName: `Flat-${role}-${overall}`,
    year: 2020,
    roles: [role],
    primaryRole: role,
    // Todos os tres campos de fase iguais ao overall — neutralidade garantida
    lanePhase: overall,
    midGame: overall,
    lateGame: overall,
    // Todas as 5 chaves = overall para que nenhum role produza assimetria
    roleStrength: {
      top: overall,
      jungle: overall,
      mid: overall,
      adc: overall,
      support: overall,
    },
    // traits vazio: sem bonus de trait para isolar o sinal de overall puro
    traits: [],
    // championPool com 8 entradas genericas (minimo do schema) sem especializacao
    // por role — forca derivacao de meta/maestria pelo role do card (default path)
    championPool: BASE_CHAMPION_POOL,
    // bloco `advanced` AUSENTE (nao undefined explicito) — prova REG-02/04:
    // a engine deriva automaticamente quando nao ha dados de persona.
  };
}

// ---------------------------------------------------------------------------
// makeDeltaMatchState — helper sintetico Wave 0 (GOLD-04, D-11)
//
// Monta um MatchState com dois times flat (via makeFlatCard por role) e
// posiciona o gold dos jogadores do role-alvo de forma monotonica no overall:
// gold = 500 (start) + overall * 10 * minute (ancora simples, sem calibracao).
//
// Proposito: permitir que o teste GOLD-04 compare o gap (overallA - overallB)
// em duas faixas (45 vs 40) e (90 vs 85) e prove que a diferenca relativa
// e a mesma — equivalencia de mesmo-gap independente da faixa absoluta.
//
// NAO implementa expectedGoldForRoleAtMinute (dono do Plano 03/power.ts).
// Os valores de gold sao ancoras de TESTE, nao calibracao de runtime.
//
// PROIBIDO: nao chama rng()/Math.random; puro e deterministico (T-08-01).
// ---------------------------------------------------------------------------

export function makeDeltaMatchState(
  overallA: number,
  overallB: number,
  role: Role,
  minute: number
): MatchState {
  // Montar rosters completos com um card flat por role em cada lado.
  // Todos os roles do mesmo time recebem o mesmo overall — a diferenca de gold
  // e aplicada apenas no role-alvo abaixo, isolando o sinal de GOLD-04.
  const userRoster: PlayerVersion[] = ROLES.map((r) => makeFlatCard(r, overallA));
  const rivalRoster: PlayerVersion[] = ROLES.map((r) => makeFlatCard(r, overallB));

  const state = createInitialMatchState(userRoster, rivalRoster, {
    userName: `FlatUser-${overallA}`,
    rivalName: `FlatRival-${overallB}`,
  });

  // Avançar o relogio para o minuto solicitado
  state.gameTimeSec = minute * 60;

  // Posicionar gold dos jogadores do role-alvo de forma monotonica no overall.
  // Formula: gold = 500 (inicio) + overall * 10 * minute
  // Ancora de teste — nunca usada em runtime. Monotonico: maior overall => mais ouro.
  const goldForOverall = (ov: number) => 500 + ov * 10 * minute;

  state.user.players[role].gold = goldForOverall(overallA);
  state.rival.players[role].gold = goldForOverall(overallB);

  return state;
}

// ---------------------------------------------------------------------------
// GoldenDigest — shape estrutural do snapshot (D-11)
// Proibido incluir campos de UI: o texto pt-BR do evento, winProbUserAfter, playbackMs, score, map
// ---------------------------------------------------------------------------

export interface GoldenDigest {
  winner: string;
  finalScore: {
    userKills: number;
    userTowers: number;
    userDragons: number;
    rivalKills: number;
    rivalTowers: number;
    rivalDragons: number;
  };
  events: Array<{
    kind: string;
    timeSec: number;
    side: string | null;
    actors: string[];
    victims: string[];
  }>;
}

/**
 * digestTimeline — serializa um SimulationResult para um GoldenDigest estavel.
 *
 * Estabilidade cross-run (A1):
 *  - Chaves explicitas (nao spread de objeto mutavel)
 *  - Arrays sorted (actors/victims: sort() garante ordem deterministica)
 *  - timeSec arredondado (Math.round elimina drift de ponto flutuante)
 *
 * D-11 enforced: nenhum campo de UI, winProbUserAfter, playbackMs etc.
 * O grep de aceitacao confirma ausencia de campos textuais de apresentacao.
 */
export function digestTimeline(result: SimulationResult): string {
  const { user, rival } = result.finalState;

  const digest: GoldenDigest = {
    winner: result.winner,
    finalScore: {
      userKills: user.kills,
      userTowers: user.towersDestroyed,
      userDragons: user.dragons.length,
      rivalKills: rival.kills,
      rivalTowers: rival.towersDestroyed,
      rivalDragons: rival.dragons.length,
    },
    events: result.timeline.map((ev) => ({
      kind: ev.kind,
      timeSec: Math.round(ev.timeSec),
      side: ev.side,
      actors: [...ev.actors].sort(),
      victims: [...ev.victims].sort(),
    })),
  };

  return JSON.stringify(digest, null, 2);
}
