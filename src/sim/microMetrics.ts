/**
 * src/sim/microMetrics.ts
 *
 * Módulo puro de micro-métricas em 3 camadas (MET-01/02/03).
 *
 * Design:
 *  - MetricsBase é uma interface TypeScript PLANA, sem campos opcionais.
 *    Todos os 18 campos de camadas 1+2 sempre presentes. Evita NaN propagando
 *    silenciosamente (Armadilha 3 — segue padrão de ChampionMeta).
 *  - NUNCA chama rng() nem Math.random (DET-02 / fronteira de determinismo).
 *    Módulo puro rng-free: dado o mesmo input, retorna sempre o mesmo output.
 *  - Camadas 1+2 são cacheáveis (baseMetrics + overlayChampion).
 *    Camada 3 (contextMetrics) é recomputada sob demanda — nunca cacheada.
 *  - Contrato de identidade (D-12): overlayChampion(base, NEUTRAL_META, 3) == base
 *    campo a campo. NEUTRAL_META tem todos os biases=1.0 e functionalTags=[],
 *    portanto todos os lifts são 0 e a penalidade de throwRisk é 0.
 *  - Lift relativo (D-08): overlay nunca inverte a ordem entre jogadores base
 *    distintos. Um jogador bom com o mesmo boneco permanece acima do fraco.
 *
 * Camada 1 (baseMetrics): lê só o card, deriva campos avançados ausentes de
 *   role + traits com estereótipo flavoroso (D-03/04).
 * Camada 2 (overlayChampion): tempera com o archetype do campeão, modulado
 *   por maestria 1-5, sempre como lift RELATIVO ao teto do jogador (D-06/07/08).
 * Camada 3 (contextMetrics): subset dependente de estado vivo; recomputado sob
 *   demanda, nunca armazenado em PlayerState (Armadilha 5).
 *
 * Constantes marcadas RE_ANCHOR_PHASE9 são priors iniciais; calibração real
 * ocorre na Fase 9 com ancoragem contra a economia flat da engine.
 *
 * INERTE NA PHASE 8: nenhum resolver de runtime importa este módulo ainda.
 * O consumo real começa na Fase 9.
 */

import type { PlayerVersion, Role, PlayerTrait, Mastery, AdvancedFields } from "../data/schema";
import type { ChampionMeta } from "./championMeta";
import type { PlayerState, MatchState } from "./matchState";
import { averageLaningSlice, expectedGoldForRoleAtMinute } from "./power";

// ---------------------------------------------------------------------------
// Utilitários locais (rng-free, sem dependências externas)
// ---------------------------------------------------------------------------

/** Clamp de um número para o intervalo [0, 1]. */
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/**
 * Sigmoid rápida (sem deps): aproxima tanh(x/2).
 * sigmoid(0) = 0; sigma(-inf)=-1; sigma(+inf)=+1.
 * Usada para normalizar goldDelta em [-1, +1].
 */
const sigmoid = (x: number): number => x / (1 + Math.abs(x));

// ---------------------------------------------------------------------------
// Interfaces públicas (TypeScript puro, sem Zod — igual a ChampionMeta)
// ---------------------------------------------------------------------------

/**
 * Métricas de camadas 1+2 por agente. Interface PLANA sem campos opcionais,
 * seguindo o padrão de ChampionMeta (Armadilha 3). Os 18 campos são:
 *
 * KDA/Seleção (5): killShareBias, deathRisk, assistBias, burstThreat, pickThreat
 * Luta (4): damageThreat, engageScore, peelScore, frontLineScore
 * Lane/Map (6): laneVolatility, weaksideTolerance, resourceDemand,
 *               objectiveSetup, visionScoreInternal, siegeThreat
 * Macro (3): scalingCurve, throwRisk, carryPotential
 *
 * jungleAttentionReceived, comebackThreat, mapControl são exclusivos da camada 3
 * (ContextMetrics) — dependem de estado vivo e nunca são cacheados.
 */
export interface MetricsBase {
  // KDA / Seleção
  killShareBias: number;
  deathRisk: number;
  assistBias: number;
  burstThreat: number;
  pickThreat: number;

  // Luta
  damageThreat: number;
  engageScore: number;
  peelScore: number;
  frontLineScore: number;

