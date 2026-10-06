/**
 * src/tournament/schema.test.ts
 *
 * Tests for isUserTeam — ver docs/superpowers/specs/2026-08-26-isuser-unification-design.md
 * pro porque este helper existe e por que ele NUNCA deve inferir userFrameTeamId.
 */

import { describe, it, expect } from "vitest";
import { isUserTeam, USER_TEAM_ID } from "./schema";

describe("isUserTeam", () => {
  it("retorna true quando o id do time bate com a referencia", () => {
    expect(isUserTeam("user", "user")).toBe(true);
  });

  it("retorna false quando o id do time nao bate com a referencia", () => {
    expect(isUserTeam("bot-0", "user")).toBe(false);
  });

  it("retorna false quando a referencia e null (sala, lado servidor -- D-22)", () => {
    expect(isUserTeam("qualquer-time", null)).toBe(false);
  });

  it("USER_TEAM_ID e o literal 'user' usado pelo torneio solo", () => {
    expect(USER_TEAM_ID).toBe("user");
  });
});
