/**
 * server/room/draft.ts
 *
 * Draft compartilhado: baralho comum que encolhe, ordem fixa sorteada uma vez
 * e repetida em toda volta (Fase 8, docs/PLANO-EXPERIENCIA-SALA.md — substitui
 * a serpentina do D-05 original: quem abre a mesa abre sempre), mao
 * individual. A carta escolhida sai do baralho de todos; a pessoa so fica
 * bloqueada no time que a levou (A-01, spec 2026-10-02-pack-amigos-design,
 * substitui o D-13). Funcoes puras — nada aqui le relogio, sorteia sozinho
 * ou conhece rede. O instante entra por parametro e o sorteio vem de mulberry32
 * semeado com a semente da sala, para o mesmo estado dar sempre o mesmo draft.
 *
 * O estado guarda IDS de carta, nao cartas inteiras (D-18): ele e gravado em
 * disco a cada escolha e a base fica congelada durante o draft (D-10), entao os
 * ids sempre resolvem contra a mesma base.
 */

import { z } from "zod";
import {
  ALL_ROLES,
  assignTeamIdentities,
  generateRound,
  mulberry32,
  seedFromString,
  type PlayerVersion,
  type Role,
} from "../engine/schema";
import { botPick } from "../engine/botPick";
import { PICKS_PER_SEAT, SEATS, type DraftWire, type RosterWire } from "../protocol";

// ---------------------------------------------------------------------------
// Estado — schema primeiro, tipo por z.infer (padrao do repo)
// ---------------------------------------------------------------------------

/**
 * Rotas opcionais escritas uma a uma: com chave de enum o z.record exige as
 * cinco, e um roster em construcao tem menos.
 */
const CardIdByRoleSchema = z
  .object({
    top: z.string().min(1).optional(),
    jungle: z.string().min(1).optional(),
    mid: z.string().min(1).optional(),
    adc: z.string().min(1).optional(),
    support: z.string().min(1).optional(),
  })
  .strict();

export const DraftSeatSchema = z
  .object({
    /** clientId do humano do assento; null quando e bot (D-11) */
    clientId: z.string().min(1).nullable(),
    teamName: z.string().min(1),
    picks: CardIdByRoleSchema,
    /** cartas ja MOSTRADAS a este assento — soft-discard do generateRound */
    seenCardIds: z.array(z.string().min(1)),
  })
  .strict();

export const DraftStateSchema = z
  .object({
    seed: z.string().min(1),
    /** sempre SEATS assentos — um snapshot com outra contagem nao e um draft valido */
    seats: z.array(DraftSeatSchema).length(SEATS),
    /**
     * indices de assento na ordem fixa (Fase 8), sempre SEATS * PICKS_PER_SEAT
     * entradas. Cada indice e limitado a [0, SEATS-1]: como `seats` acima ja e
     * travado em SEATS, isso garante que todo indice de `turns` aponta pra um
     * assento que de fato existe — sem precisar de superRefine cruzando os
     * dois campos, ja que o tamanho de `seats` e fixo (nao-objetivo da spec:
     * bracket de tamanho variavel). Um snapshot truncado ou editado a mao
     * (ex.: `turns: [99]`) e recusado aqui, na leitura, em vez de estourar
     * `TypeError` mais tarde em `dealHand`/`applyPick` ao indexar `seats`.
     */
    turns: z.array(z.number().int().min(0).max(SEATS - 1)).length(SEATS * PICKS_PER_SEAT),
    /** posicao atual em `turns`; igual a turns.length quando acabou */
    turnIndex: z.number().int().min(0),
    /** mao do assento da vez */
    hand: CardIdByRoleSchema,
    /** instante do fim do turno no relogio do servidor; null em bot ou fim */
    deadline: z.number().int().nullable(),
    /**
     * Instante do relogio do servidor em que o turno ATUAL comecou. E a ancora
     * do teto de relogio de parede (G-1 da revisao final): sem ela, alternar
     * queda e volta na propria vez encurta o prazo para a carencia (D-17) e o
     * devolve cheio a cada `hello`, para sempre — o turno nunca vence e a sala
     * inteira fica esperando. Guardado no estado (e nao no hub) porque
     * sobrevive ao reinicio junto com o resto do draft.
     */
    turnStartedAt: z.number().int(),
  })
  .strict();

export type DraftSeat = z.infer<typeof DraftSeatSchema>;
export type DraftState = z.infer<typeof DraftStateSchema>;

/**
 * Quantos turnos cheios de relogio de parede um unico turno pode durar, no
 * maximo (G-1). 2 deixa espaco para uma reconexao de verdade recuperar o turno
 * inteiro sem que a alternancia vire uma trava: passado o teto, o prazo ja
 * nasce vencido e o relogio dispara o autoPick.
 */
