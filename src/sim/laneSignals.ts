/**
 * src/sim/laneSignals.ts
 *
 * Recheio narrativo do early game (D-01, plano 26-07, Fase 26).
 *
 * O playback corta cerca de 60 eventos por partida (Fases 24/25/25B/25C) e o
 * bucket de 0 a 14 minutos e o que perde mais densidade relativa. Este modulo
 * NAO inventa mecanica nova: ele transforma tres grandezas continuas que a
 * engine ja calcula e mantem internas (vantagem persistente de lane, a
 * prioridade derivada dela, e a atencao do jungler recebida, ela propria
 * derivada de pressao) em eventos visiveis discretos, pelo mesmo molde que
 * `classifyStructureCrossing` (structures.ts) ja usa para placas e torres em
 * risco.
 *
 * Design:
 *  - classifyLaneCrossing e FUNCAO PURA: nao le nem escreve estado, nao
 *    consome o gerador, nao constroi evento. So decide, a partir de um valor
 *    ANTES e um valor DEPOIS mais o estado de armamento (histerese), se um
 *    cruzamento aconteceu e qual e o proximo estado de armamento.
 *  - A HISTERESE e obrigatoria (T-26-22): cada grupo de sinal tem um limiar
 *    de subida e um limiar de descida ESTRITAMENTE menor. Um sinal so pode
 *    emitir de novo depois de cair abaixo do limiar de descida (rearmar).
 *  - accrueLaneSignals (Task 2, plano 26-07) e o acumulador que liga este
 *    classificador ao laco de tick, no mesmo ponto e pelas mesmas razoes que
 *    accrueSiegePressure (structures.ts) usa.
 *
 * NUNCA importa nem chama o gerador (nem `./rng`, nem o parametro que outros
 * modulos chamam de gerador): o detector inteiro e livre de sorteio, e essa
 * propriedade e a razao de a leitura do diff de aridade continuar trivial
 * (T-26-21).
 *
 * accrueLaneSignals (Task 2) e o acumulador: le os tres sinais persistidos no
 * registro de estado de lane, chama classifyLaneCrossing para cada um, e
 * quando um cruzamento acontece constroi o evento com o mesmo construtor de
 * evento base (`baseEvent`, engine.ts) que os eventos estruturais usam. O
 * texto pt-BR escolhe entre variantes por um criterio deterministico do
 * proprio estado (nunca sorteio), no mesmo espirito de `deathQuality.ts`.
 */

import { LANES, TIMERS, teamOf, type Lane, type MatchState, type Side } from "./matchState";
import { shortName, placeLabel } from "./ticker";
import type { SimEvent } from "./simEvents";
import { baseEvent } from "./engine";

// ---------------------------------------------------------------------------
// Constantes de limiar, os quatro numeros do recheio narrativo (D-01)
// ---------------------------------------------------------------------------

/**
 * Limiar de subida do GRUPO "vantagem de lane", compartilhado por laneLead
 * (escala -LANE_LEAD_CAP..+LANE_LEAD_CAP, ou seja -60..+60, laneState.ts) e
 * por prioScore (escala -100..+100, mas dominado pelo termo laneLead*0.7,
 * ambos sao a MESMA vantagem sob duas projecoes do registro de estado de
 * lane, entao dividem o mesmo par de limiares em vez de cada um ter o seu).
 */
export const LANE_ADVANTAGE_RISE_THRESHOLD = 20;

/**
 * Limiar de descida do grupo "vantagem de lane", ESTRITAMENTE menor que o de
 * subida (histerese obrigatoria, T-26-22). Mesma escala de
 * LANE_ADVANTAGE_RISE_THRESHOLD.
 */
export const LANE_ADVANTAGE_FALL_THRESHOLD = 12;

/**
 * Limiar de subida PROPRIO da atencao do jungler recebida
 * (laneState.jungleAttentionReceived, escala -1..+1, derivada de
 * state.pressure[lane] normalizado, laneState.ts). Escala muito diferente da
 * vantagem de lane, por isso este grupo tem o seu proprio par de limiares em
 * vez de compartilhar o de cima.
 */
