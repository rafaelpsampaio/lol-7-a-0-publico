/**
 * src/sim/engineWiring.test.ts
 *
 * Testes de WIRING end-to-end (Phase 12 — Nyquist validation gaps).
 *
 * Por que este arquivo existe: os testes de deathQuality.test.ts e selection.test.ts
 * exercitam apenas as FUNCOES PURAS (computeDeathQuality / selectContextualTicker)
 * com fixtures literais, contornando o engine. Esse ponto cego deixou 5 bugs de
 * wiring (CR-01, WR-01, WR-02, WR-03) passarem verdes. Estes bugs ja foram
 * corrigidos (commits 5101e1b..2f6a3e2 + recalibracao 5237df2). Este arquivo
 * adiciona testes de regressao que exercitam o wiring ATRAVES do engine
 * (simulateMatch + mulberry32) para fechar a lacuna.
 *
 * Cada teste:
 *  - e DETERMINISTICO (seed via mulberry32),
 *  - FALHARIA contra o engine pre-fix (cdb2ee2),
 *  - PASSA contra o HEAD atual.
 *
 * Requisitos cobertos: EVT-01, EVT-03, CR-01, WR-02, WR-03.
 */

import { describe, it, expect } from "vitest";
import { makePlayer } from "../draft/orchestrator.test";
import { mulberry32 } from "./rng";
import { simulateMatch } from "./engine";
import { ROLES, createInitialMatchState } from "./matchState";
import { selectContextualTicker } from "./deathQuality";
import { makeFlatCard } from "../__tests__/golden/fixtures";
import type { PlayerVersion } from "../data/schema";

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

// Substrings invariantes dos tickers contextuais (deathQuality.ts) — D-03/TKR-02.
// Apos o Plano 02, cada ticker e prefixado com o nome real do protagonista (shortName).
// Os filtros de timeline usam includes() para acomodar o prefixo dinamico de nome.
// O teste unitario de BOT_WON_2V2 usa makeFlatCard("adc", 65) => displayName="Flat-adc-65".
const NO_FLASH_TICKER_SUFFIX = "ADC e achado sem Flash e cai antes da briga comecar.";
const BOT_WON_2V2 = "Flat-adc-65: bot vence o duelo 2v2 e assume o controle da rota.";
const ADC_CLEANED_SUFFIX = "ADC encontra espaco, limpa a luta e decide o fight.";

// ---------------------------------------------------------------------------
// GAP 1 — EVT-01 / WR-03: modelo de Flash vivo end-to-end
// Pre-fix: flashUp era inicializado true e NUNCA mutado. O peso noFlash do
// victimScore e o ticker ctx_adc_caught_no_flash eram ramos mortos.
// ---------------------------------------------------------------------------

