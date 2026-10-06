/**
 * scripts/lift.test.ts
 *
 * CALIBRACAO DO ESTIMADOR da matriz de lift (Fase 25C, onda 1, criterio 2 do roadmap).
 * Executar: npx vitest run scripts/lift.test.ts
 *
 * A PERGUNTA QUE ESTE ARQUIVO RESPONDE, e por que ela e criterio e nao detalhe.
 *
 * O lift e a razao entre a probabilidade observada e a probabilidade sob o caso
 * independente. O numerador e um fato da engine; o DENOMINADOR e uma escolha de
 * estimador, e trocar essa escolha TROCA O VEREDITO DA FASE. Tres estimadores
 * plausiveis foram testados na pesquisa da fase contra um corpus onde o lift
 * verdadeiro e 1,000 por construcao, e DOIS DELES ERRAM O SINAL:
 *
 *   PAREADO POR CONTAGEM   cobre 1,000 em 12 de 12 celulas          ADOTADO
 *   CRUZADO simples        devolve ate 1,111 sob independencia      REJEITADO (falso positivo em 4 de 6)
 *   JITTER                 devolve 0,609 a 0,882 sob independencia  REJEITADO (falso negativo em 12 de 12)
 *
 * Uma fase que escolhesse o jitter concluiria que a engine e anti-causal e gastaria
 * ondas consertando o que nao esta quebrado. Por isso os tres estao implementados em
 * scripts/lift.ts e este arquivo PROVA qual e o certo, em vez de um comentario afirmar.
 *
 * POR QUE O JITTER FALHA, e a licao vale para qualquer medicao de tempo nesta engine:
 * A e B vivem em fases de jogo diferentes (gank so tem peso no early, torre cai
 * majoritariamente depois). Espalhar B por mais ou menos quatro janelas arrasta massa
 * de B tardio para dentro das janelas de A precoce, o nulo sobe e o lift desaba. O
 * corpus deste arquivo reproduz essa assimetria DE PROPOSITO: sem ela o jitter passaria.
 *
 * QUANTO O JITTER ERRA NESTE CORPUS, dito com o numero e nao arredondado para o numero
 * da pesquisa. Aqui ele e refutado em 2 das 6 celulas (as duas de W = 180, medindo 0,893
 * e 0,880 com IC inteiramente abaixo de 1,000), e o deficit CRESCE monotonicamente com W
 * em ambas as relacoes de rota. A pesquisa refutou em 12 de 12 porque copiou o perfil
 * temporal EMPIRICO da engine, onde a separacao entre gank e torre e mais dura que a de
 * qualquer perfil analitico razoavel. O teste asserta as duas coisas: que existe celula
 * onde o jitter erra o sinal, e que a ORDEM do erro segue o mecanismo (a amplitude do
 * jitter e quatro vezes a janela, entao janela maior arrasta mais massa). Asserir "erra
 * em todas as celulas" seria asserir uma propriedade do perfil escolhido e nao do
 * estimador, e passaria a depender de calibrar o corpus ate o numero sair.
 *
 * O DESENHO DO CORPUS, e cada ingrediente esta aqui por um motivo:
 *   1. perfil temporal por bins de 60 s DIFERENTE para A e para B, com A concentrado
 *      cedo e B concentrado tarde. E o que derruba o jitter.
 *   2. distribuicao de duracao com dispersao. E o que da sentido a estratificacao por
 *      decil de duracao.
 *   3. distribuicao de rota. E o que da sentido a relacao de MESMA ROTA.
 *   4. multiplicador de taxa por (partida, lado) COMPARTILHADO entre A e B. ESTE E O
 *      CONFUNDIDOR CENTRAL E SEM ELE O TESTE NAO PROVA NADA: partida quente tem mais de
 *      tudo do mesmo lado sem que um puxe o outro, e e exatamente isso que separa o
 *      estimador certo do errado. Com o ingrediente 4 desligado, o cruzado simples
 *      tambem acerta, e a escolha entre os dois ficaria arbitraria.
 *
 * VIES RESIDUAL DECLARADO, E A DIRECAO DELE IMPORTA PARA A BANDA. Sob acoplamento
 * verdadeiro FORTE, o pareado por contagem e CONSERVADOR, porque parte do proprio
 * efeito aparece como contagem e vaza para o denominador. Para um gate que asserta
 * "existe acoplamento", SUBESTIMAR e a direcao certa do erro. E por isso que o piso
 * absoluto do Bloco 2 de docs/diagnostics/25C-ancoragem.md e 1,050 e nao 1,000: o maior
 * vies medido do estimador sob independencia verdadeira e 1,043, e 1,050 e o menor
 * multiplo de 0,005 estritamente acima dele.
 *
 * INVARIANTES DESTE ARQUIVO:
 *   - Nenhuma fonte de aleatoriedade de plataforma. Todo corpus sai de mulberry32 com
 *     semente fixa declarada abaixo. O gerador da plataforma nao e chamado nem citado
 *     neste arquivo, e a ausencia dele e conferida por grep no verify do plano.
 *   - Nenhuma simulacao da engine. O corpus e sintetico e analitico de proposito: o que
 *     esta sob teste e o ESTIMADOR, e um corpus onde a verdade e conhecida por
 *     construcao e a unica forma de medir vies. A validacao do estimador CONTRA A
 *     ENGINE e outra coisa e vive na sonda (scripts/probe-lift.ts), nos tres pares de
 *     controle interno que nao tem caminho mecanico no codigo.
 *   - src/sim/ nao e tocado nem lido, exceto o gerador canonico mulberry32.
 *   - Tempo limite declarado POR TESTE, em linha, e nunca por config: este arquivo entra
 *     na rodada padrao da suite (vitest.config.ts inclui scripts/*.test.ts) e precisa
 *     sobreviver a ela.
 *   - Relatorio e mensagens em pt-BR sem o caractere travessao.
 */

