/**
 * src/sim/combat.ts
 *
 * Modulo de primitivas de combate cedo -- Fase 20 (FGT-01, FGT-02).
 *
 * Exporta tres simbolos publicos mais uma interface de contrato:
 *   - ACE_MIN_SEC          Constante: gate temporal de ace (D-04)
 *   - MultikillContext      Interface vazia de contrato (D-05)
 *   - multikillTimePlausibility  Teto de concentracao por killer (D-02)
 *   - maxCasualties         Teto total de baixas por tick (D-03)
 *
 * INVARIANTE INV-1: Nenhuma funcao deste modulo chama rng() ou Math.random.
 * Todas as funcoes sao PURAS, rng-free, derivadas exclusivamente de gameTimeSec.
 *
 * Ref: ENGINE-HARDENING-SPEC.md §60-61, FGT-01, FGT-02.
 */

// ---------------------------------------------------------------------------
// Constante exportada
// ---------------------------------------------------------------------------

/**
 * Tempo minimo (em segundos) para que um ace seja possivel.
 *
 * Gate temporal de ace (D-04): antes de 8min (480s) nenhum ace e emitido.
 * O engine.ts usa esta constante no callsite de makeAceEvent para suprimir
 * aces cedo sem suprimir os eventos de kill individuais que ja foram emitidos
 * por applyFightCasualties.
 *
 * Ref: ENGINE-HARDENING-SPEC.md §60, D-04, FGT-02 criterio 4.
 */
export const ACE_MIN_SEC = 480; // 8min

// ---------------------------------------------------------------------------
// Interface de contrato (D-05)
// ---------------------------------------------------------------------------

/**
 * Contexto de multikill passado a `multikillTimePlausibility`.
 *
 * Vazia nesta fase (D-05: curva indiferente ao chaosLevel).
 * Reservada para extensao futura (ex: modificadores por chaosLevel em fase de polish).
 */
export interface MultikillContext {
  // Vazio nesta fase.
  // Reservado para extensao futura.
}

// ---------------------------------------------------------------------------
// multikillTimePlausibility
// ---------------------------------------------------------------------------

/**
 * Teto de kills que UM unico killer pode concentrar numa teamfight, dado o
 * tempo de jogo.
 *
 * Retorna um inteiro em [2, 5] que representa o maximo de kills que um killer
 * pode acumular naquela janela de tempo. O engine.ts usa este valor para
 * redistribuir deterministicamente os kills excedentes para outros membros do
 * time sem novo draw de RNG (D-02, D-07).
 *
 * Degraus discretos (Claude's Discretion -- assuncao A2 do RESEARCH.md: degraus
 * sao mais simples de testar e calibrar que sigmoid neste contexto):
 *
 *   - gameTimeSec < 180  (< 3min):   teto 2 -- double raro; triple+ illegal
 *   - 180 <= t < 480    (3-8min):    teto 3 -- triple possivel; quadra/penta illegal
 *   - 480 <= t < 840    (8-14min):   teto 3 -- triple plausivel; quadra nearZero
 *   - 840 <= t < 1200   (14-20min):  teto 4 -- quadra rara mas possivel
 *   - 1200+ (>= 20min):              teto 5 -- penta plausivel
 *
 * Ancoras do spec (§60 / FGT-01 criterio 2):
 *   - quadra@90s:   retorna 2  (quadra illegal cedo)
 *   - triple@600s:  retorna >= 3 (triple plausivel)
 *   - penta@1320s:  retorna 5 (penta razoavel)
 *
 * Clamp defensivo: Math.max(2, Math.min(5, resultado)) garante sempre [2, 5].
 *
 * Funcao PURA: sem efeitos colaterais, sem mutacao de state, sem rng().
 *
 * @param killCount     Numero de kills que o killer ja acumulou + 1 (proximo kill).
 *                      Passado pelo engine.ts como killerCurrentCount + 1.
 *                      Na forma atual das bandas, so gameTimeSec determina o teto;
 *                      killCount esta na assinatura por D-02 para uso futuro.
 * @param gameTimeSec   Tempo de jogo em segundos no momento da teamfight.
 * @param _context      Contexto de multikill (vazio nesta fase, D-05).
 * @returns             Teto inteiro de kills por killer para esta janela de tempo.
 *
 * Ref: ENGINE-HARDENING-SPEC.md §60, D-02, D-05, FGT-01.
 */
