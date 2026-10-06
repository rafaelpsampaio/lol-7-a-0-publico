/**
 * src/room/VotePanel.test.tsx
 *
 * Renderizacao SSR do painel de votacao (mesmo padrao de BracketScreen.test.tsx:
 * renderToString, sem jsdom). Duas armadilhas ja custaram testes vazios nesta
 * sessao (Tarefa 11): frases dinamicas quebradas por comentarios de
 * hidratacao do SSR, e digitos soltos que casam por acidente com o atributo
 * `data-hk`. As duas sao evitadas aqui testando a FRASE inteira, nunca um
 * numero solto.
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import { VotePanel } from "./VotePanel";
import type { RoomStore } from "../net/store";
import {
  TOTAL_WAVES,
  type TournamentTeamWire,
  type TournamentWire,
  type VoteChoice,
} from "../../server/protocol";

/** TournamentWire minimo e valido, com overrides pontuais (mesma forma de BracketScreen.test.tsx). */
function fioDeTorneio(overrides: Partial<TournamentWire> = {}): TournamentWire {
  return {
    wave: 3,
    totalWaves: TOTAL_WAVES,
    series: [],
    teams: [
      {
        id: "assento-0",
        seatIndex: 0,
        displayName: "Time A",
        tag: "TIA",
        publicId: "pub-a",
        eliminated: false,
      },
      {
        id: "assento-1",
        seatIndex: 1,
        displayName: "Time B",
        tag: "TIB",
        publicId: "pub-b",
        eliminated: false,
      },
    ],
    ready: [],
    readyFaltam: 0,
    readyTotal: 0,
    espectadoresContam: false,
    watching: {},
    sync: null,
    vote: { votes: {}, faltam: 0 },
    championId: null,
    id: "torneio-teste",
    barreira: [],
    pulado: false,
    awards: null,
    ...overrides,
  };
}

function storeFalso(torneio: TournamentWire | null, publicId = "pub-a", isHost = false): RoomStore {
  return {
    tournament: () => torneio,
    state: () => ({ players: [{ publicId: "pub-a", nickname: "rafa" }] }),
    publicId: () => publicId,
    isHost: () => isHost,
    vote: () => {},
    forceAdvance: () => {},
  } as unknown as RoomStore;
}

function render(over: Partial<TournamentWire> = {}, publicId = "pub-a", isHost = false): string {
  return renderToString(() => <VotePanel store={storeFalso(fioDeTorneio(over), publicId, isHost)} />);
}

describe("VotePanel — o que a tela afirma", () => {
  it("nao aparece quando nao ha votacao aberta", () => {
    expect(render({ vote: null })).toBe("");
  });

  it("explica a escolha e mostra os dois botoes com o nome decidido (D2)", () => {
    const html = render();
    expect(html).toContain("Todos os times da sala já foram eliminados.");
    expect(html).toContain("Continuar assistindo");
    expect(html).toContain("Pular para o pódio");
    expect(html).not.toContain("Encerrar no");
  });

  it("diz que empate mantem a sala assistindo (D-33)", () => {
    expect(render()).toContain("Em caso de empate, a sala continua assistindo.");
  });

  it("mostra quantos votos faltam, no plural e no singular", () => {
    expect(render({ vote: { votes: {}, faltam: 2 } })).toContain("Faltam 2 votos para a votação fechar.");
    const um = render({ vote: { votes: {}, faltam: 1 } });
    expect(um).toContain("Falta 1 voto para a votação fechar.");
    expect(um).not.toContain("1 votos");
  });

  it("mostra quem ja votou, pelo apelido e sigla, e o que votou", () => {
    const html = render({ vote: { votes: { "pub-a": "parar" }, faltam: 1 } });
    expect(html).toContain("rafa (TIA) votou para pular para o pódio.");
  });

  it("os botoes continuam clicaveis para quem ja votou (pode trocar)", () => {
    const votos: Record<string, VoteChoice> = { "pub-a": "parar" };
    expect(render({ vote: { votes: votos, faltam: 1 } })).not.toContain("disabled");
  });

  it("marca visualmente o meu proprio voto atual", () => {
    const votos: Record<string, VoteChoice> = { "pub-a": "continuar" };
    const html = render({ vote: { votes: votos, faltam: 1 } });
    const primeiroBotao = html.match(/<button[^>]*>/)?.[0] ?? "";
    expect(primeiroBotao).toContain("room-btn--active");
  });

  it("espectador sem time nao ve os botoes de voto", () => {
    const html = render({}, "pub-plateia");
    expect(html).toContain("quem tem time na sala decide");
    expect(html).not.toContain("Pular para o pódio</button>");
  });

  it("so o host pode encerrar a votacao agora", () => {
    expect(render({}, "pub-a", true)).toContain("Encerrar a votação agora");
    expect(render({}, "pub-a", false)).not.toContain("Encerrar a votação agora");
  });
});
