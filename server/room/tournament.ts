/**
 * server/room/tournament.ts
 *
 * Maquina de estados PURA do torneio da sala. Envolve o TournamentState do jogo
 * e acrescenta o que a sala tem e o torneio solo nao tem: onda, barreira de
 * prontos, eliminacao por assento, espectador e votacao.
 *
 * PURO: sem Date.now, sem Math.random, sem rede. O instante e o orcamento de
 * tempo entram por parametro; a semente do chaveamento sai da semente do draft,
 * que ja esta no estado.
 *
 * A pureza nao e estilo: e o que faz o D-25 funcionar. O snapshot guarda o
 * torneio SEM as timelines e as regenera rodando as partidas de novo. Se este
 * modulo passar a ler o relogio ou sortear, a regeneracao devolve outra partida
 * e ninguem descobre ate alguem reclamar que o replay nao bate com o que viu.
 * Ha um teste que le este arquivo-fonte e falha se as duas APIs aparecerem
 * fora de comentario.
 *
 * timelineHashes guarda, por serie, uma impressao digital pura de cada jogo
 * (seedFromString sobre o JSON dos events) no momento em que o jogo e criado.
 * server/room/replay.ts confere essa impressao contra a timeline regenerada:
 * seed e winnerId nao bastam, porque a seed independe do elenco e o winnerId e
 * binario -- os dois podem coincidir mesmo com outra partida por baixo (D-26).
 */

import { z } from "zod";
import {
  TournamentStateSchema,
  SlotIdSchema,
  seedFromString,
  tagFromName,
  ALL_ROLES,
  isUserTeam,
  type PlayerVersion,
  type ChampionEntry,
  type Role,
  type SlotId,
  type StoredGame,
  type TournamentTeam,
  type TournamentState,
} from "../engine/schema";
import { createTournament, advanceSlot, runSeriesGame, seriesWinnerId, fearlessUsedAfter } from "../engine/tournament";
import {
  ONDA_DO_SLOT,
  SEATS,
  TOTAL_WAVES,
  GAMES_PER_SERIES_MAX,
  VoteChoiceSchema,
  SyncStageSchema,
  type VoteChoice,
  type TournamentAwardWire,
  type TournamentWire,
} from "../protocol";
import { awardScore, objectiveValue, type TeamAwardContext } from "../../src/playback/awards";
import { tagsUnicos } from "../../src/tournament/teamNames";
import type { DraftState } from "./draft";

export const RoomTournamentSchema = z
  .object({
    /** o torneio do jogo, intacto. Depois de restaurar, games[].events pode vir vazio (D-25). */
    bracket: TournamentStateSchema,
    /** 0 = nenhuma onda rodou ainda */
    wave: z.number().int().min(0).max(TOTAL_WAVES),
    /** Todos confirmaram o fim da rodada; aguarda o host iniciar a próxima. */
    resultadosLiberados: z.boolean().optional(),
    /** clientIds prontos para a proxima onda. Nunca sai assim no fio (D-20). */
    ready: z.array(z.string().min(1)),
    /** clientId -> serie que a pessoa acompanha */
    watching: z.record(z.string(), SlotIdSchema),
    /** modo sincronizado (D-28): mesma serie, mesmo jogo, comecando juntos */
    sync: z
      .object({
        slotId: SlotIdSchema,
        gameIndex: z.number().int().min(0).max(GAMES_PER_SERIES_MAX - 1),
        /** so cresce; e o que faz o "reiniciar" da Tarefa 8 mover a tela */
        restartCount: z.number().int().min(0),
        /** Fase 3: etapa do jogo atual -- reseta para "select" a cada jogo
         * novo, so o host adianta para "playback" (pularSelecao). */
        stage: SyncStageSchema,
      })
      .strict()
      .nullable(),
    /** urna aberta quando todo humano caiu (D-33) */
    vote: z
      .object({ votes: z.record(z.string(), VoteChoiceSchema) })
      .strict()
      .nullable(),
    /** true depois que a votacao decidiu continuar: a barreira passa a contar eliminados (D-29) */
    espectadoresContam: z.boolean(),
    /** congelado no inicio do torneio e guardado no snapshot (D-26) */
    chaosLevel: z.number().min(0).max(1),
    /** indice do assento -> clientId do humano, ou null quando e bot */
    seatClientIds: z.array(z.string().min(1).nullable()).length(SEATS),
    /**
     * slotId -> impressao digital de cada jogo daquela serie, na ordem em que
     * foram jogados. Preenchido aqui, em runWave, no instante em que o jogo e
     * criado -- e a segunda camada de conferencia do D-26, que replay.ts usa
     * para pegar o que seed+winnerId sozinhos deixam passar.
     */
    timelineHashes: z.record(z.string(), z.array(z.number().int())),
    /**
     * A urna decidiu "Pular para o pódio" (D2) e o resto foi simulado de uma
     * vez. `default(false)`: snapshot de antes do campo nunca pulou nada.
     */
    pulado: z.boolean().default(false),
  })
  .strict();