export function multikillTimePlausibility(
  killCount: number,
  gameTimeSec: number,
  _context: MultikillContext
): number {
  // Suprimir aviso de parametro nao utilizado -- killCount esta na assinatura
  // por D-02; forma atual usa so gameTimeSec (bandas discretas).
  void killCount;

  let teto: number;

  if (gameTimeSec < 180) {
    // < 3min: double raro; triple+ illegal (spec §60, criterio 1)
    teto = 2;
  } else if (gameTimeSec < 480) {
    // 3-8min: triple possivel mas raro; quadra/penta illegal (FGT-01 criterio 1)
    teto = 3;
  } else if (gameTimeSec < 840) {
    // 8-14min: triple plausivel; quadra nearZero
    teto = 3;
  } else if (gameTimeSec < 1200) {
    // 14-20min: quadra rara mas possivel
    teto = 4;
  } else {
    // 20min+: penta plausivel (spec §60, criterio 2 ancora penta@1320s)
    teto = 5;
  }

  // Clamp defensivo (espelhando structures.ts :337-338, adaptado para inteiros)
  return Math.max(2, Math.min(5, teto));
}

// ---------------------------------------------------------------------------
// maxCasualties
// ---------------------------------------------------------------------------

/**
 * Teto total de baixas (mortes) num unico tick de teamfight, dado o tempo
 * de jogo.
 *
 * Retorna um inteiro em {2, 3, 5} que representa o maximo de mortes somadas
 * de ambos os lados num tick de combate. O engine.ts clampeia `loserDeaths` e
 * `winnerDeaths` por este valor em `resolveTeamfight` (D-03).
 *
 * Bandas discretas (D-04, spec §61; banda intermediaria acrescentada Fase 26 Plano 04):
 *   - gameTimeSec < 180   (< 3min):    teto 2 -- first blood / trade 1-1 / double raro
 *   - 180 <= t < 480      (3-8min):    teto 2 -- skirmish controlado (calibrado Plano 20-03)
 *   - 480 <= t < 1200     (8-20min):   teto 3 -- volume de combate reduzido (calibrado Fase 26 Plano 04)
 *   - 1200+               (>= 20min):  teto 5 -- teamfights completas liberadas
 *
 * Calibracao (Plano 20-03): teto 3 em 3-8min gerava triple rate ~9-10% e casualty medio ~2.1,
 * violando FGT-01 criterio 1 e FGT-02 criterio 4. Teto 2 satisfaz ambos os asserts duros.
 *
 * Calibracao (Fase 26 Plano 04): banda intermediaria 8-20min escolhida por varredura medida
 * contra o gate de ritmo completo (48 bandas, nao so abates/min), candidata C do BLOCO 3 de
 * `docs/diagnostics/26-sweep.md`, vencedora pela clausula 3 do criterio do BLOCO 1 (fracao de
 * abates ate 20:00 mais perto do alvo 0,39; empatou com a candidata B na clausula 2 dentro de
 * 0,02). A escolha NAO fecha `abates/min` (BLOCO 4 do mesmo documento: distancia de 0,396 ate o
 * alvo mesmo na candidata vencedora), e isso e reportado sem suavizar, nao escondido.
 *
 * Ancoras do spec (§61 / FGT-02 criterios 3 e 4, mais Fase 26 Plano 04):
 *   - maxCasualties(90)   === 2  (< 3min)
 *   - maxCasualties(300)  === 2  (3-8min, calibrado Plano 20-03)
 *   - maxCasualties(480)  === 3  (primeiro instante da banda intermediaria, 8min)
 *   - maxCasualties(1199) === 3  (ultimo instante da banda intermediaria, quase 20min)
 *   - maxCasualties(1200) === 5  (primeiro instante do teto final, 20min)
 *
 * Funcao PURA: sem efeitos colaterais, sem mutacao de state, sem rng().
 *
 * @param gameTimeSec   Tempo de jogo em segundos no momento da teamfight.
 * @returns             Teto inteiro de baixas totais no tick de combate.
 *
 * Ref: ENGINE-HARDENING-SPEC.md §61, D-03, D-04, FGT-02; docs/diagnostics/26-sweep.md BLOCO 3-4 (Fase 26 Plano 04).
 */
export function maxCasualties(gameTimeSec: number): number {
  if (gameTimeSec < 180) {
    // < 3min: first blood, trade 1-1, double raro (D-04)
    return 2;
  } else if (gameTimeSec < 480) {
    // 3-8min: skirmish; teto 2 garante casualty medio < 2 e triple <5% (FGT-02 criterio 3-4)
    // Calibrado: teto 3 gerava triple rate ~9-10% e casualty medio ~2.1; teto 2 satisfaz ambos.
    return 2;
  } else if (gameTimeSec < 1200) {
    // 8-20min: banda intermediaria, candidata C de docs/diagnostics/26-sweep.md BLOCO 2/3/4
    // (Fase 26 Plano 04). Reduz o volume de combate do meio-jogo sem tocar no teto de fim
    // de jogo; a candidata venceu A e B pela clausula 3 do criterio (fracao de abates ate
    // 20:00 mais perto do alvo).
    return 3;
  } else {
    // 20min+: teamfights completas liberadas; teto igual ao max de loserDeaths original
    return 5;
  }
}
