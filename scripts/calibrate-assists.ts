/**
 * scripts/calibrate-assists.ts
 *
 * Gate de distribuicao de assistencia por rota (Fase 24 / AST-01 + AST-02).
 * Executar: npm run calibrate:assists  (via vitest, config dedicada)
 * Relatorio: tmp/calibration-assists.txt
 *
 * E o unico harness do projeto que roda COM CAMPEOES ATRIBUIDOS, que e o caminho
 * real do app e onde o defeito de assistencia e pior. Os seis harnesses anteriores
 * rodam sobre fixture flat sem campeao; o unico ponto que media assistencia de ADC
 * (scripts/calibrate-pace.ts:347) declara na propria nota que a medicao roda sem
 * campeoes e que a medicao definitiva pertence a Fase 24. Este arquivo e ela.
 *
 * ESTE GATE NASCE VERMELHO DE PROPOSITO (mesmo espirito de DEC-02 da Fase 23).
 * Com o codigo de hoje espera-se top, mid e ADC em ZERO ABSOLUTO de assistencias
 * no conjunto com campeoes: o filtro duro de src/sim/selection.ts corta abaixo de
 * ASSIST_MIN_SCORE e campeoes carry carregam meta.assistBias 0,50, derrubando o
 * score dessas rotas. Esse vermelho e a leitura CORRETA do criterio 1 do roadmap
 * da Fase 24, nao um bug do harness. O conserto do motor pertence ao Plano 24-02.
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = i por partida, nunca seed compartilhada
 *   - Sem Math.random nem qualquer fonte de aleatoriedade da plataforma:
 *     apenas mulberry32(seed), uma instancia nova por partida
 *   - Este arquivo NUNCA modifica src/sim/: le o estado final da partida e mais
 *     nada (git status --porcelain -- src/sim fica vazio)
 *   - Relatorio escrito ANTES de qualquer assercao: a rodada vermelha, que e o
 *     desfecho esperado hoje, ainda produz relatorio completo (T-24-05)
 *   - Toda banda passa por checkBand (scripts/bands.ts): assert de um lado so
 *     (so piso ou so teto) e proibido neste arquivo
 *   - So metrica RAIZ vira banda ASSERIDA. A contagem de assistencias por partida
 *     e derivada (taxa vezes volume de abates) e o volume e alavanca declarada da
 *     Fase 26: ela e OBSERVADA aqui, com banda impressa, nunca asserida (T-24-26)
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { describe, it, expect, vi } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES, DEFAULT_SIM_CONFIG } from "../src/sim/matchState";
import { championMetaFor } from "../src/sim/championMeta";
import * as selectionModule from "../src/sim/selection";
import { mean, summarize } from "./stats";
import { checkBand, expectBands, formatBandTable, type BandResult } from "./bands";
import type { PlayerVersion, Role } from "../src/data/schema";
import type { SimulationResult } from "../src/sim/engine";
import type { EventKind } from "../src/sim/simEvents";

// ---------------------------------------------------------------------------
// Configuracao
// ---------------------------------------------------------------------------

/** Numero de partidas por conjunto de campeoes. Mesmo N dos demais harnesses, e
 *  N >= 800 e exigencia LITERAL do criterio 1 da Fase 24 no ROADMAP.md
 *  ("com campeoes atribuidos e N >= 800 partidas, nenhuma rota fica em 0,00"). */
const N = 800;

/** Overall dos dois lados nos tres conjuntos: o tier EQUILIBRADO 75x75 ja usado
 *  por scripts/calibrate-pace.ts (TIERS[0]). Nenhum tier de gap e criado aqui:
 *  esta fase e sobre distribuicao de assistencia por rota, nao sobre curva de
 *  forca (essa e Fase 28 / FRC-02). */
const OVERALL_USER = 75;
const OVERALL_RIVAL = 75;

// ---------------------------------------------------------------------------
// Builders de fixture flat (copiados verbatim de calibrate-pace.ts:68-90, que por
// sua vez os copiou de calibrate-structures.ts:57-79). Repeticao deliberada por
// arquivo, convencao da secao 3 de scripts/README.md: cada harness precisa ser
// legivel isoladamente. Stat uniforme em todos os campos -> neutralidade (INV-1).
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
// Tres conjuntos de campeoes, cada um com um papel declarado no gate
//
// Os mapas usam os identificadores de jogador que `roster` produz (prefixo do
// lado, hifen, nome da rota) e sao SIMETRICOS: os dois lados recebem o mesmo
// conjunto, para que a medicao continue neutra e a win-rate fique perto de 50%.
// ---------------------------------------------------------------------------

interface Conjunto {
  nome: string;
  /** por que este conjunto existe no gate (vai literal para o relatorio) */
  papel: string;
  /** rota -> championId, ou null quando a rota roda sem campeao atribuido */
  campeoes: Record<Role, string | null>;
}

