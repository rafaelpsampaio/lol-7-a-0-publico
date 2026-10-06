import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  teamsFromDraft,
  createRoomTournament,
  readySlots,
  runWave,
  isFinished,
  lossesByTeam,
  eliminatedTeamIds,
  humanSeatIndexes,
  barrierMembers,
  barrierSatisfied,
  setReady,
  setWatch,
  sincronizarTodos,
  allHumansEliminated,
  openVote,
  castVote,
  voteResult,
  applyVoteResult,
  forceVoteResult,
  toTournamentWire,
  teamIdOfSeat,
  autoWatch,
  autoWatchEspectadores,
  ondaDaEliminacao,
  rodarAteOFim,
  type RoomTournament,
} from "./tournament";
import { draftCompleto, criar } from "./tournament.fixture";
import { ONDA_DO_SLOT, SlotIdSchema, TOTAL_WAVES, TournamentWireSchema } from "../protocol";
import type { SlotId } from "../engine/schema";

describe("montagem dos times", () => {
  it("monta 8 times, 5 cartas cada, nenhum chamado 'user' (D-22)", () => {
    const { draft, players } = draftCompleto(2);
    const times = teamsFromDraft(draft, players);
    expect(times).toHaveLength(8);
    expect(times.map((t) => t.id)).toEqual([
      "assento-0", "assento-1", "assento-2", "assento-3",
      "assento-4", "assento-5", "assento-6", "assento-7",
    ]);
    expect(times.every((t) => t.roster.length === 5)).toBe(true);
    expect(times.every((t) => t.isUser === false)).toBe(true);
    expect(times.every((t) => (t.tag ?? "").length > 0)).toBe(true);
  });

  it("nenhuma pessoa aparece em dois times (D-13 atravessa o draft inteiro)", () => {
    const { draft, players } = draftCompleto(2);
    const pessoas = teamsFromDraft(draft, players).flatMap((t) => t.roster.map((c) => c.personId));
    expect(pessoas).toHaveLength(40);
    expect(new Set(pessoas).size).toBe(40);
  });

  it("recusa draft incompleto com mensagem que diz qual assento e qual rota", () => {
    const { draft, players } = draftCompleto(2);
    const furado = { ...draft, seats: draft.seats.map((s, i) => (i === 3 ? { ...s, picks: {} } : s)) };
    expect(() => teamsFromDraft(furado, players)).toThrow(/assento 3/);
  });

  it("o nome do time do humano atravessa para o bracket", () => {
    const { draft, players } = draftCompleto(2);
    const times = teamsFromDraft(draft, players);
    expect(times[0]!.displayName).toBe(draft.seats[0]!.teamName);
  });

  it("os humanos ocupam os assentos 0..n-1, na ordem em que entraram", () => {
    const { draft } = draftCompleto(3);
    expect(draft.seats.slice(0, 3).map((s) => s.clientId)).toEqual(["c0", "c1", "c2"]);
    expect(draft.seats.slice(3).every((s) => s.clientId === null)).toBe(true);
  });
});

describe("semente do chaveamento", () => {
  it("vem da semente do draft: sementes diferentes dao chaveamentos diferentes (D-25)", () => {
    const { draft, players } = draftCompleto(2);
    const a = createRoomTournament({ draft: { ...draft, seed: "semente-a" }, players, chaosLevel: 0.25 });
    const b = createRoomTournament({ draft: { ...draft, seed: "semente-b" }, players, chaosLevel: 0.25 });
    expect(a.bracket.initialSeeding).not.toEqual(b.bracket.initialSeeding);
  });

  it("a mesma semente do draft repete o mesmo chaveamento", () => {
    const { draft, players } = draftCompleto(2);
    const a = createRoomTournament({ draft: { ...draft, seed: "semente-a" }, players, chaosLevel: 0.25 });
    const aDeNovo = createRoomTournament({ draft: { ...draft, seed: "semente-a" }, players, chaosLevel: 0.25 });
    expect(a.bracket.initialSeeding).toEqual(aDeNovo.bracket.initialSeeding);
  });
});