export const JUNGLE_ATTENTION_RISE_THRESHOLD = 0.35;

/**
 * Limiar de descida da atencao do jungler, ESTRITAMENTE menor que o de
 * subida (histerese obrigatoria, T-26-22). Mesma escala de
 * JUNGLE_ATTENTION_RISE_THRESHOLD.
 */
export const JUNGLE_ATTENTION_FALL_THRESHOLD = 0.2;

// ---------------------------------------------------------------------------
// Tipos publicos
// ---------------------------------------------------------------------------

/**
 * Os tres sinais que o classificador reconhece. Cada um mapeia para um campo
 * ja existente no registro de estado de lane (laneState.ts) e para um dos
 * tres EventKind novos do recheio (simEvents.ts).
 */
export type LaneSignalKind = "laneLead" | "prio" | "jungleAttention";

/**
 * Uniao de literais no mesmo formato de StructureCrossing (structures.ts):
 * um valor por evento possivel e um valor para ausencia de evento.
 */
export type LaneCrossing =
  | "lane_advantage_building"
  | "lane_priority_shift"
  | "jungler_attention_shift"
  | "none";

/** Par de limiares (subida, descida) de um grupo de sinal. */
interface SignalThresholds {
  rise: number;
  fall: number;
}

/** Resultado de uma chamada ao classificador: o cruzamento e o proximo estado de armamento. */
export interface LaneCrossingOutcome {
  crossing: LaneCrossing;
  /** Proximo valor de "armed" a guardar no bookkeeping (laneState.narrativeSignalState). */
  armed: boolean;
}

// ---------------------------------------------------------------------------
// Tabelas de despacho por sinal (sem branching frouxo, leitura direta)
// ---------------------------------------------------------------------------

const THRESHOLDS_BY_SIGNAL: Record<LaneSignalKind, SignalThresholds> = {
  laneLead: { rise: LANE_ADVANTAGE_RISE_THRESHOLD, fall: LANE_ADVANTAGE_FALL_THRESHOLD },
  prio: { rise: LANE_ADVANTAGE_RISE_THRESHOLD, fall: LANE_ADVANTAGE_FALL_THRESHOLD },
  jungleAttention: { rise: JUNGLE_ATTENTION_RISE_THRESHOLD, fall: JUNGLE_ATTENTION_FALL_THRESHOLD },
};

const EVENT_BY_SIGNAL: Record<LaneSignalKind, Exclude<LaneCrossing, "none">> = {
  laneLead: "lane_advantage_building",
  prio: "lane_priority_shift",
  jungleAttention: "jungler_attention_shift",
};

// ---------------------------------------------------------------------------
// classifyLaneCrossing, classificador puro de cruzamento com histerese (D-01)
// ---------------------------------------------------------------------------

/**
 * Classifica um cruzamento de sinal de lane: dado o sinal, o valor ANTES, o
 * valor DEPOIS e se o detector esta armado, decide se um evento deve ser
 * emitido e qual e o proximo estado de armamento.
 *
 * FUNCAO PURA: nao le nem escreve estado, nao consome o gerador, nao
 * constroi evento. Todo o estado (armed) entra e sai pelos parametros, o
 * chamador (accrueLaneSignals, Task 2) e quem guarda o retorno em
 * laneState.narrativeSignalState.
 *
 * A REGRA DE CRUZAMENTO copia a forma de classifyStructureCrossing
 * (structures.ts): emite quando o valor ANTES esta abaixo do limiar de
 * subida e o valor DEPOIS esta no limiar ou acima. Nunca por leitura de
 * estado absoluto (nunca "valor >= limiar" sozinho).
 *
 * A HISTERESE (T-26-22): enquanto `armed` for false (o sinal ja emitiu nesta
 * banda), nenhum cruzamento de subida e avaliado, o sinal so re-arma
 * (armed volta a true) quando o valor DEPOIS cai abaixo do limiar de
 * descida, que e ESTRITAMENTE menor que o de subida. Um sinal que oscila em
 * torno do limiar de subida sem cair abaixo do de descida fica em silencio
 * apos o primeiro disparo, a rede que impede enxurrada de eventos.
 *
 * PRECEDENCIA: a checagem de rearme (armed=false E depois < limiar de
 * descida) e avaliada ANTES da checagem de disparo, porque um sinal so pode
 * rearmar e disparar de novo em ticks DIFERENTES, rearmar e disparar no
 * mesmo tick exigiria depois estar simultaneamente abaixo do limiar de
 * descida E acima do de subida, o que a propria definicao de histerese
 * (descida estritamente menor que subida) torna impossivel.
 */
