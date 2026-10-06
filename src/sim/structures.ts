/**
 * src/sim/structures.ts
 *
 * Phase 17 -- extraido de engine.ts (D-05, plano 17-01, refactor puro no-op).
 *
 * Contem as tres funcoes de pressao estrutural extraidas sem mudanca de
 * comportamento:
 *   - damageStructure   -- logica de queda de estrutura em cascata
 *   - resolveStructurePressure -- decide e executa pressao de torre
 *   - resolveHeraldUse  -- aplica o Arauto numa lane de pressao
 *
 * Phase 17 Plan 02 adiciona:
 *   - sigmoid01()                 -- helper de sigmoide [0,1] para curva temporal
 *   - structureTimePlausibility() -- multiplicador 0..1 por tier e tempo (STR-02)
 *
 * Phase 17 Plan 03 adiciona (D-06, comportamental):
 *   - computeStructureDamage()    -- formula multiplicativa pura (STR-03)
 *   - deriveWaveMultiplier()      -- derivador de waveMultiplier a partir do state
 *   - Acumulo de dano no pool de StructureDamageState; queda so por pool >= 100
 *   - Emissao de plate_taken / tower_low (visiveis) antes da queda (STR-04)
 *
 * INVARIANTE (D-06): novos draws de rng() ao FINAL das funcoes, apos os dois
 * draws existentes (rng()>force e selectKiller). Aridade preservada ao maximo.
 * O golden e regenerado mecanicamente (D-04) apos esta fase estabilizar.
 */

import type { MatchState, Side, Lane, TeamState, PlayerState } from "./matchState";
import {
  teamOf,
  opponent,
  TIMERS,
  hasBaronBuff,
  aliveCount,
  ROLES,
  LANES,
  DEFAULT_SIM_CONFIG,
} from "./matchState";
import {
  creditTeamSplit, objectiveBountyGold, TOWER_GOLD, plateGold, FIRST_TURRET_BONUS, type StructureTier,
} from "./economy";
import { effectiveChaos } from "./tuning";
import { updateLaneState } from "./laneState";
import type { SimEvent, EventKind } from "./simEvents";
import { shortName, placeLabel } from "./ticker";
import { selectKiller, type FightContext } from "./selection";
import type { MacroIntent } from "./engine";
import { sideForceBonus, sideSplitLane } from "./traitEffects";
import {
  bumpMomentum,
  bestPressureLane,
  finishGameStructures,
  baseEvent,
} from "./engine";

// ---------------------------------------------------------------------------
// Constantes de calibracao do freio de cascata (STR-05, Phase 18 Plan 01)
// ---------------------------------------------------------------------------

/**
 * Multiplicador minimo imediatamente apos uma queda estrutural na mesma lane.
 * 0.25 = 75% de reducao de dano logo apos a queda. Calibrar via harness.
 */
export const CASCADE_REDUCAO_MAX = 0.25;

/**
 * Janela de decaimento do freio por-lane em segundos (3 minutos).
 * Apos este intervalo, o freio decai completamente para 1.0. Calibrar via harness.
 */
export const CASCADE_N_LANE_SEC = 180;

/**
 * Multiplicador minimo do freio global cross-lane. Mais fraco que o freio por-lane.
 * 0.5 = 50% de reducao de dano logo apos qualquer queda estrutural. Calibrar via harness.
 */
export const CASCADE_REDUCAO_GLOBAL = 0.50;

/**
 * Janela de decaimento do freio global cross-lane em segundos (45s).
 * Impede quedas de torres de lanes diferentes em segundos consecutivos. Calibrar via harness.
 */
export const CASCADE_N_GLOBAL_SEC = 45;

// ---------------------------------------------------------------------------
// Freio de cascata (STR-05, Phase 18 Plan 01)
// ---------------------------------------------------------------------------

/**
 * Calcula o fator multiplicativo de freio de cascata para computeStructureDamage.
 *
 * FUNCAO PURA: sem efeitos colaterais, sem mutacao de state, sem rng(). D-07.
 *
 * @param pool   Pool de dano da lane atual (source: enemy.structureDamage[lane]).
 * @param state  Estado global do match.
 * @param _side  Lado atacante (reservado para extensoes futuras).
 * @param bypass Se true (Baron/Elder/ace-wipe/nexus exposto), retorna 1.0 sem freio (D-03).
 * @returns      Multiplicador em [CASCADE_REDUCAO_MAX, 1.0]. 1.0 = sem freio.
 *
 * Ref: STR-05, D-01 (forma do freio: rampa continua, nao binario), D-02 (por-lane + global leve).
 */
export function cascadeDamageMultiplier(
  pool: import("./matchState").StructureDamageState,
  state: MatchState,
  _side: Side,
  bypass: boolean
): number {
  if (bypass) return 1.0;

  const now = state.gameTimeSec;

  // Freio por-lane: decai de CASCADE_REDUCAO_MAX ate 1.0 em CASCADE_N_LANE_SEC
  const lastLane = pool.lastStructureDestroyedAtSec;
  const laneRatio = lastLane === null
    ? 1.0
    : Math.min(1.0, (now - lastLane) / CASCADE_N_LANE_SEC);
  const laneMultiplier = CASCADE_REDUCAO_MAX + (1.0 - CASCADE_REDUCAO_MAX) * laneRatio;

  // Freio global cross-lane (D-02): impede quedas de lanes diferentes em segundos consecutivos
  const lastGlobal = state.lastAnyStructureDestroyedAtSec;
  const globalRatio = lastGlobal === null
    ? 1.0
    : Math.min(1.0, (now - lastGlobal) / CASCADE_N_GLOBAL_SEC);
  const globalMultiplier = CASCADE_REDUCAO_GLOBAL + (1.0 - CASCADE_REDUCAO_GLOBAL) * globalRatio;

  return Math.min(laneMultiplier, globalMultiplier);
}

/**
 * Detecta se o time atacante tem snowball legitimo que anula o freio de cascata.
 *
 * FUNCAO PURA: sem efeitos colaterais, sem mutacao de state, sem rng(). D-07.
 *
 * Retorna true se ANY das condicoes de bypass (D-03):
 *   - Nexus inimigo exposto (force=1, final de jogo)
 *   - Baron ativo para o time atacante
 *   - Elder ativo para o time atacante
 *   - Ace/wipe: maioria do time inimigo morta (>= 3 de 5 mortos, aliveCount <= 2)
 *
 * Ref: D-03, STR-05.
 */
export function deriveBypass(
  state: MatchState,
  side: Side,
  enemy: import("./matchState").TeamState
): boolean {
  if (enemy.nexusExposed) return true;
  if (hasBaronBuff(state, side)) return true;
  const elderUntil = state.buffs.elderUntilSec[side];
  if (elderUntil !== null && elderUntil > state.gameTimeSec) return true;
  // Ace/wipe: maioria do time inimigo morta (>= 3 de 5 mortos = aliveCount <= 2)
  if (aliveCount(enemy) <= 2) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Plausibilidade de ator estrutural (STR-06, Phase 18 Plan 02)
// ---------------------------------------------------------------------------

/**
 * Mapeia a lane para o role do laner natural que defende/ataca aquela lane.
 *
 * "top"  -> "top"  (toplaner)
 * "mid"  -> "mid"  (midlaner)
 * "bot"  -> "adc"  (ADC e o carry natural da bot lane)
 *
 * FUNCAO PURA: sem efeitos colaterais, sem mutacao de state, sem rng(). D-07.
 *
 * Ref: STR-06, D-04.
 */
export function laneToRole(lane: Lane): import("../data/schema").Role {
  if (lane === "top") return "top";
  if (lane === "mid") return "mid";
  return "adc"; // bot -> ADC como candidato primario
}

/**
 * Deriva o sinal de contexto de gank/dive a partir de estado existente.
 *
 * FUNCAO PURA: sem efeitos colaterais, sem mutacao de state, sem rng(). D-07.
 *
 * Opcao A+C (18-RESEARCH.md Pattern 3):
 *   - Sinal 1: vantagem numerica (aliveCount(team) > aliveCount(enemy))
 *   - Sinal 2: lane lead alto (laneState[lane].laneLead > 20) como proxy de pressao
 *
 * Retorna true se qualquer sinal estiver ativo. Sem campo novo. Sem draw de RNG.
 *
 * Ref: STR-06, D-05 (sinal derivado de estado existente), 18-RESEARCH.md "Pattern 3".
 */
export function deriveGankContext(
  state: MatchState,
  side: Side,
  lane: Lane
): boolean {
  const team = teamOf(state, side);
  const enemy = teamOf(state, opponent(side));

  // Sinal 1: vantagem numerica (aliados extras vivos = dive/gank em andamento)
  const hasNumbersAdvantage = aliveCount(team) > aliveCount(enemy);

  // Sinal 2: lane lead alto indica gank convertido recente (decai lentamente)
  const laneLead = team.laneState[lane].laneLead;
  const hasStrongLaneLead = laneLead > 20;

  return hasNumbersAdvantage || hasStrongLaneLead;
}

/**
 * Constroi o array de candidatos plausíveis para ator do evento estrutural.
 *
 * FUNCAO PURA: sem efeitos colaterais, sem mutacao de state, sem rng(). D-07.
 *
 * Regras (STR-06):
 *   - Antes de 14:00 (< 840s) e sem Baron/Herald ativo:
 *       candidatos = [laner da lane] + (hasGankCtx ? [jungler] : [])
 *       support SEMPRE excluido do array em early.
 *       ADC SEMPRE excluido quando lane != "bot" em early sem macro.
 *   - Com Baron/Herald ativo OU a partir de 14:00: distribuicao aberta (todos os vivos).
 *   - Fallback: se candidatos filtrados = zero (laner morto, jungler morto e sem gank),
 *               usar todos os vivos. Se nenhum vivo, usar ROLES inteiros (mesmo fallback
 *               de engine.ts (analog de filtro de candidatos, D-07).
 *
 * A funcao e chamada ANTES de selectKiller; selectKiller consome exatamente 1 draw
 * independente do tamanho do array -- aridade preservada (D-07).
 *
 * @param team             Time atacante (teamOf(state, side)).
 * @param lane             Lane alvo do evento estrutural.
 * @param gameSec          state.gameTimeSec.
 * @param hasGankCtx       Resultado de deriveGankContext (bool, rng-free).
 * @param hasBaronOrHerald true se Baron ativo OU Herald disponivel (macro plausivel).
 *
 * Ref: STR-06, D-04 (mapa ator x lane), D-05 (jungler sob gank), D-06 (macro ADC),
 *      D-07 (aridade), 18-RESEARCH.md "Pattern 2".
 */
export function buildStructureActorCandidates(
  team: TeamState,
  lane: Lane,
  gameSec: number,
  hasGankCtx: boolean,
  hasBaronOrHerald: boolean
): PlayerState[] {
  const alive = ROLES.map((r) => team.players[r]).filter((p) => p.alive);

  // Fallback: nenhum vivo -> retornar ROLES inteiros (mesmo fallback do analog engine.ts, D-07)
  if (alive.length === 0) return ROLES.map((r) => team.players[r]);

  const isEarly = gameSec < 840; // < 14:00 (TIMERS.MID_PHASE_AT)

  // Pos-14:00 ou com Baron/Herald ativo: distribuicao aberta -- todos os vivos
  if (!isEarly || hasBaronOrHerald) {
    return alive;
  }

  // Early game (< 14:00, sem Baron/Herald):
  // Candidatos = laner da lane + jungler (sob gank/dive)
  // Support SEMPRE excluido; ADC excluido quando lane != "bot"
  const lanerRole = laneToRole(lane);
  const candidates: PlayerState[] = [];

  const laner = team.players[lanerRole];
  if (laner.alive) candidates.push(laner);

  if (hasGankCtx) {
    const jungler = team.players["jungle"];
    if (jungler.alive && !candidates.includes(jungler)) {
      candidates.push(jungler);
    }
  }

  // Fallback: se zero candidatos aplicaveis, retornar todos os vivos
  return candidates.length > 0 ? candidates : alive;
}

// ---------------------------------------------------------------------------
// Curva temporal de plausibilidade estrutural (STR-02, Phase 17 Plan 02)
// ---------------------------------------------------------------------------

/**
 * Sigmoide continua em [0,1].
 *
 * @param x         Valor de entrada (ex: gameTimeSec).
 * @param center    Ponto de inflexao onde a funcao vale 0.5.
 * @param steepness Inclinacao da curva (maior = transicao mais abrupta).
 */
function sigmoid01(x: number, center: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (x - center)));
}