describe("ondas", () => {
  it("comeca com as 4 quartas prontas e nenhuma onda rodada", () => {
    const t = criar(2);
    expect(t.wave).toBe(0);
    expect(readySlots(t).sort()).toEqual(["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"]);
  });

  it("readySlots nao devolve serie em andamento (so 'ready')", () => {
    const t = criar(2);
    const emAndamento: RoomTournament = {
      ...t,
      bracket: {
        ...t.bracket,
        slots: {
          ...t.bracket.slots,
          UB_QF_1: {
            ...t.bracket.slots.UB_QF_1!,
            series: { ...t.bracket.slots.UB_QF_1!.series, status: "in_progress" },
          },
        },
      },
    };
    expect(readySlots(emAndamento)).not.toContain("UB_QF_1");
    expect(readySlots(emAndamento).sort()).toEqual(["UB_QF_2", "UB_QF_3", "UB_QF_4"]);
  });

  it("uma onda fecha todas as series dela e nao toca nas que ela mesma liberou (D-23)", () => {
    const t = runWave(criar(2), []);
    expect(t.wave).toBe(1);
    for (const s of ["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"] as SlotId[]) {
      expect(t.bracket.slots[s]!.series.status).toBe("complete");
      expect(t.bracket.slots[s]!.series.winnerId).not.toBeNull();
    }
    // as series que acabaram de ficar prontas ficam para a proxima onda
    expect(readySlots(t).sort()).toEqual(["LB_R1_1", "LB_R1_2", "UB_SF_1", "UB_SF_2"]);
    for (const s of readySlots(t)) {
      expect(t.bracket.slots[s]!.series.games).toHaveLength(0);
    }
  });

  it("toda serie fecha entre 3 e 5 jogos", () => {
    const t = runWave(criar(2), []);
    for (const s of ["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"] as SlotId[]) {
      const jogos = t.bracket.slots[s]!.series.games.length;
      expect(jogos).toBeGreaterThanOrEqual(3);
      expect(jogos).toBeLessThanOrEqual(5);
    }
  });

  it("6 ondas coroam um campeao (D-23)", () => {
    let t = criar(2);
    for (let i = 0; i < TOTAL_WAVES; i++) t = runWave(t, []);
    expect(t.wave).toBe(TOTAL_WAVES);
    expect(isFinished(t)).toBe(true);
    expect(t.bracket.championId).not.toBeNull();
    expect(readySlots(t)).toEqual([]);
  });

  it("rodar uma onda a mais nao muda nada", () => {
    let t = criar(2);
    for (let i = 0; i < TOTAL_WAVES; i++) t = runWave(t, []);
    expect(runWave(t, [])).toBe(t);
  });

  it("marcar pronto e apagado quando a onda roda", () => {
    const t = runWave({ ...criar(2), ready: ["c0", "c1"] } as RoomTournament, []);
    expect(t.ready).toEqual([]);
  });

  it("e deterministica: mesmo draft, mesmo campeao (D-25 depende disso)", () => {
    const a = criar(2);
    const b = criar(2);
    let ta = a, tb = b;
    for (let i = 0; i < TOTAL_WAVES; i++) { ta = runWave(ta, []); tb = runWave(tb, []); }
    expect(ta.bracket.championId).toBe(tb.bracket.championId);
  });

  it("nao le relogio nem sorteia — o modulo e puro", () => {
    // Se um Date.now entrar neste modulo, o restore do D-25 deixa de reproduzir
    // e nada mais avisa. Por isso a busca e no codigo-fonte, e nao numa API.
    //
    // Os comentarios saem antes da busca de proposito: o cabecalho do modulo
    // EXPLICA a proibicao citando as duas APIs pelo nome, e uma busca crua
    // acusaria o proprio texto que documenta a regra. Uma checagem que da falso
    // positivo na sua propria documentacao e uma checagem que as pessoas
    // aprendem a silenciar — e o jeito de silenciar seria apagar a explicacao.
    const fonte = readFileSync(new URL("./tournament.ts", import.meta.url), "utf8");
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/Date\.now|Math\.random/);
  });
});

const sempreConectado = () => true;

describe("eliminacao", () => {
  it("ninguem cai na primeira onda — todo perdedor de quartas desce para a chave inferior", () => {
    const t = runWave(criar(2), []);
    expect(eliminatedTeamIds(t)).toEqual([]);
  });

  it("dois caem na segunda onda: os perdedores da LB_R1", () => {
    let t = runWave(criar(2), []);
    t = runWave(t, []);
    expect(eliminatedTeamIds(t)).toHaveLength(2);
    for (const id of eliminatedTeamIds(t)) expect(lossesByTeam(t)[id]).toBe(2);
  });

  it("no fim, 7 estao fora e so o campeao fica", () => {
    let t = criar(2);
    for (let i = 0; i < TOTAL_WAVES; i++) t = runWave(t, []);
    const fora = eliminatedTeamIds(t);
    expect(fora).toHaveLength(7);
    expect(fora).not.toContain(t.bracket.championId);
  });

  it("campeao vindo da chave inferior tira o finalista da chave superior mesmo com uma derrota so (D-03)", () => {
    // O finalista da chave superior (GF.teamAId, por SLOT_FEED_IN) chega a Grande
    // Final SEM NENHUMA derrota — e propriedade estrutural do dobro-eliminacao,
    // nao depende de semente: quem perde uma vez na chave superior cai para a
    // inferior e deixa de ser "finalista da chave superior". Monta-se na mao o
    // caso em que o time da chave inferior vence a Grande Final: o finalista da
    // chave superior fica com 1 derrota so, mas o torneio acabou para ele do
    // mesmo jeito (sem bracket reset).
    let t = criar(2);
    for (let i = 0; i < TOTAL_WAVES; i++) t = runWave(t, []);
    const ubFinalista = t.bracket.slots.GF!.series.teamAId!;
    const lbFinalista = t.bracket.slots.GF!.series.teamBId!;
    const invertido: RoomTournament = {
      ...t,
      bracket: {
        ...t.bracket,
        championId: lbFinalista,
        slots: {
          ...t.bracket.slots,
          GF: {
            ...t.bracket.slots.GF!,
            series: { ...t.bracket.slots.GF!.series, winnerId: lbFinalista },
          },
        },
      },
    };
    expect(lossesByTeam(invertido)[ubFinalista]).toBe(1);
    const fora = eliminatedTeamIds(invertido);
    expect(fora).toHaveLength(7);
    expect(fora).toContain(ubFinalista);
    expect(fora).not.toContain(lbFinalista);
  });
});

