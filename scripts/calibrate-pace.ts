/**
 * scripts/calibrate-pace.ts
 *
 * Harness de calibracao de ritmo: o gate de dois lados da milestone v2.2
 * (Fase 23 / INST-03 + INST-05 + INST-08).
 * Executar: npx vitest run -c vitest.calibrate-pace.config.ts
 * (o script npm calibrate:pace entra no Plano 23-06)
 * Relatorio: tmp/calibration-pace.txt
 *
 * Este gate nasce vermelho de proposito (DEC-02). A engine ainda nao foi corrigida
 * pelas Fases 24-29: a partida media de hoje dura ~51 minutos com ~88 abates,
 * torres/min fica em ~0,19 contra a banda 0,30-0,45, ouro/min fica em ~700 contra
 * a banda 1.500-2.100. Um calibrate:pace verde nesta fase significaria bandas
 * frouxas o bastante para acomodar essa engine, exatamente o modo de falha da v2.0.
 * Cada banda carrega a fase dona do conserto (campo owner de Band, scripts/bands.ts)
 * -- um vermelho aqui e uma lista de trabalho, nao ruido.
 *
 * TRES EIXOS DE GATE, e o terceiro nasce na Fase 25C (onda 2).
 * Ate a Fase 25 este arquivo so tinha bandas de NIVEL (media, mediana, taxa). A Fase 25
 * fechou seis bandas de nivel e COLAPSOU quatro distribuicoes, e o colapso so apareceu
 * porque alguem pediu para olhar: nada no projeto obrigava a olhar (D-25-07). Restam
 * cinco fases que vao apertar nivel cinco vezes. Por isso o arquivo passou a ter tambem
 * bandas de DISPERSAO (coeficiente de variacao ancorado no motor pre-Fase-25) e de
 * FORMA (fracoes de desfecho e coeficiente de bimodalidade das distribuicoes de torres).
 * Apertar media colapsando distribuicao passa por sucesso no primeiro eixo e reprova
 * no segundo, que e exatamente para isso que o segundo existe.
 *
 * O TERCEIRO EIXO E O ACOPLAMENTO, e ele responde a uma pergunta que os outros dois nao
 * conseguem formular. Nivel diz QUANTO acontece; dispersao e forma dizem COMO isso se
 * distribui; nenhum dos dois enxerga se **um evento puxa o outro**. Uma engine pode ter
 * torres por minuto na banda, distribuicao saudavel e forma correta, e ainda assim emitir
 * cada evento de forma independente do anterior, que e o defeito que abriu a Fase 25C
 * (D-25-08: "luta que sai do nada, objetivo tomado sem setup, abate que nao leva a nada").
 * As tres bandas de acoplamento medem RAZAO DE LIFT contra a ancoragem teorica exata de
 * 1,000, e sao as unicas deste arquivo que nao dependem de referencia externa nenhuma.
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = i por partida, nunca seed compartilhada
 *   - Sem Math.random: apenas mulberry32(seed)
 *   - So metrica RAIZ (taxa) vira banda: torres/min, abates/min, ouro/min e as
 *     razoes/timings que compoem a forma. Metrica derivada (duracao, % no cap de
 *     60min, baroes, Alma, Elder, abates totais, torres totais) e observada no
 *     relatorio, nunca gateada aqui -- Principio de escopo, REQUIREMENTS.md
 *   - goldFightMult/goldSecureMult sao consumidas por import de ../src/sim/power,
 *     nunca reimplementadas; src/sim/ nunca e modificado por este harness
 *   - Relatorio escrito ANTES de qualquer assercao: a rodada vermelha ainda
 *     produz relatorio completo (T-23-12)
 *   - Banda sem fonte externa citavel nasce marcada provisional:true, com a fase
 *     dona anotada responsavel por recalibrar com dado real; e divida tecnica
 *     declarada, nunca numero medido em silencio
 *   - Assert de comparacao de um lado so (so piso ou so teto) proibido neste
 *     arquivo: toda banda passa por checkBand (scripts/bands.ts)
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES, LANES } from "../src/sim/matchState";
import { goldFightMult, goldSecureMult } from "../src/sim/power";
import {
  mean,
  stdev,
  percentile,
  summarize,
  shareWhere,
  bimodalityCoefficient,
  BC_UNIMODAL_THRESHOLD,
} from "./stats";
import { checkBand, expectBands, formatBandTable, type Band, type BandResult } from "./bands";
import {
  analysePair,
  buildStrata,
  classificaDragao,
  fmt,
  paresDeControle,
  paresPreRegistrados,
  parDragaoContestado,
  DRAGAO_SOLO,
  type LiftEvent,
  type LiftMatch,
  type PairResult,
  type Side as LiftSide,
} from "./lift";
import type { PlayerVersion, Role } from "../src/data/schema";
import type { SimulationResult } from "../src/sim/engine";
import type { MatchState, TeamState, PlayerState, Side } from "../src/sim/matchState";
import type { EventKind, SimEvent } from "../src/sim/simEvents";

// ---------------------------------------------------------------------------
// Configuracao
// ---------------------------------------------------------------------------

/** Numero de partidas por tier. Mesmo N de calibrate-micro.ts/calibrate-structures.ts
 *  para o mesmo tipo de comparacao de distribuicao (Pitfall 5 do 23-RESEARCH.md). */
const N = 800;

/** Subamostra da saturacao de multiplicador de ouro (INST-08): so o tier EQUILIBRADO,
 *  so as primeiras CLAMP_SUBSAMPLE_GAMES partidas -- reconstruir estado por evento e
 *  por lado nas 4.800 partidas do gate inteiro seria caro demais. */
const CLAMP_SUBSAMPLE_GAMES = 200;

// ---------------------------------------------------------------------------
// Bandas aposentadas na Task 9 da linha luta-mapa-vitoria
//
// Spec docs/superpowers/specs/2026-10-02-luta-mapa-vitoria-design.md, secao
// "Testes": cada banda antiga que conflita com a regua nova e atualizada para a
// referencia real ou aposentada, com registro. As linhas abaixo sao bandas de
// engenharia ou provisorias (ancoradas no motor pre-Fase-25, nos criterios de
// forma da Fase 25B, na leitura PRE da Fase 25C ou na curva de rating da Fase
// 28), vermelhas no motor novo: medem o modelo antigo. A excecao de motivo e a
// win-rate com gap de forca 30 (ruling do controlador na revisao da Task 9): a
// decisao do dono do produto "favorito claro vence ~75-85%, nunca 100%" vale para
// favorito de liga (gap de elenco real, ate ~10 pontos), e 90 x 60 e um gap
// sintetico fora dela; ja era 1,000 em 1e55c7b, e a decisao segue guardada pelo
// teto 0,85 de "favorito com gap >= 5 vence" em npm run calibrate:realism. Cada
// uma tem linha com valor antes (merge base 1e55c7b) e depois em
// docs/diagnostics/luta-mapa-vitoria-bandas.md.
//
// Elas continuam calculadas e impressas no relatorio, marcadas como APOSENTADA,
// mas saem do assert. Casamento por prefixo do rotulo, porque o rotulo das
// bandas de dispersao carrega o CV medido.
// ---------------------------------------------------------------------------
const BANDAS_APOSENTADAS_TASK9: readonly string[] = [
  "win-rate com gap de forca 30",
  "DISPERSAO ouro final do vencedor:",
  "DISPERSAO ouro por minuto por time:",
  "DISPERSAO fracao de partidas classificadas como comeback",
  "FORMA fracao de partidas com o vencedor no maximo do contador",
  "FORMA fracao de vitorias com exatamente UMA rota limpa",
  "FORMA fracao de shutout",
  "FORMA coeficiente de bimodalidade da distribuicao das torres do PERDEDOR",
  "ACOPLAMENTO P1 gank, depois queda de torre",
  "ACOPLAMENTO P3 luta ganha, depois objetivo epico",
  "ACOPLAMENTO P1 IC95 inferior",
  "densidade visivel 0-14min",
];

function aposentadaTask9(label: string): boolean {
  return BANDAS_APOSENTADAS_TASK9.some((prefixo) => label.startsWith(prefixo));
}

// ---------------------------------------------------------------------------
// Bandas aposentadas na Task 8 da linha calendario-e-volume
//
// Spec docs/superpowers/specs/2026-10-02-calendario-e-volume-design.md, secao
// "Medicao e aceite": placas por partida passa a ser ACOMPANHADA SEM GATE, porque a
// referencia real de 8,2 e da regra de 2024 (5 placas so na torre externa, ate
// 14:00). No patch 26 toda torre de rota tem 5 placas permanentes, e nao ha
// referencia real da regra nova. Regra 4 do brief da Task 8: banda que so fixava o
// valor da regra antiga sai do assert. Linha com valor antes (50e1f68) e depois em
// docs/diagnostics/calendario-e-volume-bandas.md. Mesmo tratamento das de cima:
// calculada e impressa, marcada como APOSENTADA, fora do assert.
// ---------------------------------------------------------------------------
const BANDAS_APOSENTADAS_CALENDARIO: readonly string[] = ["placas por partida"];

function aposentadaCalendario(label: string): boolean {
  return BANDAS_APOSENTADAS_CALENDARIO.some((prefixo) => label.startsWith(prefixo));
}

/** Banda fora do assert: aposentada na Task 9 de luta-mapa-vitoria ou na Task 8 do calendario. */
function aposentada(label: string): boolean {
  return aposentadaTask9(label) || aposentadaCalendario(label);
}

/** Marca no relatorio a linha de uma banda aposentada; as demais passam intactas. */
function marcarAposentada(r: BandResult): BandResult {
  if (aposentadaTask9(r.label)) return { ...r, line: `[APOSENTADA Task 9, sem assert] ${r.line}` };
  if (aposentadaCalendario(r.label)) {
    return { ...r, line: `[APOSENTADA calendario Task 8, regra de 2024, sem assert] ${r.line}` };
  }
  return r;
}

// ---------------------------------------------------------------------------
// Builders de fixture flat (copiados verbatim de calibrate-structures.ts:57-79)
// Stat uniforme em todos os campos -> neutralidade (INV-1)
// ---------------------------------------------------------------------------

function makePlayer(id: string, role: Role, stat: number): PlayerVersion {
  return {
    id,
    personId: id,
    displayName: `${id} 2024`,
    year: 2024,
    roles: [role],
    primaryRole: role,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: stat },
    lanePhase: stat,
    midGame: stat,
    lateGame: stat,
    traits: [],
    championPool: Array.from({ length: 8 }, (_, i) => ({
      championId: `c${i}`,
      mastery: 3 as const,
    })),
  };
}

function roster(prefix: string, stat: number): PlayerVersion[] {
  return ROLES.map((r) => makePlayer(`${prefix}-${r}`, r, stat));
}

// ---------------------------------------------------------------------------
// Tiers: seis tiers nomeados, gap anotado (INST-05 estende D-07 para o amador)
// ---------------------------------------------------------------------------

interface Tier {
  name: string;
  us: number;
  rs: number;
}

const TIERS: Tier[] = [
  { name: "EQUILIBRADO", us: 75, rs: 75 }, // gap 0 -- tier de referencia, onde quase toda banda e avaliada
  { name: "GAP-LEVE", us: 80, rs: 70 }, // gap 10 -- ponto intermediario da monotonicidade
  { name: "PRO-GAP", us: 80, rs: 60 }, // gap 20 -- par metamorfico pro do tier amador de mesmo gap
  { name: "GAP-30", us: 90, rs: 60 }, // gap 30 -- ancora da curva de forca (Fase 28 / FRC-02)
  { name: "AMADOR-EQUILIBRADO", us: 45, rs: 45 }, // gap 0 amador -- exigido pelo criterio 3 do roadmap
  { name: "AMADOR-GAP", us: 60, rs: 40 }, // gap 20 amador -- exigido pelo criterio 3 do roadmap
];

// ---------------------------------------------------------------------------
// Coletor por tier
// ---------------------------------------------------------------------------

interface TierStats {
  games: number;
  userWins: number;

  durationSec: number[];
  killsTotal: number[];
  killsWinner: number[];
  killsLoser: number[];
  towersTotal: number[];
  towersWinner: number[];
  towersLoser: number[];

  towersAt20: number[];
  killsAt20: number[];
  killsAt20Frac: number[];
  noKillsBefore10: number;

  firstTowerSec: number[];
  firstTowerBefore420: number;

  platesPerGame: number[];
  towerLowPerGame: number[];

  goldFinalUser: number[];
  goldFinalRival: number[];
  goldPerMinTeam: number[];
  goldPerMinWinner: number[];
  goldPerMinLoser: number[];

  adcAssists: number[];

  favoriteHitAt20: number;
  favoriteHitAt20Denom: number;

  baronBeforeSpawn: number;

  /** OBSERVADO, sem banda (WPB-02, suposicao A1 do 23-RESEARCH.md): trocas de favorito. */
  favoriteSwitches: number[];

  // --- Dependencia de Baron e da rampa (PACE-06 e criterio 1 da Fase 25) ---
  // Todos OBSERVADOS, sem banda: PACE-06 pede "perto de zero" e a leitura util e a
  // comparacao antes e depois, nao um limiar inventado.
  /** Instante do primeiro Baron da partida, so das partidas em que houve Baron. */
  firstBaronSec: number[];
  /** Denominador comum dos tres contadores abaixo: partidas com primeira torre observada. */
  firstTowerObserved: number;
  /** Partidas em que a primeira torre caiu DEPOIS do primeiro Baron. */
  firstTowerAfterFirstBaron: number;
  /** Partidas em que a primeira torre caiu com a rampa de fim de jogo ativa. */
  firstTowerLateRampAtiva: number;
  /** Partidas em que a rampa sozinha ja bastaria para cruzar o limiar do gate. */
  firstTowerLateRampSuficiente: number;

  // --- Derivadas do bloco de ordem de entrada em banda (criterio 5 da Fase 25) ---
  // OBSERVADAS. Lidas do estado final exatamente como o painel oficial de
  // scripts/diagnose-engine.ts:208-212 as le. Nunca viram banda ASSERIDA aqui.
  /** Baroes por partida: soma de baronsTaken dos dois lados. */
  baronsPerGame: number[];
  /** Partidas com Alma: algum lado com soul diferente de null. */
  soulGames: number;
  /** Partidas com Elder: algum lado com elderCount maior que zero. */
  elderGames: number;
  /** Partidas encerradas no teto de 60 minutos (durationSec maior ou igual a 3600). */
  capGames: number;

  // --- Series de DISPERSAO acrescentadas pela Fase 25B, onda 2 ---
  // As oito series que a tabela de ancoragem exige ja existiam acima (durationSec,
  // killsTotal, towersTotal, towersWinner, towersLoser, firstTowerSec e goldPerMinTeam).
  // Faltavam as tres abaixo, e as tres sao derivadas do MESMO estado final que
  // analyseMatch ja le: nenhuma simulacao nova e paga por este bloco.
  /**
   * Torres totais da partida divididas pela duracao DAQUELA partida em minutos.
   * SERIE POR PARTIDA, nunca razao de medias: coeficiente de variacao de uma razao de
   * medias nao existe, porque a razao de medias e um unico numero, sem desvio.
   *
   * Duplica de proposito a formula de `towersPerMinArr`, calculada mais abaixo para a
   * banda de NIVEL de torres/min. A duplicacao e deliberada: mexer naquela linha para
   * reusar esta serie alteraria uma banda pre-existente, e T-25B-07 exige que nenhuma
   * banda existente seja tocada por este plano. As duas sao a mesma grandeza por
   * construcao (towersTotal e a soma dos dois lados e minutes e durationSec sobre 60).
   */
  towersPerMinPerGame: number[];
  /**
   * Ouro final do VENCEDOR e do PERDEDOR, por desfecho e nunca por lado.
   * NOTA DE FIDELIDADE, e ela e o motivo destas duas series existirem: `goldFinalUser` e
   * `goldFinalRival` sao por LADO, enquanto a ancoragem congelada e de ouro do vencedor e
   * do perdedor. Ancorar em lado quando a referencia e por desfecho trocaria a grandeza em
   * silencio, e o erro passaria despercebido porque os dois numeros sao proximos numa
   * fixture espelhada.
   */
  goldFinalWinner: number[];
  goldFinalLoser: number[];
  /**
   * Classificacao de dinamica por partida. E proporcao agregada, entao NAO tem dispersao
   * por partida e entra como banda sobre o VALOR, nunca sobre coeficiente de variacao.
   */
  dinamica: Record<Dinamica, number>;

  // --- Insumo de FORMA acrescentado pela Fase 25B, onda 2 ---
  /**
   * Contagem de rotas do PERDEDOR limpas por inteiro no estado final, de 0 a 3. Serie por
   * partida. As outras quatro fracoes de forma (vencedor no maximo do contador, shutout,
   * 9 a 0 exato) saem das series `towersWinner` e `towersLoser`, que ja existem e sao
   * paralelas indice a indice.
   */
  rotasLimpasDoPerdedor: number[];

  // ---------------------------------------------------------------------------
  // CONTAGEM COMPLETA DE TORRES (Fase 25B, onda 3): correcao de ERRO DE
  // ESPECIFICACAO, nao re-ancoragem de conveniencia.
  // ---------------------------------------------------------------------------
  //
  // O ERRO, e ele existe desde a Fase 23, quando as bandas de torre foram escritas.
  // A referencia de `torres/min` (0,36 a 0,38, STACK.md secao 7) vem de partidas pro
  // REAIS. Uma partida de LoL tem ONZE torres por lado, INCLUINDO as duas do Nexus, e
  // uma partida que termina necessariamente tem as duas torres do Nexus do perdedor
  // destruidas. Logo **a referencia SEMPRE contou as torres do Nexus**.
  //
  // O contador `towersDestroyed` de src/sim/ NUNCA contou: o ramo de torre do Nexus de
  // `damageStructure` e o unico ramo de queda que nao chama `recordTower()` (D-25-04).
  // A banda vinha portanto comparando uma metrica que **subconta** contra uma referencia
  // que **conta tudo**, e o erro medido e de +0,0665 a +0,0755 em torres/min, ou seja
  // entre 20 e 31 por cento do valor. Ele CRESCE quando a partida encurta, porque as duas
  // torres do Nexus caem de qualquer jeito e sao divididas por menos minutos.
  //
  // O QUE MUDA E O QUE NAO MUDA: piso e teto das bandas **nao mudam de valor**, porque a
  // referencia externa nao mudou. O que muda e a metrica passar a medir a MESMA COISA que
  // a referencia mede. A tabela completa das duas leituras, em treze pontos da grade,
  // esta em docs/diagnostics/25B-sweep.md secao 4.
  //
  // ONDE A CORRECAO E APLICADA E ONDE ELA NAO E, e a fronteira e deliberada:
  //   - APLICADA nas quatro bandas de VOLUME e TAXA, que sao as que tem referencia
  //     externa contando onze torres: `torres/min` (nivel e dispersao), `torres aos
  //     20:00`, `torres totais` (dispersao) e `razao de torres`;
  //   - NAO aplicada nas bandas de FORMA (vencedor no maximo do contador, tres rotas,
  //     uma rota, shutout, 9 a 0 exato, bimodalidade das duas distribuicoes) nem na
  //     dispersao de `torres do vencedor` e `torres do perdedor`. A razao e que as duas
  //     torres do Nexus sao uma CONSTANTE (2,07 por partida hoje, de um maximo de 2 por
  //     lado) e somar constante a uma metrica de forma nao acrescenta informacao de
  //     forma nenhuma: desloca a media e comprime o coeficiente de variacao sem mudar o
  //     que a distribuicao diz. As bandas de forma perguntam "quantas ROTAS o vencedor
  //     precisou limpar", que e pergunta sobre as nove torres de rota e nao sobre as
  //     onze do mapa. Mudar essas bandas junto seria trocar a regua de bandas que a
  //     correcao nao alcanca.
  //
  // A CORRECAO E DE LEITURA DE HARNESS, e `src/sim/` fica INTOCADO. Corrigir o proprio
  // `towersDestroyed` seria mudanca de MOTOR, deslocaria o golden e misturaria a
  // correcao de instrumento com a mudanca de comportamento da onda 3 no mesmo
  // deslocamento. A contagem completa e derivada do estado final, exatamente como a
  // linha observada que a onda 1 instrumentou em docs/diagnostics/25B-ancoragem.md
  // Bloco 5: `towersDestroyed` do lado mais `(2 - nexusTurretsAlive)` do adversario.

  /** Torres totais da partida na CONTAGEM COMPLETA (com as duas do Nexus de cada lado). */
  towersTotalFull: number[];
  /** Torres do VENCEDOR na contagem completa. Alimenta apenas a razao de torres. */
  towersWinnerFull: number[];
  /** Torres do PERDEDOR na contagem completa. Alimenta apenas a razao de torres. */
  towersLoserFull: number[];
  /** Torres por minuto por partida, na contagem completa. */
  towersPerMinFullPerGame: number[];

  // ---------------------------------------------------------------------------
  // FASE 26, PLANO 26-01, TASK 2: densidade de eventos por FASE DE JOGO (NAR-01).
  // TUDO OBSERVADO: nenhum destes campos alimenta checkBand/expectBands neste plano.
  // ---------------------------------------------------------------------------

  /**
   * Densidade VISIVEL por partida, por bucket: eventos totais do bucket divididos
   * pela exposicao (minutos) do bucket NAQUELA partida. SERIE POR PARTIDA: uma
   * partida sem exposicao no bucket NAO entra (nem como zero), porque exposicao
   * zero nao e densidade zero, e um zero contaminaria a media por artefato de
   * duracao (ver `exposicaoPorFase`).
   */
  densidadeVisivelPorFase: Record<FaseBucket, number[]>;
  /** Mesma forma de `densidadeVisivelPorFase`, contando so os tipos de EVENT_KINDS_COMPARAVEIS. */
  densidadeComparavelPorFase: Record<FaseBucket, number[]>;
  /**
   * Mistura de tipos de evento por bucket, ACUMULADOR somado sobre TODAS as partidas
   * do tier (nao serie por partida): alimenta a tabela de composicao do relatorio.
   */
  eventosPorFasePorKind: Record<FaseBucket, Partial<Record<EventKind, number>>>;
  /** Partidas em que soma(familia abates) != user.kills + rival.kills (prova do mapeamento). */
  identidadeAbatesFalhas: number;
  /** Partidas em que soma(familia torres) != towersTotalFull (prova do mapeamento). */
  identidadeTorresFalhas: number;

  /**
   * Torres aos 20:00 na contagem completa.
   *
   * MEDIDO E DECLARADO: aos 20:00 esta serie e IDENTICA a antiga, porque em **0 de 800
   * partidas** alguma torre do Nexus ja tinha caido aos 20:00, e a razao e estrutural e
   * nao amostral: uma torre do Nexus so pode cair depois de um inibidor cair, e
   * `inhibitor_destroyed` antes de 16:00 e evento de classe `nearZero` na tabela de
   * plausibilidade. A serie existe assim mesmo para que a definicao da metrica seja a
   * mesma nas quatro bandas corrigidas, em vez de a banda de 20:00 ficar como excecao
   * silenciosa que alguem teria de redescobrir.
   *
   * A contagem ate 20:00 NAO pode sair de `ev.score`, que le `towersDestroyed` e portanto
   * carrega o mesmo erro. Ela sai da timeline: cada `nexus_exposed` e a segunda torre do
   * Nexus daquele lado, e cada `tower_destroyed` com o ticker de torre do Nexus e a
   * primeira.
   */
  towersAt20Full: number[];
}