import { describe, it, expect } from "vitest";
import { mulberry32 } from "../src/sim/rng";
import {
  analysePair,
  buildStrata,
  benjaminiHochberg,
  type LiftEvent,
  type LiftMatch,
  type NullRead,
  type PairSpec,
  type Side,
} from "./lift";

// ---------------------------------------------------------------------------
// Parametros do corpus. Cada um declarado com a razao e com o custo.
// ---------------------------------------------------------------------------

/**
 * N sintetico. A escolha e um compromisso declarado entre duas exigencias opostas:
 * grande o bastante para que o IC do bootstrap seja estreito o suficiente para
 * DISCRIMINAR entre um estimador com vies de mais 7 por cento e outro sem vies (com IC
 * de mais ou menos 15 por cento nenhum dos dois seria refutavel), e pequeno o bastante
 * para o arquivo inteiro caber dentro do tempo limite declarado por teste.
 */
const N_SYN = 1500;

/** Tick da engine, em segundos. A janela de acerto e sempre multipla dele. */
const TICK = 15;

/** Largura do bin do perfil temporal, em segundos. Mesma escala da menor janela testada. */
const BIN = 60;

/**
 * Amplitude da heterogeneidade de taxa por (partida, lado), em log. E o ingrediente 4 e
 * o unico que faz o cruzado simples errar. 0,45 e da mesma ordem do 0,30 que a pesquisa
 * calibrou contra a correlacao empirica da engine real, escolhido um pouco maior para
 * que a refutacao do cruzado nao dependa de ruido amostral.
 */
const SIGMA = 0.45;

/** Sementes fixas, declaradas. Nenhuma delas foi escolhida depois de ver resultado. */
const SEED_INDEP = 20250730;
const SEED_ACOPLADO = 20250731;
const SEED_REFLEXIVO = 20250732;

/** Duracao entre 20 e 50 minutos, em passos de um tick. Dispersao de proposito. */
const DUR_MIN_TICKS = 80;
const DUR_TICKS_SPAN = 121;

const LANES3 = ["top", "mid", "bot"] as const;

/**
 * A vive no EARLY e praticamente some depois, no molde de `gank` na engine real, que
 * mede 15,20 por cento das decisoes no early contra 0,00 por cento no mid e no late.
 * Perfil por bin, em eventos por segundo por lado.
 */
const A_ULTIMO_BIN_EARLY = 13;
function taxaA(bin: number): number {
  return bin <= A_ULTIMO_BIN_EARLY ? 0.008 : 0.0002;
}

/**
 * B e concentrado TARDE e a subida e CONVEXA, no molde da queda de torre. As duas
 * propriedades importam por motivos diferentes: a separacao de fase e o que faz o jitter
 * arrastar massa de uma fase para a outra, e a CONVEXIDADE e o que faz o deslocamento
 * simetrico inflar o nulo (a media da taxa numa vizinhanca supera a taxa no centro).
 * Sob um perfil linear o jitter seria cego por sorte, porque suavizacao simetrica de
 * reta devolve a propria reta.
 */