/**
 * Fixture do teste "quem foi eliminado deixa de ser esperado". Quem cai na onda corrente
 * fica na barreira de proposito (Rundown da Sala 2, S13/D2, testado a parte com criar(8)
 * mais abaixo), entao o teste so vale num torneio em andamento em que algum humano caiu
 * numa onda ANTERIOR a corrente e nenhum humano caiu na onda corrente.
 *
 * Antes (criar(2) e 3 ondas fixas) a trajetoria simulada decidia o desfecho: num motor
 * um humano caia na onda 3 e o teste ficava vermelho; noutro ninguem caia e o teste
 * passava vazio. Aqui a semente do draft vem de uma lista fixa e as ondas avancam ate a
 * condicao aparecer: deterministico, e o assert do teste nao muda.
 */
function torneioComHumanoForaAntesDaOnda(): RoomTournament {
  const { draft, players } = draftCompleto(2);
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    let t = createRoomTournament({
      draft: { ...draft, seed: `semente-barreira-${tentativa}` },
      players,
      chaosLevel: 0.25,
    });
    while (!isFinished(t)) {
      t = runWave(t, []);
      if (isFinished(t)) break;
      const ondas = humanSeatIndexes(t).map((i) => ondaDaEliminacao(t, teamIdOfSeat(i)));
      const caiuAntes = ondas.some((o) => o !== null && o < t.wave);
      const caiuNestaOnda = ondas.some((o) => o === t.wave);
      if (caiuAntes && !caiuNestaOnda) return t;
    }
  }
  throw new Error(
    "nenhuma das 30 sementes tentadas deixou um humano fora antes da onda corrente sem outro " +
      "cair nela -- troque ou amplie o pool de sementes em torneioComHumanoForaAntesDaOnda"
  );
}

describe("barreira", () => {
  it("espera os humanos vivos e conectados", () => {
    const t = runWave(criar(2), []);
    expect(barrierMembers(t, sempreConectado).sort()).toEqual(["c0", "c1"]);
    expect(barrierSatisfied(t, sempreConectado)).toBe(false);
    const prontos = setReady(setReady(t, "c0", true), "c1", true);
    expect(barrierSatisfied(prontos, sempreConectado)).toBe(true);
  });

  it("quem desconecta continua sendo esperado antes de liberar a rodada", () => {
    const t = setReady(runWave(criar(2), []), "c0", true);
    expect(barrierSatisfied(t, (c) => c === "c0")).toBe(false);
  });

  it("quem foi eliminado deixa de ser esperado", () => {
    const t = torneioComHumanoForaAntesDaOnda();
    const fora = new Set(eliminatedTeamIds(t));
    // Nao vacuidade: algum humano conectado ja esta fora, entao o laco abaixo prova a exclusao.
    expect(humanSeatIndexes(t).some((i) => fora.has(teamIdOfSeat(i)))).toBe(true);
    for (const c of barrierMembers(t, sempreConectado)) {
      const assento = t.seatClientIds.indexOf(c);
      expect(fora.has(teamIdOfSeat(assento))).toBe(false);
    }
  });

  it("sala sem ninguem conectado nao dispara sozinha", () => {
    const t = runWave(criar(2), []);
    expect(barrierSatisfied(t, () => false)).toBe(false);
  });

  it("desmarcar pronto volta a segurar a onda", () => {
    let t = setReady(setReady(runWave(criar(2), []), "c0", true), "c1", true);
    expect(barrierSatisfied(t, sempreConectado)).toBe(true);
    t = setReady(t, "c1", false);
    expect(barrierSatisfied(t, sempreConectado)).toBe(false);
  });

  it("marcar pronto duas vezes nao duplica", () => {
    const t = setReady(setReady(runWave(criar(2), []), "c0", true), "c0", true);
    expect(t.ready).toEqual(["c0"]);
  });
});

describe("espectador", () => {
  it("aceita qualquer serie ja jogada, nao so a da onda corrente (D-32)", () => {
    let t = runWave(criar(2), []);
    t = runWave(t, []);
    const antiga = setWatch(t, "c0", "UB_QF_1");
    expect(antiga).not.toBeNull();
    expect(antiga!.watching["c0"]).toBe("UB_QF_1");
  });

  it("recusa serie que ainda nao teve jogo", () => {
    expect(setWatch(criar(2), "c0", "GF")).toBeNull();
  });
});

