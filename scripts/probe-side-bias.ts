/**
 * scripts/probe-side-bias.ts
 *
 * Sonda de vies de lado em fixture espelhado (Fase 25 / PACE-02, achado de vies de lado).
 * Executar: npm run probe:side-bias  (via vitest, config dedicada)
 * Relatorio: tmp/side-bias.txt
 *
 * Origem do achado: docs/diagnostics/achado-vies-de-lado.md (descoberto na Fase 24) e
 * Achado 8 de .planning/phases/25-throughput-estrutural-o-canal-absoluto/25-RESEARCH.md
 * (tabela de cinco linhas, N = 1500 por linha, IC95 declarado).
 *
 * NOTA DE ESCOPO, com todas as letras: corrigir o vies de lado esta FORA DE ESCOPO da
 * Fase 25. A pesquisa e o roadmap declaram isso, e o motivo e que mudar a ordem de
 * iteracao de lado (src/sim/engine.ts:377, :399, :614 e src/sim/laneState.ts:254) muda a
 * ORDEM de consumo do gerador, o que reescreve o golden inteiro e exige fase propria.
 *
 * Entao para que esta sonda existe? Para duas coisas, e nenhuma delas e conserto:
 *
 *   1. Para que a fase possa AFIRMAR, com numero e com a mesma fixture e o mesmo N nos
 *      dois lados, que NAO amplificou o vies. A leitura PRE e rodada agora, antes de o
 *      motor ser tocado; a leitura POS e rodada no fechamento da fase. Sem as duas com a
 *      mesma fixture, qualquer afirmacao sobre o vies e adjetivo, nao medicao.
 *   2. Para registrar a mudanca REAL de exposicao da populacao. O canal absoluto nao
 *      amplifica o vies (54,1 por cento contra 55,3 por cento do baseline, uma diferenca
 *      de 1,2 ponto percentual com IC95 de mais ou menos 2,5 pontos nos dois lados), mas
 *      leva a fracao de partidas decididas por nexo de 72,8 por cento para praticamente
 *      100 por cento. Hoje as partidas que batem no teto de 60 minutos sao muito menos
 *      enviesadas e funcionam como escapatoria; depois da fase essa escapatoria some e a
 *      populacao inteira passa a ficar exposta. Isso e mudanca real e precisa de numero.
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: semente igual ao indice da partida, nunca semente compartilhada
 *   - Instancia nova de gerador por partida: mulberry32(seed), uma por simulacao
 *   - Nenhuma fonte de aleatoriedade da plataforma neste arquivo
 *   - Este arquivo NUNCA modifica src/sim/: ele so chama simulateMatch e le o resultado
 *   - ESTA SONDA NAO CONTEM ASSERCAO E NAO E GATE. Ela sai 0 seja qual for o numero
 *     medido, no mesmo espirito de scripts/diagnose-engine.ts. A separacao entre
 *     relatorio e gate esta descrita em scripts/README.md secao 4 ("Dois tipos de
 *     artefato, nunca misturados")
 *   - A sonda NAO entra na cadeia de scripts/calibrate-all.mjs. A lista fixa de sete
 *     gates fica intacta: medir um achado declarado fora de escopo como se fosse gate
 *     faria a fase ser cobrada por um conserto que nao e dela
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { describe, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES } from "../src/sim/matchState";
import { mean, percentile } from "./stats";
import type { PlayerVersion, Role } from "../src/data/schema";
import type { SimulationResult } from "../src/sim/engine";

// ---------------------------------------------------------------------------
// Configuracao. NAO MEXER SEM LER ESTE BLOCO INTEIRO.
// ---------------------------------------------------------------------------

/**
 * N = 1500 vem do Achado 8 de 25-RESEARCH.md, que mediu as cinco linhas da tabela de
 * vies com exatamente este N e declarou IC95 em cada uma. A leitura PRE desta fase e a
 * leitura POS do fechamento so sao comparaveis se as duas usarem o MESMO N e a MESMA
 * fixture. Trocar o N torna a comparacao invalida, porque a meia-largura do IC95 muda
 * com a raiz de n e a diferenca medida entre as duas leituras (da ordem de 1 a 2 pontos
 * percentuais) e menor do que a variacao que uma troca de N introduz.
 */
const N = 1500;

/**
 * Fixture ESPELHADA: o mesmo stat nos dois lados. E o ponto central do desenho. Com os
 * dois times identicos em todos os campos, qualquer desvio de 50 por cento na taxa de
 * vitoria e atribuivel ao LADO e nunca a forca. E a mesma fixture 75 contra 75 do tier
 * EQUILIBRADO de scripts/calibrate-pace.ts e do Achado 8.
 */
