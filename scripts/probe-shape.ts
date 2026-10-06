/**
 * scripts/probe-shape.ts
 *
 * Sonda de DISPERSAO e de FORMA da distribuicao estrutural (Fase 25B, onda 1).
 * Executar: npm run probe:shape  (via vitest, config dedicada)
 * Relatorio: tmp/shape.txt
 *
 * Origem: D-25-07 (nao existe gate nenhum sobre dispersao, e duas metricas ja
 * colapsaram), D-25-06 (a razao de torres esta DENTRO da banda com a FORMA errada) e a
 * secao 7 de docs/diagnostics/25-sweep.md (contrafactual de quatro estados com
 * atribuicao causal fechada).
 *
 * PARA QUE ESTA SONDA EXISTE, e o que ela deliberadamente NAO faz.
 *
 * A Fase 25 acertou o NIVEL de seis bandas e colapsou a FORMA, e ninguem percebeu ate o
 * ultimo plano dela, porque todas as bandas da v2.2 sao sobre nivel e nenhuma vigia
 * variacao. As ondas seguintes desta fase vao mexer no motor. Sem um instrumento que
 * veja dispersao e forma ANTES disso, uma regressao de variancia causada pelo proprio
 * conserto passaria invisivel, que e exatamente o modo de falha que esta sonda existe
 * para eliminar. E o padrao instrumento antes de motor, ja usado tres vezes nesta
 * milestone (a Fase 23 inteira, o gate de assistencia do 24-01 e o retrato PRE do 25-01).
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: semente igual ao indice da partida, nunca semente compartilhada
 *   - Instancia nova de gerador por partida: mulberry32(seed), uma por simulacao
 *   - Nenhuma fonte de aleatoriedade da plataforma neste arquivo
 *   - Este arquivo NUNCA modifica src/sim/: ele so chama simulateMatch e le o resultado
 *   - Toda estatistica vem de scripts/stats.ts (mean, stdev, summarize,
 *     bimodalityCoefficient, shareWhere), nunca reimplementada aqui. INST-06 recusa
 *     dependencia externa de estatistica e reimplementar local teria o mesmo efeito:
 *     duas definicoes de percentil no repositorio moveriam bandas em silencio
 *   - ESTA SONDA NAO CONTEM ASSERCAO E NAO E GATE. Ela sai 0 seja qual for o numero
 *     medido, no mesmo espirito de scripts/diagnose-engine.ts e de
 *     scripts/probe-side-bias.ts. A separacao entre relatorio e gate esta descrita em
 *     scripts/README.md secao 4 ("Dois tipos de artefato, nunca misturados")
 *   - A sonda NAO entra na cadeia de scripts/calibrate-all.mjs. A lista fixa de sete
 *     gates fica intacta: a implantacao das bandas e a onda 2, em calibrate-pace.ts
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { describe, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES, LANES } from "../src/sim/matchState";
import {
  mean,
  stdev,
  summarize,
  shareWhere,
  bimodalityCoefficient,
  BC_UNIMODAL_THRESHOLD,
} from "./stats";
import type { PlayerVersion, Role } from "../src/data/schema";
import type { SimulationResult } from "../src/sim/engine";
import type { Side, TeamState } from "../src/sim/matchState";
import type { EventKind } from "../src/sim/simEvents";

// ---------------------------------------------------------------------------
// Configuracao. NAO MEXER SEM LER ESTE BLOCO INTEIRO.
// ---------------------------------------------------------------------------

/**
 * N = 800 e a fixture abaixo NAO sao escolha desta sonda: sao copia do tier EQUILIBRADO
 * de scripts/calibrate-pace.ts, e o motivo e a razao de ser deste arquivo.
 *
 * A banda de dispersao da onda 2 vai viver em calibrate-pace.ts e ser avaliada sobre a
 * populacao daquele harness. Se esta sonda medisse outra populacao, a tabela de
 * ancoragem que ela produz nao serviria de referencia para aquele gate: o numero
 * impresso aqui tem de ser o MESMO numero que o gate vai avaliar la, ou a ancoragem
 * assina um erro sistematico de origem desconhecida na primeira casa decimal.
 *
 * O desalinhamento que este arquivo existe para eliminar esta escrito em D-25-07: os
 * sete coeficientes de variacao ja conhecidos do baseline vem de npm run diagnose,
 * Cenario A, N igual a 1500, enquanto a banda vai viver com N igual a 800.
 */
