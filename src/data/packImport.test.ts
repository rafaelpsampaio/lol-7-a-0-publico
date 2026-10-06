import { describe, it, expect } from "vitest";
import { buildPlayersFromRows, type RawRow } from "./packImport";
import type { ChampionEntry } from "./schema";

const champ = (id: string, name: string): ChampionEntry => ({ id, name, traits: [] });

// Small catalogue covering the macacos typos + enough fillers to pad to 8.
const CHAMPIONS: ChampionEntry[] = [
  champ("zed", "Zed"),
  champ("vladimir", "Vladimir"),
  champ("viktor", "Viktor"),
  champ("ekko", "Ekko"),
  champ("ryze", "Ryze"),
  champ("riven", "Riven"),
  champ("yasuo", "Yasuo"),
  champ("katarina", "Katarina"),
  champ("miss-fortune", "Miss Fortune"),
  champ("khazix", "Kha'Zix"),
  champ("gangplank", "Gangplank"),
  champ("yuumi", "Yuumi"),
  champ("renata", "Renata Glasc"),
  champ("sejuani", "Sejuani"),
  champ("amumu", "Amumu"),
  champ("garen", "Garen"),
  champ("ashe", "Ashe"),
  champ("jinx", "Jinx"),
];

const HEADER: RawRow = [
  "id", "personId", "displayName", "year", "primaryRole",
  "lanePhase", "midGame", "lateGame", "Overall", "trait1", "trait2",
  "champ1_id", "champ1_mastery", "champ2_id", "champ2_mastery",
  "champ3_id", "champ3_mastery", "champ4_id", "champ4_mastery",
];

describe("buildPlayersFromRows", () => {
  it("imports a clean-ish row and normalizes role casing", () => {
    const row: RawRow = [
      "jose_jungle", "jose", "Jose Jg", "", "Jungle",
      "40", "40", "40", "40", "mental_fort", "",
      "sejuani", "5", "amumu", "2", "garen", "2", "ashe", "1",
    ];
    const { players } = buildPlayersFromRows([HEADER, row], CHAMPIONS);
    expect(players).toHaveLength(1);
    const p = players[0];
    expect(p.primaryRole).toBe("jungle");
    expect(p.displayName).toBe("Jose Jg");
    expect(p.roleStrength.jungle).toBe(40);
    expect(p.championPool.length).toBeGreaterThanOrEqual(8); // padded
    expect(p.year).toBeUndefined(); // ano vazio fica vazio (A-06)
  });

  it("fixes champion typos and reports them", () => {
    const row: RawRow = [
      "", "", "Tester", "", "adc",
      "", "", "", "60", "", "",
      "miss fortune", "5", "gankplank", "3", "yummi", "2", "kha zix", "1",
    ];
    const { players, report } = buildPlayersFromRows([HEADER, row], CHAMPIONS);
    const p = players[0];
    const ids = p.championPool.map((c) => c.championId);
    expect(ids).toContain("miss-fortune");
    expect(ids).toContain("gangplank");
    expect(ids).toContain("yuumi");
    expect(ids).toContain("khazix");
    expect(report[0].status).toBe("fixed");
    expect(report[0].messages.join(" ")).toMatch(/entendido como/);
  });

  it("drops unknown traits with a warning but keeps the player", () => {
    const row: RawRow = [
      "", "", "Raguto Mid", "", "mid",
      "50", "50", "40", "47", "voa_baixo", "come_grama",
      "zed", "5", "vladimir", "2", "viktor", "3", "ekko", "3",
    ];
    const { players, report } = buildPlayersFromRows([HEADER, row], CHAMPIONS);
    expect(players).toHaveLength(1);
    expect(players[0].traits).toEqual([]); // both dropped
    expect(report[0].status).toBe("warning");
    expect(report[0].messages.join(" ")).toMatch(/não reconhecido/);
  });

  it("accepts pt-BR trait labels", () => {
    const row: RawRow = [
      "", "", "Cabeca", "", "support",
      "", "", "", "60", "Cabeça fria", "Provocador",
      "renata", "3", "", "", "", "", "", "",
    ];
    const { players } = buildPlayersFromRows([HEADER, row], CHAMPIONS);
    expect(players[0].traits).toEqual(expect.arrayContaining(["mental_fort", "trash_talker"]));
  });

  it("aceita o rotulo novo e o antigo do dragon_lover (Review Focus 2)", () => {
    for (const label of ["Ama objetivos", "Ama dragão"]) {
      const row: RawRow = [
        "", "", "Lover", "", "jungle",
        "", "", "", "60", label, "",
        "sejuani", "3", "", "", "", "", "", "",
      ];
      const { players } = buildPlayersFromRows([HEADER, row], CHAMPIONS);
      expect(players[0].traits).toEqual(["dragon_lover"]);
    }
  });

  it("errors a row with no name and excludes it", () => {
    const row: RawRow = ["", "", "", "", "mid", "", "", "", "", "", "", "zed", "5"];
    const { players, report } = buildPlayersFromRows([HEADER, row], CHAMPIONS);
    expect(players).toHaveLength(0);
    expect(report[0].status).toBe("error");
  });

  it("generates unique ids for same-name same-role rows", () => {
    const row = (n: string): RawRow => [
      "", "", "Dup", "", "mid", "50", "50", "50", "50", "", "",
      "zed", "5", "ryze", "3", "viktor", "2", "ekko", "1",
    ];
    const { players } = buildPlayersFromRows([HEADER, row("a"), row("b")], CHAMPIONS);
    expect(players).toHaveLength(2);
    expect(players[0].id).not.toBe(players[1].id);
  });

  it("summarizes statuses", () => {
    const ok: RawRow = ["", "", "Ok", "", "mid", "50", "50", "50", "50", "", "",
      "zed", "5", "ryze", "3", "viktor", "2", "ekko", "1"];
    const { summary } = buildPlayersFromRows([HEADER, ok], CHAMPIONS);
    // pool padded from 4 -> 8 => counts as "fixed"
    expect(summary.total).toBe(1);
    expect(summary.fixed).toBe(1);
  });

  it("le ate 4 traits (trait1..trait4, A-05)", () => {
    const header: RawRow = [
      "displayName", "primaryRole", "lanePhase", "midGame", "lateGame",
      "trait1", "trait2", "trait3", "trait4",
      "champ1_id", "champ1_mastery",
    ];
    const row: RawRow = [
      "Rafa Top", "top", "70", "75", "80",
      "mental_fort", "teamfights", "flips", "Joga side",
      "zed", "5",
    ];
    const { players } = buildPlayersFromRows([header, row], CHAMPIONS);
    expect(players[0]!.traits).toEqual(["mental_fort", "teamfights", "flips", "side"]);
  });

  it("forca vazia vira a media das 3 fases em vez de 70", () => {
    const row: RawRow = [
      "", "", "Media", "", "mid",
      "60", "65", "71", "", "", "",
      "zed", "5", "ryze", "3", "viktor", "2", "ekko", "1",
    ];
    const { players } = buildPlayersFromRows([HEADER, row], CHAMPIONS);
    expect(players[0]!.roleStrength.mid).toBe(65); // round((60+65+71)/3)
  });

  it("ano preenchido continua sendo lido", () => {
    const row: RawRow = [
      "", "", "Com Ano", "2018", "top",
      "50", "50", "50", "50", "", "",
      "zed", "5", "ryze", "3", "viktor", "2", "ekko", "1",
    ];
    const { players } = buildPlayersFromRows([HEADER, row], CHAMPIONS);
    expect(players[0]!.year).toBe(2018);
  });
});
