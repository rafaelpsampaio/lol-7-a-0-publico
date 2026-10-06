import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
  PlayerVersionSchema,
  PlayerDatabaseSchema,
  PlayerTraitSchema,
  ChampionTraitSchema,
  ChampionEntrySchema,
  ChampionCatalogueSchema,
  AdvancedFieldsSchema,
} from "./schema";

const here = dirname(fileURLToPath(import.meta.url));

// ---- helpers ----

function validChampionPool(count: number) {
  const champs = [
    "zed", "leblanc", "ryze", "orianna", "twisted-fate",
    "cassiopeia", "galio", "corki", "ahri", "syndra",
  ];
  return champs.slice(0, count).map((championId) => ({
    championId,
    mastery: 3 as const,
  }));
}

const validCard = {
  id: "faker-2016",
  personId: "faker",
  displayName: "Faker 2016",
  year: 2016,
  roles: ["mid"] as const,
  primaryRole: "mid" as const,
  roleStrength: { top: 0, jungle: 0, mid: 96, adc: 0, support: 0 },
  lanePhase: 95,
  midGame: 97,
  lateGame: 94,
  traits: ["clutch_player", "mental_fort"] as const,
  championPool: validChampionPool(8),
};

// ---- DATA-01: valid card passes ----

describe("PlayerVersionSchema — DATA-01 valid card", () => {
  it("accepts a fully-valid player card", () => {
    const result = PlayerVersionSchema.safeParse(validCard);
    expect(result.success).toBe(true);
  });
});

// ---- DATA-02: lanePhase / midGame / lateGame ranges ----

describe("PlayerVersionSchema — DATA-02 phase overalls", () => {
  it("rejects lanePhase of 105 (above max 100)", () => {
    const result = PlayerVersionSchema.safeParse({ ...validCard, lanePhase: 105 });
    expect(result.success).toBe(false);
  });

  it("rejects lanePhase of 0 (below min 1)", () => {
    const result = PlayerVersionSchema.safeParse({ ...validCard, lanePhase: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects midGame of 105 (above max 100)", () => {
    const result = PlayerVersionSchema.safeParse({ ...validCard, midGame: 105 });
    expect(result.success).toBe(false);
  });

  it("rejects midGame of 0 (below min 1)", () => {
    const result = PlayerVersionSchema.safeParse({ ...validCard, midGame: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects lateGame of 105 (above max 100)", () => {
    const result = PlayerVersionSchema.safeParse({ ...validCard, lateGame: 105 });
    expect(result.success).toBe(false);
  });

  it("rejects lateGame of 0 (below min 1)", () => {
    const result = PlayerVersionSchema.safeParse({ ...validCard, lateGame: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts lanePhase of 1 (min boundary)", () => {
    const result = PlayerVersionSchema.safeParse({ ...validCard, lanePhase: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts lanePhase of 100 (max boundary)", () => {
    const result = PlayerVersionSchema.safeParse({ ...validCard, lanePhase: 100 });
    expect(result.success).toBe(true);
  });
});

// ---- DATA-03: champion pool min-8 and mastery 1-5 ----

describe("PlayerVersionSchema — DATA-03 champion pool", () => {
  it("rejects championPool with 7 entries (below min 8)", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      championPool: validChampionPool(7),
    });
    expect(result.success).toBe(false);
  });

  it("accepts championPool with exactly 8 entries", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      championPool: validChampionPool(8),
    });
    expect(result.success).toBe(true);
  });

  it("accepts championPool with 10 entries", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      championPool: validChampionPool(10),
    });
    expect(result.success).toBe(true);
  });

  it("rejects mastery value of 6 (above max 5)", () => {
    const badCard = {
      ...validCard,
      championPool: [
        { championId: "zed", mastery: 6 },
        ...validChampionPool(7),
      ],
    };
    const result = PlayerVersionSchema.safeParse(badCard as unknown);
    expect(result.success).toBe(false);
  });

  it("rejects mastery value of 0 (below min 1)", () => {
    const badCard = {
      ...validCard,
      championPool: [
        { championId: "zed", mastery: 0 },
        ...validChampionPool(7),
      ],
    };
    const result = PlayerVersionSchema.safeParse(badCard as unknown);
    expect(result.success).toBe(false);
  });

  it("accepts mastery value of 3", () => {
    const pool = validChampionPool(8);
    pool[0] = { championId: "zed", mastery: 3 };
    const result = PlayerVersionSchema.safeParse({ ...validCard, championPool: pool });
    expect(result.success).toBe(true);
  });
});

// ---- DATA-04: traits catalogue and max 2 ----