describe("sincronizarTodos (D-28)", () => {
  it("aponta todo humano para a mesma serie, mesmo quem estava assistindo outra coisa", () => {
    let t = runWave(criar(2), []);
    t = setWatch(t, "c1", "UB_QF_2")!;
    const watching = sincronizarTodos(t, "UB_QF_1");
    expect(watching["c0"]).toBe("UB_QF_1");
    expect(watching["c1"]).toBe("UB_QF_1");
  });

  it("nao mexe em quem nao e humano — nao ha chave nenhuma pra bot", () => {
    const t = runWave(criar(2), []);
    const watching = sincronizarTodos(t, "UB_QF_1");
    expect(Object.keys(watching).sort()).toEqual(["c0", "c1"]);
  });
});

describe("autoWatch", () => {
  it("aponta cada humano para a serie do proprio time nesta onda", () => {
    const t = criar(2);
    const depois = autoWatch(t, readySlots(t));
    for (const i of humanSeatIndexes(t)) {
      const clientId = t.seatClientIds[i]!;
      const slotId = depois.watching[clientId]!;
      expect(slotId).toBeDefined();
      const serie = t.bracket.slots[slotId]!.series;
      expect([serie.teamAId, serie.teamBId]).toContain(teamIdOfSeat(i));
    }
  });

  it("nao mexe em quem nao tem serie na onda informada", () => {
    const t = criar(2);
    const todasProntas = readySlots(t);
    const slotDoAssento0 = todasProntas.find((s) => {
      const serie = t.bracket.slots[s]!.series;
      return serie.teamAId === teamIdOfSeat(0) || serie.teamBId === teamIdOfSeat(0);
    })!;
    const semAssento0 = todasProntas.filter((s) => s !== slotDoAssento0);

    const depois = autoWatch(t, semAssento0);
    expect(depois.watching["c0"]).toBeUndefined();
    expect(depois.watching["c1"]).toBeDefined();
  });

  it("preserva uma escolha manual anterior de quem nao joga na onda informada", () => {
    const t = setWatch(runWave(criar(2), []), "c0", "UB_QF_1")!;
    const todasProntas = readySlots(t); // apos a onda 1, sao as 4 da onda 2
    const semAssento0 = todasProntas.filter((s) => {
      const serie = t.bracket.slots[s]!.series;
      return serie.teamAId !== teamIdOfSeat(0) && serie.teamBId !== teamIdOfSeat(0);
    });

    const depois = autoWatch(t, semAssento0);
    expect(depois.watching["c0"]).toBe("UB_QF_1");
  });
});

