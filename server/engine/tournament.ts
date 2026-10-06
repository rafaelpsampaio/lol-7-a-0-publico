/**
 * server/engine/tournament.ts
 *
 * Metade PESADA do portal do motor: puxa a engine de simulacao inteira por
 * runSeriesGame. Nunca pode ser importado por server/protocol.ts — o protocol
 * roda tambem no navegador e arrastaria src/sim/** para o bundle do jogo.
 *
 * Quem importa daqui: server/room/tournament.ts e server/room/replay.ts.
 */

import { createTournament, advanceSlot } from "../../src/tournament/bracket";
import { runSeriesGame, seriesWinnerId, fearlessUsedAfter } from "../../src/tournament/series";

export { createTournament, advanceSlot, runSeriesGame, seriesWinnerId, fearlessUsedAfter };
