import { describe, it, expect } from "vitest";
import { countingRng, traitState } from "../__tests__/helpers/traitRoster";
import { noteDeathForQuits, noteKillForQuits, quitEligible, rollPendingQuits } from "./quits";
import type { MatchState, PlayerState } from "./matchState";

function morrer(s: MatchState, p: PlayerState, t: number): void {
  s.gameTimeSec = t;
  p.deaths += 1;
  p.alive = false;
  noteDeathForQuits(s, p);
}

/** Gerador com respostas fixas, na ordem. */
function fixo(...xs: number[]): () => number {
  let i = 0;
  return () => xs[i++];
}

describe("quits: gatilho (3.6)", () => {
  it("so quem tem a trait tem rastro", () => {
    const s = traitState({ mid: ["quits"] });
    expect(s.user.players.mid.quitTrack).toEqual({ deathsSinceKillSec: [], pending: false, used: false });
    expect(s.user.players.top.quitTrack).toBeUndefined();
  });

  it("partida ruim E momento ruim: dispara", () => {
    const s = traitState({ mid: ["quits"] });
    const mid = s.user.players.mid;
    mid.deaths = 1;
    mid.kills = 1;
    morrer(s, mid, 600);
    morrer(s, mid, 700);
    expect(mid.quitTrack!.pending).toBe(false);
    morrer(s, mid, 800);
    expect(mid.deaths).toBe(4);
    expect(quitEligible(s, mid)).toBe(true);
    expect(mid.quitTrack!.pending).toBe(true);
  });

  it("so o momento ruim nao basta (abates + assistencias altos)", () => {
    const s = traitState({ mid: ["quits"] });
    const mid = s.user.players.mid;
    mid.deaths = 1;
    mid.kills = 2;
    mid.assists = 2;
    for (const t of [600, 700, 800]) morrer(s, mid, t);
    expect(mid.quitTrack!.pending).toBe(false);
  });

  it("so a partida ruim nao basta (mortes espalhadas)", () => {
    const s = traitState({ mid: ["quits"] });
    const mid = s.user.players.mid;
    for (const t of [300, 700, 1100, 1500]) morrer(s, mid, t);
    expect(mid.deaths).toBe(4);
    expect(mid.quitTrack!.pending).toBe(false);
  });

  it("um abate dele zera a sequencia", () => {
    const s = traitState({ mid: ["quits"] });
    const mid = s.user.players.mid;
    mid.deaths = 1;
    morrer(s, mid, 600);
    morrer(s, mid, 650);
    noteKillForQuits(mid);
    morrer(s, mid, 700);
    expect(mid.quitTrack!.pending).toBe(false);
  });
});

describe("quits: sorteio no fim do tick", () => {
  function pendente(): MatchState {
    const s = traitState({ mid: ["quits"] });
    s.gameTimeSec = 900;
    s.user.players.mid.alive = false;
    s.user.players.mid.respawnAtSec = 930;
    s.user.players.mid.quitTrack!.pending = true;
    return s;
  }

  it("sem pendente: nenhum sorteio (T-02)", () => {
    const c = countingRng();
    expect(rollPendingQuits(traitState({ mid: ["quits"] }), c.rng)).toEqual([]);
    expect(rollPendingQuits(traitState(), c.rng)).toEqual([]);
    expect(c.calls()).toBe(0);
  });

  it("sai e volta entre 2 e 5 minutos", () => {
    const s = pendente();
    const out = rollPendingQuits(s, fixo(0.1, 0.2, 0.5));
    const mid = s.user.players.mid;
    expect(out).toEqual([{ side: "user", player: mid, returnsAtSec: 1110 }]);
    expect(mid.away).toBe(true);
    expect(mid.alive).toBe(false);
    expect(mid.respawnAtSec).toBe(1110);
    expect(mid.quitTrack).toEqual({ deathsSinceKillSec: [], pending: false, used: true });
  });

  it("sai e nao volta (Review Focus 3)", () => {
    const s = pendente();
    const out = rollPendingQuits(s, fixo(0.1, 0.9));
    expect(out[0].returnsAtSec).toBeNull();
    expect(s.user.players.mid.respawnAtSec).toBeNull();
    expect(s.user.players.mid.away).toBe(true);
  });

  it("nao quita: limpa o pendente e segue podendo quitar depois", () => {
    const s = pendente();
    expect(rollPendingQuits(s, fixo(0.9))).toEqual([]);
    expect(s.user.players.mid.away).toBeUndefined();
    expect(s.user.players.mid.quitTrack).toMatchObject({ pending: false, used: false });
  });

  it("quem ja quitou nao fica pendente de novo", () => {
    const s = traitState({ mid: ["quits"] });
    const mid = s.user.players.mid;
    mid.quitTrack!.used = true;
    mid.deaths = 5;
    for (const t of [600, 700, 800]) morrer(s, mid, t);
    expect(mid.quitTrack!.pending).toBe(false);
  });
});
