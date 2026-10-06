import { describe, it, expect } from "vitest";
import { TRAIT_INFO } from "./traitInfo";
import { PlayerTraitSchema } from "./schema";

describe("TRAIT_INFO", () => {
  it("toda trait do catalogo tem rotulo e descricao", () => {
    for (const t of PlayerTraitSchema.options) {
      expect(TRAIT_INFO[t].label.length, t).toBeGreaterThan(0);
      expect(TRAIT_INFO[t].description.length, t).toBeGreaterThan(0);
    }
  });

  it("rotulos sao unicos (o importador traduz rotulo de volta para trait)", () => {
    const labels = PlayerTraitSchema.options.map((t) => TRAIT_INFO[t].label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("quits aparece como Quita", () => {
    expect(TRAIT_INFO.quits.label).toBe("Quita");
  });
});
