/**
 * scripts/mutation-maxcasualties.test.ts
 *
 * TESTE DE MUTACAO da alavanca primaria (plano 26-08, Task 2). NAO E GATE DE
 * CALIBRACAO: nao mede se a engine esta calibrada, mede se o GATE DE RITMO
 * (a banda "abates/min" de scripts/calibrate-pace.ts) de fato REAGE quando a
 * alavanca que ele diz vigiar (`maxCasualties`, src/sim/combat.ts) muda. Um
 * teste que so reafirma a tabela atual passa sempre e nao prova nada; este
 * teste prova nao vacuidade rodando o MESMO cenario duas vezes, uma com a
 * alavanca real e outra com a alavanca perturbada, e afirmando que o
 * resultado contra a banda MUDA.
 *
 * Executar: npx vitest run -c vitest.mutation.config.ts
 * (o script npm mutation:maxcasualties entra neste mesmo Task)
 * Relatorio: tmp/mutation-maxcasualties.txt
 *
 * A FORMA DO TESTE, ponto inteiro deste arquivo: tres rodadas do MESMO
 * cenario (mesma fixture, mesma sequencia de sementes), diferindo so na
 * alavanca:
 *   - BASE: `maxCasualties` real, importado sem alteracao;
 *   - PERTURBADA: `maxCasualties` substituida por uma funcao que devolve o
 *     valor real multiplicado por 1,2 e arredondado para inteiro;
 *   - CONTROLE NEGATIVO: `maxCasualties` substituida por uma funcao que
 *     devolve o valor real multiplicado por 1,0 (a MESMA envoltoria de
 *     substituicao de modulo do caso perturbado, so com o multiplicador
 *     desligado). Se o controle divergisse da base, a diferenca entre
 *     base e perturbada nao poderia ser atribuida a perturbacao: poderia
 *     ser um efeito da propria mecanica de substituicao.
 *
 * A PERTURBACAO E INJETADA POR SUBSTITUICAO DE MODULO (`vi.doMock` +
 * `vi.resetModules` + `import()` dinamico DEPOIS do mock), inteiramente
 * dentro deste arquivo de teste. Nenhuma linha de `src/sim/` e tocada; a
 * verificacao automatizada deste Task confere `git status --porcelain
 * src/sim` vazio.
 *
 * O TAMANHO DE AMOSTRA (N=500) e MENOR que o gate completo (N=800 em
 * scripts/calibrate-pace.ts) para caber no orcamento de tempo de um teste
 * de mutacao (que roda TRES simulacoes completas do cenario, nao uma), e
 * GRANDE O BASTANTE para que o efeito esperado da perturbacao de 20% seja
 * maior que a variacao entre duas rodadas BASE de sementes diferentes
 * (o "ruido base-base"). Isto foi MEDIDO, nao suposto: com N=500, a rodada
 * base (sementes 0..499) mede abates/min = 1,2761 e a rodada perturbada
 * (mesmas sementes, x1,2) mede 1,3453 -- uma diferenca de 0,0692. Uma
 * SEGUNDA rodada base, com sementes disjuntas (500..999), mede 1,2951 --
 * uma diferenca de apenas 0,0190 contra a primeira rodada base, puro ruido
 * amostral de reconfiguracao de roster/semente sob a MESMA alavanca. A
 * diferenca da perturbacao (0,0692) e cerca de 3,6 vezes maior que o ruido
 * medido (0,0190), margem confortavel para atribuir a diferenca ao
 * mutante e nao a variancia. N=500 foi escolhido ANTES de fixar o valor
 * final no arquivo: tamanhos menores (300, 400) foram medidos primeiro e
 * descartados porque o ruido, medido contra tres janelas de sementes
 * disjuntas diferentes, chegava a ficar do mesmo tamanho ou maior que o
 * efeito da perturbacao (ex.: N=150 mediu diferenca de perturbacao 0,0426
 * contra ruido 0,0864, ruido MAIOR que o sinal).
 *
 * A HONESTIDADE SOBRE O ESTADO DA BANDA (26-08, objetivo). No ponto de
 * operacao commitado desta medicao (2026-08-20), a rodada BASE de
 * abates/min JA NASCE FORA da banda [0,700; 1,000] (calibrate-pace.ts,
 * dono Fase 26): mede-se 1,2761, do lado TETO. Isto NAO e um bug deste
 * teste, e um estado medido da engine, herdado do fato de que a Fase 26
 * ainda nao fechou aquela banda (docs/diagnostics/26-sweep.md). Por isso a
 * clausula 1 da asserção (abaixo) e ADAPTATIVA: se a base estivesse DENTRO
 * da banda, a prova classica de troca de rotulo (dentro -> TETO) seria
 * usada; como a base ja esta em TETO, e a perturbacao (+20% em
 * maxCasualties, que so pode AUMENTAR abates, nunca diminuir) so pode
 * empurrar o valor MAIS PARA CIMA -- ou seja, MAIS FUNDO no mesmo lado
 * TETO, nunca para o lado PISO -- a prova de nao vacuidade usa a MAGNITUDE
 * da violacao em vez do rotulo discreto: a rodada perturbada tem de violar
 * o teto por uma distancia estritamente MAIOR que a base, e essa distancia
 * adicional tem de exceder o ruido base-base medido acima. ACHADO NOMEADO:
 * o objetivo deste plano previa, para o caso de banda ja vermelha, que "a
 * rodada perturbada estoura o lado OPOSTO". A medicao real mostra que isso
 * nao e alcancavel para ESTA banda com ESTA alavanca: `maxCasualties` so
 * pode crescer sob a perturbacao declarada (x1,2, nunca x0,8), e um
 * aumento de `maxCasualties` so pode aumentar (nunca diminuir) o numero de
 * baixas por luta, entao o lado que a perturbacao empurra e SEMPRE TETO,
 * nunca PISO, independente de onde a base esteja. O "lado oposto" so
 * existiria se a base ja estivesse do lado PISO (abates/min BAIXO demais)
 * e a perturbacao a empurrasse de volta para dentro ou alem do TETO; nao e
 * o caso medido aqui, onde a base ja esta ACIMA do teto. Registrado como
 * estado medido, nao suavizado, no lugar de forcar a redacao do objetivo a
 * caber num numero que nao a sustenta.
 *
 * REANCORAGEM (Task 8 da linha calendario-e-volume, spec
 * docs/superpowers/specs/2026-10-02-calendario-e-volume-design.md secao 3). O
 * volume de abates passou a depender do motivo de luta, do reset entre lutas e
 * da escala de sangue do Caos; `maxCasualties` so corta o teto de baixas por
 * fase. A base agora nasce DENTRO da banda (0,800 contra o alvo 0,84; em
 * 50e1f68 era 1,263, lado TETO), e a perturbacao x1,2 move abates/min em
 * +0,062 (+7,7 por cento), longe dos 0,200 que faltam ate o teto. A prova
 * classica de troca de rotulo (dentro -> TETO) deixou de ser alcancavel com
 * esta alavanca: medido nas janelas de sementes 0..499, 500..999 e
 * 1000..1499, nem x1,5 (0,937; 0,931; 0,942) tira a banda do lugar, e x2,0
 * so passa raspando na primeira janela (1,004; 0,985; 0,985). Por isso, com a
 * base fora do lado TETO, a prova de nao vacuidade passa a ser uma BANDA DE
 * DOIS LADOS sobre o efeito pareado da perturbacao x1,2 (perturbada menos
 * base, mesmas sementes): [0,047; 0,093], de menor efeito medido nas tres
 * janelas (0,0586) x 0,80 a maior (0,0776) x 1,20, o mesmo criterio 0,80 /
 * 1,20 do plano 26-08. O efeito tambem tem de exceder o ruido base-base medido
 * na mesma rodada. Se a perturbacao um dia levar a rodada ao TETO a partir de
 * uma base dentro da banda, a prova classica vale e o teste passa por ela.
 * Registro em docs/diagnostics/calendario-e-volume-bandas.md.
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = i por partida, nunca seed compartilhada
 *   - Sem Math.random: apenas mulberry32(seed)
 *   - A perturbacao vive inteiramente neste arquivo de teste, por
 *     substituicao de modulo; nenhuma linha de src/sim/ e alterada
 *   - Relatorio escrito ANTES de qualquer assercao (mesmo padrao de
 *     scripts/calibrate-pace.ts): uma rodada vermelha ainda produz
 *     relatorio completo
 *   - A banda usada (piso, teto, alvo, fonte) e a MESMA de "abates/min" em
 *     scripts/calibrate-pace.ts, copiada verbatim com comentario de
 *     procedencia (nao reimportada porque calibrate-pace.ts nao exporta
 *     bandas individuais, so o relatorio agregado)
 *   - Relatorio pt-BR sem o caractere travessao
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { mulberry32 } from "../src/sim/rng";
import { ROLES } from "../src/sim/matchState";
import { checkBand, type Band } from "./bands";
import { mean } from "./stats";
import type { PlayerVersion, Role } from "../src/data/schema";
import type { SimulationResult } from "../src/sim/engine";

// ---------------------------------------------------------------------------
// Configuracao
// ---------------------------------------------------------------------------

/**
 * Tamanho de amostra por rodada. MENOR que o N=800 do gate completo
 * (scripts/calibrate-pace.ts) para caber no orcamento de tempo de um teste
 * que roda quatro configuracoes (base, perturbada, controle, ruido).
 * Justificativa completa com os numeros medidos: ver o bloco de comentario
 * no topo deste arquivo ("O TAMANHO DE AMOSTRA").
 */