  // Lane / Map
  laneVolatility: number;
  weaksideTolerance: number;
  resourceDemand: number;
  objectiveSetup: number;
  visionScoreInternal: number;
  siegeThreat: number;

  // Macro
  scalingCurve: number;
  throwRisk: number;
  carryPotential: number;
}

/**
 * Métricas de camada 3: herda MetricsBase + 3 campos dependentes de estado vivo.
 * Retornado por contextMetrics(), nunca armazenado em PlayerState.
 */
export interface ContextMetrics extends MetricsBase {
  /** Atenção do jungler recebida (camada 3): [-1,+1]; 0 para roles não-jungle em flat. */
  jungleAttentionReceived: number;
  /** Ameaça de virada (camada 3): escalingCurve + componente de goldDelta. */
  comebackThreat: number;
  /** Controle de mapa (camada 3): objectiveSetup + visionScoreInternal + alive. */
  mapControl: number;
}

// ---------------------------------------------------------------------------
// Tabelas de defaults por role (D-03: estereótipos flavorosos)
// ---------------------------------------------------------------------------

/** Perfil de risco geral (0 cauteloso..1 agressivo) por role. */
const ROLE_RISK_DEFAULT: Record<Role, number> = {
  top: 0.50,
  jungle: 0.55,
  mid: 0.55,
  adc: 0.45,
  support: 0.50,
};

/** Demanda de recursos (ouro/farm/atenção) por role. RE_ANCHOR_PHASE9. */
const ROLE_RESOURCE_DEFAULT: Record<Role, number> = {
  top: 0.55,
  jungle: 0.45,
  mid: 0.55,
  adc: 0.65,
  support: 0.25,
};

/** Tolerância de weakside por role. */
const ROLE_WEAKSIDE_DEFAULT: Record<Role, number> = {
  top: 0.55,
  jungle: 0.50,
  mid: 0.50,
  adc: 0.40,
  support: 0.60,
};

/** Kill bias base por role (D-03: support baixo, mid/jungle médio-alto). */
const ROLE_KILL_BIAS_DEFAULT: Record<Role, number> = {
  top: 0.50,
  jungle: 0.55,
  mid: 0.55,
  adc: 0.55,
  support: 0.15,
};

/** Assist bias base por role (D-03: support alto, adc baixo). */
const ROLE_ASSIST_BIAS_DEFAULT: Record<Role, number> = {
  top: 0.45,
  jungle: 0.50,
  mid: 0.45,
  adc: 0.35,
  support: 0.80,
};

/** Death risk base por role. */
const ROLE_DEATH_RISK_DEFAULT: Record<Role, number> = {
  top: 0.50,
  jungle: 0.50,
  mid: 0.45,
  adc: 0.45,
  support: 0.60,
};

/** Carry potential base por role. */
const ROLE_CARRY_POTENTIAL_DEFAULT: Record<Role, number> = {
  top: 0.50,
  jungle: 0.55,
  mid: 0.60,
  adc: 0.65,
  support: 0.35,
};

/** Engage score base por role (tanks/divers engajam mais). */
const ROLE_ENGAGE_DEFAULT: Record<Role, number> = {
  top: 0.45,
  jungle: 0.55,
  mid: 0.35,
  adc: 0.20,
  support: 0.50,
};

/** Peel score base por role (suportes/encantadores protegem mais). */
const ROLE_PEEL_DEFAULT: Record<Role, number> = {
  top: 0.30,
  jungle: 0.30,
  mid: 0.30,
  adc: 0.25,
  support: 0.60,
};

/** Frontline score base por role (top/suporte mais frontline). */
const ROLE_FRONTLINE_DEFAULT: Record<Role, number> = {
  top: 0.55,
  jungle: 0.45,
  mid: 0.35,
  adc: 0.20,
  support: 0.45,
};

/** Objective setup base por role. */
const ROLE_OBJECTIVE_DEFAULT: Record<Role, number> = {
  top: 0.40,
  jungle: 0.60,
  mid: 0.40,
  adc: 0.40,
  support: 0.45,
};

/** Vision score base por role (support highest). */
const ROLE_VISION_DEFAULT: Record<Role, number> = {
  top: 0.30,
  jungle: 0.45,
  mid: 0.35,
  adc: 0.30,
  support: 0.65,
};

/** Siege threat base por role. */
const ROLE_SIEGE_DEFAULT: Record<Role, number> = {
  top: 0.40,
  jungle: 0.35,
  mid: 0.45,
  adc: 0.50,
  support: 0.35,
};

