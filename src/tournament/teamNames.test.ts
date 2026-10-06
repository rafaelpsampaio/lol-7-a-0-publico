/**
 * src/tournament/teamNames.test.ts
 *
 * Achado do teste de sala (2026-08-27): dois times com nomes parecidos
 * ("Time Host Final" / "Time Host Reclaim") geravam a MESMA sigla via
 * tagFromName, deixando os dois indistinguiveis na tela de partida.
 * tagsUnicos garante que, dentro do mesmo conjunto de nomes, nunca duas
 * siglas repetem.
 */

import { describe, it, expect } from "vitest";
import { tagFromName, tagsUnicos } from "./teamNames";

describe("tagFromName (sem contexto dos outros times)", () => {
  it("nomes parecidos colidem -- e exatamente por isso que tagsUnicos existe", () => {
    expect(tagFromName("Time Host Final")).toBe(tagFromName("Time Host Reclaim"));
  });
});

describe("tagsUnicos (achado do teste de sala, 2026-08-27)", () => {
  it("resolve a colisao real: dois nomes que geram a mesma sigla saem diferentes", () => {
    const [tagA, tagB] = tagsUnicos(["Time Host Final", "Time Host Reclaim"]);
    expect(tagA).not.toBe(tagB);
  });

  it("nao mexe em nomes que ja geram siglas distintas", () => {
    const nomes = ["Dragões de Cristal", "Sentinelas do Vazio", "Time Teste J2"];
    expect(tagsUnicos(nomes)).toEqual(nomes.map(tagFromName));
  });

  it("resolve 3 colisoes seguidas da mesma sigla base sem repetir nenhuma", () => {
    const nomes = ["Time Host Um", "Time Host Dois", "Time Host Tres"];
    const tags = tagsUnicos(nomes);
    expect(new Set(tags).size).toBe(3);
  });

  it("nunca gera uma sigla com mais de 4 caracteres (limite do schema)", () => {
    const nomes = Array.from({ length: 8 }, (_, i) => `Time Host ${i}`);
    for (const tag of tagsUnicos(nomes)) {
      expect(tag.length).toBeLessThanOrEqual(4);
    }
  });
});