const B_BIN_CHEIO = 30;
function taxaB(bin: number): number {
  const x = Math.min(bin, B_BIN_CHEIO) / B_BIN_CHEIO;
  return 0.0012 + 0.008 * x * x;
}

/** Rota de A e de B: distribuicoes diferentes, nenhuma uniforme, nenhuma degenerada. */
const ROTA_A = [0.30, 0.33, 0.37];
const ROTA_B = [0.35, 0.31, 0.34];

interface CorpusCfg {
  /** Probabilidade de A disparar um B dentro de acoplaW segundos. Ausente = independencia verdadeira. */
  acoplaP?: number;
  acoplaW?: number;
}

function sorteiaRota(rng: () => number, dist: readonly number[]): string {
  let r = rng();
  for (let i = 0; i < 3; i++) {
    r -= dist[i];
    if (r <= 0) return LANES3[i];
  }
  return LANES3[2];
}

/**
 * Gera o corpus. A e B sao processos de Poisson NAO homogeneos e, quando acoplaP e
 * ausente, INDEPENDENTES por construcao: nenhuma linha deste gerador faz um B depender
 * de um A. Logo o lift verdadeiro e exatamente 1,000 e todo desvio medido e VIES DO
 * ESTIMADOR.
 */
function geraCorpus(n: number, seed: number, cfg: CorpusCfg = {}): LiftMatch[] {
  const rng = mulberry32(seed);
  const out: LiftMatch[] = [];
  for (let i = 0; i < n; i++) {
    const dur = TICK * (DUR_MIN_TICKS + Math.floor(rng() * DUR_TICKS_SPAN));
    const evs: LiftEvent[] = [];
    for (const side of ["user", "rival"] as Side[]) {
      // Multiplicador de taxa log-normal por (partida, lado), COMPARTILHADO entre A e B.
      // Box-Muller sobre o mesmo gerador: sem fonte de aleatoriedade de plataforma.
      const z = Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
      const heat = Math.exp(SIGMA * z - (SIGMA * SIGMA) / 2);
      for (let t = TICK; t <= dur; t += TICK) {
        const bin = Math.floor(t / BIN);
        if (rng() < Math.min(0.95, taxaA(bin) * heat * TICK)) {
          const lane = sorteiaRota(rng, ROTA_A);
          evs.push({ t, kind: "A", side, lane });
          if (cfg.acoplaP !== undefined && rng() < cfg.acoplaP) {
            const passos = Math.max(1, Math.round((cfg.acoplaW ?? 60) / TICK));
            const tb = t + TICK * (1 + Math.floor(rng() * passos));
            if (tb <= dur) evs.push({ t: tb, kind: "B", side, lane });
          }
        }
        if (rng() < Math.min(0.95, taxaB(bin) * heat * TICK)) {
          evs.push({ t, kind: "B", side, lane: sorteiaRota(rng, ROTA_B) });
        }
      }
    }
    evs.sort((a, b) => a.t - b.t);
    out.push({ dur, evs });
  }
  return out;
}

/** Corpus reflexivo: A e B sao O MESMO tipo e a rota e UNIFORME, logo independente por construcao. */
function geraCorpusReflexivo(n: number, seed: number): LiftMatch[] {
  const rng = mulberry32(seed);
  const out: LiftMatch[] = [];
  for (let i = 0; i < n; i++) {
    const dur = TICK * (DUR_MIN_TICKS + Math.floor(rng() * DUR_TICKS_SPAN));
    const evs: LiftEvent[] = [];
    for (const side of ["user", "rival"] as Side[]) {
      for (let t = TICK; t <= dur; t += TICK) {
        // Taxa baixa de proposito: a contagem por rota fica perto de 1, e e ai que a
        // auto exclusao (contagem menos 1) faz a maior diferenca. Com contagem alta o
        // erro de nao corrigir seria pequeno e o teste nao separaria nada.
        if (rng() < 0.0018 * TICK) {
          evs.push({ t, kind: "R", side, lane: LANES3[Math.floor(rng() * 3)] });
        }
      }
    }
    evs.sort((a, b) => a.t - b.t);
    out.push({ dur, evs });
  }
  return out;
}

// ---------------------------------------------------------------------------
// A grade de celulas e o cache de medicao
// ---------------------------------------------------------------------------