const STAT_ESPELHADO = 75;

/** Teto duro de tempo da engine (src/sim/engine.ts:323, HARD_CAP_SEC = 60 * 60). */
const TETO_SEC = 3600;

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
// Classificacao de desfecho
// ---------------------------------------------------------------------------

type Desfecho = "por nexo" | "no teto";

/**
 * REGRA DE CLASSIFICACAO ESCOLHIDA, e por que ela e a suficiente.
 *
 * A regra ingenua seria "por nexo quando o ultimo evento da timeline e o encerramento
 * do jogo". Ela NAO funciona nesta engine, e vale registrar por que, para que ninguem a
 * reintroduza: `finishGame` (src/sim/engine.ts:1338-1350) empurra um evento `gg` TAMBEM
 * no caminho do teto de tempo (chamado em :359-362 quando o laco sai sem nexo). Ou seja
 * o ultimo evento e `gg` nos dois desfechos, e a regra ingenua classificaria 100 por
 * cento das partidas como "por nexo".
 *
 * A regra suficiente e a duracao. O laco de `simulateMatch` (src/sim/engine.ts:325) e
 * `while (!state.ended && state.gameTimeSec < 3600)`, e o tempo avanca em passos fixos
 * de tick a partir de zero. Uma partida que sai por nexo para com `gameTimeSec` estrito
 * abaixo de 3600; uma partida que bate no teto sai com `gameTimeSec` exatamente 3600.
 * Logo `durationSec >= TETO_SEC` identifica o teto sem ambiguidade. E a mesma definicao
 * ja usada por `st.capGames` em scripts/calibrate-pace.ts e pela fracao no teto de 60
 * minutos do baseline oficial, o que mantem as tres leituras comparaveis entre si.
 *
 * O unico caso que ela classifica de forma discutivel e o nexo que cai exatamente no
 * ultimo tick, aos 3600 s, contado aqui como "no teto". E um caso de fronteira raro e
 * conta para o mesmo lado nas duas leituras (PRE e POS), entao nao contamina a
 * comparacao, que e a finalidade da sonda.
 */
function classificar(res: SimulationResult): Desfecho {
  return res.durationSec >= TETO_SEC ? "no teto" : "por nexo";
}

// ---------------------------------------------------------------------------
// Coletores
// ---------------------------------------------------------------------------

interface Recorte {
  /** Numero de partidas neste recorte. */
  n: number;
  /** Vitorias do lado user neste recorte. */
  vitoriasUser: number;
}

function recorteVazio(): Recorte {
  return { n: 0, vitoriasUser: 0 };
}

interface Coleta {
  total: Recorte;
  porDesfecho: Record<Desfecho, Recorte>;
  duracaoSec: number[];
}

function coletaVazia(): Coleta {
  return {
    total: recorteVazio(),
    porDesfecho: { "por nexo": recorteVazio(), "no teto": recorteVazio() },
    duracaoSec: [],
  };
}

function acumular(res: SimulationResult, c: Coleta): void {
  const venceuUser = res.winner === "user";
  c.total.n++;
  if (venceuUser) c.total.vitoriasUser++;

  const d = classificar(res);
  c.porDesfecho[d].n++;
  if (venceuUser) c.porDesfecho[d].vitoriasUser++;

  c.duracaoSec.push(res.durationSec);
}

// ---------------------------------------------------------------------------
// Incerteza
// ---------------------------------------------------------------------------

/**
 * Meia-largura do IC95 BINOMIAL de uma proporcao, pela aproximacao normal usual:
 *
 *   meiaLargura = 1,96 * raiz( p * (1 - p) / n )
 *
 * onde p e a proporcao medida no proprio recorte e n e o tamanho DO RECORTE, nunca o N
 * total. E exatamente a formula que o baseline oficial (docs/baselines/
 * 24-baseline-v2.2.md) e o achado original (docs/diagnostics/achado-vies-de-lado.md)
 * ja declaram, e e a mesma do Achado 8 da pesquisa.
 *
 * Regra de impressao que este arquivo segue sem excecao: NUNCA imprimir uma proporcao
 * sem a meia-largura ao lado. Foi assim que o achado original foi construido, e e o que
 * torna a leitura PRE e a leitura POS comparaveis: uma diferenca de 1,2 ponto
 * percentual entre duas medicoes com IC95 de mais ou menos 2,5 pontos nao e diferenca.
 */
function meiaLarguraIC95(p: number, n: number): number {
  if (n <= 0) return 0;
  return 1.96 * Math.sqrt((p * (1 - p)) / n);
}

function proporcao(r: Recorte): number {
  return r.n === 0 ? 0 : r.vitoriasUser / r.n;
}

