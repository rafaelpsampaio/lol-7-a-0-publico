/**
 * server/draft.integration.test.ts
 *
 * Dois clientes WebSocket de verdade jogam um draft inteiro contra o servidor
 * real, em processo. Nada de dublê: http real, ws real, hub real.
 */

import { describe, it, expect } from "vitest";
import { currentSeat } from "./room/draft";
import { PROTOCOL_VERSION } from "./protocol";
import {
  BASE,
  HOST_TOKEN,
  ClienteFalso,
  entrar,
  jogarAteAcabar,
  subirServidor,
} from "./testing/clienteFalso";

describe("draft de ponta a ponta", () => {
  it("dois humanos e seis bots fecham 8 rosters completos", async () => {
    const { url, hub, fechar } = await subirServidor();
    const a = await entrar(url, "rafa", "Time A", HOST_TOKEN);
    const b = await entrar(url, "amigo", "Time B");

    // O join de b ja gerou um roomState que "a" recebeu (broadcast, draft
    // ainda null): esperar por CONDICAO (draft !== null), nao so por chegada,
    // senao esse roomState velho resolveria a espera na hora, sem o servidor
    // ter processado o startDraft ainda.
    a.enviar({ type: "startDraft", turnSeconds: 60 });
    await a.esperarQue("roomState", (m) => m.state.draft !== null);
    await jogarAteAcabar(hub, [a, b]);

    const draft = hub.room.draft!;
    expect(draft.turnIndex).toBe(40);
    for (const seat of draft.seats) {
      expect(Object.keys(seat.picks), `${seat.teamName} incompleto`).toHaveLength(5);
    }

    a.fechar();
    b.fechar();
    await fechar();
  }, 30_000);

  it("nenhuma carta aparece em dois times e nenhum time repete pessoa (A-01)", async () => {
    const { url, hub, fechar } = await subirServidor();
    const a = await entrar(url, "rafa", "Time A", HOST_TOKEN);
    const b = await entrar(url, "amigo", "Time B");

    a.enviar({ type: "startDraft", turnSeconds: 60 });
    await jogarAteAcabar(hub, [a, b]);

    const seats = hub.room.draft!.seats;
    const idsDe = (s: (typeof seats)[number]) =>
      Object.values(s.picks).filter((id): id is string => typeof id === "string");
    const ids = seats.flatMap(idsDe);
    expect(ids).toHaveLength(40);
    expect(new Set(ids).size).toBe(40);
    for (const s of seats) {
      const pessoas = idsDe(s).map((id) => BASE.find((p) => p.id === id)!.personId);
      expect(new Set(pessoas).size, s.teamName).toBe(pessoas.length);
    }

    a.fechar();
    b.fechar();
    await fechar();
  }, 30_000);

  it("um cliente nunca recebe uma carta que entrou no time do outro (spec secao 13)", async () => {
    const { url, hub, fechar } = await subirServidor();
    const a = await entrar(url, "rafa", "Time A", HOST_TOKEN);
    const b = await entrar(url, "amigo", "Time B");

    a.enviar({ type: "startDraft", turnSeconds: 60 });
    await jogarAteAcabar(hub, [a, b]);

    const assentoA = hub.room.draft!.seats.find((s) => s.teamName === "Time A")!;
    const idsDeA = Object.values(assentoA.picks).filter((id): id is string => typeof id === "string");
    const cartasVistasPorB = new Set(
      b.todas("hand").flatMap((m) => m.cards.map((c) => c.card.id))
    );

    for (const id of idsDeA) {
      expect(cartasVistasPorB.has(id), `B viu a carta ${id} que foi para o time de A`).toBe(false);
    }

    a.fechar();
    b.fechar();
    await fechar();
  }, 30_000);

  it("um socket que nunca mandou hello nao recebe mao nenhuma", async () => {
    const { url, hub, fechar } = await subirServidor();
    const bisbilhoteiro = await ClienteFalso.abrir(url);
    const a = await entrar(url, "rafa", "Time A", HOST_TOKEN);
    const b = await entrar(url, "amigo", "Time B");

    a.enviar({ type: "startDraft", turnSeconds: 60 });
    await jogarAteAcabar(hub, [a, b]);

    expect(bisbilhoteiro.todas("hand")).toHaveLength(0);

    bisbilhoteiro.fechar();
    a.fechar();
    b.fechar();
    await fechar();
  }, 30_000);

  it("escolher fora da vez volta como erro e nao mexe no draft", async () => {
    const { url, hub, fechar } = await subirServidor();
    const a = await entrar(url, "rafa", "Time A", HOST_TOKEN);
    const b = await entrar(url, "amigo", "Time B");

    // Mesma corrida do teste anterior: esperar por CONDICAO, nao por chegada.
    a.enviar({ type: "startDraft", turnSeconds: 60 });
    await a.esperarQue("roomState", (m) => m.state.draft !== null);

    // Quem esta na vez vem do estado real do draft, nao de "quem ja recebeu
    // uma mao" — essa segunda forma so acerta por coincidencia da semente
    // (D-05: a ordem sorteada podia mandar a vez pro outro time).
    const draft = hub.room.draft!;
    const vez = currentSeat(draft)!;
    const semMao = vez.teamName === "Time A" ? b : a;
    const antes = draft.turnIndex;
    semMao.enviar({ type: "pick", cardId: BASE[0]!.id });

    const erro = await semMao.esperar("error");
    expect(["not_your_turn", "card_not_in_hand"]).toContain(erro.code);
    expect(hub.room.draft!.turnIndex).toBe(antes);

    a.fechar();
    b.fechar();
    await fechar();
  }, 30_000);

  it("reconectar no meio do draft devolve o assento e a mao", async () => {
    const { url, hub, fechar } = await subirServidor();
    const a = await entrar(url, "rafa", "Time A", HOST_TOKEN);
    const b = await entrar(url, "amigo", "Time B");

    // Mesma corrida dos testes anteriores: esperar por CONDICAO, nao por
    // chegada.
    a.enviar({ type: "startDraft", turnSeconds: 60 });
    await a.esperarQue("roomState", (m) => m.state.draft !== null);

    // Quem tem a mao vem do estado real do draft (mesma razao do teste
    // anterior): "quem ja recebeu uma mao" so acerta por coincidencia da
    // semente.
    const vez = currentSeat(hub.room.draft!)!;
    const comMao = vez.teamName === "Time A" ? a : b;
    const nick = comMao === a ? "rafa" : "amigo";
    const time = comMao === a ? "Time A" : "Time B";
    const clientId = comMao.ultima("welcome")!.clientId;

    comMao.fechar();
    const voltou = await ClienteFalso.abrir(url);
    voltou.enviar({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      clientId,
      nickname: nick,
      teamName: time,
    });

    const mao = await voltou.esperar("hand");
    expect(mao.cards.length).toBeGreaterThan(0);
    expect(hub.room.draft!.seats.some((s) => s.teamName === time)).toBe(true);

    voltou.fechar();
    (comMao === a ? b : a).fechar();
    await fechar();
  }, 30_000);

  it("versao de protocolo diferente recebe protocolMismatch e nao entra", async () => {
    const { url, hub, fechar } = await subirServidor();
    const velho = await ClienteFalso.abrir(url);
    velho.enviar({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION - 1,
      nickname: "antigo",
      teamName: "Time X",
    });

    await velho.esperar("protocolMismatch");
    expect(hub.room.players).toHaveLength(0);

    velho.fechar();
    await fechar();
  }, 30_000);
});
