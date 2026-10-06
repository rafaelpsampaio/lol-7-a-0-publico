/**
 * src/room/LobbyScreen.test.tsx
 *
 * Renderizacao SSR da tela de lobby (mesmo padrao de BracketScreen.test.tsx:
 * renderToString, sem jsdom). Prende o que a tela AFIRMA — clique fica para
 * conferencia de navegador.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { renderToString } from "solid-js/web";
import { LobbyScreen, bloqueiosDoDraft, textoDasFaltas } from "./LobbyScreen";
import type { RoomStore } from "../net/store";
import type { RoomPlayerWire, RoomWire } from "../../server/protocol";

function jogador(over: Partial<RoomPlayerWire> = {}): RoomPlayerWire {
  return {
    publicId: "pub-1",
    nickname: "Jogador",
    teamName: "Time",
    isHost: false,
    connected: true,
    spectator: false,
    ...over,
  };
}

function estadoDaSala(over: Partial<RoomWire> = {}): RoomWire {
  return {
    phase: "lobby",
    players: [jogador()],
    settings: { turnSeconds: 60 },
    baseStatus: { ready: true, needed: 8, spareByRole: { top: 8, jungle: 8, mid: 8, adc: 8, support: 8 } },
    draft: null,
    tournament: null,
    ...over,
  };
}

/** Store de mentira: so os acessores que a tela le (mesmo padrao de BracketScreen.test.tsx). */
function storeFalso(over: {
  state?: RoomWire | null;
  clientId?: string | null;
  isHost?: boolean;
  error?: string | null;
  baseMessage?: string | null;
  connected?: boolean;
}): RoomStore {
  return {
    state: () => over.state ?? null,
    clientId: () => over.clientId ?? null,
    isHost: () => over.isHost ?? false,
    error: () => over.error ?? null,
    baseMessage: () => over.baseMessage ?? null,
    connected: () => over.connected ?? true,
  } as unknown as RoomStore;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LobbyScreen · antes de entrar", () => {
  it("mostra o formulario de entrada", () => {
    const html = renderToString(() => <LobbyScreen store={storeFalso({})} />);
    expect(html).toContain("Entrar na sala");
  });

  it("explica que o primeiro jogador assume pelo link comum no modo automático", () => {
    const html = renderToString(() => <LobbyScreen hostAuto store={storeFalso({})} />);
    expect(html).toContain("O primeiro jogador a entrar assume o controle da sala.");
  });
});

describe("LobbyScreen · depois de entrar, convidado", () => {
  it("mostra quem hospeda e aguarda comecar", () => {
    const html = renderToString(() => (
      <LobbyScreen
        store={storeFalso({
          clientId: "c1",
          state: estadoDaSala({ players: [jogador({ isHost: true, nickname: "Anfitriao" })] }),
        })}
      />
    ));
    expect(html).toContain("Aguardando Anfitriao começar o draft.");
    expect(html).not.toContain("Você é o host desta sala.");
  });

  it("nao mostra convite nem publicacao de base · sao coisa de host", () => {
    const html = renderToString(() => (
      <LobbyScreen store={storeFalso({ clientId: "c1", state: estadoDaSala() })} />
    ));
    expect(html).not.toContain("Convide os amigos");
    expect(html).not.toContain("Preparar o draft");
  });

  it("avisa quando o link de host usado nao vale mais nesta sala", () => {
    const html = renderToString(() => (
      <LobbyScreen
        hostToken="token-velho"
        store={storeFalso({ clientId: "c1", isHost: false, state: estadoDaSala() })}
      />
    ));
    expect(html).toContain("não vale mais para esta sala");
  });

  it("link do dono do editor não é tratado como host inválido no modo automático", () => {
    const html = renderToString(() => <LobbyScreen
      hostToken="dono-editor"
      store={storeFalso({ clientId: "c1", isHost: false, state: estadoDaSala({ hostAuto: true }) })}
    />);
    expect(html).not.toContain("não vale mais para esta sala");
  });
});