// ---------------------------------------------------------------------------
// Mapeamento trait -> métricas (análogo a TRAIT_SLICE_BONUS em power.ts)
// ---------------------------------------------------------------------------

/**
 * Bônus aditivo por trait para métricas específicas (D-05).
 * Espelha TRAIT_SLICE_BONUS de power.ts: Partial<Record<...>>.
 * Aplicado em baseMetrics APÓS a derivação de role.
 */
const TRAIT_METRIC_BONUS: Partial<
  Record<PlayerTrait, Partial<Record<keyof MetricsBase, number>>>
> = {
  tilts_on_death: { throwRisk: 0.10 },
  plays_worse_when_behind: { throwRisk: 0.05 },
  clutch_player: { killShareBias: 0.05, damageThreat: 0.05 },
  objective_focused: { objectiveSetup: 0.15, visionScoreInternal: 0.05 },
  baron_stealer: { objectiveSetup: 0.20 },
  strong_laner: { laneVolatility: 0.08, damageThreat: 0.05 },
  mental_fort: { throwRisk: -0.10, weaksideTolerance: 0.08 },
  lane_bully: { laneVolatility: 0.12, killShareBias: 0.08, pickThreat: 0.05 },
  trash_talker: {},
};

/** Aplica bônus de traits ao objeto de métricas. Retorna delta total por chave. */
function traitMetricBonus(
  traits: PlayerTrait[],
  key: keyof MetricsBase
): number {
  let bonus = 0;
  for (const t of traits) {
    bonus += TRAIT_METRIC_BONUS[t]?.[key] ?? 0;
  }
  return bonus;
}

// ---------------------------------------------------------------------------
// Helpers de maestria (camada 2)
// ---------------------------------------------------------------------------

/**
 * Curva de maestria 1-5 para escala de intensidade do overlay.
 * RE_ANCHOR_PHASE9: valores são priors iniciais (D-07/D-06).
 */
function masteryToScale(mastery: Mastery): number {
  const MASTERY_SCALE: Record<number, number> = {
    1: 0.15,
    2: 0.35,
    3: 0.60,
    4: 0.80,
    5: 1.00,
  };
  return MASTERY_SCALE[mastery] ?? 0.60;
}

/**
 * Resolve a maestria de um campeão do champion pool do card.
 * Retorna 3 (neutro) se o campeão não está no pool ou se não há championId.
 * Segue o idioma de championMetaFor: null-safe, sempre-finito.
 */
export function resolveMastery(
  card: PlayerVersion,
  championId: string | undefined | null
): Mastery {
  if (!championId) return 3;
  return (
    (card.championPool.find((c) => c.championId === championId)?.mastery ??
      3) as Mastery
  );
}

// ---------------------------------------------------------------------------
// Helper privado compartilhado (D-05 / REG-03):
// resolveAdvancedBase — resolve os 8 campos que baseMetrics consome,
// seguindo a regra "presente usa, ausente deriva" (UNICA FONTE DE VERDADE).
// Usado por baseMetrics E por effectiveAdvancedFields — zero duplicacao.
// ---------------------------------------------------------------------------

/**
 * Os 8 campos do bloco advanced consumidos por baseMetrics, resolvidos via
 * "presente usa, ausente deriva de role + traits".
 * Duas derivacoes compostas (carryPotential e volatility) dependem de lateGame,
 * roleStrength e traits — parametros trazidos via card.
 */
interface ResolvedAdvancedBase {
  riskProfile: number;
  resourceDemand: number;
  weaksideTolerance: number;
  carryPotential: number;
  volatility: number;
  killBias: number;
  assistBias: number;
  deathRisk: number;
}

