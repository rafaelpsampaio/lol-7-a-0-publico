/**
 * scripts/calibrate-engine.ts
 *
 * Calibration harness for the STATE-DRIVEN engine (Phase 8).
 * Run: npm run calibrate  (executed via the vitest calibrate config)
 *
 * Runs many deterministic matches per matchup tier and prints win rates,
 * stomp / comeback / balanced distribution, average duration & event counts,
 * objective-reach rates, and negative-rule violations. Writes a full report to
 * tmp/calibration.txt for inspection and asserts the headline bands so a
 * miscalibrated engine fails the run.
 */

import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES } from "../src/sim/matchState";
import { checkBand, expectBands } from "./bands";
import type { Band } from "./bands";
import type { PlayerVersion, Role } from "../src/data/schema";
import type { SimulationResult } from "../src/sim/engine";

// FRC-01 exige N >= 500 por ponto-ancora; N = 600 da sigma binomial 0,0204 em
// p = 0,5, o que sustenta a banda de 3 sigma do gap 0 declarada no Bloco 3 de
// docs/diagnostics/28-ancoragem.md. Custo declarado: 6 tiers x 600 = 3600
// partidas de motor completo por rodada, contra 900 antes (3 tiers x 300).
const N = 600;

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
// Tiers-ancora (Fase 28 / FRC-01..04): mesmo formato de scripts/calibrate-pace.ts:143-150
// (array de objetos com name, us, rs, gap anotado). Fixtures copiados do Bloco 3 de
// docs/diagnostics/28-ancoragem.md. O campo `gap` e explicito para que o relatorio
// e as bandas nao rededuzam `us - rs`.
// ---------------------------------------------------------------------------

interface AnchorTier {
  name: string;
  us: number;
  rs: number;
  gap: number;
}

const ANCHOR_TIERS: AnchorTier[] = [
  { name: "ANCORA-00", us: 75, rs: 75, gap: 0 },
  { name: "ANCORA-05", us: 78, rs: 73, gap: 5 },
  { name: "ANCORA-10", us: 80, rs: 70, gap: 10 },
  { name: "ANCORA-20", us: 85, rs: 65, gap: 20 },
  { name: "ANCORA-30", us: 90, rs: 60, gap: 30 },
  { name: "ANCORA-40", us: 95, rs: 55, gap: 40 },
];

// -----------------------------------------------------------------------------
// Fase 28 (plano 28-01, Task 3): estas 8 bandas de dois lados SUBSTITUEM o
// defeito que o criterio 1 do ROADMAP.md nomeia com todas as letras: "Um
// assert unico em gap 30 permitiria achatar tudo, e e o que existe hoje". O
// assert em questao era, neste mesmo arquivo (antes desta task),
// `expect(dom.userWins / N).toBeLessThan(0.99)`, vermelho hoje com dono
// declarado Fase 28 segundo scripts/calibrate-all.mjs.
//
// Por que um assert de um lado so e vazio aqui: um TETO sem PISO e satisfeito
// por qualquer achatamento, inclusive o total. Zerar a inclinacao inteira
// (win-rate sempre 50% em qualquer gap) passaria num assert so-de-teto sem
// nunca ser pego, e achatar demais e o pior desfecho possivel da milestone
// (criterio 3 do ROADMAP.md: se o rating quase nao importa, o draft nao
// importa, e o draft e o loop central do jogo). Por isso toda comparacao de
// win-rate passa a ter os dois lados, via checkBand (scripts/bands.ts).
// -----------------------------------------------------------------------------

/** As 6 bandas-ancora, pisos e tetos exatos do Bloco 3 de docs/diagnostics/28-ancoragem.md.
 *  Nenhuma e provisoria: todas sao imagem do bracket derivado D em [24; 49], nao numero solto.
 *  Desde a Task 9 de luta-mapa-vitoria so a ANCORA-00 segue no assert; as outras cinco ficam
 *  so no relatorio (ver ANCORAS_APOSENTADAS_TASK9). */