export const TURN_WALL_CLOCK_CAP = 2;

/**
 * O instante mais tarde em que este turno pode terminar. `turnMs` e o turno
 * cheio da sala em milissegundos — entra por parametro porque o estado do
 * draft nao conhece as configuracoes da sala.
 */
export function turnDeadlineCap(state: DraftState, turnMs: number): number {
  return state.turnStartedAt + TURN_WALL_CLOCK_CAP * turnMs;
}

/**
 * O prazo `desejado`, cortado no teto do turno. Puro: instante e orcamento
 * entram por parametro. Devolver um valor no passado e proposital — e assim que
 * o teto vira um autoPick imediato no proximo tique do relogio.
 */
export function capTurnDeadline(state: DraftState, desejado: number, turnMs: number): number {
  return Math.min(desejado, turnDeadlineCap(state, turnMs));
}

/**
 * Assentos que fecharam com menos de PICKS_PER_SEAT cartas (m-6 da revisao
 * final). So acontece quando o autoPick precisou pular um turno por falta de
 * baralho — inalcancavel enquanto o guardiao do A-02 (deckSafety) estiver de pe, mas o
 * torneio do proximo plano le estes rosters e um buraco calado viraria erro
 * longe daqui.
 */
export function incompleteSeats(state: DraftState): number[] {
  const saida: number[] = [];
  state.seats.forEach((seat, i) => {
    const cheias = ALL_ROLES.filter((r) => seat.picks[r] !== undefined).length;
    if (cheias < PICKS_PER_SEAT) saida.push(i);
  });
  return saida;
}

/**
 * Ids de toda carta ja escolhida por qualquer assento. O baralho perde a CARTA,
 * nao a pessoa (A-01): outra versao da mesma pessoa continua valendo para os
 * outros times. Derivado dos picks para nao ter duas fontes da mesma verdade.
 */
export function takenCardIds(state: DraftState): Set<string> {
  const ids = new Set<string>();
  for (const seat of state.seats) {
    for (const role of ALL_ROLES) {
      const id = seat.picks[role];
      if (id !== undefined) ids.add(id);
    }
  }
  return ids;
}

/**
 * Quanto tempo o assento tem neste turno, em ms. null = sem relogio (bot).
 * Quem chama decide: turno cheio para quem esta conectado, carencia curta para
 * quem caiu (D-17). A maquina nao sabe quem esta online.
 */
export type TurnBudget = (seat: DraftSeat) => number | null;