export function classifyLaneCrossing(
  signal: LaneSignalKind,
  before: number,
  after: number,
  armed: boolean
): LaneCrossingOutcome {
  const { rise, fall } = THRESHOLDS_BY_SIGNAL[signal];

  // Rearme: o sinal caiu abaixo do limiar de descida, volta a ficar pronto
  // para disparar num cruzamento futuro. Nao dispara neste mesmo tick.
  if (!armed && after < fall) {
    return { crossing: "none", armed: true };
  }

  // Disparo: detector armado e o valor cruzou de baixo do limiar de subida
  // para no limiar ou acima, entre "antes" e "depois".
  if (armed && before < rise && after >= rise) {
    return { crossing: EVENT_BY_SIGNAL[signal], armed: false };
  }

  return { crossing: "none", armed };
}

// ---------------------------------------------------------------------------
// accrueLaneSignals, o acumulador que liga o classificador ao laco de tick
// (D-01, plano 26-07, Task 2)
// ---------------------------------------------------------------------------

/**
 * Janela de emissao do recheio narrativo: restrita a fase de 0 a 14 minutos
 * (840s), a mesma fronteira de bucket do plano 26-01 e a mesma constante que
 * classifyStructureCrossing (structures.ts) usa para restringir plates a
 * laning phase. Se a medicao do Task 3 mostrar que outra fase tambem ficou
 * abaixo do piso, a janela pode ser reavaliada la, com registro (nao aqui).
 */
const EARLY_GAME_WINDOW_SEC = TIMERS.MID_PHASE_AT;

/** Mapeia lane -> role do laner natural (mesma forma de laneToRole em structures.ts). */
function laneRoleFor(lane: Lane): "top" | "mid" | "adc" {
  if (lane === "top") return "top";
  if (lane === "mid") return "mid";
  return "adc";
}

/**
 * Escolhe entre variantes de texto pt-BR por um criterio deterministico
 * derivado do proprio valor do sinal (nunca sorteio), mesmo espirito de
 * `deathQuality.ts` (texto varia por contexto quantitativo, nao pelo gerador).
 */
function pickVariant(variants: readonly string[], seedValue: number): string {
  const index = Math.abs(Math.round(seedValue)) % variants.length;
  return variants[index];
}

const laneAdvantageTickers = (actor: string, team: string, place: string): string[] => [
  `${actor} consolida a vantagem ${place} e a ${team} nao da espaco para o adversario reagir.`,
  `${actor} segura a lane ${place} ha rodadas, e a vantagem da ${team} vira consistente.`,
];

const lanePriorityTickers = (actor: string, team: string, place: string): string[] => [
  `${actor} libera prioridade ${place}, e a ${team} ganha espaco para rotacionar o mapa.`,
  `Com prioridade solida ${place}, ${actor} abre a rota para o resto da ${team}.`,
];

const jungleAttentionTickers = (actor: string, team: string, place: string): string[] => [
  `O jungler da ${team} vira o mapa ${place}, e ${actor} sente a pressao extra.`,
  `${actor} passa a receber atencao constante do jungler da ${team} ${place}.`,
];

