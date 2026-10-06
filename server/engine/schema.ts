/**
 * server/engine/schema.ts
 *
 * Metade do portal do motor que e SEGURA NO NAVEGADOR (D-15): so schemas e
 * funcoes puras do jogo, zero node:*. O server/protocol.ts importa daqui e o
 * protocol.ts tambem roda no cliente — um node:fs aqui quebraria o build do jogo.
 *
 * O index.ts ao lado e a metade que fala com o disco. A regra do D-04 continua
 * a mesma: nenhum arquivo do servidor fora de server/engine/ importa de src/.
 */

import {
  PlayerDatabaseSchema,
  PlayerVersionSchema,
  RoleSchema,
  ChampionEntrySchema,
  ChampionCatalogueSchema,
  type PlayerVersion,
  type Role,
  type ChampionEntry,
} from "../../src/data/schema";
import { generateRound, ALL_ROLES } from "../../src/draft/orchestrator";
import type { RoundCandidates } from "../../src/draft/types";
import { deckSafety, deckShortfalls, type DeckSafety } from "../../src/draft/deckSafety";
import { mulberry32, seedFromString } from "../../src/sim/rng";
import { assignTeamIdentities, tagFromName, type TeamIdentity } from "../../src/tournament/teamNames";
import {
  SlotIdSchema,
  StoredGameSchema,
  TournamentTeamSchema,
  TournamentStateSchema,
  isUserTeam,
  USER_TEAM_ID,
  type SlotId,
  type StoredGame,
  type TournamentTeam,
  type TournamentState,
  type SeriesState,
} from "../../src/tournament/schema";

export {
  PlayerDatabaseSchema,
  PlayerVersionSchema,
  RoleSchema,
  generateRound,
  ALL_ROLES,
  deckSafety,
  deckShortfalls,
  mulberry32,
  seedFromString,
  assignTeamIdentities,
  ChampionEntrySchema,
  ChampionCatalogueSchema,
  SlotIdSchema,
  StoredGameSchema,
  TournamentTeamSchema,
  TournamentStateSchema,
  tagFromName,
  isUserTeam,
  USER_TEAM_ID,
};

export type {
  PlayerVersion,
  Role,
  RoundCandidates,
  DeckSafety,
  TeamIdentity,
  ChampionEntry,
  SlotId,
  StoredGame,
  TournamentTeam,
  TournamentState,
  SeriesState,
};
