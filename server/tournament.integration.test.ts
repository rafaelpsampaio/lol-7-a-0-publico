/**
 * server/tournament.integration.test.ts
 *
 * Dois clientes WebSocket de verdade atravessam um torneio inteiro contra o
 * servidor real, em processo — ws.ts + hub.ts + tournament.ts juntos, mais o
 * unico lugar onde um vazamento de timeline apareceria de verdade: o
 * `to: "all"` do ws.ts entrega para TODO socket conectado, inclusive um que
 * nunca mandou hello (spec secao 13).
 *
 * replay.ts so entra pelo caminho que importa nos testes marcados
 * "(reinicio)": o servidor deste arquivo nunca reinicia sozinho, entao toda
 * timeline pedida por `setWatch` continua em memoria o tempo inteiro e
 * `hasTimelines()` e sempre verdadeiro — os outros testes, mesmo pedindo
 * `games`, so tomam o atalho de cache. Os dois testes de reinicio constroem
 * um SEGUNDO servidor com a mesma sala, mas com as timelines apagadas via
 * `stripTimelines` — exatamente o que `server/room/persistence.ts` grava no
 * disco (D-25) — e so ai `timelineOf` refaz a partida de verdade (D-26).
 */

import { describe, it, expect } from "vitest";
import { isFinished as isTorneioFinished } from "./room/tournament";
import { hasTimelines, stripTimelines } from "./room/replay";
import { PROTOCOL_VERSION } from "./protocol";
import type { RoomHub } from "./room/hub";
import type { Room } from "./room/state";
import type { StoredGame } from "./engine/schema";
import {
  BASE,
  HOST_TOKEN,
  ClienteFalso,
  entrar,
  jogarAteAcabar,
  subirServidor,
} from "./testing/clienteFalso";

/** Um humano do torneio, com o clientId ja em maos (nunca vai pro fio, D-20). */
interface Torcedor {
  cliente: ClienteFalso;
  clientId: string;
}

async function entrarTorcedor(
  url: string,
  nickname: string,
  teamName: string,
  hostToken?: string
): Promise<Torcedor> {
  const cliente = await entrar(url, nickname, teamName, hostToken);
  const clientId = cliente.ultima("welcome")!.clientId;
  return { cliente, clientId };
}

/**
 * Roda o draft ate fechar e devolve os dois torcedores prontos para o
 * torneio. Compartilhado entre os testes que precisam desse ponto de
 * partida — todos, menos o de reconexao, que quer um clientId em maos antes
 * do torneio comecar mesmo.
 */
async function prepararSalaComDraftFechado(): Promise<{
  url: string;
  hub: RoomHub;
  fechar: () => Promise<void>;
  a: Torcedor;
  b: Torcedor;
}> {
  const { url, hub, fechar } = await subirServidor();
  const a = await entrarTorcedor(url, "rafa", "Time A", HOST_TOKEN);
  const b = await entrarTorcedor(url, "amigo", "Time B");

  a.cliente.enviar({ type: "startDraft", turnSeconds: 60 });
  await a.cliente.esperarQue("roomState", (m) => m.state.draft !== null);
  await jogarAteAcabar(hub, [a.cliente, b.cliente]);

  return { url, hub, fechar, a, b };
}

/**
 * Espera uma condicao ficar verdadeira olhando o estado real do hub — nao
 * uma mensagem chegar. A mesma lição do plano do draft: esperar por
 * CHEGADA de mensagem e um bug (um roomState velho, ja recebido, resolveria
 * a espera na hora com estado que nao reflete o commit mais recente).
 */
