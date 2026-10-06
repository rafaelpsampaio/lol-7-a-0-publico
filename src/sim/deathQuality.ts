/**
 * src/sim/deathQuality.ts
 *
 * Modulo puro de qualidade de morte e ticker contextual (EVT-03, EVT-01/02 — Phase 12).
 *
 * Design:
 *  - Completamente rng-free (DET-02). Nunca chama rng() nem Math.random.
 *  - computeDeathQuality chamado APOS todos os rng() de applyKill (padrao
 *    updateLaneState — engine.ts:1091-1098).
 *  - deathQuality NUNCA exposto na UI (D-03). Campo interno de runtime.
 *  - selectContextualTicker retorna string pt-BR ou null (null = generico prevalece, D-05).
 *  - Thresholds good>=200 / bad<=-150 sao priors FLAT [ASSUMED] (12-RESEARCH.md secao 4, A6).
 */

import type { MatchState, PlayerState, Side } from "./matchState";
import { ROLES } from "./matchState";
import type { EventKind } from "./simEvents";
import type { Role } from "../data/schema";
import { shortName } from "./ticker";

// ---------------------------------------------------------------------------
// Interface publica
// ---------------------------------------------------------------------------

/**
 * Contexto de uma morte para classificacao de qualidade (EVT-03).
 * Todos os campos sao derivados no momento do evento — sem rng.
 */
export interface DeathContext {
  killerSide: Side;
  victim: PlayerState;
  killer: PlayerState;
  state: MatchState;
  eventType: EventKind;
  /** Kills do time do victim APOS esta morte (troca: time aproveitou o engage). */
  teamKillsAfter: number;
  /** Ouro equivalente de objetivos convertidos pelo time do victim APOS a morte. */
  teamObjectiveAfter: number;
  /** Bounty entregue ao inimigo (shutdown gold da vitima). */
  allyGoldGiven: number;
  /** O engage abriu fight que preservou o carry principal do time. */
  savedCarry: boolean;
}

// ---------------------------------------------------------------------------
// Funcoes privadas
// ---------------------------------------------------------------------------

/**
 * Detecta se o jogador funciona como engage initiator.
 * Verifica functionalTag "engage" OU primaryClass em {engage-support, diver, tank}.
 * WR-04: exportado para ser a fonte unica do proxy savedCarry em engine.ts
 * (antes o engine re-listava as classes e omitia tank, divergindo deste predicado).
 */
export function isEngageInitiator(p: PlayerState): boolean {
  return (
    p.meta.functionalTags.includes("engage") ||
    p.meta.primaryClass === "engage-support" ||
    p.meta.primaryClass === "diver" ||
    p.meta.primaryClass === "tank"
  );
}

/**
 * Estima a perda de mapa ao morrer (proxy simples por role).
 * Suporte morto = 50 (perde vision); carry morto = 150 (perde wave + pressure).
 * Calibrado na economia flat (pesquisa2.md — waveLossGold + towerPressureLost + visionLoss).
 *
 * ECO-04: nenhuma mudanca aqui. Estes retornos ja sao unidade base (nao ouro escalado) e
 * sao somados a um score inteiramente em unidade base depois da conversao em computeDeathQuality;
 * este comentario existe para que a proxima leitura nao trate esta funcao como ponto esquecido.
 */
function estimateMapLoss(ctx: DeathContext): number {
  if (ctx.victim.role === "support") return 50;
  if (ctx.victim.role === "adc" || ctx.victim.role === "mid") return 150;
  if (ctx.victim.role === "jungle") return 100;
  return 80; // top / outros
}

// ---------------------------------------------------------------------------
// computeDeathQuality
// ---------------------------------------------------------------------------

/**
 * Classifica a qualidade de uma morte como "good", "neutral" ou "bad".
 *
 * Formula: score = objectiveGain + tradeValue + carrySaved - bountyLost - mapLoss
 * Thresholds FLAT [ASSUMED] (12-RESEARCH.md secao 4, A6):
 *   good  >= 200
 *   bad   <= -150
 *   senao: neutral
 *
 * Override engage-support (regra de 3 condicoes, pesquisa2.md linha ~269):
 * Se o initiator morre e o time converte => marcar como "good" direto, sem score.
 *
 * DET-02: sem rng, sem Math.random. Mesma entrada => mesma saida.
 * D-03: retorno silencioso — NUNCA exposto na UI.
 */
