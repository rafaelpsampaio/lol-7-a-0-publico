import { describe, it, expect } from "vitest";
import { mkdir, mkdtemp, readdir, writeFile, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRoom, joinRoom, type Room } from "./state";
import {
  criarFilaSerial,
  criarGravadorDeSala,
  roomSnapshotPath,
  saveRoom,
  loadRoom,
  tempSnapshotPath,
} from "./persistence";
import { createDraft, applyPick, handCards, type DraftState } from "./draft";
import { makeBase } from "./cards.fixture";
import { runWave, type RoomTournament } from "./tournament";
import { criar } from "./tournament.fixture";
import { timelineOf } from "./replay";
import { ChampionCatalogueSchema, type SlotId, type TournamentState } from "../engine/schema";

const CATALOGO = ChampionCatalogueSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "public/champions.json"), "utf8"))
).champions;

async function dirTemp(): Promise<string> {
  return mkdtemp(join(tmpdir(), "lol7a0-room-"));
}

function salaComUmJogador() {
  const result = joinRoom(
    createRoom("segredo"),
    { nickname: "rafa", teamName: "Macacos", hostToken: "segredo" },
    "c0",
    "pub0"
  );
  if (!result.ok) throw new Error("join falhou");
  return result.room;
}

// Base de cartas para os testes de draft. Congelada durante o draft (D-10),
// entao os ids gravados no snapshot sempre resolvem contra ela.
const BASE = makeBase(8);

/** Sala de dois jogadores, no lobby (draft null) ou em draft (draft dado). */
function salaExemplo(draft: DraftState | null = null): Room {
  return {
    phase: draft === null ? "lobby" : "draft",
    players: [
      { clientId: "c0", publicId: "pub0", nickname: "rafa", teamName: "A", isHost: true, connected: true, spectator: false },
      { clientId: "c1", publicId: "pub1", nickname: "amigo", teamName: "B", isHost: false, connected: true, spectator: false },
    ],
    settings: { turnSeconds: 60 },
    draft,
    tournament: null,
    hostToken: "token",
  };
}

function draftExemplo(): DraftState {
  return createDraft({
    players: BASE,
    humans: [
      { clientId: "c0", teamName: "A" },
      { clientId: "c1", teamName: "B" },
    ],
    seed: "semente-fixa",
    now: 1_000,
    budget: () => 60_000,
  });
}

