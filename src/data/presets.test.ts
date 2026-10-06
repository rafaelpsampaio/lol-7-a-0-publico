/**
 * src/data/presets.test.ts
 *
 * Cobertura do catalogo de presets como dados puros (REG-03). Valida que cada
 * persona tem o pacote completo dos 11 campos avancados, valores no shape do
 * AdvancedFieldsSchema, e rotulo/descricao nao-vazios. O catalogo nao tem UI
 * nesta fase (Phase 14); aqui travamos so o CONTRATO dos dados.
 */

import { describe, it, expect } from "vitest";
import { PRESETS, PRESET_KEYS, type PresetEntry } from "./presets";
import { AdvancedFieldsSchema } from "./schema";

/** Os 11 campos avancados que cada persona completa deve preencher (D-01/D-04). */
const ELEVEN_FIELDS = [
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

const entries = Object.entries(PRESETS) as [string, PresetEntry][];

describe("PRESETS — REG-03 catalogo de personas", () => {
  it("tem ao menos 10 entradas (D-02)", () => {
    expect(entries.length).toBeGreaterThanOrEqual(10);
  });

  it("cada preset.fields passa AdvancedFieldsSchema.parse", () => {
    for (const [key, entry] of entries) {
      const result = AdvancedFieldsSchema.safeParse(entry.fields);
      expect(result.success, `preset "${key}" fields invalido`).toBe(true);
    }
  });

  it("cada preset tem label e description nao-vazios", () => {
    for (const [key, entry] of entries) {
      expect(entry.label.trim().length, `preset "${key}" label vazio`).toBeGreaterThan(0);
      expect(
        entry.description.trim().length,
        `preset "${key}" description vazio`
      ).toBeGreaterThan(0);
    }
  });

  it("cada preset preenche os 11 campos avancados (persona completa, D-01)", () => {
    for (const [key, entry] of entries) {
      for (const field of ELEVEN_FIELDS) {
        const value = entry.fields[field];
        expect(value, `preset "${key}" sem campo "${field}"`).toBeTypeOf("number");
        expect(Number.isFinite(value as number)).toBe(true);
        expect(value as number).toBeGreaterThanOrEqual(0);
        expect(value as number).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("PRESET_KEYS — alinhamento com PRESETS", () => {
  it("bate exatamente com as chaves de PRESETS", () => {
    expect([...PRESET_KEYS].sort()).toEqual(Object.keys(PRESETS).sort());
  });
});