function emptyStats(): TierStats {
  return {
    games: 0,
    userWins: 0,
    durationSec: [],
    killsTotal: [],
    killsWinner: [],
    killsLoser: [],
    towersTotal: [],
    towersWinner: [],
    towersLoser: [],
    towersAt20: [],
    killsAt20: [],
    killsAt20Frac: [],
    noKillsBefore10: 0,
    firstTowerSec: [],
    firstTowerBefore420: 0,
    platesPerGame: [],
    towerLowPerGame: [],
    goldFinalUser: [],
    goldFinalRival: [],
    goldPerMinTeam: [],
    goldPerMinWinner: [],
    goldPerMinLoser: [],
    adcAssists: [],
    favoriteHitAt20: 0,
    favoriteHitAt20Denom: 0,
    baronBeforeSpawn: 0,
    favoriteSwitches: [],
    firstBaronSec: [],
    firstTowerObserved: 0,
    firstTowerAfterFirstBaron: 0,
    firstTowerLateRampAtiva: 0,
    firstTowerLateRampSuficiente: 0,
    baronsPerGame: [],
    soulGames: 0,
    elderGames: 0,
    capGames: 0,
    towersPerMinPerGame: [],
    goldFinalWinner: [],
    goldFinalLoser: [],
    dinamica: { stomp: 0, equilibrado: 0, comeback: 0 },
    rotasLimpasDoPerdedor: [],
    towersTotalFull: [],
    towersWinnerFull: [],
    towersLoserFull: [],
    towersPerMinFullPerGame: [],
    towersAt20Full: [],
    densidadeVisivelPorFase: { faseA: [], faseB: [], faseC: [] },
    densidadeComparavelPorFase: { faseA: [], faseB: [], faseC: [] },
    eventosPorFasePorKind: { faseA: {}, faseB: {}, faseC: {} },
    identidadeAbatesFalhas: 0,
    identidadeTorresFalhas: 0,
  };
}

// ---------------------------------------------------------------------------
// Saturacao de goldFightMult/goldSecureMult (INST-08)
// ---------------------------------------------------------------------------

interface ClampStats {
  totalSamples: number;
  fightFloor: number;
  fightCeil: number;
  secureFloor: number;
  secureCeil: number;
}

function emptyClampStats(): ClampStats {
  return { totalSamples: 0, fightFloor: 0, fightCeil: 0, secureFloor: 0, secureCeil: 0 };
}

/**
 * Clamps ESPELHADOS de src/sim/power.ts (GOLD_FIGHT_FLOOR/GOLD_FIGHT_CEIL e
 * GOLD_SECURE_FLOOR/GOLD_SECURE_CEIL, constantes nao exportadas). Contrato da spec
 * 2026-10-02 secao 2: goldFightMult entre 0,6 e 1,6; goldSecureMult entre 0,8 e
 * 1,25. A Task 9 trocou os valores antigos de luta (0,7 e 1,4), que nao casavam
 * mais com o piso e o teto do motor. Se power.ts mudar estes clamps, mudar aqui.
 * Tolerancia 1e-9.
 */
const FIGHT_FLOOR = 0.6;
const FIGHT_CEIL = 1.6;
const SECURE_FLOOR = 0.8;
const SECURE_CEIL = 1.25;
const CLAMP_EPS = 1e-9;

/**
 * Reconstroi os DOIS TeamState no instante de cada evento a partir do resultado da
 * simulacao, e chama goldFightMult/goldSecureMult (import puro de ../src/sim/power,
 * nunca reimplementado). O molde e res.finalState[side]: meta e metricsBase sao
 * congelados uma unica vez em freshPlayerState (matchState.ts) e nunca mutados
 * durante a partida, entao e seguro reusar o jogador final como template e
 * sobrescrever so gold/alive com o instantaneo do evento (ev.map[side].players[role]).
 *
 * Contrato novo (Task 9): o multiplicador le o ouro RELATIVO (fatia do time no ouro
 * total da partida) e a saturacao de item (ouro do time mais pobre), entao os dois
 * lados e o ouro de time precisam estar no instante do evento. Antes desta correcao
 * o ouro de time e o lado inimigo vinham de res.finalState, ou seja do FIM da
 * partida, e a amostra media outra coisa. O ouro de time e a soma do ouro dos cinco
 * jogadores (economia da spec 2026-10-02 secao 3: todo credito passa por
 * creditPlayer/creditTeamSplit em src/sim/economy.ts).
 */