const ANCHOR_BANDS: Record<string, Band> = {
  "ANCORA-00": {
    floor: 0.44,
    ceiling: 0.56,
    target: 0.5,
    source: "docs/diagnostics/28-ancoragem.md Bloco 3",
    owner: "Fase 28",
  },
  "ANCORA-05": {
    floor: 0.52,
    ceiling: 0.66,
    target: 0.5803,
    source: "docs/diagnostics/28-ancoragem.md Bloco 3",
    owner: "Fase 28",
  },
  "ANCORA-10": {
    floor: 0.58,
    ceiling: 0.76,
    target: 0.6566,
    source: "docs/diagnostics/28-ancoragem.md Bloco 3",
    owner: "Fase 28",
  },
  "ANCORA-20": {
    floor: 0.69,
    ceiling: 0.9,
    target: 0.7853,
    source: "docs/diagnostics/28-ancoragem.md Bloco 3",
    owner: "Fase 28",
  },
  "ANCORA-30": {
    floor: 0.8,
    ceiling: 0.97,
    target: 0.875,
    source:
      "docs/diagnostics/28-ancoragem.md Bloco 3; teto 0,97 tambem em " +
      "docs/references/ritmo.md secao 7",
    owner: "Fase 28",
  },
  "ANCORA-40": {
    floor: 0.85,
    ceiling: 0.97,
    target: 0.9305,
    source:
      "docs/diagnostics/28-ancoragem.md Bloco 3; teto 0,97 tambem em " +
      "docs/references/ritmo.md secao 7",
    owner: "Fase 28",
  },
};

/** As 2 bandas de sensibilidade (FRC-03), pisos e tetos exatos do Bloco 4 de
 *  docs/diagnostics/28-ancoragem.md, derivados do MESMO bracket [24; 49]. */
const SENSITIVITY_BANDS: Record<string, Band> = {
  "sensibilidade gap 10 contra gap 0": {
    floor: 0.11,
    ceiling: 0.27,
    source: "docs/diagnostics/28-ancoragem.md Bloco 4; criterio 3 do ROADMAP.md",
    owner: "Fase 28",
  },
  "sensibilidade gap 20 contra gap 5": {
    floor: 0.16,
    ceiling: 0.29,
    source: "docs/diagnostics/28-ancoragem.md Bloco 4; criterio 3 do ROADMAP.md",
    owner: "Fase 28",
  },
};

// -----------------------------------------------------------------------------
// Task 9 da linha luta-mapa-vitoria: bandas da Fase 28 APOSENTADAS do assert.
//
// A curva de rating da Fase 28 (bracket D em [24; 49], docs/diagnostics/28-ancoragem.md)
// foi substituida pela regua nova da spec 2026-10-02 ("Medicao e aceite": favorito
// com gap de elenco >= 5 vence 75% a 85%, gap < 1 vence 45% a 55%), fechada na Task 8
// com DEFAULT_SIM_CONFIG.ratingPowerD = 140 e asserida em npm run calibrate:realism.
// As bandas abaixo sao de engenharia e contradizem a regua nova: o ANCORA-05 pede 52%
// a 66% num gap 5, onde a regua nova pede 75% a 85%. Medem o modelo antigo. Seguem
// calculadas e impressas na tabela; so saem do assert.
//
// ANCORA-30 e ANCORA-40 tem motivo proprio (ruling do controlador na revisao da Task 9):
// a decisao do dono do produto "favorito claro vence ~75-85%, nunca 100%" vale para
// favorito de LIGA (gap de elenco real, ate ~10 pontos); 90 x 60 e 95 x 55 sao gaps
// sinteticos (pro contra amador), fora dessa decisao. Ja eram 1,000 em 1e55c7b. A
// decisao segue guardada pelo teto 0,85 de "favorito com gap >= 5 vence" em
// npm run calibrate:realism.
//
// A sensibilidade gap 20 contra gap 5 sai pelo mesmo bracket da Fase 28: com o gap 20
// saturado (0,998), ela vira na pratica uma banda de [0,708; 0,838] sobre o gap 5, que
// pode contradizer os 75% a 85% da regua nova.
// Antes (1e55c7b) e depois de cada uma em docs/diagnostics/luta-mapa-vitoria-bandas.md.
//
// Ficam no assert: ANCORA-00 (gap 0, coerente com a regua nova de gap < 1),
// a ordenacao nao-decrescente e as regras duras.
// -----------------------------------------------------------------------------
const ANCORAS_APOSENTADAS_TASK9 = new Set(["ANCORA-05", "ANCORA-10", "ANCORA-20", "ANCORA-30", "ANCORA-40"]);
const SENSIBILIDADES_APOSENTADAS_TASK9 = new Set([
  "sensibilidade gap 10 contra gap 0",
  "sensibilidade gap 20 contra gap 5",
]);

interface Stats {
  userWins: number;
  stomps: number;
  comebacks: number;
  balanced: number;
  totalEvents: number;
  totalDurationSec: number;
  reachedBaron: number;
  reachedSoul: number;
  reachedElder: number;
  baronBefore20: number;
  elderBeforeSoul: number;
  stealWithoutContest: number;
  atakhan: number;
}