describe("saveRoom / loadRoom", () => {
  it("devolve null quando nao ha snapshot", async () => {
    expect(await loadRoom(await dirTemp())).toBeNull();
  });

  it("salva e restaura a sala inteira", async () => {
    const dir = await dirTemp();
    const room = salaComUmJogador();

    await saveRoom(dir, room);
    const restored = await loadRoom(dir);

    // Tudo volta igual, menos `connected`: no arranque ninguem esta online.
    // `tournament` volta explicito (null) mesmo quando quem gravou nunca
    // passou o campo -- ver "loadRoom sempre devolve o campo tournament" (T6).
    expect(restored).toEqual({
      ...room,
      players: room.players.map((p) => ({ ...p, connected: false })),
      tournament: null,
    });
  });

  it("restaura o modo automático e o host sem mudar a identidade dos jogadores", async () => {
    const dir = await dirTemp();
    const room = { ...salaComUmJogador(), hostAuto: true };
    await saveRoom(dir, room);
    expect(await loadRoom(dir)).toEqual({
      ...room,
      players: room.players.map((p) => ({ ...p, connected: false })),
    });
  });

  it("cria o diretorio se ele nao existir", async () => {
    const dir = join(await dirTemp(), "fundo", "do", "poco");
    await saveRoom(dir, salaComUmJogador());
    expect(await loadRoom(dir)).not.toBeNull();
  });

  /** Todo temporario que sobrou no diretorio, seja qual for o sufixo unico. */
  async function temporariosEm(dir: string): Promise<string[]> {
    return (await readdir(dir)).filter((f) => f.endsWith(".tmp"));
  }

  it("nao deixa arquivo .tmp para tras", async () => {
    // Varre o diretorio em vez de procurar um nome fixo: desde o M-3 da
    // revisao final cada gravacao tem seu proprio sufixo, e procurar
    // "room.json.tmp" passaria em vacuo (esse nome nunca mais existe).
    const dir = await dirTemp();
    await saveRoom(dir, salaComUmJogador());
    expect(await temporariosEm(dir)).toEqual([]);
  });

  it("escreve primeiro no .tmp: se essa gravacao falhar, o snapshot antigo fica inteiro", async () => {
    // Mata a mutacao M7b da revisao (tmp + rename -> writeFile direto no
    // arquivo final): a atomicidade e a restricao mais citada do plano e era a
    // unica que nenhum teste observava. Com um DIRETORIO ocupando o caminho do
    // .tmp, a gravacao do temporario falha e nada chega ao room.json.
    //
    // Sem tmp + rename a escrita cai direto no arquivo final, o diretorio preso
    // no caminho do .tmp nao atrapalha nada, a promessa RESOLVE e o snapshot
    // antigo e substituido — as duas assercoes abaixo caem.
    //
    // O caminho do temporario e passado de proposito: desde o M-3 ele nasce
    // com um sufixo unico por gravacao (justamente para dois escritores nunca
    // dividirem o mesmo arquivo), e o teste precisa saber QUAL bloquear.
    const dir = await dirTemp();
    await saveRoom(dir, salaComUmJogador());
    const antes = await readFile(join(dir, "room.json"), "utf8");

    const tmp = join(dir, "room.json.bloqueado.tmp");
    await mkdir(tmp);

    await expect(saveRoom(dir, salaExemplo(), tmp)).rejects.toThrow();
    expect(await readFile(join(dir, "room.json"), "utf8")).toBe(antes);
  });

  it("apaga o .tmp quando o rename falha, em vez de deixar lixo para sempre", async () => {
    // O rename falha porque o destino e um diretorio: a gravacao do tmp da
    // certo, o rename nao tem como substituir uma pasta por um arquivo.
    const dir = await dirTemp();
    await mkdir(join(dir, "room.json"));

    await expect(saveRoom(dir, salaComUmJogador())).rejects.toThrow();

    expect(await temporariosEm(dir)).toEqual([]);
  });

  it("recusa gravar uma sala que a leitura nao aceitaria de volta (m-5)", async () => {
    // A leitura e estrita: o DraftStateSchema impoe seats.length === SEATS e
    // turns.length === SEATS * PICKS_PER_SEAT. Gravar sem validar deixava um
    // estado fora do formato ir para o disco em silencio e a sala INTEIRA
    // desaparecer no reinicio — o mesmo modo de falha que o F2 ja corrigiu uma
    // vez por outro caminho. Melhor um erro no log agora que uma sala
    // fantasma depois.
    const dir = await dirTemp();
    const draft = draftExemplo();
    const quebrado = { ...draft, seats: draft.seats.slice(0, 7) } as unknown as DraftState;

    await expect(saveRoom(dir, salaExemplo(quebrado))).rejects.toThrow();
    await expect(readFile(join(dir, "room.json"), "utf8")).rejects.toThrow();
  });

  it("devolve null quando o snapshot esta corrompido", async () => {
    const dir = await dirTemp();
    await saveRoom(dir, salaComUmJogador());
    await writeFile(join(dir, "room.json"), "{ isso nao e json", "utf8");
    expect(await loadRoom(dir)).toBeNull();
  });

  it("devolve null quando a versao do snapshot nao bate", async () => {
    const dir = await dirTemp();
    await saveRoom(dir, salaComUmJogador());
    const file = join(dir, "room.json");
    const raw = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    raw.version = 999;
    await writeFile(file, JSON.stringify(raw), "utf8");
    expect(await loadRoom(dir)).toBeNull();
  });
});

