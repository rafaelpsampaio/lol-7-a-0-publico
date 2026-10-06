import { describe, it, expect } from "vitest";
import { replayMatchesStored } from "./replayGuard";

describe("replayMatchesStored", () => {
  it("aceita quando o vencedor refeito e o gravado", () => {
    expect(replayMatchesStored("T1", "user", "T1", "GEN")).toBe(true);
    expect(replayMatchesStored("GEN", "rival", "T1", "GEN")).toBe(true);
  });
  it("recusa quando a partida refeita teria outro vencedor", () => {
    expect(replayMatchesStored("T1", "rival", "T1", "GEN")).toBe(false);
    expect(replayMatchesStored("GEN", "user", "T1", "GEN")).toBe(false);
  });
});
