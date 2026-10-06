/**
 * scripts/probe-lift.ts
 *
 * Sonda da MATRIZ DE LIFT: acoplamento temporal entre eventos (Fase 25C, onda 1).
 * Executar: npm run probe:lift  (via vitest, config dedicada)
 * Relatorio: tmp/lift-{TAG}.txt, com TAG vindo de LIFT_TAG (padrao "pre")
 *
 * Origem: criterios 1 e 2 do roadmap da Fase 25C, e o veredito humano sem dono que abriu
 * a fase (D-25-08): "luta que sai do nada, objetivo tomado sem setup, abate que nao leva
 * a nada. No LoL um evento puxa o outro: gank vira torre, Barao vira push".
 *
 * PARA QUE ESTA SONDA EXISTE, e o que ela deliberadamente NAO faz.
 *
 * As ondas 3 a 5 desta fase vao mexer na camada de decisao da engine. Sem um instrumento
 * que veja ACOPLAMENTO antes disso, nao ha como distinguir um conserto que ligou eventos
 * de um que so mexeu no nivel: as bandas que existem hoje medem nivel (Fases 23 a 25) e
 * dispersao e forma (Fase 25B), e nenhuma delas veria a diferenca. E o padrao instrumento
 * antes de motor, ja usado quatro vezes nesta milestone (a Fase 23 inteira, o gate de
 * assistencia do 24-01, o retrato PRE do 25-01 e a ancoragem de dispersao do 25B-01).
 *
 * A definicao inteira do instrumento, com a razao de cada escolha e os tres pisos, esta
 * em docs/diagnostics/25C-ancoragem.md, Bloco 2, commitado ANTES desta sonda e antes de
 * qualquer numero novo. Esta sonda MEDE; ela nao decide nada.
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: semente igual ao indice da partida, nunca semente compartilhada
 *   - Instancia nova de gerador por partida: mulberry32(seed), uma por simulacao
 *   - Nenhuma fonte de aleatoriedade da plataforma neste arquivo
 *   - Este arquivo NUNCA modifica src/sim/: ele so chama simulateMatch e le o resultado.
 *     O contador de draws vive INTEIRAMENTE aqui, embrulhando o gerador no ponto de
 *     chamada, no molde do contador ja usado no canario de aridade de
 *     src/sim/engine.test.ts:337-345. A engine nao recebe instrumentacao nenhuma
 *   - Toda estatistica vem de scripts/stats.ts (mean, percentile, summarize) e toda a
 *     matriz vem de scripts/lift.ts, nunca reimplementadas aqui
 *   - ESTA SONDA NAO CONTEM ASSERCAO E NAO E GATE. Ela sai 0 seja qual for o numero
 *     medido, no mesmo espirito de scripts/diagnose-engine.ts e de scripts/probe-shape.ts.
 *     A separacao entre relatorio e gate esta em scripts/README.md secao 4
 *   - A sonda NAO entra na cadeia de scripts/calibrate-all.mjs. A lista fixa de sete
 *     gates fica intacta: a implantacao das bandas e a onda 2, em calibrate-pace.ts
 *   - Zero dependencia nova em package.json
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { describe, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES, DEFAULT_SIM_CONFIG } from "../src/sim/matchState";
import { mean, percentile } from "./stats";
import {
  analysePair,
  benjaminiHochberg,
  buildStrata,
  classificaDragao,
  fmt,
  paresDeControle,
  paresPreRegistrados,
  parDragaoContestado,
  B_BOOT,
  COBERTURA_PROXY_LUTA_GANHA,
  DESVIO_LIFT_PROXY_LUTA_GANHA,
  DRAGAO_SOLO,
  EPICO,
  LUTA_GANHA,
  N_STRATA,
  R_JITTER,
  R_PARTNERS,
  TORRE,
  type LiftEvent,
  type LiftMatch,
  type PairResult,
  type PairSpec,
  type Side,
} from "./lift";
import type { PlayerVersion, Role } from "../src/data/schema";

// ---------------------------------------------------------------------------
// Fixture. COPIA VERBATIM do tier EQUILIBRADO de scripts/calibrate-pace.ts.
// ---------------------------------------------------------------------------

/**
 * makePlayer e roster sao copia verbatim de scripts/calibrate-pace.ts:88-110 (que por sua
 * vez os copiou de calibrate-structures.ts:57-79). Stat uniforme em todos os campos, para
 * neutralidade (INV-1).
 *
 * A COPIA E DELIBERADA E A RAZAO E A LICAO MAIS CARA DO PLANO 25B-01. A banda de
 * acoplamento da onda 2 vai viver em calibrate-pace.ts e ser avaliada sobre a populacao
 * daquele harness. Se esta sonda medisse outra populacao, a leitura PRE que ela produz
 * NAO serviria de referencia para aquele gate: o numero impresso aqui tem de ser o MESMO
 * numero que o gate vai avaliar la, ou a ancoragem assina um erro sistematico de origem
 * desconhecida. Foi exatamente esse desalinhamento (N igual a 1500 no diagnose contra N
 * igual a 800 no gate) que o plano 25B-01 existiu para corrigir.
 */
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

