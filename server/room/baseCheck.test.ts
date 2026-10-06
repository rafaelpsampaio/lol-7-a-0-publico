import { describe, it, expect } from "vitest";
import { baseStatus, baseStatusMessage } from "./baseCheck";
import { makeBase, makeCard } from "./cards.fixture";
import { SEATS } from "../protocol";

describe("baseStatus (A-02)", () => {
  it("duas versoes da mesma pessoa contam como duas cartas", () => {
    const players = makeBase(7);
    for (const role of ["top", "jungle", "mid", "adc", "support"] as const) {
      players.push(makeCard({ id: `${role}-0-v2`, personId: `p-${role}-0`, primaryRole: role }));
    }
    expect(baseStatus(players).ready).toBe(true);
  });

  it("nao esta pronta com uma base de 4 por rota", () => {
    const status = baseStatus(makeBase(4));
    expect(status.ready).toBe(false);
    expect(status.needed).toBe(SEATS);
    expect(status.spareByRole.top).toBe(4);
  });

  it("esta pronta com 8 cartas por rota de pessoas de uma rota so", () => {
    expect(baseStatus(makeBase(8)).ready).toBe(true);
  });

  it("uma unica rota curta ja derruba a base", () => {
    const status = baseStatus(makeBase(8).filter((p) => p.id !== "adc-7"));
    expect(status.ready).toBe(false);
    expect(status.spareByRole.adc).toBe(7);
    expect(status.spareByRole.top).toBe(8);
  });

  it("8 cartas nao bastam quando uma e de quem joga outra rota", () => {
    const players = makeBase(8).filter((p) => p.id !== "adc-7");
    players.push(makeCard({ id: "top-0-adc", personId: "p-top-0", primaryRole: "adc" }));
    const status = baseStatus(players);
    expect(status.spareByRole.adc).toBe(7);
    expect(status.ready).toBe(false);
  });

  it("base vazia nao explode", () => {
    const status = baseStatus([]);
    expect(status.ready).toBe(false);
    expect(status.spareByRole.top).toBe(0);
  });

  it("aceita um `needed` menor para testes", () => {
    expect(baseStatus(makeBase(4), 4).ready).toBe(true);
  });

  it("conta so pela primaryRole, nao pelas roles", () => {
    const players = [
      makeCard({ id: "faker-multi", personId: "faker", primaryRole: "mid", roles: ["mid", "top", "adc"] }),
    ];
    const status = baseStatus(players);
    expect(status.spareByRole.mid).toBe(1);
    expect(status.spareByRole.top).toBe(0);
  });
});

describe("baseStatusMessage", () => {
  it("diz quantas cartas faltam em cada rota curta", () => {
    const msg = baseStatusMessage(baseStatus(makeBase(4)));
    expect(msg).toContain("8");
    expect(msg).toContain("faltam 4 cartas");
    expect(msg.toLowerCase()).toContain("top");
  });

  it("nao lista rota que ja esta completa", () => {
    const players = makeBase(8).filter((p) => !p.id.startsWith("adc-"));
    const msg = baseStatusMessage(baseStatus(players));
    expect(msg.toLowerCase()).toContain("adc");
    expect(msg.toLowerCase()).not.toContain("top");
  });

  it("base pronta devolve uma frase afirmativa, nao uma lista de faltas", () => {
    const msg = baseStatusMessage(baseStatus(makeBase(8)));
    expect(msg.toLowerCase()).toContain("pronta");
    expect(msg.toLowerCase()).not.toContain("faltam");
  });
});
