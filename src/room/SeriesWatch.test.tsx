/**
 * src/room/SeriesWatch.test.tsx
 *
 * Renderizacao SSR da tela de assistir uma serie (mesmo padrao de
 * BracketScreen.test.tsx: renderToString, sem jsdom). O PlaybackScreen so
 * mostra o overlay de resultado depois que o GameTimer completa via rAF —
 * isso nunca acontece em SSR sincrono — entao estes testes prendem o que
 * aparece ANTES disso: o cabecalho de transmissao (BroadcastBar), o
 * enquadramento azul/rival, e a navegacao propria da sala.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderToString } from "solid-js/web";
import type * as SolidTipos from "solid-js";
import {
  SeriesWatch,
  acompanharIndiceSincronizado,
  saidaDaSerie,
  perspectivaDoEspectador,
  placarAteAqui,
  estagioChampSelect,
  decidirContinuar,
  rotuloContinuar,
  rotuloDoResultado,
  serieDecididaAteAqui,
} from "./SeriesWatch";

// GameTimer (dono: outro builder, src/playback/**) chama requestAnimationFrame
// de forma incondicional no corpo do componente, nao dentro de onMount -- ele
// so roda no navegador. Sem este shim local ao teste (nao mexe em
// src/playback/**), renderToString nunca chega a montar o PlaybackScreen.
if (typeof globalThis.requestAnimationFrame !== "function") {
  (globalThis as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }).requestAnimationFrame = (
    cb
  ) => setTimeout(() => cb(Date.now()), 0) as unknown as number;
  (globalThis as unknown as { cancelAnimationFrame: (id: number) => void }).cancelAnimationFrame = (id) =>
    clearTimeout(id);
}
import type { RoomStore, StoredGame } from "../net/store";
import type {
  DraftWire,
  DraftSeatWire,
  RoomPhase,
  SlotId,
  TournamentSeriesWire,
  TournamentTeamWire,
  TournamentWire,
} from "../../server/protocol";
import { makeCard } from "../../server/room/cards.fixture";
import { TOTAL_WAVES } from "../../server/protocol";

function timeWire(over: Partial<TournamentTeamWire> = {}): TournamentTeamWire {
  return {
    id: "assento-0",
    seatIndex: 0,
    displayName: "Time A",
    tag: "TMA",
    publicId: "pub-eu",
    eliminated: false,
    ...over,
  };
}

function serieWire(over: Partial<TournamentSeriesWire> = {}): TournamentSeriesWire {
  return {
    slotId: "UB_QF_1",
    status: "in_progress",
    teamAId: "assento-0",
    teamBId: "assento-1",
    wins: { "assento-0": 2, "assento-1": 1 },
    winnerId: null,
    gamesPlayed: 3,
    ...over,
  };
}

function torneioWire(over: Partial<TournamentWire> = {}): TournamentWire {
  return {
    wave: 1,
    totalWaves: TOTAL_WAVES,
    series: [serieWire()],
    teams: [timeWire(), timeWire({ id: "assento-1", seatIndex: 1, displayName: "Time B", tag: "TMB", publicId: null })],
    ready: [],
    readyFaltam: 0,
    readyTotal: 0,
    espectadoresContam: false,
    watching: { "pub-eu": "UB_QF_1" },
    sync: null,
    vote: null,
    championId: null,
    id: "torneio-teste",
    barreira: [],
    pulado: false,
    awards: null,
    ...over,
  };
}

function jogoGravado(over: Partial<StoredGame> = {}): StoredGame {
  return {
    seed: 1,
    winnerId: "assento-0",
    userFrameTeamId: "assento-0",
    events: [],
    totalPlaybackMs: 0,
    champions: { teamA: {}, teamB: {} },
    ...over,
  };
}

/** Assento do draft com os 5 papeis preenchidos — roster completo (D-14). */
function assentoCompleto(seatIndex: number, prefixo: string): DraftSeatWire {
  const roles = ["top", "jungle", "mid", "adc", "support"] as const;
  const picks: DraftSeatWire["picks"] = {};
  for (const role of roles) {
    picks[role] = makeCard({ id: `${prefixo}-${role}`, personId: `${prefixo}-${role}-p`, primaryRole: role });
  }
  return {
    index: seatIndex,
    teamName: prefixo,
    isBot: false,
    connected: true,
    publicId: seatIndex === 0 ? "pub-eu" : null,
    picks,
  };
}

function draftWire(): DraftWire {
  return {
    round: 5,
    turnIndex: 40,
    totalTurns: 40,
    currentSeat: null,
    turnMsRemaining: null,
    remainingCards: 0,
    finished: true,
    order: [0, 1],
    timedOutSeat: null,
    seats: [assentoCompleto(0, "a"), assentoCompleto(1, "b")],
  };
}