/** Tier EQUILIBRADO, copia verbatim de scripts/calibrate-pace.ts:130. Gap zero. */
const US = Number(process.env.LIFT_US ?? 75);
const RS = Number(process.env.LIFT_RS ?? 75);

// ---------------------------------------------------------------------------
// O N, declarado em DUAS leituras que nao podem ser confundidas
// ---------------------------------------------------------------------------

/**
 * N de ANCORAGEM = 800, igual ao N do gate de ritmo (scripts/calibrate-pace.ts:75).
 * ESTA E A UNICA LEITURA QUE PODE VIRAR BANDA. Ancorar uma banda em numero medido com
 * outro N assina um erro sistematico de origem desconhecida, licao do plano 25B-01.
 *
 * N de OBSERVACAO = 2000, mais poder, reportado quando pedido por variavel de ambiente e
 * SEMPRE rotulado como observacao no cabecalho do relatorio. Ele existe porque os pares
 * exploratorios e a varredura de janela precisam de poder que 800 nao da. Nenhum numero
 * medido com ele pode virar piso.
 */
const N_ANCORAGEM = 800;
const N_OBSERVACAO = 2000;
const N = Number(process.env.LIFT_N ?? N_ANCORAGEM);
const TAG = process.env.LIFT_TAG ?? "pre";

/**
 * Abaixo deste N a leitura NAO e interpretavel, e o relatorio diz isso em vez de deixar o
 * leitor descobrir. O nulo pareado exige parceiro com a mesma contagem DENTRO do decil de
 * duracao: com poucas partidas por estrato a maioria das ancoras fica sem parceiro e a
 * coluna do pareado sai vazia ou instavel. O modo de fumaca existe para provar que a
 * sonda executa de ponta a ponta, nunca para produzir numero.
 */
const N_MIN_INTERPRETAVEL = 200;

/** Tick da engine, lido da propria config e nunca cravado aqui. */
const TICK = DEFAULT_SIM_CONFIG.tickSeconds;

/**
 * A JANELA DOS TRES PARES PRE-REGISTRADOS. 60 s, escolhida por varredura e nao por
 * opiniao, com a justificativa escrita no Bloco 2.3 da ancoragem. As leituras de 120 e
 * 180 s saem ao lado e sao OBSERVACAO: nenhuma delas vira banda.
 */
const W_REGISTRADA = 60;
const W_OBSERVACAO = [120, 180];

/** Grade da varredura de janela. */
const VARREDURA = [30, 60, 90, 120, 180, 240, 300, 420];

// ---------------------------------------------------------------------------
// Conjuntos de tipos de evento
// ---------------------------------------------------------------------------

/**
 * Todo tipo que a engine emite uma vez por morte. `solo_kill` entrou na Task 8 da linha
 * calendario-e-volume: desde a Task 4 o all-in de rota emite "solo_kill" no top e no mid.
 */
const ABATE = ["kill", "shutdown", "first_blood", "gank", "solo_kill"];

// ---------------------------------------------------------------------------
// Os pares
// ---------------------------------------------------------------------------

/**
 * A DEFINICAO DOS TRES VIVE EM scripts/lift.ts desde a onda 2, e a de P3 so foi congelada
 * la DEPOIS de o residuo do proxy ser medido. A sonda e o gate leem a MESMA definicao:
 * duas copias divergiriam em silencio e a leitura PRE deixaria de ser comparavel com a POS
 * que a julga.
 */
const PRE_REGISTRADOS: PairSpec[] = paresPreRegistrados(W_REGISTRADA);

/**
 * OS TRES CONTROLES INTERNOS, e eles sao a validacao mais forte disponivel sem dado
 * externo: nao existe caminho mecanico entre A e B no codigo para nenhum dos tres.
 * ESPERADO: os tres leem 1,000 dentro do IC. Qualquer um deles sair de 1,000 e SINAL DE
 * ALERTA DO INSTRUMENTO, e nao achado do motor.
 *
 * A DEFINICAO VIVE EM scripts/lift.ts E NAO AQUI, desde a onda 2. A razao e que o gate de
 * `scripts/calibrate-pace.ts` imprime os mesmos tres controles como alarme de instrumento
 * na mesma pagina em que imprime o veredito: duas copias da definicao divergiriam em
 * silencio, e um controle que mede outra coisa e pior que nenhum controle.
 *
 * O C1 DESTA LISTA NAO E O DA ONDA 1. A onda 1 usava `dragon_taken` inteiro e mediu
 * 1,086 [1,004; 1,176], um IC que exclui 1,000. A onda 2 separou as tres leituras por
 * medicao e achou CAMINHO MECANICO na luta que acompanha o dragao contestado. O controle
 * passou a ser o subconjunto SEM CONTESTACAO, e o subconjunto contestado saiu ao lado
 * como OBSERVACAO para que o caminho fique impresso. Registro completo no bloco de
 * comentario de C1 em scripts/lift.ts e no Bloco 2.12 da ancoragem.
 */