function resolveAdvancedBase(card: PlayerVersion): ResolvedAdvancedBase {
  const { lateGame, primaryRole: role, traits } = card;
  const roleRS = card.roleStrength[role];
  const adv = card.advanced ?? {};

  const riskProfile = adv.riskProfile ?? ROLE_RISK_DEFAULT[role];
  const resourceDemand = adv.resourceDemand ?? ROLE_RESOURCE_DEFAULT[role];
  const weaksideTolerance = adv.weaksideTolerance ?? ROLE_WEAKSIDE_DEFAULT[role];
  const carryPotential =
    adv.carryPotential ??
    clamp01(
      ROLE_CARRY_POTENTIAL_DEFAULT[role] * 0.6 +
      (lateGame / 100) * 0.3 +
      (roleRS / 100) * 0.1
    );
  const volatility =
    adv.volatility ??
    clamp01(riskProfile * 0.5 + traitMetricBonus(traits, "throwRisk") * 0.3);
  const killBias = adv.killBias ?? ROLE_KILL_BIAS_DEFAULT[role];
  const assistBias = adv.assistBias ?? ROLE_ASSIST_BIAS_DEFAULT[role];
  const deathRisk = adv.deathRisk ?? ROLE_DEATH_RISK_DEFAULT[role];

  return {
    riskProfile,
    resourceDemand,
    weaksideTolerance,
    carryPotential,
    volatility,
    killBias,
    assistBias,
    deathRisk,
  };
}

// ---------------------------------------------------------------------------
// effectiveAdvancedFields — exportado, D-05 / REG-03 / REG-04
// ---------------------------------------------------------------------------

/**
 * Devolve os 11 valores efetivos do bloco advanced para um card:
 *  - 8 campos consumidos por baseMetrics: via helper compartilhado resolveAdvancedBase.
 *  - 3 campos orfaos (sem tabela ROLE_*_DEFAULT): default neutro 0.5 se ausentes.
 *
 * NUNCA duplica a derivacao de baseMetrics — ambos chamam resolveAdvancedBase.
 * Retorno tipado como Required<Pick<AdvancedFields, ...11 campos>> (todos presentes).
 */
export function effectiveAdvancedFields(
  card: PlayerVersion
): Required<
  Pick<
    AdvancedFields,
    | "riskProfile"
    | "resourceDemand"
    | "weaksideTolerance"
    | "carryPotential"
    | "volatility"
    | "killBias"
    | "assistBias"
    | "deathRisk"
    | "shotcalling"
    | "roamTendency"
    | "sideLaneDiscipline"
  >
> {
  const base8 = resolveAdvancedBase(card);
  const adv = card.advanced ?? {};
  return {
    ...base8,
    shotcalling: adv.shotcalling ?? 0.5,
    roamTendency: adv.roamTendency ?? 0.5,
    sideLaneDiscipline: adv.sideLaneDiscipline ?? 0.5,
  };
}

// ---------------------------------------------------------------------------
// CAMADA 1: baseMetrics(card) -> MetricsBase
// ---------------------------------------------------------------------------

/**
 * Camada 1: deriva MetricsBase do card do jogador. Pura e rng-free.
 *
 * Lê: lanePhase, midGame, lateGame, roleStrength, primaryRole, traits, advanced.
 * Para cada campo do bloco `advanced` ausente, deriva de role + traits com
 * estereótipo flavoroso (D-03/04). Quando `card.advanced.field` está presente,
 * usa o valor do card diretamente ("presente usa, ausente deriva").
 *
 * Escala 0-1 para todas as métricas. 0.5 = neutro. clamp01 garante faixa.
 * Os 8 campos avancados sao resolvidos via resolveAdvancedBase (helper compartilhado).
 */
