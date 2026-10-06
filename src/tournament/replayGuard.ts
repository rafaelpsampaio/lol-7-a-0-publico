/**
 * src/tournament/replayGuard.ts
 *
 * O replay solo refaz a timeline pela seed (o LocalStorage guarda o jogo sem eventos). Se o
 * motor mudou depois que o jogo foi gravado, a partida refeita pode ter outro vencedor. Este
 * guarda recusa esse caso, no mesmo espirito de server/room/replay.ts ("gravacao indisponivel").
 */
export function replayMatchesStored(
  storedWinnerId: string,
  resimFrameWinner: "user" | "rival",
  userFrameId: string,
  rivalFrameId: string
): boolean {
  const resimWinnerId = resimFrameWinner === "user" ? userFrameId : rivalFrameId;
  return resimWinnerId === storedWinnerId;
}
