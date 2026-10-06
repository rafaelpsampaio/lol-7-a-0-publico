import { describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import { DEFAULT_MAP, deadLabel } from "./playbackDefaults";
import { TeamPanel } from "./TeamPanel";
import { TabScoreboard } from "./TabScoreboard";
import { isSummaryEvent } from "./EventTicker";
import { traitRoster } from "../__tests__/helpers/traitRoster";
import type { GameEvent } from "../sim/types";

function eventoComMidFora(): GameEvent {
  const map = structuredClone(DEFAULT_MAP);
  map.user.players.mid = { ...map.user.players.mid, alive: false, respawnInSec: null, away: true };
  return { gameTimeMs: 900_000, playbackMs: 0, type: "player_quit", team: "user", winProbAfter: 0.3, map };
}

describe("quits na tela (spec 4)", () => {
  it("deadLabel: SAIU no lugar do relogio", () => {
    expect(deadLabel({ away: true, respawnInSec: null })).toBe("SAIU");
    expect(deadLabel({ respawnInSec: 75 })).toBe("1:15");
  });

  it("painel do time mostra saiu", () => {
    const html = renderToString(() => (
      <TeamPanel event={eventoComMidFora()} side="user" teamName="Time" teamTag="TIM"
        roster={traitRoster("u")} champions={{}} catalogue={[]} />
    ));
    expect(html).toContain("tpanel-away");
    expect(html).toContain("saiu");
  });

  it("placar TAB mostra saiu", () => {
    const html = renderToString(() => (
      <TabScoreboard event={eventoComMidFora()} userRoster={traitRoster("u")} rivalRoster={traitRoster("r")}
        userChampions={{}} rivalChampions={{}} catalogue={[]} />
    ));
    expect(html).toContain("tab-away");
  });

  it("os dois eventos entram nos Destaques", () => {
    expect(isSummaryEvent({ type: "player_quit" })).toBe(true);
    expect(isSummaryEvent({ type: "player_returned" })).toBe(true);
  });
});
