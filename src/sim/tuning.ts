/**
 * src/sim/tuning.ts
 *
 * Parametros calibraveis do motor (spec 2026-10-02-luta-mapa-vitoria). Cada campo tem um
 * valor padrao escolhido por varredura (scripts/sweep-realism.ts), com o registro em
 * docs/diagnostics/luta-mapa-vitoria-calibracao.md. O config de simulacao pode sobrescrever
 * qualquer campo (SimConfig.tuning), e e assim que a varredura mede pontos sem editar codigo.
 *
 * Rng-free e sem estado: so tipo, valores padrao, resolucao e duas leituras puras do estado.
 */

import type { MatchState } from "./matchState";

export interface RealismTuning {
  /** Farm passivo por jogador vivo no minuto 0, em ouro por minuto, antes da fatia da rota. */
  passiveBasePerMin: number;
  /** Quanto o farm passivo por minuto cresce a cada minuto de jogo (ondas maiores, campos). */
  passiveSlopePerMin: number;
  /** Expoente da fatia de ouro no poder de luta: (2 x fatia) ^ (expoente x elasticidade relativa). */
  goldFightExponent: number;
  /** Meia largura do sorteio de luta no Caos 0. */
  fightNoiseBase: number;
  /** Quanto a meia largura cresce por unidade de caos. */
  fightNoiseChaosCoef: number;
  /** Deficit minimo de ouro de time para a recompensa de objetivo ligar. */
  objectiveBountyMinDeficit: number;
  /** Fracao do deficit paga como recompensa de objetivo (no Caos de referencia). */
  objectiveBountyFraction: number;
  /** Teto da recompensa de objetivo por objetivo (no Caos de referencia). */
  objectiveBountyCap: number;
  /** Ouro por jogador do time MAIS POBRE a partir do qual o ouro comeca a pesar menos (itens fechando). */
  fullBuildStartPerPlayer: number;
  /** Ouro por jogador do time mais pobre em que o ouro deixa de pesar (build completa). */
  fullBuildEndPerPlayer: number;
  /** Dano de cerco por tick da janela de conversao com 1 de vantagem (pool de 100 por torre). */
  conversionSiegeBase: number;
  /**
   * Base do dano do press de rota com gente (resolveStructurePressure, caminho do pool), antes
   * dos fatores de onda, ameaca, numeros, plausibilidade, tier, buff e freio de cascata. Era a
   * constante 27 (historico no comentario do literal em structures.ts).
   */
  pressSiegeBase: number;
  /** Chance base de o time em desvantagem contestar Barao ou Anciao na janela. */
  contestBaseEpic: number;
  /** Chance base de contestar dragao na janela. */
  contestBaseDragon: number;
  /** Chance base de contestar Arauto ou larvas na janela. */
  contestBaseMinor: number;
  /** Dano por tick do canal de cerco da fase de rota (antes SIEGE_ACCRUAL_BASE). */
  siegeAccrualBase: number;
  /** Fator de dano na torre externa ate 11:00 (patch 26: resistencia decai de 11:00 a 15:00). */
  outerTurretEarlyFactor: number;
  /** Chance base do all-in de rota antes do 1o clear do jungler, por 10 pontos de vantagem acima do piso. */
  laneAllInBase: number;
  /** Fator da chance de pick e gank ate 14:00 (spec calendario secao 2). */
  earlyPickScale: number;
  /** Preparo por tick de dragao, larvas e Arauto, antes dos fatores (spec calendario secao 4). */
  prepRateMinor: number;
  /** Preparo por tick de Barao e Elder, antes dos fatores. Emenda de 2026-10-02: o que precisa ser mais longo no epico e o tempo de preparo (assert do gate), nao a taxa por tick. */
  prepRateEpic: number;
  /** Escala da prioridade de rota no preparo: fator = 1 + vantagem / escala (piso 0,25). */
  prepPrioScale: number;
  /** Quanto o preparo cai por tick sem a intencao de preparar. */
  prepDecay: number;
  /** Intervalo minimo entre lutas 5v5 no early (s), antes da escala de sangue (spec calendario secao 3). */
  fightResetEarly: number;
  /** Idem no mid. */
  fightResetMid: number;
  /** Idem no late. */
  fightResetLate: number;
  /** Escala de sangue do Caos: bloodScale = max(0,6; 1 + coef x (caos efetivo - 0,25)). */
  bloodChaosCoef: number;
  /** Caos efetivo a partir do qual a luta 5v5 dispensa o motivo (emenda 2 de 2026-10-02: Caos alto briga em qualquer lugar). */
  fightAnywhereChaos: number;
  /** Chance base de roubo com o jungler vivo (stealChanceFor), antes de traits e da fatia de objetivo. */
  stealBase: number;
}

