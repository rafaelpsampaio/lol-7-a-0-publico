import { describe, it, expect } from "vitest";
import { createRoom, joinRoom, rematch, removePlayer, renamePlayer, setConnected, setSettings, toWire, canStart, type Room } from "./state";
import { MAX_SPECTATORS, RoomWireSchema, SEATS, type BaseStatus } from "../protocol";

const BASE_VAZIA: BaseStatus = {
  ready: false,
  needed: SEATS,
  spareByRole: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0 },
};

const SEM_DRAFT = { baseStatus: BASE_VAZIA, draft: null };

function salaCom(nomes: string[]) {
  let room = createRoom("segredo");
  nomes.forEach((nome, i) => {
    const r = joinRoom(room, { nickname: nome, teamName: `Time ${nome}` }, `c${i}`, `pub${i}`);
    if (!r.ok) throw new Error(`join falhou: ${r.code}`);
    room = r.room;
  });
  return room;
}

describe("createRoom", () => {
  it("comeca no lobby, vazia, com 60s de turno", () => {
    const room = createRoom("segredo");
    expect(room.phase).toBe("lobby");
    expect(room.players).toHaveLength(0);
    expect(room.settings.turnSeconds).toBe(60);
  });
});

describe("joinRoom", () => {
  it("aceita o primeiro jogador e devolve o clientId novo", () => {
    const result = joinRoom(
      createRoom("segredo"),
      { nickname: "rafa", teamName: "Macacos" },
      "c1",
      "pub1"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clientId).toBe("c1");
      expect(result.room.players).toHaveLength(1);
    }
  });

  it("nao torna host quem entra sem o token", () => {
    const result = joinRoom(
      createRoom("segredo"),
      { nickname: "rafa", teamName: "Macacos" },
      "c1",
      "pub1"
    );
    expect(result.ok && result.room.players[0]!.isHost).toBe(false);
  });

  it("torna host quem apresenta o hostToken correto", () => {
    const result = joinRoom(
      createRoom("segredo"),
      { nickname: "rafa", teamName: "Macacos", hostToken: "segredo" },
      "c1",
      "pub1"
    );
    expect(result.ok && result.room.players[0]!.isHost).toBe(true);
  });

  it("ignora hostToken errado", () => {
    const result = joinRoom(
      createRoom("segredo"),
      { nickname: "rafa", teamName: "Macacos", hostToken: "chute" },
      "c1",
      "pub1"
    );
    expect(result.ok && result.room.players[0]!.isHost).toBe(false);
  });

  it("recusa nome de time repetido", () => {
    const room = salaCom(["rafa"]);
    const result = joinRoom(room, { nickname: "outro", teamName: "Time rafa" }, "c9", "pub9");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("team_name_taken");
  });

  it("a frase do nome ocupado vai acentuada tambem para quem esta entrando (m-1)", () => {
    // A varredura de acentos deu as duas frases gemeas por tratadas; so a da
    // reconexao tinha sido. A que ficou sem acento e justamente a do caminho
    // MAIS comum -- jogador novo escolhendo um nome ja ocupado. Nenhum teste
    // afirmava o texto (todos olhavam so o `code`), por isso passou.
    const room = salaCom(["rafa"]);
    const result = joinRoom(room, { nickname: "outro", teamName: "Time rafa" }, "c9", "pub9");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Esse nome de time já está em uso. Escolha outro.");
    }
  });

  it("recusa o nono jogador", () => {
    const room = salaCom(["a", "b", "c", "d", "e", "f", "g", "h"]);
    const result = joinRoom(room, { nickname: "i", teamName: "Time i" }, "c9", "pub9");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("room_full");
  });

  it("reconecta pelo clientId conhecido sem criar jogador novo", () => {
    let room = salaCom(["rafa"]);
    room = setConnected(room, "c0", false);

    const result = joinRoom(
      room,
      { clientId: "c0", nickname: "rafa", teamName: "Time rafa" },
      "novo",
      "pub-novo"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clientId).toBe("c0");
      expect(result.room.players).toHaveLength(1);
      expect(result.room.players[0]!.connected).toBe(true);
    }
  });

  it("reconexao preserva o papel de host", () => {
    let room = createRoom("segredo");
    const primeiro = joinRoom(
      room,
      { nickname: "rafa", teamName: "Macacos", hostToken: "segredo" },
      "c0",
      "pub0"
    );
    if (!primeiro.ok) throw new Error("join falhou");
    room = setConnected(primeiro.room, "c0", false);

    const result = joinRoom(
      room,
      { clientId: "c0", nickname: "rafa", teamName: "Macacos" },
      "novo",
      "pub-novo"
    );
    expect(result.ok && result.room.players[0]!.isHost).toBe(true);
  });

  it("quem chega depois do lobby entra como espectador, sem time (S19)", () => {
    const room = { ...salaCom(["rafa"]), phase: "draft" as const };
    const result = joinRoom(room, { nickname: "atrasado", teamName: "Time atrasado" }, "c9", "pub9");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const novo = result.room.players.find((p) => p.clientId === "c9")!;
    expect(novo.spectator).toBe(true);
    expect(novo.teamName).toBe("");
    expect(novo.isHost).toBe(false);
  });

  it("espectador pode entrar sem nome de time; no lobby o nome e obrigatorio", () => {
    const emJogo = { ...salaCom(["rafa"]), phase: "tournament" as const };
    expect(joinRoom(emJogo, { nickname: "bia", teamName: "" }, "c9", "pub9").ok).toBe(true);

    const noLobby = joinRoom(salaCom(["rafa"]), { nickname: "bia", teamName: "   " }, "c9", "pub9");
    expect(noLobby.ok).toBe(false);
    if (!noLobby.ok) expect(noLobby.code).toBe("time_obrigatorio");
  });

  it("a plateia tem teto proprio, separado das 8 vagas", () => {
    let room: Room = { ...salaCom(["rafa"]), phase: "draft" as const };
    for (let i = 0; i < MAX_SPECTATORS; i++) {
      const r = joinRoom(room, { nickname: `e${i}`, teamName: "" }, `e${i}`, `pe${i}`);
      if (!r.ok) throw new Error("espectador recusado antes do teto");
      room = r.room;
    }
    const cheio = joinRoom(room, { nickname: "mais um", teamName: "" }, "x", "px");
    expect(cheio.ok).toBe(false);
    if (!cheio.ok) expect(cheio.code).toBe("room_full");
  });

  it("espectador nao conta para comecar o draft", () => {
    const room: Room = {
      ...salaCom(["rafa"]),
      players: [
        ...salaCom(["rafa"]).players,
        { clientId: "e1", publicId: "pe1", nickname: "e1", teamName: "", isHost: false, connected: true, spectator: true },
      ],
    };
    expect(canStart(room)).toBe(false);
  });

  it("permite reconexao fora do lobby", () => {
    const room = { ...salaCom(["rafa"]), phase: "draft" as const };
    const result = joinRoom(
      room,
      { clientId: "c0", nickname: "rafa", teamName: "Time rafa" },
      "novo",
      "pub-novo"
    );
    expect(result.ok).toBe(true);
  });

  it("reconexao com o mesmo nome de time e permitida", () => {
    let room = salaCom(["rafa", "amigo"]);
    room = setConnected(room, "c0", false);

    const result = joinRoom(
      room,
      { clientId: "c0", nickname: "rafa", teamName: "Time rafa" },
      "novo",
      "pub-novo"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.room.players).toHaveLength(2);
    }
  });

  it("reconexao e recusada se tentar tomar nome de outro jogador", () => {
    let room = salaCom(["rafa", "amigo"]);
    room = setConnected(room, "c0", false);

    const result = joinRoom(
      room,
      { clientId: "c0", nickname: "rafa", teamName: "Time amigo" },
      "novo",
      "pub-novo"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("team_name_taken");
    // A sala nao mudou
    expect(room.players).toHaveLength(2);
    expect(room.players[0]!.teamName).toBe("Time rafa");
  });

  it("nao muta a sala original", () => {
    const room = createRoom("segredo");
    joinRoom(room, { nickname: "rafa", teamName: "Macacos" }, "c1", "pub1");
    expect(room.players).toHaveLength(0);
  });
});

