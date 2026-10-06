/**
 * server/room/persistence.ts
 *
 * Snapshot da sala em disco. Escrita atomica (tmp + rename) para que uma queda
 * no meio da gravacao nunca deixe um snapshot pela metade.
 */

import { mkdir, readFile, rename, stat, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { RoomPhaseSchema, RoomSettingsSchema } from "../protocol";
import { DraftStateSchema } from "./draft";
import { RoomTournamentSchema } from "./tournament";
import { stripTimelines } from "./replay";
import type { Room } from "./state";

/**
 * v4: o snapshot ganha o torneio da sala (RoomTournament), sem as timelines de
 * cada jogo (D-25) — `stripTimelines` zera os `events` de todo jogo antes de
 * virar JSON; `server/room/replay.ts` refaz cada timeline sob demanda e
 * confere contra `timelineHashes`, que viaja intacto dentro do torneio
 * gravado. Um snapshot v3 nao tem torneio nenhum para preservar — e
 * DESCARTADO sem migracao, como o v1 e o v2 ja eram (a sala recomeca do zero).
 * v5 (2026-10-02): o draft deixou de guardar takenPersonIds (A-01). Um v4 e descartado do mesmo jeito.
 */
const SNAPSHOT_VERSION = 5;
const FILE_NAME = "room.json";

const SnapshotSchema = z
  .object({
    version: z.literal(SNAPSHOT_VERSION),
    room: z
      .object({
        phase: RoomPhaseSchema,
        players: z.array(
          z
            .object({
              clientId: z.string().min(1),
              publicId: z.string().min(1),
              nickname: z.string().min(1),
              // Vazio so para espectador (S19); `default(false)` porque um
              // snapshot de antes do campo nao tem espectador nenhum.
              teamName: z.string(),
              isHost: z.boolean(),
              connected: z.boolean(),
              spectator: z.boolean().default(false),
            })
            .strict()
        ),
        settings: RoomSettingsSchema,
        /**
         * Draft em andamento sobrevive ao reinicio — ele mesmo e o baralho da
         * sala (A-01). `.default(null)` porque um snapshot gravado ANTES desta
         * chave existir nao tem `draft` nenhum: sem o default, o `.strict()`
         * recusa o objeto inteiro (chave obrigatoria faltando) e `loadRoom`
         * devolve null — a sala inteira some no reinicio (F2 da revisao).
         * Faltar `draft` significa lobby, e null e exatamente isso. Mantido na
         * v3 pelo mesmo motivo: uma sala de lobby gravada por um servidor mais
         * velho desta mesma versao nao pode sumir por uma chave ausente.
         */
        draft: DraftStateSchema.nullable().default(null),
        hostToken: z.string().min(1),
        // Opcional para restaurar snapshots v5 anteriores ao modo automático.
        hostAuto: z.boolean().optional(),
      })
      .strict(),
    /**
     * O torneio da sala, sem as timelines (D-25). null enquanto a sala nao
     * tem torneio (lobby ou draft). `timelineHashes` viaja aqui dentro — sem
     * ele TODA regeneracao de timeline depois de um reinicio responde
     * "gravacao_indisponivel": a camada 2 da conferencia em replay.ts trata
     * hash ausente como reprovacao, nunca como permissao (D-26).
     */
    tournament: RoomTournamentSchema.nullable(),
  })
  .strict();

/** Caminho do snapshot dentro do diretorio de dados. */
export function roomSnapshotPath(dir: string): string {
  return join(dir, FILE_NAME);
}

/**
 * Caminho temporario de UMA gravacao -- unico por chamada (M-3 da revisao
 * final).
 *
 * Com o nome fixo `room.json.tmp`, duas gravacoes concorrentes abriam o MESMO
 * arquivo com truncamento e as duas renomeavam: o tmp+rename protege contra uma
 * queda no meio da escrita, nunca contra um segundo escritor. E concorrencia e
 * normal aqui -- o #commit da onda e o #commit do cache de timeline dentro do
 * #gamesOutbound acontecem na mesma volta do event loop. O estrago possivel e
 * um room.json rasgado, loadRoom devolvendo null e a sala inteira sumindo no
 * reinicio (o mesmo modo de falha do F2 e do m-5, por mais um caminho).
 */
export function tempSnapshotPath(dir: string): string {
  return join(dir, `${FILE_NAME}.${randomUUID()}.tmp`);
}

/**
 * Encadeia tarefas numa promessa unica: a proxima so comeca depois que a
 * anterior termina. Usada pelo main.ts para as gravacoes de snapshot -- o
 * `onRoomChanged` dispara a cada mudanca de sala e nao esperava nada.
 *
 * Nome unico de temporario e serializacao resolvem metades diferentes do mesmo
 * problema e as duas valem a pena: o nome unico impede duas gravacoes de
 * dividirem o mesmo arquivo, a fila impede que a mais velha vença a mais nova
 * numa corrida de rename (o disco ficaria com um estado que a sala ja passou).
 *
 * Uma tarefa que falha propaga o erro para quem chamou (o main.ts registra no
 * log) sem deixar a fila presa numa promessa rejeitada.
 */
export function criarFilaSerial(): (tarefa: () => Promise<void>) => Promise<void> {
  let fila: Promise<void> = Promise.resolve();
  return (tarefa) => {
    const proxima = fila.then(tarefa);
    fila = proxima.catch(() => undefined);
    return proxima;
  };
}

/** saveRoom serializado para um diretorio. Ver criarFilaSerial. */
export function criarGravadorDeSala(dir: string): (room: Room) => Promise<void> {
  const fila = criarFilaSerial();
  return (room) => fila(() => saveRoom(dir, room));
}

/** Idade do snapshot em milissegundos, ou null se ele nao existe. */
export async function roomSnapshotAgeMs(dir: string, agora: number): Promise<number | null> {
  try {
    const info = await stat(roomSnapshotPath(dir));
    return Math.max(0, agora - info.mtimeMs);
  } catch {
    return null;
  }
}

/** Apaga o snapshot. Nao existir nao e erro. */
export async function deleteRoom(dir: string): Promise<void> {
  await unlink(roomSnapshotPath(dir)).catch(() => undefined);
}

/**
 * Grava o snapshot. Lanca se a sala nao passar pelo MESMO schema que a leitura
 * exige (m-5 da revisao final).
 *
 * A leitura e estrita — o `DraftStateSchema` impoe `seats.length === SEATS` e
 * `turns.length === SEATS * PICKS_PER_SEAT`. Sem validar na escrita, um estado
 * fora do formato ia para o disco em silencio e a sala INTEIRA desaparecia no
 * reinicio (o mesmo modo de falha do F2, por outro caminho). As invariantes
 * hoje se sustentam por construcao, entao o custo real e um parse por escrita;
 * o ganho e trocar corrupcao silenciosa por erro imediato no log — o
 * `onRoomChanged` do main.ts ja registra a falha sem derrubar a sala viva.
 */
export async function saveRoom(
  dir: string,
  room: Room,
  /**
   * O temporario desta gravacao. O padrao e um nome unico por chamada
   * (tempSnapshotPath) -- em producao ninguem passa nada. Fica injetavel
   * porque o teste que prova o tmp+rename precisa bloquear um caminho
   * CONHECIDO, e um nome sorteado nao pode ser bloqueado de fora.
   */
  tmp: string = tempSnapshotPath(dir)
): Promise<void> {
  // `tournament` sai do objeto de sala antes de bater no sub-schema `room`
  // (.strict() recusaria a chave extra ali) e vira o campo irmao do envelope.
  // Room.tournament e obrigatorio (Tarefa 7) — nunca undefined aqui, so
  // eventualmente null (sala sem torneio ainda).
  const { tournament: torneio, ...resto } = room;

  const payload = SnapshotSchema.parse({
    version: SNAPSHOT_VERSION,
    room: resto,
    // A poda que faz o D-25 funcionar: sem ela o torneio inteiro (17 MB com
    // as timelines) seria reescrito a cada `ready` que alguem clica.
    tournament:
      torneio === null ? null : { ...torneio, bracket: stripTimelines(torneio.bracket) },
  });

  await mkdir(dir, { recursive: true });
  const file = roomSnapshotPath(dir);

  await writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
  try {
    await rename(tmp, file);
  } catch (err) {
    await unlink(tmp).catch(() => undefined);
    throw err;
  }
}

/**
 * Snapshot ausente, corrompido ou de outra versao devolve null — nunca lanca.
 *
 * Todo jogador volta `connected: false`: no instante do arranque ninguem tem
 * socket aberto, por definicao. O snapshot e gravado a cada mudanca, entao uma
 * queda no meio da partida guardaria todo mundo como online e o lobby voltaria
 * cheio de fantasmas contando para o canStart.
 */
export async function loadRoom(dir: string): Promise<Room | null> {
  let text: string;
  try {
    text = await readFile(join(dir, FILE_NAME), "utf8");
  } catch {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return null;
  }

  const parsed = SnapshotSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { room, tournament } = parsed.data;
  return {
    ...room,
    players: room.players.map((p) => ({ ...p, connected: false })),
    tournament,
  };
}
