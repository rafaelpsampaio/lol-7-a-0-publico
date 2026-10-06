import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PlayerDatabaseSchema, type PlayerVersion, type Role } from "./schema";
import { deckSafety, deckShortfalls } from "../draft/deckSafety";
import { buildBotRosters } from "../tournament/bracket";
import { simulateMatch } from "../sim/engine";
import { assignFearlessChampionsBothTeams } from "../sim/fearless";
import { DEFAULT_SIM_CONFIG } from "../sim/matchState";
import { mulberry32 } from "../sim/rng";
import { computeRealismMetrics, type GameRecord } from "../../scripts/realism-metrics";

const players = PlayerDatabaseSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "public/packs/amigos.json"), "utf8"))
).players;
const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

describe("public/packs/amigos.json (contrato)", () => {
  it("ids unicos", () => {
    expect(new Set(players.map((p) => p.id)).size).toBe(players.length);
  });

  it("nomes de carta unicos (A-08: dois times podem ter a mesma pessoa)", () => {
    expect(new Set(players.map((p) => p.displayName)).size).toBe(players.length);
  });

  it("nenhuma sequencia de escolhas deixa um dos 8 times sem rota (A-02)", () => {
    const s = deckSafety(players);
    expect(deckShortfalls(s)).toEqual([]);
    expect(s.ready).toBe(true);
  });

  it("solo: 8 times sem carta repetida e sem pessoa repetida no time (A-01)", () => {
    const usuario: PlayerVersion[] = [];
    for (const r of ROLES) {
      usuario.push(players.find((p) => p.primaryRole === r && !usuario.some((u) => u.personId === p.personId))!);
    }
    for (let seed = 1; seed <= 50; seed++) {
      const times = [usuario, ...buildBotRosters(players, seed, undefined, usuario).map((t) => t.roster)];
      const ids = times.flatMap((t) => t.map((p) => p.id));
      expect(new Set(ids).size, `seed ${seed}`).toBe(40);
      for (const t of times) expect(new Set(t.map((p) => p.personId)).size, `seed ${seed}`).toBe(5);
    }
  });

  it.each([0, 0.25, 1])("motor novo: os 8 times dos amigos terminam partidas legais com Caos %s", (chaosLevel) => {
    const usuario: PlayerVersion[] = [];
    for (const r of ROLES) {
      usuario.push(players.find((p) => p.primaryRole === r && !usuario.some((u) => u.personId === p.personId))!);
    }
    const games: GameRecord[] = [];
    for (let seed = 1; seed <= 4; seed++) {
      const times = [usuario, ...buildBotRosters(players, seed, undefined, usuario).map((t) => t.roster)];
      for (let i = 0; i < times.length; i += 2) {
        const [a, b] = [times[i]!, times[i + 1]!];
        const champs = assignFearlessChampionsBothTeams(a, b, 5);
        const result = simulateMatch(a, b, mulberry32(seed * 10 + i), {
          ...DEFAULT_SIM_CONFIG, comebackElasticity: chaosLevel,
        }, { userChampions: champs.teamA[0], rivalChampions: champs.teamB[0] });
        expect(["user", "rival"]).toContain(result.winner);
        expect(result.durationSec).toBeGreaterThan(0);
        expect(result.durationSec).toBeLessThan(3600);
        for (const e of result.timeline) {
          expect(Object.values(e.score).filter((v) => typeof v === "number").every(Number.isFinite)).toBe(true);
          if (e.timeSec < 90) expect(e.score.userKills + e.score.rivalKills).toBe(0);
        }
        games.push({ result, ratingGap: 0 });
      }
    }
    expect(games).toHaveLength(16);
    expect(computeRealismMetrics(games).hardRuleViolations).toBe(0);
  });
});