export type RoomTournament = z.infer<typeof RoomTournamentSchema>;

/** Nenhum time da sala se chama "user" (D-22). */
export function teamIdOfSeat(index: number): string {
  return `assento-${index}`;
}

export function seatOfTeamId(teamId: string): number {
  const n = Number(teamId.slice("assento-".length));
  return Number.isInteger(n) && n >= 0 && n < SEATS ? n : -1;
}

/**
 * Converte os 8 assentos do draft em TournamentTeam. Lanca se algum assento
 * estiver incompleto — o hub confere antes e responde draft_incompleto.
 */
export function teamsFromDraft(draft: DraftState, players: PlayerVersion[]): TournamentTeam[] {
  const porId = new Map(players.map((p) => [p.id, p]));
  const times: TournamentTeam[] = [];
  // Siglas unicas entre os 8 times da sala (achado do teste de sala,
  // 2026-08-27): tagFromName sozinha ja colidiu de verdade ("Time Host
  // Final" e "Time Host Reclaim" caindo os dois em "THO"), deixando dois
  // times indistinguiveis na tela de partida.
  const tags = tagsUnicos(draft.seats.map((s) => s.teamName));
  for (let i = 0; i < SEATS; i++) {
    const assento = draft.seats[i]!;
    const roster: PlayerVersion[] = [];
    for (const rota of ALL_ROLES) {
      const cardId = assento.picks[rota];
      if (cardId === undefined) {
        throw new Error(`assento ${i} (${assento.teamName}) nao tem carta em ${rota}`);
      }
      const carta = porId.get(cardId);
      if (carta === undefined) {
        throw new Error(`carta ${cardId} do assento ${i} nao esta na base da sala`);
      }
      roster.push(carta);
    }
    times.push({
      id: teamIdOfSeat(i),
      // D-22: nenhum time da sala e inerentemente do usuario -- ate 8 pessoas
      // podem assistir times diferentes ao mesmo tempo. isUserTeam(_, null)
      // e sempre false; a projecao por espectador vive no cliente (SeriesWatch.tsx).
      isUser: isUserTeam(teamIdOfSeat(i), null),
      displayName: assento.teamName,
      tag: tags[i]!,
      roster,
    });
  }
  return times;
}

export function createRoomTournament(input: {
  draft: DraftState;
  players: PlayerVersion[];
  chaosLevel: number;
}): RoomTournament {
  const times = teamsFromDraft(input.draft, input.players);
  // A semente do bracket sai da semente do draft — puro, e reproduzivel no restore.
  const semente = seedFromString(`${input.draft.seed}:torneio`);
  return {
    bracket: createTournament(semente, times),
    wave: 0,
    ready: [],
    watching: {},
    sync: null,
    vote: null,
    espectadoresContam: false,
    chaosLevel: input.chaosLevel,
    seatClientIds: input.draft.seats.map((s) => s.clientId),
    timelineHashes: {},
    pulado: false,
  };
}

/** As series liberadas agora. A onda e exatamente este conjunto (D-23). */
export function readySlots(t: RoomTournament): SlotId[] {
  return SlotIdSchema.options.filter((s) => t.bracket.slots[s]!.series.status === "ready");
}

/**
 * Impressao digital pura da timeline de um jogo -- muda se a simulacao mudar,
 * ainda que seed, vencedor, enquadramento, duracao e campeoes fiquem iguais
 * (D-26, segunda camada). Funcao pura: sem relogio, sem sorteio.
 */
