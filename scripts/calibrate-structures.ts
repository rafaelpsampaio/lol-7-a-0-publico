/**
 * scripts/calibrate-structures.ts
 *
 * Harness de calibracao estrutural e de combate (Fase 16 / CAL-01 + CAL-02).
 * Executar: npm run calibrate:structures  (via vitest, config dedicada)
 *
 * Roda N=800 partidas deterministicas por tier e reporta TODAS as metricas de D-05:
 *   CAL-01: distribuicoes estruturais (1a torre p5/p50/p95, torres por checkpoint,
 *           freqs de tier precoce, duracao media, torres por jogo)
 *   CAL-02: combate (multikill por faixa, quadra<8, ace<8, casualty por fase),
 *           objetivos (Baron aos 20:00 + setup forte, ator de secure),
 *           tickers (% com nome real, zero placeholders de role)
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = i por partida, nunca seed compartilhada
 *   - Sem Math.random: apenas mulberry32(seed)
 *   - Asserts duros APENAS para invariantes fisicos (Baron nunca antes dos 20:00)
 *   - O baseline QUEBRADO nao falha o build (Pitfall 2 do RESEARCH.md)
 *   - Relatorio pt-BR sem o caractere travessao
 *
 * Limitacoes documentadas do baseline (Fase 16):
 *   - "inner<10min" e "nexusTurret<20min" usam proxy sequencial por lane (sem campo
 *     tier em EventKind); nao e leitura exata de ev.map. Sera refinado nas fases 17-22.
 *
 * Percentil centralizado (Fase 23 / INST-06): a definicao local foi removida e
 * substituida por import de scripts/stats.ts. Metodo inalterado (indice arredondado,
 * DEC-04); a migracao trocou implementacao, nunca o numero de nenhum gate.
 */

import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES, DEFAULT_SIM_CONFIG } from "../src/sim/matchState";
import type { PlayerVersion, Role } from "../src/data/schema";
import type { SimulationResult } from "../src/sim/engine";
import type { SimEvent } from "../src/sim/simEvents";
import { percentile } from "./stats";
import { checkBand, expectBands, formatBandTable, type BandResult } from "./bands";

// ---------------------------------------------------------------------------
// Configuracao
// ---------------------------------------------------------------------------

/** Numero de partidas por tier. Piso do roadmap: 200; usar 800 para distribuicoes estaveis. */
const N = 800;

// ---------------------------------------------------------------------------
// Rosters reais (Pitfall 3: fetch NAO funciona em Vitest/Node)
// ---------------------------------------------------------------------------

const _rawPlayers = JSON.parse(
  readFileSync(join(process.cwd(), "public/players.json"), "utf8")
);
const allPlayers: PlayerVersion[] = _rawPlayers.players;

// ---------------------------------------------------------------------------
// Builders de fixture sintetico flat (copiados verbatim de calibrate-micro.ts:45-67)
// Stat uniforme em todos os campos -> neutralidade (INV-1)
// ---------------------------------------------------------------------------

function makePlayer(id: string, role: Role, stat: number): PlayerVersion {
  return {
    id,
    personId: id,
    displayName: `${id} 2024`,
    year: 2024,
    roles: [role],
    primaryRole: role,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: stat },
    lanePhase: stat,
    midGame: stat,
    lateGame: stat,
    traits: [],
    championPool: Array.from({ length: 8 }, (_, i) => ({
      championId: `c${i}`,
      mastery: 3 as const,
    })),
  };
}

function roster(prefix: string, stat: number): PlayerVersion[] {
  return ROLES.map((r) => makePlayer(`${prefix}-${r}`, r, stat));
}

// ---------------------------------------------------------------------------
// Acumulador de estatisticas estruturais e de combate (D-05)
// ---------------------------------------------------------------------------

interface StructureStats {
  games: number;

  // --- Estruturas ---
  /** Array de timeSec da 1a torre por partida (para p5/p50/p95 ao final). */
  firstTowerSec: number[];
  /** Torres destruidas antes de 5 minutos (300s). */
  towerBefore5Min: number;
  /**
   * Inferencia de "inner < 10min" por proxy sequencial por lane.
   * LIMITACAO DOCUMENTADA: EventKind nao distingue tier de torre. Usamos
   * contador de tower_destroyed por lane para inferir sequencia outer->inner.
   * Decisao de baseline da Fase 16 -- sem mudanca de comportamento.
   */
  innerBefore10Min: number;
  /** Inibidor destruido antes de 16 minutos (960s). */
  inhibBefore16Min: number;
  /**
   * Inferencia de "nexusTurret < 20min" por proxy sequencial por lane.
   * LIMITACAO DOCUMENTADA: identica ao inner acima.
   */
  nexusTurretBefore20Min: number;
  /** Baron tomado ANTES do spawn (timeSec < 1200). Invariante fisico: DEVE ser 0. */
  baronBeforeSpawn: number;
  /** Contagem de plate_taken (placa coletada, visivel). Deve ser > 0 no early. */
  plateTaken: number;
  /** Contagem de tower_low (torre em estado critico, visivel). Deve ser > 0 antes da 1a torre. */
  towerLow: number;
  /** Duracoes totais (seg) para calcular media. */
  totalDurationSec: number;
  /** Torres totais destruidas (user + rival) por partida para media. */
  totalTowers: number;
  /**
   * Array com o numero de torres destruidas por partida (user + rival).
   * Usado para calcular media e p95 para o assert do criterio 3.
   * criterio 3: total de torres plausivel
   */
  towersPerGameArr: number[];
  /** Torres do user acumuladas no primeiro snapshot apos cada checkpoint de minuto. */
  userTowersAt: Record<number, number>;
  /** Torres do rival acumuladas no primeiro snapshot apos cada checkpoint de minuto. */
  rivalTowersAt: Record<number, number>;
  /**
   * Numero de jogos que efetivamente ALCANCARAM cada checkpoint. Denominador
   * correto para a media de torres por checkpoint: jogos que terminam antes de um
   * checkpoint nao contribuem para a soma, entao tambem nao devem entrar no divisor.
   */
  checkpointGames: Record<number, number>;

  // --- Combate ---
  /**
   * Contadores de multikill por faixa de 5 minutos.
   * Chave: Math.floor(timeSec / 60 / 5) * 5 (ex: 0 = 0-5min, 5 = 5-10min, ...).
   */
  multiKillByBucket: Record<string, { double: number; triple: number; quadra: number; penta: number }>;
  /** Quadrakill antes de 8 minutos (480s). */
  quadraBefore8Min: number;
  /** Ace antes de 8 minutos (480s). */
  aceBefore8Min: number;
  /** Mortes por fase: early (<840s), mid (840-1500s), late (>1500s). */
  casualtyEarly: number;
  casualtyMid: number;
  casualtyLate: number;

  // --- Objetivos ---
  /**
   * Quantos Baron tomados no instante do spawn (timeSec === 1200).
   * Deve ser 0 em todos os tiers (invariante fisico de objectives.ts:229).
   */
  baronAtSpawnCount: number;
  /**
   * Quantos Baron tomados com "setup forte" aparente.
   * Proxy conservador: olhar ev.map no momento do baron e verificar se
   * jungler do side ativo estava vivo e pelo menos 3 jogadores estavam vivos.
   */
  baronWithStrongSetup: number;
  /** Contagem total de baron_taken + baron_steal. */
  baronTotal: number;
  /** Ator de secure de baron/dragon/herald (displayName -> contagem). */
  securerCounts: Record<string, number>;