/**
 * Multiplicador temporal de plausibilidade de queda estrutural por tier.
 *
 * Retorna um valor em [0,1] que cresce de quase-zero ate 1.0 conforme o
 * jogo avanca. Nunca e um hard gate binario (D-06, spec §53): a rampa e
 * continua (sigmoide), permitindo torrea extremamente raras em early, stomp
 * em mid, e quase certas em late.
 *
 * Ancoras por tier (spec §53):
 *   - outer:      < 3min (~180s) ~ 0; >= 8min (480s) ~ 1
 *   - inner:      < 7min (420s) ~ 0; >= 12min (720s) ~ 1
 *   - inhibTurret: < 10-12min (600-720s) ~ 0; >= 16min (960s) ~ 1
 *   - nexusTurret: < 16-18min (960-1080s) ~ 0; >= 22min (1320s) ~ 1
 *
 * O retorno e sempre clampeado em [0,1] para seguranca contra overflow de float
 * (T-17-03).
 *
 * Funcao PURA: sem efeitos colaterais, sem mutacao de state, sem rng().
 * Sera consumida pela formula de dano estrutural no Plano 03.
 *
 * Ref: ENGINE-HARDENING-SPEC.md §53, STR-02.
 */
export function structureTimePlausibility(
  tier: "outer" | "inner" | "inhibTurret" | "nexusTurret",
  gameTimeSec: number
): number {
  let raw: number;
  switch (tier) {
    case "outer":
      // center=360s (6min): ~0 em 3min, ~0.5 em 6min, ~1 em 9min
      raw = sigmoid01(gameTimeSec, 360, 0.025);
      break;
    case "inner":
      // center=600s (10min): ~0 em 5min, ~0.5 em 10min, ~1 em 14min
      raw = sigmoid01(gameTimeSec, 600, 0.020);
      break;
    case "inhibTurret":
      // center=780s (13min): ~0 em 10min, ~0.5 em 13min, ~1 em 17min
      raw = sigmoid01(gameTimeSec, 780, 0.018);
      break;
    case "nexusTurret":
      // center=1200s (20min): ~0 em 15min, ~0.5 em 20min, ~1 em 25min
      // Ajustado para satisfazer ancora §53: nexusTurret < 16-18min ~0
      raw = sigmoid01(gameTimeSec, 1200, 0.016);
      break;
  }
  // Clamp defensivo contra overflow de float (T-17-03)
  return Math.max(0, Math.min(1, raw));
}

// ---------------------------------------------------------------------------
// Formula multiplicativa de dano estrutural (STR-03, Phase 17 Plan 03)
// ---------------------------------------------------------------------------

/**
 * Fatores da formula multiplicativa de dano por tick.
 *
 * Todos os fatores sao multipicadores positivos. O produto e o dano por tick
 * adicionado ao pool de StructureDamageState.
 *
 * Ref: ENGINE-HARDENING-SPEC.md §54, STR-03.
 */
export interface StructureDamageFactors {
  /** Dano base por tick (escala calibrada para p50 ~9min em equilibrado). */
  base: number;
  /**
   * Multiplicador de wave: 0.3 sem wave; 1.0 com wave favoravel; 1.3 com
   * wave crashada. Derivado de pressure[lane] e laneState.laneLead (lean --
   * sem modelo de wave explícito).
   */
  waveMultiplier: number;
  /**
   * Ameaca de siege: 1.0 base; +0.3 se o comp tem tag "poke" (ADC/ranged).
   * Reflete a pressao de campeoes de poke/marksman mantendo o siege.
   */
  siegeThreat: number;
  /**
   * Vantagem numerica: 1.0 em 5v5; +0.15 por aliado extra vivo (acima de 5)
   * menos o numero de inimigos vivos.
   */
  numbersAdvantage: number;
  /**
   * Multiplicador temporal (structureTimePlausibility). Cresce de quase-zero
   * no early para 1.0 no late por tier. Domina o early.
   */
  timePlausibility: number;
  /**
   * Resistencia por tier: outer=1.0 / inner=0.85 / inhibTurret=0.75 /
   * nexusTurret=0.65. Torres mais avancadas acumulam dano mais devagar.
   */
  structureTierModifier: number;
  /**
   * Modificador de buff de objetivo: 1.0 base; +0.5 Baron; +0.04 por
   * voidgrub; +0.1 Elder. Reutiliza o calculo de force existente.
   */
  objectiveBuffModifier: number;
  /**
   * Freio de cascata (STR-05): 1.0 sem freio; < 1.0 apos queda recente na
   * mesma lane ou em qualquer lane (freio global leve). rng-free. D-01/D-02.
   */
  cascadeBreakMultiplier: number;
}

/**
 * Funcao pura de dano estrutural por tick.
 *
 * Multiplica os >= 4 fatores verificaveis pela formula:
 *   base * waveMultiplier * siegeThreat * numbersAdvantage * timePlausibility
 *        * structureTierModifier * objectiveBuffModifier * cascadeBreakMultiplier
 *
 * Pura: sem efeitos colaterais, sem mutacao de state, sem rng().
 *
 * Ref: ENGINE-HARDENING-SPEC.md §54, STR-03.
 */
export function computeStructureDamage(factors: StructureDamageFactors): number {
  return (
    factors.base *
    factors.waveMultiplier *
    factors.siegeThreat *
    factors.numbersAdvantage *
    factors.timePlausibility *
    factors.structureTierModifier *
    factors.objectiveBuffModifier *
    factors.cascadeBreakMultiplier
  );
}

/**
 * Deriva o waveMultiplier a partir do estado disponivel (lean -- sem modelo
 * de wave explícito).
 *
 * Usa pressure[lane] (signed: + favorece user) e laneState[lane].laneLead
 * como proxy de wave posicional.
 *
 * Valores:
 *   - pressao alta (>30) + vantagem de lane (>1): wave crashada -> 1.3
 *   - pressao moderada (>15): wave favoravel -> 1.0
 *   - pressao leve (>0): wave neutra -> 0.7
 *   - pressao neutra ou negativa: sem wave ou wave inimiga -> 0.3
 *
 * Ref: RESEARCH.md "deriveWaveMultiplier" e §54.
 */
export function deriveWaveMultiplier(
  state: MatchState,
  side: Side,
  lane: Lane
): number {
  // Pressao positiva = vantagem para o side ativo nesta lane
  const pressure = side === "user" ? state.pressure[lane] : -state.pressure[lane];
  const laneLead = teamOf(state, side).laneState[lane].laneLead;

  if (pressure > 30 && laneLead > 1) return 1.4; // wave crashada, siege forte
  if (pressure > 15) return 1.1;                  // wave favoravel
  if (pressure > 0) return 0.8;                   // wave neutra
  return 0.4;                                     // sem wave ou wave inimiga
}

/**
 * Dados o tier atual da lane inimiga, retorna o nome do campo de pool
 * correspondente em StructureDamageState, ou null se a proxima estrutura
 * a cair nao e uma torre (inibidor ou fase de nexus).
 *
 * O pool de dano aplica-se apenas a torres (outer/inner/inhibTurret/nexusTurret).
 * Inibidores e Nexus caem pelo caminho original (damageStructure direto).
 */
export function currentTierField(
  structures: TeamState["structures"][Lane],
  team: TeamState
): "outerDamage" | "innerDamage" | "inhibTurretDamage" | "nexusTurretDamage" | null {
  if (structures.outerAlive) return "outerDamage";
  if (structures.innerAlive) return "innerDamage";
  if (structures.inhibTurretAlive) return "inhibTurretDamage";
  // Inibidor ainda de pe: proximo alvo e o inibidor (sem pool de torre)
  if (structures.inhibitorAlive && structures.inhibitorRespawnAtSec === null) {
    return null; // sem campo de pool; damageStructure trata diretamente
  }
  // Inibidor caido (ou respawnando): proximo alvo sao as Torres do Nexus
  if (team.nexusTurretsAlive > 0) {
    return "nexusTurretDamage";
  }
  return null; // Nexus exposto (nenhuma torre para acumular)
}

/**
 * Retorna o tipo de tier de estrutura atualmente ativo na lane.
 * Usado para calcular o structureTierModifier e chamar structureTimePlausibility.
 * Retorna null se a proxima estrutura nao e uma torre.
 */
export function currentTierType(
  structures: TeamState["structures"][Lane],
  team: TeamState
): "outer" | "inner" | "inhibTurret" | "nexusTurret" | null {
  if (structures.outerAlive) return "outer";
  if (structures.innerAlive) return "inner";
  if (structures.inhibTurretAlive) return "inhibTurret";
  if (structures.inhibitorAlive && structures.inhibitorRespawnAtSec === null) {
    return null; // inibidor (sem pool)
  }
  if (team.nexusTurretsAlive > 0) {
    return "nexusTurret";
  }
  return null; // nexus exposto
}

/**
 * Retorna o structureTierModifier para o tier atual.
 *
 * Torres mais avancadas sao mais resistentes (acumulam dano mais devagar):
 *   outer=1.0 / inner=0.85 / inhibTurret=0.75 / nexusTurret=0.65
 */
export function tierModifierFor(
  tier: "outer" | "inner" | "inhibTurret" | "nexusTurret"
): number {
  switch (tier) {
    case "outer": return 1.0;
    case "inner": return 0.85;
    case "inhibTurret": return 0.75;
    case "nexusTurret": return 0.65;
  }
}

// ---------------------------------------------------------------------------
// Regra dura: nenhuma torre cai antes de 7:00 (garantia, nao margem de calibracao)
// ---------------------------------------------------------------------------

/** Regra dura: nenhuma torre cai antes de 7:00 (420 s), por nenhum canal de pool. */
export const NO_TOWER_BEFORE_SEC = 420;

/** Teto do pool de uma torre antes de 7:00: quase cheio, mas nunca em 100. */
const EARLY_POOL_CEILING = 99.9;

/**
 * Garantia da regra dura de 7:00 em TODO ponto de queda por pool (canal absoluto, caminho do
 * gate de resolveStructurePressure e conversao). Recebe o pool de antes e o de depois do dano e
 * devolve o pool a gravar: antes de 420 s, um pool que chegaria a 100 fica logo abaixo (99,9),
 * entao o ramo de queda `poolAfter >= 100` nao e tomado e o fluxo segue como num tick sem queda
 * (classificacao de placa e tower_low). Nunca baixa um pool abaixo de 100: se ele ja estava
 * entre 99,9 e 100, fica onde estava. Depois de 420 s, e identidade. Rng-free e sem estado.
 */
