/**
 * src/sim/teamComp.ts
 *
 * Modulo puro de comp profile (COMP-01/02/03).
 *
 * Design:
 *  - Toda a camada e rng-free (DET-02). Nunca chama rng() nem Math.random.
 *  - Funcoes puras: dado o mesmo input, retorna sempre o mesmo output.
 *  - deriveCompProfile e chamada UMA vez no build (em freshTeamState).
 *  - compFightMult e chamada a cada tick em fightPower/securePower.
 *  - Contrato de identidade (INV-2): roster flat/ROLE_DEFAULTS => compProfile vazio => 1.0 exato.
 */

import type { Role, PlayerVersion } from "../data/schema";
import type { PlayerState, MatchState } from "./matchState";
import { ROLES } from "./matchState";
import { championMetaFor, ROLE_DEFAULTS } from "./championMeta";

// ---------------------------------------------------------------------------
// Utilitario local (padrao laneState.ts: autocontido, sem deps externas)
// ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// Tipos do vocabulario de comp (consome ChampionFunctionalTag sem recriar)
// ---------------------------------------------------------------------------

/**
 * Tag de comp derivada das functionalTags dos campeoes curados do draft (COMP-01).
 * Vocabulario identico a ChampionFunctionalTag de championMeta.ts.
 */
export type CompTag =
  | "teamfight"
  | "pick"
  | "poke"
  | "siege"
  | "split"
  | "dive"
  | "protect-carry"
  | "early-snowball"
  | "scaling"
  | "front-to-back"
  | "wombo"
  | "disengage"
  | "skirmish"
  | "objective-control"
  | "engage";

/**
 * Perfil de comp derivado uma vez no build (COMP-01).
 * Time-invariante: congelado via Object.freeze em freshTeamState.
 * INV-2: roster flat/ROLE_DEFAULTS => dominantTags vazio => multiplicadores 1.0 exato.
 */
export interface CompProfile {
  /** Top 1-3 tags dominantes, ordenadas por pontuacao decrescente. Vazio = neutro limpo. */
  dominantTags: CompTag[];
  /** Pontuacao normalizada [0,1] por tag (para o multiplicador saturante). */
  scores: Partial<Record<CompTag, number>>;
}

// ---------------------------------------------------------------------------
// Constantes exportadas — todas calibraveis via testes (padrao laneState.ts)
// ---------------------------------------------------------------------------

/**
 * Tabela de afinidade role x tag (D-02): a tag vale mais vinda do role certo.
 * Pesos calibraveis. Exportada para inspecao em testes.
 * [ASSUMED] — valores iniciais re-ancorados na economia FLAT (2500/time).
 */
export const ROLE_TAG_AFFINITY: Partial<
  Record<Role, Partial<Record<CompTag, number>>>
> = {
  top: { split: 1.4, "front-to-back": 0.8, dive: 1.0, engage: 0.9 },
  jungle: {
    "objective-control": 1.5,
    "early-snowball": 1.2,
    dive: 1.1,
    pick: 1.0,
    engage: 1.0,
  },
  mid: { pick: 1.3, poke: 1.2, teamfight: 1.0, wombo: 1.1, disengage: 0.9 },
  adc: {
    "front-to-back": 1.5,
    scaling: 1.4,
    siege: 1.2,
    teamfight: 1.0,
  },
  support: {
    "protect-carry": 1.6,
    engage: 1.4,
    disengage: 1.3,
    wombo: 1.1,
    poke: 1.0,
  },
};

/** Peso base quando o role nao tem afinidade especial com a tag (D-02). */
export const BASE_TAG_WEIGHT = 1.0;

/**
 * Limiar de dominancia: score normalizado minimo para uma tag virar identidade.
 * Re-ancorado na economia FLAT: roster 100% ROLE_DEFAULTS deve ficar abaixo deste valor.
 * [ASSUMED] — calibravel no Plano 05.
 * Exportado para que os testes possam afirmar a identidade em flat (INV-2).
 * COMP-01, D-01.
 */
export const DOMINANCE_THRESHOLD = 0.25;