describe("LobbyScreen · depois de entrar, host", () => {
  it("confirma que sou o host", () => {
    const html = renderToString(() => (
      <LobbyScreen
        store={storeFalso({
          clientId: "c1",
          isHost: true,
          state: estadoDaSala({ players: [jogador({ isHost: true })] }),
        })}
      />
    ));
    expect(html).toContain("Você é o host desta sala: só você escolhe a base, o tempo e começa o draft.");
    expect(html).not.toContain("não vale mais para esta sala");
  });

  it("mostra os links de convite que o servidor anunciou, sem o token de host", () => {
    const html = renderToString(() => (
      <LobbyScreen
        hostToken="abc123"
        convites={["https://algo.trycloudflare.com", "http://192.168.0.10:7070/"]}
        store={storeFalso({ clientId: "c1", isHost: true, state: estadoDaSala() })}
      />
    ));
    expect(html).toContain("Convide os amigos");
    expect(html).toContain("https://algo.trycloudflare.com");
    expect(html).toContain("http://192.168.0.10:7070/");
    expect(html).not.toContain("abc123");
    expect(html).not.toContain("host=");
  });

  it("sem links anunciados, explica onde achar o link no terminal", () => {
    const html = renderToString(() => (
      <LobbyScreen hostToken="abc123" store={storeFalso({ clientId: "c1", isHost: true, state: estadoDaSala() })} />
    ));
    expect(html).toContain("Convide os amigos");
    expect(html).toContain("Amigos na sua rede");
    expect(html).not.toContain("abc123");
  });

  it("com link https, diz que ele funciona de qualquer lugar", () => {
    const html = renderToString(() => (
      <LobbyScreen
        convites={["https://algo.trycloudflare.com", "http://192.168.0.10:7070/"]}
        store={storeFalso({ clientId: "c1", isHost: true, state: estadoDaSala() })}
      />
    ));
    expect(html).toContain("O link https funciona de qualquer lugar; os de número só no mesmo wi-fi.");
    expect(html).not.toContain("Esses links funcionam só para quem está no mesmo wi-fi.");
    expect(html).not.toContain("Gerando o link público");
  });

  it("so com links de rede, nao fala de link https que nao existe", () => {
    const html = renderToString(() => (
      <LobbyScreen
        convites={["http://192.168.0.10:7070/"]}
        store={storeFalso({ clientId: "c1", isHost: true, state: estadoDaSala() })}
      />
    ));
    expect(html).toContain("Esses links funcionam só para quem está no mesmo wi-fi.");
    expect(html).not.toContain("O link https funciona de qualquer lugar");
    expect(html).not.toContain("Gerando o link público");
  });

  it("enquanto o tunel sobe, avisa que o link publico vem ai", () => {
    const html = renderToString(() => (
      <LobbyScreen
        convites={["http://192.168.0.10:7070/"]}
        aguardandoTunel={true}
        store={storeFalso({ clientId: "c1", isHost: true, state: estadoDaSala() })}
      />
    ));
    expect(html).toContain("Gerando o link público (túnel)… ele aparece aqui em alguns segundos.");
    expect(html).toContain("Esses links funcionam só para quem está no mesmo wi-fi.");
  });

  it("aguardando o tunel sem nenhum link de rede, ainda mostra o aviso", () => {
    const html = renderToString(() => (
      <LobbyScreen
        aguardandoTunel={true}
        store={storeFalso({ clientId: "c1", isHost: true, state: estadoDaSala() })}
      />
    ));
    expect(html).toContain("Gerando o link público (túnel)… ele aparece aqui em alguns segundos.");
  });

  it("confirma base pronta em vez de so aparecer o campo de turno", () => {
    const html = renderToString(() => (
      <LobbyScreen store={storeFalso({ clientId: "c1", isHost: true, state: estadoDaSala() })} />
    ));
    expect(html).toContain("Base pronta");
  });

  it("mostra o aviso de base insuficiente quando ela nao esta pronta", () => {
    const html = renderToString(() => (
      <LobbyScreen
        store={storeFalso({
          clientId: "c1",
          isHost: true,
          state: estadoDaSala({
            baseStatus: {
              ready: false,
              needed: 8,
              spareByRole: { top: 3, jungle: 8, mid: 8, adc: 8, support: 8 },
            },
          }),
        })}
      />
    ));
    expect(html).not.toContain("Base pronta");
    expect(html).toContain("pode deixar um dos");
    expect(html).toContain("faltam 5 em Topo");
  });
});

