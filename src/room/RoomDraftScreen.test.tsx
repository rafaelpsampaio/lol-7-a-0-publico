/**
 * src/room/RoomDraftScreen.test.tsx
 *
 * Renderizacao SSR da tela de draft da sala (mesmo padrao dos testes de
 * src/playback: renderToString, sem jsdom). O que interessa aqui e o TEXTO que
 * a tela afirma — a revisao final apontou que o ramo "e minha vez e a mao esta
 * vazia" tambem cobre "a mao ainda nao chegou", e dizer "Enviando sua
 * escolha..." nesse caso afirma algo que o jogador pode nao ter feito (m-2).
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import { RoomDraftScreen, proximoDaVez, picksNovos } from "./RoomDraftScreen";
import type { RoomStore, HandCard } from "../net/store";
import type { DraftWire, DraftSeatWire } from "../../server/protocol";
import { makeCard } from "../../server/room/cards.fixture";

function assento(over: Partial<DraftSeatWire> = {}): DraftSeatWire {
  return {
    index: 0,
    teamName: "Macacos",
    isBot: false,
    connected: true,
    publicId: "pub0",
    picks: {},
    ...over,
  };
}

function draftWire(over: Partial<DraftWire> = {}): DraftWire {
  return {
    round: 1,
    turnIndex: 0,
    totalTurns: 40,
    currentSeat: 0,
    turnMsRemaining: 30_000,
    remainingCards: 40,
    finished: false,
    order: [0, 1],
    timedOutSeat: null,
    seats: [assento(), assento({ index: 1, teamName: "Corujas", publicId: "pub1" })],
    ...over,
  };
}

/**
 * Store de mentira: so os acessores que a tela le. O componente nunca
 * desestrutura props, entao basta um objeto com as funcoes certas.
 */
function storeFalso(over: {
  draft?: DraftWire | null;
  hand?: HandCard[];
  isMyTurn?: boolean;
  connected?: boolean;
  error?: string | null;
  isHost?: boolean;
}): RoomStore {
  return {
    draft: () => over.draft ?? draftWire(),
    hand: () => over.hand ?? [],
    isMyTurn: () => over.isMyTurn ?? false,
    connected: () => over.connected ?? true,
    error: () => over.error ?? null,
    turnMsRemaining: () => 30_000,
    publicId: () => "pub0",
    isHost: () => over.isHost ?? false,
    pick: () => {},
    startTournament: () => {},
  } as unknown as RoomStore;
}

describe("RoomDraftScreen — o que a tela afirma", () => {
  it("nao diz que a escolha foi enviada quando a mao ainda nao chegou (m-2)", () => {
    // "e minha vez E a mao esta vazia" cobre dois casos bem diferentes: a mao
    // acabou de ser enviada, e a mao ainda nao chegou (logo depois de um
    // reconnect, por exemplo). Um texto neutro nao mente em nenhum dos dois.
    const html = renderToString(() => (
      <RoomDraftScreen store={storeFalso({ isMyTurn: true, hand: [] })} />
    ));

    expect(html).not.toContain("Enviando sua escolha");
    expect(html).toContain("Preparando sua m");
  });

  it("com a mao na mao, mostra as cartas e o botao de escolher", () => {
    const carta: HandCard = {
      role: "top",
      card: makeCard({ id: "c1", personId: "p1", primaryRole: "top", displayName: "Fulano" }),
    };
    const html = renderToString(() => (
      <RoomDraftScreen store={storeFalso({ isMyTurn: true, hand: [carta] })} />
    ));

    expect(html).toContain("Fulano");
    expect(html).toContain("Escolher");
    expect(html).not.toContain("Preparando sua m");
  });

  it("fora da minha vez, espera pelo time da vez", () => {
    const html = renderToString(() => (
      <RoomDraftScreen store={storeFalso({ isMyTurn: false })} />
    ));

    expect(html).toContain("Esperando");
    expect(html).not.toContain("Preparando sua m");
  });

  it("desconectado, avisa a duracao real da carencia em vez de 'alguns segundos'", () => {
    // Fase 6 baixa prioridade: quem esta desconectado nao tem como ver uma
    // contagem regressiva ao vivo de verdade (nenhum socket pra alimentar
    // ela) -- mas dava pra trocar o vago "alguns segundos" pelo numero real
    // da carencia (DISCONNECTED_GRACE_SECONDS), que e uma constante conhecida.
    const html = renderToString(() => (
      <RoomDraftScreen store={storeFalso({ connected: false })} />
    ));

    expect(html).not.toContain("alguns segundos");
    expect(html).toContain("15 segundos");
  });

  it("explica a regra do baralho do A-01: sai a carta, nao a pessoa", () => {
    const html = renderToString(() => <RoomDraftScreen store={storeFalso({ isMyTurn: false })} />);

    expect(html).not.toContain("Quem é escolhido sai do");
    expect(html).toContain("A carta escolhida sai do baralho para todos");
    expect(html).toContain("nunca para o mesmo");
  });
});

