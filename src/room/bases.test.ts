import { describe, it, expect } from "vitest";
import { coberturaDaBase } from "./bases";
import { makeCard } from "../../server/room/cards.fixture";
import type { Role } from "../data/schema";

function base(porRota: number, rotaCurta?: Role): ReturnType<typeof makeCard>[] {
  const cartas = [];
  for (const rota of ["top", "jungle", "mid", "adc", "support"] as Role[]) {
    const n = rota === rotaCurta ? porRota - 2 : porRota;
    for (let i = 0; i < n; i++) cartas.push(makeCard({ id: `${rota}-${i}`, personId: `${rota}-p${i}`, primaryRole: rota }));
  }
  return cartas;
}

describe("coberturaDaBase (mesma conta de server/room/baseCheck.ts)", () => {
  it("8 pessoas por rota: pronta", () => {
    expect(coberturaDaBase(base(8))).toEqual({ pronta: true, faltas: [] });
  });

  it("diz quantas faltam em cada rota curta", () => {
    expect(coberturaDaBase(base(8, "support"))).toEqual({ pronta: false, faltas: [{ rota: "support", faltam: 2 }] });
  });

  it("conta CARTAS: duas versoes da mesma pessoa de uma rota so valem duas cartas (A-01)", () => {
    const cartas = base(8);
    const repetidas = cartas.map((c) => (c.primaryRole === "mid" ? { ...c, personId: "mid-unico" } : c));
    expect(coberturaDaBase(repetidas)).toEqual({ pronta: true, faltas: [] });
  });

  it("carta de quem joga outra rota nao conta inteira (A-02)", () => {
    // top-p0 passa a ter carta em top E em adc: o time que o leva numa rota
    // perde a outra carta dele, entao as duas rotas ficam com folga 7
    const cartas = base(8).map((c) => (c.id === "adc-0" ? { ...c, personId: "top-p0" } : c));
    expect(coberturaDaBase(cartas).faltas).toEqual([
      { rota: "top", faltam: 1 },
      { rota: "adc", faltam: 1 },
    ]);
  });
});
