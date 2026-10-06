import { StatsModeSchema } from "../src/data/statsPolicy";
/**
 * server/protocol.ts
 *
 * Fonte de verdade das mensagens trocadas entre cliente e servidor.
 * Tipos derivados por z.infer — nunca escritos a mao (padrao do repo).
 */

import { z } from "zod";
import { PlayerVersionSchema, RoleSchema, SlotIdSchema, StoredGameSchema } from "./engine/schema";

// v8: modo opcional de host automático, anunciado no estado da sala.
export const PROTOCOL_VERSION = 8;

export const MIN_TURN_SECONDS = 10;
export const MAX_TURN_SECONDS = 300;
export const DEFAULT_TURN_SECONDS = 60;
export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 2;
/**
 * Quem chega depois do lobby entra so para assistir (Rundown da Sala 2, S19):
 * sem time, sem voto, sem "pronto". Teto separado das 8 vagas de jogador.
 */
export const MAX_SPECTATORS = 8;

/** Times do bracket — fixo (nao-objetivo da spec: bracket de tamanho variavel). */
export const SEATS = 8;
/** Cartas que cada assento leva: uma por rota. */
export const PICKS_PER_SEAT = 5;
/** Carencia de quem caiu na propria vez, em vez do turno cheio (D-17). */
export const DISCONNECTED_GRACE_SECONDS = 15;
/** Prazo para o host automático voltar antes de passar o controle. */
export const HOST_RECONNECT_GRACE_SECONDS = 60;

/** Bo5: no maximo 5 jogos por serie. */
export const GAMES_PER_SERIES_MAX = 5;
/** Quantas vitorias fecham uma serie Bo5. */
export const SERIES_WINS = 3;
/** 6 ondas: 4, 4, 3, 1, 1, 1 series (D-23) — preso por teste de contrato. */
export const TOTAL_WAVES = 6;

/**
 * Em que onda (rodada, na tela) cada serie e jogada. A composicao e fixa pela
 * chave dupla de 8 (D-23: 4, 4, 3, 1, 1, 1) -- preso contra o runWave real em
 * server/room/tournament.test.ts. O cliente usa isto para saber quais series
 * sao "da rodada atual" e escondem o placar ate a pessoa assistir (Rundown da
 * Sala 2, D1); o servidor, para manter na barreira quem caiu na rodada atual.
 */
export const ONDA_DO_SLOT = {
  UB_QF_1: 1,
  UB_QF_2: 1,
  UB_QF_3: 1,
  UB_QF_4: 1,
  UB_SF_1: 2,
  UB_SF_2: 2,
  LB_R1_1: 2,
  LB_R1_2: 2,
  UB_F: 3,
  LB_R2_1: 3,
  LB_R2_2: 3,
  LB_SF: 4,
  LB_F: 5,
  GF: 6,
} as const satisfies Record<z.infer<typeof SlotIdSchema>, number>;

export { PlayerVersionSchema, RoleSchema, SlotIdSchema, StoredGameSchema };

// ---------------------------------------------------------------------------
// Estado da sala como trafega no fio (sem segredos do servidor)
// ---------------------------------------------------------------------------

export const RoomPhaseSchema = z.enum(["lobby", "draft", "tournament", "finished"]);
export type RoomPhase = z.infer<typeof RoomPhaseSchema>;

export const RoomSettingsSchema = z
  .object({
    statsMode: StatsModeSchema.optional(),
    chaosLevel: z.number().min(0).max(1).optional(),
    baseName: z.string().max(120).optional(),
    turnSeconds: z.number().int().min(MIN_TURN_SECONDS).max(MAX_TURN_SECONDS),
  })
  .strict();
export type RoomSettings = z.infer<typeof RoomSettingsSchema>;

export const RoomPlayerWireSchema = z
  .object({
    /**
     * Identidade publica. O clientId e a credencial de reconexao e nunca sai do
     * welcome de quem e dono dele (D-20) — difundi-lo deixaria qualquer um da
     * sala assumir o assento e o time de outro.
     */
    publicId: z.string().min(1),
    nickname: z.string().min(1).max(24),
    /** Vazio so para espectador, que nao tem time. */
    teamName: z.string().max(24),
    isHost: z.boolean(),
    connected: z.boolean(),
    /** Entrou depois do lobby: so assiste (S19). */
    spectator: z.boolean(),
  })
  .strict();
export type RoomPlayerWire = z.infer<typeof RoomPlayerWireSchema>;

// ---------------------------------------------------------------------------
// Diagnostico da base (A-02, substitui a contagem de pessoas do D-14): o lobby
// mostra antes de alguem esperar
// ---------------------------------------------------------------------------