describe("RoomDraftScreen — draft encerrado, comecar o torneio (D-34)", () => {
  it("o host inicia o torneio sem alterar o caos definido no lobby", () => {
    const html = renderToString(() => (
      <RoomDraftScreen store={storeFalso({ draft: draftWire({ finished: true }), isHost: true })} />
    ));

    expect(html).toContain("Começar o torneio");
    expect(html).not.toContain("Nível de caos");
    expect(html).not.toContain("Esperando o host começar o torneio");
  });

  it("o caos não pode ser alterado depois do draft", () => {
    const html = renderToString(() => (
      <RoomDraftScreen store={storeFalso({ draft: draftWire({ finished: true }), isHost: true })} />
    ));

    expect(html).not.toContain('type="number"');
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain("Caos: 25%");
    expect(html).not.toContain("Equilibrado");
    expect(html).not.toContain("Caótico");
  });

  it("quem nao e o host so ve o aviso de espera, sem o botao", () => {
    const html = renderToString(() => (
      <RoomDraftScreen store={storeFalso({ draft: draftWire({ finished: true }), isHost: false })} />
    ));

    expect(html).toContain("Esperando o host começar o torneio.");
    expect(html).not.toContain("Começar o torneio");
  });

  it("com o draft encerrado, os 8 -- aqui, os 2 do fixture -- rosters continuam visiveis", () => {
    const html = renderToString(() => (
      <RoomDraftScreen store={storeFalso({ draft: draftWire({ finished: true }), isHost: true })} />
    ));

    expect(html).toContain("Macacos");
    expect(html).toContain("Corujas");
  });

  it("cartas escolhidas ocultam atributos por padrão", () => {
    // O dado ja vem completo no fio (RosterWireSchema tipa cada rota como
    // PlayerVersion inteiro) -- so faltava desenhar, igual ja acontecia em
    // src/draft/DraftScreen.tsx (role-slot-stats).
    const carta = {
      ...makeCard({ id: "c1", personId: "p1", primaryRole: "top", displayName: "Fulano" }),
      lanePhase: 72,
      midGame: 61,
      lateGame: 55,
    };
    const html = renderToString(() => (
      <RoomDraftScreen
        store={storeFalso({
          draft: draftWire({
            finished: true,
            seats: [assento({ picks: { top: carta } }), assento({ index: 1, teamName: "Corujas", publicId: "pub1" })],
          }),
          isHost: true,
        })}
      />
    ));

    expect(html).toContain("Fulano");
    expect(html).not.toContain("L 72");
    expect(html).not.toContain("M 61");
    expect(html).not.toContain("F 55");
  });
});

describe("proximoDaVez — quem joga depois da vez atual (Fase 6)", () => {
  it("anda uma posicao na ordem fixa (Fase 8: mesma ordem em toda volta)", () => {
    const proximo = proximoDaVez(draftWire({ turnIndex: 0, order: [0, 1] }));
    expect(proximo?.teamName).toBe("Corujas");
  });

  it("no fim de uma volta, o proximo e quem abre a mesa de novo — nao ha mais inversao", () => {
    const proximo = proximoDaVez(draftWire({ turnIndex: 1, order: [0, 1] }));
    expect(proximo?.teamName).toBe("Macacos");
  });

  it("na ultima escolha do draft inteiro, nao ha proximo", () => {
    const proximo = proximoDaVez(draftWire({ turnIndex: 39, totalTurns: 40, order: [0, 1] }));
    expect(proximo).toBeNull();
  });
});

describe("picksNovos — diff de escolhas entre dois snapshots (Fase 6)", () => {
  const carta = (id: string, displayName: string) =>
    makeCard({ id, personId: id, primaryRole: "top", displayName });

  it("sem mudanca nenhuma, nao ha pick novo", () => {
    const antes = [assento({ index: 0, picks: { top: carta("c1", "Fulano") } })];
    expect(picksNovos(antes, antes)).toEqual([]);
  });

  it("uma escolha nova gera uma entrada com o time e a carta", () => {
    const antes = [assento({ index: 0, teamName: "Macacos", picks: {} })];
    const depois = [assento({ index: 0, teamName: "Macacos", picks: { top: carta("c1", "Fulano") } })];
    expect(picksNovos(antes, depois)).toEqual([{ teamName: "Macacos", cardName: "Fulano" }]);
  });

  it("uma sequencia de bots resolvida no mesmo broadcast gera uma entrada por assento", () => {
    const antes = [
      assento({ index: 0, teamName: "Macacos", picks: {} }),
      assento({ index: 1, teamName: "Corujas", picks: {} }),
    ];
    const depois = [
      assento({ index: 0, teamName: "Macacos", picks: { top: carta("c1", "Fulano") } }),
      assento({ index: 1, teamName: "Corujas", picks: { jungle: carta("c2", "Beltrano") } }),
    ];
    expect(picksNovos(antes, depois)).toEqual([
      { teamName: "Macacos", cardName: "Fulano" },
      { teamName: "Corujas", cardName: "Beltrano" },
    ]);
  });
});

