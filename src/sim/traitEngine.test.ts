import { describe, it, expect } from "vitest";
import { traitRoster, traitState } from "../__tests__/helpers/traitRoster";
import { buildKillerCandidates, resolveConversion, resolveLaneAllIn, simulateMatch } from "./engine";
import type { FightContext } from "./selection";
import { mulberry32 } from "./rng";
import type { MatchState } from "./matchState";
import type { PlayerTrait, Role } from "../data/schema";
import type { SimEvent } from "./simEvents";
import { GameEventSchema } from "./types";
import { runMatchEngine } from "./runMatchEngine";
import { withoutNewTraits } from "./traitEffects";

/** Soma de abates e mortes do jogador `role` do user em `seeds` partidas, user 80 x rival 70. */
function holderKD(role: Role, trait: PlayerTrait | null, seeds = 40): { k: number; d: number } {
  let k = 0;
  let d = 0;
  for (let seed = 0; seed < seeds; seed++) {
    const user = traitRoster("u", trait ? { [role]: [trait] } : {}, 80);
    const rival = traitRoster("r", {}, 70);
    const res = simulateMatch(user, rival, mulberry32(seed));
    const p = (res.finalState as MatchState).user.players[role];
    k += p.kills;
    d += p.deaths;
  }
  return { k, d };
}

describe("flips no motor", () => {
  it("all-in forcado: o portador ganhando mata, perdendo morre", () => {
    const s = traitState({ mid: ["flips"] });
    s.gameTimeSec = 300;
    const ev = resolveLaneAllIn(s, "user", "mid", mulberry32(1), { killer: s.user.players.mid });
    expect(ev).not.toBeNull();
    expect(s.user.players.mid.kills).toBe(1);
    const s2 = traitState({ mid: ["flips"] });
    s2.gameTimeSec = 300;
    resolveLaneAllIn(s2, "rival", "mid", mulberry32(1), { victim: s2.user.players.mid });
    expect(s2.user.players.mid.alive).toBe(false);
    expect(s2.user.players.mid.deaths).toBe(1);
  });

  it("quem flipa mata mais e morre mais nas mesmas sementes", () => {
    const sem = holderKD("mid", null);
    const com = holderKD("mid", "flips");
    expect(com.k).toBeGreaterThan(sem.k);
    expect(com.d).toBeGreaterThan(sem.d);
  });
});

describe("roamer no motor", () => {
  it("o time do roamer ganka mais e o roam aparece na narracao", () => {
    let ganksCom = 0;
    let ganksSem = 0;
    let citaRoam = false;
    for (let seed = 0; seed < 40; seed++) {
      const com = simulateMatch(traitRoster("u", { mid: ["roamer"] }), traitRoster("r"), mulberry32(seed));
      const sem = simulateMatch(traitRoster("u"), traitRoster("r"), mulberry32(seed));
      const ganks = (tl: SimEvent[]) => tl.filter((e) => e.kind === "gank" && e.side === "user").length;
      ganksCom += ganks(com.timeline);
      ganksSem += ganks(sem.timeline);
      if (com.timeline.some((e) => e.kind === "gank" && /roam|saiu da rota/.test(e.ticker))) citaRoam = true;
    }
    expect(ganksCom).toBeGreaterThan(ganksSem);
    expect(citaRoam).toBe(true);
  });
});

describe("side no motor", () => {
  it("derruba mais torres na rota dele no meio de jogo", () => {
    const torresTop = (tl: SimEvent[]) =>
      tl.filter((e) => e.side === "user" && e.lane === "top" && (e.kind === "tower_destroyed" || e.kind === "first_tower")
        && e.timeSec >= 840 && e.timeSec < 1500).length;
    // 300 sementes: medido 267 com x 197 sem. Com 60 a 100 a diferenca ainda fica no ruido.
    let com = 0;
    let sem = 0;
    for (let seed = 0; seed < 300; seed++) {
      com += torresTop(simulateMatch(traitRoster("u", { top: ["side"] }), traitRoster("r"), mulberry32(seed)).timeline);
      sem += torresTop(simulateMatch(traitRoster("u"), traitRoster("r"), mulberry32(seed)).timeline);
    }
    expect(com).toBeGreaterThan(sem);
  });
});