/**
 * Store de mentira: so os acessores que a tela le. O componente nunca
 * desestrutura props, entao basta um objeto com as funcoes certas.
 */
function storeFalso(over: {
  torneio?: TournamentWire | null;
  games?: { slotId: SlotId; games: StoredGame[] } | null;
  draft?: DraftWire | null;
  publicId?: string | null;
  isHost?: boolean;
  fase?: RoomPhase;
}): RoomStore {
  return {
    tournament: () => over.torneio ?? torneioWire(),
    games: () => (over.games === undefined ? { slotId: "UB_QF_1", games: [jogoGravado()] } : over.games),
    draft: () => (over.draft === undefined ? draftWire() : over.draft),
    publicId: () => (over.publicId === undefined ? "pub-eu" : over.publicId),
    isHost: () => over.isHost ?? false,
    state: () => ({ phase: over.fase ?? "tournament" }),
    playbackControl: () => {},
  } as unknown as RoomStore;
}

function render(over: Parameters<typeof storeFalso>[0] = {}): string {
  return renderToString(() => <SeriesWatch store={storeFalso(over)} onVoltar={() => {}} />);
}

describe("SeriesWatch — carregando", () => {
  it("mostra 'Carregando a partida' quando a timeline ainda nao chegou", () => {
    expect(render({ games: null })).toContain("Carregando a partida");
  });

  it("mostra 'Carregando a partida' quando a mensagem `games` e de outra serie", () => {
    const html = render({ games: { slotId: "UB_QF_2" as SlotId, games: [jogoGravado()] } });
    expect(html).toContain("Carregando a partida");
  });

  it("nao mostra 'Carregando a partida' quando a serie e a timeline estao prontas", () => {
    expect(render()).not.toContain("Carregando a partida");
  });
});

describe("SeriesWatch — aviso de torneio encerrado (Fase 1 item 9)", () => {
  it("nao mostra nada quando o torneio ainda nao tem campeao", () => {
    expect(render()).not.toContain("Torneio encerrado");
  });

  it("avisa quem e o campeao mesmo vendo outra serie, com um jeito de ir ao podio", () => {
    const html = render({ torneio: torneioWire({ championId: "assento-1" }) });
    expect(html).toContain("Torneio encerrado");
    expect(html).toContain("TMB Time B");
    expect(html).toContain("é campeão");
    expect(html).toContain("Ver pódio");
  });

  it("nao anuncia o campeao para quem esta assistindo a propria Grande Final", () => {
    const html = render({
      torneio: torneioWire({
        championId: "assento-1",
        series: [serieWire({ slotId: "GF" })],
        watching: { "pub-eu": "GF" },
      }),
      games: { slotId: "GF", games: [jogoGravado()] },
    });
    expect(html).not.toContain("Torneio encerrado");
  });
});

describe("perspectivaDoEspectador (Fase 2 item 2)", () => {
  it("sou o enquadrado -> 'user'", () => {
    expect(perspectivaDoEspectador("assento-0", "assento-0", "assento-1")).toBe("user");
  });

  it("sou o rival -> 'rival'", () => {
    expect(perspectivaDoEspectador("assento-1", "assento-0", "assento-1")).toBe("rival");
  });

  it("nao tenho time nesta serie -> null (espectador puro)", () => {
    expect(perspectivaDoEspectador("assento-2", "assento-0", "assento-1")).toBeNull();
  });

  it("sem publicId (nao conectado) -> null", () => {
    expect(perspectivaDoEspectador(null, "assento-0", "assento-1")).toBeNull();
  });
});

describe("placarAteAqui (achado do teste de sala, 2026-08-27)", () => {
  // Serie de 3 jogos: enquadrado (assento-0) perde o Jogo 1, depois vira e
  // fecha a serie 2-1. Antes do fix, SeriesWatch usava o placar FINAL
  // (`s.wins`, sempre 2-1 aqui) pra qualquer jogo exibido -- inclusive o
  // Jogo 1, fazendo o Jogo 1 (que o enquadrado perdeu) parecer "a série
  // encerrada, seu time venceu".
  const tresJogos = [
    jogoGravado({ winnerId: "assento-1" }), // Jogo 1: rival vence
    jogoGravado({ winnerId: "assento-0" }), // Jogo 2: enquadrado vence
    jogoGravado({ winnerId: "assento-0" }), // Jogo 3: enquadrado vence e fecha
  ];

  it("no Jogo 1, o placar e so o do Jogo 1 -- nao o placar final da serie", () => {
    expect(placarAteAqui(tresJogos, 0, "assento-0", "assento-1")).toEqual({
      userWins: 0,
      rivalWins: 1,
    });
  });

  it("no Jogo 2, soma so os dois primeiros jogos", () => {
    expect(placarAteAqui(tresJogos, 1, "assento-0", "assento-1")).toEqual({
      userWins: 1,
      rivalWins: 1,
    });
  });

  it("no Jogo 3 (o ultimo), o placar bate com o final real da serie", () => {
    expect(placarAteAqui(tresJogos, 2, "assento-0", "assento-1")).toEqual({
      userWins: 2,
      rivalWins: 1,
    });
  });
});

