/**
 * Os pacotes que vem com o jogo seguem as regras do editor (spec
 * 2026-10-05-editor-de-pacotes-design, secao 4): uma rota por carta, forca =
 * nota geral, foto no caminho da pessoa, e nome no arquivo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PlayerDatabaseSchema } from "../data/schema";
import { validarPacote } from "./regrasDaCarta";

function ler(caminho: string) {
  return PlayerDatabaseSchema.parse(JSON.parse(readFileSync(resolve(process.cwd(), caminho), "utf8")));
}

describe.each([
  ["public/players.json", "Pros / Mundial"],
  ["public/packs/amigos.json", "Amigos"],
])("%s", (caminho, nome) => {
  it("segue as regras do editor", () => {
    expect(validarPacote(ler(caminho).players)).toEqual([]);
  });

  it(`tem o nome "${nome}"`, () => {
    expect(ler(caminho).name).toBe(nome);
  });
});
