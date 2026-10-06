import { describe, it, expect } from "vitest";
import { simulateMatch } from "./engine";
import { mulberry32 } from "./rng";
import { ROLES } from "./matchState";
import { makeFlatCard } from "../__tests__/golden/fixtures";

describe("acesso a objetivos sem contestação", () => {
  it.each([37, 138])("não entrega alma ao time dominado na regressão da semente %i", seed => {
    const strong = ROLES.map(r => ({...makeFlatCard(r, 85), id: `s-${r}`, personId: `s-${r}`}));
    const weak = ROLES.map(r => ({...makeFlatCard(r, 55), id: `w-${r}`, personId: `w-${r}`}));
    const strongSide = seed % 2 ? "user" : "rival";
    const weakSide = strongSide === "user" ? "rival" : "user";
    const match = simulateMatch(strongSide === "user" ? strong : weak, strongSide === "user" ? weak : strong, mulberry32(seed));
    expect(match.winner).toBe(strongSide);
    expect(match.finalState[weakSide].dragons.length).toBeLessThan(4);
  });
});