  // --- Tickers ---
  /** Eventos ctx_* com role generica ("ADC"|"Support"|"Top"|"Mid"|"Jungle") no ticker. */
  tickerGenericRole: number;
  /** Total de eventos ctx_* encontrados. */
  tickerCtxTotal: number;

  // --- Gates STR-05 (cascata) ---
  /**
   * Array de gaps (em segundos) entre quedas consecutivas na MESMA lane (por side).
   * Para cada partida, mantemos o ultimo timeSec de queda por (side, lane) e
   * acumulamos a diferenca quando a mesma lane cai novamente.
   * Usado para calcular gapP50SameLane.
   */
  sameLaneGapSec: number[];
  /**
   * Contador de pares de torres de LANES DIFERENTES caindo com gap < 15s
   * (gap cross-lane quase-simultaneo -- invariante STR-05b).
   * Inclui eventos tower_destroyed e first_tower.
   */
  crossLaneSimultaneous: number;

  // --- Gates STR-06 (ator de estrutura) ---
  /**
   * Mapa de role para contagem de ator em eventos de queda early (<840s).
   * "ator correto" = laner da lane (top/mid/adc) ou jungler.
   * "ator incorreto" = support ou ADC fora de bot.
   */
  actorEarlyByRole: Record<string, number>;
  /** Denominador total de eventos de queda early com ator identificado. */
  actorEarlyTotal: number;
  /** Contagem de eventos em que o ator (qualquer fase) e support. */
  supportActorTotal: number;
  /** Denominador total de eventos de queda de estrutura (torre/inhibidor) com ator. */
  actorTotalForSupport: number;
  /** ADC como ator de queda em top/mid early (<840s). */
  adcWrongLaneEarly: number;
}

const CHECKPOINTS = [10, 15, 20, 25, 30] as const;
const GENERIC_ROLES = ["ADC", "Support", "Top", "Mid", "Jungle"];

