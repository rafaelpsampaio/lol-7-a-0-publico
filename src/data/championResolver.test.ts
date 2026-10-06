import { describe, it, expect } from "vitest";
import { buildChampionResolver, canonicalChampionKey } from "./championResolver";
import type { ChampionEntry } from "./schema";

const champ = (id: string, name: string): ChampionEntry => ({ id, name, traits: [] });

const CATALOGUE: ChampionEntry[] = [
  champ("miss-fortune", "Miss Fortune"),
  champ("lee-sin", "Lee Sin"),
  champ("khazix", "Kha'Zix"),
  champ("belveth", "Bel'Veth"),
  champ("dr-mundo", "Dr. Mundo"),
  champ("twisted-fate", "Twisted Fate"),
  champ("gangplank", "Gangplank"),
  champ("yuumi", "Yuumi"),
  champ("renata", "Renata Glasc"),
  champ("monkey-king", "Wukong"),
  champ("jarvan-iv", "Jarvan IV"),
  champ("zed", "Zed"),
];

describe("canonicalChampionKey", () => {
  it("strips spaces, apostrophes and punctuation", () => {
    expect(canonicalChampionKey("Kha'Zix")).toBe("khazix");
    expect(canonicalChampionKey("Miss Fortune")).toBe("missfortune");
    expect(canonicalChampionKey("miss-fortune")).toBe("missfortune");
    expect(canonicalChampionKey("Dr. Mundo")).toBe("drmundo");
  });
});

describe("buildChampionResolver", () => {
  const resolve = buildChampionResolver(CATALOGUE);

  it("resolves an exact id verbatim", () => {
    const r = resolve("zed");
    expect(r.id).toBe("zed");
    expect(r.status).toBe("exact");
  });

  it("normalizes spaced names to kebab ids", () => {
    expect(resolve("miss fortune").id).toBe("miss-fortune");
    expect(resolve("Miss Fortune").id).toBe("miss-fortune");
    expect(resolve("lee sin").id).toBe("lee-sin");
    expect(resolve("twisted fate").id).toBe("twisted-fate");
    expect(resolve("miss fortune").status).toBe("normalized");
  });

  it("resolves apostrophe/joined ids from spaced input", () => {
    expect(resolve("kha zix").id).toBe("khazix");
    expect(resolve("Kha'Zix").id).toBe("khazix");
    expect(resolve("bel veth").id).toBe("belveth");
  });

  it("resolves by display name even when id differs (Wukong)", () => {
    expect(resolve("wukong").id).toBe("monkey-king");
  });

  it("fixes common typos via fuzzy match", () => {
    expect(resolve("gankplank").id).toBe("gangplank");
    expect(resolve("yummi").id).toBe("yuumi");
    expect(resolve("renata glasck").id).toBe("renata");
    expect(resolve("gankplank").status).toBe("fuzzy");
  });

  it("returns unresolved for nonsense", () => {
    const r = resolve("zzzqqq not a champ");
    expect(r.id).toBeUndefined();
    expect(r.status).toBe("unresolved");
  });

  it("returns unresolved for empty input", () => {
    expect(resolve("").status).toBe("unresolved");
    expect(resolve("   ").status).toBe("unresolved");
  });
});