export function holdPoolBeforeTowerWindow(
  poolBefore: number,
  poolAfter: number,
  gameTimeSec: number
): number {
  if (poolAfter < 100 || gameTimeSec >= NO_TOWER_BEFORE_SEC) return poolAfter;
  const held = Math.min(poolAfter, Math.max(poolBefore, EARLY_POOL_CEILING));
  return held < 100 ? held : EARLY_POOL_CEILING;
}

// ---------------------------------------------------------------------------
// Limiar de eventos menores (STR-04, D-02)
// ---------------------------------------------------------------------------

/**
 * Limiar de pool para emitir tower_low (visivel na timeline).
 * Uma vez atingido, indica que a torre esta em estado critico.
 */
export const TOWER_LOW_THRESHOLD = 70;

/**
 * Placas do patch 26: toda torre de rota (externa, interna, do inibidor) tem 5 placas, que caem
 * em 10/25/45/70 de dano no pool; a 5a e a propria queda em 100. Nao ha corte em 14:00.
 */
export const PLATE_THRESHOLDS: readonly number[] = [10, 25, 45, 70];
export const PLATES_PER_TURRET = 5;

/** Placas que um pool ja tirou (0..4). A 5a sai so na queda, em damageStructure. */
export function platesAt(pool: number): number {
  let n = 0;
  for (const th of PLATE_THRESHOLDS) if (pool >= th) n++;
  return n;
}

/** O pool entra em estado critico (tower_low) neste golpe. */
export function crossesTowerLow(before: number, after: number): boolean {
  return before < TOWER_LOW_THRESHOLD && after >= TOWER_LOW_THRESHOLD;
}

type TurretTier = "outer" | "inner" | "inhibTurret" | "nexusTurret";

const PLATE_FIELD: Record<Exclude<TurretTier, "nexusTurret">, "outerPlates" | "innerPlates" | "inhibTurretPlates"> = {
  outer: "outerPlates",
  inner: "innerPlates",
  inhibTurret: "inhibTurretPlates",
};

/** Patch 26: a torre externa perde resistencia de 11:00 (660 s) a 15:00 (900 s). */
export function outerTurretDamageFactor(gameTimeSec: number, earlyFactor: number): number {
  if (gameTimeSec <= 660) return earlyFactor;
  if (gameTimeSec >= 900) return 1;
  return earlyFactor + (1 - earlyFactor) * ((gameTimeSec - 660) / 240);
}

/** Fator de dano por tier: so a torre externa tem a curva do patch 26; as outras valem 1. */
export function turretDamageFactor(state: MatchState, tier: TurretTier): number {
  return tier === "outer" ? outerTurretDamageFactor(state.gameTimeSec, state.tuning.outerTurretEarlyFactor) : 1;
}

/**
 * Qual evento menor corresponde a um cruzamento de pool neste tick.
 * "none" significa que o pool subiu sem cruzar nenhum limiar visivel
 * (o tower_chipped interno de D-01, que nao vira evento de timeline).
 */
export type StructureCrossing = "plate" | "tower_low" | "none";

/**
 * Classifica um cruzamento de pool de dano estrutural: dado o tier atual, o
 * tempo de jogo e o pool antes e depois do incremento deste tick, decide se o
 * cruzamento corresponde a uma placa, a uma torre entrando em estado critico,
 * ou a nenhum evento visivel.
 *
 * FUNCAO PURA: nao le nem escreve estado, nao emite evento, nao registra o
 * ouro da placa e nao recebe o gerador. Os efeitos colaterais (o registro do
 * ouro via updateLaneState e a construcao do evento) continuam nos pontos de
 * chamada, exatamente onde sempre estiveram.
 *
 * POR QUE ELA EXISTE, E POR QUE PRECISA SER CHAMADA PELOS DOIS CAMINHOS
 * (extraida no plano 25-03; ver 25-RESEARCH.md, Achado 4 e Armadilha 4):
 *
 * A emissao de placa NAO e um extra do canal de acumulo, e obrigatoria. Medido:
 * um canal que acumula pool continuamente sem emitir placa PIORA a metrica de
 * placas de 0,76 para 0,17 por partida, porque o acumulo come o pool da torre
 * externa em silencio, cruzando os limiares sem que ninguem os observe. O teto
 * fisico de cruzamentos disponivel sob acumulo continuo e 18,12 por partida,
 * contra 2,33 no estado de hoje: e esse teto que o canal absoluto vai explorar,
 * e ele so vira placa se passar por aqui.
 *
 * A regra (patch 26): toda torre de rota tem placa, a qualquer hora, sem corte de
 * horario. A placa sai quando o pool passa um dos limiares 10/25/45/70, e quantas
 * placas saem num golpe e platesAt(depois) - platesAt(antes). Um golpe grande que
 * atravessa varios limiares emite UM evento so, com a contagem no texto, e paga
 * todas as placas. A torre do Nexus nao tem placa. A 5a placa e a propria queda.
 *
 * Duas copias dessa regra, com uma delas ficando para tras numa fase futura, e
 * um modo de falha real e nomeado. Por isso ela vive num unico lugar.
 *
 * PRECEDENCIA, identica a do codigo em linha que ela substitui: a placa e
 * avaliada primeiro e retorna antes; a torre em estado critico so e avaliada
 * quando a placa nao saiu. Se as duas condicoes valem no mesmo tick, o
 * resultado e "plate". A queda de estrutura (pool alcancando 100) tem
 * precedencia sobre as duas e e decidida ANTES, no ponto de chamada, porque
 * queda nao e evento menor.
 */
export function classifyStructureCrossing(
  tierType: TurretTier,
  _gameTimeSec: number,
  poolBefore: number,
  poolAfter: number
): StructureCrossing {
  // Placa (patch 26): em toda torre de rota, a qualquer hora, quando o pool passa um limiar.
  if (tierType !== "nexusTurret" && platesAt(poolAfter) > platesAt(poolBefore)) return "plate";
  // Torre em risco: o pool cruza o limiar critico de baixo para cima neste tick.
  if (crossesTowerLow(poolBefore, poolAfter)) return "tower_low";
  return "none";
}

// ---------------------------------------------------------------------------
// Tipo interno (nao exportado; mantem encapsulamento)
// ---------------------------------------------------------------------------

interface StructureDamage {
  kind: EventKind;
  label: string;
  ticker: (who: string) => string;
}

// ---------------------------------------------------------------------------
// Funcoes extraidas (exportadas)
// ---------------------------------------------------------------------------

/**
 * Coleta `count` placas da torre `tier` da lane do inimigo (patch 26): cada uma paga
 * plateGold(agora) ao time. So a torre externa mexe no estado de rota (lead e plateGold), que e
 * coisa da fase de rota. Nunca passa de 5 placas por torre; torre do Nexus nao tem placa.
 * Devolve quantas placas sairam de fato.
 */
export function collectPlates(state: MatchState, side: Side, lane: Lane, tier: TurretTier, count: number): number {
  if (tier === "nexusTurret") return 0;
  const pool = teamOf(state, opponent(side)).structureDamage[lane];
  const field = PLATE_FIELD[tier];
  const n = Math.max(0, Math.min(count, PLATES_PER_TURRET - pool[field]));
  if (n === 0) return 0;
  pool[field] += n;
  const gold = n * plateGold(state.gameTimeSec);
  if (tier === "outer") updateLaneState(state, side, lane, "plate", { plateGoldAmount: gold });
  creditTeamSplit(teamOf(state, side), gold);
  return n;
}

const TIER_PLATE_LABEL: Record<TurretTier, string> = {
  outer: "",
  inner: " interna",
  inhibTurret: " do inibidor",
  nexusTurret: " do Nexus",
};

/** Texto do evento de placa: uma ou varias, a torre nomeada pelo tier e o estado critico no fim. */
export function plateTicker(actor: string, lane: Lane, tier: TurretTier, teamName: string, n: number, critical: boolean): string {
  const what = n === 1 ? "uma placa" : `${n} placas`;
  const base = `${actor} pressiona a torre${TIER_PLATE_LABEL[tier]} ${placeLabel(lane)} e coleta ${what} para o ${teamName}.`;
  return critical ? `${base} A torre fica em estado crítico.` : base;
}

/**
 * Knock down the next structure in a lane (outer -> inner -> inhib turret ->
 * inhibitor -> nexus turret -> nexus). Returns the event framing, or null when the
 * lane has nothing left to break this push.
 *
 * Extraido de engine.ts:1038-1139 (D-05, plano 17-01). No-op: mesma logica,
 * mesma ordem de efeitos colaterais, mesmo consumo de gerador (nenhum aqui).
 *
 * CONTRATO DE GERADOR, GARANTIDO PELO TIPO (Fase 25, plano 25-03):
 * derrubar estrutura e uma operacao LIVRE DE GERADOR. Ate a Fase 25 isso era
 * so uma observacao escrita em comentario, e a funcao ainda recebia um
 * parametro de gerador que nenhum ramo do corpo usava (marcado com o prefixo
 * de nao usado desde a extracao da Fase 17). O parametro foi removido: agora a
 * funcao NAO TEM o gerador, logo NAO PODE consumi-lo, e o compilador e quem
 * garante isso em vez da vigilancia de quem le.
 *
 * Por que essa propriedade importa: ela e o que torna o canal absoluto da
 * Fase 25 compativel com o invariante de determinismo por semente. Um caminho
 * novo pode derrubar estrutura por aqui sem gastar um unico sorteio, e por
 * isso sem deslocar a sequencia de sorteios de nenhuma partida. O unico
 * consumidor de sorteio do caminho estrutural e selectKiller, que existe para
 * escolher o NOME DO ATOR do evento, e ele vive nos chamadores, nao aqui.
 *
 * O parametro `_strength` continua declarado e continua nao usado. Isso e
 * deliberado neste plano: ele remove exatamente um parametro para que o diff
 * seja minimo e a leitura de no-op seja trivial. Decidir o destino de
 * `_strength` e trabalho da revisao em bloco da Fase 30, nao desta fase.
 */
