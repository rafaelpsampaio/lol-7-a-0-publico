import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createDraft,
  applyPick,
  autoPick,
  dealHand,
  currentSeat,
  currentSeatIndex,
  isFinished,
  roundNumber,
  remainingCards,
  handCards,
  toDraftWire,
  capTurnDeadline,
  turnDeadlineCap,
  incompleteSeats,
  takenCardIds,
  TURN_WALL_CLOCK_CAP,
  DraftStateSchema,
  type DraftState,
  type DraftSeat,
  type TurnBudget,
} from "./draft";
import { makeBase, makeCard } from "./cards.fixture";
import { SEATS, PICKS_PER_SEAT, DraftWireSchema } from "../protocol";
import { ALL_ROLES } from "../engine/schema";

const PLAYERS = makeBase(8);
const CHEIO: TurnBudget = (seat) => (seat.clientId === null ? null : 60_000);

function comHumanos(qtd: number, now = 0): DraftState {
  return createDraft({
    players: PLAYERS,
    humans: Array.from({ length: qtd }, (_, i) => ({
      clientId: `c${i}`,
      teamName: `Time ${i}`,
    })),
    seed: "semente-fixa",
    now,
    budget: CHEIO,
  });
}

/** Joga o draft inteiro escolhendo sempre a primeira carta da mao. */
function jogarTudo(state: DraftState, now = 0): DraftState {
  let atual = state;
  let guarda = 0;
  while (!isFinished(atual) && guarda++ < 100) {
    const cartas = handCards(atual, PLAYERS);
    if (cartas.length === 0) break;
    const r = applyPick(atual, PLAYERS, cartas[0]![1].id, now, CHEIO);
    expect(r.ok).toBe(true);
    if (!r.ok) break;
    atual = r.state;
  }
  return atual;
}

describe("createDraft", () => {
  it("monta 8 assentos completando com bots", () => {
    const d = comHumanos(2);
    expect(d.seats).toHaveLength(SEATS);
    expect(d.seats.filter((s) => s.clientId !== null)).toHaveLength(2);
    expect(d.seats.filter((s) => s.clientId === null)).toHaveLength(6);
  });

  it("nao da a um bot o nome de time de um humano", () => {
    const d = createDraft({
      players: PLAYERS,
      humans: [
        { clientId: "c0", teamName: "Dragões de Cristal" },
        { clientId: "c1", teamName: "Fúria Carmesim" },
      ],
      seed: "s",
      now: 0,
      budget: CHEIO,
    });
    const nomes = d.seats.map((s) => s.teamName);
    expect(new Set(nomes).size).toBe(SEATS);
  });

  it("a ordem e fixa: a volta 2 repete a volta 1 (Fase 8)", () => {
    const d = comHumanos(2);
    const volta1 = d.turns.slice(0, SEATS);
    const volta2 = d.turns.slice(SEATS, SEATS * 2);
    expect(volta2).toEqual(volta1);
    expect(d.turns).toHaveLength(SEATS * PICKS_PER_SEAT);
  });

  it("todo assento joga exatamente 5 vezes", () => {
    const d = comHumanos(3);
    for (let i = 0; i < SEATS; i++) {
      expect(d.turns.filter((t) => t === i)).toHaveLength(PICKS_PER_SEAT);
    }
  });

  it("a mesma semente da a mesma ordem; sementes diferentes nao", () => {
    const a = comHumanos(2).turns.slice(0, SEATS);
    const b = comHumanos(2).turns.slice(0, SEATS);
    expect(a).toEqual(b);
    const c = createDraft({
      players: PLAYERS,
      humans: [{ clientId: "c0", teamName: "T0" }, { clientId: "c1", teamName: "T1" }],
      seed: "outra-semente",
      now: 0,
      budget: CHEIO,
    }).turns.slice(0, SEATS);
    expect(c).not.toEqual(a);
  });

  it("ja tira a mao do primeiro assento", () => {
    const d = comHumanos(2);
    expect(handCards(d, PLAYERS)).toHaveLength(PICKS_PER_SEAT);
  });
});

