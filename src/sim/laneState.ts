/**
 * src/sim/laneState.ts
 *
 * Módulo puro de lane state persistente (LANE-01/02/03/04).
 *
 * Design:
 *  - Toda a camada é rng-free (DET-02). Nunca chama rng() nem Math.random.
 *  - Funções puras: dado o mesmo input, retorna sempre o mesmo output.
 *  - decayLaneState é chamada UMA vez por tick no step 2, ANTES de recomputePressure.
 *  - updateLaneState é chamada nos hooks de evento (applyKill, damageStructure,
 *    resolvePickoff) APÓS o rng() do evento já ter sido consumido.
 *  - computeStrongsideScore lê laneState + metricsBase (camada 1+2 frozen).
 *    Não chama contextMetrics() — evita Pitfall 5 (cache de role não-jungle).
 *    Usa state.pressure como proxy de junglerAttention.
 *  - Contrato de identidade (INV-1): em lane simétrica (sem eventos), laneLead == 0.
 *
 * Constantes calibradas no Plano 04 e re-ancoradas na economia FLAT
 * (kill=400 total, first turret +300, farm ~68g/min).
 */

import type { MatchState, Side, Lane } from "./matchState";
import { LANES, teamOf, opponent } from "./matchState";

// ---------------------------------------------------------------------------
// Utilitário local — sem deps externas (padrão microMetrics.ts)
// ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// Constantes nomeadas — TODAS exportadas, NENHUM magic number inline
// ---------------------------------------------------------------------------

/**
 * Teto do laneLead: -100..+100.
 * Com peso 0.15, lead máximo contribui ~9 para pressão — moderado, preserva D-01
 * ("vantagem clara mas recuperável"; calibrado Plano 04).
 */
export const LANE_LEAD_CAP = 60;

/**
 * Decaimento do laneLead por tick (~0.985).
 * A cada tick de 15s, um lead de 60 cai ~0.9 unidades (D-06; calibrado Plano 04).
 */
export const LANE_LEAD_DECAY = 0.985;

/**
 * Decaimento de csDiff / xpDiff — mais lento que laneLead.
 * Farm de recuperação é gradual (D-06; calibrado Plano 04).
 */
const CS_XP_DECAY = 0.993;

/**
 * Decaimento de resetAdvantage — rápido (vantagem de recall é curta por definição).
 * (D-06; calibrado Plano 04)
 */
const RESET_ADV_DECAY = 0.85;

/**
 * Epsilon para snap-to-0 de resetAdvantage.
 */
const RESET_ADV_EPSILON = 0.05;

/**
 * Peso de conversão: 1 unidade de laneLead → pressão.
 * Com LANE_LEAD_CAP=60 e peso 0.15, lead máximo contribui ~9 — moderado,
 * permite que Elder permaneça decisivo em jogos equilibrados (D-01).
 * Re-ancorado na economia flat: kill=400g total. Exportado para recomputePressure (Plano 03).
 */
export const LANE_LEAD_TO_PRESSURE_WEIGHT = 0.15;

/**
 * Limiar de score para declarar lane como dominante/weakside.
 * Com 0.15, ativa quando há lead real sem thrashing em estado quase-simétrico
 * (A10 LANE-04; calibrado Plano 04).
 */
const STRONGSIDE_THRESHOLD = 0.15;

/**
 * Hierarquia de pesos por tipo de evento (D-07).
 * Re-ancorada na economia flat: kill=400g total, plate<tower<kill.
 * Hierarquia: solo_kill/gank > first_blood > dive > first_tower > plate (calibrado Plano 04).
 */
const LANE_EVENT_WEIGHTS: Record<LaneEventKind, number> = {
  solo_kill: 16,       // maior impacto (ouro + xp + setup + tempo)
  gank_converted: 14,  // quase igual: sinaliza atenção do jungler
  first_blood: 12,     // bônus simbólico + FB gold (+100g)
  dive: 10,            // vantagem de situação
  first_tower: 6,      // estrutura + gold, mas mais partilhado
  plate: 4,            // ouro real mas vantagem difusa
};

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Estado persistente por lane (LANE-01 — 10 campos).
 * Definido aqui; importado por matchState.ts como `import type`.
 */
