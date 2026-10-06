import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDraft, autoPick, isFinished, incompleteSeats, takenCardIds, type TurnBudget } from "./draft";
import { ALL_ROLES, PlayerDatabaseSchema } from "../engine/schema";

const players = PlayerDatabaseSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "public/packs/amigos.json"), "utf8"))
).players;
const SEM_RELOGIO: TurnBudget = () => null;

describe("draft da sala com a base dos amigos (A-01, A-02)", () => {
  it("50 drafts de bots fecham os 8 times sem vaga, sem carta repetida e sem pessoa repetida no time", () => {
    const porId = new Map(players.map((p) => [p.id, p]));
    for (let s = 0; s < 50; s++) {
      let d = createDraft({ players, humans: [], seed: `amigos-${s}`, now: 0, budget: SEM_RELOGIO });
      let guarda = 0;
      while (!isFinished(d) && guarda++ < 100) d = autoPick(d, players, 0, SEM_RELOGIO);
      expect(incompleteSeats(d), `seed ${s}`).toEqual([]);
      expect(takenCardIds(d).size, `seed ${s}`).toBe(40);
      for (const seat of d.seats) {
        const pessoas = ALL_ROLES.map((r) => porId.get(seat.picks[r]!)!.personId);
        expect(new Set(pessoas).size, `seed ${s} ${seat.teamName}`).toBe(5);
      }
    }
  });
});
