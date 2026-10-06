/**
 * scripts/bands.ts
 *
 * Banda de dois lados com procedencia e fase dona obrigatorias (Fase 23 / INST-03).
 * Mitigacao estrutural do risco dominante da v2.2: a v2.0 fechou 13 de 13 criterios
 * verdes com gates de um lado so (so teto ou so piso) e entregou uma engine onde a
 * partida media dura 51 minutos com 88 abates, quando o real e ~32 minutos com ~27.
 *
 * O tipo Band torna floor, ceiling, source e owner campos obrigatorios: declarar
 * uma banda incompleta nao compila. Isso deixa mais facil escrever a banda de dois
 * lados completa do que o assert de um lado so (`toBeGreaterThan`/`toBeLessThan`
 * solto). owner existe porque calibrate:pace nasce vermelho de proposito (DEC-02) e
 * um vermelho sem dono vira ruido ignorado.
 */

import { expect } from "vitest";
import { inBand } from "./stats";

/** Lado da banda que foi estourado, ou null quando o valor esta dentro. */
export type BandSide = "PISO" | "TETO" | null;

export interface Band {
  /** menor valor aceitavel (inclusive) */
  floor: number;
  /** maior valor aceitavel (inclusive) */
  ceiling: number;
  /** valor de referencia: aparece na mensagem, nunca vira assert */
  target?: number;
  /** procedencia obrigatoria: arquivo e secao de onde a banda nasceu */
  source: string;
  /** fase dona da banda (ex.: "Fase 25"), para que um vermelho nao vire ruido ignorado */
  owner: string;
  /**
   * Verdadeiro quando nao existe fonte externa citavel e a banda e valor de
   * engenharia provisorio, a ser recalibrado pela fase dona com dado real.
   */
  provisional?: boolean;
}

export interface BandResult {
  label: string;
  value: number;
  band: Band;
  /** PISO, TETO ou null quando o valor esta dentro da banda */
  side: BandSide;
  ok: boolean;
  /** linha pt-BR pronta para o relatorio, sem o caractere travessao */
  line: string;
}

/** Formatador numerico deterministico: >= 100 sem casas decimais, senao 3 casas. */
function fmtNum(x: number): string {
  return Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(3);
}

/**
 * Classifica e formata um valor contra uma banda. NAO lanca por valor fora da
 * banda (isso e medicao, nao erro de codigo): so lanca quando a propria banda
 * e invalida (piso maior ou igual ao teto), que e erro de quem escreveu o gate.
 */
export function checkBand(label: string, value: number, band: Band): BandResult {
  if (band.floor >= band.ceiling) {
    throw new Error(
      `banda invalida para "${label}": floor (${band.floor}) >= ceiling (${band.ceiling})`
    );
  }

  const dentro = inBand(value, band.floor, band.ceiling);
  const side: BandSide = dentro ? null : value < band.floor ? "PISO" : "TETO";
  const ok = dentro;

  const status = ok ? "OK" : "FALHA";
  const provisionalMark = band.provisional ? " PROVISORIA" : "";
  const alvo = band.target !== undefined ? `, alvo ${fmtNum(band.target)}` : "";
  const situacao = ok
    ? "dentro da banda"
    : `estourou o ${side} da banda`;

  const line =
    `[${status}] [${band.owner}]${provisionalMark} ${label} = ${fmtNum(value)} ${situacao} ` +
    `[${fmtNum(band.floor)}, ${fmtNum(band.ceiling)}]${alvo} (fonte: ${band.source})`;

  return { label, value, band, side, ok, line };
}

/** Junta as linhas dos resultados por quebra de linha, na ordem de verificacao. */
export function formatBandTable(results: readonly BandResult[]): string {
  return results.map((r) => r.line).join("\n");
}

/**
 * Um unico assert do projeto contra a lista de violacoes (padrao de calibrate.ts:141):
 * falha uma vez com a lista completa, para que calibrate:pace mostre de uma vez
 * todas as bandas vermelhas com suas fases donas, em vez de parar na primeira.
 */
export function expectBands(results: readonly BandResult[]): void {
  const violacoes = results.filter((r) => !r.ok);
  const mensagem = violacoes.map((r) => r.line).join("; ");
  expect(violacoes.map((r) => r.line), mensagem).toEqual([]);
}

/** Atalho de um valor so: chama checkBand e assere o resultado. */
export function expectInBand(label: string, value: number, band: Band): void {
  const result = checkBand(label, value, band);
  expect(result.ok, result.line).toBe(true);
}