describe("loadRoom e a versao do snapshot", () => {
  it("descarta snapshot da versao antiga em vez de restaurar sem publicId (D-18)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lol7a0-sala-"));
    await writeFile(
      join(dir, "room.json"),
      JSON.stringify({
        version: 1,
        room: {
          phase: "lobby",
          players: [{ clientId: "c1", nickname: "rafa", teamName: "T", isHost: true, connected: true, spectator: false }],
          settings: { turnSeconds: 60 },
          hostToken: "t",
        },
      }),
      "utf8"
    );
    expect(await loadRoom(dir)).toBeNull();
  });

  it("descarta snapshot v2 em vez de restaurar um draft sem turnStartedAt (G-1)", async () => {
    // O v2 nao tem a ancora do teto de relogio de parede do turno. Nao ha como
    // inventa-la sem mentir sobre quando o turno comecou, entao a v3 descarta o
    // v2 inteiro — sem migracao, como ja fazia com o v1. A sala recomeca.
    const dir = await mkdtemp(join(tmpdir(), "lol7a0-sala-v2-"));
    const antigo = { ...draftExemplo() } as unknown as Record<string, unknown>;
    delete antigo.turnStartedAt;
    await writeFile(
      join(dir, "room.json"),
      JSON.stringify({ version: 2, room: { ...salaExemplo(draftExemplo()), draft: antigo } }),
      "utf8"
    );
    expect(await loadRoom(dir)).toBeNull();
  });
});

describe("loadRoom e o estado de conexao", () => {
  it("restaura todo mundo desconectado — ninguem esta online no arranque", async () => {
    const dir = await dirTemp();
    const room = salaComUmJogador();
    expect(room.players[0]!.connected).toBe(true);

    await saveRoom(dir, room);
    const restored = await loadRoom(dir);

    expect(restored?.players[0]!.connected).toBe(false);
    // O resto do jogador continua intacto
    expect(restored?.players[0]!.teamName).toBe("Macacos");
    expect(restored?.players[0]!.isHost).toBe(true);
  });
});

describe("loadRoom e snapshots sem a chave draft (F2 da revisao)", () => {
  it("restaura um snapshot da versao corrente sem a chave draft, em vez de sumir com a sala", async () => {
    // Um room.json gravado por um servidor desta mesma versao antes de a chave
    // `draft` existir no Room. Sem o `.default(null)` no schema, o `.strict()`
    // recusava o objeto inteiro por faltar uma chave obrigatoria, `loadRoom`
    // devolvia null, e quem tivesse o servidor rodando perdia a sala inteira no
    // proximo reinicio.
    const dir = await mkdtemp(join(tmpdir(), "lol7a0-sala-sem-draft-"));
    await writeFile(
      join(dir, "room.json"),
      JSON.stringify({
        version: 5,
        room: {
          phase: "lobby",
          players: [
            {
              clientId: "c1",
              publicId: "pub1",
              nickname: "rafa",
              teamName: "Macacos",
              isHost: true,
              connected: true,
              spectator: false,
            },
          ],
          settings: { turnSeconds: 60 },
          hostToken: "t",
          // sem "draft" de proposito
        },
        tournament: null,
      }),
      "utf8"
    );

    const restored = await loadRoom(dir);

    expect(restored).not.toBeNull();
    expect(restored?.draft).toBeNull();
    expect(restored?.phase).toBe("lobby");
    // conectado volta false no arranque, como qualquer outra restauracao
    expect(restored?.players[0]!.connected).toBe(false);
    expect(restored?.players[0]!.teamName).toBe("Macacos");
  });
});

