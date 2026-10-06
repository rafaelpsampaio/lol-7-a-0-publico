import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validatePlayerDatabase, readPlayerDatabase, writePlayerDatabase, readChampionCatalogue } from "./index";
import { ALL_ROLES, generateRound, mulberry32, assignTeamIdentities, tagFromName, type PlayerVersion, type TournamentTeam, type SlotId } from "./schema";
import { createTournament, advanceSlot, runSeriesGame, seriesWinnerId } from "./tournament";
import { makeBase } from "../room/cards.fixture";

const REAL_BASE = resolve(process.cwd(), "public/players.json");
const REAL_CATALOGUE = resolve(process.cwd(), "public/champions.json");

describe("contrato com o codigo do jogo", () => {
  it("valida o players.json real do repositorio", async () => {
    const result = await readPlayerDatabase(REAL_BASE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.players.length).toBeGreaterThan(0);
      // Campos que o servidor depende ao montar times e mao de draft
      const p = result.players[0]!;
      expect(typeof p.id).toBe("string");
      expect(typeof p.personId).toBe("string");
      expect(typeof p.primaryRole).toBe("string");
    }
  });

  it("recusa base invalida com mensagem legivel", () => {
    const result = validatePlayerDatabase({ players: [{ id: "quebrado" }] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("recusa arquivo inexistente sem lancar excecao", async () => {
    const result = await readPlayerDatabase("/caminho/que/nao/existe.json");
    expect(result.ok).toBe(false);
  });

  it("escreve de forma atomica e le de volta", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lol7a0-base-"));
    const file = join(dir, "players.json");
    const raw = JSON.parse(await readFile(REAL_BASE, "utf8")) as unknown;

    await writePlayerDatabase(file, raw);

    const result = await readPlayerDatabase(file);
    expect(result.ok).toBe(true);
  });

  it("nao sobrescreve o arquivo quando a base e invalida", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lol7a0-base-"));
    const file = join(dir, "players.json");
    await writeFile(file, '{"players":[]}', "utf8");

    await expect(writePlayerDatabase(file, { lixo: true })).rejects.toThrow();

    expect(await readFile(file, "utf8")).toBe('{"players":[]}');
  });
});

describe("contrato do portal do motor (D-15)", () => {
  it("ALL_ROLES tem as cinco rotas na ordem canonica", () => {
    expect(ALL_ROLES).toEqual(["top", "jungle", "mid", "adc", "support"]);
  });

  it("generateRound devolve uma carta por rota aberta e respeita usedPersonIds", () => {
    const players = makeBase(8);
    const round = generateRound(players, new Set(), new Set(), mulberry32(1));
    expect(Object.keys(round).sort()).toEqual([...ALL_ROLES].sort());

    const todosOsTops = players.filter((p) => p.primaryRole === "top").map((p) => p.personId);
    const semTops = generateRound(
      players,
      new Set(),
      new Set(todosOsTops),
      mulberry32(1)
    );
    expect(semTops.top).toBeUndefined();
    expect(semTops.mid).toBeDefined();
  });

  it("generateRound e deterministico para a mesma semente", () => {
    const players = makeBase(8);
    const a = generateRound(players, new Set(), new Set(), mulberry32(42));
    const b = generateRound(players, new Set(), new Set(), mulberry32(42));
    expect(a.top?.id).toBe(b.top?.id);
  });

  it("assignTeamIdentities devolve nomes distintos para 8 times", () => {
    const nomes = assignTeamIdentities(123, 8).map((t) => t.name);
    expect(nomes).toHaveLength(8);
    expect(new Set(nomes).size).toBe(8);
  });

  it("o fixture de cartas passa pelo schema real do jogo", () => {
    const result = validatePlayerDatabase({ players: makeBase(8) });
    expect(result.ok).toBe(true);
  });
});

/**
 * 8 times sem nenhum "user" — exatamente como a sala monta (D-22).
 *
 * DESVIO DO BRIEF: o brief original fatiava `players.slice(i * 5, i * 5 + 5)`,
 * mas makeBase() agrupa os jogadores por rota (8 tops, depois 8 junglers, ...),
 * entao essa fatia dava 5 jogadores da MESMA rota por time. runMatchEngine
 * indexa o roster por rota (deriveCompProfile em src/sim/teamComp.ts le
 * players[role].meta para cada uma das 5 rotas) e estourava com
 * "Cannot read properties of undefined (reading 'meta')" pra qualquer rota
 * ausente. Aqui cada time pega o i-esimo jogador de cada rota (makeBase da
 * ids "${role}-${i}"), replicando o padrao ja usado em
 * src/tournament/series.test.ts (roles.map(role => makePlayer(...))).
 */
function oitoTimesDaSala(players: PlayerVersion[]): TournamentTeam[] {
  const times: TournamentTeam[] = [];
  for (let i = 0; i < 8; i++) {
    times.push({
      id: `assento-${i}`,
      isUser: false,
      displayName: `Time ${i}`,
      tag: tagFromName(`Time ${i}`),
      roster: ALL_ROLES.map(
        (role) => players.find((p) => p.id === `${role}-${i}`)!
      ),
    });
  }
  return times;
}

describe("contrato com o torneio do jogo", () => {
  it("createTournament aceita 8 times sem nenhum time 'user' (D-22)", () => {
    const t = createTournament(999, oitoTimesDaSala(makeBase(8)));
    expect(t.teams["user"]).toBeUndefined();
    expect(t.userTeamId).toBe("user");
    const prontas = (Object.keys(t.slots) as SlotId[]).filter(
      (s) => t.slots[s]!.series.status === "ready"
    );
    expect(prontas.sort()).toEqual(["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"]);
  });

  it("advanceSlot nao estoura com userTeamId apontando pra ninguem (D-22)", () => {
    const t = createTournament(999, oitoTimesDaSala(makeBase(8)));
    const s = t.slots["UB_QF_1"]!.series;
    const depois = advanceSlot(t, "UB_QF_1", s.teamAId!, s.teamBId!);
    expect(depois.slots["UB_QF_1"]!.series.status).toBe("complete");
    expect(depois.status).toBe("active");
  });

  it("o bracket tem exatamente 6 ondas, de 4, 4, 3, 1, 1 e 1 series (D-23)", () => {
    let t = createTournament(4242, oitoTimesDaSala(makeBase(8)));
    const tamanhos: number[] = [];
    for (;;) {
      const prontas = (Object.keys(t.slots) as SlotId[]).filter(
        (s) => t.slots[s]!.series.status === "ready"
      );
      if (prontas.length === 0) break;
      tamanhos.push(prontas.length);
      for (const slotId of prontas) {
        const s = t.slots[slotId]!.series;
        t = advanceSlot(t, slotId, s.teamAId!, s.teamBId!);
      }
    }
    expect(tamanhos).toEqual([4, 4, 3, 1, 1, 1]);
    expect(t.status).toBe("complete");
    expect(t.championId).not.toBeNull();
  });

  it("runSeriesGame e deterministica — a base do D-25", () => {
    const t = createTournament(999, oitoTimesDaSala(makeBase(8)));
    const a = runSeriesGame(t, "UB_QF_1", 0.25, []);
    const b = runSeriesGame(t, "UB_QF_1", 0.25, []);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const t2 = createTournament(999, oitoTimesDaSala(makeBase(8)));
    expect(JSON.stringify(runSeriesGame(t2, "UB_QF_1", 0.25, []))).toBe(JSON.stringify(a));
  });

  it("chaosLevel muda o jogo — por isso ele e congelado e guardado (D-26)", () => {
    const t = createTournament(999, oitoTimesDaSala(makeBase(8)));
    const calmo = runSeriesGame(t, "UB_QF_1", 0.0, []);
    const caotico = runSeriesGame(t, "UB_QF_1", 1.0, []);
    expect(JSON.stringify(calmo)).not.toBe(JSON.stringify(caotico));
  });

  it("o jogo enquadra sempre teamA quando nao ha time 'user' (D-08 / D-22)", () => {
    const t = createTournament(999, oitoTimesDaSala(makeBase(8)));
    const jogo = runSeriesGame(t, "UB_QF_1", 0.25, []);
    expect(jogo.userFrameTeamId).toBe(t.slots["UB_QF_1"]!.series.teamAId);
  });

  it("seriesWinnerId corta em 3 vitorias", () => {
    const base = { status: "in_progress" as const, teamAId: "a", teamBId: "b", games: [], winnerId: null, fearlessUsed: {} };
    expect(seriesWinnerId({ ...base, wins: { a: 2, b: 1 } })).toBeNull();
    expect(seriesWinnerId({ ...base, wins: { a: 3, b: 1 } })).toBe("a");
  });

  it("le o champions.json real do repositorio", async () => {
    const r = await readChampionCatalogue(REAL_CATALOGUE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.champions.length).toBeGreaterThan(100);
      expect(typeof r.champions[0]!.id).toBe("string");
    }
  });

  it("recusa catalogo invalido sem lancar", async () => {
    const r = await readChampionCatalogue(resolve(process.cwd(), "public/players.json"));
    expect(r.ok).toBe(false);
  });
});