function analyse(res: SimulationResult, st: Stats): void {
  if (res.winner === "user") st.userWins++;
  st.totalEvents += res.timeline.length;
  st.totalDurationSec += res.durationSec;

  let soulSeen = false;
  let sawBaron = false;
  let sawElder = false;
  // Track the winner's lowest win probability (in winner frame) to spot comebacks.
  let winnerMin = 1;
  for (const ev of res.timeline) {
    const winnerProb = res.winner === "user" ? ev.winProbUserAfter : 1 - ev.winProbUserAfter;
    winnerMin = Math.min(winnerMin, winnerProb);

    if (ev.ticker.toLowerCase().includes("atakhan")) st.atakhan++;
    if (ev.ticker.includes("Alma")) soulSeen = true;

    if (ev.kind === "baron_taken" || ev.kind === "baron_steal" || ev.kind === "baron_fight") {
      sawBaron = true;
      if (ev.timeSec < 1200) st.baronBefore20++;
    }
    if (ev.kind === "elder_taken" || ev.kind === "elder_steal" || ev.kind === "elder_fight") {
      sawElder = true;
      if (!soulSeen) st.elderBeforeSoul++;
    }
    if (ev.stolen && !ev.contested) st.stealWithoutContest++;
  }
  if (sawBaron) st.reachedBaron++;
  if (soulSeen) st.reachedSoul++;
  if (sawElder) st.reachedElder++;

  // Stomp = winner basically never trailed (dipped no lower than ~0.42 despite
  // the early coin-flip). Comeback = winner was clearly losing (<0.32) at some
  // point. Else a balanced, swingy game.
  if (winnerMin >= 0.42) st.stomps++;
  else if (winnerMin < 0.32) st.comebacks++;
  else st.balanced++;
}

function emptyStats(): Stats {
  return {
    userWins: 0, stomps: 0, comebacks: 0, balanced: 0,
    totalEvents: 0, totalDurationSec: 0,
    reachedBaron: 0, reachedSoul: 0, reachedElder: 0,
    baronBefore20: 0, elderBeforeSoul: 0, stealWithoutContest: 0, atakhan: 0,
  };
}

function runTier(name: string, us: number, rs: number): { name: string; st: Stats; report: string } {
  const st = emptyStats();
  for (let seed = 0; seed < N; seed++) {
    const res = simulateMatch(roster("u", us), roster("r", rs), mulberry32(seed));
    analyse(res, st);
  }
  const pct = (n: number) => `${((n / N) * 100).toFixed(0)}%`;
  const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
  const report =
    `\n=== TIER ${name} (user ${us} vs rival ${rs}, ${N} jogos) ===\n` +
    `  user winrate:   ${pct(st.userWins)}\n` +
    `  stomp/equil/comeback: ${pct(st.stomps)} / ${pct(st.balanced)} / ${pct(st.comebacks)}\n` +
    `  duração média:  ${mmss(st.totalDurationSec / N)}\n` +
    `  eventos médios: ${(st.totalEvents / N).toFixed(1)}\n` +
    `  chegou a Baron/Alma/Elder: ${pct(st.reachedBaron)} / ${pct(st.reachedSoul)} / ${pct(st.reachedElder)}\n` +
    `  VIOLAÇÕES → baron<20:00=${st.baronBefore20} elder-sem-alma=${st.elderBeforeSoul} roubo-sem-contest=${st.stealWithoutContest} atakhan=${st.atakhan}\n`;
  return { name, st, report };
}

