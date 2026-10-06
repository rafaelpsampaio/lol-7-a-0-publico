import { describe, expect, it } from "vitest";
import { renderToString } from "solid-js/web";
import { PlayerCard } from "./PlayerCard";
import { playerName, playerTags } from "../data/playerPresentation";
import { visibleStats, type StatsMode } from "../data/statsPolicy";
import { makeCard } from "../../server/room/cards.fixture";
import { makePlayer } from "../__tests__/helpers/makePlayer";
const player = { ...makeCard({id:"one",personId:"fulano",primaryRole:"top",displayName:"Fulano Top 2017"}),year:2017,lanePhase:73,midGame:61,lateGame:55,traits:[] };
describe("apresentação das cartas", () => {
  it("separa nome, ano e rota sem apagar nomes compostos", () => {
    expect(playerName(player)).toBe("Fulano");
    expect(playerName({...player,displayName:"Hans Sama ADC 2017"})).toBe("Hans Sama");
    expect(playerName({...player,displayName:"Top"})).toBe("Top");
    const html=renderToString(() => <PlayerCard player={player} />);
    expect(html).toContain("Fulano</h3>"); expect(html).toContain("2017</p>"); expect(html).not.toContain("Fulano Top");
  });
  it.each([
    ["never",false,"none"],["never",true,"none"],
    ["overall",false,"overall"],["overall",true,"overall"],
    ["overall_after",false,"none"],["overall_after",true,"overall"],
    ["full",false,"full"],["full",true,"full"],
    ["full_after",false,"none"],["full_after",true,"full"],
  ] as const)("%s, carta escolhida %s", (mode,picked,expected) => {
    expect(visibleStats(mode,picked)).toBe(expected);
    const html=renderToString(() => <PlayerCard player={player} mode={mode as StatsMode} picked={picked} />);
    expect(html.includes("OVR")).toBe(expected!=="none");
    expect(html.includes("Início")).toBe(expected==="full");
  });
  it("não inventa tags, estilo ou descrição a partir dos atributos", () => {
    expect(playerTags(player)).toEqual([]);
    const html=renderToString(() => <PlayerCard player={player} />);
    expect(html).not.toContain("Dominador"); expect(html).not.toContain("73");
  });
  it("usa apenas tags cadastradas e apresenta a descrição em tooltip", () => {
    const html=renderToString(() => <PlayerCard player={{...player, traits:["mental_fort"]}} />);
    expect(html).toContain("Cabeça fria"); expect(html).toContain('role="tooltip"');
  });
  it("aceita foto sem alterar a identidade da carta", () => {
    const html=renderToString(() => <PlayerCard player={{...player,photo:"/sample-photo.jpg"}} />);
    expect(html).toContain('src="/sample-photo.jpg"'); expect(html).toContain('alt="Fulano"');
  });
  it("mostra a nota geral como selo no retrato, uma vez so, seguindo o modo de stats (E-13)", () => {
    const p = { ...makePlayer("top", { displayName: "Rafa Top 2018", year: 2018 }), lanePhase: 75, midGame: 85, lateGame: 85 };
    const visivel = renderToString(() => <PlayerCard player={p} mode="full" />);
    expect(visivel).toContain("player-card__ovr");
    expect(visivel).toContain(">82<");
    expect(visivel.match(/OVR/g)?.length).toBe(1);
    const oculto = renderToString(() => <PlayerCard player={p} mode="overall_after" />);
    expect(oculto).not.toContain("player-card__ovr");
  });
});