export function damageStructure(
  state: MatchState,
  side: Side,
  enemy: TeamState,
  lane: Lane,
  _strength: number
): StructureDamage | null {
  const team = teamOf(state, side);
  const s = enemy.structures[lane];
  const place = placeLabel(lane);

  // An exposed Nexus is finishable from any lane -- once both Nexus turrets are
  // down the base is open, even if an inhibitor has respawned behind it.
  if (enemy.nexusExposed) {
    finishGameStructures(state, side);
    return {
      kind: "gg",
      label: "destruiu o Nexus",
      ticker: () => `GG · o ${team.name} destruiu o Nexus do ${enemy.name}!`,
    };
  }

  const recordTower = (tier: StructureTier): void => {
    team.towersDestroyed += 1;
    // Recompensa de objetivo (spec secao 3): deficit de antes da tomada, sem sorteio.
    creditTeamSplit(team, objectiveBountyGold(team.gold, enemy.gold, effectiveChaos(state), state.tuning));
    creditTeamSplit(team, TOWER_GOLD[tier]);
    // Patch 26: a queda e a 5a placa; paga tambem as que o pool ainda nao tinha tirado.
    if (tier === "outer" || tier === "inner" || tier === "inhibTurret") {
      collectPlates(state, side, lane, tier, PLATES_PER_TURRET);
    }
    if (!state.firstTurretDone) {
      // LANE-03: first_tower hook -- ANTES de setar a flag. O hook nao consome
      // sorteio: esta funcao inteira e livre de gerador (ver o contrato acima).
      updateLaneState(state, side, lane, "first_tower");
      state.firstTurretDone = true;
      creditTeamSplit(team, FIRST_TURRET_BONUS);
    }
    bumpMomentum(state, side, 6);
  };

  if (s.outerAlive) {
    s.outerAlive = false;
    const first = !state.firstTurretDone;
    recordTower("outer");
    return {
      kind: first ? "first_tower" : "tower_destroyed",
      label: "abriu a primeira torre",
      ticker: (who) =>
        first
          ? `${who} derrubou a PRIMEIRA torre do jogo ${place} para o ${team.name}.`
          : `${who} derrubou a torre externa ${place}.`,
    };
  }
  if (s.innerAlive) {
    s.innerAlive = false;
    recordTower("inner");
    return {
      kind: "tower_destroyed",
      label: "quebrou a torre interna",
      ticker: (who) => `${who} quebrou a torre interna ${place}.`,
    };
  }
  if (s.inhibTurretAlive) {
    s.inhibTurretAlive = false;
    recordTower("inhibTurret");
    return {
      kind: "tower_destroyed",
      label: "derrubou a torre do inibidor",
      ticker: (who) => `${who} derrubou a torre do inibidor ${place}.`,
    };
  }
  if (s.inhibitorAlive) {
    s.inhibitorAlive = false;
    s.inhibitorRespawnAtSec = state.gameTimeSec + TIMERS.INHIBITOR_RESPAWN;
    team.inhibitorsDestroyed += 1;
    creditTeamSplit(team, objectiveBountyGold(team.gold, enemy.gold, effectiveChaos(state), state.tuning));
    creditTeamSplit(team, TOWER_GOLD.inhibitor);
    bumpMomentum(state, side, 10);
    return {
      kind: "inhibitor_destroyed",
      label: "destruiu o inibidor",
      ticker: (who) => `${who} destruiu o inibidor ${place}.`,
    };
  }
  // Inhibitor already down -> go for Nexus turrets, then the Nexus itself.
  if (enemy.nexusTurretsAlive > 0) {
    enemy.nexusTurretsAlive -= 1;
    creditTeamSplit(team, TOWER_GOLD.nexusTurret);
    if (enemy.nexusTurretsAlive === 0) {
      enemy.nexusExposed = true;
      return {
        kind: "nexus_exposed",
        label: "expos o Nexus",
        ticker: () => `O Nexus do ${enemy.name} esta EXPOSTO!`,
      };
    }
    return {
      kind: "tower_destroyed",
      label: "derrubou uma torre do Nexus",
      ticker: (who) => `${who} derrubou uma torre do Nexus inimigo.`,
    };
  }
  // (Nexus exposed is handled at the top of this function.)
  return null;
}

/**
 * Resolve pressao estrutural: avalia forca de siegio e acumula dano no pool
 * de StructureDamageState. A queda de estrutura so ocorre quando o pool
 * acumulado atinge 100 -- nunca por roll unico (STR-01, STR-03, STR-04).
 *
 * Fluxo de RNG (D-06): os dois draws existentes (rng()>force e selectKiller)
 * sao SEMPRE consumidos quando o gate passa (force > 0.18 e rng() <= force).
 * Este e o contrato critico: preservar a aridade ao maximo (D-06).
 *
 * Ao preservar os dois draws por tick de gate-passagem (identico ao original),
 * a sequencia de RNG e minimamente deslocada. A diferenca e que agora o
 * resultado pode ser: plate_taken / tower_low / queda real / null (sem evento)
 * em vez de: queda real / null.
 *
 * Eventos visiveis emitidos sem queda (STR-04):
 *   - plate_taken: o pool de uma torre de rota cruza 10/25/45/70 (patch 26, a qualquer hora)
 *   - tower_low: pool >= 70 (torre em estado critico)
 *
 * Ref: ENGINE-HARDENING-SPEC.md §54-55, STR-01/STR-03/STR-04, D-06.
 */