/**
 * Calibrado nas Tasks 3 a 8 (docs/diagnostics/luta-mapa-vitoria-calibracao.md). Os dois
 * campos fullBuild* sao valores de desenho do dono do produto (build completa ~18k por
 * jogador) e nao entram em varredura. Os campos do calendario e do volume, e os que a
 * calibracao final retocou, vem de docs/diagnostics/calendario-e-volume-calibracao.md,
 * secoes 6, 8 e 10 (o valor de cada campo vem da secao da ultima varredura que o moveu).
 */
export const DEFAULT_REALISM_TUNING: RealismTuning = {
  passiveBasePerMin: 240,
  passiveSlopePerMin: 3.5,
  goldFightExponent: 1.85,
  fightNoiseBase: 0.375,
  fightNoiseChaosCoef: 0.48,
  objectiveBountyMinDeficit: 1500,
  objectiveBountyFraction: 0.05,
  objectiveBountyCap: 2500,
  fullBuildStartPerPlayer: 12000,
  fullBuildEndPerPlayer: 18000,
  conversionSiegeBase: 50,
  pressSiegeBase: 27,
  contestBaseEpic: 0.85,
  contestBaseDragon: 0.45,
  contestBaseMinor: 0.25,
  siegeAccrualBase: 1.5,
  outerTurretEarlyFactor: 0.5,
  laneAllInBase: 0.03,
  earlyPickScale: 0.15,
  prepRateMinor: 17,
  prepRateEpic: 28,
  prepPrioScale: 30,
  prepDecay: 1.5,
  fightResetEarly: 220,
  fightResetMid: 240,
  fightResetLate: 150,
  bloodChaosCoef: 4.8,
  fightAnywhereChaos: 0.9,
  stealBase: 0.04,
};

export function resolveTuning(partial?: Partial<RealismTuning>): RealismTuning {
  return { ...DEFAULT_REALISM_TUNING, ...(partial ?? {}) };
}

/**
 * Caos padrao do slider (DEFAULT_SIM_CONFIG.comebackElasticity), a referencia da recompensa de
 * objetivo. O caos efetivo soma a volatilidade media dos jogadores (cerca de 0,017), entao no
 * slider padrao a escala da recompensa e cerca de 1,07, nao exatamente 1.
 */
export const CHAOS_REFERENCE = 0.25;
/** Quanto a volatilidade media dos dez jogadores acrescenta ao caos (antes em engine.ts). */
const CHAOS_VOLATILITY_COEF = 0.03;

/**
 * Caos efetivo da partida em [0,1]: o slider de Caos (que chega como comebackElasticity)
 * mais a volatilidade media dos jogadores. Rng-free.
 */
export function effectiveChaos(state: MatchState): number {
  let sum = 0;
  let n = 0;
  for (const team of [state.user, state.rival]) {
    for (const p of Object.values(team.players)) {
      sum += p.metricsBase.laneVolatility;
      n++;
    }
  }
  const avgVolatility = n > 0 ? sum / n : 0;
  return Math.max(0, Math.min(1, state.comebackElasticity + avgVolatility * CHAOS_VOLATILITY_COEF));
}

/** Meia largura do sorteio uniforme de cada lado numa luta: base + coef x caos, em [0,02; 0,6]. */
export function fightNoiseHalfWidth(state: MatchState): number {
  const w = state.tuning.fightNoiseBase + state.tuning.fightNoiseChaosCoef * effectiveChaos(state);
  return Math.max(0.02, Math.min(0.6, w));
}