describe("setSettings", () => {
  it("deixa o host mudar o tempo de turno", () => {
    let room = createRoom("segredo");
    const entrada = joinRoom(
      room,
      { nickname: "rafa", teamName: "Macacos", hostToken: "segredo" },
      "c0",
      "pub0"
    );
    if (!entrada.ok) throw new Error("join falhou");
    room = entrada.room;

    const result = setSettings(room, "c0", 90);
    expect(result.ok && result.room.settings.turnSeconds).toBe(90);
  });

  it("recusa quem nao e host", () => {
    const room = salaCom(["rafa"]);
    const result = setSettings(room, "c0", 90);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_host");
  });

  it("recusa fora do lobby (m-4 da revisao final)", () => {
    // `publishBase` e `startDraft` checam a fase explicitamente; este nao
    // checava — o host podia mudar o turnSeconds no meio do draft. O prazo
    // corrente nao e recalculado, mas o orcamento do proximo turno e o teto de
    // relogio de parede do turno (G-1) saem dele: mudar a regra com o jogo
    // rolando e uma assimetria que ninguem decidiu.
    let room = createRoom("segredo");
    const entrada = joinRoom(
      room,
      { nickname: "rafa", teamName: "Macacos", hostToken: "segredo" },
      "c0",
      "pub0"
    );
    if (!entrada.ok) throw new Error("join falhou");
    room = { ...entrada.room, phase: "draft" };

    const result = setSettings(room, "c0", 90);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("in_progress");
  });
});

