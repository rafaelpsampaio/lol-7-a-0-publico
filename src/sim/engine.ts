/**
 * src/sim/engine.ts
 *
 * Phase 5 — the STATE-DRIVEN engine. A tick loop where, each tick:
 *   1. time advances; objective timers, respawns and buffs update;
 *   2. derived state (phase, pressure, map control) is recomputed;
 *   3. each team picks a MACRO INTENTION from the live state;
 *   4. the two intentions are RESOLVED against each other;
 *   5. coherent event(s) are emitted and their impact applied to the state;
 *   6. win probability is recomputed FROM the new state;
 *   7. events go on the timeline.
 *
 * Randomness is noise around the state, never the cause. All randomness flows
 * through the passed seeded rng (never Math.random) for deterministic replay.
 */

import type { PlayerVersion, Role } from "../data/schema";
import {
  createInitialMatchState,
  recomputeDerived,
  teamOf,
  opponent,
  aliveCount,
  hasBaronBuff,
  hasElderBuff,
  aliveElderBuffHolders,
  LANES,
  ROLES,
  DEFAULT_SIM_CONFIG,
  type MatchState,
  type Side,
  type Lane,
  type TeamState,
  type PlayerState,
  type SimConfig,
  type DragonElement,
  type DiagnosticEntry,
} from "./matchState";
import {
  updateObjectiveTimers,
  isObjectiveAvailable,
  takeObjective,
  stealObjective,
  canStealObjective,
  objectiveSecurer,
  type ObjectiveKind,
} from "./objectives";
import {
  conversionSide,
  conversionTarget,
  contestChance,
  conversionStealFactor,
  conversionLane,
  conversionSiegeDamage,
  conversionLead,
  prefixLead,
  numbersAdvantage,
} from "./conversion";
import { fightPower, securePower, teamSlice, laneLaningPower, playerSlice, goldFightMult, bestPlayer } from "./power";
import { fightNoiseHalfWidth, effectiveChaos } from "./tuning";
import {
  junglerReady, bestEdgeLane, laneAllInChance, phasePickScale,
  updateObjectivePrep, takeAttempt, PREP_ANNOUNCE_AT, isObjectivePreparable,
  bloodScale, fightResetSec, fightReason, laneEdge,
} from "./readiness";
import {
  TRAIT_TUNING, flipsDuels, flipsWinChance,
  applyTraitIntentBiases, objectiveLoverStealBonus, objectiveLoverExposure, roamerFor, applyRoamCost,
  sidePressureShift,
} from "./traitEffects";
import {
  creditPlayer, killGoldFor, earnBounty, settleVictimBounty, splitEvenly,
  passiveGoldPerMinute, PASSIVE_LANE_OF_ROLE, ASSIST_SHARE,
} from "./economy";
import {
  decayLaneState,
  updateLaneState,
  computeStrongsideScore,
  LANE_LEAD_TO_PRESSURE_WEIGHT,
} from "./laneState";
import { applyCompIntentBiases, labelCompProfile } from "./teamComp";
import { computeWinProbability } from "./winprob";
import type { SimEvent, EventKind, Region } from "./simEvents";
import { shortName, placeLabel, dragonLabel, soulLabel } from "./ticker";
import {
  selectKiller,
  selectVictim,
  assignAssists,
  type FightContext,
} from "./selection";
import {
  computeDeathQuality,
  selectContextualTicker,
  isEngageInitiator,
  computeEventWeight,
  type DeathContext,
  type EventWeight,
} from "./deathQuality";
import {
  resolveStructurePressure,
  resolveHeraldUse,
  accrueSiegePressure,
  currentTierField,
  currentTierType,
  pickDeterministicSiegeActor,
  classifyStructureCrossing,
  collectPlates,
  platesAt,
  plateTicker,
  crossesTowerLow,
  damageStructure,
  holdPoolBeforeTowerWindow,
} from "./structures";
import { maxCasualties, ACE_MIN_SEC, multikillTimePlausibility } from "./combat";
import { accrueLaneSignals } from "./laneSignals";
import { buildUpsetEvent } from "./upset";
import { noteDeathForQuits, noteKillForQuits, rollPendingQuits } from "./quits";

// ---------------------------------------------------------------------------
// Lane state hook constants — calibrados Plano 04
// ---------------------------------------------------------------------------

/**
 * Limiar de laneLead para classificar um pickoff como dive.
 * Se o side atacante já tem laneLead > DIVE_LANE_LEAD_THRESHOLD na lane,
 * o evento é classificado como dive (heurística — RESEARCH Pitfall 2; calibrado Plano 04).
 */
const DIVE_LANE_LEAD_THRESHOLD = 8;

/**
 * WR-03: cooldown do Flash (s). Aproxima o Flash real de LoL (~300s) num modelo
 * minimo e deterministico (rng-free). Quando um abatedor usa Flash agressivo para
 * garantir o abate, fica sem Flash por esta janela; processRespawns restaura ao
 * expirar. Cria periodos em que um jogador VIVO esta sem Flash, ativando o peso
 * noFlash (victimScore) e o ticker ctx_adc_caught_no_flash (EVT-01).
 */
const FLASH_COOLDOWN_SEC = 300;

// ---------------------------------------------------------------------------
// Macro intentions
// ---------------------------------------------------------------------------

/**
 * [25C-03 Task 2] A uniao de intencoes de macro NASCE deste array e o tipo e
 * DERIVADO dele. Antes eram duas listas (uma uniao de tipos para o compilador e
 * nenhuma enumeracao em tempo de execucao), e o teste de caminho morto precisa
 * percorrer as intencoes em tempo de execucao. Derivar o tipo do array e o unico
 * jeito de a enumeracao e o tipo nunca poderem divergir (T-25C-17).
 *
 * A ORDEM DESTE ARRAY NAO ALTERA COMPORTAMENTO NENHUM, e isso e pre-requisito da
 * troca: quem decide a intencao e `weightedPickIntent`, que percorre
 * `Object.entries(weights)`, ou seja a ordem de INSERCAO das chaves no dicionario
 * de pesos montado em `chooseIntent`, e nao a ordem desta lista. O array so e lido
 * por teste. Conferido por medicao: introduzir o array sozinho deixa os dois
 * snapshots de valor verdes sem regeneracao.
 */
export const MACRO_INTENTS = [
  "farm",
  "press_top",
  "press_mid",
  "press_bot",
  "gank",
  "setup_dragon",
  "setup_voidgrubs",
  "setup_herald",
  "setup_baron",
  "setup_elder",
  "force_fight",
  "pickoff",
  "siege_baron",
  "split_push",
  "use_herald",
] as const;

export type MacroIntent = (typeof MACRO_INTENTS)[number];

/** Which objective (if any) an intent is trying to set up. */
export function intentObjective(intent: MacroIntent): ObjectiveKind | null {
  switch (intent) {
    case "setup_dragon":
      return "dragon";
    case "setup_voidgrubs":
      return "voidgrubs";
    case "setup_herald":
      return "herald";
    case "setup_baron":
      return "baron";
    case "setup_elder":
      return "elder";
    default:
      return null;
  }
}

// [25C-03 Task 1] O simbolo `invade` saiu daqui e da uniao MacroIntent. Ele nunca recebia
// peso em chooseIntent nem no mapa de vieses de comp (medido em 0,00 por cento de
// 191.914 decisoes, 25C-RESEARCH.md secao Z3), entao nunca era sorteado por
// weightedPickIntent. Nao era caminho morto de EXECUCAO, era SIMBOLO morto: a
// remocao e puramente estatica e o deslocamento de golden dela e vazio, provado
// pelos dois snapshots de valor continuarem verdes sem regeneracao.
export const AGGRO_INTENTS: ReadonlySet<MacroIntent> = new Set<MacroIntent>([
  "force_fight",
  "pickoff",
  "gank",
]);

/**
 * Um 5v5 acontece neste tick? (spec calendario secao 3) Reset passado, gente suficiente (4 no
 * early, 3 depois), os dois junglers com o 1o clear feito, gatilho de intencao (force_fight, ou
 * agressao mutua fora do early) e um motivo de luta; com o Caos alto (caos efetivo >=
 * fightAnywhereChaos), o motivo e dispensado.
 */
export function teamfightAllowed(state: MatchState, userIntent: MacroIntent, rivalIntent: MacroIntent): boolean {
  const minAlive = state.phase === "early" ? 4 : 3;
  const ready =
    state.gameTimeSec - state.lastFightSec >= fightResetSec(state) &&
    aliveCount(state.user) >= minAlive &&
    aliveCount(state.rival) >= minAlive &&
    junglerReady(state, "user") &&
    junglerReady(state, "rival");
  const triggered =
    userIntent === "force_fight" ||
    rivalIntent === "force_fight" ||
    (AGGRO_INTENTS.has(userIntent) && AGGRO_INTENTS.has(rivalIntent) && state.phase !== "early");
  // Emenda 2 de 2026-10-02: com o Caos alto, a luta dispensa o motivo (briga em qualquer lugar).
  const reason = fightReason(state) || effectiveChaos(state) >= state.tuning.fightAnywhereChaos;
  return ready && triggered && reason;
}

/**
 * [25C-03 Task 2] O predicado do ramo (d) de `resolveInteraction`, extraido para
 * funcao pura exportada. Ele estava embutido como expressao dentro do resolvedor,
 * e o teste de caminho morto precisa do MESMO predicado que o resolvedor usa: uma
 * copia da expressao no teste passaria a divergir do resolvedor no dia em que um
 * dos dois mudasse, e o teste continuaria verde medindo outra coisa.
 */
export function routesToStructurePressure(intent: MacroIntent): boolean {
  return intent === "siege_baron" || intent === "split_push" || intent.startsWith("press_");
}

/** [25C-03 Task 2] O predicado do ramo (b) de `resolveInteraction`, pela mesma razao. */
export function routesToHeraldUse(intent: MacroIntent): boolean {
  return intent === "use_herald";
}

// ---------------------------------------------------------------------------
// OBJ-02: Baron setup gate (baronSetupSufficient) — D-01, rng-free
// ---------------------------------------------------------------------------

/**
 * Janela de tempo (segundos) desde o ultimo fight para considerar que um ace
 * ou pick recente ainda da contexto forte para o Baron.
 * Claude's Discretion — calibrado contra o harness (assert 3: Baron@spawn < 5%).
 */
const ACE_WINDOW_SEC = 60;

/**
 * Fracao do securePower do oponente usada como limiar de smite alternativo
 * quando o jungler esta morto. O time so tem "secure alternativo forte"
 * se securePower(state, side) (ja com o multiplicador 0.7 de jungler morto
 * aplicado dentro de securePower) superar esta fracao do securePower do
 * oponente. Limiar relativo, escala-invariante a mudancas de stat.
 * Rng-free -- derivado apenas de state (sem rng()/Math.random).
 * Claude's Discretion -- calibrado contra o harness (assert 3: Baron@spawn < 5%).
 */
const BARON_ALT_SECURE_FRACTION = 0.6;

/**
 * Limiar de pressao assinada (signed pressure +favours user) para considerar
 * que o time tem pressao forte em mid ou top, dando contexto para o Baron.
 * Pressao e sinalizada: +usuario, -rival. Para o lado rival aplicamos o sinal.
 * Claude's Discretion — calibrado contra o harness (assert 3: Baron@spawn < 5%).
 * Valor alto (35) para que pressao "normal" nao seja suficiente; so vantagem
 * clara de lane qualifica como contexto para o Baron no spawn.
 */
const BARON_PRESSURE_THRESHOLD = 35;

/**
 * Retorna true se o oponente teve ace ou pick recente (maioria morta nos ultimos
 * ACE_WINDOW_SEC segundos). Rng-free — derivado de state.lastFightSec e aliveCount.
 * Molde: deriveGankContext (structures.ts:192-208).
 */
export function hasRecentAceOrPick(state: MatchState, side: Side): boolean {
  const enemy = teamOf(state, opponent(side));
  const timeSinceLastFight = state.gameTimeSec - state.lastFightSec;
  return timeSinceLastFight < ACE_WINDOW_SEC && aliveCount(enemy) <= 2;
}

/**
 * Retorna true se o time tem pressao clara em mid OU top a seu favor.
 * Pressao e sinalizada: +user, -rival. Para o lado rival invertemos o sinal.
 * Rng-free — derivado de state.pressure.
 */
function hasStrongMidTopPressure(state: MatchState, side: Side): boolean {
  const sign = side === "user" ? 1 : -1;
  return (
    sign * state.pressure.mid > BARON_PRESSURE_THRESHOLD ||
    sign * state.pressure.top > BARON_PRESSURE_THRESHOLD
  );
}

/**
 * Predicado rng-free de setup do Baron. Retorna true quando o time tem condicoes
 * suficientes para tomar o Baron sem contest (jungler ou alternativa, presenca e
 * contexto recente). Modelado em deriveBypass/deriveGankContext (structures.ts:144-208).
 *
 * Tres condicoes obrigatorias (todas devem passar):
 *   1. Confirmador: jungler vivo OU securePower alto (smite alternativo).
 *   2. Presenca: >= 3 aliados vivos.
 *   3. Contexto forte recente: ace/pick recente OU pressao clara mid/top.
 *
 * OBJ-02 / D-01: consultado ANTES de resolveUncontestedObjective no caminho
 * uncontested. Caminho contested permanece intacto.
 */