export function computeDeathQuality(ctx: DeathContext): "good" | "neutral" | "bad" {
  // Ouro real desde a spec 2026-10-02: abate vale 300, a mesma escala em que os
  // limiares abaixo foram escritos, entao estas entradas passam direto.
  const teamObjectiveAfterBase = ctx.teamObjectiveAfter;
  const allyGoldGivenBase = ctx.allyGoldGiven;
  const shutdownGoldBase = ctx.victim.shutdownGold;

  // Regras de override do engage support (3 condicoes independentes):
  if (isEngageInitiator(ctx.victim) && ctx.teamKillsAfter >= 2) return "good";
  if (isEngageInitiator(ctx.victim) && teamObjectiveAfterBase >= 150) return "good";
  if (isEngageInitiator(ctx.victim) && ctx.savedCarry) return "good";

  // Formula de score (economia em ouro real, kill=300g, carry bounty 0-700g, o teto de pagamento):
  const objectiveGain = teamObjectiveAfterBase;
  const tradeValue    = ctx.teamKillsAfter * 300 - allyGoldGivenBase;
  const carrySaved    = ctx.savedCarry ? 200 : 0;
  const bountyLost    = shutdownGoldBase; // 0..700 (BOUNTY_PAYOUT_CAP em economy.ts)
  const mapLoss       = estimateMapLoss(ctx);    // 50..150 por role

  const score = objectiveGain + tradeValue + carrySaved - bountyLost - mapLoss;

  // Thresholds FLAT [ASSUMED] (12-RESEARCH.md secao 4, A6 — reduzidos de pro-scaled 250/-200):
  if (score >= 200) return "good";
  if (score <= -150) return "bad";
  return "neutral";
}

// ---------------------------------------------------------------------------
// computeEventWeight (D-02, Fase 26 plano 26-09)
// ---------------------------------------------------------------------------

/**
 * Os tres niveis de PESO de um abate: quanto ele importou para o resultado da
 * partida. Dimensao NOVA e ORTOGONAL a computeDeathQuality (que classifica se a
 * morte foi boa ou ruim para quem morreu, nunca quanto ela pesou na partida).
 */
export type EventWeight = "virada" | "decisivo" | "rotina";

/**
 * Limiar de variacao ABSOLUTA de winProbUser (escala 0..1, perspectiva do lado
 * user) que classifica um abate como "decisivo" quando ele NAO cruza a linha de
 * 50% (esse caso e "virada", classe propria e mais especifica).
 *
 * ESCALA, ESTIMATIVA INICIAL [ASSUMED] do Task 1: a inclinacao maxima do sigmoide
 * de computeWinProbability (winprob.ts) e 0,25 (derivada em x=0), e o peso de
 * aliveEdge (WINPROB_WEIGHTS.aliveEdge = 0,2) e o unico termo que um abate comum
 * move sozinho, dando um teto teorico de 0,25 * 0,2 = 0,05.
 *
 * VALOR FINAL, CONFIRMADO POR MEDICAO (Task 3, BLOCO 14 de docs/diagnostics/26-sweep.md):
 * 0,1. A estimativa inicial de 0,05 SUBESTIMAVA o teto real: o abate tambem pode
 * derrubar hasBaronBuff/hasElderBuff da vitima (baronHolderDiff/elderHolderDiff,
 * pesos 0,08/0,18), somando ao termo de aliveEdge e alcancando deltas medidos acima
 * de 0,05 numa fracao real dos abates. A medicao de controle (delta elevado ate o
 * ponto de nunca disparar) mostra que o gatilho por delta fica praticamente
 * ESGOTADO em 0,1 (decisivo cai de 70,0% em 0,05 para 49,1% em 0,1 e so mais
 * 0,1 ponto percentual ao subir ate 1,0), ou seja 0,1 ja captura essencialmente
 * todo o efeito que o delta pode produzir isoladamente nesta populacao.
 *
 * ACHADO REGISTRADO (Task 3, nao resolvido por este limiar): mesmo em 0,1, o
 * criterio de sanidade "rotina e maioria dos abates" NAO fecha (rotina mede 31,3%
 * contra decisivo+virada 68,7%), porque o piso de "decisivo" e dominado por dois
 * gatilhos INCONDICIONAIS do proprio texto do Task 1 (bounty de sequencia
 * acumulada e primeiro sangue), nao pelo delta. Nenhum valor deste limiar numerico
 * fecha aquele criterio: e fronteira de DESENHO (os gatilhos OR incondicionais),
 * nao de calibracao. Ver BLOCO 14 para a leitura completa e as duas medicoes.
 */