const N = 500;

/**
 * Janela de sementes DISJUNTA da janela primaria (0..N-1), usada para medir
 * o ruido base-base (duas rodadas da MESMA alavanca real, sementes
 * diferentes). Nao sobrepoe a janela primaria por construcao.
 */
const NOISE_SEED_OFFSET = 500;

/**
 * Banda de dois lados do efeito pareado da perturbacao x1,2 (perturbada menos base,
 * mesmas sementes), usada quando a base NAO esta do lado TETO e a perturbada nao
 * chega ao TETO. Reancorada na Task 8 da linha calendario-e-volume (ver o bloco
 * REANCORAGEM no topo deste arquivo): efeitos medidos 0,0620 (sementes 0..499),
 * 0,0776 (500..999) e 0,0586 (1000..1499); piso = 0,0586 x 0,80, teto = 0,0776 x 1,20.
 */
const EFEITO_X12_BAND: Band = {
  floor: 0.047,
  ceiling: 0.093,
  target: 0.062,
  source:
    "Task 8 calendario-e-volume: efeito x1,2 medido em tres janelas disjuntas (0,0586 a 0,0776), " +
    "x 0,80 e x 1,20; spec 2026-10-02-calendario-e-volume secao 3",
  owner: "calendario-e-volume",
};

/**
 * Banda "abates/min", copiada VERBATIM de scripts/calibrate-pace.ts (dono
 * Fase 26, dentro do bloco de bandas de dois lados). Nao reimportada porque
 * calibrate-pace.ts nao exporta bandas individuais como simbolos, so o
 * relatorio agregado; piso, teto, alvo e fonte tem de ser identicos aos do
 * gate real para que "a mesma banda de taxa de abates que o gate de ritmo
 * avalia" (26-08 Task 2) seja literalmente verdade e nao uma banda nova
 * inventada para este teste.
 */