export function resolveStructurePressure(
  state: MatchState,
  side: Side,
  intent: MacroIntent,
  rng: () => number
): SimEvent | null {
  const team = teamOf(state, side);
  const enemy = teamOf(state, opponent(side));
  let lane: Lane;
  if (intent === "press_top") lane = "top";
  else if (intent === "press_mid") lane = "mid";
  else if (intent === "press_bot") lane = "bot";
  // Spec traits no motor (3.5): o split do `side` vai para a rota dele no meio de jogo.
  else if (intent === "split_push") lane = sideSplitLane(state, side) ?? bestPressureLane(state, side);
  else lane = bestPressureLane(state, side);

  // Need real pressure (or Baron) on that lane to take a structure. An exposed
  // enemy Nexus forces the push (the game must close out, not stall).
  const pressure = side === "user" ? state.pressure[lane] : -state.pressure[lane];
  const baron = hasBaronBuff(state, side);
  // Late-game siege escalation: deep into the game (full builds, big death
  // timers) bases crack far more easily, so no match ever stalls to the cap.
  const lateRamp = Math.max(0, (state.gameTimeSec - 2100) / 900); // +0 at 35:00, +1 at 50:00
  const force = enemy.nexusExposed
    ? 1
    : pressure / 100 + (baron ? 0.5 : 0) + team.voidgrubs * 0.04 + lateRamp + sideForceBonus(state, side, lane);
  // Draw 1 (existente): gate de pressao -- POSICAO PRESERVADA (D-06).
  if (force <= 0.18 || rng() > force) return null;

  // Contexto de selectKiller -- reutilizado em todos os caminhos que emitem evento.
  // Este contexto e construido ANTES de qualquer bifurcacao para que o campo
  // goldLead/teamDeaths esteja consistente em todos os caminhos.
  const siegeCtx: FightContext = {
    eventType: "kill",
    minute: state.gameTimeSec / 60,
    state,
    lane,
    goldLead: (side === "user" ? 1 : -1) * (state.user.gold - state.rival.gold),
    teamDeaths: state.user.deaths + state.rival.deaths,
    lowHpTargets: false,
    killerTeamComp: team.compProfile,
    gameSec: state.gameTimeSec,
  };

  // --- Se o nexus esta exposto, derrubar diretamente (sem pool -- final de jogo) ---
  if (enemy.nexusExposed) {
    const dmg = damageStructure(state, side, enemy, lane, baron ? 1.0 : 0.7);
    if (!dmg) return null;
    // FREIO GLOBAL: este caminho ESCREVE o instante global mas NAO le (Fase 25,
    // plano 25-04). A assimetria e deliberada e as duas metades tem razoes
    // diferentes. Escrever, porque nenhum caminho de queda deve ficar invisivel
    // ao freio: um Nexus caindo e uma queda de estrutura como qualquer outra, e
    // os outros caminhos precisam ve-la. NAO ler, porque este e o fechamento da
    // partida: bloquear aqui adiaria o fim do jogo por um tick a cada vez, e o
    // criterio de nunca empatar no teto de tempo tem prioridade sobre a estetica
    // da cascata no ultimo tick da partida. Medido: nenhum efeito na duracao
    // media, porque damageStructure ja encerrou o jogo neste ponto.
    state.lastAnyStructureDestroyedAtSec = state.gameTimeSec;
    // Draw 2 (existente): selectKiller -- POSICAO PRESERVADA (D-06).
    // nexusExposed = bypass total; hasBaronOrHerald=true abre distribuicao (D-06 compat).
    // STR-06: ator plausivel por lane/fase antes do draw.
    const hasGankCtxNexus = deriveGankContext(state, side, lane);
    const hasBaronOrHeraldNexus = hasBaronBuff(state, side) || (state.objectives.heraldAlive && !state.objectives.heraldDone);
    const actor = selectKiller(buildStructureActorCandidates(team, lane, state.gameTimeSec, hasGankCtxNexus, hasBaronOrHeraldNexus), siegeCtx, rng);
    return baseEvent(state, dmg.kind, side, {
      actors: [shortName(actor.card)],
      lane,
      ticker: dmg.ticker(shortName(actor.card)),
    });
  }

  // --- Pool de dano acumulado (STR-01, STR-03) ---
  // Determinar o tier atual da lane inimiga
  const enemyLaneStructures = enemy.structures[lane];
  const tierField = currentTierField(enemyLaneStructures, enemy);
  const tierType = currentTierType(enemyLaneStructures, enemy);

  // Sem campo de pool: a proxima estrutura e um inibidor (nao uma torre).
  // Draw 2 e consumido via selectKiller antes de retornar (D-06: aridade preservada).
  if (tierField === null || tierType === null) {
    // FREIO GLOBAL CROSS-LANE NO CAMINHO DE INIBIDOR (STR-05, D-02; Fase 25,
    // plano 25-04). Este era o ultimo caminho de queda que nao LIA nem ESCREVIA
    // o instante global, e as duas metades importam: ler para nao derrubar
    // quando outro caminho ja derrubou neste tick, escrever para que os outros
    // caminhos respeitem esta queda.
    //
    // POR QUE ELE RESPEITA O FREIO EM VEZ DE ALTERA-LO: antes do canal absoluto,
    // dois caminhos de queda nunca resolviam no mesmo tick, porque o caminho do
    // gate escolhe UMA lane por tick. O freio media zero e este guarda seria
    // inalcancavel: ele e no-op em relacao ao comportamento pre-Fase-25. O que
    // mudou e que o canal absoluto percorre as tres lanes dos dois lados no
    // MESMO tick e resolve ANTES da interacao, entao passou a existir um estado
    // em que o instante global ja esta marcado quando este caminho e avaliado.
    // Nenhuma constante nova, nenhum limiar tocado, nenhum valor de freio
    // alterado: o guarda le o mesmo campo que cascadeDamageMultiplier ja le.
    //
    // POR QUE O SORTEIO FICA INCONDICIONAL: a aridade e contrato (D-06) e nao
    // pode depender do freio. Neste caminho a ordem e invertida em relacao ao
    // caminho do pool, onde selectKiller roda ANTES do bloco de queda: aqui a
    // queda vem primeiro e o sorteio depois. Um retorno antecipado antes da
    // chamada de queda pularia selectKiller e deslocaria a sequencia de sorteios
    // de toda partida em que o freio atuasse. Por isso o freio bloqueia apenas a
    // QUEDA, com a chamada de queda substituida por nada, e selectKiller e
    // consumido logo abaixo de qualquer forma, exatamente como sempre foi.
    const freioAtivo = state.lastAnyStructureDestroyedAtSec === state.gameTimeSec;
    const dmgDirect = freioAtivo
      ? null
      : damageStructure(state, side, enemy, lane, baron ? 1.0 : 0.7);
    if (dmgDirect) state.lastAnyStructureDestroyedAtSec = state.gameTimeSec;
    // Draw 2 (existente): selectKiller -- SEMPRE consumido apos o gate (D-06).
    // STR-06: ator plausivel por lane/fase antes do draw; STR-06 candidatos calculados antes do draw.
    const hasGankCtxDirect = deriveGankContext(state, side, lane);
    const hasBaronOrHeraldDirect = hasBaronBuff(state, side) || (state.objectives.heraldAlive && !state.objectives.heraldDone);
    const actorDirect = selectKiller(buildStructureActorCandidates(team, lane, state.gameTimeSec, hasGankCtxDirect, hasBaronOrHeraldDirect), siegeCtx, rng);
    if (!dmgDirect) return null;
    return baseEvent(state, dmgDirect.kind, side, {
      actors: [shortName(actorDirect.card)],
      lane,
      ticker: dmgDirect.ticker(shortName(actorDirect.card)),
    });
  }

  // Calcular o dano desta iteracao pela formula multiplicativa
  const waveMultiplier = deriveWaveMultiplier(state, side, lane);
  // siegeThreat: 1.0 base + 0.3 se o comp tem poke/ranged tag
  const hasPoke = team.compProfile.dominantTags.includes("poke");
  const siegeThreat = hasPoke ? 1.3 : 1.0;
  // numbersAdvantage: 1.0 em 5v5; +0.15 por aliado extra vivo vs inimigo vivo
  const myAlive = aliveCount(team);
  const theirAlive = aliveCount(enemy);
  const extraAllies = Math.max(0, myAlive - theirAlive);
  const numbersAdvantage = Math.max(0.6, 1.0 + extraAllies * 0.15);
  // timePlausibility: curva sigmoide por tier e tempo
  const timePlausibility = structureTimePlausibility(tierType, state.gameTimeSec);
  // structureTierModifier: resistencia por tier
  const structureTierModifier = tierModifierFor(tierType);
  // objectiveBuffModifier: baron +0.5, voidgrubs +0.04 cada, elder +0.1
  const hasElderBuff =
    state.buffs.elderUntilSec[side] !== null &&
    (state.buffs.elderUntilSec[side] as number) > state.gameTimeSec;
  const objectiveBuffModifier = 1.0 +
    (baron ? 0.5 : 0) +
    team.voidgrubs * 0.04 +
    (hasElderBuff ? 0.1 : 0);

  // Acessar o pool de dano do time inimigo nesta lane (necessario antes de montar factors -- STR-05)
  const pool = enemy.structureDamage[lane];

  // cascadeBreakMultiplier: freio de cascata rng-free (STR-05, D-01)
  const bypass = deriveBypass(state, side, enemy);
  const cascadeBreakMultiplier = cascadeDamageMultiplier(pool, state, side, bypass);

  // Contexto de ator estrutural plausivel (STR-06, D-04/D-05/D-06): calculado ANTES do draw.
  // hasGankCtx: vantagem numerica || lane lead alto (opcao A+C, rng-free).
  // hasBaronOrHerald: Baron ativo OU Herald disponivel (macro plausivel para ADC/abertura D-06).
  const hasGankCtxPool = deriveGankContext(state, side, lane);
  const hasBaronOrHeraldPool = hasBaronBuff(state, side) || (state.objectives.heraldAlive && !state.objectives.heraldDone);

  const factors: StructureDamageFactors = {
    // CONSTANTE BASE DO CAMINHO DO GATE. Valor escolhido por sweep de UMA alavanca
    // (Fase 25, plano 25-05, Task 2). Registro completo, com a tabela de todos os
    // pontos, em docs/diagnostics/25-sweep.md, secao 2.
    //
    // O VALOR ANTIGO ERA 45, e a razao dele era "calibrado para p50 cerca de 9 min
    // no equilibrado (D-03)": calibracao da Fase 17, feita para uma engine em que
    // ESTE caminho era a unica fonte de dano estrutural. A Fase 25 acrescentou o
    // canal absoluto (accrueSiegePressure), e com duas fontes somando no mesmo pool
    // a calibracao de fonte unica passou a entregar magnitude demais cedo demais.
    //
    // O QUE A REDUCAO CONSERTA: o assert duro de primeira torre antes de 7:00 do
    // gate de ritmo (calibrate-pace.ts, fonte STACK.md secao 7, minimo absoluto
    // observado de 8:15 em 500 jogos pro). Com base 45 ele media 8 violacoes no
    // tier GAP-30; com base 27 mede ZERO nos seis tiers.
    //
    // A ARITMETICA, do 25-RESEARCH.md Achado 6, que e o que prova que o conserto
    // veio da MAGNITUDE e nao de afrouxar regra nenhuma. Aos 6:30 a curva
    // structureTimePlausibility("outer", 390) vale 0,6792, ou seja ja liberou 68
    // por cento do dano. Num 90x60 o caso normal e wave 1,4, numbersAdvantage
    // 1,15, tierMod 1,0 e objBuff 1,12 (as tres larvas do Vazio, que nascem as
    // 5:00). O produto dos fatores sem a base vale 1,2247:
    //
    //   base 45: 45 x 1,2247 = 55,1 de dano por passagem -> 100/55,1 = 1,81
    //            passagens para derrubar a torre. DUAS passagens antes de 6:30
    //            derrubam a primeira torre, e num gap de 30 a forca fica acima do
    //            limiar desde os 5:00, entao duas passagens em seis minutos e
    //            trivial. Dai as violacoes.
    //   base 27: 27 x 1,2247 = 33,1 de dano por passagem -> 100/33,1 = 3,02
    //            passagens. Tres passagens antes de 6:30 nao acontecem.
    //
    // A CURVA TEMPORAL DE PLAUSIBILIDADE NAO FOI TOCADA, e isso e o ponto central:
    // structureTimePlausibility, cascadeDamageMultiplier, as quatro constantes de
    // cascata, deriveBypass, buildStructureActorCandidates e a rampa de fim de jogo
    // seguem com os mesmos valores. base e gate de MAGNITUDE, nao de plausibilidade.
    //
    // PONTOS MEDIDOS, cada um com os dois gates completos e a taxa do canal parada
    // em 2,2 (a alavanca da Task 1, commitada antes e nao tocada aqui):
    //
    //   | base | 7:00 nos seis tiers | passagens aos 6:30 | torres/min | placas |
    //   | 45   | 8 (GAP-30)          | 1,81               | 0,331      | 9,751  |
    //   | 36   | 2 (PRO-GAP 1, GAP-30 1) | 2,27           | 0,327      | 9,989  |
    //   | 33   | 0                   | 2,47               | 0,327      | 10,105 |
    //   | 30   | 0                   | 2,72               | 0,324      | 10,180 |
    //   | 27   | 0  <- escolhido     | 3,02               | 0,321      | 10,279 |
    //   | 22,5 | 0                   | 3,63               | 0,315      | 10,394 |
    //
    // AUMENTAR ESTA CONSTANTE E PROIBIDO, e o numero que fecha o assunto esta em
    // docs/diagnostics/25-caminhos-descartados.md: base 90 da mais 15 por cento de
    // torres/min mas derruba as placas de 0,76 para 0,36, leva o corte do pool a 41
    // por cento e reintroduz violacao de 7:00.
    //
    // POR QUE 27 E NAO 30, que era a recomendacao da pesquisa: a pesquisa mediu
    // base 36 zerando as violacoes, mas mediu isso ANTES do canal absoluto existir.
    // Com o canal em 2,2 a base 36 volta a violar (2 violacoes, e uma delas num
    // tier que estava limpo, o PRO-GAP), e o maior valor que ainda zera e 33. Ou
    // seja 30 e apenas um passo abaixo da fronteira: ele aguenta a magnitude do
    // caminho do gate crescer so 13 por cento antes de a violacao voltar, contra 26
    // por cento em 27. Como o termo de vantagem do plano 25-06 (removido na spec 2026-10-02) ACRESCENTAVA magnitude
    // exatamente no lado que viola (o lado forte do GAP-30), 27 e o ponto que deixa
    // margem em vez de deixar a fase na fronteira.
    //
    // Spec 2026-10-02-calendario-e-volume (Task 7): o 27 virou o campo de tuning
    // pressSiegeBase (padrao 27, comportamento identico no padrao) para a varredura
    // poder medir o press de rota. A medicao mostrou o contrario do esperado: mais
    // press NAO aumentou as torres por partida (encurtou a partida e as torres
    // cairam), entao o valor ficou em 27 e o campo existe so para a
    // reprodutibilidade das varreduras registradas em
    // docs/diagnostics/calendario-e-volume-calibracao.md, secoes 6, 8 e 10.
    base: state.tuning.pressSiegeBase,
    waveMultiplier,
    siegeThreat,
    numbersAdvantage,
    timePlausibility,
    structureTierModifier,
    objectiveBuffModifier,
    cascadeBreakMultiplier,
  };
  const dmgAmount = computeStructureDamage(factors) * turretDamageFactor(state, tierType);
  pool.lastStructureDamageAtSec = state.gameTimeSec;

  // Capturar o valor do pool ANTES de somar (para detectar cruzamentos de limiar)
  const poolBefore = pool[tierField];
  // Regra dura de 7:00: antes de 420 s o pool para logo abaixo de 100 e nao ha queda.
  const poolAfter = holdPoolBeforeTowerWindow(
    poolBefore,
    Math.min(100, poolBefore + dmgAmount),
    state.gameTimeSec
  );
  pool[tierField] = poolAfter;

  // Draw 2 (existente): selectKiller -- SEMPRE consumido apos o gate (D-06).
  // Preservar aridade identica ao original: o draw acontece em toda gate-passagem,
  // independente de queda, plate_taken ou tower_low. O resultado e usado nos
  // eventos visiveis quando disponivel.
  // STR-06: candidatos filtrados por lane/fase ANTES do draw (D-07: 1 draw exato, aridade preservada).
  const actor = selectKiller(buildStructureActorCandidates(team, lane, state.gameTimeSec, hasGankCtxPool, hasBaronOrHeraldPool), siegeCtx, rng);
  const actorName = shortName(actor.card);

  // --- Queda da estrutura: pool >= 100 ---
  // So aqui chamamos damageStructure (Pitfall 3: sem chamada direta anterior).
  if (poolAfter >= 100) {
    // FREIO GLOBAL CROSS-LANE, O MESMO GUARDA QUE O CANAL ABSOLUTO APLICA
    // (STR-05, D-02; acrescentado na Fase 25, plano 25-04).
    //
    // Este guarda e o par simetrico do que existe em accrueSiegePressure, e ele
    // precisa existir NOS DOIS caminhos porque o canal absoluto roda ANTES da
    // resolucao de interacao dentro do mesmo tick: sem ele, o canal derruba uma
    // torre e o caminho do gate derruba outra no mesmo instante, e o gate duro
    // STR-05b (torres de lanes diferentes com intervalo menor que 15 s no tier
    // STOMP-FORTE, exigido igual a zero) volta a medir violacao.
    //
    // Ele e no-op em relacao ao comportamento anterior a Fase 25: com o canal
    // absoluto desligado, o caminho do gate nunca derrubou duas torres no mesmo
    // tick, e o gate media zero. O guarda le o MESMO campo de estado que o freio
    // global usa, nao acrescenta constante e nao muda a aridade: os dois sorteios
    // do caminho do gate ja foram consumidos acima. A estrutura cai no tick
    // seguinte, com o pool preservado.
    if (state.lastAnyStructureDestroyedAtSec === state.gameTimeSec) return null;

    // Resetar o pool do tier que caiu (Pitfall 2: sem acumulo duplo)
    pool[tierField] = 0;
    pool.lastStructureDestroyedAtSec = state.gameTimeSec;
    // Freio global cross-lane: setar o timestamp global junto com o por-lane (D-02, STR-05)
    state.lastAnyStructureDestroyedAtSec = state.gameTimeSec;

    const dmg = damageStructure(state, side, enemy, lane, baron ? 1.0 : 0.7);
    if (!dmg) return null;
    return baseEvent(state, dmg.kind, side, {
      actors: [actorName],
      lane,
      ticker: dmg.ticker(actorName),
    });
  }

  // --- Evento menor: uma unica consulta ao classificador de cruzamento ---
  // A decisao de QUAL evento menor corresponde a este cruzamento vive em
  // classifyStructureCrossing, extraida no plano 25-03, chamada aqui e, a
  // partir da Fase 25, tambem pelo canal absoluto. A regra nunca e duplicada:
  // os dois caminhos consultam a mesma funcao. Os efeitos colaterais ficam aqui.
  const crossing = classifyStructureCrossing(tierType, state.gameTimeSec, poolBefore, poolAfter);

  // --- Evento visivel: plate_taken (abstracao leve, D-02) ---
  const plates =
    crossing === "plate" ? collectPlates(state, side, lane, tierType, platesAt(poolAfter) - platesAt(poolBefore)) : 0;
  if (plates > 0) {
    return baseEvent(state, "plate_taken", side, {
      actors: [actorName],
      lane,
      ticker: plateTicker(actorName, lane, tierType, team.name, plates, crossesTowerLow(poolBefore, poolAfter)),
    });
  }

  // --- Evento visivel: tower_low ---
  if (crossing === "tower_low") {
    return baseEvent(state, "tower_low", side, {
      actors: [actorName],
      lane,
      ticker: `Torre ${placeLabel(lane)} do ${enemy.name} em estado critico! ${actorName} lidera o siege.`,
    });
  }

  // Pool acumulado mas sem evento visivel neste tick (tower_chipped interno, D-01).
  // Os dois draws (force e selectKiller) ja foram consumidos acima.
  return null;
}