export const SpareByRoleSchema = z
  .object({
    top: z.number().int().min(0),
    jungle: z.number().int().min(0),
    mid: z.number().int().min(0),
    adc: z.number().int().min(0),
    support: z.number().int().min(0),
  })
  .strict();

export const BaseStatusSchema = z
  .object({
    /** true quando nenhuma sequencia de escolhas deixa um time sem rota */
    ready: z.boolean(),
    /** quantos times a base precisa garantir (= SEATS) */
    needed: z.number().int().min(1),
    /** cartas de cada rota fora do alcance do pior time; precisa ser >= needed */
    spareByRole: SpareByRoleSchema,
  })
  .strict();
export type BaseStatus = z.infer<typeof BaseStatusSchema>;

// ---------------------------------------------------------------------------
// Draft no fio
// ---------------------------------------------------------------------------

/**
 * Rotas opcionais escritas uma a uma em vez de z.record: com chave de enum o
 * z.record exige as cinco rotas, e um roster em construcao tem menos.
 */
export const RosterWireSchema = z
  .object({
    top: PlayerVersionSchema.optional(),
    jungle: PlayerVersionSchema.optional(),
    mid: PlayerVersionSchema.optional(),
    adc: PlayerVersionSchema.optional(),
    support: PlayerVersionSchema.optional(),
  })
  .strict();
export type RosterWire = z.infer<typeof RosterWireSchema>;

export const DraftSeatWireSchema = z
  .object({
    index: z.number().int().min(0),
    teamName: z.string().min(1),
    isBot: z.boolean(),
    connected: z.boolean(),
    /** publicId do humano do assento; null quando e bot (D-20) */
    publicId: z.string().min(1).nullable(),
    /** cartas ja levadas — publicas para a sala inteira (D-19) */
    picks: RosterWireSchema,
  })
  .strict();
export type DraftSeatWire = z.infer<typeof DraftSeatWireSchema>;

export const DraftWireSchema = z
  .object({
    options: z.array(z.object({ role: RoleSchema, card: PlayerVersionSchema })).optional(),
    /** volta atual, 1 a 5 */
    round: z.number().int().min(1).max(PICKS_PER_SEAT),
    turnIndex: z.number().int().min(0),
    totalTurns: z.number().int().min(0),
    /** indice do assento da vez; null quando o draft acabou */
    currentSeat: z.number().int().min(0).nullable(),
    /** tempo restante do turno em ms — nunca epoch absoluto (D-16) */
    turnMsRemaining: z.number().int().min(0).nullable(),
    /** cartas ainda no baralho (pessoa nao levada) */
    remainingCards: z.number().int().min(0),
    finished: z.boolean(),
    /** ordem sorteada, fixa em toda volta, por indice de assento (Fase 8) */
    order: z.array(z.number().int().min(0)),
    /**
     * Indice do assento cuja ultima escolha foi forcada pelo relogio (Fase 6)
     * — nunca um bot, que nao tem `deadline` (D-17). Vale so para o broadcast
     * que segue o timeout; nos seguintes volta a null.
     */
    timedOutSeat: z.number().int().min(0).nullable(),
    seats: z.array(DraftSeatWireSchema),
  })
  .strict();
export type DraftWire = z.infer<typeof DraftWireSchema>;

// ---------------------------------------------------------------------------
// Torneio no fio (D-27) — visao reduzida, sem timeline
// ---------------------------------------------------------------------------

export const PlaybackActionSchema = z.enum([
  "proximoJogo",
  "jogoAnterior",
  "reiniciar",
  "voltarAoChaveamento",
  "pularSelecao",
]);
export type PlaybackAction = z.infer<typeof PlaybackActionSchema>;

/** Etapa da tela sincronizada dentro de um jogo (Fase 3): a selecao de
 * campeoes que antecede o placar. */
export const SyncStageSchema = z.enum(["select", "playback"]);
export type SyncStage = z.infer<typeof SyncStageSchema>;

export const VoteChoiceSchema = z.enum(["continuar", "parar"]);
export type VoteChoice = z.infer<typeof VoteChoiceSchema>;

/**
 * Uma serie como a sala inteira a enxerga. SEM os arrays de evento (spec §7):
 * a timeline viaja so na mensagem `games`, enderecada e sob demanda (D-27).
 */
export const TournamentSeriesWireSchema = z
  .object({
    slotId: SlotIdSchema,
    status: z.enum(["pending", "ready", "in_progress", "complete"]),
    teamAId: z.string().min(1).nullable(),
    teamBId: z.string().min(1).nullable(),
    /** vitorias por teamId */
    wins: z.record(z.string(), z.number().int().min(0)),
    winnerId: z.string().min(1).nullable(),
    /** quantos jogos ja aconteceram — o cliente pede a timeline se quiser ver */
    gamesPlayed: z.number().int().min(0).max(GAMES_PER_SERIES_MAX),
  })
  .strict();
