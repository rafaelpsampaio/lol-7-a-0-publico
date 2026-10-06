/**
 * scripts/calibrate-combat.ts
 *
 * Harness de calibracao de combate cedo (Fase 20 / FGT-01..FGT-02).
 * Executar: npm run calibrate:combat  (via vitest, config dedicada)
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = i por partida, nunca seed compartilhada
 *   - Sem Math.random: apenas mulberry32(seed)
 *   - Relatorio pt-BR sem o caractere travessao
 *
 * Percentil (Fase 23 / INST-06): a definicao local foi removida por ser codigo
 * morto (nenhum callsite neste arquivo). O percentil compartilhado do projeto
 * vive em scripts/stats.ts.
 */

import { describe, it, expect } from "vitest";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES } from "../src/sim/matchState";
import type { PlayerVersion, Role } from "../src/data/schema";
import type { SimulationResult } from "../src/sim/engine";

// ---------------------------------------------------------------------------
// Configuracao
// ---------------------------------------------------------------------------

/** Numero de partidas. N=500 garante margem estavel para asserts distribucionais. */
const N = 500;

// ---------------------------------------------------------------------------
// Builders de fixture sintetico flat
// Copiados verbatim de calibrate-objectives.ts:39-61
// Stat uniforme em todos os campos -> neutralidade (INV-1 / INV-2)
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
// Helpers
// Copiados verbatim de calibrate-objectives.ts:68-82
// ---------------------------------------------------------------------------