describe("loadRoom e o draft em andamento (Tarefa 8)", () => {
  it("guarda e restaura um draft em andamento", async () => {
    const dir = await dirTemp();
    const draft = draftExemplo();

    await saveRoom(dir, salaExemplo(draft));
    const volta = await loadRoom(dir);

    // Cada campo comparado aqui morre se a chave correspondente sumir do
    // schema do snapshot ou for gravada errada: um objeto por acidente igual
    // (ex.: {} === {}) nao passaria num toEqual contra o draft de verdade.
    expect(volta?.draft?.turns).toEqual(draft.turns);
    expect(volta?.draft?.seats).toEqual(draft.seats);
    expect(volta?.draft?.hand).toEqual(draft.hand);
    expect(volta?.draft?.turnIndex).toBe(draft.turnIndex);
    expect(volta?.draft?.deadline).toBe(draft.deadline);
    // A ancora do teto do turno (G-1) tem que atravessar o disco junto com o
    // prazo: sem ela o hub restaurado nao sabe quando o turno comecou.
    expect(volta?.draft?.turnStartedAt).toBe(draft.turnStartedAt);
  });

  it("sala no lobby continua com draft null", async () => {
    const dir = await dirTemp();
    await saveRoom(dir, salaExemplo());
    const volta = await loadRoom(dir);
    expect(volta?.draft).toBeNull();
    expect(volta?.phase).toBe("lobby");
  });

  it("o snapshot nao guarda cartas inteiras, so ids (D-18)", async () => {
    const dir = await dirTemp();
    await saveRoom(dir, salaExemplo(draftExemplo()));
    const texto = await readFile(join(dir, "room.json"), "utf8");

    // championPool so existe dentro de uma carta inteira (ver cards.fixture.ts)
    // — se aparecer aqui, alguem passou a serializar PlayerVersion completo
    // em vez de so o id da carta.
    expect(texto).not.toContain("championPool");
    // Teto de tamanho: cada carta inteira carrega 8 entradas de championPool
    // e varios outros campos: se a serializacao regredir para cartas
    // inteiras o arquivo estoura essa marca facilmente.
    expect(texto.length).toBeLessThan(20_000);
  });

  it("um draft corrompido derruba o snapshot inteiro em vez de virar sala meio pronta", async () => {
    const dir = await dirTemp();
    await writeFile(
      join(dir, "room.json"),
      JSON.stringify({
        version: 5,
        room: { ...salaExemplo(), draft: { seed: "s" } },
        tournament: null,
      }),
      "utf8"
    );
    // draft: {seed: "s"} nao tem seats/turns/turnIndex/turnStartedAt/hand —
    // o objeto inteiro precisa ser recusado, nao so o campo draft: uma sala
    // "restaurada" com draft quebrado e pior que uma sala nova.
    expect(await loadRoom(dir)).toBeNull();
  });

  it("o draft restaurado continua jogavel de onde parou", async () => {
    const dir = await dirTemp();
    const draft = draftExemplo();
    await saveRoom(dir, salaExemplo(draft));

    const volta = (await loadRoom(dir))!;
    const cartas = handCards(volta.draft!, BASE);
    expect(cartas.length).toBeGreaterThan(0);

    const r = applyPick(volta.draft!, BASE, cartas[0]![1].id, 2_000, () => 60_000);
    expect(r.ok).toBe(true);
  });

  it("a mao restaurada e a mesma de antes de salvar", async () => {
    const dir = await dirTemp();
    const draft = draftExemplo();
    const maoAntes = handCards(draft, BASE);

    await saveRoom(dir, salaExemplo(draft));
    const volta = (await loadRoom(dir))!;
    const maoDepois = handCards(volta.draft!, BASE);

    // Prova o que o cabeçalho de draft.ts promete: a mesma sala restaurada
    // de um snapshot tira exatamente a mesma mao. Compara por id de carta —
    // se a semente derivada do turno mudar na restauracao, os ids nao batem.
    expect(maoDepois.map(([, carta]) => carta.id)).toEqual(maoAntes.map(([, carta]) => carta.id));
    expect(maoDepois).toEqual(maoAntes);
  });
});

