/**
 * src/data/presets.ts
 *
 * Catalogo de presets de persona como DADOS PUROS (REG-03 / D-01..D-04).
 *
 * Cada preset mapeia um rotulo de giria BR (D-01/D-03) para um pacote COMPLETO
 * dos 11 campos avancados (D-04). Os valores foram aprovados pelo usuario no
 * checkpoint do plano 07-02 ("approve-12") a partir da proposta da pesquisa
 * (07-RESEARCH.md, secao "Catalogo de Presets"). Escala 0.0-1.0 para todos os
 * campos.
 *
 * Sem Zod aqui: o shape e enforced por TypeScript via `import type AdvancedFields`.
 * O teste presets.test.ts valida cada preset contra `AdvancedFieldsSchema`.
 * Este arquivo NAO importa nada de UI (a UI de presets e a Phase 14).
 */

import type { AdvancedFields } from "./schema";

/** Uma entrada do catalogo de presets. */
export interface PresetEntry {
  /** Rotulo em giria BR exibido na UI (Phase 14). */
  label: string;
  /** Descricao curta e neutra da persona (tom misto D-03). */
  description: string;
  /** Pacote completo dos 11 campos avancados (D-01/D-04). */
  fields: AdvancedFields;
}

/**
 * Catalogo de personas. Chave = rotulo-slug em giria BR; valor = entrada
 * completa. Cada `fields` preenche os 11 campos avancados (persona completa,
 * D-01). 12 personas aprovadas no checkpoint ("approve-12").
 */
