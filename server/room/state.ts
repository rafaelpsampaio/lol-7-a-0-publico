/**
 * server/room/state.ts
 *
 * Maquina de estados da sala — funcoes puras, sem rede, sem relogio, sem sorteio.
 * Toda funcao devolve uma sala nova; nada e mutado no lugar.
 */

import {
  DEFAULT_TURN_SECONDS,
  MAX_PLAYERS,
  MAX_SPECTATORS,
  MIN_PLAYERS_TO_START,
  type BaseStatus,
  type DraftWire,
  type ErrorCode,
  type RoomPhase,
  type RoomSettings,
  type RoomWire,
  type TournamentWire,
} from "../protocol";
import type { DraftState } from "./draft";
import type { RoomTournament } from "./tournament";

export interface RoomPlayer {
  clientId: string;
  /** Identidade que circula na sala. O clientId nunca sai do welcome (D-20). */
  publicId: string;
  nickname: string;
  /** Vazio para espectador. */
  teamName: string;
  isHost: boolean;
  connected: boolean;
  /**
   * Entrou depois do lobby (Rundown da Sala 2, S19): assiste ao draft e as
   * series, mas nao tem assento, nao vota e nao entra na barreira.
   */
  spectator: boolean;
}

/** Quem disputa a sala: tudo menos espectador. */
export function jogadores(room: Room): RoomPlayer[] {
  return room.players.filter((p) => !p.spectator);
}

export interface Room {
  phase: RoomPhase;
  players: RoomPlayer[];
  settings: RoomSettings;
  /** Draft em andamento, ou null enquanto a sala esta no lobby. */
  draft: DraftState | null;
  /**
   * Torneio da sala, ou null antes de comecar (lobby/draft). Obrigatorio de
   * proposito (Tarefa 7): com o campo opcional, quem monta uma sala nova sem
   * passa-lo nao teria erro de compilacao nenhum, e um `saveRoom` que esqueça
   * de repassar o torneio gravaria a sala vazia em silencio — sem log, sem
   * estouro. O compilador cobra de todo mundo que constroi um Room.
   */
  tournament: RoomTournament | null;
  /** Segredo impresso no console do host. Nunca vai para o fio. */
  hostToken: string;
  /** Ausente em salas antigas: controle manual por token. Nunca dá acesso ao editor. */
  hostAuto?: boolean;
}

export interface JoinRequest {
  clientId?: string;
  nickname: string;
  teamName: string;
  hostToken?: string;
}

export type JoinResult =
  | { ok: true; room: Room; clientId: string }
  | { ok: false; code: ErrorCode; message: string };

export function createRoom(hostToken: string, hostAuto = false): Room {
  return {
    phase: "lobby",
    players: [],
    settings: { turnSeconds: DEFAULT_TURN_SECONDS },
    draft: null,
    tournament: null,
    hostToken,
    ...(hostAuto ? { hostAuto: true } : {}),
  };
}