async function esperarCondicao(check: () => boolean, prazoMs = 5_000): Promise<void> {
  const limite = Date.now() + prazoMs;
  for (;;) {
    if (check()) return;
    if (Date.now() > limite) {
      throw new Error("a condicao esperada nunca se tornou verdadeira");
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

/**
 * Atravessa o torneio inteiro: marca pronto onda apos onda para quem ainda
 * nao marcou, e vota "continuar" quando a urna abre (D-33) — sem isso, um
 * time eliminado que vira "parar" encerraria a sala sem campeao e o teste
 * principal nunca veria `championId` preenchido.
 *
 * Le `hub.room.tournament` direto (nao mensagens recebidas) e so envia uma
 * mensagem quando falta alguma coisa: sem essa guarda o polling a cada 10ms
 * inundaria o servidor de `ready`/`vote` repetidos.
 */
async function atravessarTorneio(hub: RoomHub, torcedores: Torcedor[]): Promise<void> {
  const limite = Date.now() + 45_000;
  for (;;) {
    const t = hub.room.tournament;
    // The champion is computed before the viewers finish the final replay.
    // Keep confirming Ready until the room actually reveals the podium.
    if (hub.room.phase === "finished") return;
    if (Date.now() > limite) throw new Error("o torneio nao acabou em tempo");

    if (t !== null) {
      if (t.vote !== null) {
        for (const { cliente, clientId } of torcedores) {
          if (t.vote.votes[clientId] === undefined) {
            cliente.enviar({ type: "vote", choice: "continuar" });
          }
        }
      } else if (t.resultadosLiberados) {
        // Ready reveals the results; the host starts the next round explicitly.
        torcedores[0].cliente.enviar({ type: "forceAdvance" });
      } else {
        for (const { cliente, clientId } of torcedores) {
          if (!t.ready.includes(clientId)) {
            cliente.enviar({ type: "ready", ready: true });
          }
        }
      }
    }

    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("torneio de ponta a ponta", () => {
  it(
    "dois humanos e seis bots atravessam as 6 ondas ate o campeao",
    async () => {
      const { hub, fechar, a, b } = await prepararSalaComDraftFechado();

      a.cliente.enviar({ type: "startTournament", chaosLevel: 0.25 });
      await a.cliente.esperarQue("roomState", (m) => m.state.tournament !== null);

      await atravessarTorneio(hub, [a, b]);

      expect(hub.room.phase).toBe("finished");
      const t = hub.room.tournament!;
      expect(t.bracket.championId).not.toBeNull();

      const completas = Object.values(t.bracket.slots).filter(
        (slot) => slot.series.status === "complete"
      ).length;
      expect(completas).toBe(14);

      a.cliente.fechar();
      b.cliente.fechar();
      await fechar();
    },
    60_000
  );

  it(
    "a timeline chega so para quem pediu — um bisbilhoteiro nao recebe nada (spec §13)",
    async () => {
      const { url, hub, fechar, a, b } = await prepararSalaComDraftFechado();
      const bisbilhoteiro = await ClienteFalso.abrir(url);

      a.cliente.enviar({ type: "startTournament", chaosLevel: 0.25 });
      await a.cliente.esperarQue("roomState", (m) => m.state.tournament !== null);

      // Os dois assistem series ao longo do torneio (autoWatch aponta cada
      // humano pra serie do proprio time), entao ha `games` de verdade
      // circulando na sala inteira — se o endereçamento vazasse, o
      // bisbilhoteiro pegaria pelo menos uma.
      await atravessarTorneio(hub, [a, b]);

      // Prova que o bisbilhoteiro estava mesmo conectado e recebendo o que a
      // sala difunde de verdade (roomState) — sem isso, "zero games" seria
      // tao provavel por estar desconectado quanto por endereçamento certo.
      expect(bisbilhoteiro.todas("roomState").length).toBeGreaterThan(0);
      expect(bisbilhoteiro.todas("hand")).toHaveLength(0);
      expect(bisbilhoteiro.todas("games")).toHaveLength(0);

      bisbilhoteiro.fechar();
      a.cliente.fechar();
      b.cliente.fechar();
      await fechar();
    },
    60_000
  );

  it(
    "nenhum roomState carrega evento de partida (D-27)",
    async () => {
      const { hub, fechar, a, b } = await prepararSalaComDraftFechado();

      a.cliente.enviar({ type: "startTournament", chaosLevel: 0.25 });
      await a.cliente.esperarQue("roomState", (m) => m.state.tournament !== null);
      await atravessarTorneio(hub, [a, b]);

      // Sobre o TEXTO BRUTO recebido no fio, antes de qualquer parse — um
      // roomState com uma chave "events" a mais cairia fora do
      // ServerMessageSchema (.strict()) e o teste passaria por ausencia de
      // dado, nao por ausencia de vazamento.
      const crus = a.cliente.brutasDoTipo("roomState");
      expect(crus.length).toBeGreaterThan(0);
      for (const texto of crus) {
        expect(Buffer.byteLength(texto, "utf8")).toBeLessThan(60_000);
        expect(texto).not.toContain('"events"');
      }

      a.cliente.fechar();
      b.cliente.fechar();
      await fechar();
    },
    60_000
  );

  it(
    "nenhum clientId de outro jogador aparece no fio (D-20)",
    async () => {
      const { hub, fechar, a, b } = await prepararSalaComDraftFechado();

      a.cliente.enviar({ type: "startTournament", chaosLevel: 0.25 });
      await a.cliente.esperarQue("roomState", (m) => m.state.tournament !== null);
      await atravessarTorneio(hub, [a, b]);

      // clientId de A e de B saem de randomUUID() independentes (subirServidor)
      // — nao ha relacao textual entre eles nem com o publicId, entao a busca
      // por substring abaixo so acerta se o servidor de fato vazar o valor.
      for (const texto of b.cliente.brutas) {
        expect(texto, `B recebeu o clientId de A: ${texto}`).not.toContain(a.clientId);
      }
      for (const texto of a.cliente.brutas) {
        expect(texto, `A recebeu o clientId de B: ${texto}`).not.toContain(b.clientId);
      }

      a.cliente.fechar();
      b.cliente.fechar();
      await fechar();
    },
    60_000
  );

  it(
    "reconectar no meio do torneio devolve o chaveamento e a serie",
    async () => {
      const { url, hub, fechar, a, b } = await prepararSalaComDraftFechado();

      a.cliente.enviar({ type: "startTournament", chaosLevel: 0.25 });
      await a.cliente.esperarQue("roomState", (m) => m.state.tournament !== null);

      // Escolhe explicitamente uma serie que ja tem jogo (a onda 1 acabou de
      // rodar), em vez de confiar em qual time o autoWatch grudou em A — a
      // primeira serie liberada da onda 1 sempre tem jogos.
      const t1 = hub.room.tournament!;
      const slotComJogo = t1.bracket.slots["UB_QF_1"]!.series.games.length > 0 ? "UB_QF_1" : null;
      expect(slotComJogo, "UB_QF_1 devia ter pelo menos um jogo apos a onda 1").not.toBeNull();

      a.cliente.enviar({ type: "setWatch", slotId: "UB_QF_1" });
      await a.cliente.esperarQue("games", (m) => m.slotId === "UB_QF_1");

      a.cliente.fechar();
      const voltou = await ClienteFalso.abrir(url);
      voltou.enviar({
        type: "hello",
        protocolVersion: PROTOCOL_VERSION,
        clientId: a.clientId,
        nickname: "rafa",
        teamName: "Time A",
      });

      const roomState = await voltou.esperarQue("roomState", (m) => m.state.tournament !== null);
      expect(roomState.state.tournament!.wave).toBeGreaterThanOrEqual(1);

      const games = await voltou.esperar("games");
      expect(games.slotId).toBe("UB_QF_1");
      expect(games.games.length).toBeGreaterThan(0);

      voltou.fechar();
      b.cliente.fechar();
      await fechar();
    },
    60_000
  );

  it(
    "a onda nao anda com so um dos dois pronto",
    async () => {
      const { hub, fechar, a, b } = await prepararSalaComDraftFechado();

      a.cliente.enviar({ type: "startTournament", chaosLevel: 0.25 });
      await a.cliente.esperarQue("roomState", (m) => m.state.tournament !== null);

      const waveAntes = hub.room.tournament!.wave;
      a.cliente.enviar({ type: "ready", ready: true });
      await a.cliente.esperarQue("roomState", (m) => (m.state.tournament?.ready.length ?? 0) >= 1);

      // Espera um tempo fixo (nao uma condicao) de proposito: e exatamente a
      // AUSENCIA de mudanca que este teste afirma. B nunca marcou pronto.
      await new Promise((r) => setTimeout(r, 300));

      expect(hub.room.tournament!.wave).toBe(waveAntes);

      a.cliente.fechar();
      b.cliente.fechar();
      await fechar();
    },
    60_000
  );

  it(
    "o host só inicia a próxima onda depois da confirmação coletiva",
    async () => {
      const { hub, fechar, a, b } = await prepararSalaComDraftFechado();

      a.cliente.enviar({ type: "startTournament", chaosLevel: 0.25 });
      await a.cliente.esperarQue("roomState", (m) => m.state.tournament !== null);

      const waveAntes = hub.room.tournament!.wave;
      // The host cannot skip the collective Ready barrier.
      a.cliente.enviar({ type: "forceAdvance" });
      await a.cliente.esperarQue("error", m => m.code === "bad_message");
      expect(hub.room.tournament!.wave).toBe(waveAntes);
      a.cliente.enviar({ type: "ready", ready: true });
      b.cliente.enviar({ type: "ready", ready: true });
      await esperarCondicao(() => hub.room.tournament?.resultadosLiberados === true);
      a.cliente.enviar({ type: "forceAdvance" });

      await esperarCondicao(() => {
        const t = hub.room.tournament;
        // Empate 0 a 0 na urna (se ela abrir) tambem conta como "continuar"
        // (D-33) e nao muda a onda sozinho — o forceAdvance so libera onda
        // quando nao ha urna aberta. Aceita os dois desfechos: onda avancou,
        // ou o torneio ja tinha acabado (championId coroado).
        if (t === null) return false;
        return t.wave > waveAntes || isTorneioFinished(t);
      });

      const t = hub.room.tournament!;
      expect(t.wave > waveAntes || isTorneioFinished(t)).toBe(true);

      a.cliente.fechar();
      b.cliente.fechar();
      await fechar();
    },
    60_000
  );

  it(
    "escolher uma serie que nunca foi jogada volta erro e nao muda o estado",
    async () => {
      const { hub, fechar, a, b } = await prepararSalaComDraftFechado();

      a.cliente.enviar({ type: "startTournament", chaosLevel: 0.25 });
      await a.cliente.esperarQue("roomState", (m) => m.state.tournament !== null);

      // GF so joga na ultima onda — na onda 1 ela nunca tem jogo nenhum.
      expect(hub.room.tournament!.bracket.slots.GF!.series.games).toHaveLength(0);
      const antes = hub.room.tournament!.watching[a.clientId];

      a.cliente.enviar({ type: "setWatch", slotId: "GF" });
      const erro = await a.cliente.esperar("error");
      expect(erro.code).toBe("serie_desconhecida");

      expect(hub.room.tournament!.watching[a.clientId]).toEqual(antes);

      a.cliente.fechar();
      b.cliente.fechar();
      await fechar();
    },
    60_000
  );

  it(
    "depois de um reinicio, a serie regenerada bate campo a campo com a original (D-25/D-26)",
    async () => {
      const { hub, fechar, a, b } = await prepararSalaComDraftFechado();

      a.cliente.enviar({ type: "startTournament", chaosLevel: 0.25 });
      await a.cliente.esperarQue("roomState", (m) => m.state.tournament !== null);

      // UB_QF_1 sempre tem pelo menos um jogo apos a onda 1.
      a.cliente.enviar({ type: "setWatch", slotId: "UB_QF_1" });
      await a.cliente.esperarQue("games", (m) => m.slotId === "UB_QF_1");

      const t = hub.room.tournament!;
      // Clonado via JSON: uma copia de verdade, nao uma referencia que o
      // proximo commit do hub (o cache da regeneracao, mais abaixo) pudesse
      // mudar por baixo do teste.
      const originais = JSON.parse(
        JSON.stringify(t.bracket.slots["UB_QF_1"]!.series.games)
      ) as StoredGame[];
      expect(originais.length).toBeGreaterThan(0);
      expect(originais[0]!.events.length).toBeGreaterThan(0);

      a.cliente.fechar();
      b.cliente.fechar();
      await fechar();

      // Simula um reinicio de verdade (server/main.ts arranca com
      // `new RoomHub(loadRoom(dir), ...)`): um SEGUNDO servidor recebe a
      // MESMA sala, mas com o torneio como ele sai do disco -- sem as
      // timelines (D-25), do jeito exato que server/room/persistence.ts
      // grava (`stripTimelines`).
      const salaRestaurada: Room = {
        ...hub.room,
        players: hub.room.players.map((p) => ({ ...p, connected: false })),
        tournament: { ...t, bracket: stripTimelines(t.bracket) },
      };
      expect(
        hasTimelines(salaRestaurada.tournament!.bracket.slots["UB_QF_1"]!.series.games)
      ).toBe(false);

      const restaurado = await subirServidor(BASE, salaRestaurada);
      const voltou = await ClienteFalso.abrir(restaurado.url);
      voltou.enviar({
        type: "hello",
        protocolVersion: PROTOCOL_VERSION,
        clientId: a.clientId,
        nickname: "rafa",
        teamName: "Time A",
      });
      await voltou.esperar("welcome");

      // O cliente PEDE a serie de novo — e este pedido que forca timelineOf a
      // regenerar: hasTimelines() agora e falso, o atalho de cache nao existe
      // mais neste processo.
      voltou.enviar({ type: "setWatch", slotId: "UB_QF_1" });
      const games = await voltou.esperarQue("games", (m) => m.slotId === "UB_QF_1");

      // Nao so "chegou algo": a partida regenerada bate campo a campo com a
      // original, incluindo os `events` que o snapshot em disco nunca guarda.
      expect(games.games).toEqual(originais);

      voltou.fechar();
      await restaurado.fechar();
    },
    60_000
  );

  it(
    "com o chaosLevel alterado por baixo, o cliente recebe erro em vez de uma partida diferente (D-26)",
    async () => {
      const { hub, fechar, a, b } = await prepararSalaComDraftFechado();

      a.cliente.enviar({ type: "startTournament", chaosLevel: 0.25 });
      await a.cliente.esperarQue("roomState", (m) => m.state.tournament !== null);

      a.cliente.enviar({ type: "setWatch", slotId: "UB_QF_1" });
      await a.cliente.esperarQue("games", (m) => m.slotId === "UB_QF_1");

      const t = hub.room.tournament!;
      expect(t.bracket.slots["UB_QF_1"]!.series.games.length).toBeGreaterThan(0);

      a.cliente.fechar();
      b.cliente.fechar();
      await fechar();

      // O mesmo reinicio do teste anterior, mas com o chaosLevel do torneio
      // TROCADO por baixo -- o mesmo efeito pratico de uma base ou uma engine
      // que mudou entre a gravacao e a leitura (D-26). runSeriesGame com outro
      // chaosLevel reproduz outra partida, e nenhuma das duas camadas de
      // conferencia de replay.ts deixa passar.
      const chaosAlterado = t.chaosLevel > 0.5 ? 0 : 1;
      const salaRestaurada: Room = {
        ...hub.room,
        players: hub.room.players.map((p) => ({ ...p, connected: false })),
        tournament: { ...t, chaosLevel: chaosAlterado, bracket: stripTimelines(t.bracket) },
      };

      const restaurado = await subirServidor(BASE, salaRestaurada);
      const voltou = await ClienteFalso.abrir(restaurado.url);
      voltou.enviar({
        type: "hello",
        protocolVersion: PROTOCOL_VERSION,
        clientId: a.clientId,
        nickname: "rafa",
        teamName: "Time A",
      });
      await voltou.esperar("welcome");

      voltou.enviar({ type: "setWatch", slotId: "UB_QF_1" });
      const erro = await voltou.esperar("error");
      expect(erro.code).toBe("gravacao_indisponivel");
      // Nunca uma partida com cara de original: a urna de "games" continua vazia.
      expect(voltou.todas("games")).toHaveLength(0);

      voltou.fechar();
      await restaurado.fechar();
    },
    60_000
  );
});
