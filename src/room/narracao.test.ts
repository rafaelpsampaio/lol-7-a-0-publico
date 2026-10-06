import { describe, it, expect } from "vitest";
import { criarNarracaoComMemoria, renomearLinha, renomearNarracao } from "./narracao";
import type { GameEvent } from "../sim/types";

function evento(ticker?: string): GameEvent {
  return {
    gameTimeMs: 0,
    playbackMs: 0,
    type: "kill",
    team: "user",
    winProbAfter: 0.5,
    ...(ticker === undefined ? {} : { ticker }),
  } as GameEvent;
}

describe("renomearLinha (achado S9: 'voce ganhou quando voce perdeu')", () => {
  it("troca os nomes-padrao do motor pelos times da serie", () => {
    expect(renomearLinha("GG — o Seu time fechou a partida contra o Rival.", "Fúria", "Dragões")).toBe(
      "GG — o Fúria fechou a partida contra o Dragões."
    );
  });

  it("troca todas as ocorrencias, dos dois lados", () => {
    expect(renomearLinha("Seu time e Rival; de novo Seu time, de novo Rival", "A", "B")).toBe(
      "A e B; de novo A, de novo B"
    );
  });

  it("nao mexe em 'rival' minusculo nem em palavra que so contem 'Rival'", () => {
    expect(renomearLinha("o rival recuou; Rivalidade antiga", "A", "B")).toBe("o rival recuou; Rivalidade antiga");
  });

  it("nome de time com '$' nao vira padrao de substituicao", () => {
    expect(renomearLinha("ACE para o Seu time!", "$& Time", "B")).toBe("ACE para o $& Time!");
  });
});

describe("renomearNarracao", () => {
  it("reescreve so o ticker e preserva o resto do evento", () => {
    const [ev] = renomearNarracao([evento("O Rival garantiu o Barão.")], "A", "B");
    expect(ev!.ticker).toBe("O B garantiu o Barão.");
    expect(ev!.team).toBe("user");
    expect(ev!.winProbAfter).toBe(0.5);
  });

  it("evento legado sem ticker passa intacto (mesmo objeto)", () => {
    const original = evento();
    expect(renomearNarracao([original], "A", "B")[0]).toBe(original);
  });
});

describe("criarNarracaoComMemoria", () => {
  it("mesma timeline e mesmos nomes devolvem o mesmo array", () => {
    const renomear = criarNarracaoComMemoria();
    const eventos = [evento("Seu time abriu o placar.")];
    expect(renomear(eventos, "A", "B")).toBe(renomear(eventos, "A", "B"));
  });

  it("nomes diferentes refazem a troca", () => {
    const renomear = criarNarracaoComMemoria();
    const eventos = [evento("Seu time abriu o placar.")];
    renomear(eventos, "A", "B");
    expect(renomear(eventos, "C", "B")[0]!.ticker).toBe("C abriu o placar.");
  });
});
