import { describe, it, expect } from "vitest";
import { buildBotRosters } from "./bracket";
import type { PlayerVersion, Role } from "../data/schema";
import { makePlayer } from "../__tests__/helpers/makePlayer";

const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

/** 8 pessoas de uma rota so por rota, mais "rafa" com versoes em top, mid e adc. */
function pool(): PlayerVersion[] {
  const cartas = ROLES.flatMap((r) =>
    Array.from({ length: 8 }, (_, i) => makePlayer(r, { id: `${r}-${i}`, personId: `${r}-${i}` }))
  );
  cartas.push(
    makePlayer("top", { id: "rafa-top", personId: "rafa" }),
    makePlayer("mid", { id: "rafa-mid", personId: "rafa" }),
    makePlayer("adc", { id: "rafa-adc", personId: "rafa" })
  );
  return cartas;
}

describe("buildBotRosters (A-01)", () => {
  it("nenhuma carta em dois dos 8 times e nenhum time repete pessoa", () => {
    const players = pool();
    const usuario = ROLES.map((r) => players.find((p) => p.id === `${r}-0`)!);
    for (let seed = 1; seed <= 30; seed++) {
      const bots = buildBotRosters(players, seed, undefined, usuario);
      expect(bots).toHaveLength(7);
      const times = [usuario, ...bots.map((t) => t.roster)];
      const ids = times.flatMap((t) => t.map((p) => p.id));
      expect(new Set(ids).size, `seed ${seed}`).toBe(40);
      for (const t of times) {
        const pessoas = t.map((p) => p.personId);
        expect(new Set(pessoas).size, `seed ${seed}`).toBe(5);
      }
    }
  });
});