describe("canStart", () => {
  it("exige pelo menos 2 conectados", () => {
    expect(canStart(salaCom(["rafa"]))).toBe(false);
    expect(canStart(salaCom(["rafa", "amigo"]))).toBe(true);
  });

  it("nao conta desconectado", () => {
    const room = setConnected(salaCom(["rafa", "amigo"]), "c1", false);
    expect(canStart(room)).toBe(false);
  });
});

describe("toWire", () => {
  it("nao vaza o hostToken", () => {
    const wire = toWire(salaCom(["rafa"]), SEM_DRAFT) as unknown as Record<string, unknown>;
    expect(wire.hostToken).toBeUndefined();
    expect(wire.phase).toBe("lobby");
  });

  it("o fio nao carrega clientId nem hostToken (D-20)", () => {
    const sala = createRoom("token-secreto");
    const r = joinRoom(sala, { nickname: "rafa", teamName: "Time" }, "c1", "pub1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const fio = JSON.stringify(toWire(r.room, SEM_DRAFT));
    expect(fio).not.toContain("token-secreto");
    expect(fio).not.toContain("c1");
    expect(fio).toContain("pub1");
  });

  it("reconexao mantem o mesmo publicId", () => {
    const sala = createRoom("t");
    const a = joinRoom(sala, { nickname: "rafa", teamName: "Time" }, "c1", "pub1");
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = joinRoom(a.room, { clientId: "c1", nickname: "rafa", teamName: "T2" }, "c9", "pub9");
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.room.players).toHaveLength(1);
    expect(b.room.players[0]!.publicId).toBe("pub1");
  });

  it("cada entrada nova recebe um publicId proprio", () => {
    const sala = createRoom("t");
    const a = joinRoom(sala, { nickname: "a", teamName: "A" }, "c1", "pub1");
    const b = joinRoom((a as { ok: true; room: Room }).room, { nickname: "b", teamName: "B" }, "c2", "pub2");
    const fio = toWire((b as { ok: true; room: Room }).room, SEM_DRAFT);
    expect(fio.players.map((p) => p.publicId)).toEqual(["pub1", "pub2"]);
  });

  it("o fio leva o diagnostico da base recebido", () => {
    const pronta: BaseStatus = { ready: true, needed: 8, spareByRole: { top: 8, jungle: 8, mid: 8, adc: 8, support: 8 } };
    const fio = toWire(createRoom("t"), { baseStatus: pronta, draft: null });
    expect(fio.baseStatus.ready).toBe(true);
    expect(fio.draft).toBeNull();
  });

  it("o fio bate com o RoomWireSchema", () => {
    const sala = createRoom("t");
    const r = joinRoom(sala, { nickname: "rafa", teamName: "Time" }, "c1", "pub1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(() => RoomWireSchema.parse(toWire(r.room, SEM_DRAFT))).not.toThrow();
  });
});

describe("joinRoom — host na reconexao", () => {
  it("promove a host quem volta apresentando o token correto", () => {
    // O host abriu a URL da LAN primeiro e entrou como jogador comum.
    let room = createRoom("segredo");
    const primeiro = joinRoom(room, { nickname: "rafa", teamName: "Macacos" }, "c0", "pub0");
    if (!primeiro.ok) throw new Error("join falhou");
    room = primeiro.room;
    expect(room.players[0]!.isHost).toBe(false);

    const result = joinRoom(
      room,
      { clientId: "c0", nickname: "rafa", teamName: "Macacos", hostToken: "segredo" },
      "novo",
      "pub-novo"
    );

    expect(result.ok && result.room.players[0]!.isHost).toBe(true);
  });

  it("mantem host quem volta sem apresentar token", () => {
    let room = createRoom("segredo");
    const primeiro = joinRoom(
      room,
      { nickname: "rafa", teamName: "Macacos", hostToken: "segredo" },
      "c0",
      "pub0"
    );
    if (!primeiro.ok) throw new Error("join falhou");
    room = setConnected(primeiro.room, "c0", false);

    const result = joinRoom(
      room,
      { clientId: "c0", nickname: "rafa", teamName: "Macacos" },
      "novo",
      "pub-novo"
    );

    expect(result.ok && result.room.players[0]!.isHost).toBe(true);
  });

  it("nao promove quem volta com token errado", () => {
    let room = createRoom("segredo");
    const primeiro = joinRoom(room, { nickname: "rafa", teamName: "Macacos" }, "c0", "pub0");
    if (!primeiro.ok) throw new Error("join falhou");
    room = primeiro.room;

    const result = joinRoom(
      room,
      { clientId: "c0", nickname: "rafa", teamName: "Macacos", hostToken: "chute" },
      "novo",
      "pub-novo"
    );

    expect(result.ok && result.room.players[0]!.isHost).toBe(false);
  });
});

describe("renomear na reconexao (m-3 da revisao final)", () => {
  it("no lobby, o hello de volta pode trocar apelido e nome de time", () => {
    const room = salaCom(["rafa"]);
    const r = joinRoom(room, { clientId: "c0", nickname: "novo", teamName: "Outro Time" }, "x", "y");

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.room.players[0]!.nickname).toBe("novo");
    expect(r.room.players[0]!.teamName).toBe("Outro Time");
  });

  it("fora do lobby, o hello de volta nao renomeia nada", () => {
    // O nome do time foi congelado no assento do draft na criacao. Aceitar o
    // rename aqui faria roomState.players[].teamName e
    // roomState.draft.seats[].teamName divergirem para a mesma pessoa: o lobby
    // mostraria um nome e o board do draft outro.
    const room: Room = { ...salaCom(["rafa"]), phase: "draft" };
    const r = joinRoom(room, { clientId: "c0", nickname: "novo", teamName: "Outro Time" }, "x", "y");

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.room.players[0]!.nickname).toBe("rafa");
    expect(r.room.players[0]!.teamName).toBe("Time rafa");
    // e continua sendo uma reconexao normal
    expect(r.room.players[0]!.connected).toBe(true);
    expect(r.clientId).toBe("c0");
  });

  it("fora do lobby, um nome ja tomado no navegador nao derruba a reconexao", () => {
    // Como nada e renomeado, nao ha colisao para recusar — recusar aqui
    // deixaria de fora quem so tinha um nome velho guardado no navegador.
    const room: Room = { ...salaCom(["rafa", "amigo"]), phase: "draft" };
    const r = joinRoom(room, { clientId: "c0", nickname: "rafa", teamName: "Time amigo" }, "x", "y");

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.room.players[0]!.teamName).toBe("Time rafa");
  });
});