describe("PlayerVersionSchema — DATA-04 traits", () => {
  it("rejects 5 traits (exceeds MAX_PLAYER_TRAITS = 4)", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      traits: ["clutch_player", "mental_fort", "strong_laner", "lane_bully", "teamfights"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts 4 traits (A-05)", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      traits: ["clutch_player", "mental_fort", "flips", "side"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts the six pack-amigos traits (A-04)", () => {
    for (const t of ["teamfights", "flips", "dragon_lover", "roamer", "side", "quits"]) {
      expect(PlayerTraitSchema.safeParse(t).success, t).toBe(true);
    }
  });

  it("rejects an unknown trait string", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      traits: ["cluch_player"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty traits array", () => {
    const result = PlayerVersionSchema.safeParse({ ...validCard, traits: [] });
    expect(result.success).toBe(true);
  });

  it("accepts a single valid trait", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      traits: ["baron_stealer"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts exactly 2 valid traits", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      traits: ["tilts_on_death", "plays_worse_when_behind"],
    });
    expect(result.success).toBe(true);
  });
});

// ---- roleStrength enforcement ----

describe("PlayerVersionSchema — roleStrength", () => {
  it("rejects roleStrength missing a required role key", () => {
    const { support: _s, ...incomplete } = validCard.roleStrength;
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      roleStrength: incomplete,
    });
    expect(result.success).toBe(false);
  });

  it("rejects roleStrength with an invalid key like 'suport'", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      roleStrength: { top: 0, jungle: 0, mid: 96, adc: 0, suport: 0 },
    });
    expect(result.success).toBe(false);
  });
});

// ---- strict object (no unknown keys) ----

describe("PlayerVersionSchema — strict mode", () => {
  it("rejects an unknown top-level key on a card", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      unknownField: "surprise",
    });
    expect(result.success).toBe(false);
  });
});

// ---- PlayerDatabaseSchema ----