export function joinRoom(
  room: Room,
  req: JoinRequest,
  newClientId: string,
  newPublicId: string
): JoinResult {
  // Reconexao: clientId ja conhecido retoma o lugar, em qualquer fase.
  const existing = req.clientId
    ? room.players.find((p) => p.clientId === req.clientId)
    : undefined;

  if (existing) {
    // Renomear so vale no lobby (m-3 da revisao final). Fora dele o nome ja foi
    // congelado no assento do draft (createDraft copia o teamName na criacao):
    // um rename depois faria `roomState.players[].teamName` e
    // `roomState.draft.seats[].teamName` divergirem para a MESMA pessoa — o
    // lobby mostrando um nome e o board do draft outro. Pior: a unicidade
    // abaixo so olha `room.players` e ignora os nomes dos assentos de bot, que
    // o createDraft se deu o trabalho de desduplicar. Quem volta com outro nome
    // guardado no navegador simplesmente mantem o nome do assento — e por isso
    // a colisao tambem nao e recusada aqui: nada esta sendo mudado.
    const podeRenomear = room.phase === "lobby";
    const nickname = podeRenomear ? req.nickname : existing.nickname;
    // Time vazio na volta = "o mesmo de antes": quem entrou como espectador e
    // virou jogador na Revanche guarda "" no navegador, e a reconexao dele nao
    // pode ser recusada por isso (revisao final, achado 2).
    const teamName = podeRenomear && req.teamName.trim() !== "" ? req.teamName : existing.teamName;

    // Reconexao tambem precisa validar unicidade de nome de time.
    // Permite re-enviar o mesmo nome, mas rejeita colisao com outro jogador.
    if (podeRenomear && !existing.spectator && teamName.trim() === "") {
      return {
        ok: false,
        code: "time_obrigatorio",
        message: "Escreva um nome de time para entrar.",
      };
    }
    if (
      teamName !== existing.teamName &&
      room.players.some((p) => p.clientId !== existing.clientId && p.teamName === teamName)
    ) {
      return {
        ok: false,
        code: "team_name_taken",
        message: "Esse nome de time já está em uso. Escolha outro.",
      };
    }

    // O host pode ter entrado antes pela URL da LAN, sem token. Apresentar o
    // token depois promove; voltar sem token nunca tira o papel de quem ja tem.
    const isHost = existing.isHost || (!room.hostAuto && req.hostToken === room.hostToken);

    const players = room.players.map((p) =>
      p.clientId === existing.clientId
        ? { ...p, connected: true, isHost, nickname, teamName }
        : p
    );
    return { ok: true, room: { ...room, players }, clientId: existing.clientId };
  }

  const isHost = room.hostAuto
    ? room.phase === "lobby" && !room.players.some((p) => p.isHost)
    : req.hostToken !== undefined && req.hostToken === room.hostToken;

  // Sala ja comecou: quem chega agora entra para assistir (S19). Antes a
  // resposta era "Peça o link de quem está hospedando" -- para quem tinha
  // acabado de abrir exatamente esse link.
  if (room.phase !== "lobby") {
    if (room.players.filter((p) => p.spectator).length >= MAX_SPECTATORS) {
      return {
        ok: false,
        code: "room_full",
        message: `A sala já começou e a plateia está cheia (${MAX_SPECTATORS} pessoas assistindo).`,
      };
    }
    const espectador: RoomPlayer = {
      clientId: newClientId,
      publicId: newPublicId,
      nickname: req.nickname,
      teamName: "",
      isHost,
      connected: true,
      spectator: true,
    };
    return {
      ok: true,
      room: { ...room, players: [...room.players, espectador] },
      clientId: newClientId,
    };
  }

  if (req.teamName.trim() === "") {
    return { ok: false, code: "time_obrigatorio", message: "Escreva um nome de time para entrar." };
  }

  if (jogadores(room).length >= MAX_PLAYERS) {
    return { ok: false, code: "room_full", message: "A sala está cheia (8 jogadores)." };
  }

  if (room.players.some((p) => p.teamName === req.teamName)) {
    return {
      ok: false,
      code: "team_name_taken",
      // Gemea da frase do caminho de reconexao, la em cima: texto que jogador
      // le vai acentuado. A varredura de acentos deu as duas por tratadas e
      // esta ficou -- justamente a do caminho mais comum (m-1).
      message: "Esse nome de time já está em uso. Escolha outro.",
    };
  }

  const player: RoomPlayer = {
    clientId: newClientId,
    publicId: newPublicId,
    nickname: req.nickname,
    teamName: req.teamName,
    isHost,
    connected: true,
    spectator: false,
  };

  return {
    ok: true,
    room: { ...room, players: [...room.players, player] },
    clientId: newClientId,
  };
}

export function setConnected(room: Room, clientId: string, connected: boolean): Room {
  return {
    ...room,
    players: room.players.map((p) => (p.clientId === clientId ? { ...p, connected } : p)),
  };
}