export interface LaneStateEntry {
  /** Resumo persistente da vantagem: -LANE_LEAD_CAP..+LANE_LEAD_CAP. Decai ~0.985/tick. */
  laneLead: number;
  /** Diferença de CS (inteiro). Encolhe com farm de recuperação. */
  csDiff: number;
  /** Diferença de XP (inteiro). Encolhe com farm de recuperação. */
  xpDiff: number;
  /** Ouro de plates acumulado (inteiro). NÃO decai — ouro real. */
  plateGold: number;
  /** Vantagem de reset/recall: -2..+2. Decai rápido. */
  resetAdvantage: number;
  /** Volatilidade do matchup: 0..1. Lida de metricsBase, não decai. */
  matchupVolatility: number;
  /**
   * Atenção do jungler recebida: -1..+1. Derivada de pressão (state.pressure[lane]
   * do lado da lane, normalizado). Recalculada a cada tick em decayLaneState, no
   * mesmo padrão de re-derivação pós-decay que prioScore já usa (plano 26-07).
   */
  jungleAttentionReceived: number;
  /** Lane está em weakside? (boolean + intensidade 0..1) */
  weaksideState: { active: boolean; intensity: number };
  /** Prio score: -100..+100. Derivado de laneLead + csDiff. */
  prioScore: number;
  /**
   * Bookkeeping de histerese do recheio narrativo do early game (D-01/D-04,
   * plano 26-07). Por sinal (laneLead, prio, jungleAttention), guarda se o
   * classificador de cruzamento está armado (pronto para disparar) e o
   * último valor observado do sinal, usado como "antes" na próxima chamada
   * de classifyLaneCrossing (src/sim/laneSignals.ts). "armed" começa true;
   * vira false ao emitir e só volta a true quando o valor cai abaixo do
   * limiar de descida: é o mecanismo que impede enxurrada de eventos por
   * oscilação em torno do limiar (T-26-22). Este campo não escreve em
   * nenhum sinal: é bookkeeping próprio, gerido inteiramente por
   * accrueLaneSignals.
   */
  narrativeSignalState: {
    laneLead: { armed: boolean; lastValue: number };
    prio: { armed: boolean; lastValue: number };
    jungleAttention: { armed: boolean; lastValue: number };
  };
}

/**
 * Tipos de eventos que atualizam o lane state (D-07).
 */
export type LaneEventKind =
  | "solo_kill"       // kill 1v1 na lane
  | "gank_converted"  // gank do jungler resultou em kill
  | "first_blood"     // primeiro abate do jogo
  | "dive"            // dive tower bem executado
  | "plate"           // plate destruída
  | "first_tower";    // primeira torre do jogo

/**
 * Snapshot de strongside/weakside por time (LANE-04).
 */
export interface StrongsideSnapshot {
  /** Qual lane é o strongside atual. null = estado neutro (score abaixo do limiar). */
  dominantLane: "top" | "mid" | "bot" | null;
  /** Score de strongside por lane: -1..+1 (positivo = este time é o strong). */
  scores: Record<Lane, number>;
  /** Atenção combinada do jungler: -1..+1. */
  junglerAttention: number;
}

// ---------------------------------------------------------------------------
// freshLaneState — estado neutro com 10 campos (LANE-01)
// ---------------------------------------------------------------------------

/**
 * Retorna um LaneStateEntry com todos os 10 campos em estado neutro.
 * Identidade flat: 0/false/0 em todos os campos escalares. O bookkeeping de
 * histerese do recheio narrativo (plano 26-07) começa armado nos três
 * sinais, com último valor observado 0.
 */
export function freshLaneState(): LaneStateEntry {
  return {
    laneLead: 0,
    csDiff: 0,
    xpDiff: 0,
    plateGold: 0,
    resetAdvantage: 0,
    matchupVolatility: 0,
    jungleAttentionReceived: 0,
    weaksideState: { active: false, intensity: 0 },
    prioScore: 0,
    narrativeSignalState: {
      laneLead: { armed: true, lastValue: 0 },
      prio: { armed: true, lastValue: 0 },
      jungleAttention: { armed: true, lastValue: 0 },
    },
  };
}

// ---------------------------------------------------------------------------
// updateLaneState — acúmulo cumulativo rng-free (LANE-02)
// ---------------------------------------------------------------------------