describe("removePlayer (S26)", () => {
  function lobbyComCaido(): Room {
    const base = salaCom(["rafa", "amigo"]);
    return {
      ...base,
      players: base.players.map((p, i) => (i === 0 ? { ...p, isHost: true } : { ...p, connected: false })),
    };
  }

  it("host remove quem caiu no lobby e libera a vaga e o nome", () => {
    const room = lobbyComCaido();
    const caido = room.players[1]!;
    const r = removePlayer(room, room.players[0]!.clientId, caido.publicId);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.room.players.map((p) => p.publicId)).not.toContain(caido.publicId);
  });

  it("so o host remove", () => {
    const room = lobbyComCaido();
    const r = removePlayer(room, room.players[1]!.clientId, room.players[0]!.publicId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_host");
  });

  it("nao remove quem esta conectado", () => {
    const base = salaCom(["rafa", "amigo"]);
    const room = { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, isHost: true } : p)) };
    const r = removePlayer(room, room.players[0]!.clientId, room.players[1]!.publicId);
    expect(r.ok).toBe(false);
  });

  it("nao remove fora do lobby", () => {
    const room = { ...lobbyComCaido(), phase: "draft" as const };
    const r = removePlayer(room, room.players[0]!.clientId, room.players[1]!.publicId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("in_progress");
  });
});

