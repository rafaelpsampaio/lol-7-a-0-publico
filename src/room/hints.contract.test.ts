/**
 * src/room/hints.contract.test.ts
 *
 * A RoomDraftScreen mostra as cartas com playerHints/ROLE_LABELS do jogo. Este
 * teste fixa a forma do que ela consome: se o outro builder mudar a assinatura,
 * quebra aqui, no npm test, e nao na noite de jogo.
 */

import { describe, it, expect } from "vitest";
import { ROLE_LABELS, playerHints } from "../draft/hints";
import { makeCard } from "../../server/room/cards.fixture";

describe("contrato com as dicas do jogo", () => {
  it("ROLE_LABELS tem rotulo para as cinco rotas", () => {
    for (const role of ["top", "jungle", "mid", "adc", "support"] as const) {
      expect(typeof ROLE_LABELS[role]).toBe("string");
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
    }
  });

  it("playerHints devolve year, phase, style, shortDescription e tags", () => {
    const dicas = playerHints(makeCard({ id: "t", personId: "p", primaryRole: "top" }));
    expect(typeof dicas.year).not.toBe("undefined");
    expect(typeof dicas.phase).toBe("string");
    expect(typeof dicas.style).toBe("string");
    expect(typeof dicas.shortDescription).toBe("string");
    expect(Array.isArray(dicas.tags)).toBe(true);
  });

  it("nao vaza numero cru de forca na descricao curta", () => {
    const carta = makeCard({ id: "t", personId: "p", primaryRole: "top", forca: 87 });
    expect(playerHints(carta).shortDescription).not.toContain("87");
  });
});