/** Transfere o controle e revoga o link antigo, inclusive nas reconexões. */
export function transferHost(room: Room, clientId: string, publicId: string, newToken: string): JoinResult {
  if (!room.players.some((p) => p.clientId === clientId && p.isHost)) {
    return { ok: false, code: "not_host", message: "Só o host pode transferir o controle da sala." };
  }
  if (room.phase !== "lobby") {
    return { ok: false, code: "in_progress", message: "Transfira o controle antes de começar o draft." };
  }
  const target = room.players.find((p) => p.publicId === publicId);
  if (!target) return { ok: false, code: "unknown_client", message: "Essa pessoa já não está na sala." };
  if (!target.connected || target.spectator || target.clientId === clientId) {
    return { ok: false, code: "bad_message", message: "Escolha outro jogador conectado para ser host." };
  }
  return {
    ok: true,
    clientId,
    room: assignHost(room, publicId, newToken),
  };
}

/** Uma única pessoa controla a sala; o token anterior perde a validade. */
export function assignHost(room: Room, publicId: string, newToken: string): Room {
  return {
    ...room,
    hostToken: newToken,
    players: room.players.map((p) => ({ ...p, isHost: p.publicId === publicId })),
  };
}

export function setSettings(room: Room, clientId: string, turnSeconds: number): JoinResult {
  const player = room.players.find((p) => p.clientId === clientId);
  if (!player) {
    return { ok: false, code: "unknown_client", message: "Jogador não encontrado na sala." };
  }
  if (!player.isHost) {
    return { ok: false, code: "not_host", message: "Só quem hospeda muda as configurações." };
  }
  // Guarda de fase (m-4 da revisao final): `publishBase` e `startDraft` checam
  // a fase explicitamente e este nao checava. O prazo do turno corrente nao e
  // recalculado, mas o orcamento do proximo turno e o teto de relogio de parede
  // do turno (G-1) saem daqui — mudar a regra com o jogo rolando e uma
  // assimetria que ninguem decidiu. O `startDraft` ja carrega o proprio
  // turnSeconds, entao nada legitimo precisa disso durante o draft.
  if (room.phase !== "lobby") {
    return {
      ok: false,
      code: "in_progress",
      message: "O tempo de turno só pode mudar antes do draft começar.",
    };
  }
  return {
    ok: true,
    room: { ...room, settings: { ...room.settings, turnSeconds } },
    clientId,
  };
}

/**
 * Host remove do lobby quem caiu (S26). Recusa remover a si mesmo, quem esta
 * conectado (a pessoa esta ali, e so pedir) e fora do lobby (o assento do draft
 * ja foi criado com o nome dela).
 */
export function removePlayer(room: Room, hostClientId: string, publicId: string): JoinResult {
  const host = room.players.find((p) => p.clientId === hostClientId);
  if (host === undefined || !host.isHost) {
    return { ok: false, code: "not_host", message: "Só quem hospeda remove alguém da sala." };
  }
  if (room.phase !== "lobby") {
    return { ok: false, code: "in_progress", message: "Só dá para remover alguém antes do draft começar." };
  }
  const alvo = room.players.find((p) => p.publicId === publicId);
  if (alvo === undefined) {
    return { ok: false, code: "unknown_client", message: "Essa pessoa já não está na sala." };
  }
  if (alvo.connected || alvo.clientId === hostClientId) {
    return { ok: false, code: "bad_message", message: "Só dá para remover quem caiu da sala." };
  }
  return {
    ok: true,
    room: { ...room, players: room.players.filter((p) => p.publicId !== publicId) },
    clientId: hostClientId,
  };
}

/**
 * Revanche (D9): de volta ao lobby com a mesma turma. So o host, so com a
 * noite encerrada. Quem entrou para assistir vira jogador enquanto couber (com
 * um nome de time provisorio que da para trocar no lobby); o resto continua
 * na plateia. Configuracoes ficam.
 */