const CONJUNTOS: Conjunto[] = [
  {
    // Quatro rotas com meta.assistBias IDENTICO (0,50: darius, viego, leblanc e
    // vayne) e um suporte tipico (thresh, 1,80). E o conjunto CONTROLADO: qualquer
    // diferenca medida entre top, jungle, mid e ADC so pode vir do modelo de rota
    // e do volume de abates, nunca da escolha de campeao. E onde as bandas e a
    // ordenacao sao asseridas.
    nome: "CONTROLE-CARRIES",
    papel:
      "conjunto controlado: quatro rotas com o mesmo meta.assistBias (0,50) mais um suporte tipico (1,80). " +
      "Qualquer diferenca entre top, jungle, mid e ADC vem do modelo de rota e do volume de abates, nunca do campeao. " +
      "E onde as bandas e a ordenacao sao asseridas",
    campeoes: {
      top: "darius",
      jungle: "viego",
      mid: "leblanc",
      adc: "vayne",
      support: "thresh",
    },
  },
  {
    // Composicao arquetipica plausivel, com gradiente suave de meta.assistBias
    // (gnar 0,90 / elise 0,70 / azir 0,90 / ashe 0,80 / leona 1,90). Existe para
    // provar que o defeito nao e artefato de uma escolha ruim de campeao.
    nome: "MISTO",
    papel:
      "composicao arquetipica plausivel, com gradiente suave de meta.assistBias. " +
      "Existe para provar que o defeito nao e artefato de uma escolha ruim de campeao",
    campeoes: {
      top: "gnar",
      jungle: "elise",
      mid: "azir",
      adc: "ashe",
      support: "leona",
    },
  },
  {
    // Controle negativo: reproduz exatamente a condicao ja medida por
    // calibrate-pace.ts e pelo Cenario A de docs/diagnostics/engine-diagnose.txt,
    // para que os dois relatorios sejam comparaveis linha a linha. Sem campeao
    // atribuido, championMetaFor cai em ROLE_DEFAULTS (src/sim/championMeta.ts).
    nome: "SEM-CAMPEOES",
    papel:
      "controle negativo: reproduz a condicao ja medida por calibrate-pace.ts e pelo Cenario A de " +
      "docs/diagnostics/engine-diagnose.txt, para que os dois relatorios sejam comparaveis linha a linha",
    campeoes: { top: null, jungle: null, mid: null, adc: null, support: null },
  },
];