/**
 * Clamp do canal primario de luta (fightPower).
 * [0.93, 1.07] = tilt sutil ~7% (D-04, mesma ordem de grandeza dos traits).
 * Exportado para que os testes de clamp usem a constante diretamente (COMP-03).
 */
export const COMP_FIGHT_CLAMP: [number, number] = [0.93, 1.07];

/**
 * Clamp do canal secundario de objetivo (securePower).
 * Mais estreito que COMP_FIGHT_CLAMP, analogo a goldSecureMult vs goldFightMult.
 * Exportado para inspecao em testes. COMP-03.
 */
export const COMP_SECURE_CLAMP: [number, number] = [0.95, 1.05];

/**
 * Boost por tag dominante no acumulo de m (COMP-03, D-04).
 * Multiplicado pelo score normalizado da tag.
 * [ASSUMED] — calibravel. Re-ancorado na economia FLAT.
 */
export const COMP_FIGHT_BOOST = 0.05;

// ---------------------------------------------------------------------------
// Counter-pairs canonicos (D-05): assimetricos, nunca matriz NxN
// ---------------------------------------------------------------------------

export type CounterPair = { wins: CompTag; loses: CompTag; bonus: number };

/**
 * 5 pares de counter canonicos (D-05).
 * So o time com a tag vencedora recebe o bonus — assimetria pura.
 * Exportado para que os testes afirmem o comprimento (3-5 pares).
 * [ASSUMED] — calibravel.
 */
export const COUNTER_PAIRS: CounterPair[] = [
  { wins: "dive", loses: "scaling", bonus: 0.04 }, // dive nao deixa escalar
  { wins: "dive", loses: "protect-carry", bonus: 0.03 }, // dive ignora peel passivo
  { wins: "poke", loses: "siege", bonus: 0.03 }, // poke desgasta antes do all-in
  { wins: "disengage", loses: "wombo", bonus: 0.04 }, // disengage anula engage em massa
  { wins: "pick", loses: "scaling", bonus: 0.03 }, // pick mata antes de escalar
];

// ---------------------------------------------------------------------------
// Normalizacao interna
// ---------------------------------------------------------------------------

/** Max score possivel com 5 campeoes e afinidade maxima (1.6 de protect-carry/support). */
const MAX_POSSIBLE_SCORE = 5 * 1.6;

// ---------------------------------------------------------------------------
// deriveCompProfile — COMP-01 (D-01/D-02/D-03)
// ---------------------------------------------------------------------------

/**
 * Deriva o perfil de comp de um time a partir das functionalTags dos campeoes curados.
 *
 * Funcao pura: mesma entrada => mesma saida. Nenhum rng()/Math.random. (DET-02)
 * INV-2: isRoleDefault(role) == true para todos => dominantTags vazio.
 * D-03: tags de ROLE_DEFAULTS excluidas (isRoleDefault predicate).
 * D-02: afinidade role-tag pondera a contribuicao de cada tag.
 * D-01: top 1-3 tags acima de DOMINANCE_THRESHOLD, ordenadas por score decrescente.
 *
 * COMP-01.
 *
 * @param players - Record de PlayerState por role (todos os 5 roles devem estar presentes).
 * @param isRoleDefault - Predicado: retorna true se o meta do role e ROLE_DEFAULTS (nao curado).
 */
export function deriveCompProfile(
  players: Record<Role, PlayerState>,
  isRoleDefault: (role: Role) => boolean
): CompProfile {
  const rawScores: Partial<Record<CompTag, number>> = {};

  for (const role of ROLES) {
    // D-03: campeao nao curado (ROLE_DEFAULTS) nao entra no perfil
    if (isRoleDefault(role)) continue;

    const meta = players[role].meta;
    for (const tag of meta.functionalTags) {
      const affinity =
        ROLE_TAG_AFFINITY[role]?.[tag as CompTag] ?? BASE_TAG_WEIGHT;
      const ct = tag as CompTag;
      rawScores[ct] = (rawScores[ct] ?? 0) + affinity;
    }
  }

  // Normalizar para [0,1] usando o maximo possivel (D-01)
  const normalized: Partial<Record<CompTag, number>> = {};
  for (const [tag, score] of Object.entries(rawScores) as [CompTag, number][]) {
    normalized[tag] = score / MAX_POSSIBLE_SCORE;
  }

  // D-01: top 1-3 tags acima do limiar, ordenadas por score decrescente
  const dominantTags = (
    Object.entries(normalized) as [CompTag, number][]
  )
    .filter(([, n]) => n >= DOMINANCE_THRESHOLD)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([tag]) => tag);

  return { dominantTags, scores: normalized };
}