const N = 800;

/**
 * DOIS TIERS, e os dois tem papeis diferentes que nao podem ser confundidos.
 *
 * EQUILIBRADO (75 contra 75) e o tier de REFERENCIA: e onde quase toda banda de
 * calibrate-pace.ts e avaliada e e onde a banda de dispersao da onda 2 vai morar.
 *
 * GAP-LEVE (80 contra 70) e OBSERVACAO nesta fase e NUNCA vira banda. Ele esta aqui
 * porque a medicao de D-25-06 mostrou que nele a mesma deformacao vai ao extremo
 * (shutout de 44,9 para 70,3 por cento, e o 9 a 0 exato de 20,9 para 41,6 por cento).
 * Sem esta coluna a fase nao consegue dizer se o conserto GENERALIZOU ou se apenas
 * acertou o tier de referencia, que e uma diferenca que so aparece medindo os dois.
 *
 * Os dois sao copia verbatim de scripts/calibrate-pace.ts:102-109.
 */
interface Tier {
  name: string;
  us: number;
  rs: number;
  papel: string;
}

const TIERS: Tier[] = [
  { name: "EQUILIBRADO", us: 75, rs: 75, papel: "REFERENCIA (a banda da onda 2 mora aqui)" },
  { name: "GAP-LEVE", us: 80, rs: 70, papel: "OBSERVACAO (nunca vira banda nesta fase)" },
];

/**
 * Maximo do contador de torres por lado. Nao e constante de motor: e o teto aritmetico
 * de `towersDestroyed`, que conta tres torres em cada uma das tres rotas do adversario
 * e NAO conta as duas do Nexus (D-25-04). Nove e o valor que o contrafactual da secao 7
 * de 25-sweep.md usa como "maximo do contador".
 */
const MAX_CONTADOR_TORRES = 9;

/**
 * Corte de SHUTOUT: perdedor terminando com 0 ou 1 torre. Mesma definicao da secao 7 de
 * docs/diagnostics/25-sweep.md, para que os numeros desta sonda sejam comparaveis linha
 * a linha com os quatro estados do contrafactual.
 */
const SHUTOUT_MAX_TORRES = 1;

/**
 * Cortes de classificacao de dinamica, copiados literalmente de
 * scripts/diagnose-engine.ts:287-289. Copia e nao import porque diagnose-engine.ts nao
 * exporta a regra, e reimplementar com OUTROS cortes produziria uma fracao de comeback
 * que nao seria comparavel com os 66,5 por cento do baseline congelado da Fase 24.
 */
const STOMP_MIN_WINPROB = 0.42;
const COMEBACK_MAX_WINPROB = 0.32;

/** Mesmos kinds de primeira torre usados por scripts/calibrate-pace.ts:305. */
const FIRST_TOWER_KINDS: ReadonlySet<EventKind> = new Set(["first_tower", "tower_destroyed"]);

// ---------------------------------------------------------------------------
// Builders de fixture flat (copiados verbatim de scripts/calibrate-pace.ts:68-90,
// que por sua vez os copiou de calibrate-structures.ts:57-79)
// Stat uniforme em todos os campos -> neutralidade (INV-1)
// Repeticao deliberada por arquivo, convencao da secao 3 de scripts/README.md: cada
// harness precisa ser legivel isoladamente, sem pular para outro arquivo.
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
// Leituras do estado final
// ---------------------------------------------------------------------------

/**
 * Uma rota conta como LIMPA POR INTEIRO quando as tres estruturas de torre daquela lane
 * cairam: `outerAlive`, `innerAlive` e `inhibTurretAlive` todas falsas em
 * `structures[lane]` do lado informado (src/sim/matchState.ts:134-141).
 *
 * LIDO DO ESTADO FINAL, NUNCA INFERIDO DA TIMELINE, e a razao e concreta: a timeline
 * tem pelo menos dois caminhos de queda que nao sao equivalentes ao contador (o caminho
 * do Arauto incrementa o contador sem emitir evento, e o ramo de torre do Nexus emite
 * evento sem incrementar o contador, que e D-25-04). Contar queda por evento produziria
 * um numero que nao fecha com o estado, e a conciliacao dessas tres leituras ja custou
 * um item diferido inteiro no plano 25-05.
 */
