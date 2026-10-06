/**
 * src/draft/hints.test.ts
 *
 * Tests for playerHints() — pre-pick PUBLIC view derivation (Phase 2 DRFT).
 * Guarantees: no raw numbers leak; authored fields win over derivation;
 * derivation is deterministic and number-free.
 */

import { describe, it, expect } from "vitest";
import { makePlayer } from "./orchestrator.test";
import { cardMetaLine, playerHints } from "./hints";

describe("playerHints — pre-pick public view", () => {
  it("exposes position, year, phase, style, tags and a description", () => {
    const p = makePlayer("mid", {
      lanePhase: 90,
      midGame: 70,
      lateGame: 60,
      traits: ["lane_bully"],
    });
    const h = playerHints(p);
    expect(h.position).toBe("mid");
    expect(h.positionLabel).toBe("MID");
    expect(h.year).toBe(2020);
    expect(h.phase).toBe("Início"); // lanePhase dominates
    expect(h.style).toBe("Bully de lane"); // trait-driven style
    expect(h.tags.length).toBeGreaterThan(0);
    expect(typeof h.shortDescription).toBe("string");
  });

  it("never leaks any raw numeric rating into style or description", () => {
    const p = makePlayer("adc", { lanePhase: 88, midGame: 77, lateGame: 99 });
    const h = playerHints(p);
    // No rating numbers (88/77/99) should appear in the prose fields.
    expect(h.style).not.toMatch(/\d/);
    expect(h.shortDescription).not.toMatch(/88|77|99/);
  });

  it("infers Fim when late game dominates", () => {
    const p = makePlayer("adc", { lanePhase: 60, midGame: 65, lateGame: 95 });
    expect(playerHints(p).phase).toBe("Fim");
  });

  it("infers Versátil when the three phases are within a tight band", () => {
    const p = makePlayer("top", { lanePhase: 80, midGame: 82, lateGame: 79 });
    expect(playerHints(p).phase).toBe("Versátil");
  });

  it("prefers authored tags/style/description over derived values", () => {
    const p = makePlayer("jungle", {
      tags: ["Invasor", "Smite perfeito"],
      style: "Carrasco de objetivos",
      shortDescription: "Controla o mapa pelos dois lados.",
    });
    const h = playerHints(p);
    expect(h.tags).toEqual(["Invasor", "Smite perfeito"]);
    expect(h.style).toBe("Carrasco de objetivos");
    expect(h.shortDescription).toBe("Controla o mapa pelos dois lados.");
  });

  it("is deterministic — same input yields identical hints", () => {
    const p = makePlayer("support", { traits: ["objective_focused"] });
    expect(playerHints(p)).toEqual(playerHints(p));
  });
});

describe("cardMetaLine (A-06)", () => {
  it("mostra ano e fase quando a carta tem ano", () => {
    const h = playerHints(makePlayer("mid", { year: 2018 }));
    expect(cardMetaLine(h)).toBe(`2018 · ${h.phase}`);
  });

  it("carta sem ano mostra so a fase, sem separador sobrando", () => {
    const { year: _year, ...semAno } = makePlayer("mid");
    const h = playerHints(semAno);
    expect(h.year).toBeUndefined();
    expect(cardMetaLine(h)).toBe(h.phase);
  });
});