/** Mapa playerId -> championId para um lado, pulando as rotas sem campeao. */
function mapaCampeoes(prefixo: string, conjunto: Conjunto): Record<string, string> {
  const out: Record<string, string> = {};
  for (const role of ROLES) {
    const champ = conjunto.campeoes[role];
    if (champ !== null) out[`${prefixo}-${role}`] = champ;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Coletor por conjunto: TODAS as somas percorrem ROLES e os dois lados
// ---------------------------------------------------------------------------

interface ConjuntoStats {
  partidas: number;
  vitoriasUser: number;
  /** pares (partida, lado) observados: partidas x 2 */
  observacoes: number;

  /** soma de assistencias da rota sobre todas as partidas e os dois lados.
   *  E o numerador da elegibilidade estrutural (H1). */
  assistsTotais: Record<Role, number>;
  /** soma de abates da rota sobre todas as partidas e os dois lados */
  killsTotais: Record<Role, number>;
  /** soma de abates do time sobre todas as partidas e os dois lados */
  abatesDoTime: number;
  /** pares (partida, lado) em que a rota terminou com zero assistencias */
  observacoesComZeroAssist: Record<Role, number>;
  /** serie por partida com a media dos dois lados, para os cinco percentis */
  assistsPorPartidaPorJogador: Record<Role, number[]>;
  /** serie por partida da media dos dois lados de assistencias do ADC */
  adcAssistsPorPartida: number[];
}

function zeroPorRota(): Record<Role, number> {
  return { top: 0, jungle: 0, mid: 0, adc: 0, support: 0 };
}

function seriePorRota(): Record<Role, number[]> {
  return { top: [], jungle: [], mid: [], adc: [], support: [] };
}

function emptyStats(): ConjuntoStats {
  return {
    partidas: 0,
    vitoriasUser: 0,
    observacoes: 0,
    assistsTotais: zeroPorRota(),
    killsTotais: zeroPorRota(),
    abatesDoTime: 0,
    observacoesComZeroAssist: zeroPorRota(),
    assistsPorPartidaPorJogador: seriePorRota(),
    adcAssistsPorPartida: [],
  };
}

function analisar(res: SimulationResult, st: ConjuntoStats): void {
  st.partidas++;
  if (res.winner === "user") st.vitoriasUser++;

  const user = res.finalState.user.players;
  const rival = res.finalState.rival.players;

  for (const players of [user, rival]) {
    st.observacoes++;
    for (const role of ROLES) {
      const p = players[role];
      st.assistsTotais[role] += p.assists;
      st.killsTotais[role] += p.kills;
      st.abatesDoTime += p.kills;
      if (p.assists === 0) st.observacoesComZeroAssist[role]++;
    }
  }

  for (const role of ROLES) {
    st.assistsPorPartidaPorJogador[role].push(
      (user[role].assists + rival[role].assists) / 2
    );
  }

  // Calculado exatamente como em scripts/calibrate-pace.ts:347 (media dos dois
  // lados), para que os dois numeros sejam comparaveis linha a linha.
  st.adcAssistsPorPartida.push((user.adc.assists + rival.adc.assists) / 2);
}

// ---------------------------------------------------------------------------
// Laco deterministico por conjunto
// ---------------------------------------------------------------------------

function rodarConjunto(conjunto: Conjunto): ConjuntoStats {
  const st = emptyStats();
  const userChampions = mapaCampeoes("u", conjunto);
  const rivalChampions = mapaCampeoes("r", conjunto);

  for (let seed = 0; seed < N; seed++) {
    // INVARIANTE: seed = i por partida, instancia nova de gerador por partida,
    // nunca seed compartilhada, nunca fonte de aleatoriedade da plataforma.
    const res = simulateMatch(
      roster("u", OVERALL_USER),
      roster("r", OVERALL_RIVAL),
      mulberry32(seed),
      DEFAULT_SIM_CONFIG,
      { userChampions, rivalChampions }
    );
    analisar(res, st);
  }

  return st;
}

// ---------------------------------------------------------------------------
// Metricas derivadas do coletor (todas calculadas na montagem do relatorio)
// ---------------------------------------------------------------------------

interface MetricasConjunto {
  /** media de assistencias por jogador por partida */
  assistenciasPorRota: Record<Role, number>;
  /** (abates + assistencias da rota) sobre abates do proprio time.
   *  Definicao identica a de scripts/calibrate-micro.ts:372-378. */
  participacao: Record<Role, number>;
  /** assistencias da rota sobre a soma de assistencias das cinco rotas */
  shareDeAssists: Record<Role, number>;
  /** assistencias da rota sobre abates do proprio time */
  assistsPorAbateDoTime: Record<Role, number>;
  /** fracao de pares (partida, lado) com zero assistencias na rota */
  fracaoZero: Record<Role, number>;
  /** soma das cinco rotas de assistencias sobre abates do time (achado agregado) */
  razaoAgregada: number;
  /** soma de assistencias das cinco rotas, sobre todas as partidas e lados */
  somaAssists: number;
}

function derivar(st: ConjuntoStats): MetricasConjunto {
  const somaAssists = ROLES.reduce((s, r) => s + st.assistsTotais[r], 0);

  const assistenciasPorRota = zeroPorRota();
  const participacao = zeroPorRota();
  const shareDeAssists = zeroPorRota();
  const assistsPorAbateDoTime = zeroPorRota();
  const fracaoZero = zeroPorRota();

  for (const role of ROLES) {
    assistenciasPorRota[role] =
      st.observacoes > 0 ? st.assistsTotais[role] / st.observacoes : 0;
    participacao[role] =
      st.abatesDoTime > 0
        ? (st.killsTotais[role] + st.assistsTotais[role]) / st.abatesDoTime
        : 0;
    shareDeAssists[role] = somaAssists > 0 ? st.assistsTotais[role] / somaAssists : 0;
    assistsPorAbateDoTime[role] =
      st.abatesDoTime > 0 ? st.assistsTotais[role] / st.abatesDoTime : 0;
    fracaoZero[role] =
      st.observacoes > 0 ? st.observacoesComZeroAssist[role] / st.observacoes : 0;
  }

  return {
    assistenciasPorRota,
    participacao,
    shareDeAssists,
    assistsPorAbateDoTime,
    fracaoZero,
    razaoAgregada: st.abatesDoTime > 0 ? somaAssists / st.abatesDoTime : 0,
    somaAssists,
  };
}

// ---------------------------------------------------------------------------
// Helpers de formatacao pt-BR
// ---------------------------------------------------------------------------

function f3(x: number): string {
  return Number.isFinite(x) ? x.toFixed(3) : "n/a";
}

function pct(x: number): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "n/a";
}

function blocoConjunto(conjunto: Conjunto, st: ConjuntoStats, m: MetricasConjunto): string {
  let out = `\n--- Conjunto: ${conjunto.nome} (${st.partidas} partidas, ${st.observacoes} observacoes partida x lado) ---\n`;
  out += `  papel no gate: ${conjunto.papel}\n`;
  out += `  overall dos dois lados: ${OVERALL_USER} contra ${OVERALL_RIVAL} (tier EQUILIBRADO de calibrate-pace.ts)\n`;
  out += `  win-rate lado user: ${pct(st.partidas > 0 ? st.vitoriasUser / st.partidas : 0)} (linha de sanidade de neutralidade: conjunto simetrico deve ficar perto de 50%)\n`;
  out += "  campeoes atribuidos (meta.assistBias entre parenteses):\n";
  for (const role of ROLES) {
    const champ = conjunto.campeoes[role];
    const bias = championMetaFor(champ, role).assistBias;
    const nome = champ === null ? "(nenhum, cai em ROLE_DEFAULTS)" : champ;
    out += `    ${role.padEnd(8)} ${nome.padEnd(30)} (assistBias ${f3(bias)})\n`;
  }
  out += `  abates do time acumulados (dois lados, ${st.partidas} partidas): ${st.abatesDoTime}\n`;
  out += `  assistencias somadas das cinco rotas: ${m.somaAssists}\n`;
  out += "\n";
  out += "  Rota      AssistMed  TotalAssist  FracZero    Share  Assist/AbateTime  Participacao\n";
  out += "  --------  ---------  -----------  --------  -------  ----------------  ------------\n";
  for (const role of ROLES) {
    out +=
      `  ${role.padEnd(8)}  ${f3(m.assistenciasPorRota[role]).padStart(9)}  ` +
      `${String(st.assistsTotais[role]).padStart(11)}  ${pct(m.fracaoZero[role]).padStart(8)}  ` +
      `${pct(m.shareDeAssists[role]).padStart(7)}  ${f3(m.assistsPorAbateDoTime[role]).padStart(16)}  ` +
      `${pct(m.participacao[role]).padStart(12)}\n`;
  }
  out +=
    "  legenda: AssistMed = assistencias medias por jogador por partida; TotalAssist = total acumulado\n" +
    "  em N partidas nos dois lados; FracZero = fracao de observacoes (partida x lado) com zero\n" +
    "  assistencias; Share = fracao das assistencias do time; Assist/AbateTime = assistencias da rota\n" +
    "  sobre abates do proprio time; participacao = (abates + assistencias da rota) sobre abates do\n" +
    "  proprio time, definicao identica a de scripts/calibrate-micro.ts:372-378.\n";

  const s = summarize(st.adcAssistsPorPartida);
  out += "\n";
  out +=
    `  assistencias do ADC por partida (media dos dois lados, calculo identico ao de calibrate-pace.ts:347):\n` +
    `    n ${s.n} | media ${f3(s.mean)} | dp ${f3(s.sd)} | ` +
    `p5 ${f3(s.p5)} p25 ${f3(s.p25)} p50 ${f3(s.p50)} p75 ${f3(s.p75)} p95 ${f3(s.p95)} | ` +
    `min ${f3(s.min)} max ${f3(s.max)}\n`;
  out += `  razao agregada de assistencias por abate do time (cinco rotas somadas): ${f3(m.razaoAgregada)}\n`;

  return out;
}

// ---------------------------------------------------------------------------
// Ordenacao de participacao em abate: assert de ORDENACAO, nao de magnitude
// (mesmo espirito de R4 em scripts/calibrate-pace.ts:797-805)
// ---------------------------------------------------------------------------

/**
 * Ordem exigida de participacao em abate. Fonte: STACK.md secao 7, linha
 * "KP: sup >= jng >= adc >= mid > top, manter a ORDEM, tolerar 8 pontos
 * percentuais, assert de ordenacao", com os valores de referencia de STACK.md
 * secao 4.7: support 74,8; jungle 73,4; ADC 70,0; mid 67,5; top 56,2.
 *
 * AVISO: a ordenacao de ASSISTENCIAS pura e DIFERENTE (support, jungle, mid,
 * ADC, top, registrado no item 2 da secao 4.7). Aplicar a ordenacao de
 * participacao sobre assistencias cruas seria usar a fonte errada.
 */
const ORDEM_PARTICIPACAO: Role[] = ["support", "jungle", "adc", "mid", "top"];

/** Tolerancia de 8 pontos percentuais (STACK.md secao 7). */
const TOLERANCIA_ORDENACAO = 0.08;

function violacoesDeOrdenacao(nome: string, participacao: Record<Role, number>): string[] {
  const violacoes: string[] = [];
  for (let i = 0; i < ORDEM_PARTICIPACAO.length - 1; i++) {
    const antes = ORDEM_PARTICIPACAO[i];
    const depois = ORDEM_PARTICIPACAO[i + 1];
    if (participacao[depois] > participacao[antes] + TOLERANCIA_ORDENACAO) {
      violacoes.push(
        `[${nome}] ordenacao de participacao violada: ${depois} (${pct(participacao[depois])}) ` +
          `supera ${antes} (${pct(participacao[antes])}) em mais de 8 pontos percentuais`
      );
    }
  }
  return violacoes;
}

// ---------------------------------------------------------------------------
// Harness principal
// ---------------------------------------------------------------------------

describe("calibracao de assistencia por rota (Fase 24 / AST-01 + AST-02)", () => {
  it("mede a distribuicao de assistencia por rota nos tres conjuntos de campeoes", () => {
    const stats = new Map<string, ConjuntoStats>();
    const metricas = new Map<string, MetricasConjunto>();

    // -------------------------------------------------------------------------
    // ANCORAGEM DO CRITERIO 6 (Task 2 do plano 26-02): conta os tipos de evento
    // vistos pelo seletor de assistentes (assignAssists, src/sim/selection.ts)
    // durante o conjunto CONTROLADO, para verificar por execucao a suposicao A2
    // de 26-RESEARCH.md e calcular o teto aritmetico de construcao ponderado pela
    // participacao real de cada tipo. assignAssists e PURA e rng-free (nenhum
    // draw de rng dentro dela, ver assinatura em selection.ts): interceptar a
    // chamada so conta e delega para a implementacao original, sem alterar um
    // unico resultado de simulacao nem consumir rng novo (INV-1 preservado).
    // -------------------------------------------------------------------------
    const participacaoControleCarries: Partial<Record<EventKind, number>> = {};
    let chamadasControleCarries = 0;
    const assignAssistsOriginal = selectionModule.assignAssists;
    const assignAssistsSpy = vi
      .spyOn(selectionModule, "assignAssists")
      .mockImplementation((killerId, mates, nAssists, ctx) => {
        chamadasControleCarries++;
        const tipo = ctx.eventType;
        participacaoControleCarries[tipo] = (participacaoControleCarries[tipo] ?? 0) + 1;
        return assignAssistsOriginal(killerId, mates, nAssists, ctx);
      });

    for (const conjunto of CONJUNTOS) {
      const st = rodarConjunto(conjunto);
      stats.set(conjunto.nome, st);
      metricas.set(conjunto.nome, derivar(st));
      if (conjunto.nome === "CONTROLE-CARRIES") {
        // A contagem so importa para o conjunto controlado (mesmo conjunto em que
        // a banda e asserida); restaurar a implementacao original imediatamente
        // depois, para nao instrumentar MISTO/SEM-CAMPEOES sem necessidade.
        assignAssistsSpy.mockRestore();
      }
    }

    // Teto por tipo de evento: NAO e o maximo bruto, e o VALOR ESPERADO de
    // assistentes por abate sob a forma atual do sorteio (nAssists = 1 +
    // Math.floor(rng() * Math.min(4, mates.length)) em applyKill,
    // src/sim/engine.ts, limite elevado de 3 para 4 pelo plano 26-06), cruzado
    // com o cap de ASSIST_COUNT_BY_EVENT[tipo] (src/sim/selection.ts).
    // "Calibracao de distribuicao" (os pesos de assistWeight/ASSIST_MIN_SCORE que
    // decidem QUEM recebe assistencia) nunca move este numero: ela so decide quem
    // entre os companheiros vivos e escolhido, nunca QUANTOS. Com mates.length >= 4
    // no momento do abate (o caso dominante, time cheio), o sorteio e uniforme em
    // {1, 2, 3, 4}, entao o teto por tipo e a media de min(draw, cap) para draw em
    // {1, 2, 3, 4}. Fallback 2 para tipo fora da tabela (ASSIST_COUNT_FALLBACK em
    // src/sim/selection.ts).
    const ASSIST_COUNT_FALLBACK_LOCAL = 2;
    function tetoPorTipo(tipo: EventKind): number {
      const cap = selectionModule.ASSIST_COUNT_BY_EVENT[tipo] ?? ASSIST_COUNT_FALLBACK_LOCAL;
      const efetivo = Math.min(4, cap);
      let soma = 0;
      for (let draw = 1; draw <= 4; draw++) soma += Math.min(draw, efetivo);
      return soma / 4;
    }

    const TIPOS_PREVISTOS_A2: EventKind[] = ["gank", "solo_kill", "comeback_fight"];
    const tiposObservados = Object.keys(participacaoControleCarries) as EventKind[];
    const tiposInesperados = tiposObservados.filter((t) => !TIPOS_PREVISTOS_A2.includes(t));
    const a2Confirmada = tiposInesperados.length === 0;

    let tetoConstrucaoPonderado = 0;
    for (const tipo of tiposObservados) {
      const participacao = participacaoControleCarries[tipo]! / chamadasControleCarries;
      tetoConstrucaoPonderado += participacao * tetoPorTipo(tipo);
    }

    // -------------------------------------------------------------------------
    // Montagem do relatorio
    // -------------------------------------------------------------------------
    let out = "";
    out += "==================================================================\n";
    out += "  CALIBRACAO DE ASSISTENCIA POR ROTA (Fase 24 / AST-01 + AST-02)\n";
    out += "==================================================================\n";
    out += `  N por conjunto: ${N} partidas | conjuntos: ${CONJUNTOS.map((c) => c.nome).join(", ")}\n`;
    out += "  Unico gate do projeto que roda COM CAMPEOES ATRIBUIDOS, que e o caminho real\n";
    out += "  do app e onde o defeito de assistencia e pior.\n";
    out += "  Este gate nasce VERMELHO de proposito: com o codigo de hoje espera-se top, mid\n";
    out += "  e ADC em zero absoluto no conjunto com campeoes. Esse vermelho e a leitura\n";
    out += "  correta do criterio 1 do roadmap da Fase 24, nao um bug do harness.\n";

    for (const conjunto of CONJUNTOS) {
      out += blocoConjunto(conjunto, stats.get(conjunto.nome)!, metricas.get(conjunto.nome)!);
    }

    const controle = metricas.get("CONTROLE-CARRIES")!;

    // -------------------------------------------------------------------------
    // DUAS LISTAS DE BANDA, com nomes diferentes e propositos diferentes.
    //
    // `bandasAsseridas` e a unica lista que chega em expectBands.
    // `linhasObservadas` passa por checkBand, aparece na tabela do relatorio com
    // piso, teto, alvo, fonte e fase dona, e NAO entra em nenhuma assercao.
    //
    // Misturar as duas numa lista so e exatamente o erro que a separacao existe
    // para impedir (T-24-26): a contagem de assistencias por partida e metrica
    // DERIVADA (taxa vezes volume de abates) e o volume pertence a Fase 26.
    // -------------------------------------------------------------------------
    const bandasAsseridas: BandResult[] = [];
    const linhasObservadas: BandResult[] = [];

    // METRICA RAIZ e unica banda quantitativa de nivel asserida pela Fase 24:
    // a taxa nao depende do volume de abates, entao e a unica banda de nivel que
    // esta fase pode fechar sozinha. Avaliada no conjunto CONTROLADO.
    bandasAsseridas.push(
      checkBand(
        "assistencias do ADC por abate do time [CONTROLE-CARRIES]",
        controle.assistsPorAbateDoTime.adc,
        {
          floor: 0.28,
          ceiling: 0.52,
          target: 0.39,
          source:
            "derivado de STACK.md secao 4.7 (o numero nao aparece pronto em tabela nenhuma: " +
            "e o quociente de dois valores citados da mesma secao). bot 2024 com A media 5,22 e " +
            "KP 69,3 por cento resulta em (4,03 + 5,22) / 0,693 = 13,35 abates de time e taxa " +
            "5,22 / 13,35 = 0,391; bot 2023 com A media 4,56 e KP 67,2 por cento resulta em " +
            "(4,09 + 4,56) / 0,672 = 12,87 abates de time e taxa 4,56 / 12,87 = 0,354",
          owner: "Fase 24",
        }
      )
    );

    // OBSERVADAS: contagem de assistencias do ADC por partida, nos tres conjuntos.
    // Piso, teto e alvo IDENTICOS aos ja declarados em scripts/calibrate-pace.ts,
    // cuja fase dona foi reatribuida para Fase 26 no Task 3 deste mesmo plano.
    for (const conjunto of CONJUNTOS) {
      const st = stats.get(conjunto.nome)!;
      linhasObservadas.push(
        checkBand(
          `assistencias do ADC por partida [${conjunto.nome}]`,
          mean(st.adcAssistsPorPartida),
          {
            floor: 4,
            ceiling: 8,
            target: 5.5,
            source:
              "STACK.md secao 7, linha de assistencias do ADC (referencia 5,2 a 5,8); mesma banda " +
              "declarada em scripts/calibrate-pace.ts. METRICA DERIVADA, observada e nunca asserida " +
              "aqui: contagem por partida e o produto da taxa (Fase 24) pelo volume de abates (Fase 26)",
            owner: "Fase 26",
          }
        )
      );
    }

    // OBSERVADAS: a taxa recalculada nos dois conjuntos nao controlados. O nivel
    // de cada rota num conjunto de composicao livre depende da escolha de campeao,
    // que e decisao do usuario e nao propriedade do motor; o que o motor precisa
    // garantir em qualquer composicao sao H1 e H2, asseridos nos tres conjuntos.
    for (const conjunto of CONJUNTOS) {
      if (conjunto.nome === "CONTROLE-CARRIES") continue;
      const m = metricas.get(conjunto.nome)!;
      linhasObservadas.push(
        checkBand(
          `assistencias do ADC por abate do time [${conjunto.nome}]`,
          m.assistsPorAbateDoTime.adc,
          {
            floor: 0.28,
            ceiling: 0.52,
            target: 0.39,
            source:
              "mesma derivacao de STACK.md secao 4.7 da banda asserida, recalculada fora do conjunto " +
              "controlado: aqui o nivel depende tambem da escolha de campeao, entao a linha e observada",
            owner: "Fase 24",
          }
        )
      );
    }

    // -------------------------------------------------------------------------
    // RAZAO AGREGADA DE ASSISTENCIAS POR ABATE DO TIME: banda com dono Fase 26
    // (criterio 6 do roadmap, herdado da Fase 24 que descobriu o numero mas nao
    // podia resolve-lo). Ate este plano, a razao vivia como achado sem dono.
    //
    // OS DOIS PONTOS DE CODIGO QUE IMPUNHAM O TETO ARITMETICO DE CONSTRUCAO, ja
    // MOVIDOS pelo plano 26-06:
    //   1. o sorteio da quantidade de assistentes dentro de applyKill em
    //      src/sim/engine.ts, elevado de tres para quatro pela funcao de minimo
    //      (nAssists = 1 + Math.floor(rng() * Math.min(4, mates.length)));
    //   2. a tabela ASSIST_COUNT_BY_EVENT em src/sim/selection.ts, elevada de dois
    //      para tres assistentes nos tipos de pickoff (gank, solo_kill); o tipo de
    //      teamfight (comeback_fight, cap 4) ja se beneficiava do ponto 1 sem
    //      precisar de mudanca propria na tabela.
    // A mistura entre pickoff e teamfight muda com maxCasualties (plano 26-04) e
    // FIGHT_COOLDOWN_BY_PHASE (plano 26-05), o que exigiu medir a razao isoladamente
    // antes e depois de cada mudanca (Pitfall 6 de 26-RESEARCH.md), registrado nos
    // blocos 5, 6.4, 9.4 e 10 de docs/diagnostics/26-sweep.md.
    // -------------------------------------------------------------------------
    bandasAsseridas.push(
      checkBand(
        "razao agregada de assistencias por abate do time [CONTROLE-CARRIES]",
        controle.razaoAgregada,
        {
          floor: 2.1,
          ceiling: 2.7,
          target: 2.407,
          source:
            "derivado de STACK.md secao 4.7 (a conta explicita, nao um numero pronto em tabela): " +
            "soma das assistencias medias das cinco rotas sobre a soma dos abates medios das cinco " +
            "rotas. 2024: (4,85 + 7,26 + 5,35 + 5,22 + 8,80) / (2,49 + 2,35 + 3,48 + 4,03 + 0,73) = " +
            "31,48 / 13,08 = 2,41; 2023: (4,54 + 6,71 + 5,27 + 4,56 + 8,55) / (2,31 + 2,31 + 3,16 + " +
            "4,09 + 0,68) = 29,63 / 12,55 = 2,36",
          owner: "Fase 26",
        }
      )
    );

    // OBSERVADAS: a mesma razao recalculada nos dois conjuntos nao controlados, com
    // piso, teto, alvo e fonte identicos. Fora do conjunto controlado o nivel tambem
    // depende da escolha de campeao, entao a linha e observada e nunca entra em
    // expectBands.
    for (const conjunto of CONJUNTOS) {
      if (conjunto.nome === "CONTROLE-CARRIES") continue;
      const m = metricas.get(conjunto.nome)!;
      linhasObservadas.push(
        checkBand(
          `razao agregada de assistencias por abate do time [${conjunto.nome}]`,
          m.razaoAgregada,
          {
            floor: 2.1,
            ceiling: 2.7,
            target: 2.407,
            source:
              "mesma derivacao da banda asserida de STACK.md secao 4.7, recalculada fora do " +
              "conjunto controlado: aqui o nivel tambem depende da escolha de campeao",
            owner: "Fase 26",
          }
        )
      );
    }

    // -------------------------------------------------------------------------
    // Violacoes: calculadas ANTES da escrita, para que o relatorio da rodada
    // vermelha ja carregue a lista completa. Os asserts em si rodam DEPOIS.
    // -------------------------------------------------------------------------

    // H1: elegibilidade ESTRUTURAL, nao de media. Uma media baixa e calibracao;
    // um total zero em 800 partidas com dez jogadores so acontece por exclusao
    // estrutural. E o assert que fecha o criterio 1 do roadmap da Fase 24.
    const violacoesH1: string[] = [];
    for (const conjunto of CONJUNTOS) {
      const st = stats.get(conjunto.nome)!;
      for (const role of ROLES) {
        if (!(st.assistsTotais[role] > 0)) {
          violacoesH1.push(
            `[${conjunto.nome}] rota ${role}: total de assistencias em ${N} partidas ` +
              `(dois lados, ${st.observacoes} observacoes) = ${st.assistsTotais[role]}, exigido maior que zero`
          );
        }
      }
    }

    // H2: piso duro de assistencias do ADC. Fonte: STACK.md secao 7, linha de
    // assistencias do ADC, que registra literalmente "assert duro: media > 2".
    const violacoesH2: string[] = [];
    for (const conjunto of CONJUNTOS) {
      const st = stats.get(conjunto.nome)!;
      const mediaAdc = mean(st.adcAssistsPorPartida);
      if (!(mediaAdc > 2)) {
        violacoesH2.push(
          `[${conjunto.nome}] media de assistencias do ADC por partida = ${f3(mediaAdc)}, ` +
            `exigido maior que 2 (fonte: STACK.md secao 7, linha de assistencias do ADC)`
        );
      }
    }

    // Ordenacao avaliada SOMENTE no conjunto controlado.
    const violacoesOrdenacao = violacoesDeOrdenacao("CONTROLE-CARRIES", controle.participacao);

    // -------------------------------------------------------------------------
    // Blocos finais do relatorio
    // -------------------------------------------------------------------------

    out += "\n=== ELEGIBILIDADE ESTRUTURAL (H1) E PISO DURO DO ADC (H2) ===\n";
    out +=
      "  H1 (elegibilidade estrutural): para cada conjunto e cada rota, o total acumulado de\n" +
      "  assistencias em N partidas nos dois lados tem que ser maior que zero. E assert de\n" +
      "  ELEGIBILIDADE, nao de media: media baixa e calibracao, total zero em 800 partidas com\n" +
      "  dez jogadores so acontece por exclusao estrutural. Fecha o criterio 1 do roadmap da Fase 24.\n";
    out += `  violacoes de H1: ${violacoesH1.length}\n`;
    for (const v of violacoesH1) out += `    ${v}\n`;
    out +=
      "  H2 (piso duro): a media de assistencias do ADC por partida tem que ser maior que 2 nos\n" +
      "  tres conjuntos. Fonte: STACK.md secao 7, linha de assistencias do ADC.\n";
    out += `  violacoes de H2: ${violacoesH2.length}\n`;
    for (const v of violacoesH2) out += `    ${v}\n`;

    out += "\n=== BANDAS ASSERIDAS ===\n";
    out +=
      "  So metrica RAIZ vira banda ASSERIDA. A taxa de assistencias do ADC por abate do time e a\n" +
      "  unica banda quantitativa de nivel que a Fase 24 pode fechar sozinha, porque e a unica que\n" +
      "  nao depende do volume de abates. Formato: [OK|FALHA] [dono] rotulo = valor situacao\n" +
      "  [piso, teto], alvo X (fonte: X).\n";
    out += formatBandTable(bandasAsseridas) + "\n";

    out += "\n=== LINHAS OBSERVADAS (sem assercao) ===\n";
    out +=
      "  As linhas abaixo passam por checkBand e carregam piso, teto, alvo, fonte e fase dona,\n" +
      "  mas o resultado delas NAO entra na lista asserida. Um FALHA aqui e medicao anotada, nao\n" +
      "  veredito desta fase.\n";
    out += formatBandTable(linhasObservadas) + "\n";
    out +=
      "\n  NOTA (contagem de assistencias do ADC por partida, dono Fase 26): a contagem por partida e\n" +
      "  o produto de uma TAXA (assistencias por abate do time, que e o que a Fase 24 controla) por um\n" +
      "  VOLUME (abates por partida, alavanca declarada da Fase 26). A engine faz hoje 87,71 abates por\n" +
      "  partida, ou seja 43,9 por time, contra a banda de referencia de 22 a 34, e 73,7 assistencias\n" +
      "  por time (docs/diagnostics/engine-diagnose.txt). Duas contas fecham a questao: preservando a\n" +
      "  taxa de referencia, 0,39 vezes 43,9 da 17,2 assistencias de ADC por partida; preservando um\n" +
      "  share plausivel do ADC no total do time, cerca de 13 por cento sobre 73,7, da 9,6. Os dois\n" +
      "  estouram o teto de 8. E para caber em 4 a 8 com 43,9 abates por time, a taxa teria de ficar\n" +
      "  entre 0,09 e 0,18, abaixo do piso 0,28 da propria banda-raiz. Ou seja: nao existe valor dos\n" +
      "  parametros de penalizacao que satisfaca as duas leituras ao mesmo tempo. A banda so se torna\n" +
      "  satisfazivel quando a Fase 26 trouxer abates por partida para dentro de 22 a 34; assertar a\n" +
      "  contagem aqui obrigaria a taxa a um valor errado, que a Fase 26 teria de desfazer.\n";
    out +=
      "\n  NOTA (SEM-CAMPEOES): a linha do controle negativo e o espelho direto da banda que vive em\n" +
      "  scripts/calibrate-pace.ts. Quem ler este relatorio ve o estado dela sem precisar rodar o\n" +
      "  gate de ritmo inteiro.\n";

    out += "\n=== RAZAO AGREGADA DE ASSISTENCIAS POR ABATE DO TIME [dono Fase 26, criterio 6] ===\n";
    out +=
      "  a razao agregada tem dono declarado a partir da Fase 26, criterio 6 do roadmap da\n" +
      "  milestone. Banda de dois lados [2,100; 2,700], alvo 2,407, fonte STACK.md secao 4.7\n" +
      "  (linha da banda ASSERIDA acima, conjunto CONTROLE-CARRIES). Nao e mais achado sem dono:\n" +
      "  o gate ja aperta.\n";
    out += "  valor medido (cinco rotas somadas, dois lados):\n";
    for (const conjunto of CONJUNTOS) {
      out += `    ${conjunto.nome.padEnd(18)} ${f3(metricas.get(conjunto.nome)!.razaoAgregada)}\n`;
    }
    out +=
      `  teto aritmetico de construcao de hoje: ${f3(tetoConstrucaoPonderado)}, calculado (nao ` +
      "afirmado) por ponderacao da participacao real de cada tipo de evento, medida no conjunto\n" +
      "  controlado (bloco de ancoragem abaixo). Os dois pontos de codigo que o impoem estao\n" +
      "  nomeados no comentario que precede a banda acima (src/sim/engine.ts e\n" +
      "  src/sim/selection.ts), escopo do plano 26-06.\n" +
      `  fracao do teto que o conjunto controlado ja ocupa: ${pct(controle.razaoAgregada / tetoConstrucaoPonderado)}.\n` +
      "  leitura: enquanto o teto de construcao for menor que o piso 2,1 da banda, a distancia ate\n" +
      "  o piso NAO e alcancavel por calibracao de distribuicao. Falta forma, nao falta ajuste; o\n" +
      "  conserto pertence ao plano 26-06.\n";

    out += "\n=== ANCORAGEM DO CRITERIO 6 (Task 2 do plano 26-02) ===\n";
    out +=
      "  VERIFICACAO DA SUPOSICAO A2 (26-RESEARCH.md), por dois metodos independentes:\n" +
      "  1. por busca no motor: dois pontos de chamada do aplicador de abate (applyKill,\n" +
      "     src/sim/engine.ts) passam o tipo de evento explicitamente para o seletor de\n" +
      "     assistentes -- o resolvedor de pickoff passa pickoffCtx.eventType (\"gank\" quando a\n" +
      "     intencao e gank, \"solo_kill\" nos demais picks) e o resolvedor de teamfight\n" +
      "     (applyFightCasualties, por luta) passa sempre o literal \"comeback_fight\". Nenhum\n" +
      "     outro ponto de chamada de applyKill no arquivo passa um quarto tipo.\n" +
      "  2. por contagem em execucao: distribuicao de tipos vistos pelo seletor de assistentes\n" +
      "     (assignAssists, src/sim/selection.ts) ao longo das " + N + " partidas do conjunto\n" +
      "     CONTROLE-CARRIES, " + chamadasControleCarries + " chamadas no total:\n";
    for (const tipo of tiposObservados) {
      const contagem = participacaoControleCarries[tipo]!;
      out += `       ${tipo.padEnd(16)} ${String(contagem).padStart(7)} chamadas  ${pct(contagem / chamadasControleCarries).padStart(7)}  (teto do tipo: ${f3(tetoPorTipo(tipo))})\n`;
    }
    out += `     soma das participacoes: ${pct(tiposObservados.reduce((s, t) => s + participacaoControleCarries[t]! / chamadasControleCarries, 0))}\n`;
    out +=
      `  VEREDITO A2: ${a2Confirmada ? "CONFIRMADA" : "REFUTADA"} -- ` +
      (a2Confirmada
        ? "os unicos tipos vistos pelo seletor de assistentes sao gank, solo_kill e comeback_fight,\n" +
          "     exatamente os tres previstos pela pesquisa. Os dois pontos nomeados acima bastam para\n" +
          "     o plano 26-06 mexer no teto de construcao.\n"
        : `tipos alem dos tres previstos apareceram: ${tiposInesperados.join(", ")}. Isso muda quais\n` +
          "     entradas de ASSIST_COUNT_BY_EVENT importam para o criterio 6; o plano 26-06 precisa\n" +
          "     revisar a lista antes de mexer no teto.\n");
    out +=
      `  teto de construcao ponderado pela participacao medida: ${f3(tetoConstrucaoPonderado)}\n` +
      `  distancia ate o piso 2,1 da banda: ${f3(2.1 - tetoConstrucaoPonderado)} (teto de construcao ` +
      `menor que o piso: ${tetoConstrucaoPonderado < 2.1 ? "sim" : "nao"})\n` +
      "  leitura: enquanto o teto de construcao ponderado for menor que o piso 2,1, nenhuma\n" +
      "  calibracao de distribuicao fecha a banda: falta forma (os dois pontos nomeados acima),\n" +
      "  nao falta ajuste. Este e o insumo que o plano 26-06 le para decidir quanto subir cada\n" +
      "  ponto.\n";

    out += "\n=== ORDENACAO DE PARTICIPACAO EM ABATE ===\n";
    out +=
      "  ordem exigida: support, jungle, adc, mid, top, com tolerancia de 8 pontos percentuais.\n" +
      "  fonte: STACK.md secao 7 (manter a ordem, tolerar 8 pontos percentuais, assert de ordenacao)\n" +
      "  com os valores de referencia de STACK.md secao 4.7 (support 74,8; jungle 73,4; ADC 70,0;\n" +
      "  mid 67,5; top 56,2).\n" +
      "  ASSERIDA somente no conjunto CONTROLE-CARRIES: e o unico conjunto em que quatro das cinco\n" +
      "  rotas tem o mesmo meta.assistBias, entao a ordem medida so pode vir do modelo de rota e do\n" +
      "  volume de abates. Num conjunto de composicao livre a ordem tambem depende da escolha de\n" +
      "  campeao do usuario, que e escolha dele e nao propriedade do motor.\n" +
      "  AVISO: a ordenacao de ASSISTENCIAS pura e diferente (support, jungle, mid, ADC, top, item 2\n" +
      "  da secao 4.7). Aplicar a ordenacao de participacao sobre assistencias cruas seria usar a\n" +
      "  fonte errada.\n";
    for (const conjunto of CONJUNTOS) {
      const m = metricas.get(conjunto.nome)!;
      const asserida = conjunto.nome === "CONTROLE-CARRIES";
      const vs = asserida ? violacoesOrdenacao : violacoesDeOrdenacao(conjunto.nome, m.participacao);
      out += `  ${conjunto.nome} (${asserida ? "ASSERIDA" : "observada"}): ` +
        `${ORDEM_PARTICIPACAO.map((r) => `${r} ${pct(m.participacao[r])}`).join(" >= ")}\n`;
      out += `    violacoes: ${vs.length}\n`;
      for (const v of vs) out += `      ${v}\n`;
    }

    // -------------------------------------------------------------------------
    // ESCRITA DO RELATORIO, sempre ANTES de qualquer assercao (T-24-05): a rodada
    // vermelha, que e o desfecho esperado hoje, ainda deixa relatorio completo.
    // -------------------------------------------------------------------------
    try {
      mkdirSync("tmp", { recursive: true });
    } catch {
      // ja existe
    }
    writeFileSync("tmp/calibration-assists.txt", out);
    console.log(out);

    // -------------------------------------------------------------------------
    // ASSERTS DUROS: zero absoluto e piso de plausibilidade. Cada bloco falha uma
    // unica vez com a lista completa (padrao de expectBands), para que uma rodada
    // mostre de uma vez todas as rotas excluidas em vez de parar na primeira.
    // -------------------------------------------------------------------------
    expect(
      violacoesH1,
      `H1 elegibilidade estrutural (criterio 1 do roadmap da Fase 24): rota com total de ` +
        `assistencias zero em ${N} partidas com campeoes atribuidos: ${violacoesH1.join("; ")}`
    ).toEqual([]);

    expect(
      violacoesH2,
      `H2 piso duro de assistencias do ADC (STACK.md secao 7, assert duro media maior que 2): ` +
        `${violacoesH2.join("; ")}`
    ).toEqual([]);

    // -------------------------------------------------------------------------
    // ASSERT TOLERANTE: a unica banda quantitativa de nivel da fase, sobre a
    // metrica RAIZ. As linhas observadas NAO entram aqui, de proposito.
    // -------------------------------------------------------------------------
    expectBands(bandasAsseridas);

    // -------------------------------------------------------------------------
    // ASSERT DE ORDENACAO (nao de magnitude), so no conjunto controlado.
    // -------------------------------------------------------------------------
    expect(
      violacoesOrdenacao,
      `ordenacao de participacao em abate no CONTROLE-CARRIES (STACK.md secao 7, tolerancia de ` +
        `8 pontos percentuais): ${violacoesOrdenacao.join("; ")}`
    ).toEqual([]);
  });
});