function rotasLimpasPorInteiro(team: TeamState): number {
  let limpas = 0;
  for (const lane of LANES) {
    const s = team.structures[lane];
    if (!s.outerAlive && !s.innerAlive && !s.inhibTurretAlive) limpas++;
  }
  return limpas;
}

/** Menor timeSec entre eventos de um dos kinds informados (timeline cronologica). */
function primeiroEventoSec(res: SimulationResult, kinds: ReadonlySet<EventKind>): number {
  for (const ev of res.timeline) {
    if (kinds.has(ev.kind)) return ev.timeSec;
  }
  return Infinity;
}

type Dinamica = "stomp" | "equilibrado" | "comeback";

/**
 * Classificacao de dinamica, reproduzindo literalmente scripts/diagnose-engine.ts:248-289:
 * o minimo da probabilidade de vitoria DO VENCEDOR ao longo da timeline inteira. Se o
 * vencedor nunca esteve abaixo de 0,42 foi atropelo; se chegou a estar abaixo de 0,32
 * foi virada; o resto e equilibrado.
 *
 * Esta e a medicao mais direta possivel do core value declarado em PROJECT.md linha 9
 * ("lanes apertadas podem virar"), e foi ela que produziu o numero mais grave da secao 8
 * de 25-sweep.md: comeback caiu de 66,5 para 32,7 por cento entre o baseline congelado
 * da Fase 24 e o estado de hoje.
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
// Coletor
// ---------------------------------------------------------------------------

interface Coleta {
  jogos: number;

  // --- as dez series de DISPERSAO, cada uma como serie POR PARTIDA ---
  duracaoSec: number[];
  abatesTotais: number[];
  torresVencedor: number[];
  torresPerdedor: number[];
  torresTotais: number[];
  torresPorMin: number[];
  primeiraTorreSec: number[];
  ouroVencedor: number[];
  ouroPerdedor: number[];
  ouroPorMinTime: number[];

  // --- a decima primeira linha, que nao e coeficiente de variacao ---
  dinamica: Record<Dinamica, number>;

  // --- insumos de FORMA ---
  rotasLimpas: number[];

  // --- linha observada de D-25-04 ---
  torresVencedorComNexus: number[];
}

function coletaVazia(): Coleta {
  return {
    jogos: 0,
    duracaoSec: [],
    abatesTotais: [],
    torresVencedor: [],
    torresPerdedor: [],
    torresTotais: [],
    torresPorMin: [],
    primeiraTorreSec: [],
    ouroVencedor: [],
    ouroPerdedor: [],
    ouroPorMinTime: [],
    dinamica: { stomp: 0, equilibrado: 0, comeback: 0 },
    rotasLimpas: [],
    torresVencedorComNexus: [],
  };
}

function acumular(res: SimulationResult, c: Coleta): void {
  c.jogos++;

  const minutos = res.durationSec / 60;
  const vencedor: Side = res.winner;
  const perdedor: Side = vencedor === "user" ? "rival" : "user";
  const timeVencedor = res.finalState[vencedor];
  const timePerdedor = res.finalState[perdedor];

  const torresV = timeVencedor.towersDestroyed;
  const torresP = timePerdedor.towersDestroyed;

  c.duracaoSec.push(res.durationSec);
  c.abatesTotais.push(res.finalState.user.kills + res.finalState.rival.kills);
  c.torresVencedor.push(torresV);
  c.torresPerdedor.push(torresP);
  c.torresTotais.push(torresV + torresP);

  // AS DUAS DERIVADAS SAO CALCULADAS POR PARTIDA, NUNCA COMO RAZAO DE MEDIAS.
  // Coeficiente de variacao de uma razao de medias nao existe: a razao de medias e um
  // unico numero, sem desvio. Para haver dispersao e preciso haver uma serie, entao a
  // divisao acontece dentro de cada partida e a estatistica roda sobre a serie inteira.
  c.torresPorMin.push((torresV + torresP) / minutos);
  c.ouroPorMinTime.push((res.finalState.user.gold + res.finalState.rival.gold) / 2 / minutos);

  const primeiraTorre = primeiroEventoSec(res, FIRST_TOWER_KINDS);
  if (Number.isFinite(primeiraTorre)) c.primeiraTorreSec.push(primeiraTorre);

  c.ouroVencedor.push(timeVencedor.gold);
  c.ouroPerdedor.push(timePerdedor.gold);

  c.dinamica[classificarDinamica(res)]++;

  c.rotasLimpas.push(rotasLimpasPorInteiro(timePerdedor));

  // LINHA OBSERVADA DE D-25-04, sem banda. Ver o bloco de leitura no relatorio.
  c.torresVencedorComNexus.push(torresV + (2 - timePerdedor.nexusTurretsAlive));
}

function rodarTier(tier: Tier): Coleta {
  const c = coletaVazia();
  for (let seed = 0; seed < N; seed++) {
    // INVARIANTE: semente igual ao indice da partida, nunca semente compartilhada;
    // instancia nova de gerador por partida; nenhuma fonte de aleatoriedade da plataforma.
    const res = simulateMatch(roster("u", tier.us), roster("r", tier.rs), mulberry32(seed));
    acumular(res, c);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Estatistica derivada (tudo o que e formula vem de scripts/stats.ts)
// ---------------------------------------------------------------------------

/**
 * Coeficiente de variacao: desvio POPULACIONAL dividido pela media, com `mean` e `stdev`
 * de scripts/stats.ts. E o eixo escolhido por D-25-07 em vez do desvio absoluto, e o
 * motivo esta medido: a duracao caiu 31 por cento entre o baseline e hoje, entao desvio
 * absoluto menor pode ser exatamente a MESMA dispersao relativa.
 *
 * Retorna NaN quando a media e zero, para que o relatorio imprima "n/a" em vez de um
 * infinito silencioso.
 */