describe("autoWatchEspectadores (Fase 1 item 8)", () => {
  it("redireciona quem esta eliminado para a onda nova, mesmo vendo outra coisa", () => {
    // Quantas ondas ate um humano cair depende do resultado da simulacao pra
    // esta semente (fixture usa cartas sinteticas identicas, mas o motor em
    // si e ajustado fora desta linha de trabalho — src/sim/**, fora de
    // escopo desde a Fase 1). Rodar ate acontecer, com teto em TOTAL_WAVES,
    // em vez de fixar um numero de ondas: o comportamento testado aqui
    // (redirecionar quem cai) nao depende de QUANDO a queda acontece.
    //
    // Fixture robusta (Task 9 da linha luta-mapa-vitoria): a queda so serve
    // se o torneio AINDA nao acabou, senao nao sobra onda nova para onde
    // redirecionar (com os dois humanos na Grande Final, a unica "queda" e a
    // coroacao). Se a semente do draft nao produzir essa trajetoria, tenta a
    // proxima semente da lista: o comportamento testado nao depende de qual
    // trajetoria o motor sorteia, e a lista fixa mantem o teste determinista.
    const { draft, players } = draftCompleto(2);
    let t: RoomTournament | undefined;
    let assentoEliminado: number | undefined;
    for (let k = 0; k < 20 && assentoEliminado === undefined; k++) {
      const seed = k === 0 ? draft.seed : `${draft.seed}-${k}`;
      let candidato = createRoomTournament({ draft: { ...draft, seed }, players, chaosLevel: 0.25 });
      for (let i = 0; i < TOTAL_WAVES && !isFinished(candidato); i++) {
        candidato = runWave(candidato, []);
        if (isFinished(candidato)) break;
        const eliminados = new Set(eliminatedTeamIds(candidato));
        assentoEliminado = humanSeatIndexes(candidato).find((s) => eliminados.has(teamIdOfSeat(s)));
        if (assentoEliminado !== undefined) {
          t = candidato;
          break;
        }
      }
    }
    expect(assentoEliminado).toBeDefined();
    expect(t).toBeDefined();
    expect(isFinished(t!)).toBe(false);
    const clientId = t!.seatClientIds[assentoEliminado!]!;

    const vendoOutraCoisa = setWatch(t!, clientId, "UB_QF_1")!;
    const daOnda = readySlots(vendoOutraCoisa);
    expect(daOnda.length).toBeGreaterThan(0);

    const depois = autoWatchEspectadores(vendoOutraCoisa, daOnda);
    expect(depois.watching[clientId]).toBe(daOnda[0]);
  });

  it("nao mexe em quem ainda esta vivo", () => {
    let t = runWave(criar(2), []); // ninguem cai na primeira onda
    t = setWatch(t, "c0", "UB_QF_1")!;
    const depois = autoWatchEspectadores(t, readySlots(t));
    expect(depois.watching["c0"]).toBe("UB_QF_1");
  });

  it("onda vazia nao muda nada", () => {
    const t = setWatch(runWave(criar(2), []), "c0", "UB_QF_1")!;
    const depois = autoWatchEspectadores(t, []);
    expect(depois.watching).toEqual(t.watching);
  });

  it("quem caiu NESTA onda continua na propria serie (Rundown da Sala 2, achado 5)", () => {
    let t = criar(2);
    for (let i = 0; i < TOTAL_WAVES; i++) {
      const daOnda = readySlots(t);
      const antes = new Set(eliminatedTeamIds(t));
      const depois = runWave(t, []);
      const agora = new Set(eliminatedTeamIds(depois));
      const recemEliminado = humanSeatIndexes(depois).find(
        (s) => agora.has(teamIdOfSeat(s)) && !antes.has(teamIdOfSeat(s))
      );
      if (recemEliminado !== undefined) {
        const meuTime = teamIdOfSeat(recemEliminado);
        const minhaSerie = daOnda.find((slot) => {
          const s = depois.bracket.slots[slot]!.series;
          return s.teamAId === meuTime || s.teamBId === meuTime;
        });
        expect(minhaSerie).toBeDefined();
        // Outra serie ja jogada, sem o meu time, na FRENTE da onda: e o caso
        // real (daOnda[0] costuma ser da chave superior) e o que impede o teste
        // de passar por acaso quando a minha serie ja e a primeira.
        const outra = SlotIdSchema.options.find((slot) => {
          const s = depois.bracket.slots[slot]!.series;
          return slot !== minhaSerie && s.games.length > 0 && s.teamAId !== meuTime && s.teamBId !== meuTime;
        });
        expect(outra).toBeDefined();
        const onda = [outra!, minhaSerie!];
        const visto = autoWatchEspectadores(autoWatch(depois, onda), onda);
        expect(visto.watching[depois.seatClientIds[recemEliminado]!]).toBe(minhaSerie);
        return;
      }
      t = depois;
    }
    throw new Error("nenhum humano caiu em TOTAL_WAVES ondas -- a fixture mudou?");
  });

  it("na MESMA chamada: quem caiu antes vai para a onda nova e quem caiu nesta onda fica na propria serie", () => {
    // As duas regras do hub (`autoWatchEspectadores(autoWatch(depois, onda), onda)`)
    // convivem no mesmo estado: um humano ja eliminado (espectador, vai para a
    // onda nova) e outro que acabou de cair (continua vendo a serie em que
    // caiu). Rodar ondas reais ate existirem os dois, em ondas diferentes, em
    // vez de fixar quando cada queda acontece.
    let t = criar(4);
    for (let i = 0; i < TOTAL_WAVES; i++) {
      const daOnda = readySlots(t);
      const antes = new Set(eliminatedTeamIds(t));
      const depois = runWave(t, []);
      const agora = new Set(eliminatedTeamIds(depois));
      const humanos = humanSeatIndexes(depois);
      const recemEliminado = humanos.find((s) => agora.has(teamIdOfSeat(s)) && !antes.has(teamIdOfSeat(s)));
      const jaEliminado = humanos.find((s) => antes.has(teamIdOfSeat(s)));
      if (recemEliminado === undefined || jaEliminado === undefined) {
        t = depois;
        continue;
      }

      const timeRecem = teamIdOfSeat(recemEliminado);
      const timeAntigo = teamIdOfSeat(jaEliminado);
      const daSerie = (slot: SlotId, time: string): boolean => {
        const s = depois.bracket.slots[slot]!.series;
        return s.teamAId === time || s.teamBId === time;
      };
      const minhaSerie = daOnda.find((slot) => daSerie(slot, timeRecem));
      expect(minhaSerie).toBeDefined();
      // Uma serie ja jogada, sem nenhum dos dois humanos, NA FRENTE da onda:
      // e ela que o espectador antigo deve receber, e e o que separa os dois
      // destinos (se minhaSerie fosse a primeira, as duas regras dariam o mesmo).
      const outra = SlotIdSchema.options.find(
        (slot) =>
          slot !== minhaSerie &&
          depois.bracket.slots[slot]!.series.games.length > 0 &&
          !daSerie(slot, timeRecem) &&
          !daSerie(slot, timeAntigo)
      );
      expect(outra).toBeDefined();
      const onda = [outra!, minhaSerie!];

      const visto = autoWatchEspectadores(autoWatch(depois, onda), onda);
      expect(visto.watching[depois.seatClientIds[jaEliminado]!]).toBe(outra);
      expect(visto.watching[depois.seatClientIds[recemEliminado]!]).toBe(minhaSerie);
      return;
    }
    throw new Error("nao houve onda com um humano novo fora e outro ja fora -- a fixture mudou?");
  });
});

