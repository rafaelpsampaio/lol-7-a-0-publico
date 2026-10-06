/**
 * src/sim/championMeta.test.ts
 *
 * Cobertura do modulo de archetype (CHAMP-01 / CHAMP-02 / CHAMP-04) + finitude
 * dos campos numericos (sem NaN/Infinity). Os valores sao inertes na Phase 7;
 * estes testes travam o CONTRATO do shape e da resolucao sempre-finita para que
 * a Phase 8+ possa ler `meta` sem checagens defensivas.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
  championMetaFor,
  CHAMPION_META,
  ROLE_DEFAULTS,
  type ChampionMeta,
} from "./championMeta";
import { ROLES } from "./matchState";

const here = dirname(fileURLToPath(import.meta.url));

/** Os championIds reais do players.json (CHAMP-04). */
function playersJsonChampionIds(): string[] {
  const path = resolve(here, "../../public/players.json");
  const db = JSON.parse(readFileSync(path, "utf8")) as {
    players: { championPool: { championId: string }[] }[];
  };
  const ids = new Set<string>();
  for (const p of db.players) {
    for (const c of p.championPool) ids.add(c.championId);
  }
  return [...ids];
}

/** Os championIds canonicos do champions.json (fonte da verdade dos IDs). */
function canonicalChampionIds(): string[] {
  const path = resolve(here, "../../public/champions.json");
  const db = JSON.parse(readFileSync(path, "utf8")) as {
    champions: { id: string }[];
  };
  return db.champions.map((c) => c.id);
}

/** Verifica que os tres biases sao finitos (nunca NaN/Infinity). */
function biasesFinite(m: ChampionMeta): boolean {
  return (
    Number.isFinite(m.killBias) &&
    Number.isFinite(m.assistBias) &&
    Number.isFinite(m.deathRisk)
  );
}

describe("championMetaFor — resolucao sempre-finita por role (CHAMP-02)", () => {
  it("retorna ROLE_DEFAULTS[role] para championId undefined em todos os 5 roles", () => {
    for (const role of ROLES) {
      expect(championMetaFor(undefined, role)).toBe(ROLE_DEFAULTS[role]);
    }
  });

  it("retorna ROLE_DEFAULTS[role] para championId null em todos os 5 roles", () => {
    for (const role of ROLES) {
      expect(championMetaFor(null, role)).toBe(ROLE_DEFAULTS[role]);
    }
  });

  it("retorna ROLE_DEFAULTS[role] para championId vazio em todos os 5 roles", () => {
    for (const role of ROLES) {
      expect(championMetaFor("", role)).toBe(ROLE_DEFAULTS[role]);
    }
  });

  it("retorna ROLE_DEFAULTS[role] para championId desconhecido (fallback)", () => {
    for (const role of ROLES) {
      expect(championMetaFor("id-que-nao-existe-9999", role)).toBe(
        ROLE_DEFAULTS[role]
      );
    }
  });

  it("retorna a entrada explicita para um championId conhecido", () => {
    expect(championMetaFor("akali", "mid")).toBe(CHAMPION_META.akali);
    expect(championMetaFor("jarvan-iv", "jungle")).toBe(
      CHAMPION_META["jarvan-iv"]
    );
  });
});

describe("ROLE_DEFAULTS — cobertura e finitude (CHAMP-02)", () => {
  it("cobre exatamente os 5 roles sem undefined", () => {
    for (const role of ROLES) {
      expect(ROLE_DEFAULTS[role]).toBeDefined();
    }
    expect(Object.keys(ROLE_DEFAULTS).sort()).toEqual([...ROLES].sort());
  });

  it("todo default de role tem biases finitos (sem NaN/Infinity)", () => {
    for (const role of ROLES) {
      expect(biasesFinite(ROLE_DEFAULTS[role]), role).toBe(true);
    }
  });
});

describe("CHAMPION_META — cobertura dos 73 IDs do players.json (CHAMP-01/04)", () => {
  it("cada championId do players.json tem ENTRADA EXPLICITA (nao fallback)", () => {
    const ids = playersJsonChampionIds();
    expect(ids.length).toBeGreaterThanOrEqual(73);
    const missing = ids.filter((id) => !(id in CHAMPION_META));
    expect(missing, `IDs sem entrada explicita: ${missing.join(", ")}`).toEqual(
      []
    );
  });

  it("escopo expandido: cobre o roster completo do jogo (> 73 entradas)", () => {
    // Expansao de escopo aprovada no checkpoint 07-01: todos os campeoes, nao
    // apenas os 73 usados no players.json de teste.
    expect(Object.keys(CHAMPION_META).length).toBeGreaterThan(73);
  });
});

describe("CHAMPION_META — contrato de ID canonico (CR-01 guard)", () => {
  it("toda chave de CHAMPION_META e um championId canonico do champions.json", () => {
    const canon = new Set(canonicalChampionIds());
    const naoCanonicas = Object.keys(CHAMPION_META).filter(
      (id) => !canon.has(id)
    );
    expect(
      naoCanonicas,
      `chaves nao-canonicas (id errado): ${naoCanonicas.join(", ")}`
    ).toEqual([]);
  });

  it("todo campeao canonico tem ENTRADA EXPLICITA em CHAMPION_META", () => {
    const faltando = canonicalChampionIds().filter(
      (id) => !(id in CHAMPION_META)
    );
    expect(
      faltando,
      `campeoes canonicos sem entrada: ${faltando.join(", ")}`
    ).toEqual([]);
  });
});

describe("Finitude — nenhuma entrada produz NaN (Armadilha 2)", () => {
  it("toda entrada de CHAMPION_META tem os 3 biases finitos", () => {
    for (const [id, meta] of Object.entries(CHAMPION_META)) {
      expect(biasesFinite(meta), id).toBe(true);
    }
  });

  it("toda entrada de CHAMPION_META tem os 7 campos do shape presentes", () => {
    for (const [id, meta] of Object.entries(CHAMPION_META)) {
      expect(typeof meta.primaryClass, id).toBe("string");
      expect(Array.isArray(meta.functionalTags), id).toBe(true);
      expect(typeof meta.econProfile, id).toBe("string");
      expect(typeof meta.scalingCurve, id).toBe("string");
      expect(typeof meta.killBias, id).toBe("number");
      expect(typeof meta.assistBias, id).toBe("number");
      expect(typeof meta.deathRisk, id).toBe("number");
    }
  });
});