describe("estagioChampSelect (Fase 3)", () => {
  it("fora de sincronia (syncStage null): quem decide e a etapa local", () => {
    expect(estagioChampSelect(null, "select")).toBe("select");
    expect(estagioChampSelect(null, "playback")).toBe("playback");
  });

  it("em sincronia ainda em 'select': a revelacao local pode adiantar (fim natural do timer)", () => {
    expect(estagioChampSelect("select", "select")).toBe("select");
    expect(estagioChampSelect("select", "playback")).toBe("playback");
  });

  it("em sincronia com 'playback' (host pulou): vence sempre, mesmo se a etapa local ainda nao chegou la", () => {
    expect(estagioChampSelect("playback", "select")).toBe("playback");
    expect(estagioChampSelect("playback", "playback")).toBe("playback");
  });
});

describe("SeriesWatch — champion select antes de cada jogo (Fase 3)", () => {
  const tresJogos = { slotId: "UB_QF_1" as SlotId, games: [jogoGravado(), jogoGravado(), jogoGravado()] };
  const emSelect = (over: Partial<TournamentWire> = {}) =>
    torneioWire({ sync: { slotId: "UB_QF_1", gameIndex: 0, restartCount: 0, stage: "select" }, ...over });

  it("por padrao (sem interacao nenhuma) a tela mostra a selecao de campeoes, nao o placar", () => {
    const html = render();
    expect(html).toContain("champ-select");
    expect(html).toContain("SELEÇÃO DE CAMPEÕES");
    expect(html).not.toContain("bcast-team--user");
  });

  it("fora de sincronia, o botao 'Pular' interno do ChampionSelect aparece (controle e local)", () => {
    const html = render();
    expect(html).toContain("Pular →");
    expect(html).not.toContain("Pular introdução");
  });

  it("em sincronia (nesta serie), o botao interno 'Pular' some -- so o host pode adiantar, via servidor", () => {
    const html = render({ games: tresJogos, isHost: true, torneio: emSelect() });
    expect(html).not.toContain("Pular →");
    expect(html).toContain("Pular introdução");
  });

  it("em sincronia, convidado nao ve NENHUM botao de pular -- so espera o broadcast do host", () => {
    const html = render({ games: tresJogos, isHost: false, torneio: emSelect() });
    expect(html).not.toContain("Pular →");
    expect(html).not.toContain("Pular introdução");
  });

  it("sincronia apontando pra OUTRA serie: aqui e como se nao houvesse sincronia -- botao local, sem 'Pular introdução'", () => {
    const html = render({
      games: tresJogos,
      isHost: true,
      torneio: torneioWire({ sync: { slotId: "UB_QF_2", gameIndex: 0, restartCount: 0, stage: "select" } }),
    });
    expect(html).toContain("Pular →");
    expect(html).not.toContain("Pular introdução");
  });

  it("etapa 'playback' no sync: mostra o placar, nao a selecao (contraprova)", () => {
    const html = render({
      torneio: torneioWire({ sync: { slotId: "UB_QF_1", gameIndex: 0, restartCount: 0, stage: "playback" } }),
    });
    expect(html).not.toContain("champ-select");
    expect(html).toContain("bcast-team--user");
  });
});

describe("decidirContinuar (Fase 4)", () => {
  it("serie decidida: mostra o resultado, mesmo quando podeNavegar tambem seria true", () => {
    expect(decidirContinuar(true, true)).toBe("mostrarResultado");
  });

  it("serie decidida: mostra o resultado mesmo sem podeNavegar -- nao precisa de lockstep pra isso", () => {
    expect(decidirContinuar(true, false)).toBe("mostrarResultado");
  });

  it("serie em andamento + pode navegar: avanca pro proximo jogo", () => {
    expect(decidirContinuar(false, true)).toBe("avancar");
  });

  it("serie em andamento + convidado sincronizado (nao pode navegar): bloqueado, ninguem avanca sozinho", () => {
    expect(decidirContinuar(false, false)).toBe("bloqueado");
  });
});