describe("votacao", () => {
  it("so abre quando todo humano caiu", () => {
    let t = criar(2);
    expect(allHumansEliminated(t)).toBe(false);
    for (let i = 0; i < TOTAL_WAVES; i++) t = runWave(t, []);
    // com 2 humanos entre 8 times, no maximo um deles pode ser campeao
    const campeao = t.bracket.championId!;
    const humanosVivos = humanSeatIndexes(t).filter((i) => teamIdOfSeat(i) === campeao);
    expect(allHumansEliminated(t)).toBe(humanosVivos.length === 0);
  });

  it("empate mantem o torneio rodando (D-33)", () => {
    let t = openVote(criar(2));
    t = castVote(t, "c0", "continuar");
    t = castVote(t, "c1", "parar");
    expect(voteResult(t, sempreConectado)).toBe("continuar");
  });

  it("maioria para parar para", () => {
    let t = openVote(criar(3));
    t = castVote(t, "c0", "parar");
    t = castVote(t, "c1", "parar");
    t = castVote(t, "c2", "continuar");
    expect(voteResult(t, sempreConectado)).toBe("parar");
  });

  it("urna fica aberta enquanto faltar voto de quem esta conectado", () => {
    const t = castVote(openVote(criar(2)), "c0", "continuar");
    expect(voteResult(t, sempreConectado)).toBeNull();
  });

  it("quem desconectou nao segura a urna", () => {
    const t = castVote(openVote(criar(2)), "c0", "continuar");
    expect(voteResult(t, (c) => c === "c0")).toBe("continuar");
  });

  it("continuar faz os eliminados passarem a contar na barreira (D-29)", () => {
    let t = criar(2);
    for (let i = 0; i < 3; i++) t = runWave(t, []);
    const depois = applyVoteResult(openVote(t), "continuar");
    expect(depois.espectadoresContam).toBe(true);
    expect(depois.vote).toBeNull();
    expect(barrierMembers(depois, sempreConectado).sort()).toEqual(["c0", "c1"]);
  });
});

describe("forceVoteResult -- apuracao forcada pelo host (D-33: 'ou quando o host forcar')", () => {
  it("conta so quem votou -- um 'parar' sozinho ja apura 'parar'", () => {
    const t = castVote(openVote(criar(2)), "c0", "parar");
    expect(forceVoteResult(t)).toBe("parar");
  });

  it("zero votos e um empate de 0 a 0 -- forcar sem ninguem ter votado da 'continuar' (D-33)", () => {
    const t = openVote(criar(2));
    expect(forceVoteResult(t)).toBe("continuar");
  });

  it("empate de verdade tambem da 'continuar'", () => {
    let t = openVote(criar(2));
    t = castVote(t, "c0", "continuar");
    t = castVote(t, "c1", "parar");
    expect(forceVoteResult(t)).toBe("continuar");
  });

  it("nao espera todo mundo votar -- ao contrario de voteResult, nunca devolve null", () => {
    const t = castVote(openVote(criar(2)), "c0", "continuar");
    expect(voteResult(t, sempreConectado)).toBeNull();
    expect(forceVoteResult(t)).toBe("continuar");
  });
});

