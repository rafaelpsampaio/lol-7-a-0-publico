/**
 * src/components/playerPersona.ts
 *
 * Helpers PUROS de match de persona (D-06 / REG-03). Sem nenhum import de framework
 * de UI reativa — testaveis em environment=node sem montar componente.
 *
 * Exporta:
 *  - PRESET_FIELD_KEYS: lista dos 11 campos avancados (na mesma ordem de ELEVEN_FIELDS)
 *  - matchesPreset(adv, fields): true se todos os 11 campos batem dentro de EPS=1e-6
 *  - activePersona(card): "auto" | preset key | "__custom__"
 */

import type { AdvancedFields, PlayerVersion } from "../data/schema";
import { PRESETS, PRESET_KEYS } from "../data/presets";

// ---------------------------------------------------------------------------
// PRESET_FIELD_KEYS — os 11 campos avancados (D-04)
// Mesma ordem de ELEVEN_FIELDS em presets.test.ts (snapshot aprovado no checkpoint).
// ---------------------------------------------------------------------------

export const PRESET_FIELD_KEYS = [
  "riskProfile",
  "resourceDemand",
  "weaksideTolerance",
  "carryPotential",
  "volatility",
  "shotcalling",
  "roamTendency",
  "sideLaneDiscipline",
  "killBias",
  "assistBias",
  "deathRisk",
] as const;

/** Tolerancia numerica para comparacao de campos (evitar drift de ponto flutuante). */
const EPS = 1e-6;

// ---------------------------------------------------------------------------
// matchesPreset — comparacao exata com tolerancia EPS
// ---------------------------------------------------------------------------

/**
 * Retorna true se todos os PRESET_FIELD_KEYS de `adv` batem com `fields`
 * dentro de EPS=1e-6. Campo ausente em `adv` resulta em NaN e retorna false.
 *
 * @param adv    - bloco advanced do card (pode ser parcial)
 * @param fields - bloco fields de um preset (completo)
 */
export function matchesPreset(
  adv: AdvancedFields,
  fields: AdvancedFields
): boolean {
  for (const key of PRESET_FIELD_KEYS) {
    const advVal = adv[key];
    const presetVal = fields[key];
    // Campo ausente => advVal e undefined, Math.abs(undefined - number) = NaN => false
    if (
      typeof advVal !== "number" ||
      typeof presetVal !== "number" ||
      Math.abs(advVal - presetVal) >= EPS
    ) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// activePersona — detecta a persona ativa
// ---------------------------------------------------------------------------

/**
 * Detecta qual persona esta ativa para um card:
 *  - "auto": advanced ausente ou objeto vazio (sem campos definidos)
 *  - preset key: advanced bate exatamente com PRESETS[key].fields (todos os 11 campos)
 *  - "__custom__": advanced existe com campos, mas nao bate com nenhuma persona
 *
 * @param card - PlayerVersion com advanced opcional
 * @returns string ("auto" | preset key | "__custom__")
 */
export function activePersona(card: PlayerVersion): string {
  const adv = card.advanced;

  // advanced ausente ou sem campos => auto
  if (!adv || Object.keys(adv).length === 0) {
    return "auto";
  }

  // Comparar contra cada preset
  for (const k of PRESET_KEYS) {
    if (matchesPreset(adv, PRESETS[k].fields)) {
      return k;
    }
  }

  // Advanced presente mas nao bate com nenhuma persona => custom
  return "__custom__";
}