describe("LobbyScreen · entrada para assistir (S19)", () => {
  it("com a sala ja comecada, pede so o apelido e explica que e para assistir", () => {
    const html = renderToString(() => <LobbyScreen store={storeFalso({})} faseAntesDeEntrar="tournament" />);
    expect(html).toContain("A sala já começou");
    expect(html).toContain("Entrar para assistir");
    expect(html).not.toContain("Nome do seu time");
  });

  it("no lobby, pede apelido e time", () => {
    const html = renderToString(() => <LobbyScreen store={storeFalso({})} faseAntesDeEntrar="lobby" />);
    expect(html).toContain("Nome do seu time");
    expect(html).toContain("Entrar na sala");
  });
});

describe("LobbyScreen · times, siglas e bots", () => {
  it("mostra a sigla de cada time e quantos bots completam os 8", () => {
    const html = renderToString(() => (
      <LobbyScreen
        store={storeFalso({
          clientId: "c1",
          state: estadoDaSala({
            players: [
              jogador({ publicId: "a", teamName: "Fúria Azul", isHost: true }),
              jogador({ publicId: "b", teamName: "Dragões" }),
            ],
          }),
        })}
      />
    ));
    expect(html).toContain("FAZ");
    expect(html).toContain("DRA");
    expect(html).toContain("+ 6 times controlados pelo computador (bots) para fechar os 8 do chaveamento.");
  });

  it("quem caiu aparece marcado, e o host ve o botao de remover", () => {
    const html = renderToString(() => (
      <LobbyScreen
        store={storeFalso({
          clientId: "c1",
          isHost: true,
          state: estadoDaSala({
            players: [jogador({ publicId: "a", isHost: true }), jogador({ publicId: "b", teamName: "Outro", connected: false })],
          }),
        })}
      />
    ));
    expect(html).toContain("caiu");
    expect(html).toContain("Remover");
  });
});

describe("bloqueiosDoDraft", () => {
  it("diz em frases o que falta para comecar", () => {
    expect(bloqueiosDoDraft({ conectados: 1, basePronta: false, turnoValido: false })).toEqual([
      "Precisa de pelo menos 2 pessoas conectadas (agora: 1).",
      "A base de jogadores não dá para 8 times · escolha outra no passo 2.",
      "O tempo por turno precisa ser um número inteiro entre 10 e 300 segundos.",
    ]);
  });

  it("nada falta: lista vazia", () => {
    expect(bloqueiosDoDraft({ conectados: 2, basePronta: true, turnoValido: true })).toEqual([]);
  });
});

describe("textoDasFaltas", () => {
  it("rotas por extenso em portugues", () => {
    expect(
      textoDasFaltas({ pronta: false, faltas: [{ rota: "support", faltam: 2 }, { rota: "top", faltam: 1 }] })
    ).toBe("faltam 2 em Suporte, 1 em Topo");
  });
});

describe("configuração e controle da sala", () => {
  it("oferece transferência e regras somente ao host", () => {
    const state = estadoDaSala({ players: [jogador({ isHost: true }), jogador({ publicId: "pub-2", nickname: "Amigo" })] });
    const host = renderToString(() => <LobbyScreen store={storeFalso({ clientId: "c1", isHost: true, state })} />);
    expect(host).toContain("Tornar host");
    expect(host).toContain("Regras da partida");
    expect(host).toContain("Nível de caos");
    expect(host).toContain("Atributos dos jogadores");
    const guest = renderToString(() => <LobbyScreen store={storeFalso({ clientId: "c2", state })} />);
    expect(guest).not.toContain("Tornar host");
    expect(guest).not.toContain('type="range"');
    expect(guest).not.toContain("<select");
  });
});