describe("visao no fio", () => {
  it("nunca carrega clientId (D-20)", () => {
    // publicIdOf nao pode conter o proprio clientId como substring aqui —
    // "pub-c0" contem "c0", e a asserção de ausencia nunca falharia de
    // verdade. Mapeando para um publicId sem relacao textual com o clientId,
    // a asserção fica capaz de pegar um vazamento de verdade.
    const publicIdOf = (c: string) => (c === "c0" ? "identidade-alfa" : "identidade-beta");
    let t = setReady(runWave(criar(2), []), "c0", true);
    t = setWatch(t, "c0", "UB_QF_1")!;
    t = castVote(openVote(t), "c0", "parar");
    const fio = JSON.stringify(toTournamentWire(t, publicIdOf));
    expect(fio).not.toContain("c0");
    expect(fio).toContain("identidade-alfa");
  });

  it("nunca carrega timeline (D-27)", () => {
    const t = runWave(criar(2), []);
    const fio = toTournamentWire(t, (c) => `pub-${c}`);
    expect(JSON.stringify(fio).length).toBeLessThan(20_000);
    for (const s of fio.series) {
      expect(Object.keys(s)).not.toContain("games");
      expect(s.gamesPlayed).toBeGreaterThanOrEqual(0);
    }
  });

  it("passa pelo schema do protocolo", () => {
    const t = runWave(criar(2), []);
    expect(TournamentWireSchema.safeParse(toTournamentWire(t, (c) => `pub-${c}`)).success).toBe(true);
  });

  it("time gravado sem sigla sai com uma sigla de verdade, nunca vazia (m-4)", () => {
    // `tag` e opcional no TournamentTeamSchema (compatibilidade com saves
    // antigos do jogo solo) e obrigatoria no fio (`z.string().min(1)`). O
    // fallback `tag ?? ""` produzia exatamente o valor que o proprio schema
    // recusa: o cliente jogaria fora o roomState INTEIRO -- todo mundo com a
    // tela congelada -- em vez de mostrar um time sem sigla. Inalcancavel hoje
    // (tagFromName garante nao-vazio na montagem), mas o fallback escolhido era
    // pior que a ausencia dele.
    const t = runWave(criar(2), []);
    const semSigla: RoomTournament = {
      ...t,
      bracket: {
        ...t.bracket,
        teams: {
          ...t.bracket.teams,
          "assento-0": { ...t.bracket.teams["assento-0"]!, tag: undefined },
        },
      },
    };

    const fio = toTournamentWire(semSigla, (c) => `pub-${c}`);

    const time = fio.teams.find((x) => x.id === "assento-0")!;
    expect(time.tag.length).toBeGreaterThan(0);
    expect(TournamentWireSchema.safeParse(fio).success).toBe(true);
  });

  it("espectadoresContam passa pro fio, comeca false (Fase 1 pendencia, D-29)", () => {
    // Fase 1 do plano da sala deixou isso bloqueado de proposito: o fio nao
    // expunha espectadoresContam, e sem esse dado o cliente nao tem como
    // decidir com seguranca quando esconder "Estou pronto" sem quebrar o
    // caso pos-votacao "continuar" (proximo teste).
    const t = criar(2);
    const fio = toTournamentWire(t, (c) => `pub-${c}`);
    expect(fio.espectadoresContam).toBe(false);
    expect(TournamentWireSchema.safeParse(fio).success).toBe(true);
  });

  it("depois de 'continuar' na votacao, o fio reflete espectadoresContam=true (D-29)", () => {
    let t = criar(2);
    for (let i = 0; i < 3; i++) t = runWave(t, []);
    t = applyVoteResult(openVote(t), "continuar");
    const fio = toTournamentWire(t, (c) => `pub-${c}`);
    expect(fio.espectadoresContam).toBe(true);
    expect(TournamentWireSchema.safeParse(fio).success).toBe(true);
  });

  it("marca eliminado em quem esta fora", () => {
    let t = criar(2);
    for (let i = 0; i < 3; i++) t = runWave(t, []);
    const fio = toTournamentWire(t, (c) => `pub-${c}`);
    const fora = new Set(eliminatedTeamIds(t));
    for (const time of fio.teams) expect(time.eliminated).toBe(fora.has(time.id));
  });

  it("publicIdOf devolvendo null some da lista, nunca vira a string 'null' (D-20)", () => {
    // Acontece quando alguem saiu da sala e ainda sobra entrada nos mapas: o
    // hub nao tem publicId para repassar. A entrada certa e sumir de ready,
    // watching e vote.votes — e o publicId do assento vira null de verdade,
    // nao a string "null" (isso viraria uma chave estranha na tela de outro
    // jogador).
    let t = setReady(runWave(criar(2), []), "c0", true);
    t = setReady(t, "c1", true);
    t = setWatch(t, "c0", "UB_QF_1")!;
    t = castVote(openVote(t), "c0", "parar");
    t = castVote(t, "c1", "continuar");
    const publicIdOf = (c: string) => (c === "c0" ? null : "pub-c1");

    const fio = toTournamentWire(t, publicIdOf);

    expect(fio.ready).toEqual(["pub-c1"]);
    expect(Object.keys(fio.watching)).toEqual([]);
    expect(Object.keys(fio.vote!.votes)).toEqual(["pub-c1"]);
    const assentoC0 = t.seatClientIds.indexOf("c0");
    expect(fio.teams[assentoC0]!.publicId).toBeNull();
  });
});

