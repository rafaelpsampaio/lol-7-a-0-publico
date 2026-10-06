/**
 * src/room/RoomEntry.test.tsx
 *
 * `escolherTelaDoTorneio` e a decisao pura de qual tela mostrar dentro da
 * fase de torneio (chaveamento, assistir, votacao, podio) -- extraida de
 * `RoomScreen` pra poder ser testada sem montar SolidJS nenhum, mesmo
 * raciocinio de `saidaDaSerie` em SeriesWatch.tsx. O que importa aqui e a
 * ORDEM de prioridade: uma escolha errada faz a urna ficar presa atras de
 * uma serie, ou faz D-32 (serie ja jogada continuar clicavel no podio)
 * quebrar silenciosamente.
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import { escolherTelaDoTorneio, lerInfoDaSala, RoomScreen, salaVaiParaPrimeiroPlano, telaDaFase } from "./RoomEntry";
import type { RoomStore } from "../net/store";
import type { RoomWire, TournamentWire } from "../../server/protocol";
import { TOTAL_WAVES } from "../../server/protocol";

describe("escolherTelaDoTorneio — prioridade entre as telas", () => {
  const base = { gamesCarregado: false, voltouAoChaveamento: false, fase: "tournament" as const, finalRevelada: true };

  it("serie carregada e nao deixada: assistir, em qualquer fase", () => {
    expect(escolherTelaDoTorneio({ ...base, gamesCarregado: true })).toBe("watch");
    expect(escolherTelaDoTorneio({ ...base, gamesCarregado: true, fase: "finished" })).toBe("watch");
  });

  it("a votacao nao toma mais a tela (S6): ela vive dentro do chaveamento", () => {
    expect(escolherTelaDoTorneio(base)).toBe("bracket");
  });

  it("fase finished com a final revelada: podio", () => {
    expect(escolherTelaDoTorneio({ ...base, fase: "finished" })).toBe("podium");
    expect(escolherTelaDoTorneio({ ...base, fase: "finished", gamesCarregado: true, voltouAoChaveamento: true })).toBe(
      "podium"
    );
  });

  it("fase finished com a final ainda nao vista: chaveamento, que oferece assistir (S4)", () => {
    expect(escolherTelaDoTorneio({ ...base, fase: "finished", finalRevelada: false })).toBe("bracket");
  });

  it("tendo voltado ao chaveamento, a fase tournament mostra o chaveamento mesmo com games carregado", () => {
    expect(escolherTelaDoTorneio({ ...base, gamesCarregado: true, voltouAoChaveamento: true })).toBe("bracket");
  });
});

describe("RoomScreen — cada escolha renderiza o componente certo (integracao leve)", () => {
  function fioDeTorneio(over: Partial<TournamentWire> = {}): TournamentWire {
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
      id: "torneio-teste",
      barreira: [],
      pulado: false,
      awards: null,
      ...over,
    };
  }

  function storeFalso(over: { state?: Partial<RoomWire>; torneio?: TournamentWire; games?: unknown }): RoomStore {
    const torneio = over.torneio ?? fioDeTorneio();
    return {
      state: () => ({
        phase: "tournament",
        players: [],
        settings: { turnSeconds: 60 },
        baseStatus: { ready: true, needed: 8, spareByRole: { top: 8, jungle: 8, mid: 8, adc: 8, support: 8 } },
        draft: null,
        tournament: torneio,
        ...over.state,
      }),
      tournament: () => torneio,
      games: () => over.games ?? null,
      publicId: () => "pub-eu",
      isHost: () => false,
      pedidosDeSerie: () => 0,
      setWatch: () => {},
      vote: () => {},
    } as unknown as RoomStore;
  }

  it("urna aberta: a votacao aparece DENTRO do chaveamento", () => {
    const html = renderToString(() => (
      <RoomScreen store={storeFalso({ torneio: fioDeTorneio({ vote: { votes: {}, faltam: 1 } }) })} />
    ));
    expect(html).toContain("Votação");
    expect(html).toContain("room-bracket");
  });

  it("sem votacao e sem serie carregada, fase tournament renderiza a BracketScreen", () => {
    const html = renderToString(() => <RoomScreen store={storeFalso({})} />);
    expect(html).toContain("room-bracket");
  });

  it("fase finished, sem votacao e sem serie carregada, renderiza o PodiumScreen", () => {
    const html = renderToString(() => (
      <RoomScreen store={storeFalso({ state: { phase: "finished" } })} />
    ));
    expect(html).toContain("Fim de noite");
  });
});

describe("salaVaiParaPrimeiroPlano (E-04, menu do dono)", () => {
  it("o dono com a sala no lobby fica no menu dele", () => {
    expect(salaVaiParaPrimeiroPlano({ dono: true, fase: "lobby", saiuNestaAba: false })).toBe(false);
  });

  it("o dono com a sala no draft ou no torneio vai para a sala", () => {
    expect(salaVaiParaPrimeiroPlano({ dono: true, fase: "draft", saiuNestaAba: false })).toBe(true);
    expect(salaVaiParaPrimeiroPlano({ dono: true, fase: "tournament", saiuNestaAba: false })).toBe(true);
  });

  it("quem nao e dono vai para a sala", () => {
    expect(salaVaiParaPrimeiroPlano({ dono: false, fase: "lobby", saiuNestaAba: false })).toBe(true);
  });

  it("quem saiu da sala nesta aba nao volta sozinho", () => {
    expect(salaVaiParaPrimeiroPlano({ dono: false, fase: "lobby", saiuNestaAba: true })).toBe(false);
    expect(salaVaiParaPrimeiroPlano({ dono: true, fase: "draft", saiuNestaAba: true })).toBe(false);
  });
});

describe("lerInfoDaSala — o que o /api/room-info vira no cliente", () => {
  it("nao e sala quando room nao e exatamente true, ou quando a resposta e lixo", () => {
    expect(lerInfoDaSala(null)).toBeNull();
    expect(lerInfoDaSala(undefined)).toBeNull();
    expect(lerInfoDaSala("room")).toBeNull();
    expect(lerInfoDaSala(42)).toBeNull();
    expect(lerInfoDaSala({})).toBeNull();
    expect(lerInfoDaSala({ room: "true" })).toBeNull();
    expect(lerInfoDaSala({ room: false, convites: ["http://192.168.0.10:7070/"] })).toBeNull();
  });

  it("le os convites e descarta o que nao e link de amigo", () => {
    expect(
      lerInfoDaSala({
        room: true,
        convites: ["https://algo.trycloudflare.com", 7, null, "http://192.168.0.10:7070/"],
      })
    ).toEqual({
      convites: ["https://algo.trycloudflare.com", "http://192.168.0.10:7070/"],
      aguardandoTunel: false,
      fase: "lobby",
      conectados: 0,
      hostAuto: false,
    });
  });

  it("le quantos estao conectados, e 0 quando o servidor nao manda", () => {
    expect(lerInfoDaSala({ room: true, conectados: 3 })?.conectados).toBe(3);
    expect(lerInfoDaSala({ room: true })?.conectados).toBe(0);
  });

  it("anuncia host automático só quando habilitado pelo servidor", () => {
    expect(lerInfoDaSala({ room: true, hostAuto: true })?.hostAuto).toBe(true);
    expect(lerInfoDaSala({ room: true, hostAuto: "true" })?.hostAuto).toBe(false);
    expect(lerInfoDaSala({ room: true })?.hostAuto).toBe(false);
  });

  it("le a fase da sala para quem ainda nao entrou", () => {
    expect(lerInfoDaSala({ room: true, fase: "tournament" })?.fase).toBe("tournament");
    expect(lerInfoDaSala({ room: true, fase: 3 })?.fase).toBe("lobby");
  });

  it("filtra um convite que traga o token de host (servidor antigo)", () => {
    const info = lerInfoDaSala({
      room: true,
      convites: ["http://localhost:7070/?host=segredo", "http://192.168.0.10:7070/"],
    });
    expect(info?.convites).toEqual(["http://192.168.0.10:7070/"]);
  });

  it("convites ausente ou que nao e lista vira lista vazia", () => {
    expect(lerInfoDaSala({ room: true })?.convites).toEqual([]);
    expect(lerInfoDaSala({ room: true, convites: "http://x/" })?.convites).toEqual([]);
  });

  it("aguardandoTunel so e true quando o campo e exatamente true", () => {
    expect(lerInfoDaSala({ room: true, aguardandoTunel: true })?.aguardandoTunel).toBe(true);
    expect(lerInfoDaSala({ room: true, aguardandoTunel: false })?.aguardandoTunel).toBe(false);
    expect(lerInfoDaSala({ room: true, aguardandoTunel: "true" })?.aguardandoTunel).toBe(false);
    expect(lerInfoDaSala({ room: true, aguardandoTunel: 1 })?.aguardandoTunel).toBe(false);
    expect(lerInfoDaSala({ room: true })?.aguardandoTunel).toBe(false);
  });
});

describe("telaDaFase (teste de mesa do Pacote 1)", () => {
  it("lobby e antes de conectar mostram o lobby", () => {
    expect(telaDaFase(undefined)).toBe("lobby");
    expect(telaDaFase("lobby")).toBe("lobby");
  });

  it("draft mostra o draft", () => {
    expect(telaDaFase("draft")).toBe("draft");
  });

  it("torneio e fim de noite sao a MESMA tela (a RoomScreen nao e recriada quando o torneio acaba)", () => {
    expect(telaDaFase("tournament")).toBe("torneio");
    expect(telaDaFase("finished")).toBe("torneio");
  });
});