/**
 * Acumulador do recheio narrativo do early game: para cada lado e cada lane,
 * le o valor anterior guardado no bookkeeping (laneState.narrativeSignalState),
 * le o valor atual de cada um dos tres sinais, chama classifyLaneCrossing, e
 * quando ele devolve um evento, constroi o evento com `baseEvent` (o mesmo
 * construtor de evento base que os eventos estruturais usam) e atualiza o
 * bookkeeping em seguida.
 *
 * MESMA FORMA DE ASSINATURA que accrueSiegePressure (structures.ts): recebe
 * so o estado e devolve a lista de eventos daquele tick. NENHUMA escrita nos
 * sinais em si, o modulo LE laneLead, prioScore e jungleAttentionReceived e
 * nunca os altera; a unica escrita e no proprio campo de bookkeeping.
 *
 * NAO CONSOME O GERADOR: nem a leitura dos sinais, nem a classificacao, nem a
 * escolha de ator (laner da lane, ou o jungler como fallback quando o laner
 * esta morto), nem a escolha de variante de texto usam `rng`. A prova de
 * aridade (Task 2, obrigatoria) verifica que a contagem de chamadas ao
 * gerador em src/sim/ segue em 72 e que o numero de sorteios consumidos por
 * partida com semente fixa e identico ao de antes deste plano.
 */
export function accrueLaneSignals(state: MatchState): SimEvent[] {
  const out: SimEvent[] = [];

  // Restrito a janela do early game (D-01): o recheio existe para fechar o
  // piso de densidade de 0 a 14 minutos, nao para todo o jogo.
  if (state.gameTimeSec >= EARLY_GAME_WINDOW_SEC) return out;

  for (const side of ["user", "rival"] as Side[]) {
    const team = teamOf(state, side);

    for (const lane of LANES) {
      const ls = team.laneState[lane];
      const laner = team.players[laneRoleFor(lane)];
      const actorPlayer = laner.alive ? laner : team.players.jungle;
      const actorName = shortName(actorPlayer.card);
      const place = placeLabel(lane);

      // --- laneLead -> lane_advantage_building ---
      {
        const before = ls.narrativeSignalState.laneLead.lastValue;
        const after = ls.laneLead;
        const outcome = classifyLaneCrossing(
          "laneLead",
          before,
          after,
          ls.narrativeSignalState.laneLead.armed
        );
        ls.narrativeSignalState.laneLead = { armed: outcome.armed, lastValue: after };
        if (outcome.crossing === "lane_advantage_building") {
          out.push(
            baseEvent(state, "lane_advantage_building", side, {
              actors: [actorName],
              lane,
              ticker: pickVariant(laneAdvantageTickers(actorName, team.name, place), after),
            })
          );
        }
      }

      // --- prioScore -> lane_priority_shift ---
      {
        const before = ls.narrativeSignalState.prio.lastValue;
        const after = ls.prioScore;
        const outcome = classifyLaneCrossing(
          "prio",
          before,
          after,
          ls.narrativeSignalState.prio.armed
        );
        ls.narrativeSignalState.prio = { armed: outcome.armed, lastValue: after };
        if (outcome.crossing === "lane_priority_shift") {
          out.push(
            baseEvent(state, "lane_priority_shift", side, {
              actors: [actorName],
              lane,
              ticker: pickVariant(lanePriorityTickers(actorName, team.name, place), after),
            })
          );
        }
      }

      // --- jungleAttentionReceived -> jungler_attention_shift ---
      {
        const before = ls.narrativeSignalState.jungleAttention.lastValue;
        const after = ls.jungleAttentionReceived;
        const outcome = classifyLaneCrossing(
          "jungleAttention",
          before,
          after,
          ls.narrativeSignalState.jungleAttention.armed
        );
        ls.narrativeSignalState.jungleAttention = { armed: outcome.armed, lastValue: after };
        if (outcome.crossing === "jungler_attention_shift") {
          out.push(
            baseEvent(state, "jungler_attention_shift", side, {
              actors: [actorName],
              lane,
              ticker: pickVariant(jungleAttentionTickers(actorName, team.name, place), after * 100),
            })
          );
        }
      }
    }
  }

  return out;
}
