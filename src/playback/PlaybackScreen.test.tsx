/**
 * src/playback/PlaybackScreen.test.tsx
 *
 * O overlay de resultado so aparece depois que o GameTimer completa via
 * requestAnimationFrame — nunca em SSR sincrono, nem em jsdom sem simular
 * frames. Por isso o veredito (Fase 2) foi extraido como funcoes puras
 * exportadas, testadas aqui direto, sem montar o componente.
 */

import { describe, it, expect } from "vitest";
import {
  serieEstaDecidida,
  partidasRestantesMinimo,
  resultadoDoJogo,
  perspectivaEfetiva,
  rotulosDosLados,
  resumoDaPartida,
  textoProximoPasso,
} from "./PlaybackScreen";

describe("serieEstaDecidida", () => {
  it("nao decidida enquanto ninguem chegou a 3 vitorias", () => {
    expect(serieEstaDecidida(2, 1)).toBe(false);
    expect(serieEstaDecidida(0, 0)).toBe(false);
  });

  it("decidida assim que um lado bate 3, de qualquer lado", () => {
    expect(serieEstaDecidida(3, 1)).toBe(true);
    expect(serieEstaDecidida(1, 3)).toBe(true);
  });
});

describe("partidasRestantesMinimo", () => {
  it("2x1: falta pelo menos 1 pro lider fechar", () => {
    expect(partidasRestantesMinimo(2, 1)).toBe(1);
  });

  it("0x0: falta pelo menos 3", () => {
    expect(partidasRestantesMinimo(0, 0)).toBe(3);
  });

  it("serie ja decidida: 0", () => {
    expect(partidasRestantesMinimo(3, 1)).toBe(0);
  });
});

describe("resultadoDoJogo", () => {
  it("perspectiva 'user' ganhando, partida (serie nao decidida)", () => {
    const r = resultadoDoJogo("user", "user", false, "Time A", "Time B");
    expect(r.texto).toBe("Vitória · Time A venceu esta partida!");
    expect(r.classeTitulo).toContain("result-winner--user");
    expect(r.classeCard).toBe("result-card--vitoria");
  });

  it("perspectiva 'user' perdendo, partida", () => {
    const r = resultadoDoJogo("rival", "user", false, "Time A", "Time B");
    expect(r.texto).toBe("Derrota · Time B venceu esta partida.");
    expect(r.classeTitulo).toContain("result-winner--rival");
    expect(r.classeCard).toBe("result-card--derrota");
  });

  it("perspectiva 'rival' (meu time e o lado 'rival' do motor) ganhando", () => {
    // O motor decidiu que o lado "rival" venceu, mas quem assiste TAMBEM e o
    // lado "rival" -- entao e vitoria dela, mesmo o motor nao chamando "user".
    const r = resultadoDoJogo("rival", "rival", false, "Time A", "Time B");
    expect(r.texto).toBe("Vitória · Time B venceu esta partida!");
    expect(r.classeCard).toBe("result-card--vitoria");
  });

  it("perspectiva 'rival' perdendo (o lado 'user' do motor venceu)", () => {
    const r = resultadoDoJogo("user", "rival", false, "Time A", "Time B");
    expect(r.texto).toBe("Derrota · Time A venceu esta partida.");
    expect(r.classeCard).toBe("result-card--derrota");
  });

  it("espectador puro (perspectiva null): 3a pessoa, sem cartao de vitoria/derrota", () => {
    const r = resultadoDoJogo("user", null, false, "Time A", "Time B");
    expect(r.texto).toBe("Time A venceu esta partida.");
    expect(r.classeTitulo).toContain("result-winner--neutral");
    expect(r.classeCard).toBeNull();
  });

  it("espectador puro, o lado 'rival' venceu: usa o nome do rival", () => {
    const r = resultadoDoJogo("rival", null, false, "Time A", "Time B");
    expect(r.texto).toBe("Time B venceu esta partida.");
  });

  it("serie decidida: escopo muda pra 'a serie' e ganha o marcador de trofeu", () => {
    const r = resultadoDoJogo("user", "user", true, "Time A", "Time B");
    expect(r.texto).toBe("🏆 Vitória · Time A venceu a série!");
  });

  it("serie decidida, espectador puro: trofeu + nome + 'a serie'", () => {
    const r = resultadoDoJogo("user", null, true, "Time A", "Time B");
    expect(r.texto).toBe("🏆 Time A venceu a série.");
  });
});

describe("perspectivaEfetiva (Rundown da Sala 2)", () => {
  it("omitida (solo) vira 'user'", () => {
    expect(perspectivaEfetiva(undefined)).toBe("user");
  });

  it("null (espectador puro) continua null -- e nao 'user'", () => {
    expect(perspectivaEfetiva(null)).toBeNull();
  });

  it("espectador recebe veredito neutro, em terceira pessoa", () => {
    const r = resultadoDoJogo("user", perspectivaEfetiva(null), false, "Garras de Jade", "Ordem Hextech");
    expect(r.texto).toBe("Garras de Jade venceu esta partida.");
    expect(r.classeCard).toBeNull();
  });
});

describe("rotulosDosLados (achado S9: 'voce ganhou quando voce perdeu')", () => {
  it("solo (perspectiva omitida): Você × Rival, selo no lado user", () => {
    expect(rotulosDosLados(undefined, "FUR", "DRG")).toEqual({ user: "Você", rival: "Rival", voce: "user" });
  });

  it("sala, meu time e o lado user: Você × sigla do adversario", () => {
    expect(rotulosDosLados("user", "FUR", "DRG")).toEqual({ user: "Você", rival: "DRG", voce: "user" });
  });

  it("sala, meu time e o lado rival: a sigla do lado A, Você no lado B", () => {
    // Antes: "Você 90%" apontava para o lado A -- o adversario de quem lia.
    expect(rotulosDosLados("rival", "FUR", "DRG")).toEqual({ user: "FUR", rival: "Você", voce: "rival" });
  });

  it("espectador sem time na partida: duas siglas, sem selo", () => {
    expect(rotulosDosLados(null, "FUR", "DRG")).toEqual({ user: "FUR", rival: "DRG", voce: null });
  });
});

describe("resumoDaPartida", () => {
  it("cada numero ao lado da sigla do time dono dele", () => {
    const s = { userKills: 12, rivalKills: 8, userTowers: 9, rivalTowers: 4, userDragons: 3, rivalDragons: 1 };
    expect(resumoDaPartida(32 * 60000 + 5000, s, "FUR", "DRG")).toBe(
      "Partida encerrada em 32:05 · Abates FUR 12 × 8 DRG · Torres 9 × 4 · Dragões 3 × 1"
    );
  });
});

describe("textoProximoPasso (concordancia)", () => {
  it("plural com 'faltam', singular com 'falta'", () => {
    expect(textoProximoPasso(1, 0)).toBe("A série continua · faltam pelo menos 2 partidas para decidir.");
    expect(textoProximoPasso(2, 1)).toBe("A série continua · falta pelo menos 1 partida para decidir.");
  });
});

describe("resultadoDoJogo · trofeu so na vitoria", () => {
  it("jogo que fecha a serie contra quem assiste: derrota sem trofeu", () => {
    expect(resultadoDoJogo("rival", "user", true, "A", "B").texto).toBe("Derrota · B venceu a série.");
  });
});