export interface CreateDraftInput {
  players: PlayerVersion[];
  /** humanos da sala, conectados ou nao — quem caiu tem o bot assumindo */
  humans: { clientId: string; teamName: string }[];
  seed: string;
  now: number;
  budget: TurnBudget;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export function currentSeatIndex(state: DraftState): number | null {
  return state.turns[state.turnIndex] ?? null;
}

export function currentSeat(state: DraftState): DraftSeat | null {
  const i = currentSeatIndex(state);
  return i === null ? null : (state.seats[i] ?? null);
}

export function isFinished(state: DraftState): boolean {
  return state.turnIndex >= state.turns.length;
}

/** Volta atual, 1 a 5. Depois do fim continua em 5. */
export function roundNumber(state: DraftState): number {
  const bruto = Math.floor(state.turnIndex / SEATS) + 1;
  return Math.min(PICKS_PER_SEAT, Math.max(1, bruto));
}

/** Cartas ainda no baralho: as que nenhum assento escolheu (A-01). */
export function remainingCards(state: DraftState, players: PlayerVersion[]): number {
  const levadas = takenCardIds(state);
  return players.filter((p) => !levadas.has(p.id)).length;
}

/** A mao do assento da vez resolvida em cartas, na ordem canonica das rotas. */
export function handCards(state: DraftState, players: PlayerVersion[]): [Role, PlayerVersion][] {
  const porId = new Map(players.map((p) => [p.id, p]));
  const saida: [Role, PlayerVersion][] = [];
  for (const role of ALL_ROLES) {
    const id = state.hand[role];
    if (id === undefined) continue;
    const carta = porId.get(id);
    if (carta !== undefined) saida.push([role, carta]);
  }
  return saida;
}

// ---------------------------------------------------------------------------
// Criacao
// ---------------------------------------------------------------------------

function shuffle(itens: number[], rng: () => number): number[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

export function createDraft(input: CreateDraftInput): DraftState {
  const semente = seedFromString(input.seed);
  const rng = mulberry32(semente);

  const seats: DraftSeat[] = input.humans.map((h) => ({
    clientId: h.clientId,
    teamName: h.teamName,
    picks: {},
    seenCardIds: [],
  }));

  // Nomes de bot vindos do jogo, pulando os que um humano ja usou: dois times
  // com o mesmo nome deixariam o bracket ilegivel.
  const ocupados = new Set(seats.map((s) => s.teamName));
  const identidades = assignTeamIdentities(semente, 16).filter((t) => !ocupados.has(t.name));

  let b = 0;
  while (seats.length < SEATS) {
    seats.push({
      clientId: null,
      teamName: identidades[b]?.name ?? `Bot ${b + 1}`,
      picks: {},
      seenCardIds: [],
    });
    b++;
  }

  // Ordem sorteada uma vez, fixa em toda volta: quem abre a mesa abre sempre
  // (Fase 8 — substitui a serpentina do D-05 original por pedido do dono do
  // produto).
  const ordem = shuffle(
    seats.map((_, i) => i),
    rng
  );
  const turns: number[] = [];
  for (let volta = 0; volta < PICKS_PER_SEAT; volta++) {
    turns.push(...ordem);
  }

  const inicial: DraftState = {
    seed: input.seed,
    seats,
    turns,
    turnIndex: 0,
    hand: {},
    deadline: null,
    turnStartedAt: input.now,
  };

  return dealHand(inicial, input.players, input.now, input.budget);
}

// ---------------------------------------------------------------------------
// Turno
// ---------------------------------------------------------------------------

/**
 * Tira a mao do assento da vez: uma carta por rota ainda aberta, do baralho
 * que sobrou. A semente sai de (semente da sala + numero do turno), entao a
 * mesma sala restaurada de um snapshot tira exatamente a mesma mao.
 */
export function dealHand(
  state: DraftState,
  players: PlayerVersion[],
  now: number,
  budget: TurnBudget
): DraftState {
  const seatIndex = currentSeatIndex(state);
  if (seatIndex === null) {
    return { ...state, hand: {}, deadline: null };
  }

  const seat = state.seats[seatIndex]!;
  const preenchidas = new Set<Role>(ALL_ROLES.filter((r) => seat.picks[r] !== undefined));
  const rng = mulberry32(seedFromString(`${state.seed}:${state.turnIndex}`));

  // A-01: o baralho exclui as cartas ja escolhidas por qualquer assento; a mao
  // exclui as pessoas que ESTE assento ja tem (outra versao delas segue livre
  // para os outros times).
  const levadas = takenCardIds(state);
  const baralho = players.filter((p) => !levadas.has(p.id));
  const porId = new Map(players.map((p) => [p.id, p]));
  const pessoasDoTime = new Set<string>();
  for (const role of ALL_ROLES) {
    const id = seat.picks[role];
    const carta = id === undefined ? undefined : porId.get(id);
    if (carta !== undefined) pessoasDoTime.add(carta.personId);
  }

  const candidatos = generateRound(
    baralho,
    preenchidas,
    pessoasDoTime,
    rng,
    new Set(seat.seenCardIds)
  );

  const hand: DraftState["hand"] = {};
  const vistas = new Set(seat.seenCardIds);
  for (const role of ALL_ROLES) {
    const carta = candidatos[role];
    if (carta === undefined) continue;
    hand[role] = carta.id;
    vistas.add(carta.id);
  }

  const seats = state.seats.map((s, i) =>
    i === seatIndex ? { ...s, seenCardIds: [...vistas] } : s
  );

  // `turnStartedAt` so e reancorado aqui, onde um turno de fato COMECA (e
  // dealHand e o unico caminho para isso: createDraft, applyPick e autoPick
  // todos passam por ela). E o que faz o teto do G-1 valer por turno, e nao
  // pelo draft inteiro.
  const ms = budget(seat);
  return {
    ...state,
    seats,
    hand,
    deadline: ms === null ? null : now + ms,
    turnStartedAt: now,
  };
}

export type PickResult =
  | { ok: true; state: DraftState; role: Role; card: PlayerVersion }
  | { ok: false; code: "card_not_in_hand" | "draft_over"; message: string };

/**
 * Registra a escolha, tira a carta do baralho para todos (A-01), passa a vez e
 * ja tira a mao do proximo.
 */
export function applyPick(
  state: DraftState,
  players: PlayerVersion[],
  cardId: string,
  now: number,
  budget: TurnBudget
): PickResult {
  const seatIndex = currentSeatIndex(state);
  if (seatIndex === null) {
    return { ok: false, code: "draft_over", message: "O draft já acabou." };
  }

  const role = ALL_ROLES.find((r) => state.hand[r] === cardId);
  if (role === undefined) {
    return { ok: false, code: "card_not_in_hand", message: "Essa carta não está na sua mão." };
  }

  const card = players.find((p) => p.id === cardId);
  if (card === undefined) {
    return {
      ok: false,
      code: "card_not_in_hand",
      message: "Essa carta não existe na base da sala.",
    };
  }

  // Copia e escreve em duas linhas em vez de espalhar com chave computada: o
  // spread com [role] alarga o tipo do objeto e o TypeScript recusa a atribuicao.
  const picks = { ...state.seats[seatIndex]!.picks };
  picks[role] = cardId;
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, picks } : s));

  const avancado: DraftState = {
    ...state,
    seats,
    turnIndex: state.turnIndex + 1,
    hand: {},
    deadline: null,
  };

  return { ok: true, state: dealHand(avancado, players, now, budget), role, card };
}

