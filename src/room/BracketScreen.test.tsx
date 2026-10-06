/**
 * src/room/BracketScreen.test.tsx
 *
 * Renderizacao SSR da tela do chaveamento (renderToString, sem jsdom). Prende
 * o que a tela AFIRMA — nao dispara evento, entao clique fica para
 * conferencia de navegador.
 *
 * Rundown da Sala 2: rodadas nomeadas (D8), resultado escondido ate a pessoa
 * assistir (D1), votacao dentro do chaveamento (D2), barra de "pronto" com
 * quem falta (S14).
 */

import { beforeEach, describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import { BracketScreen, serieMaisRecenteJogavel, textoEsperando } from "./BracketScreen";
import { esquecerVistasEmMemoria, marcarVistas } from "./vistas";
import type { RoomStore, StoredGame } from "../net/store";
import {
  TOTAL_WAVES,
  type RoomPlayerWire,
  type SlotId,
  type TournamentSeriesWire,
  type TournamentTeamWire,
  type TournamentWire,
} from "../../server/protocol";

beforeEach(() => esquecerVistasEmMemoria());

/** TournamentWire minimo e valido, com overrides pontuais. */
function fioDeTorneio(overrides: Partial<TournamentWire> = {}): TournamentWire {
  return {
    wave: 1,
    totalWaves: TOTAL_WAVES,
    series: [],
    teams: [],
    ready: [],
    readyFaltam: 0,
    readyTotal: 0,
    espectadoresContam: false,
    watching: {},
    sync: null,
    vote: null,
    championId: null,
    id: `torneio-${Math.random()}`,
    barreira: [],
    pulado: false,
    awards: null,
    ...overrides,
  };
}

function time(over: Partial<TournamentTeamWire> & { id: string }): TournamentTeamWire {
  return { seatIndex: Number(over.id.slice(-1)), displayName: over.id, tag: "TAG", publicId: null, eliminated: false, ...over };
}

function doisTimes(): TournamentTeamWire[] {
  return [
    time({ id: "assento-0", displayName: "Time Fora", tag: "FOR", publicId: "pub-eu", eliminated: true }),
    time({ id: "assento-1", displayName: "Time Vivo", tag: "VVO", publicId: "pub-amigo" }),
  ];
}

/** Uma serie jogada inteira (3 x 1 para o lado B) no slot dado. */
function serieJogada(slotId: SlotId, vencedor = "assento-1"): TournamentSeriesWire {
  return {
    slotId,
    status: "complete",
    teamAId: "assento-0",
    teamBId: "assento-1",
    wins: { "assento-0": 1, "assento-1": 3 },
    winnerId: vencedor,
    gamesPlayed: 4,
  };
}

function comStatus(slotId: SlotId, status: TournamentSeriesWire["status"]): TournamentSeriesWire {
  return {
    slotId,
    status,
    teamAId: status === "pending" ? null : "assento-0",
    teamBId: status === "pending" ? null : "assento-1",
    wins: {},
    winnerId: null,
    gamesPlayed: 0,
  };
}

const JOGADORES: RoomPlayerWire[] = [
  { publicId: "pub-eu", nickname: "rafa", teamName: "Time Fora", isHost: true, connected: true, spectator: false },
  { publicId: "pub-amigo", nickname: "bia", teamName: "Time Vivo", isHost: false, connected: true, spectator: false },
];

function storeFalso(
  torneio: TournamentWire | null,
  opcoes: { publicId?: string | null; isHost?: boolean; games?: { slotId: SlotId; games: StoredGame[] } | null } = {}
): RoomStore {
  return {
    tournament: () => torneio,
    state: () => ({ phase: "tournament", players: JOGADORES }),
    publicId: () => (opcoes.publicId === undefined ? "pub-eu" : opcoes.publicId),
    isHost: () => opcoes.isHost ?? false,
    games: () => opcoes.games ?? null,
    setReady: () => {},
    setWatch: () => {},
    setSyncMode: () => {},
    forceAdvance: () => {},
    vote: () => {},
  } as unknown as RoomStore;
}

function render(over: Partial<TournamentWire> = {}, opcoes: Parameters<typeof storeFalso>[1] = {}): string {
  return renderToString(() => <BracketScreen store={storeFalso(fioDeTorneio(over), opcoes)} />);
}

describe("BracketScreen · rodada e o que ela disputa (D8)", () => {
  it("diz a rodada, o que ela disputa e o que vem a seguir", () => {
    const html = render({ wave: 2 });
    expect(html).toContain("Rodada 2 de 6");
    expect(html).toContain("Semifinais da chave superior e 1ª fase da chave inferior");
    expect(html).toContain("A seguir: Final da chave superior e 2ª fase da chave inferior");
    expect(html).not.toContain("Onda");
  });

  it("na ultima rodada nao promete 'a seguir'", () => {
    const html = render({ wave: 6 });
    expect(html).toContain("Grande Final");
    expect(html).not.toContain("A seguir:");
  });

  it("as etapas da chave inferior sao 'fases', sem colidir com 'Rodada 2 de 6'", () => {
    const html = render();
    expect(html).toContain("Chave superior");
    expect(html).toContain("Chave inferior");
    expect(html).toContain("1ª fase");
    expect(html).toContain("2ª fase");
    expect(html).not.toContain(">Rodada 1<");
  });
});

describe("BracketScreen · sem spoiler (D1)", () => {
  it("serie da rodada atual que eu nao vi: sem placar e sem 'Eliminado'", () => {
    const html = render({ wave: 2, teams: doisTimes(), series: [serieJogada("LB_R1_1")] });
    expect(html).toContain("? × ?");
    expect(html).toContain("jogada · assista para ver");
    expect(html).not.toContain("1 × 3");
    expect(html).not.toContain("Eliminado");
    expect(html).not.toContain("Mostrar resultados desta rodada");
  });

  it("depois de eu ver a serie, o placar e o 'Eliminado' aparecem", () => {
    const fio = fioDeTorneio({ wave: 2, teams: doisTimes(), series: [serieJogada("LB_R1_1")] });
    marcarVistas(fio.id, ["LB_R1_1"]);
    const html = renderToString(() => <BracketScreen store={storeFalso(fio)} />);
    expect(html).toContain("1 × 3");
    expect(html).toContain("Eliminado");
    expect(html).not.toContain("Mostrar resultados desta rodada");
  });

  it("serie de rodada anterior aparece revelada (os confrontos novos ja contam quem passou)", () => {
    const html = render({ wave: 3, teams: doisTimes(), series: [serieJogada("LB_R1_1")] });
    expect(html).toContain("1 × 3");
  });

  it("'Pular para o pódio': nada escondido", () => {
    const html = render({ wave: 6, pulado: true, teams: doisTimes(), series: [serieJogada("GF")] });
    expect(html).toContain("1 × 3");
  });

  it("o card que a serie escondida alimenta diz 'A definir'", () => {
    const qf: TournamentSeriesWire = { ...serieJogada("UB_QF_1"), teamAId: "assento-0", teamBId: "assento-1" };
    const sf: TournamentSeriesWire = {
      slotId: "UB_SF_1",
      status: "ready",
      teamAId: "assento-1",
      teamBId: "assento-1",
      wins: {},
      winnerId: null,
      gamesPlayed: 0,
    };
    const html = render({ wave: 1, teams: doisTimes(), series: [qf, sf] });
    const sfHtml = html.slice(html.indexOf("Semifinais"));
    expect(sfHtml).toContain("A definir");
  });

  it("minha serie desta rodada ainda nao vista: atalho para assisti-la", () => {
    const html = render({ wave: 1, teams: doisTimes(), series: [serieJogada("UB_QF_1")] });
    expect(html).toContain("Assistir à série do seu time");
  });

  it("situacao do meu time respeita a revelacao: antes de ver, nao diz 'eliminado'", () => {
    const html = render({ wave: 2, teams: doisTimes(), series: [serieJogada("LB_R1_1")] });
    expect(html).toContain("FOR Time Fora · na chave superior");
    expect(html).not.toContain("- eliminado");
  });

  it("Grande Final jogada e nao vista: oferece assistir sem antecipar o pódio, sem dizer o campeao", () => {
    const html = render({
      wave: 6,
      championId: "assento-1",
      teams: doisTimes(),
      series: [serieJogada("GF")],
    });
    expect(html).toContain("Assistir à Grande Final");
    expect(html).not.toContain("Ver o pódio agora");
    expect(html).not.toContain("1 × 3");
  });
});

describe("BracketScreen · barra de 'pronto' (S14)", () => {
  it("quem esta na barreira ve 'Pronto para seguir' e quem falta, pelo apelido", () => {
    const html = render({ teams: doisTimes(), barreira: ["pub-eu", "pub-amigo"], ready: ["pub-eu"] });
    expect(html).toContain("Pronto ✓ · clique para desfazer");
    expect(html).toContain("Esperando: bia (VVO).");
  });

  it("quem nao esta na barreira nao ve o botao, e le por que", () => {
    const html = render({ teams: doisTimes(), barreira: ["pub-amigo"] });
    expect(html).not.toContain("Pronto para seguir");
    expect(html).toContain("Seu time está fora");
  });

  it("espectador sem time: le que quem tem time decide", () => {
    const html = render({ teams: doisTimes(), barreira: ["pub-amigo"] }, { publicId: "pub-plateia" });
    expect(html).toContain("Você está assistindo");
  });

  it("eu apareco como 'você' na lista de quem falta", () => {
    const html = render({ teams: doisTimes(), barreira: ["pub-eu", "pub-amigo"] });
    expect(html).toContain("Esperando: você, bia (VVO).");
  });

  it("so o host ve 'Iniciar próxima rodada', em estilo secundario", () => {
    expect(render({}, { isHost: true })).toContain("Iniciar próxima rodada");
    expect(render({}, { isHost: false })).not.toContain("Iniciar próxima rodada");
  });

  it("a final também espera Ready antes de encerrar a sala", () => {
    expect(render({ wave: TOTAL_WAVES, championId: "assento-1", barreira: ["pub-eu"] })).toContain("Ready · terminei de assistir");
  });

  it("o host só pode iniciar a próxima rodada após os resultados coletivos", () => {
    const esperando = render({ resultadosLiberados: false }, { isHost: true });
    const pronto = render({ resultadosLiberados: true }, { isHost: true });
    expect(esperando).toMatch(/<button[^>]*disabled[^>]*>Iniciar próxima rodada<\/button>/);
    expect(pronto).not.toMatch(/<button[^>]*disabled[^>]*>Iniciar próxima rodada<\/button>/);
    expect(pronto).toContain("Resultados liberados");
  });

  it("com a urna aberta a barra some e a votacao aparece no chaveamento", () => {
    const html = render({ teams: doisTimes(), vote: { votes: {}, faltam: 2 } });
    expect(html).toContain("Votação: como a noite segue?");
    expect(html).not.toContain("Pronto para seguir");
  });
});

describe("textoEsperando", () => {
  it("lista quem falta; ninguem faltando vira 'Todos prontos.'", () => {
    expect(textoEsperando(["bia (VVO)", "caio"])).toBe("Esperando: bia (VVO), caio.");
    expect(textoEsperando([])).toBe("Todos prontos.");
  });
});

describe("BracketScreen · assistir juntos (S16)", () => {
  it("o host ve o interruptor com o que ele faz", () => {
    const html = render({}, { isHost: true });
    expect(html).toContain("Assistir juntos (você controla)");
  });

  it("convidado em sincronia le que o host controla, e nenhum card vira botao", () => {
    const html = render(
      {
        teams: doisTimes(),
        series: [serieJogada("UB_QF_1")],
        sync: { slotId: "UB_QF_1", gameIndex: 0, restartCount: 0, stage: "select" },
      },
      { isHost: false }
    );
    expect(html).toContain("Assistindo juntos: o host escolhe a série");
    expect(html).not.toMatch(/<button[^>]*class="room-bracket__series/);
  });

  it("em sincronia, o host escolhe a serie pelo card (a sala vai junto)", () => {
    const html = render(
      {
        teams: doisTimes(),
        series: [serieJogada("UB_QF_1")],
        sync: { slotId: "UB_QF_1", gameIndex: 0, restartCount: 0, stage: "select" },
      },
      { isHost: true }
    );
    expect(html).toMatch(/<button[^>]*class="room-bracket__series/);
  });

  it("contraprova: a MESMA serie vira botao com a sincronia desligada", () => {
    const html = render({ teams: doisTimes(), series: [serieJogada("UB_QF_1")] });
    expect(html).toMatch(/<button[^>]*class="room-bracket__series/);
  });
});

describe("BracketScreen · convite para quem ja sabe que caiu", () => {
  it("eliminado com a queda ja revelada ganha o convite para outro confronto", () => {
    const html = render({ wave: 3, teams: doisTimes(), series: [serieJogada("LB_R1_1")] });
    expect(html).toContain("Seu time saiu");
  });

  it("sem a queda revelada, nada de convite (seria spoiler)", () => {
    const html = render({ wave: 2, teams: doisTimes(), series: [serieJogada("LB_R1_1")] });
    expect(html).not.toContain("Seu time saiu");
  });

  it("serieMaisRecenteJogavel prefere a em andamento, senao a ultima jogada", () => {
    const qf = serieJogada("UB_QF_1");
    const lb = serieJogada("LB_R1_1");
    expect(serieMaisRecenteJogavel([qf, lb])).toBe("LB_R1_1");
    expect(serieMaisRecenteJogavel([{ ...qf, status: "in_progress" }, lb])).toBe("UB_QF_1");
    expect(serieMaisRecenteJogavel([comStatus("UB_QF_1", "pending")])).toBeNull();
  });
});

describe("BracketScreen · identidade do meu time (D-20)", () => {
  it("acha o meu time pelo publicId, nunca pelo nome -- dois times com o MESMO nome", () => {
    const times = [
      time({ id: "assento-0", displayName: "Time Fenix", tag: "FEN", publicId: "pub-outro" }),
      time({ id: "assento-1", displayName: "Time Fenix", tag: "FEN", publicId: "pub-eu" }),
    ];
    const html = render({ teams: times });
    const itens = html.split(/<li[^>]*class="room-bracket__team-item/);
    expect(itens).toHaveLength(3);
    expect(itens[1]).not.toContain("is-mine");
    expect(itens[2]).toContain("is-mine");
  });

  it("com o meu publicId ainda nulo, nenhum time e marcado como meu (m-3)", () => {
    const times = [time({ id: "assento-0" }), time({ id: "assento-1" })];
    const html = render({ teams: times, series: [serieJogada("UB_QF_1")] }, { publicId: null });
    expect(html).not.toContain("is-mine");
  });

  it("time de bot aparece como 'bot'; time humano com o apelido do dono", () => {
    const html = render({ teams: [time({ id: "assento-0", publicId: "pub-amigo" }), time({ id: "assento-1" })] });
    expect(html).toContain("bia");
    expect(html).toContain("bot");
  });
});

describe("BracketScreen · carregando a timeline de uma serie ja escolhida", () => {
  it("mostra 'Carregando a partida' quando o torneio aponta a serie mas a timeline nao chegou", () => {
    const html = render({ series: [serieJogada("UB_QF_1")], watching: { "pub-eu": "UB_QF_1" } });
    expect(html).toContain("Carregando a partida");
  });

  it("nao mostra quando a timeline da serie assistida ja chegou", () => {
    const html = render(
      { series: [serieJogada("UB_QF_1")], watching: { "pub-eu": "UB_QF_1" } },
      { games: { slotId: "UB_QF_1", games: [] } }
    );
    expect(html).not.toContain("Carregando a partida");
  });
});

describe("BracketScreen · acessibilidade e destaque de status", () => {
  it("a secao tem rotulo e so a linha de quem falta e regiao viva (U23)", () => {
    const html = render();
    expect(html).toContain('aria-label="Chaveamento do torneio"');
    expect(html).not.toMatch(/<section[^>]*class="room-bracket"[^>]*aria-live/);
  });

  it("serie 'ready' e 'pending' ganham destaque proprio", () => {
    expect(render({ series: [comStatus("UB_QF_1", "ready")] })).toMatch(/class="[^"]*is-ready/);
    expect(render({ series: [comStatus("LB_R1_1", "pending")] })).toMatch(/class="[^"]*is-pending/);
  });
});
