/**
 * src/room/PodiumScreen.test.tsx
 *
 * Renderizacao SSR da tela final (mesmo padrao de BracketScreen.test.tsx:
 * renderToString, sem jsdom).
 *
 * A sala termina de duas maneiras (as duas sao a fase `finished`): campeao
 * coroado, ou encerrada por votacao com o chaveamento pela metade -- nesse
 * segundo caso `championId` e nulo e NAO HA CAMPEAO. O teste que importa de
 * verdade e o que prova que a tela nao inventa um vencedor nesse caso: e o
 * unico em que a tela PODE mentir, e o menos exercitado a mao.
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import { PodiumScreen, classificacaoFinal } from "./PodiumScreen";
import type { RoomStore } from "../net/store";
import {
  TOTAL_WAVES,
  type TournamentSeriesWire,
  type TournamentTeamWire,
  type TournamentWire,
} from "../../server/protocol";

function times(): TournamentTeamWire[] {
  return [
    { id: "assento-0", seatIndex: 0, displayName: "Time 0", tag: "TI0", publicId: "pub-0", eliminated: true },
    { id: "assento-1", seatIndex: 1, displayName: "Time 1", tag: "TI1", publicId: "pub-1", eliminated: true },
    { id: "assento-2", seatIndex: 2, displayName: "Time 2", tag: "TI2", publicId: "pub-2", eliminated: true },
    { id: "assento-3", seatIndex: 3, displayName: "Time 3", tag: "TI3", publicId: "pub-3", eliminated: false },
  ];
}

/** TournamentWire minimo e valido, com overrides pontuais (mesma forma de BracketScreen.test.tsx). */
function fioDeTorneio(overrides: Partial<TournamentWire> = {}): TournamentWire {
  return {
    wave: TOTAL_WAVES,
    totalWaves: TOTAL_WAVES,
    series: [],
    teams: times(),
    ready: [],
    readyFaltam: 0,
    readyTotal: 0,
    espectadoresContam: false,
    watching: {},
    sync: null,
    vote: null,
    championId: null,
    id: "torneio-teste",
    barreira: [],
    pulado: false,
    awards: null,
    ...overrides,
  };
}

function comPlacar(slotId: TournamentSeriesWire["slotId"], winsA: number, winsB: number): TournamentSeriesWire[] {
  return [
    {
      slotId,
      status: "complete",
      teamAId: "assento-0",
      teamBId: "assento-3",
      wins: { "assento-0": winsA, "assento-3": winsB },
      winnerId: winsA > winsB ? "assento-0" : "assento-3",
      gamesPlayed: winsA + winsB,
    },
  ];
}

function comGamesPlayed(slotId: TournamentSeriesWire["slotId"], gamesPlayed: number): TournamentSeriesWire[] {
  return [
    {
      slotId,
      status: gamesPlayed > 0 ? "complete" : "pending",
      teamAId: null,
      teamBId: null,
      wins: {},
      winnerId: null,
      gamesPlayed,
    },
  ];
}

function storeFalso(torneio: TournamentWire | null, publicId = "pub-eu"): RoomStore {
  return {
    tournament: () => torneio,
    state: () => ({ phase: "finished", players: [] }),
    publicId: () => publicId,
    isHost: () => false,
    games: () => null,
    setWatch: () => {},
  } as unknown as RoomStore;
}

function render(over: Partial<TournamentWire> = {}, publicId = "pub-eu"): string {
  return renderToString(() => <PodiumScreen store={storeFalso(fioDeTorneio(over), publicId)} />);
}

/**
 * Classes do <span> do nome de um time dentro de uma serie -- mesma tecnica
 * de "acha o meu time pelo publicId" em BracketScreen.test.tsx, adaptada pro
 * marcador de hidratacao do SSR (o texto do nome vem depois de um comentario
 * `<!--$-->`, nunca colado direto no `>`) e ao fato de o nome renderizado
 * ser "TAG DisplayName" (nomeTime() em BracketSeriesList.tsx) -- so o
 * DisplayName e passado aqui, entao precisa aceitar a tag antes dele.
 */
function classesDoNomeTime(html: string, displayName: string): string {
  const regex = new RegExp(`<span[^>]*class="([^"]*)"[^>]*>(?:<!--\\$-->)?[^<]*${displayName}`);
  return html.match(regex)?.[1] ?? "";
}

function awardsDeTeste(over: Partial<NonNullable<TournamentWire["awards"]>> = {}) {
  return {
    mvp: { teamId: "assento-3", player: "Fulano", line: "12/2/8", name: "Ahri" },
    bagre: { teamId: "assento-0", player: "Beltrano", line: "1/10/2", name: "Yasuo" },
    ...over,
  };
}