export const DECISIVE_WIN_PROB_DELTA = 0.1;

/**
 * Entrada pura de computeEventWeight: as duas leituras de probabilidade de vitoria
 * (mesma funcao computeWinProbability, chamada duas vezes, sem copia de formula) e
 * os dois sinais booleanos que tambem classificam um abate como "decisivo".
 */
export interface EventWeightContext {
  /** winProbUser (perspectiva do lado user, 0..1) ANTES das mutacoes do abate. */
  winProbBeforeUser: number;
  /** winProbUser (mesma escala) DEPOIS de todas as mutacoes do abate, no mesmo
   *  ponto em que computeDeathQuality/selectContextualTicker ja sao chamados. */
  winProbAfterUser: number;
  /** O abate foi o primeiro sangue da partida. */
  isFirstBlood: boolean;
  /** O abate carregava recompensa de sequencia acumulada (bounty de shutdown da
   *  vitima, capturado ANTES do reset em applyKill). */
  hadShutdownBounty: boolean;
}

/**
 * Classifica o PESO de um abate (D-02, EVT-04). Pura, deterministica, sem rng e
 * sem leitura de estado global: toda a entrada chega pelo parametro.
 *
 * virada: winProbUser cruza a linha de 50% entre o antes e o depois, ou seja o
 *   favorito da partida troca de lado neste abate. Classe mais especifica e
 *   reconhecivel: e literalmente o abate que virou o jogo.
 * decisivo (sem cruzar a linha): a variacao absoluta atinge DECISIVE_WIN_PROB_DELTA,
 *   OU o abate carregava bounty de sequencia acumulada, OU foi o primeiro sangue.
 * rotina: os demais, a maioria dos abates.
 *
 * NAO substitui computeDeathQuality: as duas coexistem e sao ortogonais (uma morte
 * "good" pode ter qualquer um dos tres pesos).
 */
export function computeEventWeight(ctx: EventWeightContext): EventWeight {
  const { winProbBeforeUser, winProbAfterUser, isFirstBlood, hadShutdownBounty } = ctx;

  const favoriteBefore = winProbBeforeUser >= 0.5 ? "user" : "rival";
  const favoriteAfter = winProbAfterUser >= 0.5 ? "user" : "rival";
  if (favoriteBefore !== favoriteAfter) return "virada";

  const delta = Math.abs(winProbAfterUser - winProbBeforeUser);
  if (delta >= DECISIVE_WIN_PROB_DELTA || hadShutdownBounty || isFirstBlood) return "decisivo";

  return "rotina";
}

// ---------------------------------------------------------------------------
// contextualTickerMustIncludePlayerName
// ---------------------------------------------------------------------------

/**
 * Gate de emissao de ticker contextual (D-04, TKR-02).
 *
 * Retorna `null` quando o card do protagonista nao tem displayName conhecido
 * (vazio ou undefined), impedindo que um placeholder de role generica passe
 * pelo canal contextual. Quando ha nome, retorna o proprio ticker inalterado.
 *
 * Uso: envolver cada return de selectContextualTicker com esta funcao.
 * Null -> engine cai para fallback `ctxTicker ?? ticker` ja existente (sem
 * alteracao em engine.ts).
 *
 * DET-02: funcao pura, sem rng, sem Math.random.
 */
export function contextualTickerMustIncludePlayerName(
  ticker: string,
  card: { displayName?: string }
): string | null {
  if (!card.displayName) return null;
  return ticker;
}

// ---------------------------------------------------------------------------
// Variantes de texto por nivel de peso (D-02, Fase 26 plano 26-09, Task 2)
// ---------------------------------------------------------------------------