/**
 * Aplica o Arauto na lane de maior pressao do time, danificando a proxima
 * estrutura.
 *
 * Extraido de engine.ts:694-724 (D-05, plano 17-01). No-op: o draw de
 * selectKiller permanece apos damageStructure, na mesma ordem.
 */
export function resolveHeraldUse(
  state: MatchState,
  side: Side,
  rng: () => number
): SimEvent | null {
  const team = teamOf(state, side);
  const enemy = teamOf(state, opponent(side));
  // Use Herald on the lane with the most pressure for this side.
  const lane = bestPressureLane(state, side);

  // [D-02 / OBJ-01] Checar se a proxima estrutura da lane e Nexus turret ANTES de chamar
  // damageStructure. Replica inline a logica de currentTierType (funcao privada) para
  // evitar export e risco de import circular (Recomendacao da Pergunta Aberta 3 do RESEARCH).
  //
  // Logica fiel a currentTierType (structures.ts:479-493):
  //   outer > inner > inhibTurret > (inhibitor ativo = null) > nexusTurret > null
  // A Nexus turret e a proxima quando outer/inner/inhibTurret caem E o inibidor nao esta ativo
  // (inhibitorAlive=false, ou inibidor em respawn com inhibitorRespawnAtSec != null).
  const enemyLane = enemy.structures[lane];
  let isNexusTurret = false;
  if (!enemyLane.outerAlive && !enemyLane.innerAlive && !enemyLane.inhibTurretAlive) {
    // O inibidor esta "ativo" (bloqueando) apenas quando inhibitorAlive===true E
    // inhibitorRespawnAtSec===null. Em qualquer outro caso, a proxima estrutura e nexusTurret.
    const inhibitorActive = enemyLane.inhibitorAlive && enemyLane.inhibitorRespawnAtSec === null;
    if (!inhibitorActive && enemy.nexusTurretsAlive > 0) {
      isNexusTurret = true;
    }
  }

  // [D-07 / Armadilha 5] O draw de selectKiller DEVE ser consumido em AMBOS os caminhos
  // para preservar a aridade de RNG (INV-1).
  const siegeCtxHerald: FightContext = {
    eventType: "kill",
    minute: state.gameTimeSec / 60,
    state,
    lane,
    goldLead: (side === "user" ? 1 : -1) * (state.user.gold - state.rival.gold),
    teamDeaths: state.user.deaths + state.rival.deaths,
    lowHpTargets: false,
    killerTeamComp: team.compProfile,
    gameSec: state.gameTimeSec,
  };
  const hasGankCtxHerald = deriveGankContext(state, side, lane);
  const hasBaronOrHeraldForHerald = true; // Herald em uso = macro ativo -> distribuicao aberta (D-06)
  // STR-06: ator plausivel por lane/fase ANTES do draw (D-07: aridade preservada).
  const actor = selectKiller(buildStructureActorCandidates(team, lane, state.gameTimeSec, hasGankCtxHerald, hasBaronOrHeraldForHerald), siegeCtxHerald, rng);

  if (isNexusTurret) {
    // Caminho nexusTurret (D-02 / OBJ-01): emitir pressao de base (tower_low) sem destruir.
    // NAO chamar damageStructure -- a Nexus turret resiste ao Arauto.
    // O draw de selectKiller ja foi consumido acima (aridade preservada, D-07).
    // Nenhum draw novo, nenhum EventKind novo, sem travessao no ticker.
    team.heraldUsed = true;
    return baseEvent(state, "tower_low", side, {
      actors: [shortName(actor.card)],
      lane,
      ticker: `${shortName(actor.card)} invocou o Arauto ${placeLabel(lane)}, mas a base do ${enemy.name} resistiu ao impacto.`,
    });
  }

  // Caminho normal (outer / inner / inhibTurret / inhibitor): damageStructure aplica o dano
  // e muta o estado (queda real). O evento emitido e SEMPRE tower_low para TORRES, para que
  // o ticker do Herald nao aparea em kind="tower_destroyed" nem "first_tower" (criterio
  // OBJ-01 / heuristica A3). O fluxo de jogo (towersDestroyed, firstTurretDone, momentum)
  // acontece dentro de damageStructure antes de retornar.
  const dmg = damageStructure(state, side, enemy, lane, 1.0);
  team.heraldUsed = true;
  if (!dmg) return null;
  // [Rule 1 - bug, 27-05] O rebaixamento para tower_low so vale para TORRES. Quando o Arauto
  // e o golpe que destroi o INIBIDOR, dmg.kind e "inhibitor_destroyed" -- um evento
  // estruturalmente significativo que a suite trata como gate de win-condition (ver
  // structures.test.ts "ordering: nexus_exposed precedes gg, and an inhibitor falls before
  // any Nexus turret"): nexus_exposed so pode ocorrer depois de UM inhibitor_destroyed
  // aparecer na timeline. Antes deste fix, o Arauto podia destruir o inibidor com o estado
  // mutado corretamente mas o EVENTO sempre rebaixado para tower_low, apagando a prova na
  // timeline sem quebrar o estado -- daí nexus_exposed aparecendo sem nenhum
  // inhibitor_destroyed antecedente. dmg.kind so pode ser "first_tower"/"tower_destroyed"
  // (rebaixados) ou "inhibitor_destroyed" (preservado) neste ponto: o guarda isNexusTurret
  // acima ja impede damageStructure de alcancar nexusTurret/nexus_exposed/gg por este caminho.
  const isTowerKind = dmg.kind === "first_tower" || dmg.kind === "tower_destroyed";
  return baseEvent(state, isTowerKind ? "tower_low" : dmg.kind, side, {
    actors: [shortName(actor.card)],
    lane,
    ticker: `${shortName(actor.card)} invocou o Arauto ${placeLabel(lane)} e ${dmg.label}.`,
  });
}

// ---------------------------------------------------------------------------
// Concentracao de rota do canal absoluto (FORM-01 e PACE-02, Fase 25B plano 25B-03)
// ---------------------------------------------------------------------------

/**
 * TEMPERATURA DA CONCENTRACAO DE ROTA, em pontos de `state.pressure`.
 *
 * ESTA E A ALAVANCA DA FASE 25B, e o ponto de operacao dela e escolhido por sweep
 * no plano seguinte. Este plano fixa um valor de partida declarado e medido.
 *
 * O QUE ELA CONTROLA: quantos pontos de vantagem de pressao valem um fator `e` de
 * dano a mais naquela rota. Temperatura alta espalha (o limite e o comportamento
 * de hoje), temperatura baixa concentra (o limite e todo o dano numa rota so).
 * **Uma unica constante percorre a familia inteira, das duas pontas**, e foi isso
 * que decidiu a forma fechada: as duas formas que o desenho mandava comparar,
 * espalhar com inclinacao e concentrar por inteiro, sao os dois extremos DESTA
 * constante, e nao dois mecanismos diferentes.
 *
 * A ANCORA DA ESCALA, e ela nao e de gosto: em `recomputePressure`
 * (src/sim/engine.ts) a queda da torre externa de uma rota vale exatamente **12**
 * pontos de pressao naquela rota, e e o menor evento estrutural que
 * legitimamente diz "esta e a rota que abriu". As outras ancoras do mesmo
 * leitor, para dimensionar: inibidor caido vale 20 e o buff de Baron vale 14 (e
 * igual nas tres rotas, entao ele se cancela na normalizacao).
 *
 * A ARITMETICA DO VALOR DE PARTIDA, escrita com a medicao ao lado. Com uma rota
 * exatamente uma torre externa a frente das outras duas (12 pontos), os tres
 * pesos ficam:
 *
 *   | T  | peso da rota a frente | peso das outras duas | razao |
 *   | 12 | 1,73                  | 0,64                 | 2,7   |
 *   | 8  | 2,01                  | 0,50                 | 4,0   |
 *   | 6  | 2,23                  | 0,39                 | 5,7   |
 *   | 4  | 2,54                  | 0,23                 | 11,1  |
 *   | 3  | 2,70                  | 0,15                 | 18,3  |
 *
 * O PONTO DE OPERACAO E T = 9, E ELE E O MENOR VALOR QUE RESPEITA A REGRA DURA SEM
 * DERRUBAR NENHUMA BANDA QUE ESTAVA VERDE. A grade esta na secao 3 de
 * docs/diagnostics/25B-sweep.md e o retrato completo deste ponto na secao 6.
 *
 * DUAS TRAVAS INFERIORES, medidas, e as duas apareceram DEPOIS da grade de bandas:
 *
 * 1. **REGRA DURA, nao negociavel:** o assert `primeira torre antes de 7:00 igual a
 *    zero`, exigido nos seis tiers (`STACK.md` secao 7: minimo absoluto observado de
 *    8:15 em 500 jogos pro). Contador do tier PRO-GAP em 800 partidas:
 *
 *      | T    | 4 | 5 | 6 | 6,5 | 7 | 8 | 9 | 10 | 12 | 14 |
 *      | 7:00 | 1 | 1 | 1 |  1  | 1 | 0 | 0 |  0 |  0 |  0 |
 *
 *    Concentrar dano numa rota so ACELERA a primeira queda, e o tier de gap ja e o
 *    que chega mais cedo. Zero absoluto significa zero: `T` maior ou igual a 8.
 *
 * 2. **BANDA QUE ESTAVA VERDE:** `Baron no spawn por partida`
 *    (`scripts/calibrate-objectives.ts`, dono Fase 19, banda `[0,020; 0,240]`) mede
 *    **0,250 em T = 8** e volta a passar em T = 9. Partida mais curta e progresso
 *    estrutural mais rapido tornam o Baron no spawn mais frequente. Afrouxar a banda
 *    esta proibido pela regra de fechamento por dono (`scripts/README.md` secao 5.1),
 *    entao a trava e `T` maior ou igual a 9.
 *
 * O QUE T = 9 ENTREGA, medido no tier EQUILIBRADO com N = 800:
 *   - regras duras em ZERO ABSOLUTO nos seis tiers, e nenhum gate que estava verde
 *     ficou vermelho;
 *   - as SEIS bandas de nivel DENTRO: torres/min 0,357, torres aos 20:00 4,760,
 *     mediana da primeira torre 840 s, placas 11,275, duracao 29,99 min e razao de
 *     torres 3,689 (alvo 3,350);
 *   - QUATRO das sete bandas de FORMA dentro: vencedor no maximo do contador 0,134,
 *     tres rotas 0,134, 9 a 0 exato 0,029 e bimodalidade das torres do vencedor
 *     0,441 (alvo 0,459);
 *   - DUAS das tres bandas de dispersao com dono desta fase dentro: torres do
 *     vencedor 0,921 e torres por minuto 0,819.
 *
 * O QUE FICA DE FORA E DE QUEM E: `vitoria com UMA rota limpa` mede 0,366 contra o
 * piso 0,500 e so entraria em `T` menor ou igual a 6,5, ou seja **dentro da faixa
 * proibida pela regra dura**. Essa e a fronteira que esta fase NAO fecha com esta
 * alavanca. Shutout (0,497) e bimodalidade do PERDEDOR (0,606) nao respondem a esta
 * alavanca em faixa nenhuma: eram do termo de vantagem, da onda 5 (removido na spec 2026-10-02).
 *
 * O QUE ELA NAO PODE SER: zero ou negativa. Zero e o limite binario e ele foi
 * MEDIDO e recusado (secao 3 do sweep): ele concentra desde o tique zero por
 * desempate arbitrario, o que apagaria a identidade em pressao uniforme que
 * preserva o inicio de partida.
 */