describe("RoomDraftScreen — visibilidade de turno e ritmo (Fase 6)", () => {
  it("mostra quem joga depois da vez atual", () => {
    const html = renderToString(() => <RoomDraftScreen store={storeFalso({})} />);

    expect(html).toContain("Próximo: Corujas");
  });

  it("nao mostra 'Próximo' na ultima escolha do draft inteiro", () => {
    const html = renderToString(() => (
      <RoomDraftScreen store={storeFalso({ draft: draftWire({ turnIndex: 39 }) })} />
    ));

    expect(html).not.toContain("Próximo:");
  });

  it("mostra o contador geral de progresso ao lado da volta", () => {
    const html = renderToString(() => <RoomDraftScreen store={storeFalso({})} />);

    expect(html).toContain("escolha 1 de 40");
  });

  it("sinaliza quem perdeu o prazo quando o servidor marca timedOutSeat", () => {
    const html = renderToString(() => (
      <RoomDraftScreen store={storeFalso({ draft: draftWire({ timedOutSeat: 0 }) })} />
    ));

    expect(html).toContain("Macacos perdeu o prazo");
  });

  it("sem timedOutSeat, nao mostra aviso de prazo perdido", () => {
    const html = renderToString(() => <RoomDraftScreen store={storeFalso({})} />);

    expect(html).not.toContain("perdeu o prazo");
  });
});

describe("RoomDraftScreen — ordem, identidade e plateia (Rundown da Sala 2, S18)", () => {
  function comJogadores(over: { players: { publicId: string; nickname: string; spectator?: boolean; isHost?: boolean }[]; draft?: DraftWire; isMyTurn?: boolean; publicId?: string }): RoomStore {
    return {
      draft: () => over.draft ?? draftWire(),
      hand: () => [],
      isMyTurn: () => over.isMyTurn ?? false,
      connected: () => true,
      error: () => null,
      turnMsRemaining: () => 30_000,
      publicId: () => over.publicId ?? "pub0",
      isHost: () => false,
      state: () => ({
        players: over.players.map((p) => ({ teamName: "", connected: true, spectator: false, isHost: false, ...p })),
      }),
      pick: () => {},
      startTournament: () => {},
    } as unknown as RoomStore;
  }

  it("os times aparecem na ordem de escolha, nao na de entrada", () => {
    const d = draftWire({ order: [1, 0] });
    const html = renderToString(() => <RoomDraftScreen store={comJogadores({ players: [], draft: d })} />);
    const lista = html.slice(html.indexOf("Times, na ordem de escolha"));
    expect(lista.indexOf("Corujas")).toBeLessThan(lista.indexOf("Macacos"));
    expect(html).toContain("1º");
  });

  it("meu assento leva o selo 'você' e o apelido do dono aparece", () => {
    const html = renderToString(() => (
      <RoomDraftScreen store={comJogadores({ players: [{ publicId: "pub0", nickname: "rafa" }] })} />
    ));
    expect(html).toContain("rafa");
    expect(html).toContain("você");
  });

  it("vez de outro time diz de quem e, com o apelido", () => {
    const d = draftWire({ currentSeat: 1 });
    const html = renderToString(() => (
      <RoomDraftScreen store={comJogadores({ players: [{ publicId: "pub1", nickname: "bia" }], draft: d })} />
    ));
    expect(html).toContain("Vez de Corujas (bia)");
  });

  it("diz quais rotas ainda faltam no meu time", () => {
    const html = renderToString(() => <RoomDraftScreen store={comJogadores({ players: [] })} />);
    expect(html).toContain("Rotas que faltam no seu time: Topo, Caçador, Meio, Atirador, Suporte.");
  });

  it("espectador le que esta assistindo, sem 'rotas que faltam'", () => {
    const html = renderToString(() => (
      <RoomDraftScreen
        store={comJogadores({ players: [{ publicId: "pub-plateia", nickname: "caio", spectator: true }], publicId: "pub-plateia" })}
      />
    ));
    expect(html).toContain("Você está assistindo o draft");
    expect(html).not.toContain("Rotas que faltam");
  });
});


it("outros jogadores veem as opções sem poder escolher", () => {
  const card=makeCard({id:"shared",personId:"one",primaryRole:"top",displayName:"Opção compartilhada"});
  const html=renderToString(()=><RoomDraftScreen store={storeFalso({draft:draftWire({options:[{role:"top",card}]}),isMyTurn:false})} />);
  expect(html).toContain("Opção compartilhada"); expect(html).toContain("Em análise"); expect(html).toContain("disabled");
});