/**
 * Aplica um evento de lane ao estado persistente.
 *
 * Regras:
 *  - Acumula no time vencedor (nunca reseta)
 *  - D-02: corta ~50% do peso no lado inimigo
 *  - Todo laneLead clampado a [-LANE_LEAD_CAP, LANE_LEAD_CAP]
 *  - plateGold só cresce em "plate" via opts.plateGoldAmount
 *  - prioScore re-derivado após cada escrita
 *  - NUNCA chama rng() nem Math.random
 */
export function updateLaneState(
  state: MatchState,
  side: Side,
  lane: Lane,
  eventKind: LaneEventKind,
  opts: { plateGoldAmount?: number } = {}
): void {
  const myLane = teamOf(state, side).laneState[lane];
  const enemyLane = teamOf(state, opponent(side)).laneState[lane];

  const weight = LANE_EVENT_WEIGHTS[eventKind];

  // Acumular no time que ganhou a vantagem
  myLane.laneLead = clamp(myLane.laneLead + weight, -LANE_LEAD_CAP, LANE_LEAD_CAP);

  // D-02: cortar ativamente o lead inimigo — não só decaimento passivo
  enemyLane.laneLead = clamp(
    enemyLane.laneLead - weight * 0.5,
    -LANE_LEAD_CAP,
    LANE_LEAD_CAP
  );

  // plateGold: ouro real, nunca decai — só cresce em evento "plate"
  if (eventKind === "plate" && opts.plateGoldAmount !== undefined) {
    myLane.plateGold += opts.plateGoldAmount;
  }

  // csDiff / xpDiff: kill e dive aumentam a diferença de farm/xp
  if (
    eventKind === "solo_kill" ||
    eventKind === "gank_converted" ||
    eventKind === "dive"
  ) {
    myLane.csDiff += 8;  // calibrado Plano 04: kill/dive geram ~8 CS de diferença
    myLane.xpDiff += 6;  // calibrado Plano 04: kill/dive geram ~6 XP de diferença
  }

  // resetAdvantage: eventos de alto peso dão vantagem curta de recall
  if (weight >= 10) {
    myLane.resetAdvantage = clamp(myLane.resetAdvantage + 1, -2, 2);
  }

  // prioScore: derivado imediato de laneLead + csDiff
  myLane.prioScore = clamp(
    myLane.laneLead * 0.7 + myLane.csDiff * 0.3,
    -100,
    100
  );
}

// ---------------------------------------------------------------------------
// decayLaneState — decaimento diferenciado por campo, uma vez por tick (LANE-02)
// ---------------------------------------------------------------------------

/**
 * Aplica decaimento diferenciado por campo a todas as lanes de ambos os times.
 *
 * Chamada no step 2 do tick loop, ANTES de recomputePressure.
 * Espelha decayMomentum (engine.ts) — multiplicativo, rng-free.
 *
 * Campos:
 *  - laneLead: *= LANE_LEAD_DECAY (~0.985) — decaimento lento
 *  - csDiff / xpDiff: *= CS_XP_DECAY (mais lento — farm de recuperação é gradual)
 *  - plateGold: NÃO decai (D-06 — ouro real)
 *  - resetAdvantage: *= RESET_ADV_DECAY (rápido) + snap-to-0 abaixo de epsilon
 *  - prioScore: re-derivado pós-decay
 *
 * Identidade flat: com laneLead==0 inicial, multiplicar por qualquer constante
 * mantém laneLead==0 (0 * k = 0). INV-1 provado.
 */