export function hashTimeline(jogo: StoredGame): number {
  return seedFromString(JSON.stringify(jogo.events));
}

/** Anexa um jogo a uma serie: placar, fearless e status. Sem mutacao. */
function comJogo(bracket: TournamentState, slotId: SlotId, jogo: StoredGame): TournamentState {
  const s = bracket.slots[slotId]!.series;
  return {
    ...bracket,
    slots: {
      ...bracket.slots,
      [slotId]: {
        ...bracket.slots[slotId]!,
        series: {
          ...s,
          status: "in_progress",
          games: [...s.games, jogo],
          wins: { ...s.wins, [jogo.winnerId]: (s.wins[jogo.winnerId] ?? 0) + 1 },
          fearlessUsed: fearlessUsedAfter(s, jogo),
        },
      },
    },
  };
}

/**
 * Roda todas as series da onda ate o fim e roteia os resultados. Sincrono de
 * proposito (D-24): 335 ms na onda mais pesada, contra um heartbeat de 10 s.
 *
 * As series que o advanceSlot liberar aqui dentro NAO entram nesta onda — a
 * lista e fechada antes do primeiro jogo. E o que faz a barreira existir.
 */
export function runWave(t: RoomTournament, catalogue: ChampionEntry[]): RoomTournament {
  const daOnda = readySlots(t);
  if (daOnda.length === 0) return t;

  let bracket = t.bracket;
  let timelineHashes = t.timelineHashes;
  for (const slotId of daOnda) {
    for (;;) {
      const serie = bracket.slots[slotId]!.series;
      const vencedor = seriesWinnerId(serie);
      if (vencedor !== null) {
        const perdedor = serie.teamAId === vencedor ? serie.teamBId! : serie.teamAId!;
        bracket = advanceSlot(bracket, slotId, vencedor, perdedor);
        break;
      }
      if (serie.games.length >= GAMES_PER_SERIES_MAX) {
        throw new Error(`serie ${slotId} chegou a ${GAMES_PER_SERIES_MAX} jogos sem vencedor`);
      }
      const jogo = runSeriesGame(bracket, slotId, t.chaosLevel, catalogue);
      bracket = comJogo(bracket, slotId, jogo);
      timelineHashes = {
        ...timelineHashes,
        [slotId]: [...(timelineHashes[slotId] ?? []), hashTimeline(jogo)],
      };
    }
  }

  return { ...t, bracket, wave: t.wave + 1, ready: [], resultadosLiberados: false, timelineHashes };
}

export function isFinished(t: RoomTournament): boolean {
  return t.bracket.championId !== null;
}

/** Quantas series cada time ja perdeu. */
export function lossesByTeam(t: RoomTournament): Record<string, number> {
  const perdas: Record<string, number> = {};
  for (const slotId of SlotIdSchema.options) {
    const s = t.bracket.slots[slotId]!.series;
    if (s.status !== "complete" || s.winnerId === null) continue;
    const perdedor = s.teamAId === s.winnerId ? s.teamBId : s.teamAId;
    if (perdedor !== null) perdas[perdedor] = (perdas[perdedor] ?? 0) + 1;
  }
  return perdas;
}

/**
 * Fora quem perdeu duas vezes. Coroado o campeao, todo o resto esta fora — o
 * perdedor da Grande Final vindo da chave superior tem so uma derrota, mas o
 * torneio acabou para ele do mesmo jeito (D-03: sem bracket reset).
 */
export function eliminatedTeamIds(t: RoomTournament): string[] {
  const perdas = lossesByTeam(t);
  const fora = new Set(Object.keys(perdas).filter((id) => perdas[id]! >= 2));
  if (t.bracket.championId !== null) {
    for (const id of Object.keys(t.bracket.teams)) {
      if (id !== t.bracket.championId) fora.add(id);
    }
  }
  return [...fora].sort();
}

/** Assentos ocupados por humano (D-13/D-14: 0..n-1, na ordem em que entraram). */
export function humanSeatIndexes(t: RoomTournament): number[] {
  const idx: number[] = [];
  for (let i = 0; i < SEATS; i++) if (t.seatClientIds[i] !== null) idx.push(i);
  return idx;
}

/**
 * Espera os humanos vivos e quem foi eliminado nesta rodada. Depois do voto
 * para continuar, espera também os eliminados. Desconectar não substitui Ready:
 * o navegador do celular pode suspender a conexão enquanto alguém assiste.
 */