describe("quits no motor", () => {
  /** Primeira semente em que o mid do user (quits, 60) quita contra um time de 85. */
  function primeiraComQuit(querVolta: boolean | null) {
    for (let seed = 0; seed < 400; seed++) {
      const res = simulateMatch(traitRoster("u", { mid: ["quits"] }, 60), traitRoster("r", {}, 85), mulberry32(seed));
      const quit = res.timeline.find((e) => e.kind === "player_quit");
      if (!quit) continue;
      const voltou = res.timeline.some((e) => e.kind === "player_returned");
      if (querVolta === null || voltou === querVolta) return { seed, res, quit };
    }
    throw new Error("nenhuma semente com quit em 400; revisar o gatilho");
  }

  it("quem sai fica fora do mapa, ganha so o passivo e pode voltar", () => {
    const { res, quit } = primeiraComQuit(true);
    expect(quit.ticker).toMatch(/quitou a partida/);
    const depois = res.timeline.filter((e) => e.timeSec > quit.timeSec);
    const volta = depois.find((e) => e.kind === "player_returned")!;
    expect(volta.ticker).toMatch(/voltou para a partida/);
    const fora = depois.filter((e) => e.timeSec < volta.timeSec);
    for (const e of fora) {
      expect(e.map.user.players.mid.alive).toBe(false);
      expect(e.map.user.players.mid.away).toBe(true);
      expect(e.map.user.players.mid.respawnInSec).toBeNull();
    }
    if (fora.length >= 2) {
      // Pelo menos o passivo por tick. Pode passar disso: ouro global dividido entre os 5 (torre,
      // recompensa de objetivo) tambem chega a quem esta fora, como no LoL.
      const primeiro = fora[0].map.user.players.mid;
      const ultimo = fora[fora.length - 1].map.user.players.mid;
      const ticks = (fora[fora.length - 1].timeSec - fora[0].timeSec) / 15;
      expect(ultimo.gold - primeiro.gold).toBeGreaterThanOrEqual(Math.round((122.4 * 15) / 60) * ticks);
      expect(ultimo.kills).toBe(primeiro.kills);
      expect(ultimo.assists).toBe(primeiro.assists);
    }
    expect(volta.map.user.players.mid.away).toBeUndefined();
  });

  it("quem sai e nao volta termina a partida fora, e a partida acaba (Review Focus 3)", () => {
    const { res } = primeiraComQuit(false);
    const ultimo = res.timeline[res.timeline.length - 1];
    expect(ultimo.map.user.players.mid.away).toBe(true);
    expect(res.durationSec).toBeLessThan(60 * 60);
  });

  it("os eventos novos validam no contrato", () => {
    const { seed } = primeiraComQuit(null);
    const out = runMatchEngine(
      { userRoster: traitRoster("u", { mid: ["quits"] }, 60), rivalRoster: traitRoster("r", {}, 85), userChampions: {}, rivalChampions: {}, speedPreset: "fast" },
      seed
    );
    const quit = out.events.find((e) => e.type === "player_quit")!;
    expect(GameEventSchema.safeParse(quit).success).toBe(true);
  });
});

describe("chave das traits novas", () => {
  const user = () => traitRoster("u", { mid: ["flips", "mental_fort"], jungle: ["dragon_lover"] }, 70);
  const rival = () => traitRoster("r", { top: ["quits"] }, 75);

  it("withoutNewTraits tira so as 6 novas", () => {
    const limpo = withoutNewTraits(user());
    expect(limpo.find((c) => c.primaryRole === "mid")!.traits).toEqual(["mental_fort"]);
    expect(limpo.find((c) => c.primaryRole === "jungle")!.traits).toEqual([]);
  });

  it("desligada, a partida e a mesma de quem nao tem as traits novas", () => {
    const base = { userChampions: {}, rivalChampions: {}, speedPreset: "fast" as const };
    const desligada = runMatchEngine({ ...base, userRoster: user(), rivalRoster: rival(), newTraitEffects: false }, 7);
    const semTraits = runMatchEngine({ ...base, userRoster: withoutNewTraits(user()), rivalRoster: withoutNewTraits(rival()) }, 7);
    expect(desligada.events).toEqual(semTraits.events);
    expect(desligada.winner).toBe(semTraits.winner);
  });
});