/**
 * REGRA DE ESCOLHA DENTRO DO NIVEL, escrita por exigencia do Task 2: a escolha
 * entre as variantes de um mesmo nivel de peso e deterministica e derivada do
 * papel do ABATEDOR (killer.role), nunca de sorteio. O indice e a posicao do
 * papel em ROLES (ordem fixa top/jungle/mid/adc/support), modulo o numero de
 * variantes daquele nivel, de forma que papeis diferentes tendem a mostrar
 * frases diferentes do mesmo nivel sem qualquer consumo do gerador.
 */
function pickWeightVariant<T>(variants: readonly T[], killerRole: Role): T {
  const idx = ROLES.indexOf(killerRole);
  return variants[(idx < 0 ? 0 : idx) % variants.length];
}

/**
 * Variantes de nivel "virada" (pelo menos duas, Task 2): dizem explicitamente que
 * a partida MUDOU DE LADO, sem numero de probabilidade no texto (o ticker e
 * narrativo, nao painel). Protagonista = KILLER (quem fez o abate que virou).
 */
const VIRADA_TICKERS: ReadonlyArray<(nome: string) => string> = [
  (nome) => `${nome}: o abate vira o favorito da partida.`,
  (nome) => `${nome}: com essa troca, o jogo muda de mao.`,
];

/**
 * Variantes de nivel "decisivo" (pelo menos tres, Task 2): comunicam consequencia
 * (abrir o mapa, cobrar recompensa acumulada ou decidir a troca de uma rota), sem
 * repetir o texto de "virada". Protagonista = KILLER (quem fez o abate decisivo).
 */
const DECISIVE_TICKERS: ReadonlyArray<(nome: string) => string> = [
  (nome) => `${nome}: abate decisivo, o mapa se abre para o time.`,
  (nome) => `${nome}: cobra a recompensa acumulada com um abate que pesa na partida.`,
  (nome) => `${nome}: decide a troca de rota com esse abate.`,
];

// ---------------------------------------------------------------------------
// selectContextualTicker
// ---------------------------------------------------------------------------

/**
 * Seleciona um ticker contextual pt-BR para o evento de morte.
 *
 * Retorna string pt-BR quando uma regra bate, ou `null` quando nenhuma bate
 * (nesse caso o ticker generico existente prevalece, D-05).
 *
 * Tom (D-04): broadcast serio para tatico; zoeiro para vacilo.
 * Regra: NENHUM ticker contem o caractere travessao (D-04 / writing-style).
 *
 * Prioridade (primeiro match ganha), com o nivel de PESO decidindo primeiro
 * (D-02, Fase 26 plano 26-09, Task 2: o peso e sinal mais saliente que a
 * narrativa fina de precondicao, entao ele substitui por completo as
 * prioridades 1/2 abaixo quando o abate NAO e "rotina"):
 *   0. Derivados do PESO do evento (computeEventWeight):
 *      - weight="virada" => uma das VIRADA_TICKERS (>= 2 variantes)
 *      - weight="decisivo" => uma das DECISIVE_TICKERS (>= 3 variantes)
 *      - weight="rotina" => cai para as prioridades 1/2 abaixo, SEM reescrita
 *        (regra do Task 2: as frases que ja existem continuam sendo o caminho)
 *   1. Derivados de dq (mais especificos, baseados em computeDeathQuality):
 *      - good + suporte => ctx_support_engage_decisive
 *      - bad + adc + sem flash => ctx_adc_caught_no_flash
 *   2. Derivados de estado (laneState / comp / arquetipo):
 *      - top weakside + dive => ctx_top_dive_weakside
 *      - bot venceu 2v2 => ctx_bot_won_2v2
 *      - enchanter salvou carry => ctx_enchanter_saved_carry
 *      - adc limpou fight => ctx_adc_cleaned_fight
 *      - scaling sobreviveu early => ctx_scaling_survived_early
 *      - suporte pego wardando => ctx_support_died_warding
 *
 * neutral/rotina sem pre-condicao adicional => null (D-05: ticker generico prevalece).
 *
 * DET-02: sem rng, sem Math.random. Pura e deterministica.
 * Pitfall 6: limiares ESTRITOS — pre-condicoes nunca incluem estado neutro (0).
 */