export function barrierMembers(
  t: RoomTournament,
  _connected: (clientId: string) => boolean
): string[] {
  const fora = new Set(eliminatedTeamIds(t));
  const membros: string[] = [];
  for (const i of humanSeatIndexes(t)) {
    const clientId = t.seatClientIds[i]!;
    // Uma queda no celular não substitui a confirmação de fim da rodada.
    const time = teamIdOfSeat(i);
    // Quem caiu NESTA rodada continua na barreira ate marcar pronto (Rundown
    // da Sala 2, S13/D2): ainda esta assistindo a serie em que caiu, e a sala
    // nao segue sem ele -- nem abre a urna antes de todo mundo ter visto.
    if (!t.espectadoresContam && fora.has(time) && ondaDaEliminacao(t, time) !== t.wave) continue;
    membros.push(clientId);
  }
  return membros;
}

/**
 * Em que onda o time foi eliminado (a da serie em que tomou a segunda derrota,
 * ou a da Grande Final). `null` se ainda esta vivo.
 */
export function ondaDaEliminacao(t: RoomTournament, teamId: string): number | null {
  if (!eliminatedTeamIds(t).includes(teamId)) return null;
  let ultima: number | null = null;
  for (const slotId of SlotIdSchema.options) {
    const s = t.bracket.slots[slotId]!.series;
    if (s.status !== "complete" || s.winnerId === null || s.winnerId === teamId) continue;
    if (s.teamAId !== teamId && s.teamBId !== teamId) continue;
    const onda = ONDA_DO_SLOT[slotId];
    if (ultima === null || onda > ultima) ultima = onda;
  }
  return ultima;
}

export function barrierSatisfied(
  t: RoomTournament,
  connected: (clientId: string) => boolean
): boolean {
  const membros = barrierMembers(t, connected);
  // Sala vazia nao avanca sozinha: sem ninguem para assistir, nao ha o que liberar.
  if (membros.length === 0) return false;
  return membros.every((c) => t.ready.includes(c));
}

export function setReady(t: RoomTournament, clientId: string, ready: boolean): RoomTournament {
  const tem = t.ready.includes(clientId);
  if (ready === tem) return t;
  return {
    ...t,
    ready: ready ? [...t.ready, clientId] : t.ready.filter((c) => c !== clientId),
  };
}

/**
 * Escolhe qual serie a pessoa acompanha. Devolve null quando a serie nao tem
 * jogo nenhum para mostrar — o hub responde serie_desconhecida.
 * Qualquer serie ja jogada vale, nao so a da onda corrente (D-32).
 */
export function setWatch(t: RoomTournament, clientId: string, slotId: SlotId): RoomTournament | null {
  const serie = t.bracket.slots[slotId]?.series;
  if (serie === undefined || serie.games.length === 0) return null;
  return { ...t, watching: { ...t.watching, [clientId]: slotId } };
}

/**
 * Grava a timeline regenerada de volta no torneio em memoria (nunca no disco
 * -- D-25 poda os eventos so na escrita, o snapshot continua pequeno). Quem
 * chama (o hub, depois de um timelineOf que teve que refazer o jogo)
 * substitui so os `games` da serie; todo o resto (status, wins, winnerId,
 * fearlessUsed) fica igual. Depois disto, `hasTimelines` acha os eventos
 * presentes e a proxima chamada a timelineOf pega o atalho sem regenerar de
 * novo.
 */
export function withTimelineCached(
  t: RoomTournament,
  slotId: SlotId,
  games: StoredGame[]
): RoomTournament {
  return {
    ...t,
    bracket: {
      ...t.bracket,
      slots: {
        ...t.bracket.slots,
        [slotId]: { ...t.bracket.slots[slotId]!, series: { ...t.bracket.slots[slotId]!.series, games } },
      },
    },
  };
}

/**
 * Aponta cada humano para a serie do proprio time nesta onda, se houver.
 * Quem nao tem time nas series informadas (eliminado, ou time que folgou)
 * mantem o `watching` que ja tinha — inclusive nenhum, se nunca escolheu.
 */
