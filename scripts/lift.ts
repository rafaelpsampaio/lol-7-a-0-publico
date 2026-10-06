/**
 * scripts/lift.ts
 *
 * Biblioteca da MATRIZ DE LIFT: o instrumento de acoplamento temporal entre eventos
 * (Fase 25C, criterios 1 e 2 do roadmap). Modulo puro, sem I/O e sem assercao: ele e
 * consumido por dois clientes com necessidades diferentes, a sonda de observacao
 * (scripts/probe-lift.ts, onda 1) e o gate de ritmo (scripts/calibrate-pace.ts, onda 2).
 *
 * A DEFINICAO INTEIRA esta escrita, com a razao de cada escolha, no Bloco 2 de
 * docs/diagnostics/25C-ancoragem.md, commitado ANTES deste arquivo e antes de qualquer
 * numero novo da fase. O resumo operacional:
 *
 *   ancora  uma ocorrencia de A em t_A que satisfaz o filtro de lado e de rota do par e
 *           satisfaz t_A + W <= dur da propria partida (truncamento simetrico)
 *   acerto  existe pelo menos um B compativel em (t_A, t_A + W]. A janela e ABERTA em
 *           t_A: evento no MESMO tick nao conta, porque a engine emite varios eventos
 *           por tick com o mesmo instante e coemissao no mesmo tick e SIMULTANEIDADE,
 *           nao "um evento puxou o outro". O tick e 15 s.
 *   lift    p_obs dividido por p_nulo. LIFT 1,000 E INDEPENDENCIA EXATA, e essa e a
 *           ancora teorica: este e o unico eixo da milestone que nao precisa de
 *           referencia externa.
 *
 * O ESTIMADOR DO NULO E PARTE DO CRITERIO, NAO DETALHE DE IMPLEMENTACAO. Trocar o nulo
 * troca o veredito da fase. Este arquivo implementa TRES, e a escolha entre eles esta
 * PROVADA POR ASSERCAO em scripts/lift.test.ts contra um corpus onde o lift verdadeiro
 * e 1,000 por construcao:
 *
 *   PAREADO POR CONTAGEM  ADOTADO. Unico que cobre 1,000 sob independencia verdadeira.
 *   CRUZADO SIMPLES       REJEITADO: falso positivo. Existe aqui SO para ser refutado.
 *   JITTER                REJEITADO: falso negativo. Existe aqui SO para ser refutado.
 *
 * NENHUM CONSUMIDOR DE VEREDITO PODE CHAMAR OS DOIS REJEITADOS. Eles saem no relatorio
 * da sonda como coluna de contraste e nunca como fonte de banda.
 *
 * Invariantes nao negociaveis:
 *   - Toda estatistica de base vem de scripts/stats.ts (mean, percentile) e nada e
 *     reimplementado aqui. DEC-04: duas definicoes de percentil no repositorio moveriam
 *     bandas em silencio, que e o mesmo motivo pelo qual INST-06 recusa dependencia
 *     externa de estatistica.
 *   - ZERO dependencia externa. A matriz inteira, incluindo bootstrap por cluster e
 *     Benjamini-Hochberg, cabe sobre stats.ts.
 *   - Este arquivo nao importa NADA de src/sim/ alem de tipos e do gerador canonico
 *     mulberry32. Ele nao conhece a engine, nao chama simulateMatch e nao le nenhum
 *     modulo da camada de decisao: a entrada dele e uma lista de eventos ja normalizada.
 *     O gerador e a unica excecao porque o projeto proibe aleatoriedade de plataforma e
 *     uma segunda definicao de PRNG no repositorio seria pior que o import.
 *   - Nenhuma assercao e nenhum I/O: quem escreve relatorio e a sonda, quem asserta e o
 *     gate. A separacao entre relatorio e gate esta em scripts/README.md secao 4.
 *   - pt-BR sem o caractere travessao.
 */

import { mulberry32 } from "../src/sim/rng";
import { mean, percentile } from "./stats";

// ---------------------------------------------------------------------------
// Tipos da interface publica
// ---------------------------------------------------------------------------

export type Side = "user" | "rival";

/** Evento ja normalizado: instante em segundos, tipo, lado e rota ou regiao. */
export interface LiftEvent {
  t: number;
  kind: string;
  side: Side | null;
  lane: string | null;
}

/** Uma partida: a duracao e a lista de eventos. A biblioteca nunca simula nada. */
export interface LiftMatch {
  dur: number;
  evs: readonly LiftEvent[];
}

export type SideRel = "same" | "opp" | "any";
export type LaneRel = "same" | "any";