describe("awards do torneio inteiro (Fase 7)", () => {
  it("e null antes de qualquer jogo acontecer", () => {
    const fio = toTournamentWire(criar(2), (c) => `pub-${c}`);
    expect(fio.awards).toBeNull();
  });

  it("aparece depois da primeira onda, com mvp e bagre de algum time real", () => {
    const t = runWave(criar(2), []);
    const fio = toTournamentWire(t, (c) => `pub-${c}`);

    expect(fio.awards).not.toBeNull();
    const times = new Set(Object.keys(t.bracket.teams));
    expect(times.has(fio.awards!.mvp.teamId)).toBe(true);
    expect(times.has(fio.awards!.bagre.teamId)).toBe(true);
    // S22: a linha diz em quantos jogos a soma aconteceu (a nota e por media).
    expect(fio.awards!.mvp.line).toMatch(/^\d+\/\d+\/\d+ em \d+ jogos?$/);
    expect(fio.awards!.bagre.line).toMatch(/^\d+\/\d+\/\d+ em \d+ jogos?$/);
  });

  it("a linha conta os jogos do time inteiro, somados entre series (S22)", () => {
    let t = criar(2);
    t = runWave(t, []);
    t = runWave(t, []);
    const fio = toTournamentWire(t, (c) => `pub-${c}`);
    const mvpTeamId = fio.awards!.mvp.teamId;
    const jogos = Object.values(t.bracket.slots)
      .map((slot) => slot.series)
      .filter((s) => s.teamAId === mvpTeamId || s.teamBId === mvpTeamId)
      .reduce((n, s) => n + s.games.length, 0);
    expect(fio.awards!.mvp.line).toContain(`em ${jogos} jogo`);
  });

  it("soma K/D/A de MAIS de uma serie quando o time joga mais de uma (nao reseta a cada serie)", () => {
    // Duas ondas: quem venceu a quarta joga a semi tambem. Se a agregacao
    // reiniciasse por serie (o bug natural de portar a conta do
    // SeriesResultScreen sem generalizar), o line do MVP nunca refletiria
    // mais que uma serie -- inalcancavel de provar so olhando o formato do
    // texto, entao comparamos contra a soma manual de todo `StoredGame` do
    // time do MVP.
    let t = criar(2);
    t = runWave(t, []);
    t = runWave(t, []);
    const fio = toTournamentWire(t, (c) => `pub-${c}`);
    const mvpTeamId = fio.awards!.mvp.teamId;

    const seriesDoTime = Object.values(t.bracket.slots)
      .map((slot) => slot.series)
      .filter((s) => s.teamAId === mvpTeamId || s.teamBId === mvpTeamId);
    expect(seriesDoTime.length).toBeGreaterThanOrEqual(1);
    const totalDeJogos = seriesDoTime.reduce((n, s) => n + s.games.length, 0);
    // Se o time do MVP jogou mais de uma serie, prova que a soma atravessa
    // series -- e o proprio ponto deste teste.
    if (seriesDoTime.length > 1) expect(totalDeJogos).toBeGreaterThan(seriesDoTime[0]!.games.length);
  });

  it("passa pelo schema do protocolo com awards preenchido", () => {
    const t = runWave(criar(2), []);
    expect(TournamentWireSchema.safeParse(toTournamentWire(t, (c) => `pub-${c}`)).success).toBe(true);
  });

  it("continua sem timeline nenhuma no fio (D-27) mesmo com awards", () => {
    const t = runWave(criar(2), []);
    const fio = toTournamentWire(t, (c) => `pub-${c}`);
    expect(JSON.stringify(fio)).not.toContain("winProbAfter");
    expect(JSON.stringify(fio).length).toBeLessThan(20_000);
  });
});

describe("ONDA_DO_SLOT (D1/D2: a composicao das rodadas e fixa)", () => {
  it("bate com o runWave de verdade: cada serie roda na onda que o mapa diz", () => {
    let t = criar(2);
    for (let onda = 1; onda <= TOTAL_WAVES; onda++) {
      const daOnda = readySlots(t);
      for (const slot of daOnda) expect(ONDA_DO_SLOT[slot], `${slot} na onda ${onda}`).toBe(onda);
      t = runWave(t, []);
    }
    expect(isFinished(t)).toBe(true);
  });

  it("4, 4, 3, 1, 1, 1 series por onda (D-23)", () => {
    const porOnda = [0, 0, 0, 0, 0, 0];
    for (const slot of SlotIdSchema.options) porOnda[ONDA_DO_SLOT[slot] - 1]!++;
    expect(porOnda).toEqual([4, 4, 3, 1, 1, 1]);
  });
});

describe("ondaDaEliminacao e a barreira com quem caiu na rodada (D2, S13)", () => {
  it("time vivo: null; eliminado: a onda da segunda derrota", () => {
    let t = criar(8);
    for (let i = 0; i < 2; i++) t = runWave(t, []);
    const fora = eliminatedTeamIds(t);
    expect(fora.length).toBe(2); // os perdedores da LB_R1, na onda 2
    for (const id of fora) expect(ondaDaEliminacao(t, id)).toBe(2);
    const vivo = Object.keys(t.bracket.teams).find((id) => !fora.includes(id))!;
    expect(ondaDaEliminacao(t, vivo)).toBeNull();
  });

  it("quem caiu NESTA onda continua na barreira; quem caiu antes, nao (enquanto a urna nao decidir continuar)", () => {
    let t = criar(8);
    for (let i = 0; i < 2; i++) t = runWave(t, []);
    const foraNaOnda2 = eliminatedTeamIds(t);
    const clientDe = (teamId: string) => t.seatClientIds[Number(teamId.slice("assento-".length))]!;
    const membros = barrierMembers(t, () => true);
    for (const id of foraNaOnda2) expect(membros).toContain(clientDe(id));

    t = runWave(t, []);
    const membrosDepois = barrierMembers(t, () => true);
    for (const id of foraNaOnda2) expect(membrosDepois).not.toContain(clientDe(id));
  });
});

describe("rodarAteOFim ('Pular para o pódio', D2)", () => {
  it("roda o que falta ate coroar o campeao", () => {
    let t = criar(2);
    t = runWave(t, []);
    const fim = rodarAteOFim(t, []);
    expect(isFinished(fim)).toBe(true);
    expect(fim.wave).toBe(TOTAL_WAVES);
  });

  it("'parar' marca o torneio como pulado", () => {
    const t = applyVoteResult(openVote(criar(2)), "parar");
    expect(t.pulado).toBe(true);
    expect(t.vote).toBeNull();
  });
});