export function rematch(room: Room, hostClientId: string): JoinResult {
  const host = room.players.find((p) => p.clientId === hostClientId);
  if (host === undefined || !host.isHost) {
    return { ok: false, code: "not_host", message: "Só quem hospeda começa uma revanche." };
  }
  if (room.phase !== "finished") {
    return { ok: false, code: "in_progress", message: "A revanche só pode começar depois do pódio." };
  }

  const nomes = new Set(jogadores(room).map((p) => p.teamName));
  let vagas = MAX_PLAYERS - jogadores(room).length;
  const players = room.players.map((p) => {
    if (!p.spectator || vagas <= 0) return p;
    vagas--;
    let nome = `Time de ${p.nickname}`.slice(0, 24);
    for (let n = 2; nomes.has(nome); n++) nome = `Time de ${p.nickname}`.slice(0, 21) + ` ${n}`;
    nomes.add(nome);
    return { ...p, spectator: false, teamName: nome };
  });

  return {
    ok: true,
    room: { ...room, phase: "lobby", players, draft: null, tournament: null },
    clientId: hostClientId,
  };
}

/** Troca de apelido/time no lobby pelo socket aberto (ver RenameSchema). */
export function renamePlayer(room: Room, clientId: string, nickname: string, teamName: string): JoinResult {
  const eu = room.players.find((p) => p.clientId === clientId);
  if (eu === undefined) return { ok: false, code: "unknown_client", message: "Jogador não encontrado na sala." };
  if (room.phase !== "lobby") {
    return { ok: false, code: "in_progress", message: "O nome só pode mudar antes do draft começar." };
  }
  if (eu.spectator) return { ok: false, code: "bad_message", message: "Quem está assistindo não tem time para renomear." };
  if (nickname.trim() === "" || teamName.trim() === "") {
    return { ok: false, code: "time_obrigatorio", message: "Escreva um apelido e um nome de time." };
  }
  if (room.players.some((p) => p.clientId !== clientId && p.teamName === teamName)) {
    return { ok: false, code: "team_name_taken", message: "Esse nome de time já está em uso. Escolha outro." };
  }
  return {
    ok: true,
    room: { ...room, players: room.players.map((p) => (p.clientId === clientId ? { ...p, nickname, teamName } : p)) },
    clientId,
  };
}

export function canStart(room: Room): boolean {
  return jogadores(room).filter((p) => p.connected).length >= MIN_PLAYERS_TO_START;
}

export interface WireExtras {
  baseStatus: BaseStatus;
  /**
   * Draft ja montado por quem chamou. O state.ts nao importa o modulo do draft
   * de proposito: assim a maquina da sala continua sem saber que draft existe.
   */
  draft: DraftWire | null;
  /**
   * Torneio ja montado por quem chamou, mesma logica do draft acima. O hub
   * (Tarefa 7) sempre passa este campo agora; opcional so para quem constroi
   * um WireExtras sem torneio nenhum (testes de state.ts) — toWire cai para
   * null.
   */
  tournament?: TournamentWire | null;
}

/**
 * Estado da sala como ela vai para o fio. Monta o objeto campo a campo de
 * proposito: espalhar a sala aqui vazaria hostToken e clientId no primeiro
 * campo novo que alguem acrescentasse ao Room (D-20).
 */
export function toWire(room: Room, extras: WireExtras): RoomWire {
  return {
    ...(room.hostAuto ? { hostAuto: true } : {}),
    phase: room.phase,
    players: room.players.map((p) => ({
      publicId: p.publicId,
      nickname: p.nickname,
      teamName: p.teamName,
      isHost: p.isHost,
      connected: p.connected,
      spectator: p.spectator,
    })),
    settings: { ...room.settings },
    baseStatus: extras.baseStatus,
    draft: extras.draft,
    tournament: extras.tournament ?? null,
  };
}