export function decayLaneState(state: MatchState): void {
  for (const side of ["user", "rival"] as Side[]) {
    const team = teamOf(state, side);
    for (const lane of LANES) {
      const ls = team.laneState[lane];

      // laneLead: decaimento lento multiplicativo (D-06)
      ls.laneLead *= LANE_LEAD_DECAY;

      // csDiff / xpDiff: encolhem com farm de recuperação (D-06)
      ls.csDiff = Math.round(ls.csDiff * CS_XP_DECAY);
      ls.xpDiff = Math.round(ls.xpDiff * CS_XP_DECAY);

      // plateGold: NÃO decai (D-06 — ouro real)
      // (nenhuma operação em plateGold)

      // resetAdvantage: some rápido (D-06) + snap-to-0
      ls.resetAdvantage *= RESET_ADV_DECAY;
      if (Math.abs(ls.resetAdvantage) < RESET_ADV_EPSILON) {
        ls.resetAdvantage = 0;
      }

      // prioScore: re-derivado de laneLead + csDiff (pós-decay)
      ls.prioScore = clamp(
        ls.laneLead * 0.7 + ls.csDiff * 0.3,
        -100,
        100
      );

      // jungleAttentionReceived: re-derivado de state.pressure[lane] (plano 26-07,
      // D-01). Mesmo padrão de re-derivação pós-decay que prioScore: nenhum
      // acúmulo próprio, só leitura da grandeza que a engine já mantém
      // (recomputePressure). Sinal de pressão pelo lado da lane, normalizado
      // ao intervalo -1..+1 do campo. Nota de ordem: decayLaneState roda ANTES
      // de recomputePressure no laço de tick (ordem crítica documentada no
      // header deste módulo), então este valor reflete a pressão do tick
      // anterior, mesma defasagem de um tick que laneLead já introduz na
      // leitura de recomputePressure, sem quebrar a curva de cruzamento.
      const signedPressure =
        side === "user" ? state.pressure[lane] : -state.pressure[lane];
      ls.jungleAttentionReceived = clamp(signedPressure / 100, -1, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// computeStrongsideScore — blend dos 3 sinais, rng-free (LANE-04)
// ---------------------------------------------------------------------------

/**
 * Calcula o snapshot de strongside/weakside para um time.
 *
 * Blend de 3 sinais (D-03):
 *  (a) leadContrib — laneLead atual vs inimigo, normalizado por LANE_LEAD_CAP
 *  (b) scaleContrib — scalingCurve do carry da lane (metricsBase frozen camada 1+2)
 *  (c) weaksideContrib — 1 - weaksideTolerance do laner inimigo
 *
 * Não chama contextMetrics() — Pitfall 5/6 (jungleAttentionReceived não é
 * cacheável para roles não-jungle). Usa scores derivados de laneLead como proxy.
 *
 * Em estado neutro (todos laneLead==0, metricsBase flat): dominantLane === null.
 * NUNCA chama rng() nem Math.random.
 */
export function computeStrongsideScore(
  state: MatchState,
  side: Side
): StrongsideSnapshot {
  const myTeam = teamOf(state, side);
  const enemyTeam = teamOf(state, opponent(side));

  const scores: Record<Lane, number> = { top: 0, mid: 0, bot: 0 };

  for (const lane of LANES) {
    const myLs = myTeam.laneState[lane];
    const enemyLs = enemyTeam.laneState[lane];

    // (a) Lane lead atual, normalizado pelo teto (D-03a)
    // Diferença relativa: positivo = meu time está à frente nesta lane
    const leadContrib = (myLs.laneLead - enemyLs.laneLead) / LANE_LEAD_CAP;

    // (b) scalingCurve diferencial: meu carry vs carry inimigo (D-03b)
    // Usando diferencial para preservar INV-1: times simétricos → contribuição 0
    const carryRole = lane === "bot" ? "adc" : lane === "mid" ? "mid" : "top";
    const myCarry = myTeam.players[carryRole];
    const enemyLaner = enemyTeam.players[carryRole];
    const scaleContrib =
      (myCarry.metricsBase.scalingCurve - enemyLaner.metricsBase.scalingCurve) * 0.3; // A11 coeficiente do blend (calibrado Plano 04)

    // (c) weaksideTolerance diferencial: inimigo fraco no weakside → vantagem nossa (D-03c)
    // Usando diferencial: minha tolerância vs inimiga — 0 em estado simétrico
    const weaksideContrib =
      (enemyLaner.metricsBase.weaksideTolerance - myCarry.metricsBase.weaksideTolerance) * 0.2; // A11 coeficiente do blend (calibrado Plano 04)

    scores[lane] = clamp(leadContrib + scaleContrib + weaksideContrib, -1, 1);
  }

  // Lane dominante: a que tem score mais alto acima do limiar
  let dominantLane: "top" | "mid" | "bot" | null = null;
  let maxScore = STRONGSIDE_THRESHOLD;
  for (const lane of LANES) {
    if (scores[lane] > maxScore) {
      maxScore = scores[lane];
      dominantLane = lane;
    }
  }

  // junglerAttention: combinação ponderada dos scores (proxy sem chamar contextMetrics)
  // bot tem maior peso (carry win-condition mais frequente em early)
  const junglerAttention = clamp(
    scores.bot * 0.4 + scores.mid * 0.35 + scores.top * 0.25,
    -1,
    1
  );

  return { dominantLane, scores, junglerAttention };
}