export const SIEGE_FOCUS_TEMPERATURE = 9;

/** Vantagem de pressao do lado indicado naquela rota (`state.pressure` e assinado, mais favorece user). */
function laneAdvantageFor(state: MatchState, side: Side, lane: Lane): number {
  return side === "user" ? state.pressure[lane] : -state.pressure[lane];
}

/**
 * CONCENTRACAO DE ROTA DO CANAL ABSOLUTO (FORM-01, PACE-02).
 *
 * Multiplicador por ROTA aplicado ao dano do canal absoluto, na mesma expressao
 * que ja carregava o termo de vantagem estrutural (removido na spec 2026-10-02). Ele REDISTRIBUI o dano do canal
 * entre as tres rotas, favorecendo aquela em que o lado ja tem vantagem de
 * pressao, e NAO muda o total por tick.
 *
 * O DEFEITO QUE ELE CONSERTA, com a atribuicao fechada por leitura de codigo e
 * confirmada por medicao. `accrueSiegePressure` percorre `for (const side)` e,
 * dentro, `for (const lane of LANES)`: o canal empurra AS TRES ROTAS EM PARALELO,
 * todo tick, para os dois lados. Um time de verdade escolhe uma rota e concentra;
 * este espalha, entao as tres progridem juntas e quando uma fica funda as tres
 * ficam. Medido no fechamento da Fase 25: o vencedor termina com as tres rotas
 * limpas em 90,8 por cento das partidas e a distribuicao de torres dele vira
 * massa pontual em 9, o que contradiz o invariante escrito no cabecalho de
 * src/sim/structures.test.ts (para vencer basta limpar por inteiro UMA rota).
 *
 * **O DEFEITO NUNCA FOI O VENCEDOR DESTRUIR DEMAIS: E ELE PRECISAR DE NOVE TORRES
 * PARA VENCER.** Essa distincao e o que descartou o mecanismo anterior. O
 * DECAIMENTO do canal por caminho de vitoria aberto foi implementado, medido e
 * REVERTIDO neste mesmo plano: ele reduz throughput UNIFORMEMENTE, o que alonga a
 * partida sem encurtar o caminho ate o Nexo, e custou 10,48 minutos de duracao
 * contra uma folga de 0,42. O registro completo, com a grade vazia demonstrada,
 * esta em docs/diagnostics/25B-sweep.md secoes 1 e 2. **Nao reintroduzir
 * decaimento de throughput em nenhuma variante.**
 *
 * A FONTE E `state.pressure`, E ELA JA EXISTE. E o mesmo campo que
 * `bestPressureLane` (src/sim/engine.ts) le para escolher a rota de macro, ou
 * seja a concentracao do canal passa a olhar exatamente o mesmo sinal que o resto
 * do motor ja usa para decidir onde o jogo esta acontecendo. Ele agrega, num
 * numero por rota, a diferenca de poder de rota, a vantagem persistente
 * (`laneLead`), a torre externa caida, o inibidor caido e o buff de Baron.
 * Escolher `laneLead` puro foi medido e recusado: ele ignora o progresso
 * ESTRUTURAL, que e justamente o sinal que diz qual rota ja abriu.
 *
 * FORMA FECHADA: peso proporcional a exponencial da vantagem de pressao daquela
 * rota dividida pela temperatura, normalizado para que os tres pesos somem
 * exatamente o numero de rotas. Tres propriedades saem dessa forma de graca, e as
 * tres sao contrato verificado por teste:
 *
 *   1. **Media exatamente 1, ou seja REDISTRIBUICAO e nunca reducao.** Os tres
 *      pesos somam exatamente 3 por construcao, entao a concentracao nao
 *      acrescenta nem subtrai throughput por tick. E isso que a separa do
 *      decaimento refutado e o que faz dela uma alavanca de FORMA com custo de
 *      nivel proximo de zero por construcao.
 *   2. **Identidade em pressao uniforme.** Com as tres rotas na mesma vantagem os
 *      tres expoentes sao iguais, e o peso de cada uma e exatamente 1. Esse e o
 *      estado do inicio da partida num fixture espelhado: o inicio fica byte a
 *      byte com o de hoje e o encurtamento da Fase 25 nao e devolvido. **Isso
 *      tambem elimina o desempate arbitrario**, que e o defeito da variante
 *      binaria: sem diferenca de pressao nao ha rota escolhida, e nao ha trilho.
 *   3. **A familia inteira numa constante so.** Temperatura grande tende ao
 *      comportamento de hoje (espalhar), temperatura tendendo a zero tende a
 *      concentrar todo o dano numa rota. As duas formas que o desenho mandava
 *      comparar sao os dois limites da MESMA forma fechada.
 *
 * A subtracao do maior expoente antes da exponencial e a guarda numerica padrao
 * do quociente exponencial: ela nao muda o resultado (o fator comum cancela na
 * normalizacao) e impede estouro com vantagens grandes e temperatura pequena.
 *
 * CONTRATO DE SORTEIO, GARANTIDO PELA ASSINATURA (INV-1). A funcao recebe apenas
 * estado, lado e rota. Ela nao tem o gerador, logo nao pode consumi-lo.
 *
 * ONDE ELE NAO ENTRA, E ISSO E CONTRATO: o termo multiplica o dano DO CANAL
 * ABSOLUTO e nao aparece em nenhum ponto do caminho do gate de pressao
 * estrutural, que continua byte a byte intacto.
 */
export function siegeLaneFocus(state: MatchState, side: Side, lane: Lane): number {
  let maior = -Infinity;
  for (const l of LANES) {
    const v = laneAdvantageFor(state, side, l);
    if (v > maior) maior = v;
  }

  let soma = 0;
  for (const l of LANES) {
    soma += Math.exp((laneAdvantageFor(state, side, l) - maior) / SIEGE_FOCUS_TEMPERATURE);
  }

  const bruto = Math.exp((laneAdvantageFor(state, side, lane) - maior) / SIEGE_FOCUS_TEMPERATURE);
  return (LANES.length * bruto) / soma;
}

/**
 * Passo de tempo usado para derivar o indice de tick da rotacao de ator.
 *
 * O MatchState nao carrega o passo de tick (ele vive em SimConfig e e lido pelo
 * laco de simulacao), entao a rotacao usa o passo padrao do modulo de estado,
 * que e o valor usado por todos os chamadores da engine hoje. Se algum dia um
 * chamador simular com passo diferente, a rotacao apenas gira mais devagar ou
 * mais depressa: ela nao muda o dano, nao muda a lista de candidatos e nao
 * atravessa a fronteira de plausibilidade de ator.
 */
const SIEGE_ACTOR_ROTATION_STEP_SEC = DEFAULT_SIM_CONFIG.tickSeconds;

/** Deslocamento de rotacao por lane, para que as tres lanes nao escolham o mesmo indice. */
const SIEGE_LANE_ROTATION_OFFSET: Record<Lane, number> = { top: 0, mid: 1, bot: 2 };

/** Deslocamento de rotacao por lado, para que os dois lados nao andem em fase. */
const SIEGE_SIDE_ROTATION_OFFSET: Record<Side, number> = { user: 0, rival: 1 };

/**
 * Escolhe o ator de um evento do canal absoluto por INDICE DETERMINISTA sobre a
 * lista de candidatos plausiveis, sem consumir sorteio.
 *
 * A lista vem de buildStructureActorCandidates, a MESMA funcao que o caminho do
 * gate usa, com o mesmo contexto de gank e a mesma condicao de macro plausivel.
 * O filtro de ator plausivel (STR-06: support excluido no early, ADC so na bot,
 * jungler so sob gank) e portanto herdado por construcao, nunca reimplementado.
 *
 * POR QUE HA ROTACAO, E NAO O PRIMEIRO CANDIDATO: escolher sempre o indice 0
 * colapsaria o canal numa unica rota por lane. A rotacao gira com o indice de
 * tick, com deslocamento por lane e por lado.
 *
 * MEDICAO DA DISTRIBUICAO (25-RESEARCH.md, Achado 5; quedas antes de 14:00,
 * 75x75, N=300). Sob acumulo a distribuicao por rota fica MAIS uniforme que
 * hoje, e o gate de ator plausivel nao se degrada:
 *
 *   |                 | top   | jungle | mid   | adc   | support | ator early correto | ADC fora de lane |
 *   | baseline        | 12,2% | 43,9%  | 22,0% | 22,0% | 0,0%    | 100,0%             | 0,0%             |
 *   | taxa 2, acumulo | 23,3% | 24,4%  | 31,1% | 21,1% | 0,0%    | 100,0%             | 0,0%             |
 *
 * O jungler cai de 43,9 para 24,4 por cento, o suporte fica em 0,0 por cento e o
 * ADC fora de lane em 0,0 por cento, com o gate de ator plausivel em 100 por cento.
 *
 * REGISTRO HONESTO: a forma exata da rotacao e escolha de engenharia. O numero
 * acima prova que ela nao PIORA o gate (que ja estava em 100 por cento), nao que
 * ela seja narrativamente boa. A leitura narrativa da rotacao no playback precisa
 * de verificacao humana no fechamento da fase (suposicao A2 da pesquisa).
 *
 * O SUPORTE FICA FORA DA ROTACAO ENQUANTO HOUVER OUTRO CANDIDATO, e essa e a
 * parte que precisa da justificativa mais cuidadosa. A lista NAO e alterada: o
 * ator continua saindo dela e o filtro continua sendo o de
 * buildStructureActorCandidates. O que a rotacao faz e o analogo determinista da
 * PONDERACAO que selectKiller aplica no caminho do gate, e que o canal absoluto
 * nao pode usar porque ela consome sorteio.
 *
 * Por que ela e obrigatoria, com o numero medido: antes de 14:00 a lista ja
 * exclui o suporte por construcao, mas a partir de 14:00 ela devolve todos os
 * vivos. Uma rotacao uniforme sobre cinco vivos daria ao suporte cerca de um
 * quinto de todas as quedas de estrutura, e o gate STR-06b do harness estrutural
 * (suporte como ator de queda, EQUILIBRADO, limite abaixo de 5 por cento) mediu
 * 9,5 por cento com a rotacao uniforme, contra o gate verde antes desta fase.
 * O gate NAO foi afrouxado: a rotacao e que passou a respeitar a ponderacao que
 * o caminho do gate sempre aplicou. O suporte volta a ser elegivel quando e o
 * unico candidato, que e o caso plausivel de credita-lo.
 *
 * Retorna null quando nao ha candidato: nesse caso o chamador nao aplica dano e
 * nao emite evento. Nunca inventar ator fora da lista.
 */