describe("PodiumScreen · destaques do torneio (Fase 7)", () => {
  it("com awards, mostra MVP e Bagre do torneio", () => {
    const html = render({ awards: awardsDeTeste() });
    expect(html).toContain("MVP DO TORNEIO");
    expect(html).toContain("Fulano");
    expect(html).toContain("12/2/8");
    expect(html).toContain("BAGRE DO TORNEIO");
    expect(html).toContain("Beltrano");
    expect(html).toContain("1/10/2");
  });

  it("sem jogo nenhum ainda (awards nulo), nao mostra a secao de destaques", () => {
    const html = render({ awards: null });
    expect(html).not.toContain("MVP DO TORNEIO");
    expect(html).not.toContain("BAGRE DO TORNEIO");
  });

  it("sem retrato do campeao, cai no fallback com as iniciais do nome", () => {
    const html = render({ awards: awardsDeTeste({ mvp: { teamId: "assento-3", player: "Fulano", line: "1/0/0", name: "Ahri" } }) });
    expect(html).toContain("award-portrait--fallback");
    expect(html).toContain("Ahr");
  });

  it("aparece tanto no ramo com campeao quanto no ramo sem campeao", () => {
    expect(render({ championId: "assento-3", awards: awardsDeTeste() })).toContain("MVP DO TORNEIO");
    expect(render({ championId: null, awards: awardsDeTeste() })).toContain("MVP DO TORNEIO");
  });
});

describe("PodiumScreen · campeao coroado", () => {
  it("com campeao, mostra o nome do campeao", () => {
    expect(render({ championId: "assento-3" })).toContain("Time 3");
  });

  it("com campeao, mostra o rotulo 'Campeão'", () => {
    expect(render({ championId: "assento-3" })).toMatch(/campeão/i);
  });

  it("com campeao, nao mostra a nota de encerramento por votacao", () => {
    expect(render({ championId: "assento-3" })).not.toMatch(/votação/i);
  });
});

describe("PodiumScreen · encerrado por votacao, sem campeao (a armadilha da tarefa)", () => {
  it("sem campeao, diz que a sala encerrou por votacao e nao inventa um vencedor", () => {
    const html = render({ championId: null });
    expect(html).toMatch(/votação/i);
    expect(html).not.toMatch(/campeão/i);
  });

  it("sem campeao, mostra quem chegou mais longe (os times ainda vivos)", () => {
    const html = render({ championId: null });
    // So o assento-3 (Time 3) ficou vivo no fixture; os outros tres estao eliminados.
    expect(html).toContain("Time 3");
  });

  it("sem campeao, nao lista um time eliminado como se tivesse chegado mais longe", () => {
    const html = render({ championId: null });
    const secaoSobreviventes = html.split("Quem chegou mais longe")[1] ?? "";
    const listaSobreviventes = secaoSobreviventes.split("</ul>")[0] ?? "";
    expect(listaSobreviventes).not.toContain("Time 0");
    expect(listaSobreviventes).toContain("Time 3");
  });
});

describe("PodiumScreen · series ja jogadas continuam clicaveis (D-32)", () => {
  // A listagem em si agora e o componente compartilhado BracketSeriesList
  // (achado da revisao pos-Tarefa-13) -- o botao clicavel carrega a classe
  // .room-bracket__series, nao mais uma .room-podium__series propria. A
  // asserção mudou de forma (o seletor) mas continua igualmente forte: ainda
  // exige um <button> real com a classe do cartao de serie.
  it("com campeao, uma serie ja jogada vira botao", () => {
    const html = render({ championId: "assento-3", series: comPlacar("GF", 3, 1) });
    expect(html).toMatch(/<button[^>]*class="[^"]*room-bracket__series/);
  });

  it("sem campeao, uma serie ja jogada tambem vira botao", () => {
    const html = render({ championId: null, series: comPlacar("UB_QF_1", 2, 1) });
    expect(html).toMatch(/<button[^>]*class="[^"]*room-bracket__series/);
  });

  it("uma serie nunca jogada nao vira botao (estrutural)", () => {
    const html = render({
      championId: null,
      series: [...comPlacar("UB_QF_1", 2, 0), ...comGamesPlayed("GF", 0)],
    });
    const botoes = html.match(/<button[^>]*class="[^"]*room-bracket__series[^"]*"/g) ?? [];
    expect(botoes).toHaveLength(1);
  });
});

