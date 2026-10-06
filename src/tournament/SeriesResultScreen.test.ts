/**
 * src/tournament/SeriesResultScreen.test.ts
 *
 * Phase 28 (plano 28-04, D-03/D-04): cobertura de `isSeriesUpset`/`isGameUpset`,
 * as funcoes puras extraidas de SeriesResultScreen.tsx que decidem os dois
 * destaques de zebra exigidos por D-04 (serie inteira e jogo isolado dentro
 * da serie). Nao ha convencao de teste de componente Solid neste projeto
 * (nenhum uso de @solidjs/testing-library em src/), entao a logica foi
 * extraida para funcoes puras e testada diretamente, como o proprio plano
 * 28-04-PLAN.md autoriza.
 *
 * Os quatro cenarios exigidos pelo plano:
 *   1. serie vencida pelo time de MAIOR rating nao mostra o destaque de serie
 *   2. serie vencida pelo time de MENOR rating com gap acima do limiar mostra
 *   3. gap abaixo do limiar nao mostra
 *   4. azarao venceu um jogo mas perdeu a serie: uma celula marcada, sem
 *      destaque de serie
 */

import { describe, it, expect } from "vitest";
import { isSeriesUpset, isGameUpset, idDoTimeNaLinha, perdedorEliminado, tituloNeutro, tituloDoMeuTime } from "./SeriesResultScreen";
import { rosterRating, UPSET_MIN_GAP } from "../sim/power";
import { ROLES } from "../sim/matchState";
import { makeFlatCard } from "../__tests__/golden/fixtures";

// ---------------------------------------------------------------------------
// Ratings de fixture: rosters flat (overall uniforme), mesma convencao de
// ratingCurve.test.ts / upset.test.ts: roster uniforme retorna exatamente o
// overall (ROLE_WEIGHTS.teamfight soma 1.0).
// ---------------------------------------------------------------------------

function flatRating(overall: number): number {
  return rosterRating(ROLES.map((r) => makeFlatCard(r, overall)));
}

const TEAM_A = "team-a";
const TEAM_B = "team-b";

describe("isSeriesUpset (D-04, primeira metade: serie inteira)", () => {
  it("serie vencida pelo time de MAIOR rating nao mostra o destaque de serie", () => {
    const ratingA = flatRating(90); // favorito
    const ratingB = flatRating(60); // azarao
    expect(isSeriesUpset(ratingA, ratingB, TEAM_A, TEAM_B, TEAM_A)).toBe(false);
  });

  it("serie vencida pelo time de MENOR rating com gap acima do limiar mostra o destaque", () => {
    const ratingA = flatRating(90); // favorito
    const ratingB = flatRating(60); // azarao, gap 30 >> UPSET_MIN_GAP
    expect(isSeriesUpset(ratingA, ratingB, TEAM_A, TEAM_B, TEAM_B)).toBe(true);
  });

  it("gap abaixo do limiar nao mostra o destaque, mesmo com o time de menor rating vencendo", () => {
    const ratingA = flatRating(70);
    const ratingB = flatRating(65); // gap 5, abaixo de UPSET_MIN_GAP (~9,53)
    expect(Math.abs(ratingA - ratingB)).toBeLessThan(UPSET_MIN_GAP);
    expect(isSeriesUpset(ratingA, ratingB, TEAM_A, TEAM_B, TEAM_B)).toBe(false);
  });

  it("devolve false quando winnerId e nulo (serie ainda em andamento)", () => {
    const ratingA = flatRating(90);
    const ratingB = flatRating(60);
    expect(isSeriesUpset(ratingA, ratingB, TEAM_A, TEAM_B, null)).toBe(false);
  });

  it("devolve false quando winnerId nao corresponde a nenhum dos dois times", () => {
    const ratingA = flatRating(90);
    const ratingB = flatRating(60);
    expect(isSeriesUpset(ratingA, ratingB, TEAM_A, TEAM_B, "outro-time")).toBe(false);
  });
});

