import { describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import { RoomShell, etapaAtual, textoDaConexao } from "./RoomShell";
import type { RoomStore, StatusDaSala } from "../net/store";
import type { RoomWire } from "../../server/protocol";

function storeFalso(over: { status?: StatusDaSala; error?: string | null; proximaTentativaEm?: number | null }): RoomStore {
  return {
    state: () => null,
    publicId: () => null,
    status: () => over.status ?? "na-sala",
    error: () => over.error ?? null,
    proximaTentativaEm: () => over.proximaTentativaEm ?? null,
    tentarAgora: () => {},
    limparErro: () => {},
  } as unknown as RoomStore;
}

describe("etapaAtual", () => {
  it("lobby, draft, torneio e podio em ordem", () => {
    expect(etapaAtual(undefined)).toBe(0);
    expect(etapaAtual("lobby")).toBe(0);
    expect(etapaAtual("draft")).toBe(1);
    expect(etapaAtual("tournament")).toBe(2);
    expect(etapaAtual("finished")).toBe(3);
  });
});

describe("textoDaConexao", () => {
  it("cada estado com o seu texto", () => {
    expect(textoDaConexao("na-sala").texto).toBe("Conectado");
    expect(textoDaConexao("reconectando").texto).toBe("Reconectando…");
    expect(textoDaConexao("versao-diferente").tom).toBe("danger");
  });
});

describe("RoomShell", () => {
  it("mostra as etapas, a saida e o conteudo da fase", () => {
    const html = renderToString(() => (
      <RoomShell store={storeFalso({})} onSair={() => {}}>
        <p>conteudo da fase</p>
      </RoomShell>
    ));
    expect(html).toContain("Lobby");
    expect(html).toContain("Pódio");
    expect(html).toContain("Sair da sala");
    expect(html).toContain("conteudo da fase");
  });

  it("queda: faixa de reconexao com 'Tentar agora', sem mandar recarregar", () => {
    const html = renderToString(() => (
      <RoomShell store={storeFalso({ status: "reconectando" })} onSair={() => {}}>
        <p />
      </RoomShell>
    ));
    expect(html).toContain("A conexão com a sala caiu.");
    expect(html).toContain("Tentar agora");
    expect(html).not.toContain("Recarregue");
  });

  it("erro do servidor aparece na faixa, em qualquer fase", () => {
    const html = renderToString(() => (
      <RoomShell store={storeFalso({ error: "Só quem hospeda força a próxima onda." })} onSair={() => {}}>
        <p />
      </RoomShell>
    ));
    expect(html).toContain("Só quem hospeda força a próxima onda.");
  });

  it("versao diferente: pede para recarregar", () => {
    const html = renderToString(() => (
      <RoomShell store={storeFalso({ status: "versao-diferente" })} onSair={() => {}}>
        <p />
      </RoomShell>
    ));
    expect(html).toContain("Recarregar");
  });

  it("avisa a sala sobre a queda do host automático também durante o draft", () => {
    const room: RoomWire = {
      hostAuto: true,
      phase: "draft", players: [{ publicId: "pub1", nickname: "Ana", teamName: "A", isHost: true, connected: false, spectator: false }],
      settings: { turnSeconds: 60 }, baseStatus: { ready: true, needed: 8, spareByRole: { top: 8, jungle: 8, mid: 8, adc: 8, support: 8 } },
      draft: null, tournament: null,
    };
    const store = { ...storeFalso({}), state: () => room, isHost: () => false };
    const html = renderToString(() => <RoomShell store={store} onSair={() => {}}><p /></RoomShell>);
    expect(html).toContain("O host Ana desconectou.");
    expect(html).toContain("60 s após a queda");
    room.hostAuto = false;
    expect(renderToString(() => <RoomShell store={store} onSair={() => {}}><p /></RoomShell>)).not.toContain("60 s após a queda");
  });
});
