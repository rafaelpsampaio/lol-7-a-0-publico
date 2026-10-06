/**
 * src/sim/selection.test.ts
 *
 * Cobertura de selection.ts (KDA-01/02/03/05, Phase 12):
 *  - selectKiller/selectVictim retornam PlayerState plausivel (KDA-01)
 *  - Role bias: killerScore(support) < killerScore(adc) em teamfight (KDA-02)
 *  - assignAssists: nunca > ASSIST_COUNT_BY_EVENT[type] (KDA-03)
 *  - assignAssists: re-rank deterministico, mesmo input, mesmo output (DET-02)
 *  - Arity gate: draw count pos-migracao == draw count pre-migracao (KDA-05)
 *
 * ESTADO NO WAVE 0: RED, selection.ts ainda nao existe.
 * Este arquivo ficara em RED ate o Plano 02 criar o modulo.
 */

import { describe, it, expect } from "vitest";
import {
  selectKiller,
  selectVictim,
  assignAssists,
  assistScore,
  assistWeight,
  permutationUniform,
  ASSIST_COUNT_BY_EVENT,
  ASSIST_MIN_SCORE,
  ASSIST_WEIGHT_FLOOR,
  softCapDamp,
  PLAUSIBLE_BAND,
  DAMP_FLOOR,
} from "./selection";
import { makeFlatCard } from "../__tests__/golden/fixtures";
import { ROLES, createInitialMatchState } from "./matchState";
import { mulberry32 } from "./rng";

// ---------------------------------------------------------------------------
// Fixture: MatchState flat (sem champion assignments => meta = ROLE_DEFAULTS)
// Usado pelos testes de identidade (INV-2) e arity gate.
// ---------------------------------------------------------------------------

function buildFlatMatchState() {
  const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
  const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
  return createInitialMatchState(userRoster, rivalRoster);
}

// ---------------------------------------------------------------------------
// Contexto minimo de luta para os testes: FightContext sera exportado de
// selection.ts; aqui usamos o shape esperado (eventType obrigatorio).
// ---------------------------------------------------------------------------

const BASE_CTX = {
  eventType: "kill" as const,
  gameTimeSec: 300,
  phase: "mid" as const,
};

// ---------------------------------------------------------------------------
// describe: selectKiller
// ---------------------------------------------------------------------------

describe("selectKiller", () => {
  it("retorna PlayerState valido do pool de vivos (KDA-01)", () => {
    const state = buildFlatMatchState();
    const candidates = ROLES.map((r) => state.user.players[r]);
    const rng = mulberry32(1);
    const killer = selectKiller(candidates, BASE_CTX, rng);
    expect(killer).toBeDefined();
    expect(killer.alive).toBe(true);
    expect(ROLES).toContain(killer.role);
  });

  it("suporte tem peso menor que ADC em teamfight (KDA-02)", () => {
    // Para validar o bias de role sem execucao probabilistica:
    // selectKiller deve ser chamado muitas vezes com a mesma seed;
    // a fracao de vezes que retorna ADC deve superar a de support.
    const state = buildFlatMatchState();
    const candidates = ROLES.map((r) => state.user.players[r]);
    const ctx = { ...BASE_CTX, eventType: "kill" as const };
    let adcCount = 0;
    let supportCount = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const rng = mulberry32(i + 1000);
      const k = selectKiller(candidates, ctx, rng);
      if (k.role === "adc") adcCount++;
      if (k.role === "support") supportCount++;
    }
    // KDA-02: killerScore(support) < killerScore(adc) => ADC selecionado mais vezes
    expect(adcCount).toBeGreaterThan(supportCount);
  });
});

// ---------------------------------------------------------------------------
// describe: selectVictim
// ---------------------------------------------------------------------------