const CONTROLES: PairSpec[] = paresDeControle(W_REGISTRADA);

/** O subconjunto CONTESTADO, observado ao lado dos controles. Nunca e controle. */
const DRAGAO_CONTESTADO = parDragaoContestado(W_REGISTRADA);

const EXPLORATORIOS: PairSpec[] = [
  { id: "E1", label: "gank, depois queda de torre, ROTA QUALQUER", a: ["gank"], b: TORRE, sideRel: "same", laneRel: "any", w: W_REGISTRADA },
  { id: "E2", label: "gank, depois placa NA MESMA ROTA", a: ["gank"], b: ["plate_taken"], sideRel: "same", laneRel: "same", w: W_REGISTRADA },
  { id: "E3", label: "gank, depois tower_low NA MESMA ROTA", a: ["gank"], b: ["tower_low"], sideRel: "same", laneRel: "same", w: W_REGISTRADA },
  { id: "E4", label: "luta ganha, depois queda de torre", a: LUTA_GANHA, b: TORRE, sideRel: "same", laneRel: "any", w: W_REGISTRADA },
  { id: "E5", label: "luta ganha, depois baron_taken", a: LUTA_GANHA, b: ["baron_taken"], sideRel: "same", laneRel: "any", w: W_REGISTRADA },
  { id: "E6", label: "herald_taken, depois queda de torre", a: ["herald_taken"], b: TORRE, sideRel: "same", laneRel: "any", w: W_REGISTRADA },
  { id: "E7", label: "dragon_taken, depois luta ganha", a: ["dragon_taken"], b: LUTA_GANHA, sideRel: "same", laneRel: "any", w: W_REGISTRADA },
  { id: "E8", label: "queda de torre, depois queda de torre NA MESMA ROTA (freio de cascata, 180 s)", a: TORRE, b: TORRE, sideRel: "same", laneRel: "same", w: W_REGISTRADA },
  { id: "E9", label: "baron_taken, depois inhibitor_destroyed", a: ["baron_taken"], b: ["inhibitor_destroyed"], sideRel: "same", laneRel: "any", w: W_REGISTRADA },
  { id: "E10", label: "baron_taken, depois nexus_exposed", a: ["baron_taken"], b: ["nexus_exposed"], sideRel: "same", laneRel: "any", w: W_REGISTRADA },
  { id: "E11", label: "abate qualquer, depois queda de torre", a: ABATE, b: TORRE, sideRel: "same", laneRel: "any", w: W_REGISTRADA },
  { id: "E12", label: "placa, depois queda de torre NA MESMA ROTA", a: ["plate_taken"], b: TORRE, sideRel: "same", laneRel: "same", w: W_REGISTRADA },
  { id: "E13", label: "luta ganha, depois luta ganha", a: LUTA_GANHA, b: LUTA_GANHA, sideRel: "same", laneRel: "any", w: W_REGISTRADA },
  { id: "E14", label: "gank, depois luta ganha", a: ["gank"], b: LUTA_GANHA, sideRel: "same", laneRel: "any", w: W_REGISTRADA },
  { id: "E15", label: "queda de torre, depois objetivo epico", a: TORRE, b: EPICO, sideRel: "same", laneRel: "any", w: W_REGISTRADA },
];

/**
 * A varredura roda nos tres pre-registrados mais E8, e E8 esta ali por um motivo que nao
 * e curiosidade: o freio de cascata da v2.0 tem constante conhecida de 180 s
 * (CASCADE_N_LANE_SEC), entao o lift de E8 PRECISA subir monotonicamente com a janela.
 * ELE E O CONTROLE POSITIVO DA SONDA. Se ele nao aparecer, o instrumento esta errado, e
 * nao a engine.
 */
const IDS_VARREDURA = ["P1", "P2", "P3", "E8"];

// ---------------------------------------------------------------------------
// Coleta, com o contador de draws embrulhando o gerador NESTE arquivo
// ---------------------------------------------------------------------------

