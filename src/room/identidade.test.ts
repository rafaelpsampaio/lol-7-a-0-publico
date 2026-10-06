import { describe, it, expect } from "vitest";
import { meuLugar, siglasDoLobby } from "./identidade";
import type { RoomPlayerWire, RoomWire } from "../../server/protocol";

function jogador(over: Partial<RoomPlayerWire>): RoomPlayerWire {
  return { publicId: "p", nickname: "n", teamName: "Time", isHost: false, connected: true, spectator: false, ...over };
}

function sala(players: RoomPlayerWire[], over: Partial<RoomWire> = {}): RoomWire {
  return {
    phase: "lobby",
    players,
    settings: { turnSeconds: 60 },
    baseStatus: { ready: true, needed: 8, spareByRole: { top: 8, jungle: 8, mid: 8, adc: 8, support: 8 } },
    draft: null,
    tournament: null,
    ...over,
  };
}

describe("siglasDoLobby", () => {
  it("mesma regra do servidor: siglas unicas, na ordem de entrada", () => {
    const m = siglasDoLobby([
      jogador({ publicId: "a", teamName: "Time Host Final" }),
      jogador({ publicId: "b", teamName: "Time Host Reclaim" }),
    ]);
    expect(m.get("a")).toBe("THO");
    expect(m.get("b")).toBe("TH2");
  });

  it("quem caiu e espectador ficam sem sigla (nao ganham assento)", () => {
    const m = siglasDoLobby([
      jogador({ publicId: "a", teamName: "Alfa", connected: false }),
      jogador({ publicId: "e", teamName: "", spectator: true }),
      jogador({ publicId: "b", teamName: "Beta" }),
    ]);
    expect(m.has("a")).toBe(false);
    expect(m.has("e")).toBe(false);
    expect(m.get("b")).toBe("BET");
  });
});

describe("meuLugar", () => {
  it("no lobby: time, apelido e a sigla prevista", () => {
    const st = sala([jogador({ publicId: "eu", nickname: "rafa", teamName: "Fúria Azul", isHost: true })]);
    expect(meuLugar(st, "eu")).toEqual({ apelido: "rafa", time: "Fúria Azul", sigla: "FAZ", espectador: false, host: true });
  });

  it("espectador: sem time e sem sigla", () => {
    const st = sala([jogador({ publicId: "eu", nickname: "bia", teamName: "", spectator: true })], { phase: "tournament" });
    expect(meuLugar(st, "eu")).toMatchObject({ espectador: true, sigla: null, time: "" });
  });

  it("sem welcome ainda: null", () => {
    expect(meuLugar(sala([]), null)).toBeNull();
  });
});