const PAR_ROTA_QUALQUER: PairSpec = {
  id: "S-any",
  label: "A depois de B, mesmo lado, rota qualquer",
  a: ["A"],
  b: ["B"],
  sideRel: "same",
  laneRel: "any",
  w: 60,
};

const PAR_MESMA_ROTA: PairSpec = { ...PAR_ROTA_QUALQUER, id: "S-lane", laneRel: "same" };

const JANELAS = [60, 120, 180];

interface Celula {
  id: string;
  w: number;
  matched: NullRead;
  cross: NullRead;
  jitter: NullRead;
}

function mede(ms: LiftMatch[], base: PairSpec, w: number): Celula {
  const strata = buildStrata(ms);
  const r = analysePair(ms, strata, { ...base, w });
  return { id: base.id, w, matched: r.matched, cross: r.cross, jitter: r.jitter };
}

let cacheCorpus: LiftMatch[] | null = null;
let cacheIndep: Celula[] | null = null;

/** O corpus independente e gerado uma unica vez e reusado por todos os testes. */
function corpusIndependente(): LiftMatch[] {
  if (cacheCorpus === null) cacheCorpus = geraCorpus(N_SYN, SEED_INDEP);
  return cacheCorpus;
}

/** Mede as seis celulas do corpus independente uma unica vez e reusa. */
function celulasIndependentes(): Celula[] {
  if (cacheIndep === null) {
    const ms = corpusIndependente();
    cacheIndep = [];
    for (const base of [PAR_ROTA_QUALQUER, PAR_MESMA_ROTA]) {
      for (const w of JANELAS) cacheIndep.push(mede(ms, base, w));
    }
  }
  return cacheIndep;
}

const cobre1 = (r: NullRead) => r.lo <= 1 && r.hi >= 1;
const nome = (c: Celula) => `${c.id} W=${c.w}`;

// ---------------------------------------------------------------------------
// Os testes
// ---------------------------------------------------------------------------