// ---------------------------------------------------------------------------
// compFightMult — COMP-03 (D-04/D-05) canal primario
// ---------------------------------------------------------------------------

/**
 * Multiplicador de resolucao de luta derivado do compProfile (COMP-03).
 *
 * Identidade: se team.compProfile.dominantTags vazio => retorna 1.0 exato (INV-2, DET-03).
 * Acumula boost intrinseco por tag dominante (score * COMP_FIGHT_BOOST).
 * Aplica counter-pairs assimetricos (so o time com a tag vencedora recebe bonus) (D-05).
 * Clamp final em COMP_FIGHT_CLAMP = [0.93, 1.07] (tilt sutil ~7%, D-04).
 *
 * Rng-free (DET-02). COMP-03, INV-2.
 *
 * @param team - TeamState do time sendo avaliado.
 * @param enemy - TeamState do time inimigo.
 * @param _state - MatchState reservado para contexto futuro.
 */
export function compFightMult(
  team: { compProfile: CompProfile },
  enemy: { compProfile: CompProfile },
  _state: MatchState
): number {
  // Identidade em neutro: sem dominantTags = sem efeito = 1.0 (D-03, INV-2)
  if (team.compProfile.dominantTags.length === 0) return 1.0;

  let m = 1.0;

  // Counter-pairs assimetricos (D-05): vencedor recebe bonus; perdedor recebe penalidade.
  // O mecanismo principal e o matchup de comp — sem boost intrinseco absoluto.
  // Isso garante assimetria: ter comp forte nao da bonus contra quem te countera.
  for (const pair of COUNTER_PAIRS) {
    const teamHasWinner = team.compProfile.dominantTags.includes(pair.wins);
    const enemyHasLoser = enemy.compProfile.dominantTags.includes(pair.loses);
    const teamHasLoser = team.compProfile.dominantTags.includes(pair.loses);
    const enemyHasWinner = enemy.compProfile.dominantTags.includes(pair.wins);
    if (teamHasWinner && enemyHasLoser) {
      m += pair.bonus; // time vence o matchup de comp
    } else if (teamHasLoser && enemyHasWinner) {
      m -= pair.bonus; // time e counter-ed: penalidade simetrica ao bonus do inimigo
    }
  }

  return clamp(m, COMP_FIGHT_CLAMP[0], COMP_FIGHT_CLAMP[1]);
}

// ---------------------------------------------------------------------------
// compSecureMult — COMP-03 canal secundario (securePower)
// ---------------------------------------------------------------------------

/**
 * Multiplicador de seguranca de objetivo derivado do compProfile (COMP-03).
 *
 * Mesma forma que compFightMult, mas com clamp mais estreito COMP_SECURE_CLAMP = [0.95, 1.05].
 * Identidade: dominantTags vazio => 1.0 exato (INV-2).
 * Rng-free (DET-02). COMP-03.
 */
export function compSecureMult(
  team: { compProfile: CompProfile },
  enemy: { compProfile: CompProfile },
  _state: MatchState
): number {
  if (team.compProfile.dominantTags.length === 0) return 1.0;

  let m = 1.0;

  for (const pair of COUNTER_PAIRS) {
    const teamHasWinner = team.compProfile.dominantTags.includes(pair.wins);
    const enemyHasLoser = enemy.compProfile.dominantTags.includes(pair.loses);
    const teamHasLoser = team.compProfile.dominantTags.includes(pair.loses);
    const enemyHasWinner = enemy.compProfile.dominantTags.includes(pair.wins);
    if (teamHasWinner && enemyHasLoser) {
      m += pair.bonus;
    } else if (teamHasLoser && enemyHasWinner) {
      m -= pair.bonus;
    }
  }

  return clamp(m, COMP_SECURE_CLAMP[0], COMP_SECURE_CLAMP[1]);
}