export function baseMetrics(card: PlayerVersion): MetricsBase {
  const { lanePhase, midGame, lateGame, primaryRole: role, traits } = card;
  const avg = (lanePhase + midGame + lateGame) / 3;

  // Resolver os 8 campos avancados via helper compartilhado (UNICA FONTE)
  const {
    riskProfile,
    resourceDemand,
    weaksideTolerance,
    carryPotential,
    volatility,
    killBias,
    assistBias,
    deathRisk,
  } = resolveAdvancedBase(card);

  // Composição das 18 métricas
  const base: MetricsBase = {
    // --- KDA / Seleção ---
    killShareBias: clamp01(
      killBias + traitMetricBonus(traits, "killShareBias")
    ),
    deathRisk: clamp01(deathRisk),
    assistBias: clamp01(
      assistBias + traitMetricBonus(traits, "assistBias")
    ),
    burstThreat: clamp01(
      (midGame / 100) * 0.6 +
      killBias * 0.4 +
      traitMetricBonus(traits, "burstThreat")
    ),
    pickThreat: clamp01(
      (lanePhase / 100) * 0.5 +
      killBias * 0.5 +
      traitMetricBonus(traits, "pickThreat")
    ),

    // --- Luta ---
    damageThreat: clamp01(
      avg / 100 * 0.7 +
      killBias * 0.3 +
      traitMetricBonus(traits, "damageThreat")
    ),
    engageScore: clamp01(
      ROLE_ENGAGE_DEFAULT[role] +
      riskProfile * 0.2 +
      traitMetricBonus(traits, "engageScore")
    ),
    peelScore: clamp01(
      ROLE_PEEL_DEFAULT[role] +
      traitMetricBonus(traits, "peelScore")
    ),
    frontLineScore: clamp01(
      ROLE_FRONTLINE_DEFAULT[role] +
      traitMetricBonus(traits, "frontLineScore")
    ),

    // --- Lane / Map ---
    laneVolatility: clamp01(
      riskProfile * 0.5 +
      (lanePhase / 100) * 0.3 +
      killBias * 0.2 +
      traitMetricBonus(traits, "laneVolatility")
    ),
    weaksideTolerance: clamp01(
      weaksideTolerance +
      traitMetricBonus(traits, "weaksideTolerance")
    ),
    resourceDemand: clamp01(
      resourceDemand +
      traitMetricBonus(traits, "resourceDemand")
    ),
    objectiveSetup: clamp01(
      ROLE_OBJECTIVE_DEFAULT[role] +
      traitMetricBonus(traits, "objectiveSetup")
    ),
    visionScoreInternal: clamp01(
      ROLE_VISION_DEFAULT[role] +
      traitMetricBonus(traits, "visionScoreInternal")
    ),
    siegeThreat: clamp01(
      (lateGame / 100) * 0.4 +
      ROLE_SIEGE_DEFAULT[role] * 0.6 +
      traitMetricBonus(traits, "siegeThreat")
    ),

    // --- Macro ---
    scalingCurve: clamp01(lateGame / 100),
    throwRisk: clamp01(
      riskProfile * 0.5 +
      volatility * 0.5 +
      traitMetricBonus(traits, "throwRisk")
    ),
    carryPotential: clamp01(
      carryPotential +
      traitMetricBonus(traits, "carryPotential")
    ),
  };

  return base;
}

// ---------------------------------------------------------------------------
// CAMADA 2: overlayChampion(base, meta, mastery) -> MetricsBase
// ---------------------------------------------------------------------------

/**
 * Camada 2: tempera MetricsBase com o archetype do campeão, modulado por maestria.
 *
 * Lift RELATIVO (D-08): o overlay é proporcional ao teto do próprio jogador.
 *   liftRelative(baseVal, metaBias) = baseVal + (metaBias - 1.0) * masteryScale * baseVal
 *   = baseVal * (1 + (metaBias - 1.0) * masteryScale)
 *
 * Com NEUTRAL_META (killBias=1.0, assistBias=1.0, deathRisk=1.0, tags=[]) e
 * mastery=3 (scale=0.60): todos os lifts retornam 0, penalidade retorna 0.
 * overlayChampion(base, NEUTRAL_META, 3) == base exatamente (D-12).
 *
 * Maestria baixa (1-2) encole o overlay E adiciona penalidade de throwRisk (D-07).
 * RE_ANCHOR_PHASE9: masteryToScale e os deltas de functionalTags são priors iniciais.
 */