function sampleGoldMultClamps(res: SimulationResult, cs: ClampStats): void {
  for (const ev of res.timeline) {
    const teamAt = (side: Side): TeamState => {
      const template = res.finalState[side];
      const snap = ev.map[side];
      const players = {} as Record<Role, PlayerState>;
      let gold = 0;
      for (const role of ROLES) {
        players[role] = {
          ...template.players[role],
          gold: snap.players[role].gold,
          alive: snap.players[role].alive,
        };
        gold += snap.players[role].gold;
      }
      return { ...template, players, gold };
    };
    const user = teamAt("user");
    const rival = teamAt("rival");
    // A base continua sendo res.finalState (cards, tuning e demais campos estaveis
    // a partida inteira), com relogio e os dois times trocados pelo instantaneo.
    const state = { ...res.finalState, gameTimeSec: ev.timeSec, user, rival } as MatchState;

    for (const team of [user, rival]) {
      const fight = goldFightMult(team, state);
      const secure = goldSecureMult(team, state);

      cs.totalSamples++;
      if (Math.abs(fight - FIGHT_FLOOR) < CLAMP_EPS) cs.fightFloor++;
      if (Math.abs(fight - FIGHT_CEIL) < CLAMP_EPS) cs.fightCeil++;
      if (Math.abs(secure - SECURE_FLOOR) < CLAMP_EPS) cs.secureFloor++;
      if (Math.abs(secure - SECURE_CEIL) < CLAMP_EPS) cs.secureCeil++;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers de leitura de timeline
// ---------------------------------------------------------------------------

/** Ultimo evento com timeSec <= tSec (timeline e cronologica), ou null se nenhum. */
function lastEventAtOrBefore(res: SimulationResult, tSec: number): SimEvent | null {
  let found: SimEvent | null = null;
  for (const ev of res.timeline) {
    if (ev.timeSec <= tSec) found = ev;
    else break;
  }
  return found;
}

/** Menor timeSec entre eventos de um dos kinds informados (timeline cronologica). */
function firstEventTime(res: SimulationResult, kinds: ReadonlySet<EventKind>): number {
  for (const ev of res.timeline) {
    if (kinds.has(ev.kind)) return ev.timeSec;
  }
  return Infinity;
}

const FIRST_TOWER_KINDS: ReadonlySet<EventKind> = new Set(["first_tower", "tower_destroyed"]);

const BARON_KINDS: ReadonlySet<EventKind> = new Set(["baron_taken", "baron_steal"]);

/**
 * Substring invariante do ticker de queda de TORRE DO NEXUS, copiada de
 * `src/sim/structures.ts` (`${who} derrubou uma torre do Nexus inimigo.`).
 *
 * Ela existe porque a torre do Nexus e o unico ramo de queda que emite
 * `tower_destroyed` sem incrementar `towersDestroyed` (D-25-04), entao pelo `kind`
 * sozinho ela e indistinguivel de uma torre de rota. So e usada na contagem completa
 * ATE 20:00, onde nao ha estado final de onde ler o contador de torres do Nexus.
 * No estado final a leitura correta e `2 - nexusTurretsAlive` e nunca a timeline.
 */
const TICKER_TORRE_DO_NEXUS = "derrubou uma torre do Nexus inimigo";

// ---------------------------------------------------------------------------
// Instantes da rampa de fim de jogo (PACE-06 e criterio 1 da Fase 25)
// ---------------------------------------------------------------------------

/**
 * Instante em que a rampa de fim de jogo comeca a sair de zero.
 * Fonte: src/sim/structures.ts:694, lateRamp = Math.max(0, (gameTimeSec - 2100) / 900).
 */
const LATE_RAMP_ATIVA_SEC = 2100;

/**
 * Instante em que a rampa SOZINHA ja bastaria para cruzar o limiar do gate de pressao
 * estrutural. Este numero nao aparece pronto em lugar nenhum do projeto, entao a
 * derivacao fica escrita aqui:
 *   - src/sim/structures.ts:694: lateRamp = max(0, (gameTimeSec - 2100) / 900), ou seja
 *     vale zero ate 2100 s e cresce um a cada 900 s;
 *   - src/sim/structures.ts:699: o gate e `if (force <= 0.18 || rng() > force) return null`,
 *     com force = pressure/100 + baron*0.5 + voidgrubs*0.04 + lateRamp;
 *   - com pressao zero, sem Baron e sem voidgrubs, force e igual a lateRamp, e superar
 *     0,18 exige (t - 2100) / 900 > 0,18, ou seja t > 2100 + 0,18 * 900 = 2262 s = 37:42.
 * Nenhuma linha de src/sim/ e alterada por esta leitura: a constante e replicada aqui
 * com a citacao da origem, e o harness so le a timeline.
 */
const LATE_RAMP_SUFICIENTE_SEC = 2262;

// ---------------------------------------------------------------------------
// FASE 25B, ONDA 2: a ancoragem de DISPERSAO, medida no motor pre-Fase-25
// ---------------------------------------------------------------------------

/**
 * TABELA DE ANCORAGEM DE DISPERSAO. NENHUM NUMERO DESTE BLOCO PODE SER ALTERADO SEM
 * ALTERAR `docs/diagnostics/25B-ancoragem.md` JUNTO. Ele e a copia versionada do Bloco 2
 * daquele documento, e existe aqui apenas para que o gate possa ler a referencia sem I/O.
 *
 * FONTE: `docs/diagnostics/25B-ancoragem.md`, Bloco 2 (a tabela de ancoragem).
 * COMO FOI MEDIDO, em uma linha por dimensao:
 *   - estado de motor: commit base da Fase 25, `a24ea230301d88c363e32b762a39f58746dd7abd`
 *     (`a24ea23`), reconstruido por `git checkout a24ea23 -- src/sim/` e desfeito no mesmo
 *     Task, com restauracao provada por hash de blob dos cinco arquivos (Bloco 1);
 *   - harness: `scripts/probe-shape.ts` (`npm run probe:shape`), sonda de observacao pura,
 *     sem uma unica assercao e fora da cadeia de `npm run calibrate:all`;
 *   - fixture: a MESMA deste arquivo, tier EQUILIBRADO 75 contra 75, stat uniforme;
 *   - N: 800 partidas, semente igual ao indice da partida (0 a 799);
 *   - definicao: desvio POPULACIONAL dividido pela media, por `stdev` e `mean` de
 *     `scripts/stats.ts`, sobre a serie POR PARTIDA.
 *
 * A RECONSTRUCAO FOI VALIDADA ANTES DE VIRAR ANCORAGEM (Bloco 3 do mesmo documento):
 * tolerancia de 12 por cento declarada ANTES da medicao, sete de sete coeficientes ja
 * congelados no baseline da Fase 24 reproduzidos dentro dela, maior desvio absoluto de
 * 1,87 por cento. Nenhuma banda precisou nascer provisoria por ancoragem duvidosa.
 *
 * TRES ENTRADAS FORAM MEDIDAS PELA PRIMEIRA VEZ NAQUELA ONDA e nao existem no baseline
 * congelado da Fase 24: `torresTotais`, `torresPorMin` e `ouroPorMin`. D-25-07 registra
 * explicitamente que elas nao constavam do relatorio de diagnose com bloco estatistico,
 * e e por isso que o colapso de duas delas so pode ser visto agora. As outras sete batem
 * com o baseline congelado dentro de 1,87 por cento (duracao 0,1599, abates totais 0,2731,
 * primeira torre 0,2545, torres do vencedor 0,2802, torres do perdedor 0,5567, ouro do
 * vencedor 0,1969, ouro do perdedor 0,2359).
 *
 * `razao de torres` NAO ESTA NESTA TABELA E NAO PODE ENTRAR. Ela e indefinida quando o
 * perdedor termina com zero torres, o que hoje descarta 22,9 por cento da amostra, e o
 * descarte NAO e aleatorio: ele remove justamente os extremos. Coeficiente de variacao
 * sobre amostra truncada assim mede o truncamento, nao a dispersao. A banda de NIVEL da
 * razao continua neste arquivo e continua sendo o instrumento certo para nivel.
 */
const ANCORAGEM_CV_PRE_FASE_25 = {
  duracao: 0.1596,
  abatesTotais: 0.268,
  torresVencedor: 0.2803,
  torresPerdedor: 0.5624,
  torresTotais: 0.3015,
  torresPorMin: 0.2103,
  primeiraTorre: 0.2539,
  ouroVencedor: 0.1952,
  ouroPerdedor: 0.2326,
  ouroPorMin: 0.0774,

  // -------------------------------------------------------------------------
  // ANCORAGEM SOB A CONTAGEM COMPLETA DE TORRES (Fase 25B, onda 3)
  // -------------------------------------------------------------------------
  //
  // POR QUE ESTAS DUAS ENTRADAS EXISTEM, e por que reusar as de cima seria ERRADO.
  // As duas bandas de dispersao de torre passaram a ler a contagem completa (com as
  // duas torres do Nexus). Somar uma quantidade quase constante a uma serie COMPRIME o
  // coeficiente de variacao dela, porque a media sobe e o desvio quase nao muda.
  // Comparar o coeficiente novo contra a ancoragem antiga mediria a mudanca de
  // DEFINICAO e nao a mudanca de motor, que e exatamente o erro que a onda 1 existiu
  // para eliminar. A ancoragem tem de vir da MESMA definicao, nos dois estados.
  //
  // COMO FORAM OBTIDAS: pelo mesmo procedimento da onda 1, sem atalho.
  // `git checkout a24ea23 -- src/sim/` reconstroi o motor pre-Fase-25 exato, a medicao
  // roda com a fixture EQUILIBRADO (75 contra 75), N igual a 800 e semente igual ao
  // indice, e a restauracao e provada por hash de blob dos cinco arquivos contra o
  // commitado (`git hash-object` contra `git rev-parse HEAD:<arquivo>`), nunca por
  // `git status`, pela armadilha de `core.autocrlf` ja registrada no plano 25-07.
  //
  // VALIDACAO DA RECONSTRUCAO, e ela e o que autoriza usar estes dois numeros: a mesma
  // rodada reproduziu as tres ancoragens antigas na quarta casa decimal
  // (`torres totais` 0,3015, `torres por minuto` 0,2103, `torres do vencedor` 0,2803) e
  // as medias correspondentes (9,631, 0,1839 e 5,759). Ou seja o instrumento novo mede
  // o mesmo estado que o instrumento da onda 1 mediu, e a unica diferenca entre as duas
  // linhas e a definicao da metrica.
  //
  // A MAGNITUDE DA COMPRESSAO, declarada: `torres totais` cai de 0,3015 para 0,2407 e
  // `torres por minuto` de 0,2103 para 0,1648, ou seja 20 e 22 por cento. Como a
  // compressao acontece nos dois estados, a RAZAO que a banda avalia se move pouco, e
  // e por isso que trocar a ancoragem junto com a metrica e o que mantem a banda
  // medindo motor em vez de medir definicao.
  torresTotaisFull: 0.2407,
  torresPorMinFull: 0.1648,
} as const;

/**
 * CV REAL DA PRIMEIRA TORRE NO PATCH 26 (Task 8 da linha calendario-e-volume). A banda de
 * dispersao da primeira torre deixa de ser ancorada no motor pre-Fase-25 (0,2539, ainda
 * na tabela acima, que nao muda) e passa a ser ancorada no coeficiente de variacao real
 * da amostra multi-liga 2026 do STACK.md secao 4.4, jogada no patch 26: desvio 2:42
 * (162 s) sobre media 16:22 (982 s), 0,165. As amostras de Worlds 2023 a 2025 dao 0,129
 * a 0,165. Motivo: a ancoragem antiga fixava a dispersao da primeira torre do mapa de
 * 2024, com a torre externa sem a resistencia de 11:00 a 15:00; a regra do patch 26
 * concentra a primeira torre entre 14 e 17 min, como a referencia real. Regra 4 do brief
 * da Task 8: banda de regra de 2024 atualizada para o patch 26. Piso e teto da razao
 * (0,75 e 2,00) nao mudam. Medido: CV 0,2235 em 50e1f68 e 0,1450 no motor da Task 8.
 */
const CV_REAL_PRIMEIRA_TORRE_PATCH26 = 0.165;

/** Procedencia da ancoragem real da primeira torre. */
const FONTE_CV_REAL_PRIMEIRA_TORRE =
  "STACK.md secao 4.4, amostra multi-liga 2026 (patch 26, N=203): desvio 2:42 sobre media 16:22; " +
  "atualizada para o patch 26 na Task 8 da linha calendario-e-volume";

/**
 * PISO da banda de dispersao: 0,75. Nao e decisao da onda 2, e o corte de COLAPSO usado
 * na medicao que abriu D-25-07 e aprovado ali. Valor de engenharia declarado, folgado o
 * bastante para nao disparar por ruido amostral e apertado o bastante para pegar perda
 * material.
 */
const DISP_PISO = 0.75;

/**
 * TETO da banda de dispersao: 2,00. Escolhido na onda 1 por criterio escrito ANTES dos
 * numeros novos serem lidos (Bloco 4 de `docs/diagnostics/25B-ancoragem.md`): o menor
 * multiplo de 0,25 estritamente acima do maior aumento de dispersao que a milestone ja
 * classificou como LEGITIMO, que e `baroes por jogo` com razao 1,954 (secao 8 de
 * `docs/diagnostics/25-sweep.md`).
 *
 * O valor ilustrativo de 1,60 de D-25-07 esta RECUSADO por medicao, e a recusa esta
 * registrada: ele reprovaria o proprio `baroes por jogo` que a fonte usa como exemplo de
 * dispersao saudavel, e reprovaria `torres do perdedor` (1,731 aqui, 1,749 no harness de
 * N igual a 1500) pelo DIAGNOSTICO ERRADO. O que inflou aquela dispersao nao e ruido, e a
 * segunda pilha do shutout, defeito que ja tem instrumento proprio e mais especifico nesta
 * fase (bimodalidade das distribuicoes e fracao de shutout). Uma banda por defeito, no
 * eixo em que o defeito aparece.
 */
const DISP_TETO = 2.0;

/** Procedencia compartilhada das dez bandas de coeficiente de variacao. */
const FONTE_ANCORAGEM_DISPERSAO =
  "docs/diagnostics/25B-ancoragem.md Bloco 2 (CV medido no motor pre-Fase-25, commit base " +
  "a24ea23, harness probe-shape, fixture EQUILIBRADO 75 contra 75, N=800)";

/**
 * DONO PADRAO das bandas de dispersao que hoje nao tem vermelho atribuido: elas sao VIGIAS
 * das cinco fases que ainda vao apertar nivel. A Fase 30 e apenas o endereco padrao enquanto
 * ninguem produzir o vermelho. REGRA ESCRITA, e ela vale mais que o campo: um vermelho numa
 * banda de vigia passa a ser da FASE QUE O PRODUZIU, e a reatribuicao e obrigatoria no
 * fechamento daquela fase.
 */
const DONO_VIGIA_DISPERSAO = "Fase 30 (vigia; o vermelho passa a ser de quem o produzir)";

/**
 * Coeficiente de variacao: desvio POPULACIONAL dividido pela media, com `mean` e `stdev`
 * de `scripts/stats.ts`. Identico ao usado por `scripts/probe-shape.ts`, que produziu a
 * ancoragem: instrumento diferente do que mediu a referencia moveria a banda em silencio.
 *
 * E o eixo escolhido por D-25-07 em vez do desvio absoluto, e o motivo esta medido: a
 * duracao caiu 31 por cento entre o baseline e hoje, entao desvio absoluto menor pode ser
 * exatamente a MESMA dispersao relativa.
 *
 * Retorna NaN quando a media e zero. NaN reprova de forma barulhenta em checkBand em vez
 * de virar infinito silencioso.
 */
function coefVariacao(a: readonly number[]): number {
  const m = mean(a);
  return m === 0 ? NaN : stdev(a) / m;
}

// ---------------------------------------------------------------------------
// Classificacao de dinamica por partida (a decima primeira linha de dispersao)
// ---------------------------------------------------------------------------

type Dinamica = "stomp" | "equilibrado" | "comeback";

/**
 * Cortes de classificacao de dinamica, copiados LITERALMENTE de
 * `scripts/diagnose-engine.ts:287-289`. Copia e nao import porque aquele arquivo nao
 * exporta a regra, e reimplementar com OUTROS cortes produziria uma fracao de comeback
 * que nao seria comparavel com os 66,5 por cento do baseline congelado da Fase 24.
 */
const STOMP_MIN_WINPROB = 0.42;
const COMEBACK_MAX_WINPROB = 0.32;

/**
 * Minimo da probabilidade de vitoria DO VENCEDOR ao longo da timeline inteira. Se o
 * vencedor nunca esteve abaixo de 0,42 foi atropelo; se chegou a estar abaixo de 0,32 foi
 * virada; o resto e equilibrado. Reproduz `scripts/diagnose-engine.ts:248-289` e
 * `scripts/probe-shape.ts`, que mediu a ancoragem.
 *
 * E a medicao mais direta possivel do core value declarado em `PROJECT.md` linha 9
 * ("lanes apertadas podem virar"), e foi ela que produziu o numero mais grave da secao 8
 * de `docs/diagnostics/25-sweep.md`: comeback de 65,1 para 31,5 por cento.
 */
function classificarDinamica(res: SimulationResult): Dinamica {
  let winnerMin = 1;
  for (const ev of res.timeline) {
    const wp = res.winner === "user" ? ev.winProbUserAfter : 1 - ev.winProbUserAfter;
    winnerMin = Math.min(winnerMin, wp);
  }
  if (winnerMin >= STOMP_MIN_WINPROB) return "stomp";
  if (winnerMin < COMEBACK_MAX_WINPROB) return "comeback";
  return "equilibrado";
}

// ---------------------------------------------------------------------------
// FASE 25B, ONDA 2: os insumos de FORMA (criterios 2 e 3 do roadmap)
// ---------------------------------------------------------------------------

/**
 * Maximo do contador de torres por lado. NAO e constante de motor: e o teto aritmetico de
 * `towersDestroyed`, que conta tres torres em cada uma das tres rotas do adversario e NAO
 * conta as duas do Nexus (D-25-04). Nove e o valor que o contrafactual da secao 7 de
 * `docs/diagnostics/25-sweep.md` usa como "maximo do contador".
 */
const MAX_CONTADOR_TORRES = 9;

/**
 * Corte de SHUTOUT: perdedor terminando com 0 ou 1 torre. Mesma definicao da secao 7 de
 * `docs/diagnostics/25-sweep.md`, para que os numeros deste gate sejam comparaveis linha a
 * linha com os quatro estados do contrafactual e com a onda 1.
 */
const SHUTOUT_MAX_TORRES = 1;

/**
 * Uma rota conta como LIMPA POR INTEIRO quando as tres estruturas de torre daquela lane
 * cairam: `outerAlive`, `innerAlive` e `inhibTurretAlive` todas falsas em
 * `structures[lane]` do lado informado (src/sim/matchState.ts:134-141).
 *
 * LIDO DO ESTADO FINAL, NUNCA INFERIDO DA TIMELINE, e a razao e concreta: a timeline tem
 * pelo menos dois caminhos de queda que nao sao equivalentes ao contador (o caminho do
 * Arauto incrementa o contador sem emitir evento, e o ramo de torre do Nexus emite evento
 * sem incrementar o contador, que e D-25-04). Contar queda por evento produziria um numero
 * que nao fecha com o estado, e a conciliacao dessas tres leituras ja custou um item
 * diferido inteiro no plano 25-05.
 *
 * Copia verbatim de `scripts/probe-shape.ts`, que produziu a ancoragem de forma da onda 1:
 * ler a mesma grandeza por outra regra moveria o numero do gate em relacao a referencia.
 */
function rotasLimpasPorInteiro(team: TeamState): number {
  let limpas = 0;
  for (const lane of LANES) {
    const s = team.structures[lane];
    if (!s.outerAlive && !s.innerAlive && !s.inhibTurretAlive) limpas++;
  }
  return limpas;
}

/**
 * Coeficiente de bimodalidade, ou NaN quando a amostra e degenerada. `bimodalityCoefficient`
 * devolve null com n abaixo de 10 ou variancia zero, e nenhum dos dois acontece com N igual a
 * 800 nestas distribuicoes. NaN em vez de um valor de conveniencia porque NaN REPROVA de
 * forma barulhenta em checkBand, enquanto um zero silencioso poderia ser lido como medicao.
 */
function bcOuNaN(a: readonly number[]): number {
  const bc = bimodalityCoefficient(a);
  return bc === null ? NaN : bc;
}

// ---------------------------------------------------------------------------
// FASE 25C, ONDA 2: o TERCEIRO EIXO DE GATE, o ACOPLAMENTO
// ---------------------------------------------------------------------------

/**
 * REGRA DE ESCOPO DESTAS TRES BANDAS, e ela precisa estar escrita porque o eixo e novo:
 * elas incidem sobre ACOPLAMENTO, que e razao contra a ancoragem TEORICA exata de 1,000,
 * e nunca sobre metrica derivada. Elas NAO substituem nenhuma banda de nivel, e nenhuma
 * banda pre-existente deste arquivo muda de piso ou de teto por causa delas.
 *
 * NENHUMA SIMULACAO EXTRA E PAGA. O tier EQUILIBRADO ja simula as 800 partidas e ja tem
 * as linhas do tempo em maos; as tres bandas sao computadas por `scripts/lift.ts` sobre
 * essas mesmas linhas do tempo. A retencao das timelines e LOCAL ao tier EQUILIBRADO e
 * nao aos seis tiers, justamente para que a inclusao nao mude o custo do gate de forma
 * material: os outros cinco tiers continuam descartando o resultado como sempre fizeram.
 *
 * A DEFINICAO DOS PARES VEM DE `scripts/lift.ts` E NAO E REESCRITA AQUI. A sonda de
 * observacao (`scripts/probe-lift.ts`) le a MESMA funcao. Duas copias da definicao
 * divergiriam em silencio, e a leitura PRE congelada deixaria de ser comparavel com a
 * POS que a julga, que e exatamente o erro que o plano 25B-01 existiu para corrigir.
 */

/**
 * A JANELA DA BANDA: 60 s. Escolhida por varredura e nao por opiniao, com a justificativa
 * no Bloco 2.3 de `docs/diagnostics/25C-ancoragem.md`: o sinal e monotonicamente
 * decrescente em W nos tres pares, 60 s coincide com o `ACE_WINDOW_SEC` que a engine ja
 * possui, e a contagem de ancoras continua alta. As leituras de 120 e 180 s saem no
 * relatorio como OBSERVACAO e nao viram banda nenhuma.
 */
const W_ACOPLAMENTO = 60;

/** Janelas de observacao, impressas ao lado e sem banda. */
const W_ACOPLAMENTO_OBS = [120, 180];

/**
 * A LEITURA PRE CONGELADA, transcrita de `docs/diagnostics/25C-ancoragem.md` Bloco 3.1.
 *
 * NENHUM NUMERO DESTE BLOCO PODE SER ALTERADO SEM ALTERAR AQUELE DOCUMENTO JUNTO. Ele
 * existe aqui apenas para que o gate leia a referencia sem I/O, no mesmo molde de
 * `ANCORAGEM_CV_PRE_FASE_25` acima.
 *
 * COMO FOI MEDIDO, em uma linha por dimensao:
 *   - estado de motor: commit base da Fase 25C, `4ede940`, com `src/sim/` provado byte a
 *     byte identico ao commitado por hash de blob dos cinco arquivos;
 *   - harness: `scripts/probe-lift.ts` (`npm run probe:lift`), sonda de observacao pura,
 *     sem uma unica assercao e fora da cadeia de `npm run calibrate:all`;
 *   - fixture: a MESMA deste arquivo, tier EQUILIBRADO 75 contra 75, stat uniforme;
 *   - N: **800 partidas**, o MESMO N deste gate, semente igual ao indice da partida;
 *   - janela: 60 s, com a de 120 e 180 s medidas ao lado como observacao;
 *   - estimador: nulo PAREADO POR CONTAGEM, escolhido por assercao contra corpus com
 *     independencia verdadeira por construcao (`scripts/lift.test.ts`).
 *
 * A LEITURA DE N = 2000 EXISTE E NAO PODE ENTRAR AQUI. Ela mediu P1 1,563, P2 1,928 e
 * P3 1,318, todos dentro do IC da leitura de ancoragem, e esta rotulada como OBSERVACAO
 * no Bloco 3.1. Ancorar uma banda em numero medido com outro N assina um erro sistematico
 * de origem desconhecida, e foi esse desalinhamento que o plano 25B-01 existiu para
 * corrigir.
 */
const ANCORAGEM_LIFT_PRE_25C = {
  /** P1 `gank`, depois queda de torre na MESMA rota. IC95 [1,256; 1,932]. A fase MOVE. */
  P1: 1.593,
  /** P2 `baron_taken`, depois queda de torre. IC95 [1,921; 2,186]. A fase PRESERVA. */
  P2: 2.054,
  /** P3 luta ganha, depois objetivo epico. IC95 [1,216; 1,400]. A fase MOVE. */
  P3: 1.307,
} as const;

/**
 * PISO ABSOLUTO DE INSTRUMENTO: 1,050. Fonte: Bloco 2.4 da ancoragem.
 *
 * Nao e escolha de gosto: e o menor multiplo de 0,005 estritamente acima do maior vies
 * medido do estimador adotado sob independencia VERDADEIRA, que e 1,043. A onda 2
 * reconferiu esse numero varrendo a janela sobre corpus sintetico de lift verdadeiro
 * 1,000 (Bloco 2.12): o vies NAO cresce quando a janela encurta, o maior de toda a
 * varredura continua sendo 1,043 em W = 30 s, e em W = 60 s ele e no maximo 1,010.
 * O piso ficou CONFIRMADO e nao foi re-derivado.
 */
const ACOPL_PISO_ABSOLUTO = 1.05;

/** Piso RELATIVO dos pares que a fase MOVE. Bloco 2.4 da ancoragem. */
const ACOPL_FATOR_MOVE = 1.15;

/** Piso de PRESERVACAO do par que a fase NAO move de proposito. Bloco 2.4 da ancoragem. */
const ACOPL_FATOR_PRESERVA = 0.95;

/**
 * Epsilon de ESTRITEZA. O criterio do Bloco 2.4 e "IC95 inferior ESTRITAMENTE maior que
 * 1,050", e `inBand` de `scripts/stats.ts` compara com `>=`, ou seja e inclusivo. Somar
 * este epsilon ao piso e o que transforma a comparacao inclusiva na estrita que o criterio
 * pede, sem reimplementar `inBand` e sem abrir excecao a regra de que toda comparacao de
 * banda passa por `checkBand`.
 */
const ACOPL_EPS_ESTRITO = 1e-9;

/**
 * OS TETOS, e eles NAO sao decorativos: acoplamento excessivo tambem e defeito, porque uma
 * engine em que gank SEMPRE vira torre e tao irreal quanto uma em que nunca vira.
 *
 * O criterio e o mesmo tipo que a Fase 25B usou para o teto de dispersao (Bloco 4 de
 * `docs/diagnostics/25B-ancoragem.md`): o menor multiplo redondo estritamente acima do
 * maior valor que a milestone ja tem razao para considerar LEGITIMO naquele par, com o
 * valor de referencia citado. Multiplo de 0,25, o mesmo passo da Fase 25B.
 *
 *   P1  referencia 2,020, que e a projecao do conjunto recomendado da pesquisa sobre o
 *       PRE de 60 s (razao medida 1,268 vezes 1,593), no Bloco 2.13 da ancoragem. Menor
 *       multiplo de 0,25 estritamente acima: 2,25.
 *   P2  referencia 2,054, que e o PROPRIO PRE. A fase declara este par como PRESERVADO,
 *       ou seja declara que o valor de hoje esta correto, e por isso ele e por definicao
 *       o maior valor legitimo conhecido para P2. Menor multiplo de 0,25 acima: 2,25.
 *   P3  referencia 1,503, que e o proprio piso relativo que a fase persegue (Bloco 2.13).
 *       Nenhuma medicao da milestone deu a P3 razao para valor maior que esse. Menor
 *       multiplo de 0,25 estritamente acima: 1,75.
 */
const ACOPL_TETO = { P1: 2.25, P2: 2.25, P3: 1.75 } as const;

/**
 * P2 REANCORADO NA SPEC (Task 8 da linha calendario-e-volume, regra 5 do brief). A spec
 * docs/superpowers/specs/2026-10-02-calendario-e-volume-design.md (secoes 3 e 4) concentra
 * as lutas em volta de objetivos e faz o Barao sair por preparo cheio ou pela janela de
 * conversao, que segue para o cerco: a torre cai logo depois do Barao com mais frequencia
 * que no motor da Fase 25C. Medido neste gate (EQUILIBRADO, N=800, W=60 s): lift 1,955 e
 * IC95 inferior 1,881 em 50e1f68; lift 2,779 e IC95 inferior 2,670 no motor da Task 8, que
 * estouravam o teto 2,25. N maior nao muda o lado (a diferenca e de 0,5 contra um IC de
 * cerca de 0,1). Mesmo criterio do Bloco 2.4 da ancoragem 25C aplicado ao valor novo:
 * piso = 0,95 vezes o valor medido (par preservado), teto = menor multiplo de 0,25
 * estritamente acima dele. A leitura PRE de ANCORAGEM_LIFT_PRE_25C fica intacta.
 */
const ACOPL_P2_CALENDARIO = { valor: 2.779, teto: 3.0 } as const;

/** Procedencia da reancoragem do P2. */
const FONTE_ACOPL_P2_CALENDARIO =
  "reancorado na Task 8 da linha calendario-e-volume (spec 2026-10-02-calendario-e-volume secoes 3 e 4; " +
  "lift 2,779 medido neste gate, EQUILIBRADO 75 contra 75, N=800, W=60s, nulo pareado por contagem)";

/** Procedencia compartilhada das seis bandas de acoplamento. */
const FONTE_ANCORAGEM_ACOPLAMENTO =
  "docs/diagnostics/25C-ancoragem.md Bloco 3 (leitura PRE congelada no commit base 4ede940, " +
  "harness probe-lift, fixture EQUILIBRADO 75 contra 75, N=800, W=60s, nulo pareado por contagem)";

/**
 * DONO das tres bandas. Elas nascem VERMELHAS de proposito e o vermelho e a lista de
 * trabalho das ondas 3 a 5 desta mesma fase, entao o dono nao e endereco provisorio.
 */
const DONO_ACOPLAMENTO = "Fase 25C";

/**
 * Piso EFETIVO de um par: o maior entre o piso absoluto de instrumento e o piso que aquele
 * par paga por ser movido ou preservado. Hoje o piso do par domina nos tres, e o absoluto
 * fica de fundo contra o vies do instrumento.
 */
function pisoEfetivo(pre: number, fator: number): number {
  return Math.max(ACOPL_PISO_ABSOLUTO, pre * fator);
}

/**
 * Converte uma partida simulada na forma que `scripts/lift.ts` consome. O dragao entra
 * DUAS vezes de proposito: uma como `dragon_taken`, que e o tipo publico que alimenta P3 e
 * os exploratorios, e outra como o tipo derivado do controle interno C1 (o subconjunto sem
 * contestacao) ou do observado C1x (o subconjunto com luta). Os pares que usam essas
 * chaves sao disjuntos entre si, entao a duplicacao nao contamina medicao nenhuma.
 *
 * A razao da separacao esta medida no Bloco 2.12 da ancoragem: o dragao CONTESTADO arrasta
 * uma teamfight, e `aliveCount` do inimigo alimenta `shouldPushStructure` e
 * `numbersAdvantage` na camada estrutural. Isso e caminho mecanico, e o controle interno
 * precisa ser o subconjunto que NAO tem esse caminho.
 */
function paraLift(res: SimulationResult): LiftMatch {
  const evs: LiftEvent[] = res.timeline.map((e) => ({
    t: e.timeSec,
    kind: e.kind,
    side: (e.side as LiftSide) ?? null,
    lane: (e.lane as string) ?? null,
  }));
  for (const e of res.timeline) {
    if (e.kind !== "dragon_taken") continue;
    evs.push({
      t: e.timeSec,
      kind: classificaDragao(e.ticker),
      side: (e.side as LiftSide) ?? null,
      lane: (e.lane as string) ?? null,
    });
  }
  evs.sort((a, b) => a.t - b.t);
  return { dur: res.durationSec, evs };
}

// ---------------------------------------------------------------------------
// FASE 26, PLANO 26-01, TASK 2: densidade de eventos por FASE DE JOGO (NAR-01)
// ---------------------------------------------------------------------------
//
// TUDO NESTE BLOCO E LINHA OBSERVADA: nenhuma chamada a checkBand aqui, nenhuma
// entrada em expectBands. A banda nasce no plano 26-03, depois de a referencia
// externa (STACK.md secao 5) ser derivada por escrito. Este bloco so mede.
//
// OS TRES BUCKETS, em segundos de timeSec de SimEvent e NUNCA em state.phase: a
// segunda fronteira do enum interno da engine vale 1500s (LATE_PHASE_AT), nao
// 1200s, entao usar state.phase como atalho mediria outra grandeza.

/** Os tres buckets de fase de jogo desta instrumentacao (NAR-01). */
type FaseBucket = "faseA" | "faseB" | "faseC";
const FASE_BUCKETS: readonly FaseBucket[] = ["faseA", "faseB", "faseC"];

/** Rotulo pt-BR de cada bucket, so para impressao no relatorio. */
const FASE_BUCKET_LABEL: Record<FaseBucket, string> = {
  faseA: "faseA [0:00, 14:00)",
  faseB: "faseB [14:00, 20:00)",
  faseC: "faseC [20:00, fim)",
};

/**
 * Classifica um instante de jogo no bucket de fase pela fronteira em SEGUNDOS.
 * faseA: 0 inclusive a 840 exclusive (0:00 a 14:00).
 * faseB: 840 inclusive a 1200 exclusive (14:00 a 20:00).
 * faseC: 1200 inclusive ao fim da partida (20:00+).
 */
function faseDoInstante(timeSec: number): FaseBucket {
  if (timeSec < 840) return "faseA";
  if (timeSec < 1200) return "faseB";
  return "faseC";
}

/**
 * Exposicao por bucket, em MINUTOS, derivada de `durationSec` da propria partida.
 * E o que separa esta metrica de uma media global (Anti-pattern do 26-RESEARCH.md:
 * "gate de densidade global em vez de por fase"): uma partida que termina aos 18 min
 * tem exposicao ZERO no bucket faseC, e o CHAMADOR (nunca esta funcao) decide se uma
 * exposicao zero entra ou nao na serie -- aqui e funcao pura, sem decisao de filtro.
 */
function exposicaoPorFase(durationSec: number): Record<FaseBucket, number> {
  return {
    faseA: Math.min(durationSec, 840) / 60,
    faseB: Math.min(Math.max(durationSec - 840, 0), 360) / 60,
    faseC: Math.max(durationSec - 1200, 0) / 60,
  };
}

/**
 * O CONJUNTO COMPARAVEL: os tipos de evento com contraparte no dataset externo
 * (STACK.md secao 5, que conta abates, torres, dragoes, arautos, larvas, baroes,
 * inibidores e Elder de partidas pro reais). Tres familias:
 *
 *   - abates: tipos que a engine emite UMA VEZ POR MORTE, e apenas eles. `solo_kill`
 *     e emitido desde a Task 4 da linha calendario-e-volume: o all-in de rota
 *     (resolveLaneAllIn) usa "solo_kill" no top e no mid, e "kill" no bot;
 *     resolvePickoff segue usando "gank" ou "kill". `dive` esta na uniao de EventKind
 *     mas nunca e emitido como `SimEvent.kind` hoje (so existe como classificacao
 *     interna de updateLaneState) -- entra na lista por completude semantica
 *     (representaria 1 morte, se um dia emitido), mas hoje contribui zero.
 *   - torres: tipos que a engine emite uma vez por ESTRUTURA DE TORRE DERRUBADA,
 *     incluindo o caminho da torre do Nexus que o arquivo ja trata na serie
 *     `towersAt20Full`: `first_tower` e o alias da primeira torre da partida inteira
 *     (FIRST_TOWER_KINDS acima), `nexus_exposed` e a SEGUNDA torre do Nexus de um
 *     lado e um `tower_destroyed` com o ticker de `TICKER_TORRE_DO_NEXUS` e a
 *     PRIMEIRA.
 *   - objetivosEpicos: dragao, arauto (Herald), larvas (voidgrubs), Barao e Elder
 *     tomados ou roubados, mais inibidor destruido.
 *
 * FICAM FORA, com a razao ao lado: os tipos de luta sem desfecho (`dragon_fight`,
 * `baron_fight`, `elder_fight`), o alerta de torre em risco (`tower_low`), as placas
 * (`plate_taken`), a camada contextual pt-BR (`ctx_*`), o evento de fim de jogo
 * (`gg`) e os tipos de MULTI ABATE (`double_kill`..`penta_kill`) -- o dataset externo
 * nao registra nenhum deles, e o multi abate em particular acompanha um abate que ja
 * teve chance de ser contado por outro tipo da familia (o abate do MAIOR matador de
 * uma luta some do individual e vira SOMENTE o resumo de multikill).
 */
const EVENT_KINDS_COMPARAVEIS: Record<"abates" | "torres" | "objetivosEpicos", readonly EventKind[]> = {
  abates: ["kill", "first_blood", "gank", "shutdown", "solo_kill", "dive"],
  torres: ["tower_destroyed", "first_tower", "nexus_exposed"],
  objetivosEpicos: [
    "dragon_taken",
    "dragon_steal",
    "herald_taken",
    "voidgrubs_taken",
    "baron_taken",
    "baron_steal",
    "elder_taken",
    "elder_steal",
    "inhibitor_destroyed",
  ],
};

/** Lookup invertido de EVENT_KINDS_COMPARAVEIS, kind -> familia, O(1) por evento. */
const FAMILIA_POR_KIND: Partial<Record<EventKind, keyof typeof EVENT_KINDS_COMPARAVEIS>> = (() => {
  const m: Partial<Record<EventKind, keyof typeof EVENT_KINDS_COMPARAVEIS>> = {};
  for (const familia of Object.keys(EVENT_KINDS_COMPARAVEIS) as (keyof typeof EVENT_KINDS_COMPARAVEIS)[]) {
    for (const kind of EVENT_KINDS_COMPARAVEIS[familia]) m[kind] = familia;
  }
  return m;
})();

/** Resultado de `contarEventosPorFase`: as duas densidades e a mistura, por bucket. */
interface ContagemPorFase {
  visivel: Record<FaseBucket, number>;
  comparavel: Record<FaseBucket, number>;
  porKind: Record<FaseBucket, Partial<Record<EventKind, number>>>;
  /** Soma de eventos da familia `abates`, agregada nos tres buckets (para a prova do mapeamento). */
  abatesComparaveis: number;
  /** Soma de eventos da familia `torres`, agregada nos tres buckets (para a prova do mapeamento). */
  torresComparaveis: number;
}

/**
 * Conta os eventos de uma timeline por bucket de fase: a contagem VISIVEL (todo
 * EventKind, o playback inteiro, D-01 do CONTEXT.md: nenhum kind interno vira
 * SimEvent sem ja ser visivel), a COMPARAVEL (so os tipos de EVENT_KINDS_COMPARAVEIS)
 * e a mistura de tipos por bucket (para a tabela de composicao do relatorio).
 */
function contarEventosPorFase(timeline: readonly SimEvent[]): ContagemPorFase {
  const visivel: Record<FaseBucket, number> = { faseA: 0, faseB: 0, faseC: 0 };
  const comparavel: Record<FaseBucket, number> = { faseA: 0, faseB: 0, faseC: 0 };
  const porKind: Record<FaseBucket, Partial<Record<EventKind, number>>> = {
    faseA: {},
    faseB: {},
    faseC: {},
  };
  let abatesComparaveis = 0;
  let torresComparaveis = 0;
  for (const ev of timeline) {
    const bucket = faseDoInstante(ev.timeSec);
    visivel[bucket]++;
    porKind[bucket][ev.kind] = (porKind[bucket][ev.kind] ?? 0) + 1;
    const familia = FAMILIA_POR_KIND[ev.kind];
    if (familia) {
      comparavel[bucket]++;
      if (familia === "abates") abatesComparaveis++;
      else if (familia === "torres") torresComparaveis++;
    }
  }
  return { visivel, comparavel, porKind, abatesComparaveis, torresComparaveis };
}

// ---------------------------------------------------------------------------
// analyse: acumula as metricas de ritmo de uma partida
// ---------------------------------------------------------------------------

function analyseMatch(res: SimulationResult, st: TierStats): void {
  st.games++;
  if (res.winner === "user") st.userWins++;

  st.durationSec.push(res.durationSec);
  const minutes = res.durationSec / 60;

  const winnerSide: Side = res.winner;

  const killsUserFinal = res.finalState.user.kills;
  const killsRivalFinal = res.finalState.rival.kills;
  const towersUserFinal = res.finalState.user.towersDestroyed;
  const towersRivalFinal = res.finalState.rival.towersDestroyed;

  const killsWinnerFinal = winnerSide === "user" ? killsUserFinal : killsRivalFinal;
  const killsLoserFinal = winnerSide === "user" ? killsRivalFinal : killsUserFinal;
  const towersWinnerFinal = winnerSide === "user" ? towersUserFinal : towersRivalFinal;
  const towersLoserFinal = winnerSide === "user" ? towersRivalFinal : towersUserFinal;

  st.killsTotal.push(killsUserFinal + killsRivalFinal);
  st.killsWinner.push(killsWinnerFinal);
  st.killsLoser.push(killsLoserFinal);
  st.towersTotal.push(towersUserFinal + towersRivalFinal);
  st.towersWinner.push(towersWinnerFinal);
  st.towersLoser.push(towersLoserFinal);

  // --- serie de dispersao da Fase 25B: torres por minuto POR PARTIDA ---
  st.towersPerMinPerGame.push((towersUserFinal + towersRivalFinal) / minutes);

  // --- CONTAGEM COMPLETA DE TORRES (Fase 25B, onda 3) ---
  // Ver o bloco de justificativa no campo towersTotalFull de TierStats. As torres do
  // Nexus que um lado derrubou sao lidas do ESTADO FINAL como `2 - nexusTurretsAlive`
  // do adversario, que e exatamente a linha observada de D-25-04 instrumentada pela
  // onda 1. Nenhuma simulacao nova e paga: o estado final ja esta em maos.
  const nexusTurretsUser = 2 - res.finalState.rival.nexusTurretsAlive;
  const nexusTurretsRival = 2 - res.finalState.user.nexusTurretsAlive;
  const towersUserFull = towersUserFinal + nexusTurretsUser;
  const towersRivalFull = towersRivalFinal + nexusTurretsRival;
  const towersWinnerFull = winnerSide === "user" ? towersUserFull : towersRivalFull;
  const towersLoserFull = winnerSide === "user" ? towersRivalFull : towersUserFull;

  st.towersTotalFull.push(towersUserFull + towersRivalFull);
  st.towersWinnerFull.push(towersWinnerFull);
  st.towersLoserFull.push(towersLoserFull);
  st.towersPerMinFullPerGame.push((towersUserFull + towersRivalFull) / minutes);

  // --- FASE 26, PLANO 26-01, TASK 2: densidade de eventos por fase de jogo (NAR-01) ---
  // TUDO OBSERVADO: nada aqui alimenta checkBand/expectBands neste plano.
  {
    const exposicao = exposicaoPorFase(res.durationSec);
    const contagem = contarEventosPorFase(res.timeline);
    for (const bucket of FASE_BUCKETS) {
      // Exposicao zero NAO entra na serie (nem como zero): ver exposicaoPorFase.
      if (exposicao[bucket] > 0) {
        st.densidadeVisivelPorFase[bucket].push(contagem.visivel[bucket] / exposicao[bucket]);
        st.densidadeComparavelPorFase[bucket].push(contagem.comparavel[bucket] / exposicao[bucket]);
      }
      for (const [kind, n] of Object.entries(contagem.porKind[bucket])) {
        const k = kind as EventKind;
        st.eventosPorFasePorKind[bucket][k] = (st.eventosPorFasePorKind[bucket][k] ?? 0) + (n ?? 0);
      }
    }
    // A PROVA DO MAPEAMENTO: as duas identidades contra o estado final. Um residuo aqui
    // e ESPERADO e ja documentado (ver comentario de EVENT_KINDS_COMPARAVEIS acima e o
    // bloco de relatorio abaixo): decorateMultikill (engine.ts) so resume o MAIOR matador
    // do lado vencedor por luta, e o Arauto derruba estrutura de verdade mas emite SEMPRE
    // kind=tower_low (structures.ts:1138, criterio OBJ-01/heuristica A3, o mesmo residuo
    // que D-25-04 ja registra para towersDestroyed). As duas lacunas sao pre-existentes a
    // este plano; a contagem abaixo so as TORNA VISIVEIS, nunca as inventa.
    if (contagem.abatesComparaveis !== killsUserFinal + killsRivalFinal) st.identidadeAbatesFalhas++;
    if (contagem.torresComparaveis !== towersUserFull + towersRivalFull) st.identidadeTorresFalhas++;
  }

  // --- torres/abates ate 20:00 (ev.score e cumulativo: o ultimo evento <= 1200s
  //     ja reflete o total acumulado ate ali) ---
  const scoreAt20Event = lastEventAtOrBefore(res, 1200);
  if (scoreAt20Event) {
    st.towersAt20.push(scoreAt20Event.score.userTowers + scoreAt20Event.score.rivalTowers);
    // Contagem completa aos 20:00: `ev.score` le `towersDestroyed` e portanto carrega o
    // mesmo erro, entao as torres do Nexus caidas ate 1200 s so podem sair da timeline.
    // Cada `nexus_exposed` e a SEGUNDA torre do Nexus daquele lado e cada
    // `tower_destroyed` com o ticker de torre do Nexus e a primeira.
    // MEDIDO: esta soma e ZERO em 800 de 800 partidas, por razao estrutural (uma torre
    // do Nexus exige um inibidor caido, e inibidor antes de 16:00 e classe `nearZero`).
    let nexusTurretsAte20 = 0;
    for (const ev of res.timeline) {
      if (ev.timeSec > 1200) break;
      if (ev.kind === "nexus_exposed") nexusTurretsAte20++;
      else if (ev.kind === "tower_destroyed" && ev.ticker.includes(TICKER_TORRE_DO_NEXUS)) {
        nexusTurretsAte20++;
      }
    }
    st.towersAt20Full.push(
      scoreAt20Event.score.userTowers + scoreAt20Event.score.rivalTowers + nexusTurretsAte20
    );
    const killsAt20 = scoreAt20Event.score.userKills + scoreAt20Event.score.rivalKills;
    st.killsAt20.push(killsAt20);
    const finalKills = killsUserFinal + killsRivalFinal;
    if (finalKills > 0) st.killsAt20Frac.push(killsAt20 / finalKills);
  }

  // --- sem nenhum abate ate 10:00 (score cumulativo: olhar o ultimo evento <= 600s) ---
  const scoreAt10Event = lastEventAtOrBefore(res, 600);
  const killsAt10 = scoreAt10Event ? scoreAt10Event.score.userKills + scoreAt10Event.score.rivalKills : 0;
  if (killsAt10 === 0) st.noKillsBefore10++;

  // --- primeira torre ---
  const firstTowerSec = firstEventTime(res, FIRST_TOWER_KINDS);
  if (Number.isFinite(firstTowerSec)) {
    st.firstTowerSec.push(firstTowerSec);
    if (firstTowerSec < 420) st.firstTowerBefore420++;
  }

  // --- dependencia de Baron e da rampa (OBSERVADO: PACE-06 e criterio 1 da Fase 25) ---
  // Tudo lido da timeline, sem instrumentar a engine. O primeiro Baron e o menor timeSec
  // entre baron_taken e baron_steal, ou infinito quando a partida nao teve Baron.
  //
  // Por que esta metrica prova PACE-01 por construcao: Baron antes de 20:00 e ilegal desde
  // a v2.0 (assert duro deste mesmo arquivo, e objectives.ts:229), entao TODA torre que cai
  // antes do primeiro Baron caiu sem buff de objetivo. A fracao complementar mede exatamente
  // o deslocamento temporal que a pesquisa isolou: 93 por cento das passagens do gate de
  // pressao estrutural acontecem depois dos 20 minutos.
  const firstBaronSec = firstEventTime(res, BARON_KINDS);
  if (Number.isFinite(firstBaronSec)) st.firstBaronSec.push(firstBaronSec);
  if (Number.isFinite(firstTowerSec)) {
    st.firstTowerObserved++;
    if (firstTowerSec > firstBaronSec) st.firstTowerAfterFirstBaron++;
    if (firstTowerSec >= LATE_RAMP_ATIVA_SEC) st.firstTowerLateRampAtiva++;
    if (firstTowerSec >= LATE_RAMP_SUFICIENTE_SEC) st.firstTowerLateRampSuficiente++;
  }

  // --- derivadas do bloco de ordem de entrada (OBSERVADAS, criterio 5 da Fase 25) ---
  // Lidas do estado final no mesmo formato de scripts/diagnose-engine.ts:208-212.
  st.baronsPerGame.push(res.finalState.user.baronsTaken + res.finalState.rival.baronsTaken);
  if (res.finalState.user.soul !== null || res.finalState.rival.soul !== null) st.soulGames++;
  if (res.finalState.user.elderCount + res.finalState.rival.elderCount > 0) st.elderGames++;
  if (res.durationSec >= 3600) st.capGames++;

  // --- placas e alertas de torre em risco ---
  let plates = 0;
  let towerLow = 0;
  for (const ev of res.timeline) {
    if (ev.kind === "plate_taken") plates++;
    if (ev.kind === "tower_low") towerLow++;
  }
  st.platesPerGame.push(plates);
  st.towerLowPerGame.push(towerLow);

  // --- ouro ---
  const goldUserFinal = res.finalState.user.gold;
  const goldRivalFinal = res.finalState.rival.gold;
  st.goldFinalUser.push(goldUserFinal);
  st.goldFinalRival.push(goldRivalFinal);
  st.goldPerMinTeam.push((goldUserFinal + goldRivalFinal) / 2 / minutes);
  const goldWinnerFinal = winnerSide === "user" ? goldUserFinal : goldRivalFinal;
  const goldLoserFinal = winnerSide === "user" ? goldRivalFinal : goldUserFinal;
  st.goldPerMinWinner.push(goldWinnerFinal / minutes);
  st.goldPerMinLoser.push(goldLoserFinal / minutes);
  // --- series de dispersao da Fase 25B: ouro final POR DESFECHO, nunca por lado ---
  st.goldFinalWinner.push(goldWinnerFinal);
  st.goldFinalLoser.push(goldLoserFinal);

  // --- decima primeira linha de dispersao: dinamica da partida (Fase 25B) ---
  st.dinamica[classificarDinamica(res)]++;

  // --- insumo de FORMA (Fase 25B): rotas do perdedor limpas por inteiro, do estado final ---
  const loserSide: Side = winnerSide === "user" ? "rival" : "user";
  st.rotasLimpasDoPerdedor.push(rotasLimpasPorInteiro(res.finalState[loserSide]));

  // --- assistencias do ADC (media dos dois lados) ---
  st.adcAssists.push((res.finalState.user.players.adc.assists + res.finalState.rival.players.adc.assists) / 2);

  // --- acerto do favorito aos 20:00 ---
  if (scoreAt20Event && scoreAt20Event.winProbUserAfter !== 0.5) {
    const favoriteSide: Side = scoreAt20Event.winProbUserAfter > 0.5 ? "user" : "rival";
    st.favoriteHitAt20Denom++;
    if (favoriteSide === winnerSide) st.favoriteHitAt20++;
  }

  // --- Baron antes do spawn (assert duro no Task 2; aqui so contagem) ---
  for (const ev of res.timeline) {
    if ((ev.kind === "baron_taken" || ev.kind === "baron_steal") && ev.timeSec < 1200) {
      st.baronBeforeSpawn++;
    }
  }

  // --- trocas de favorito (OBSERVADO, sem banda -- WPB-02) ---
  let switches = 0;
  let lastSide: Side | null = null;
  for (const ev of res.timeline) {
    if (ev.winProbUserAfter === 0.5) continue;
    const side: Side = ev.winProbUserAfter > 0.5 ? "user" : "rival";
    if (lastSide !== null && side !== lastSide) switches++;
    lastSide = side;
  }
  st.favoriteSwitches.push(switches);
}

// ---------------------------------------------------------------------------
// runTier: laco deterministico seed=i (opcionalmente com subamostra de clamps)
// ---------------------------------------------------------------------------

/**
 * `partidasLift` (Fase 25C, onda 2) e o coletor OPCIONAL das linhas do tempo na forma que
 * a matriz de lift consome. Ele e passado APENAS pelo tier EQUILIBRADO: reter as timelines
 * dos seis tiers custaria memoria a toa, e as tres bandas de acoplamento so sao avaliadas
 * no tier de referencia de qualquer forma. Nenhuma simulacao extra e paga por este
 * parametro, porque a partida ja foi simulada aqui.
 */
function runTier(tier: Tier, clampStats?: ClampStats, partidasLift?: LiftMatch[]): TierStats {
  const st = emptyStats();
  for (let seed = 0; seed < N; seed++) {
    // INVARIANTE: seed = i por partida, nunca seed compartilhada; sem Math.random
    const res = simulateMatch(roster("u", tier.us), roster("r", tier.rs), mulberry32(seed));
    analyseMatch(res, st);
    if (clampStats && seed < CLAMP_SUBSAMPLE_GAMES) {
      sampleGoldMultClamps(res, clampStats);
    }
    if (partidasLift) partidasLift.push(paraLift(res));
  }
  return st;
}

// ---------------------------------------------------------------------------
// Helpers de formatacao pt-BR
// ---------------------------------------------------------------------------

function mmss(sec: number): string {
  if (!Number.isFinite(sec)) return "n/a";
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

function pctOf(n: number, total: number): string {
  return total === 0 ? "0.0%" : `${((n / total) * 100).toFixed(1)}%`;
}

/**
 * Linha de quatro colunas (metrica, valor medido, banda final de aceite, DENTRO ou FORA)
 * do bloco de observacao do criterio 5 da Fase 25. Formata um BandResult SEM o vocabulario
 * de banda asserida ([OK]/[FALHA]), porque nenhuma destas linhas reprova nada.
 */
function ordemEntradaLinha(r: BandResult): string {
  const banda = `[${r.band.floor}, ${r.band.ceiling}]`;
  return (
    `  ${r.label.padEnd(46)} ${r.value.toFixed(3).padStart(9)}  ${banda.padEnd(16)} ` +
    `${r.ok ? "DENTRO" : "FORA"}\n`
  );
}

function summaryLine(label: string, values: number[]): string {
  const s = summarize(values);
  return `  ${label}: media ${s.mean.toFixed(2)} sd ${s.sd.toFixed(2)} | p5 ${s.p5} p25 ${s.p25} p50 ${s.p50} p75 ${s.p75} p95 ${s.p95} (n=${s.n})\n`;
}

// ---------------------------------------------------------------------------
// Relatorio por tier
// ---------------------------------------------------------------------------

function tierReportBlock(tier: Tier, st: TierStats): string {
  const sortedDuration = [...st.durationSec].sort((a, b) => a - b);
  const sortedFirstTower = [...st.firstTowerSec].sort((a, b) => a - b);

  let out = `\n=== TIER ${tier.name} (user ${tier.us} vs rival ${tier.rs}, ${st.games} jogos) ===\n`;
  out += `  win-rate user:           ${pctOf(st.userWins, st.games)}\n`;
  out += summaryLine("duracao (s)", st.durationSec);
  out += `    duracao mediana:       ${mmss(percentile(sortedDuration, 50))}\n`;
  out += summaryLine("primeira torre (s)", st.firstTowerSec);
  out += `    primeira torre p50:    ${mmss(percentile(sortedFirstTower, 50))} [amostras=${st.firstTowerSec.length}/${st.games}]\n`;
  out += summaryLine("torres por partida (total)", st.towersTotalFull);
  // AS DUAS LEITURAS LADO A LADO (Fase 25B, onda 3). A de cima, que e a que as bandas
  // de volume e taxa avaliam desde esta onda, e a CONTAGEM COMPLETA (com as duas torres
  // do Nexus de cada lado). A linha abaixo mantem visivel o contador de nove de
  // `towersDestroyed`, que segue alimentando as bandas de FORMA. Imprimir as duas e
  // obrigatorio: sem isso, alguem comparando este relatorio com um anterior a esta onda
  // leria a correcao de especificacao como mudanca de motor.
  out +=
    `    contador de nove (towersDestroyed, alimenta as bandas de FORMA): media ` +
    `${mean(st.towersTotal).toFixed(2)}  |  torres do Nexus por partida: ` +
    `${(mean(st.towersTotalFull) - mean(st.towersTotal)).toFixed(3)}\n`;
  out += summaryLine("abates por partida (total)", st.killsTotal);
  out += `  torres/abates vencedor:  ${mean(st.towersWinnerFull).toFixed(2)} / ${mean(st.killsWinner).toFixed(2)}\n`;
  out += `  torres/abates perdedor:  ${mean(st.towersLoserFull).toFixed(2)} / ${mean(st.killsLoser).toFixed(2)}\n`;
  out +=
    `    as duas contagens de torre do vencedor: completa ${mean(st.towersWinnerFull).toFixed(2)} ` +
    `contra contador de nove ${mean(st.towersWinner).toFixed(2)}\n`;
  // Ordenacao inter-camada (ROADMAP.md Fase 25 criterio 3), impressa lado a lado para que
  // o leitor veja a inversao sem precisar rodar a conta. O assert correspondente roda no
  // tier EQUILIBRADO, depois da escrita do relatorio.
  const razaoTorresTier =
    mean(st.towersLoserFull) > 0 ? mean(st.towersWinnerFull) / mean(st.towersLoserFull) : 0;
  const razaoAbatesTier = mean(st.killsLoser) > 0 ? mean(st.killsWinner) / mean(st.killsLoser) : 0;
  out +=
    `  ordenacao inter-camada:  razao de torres ${razaoTorresTier.toFixed(2)} contra razao de abates ` +
    `${razaoAbatesTier.toFixed(2)} (exigido: razao de torres MAIOR que razao de abates, Fase 25 criterio 3)\n`;
  out += `  torres aos 20:00 (amostras=${st.towersAt20Full.length}/${st.games}): media ${mean(st.towersAt20Full).toFixed(2)}\n`;
  out += `  abates aos 20:00 (amostras=${st.killsAt20.length}/${st.games}): media ${mean(st.killsAt20).toFixed(2)}\n`;
  out += `  fracao de abates ate 20:00: ${mean(st.killsAt20Frac).toFixed(3)}\n`;
  out += `  fracao de partidas sem abate ate 10:00: ${pctOf(st.noKillsBefore10, st.games)}\n`;
  out += `  placas por partida:      ${mean(st.platesPerGame).toFixed(2)}\n`;
  out += `  tower_low por partida:   ${mean(st.towerLowPerGame).toFixed(2)}\n`;
  out += `  ouro final (user/rival): ${mean(st.goldFinalUser).toFixed(0)} / ${mean(st.goldFinalRival).toFixed(0)}\n`;
  out += `  ouro/min por time:       ${mean(st.goldPerMinTeam).toFixed(1)}\n`;
  out += `  ouro/min vencedor/perdedor: ${mean(st.goldPerMinWinner).toFixed(1)} / ${mean(st.goldPerMinLoser).toFixed(1)}\n`;
  out += `  assistencias do ADC por partida: ${mean(st.adcAssists).toFixed(2)} [OBSERVADO sem campeoes atribuidos -- ver nota da banda]\n`;
  out += `  acerto do favorito aos 20:00: ${pctOf(st.favoriteHitAt20, Math.max(1, st.favoriteHitAt20Denom))} (denominador=${st.favoriteHitAt20Denom}/${st.games})\n`;
  out += `  Baron antes de 20:00 (deve ser 0): ${st.baronBeforeSpawn}\n`;
  out += `  primeira torre antes de 7:00 (deve ser 0): ${st.firstTowerBefore420}\n`;
  out += `  OBSERVADO sem banda (WPB-02, fase dona: Fase 29): trocas de favorito por partida = ${mean(st.favoriteSwitches).toFixed(2)}\n`;

  // Dependencia de Baron e da rampa de fim de jogo. OBSERVADO, sem banda: PACE-06 pede
  // "perto de zero" e a leitura util e a comparacao antes e depois, nao um limiar inventado.
  const denom = Math.max(1, st.firstTowerObserved);
  const sortedFirstBaron = [...st.firstBaronSec].sort((a, b) => a - b);
  out += `  OBSERVADO sem banda (PACE-06 e criterio 1 da Fase 25, fase dona: Fase 25), denominador = partidas com primeira torre = ${st.firstTowerObserved}/${st.games}:\n`;
  out += `    primeira torre DEPOIS do primeiro Baron:            ${pctOf(st.firstTowerAfterFirstBaron, denom)} (${st.firstTowerAfterFirstBaron}/${st.firstTowerObserved})\n`;
  out += `    primeira torre com a rampa ATIVA (>= ${LATE_RAMP_ATIVA_SEC}s, ${mmss(LATE_RAMP_ATIVA_SEC)}):   ${pctOf(st.firstTowerLateRampAtiva, denom)} (${st.firstTowerLateRampAtiva}/${st.firstTowerObserved})\n`;
  out += `    primeira torre com a rampa SUFICIENTE sozinha (>= ${LATE_RAMP_SUFICIENTE_SEC}s, ${mmss(LATE_RAMP_SUFICIENTE_SEC)}): ${pctOf(st.firstTowerLateRampSuficiente, denom)} (${st.firstTowerLateRampSuficiente}/${st.firstTowerObserved})\n`;
  out += `    primeiro Baron mediano:                            ${mmss(percentile(sortedFirstBaron, 50))} [amostras=${st.firstBaronSec.length}/${st.games}]\n`;
  return out;
}

// ---------------------------------------------------------------------------
// Harness principal
// ---------------------------------------------------------------------------

describe("calibrate-pace -- gate de ritmo com bandas de dois lados (Fase 23 / INST-03, INST-05, INST-08)", () => {
  it("roda N partidas deterministicas por tier, mede as taxas-raiz e escreve o relatorio", () => {
    const clampStats = emptyClampStats();
    const results = new Map<string, TierStats>();
    /** Linhas do tempo do tier EQUILIBRADO, retidas para as tres bandas de ACOPLAMENTO. */
    const partidasLift: LiftMatch[] = [];

    for (const tier of TIERS) {
      const eqTier = tier.name === "EQUILIBRADO";
      results.set(tier.name, runTier(tier, eqTier ? clampStats : undefined, eqTier ? partidasLift : undefined));
    }

    let out = "RELATORIO DE CALIBRACAO DE RITMO: gate de dois lados (Fase 23 / INST-03, INST-05, INST-08)\n";
    out += "===============================================================================\n";
    out += "\nESTE GATE NASCE VERMELHO DE PROPOSITO (DEC-02). A engine ainda nao foi corrigida\n";
    out += "pelas Fases 24-29; cada banda vermelha abaixo carrega a fase dona do conserto.\n";
    out += "\nPRINCIPIO DE ESCOPO (REQUIREMENTS.md): so metrica RAIZ (taxa) vira banda. Duracao,\n";
    out += "baroes, Alma, Elder, abates totais e torres totais sao OBSERVADOS aqui, nunca\n";
    out += "gateados -- corrigir a taxa puxa a metrica derivada sozinha.\n";

    for (const tier of TIERS) {
      out += tierReportBlock(tier, results.get(tier.name)!);
    }

    out += "\n=== DEPENDENCIA DE BARON E DA RAMPA (PACE-06 e criterio 1 da Fase 25, OBSERVADO) ===\n";
    out +=
      "As tres fracoes impressas em cada tier acima sao OBSERVACAO PURA: nenhuma delas vira\n" +
      "banda asserida nesta fase. PACE-06 pede que a fracao dependente da rampa caia para\n" +
      "perto de zero SEM alterar a rampa, e a leitura util e a comparacao antes e depois,\n" +
      "nao um limiar inventado.\n";
    out +=
      "\nPor que a metrica prova PACE-01 por construcao: Baron antes de 20:00 e ilegal desde a\n" +
      "v2.0, entao toda torre que cai antes do primeiro Baron caiu sem buff de objetivo.\n";
    out +=
      `\nOs dois instantes usados vem de src/sim/structures.ts, sem alterar nada la:\n` +
      `  rampa ATIVA a partir de ${LATE_RAMP_ATIVA_SEC}s (${mmss(LATE_RAMP_ATIVA_SEC)}): structures.ts:694, lateRamp = max(0, (t - 2100) / 900)\n` +
      `  rampa SUFICIENTE sozinha a partir de ${LATE_RAMP_SUFICIENTE_SEC}s (${mmss(LATE_RAMP_SUFICIENTE_SEC)}): structures.ts:699, o gate exige force acima de 0,18,\n` +
      `    e com pressao zero, sem Baron e sem voidgrubs vale 2100 + 0,18 x 900 = 2262\n`;
    out +=
      "\nLeitura medida por sonda no 25-RESEARCH.md, para o numero de hoje ter companhia:\n" +
      "69,5 por cento das partidas so veem a primeira torre DEPOIS do primeiro Baron, e\n" +
      "apenas 18,4 por cento das avaliacoes do gate de pressao acontecem com Baron ativo.\n";

    // -------------------------------------------------------------------------
    // Metricas derivadas para as bandas (taxas-raiz, avaliadas no tier EQUILIBRADO
    // exceto onde indicado). Nenhuma metrica derivada de duracao/baroes/Alma/Elder/
    // abates-totais/torres-totais entra aqui -- Principio de escopo, REQUIREMENTS.md.
    // -------------------------------------------------------------------------
    const eq = results.get("EQUILIBRADO")!;
    const gap30 = results.get("GAP-30")!;

    // CONTAGEM COMPLETA nas metricas de VOLUME e TAXA (Fase 25B, onda 3): a serie
    // usada aqui e `towersTotalFull`, com as duas torres do Nexus de cada lado, porque
    // a referencia externa das bandas de torre conta ONZE torres por lado. Ver o bloco
    // de justificativa no campo `towersTotalFull` de TierStats. As bandas de FORMA
    // seguem lendo `towersWinner` e `towersLoser`, que sao o contador de nove.
    const towersPerMinArr = eq.towersTotalFull.map((t, i) => t / (eq.durationSec[i] / 60));
    const killsPerMinArr = eq.killsTotal.map((k, i) => k / (eq.durationSec[i] / 60));
    const sortedFirstTowerEq = [...eq.firstTowerSec].sort((a, b) => a - b);

    const torresMin = mean(towersPerMinArr);
    const torresAt20 = mean(eq.towersAt20Full);
    const primeiraTorreMediana = percentile(sortedFirstTowerEq, 50);
    const placasPorPartida = mean(eq.platesPerGame);
    const abatesMin = mean(killsPerMinArr);
    const razaoAbatesVencedorPerdedor = mean(eq.killsWinner) / mean(eq.killsLoser);
    // Razao de torres vencedor sobre perdedor (Fase 25, criterio 3 do roadmap).
    // Forma EXATAMENTE igual a da razao de abates acima (media do vencedor dividida
    // pela media do perdedor) para que as duas sejam comparaveis linha a linha: e
    // essa comparacao que o assert de ordenacao inter-camada faz no fim do arquivo.
    // Guarda de divisao por zero no mesmo padrao ja usado para acertoFavorito20.
    //
    // CONTAGEM COMPLETA NOS DOIS LADOS DO QUOCIENTE (Fase 25B, onda 3). A razao e
    // quociente, entao corrigir numerador e denominador move o valor de um jeito que
    // nao e obvio: as duas torres do Nexus somam quase sempre 2 ao vencedor e quase
    // sempre 0 ao perdedor, o que EMPURRA a razao para cima. O efeito foi medido antes
    // e depois e esta registrado em docs/diagnostics/25B-sweep.md secao 5.
    const mediaTorresPerdedor = mean(eq.towersLoserFull);
    const razaoTorresVencedorPerdedor =
      mediaTorresPerdedor > 0 ? mean(eq.towersWinnerFull) / mediaTorresPerdedor : 0;
    // `razao torres sobre abates` ficou de fora da correcao da Fase 25B, onda 3, de
    // proposito: ela sofria do MESMO erro de especificacao (a referencia de pro play
    // conta onze torres por lado e o numerador contava nove), mas a banda tinha dono
    // Fase 26 e a decisao daquela onda nao a alcancava. Naquela onda ela valia 0,285 sob
    // a contagem completa contra 0,233 sob o contador de nove.
    //
    // CORRIGIDA NA TASK 8 DA LINHA calendario-e-volume (regra 2 do brief: banda com
    // fonte real que ficou mais perto da referencia e atualizada para a referencia
    // real). A referencia (STACK.md secao 5: 11,9 torres sobre 27 abates) conta as
    // torres do Nexus, entao o numerador passa a ser `towersTotalFull`, como ja era em
    // torres/min e torres aos 20:00, e como a Task 7b fez em `torres por partida` de
    // calibrate:realism. A banda `[0,330; 0,550]` nao muda. Medido nas duas leituras,
    // 50e1f68 contra o motor da Task 8: contador de nove 0,235 para 0,309, contagem
    // completa 0,285 para 0,385. O contador de nove segue impresso como observacao.
    const razaoTorresAbates = mean(eq.towersTotalFull) / mean(eq.killsTotal);
    const razaoTorresAbatesContadorDeNove = mean(eq.towersTotal) / mean(eq.killsTotal);
    const fracaoAbates20 = mean(eq.killsAt20Frac);
    const fracaoSemAbate10 = eq.noKillsBefore10 / eq.games;
    const ouroMinTime = mean(eq.goldPerMinTeam);
    const razaoOuroMinVencedorPerdedor = mean(eq.goldPerMinWinner) / mean(eq.goldPerMinLoser);
    const assistsADC = mean(eq.adcAssists);
    const acertoFavorito20 = eq.favoriteHitAt20Denom > 0 ? eq.favoriteHitAt20 / eq.favoriteHitAt20Denom : 0;
    const winRateEq = eq.userWins / eq.games;
    const winRateGap30 = gap30.userWins / gap30.games;

    // -------------------------------------------------------------------------
    // Bandas de dois lados (INST-03): as catorze da tabela do Plano 23-04 Task 2.
    // Toda comparacao numerica de banda passa por checkBand -- nenhum assert de
    // um lado so (so piso ou so teto) solto neste arquivo (Pitfall 1 do 23-RESEARCH.md).
    // -------------------------------------------------------------------------
    const bandResults: BandResult[] = [];

    bandResults.push(
      checkBand("torres/min", torresMin, {
        floor: 0.3,
        ceiling: 0.45,
        target: 0.37,
        source: "STACK.md secao 7 (OE 2023-2025, N=5.958)",
        owner: "Fase 25",
      })
    );
    bandResults.push(
      checkBand("torres aos 20:00", torresAt20, {
        floor: 2.5,
        ceiling: 5.0,
        target: 3.72,
        source: "STACK.md secao 7",
        owner: "Fase 25",
      })
    );
    bandResults.push(
      checkBand("mediana da primeira torre (s)", primeiraTorreMediana, {
        floor: 780,
        ceiling: 1140,
        target: 970,
        source: "STACK.md secao 7 (13:00 a 19:00; ref 15:04 a 16:37)",
        owner: "Fase 25",
      })
    );
    bandResults.push(
      checkBand("placas por partida", placasPorPartida, {
        floor: 5,
        ceiling: 12,
        target: 8.2,
        source: "STACK.md secao 7 (de 30 possiveis)",
        owner: "Fase 25",
      })
    );
    // BANDA NOVA DA FASE 25 (criterio 3 do roadmap). Ela nao existia: towersWinner e
    // towersLoser ja eram coletados e impressos, mas a razao nunca passava por checkBand,
    // entao o criterio 3 era texto e nao reprovava nada.
    //
    // Os tres numeros que a pesquisa mediu, e que precisam estar onde quem calibrar vai ler:
    //   - hoje a engine mede 1,44: a camada estrutural e a que MENOS separa vencedor de
    //     perdedor das tres camadas, quando deveria ser a que MAIS separa;
    //   - um canal absoluto de cerco SIMETRICO PIORA esta razao (medido 1,32), porque dano
    //     igual para os dois lados encolhe a separacao: o perdedor sai de 4,06 para 5,91
    //     torres quando a referencia pro e 2,75. O conserto medido e um termo de vantagem
    //     dentro do acumulo, com piso E teto, e nao mais acumulo;
    //   - a referencia 3,35 vem de vencedor 9,15 contra perdedor 2,75 (STACK.md secao 3 linha 10).
    //
    // RESSALVA DE ESCALADA (suposicao A5 do 25-RESEARCH.md): a referencia 3,35 vem de pro
    // play, onde os times sao proximos mas nao identicos, e o tier EQUILIBRADO deste harness
    // e um espelho perfeito 75 contra 75, que pode ter teto natural mais baixo. Se ao fim da
    // Fase 25 o valor medido ficar preso abaixo de 2,5 com todo o resto verde, a acao correta
    // e REPORTAR E ESCALAR a decisao de banda, nunca torcer a constante ate o numero aparecer.
    //
    // POR QUE ESTA BANDA E AVALIADA SO NO TIER EQUILIBRADO, decidido no plano 25-06 apos a
    // pesquisa recomendar olhar tambem o GAP-LEVE como proxy de dois times pro ligeiramente
    // diferentes. Medido no ponto de operacao da Fase 25: EQUILIBRADO 3,393 (dentro) e
    // GAP-LEVE 5,60 (acima do teto 4,5). Os dois numeros estao certos e nao ha contradicao:
    // a referencia 3,35 e MEDIA sobre partidas pro reais, que incluem tanto jogos parelhos
    // quanto desiguais, e um tier com gap de habilidade DEVE separar mais que um parelho,
    // porque e exatamente isso que um gap significa. Avaliar a mesma banda num tier de gap
    // exigiria que 10 pontos de diferenca de roster nao produzissem separacao nenhuma, o que
    // contradiz o proprio desenho dos tiers. O par fica registrado como observacao honesta em
    // docs/diagnostics/25-sweep.md secao 4, sem torcer nenhum dos dois lados e sem virar banda
    // nova nesta fase.
    bandResults.push(
      checkBand("razao de torres vencedor sobre perdedor", razaoTorresVencedorPerdedor, {
        floor: 2.5,
        ceiling: 4.5,
        target: 3.35,
        source:
          "STACK.md secao 3 linha 10 (vencedor 9,15 e perdedor 2,75 dao 3,33) e secao 7; " +
          "ROADMAP.md Fase 25 criterio 3",
        owner: "Fase 25",
      })
    );
    bandResults.push(
      checkBand("abates/min", abatesMin, {
        floor: 0.7,
        ceiling: 1.0,
        target: 0.84,
        source: "STACK.md secao 3 linha 8",
        owner: "Fase 26",
      })
    );
    // Task 9 (luta-mapa-vitoria): as duas bandas abaixo tem fonte real no STACK.md e
    // seguem fora no motor novo (abates 1,044 -> 2,973 contra 2,15, que cruzou do piso
    // para o teto; torres sobre abates 0,230 -> 0,235 contra 0,41, deslocamento no
    // ruido). A banda ja e a da referencia real (a de abates e identica a
    // REALISM_BAND_SPECS killRatioWinnerLoser) e nao mudou: MANTIDAS VERMELHAS, nada
    // afrouxado, neste fixture sintetico 75 contra 75. Registro em
    // docs/diagnostics/luta-mapa-vitoria-bandas.md.
    //
    // Task 8 (calendario-e-volume): as duas ficaram mais perto da referencia. Abates
    // 2,973 -> 2,864, segue vermelha, banda intacta (ja e a real; no caminho do app,
    // calibrate:realism mede 2,320, dentro). Torres sobre abates: o numerador passou a
    // contar as torres do Nexus, como a referencia (ver o comentario de
    // razaoTorresAbates), 0,285 -> 0,385 na contagem completa, dentro; banda intacta.
    // Registro em docs/diagnostics/calendario-e-volume-bandas.md.
    bandResults.push(
      checkBand("razao de abates vencedor sobre perdedor", razaoAbatesVencedorPerdedor, {
        floor: 1.8,
        ceiling: 2.6,
        target: 2.15,
        source: "STACK.md secao 7; igual a REALISM_BAND_SPECS killRatioWinnerLoser",
        owner: "Fase 26",
      })
    );
    bandResults.push(
      checkBand("razao torres sobre abates", razaoTorresAbates, {
        floor: 0.33,
        ceiling: 0.55,
        target: 0.41,
        source: "STACK.md secao 7 (pro medida 0,41, com as torres do Nexus)",
        owner: "Fase 26",
      })
    );
    bandResults.push(
      checkBand("fracao de abates ate 20:00", fracaoAbates20, {
        floor: 0.32,
        ceiling: 0.46,
        target: 0.39,
        source: "ROADMAP.md Fase 26 criterio 3 (STACK.md secao 3)",
        owner: "Fase 26",
      })
    );
    bandResults.push(
      checkBand("fracao de partidas sem abate ate 10:00", fracaoSemAbate10, {
        floor: 0.05,
        ceiling: 0.2,
        target: 0.11,
        source: "STACK.md secao 7 (OE 2024+2025, N=4.491)",
        owner: "Fase 26",
      })
    );
    bandResults.push(
      checkBand("ouro/min por time", ouroMinTime, {
        floor: 1500,
        ceiling: 2100,
        target: 1833,
        source: "REQUIREMENTS.md ECO-01 (ref STACK.md secao 3 linha 25)",
        owner: "Fase 27",
      })
    );
    bandResults.push(
      checkBand("razao de ouro/min vencedor sobre perdedor", razaoOuroMinVencedorPerdedor, {
        floor: 1.1,
        ceiling: 1.3,
        target: 1.19,
        source: "REQUIREMENTS.md ECO-02 (ref STACK.md secao 3 linha 26)",
        owner: "Fase 27",
      })
    );
    // REATRIBUICAO DE FASE DONA (Fase 24, Plano 24-01): de Fase 24 para Fase 26.
    // Piso, teto e alvo ficam byte a byte iguais; so o dono e a nota de fonte mudam.
    // Justificativa aritmetica, com os numeros:
    //   - a banda e DERIVADA: contagem por partida e o produto de uma taxa por um volume;
    //   - a taxa (assistencias do ADC por abate do time) e o que a Fase 24 controla, e
    //     ganhou banda propria e ASSERIDA em scripts/calibrate-assists.ts [0,28 a 0,52,
    //     alvo 0,39], derivada de STACK.md secao 4.7;
    //   - o volume e abates por partida, hoje em 87,71 (43,9 por time) contra a banda de
    //     referencia 22 a 34, e e alavanca declarada da Fase 26;
    //   - com 43,9 abates por time, caber em 4 a 8 exigiria taxa entre 0,09 e 0,18, abaixo
    //     do piso 0,28 da banda-raiz: as duas leituras sao mutuamente insatisfaziveis ate
    //     o volume entrar em banda;
    //   - a aceitacao final desta metrica derivada esta registrada no criterio 5 da Fase 30,
    //     junto das demais metricas derivadas do milestone.
    bandResults.push(
      checkBand("assistencias do ADC por partida", assistsADC, {
        floor: 4,
        ceiling: 8,
        target: 5.5,
        source:
          "STACK.md secao 7; DERIVADA (taxa vezes volume de abates): a taxa e asserida em " +
          "scripts/calibrate-assists.ts pela Fase 24, o volume e alavanca da Fase 26",
        owner: "Fase 26",
      })
    );
    bandResults.push(
      checkBand("acerto do favorito aos 20:00", acertoFavorito20, {
        floor: 0.7,
        ceiling: 0.85,
        target: 0.782,
        source: "STACK.md secao 7 (OE 2024+2025, N=4.881)",
        owner: "Fase 29",
      })
    );
    bandResults.push(
      checkBand("win-rate com gap de forca 30", winRateGap30, {
        floor: 0.8,
        ceiling: 0.97,
        target: 0.9,
        source: "teto de STACK.md secao 7; piso do tier dominante de scripts/calibrate.ts:46 (D-08)",
        owner: "Fase 28",
      })
    );

    // -------------------------------------------------------------------------
    // Relacoes metamorficas (INST-05): invariancia de nivel por PROPORCAO entre
    // pro e amador no mesmo gap, nunca valor absoluto inventado para o amador
    // (STACK.md secao 7, "Sobre o alvo de amadores": sem fonte confiavel citavel
    // para distribuicao de baixo elo). R1-R3 sao bandas de dois lados sobre a
    // diferenca COM SINAL e entram na mesma lista de bandResults do Task 2, entao
    // uma violacao delas cai na mesma falha unica de expectBands. R4 e ordenacao,
    // nao magnitude, e roda como assert proprio depois da escrita do relatorio.
    // -------------------------------------------------------------------------
    const gapLeve = results.get("GAP-LEVE")!;
    const proGap = results.get("PRO-GAP")!;
    const amadorEq = results.get("AMADOR-EQUILIBRADO")!;
    const amadorGap = results.get("AMADOR-GAP")!;

    const winRateGapLeve = gapLeve.userWins / gapLeve.games;
    const winRateProGap = proGap.userWins / proGap.games;
    const winRateAmadorEq = amadorEq.userWins / amadorEq.games;
    const winRateAmadorGap = amadorGap.userWins / amadorGap.games;
    const durProGap = mean(proGap.durationSec);
    const durAmadorGap = mean(amadorGap.durationSec);

    // R1: invariancia de nivel da win-rate com gap zero (EQUILIBRADO vs AMADOR-EQUILIBRADO).
    // NAO MAIS PROVISORIA (Fase 28 pagou a divida, plano 28-03 Task 2): a tolerancia de
    // 8pp herdada sem fonte foi substituida por 0,08, medida em tres amostras disjuntas
    // (docs/diagnostics/28-ancoragem.md Bloco 8) e ajustada para o TETO de ruido amostral
    // de tres sigma da diferenca de duas proporcoes em N=800 (~0,075, arredondado para
    // cima ao multiplo de 0,01 mais proximo). Coincide numericamente com o valor herdado,
    // mas agora e derivada de medicao, nao de precedente emprestado de outro uso.
    // A invariancia de nivel de R1 e propriedade da FORMULA (STACK.md linha 437), nao
    // de calibracao por tier: EQUILIBRADO e AMADOR-EQUILIBRADO tem gap ZERO cada um, entao
    // ratingFightMult retorna 1,0 exato dos dois lados independente de ratingPowerD -- R1
    // mede o residuo do motor SEM o canal de rating (outros canais dependentes de nivel
    // absoluto, como ouro), nao o efeito do canal em si.
    const r1Value = winRateEq - winRateAmadorEq;
    const r1 = checkBand(
      "R1: invariancia de nivel da win-rate com gap zero (EQUILIBRADO menos AMADOR-EQUILIBRADO)",
      r1Value,
      {
        floor: -0.08,
        ceiling: 0.08,
        source: "docs/diagnostics/28-ancoragem.md Bloco 8 (tres amostras disjuntas, N=800 cada)",
        owner: "Fase 28",
      }
    );
    bandResults.push(r1);

    // R2: invariancia de nivel da win-rate com gap 20 (PRO-GAP vs AMADOR-GAP). O par
    // existe porque nenhum tier pro anterior tinha gap exatamente 20 -- PRO-GAP foi
    // criado no Task 1 para comparar gap igual com gap igual.
    // NAO MAIS PROVISORIA (Fase 28 pagou a divida, plano 28-03 Task 2): a tolerancia de
    // 8pp herdada sem fonte foi substituida por 0,03 (piso minimo de ruido amostral
    // declarado no plano, muito acima do teto de tres sigma medido ~0,009 para este par,
    // que satura perto de 100% dos dois lados), medida em tres amostras disjuntas
    // (docs/diagnostics/28-ancoragem.md Bloco 8). Recalibracao de fato: 0,08 para 0,03,
    // banda quase tres vezes mais estreita.
    const r2Value = winRateProGap - winRateAmadorGap;
    const r2 = checkBand(
      "R2: invariancia de nivel da win-rate com gap 20 (PRO-GAP menos AMADOR-GAP)",
      r2Value,
      {
        floor: -0.03,
        ceiling: 0.03,
        source: "docs/diagnostics/28-ancoragem.md Bloco 8 (tres amostras disjuntas, N=800 cada)",
        owner: "Fase 28",
      }
    );
    bandResults.push(r2);

    // R3: invariancia de nivel da duracao com gap 20 (PRO-GAP vs AMADOR-GAP, fracional).
    // Sem fonte externa: valor de engenharia registrado como suposicao A2 do 23-RESEARCH.md.
    // PROVISORIA -- a fase dona precisa recalibrar a tolerancia com medicao propria.
    // NAO TOCADA pelo plano 28-03: R3 mede invariancia de DURACAO, nao de win-rate; a
    // Fase 28 so tem mandato sobre R1/R2 (win-rate). Dono continua Fase 25, de proposito,
    // registrado aqui para que a leitura futura nao pense que a Fase 28 esqueceu dela.
    const r3Value = (durProGap - durAmadorGap) / durProGap;
    const r3 = checkBand(
      "R3: invariancia de nivel da duracao com gap 20 ((PRO-GAP menos AMADOR-GAP) sobre PRO-GAP)",
      r3Value,
      {
        floor: -0.2,
        ceiling: 0.2,
        source: "nenhuma fonte externa; valor de engenharia, suposicao A2 do 23-RESEARCH.md",
        owner: "Fase 25",
        provisional: true,
      }
    );
    bandResults.push(r3);

    // R4: monotonicidade da win-rate no gap dentro do nivel pro (gaps 0, 10, 20, 30).
    // Assert de ORDENACAO, nao de magnitude: nenhum numero e inventado, so a ordem e
    // verificada -- no mesmo espirito do assert de ordenacao que STACK.md secao 7
    // recomenda para a participacao em abate por rota. Nao provisoria.
    const r4Sequence = [winRateEq, winRateGapLeve, winRateProGap, winRateGap30];
    const r4Sorted = [...r4Sequence].sort((a, b) => a - b);

    out += "\n=== RELACOES METAMORFICAS: invariancia de nivel por proporcao (Fase 23 / INST-05) ===\n";
    out +=
      "Comparam pro com amador NO MESMO GAP em vez de inventar valor absoluto para o\n" +
      "nivel amador (STACK.md secao 7, 'Sobre o alvo de amadores': sem fonte confiavel\n" +
      "citavel para distribuicao de baixo elo).\n";
    out += `  R1 (EQUILIBRADO ${pctOf(eq.userWins, eq.games)} vs AMADOR-EQUILIBRADO ${pctOf(amadorEq.userWins, amadorEq.games)}): ${r1.line}\n`;
    out += `  R2 (PRO-GAP ${pctOf(proGap.userWins, proGap.games)} vs AMADOR-GAP ${pctOf(amadorGap.userWins, amadorGap.games)}): ${r2.line}\n`;
    out += `  R3 (PRO-GAP ${mmss(durProGap)} vs AMADOR-GAP ${mmss(durAmadorGap)}): ${r3.line}\n`;
    out +=
      `  R4 monotonicidade da win-rate no gap (nivel pro): EQUILIBRADO(gap0)=${pctOf(eq.userWins, eq.games)} -> ` +
      `GAP-LEVE(gap10)=${pctOf(gapLeve.userWins, gapLeve.games)} -> PRO-GAP(gap20)=${pctOf(proGap.userWins, proGap.games)} -> ` +
      `GAP-30(gap30)=${pctOf(gap30.userWins, gap30.games)}\n`;
    out +=
      `    sequencia nao-decrescente exigida: [${r4Sequence.map((v) => v.toFixed(3)).join(", ")}] ` +
      `fonte: STACK.md secao 6.1 (curva de win-rate e monotonica na vantagem) dono: Fase 28 (nao provisoria)\n`;
    out +=
      "\nNOTA: R3 continua tolerancia PROVISORIA (divida tecnica declarada, nao numero medido),\n" +
      "dono Fase 25. R1 e R2 foram recalibradas com dado medido pela Fase 28 (plano 28-03,\n" +
      "docs/diagnostics/28-ancoragem.md Bloco 8) e deixaram de ser provisorias.\n";

    // -------------------------------------------------------------------------
    // FASE 25B, ONDA 2: AS ONZE BANDAS DE DISPERSAO.
    //
    // Dez sobre a RAZAO entre o coeficiente de variacao medido hoje e o coeficiente de
    // variacao do motor pre-Fase-25 (tabela ANCORAGEM_CV_PRE_FASE_25 acima), mais uma
    // sobre o VALOR da fracao de comeback. Todas de dois lados, todas por checkBand,
    // todas na MESMA lista agregada por expectBands: uma rodada mostra de uma vez todas
    // as vermelhas com suas fases donas, em vez de parar na primeira.
    //
    // ONDE ELAS SAO AVALIADAS, e a razao escrita: SOMENTE no tier EQUILIBRADO, mesmo
    // precedente ja registrado ao lado da banda de razao de torres neste arquivo. A
    // ancoragem foi medida em fixture 75 contra 75 com gap ZERO, e comparar a dispersao
    // de um tier de gap contra uma ancoragem de gap zero mediria o GAP e nao a dispersao.
    // Os outros cinco tiers entram no bloco de observacao mais abaixo, sem veredito.
    //
    // O PLACAR DE COLAPSO MEDIDO NA ONDA 1 E QUATRO, NAO DOIS. D-25-07 achou dois
    // (torres do vencedor 0,203 e primeira torre 0,543) porque so podia olhar as metricas
    // que tinham baseline. Medindo com o harness certo e com as tres que faltavam, tambem
    // colapsaram `torres totais` (0,709) e `torres por minuto` (0,504).
    //
    // `torres por minuto` E O CASO DE MANUAL DA MILESTONE INTEIRA, e por isso ela tem
    // linha propria no relatorio: a banda de NIVEL dela esta VERDE (0,326 dentro de
    // [0,300; 0,450], conquistada pela Fase 25) e a distribuicao dela encolheu PELA
    // METADE no mesmo movimento. Banda verde sobre distribuicao colapsada e precisamente
    // o modo de falha que este bloco existe para tornar impossivel de passar despercebido.
    // -------------------------------------------------------------------------
    interface LinhaDispersao {
      rotulo: string;
      /** Acessor da serie por partida. E acessor e nao vetor para que o mesmo descritor
       *  sirva ao tier EQUILIBRADO (onde a banda e avaliada) e aos seis tiers do bloco
       *  de observacao, sem duplicar a lista nem arriscar que as duas divirjam. */
      serieDe: (st: TierStats) => readonly number[];
      ancoragem: number;
      owner: string;
      /** Nome da ancoragem no rotulo; ausente = a do motor pre-Fase-25. */
      nomeAncoragem?: string;
      /** Procedencia da ancoragem; ausente = FONTE_ANCORAGEM_DISPERSAO. */
      fonte?: string;
    }

    /** Monta uma banda de dispersao: razao do CV medido contra o CV de ancoragem. */
    function bandaDispersao(l: LinhaDispersao): BandResult {
      const cv = coefVariacao(l.serieDe(eq));
      return checkBand(
        `DISPERSAO ${l.rotulo}: razao do CV medido (${cv.toFixed(4)}) contra ` +
          `${l.nomeAncoragem ?? "a ancoragem pre-Fase-25"} (${l.ancoragem.toFixed(4)})`,
        cv / l.ancoragem,
        {
          floor: DISP_PISO,
          ceiling: DISP_TETO,
          target: 1.0,
          source: l.fonte ?? FONTE_ANCORAGEM_DISPERSAO,
          owner: l.owner,
        }
      );
    }

    // AS DEZ, na ordem da tabela de ancoragem.
    //
    // FASE DONA, e a atribuicao esta justificada uma a uma:
    //   - `torres do vencedor`, `primeira torre` e `torres por minuto` tem dono FASE 25B:
    //     sao colapsos com causa JA ATRIBUIDA pelo contrafactual de quatro estados da
    //     secao 7 de 25-sweep.md (o canal absoluto encosta o vencedor no teto do contador),
    //     e as tres sao metrica-raiz, nunca derivada;
    //   - `torres totais` COLAPSOU (0,709) pela MESMA causa, mas e metrica DERIVADA, e a
    //     tabela de invariantes do ROADMAP.md proibe nominalmente dar meta intermediaria a
    //     metrica derivada (foi o erro da v2.0). Dar dono Fase 25B a ela seria contar o
    //     mesmo defeito duas vezes: o conserto que devolve variacao as torres do vencedor
    //     e a torres/min puxa o total sozinho. Fica como VIGIA, com o vermelho e a causa
    //     escritos no relatorio, e a aceitacao final na revisao em bloco da Fase 30;
    //   - as outras seis sao vigias das cinco fases que ainda vao apertar nivel.
    const dispersaoLinhas: LinhaDispersao[] = [
      {
        rotulo: "duracao",
        serieDe: (st) => st.durationSec,
        ancoragem: ANCORAGEM_CV_PRE_FASE_25.duracao,
        owner: DONO_VIGIA_DISPERSAO,
      },
      {
        rotulo: "abates totais",
        serieDe: (st) => st.killsTotal,
        ancoragem: ANCORAGEM_CV_PRE_FASE_25.abatesTotais,
        owner: DONO_VIGIA_DISPERSAO,
      },
      {
        rotulo: "torres do vencedor",
        serieDe: (st) => st.towersWinner,
        ancoragem: ANCORAGEM_CV_PRE_FASE_25.torresVencedor,
        owner: "Fase 25B",
      },
      {
        rotulo: "torres do perdedor",
        serieDe: (st) => st.towersLoser,
        ancoragem: ANCORAGEM_CV_PRE_FASE_25.torresPerdedor,
        owner: DONO_VIGIA_DISPERSAO,
      },
      {
        // CONTAGEM COMPLETA (Fase 25B, onda 3), com a ancoragem RE-MEDIDA sob a mesma
        // leitura no motor pre-Fase-25. Comparar coeficiente de variacao de duas
        // leituras diferentes seria invalido: somar as duas torres do Nexus comprime o
        // coeficiente nos DOIS estados, entao a ancoragem tem de vir da mesma definicao.
        rotulo: "torres totais",
        serieDe: (st) => st.towersTotalFull,
        ancoragem: ANCORAGEM_CV_PRE_FASE_25.torresTotaisFull,
        owner: DONO_VIGIA_DISPERSAO,
      },
      {
        // CONTAGEM COMPLETA (Fase 25B, onda 3), ancoragem re-medida, mesma razao acima.
        rotulo: "torres por minuto",
        serieDe: (st) => st.towersPerMinFullPerGame,
        ancoragem: ANCORAGEM_CV_PRE_FASE_25.torresPorMinFull,
        owner: "Fase 25B",
      },
      {
        // ATUALIZADA PARA O PATCH 26 (Task 8 da linha calendario-e-volume): ancora no CV
        // real da amostra multi-liga 2026, nao no motor pre-Fase-25. Ver o comentario de
        // CV_REAL_PRIMEIRA_TORRE_PATCH26.
        rotulo: "primeira torre",
        serieDe: (st) => st.firstTowerSec,
        ancoragem: CV_REAL_PRIMEIRA_TORRE_PATCH26,
        owner: "Fase 25B",
        nomeAncoragem: "o CV real do patch 26",
        fonte: FONTE_CV_REAL_PRIMEIRA_TORRE,
      },
      {
        rotulo: "ouro final do vencedor",
        serieDe: (st) => st.goldFinalWinner,
        ancoragem: ANCORAGEM_CV_PRE_FASE_25.ouroVencedor,
        owner: DONO_VIGIA_DISPERSAO,
      },
      {
        rotulo: "ouro final do perdedor",
        serieDe: (st) => st.goldFinalLoser,
        ancoragem: ANCORAGEM_CV_PRE_FASE_25.ouroPerdedor,
        owner: DONO_VIGIA_DISPERSAO,
      },
      {
        rotulo: "ouro por minuto por time",
        serieDe: (st) => st.goldPerMinTeam,
        ancoragem: ANCORAGEM_CV_PRE_FASE_25.ouroPorMin,
        owner: DONO_VIGIA_DISPERSAO,
      },
    ];

    const bandasDispersao = dispersaoLinhas.map(bandaDispersao);
    for (const b of bandasDispersao) bandResults.push(b);

    // A DECIMA PRIMEIRA, sobre o VALOR e nao sobre coeficiente de variacao.
    //
    // A fracao de comeback e proporcao AGREGADA sobre a populacao inteira: ela nao tem
    // dispersao por partida, entao nao ha coeficiente de variacao para ancorar.
    //
    // POR QUE ELA NASCE PROVISORIA, e a justificativa e o proprio motivo do campo existir:
    // nao ha referencia externa desta classificacao em STACK.md, o valor do baseline
    // congelado e 66,5 por cento e a propria secao 8 de docs/diagnostics/25-sweep.md
    // registra que 66,5 e ALTO DEMAIS para ser saudavel. Ou seja, nem o valor antigo nem o
    // novo podem ser declarados corretos. O que esta PROVADO e a magnitude do MOVIMENTO:
    // queda para 31,5 por cento com o atropelo quase triplicando (9,3 para 26,0).
    //
    // OS DOIS EXTREMOS DA BANDA, por regra escrita e reproduzivel: piso e teto sao o ponto
    // medio entre o valor de hoje (0,315) e o valor pre-Fase-25 (0,651), que e 0,483, com
    // meia largura de 0,10 para cada lado, arredondado a multiplos de 0,05. O teto fica
    // estritamente abaixo do 0,651 que a fonte registra como alto demais, e o piso fica
    // estritamente acima do 0,315 de hoje, que a mesma fonte registra como queda para
    // menos da metade.
    //
    // FASE DONA: Fase 30, na revisao em bloco (DOCS-01), que e onde a milestone ja tem
    // criterio para arbitrar valores desse tipo com dado de varias fases em vez de zero.
    const fracaoComeback = eq.dinamica.comeback / eq.games;
    const bandaComeback = checkBand(
      "DISPERSAO fracao de partidas classificadas como comeback (banda sobre o VALOR, nao sobre CV)",
      fracaoComeback,
      {
        floor: 0.4,
        ceiling: 0.6,
        target: 0.483,
        source:
          "docs/diagnostics/25B-ancoragem.md Bloco 2 (tabela de dinamica) e " +
          "docs/diagnostics/25-sweep.md secao 8; sem fonte externa em STACK.md, valor de engenharia",
        owner: "Fase 30 (revisao em bloco, DOCS-01)",
        provisional: true,
      }
    );
    bandResults.push(bandaComeback);

    // -------------------------------------------------------------------------
    // FASE 25B, ONDA 2: AS SETE BANDAS DE FORMA.
    //
    // ELAS SAO O PROPRIO CRITERIO DA FASE. Os criterios 2 e 3 do ROADMAP.md sao numeros de
    // forma (vencedor no maximo do contador abaixo de 25 por cento, vitoria exigindo tres
    // rotas abaixo de 35 por cento, vitoria por uma rota entre 50 e 80 por cento, shutout
    // abaixo de 12 por cento, 9 a 0 exato abaixo de 5 por cento, bimodalidade das
    // distribuicoes abaixo do limiar) e ate aqui NENHUM deles existia em gate nenhum. Sem
    // este bloco a fase mediria os proprios criterios em documento solto, e documento solto
    // nao para uma rodada.
    //
    // TODAS DE DOIS LADOS, TODAS COM DONO FASE 25B, TODAS AVALIADAS SO NO TIER EQUILIBRADO
    // (criterio 3 do roadmap diz "no tier EQUILIBRADO com gap zero" com todas as letras).
    // As mesmas sete grandezas aparecem observadas nos seis tiers logo abaixo do relatorio.
    //
    // ELAS NASCEM VERMELHAS E ISSO E O ESPERADO, precedente DEC-02 repetido no 24-01 e no
    // 25-01: um gate que nasce verde sobre uma engine que ainda nao foi consertada significa
    // banda frouxa o bastante para acomodar o defeito, que e o modo de falha da v2.0. O
    // conserto e das ondas 3 a 5. O criterio aqui e que elas falhem de forma LEGIVEL.
    //
    // ------------------------------------------------------------------------
    // A AUSENCIA QUE PRECISA ESTAR ESCRITA: NAO EXISTE E NAO PODE EXISTIR BANDA DE FORMA
    // SOBRE A `razao de torres`, NEM SOBRE NENHUMA OUTRA RAZAO.
    //
    // Aviso de instrumento de `docs/diagnostics/25-sweep.md`: o coeficiente de bimodalidade
    // calculado sobre QUOCIENTE DE INTEIROS PEQUENOS e SATURADO e NAO DISCRIMINA. Medido
    // nos quatro estados do contrafactual, ele ficou acima do limiar em TODOS OS QUATRO,
    // inclusive no pre-fase (0,7359), onde a distribuicao era reconhecidamente saudavel.
    // Aplicado ao pe da letra, ele teria ABSOLVIDO a Fase 25. Ele e inflado por massa
    // pontual em 1,000 exato, por cauda longa a direita e pela indefinicao quando o
    // perdedor termina em zero torre, que descarta ate 22,9 por cento da amostra de forma
    // NAO aleatoria, removendo justamente os extremos. Por isso a forma e medida nas duas
    // CONTAGENS SEPARADAS (torres do vencedor e torres do perdedor) e na contagem de rotas
    // limpas, que e o que o proprio aviso manda fazer.
    //
    // A BANDA DE NIVEL DA RAZAO CONTINUA ONDE ESTA e continua sendo o instrumento certo
    // para NIVEL: o aviso e sobre FORMA. E a razao sozinha NAO FECHA o criterio 3, porque
    // ela ja estava VERDE (3,393 dentro de [2,5; 4,5]) com a forma colapsada. Foi
    // exatamente isso que D-25-06 mediu, e e a razao de esta fase existir.
    // ------------------------------------------------------------------------
    interface LinhaForma {
      rotulo: string;
      valorDe: (st: TierStats) => number;
      band: Band;
    }

    const FONTE_CRITERIO_2 = "ROADMAP.md Fase 25B criterio 2";
    const FONTE_CRITERIO_3 = "ROADMAP.md Fase 25B criterio 3";
    const DONO_FORMA = "Fase 25B";

    /** Fracao de partidas exatamente 9 a 0: exige o par vencedor/perdedor da MESMA partida,
     *  entao ela nao sai de shareWhere. As duas series sao paralelas indice a indice. */
    function fracaoNoveAZero(st: TierStats): number {
      if (st.towersWinner.length === 0) return 0;
      let n = 0;
      for (let i = 0; i < st.towersWinner.length; i++) {
        if (st.towersWinner[i] === MAX_CONTADOR_TORRES && st.towersLoser[i] === 0) n++;
      }
      return n / st.towersWinner.length;
    }

    const formaLinhas: LinhaForma[] = [
      {
        // Teto do criterio 2 do roadmap (cai de 90,8 para menos de 25 por cento). PISO
        // anti-colapso ancorado no estado pre-fase medido na onda 1, que mediu 4,0 por
        // cento (o estado D do contrafactual mediu 3,9): o vencedor chegar ao maximo do
        // contador as vezes e desfecho LEGITIMO de atropelo, e exigir zero seria trocar
        // um defeito por outro.
        rotulo: `FORMA fracao de partidas com o vencedor no maximo do contador (${MAX_CONTADOR_TORRES} torres)`,
        valorDe: (st) => shareWhere(st.towersWinner, (t) => t === MAX_CONTADOR_TORRES),
        band: {
          floor: 0.01,
          ceiling: 0.25,
          target: 0.04,
          source: `${FONTE_CRITERIO_2} (teto); piso anti-colapso do pre-fase 4,0 por cento medido em docs/diagnostics/25B-ancoragem.md Bloco 5`,
          owner: DONO_FORMA,
        },
      },
      {
        // Teto do criterio 2 do roadmap (cai de 90,8 para menos de 35 por cento), piso pela
        // mesma razao do anterior.
        rotulo: "FORMA fracao de vitorias que exigiram limpar as TRES rotas do perdedor",
        valorDe: (st) => shareWhere(st.rotasLimpasDoPerdedor, (r) => r === 3),
        band: {
          floor: 0.01,
          ceiling: 0.35,
          target: 0.04,
          source: `${FONTE_CRITERIO_2} (teto); piso anti-colapso do pre-fase 4,0 por cento medido em docs/diagnostics/25B-ancoragem.md Bloco 5`,
          owner: DONO_FORMA,
        },
      },
      {
        // OS DOIS LADOS vem do criterio 2 do roadmap, e o alvo 0,721 e o valor medido no
        // estado C do contrafactual, ou seja COM O CANAL DESLIGADO (72,1 por cento).
        // ESTA E A BANDA QUE DEVOLVE SENTIDO AO INVARIANTE ESCRITO no cabecalho de
        // `src/sim/structures.test.ts`, segundo o qual para vencer basta limpar por inteiro
        // UMA rota. Hoje ela mede 2,6 por cento: o invariante esta escrito no projeto e
        // contradito pela engine, e nada reprovava isso.
        rotulo: "FORMA fracao de vitorias com exatamente UMA rota limpa",
        valorDe: (st) => shareWhere(st.rotasLimpasDoPerdedor, (r) => r === 1),
        band: {
          floor: 0.5,
          ceiling: 0.8,
          target: 0.721,
          source: `${FONTE_CRITERIO_2} (banda 50 a 80 por cento; alvo = estado C de docs/diagnostics/25-sweep.md secao 7, canal desligado)`,
          owner: DONO_FORMA,
        },
      },
      {
        // Teto do criterio 3 do roadmap (cai de 44,9 para menos de 12 por cento). PISO como
        // valor de engenharia DECLARADO, ancorado entre o estado B do contrafactual (1,4 por
        // cento, com o termo de vantagem desligado) e o estado pre-fase (17,9 por cento):
        // exigir shutout perto de zero apagaria a capacidade de o lado forte dominar, que e
        // o defeito OPOSTO e igualmente real.
        rotulo: `FORMA fracao de shutout (perdedor com 0 ou ${SHUTOUT_MAX_TORRES} torre)`,
        valorDe: (st) => shareWhere(st.towersLoser, (t) => t <= SHUTOUT_MAX_TORRES),
        band: {
          floor: 0.02,
          ceiling: 0.12,
          target: 0.075,
          source: `${FONTE_CRITERIO_3} (teto); piso de engenharia entre o estado B (1,4 por cento) e o pre-fase (17,9 por cento) de docs/diagnostics/25-sweep.md secao 7`,
          owner: DONO_FORMA,
        },
      },
      {
        // Teto do criterio 3 do roadmap (cai de 20,9 para menos de 5 por cento).
        // O PISO E ZERO DE PROPOSITO, E A RAZAO PRECISA ESTAR ESCRITA: o estado C do
        // contrafactual mediu 0,0 por cento e ninguem quer uma engine OBRIGADA a produzir
        // placar perfeito. ESTE E O UNICO PISO ZERO DESTE BLOCO, e a excecao esta declarada
        // aqui justamente para que ela nao vire precedente silencioso.
        rotulo: "FORMA fracao de partidas exatamente 9 a 0",
        valorDe: fracaoNoveAZero,
        band: {
          floor: 0,
          ceiling: 0.05,
          target: 0.001,
          source: `${FONTE_CRITERIO_3} (teto); piso zero declarado, estado C mediu 0,0 por cento em docs/diagnostics/25-sweep.md secao 7`,
          owner: DONO_FORMA,
        },
      },
      {
        // Teto de Kang (2019) / Pfister et al. (2013), importado de scripts/stats.ts como
        // BC_UNIMODAL_THRESHOLD e nunca reescrito aqui. PISO ancorado nos quatro estados do
        // contrafactual, cujo menor valor medido foi 0,3777 (estado C, torres do perdedor):
        // uma distribuicao pode ser unimodal demais, e um piso impede que o conserto troque
        // a bimodalidade por uma massa pontual unica.
        rotulo: "FORMA coeficiente de bimodalidade da distribuicao das torres do VENCEDOR",
        valorDe: (st) => bcOuNaN(st.towersWinner),
        band: {
          floor: 0.25,
          ceiling: BC_UNIMODAL_THRESHOLD,
          target: 0.4594,
          source:
            "Kang (2019) e Pfister et al. (2013) via BC_UNIMODAL_THRESHOLD de scripts/stats.ts (teto); " +
            "piso ancorado no menor dos quatro estados do contrafactual (0,3777); alvo = pre-fase medido em docs/diagnostics/25B-ancoragem.md Bloco 5",
          owner: DONO_FORMA,
        },
      },
      {
        rotulo: "FORMA coeficiente de bimodalidade da distribuicao das torres do PERDEDOR",
        valorDe: (st) => bcOuNaN(st.towersLoser),
        band: {
          floor: 0.25,
          ceiling: BC_UNIMODAL_THRESHOLD,
          target: 0.4416,
          source:
            "Kang (2019) e Pfister et al. (2013) via BC_UNIMODAL_THRESHOLD de scripts/stats.ts (teto); " +
            "piso ancorado no menor dos quatro estados do contrafactual (0,3777); alvo = pre-fase medido em docs/diagnostics/25B-ancoragem.md Bloco 5",
          owner: DONO_FORMA,
        },
      },
    ];

    const bandasForma = formaLinhas.map((l) => checkBand(l.rotulo, l.valorDe(eq), l.band));
    for (const b of bandasForma) bandResults.push(b);

    // -------------------------------------------------------------------------
    // FASE 25C, ONDA 2: AS TRES BANDAS DE ACOPLAMENTO, o terceiro eixo do gate.
    // Computadas sobre as linhas do tempo que o tier EQUILIBRADO JA produziu: nenhuma
    // simulacao extra e paga e por isso a inclusao nao muda o custo do gate de forma
    // material.
    // -------------------------------------------------------------------------
    const strataLift = buildStrata(partidasLift);
    const paresAcopl = paresPreRegistrados(W_ACOPLAMENTO);
    const resAcopl = new Map<string, PairResult>();
    for (const p of paresAcopl) resAcopl.set(p.id, analysePair(partidasLift, strataLift, p));

    interface LinhaAcopl {
      id: "P1" | "P2" | "P3";
      rotulo: string;
      pre: number;
      fator: number;
      /** MOVE ou PRESERVA, so para o relatorio. */
      papel: string;
      teto: number;
      refTeto: string;
      /** Procedencia da ancoragem; ausente = a leitura PRE da Fase 25C. */
      fonte?: string;
    }

    const linhasAcopl: LinhaAcopl[] = [
      {
        id: "P1",
        rotulo: "ACOPLAMENTO P1 gank, depois queda de torre NA MESMA ROTA",
        pre: ANCORAGEM_LIFT_PRE_25C.P1,
        fator: ACOPL_FATOR_MOVE,
        papel: "MOVE",
        teto: ACOPL_TETO.P1,
        refTeto: "2,020, projecao do conjunto recomendado sobre o PRE de 60 s",
      },
      {
        // REANCORADO NA SPEC (Task 8 da linha calendario-e-volume): ver o comentario de
        // ACOPL_P2_CALENDARIO. Antes: pre ANCORAGEM_LIFT_PRE_25C.P2 (2,054), teto 2,25.
        id: "P2",
        rotulo: "ACOPLAMENTO P2 baron_taken, depois queda de torre",
        pre: ACOPL_P2_CALENDARIO.valor,
        fator: ACOPL_FATOR_PRESERVA,
        papel: "PRESERVA",
        teto: ACOPL_P2_CALENDARIO.teto,
        refTeto: "2,779, o valor medido no motor da Task 8 da linha calendario-e-volume",
        fonte: FONTE_ACOPL_P2_CALENDARIO,
      },
      {
        id: "P3",
        rotulo: "ACOPLAMENTO P3 luta ganha, depois objetivo epico",
        pre: ANCORAGEM_LIFT_PRE_25C.P3,
        fator: ACOPL_FATOR_MOVE,
        papel: "MOVE",
        teto: ACOPL_TETO.P3,
        refTeto: "1,503, o proprio piso relativo que a fase persegue",
      },
    ];

    const bandasAcopl: BandResult[] = [];
    const bandasAcoplIC: BandResult[] = [];
    for (const l of linhasAcopl) {
      const r = resAcopl.get(l.id)!;
      const piso = pisoEfetivo(l.pre, l.fator);
      const bandaValor: Band = {
        floor: piso,
        ceiling: l.teto,
        target: piso,
        source:
          `${l.fonte ?? FONTE_ANCORAGEM_ACOPLAMENTO}; piso = maior entre o absoluto ${ACOPL_PISO_ABSOLUTO.toFixed(3)} e ` +
          `${l.fator.toFixed(2)} vezes o ${l.fonte ? "valor reancorado" : "PRE"} ${l.pre.toFixed(3)} ` +
          `(par que a fase ${l.papel}); teto = menor multiplo de 0,25 acima de ${l.refTeto}`,
        owner: DONO_ACOPLAMENTO,
      };
      bandasAcopl.push(checkBand(l.rotulo, r.matched.lift, bandaValor));

      // O SEGUNDO ASSERT, E ELE NAO E OPCIONAL. Uma banda que avaliasse so o ponto
      // aceitaria um lift alto com IC largo cruzando o vies do instrumento, que e
      // exatamente o modo de falha que o piso absoluto existe para fechar. O epsilon
      // transforma a comparacao inclusiva de `inBand` na ESTRITA que o Bloco 2.4 pede.
      bandasAcoplIC.push(
        checkBand(`ACOPLAMENTO ${l.id} IC95 inferior contra o piso absoluto`, r.matched.lo, {
          floor: ACOPL_PISO_ABSOLUTO + ACOPL_EPS_ESTRITO,
          ceiling: l.teto,
          target: ACOPL_PISO_ABSOLUTO,
          source:
            `${l.fonte ?? FONTE_ANCORAGEM_ACOPLAMENTO}; Bloco 2.4 exige IC95 inferior ESTRITAMENTE maior que ` +
            `${ACOPL_PISO_ABSOLUTO.toFixed(3)}, que e o menor multiplo de 0,005 acima do maior vies medido do ` +
            `estimador sob independencia verdadeira (1,043)`,
          owner: DONO_ACOPLAMENTO,
        })
      );
    }
    for (const b of bandasAcopl) bandResults.push(b);
    for (const b of bandasAcoplIC) bandResults.push(b);

    out += "\n=== BANDAS (piso, teto, fonte, fase dona) ===\n";
    out +=
      "Cada linha declara piso, teto, fonte e dono: a fase responsavel pelo conserto\n" +
      "aparece entre colchetes ao lado do status. Formato: [OK|FALHA] [dono] rotulo =\n" +
      "valor situacao [piso, teto], alvo X (fonte: X).\n";
    out += formatBandTable(bandResults.map(marcarAposentada)) + "\n";
    out +=
      "\nNOTA (assistencias do ADC): a medicao AQUI roda sem campeoes atribuidos. A medicao\n" +
      "definitiva com campeoes, exigida pelo criterio 2 da Fase 24, passou a existir em\n" +
      "npm run calibrate:assists (scripts/calibrate-assists.ts), que roda tres conjuntos de\n" +
      "campeoes e reprova por elegibilidade estrutural de rota. Esta linha continua aqui como\n" +
      "controle negativo comparavel. A fase dona da banda foi reatribuida de Fase 24 para\n" +
      "Fase 26 porque a contagem por partida e DERIVADA (taxa vezes volume de abates): a taxa\n" +
      "e asserida pela Fase 24 em npm run calibrate:assists, o volume de abates e alavanca\n" +
      "declarada da Fase 26. Piso, teto e alvo ficaram inalterados.\n";
    out +=
      `\nNOTA (razao torres sobre abates): desde a Task 8 da linha calendario-e-volume o\n` +
      `numerador conta as torres do Nexus, como a referencia real. Observacao, sem banda:\n` +
      `sob o contador de nove a razao vale ${razaoTorresAbatesContadorDeNove.toFixed(3)}.\n`;
    out +=
      "\nNOTA (win-rate com gap 30): o piso nao tem fonte externa e vem do tier dominante\n" +
      "ja calibrado do proprio projeto (scripts/calibrate.ts:46); a procedencia declarada\n" +
      "e mista e esta anotada como tal.\n";

    // -------------------------------------------------------------------------
    // Bloco de leitura das bandas de DISPERSAO, com a tabela de ancoragem impressa e a
    // observacao dos seis tiers. Escrito ANTES de qualquer assercao, como todo o resto.
    // -------------------------------------------------------------------------
    out += "\n=== DISPERSAO: onze bandas de dois lados ancoradas no motor pre-Fase-25 (Fase 25B) ===\n";
    out +=
      "Todas as onze ja aparecem na tabela de BANDAS acima, com piso, teto, fonte e dono.\n" +
      "Este bloco existe para dar a elas a leitura que a tabela nao cabe.\n";
    out +=
      "\nPOR QUE ESTE EIXO EXISTE: todas as bandas da v2.2 ate a Fase 25 eram sobre NIVEL, e\n" +
      "nao havia gate nenhum sobre VARIACAO. A Fase 25 fechou seis bandas de nivel e colapsou\n" +
      "QUATRO distribuicoes, e o colapso so apareceu porque alguem pediu para olhar. Restam\n" +
      "cinco fases que vao apertar nivel cinco vezes.\n";
    out +=
      `\nBANDA, a mesma para as dez de coeficiente de variacao: razao do CV medido hoje contra\n` +
      `o CV do motor pre-Fase-25, dentro de [${DISP_PISO.toFixed(3)}, ${DISP_TETO.toFixed(3)}], alvo 1,000.\n` +
      `  piso ${DISP_PISO.toFixed(2)}: corte de COLAPSO aprovado em D-25-07.\n` +
      `  teto ${DISP_TETO.toFixed(2)}: menor multiplo de 0,25 estritamente acima do maior aumento de dispersao ja\n` +
      "  classificado como LEGITIMO na milestone (baroes por jogo, 1,954, secao 8 de 25-sweep.md).\n";
    out +=
      "\nAVALIADAS SOMENTE NO TIER EQUILIBRADO. A ancoragem foi medida em fixture 75 contra 75\n" +
      "com gap ZERO; comparar dispersao de um tier de gap contra ancoragem de gap zero mediria\n" +
      "o gap e nao a dispersao. Os outros cinco tiers aparecem observados no fim deste bloco.\n";
    out +=
      "\nA AUSENCIA DELIBERADA: `razao de torres` NAO entra na lista de dispersao. Ela e\n" +
      "indefinida quando o perdedor termina em zero torres, o que hoje descarta 22,9 por cento\n" +
      "da amostra de forma NAO aleatoria, removendo justamente os extremos. CV sobre amostra\n" +
      "assim truncada mede o truncamento. A banda de NIVEL da razao segue acima, intacta.\n";

    out += "\n  TABELA DE ANCORAGEM (docs/diagnostics/25B-ancoragem.md Bloco 2), e o medido de hoje:\n";
    out += `  ${"metrica".padEnd(28)} ${"CV pre-fase".padStart(12)} ${"CV hoje".padStart(12)} ${"razao".padStart(9)}  situacao\n`;
    for (let i = 0; i < dispersaoLinhas.length; i++) {
      const l = dispersaoLinhas[i];
      const b = bandasDispersao[i];
      const cvHoje = coefVariacao(l.serieDe(eq));
      const situacao = b.ok
        ? "dentro"
        : b.side === "PISO"
          ? "COLAPSO (estourou o PISO)"
          : "EXPLOSAO (estourou o TETO)";
      out +=
        `  ${l.rotulo.padEnd(28)} ${l.ancoragem.toFixed(4).padStart(12)} ${cvHoje.toFixed(4).padStart(12)} ` +
        `${b.value.toFixed(3).padStart(9)}  ${situacao} [${b.band.owner}]\n`;
    }
    out +=
      `  ${"fracao de comeback".padEnd(28)} ${"0.6510".padStart(12)} ${fracaoComeback.toFixed(4).padStart(12)} ` +
      `${"n/a".padStart(9)}  banda sobre o VALOR, PROVISORIA [${bandaComeback.band.owner}]\n`;
    out +=
      "  (as tres entradas torres totais, torres por minuto e ouro por minuto por time foram\n" +
      "  medidas pela PRIMEIRA VEZ na onda 1: elas nao constam do baseline congelado da Fase 24,\n" +
      "  e e por isso que o colapso de duas delas so pode ser visto agora)\n" +
      `  (primeira torre: desde a Task 8 da linha calendario-e-volume a coluna "CV pre-fase"\n` +
      `  traz o CV real do patch 26, ${CV_REAL_PRIMEIRA_TORRE_PATCH26.toFixed(4)}, e nao o do motor ` +
      `pre-Fase-25, ${ANCORAGEM_CV_PRE_FASE_25.primeiraTorre.toFixed(4)})\n`;

    // A LINHA QUE PRECISA APARECER COM DESTAQUE, porque ela e a prova de por que este bloco
    // inteiro precisava existir: nivel VERDE sobre distribuicao COLAPSADA.
    const bandaTorresPorMin = bandasDispersao[5];
    const bandaNivelTorresMin = bandResults.find((r) => r.label === "torres/min")!;
    out += "\n  >>> A LINHA QUE PROVA POR QUE A BANDA DE DISPERSAO PRECISAVA EXISTIR <<<\n";
    out +=
      `  torres por minuto: a banda de NIVEL mede ${torresMin.toFixed(3)} e esta ` +
      `${bandaNivelTorresMin.ok ? "DENTRO" : "FORA"} de [0,300; 0,450],\n` +
      `  conquistada pela Fase 25. A DISPERSAO da mesma metrica mede razao ` +
      `${bandaTorresPorMin.value.toFixed(3)} contra o piso ${DISP_PISO},\n` +
      "  ou seja a distribuicao encolheu para perto da metade no mesmo movimento que acertou a\n" +
      "  media. NENHUMA banda da v2.2 anterior a esta veria isso: a de nivel esta verde.\n";

    out += "\n  OBSERVACAO NOS SEIS TIERS, sem veredito (a banda so e avaliada no EQUILIBRADO):\n";
    out += `  ${"metrica (razao contra a ancoragem)".padEnd(34)}`;
    for (const tier of TIERS) out += tier.name.padStart(20);
    out += "\n";
    for (const l of dispersaoLinhas) {
      out += `  ${l.rotulo.padEnd(34)}`;
      for (const tier of TIERS) {
        const st = results.get(tier.name)!;
        out += (coefVariacao(l.serieDe(st)) / l.ancoragem).toFixed(3).padStart(20);
      }
      out += "\n";
    }
    out += `  ${"fracao de comeback (valor)".padEnd(34)}`;
    for (const tier of TIERS) {
      const st = results.get(tier.name)!;
      out += (st.dinamica.comeback / st.games).toFixed(3).padStart(20);
    }
    out += "\n";
    out +=
      "  Estas linhas nao reprovam nada e nunca entram em expectBands: elas existem para que\n" +
      "  a fase consiga dizer se o conserto GENERALIZOU ou se apenas acertou o tier onde a\n" +
      "  banda mora, pergunta que so tem resposta medindo os dois.\n";

    // -------------------------------------------------------------------------
    // Bloco de leitura das bandas de FORMA. Tambem escrito ANTES de qualquer assercao.
    // -------------------------------------------------------------------------
    out += "\n=== FORMA: sete bandas de dois lados, que sao os criterios 2 e 3 da Fase 25B ===\n";
    out +=
      "As sete ja aparecem na tabela de BANDAS acima, com piso, teto, fonte e dono. As cinco\n" +
      "primeiras sao as fracoes dos criterios 2 e 3 do ROADMAP.md e as duas ultimas sao os\n" +
      "coeficientes de bimodalidade das DISTRIBUICOES de torres. Ate esta onda NENHUMA delas\n" +
      "existia em gate nenhum: a fase mediria os proprios criterios em documento solto.\n";
    out += "\nTodas com dono Fase 25B e todas avaliadas SO no tier EQUILIBRADO (gap zero), porque e\n";
    out += "assim que o criterio 3 do roadmap esta escrito. Espera-se que nascam VERMELHAS: o\n";
    out += "conserto e das ondas 3 a 5, e banda que nasce verde sobre engine nao consertada e\n";
    out += "banda frouxa (DEC-02).\n";

    out += "\n  NAO EXISTE E NAO PODE EXISTIR BANDA DE FORMA SOBRE A `razao de torres`.\n";
    out +=
      "  Aviso de instrumento de docs/diagnostics/25-sweep.md: o coeficiente de bimodalidade\n" +
      "  sobre QUOCIENTE DE INTEIROS PEQUENOS e saturado e NAO discrimina. Ele ficou acima do\n" +
      "  limiar nos QUATRO estados do contrafactual, inclusive no pre-fase (0,7359), e aplicado\n" +
      "  ao pe da letra teria ABSOLVIDO a Fase 25. A forma e medida nas duas contagens\n" +
      "  SEPARADAS e na contagem de rotas limpas, que e o que o proprio aviso manda fazer.\n" +
      "  A banda de NIVEL da razao continua acima e continua sendo o instrumento certo para\n" +
      "  nivel: o aviso e sobre FORMA. E a razao SOZINHA nao fecha o criterio 3, porque ela ja\n" +
      "  estava VERDE com a forma colapsada, que e literalmente a razao de esta fase existir.\n";

    /** Formatador das linhas de observacao de forma: n/a quando a variancia e zero.
     *  Com N igual a 800 o coeficiente de bimodalidade so e nulo por variancia zero, e
     *  variancia zero e informacao (a distribuicao virou massa pontual), nunca defeito de
     *  medicao. Por isso o texto diz por que e n/a em vez de esconder atras de um numero. */
    function fmtForma(v: number): string {
      return Number.isFinite(v) ? v.toFixed(3) : "n/a var=0";
    }

    out += "\n  AS SETE NO TIER EQUILIBRADO, com o retrato da onda 1 ao lado:\n";
    out += `  ${"grandeza".padEnd(66)} ${"medido".padStart(10)} ${"pre-fase".padStart(9)}  banda\n`;
    const RETRATO_PRE_FASE = [0.04, 0.04, 0.583, 0.179, 0.001, 0.4594, 0.4416];
    for (let i = 0; i < formaLinhas.length; i++) {
      const b = bandasForma[i];
      const banda = `[${b.band.floor.toFixed(4)}, ${b.band.ceiling.toFixed(4)}]`;
      out +=
        `  ${formaLinhas[i].rotulo.replace("FORMA ", "").padEnd(66)} ${fmtForma(b.value).padStart(10)} ` +
        `${RETRATO_PRE_FASE[i].toFixed(3).padStart(9)}  ${banda.padEnd(18)} ` +
        `${b.ok ? "DENTRO" : `FORA pelo ${b.side}`}\n`;
    }
    out +=
      "  (coluna pre-fase: docs/diagnostics/25B-ancoragem.md Bloco 5, motor pre-Fase-25 medido\n" +
      "  com a mesma fixture, o mesmo N e o mesmo instrumento)\n";

    out += "\n  OBSERVACAO NOS SEIS TIERS, sem veredito (a banda so e avaliada no EQUILIBRADO):\n";
    out += `  ${"grandeza".padEnd(66)}`;
    for (const tier of TIERS) out += tier.name.padStart(20);
    out += "\n";
    for (const l of formaLinhas) {
      out += `  ${l.rotulo.replace("FORMA ", "").padEnd(66)}`;
      for (const tier of TIERS) {
        out += fmtForma(l.valorDe(results.get(tier.name)!)).padStart(20);
      }
      out += "\n";
    }
    out +=
      "  Leitura de `n/a var=0`: naquele tier TODOS os vencedores terminaram no maximo do\n" +
      "  contador, entao a distribuicao virou massa pontual e o coeficiente de bimodalidade\n" +
      "  deixa de existir. Isso e o colapso na sua forma mais extrema, nao ausencia de dado.\n";
    out +=
      "  POR QUE ESTAS LINHAS SAO OBRIGATORIAS: no GAP-LEVE a mesma deformacao vai ao extremo\n" +
      "  (shutout de 44,9 para 70,3 por cento e 9 a 0 de 20,9 para 41,6 por cento, medidos em\n" +
      "  D-25-06). Sem elas a fase nao consegue dizer se o conserto GENERALIZOU ou se apenas\n" +
      "  acertou o tier de referencia. Ressalva ja medida na onda 1, para nao cobrar do conserto\n" +
      "  o que nunca existiu: no pre-fase o GAP-LEVE ja tinha shutout de 40,8 por cento com o\n" +
      "  vencedor ainda unimodal (BC 0,4750). Gap produz assimetria sozinho; o que a Fase 25\n" +
      "  acrescentou naquele tier foi o encosto no teto do contador, que e outra coisa.\n";

    out += "\n  Histograma da contagem de rotas do perdedor limpas por inteiro, tier EQUILIBRADO:\n";
    for (const k of [0, 1, 2, 3]) {
      const f = shareWhere(eq.rotasLimpasDoPerdedor, (r) => r === k);
      out += `    ${k} rota(s): ${(f * 100).toFixed(1).padStart(6)} por cento  (${Math.round(f * eq.games)}/${eq.games})\n`;
    }
    out += `    media de rotas limpas: ${mean(eq.rotasLimpasDoPerdedor).toFixed(3)} (pre-fase: 1,438)\n`;
    out +=
      `    limiar unimodal usado nas duas bandas de bimodalidade: ${BC_UNIMODAL_THRESHOLD.toFixed(4)} ` +
      "(Kang 2019, importado de scripts/stats.ts)\n";

    // -------------------------------------------------------------------------
    // Bloco de leitura das bandas de ACOPLAMENTO. Escrito ANTES de qualquer assercao,
    // como todo o resto deste arquivo.
    // -------------------------------------------------------------------------
    out += "\n=== ACOPLAMENTO: tres bandas de dois lados ancoradas na leitura PRE da Fase 25C ===\n";
    out +=
      "As tres ja aparecem na tabela de BANDAS acima, junto com os tres asserts do IC95\n" +
      "inferior. Este bloco existe para dar a elas a leitura que a tabela nao cabe.\n";
    out +=
      "\nPOR QUE ESTE EIXO EXISTE, e por que os outros dois nao conseguem formular a pergunta:\n" +
      "nivel diz QUANTO acontece, dispersao e forma dizem COMO isso se distribui, e nenhum\n" +
      "dos dois enxerga se UM EVENTO PUXA O OUTRO. Uma engine pode ter torres por minuto na\n" +
      "banda, distribuicao saudavel e forma correta, e ainda assim emitir cada evento de\n" +
      "forma independente do anterior. Esse e o defeito que abriu a Fase 25C (D-25-08).\n";
    out +=
      "\nA ANCORA E TEORICA E EXATA: lift 1,000 e independencia. Estas sao as UNICAS bandas\n" +
      "deste arquivo que nao dependem de referencia externa nenhuma.\n";
    out +=
      "\nNENHUMA SIMULACAO EXTRA E PAGA. O tier EQUILIBRADO ja simulou as 800 partidas e as\n" +
      "linhas do tempo ja estavam em maos; a retencao e local a esse tier e nao aos seis.\n";
    out +=
      `\nJANELA DA BANDA: ${W_ACOPLAMENTO} s. As de ${W_ACOPLAMENTO_OBS.join(" e ")} s saem abaixo como OBSERVACAO e nao\n` +
      "viram banda nenhuma (Bloco 2.3 da ancoragem).\n";
    out +=
      "\nO TETO NAO E DECORATIVO: acoplamento excessivo tambem e defeito, porque uma engine em\n" +
      "que gank SEMPRE vira torre e tao irreal quanto uma em que nunca vira.\n";
    out +=
      "\nO SEGUNDO ASSERT DE CADA PAR NAO E OPCIONAL: alem do valor, o IC95 INFERIOR precisa\n" +
      "ser estritamente maior que o piso absoluto. Uma banda que avaliasse so o ponto\n" +
      "aceitaria um lift alto com IC largo cruzando o vies do instrumento, que e exatamente\n" +
      "o modo de falha que o piso absoluto existe para fechar.\n";
    out +=
      "\nREGRA DE ESCOPO: as tres incidem sobre ACOPLAMENTO, que e razao contra a ancoragem\n" +
      "teorica de 1,000, e nao sobre metrica derivada. Elas nao substituem nenhuma banda de\n" +
      "nivel, e nenhuma banda pre-existente mudou de piso ou de teto nesta onda.\n";
    out +=
      "\nREANCORAGEM DO P2 (Task 8 da linha calendario-e-volume): o piso e o teto do P2 saem\n" +
      `do valor ${ACOPL_P2_CALENDARIO.valor.toFixed(3)} medido no motor daquela task, e nao mais da leitura PRE de\n` +
      `${ANCORAGEM_LIFT_PRE_25C.P2.toFixed(3)} (spec 2026-10-02-calendario-e-volume, secoes 3 e 4: o Barao sai por\n` +
      "preparo ou pela janela de conversao, que segue para o cerco). P1 e P3 seguem na leitura PRE.\n";
    out +=
      "\nAS DUAS BANDAS DOS PARES QUE A FASE MOVE NASCEM VERMELHAS, e isso e desenho e nao\n" +
      "acidente. O motor ainda nao mudou: o conserto e das ondas 3 a 5, e banda que nasce\n" +
      "verde sobre engine nao consertada e banda frouxa (DEC-02). O vermelho de P1 e de P3\n" +
      "E a lista de trabalho daquelas ondas.\n";
    out +=
      "\nP2 NASCE VERDE, E ISSO E ESTRUTURAL E NAO BANDA FROUXA. Ela e banda de PRESERVACAO:\n" +
      "o piso e 0,95 vezes o PRE, e o valor medido no PRE e o proprio PRE. Uma banda de\n" +
      "preservacao ancorada na leitura PRE nao PODE nascer vermelha, porque isso exigiria\n" +
      "piso acima do PRE, ou seja exigiria que a fase movesse um par que ela declarou que\n" +
      "iria preservar. P2 e uma ARMADILHA e nao uma meta: ela fica verde ate que alguma onda\n" +
      "estrague o par, e e exatamente ai que ela serve. A pesquisa mediu P2 caindo em quase\n" +
      "toda alavanca testada, com o conjunto recomendado deixando a razao em 0,959 contra os\n" +
      "0,950 exigidos, ou seja margem de 0,009. P2 e o par mais fragil da fase apesar de ser\n" +
      "o unico que ja esta acoplado.\n";
    out +=
      "\nOS TRES ASSERTS DE IC95 INFERIOR TAMBEM NASCEM VERDES, e pela mesma logica: o piso\n" +
      "absoluto de 1,050 e FUNDO contra o vies do instrumento e nao alvo de conserto. Os tres\n" +
      "pares ja leem acima dele hoje, e o valor deles e impedir que uma rodada futura declare\n" +
      "acoplamento com IC largo cruzando o proprio erro do estimador.\n";

    out += "\n  OS TRES PARES PRE-REGISTRADOS, em W = 60 s, tier EQUILIBRADO:\n";
    out +=
      `  ${"par".padEnd(6)} ${"papel".padEnd(9)} ${"lift".padStart(8)} ${"IC95".padStart(18)} ` +
      `${"PRE".padStart(8)} ${"razao".padStart(8)} ${"banda".padStart(18)} veredito\n`;
    for (let i = 0; i < linhasAcopl.length; i++) {
      const l = linhasAcopl[i];
      const r = resAcopl.get(l.id)!;
      const b = bandasAcopl[i];
      const bIC = bandasAcoplIC[i];
      out +=
        `  ${l.id.padEnd(6)} ${l.papel.padEnd(9)} ${fmt(r.matched.lift).padStart(8)} ` +
        `${`[${fmt(r.matched.lo)}; ${fmt(r.matched.hi)}]`.padStart(18)} ${fmt(l.pre).padStart(8)} ` +
        `${fmt(r.matched.lift / l.pre).padStart(8)} ` +
        `${`[${fmt(b.band.floor)}; ${fmt(b.band.ceiling)}]`.padStart(18)} ` +
        `${b.ok ? "DENTRO" : `FORA (${b.side})`}\n`;
      out +=
        `         IC95 inferior ${fmt(r.matched.lo)} contra o piso absoluto ${fmt(ACOPL_PISO_ABSOLUTO)}: ` +
        `${bIC.ok ? "DENTRO" : `FORA (${bIC.side})`}   ` +
        `[ancoras ${r.matched.anchors}, clusters ${r.clusters}, p ${fmt(r.matched.p)}]\n`;
    }

    out += "\n  OBSERVACAO SEM BANDA, janelas de 120 e 180 s (nenhuma delas vira banda):\n";
    for (const wObs of W_ACOPLAMENTO_OBS) {
      for (const p of paresPreRegistrados(wObs)) {
        const r = analysePair(partidasLift, strataLift, p);
        out +=
          `    W=${String(wObs).padStart(3)} ${p.id.padEnd(4)} lift ${fmt(r.matched.lift).padStart(8)} ` +
          `[${fmt(r.matched.lo)}; ${fmt(r.matched.hi)}]  ancoras ${String(r.matched.anchors).padStart(6)}\n`;
      }
    }

    // OS CONTROLES INTERNOS NO RELATORIO DO GATE SAO O ALARME DE INSTRUMENTO, e por isso
    // eles moram na MESMA pagina em que mora o veredito: se um deles sair de 1,000 numa
    // rodada futura, o leitor precisa ver isso sem precisar rodar outro comando.
    out += "\n  OBSERVACAO SEM BANDA, OS TRES CONTROLES INTERNOS. Este bloco e o ALARME DE\n";
    out += "  INSTRUMENTO: nao existe caminho mecanico entre A e B no codigo para nenhum dos tres,\n";
    out += "  entao os tres TEM de ler 1,000 dentro do IC. Qualquer um deles sair de 1,000 numa\n";
    out += "  rodada futura e sinal de alerta do INSTRUMENTO e nao achado do motor, e nenhuma\n";
    out += "  conclusao sobre acoplamento pode ser tirada de uma rodada em que isso aconteca.\n";
    out += "  Vigilancia: a onda 4 mexe na rota do gank, e a partir dali C3 deixa de ser controle.\n";
    for (const p of paresDeControle(W_ACOPLAMENTO)) {
      const r = analysePair(partidasLift, strataLift, p);
      const cobre = r.matched.lo <= 1 && r.matched.hi >= 1;
      out +=
        `    ${p.id.padEnd(4)} lift ${fmt(r.matched.lift).padStart(8)} ` +
        `[${fmt(r.matched.lo)}; ${fmt(r.matched.hi)}]  ancoras ${String(r.matched.anchors).padStart(6)}  ` +
        `${cobre ? "cobre 1,000" : "NAO COBRE 1,000, ALERTA DE INSTRUMENTO"}\n`;
    }
    const rContestado = analysePair(partidasLift, strataLift, parDragaoContestado(W_ACOPLAMENTO));
    out +=
      `    C1x  lift ${fmt(rContestado.matched.lift).padStart(8)} ` +
      `[${fmt(rContestado.matched.lo)}; ${fmt(rContestado.matched.hi)}]  ancoras ` +
      `${String(rContestado.matched.anchors).padStart(6)}  OBSERVADO, TEM caminho mecanico\n`;
    out +=
      `  C1 e o subconjunto de dragao SEM CONTESTACAO e C1x e o COM LUTA. A separacao foi\n` +
      `  medida na onda 2 (Bloco 2.12 da ancoragem): resolveContestedObjective chama\n` +
      `  resolveTeamfight antes de tomar o objetivo, e aliveCount do inimigo alimenta\n` +
      `  shouldPushStructure e numbersAdvantage. A distancia entre C1x e C1 E esse caminho.\n`;

    // -------------------------------------------------------------------------
    // FASE 26, PLANO 26-01, TASK 2 (relatorio) + PLANO 26-03, TASK 2 (bandas):
    // densidade de eventos por FASE DE JOGO (NAR-01). A referencia externa
    // (STACK.md secao 5) foi derivada por escrito no BLOCO 6 de
    // docs/diagnostics/26-ancoragem.md; as seis bandas abaixo transcrevem os
    // doze numeros de la sem recalcular. Avaliado sobre o tier EQUILIBRADO, o
    // mesmo tier de referencia do bloco de ACOPLAMENTO acima.
    // -------------------------------------------------------------------------
    out += "\n=== DENSIDADE DE EVENTOS POR FASE DE JOGO (NAR-01, seis bandas, Fase 26) ===\n";
    out += "Referencia derivada no BLOCO 6 de docs/diagnostics/26-ancoragem.md, transcrita sem recalcular.\n";
    out += "Tres buckets por timeSec de SimEvent (nunca por state.phase, cuja segunda fronteira\n";
    out += "vale 1500s e nao 1200s): faseA [0:00,14:00), faseB [14:00,20:00), faseC [20:00,fim).\n";
    out += "Exposicao por partida (nao media global): uma partida sem tempo num bucket NAO entra\n";
    out += "na serie daquele bucket, nem como zero.\n\n";

    out +=
      `  ${"bucket".padEnd(22)} ${"densidade".padEnd(11)} ${"media".padStart(7)} ${"mediana".padStart(8)} ` +
      `${"p10".padStart(7)} ${"p90".padStart(7)} ${"partidas".padStart(9)}\n`;
    /** Media e populacao de cada serie, guardadas para as seis bandas abaixo (sem recomputar). */
    const densidadeMediaVisivel: Record<FaseBucket, number> = { faseA: 0, faseB: 0, faseC: 0 };
    const densidadeMediaComparavel: Record<FaseBucket, number> = { faseA: 0, faseB: 0, faseC: 0 };
    const densidadePopVisivel: Record<FaseBucket, number> = { faseA: 0, faseB: 0, faseC: 0 };
    const densidadePopComparavel: Record<FaseBucket, number> = { faseA: 0, faseB: 0, faseC: 0 };
    for (const bucket of FASE_BUCKETS) {
      const sv = [...eq.densidadeVisivelPorFase[bucket]].sort((a, b) => a - b);
      const sc = [...eq.densidadeComparavelPorFase[bucket]].sort((a, b) => a - b);
      densidadeMediaVisivel[bucket] = mean(sv);
      densidadeMediaComparavel[bucket] = mean(sc);
      densidadePopVisivel[bucket] = sv.length;
      densidadePopComparavel[bucket] = sc.length;
      out +=
        `  ${FASE_BUCKET_LABEL[bucket].padEnd(22)} ${"visivel".padEnd(11)} ${mean(sv).toFixed(3).padStart(7)} ` +
        `${percentile(sv, 50).toFixed(3).padStart(8)} ${percentile(sv, 10).toFixed(3).padStart(7)} ` +
        `${percentile(sv, 90).toFixed(3).padStart(7)} ${String(sv.length).padStart(9)}\n`;
      out +=
        `  ${FASE_BUCKET_LABEL[bucket].padEnd(22)} ${"comparavel".padEnd(11)} ${mean(sc).toFixed(3).padStart(7)} ` +
        `${percentile(sc, 50).toFixed(3).padStart(8)} ${percentile(sc, 10).toFixed(3).padStart(7)} ` +
        `${percentile(sc, 90).toFixed(3).padStart(7)} ${String(sc.length).padStart(9)}\n`;
    }

    out += "\n  MISTURA DE TIPOS POR BUCKET (contagem somada sobre as partidas do tier, ordem decrescente):\n";
    for (const bucket of FASE_BUCKETS) {
      const porKind = eq.eventosPorFasePorKind[bucket];
      const total = Object.values(porKind).reduce((s: number, n) => s + (n ?? 0), 0);
      const entries = Object.entries(porKind).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
      out += `  ${FASE_BUCKET_LABEL[bucket]} (total ${total} eventos em ${eq.games} partidas):\n`;
      for (const [kind, n] of entries) {
        out += `    ${kind.padEnd(24)} ${String(n).padStart(7)}  ${pctOf(n ?? 0, total)}\n`;
      }
    }

    out += "\n  PROVA DO MAPEAMENTO (identidade contra o estado final, tier EQUILIBRADO):\n";
    out += `    partidas em que soma(familia abates) != user.kills+rival.kills: ${eq.identidadeAbatesFalhas}/${eq.games}\n`;
    out += `    partidas em que soma(familia torres) != towersTotalFull:        ${eq.identidadeTorresFalhas}/${eq.games}\n`;
    out +=
      "    NOTA (residuo ESPERADO, nao falha de instrumento): decorateMultikill (engine.ts) so\n" +
      "    resume o MAIOR matador do lado VENCEDOR por luta -- os demais abates da mesma luta,\n" +
      "    inclusive TODAS as trocas do lado perdedor, nao emitem evento individual. O Arauto\n" +
      "    derruba estrutura de verdade mas emite SEMPRE kind=tower_low (structures.ts:1138,\n" +
      "    criterio OBJ-01/heuristica A3), o mesmo residuo que D-25-04 ja registra para\n" +
      "    towersDestroyed. As duas lacunas sao PRE-EXISTENTES a este plano (nenhuma linha de\n" +
      "    src/sim/ foi tocada aqui) e sao exatamente o buraco narrativo que NAR-01/D-01/D-02\n" +
      "    (planos 26-07 e 26-09) atacam depois: a densidade VISIVEL medida acima ja mostra o\n" +
      "    tamanho do buraco sem precisar de nenhuma linha nova de src/sim/.\n";

    // -------------------------------------------------------------------------
    // FASE 26, PLANO 26-03, TASK 2: as seis bandas de densidade de eventos por
    // FASE DE JOGO (NAR-01), transcritas do BLOCO 6 de docs/diagnostics/26-ancoragem.md
    // sem recalcular.
    //
    // (1) POR QUE O GATE E POR FASE E NAO GLOBAL: o criterio 4 do ROADMAP.md desta
    // fase e explicito -- "um gate global mediria a media certa e produziria a forma
    // errada". O global (2,319 eventos/min, BLOCO 5.6 da ancoragem) esconde uma
    // variacao real de quase o dobro entre o bucket mais vazio (faseA) e o mais cheio
    // (faseC); tres bandas por leitura, uma por bucket, e a unica forma de o gate
    // enxergar essa variacao em vez de escondê-la atras de uma media.
    //
    // (2) POR QUE AS FRONTEIRAS SAO 840s E 1200s: sao os mesmos limiares de
    // `faseDoInstante` (acima, herdados do plano 26-01) e NUNCA o enum interno de
    // fase da engine (`state.phase`), cuja segunda fronteira vale 1500s
    // (LATE_PHASE_AT) e nao 1200s -- usar o enum interno mediria outra grandeza sem
    // avisar.
    //
    // (3) AS DUAS LEITURAS: a COMPARAVEL conta so os tipos com contraparte externa
    // (EVENT_KINDS_COMPARAVEIS: abates, torres, objetivos epicos), a mesma familia
    // que STACK.md secao 5 mede em partida pro real. A VISIVEL conta TODO EventKind
    // do playback (placas, ganks sem abate, alertas de torre, camada contextual
    // pt-BR incluidos) -- e ela que o criterio 4 cobra, porque e ela que o usuario
    // assiste, mas so a comparavel tem procedencia externa completa dos dois lados
    // da banda.
    //
    // (4) O QUE O TETO PROVISORIO DA VISIVEL PROTEGE: as tres bandas visiveis tem
    // `provisional: true` porque nenhum dataset externo cobre a camada de anotacao
    // da engine. O teto de cada uma e o proprio valor pre-motor do BLOCO 5, ancorado
    // para que o recheio narrativo do plano 26-07 nao resolva o vazio do corte de
    // abates inundando o ticker de ruido: a fase pode REDISTRIBUIR densidade entre
    // fases, nunca aumentar o volume visivel total acima do que ja existia hoje.
    // -------------------------------------------------------------------------

    /** Minimo de partidas com exposicao por bucket, declarado no proprio codigo (T-26-08). */
    const MIN_POPULACAO_DENSIDADE = 50;

    /** Marca a linha de veredito com a populacao do bucket, sem esconder N pequeno em silencio. */
    function comExposicao(r: BandResult, n: number): BandResult {
      const aviso = n < MIN_POPULACAO_DENSIDADE ? " POPULACAO INSUFICIENTE" : "";
      return { ...r, line: `${r.line} [N=${n} partidas com exposicao${aviso}]` };
    }

    const FONTE_DENSIDADE_COMPARAVEL =
      "STACK.md secao 5 (BLOCO 6 de docs/diagnostics/26-ancoragem.md, interpolacao explicita ate 14:00)";
    const FONTE_DENSIDADE_VISIVEL_A =
      "STACK.md secoes 4.3 (placas) + 5; teto provisorio ancorado no BLOCO 5 de 26-ancoragem.md";
    const FONTE_DENSIDADE_VISIVEL =
      "STACK.md secao 5; teto provisorio ancorado no BLOCO 5 de 26-ancoragem.md";

    /** As seis bandas de densidade, na ordem exata da tabela final do BLOCO 6. */
    const bandasDensidade: BandResult[] = [
      comExposicao(
        checkBand("densidade comparavel 0-14min (eventos/min)", densidadeMediaComparavel.faseA, {
          floor: 0.46,
          ceiling: 0.68,
          target: 0.57,
          source: FONTE_DENSIDADE_COMPARAVEL,
          owner: "Fase 26",
        }),
        densidadePopComparavel.faseA
      ),
      comExposicao(
        checkBand("densidade comparavel 14-20min (eventos/min)", densidadeMediaComparavel.faseB, {
          floor: 1.19,
          ceiling: 1.79,
          target: 1.49,
          source: FONTE_DENSIDADE_COMPARAVEL,
          owner: "Fase 26",
        }),
        densidadePopComparavel.faseB
      ),
      comExposicao(
        checkBand("densidade comparavel 20min+ (eventos/min)", densidadeMediaComparavel.faseC, {
          floor: 1.33,
          ceiling: 1.99,
          target: 1.66,
          source: `${FONTE_DENSIDADE_COMPARAVEL}, 25:00 como proxy declarado do bucket aberto`,
          owner: "Fase 26",
        }),
        densidadePopComparavel.faseC
      ),
      comExposicao(
        checkBand("densidade visivel 0-14min (eventos/min)", densidadeMediaVisivel.faseA, {
          floor: 0.46,
          ceiling: 1.9,
          target: 1.16,
          source: FONTE_DENSIDADE_VISIVEL_A,
          owner: "Fase 26",
          provisional: true,
        }),
        densidadePopVisivel.faseA
      ),
      comExposicao(
        checkBand("densidade visivel 14-20min (eventos/min)", densidadeMediaVisivel.faseB, {
          floor: 1.19,
          ceiling: 2.1,
          target: 1.49,
          source: FONTE_DENSIDADE_VISIVEL,
          owner: "Fase 26",
          provisional: true,
        }),
        densidadePopVisivel.faseB
      ),
      comExposicao(
        checkBand("densidade visivel 20min+ (eventos/min)", densidadeMediaVisivel.faseC, {
          floor: 1.33,
          ceiling: 3.6,
          target: 1.66,
          source: FONTE_DENSIDADE_VISIVEL,
          owner: "Fase 26",
          provisional: true,
        }),
        densidadePopVisivel.faseC
      ),
    ];

    // Impressao explicita das seis linhas, verdes ou vermelhas: formatBandTable(bandResults)
    // ja rodou mais acima no arquivo (antes deste bloco existir), entao uma banda visivel que
    // nasce OK nunca apareceria em lugar nenhum do relatorio se dependesse so da tabela
    // principal ou da mensagem de expectBands (que so lista violacoes).
    out += "\n=== AS SEIS BANDAS DE DENSIDADE (Fase 26, doze numeros do BLOCO 6) ===\n";
    out += formatBandTable(bandasDensidade.map(marcarAposentada)) + "\n";
    for (const b of bandasDensidade) bandResults.push(b);

    // -------------------------------------------------------------------------
    // Criterio 5 da Fase 25 e a predicao a verificar do roadmap. OBSERVACAO PURA.
    //
    // ESTE PONTO E O CORACAO DO BLOCO E NAO PODE SER RELAXADO: as seis linhas abaixo
    // sao calculadas por checkBand (para herdar o formato e a obrigatoriedade de fonte
    // e dono) mas vivem numa lista PROPRIA, que NUNCA e passada a expectBands. Cinco
    // delas sao metricas DERIVADAS (duracao, fracao no teto de 60 min, baroes, Alma,
    // Elder), e transformar metrica derivada em meta e o erro que a tabela de invariantes
    // do milestone proibe nominalmente, e foi o erro que a v2.0 cometeu ao fechar 13 de 13
    // criterios verdes numa engine de 51 minutos. Aqui elas existem para registrar a
    // ORDEM de entrada em banda, nunca para reprovar.
    // -------------------------------------------------------------------------
    const duracaoMediaMin = mean(eq.durationSec) / 60;
    const fracaoNoCap60 = eq.capGames / eq.games;
    const baroesPorPartida = mean(eq.baronsPerGame);
    const fracaoAlma = eq.soulGames / eq.games;
    const fracaoElder = eq.elderGames / eq.games;

    const FONTE_ACEITE_BASELINE =
      "banda final de aceite do baseline v2.2 (docs/baselines/24-baseline-v2.2.md)";
    const DONO_ACEITE_FINAL = "Fase 30 (criterio 5, aceite final do milestone)";

    /** Alavanca-raiz do criterio 5: e a unica linha do bloco que a Fase 25 possui. */
    const alavancaRaiz = checkBand("torres/min (alavanca-raiz)", torresMin, {
      floor: 0.3,
      ceiling: 0.45,
      target: 0.37,
      source: "STACK.md secao 7",
      owner: "Fase 25",
    });

    /** As cinco DERIVADAS. Observadas ao lado da banda final de aceite, nunca asseridas. */
    const derivadasObservadas: BandResult[] = [
      checkBand("duracao media da partida (min)", duracaoMediaMin, {
        floor: 29,
        ceiling: 36,
        source: FONTE_ACEITE_BASELINE,
        owner: DONO_ACEITE_FINAL,
      }),
      checkBand("fracao de partidas no teto de 60 minutos", fracaoNoCap60, {
        floor: 0,
        ceiling: 0.005,
        source: FONTE_ACEITE_BASELINE,
        owner: DONO_ACEITE_FINAL,
      }),
      checkBand("baroes por partida", baroesPorPartida, {
        floor: 0.9,
        ceiling: 1.8,
        source: "STACK.md secao 7",
        owner: DONO_ACEITE_FINAL,
      }),
      checkBand("fracao de partidas com Alma", fracaoAlma, {
        floor: 0.3,
        ceiling: 0.55,
        source: "STACK.md secao 7",
        owner: DONO_ACEITE_FINAL,
      }),
      checkBand("fracao de partidas com Elder", fracaoElder, {
        floor: 0.04,
        ceiling: 0.18,
        source: "STACK.md secao 7",
        owner: DONO_ACEITE_FINAL,
      }),
    ];

    const derivadasDentro = derivadasObservadas.filter((r) => r.ok);
    let vereditoOrdemEntrada: string;
    if (alavancaRaiz.ok && derivadasDentro.length > 0) {
      vereditoOrdemEntrada = "predicao confirmada parcialmente";
    } else if (!alavancaRaiz.ok && derivadasDentro.length > 0) {
      vereditoOrdemEntrada =
        "ALERTA: derivada entrou em banda antes da alavanca-raiz. Verificar atribuicao causal.";
    } else if (alavancaRaiz.ok) {
      vereditoOrdemEntrada = "predicao pendente, alavanca-raiz corrigida primeiro (ordem correta)";
    } else {
      vereditoOrdemEntrada =
        "predicao ainda nao exercida: nem a alavanca-raiz nem nenhuma derivada entrou em banda. " +
        "A Fase 25 ainda nao comecou a mover a alavanca-raiz.";
    }

    out += "\n=== ORDEM DE ENTRADA EM BANDA (predicao da Fase 25, observacao) ===\n";
    out +=
      "Predicao a verificar do ROADMAP.md, Fase 25, que NAO pode virar criterio de parada:\n" +
      "duracao, baroes, Alma e Elder devem cair sozinhos para perto da banda. Se qualquer\n" +
      "um deles entrar na banda ANTES de torres/min entrar, o conserto veio pelo canal errado.\n" +
      "Nenhuma linha abaixo entra na lista avaliada por expectBands: e observacao, nao gate.\n\n";
    out += `  ${"metrica".padEnd(46)} ${"medido".padStart(9)}  ${"banda de aceite".padEnd(16)} situacao\n`;
    out += ordemEntradaLinha(alavancaRaiz);
    for (const r of derivadasObservadas) out += ordemEntradaLinha(r);
    out += `\n  VEREDITO: ${vereditoOrdemEntrada}\n`;
    out +=
      `  (alavanca-raiz ${alavancaRaiz.ok ? "DENTRO" : "FORA"}; derivadas DENTRO: ` +
      `${derivadasDentro.length} de ${derivadasObservadas.length})\n`;
    out +=
      "\nA regua medida no 25-RESEARCH.md (Achado 10), para o veredito acima ter escala:\n" +
      "na taxa 2 de acumulo torres/min entra em banda com 0,321 e NENHUMA derivada entrou\n" +
      "(duracao 42:20, baroes 3,07, Alma 91 por cento, Elder 73 por cento). As derivadas so\n" +
      "chegam perto na taxa 6, e la torres/min ja estourou o teto com 0,517. Ou seja: derivada\n" +
      "entrando antes da alavanca-raiz e o sinal de que o conserto veio pelo canal errado.\n";

    out += "\n=== SATURACAO DE goldFightMult / goldSecureMult (INST-08) ===\n";
    out += `  subamostra: tier EQUILIBRADO, primeiras ${CLAMP_SUBSAMPLE_GAMES} partidas, ambos os lados, toda a timeline\n`;
    out += `  total de amostras: ${clampStats.totalSamples}\n`;
    out += `  goldFightMult no piso  (${FIGHT_FLOOR}): ${pctOf(clampStats.fightFloor, clampStats.totalSamples)}\n`;
    out += `  goldFightMult no teto  (${FIGHT_CEIL}): ${pctOf(clampStats.fightCeil, clampStats.totalSamples)}\n`;
    out += `  goldSecureMult no piso (${SECURE_FLOOR}): ${pctOf(clampStats.secureFloor, clampStats.totalSamples)}\n`;
    out += `  goldSecureMult no teto (${SECURE_CEIL}): ${pctOf(clampStats.secureCeil, clampStats.totalSamples)}\n`;
    out += "  leitura (contrato da spec 2026-10-02 secao 2): o multiplicador e (2 x fatia do time no\n";
    out += "  ouro total) elevado ao expoente de ouro, entre os clamps acima, e se apaga quando o time\n";
    out += "  mais pobre fecha a build. Fracao alta no piso ou no teto indica que o clamp, e nao o\n";
    out += "  ouro relativo, esta decidindo a luta. Amostra no instante de cada evento, os dois lados.\n";

    try {
      mkdirSync("tmp", { recursive: true });
    } catch {
      // ja existe
    }
    writeFileSync("tmp/calibration-pace.txt", out);
    console.log(out);

    // -------------------------------------------------------------------------
    // ASSERTS DUROS (D-02) -- invariantes fisicos de plausibilidade, zero absoluto.
    // Rodam DEPOIS da escrita do relatorio: a rodada vermelha ainda produz relatorio
    // completo (T-23-12).
    // -------------------------------------------------------------------------
    for (const tier of TIERS) {
      const st = results.get(tier.name)!;
      expect(
        st.firstTowerBefore420,
        `primeira torre antes de 7:00 (420s) no tier ${tier.name} -- assert duro ` +
          `(STACK.md secao 7: minimo absoluto observado 8:15 em 500 jogos pro)`
      ).toBe(0);
    }
    for (const tier of TIERS) {
      const st = results.get(tier.name)!;
      expect(
        st.baronBeforeSpawn,
        `Baron antes de 20:00 (1200s) no tier ${tier.name} -- assert duro ` +
          `(regra dura herdada da v2.0, ja garantida hoje)`
      ).toBe(0);
    }

    // -------------------------------------------------------------------------
    // ASSERTS TOLERANTES (D-02) -- bandas de dois lados; expectBands agrega todas
    // as violacoes numa unica falha, cada uma com a fase dona (T-23-11). Inclui
    // R1-R3 (relacoes metamorficas de invariancia de nivel, INST-05).
    // As bandas de BANDAS_APOSENTADAS_TASK9 e de BANDAS_APOSENTADAS_CALENDARIO ficam
    // fora do assert (so relatorio).
    // -------------------------------------------------------------------------
    expectBands(bandResults.filter((r) => !aposentada(r.label)));

    // -------------------------------------------------------------------------
    // R4 (INST-05): assert de ORDENACAO, nao de magnitude -- a sequencia de
    // win-rate por gap de forca dentro do nivel pro deve ser nao-decrescente
    // (STACK.md secao 6.1: a curva de win-rate e monotonica na vantagem).
    // -------------------------------------------------------------------------
    expect(
      r4Sequence,
      `R4: sequencia de win-rate por gap (EQUILIBRADO->GAP-LEVE->PRO-GAP->GAP-30) deve ser ` +
        `nao-decrescente: [${r4Sequence.map((v) => v.toFixed(3)).join(", ")}]`
    ).toEqual(r4Sorted);

    // -------------------------------------------------------------------------
    // ORDENACAO INTER-CAMADA (Fase 25 / criterio 3 do roadmap, PACE-04): assert de
    // ORDENACAO, nao de magnitude, no mesmo padrao de R4 e tambem depois da escrita
    // do relatorio. Nenhum numero novo e inventado: so a ordem entre duas medicoes
    // da MESMA rodada e do MESMO tier EQUILIBRADO e verificada.
    //
    // O criterio 3 diz com todas as letras que a razao de torres vencedor sobre
    // perdedor tem de ser maior que a razao de abates medida na mesma rodada. Hoje a
    // ordem esta invertida (torres 1,44 contra abates cerca de 2,15), e essa inversao
    // e o sintoma central da fase: a camada estrutural e a que menos separa vencedor
    // de perdedor, porque quase nao existe.
    // -------------------------------------------------------------------------
    expect(
      razaoTorresVencedorPerdedor > razaoAbatesVencedorPerdedor,
      `ordenacao inter-camada (ROADMAP.md Fase 25 criterio 3): a razao de torres vencedor sobre ` +
        `perdedor (${razaoTorresVencedorPerdedor.toFixed(3)}) deve ser MAIOR que a razao de abates ` +
        `vencedor sobre perdedor (${razaoAbatesVencedorPerdedor.toFixed(3)}), medidas na mesma rodada ` +
        `e no mesmo tier EQUILIBRADO`
    ).toBe(true);

    // -------------------------------------------------------------------------
    // TERCEIRO TERMO DA ORDENACAO INTER-CAMADA (ROADMAP.md Fase 27 criterio 3):
    // o criterio completo da Fase 27 pede a cadeia de tres razoes, nao so duas --
    // estrutura (torres) > combate (abates) > economia (ouro/min). Instrumento
    // antes do motor: este assert existe ANTES de qualquer linha de src/sim/ mudar
    // nesta fase, no mesmo padrao do assert torres-contra-abates acima (que
    // permanece intocado, herdado da Fase 25 e com mensagem propria).
    //
    // Medido nesta onda (docs/diagnostics/27-ancoragem.md Bloco 5), a folga entre
    // as duas razoes e estreita (abates ~1,054 contra ouro ~1,038, margem de 0,016
    // no tier EQUILIBRADO): pela comparacao isolada este termo passaria raspando
    // hoje. MAS a ordem nao esta ESTABELECIDA: nenhuma banda de ouro (ECO-01/
    // ECO-02) fechou ainda, e as ondas seguintes desta fase (que escalam ouro
    // ~2,5-3x) e a Fase 26 (que corta abates ~40%) vao mover as duas razoes por
    // caminhos independentes, podendo inverter a margem estreita medida hoje.
    // Registro honesto sobre ESTA execucao: o `expectBands(bandResults)` logo
    // acima ja lanca (ha bandas FALHA hoje, nascidas vermelhas por design,
    // DEC-02), entao este `expect` e o do par torres-abates acima dele NUNCA
    // sao alcancados na pratica enquanto qualquer banda anterior estiver vermelha
    // -- comportamento herdado, nao introduzido por esta mudanca. O gate fica
    // pronto para disparar assim que as bandas anteriores fecharem. O plano dono
    // do fechamento estavel desta ordenacao e o 27-06 (sweep do valor de goldScale, removido na spec 2026-10-02).
    // -------------------------------------------------------------------------
    expect(
      razaoAbatesVencedorPerdedor > razaoOuroMinVencedorPerdedor,
      `ordenacao inter-camada (ROADMAP.md Fase 27 criterio 3): a razao de abates vencedor sobre ` +
        `perdedor (${razaoAbatesVencedorPerdedor.toFixed(3)}) deve ser MAIOR que a razao de ouro/min ` +
        `vencedor sobre perdedor (${razaoOuroMinVencedorPerdedor.toFixed(3)}), medidas na mesma rodada ` +
        `e no mesmo tier EQUILIBRADO`
    ).toBe(true);
  });
});