describe("calibrate-engine — state-driven distributions", () => {
  it("prints and asserts the headline bands", () => {
    const tiers = ANCHOR_TIERS.map((t) => runTier(t.name, t.us, t.rs));
    const statsByName = new Map(tiers.map((t) => [t.name, t.st]));

    let out = "RELATORIO DE CALIBRACAO - engine state-driven\n";
    for (const t of tiers) out += t.report;

    // -------------------------------------------------------------------------
    // Tabela dos 6 pontos-ancora (Fase 28 / FRC-01..04). ANCHOR_BANDS e a UNICA
    // fonte de alvo/piso/teto, tanto para esta tabela impressa quanto para os
    // asserts de dois lados abaixo (checkBand/expectBands), para que relatorio
    // e assert nunca divirjam. Fonte original: docs/diagnostics/28-ancoragem.md
    // Bloco 3.
    // -------------------------------------------------------------------------
    out += "\n=== TABELA DE 6 PONTOS-ANCORA (Fase 28 / FRC-01..04) ===\n";
    out += "  gap | fixture | win-rate medida | alvo | piso | teto | marca\n";
    for (const t of ANCHOR_TIERS) {
      const st = statsByName.get(t.name)!;
      const wr = st.userWins / N;
      const ref = ANCHOR_BANDS[t.name];
      const dentro = wr >= ref.floor && wr <= ref.ceiling ? "DENTRO" : "FORA";
      const mark = ANCORAS_APOSENTADAS_TASK9.has(t.name) ? `${dentro} (APOSENTADA Task 9, sem assert)` : dentro;
      out +=
        `  ${String(t.gap).padStart(3)} | ${t.us} x ${t.rs} | ${wr.toFixed(4)} | ` +
        `${ref.target!.toFixed(4)} | ${ref.floor.toFixed(2)} | ${ref.ceiling.toFixed(2)} | ${mark}\n`;
    }

    const winRateOf = (name: string) => statsByName.get(name)!.userWins / N;
    const sens10menos0 = winRateOf("ANCORA-10") - winRateOf("ANCORA-00");
    const sens20menos5 = winRateOf("ANCORA-20") - winRateOf("ANCORA-05");
    out += "\n=== SENSIBILIDADE (FRC-03), observada nesta task ===\n";
    out += `  gap10 menos gap0: ${sens10menos0.toFixed(4)} (piso declarado 0,11 teto declarado 0,27; APOSENTADA Task 9, sem assert)\n`;
    out += `  gap20 menos gap5: ${sens20menos5.toFixed(4)} (piso declarado 0,16 teto declarado 0,29; APOSENTADA Task 9, sem assert)\n`;

    try { mkdirSync("tmp", { recursive: true }); } catch { /* exists */ }
    writeFileSync("tmp/calibration.txt", out);

    const anc00 = statsByName.get("ANCORA-00")!;
    const anc10 = statsByName.get("ANCORA-10")!;
    const anc30 = statsByName.get("ANCORA-30")!;

    // Negative rules: hard zero across ALL 6 anchor tiers.
    for (const st of statsByName.values()) {
      expect(st.baronBefore20).toBe(0);
      expect(st.elderBeforeSoul).toBe(0);
      expect(st.stealWithoutContest).toBe(0);
      expect(st.atakhan).toBe(0);
    }

    // The match texture exists: stomps (in ANCORA-30), balanced games AND
    // comebacks (ANCORA-00 + ANCORA-10) all occur.
    expect(anc30.stomps).toBeGreaterThan(0);
    expect(anc00.balanced).toBeGreaterThan(0);
    expect(anc00.comebacks + anc10.comebacks).toBeGreaterThan(0);

    // -------------------------------------------------------------------------
    // ASSERTS DE BANDA DE DOIS LADOS (Fase 28 / FRC-01..04): substituem os
    // cinco asserts de um lado so que existiam ate a Task 2 desta fase. Uma
    // unica chamada a expectBands agrega as bandas (eram 8: 6 ancoras + 2 de
    // sensibilidade; desde a Task 9 de luta-mapa-vitoria resta 1: ANCORA-00),
    // para que uma rodada vermelha mostre TODAS as violacoes de uma vez, cada
    // uma com a fase dona ao lado.
    // -------------------------------------------------------------------------
    // Task 9: as ancoras e as duas sensibilidades aposentadas (ver
    // ANCORAS_APOSENTADAS_TASK9) saem desta lista; o resto segue identico.
    const bandResults = [
      ...ANCHOR_TIERS.filter((t) => !ANCORAS_APOSENTADAS_TASK9.has(t.name)).map((t) =>
        checkBand(
          `win-rate ${t.name} (gap ${t.gap})`,
          statsByName.get(t.name)!.userWins / N,
          ANCHOR_BANDS[t.name]
        )
      ),
      ...[
        { label: "sensibilidade gap 10 contra gap 0", value: sens10menos0 },
        { label: "sensibilidade gap 20 contra gap 5", value: sens20menos5 },
      ]
        .filter((s) => !SENSIBILIDADES_APOSENTADAS_TASK9.has(s.label))
        .map((s) => checkBand(s.label, s.value, SENSITIVITY_BANDS[s.label])),
    ];
    expectBands(bandResults);

    // -------------------------------------------------------------------------
    // ASSERT DE ORDENACAO, nao de magnitude, no mesmo espirito de R4 em
    // scripts/calibrate-pace.ts:2894-2902: a sequencia de win-rate nas 6
    // ancoras, na ordem gap 0, 5, 10, 20, 30, 40, tem de ser nao-decrescente.
    // Nenhum numero e inventado, so a ordem e verificada. Roda DEPOIS de
    // expectBands, seguindo o padrao do arquivo irmao.
    // -------------------------------------------------------------------------
    const gapSequence = ANCHOR_TIERS.map((t) => statsByName.get(t.name)!.userWins / N);
    const gapSequenceSorted = [...gapSequence].sort((a, b) => a - b);
    expect(
      gapSequence,
      `sequencia de win-rate por gap (ANCORA-00 -> ANCORA-05 -> ANCORA-10 -> ` +
        `ANCORA-20 -> ANCORA-30 -> ANCORA-40) deve ser nao-decrescente: ` +
        `[${gapSequence.map((v) => v.toFixed(3)).join(", ")}]`
    ).toEqual(gapSequenceSorted);
  });
});