// ---------------------------------------------------------------------------
// labelCompProfile — rotulo pt-BR (D-06, Padrao 6 da RESEARCH)
// ---------------------------------------------------------------------------

/** Lookup de rotulo pt-BR por tag dominante. O(1) por entrada. */
const COMP_LABEL_PT_BR: Partial<Record<CompTag, string>> = {
  "teamfight": "Luta em Equipe",
  "pick": "Cacar Isolados",
  "poke": "Poke e Cerco",
  "siege": "Cerco de Torres",
  "split": "Split Push",
  "dive": "Dive e Derruba",
  "protect-carry": "Protege o Carry",
  "early-snowball": "Bola de Neve Cedo",
  "scaling": "Escalar e Virar",
  "front-to-back": "Carrinho Forte",
  "wombo": "Wombo Combo",
  "disengage": "Recua e Puna",
  "skirmish": "Escaramuca",
  "objective-control": "Controle de Objetivos",
  "engage": "Engaja e Destroca",
};

/**
 * Retorna o rotulo pt-BR da comp derivado da tag mais dominante.
 * dominantTags vazio => string vazia (comp neutra).
 * O(k) onde k = dominantTags.length. Rng-free. COMP-03, D-06.
 */
export function labelCompProfile(profile: CompProfile): string {
  if (profile.dominantTags.length === 0) return "";
  return COMP_LABEL_PT_BR[profile.dominantTags[0]] ?? "";
}

// ---------------------------------------------------------------------------
// applyCompIntentBiases — COMP-02 (esqueleto para consumo no Plano 03)
// ---------------------------------------------------------------------------

// [25C-03 Task 2] Este arquivo tinha uma COPIA da uniao MacroIntent, e a copia era
// o buraco: quando as duas intencoes sem resolvedor sairam da uniao de engine.ts,
// `npx tsc --noEmit` ficou LIMPO, medido, porque o mapa de vieses abaixo tipava
// contra a copia local e nao contra a fonte. O compilador so encontra o SITIO 2
// quando ele le a mesma uniao que o resolvedor le. Import de TIPO (apagado na
// compilacao, sem ciclo em tempo de execucao), pelo mesmo motivo que a uniao passou
// a nascer de um array constante: enumeracao e tipo com fonte unica (T-25C-17).
import type { MacroIntent } from "./engine";

// ---------------------------------------------------------------------------
// labelCompProfileFromChampions — helper puro para o pos-draft (D-06)
// ---------------------------------------------------------------------------

/**
 * Resolve o rotulo pt-BR de comp a partir do roster de um time e dos champions
 * atribuidos (pos-draft). Fonte unica do rotulo no ChampionSelect (D-06).
 *
 * Funcao pura: sem rng()/Math.random. Rng-free (DET-02). COMP-01, D-03, D-06.
 * INV-2: roster sem champions curados (ou ids desconhecidos) => ROLE_DEFAULTS
 *        => dominantTags vazio => retorna string vazia.
 *
 * @param roster  - Array de PlayerVersion do time (5 roles).
 * @param champions - Mapa de card.id para championId atribuido pelo draft.
 * @returns Rotulo pt-BR da tag mais dominante, ou "" se comp neutra.
 */
export function labelCompProfileFromChampions(
  roster: PlayerVersion[],
  champions: Record<string, string>
): string {
  // Montar um Record<Role, { meta }> minimo para deriveCompProfile.
  // Usa apenas { meta } pois deriveCompProfile so acessa players[role].meta.
  const players = {} as Record<Role, Pick<PlayerState, "meta">>;
  for (const card of roster) {
    const meta = championMetaFor(champions[card.id], card.primaryRole);
    players[card.primaryRole] = { meta } as PlayerState;
  }

  // Preencher roles ausentes do roster com ROLE_DEFAULTS (seguranca)
  for (const role of ROLES) {
    if (!players[role]) {
      players[role] = { meta: ROLE_DEFAULTS[role] } as PlayerState;
    }
  }

  const profile = deriveCompProfile(
    players as Record<Role, PlayerState>,
    (role) => players[role].meta === ROLE_DEFAULTS[role]
  );

  return labelCompProfile(profile);
}