export function autoWatch(t: RoomTournament, daOnda: SlotId[]): RoomTournament {
  const watching = { ...t.watching };
  for (const i of humanSeatIndexes(t)) {
    const clientId = t.seatClientIds[i]!;
    const meuTime = teamIdOfSeat(i);
    const minha = daOnda.find((s) => {
      const serie = t.bracket.slots[s]!.series;
      return serie.teamAId === meuTime || serie.teamBId === meuTime;
    });
    if (minha !== undefined) watching[clientId] = minha;
  }
  return { ...t, watching };
}

/**
 * Depois do autoWatch: humano que JA ESTAVA eliminado antes desta onda passa a
 * acompanhar a onda nova, mesmo que estivesse vendo outra coisa (achado de UX
 * — Fase 1 item 8: sem isso, quem cai fica preso na ultima serie que assistiu
 * enquanto o resto da sala segue jogando). Quem caiu NESTA onda fica de fora
 * dessa regra (ver o ultimo paragrafo). Nao mexe em quem ainda esta vivo: para
 * esses o autoWatch ja decide (serie propria, se houver) e a preservacao de
 * escolha manual segue valendo. Funcao separada do autoWatch de proposito --
 * autoWatch preserva escolha manual de quem nao joga na onda por design
 * (testes de "espectador revisitando serie antiga"), e eliminado e sempre
 * espectador; misturar as duas regras num so loop faria elegante virar
 * ambigua.
 *
 * Quem caiu NESTA onda nao e redirecionado (Rundown da Sala 2, achado 5): o
 * autoWatch ja o apontou para a serie em que ele caiu, e e ela que ele quer
 * ver. So quem ja estava fora antes -- e portanto nao joga nada em `daOnda` --
 * vai para a serie nova.
 */
export function autoWatchEspectadores(t: RoomTournament, daOnda: SlotId[]): RoomTournament {
  if (daOnda.length === 0) return t;
  const proximaSerie = daOnda[0]!;
  const eliminados = new Set(eliminatedTeamIds(t));
  const jogouNestaOnda = (time: string): boolean =>
    daOnda.some((slot) => {
      const s = t.bracket.slots[slot]!.series;
      return s.teamAId === time || s.teamBId === time;
    });
  const watching = { ...t.watching };
  for (const i of humanSeatIndexes(t)) {
    const meuTime = teamIdOfSeat(i);
    if (!eliminados.has(meuTime)) continue;
    if (jogouNestaOnda(meuTime)) continue;
    watching[t.seatClientIds[i]!] = proximaSerie;
  }
  return { ...t, watching };
}

/**
 * Aponta todo humano para a mesma serie -- o modo sincronizado (D-28): em
 * sincronia ninguem escolhe, e o ponto do modo. Devolve so o `watching` novo;
 * quem chama e responsavel por tambem preencher `sync`.
 */
export function sincronizarTodos(
  t: RoomTournament,
  slotId: SlotId,
  plateia: string[] = []
): Record<string, SlotId> {
  const watching: Record<string, SlotId> = { ...t.watching };
  for (const i of humanSeatIndexes(t)) {
    watching[t.seatClientIds[i]!] = slotId;
  }
  // Espectador (entrou depois do lobby, S19) nao tem assento, mas assiste
  // junto com a sala do mesmo jeito.
  for (const clientId of plateia) watching[clientId] = slotId;
  return watching;
}

/**
 * Espectador sem assento (S19) acompanha a onda nova como o eliminado: a
 * primeira serie dela. Sem isto ele ficaria na serie da onda anterior.
 */
export function apontarPlateia(t: RoomTournament, plateia: string[], daOnda: SlotId[]): RoomTournament {
  if (daOnda.length === 0 || plateia.length === 0) return t;
  const watching = { ...t.watching };
  for (const clientId of plateia) watching[clientId] = daOnda[0]!;
  return { ...t, watching };
}

export function allHumansEliminated(t: RoomTournament): boolean {
  const fora = new Set(eliminatedTeamIds(t));
  const humanos = humanSeatIndexes(t);
  return humanos.length > 0 && humanos.every((i) => fora.has(teamIdOfSeat(i)));
}

export function openVote(t: RoomTournament): RoomTournament {
  return t.vote === null ? { ...t, vote: { votes: {} } } : t;
}