interface Coleta {
  partidas: LiftMatch[];
  drawsPorPartida: number[];
  ticksPorPartida: number[];
  drawsPorTick: number[];
  /** Fracao de ticks da partida que passam sem emitir NENHUM evento. */
  ticksSilenciosos: number[];
  /** Contagem total por tipo de evento, sobre todas as partidas. */
  porTipo: Map<string, number>;
  segundos: number;
  /** Conferencia de identidade do classificador de dragao: solo + luta tem de dar o total. */
  dragao: { total: number; solo: number; luta: number };
}

/**
 * Gerador embrulhado por contador. Copia do molde de src/sim/engine.test.ts:337-345.
 * Ele vive INTEIRAMENTE aqui: src/sim/ nao recebe uma linha de instrumentacao.
 */
function geradorContado(seed: number): { rng: () => number; draws: () => number } {
  const inner = mulberry32(seed);
  let count = 0;
  return {
    rng: () => {
      count++;
      return inner();
    },
    draws: () => count,
  };
}

function coleta(n: number): Coleta {
  const t0 = Date.now();
  const partidas: LiftMatch[] = [];
  const drawsPorPartida: number[] = [];
  const ticksPorPartida: number[] = [];
  const drawsPorTick: number[] = [];
  const ticksSilenciosos: number[] = [];
  const porTipo = new Map<string, number>();
  const dragao = { total: 0, solo: 0, luta: 0 };

  for (let seed = 0; seed < n; seed++) {
    const g = geradorContado(seed);
    const res = simulateMatch(roster("u", US), roster("r", RS), g.rng);
    const draws = g.draws();
    const ticks = Math.max(1, Math.round(res.durationSec / TICK));

    const evs: LiftEvent[] = res.timeline.map((e) => ({
      t: e.timeSec,
      kind: e.kind,
      side: (e.side as Side) ?? null,
      lane: (e.lane as string) ?? null,
    }));

    /**
     * O DRAGAO ENTRA DUAS VEZES NA LISTA, e isso e deliberado: uma como `dragon_taken`,
     * que e o tipo publico e continua alimentando P3 e os exploratorios, e outra como
     * `dragon_solo` ou `dragon_luta`, que sao os tipos DERIVADOS do controle C1 e do
     * observado C1x. Os tres pares que usam essas chaves sao disjuntos entre si, entao a
     * duplicacao nao contamina medicao nenhuma: nenhum par tem os dois tipos em A ou em B.
     */
    for (const e of res.timeline) {
      if (e.kind !== "dragon_taken") continue;
      const derivado = classificaDragao(e.ticker);
      dragao.total++;
      if (derivado === DRAGAO_SOLO) dragao.solo++;
      else dragao.luta++;
      evs.push({
        t: e.timeSec,
        kind: derivado,
        side: (e.side as Side) ?? null,
        lane: (e.lane as string) ?? null,
      });
    }
    evs.sort((a, b) => a.t - b.t);
    partidas.push({ dur: res.durationSec, evs });

    drawsPorPartida.push(draws);
    ticksPorPartida.push(ticks);
    drawsPorTick.push(draws / ticks);

    // A distribuicao de tipo e a contagem de instantes leem a TIMELINE, e nunca `evs`:
    // `evs` carrega os dois tipos derivados do dragao e contar por ali inflaria o total
    // de eventos e distorceria toda a coluna de share.
    const instantesComEvento = new Set<number>();
    for (const e of res.timeline) {
      instantesComEvento.add(e.timeSec);
      porTipo.set(e.kind, (porTipo.get(e.kind) ?? 0) + 1);
    }
    ticksSilenciosos.push(1 - Math.min(1, instantesComEvento.size / ticks));
  }

  return {
    partidas,
    drawsPorPartida,
    ticksPorPartida,
    drawsPorTick,
    ticksSilenciosos,
    porTipo,
    segundos: (Date.now() - t0) / 1000,
    dragao,
  };
}

const mediana = (a: readonly number[]) => percentile([...a].sort((x, y) => x - y), 50);

// ---------------------------------------------------------------------------
// A sonda
// ---------------------------------------------------------------------------