export type TournamentSeriesWire = z.infer<typeof TournamentSeriesWireSchema>;

export const TournamentTeamWireSchema = z
  .object({
    /** "assento-N" — nenhum time se chama "user" (D-22) */
    id: z.string().min(1),
    seatIndex: z.number().int().min(0).max(SEATS - 1),
    displayName: z.string().min(1),
    tag: z.string().min(1).max(4),
    /** publicId do humano do assento; null quando e bot (D-20) */
    publicId: z.string().min(1).nullable(),
    eliminated: z.boolean(),
  })
  .strict();
export type TournamentTeamWire = z.infer<typeof TournamentTeamWireSchema>;

export const VoteWireSchema = z
  .object({
    /** publicId -> voto. Nunca clientId (D-20). */
    votes: z.record(z.string(), VoteChoiceSchema),
    /** quantos votos faltam para a urna fechar (D-33) */
    faltam: z.number().int().min(0),
  })
  .strict();

/**
 * Um destaque (MVP ou Bagre) do torneio inteiro (Fase 7) — so o resultado
 * pronto, nunca a timeline que o gerou (D-27: cada `StoredGame` chega a 1,7
 * MB, e o torneio tem ate 14 series delas).
 */
export const TournamentAwardWireSchema = z
  .object({
    teamId: z.string().min(1),
    player: z.string().min(1),
    /** "K/D/A em N jogos", somado em toda serie que o time ja jogou (S22: a nota e por media por jogo) */
    line: z.string().min(1),
    name: z.string().min(1),
    image: z.string().min(1).optional(),
  })
  .strict();
export type TournamentAwardWire = z.infer<typeof TournamentAwardWireSchema>;

export const TournamentWireSchema = z
  .object({
    /** 0 = nenhuma onda rodou ainda; vai ate TOTAL_WAVES */
    wave: z.number().int().min(0).max(TOTAL_WAVES),
    /** Todos confirmaram o fim da rodada; aguarda o host iniciar a próxima. */
    resultadosLiberados: z.boolean().optional(),
    totalWaves: z.literal(TOTAL_WAVES),
    series: z.array(TournamentSeriesWireSchema),
    teams: z.array(TournamentTeamWireSchema),
    /**
     * Identidade deste torneio. A memoria local de "series que ja vi" (D1) e
     * por torneio: sem isto, a Revanche herdaria as series vistas da noite
     * anterior com os mesmos slots.
     */
    id: z.string().min(1),
    /** publicIds que ja marcaram pronto para a proxima onda */
    ready: z.array(z.string().min(1)),
    /**
     * publicIds de quem a barreira espera agora (conectado, com assento, vivo
     * ou caido NESTA rodada). A tela usa para decidir quem ve "Pronto para a
     * proxima rodada" e para dizer "Esperando: Bia, Caio" (S14).
     */
    barreira: z.array(z.string().min(1)),
    /** quantos prontos a barreira ainda espera (D-29) */
    readyFaltam: z.number().int().min(0),
    /**
     * Quantos a barreira espera no total (barrierMembers().length) — nao da
     * pra deduzir de `ready.length + readyFaltam`: quem marca pronto e
     * depois desconecta continua em `ready` mas sai da barreira, e a soma
     * conta essa pessoa duas vezes (achado pos Tarefa 11).
     */
    readyTotal: z.number().int().min(0),
    /**
     * Fase 1 do plano da sala (docs/PLANO-EXPERIENCIA-SALA.md): so `false`
     * ate a primeira votacao "continuar" resolver, depois fica `true` pra
     * sempre (D-29) -- eliminados voltam a contar na barreira e precisam
     * poder marcar "Estou pronto". O cliente usa isso pra saber quando um
     * espectador eliminado ainda deve ver o botao (nao e mais puro).
     */
    espectadoresContam: z.boolean(),
    /** publicId -> serie que a pessoa esta acompanhando */
    watching: z.record(z.string(), SlotIdSchema),
    /** modo sincronizado: mesma serie e mesmo jogo para todos (D-28) */
    sync: z
      .object({
        slotId: SlotIdSchema,
        gameIndex: z.number().int().min(0).max(GAMES_PER_SERIES_MAX - 1),
        /**
         * So cresce. Existe porque "reiniciar" precisa mudar ALGUMA coisa no
         * estado: sem isso o roomState sai identico ao anterior e nenhum
         * cliente remonta a tela — o botao nao faria nada (Tarefa 8).
         */
        restartCount: z.number().int().min(0),
        /**
         * Fase 3: "select" enquanto a selecao de campeoes do jogo atual nao
         * foi pulada, "playback" depois. Reseta para "select" toda vez que
         * `slotId`/`gameIndex`/`restartCount` mudam (jogo novo) e so o host
         * pode adiantar para "playback" (acao `pularSelecao`) -- ninguem
         * pula sozinho em sincronia, a sala inteira adianta junto.
         */
        stage: SyncStageSchema,
      })
      .strict()
      .nullable(),
    vote: VoteWireSchema.nullable(),
    championId: z.string().min(1).nullable(),
    /**
     * A sala votou "Pular para o pódio" (D2): o resto foi simulado na hora e
     * nao ha o que esconder -- todo resultado fica revelado para todo mundo.
     */
    pulado: z.boolean(),
    /**
     * MVP/Bagre do torneio inteiro (Fase 7), agregado por jogador do elenco
     * em toda serie ja jogada — `null` enquanto nenhum jogo aconteceu ainda.
     */
    awards: z
      .object({ mvp: TournamentAwardWireSchema, bagre: TournamentAwardWireSchema })
      .strict()
      .nullable(),
  })
  .strict();