// ---------------------------------------------------------------------------
// Formatacao pt-BR
// ---------------------------------------------------------------------------

function num(x: number, casas: number): string {
  return x.toFixed(casas).replace(".", ",");
}

/** Proporcao em por cento, sempre com uma casa. */
function pct(x: number): string {
  return `${num(x * 100, 1)} por cento`;
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Uma linha de recorte: proporcao, meia-largura e n, nesta ordem, sempre juntos. */
function linhaRecorte(rotulo: string, r: Recorte, denominadorPopulacao: number): string {
  const p = proporcao(r);
  const hw = meiaLarguraIC95(p, r.n);
  const fracaoPop = denominadorPopulacao === 0 ? 0 : r.n / denominadorPopulacao;
  return (
    `  ${rotulo.padEnd(12)} ` +
    `fracao da populacao ${pct(fracaoPop).padStart(20)}  |  ` +
    `taxa de vitoria do lado user ${pct(p).padStart(20)}  ` +
    `IC95 mais ou menos ${num(hw * 100, 1)} pontos  |  n = ${r.n}\n`
  );
}

// ---------------------------------------------------------------------------
// Sonda principal. Um bloco de descricao e um caso envolvendo o corpo inteiro.
// NENHUMA ASSERCAO EM LUGAR NENHUM DESTE ARQUIVO.
// ---------------------------------------------------------------------------

describe("sonda de vies de lado em fixture espelhado (Fase 25 / PACE-02, observacao pura)", () => {
  it("roda N partidas espelhadas deterministicas, mede a linha de vies e escreve o relatorio, sem assercao", () => {
    const c = coletaVazia();

    for (let seed = 0; seed < N; seed++) {
      // INVARIANTE: semente igual ao indice da partida, nunca semente compartilhada;
      // instancia nova de gerador por partida; nenhuma fonte de aleatoriedade da plataforma.
      const res = simulateMatch(
        roster("u", STAT_ESPELHADO),
        roster("r", STAT_ESPELHADO),
        mulberry32(seed)
      );
      acumular(res, c);
    }

    const pTotal = proporcao(c.total);
    const hwTotal = meiaLarguraIC95(pTotal, c.total.n);
    const duracaoOrdenada = [...c.duracaoSec].sort((a, b) => a - b);

    let out = "";
    out += "RELATORIO DE VIES DE LADO EM FIXTURE ESPELHADA (Fase 25 / PACE-02)\n";
    out += "=================================================================\n";
    out += "\nSONDA DE OBSERVACAO PURA. Este relatorio NAO e gate: o arquivo que o produz\n";
    out += "(scripts/probe-side-bias.ts) nao contem assercao nenhuma e sai 0 seja qual for o\n";
    out += "numero abaixo, e ele NAO entra na cadeia de npm run calibrate:all.\n";
    out += "\nCORRIGIR O VIES DE LADO ESTA FORA DE ESCOPO DA FASE 25, declarado assim pela\n";
    out += "pesquisa (25-RESEARCH.md, Achado 8) e pelo roadmap. A sonda existe para que a fase\n";
    out += "possa afirmar com numero, e com a mesma fixture nos dois lados, que NAO amplificou\n";
    out += "o vies, e para registrar a mudanca real de exposicao da populacao.\n";

    out += "\n=== FIXTURE E N ===\n";
    out += `  confronto espelhado: fixture flat ${STAT_ESPELHADO} contra ${STAT_ESPELHADO}, stat uniforme em todos os campos\n`;
    out += "  os dois lados sao identicos, entao qualquer desvio de 50 por cento e atribuivel ao\n";
    out += "  LADO e nunca a forca (mesmo desenho de docs/diagnostics/achado-vies-de-lado.md)\n";
    out += `  N = ${N} partidas, semente igual ao indice da partida (0 a ${N - 1})\n`;
    out += "  instancia nova de gerador por partida (mulberry32), sem fonte de aleatoriedade da plataforma\n";
    out += `  o N vem do Achado 8 da pesquisa: a leitura POS do fechamento so e comparavel com esta\n`;
    out += `  leitura PRE se usar o MESMO N e a MESMA fixture\n`;

    out += "\n=== TAXA DE VITORIA DO LADO USER, TOTAL ===\n";
    out += `  ${pct(pTotal)}  IC95 mais ou menos ${num(hwTotal * 100, 1)} pontos  |  n = ${c.total.n}\n`;
    out += `  desvio de 50 por cento: ${num((pTotal - 0.5) * 100, 1)} pontos percentuais\n`;

    out += "\n=== TAXA DE VITORIA POR TIPO DE DESFECHO ===\n";
    out += "  classificacao pela duracao final: 'no teto' quando a partida chega ao limite de\n";
    out += `  ${TETO_SEC} s (${mmss(TETO_SEC)}); 'por nexo' em qualquer duracao menor. A regra do ultimo\n`;
    out += "  evento da timeline nao serve nesta engine, porque finishGame empurra o mesmo evento\n";
    out += "  de encerramento tambem no caminho do teto de tempo.\n";
    out += linhaRecorte("por nexo", c.porDesfecho["por nexo"], c.total.n);
    out += linhaRecorte("no teto", c.porDesfecho["no teto"], c.total.n);

    out += "\n=== DURACAO (linha de contexto, observacao) ===\n";
    out += `  media ${mmss(mean(c.duracaoSec))}  |  mediana ${mmss(percentile(duracaoOrdenada, 50))}  |  `;
    out += `p5 ${mmss(percentile(duracaoOrdenada, 5))}  |  p95 ${mmss(percentile(duracaoOrdenada, 95))}\n`;

    // -------------------------------------------------------------------------
    // BLOCO DE LEITURA: texto fixo, nao calculado. Sao as tres ancoras externas
    // que dao sentido aos numeros acima, e elas precisam ser as mesmas em toda
    // rodada da sonda, PRE ou POS.
    // -------------------------------------------------------------------------
    out += "\n=== LEITURA (texto fixo, tres pontos) ===\n";
    out += "\n1. REFERENCIA PRE DO BASELINE OFICIAL (25-RESEARCH.md, Achado 8, linha BASELINE,\n";
    out += "   fixture espelhada 75 contra 75, N = 1500):\n";
    out += "     taxa total do lado user ........ 55,3 por cento, IC95 mais ou menos 2,5 pontos\n";
    out += "     taxa condicional por nexo ...... 55,9 por cento, IC95 mais ou menos 3,0 pontos (n = 1092)\n";
    out += "     fracao decidida por nexo ....... 72,8 por cento\n";
    out += "     taxa condicional no teto ....... 53,9 por cento, IC95 mais ou menos 4,9 pontos (n = 408)\n";
    out += "   O candidato da fase mediu 54,1 por cento total e 54,1 por cento condicional por nexo,\n";
    out += "   com 100,0 por cento da populacao decidida por nexo. A diferenca de 1,2 ponto percentual\n";
    out += "   contra o baseline e menor que a meia-largura do IC95 dos dois lados: nao ha amplificacao\n";
    out += "   medida. O que muda de verdade e a EXPOSICAO: a escapatoria das partidas no teto, que sao\n";
    out += "   muito menos enviesadas, deixa de existir e a populacao inteira passa a ficar exposta.\n";

    out += "\n2. REGRA DE ALERTA (textual, sem assercao, e NAO e criterio de parada desta fase):\n";
    out += "     se a taxa condicional nas partidas por nexo subir acima de 58 por cento com N maior\n";
    out += "     ou igual a 1500, isso e sinal de amplificacao REAL do vies. A acao correta e abrir\n";
    out += "     item novo de backlog com dono, NUNCA um conserto dentro da Fase 25: mudar a ordem de\n";
    out += "     iteracao de lado altera a ORDEM de consumo do gerador e reescreve o golden inteiro,\n";
    out += "     que e a classe de mudanca que a convencao do projeto exige que tenha fase propria.\n";

    out += "\n3. NOTA DO CAMINHO DESCARTADO (25-RESEARCH.md, Achado 8, ultima linha da tabela):\n";
    out += "     a alavanca de piso no `force` (forceFloor = 0,40) mediu 58,3 por cento no recorte\n";
    out += "     por nexo, o valor MAIS ALTO de toda a tabela medida pela pesquisa. Ou seja o caminho\n";
    out += "     que a fase esta descartando nao e apenas inerte para o throughput (torres/min de\n";
    out += "     0,188 para 0,203 contra um piso de banda de 0,300): ele e tambem o unico da tabela\n";
    out += "     que AMPLIFICA o vies de lado. Isso e um argumento a mais contra ele, e esta\n";
    out += "     registrado em docs/diagnostics/25-caminhos-descartados.md.\n";

    out += "\n=== ORIGEM DO ACHADO ===\n";
    out += "  docs/diagnostics/achado-vies-de-lado.md (Fase 24, mecanismo e call sites)\n";
    out += "  .planning/phases/25-throughput-estrutural-o-canal-absoluto/25-RESEARCH.md, Achado 8\n";

    console.log(out);
    try {
      mkdirSync("tmp", { recursive: true });
    } catch {
      // ja existe
    }
    writeFileSync("tmp/side-bias.txt", out, "utf-8");
  });
});