describe("calibracao do estimador de lift (Fase 25C, criterio 2)", () => {
  it(
    "o nulo PAREADO POR CONTAGEM cobre 1,000 em todas as celulas de independencia verdadeira",
    () => {
      const cels = celulasIndependentes();
      expect(cels.length).toBe(6);
      for (const c of cels) {
        expect(Number.isFinite(c.matched.lift), `${nome(c)} sem lift finito`).toBe(true);
        expect(cobre1(c.matched), `${nome(c)} IC [${c.matched.lo}; ${c.matched.hi}] nao cobre 1,000`).toBe(true);
        expect(c.matched.lift, `${nome(c)} ponto fora de [0,95; 1,05]`).toBeGreaterThan(0.95);
        expect(c.matched.lift, `${nome(c)} ponto fora de [0,95; 1,05]`).toBeLessThan(1.05);
      }
    },
    120_000,
  );

  it(
    "o nulo CRUZADO SIMPLES produz FALSO POSITIVO sob a mesma independencia verdadeira",
    () => {
      const cels = celulasIndependentes();
      const falsosPositivos = cels.filter((c) => c.cross.lift > 1.05 && c.cross.lo > 1);
      expect(
        falsosPositivos.length,
        `nenhuma celula refutou o cruzado: ${cels.map((c) => `${nome(c)}=${c.cross.lift.toFixed(3)}`).join(", ")}`,
      ).toBeGreaterThanOrEqual(1);
      // O cruzado erra SEMPRE para cima: ele nunca subestima, ele infla o observado.
      for (const c of cels) {
        expect(c.cross.lift, `${nome(c)} cruzado abaixo do pareado`).toBeGreaterThan(c.matched.lift);
      }
    },
    120_000,
  );

  it(
    "o nulo de JITTER produz FALSO NEGATIVO sob a mesma independencia verdadeira",
    () => {
      const cels = celulasIndependentes();
      const falsosNegativos = cels.filter((c) => c.jitter.lift < 0.95 && c.jitter.hi < 1);
      expect(
        falsosNegativos.length,
        `nenhuma celula refutou o jitter: ${cels.map((c) => `${nome(c)}=${c.jitter.lift.toFixed(3)}`).join(", ")}`,
      ).toBeGreaterThanOrEqual(1);

      // O MECANISMO, e nao so o sinal: a amplitude do jitter e quatro vezes a janela,
      // entao janela maior arrasta mais massa de B de uma fase de jogo para a outra e o
      // deficit CRESCE com W. Se essa ordem quebrasse, o que o teste pegou seria ruido.
      for (const base of [PAR_ROTA_QUALQUER, PAR_MESMA_ROTA]) {
        const serie = JANELAS.map((w) => cels.find((c) => c.id === base.id && c.w === w)!);
        for (let i = 1; i < serie.length; i++) {
          expect(
            serie[i].jitter.lift,
            `${nome(serie[i])} deveria ser menor que ${nome(serie[i - 1])}`,
          ).toBeLessThan(serie[i - 1].jitter.lift);
        }
      }
    },
    120_000,
  );

  it(
    "o nulo pareado DETECTA acoplamento verdadeiro em vez de ser cego",
    () => {
      const acoplado = geraCorpus(N_SYN, SEED_ACOPLADO, { acoplaP: 0.3, acoplaW: 60 });
      const cAcoplado = mede(acoplado, PAR_MESMA_ROTA, 60);
      const cIndep = celulasIndependentes().find((c) => c.id === "S-lane" && c.w === 60)!;
      expect(cAcoplado.matched.lift).toBeGreaterThan(cIndep.matched.lift);
      // Conservador nao pode virar cego: com 30 por cento de acoplamento injetado o
      // estimador precisa passar folgado do piso absoluto de instrumento (1,050).
      expect(cAcoplado.matched.lo).toBeGreaterThan(1.05);
    },
    120_000,
  );

  it(
    "a correcao de PAR REFLEXIVO e o que separa 1,000 de menos de 0,6",
    () => {
      const ms = geraCorpusReflexivo(N_SYN, SEED_REFLEXIVO);
      const strata = buildStrata(ms);
      const par: PairSpec = {
        id: "S-self",
        label: "R depois de R na MESMA rota (uniforme, logo independente por construcao)",
        a: ["R"],
        b: ["R"],
        sideRel: "same",
        laneRel: "same",
        w: 180,
      };
      const com = analysePair(ms, strata, par);
      const sem = analysePair(ms, strata, par, { selfExclusion: false });

      expect(cobre1(com.matched), `com correcao: IC [${com.matched.lo}; ${com.matched.hi}]`).toBe(true);
      expect(sem.matched.lift, `sem correcao: ${sem.matched.lift}`).toBeLessThan(0.6);
    },
    120_000,
  );

  it(
    "o bootstrap por CLUSTER e mais largo que o que trata cada ancora como independente",
    () => {
      const ms = corpusIndependente();
      const strata = buildStrata(ms);
      const porPartida = analysePair(ms, strata, PAR_ROTA_QUALQUER);
      const porAncora = analysePair(ms, strata, PAR_ROTA_QUALQUER, { bootstrapUnit: "anchor" });
      const larguraCluster = porPartida.matched.hi - porPartida.matched.lo;
      const larguraAncora = porAncora.matched.hi - porAncora.matched.lo;
      expect(larguraCluster, `cluster ${larguraCluster} contra ancora ${larguraAncora}`).toBeGreaterThan(
        larguraAncora,
      );
    },
    120_000,
  );

  it("Benjamini-Hochberg com q = 0,05 devolve exatamente o conjunto da definicao", () => {
    // Caso 1: corte simples. Limiares (k/m) x q com m = 6: 0,00833 0,01667 0,025 0,0333 0,04167 0,05
    expect(benjaminiHochberg([0.001, 0.008, 0.039, 0.041, 0.042, 0.6], 0.05)).toEqual([
      true, true, false, false, false, false,
    ]);

    // Caso 2: a propriedade de PASSO ACIMA, que e o que distingue BH de um corte por p.
    // Com m = 4 o primeiro 0,02 falha o proprio limiar (0,0125) e mesmo assim e rejeitado,
    // porque existe k maior que passa (0,02 <= 0,025 em k = 2 e <= 0,0375 em k = 3).
    expect(benjaminiHochberg([0.02, 0.02, 0.02, 0.9], 0.05)).toEqual([true, true, true, false]);

    // Caso 3: nada passa.
    expect(benjaminiHochberg([0.2, 0.4, 0.9], 0.05)).toEqual([false, false, false]);

    // Caso 4: lista vazia nao explode.
    expect(benjaminiHochberg([], 0.05)).toEqual([]);

    // Caso 5: a ordem da SAIDA acompanha a ordem da ENTRADA, nunca a ordenada.
    expect(benjaminiHochberg([0.9, 0.001, 0.5, 0.008, 0.7, 0.6], 0.05)).toEqual([
      false, true, false, true, false, false,
    ]);
  });
});