export function selectContextualTicker(
  dq: "good" | "neutral" | "bad",
  weight: EventWeight,
  ctx: DeathContext
): string | null {
  // Prioridade 0: o PESO do evento decide primeiro (Task 2). "rotina" cai para
  // baixo, sem reescrita nenhuma do caminho que ja existia.
  if (weight === "virada") {
    const nome = shortName(ctx.killer.card);
    const texto = pickWeightVariant(VIRADA_TICKERS, ctx.killer.role)(nome);
    return contextualTickerMustIncludePlayerName(texto, ctx.killer.card);
  }
  if (weight === "decisivo") {
    const nome = shortName(ctx.killer.card);
    const texto = pickWeightVariant(DECISIVE_TICKERS, ctx.killer.role)(nome);
    return contextualTickerMustIncludePlayerName(texto, ctx.killer.card);
  }

  const { victim, killer, state } = ctx;

  // Time da vitima (oposto do killer side)
  const victimSide = ctx.killerSide === "user" ? "rival" : "user";
  const laneState  = state[victimSide].laneState;
  // WR-02: tickers killer-centric (bot_won_2v2 / adc_cleaned_fight) precisam da lane
  // do time do KILLER. laneLead > 0 = "este time esta na frente na rota"; lendo o lado
  // do victim a condicao disparava invertida (quando o time do victim estava a frente).
  const killerLaneState = state[ctx.killerSide].laneState;

  const compUser  = state.user.compProfile;
  const compRival = state.rival.compProfile;

  // Comp do time da vitima (para scaling check):
  const victimTeamComp = ctx.killerSide === "user" ? compRival : compUser;

  // --------------------------------------------------------------------------
  // Prioridade 1: derivados de dq (mais especificos)
  // --------------------------------------------------------------------------

  // ctx_support_engage_decisive: suporte morre com dq=good => engage foi decisivo
  // Pre-condicao: dq=good AND victim e suporte (engage-support ou role=support)
  // Nota: usa role=support como deteccao por compatibilidade com flat fixtures
  // (ROLE_DEFAULTS.support nao tem tag "engage" — test comment 12-01-SUMMARY).
  // Protagonista = VITIMA (suporte que engagou), D-05.
  if (
    dq === "good" &&
    (victim.role === "support" || isEngageInitiator(victim))
  ) {
    const nome = shortName(victim.card);
    return contextualTickerMustIncludePlayerName(
      `${nome}: suporte encontra o angulo, forca a luta e o time converte.`,
      victim.card
    );
  }

  // ctx_adc_caught_no_flash: ADC sem flash morto com dq=bad => vacilo puro
  // Pre-condicao: dq=bad AND victim.role=adc AND flashUp=false
  // Protagonista = VITIMA (ADC pego), D-05.
  if (dq === "bad" && victim.role === "adc" && !victim.flashUp) {
    const nome = shortName(victim.card);
    return contextualTickerMustIncludePlayerName(
      `${nome}: ADC e achado sem Flash e cai antes da briga comecar.`,
      victim.card
    );
  }

  // --------------------------------------------------------------------------
  // Prioridade 2: derivados de estado
  // Pitfall 6: limiares ESTRITOS (> 0, nao >= 0; < 0, nao <= 0)
  // --------------------------------------------------------------------------

  // ctx_top_dive_weakside: top tomou dive estando em weakside
  // Pre-condicao: victim.role=top AND laneState.top.weaksideState.active AND eventType=dive
  // Protagonista = VITIMA (top que tomou dive), D-05.
  if (
    victim.role === "top" &&
    laneState.top.weaksideState.active &&
    ctx.eventType === "dive"
  ) {
    const nome = shortName(victim.card);
    return contextualTickerMustIncludePlayerName(
      `${nome}: top toma dive no weakside enquanto o time joga do outro lado.`,
      victim.card
    );
  }

  // ctx_bot_won_2v2: bot venceu duelo com vantagem de lane
  // Pre-condicao: killer.role=adc ou support AND laneState.bot.laneLead > 0 (ESTRITO)
  // E eventType kill/gank (bot dominancia confirmada)
  // Protagonista = KILLER (quem venceu o duelo), D-05.
  if (
    (killer.role === "adc" || killer.role === "support") &&
    killerLaneState.bot.laneLead > 0 &&
    (ctx.eventType === "kill" || ctx.eventType === "gank")
  ) {
    const nome = shortName(killer.card);
    return contextualTickerMustIncludePlayerName(
      `${nome}: bot vence o duelo 2v2 e assume o controle da rota.`,
      killer.card
    );
  }

  // ctx_enchanter_saved_carry: enchanter salvou o carry (victim e enchanter)
  // Pre-condicao: victim.meta.primaryClass=enchanter AND compProfile.dominantTags inclui protect-carry
  //   AND savedCarry=true (enchanter se sacrificou para salvar)
  // Protagonista = VITIMA (enchanter que se sacrificou), D-05.
  if (
    victim.meta.primaryClass === "enchanter" &&
    victimTeamComp.dominantTags.includes("protect-carry") &&
    ctx.savedCarry
  ) {
    const nome = shortName(victim.card);
    return contextualTickerMustIncludePlayerName(
      `${nome}: enchanter mantem o carry vivo no limite e muda a briga.`,
      victim.card
    );
  }

  // ctx_adc_cleaned_fight: ADC killer limpou a luta com vantagem de bot
  // Pre-condicao: killer.role=adc AND teamKillsAfter >= 2 (multikill) AND laneState.bot.laneLead > 0
  // Protagonista = KILLER (ADC que limpou), D-05.
  if (
    killer.role === "adc" &&
    ctx.teamKillsAfter >= 2 &&
    killerLaneState.bot.laneLead > 0
  ) {
    const nome = shortName(killer.card);
    return contextualTickerMustIncludePlayerName(
      `${nome}: ADC encontra espaco, limpa a luta e decide o fight.`,
      killer.card
    );
  }

  // ctx_scaling_survived_early: comp de scaling atravessou o early sem quebrar
  // Pre-condicao: victimTeamComp.dominantTags.includes("scaling")
  //   AND teamKillsAfter < 3 AND gameTimeSec < 900 AND goldDelta > -2200 (ESTRITO)
  const gameTimeSec = state.gameTimeSec;
  // goldDelta: ouro do time da vitima minus inimigo (positivo = vitima na frente).
  // Diferenca de ouro de TIME em ouro real: o limiar antigo (-800 na economia de antes) vira -2200 (x 2,75).
  const goldDelta = state.user.gold - state.rival.gold;
  const victimTeamGoldDelta = victimSide === "user" ? goldDelta : -goldDelta;

  // ctx_scaling_survived_early: sem protagonista individual claro; usar VITIMA como
  // protagonista nominal (card disponivel no contexto), D-05.
  if (
    victimTeamComp.dominantTags.includes("scaling") &&
    ctx.teamKillsAfter < 3 &&
    gameTimeSec < 900 &&
    victimTeamGoldDelta > -2200
  ) {
    const nome = shortName(victim.card);
    return contextualTickerMustIncludePlayerName(
      `${nome}: a composicao de scaling atravessa o early sem quebrar a estrutura.`,
      victim.card
    );
  }

  // ctx_support_died_warding: suporte pego estabelecendo visao
  // Pre-condicao: victim.role=support AND dq != bad (nao foi vacilo) AND prioScore < 0 (ESTRITO)
  // prioScore < 0 => time do victim estava sem prio (contestando visao em desvantagem)
  // Protagonista = VITIMA (suporte pego), D-05.
  const victimLane = victim.role === "support" ? "bot"
    : victim.role === "top" ? "top"
    : victim.role === "mid" ? "mid"
    : "bot";

  if (
    victim.role === "support" &&
    dq !== "bad" &&
    laneState[victimLane].prioScore < 0
  ) {
    const nome = shortName(victim.card);
    return contextualTickerMustIncludePlayerName(
      `${nome}: suporte e pego tentando estabelecer visao na lateral.`,
      victim.card
    );
  }

  // --------------------------------------------------------------------------
  // Nenhuma pre-condicao bateu: ticker generico prevalece (D-05)
  // --------------------------------------------------------------------------
  return null;
}