describe("mao e baralho", () => {
  it("a primeira mao tem uma carta por rota e a quinta tem uma so", () => {
    let d = comHumanos(8);
    expect(handCards(d, PLAYERS)).toHaveLength(5);

    // faz o assento 0 chegar na ultima volta
    const primeiro = currentSeatIndex(d)!;
    let voltas = 0;
    let guarda = 0;
    while (voltas < 4 && guarda++ < 100) {
      const cartas = handCards(d, PLAYERS);
      const r = applyPick(d, PLAYERS, cartas[0]![1].id, 0, CHEIO);
      d = (r as { ok: true; state: DraftState }).state;
      if (currentSeatIndex(d) === primeiro) voltas++;
    }
    expect(voltas).toBe(4);
    expect(handCards(d, PLAYERS)).toHaveLength(1);
  });

  it("a carta escolhida sai do baralho para todos (A-01)", () => {
    const d = comHumanos(2);
    const antes = remainingCards(d, PLAYERS);
    const cartas = handCards(d, PLAYERS);
    const r = applyPick(d, PLAYERS, cartas[0]![1].id, 0, CHEIO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // sai so a carta, nao a pessoa inteira
    expect(remainingCards(r.state, PLAYERS)).toBe(antes - 1);
    expect(takenCardIds(r.state).has(cartas[0]![1].id)).toBe(true);
  });

  it("as cartas nao escolhidas voltam e podem aparecer para outro assento", () => {
    let d = comHumanos(8);
    const mao1 = handCards(d, PLAYERS).map(([, c]) => c.id);
    const escolhida = mao1[0]!;
    const r = applyPick(d, PLAYERS, escolhida, 0, CHEIO);
    d = (r as { ok: true; state: DraftState }).state;

    const devolvidas = mao1.slice(1);
    // nenhuma das devolvidas saiu do baralho
    for (const id of devolvidas) {
      expect(takenCardIds(d).has(id)).toBe(false);
    }
  });

  it("nenhuma carta aparece em dois times (A-01)", () => {
    const final = jogarTudo(comHumanos(2));
    const ids = final.seats.flatMap((s) =>
      ALL_ROLES.map((r) => s.picks[r]).filter((id): id is string => id !== undefined)
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("outra versao da mesma pessoa continua disponivel para outro time (A-01)", () => {
    const players = [
      makeCard({ id: "rafa-top-2018", personId: "rafa", primaryRole: "top" }),
      makeCard({ id: "rafa-top-2026", personId: "rafa", primaryRole: "top" }),
    ];
    const seats: DraftSeat[] = Array.from({ length: SEATS }, (_, i) => ({
      clientId: null,
      teamName: `T${i}`,
      picks: i === 0 ? { top: "rafa-top-2018" } : {},
      seenCardIds: [],
    }));
    const estado: DraftState = {
      seed: "a01-outra-versao",
      seats,
      turns: Array.from({ length: SEATS * PICKS_PER_SEAT }, () => 1),
      turnIndex: 0,
      hand: {},
      deadline: null,
      turnStartedAt: 0,
    };
    expect(dealHand(estado, players, 0, CHEIO).hand.top).toBe("rafa-top-2026");
  });

  it("a pessoa nao volta para o mesmo time em outra rota (A-01)", () => {
    const players = [
      makeCard({ id: "rafa-top", personId: "rafa", primaryRole: "top" }),
      makeCard({ id: "rafa-mid", personId: "rafa", primaryRole: "mid" }),
      makeCard({ id: "outro-mid", personId: "outro", primaryRole: "mid" }),
    ];
    const seats: DraftSeat[] = Array.from({ length: SEATS }, (_, i) => ({
      clientId: null,
      teamName: `T${i}`,
      picks: i === 0 ? { top: "rafa-top" } : {},
      seenCardIds: [],
    }));
    const estado: DraftState = {
      seed: "a01-mesmo-time",
      seats,
      turns: Array.from({ length: SEATS * PICKS_PER_SEAT }, () => 0),
      turnIndex: 0,
      hand: {},
      deadline: null,
      turnStartedAt: 0,
    };
    for (let i = 0; i < 20; i++) {
      const d = dealHand({ ...estado, turnIndex: i }, players, 0, CHEIO);
      expect(d.hand.mid, `turnIndex ${i}`).toBe("outro-mid");
    }
  });

  it("um draft inteiro fecha 8 rosters de 5 rotas", () => {
    const final = jogarTudo(comHumanos(2));
    expect(isFinished(final)).toBe(true);
    for (const seat of final.seats) {
      for (const role of ALL_ROLES) {
        expect(seat.picks[role], `${seat.teamName} sem ${role}`).toBeDefined();
      }
    }
  });
});

describe("applyPick", () => {
  it("recusa uma carta que nao esta na mao", () => {
    const d = comHumanos(2);
    const naMao = new Set(handCards(d, PLAYERS).map(([, c]) => c.id));
    const fora = PLAYERS.find((p) => !naMao.has(p.id))!;
    const r = applyPick(d, PLAYERS, fora.id, 0, CHEIO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("card_not_in_hand");
  });

  it("recusa um cardId inventado", () => {
    const r = applyPick(comHumanos(2), PLAYERS, "nao-existe", 0, CHEIO);
    expect(r.ok).toBe(false);
  });

  it("recusa depois que o draft acabou", () => {
    const final = jogarTudo(comHumanos(2));
    const r = applyPick(final, PLAYERS, PLAYERS[0]!.id, 0, CHEIO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("draft_over");
  });

  it("nao muta o estado anterior", () => {
    const d = comHumanos(2);
    const antes = JSON.stringify(d);
    applyPick(d, PLAYERS, handCards(d, PLAYERS)[0]![1].id, 0, CHEIO);
    expect(JSON.stringify(d)).toBe(antes);
  });

  it("passa a vez para o proximo assento da ordem", () => {
    const d = comHumanos(2);
    const antes = currentSeatIndex(d);
    const r = applyPick(d, PLAYERS, handCards(d, PLAYERS)[0]![1].id, 0, CHEIO);
    expect((r as { ok: true; state: DraftState }).state.turnIndex).toBe(d.turnIndex + 1);
    expect(currentSeatIndex((r as { ok: true; state: DraftState }).state)).not.toBe(antes);
  });
});

describe("relogio do turno", () => {
  it("assento de bot nao tem prazo", () => {
    const d = comHumanos(2, 1000);
    // avanca ate cair num bot
    let atual = d;
    while (currentSeat(atual)?.clientId !== null) {
      const r = applyPick(atual, PLAYERS, handCards(atual, PLAYERS)[0]![1].id, 1000, CHEIO);
      atual = (r as { ok: true; state: DraftState }).state;
    }
    expect(atual.deadline).toBeNull();
  });

  it("assento humano recebe now + orcamento", () => {
    const d = comHumanos(8, 5_000);
    expect(d.deadline).toBe(65_000);
  });

  it("o orcamento e consultado a cada turno, com o assento daquele turno (D-17)", () => {
    const vistos: (string | null)[] = [];
    const espiao: TurnBudget = (seat) => {
      vistos.push(seat.clientId);
      return 60_000;
    };
    let d = createDraft({
      players: PLAYERS,
      humans: Array.from({ length: 8 }, (_, i) => ({ clientId: `c${i}`, teamName: `T${i}` })),
      seed: "semente-fixa",
      now: 0,
      budget: espiao,
    });
    for (let i = 0; i < 3; i++) d = autoPick(d, PLAYERS, 0, espiao);

    expect(vistos).toHaveLength(4);
    // Assentos diferentes a cada turno: um orcamento calculado uma vez so daria
    // o mesmo prazo a quem esta online e a quem caiu.
    expect(new Set(vistos).size).toBe(4);
  });

  it("um orcamento curto encurta o prazo daquele assento", () => {
    const d = createDraft({
      players: PLAYERS,
      humans: Array.from({ length: 8 }, (_, i) => ({ clientId: `c${i}`, teamName: `T${i}` })),
      seed: "semente-fixa",
      now: 1_000,
      budget: () => 15_000,
    });
    expect(d.deadline).toBe(16_000);
  });
});

describe("autoPick", () => {
  it("escolhe uma carta e passa a vez", () => {
    const d = comHumanos(2);
    const depois = autoPick(d, PLAYERS, 0, CHEIO);
    expect(depois.turnIndex).toBe(d.turnIndex + 1);
    expect(takenCardIds(depois).size).toBe(1);
  });

  it("e deterministico para o mesmo estado", () => {
    const d = comHumanos(2);
    expect([...takenCardIds(autoPick(d, PLAYERS, 0, CHEIO))]).toEqual([
      ...takenCardIds(autoPick(d, PLAYERS, 0, CHEIO)),
    ]);
  });

  it("sozinho, fecha o draft inteiro", () => {
    let d = comHumanos(2);
    let guarda = 0;
    while (!isFinished(d) && guarda++ < 100) d = autoPick(d, PLAYERS, 0, CHEIO);
    expect(isFinished(d)).toBe(true);
  });

  it("com baralho insuficiente pula o turno em vez de travar", () => {
    // 8 times com base de 2 pessoas por rota: o baralho acaba no meio.
    const pobre = makeBase(2);
    let d = createDraft({
      players: pobre,
      humans: [{ clientId: "c0", teamName: "A" }],
      seed: "s",
      now: 0,
      budget: CHEIO,
    });
    let guarda = 0;
    while (!isFinished(d) && guarda++ < 100) d = autoPick(d, pobre, 0, CHEIO);
    expect(isFinished(d)).toBe(true);
  });
});

describe("roundNumber e toDraftWire", () => {
  it("a volta anda de 1 a 5", () => {
    let d = comHumanos(8);
    expect(roundNumber(d)).toBe(1);
    for (let i = 0; i < SEATS; i++) d = autoPick(d, PLAYERS, 0, CHEIO);
    expect(roundNumber(d)).toBe(2);
  });

  it("o fio nao carrega clientId e marca quem esta conectado (D-20)", () => {
    const d = comHumanos(2, 1_000);
    const fio = toDraftWire(d, PLAYERS, 1_500, new Set(["c0"]));
    expect(JSON.stringify(fio)).not.toContain("c0");
    expect(fio.seats.filter((s) => !s.isBot)).toHaveLength(2);
    expect(fio.seats.filter((s) => s.isBot).every((s) => s.connected)).toBe(true);
  });

  it("o fio manda tempo restante, nao instante absoluto (D-16)", () => {
    const d = comHumanos(8, 1_000);
    const fio = toDraftWire(d, PLAYERS, 31_000);
    expect(fio.turnMsRemaining).toBe(30_000);
  });

  it("tempo restante nunca fica negativo", () => {
    const d = comHumanos(8, 0);
    expect(toDraftWire(d, PLAYERS, 999_999).turnMsRemaining).toBe(0);
  });

  it("o fio passa pelo schema do protocolo", () => {
    const fio = toDraftWire(jogarTudo(comHumanos(2)), PLAYERS, 0);
    expect(DraftWireSchema.safeParse(fio).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cobertura de mutacao (revisao pos-Tarefa 5) — cada teste abaixo mata uma
// mutacao nomeada no relatorio: aplicar a mutacao correspondente tem que
// fazer o teste falhar.
// ---------------------------------------------------------------------------

describe("integridade completa via autoPick, varias sementes (A1)", () => {
  it("todo draft fecha as 40 vagas, 5 rotas por assento, sem pessoa repetida", () => {
    // jogarTudo/CHEIO sempre escolhem a primeira carta da mao: como todo
    // assento pega a mesma rota na mesma volta, o baralho esvazia na ordem
    // certa mesmo se `preenchidas` for ignorado em dealHand. autoPick usa o
    // peso do bot, entao expoe esse bug — e e o caminho real de todo bot e de
    // todo humano que estoura o relogio.
    const sementes = Array.from({ length: 10 }, (_, i) => `mutante-a1-${i}`);
    for (const semente of sementes) {
      let d = createDraft({
        players: PLAYERS,
        humans: [
          { clientId: "c0", teamName: "Time 0" },
          { clientId: "c1", teamName: "Time 1" },
        ],
        seed: semente,
        now: 0,
        budget: CHEIO,
      });
      let guarda = 0;
      while (!isFinished(d) && guarda++ < 100) d = autoPick(d, PLAYERS, 0, CHEIO);
      expect(isFinished(d), semente).toBe(true);

      let vagasPreenchidas = 0;
      const pessoas: string[] = [];
      for (const seat of d.seats) {
        for (const role of ALL_ROLES) {
          const id = seat.picks[role];
          expect(id, `${semente}: ${seat.teamName} sem ${role}`).toBeDefined();
          if (id !== undefined) {
            vagasPreenchidas++;
            pessoas.push(PLAYERS.find((p) => p.id === id)!.personId);
          }
        }
      }
      expect(vagasPreenchidas, semente).toBe(SEATS * PICKS_PER_SEAT);
      expect(new Set(pessoas).size, semente).toBe(pessoas.length);
    }
  });
});

describe("ordem fixa: toda volta usa a mesma sequencia sorteada (Fase 8)", () => {
  it("vale para as 5 voltas", () => {
    const d = comHumanos(8);
    const ordem = d.turns.slice(0, SEATS);
    for (let volta = 0; volta < PICKS_PER_SEAT; volta++) {
      const desdaVolta = d.turns.slice(volta * SEATS, volta * SEATS + SEATS);
      expect(desdaVolta, `volta ${volta + 1}`).toEqual(ordem);
    }
  });
});

describe("determinismo do sorteio da mao, nao so do resultado final (A3)", () => {
  it("duas simulacoes com a mesma semente tiram a mesma mao e o mesmo seenCardIds em todo turno", () => {
    const criar = () =>
      createDraft({
        players: PLAYERS,
        humans: [
          { clientId: "c0", teamName: "Time 0" },
          { clientId: "c1", teamName: "Time 1" },
        ],
        seed: "a3-determinismo",
        now: 0,
        budget: CHEIO,
      });
    let d1 = criar();
    let d2 = criar();
    let guarda = 0;
    while (!isFinished(d1) && guarda++ < 100) {
      expect(d1.hand).toEqual(d2.hand);
      expect(d1.seats.map((s) => s.seenCardIds)).toEqual(d2.seats.map((s) => s.seenCardIds));
      d1 = autoPick(d1, PLAYERS, 0, CHEIO);
      d2 = autoPick(d2, PLAYERS, 0, CHEIO);
    }
    expect([...takenCardIds(d1)]).toEqual([...takenCardIds(d2)]);
  });

  it("um estado restaurado via JSON.stringify/parse tira a mesma mao ao continuar (round-trip de snapshot)", () => {
    let d = comHumanos(3);
    for (let i = 0; i < 6 && !isFinished(d); i++) d = autoPick(d, PLAYERS, 0, CHEIO);
    expect(isFinished(d)).toBe(false);

    const restaurado = JSON.parse(JSON.stringify(d)) as DraftState;
    expect(restaurado).toEqual(d);

    const originalContinua = autoPick(d, PLAYERS, 0, CHEIO);
    const restauradoContinua = autoPick(restaurado, PLAYERS, 0, CHEIO);
    expect(restauradoContinua.hand).toEqual(originalContinua.hand);
    expect([...takenCardIds(restauradoContinua)]).toEqual([...takenCardIds(originalContinua)]);
  });
});

describe("colisao de nome de bot com humano, com semente que de fato colide (A4)", () => {
  it("nao da a um bot o nome de um humano quando a semente colocaria os dois nomes entre os bots", () => {
    // Semente escolhida por busca: sem o filtro de colisao, tanto "Dragões de
    // Cristal" quanto "Fúria Carmesim" cairiam nas seis primeiras posicoes do
    // pool de bots (identidades[1] e identidades[3] pra essa semente). A
    // semente "s" do teste original nao coloca nenhum dos dois nomes entre os
    // bots, entao remover o .filter la nao faz aquele teste piscar.
    const d = createDraft({
      players: PLAYERS,
      humans: [
        { clientId: "c0", teamName: "Dragões de Cristal" },
        { clientId: "c1", teamName: "Fúria Carmesim" },
      ],
      seed: "a4-colisao",
      now: 0,
      budget: CHEIO,
    });
    const nomes = d.seats.map((s) => s.teamName);
    expect(new Set(nomes).size).toBe(SEATS);
    const nomesDeBot = d.seats.filter((s) => s.clientId === null).map((s) => s.teamName);
    expect(nomesDeBot).not.toContain("Dragões de Cristal");
    expect(nomesDeBot).not.toContain("Fúria Carmesim");
  });
});

describe("semantica do campo order no fio, nao so o schema (A5)", () => {
  it("order tem SEATS entradas e e uma permutacao dos indices de assento", () => {
    const d = comHumanos(3);
    const fio = toDraftWire(d, PLAYERS, 0);
    expect(fio.order).toHaveLength(SEATS);
    expect([...fio.order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: SEATS }, (_, i) => i)
    );
  });
});

describe("soft-discard: carta mostrada e nao escolhida nao repete pro mesmo assento (A6)", () => {
  it("enquanto houver carta nova na rota, a mao seguinte do mesmo assento nao repete a que ja foi mostrada", () => {
    let d = comHumanos(8);
    const assento = currentSeatIndex(d)!;
    const mao1 = handCards(d, PLAYERS);
    const [roleEscolhida, cartaEscolhida] = mao1[0]!;
    const naoEscolhidas = mao1.filter(([role]) => role !== roleEscolhida);

    const r = applyPick(d, PLAYERS, cartaEscolhida.id, 0, CHEIO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = r.state;

    // avanca ate o mesmo assento jogar de novo (comeco da volta 2)
    let guarda = 0;
    while (currentSeatIndex(d) !== assento && guarda++ < 20) {
      d = autoPick(d, PLAYERS, 0, CHEIO);
    }
    expect(currentSeatIndex(d)).toBe(assento);

    const mao2 = handCards(d, PLAYERS);
    let comparacoesFeitas = 0;
    for (const [role, carta] of naoEscolhidas) {
      const naMao2 = mao2.find(([r]) => r === role);
      // com 8 pessoas por rota e so 8 assentos, sempre sobra carta nova pra
      // essa rota nesse ponto do draft — entao o par so fica sem comparacao
      // se a propria rota ja tiver fechado, o que nao acontece na volta 2.
      if (naMao2 === undefined) continue;
      comparacoesFeitas++;
      expect(naMao2[1].id, `rota ${role}`).not.toBe(carta.id);
    }
    expect(comparacoesFeitas).toBeGreaterThan(0);
  });

  it("seenCardIds acumula o historico de maos mostradas entre rodadas, nao so lembra a ultima", () => {
    // Teste complementar ao de cima: aquele mata a mutacao do lado da LEITURA
    // (o argumento de exclusao que generateRound recebe). Este mata a mutacao
    // do lado da ESCRITA — se `vistas` reiniciar do zero a cada dealHand em
    // vez de partir de seat.seenCardIds, o seenCardIds gravado no estado so
    // lembra a mao mais recente, e a diferenca so aparece depois de DUAS
    // rodadas (a primeira e identica com ou sem a mutacao, porque o historico
    // anterior comeca vazio de qualquer forma).
    let d = comHumanos(8);
    const assento = currentSeatIndex(d)!;
    const mao1Ids = handCards(d, PLAYERS).map(([, c]) => c.id);

    let r = applyPick(d, PLAYERS, mao1Ids[0]!, 0, CHEIO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = r.state;

    let guarda = 0;
    while (currentSeatIndex(d) !== assento && guarda++ < 20) d = autoPick(d, PLAYERS, 0, CHEIO);
    expect(currentSeatIndex(d)).toBe(assento);

    const mao2Ids = handCards(d, PLAYERS).map(([, c]) => c.id);
    r = applyPick(d, PLAYERS, mao2Ids[0]!, 0, CHEIO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = r.state;

    const vistasDepois = new Set(d.seats[assento]!.seenCardIds);
    for (const id of mao1Ids) expect(vistasDepois.has(id), `mao1: ${id}`).toBe(true);
    for (const id of mao2Ids) expect(vistasDepois.has(id), `mao2: ${id}`).toBe(true);
  });

  it("com so uma carta nova sobrando na rota, dealHand nunca reoferece a ja vista — deterministico, nao so provavel", () => {
    // Complementar aos dois de cima, mata especificamente a mutacao no
    // argumento que dealHand passa pro generateRound (o outro lugar do
    // arquivo com o mesmo texto `new Set(seat.seenCardIds)`). Construido pra
    // nao depender de sorte: com exatamente 2 candidatos elegiveis pra "top" e
    // 1 deles ja visto, o pool "fresco" do generateRound tem exatamente 1
    // carta — `pool[Math.floor(rng() * 1)]` da sempre indice 0, nao importa o
    // rng. Sem a exclusao (mutacao), o pool tem 2 cartas e o indice varia com
    // a semente, entao repetir com muitos turnIndex (muitas sementes
    // independentes) pega a mutacao quase certamente.
    const topA = makeCard({ id: "top-a", personId: "person-top-a", primaryRole: "top" });
    const topB = makeCard({ id: "top-b", personId: "person-top-b", primaryRole: "top" });
    const players = [topA, topB];

    const assentoAlvo: DraftSeat = {
      clientId: "c0",
      teamName: "Alvo",
      picks: { jungle: "x", mid: "x", adc: "x", support: "x" },
      seenCardIds: ["top-a"],
    };
    const outrosAssentos: DraftSeat[] = Array.from({ length: SEATS - 1 }, (_, i) => ({
      clientId: null,
      teamName: `Outro ${i}`,
      picks: {},
      seenCardIds: [],
    }));
    const seats = [assentoAlvo, ...outrosAssentos];
    const turns = Array.from({ length: 60 }, () => 0);
    const estadoBase: DraftState = {
      seed: "a6-generateround-arg",
      seats,
      turns,
      turnIndex: 0,
      hand: {},
      deadline: null,
      turnStartedAt: 0,
    };

    for (let i = 0; i < 60; i++) {
      const resultado = dealHand({ ...estadoBase, turnIndex: i }, players, 0, CHEIO);
      expect(resultado.hand.top, `turnIndex ${i}`).toBe("top-b");
    }
  });
});

describe("baralho insuficiente pelo caminho humano (A7 — comportamento conhecido)", () => {
  it("com a mao vazia por falta de baralho, applyPick fica recusando pra sempre; quem chama tem que cair pra autoPick (tarefa 7)", () => {
    const pobre = makeBase(2);
    let d = createDraft({
      players: pobre,
      humans: Array.from({ length: 8 }, (_, i) => ({ clientId: `c${i}`, teamName: `T${i}` })),
      seed: "a7-impasse",
      now: 0,
      budget: CHEIO,
    });

    let guarda = 0;
    while (handCards(d, pobre).length > 0 && guarda++ < 200) {
      const cartas = handCards(d, pobre);
      const r = applyPick(d, pobre, cartas[0]![1].id, 0, CHEIO);
      expect(r.ok).toBe(true);
      if (r.ok) d = r.state;
    }

    // a mao ficou vazia antes do draft acabar: o baralho nao alcanca pra 8
    // assentos com so 2 pessoas por rota
    expect(isFinished(d)).toBe(false);
    expect(handCards(d, pobre)).toHaveLength(0);

    // sem mao, nenhum cardId e aceito — o assento fica travado ate quem chama
    // recorrer a autoPick (que tem o desvio de mao vazia)
    const tentativa = applyPick(d, pobre, pobre[0]!.id, 0, CHEIO);
    expect(tentativa.ok).toBe(false);
    if (!tentativa.ok) expect(tentativa.code).toBe("card_not_in_hand");

    // autoPick resolve o impasse pulando o turno
    const depoisDeAutoPick = autoPick(d, pobre, 0, CHEIO);
    expect(depoisDeAutoPick.turnIndex).toBe(d.turnIndex + 1);
  });
});

describe("DraftStateSchema recusa estados fora do formato de um draft (B1, B2)", () => {
  it("recusa turns apontando pra um indice de assento que nao existe (B1)", () => {
    const d = comHumanos(2);
    const invalido = { ...d, turns: [...d.turns.slice(0, -1), 99] };
    expect(DraftStateSchema.safeParse(invalido).success).toBe(false);
  });

  it("recusa uma contagem de assentos diferente de SEATS (B2)", () => {
    const d = comHumanos(2);
    const invalido = { ...d, seats: d.seats.slice(0, 1) };
    expect(DraftStateSchema.safeParse(invalido).success).toBe(false);
  });

  it("recusa uma contagem de turnos diferente de SEATS * PICKS_PER_SEAT (B2)", () => {
    const d = comHumanos(2);
    const invalido = { ...d, turns: d.turns.slice(0, 1) };
    expect(DraftStateSchema.safeParse(invalido).success).toBe(false);
  });

  it("um estado com seats e turns vazios (antes 'passava' e isFinished dava true na hora) e recusado", () => {
    const invalido = {
      seed: "s",
      seats: [],
      turns: [],
      turnIndex: 0,
      hand: {},
      deadline: null,
    };
    expect(DraftStateSchema.safeParse(invalido).success).toBe(false);
  });
});

describe("teto de relogio de parede do turno (G-1 da revisao final)", () => {
  it("cada turno reancora turnStartedAt no instante em que comeca", () => {
    const d = comHumanos(8, 1_000);
    expect(d.turnStartedAt).toBe(1_000);

    const cartas = handCards(d, PLAYERS);
    const r = applyPick(d, PLAYERS, cartas[0]![1].id, 50_000, CHEIO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.turnStartedAt).toBe(50_000);
  });

  it("o teto e TURN_WALL_CLOCK_CAP vezes o turno cheio, contado do inicio do turno", () => {
    const d = comHumanos(8, 1_000);
    expect(turnDeadlineCap(d, 60_000)).toBe(1_000 + TURN_WALL_CLOCK_CAP * 60_000);
  });

  it("um prazo dentro do teto passa inteiro; um prazo alem dele e cortado", () => {
    const d = comHumanos(8, 0);
    // 30s depois do inicio, pedir mais 60s cabe embaixo do teto de 120s
    expect(capTurnDeadline(d, 90_000, 60_000)).toBe(90_000);
    // 100s depois do inicio, pedir mais 60s (160s) estoura o teto
    expect(capTurnDeadline(d, 160_000, 60_000)).toBe(120_000);
  });

  it("passado o teto, o prazo cortado sai no passado — e assim que ele vira autoPick", () => {
    const d = comHumanos(8, 0);
    const agora = 500_000;
    expect(capTurnDeadline(d, agora + 60_000, 60_000)).toBeLessThan(agora);
  });

  it("o prazo que o dealHand ja da nunca nasce acima do teto", () => {
    // Invariante que sustenta o corte no hub: se o proprio inicio do turno
    // pudesse passar do teto, o corte encurtaria turnos legitimos.
    const d = comHumanos(8, 7_777);
    expect(d.deadline).not.toBeNull();
    expect(d.deadline!).toBeLessThanOrEqual(turnDeadlineCap(d, 60_000));
  });
});

describe("incompleteSeats (m-6 da revisao final)", () => {
  it("um draft que fecha as 40 vagas nao tem assento incompleto", () => {
    const fim = jogarTudo(comHumanos(2));
    expect(isFinished(fim)).toBe(true);
    expect(incompleteSeats(fim)).toEqual([]);
  });

  it("com baralho insuficiente, os assentos que ficaram sem carta aparecem", () => {
    // Mesmo cenario do "pula o turno em vez de travar": com 2 pessoas por rota
    // o baralho acaba no meio e o autoPick pula turnos. O assento termina com
    // menos de PICKS_PER_SEAT cartas — e nada sinalizava isso.
    const pobre = makeBase(2);
    let d = createDraft({
      players: pobre,
      humans: [{ clientId: "c0", teamName: "A" }],
      seed: "s",
      now: 0,
      budget: CHEIO,
    });
    let guarda = 0;
    while (!isFinished(d) && guarda++ < 100) d = autoPick(d, pobre, 0, CHEIO);

    expect(isFinished(d)).toBe(true);
    expect(incompleteSeats(d).length).toBeGreaterThan(0);
  });
});

describe("draft.ts continua puro (Q6 da revisao)", () => {
  it("nao chama Date.now, new Date nem Math.random no fonte", () => {
    // Pureza do draft.ts e a base do desenho inteiro: determinismo (mesma
    // semente => mesmo draft), snapshot restauravel e teste sem abrir porta.
    // Ela e invisivel em runtime — nada quebra na hora se alguem introduzir
    // uma dessas chamadas — e so era vigiada por inspecao humana ate aqui.
    // Isso e um teste de arquitetura: le o fonte e falha se aparecer relogio
    // ou sorteio proprio, que tem que vir por parametro (now, rng) sempre.
    const caminho = fileURLToPath(new URL("./draft.ts", import.meta.url));
    const fonte = readFileSync(caminho, "utf-8");

    expect(fonte).not.toMatch(/Date\.now/);
    expect(fonte).not.toMatch(/new Date\(/);
    expect(fonte).not.toMatch(/Math\.random/);
  });
});
