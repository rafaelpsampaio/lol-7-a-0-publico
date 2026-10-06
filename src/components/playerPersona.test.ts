/**
 * src/components/playerPersona.test.ts
 *
 * Testes puros (vitest environment=node, sem DOM) para os helpers de match de persona:
 *  - PRESET_FIELD_KEYS: lista exata dos 11 campos avancados
 *  - matchesPreset(adv, fields): comparacao exata com tolerancia EPS=1e-6
 *  - activePersona(card): detecta a persona ativa (key | "__custom__" | "auto")
 *
 * D-06 / REG-03 / REG-04
 */

import { describe, it, expect } from "vitest";
import {
  PRESET_FIELD_KEYS,
  matchesPreset,
  activePersona,
} from "./playerPersona";
import { PRESETS, PRESET_KEYS } from "../data/presets";
import type { PlayerVersion } from "../data/schema";

/** Os 11 campos avancados (mesma ordem de ELEVEN_FIELDS em presets.test.ts). */
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

/** Card minimo valido sem advanced. */
function makeCard(overrides: Partial<PlayerVersion> = {}): PlayerVersion {
  return {
    id: "test-mid-2020",
    personId: "test",
    displayName: "Test Mid 2020",
    year: 2020,
    roles: ["mid"],
    primaryRole: "mid",
    roleStrength: { top: 0, jungle: 0, mid: 80, adc: 0, support: 0 },
    lanePhase: 70,
    midGame: 70,
    lateGame: 70,
    traits: [],
    championPool: Array.from({ length: 8 }, (_, i) => ({
      championId: `champ-${i}`,
      mastery: 3 as const,
    })),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PRESET_FIELD_KEYS
// ---------------------------------------------------------------------------

describe("PRESET_FIELD_KEYS", () => {
  it("lista exatamente 11 campos avancados", () => {
    expect(PRESET_FIELD_KEYS).toHaveLength(11);
  });

  it("contem os mesmos campos de ELEVEN_FIELDS (mesma lista, mesma ordem)", () => {
    expect([...PRESET_FIELD_KEYS]).toEqual([...ELEVEN_FIELDS]);
  });
});

// ---------------------------------------------------------------------------
// matchesPreset
// ---------------------------------------------------------------------------

describe("matchesPreset", () => {
  it("retorna true para copias identicas de um preset", () => {
    const fields = { ...PRESETS["ok"].fields };
    expect(matchesPreset(fields, PRESETS["ok"].fields)).toBe(true);
  });

  it("retorna false quando um campo difere por >= 0.1", () => {
    const fields = { ...PRESETS["ok"].fields, riskProfile: PRESETS["ok"].fields.riskProfile + 0.1 };
    expect(matchesPreset(fields, PRESETS["ok"].fields)).toBe(false);
  });

  it("retorna true para diferenca menor que EPS=1e-6 (tolerancia numerica)", () => {
    const fields = { ...PRESETS["perna"].fields, deathRisk: PRESETS["perna"].fields.deathRisk + 1e-8 };
    expect(matchesPreset(fields, PRESETS["perna"].fields)).toBe(true);
  });

  it("retorna false quando um campo esta ausente (trata ausente como nao-match)", () => {
    const incomplete: Record<string, number> = { ...PRESETS["ok"].fields };
    delete incomplete["riskProfile"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(matchesPreset(incomplete as any, PRESETS["ok"].fields)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// activePersona
// ---------------------------------------------------------------------------

describe("activePersona", () => {
  it("retorna 'auto' quando card nao tem advanced", () => {
    const card = makeCard();
    expect(card.advanced).toBeUndefined();
    expect(activePersona(card)).toBe("auto");
  });

  it("retorna 'auto' quando advanced e objeto vazio", () => {
    const card = makeCard({ advanced: {} });
    expect(activePersona(card)).toBe("auto");
  });

  it("retorna a key correta para cada uma das 12 personas (advanced == PRESETS[k].fields)", () => {
    for (const k of PRESET_KEYS) {
      const card = makeCard({ advanced: { ...PRESETS[k].fields } });
      expect(activePersona(card), `persona ${k}`).toBe(k);
    }
  });

  it("retorna '__custom__' quando advanced existe mas nao bate com nenhuma persona (1 campo editado)", () => {
    const base = { ...PRESETS["ok"].fields };
    // Editar 1 campo para sair do preset
    const customAdv = { ...base, riskProfile: Math.min(1, base.riskProfile + 0.3) };
    const card = makeCard({ advanced: customAdv });
    expect(activePersona(card)).toBe("__custom__");
  });
});