describe("selectVictim", () => {
  it("retorna PlayerState valido ou null se ninguem vivo (KDA-01)", () => {
    const state = buildFlatMatchState();
    const candidates = ROLES.map((r) => state.rival.players[r]);
    const rng = mulberry32(42);
    const victim = selectVictim(candidates, BASE_CTX, rng);
    // Todos vivos no estado inicial => deve retornar um player
    expect(victim).not.toBeNull();
    if (victim !== null) {
      expect(victim.alive).toBe(true);
      expect(ROLES).toContain(victim.role);
    }
  });

  it("retorna null quando lista de candidatos esta vazia (KDA-01)", () => {
    const rng = mulberry32(42);
    // Pool vazio => sem candidatos vivos => null
    const victim = selectVictim([], BASE_CTX, rng);
    expect(victim).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// describe: assignAssists
// ---------------------------------------------------------------------------

describe("assignAssists", () => {
  it("nunca excede ASSIST_COUNT_BY_EVENT[eventType] (KDA-03)", () => {
    const state = buildFlatMatchState();
    const mates = ROLES.filter((r) => r !== "adc").map(
      (r) => state.user.players[r]
    );
    const killer = state.user.players.adc;
    const maxAllowed = ASSIST_COUNT_BY_EVENT["kill"] ?? 3;
    // Testar com nAssists variados de 1 a 4
    for (let n = 1; n <= 4; n++) {
      const assistants = assignAssists(killer.card.id, mates, n, BASE_CTX);
      expect(assistants.length).toBeLessThanOrEqual(maxAllowed);
    }
  });

  it("mesmo input sempre mesmo output, deterministico (DET-02)", () => {
    const state = buildFlatMatchState();
    const mates = ROLES.filter((r) => r !== "adc").map(
      (r) => state.user.players[r]
    );
    const killer = state.user.players.adc;
    // assignAssists nao recebe rng, deve ser puro/deterministico
    const result1 = assignAssists(killer.card.id, mates, 2, BASE_CTX);
    const result2 = assignAssists(killer.card.id, mates, 2, BASE_CTX);
    expect(result1.map((p) => p.role)).toEqual(result2.map((p) => p.role));
  });
});

// ---------------------------------------------------------------------------
// describe: teto elevado pelo plano 26-06 (AST-02, criterio 6 do roadmap)
//
// Vigiam os tres tipos que a verificacao do plano 26-02 mostrou efetivamente
// alcancados pelo caminho de abate (gank, solo_kill: pickoff; comeback_fight:
// teamfight), o fallback para tipo ausente da tabela, e o comportamento real
// de assignAssists, para que a tabela e o consumidor nunca divirjam em
// silencio (T-26-20).
// ---------------------------------------------------------------------------

describe("teto elevado pelo plano 26-06 (AST-02)", () => {
  it("o teto retornado pelo getter para os tres tipos alcancados tem o valor novo", () => {
    // gank e solo_kill (pickoff): 2 -> 3. comeback_fight (teamfight): permanece
    // 4 na tabela, ja que o teto real subiu por construcao via o limite do
    // sorteio (engine.ts), nao por edicao desta tabela.
    expect(ASSIST_COUNT_BY_EVENT["gank"]).toBe(3);
    expect(ASSIST_COUNT_BY_EVENT["solo_kill"]).toBe(3);
    expect(ASSIST_COUNT_BY_EVENT["comeback_fight"]).toBe(4);
  });

  it("um tipo ausente da tabela continua caindo no fallback nomeado (2)", () => {
    // "double_kill" e um EventKind valido que nunca teve entrada propria em
    // ASSIST_COUNT_BY_EVENT: exercita o ramo de fallback (ASSIST_COUNT_FALLBACK).
    expect(ASSIST_COUNT_BY_EVENT["double_kill"]).toBeUndefined();
    const state = buildFlatMatchState();
    const mates = ROLES.filter((r) => r !== "adc").map(
      (r) => state.user.players[r]
    );
    const killer = state.user.players.adc;
    for (let n = 1; n <= 4; n++) {
      const assistants = assignAssists(killer.card.id, mates, n, {
        eventType: "double_kill",
      });
      expect(assistants.length).toBeLessThanOrEqual(2);
    }
  });

  it("com populacao suficiente e evento de pickoff, a quantidade atribuida nunca ultrapassa o teto do tipo (3)", () => {
    // Comportamento, nao so valor de tabela: exercita o caminho real de
    // atribuicao com nAssists ate 4 (o novo maximo do sorteio) e populacao de
    // companheiros de 3 a 4, para os dois tipos de pickoff.
    const state = buildFlatMatchState();
    const todosOsMates = ROLES.filter((r) => r !== "adc").map(
      (r) => state.user.players[r]
    );
    const killer = state.user.players.adc;
    for (const eventType of ["gank", "solo_kill"] as const) {
      for (let tamanho = 3; tamanho <= todosOsMates.length; tamanho++) {
        const mates = todosOsMates.slice(0, tamanho);
        for (let n = 1; n <= 4; n++) {
          const assistants = assignAssists(killer.card.id, mates, n, {
            eventType,
          });
          expect(assistants.length).toBeLessThanOrEqual(3);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// describe: assistWeight (AST-01, Fase 24)
//
// A exclusao por limiar virou penalizacao de peso. O limiar continua com o mesmo
// valor: ele passou de criterio de corte para joelho da rampa. Nenhum jogador
// pode terminar com peso zero, porque peso zero e exatamente o defeito que o
// Plano 24-01 mediu (quatro rotas em zero absoluto em 800 partidas).
// ---------------------------------------------------------------------------

/** Tipos de evento com entrada propria em ASSIST_MIN_SCORE. */
const TIPOS_DE_EVENTO = [
  "comeback_fight",
  "gank",
  "dive",
  "solo_kill",
  "kill",
  "first_blood",
] as const;

/**
 * Constroi um jogador de teste com rota, meta.assistBias e metricsBase.assistBias
 * controlados. Fixar metricsBase.assistBias isola o efeito do meta e da rota, que
 * e a mesma tecnica do conjunto CONTROLE-CARRIES do gate do Plano 24-01.
 * metricsBase e congelado em freshPlayerState, entao a copia usa spread.
 */
function jogadorDeAssist(
  role: import("../data/schema").Role,
  metaAssistBias: number,
  metricsAssistBias = 0.5
): import("./matchState").PlayerState {
  const state = buildFlatMatchState();
  const p = state.user.players[role];
  return {
    ...p,
    meta: { ...p.meta, assistBias: metaAssistBias },
    metricsBase: { ...p.metricsBase, assistBias: metricsAssistBias },
  };
}

describe("assistWeight (AST-01)", () => {
  it("nenhuma rota cruzada com nenhum tipo de evento produz peso zero ou negativo", () => {
    const violacoes: string[] = [];
    // Bias 0,50 e o valor real de darius, leblanc e vayne: o pior caso medido.
    for (const role of ROLES) {
      for (const eventType of TIPOS_DE_EVENTO) {
        for (const bias of [0.4, 0.5, 0.7, 1.0, 1.8, 2.0]) {
          const p = jogadorDeAssist(role, bias);
          const w = assistWeight(p, { eventType });
          if (!(w > 0)) {
            violacoes.push(`${role}/${eventType}/bias=${bias} => peso ${w}`);
          }
        }
      }
    }
    expect(
      violacoes,
      `AST-01: peso nulo ou negativo em ${violacoes.length} combinacoes: ${violacoes.join(", ")}`
    ).toEqual([]);
  });

  it("no joelho ou acima dele a funcao e identidade sobre o score", () => {
    // Suporte com meta.assistBias 2,0 (o valor de ROLE_DEFAULTS.support) fica
    // sempre acima do maior limiar da tabela (0,80).
    for (const eventType of TIPOS_DE_EVENTO) {
      const p = jogadorDeAssist("support", 2.0);
      const score = assistScore(p, { eventType });
      const limiar = ASSIST_MIN_SCORE[eventType] ?? 0.7;
      expect(score).toBeGreaterThanOrEqual(limiar);
      expect(assistWeight(p, { eventType })).toBeCloseTo(score, 10);
    }
  });

  it("abaixo do joelho o peso e estritamente menor que o score e estritamente maior que zero", () => {
    // ADC com meta.assistBias 0,50 (vayne): score cai para cerca de 0,375,
    // abaixo de qualquer entrada da tabela de limiares.
    for (const eventType of TIPOS_DE_EVENTO) {
      const p = jogadorDeAssist("adc", 0.5);
      const score = assistScore(p, { eventType });
      const limiar = ASSIST_MIN_SCORE[eventType] ?? 0.7;
      expect(score).toBeLessThan(limiar);
      const w = assistWeight(p, { eventType });
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThan(score);
      expect(w).toBeGreaterThanOrEqual(ASSIST_WEIGHT_FLOOR);
    }
  });

  it("e monotona nao decrescente no score para a mesma rota e o mesmo tipo de evento", () => {
    const grade = [0.4, 0.5, 0.7, 0.9, 1.1, 1.4, 1.8, 2.0];
    for (const eventType of TIPOS_DE_EVENTO) {
      const pesos = grade.map((b) => assistWeight(jogadorDeAssist("mid", b), { eventType }));
      for (let i = 1; i < pesos.length; i++) {
        expect(
          pesos[i],
          `monotonicidade quebrada em ${eventType}: bias ${grade[i - 1]} => ${pesos[i - 1]}, bias ${grade[i]} => ${pesos[i]}`
        ).toBeGreaterThanOrEqual(pesos[i - 1]);
      }
    }
  });

  it("ADC com meta.assistBias 0,50 tem peso positivo e o suporte com 1,80 tem peso maior", () => {
    const adc = jogadorDeAssist("adc", 0.5);      // vayne
    const sup = jogadorDeAssist("support", 1.8);  // thresh
    const pesoAdc = assistWeight(adc, BASE_CTX);
    const pesoSup = assistWeight(sup, BASE_CTX);
    expect(pesoAdc, "AST-01: o ADC nao pode ter peso zero").toBeGreaterThan(0);
    expect(pesoSup, "penalizar nao pode virar igualar: o suporte segue mais provavel").toBeGreaterThan(pesoAdc);
  });

  it("e pura: mesma entrada, mesma saida, e nao recebe gerador", () => {
    const p = jogadorDeAssist("jungle", 0.7);
    const a = assistWeight(p, BASE_CTX);
    const b = assistWeight(p, BASE_CTX);
    expect(a).toBe(b);
    // Aridade: dois parametros, nenhum deles um gerador (INV-1)
    expect(assistWeight.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// describe: elegibilidade estrutural (AST-01)
//
// Prova por ENUMERACAO, nao por medicao. A permutacao Fisher-Yates que a engine
// paga em src/sim/engine.ts:1236-1239 e a unica fonte de aleatoriedade que
// assignAssists consome (indiretamente, via permutationUniform). Enumerar todas
// as permutacoes de uma lista pequena cobre entao TODO o espaco de saida da
// funcao para aquela lista: se um jogador nao aparecer em nenhuma delas, ele e
// estruturalmente inelegivel, que e exatamente o defeito da Fase 24.
//
// Uma banda de media aceitaria "quase nunca recebe assistencia" como aprovado;
// este teste nao aceita.
// ---------------------------------------------------------------------------

/** Enumeracao recursiva de TODAS as permutacoes (exaustiva, nao amostral). */
function todasAsPermutacoes<T>(lista: T[]): T[][] {
  if (lista.length <= 1) return [lista.slice()];
  const saida: T[][] = [];
  for (let i = 0; i < lista.length; i++) {
    const resto = lista.slice(0, i).concat(lista.slice(i + 1));
    for (const sub of todasAsPermutacoes(resto)) saida.push([lista[i], ...sub]);
  }
  return saida;
}

/** Conta, por rota, em quantas permutacoes o jogador daquela rota foi escolhido. */
function contarPorRota(
  companheiros: import("./matchState").PlayerState[],
  nAssists: number,
  ctx: typeof BASE_CTX
): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const p of companheiros) contagem[p.role] = 0;
  for (const perm of todasAsPermutacoes(companheiros)) {
    for (const escolhido of assignAssists("killer-id", perm, nAssists, ctx)) {
      contagem[escolhido.role] += 1;
    }
  }
  return contagem;
}

describe("elegibilidade estrutural (AST-01)", () => {
  // Valores reais de championMeta.ts: darius 0,50 / leblanc 0,50 / vayne 0,50 e
  // thresh 1,80. Sao os mesmos do conjunto CONTROLE-CARRIES do gate 24-01, onde
  // as quatro rotas de carry marcaram zero absoluto em 800 partidas.
  const BIAS_CARRY = 0.5;
  const BIAS_SUPORTE = 1.8;

  it("todas as permutacoes de quatro companheiros alcancam os quatro jogadores", () => {
    const companheiros = [
      jogadorDeAssist("jungle", BIAS_CARRY),
      jogadorDeAssist("mid", BIAS_CARRY),
      jogadorDeAssist("adc", BIAS_CARRY),
      jogadorDeAssist("support", BIAS_SUPORTE),
    ];
    const permutacoes = todasAsPermutacoes(companheiros);
    expect(permutacoes.length).toBe(24); // 4! exaustivo

    const contagem = contarPorRota(companheiros, 2, BASE_CTX);
    const alcancados = Object.keys(contagem).filter((r) => contagem[r] > 0);

    // 1) ninguem e estruturalmente inelegivel
    expect(
      alcancados.length,
      `AST-01: apenas ${alcancados.length} de ${companheiros.length} companheiros sao alcancaveis. Contagem por rota: ${JSON.stringify(contagem)}`
    ).toBe(companheiros.length);

    // 2) o ADC, nomeado, com a contagem impressa na mensagem de falha
    expect(
      contagem.adc,
      `AST-01: o ADC foi selecionado em ${contagem.adc} das ${permutacoes.length} permutacoes. Zero significa exclusao estrutural, que e o defeito da Fase 24. Contagem por rota: ${JSON.stringify(contagem)}`
    ).toBeGreaterThan(0);

    // 3) penalizar nao virou igualar
    expect(
      contagem.support,
      `AST-01: o peso deixou de mandar na probabilidade. Suporte ${contagem.support} contra ADC ${contagem.adc}`
    ).toBeGreaterThanOrEqual(contagem.adc);
  });

  it("todas as permutacoes das cinco rotas alcancam as cinco rotas", () => {
    const companheiros = [
      jogadorDeAssist("top", BIAS_CARRY),
      jogadorDeAssist("jungle", BIAS_CARRY),
      jogadorDeAssist("mid", BIAS_CARRY),
      jogadorDeAssist("adc", BIAS_CARRY),
      jogadorDeAssist("support", BIAS_SUPORTE),
    ];
    expect(todasAsPermutacoes(companheiros).length).toBe(120); // 5! exaustivo

    const contagem = contarPorRota(companheiros, 2, BASE_CTX);
    const zeradas = Object.keys(contagem).filter((r) => contagem[r] === 0);
    expect(
      zeradas,
      `AST-01: rotas estruturalmente excluidas: ${zeradas.join(", ")}. Contagem por rota: ${JSON.stringify(contagem)}`
    ).toEqual([]);
    expect(contagem.support).toBeGreaterThanOrEqual(contagem.adc);
  });

  it("com pesos todos iguais a selecao nao privilegia nenhum jogador", () => {
    // Mesma rota e mesmo bias em todos: os pesos ficam identicos bit a bit, entao
    // o unico criterio restante e a posicao na permutacao.
    const base = jogadorDeAssist("mid", 1.0);
    const companheiros = [0, 1, 2, 3].map((k) => ({
      ...base,
      card: { ...base.card, id: `igual-${k}` },
    }));

    const pesos = companheiros.map((p) => assistWeight(p, BASE_CTX));
    for (const w of pesos) expect(w).toBe(pesos[0]);

    const contagem: Record<string, number> = {};
    for (const p of companheiros) contagem[p.card.id] = 0;
    for (const perm of todasAsPermutacoes(companheiros)) {
      for (const escolhido of assignAssists("killer-id", perm, 2, BASE_CTX)) {
        contagem[escolhido.card.id] += 1;
      }
    }

    const valores = Object.values(contagem);
    expect(
      valores.filter((v) => v > 0).length,
      `cobertura incompleta com pesos iguais: ${JSON.stringify(contagem)}`
    ).toBe(companheiros.length);
    for (const v of valores) {
      expect(v, `distribuicao desigual com pesos iguais: ${JSON.stringify(contagem)}`).toBe(valores[0]);
    }
  });

  it("nunca devolve mais que o teto do evento nem mais que o tamanho da lista", () => {
    const companheiros = [
      jogadorDeAssist("jungle", BIAS_CARRY),
      jogadorDeAssist("mid", BIAS_CARRY),
      jogadorDeAssist("adc", BIAS_CARRY),
      jogadorDeAssist("support", BIAS_SUPORTE),
    ];
    for (const eventType of TIPOS_DE_EVENTO) {
      const teto = ASSIST_COUNT_BY_EVENT[eventType] ?? 2;
      for (let n = 1; n <= 6; n++) {
        for (let tamanho = 1; tamanho <= companheiros.length; tamanho++) {
          const lista = companheiros.slice(0, tamanho);
          const saida = assignAssists("killer-id", lista, n, { eventType });
          expect(saida.length).toBeLessThanOrEqual(Math.min(teto, tamanho, n));
        }
      }
    }
  });

  it("assignAssists nao move um contador instrumentado de gerador (INV-1/AST-03)", () => {
    const companheiros = [
      jogadorDeAssist("jungle", BIAS_CARRY),
      jogadorDeAssist("mid", BIAS_CARRY),
      jogadorDeAssist("adc", BIAS_CARRY),
      jogadorDeAssist("support", BIAS_SUPORTE),
    ];
    let draws = 0;
    const original = Math.random;
    Math.random = () => { draws++; return original(); };
    try {
      for (const perm of todasAsPermutacoes(companheiros)) {
        assignAssists("killer-id", perm, 2, BASE_CTX);
      }
    } finally {
      Math.random = original;
    }
    expect(draws, "assignAssists consumiu aleatoriedade: INV-1 violado").toBe(0);
    // Aridade da assinatura publica: quatro parametros, nenhum deles um gerador
    expect(assignAssists.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// describe: permutationUniform (AST-03)
// ---------------------------------------------------------------------------

describe("permutationUniform (AST-03)", () => {
  it("devolve (posicao + 1) / (tamanho + 1), crescente e dentro de (0,1)", () => {
    for (const size of [1, 2, 4, 5, 9]) {
      let anterior = 0;
      for (let i = 0; i < size; i++) {
        const u = permutationUniform(i, size);
        expect(u).toBeCloseTo((i + 1) / (size + 1), 12);
        expect(u).toBeGreaterThan(0);
        expect(u).toBeLessThan(1);
        expect(u).toBeGreaterThan(anterior);
        anterior = u;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// describe: soft caps (KDA-04)
//
// softCapDamp modifica o peso PRE-DRAW: damp linear de 1.0 (em hiSoft) ate
// DAMP_FLOOR (em hiHard+). NUNCA retorna 0 (D-01). Relaxation D-02 por archetype.
// INV-2: em flat (K/D/A baixos, goldLead=0) o damp e no-op.
// ---------------------------------------------------------------------------

describe("soft caps (KDA-04)", () => {
  // Contexto flat: sem stomp, sem fiesta, sem jogo longo
  const FLAT_CTX = {
    eventType: "kill" as const,
    minute: 20,
    state: {} as import("./matchState").MatchState,
    goldLead: 0,
    teamDeaths: 0,
    lowHpTargets: false,
    gameSec: 1200,
  };

  // Contexto fiesta: muitas mortes (teamDeaths > 8)
  const FIESTA_CTX = {
    ...FLAT_CTX,
    teamDeaths: 10,
    goldLead: 0,
    gameSec: 1200,
  };

  // Contexto stomp: lead de ouro alto (goldLead > 1500)
  const STOMP_CTX = {
    ...FLAT_CTX,
    goldLead: 2000,
    gameSec: 1200,
  };

  function makePlayer(
    role: import("../data/schema").Role,
    cls: import("./championMeta").ChampionClass,
    kills: number,
    deaths = 0,
    assists = 0,
  ): import("./matchState").PlayerState {
    const state = buildFlatMatchState();
    const p = state.user.players[role];
    return {
      ...p,
      kills,
      deaths,
      assists,
      meta: { ...p.meta, primaryClass: cls },
    };
  }

  it("(a) jogador acima da banda recebe peso amortecido vs jogador na banda (mesmo role/archetype)", () => {
    // mid assassin: hiSoft kills = 10, hiHard = 16
    const pNaBanda     = makePlayer("mid", "assassin", 8);   // abaixo de hiSoft=10
    const pAcimaDbanda = makePlayer("mid", "assassin", 14);  // acima de hiSoft
    const raw = 1.0;
    const dampedNa     = softCapDamp(raw, pNaBanda, "kills", FLAT_CTX);
    const dampedAcima  = softCapDamp(raw, pAcimaDbanda, "kills", FLAT_CTX);
    // Quem esta na banda nao sofre damp (no-op); quem esta acima recebe damp
    expect(dampedNa).toBeCloseTo(raw, 10);
    expect(dampedAcima).toBeLessThan(raw);
  });

  it("(b) top tank com kills altos fica perto de DAMP_FLOOR * 0.80 mesmo em stomp", () => {
    // top tank: hiSoft kills=4, hiHard=8; relaxation conservador = 0.80
    const pTankAlto = makePlayer("top", "tank", 12); // muito acima de hiHard=8
    const raw = 1.0;
    // damp = DAMP_FLOOR=0.15, archBonus=0.80 (tank conservador) => resultado = 0.15 * 0.80 = 0.12
    const damped = softCapDamp(raw, pTankAlto, "kills", STOMP_CTX);
    // Deve ser muito proximo de DAMP_FLOOR * 0.80 = 0.12 (quase impossivel)
    expect(damped).toBeLessThanOrEqual(DAMP_FLOOR * 0.80 + 0.01);
    expect(damped).toBeGreaterThan(0); // D-01: nunca zero
  });

  it("(c) assassin em fiesta (teamDeaths > 8) recebe relaxation > 1.0 vs assassin em jogo neutro", () => {
    // mid assassin: hiSoft=10, hiHard=16; kills=12 => acima da banda
    const pAssassin = makePlayer("mid", "assassin", 13);
    const raw = 1.0;
    const dampFlat   = softCapDamp(raw, pAssassin, "kills", FLAT_CTX);   // relaxation=1.0
    const dampFiesta = softCapDamp(raw, pAssassin, "kills", FIESTA_CTX); // relaxation=1.60
    // Em fiesta o damp e menor (banda afrouxa) => peso maior
    expect(dampFiesta).toBeGreaterThan(dampFlat);
  });

  it("(d) INV-2: em fixture flat (K/D/A baixos, goldLead=0) softCapDamp e no-op", () => {
    // Jogador com kills=2 (bem abaixo de qualquer hiSoft) em qualquer role/archetype
    const pTop    = makePlayer("top",     "tank",    2, 1, 5);
    const pJungle = makePlayer("jungle",  "fighter", 3, 2, 4);
    const pMid    = makePlayer("mid",     "mage",    4, 1, 3);
    const pAdc    = makePlayer("adc",     "marksman",3, 1, 4);
    const pSup    = makePlayer("support", "enchanter",1, 2, 8);
    const raw = 1.0;
    // Em flat: K/D/A abaixo de qualquer hiSoft => damp e no-op (retorna raw)
    expect(softCapDamp(raw, pTop,    "kills",   FLAT_CTX)).toBeCloseTo(raw, 10);
    expect(softCapDamp(raw, pJungle, "kills",   FLAT_CTX)).toBeCloseTo(raw, 10);
    expect(softCapDamp(raw, pMid,    "deaths",  FLAT_CTX)).toBeCloseTo(raw, 10);
    expect(softCapDamp(raw, pAdc,    "kills",   FLAT_CTX)).toBeCloseTo(raw, 10);
    expect(softCapDamp(raw, pSup,    "assists", FLAT_CTX)).toBeCloseTo(raw, 10);
  });

  it("softCapDamp nunca retorna 0 para rawWeight > 0 (DAMP_FLOOR > 0, D-01)", () => {
    // Testar o caso mais extremo: top tank com 50 kills (completamente absurdo)
    const pTank = makePlayer("top", "tank", 50);
    const damped = softCapDamp(1.0, pTank, "kills", FLAT_CTX);
    expect(damped).toBeGreaterThan(0);
    expect(DAMP_FLOOR).toBeGreaterThan(0);
  });

  it("softCapDamp(raw, p, 'kills', ctx) == raw quando p.kills <= hiSoft", () => {
    // support enchanter: hiSoft kills=2; kills=1 => abaixo
    const pSup = makePlayer("support", "enchanter", 1);
    const raw = 0.75;
    expect(softCapDamp(raw, pSup, "kills", FLAT_CTX)).toBeCloseTo(raw, 10);
  });
});

// ---------------------------------------------------------------------------
// describe: arity preservation (KDA-05)
//
// Gate explicito: selectVictim + selectKiller consomem EXATAMENTE 2 draws.
// assignAssists nao consome nenhum draw adicional (contador nao muda).
//
// Nota: o gate end-to-end completo (n+3 draws por morte) sera reverificado
// no Plan 05 contra engine.ts apos o wiring completo.
// ---------------------------------------------------------------------------

describe("arity preservation (KDA-05)", () => {
  it("draw count pos-migracao == draw count pre-migracao na mesma seed", () => {
    const state = buildFlatMatchState();
    const victimCandidates = ROLES.map((r) => state.rival.players[r]);
    const killerCandidates = ROLES.map((r) => state.user.players[r]);
    const mates = ROLES.filter((r) => r !== "adc").map(
      (r) => state.user.players[r]
    );
    const killer = state.user.players.adc;

    // Instrumentar um rng contador: envolve mulberry32 e conta cada draw
    let drawCount = 0;
    const baseSeed = mulberry32(999);
    const countingRng = () => {
      drawCount++;
      return baseSeed();
    };

    // selectVictim: 1 draw (arity identica a livingTarget)
    const victim = selectVictim(victimCandidates, BASE_CTX, countingRng);
    const drawsAfterVictim = drawCount;
    expect(drawsAfterVictim).toBe(1);

    // selectKiller: 1 draw (arity identica a pickActor)
    selectKiller(killerCandidates, BASE_CTX, countingRng);
    const drawsAfterKiller = drawCount;
    expect(drawsAfterKiller).toBe(2);

    // assignAssists: 0 draws adicionais (re-rank deterministico, sem rng)
    if (victim !== null) {
      const _ = assignAssists(killer.card.id, mates, 2, BASE_CTX);
    }
    const drawsAfterAssists = drawCount;
    // O contador nao muda apos assignAssists, arity preservada
    expect(drawsAfterAssists).toBe(2);
  });
});