describe("PlayerDatabaseSchema", () => {
  it("accepts { players: [validCard] }", () => {
    const result = PlayerDatabaseSchema.safeParse({ players: [validCard] });
    expect(result.success).toBe(true);
  });

  it("accepts { players: [], $schema: '...' } (convenience key allowed)", () => {
    const result = PlayerDatabaseSchema.safeParse({
      players: [],
      $schema: "./players.schema.json",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown top-level key on database object", () => {
    const result = PlayerDatabaseSchema.safeParse({
      players: [validCard],
      extraKey: "nope",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D-06: trash_talker added to PlayerTraitSchema (the 8 Phase-1 values still parse)
// ---------------------------------------------------------------------------

describe("PlayerTraitSchema — D-06 trash_talker", () => {
  it("accepts the new trash_talker value", () => {
    expect(PlayerTraitSchema.safeParse("trash_talker").success).toBe(true);
  });

  it("still accepts all 8 Phase-1 trait values", () => {
    const phase1 = [
      "tilts_on_death",
      "plays_worse_when_behind",
      "clutch_player",
      "objective_focused",
      "baron_stealer",
      "strong_laner",
      "mental_fort",
      "lane_bully",
    ];
    for (const t of phase1) {
      expect(PlayerTraitSchema.safeParse(t).success).toBe(true);
    }
  });

  it("rejects an unknown trait string", () => {
    expect(PlayerTraitSchema.safeParse("not_a_trait").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D-04: ChampionTraitSchema — 5-value enum
// ---------------------------------------------------------------------------

describe("ChampionTraitSchema — D-04 five champion traits", () => {
  it("accepts each of the five catalogue values", () => {
    const five = [
      "high_first_blood",
      "objective_control",
      "late_scaling",
      "early_dominant",
      "teamfight",
    ];
    for (const t of five) {
      expect(ChampionTraitSchema.safeParse(t).success).toBe(true);
    }
  });

  it("rejects any other string", () => {
    expect(ChampionTraitSchema.safeParse("high_first").success).toBe(false);
    expect(ChampionTraitSchema.safeParse("tank").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ChampionEntrySchema — { id, name, traits } strict, max 2 traits
// ---------------------------------------------------------------------------

describe("ChampionEntrySchema", () => {
  const validEntry = {
    id: "ahri",
    name: "Ahri",
    traits: ["high_first_blood", "late_scaling"],
  };

  it("accepts a valid entry with two traits", () => {
    expect(ChampionEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  it("accepts an entry with zero traits", () => {
    expect(
      ChampionEntrySchema.safeParse({ id: "neutral", name: "Neutral", traits: [] })
        .success
    ).toBe(true);
  });

  it("rejects an entry with three traits (exceeds max 2)", () => {
    expect(
      ChampionEntrySchema.safeParse({
        ...validEntry,
        traits: ["high_first_blood", "late_scaling", "teamfight"],
      }).success
    ).toBe(false);
  });

  it("rejects an entry with an unknown trait", () => {
    expect(
      ChampionEntrySchema.safeParse({ ...validEntry, traits: ["bogus"] }).success
    ).toBe(false);
  });

  it("rejects an empty id", () => {
    expect(
      ChampionEntrySchema.safeParse({ ...validEntry, id: "" }).success
    ).toBe(false);
  });

  it("rejects an unknown field (strict)", () => {
    expect(
      ChampionEntrySchema.safeParse({ ...validEntry, extra: "nope" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ChampionCatalogueSchema — { $schema?, champions }
// ---------------------------------------------------------------------------

describe("ChampionCatalogueSchema", () => {
  it("accepts { champions: [validEntry] }", () => {
    const result = ChampionCatalogueSchema.safeParse({
      champions: [{ id: "aatrox", name: "Aatrox", traits: ["early_dominant"] }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional $schema string", () => {
    const result = ChampionCatalogueSchema.safeParse({
      $schema: "./champions.schema.json",
      champions: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown top-level key (strict)", () => {
    const result = ChampionCatalogueSchema.safeParse({
      champions: [],
      extraKey: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a catalogue containing a 3-trait entry", () => {
    const result = ChampionCatalogueSchema.safeParse({
      champions: [
        {
          id: "x",
          name: "X",
          traits: ["high_first_blood", "late_scaling", "teamfight"],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// REG-01 / D-16 — round-trip do players.json REAL + bloco advanced
//
// Este bloco e a GUARDA do invariante "campo novo nunca obrigatorio". O
// players.json atual NAO tem o campo `advanced`; como AdvancedFieldsSchema e
// `.optional()` no card, o parse do arquivo real precisa NAO lancar. Se algum
// dia o `advanced` (ou qualquer campo novo) virasse obrigatorio, este teste
// quebraria de imediato (o arquivo real deixaria de parsear).
// ---------------------------------------------------------------------------

describe("PlayerDatabaseSchema — REG-01 round-trip do players.json real", () => {
  it("parseia o public/players.json atual sem lancar (campo advanced ausente e ok)", () => {
    const path = resolve(here, "../../public/players.json");
    const raw = JSON.parse(readFileSync(path, "utf8"));
    expect(() => PlayerDatabaseSchema.parse(raw)).not.toThrow();
  });

  it("aceita um card com bloco advanced parcial (so riskProfile preenchido)", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      advanced: { riskProfile: 0.7 },
    });
    expect(result.success).toBe(true);
  });

  it("rejeita um card com campo desconhecido dentro de advanced (.strict())", () => {
    const result = PlayerVersionSchema.safeParse({
      ...validCard,
      advanced: { riskProfile: 0.5, campoDesconhecido: 1 },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AdvancedFieldsSchema — escala, opcionalidade e .strict()
// ---------------------------------------------------------------------------

describe("AdvancedFieldsSchema — REG-01 shape do bloco advanced", () => {
  it("aceita um objeto vazio (todos os campos sao opcionais)", () => {
    expect(AdvancedFieldsSchema.safeParse({}).success).toBe(true);
  });

  it("aceita o pacote completo dos 11 campos no intervalo 0-1", () => {
    const result = AdvancedFieldsSchema.safeParse({
      riskProfile: 0.5,
      resourceDemand: 0.5,
      weaksideTolerance: 0.5,
      carryPotential: 0.5,
      volatility: 0.5,
      shotcalling: 0.5,
      roamTendency: 0.5,
      sideLaneDiscipline: 0.5,
      killBias: 0.5,
      assistBias: 0.5,
      deathRisk: 0.5,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita um campo acima de 1", () => {
    expect(AdvancedFieldsSchema.safeParse({ riskProfile: 1.5 }).success).toBe(false);
  });

  it("rejeita um campo abaixo de 0", () => {
    expect(AdvancedFieldsSchema.safeParse({ deathRisk: -0.1 }).success).toBe(false);
  });

  it("rejeita uma chave desconhecida (.strict())", () => {
    expect(AdvancedFieldsSchema.safeParse({ foo: 0.5 }).success).toBe(false);
  });

  it("rejeita notes acima de 500 caracteres", () => {
    expect(
      AdvancedFieldsSchema.safeParse({ notes: "x".repeat(501) }).success
    ).toBe(false);
  });
});

describe("PlayerVersionSchema: year opcional (A-06)", () => {
  it("aceita carta sem year", () => {
    const { year: _year, ...semAno } = validCard;
    expect(PlayerVersionSchema.safeParse(semAno).success).toBe(true);
  });

  it("continua recusando year fora de 2011-2035", () => {
    expect(PlayerVersionSchema.safeParse({ ...validCard, year: 2010 }).success).toBe(false);
  });
});