export type TournamentWire = z.infer<typeof TournamentWireSchema>;

export const RoomWireSchema = z
  .object({
    hostAuto: z.boolean().optional(),
    baseSummary: z.object({ cards: z.number().int(), people: z.number().int(), examples: z.array(z.string()) }).optional(),
    phase: RoomPhaseSchema,
    players: z.array(RoomPlayerWireSchema),
    settings: RoomSettingsSchema,
    baseStatus: BaseStatusSchema,
    draft: DraftWireSchema.nullable(),
    tournament: TournamentWireSchema.nullable(),
  })
  .strict();
export type RoomWire = z.infer<typeof RoomWireSchema>;

// ---------------------------------------------------------------------------
// Cliente → servidor
// ---------------------------------------------------------------------------

export const HelloSchema = z
  .object({
    type: z.literal("hello"),
    protocolVersion: z.number().int(),
    clientId: z.string().min(1).optional(),
    nickname: z.string().min(1).max(24),
    /**
     * Vazio vale so para quem entra como espectador (sala ja comecou). No
     * lobby o servidor recusa com `time_obrigatorio`.
     */
    teamName: z.string().max(24),
    hostToken: z.string().min(1).optional(),
  })
  .strict();

export const SetSettingsSchema = z
  .object({
    type: z.literal("setSettings"),
    turnSeconds: z.number().int().min(MIN_TURN_SECONDS).max(MAX_TURN_SECONDS),
  })
  .strict();

export const PublishBaseSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    type: z.literal("publishBase"),
    /** Conteudo bruto de um players.json — validado pelo servidor com PlayerDatabaseSchema */
    database: z.unknown(),
  })
  .strict();

export const PongSchema = z.object({ type: z.literal("pong") }).strict();

export const StartDraftSchema = z
  .object({
    statsMode: StatsModeSchema.optional(),
    chaosLevel: z.number().min(0).max(1).optional(),

    type: z.literal("startDraft"),
    turnSeconds: z.number().int().min(MIN_TURN_SECONDS).max(MAX_TURN_SECONDS),
  })
  .strict();

export const PickSchema = z
  .object({
    type: z.literal("pick"),
    cardId: z.string().min(1),
  })
  .strict();

export const StartTournamentSchema = z
  .object({ type: z.literal("startTournament"), chaosLevel: z.number().min(0).max(1) })
  .strict();

/**
 * `ready` carrega o booleano de proposito: marcar pronto tem que poder ser
 * desmarcado. Sem o campo, um clique acidental abriria uma barreira sem volta.
 */
export const ReadySchema = z.object({ type: z.literal("ready"), ready: z.boolean() }).strict();

export const SetWatchSchema = z.object({ type: z.literal("setWatch"), slotId: SlotIdSchema }).strict();

export const SetSyncModeSchema = z
  .object({ type: z.literal("setSyncMode"), enabled: z.boolean() })
  .strict();

export const PlaybackControlSchema = z
  .object({ type: z.literal("playbackControl"), action: PlaybackActionSchema })
  .strict();

export const VoteSchema = z.object({ type: z.literal("vote"), choice: VoteChoiceSchema }).strict();

export const ForceAdvanceSchema = z.object({ type: z.literal("forceAdvance") }).strict();