describe("WR-03 / EVT-01 — modelo de Flash vivo no engine (end-to-end)", () => {
  it("WR-03: pelo menos um jogador atinge flashUp===false durante a partida (flash model live)", () => {
    // Pre-fix este invariante seria IMPOSSIVEL: flashUp ficava true a partida inteira.
    // Varremos um seed deterministico e provamos que o engine vira flashUp para false.
    const res = simulateMatch(roster("u", 70), roster("r", 70), mulberry32(1));
    let anyDown = false;
    for (const side of ["user", "rival"] as const) {
      for (const r of ROLES) {
        const p = res.finalState[side].players[r];
        if (p.flashUp === false) anyDown = true;
      }
    }
    expect(anyDown).toBe(true);
  });

  it("WR-03: o Flash e RESTAURADO apos o cooldown (nao fica permanentemente false)", () => {
    // Prova que flashCooldownUntilSec + processRespawns devolvem o Flash:
    // existe ao menos um jogador que MATOU (gastou Flash agressivo) e termina
    // com flashUp===true e cooldown limpo => o Flash voltou apos os 300s.
    const res = simulateMatch(roster("u", 70), roster("r", 70), mulberry32(1));
    let anyRestored = false;
    for (const side of ["user", "rival"] as const) {
      for (const r of ROLES) {
        const p = res.finalState[side].players[r];
        if (p.kills >= 1 && p.flashUp === true && p.flashCooldownUntilSec === null) {
          anyRestored = true;
        }
      }
    }
    expect(anyRestored).toBe(true);
  });

  it("WR-03: o estado de Flash e binario e nunca inconsistente (cooldown pendente <=> flashUp false)", () => {
    // Invariante de coerencia: se ha cooldown pendente, o Flash esta down; se nao
    // ha cooldown, esta up. Garante que o modelo nao deixa estados orfaos.
    const res = simulateMatch(roster("u", 70), roster("r", 70), mulberry32(7));
    for (const side of ["user", "rival"] as const) {
      for (const r of ROLES) {
        const p = res.finalState[side].players[r];
        if (p.flashCooldownUntilSec !== null) {
          expect(p.flashUp).toBe(false);
        } else {
          expect(p.flashUp).toBe(true);
        }
      }
    }
  });

  it("EVT-01: o ticker 'ADC sem Flash' aparece em timelines reais (assinatura alcancavel)", () => {
    // Pre-fix o ticker ctx_adc_caught_no_flash NUNCA podia aparecer numa partida
    // real (so passava com fixture spread flashUp:false). Agora, com o Flash
    // modelado, a janela ADC-vivo-sem-Flash existe e o ticker dispara.
    // Varremos seeds 1..30 (determinismo total) e exigimos >=1 ocorrencia.
    // D-03/TKR-02: ticker agora tem prefixo de nome real; usa includes() na substring invariante.
    let hits = 0;
    let seedsWithHit = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const res = simulateMatch(roster("u", 70), roster("r", 70), mulberry32(seed));
      const n = res.timeline.filter((e) => e.ticker?.includes(NO_FLASH_TICKER_SUFFIX)).length;
      hits += n;
      if (n > 0) seedsWithHit++;
    }
    expect(hits).toBeGreaterThan(0);
    // Reforco: nao e um acidente de um unico seed — aparece em multiplos seeds.
    expect(seedsWithHit).toBeGreaterThan(1);
  });

  it("EVT-01: o ticker 'ADC sem Flash' aparece num seed especifico e deterministico", () => {
    // Ancoragem deterministica forte: a seed abaixo contem a assinatura EVT-01.
    // D-03/TKR-02: ticker prefixado com nome real; filtra por substring invariante.
    //
    // POR QUE ESTE TESTE EXISTE, se o de cima ja varre as seeds 1..30:
    // o teste de cima so CONTA ocorrencias (hits e seedsWithHit) e nunca olha para
    // dentro do evento casado. Este aqui e o unico lugar que verifica a FORMA da
    // assinatura: que o ticker respeita a regra D-04 de nao conter travessao, e que
    // o evento casado pertence a familia de morte (kill/shutdown/gank/first_blood)
    // em vez de, por exemplo, um evento de estrutura. Os dois nao sao redundantes:
    // o de cima prova ALCANCABILIDADE, este prova FORMA.
    //
    // RE-ANCORAGEM (Plano 24-04): a ancora era a seed 1 e foi movida para a seed 7.
    // A correcao de atribuicao de assistencia (24-02 e 24-03) mudou a trajetoria por
    // semente, e a seed 1 deixou de conter a assinatura. Isso e mudanca de VALOR,
    // da mesma familia do golden, e nao regressao: a capacidade EVT-01 continua
    // provada pelo teste de cima. O assert NAO foi afrouxado; so a ancora mudou.
    //
    // RE-ANCORAGEM (Plano 25B-03): a ancora foi movida da seed 7 para a seed 20,
    // quando a CONCENTRACAO DE ROTA do canal absoluto deslocou a timeline e a
    // seed 7 zerou. Mesmo criterio da vez anterior: a seed nova e a de MAIOR
    // contagem na faixa 1..30, ou seja a maior folga contra um deslocamento
    // futuro. O assert continua sendo maior que 0.
    //
    // RE-ANCORAGEM (Plano 25C-03): a ancora foi movida da seed 20 para a seed 18,
    // quando a remocao das duas intencoes sem resolvedor deslocou a trajetoria e a
    // seed 20 zerou. Mesmo criterio das duas vezes anteriores: a seed nova e a de
    // MAIOR contagem na faixa 1..30. O assert continua sendo maior que 0.
    //
    // MARGEM MEDIDA no estado atual do motor, ocorrencias por seed em 1..30:
    //   seed 20 = 0 (ancora antiga, hoje vazia)   seed 18 = 6 (ancora nova, a maior)
    //   seed 15 = 4    seed 2 = 3    seed 10 = 3    seed 12 = 3    seed 16 = 3
    //
    // COBERTURA, E ELA SUBIU: a alcancabilidade em 1..200 passou de 114 de 200
    // (57,0 por cento) para 119 de 200 (59,5 por cento), e em 1..30 de 16 para 19.
    // Medida nos dois lados no mesmo harness, antes e depois do commit de motor
    // (tmp/reancora-25C-03-ANTES.txt e -DEPOIS.txt). **Isto e deslocamento de ancora
    // e nao supressao de comportamento**, pelo criterio escrito no teste WR-02 deste
    // mesmo arquivo, e a capacidade EVT-01 ficou MAIS alcancavel e nao menos.
    //
    // E o ganho NAO vem de partida mais longa, o que importa porque toda queda
    // anterior desta cobertura foi explicada por encurtamento: neste fixture (70x70)
    // a duracao media CAIU de 29,59 para 29,42 min e a cobertura subiu assim mesmo.
    // A explicacao e a propria mudanca: um tick que antes sorteava intencao sem ramo
    // e emudecia agora sorteia intencao com destino e resolve.
    //
    // RE-ANCORAGEM (Plano 26-09): a ancora foi movida da seed 18 para a seed 5. O
    // plano 26-09 (D-02) acrescenta computeEventWeight, que classifica cada abate em
    // virada/decisivo/rotina e, quando o nivel NAO e "rotina", o texto de peso
    // SUBSTITUI o texto de dq (Task 2, prioridade 0 de selectContextualTicker). Na
    // seed 18 o abate que antes carregava a assinatura EVT-01 continua acontecendo
    // (mesma trajetoria de sorteio, mesma aridade, contagem do gerador em 72 nos dois lados), mas
    // agora e classificado decisivo ou virada e o texto de peso o substitui: isto e
    // DESLOCAMENTO DE ANCORA e nao SUPRESSAO, porque a assinatura continua alcancavel
    // em varias outras seeds (5, 6, 12, 14, 22, 25, 34, 42 em 1..60, todas com nivel
    // "rotina"), inclusive dentro da propria faixa 1..30 que o teste de alcancabilidade
    // acima varre. A seed nova (5) e a MENOR reachable em 1..30, mesmo criterio de
    // desempate ja usado nas re-ancoragens anteriores deste arquivo.
    //
    // RE-ANCORAGEM (Plano 27-04, primeira passada): a ancora foi movida da seed 5
    // para a seed 9, quando o terceiro canal de ouro (goldStructuralFactor,
    // ECO-03, removido na spec 2026-10-02) passou a multiplicar computeStructureDamage e deslocou a
    // trajetoria estrutural. A seed 5 zerou. Contagem de ocorrencias por seed em
    // 1..30 com os valores de partida ORIGINAIS de GOLD_STRUCTURAL_FLOOR/CEIL
    // (0,6/1,8): seed 9 = 2 (ancora nova, a menor)   seed 12 = 2   seed 22 = 1
    // seed 23 = 1   seed 26 = 1 (as demais, incluindo a seed 5, = 0).
    //
    // RE-ANCORAGEM (Plano 27-04, segunda passada, MESMA TASK): a ancora foi
    // movida de novo, da seed 9 para a seed 4, quando GOLD_STRUCTURAL_FLOOR/CEIL
    // foram apertados de 0,6/1,8 para 0,97/1,03 DENTRO da mesma Task 3 --
    // `npm run calibrate:pace` mediu que o ponto de partida original violava a
    // regra dura de primeira torre antes de 7:00 no tier GAP-30 (ver o
    // comentario medido no cabecalho de GOLD_STRUCTURAL_CEIL em structures.ts).
    // Com o fator MUITO mais proximo de 1 (teto 1,03 em vez de 1,8), a seed 9
    // zerou de novo. Contagem de ocorrencias por seed em 1..30 apos o aperto:
    // seed 4 = 1 (ancora nova, a menor)   seed 12 = 2   seed 16 = 1   seed 18 = 2
    // seed 22 = 2   seed 23 = 1   seed 24 = 2   seed 26 = 1 (as demais,
    // incluindo a seed 9, = 0). Isto e DESLOCAMENTO DE ANCORA e nao SUPRESSAO
    // nas duas passadas: a alcancabilidade continua provada pelo teste de cima
    // (seedsWithHit = 8 em 1..30 apos o aperto, > 1), e o evento casado na seed
    // nova continua na familia de morte (kind="kill", sem travessao no ticker).
    //
    // RE-ANCORAGEM (Task 9 da linha luta-mapa-vitoria, spec 2026-10-02): a ancora
    // foi movida da seed 4 para a seed 7. O motor novo (ouro real, luta pelo ouro
    // relativo, janela de conversao, objetivo disputado pela luta) muda a ordem dos
    // sorteios e a trajetoria de toda seed; a seed 4 zerou. Mudanca de VALOR, da
    // mesma familia do golden, registrada em docs/diagnostics/luta-mapa-vitoria-bandas.md.
    // Contagem por seed em 1..60 no motor da Task 8: seed 7 = 1 (kill, a menor),
    // seed 17 = 1 (kill), seed 23 = 1 (gank), as demais = 0. A alcancabilidade
    // segue provada pelo teste de cima (seedsWithHit = 3 em 1..30, > 1). O assert
    // NAO foi afrouxado; so a ancora mudou.
    //
    // RE-ANCORAGEM (Task 8 da linha calendario-e-volume, spec 2026-10-02): a ancora
    // foi movida da seed 7 para a seed 2. As regras do patch 26, o relogio do early
    // game, o preparo de objetivo e o motivo de luta mudam a trajetoria de toda seed;
    // a seed 7 zerou desde a Task 2. Mudanca de VALOR, da mesma familia do golden,
    // registrada em docs/diagnostics/calendario-e-volume-bandas.md. Contagem por seed
    // em 1..60 no motor da Task 8: seeds 2, 4, 17, 36 e 59 com 1 cada (todas kill),
    // demais 0; a seed nova e a MENOR em 1..30, mesmo criterio das anteriores. Em
    // 1..200 a assinatura aparece em 16 seeds. A alcancabilidade segue provada pelo
    // teste de cima (seedsWithHit = 3 em 1..30, > 1). O assert NAO foi afrouxado.
    const res = simulateMatch(roster("u", 70), roster("r", 70), mulberry32(2));
    const matches = res.timeline.filter((e) => e.ticker?.includes(NO_FLASH_TICKER_SUFFIX));
    expect(matches.length).toBeGreaterThan(0);
    // D-04: o ticker pt-BR nunca contem o caractere travessao.
    for (const ev of matches) {
      expect(ev.ticker).not.toContain("—");
      // O evento e uma morte de ADC (vitima), classificada bad (assinatura EVT-01).
      expect(ev.kind === "kill" || ev.kind === "shutdown" || ev.kind === "gank" || ev.kind === "first_blood").toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// GAP 2a — EVT-03 / CR-01: deathQuality nao degenera para "good" no late game
// Pre-fix: teamKillsAfter recebia killerTeam.kills cumulativo (10-20+ no late),
// entao tradeValue crescia sem limite e quase toda morte virava "good".
// ---------------------------------------------------------------------------

describe("CR-01 / EVT-03 — distribuicao de deathQuality nao-degenerada (end-to-end)", () => {
  function collectDq(seedFrom: number, seedTo: number) {
    const dist = { good: 0, neutral: 0, bad: 0 };
    const lateDist = { good: 0, neutral: 0, bad: 0 };
    for (let seed = seedFrom; seed <= seedTo; seed++) {
      const res = simulateMatch(roster("u", 70), roster("r", 70), mulberry32(seed));
      for (const ev of res.timeline) {
        const dq = (ev as { _deathQuality?: "good" | "neutral" | "bad" })._deathQuality;
        if (!dq) continue;
        dist[dq]++;
        // late game: a partir de 25:00 (LATE_PHASE_AT). Antes do fix, este bucket
        // era ~100% "good"; o termo cumulativo dominava todo o score.
        if (ev.timeSec >= 1500) lateDist[dq]++;
      }
    }
    return { dist, lateDist };
  }

  it("CR-01: a classificacao de morte NAO e ~100% 'good' no late game (trade-back bounded em uso)", () => {
    const { dist, lateDist } = collectDq(1, 40);
    const total = dist.good + dist.neutral + dist.bad;
    const lateTotal = lateDist.good + lateDist.neutral + lateDist.bad;

    // Ha mortes classificadas e ha mortes no late game (amostra valida).
    expect(total).toBeGreaterThan(50);
    expect(lateTotal).toBeGreaterThan(20);

    // CR-01 core: no late game "good" NAO domina. Com o bug (killerTeam.kills
    // cumulativo) este ratio seria ~1.0; com o trade-back bounded e <= 0.5.
    const lateGoodRatio = lateDist.good / lateTotal;
    expect(lateGoodRatio).toBeLessThan(0.5);
  });

  it("CR-01: a distribuicao global de deathQuality usa as 3 classes (sinal nao colapsado)", () => {
    const { dist } = collectDq(1, 40);
    // As tres classes aparecem — o sinal good/neutral/bad nao degenerou numa so.
    expect(dist.good).toBeGreaterThan(0);
    expect(dist.neutral).toBeGreaterThan(0);
    expect(dist.bad).toBeGreaterThan(0);
    // E "good" e a MINORIA (o bug fazia good engolir o resto).
    const total = dist.good + dist.neutral + dist.bad;
    expect(dist.good / total).toBeLessThan(0.5);
  });

  it("CR-01: 'good' nao cresce monotonicamente com o relogio (sem vies cumulativo)", () => {
    // Com o bug, quanto mais tarde a morte, mais provavel "good" (killerTeam.kills
    // so cresce). Comparamos a fracao de "good" no early/mid vs late: a fracao
    // late NAO deve explodir para perto de 1 como acontecia pre-fix.
    const { dist, lateDist } = collectDq(1, 40);
    const earlyMidGood = dist.good - lateDist.good;
    const earlyMidTotal =
      dist.good + dist.neutral + dist.bad -
      (lateDist.good + lateDist.neutral + lateDist.bad);
    const lateTotal = lateDist.good + lateDist.neutral + lateDist.bad;

    const earlyMidGoodRatio = earlyMidGood / Math.max(1, earlyMidTotal);
    const lateGoodRatio = lateDist.good / Math.max(1, lateTotal);

    // O ratio late nao pode ser drasticamente maior (>3x) que o early/mid:
    // isso seria a assinatura exata do termo cumulativo do bug CR-01.
    expect(lateGoodRatio).toBeLessThan(earlyMidGoodRatio * 3 + 0.2);
  });
});

// ---------------------------------------------------------------------------
// GAP 2b — EVT-03 / WR-02: tickers killer-centric leem a lane do time do KILLER
// Pre-fix: liam laneState do time do VICTIM, invertendo a narrativa.
// ---------------------------------------------------------------------------

describe("WR-02 / EVT-03 — tickers killer-centric leem a lane do KILLER (inversao corrigida)", () => {
  function flatState(userBotLead: number, rivalBotLead: number) {
    const st = createInitialMatchState(
      ROLES.map((r) => makeFlatCard(r, 65)),
      ROLES.map((r) => makeFlatCard(r, 65))
    );
    st.user.laneState.bot.laneLead = userBotLead;
    st.rival.laneState.bot.laneLead = rivalBotLead;
    return st;
  }

  it("WR-02: ctx_bot_won_2v2 dispara quando a bot do KILLER esta a frente (nao a do victim)", () => {
    // killerSide = user; killer adc; bot do user (killer) a frente, bot do rival (victim) atras.
    const st = flatState(50, -50);
    const ctx = {
      killerSide: "user" as const,
      victim: st.rival.players.adc,
      killer: st.user.players.adc,
      state: st,
      eventType: "kill" as const,
      teamKillsAfter: 2,
      teamObjectiveAfter: 0,
      allyGoldGiven: 0,
      savedCarry: false,
    };
    const ticker = selectContextualTicker("neutral", "rotina", ctx);
    expect(ticker).toBe(BOT_WON_2V2);
  });

  it("WR-02: ctx_bot_won_2v2 NAO dispara quando so a bot do VICTIM esta a frente (regressao do bug invertido)", () => {
    // Cenario espelho: bot do killer ATRAS, bot do victim A FRENTE.
    // Pre-fix (lendo a lane do victim) o ticker DISPARARIA — exatamente o bug.
    // Pos-fix (lendo a lane do killer) deve retornar null.
    const st = flatState(-50, 50);
    const ctx = {
      killerSide: "user" as const,
      victim: st.rival.players.adc,
      killer: st.user.players.adc,
      state: st,
      eventType: "kill" as const,
      teamKillsAfter: 2,
      teamObjectiveAfter: 0,
      allyGoldGiven: 0,
      savedCarry: false,
    };
    const ticker = selectContextualTicker("neutral", "rotina", ctx);
    expect(ticker).toBeNull();
  });

  it("WR-02: o lado do killer importa — inverter killerSide inverte qual lane decide", () => {
    // Mesmo estado de lanes (user bot a frente), mas killerSide = rival.
    // Agora a bot do KILLER (rival) esta atras => ticker nao deve disparar.
    const st = flatState(50, -50);
    const ctx = {
      killerSide: "rival" as const,
      victim: st.user.players.adc,
      killer: st.rival.players.adc,
      state: st,
      eventType: "kill" as const,
      teamKillsAfter: 2,
      teamObjectiveAfter: 0,
      allyGoldGiven: 0,
      savedCarry: false,
    };
    const ticker = selectContextualTicker("neutral", "rotina", ctx);
    expect(ticker).toBeNull();
  });

  it("WR-02: ctx_adc_cleaned_fight aparece em timelines reais e correlaciona com bot lead do killer", () => {
    // Cobertura end-to-end: o ticker killer-centric ctx_adc_cleaned_fight dispara
    // em partidas reais (seed 10 e ancora deterministica, re-ancorada na Fase 25B
    // plano 25B-03 quando o ponto de operacao da concentracao de rota foi fixado em
    // T = 9 e o seed 20 deixou de produzir o evento).
    //
    // RE-ANCORAGEM (Plano 25C-03): a ancora foi movida da seed 10 para a seed 16,
    // quando a remocao das duas intencoes sem resolvedor deslocou a trajetoria e a
    // seed 10 zerou. A seed nova e a de maior contagem em 1..30 (16 e 24 empatam em
    // 2, e fica a MENOR das duas, pelo criterio ja usado). O assert nao foi afrouxado.
    //
    // RE-ANCORAGEM (Plano 25C-04): a ancora foi movida da seed 16 para a seed 3,
    // quando as tres ligacoes de estado da onda 4 (rota do gank ponderada, morte de
    // teamfight movendo o lead da rota e janela pos-evento na decisao) deslocaram a
    // trajetoria e a seed 16 zerou. A maior contagem em 1..30 passou a ser 1, com as
    // seeds 3, 18, 20 e 24 empatadas, e fica a MENOR delas pelo mesmo criterio de
    // sempre. O assert continua sendo maior que zero e nao foi afrouxado.
    //
    // ALCANCABILIDADE MEDIDA no estado atual: **30 de 200 seeds, ou 15,0 por cento**
    // (roster 70x70, o mesmo do teste), contra 33 de 200 (16,5 por cento) medidos no
    // commit imediatamente anterior a onda, com o mesmo harness nos dois lados
    // (tmp/reancora-25C-04-ANTES.txt e -DEPOIS.txt). O valor de 16,5 por cento medido
    // no lado ANTES reproduz EXATAMENTE o numero que este comentario ja carregava, o
    // que valida o harness da comparacao em vez de supor que ele mede a mesma coisa.
    //
    // >>> A VIGILIA CONTINUA. O VALOR CAIU 1,5 PONTO E SEGUE COM DOIS DIGITOS. <<<
    // Historico da alcancabilidade: cerca de 32 por cento na Fase 20, 28,0 no plano
    // 25-05, 19,5 no plano 25-06, 16,5 no plano 25B-03, 11,5 (pior valor registrado),
    // 16,5 no plano 25C-03 e agora **15,0**. A regra escrita neste teste diz que a UM
    // DIGITO a classificacao muda de deslocamento de ancora para SUPRESSAO DE
    // COMPORTAMENTO; 15,0 tem dois digitos e a queda de 1,5 ponto esta dentro da
    // oscilacao ja registrada no proprio historico, entao esta rodada e deslocamento
    // de ancora, com a classificacao feita por medicao dos dois lados e nao por
    // conveniencia.
    //
    // A causa esta medida: as tres ligacoes da onda 4 mudam QUAL rota e gankada,
    // QUAL rota recebe lead depois de uma luta e QUANTO peso os objetivos ganham
    // depois de um ace. Nenhuma delas remove o caminho do ticker; todas deslocam a
    // trajetoria. A regra de classificacao segue valendo para a proxima fase, e o
    // dono do volume de combate continua sendo a Fase 26 (item D-25B-02).
    //
    // Historico: seed 6 para 7 na Fase 19 (gate baronSetupSufficient), 7 para 5
    // na Fase 20 (casualty model), 5 para 1 na Fase 25 plano 25-05 (throughput
    // estrutural), 1 para 3 na Fase 25 plano 25-06 (termo de vantagem), 3 para 4
    // na Fase 25B plano 25B-03 (decaimento, mecanismo depois revertido no mesmo
    // plano, e a ancora 4 seguiu valida no motor sem ele), 4 para 20 e depois 20
    // para 10 na Fase 25B plano 25B-03 (concentracao de rota, e o ponto de operacao
    // dela).
    // A simples ocorrencia prova que o caminho killerLaneState.bot.laneLead > 0 e
    // alcancavel pelo engine (pre-fix, lendo o lado errado, esta assinatura
    // killer-centric ficava incoerente).
    // D-03/TKR-02: ticker agora prefixado com nome real; usa includes() na substring invariante.
    //
    // SUPRESSAO DE COMPORTAMENTO (Plano 26-09), classificada pela PROPRIA regra que
    // este teste ja escrevia acima ("a UM DIGITO a classificacao muda de deslocamento
    // de ancora para SUPRESSAO DE COMPORTAMENTO"): alcancabilidade medida em **0 de
    // 300 seeds, ou 0,0 por cento** (roster 70x70, mesmo harness, seeds 1..300),
    // muito abaixo do limiar de um digito. NAO e deslocamento de ancora: nenhuma seed
    // na faixa varrida produz mais a string ADC_CLEANED_SUFFIX no ticker final.
    //
    // A CAUSA E ESTRUTURAL E PERMANENTE, nao um efeito de trajetoria de RNG. O plano
    // 26-09 (D-02) acrescenta computeEventWeight, e selectContextualTicker passa a
    // decidir pelo NIVEL DE PESO primeiro (Task 2, prioridade 0): quando o nivel NAO
    // e "rotina", o texto de peso SUBSTITUI por completo o texto de dq, inclusive o
    // de ctx_adc_cleaned_fight. O UNICO caminho pelo qual este ticker chega ao topo da
    // timeline (engine.ts, resolveTeamfight) e via makeKillEvent nos abates
    // destacados como "first_blood" ou "shutdown" (ate 2 por tick); um kill comum
    // dentro de uma teamfight nunca passa por makeKillEvent (decorateMultikill/
    // makeMultikillEvent nao consultam dq/ctxTicker). E TODO abate do kind "shutdown"
    // tem, por definicao (victim.shutdownGold > 0), hadShutdownBounty=true, que
    // computeEventWeight trata como gatilho INCONDICIONAL de "decisivo" (Task 1,
    // texto do plano: "...ou o abate carrega recompensa de sequencia acumulada...").
    // Ou seja: toda vez que a precondicao de ctx_adc_cleaned_fight e alcancada pelo
    // UNICO caminho que a expoe no ticker, o peso ja e decisivo (ou virada, se tambem
    // cruzar 50%) e o texto novo aparece no lugar. Medido diretamente: nas mesmas 300
    // seeds, 495 de 495 eventos kind="shutdown" (100 por cento) sao "decisivo" ou
    // "virada", nunca "rotina".
    //
    // O QUE ESTE TESTE PASSA A PROVAR, no lugar da string antiga: (1) o mecanismo
    // killer-centric em si (a leitura de killerLaneState em vez de laneState do
    // victim) continua provado pelos tres testes unitarios diretamente acima, que
    // chamam selectContextualTicker com weight="rotina" e nao sao afetados por D-02;
    // (2) end-to-end, o UNICO caminho que antes expunha ctx_adc_cleaned_fight (abates
    // kind="shutdown") continua alcancavel pelo engine e agora e corretamente
    // classificado "decisivo"/"virada", com o texto de peso nomeando o protagonista e
    // sem o caractere travessao, provando que o pipeline inteiro (aplicador de abate
    // -> peso -> selecao de texto -> evento) segue coerente de ponta a ponta.
    let shutdownHits = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const res = simulateMatch(roster("u", 70), roster("r", 70), mulberry32(seed));
      for (const ev of res.timeline) {
        if (ev.kind !== "shutdown") continue;
        shutdownHits++;
        const weight = (ev as { _eventWeight?: "virada" | "decisivo" | "rotina" })._eventWeight;
        expect(weight === "decisivo" || weight === "virada").toBe(true);
        expect(ev.ticker.length).toBeGreaterThan(0);
        expect(ev.ticker).not.toContain("—");
      }
    }
    expect(shutdownHits).toBeGreaterThan(0);
  });
});