export function castVote(t: RoomTournament, clientId: string, choice: VoteChoice): RoomTournament {
  if (t.vote === null) return t;
  return { ...t, vote: { votes: { ...t.vote.votes, [clientId]: choice } } };
}

/**
 * Fecha a urna quando todo humano conectado votou (D-33). Empate mantem o
 * torneio rodando — quem nao votou nao entra na conta, senao um navegador
 * fechado travaria o podio.
 */
export function voteResult(
  t: RoomTournament,
  connected: (clientId: string) => boolean
): VoteChoice | null {
  if (t.vote === null) return null;
  const eleitores = humanSeatIndexes(t)
    .map((i) => t.seatClientIds[i]!)
    .filter(connected);
  const votos = eleitores.map((c) => t.vote!.votes[c]).filter((v): v is VoteChoice => v !== undefined);
  if (eleitores.length === 0 || votos.length < eleitores.length) return null;
  const parar = votos.filter((v) => v === "parar").length;
  return parar > votos.length - parar ? "parar" : "continuar";
}

/**
 * Apuracao forcada pelo host (D-33: "a votacao fecha... ou quando o host
 * forcar"). Conta so quem ja votou, sem esperar os demais nem exigir ninguem
 * conectado ter votado -- ao contrario de `voteResult`, NUNCA devolve null.
 * Zero votos e um empate de 0 a 0, e empate mantem o torneio rodando (D-33):
 * forcar sem ninguem ter votado tambem da "continuar", coerente com "na
 * duvida, a noite continua".
 */
export function forceVoteResult(t: RoomTournament): VoteChoice {
  const votos = t.vote === null ? [] : Object.values(t.vote.votes);
  const parar = votos.filter((v) => v === "parar").length;
  return parar > votos.length - parar ? "parar" : "continuar";
}

/**
 * Continuar: fecha a urna e passa a contar os eliminados na barreira (D-29).
 * "parar" e o "Pular para o pódio" (D2): fecha a urna e marca o torneio como
 * pulado -- quem chama (o hub) simula o resto ate o campeao.
 */
export function applyVoteResult(t: RoomTournament, choice: VoteChoice): RoomTournament {
  return choice === "continuar"
    ? { ...t, vote: null, espectadoresContam: true, ready: [] }
    : { ...t, vote: null, ready: [], pulado: true };
}

/**
 * Roda todas as ondas que faltam, uma atras da outra, ate coroar o campeao
 * (D2, "Pular para o pódio"). Sem autoWatch: ninguem e arrastado para serie
 * nenhuma -- a sala inteira vai para o podio.
 */
export function rodarAteOFim(t: RoomTournament, catalogue: ChampionEntry[]): RoomTournament {
  let atual = t;
  while (!isFinished(atual) && readySlots(atual).length > 0) {
    atual = runWave(atual, catalogue);
  }
  return atual;
}

/** Troca clientId por publicId num mapa clientId -> valor, descartando quem nao tem publicId. */
function traduzirMapa<V>(
  mapa: Record<string, V>,
  publicIdOf: (clientId: string) => string | null
): Record<string, V> {
  const saida: Record<string, V> = {};
  for (const [clientId, valor] of Object.entries(mapa)) {
    const pub = publicIdOf(clientId);
    if (pub !== null) saida[pub] = valor;
  }
  return saida;
}

interface AwardAgg {
  playerId: string;
  player: string;
  teamId: string;
  k: number;
  d: number;
  a: number;
  gold: number;
  /** jogos em que o time do jogador entrou (S22: a nota e por media por jogo) */
  jogos: number;
  champId?: string;
}

const rosterByRole = (team: TournamentTeam): Partial<Record<Role, PlayerVersion>> => {
  const saida: Partial<Record<Role, PlayerVersion>> = {};
  for (const p of team.roster) saida[p.primaryRole] = p;
  return saida;
};

/**
 * MVP/Bagre do torneio inteiro (Fase 7) — mesma matematica de
 * src/playback/awards.ts (modulo puro, sem import nenhum, seguro de trazer
 * pro servidor: nao alcanca a metade pesada que o server/quarentena.test.ts
 * isola de server/protocol.ts), so que agregada por jogador do elenco em
 * TODA serie que o time ja jogou, nao so uma. O servidor ja tem `StoredGame`
 * de toda serie em memoria (bracket.slots[*].series.games) — nao e I/O novo,
 * so somar o que ja esta la. `null` enquanto nenhum jogo aconteceu.
 */