function coefVariacao(a: readonly number[]): number {
  const m = mean(a);
  return m === 0 ? NaN : stdev(a) / m;
}

// ---------------------------------------------------------------------------
// Formatacao pt-BR
// ---------------------------------------------------------------------------

function num(x: number, casas: number): string {
  if (!Number.isFinite(x)) return "n/a";
  return x.toFixed(casas).replace(".", ",");
}

function pct(x: number): string {
  return `${num(x * 100, 1)} por cento`;
}

function mmss(sec: number): string {
  if (!Number.isFinite(sec)) return "n/a";
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

/** Uma linha de dispersao: rotulo, media, desvio populacional e coeficiente de variacao. */
function linhaDispersao(rotulo: string, a: readonly number[], casasMedia: number): string {
  return (
    `  ${rotulo.padEnd(34)} ` +
    `media ${num(mean(a), casasMedia).padStart(10)}  |  ` +
    `desvio ${num(stdev(a), casasMedia).padStart(10)}  |  ` +
    `CV ${num(coefVariacao(a), 4).padStart(7)}  |  n = ${a.length}\n`
  );
}

/** Uma linha de forma: rotulo e fracao da amostra do tier. */
function linhaForma(rotulo: string, fracao: number, contagem: number, n: number): string {
  return `  ${rotulo.padEnd(56)} ${pct(fracao).padStart(20)}  (${contagem}/${n})\n`;
}

/** Linha de coeficiente de bimodalidade com o limiar ao lado e o veredito textual. */
function linhaBC(rotulo: string, a: readonly number[]): string {
  const bc = bimodalityCoefficient(a);
  if (bc === null) {
    return `  ${rotulo.padEnd(34)} BC n/a (amostra pequena ou variancia zero)\n`;
  }
  const veredito = bc > BC_UNIMODAL_THRESHOLD ? "BIMODAL" : "unimodal";
  return (
    `  ${rotulo.padEnd(34)} BC ${num(bc, 4).padStart(7)}  ` +
    `limiar ${num(BC_UNIMODAL_THRESHOLD, 4)}  ${veredito}\n`
  );
}

/** Bloco de percentis, via summarize de scripts/stats.ts. */
function linhaPercentis(rotulo: string, a: readonly number[]): string {
  const s = summarize(a);
  return (
    `  ${rotulo.padEnd(34)} ` +
    `p5 ${num(s.p5, 2)}  p25 ${num(s.p25, 2)}  p50 ${num(s.p50, 2)}  ` +
    `p75 ${num(s.p75, 2)}  p95 ${num(s.p95, 2)}  |  min ${num(s.min, 2)}  max ${num(s.max, 2)}\n`
  );
}

// ---------------------------------------------------------------------------
// Relatorio por tier
// ---------------------------------------------------------------------------

function blocoTier(tier: Tier, c: Coleta): string {
  let out = `\n=== TIER ${tier.name} (user ${tier.us} contra rival ${tier.rs}, ${c.jogos} jogos) ===\n`;
  out += `  papel nesta fase: ${tier.papel}\n`;

  out += "\n--- DISPERSAO: dez series por partida, media, desvio populacional e coeficiente de variacao ---\n";
  out += linhaDispersao("1. duracao (s)", c.duracaoSec, 2);
  out += linhaDispersao("2. abates totais por partida", c.abatesTotais, 2);
  out += linhaDispersao("3. torres do vencedor", c.torresVencedor, 3);
  out += linhaDispersao("4. torres do perdedor", c.torresPerdedor, 3);
  out += linhaDispersao("5. torres totais", c.torresTotais, 3);
  out += linhaDispersao("6. torres por minuto", c.torresPorMin, 4);
  out += linhaDispersao("7. primeira torre (s)", c.primeiraTorreSec, 2);
  out += linhaDispersao("8. ouro final do vencedor", c.ouroVencedor, 1);
  out += linhaDispersao("9. ouro final do perdedor", c.ouroPerdedor, 1);
  out += linhaDispersao("10. ouro por minuto por time", c.ouroPorMinTime, 2);
  out += `  duracao mediana ${mmss(summarize(c.duracaoSec).p50)}  |  primeira torre mediana ${mmss(summarize(c.primeiraTorreSec).p50)}\n`;

  out += "\n--- A DECIMA PRIMEIRA LINHA: dinamica, que NAO e coeficiente de variacao ---\n";
  out += "  Proporcao agregada sobre a populacao inteira, entao ela nao tem dispersao por\n";
  out += "  partida e entra na onda 2 como banda sobre o VALOR, nunca sobre o CV.\n";
  out += linhaForma("stomp (vencedor nunca abaixo de 0,42)", c.dinamica.stomp / c.jogos, c.dinamica.stomp, c.jogos);
  out += linhaForma("equilibrado", c.dinamica.equilibrado / c.jogos, c.dinamica.equilibrado, c.jogos);
  out += linhaForma("comeback (vencedor esteve abaixo de 0,32)", c.dinamica.comeback / c.jogos, c.dinamica.comeback, c.jogos);

  out += "\n--- FORMA: seis fracoes da amostra do tier ---\n";
  const noMaximo = shareWhere(c.torresVencedor, (t) => t === MAX_CONTADOR_TORRES);
  const tresRotas = shareWhere(c.rotasLimpas, (r) => r === 3);
  const umaRota = shareWhere(c.rotasLimpas, (r) => r === 1);
  const shutout = shareWhere(c.torresPerdedor, (t) => t <= SHUTOUT_MAX_TORRES);
  const noveAZero = c.torresVencedor.filter(
    (t, i) => t === MAX_CONTADOR_TORRES && c.torresPerdedor[i] === 0
  ).length / c.jogos;
  const perdedorEmZero = shareWhere(c.torresPerdedor, (t) => t === 0);

  out += linhaForma(
    `1. vencedor no maximo do contador (torres = ${MAX_CONTADOR_TORRES})`,
    noMaximo,
    Math.round(noMaximo * c.jogos),
    c.jogos
  );
  out += linhaForma("2. vitoria exigiu limpar as TRES rotas do perdedor", tresRotas, Math.round(tresRotas * c.jogos), c.jogos);
  out += linhaForma("3. vitoria veio com exatamente UMA rota limpa", umaRota, Math.round(umaRota * c.jogos), c.jogos);
  out += linhaForma("4. shutout (perdedor com 0 ou 1 torre)", shutout, Math.round(shutout * c.jogos), c.jogos);
  out += linhaForma("5. exatamente 9 a 0", noveAZero, Math.round(noveAZero * c.jogos), c.jogos);
  out += "  6. histograma da contagem de rotas do perdedor limpas por inteiro:\n";
  for (const k of [0, 1, 2, 3]) {
    const f = shareWhere(c.rotasLimpas, (r) => r === k);
    out += `       ${k} rota(s): ${pct(f).padStart(20)}  (${Math.round(f * c.jogos)}/${c.jogos})\n`;
  }
  out += `       media de rotas limpas: ${num(mean(c.rotasLimpas), 3)}\n`;
  out += `  linha de contexto (sem banda): perdedor em ZERO torres ${pct(perdedorEmZero)}\n`;

  out += "\n--- OS DOIS COEFICIENTES DE BIMODALIDADE, e APENAS estes dois ---\n";
  out += linhaBC("torres do vencedor", c.torresVencedor);
  out += linhaBC("torres do perdedor", c.torresPerdedor);
  out += linhaPercentis("torres do vencedor", c.torresVencedor);
  out += linhaPercentis("torres do perdedor", c.torresPerdedor);
  out += "  O coeficiente de bimodalidade da RAZAO de torres esta DELIBERADAMENTE AUSENTE.\n";
  out += "  Motivo, do bloco de aviso de instrumento de docs/diagnostics/25-sweep.md: sobre\n";
  out += "  quociente de inteiros pequenos ele fica acima do limiar nos QUATRO estados do\n";
  out += "  contrafactual, inclusive no pre-fase (0,7359), e portanto NAO DISCRIMINA. Ele e\n";
  out += "  inflado por massa pontual em 1,000 exato, por cauda longa a direita e pela\n";
  out += "  indefinicao quando o perdedor termina em zero torre, que descarta ate 22,9 por\n";
  out += "  cento da amostra de forma NAO aleatoria, removendo justamente os extremos.\n";

  out += "\n--- LINHA OBSERVADA DE D-25-04: torres do vencedor INCLUINDO as duas do Nexus ---\n";
  out += linhaDispersao("torres do vencedor com Nexus", c.torresVencedorComNexus, 3);
  out += "  Calculada como towersDestroyed do vencedor mais dois menos nexusTurretsAlive do\n";
  out += "  perdedor, lido do estado final.\n";
  out += "  POR QUE ELA EXISTE: `towersDestroyed` NAO conta as duas torres do Nexus, porque o\n";
  out += "  ramo de torre do Nexus de damageStructure e o unico ramo de queda que nao chama\n";
  out += "  recordTower() (D-25-04, medido em 1,292 quedas por partida). A referencia de pro\n";
  out += "  play de 9,15 torres do vencedor e sobre ONZE torres por lado, e sem esta linha a\n";
  out += "  leitura de nivel contra aquela referencia fica otimista por construcao: compara um\n";
  out += "  contador de nove com uma referencia de onze.\n";
  out += "  ESTA LINHA NAO VIRA BANDA NESTA FASE E NAO MUDA O CONTADOR. Ela e observacao para\n";
  out += "  a revisao em bloco da Fase 30, que e onde o destino de D-25-04 sera decidido.\n";

  return out;
}

// ---------------------------------------------------------------------------
// Sonda principal. Um bloco de descricao e um caso envolvendo o corpo inteiro.
// NENHUMA ASSERCAO EM LUGAR NENHUM DESTE ARQUIVO.
// ---------------------------------------------------------------------------

describe("sonda de dispersao e forma da distribuicao estrutural (Fase 25B, onda 1, observacao pura)", () => {
  it("roda os dois tiers deterministicos, mede dispersao e forma e escreve o relatorio, sem assercao", () => {
    const resultados = new Map<string, Coleta>();
    for (const tier of TIERS) {
      resultados.set(tier.name, rodarTier(tier));
    }

    let out = "";
    out += "RELATORIO DE DISPERSAO E FORMA DA DISTRIBUICAO ESTRUTURAL (Fase 25B, onda 1)\n";
    out += "===========================================================================\n";
    out += "\nSONDA DE OBSERVACAO PURA. Este relatorio NAO e gate: o arquivo que o produz\n";
    out += "(scripts/probe-shape.ts) nao contem assercao nenhuma e sai 0 seja qual for o numero\n";
    out += "abaixo, e ele NAO entra na cadeia de npm run calibrate:all.\n";
    out += "\nA implantacao das bandas e a ONDA 2, em scripts/calibrate-pace.ts, pelo mecanismo\n";
    out += "checkBand que ja existe. Esta onda entrega o instrumento e a ancoragem, e nada mais.\n";

    out += "\n=== FIXTURE E N ===\n";
    out += `  N = ${N} partidas por tier, semente igual ao indice da partida (0 a ${N - 1})\n`;
    out += "  instancia nova de gerador por partida (mulberry32), sem fonte de aleatoriedade da plataforma\n";
    out += "  fixture flat, stat uniforme em todos os campos, copiada verbatim do tier EQUILIBRADO\n";
    out += "  de scripts/calibrate-pace.ts (linhas 68 a 90 para os builders, 102 a 109 para os tiers)\n";
    out += "  O N e a fixture NAO sao escolha desta sonda: sao os do gate que vai receber a banda\n";
    out += "  na onda 2. Medir outra populacao aqui tornaria a tabela de ancoragem inutil para\n";
    out += "  aquele gate, que e precisamente o desalinhamento que D-25-07 deixou aberto.\n";

    for (const tier of TIERS) {
      out += blocoTier(tier, resultados.get(tier.name)!);
    }

    out += "\n=== LEITURA (texto fixo, tres pontos) ===\n";
    out += "\n1. ANCORAGEM. Os sete coeficientes de variacao ja congelados vem do baseline oficial\n";
    out += "   da v2.2 (docs/baselines/24-baseline-v2.2.md), medidos por npm run diagnose,\n";
    out += "   Cenario A, N = 1500: duracao 0,1599, abates totais 0,2731, primeira torre 0,2545,\n";
    out += "   torres do vencedor 0,2802, torres do perdedor 0,5567, ouro do vencedor 0,1969 e\n";
    out += "   ouro do perdedor 0,2359. Os de torres totais, torres por minuto e ouro por minuto\n";
    out += "   NAO constam daquele relatorio com bloco estatistico (D-25-07) e sao medidos aqui\n";
    out += "   pela primeira vez. A tabela de ancoragem completa, medida NO MOTOR PRE-FASE-25 com\n";
    out += "   esta mesma sonda, vive em docs/diagnostics/25B-ancoragem.md.\n";

    out += "\n2. O QUE A SONDA MEDE E O QUE ELA NAO MEDE. Ela mede DISPERSAO (coeficiente de\n";
    out += "   variacao) e FORMA (fracoes, histograma de rotas limpas e os dois coeficientes de\n";
    out += "   bimodalidade das DISTRIBUICOES de torres). Ela NAO mede forma de RAZAO, por\n";
    out += "   decisao registrada, e nao acrescenta banda nenhuma.\n";

    out += "\n3. REFERENCIA DE FORMA DO CONTRAFACTUAL (25-sweep.md secao 7, tier EQUILIBRADO,\n";
    out += "   N = 800, mesma fixture desta sonda), para leitura lado a lado:\n";
    out += "     estado D pre-fase / C canal off / B termo off / A hoje\n";
    out += "     CV das torres do vencedor ...... 0,2777 / 0,2629 / 0,0969 / 0,0568\n";
    out += "     BC das torres do vencedor ...... 0,4542 / 0,3849 / 0,5570 / 0,7853\n";
    out += "     BC das torres do perdedor ...... 0,4406 / 0,3777 / 0,5851 / 0,6493\n";
    out += "     shutout (por cento) ............ 17,9 / 13,9 / 1,4 / 44,9\n";
    out += "     9 a 0 exato (por cento) ........ 0,1 / 0,0 / 0,1 / 20,9\n";
    out += "     vencedor no maximo (por cento) . 3,9 / 0,4 / 52,9 / 90,8\n";
    out += "     uma rota limpa (por cento) ..... 58,0 / 72,1 / 10,6 / 2,6\n";
    out += "     tres rotas limpas (por cento) .. 3,9 / 0,4 / 52,9 / 90,8\n";

    out += "\n=== ORIGEM ===\n";
    out += "  D-25-06 e D-25-07 em .planning/phases/25-throughput-estrutural-o-canal-absoluto/deferred-items.md\n";
    out += "  docs/diagnostics/25-sweep.md secoes 7 e 8, e o bloco de aviso de instrumento\n";
    out += "  ROADMAP.md, Fase 25B, criterios 1 a 3\n";

    console.log(out);
    try {
      mkdirSync("tmp", { recursive: true });
    } catch {
      // ja existe
    }
    writeFileSync("tmp/shape.txt", out, "utf-8");
  });
});