describe("contadores do harness", () => {
  it("so existem com recordStats e nao mudam a partida", () => {
    const sem = simulateMatch(traitRoster("u"), traitRoster("r"), mulberry32(3));
    expect((sem.finalState as MatchState).harnessStats).toBeUndefined();
    const com = simulateMatch(traitRoster("u"), traitRoster("r"), mulberry32(3), undefined, { recordStats: true });
    const hs = (com.finalState as MatchState).harnessStats!;
    expect(hs.fightWins.user + hs.fightWins.rival).toBeGreaterThan(0);
    expect(hs.conversions).toBeGreaterThanOrEqual(0);
    // o id do evento vem de um contador global do modulo: difere entre duas chamadas, nao entre partidas
    const semId = (tl: SimEvent[]) => tl.map(({ id: _id, ...resto }) => resto);
    expect(semId(com.timeline)).toEqual(semId(sem.timeline));
  });
});

describe("roam na narracao e nas assistencias (revisao final)", () => {
  const RE_ROAM = /com o roam de|saiu da rota/;

  it("first_blood e shutdown de roam citam o roam, nao so o gank", () => {
    let citados = 0;
    for (let seed = 0; seed < 300; seed++) {
      const res = simulateMatch(traitRoster("u", { mid: ["roamer"] }), traitRoster("r"), mulberry32(seed));
      for (const e of res.timeline) {
        if (e.side === "user" && (e.kind === "first_blood" || e.kind === "shutdown") && RE_ROAM.test(e.ticker)) citados++;
      }
    }
    expect(citados).toBeGreaterThan(0);
  });

  it("quando o roamer nao fica com o abate ele entra garantido nas assistencias", () => {
    let comRoamAlheio = 0;
    let assistencias = 0;
    for (let seed = 0; seed < 150; seed++) {
      const res = simulateMatch(traitRoster("u", { mid: ["roamer"] }), traitRoster("r"), mulberry32(seed));
      comRoamAlheio += res.timeline.filter((e) => e.side === "user" && /com o roam de/.test(e.ticker)).length;
      assistencias += (res.finalState as MatchState).user.players.mid.assists;
    }
    expect(comRoamAlheio).toBeGreaterThan(5);
    expect(assistencias).toBeGreaterThanOrEqual(comRoamAlheio);
  });
});

describe("candidatos a killer sem ninguem vivo (revisao final)", () => {
  it("o fallback nunca devolve quem esta fora da partida (away)", () => {
    const s = traitState({ mid: ["quits"] });
    for (const r of ["top", "jungle", "mid", "adc", "support"] as const) s.user.players[r].alive = false;
    s.user.players.mid.away = true;
    const ids = buildKillerCandidates(s.user, {} as FightContext).map((p) => p.card.id);
    expect(ids).not.toContain("u-mid");
    expect(ids.length).toBe(4);
  });

  it("se so restar gente fora, mantem a lista original (nunca vazia)", () => {
    const s = traitState();
    for (const r of ["top", "jungle", "mid", "adc", "support"] as const) {
      s.user.players[r].alive = false;
      s.user.players[r].away = true;
    }
    expect(buildKillerCandidates(s.user, {} as FightContext).length).toBe(5);
  });
});

describe("dragon_lover na luta do poco (conversao)", () => {
  it("o dono do trait morre mais na luta de conversao do que sem o trait", () => {
    const mortesDoJungler = (comTrait: boolean): number => {
      let mortes = 0;
      for (let seed = 0; seed < 400; seed++) {
        const s = traitState({}, comTrait ? { jungle: ["dragon_lover"] } : {});
        s.gameTimeSec = 1100;
        s.objectives.dragonAlive = true;
        s.objectives.dragonElement = "infernal";
        s.objectivePrep.user.dragon = 50;
        for (const r of ["top"] as const) {
          s.rival.players[r].alive = false;
          s.rival.players[r].respawnAtSec = s.gameTimeSec + 40;
        }
        s.lastFightWon = { side: "user", place: "river_bot", atSec: s.gameTimeSec };
        resolveConversion(s, "user", mulberry32(seed));
        mortes += s.rival.players.jungle.deaths;
      }
      return mortes;
    };
    expect(mortesDoJungler(true)).toBeGreaterThan(mortesDoJungler(false));
  });
});