describe("isGameUpset (D-04, segunda metade: jogo isolado dentro da serie)", () => {
  it("azarao venceu UM jogo mas perdeu a serie: a celula do jogo marca zebra, sem destaque de serie", () => {
    const ratingA = flatRating(90); // favorito, venceu a serie
    const ratingB = flatRating(60); // azarao, venceu so um jogo

    // A serie no fim foi vencida pelo favorito: sem destaque de serie.
    expect(isSeriesUpset(ratingA, ratingB, TEAM_A, TEAM_B, TEAM_A)).toBe(false);

    // Mas o jogo isolado que o azarao venceu e marcado independentemente.
    expect(isGameUpset(ratingA, ratingB, TEAM_A, TEAM_B, TEAM_B)).toBe(true);
    // E o jogo que o favorito venceu nao e marcado.
    expect(isGameUpset(ratingA, ratingB, TEAM_A, TEAM_B, TEAM_A)).toBe(false);
  });

  it("devolve false quando gameWinnerId nao corresponde a nenhum dos dois times", () => {
    const ratingA = flatRating(90);
    const ratingB = flatRating(60);
    expect(isGameUpset(ratingA, ratingB, TEAM_A, TEAM_B, "outro-time")).toBe(false);
  });

  it("devolve false quando o gap do jogo esta abaixo do limiar", () => {
    const ratingA = flatRating(70);
    const ratingB = flatRating(65);
    expect(isGameUpset(ratingA, ratingB, TEAM_A, TEAM_B, TEAM_B)).toBe(false);
  });
});

describe("idDoTimeNaLinha (achado do teste de sala, 2026-08-27)", () => {
  it("devolve o id do teamA quando teamA e o meu time", () => {
    const teamA = { id: TEAM_A, isUser: true };
    const teamB = { id: TEAM_B, isUser: false };
    expect(idDoTimeNaLinha(teamA, teamB)).toBe(TEAM_A);
  });

  it("devolve o id do teamB quando teamB e o meu time -- caso que quebrava antes do fix", () => {
    const teamA = { id: TEAM_A, isUser: false };
    const teamB = { id: TEAM_B, isUser: true };
    expect(idDoTimeNaLinha(teamA, teamB)).toBe(TEAM_B);
  });

  it("devolve null quando nenhum dos dois e o meu time (espectador puro)", () => {
    const teamA = { id: TEAM_A, isUser: false };
    const teamB = { id: TEAM_B, isUser: false };
    expect(idDoTimeNaLinha(teamA, teamB)).toBe(null);
  });

  it("devolve null quando os times ainda nao carregaram", () => {
    expect(idDoTimeNaLinha(undefined, undefined)).toBe(null);
  });
});

describe("perdedorEliminado (Rundown da Sala 2)", () => {
  it("perder na chave superior so derruba para a inferior", () => {
    for (const slot of ["UB_QF_1", "UB_QF_4", "UB_SF_1", "UB_SF_2", "UB_F"] as const) {
      expect(perdedorEliminado(slot)).toBe(false);
    }
  });

  it("perder na chave inferior ou na Grande Final elimina", () => {
    for (const slot of ["LB_R1_1", "LB_R2_2", "LB_SF", "LB_F", "GF"] as const) {
      expect(perdedorEliminado(slot)).toBe(true);
    }
  });
});

describe("tituloNeutro (achado da revisao final: Grande Final para quem nao tem time na serie)", () => {
  it("fora da Grande Final o vencedor 'avancou'", () => {
    expect(tituloNeutro("UB_QF_1", "Time B")).toBe("Time B avançou.");
    expect(tituloNeutro("LB_F", "Time B")).toBe("Time B avançou.");
  });

  it("na Grande Final nao ha para onde avancar: o vencedor e o campeao", () => {
    expect(tituloNeutro("GF", "Time B")).toBe("Time B é o campeão!");
  });
});

describe("tituloDoMeuTime (S9: sempre com o nome do time)", () => {
  it("vitoria fora da final: nome + venceu a serie", () => {
    expect(tituloDoMeuTime("UB_QF_1", true, "Fúria", "Fúria")).toBe("Vitória · Fúria venceu a série!");
  });

  it("vitoria na Grande Final: campeao do torneio", () => {
    expect(tituloDoMeuTime("GF", true, "Fúria", "Fúria")).toBe("🏆 Fúria é o campeão do torneio!");
  });

  it("derrota na chave superior: cai para a inferior, nao 'eliminado'", () => {
    expect(tituloDoMeuTime("UB_SF_1", false, "Fúria", "Dragões")).toBe(
      "Derrota · Dragões venceu a série. Fúria cai para a chave inferior."
    );
  });

  it("derrota na chave inferior: eliminado", () => {
    expect(tituloDoMeuTime("LB_R1_1", false, "Fúria", "Dragões")).toBe(
      "Derrota · Dragões venceu a série. Fúria está eliminado."
    );
  });
});

describe("tituloDoMeuTime na Grande Final", () => {
  it("quem perde a final e vice, nao 'eliminado'", () => {
    expect(tituloDoMeuTime("GF", false, "Lobos", "Dragões")).toBe(
      "Derrota na Grande Final · Dragões é o campeão. Lobos termina como vice."
    );
  });
});