function tournamentAwards(
  bracket: TournamentState,
  catalogue: ChampionEntry[]
): { mvp: TournamentAwardWire; bagre: TournamentAwardWire } | null {
  const porChampId = new Map(catalogue.map((c) => [c.id, c]));
  const semAno = (n: string) => n.replace(/\s+\d{4}$/, "").trim() || n;

  const agg = new Map<string, AwardAgg>();
  const objetivos = new Map<string, { drag: number; tow: number; bar: number }>();
  for (const [teamId, time] of Object.entries(bracket.teams)) {
    for (const p of time.roster) {
      agg.set(p.id, { playerId: p.id, player: semAno(p.displayName), teamId, k: 0, d: 0, a: 0, gold: 0, jogos: 0 });
    }
    objetivos.set(teamId, { drag: 0, tow: 0, bar: 0 });
  }

  let algumJogo = false;
  const jogosDoTime = new Map<string, number>();

  for (const slotId of SlotIdSchema.options) {
    const s = bracket.slots[slotId]!.series;
    if (s.teamAId === null || s.teamBId === null) continue;
    const rolesA = rosterByRole(bracket.teams[s.teamAId]!);
    const rolesB = rosterByRole(bracket.teams[s.teamBId]!);
    const objA = objetivos.get(s.teamAId)!;
    const objB = objetivos.get(s.teamBId)!;

    for (const g of s.games) {
      const last = g.events[g.events.length - 1];
      if (!last?.map) continue;
      algumJogo = true;
      jogosDoTime.set(s.teamAId, (jogosDoTime.get(s.teamAId) ?? 0) + 1);
      jogosDoTime.set(s.teamBId, (jogosDoTime.get(s.teamBId) ?? 0) + 1);

      // Os events sao enquadrados em torno de userFrameTeamId (o humano quando
      // jogou), nao necessariamente o teamA do bracket -- mesma leitura que
      // SeriesResultScreen.tsx ja faz por serie.
      const aIsUserFrame = (g.userFrameTeamId ?? s.teamAId) === s.teamAId;
      const aMap = aIsUserFrame ? last.map.user : last.map.rival;
      const bMap = aIsUserFrame ? last.map.rival : last.map.user;

      for (const role of ALL_ROLES) {
        const pa = rolesA[role];
        const pb = rolesB[role];
        const sa = aMap.players[role];
        const sb = bMap.players[role];
        if (pa) {
          const e = agg.get(pa.id)!;
          e.k += sa.kills;
          e.d += sa.deaths;
          e.a += sa.assists;
          e.gold += sa.gold;
          e.champId = g.champions.teamA[pa.id] ?? e.champId;
        }
        if (pb) {
          const e = agg.get(pb.id)!;
          e.k += sb.kills;
          e.d += sb.deaths;
          e.a += sb.assists;
          e.gold += sb.gold;
          e.champId = g.champions.teamB[pb.id] ?? e.champId;
        }
      }

      if (last.score) {
        const sc = last.score;
        objA.drag += aIsUserFrame ? sc.userDragons : sc.rivalDragons;
        objA.tow += aIsUserFrame ? sc.userTowers : sc.rivalTowers;
        objA.bar += (aIsUserFrame ? sc.userBaron : sc.rivalBaron) ? 1 : 0;
        objB.drag += aIsUserFrame ? sc.rivalDragons : sc.userDragons;
        objB.tow += aIsUserFrame ? sc.rivalTowers : sc.userTowers;
        objB.bar += (aIsUserFrame ? sc.rivalBaron : sc.userBaron) ? 1 : 0;
      }
    }
  }

  if (!algumJogo) return null;

  const teamKA = new Map<string, number>();
  for (const e of agg.values()) teamKA.set(e.teamId, (teamKA.get(e.teamId) ?? 0) + e.k + e.a);

  // Media por jogo (S22): somar tudo favorecia quem jogou mais series -- o
  // campeao da chave inferior joga ate o dobro de jogos do 7o colocado.
  const scored: { e: AwardAgg; score: number }[] = [];
  for (const e of agg.values()) {
    const n = jogosDoTime.get(e.teamId) ?? 0;
    if (n === 0) continue;
    e.jogos = n;
    const obj = objetivos.get(e.teamId)!;
    const ctx: TeamAwardContext = {
      teamObjValue: objectiveValue(obj.drag / n, obj.tow / n, obj.bar / n),
      teamKA: (teamKA.get(e.teamId) ?? 0) / n,
      onWinningTeam: bracket.championId === e.teamId,
    };
    scored.push({ e, score: awardScore({ kills: e.k / n, deaths: e.d / n, assists: e.a / n, gold: e.gold / n }, ctx) });
  }
  if (scored.length === 0) return null;

  let mvp = scored[0]!;
  let bagre = scored[0]!;
  for (const s of scored) {
    if (s.score > mvp.score) mvp = s;
    if (s.score < bagre.score) bagre = s;
  }

  const deco = (s: { e: AwardAgg; score: number }): TournamentAwardWire => {
    const champ = s.e.champId ? porChampId.get(s.e.champId) : undefined;
    return {
      teamId: s.e.teamId,
      player: s.e.player,
      line: `${s.e.k}/${s.e.d}/${s.e.a} em ${s.e.jogos} ${s.e.jogos === 1 ? "jogo" : "jogos"}`,
      name: champ?.name ?? "?",
      image: champ?.image,
    };
  };

  return { mvp: deco(mvp), bagre: deco(bagre) };
}

