/**
 * src/sim/deathQuality.test.ts
 *
 * Cobertura de deathQuality.ts (EVT-01/02/03 — Phase 12):
 *  - computeDeathQuality: engage support morre + time pega >=2 kills => "good" (EVT-03)
 *  - computeDeathQuality: carry com bounty sem troca => "bad" (EVT-03)
 *  - selectContextualTicker: dq=good + engage => ctx_support_engage_decisive (EVT-02)
 *  - selectContextualTicker: flashUp=false + adc bad => ctx_adc_caught_no_flash (EVT-01)
 *  - selectContextualTicker: dq=neutral => retorna null (ticker generico prevalece, D-05)
 *  - Rng-free: todos os testes sao estaticos, sem seed (DET-02)
 *
 * ESTADO NO WAVE 0: RED — deathQuality.ts ainda nao existe.
 * Este arquivo ficara em RED ate o Plano 03 criar o modulo.
 */

import { describe, it, expect } from "vitest";
import {
  computeDeathQuality,
  selectContextualTicker,
  contextualTickerMustIncludePlayerName,
  computeEventWeight,
  DECISIVE_WIN_PROB_DELTA,
  type EventWeightContext,
} from "./deathQuality";
import { makeFlatCard } from "../__tests__/golden/fixtures";
import { ROLES, createInitialMatchState } from "./matchState";
import { simulateMatch } from "./engine";
import { mulberry32 } from "./rng";
import type { PlayerVersion, Role } from "../data/schema";

// ---------------------------------------------------------------------------
// Fixture: MatchState flat para construcao de DeathContext
// ---------------------------------------------------------------------------

function buildFlatMatchState() {
  const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
  const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
  return createInitialMatchState(userRoster, rivalRoster);
}

// ---------------------------------------------------------------------------
// describe: computeDeathQuality
// ---------------------------------------------------------------------------

describe("computeDeathQuality", () => {
  it(
    "engage support que morre e time pega >=2 kills apos => 'good' (EVT-03)",
    () => {
      const state = buildFlatMatchState();
      const victim = state.user.players.support;
      const killer = state.rival.players.jungle;

      // DeathContext com override de engage: teamKillsAfter >= 2 => 'good'
      const ctx = {
        killerSide: "rival" as const,
        victim,
        killer,
        state,
        eventType: "kill" as const,
        teamKillsAfter: 2,
        teamObjectiveAfter: 0,
        allyGoldGiven: 0,
        savedCarry: false,
      };

      const dq = computeDeathQuality(ctx);
      expect(dq).toBe("good");
    }
  );

  it(
    "carry morto entregando bounty sem troca nenhuma => 'bad' (EVT-03)",
    () => {
      const state = buildFlatMatchState();
      // Simular carry com bounty alto: shutdownGold > 0
      const victim = { ...state.user.players.adc, shutdownGold: 300, role: "adc" as const };
      const killer = state.rival.players.jungle;

      // Sem kills apos, sem objetivo, bounty alto — score <= -150 => 'bad'
      const ctx = {
        killerSide: "rival" as const,
        victim,
        killer,
        state,
        eventType: "kill" as const,
        teamKillsAfter: 0,
        teamObjectiveAfter: 0,
        allyGoldGiven: victim.shutdownGold,
        savedCarry: false,
      };

      const dq = computeDeathQuality(ctx);
      expect(dq).toBe("bad");
    }
  );
});

// ---------------------------------------------------------------------------
// describe: selectContextualTicker
// ---------------------------------------------------------------------------