describe("rotuloContinuar (achado da revisao final: 'Proximo jogo' morto para convidado sincronizado)", () => {
  // Em sincronia o convidado nao avanca sozinho (decidirContinuar -> "bloqueado"),
  // mas o card do fim do jogo mostrava "Proximo jogo" e o clique nao fazia nada.
  it("serie decidida: 'Ver resultado da série', para qualquer um", () => {
    expect(rotuloContinuar(true, true)).toBe("Ver resultado da série");
    expect(rotuloContinuar(true, false)).toBe("Ver resultado da série");
  });

  it("serie em andamento + pode navegar: 'Próximo jogo'", () => {
    expect(rotuloContinuar(false, true)).toBe("Próximo jogo");
  });

  it("serie em andamento + convidado sincronizado: 'Aguardando o host…', nao um botao que nao faz nada", () => {
    expect(rotuloContinuar(false, false)).toBe("Aguardando o host…");
  });

  it("o rotulo 'Aguardando' vale exatamente quando decidirContinuar bloqueia", () => {
    for (const decidida of [true, false]) {
      for (const pode of [true, false]) {
        expect(rotuloContinuar(decidida, pode) === "Aguardando o host…").toBe(
          decidirContinuar(decidida, pode) === "bloqueado"
        );
      }
    }
  });
});

describe("rotuloDoResultado (achado da revisao final: depois da urna 'parar' nao ha campeao)", () => {
  // O botao do resultado da serie dizia "Voltar ao chaveamento" quando nao havia
  // campeao -- inclusive depois de a urna decidir "parar" (fase `finished` sem
  // campeao), onde o clique leva ao podio. A fase e a testemunha das duas
  // terminacoes (campeao ou "parar"). So aparece depois do clique de
  // "continuar", que renderToString nao dispara: por isso funcao pura.
  it("fase 'finished' (campeao OU urna 'parar'): 'Ver pódio'", () => {
    expect(rotuloDoResultado("finished")).toBe("Ver pódio");
  });

  it("torneio em andamento: 'Voltar ao chaveamento'", () => {
    expect(rotuloDoResultado("tournament")).toBe("Voltar ao chaveamento");
  });

  it("sem estado da sala ainda: cai no rotulo seguro, 'Voltar ao chaveamento'", () => {
    expect(rotuloDoResultado(null)).toBe("Voltar ao chaveamento");
    expect(rotuloDoResultado(undefined)).toBe("Voltar ao chaveamento");
  });
});

describe("serieDecididaAteAqui (Rundown da Sala 2, achado 2)", () => {
  it("serie de 3 jogos: so o terceiro decide", () => {
    expect(serieDecididaAteAqui(0, 3)).toBe(false);
    expect(serieDecididaAteAqui(1, 3)).toBe(false);
    expect(serieDecididaAteAqui(2, 3)).toBe(true);
  });

  it("serie de 5 jogos: o quarto ainda nao decide", () => {
    expect(serieDecididaAteAqui(3, 5)).toBe(false);
    expect(serieDecididaAteAqui(4, 5)).toBe(true);
  });

  it("sem timeline, nada esta decidido", () => {
    expect(serieDecididaAteAqui(0, 0)).toBe(false);
  });

  it("combinado com decidirContinuar: jogo do meio avanca; convidado sincronizado fica bloqueado", () => {
    expect(decidirContinuar(serieDecididaAteAqui(0, 3), true)).toBe("avancar");
    expect(decidirContinuar(serieDecididaAteAqui(1, 3), false)).toBe("bloqueado");
    expect(decidirContinuar(serieDecididaAteAqui(2, 3), false)).toBe("mostrarResultado");
  });
});

describe("SeriesWatch — fim de serie (Fase 4)", () => {
  const serieDecidida = torneioWire({
    series: [serieWire({ status: "complete", winnerId: "assento-0", wins: { "assento-0": 3, "assento-1": 1 } })],
    sync: { slotId: "UB_QF_1", gameIndex: 0, restartCount: 0, stage: "playback" },
  });

  it("serie decidida, sem clique nenhum: a tela de resultado nao aparece sozinha (transicao e local, so no clique)", () => {
    // Mesma limitacao ja documentada no topo do arquivo: `mostrarResultado`
    // so muda com um clique real, que renderToString nunca dispara. Este
    // teste prende exatamente essa expectativa -- serie completa nao basta.
    const html = render({ torneio: serieDecidida });
    expect(html).not.toContain("series-result");
    expect(html).not.toContain("Resultado da série");
  });

  it("serie decidida, sem clique: o placar do ultimo jogo continua aparecendo normalmente", () => {
    const html = render({ torneio: serieDecidida });
    expect(html).toContain("bcast-team--user");
  });
});

