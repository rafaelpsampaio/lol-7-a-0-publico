import { describe, expect, it } from "vitest";
import { isSummaryEvent } from "./EventTicker";
describe("narração resumida", () => {
  it("preserva objetivos e momentos decisivos", () => {
    for (const type of ["first_blood", "dragon_taken", "dragon_steal", "baron_taken", "tower_destroyed", "shutdown", "gg"] as const) {
      expect(isSummaryEvent({type})).toBe(true);
    }
  });
  it("deixa detalhes e eventos repetitivos no histórico completo", () => {
    for (const type of ["kill", "death", "plate_taken", "tower_low", "lane_priority_shift", "ctx_adc_cleaned_fight"] as const) {
      expect(isSummaryEvent({type})).toBe(false);
    }
  });
});
