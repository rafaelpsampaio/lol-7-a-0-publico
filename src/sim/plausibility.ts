/**
 * src/sim/plausibility.ts
 *
 * Taxonomia de plausibilidade de eventos da engine (ENG-02, Fase 16).
 *
 * Exporta o tipo PlausibilityClass e a tabela PLAUSIBILITY_EXAMPLES com
 * exemplos canonicos classificando cada evento observado na sua classe-alvo.
 *
 * IMPORTANTE: modulo de dados puros - sem funcoes de classificacao em runtime (D-11),
 * sem enforcement de runtime (D-12). As Fases 17-21 consomem este contrato.
 */

// ---------------------------------------------------------------------------
// Tipo exportado
// ---------------------------------------------------------------------------

export type PlausibilityClass =
  | "illegal"   // Regra dura - nunca pode acontecer
  | "nearZero"  // Quase impossivel; so em caos extremo ou cenario muito especifico
  | "rare"      // Raro, mas possivel
  | "plausible" // Normal para o estado
  | "expected"; // Esperado pelo estado

// ---------------------------------------------------------------------------
// Tabela canonica de exemplos
// ---------------------------------------------------------------------------

export const PLAUSIBILITY_EXAMPLES: Array<{
  event: string;
  condition: string;
  class: PlausibilityClass;
}> = [
  // illegal - regra dura, nunca pode acontecer
  { event: "baron_taken",               condition: "gameTimeSec < 1200 (antes dos 20:00)",                    class: "illegal"   },
  { event: "elder_taken",               condition: "nenhum time tem soul (elderUnlocked === false)",           class: "illegal"   },
  { event: "kill",                      condition: "killer.teamId === victim.teamId (self-kill / mesmo time)", class: "illegal"   },
  // nearZero - quase impossivel; so em caos extremo ou cenario muito especifico
  { event: "tower_destroyed",           condition: "gameTimeSec < 45 (torre < 00:45)",                        class: "nearZero"  },
  { event: "quadra_kill",               condition: "gameTimeSec < 90 (quadrakill < 01:30)",                   class: "nearZero"  },
  { event: "inhibitor_destroyed",       condition: "gameTimeSec < 960 (inhib < 16:00)",                       class: "nearZero"  },
  { event: "tower_destroyed (nexusTurret)", condition: "gameTimeSec < 1200 (nexusTurret < 20:00)",            class: "nearZero"  },
  // rare - raro, mas possivel
  { event: "first_tower",              condition: "gameTimeSec in [420,540) (7-9min em stomp)",               class: "rare"      },
  { event: "baron_taken",              condition: "gameTimeSec === 1200 com ace/pick/setup perfeito",         class: "rare"      },
  { event: "inhibitor_destroyed",      condition: "stomp extremo: gameTimeSec in [960,1200)",                 class: "rare"      },
  // plausible - normal para o estado
  { event: "first_tower",             condition: "gameTimeSec in [540,840) (9-14min em vantagem)",            class: "plausible" },
  { event: "triple_kill",             condition: "gameTimeSec in [480,840) (8-14min)",                        class: "plausible" },
  // expected - esperado pelo estado
  { event: "first_tower",             condition: "gameTimeSec in [600,900) (10-15min) jogo normal",           class: "expected"  },
  { event: "baron_taken",             condition: "gameTimeSec > 1500 com setup adequado",                     class: "expected"  },
];