describe("SeriesWatch — enquadramento (StoredGame -> MatchResult)", () => {
  // O teste mais forte para a peca central do brief: qual time aparece do
  // lado "user" (azul) depende de userFrameTeamId, NUNCA de teamAId sozinho.
  // Times com tags distintas (TMA / TMB) deixam a checagem inequivoca.
  //
  // Fase 3: o BroadcastBar mora dentro do PlaybackScreen, que so aparece
  // depois da selecao de campeoes (`estagio() === "playback"`) -- e, fora de
  // sincronia, essa transicao e um estado local que so muda com um clique
  // real (nunca em SSR sincrono, mesma limitacao ja documentada no topo deste
  // arquivo para o overlay de resultado). `sync.stage: "playback"` e o unico
  // jeito de um render() estatico pular direto pra la.
  const emPlayback = torneioWire({ sync: { slotId: "UB_QF_1", gameIndex: 0, restartCount: 0, stage: "playback" } });

  it("o time enquadrado (userFrameTeamId) aparece do lado 'user' da transmissao", () => {
    const html = render({
      torneio: emPlayback,
      games: { slotId: "UB_QF_1", games: [jogoGravado({ userFrameTeamId: "assento-0" })] },
    });
    const tagDoUser = html.match(/bcast-team--user"[\s\S]*?class="bcast-tag">([^<]*)<\/span>/);
    expect(tagDoUser).not.toBeNull();
    expect(tagDoUser![1]).toBe("TMA");
  });

  it("quando o time B e o enquadrado, ele aparece do lado 'user', nao o A", () => {
    const html = render({
      torneio: emPlayback,
      games: { slotId: "UB_QF_1", games: [jogoGravado({ userFrameTeamId: "assento-1", winnerId: "assento-1" })] },
    });
    const tagDoUser = html.match(/bcast-team--user"[\s\S]*?class="bcast-tag">([^<]*)<\/span>/);
    expect(tagDoUser).not.toBeNull();
    expect(tagDoUser![1]).toBe("TMB");
  });
});

describe("SeriesWatch — navegacao dentro da serie", () => {
  const tresJogos = { slotId: "UB_QF_1" as SlotId, games: [jogoGravado(), jogoGravado(), jogoGravado()] };

  it("mostra 'Jogo 1 · melhor de 5' no primeiro jogo, sem revelar quantos jogos a serie teve", () => {
    const html = render({ games: tresJogos });
    expect(html).toContain("Jogo 1 · melhor de 5");
    expect(html).not.toContain("de 3");
  });

  it("fora de sincronia, qualquer espectador ve os dois botoes de navegacao", () => {
    const html = render({ games: tresJogos, isHost: false });
    const botoes = html.match(/class="[^"]*room-watch__nav-btn[^"]*"/g) ?? [];
    expect(botoes).toHaveLength(2);
  });

  it("em sincronia, quem nao e host nao ve os botoes de navegacao", () => {
    const html = render({
      games: tresJogos,
      isHost: false,
      torneio: torneioWire({ sync: { slotId: "UB_QF_1", gameIndex: 1, restartCount: 0, stage: "select" } }),
    });
    const botoes = html.match(/class="[^"]*room-watch__nav-btn[^"]*"/g) ?? [];
    expect(botoes).toHaveLength(0);
  });

  it("em sincronia, o host continua vendo os dois botoes de navegacao", () => {
    // stage "playback" (nao "select"): em "select" o host ganha um TERCEIRO
    // botao, "Pular introducao" (Fase 3) -- este teste e sobre os dois de
    // navegacao especificamente, entao fixa a etapa pra nao confundir os dois.
    const html = render({
      games: tresJogos,
      isHost: true,
      torneio: torneioWire({ sync: { slotId: "UB_QF_1", gameIndex: 1, restartCount: 0, stage: "playback" } }),
    });
    const botoes = html.match(/class="[^"]*room-watch__nav-btn[^"]*"/g) ?? [];
    expect(botoes).toHaveLength(2);
  });

  it("em sincronia, o jogo mostrado e o sync.gameIndex, nao o indice local", () => {
    // sync.gameIndex = 2 (terceiro jogo) — o indicador tem que refletir isso
    // mesmo a navegacao local nunca tendo avancado (indice local nasce em 0).
    const html = render({
      games: tresJogos,
      torneio: torneioWire({ sync: { slotId: "UB_QF_1", gameIndex: 2, restartCount: 0, stage: "select" } }),
    });
    expect(html).toContain("Jogo 3 · melhor de 5");
    expect(html).not.toContain("Jogo 1 · melhor de 5");
  });

  it("fora de sincronia, oferece voltar ao chaveamento durante a serie, sem contar como botao de navegacao", () => {
    const html = render({ games: tresJogos });
    expect(html).toContain("← Chaveamento");
    const navegacao = html.match(/class="[^"]*room-watch__nav-btn[^"]*"/g) ?? [];
    expect(navegacao).toHaveLength(2);
  });

  describe("'← Chaveamento' em sincronia (achado da revisao final)", () => {
    // O clique so marcava "voltei" localmente; em sincronia os cards do
    // chaveamento nao sao clicaveis e o servidor recusa setWatch de quem nao e
    // host -- o convidado ficava preso no chaveamento ate o host soltar a
    // sincronia. Contrato D-28: em sincronia o convidado acompanha o host.
    const sincronizado = torneioWire({
      sync: { slotId: "UB_QF_1", gameIndex: 1, restartCount: 0, stage: "playback" },
    });

    it("o convidado sincronizado NAO ve o botao -- nao ha como sair sozinho", () => {
      const html = render({ games: tresJogos, isHost: false, torneio: sincronizado });
      expect(html).not.toContain("← Chaveamento");
    });

    it("o host sincronizado continua vendo o botao (ao sair, solta a sala)", () => {
      const html = render({ games: tresJogos, isHost: true, torneio: sincronizado });
      expect(html).toContain("← Chaveamento");
    });

    it("convidado com a sincronia apontando para OUTRA serie navega por conta propria e ve o botao", () => {
      const html = render({
        games: tresJogos,
        isHost: false,
        torneio: torneioWire({ sync: { slotId: "UB_QF_2", gameIndex: 1, restartCount: 0, stage: "playback" } }),
      });
      expect(html).toContain("← Chaveamento");
    });
  });
});

describe("acompanharIndiceSincronizado (achado da revisao final: host sai no meio da serie)", () => {
  // Em sincronia o indice vem do servidor e o local ficava parado em 0. Quando
  // o host sai, o servidor zera `sync` e `indiceAtual()` caia do jogo
  // sincronizado para o Jogo 1: todo convidado voltava a selecao de campeoes
  // do inicio. createEffect nunca executa no Solid em modo SSR da suite, entao
  // o teste usa o nucleo reativo do CLIENTE (mesmo padrao de quandoMudar.test.ts).
  let solid: typeof SolidTipos;

  beforeAll(async () => {
    const caminho = "solid-js/dist/solid.js";
    solid = (await import(/* @vite-ignore */ caminho)) as typeof SolidTipos;
  });

  /** Reproduz o par sinal local + indiceAtual() da tela. */
  function montar(inicial: number | null, localInicial = 0) {
    const [sync, setSync] = solid.createSignal<number | null>(inicial);
    const [local, setLocal] = solid.createSignal(localInicial);
    const dispose = solid.createRoot((d) => {
      acompanharIndiceSincronizado(sync, setLocal, solid);
      return d;
    });
    const indiceAtual = () => sync() ?? local();
    return { setSync, indiceAtual, local, dispose };
  }

  it("quando o host solta a sincronia, a tela continua no mesmo jogo -- nao volta ao Jogo 1", () => {
    const t = montar(2);
    expect(t.indiceAtual()).toBe(2);
    t.setSync(null);
    expect(t.indiceAtual()).toBe(2);
    t.dispose();
  });

  it("acompanha cada avanco do host enquanto a sincronia dura", () => {
    const t = montar(0);
    t.setSync(1);
    t.setSync(3);
    t.setSync(null);
    expect(t.indiceAtual()).toBe(3);
    t.dispose();
  });

  it("ja vale na criacao (sem defer): quem monta a tela com a sincronia ligada tambem precisa do indice", () => {
    const t = montar(4);
    expect(t.local()).toBe(4);
    t.dispose();
  });

  it("fora de sincronia nao escreve nada: a navegacao local segue por conta propria", () => {
    const t = montar(null, 3); // o espectador ja andou ate o Jogo 4 sozinho
    expect(t.local()).toBe(3);
    t.setSync(null);
    expect(t.local()).toBe(3);
    t.dispose();
  });
});

describe("SeriesWatch — sempre existe saida (G-1 da revisao final)", () => {
  const tresJogos = { slotId: "UB_QF_1" as SlotId, games: [jogoGravado(), jogoGravado(), jogoGravado()] };

  // O pior estado de interface possivel e uma tela sem volta. Sem
  // `dadosPlayback()` o PlaybackScreen nao e montado, e era ele quem carregava
  // o unico caminho de saida (`onPlayAgain`): a tela ficava em "Carregando a
  // partida..." para sempre, sem botao nenhum.
  it("sem a timeline carregada, ainda ha botao de voltar ao chaveamento", () => {
    const html = render({ games: null });
    expect(html).toContain("Carregando a partida");
    expect(html).toContain("Voltar ao chaveamento");
  });

  it("em sincronia num jogo que ESTA serie nao tem, a tela diz o que houve e oferece a volta", () => {
    // O caso exato da sonda do revisor: sync.gameIndex = 3 e a serie desta
    // tela so tem 1 jogo. Antes: "Carregando a partida..." eterno, sem saida
    // e sem nenhuma pista do motivo.
    const html = render({
      games: { slotId: "UB_QF_1", games: [jogoGravado()] },
      torneio: torneioWire({ sync: { slotId: "UB_QF_1", gameIndex: 3, restartCount: 0, stage: "select" } }),
    });
    expect(html).toContain("Voltar ao chaveamento");
    expect(html).toContain("A sala está sincronizada num jogo que esta série não tem.");
    expect(html).not.toContain("Carregando a partida");
  });

  it("a sincronia so governa a serie que ela aponta -- o indice de outra serie nao me trava", () => {
    // `sync` e global, mas `watching` nao: uma onda nova aponta cada humano
    // para a serie do proprio time (autoWatch) sem mexer no `sync`. Quando a
    // minha serie nao e a sincronizada, o gameIndex do host indexaria a MINHA
    // serie -- mostrando o jogo errado, ou nenhum. Fora da serie sincronizada
    // a navegacao volta a ser local.
    const html = render({
      games: tresJogos,
      isHost: false,
      torneio: torneioWire({ sync: { slotId: "UB_QF_2", gameIndex: 2, restartCount: 0, stage: "select" } }),
    });
    expect(html).toContain("Jogo 1 · melhor de 5");
    const botoes = html.match(/class="[^"]*room-watch__nav-btn[^"]*"/g) ?? [];
    expect(botoes).toHaveLength(2);
  });
});

describe("SeriesWatch — sair solta a sala da sincronia (achado pos-revisao)", () => {
  // Em modo sincronizado, sincronia e decisao do host (D-28). Se o host sai
  // da tela de assistir sem avisar o servidor, as outras sete pessoas ficam
  // presas olhando uma serie que ninguem mais controla -- elas nao tem como
  // sair sozinhas. `voltarAoChaveamento` ja zera `sync` no servidor desde a
  // Tarefa 8; so faltava o cliente mandar a mensagem na hora certa.
  function storeDeMentira(isHost: boolean) {
    const chamadas: string[] = [];
    const store = {
      isHost: () => isHost,
      playbackControl: vi.fn((acao: string) => {
        chamadas.push(`playbackControl:${acao}`);
      }),
    };
    return { store, chamadas };
  }

  it("host + sincronizado: manda voltarAoChaveamento ANTES de onVoltar", () => {
    const { store, chamadas } = storeDeMentira(true);
    const onVoltar = vi.fn(() => chamadas.push("onVoltar"));

    saidaDaSerie(store, true, onVoltar);

    expect(store.playbackControl).toHaveBeenCalledWith("voltarAoChaveamento");
    expect(onVoltar).toHaveBeenCalledOnce();
    expect(chamadas).toEqual(["playbackControl:voltarAoChaveamento", "onVoltar"]);
  });

  it("host + fora de sincronia: saida puramente local, sem mensagem nenhuma", () => {
    const { store } = storeDeMentira(true);
    const onVoltar = vi.fn();

    saidaDaSerie(store, false, onVoltar);

    expect(store.playbackControl).not.toHaveBeenCalled();
    expect(onVoltar).toHaveBeenCalledOnce();
  });

  it("nao-host + sincronizado: saida puramente local -- so o host pode soltar a sala", () => {
    const { store } = storeDeMentira(false);
    const onVoltar = vi.fn();

    saidaDaSerie(store, true, onVoltar);

    expect(store.playbackControl).not.toHaveBeenCalled();
    expect(onVoltar).toHaveBeenCalledOnce();
  });

  it("nao-host + fora de sincronia: saida puramente local", () => {
    const { store } = storeDeMentira(false);
    const onVoltar = vi.fn();

    saidaDaSerie(store, false, onVoltar);

    expect(store.playbackControl).not.toHaveBeenCalled();
    expect(onVoltar).toHaveBeenCalledOnce();
  });
});

describe("SeriesWatch — o elenco mostrado e o do assento certo (achado da revisao)", () => {
  // Achado da revisao: trocar o seatIndex mantinha a suite inteira verde --
  // a tela podia mostrar o elenco de um time enquanto reproduzia a partida
  // de outro, e nada reclamava. teamId e seatIndex sao propositalmente
  // DESALINHADOS aqui (o time "assento-0" tem seatIndex 1, nao 0): se o
  // codigo usar o numero do teamId em vez do seatIndex de verdade -- ou
  // simplesmente ignorar o seatIndex -- o roster errado aparece e este
  // teste pega, em vez de passar por coincidencia de indices iguais (que e
  // o que toda a fixture das outras describes acima faz, sem querer).
  function torneioComSeatIndexTrocado(): TournamentWire {
    return torneioWire({
      teams: [
        timeWire({ id: "assento-0", seatIndex: 1, displayName: "Time A", tag: "TMA" }),
        timeWire({ id: "assento-1", seatIndex: 0, displayName: "Time B", tag: "TMB", publicId: null }),
      ],
      // Fase 3: os paineis de elenco moram no PlaybackScreen, que so aparece
      // depois da selecao de campeoes -- ver comentario equivalente na
      // describe de enquadramento acima.
      sync: { slotId: "UB_QF_1", gameIndex: 0, restartCount: 0, stage: "playback" },
    });
  }

  /** Assento 0 e assento 1 do draft com rosters distinguiveis por prefixo --
   * nada a ver com qual TIME cada um acaba levando (isso quem decide e o
   * `teams` acima, via seatIndex). */
  function draftComRostersDistinguiveis(): DraftWire {
    return {
      round: 5,
      turnIndex: 40,
      totalTurns: 40,
      currentSeat: null,
      turnMsRemaining: null,
      remainingCards: 0,
      finished: true,
      order: [0, 1],
      timedOutSeat: null,
      seats: [assentoCompleto(0, "zero"), assentoCompleto(1, "um")],
    };
  }

  it("cada lado da transmissao mostra o elenco do SEU assento, nunca o do outro", () => {
    const html = render({
      torneio: torneioComSeatIndexTrocado(),
      draft: draftComRostersDistinguiveis(),
      games: { slotId: "UB_QF_1", games: [jogoGravado({ userFrameTeamId: "assento-0" })] },
    });

    // Checagem "html contem X" sozinha nao pega essa troca: nomes de AMBOS
    // os assentos aparecem em algum lugar da pagina de qualquer jeito (um no
    // painel certo, o outro se o bug trocar os dois) -- so um bug que
    // AGRUPE os dois no mesmo painel deixaria algum nome sumir de vez, e um
    // bug de troca simples nao faz isso. Por isso a checagem tem que ser
    // por PAINEL: tudo antes do marcador de classe do painel rival e o
    // painel do usuario (mais o BroadcastBar antes dele, que so mostra tag
    // e nome do time, nunca jogador) -- ver TeamPanel.tsx (`tpanel-pname`)
    // e a ordem fixa em PlaybackScreen.tsx (user, depois rival).
    const [painelUsuario, painelRival] = html.split("tpanel tpanel--rival");
    expect(painelRival, "marcador do painel rival nao encontrado no HTML").toBeDefined();

    // assento-0 e o enquadrado (userFrameTeamId) e tem seatIndex 1 -- o
    // roster certo do lado "user" e o do ASSENTO 1 (prefixo "um").
    expect(painelUsuario).toContain("um-top");
    expect(painelUsuario).not.toContain("zero-top");

    // assento-1 e o rival e tem seatIndex 0 -- o roster certo do lado
    // "rival" e o do ASSENTO 0 (prefixo "zero").
    expect(painelRival).toContain("zero-top");
    expect(painelRival).not.toContain("um-top");
  });
});

describe("SeriesWatch — 'Próximo jogo' nao conta que o jogo decide a serie (revisao final, achado 5)", () => {
  const umJogo = { slotId: "UB_QF_1" as SlotId, games: [jogoGravado()] };
  const botaoProximo = (html: string) =>
    (html.match(/<button[^>]*room-watch__nav-btn[^>]*>Próximo jogo<\/button>/g) ?? [])[0] ?? "";

  it("serie da rodada atual ainda nao vista: o botão aguarda o fim da partida, inclusive no jogo decisivo", async () => {
    const { esquecerVistasEmMemoria } = await import("./vistas");
    esquecerVistasEmMemoria();
    const html = render({ games: umJogo, torneio: torneioWire({ wave: 1 }) });
    expect(botaoProximo(html)).toContain("disabled");
  });

  it("depois de vista, no ultimo jogo o botao fica cinza (nao ha proximo)", async () => {
    const { esquecerVistasEmMemoria, marcarVistas } = await import("./vistas");
    esquecerVistasEmMemoria();
    const t = torneioWire({ wave: 1 });
    marcarVistas(t.id, ["UB_QF_1"]);
    const html = render({ games: umJogo, torneio: t });
    expect(botaoProximo(html)).toContain("disabled");
  });
});