describe("rematch (D9, Revanche)", () => {
  function noitEncerrada(): Room {
    const base = salaCom(["rafa", "bia"]);
    return {
      ...base,
      phase: "finished",
      players: [
        ...base.players.map((p, i) => (i === 0 ? { ...p, isHost: true } : p)),
        { clientId: "e1", publicId: "pe1", nickname: "caio", teamName: "", isHost: false, connected: true, spectator: true },
      ],
    };
  }

  it("volta ao lobby com as mesmas pessoas e os mesmos nomes; quem assistia vira jogador", () => {
    const room = noitEncerrada();
    const r = rematch(room, room.players[0]!.clientId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.room.phase).toBe("lobby");
    expect(r.room.draft).toBeNull();
    expect(r.room.tournament).toBeNull();
    expect(r.room.players.map((p) => p.teamName)).toEqual(["Time rafa", "Time bia", "Time de caio"]);
    expect(r.room.players.every((p) => !p.spectator)).toBe(true);
  });

  it("so o host, e so com a noite encerrada", () => {
    const room = noitEncerrada();
    const naoHost = rematch(room, room.players[1]!.clientId);
    expect(naoHost.ok).toBe(false);
    const cedo = rematch({ ...room, phase: "tournament" }, room.players[0]!.clientId);
    expect(cedo.ok).toBe(false);
  });
});

describe("revisao final do Rundown da Sala 2", () => {
  it("reconectar no lobby com time vazio mantem o time que ja tinha (quem virou jogador na Revanche)", () => {
    const room = salaCom(["rafa"]);
    const r = joinRoom(room, { clientId: "c0", nickname: "rafa", teamName: "" }, "x", "px");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.room.players[0]!.teamName).toBe("Time rafa");
  });

  it("renamePlayer troca nome no lobby sem derrubar ninguem, e recusa nome ocupado", () => {
    const room = salaCom(["rafa", "bia"]);
    const ok = renamePlayer(room, "c0", "Rafa", "Fúria");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.room.players[0]).toMatchObject({ nickname: "Rafa", teamName: "Fúria", connected: true });
    const ocupado = renamePlayer(room, "c0", "rafa", "Time bia");
    expect(ocupado.ok).toBe(false);
    if (!ocupado.ok) expect(ocupado.code).toBe("team_name_taken");
    const tarde = renamePlayer({ ...room, phase: "draft" }, "c0", "rafa", "Outro");
    expect(tarde.ok).toBe(false);
  });
});