describe("selectContextualTicker", () => {
  it(
    "dq=good + isEngageInitiator(victim) => 'ctx_support_engage_decisive' (EVT-02)",
    () => {
      const state = buildFlatMatchState();
      // Victim e engage support (alistar-like): primaryClass = engage-support
      // Como usamos makeFlatCard (sem champion real), o modulo deathQuality.ts
      // detecta o role support + dq=good + teamKillsAfter>=2 => engage ticker
      const victim = state.user.players.support;
      const killer = state.rival.players.jungle;

      const ctx = {
        killerSide: "rival" as const,
        victim,
        killer,
        state,
        eventType: "kill" as const,
        teamKillsAfter: 2,
        teamObjectiveAfter: 0,
        allyGoldGiven: 0,
        savedCarry: false,
      };

      const ticker = selectContextualTicker("good", "rotina", ctx);
      // Deve retornar o kind contextual ou um ticker pt-BR (nao null, nao com travessao)
      expect(ticker).not.toBeNull();
      if (ticker !== null) {
        // D-04: ticker pt-BR nao pode conter o caractere travessao
        expect(ticker).not.toContain("—");
        expect(ticker.length).toBeGreaterThan(0);
      }
    }
  );

  it(
    "dq=bad + victim.role=adc + flashUp=false => 'ctx_adc_caught_no_flash' (EVT-01)",
    () => {
      const state = buildFlatMatchState();
      // ADC sem flash
      const victim = {
        ...state.rival.players.adc,
        role: "adc" as const,
        flashUp: false,
      };
      const killer = state.user.players.jungle;

      const ctx = {
        killerSide: "user" as const,
        victim,
        killer,
        state,
        eventType: "kill" as const,
        teamKillsAfter: 0,
        teamObjectiveAfter: 0,
        allyGoldGiven: 300,
        savedCarry: false,
      };

      const ticker = selectContextualTicker("bad", "rotina", ctx);
      // EVT-01: ADC sem flash + dq=bad => ticker contextual nao-nulo
      expect(ticker).not.toBeNull();
      if (ticker !== null) {
        // D-04: sem travessao em pt-BR
        expect(ticker).not.toContain("—");
      }
    }
  );

  it("dq=neutral => retorna null — ticker generico prevalece (D-05)", () => {
    const state = buildFlatMatchState();
    const victim = state.user.players.mid;
    const killer = state.rival.players.jungle;

    const ctx = {
      killerSide: "rival" as const,
      victim,
      killer,
      state,
      eventType: "kill" as const,
      teamKillsAfter: 0,
      teamObjectiveAfter: 0,
      allyGoldGiven: 0,
      savedCarry: false,
    };

    const ticker = selectContextualTicker("neutral", "rotina", ctx);
    // D-05: neutral => nenhum ticker contextual; ticker generico assume
    expect(ticker).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// describe: ctx_scaling_survived_early com ouro de time em ouro real
//
// Desde a spec 2026-10-02 o ouro e real e nao ha mais escala. O limiar do ticker
// (goldDelta > -800 da economia de antes) vale -2200 em ouro real (x 2,75). Estes
// testes fixam as duas bordas do limiar.
// ---------------------------------------------------------------------------

describe("ctx_scaling_survived_early: limiar de ouro de time em ouro real", () => {
  function buildScalingCtx(userGold: number, rivalGold: number) {
    const userRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const rivalRoster = ROLES.map((r) => makeFlatCard(r, 65));
    const state = createInitialMatchState(userRoster, rivalRoster);

    const scaledState = {
      ...state,
      gameTimeSec: 500, // < 900 (pre-condicao ESTRITA)
      user: {
        ...state.user,
        gold: userGold,
        compProfile: { ...state.user.compProfile, dominantTags: ["scaling" as const] },
      },
      rival: {
        ...state.rival,
        gold: rivalGold,
      },
    };

    return {
      killerSide: "rival" as const, // victimSide => "user"
      victim: scaledState.user.players.mid,
      killer: scaledState.rival.players.jungle,
      state: scaledState,
      eventType: "kill" as const,
      teamKillsAfter: 0, // < 3 (pre-condicao ESTRITA)
      teamObjectiveAfter: 0,
      allyGoldGiven: 0,
      savedCarry: false,
    };
  }

  it("delta de time -1375 (dentro do limiar -2200) dispara o ticker", () => {
    const ticker = selectContextualTicker("neutral", "rotina", buildScalingCtx(5500, 6875));
    expect(ticker).not.toBeNull();
  });

  it("delta de time -2475 (fora do limiar -2200) NAO dispara o ticker", () => {
    const ticker = selectContextualTicker("neutral", "rotina", buildScalingCtx(4000, 6475));
    expect(ticker).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// describe: nome real em tickers contextuais e fallback null (TKR-02, D-03/D-04)
// ---------------------------------------------------------------------------

describe("selectContextualTicker com nome real (TKR-02)", () => {
  // Constroi um estado flat com displayNames verificaveis para victim e killer
  function buildNamedMatchState() {
    // Cards com nomes reais ("Faker 2016" -> shortName = "Faker")
    const userRoster = ROLES.map((r) => {
      const card = makeFlatCard(r, 65);
      if (r === "support") return { ...card, displayName: "Faker 2016" };
      if (r === "adc") return { ...card, displayName: "Gumayusi 2022" };
      if (r === "top") return { ...card, displayName: "Zeus 2023" };
      if (r === "mid") return { ...card, displayName: "Chovy 2024" };
      return { ...card, displayName: "Oner 2023" };
    });
    const rivalRoster = ROLES.map((r) => {
      const card = makeFlatCard(r, 65);
      if (r === "adc") return { ...card, displayName: "Ruler 2022" };
      if (r === "support") return { ...card, displayName: "Keria 2023" };
      if (r === "top") return { ...card, displayName: "Doran 2021" };
      if (r === "jungle") return { ...card, displayName: "Canyon 2020" };
      return { ...card, displayName: "ShowMaker 2022" };
    });
    return createInitialMatchState(userRoster, rivalRoster);
  }

  it(
    "ctx_support_engage_decisive: ticker contem o nome do SUPORTE (vitima) que fez engage (D-03, D-05)",
    () => {
      const state = buildNamedMatchState();
      // victim = suporte do user com displayName "Faker 2016" -> shortName "Faker"
      const victim = state.user.players.support;
      const killer = state.rival.players.jungle;

      const ctx = {
        killerSide: "rival" as const,
        victim,
        killer,
        state,
        eventType: "kill" as const,
        teamKillsAfter: 2,
        teamObjectiveAfter: 0,
        allyGoldGiven: 0,
        savedCarry: false,
      };

      const ticker = selectContextualTicker("good", "rotina", ctx);
      expect(ticker).not.toBeNull();
      // Protagonista = VITIMA (suporte que engagou) -> nome da vitima presente
      expect(ticker).toContain("Faker");
      // Nao deve conter o travessao
      expect(ticker).not.toContain("—");
    }
  );

  it(
    "ctx_adc_caught_no_flash: ticker contem o nome do ADC (vitima) achado sem flash (D-03)",
    () => {
      const state = buildNamedMatchState();
      // victim = ADC do rival com displayName "Ruler 2022" -> shortName "Ruler"
      const victim = { ...state.rival.players.adc, role: "adc" as const, flashUp: false };
      const killer = state.user.players.jungle;

      const ctx = {
        killerSide: "user" as const,
        victim,
        killer,
        state,
        eventType: "kill" as const,
        teamKillsAfter: 0,
        teamObjectiveAfter: 0,
        allyGoldGiven: 300,
        savedCarry: false,
      };

      const ticker = selectContextualTicker("bad", "rotina", ctx);
      expect(ticker).not.toBeNull();
      // Protagonista = VITIMA (ADC pego) -> nome da vitima presente
      expect(ticker).toContain("Ruler");
      expect(ticker).not.toContain("—");
    }
  );

  it(
    "ctx_top_dive_weakside: ticker contem o nome do TOP (vitima) que tomou dive (D-03)",
    () => {
      const state = buildNamedMatchState();
      // victim = top do user com displayName "Zeus 2023" -> shortName "Zeus"
      const victim = state.user.players.top;
      const killer = state.rival.players.jungle;

      // Ativar weaksideState.active para top da vitima
      const stateWithWeakside = {
        ...state,
        user: {
          ...state.user,
          laneState: {
            ...state.user.laneState,
            top: {
              ...state.user.laneState.top,
              weaksideState: { active: true, startTimeSec: 0 },
            },
          },
        },
      };

      const ctx = {
        killerSide: "rival" as const,
        victim,
        killer,
        state: stateWithWeakside as typeof state,
        eventType: "dive" as const,
        teamKillsAfter: 0,
        teamObjectiveAfter: 0,
        allyGoldGiven: 0,
        savedCarry: false,
      };

      const ticker = selectContextualTicker("neutral", "rotina", ctx);
      expect(ticker).not.toBeNull();
      // Protagonista = VITIMA (top que tomou dive) -> nome da vitima presente
      expect(ticker).toContain("Zeus");
      expect(ticker).not.toContain("—");
    }
  );

  it(
    "ctx_bot_won_2v2: ticker contem o nome do KILLER (ADC ou suporte do bot vencedor) (D-03, D-05)",
    () => {
      const state = buildNamedMatchState();
      // killer = ADC do user com displayName derivado do roster user adc="Gumayusi 2022" -> "Gumayusi"
      const killer = state.user.players.adc;
      const victim = state.rival.players.support;

      // Ativar laneLead positivo no lado do killer (user)
      const stateWithBotLead = {
        ...state,
        user: {
          ...state.user,
          laneState: {
            ...state.user.laneState,
            bot: { ...state.user.laneState.bot, laneLead: 200 },
          },
        },
      };

      const ctx = {
        killerSide: "user" as const,
        victim,
        killer,
        state: stateWithBotLead as typeof state,
        eventType: "kill" as const,
        teamKillsAfter: 0,
        teamObjectiveAfter: 0,
        allyGoldGiven: 0,
        savedCarry: false,
      };

      const ticker = selectContextualTicker("neutral", "rotina", ctx);
      expect(ticker).not.toBeNull();
      // Protagonista = KILLER (ADC do bot que venceu)
      expect(ticker).toContain("Gumayusi");
      expect(ticker).not.toContain("—");
    }
  );

  it(
    "ctx_adc_cleaned_fight: ticker contem o nome do ADC KILLER que limpou a luta (D-03, D-05)",
    () => {
      const state = buildNamedMatchState();
      // killer = ADC do user "Gumayusi 2022" -> "Gumayusi"
      const killer = state.user.players.adc;
      const victim = state.rival.players.top;

      // laneLead positivo no bot do killer (user) e teamKillsAfter >= 2
      const stateWithBotLead = {
        ...state,
        user: {
          ...state.user,
          laneState: {
            ...state.user.laneState,
            bot: { ...state.user.laneState.bot, laneLead: 200 },
          },
        },
      };

      const ctx = {
        killerSide: "user" as const,
        victim,
        killer,
        state: stateWithBotLead as typeof state,
        eventType: "kill" as const,
        teamKillsAfter: 2,
        teamObjectiveAfter: 0,
        allyGoldGiven: 0,
        savedCarry: false,
      };

      const ticker = selectContextualTicker("neutral", "rotina", ctx);
      expect(ticker).not.toBeNull();
      // Protagonista = KILLER (ADC que limpou)
      expect(ticker).toContain("Gumayusi");
      expect(ticker).not.toContain("—");
    }
  );

  it(
    "ctx_support_died_warding: ticker contem o nome do SUPORTE (vitima) pego wardando (D-03)",
    () => {
      const state = buildNamedMatchState();
      // victim = suporte do user "Faker 2016" -> "Faker"
      const victim = state.user.players.support;
      const killer = state.rival.players.jungle;

      // prioScore < 0 no bot do lado da vitima (user)
      const stateWithNegPrio = {
        ...state,
        user: {
          ...state.user,
          laneState: {
            ...state.user.laneState,
            bot: { ...state.user.laneState.bot, prioScore: -10 },
          },
        },
      };

      const ctx = {
        killerSide: "rival" as const,
        victim,
        killer,
        state: stateWithNegPrio as typeof state,
        eventType: "kill" as const,
        teamKillsAfter: 0,
        teamObjectiveAfter: 0,
        allyGoldGiven: 0,
        savedCarry: false,
      };

      // dq=neutral (sem vacilo, sem trade)
      const ticker = selectContextualTicker("neutral", "rotina", ctx);
      expect(ticker).not.toBeNull();
      // Protagonista = VITIMA (suporte pego)
      expect(ticker).toContain("Faker");
      expect(ticker).not.toContain("—");
    }
  );

  it(
    "fallback null (D-04): sem displayName conhecido, contextualTickerMustIncludePlayerName retorna null",
    () => {
      // Card com displayName vazio
      const emptyCard = { displayName: "" };
      const result = contextualTickerMustIncludePlayerName("Suporte encontra o angulo...", emptyCard);
      expect(result).toBeNull();
    }
  );

  it(
    "fallback null via selectContextualTicker (D-04): protagonista sem displayName -> selectContextualTicker retorna null",
    () => {
      const state = buildFlatMatchState();
      // Substituir o card do suporte (vitima) por um com displayName vazio
      const victimWithoutName = {
        ...state.user.players.support,
        card: { ...state.user.players.support.card, displayName: "" },
      };
      const killer = state.rival.players.jungle;

      const ctx = {
        killerSide: "rival" as const,
        victim: victimWithoutName,
        killer,
        state,
        eventType: "kill" as const,
        teamKillsAfter: 2,
        teamObjectiveAfter: 0,
        allyGoldGiven: 0,
        savedCarry: false,
      };

      // dq=good + suporte -> ctx_support_engage_decisive seria disparado,
      // mas sem displayName o gate deve bloquear e retornar null
      const ticker = selectContextualTicker("good", "rotina", ctx);
      expect(ticker).toBeNull();
    }
  );

  it(
    "contextualTickerMustIncludePlayerName retorna o ticker quando displayName presente",
    () => {
      const card = { displayName: "Faker 2016" };
      const result = contextualTickerMustIncludePlayerName("Faker: suporte encontra o angulo.", card);
      expect(result).toBe("Faker: suporte encontra o angulo.");
    }
  );
});

// ---------------------------------------------------------------------------
// describe: computeEventWeight (D-02, Fase 26 plano 26-09)
// ---------------------------------------------------------------------------

function baseWeightCtx(overrides: Partial<EventWeightContext> = {}): EventWeightContext {
  return {
    winProbBeforeUser: 0.5,
    winProbAfterUser: 0.5,
    isFirstBlood: false,
    hadShutdownBounty: false,
    ...overrides,
  };
}

describe("computeEventWeight", () => {
  it("pureza: mesma entrada duas vezes devolve o mesmo nivel e nao altera o objeto recebido", () => {
    const ctx = baseWeightCtx({ winProbBeforeUser: 0.5, winProbAfterUser: 0.52 });
    const snapshot = { ...ctx };

    const first = computeEventWeight(ctx);
    const second = computeEventWeight(ctx);

    expect(first).toBe(second);
    expect(ctx).toEqual(snapshot);
  });

  it("fronteira 'virada': cruza a linha de 50% (subindo) => 'virada'", () => {
    const ctx = baseWeightCtx({ winProbBeforeUser: 0.49, winProbAfterUser: 0.51 });
    expect(computeEventWeight(ctx)).toBe("virada");
  });

  it("fronteira 'virada': cruza a linha de 50% (descendo) => 'virada'", () => {
    const ctx = baseWeightCtx({ winProbBeforeUser: 0.51, winProbAfterUser: 0.49 });
    expect(computeEventWeight(ctx)).toBe("virada");
  });

  it("fronteira exata 'virada': o depois cai exatamente em 0,5 (lado user, sem cruzar) => nao e virada", () => {
    // 0,5 e tratado como favorito 'user' (>= 0,5, mesma convencao de engine.ts:432).
    // Vindo de 0,49 (favorito rival) para 0,5 (favorito user): cruzou.
    const cruzou = baseWeightCtx({ winProbBeforeUser: 0.49, winProbAfterUser: 0.5 });
    expect(computeEventWeight(cruzou)).toBe("virada");

    // Vindo de 0,5 (favorito user) para 0,5 (favorito user, sem delta): nao cruzou.
    const semCruzar = baseWeightCtx({ winProbBeforeUser: 0.5, winProbAfterUser: 0.5 });
    expect(computeEventWeight(semCruzar)).not.toBe("virada");
  });

  it("fronteira 'decisivo': delta absoluto exatamente no limiar DECISIVE_WIN_PROB_DELTA => 'decisivo'", () => {
    // winProbBeforeUser=0 evita o arredondamento binario de somar dois decimais
    // (0,6 + 0,1 nao fecha exato em ponto flutuante): a subtracao de zero preserva
    // DECISIVE_WIN_PROB_DELTA bit a bit, entao o delta medido bate exatamente no
    // limiar, sem ruido de precisao mascarando o teste de fronteira.
    const ctx = baseWeightCtx({
      winProbBeforeUser: 0,
      winProbAfterUser: DECISIVE_WIN_PROB_DELTA,
    });
    expect(computeEventWeight(ctx)).toBe("decisivo");
  });

  it("fronteira 'decisivo': logo abaixo do limiar, sem bounty nem primeiro sangue => 'rotina'", () => {
    const ctx = baseWeightCtx({
      winProbBeforeUser: 0,
      winProbAfterUser: DECISIVE_WIN_PROB_DELTA - 0.001,
    });
    expect(computeEventWeight(ctx)).toBe("rotina");
  });

  it("'decisivo' por bounty de sequencia acumulada, mesmo com delta pequeno e sem cruzar", () => {
    const ctx = baseWeightCtx({
      winProbBeforeUser: 0.6,
      winProbAfterUser: 0.61,
      hadShutdownBounty: true,
    });
    expect(computeEventWeight(ctx)).toBe("decisivo");
  });

  it("'decisivo' por primeiro sangue, mesmo com delta pequeno e sem cruzar", () => {
    const ctx = baseWeightCtx({
      winProbBeforeUser: 0.5,
      winProbAfterUser: 0.51,
      isFirstBlood: true,
    });
    expect(computeEventWeight(ctx)).toBe("decisivo");
  });

  it("fronteira 'rotina': delta pequeno, sem bounty, sem primeiro sangue, sem cruzar => 'rotina'", () => {
    const ctx = baseWeightCtx({ winProbBeforeUser: 0.55, winProbAfterUser: 0.555 });
    expect(computeEventWeight(ctx)).toBe("rotina");
  });

  it("ortogonalidade: uma morte 'good' pode ter qualquer um dos tres pesos (pelo menos duas combinacoes)", () => {
    const state = buildFlatMatchState();
    const victim = state.user.players.support;
    const killer = state.rival.players.jungle;
    const dqCtx = {
      killerSide: "rival" as const,
      victim,
      killer,
      state,
      eventType: "kill" as const,
      teamKillsAfter: 2,
      teamObjectiveAfter: 0,
      allyGoldGiven: 0,
      savedCarry: false,
    };
    const dq = computeDeathQuality(dqCtx);
    expect(dq).toBe("good");

    // Combinacao 1: 'good' + 'rotina' (delta pequeno, sem bounty, sem primeiro sangue, sem cruzar).
    const rotina = computeEventWeight(
      baseWeightCtx({ winProbBeforeUser: 0.55, winProbAfterUser: 0.555 })
    );
    expect(rotina).toBe("rotina");

    // Combinacao 2: 'good' + 'virada' (mesma morte 'good', mas o sinal de probabilidade cruza 50%).
    const virada = computeEventWeight(
      baseWeightCtx({ winProbBeforeUser: 0.49, winProbAfterUser: 0.51 })
    );
    expect(virada).toBe("virada");

    // As duas combinacoes vem da MESMA classificacao dq='good': o peso e ortogonal a ela.
    expect(rotina).not.toBe(virada);
  });
});

// ---------------------------------------------------------------------------
// describe: variantes de texto por nivel de peso (D-02, Fase 26 plano 26-09, Task 2)
// ---------------------------------------------------------------------------

/** Constroi um DeathContext minimo, variando so o role do killer (regra de escolha
 *  dentro do nivel), com displayNames reais nos dois lados. */
function buildWeightVariantCtx(killerRole: Role) {
  const userRoster = ROLES.map((r) => ({ ...makeFlatCard(r, 65), displayName: `User-${r} 2024` }));
  const rivalRoster = ROLES.map((r) => ({ ...makeFlatCard(r, 65), displayName: `Rival-${r} 2024` }));
  const state = createInitialMatchState(userRoster, rivalRoster);
  return {
    killerSide: "user" as const,
    victim: state.rival.players.support,
    killer: state.user.players[killerRole],
    state,
    eventType: "kill" as const,
    teamKillsAfter: 0,
    teamObjectiveAfter: 0,
    allyGoldGiven: 0,
    savedCarry: false,
  };
}

describe("selectContextualTicker por nivel de peso (Task 2)", () => {
  it("nivel 'virada': pelo menos duas variantes distintas aparecem variando o role do abatedor", () => {
    const textos = new Set<string>();
    for (const role of ROLES) {
      const ticker = selectContextualTicker("neutral", "virada", buildWeightVariantCtx(role));
      expect(ticker).not.toBeNull();
      if (ticker) textos.add(ticker);
    }
    expect(textos.size).toBeGreaterThanOrEqual(2);
  });

  it("nivel 'decisivo': pelo menos tres variantes distintas aparecem variando o role do abatedor", () => {
    const textos = new Set<string>();
    for (const role of ROLES) {
      const ticker = selectContextualTicker("neutral", "decisivo", buildWeightVariantCtx(role));
      expect(ticker).not.toBeNull();
      if (ticker) textos.add(ticker);
    }
    expect(textos.size).toBeGreaterThanOrEqual(3);
  });

  it("a escolha dentro do nivel e deterministica: o mesmo role sempre devolve o mesmo texto", () => {
    const a = selectContextualTicker("neutral", "decisivo", buildWeightVariantCtx("adc"));
    const b = selectContextualTicker("neutral", "decisivo", buildWeightVariantCtx("adc"));
    expect(a).toBe(b);
    expect(a).not.toBeNull();
  });

  it("nivel 'rotina' continua pelo caminho ja existente, sem reescrita (o teste antigo de dq=good segue valendo)", () => {
    const state = buildFlatMatchState();
    const victim = state.user.players.support;
    const killer = state.rival.players.jungle;
    const ctx = {
      killerSide: "rival" as const,
      victim,
      killer,
      state,
      eventType: "kill" as const,
      teamKillsAfter: 2,
      teamObjectiveAfter: 0,
      allyGoldGiven: 0,
      savedCarry: false,
    };
    const ticker = selectContextualTicker("good", "rotina", ctx);
    expect(ticker).not.toBeNull();
    // Mesma frase de sempre (ctx_support_engage_decisive), sem reescrita pelo Task 2.
    expect(ticker).toContain("suporte encontra o angulo");
  });

  it("nenhuma variante nova (virada/decisivo) contem o caractere travessao", () => {
    for (const weight of ["virada", "decisivo"] as const) {
      for (const role of ROLES) {
        const ticker = selectContextualTicker("neutral", weight, buildWeightVariantCtx(role));
        expect(ticker).not.toBeNull();
        expect(ticker).not.toContain("—");
      }
    }
  });

  it("invariante de nome (D-04): TODAS as variantes de TODOS os niveis nomeiam o protagonista", () => {
    for (const weight of ["virada", "decisivo", "rotina"] as const) {
      for (const role of ROLES) {
        const ctx = buildWeightVariantCtx(role);
        const ticker = selectContextualTicker("neutral", weight, ctx);
        // "rotina" sem precondicao de estado bate em null (D-05), o que e esperado;
        // quando NAO for null, o nome do killer precisa estar presente.
        if (ticker !== null) {
          const nome = shortNameOf(ctx.killer.card.displayName);
          expect(ticker).toContain(nome);
        }
      }
    }
  });

  it("invariante de nome (D-04): sem displayName do killer, virada/decisivo tambem retornam null", () => {
    const ctx = buildWeightVariantCtx("adc");
    const killerSemNome = { ...ctx.killer, card: { ...ctx.killer.card, displayName: "" } };
    const semNomeCtx = { ...ctx, killer: killerSemNome };

    expect(selectContextualTicker("neutral", "virada", semNomeCtx)).toBeNull();
    expect(selectContextualTicker("neutral", "decisivo", semNomeCtx)).toBeNull();
  });
});

/** Replica local minima de shortName (ticker.ts) para o teste de invariante de nome
 *  acima, evitando importar um segundo simbolo so para strip de ano. */
function shortNameOf(displayName: string): string {
  return displayName.replace(/\s+\d{4}$/, "").trim() || displayName;
}

// ---------------------------------------------------------------------------
// describe: determinismo do ticker por nivel de peso (Task 2)
// ---------------------------------------------------------------------------

function flatRoster(prefix: string, stat: number): PlayerVersion[] {
  return ROLES.map((r) => ({
    id: `${prefix}-${r}`,
    personId: `${prefix}-${r}`,
    displayName: `${prefix}-${r} 2024`,
    year: 2024,
    roles: [r],
    primaryRole: r,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [r]: stat },
    lanePhase: stat,
    midGame: stat,
    lateGame: stat,
    traits: [],
    championPool: Array.from({ length: 8 }, (_, i) => ({ championId: `c${i}`, mastery: 3 as const })),
  }));
}

describe("determinismo do ticker por nivel de peso (Task 2)", () => {
  it("duas execucoes com a mesma semente produzem exatamente os mesmos textos, linha a linha, na timeline inteira", () => {
    const seeds = [1, 5, 12, 40];
    for (const seed of seeds) {
      const runA = simulateMatch(flatRoster("u", 70), flatRoster("r", 70), mulberry32(seed));
      const runB = simulateMatch(flatRoster("u", 70), flatRoster("r", 70), mulberry32(seed));

      expect(runA.timeline.length).toBe(runB.timeline.length);
      for (let i = 0; i < runA.timeline.length; i++) {
        expect(runA.timeline[i].ticker).toBe(runB.timeline[i].ticker);
        const wA = (runA.timeline[i] as { _eventWeight?: string })._eventWeight;
        const wB = (runB.timeline[i] as { _eventWeight?: string })._eventWeight;
        expect(wA).toBe(wB);
      }
    }
  });
});
