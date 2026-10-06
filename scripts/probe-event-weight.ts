/**
 * scripts/probe-event-weight.ts
 *
 * Sonda de OBSERVACAO da distribuicao dos tres niveis de peso do evento
 * (Fase 26 plano 26-09, Task 3, D-02).
 * Executar: npx vitest run -c vitest.probe-event-weight.config.ts
 * Relatorio: tmp/event-weight.txt
 *
 * Origem: Task 1/Task 2 deste plano acrescentam computeEventWeight e as variantes
 * de texto por nivel (virada/decisivo/rotina). Esta sonda mede a distribuicao real
 * dos tres niveis sobre corpus com semente fixa, no mesmo tier de referencia do
 * gate de ritmo, e confirma ou ajusta DECISIVE_WIN_PROB_DELTA (deathQuality.ts)
 * contra o criterio de sanidade escrito ANTES desta sonda rodar pela primeira vez
 * (secao "CRITERIO DE SANIDADE" abaixo, no mesmo padrao instrumento-antes-de-motor
 * ja praticado por scripts/probe-shape.ts e scripts/probe-lift.ts).
 *
 * O QUE ESTA SONDA MEDE E O QUE ELA NAO MEDE. O peso (_eventWeight) so e computado
 * e ANEXADO ao SimEvent visivel para abates que passam por makeKillEvent: first
 * blood, ate dois shutdowns destacados por tick de teamfight, e todo abate solo/
 * gank/pickoff. Abates absorvidos por decorateMultikill (DOUBLE KILL/TRIPLE KILL/
 * etc.) nunca tem _eventWeight anexado, pelo MESMO motivo por que nunca tiveram
 * _deathQuality (o modulo-scoped _lastEventWeight so e lido por makeKillEvent,
 * padrao pre-existente da Fase 12, nao alterado por este plano). Esta sonda mede,
 * portanto, exatamente a populacao que o TICKER realmente comunica linha a linha
 * (o dominio de D-02), e nao "todo applyKill interno da partida".
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = i por partida, nunca seed compartilhada
 *   - Sem Math.random: apenas mulberry32(seed)
 *   - Este arquivo NUNCA modifica src/sim/: so chama simulateMatch e le o resultado
 *   - Toda estatistica vem de scripts/stats.ts (mean, stdev, percentile), nunca
 *     reimplementada aqui (DEC-04/INST-06)
 *   - ESTA SONDA NAO CONTEM ASSERCAO E NAO E GATE. Sai 0 seja qual for o numero
 *     medido, no mesmo espirito de probe-shape.ts/probe-lift.ts/probe-side-bias.ts
 *   - Nao entra na cadeia de scripts/calibrate-all.mjs
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { describe, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES } from "../src/sim/matchState";
import { mean, percentile } from "./stats";
import type { PlayerVersion, Role } from "../src/data/schema";
import type { EventWeight } from "../src/sim/deathQuality";

// ---------------------------------------------------------------------------
// Configuracao. Copiada verbatim do tier EQUILIBRADO de scripts/calibrate-pace.ts
// (linhas 68-90 para os builders, 102-109 para o tier), porque o Task 3 pede
// explicitamente "o mesmo tier de referencia usado pelo gate de ritmo".
// ---------------------------------------------------------------------------

const N = 800;

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
// Coletor
// ---------------------------------------------------------------------------

interface Coleta {
  jogos: number;
  contagemPorJogo: Record<EventWeight, number[]>;
  totalPorNivel: Record<EventWeight, number>;
  amostra: { nivel: EventWeight; ticker: string; seed: number }[];
}

function coletaVazia(): Coleta {
  return {
    jogos: 0,
    contagemPorJogo: { virada: [], decisivo: [], rotina: [] },
    totalPorNivel: { virada: 0, decisivo: 0, rotina: 0 },
    amostra: [],
  };
}

function rodar(): Coleta {
  const c = coletaVazia();
  for (let seed = 0; seed < N; seed++) {
    const res = simulateMatch(roster("u", 75), roster("r", 75), mulberry32(seed));
    c.jogos++;
    const porNivel: Record<EventWeight, number> = { virada: 0, decisivo: 0, rotina: 0 };
    for (const ev of res.timeline) {
      const w = (ev as { _eventWeight?: EventWeight })._eventWeight;
      if (!w) continue;
      porNivel[w]++;
      c.totalPorNivel[w]++;
      if (c.amostra.filter((a) => a.nivel === w).length < 6) {
        c.amostra.push({ nivel: w, ticker: ev.ticker, seed });
      }
    }
    c.contagemPorJogo.virada.push(porNivel.virada);
    c.contagemPorJogo.decisivo.push(porNivel.decisivo);
    c.contagemPorJogo.rotina.push(porNivel.rotina);
  }
  return c;
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

function linhaNivel(rotulo: string, serie: readonly number[]): string {
  const sorted = [...serie].sort((a, b) => a - b);
  return (
    `  ${rotulo.padEnd(12)} ` +
    `media ${num(mean(serie), 3).padStart(8)}  |  ` +
    `mediana ${num(percentile(sorted, 50), 3).padStart(6)}  |  ` +
    `p10 ${num(percentile(sorted, 10), 3).padStart(6)}  |  ` +
    `p90 ${num(percentile(sorted, 90), 3).padStart(6)}\n`
  );
}

// ---------------------------------------------------------------------------
// Sonda principal. NENHUMA ASSERCAO.
// ---------------------------------------------------------------------------

describe("sonda da distribuicao dos niveis de peso do evento (Fase 26 plano 26-09, Task 3)", () => {
  it("roda o tier EQUILIBRADO, mede a distribuicao dos tres niveis e escreve o relatorio, sem assercao", () => {
    const c = rodar();
    const total = c.totalPorNivel.virada + c.totalPorNivel.decisivo + c.totalPorNivel.rotina;

    let out = "";
    out += "RELATORIO DA DISTRIBUICAO DOS NIVEIS DE PESO DO EVENTO (Fase 26 plano 26-09, Task 3)\n";
    out += "======================================================================================\n";
    out += "\nSONDA DE OBSERVACAO PURA. Este relatorio NAO e gate: nao contem assercao e nao entra\n";
    out += "na cadeia de npm run calibrate:all.\n";

    out += "\n=== FIXTURE E N ===\n";
    out += `  N = ${N} partidas, tier EQUILIBRADO (75 contra 75), semente igual ao indice (0 a ${N - 1})\n`;
    out += "  instancia nova de gerador por partida (mulberry32), fixture copiada verbatim do\n";
    out += "  tier EQUILIBRADO de scripts/calibrate-pace.ts\n";

    out += "\n=== POPULACAO MEDIDA ===\n";
    out += `  ${total} eventos com _eventWeight anexado em ${c.jogos} partidas (${num(total / c.jogos, 3)} por partida).\n`;
    out += "  So abates que chegam ao ticker via makeKillEvent (first blood, ate dois shutdowns\n";
    out += "  destacados por teamfight, e todo abate solo/gank/pickoff) carregam _eventWeight; abates\n";
    out += "  absorvidos por DOUBLE KILL/TRIPLE KILL/etc nao carregam (mesmo padrao pre-existente de\n";
    out += "  _deathQuality, Fase 12, nao alterado por este plano). Esta e a populacao que o ticker\n";
    out += "  de fato comunica.\n";

    out += "\n=== DISTRIBUICAO POR NIVEL, POR PARTIDA (media, mediana, p10, p90) ===\n";
    out += linhaNivel("virada", c.contagemPorJogo.virada);
    out += linhaNivel("decisivo", c.contagemPorJogo.decisivo);
    out += linhaNivel("rotina", c.contagemPorJogo.rotina);

    out += "\n=== PARTICIPACAO PERCENTUAL NO TOTAL DE ABATES COM PESO ===\n";
    out += `  virada:   ${pct(c.totalPorNivel.virada / total)}  (${c.totalPorNivel.virada}/${total})\n`;
    out += `  decisivo: ${pct(c.totalPorNivel.decisivo / total)}  (${c.totalPorNivel.decisivo}/${total})\n`;
    out += `  rotina:   ${pct(c.totalPorNivel.rotina / total)}  (${c.totalPorNivel.rotina}/${total})\n`;

    out += "\n=== AMOSTRA DE TICKERS REAIS (ate 6 por nivel, ordem de descoberta por seed) ===\n";
    for (const nivel of ["virada", "decisivo", "rotina"] as const) {
      out += `\n  -- ${nivel} --\n`;
      for (const a of c.amostra.filter((x) => x.nivel === nivel)) {
        out += `  seed ${String(a.seed).padStart(3)}: ${a.ticker}\n`;
      }
    }

    console.log(out);
    try {
      mkdirSync("tmp", { recursive: true });
    } catch {
      // ja existe
    }
    writeFileSync("tmp/event-weight.txt", out, "utf-8");
  });
});
