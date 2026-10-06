/**
 * src/storage/championOverrides.test.ts
 *
 * Unit tests for the pure `mergeOverrides` helper (D-03). Covers: override
 * replaces traits, untouched entries pass through unchanged, immutability of the
 * input catalogue, the 2-trait cap, and unknown-id overrides being ignored.
 */

import { describe, it, expect } from "vitest";
import { mergeOverrides, type ChampionOverrides } from "./championOverrides";
import type { ChampionEntry } from "../data/schema";

const catalogue: ChampionEntry[] = [
  { id: "ahri", name: "Ahri", traits: ["high_first_blood", "late_scaling"] },
  { id: "aatrox", name: "Aatrox", traits: ["early_dominant"] },
  { id: "yuumi", name: "Yuumi", traits: [] },
];

describe("mergeOverrides", () => {
  it("replaces the traits of an overridden champion (override wins)", () => {
    const overrides: ChampionOverrides = { ahri: ["teamfight"] };
    const merged = mergeOverrides(catalogue, overrides);
    expect(merged.find((c) => c.id === "ahri")?.traits).toEqual(["teamfight"]);
  });

  it("passes non-overridden entries through unchanged", () => {
    const overrides: ChampionOverrides = { ahri: ["teamfight"] };
    const merged = mergeOverrides(catalogue, overrides);
    expect(merged.find((c) => c.id === "aatrox")?.traits).toEqual([
      "early_dominant",
    ]);
    expect(merged.find((c) => c.id === "yuumi")?.traits).toEqual([]);
  });

  it("does not mutate the input catalogue", () => {
    const overrides: ChampionOverrides = { ahri: ["teamfight"] };
    mergeOverrides(catalogue, overrides);
    expect(catalogue.find((c) => c.id === "ahri")?.traits).toEqual([
      "high_first_blood",
      "late_scaling",
    ]);
  });

  it("returns an empty-override merge equal in content to the catalogue", () => {
    const merged = mergeOverrides(catalogue, {});
    expect(merged).toEqual(catalogue);
  });

  it("caps an override at 2 traits", () => {
    const overrides: ChampionOverrides = {
      yuumi: ["teamfight", "late_scaling", "objective_control"] as never,
    };
    const merged = mergeOverrides(catalogue, overrides);
    expect(merged.find((c) => c.id === "yuumi")?.traits).toHaveLength(2);
  });

  it("ignores override entries for champion ids not in the catalogue", () => {
    const overrides: ChampionOverrides = { "does-not-exist": ["teamfight"] };
    const merged = mergeOverrides(catalogue, overrides);
    expect(merged).toHaveLength(catalogue.length);
    expect(merged.find((c) => c.id === "does-not-exist")).toBeUndefined();
  });

  it("clears traits when the override is an empty array", () => {
    const overrides: ChampionOverrides = { ahri: [] };
    const merged = mergeOverrides(catalogue, overrides);
    // Empty array is falsy-checked via `!override` → an empty [] is still an
    // object, so it IS applied: traits become [].
    expect(merged.find((c) => c.id === "ahri")?.traits).toEqual([]);
  });
});