/**
 * A visao reduzida que vai no roomState. Sem nenhum array de evento (D-27) e
 * sem nenhum clientId (D-20): toda chave que sai daqui e publicId.
 *
 * readyFaltam, readyTotal e vote.faltam saem zerados: este modulo e puro e
 * nao sabe quem esta conectado. O hub preenche os tres na Tarefa 7 (e
 * readyTotal na Tarefa 11).
 */
export function toTournamentWire(
  t: RoomTournament,
  publicIdOf: (clientId: string) => string | null,
  catalogue: ChampionEntry[] = []
): TournamentWire {
  const fora = new Set(eliminatedTeamIds(t));

  const series = SlotIdSchema.options.map((slotId) => {
    const s = t.bracket.slots[slotId]!.series;
    return {
      slotId,
      status: s.status,
      teamAId: s.teamAId,
      teamBId: s.teamBId,
      wins: { ...s.wins },
      winnerId: s.winnerId,
      gamesPlayed: s.games.length,
    };
  });

  const teams = [];
  for (let i = 0; i < SEATS; i++) {
    const id = teamIdOfSeat(i);
    const time = t.bracket.teams[id]!;
    const clientId = t.seatClientIds[i];
    teams.push({
      id,
      seatIndex: i,
      displayName: time.displayName,
      // `tag` e opcional no estado gravado (compatibilidade com saves antigos
      // do jogo solo) e obrigatoria no fio -- min(1). O fallback antigo
      // (`?? ""`) produzia exatamente o valor que o schema recusa: o cliente
      // jogaria fora o roomState INTEIRO em vez de mostrar um time sem sigla
      // (m-4 da revisao final). tagFromName e a mesma funcao que monta a sigla
      // na criacao do time, e displayName nunca e vazio (schema).
      tag: time.tag ?? tagFromName(time.displayName),
      publicId: clientId === null ? null : publicIdOf(clientId),
      eliminated: fora.has(id),
    });
  }

  return {
    wave: t.wave,
    resultadosLiberados: t.resultadosLiberados ?? false,
    totalWaves: TOTAL_WAVES,
    // A semente do bracket nasce da do draft: unica por torneio, estavel no restore.
    id: String(t.bracket.seed),
    series,
    teams,
    ready: t.ready.map(publicIdOf).filter((p): p is string => p !== null),
    barreira: [], // preenchido pelo hub, que sabe quem esta conectado
    readyFaltam: 0, // preenchido pelo hub, que sabe quem esta conectado
    readyTotal: 0, // idem — o hub preenche com barrierMembers().length
    espectadoresContam: t.espectadoresContam,
    watching: traduzirMapa(t.watching, publicIdOf),
    sync: t.sync,
    vote: t.vote === null ? null : { votes: traduzirMapa(t.vote.votes, publicIdOf), faltam: 0 },
    championId: t.bracket.championId,
    pulado: t.pulado,
    awards: tournamentAwards(t.bracket, catalogue),
  };
}