export function pickDeterministicSiegeActor(
  state: MatchState,
  team: TeamState,
  side: Side,
  lane: Lane
): string | null {
  const hasGankCtx = deriveGankContext(state, side, lane);
  const hasBaronOrHerald =
    hasBaronBuff(state, side) || (state.objectives.heraldAlive && !state.objectives.heraldDone);
  const candidates = buildStructureActorCandidates(
    team,
    lane,
    state.gameTimeSec,
    hasGankCtx,
    hasBaronOrHerald
  );
  if (candidates.length === 0) return null;

  // Analogo determinista da ponderacao de selectKiller (ver o cabecalho): o
  // suporte so entra na rotacao quando e o unico candidato da lista.
  const semSuporte = candidates.filter((p) => p.role !== "support");
  const rotacionaveis = semSuporte.length > 0 ? semSuporte : candidates;

  const tickIndex = Math.floor(state.gameTimeSec / SIEGE_ACTOR_ROTATION_STEP_SEC);
  const rotation =
    tickIndex + SIEGE_LANE_ROTATION_OFFSET[lane] + SIEGE_SIDE_ROTATION_OFFSET[side];
  const index = ((rotation % rotacionaveis.length) + rotacionaveis.length) % rotacionaveis.length;
  return shortName(rotacionaveis[index].card);
}

/**
 * CANAL ABSOLUTO DE CERCO (PACE-01, Fase 25 plano 25-04).
 *
 * Acumula dano de cerco nas tres lanes dos dois lados, emite os
 * eventos menores e derruba a estrutura por conta propria, uma vez por tick,
 * desacoplado do gate de pressao estrutural e portanto imune aos sete retornos
 * antecipados que ficam antes dele em resolveInteraction.
 *
 * Canal de cerco da fase de rota (spec 2026-10-02 secao 5): ate 14:00, empurra
 * placas e a torre externa pela vantagem de rota. Sem bola de neve por contagem de
 * torres: a vantagem estrutural vem da janela de conversao e do ouro. Rng-free.
 *
 * CONTRATO DE SORTEIO, GARANTIDO PELA ASSINATURA (INV-1). A funcao recebe APENAS
 * o estado. Ela nao tem o gerador, logo nao pode consuma-lo, e o diff prova isso
 * sozinho. Os dois consumos que existiriam num caminho ingenuo foram eliminados
 * por construcao: derrubar estrutura ja e operacao livre de gerador desde o plano
 * 25-03 (damageStructure nao recebe mais o parametro), e o ator vem de indice
 * determinista sobre a lista de candidatos, que ja era livre de gerador.
 *
 * O QUE ELA NAO FAZ, E ISSO E CONTRATO:
 *   - nao toca o lado cujo Nexus esta exposto: o fechamento de jogo continua
 *     sendo caminho exclusivo do gate, e por isso esta funcao NUNCA produz o
 *     evento de fim de jogo;
 *   - nao toca a lane cuja proxima estrutura e um inibidor: esse caminho tambem
 *     continua sendo do gate;
 *   - nao redefine nenhum fator de dano. Os oito fatores entram por CHAMADA as
 *     funcoes que ja existem. A curva temporal de plausibilidade, o modificador
 *     de tier e o freio de cascata (com o desvio de freio) entram INTACTOS: sao
 *     eles que garantem que nenhuma regra dura da v2.0 cede por este caminho;
 *   - nao duplica a regra de emissao de evento menor: ela consulta
 *     classifyStructureCrossing, a mesma funcao que o caminho do gate consulta.
 */
export function accrueSiegePressure(state: MatchState): SimEvent[] {
  const out: SimEvent[] = [];

  // Spec secao 5: o canal existe so na fase de rota (antes de 14:00) e so
  // na torre externa. Depois disso torre cai por janela de conversao, Barao/Anciao ou pressao.
  if (state.gameTimeSec >= TIMERS.MID_PHASE_AT) return out;

  for (const side of ["user", "rival"] as Side[]) {
    const team = teamOf(state, side);
    const enemy = teamOf(state, opponent(side));

    // Nexus exposto: o fechamento de jogo e caminho exclusivo do gate.
    if (enemy.nexusExposed) continue;

    const baron = hasBaronBuff(state, side);

    for (const lane of LANES) {
      const enemyLaneStructures = enemy.structures[lane];
      const tierField = currentTierField(enemyLaneStructures, enemy);
      const tierType = currentTierType(enemyLaneStructures, enemy);

      // Proxima estrutura nao e torre (inibidor ou fase de Nexus): caminho do gate.
      if (tierField === null || tierType === null) continue;
      if (tierType !== "outer") continue;

      // Ator escolhido ANTES de aplicar dano: lista vazia significa nenhum dano e
      // nenhum evento nesta lane neste tick.
      const actorName = pickDeterministicSiegeActor(state, team, side, lane);
      if (actorName === null) continue;

      const pool = enemy.structureDamage[lane];

      // Os oito fatores, cada um pela sua origem obrigatoria. Nenhum e redefinido
      // aqui e nenhum e copiado por valor.
      const hasElderBuff =
        state.buffs.elderUntilSec[side] !== null &&
        (state.buffs.elderUntilSec[side] as number) > state.gameTimeSec;
      const extraAllies = Math.max(0, aliveCount(team) - aliveCount(enemy));
      const factors: StructureDamageFactors = {
        base: state.tuning.siegeAccrualBase,
        waveMultiplier: deriveWaveMultiplier(state, side, lane),
        siegeThreat: team.compProfile.dominantTags.includes("poke") ? 1.3 : 1.0,
        numbersAdvantage: Math.max(0.6, 1.0 + extraAllies * 0.15),
        timePlausibility: structureTimePlausibility(tierType, state.gameTimeSec),
        structureTierModifier: tierModifierFor(tierType),
        objectiveBuffModifier:
          1.0 + (baron ? 0.5 : 0) + team.voidgrubs * 0.04 + (hasElderBuff ? 0.1 : 0),
        cascadeBreakMultiplier: cascadeDamageMultiplier(
          pool,
          state,
          side,
          deriveBypass(state, side, enemy)
        ),
      };
      // Concentracao de rota (FORM-01, plano 25B-03): mais um fator na MESMA
      // expressao, e nunca um desvio de fluxo. Ele REDISTRIBUI o dano entre as
      // tres rotas em vez de reduzi-lo: os tres pesos somam exatamente 3, entao o
      // total por tick nao muda e a alavanca e de FORMA e nao de nivel. Com as
      // tres rotas na mesma vantagem de pressao ele vale exatamente 1.
      const dmgAmount = computeStructureDamage(factors) * siegeLaneFocus(state, side, lane) * turretDamageFactor(state, tierType);

      pool.lastStructureDamageAtSec = state.gameTimeSec;
      const poolBefore = pool[tierField];
      // Regra dura de 7:00: antes de 420 s o pool para logo abaixo de 100 e nao ha queda.
      const poolAfter = holdPoolBeforeTowerWindow(
        poolBefore,
        Math.min(100, poolBefore + dmgAmount),
        state.gameTimeSec
      );
      pool[tierField] = poolAfter;

      // --- Queda da estrutura: pool >= 100 ---
      if (poolAfter >= 100) {
        // FREIO GLOBAL CROSS-LANE, HONRADO PELO CANAL NOVO (STR-05, D-02).
        //
        // O freio global e um MULTIPLICADOR de dano, e ele foi calibrado para um
        // chamador que resolve no maximo uma lane por tick (o caminho do gate
        // escolhe uma lane so). Este canal percorre as tres lanes dos dois lados
        // no MESMO tick, e nesse regime o multiplicador nao basta: uma lane cujo
        // pool ja estava perto de 100 cruza os 100 mesmo levando metade do dano,
        // e duas torres de lanes diferentes caem no mesmo instante.
        //
        // Medido, e por isso este guarda existe: sem ele o gate duro STR-05b do
        // harness estrutural (torres de lanes diferentes com intervalo menor que
        // 15 s no tier STOMP-FORTE, exigido igual a zero) mede 199 violacoes,
        // todas com intervalo exatamente zero, ou seja quedas do mesmo tick.
        //
        // O guarda le o MESMO campo de estado que o freio global usa e nao
        // acrescenta constante nenhuma: quando alguma estrutura ja caiu neste
        // exato instante de jogo, a queda desta lane e adiada. O pool fica em
        // 100 e a estrutura cai no tick seguinte, com o intervalo de um tick
        // inteiro. Nenhum limiar foi afrouxado e o freio nao foi tocado.
        if (state.lastAnyStructureDestroyedAtSec === state.gameTimeSec) continue;

        pool[tierField] = 0;
        pool.lastStructureDestroyedAtSec = state.gameTimeSec;
        // Freio global cross-lane alimentado do mesmo jeito que no caminho do gate.
        state.lastAnyStructureDestroyedAtSec = state.gameTimeSec;

        const dmg = damageStructure(state, side, enemy, lane, baron ? 1.0 : 0.7);
        if (dmg) {
          out.push(
            baseEvent(state, dmg.kind, side, {
              actors: [actorName],
              lane,
              ticker: dmg.ticker(actorName),
            })
          );
        }
        continue;
      }

      // --- Evento menor: uma unica consulta ao classificador de cruzamento ---
      const crossing = classifyStructureCrossing(
        tierType,
        state.gameTimeSec,
        poolBefore,
        poolAfter
      );

      const plates =
        crossing === "plate" ? collectPlates(state, side, lane, tierType, platesAt(poolAfter) - platesAt(poolBefore)) : 0;
      if (plates > 0) {
        out.push(
          baseEvent(state, "plate_taken", side, {
            actors: [actorName],
            lane,
            ticker: plateTicker(actorName, lane, tierType, team.name, plates, crossesTowerLow(poolBefore, poolAfter)),
          })
        );
        continue;
      }

      if (crossing === "tower_low") {
        out.push(
          baseEvent(state, "tower_low", side, {
            actors: [actorName],
            lane,
            ticker: `Torre ${placeLabel(lane)} do ${enemy.name} em estado critico! ${actorName} lidera o siege.`,
          })
        );
      }
    }
  }

  return out;
  // fim de accrueSiegePressure (contrato livre de sorteio)
}