export function baronSetupSufficient(state: MatchState, side: Side): boolean {
  const team = teamOf(state, side);

  // 1. Confirmador: jungler vivo OU secure alternativo forte
  // Quando o jungler esta morto, o time so tem capacidade de segurar o Baron
  // se seu securePower (ja penalizado pelo multiplicador interno 0.7) superar
  // uma fracao do securePower do oponente. Comparacao rng-free e escala-invariante.
  const junglerAlive = team.players.jungle.alive;
  const altSecureOk =
    securePower(state, side) > BARON_ALT_SECURE_FRACTION * securePower(state, opponent(side));
  if (!junglerAlive && !altSecureOk) {
    return false;
  }

  // 2. Presenca: >= 3 aliados vivos
  if (aliveCount(team) < 3) {
    return false;
  }

  // 3. Contexto forte recente: ace/pick OU pressao clara
  if (!hasRecentAceOrPick(state, side) && !hasStrongMidTopPressure(state, side)) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// OBJ-03: Duplo-ator — constante DUPLO_ATOR_RATIO (rng-free, ticker only)
// ---------------------------------------------------------------------------

/**
 * Limiar de razao entre o maior dano nao-jungler vivo e o dano do confirmador
 * (jungler) para que o ticker de Baron/Elder exiba o segundo ator.
 * Valor 1.25: o nao-jungler precisa superar o jungler em pelo menos 25%.
 * Claude's Discretion — calibrado para duplo-ator aparecer de forma razoavel.
 * OBJ-03 / D-03: o segundo ator aparece SOMENTE no ticker, nunca em actors[].
 */
const DUPLO_ATOR_RATIO = 1.25;

// ---------------------------------------------------------------------------
// Engine output
// ---------------------------------------------------------------------------

export interface SimulationResult {
  winner: Side;
  timeline: SimEvent[];
  finalState: MatchState;
  durationSec: number;
}

let __eventCounter = 0;
function nextEventId(): string {
  __eventCounter += 1;
  return `ev-${__eventCounter}`;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run a full state-driven match. Pure given (rosters, rng): the rng carries all
 * non-determinism. Loops ticks until a Nexus falls or a safety cap is hit.
 */
export function simulateMatch(
  userRoster: PlayerVersion[],
  rivalRoster: PlayerVersion[],
  rng: () => number,
  config: SimConfig = DEFAULT_SIM_CONFIG,
  opts: {
    userCaptainPersonId?: string;
    rivalCaptainPersonId?: string;
    userChampions?: Record<string, string>;
    rivalChampions?: Record<string, string>;
    recordStats?: boolean;
  } = {}
): SimulationResult {
  const state = createInitialMatchState(userRoster, rivalRoster, {
    config,
    userCaptainPersonId: opts.userCaptainPersonId,
    rivalCaptainPersonId: opts.rivalCaptainPersonId,
    userChampions: opts.userChampions,
    rivalChampions: opts.rivalChampions,
  });
  if (opts.recordStats === true) state.harnessStats = { fightWins: { user: 0, rival: 0 }, conversions: 0 };
  const timeline: SimEvent[] = [];
  state.winProbUser = computeWinProbability(state);

  const tick = config.tickSeconds;
  const HARD_CAP_SEC = 60 * 60; // 60 min safety cap

  while (!state.ended && state.gameTimeSec < HARD_CAP_SEC) {
    state.gameTimeSec += tick;

    // 1. time-driven updates
    updateObjectiveTimers(state, rng);
    const returned = processRespawns(state);
    passiveIncome(state, tick);

    // 2. derived state
    recomputeDerived(state);
    decayLaneState(state);     // LANE-02: decai antes de recomputePressure ler (ordem crítica)
    recomputePressure(state);  // lê laneState.laneLead (leitor puro)
    decayMomentum(state);

    // 2b. CANAL ABSOLUTO DE CERCO (PACE-01, Fase 25 plano 25-04).
    // Acumula dano estrutural em paridade, cedo e continuamente, desacoplado do
    // gate de pressao estrutural e portanto imune aos sete retornos antecipados
    // que ficam antes dele na resolucao de interacao.
    //
    // A POSICAO EXATA E RESTRICAO, e cada uma das tres razoes e real:
    //   1. DEPOIS do recalculo de pressao, porque o multiplicador de wave le a
    //      pressao da lane e ela so esta atualizada depois daquela chamada.
    //   2. ANTES da escolha de intencao, porque a funcao nao pode se intercalar
    //      com nenhum consumidor de sorteio. Com o bloco novo inteiro fora da
    //      regiao que consome sorteio, a leitura do diff de aridade e trivial.
    //   3. Os eventos do acumulo entram na linha do tempo do MESMO tick, antes
    //      dos do resto do tick, e o laco de finalizacao abaixo ja atribui a
    //      probabilidade de vitoria evento a evento e ja trata o encerramento do
    //      jogo, entao nada de codigo novo e necessario para isso.
    const siegeEvents = accrueSiegePressure(state);

    // RECHEIO NARRATIVO DO EARLY GAME (D-01, Fase 26 plano 26-07).
    // Mesmo ponto de chamada e mesmas tres razoes do bloco acima: depois do
    // recalculo de pressao (o classificador le laneLead/prioScore/
    // jungleAttentionReceived, todos ja atualizados por decayLaneState e
    // recomputePressure), antes da escolha de intencao (fora da regiao que
    // consome sorteio), e os eventos entram na linha do tempo do MESMO tick,
    // antes dos do resto do tick.
    const laneSignalEvents = accrueLaneSignals(state);

    // 3. intentions
    const userIntent = chooseIntent(state, "user", rng);
    const rivalIntent = chooseIntent(state, "rival", rng);

    // 4 + 5. resolve interaction → events with impact applied
    // Os eventos do acumulo vem primeiro na linha do tempo do tick. O acumulo
    // NUNCA produz o evento de fim de jogo, porque ele pula o lado com o Nexus
    // exposto: o fechamento da partida continua sendo caminho exclusivo do gate.
    // Spec traits no motor (3.6): quem voltou de um quit abre o tick; o sorteio de quit fecha o tick,
    // depois de todos os outros sorteios. Sem `quits` na partida as duas listas sao vazias (T-02).
    const returnEvents = returned.map(({ side, player }) => makeQuitEvent(state, side, player, "player_returned"));
    const interactionEvents = resolveInteraction(state, userIntent, rivalIntent, rng);
    const quitEvents = rollPendingQuits(state, rng).map(({ side, player }) => makeQuitEvent(state, side, player, "player_quit"));
    const events = returnEvents.concat(siegeEvents, laneSignalEvents, interactionEvents, quitEvents);

    // 6 + 7. finalise each event with the post-impact win probability
    for (const ev of events) {
      state.winProbUser = computeWinProbability(state);
      ev.winProbUserAfter = state.winProbUser;
      timeline.push(ev);
      if (ev.kind === "gg") {
        state.ended = true;
        break;
      }
    }
  }

  // Safety: if the cap was hit without a Nexus, end on win probability.
  if (!state.ended) {
    const side: Side = state.winProbUser >= 0.5 ? "user" : "rival";
    finishGame(state, side, timeline, rng);
  }

  // Phase 28 (plano 28-04, D-03/D-04/D-05): destaque narrativo de zebra,
  // avaliado UMA UNICA VEZ, depois do fim da partida e do bloco de seguranca
  // do cap, e ANTES do return. rng-free (T-28-04-03): nao consome sorteio,
  // entao nao desloca a timeline nem quebra INV-1.
  const upsetEvent = buildUpsetEvent(state, timeline);
  if (upsetEvent !== null) timeline.push(upsetEvent);

  return {
    winner: state.winner ?? (state.winProbUser >= 0.5 ? "user" : "rival"),
    timeline,
    finalState: state,
    durationSec: state.gameTimeSec,
  };
}

// ---------------------------------------------------------------------------
// Time-driven helpers
// ---------------------------------------------------------------------------

/** Renascimentos do tick. Devolve quem voltou de um quit (spec traits no motor 3.6). */
function processRespawns(state: MatchState): { side: Side; player: PlayerState }[] {
  const returned: { side: Side; player: PlayerState }[] = [];
  for (const side of ["user", "rival"] as Side[]) {
    const team = teamOf(state, side);
    for (const role of ROLES) {
      const p = team.players[role];
      if (!p.alive && p.respawnAtSec !== null && state.gameTimeSec >= p.respawnAtSec) {
        p.alive = true;
        p.respawnAtSec = null;
        if (p.away === true) {
          p.away = false;
          returned.push({ side, player: p });
        }
      }
      // WR-03: restaurar Flash quando o cooldown expira (rng-free, time-driven).
      if (
        p.flashCooldownUntilSec !== null &&
        state.gameTimeSec >= p.flashCooldownUntilSec
      ) {
        p.flashUp = true;
        p.flashCooldownUntilSec = null;
      }
    }
  }
  return returned;
}

/** Farm passivo em ouro real (spec secao 3): so vivos farmam; rota ganha farma mais. */
function passiveIncome(state: MatchState, tick: number): void {
  const minute = state.gameTimeSec / 60;
  for (const side of ["user", "rival"] as Side[]) {
    const team = teamOf(state, side);
    for (const role of ROLES) {
      const p = team.players[role];
      if (!p.alive) {
        // Spec traits no motor (3.6): quem quitou ganha so o ouro passivo do LoL, sem farm.
        if (p.away === true) creditPlayer(team, p, Math.round((TRAIT_TUNING.afkGoldPerMin * tick) / 60));
        continue;
      }
      const lane = PASSIVE_LANE_OF_ROLE[role];
      const laneLead = lane === null ? 0 : team.laneState[lane].laneLead;
      const perMin = passiveGoldPerMinute(role, minute, playerSlice(p.card, "laning"), laneLead, state.tuning);
      creditPlayer(team, p, Math.round((perMin * tick) / 60));
    }
  }
}

/** Lane pressure (+user) from laning power, structures, buffs, and persistent lane lead. */
function recomputePressure(state: MatchState): void {
  // Lane power translates to pressure fastest in the early game (laning phase),
  // where plates and prio are decided; later, structures/buffs dominate.
  const laneWeight = state.phase === "early" ? 0.9 : 0.8;
  for (const lane of LANES) {
    let p =
      (laneLaningPower(state.user, lane) - laneLaningPower(state.rival, lane)) * laneWeight;
    // Standing enemy structures / lost own structures shift pressure.
    if (!state.rival.structures[lane].outerAlive) p += 12;
    if (!state.user.structures[lane].outerAlive) p -= 12;
    if (!state.rival.structures[lane].inhibitorAlive) p += 20;
    if (!state.user.structures[lane].inhibitorAlive) p -= 20;
    // Baron buff amplifies lane pressure while wave is alive.
    if (hasBaronBuff(state, "user")) p += 14;
    if (hasBaronBuff(state, "rival")) p -= 14;
    // LANE-02: persistent lane lead contributes to pressure (leitor puro — nunca escreve em laneState).
    // Em lane simétrica (sem eventos): userLead==rivalLead==0 ⇒ persistentContribution==0 ⇒
    // state.pressure[lane] é numericamente idêntico ao baseline pré-mudança. (INV-1 / Pitfall 4)
    const userLead = state.user.laneState[lane].laneLead;
    const rivalLead = state.rival.laneState[lane].laneLead;
    const persistentContribution = (userLead - rivalLead) * LANE_LEAD_TO_PRESSURE_WEIGHT;
    p += persistentContribution;
    // Spec traits no motor (3.5): o side empurra a rota dele no meio de jogo. Sem portador o termo
    // e 0 e a pressao fica identica (T-02).
    p += sidePressureShift(state, lane);
    state.pressure[lane] = clamp(p, -100, 100);
  }
}

function decayMomentum(state: MatchState): void {
  state.momentum *= 0.85;
  state.mapControl *= 0.9;
}

// ---------------------------------------------------------------------------
// Intention selection
// ---------------------------------------------------------------------------

function chooseIntent(state: MatchState, side: Side, rng: () => number): MacroIntent {
  const team = teamOf(state, side);
  const winProb = side === "user" ? state.winProbUser : 1 - state.winProbUser;
  const behind = winProb < 0.45;
  const ahead = winProb > 0.55;

  // Farm dominates a normal tick — real games are mostly farming/resetting with
  // bursts of action. This keeps the timeline paced instead of a fight every tick.
  const weights: Partial<Record<MacroIntent, number>> = {
    farm: 4.0,
    press_top: 0.45,
    press_mid: 0.45,
    press_bot: 0.45,
  };

  const add = (i: MacroIntent, w: number) => {
    weights[i] = (weights[i] ?? 0) + w;
  };

  // Prio by side strength: bot/mid prio → dragon; top/mid prio → grubs/herald.
  const botMidPrio =
    teamSlice(team, "objective") + laneLaningPower(team, "bot") + laneLaningPower(team, "mid");
  const topMidPrio =
    laneLaningPower(team, "top") + laneLaningPower(team, "mid");

  // Objectives that are alive bias setup toward them.
  if (isObjectivePreparable(state, "dragon")) add("setup_dragon", 2 + botMidPrio / 60);
  if (isObjectiveAvailable(state, "voidgrubs")) add("setup_voidgrubs", 1.5 + topMidPrio / 80);
  if (isObjectiveAvailable(state, "herald")) add("setup_herald", 1.8 + topMidPrio / 80);
  if (isObjectiveAvailable(state, "elder")) add("setup_elder", 3);
  if (isObjectiveAvailable(state, "baron")) {
    // Ahead teams threaten Baron; behind teams want a pick around it.
    add("setup_baron", ahead ? 2.6 : 1.4);
  }

  // Holding Herald eye → use it.
  if (team.heraldTaken && !team.heraldUsed) add("use_herald", 2.5);

  // Buff-driven macro --------------------------------------------------------
  const enemy = teamOf(state, opponent(side));
  const ownBaron = hasBaronBuff(state, side);
  const ownElder = hasElderBuff(state, side);
  const enemyElder = aliveElderBuffHolders(enemy) >= 1;

  // Holding Elder → group, force the (almost un-loseable) fight, then convert
  // the wipe into towers/Nexus before the buff expires.
  if (ownElder) {
    add("force_fight", 4);
    add("siege_baron", 1.5);
  }

  // Holding Baron → siege towers AND hunt picks; Baron-empowered teams catch
  // people out constantly (often the enemy top laner caught split-pushing).
  if (ownBaron) {
    add("siege_baron", 4);
    add("force_fight", 1.5);
    add("pickoff", 2.2);
  }

  // Holding BOTH → commit fully: group, fight, close the game.
  if (ownBaron && ownElder) {
    add("force_fight", 3);
    add("siege_baron", 2);
  }

  // Ahead vs behind macro tendencies.
  if (ahead) {
    add("pickoff", 0.8);
    add("force_fight", 0.5);
    add("press_mid", 0.6);
  }
  if (behind) {
    add("pickoff", 1.0); // catch to climb back
    // [25C-03 Task 2] SITIO 1 do caminho morto: aqui saiam 1.2 de cross_map e 1.0
    // de defend_base. As duas recebiam peso e nao tinham ramo em resolveInteraction,
    // entao o tick que as sorteava resolvia sem emitir evento. Ver o cabecalho de
    // MACRO_INTENTS e o bloco do SITIO 2 em teamComp.ts.
    add("split_push", 0.8);
  }

  // Late game gravitates to fights, but only modestly — the cooldown gate keeps
  // them from chaining.
  if (state.phase === "late") {
    add("force_fight", 0.7);
    add("setup_baron", isObjectiveAvailable(state, "baron") ? 1.5 : 0);
  }

  // EARLY GAME — active lanes and jungle tempo drive the action, NOT 5v5s. A
  // team that out-lanes the enemy presses for plates and picks; a strong jungler
  // paired with lane priority sets up ganks. This makes lane-dominant rosters
  // matter early while scaling rosters wait (real LoL early-game flow).
  if (state.phase === "early") {
    const lanePress = (lane: Lane, intent: MacroIntent) => {
      const edge = laneLaningPower(team, lane) - laneLaningPower(enemy, lane);
      if (edge > 0) add(intent, edge / 30);
    };
    lanePress("top", "press_top");
    lanePress("mid", "press_mid");
    lanePress("bot", "press_bot");

    // Gank threat: a living jungler plus the team's best lane prio.
    if (team.players.jungle.alive) {
      const jgl = playerSlice(team.players.jungle.card, "skirmish");
      const lanePrio = Math.max(
        laneLaningPower(team, "top"),
        laneLaningPower(team, "mid"),
        laneLaningPower(team, "bot")
      );
      const gankThreat = jgl * 0.5 + lanePrio * 0.5;
      if (gankThreat > 55) add("gank", 0.8 + (gankThreat - 55) / 45);
    }
  }

  // FACING an enemy Elder buff → AVOID the 5v5. Don't initiate; play for picks
  // and side-lane pressure until the buff expires.
  //
  // [25C-03 Task 2] SITIO 1 do caminho morto, segunda metade: aqui saiam 2.0 de
  // defend_base e 1.5 de cross_map. CUSTO SEMANTICO DECLARADO: este ramo aplicava
  // quatro conceitos de macro e passa a aplicar dois. Nenhuma banda desta milestone
  // mede o que se perdeu, e por isso ele vai ao checkpoint humano da onda 6.
  if (enemyElder && !ownElder) {
    weights.force_fight = 0;
    add("pickoff", 2.8);
    add("split_push", 1.0);
  }

  // CAU-05 (25C-04 Task 3): a janela pos-evento que a engine ja possui ganha um
  // SEGUNDO leitor aqui, na camada que decide. Alteracao pura de peso: zero
  // sorteios novos e zero sitios novos de chamada ao gerador.
  applyPostFightObjectiveWeights(state, side, weights);

  // COMP-02: vieses de intenção por perfil de comp (rng-free — sem novo draw).
  // applyCompIntentBiases muta weights diretamente; guard implícito: profile vazio
  // não aplica nada (dominantTags.length === 0 => loop sem iteração => weights inalterados).
  applyCompIntentBiases(weights as Record<string, number>, team.compProfile);

  // Spec traits no motor (3.3 a 3.5): vieses das traits novas, depois dos outros vieses e antes do
  // zero do gank (para o roamer nao reabrir gank antes do 1o clear). Sem portador nao mexe (T-02).
  applyTraitIntentBiases(state, side, weights, (kind) => isObjectivePreparable(state, kind));
  // Spec calendario secao 2: sem gank antes do 1o clear do jungler do lado (depois de todos os
  // vieses, para nenhum deles reabrir o gank).
  if (!junglerReady(state, side)) weights.gank = 0;

  return weightedPickIntent(weights, rng);
}

// ---------------------------------------------------------------------------
// CAU-05 (25C-04 Task 3): a janela pos-evento existente alimenta a decisao
// ---------------------------------------------------------------------------

/**
 * GRADE DE CALIBRACAO do peso pos-evento, tres valores do MAIS BAIXO ao mais
 * alto. O PONTO DE OPERACAO foi escolhido na onda 5, pelo sweep do CONJUNTO das
 * tres ligacoes desta fase, com o criterio commitado ANTES dos numeros (38206f0)
 * e a grade medida em quinze pontos (d58980c). Registro completo em
 * docs/diagnostics/25C-sweep.md secao 3.
 *
 * NAO REAJUSTE ESTA CONSTANTE ISOLADAMENTE. As alavancas desta fase NAO SOMAM:
 * elas competem pela MESMA massa de peso normalizada, entao reforcar a
 * preparacao de objetivo rouba participacao de gank e de pressao. Medido sobre o
 * conjunto: com 4,0 o par de gank para torre cai de 1,473 para 1,319 e o de luta
 * para epico de 1,090 para 1,060. Qualquer reajuste aqui exige remedir o par
 * com GANK_FOCUS_TEMPERATURE junto.
 *
 * A GRADE MEDIDA neste eixo, com a temperatura no ponto escolhido (8), no tier
 * de referencia, W = 60 s, N = 800:
 *
 *   W     P1      P2        P3     duracao   1a torre   bandas
 *   0,5   1,508   1,921     1,348  30,365    810 s      26 / 16
 *   1,0   1,476   2,013 OK  1,296  30,024    810 s      27 / 15   <== ESCOLHIDO
 *   1,5   1,366   1,937     1,273  29,726    810 s      26 / 16
 *   4,0   1,228   1,842     1,368  29,196    810 s      VIOLA REGRA DURA
 *
 * POR QUE 1,0 VENCEU: ele e o unico ponto sobrevivente que coloca 4 dos 6 asserts
 * de acoplamento dentro, e o unico que devolve a banda de PRESERVACAO de P2
 * (2,013, razao 0,980 contra os 0,950 exigidos), que estava vermelha desde a
 * onda 3. Os valores 0,5 e 1,5 colocam 3.
 *
 * O QUE ELE CUSTA, dito sem suavizar: P1 fica em 1,476, ABAIXO dos 1,552 que a
 * entrada da onda dava. E a nao aditividade agindo: subir este peso devolve P2 e
 * cobra de P1.
 *
 * O PONTO 4,0 NAO E DA GRADE e foi medido de proposito, para que a afirmacao de
 * que a regiao util e vazia tivesse os dois lados medidos. Ele VIOLA REGRA DURA
 * (`nexusTurret < 20min`, 5 eventos, tier STOMP-FORTE) e essa violacao NAO
 * aparece em banda nenhuma: ele le 25 verdes e 17 vermelhas, uma contagem que nao
 * chama atencao. Quem mexer aqui confere CONTADOR DE ASSERT DURO nos seis tiers,
 * e nao a linha de banda.
 */
export const POST_FIGHT_OBJECTIVE_W_GRID = [0.5, 1.0, 1.5] as const;

/**
 * PONTO DE OPERACAO, escolhido pelo sweep do conjunto na onda 5.
 *
 * A banda com MENOS folga no ponto escolhido e a mediana da primeira torre, com
 * 30 s ate o piso (810 contra 780). A segunda e torres aos 20:00, com 0,141 ate
 * o teto. A Fase 26 empurra as duas.
 */
export const POST_FIGHT_OBJECTIVE_W = 1.0;

/**
 * Depois de dizimar o time inimigo, o mapa fica aberto e o time agrupa em cima
 * do objetivo. Esta funcao e o SEGUNDO leitor da janela pos-evento que a engine
 * ja possui: ACE_WINDOW_SEC e hasRecentAceOrPick ja existem, ja sao rng-free e
 * ja estao provados, e ate aqui alimentavam um unico consumidor, no caminho de
 * Barao sem contestacao. Nenhum conceito novo entra: o roadmap poe janelas
 * pos-evento como conceito GERAL fora de escopo desta fase, e isto e reuso da
 * unica janela existente e nao um conceito novo.
 *
 * RNG-FREE por assinatura (tres parametros, nenhum gerador). Alteracao PURA de
 * peso: zero sorteios novos, zero sitios novos.
 *
 * POLARIDADE, conferida no codigo e nao suposta: hasRecentAceOrPick devolve
 * verdadeiro quando o INIMIGO do lado consultado teve o time dizimado
 * recentemente, ou seja quando a janela e FAVORAVEL ao lado consultado.
 * Inverter isto produziria uma engine que prepara objetivo depois de TOMAR um
 * ace, que e o oposto do pedido do usuario, e por isso a polaridade tem teste
 * proprio.
 *
 * A HIERARQUIA DO ACRESCIMO e a que a pesquisa mediu: Barao e Elder recebem o
 * peso cheio, o dragao 0,6 dele (e um objetivo mais barato e menos dependente
 * de vantagem de numero) e o cerco 0,5 (a janela tambem e boa para empurrar,
 * nao so para tomar objetivo). O cerco entra MESMO SEM objetivo disponivel, que
 * e o unico caso em que a janela ainda muda a decisao.
 *
 * Devolve se a janela estava aberta, para que o teste de polaridade nao precise
 * inferir isso a partir do dicionario de pesos.
 */
export function applyPostFightObjectiveWeights(
  state: MatchState,
  side: Side,
  weights: Partial<Record<MacroIntent, number>>
): boolean {
  if (!hasRecentAceOrPick(state, side)) return false;
  const add = (i: MacroIntent, w: number) => {
    weights[i] = (weights[i] ?? 0) + w;
  };
  if (isObjectiveAvailable(state, "baron")) add("setup_baron", POST_FIGHT_OBJECTIVE_W);
  if (isObjectiveAvailable(state, "elder")) add("setup_elder", POST_FIGHT_OBJECTIVE_W);
  if (isObjectiveAvailable(state, "dragon")) add("setup_dragon", POST_FIGHT_OBJECTIVE_W * 0.6);
  add("siege_baron", POST_FIGHT_OBJECTIVE_W * 0.5);
  return true;
}

function weightedPickIntent(
  weights: Partial<Record<MacroIntent, number>>,
  rng: () => number
): MacroIntent {
  const entries = Object.entries(weights).filter(([, w]) => (w ?? 0) > 0) as [
    MacroIntent,
    number
  ][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [intent, w] of entries) {
    roll -= w;
    if (roll <= 0) return intent;
  }
  return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------------------
// Interaction resolution — the core of the engine
// ---------------------------------------------------------------------------

/** Nome do objetivo no aviso de preparo (o dragao leva o elemento). */
function prepLabel(state: MatchState, kind: ObjectiveKind): string {
  switch (kind) {
    case "dragon": {
      // Antes do respawn o elemento ainda nao saiu; do 3o dragao em diante ele e o da Alma.
      const o = state.objectives;
      return `o ${dragonLabel(o.dragonElement ?? (o.dragonsTaken >= 2 ? o.soulElement : null))}`;
    }
    case "voidgrubs":
      return "as Larvas do Vazio";
    case "herald":
      return "o Arauto do Vale";
    case "baron":
      return "o Barão Nashor";
    case "elder":
      return "o Dragão Ancião";
  }
}

/** Spec traits no motor (3.6 e 4): o `quits` saiu ou voltou. Nao mexe em placar nem em ouro. */
function makeQuitEvent(state: MatchState, side: Side, p: PlayerState, kind: "player_quit" | "player_returned"): SimEvent {
  const name = shortName(p.card);
  return baseEvent(state, kind, side, {
    actors: [name],
    ticker: kind === "player_quit" ? `${name} quitou a partida.` : `${name} voltou para a partida.`,
  });
}

/** Aviso de preparo (spec calendario secao 4): nao mexe em placar nem em ouro. */
function makePrepEvent(state: MatchState, side: Side, kind: ObjectiveKind): SimEvent {
  const team = teamOf(state, side);
  const place: Region = kind === "dragon" || kind === "elder" ? "river_bot" : "river_top";
  return baseEvent(state, "objective_setup", side, {
    actors: [shortName(objectiveSecurer(team).card)],
    lane: place,
    objectiveKind: kind,
    ticker: `O ${team.name} começa a preparar ${prepLabel(state, kind)}.`,
  });
}

/**
 * (a) da resolucao (spec calendario secao 4): preparo, aviso e tentativa de tomada. Quem chega a
 * 100 e escolhe preparar tenta tomar. Se o outro lado esta no poco (preparando o mesmo objetivo
 * neste tick, ou com preparo de pelo menos 50), vira luta no poco; senao, sem agressao do outro
 * lado, toma sem disputa (o Barao segue com a trava de setup). `done` diz se o tick acabou aqui;
 * os eventos de aviso vem sempre em `events`.
 */
export function resolveObjectiveSetup(
  state: MatchState,
  userIntent: MacroIntent,
  rivalIntent: MacroIntent,
  rng: () => number
): { events: SimEvent[]; done: boolean } {
  const userObj = intentObjective(userIntent);
  const rivalObj = intentObjective(rivalIntent);
  const setup: Record<Side, ObjectiveKind | null> = {
    user: userObj && isObjectivePreparable(state, userObj) ? userObj : null,
    rival: rivalObj && isObjectivePreparable(state, rivalObj) ? rivalObj : null,
  };
  const events = updateObjectivePrep(state, setup).map(({ side, kind }) => makePrepEvent(state, side, kind));

  const attempt = takeAttempt(state, setup);
  if (attempt === null) return { events, done: false };
  const { side, kind } = attempt;
  const other = opponent(side);
  const otherIntent = other === "user" ? userIntent : rivalIntent;
  if (setup[other] === kind || state.objectivePrep[other][kind] >= PREP_ANNOUNCE_AT) {
    return { events: [...events, ...resolveContestedObjective(state, kind, rng)], done: true };
  }
  if (AGGRO_INTENTS.has(otherIntent)) return { events, done: false };
  // [D-01 / OBJ-02] Trava de setup do Barao: sem setup suficiente, o tick segue sem tomada.
  if (kind === "baron" && !baronSetupSufficient(state, side)) return { events, done: false };
  return { events: [...events, ...resolveUncontestedObjective(state, side, kind, rng)], done: true };
}

function resolveInteraction(
  state: MatchState,
  userIntent: MacroIntent,
  rivalIntent: MacroIntent,
  rng: () => number
): SimEvent[] {
  // (0) FINISH — an exposed enemy Nexus is closed out fast. Once both Nexus
  // turrets are down the base is cracked open; we never let inhibitor respawns
  // or a farming tick stall an exposed Nexus to the safety cap.
  for (const side of ["user", "rival"] as Side[]) {
    const enemy = teamOf(state, opponent(side));
    if (enemy.nexusExposed && aliveCount(teamOf(state, side)) >= 2) {
      const e = resolveStructurePressure(state, side, "siege_baron", rng);
      if (e) return [e];
    }
  }

  // (0b) JANELA DE CONVERSAO (spec secao 4): o lado com mais gente viva converte a vantagem
  // antes de qualquer outra intencao. A intencao sorteada deste tick fica sem efeito.
  const conv = conversionSide(state);
  if (conv !== null) {
    if (state.harnessStats !== undefined) state.harnessStats.conversions += 1;
    return resolveConversion(state, conv, rng);
  }

  // (a) PREPARO E TOMADA DE OBJETIVO (spec calendario secao 4) ------------------
  const obj = resolveObjectiveSetup(state, userIntent, rivalIntent, rng);
  if (obj.done) return obj.events;
  const pre = obj.events;

  // (b) HERALD USE -----------------------------------------------------------
  if (routesToHeraldUse(userIntent) && state.user.heraldTaken && !state.user.heraldUsed) {
    const e = resolveHeraldUse(state, "user", rng);
    if (e) return [...pre, e];
  }
  if (routesToHeraldUse(rivalIntent) && state.rival.heraldTaken && !state.rival.heraldUsed) {
    const e = resolveHeraldUse(state, "rival", rng);
    if (e) return [...pre, e];
  }

  // (c) FIGHTS & PICKS -------------------------------------------------------
  const userAggro = AGGRO_INTENTS.has(userIntent) || userIntent === "force_fight";
  const rivalAggro = AGGRO_INTENTS.has(rivalIntent) || rivalIntent === "force_fight";

  if (teamfightAllowed(state, userIntent, rivalIntent)) {
    const initiator: Side =
      userIntent === "force_fight" ? "user" : rivalIntent === "force_fight" ? "rival" : (rng() < 0.5 ? "user" : "rival");
    return [...pre, ...resolveTeamfight(state, initiator, rng)];
  }

  // (c1) ALL-IN DE ROTA antes do 1o clear do jungler do lado (spec calendario secao 2): ate o
  // jungler limpar, a agressao do lado (intencao agressiva ou press de rota) so vira abate por
  // all-in na rota. Press que nao vira all-in segue para (d) e pressiona a torre.
  for (const [intent, side] of [
    [userIntent, "user"],
    [rivalIntent, "rival"],
  ] as [MacroIntent, Side][]) {
    if (junglerReady(state, side)) continue;
    const lane = allInLane(state, side, intent);
    if (lane !== null && rng() < laneAllInChance(state, side, lane)) {
      const e = resolveLaneAllIn(state, side, lane, rng);
      if (e) return [...pre, e];
    }
  }

  // (c1b) ALL-IN DO FLIPS (spec traits no motor 3.2): uma chance por rota com portador em jogo,
  // de 1:30 a 14:00, sem depender do 1o clear nem da vantagem minima. O portador sempre esta no
  // all-in: ganhando, mata; perdendo, morre. Sem portador a lista e vazia e nada e sorteado (T-02).
  for (const duel of flipsDuels(state)) {
    if (rng() >= TRAIT_TUNING.flipsAllInChance * bloodScale(state)) continue;
    const lead = teamOf(state, duel.holderSide).laneState[duel.lane].laneLead;
    const holderWins = rng() < flipsWinChance(laneEdge(state, duel.holderSide, duel.lane), lead);
    const e = holderWins
      ? resolveLaneAllIn(state, duel.holderSide, duel.lane, rng, { killer: duel.holder })
      : resolveLaneAllIn(state, opponent(duel.holderSide), duel.lane, rng, { victim: duel.holder });
    if (e) return [...pre, e];
  }

  if (userAggro && junglerReady(state, "user") && rng() < pickChance(state, "user")) {
    const e = resolvePickoff(state, "user", userIntent, rivalIntent, rng);
    if (e) return [...pre, e];
  }
  if (rivalAggro && junglerReady(state, "rival") && rng() < pickChance(state, "rival")) {
    const e = resolvePickoff(state, "rival", rivalIntent, userIntent, rng);
    if (e) return [...pre, e];
  }

  // (d) SIEGE / SPLIT / PRESS ------------------------------------------------
  for (const [intent, side] of [
    [userIntent, "user"],
    [rivalIntent, "rival"],
  ] as [MacroIntent, Side][]) {
    if (routesToStructurePressure(intent)) {
      const e = resolveStructurePressure(state, side, intent, rng);
      if (e) return [...pre, e];
    }
  }

  return pre; // tick quieto (so os avisos de preparo, se houver)
}

// ---------------------------------------------------------------------------
// Objective resolution
// ---------------------------------------------------------------------------

/**
 * Dono de um poco disputado depois da luta (spec secoes 4 e 6): quem saiu com mais gente
 * viva leva; empate numerico vira duelo de Smite (securePower com sorteio, como antes).
 */
export function decidePitOwner(state: MatchState, attempting: Side, rng: () => number): Side {
  const adv = numbersAdvantage(state, attempting);
  if (adv > 0) return attempting;
  if (adv < 0) return opponent(attempting);
  const a = securePower(state, attempting) * (0.8 + rng() * 0.4);
  const d = securePower(state, opponent(attempting)) * (0.8 + rng() * 0.4);
  return a >= d ? attempting : opponent(attempting);
}

/**
 * Desfecho de um poco disputado depois da luta (spec secoes 4 e 6): o dono sai de
 * decidePitOwner, e o jungler do outro lado ainda pode roubar, com chance menor quanto maior a
 * vantagem numerica do dono. Time inteiro morto nao rouba (nada a disputar): a guarda de vivos
 * vem antes do sorteio, entao um time varrido nao consome draw de roubo. Usado pelos dois
 * caminhos de poco disputado (resolveContestedObjective e a janela de conversao), para eles
 * nao divergirem de novo.
 */
function settlePitOwner(
  state: MatchState,
  kind: ObjectiveKind,
  initiator: Side,
  rng: () => number
): { owner: Side; stolen: boolean } {
  const owner = decidePitOwner(state, initiator, rng);
  const other = opponent(owner);
  // O dono nunca esta em desvantagem numerica depois de decidePitOwner, entao a diferenca ja e >= 0.
  const gap = numbersAdvantage(state, owner);
  if (
    aliveCount(teamOf(state, other)) > 0 &&
    canStealObjective(state, kind, { attemptingSide: owner, contesting: true }) &&
    rng() < stealChanceFor(state, other, kind) * conversionStealFactor(gap)
  ) {
    return { owner: other, stolen: true };
  }
  return { owner, stolen: false };
}

/** Consome um tick da janela de conversao do lado `side` (spec secao 4). */
export function resolveConversion(state: MatchState, side: Side, rng: () => number): SimEvent[] {
  const place = state.lastFightWon?.side === side ? state.lastFightWon.place : null;
  const adv = numbersAdvantage(state, side);
  const target = conversionTarget(state, side, place);
  if (target === "push") return resolveConversionPush(state, side, place, adv);
  return resolveConversionObjective(state, side, target, place, adv, rng);
}

function resolveConversionObjective(
  state: MatchState,
  side: Side,
  kind: ObjectiveKind,
  place: Lane | Region | null,
  adv: number,
  rng: () => number
): SimEvent[] {
  const events: SimEvent[] = [];
  const defender = opponent(side);
  const defTeam = teamOf(state, defender);
  const pit: Region = kind === "dragon" || kind === "elder" ? "river_bot" : "river_top";
  const lead = conversionLead(state, side, adv, place);

  const contested =
    aliveCount(defTeam) > 0 &&
    rng() < contestChance(kind, adv, defTeam.players.jungle.alive, state.tuning);

  let owner: Side = side;
  let stolen = false;
  if (contested) {
    events.push(...resolveTeamfight(state, side, rng, { place: pit, silentIfNoKills: true, pitObjective: kind }));
    ({ owner, stolen } = settlePitOwner(state, kind, side, rng));
  }

  const element = state.objectives.dragonElement;
  const take = stolen
    ? stealObjective(state, owner, kind, { attemptingSide: opponent(owner), contesting: true }, rng)
    : takeObjective(state, owner, kind, rng);
  bumpMomentum(state, owner, kind === "baron" || kind === "elder" ? 26 : 16);
  events.push(
    makeObjectiveEvent(state, owner, kind, {
      contested,
      stolen,
      place: pit,
      element: take.element ?? element,
      lead: owner === side && !stolen ? lead : undefined,
    })
  );
  if (take.grantedSoul) events.push(makeSoulEvent(state, owner));
  return events;
}

function resolveConversionPush(
  state: MatchState,
  side: Side,
  place: Lane | Region | null,
  adv: number
): SimEvent[] {
  const team = teamOf(state, side);
  const enemy = teamOf(state, opponent(side));
  const lane = conversionLane(state, side, place);
  const t = state.gameTimeSec;
  const lead = conversionLead(state, side, adv, place);
  const actor = pickDeterministicSiegeActor(state, team, side, lane);
  if (actor === null) return [];

  const tierField = currentTierField(enemy.structures[lane], enemy);
  const tierType = currentTierType(enemy.structures[lane], enemy);

  // Proxima estrutura sem pool (inibidor): cai direto, um por tick, respeitando o freio global.
  if (tierField === null || tierType === null) {
    if (state.lastAnyStructureDestroyedAtSec === t) return [];
    const dmg = damageStructure(state, side, enemy, lane, 1);
    if (!dmg) return [];
    state.lastAnyStructureDestroyedAtSec = t;
    return [baseEvent(state, dmg.kind, side, { actors: [actor], lane, ticker: prefixLead(lead, dmg.ticker(actor)) })];
  }

  const pool = enemy.structureDamage[lane];
  const before = pool[tierField];
  // Regra dura: antes de 7:00 o pool para logo abaixo de 100 (e nunca baixa um pool ja maior).
  const after = holdPoolBeforeTowerWindow(
    before,
    Math.min(100, before + conversionSiegeDamage(state, side, tierType, adv)),
    t
  );
  pool[tierField] = after;
  pool.lastStructureDamageAtSec = t;

  if (after >= 100) {
    if (state.lastAnyStructureDestroyedAtSec === t) return [];
    pool[tierField] = 0;
    pool.lastStructureDestroyedAtSec = t;
    state.lastAnyStructureDestroyedAtSec = t;
    const dmg = damageStructure(state, side, enemy, lane, 1);
    if (!dmg) return [];
    return [baseEvent(state, dmg.kind, side, { actors: [actor], lane, ticker: prefixLead(lead, dmg.ticker(actor)) })];
  }

  const crossing = classifyStructureCrossing(tierType, t, before, after);
  const plates = crossing === "plate" ? collectPlates(state, side, lane, tierType, platesAt(after) - platesAt(before)) : 0;
  if (plates > 0) {
    return [
      baseEvent(state, "plate_taken", side, {
        actors: [actor],
        lane,
        ticker: prefixLead(lead, plateTicker(actor, lane, tierType, team.name, plates, crossesTowerLow(before, after))),
      }),
    ];
  }
  if (crossing === "tower_low") {
    return [
      baseEvent(state, "tower_low", side, {
        actors: [actor],
        lane,
        ticker: prefixLead(lead, `Torre ${placeLabel(lane)} do ${enemy.name} em estado critico! ${actor} lidera o siege.`),
      }),
    ];
  }
  return [];
}

/**
 * Objetivo disputado (spec 2026-10-02 secao 6): primeiro a luta no poco; quem sai dela com
 * mais gente viva leva, e empate numerico vira duelo de Smite. O jungler do outro lado, se
 * vivo, ainda pode roubar, com chance menor quanto maior a diferenca numerica.
 */
export function resolveContestedObjective(
  state: MatchState,
  kind: ObjectiveKind,
  rng: () => number
): SimEvent[] {
  const events: SimEvent[] = [];
  const place: Region = kind === "dragon" || kind === "elder" ? "river_bot" : "river_top";

  // Quem "inicia" a luta no poco sai de um sorteio leve de securePower. resolveTeamfight nao da
  // bonus de iniciador (vence quem tem mais poder na luta), entao esse sorteio so desempata
  // poder exatamente igual.
  const uSecure = securePower(state, "user") * (0.8 + rng() * 0.4);
  const rSecure = securePower(state, "rival") * (0.8 + rng() * 0.4);
  const initiator: Side = uSecure >= rSecure ? "user" : "rival";

  events.push(...resolveTeamfight(state, initiator, rng, { place, silentIfNoKills: true, pitObjective: kind }));

  const { owner, stolen } = settlePitOwner(state, kind, initiator, rng);

  let element = state.objectives.dragonElement;
  const takeRes = stolen
    ? stealObjective(state, owner, kind, { attemptingSide: opponent(owner), contesting: true }, rng)
    : takeObjective(state, owner, kind, rng);
  element = takeRes.element ?? element;

  bumpMomentum(state, owner, kind === "baron" || kind === "elder" ? 26 : 16);
  events.push(makeObjectiveEvent(state, owner, kind, { contested: true, stolen, place, element }));
  if (takeRes.grantedSoul) events.push(makeSoulEvent(state, owner));
  return events;
}

function resolveUncontestedObjective(
  state: MatchState,
  side: Side,
  kind: ObjectiveKind,
  rng: () => number
): SimEvent[] {
  const events: SimEvent[] = [];
  const place: Region = kind === "dragon" || kind === "elder" ? "river_bot" : "river_top";
  const element = state.objectives.dragonElement;
  const r = takeObjective(state, side, kind, rng);
  bumpMomentum(state, side, kind === "baron" || kind === "elder" ? 18 : 10);
  events.push(
    makeObjectiveEvent(state, side, kind, {
      contested: false,
      stolen: false,
      place,
      element: r.element ?? element,
    })
  );
  if (r.grantedSoul) events.push(makeSoulEvent(state, side));
  return events;
}

/**
 * Steal likelihood for the contesting side. A steal is a Smite snipe, so it is
 * gated on a LIVING jungler: with the jungler dead there is no Smite carrier and
 * a steal is almost impossible (only a rare non-jungler execute). A living
 * jungler — more so a strong / baron_stealer one — drives the chance up.
 */
export function stealChanceFor(state: MatchState, contesting: Side, kind: ObjectiveKind): number {
  const jungler = teamOf(state, contesting).players.jungle;

  // No Smite carrier alive → steal is a fluke at best.
  if (!jungler.alive) return 0.02;

  let base = state.tuning.stealBase;
  for (const t of jungler.card.traits) {
    if (t === "baron_stealer") base += 0.2; // the classic snipe specialist
    if (t === "objective_focused") base += 0.08;
  }
  // Spec traits no motor (3.3): o Ama objetivos rouba mais dragao, larvas e Arauto (0 sem portador).
  base += objectiveLoverStealBonus(state, contesting, kind);
  // A stronger objective jungler snipes better (Smite damage / pit control).
  base += Math.max(0, (playerSlice(jungler.card, "objective") - 50) / 300);
  // Bigger pits are dived harder → slightly more stealable.
  if (kind === "baron" || kind === "elder") base += 0.05;

  return Math.min(0.45, base);
}

// resolveHeraldUse extraida para src/sim/structures.ts (D-05, plano 17-01).
// Importada via: import { resolveHeraldUse } from "./structures";

// ---------------------------------------------------------------------------
// Fights & picks
// ---------------------------------------------------------------------------

function pickChance(state: MatchState, side: Side): number {
  // Picks precisam de alvo fora de posicao (controle de mapa) e de vantagem de item:
  // a razao de goldFightMult entre os lados multiplica a chance (spec secao 2).
  const edge = side === "user" ? state.mapControl : -state.mapControl;
  const base = clamp(0.25 + edge / 300, 0.1, 0.6);
  const ratio = goldFightMult(teamOf(state, side), state) / goldFightMult(teamOf(state, opponent(side)), state);
  // Spec calendario secoes 2 e 3: pick e gank mais caros ate 14:00, e mais frequentes com mais Caos.
  return clamp(base * clamp(ratio, 0.5, 2) * phasePickScale(state) * bloodScale(state), 0.02, 0.75);
}

/**
 * Guard de abate legal (Fase 21, D-06 / D-07), compartilhado pelo pickoff e pelo all-in de rota.
 * Mesmo cardId nos dois lados (card duplicado nos dois rosters) e self-kill real: loga
 * `self-kill-ilegal` em state.diagnostics e devolve false, e o chamador suprime o abate. Mesmo
 * personId com cards diferentes e duplicidade de roster: loga `duplicidade-roster` e devolve
 * true, e o abate segue. Rng-free: chamar sempre depois de todos os sorteios do evento. O
 * resolveTeamfight tem o guard proprio (tambem testa o mesmo lado) e nao usa esta funcao.
 */
function guardKillPair(state: MatchState, side: Side, killer: PlayerState, victim: PlayerState): boolean {
  const tipo = killer.card.id === victim.card.id
    ? "self-kill-ilegal"
    : killer.card.personId === victim.card.personId
      ? "duplicidade-roster"
      : null;
  if (tipo === null) return true;
  state.diagnostics = state.diagnostics ?? [];
  const entry: DiagnosticEntry = {
    tipo,
    cardId: killer.card.id,
    personId: killer.card.personId,
    displayName: killer.card.displayName,
    teamId: side,
    timeSec: state.gameTimeSec,
  };
  state.diagnostics.push(entry);
  return tipo !== "self-kill-ilegal";
}

/** Rota do all-in: a do press, ou a de maior vantagem numa intencao agressiva; senao nenhuma. */
function allInLane(state: MatchState, side: Side, intent: MacroIntent): Lane | null {
  if (intent === "press_top") return "top";
  if (intent === "press_mid") return "mid";
  if (intent === "press_bot") return "bot";
  if (AGGRO_INTENTS.has(intent)) return bestEdgeLane(state, side);
  return null;
}

/** Jogadores de cada rota no all-in: a de baixo tem ADC e suporte, as outras um jogador so. */
const ALL_IN_ROLES: Record<Lane, Role[]> = { top: ["top"], mid: ["mid"], bot: ["adc", "support"] };

/**
 * All-in de rota (spec calendario secao 2): o laner mais forte de laning do lado abate um
 * jogador vivo da mesma rota inimiga. Sem jogador vivo dos dois lados na rota, nao ha evento.
 */
export function resolveLaneAllIn(
  state: MatchState,
  side: Side,
  lane: Lane,
  rng: () => number,
  // Spec traits no motor (3.2): o all-in do flips fixa o portador como quem mata ou como vitima.
  // Sem `forced`, o all-in de sempre.
  forced: { killer?: PlayerState; victim?: PlayerState } = {}
): SimEvent | null {
  const team = teamOf(state, side);
  const enemy = teamOf(state, opponent(side));
  const killers = ALL_IN_ROLES[lane].map((r) => team.players[r]).filter((p) => p.alive);
  const victims = ALL_IN_ROLES[lane].map((r) => enemy.players[r]).filter((p) => p.alive);
  if (killers.length === 0 || victims.length === 0) return null;
  const ctx: FightContext = {
    eventType: "solo_kill",
    minute: state.gameTimeSec / 60,
    state,
    lane,
    goldLead: (side === "user" ? 1 : -1) * (state.user.gold - state.rival.gold),
    teamDeaths: state.user.deaths + state.rival.deaths,
    lowHpTargets: false,
    killerTeamComp: team.compProfile,
    victimTeamComp: enemy.compProfile,
    gameSec: state.gameTimeSec,
  };
  const victim = forced.victim ?? selectVictim(victims, ctx, rng);
  if (!victim) return null;
  const killer = forced.killer ?? killers.reduce((a, b) => (playerSlice(b.card, "laning") > playerSlice(a.card, "laning") ? b : a));
  // Mesmo guard do pickoff (D-06 / D-07), depois de todos os sorteios: card duplicado nos dois
  // rosters nunca gera abate de si mesmo, e persona repetida entre os lados fica logada.
  if (!guardKillPair(state, side, killer, victim)) return null;

  const shutdown = victim.shutdownGold > 0;
  applyKill(state, side, killer, victim, lane, rng, "solo_kill");
  let kind: EventKind = lane === "bot" ? "kill" : "solo_kill";
  if (shutdown) kind = "shutdown";
  else if (!state.firstBloodDone) kind = "first_blood";
  state.firstBloodDone = true;
  bumpMomentum(state, side, 8);
  updateLaneState(state, side, lane, "solo_kill");
  state.lastFightWon = { side, place: lane, atSec: state.gameTimeSec };
  return makeKillEvent(state, kind, side, killer, victim, lane, { contested: false });
}

function resolvePickoff(
  state: MatchState,
  side: Side,
  intent: MacroIntent,
  // Spec traits no motor (3.3): a intencao do time da vitima decide a exposicao do Ama objetivos.
  victimIntent: MacroIntent,
  rng: () => number
): SimEvent | null {
  const attacker = teamOf(state, side);
  const victimTeam = teamOf(state, opponent(side));
  // KDA-05: FightContext inline (rng-free) para pickoff/gank.
  const pickoffCtx: FightContext = {
    eventType: intent === "gank" ? "gank" : "solo_kill",
    minute: state.gameTimeSec / 60,
    state,
    goldLead: (side === "user" ? 1 : -1) * (state.user.gold - state.rival.gold),
    teamDeaths: state.user.deaths + state.rival.deaths,
    lowHpTargets: false,
    killerTeamComp: teamOf(state, side).compProfile,
    victimTeamComp: teamOf(state, opponent(side)).compProfile,
    gameSec: state.gameTimeSec,
    exposure: objectiveLoverExposure(victimTeam, victimIntent),
  };
  // With Baron pressure the enemy top laner is often the one caught out trying
  // to answer the empowered side-lane push — bias picks toward them.
  // Site 4 (pickoff): manter draw Baron-bias rng()<0.5 ANTES do draw de vitima (ordem sagrada).
  const victim =
    hasBaronBuff(state, side) && victimTeam.players.top.alive && rng() < 0.5
      ? victimTeam.players.top
      : selectVictim(buildVictimCandidates(victimTeam, pickoffCtx), pickoffCtx, rng);
  if (!victim) return null;

  const isGank = intent === "gank";
  // Ganks are the jungler's signature; other picks go to a strong skirmisher.
  let killer: PlayerState =
    isGank && attacker.players.jungle.alive
      ? attacker.players.jungle
      : selectKiller(buildKillerCandidates(attacker, pickoffCtx), pickoffCtx, rng);
  // CAU-05 (25C-04 Task 1): a rota do gank deixou de ser sorteada uniformemente
  // e passou a ser ponderada pelo estado. O sorteio continua AQUI, no ponto de
  // chamada, e pickGankLane recebe o numero ja sorteado: 1 draw, mesma linha,
  // mesma posicao na sequencia. Aridade exatamente preservada.
  const lane: Lane = isGank ? pickGankLane(state, side, rng()) : "mid";
  const region: Lane | Region = isGank ? lane : (rng() < 0.5 ? "river_top" : "river_bot");
  // Spec traits no motor (3.4): o roamer do time entra no gank fora da rota dele. Em roamerKillShare
  // das vezes o abate e dele; senao ele entra garantido nas assistencias. O sorteio so existe com
  // roamer elegivel (T-02) e vem depois de todos os sorteios de sempre.
  const roamer = isGank ? roamerFor(attacker, lane) : null;
  if (roamer !== null && roamer !== killer && rng() < TRAIT_TUNING.roamerKillShare) killer = roamer;

  // D-06 / D-07 (Fase 21, TKR-03): guard de self-kill real e duplicidade de roster.
  // Roda APOS todos os draws de rng (Baron-bias, selectVictim, selectKiller, pickGankLane, region) --
  // rng-free a partir daqui, aridade preservada (INV-1, D-09). A engine nunca lanca excecao.
  // No pickoff killer vem de attacker (side) e victim de victimTeam (opponent) por construcao;
  // o guard de cardId cobre o caso de roster duplicado onde o mesmo card aparece nos dois lados.
  if (!guardKillPair(state, side, killer, victim)) return null; // suprimir: sem evento e sem applyKill (D-06)

  const shutdown = victim.shutdownGold > 0;
  // WR-01: repassar o eventKind real (gank|solo_kill) — pickoffCtx.eventType ja
  // calcula o tipo correto. Sem trade-back num pickoff, victimTeamTradeKills fica 0.
  applyKill(state, side, killer, victim, region, rng, pickoffCtx.eventType, 0, roamer !== null && roamer !== killer ? roamer : undefined);
  if (roamer !== null) applyRoamCost(attacker, roamer);

  let kind: EventKind = isGank ? "gank" : "kill";
  if (shutdown) kind = "shutdown";
  else if (!state.firstBloodDone) kind = "first_blood";

  if (!state.firstBloodDone) state.firstBloodDone = true;
  bumpMomentum(state, side, 8);

  // LANE-03: hooks de updateLaneState, APÓS todos os rng() do evento (pickGankLane/rng<0.5/applyKill).
  // updateLaneState é rng-free; aridade do stream RNG inalterada.
  if (isGank) {
    // Gank: classificar como dive se o atacante já tem vantagem forte na lane (heurística RESEARCH Pitfall 2).
    const attackerLead = teamOf(state, side).laneState[lane].laneLead;
    if (attackerLead > DIVE_LANE_LEAD_THRESHOLD) {
      updateLaneState(state, side, lane, "dive");
    } else {
      updateLaneState(state, side, lane, "gank_converted");
    }
  } else {
    // Solo kill: pickoff em river/mid — usar "mid" como proxy de lane (region não tem lane state).
    updateLaneState(state, side, "mid", "solo_kill");
  }

  state.lastFightWon = { side, place: region, atSec: state.gameTimeSec };
  return makeKillEvent(state, kind, side, killer, victim, region, {
    contested: false,
    ...(roamer !== null ? { roam: { name: shortName(roamer.card), tookKill: roamer === killer } } : {}),
  });
}

interface FightOpts {
  place?: Lane | Region;
  silentIfNoKills?: boolean;
  /** Spec traits no motor (3.3): a luta e uma disputa de poco deste objetivo. */
  pitObjective?: ObjectiveKind;
}

function resolveTeamfight(
  state: MatchState,
  initiator: Side,
  rng: () => number,
  opts: FightOpts = {}
): SimEvent[] {
  const defender = opponent(initiator);
  const place = opts.place ?? (["river_top", "river_bot", "mid"] as const)[Math.floor(rng() * 3)];

  // Sorteio de luta ligado ao Caos (spec secao 2): cada lado multiplica o proprio poder por
  // um uniforme em [1 - w, 1 + w], w = base + coef x caos. O estado (ouro relativo, vivos,
  // buffs, elenco) decide; o sorteio so abre espaco para zebra.
  const w = fightNoiseHalfWidth(state);
  const pInit = fightPower(state, initiator) * (1 - w + rng() * 2 * w);
  const pDef = fightPower(state, defender) * (1 - w + rng() * 2 * w);
  const winner: Side = pInit >= pDef ? initiator : defender;
  const loser = opponent(winner);
  if (state.harnessStats !== undefined) state.harnessStats.fightWins[winner] += 1;

  const ratio = Math.max(pInit, pDef) / Math.max(1, Math.min(pInit, pDef));
  // Decisiveness → how many of the loser's team fall.
  // D-03/D-04: clamp de baixas por fase -- teto deriva de maxCasualties(gameTimeSec).
  // CRITICO (INV-1/D-07): os dois draws rng() sao SEMPRE consumidos antes do clamp;
  // o cap so atua sobre o resultado ja computado, nunca dentro de um condicional.
  const cap = maxCasualties(state.gameTimeSec);
  // Spec calendario secao 3: o Caos soma (bloodScale - 1) baixas antes do arredondamento e do teto.
  const loserDeaths = clamp(Math.round(1 + (ratio - 1) * 4 + rng() * 1.5 + (bloodScale(state) - 1)), 1, cap);
  const winnerDeaths = clamp(Math.round((1 / ratio) * 1.5 * rng()), 0, Math.floor(cap / 2));

  const events: SimEvent[] = [];
  // CR-01: trade-back count = baixas do OUTRO lado nesta mesma luta (0..4).
  // Quando winner mata loser, o time do loser troca de volta `winnerDeaths`.
  // Quando loser mata winner, o time do winner troca de volta `loserDeaths`.
  const killsByWinner = applyFightCasualties(state, winner, loser, loserDeaths, place, rng, events, winnerDeaths, opts.pitObjective);
  applyFightCasualties(state, loser, winner, winnerDeaths, place, rng, events, loserDeaths, opts.pitObjective);

  // Multikill / ace labelling on the winner's biggest fragger.
  decorateMultikill(state, winner, killsByWinner, place, events);
  // D-04: gate temporal de ace -- suprimir o evento "ace" antes de 8min (ACE_MIN_SEC=480s).
  // Os kills individuais ja foram emitidos por applyFightCasualties; nenhum kill e perdido.
  if (aliveCount(teamOf(state, loser)) === 0 && state.gameTimeSec >= ACE_MIN_SEC) {
    events.push(makeAceEvent(state, winner, place));
  }

  bumpMomentum(state, winner, 18);
  state.mapControl += winner === "user" ? 14 : -14;
  state.mapControl = clamp(state.mapControl, -100, 100);
  state.lastFightSec = state.gameTimeSec;
  state.lastFightWon = { side: winner, place, atSec: state.gameTimeSec };

  if (events.length === 0 && opts.silentIfNoKills) return [];
  if (events.length === 0) {
    // A clean fight with no deaths — still note the won skirmish.
    events.push(
      baseEvent(state, "comeback_fight", winner, {
        actors: [shortName(bestPlayer(teamOf(state, winner), "teamfight").card)],
        lane: place,
        ticker: `O ${teamOf(state, winner).name} levou a melhor na escaramuça ${placeLabel(place)}.`,
      })
    );
  }
  return events;
}

/**
 * Apply N deaths on `victimSide` from `killerSide`; return per-killer counts.
 * `victimTeamTradeKills` (CR-01) = kills que o time do victim troca de volta NESTA
 * mesma luta (baixas que o killerSide sofre no outro lado da fight). Repassado ao
 * DeathContext.teamKillsAfter para a classificacao de deathQuality (0..4).
 */
function applyFightCasualties(
  state: MatchState,
  killerSide: Side,
  victimSide: Side,
  deaths: number,
  place: Lane | Region,
  rng: () => number,
  out: SimEvent[],
  victimTeamTradeKills = 0,
  pitObjective?: ObjectiveKind
): Map<string, number> {
  const killerTeam = teamOf(state, killerSide);
  const victimTeam = teamOf(state, victimSide);
  const counts = new Map<string, number>();
  // D-01 (Fase 21, TKR-01): teto de 2 shutdowns destacados por tick de teamfight.
  // O contador e rng-free e aplicado APOS os draws de selectVictim/selectKiller
  // (INV-1 preservado). As mortes acima do teto nao recebem evento "shutdown"
  // individual -- ja sao resumidas por decorateMultikill/makeAceEvent ao fim do tick.
  // Sem novo EventKind nem novo tipo de evento agregado (D-01).
  // Inicializa contando shutdowns ja existentes no buffer `out` (pois applyFightCasualties
  // e chamada duas vezes por tick: winner kills + loser kills; o teto e POR TICK, nao por
  // chamada — ambas as chamadas compartilham o mesmo array `out` e o mesmo limite de 2).
  let shutdownsHighlighted = out.filter((e) => e.kind === "shutdown").length;
  for (let i = 0; i < deaths; i++) {
    // KDA-05: construir FightContext inline (rng-free) antes dos draws de selecao.
    const fightCtx: FightContext = {
      eventType: "comeback_fight",
      minute: state.gameTimeSec / 60,
      state,
      lane: typeof place === "string" && (place === "top" || place === "mid" || place === "bot")
        ? (place as import("./matchState").Lane)
        : undefined,
      goldLead: (killerSide === "user" ? 1 : -1) * (state.user.gold - state.rival.gold),
      teamDeaths: state.user.deaths + state.rival.deaths,
      lowHpTargets: false,
      killerTeamComp: teamOf(state, killerSide).compProfile,
      victimTeamComp: teamOf(state, victimSide).compProfile,
      gameSec: state.gameTimeSec,
      pitObjective,
    };
    // Site 1 (teamfight): selectVictim + selectKiller — 1 draw cada, aridade identica.
    const victimCandidates = buildVictimCandidates(victimTeam, fightCtx);
    const victim = selectVictim(victimCandidates, fightCtx, rng);
    if (!victim) break;
    // Spread kills across the team's carries (weighted), not always one player —
    // so multikills are earned and rare, not guaranteed every fight.
    const killerCandidates = buildKillerCandidates(killerTeam, fightCtx);
    const killer = selectKiller(killerCandidates, fightCtx, rng); // draw consumido (aridade intacta, INV-1)

    // D-06 / D-07 (Fase 21, TKR-03): guard de self-kill real e duplicidade de roster.
    // Roda APOS os draws de selectVictim/selectKiller -- rng-free, sem novo draw (INV-1, D-09).
    // A engine NUNCA lanca excecao: suprime+loga ou loga+segue, nunca throw.
    if (killer.card.id === victim.card.id || killerSide === victimSide) {
      // SELF-KILL REAL: mesmo cardId OU mesmo side no team state.
      // Suprimir o evento (continue sem applyKill nem push) e registrar em diagnostics (D-06).
      state.diagnostics = state.diagnostics ?? [];
      const entryIlegal: DiagnosticEntry = {
        tipo: "self-kill-ilegal",
        cardId: killer.card.id,
        personId: killer.card.personId,
        displayName: killer.card.displayName,
        teamId: killerSide,
        timeSec: state.gameTimeSec,
      };
      state.diagnostics.push(entryIlegal);
      continue; // suprimir: nao emite evento, nao chama applyKill (D-06)
    }
    if (killer.card.personId === victim.card.personId) {
      // DUPLICIDADE ENTRE LADOS: mesmo personId em times opostos (nao e self-kill real).
      // Logar para investigacao posterior, mas o evento segue normalmente (D-06).
      state.diagnostics = state.diagnostics ?? [];
      const entryDup: DiagnosticEntry = {
        tipo: "duplicidade-roster",
        cardId: killer.card.id,
        personId: killer.card.personId,
        displayName: killer.card.displayName,
        teamId: killerSide,
        timeSec: state.gameTimeSec,
      };
      state.diagnostics.push(entryDup);
      // Nao suprime: o evento de kill segue normalmente abaixo.
    }

    const shutdown = victim.shutdownGold > 0;

    // D-02/D-07: teto de concentracao de kills por killer.
    // O draw de selectKiller ja foi consumido acima; a redistribuicao e deterministica
    // (menor contagem, ordem do array) -- sem novo draw de rng (INV-1 preservado).
    const killerCurrentCount = counts.get(killer.card.id) ?? 0;
    const maxForKiller = multikillTimePlausibility(killerCurrentCount + 1, state.gameTimeSec, {});
    let actualKiller = killer;
    if (killerCurrentCount >= maxForKiller) {
      // Redistribuir para o candidato vivo com MENOR acumulacao de kills nesta luta.
      // Empate resolvido por ordem do array (deterministica por ROLES).
      let bestCount = killerCurrentCount;
      for (const c of killerCandidates) {
        const n = counts.get(c.card.id) ?? 0;
        if (n < bestCount) { bestCount = n; actualKiller = c; }
      }
    }

    // WR-01: repassar o eventKind real ("comeback_fight") para applyKill — sem isso,
    // assignAssists/computeDeathQuality viam sempre "kill" e as tabelas afinadas por
    // tipo (ASSIST_COUNT_BY_EVENT.comeback_fight etc.) ficavam inertes.
    applyKill(state, killerSide, actualKiller, victim, place, rng, "comeback_fight", victimTeamTradeKills);
    // CRITICO (Armadilha 2): counts.set so para actualKiller (pos-redistribuicao).
    counts.set(actualKiller.card.id, (counts.get(actualKiller.card.id) ?? 0) + 1);

    // CAU-05 (25C-04 Task 2): a morte de teamfight move o LEAD DA ROTA, que ate
    // aqui nao acontecia. A chamada entra DEPOIS de todos os sorteios do evento
    // (selectVictim, selectKiller e applyKill ja rodaram), na mesma disciplina
    // que o caminho de pickoff declara logo abaixo. applyFightLaneLead e
    // rng-free por assinatura: zero sorteios novos, ordem inalterada, posicao
    // inalterada. A variacao de sorteios por TICK que aparecer na medicao e
    // efeito de TRAJETORIA, ou seja o mesmo codigo consumindo o gerador em
    // ramos diferentes porque o estado e outro, e nao consumo novo.
    applyFightLaneLead(state, killerSide, place);

    // Only surface notable single kills individually (first blood, shutdowns);
    // ordinary fight kills are summarised by the multikill/ace decorators.
    if (!state.firstBloodDone) {
      state.firstBloodDone = true;
      out.push(makeKillEvent(state, "first_blood", killerSide, actualKiller, victim, place, { contested: true }));
    } else if (shutdown) {
      // D-01 (Fase 21, TKR-01): so destacar ate 2 shutdowns por tick de teamfight.
      // Selecao deterministica: os 2 primeiros do loop (ordem de selectVictim, rng-free
      // pos-draw, INV-1). Acima do teto, nao emite evento individual -- a morte ja e
      // resumida pelo decorateMultikill/makeAceEvent existente no fim do tick (D-01).
      if (shutdownsHighlighted < 2) {
        out.push(makeKillEvent(state, "shutdown", killerSide, actualKiller, victim, place, { contested: true }));
        shutdownsHighlighted++;
      }
    }
  }
  return counts;
}

function decorateMultikill(
  state: MatchState,
  side: Side,
  counts: Map<string, number>,
  place: Lane | Region,
  out: SimEvent[]
): void {
  let topId: string | null = null;
  let topN = 0;
  for (const [id, n] of counts) {
    if (n > topN) {
      topN = n;
      topId = id;
    }
  }
  if (!topId) return;
  const team = teamOf(state, side);
  const killer = ROLES.map((r) => team.players[r]).find((p) => p.card.id === topId);
  if (!killer) return;

  const kindByN: Record<number, EventKind> = {
    2: "double_kill",
    3: "triple_kill",
    4: "quadra_kill",
    5: "penta_kill",
  };
  if (topN >= 2) {
    out.push(makeMultikillEvent(state, kindByN[Math.min(topN, 5)], side, killer, place, topN));
  } else if (out.length === 0) {
    // Single ordinary kill in this fight — still show a protagonist line.
    out.push(
      baseEvent(state, "kill", side, {
        actors: [shortName(killer.card)],
        lane: place,
        ticker: `${shortName(killer.card)} venceu a troca ${placeLabel(place)}.`,
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Structure pressure
// ---------------------------------------------------------------------------
// resolveStructurePressure, damageStructure extraidas para src/sim/structures.ts
// (D-05, plano 17-01). Importadas via: import { resolveStructurePressure,
// damageStructure } from "./structures";

// ---------------------------------------------------------------------------
// Kill application
// ---------------------------------------------------------------------------

/**
 * Transferencia de deathQuality/ticker contextual de applyKill para makeKillEvent.
 * Pattern: variavel de modulo scoped para o ciclo applyKill->makeKillEvent.
 * applyKill grava; makeKillEvent lê e reseta. Rng-free (D-03/DET-02).
 * [KDA-05 — Phase 12]
 */
let _lastDeathQuality: "good" | "neutral" | "bad" | null = null;
let _lastCtxTicker: string | null = null;
/** Mesmo padrao de transferencia dos dois campos acima, para o peso do evento (D-02,
 *  Fase 26 plano 26-09). Rng-free (DET-02). */
let _lastEventWeight: EventWeight | null = null;

function applyKill(
  state: MatchState,
  killerSide: Side,
  killer: PlayerState,
  victim: PlayerState,
  _place: Lane | Region,
  rng: () => number,
  eventKind: EventKind = "kill",
  victimTeamTradeKills = 0,
  // Spec traits no motor (3.4): o roamer que saiu da rota entra garantido nas assistencias.
  forcedAssist?: PlayerState,
): void {
  const killerTeam = teamOf(state, killerSide);
  const victimTeam = teamOf(state, opponent(killerSide));

  // D-02 (Fase 26 plano 26-09): a leitura ANTES das mutacoes do abate, capturada no
  // topo da funcao antes de qualquer sorteio ou mutacao de estado. computeWinProbability
  // e pura e rng-free (winprob.ts), entao esta leitura nao consome o gerador.
  const winProbBeforeUser = computeWinProbability(state);
  // O primeiro sangue tambem e capturado aqui: state.firstBloodDone so vira true DEPOIS
  // desta chamada retornar (nos callers, nunca dentro de applyKill), entao ele ainda
  // reflete corretamente se ESTE abate e o primeiro sangue.
  const isFirstBlood = !state.firstBloodDone;

  // Capturar bounty ANTES de zerar (sera usado no DeathContext abaixo).
  const allyGoldGiven = victim.shutdownGold;

  // Ouro real (spec secao 3): 300 + bounty da vitima (400 no first blood), piso 100.
  const killGold = killGoldFor(victim, isFirstBlood);
  creditPlayer(killerTeam, killer, killGold);
  earnBounty(killer, killGold);

  killer.kills += 1;
  killerTeam.kills += 1;
  victim.deaths += 1;
  victimTeam.deaths += 1;

  // Assists: living teammates who helped secure the kill (1..3, earned, not all).
  let assistGoldGiven = 0;
  const mates = ROLES.map((r) => killerTeam.players[r]).filter(
    (p) => p.alive && p.card.id !== killer.card.id
  );
  if (mates.length > 0) {
    // Fisher-Yates partial shuffle with the seeded rng, then take the first N.
    // INTACTO: (n-1) draws Fisher-Yates + 1 draw count (KDA-05).
    for (let i = mates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [mates[i], mates[j]] = [mates[j], mates[i]];
    }
    // 26-06 (roadmap Fase 26, criterio 6): limite do sorteio de 3 para 4, uma
    // unica chamada ao gerador preservada (a mesma chamada de sempre, so o
    // multiplicador do minimo muda), entao a contagem canonica em src/sim/ e INTACTA.
    const nAssists = 1 + Math.floor(rng() * Math.min(4, mates.length));
    // KDA-03: assignAssists re-ranqueia a lista ja embaralhada (0 draws novos).
    const assistCtx = { eventType: eventKind };
    const assistants = [...assignAssists(killer.card.id, mates, nAssists, assistCtx)];
    // Spec traits no motor (3.4): sem sorteio novo; o roamer entra no lugar do ultimo da lista.
    if (forcedAssist !== undefined && forcedAssist.alive && forcedAssist !== killer && !assistants.includes(forcedAssist)) {
      if (assistants.length < nAssists) assistants.push(forcedAssist);
      else assistants[assistants.length - 1] = forcedAssist;
    }
    const shares = splitEvenly(Math.round(killGold * ASSIST_SHARE), assistants.length);
    assistants.forEach((mate, i) => {
      mate.assists += 1;
      creditPlayer(killerTeam, mate, shares[i]);
      earnBounty(mate, shares[i]);
      assistGoldGiven += shares[i];
    });
  }

  // Victim dies: lose epic buffs (lost on death), set a time-scaled respawn.
  victim.alive = false;
  victim.hasBaronBuff = false;
  victim.hasElderBuff = false;
  victim.respawnAtSec = state.gameTimeSec + respawnSeconds(state, rng);

  settleVictimBounty(victim, killGold + assistGoldGiven);
  // Spec traits no motor (3.6): rastro do `quits` (rng-free; so age em quem tem a trait).
  noteDeathForQuits(state, victim);
  noteKillForQuits(killer);

  // *** TODOS os rng() ja consumidos ***
  // Hook rng-free: deathQuality + ticker contextual (EVT-01/02/03, DET-02).
  // Construir DeathContext inline (puro, sem rng).
  const victimSide = killerSide === "user" ? "rival" : "user";
  // savedCarry: o engage abriu luta que preservou o carry do time.
  // WR-04: usar isEngageInitiator (fonte unica, inclui tank) em vez de re-listar
  // as classes aqui — antes este proxy omitia tank e divergia de isEngageInitiator.
  const savedCarry = killerTeam.kills >= 2 && isEngageInitiator(killer);
  const deathCtx: DeathContext = {
    killerSide,
    victim,
    killer,
    state,
    eventType: eventKind,
    // teamKillsAfter: kills que o time do VICTIM trocou de volta NESTA luta (0..4).
    // CR-01: NAO usar killerTeam.kills (total acumulado da partida, cresce monotonicamente
    // e enviesa toda morte para "good"). Threaded a partir de applyFightCasualties; em
    // pickoff (sem trade) o callsite passa 0 (neutro conservador).
    teamKillsAfter: victimTeamTradeKills,
    // teamObjectiveAfter: proxy — 0 neste ponto (objetivos nao sao capturados em applyKill)
    teamObjectiveAfter: 0,
    allyGoldGiven,
    savedCarry,
  };
  const dq = computeDeathQuality(deathCtx);

  // D-02 (Fase 26 plano 26-09): a leitura DEPOIS das mutacoes do abate, no mesmo
  // ponto rng-free em que dq ja e calculado. Mesma funcao pura de winprob.ts, sem
  // copia de formula e sem consumo do gerador. O peso precisa estar pronto ANTES
  // de selectContextualTicker, porque ele agora decide a variante de texto (Task 2).
  const winProbAfterUser = computeWinProbability(state);
  const eventWeight = computeEventWeight({
    winProbBeforeUser,
    winProbAfterUser,
    isFirstBlood,
    // hadShutdownBounty: bounty de sequencia acumulada entregue ao abatedor,
    // capturado no topo desta funcao ANTES do reset de victim.shutdownGold.
    hadShutdownBounty: allyGoldGiven > 0,
  });
  const ctxTicker = selectContextualTicker(dq, eventWeight, deathCtx);

  // Gravar _deathQuality no estado para o SimEvent correspondente (D-03 — campo interno).
  // O engine armazena temporariamente nos campos expandidos para o makeKillEvent consumir.
  // Usa uma variavel de modulo para transferencia (padrao: nao modifica victim pos-morte).
  _lastDeathQuality = dq;
  _lastCtxTicker = ctxTicker;
  _lastEventWeight = eventWeight;

  // WR-03: modelo minimo de Flash (rng-free). O abatedor gasta Flash agressivo para
  // garantir o abate e fica sem Flash por FLASH_COOLDOWN_SEC; processRespawns restaura
  // ao expirar. Aplicado APOS deathQuality/ticker (nao afeta a classificacao deste
  // evento — o killer nao e a vitima aqui). Isso cria janelas reais em que um jogador
  // VIVO esta sem Flash; se for pego como vitima nesse intervalo, o peso noFlash
  // (victimScore) e o ticker ctx_adc_caught_no_flash (EVT-01) finalmente disparam.
  // Determinismo: setar campos de estado nao consome rng() — aridade do stream intacta.
  if (killer.flashUp) {
    killer.flashUp = false;
    killer.flashCooldownUntilSec = state.gameTimeSec + FLASH_COOLDOWN_SEC;
  }

  // LANE-03: first_blood hook — APÓS todos os rng() de applyKill serem consumidos (aridade preservada).
  // Chamamos updateLaneState aqui (rng-free) para não alterar a aridade do stream.
  // _place pode ser Lane | Region — passar apenas se for Lane válida; fallback "mid".
  if (!state.firstBloodDone) {
    const fbLane: Lane =
      _place === "top" || _place === "mid" || _place === "bot" ? (_place as Lane) : "mid";
    updateLaneState(state, killerSide, fbLane, "first_blood");
  }

  void victimSide; // usado em deathCtx acima
}

/** Respawn time grows with game time (pesquisa.md: scales after 15:00). */
function respawnSeconds(state: MatchState, rng: () => number): number {
  const minutes = state.gameTimeSec / 60;
  const base = 8 + minutes * 1.6;
  return Math.round(clamp(base + rng() * 4, 8, 70));
}

// ---------------------------------------------------------------------------
// Game end
// ---------------------------------------------------------------------------

export function finishGameStructures(state: MatchState, side: Side): void {
  state.winner = side;
}

function finishGame(state: MatchState, side: Side, timeline: SimEvent[], _rng: () => number): void {
  state.ended = true;
  state.winner = side;
  const team = teamOf(state, side);
  const enemy = teamOf(state, opponent(side));
  timeline.push(
    baseEvent(state, "gg", side, {
      actors: [],
      lane: "base",
      ticker: `GG · o ${team.name} fechou a partida contra o ${enemy.name}.`,
    })
  );
}

// ---------------------------------------------------------------------------
// Event constructors
// ---------------------------------------------------------------------------

export function baseEvent(
  state: MatchState,
  kind: EventKind,
  side: Side | null,
  extra: Partial<SimEvent> & { ticker: string }
): SimEvent {
  return {
    id: nextEventId(),
    timeSec: state.gameTimeSec,
    kind,
    side,
    actors: extra.actors ?? [],
    victims: extra.victims ?? [],
    lane: extra.lane ?? null,
    objectiveKind: extra.objectiveKind ?? null,
    contested: extra.contested ?? false,
    stolen: extra.stolen ?? false,
    ticker: extra.ticker,
    winProbUserAfter: state.winProbUser,
    score: {
      userKills: state.user.kills,
      rivalKills: state.rival.kills,
      userTowers: state.user.towersDestroyed,
      rivalTowers: state.rival.towersDestroyed,
      userDragons: state.user.dragons.length,
      rivalDragons: state.rival.dragons.length,
      userBaron: hasBaronBuff(state, "user"),
      rivalBaron: hasBaronBuff(state, "rival"),
      userElder: hasElderBuff(state, "user"),
      rivalElder: hasElderBuff(state, "rival"),
      userGold: state.user.gold,
      rivalGold: state.rival.gold,
      userDragonEls: [...state.user.dragons],
      rivalDragonEls: [...state.rival.dragons],
    },
    map: buildMapSnapshot(state),
  };
}

/** Snapshot the live map (structures + objective timers) for the playback HUD. */
function buildMapSnapshot(state: MatchState): import("./types").MapSnapshot {
  const t = state.gameTimeSec;
  const remaining = (at: number | null): number | null =>
    at === null ? null : Math.max(0, at - t);

  const teamSnap = (team: TeamState) => {
    const lane = (l: Lane) => {
      const s = team.structures[l];
      return {
        outer: s.outerAlive,
        inner: s.innerAlive,
        inhibTurret: s.inhibTurretAlive,
        inhibitor: s.inhibitorAlive,
        inhibInSec: remaining(s.inhibitorRespawnAtSec),
      };
    };
    const player = (role: (typeof ROLES)[number]) => {
      const p = team.players[role];
      return {
        alive: p.alive,
        // Spec traits no motor (4): quem quitou fica sem relogio, quem assiste nao sabe se volta.
        respawnInSec: p.away === true ? null : remaining(p.respawnAtSec),
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        gold: p.gold,
        shutdownGold: p.shutdownGold,
        // Spec traits no motor (4): so aparece em quem saiu, para nao mudar o snapshot dos demais.
        ...(p.away === true ? { away: true } : {}),
      };
    };
    return {
      top: lane("top"),
      mid: lane("mid"),
      bot: lane("bot"),
      nexusTurrets: team.nexusTurretsAlive,
      nexusExposed: team.nexusExposed,
      players: {
        top: player("top"),
        jungle: player("jungle"),
        mid: player("mid"),
        adc: player("adc"),
        support: player("support"),
      },
    };
  };

  const o = state.objectives;
  return {
    user: teamSnap(state.user),
    rival: teamSnap(state.rival),
    dragonAlive: o.dragonAlive,
    dragonInSec: o.dragonAlive ? null : remaining(o.dragonRespawnAtSec),
    dragonElement: o.dragonElement,
    soulElement: o.soulElement,
    userSoul: state.user.soul,
    rivalSoul: state.rival.soul,
    dragonsTaken: o.dragonsTaken,
    baronAlive: o.baronAlive,
    baronInSec: o.baronAlive ? null : remaining(o.baronRespawnAtSec),
    heraldAlive: o.heraldAlive,
    voidgrubsAlive: o.voidgrubsAlive,
    elderAlive: o.elderAlive,
    elderUnlocked: o.elderUnlocked,
    elderInSec: o.elderAlive ? null : o.elderUnlocked ? remaining(o.elderRespawnAtSec) : null,
    // LANE-04: strongside/weakside por-tick — lido pelo HUD (D-05).
    // rng-free: computeStrongsideScore lê laneState + metricsBase congelados.
    strongside: {
      user: computeStrongsideScore(state, "user"),
      rival: computeStrongsideScore(state, "rival"),
    },
    // COMP-03/D-06: compProfile por-tick — rótulo pt-BR lido pelo HUD.
    // rng-free: labelCompProfile é lookup simples; compProfile é time-invariante.
    compProfile: {
      user: {
        dominantTags: state.user.compProfile.dominantTags,
        label: labelCompProfile(state.user.compProfile),
      },
      rival: {
        dominantTags: state.rival.compProfile.dominantTags,
        label: labelCompProfile(state.rival.compProfile),
      },
    },
  };
}

function makeKillEvent(
  state: MatchState,
  kind: EventKind,
  side: Side,
  killer: PlayerState,
  victim: PlayerState,
  place: Lane | Region,
  opts: { contested: boolean; roam?: { name: string; tookKill: boolean } }
): SimEvent {
  const k = shortName(killer.card);
  const v = shortName(victim.card);
  const where = placeLabel(place);
  let ticker: string;
  switch (kind) {
    case "first_blood":
      ticker = opts.roam === undefined
        ? `${k} abriu o placar em cima de ${v} ${where}.`
        : opts.roam.tookKill
          ? `${k} saiu da rota e abriu o placar em cima de ${v} ${where}.`
          : `${k} abriu o placar em cima de ${v} ${where} com o roam de ${opts.roam.name}.`;
      break;
    case "shutdown":
      ticker = opts.roam === undefined
        ? `${k} encerrou a sequência de ${v} e coletou o shutdown ${where}.`
        : opts.roam.tookKill
          ? `${k} saiu da rota e encerrou a sequência de ${v} e coletou o shutdown ${where}.`
          : `${k} encerrou a sequência de ${v} e coletou o shutdown ${where} com o roam de ${opts.roam.name}.`;
      break;
    case "gank":
      ticker = opts.roam === undefined
        ? `${k} apareceu ${where} e garantiu o gank em cima de ${v}.`
        : opts.roam.tookKill
          ? `${k} saiu da rota e garantiu o gank em cima de ${v} ${where}.`
          : `${k} apareceu ${where} com o roam de ${opts.roam.name} e garantiu o gank em cima de ${v}.`;
      break;
    case "solo_kill":
      ticker = `${k} solou ${v} ${where}.`;
      break;
    default:
      ticker = `${k} abateu ${v} ${where}.`;
  }

  // KDA-05 / EVT-01/02: consumir deathQuality + ticker contextual gravados por applyKill.
  // Se ctxTicker nao for null, substituicao parcial do ticker generico (D-05).
  const dq = _lastDeathQuality;
  const ctxTicker = _lastCtxTicker;
  const eventWeight = _lastEventWeight;
  _lastDeathQuality = null;
  _lastCtxTicker = null;
  _lastEventWeight = null;

  // Spec traits no motor (3.4): com roam, a narracao do roam vence o ticker contextual (que ja
  // foi consumido acima). Sem roam nada muda (T-02).
  const finalTicker = opts.roam !== undefined ? ticker : (ctxTicker ?? ticker);

  return {
    ...baseEvent(state, kind, side, {
      actors: [k],
      victims: [v],
      lane: place,
      contested: opts.contested,
      ticker: finalTicker,
    }),
    // D-03: _deathQuality e campo interno — NUNCA renderizado na UI.
    ...(dq != null ? { _deathQuality: dq } : {}),
    // D-02 (Fase 26 plano 26-09): _eventWeight e campo interno de diagnostico, no
    // mesmo padrao de _deathQuality, NUNCA renderizado na UI.
    ...(eventWeight != null ? { _eventWeight: eventWeight } : {}),
  };
}

function makeMultikillEvent(
  state: MatchState,
  kind: EventKind,
  side: Side,
  killer: PlayerState,
  place: Lane | Region,
  n: number
): SimEvent {
  const k = shortName(killer.card);
  const labels: Record<number, string> = {
    2: "DOUBLE KILL",
    3: "TRIPLE KILL",
    4: "QUADRA KILL",
    5: "PENTAKILL",
  };
  return baseEvent(state, kind, side, {
    actors: [k],
    lane: place,
    ticker: `${k} limpou a luta ${placeLabel(place)} com um ${labels[Math.min(n, 5)]}!`,
  });
}

function makeAceEvent(state: MatchState, side: Side, place: Lane | Region): SimEvent {
  const team = teamOf(state, side);
  return baseEvent(state, "ace", side, {
    actors: [],
    lane: place,
    ticker: `ACE para o ${team.name} ${placeLabel(place)}!`,
  });
}

function makeObjectiveEvent(
  state: MatchState,
  side: Side,
  kind: ObjectiveKind,
  opts: { contested: boolean; stolen: boolean; place: Region; element: DragonElement | null; lead?: string }
): SimEvent {
  const team = teamOf(state, side);
  const secured = objectiveSecurer(team);
  const who = shortName(secured.card);
  const el = opts.element;
  let evKind: EventKind;
  let ticker: string;

  // [OBJ-03 / D-03] Duplo-ator: calculo rng-free ANTES do switch.
  // Apenas para baron/elder nao roubados: verifica se o maior dano nao-jungler
  // vivo supera o confirmador por mais que DUPLO_ATOR_RATIO.
  // O segundo ator aparece SOMENTE no ticker; actors[] permanece [who] (Armadilha 4).
  // Molde: bestPlayer loop (engine.ts:1529 nesta versao).
  // Usa slice "teamfight" como proxy de dano no objetivo (o confirmador usa smite
  // = objective, mas o carry rival usa burst = teamfight; comparar na mesma escala).
  let secondaryActor: string | null = null;
  if ((kind === "baron" || kind === "elder") && !opts.stolen) {
    const junglerFight = playerSlice(secured.card, "teamfight");
    let maxDmg = -Infinity;
    let topDmgPlayer: PlayerState | null = null;
    for (const r of ROLES) {
      if (r === "jungle") continue;
      const p = team.players[r];
      if (!p.alive) continue;
      const dmg = playerSlice(p.card, "teamfight");
      if (dmg > maxDmg) {
        maxDmg = dmg;
        topDmgPlayer = p;
      }
    }
    if (topDmgPlayer !== null && maxDmg > junglerFight * DUPLO_ATOR_RATIO) {
      secondaryActor = shortName(topDmgPlayer.card);
    }
  }

  switch (kind) {
    case "dragon":
      if (opts.stolen) {
        evKind = "dragon_steal";
        ticker = `${who} ROUBOU o ${dragonLabel(el).toLowerCase()} no último instante!`;
      } else {
        evKind = "dragon_taken";
        ticker = opts.contested
          ? `O ${team.name} venceu a luta e garantiu o ${dragonLabel(el)}.`
          : `${who} garantiu o ${dragonLabel(el)} sem contestação.`;
      }
      break;
    case "elder":
      evKind = opts.stolen ? "elder_steal" : "elder_taken";
      if (opts.stolen) {
        ticker = `${who} entrou no pit e ROUBOU o Dragão Ancião!`;
      } else if (secondaryActor !== null) {
        ticker = `${who} garantiu o Dragão Ancião, com ${secondaryActor} derretendo o objetivo.`;
      } else {
        ticker = `${who} garantiu o Dragão Ancião para o ${team.name}.`;
      }
      break;
    case "baron":
      evKind = opts.stolen ? "baron_steal" : "baron_taken";
      if (opts.stolen) {
        ticker = `${who} ROUBOU o Barão Nashor na cara do rival!`;
      } else if (secondaryActor !== null) {
        ticker = `${who} confirmou o Barão Nashor, com ${secondaryActor} derretendo o objetivo.`;
      } else {
        ticker = `${who} confirmou o Barão Nashor para o ${team.name}.`;
      }
      break;
    case "herald":
      evKind = "herald_taken";
      ticker = `${who} assegurou o Arauto do Vale para o ${team.name}.`;
      break;
    case "voidgrubs":
      evKind = "voidgrubs_taken";
      ticker = `${who} saiu com as Larvas do Vazio e aumentou a pressão estrutural do ${team.name}.`;
      break;
  }

  if (opts.lead) ticker = prefixLead(opts.lead, ticker);

  return baseEvent(state, evKind, side, {
    actors: [who],
    lane: opts.place,
    objectiveKind: kind,
    contested: opts.contested,
    stolen: opts.stolen,
    ticker,
  });
}

function makeSoulEvent(state: MatchState, side: Side): SimEvent {
  const team = teamOf(state, side);
  return baseEvent(state, "dragon_taken", side, {
    actors: [],
    lane: "river_bot",
    objectiveKind: "dragon",
    ticker: `A ${soulLabel(team.soul)} ficou com o ${team.name}!`,
  });
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

/**
 * Fallback quando ninguem esta vivo: todos, menos quem esta fora da partida (quits em away).
 * Se so restar gente fora, devolve a lista original (nunca vazia). Sem away nada muda (T-02).
 */
function fallbackCandidates(team: TeamState): PlayerState[] {
  const all = ROLES.map((r) => team.players[r]);
  const presentes = all.filter((p) => p.away !== true);
  return presentes.length > 0 ? presentes : all;
}

/**
 * Candidatos a killer: todos os vivos do time; fallback para todos se ninguem vivo
 * (paridade exata com pickActor engine.ts:1439). Filtro puro, sem rng (INV-arity).
 * [KDA-05 — Phase 12]
 */
export function buildKillerCandidates(team: TeamState, _ctx: FightContext): PlayerState[] {
  const alive = ROLES.map((r) => team.players[r]).filter((p) => p.alive);
  return alive.length > 0 ? alive : fallbackCandidates(team);
}

/**
 * Candidatos a vitima: todos os vivos do time; fallback para todos se ninguem vivo
 * (paridade exata com livingTarget — qualquer vivo pode ser selecionado). Filtro puro,
 * sem rng (INV-arity). [KDA-05 — Phase 12]
 */
function buildVictimCandidates(team: TeamState, _ctx: FightContext): PlayerState[] {
  const alive = ROLES.map((r) => team.players[r]).filter((p) => p.alive);
  return alive.length > 0 ? alive : fallbackCandidates(team);
}

export function bestPressureLane(state: MatchState, side: Side): Lane {
  let lane: Lane = "mid";
  let best = -Infinity;
  for (const l of LANES) {
    const p = side === "user" ? state.pressure[l] : -state.pressure[l];
    if (p > best) {
      best = p;
      lane = l;
    }
  }
  return lane;
}

// ---------------------------------------------------------------------------
// CAU-05 (25C-04 Task 2): mortes de teamfight movem o lead da rota
// ---------------------------------------------------------------------------

/**
 * Local da luta para rota estrutural. Tipada como Record sobre a uniao inteira
 * de regioes, de proposito: acrescentar uma regiao nova ao tipo QUEBRA A
 * COMPILACAO ate ela ser mapeada aqui, ou seja a exaustividade e provada pelo
 * compilador e nao por revisao.
 *
 * DECISAO DE DESENHO, COM A ALTERNATIVA REGISTRADA AO LADO, porque isto e uma
 * leitura narrativa e nao um fato do jogo:
 *
 *   - ADOTADO: uma luta no rio de cima conta como vantagem da rota de CIMA, e
 *     uma no rio de baixo como vantagem da rota de BAIXO. O mesmo vale para as
 *     duas metades da selva.
 *   - ALTERNATIVA REJEITADA: so a rota do meio contar. O resolvedor de
 *     teamfight escolhe o local entre duas regioes de rio e a rota do meio, e
 *     apenas a ultima ja e uma rota. Com a alternativa, DOIS TERCOS das lutas
 *     nao moveriam lead de rota nenhuma e a ligacao ficaria quase inerte.
 *
 * Nenhuma banda desta milestone mede se essa leitura faz sentido para quem
 * assiste a partida, entao ela vai ao checkpoint humano da onda 6.
 *
 * A base nao mapeia: uma luta na base nao e vantagem de rota nenhuma.
 */
export const FIGHT_PLACE_TO_LANE: Record<Region, Lane | null> = {
  river_top: "top",
  top_jg: "top",
  river_bot: "bot",
  bot_jg: "bot",
  base: null,
};

/**
 * Mapeia o local da teamfight para a rota estrutural. Determinista, puro e
 * RNG-FREE por assinatura: um unico parametro e nenhum gerador.
 */
export function placeToLane(place: Lane | Region): Lane | null {
  if (place === "top" || place === "mid" || place === "bot") return place;
  return FIGHT_PLACE_TO_LANE[place];
}

/**
 * Aplica o efeito de uma morte de teamfight sobre o lead da rota. Devolve a
 * rota afetada, ou null quando o local nao mapeia.
 *
 * RNG-FREE por assinatura (tres parametros, nenhum gerador). O atualizador de
 * estado de rota tambem e explicitamente rng-free e o codigo ja registra isso:
 * zero sorteios novos, ordem inalterada, posicao inalterada.
 *
 * O TIPO DE EVENTO E O DE MERGULHO, e a escolha precisa estar escrita: uma luta
 * ganha numa rota move o lead daquela rota na mesma direcao e na mesma
 * magnitude que um mergulho bem sucedido move.
 *
 * Esta funcao existe extraida em vez de embutida no aplicador de baixas pelo
 * mesmo motivo que a onda 3 extraiu os predicados do resolvedor: o teste dirige
 * EXATAMENTE o codigo que a engine roda, e os dois nao podem divergir.
 */
export function applyFightLaneLead(
  state: MatchState,
  killerSide: Side,
  place: Lane | Region
): Lane | null {
  const fightLane = placeToLane(place);
  if (fightLane) updateLaneState(state, killerSide, fightLane, "dive");
  return fightLane;
}

// ---------------------------------------------------------------------------
// CAU-05 (25C-04 Task 1): a rota do gank ponderada pelo estado
// ---------------------------------------------------------------------------

/**
 * GRADE DE CALIBRACAO da temperatura de foco do gank, cinco valores do MAIS
 * CONCENTRADO ao MAIS ACHATADO:
 *
 *     1  |  2  |  4  |  8  |  16
 *
 * A temperatura DIVIDE o termo de estado: quanto MAIOR o valor, mais achatada
 * fica a distribuicao e mais perto ela fica do sorteio uniforme que substitui.
 * No limite de temperatura infinita a substituicao e um no-op exato.
 *
 * PONTO DE OPERACAO escolhido na onda 5, pelo sweep do CONJUNTO, com o criterio
 * commitado ANTES dos numeros (38206f0) e a grade medida em quinze pontos
 * (d58980c). Registro completo em docs/diagnostics/25C-sweep.md secao 3.
 *
 * NAO REAJUSTE ESTA CONSTANTE ISOLADAMENTE. As alavancas desta fase NAO SOMAM:
 * elas competem pela MESMA massa de peso normalizada. Medido sobre o conjunto,
 * acrescentar forca no peso pos-evento derruba P1 de 1,473 para 1,319. Qualquer
 * reajuste aqui exige remedir o par com POST_FIGHT_OBJECTIVE_W junto.
 *
 * A GRADE MEDIDA neste eixo, com o peso pos-evento no ponto escolhido (1,0), no
 * tier de referencia, W = 60 s, N = 800:
 *
 *   T    P1      P2        P3     duracao   1a torre   veredito
 *   1    1,832   2,024 OK  1,341  29,491    795 s      RECUSADO pela regra de parada
 *   2    1,716   2,062 OK  1,268  29,206    795 s      RECUSADO (duracao E 1a torre)
 *   4    1,635   1,955 OK  1,317  29,708    795 s      RECUSADO pela regra de parada
 *   8    1,476   2,013 OK  1,296  30,024    810 s      <== ESCOLHIDO
 *   16   1,507   1,931     1,320  30,264    810 s      3 de 6 no acoplamento
 *
 * ============================ LEIA ISTO ANTES DE VARRER ESTE EIXO ============
 * A MEDIANA DA PRIMEIRA TORRE E QUANTIZADA EM DEGRAUS DE 15 s, porque o tick da
 * simulacao e de 15 s. Na grade inteira ela assume DOIS valores e nenhum outro:
 * 795 s (temperaturas 1, 2 e 4) ou 810 s (temperaturas 8 e 16). Os 800 s da regra
 * de parada da fase caem EXATAMENTE ENTRE dois degraus adjacentes, ou seja
 * A FRONTEIRA NAO TEM INTERIOR e NAO EXISTE CALIBRACAO FINA NESTE EIXO.
 *
 * Varrer uma grade fina aqui supondo continuidade e desperdicio de tempo: nao ha
 * ponto entre 795 e 810. O preco de um degrau esta MEDIDO: 0,159 de lift de P1
 * (temperatura 4 le 1,635 a 795 s contra temperatura 8 em 1,476 a 810 s).
 * =============================================================================
 *
 * POR QUE 8 VENCEU, e por que nao foi 1: a temperatura 1 FECHA o par de gank para
 * torre, com P1 em 1,832 EXATAMENTE no piso, e da 28 bandas verdes contra as 27
 * do ponto escolhido. Ela foi recusada pela REGRA DE PARADA da fase (mediana da
 * primeira torre maior ou igual a 800 s), e a recusa e por CUSTO DE MARGEM e nao
 * por ser um ponto ruim: ela deixaria um unico tick de 15 s ate o piso da banda,
 * e a Fase 26 corta cerca de 40 por cento dos abates e pode empurrar a primeira
 * torre para mais cedo. O ponto 1; 1,0 fica MEDIDO E DISPONIVEL no sweep, secao
 * 3.11, para quem revisitar P1 depois da Fase 26, sem precisar remedir a grade.
 */
const GANK_FOCUS_TEMPERATURE = 8;

/**
 * Piso do peso de rota do gank. Parte do contrato TESTADO e nao detalhe: com
 * lead de rota e pressao nos extremos alcancaveis (laneLead clampado em
 * LANE_LEAD_CAP dos dois lados, pressao clampada em 100) o termo somado passa
 * de menos 1, e sem o piso o peso ficaria negativo e a rota sairia da
 * distribuicao, ou seja ficaria INALCANCAVEL por estado.
 */
export const GANK_LANE_WEIGHT_FLOOR = 0.05;

/**
 * Pesos por rota da decisao de gank. Puro e RNG-FREE: le apenas estado que a
 * engine ja mantem e nunca consome o gerador nem Math.random.
 *
 * A ESCALA DE CADA TERMO E MEDIDA E NAO INTUIDA (25C-RESEARCH secao 6.4,
 * amplitude por tick e por rota, N = 300 partidas). Quem for reequilibrar
 * precisa destes numeros, e nao de intuicao:
 *
 *   - LEAD DE ROTA, divisor 12. No early a media de |laneLead do time menos
 *     laneLead do inimigo| e 14,36. O gank so existe no early (15,20 por cento
 *     das decisoes ali contra 0,00 por cento depois), entao este e o UNICO
 *     estado com amplitude util para esta decisao. Na media do early o termo
 *     vale cerca de 1,20 antes da temperatura.
 *   - PRESSAO SINALIZADA, divisor 40. No early a media de |pressao| por rota e
 *     3,87, ou seja praticamente zero. Na media do early o termo vale cerca de
 *     0,097, cerca de DOZE VEZES menos que o lead. A assimetria e deliberada.
 *   - VANTAGEM DE LANING, divisor 20. E o termo estatico, o unico que existe
 *     antes de qualquer evento acontecer.
 *
 * A pressao entra aqui com peso pequeno de proposito e NUNCA no peso da decisao
 * de pressionar: ali ela ja e o numerador do gate do proprio resolvedor, e
 * ligar as duas contaria o mesmo canal duas vezes (25C-RESEARCH secao 6.3).
 */
export function gankLaneWeights(state: MatchState, side: Side): number[] {
  const team = teamOf(state, side);
  const enemy = teamOf(state, opponent(side));
  // Pressao e sinalizada: +usuario, -rival. Para o lado rival aplicamos o sinal.
  const sign = side === "user" ? 1 : -1;
  return LANES.map((lane) => {
    const lead = team.laneState[lane].laneLead - enemy.laneState[lane].laneLead;
    const press = sign * state.pressure[lane];
    const edge = laneLaningPower(team, lane) - laneLaningPower(enemy, lane);
    const focus = (lead / 12 + press / 40 + edge / 20) / GANK_FOCUS_TEMPERATURE;
    return Math.max(GANK_LANE_WEIGHT_FLOOR, 1 + focus);
  });
}

/**
 * Rota do gank ponderada pelo estado. Substitui o sorteio uniforme que estava
 * aqui SEM MEXER NO CONSUMO DO GERADOR: o sorteio continua no ponto de chamada
 * e esta funcao recebe o numero JA SORTEADO como argumento puro. Consome
 * exatamente o mesmo 1 sorteio que o sorteio uniforme consumia, na mesma linha
 * e na mesma posicao da sequencia.
 *
 * RNG-FREE POR ASSINATURA, e o contrato e provado duas vezes: pelo compilador,
 * porque a funcao nao recebe gerador nenhum, e por assercao sobre o numero de
 * parametros (expect(pickGankLane.length).toBe(3)), no mesmo padrao que a Fase
 * 25B usou em accrueSiegePressure.
 *
 * A variante DETERMINISTA (escolher a rota de maior peso, sem sorteio) foi
 * medida e REJEITADA: ela entrega o mesmo ganho de acoplamento (1,307 contra
 * 1,308), mas REMOVE um sorteio, desloca a sequencia dali para a frente e
 * quebra o piso de duracao sozinha.
 *
 * A COMPARACAO DO ACUMULADOR E ESTRITA (r < 0) E NAO A CONVENCAO r <= 0 DE
 * weightedPickIntent, e a escolha e deliberada, declarada e testada. Com os
 * tres pesos IGUAIS, que e a neutralidade perfeita da fixture flat, a
 * comparacao estrita reproduz LANES[Math.floor(roll * LANES.length)] byte a
 * byte, INCLUSIVE nas duas fronteiras roll = 1/3 e roll = 2/3. Nessas duas
 * fronteiras o acumulador vale exatamente 0 depois da subtracao: a estrita
 * segue para a faixa seguinte, que e o que o piso do sorteio uniforme faz, e a
 * nao estrita pararia na anterior. E exatamente ali que as duas convencoes
 * divergem, e e por isso que a identidade em neutro desta fase sobrevive POR
 * CONSTRUCAO em vez de por calibracao.
 */
export function pickGankLane(state: MatchState, side: Side, roll: number): Lane {
  const w = gankLaneWeights(state, side);
  const total = w[0] + w[1] + w[2];
  let r = roll * total;
  for (let i = 0; i < LANES.length; i++) {
    r -= w[i];
    if (r < 0) return LANES[i];
  }
  return LANES[LANES.length - 1];
}

export function bumpMomentum(state: MatchState, side: Side, amount: number): void {
  state.momentum += side === "user" ? amount : -amount;
  state.momentum = clamp(state.momentum, -100, 100);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