const ABATES_MIN_BAND: Band = {
  floor: 0.7,
  ceiling: 1.0,
  target: 0.84,
  source: "STACK.md secao 3 linha 8",
  owner: "Fase 26",
};

// ---------------------------------------------------------------------------
// Builders de fixture flat (copiados verbatim de scripts/calibrate-pace.ts,
// tier EQUILIBRADO 75 contra 75 -- a mesma fixture onde abates/min e avaliada)
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
// Simulador de tipo (a assinatura de simulateMatch, para tipar os tres
// modulos importados dinamicamente da mesma forma)
// ---------------------------------------------------------------------------

type SimulateMatchFn = (
  user: PlayerVersion[],
  rival: PlayerVersion[],
  rng: () => number
) => SimulationResult;

/** Roda N partidas (tier EQUILIBRADO 75 contra 75) e retorna a media de abates/min. */
function medirAbatesMin(sim: SimulateMatchFn, seeds: readonly number[]): number {
  const arr = seeds.map((seed) => {
    const res = sim(roster("u", 75), roster("r", 75), mulberry32(seed));
    const killsTotal = res.finalState.user.kills + res.finalState.rival.kills;
    return killsTotal / (res.durationSec / 60);
  });
  return mean(arr);
}

// ---------------------------------------------------------------------------
// Teste de mutacao
// ---------------------------------------------------------------------------