/** A especificacao de um par ordenado (A, depois B) dentro de uma janela. */
export interface PairSpec {
  id: string;
  label: string;
  a: readonly string[];
  b: readonly string[];
  sideRel: SideRel;
  laneRel: LaneRel;
  /** Janela W em segundos. O acerto vive em (t_A, t_A + W]. */
  w: number;
  /** Par pre-registrado: reportado SEM correcao de multiplas comparacoes. */
  registered?: boolean;
  /** Par de controle interno: esperado em 1,000 porque nao ha caminho mecanico no codigo. */
  control?: boolean;
}

/** A leitura de um estimador do caso independente. */
export interface NullRead {
  /** Probabilidade media sob o caso independente. */
  pNull: number;
  lift: number;
  /** IC95 por bootstrap. */
  lo: number;
  hi: number;
  /** p bilateral do bootstrap contra a hipotese lift = 1,000. */
  p: number;
  /** Ancoras efetivamente usadas por este estimador (o pareado descarta as sem parceiro). */
  anchors: number;
  /** p_obs no MESMO subconjunto de ancoras que o estimador usou. */
  pObs: number;
}

export interface PairResult {
  pair: PairSpec;
  /** Ancoras que passaram no filtro de lado e rota, ANTES do truncamento. */
  anchorsRaw: number;
  /** Ancoras que sobreviveram ao truncamento simetrico. */
  anchors: number;
  /** p_obs sobre todas as ancoras truncadas. */
  pObs: number;
  /** Partidas distintas que contribuiram com ao menos uma ancora (unidade do bootstrap). */
  clusters: number;
  /** ADOTADO. */
  matched: NullRead;
  /** REJEITADO: falso positivo. Contraste apenas. */
  cross: NullRead;
  /** REJEITADO: falso negativo. Contraste apenas. */
  jitter: NullRead;
}

export interface AnalyseOptions {
  /**
   * Correcao de PAR REFLEXIVO (A e B compartilham tipo). Ligada por padrao e so pode ser
   * desligada pelo TESTE, que a usa para provar a diferenca que ela faz. Ver o bloco de
   * comentario em compatCount abaixo.
   */
  selfExclusion?: boolean;
  /**
   * Unidade do bootstrap. "match" e a definicao da fase; "anchor" existe apenas para o
   * teste provar que tratar cada ancora como independente estreita o IC artificialmente.
   */
  bootstrapUnit?: "match" | "anchor";
  partners?: number;
  strata?: number;
  resamples?: number;
  /** Amplitude do jitter, em multiplos de W. */
  jitterK?: number;
  jitterDraws?: number;
  seed?: number;
}

// ---------------------------------------------------------------------------
// Constantes da definicao. Mudar qualquer uma muda a banda: ver Bloco 2 da ancoragem.
// ---------------------------------------------------------------------------

/** Rotas estruturais. Regiao (river_top e afins) DESQUALIFICA a ancora: lane e uma uniao. */
export const LANES3: ReadonlySet<string> = new Set(["top", "mid", "bot"]);

/** Parceiros por ancora. Reduz a variancia do nulo sem custo perceptivel de tempo. */
export const R_PARTNERS = 24;

/** Decis de duracao. Controla partida longa ter mais de tudo. */
export const N_STRATA = 10;

/** Reamostras do bootstrap. A unidade e a PARTIDA. */
export const B_BOOT = 600;

/** Sorteios de jitter por partida (estimador REJEITADO). */
export const R_JITTER = 24;

/** Amplitude do jitter em multiplos de W (estimador REJEITADO). */
export const JITTER_K = 4;

/** Minimo de parceiros casados por contagem para a ancora contar no estimador pareado. */
const MIN_MATCHED_PARTNERS = 4;

const SEED_BOOT = 20250730;

// ---------------------------------------------------------------------------
// Estratificacao por decil de duracao
// ---------------------------------------------------------------------------

export interface Strata {
  /** Indice do estrato de cada partida. */
  stratumOf: number[];
  /** Indices de partida por estrato. */
  byStratum: number[][];
}

export function buildStrata(ms: readonly LiftMatch[], nStrata = N_STRATA): Strata {
  const ordem = ms.map((_, i) => i).sort((x, y) => ms[x].dur - ms[y].dur);
  const stratumOf = new Array<number>(ms.length).fill(0);
  const porEstrato = Math.max(1, Math.ceil(ms.length / nStrata));
  ordem.forEach((mi, rank) => {
    stratumOf[mi] = Math.min(nStrata - 1, Math.floor(rank / porEstrato));
  });
  const byStratum: number[][] = Array.from({ length: nStrata }, () => []);
  stratumOf.forEach((s, mi) => byStratum[s].push(mi));
  return { stratumOf, byStratum };
}

// ---------------------------------------------------------------------------
// Compatibilidade entre a ancora e um candidato a B
// ---------------------------------------------------------------------------

