/**
 * src/data/loader.test.ts
 *
 * Tests for loadPlayers() — DATA-07 (static asset via fetch) and DATA-05
 * (readable validation errors naming card and field on failure).
 *
 * Mocks global fetch via vi.stubGlobal so no real network call is made.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { loadPlayers, loadChampions, loadPlayerDatabase } from "./loader";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function validPlayer(overrides: Record<string, unknown> = {}) {
  return {
    id: "faker-2016",
    personId: "faker",
    displayName: "Faker 2016",
    year: 2016,
    roles: ["mid"],
    primaryRole: "mid",
    roleStrength: { top: 0, jungle: 0, mid: 96, adc: 0, support: 0 },
    lanePhase: 95,
    midGame: 97,
    lateGame: 94,
    traits: ["clutch_player", "mental_fort"],
    championPool: [
      { championId: "leblanc", mastery: 5 },
      { championId: "zed", mastery: 5 },
      { championId: "ryze", mastery: 4 },
      { championId: "orianna", mastery: 4 },
      { championId: "twisted-fate", mastery: 3 },
      { championId: "cassiopeia", mastery: 3 },
      { championId: "galio", mastery: 2 },
      { championId: "corki", mastery: 2 },
    ],
    ...overrides,
  };
}

/** Create a minimal mock Response that resolves json() to the given body */
function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Not Found",
    json: async () => body,
  };
}

// Restore fetch after each test so stubs don't leak
afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Happy path: valid payload
// ---------------------------------------------------------------------------

describe("loadPlayers — valid payload", () => {
  it("resolves to an array whose length matches the fixture", async () => {
    const players = [validPlayer(), validPlayer({ id: "uzi-2018", personId: "uzi" })];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ players })));

    const result = await loadPlayers();
    expect(result).toHaveLength(2);
  });

  it("resolves to typed PlayerVersion objects (id field present)", async () => {
    const players = [validPlayer()];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ players })));

    const result = await loadPlayers();
    expect(result[0].id).toBe("faker-2016");
  });

  it("calls fetch with the root-relative path /players.json", async () => {
    const players = [validPlayer()];
    const mockFetch = vi.fn().mockResolvedValue(mockResponse({ players }));
    vi.stubGlobal("fetch", mockFetch);

    await loadPlayers();
    expect(mockFetch).toHaveBeenCalledWith("/players.json");
  });
});

// ---------------------------------------------------------------------------
// Schema-violation path: out-of-range card
// ---------------------------------------------------------------------------

describe("loadPlayers — invalid payload (schema violation)", () => {
  it("rejects with an error when lateGame is out of range", async () => {
    const players = [validPlayer({ lateGame: 105 })];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ players })));

    await expect(loadPlayers()).rejects.toThrow();
  });

  it("error message contains the card id (faker-2016)", async () => {
    const players = [validPlayer({ lateGame: 105 })];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ players })));

    await expect(loadPlayers()).rejects.toThrow(/faker-2016/);
  });

  it("error message contains the field name (lateGame)", async () => {
    const players = [validPlayer({ lateGame: 105 })];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ players })));

    await expect(loadPlayers()).rejects.toThrow(/lateGame/);
  });

  it("error message starts with the readable header prefix", async () => {
    const players = [validPlayer({ lateGame: 105 })];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ players })));

    await expect(loadPlayers()).rejects.toThrow(/players\.json has errors/);
  });
});

// ---------------------------------------------------------------------------
// Non-ok response (e.g. 404)
// ---------------------------------------------------------------------------

describe("loadPlayers — non-ok HTTP response", () => {
  it("rejects when fetch returns a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({}, false, 404))
    );

    await expect(loadPlayers()).rejects.toThrow();
  });

  it("error message contains the HTTP status code (404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({}, false, 404))
    );

    await expect(loadPlayers()).rejects.toThrow(/404/);
  });
});

// ===========================================================================
// loadChampions() — D-01 / SIM-06: static-asset catalogue loader, mirrors
// loadPlayers() (fetch /champions.json → safeParse → never-throw → typed array)
// ===========================================================================

function validCatalogue() {
  return {
    champions: [
      { id: "ahri", name: "Ahri", traits: ["high_first_blood", "late_scaling"] },
      { id: "aatrox", name: "Aatrox", traits: ["early_dominant"] },
      { id: "neutral", name: "Neutral", traits: [] },
    ],
  };
}

describe("loadChampions — valid catalogue", () => {
  it("resolves to a ChampionEntry[] whose length matches the fixture", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse(validCatalogue()))
    );

    const result = await loadChampions();
    expect(result).toHaveLength(3);
  });

  it("resolves to typed entries (id + a known trait present)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse(validCatalogue()))
    );

    const result = await loadChampions();
    expect(result[0].id).toBe("ahri");
    expect(result[0].traits).toContain("high_first_blood");
  });

  it("calls fetch with the root-relative path /champions.json", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockResponse(validCatalogue()));
    vi.stubGlobal("fetch", mockFetch);

    await loadChampions();
    expect(mockFetch).toHaveBeenCalledWith("/champions.json");
  });
});

describe("loadChampions — invalid catalogue (schema violation)", () => {
  it("rejects when an entry has 3 traits (exceeds max 2)", async () => {
    const bad = {
      champions: [
        {
          id: "x",
          name: "X",
          traits: ["high_first_blood", "late_scaling", "teamfight"],
        },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(bad)));

    await expect(loadChampions()).rejects.toThrow(/champions\.json has errors/);
  });

  it("rejects when an entry has an unknown trait string", async () => {
    const bad = {
      champions: [{ id: "x", name: "X", traits: ["not_a_trait"] }],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(bad)));

    await expect(loadChampions()).rejects.toThrow(/champions\.json has errors/);
  });
});

describe("loadChampions — non-ok HTTP response", () => {
  it("rejects when fetch returns a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({}, false, 404))
    );

    await expect(loadChampions()).rejects.toThrow();
  });

  it("error message names champions.json and the status (404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({}, false, 404))
    );

    await expect(loadChampions()).rejects.toThrow(/champions\.json/);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({}, false, 404))
    );
    await expect(loadChampions()).rejects.toThrow(/404/);
  });
});

describe("loadPlayerDatabase (A-09)", () => {
  it("le o arquivo da URL pedida e valida no formato players.json", async () => {
    const fetchMock = vi.fn(async () => mockResponse({ players: [validPlayer()] }));
    vi.stubGlobal("fetch", fetchMock);
    const players = await loadPlayerDatabase("/packs/amigos.json");
    expect(fetchMock).toHaveBeenCalledWith("/packs/amigos.json");
    expect(players).toHaveLength(1);
  });

  it("nomeia o arquivo no erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse({}, false, 404)));
    await expect(loadPlayerDatabase("/packs/amigos.json")).rejects.toThrow(/packs\/amigos\.json/);
  });
});