function pct(num: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((num / total) * 100).toFixed(1)}%`;
}

function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Conjunto canonico de kinds de tick de teamfight (espelho de shutdown.test.ts:60-67).
// Usado tanto no detector do Assert 5 (3-8min) quanto no detector do TKR-01.
// ---------------------------------------------------------------------------

const TEAMFIGHT_KINDS = new Set([
  "comeback_fight",
  "double_kill",
  "triple_kill",
  "quadra_kill",
  "penta_kill",
  "ace",
]);

// Mapeamento de magnitude de multikill (double=2, triple=3, quadra=4, penta=5).
// Usado no contador de casualties do Assert 5.
const MULTIKILL_MAGNITUDE: Record<string, number> = {
  double_kill: 2,
  triple_kill: 3,
  quadra_kill: 4,
  penta_kill: 5,
};

// ---------------------------------------------------------------------------
// Interface de acumulador de metricas de combate (FGT-01..FGT-02 + TKR-01..TKR-03)
// ---------------------------------------------------------------------------

interface CombatStats {
  games: number;

  // Assert 1: quadra_kill ou penta_kill com timeSec < 480 (8min). Deve ser 0.
  quadraPentaBefore8Min: number;

  // Assert 2 (distribucional): triple_kill com timeSec < 480. Deve ser < 5% das lutas early.
  tripleBefore8Min: number;
  totalFightsEarly: number; // lutas com pelo menos 1 evento multikill ou kill com timeSec < 480

  // Assert 3: tick de combate com 3+ mortes (teamfight completa) com timeSec < 180 (3min). Deve ser 0.
  fullTeamfightBefore3Min: number;

  // Assert 4: ace com timeSec < 480 (8min). Deve ser 0.
  aceBefore8Min: number;

  // Assert 5 (distribucional): somatoria de mortes por tick de combate em 3-8min.
  totalCasualtiesIn3to8Min: number;
  totalFightTicksIn3to8Min: number;

  // TKR-01: maximo de shutdowns observados em um unico tick de teamfight (D-08).
  // Um tick de teamfight e identificado pela presenca de qualquer evento em TEAMFIGHT_KINDS
  // no mesmo timeSec. Gate: nenhum tick deve exceder 2 shutdowns destacados.
  maxShutdownsPerTeamfightTick: number;

  // Guard de nao-vacuidade TKR-01: acumula o total de ticks de teamfight detectados
  // (soma de teamfightTickTimes.size por partida). Deve ser > 0 em N=500 partidas.
  detectedTeamfightTicks: number;

  // TKR-02: tickers contextuais com nome real (D-08).
  // Um ticker contextual e identificado por: ticker.includes(":") E _deathQuality != null.
  // "Com nome real" = actors[0] (shortName do killer) esta presente no ticker.
  // Gate: 100% com nome real (contextualTickersWithRealName === contextualTickersTotal).
  contextualTickersTotal: number;
  contextualTickersWithRealName: number;

  // TKR-03: self-kill real acumulado de state.diagnostics[] (invariante fisico).
  // Soma de DiagnosticEntry com tipo "self-kill-ilegal" de todas as partidas.
  // Gate: 0 (invariante fisico -- mesmo molde de quadraPentaBefore8Min).
  selfKillIllegal: number;
}

function emptyStats(): CombatStats {
  return {
    games: 0,
    quadraPentaBefore8Min: 0,
    tripleBefore8Min: 0,
    totalFightsEarly: 0,
    fullTeamfightBefore3Min: 0,
    aceBefore8Min: 0,
    totalCasualtiesIn3to8Min: 0,
    totalFightTicksIn3to8Min: 0,
    maxShutdownsPerTeamfightTick: 0,
    detectedTeamfightTicks: 0,
    contextualTickersTotal: 0,
    contextualTickersWithRealName: 0,
    selfKillIllegal: 0,
  };
}

// ---------------------------------------------------------------------------
// analyse: acumula metricas de uma partida
//
// CRITICO (Armadilha 4): multikill so e emitido por decorateMultikill dentro
// de resolveTeamfight, nunca por resolvePickoff. Filtrar APENAS
// ev.kind in {double_kill, triple_kill, quadra_kill, penta_kill} para multikill.
// Para casualty por tick, agrupar mortes por timeSec de tick de teamfight.
// ---------------------------------------------------------------------------

function analyse(res: SimulationResult, st: CombatStats): void {
  st.games++;

  // Agrupar kills de teamfight por timeSec para calcular casualty por tick
  // e teamfights completas (<3min).
  // Mapa: timeSec -> contagem de mortes no tick
  const killsByTick = new Map<number, number>();

  // Rastrear ticks de lutas early (timeSec < 480) para o denominador de triple rate
  const earlyFightTicks = new Set<number>();

  for (const ev of res.timeline) {
    const t = ev.timeSec;

    // --- Assert 1: quadra_kill ou penta_kill antes de 8min (invariante fisico) ---
    // CRITICO: so filtrar ev.kind in {quadra_kill, penta_kill} -- esses so sao
    // emitidos por decorateMultikill dentro de resolveTeamfight, nunca por pickoff.
    if ((ev.kind === "quadra_kill" || ev.kind === "penta_kill") && t < 480) {
      st.quadraPentaBefore8Min++;
    }

    // --- Assert 2: triple_kill antes de 8min (distribucional) ---
    // Filtrar so ev.kind === "triple_kill" (Armadilha 4).
    if (ev.kind === "triple_kill" && t < 480) {
      st.tripleBefore8Min++;
      earlyFightTicks.add(t);
    }

    // --- Assert 4: ace antes de 8min (invariante fisico) ---
    if (ev.kind === "ace" && t < 480) {
      st.aceBefore8Min++;
    }

    // --- Rastrear kills de teamfight para casualty e teamfight completa ---
    // Os eventos de kill individuais nao tem kind "kill" -- eles sao emitidos como
    // "first_blood", "shutdown", "comeback" etc. Mas os eventos de multikill
    // (double_kill, triple_kill, quadra_kill, penta_kill) indicam ticks de teamfight.
    // Para casualty por tick, precisamos contar mortes diretas.
    // Abordagem: contar eventos kind em {double_kill, triple_kill, quadra_kill, penta_kill}
    // e derivar mortes: double=2, triple=3, quadra=4, penta=5.
    // Para teamfights early sem multikill (1 morte), verificar se ha kill_event no tick.
    // Simplificacao conservadora: usar os eventos de multikill para contagem de mortes
    // em ticks de teamfight. Se o tick so tem 1 morte (pickoff ou trade), nao e
    // contado como teamfight completa.

    // Mapear mortes por tick de luta (usando contagem de mortes dos eventos de multikill)
    if (ev.kind === "double_kill" || ev.kind === "triple_kill" ||
        ev.kind === "quadra_kill" || ev.kind === "penta_kill") {
      // Inferir mortes do killer: double=2, triple=3, quadra=4, penta=5
      const killerDeaths =
        ev.kind === "double_kill" ? 2 :
        ev.kind === "triple_kill" ? 3 :
        ev.kind === "quadra_kill" ? 4 : 5;

      // Adicionar ao mapa de kills por tick (pode haver kills de vencedor tambem)
      // Usar o maximo observado para este tick (uma luta pode ter kills de ambos os lados)
      const prev = killsByTick.get(t) ?? 0;
      if (killerDeaths > prev) {
        killsByTick.set(t, killerDeaths);
      }

      // Rastrear ticks early
      if (t < 480) {
        earlyFightTicks.add(t);
      }
    }
  }

  // --- Assert 3: teamfight completa (3+ mortes) antes de 3min ---
  // Para detectar teamfights completas antes de 3min, precisamos de uma abordagem
  // mais direta: contar ticks com 3+ mortes usando os eventos de multikill
  // (double_kill = pelo menos 2 mortes, triple_kill = pelo menos 3 mortes, etc.)
  // e o total de kills individuais por tick via "first_blood", "shutdown" etc.
  //
  // Abordagem revisada: agrupar TODOS os eventos de kill (pelo timeSec) e contar
  // quantos aconteceram em cada tick. Os eventos de kill em teamfight incluem
  // "first_blood", "shutdown", e kills generico -- mas o kind exato depende do engine.
  //
  // Para simplificar e ser preciso: usar os eventos multikill como proxy.
  // triple_kill no tick t indica pelo menos 3 mortes do lado vencedor.
  // Mas pode haver mortes do lado perdedor (winnerDeaths) que elevam o total.
  //
  // Como o engine clampeia winnerDeaths a Math.floor(cap/2) e cap=2 antes de 3min,
  // winnerDeaths max = 1 antes de 3min. Se triple_kill ocorrer antes de 3min
  // (3 mortes do killer side + ate 1 winner death = 4 total), isso seria
  // teamfight completa. Mas com maxCasualties(<3min)=2, loserDeaths max=2 e
  // winnerDeaths max=1, entao triple_kill antes de 3min so pode ocorrer se
  // maxCasualties for violado.
  //
  // Portanto: triple_kill ou quadra_kill ou penta_kill com t < 180 = teamfight completa <3min.
  // Tambem: se um unico tick tem 3+ mortes total (incluindo winner deaths), e teamfight completa.
  //
  // Para ser conservador e preciso com o engine, usar: any multikill com 3+ mortes
  // (triple_kill, quadra_kill, penta_kill) com t < 180 conta como teamfight completa.

  for (const ev of res.timeline) {
    const t = ev.timeSec;
    if ((ev.kind === "triple_kill" || ev.kind === "quadra_kill" || ev.kind === "penta_kill") && t < 180) {
      st.fullTeamfightBefore3Min++;
    }
  }

  // --- Assert 5: casualty medio por tick de combate em 3-8min ---
  // Agrupa TODOS os eventos de kill em 3-8min (180 <= t < 480) por timeSec e deriva
  // as casualties de cada tick:
  //   - Se o tick tiver um evento de multikill (double_kill, triple_kill, etc.):
  //     usar a magnitude correspondente (double=2, triple=3, quadra=4, penta=5).
  //   - Se o tick tiver apenas kills individuais (kill, first_blood, shutdown, solo_kill):
  //     contar cada evento como 1 casualty. `solo_kill` entrou na Task 8 da linha
  //     calendario-e-volume: desde a Task 4 o all-in de rota emite "solo_kill" no top e
  //     no mid, e sem ele essas mortes ficavam fora da contagem. `gank` segue fora,
  //     como antes (achado registrado no relatorio da Task 8, sem mudanca aqui).
  // Isso inclui tanto ticks de teamfight (double_kill+) quanto ticks de kills
  // simples (pickoffs, ganks convertidos), dando uma distribuicao representativa
  // do modelo de casualties em 3-8min. Ticks sem multikill contribuem 1 casualty,
  // ticks de double_kill contribuem 2, reduzindo a media abaixo de 2 naturalmente.
  //
  // Passo 1: agrupar eventos de kill por timeSec em 3-8min.
  const killsByTick3to8 = new Map<number, number>();
  for (const ev of res.timeline) {
    const t = ev.timeSec;
    if (t < 180 || t >= 480) continue;

    const magnitude = MULTIKILL_MAGNITUDE[ev.kind];
    if (magnitude !== undefined) {
      // Evento de multikill: usar a magnitude como casualties do tick (maximo observado).
      // Um tick pode ter no maximo um evento de multikill (de um unico killer top).
      const prev = killsByTick3to8.get(t) ?? 0;
      if (magnitude > prev) {
        killsByTick3to8.set(t, magnitude);
      }
    } else if (
      ev.kind === "first_blood" ||
      ev.kind === "shutdown" ||
      ev.kind === "kill" ||
      ev.kind === "solo_kill"
    ) {
      // Kill individual: so contar para ticks que nao tenham um evento de multikill.
      // Verificamos depois: se o tick acabou tendo um multikill, a magnitude sobrescreve.
      // Por ora, acumulamos o count de individuais como candidato.
      const prev = killsByTick3to8.get(t) ?? 0;
      // Nao incrementar alem da magnitude minima de multikill (2) para evitar que
      // kills individuais num tick de double_kill superem a magnitude.
      // Como iteramos o timeline em ordem, o evento de multikill pode vir antes ou
      // depois dos individuais. Usamos uma logica de max para garantir consistencia:
      // se prev < 2, ainda pode ser um tick de kills individuais; se prev >= 2, ja
      // foi atribuido pela magnitude de um multikill e nao alteramos.
      if (prev < 2) {
        killsByTick3to8.set(t, prev + 1);
      }
    }
  }

  // Passo 2: acumular total de casualties e ticks rastreados.
  for (const [_t, kills] of killsByTick3to8) {
    st.totalCasualtiesIn3to8Min += kills;
    st.totalFightTicksIn3to8Min++;
  }

  // --- Contagem de lutas early para denominador do Assert 2 ---
  // Uma "luta early" e qualquer teamfight com timeSec < 480.
  // Identificar pela presenca de evento multikill (double_kill+) com timeSec < 480.
  // Os ticks coletados em earlyFightTicks sao os candidatos.
  st.totalFightsEarly += earlyFightTicks.size;

  // =========================================================================
  // TKR-01: maximo de shutdowns por tick de teamfight (D-08)
  // Um tick de teamfight e identificado pela presenca de qualquer evento em
  // TEAMFIGHT_KINDS no mesmo timeSec (espelha shutdown.test.ts:60-67).
  // Contar shutdowns por esses ticks e registrar o maximo observado.
  // =========================================================================

  // Passo 1: identificar timeSecs de ticks de teamfight usando o conjunto canonico
  // TEAMFIGHT_KINDS = {comeback_fight, double_kill, triple_kill, quadra_kill, penta_kill, ace}.
  // Antes so usava comeback_fight, que e inatingivel no engine normal -- correcao BL-01.
  const teamfightTickTimes = new Set<number>();
  for (const ev of res.timeline) {
    if (TEAMFIGHT_KINDS.has(ev.kind)) {
      teamfightTickTimes.add(ev.timeSec);
    }
  }
  // Acumular total de ticks de teamfight detectados (guard de nao-vacuidade TKR-01).
  st.detectedTeamfightTicks += teamfightTickTimes.size;

  // Passo 2: contar shutdowns por tick de teamfight.
  const shutdownsByTeamfightTick = new Map<number, number>();
  for (const ev of res.timeline) {
    if (ev.kind === "shutdown" && teamfightTickTimes.has(ev.timeSec)) {
      shutdownsByTeamfightTick.set(ev.timeSec, (shutdownsByTeamfightTick.get(ev.timeSec) ?? 0) + 1);
    }
  }

  // Passo 3: registrar o maximo observado nesta partida.
  for (const count of shutdownsByTeamfightTick.values()) {
    if (count > st.maxShutdownsPerTeamfightTick) {
      st.maxShutdownsPerTeamfightTick = count;
    }
  }

  // =========================================================================
  // TKR-02: tickers contextuais com nome real (D-08)
  // Criterio observavel: ev.ticker.includes(":") E ev._deathQuality != null.
  // Todos os tickers de selectContextualTicker tem o formato "${nome}: texto..."
  // (colon separador) e nao contem colon. Os tickers genericos de makeKillEvent
  // (first_blood/shutdown/gank/solo_kill/kill) NAO conteem colon.
  // "Com nome real" = actors[0] (shortName do protagonista) aparece no ticker
  // antes do colon (garantido por contextualTickerMustIncludePlayerName).
  // =========================================================================

  for (const ev of res.timeline) {
    // Identificar ticker contextual: presenca de _deathQuality (kill event via applyKill)
    // E ticker contendo colon (formato contextual "${nome}: texto").
    if (ev._deathQuality != null && ev.ticker.includes(":")) {
      st.contextualTickersTotal++;
      // Verificar que um nome real de protagonista aparece antes do colon no ticker.
      // O protagonista pode ser o killer (actors[0]) OU a vitima (victims[0]),
      // dependendo do tipo contextual (D-05: alguns sao killer-centric, outros victim-centric).
      // "Com nome real" = actors[0] OU victims[0] aparece no inicio do ticker.
      // contextualTickerMustIncludePlayerName garante que o ticker comeca com nome real.
      const killerName = ev.actors[0] ?? "";
      const victimName = ev.victims[0] ?? "";
      const tickerBeforeColon = ev.ticker.split(":")[0] ?? "";
      const hasRealName =
        (killerName.length > 0 && tickerBeforeColon === killerName) ||
        (victimName.length > 0 && tickerBeforeColon === victimName);
      if (hasRealName) {
        st.contextualTickersWithRealName++;
      }
    }
  }

  // =========================================================================
  // TKR-03: self-kill real acumulado de state.diagnostics[] (D-08)
  // Ler finalState.diagnostics e somar entradas com tipo "self-kill-ilegal".
  // Invariante fisico: deve ser 0 em todas as partidas.
  // =========================================================================

  const diagnostics = res.finalState.diagnostics ?? [];
  for (const entry of diagnostics) {
    if (entry.tipo === "self-kill-ilegal") {
      st.selfKillIllegal++;
    }
  }
}

// ---------------------------------------------------------------------------
// runCombat: loop deterministico seed=i + relatorio pt-BR
// ---------------------------------------------------------------------------

function runCombat(
  name: string,
  us: number,
  rs: number,
  n = N
): { st: CombatStats; report: string } {
  const st = emptyStats();

  for (let seed = 0; seed < n; seed++) {
    // INVARIANTE: seed = i por partida, nunca seed compartilhada; sem Math.random
    const res = simulateMatch(roster("u", us), roster("r", rs), mulberry32(seed));
    analyse(res, st);
  }

  const tripleEarlyRate = st.tripleBefore8Min / Math.max(1, st.totalFightsEarly);
  const avgCasualties = st.totalCasualtiesIn3to8Min / Math.max(1, st.totalFightTicksIn3to8Min);

  let report = `\n=== COMBATE ${name} (user ${us} vs rival ${rs}, ${n} jogos) ===\n`;

  report += `\n  -- FGT-01: Multikill cedo --\n`;
  report += `  Lutas early (<8min) com multikill:  ${st.totalFightsEarly}\n`;
  report += `  Triple kill <8min:                  ${st.tripleBefore8Min} (${(tripleEarlyRate * 100).toFixed(2)}% das lutas early) [gate: <5%]\n`;
  report += `  Quadra/Penta kill <8min (ilegal):   ${st.quadraPentaBefore8Min} [gate: 0]\n`;

  report += `\n  -- FGT-01 criterio 5: Ace cedo --\n`;
  report += `  Ace <8min (ilegal):                 ${st.aceBefore8Min} [gate: 0]\n`;

  report += `\n  -- FGT-02: Casualty model cedo --\n`;
  report += `  Teamfight completa <3min (ilegal):  ${st.fullTeamfightBefore3Min} [gate: 0]\n`;
  report += `  Ticks de luta 3-8min rastreados:    ${st.totalFightTicksIn3to8Min}\n`;
  report += `  Total de baixas em ticks 3-8min:    ${st.totalCasualtiesIn3to8Min}\n`;
  report += `  Casualty medio por tick 3-8min:     ${avgCasualties.toFixed(3)} [gate: <2]\n`;

  report += `\n  [NOTA: asserts 1, 3 e 4 sao invariantes fisicos (zero absoluto)]\n`;
  report += `  [NOTA: asserts 2 e 5 sao distribucionais]\n`;

  const ctxNomeRate = st.contextualTickersWithRealName / Math.max(1, st.contextualTickersTotal);

  report += `\n  -- TKR-01: Shutdown spam por tick de teamfight --\n`;
  report += `  Ticks de teamfight detectados (TKR-01): ${st.detectedTeamfightTicks} [guard: >0]\n`;
  report += `  Max shutdowns em um tick de teamfight:  ${st.maxShutdownsPerTeamfightTick} [gate: <=2]\n`;

  report += `\n  -- TKR-02: Tickers contextuais com nome real --\n`;
  report += `  Tickers contextuais total:              ${st.contextualTickersTotal}\n`;
  report += `  Tickers contextuais com nome real:      ${st.contextualTickersWithRealName} (${(ctxNomeRate * 100).toFixed(1)}%) [gate: 100%]\n`;

  report += `\n  -- TKR-03: Self-kill real --\n`;
  report += `  Self-kill real (tipo ilegal):           ${st.selfKillIllegal} [gate: 0]\n`;

  return { st, report };
}

// ---------------------------------------------------------------------------
// Harness principal: 5 asserts duros (FGT-01..FGT-02) + 3 asserts TKR
//
// CORRESPONDENCIA CRITERIOS DE ACEITE (ENGINE-HARDENING-SPEC.md 77-91) x ASSERTS
// -------------------------------------------------------------------------------
// Criterio 8  (quadra/penta <1:30 nunca aparece):
//   -> Assert 1 (quadraPentaBefore8Min == 0): cobre toda a janela <8min (portanto <1:30).
//      Reforco: seed-ancora seed=36 verificado explicitamente no assert combinado.
//
// Criterio 9  (multikill respeita fase do jogo):
//   -> Assert 2 (triple <8min < 5% das lutas early)       [distribucional]
//   -> Assert 3 (teamfight completa <3min == 0)            [invariante fisico]
//   -> Assert 4 (ace <8min == 0)                           [invariante fisico]
//   -> Assert 5 (casualty medio 3-8min < 2)               [distribucional]
//
// Criterio 10 (shutdown nao spamma no mesmo tick de teamfight):
//   -> Assert TKR-01 (maxShutdownsPerTeamfightTick <= 2)
//
// Criterio 11 (ticker contextual usa nome real - 100% no harness):
//   -> Assert TKR-02 (contextualTickersWithRealName == contextualTickersTotal)
//   -> Fixture forjada: src/sim/deathQuality.test.ts
//      describe "selectContextualTicker com nome real (TKR-02)":
//        - gate contextualTickerMustIncludePlayerName retorna null sem displayName (fallback)
//        - gate retorna o ticker quando displayName esta presente
//        - tickers contem nome real do protagonista (Faker, Gumayusi, Ruler, Zeus)
//
// Criterio 12 (self-kill/duplicidade Gumayusi-vs-Gumayusi diagnosticado):
//   -> Assert TKR-03 (selfKillIllegal == 0 lido de state.diagnostics[])
//   -> Fixture forjada: src/sim/diagnostics.test.ts
//      describe "TKR-03 / D-06 -- duplicidade entre lados":
//        - mesmo personId em times opostos gera 'duplicidade-roster' em state.diagnostics[]
//      describe "TKR-03 / D-06 -- self-kill real por cardId identico":
//        - mesmo cardId gera 'self-kill-ilegal' em state.diagnostics[]
//
// Nota: os criterios 1-7 sao cobertos por calibrate-structures.ts e calibrate-objectives.ts.
// Nota: o criterio 13 (ENGINE-MANUAL atualizado) e verificado pela entrega de docs (Plano 04).
// ---------------------------------------------------------------------------

describe("calibrate-combat -- asserts duros FGT-01..FGT-02", () => {
  it("roda N=500 partidas deterministicas e verifica os 5 criterios de aceite", () => {
    // Cenario equilibrado (neutralidade estatistica INV-1/INV-2)
    const eq = runCombat("EQUILIBRADO", 70, 70, N);
    // Cenario de STOMP (stat alto vs baixo): forcca lutas com ratio alto e
    // maximas baixas esperadas -- revelador da seed-ancora seed=36 (ENGINE-DIAGNOSIS.md).
    const stomp = runCombat("STOMP", 85, 55, N);

    // Acumular stats de ambos os cenarios para os asserts combinados
    const st: CombatStats = {
      games: eq.st.games + stomp.st.games,
      quadraPentaBefore8Min: eq.st.quadraPentaBefore8Min + stomp.st.quadraPentaBefore8Min,
      tripleBefore8Min: eq.st.tripleBefore8Min + stomp.st.tripleBefore8Min,
      totalFightsEarly: eq.st.totalFightsEarly + stomp.st.totalFightsEarly,
      fullTeamfightBefore3Min: eq.st.fullTeamfightBefore3Min + stomp.st.fullTeamfightBefore3Min,
      aceBefore8Min: eq.st.aceBefore8Min + stomp.st.aceBefore8Min,
      totalCasualtiesIn3to8Min: eq.st.totalCasualtiesIn3to8Min + stomp.st.totalCasualtiesIn3to8Min,
      totalFightTicksIn3to8Min: eq.st.totalFightTicksIn3to8Min + stomp.st.totalFightTicksIn3to8Min,
      // TKR-01: maximo global (nao soma -- e um maximo distribuicional)
      maxShutdownsPerTeamfightTick: Math.max(
        eq.st.maxShutdownsPerTeamfightTick,
        stomp.st.maxShutdownsPerTeamfightTick
      ),
      // TKR-01 guard de nao-vacuidade: soma os dois cenarios
      detectedTeamfightTicks: eq.st.detectedTeamfightTicks + stomp.st.detectedTeamfightTicks,
      // TKR-02: soma dos dois cenarios
      contextualTickersTotal: eq.st.contextualTickersTotal + stomp.st.contextualTickersTotal,
      contextualTickersWithRealName: eq.st.contextualTickersWithRealName + stomp.st.contextualTickersWithRealName,
      // TKR-03: soma dos dois cenarios
      selfKillIllegal: eq.st.selfKillIllegal + stomp.st.selfKillIllegal,
    };

    // Logar os relatorios para diagnostico (visivel no output do vitest)
    console.log(eq.report);
    console.log(stomp.report);

    // Verificacao seed-ancora seed=36 (ENGINE-DIAGNOSIS.md: quadra_kill t=210s em STOMP 85v55)
    const anchor36 = simulateMatch(roster("u", 85), roster("r", 55), mulberry32(36));
    const anchor36QuadraPenta = anchor36.timeline.filter(
      (ev) => (ev.kind === "quadra_kill" || ev.kind === "penta_kill") && ev.timeSec < 480
    ).length;
    console.log(`\n  [seed-ancora 36]: quadra/penta <8min = ${anchor36QuadraPenta} (esperado: 0)`);

    // --- Assert 1: quadra_kill e penta_kill <8min = 0 (invariante fisico) ---
    // maxCasualties(<8min) <= 3 e multikillTimePlausibility(<8min) <= 3
    // -> topN nunca atinge 4 ou 5 -> decorateMultikill nunca emite quadra/penta
    expect(
      st.quadraPentaBefore8Min,
      "quadra/penta <8min (ilegal): deve ser 0 em todas as partidas"
    ).toBe(0);

    // --- Assert 2: triple_kill <8min < 5% das lutas early (distribucional) ---
    // triple_kill <8min pode ocorrer so em stomp: triple loser side com maxCasualties=3.
    // O assert verifica que e raro mesmo em stomp.
    const tripleBefore8MinRate = st.tripleBefore8Min / Math.max(1, st.totalFightsEarly);
    expect(
      tripleBefore8MinRate,
      `triple <8min (${(tripleBefore8MinRate * 100).toFixed(2)}% das lutas early): deve ser < 5%`
    ).toBeLessThan(0.05);

    // --- Assert 3: teamfight completa (3+ mortes/tick) <3min = 0 (invariante fisico) ---
    // maxCasualties(<3min) = 2 -> loserDeaths max=2, winnerDeaths max=1
    // -> triple_kill (3+ mortes do killer) impossivel antes de 3min
    expect(
      st.fullTeamfightBefore3Min,
      "teamfight completa (3+ mortes) <3min (ilegal): deve ser 0"
    ).toBe(0);

    // --- Assert 4: ace <8min = 0 (invariante fisico) ---
    // Gate ACE_MIN_SEC=480 em engine.ts suprime makeAceEvent antes de 8min
    expect(
      st.aceBefore8Min,
      "ace <8min (ilegal): deve ser 0"
    ).toBe(0);

    // --- Assert 5: casualty medio por tick de combate em 3-8min < 2 (distribucional) ---
    // maxCasualties(3-8min) = 3 -> loserDeaths max=3 -> com winnerDeaths=0 ou 1,
    // media por tick e tipicamente ~1.5-1.8 (abaixo de 2)
    const avgCasualties = st.totalCasualtiesIn3to8Min / Math.max(1, st.totalFightTicksIn3to8Min);
    // Guard de nao-vacuidade (BL-02): garante que o assert nao passe trivialmente sobre soma zero.
    expect(
      st.totalCasualtiesIn3to8Min,
      `Assert 5 guard nao-vacuidade: totalCasualtiesIn3to8Min (${st.totalCasualtiesIn3to8Min}) deve ser > 0`
    ).toBeGreaterThan(0);
    expect(
      avgCasualties,
      `casualty medio 3-8min (${avgCasualties.toFixed(3)}): deve ser < 2`
    ).toBeLessThan(2);

    // =========================================================================
    // Asserts duros TKR-01 / TKR-02 / TKR-03 (D-08)
    // =========================================================================

    // --- Assert TKR-01: maximo de shutdowns por tick de teamfight <= 2 (distribucional) ---
    // D-01 em engine.ts limita shutdownsHighlighted a 2 por tick; este assert
    // valida a invariante em N=500 partidas x 2 cenarios de forma distribucional.
    // Guard de nao-vacuidade (BL-01): garante que o detector encontrou ticks reais antes
    // de assertar o maximo -- evita que o assert passe trivialmente sobre um Set vazio.
    expect(
      st.detectedTeamfightTicks,
      `TKR-01 guard nao-vacuidade: detectedTeamfightTicks (${st.detectedTeamfightTicks}) deve ser > 0`
    ).toBeGreaterThan(0);
    expect(
      st.maxShutdownsPerTeamfightTick,
      `TKR-01: max shutdowns/tick teamfight (${st.maxShutdownsPerTeamfightTick}): deve ser <= 2`
    ).toBeLessThanOrEqual(2);

    // --- Assert TKR-02: 100% dos tickers contextuais tem nome real (invariante de CAL-02) ---
    // contextualTickerMustIncludePlayerName em deathQuality.ts garante que nenhum
    // ticker contextual passa sem o protagonista prefixado (D-04).
    // Se contextualTickersTotal === 0 (sem contextuais nestes cenarios), o assert
    // e trivialmente satisfeito (denominador protegido por Math.max(1, total)).
    const ctxNomeRateFinal = st.contextualTickersWithRealName / Math.max(1, st.contextualTickersTotal);
    expect(
      st.contextualTickersWithRealName,
      `TKR-02: ${st.contextualTickersWithRealName}/${st.contextualTickersTotal} tickers contextuais com nome real (${(ctxNomeRateFinal * 100).toFixed(1)}%): deve ser 100%`
    ).toBe(st.contextualTickersTotal);

    // --- Assert TKR-03: 0 self-kill real em todas as partidas (invariante fisico) ---
    // Guard em engine.ts (D-06) suprime e loga em state.diagnostics[];
    // este assert le o campo e exige zero absoluto.
    expect(
      st.selfKillIllegal,
      "TKR-03: self-kill real (ilegal): deve ser 0 em todas as partidas"
    ).toBe(0);
  });
});