// Achado da revisao: a listagem do podio nao perdia so os controles de host
// da BracketScreen -- perdia tambem o rotulo de status, o destaque de
// vencedor, o destaque de eliminado, o destaque do MEU time, e o
// agrupamento por chave. Exatamente a tela onde todo mundo vai olhar com
// calma no fim da noite, mostrando uma versao pobre do chaveamento. Estes
// testes travam a paridade visual com BracketScreen (via o componente
// compartilhado BracketSeriesList).
describe("PodiumScreen · paridade visual com BracketScreen (achado da revisao)", () => {
  it("as series aparecem agrupadas por chave, como na BracketScreen", () => {
    const html = render({ series: comPlacar("UB_QF_1", 3, 1) });
    expect(html).toContain("Chave superior");
    expect(html).toContain("Chave inferior");
    expect(html).toContain("Grande Final");
  });

  it("mostra o rotulo de status da serie (nao so o placar)", () => {
    const html = render({ series: comPlacar("UB_QF_1", 3, 1) });
    expect(html).toContain("encerrada");
  });

  it("destaca o time vencedor da serie (is-winner)", () => {
    // comPlacar: teamA = assento-0 (Time 0), teamB = assento-3 (Time 3).
    // winsA=1, winsB=3 -> quem venceu foi o assento-3, Time 3.
    const html = render({ series: comPlacar("UB_QF_1", 1, 3) });
    expect(classesDoNomeTime(html, "Time 3")).toContain("is-winner");
    expect(classesDoNomeTime(html, "Time 0")).not.toContain("is-winner");
  });

  it("no podio, sem a enxurrada de selos 'Eliminado' (S20): a classificacao ja diz", () => {
    const html = render({ series: comPlacar("UB_QF_1", 3, 1) });
    expect(classesDoNomeTime(html, "Time 0")).not.toContain("is-eliminated");
    expect(html).not.toContain(">Eliminado<");
  });

  it("destaca o MEU time dentro da serie (is-mine), pelo publicId", () => {
    // pub-3 e o publicId do assento-3 (Time 3) no fixture times().
    const html = render({ series: comPlacar("UB_QF_1", 3, 1) }, "pub-3");
    expect(classesDoNomeTime(html, "Time 3")).toContain("is-mine");
    expect(classesDoNomeTime(html, "Time 0")).not.toContain("is-mine");
  });
});

describe("classificacaoFinal (D9)", () => {
  function s(slotId: string, a: string, b: string, vencedor: string): TournamentSeriesWire {
    return { slotId: slotId as TournamentSeriesWire["slotId"], status: "complete", teamAId: a, teamBId: b, wins: {}, winnerId: vencedor, gamesPlayed: 3 };
  }

  it("campeao, vice, 3o, 4o, 5o-6o e 7o-8o pela chave dupla", () => {
    const series = [
      s("GF", "a", "b", "a"),
      s("LB_F", "b", "c", "b"),
      s("LB_SF", "c", "d", "c"),
      s("LB_R2_1", "d", "e", "d"),
      s("LB_R2_2", "c", "f", "c"),
      s("LB_R1_1", "e", "g", "e"),
      s("LB_R1_2", "f", "h", "f"),
    ];
    expect(classificacaoFinal(series, "a")).toEqual([
      { posicao: "1º", teamId: "a" },
      { posicao: "2º", teamId: "b" },
      { posicao: "3º", teamId: "c" },
      { posicao: "4º", teamId: "d" },
      { posicao: "5º–6º", teamId: "e" },
      { posicao: "5º–6º", teamId: "f" },
      { posicao: "7º–8º", teamId: "g" },
      { posicao: "7º–8º", teamId: "h" },
    ]);
  });

  it("sem campeao (sala antiga encerrada por votacao): vazia", () => {
    expect(classificacaoFinal([], null)).toEqual([]);
  });
});

describe("PodiumScreen · revanche (D9)", () => {
  it("o host ve o botao de revanche; convidado le o que acontece se o host comecar", () => {
    const comoHost = renderToString(() => (
      <PodiumScreen store={{ ...storeFalso(fioDeTorneio({ championId: "assento-3" })), isHost: () => true } as RoomStore} />
    ));
    expect(comoHost).toContain("Revanche · jogar de novo com a mesma turma");
    expect(render({ championId: "assento-3" })).toContain("Se o host começar uma revanche");
  });

  it("com campeao, mostra a classificacao final", () => {
    expect(render({ championId: "assento-3" })).toContain("Classificação final");
  });
});