export function compat(a: LiftEvent, b: LiftEvent, p: PairSpec): boolean {
  if (p.sideRel === "same" && (b.side === null || b.side !== a.side)) return false;
  if (p.sideRel === "opp") {
    if (a.side === null || b.side === null || b.side === a.side) return false;
  }
  if (p.laneRel === "same") {
    if (a.lane === null || b.lane === null) return false;
    if (!LANES3.has(a.lane) || !LANES3.has(b.lane)) return false;
    if (a.lane !== b.lane) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

interface Anchor {
  /** Indice da partida: a unidade de cluster do bootstrap. */
  m: number;
  hit: 0 | 1;
  nJitter: number;
  nCross: number;
  nMatched: number;
}

function quantis(lifts: number[]): { lo: number; hi: number } {
  if (lifts.length === 0) return { lo: NaN, hi: NaN };
  const sorted = [...lifts].sort((x, y) => x - y);
  // percentile de scripts/stats.ts: indice arredondado, nunca interpolado (DEC-04).
  return { lo: percentile(sorted, 2.5), hi: percentile(sorted, 97.5) };
}

/**
 * Bootstrap do lift. A unidade padrao e a PARTIDA e nao a ancora, porque ancoras da
 * mesma partida sao correlacionadas: tratar cada uma como independente estreitaria o IC
 * artificialmente. O teste prova essa diferenca comparando as duas larguras.
 */
function bootstrap(
  anchors: readonly Anchor[],
  pick: (a: Anchor) => number,
  seed: number,
  unit: "match" | "anchor",
  resamples: number,
): { lo: number; hi: number; p: number } {
  const rng = mulberry32(seed);
  const lifts: number[] = [];

  const clusters: Anchor[][] = [];
  if (unit === "match") {
    const porPartida = new Map<number, Anchor[]>();
    for (const an of anchors) {
      const arr = porPartida.get(an.m);
      if (arr === undefined) porPartida.set(an.m, [an]);
      else arr.push(an);
    }
    clusters.push(...porPartida.values());
  } else {
    for (const an of anchors) clusters.push([an]);
  }
  if (clusters.length === 0) return { lo: NaN, hi: NaN, p: NaN };

  for (let b = 0; b < resamples; b++) {
    let acertos = 0;
    let nulo = 0;
    let n = 0;
    for (let c = 0; c < clusters.length; c++) {
      const g = clusters[Math.floor(rng() * clusters.length)];
      for (const an of g) {
        const v = pick(an);
        if (!Number.isFinite(v)) continue;
        acertos += an.hit;
        nulo += v;
        n++;
      }
    }
    if (n === 0 || nulo === 0) continue;
    lifts.push(acertos / nulo);
  }

  const { lo, hi } = quantis(lifts);
  const abaixo = lifts.filter((x) => x <= 1).length / Math.max(1, lifts.length);
  const acima = lifts.filter((x) => x >= 1).length / Math.max(1, lifts.length);
  const p = Math.min(1, Math.max(1 / Math.max(1, lifts.length), 2 * Math.min(abaixo, acima)));
  return { lo, hi, p };
}

const NULL_VAZIO: NullRead = { pNull: NaN, lift: NaN, lo: NaN, hi: NaN, p: NaN, anchors: 0, pObs: NaN };

/**
 * Le um estimador. O p_obs e calculado no MESMO subconjunto de ancoras que o estimador
 * conseguiu avaliar: o pareado descarta ancoras sem parceiro de mesma contagem, e
 * compara-lo com um p_obs de outro subconjunto misturaria duas populacoes.
 */
function readOf(
  anchors: readonly Anchor[],
  pick: (a: Anchor) => number,
  seed: number,
  unit: "match" | "anchor",
  resamples: number,
): NullRead {
  const usaveis = anchors.filter((x) => Number.isFinite(pick(x)));
  if (usaveis.length === 0) return NULL_VAZIO;
  const pNull = mean(usaveis.map(pick));
  const pObs = mean(usaveis.map((x) => x.hit));
  const bs = bootstrap(usaveis, pick, seed, unit, resamples);
  return {
    pNull,
    lift: pNull > 0 ? pObs / pNull : NaN,
    lo: bs.lo,
    hi: bs.hi,
    p: bs.p,
    anchors: usaveis.length,
    pObs,
  };
}

// ---------------------------------------------------------------------------
// O nucleo
// ---------------------------------------------------------------------------

export function analysePair(
  ms: readonly LiftMatch[],
  strata: Strata,
  pair: PairSpec,
  opts: AnalyseOptions = {},
): PairResult {
  const selfExclusion = opts.selfExclusion ?? true;
  const unit = opts.bootstrapUnit ?? "match";
  const nPartners = opts.partners ?? R_PARTNERS;
  const resamples = opts.resamples ?? B_BOOT;
  const jitterK = opts.jitterK ?? JITTER_K;
  const jitterDraws = opts.jitterDraws ?? R_JITTER;
  const seed = opts.seed ?? SEED_BOOT;

  const aSet = new Set(pair.a);
  const bSet = new Set(pair.b);
  const D = jitterK * pair.w;

  /** Eventos B de cada partida, na ordem em que aparecem na timeline. */
  const bOf: LiftEvent[][] = ms.map((m) => m.evs.filter((e) => bSet.has(e.kind)));

  /**
   * ESTIMADOR REJEITADO (JITTER). Desloca cada B por uma uniforme simetrica de amplitude
   * quatro janelas, com reflexao na borda. Existe APENAS para que o teste prove que ele
   * erra o sinal: sob independencia verdadeira ele devolve falso negativo, porque A e B
   * vivem em fases de jogo diferentes e espalhar B arrasta massa de uma fase para a
   * outra. NENHUM CONSUMIDOR DE VEREDITO PODE USA-LO.
   */
  const jitterOf: number[][][] = ms.map((m, mi) => {
    const rng = mulberry32(seed + 1000003 + mi * 7919 + pair.w);
    const draws: number[][] = [];
    for (let r = 0; r < jitterDraws; r++) {
      draws.push(
        bOf[mi].map((e) => {
          let t = e.t + (rng() * 2 - 1) * D;
          for (let g = 0; g < 12; g++) {
            if (t < 0) t = -t;
            else if (t > m.dur) t = 2 * m.dur - t;
            else break;
          }
          return Math.max(0, Math.min(m.dur, t));
        }),
      );
    }
    return draws;
  });

  /**
   * PAR REFLEXIVO (A e B compartilham tipo). Sem correcao o nulo pareado tem vies para
   * BAIXO por auto exclusao: na partida da ancora sobram (contagem menos 1) eventos
   * capazes de cair na janela, porque a propria ancora esta em t_A e a janela e ABERTA
   * ali; no parceiro sobram (contagem). O parceiro correto e o que tem (contagem menos 1).
   *
   * A correcao nao e refinamento: medido na pesquisa, sem ela o par "gank depois de gank
   * na mesma rota", que e independente POR CONSTRUCAO porque a rota do gank e sorteada
   * uniformemente hoje, lia 0,312 em vez de 1,071.
   */
  const isSelfPair = pair.a.some((k) => bSet.has(k));
  const countOffset = isSelfPair && selfExclusion ? 1 : 0;

  /**
   * Contagem de B compativeis com a ancora numa partida. E a CHAVE do pareamento, e por
   * isso e memorizada por assinatura de ancora: a compatibilidade so depende do lado e da
   * rota da ancora, entao cada partida tem no maximo poucas chaves distintas.
   */
  const countCache: Map<string, number>[] = ms.map(() => new Map());
  function compatCount(mi: number, a: LiftEvent): number {
    const key = `${a.side ?? "-"}|${a.lane ?? "-"}`;
    const cached = countCache[mi].get(key);
    if (cached !== undefined) return cached;
    let c = 0;
    for (const e of bOf[mi]) if (compat(a, e, pair)) c++;
    countCache[mi].set(key, c);
    return c;
  }

  const anchors: Anchor[] = [];
  let anchorsRaw = 0;
  const partidasComAncora = new Set<number>();

  for (let mi = 0; mi < ms.length; mi++) {
    const m = ms[mi];
    const bs = bOf[mi];
    for (const a of m.evs) {
      if (!aSet.has(a.kind)) continue;
      if (pair.laneRel === "same" && (a.lane === null || !LANES3.has(a.lane))) continue;
      if (pair.sideRel !== "any" && a.side === null) continue;
      anchorsRaw++;
      // Truncamento simetrico, lado da ancora.
      if (a.t + pair.w > m.dur) continue;
      const lo = a.t;
      const hi = a.t + pair.w;

      // Janela ABERTA em t_A: b.t > lo, nunca >=. Mesmo tick e simultaneidade.
      let hit: 0 | 1 = 0;
      for (let i = 0; i < bs.length; i++) {
        if (bs[i].t > lo && bs[i].t <= hi && compat(a, bs[i], pair)) {
          hit = 1;
          break;
        }
      }

      let jHits = 0;
      for (let r = 0; r < jitterDraws; r++) {
        const tt = jitterOf[mi][r];
        for (let i = 0; i < bs.length; i++) {
          if (tt[i] > lo && tt[i] <= hi && compat(a, bs[i], pair)) {
            jHits++;
            break;
          }
        }
      }

      const pool = strata.byStratum[strata.stratumOf[mi]];
      const start = pool.indexOf(mi);
      const myCount = compatCount(mi, a) - countOffset;

      let takenCross = 0;
      let hitsCross = 0;
      let takenMatched = 0;
      let hitsMatched = 0;
      for (
        let k = 1;
        k <= pool.length && (takenCross < nPartners || takenMatched < nPartners);
        k++
      ) {
        const pj = pool[(start + k) % pool.length];
        // Truncamento simetrico, lado do PARCEIRO: sem isto a ancora teria janela
        // inteira e o parceiro teria janela recortada, e o lift de fim de jogo ficaria
        // deprimido por artefato.
        if (pj === mi || ms[pj].dur < a.t + pair.w) continue;
        const bb = bOf[pj];
        let h = 0;
        for (let i = 0; i < bb.length; i++) {
          if (bb[i].t > lo && bb[i].t <= hi && compat(a, bb[i], pair)) {
            h = 1;
            break;
          }
        }
        if (takenCross < nPartners) {
          takenCross++;
          hitsCross += h;
        }
        if (takenMatched < nPartners && compatCount(pj, a) === myCount) {
          takenMatched++;
          hitsMatched += h;
        }
      }

      partidasComAncora.add(mi);
      anchors.push({
        m: mi,
        hit,
        nJitter: jHits / jitterDraws,
        nCross: takenCross > 0 ? hitsCross / takenCross : NaN,
        nMatched: takenMatched >= MIN_MATCHED_PARTNERS ? hitsMatched / takenMatched : NaN,
      });
    }
  }

  if (anchors.length === 0) {
    return {
      pair,
      anchorsRaw,
      anchors: 0,
      pObs: NaN,
      clusters: 0,
      matched: NULL_VAZIO,
      cross: NULL_VAZIO,
      jitter: NULL_VAZIO,
    };
  }

  return {
    pair,
    anchorsRaw,
    anchors: anchors.length,
    pObs: mean(anchors.map((x) => x.hit)),
    clusters: partidasComAncora.size,
    matched: readOf(anchors, (x) => x.nMatched, seed, unit, resamples),
    cross: readOf(anchors, (x) => x.nCross, seed, unit, resamples),
    jitter: readOf(anchors, (x) => x.nJitter, seed, unit, resamples),
  };
}

// ---------------------------------------------------------------------------
// Multiplas comparacoes
// ---------------------------------------------------------------------------

/**
 * Benjamini-Hochberg, procedimento de PASSO ACIMA, com taxa de falsa descoberta q.
 *
 * Rejeita as hipoteses de posto 1 ate kmax, onde kmax e o MAIOR posto r cujo p ordenado
 * satisfaz p(r) <= (r / m) x q. Rejeitar tudo abaixo de kmax, e nao so os que passam o
 * proprio limiar, e o que distingue BH de um corte por p, e o teste cobre esse caso.
 *
 * Aplicado apenas aos pares EXPLORATORIOS: hipotese pre-registrada nao paga o preco de
 * busca, e por isso os tres pares do criterio 2 saem sem correcao, com os dois valores
 * reportados lado a lado para que ninguem precise deduzir qual regra foi usada.
 *
 * A saida acompanha a ordem da ENTRADA, nunca a ordenada.
 */
export function benjaminiHochberg(ps: readonly number[], q: number): boolean[] {
  const m = ps.length;
  const out = new Array<boolean>(m).fill(false);
  if (m === 0) return out;
  const ordem = ps.map((_, i) => i).sort((a, b) => ps[a] - ps[b]);
  let kmax = -1;
  ordem.forEach((i, r) => {
    if (ps[i] <= ((r + 1) / m) * q) kmax = r;
  });
  for (let r = 0; r <= kmax; r++) out[ordem[r]] = true;
  return out;
}

// ---------------------------------------------------------------------------
// A DEFINICAO DOS CONTROLES INTERNOS, congelada aqui e consumida pelos DOIS clientes
// ---------------------------------------------------------------------------

/**
 * Conjunto de tipos de QUEDA DE TORRE. E o B dos tres pares pre-registrados e dos dois
 * controles de objetivo. Vive aqui, e nao em cada cliente, porque a sonda e o gate tem
 * de medir a MESMA coisa: uma segunda copia divergiria em silencio.
 */
export const TORRE: readonly string[] = ["tower_destroyed", "first_tower"];

/** Objetivo epico. E o B do par P3. */
export const EPICO: readonly string[] = ["baron_taken", "elder_taken", "dragon_taken"];

/**
 * LUTA GANHA: A DEFINICAO CONGELADA DE P3, e ela foi congelada DEPOIS de o residuo ser
 * medido, nunca antes. Procedencia: plano 25C-02, Task 1. Relatorio: tmp/proxy-residuo.txt.
 * Registro no documento de ancoragem: Bloco 4.
 *
 * O PROXY NAO TEM FALSO POSITIVO: so `resolveTeamfight` emite estes seis tipos. Ele TEM
 * falso negativo, e o Task 1 mediu o tamanho dele com marcador transitorio no resolvedor,
 * removido no mesmo Task com restauracao provada por hash de blob dos cinco arquivos.
 *
 * A COBERTURA MEDIDA, por LUTA e nunca por evento (o proxy marca uma OCORRENCIA de luta
 * ganha, e uma luta emite varios eventos; contar por evento responderia outra pergunta):
 *
 *   lutas por partida no resolvedor de teamfight       8,126
 *   lutas que o proxy CAPTURA                          4,716
 *   lutas que o proxy PERDE                            3,410
 *   FRACAO DE COBERTURA                               0,5804
 *
 * O DESVIO DE LIFT MEDIDO, em W = 60 s, N = 800, tier EQUILIBRADO:
 *
 *   P3 sob o PROXY                       1,307  [1,216; 1,400]
 *   P3 sob a definicao COMPLETA          1,212  [1,154; 1,278]
 *   desvio                               mais 0,095, o proxy le PARA CIMA
 *
 * O criterio de decisao, escrito ANTES da medicao, mandava trocar a definicao quando o
 * desvio passasse de 0,05, DESDE QUE a definicao completa fosse reproduzivel sem
 * instrumentacao. Duas candidatas sobre a linha do tempo publica foram declaradas antes de
 * medidas e as duas foram REFUTADAS nos dois criterios: "tick com dois ou mais abates" ve
 * so 1,269 lutas por partida e "essa regra unida com os tipos do proxy" ve 4,963, contra
 * 8,126 verdadeiras. A causa e estrutural: a luta TIPICA desta engine emite UM abate so
 * (8,150 abates do resolvedor em 8,126 lutas), e um abate solitario num tick e
 * indistinguivel de um pickoff pela linha do tempo. Logo, pela regra, O PROXY FICA e o
 * desvio vira INCERTEZA DECLARADA.
 *
 * A DIRECAO DO VIES ESTA IDENTIFICADA E NAO E ACIDENTE: o proxy so ve a luta que produziu
 * multikill ou ace, ou seja a luta DECISIVA, que e justamente a que converte em objetivo.
 * Ele e uma amostra enviesada PARA CIMA das lutas ganhas. O piso RELATIVO nao sofre em
 * primeira ordem porque PRE e POS usam o mesmo proxy e um vies estavel se cancela na
 * razao; o piso ABSOLUTO sofre na direcao permissiva, com folga medida de 0,162 hoje.
 * Quando R2 acha uma luta, ela acerta o lado vencedor em 100,0 por cento dos casos: o
 * residuo e problema de RECALL e nunca de precisao.
 */
export const LUTA_GANHA: readonly string[] = [
  "ace",
  "double_kill",
  "triple_kill",
  "quadra_kill",
  "penta_kill",
  "comeback_fight",
];

/** Fracao de cobertura do proxy, medida no Task 1 do plano 25C-02. Ver o bloco acima. */
export const COBERTURA_PROXY_LUTA_GANHA = 0.5804;

/** Desvio de lift entre o proxy e a definicao completa, medido no mesmo Task. */
export const DESVIO_LIFT_PROXY_LUTA_GANHA = 0.095;

/**
 * OS TRES PARES PRE-REGISTRADOS do criterio 2 do roadmap, construidos na janela pedida.
 * A definicao vive aqui e nao em cada cliente porque a sonda de observacao e o gate de
 * ritmo TEM de medir exatamente a mesma coisa: uma segunda copia divergiria em silencio,
 * e a leitura PRE congelada deixaria de ser comparavel com a POS que a julga.
 *
 * Quais a fase MOVE e quais ela PRESERVA esta no Bloco 2.5 da ancoragem: P1 e P3 sao
 * movidos (piso relativo 1,15), P2 e preservado (piso de preservacao 0,95). Os tres pagam
 * o piso absoluto de instrumento, 1,050.
 */
export function paresPreRegistrados(w: number): PairSpec[] {
  return [
    {
      id: "P1",
      label: "gank, depois queda de torre NA MESMA ROTA (mesmo lado)",
      a: ["gank"],
      b: TORRE,
      sideRel: "same",
      laneRel: "same",
      w,
      registered: true,
    },
    {
      id: "P2",
      label: "baron_taken, depois queda de torre (mesmo lado, rota qualquer)",
      a: ["baron_taken"],
      b: TORRE,
      sideRel: "same",
      laneRel: "any",
      w,
      registered: true,
    },
    {
      id: "P3",
      label: "luta ganha, depois objetivo epico (mesmo lado)",
      a: LUTA_GANHA,
      b: EPICO,
      sideRel: "same",
      laneRel: "any",
      w,
      registered: true,
    },
  ];
}

/**
 * O CONTROLE C1 ORIGINAL FOI REFUTADO POR MEDICAO NA ONDA 2, E ISTO E O CONSERTO.
 *
 * O QUE A ONDA 1 MEDIU: o controle `dragon_taken` depois de queda de torre leu 1,086 com
 * IC95 [1,004; 1,176] em W = 60 s e N = 800, quando um controle tem de ler 1,000. O IC
 * excluia 1,000 por 0,004, e a onda 1 deixou o alerta aberto com tres leituras possiveis.
 *
 * AS TRES LEITURAS FORAM SEPARADAS POR MEDICAO, e o registro completo esta no Bloco 2.12
 * de docs/diagnostics/25C-ancoragem.md, com o relatorio bruto em tmp/c1-diagnostico.txt:
 *
 *   (a) VIES DO ESTIMADOR EM JANELA CURTA   REFUTADA. Varrendo W em 30, 60, 90, 120 e
 *       180 s sobre corpus sintetico de lift verdadeiro 1,000 por construcao, o maior
 *       vies em W = 60 s e 1,010, e no perfil temporal DE DRAGAO (mid e late, que e o
 *       de C1) ele fica ABAIXO de 1,000, em 0,972 e 0,973. O vies NAO cresce quando a
 *       janela encurta: o maior de toda a varredura e 1,043 e ele esta em W = 30 s, que
 *       e o mesmo 1,043 ja registrado. O PISO ABSOLUTO DE 1,050 FICA CONFIRMADO.
 *   (b) CAMINHO MECANICO NAO MAPEADO        CONFIRMADA. E esta a explicacao.
 *   (c) RUIDO AMOSTRAL                      REFUTADA. Com N maior o IC NAO passa a
 *       cobrir 1,000: em N = 2000 le 1,068 [1,018; 1,112] e em N = 4000 le 1,046
 *       [1,016; 1,078]. Ele aperta em torno de 1,05, nao converge para 1,000.
 *
 * O CAMINHO QUE O MAPEAMENTO NAO PEGOU, e ele e uma linha de codigo:
 * `resolveContestedObjective` (engine.ts:775) chama `resolveTeamfight` ANTES de tomar o
 * objetivo. Essa luta mata jogadores, e `aliveCount` do inimigo alimenta duas coisas na
 * camada estrutural: `shouldPushStructure` devolve true direto quando o inimigo fica com
 * dois ou menos vivos (structures.ts:156), e `numbersAdvantage` MULTIPLICA o dano
 * estrutural em 1 mais 0,15 por aliado extra vivo (structures.ts:885-889 e :412).
 * A afirmacao da onda 1 de que dragao nao entra em `force`, nem em peso de pressao, nem
 * em `bestPressureLane` continua VERDADEIRA: ela e apenas INCOMPLETA, porque o caminho
 * nao passa pelo termo de forca, passa pela luta que acompanha o dragao contestado.
 *
 * (Existe um segundo caminho, mais fraco e nao isolado aqui: `bumpMomentum` no caminho de
 * objetivo (engine.ts:784 e :800) entra em `computeWinProbability` junto com `dragonDiff`
 * (winprob.ts:79 e :86), e `chooseIntent` le a probabilidade de vitoria de volta para
 * derivar `behind` e `ahead` (engine.ts:477-480). Ele afeta TODOS os pares desta fase e
 * nao so os de dragao.)
 *
 * A MEDICAO QUE ISOLA O CAMINHO, e ela sai da linha do tempo PUBLICA, sem instrumentacao:
 *
 *   corte                          ancoras    lift              IC95        N
 *   dragon_taken (agregado)           3501   1,086   [1,004; 1,176]        800
 *   dragao COM luta (contestado)      1090   1,311   [1,161; 1,474]        800
 *   dragao SEM contestacao            2411   0,973   [0,881; 1,059]        800
 *   dragao COM luta (contestado)      5918   1,219   [1,161; 1,270]       4000
 *   dragao SEM contestacao           13440   0,959   [0,929; 0,992]       4000
 *
 * O acoplamento esta INTEIRAMENTE no subconjunto contestado. O agregado de 1,086 e a
 * mistura de 1,311 em 31 por cento das ancoras com 0,973 nas outras 69.
 *
 * O CONTROLE SUBSTITUTO E O SUBCONJUNTO SEM CONTESTACAO, e a escolha nao e de conveniencia:
 * ele e o MESMO par com o unico caminho mecanico conhecido removido POR CONSTRUCAO, e por
 * isso a diferenca entre os dois subconjuntos E o tamanho do caminho, medida e auditavel.
 * Trocar por um par de outra familia esconderia o achado; este o deixa impresso.
 *
 * O RESIDUO DELE ESTA DECLARADO E NAO ESCONDIDO: em N = 4000 o subconjunto sem contestacao
 * le 0,959 com IC [0,929; 0,992], que exclui 1,000 por BAIXO. Isso e coerente com o vies
 * proprio do estimador medido em (a) para o perfil temporal de dragao (0,972 e 0,973 em
 * W = 60 s), e a direcao e a CONSERVADORA: para um gate que asserta "existe acoplamento",
 * subestimar e o lado certo do erro. No N do gate (800) o IC cobre 1,000 com folga.
 */
export const TICKER_DRAGAO_SEM_CONTESTACAO = "sem contesta";

/** Tipo derivado do dragao tomado SEM contestacao. E o controle interno C1 desde a onda 2. */
export const DRAGAO_SOLO = "dragon_solo";

/** Tipo derivado do dragao tomado COM luta. Observado, nunca controle: tem caminho mecanico. */
export const DRAGAO_LUTA = "dragon_luta";

/**
 * Classifica um `dragon_taken` em SEM CONTESTACAO ou COM LUTA a partir do ticker.
 *
 * A leitura sai do ticker porque os dois ramos emitem textos diferentes e nenhum outro
 * campo publico distingue os dois: `resolveUncontestedObjective` produz "garantiu ... sem
 * contestacao" (engine.ts:1636) e `resolveContestedObjective` produz "venceu a luta e
 * garantiu" (engine.ts:1634). Ler ticker e fragil por natureza, e por isso o cliente e
 * OBRIGADO a conferir a identidade `solo + luta = total` a cada rodada: se o texto mudar
 * numa onda futura, uma das duas classes vai a zero e a identidade quebra ALTO, em vez de
 * o controle passar a medir outra coisa em silencio.
 */
export function classificaDragao(ticker: string): typeof DRAGAO_SOLO | typeof DRAGAO_LUTA {
  return ticker.includes(TICKER_DRAGAO_SEM_CONTESTACAO) ? DRAGAO_SOLO : DRAGAO_LUTA;
}

/**
 * Os pares de CONTROLE INTERNO, construidos na janela pedida. Sao a validacao mais forte
 * do instrumento disponivel sem dado externo: onde nao ha caminho mecanico no codigo, o
 * estimador tem de ler 1,000.
 *
 * C2 e C3 sobreviveram a onda 2 sem alteracao (leram 1,130 [0,774; 1,532] e
 * 1,103 [0,896; 1,313], os dois cobrindo 1,000). C1 foi trocado pelo subconjunto sem
 * contestacao, pelo motivo medido no bloco de comentario acima.
 */
export function paresDeControle(w: number): PairSpec[] {
  return [
    {
      id: "C1",
      label:
        "CONTROLE dragao tomado SEM CONTESTACAO, depois queda de torre (o subconjunto com luta " +
        "tem caminho mecanico e foi separado na onda 2: ver o bloco de C1 em scripts/lift.ts)",
      a: [DRAGAO_SOLO],
      b: TORRE,
      sideRel: "same",
      laneRel: "any",
      w,
      control: true,
    },
    {
      id: "C2",
      label: "CONTROLE voidgrubs_taken, depois queda de torre (peso 0,04 por unidade em force, quase nada)",
      a: ["voidgrubs_taken"],
      b: TORRE,
      sideRel: "same",
      laneRel: "any",
      w,
      control: true,
    },
    {
      id: "C3",
      label: "CONTROLE gank, depois gank NA MESMA ROTA (rota uniforme hoje: independente POR CONSTRUCAO)",
      a: ["gank"],
      b: ["gank"],
      sideRel: "same",
      laneRel: "same",
      w,
      control: true,
    },
  ];
}

/**
 * O par OBSERVADO que carrega o achado da onda 2: o mesmo dragao, restrito ao subconjunto
 * CONTESTADO. Ele NAO e controle e nunca vira banda. Ele existe no relatorio para que o
 * caminho mecanico medido fique visivel ao lado do controle, em vez de virar nota de
 * rodape que alguem teria de redescobrir.
 */
export function parDragaoContestado(w: number): PairSpec {
  return {
    id: "C1x",
    label: "OBSERVADO dragao tomado COM LUTA, depois queda de torre (TEM caminho mecanico: aliveCount)",
    a: [DRAGAO_LUTA],
    b: TORRE,
    sideRel: "same",
    laneRel: "any",
    w,
  };
}

// ---------------------------------------------------------------------------
// Formatacao do relatorio
// ---------------------------------------------------------------------------

/** Numero com tres casas por padrao, e "n/a" quando nao ha leitura. Nunca lanca. */
export function fmt(x: number, d = 3): string {
  return Number.isFinite(x) ? x.toFixed(d) : "n/a";
}