/**
 * Escolha automatica: do bot na vez dele, ou de quem estourou o relogio.
 * Mesma regra de peso do jogo (D-12).
 */
export function autoPick(
  state: DraftState,
  players: PlayerVersion[],
  now: number,
  budget: TurnBudget
): DraftState {
  if (isFinished(state)) return state;

  const mao: Partial<Record<Role, PlayerVersion>> = {};
  for (const [role, card] of handCards(state, players)) mao[role] = card;

  const rng = mulberry32(seedFromString(`${state.seed}:bot:${state.turnIndex}`));
  const escolha = botPick(mao, rng);

  if (escolha !== null) {
    const r = applyPick(state, players, escolha.card.id, now, budget);
    if (r.ok) return r.state;
    // Inalcancavel hoje: escolha.card.id vem de handCards(state, players), que
    // le state.hand com o mesmo `players` que acabamos de repassar a
    // applyPick — role e carta sempre resolvem. Ainda assim nao devolvemos o
    // mesmo estado calado: isso travaria pra sempre o `while (!isFinished(d))
    // d = autoPick(d, ...)` de quem chama. Cai no mesmo pulo de turno do
    // caminho de mao vazia logo abaixo, em vez de travar a sala.
  }

  // Mao vazia (baralho insuficiente, que o guardiao do startDraft ja recusa —
  // A-02) ou a recusa impossivel acima: pular o turno mantem a sala viva em
  // vez de travar num assento que nao tem o que escolher.
  const pulado: DraftState = {
    ...state,
    turnIndex: state.turnIndex + 1,
    hand: {},
    deadline: null,
  };
  return dealHand(pulado, players, now, budget);
}

// ---------------------------------------------------------------------------
// Fio
// ---------------------------------------------------------------------------

function rosterWire(
  picks: DraftState["seats"][number]["picks"],
  porId: Map<string, PlayerVersion>
): RosterWire {
  const saida: RosterWire = {};
  for (const role of ALL_ROLES) {
    const id = picks[role];
    if (id === undefined) continue;
    const carta = porId.get(id);
    if (carta !== undefined) saida[role] = carta;
  }
  return saida;
}

/**
 * O draft como a sala inteira o ve. As cartas ja levadas sao publicas (D-19);
 * a mao de quem esta na vez nao esta aqui — ela vai enderecada, nunca difundida
 * (spec secao 13). O clientId nunca entra no fio (D-20).
 */
export function toDraftWire(
  state: DraftState,
  players: PlayerVersion[],
  now: number,
  conectados: Set<string> = new Set(),
  publicIdPorClientId: Map<string, string> = new Map(),
  /** So preenchido pelo hub no broadcast que segue um timeout (Fase 6) — ver DraftWire.timedOutSeat. */
  timedOutSeat: number | null = null
): DraftWire {
  const porId = new Map(players.map((p) => [p.id, p]));

  return {
    round: roundNumber(state),
    turnIndex: state.turnIndex,
    totalTurns: state.turns.length,
    currentSeat: currentSeatIndex(state),
    // Tempo restante, nunca epoch: o relogio de quem joga nao e o do servidor (D-16).
    turnMsRemaining: state.deadline === null ? null : Math.max(0, state.deadline - now),
    remainingCards: remainingCards(state, players),
    finished: isFinished(state),
    order: state.turns.slice(0, SEATS),
    timedOutSeat,
    seats: state.seats.map((s, i) => ({
      index: i,
      teamName: s.teamName,
      isBot: s.clientId === null,
      connected: s.clientId === null ? true : conectados.has(s.clientId),
      publicId: s.clientId === null ? null : (publicIdPorClientId.get(s.clientId) ?? null),
      picks: rosterWire(s.picks, porId),
    })),
  };
}