function emptyStats(): StructureStats {
  const checkpointRecord = (): Record<number, number> =>
    Object.fromEntries(CHECKPOINTS.map((c) => [c, 0]));
  return {
    games: 0,
    firstTowerSec: [],
    towerBefore5Min: 0,
    innerBefore10Min: 0,
    inhibBefore16Min: 0,
    nexusTurretBefore20Min: 0,
    baronBeforeSpawn: 0,
    plateTaken: 0,
    towerLow: 0,
    totalDurationSec: 0,
    totalTowers: 0,
    towersPerGameArr: [],
    userTowersAt: checkpointRecord(),
    rivalTowersAt: checkpointRecord(),
    checkpointGames: checkpointRecord(),
    multiKillByBucket: {},
    quadraBefore8Min: 0,
    aceBefore8Min: 0,
    casualtyEarly: 0,
    casualtyMid: 0,
    casualtyLate: 0,
    baronAtSpawnCount: 0,
    baronWithStrongSetup: 0,
    baronTotal: 0,
    securerCounts: {},
    tickerGenericRole: 0,
    tickerCtxTotal: 0,
    // Gates STR-05 (cascata)
    sameLaneGapSec: [],
    crossLaneSimultaneous: 0,
    // Gates STR-06 (ator)
    actorEarlyByRole: {},
    actorEarlyTotal: 0,
    supportActorTotal: 0,
    actorTotalForSupport: 0,
    adcWrongLaneEarly: 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(num: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((num / total) * 100).toFixed(1)}%`;
}

function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// analyse: acumula metricas D-05 de uma partida
// ---------------------------------------------------------------------------

function analyse(res: SimulationResult, st: StructureStats): void {
  st.games++;
  st.totalDurationSec += res.durationSec;
  const gameTowers = res.finalState.user.towersDestroyed + res.finalState.rival.towersDestroyed;
  st.totalTowers += gameTowers;
  st.towersPerGameArr.push(gameTowers);

  // Rastreamento de torres por lane para proxy de tier sequencial.
  // Conta quantas tower_destroyed ocorreram em cada lane (por side) ate o momento.
  const laneTowerCount: Record<string, Record<string, number>> = {
    user: { top: 0, mid: 0, bot: 0 },
    rival: { top: 0, mid: 0, bot: 0 },
  };

  // Rastreamento de gaps between quedas na mesma lane (STR-05a).
  // Chave: "side:lane" -> ultimo timeSec de queda de estrutura nessa lane.
  const lastDestroyedInLane: Record<string, number> = {};
  // Rastreamento do ultimo evento de queda (qualquer lane/side) para cross-lane (STR-05b).
  let lastDestroyedAnySec: number | null = null;

  // Rastreamento de checkpoints (pegar snapshot na primeira oportunidade apos cada checkpoint).
  const checkpointDone = new Set<number>();

  for (const ev of res.timeline) {
    const t = ev.timeSec;

    // --- Checkpoints de torres ---
    for (const cp of CHECKPOINTS) {
      if (!checkpointDone.has(cp) && t >= cp * 60) {
        st.userTowersAt[cp] += ev.score.userTowers;
        st.rivalTowersAt[cp] += ev.score.rivalTowers;
        st.checkpointGames[cp]++; // este jogo alcancou o checkpoint cp
        checkpointDone.add(cp);
      }
    }

    // --- 1a torre ---
    if (ev.kind === "first_tower") {
      st.firstTowerSec.push(t);
    }

    // --- Torres antes de 5min ---
    if ((ev.kind === "tower_destroyed" || ev.kind === "first_tower") && t < 300) {
      st.towerBefore5Min++;
    }

    // --- Proxy sequencial de tier de torre ---
    // Quando uma torre cai em determinada lane de um side, incrementamos o contador.
    // Sequencia: 1a queda = outer, 2a = inner, 3a = inhibTurret, 4a = nexusTurret.
    // Esta e a LIMITACAO DOCUMENTADA do baseline da Fase 16.
    if (ev.kind === "tower_destroyed" || ev.kind === "first_tower") {
      // Inferir o side afetado: o score indica quem destruiu a torre.
      // O side que destruiu e o "atacante"; a estrutura que caiu e do "defensor".
      // ev.side = time que realizou a acao; a torre que cai e do time oposto.
      const lane = ev.lane === "top" || ev.lane === "mid" || ev.lane === "bot" ? ev.lane : null;
      if (lane && ev.side) {
        // A torre que caiu e do oponente do side ativo.
        const defenderSide = ev.side === "user" ? "rival" : "user";
        const prevCount = laneTowerCount[defenderSide][lane];
        laneTowerCount[defenderSide][lane]++;

        // prevCount 0 = outer (ja contado acima como towerBefore5Min/firstTower)
        // prevCount 1 = inner (caida apos outer)
        if (prevCount === 1 && t < 600) {
          st.innerBefore10Min++;
        }
        // prevCount 3 = nexusTurret (caida apos outer, inner, inhibTurret)
        if (prevCount === 3 && t < 1200) {
          st.nexusTurretBefore20Min++;
        }
      }
    }

    // --- Inibidor antes de 16min ---
    if (ev.kind === "inhibitor_destroyed" && t < 960) {
      st.inhibBefore16Min++;
    }

    // --- Gates STR-05: gap entre quedas de estrutura (torres) ---
    // Acumular gaps entre quedas consecutivas na MESMA lane e detectar quedas
    // cross-lane quase-simultaneas (gap < 15s entre torres de lanes diferentes).
    if ((ev.kind === "tower_destroyed" || ev.kind === "first_tower") && ev.side && ev.lane) {
      const structLane = ev.lane === "top" || ev.lane === "mid" || ev.lane === "bot" ? ev.lane : null;
      if (structLane) {
        // Gap same-lane: chave combina o side atacante e a lane da torre que CAIU
        // (defender side = oponente do side ativo; mas a lane e a mesma).
        // Identificamos a lane pelo ev.lane e o "canal" pelo lado DEFENSOR da torre.
        const defSide = ev.side === "user" ? "rival" : "user";
        const laneKey = `${defSide}:${structLane}`;
        if (laneKey in lastDestroyedInLane) {
          const gap = t - lastDestroyedInLane[laneKey];
          st.sameLaneGapSec.push(gap);
        }
        lastDestroyedInLane[laneKey] = t;

        // Cross-lane simultaneous: detectar se alguma torre de lane DIFERENTE caiu
        // com gap < 15s antes deste evento.
        // Para isso comparamos o ultimo timeSec de qualquer queda de estrutura.
        if (lastDestroyedAnySec !== null) {
          const crossGap = t - lastDestroyedAnySec;
          if (crossGap < 15) {
            // Confirmar que e uma lane DIFERENTE (nao a mesma lane que acabou de cair)
            // A verificacao e: se o gap e < 15s E nao e a mesma lane+side, e cross-lane.
            // Como lastDestroyedAnySec pode ser da mesma lane, verificamos usando
            // a diferenca de timeSec como discriminador suficiente: se gap < 15s
            // e o evento anterior nao e desta mesma lane, conta como simultaneo.
            // (O gap same-lane ja e acumulado acima; aqui so contamos cross-lane.)
            // Para simplificar: acumulamos crossLaneSimultaneous quando gap < 15s,
            // independente se mesma ou diferente lane. O assert e toBe(0) no STOMP-FORTE
            // onde o cascade brake deve eliminar mesmo same-lane rapid fires.
            // Na pratica, o gap same-lane e coberto pelo assert gapP50SameLane.
            // Aqui contamos qualquer gap < 15s entre quedas consecutivas de torre.
            st.crossLaneSimultaneous++;
          }
        }
        lastDestroyedAnySec = t;
      }
    }

    // --- Gates STR-06: ator de estrutura por role ---
    // Avaliar o ator de eventos de queda de estrutura (tower_destroyed, first_tower,
    // inhibitor_destroyed) e classificar por role derivado do nome sintetico.
    // Para rosters sinteticos: ev.actors[0] == "u-top", "r-jungle", "u-adc", etc.
    // Para rosters reais: nome do jogador -- nao tentamos derivar role (seriam "Faker" etc).
    // A coleta aqui alimenta os gates STR-06 que sao validados no tier EQUILIBRADO.
    if (
      (ev.kind === "tower_destroyed" || ev.kind === "first_tower" || ev.kind === "inhibitor_destroyed") &&
      ev.actors.length > 0 &&
      ev.side
    ) {
      const actorName = ev.actors[0];
      // Extrair role do nome sintetico: "u-top" -> "top", "r-jungle" -> "jungle", "u-adc" -> "adc"
      // O formato e "{prefix}-{role}" onde role pode ser "top","mid","jungle","adc","support"
      const roleParts = actorName.split("-");
      const derivedRole = roleParts.length >= 2 ? roleParts[roleParts.length - 1].toLowerCase() : null;

      // So acumular para rosters sinteticos (derivedRole e reconhecida)
      const knownRoles = ["top", "mid", "jungle", "adc", "support"];
      if (derivedRole && knownRoles.includes(derivedRole)) {
        // Denominador para support rate: todos os eventos de estrutura com ator identificado
        st.actorTotalForSupport++;

        // Support como ator (qualquer fase)
        if (derivedRole === "support") {
          st.supportActorTotal++;
        }

        // Early (<840s): acumular por role e detectar ADC em lane errada
        if (t < 840) {
          st.actorEarlyTotal++;
          st.actorEarlyByRole[derivedRole] = (st.actorEarlyByRole[derivedRole] ?? 0) + 1;

          // ADC em top ou mid early = errado (D-06: ADC natural apenas em bot pre-14min)
          const structLaneForActor = ev.lane === "top" || ev.lane === "mid" || ev.lane === "bot" ? ev.lane : null;
          if (derivedRole === "adc" && structLaneForActor && structLaneForActor !== "bot") {
            st.adcWrongLaneEarly++;
          }
        }
      }
    }

    // --- Eventos menores estruturais (Phase 17, STR-04) ---
    if (ev.kind === "plate_taken") {
      st.plateTaken++;
    }
    if (ev.kind === "tower_low") {
      st.towerLow++;
    }

    // --- Baron ANTES do spawn (invariante fisico -- DEVE ser 0) ---
    // isObjectiveAvailable() em objectives.ts:229 impoe timeSec >= 1200.
    // Baron no instante exato do spawn (t === 1200) e permitido e medido como metrica.
    if ((ev.kind === "baron_taken" || ev.kind === "baron_steal") && t < 1200) {
      st.baronBeforeSpawn++;
    }

    // --- Objetivos: baron/dragon/herald total e ator ---
    if (ev.kind === "baron_taken" || ev.kind === "baron_steal") {
      st.baronTotal++;
      if (t === 1200) {
        st.baronAtSpawnCount++; // metrica: frequencia de baron no instante exato do spawn
      }
      // Verificar "setup forte": jungler do side ativo vivo + >= 3 jogadores vivos.
      if (ev.side) {
        const teamMap = ev.map[ev.side];
        const junglerAlive = teamMap.players.jungle.alive;
        const alivePlayers = Object.values(teamMap.players).filter((p) => p.alive).length;
        if (junglerAlive && alivePlayers >= 3) {
          st.baronWithStrongSetup++;
        }
      }
      if (ev.actors[0]) {
        const securer = ev.actors[0];
        st.securerCounts[securer] = (st.securerCounts[securer] ?? 0) + 1;
      }
    }
    if (ev.kind === "dragon_taken" || ev.kind === "dragon_steal") {
      if (ev.actors[0]) {
        const securer = ev.actors[0];
        st.securerCounts[securer] = (st.securerCounts[securer] ?? 0) + 1;
      }
    }
    if (ev.kind === "herald_taken") {
      if (ev.actors[0]) {
        const securer = ev.actors[0];
        st.securerCounts[securer] = (st.securerCounts[securer] ?? 0) + 1;
      }
    }

    // --- Multikill por faixa ---
    const multikillKinds = ["double_kill", "triple_kill", "quadra_kill", "penta_kill"] as const;
    if (multikillKinds.includes(ev.kind as typeof multikillKinds[number])) {
      const bucket = Math.floor(t / 60 / 5) * 5;
      const key = String(bucket);
      if (!st.multiKillByBucket[key]) {
        st.multiKillByBucket[key] = { double: 0, triple: 0, quadra: 0, penta: 0 };
      }
      if (ev.kind === "double_kill") st.multiKillByBucket[key].double++;
      if (ev.kind === "triple_kill") st.multiKillByBucket[key].triple++;
      if (ev.kind === "quadra_kill") st.multiKillByBucket[key].quadra++;
      if (ev.kind === "penta_kill") st.multiKillByBucket[key].penta++;
    }

    // --- Quadra/ace antes de 8min ---
    if (ev.kind === "quadra_kill" && t < 480) {
      st.quadraBefore8Min++;
    }
    if (ev.kind === "ace" && t < 480) {
      st.aceBefore8Min++;
    }

    // --- Casualty por fase ---
    // Contar mortes em eventos de kill (kill, double_kill, etc.).
    // IMPORTANTE: os eventos decoradores de multikill (double/triple/quadra/penta)
    // sao emitidos por makeMultikillEvent (engine.ts) SEM popular victims, entao
    // ev.victims.length e sempre 0 para eles. Se contassemos so ev.victims.length,
    // a distribuicao de casualties subnotificaria a maioria das mortes de teamfight.
    // Derivamos a magnitude pela propria categoria de multikill quando victims=[].
    // O evento "ace" tem actors/victims vazios e magnitude indeterminada: contamos
    // como 5 (time inteiro abatido), assumindo o pior caso documentado.
    const MULTIKILL_VICTIMS: Record<string, number> = {
      double_kill: 2,
      triple_kill: 3,
      quadra_kill: 4,
      penta_kill: 5,
      ace: 5,
    };
    const killKinds = [
      "first_blood", "kill", "death", "solo_kill", "gank", "dive",
      "double_kill", "triple_kill", "quadra_kill", "penta_kill", "shutdown", "ace",
    ];
    if (killKinds.includes(ev.kind)) {
      let victimCount = ev.victims.length;
      if (victimCount === 0 && ev.kind in MULTIKILL_VICTIMS) {
        victimCount = MULTIKILL_VICTIMS[ev.kind];
      }
      if (victimCount > 0) {
        if (t < 840) st.casualtyEarly += victimCount;
        else if (t < 1500) st.casualtyMid += victimCount;
        else st.casualtyLate += victimCount;
      }
    }

    // --- Tickers contextuais ---
    if (ev.kind.startsWith("ctx_")) {
      st.tickerCtxTotal++;
      const hasGenericRole = GENERIC_ROLES.some((role) => ev.ticker.includes(role));
      if (hasGenericRole) {
        st.tickerGenericRole++;
      }
    }
  }

  // Checkpoints nao visitados (partida terminou antes): copiar o ultimo valor
  // (ou zero se a partida acabou antes do checkpoint).
  // Nao adicionar nada -- o score final nao e o mesmo que o score em X minutos.
}

// ---------------------------------------------------------------------------
// TierResult
// ---------------------------------------------------------------------------

interface TierResult {
  name: string;
  st: StructureStats;
  userWins: number;
  report: string;
}

// ---------------------------------------------------------------------------
// runTier: laco deterministico seed=i + relatorio pt-BR do tier
// ---------------------------------------------------------------------------

function runTier(name: string, us: number, rs: number, n = N): TierResult {
  const st = emptyStats();
  let userWins = 0;
  for (let seed = 0; seed < n; seed++) {
    // INVARIANTE: seed = i por partida, nunca seed compartilhada; sem Math.random
    const res = simulateMatch(roster("u", us), roster("r", rs), mulberry32(seed));
    analyse(res, st);
    if (res.winner === "user") userWins++;
  }

  const sortedFirstTower = [...st.firstTowerSec].sort((a, b) => a - b);
  const p5 = percentile(sortedFirstTower, 5);
  const p50 = percentile(sortedFirstTower, 50);
  const p95 = percentile(sortedFirstTower, 95);

  let report = `\n=== TIER ${name} (user ${us} vs rival ${rs}, ${n} jogos) ===\n`;
  report += `\n  -- Resultados gerais --\n`;
  report += `  win-rate user:           ${pct(userWins, n)}\n`;
  report += `  duracao media:           ${mmss(st.totalDurationSec / st.games)}\n`;
  report += `  torres totais/jogo:      ${(st.totalTowers / st.games).toFixed(2)}\n`;

  report += `\n  -- Estruturas (1a torre) --\n`;
  report += `  1a torre p5:             ${mmss(p5)} (${p5}s)\n`;
  report += `  1a torre p50:            ${mmss(p50)} (${p50}s)\n`;
  report += `  1a torre p95:            ${mmss(p95)} (${p95}s)\n`;
  // ATENCAO: estes sao contadores de EVENTOS (um jogo pode contribuir varias quedas
  // de torre/inner por lane), nao de jogos. Reportar como pct(.., n) produzia
  // "porcentagens" > 100% (categoria errada: eventos / jogos). Reportamos como
  // MEDIA DE EVENTOS POR JOGO, que e a metrica interpretavel correta.
  report += `  torre < 5min (por jogo):     ${(st.towerBefore5Min / st.games).toFixed(2)} (${st.towerBefore5Min} eventos)\n`;
  report += `  plate_taken (por jogo):      ${(st.plateTaken / st.games).toFixed(2)} (${st.plateTaken} eventos)\n`;
  report += `  tower_low (por jogo):        ${(st.towerLow / st.games).toFixed(2)} (${st.towerLow} eventos)\n`;
  report += `  inner < 10min (proxy/jogo):  ${(st.innerBefore10Min / st.games).toFixed(2)} (${st.innerBefore10Min} eventos)\n`;
  report += `  inhib < 16min (por jogo):    ${(st.inhibBefore16Min / st.games).toFixed(2)} (${st.inhibBefore16Min} eventos)\n`;
  report += `  nexusTurret < 20min (proxy/jogo): ${(st.nexusTurretBefore20Min / st.games).toFixed(2)} (${st.nexusTurretBefore20Min} eventos)\n`;
  report += `  [AVISO: valores sao media de eventos por jogo (nao % de jogos); inner/nexusTurret usam proxy sequencial por lane, nao tier exato]\n`;

  report += `\n  -- Torres por checkpoint (media user | rival) --\n`;
  for (const cp of CHECKPOINTS) {
    // Denominador correto: jogos que ALCANCARAM o checkpoint, nao st.games (todos).
    // Jogos que terminam antes do checkpoint nao somam torres nem entram no divisor.
    const reached = st.checkpointGames[cp];
    const denom = Math.max(1, reached);
    const uAvg = (st.userTowersAt[cp] / denom).toFixed(2);
    const rAvg = (st.rivalTowersAt[cp] / denom).toFixed(2);
    report += `  Torres aos ${String(cp).padStart(2)}min:          user ${uAvg} | rival ${rAvg} (${reached}/${st.games} jogos alcancaram)\n`;
  }

  report += `\n  -- Combate --\n`;
  report += `  quadra < 8min:           ${pct(st.quadraBefore8Min, n)} (${st.quadraBefore8Min}/${n})\n`;
  report += `  ace < 8min:              ${pct(st.aceBefore8Min, n)} (${st.aceBefore8Min}/${n})\n`;
  const totalEvents = st.casualtyEarly + st.casualtyMid + st.casualtyLate;
  report += `  casualty early (<14min): ${st.casualtyEarly} (${pct(st.casualtyEarly, totalEvents)} do total)\n`;
  report += `  casualty mid (14-25min): ${st.casualtyMid} (${pct(st.casualtyMid, totalEvents)} do total)\n`;
  report += `  casualty late (>25min):  ${st.casualtyLate} (${pct(st.casualtyLate, totalEvents)} do total)\n`;

  report += `\n  -- Multikill por faixa de 5 min --\n`;
  const buckets = Object.keys(st.multiKillByBucket)
    .map(Number)
    .sort((a, b) => a - b);
  if (buckets.length === 0) {
    report += `  (nenhum multikill registrado)\n`;
  } else {
    report += `  Faixa     Double  Triple  Quadra  Penta\n`;
    report += `  --------  ------  ------  ------  -----\n`;
    for (const b of buckets) {
      const mk = st.multiKillByBucket[String(b)];
      const label = `${b}-${b + 5}min`;
      report += `  ${label.padEnd(9)} ${String(mk.double).padStart(6)}  ${String(mk.triple).padStart(6)}  ${String(mk.quadra).padStart(6)}  ${String(mk.penta).padStart(5)}\n`;
    }
  }

  report += `\n  -- Objetivos --\n`;
  report += `  Baron total:             ${st.baronTotal}\n`;
  report += `  Baron no spawn (20:00):  ${st.baronAtSpawnCount} (${pct(st.baronAtSpawnCount, Math.max(1, st.baronTotal))} dos barons)\n`;
  report += `  Baron com setup forte:   ${st.baronWithStrongSetup} (${pct(st.baronWithStrongSetup, Math.max(1, st.baronTotal))} dos barons)\n`;
  const topSecurers = Object.entries(st.securerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  report += `  Top-5 atores de secure:  ${topSecurers.map(([name, count]) => `${name} (${count})`).join(", ") || "(nenhum)"}\n`;

  report += `\n  -- Tickers contextuais --\n`;
  report += `  Total eventos ctx_*:     ${st.tickerCtxTotal}\n`;
  report += `  Com role generica:       ${st.tickerGenericRole} (${pct(st.tickerGenericRole, Math.max(1, st.tickerCtxTotal))})\n`;

  // --- Gates STR-05: gap same-lane e cross-lane simultaneo ---
  const sortedGaps = [...st.sameLaneGapSec].sort((a, b) => a - b);
  const gapP50SameLane = percentile(sortedGaps, 50);
  const actorEarlyCorrectRate =
    st.actorEarlyTotal > 0
      ? (st.actorEarlyTotal - (st.actorEarlyByRole["support"] ?? 0) - st.adcWrongLaneEarly) / st.actorEarlyTotal
      : 0;
  const supportActorRate =
    st.actorTotalForSupport > 0 ? st.supportActorTotal / st.actorTotalForSupport : 0;
  const adcWrongLaneEarlyRate =
    st.actorEarlyTotal > 0 ? st.adcWrongLaneEarly / st.actorEarlyTotal : 0;

  report += `\n  -- Gates STR-05 (cascata) --\n`;
  report += `  gap p50 same-lane:       ${mmss(gapP50SameLane)} (${gapP50SameLane.toFixed(0)}s) [gate EQUILIBRADO >= 120s]\n`;
  report += `  cross-lane simultaneo:   ${st.crossLaneSimultaneous} eventos (gap < 15s) [gate STOMP-FORTE = 0]\n`;
  report += `  amostras de gap:         ${st.sameLaneGapSec.length}\n`;

  report += `\n  -- Gates STR-06 (ator de estrutura) --\n`;
  report += `  ator early correto:      ${pct(Math.round(actorEarlyCorrectRate * st.actorEarlyTotal), st.actorEarlyTotal)} (${actorEarlyCorrectRate.toFixed(3)}) [gate >= 85%]\n`;
  report += `  support como ator:       ${pct(st.supportActorTotal, Math.max(1, st.actorTotalForSupport))} (${supportActorRate.toFixed(3)}) [gate < 5%]\n`;
  report += `  ADC fora de bot early:   ${pct(st.adcWrongLaneEarly, Math.max(1, st.actorEarlyTotal))} (${adcWrongLaneEarlyRate.toFixed(3)}) [gate < 2%]\n`;
  report += `  ator early total:        ${st.actorEarlyTotal} eventos\n`;
  report += `  ator total (qualquer):   ${st.actorTotalForSupport} eventos\n`;
  const roleKeys = ["top", "mid", "jungle", "adc", "support"];
  report += `  distribuicao early:      ${roleKeys.map((r) => `${r}:${st.actorEarlyByRole[r] ?? 0}`).join(", ")}\n`;

  return { name, st, userWins, report };
}

// ---------------------------------------------------------------------------
// Harness principal
// ---------------------------------------------------------------------------

describe("calibrate-structures -- distribuicoes estruturais + combate baseline", () => {
  it("roda N partidas deterministicas e registra baseline QUEBRADO (CAL-01 + CAL-02)", () => {
    // --- D-07: 3 tiers obrigatorios ---
    const tiers = [
      runTier("EQUILIBRADO", 70, 70),
      runTier("GAP-LEVE", 72, 68),
      runTier("STOMP-FORTE", 85, 55),
    ];

    // --- D-06: passada de rosters reais ---
    // Montar um roster de 5 (um por role) dos jogadores reais do players.json.
    // Usar os primeiros disponiveis por role para reproducao deterministica.
    function firstByRole(role: Role): PlayerVersion {
      const found = allPlayers.find((p) => p.primaryRole === role);
      if (!found) throw new Error(`Nenhum jogador com primaryRole=${role} em players.json`);
      return found;
    }
    const realRosterUser: PlayerVersion[] = ROLES.map((r) => firstByRole(r));

    // Usar os SEGUNDOS por role para o time rival (diferente do user).
    // Se houver apenas 1 jogador real para uma role, o fallback reusa o MESMO card
    // do user -> mirror-match (mesmo personId nos dois lados), exatamente a condicao
    // do Sintoma 8. Coletamos avisos para nao confiar cegamente nos numeros reais.
    const mirrorWarnings: string[] = [];
    function secondByRole(role: Role): PlayerVersion {
      const found = allPlayers.filter((p) => p.primaryRole === role);
      if (found.length < 2) {
        mirrorWarnings.push(
          `  AVISO: apenas 1 jogador real com role=${role}; rival reusa o mesmo card (mirror-match).`
        );
      }
      return found[1] ?? found[0]; // fallback para o primeiro se so houver um
    }
    const realRosterRival: PlayerVersion[] = ROLES.map((r) => secondByRole(r));

    const stReal = emptyStats();
    let realUserWins = 0;
    const N_REAL = 100; // passada menor para rosters reais
    for (let seed = 0; seed < N_REAL; seed++) {
      const res = simulateMatch(realRosterUser, realRosterRival, mulberry32(seed));
      analyse(res, stReal);
      if (res.winner === "user") realUserWins++;
    }

    let realReport = `\n=== PASSADA DE ROSTERS REAIS (players.json, ${N_REAL} jogos) ===\n`;
    realReport += `  user roster: ${realRosterUser.map((p) => p.displayName).join(", ")}\n`;
    realReport += `  rival roster: ${realRosterRival.map((p) => p.displayName).join(", ")}\n`;
    if (mirrorWarnings.length > 0) {
      realReport += mirrorWarnings.join("\n") + "\n";
      realReport += `  [ATENCAO: ${mirrorWarnings.length} role(s) com mirror-match; numeros reais contaminados por self-matchup]\n`;
    }
    realReport += `  win-rate user: ${pct(realUserWins, N_REAL)}\n`;
    const sortedRealFirstTower = [...stReal.firstTowerSec].sort((a, b) => a - b);
    realReport += `  1a torre p50: ${mmss(percentile(sortedRealFirstTower, 50))}\n`;
    realReport += `  quadra < 8min: ${pct(stReal.quadraBefore8Min, N_REAL)} (${stReal.quadraBefore8Min}/${N_REAL})\n`;
    realReport += `  Baron no spawn: ${stReal.baronAtSpawnCount}\n`;
    realReport += `  tickers ctx_* com role generica: ${pct(stReal.tickerGenericRole, Math.max(1, stReal.tickerCtxTotal))}\n`;

    // --- D-08 / Sintoma 8: Gumayusi vs Gumayusi (reproducao proposital) ---
    // NAO resolve o draft -- so diagnostica.
    const gumayusi = allPlayers.find((p) => p.id === "gumayusi-2022");
    let symptom8Report = `\n=== SINTOMA 8: Gumayusi vs Gumayusi (diagnostico de self-kill / roster duplicado) ===\n`;

    if (!gumayusi) {
      symptom8Report += `  AVISO: gumayusi-2022 nao encontrado em players.json -- diagnostico ignorado.\n`;
    } else {
      const zeus = allPlayers.find((p) => p.id === "zeus-2022");
      const canyon = allPlayers.find((p) => p.id === "canyon-2021");
      const faker = allPlayers.find((p) => p.id === "faker-2016");
      const keria = allPlayers.find((p) => p.id === "keria-2021");
      const bin = allPlayers.find((p) => p.id === "bin-2021");
      const oner = allPlayers.find((p) => p.id === "oner-2022");
      const showmaker = allPlayers.find((p) => p.id === "showmaker-2020");
      const beryl = allPlayers.find((p) => p.id === "beryl-2021");

      if (zeus && canyon && faker && keria && bin && oner && showmaker && beryl) {
        const userRosterSym: PlayerVersion[] = [zeus, canyon, faker, gumayusi, keria];
        const rivalRosterSym: PlayerVersion[] = [bin, oner, showmaker, gumayusi, beryl];

        const resSymptom = simulateMatch(userRosterSym, rivalRosterSym, mulberry32(0));

        // Filtrar eventos de kill onde actors[0] e victims[0] tem o mesmo displayName base.
        const selfKillEvents = resSymptom.timeline.filter((ev) => {
          if (ev.actors.length === 0 || ev.victims.length === 0) return false;
          // Comparar nome base (sem o ano) -- Gumayusi 2022 em ambos os lados.
          const actorBase = ev.actors[0].split(" ")[0].toLowerCase();
          const victimBase = ev.victims[0].split(" ")[0].toLowerCase();
          return actorBase === victimBase;
        });

        symptom8Report += `  user roster: ${userRosterSym.map((p) => p.displayName).join(", ")}\n`;
        symptom8Report += `  rival roster: ${rivalRosterSym.map((p) => p.displayName).join(", ")}\n`;
        symptom8Report += `  Partidas com mesmo nome base em actor/victim: ${selfKillEvents.length} eventos\n`;
        if (selfKillEvents.length > 0) {
          symptom8Report += `  Primeiros 5 eventos com self-like kill:\n`;
          for (const ev of selfKillEvents.slice(0, 5)) {
            symptom8Report += `    kind=${ev.kind} t=${ev.timeSec}s actors=[${ev.actors.join(", ")}] victims=[${ev.victims.join(", ")}]\n`;
            // Logar cardId/personId/displayName/teamId para diagnostico
            // O engine nao expoe teamId diretamente no SimEvent, mas side indica o time do ator.
            symptom8Report += `      side(ator)=${ev.side ?? "null"} ticker="${ev.ticker}"\n`;
          }
        } else {
          symptom8Report += `  Nenhum evento com mesmo nome base detectado nesta seed -- sintoma pode ser raro ou o displayName difere.\n`;
        }
      } else {
        symptom8Report += `  AVISO: Alguns jogadores necessarios para o sintoma 8 nao foram encontrados em players.json.\n`;
        symptom8Report += `  Jogadores ausentes: ${[
          !zeus && "zeus-2022", !canyon && "canyon-2021", !faker && "faker-2016",
          !keria && "keria-2021", !bin && "bin-2021", !oner && "oner-2022",
          !showmaker && "showmaker-2020", !beryl && "beryl-2021",
        ].filter(Boolean).join(", ")}\n`;
      }
    }

    const tierEquilibrado = tiers.find((t) => t.name === "EQUILIBRADO")!;
    const tierStomp = tiers.find((t) => t.name === "STOMP-FORTE")!;
    const sortedEquilibrado = [...tierEquilibrado.st.firstTowerSec].sort((a, b) => a - b);

    // ---------------------------------------------------------------------------
    // BANDAS DE DOIS LADOS (Fase 25, criterio 2 do roadmap)
    //
    // Conversao do Gate 2 deste arquivo, que era assert de UM LADO SO (mediana da
    // primeira torre no EQUILIBRADO maior que 540 s). O PISO CONTINUA 540, BYTE A BYTE
    // O MESMO NUMERO DO ASSERT ORIGINAL DA FASE 17 (STR-01 e D-03): quem ler o diff vai
    // ver um assert virar outra coisa e precisa saber de imediato que o piso NAO se moveu.
    // A Fase 25 apenas ACRESCENTA TETO, nunca afrouxa piso.
    //
    // Por que converter, com os numeros da pesquisa (25-RESEARCH.md, Armadilha 9):
    //   - hoje o gate passa com 1347 s contra piso de 540 s, ou seja com 149 por cento
    //     de folga, e assert que passa com folga acima de 100 por cento e assert vacuo;
    //   - depois do conserto de throughput a mediana desce para perto de 880 s e a folga
    //     cai para 63 por cento;
    //   - assert de um lado so e exatamente o padrao que a v2.0 usou para aprovar 13 de 13
    //     criterios verdes numa engine de 51 minutos. A Fase 30 tem criterio proprio para
    //     re-ancorar asserts vacuos.
    //
    // DIFERENCA DE FIXTURE, que precisa estar declarada na fonte: este harness usa
    // EQUILIBRADO 70 contra 70 (linha dos tiers acima), enquanto scripts/calibrate-pace.ts
    // usa 75 contra 75. As duas medianas de primeira torre NAO sao comparaveis linha a linha.
    //
    // A lista e montada AQUI, antes da escrita do relatorio. A assercao (expectBands) roda
    // no fim do teste, depois de todos os gates duros de plausibilidade, para que uma
    // violacao futura de qualquer banda deste arquivo caia numa unica falha nomeada.
    //
    // AVISO DE AMOSTRA, MEDIDO NA FASE 25 E NAO CORRIGIDO AQUI (item diferido, ver
    // .planning/phases/25-throughput-estrutural-o-canal-absoluto/deferred-items.md):
    // st.firstTowerSec deste arquivo so acumula eventos de kind "first_tower"
    // (analyse, o ramo da "1a torre"), e a engine so emite "first_tower" quando a
    // primeira estrutura da partida cai pelo ramo da outer de damageStructure
    // (src/sim/structures.ts:587 e :596). Medido com sonda propria a N=300 e seed = i:
    //   - eventos "first_tower" por partida: 0,13 no 70 contra 70 e 0,15 no 75 contra 75,
    //     ou seja apenas 13 a 15 por cento das partidas contribuem uma amostra;
    //   - p50 sobre essa subamostra: 705 s no 70 contra 70;
    //   - p50 sobre o PRIMEIRO evento de "first_tower" ou "tower_destroyed" por partida,
    //     que e a definicao usada por scripts/calibrate-pace.ts e cobre 300 de 300
    //     partidas: 1410 s no 70 contra 70 e 1380 s no 75 contra 75.
    // Ou seja: o numero desta banda vem de uma subamostra enviesada para quedas precoces,
    // e o 1347 s citado pelo ROADMAP.md Fase 25 criterio 2 corresponde a definicao ampla,
    // nao a esta. Corrigir a definicao mudaria tambem o Gate 1 (p5) e as tres linhas do
    // relatorio de baseline da Fase 16, o que esta FORA do escopo deste plano (o criterio 2
    // manda acrescentar teto, nao redefinir a metrica). O aviso fica escrito aqui e no
    // relatorio para que o verde desta linha nunca seja lido como verde limpo.
    // ---------------------------------------------------------------------------
    const bandResults: BandResult[] = [];
    bandResults.push(
      checkBand(
        "mediana da primeira torre no EQUILIBRADO (s)",
        percentile(sortedEquilibrado, 50),
        {
          floor: 540,
          ceiling: 1140,
          target: 970,
          source:
            "piso: assert original da Fase 17 (STR-01 e D-03), preservado byte a byte; " +
            "teto: STACK.md secao 7 (mediana de 13:00 a 19:00, referencia 15:04 a 16:37) e " +
            "ROADMAP.md Fase 25 criterio 2. Fixture 70 contra 70 deste harness, diferente " +
            "do 75 contra 75 de calibrate-pace",
          owner: "Fase 25",
        }
      )
    );

    // ---------------------------------------------------------------------------
    // Relatorio final pt-BR em tmp/calibration-structures.txt
    // ---------------------------------------------------------------------------

    let out = "RELATORIO DE CALIBRACAO ESTRUTURAL E DE COMBATE: Baseline QUEBRADO (Fase 16)\n";
    out += "===============================================================================\n";
    out += "\nNOTA: Este relatorio documenta o estado QUEBRADO da engine antes das correcoes\n";
    out += "das Fases 17-22. O harness mede, nao falha o build por estar quebrado.\n";
    out += "\nLIMITACOES DO BASELINE:\n";
    out += "  - inner<10min e nexusTurret<20min usam proxy sequencial por lane (sem campo\n";
    out += "    tier em EventKind). Nao e leitura exata de ev.map. Sera refinado nas fases 17-22.\n";

    for (const tier of tiers) {
      out += tier.report;
    }
    out += realReport;
    out += symptom8Report;

    out += "\n=== BANDAS DE DOIS LADOS (Fase 25) ===\n";
    out +=
      "Cada linha declara piso, teto, fonte e fase dona. Formato: [OK|FALHA] [dono] rotulo =\n" +
      "valor situacao [piso, teto], alvo X (fonte: X). A linha abaixo substitui o assert de\n" +
      "UM LADO SO da Fase 17 (mediana da primeira torre maior que 540 s): o piso 540 continua\n" +
      "byte a byte o mesmo, e a Fase 25 apenas acrescentou teto. Nenhum gate duro de\n" +
      "plausibilidade deste arquivo foi tocado.\n";
    out += formatBandTable(bandResults) + "\n";
    out +=
      `\nAVISO DE AMOSTRA (medido na Fase 25, nao corrigido aqui): a mediana acima vem de\n` +
      `${sortedEquilibrado.length} amostras em ${tierEquilibrado.st.games} partidas do tier EQUILIBRADO, porque este arquivo so\n` +
      `acumula eventos de kind "first_tower", e a engine so emite esse kind quando a primeira\n` +
      `estrutura da partida cai pelo ramo da outer (src/sim/structures.ts:587 e :596). A\n` +
      `subamostra e enviesada para quedas precoces. Sob a definicao ampla usada por\n` +
      `calibrate-pace (primeiro evento de "first_tower" ou "tower_destroyed", cobertura de\n` +
      `100 por cento das partidas) a mediana medida e 1410 s no 70 contra 70, acima do teto\n` +
      `desta banda. Item diferido com dono registrado no SUMMARY do Plano 25-01.\n`;

    try {
      mkdirSync("tmp", { recursive: true });
    } catch {
      // existe
    }
    writeFileSync("tmp/calibration-structures.txt", out);

    // ---------------------------------------------------------------------------
    // ASSERTS DUROS: invariantes fisicos (CAL-01)
    // ---------------------------------------------------------------------------

    for (const tier of tiers) {
      // Invariante fisico: Baron NUNCA pode ser tomado antes dos 20:00.
      // isObjectiveAvailable() em objectives.ts:229 impoe timeSec >= TIMERS.BARON_SPAWN = 1200.
      // Se este assert falhar, e um bug NOVO na engine -- nao e o baseline quebrado.
      expect(
        tier.st.baronBeforeSpawn,
        `Baron antes dos 20:00 (timeSec < 1200) no tier ${tier.name} -- invariante engine (objectives.ts:229)`
      ).toBe(0);
    }

    // ---------------------------------------------------------------------------
    // ASSERTS DUROS: gates de distribuicao estrutural (Phase 17, STR-01..STR-04, D-03)
    // Estes asserts sao NOVOS na Fase 17 -- medem o modelo de dano acumulado.
    // NAO afrouxar para passar -- calibrar a logica em vez do gate (D-03).
    // ---------------------------------------------------------------------------

    // Gate 1: p5 da 1a torre no EQUILIBRADO deve ser > 5min (300s).
    // Garante que nenhuma torre cai cedo demais mesmo em jogos favoraveis.
    // INTACTO: a Fase 25 nao toca este gate.
    expect(
      percentile(sortedEquilibrado, 5),
      "p5 da 1a torre (EQUILIBRADO) deve ser > 5min (300s) -- STR-01/D-03"
    ).toBeGreaterThan(300);

    // Gate 2: CONVERTIDO EM BANDA DE DOIS LADOS PELA FASE 25 (criterio 2 do roadmap).
    // O assert de um lado so que vivia aqui (mediana da 1a torre no EQUILIBRADO maior que
    // 540 s) virou a banda [540, 1140] declarada no bloco de bandas la em cima, com o piso
    // preservado byte a byte, e e asserido por expectBands no fim deste teste. A troca de
    // lugar e deliberada: as regras duras de plausibilidade rodam primeiro.

    // Gate 3: torre < 5min no STOMP-FORTE deve ser < 5% de eventos/jogo.
    // Garante que mesmo um stomp extremo (85v55) nao produz torres instantaneas.
    expect(
      tierStomp.st.towerBefore5Min / tierStomp.st.games,
      "torre < 5min no STOMP-FORTE deve ser < 5% de eventos/jogo -- STR-01/D-03"
    ).toBeLessThan(0.05);

    // Verificar que o relatorio foi escrito (assert funcional do harness em si).
    expect(existsSync("tmp/calibration-structures.txt")).toBe(true);

    // ---------------------------------------------------------------------------
    // ASSERTS DUROS: gates de distribuicao de cascata e ator (Phase 18, STR-05/STR-06, D-08)
    // Estes asserts sao NOVOS na Fase 18 -- medem o freio de cascata e a plausibilidade
    // de ator estrutural corrigidos pelas Fases 18-01 e 18-02.
    // NAO afrouxar os limiares para passar -- calibrar as constantes da engine (D-08).
    // ---------------------------------------------------------------------------

    // --- Metricas derivadas do tier EQUILIBRADO (referencia para gap same-lane e ator) ---
    const sortedGapsEquilibrado = [...tierEquilibrado.st.sameLaneGapSec].sort((a, b) => a - b);
    const gapP50SameLane = percentile(sortedGapsEquilibrado, 50);

    const actorEarlyCorrectRate =
      tierEquilibrado.st.actorEarlyTotal > 0
        ? (tierEquilibrado.st.actorEarlyTotal -
            (tierEquilibrado.st.actorEarlyByRole["support"] ?? 0) -
            tierEquilibrado.st.adcWrongLaneEarly) /
          tierEquilibrado.st.actorEarlyTotal
        : 0;

    const supportActorRate =
      tierEquilibrado.st.actorTotalForSupport > 0
        ? tierEquilibrado.st.supportActorTotal / tierEquilibrado.st.actorTotalForSupport
        : 0;

    const adcWrongLaneEarlyRate =
      tierEquilibrado.st.actorEarlyTotal > 0
        ? tierEquilibrado.st.adcWrongLaneEarly / tierEquilibrado.st.actorEarlyTotal
        : 0;

    // Gate STR-05a: gap p50 entre quedas na mesma lane (EQUILIBRADO) >= 120s.
    // Prova que o freio de cascata por-lane (cascadeDamageMultiplier) espacou as quedas.
    // NAO afrouxar -- calibrar CASCADE_REDUCAO_MAX / CASCADE_N_LANE_SEC em structures.ts.
    expect(
      gapP50SameLane,
      "gap p50 entre quedas na mesma lane (EQUILIBRADO) deve ser >= 120s -- STR-05"
    ).toBeGreaterThanOrEqual(120);

    // Gate STR-05b: torres de lanes diferentes no mesmo tick (gap < 15s) = 0 (STOMP-FORTE).
    // Prova que o freio global cross-lane (lastAnyStructureDestroyedAtSec) elimina quedas simultaneas.
    // NAO afrouxar -- calibrar CASCADE_REDUCAO_GLOBAL / CASCADE_N_GLOBAL_SEC em structures.ts.
    expect(
      tierStomp.st.crossLaneSimultaneous,
      "torres de lanes diferentes com gap < 15s no STOMP-FORTE deve ser 0 -- STR-05"
    ).toBe(0);

    // Gate STR-06a: ator early >= 85% laner/jungler-correto (EQUILIBRADO).
    // Prova que buildStructureActorCandidates restringe o ator por lane/fase corretamente.
    // NAO afrouxar -- calibrar o limiar de laneLead em deriveGankContext se necessario.
    expect(
      actorEarlyCorrectRate,
      "ator de estrutura early >= 85% deve ser laner/jungler da lane (EQUILIBRADO) -- STR-06"
    ).toBeGreaterThanOrEqual(0.85);

    // Gate STR-06b: support como ator de estrutura < 5% (EQUILIBRADO).
    // Prova que o support e excluido do array de candidatos em early por buildStructureActorCandidates.
    // NAO afrouxar -- o support deve ser excluido do array em early (nao apenas peso reduzido).
    expect(
      supportActorRate,
      "support como ator de estrutura deve ser < 5% (EQUILIBRADO) -- STR-06"
    ).toBeLessThan(0.05);

    // Gate STR-06c: ADC como ator de top/mid early < 2% (EQUILIBRADO).
    // Prova que o ADC e excluido de lanes != bot em early sem macro plausivel (D-06).
    // NAO afrouxar -- calibrar a condicao isEarly / hasBaronOrHerald em buildStructureActorCandidates.
    expect(
      adcWrongLaneEarlyRate,
      "ADC como ator de top/mid early deve ser < 2% (EQUILIBRADO) -- STR-06"
    ).toBeLessThan(0.02);

    // ---------------------------------------------------------------------------
    // ASSERT DURO: criterio 3 -- total de torres por partida plausivel (CAL-03)
    // Criterio: o numero total de torres destruidas por partida deve cair numa banda
    // plausivel de acordo com uma partida real de LoL. Cada side tem no maximo 11
    // estruturas (outer x3, inner x3, inhibTurret x3, nexusTurrets x2); o nexus em
    // si nao e contado como torre. Em partidas tipicas, uma facao vence antes de todas
    // as estruturas caírem, resultando em media ~5-11 torres/jogo no EQUILIBRADO.
    //
    // Banda calibrada pelo valor observado (Fase 22, D-04):
    //   - Media EQUILIBRADO observada: ~9.5 torres/jogo (800 partidas)
    //   - Minimo plausivel: >= 1 (toda partida deve ter pelo menos 1 torre caida)
    //   - Maximo plausivel media: <= 14 (nao ha partidas onde todas as estruturas caem)
    //   - p95 por partida: <= 18 (limite fisico: 22 estruturas totais no mapa; p95 bem abaixo disso)
    //
    // Se este assert falhar com valores MAIORES, verificar cascata (STR-05) ou duracao media.
    // Se falhar com valores MENORES, verificar que tower_destroyed e contado por finalState.
    // NAO afrouxar silenciosamente -- documentar justificativa (D-04).
    // ---------------------------------------------------------------------------

    const sortedTowersEquilibrado = [...tierEquilibrado.st.towersPerGameArr].sort((a, b) => a - b);
    const avgTowersEquilibrado = tierEquilibrado.st.totalTowers / Math.max(1, tierEquilibrado.st.games);
    const p95TowersEquilibrado = percentile(sortedTowersEquilibrado, 95);

    // criterio 3: total de torres plausivel -- media >= 1 (limite inferior)
    expect(
      avgTowersEquilibrado,
      `criterio 3: total de torres plausivel -- media por partida (${avgTowersEquilibrado.toFixed(2)}) deve ser >= 1 (EQUILIBRADO)`
    ).toBeGreaterThanOrEqual(1);

    // criterio 3: total de torres plausivel -- media <= 14 (limite superior; calibrado D-04)
    // Banda: observado ~9.5 no EQUILIBRADO; limiar 14 da margem para variacao de cenario.
    expect(
      avgTowersEquilibrado,
      `criterio 3: total de torres plausivel -- media por partida (${avgTowersEquilibrado.toFixed(2)}) deve ser <= 14 (EQUILIBRADO)`
    ).toBeLessThanOrEqual(14);

    // criterio 3: total de torres plausivel -- p95 <= 18 (limite de cauda; calibrado D-04)
    // O mapa tem no maximo 22 estruturas totais (11 por side); p95 bem abaixo disso confirma
    // que nao ha partidas absurdas onde quase todas as estruturas caem.
    expect(
      p95TowersEquilibrado,
      `criterio 3: total de torres plausivel -- p95 por partida (${p95TowersEquilibrado}) deve ser <= 18 (EQUILIBRADO)`
    ).toBeLessThanOrEqual(18);

    // ---------------------------------------------------------------------------
    // ASSERT TOLERANTE: bandas de dois lados (Fase 25, criterio 2 do roadmap).
    // Roda por ultimo, depois da escrita do relatorio e depois de todos os gates duros
    // de plausibilidade: uma banda vermelha e trabalho de calibracao com fase dona, e
    // nao pode mascarar uma regra dura vermelha, que e bug. expectBands agrega todas as
    // violacoes numa unica falha, cada uma com piso, teto, fonte e dono.
    // ---------------------------------------------------------------------------
    expectBands(bandResults);
  });
});