export function overlayChampion(
  base: MetricsBase,
  meta: ChampionMeta,
  mastery: Mastery
): MetricsBase {
  const masteryScale = masteryToScale(mastery);

  // Penalidade de throwRisk para maestria baixa (D-07).
  // Mastery 1: +0.10; Mastery 2: +0.05; Mastery 3+: 0.
  // RE_ANCHOR_PHASE9: magnitude da penalidade.
  const masteryPenalty = mastery <= 2 ? (3 - mastery) * 0.05 : 0;

  /**
   * Lift relativo (D-08): proporcional ao teto do jogador.
   * Com metaBias=1.0 (NEUTRAL_META), o lift é exatamente 0.
   * Com NEUTRAL_META e qualquer mastery, o resultado é exatamente base.
   */
  function liftRelative(baseVal: number, metaBias: number): number {
    const lift = (metaBias - 1.0) * masteryScale * baseVal;
    return clamp01(baseVal + lift);
  }

  // Bônus por functionalTags — escala por masteryScale para respeitar D-08.
  // Com functionalTags=[] (NEUTRAL_META), nenhum bônus é aplicado.
  const hasPick = meta.functionalTags.includes("pick");
  const hasDive = meta.functionalTags.includes("dive");
  const hasEngage = meta.functionalTags.includes("engage");
  const hasProtectCarry = meta.functionalTags.includes("protect-carry");
  const hasDisengage = meta.functionalTags.includes("disengage");
  const hasEarlySnowball = meta.functionalTags.includes("early-snowball");
  const hasObjectiveControl = meta.functionalTags.includes("objective-control");
  const isSupportClass =
    meta.primaryClass === "support" ||
    meta.primaryClass === "enchanter" ||
    meta.primaryClass === "engage-support" ||
    meta.primaryClass === "poke-support";
  const isTankOrEngage =
    meta.primaryClass === "tank" || meta.primaryClass === "engage-support";
  const isLateScaling =
    meta.scalingCurve === "late" || meta.scalingCurve === "hyperscaling";

  return {
    // KDA — lift relativo pelos biases do meta
    killShareBias: liftRelative(base.killShareBias, meta.killBias),
    deathRisk: liftRelative(base.deathRisk, meta.deathRisk),
    assistBias: liftRelative(base.assistBias, meta.assistBias),

    // burstThreat: boost por pick tag
    burstThreat: hasPick
      ? clamp01(base.burstThreat + 0.10 * masteryScale)
      : base.burstThreat,

    // pickThreat: boost por pick tag (lift relativo já embutido via killBias)
    pickThreat: hasPick
      ? clamp01(base.pickThreat + 0.08 * masteryScale)
      : base.pickThreat,

    // damageThreat: lift relativo por killBias (campeão agressivo => mais dano)
    damageThreat: liftRelative(base.damageThreat, meta.killBias),

    // engageScore: boost por dive/engage
    engageScore:
      hasDive || hasEngage
        ? clamp01(base.engageScore + 0.12 * masteryScale)
        : base.engageScore,

    // peelScore: boost por protect-carry/disengage
    peelScore:
      hasProtectCarry || hasDisengage
        ? clamp01(base.peelScore + 0.12 * masteryScale)
        : base.peelScore,

    // frontLineScore: boost por tank/engage-support class
    frontLineScore: isTankOrEngage
      ? clamp01(base.frontLineScore + 0.10 * masteryScale)
      : base.frontLineScore,

    // laneVolatility: boost por early-snowball
    laneVolatility: hasEarlySnowball
      ? clamp01(base.laneVolatility + 0.10 * masteryScale)
      : base.laneVolatility,

    // weaksideTolerance: sem overlay de campeão (derivado só do jogador)
    weaksideTolerance: base.weaksideTolerance,

    // resourceDemand: sem overlay de campeão
    resourceDemand: base.resourceDemand,

    // objectiveSetup: boost por objective-control
    objectiveSetup: hasObjectiveControl
      ? clamp01(base.objectiveSetup + 0.10 * masteryScale)
      : base.objectiveSetup,

    // visionScoreInternal: boost por classes de suporte
    visionScoreInternal: isSupportClass
      ? clamp01(base.visionScoreInternal + 0.08 * masteryScale)
      : base.visionScoreInternal,

    // siegeThreat: boost por late-scaling
    siegeThreat: isLateScaling
      ? clamp01(base.siegeThreat + 0.08 * masteryScale)
      : base.siegeThreat,

    // scalingCurve: boost por late/hyperscaling
    scalingCurve: isLateScaling
      ? clamp01(base.scalingCurve + 0.08 * masteryScale)
      : base.scalingCurve,

    // throwRisk: D-07 penalidade por maestria baixa; lift relativo por deathRisk
    throwRisk: clamp01(
      liftRelative(base.throwRisk, meta.deathRisk) + masteryPenalty
    ),

    // carryPotential: lift relativo por killBias (carry agressivo => mais potencial)
    carryPotential: liftRelative(base.carryPotential, meta.killBias),
  };
}

// ---------------------------------------------------------------------------
// CAMADA 3: contextMetrics(base, p, state) -> ContextMetrics
// ---------------------------------------------------------------------------