export const PRESETS: Record<string, PresetEntry> = {
  perna: {
    label: "Perna",
    description: "Joga abaixo do esperado, erros basicos frequentes",
    fields: {
      riskProfile: 0.3,
      resourceDemand: 0.7,
      weaksideTolerance: 0.2,
      carryPotential: 0.2,
      volatility: 0.6,
      shotcalling: 0.2,
      roamTendency: 0.3,
      sideLaneDiscipline: 0.4,
      killBias: 0.4,
      assistBias: 0.6,
      deathRisk: 0.8,
    },
  },
  ok: {
    label: "Ok",
    description: "Competente sem se destacar, confiavel no basico",
    fields: {
      riskProfile: 0.5,
      resourceDemand: 0.5,
      weaksideTolerance: 0.5,
      carryPotential: 0.5,
      volatility: 0.4,
      shotcalling: 0.4,
      roamTendency: 0.4,
      sideLaneDiscipline: 0.5,
      killBias: 0.5,
      assistBias: 0.5,
      deathRisk: 0.4,
    },
  },
  "bom-de-lane": {
    label: "Bom de lane",
    description: "Ganha a fase de laning mas some no teamfight",
    fields: {
      riskProfile: 0.7,
      resourceDemand: 0.4,
      weaksideTolerance: 0.3,
      carryPotential: 0.5,
      volatility: 0.5,
      shotcalling: 0.3,
      roamTendency: 0.2,
      sideLaneDiscipline: 0.7,
      killBias: 0.6,
      assistBias: 0.4,
      deathRisk: 0.5,
    },
  },
  "farmador-passivo": {
    label: "Farmador passivo",
    description: "Nao toma risco, farma bem, nunca inicia nada",
    fields: {
      riskProfile: 0.2,
      resourceDemand: 0.6,
      weaksideTolerance: 0.6,
      carryPotential: 0.6,
      volatility: 0.2,
      shotcalling: 0.3,
      roamTendency: 0.1,
      sideLaneDiscipline: 0.3,
      killBias: 0.3,
      assistBias: 0.6,
      deathRisk: 0.2,
    },
  },
  "agressivo-e-morre": {
    label: "Agressivo e morre",
    description: "Sempre inicia, resultado volatil, pode explodir ou dominar",
    fields: {
      riskProfile: 0.9,
      resourceDemand: 0.5,
      weaksideTolerance: 0.4,
      carryPotential: 0.6,
      volatility: 0.9,
      shotcalling: 0.5,
      roamTendency: 0.6,
      sideLaneDiscipline: 0.6,
      killBias: 0.7,
      assistBias: 0.3,
      deathRisk: 0.9,
    },
  },
  "suporte-util-sem-dano": {
    label: "Suporte util sem dano",
    description: "Salva o carry, nao gera pressao de dano",
    fields: {
      riskProfile: 0.3,
      resourceDemand: 0.3,
      weaksideTolerance: 0.5,
      carryPotential: 0.1,
      volatility: 0.3,
      shotcalling: 0.5,
      roamTendency: 0.6,
      sideLaneDiscipline: 0.4,
      killBias: 0.1,
      assistBias: 0.9,
      deathRisk: 0.5,
    },
  },
  "jungler-perdido": {
    label: "Jungler perdido",
    description: "Gosta de jungliar, nunca aparece nas lanes no momento certo",
    fields: {
      riskProfile: 0.4,
      resourceDemand: 0.5,
      weaksideTolerance: 0.4,
      carryPotential: 0.3,
      volatility: 0.5,
      shotcalling: 0.2,
      roamTendency: 0.2,
      sideLaneDiscipline: 0.5,
      killBias: 0.3,
      assistBias: 0.6,
      deathRisk: 0.6,
    },
  },
  "carrega-se-forte": {
    label: "Carrega se forte",
    description: "Escala bem, precisa de recursos, decide o jogo no late",
    fields: {
      riskProfile: 0.5,
      resourceDemand: 0.8,
      weaksideTolerance: 0.4,
      carryPotential: 0.9,
      volatility: 0.6,
      shotcalling: 0.4,
      roamTendency: 0.3,
      sideLaneDiscipline: 0.5,
      killBias: 0.7,
      assistBias: 0.4,
      deathRisk: 0.4,
    },
  },
  "tilta-quando-morre": {
    label: "Tilta quando morre",
    description: "Comeca bem mas desanda depois de morrer",
    fields: {
      riskProfile: 0.6,
      resourceDemand: 0.5,
      weaksideTolerance: 0.1,
      carryPotential: 0.5,
      volatility: 0.8,
      shotcalling: 0.3,
      roamTendency: 0.4,
      sideLaneDiscipline: 0.5,
      killBias: 0.6,
      assistBias: 0.4,
      deathRisk: 0.7,
    },
  },
  "segura-weakside": {
    label: "Segura weakside",
    description: "Aguenta pressao no lado fraco, trabalha bem com desvantagem",
    fields: {
      riskProfile: 0.3,
      resourceDemand: 0.3,
      weaksideTolerance: 0.9,
      carryPotential: 0.4,
      volatility: 0.3,
      shotcalling: 0.4,
      roamTendency: 0.5,
      sideLaneDiscipline: 0.7,
      killBias: 0.3,
      assistBias: 0.6,
      deathRisk: 0.3,
    },
  },
  "mecanico-sem-macro": {
    label: "Mecanico sem macro",
    description: "Mecanica apurada mas decisoes ruins de macro",
    fields: {
      riskProfile: 0.7,
      resourceDemand: 0.5,
      weaksideTolerance: 0.3,
      carryPotential: 0.6,
      volatility: 0.6,
      shotcalling: 0.2,
      roamTendency: 0.7,
      sideLaneDiscipline: 0.6,
      killBias: 0.6,
      assistBias: 0.4,
      deathRisk: 0.6,
    },
  },
  "shotcaller-nato": {
    label: "Shotcaller nato",
    description: "Leva o time nas costas com calls certeiros, mesmo sem mecanica top",
    fields: {
      riskProfile: 0.5,
      resourceDemand: 0.4,
      weaksideTolerance: 0.6,
      carryPotential: 0.4,
      volatility: 0.3,
      shotcalling: 0.9,
      roamTendency: 0.6,
      sideLaneDiscipline: 0.5,
      killBias: 0.4,
      assistBias: 0.6,
      deathRisk: 0.3,
    },
  },
};

/** Lista de chaves de preset na ordem de exibicao sugerida. */
export const PRESET_KEYS = [
  "perna",
  "ok",
  "bom-de-lane",
  "farmador-passivo",
  "agressivo-e-morre",
  "suporte-util-sem-dano",
  "jungler-perdido",
  "carrega-se-forte",
  "tilta-quando-morre",
  "segura-weakside",
  "mecanico-sem-macro",
  "shotcaller-nato",
] as const;
