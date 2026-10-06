import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasTimelines, stripTimelines, timelineOf } from "./replay";
import { runWave } from "./tournament";
import { criar } from "./tournament.fixture";
import { TOTAL_WAVES } from "../protocol";
import { ChampionCatalogueSchema, type SlotId, type StoredGame, type TournamentState } from "../engine/schema";

const CATALOGO = ChampionCatalogueSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "public/champions.json"), "utf8"))
).champions;

/** Troca o elenco do time A pelo do time B, dentro de cada serie informada. */
function trocarElencos(bracket: TournamentState, slots: SlotId[]): TournamentState {
  const teams = { ...bracket.teams };
  for (const slotId of slots) {
    const s = bracket.slots[slotId]!.series;
    const aId = s.teamAId!;
    const bId = s.teamBId!;
    const a = teams[aId]!;
    const b = teams[bId]!;
    teams[aId] = { ...a, roster: b.roster };
    teams[bId] = { ...b, roster: a.roster };
  }
  return { ...bracket, teams };
}

/** Substitui os games de uma serie, sem mexer no resto do bracket. */
function comGames(bracket: TournamentState, slotId: SlotId, games: StoredGame[]): TournamentState {
  return {
    ...bracket,
    slots: {
      ...bracket.slots,
      [slotId]: { ...bracket.slots[slotId]!, series: { ...bracket.slots[slotId]!.series, games } },
    },
  };
}

describe("timeline regenerada", () => {
  it("devolve a timeline que ja esta na memoria sem refazer nada", () => {
    const t = runWave(criar(2), CATALOGO);
    const r = timelineOf(t, "UB_QF_1", CATALOGO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.games).toBe(t.bracket.slots["UB_QF_1"]!.series.games);
  });

  it("refaz byte a byte o que o snapshot jogou fora (D-25)", () => {
    const t = runWave(criar(2), CATALOGO);
    const original = t.bracket.slots["UB_QF_1"]!.series.games;
    const restaurado = { ...t, bracket: stripTimelines(t.bracket) };
    expect(hasTimelines(restaurado.bracket.slots["UB_QF_1"]!.series.games)).toBe(false);

    const r = timelineOf(restaurado, "UB_QF_1", CATALOGO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.games)).toBe(JSON.stringify(original));
  });

  it("refaz todas as series da onda, nao so a primeira", () => {
    const t = runWave(criar(2), CATALOGO);
    const restaurado = { ...t, bracket: stripTimelines(t.bracket) };
    for (const s of ["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"] as SlotId[]) {
      const r = timelineOf(restaurado, s, CATALOGO);
      expect(r.ok, s).toBe(true);
      if (r.ok) {
        expect(JSON.stringify(r.games)).toBe(
          JSON.stringify(t.bracket.slots[s]!.series.games)
        );
      }
    }
  });

  it("recusa quando o chaos mudou por baixo — nao inventa outra partida (D-26)", () => {
    const t = runWave(criar(2), CATALOGO);
    const adulterado = { ...t, bracket: stripTimelines(t.bracket), chaosLevel: 0.9 };
    const r = timelineOf(adulterado, "UB_QF_1", CATALOGO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("gravacao_indisponivel");
  });

  it("recusa a primeira onda inteira quando o elenco de dois times foi trocado (achado do revisor)", () => {
    // Trocar o elenco de A por B nao muda a seed (independente do elenco) e pode
    // coincidir no winnerId por acaso -- so o campo `champions` (derivado do
    // elenco) muda sempre. E o buraco que a conferencia so de seed+winnerId
    // deixava passar.
    const t = runWave(criar(2), CATALOGO);
    const primeiraOnda: SlotId[] = ["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"];
    const adulterado = { ...t, bracket: stripTimelines(trocarElencos(t.bracket, primeiraOnda)) };
    for (const s of primeiraOnda) {
      const r = timelineOf(adulterado, s, CATALOGO);
      expect(r.ok, s).toBe(false);
      if (!r.ok) expect(r.error).toBe("gravacao_indisponivel");
    }
  });

  it("recusa quando so a impressao digital da timeline nao bate — camada 2 sozinha (D-26)", () => {
    // Todo campo de StoredGame fora dos events continua igual (seed, winnerId,
    // champions, userFrameTeamId, totalPlaybackMs); so o hash guardado foi
    // adulterado. A camada 1 (comparacao de campos) nao pegaria isso sozinha --
    // e exatamente o que a camada 2 existe para fechar.
    const t = runWave(criar(2), CATALOGO);
    const hashesOriginais = t.timelineHashes["UB_QF_1"]!;
    const adulterado = {
      ...t,
      bracket: stripTimelines(t.bracket),
      timelineHashes: {
        ...t.timelineHashes,
        UB_QF_1: [hashesOriginais[0]! + 1, ...hashesOriginais.slice(1)],
      },
    };
    const r = timelineOf(adulterado, "UB_QF_1", CATALOGO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("gravacao_indisponivel");
  });

  it("um seed guardado errado sozinho tambem reprova — a comparacao do objeto inteiro cobre (D-26)", () => {
    // Antes, so seed e winnerId eram comparados. O revisor notou que remover a
    // checagem de seed nao deixava nada vermelho -- nenhum teste mutava so o
    // seed. Comparando o objeto inteiro (menos events), mutar so o seed
    // guardado ja e suficiente para reprovar, sem precisar de checagem dedicada.
    const t = runWave(criar(2), CATALOGO);
    const stripado = stripTimelines(t.bracket);
    const games = stripado.slots["UB_QF_1"]!.series.games;
    const jogoComSeedErrado = { ...games[0]!, seed: games[0]!.seed + 1 };
    const adulterado = {
      ...t,
      bracket: comGames(stripado, "UB_QF_1", [jogoComSeedErrado, ...games.slice(1)]),
    };
    const r = timelineOf(adulterado, "UB_QF_1", CATALOGO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("gravacao_indisponivel");
  });

  it("recusa serie que nunca teve jogo", () => {
    const r = timelineOf(criar(2), "GF", CATALOGO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("serie_desconhecida");
  });

  it("stripTimelines encolhe o torneio em tres ordens de grandeza (D-25)", () => {
    let t = criar(2);
    for (let i = 0; i < TOTAL_WAVES; i++) t = runWave(t, CATALOGO);
    const cheio = JSON.stringify(t.bracket).length;
    const magro = JSON.stringify(stripTimelines(t.bracket)).length;
    expect(cheio).toBeGreaterThan(5_000_000);
    expect(magro).toBeLessThan(100_000);
  });

  it("nao le relogio nem sorteia", () => {
    // Os comentarios saem antes da busca: o cabecalho do modulo EXPLICA a
    // proibicao citando as duas APIs pelo nome, e uma busca crua acusaria o
    // proprio texto que documenta a regra. Mesmo teste de server/room/tournament.test.ts.
    const fonte = readFileSync(new URL("./replay.ts", import.meta.url), "utf8");
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/Date\.now|Math\.random/);
  });
});