/**
 * [25C-03 Task 2] SITIO 2 do caminho morto, e o mais perigoso dos dois.
 *
 * A expressao que consome este mapa (`weights[intent] = (weights[intent] ?? 0) + ...`)
 * **CRIA a chave** quando ela nao existe, em vez de multiplicar peso ja presente.
 * Ou seja este mapa dava peso a `cross_map` (em tres tags: split, pick e disengage)
 * e a `defend_base` (em disengage) mesmo depois de a camada de decisao parar de
 * adiciona-las, e reabria o caminho morto sozinho.
 *
 * **A FIXTURE DOS HARNESSES DE CALIBRACAO TEM PERFIL DE COMP VAZIO** (roster flat,
 * `dominantTags` vazio, INV-2), entao o laco abaixo nao itera nenhuma vez ali: este
 * sitio NUNCA aparece na medicao e aparece exatamente no app que o usuario assiste,
 * com campeoes atribuidos. Consertar so o sitio 1 fecharia o criterio no harness e
 * deixaria o defeito vivo no playback. E por isso que os dois sitios entram no
 * MESMO commit (T-25C-15).
 *
 * A tag `disengage` perdeu as DUAS intencoes que ela aplicava e por isso saiu do
 * mapa: ela passa a nao inclinar intencao nenhuma, e o `continue` do laco cobre
 * esse caso sem ramo novo.
 *
 * Hoisted para o escopo do modulo e exportado para que o teste de caminho morto
 * assere sobre O MESMO objeto que a funcao usa, e nao sobre uma copia.
 *
 * [ASSUMED]: magnitudes dentro de D-04 (tilt ~3-8%); re-ancorar via calibracao
 */
export const COMP_INTENT_BIASES: Partial<
  Record<CompTag, Partial<Record<MacroIntent, number>>>
> = {
  dive: { force_fight: 0.6, setup_baron: 0.3 },
  engage: { force_fight: 0.5, setup_dragon: 0.3 },
  wombo: { force_fight: 0.7, setup_elder: 0.4 },
  poke: { press_mid: 0.4, setup_dragon: 0.3 },
  siege: { press_mid: 0.3, press_bot: 0.3, siege_baron: 0.4 },
  split: { press_top: 0.6, split_push: 0.7 },
  pick: { pickoff: 0.6 },
  scaling: { farm: 0.5 },
  "front-to-back": { force_fight: 0.4 },
  "protect-carry": { setup_baron: 0.3, setup_dragon: 0.3 },
  "objective-control": { setup_dragon: 0.5, setup_baron: 0.4 },
  "early-snowball": { force_fight: 0.4, gank: 0.5 },
};

/**
 * Aplica vieses de intencao ao objeto de pesos de chooseIntent com base no compProfile.
 * Mutacao direta de weights — sem novo draw de rng() (COMP-02).
 * Escala o bias pelo score normalizado da tag para tags mais dominantes inclinarem mais.
 * Rng-free (DET-02). COMP-02.
 *
 * @param weights - Mapa de pesos de intencao a ser mutado in-place.
 * @param profile - CompProfile derivado do draft.
 */
export function applyCompIntentBiases(
  weights: Record<string, number>,
  profile: CompProfile
): void {
  for (const tag of profile.dominantTags) {
    const tagBiases = COMP_INTENT_BIASES[tag];
    if (!tagBiases) continue;
    const score = profile.scores[tag] ?? 0;
    // Escalar pelo score normalizado: [0.5, 1.0] — nunca zero
    const scale = 0.5 + score * 0.5;
    for (const [intent, w] of Object.entries(tagBiases) as [MacroIntent, number][]) {
      weights[intent] = (weights[intent] ?? 0) + w * scale;
    }
  }
}