/**
 * Fracao do ouro esperado do proprio jogador usada como denominador de
 * normalizacao do goldDelta. ECO-05.
 *
 * Substitui a constante de normalizacao antiga (valor fixo 500), que era um
 * prior sem procedencia: um numero fixo escolhido por analogia, desacoplado de
 * qualquer nocao real de ouro esperado. O denominador agora deriva da MESMA
 * fonte de verdade que o proprio goldDelta (expectedGoldForRoleAtMinute),
 * em vez de uma constante paralela com origem propria.
 *
 * Numero de referencia calculado a mao: no minuto 15, com o slice medio de
 * referencia da economia de hoje (avgLaningSlice = 65) e role top
 * (roleMultiplier = 1.00, sem ajuste), expectedGoldForRoleAtMinute devolve
 * 10940 (flatBase = 500 + (9 + 65/25) * 60 * 15 = 500 + 10440). Com a fracao
 * 1/20 = 0.05, o denominador cai em 547, na mesma ordem de grandeza dos 500
 * que a constante antiga usava fixamente para TODO minuto e TODO role.
 */
const GOLD_DELTA_FRACTION = 0.05; // 1/20, ECO-05

/**
 * Camada 3: recomputa o subset de métricas que dependem de estado vivo.
 *
 * Retorna um objeto NOVO (ContextMetrics) com base herdado via spread +
 * 3 campos de contexto recomputados. NUNCA muta base nem PlayerState.
 * NUNCA armazene o resultado em PlayerState — use contextMetrics() a cada tick.
 *
 * Em estado flat simétrico (pressure=0, gold inicial, ambos os times iguais),
 * as métricas de contexto tendem a valores neutros:
 *  - jungleAttentionReceived = 0 para roles não-jungle
 *  - comebackThreat derivado de scalingCurve + goldDelta~0
 *  - mapControl derivado de objectiveSetup + visionScoreInternal
 */
export function contextMetrics(
  base: MetricsBase,
  p: PlayerState,
  state: MatchState
): ContextMetrics {
  // goldDelta: diferença entre ouro atual e ouro esperado ao minuto.
  // ECO-05: existe UMA unica nocao de ouro esperado na engine. A formula
  // local que existia aqui (divergente por um fator de dez da constante de
  // power.ts) foi ELIMINADA, nao escalada proporcionalmente: contextMetrics
  // agora chama a mesma expectedGoldForRoleAtMinute que effectiveGoldPower usa.
  // (goldFightMult e goldSecureMult nao usam mais ouro esperado: leem a fatia de ouro
  // do time sobre o total da partida, ver power.ts.)
  const minute = state.gameTimeSec / 60;
  const avgLaningSlice = averageLaningSlice(state);
  const expectedGold = expectedGoldForRoleAtMinute(p.role, minute, avgLaningSlice, state.tuning);
  const goldDelta = p.gold - expectedGold;
  // Guarda: o denominador nunca e zero. No minuto zero, expectedGold e a
  // parcela de inicio de partida (500 fixos, STARTING_GOLD_PER_PLAYER, sem fatia de rota), que e sempre
  // positiva, entao a divisao e segura por construcao — nao precisa de clamp
  // defensivo.
  const normalizedGoldDelta = goldDelta / (expectedGold * GOLD_DELTA_FRACTION);

  // jungleAttentionReceived: 0 para roles não-jungle (Armadilha 5: nunca cacheada).
  // Para jungle: pressão nas 3 lanes indica atenção recebida.
  const jungleAttentionReceived =
    p.role === "jungle"
      ? Math.max(
          -1,
          Math.min(
            1,
            state.pressure.top * 0.3 +
              state.pressure.mid * 0.3 +
              state.pressure.bot * 0.4
          )
        )
      : 0;

  // comebackThreat: maior quando jogador está atrás (goldDelta negativo) e
  // tem scalingCurve alto (late-game carry).
  // sigmoid(-goldDelta): positivo quando atrás de ouro.
  const comebackThreat = clamp01(
    base.scalingCurve * 0.4 +
      base.visionScoreInternal * 0.2 +
      sigmoid(normalizedGoldDelta * -1) * 0.4 // atrás => maior comebackThreat
  );

  // mapControl: controle objetivo + visão + estar vivo.
  const mapControl = clamp01(
    base.objectiveSetup * 0.5 +
      base.visionScoreInternal * 0.3 +
      (p.alive ? 0.2 : 0)
  );

  return {
    ...base,
    jungleAttentionReceived,
    comebackThreat,
    mapControl,
  };
}