describe("saveRoom / loadRoom e o torneio da sala (Tarefa 6)", () => {
  /** A sala que a gravacao ja espera, com o torneio dentro. */
  function salaCom(t: RoomTournament) {
    return { ...salaExemplo(), tournament: t };
  }

  /**
   * Um snapshot VALIDO de verdade, para mexer num campo so. Gravar `{}` ou
   * `room: {}` cru ja seria recusado sozinho pelo `.strict()` do schema da
   * sala -- um teste que parte dai nao prova que a mutacao sob teste (versao,
   * torneio) foi o motivo da recusa, so que ALGUMA coisa no objeto era
   * invalida. Gravando um torneio real e relendo o JSON do disco, o unico
   * jeito de reprovar depois de mexer em UM campo e esse campo mesmo.
   */
  async function snapshotValido(dir: string): Promise<Record<string, unknown>> {
    await saveRoom(dir, salaCom(runWave(criar(2), [])));
    return JSON.parse(await readFile(join(dir, "room.json"), "utf8")) as Record<string, unknown>;
  }

  it("SNAPSHOT_VERSION e 5 e um snapshot v4 e descartado", async () => {
    const dir = await dirTemp();
    const bom = await snapshotValido(dir);

    // Metade 1: o mesmo objeto, intacto, carrega -- e o que torna a metade 2
    // honesta. Sem isto, uma recusa la embaixo podia ser por qualquer motivo.
    await writeFile(join(dir, "room.json"), JSON.stringify(bom), "utf8");
    expect(await loadRoom(dir)).not.toBeNull();

    // Metade 2: mexeu SO na versao. Se isto ainda carregar, a checagem de
    // versao nao esta acontecendo -- o resto do objeto continua 100% valido.
    await writeFile(join(dir, "room.json"), JSON.stringify({ ...bom, version: 4 }), "utf8");
    expect(await loadRoom(dir)).toBeNull();
  });

  it("o arquivo gravado nao tem nenhum evento de partida (D-25)", async () => {
    const dir = await dirTemp();
    let t = criar(2);
    t = runWave(t, []);
    await saveRoom(dir, salaCom(t));

    const bruto = await readFile(join(dir, "room.json"), "utf8");
    // Teto de tamanho: o torneio inteiro COM as timelines pesa 17 MB. Sem a
    // poda de D-25 este arquivo estouraria essa marca facilmente.
    expect(bruto.length).toBeLessThan(200_000);

    const lido = JSON.parse(bruto) as { tournament: { bracket: TournamentState } };
    for (const slot of Object.values(lido.tournament.bracket.slots)) {
      for (const jogo of slot.series.games) expect(jogo.events).toEqual([]);
    }
  });

  it("ida e volta preserva placar, vencedor e chaos", async () => {
    const dir = await dirTemp();
    const t = runWave(criar(2), []);
    await saveRoom(dir, salaCom(t));

    const lido = await loadRoom(dir);
    expect(lido).not.toBeNull();
    const voltou = lido!.tournament!;
    expect(voltou.chaosLevel).toBe(t.chaosLevel);
    expect(voltou.wave).toBe(t.wave);
    for (const s of ["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"] as SlotId[]) {
      expect(voltou.bracket.slots[s]!.series.winnerId).toBe(t.bracket.slots[s]!.series.winnerId);
      expect(voltou.bracket.slots[s]!.series.games).toHaveLength(
        t.bracket.slots[s]!.series.games.length
      );
    }
  });

  it("os hashes de timeline sobrevivem ao snapshot", async () => {
    // Sem eles, TODA regeneracao depois de um reinicio responde
    // gravacao_indisponivel: o replay morre inteiro e em silencio, porque a
    // camada 2 da conferencia trata hash ausente como reprovacao, nunca como
    // permissao. E a falha mais barata de causar e a mais cara de diagnosticar.
    const dir = await dirTemp();
    const t = runWave(criar(2), []);
    await saveRoom(dir, salaCom(t));

    const voltou = (await loadRoom(dir))!.tournament!;
    expect(voltou.timelineHashes).toEqual(t.timelineHashes);
    expect(Object.keys(voltou.timelineHashes).length).toBeGreaterThan(0);
  });

  it("depois de restaurar, a timeline volta refeita e identica", async () => {
    // CATALOGO real, nao []: e o que o servidor tem na mao (ver Tarefa 5).
    const dir = await dirTemp();
    const t = runWave(criar(2), CATALOGO);
    await saveRoom(dir, salaCom(t));

    const voltou = (await loadRoom(dir))!.tournament!;
    const r = timelineOf(voltou, "UB_QF_1", CATALOGO);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.stringify(r.games)).toBe(
        JSON.stringify(t.bracket.slots["UB_QF_1"]!.series.games)
      );
    }
  });

  it("snapshot com torneio adulterado e recusado inteiro", async () => {
    const dir = await dirTemp();
    const bom = await snapshotValido(dir);

    // Metade 1: o mesmo objeto, intacto, carrega.
    await writeFile(join(dir, "room.json"), JSON.stringify(bom), "utf8");
    expect(await loadRoom(dir)).not.toBeNull();

    // Metade 2: mexeu SO no torneio, trocando por algo fora do
    // RoomTournamentSchema. O resto do envelope (version, room) continua
    // valido -- se isto ainda carregar, o schema do torneio nao esta sendo
    // conferido de verdade.
    await writeFile(
      join(dir, "room.json"),
      JSON.stringify({ ...bom, tournament: { wave: 99 } }),
      "utf8"
    );
    expect(await loadRoom(dir)).toBeNull();
  });

  it("sala sem torneio grava e restaura tournament como null", async () => {
    // Reforco: quem chama saveRoom sem passar tournament nenhum (main.ts, hoje)
    // nao pode fazer o schema explodir nem gravar uma chave ausente.
    const dir = await dirTemp();
    await saveRoom(dir, salaComUmJogador());
    const voltou = await loadRoom(dir);
    expect(voltou?.tournament).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// gravacao concorrente (M-3 da revisao final)
// -----------------------------------------------------------------------------

describe("gravacoes concorrentes nao disputam o mesmo temporario (M-3)", () => {
  it("cada gravacao ganha um temporario proprio", () => {
    // Com o nome fixo `${file}.tmp`, dois #commit da mesma volta do event loop
    // (o da onda e o do cache de timeline dentro do #gamesOutbound) abriam o
    // MESMO caminho com truncamento e os dois renomeavam. O tmp+rename protege
    // contra uma queda no meio da escrita, nao contra um segundo escritor -- o
    // resultado possivel e um room.json rasgado e a sala inteira sumindo no
    // reinicio.
    const dir = "/qualquer/lugar";
    const a = tempSnapshotPath(dir);
    const b = tempSnapshotPath(dir);

    expect(a).not.toBe(b);
    expect(a.endsWith(".tmp")).toBe(true);
    expect(b.endsWith(".tmp")).toBe(true);
    expect(a).not.toBe(roomSnapshotPath(dir));
  });

  it("duas gravacoes ao mesmo tempo deixam um snapshot inteiro e nenhum lixo", async () => {
    // Passa pelo GRAVADOR (a fila), nao por dois saveRoom crus, e a razao vale
    // ser escrita: dois `rename` concorrentes para o MESMO destino falham com
    // EPERM no Windows -- conferido, 5 de 5 execucoes, mesmo ja com os
    // temporarios separados. A primeira versao deste teste chamava os dois
    // saveRoom direto e passava por sorte de escalonamento; sob a suite inteira
    // ela caiu.
    //
    // Ou seja: as duas metades do M-3 resolvem problemas DIFERENTES e nenhuma
    // substitui a outra. O nome unico impede que dois escritores dividam o
    // arquivo intermediario; a fila impede que os dois renomeiem por cima um do
    // outro. E por isso que o main.ts nao chama saveRoom direto.
    const dir = await dirTemp();
    const gravar = criarGravadorDeSala(dir);

    await Promise.all([gravar(salaComUmJogador()), gravar(salaExemplo())]);

    expect(await loadRoom(dir)).not.toBeNull();
    expect((await readdir(dir)).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });
});

describe("fila serial de gravacao (M-3)", () => {
  it("a segunda tarefa so comeca depois de a primeira terminar", async () => {
    const fila = criarFilaSerial();
    const eventos: string[] = [];
    let soltarPrimeira = () => {};
    const travada = new Promise<void>((resolve) => {
      soltarPrimeira = resolve;
    });

    const primeira = fila(async () => {
      eventos.push("entra-1");
      await travada;
      eventos.push("sai-1");
    });
    const segunda = fila(async () => {
      eventos.push("entra-2");
    });

    // Sem serializacao, a segunda ja teria entrado aqui.
    await Promise.resolve();
    expect(eventos).toEqual(["entra-1"]);

    soltarPrimeira();
    await Promise.all([primeira, segunda]);
    expect(eventos).toEqual(["entra-1", "sai-1", "entra-2"]);
  });

  it("uma tarefa que falha nao trava a fila para sempre", async () => {
    // A falha tem que chegar a quem chamou (o main.ts registra no log), sem
    // deixar a fila presa numa promessa rejeitada: a sala continua viva e a
    // proxima mudanca precisa ser gravada do mesmo jeito.
    const fila = criarFilaSerial();
    await expect(fila(async () => Promise.reject(new Error("disco cheio")))).rejects.toThrow(
      "disco cheio"
    );

    const feitas: string[] = [];
    await fila(async () => {
      feitas.push("depois");
    });
    expect(feitas).toEqual(["depois"]);
  });

  it("o gravador da sala encadeia as gravacoes: a ultima enfileirada e a que fica no disco", async () => {
    const dir = await dirTemp();
    const gravar = criarGravadorDeSala(dir);
    const primeira = salaComUmJogador();
    const segunda = salaExemplo();

    await Promise.all([gravar(primeira), gravar(segunda)]);

    const lida = await loadRoom(dir);
    expect(lida?.players.map((p) => p.nickname)).toEqual(segunda.players.map((p) => p.nickname));
  });
});