describe("mutacao da alavanca primaria (maxCasualties) contra a banda abates/min", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../src/sim/combat");
  });

  it("prova nao vacuidade: base real, perturbada x1,2 e controle x1,0, com controle negativo", async () => {
    // --- Rodada BASE: alavanca real, sem alteracao ---
    const { simulateMatch: simBase } = (await import("../src/sim/engine")) as {
      simulateMatch: SimulateMatchFn;
    };

    // --- Rodada PERTURBADA: maxCasualties substituida por valor real x 1,2 ---
    vi.resetModules();
    vi.doMock("../src/sim/combat", async () => {
      const actual = await vi.importActual<typeof import("../src/sim/combat")>(
        "../src/sim/combat"
      );
      return {
        ...actual,
        maxCasualties: (t: number) => Math.round(actual.maxCasualties(t) * 1.2),
      };
    });
    const { simulateMatch: simPerturbada } = (await import("../src/sim/engine")) as {
      simulateMatch: SimulateMatchFn;
    };

    // --- Rodada CONTROLE NEGATIVO: mesma envoltoria de substituicao, multiplicador 1,0 ---
    vi.resetModules();
    vi.doMock("../src/sim/combat", async () => {
      const actual = await vi.importActual<typeof import("../src/sim/combat")>(
        "../src/sim/combat"
      );
      return {
        ...actual,
        maxCasualties: (t: number) => Math.round(actual.maxCasualties(t) * 1.0),
      };
    });
    const { simulateMatch: simControle } = (await import("../src/sim/engine")) as {
      simulateMatch: SimulateMatchFn;
    };

    const seedsPrimarias = Array.from({ length: N }, (_, i) => i);
    const seedsRuido = Array.from({ length: N }, (_, i) => i + NOISE_SEED_OFFSET);

    const abatesMinBase = medirAbatesMin(simBase, seedsPrimarias);
    const abatesMinPerturbada = medirAbatesMin(simPerturbada, seedsPrimarias);
    const abatesMinControle = medirAbatesMin(simControle, seedsPrimarias);
    const abatesMinBaseRuido = medirAbatesMin(simBase, seedsRuido);

    const ruidoBaseBase = Math.abs(abatesMinBaseRuido - abatesMinBase);
    const efeitoPerturbacao = abatesMinPerturbada - abatesMinBase;

    const rBase = checkBand("abates/min (base)", abatesMinBase, ABATES_MIN_BAND);
    const rPerturbada = checkBand("abates/min (perturbada x1,2)", abatesMinPerturbada, ABATES_MIN_BAND);
    const rControle = checkBand("abates/min (controle x1,0)", abatesMinControle, ABATES_MIN_BAND);

    // -------------------------------------------------------------------------
    // Relatorio pt-BR, escrito ANTES de qualquer assercao (T-23-12 / mesmo
    // padrao de scripts/calibrate-pace.ts): uma rodada vermelha ainda produz
    // relatorio completo.
    // -------------------------------------------------------------------------
    let out = "TESTE DE MUTACAO: maxCasualties (alavanca primaria) contra abates/min\n";
    out += "========================================================================\n";
    out += `\nN = ${N} partidas por rodada, tier EQUILIBRADO (75 contra 75), semente = indice da partida\n`;
    out += `Janela de sementes primaria: 0..${N - 1}\n`;
    out += `Janela de sementes de ruido (base-base, disjunta): ${NOISE_SEED_OFFSET}..${NOISE_SEED_OFFSET + N - 1}\n`;
    out += `\nBanda avaliada (identica a "abates/min" de scripts/calibrate-pace.ts, dono Fase 26):\n`;
    out += `  piso ${ABATES_MIN_BAND.floor}, teto ${ABATES_MIN_BAND.ceiling}, alvo ${ABATES_MIN_BAND.target}, fonte ${ABATES_MIN_BAND.source}\n`;
    out += "\n--- AS TRES RODADAS ---\n";
    out += `  ${rBase.line}\n`;
    out += `  ${rPerturbada.line}\n`;
    out += `  ${rControle.line}\n`;
    out += "\n--- CONTROLE NEGATIVO ---\n";
    out += `  controle (x1,0) === base (bit a bit)? ${abatesMinControle === abatesMinBase ? "SIM" : "NAO"}\n`;
    out += `  controle = ${abatesMinControle.toFixed(4)}  base = ${abatesMinBase.toFixed(4)}\n`;
    out += "\n--- RUIDO BASE-BASE E EFEITO DA PERTURBACAO ---\n";
    out += `  base (sementes 0..${N - 1})               = ${abatesMinBase.toFixed(4)}\n`;
    out += `  base (sementes ${NOISE_SEED_OFFSET}..${NOISE_SEED_OFFSET + N - 1}, ruido) = ${abatesMinBaseRuido.toFixed(4)}\n`;
    out += `  ruido base-base (|diferenca|)              = ${ruidoBaseBase.toFixed(4)}\n`;
    out += `  perturbada (x1,2, sementes 0..${N - 1})     = ${abatesMinPerturbada.toFixed(4)}\n`;
    out += `  efeito da perturbacao (perturbada - base)  = ${efeitoPerturbacao.toFixed(4)}\n`;
    out += `  razao efeito/ruido                          = ${(efeitoPerturbacao / ruidoBaseBase).toFixed(2)}x\n`;

    // Tres formas da prova de nao vacuidade, conforme o estado medido da banda:
    //   - adaptativa (26-08): base ja no lado TETO; a perturbada viola mais fundo;
    //   - classica: base dentro e perturbada no TETO (troca de rotulo);
    //   - reancorada (Task 8 calendario-e-volume): base fora do lado TETO e perturbada
    //     sem chegar ao TETO; o efeito pareado cai na banda EFEITO_X12_BAND.
    const formaAdaptativa = rBase.side === "TETO";
    const formaClassica = rBase.ok && rPerturbada.side === "TETO";
    const rEfeito = checkBand("efeito da perturbacao x1,2 (perturbada - base)", efeitoPerturbacao, EFEITO_X12_BAND);
    out += `  ${rEfeito.line}\n`;

    out += "\n--- LEITURA DO ESTADO DA BANDA ---\n";
    if (formaClassica) {
      out += "  Base DENTRO da banda e perturbada no TETO: a prova classica de troca de\n";
      out += "  rotulo (dentro -> TETO) vale.\n";
    } else if (!formaAdaptativa) {
      out += "  Base fora do lado TETO e perturbada sem chegar ao TETO: a troca de rotulo nao\n";
      out += "  e alcancavel com esta alavanca (bloco REANCORAGEM no topo deste arquivo). A\n";
      out += "  prova de nao vacuidade e a banda de dois lados sobre o efeito pareado, com o\n";
      out += "  efeito acima do ruido base-base medido nesta rodada.\n";
    } else {
      out += "  Base FORA da banda (lado TETO) no ponto de operacao commitado: a prova de\n";
      out += "  nao vacuidade usa a MAGNITUDE da violacao (rodada perturbada viola o teto\n";
      out += "  por distancia estritamente maior que a base, excedendo o ruido medido),\n";
      out += "  porque o rotulo discreto ja esta saturado no lado TETO nas duas rodadas.\n";
      out += "  Ver o bloco de comentario \"A HONESTIDADE SOBRE O ESTADO DA BANDA\" no topo\n";
      out += "  deste arquivo para o achado nomeado completo.\n";
    }

    try {
      mkdirSync("tmp", { recursive: true });
    } catch {
      // ja existe
    }
    writeFileSync("tmp/mutation-maxcasualties.txt", out, "utf-8");

    // ---------------------------------------------------------------------------
    // ASSERTS
    // ---------------------------------------------------------------------------

    // CONTROLE NEGATIVO (obrigatorio): a mesma envoltoria de substituicao de
    // modulo com multiplicador 1,0 tem de produzir resultado IDENTICO a base.
    // Se divergisse, a diferenca entre base e perturbada nao poderia ser
    // atribuida a perturbacao -- poderia ser efeito da propria mecanica de
    // mock. Igualdade exata (nao aproximada): Math.round(x * 1.0) === x para
    // todo inteiro x que maxCasualties devolve, entao a trajetoria inteira da
    // simulacao (RNG, eventos, duracao) e byte-identica.
    expect(
      abatesMinControle,
      `controle negativo (x1,0) divergiu da base: controle=${abatesMinControle.toFixed(4)} base=${abatesMinBase.toFixed(4)} -- a mecanica de substituicao de modulo introduziu vies`
    ).toBe(abatesMinBase);

    if (formaClassica) {
      // CLAUSULA 1, forma classica: base dentro, perturbada no TETO (troca de rotulo).
      // O lado TETO e o que a perturbacao empurra: maxCasualties x1,2 so pode AUMENTAR
      // baixas por luta, e mais baixas empurra abates/min para cima.
      expect(rPerturbada.ok).toBe(false);
    } else if (!formaAdaptativa) {
      // CLAUSULA 1, forma REANCORADA (Task 8 da linha calendario-e-volume, regra 5 do
      // brief: comportamento que mudou de verdade vira banda de dois lados medida, com a
      // spec citada). Base fora do lado TETO e perturbada sem chegar ao TETO: o efeito
      // pareado tem de cair na banda EFEITO_X12_BAND e exceder o ruido base-base medido
      // nesta mesma rodada. Ver o bloco REANCORAGEM no topo deste arquivo.
      expect(
        rEfeito.ok,
        `efeito da perturbacao fora da banda reancorada (${rEfeito.line}) -- a alavanca deixou de mover abates/min como medido na Task 8`
      ).toBe(true);
      expect(
        efeitoPerturbacao,
        `efeito da perturbacao (${efeitoPerturbacao.toFixed(4)}) nao excedeu o ruido base-base medido (${ruidoBaseBase.toFixed(4)}) -- a diferenca entre base e perturbada pode ser ruido, nao a alavanca`
      ).toBeGreaterThan(ruidoBaseBase);
    } else {
      // CLAUSULA 2 da forma adaptativa: a rodada perturbada tem de estourar o lado que a
      // perturbacao empurra -- o TETO, porque maxCasualties x1,2 so pode AUMENTAR baixas
      // por luta, nunca diminuir, e mais baixas empurra abates/min para cima.
      expect(
        rPerturbada.side,
        `rodada perturbada nao estourou o TETO (${rPerturbada.line}) -- a perturbacao deveria empurrar abates/min para cima`
      ).toBe("TETO");
      // CLAUSULA 1, forma adaptativa (26-08 Task 2, honestidade sobre o estado
      // da banda): base ja fora (TETO). A prova de nao vacuidade usa a
      // MAGNITUDE da violacao: a rodada perturbada tem de violar o teto por
      // uma distancia MAIOR que a base, e essa distancia adicional (o efeito
      // da perturbacao) tem de exceder o ruido base-base medido nesta mesma
      // rodada, para nao ser atribuivel a variancia amostral.
      expect(
        efeitoPerturbacao,
        `efeito da perturbacao (${efeitoPerturbacao.toFixed(4)}) nao excedeu o ruido base-base medido (${ruidoBaseBase.toFixed(4)}) -- a diferenca entre base e perturbada pode ser ruido, nao a alavanca`
      ).toBeGreaterThan(ruidoBaseBase);
    }
  });
});
