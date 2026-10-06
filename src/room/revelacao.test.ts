import { describe, it, expect } from "vitest";
import {
  eliminadoVisivel,
  finalRevelada,
  ladoRevelado,
  rotuloDaRodada,
  serieRevelada,
  seriesEscondidas,
  situacaoDoTime,
  type ContextoDeRevelacao,
} from "./revelacao";
import { TOTAL_WAVES, type SlotId, type TournamentSeriesWire, type TournamentTeamWire, type TournamentWire } from "../../server/protocol";

function ctx(onda: number, vistas: SlotId[] = [], pulado = false): ContextoDeRevelacao {
  return { onda, vistas: new Set(vistas), pulado };
}

function serie(slotId: SlotId, over: Partial<TournamentSeriesWire> = {}): TournamentSeriesWire {
  return { slotId, status: "complete", teamAId: "a", teamBId: "b", wins: { a: 3, b: 1 }, winnerId: "a", gamesPlayed: 4, ...over };
}

function torneio(series: TournamentSeriesWire[], teams: TournamentTeamWire[] = [], over: Partial<TournamentWire> = {}): TournamentWire {
  return {
    wave: 1, totalWaves: TOTAL_WAVES, series, teams, ready: [], readyFaltam: 0, readyTotal: 0,
    espectadoresContam: false, watching: {}, sync: null, vote: null, championId: null,
    id: "t", barreira: [], pulado: false, awards: null, ...over,
  };
}

const B: TournamentTeamWire = { id: "b", seatIndex: 1, displayName: "B", tag: "BBB", publicId: "pb", eliminated: true };

describe("serieRevelada", () => {
  it("libera todos os resultados da rodada juntos após o Ready de todos", () => {
    const antes = { ...ctx(1), resultadosLiberados: false };
    const depois = { ...ctx(1), resultadosLiberados: true };
    for (const slot of ["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"] as SlotId[]) {
      expect(serieRevelada(serie(slot), antes)).toBe(false);
      expect(serieRevelada(serie(slot), depois)).toBe(true);
    }
    expect(serieRevelada(serie("UB_SF_1"), depois)).toBe(false);
  });
  it("serie nao jogada nunca esconde nada", () => {
    expect(serieRevelada(serie("UB_SF_1", { gamesPlayed: 0 }), ctx(1))).toBe(true);
  });
  it("serie da onda atual: escondida ate eu ver", () => {
    expect(serieRevelada(serie("UB_QF_1"), ctx(1))).toBe(false);
    expect(serieRevelada(serie("UB_QF_1"), ctx(1, ["UB_QF_1"]))).toBe(true);
  });
  it("serie de onda anterior: revelada", () => {
    expect(serieRevelada(serie("UB_QF_1"), ctx(2))).toBe(true);
  });
  it("pulado: tudo revelado", () => {
    expect(serieRevelada(serie("GF"), ctx(6, [], true))).toBe(true);
  });
});

describe("seriesEscondidas e finalRevelada", () => {
  it("lista so as da onda atual ainda nao vistas", () => {
    const t = torneio([serie("UB_QF_1"), serie("UB_QF_2"), serie("UB_SF_1", { gamesPlayed: 0 })]);
    expect(seriesEscondidas(t, ctx(1, ["UB_QF_2"]))).toEqual(["UB_QF_1"]);
  });
  it("a final so e revelada depois de vista", () => {
    const t = torneio([serie("GF")], [], { wave: 6 });
    expect(finalRevelada(t, ctx(6))).toBe(false);
    expect(finalRevelada(t, ctx(6, ["GF"]))).toBe(true);
  });
});

describe("ladoRevelado", () => {
  it("lado da semifinal alimentado por quartas escondida: nao revela", () => {
    const t = torneio([serie("UB_QF_1"), serie("UB_SF_1", { gamesPlayed: 0, status: "ready" })]);
    expect(ladoRevelado("UB_SF_1", "teamA", t, ctx(1))).toBe(false);
    expect(ladoRevelado("UB_SF_1", "teamA", t, ctx(1, ["UB_QF_1"]))).toBe(true);
  });
  it("quartas (semeadura) sempre revela", () => {
    expect(ladoRevelado("UB_QF_1", "teamA", torneio([]), ctx(1))).toBe(true);
  });
});

describe("eliminadoVisivel e situacaoDoTime", () => {
  it("eliminado so aparece com todas as series do time reveladas", () => {
    const t = torneio([serie("UB_QF_1"), serie("LB_R1_1", { teamAId: "c", teamBId: "b", winnerId: "c", wins: { c: 3, b: 0 }, gamesPlayed: 3 })], [B], { wave: 2 });
    expect(eliminadoVisivel(B, t, ctx(2))).toBe(false);
    expect(eliminadoVisivel(B, t, ctx(2, ["LB_R1_1"]))).toBe(true);
    expect(situacaoDoTime(B, t, ctx(2))).toBe("na chave inferior");
    expect(situacaoDoTime(B, t, ctx(2, ["LB_R1_1"]))).toBe("eliminado");
  });
  it("time que nunca perdeu esta na chave superior; quem venceu a GF e campeao", () => {
    const A: TournamentTeamWire = { ...B, id: "a", eliminated: false };
    const t = torneio([serie("GF")], [A], { wave: 6 });
    expect(situacaoDoTime(A, t, ctx(6))).toBe("na chave superior");
    expect(situacaoDoTime(A, t, ctx(6, ["GF"]))).toBe("campeão");
  });
});

describe("rotuloDaRodada", () => {
  it("nomeia as 6 rodadas sem usar 'rodada' para as fases da chave inferior", () => {
    expect(rotuloDaRodada(1)).toBe("Quartas de final da chave superior");
    expect(rotuloDaRodada(2)).toContain("1ª fase da chave inferior");
    expect(rotuloDaRodada(6)).toBe("Grande Final");
    expect(rotuloDaRodada(7)).toBeNull();
  });
});