describe("matriz de lift (Fase 25C, onda 1)", () => {
  it("mede acoplamento, aridade por tick e distribuicao de evento, sem assertar nada", () => {
    const t0 = Date.now();
    const c = coleta(N);
    const strata = buildStrata(c.partidas);

    let out = "";
    const w = (s: string) => {
      out += `${s}\n`;
    };

    w(`MATRIZ DE LIFT, LEITURA ${TAG.toUpperCase()} (Fase 25C, onda 1). SONDA DE OBSERVACAO, NAO E GATE.`);
    w("=".repeat(110));
    w("");
    w(`Fixture: tier EQUILIBRADO ${US} contra ${RS}, copia verbatim de scripts/calibrate-pace.ts.`);
    w(`N = ${N}, semente igual ao indice da partida, uma instancia de mulberry32 por partida.`);
    if (N === N_ANCORAGEM) {
      w(`N de ANCORAGEM: esta leitura usa o MESMO N do gate de ritmo, e e a unica que pode virar banda.`);
    } else {
      w(`ATENCAO: N = ${N} NAO e o N de ancoragem (${N_ANCORAGEM}). Esta leitura e OBSERVACAO e NAO pode virar banda.`);
      w(`O N de observacao previsto e ${N_OBSERVACAO}, para os exploratorios e a varredura de janela.`);
    }
    if (N < N_MIN_INTERPRETAVEL) {
      w("");
      w(`MODO DE FUMACA: com N = ${N} a estratificacao por decil deixa cerca de ${Math.round(N / N_STRATA)} partidas por`);
      w("estrato, e o nulo PAREADO exige parceiro com a MESMA contagem dentro do estrato. Boa parte");
      w("das ancoras fica sem parceiro suficiente e a coluna do pareado sai vazia ou instavel.");
      w("ESTA RODADA PROVA QUE A SONDA EXECUTA DE PONTA A PONTA, E NAO MEDE ACOPLAMENTO.");
      w("Nenhum numero desta rodada pode ser citado como leitura da engine.");
    }
    w("");
    w("DEFINICAO DO INSTRUMENTO (a versao completa, com a razao de cada escolha, esta em");
    w("docs/diagnostics/25C-ancoragem.md Bloco 2, commitado ANTES desta sonda):");
    w(`  janela      (t_A, t_A + W], ABERTA em t_A. Evento no mesmo tick NAO conta (tick = ${TICK} s),`);
    w("              porque coemissao no mesmo tick e simultaneidade e nao causalidade.");
    w("  truncamento simetrico: so entram ancoras com t_A + W <= duracao, e o parceiro tambem");
    w("              precisa de duracao >= t_A + W.");
    w(`  nulo        PAREADO POR CONTAGEM. ${R_PARTNERS} parceiros por ancora, ${N_STRATA} decis de duracao.`);
    w(`  IC95 e p    bootstrap por CLUSTER = partida, ${B_BOOT} reamostras.`);
    w("  rota        so top, mid e bot contam como mesma rota; regiao desqualifica a ancora.");
    w("");
    w("OS TRES NULOS, e a escolha entre eles foi feita POR MEDICAO e esta asserida em");
    w("scripts/lift.test.ts contra corpus com lift verdadeiro 1,000 por construcao:");
    w("  PAREADO   (ADOTADO)    cobre 1,000 sob independencia verdadeira.");
    w("  CRUZADO   (REJEITADO)  falso positivo: le acima de 1,000 sem que haja acoplamento.");
    w(`  JITTER    (REJEITADO)  falso negativo: desloca B por mais ou menos 4W (${R_JITTER} sorteios) e`);
    w("                         arrasta massa entre fases de jogo. NAO usar para veredito.");
    w("As duas colunas rejeitadas saem abaixo como CONTRASTE, e nunca como fonte de banda.");
    w("");
    w("DEFINICAO DE LUTA GANHA EM USO, declarada como PROXY e CONGELADA na onda 2:");
    w(`  ${LUTA_GANHA.join(", ")}`);
    w("  So resolveTeamfight emite estes tipos, entao nao ha falso positivo. HA falso negativo,");
    w("  e o tamanho dele foi MEDIDO com marcador transitorio antes de a definicao ser");
    w("  congelada (plano 25C-02 Task 1, tmp/proxy-residuo.txt, Bloco 4 da ancoragem):");
    w(`    fracao de cobertura por LUTA                       ${fmt(COBERTURA_PROXY_LUTA_GANHA, 4)}`);
    w(`    desvio de lift contra a definicao completa         mais ${fmt(DESVIO_LIFT_PROXY_LUTA_GANHA)}`);
    w("  A direcao do vies e PARA CIMA e o mecanismo esta identificado: o proxy so ve a luta");
    w("  DECISIVA (a que produziu multikill ou ace), que e justamente a que converte em");
    w("  objetivo. O proxy ficou porque nenhuma regra sobre a linha do tempo PUBLICA reproduz");
    w("  a definicao completa: a luta tipica desta engine emite UM abate so, indistinguivel");
    w("  de pickoff. O desvio entrou como INCERTEZA DECLARADA da banda de P3.");
    w("");
    w("Multiplas comparacoes: os tres pre-registrados saem SEM correcao (hipotese pre-registrada");
    w("nao paga o preco de busca) e os exploratorios pagam Benjamini-Hochberg com q = 0,05.");
    w("Os dois valores saem lado a lado para os pre-registrados, para que ninguem deduza a regra.");
    w("");

    // -----------------------------------------------------------------------
    // Panorama da populacao
    // -----------------------------------------------------------------------
    const durs = c.partidas.map((m) => m.dur).sort((x, y) => x - y);
    w("-".repeat(110));
    w("POPULACAO MEDIDA");
    w("-".repeat(110));
    w(
      `Duracao (s): p5 ${percentile(durs, 5)}  p50 ${percentile(durs, 50)}  p95 ${percentile(durs, 95)}  ` +
        `media ${fmt(mean(durs), 1)}  (em minutos: media ${fmt(mean(durs) / 60, 3)})`,
    );
    w(`Simulacao de ${N} partidas: ${fmt(c.segundos, 1)} s`);
    w("");

    // -----------------------------------------------------------------------
    // ARIDADE, medida POR TICK
    // -----------------------------------------------------------------------
    w("-".repeat(110));
    w("ARIDADE, MEDIDA POR TICK");
    w("-".repeat(110));
    w("A ARMADILHA, escrita por extenso porque ela ja enganou uma medicao nesta milestone:");
    w("  ligar estado a decisao ENCURTA a partida, e portanto REDUZ o total de draws por partida");
    w("  mesmo quando o consumo POR TICK sobe. Medido na pesquisa da fase: a alavanca Z3b consome");
    w("  mais 2,29 por cento de draws POR TICK e ao mesmo tempo mostra sinal positivo no total por");
    w("  partida por acaso, enquanto Z4a press 4,0 mostra menos 80,7 draws por partida e menos 5,30");
    w("  por cento por tick. AS DUAS LEITURAS CONTAM HISTORIAS OPOSTAS SOBRE A MESMA MUDANCA.");
    w("  Regra da fase: a leitura de veredito e sempre DRAWS POR TICK.");
    w("");
    w(`  draws por TICK          media ${fmt(mean(c.drawsPorTick), 4)}   mediana ${fmt(mediana(c.drawsPorTick), 4)}   [LEITURA DE VEREDITO]`);
    w(`  draws por PARTIDA       media ${fmt(mean(c.drawsPorPartida), 1)}   mediana ${fmt(mediana(c.drawsPorPartida), 1)}   [CONFUNDIDO PELA DURACAO]`);
    w(`  ticks por partida       media ${fmt(mean(c.ticksPorPartida), 1)}   mediana ${fmt(mediana(c.ticksPorPartida), 1)}`);
    w("");
    w("  O contador vive inteiramente nesta sonda, embrulhando o gerador no ponto de chamada, no");
    w("  molde de src/sim/engine.test.ts:337-345. src/sim/ nao recebe instrumentacao nenhuma.");
    w("");

    // -----------------------------------------------------------------------
    // Distribuicao de evento e ticks silenciosos
    // -----------------------------------------------------------------------
    w("-".repeat(110));
    w("DISTRIBUICAO DE EVENTO E TICKS SILENCIOSOS");
    w("-".repeat(110));
    w(
      `  fracao de ticks que passam SEM EMITIR EVENTO NENHUM: media ${fmt(mean(c.ticksSilenciosos), 4)}   ` +
        `mediana ${fmt(mediana(c.ticksSilenciosos), 4)}`,
    );
    w("");
    w("  O QUE ESTA SONDA NAO CONSEGUE VER, dito em vez de estimado: a CAUSA do silencio de cada");
    w("  tick nao e observavel de fora. Um tick mudo pode ser o gate force <= 0.18 fazendo");
    w("  curto-circuito, ou uma decisao legitima que nao produz evento visivel. Separar as duas");
    w("  exige instrumentacao DENTRO de src/sim/, que este eixo proibe.");
    w("");
    w("  A TERCEIRA CAUSA DEIXOU DE EXISTIR NA ONDA 3, e por isso ela nao entra mais na lista:");
    w("  as duas intencoes que recebiam peso e nao tinham ramo em resolveInteraction sairam da");
    w("  uniao MacroIntent e dos DOIS sitios que davam peso a elas (a camada de decisao e o mapa");
    w("  de vieses de comp). A pesquisa media 5,357 por cento de ticks silenciosos por CAMINHO");
    w("  MORTO; hoje sao 0,000 POR CONSTRUCAO, provado pelo compilador e pelo teste de contagem");
    w("  de src/sim/engine.test.ts, e NUNCA por queda medida no numero acima, que se move por");
    w("  varios motivos ao mesmo tempo. O numero acima e o total, nao a parcela.");
    w("");
    w("  Pela mesma razao, a DISTRIBUICAO DE INTENCAO nao aparece aqui: intencao e estado interno");
    w("  da decisao e nunca chega a timeline. O que a timeline mostra e o tipo de evento EMITIDO,");
    w("  que e o que sai abaixo.");
    w("");
    w("  tipo de evento              total       por partida");
    const totalEventos = [...c.porTipo.values()].reduce((s, x) => s + x, 0);
    [...c.porTipo.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => {
        w(`  ${k.padEnd(26)} ${String(v).padStart(8)}   ${fmt(v / N, 3).padStart(9)}   share ${fmt(v / totalEventos, 4)}`);
      });
    w("");

    // -----------------------------------------------------------------------
    // A matriz
    // -----------------------------------------------------------------------
    const linha = (r: PairResult, marca: string) => {
      w(
        `${r.pair.id.padEnd(4)} ${String(r.pair.w).padStart(4)} ${String(r.anchors).padStart(7)} ${fmt(r.pObs).padStart(6)} | ` +
          `${fmt(r.matched.pNull).padStart(6)} ${fmt(r.matched.lift).padStart(7)} ` +
          `[${fmt(r.matched.lo).padStart(6)};${fmt(r.matched.hi).padStart(6)}] ${fmt(r.matched.p).padStart(6)} ${marca.padEnd(4)}| ` +
          `${fmt(r.cross.lift).padStart(7)} | ${fmt(r.jitter.lift).padStart(7)}`,
      );
      w(`     ${r.pair.label}`);
    };

    const cabecalho = () => {
      w("id      W ancoras  p_obs | PAREADO (ADOTADO)                             | CRUZADO | JITTER");
      w("                         | p_nulo    lift  IC95                p     BH  | rejeit. | rejeit.");
      w("-".repeat(110));
    };

    w("=".repeat(110));
    w(`BLOCO 1: OS TRES PARES PRE-REGISTRADOS, em W = ${W_REGISTRADA} s`);
    w("=".repeat(110));
    w("Reportados SEM correcao de multiplas comparacoes. Os tres pisos que eles vao pagar estao");
    w("no Bloco 2.4 da ancoragem: absoluto 1,050 para os tres, relativo 1,15 para P1 e P3 (que a");
    w("fase MOVE) e preservacao 0,95 para P2 (que a fase PRESERVA).");
    w("");
    cabecalho();
    const resPre = PRE_REGISTRADOS.map((p) => analysePair(c.partidas, strata, p));
    resPre.forEach((r) => linha(r, "pre"));
    w("");
    w(`Mesmos tres pares nas janelas de OBSERVACAO (${W_OBSERVACAO.join(" e ")} s). NENHUMA delas vira banda:`);
    w("");
    cabecalho();
    for (const wObs of W_OBSERVACAO) {
      for (const p of PRE_REGISTRADOS) {
        linha(analysePair(c.partidas, strata, { ...p, w: wObs }), "obs");
      }
    }
    w("");

    w("=".repeat(110));
    w(`BLOCO 2: OS TRES CONTROLES INTERNOS, em W = ${W_REGISTRADA} s`);
    w("=".repeat(110));
    w("Nao existe caminho mecanico entre A e B no codigo para nenhum dos tres.");
    w("ESPERADO: os tres leem 1,000 dentro do IC.");
    w("QUALQUER UM DELES SAIR DE 1,000 E SINAL DE ALERTA DO INSTRUMENTO, E NAO ACHADO DO MOTOR.");
    w("Vigilancia para as ondas seguintes: a onda 4 mexe na rota do gank, e a partir dali C3");
    w("DEIXA DE SER CONTROLE, porque passa a existir caminho mecanico. Isso precisa ser dito no");
    w("relatorio daquela onda em vez de descoberto depois.");
    w("");
    w("C1 MUDOU DE DEFINICAO NA ONDA 2, POR MEDICAO E NAO POR CONVENIENCIA. Na onda 1 ele era");
    w("`dragon_taken` inteiro e leu 1,086 [1,004; 1,176], IC que exclui 1,000. As tres leituras");
    w("possiveis foram separadas: o vies do estimador em W = 60 s e no maximo 1,010 e no perfil");
    w("de dragao fica ABAIXO de 1,000, e com N = 4000 o IC nao passa a cobrir 1,000. O que");
    w("explica a leitura e CAMINHO MECANICO: resolveContestedObjective chama resolveTeamfight");
    w("antes de tomar o objetivo, e aliveCount do inimigo alimenta shouldPushStructure e");
    w("numbersAdvantage na camada estrutural. Medido, o acoplamento esta INTEIRO no subconjunto");
    w("contestado (1,311 [1,161; 1,474]) e ausente no sem contestacao (0,973 [0,881; 1,059]).");
    w("O controle passou a ser o subconjunto SEM CONTESTACAO, e o contestado sai abaixo como");
    w("OBSERVACAO, para que o caminho fique impresso em vez de virar nota de rodape.");
    w("Registro completo: Bloco 2.12 de docs/diagnostics/25C-ancoragem.md.");
    w("");
    w(
      `Conferencia de identidade do classificador de dragao: solo ${c.dragao.solo} mais luta ` +
        `${c.dragao.luta} igual a ${c.dragao.solo + c.dragao.luta}, total ${c.dragao.total} ` +
        `[${c.dragao.solo + c.dragao.luta === c.dragao.total ? "OK" : "QUEBRADA, o ticker mudou"}]`,
    );
    if (c.dragao.solo === 0 || c.dragao.luta === 0) {
      w("ALERTA: uma das duas classes de dragao saiu VAZIA. O ticker mudou e o controle C1 nao");
      w("esta medindo o que diz medir. Nenhum numero deste bloco pode ser citado.");
    }
    w("");
    cabecalho();
    CONTROLES.forEach((p) => linha(analysePair(c.partidas, strata, p), "ctl"));
    w("");
    w("O SUBCONJUNTO CONTESTADO, OBSERVADO e nunca controle. Ele TEM caminho mecanico, e a");
    w("distancia entre esta linha e a de C1 acima E o tamanho do caminho:");
    w("");
    cabecalho();
    linha(analysePair(c.partidas, strata, DRAGAO_CONTESTADO), "obs");
    w("");

    w("=".repeat(110));
    w(`BLOCO 3: OS PARES EXPLORATORIOS, em W = ${W_REGISTRADA} s, com Benjamini-Hochberg q = 0,05`);
    w("=".repeat(110));
    w("Bloco SEPARADO de proposito: exploratorio nunca se mistura com pre-registrado.");
    w("A marca SIG significa rejeicao pelo procedimento de BH, e ns significa nao rejeitado.");
    w("");
    const resExp = EXPLORATORIOS.map((p) => analysePair(c.partidas, strata, p));
    const comP = resExp.filter((r) => Number.isFinite(r.matched.p));
    const flags = benjaminiHochberg(
      comP.map((r) => r.matched.p),
      0.05,
    );
    const sig = new Map<string, boolean>();
    comP.forEach((r, i) => sig.set(r.pair.id, flags[i]));
    cabecalho();
    resExp.forEach((r) => linha(r, sig.get(r.pair.id) === true ? "SIG" : "ns"));
    w("");

    w("=".repeat(110));
    w("BLOCO 4: VARREDURA DE JANELA");
    w("=".repeat(110));
    w("Serve para ler a ESCALA DE TEMPO do acoplamento: onde o lift for plano em 1,000 nao ha");
    w("janela certa; onde ele decair com W, a janela curta e a que carrega o sinal.");
    w("");
    w("E8 E O CONTROLE POSITIVO DESTA SONDA. O freio de cascata da v2.0 tem constante conhecida de");
    w("180 s, entao o lift de E8 PRECISA SUBIR monotonicamente com a janela. Se ele nao subir, o");
    w("INSTRUMENTO esta errado, e nao a engine: nenhuma conclusao sobre o motor pode ser tirada");
    w("de uma rodada em que este controle falhou.");
    w("");
    const todos = [...PRE_REGISTRADOS, ...EXPLORATORIOS];
    for (const id of IDS_VARREDURA) {
      const base = todos.find((p) => p.id === id);
      if (base === undefined) continue;
      w(`${id}  ${base.label}${id === "E8" ? "   [CONTROLE POSITIVO]" : ""}`);
      w(`   W(s):      ` + VARREDURA.map((x) => String(x).padStart(9)).join(""));
      const l1: string[] = [];
      const l2: string[] = [];
      const l3: string[] = [];
      for (const wv of VARREDURA) {
        const r = analysePair(c.partidas, strata, { ...base, w: wv });
        l1.push(fmt(r.matched.lift).padStart(9));
        l2.push(fmt(r.matched.lo).padStart(9));
        l3.push(String(r.matched.anchors).padStart(9));
      }
      w(`   lift:      ` + l1.join(""));
      w(`   IC95 inf:  ` + l2.join(""));
      w(`   ancoras:   ` + l3.join(""));
      w("");
    }

    w("=".repeat(110));
    w("LEMBRETE DE LEITURA");
    w("=".repeat(110));
    w("LIFT 1,000 E INDEPENDENCIA EXATA. Nenhum dado externo entra neste relatorio: a ancora e");
    w("teorica. Nenhum numero aqui e banda: as tres bandas de acoplamento nascem na onda 2, em");
    w("scripts/calibrate-pace.ts, com fonte na leitura PRE congelada e dono Fase 25C.");
    w("");
    w(`Tempo total da sonda: ${fmt((Date.now() - t0) / 1000, 1)} s`);

    mkdirSync("tmp", { recursive: true });
    writeFileSync(`tmp/lift-${TAG}.txt`, out, "utf8");
    console.log(out);
  });
});