/**
 * Host tira do lobby quem caiu e nao vai voltar (Rundown da Sala 2, S26): sem
 * isto a vaga e o nome do time ficavam presos ate o servidor reiniciar. So no
 * lobby e so para quem esta desconectado.
 */
export const RemovePlayerSchema = z
  .object({ type: z.literal("removePlayer"), publicId: z.string().min(1) })
  .strict();

export const TransferHostSchema = z
  .object({ type: z.literal("transferHost"), publicId: z.string().min(1) })
  .strict();

/**
 * Revanche (D9): com a noite encerrada, o host volta a sala para o lobby com
 * as mesmas pessoas e os mesmos nomes de time -- sem reabrir o servidor.
 */
export const RematchSchema = z.object({ type: z.literal("rematch") }).strict();

/**
 * Trocar o proprio apelido/time no lobby pelo socket que ja esta aberto. Antes
 * a troca abria um socket novo: o velho fechava (a pessoa "caia"), e se o nome
 * novo estivesse ocupado ela ficava fora da sala sem perceber (revisao final do
 * Rundown da Sala 2, achado 3).
 */
export const RenameSchema = z
  .object({ type: z.literal("rename"), nickname: z.string().min(1).max(24), teamName: z.string().min(1).max(24) })
  .strict();

export const ClientMessageSchema = z.discriminatedUnion("type", [
  HelloSchema,
  SetSettingsSchema,
  PublishBaseSchema,
  PongSchema,
  StartDraftSchema,
  PickSchema,
  StartTournamentSchema,
  ReadySchema,
  SetWatchSchema,
  SetSyncModeSchema,
  PlaybackControlSchema,
  VoteSchema,
  ForceAdvanceSchema,
  RemovePlayerSchema,
  TransferHostSchema,
  RematchSchema,
  RenameSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------------------------------------------------------------------------
// Servidor → cliente
// ---------------------------------------------------------------------------

export const ErrorCodeSchema = z.enum([
  "room_full",
  "team_name_taken",
  "in_progress",
  "not_host",
  "invalid_base",
  "unknown_client",
  "bad_message",
  "not_your_turn",
  "card_not_in_hand",
  "not_enough_players",
  "base_insuficiente",
  "draft_over",
  "draft_incompleto",
  "torneio_nao_comecou",
  "serie_desconhecida",
  "gravacao_indisponivel",
  "votacao_fechada",
  "onda_rodando",
  "time_obrigatorio",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const WelcomeSchema = z
  .object({
    type: z.literal("welcome"),
    clientId: z.string().min(1),
    publicId: z.string().min(1),
    isHost: z.boolean(),
    protocolVersion: z.number().int(),
  })
  .strict();

export const RoomStateMessageSchema = z
  .object({ type: z.literal("roomState"), state: RoomWireSchema })
  .strict();

export const ErrorMessageSchema = z
  .object({
    type: z.literal("error"),
    code: ErrorCodeSchema,
    message: z.string().min(1),
  })
  .strict();

export const ProtocolMismatchSchema = z
  .object({
    type: z.literal("protocolMismatch"),
    serverVersion: z.number().int(),
    message: z.string().min(1),
  })
  .strict();

export const BasePublishedSchema = z
  .object({ type: z.literal("basePublished"), playerCount: z.number().int().min(0) })
  .strict();

export const PingSchema = z.object({ type: z.literal("ping") }).strict();

export const HandCardSchema = z
  .object({ role: RoleSchema, card: PlayerVersionSchema })
  .strict();

/**
 * A mao de quem esta na vez. NUNCA e difundida: o ws.ts entrega `to: "all"`
 * ate para socket que nunca mandou hello (spec secao 13). Sempre enderecada.
 */
export const HandMessageSchema = z
  .object({
    type: z.literal("hand"),
    cards: z.array(HandCardSchema),
    turnMsRemaining: z.number().int().min(0).nullable(),
  })
  .strict();

/**
 * A timeline de uma serie inteira. NUNCA e difundida e NUNCA entra no roomState:
 * 346 KB por jogo, ate 1,7 MB numa Bo5 (D-27). Mesma regra da `hand` (spec §13).
 */
export const GamesMessageSchema = z
  .object({
    type: z.literal("games"),
    slotId: SlotIdSchema,
    games: z.array(StoredGameSchema).max(GAMES_PER_SERIES_MAX),
  })
  .strict();

export const ServerMessageSchema = z.discriminatedUnion("type", [
  WelcomeSchema,
  RoomStateMessageSchema,
  ErrorMessageSchema,
  ProtocolMismatchSchema,
  BasePublishedSchema,
  PingSchema,
  HandMessageSchema,
  GamesMessageSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
