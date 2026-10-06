# Manual da Engine de Simulacao

> **Documento vivo.** Toda vez que a engine mudar, este manual muda junto.
> Ele e a fonte de verdade conceitual: explica *o que* o modelo simula, *como*
> cada numero vira um acontecimento de partida e *por que* cada regra existe.
> Quando o codigo e o manual divergirem, um dos dois esta errado: conserte.

Versao do manual: **v2.3 (2026-10-05)** - ver [Changelog](#21-changelog-do-manual) no fim.

Codigo coberto: `src/sim/*` (engine state-driven, fases 5-21, os modulos das traits novas `traitEffects.ts` e `quits.ts`, a spec
[2026-10-02 luta, mapa e vitoria](superpowers/specs/2026-10-02-luta-mapa-vitoria-design.md)
e a spec
[2026-10-02 calendario e volume de abates](superpowers/specs/2026-10-02-calendario-e-volume-design.md),
com as duas emendas de calibracao).

---

## Indice

1. [Filosofia do modelo](#1-filosofia-do-modelo)
2. [Glossario: conceito de LoL onde vive no codigo](#2-glossario-conceito-de-lol-onde-vive-no-codigo)
3. [Mapa dos modulos](#3-mapa-dos-modulos)
4. [Determinismo e RNG](#4-determinismo-e-rng)
5. [A entrada: o card do jogador](#5-a-entrada-o-card-do-jogador)
6. [Derivacao de poder (power.ts)](#6-derivacao-de-poder-powerts)
7. [O estado da partida (matchState.ts)](#7-o-estado-da-partida-matchstatets)
8. [Timers e constantes](#8-timers-e-constantes)
9. [O loop de tick](#9-o-loop-de-tick)
10. [Objetivos: timers e regras duras (objectives.ts)](#10-objetivos-timers-e-regras-duras-objectivests)
11. [Selecao de intencao de macro (chooseIntent)](#11-selecao-de-intencao-de-macro-chooseintent)
12. [Resolucao de interacao (resolveInteraction)](#12-resolucao-de-interacao-resolveinteraction)
13. [Lutas, picks, kills e estruturas](#13-lutas-picks-kills-e-estruturas)
14. [Probabilidade de vitoria (winprob.ts)](#14-probabilidade-de-vitoria-winprobts)
15. [Escalares de campo: pressao, mapa, momentum](#15-escalares-de-campo-pressao-mapa-momentum)
16. [Eventos, ticker e contrato de saida](#16-eventos-ticker-e-contrato-de-saida)
16.6. [Plausibilidade probabilistica (v2.0)](#166-plausibilidade-probabilistica-v20)
16.7. [Regua de realismo (specs 2026-10-02)](#167-regua-de-realismo-specs-2026-10-02)
17. [Tabela mestra de tunables](#17-tabela-mestra-de-tunables)
18. [Invariantes garantidas](#18-invariantes-garantidas)
19. [Pontos abertos para repensar](#19-pontos-abertos-para-repensar)
20. [Como atualizar este manual](#20-como-atualizar-este-manual)
21. [Changelog do manual](#21-changelog-do-manual)

---

## 1. Filosofia do modelo

A regra de ouro esta escrita no topo de `engine.ts`:

> **"Randomness is noise around the state, never the cause."**

A engine **nao** sorteia o vencedor e inventa a narrativa depois. Ela mantem um
**estado vivo da partida** (ouro, torres, dragoes, quem esta vivo, buffs, pressao
de lane, lane lead acumulado, perfil de comp) e a cada instante:

1. o tempo avanca; timers de objetivo, respawns e buffs atualizam;
2. o estado derivado (fase, pressao, lane lead) decai e e recalculado;
3. cada time **escolhe uma intencao de macro** a partir do estado vivo;
4. as duas intencoes sao **resolvidas uma contra a outra**;
5. evento(s) coerentes sao emitidos e seu impacto aplicado ao estado;
6. a probabilidade de vitoria e **recalculada A PARTIR do novo estado**;
7. os eventos vao para a timeline.

Desde a spec de 2026-10-02 a cadeia causal que decide a partida e esta, e nenhuma
etapa tem canal proprio que a pule:

```
luta ou pick ganho -> JANELA de vantagem numerica -> objetivo ou torre
        ^                                                  |
        +---- poder de luta <---- OURO (relativo) <--------+
```

O vencedor emerge das lutas (secao 13.1), da conversao delas em mapa (secao 13.6) e do
ouro real que isso rende (secoes 6.5, 9.1 e 13.3). A regua de aceite e medida em
proporcoes reais de LoL (secao 16.7), nao em bandas internas.

A spec de calendario e volume (2026-10-02) acrescentou a **prontidao causal**: cada canal
so dispara quando o motivo real existe, e o calendario da partida sai como consequencia, sem
curva de ritmo copiada dos dados e sem trava fixa de horario. O jungler so ganka depois do
1o clear, o objetivo so e tomado depois de preparado, a luta 5v5 so sai com motivo e o Caos
controla quanto sangue sai (secoes 11.5, 12 e 13.1). As decisoes puras moram em
`readiness.ts` (secao 3); quem sorteia continua sendo `engine.ts`.

Consequencias de design dessa filosofia:

- **A aleatoriedade e ruido em torno do poder relativo, nunca a causa.** Um time
  mais forte vence *mais*, nao *sempre*.
- **A probabilidade de vitoria e um termometro, nao o juiz.** Um time atras que
  pega Baron/Elder, rouba um objetivo ou ganha uma luta move o numero de verdade,
  porque o numero e lido do estado, nao imposto sobre ele.
- **O impossivel e impossivel.** As regras duras dos objetivos (Baron nunca antes
  de 20:00, Elder so depois de soul, etc.) sao *guards* que lancam erro: um evento
  ilegal nunca chega na timeline.
- **O dado e magro de proposito.** Nao modelamos cada estatistica que o LoL real
  tem; modelamos so o que faz a partida *parecer* LoL e contar uma historia
  empolgante. Ver [pesquisa.md](../pesquisa.md) para a referencia de regras reais.

---

## 2. Glossario: conceito de LoL onde vive no codigo

| Conceito de LoL | Representacao na engine | Arquivo |
|---|---|---|
| Curva de forca do jogador (early/mid/late) | `lanePhase`, `midGame`, `lateGame` (1-100) | `data/schema.ts` |
| Identidade/personalidade do jogador | `traits` (catalogo fechado de 15) | `data/schema.ts` |
| Archetype do campeo (classe, escalada, tags) | `ChampionMeta` (frozen no build) | `championMeta.ts` |
| Forca contextual (em luta, pick, objetivo...) | **slices derivados** (`playerSlice`) | `power.ts` |
| Metricas de comportamento de jogador/champ | `MetricsBase` (18 campos, camadas 1+2 frozen) | `microMetrics.ts` |
| Vantagem persistente de lane | `TeamState.laneState[lane].laneLead` | `laneState.ts` |
| Perfil de composicao de time | `TeamState.compProfile` (`CompProfile`) | `teamComp.ts` |
| Scaling (time fraco cedo, forte tarde) | `phaseBlend` interpolando early->late | `matchState.ts` / `power.ts` |
| Prioridade de lane / side prio | `laneState.laneLead` -> `recomputePressure` | `laneState.ts` / `engine.ts` |
| Macro / shotcalling | `chooseIntent` (sorteio ponderado de intencoes) | `engine.ts` |
| Capitao / shotcaller | `isCaptain` (+4% luta, +5% objetivo se vivo) | `matchState.ts` / `power.ts` |
| Teamfight 5v5 | `resolveTeamfight` (fightPower x sorteio de largura `w` ligada ao Caos) | `engine.ts` |
| Vantagem depois da luta (janela) | `conversionSide`, `resolveConversion` | `conversion.ts` / `engine.ts` |
| Jungler terminando o 1o clear (campos aos 0:55) | `junglerFirstClearSec`, `junglerReady` | `readiness.ts` |
| Level 2 das rotas e all-in cedo | `laneAllInChance`, `resolveLaneAllIn` (so a partir de 1:30) | `readiness.ts` / `engine.ts` |
| Preparo de objetivo (visao, prioridade, Smite pronto) | `objectivePrep`, `prepGain`, `updateObjectivePrep`, `takeAttempt` | `readiness.ts` / `matchState.ts` |
| Motivo para brigar (objetivo, torre sob cerco, buff) | `fightReason`, `teamfightAllowed` | `readiness.ts` / `engine.ts` |
| Times voltando para a base e reagrupando | `fightResetSec` | `readiness.ts` |
| Partida mais ou menos sangrenta (slider de Caos) | `bloodScale` | `readiness.ts` |
| Quem da o Smite / confirma o objetivo | `objectiveSecurer` | `objectives.ts` |
| Pick / gank | `resolvePickoff`, `pickChance` | `engine.ts` |
| Smite no pit / steal | `securePower`, `stealChanceFor`, `contestChance`, `conversionStealFactor` | `engine.ts` / `power.ts` / `conversion.ts` |
| Buff de Baron / Elder (perde na morte) | `hasBaronBuff`/`hasElderBuff`, fracao de vivos buffados | `matchState.ts` / `power.ts` |
| Dragon Soul | `team.soul` (+10% luta permanente) | `objectives.ts` |
| Ouro real (abate, assistencia, torre, placa, objetivos) | `killGoldFor`, `creditPlayer`, `creditTeamSplit`, `TOWER_GOLD`, `plateGold` | `economy.ts` |
| Bounty / shutdown | `earnBounty`, `settleVictimBounty`, `shutdownGold` | `economy.ts` |
| Comeback (recompensa de objetivo para o time atras no ouro) | `objectiveBountyGold`, `effectiveChaos` | `economy.ts` / `tuning.ts` |
| Respawn crescente com o tempo | `respawnSeconds` | `engine.ts` |
| Ordem de queda das estruturas | `damageStructure` | `engine.ts` |
| Fase early/mid/late | `computePhase` (relogio + marcos estruturais) | `matchState.ts` |
| Win prob / barra de probabilidade | `computeWinProbability` (soma ponderada -> sigmoid) | `winprob.ts` |
| Selecao de killer/vitima por priors de role | `selectKiller` / `selectVictim` / `assignAssists` | `selection.ts` |
| Qualidade de morte contextual | `computeDeathQuality` ("good"/"neutral"/"bad") | `deathQuality.ts` |
| Narracao broadcast | `ticker.ts` + `makeXEvent` | `engine.ts` / `ticker.ts` |
| Harness de calibracao micro | `calibrate-micro.ts`, `npm run calibrate:micro` | `scripts/` |

---

## 3. Mapa dos modulos

```
src/sim/
+-- rng.ts             PRNG deterministico (mulberry32) + hash de string p/ seed
+-- matchState.ts      ESTADO da partida + timers/constantes + derivados puros
+-- power.ts           DERIVACAO de forca contextual a partir do card magro
+--                      inclui effectiveGoldPower, goldFightMult, goldSecureMult, goldRelevance
+-- economy.ts         OURO REAL: abate, assistencia, bounty (14.21), torre, placa, Barao,
+--                      farm passivo, recompensa de objetivo (puro, sem rng)
+-- tuning.ts          PARAMETROS calibraveis (RealismTuning, DEFAULT_REALISM_TUNING),
+--                      effectiveChaos, fightNoiseHalfWidth
+-- conversion.ts      JANELA DE CONVERSAO: conversionSide/Target/Lane, contestChance,
+--                      conversionLead (decisoes puras; quem sorteia e aplica e engine.ts)
+-- readiness.ts       PRONTIDAO de cada canal (spec calendario e volume): relogio do jungler,
+--                      all-in de rota, pick por fase, preparo de objetivo e tentativa de tomada,
+--                      motivo de luta, reset entre lutas, escala de sangue do Caos (funcoes
+--                      puras, sem sorteio; quem sorteia e engine.ts)
+-- structures.ts      ESTRUTURAS: pool de dano, placas de 2026, cerco da fase de rota, press,
+--                      Arauto, queda em ordem (damageStructure), resistencia da torre externa
+-- championMeta.ts    ARCHETYPE de campeao: ChampionMeta, NEUTRAL_META, ROLE_DEFAULTS
+-- microMetrics.ts    METRICAS de comportamento em 3 camadas (baseMetrics/overlayChampion/contextMetrics)
+-- laneState.ts       LANE STATE persistente: LaneStateEntry, updateLaneState, decayLaneState
+--                      computeStrongsideScore, strongside/weakside
+-- teamComp.ts        COMP PROFILE: CompProfile, deriveCompProfile, compFightMult/compSecureMult
+-- selection.ts       SELECAO de killer/vitima/assists com priors (selectKiller/selectVictim/assignAssists)
+--                      softCapDamp, PLAUSIBLE_BAND (placar plausivel), ArchBand
+-- deathQuality.ts    QUALIDADE de morte: computeDeathQuality, selectContextualTicker
+-- objectives.ts      TIMERS de epicos + REGRAS DURAS + take/steal
+-- winprob.ts         Probabilidade de vitoria (termometro do estado)
+-- simEvents.ts       Taxonomia do evento RICO interno (SimEvent + EventKind ctx_*)
+-- ticker.ts          Frases pt-BR "[quem] [verbo] [o que] [onde]"
+-- engine.ts          O LOOP: intencoes -> resolucao -> eventos -> impacto
+-- runMatchEngine.ts  Ponte: SimEvent[] -> contrato persistido (MatchResult)
+-- types.ts           Schemas Zod do contrato de saida (GameEvent/MatchResult)
```

Fluxo de chamada na partida ao vivo:

```
tournament/series.ts
  -> runMatchEngine(input, seed)        [runMatchEngine.ts]
     -> simulateMatch(rosters, rng, ...)  [engine.ts]   <- todo o modelo roda aqui
     -> toGameEvent(...)                [runMatchEngine.ts]
  -> MatchResult { winner, events[], totalPlaybackMs }
```

A fronteira e importante: **dentro** da engine o estado e um objeto TS mutavel
simples (sem Zod, porque muda a cada tick e validar seria desperdicio). **Na
saida**, o `MatchResult` e validado por Zod (`types.ts`), entao o que cruza para
storage/UI e seguro.

---

## 4. Determinismo e RNG

- Toda aleatoriedade flui por um RNG com seed: `mulberry32(seed)` em `rng.ts`.
- **Proibido** chamar `Math.random()` em codigo de simulacao. Mesma seed -> mesma
  partida, byte a byte (replay deterministico).
- `seedFromString` (FNV-1a) transforma uma string estavel (ex: `"match-round-1"`)
  num inteiro de seed.
- A seed entra em `runMatchEngine(input, seed)`; um unico `rng` e criado e passado
  por toda a engine. A ordem de consumo do `rng` importa: mudar a ordem das
  chamadas muda o resultado para a mesma seed (relevante ao alterar a engine).
- **Aridade de draws estavel (INV-1):** `selectKiller` e `selectVictim` consomem
  exatamente 1 draw de rng cada (roleta ponderada). `assignAssists` consome 0 draws
  (re-rank deterministico puro). Esse contrato de aridade nao pode mudar sem migrar
  todas as seeds existentes.
- **A ordem dos sorteios mudou em 2026-10-02** (sorteio de luta ligado ao Caos, janela
  de conversao, desfecho de poco disputado): a mesma seed refaz OUTRA partida em relacao
  ao motor anterior, e o golden foi regenerado. Por isso o replay solo
  (`src/tournament/replayGuard.ts`, usado em `src/App.tsx`) compara o vencedor da partida
  refeita com o `winnerId` gravado e, se divergirem, mostra "gravacao indisponivel" em vez
  da timeline (a sala multiplayer ja se protegia em `server/room/replay.ts`).
- **A ordem e a contagem dos sorteios mudaram de novo na spec de calendario e volume**
  (all-in de rota, tentativa de tomada pelo preparo, pick e luta com `bloodScale`, janela que
  exige preparo): o golden foi regenerado outra vez, com o diff documentado em
  `docs/diagnostics/golden-diff-calendario-e-volume.txt`. O contrato de aridade de
  `selectKiller`, `selectVictim` e `assignAssists` (acima) nao mudou.

---

## 5. A entrada: o card do jogador

Validado por `PlayerVersionSchema` em `data/schema.ts`. Campos que a engine usa:

| Campo | Faixa | Uso na engine |
|---|---|---|
| `primaryRole` | `top/jungle/mid/adc/support` | posicao no time |
| `roleStrength` | mapa completo 0-100 | selecao/draft (nao no combate atual) |
| `lanePhase` | 1-100 | base de `laning` e early de cada slice |
| `midGame` | 1-100 | base de mid de cada slice |
| `lateGame` | 1-100 | base de scaling e late de cada slice |
| `traits` | ate 4 do catalogo | bonus de slice + comportamentos situacionais |
| `advanced` | bloco opcional | 11 campos avancados (risco, weakside, carry, etc.) |
| `photo` | URL | exibicao no HUD (nao afeta simulacao) |
| `tags` / `style` / `shortDescription` | string | metadados de UI |
| `championPool` | campeos + maestria | usado por `microMetrics` e `championMeta` |

**Decisao de produto registrada no codigo:** o card e magro de proposito. Em vez
de ~15 campos de "power" por jogador, derivamos forca contextual em tempo de
simulacao (ver secao 6). Ver [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) para o
dicionario completo de campos, incluindo o bloco `advanced`.

### Catalogo de traits (15)

| Trait | Efeito | Onde aplica |
|---|---|---|
| `lane_bully` | +8 laning, +4 skirmish | `TRAIT_SLICE_BONUS` |
| `strong_laner` | +6 laning, +2 objective | `TRAIT_SLICE_BONUS` |
| `clutch_player` | +8 teamfight, +3 pickoff; +4% luta se MUITO atras E tarde | slice + `traitCombatMultiplier` |
| `objective_focused` | +8 objective, +4 siege; +0.08 de steal | slice + `stealChanceFor` |
| `baron_stealer` | +9 objective; +0.20 de steal | slice + `stealChanceFor` |
| `mental_fort` | +3 teamfight, +3 scaling; +2% luta quando atras | slice + `traitCombatMultiplier` |
| `tilts_on_death` | -2.5% luta quando atras E ja morreu | `traitCombatMultiplier` |
| `plays_worse_when_behind` | -3% luta quando atras | `traitCombatMultiplier` |
| `trash_talker` | cross-team: -1.5% na luta do INIMIGO por portador vivo | `traitCombatMultiplier` |
| `teamfights` | +5 teamfight (so com ele em jogo); 1,4x como quem mata e 0,85x como vitima nas lutas em grupo | `fightPower` + `traitKillerWeight`/`traitVictimWeight` |
| `flips` | 1,5x como quem mata e 2,2x como vitima em todo abate; all-in extra na rota de 1:30 a 14:00 (0,04 x `bloodScale` por tick), chance de vitoria 0,5 + vantagem/40 + laneLead/120 em [0,15; 0,85] | `traitKillerWeight`/`traitVictimWeight` + `flipsDuels` (passo 12-c1b) |
| `dragon_lover` (Ama objetivos) | dragao, larvas e Arauto: +1,5 no setup, +2 quando o inimigo prepara (>= 50), preparo 1,3x com win prob > 0,55, +0,10 de roubo, exposto 0,5 nos picks quando o time prepara, 1,4x vitima na luta no poco | `applyTraitIntentBiases`, `prepGain`, `stealChanceFor`, `resolvePickoff`, `resolveContestedObjective` |
| `roamer` | +1,5 de gank ate 14:00; em gank fora da rota, assistencia garantida e metade dos abates; -6 de laneLead na rota dele por roam | `applyTraitIntentBiases`, `resolvePickoff` |
| `side` | no meio de jogo e com ele em jogo, +1,0 de split, split na rota dele, +0,15 de forca em `resolveStructurePressure` e +25 de pressao na rota dele (user soma, rival subtrai) | `applyTraitIntentBiases`, `structures.ts`, `recomputePressure` |
| `quits` | numa morte com 4+ mortes, mortes >= 2x (abates + assistencias) e 3 mortes em 300 s sem abate: 1/3 de quitar no fim do tick; fora ganha 122,4 de ouro por minuto e conta 0 na forca; metade volta em 120 a 300 s | `quits.ts`, `processRespawns`, `passiveIncome` |

> As traits novas (spec 2026-10-05-traits-no-motor) moram em `src/sim/traitEffects.ts` e
> `src/sim/quits.ts`, com os numeros em `TRAIT_TUNING`. Sem portador, nenhuma muda o motor nem
> consome sorteio. A chave do solo (`MatchInput.newTraitEffects`) desliga as seis.

> Os traits "negativos" nao tem bonus de slice; o efeito e situacional, lido do
> estado ahead/behind vivo, nunca um modificador fixo de pre-partida.

---

## 6. Derivacao de poder (power.ts)

O objetivo: traduzir 3 numeros (early/mid/late) em **forcas contextuais**.

### 6.1 Slices por jogador - `playerSlice(card, slice, blend?)`

Um jogador nao tem "forca de teamfight" armazenada; ela e calculada sob demanda.
Base de cada slice (antes do bonus de trait):

| Slice | Formula base (estatica, `blend` ausente) | Com `blend` (early->late) |
|---|---|---|
| `laning` | `lanePhase` | - |
| `skirmish` | `0.45*lane + 0.55*mid` | early `0.6*lane+0.4*mid` -> late `0.55*mid+0.45*late` |
| `teamfight` | `0.45*mid + 0.55*late` | early `0.25*lane+0.55*mid+0.2*late` -> late `0.3*mid+0.7*late` |
| `objective` | `0.7*mid + 0.3*late` | - |
| `pickoff` | `0.35*lane + 0.5*mid + 0.15*late` | - |
| `siege` | `0.5*mid + 0.5*late` | - |
| `scaling` | `lateGame` | - |

Depois soma `traitBonus` (tabela da secao 5).

> **Propriedade de calibracao:** em cards de stat chapado (`lane=mid=late`) o
> resultado e identico com ou sem `blend`. Isso protege as fixtures de calibracao.

### 6.2 `phaseBlend(gameTimeSec)` - o relogio do scaling

Interpola 0->1 linearmente ate 25:00 (`LATE_PHASE_AT`):

```
phaseBlend = clamp(gameTimeSec / 1500, 0, 1)
// 5:00 aprox 0.20   14:00 aprox 0.56   >=25:00 = 1.0
```

Conceito de LoL: cedo a forca de lane carrega a luta; tarde a forca de scaling
carrega. So os slices `skirmish` e `teamfight` usam o blend hoje.

### 6.3 Forca de time - `teamSlice(team, slice, blend?)`

Soma ponderada por rota dos slices dos jogadores **vivos**. Jogador morto
contribui so **15%** (`presence = 0.15`): lutar em desvantagem numerica deixa o
time genuinamente mais fraco.

Pesos de rota (`ROLE_WEIGHTS`):

| Slice | top | jungle | mid | adc | support |
|---|---|---|---|---|---|
| laning | 0.22 | 0.14 | 0.24 | 0.22 | 0.18 |
| skirmish | 0.16 | **0.30** | 0.26 | 0.13 | 0.15 |
| teamfight | 0.16 | 0.20 | 0.24 | **0.26** | 0.14 |
| objective | 0.12 | **0.40** | 0.20 | 0.16 | 0.12 |
| pickoff | 0.14 | **0.28** | 0.26 | 0.14 | 0.18 |
| siege | 0.22 | 0.16 | 0.20 | **0.28** | 0.14 |
| scaling | 0.18 | 0.16 | 0.26 | **0.28** | 0.12 |

### 6.4 Forca de lane - `laneLaningPower(team, lane)`

Top = `[top]`, mid = `[mid]`, bot = `[adc, support]`. Media do slice `laning` das
rotas da lane, com `presence` de morte (15%).

### 6.5 Canal de ouro - `effectiveGoldPower`, `goldFightMult`, `goldSecureMult`

O ouro entra no poder pela **fatia do time no ouro total da partida**, nao pela
distancia de cada jogador a uma curva de ouro esperado. Isso muda duas coisas
(spec 2026-10-02, secao 2): dois times que sobem juntos na economia nao ganham
vantagem nenhuma, e a vantagem relativa de 3k de ouro vale de fato alguma coisa
contra o sorteio de luta (13.1). A forma e invariante a escala do ouro.

**Fatia e relevancia (`power.ts`):**

```
goldShare(team)  = team.gold / (user.gold + rival.gold)      // 0.5 se ninguem tem ouro
                                                              // team.gold = soma do ouro dos 5 jogadores

goldRelevance(state) =                                        // saturacao de item
  poorerPerPlayer = min(user.gold, rival.gold) / 5
  1                                  se poorerPerPlayer <= fullBuildStartPerPlayer (12000)
  cai linearmente ate 0              em fullBuildEndPerPlayer (18000)
```

`goldRelevance` e o pedido do dono do produto: em partida muito longa todo mundo
fecha a build, o ouro para de pesar e sobram mapa, dragoes, habilidade e comp (os
outros termos de `fightPower`). Num jogo tipico isso comeca perto dos 32-35 min e
zera perto dos 45-50 min.

**Canal primario - `goldFightMult` (fightPower):**

```
e = media dos vivos, ponderada por ROLE_WEIGHTS["teamfight"], de
    goldFightElasticity(classe, blend efetivo)      // early/late por classe, 0.07 a 0.45
    blend efetivo = clamp(phaseBlend + (scalingCurve - 0.5) * 0.6)

expoente = goldFightExponent * (e / 0.25) * goldRelevance(state)      // goldFightExponent = 1.85
goldFightMult = clamp( (2 * goldShare) ^ expoente , [0.6, 1.6] )
```

Carries (marksman/mage) tem elasticidade maior no late, tanks e supports menor: o
mesmo ouro vale mais na mao do carry. Exemplo com elasticidade media 0.25 e
relevancia 1: 55% do ouro total da `1.1^1.85 = 1.19` e o outro lado `0.9^1.85 = 0.82`,
uma razao de cerca de 1.45 entre os dois poderes antes do sorteio.

**Canal secundario - `goldSecureMult` (securePower):**

```
e = media dos vivos, ponderada por ROLE_WEIGHTS["objective"], de GOLD_SECURE_ELASTICITY[classe]
expoente = goldFightExponent * GOLD_SECURE_FACTOR * (e / 0.18) * goldRelevance(state)   // factor 0.40
goldSecureMult = clamp( (2 * goldShare) ^ expoente , [0.8, 1.25] )
```

O canal secundario e mais estreito (`GOLD_SECURE_FACTOR` 0.40 e clamp `[0.8, 1.25]`
contra `[0.6, 1.6]`): ouro importa menos para o Smite do que para a luta.

**`pickChance` tambem pesa o ouro:** a chance de pick (secao 12-c) e multiplicada
pela razao `goldFightMult(lado) / goldFightMult(inimigo)`, limitada a `[0.5, 2]`.

**Ouro esperado - `expectedGoldForRoleAtMinute`:** agora em ouro real, e a integral do
farm passivo com lead de rota zero (`economy.expectedPassiveGold`, mesma formula de
9.1) mais os 500 iniciais, re-ancorada no nivel medio real dos dez jogadores
(`averageLaningSlice`). Quem a le: `effectiveGoldPower`, `microMetrics`.

**`effectiveGoldPower` (funcao de analise, nao de resolver):**

Decomposicao em 8 componentes por jogador (damageThreat, survivability,
objectiveDps, siegeThreat, teamfightValue, pickThreat, visionControl,
objectiveSetup). Consome `sigmoid(goldDelta / K)` com `K = 1375` (prior interno, o
`K = 500` antigo vezes o 2.75 do `goldScale` que foi removido). Nao e chamada pelo
loop de tick; e usada pelo harness de calibracao e pelo DATA-DICTIONARY.

**Neutralidade (INV-2):** paridade de ouro => fatia 0.5 => `(2 * 0.5)^k == 1` exato em
todos os canais. Em economia igual, o ouro nao muda nada.

**Parametros calibraveis** (`DEFAULT_REALISM_TUNING`, `src/sim/tuning.ts`; registro em
`docs/diagnostics/luta-mapa-vitoria-calibracao.md`, secoes 2, 2b e 7, e
`docs/diagnostics/calendario-e-volume-calibracao.md`, secoes 6, 8 e 10):

| Parametro | Valor final | Papel |
|---|---|---|
| `goldFightExponent` | 1.85 | expoente da fatia de ouro no poder de luta |
| `fullBuildStartPerPlayer` | 12000 | ouro por jogador (time mais pobre) onde o ouro comeca a pesar menos |
| `fullBuildEndPerPlayer` | 18000 | ouro por jogador onde o ouro deixa de pesar |

Os dois `fullBuild*` sao valores de desenho do dono do produto (build completa ~18k por
jogador) e nao entram em varredura. O expoente andou de 1.5 (fim da Task 7 da spec de luta,
mapa e vitoria) para 1.375 (Task 8 dela) e, na calibracao final do calendario e volume,
foi a 1.85 (secao 10.7.2 do registro, repasse 2 na linha do lider de ouro): o `fightNoiseBase`
mais alto (0.375, secao 13.1) segura o favorito com gap de elenco, e o expoente maior devolve o
peso do ouro na luta (lider de ouro e vencedor com mais ouro) que o ruido tirou.

### 6.6 Forca de luta total - `fightPower(state, side)`

O numero-mestre que resolve lutas E alimenta a win prob:

```
p = teamSlice(team, "teamfight", phaseBlend(t))
p *= 1 + 0.14 * (baronBuffHoldersVivos / 5)   // Baron: edge modesto
p *= 1 + 0.55 * (elderBuffHoldersVivos / 5)    // Elder: execute brutal
if soul:  p *= 1.10                            // soul: edge permanente
p *= 1 + 0.02 * n_dragoes                      // cada drake: +2%
p *= traitCombatMultiplier(...)               // traits situacionais (0.7-1.3)
if capitaoVivo: p *= 1.04                      // shotcaller
p *= goldFightMult(team, state)               // ouro RELATIVO (clamp [0.6,1.6], secao 6.5)
p *= compFightMult(team, enemy, state)        // canal de comp (clamp [0.93,1.07])
p *= ratingFightMult(team, enemy, ratingPowerD)   // curva de rating de carta (FRC-04)
```

Notas de design:

- `compFightMult` e aplicado APOS `goldFightMult` (tempero apos o prato, sem
  double-counting). As variaveis sao ortogonais: ouro = quanto cada time tem em
  relacao ao outro; comp = como o conjunto de campeoes se encaixa.
- Nao ha mais `behindBoost`: o comeback saiu do poder de luta e vive so na economia
  (recompensa de objetivo, secao 13.4).
- `ratingFightMult` achata a razao de poder pela DIFERENCA de rating de carta dos
  elencos (nunca pelo estado vivo da partida). Identidade exata em diferenca zero.
  O padrao atual e `DEFAULT_SIM_CONFIG.ratingPowerD = 140` (era 525): a Task 8 mediu que so
  uma curva mais inclinada fecha a banda "favorito com gap >= 5 vence" (0.75 a 0.85);
  ver `docs/diagnostics/luta-mapa-vitoria-calibracao.md`, secoes 7.7 e 7.8.
- O resultado alimenta `resolveTeamfight` (13.1), onde ainda passa pelo sorteio de
  largura `w`.

### 6.7 `traitCombatMultiplier(...)` - traits no combate

Retorna multiplicador em torno de 1.0, **clampado em [0.7, 1.3]**. Roster sem
traits retorna exatamente 1.0 (calibracao intacta).

```
behind          = winProb < 0.5
deepBehindLate  = winProb < 0.4 E phaseFraction > 0.6   (phaseFraction = min(1, t/1800))

por jogador VIVO do time:
  plays_worse_when_behind & behind          -> -0.03
  tilts_on_death & behind & deaths>0        -> -0.025
  clutch_player & deepBehindLate            -> +0.04
  mental_fort & behind                      -> +0.02
por trash_talker VIVO do INIMIGO            -> -0.015 (cross-team)
```

### 6.8 Forca de objetivo - `securePower(state, side)`

```
p = teamSlice(team, "objective")
if jungler morto: p *= 0.7    // sem Smite carrier, o contest despenca
if capitaoVivo:   p *= 1.05
p *= goldSecureMult(team, state)    // ouro relativo, canal secundario (clamp [0.8,1.25], secao 6.5)
p *= compSecureMult(team, enemy, state)  // canal de comp secundario (clamp [0.95,1.05])
```

Usado por `baronSetupSufficient` (gate de setup do Barao), por `resolveContestedObjective`
(escolha de quem inicia a luta no poco) e por `decidePitOwner` (duelo de Smite quando a luta
termina empatada em numeros, 13.6).

### 6.9 `championMeta` e `microMetrics` - camadas de archetype

**`championMeta.ts` - frozen no build:**

`championMetaFor(championId, role)` e uma lookup pura, sem rng, sem I/O. Retorna
o `ChampionMeta` do campeo (7 campos: `primaryClass`, `functionalTags[]`,
`econProfile`, `scalingCurve`, `killBias`, `assistBias`, `deathRisk`). Se o
championId e desconhecido, usa `ROLE_DEFAULTS[role]` como fallback seguro (nunca
retorna null, nunca NaN). `NEUTRAL_META` e uma constante exportada a parte (um
valor `ChampionMeta` totalmente neutro com biases em 1.0), nao um campo do tipo,
usada como base dos defaults. O objeto e resolvido uma unica vez em
`freshPlayerState` e congelado com `Object.freeze` - o archetype e imutavel
durante a partida.

**`microMetrics.ts` - 3 camadas:**

- **Camada 1 - `baseMetrics(card)` (frozen):** le so o card (sem estado de
  partida). Deriva os 18 campos de `MetricsBase` a partir de `lanePhase`,
  `midGame`, `lateGame`, `traits` e `advanced`. Cacheavel e congelada no build.
- **Camada 2 - `overlayChampion(base, meta, mastery)` (frozen):** tempera a
  camada 1 com o archetype do campeo, modulado pela maestria (1-5). Usa lift
  relativo ao teto do jogador. Com `NEUTRAL_META` e qualquer maestria, retorna
  exatamente `base` (INV-2). Tambem cacheavel; congelada em `freshPlayerState`.
- **Camada 3 - `contextMetrics(base, p, state)` (recomputada sob demanda):**
  herda `MetricsBase` e acrescenta 3 campos dependentes de estado vivo:
  `jungleAttentionReceived`, `comebackThreat`, `mapControl`. **Nunca cacheada**
  em `PlayerState` - recomputar a cada consulta e obrigatorio para garantir
  determinismo sem corrompimento de estado.

Os 18 campos de `MetricsBase`:
- KDA/Selecao (5): `killShareBias`, `deathRisk`, `assistBias`, `burstThreat`, `pickThreat`
- Luta (4): `damageThreat`, `engageScore`, `peelScore`, `frontLineScore`
- Lane/Map (6): `laneVolatility`, `weaksideTolerance`, `resourceDemand`, `objectiveSetup`, `visionScoreInternal`, `siegeThreat`
- Macro (3): `scalingCurve`, `throwRisk`, `carryPotential`

`microMetrics` alimenta o canal de ouro (`goldFightMult` le `p.metricsBase.scalingCurve`),
`laneState` (`computeStrongsideScore` le `scalingCurve` e `weaksideTolerance`) e
os priors de selecao (`killerScore`/`victimScore` em `selection.ts` consomem
`metricsBase.damageThreat` e outros). Nao e chamada diretamente nos resolvers de
luta (so indiretamente via esses canais).

---

## 7. O estado da partida (matchState.ts)

`MatchState` e um objeto TS mutavel (sem Zod). Campos:

### 7.1 Topo

| Campo | Tipo | Significado |
|---|---|---|
| `gameTimeSec` | number | relogio de jogo |
| `phase` | `early`/`mid`/`late` | fase inferida (ver `computePhase`) |
| `user`, `rival` | `TeamState` | os dois times |
| `objectives` | `ObjectiveState` | janela viva de "o que pode acontecer agora" |
| `buffs` | `BuffState` | expiracao de Baron/Elder por lado |
| `pressure` | `Record<Lane, number>` | pressao de lane assinada (+user), -100..100 |
| `mapControl` | number | edge de controle/visao assinado (+user) |
| `momentum` | number | momentum psicologico assinado (+user) |
| `winProbUser` | number | probabilidade do user [0,1] (INDICADOR) |
| `firstBloodDone`, `firstTurretDone` | bool | marcos de bonus de ouro |
| `lastFightSec` | number | tempo da ultima luta cheia (o reset entre lutas, `fightResetSec`, conta a partir dele) |
| `objectivePrep` | `Record<Side, Record<ObjectiveKind, number>>` | preparo de cada objetivo por lado, de 0 a 100 (12-a) |
| `prepAnnounced` | `Record<Side, Record<ObjectiveKind, boolean>>` | o aviso `objective_setup` ja saiu neste nascimento do objetivo, por lado |
| `lastFightWon` | `{ side, place, atSec }` ou null | ultima luta ou pick com vencedor: escolhe a rota da janela de conversao e o texto do evento (13.6) |
| `lastAnyStructureDestroyedAtSec` | number ou null | freio global: uma estrutura por tick, de qualquer lane |
| `comebackElasticity` | number | o slider de **Caos** (config; padrao 0.25). Entra no sorteio de luta e na recompensa de objetivo via `effectiveChaos` (13.1, 13.4) |
| `tuning` | `RealismTuning` | parametros calibraveis resolvidos do config (`SimConfig.tuning` sobrescreve o padrao) |
| `ratingPowerD` | number ou null | inclinacao da curva de rating (6.6); padrao 140 |
| `ended`, `winner` | | fim de jogo |

> Escalares assinados (`+user`, `-rival`) evitam duplicar arrays por time.

### 7.2 `TeamState`

`players` (por rota), `gold` (**soma do ouro dos 5 jogadores**: todo credito passa por
`creditPlayer`/`creditTeamSplit` em `economy.ts`, nunca ha duas contas), `kills`, `deaths`, `towersDestroyed`,
`inhibitorsDestroyed`, `structures` (por lane), `structureDamage` (pool de dano de 0 a 100 por
torre e por lane, mais os contadores de placas ja coletadas, `outerPlates`, `innerPlates` e
`inhibTurretPlates`, de 0 a 5; secao 13.5), `nexusTurretsAlive` (0..2),
`nexusExposed`, `dragons[]`, `soul`, `elderCount`, `voidgrubs` (0..3, leva unica),
`heraldTaken`, `heraldUsed`, `baronsTaken`.

Campos novos em v1.1:

| Campo | Tipo | Significado |
|---|---|---|
| `laneState` | `Record<Lane, LaneStateEntry>` | vantagem persistente por lane (9 campos cada) |
| `compProfile` | `CompProfile` (frozen) | perfil de composicao derivado uma vez no build |

Ouro inicial: **2500** por time (5 x 500).

### 7.3 `PlayerState`

`card`, `role`, `kills`, `deaths`, `assists`, `gold` (comeca 500), `alive`,
`respawnAtSec`, `bounty` (acumulado, pode ser negativo ate -200), `shutdownGold`
(derivado do bounty: o que o abatedor recebe agora, 0 abaixo de 150 e no maximo 700),
`hasBaronBuff`, `hasElderBuff`, `isCaptain`.

Campos novos em v1.1:

| Campo | Tipo | Significado |
|---|---|---|
| `metricsBase` | `MetricsBase` (frozen) | 18 metricas de camadas 1+2 (card + archetype) |
| `meta` | `ChampionMeta` (frozen) | archetype do campeo do slot atual |
| `flashUp` | boolean | Flash disponivel (padrao true; false ate cooldown) |
| `flashCooldownUntilSec` | `number | null` | quando o Flash retorna (null = disponivel) |
| `away` | boolean | true enquanto saiu da partida pelo `quits`; conta 0 em `teamSlice`, `laneLaningPower` e `bestPlayer`. No snapshot, `respawnInSec` fica null enquanto fora, entao quem assiste nao sabe se ele volta |
| `quitTrack` | rastro do `quits` | so em quem tem a trait |

### 7.4 `LaneStructures`

`outerAlive`, `innerAlive`, `inhibTurretAlive`, `inhibitorAlive`,
`inhibitorRespawnAtSec`. Todas comecam vivas.

### 7.5 Derivados puros (views read-only)

`opponent`, `teamOf`, `computePhase`, `goldDiff`, `towersStanding`, `towerDiff`,
`aliveCount`, `dragonDiff`, `hasBaronBuff`, `hasElderBuff`,
`aliveBaronBuffHolders`, `aliveElderBuffHolders`, `hasLivingCaptain`,
`phaseBlend`, `recomputeDerived`, `formatGameClock`.

`computePhase`: vira `late` se `t >= 25:00` **ou** algum inibidor caiu **ou**
existe soul **ou** algum Baron foi tomado; vira `mid` se `t >= 14:00`; senao
`early`.

---

## 8. Timers e constantes

Fonte unica da verdade (`TIMERS` em `matchState.ts`), seguindo as regras do Summoner's Rift
do **patch 26.1** (janeiro de 2026) onde elas mexem no calendario (ver pesquisa.md e as
fontes da spec de calendario e volume, secao 6):

| Constante | Valor (s) | Significado |
|---|---|---|
| `DRAGON_FIRST_SPAWN` | 300 | 1o dragao elemental aos 5:00 |
| `DRAGON_RESPAWN` | 300 | respawn 5:00 apos morte |
| `SOUL_DRAGON_COUNT` | 4 | soul no 4o dragao do time |
| `ELDER_FIRST_SPAWN_AFTER_SOUL` | 300 | patch 26: o 1o Elder nasce 5:00 depois da Alma |
| `ELDER_RESPAWN` | 360 | Elder respawn 6:00 depois da tomada |
| `ELDER_BUFF_DURATION` | 150 | buff de Elder dura 2:30 |
| `VOIDGRUBS_SPAWN` | 480 | patch 26: uma leva so, de 3 larvas, aos 8:00, sem respawn |
| `VOIDGRUBS_DESPAWN` | 885 | o acampamento some aos 14:45 |
| `HERALD_SPAWN` | 900 | patch 26: Arauto aos 15:00 (uma vez) |
| `HERALD_DESPAWN` | 1185 | some aos 19:45 |
| `BARON_SPAWN` | 1200 | Baron NUNCA antes de 20:00 |
| `BARON_RESPAWN` | 360 | respawn 6:00 |
| `BARON_BUFF_DURATION` | 180 | Hand of Baron dura 3:00 |
| `INHIBITOR_RESPAWN` | 300 | inibidor volta 5:00 depois |
| `MID_PHASE_AT` | 840 | corte de fase mid (14:00) |
| `LATE_PHASE_AT` | 1500 | corte de fase late (25:00) |

Ouro (todos em ouro real, `economy.ts`; sem multiplicador de escala):

| Constante | Valor | Significado |
|---|---|---|
| `STARTING_GOLD_PER_PLAYER` | 500 | ouro inicial por jogador (2500 por time) |
| `KILL_GOLD` | 300 | abate; o piso de um abate e `MIN_KILL_GOLD` 100 |
| `FIRST_BLOOD_GOLD` | 400 | primeiro sangue (no lugar dos 300) |
| `ASSIST_SHARE` | 0.5 | assistencias dividem metade do ouro do abate |
| `TOWER_GOLD` | externa 0, interna 0, do inibidor 0, do Nexus 50, inibidor 50 | creditado ao time. Patch 26: a torre de rota nao paga ao cair, porque o ouro dela vem nas 5 placas e a 5a placa e a queda |
| `FIRST_TURRET_BONUS` | 300 | bonus da 1a torre do jogo |
| `PLATE_BASE_GOLD` / `PLATE_MIN_GOLD` | 120 / 80 | cada placa vale 120 ate 11:00, perde 10 por minuto completo depois e chega a 80 em 15:00 (`plateGold(t)`) |
| `EPIC_GOLD_PER_PLAYER` | 150 | Barao e Elder: para cada jogador do time, vivo ou morto |
| `EPIC_SECURE_GOLD` | 100 | Barao e Elder: a mais para quem confirma (`objectiveSecurer`) |
| `DRAGON_SECURE_GOLD` | 75 | dragao elemental, so para quem confirma |
| `GRUB_GOLD` | 30 | cada larva do Vazio, so para quem confirma |
| `HERALD_SECURE_GOLD` | 100 | Arauto, so para quem confirma |
| `BOUNTY_PAYOUT_CAP` | 700 | shutdown paga no maximo isto; o excedente fica para a proxima vida |
| `SHUTDOWN_MIN_BOUNTY` | 150 | abaixo disso o abate nao e shutdown |

"Quem confirma" (`objectiveSecurer`, `objectives.ts`) e o jungler vivo; com ele morto, o
jogador de melhor fatia `objective` do time, com os vivos valendo 1 e os mortos 0.2 (a mesma
regra do texto do evento). O ouro dos objetivos e creditado em `takeObjective` (10.3); o da
torre e da placa, em `damageStructure` e `collectPlates` (13.5).

Config (`DEFAULT_SIM_CONFIG`):

| Campo | Default | Significado |
|---|---|---|
| `tickSeconds` | 15 | segundos de jogo por tick |
| `comebackElasticity` | 0.25 | o slider de **Caos** ("o quanto a partida pode virar") |
| `upsetNoise` | 0.2 | amplitude de ruido (reservado) |
| `ratingPowerD` | 140 | inclinacao da curva de rating (era 525; secao 6.6) |
| `tuning` | ausente | sobrescreve campos de `RealismTuning` (varredura de calibracao) |

> `comebackElasticity` e sobrescrito por `input.chaosLevel` em `runMatchEngine`. O valor
> efetivo (mais a volatilidade media dos jogadores) e o `effectiveChaos` de `tuning.ts`
> (ver secoes 13.1 e 13.4).

---

## 9. O loop de tick

`simulateMatch(userRoster, rivalRoster, rng, config, opts)` em `engine.ts`.
Tick = `config.tickSeconds` (15s). Cap de seguranca: **60 min**.

A cada tick:

```
state.gameTimeSec += tick

1. Atualizacoes dirigidas pelo tempo
   updateObjectiveTimers(state, rng)   // nasce/morre epico, respawn inib, expira buff
   processRespawns(state)              // mortos cujo respawnAtSec chegou voltam; quem estava fora
                                       // pelo `quits` (away) tambem volta aqui, e vira um evento
                                       // player_returned que ABRE a lista de eventos do tick
   passiveIncome(state, tick)          // farm passivo em ouro real (vivos, 9.1)

2. Estado derivado
   decayLaneState(state)               // LANE-02: decai antes de recomputePressure ler
   recomputeDerived(state)             // fase
   recomputePressure(state)            // pressao de lane (le laneState.laneLead)
   decayMomentum(state)                // momentum *= 0.85; mapControl *= 0.9
   accrueSiegePressure(state)          // canal de cerco: so ate 14:00 e so torre externa (13.5)
   accrueLaneSignals(state)            // recheio narrativo do early game

3. Intencoes
   userIntent  = chooseIntent(state, "user", rng)
   rivalIntent = chooseIntent(state, "rival", rng)

4+5. Resolucao -> eventos com impacto aplicado
   events = resolveInteraction(state, userIntent, rivalIntent, rng)
            // passo 0b: a janela de conversao toma o tick antes das intencoes (secao 12)
            // passo (a): preparo e tentativa de tomada de objetivo (resolveObjectiveSetup)

4+5 (fim). Sorteio de quit
   rollPendingQuits(state, rng)        // passo NOVO e ULTIMO do tick: o `quits` pendente sorteia
                                       // se sai (quitChance, depois a volta e o atraso). Vem depois
                                       // de todos os outros sorteios; os eventos player_quit fecham
                                       // a lista. Sem `quits` na partida: nenhum sorteio (T-02)

6+7. Finaliza cada evento
   para cada ev: recalcula winProb, grava em ev.winProbUserAfter, push na timeline
   se ev.kind == "gg": state.ended = true
```

**Ordem critica no step 2:** `decayLaneState` e chamada ANTES de `recomputePressure`.
`recomputePressure` le `laneState.laneLead` (que acabou de decair). Inverter a
ordem mudaria o comportamento sem quebrar o determinismo (mas documentaria um bug).

**A ordem do tick nao mudou na spec de calendario e volume.** O que mudou foi o conteudo do
passo 4+5: `resolveInteraction` agora comeca o passo (a) pelo **preparo de objetivo**
(`resolveObjectiveSetup`, que atualiza `objectivePrep`, emite o aviso `objective_setup` e decide
se ha tentativa de tomada; secao 12-a), e os passos (c) de luta e pick passam pelos filtros de
prontidao (`teamfightAllowed`, `junglerReady`, `laneAllInChance`; secao 12-c). Nenhum passo novo
entrou no loop e nenhum consome sorteio fora de `engine.ts`.

Se o cap estourar sem Nexus: termina pelo lado com maior win prob (`finishGame`).

### 9.1 `passiveIncome`

Por jogador **vivo** (mortos nao farmam), em ouro real, creditado por `creditPlayer`
(que mexe no jogador e no time juntos). Formula em `economy.passiveGoldPerMinute`:

```
perMin = (passiveBasePerMin + passiveSlopePerMin * minuto)      // 240 + 3.5 * min
         * PASSIVE_ROLE_SHARE[role]                             // adc 1.12, mid 1.06, top 1.00, jungle 0.88, support 0.60
         * laningFarmFactor(laningSlice)                        // 1 + (laning - 75)/250
         * (1 + clamp(laneLead, -60, 60) / 600)                 // lead da rota do jogador (jungle: 0)
credito do tick = round(perMin * tickSeconds / 60)
```

A vantagem de rota (`laneState[lane].laneLead`; adc e support usam a rota `bot`) acrescenta
farm a quem esta ganhando a rota, ate +-10%. As duas bases (`passiveBasePerMin`,
`passiveSlopePerMin`) sao tuning: valores finais em 17 e calibracao em
`docs/diagnostics/luta-mapa-vitoria-calibracao.md`, secao 1. O objetivo e o GPM medio por time
perto de 1.830 (real) sem multiplicador de escala; `goldScale` e `scaleGold` foram removidos.
Com o ouro de torre e de objetivo do patch 26 (secao 8), a inclinacao subiu de 2.5 para 3.5 na
calibracao do calendario e volume (secao 6 do registro), para o GPM e as bandas de ouro
continuarem dentro da regua.

### 9.2 `respawnSeconds(state, rng)` - respawn cresce com o tempo

```
base = 8 + minutos*1.6
return clamp(base + rng*4, 8, 70)   // 8s..70s
```

---

## 10. Objetivos: timers e regras duras (objectives.ts)

Duas responsabilidades, ambas puras (mutam o estado passado, sem I/O).

### 10.1 `updateObjectiveTimers(state, rng)` (1x por tick)

- **Dragao:** nasce quando o timer de (re)spawn passa e nenhum esta vivo. Os 2
  primeiros drakes sao de **elementos diferentes** (`pickElementExcept` via
  `lastSpawnedElement`, que sobrevive ao take). A partir do 3o, so o elemento do
  soul nasce. O soul e um **3o tipo distinto** dos dois primeiros
  (`pickElementExceptMany`).
- **Voidgrubs (patch 26):** leva **unica** de 3 larvas aos 8:00 (`VOIDGRUBS_SPAWN` 480), sem
  respawn. O camp some de vez aos 14:45 (`VOIDGRUBS_DESPAWN` 885), e tambem quando as larvas
  sao tomadas (nao ha 2a leva).
- **Arauto (patch 26):** nasce aos 15:00 (uma vez), some aos 19:45 se intocado. Nunca
  coexiste com Baron.
- **Baron:** nasce no timer **e** nunca antes de 20:00.
- **Elder:** nasce so se `elderUnlocked` (algum time tem soul). Patch 26: o **1o** nasce
  5:00 depois da Alma (`ELDER_FIRST_SPAWN_AFTER_SOUL` 300); os seguintes, 6:00 depois da
  tomada (`ELDER_RESPAWN` 360).
- **Inibidor:** respawn 5:00 apos queda (`respawnInhibitors`).
- **Buffs:** `expireBuffs` zera Baron/Elder do lado quando o tempo passa, e
  remove o flag de cada jogador.

### 10.2 Legalidade - as regras DURAS

`isObjectiveAvailable(state, kind)` responde se o epico esta vivo E dentro da
janela legal. `canStealObjective` exige `attemptingSide != null` E
`contesting == true`: **steal nunca e evento aleatorio livre.**

### 10.3 Aplicar um take - `takeObjective` / `stealObjective`

**LANCAM ERRO** se o objetivo nao esta disponivel / steal ilegal. Isso garante
que um evento impossivel nunca chega na timeline. Efeitos:

- **dragon:** empilha elemento, `dragonsTaken++`, agenda respawn (+5:00). No 2o
  dragao, trava o `soulElement`. No 4o do time: concede `soul`, destrava Elder
  (agenda +5:00, patch 26), e para de nascer drake elemental. Ouro: 75 para quem
  confirma (`DRAGON_SECURE_GOLD`).
- **elder:** agenda respawn (+6:00), `elderCount++`, buff de 150s para os vivos. Ouro (patch
  26): **150 para cada jogador do time, vivo ou morto**, e mais **100 para quem confirma**
  (`EPIC_GOLD_PER_PLAYER`, `EPIC_SECURE_GOLD`).
- **voidgrubs:** soma grubs (cap 3 por time em `voidgrubs`); leva unica, o camp nao volta.
  Ouro: 30 por larva, para quem confirma (`GRUB_GOLD`).
- **herald:** marca `heraldTaken`, nunca volta. Ouro: 100 para quem confirma
  (`HERALD_SECURE_GOLD`).
- **baron:** agenda respawn (+6:00), `baronsTaken++`, Hand of Baron de 180s para
  os vivos. Ouro (patch 26): **150 para cada jogador do time, vivo ou morto**, e mais
  **100 para quem confirma** (antes eram 300 para cada jogador vivo).

**Quem confirma - `objectiveSecurer(team)`.** E o jungler vivo; com ele morto, o jogador de
melhor fatia `objective` (os vivos valem 1 e os mortos 0.2, `bestPlayer` em `power.ts`). O
mesmo jogador aparece como ator no aviso `objective_setup` e no texto do evento, entao o ouro
e o nome da linha nunca divergem.

Toda tomada (e todo roubo, que passa pelo mesmo `takeObjective`) paga, ANTES do efeito,
a **recompensa de objetivo** (`objectiveBountyGold`, secao 13.4) ao time que esta atras no
ouro. Quem decide o dono de um objetivo disputado e a luta no poco (13.6), nao um sorteio
anterior a ela.

---

## 11. Selecao de intencao de macro (chooseIntent)

O "cerebro" de cada time: um **sorteio ponderado** entre intencoes, lido do
estado vivo. Catalogo de `MacroIntent`:

```
farm | press_top | press_mid | press_bot | gank | invade |
setup_dragon | setup_voidgrubs | setup_herald | setup_baron | setup_elder |
force_fight | pickoff | defend_base | cross_map | siege_baron | split_push | use_herald
```

`AGGRO_INTENTS = { force_fight, pickoff, gank, invade }`.

### 11.1 Pesos base e contexto

```
winProb (do lado) -> behind = <0.45 ; ahead = >0.55

Pesos iniciais:
  farm 4.0   press_top/mid/bot 0.45 cada    // farm DOMINA o tick normal

Objetivos vivos enviesam o setup:
  dragon preparavel    -> setup_dragon  += 2 + botMidPrio/60     // vivo, ou (2o dragao em diante)
                                                                 // a ate 60 s do respawn (12-a)
  voidgrubs disponivel -> setup_voidgrubs+= 1.5 + topMidPrio/80
  herald disponivel    -> setup_herald  += 1.8 + topMidPrio/80
  elder disponivel     -> setup_elder   += 3
  baron disponivel     -> setup_baron   += ahead ? 2.6 : 1.4
  segura Arauto         -> use_herald    += 2.5

  botMidPrio = objective + laning(bot) + laning(mid)
  topMidPrio = laning(top) + laning(mid)
```

### 11.2 Macro dirigida por buff

```
segura Elder           -> force_fight +4 ; siege_baron +1.5
segura Baron           -> siege_baron +4 ; force_fight +1.5 ; pickoff +2.2
segura Baron E Elder   -> force_fight +3 ; siege_baron +2
```

### 11.3 Ahead / behind

```
ahead  -> pickoff +0.8 ; force_fight +0.5 ; press_mid +0.6
behind -> pickoff +1.0 ; cross_map +1.2 ; defend_base +1.0 ; split_push +0.8
```

### 11.4 Late game

```
late -> force_fight +0.7 ; setup_baron +1.5 (se disponivel)
```

### 11.5 Early game (lane + jungle, NAO 5v5)

```
para cada lane com edge>0 (laning proprio - inimigo):  press_<lane> += edge/30
jungler vivo: gankThreat = jglSkirmish*0.5 + melhorLanePrio*0.5
              se gankThreat>55: gank += 0.8 + (gankThreat-55)/45
```

**O gank so existe depois do 1o clear do jungler** (spec calendario e volume, secao 2). Depois de
todos os vieses de 11.1 a 11.7 (para nenhum deles reabrir o gank), `chooseIntent` zera o peso de
`gank` do lado enquanto `junglerReady(state, side)` for falso. O relogio e
`junglerFirstClearSec(card)` em `readiness.ts`:

```
clear = clamp(190 - (lanePhase - 75) * 0.6, 170, 225)    // segundos; os campos nascem aos 0:55
```

Um jungler de `lanePhase` 75 termina aos 3:10 (190 s); um de 100, aos 2:55 (175 s); um de 50,
aos 3:25 (205 s). O teto de 225 s (3:45) so atua com `lanePhase` de 16 ou menos, e o piso de
170 s nao e alcancavel com `lanePhase` ate 100 (existe como guarda). O relogio e por lado e le o
jungler que comecou a partida. Depois dele o gank volta com o peso de sempre (forca do jungler
e prioridade de rota), mas a chance de cada gank dar abate pesa `earlyPickScale` ate 14:00 (12-c).
Antes dele, a unica agressao que vira abate e o all-in de rota (12-c).

### 11.6 Contra Elder inimigo (evitar o 5v5)

```
se inimigo tem Elder e voce nao:
  force_fight = 0   // zera
  pickoff +2.8 ; defend_base +2.0 ; cross_map +1.5 ; split_push +1.0
```

### 11.7 Vieses de composicao - `applyCompIntentBiases`

Chamada depois de todos os outros vieses (muta `weights` diretamente, sem draw
de rng). Escala o bias pelo score normalizado da tag dominante:

```
dive/engage/wombo -> force_fight +0.5..+0.7 ; setup_baron/setup_elder
poke/siege        -> press_mid/bot ; siege_baron
split             -> press_top ; split_push ; cross_map
pick              -> pickoff ; cross_map
scaling           -> farm +0.5
```

O vencedor sai de `weightedPickIntent` (roleta com o `rng`).

---

## 12. Resolucao de interacao (resolveInteraction)

O coracao da engine. Ordem de prioridade (a primeira que dispara retorna):

### (0) Finish

Nexus inimigo exposto + >=2 vivos do lado atacante -> fecha rapido
(`resolveStructurePressure` com forca total). Nunca deixa um Nexus exposto
stallar ate o cap.

### (0b) Janela de conversao

Depois do Finish e ANTES de qualquer intencao: se `conversionSide(state)` devolve um lado
(mais gente viva que o outro e pelo menos 3 vivos), o tick e dele e as duas intencoes
sorteadas ficam sem efeito. `resolveConversion` converte a vantagem em Barao ou Anciao,
dragao, Arauto ou larvas, ou torre. Detalhes na secao 13.6.

### (a) Preparo, aviso e tentativa de tomada

`resolveObjectiveSetup` (`engine.ts`) usa as funcoes puras de `readiness.ts`. Ele roda em todo
tick que a janela de conversao (0b) nao tomou, e e ele que faz o objetivo deixar de cair "no
cronometro": o time prepara antes (visao, prioridade de rota, Smite pronto) e so depois tenta
tomar (spec calendario e volume, secao 4).

O passo (a) so e alcancado depois de (0) Finish e (0b) a janela de conversao, e os dois **retornam
antes dele**: num tick em que o Finish fecha o Nexus ou a janela de conversao age, o
`resolveObjectiveSetup` nao roda e o preparo nao muda (nem sobe, nem decai, nem zera).

**Quais objetivos aceitam preparo - `isObjectivePreparable`.** Os que estao vivos. **Emenda 2 de
2026-10-02:** a partir do **2o dragao elemental**, o preparo tambem cresce nos ate 60 s antes do
respawn (`DRAGON_PRESPAWN_PREP_SEC`), porque no meio de jogo os times ja agrupados montam visao
antes. O 1o dragao so aceita preparo vivo. A **tomada continua exigindo o objetivo vivo**:
preparo cheio antes do respawn so adianta o relogio, nao toma nada.

**Ganho e decaimento - `updateObjectivePrep`.** O lado que sorteou `setup_<kind>` num objetivo
preparavel ganha `prepGain` neste tick (teto 100); o lado que sorteou outra coisa perde
`prepDecay` (piso 0: perde visao e prioridade):

```
prepGain = prepRate(kind)                                  // prepRateMinor 17 (dragao, larvas, Arauto)
                                                           // prepRateEpic 28 (Barao, Elder)
         * max(0.25, 1 + prioEdge / prepPrioScale)         // vantagem de laning nas rotas do poco
         * (1 + controleDeMapaDoLado / 200)                // mapControl do lado, fator de 0.5 a 1.5
         * (jungler vivo ? 1 : 0)                          // sem jungler, nao avanca
         * (aliveCount >= aliveCount do inimigo ? 1 : 0)   // com gente a menos, nao avanca
prioEdge = soma de laneEdge() nas rotas do poco: bot + mid (dragao, Elder), top + mid (larvas, Arauto, Barao)
```

O que precisa ser mais lento no Barao e no Elder e o **tempo de preparo** (do nascimento ao
aviso), nao a taxa por tick: os times escolhem preparar o Barao bem menos vezes que o dragao,
entao a taxa por tick do epico pode ser maior (28 contra 17), e o gate confere que o tempo
medido continua maior (`baronSetupDelaySec > dragonSetupDelaySec`, secao 16.7). Quem domina as
rotas prepara mais rapido, entao jogo parelho demora mais.

O preparo **zera**, e o aviso **rearma**, quando o objetivo deixa de ser preparavel: foi tomado,
sumiu (larvas aos 14:45, Arauto aos 19:45) ou, no dragao, ainda esta longe do respawn.

**Aviso de preparo.** Quando o preparo de um lado chega a 50 ou mais (`PREP_ANNOUNCE_AT`), sai o evento
`objective_setup`, no maximo uma vez por lado, por objetivo e por nascimento: "O <time> comeca a
preparar o <objetivo>." O ator e quem confirma (`objectiveSecurer`). O evento esta no `EventKind`
(`simEvents.ts`) e no contrato persistido (`types.ts`) e nao mexe em placar, ouro nem win prob.

**Tentativa de tomada - `takeAttempt`.** Tenta o lado que escolheu preparar um objetivo **vivo**
e tem o preparo dele em 100 (`PREP_FULL`). Com os dois lados prontos em objetivos diferentes,
vai o de maior prioridade (Barao, Elder, dragao, Arauto, larvas). Depois:

- **O outro lado tambem esta no poco** (prepara o mesmo objetivo neste tick, ou ja tem preparo de
  pelo menos 50) -> `resolveContestedObjective`. **A disputa acontece na tentativa:** os dois
  times preparando o mesmo objetivo ate encher viram luta no poco, o objetivo sai e o motor nao
  trava num impasse.
  - `securePower` (com ruido +-20%) so escolhe quem inicia a luta no poco; como
    `resolveTeamfight` nao da bonus de iniciador, isso so desempata poder igual.
  - Luta no poco (`resolveTeamfight` com `silentIfNoKills`).
  - `settlePitOwner`: quem sai com mais gente viva leva (`decidePitOwner`); com numeros
    iguais decide o duelo de Smite (`securePower` + sorteio). O outro time, enquanto tiver
    alguem vivo, ainda rola o **roubo**, com chance `stealChanceFor * conversionStealFactor(diferenca)`;
    `stealChanceFor` vale 0.02 quando o jungler dele esta morto (so um acaso raro) e, com o jungler
    vivo, parte do campo de tuning `stealBase` (0.04; 13.6).
  - Aplica o objetivo ao dono, bumpa momentum (+26 baron/elder, +16 outros), emite evento
    (+ soul se concedido).
- **O outro lado nao esta no poco, mas esta em intencao AGGRO** -> sem tomada neste tick.
- **Barao:** a trava `baronSetupSufficient` continua (confirmador, 3 vivos, contexto recente).
- **Senao** -> `resolveUncontestedObjective` (take limpo, momentum +18 baron/elder, +10 outros).

Medido no ponto final (N=1500): o 1o aviso de preparo sai 75 s depois de o dragao nascer e 150 s
depois de o Barao nascer (medianas); 8.5% dos avisos de dragao saem antes do respawn; o 1o dragao
cai na mediana aos 7:45 (465 s).

### (b) Uso de Arauto

`use_herald` com Arauto na mao -> `resolveHeraldUse`: bate na lane de maior
pressao; emite o **kind estrutural real** (`tower_destroyed`/etc.) com sabor de
Arauto no ticker.

### (c) Lutas e picks

Spec calendario e volume, secoes 2 e 3: cada canal so dispara com o motivo real. Tres filtros
novos entram antes do sorteio de qualquer abate: o **reset** entre lutas, o **motivo** de luta e
o **1o clear** do jungler.

**(c0) Luta 5v5 - `teamfightAllowed(state, userIntent, rivalIntent)`:**

```
ready     = (gameTime - lastFightSec >= fightResetSec(state))          // reset
            E aliveCount(user) >= minAlive E aliveCount(rival) >= minAlive
            E junglerReady(user) E junglerReady(rival)                  // os dois clears feitos
triggered = force_fight de qualquer lado OU (ambos AGGRO E fase != early)
motivo    = fightReason(state) OU effectiveChaos(state) >= fightAnywhereChaos

se ready E triggered E motivo -> resolveTeamfight(initiator)

fightResetSec = base da fase / bloodScale(state)     // early 220, mid 240, late 150 (tuning)
minAlive: early 4, mid/late 3
```

- **Reset.** Os intervalos entre lutas viraram tuning (`fightResetEarly`, `fightResetMid`,
  `fightResetLate`, secao 17) e substituem `FIGHT_COOLDOWN_BY_PHASE` (220/100/50 s). Modelam os
  times voltando para a base, comprando e reagrupando, e concentram as lutas em volta de
  objetivos. O Caos encurta o intervalo (divide por `bloodScale`, 13.1).
- **Motivo - `fightReason(state)`** (`readiness.ts`; janela de 60 s em `FIGHT_REASON_WINDOW_SEC`).
  Basta um destes ser verdadeiro:
  - dragao vivo, ou a ate 60 s de nascer;
  - Elder vivo, ou (com Elder liberado) a ate 60 s de nascer;
  - Barao vivo, ou a ate 60 s de nascer;
  - Arauto ainda nao resolvido, de 14:00 (60 s antes do spawn) ate 19:45;
  - algum time com buff de Barao ou Elder;
  - **torre sob cerco** (`towerUnderSiege`): alguma torre de qualquer lado com o pool de dano em
    70 (`TOWER_LOW_THRESHOLD`) ou acima e dano recebido nos ultimos 60 s.
- **Caos alto (emenda 2 de 2026-10-02).** Com o caos efetivo em `fightAnywhereChaos` (0.9) ou
  mais, o motivo e dispensado: os times brigam em qualquer lugar, como em solo queue. Isso
  equivale ao slider acima de cerca de 0.88 (o caos efetivo soma cerca de 0.017 de volatilidade).
  No Caos padrao (0.25) nada muda.
- **Sem motivo,** a agressao nao vira luta cheia: cai nos filtros abaixo (all-in, pick) ou nao
  da em nada. No early o 5v5 continua exigindo `force_fight` explicito; agressao mutua resolve
  como pick, e isso agora so depois do 1o clear.

O `initiator` e quem deu `force_fight` (senao sorteio).

**(c1) All-in de rota antes do clear - `laneAllInChance`, `resolveLaneAllIn`.** Enquanto o
jungler de um lado nao termina o 1o clear (11.5), a agressao desse lado so vira abate por all-in
na rota: a do `press_*` escolhido, ou, numa intencao AGGRO, a de maior vantagem de laning
(`bestEdgeLane`). A chance e pequena e proporcional a vantagem de laning (`laneEdge`, a
diferenca de `laneLaningPower` entre os lados na rota):

```
chance = 0                                                      se t < 90 s ou edge <= 4
       = min(0.5, laneAllInBase * (edge - 4)/10 * bloodScale)   senao      // laneAllInBase 0.03
```

O all-in so existe a partir de **1:30** (`LANE_ALL_IN_FROM_SEC` 90), quando as rotas chegam ao
nivel 2. O laner de melhor fatia `laning` do lado abate um jogador vivo da mesma rota inimiga
(a rota de baixo tem ADC e suporte); sem jogador vivo dos dois lados na rota, nao ha evento. O
abate sai `solo_kill` (`kill` na rota de baixo), `first_blood` ou `shutdown`, passa pelo guard de
abate legal e atualiza o lane state. **Nenhum abate acontece antes de 1:30, por construcao:**
o all-in comeca em 90 s, e picks e lutas exigem o 1o clear (170 s no minimo).

**(c1b) All-in do `flips` - `flipsDuels`, `flipsWinChance`.** Logo depois do (c1) e antes dos
picks, uma chance por rota que tenha um portador de `flips` em jogo, de 1:30 a 14:00, sem exigir
o 1o clear nem vantagem minima (`flipsAllInChance` x `bloodScale` por rota). Com os dois `flips`
na mesma rota (um em cada time), sai um unico all-in, com o portador do lado `user` como
referencia. O portador sempre esta no all-in: com chance
`0,5 + edge/flipsEdgeScale + laneLead/flipsLeadScale`, limitada a [`flipsWinMin`, `flipsWinMax`],
ele mata (`resolveLaneAllIn` com `killer` fixo); senao morre (`victim` fixo, do lado de quem
venceu). Sem portador `flipsDuels` devolve lista vazia e nada e sorteado (T-02).

**(c2) Picks individuais:**

```
se userAggro E junglerReady(user) E rng < pickChance(user) -> resolvePickoff(user)
se rivalAggro E junglerReady(rival) E rng < pickChance(rival) -> resolvePickoff(rival)

base       = clamp(0.25 + edge/300, 0.1, 0.6)   // edge = mapControl do lado
ratio      = goldFightMult(lado) / goldFightMult(inimigo)
pickChance = clamp(base * clamp(ratio, 0.5, 2) * phasePickScale * bloodScale, 0.02, 0.75)
```

- `phasePickScale` vale `earlyPickScale` (0.15) ate 14:00 e 1 depois: pick e gank ficam mais
  caros no early. O fator vale para pick e gank, e a chance continua pesando controle de mapa e
  a vantagem de ouro.
- `bloodScale` (13.1) multiplica a chance: mais Caos, mais picks. O piso do clamp baixou de 0.05
  para 0.02, porque com o fator de fase de 0.15 o piso antigo desfaria parte dele.

### (d) Siege / split / press

`siege_baron` / `split_push` / `press_*` -> `resolveStructurePressure`.

---

## 13. Lutas, picks, kills e estruturas

### 13.1 Teamfight - `resolveTeamfight(initiator)`

```
w     = fightNoiseHalfWidth(state)                      // tuning.ts
      = clamp(fightNoiseBase + fightNoiseChaosCoef * effectiveChaos(state), 0.02, 0.6)
pInit = fightPower(initiator) * (1 - w + rng*2w)
pDef  = fightPower(defender)  * (1 - w + rng*2w)
winner = maior

ratio = max/min
loserDeaths  = clamp(round(1 + (ratio-1)*4 + rng*1.5 + (bloodScale-1)), 1, cap)   // decisividade; cap = maxCasualties(t)
winnerDeaths = clamp(round((1/ratio)*1.5*rng), 0, cap/2)
```

- **O sorteio e uniforme por lado, de largura `w` ligada ao Caos** (spec 2026-10-02, secao 2).
  O estado (ouro relativo, vivos, buffs, elenco) decide a luta; o sorteio so abre espaco para
  zebra. `effectiveChaos(state) = clamp(comebackElasticity + volatilidadeMedia * 0.03, 0, 1)`:
  o slider de Caos (que chega como `SimConfig.comebackElasticity`, padrao 0.25) mais a
  volatilidade media de lane dos dez jogadores (cerca de +0.017). Com os valores finais
  `fightNoiseBase` 0.375 e `fightNoiseChaosCoef` 0.48, `w` fica perto de 0.38 no slider 0,
  0.50 no padrao (0.25) e bate o teto de 0.6 por volta do slider 0.45 (o caos efetivo chega a
  0.47; dali ate 1 fica no teto).
- O ponto de partida da spec de luta, mapa e vitoria era 0.08 + 0.48 x Caos (+-20% no padrao); a
  calibracao dela (`docs/diagnostics/luta-mapa-vitoria-calibracao.md`, secoes 2b e 7) subiu a base
  para 0.255, e a calibracao final do calendario e volume
  (`docs/diagnostics/calendario-e-volume-calibracao.md`, secao 10.7.1) subiu para 0.375: com
  0.255 o favorito com gap de elenco >= 5 vencia 0.89 das partidas, acima do teto de 0.85, e
  no ponto final (expoente 1.85), o favorito com gap >= 5 vence 0.83. A janela antiga era `0.575 + rng*0.85` (+-42.5%).
- **Nao ha mais `behindBoost`.** O comeback vive so na economia (13.4).
- **Escala de sangue do Caos - `bloodScale(state)`** (`readiness.ts`, spec calendario e volume,
  secao 3). O slider de Caos tem dois efeitos: mais virada (o sorteio acima) e mais sangue:

  ```
  bloodScale = max(0.6, 1 + bloodChaosCoef * (effectiveChaos - CHAOS_REFERENCE))    // bloodChaosCoef 4.8
  ```

  Com o caos efetivo = slider + 0.017, a escala fica em 0.6 (o piso) no slider 0, perto de 1.1 no
  padrao, 2.3 no slider 0.5, 3.5 no 0.75 e 4.6 no 1. Ela usa o caos efetivo do item 1, que ja soma
  a volatilidade dos jogadores, entao jogadores volateis deixam a partida um pouco mais sangrenta.
  Ela: (1) multiplica a chance de pick, gank e all-in (12-c); (2) divide o intervalo de reset entre
  lutas (`fightResetSec`, 12-c); (3) soma `(bloodScale - 1)` ao `loserDeaths`, **antes do
  arredondamento e do teto por fase** (`maxCasualties`), e os sorteios continuam consumidos na
  mesma ordem. O piso de 0.6 garante que o Caos 0 nunca zere o sangue; o gate confere que os
  abates por partida **sobem a cada ponto do slider** e passam de 38 no slider 1 (16.7).
- O teto de baixas por fase (`maxCasualties`) e os dois draws sao SEMPRE consumidos antes do
  clamp (INV-1). Mortes aplicadas via `applyFightCasualties`; multikill/ace decorados no maior
  fragger (`decorateMultikill`); o evento `ace` so existe a partir de 8:00 (`ACE_MIN_SEC` 480 s;
  antes disso os abates saem, o evento nao).
- Pos-luta: momentum +18 no vencedor, mapControl +-14, `lastFightSec` e **`lastFightWon`**
  (`{ side, place, atSec }`) atualizados. E `lastFightWon` que a janela de conversao (13.6) usa
  para escolher a rota e escrever o texto.

### 13.2 Pickoff / gank - `resolvePickoff`

Vitima preferencialmente carry (adc/mid pesam 2x); com Baron, vies para pegar o
top inimigo. Gank e assinatura do jungler vivo. `first_blood`/`shutdown`/`gank`
conforme o caso. Momentum +8. Um pick tambem grava `lastFightWon` e, como deixa o time
com um a mais, abre a janela de conversao (13.6). A chance do pick e `pickChance`
(secao 12-c), que pesa a vantagem de ouro.

### 13.3 Aplicacao de kill - `applyKill`

Ouro real (`economy.ts`, patch 14.21 simplificado). Todo credito passa por `creditPlayer`,
que soma no jogador e no time ao mesmo tempo (time = soma dos jogadores).

```
killGold = killGoldFor(victim, isFirstBlood)
         = max(100, base + bountyPart)
  base       = 300  (400 no first blood)
  bountyPart = victim.bounty > 0 ? min(700, victim.bounty) : victim.bounty   // negativo barateia o abate
creditPlayer(killer, killGold) ; earnBounty(killer, killGold)       // bounty += round(ouro * 0.25)

assistencias: 1 a 4 aliados vivos (sorteados; assignAssists re-ranqueia, SEM rng)
  dividem round(killGold * 0.5) em partes inteiras (splitEvenly)
  cada um: creditPlayer + earnBounty  -> a assistencia entra no ouro do time

vitima: alive=false, perde buffs de epico, respawnAtSec = agora + respawnSeconds
  settleVictimBounty(victim, killGold + ouroDeAssistencia):
    bounty > 0 : zera, e o que passou de 700 fica para a proxima vida
    bounty <= 0: bounty = max(-200, bounty - round(ouroEntregue * 0.25))
  shutdownGold = bounty >= 150 ? min(700, bounty) : 0   // "shutdown" quando >= 150
```

Valores no codigo: `KILL_GOLD`, `FIRST_BLOOD_GOLD`, `MIN_KILL_GOLD`, `ASSIST_SHARE`,
`BOUNTY_PAYOUT_CAP`, `SHUTDOWN_MIN_BOUNTY` (tabela da secao 8). O bounty sobe 1 a cada 4 de
ouro ganho em abates e assistencias e desce 1 a cada 4 de ouro entregue ao morrer, com piso
em -200 (por isso um abate vale no minimo 100).

**Selecao de killer e vitima (v1.1):**

Em vez de Fisher-Yates puro, a selecao usa priors por role e archetype:

- `selectKiller(candidates, ctx, rng)`: 1 draw de rng, peso por `killerScore`
  (prior por role + archetype). Ex: assassin tem maior peso em solo_kill; ADC
  tem maior peso em comeback_fight.
- `selectVictim(candidates, ctx, rng)`: 1 draw de rng, peso por `victimScore`
  (prior por role + archetype). Ex: support e mais vulneravel em gank; top e
  mais vulneravel em dive.
- `assignAssists(candidates, ctx)`: **0 draws de rng** - re-rank deterministico
  puro. Nao consome aleatoriedade; aridade do stream intacta (INV-1).

**Soft caps de placar plausivel (`PLAUSIBLE_BAND`, `softCapDamp`):**

Cada combinacao de role + `ArchBand` (agrupamento de classe) tem bandas de
plausibilidade de K/D/A. Quando kills passa da `hiSoft`, `softCapDamp` reduz o
peso pre-draw (nao corta hard). Impede placar absurdo (ex: tank 15/0) sem cortar
o espaco de possibilidades para jogos de fiesta.

### 13.4 Recompensa de objetivo - o comeback na economia

Substitui o `behindBoost` (que dava poder de luta extra a quem estava atras na win prob e
somava com o `goldScale`). Agora o time atras no ouro ganha **ouro**, quando conquista algo
(`objectiveBountyGold`, `economy.ts`):

```
deficit = enemy.gold - team.gold                       // lido ANTES da tomada, sem sorteio
se deficit < objectiveBountyMinDeficit: 0              // 1500
base  = min(objectiveBountyCap, deficit * objectiveBountyFraction)    // teto 2500, fracao 0.05
valor = round(base * effectiveChaos(state) / CHAOS_REFERENCE)         // CHAOS_REFERENCE = 0.25
creditTeamSplit(team, valor)                           // dividido igualmente entre os 5
```

- **Quando paga:** em toda tomada de objetivo epico e de Arauto/larvas (`takeObjective`, que o
  roubo tambem usa), em torre externa, interna e do inibidor, e em inibidor (`damageStructure`).
  Placa e torre do Nexus nao pagam.
- **O Caos escala o valor.** No slider padrao (0.25) o `effectiveChaos` e cerca de 0.267, entao
  a escala e cerca de 1.07. No slider 0 sobra a volatilidade media dos jogadores (cerca de
  0.017, escala 0.07): so um caos igual a 0 desliga de fato. Este e o unico elastico de
  comeback do motor.
- O ponto de partida da spec era 25% do deficit com teto 2500. A calibracao (secoes 3 e 2b do
  registro) varreu a fracao de 0.05 a 0.35 contra a trava "vencedor atras no ouro <= 5%" e a
  banda do lider de ouro aos 25 min; com o motor da Task 4 nenhum ponto passou nas duas, e
  valeu o de menor "vencedor atras no ouro": fracao **0.05**, mantida ate o fim (secao 7). Com 0.05
  o teto de 2500 so atuaria com deficit acima de 50 mil, entao na pratica ele e inerte.
- Nao existe mais `effectiveComebackElasticity` (teto 0.45, `COMEBACK_VOLATILITY_COEF`): o papel
  da volatilidade passou para `effectiveChaos` (`CHAOS_VOLATILITY_COEF` 0.03 em `tuning.ts`).

| Parametro (`DEFAULT_REALISM_TUNING`) | Valor final |
|---|---|
| `objectiveBountyMinDeficit` | 1500 |
| `objectiveBountyFraction` | 0.05 |
| `objectiveBountyCap` | 2500 |
| `fightNoiseBase` | 0.375 |
| `fightNoiseChaosCoef` | 0.48 |

Registro: `docs/diagnostics/luta-mapa-vitoria-calibracao.md`, secoes 2, 2b, 3 e 7; o
`fightNoiseBase` foi de 0.255 a 0.375 em `docs/diagnostics/calendario-e-volume-calibracao.md`,
secao 10.7.1.

### 13.5 Estruturas - `damageStructure` (ordem de queda)

Ordem obrigatoria por lane:

```
torre externa -> torre interna -> torre do inibidor -> inibidor
-> torres do Nexus (2) -> Nexus exposto -> Nexus (gg)
```

- **Ouro por estrutura** (patch 26; creditado ao time, dividido entre os 5): a torre externa, a
  interna e a do inibidor **nao pagam ouro extra ao cair**, porque o ouro delas vem nas placas e
  a 5a placa e a propria queda (`TOWER_GOLD` 0/0/0). A torre do Nexus paga 50 e o inibidor 50. A
  1a torre do jogo rende mais 300 (`FIRST_TURRET_BONUS`). Torres de rota e inibidor pagam ainda a
  recompensa de objetivo (13.4).
- Inibidor destruido agenda respawn (+5:00).
- Nexus exposto e finalizavel de **qualquer** lane (nao stalla por respawn de
  inibidor).

**Placas do patch 26 (spec calendario e volume, secao 5).** Toda torre de rota (externa,
interna e do inibidor) tem **5 placas**, e a torre do Nexus nao tem. Nao ha mais o corte de
14:00 nem a exigencia de torre externa:

- **Limiares no pool de dano (0 a 100):** as placas caem em **10, 25, 45 e 70**
  (`PLATE_THRESHOLDS`, `platesAt(pool)`), e a 5a placa e a queda da torre em 100. Isso substitui
  o `PLATE_MULTIPLE = 20`, que so valia na externa e so antes de 14:00.
- **Evento:** `classifyStructureCrossing` emite `plate_taken` em qualquer torre de rota quando o
  pool passa um limiar, a qualquer hora. Um golpe grande que atravessa varios limiares emite
  **um** evento so, com a contagem no texto, e paga todas as placas. O `tower_low` continua no
  limiar de 70 (`TOWER_LOW_THRESHOLD`), que agora coincide com a 4a placa: quando o mesmo
  cruzamento tira a 4a placa e entra em `tower_low`, sai so o evento de placa, e o estado critico
  vai no texto ("A torre fica em estado critico.").
- **Contadores por torre:** `structureDamage[lane]` guarda `outerPlates`, `innerPlates` e
  `inhibTurretPlates` (0 a 5). `collectPlates` nunca passa de 5 por torre.
- **Ouro:** cada placa paga `plateGold(agora)` ao time (120 ate 11:00, caindo 10 por minuto
  completo depois e chegando a 80 em 15:00; secao 8). **Quando a torre cai, `damageStructure`
  paga as placas que o pool ainda nao tinha tirado** (`collectPlates` ate 5), entao uma torre que
  cai por Arauto, janela ou press depois de placas parciais paga exatamente as 5 placas no total,
  nunca mais. So a placa da torre externa mexe no lane state (`plate`, fase de rota).

**Resistencia da torre externa - `outerTurretDamageFactor(t)`.** A torre externa perde
resistencia de 11:00 a 15:00 (patch 26). O fator multiplica **todo** dano na torre externa, venha
do cerco automatico, do press de rota ou da janela de conversao (o Arauto so nasce as 15:00, quando
o fator ja vale 1):

```
fator = outerTurretEarlyFactor (0.5)        ate 11:00 (660 s)
      = linha reta de 0.5 ate 1.0           de 11:00 ate 15:00 (900 s)
      = 1.0                                 a partir de 15:00
```

E essa resistencia, e nao uma trava de horario, que segura a 1a torre: a regra dura de 7:00
(abaixo) continua valendo por baixo dela.

**Como uma torre cai (spec 2026-10-02, secao 5).** O canal proprio de cerco deixou de ser o
caminho principal:

| Fase | Caminhos |
|---|---|
| Antes de 14:00 (fase de rota) | `accrueSiegePressure` (so torre externa, pela vantagem de rota: `laneLead`, prioridade, ganks convertidos), mais a janela de conversao |
| Depois de 14:00 | 1) janela de conversao (13.6), o principal; 2) Arauto (nasce as 15:00); 3) cerco com Barao ou Anciao (intencao `siege_baron`); 4) `resolveStructurePressure` pelas intencoes de pressao e split push, que exige pressao de rota ou buff |

- `accrueSiegePressure` (`structures.ts`) **so atua antes de 14:00** (`TIMERS.MID_PHASE_AT`) e
  **so na torre externa**. Dano base `siegeAccrualBase` 1.5 (pool de 100 por torre) vezes os
  fatores de sempre (onda, comp, numeros, plausibilidade temporal, tier, buffs, freio de cascata)
  e vezes o fator da torre externa acima. Tira placa e raramente derruba a torre sozinho.
  Continua sem sorteio. O piso de 1.5 e restricao dos testes unitarios de `structures.test.ts`.
- **Removidos:** `siegeAdvantage` (bola de neve por contagem de torres, expoente 3.5, teto 4x) e
  `goldStructuralFactor` (ouro travado em +-3% no dano). A vantagem estrutural vem agora da
  janela e do ouro (via poder de luta).
- **Regra dura de 7:00 garantida por construcao:** `NO_TOWER_BEFORE_SEC = 420` e
  `holdPoolBeforeTowerWindow(poolBefore, poolAfter, t)` em `structures.ts` seguram o pool de uma
  torre logo abaixo de 100 (99.9) antes de 7:00, em TODO ponto de queda por pool:
  `accrueSiegePressure`, o caminho do gate de `resolveStructurePressure` e `resolveConversionPush`.
  Nao e margem de calibracao, e garantia: o gate `calibrate:realism` mede zero violacao.
- **Calendario da 1a torre.** A trava antiga (mediana da 1a torre em [8:00; 20:00]) saiu e a regua
  ganhou bandas mais estreitas: mediana em [14:30; 18:30] (referencia 16:34) e p10 de pelo menos
  12:00 (13:15), alem de torres aos 15 e aos 20 min (16.7). No ponto final a mediana e 14:30 (870 s)
  e o p10, 12:30.

`resolveStructurePressure` exige forca real para derrubar:

```
lane = press_<x> fixa, senao bestPressureLane
pressure = pressao do lado naquela lane
baron = hasBaronBuff(side)
lateRamp = max(0, (gameTime - 2100)/900)   // +0 aos 35:00, +1 aos 50:00

force = nexusExposed ? 1
        : pressure/100 + (baron?0.5:0) + voidgrubs*0.04 + lateRamp

se force <= 0.18 OU rng > force: nao acontece nada
```

O `lateRamp` garante que nenhuma partida stalle ate o cap: tarde, bases caem facil.

Passando o gate, o dano no pool da torre sai de `computeStructureDamage` com **base
`pressSiegeBase`** (campo de tuning, 27; era o literal 27 do codigo), vezes os fatores de onda,
ameaca, numeros, plausibilidade temporal, tier, buff e freio de cascata, e vezes o fator da
torre externa de 13.5. O campo existe para a varredura medir o press, e a medicao mostrou o
contrario do esperado: mais press **nao** aumentou as torres por partida (encurtou a partida, e as
torres cairam), entao o valor ficou em 27 e o campo serve so para a reproducao das varreduras
registradas (`calendario-e-volume-calibracao.md`, secoes 6, 8 e 10).

### 13.6 Janela de conversao

Arquivos: `src/sim/conversion.ts` (decisoes puras, sem rng) e `resolveConversion` /
`resolveConversionObjective` / `resolveConversionPush` / `decidePitOwner` / `settlePitOwner` em
`engine.ts` (quem sorteia e aplica). Spec de luta, mapa e vitoria, secao 4, com as regras da
spec de calendario e volume (secao 4 e emendas). A ideia do LoL: luta ou pick ganho vira
vantagem numerica, e vantagem numerica vira objetivo ou torre.

**Quando abre - `conversionSide(state)`.** Depois de qualquer luta ou pick, o lado com
`numbersAdvantage >= 1` (vivos dele menos vivos do outro) e **pelo menos 3 vivos** esta em janela.
A janela nao guarda cronometro: dura enquanto a vantagem numerica existir, e quem mede isso
sao os tempos de renascimento que o estado ja tem. O estado so guarda `lastFightWon`. Em
`resolveInteraction` ela e o passo (0b), antes de qualquer intencao; as intencoes sorteadas do
tick ficam sem efeito (os draws ja foram consumidos).

**O que ela converte - `conversionTarget(state, side, place)`**, nesta prioridade, so entre os
objetivos disponiveis (`isObjectiveAvailable`, que ja carrega as regras duras, ex. Barao so
depois de 20:00) **e que o proprio lado ja comecou a preparar**:

1. Barao, 2. Anciao, 3. dragao, 4. Arauto, 5. larvas, 6. **empurrar** (`push`).

**A janela exige preparo comecado (emenda de 2026-10-02, decisao do dono do produto).** A janela
so converte um objetivo se o lado que converte ja tem preparo de pelo menos 50 nele
(`objectivePrep[side][kind] >= PREP_ANNOUNCE_AT`, o ponto do aviso `objective_setup`, 12-a).
Sem isso, a vantagem vira pressao de torre (empurrao). Com o preparo comecado, a janela pula o
que falta dele, porque a vantagem numerica substitui o resto do preparo (o preparo do objetivo
tomado zera no tick seguinte). Antes da emenda a janela pulava o preparo inteiro, e todo dragao
antes de 6:00 e quase todo Barao no spawn saiam de um abate convertido no tick seguinte.

**Regra de numero por objetivo (spec calendario e volume, secao 4):**

- **Barao e Anciao** exigem **2 a mais**, ou **1 a mais com o jungler inimigo morto** (ninguem
  para dar Smite), esse ultimo caso no lado do mapa do poco.
- **Dragao, Arauto e larvas** continuam com 1 a mais, no lado do mapa da luta (abaixo).

**Regra do lado do poco, com 1 de vantagem.** Com `adv >= 2` qualquer poco serve. Com so 1 a
mais, a janela toma apenas o poco do lado do mapa onde a luta foi: Barao, Arauto e larvas ficam
no lado de cima; dragao e Anciao no de baixo; a luta no meio alcanca os dois; na base nenhum
(cai para o empurrao). Lugar da luta: `top`, `river_top`, `top_jg` contam como cima; `bot`,
`river_bot`, `bot_jg` como baixo.

**Regra da Smite - o objetivo da jungle e disputavel mesmo em inferioridade.**
`resolveConversionObjective`:

```
se nenhum defensor vivo: nada a disputar, o atacante toma sem sorteio
senao contesta com chance contestChance(kind, adv, junglerDefensorVivo, tuning):
  base      = contestBaseEpic 0.85 (Barao, Anciao) | contestBaseDragon 0.45 | contestBaseMinor 0.25 (Arauto, larvas)
  porNumero = adv <= 1 ? 1 : adv == 2 ? 0.5 : 0.2
  porSmite  = junglerVivo ? 1 : 0.3
  chance    = base * porNumero * porSmite

se contesta:
  luta no poco (resolveTeamfight com place = poco e silentIfNoKills), em inferioridade
    numerica: quem contesta pode perder mais gente
  settlePitOwner:
    dono = decidePitOwner: mais vivos leva; com numeros iguais, duelo de Smite (securePower + sorteio)
    o jungler do outro lado ainda pode ROUBAR (stealChanceFor) com chance reduzida pela
    diferenca numerica: stealChanceFor * conversionStealFactor(diferenca)
```

`conversionStealFactor(adv) = max(0.2, 1 - 0.3 * max(0, adv))`. `stealChanceFor`: a base e o campo de
tuning **`stealBase`** (0.04 no padrao; era o literal 0.12 e virou campo na emenda 2 de 2026-10-02,
para a calibracao alcancar o caminho de roubo da luta no poco), +0.20 `baron_stealer`, +0.08
`objective_focused`, +bonus do slice de objetivo do jungler, +0.05 em Barao/Anciao, teto 0.45, e
**0.02 com o jungler morto** (so por acaso). Time inteiro morto nao rouba: a guarda de vivos vem
antes do sorteio, entao ele nao consome draw de roubo. A mesma `settlePitOwner` serve ao objetivo
disputado fora da janela (`resolveContestedObjective`, 12-a), para os dois caminhos nao divergirem.
Momentum: +26 Barao/Anciao, +16 outros.

**O empurrao - `resolveConversionPush`.** Rota: `conversionLane` escolhe a da luta, se ainda
tem o que bater; senao a mais avancada (menos estruturas de pe; rota aberta ate o Nexus conta
0), com desempate pela ordem de `LANES`. O ator sai de `pickDeterministicSiegeActor` (sem rng).

- **Torre (tem pool):** o pool da torre sobe `conversionSiegeDamage` por tick:
  `conversionSiegeBase (50) * (1 + 0.5 * max(0, adv-1)) * structureTimePlausibility(tier, t) *
  tierModifierFor(tier) * (1 + 0.5 Barao + 0.1 Anciao) * turretDamageFactor` (o fator de 13.5,
  que so afeta a torre externa). Esse dano escala com a vantagem numerica e NAO passa pelo sorteio
  de forca das intencoes. Ao chegar a 100 a torre cai (`damageStructure`, que paga as placas que
  faltavam); abaixo disso pode sair evento de placa (`plate_taken`, nos limiares 10/25/45/70) ou
  `tower_low`.
- **Inibidor (sem pool):** cai direto, um por tick.
- **Freio global:** nenhuma estrutura cai se outra ja caiu neste mesmo instante
  (`lastAnyStructureDestroyedAtSec`); o pool fica em 100 e a queda vem no tick seguinte.
- **Regra dura de 7:00:** o pool passa por `holdPoolBeforeTowerWindow` (13.5), entao antes de
  `NO_TOWER_BEFORE_SEC` (420 s) nenhuma torre cai por esta via, so placa e `tower_low`.
- Depois do inibidor da rota, a conversao segue para as torres do Nexus e o Nexus.

**O texto - `conversionLead`.** A causa vem antes do fato. `conversionLead(state, side, adv, place)`
abre com `"Após o ACE, "` quando o inimigo esta todo morto **e** o jogo ja passou de 8:00 (o evento
`ace` nao existe antes disso, entao o texto nao pode falar nele); senao `"Com {um|dois|três|quatro|cinco}
a mais depois da luta {lugar}, "`. `prefixLead` junta com o texto do evento, baixando a caixa
so de artigo no comeco. Exemplo: "Com dois a mais depois da luta no rio superior, [ator] quebrou a torre interna no
topo." (uma luta no rio superior empurra a rota de cima, `conversionLane`).

| Parametro (`DEFAULT_REALISM_TUNING`) | Valor final | Papel |
|---|---|---|
| `conversionSiegeBase` | 50 | dano de cerco por tick da janela, com 1 de vantagem (pool de 100) |
| `contestBaseEpic` | 0.85 | chance base de contestar Barao ou Anciao |
| `contestBaseDragon` | 0.45 | chance base de contestar dragao |
| `contestBaseMinor` | 0.25 | chance base de contestar Arauto ou larvas |
| `stealBase` | 0.04 | chance base de roubo com o jungler vivo (`stealChanceFor`) |
| `siegeAccrualBase` | 1.5 | dano por tick do canal de cerco da fase de rota (13.5) |
| `pressSiegeBase` | 27 | base do dano do press de rota com gente (`resolveStructurePressure`, 13.5) |

Registro de calibracao e das escolhas: `docs/diagnostics/luta-mapa-vitoria-calibracao.md`,
secoes 4, 5, 6 e 7, e `docs/diagnostics/calendario-e-volume-calibracao.md`, secoes 6, 8 e 10. O
`conversionSiegeBase` andou de 30 (fim da spec de luta, mapa e vitoria) a 65 (Tasks 7 e 7b, para a
duracao ficar na trava de 29 a 36 min com menos lutas) e a 50 (Task 7c, com o preparo antes do
respawn do dragao).

---

## 14. Probabilidade de vitoria (winprob.ts)

**Indicador do estado, nunca o juiz.** Soma ponderada -> sigmoid, na otica do user.

```
x = goldDiff * 0                    // GOLD-02: o ouro entra por goldFightMult/goldSecureMult (6.5)
  + towerDiff * 0.16
  + inhibDiff * 0.42
  + dragonDiff * 0.10
  + soulDiff * 0.55
  + baronHolderDiff * 0.08
  + elderHolderDiff * 0.18
  + (mapControl/100) * 0.05
  + aliveEdge * 0.20
  + scalingEdge * 0.085             // (teamSlice(user,scaling) - rival)/50
  + (momentum/100) * 0.14
  + nexusEdge * 0.50

winProbUser = clamp(sigmoid(x), 0.005, 0.995)
```

**Peso do ouro e zero (GOLD-02):** o ouro nao entra diretamente na win prob porque
e substituido pelo canal `goldFightMult`/`goldSecureMult` em `fightPower`/`securePower`.
Isso elimina double-counting: ouro ja inclina as lutas; a win prob reflete o resultado
das lutas (torres, kills, objetivos), nao o ouro diretamente.

Clamp em [0.005, 0.995]: nunca "matematicamente decidido" antes do Nexus, mas uma
vitoria quase certa (Nexus exposto + lead grande) le ~100%.

> **Atencao de calibracao:** esses pesos sao compartilhados conceitualmente com a
> resolucao (via `chooseIntent` e `traitCombatMultiplier`, que leem `winProbUser`). Mexer no
> termometro pode mexer no juiz. Ver [secao 19](#19-pontos-abertos-para-repensar).

---

## 15. Escalares de campo: pressao, mapa, momentum

### 15.1 Pressao de lane - `recomputePressure` (por tick, APOS decayLaneState)

```
laneWeight = early ? 0.9 : 0.8
p = (laneLaningPower(user,lane) - laneLaningPower(rival,lane)) * laneWeight
torre externa inimiga caida: +12   propria caida: -12
inibidor inimigo caido:      +20   proprio caido: -20
Baron buff user: +14   rival: -14
laneLead contribution: laneState.laneLead * LANE_LEAD_TO_PRESSURE_WEIGHT  // peso = 0.15
pressure[lane] = clamp(p, -100, 100)
```

**Mudanca v1.1:** a pressao agora incorpora `laneState.laneLead` (lead persistente)
via peso `LANE_LEAD_TO_PRESSURE_WEIGHT=0.15`. Antes era recomputada do zero a cada
tick sem memoria de vantagem acumulada.

`decayLaneState` e chamada ANTES de `recomputePressure` no step 2 do tick loop -
a pressao le o lead ja decaido do tick atual.

#### Lane state persistente - `laneState.ts`

**Estrutura `LaneStateEntry` (9 campos):**

| Campo | Faixa | Significado |
|---|---|---|
| `laneLead` | -LANE_LEAD_CAP..+LANE_LEAD_CAP | resumo da vantagem acumulada; decai *= 0.985/tick |
| `csDiff` | inteiro | diferenca de CS; encolhe com farm de recuperacao |
| `xpDiff` | inteiro | diferenca de XP; encolhe com farm de recuperacao |
| `plateGold` | inteiro | ouro de plates acumulado (NAO decai - ouro real) |
| `resetAdvantage` | -2..+2 | vantagem de recall; decai rapido (0.85/tick) |
| `matchupVolatility` | 0..1 | lida de metricsBase; nao decai |
| `jungleAttentionReceived` | -1..+1 | derivada de pressao (proxy) |
| `weaksideState` | {active, intensity} | esta lane e weakside? |
| `prioScore` | -100..+100 | derivado de laneLead + csDiff |

**Eventos que atualizam lane state** via `updateLaneState` (chamada APOS todos os
rng() do evento - preserva aridade do stream):

| Evento | Peso de laneLead |
|---|---|
| `solo_kill` | 16 |
| `gank_converted` | 14 |
| `first_blood` | 12 |
| `dive` | 10 |
| `first_tower` | 6 |
| `plate` | 4 |

**Decaimento via `decayLaneState` (step 2, 1x por tick):**

```
laneLead    *= LANE_LEAD_DECAY  (0.985)  -- decaimento lento
csDiff       = round(csDiff * 0.993)     -- farm de recuperacao gradual
xpDiff       = round(xpDiff * 0.993)     -- idem
plateGold   -- NAO decai (ouro real)
resetAdv    *= 0.85  + snap-to-0         -- some rapido
prioScore    = clamp(laneLead*0.7 + csDiff*0.3, -100, 100)  -- re-derivado
```

#### Strongside / weakside - `computeStrongsideScore`

Blend de 3 sinais por lane:

```
leadContrib    = (myLead - enemyLead) / LANE_LEAD_CAP
scaleContrib   = (myCarry.scalingCurve - enemyCarry.scalingCurve) * 0.3
weaksideContrib= (enemy.weaksideTolerance - my.weaksideTolerance) * 0.2
score[lane]    = clamp(leadContrib + scaleContrib + weaksideContrib, -1, 1)
```

Lane com score acima do `STRONGSIDE_THRESHOLD=0.15` vira `dominantLane`.
Rng-free; le `laneState + metricsBase` (frozen) - nunca chama `contextMetrics`.

### 15.2 Map control

Movido por lutas (+-14 por teamfight) e decai 10%/tick (`mapControl *= 0.9`).
Alimenta `pickChance` e a win prob (peso 0.05).

### 15.3 Momentum

Movido por kills (+8), objetivos (+10..+26), torres (+6), inibidor (+10), luta
(+18). Decai 15%/tick (`momentum *= 0.85`). Clampado em [-100, 100]. Alimenta a
win prob (peso 0.14).

---

## 16. Eventos, ticker e contrato de saida

### 16.1 `SimEvent` (interno, rico) - `simEvents.ts`

Campos: `id`, `timeSec`, `kind`, `side`, `actors[]`, `victims[]`, `lane`,
`objectiveKind`, `contested`, `stolen`, `ticker`, `winProbUserAfter`, `score`
(placar) e `map` (`MapSnapshot` com estruturas + timers de objetivo restantes).

Taxonomia (`EventKind`): `first_blood`, `kill`, `death`, `solo_kill`, `gank`,
`dive`, `double/triple/quadra/penta_kill`, `shutdown`, `ace`, `dragon_taken`,
`dragon_fight`, `dragon_steal`, `voidgrubs_taken`, `herald_taken`,
`herald_used`, `tower_destroyed`, `first_tower`, `baron_fight`, `baron_taken`,
`baron_steal`, `elder_fight`, `elder_taken`, `elder_steal`,
`inhibitor_destroyed`, `nexus_exposed`, `comeback_fight`, `gg`, `player_quit`, `player_returned`
(os dois ultimos nao mexem em placar nem em ouro).

**Eventos contextuais v1.1 (kinds `ctx_*`):**

8 kinds adicionais derivados de `computeDeathQuality` + pre-condicoes de estado:

| Kind | Pre-condicao |
|---|---|
| `ctx_support_engage_decisive` | dq=good + vitima e suporte/initiator |
| `ctx_adc_caught_no_flash` | dq=bad + vitima e ADC + flashUp=false |
| `ctx_top_dive_weakside` | vitima e top + weaksideState.active + eventType=dive |
| `ctx_bot_won_2v2` | killer e adc/support + laneState.bot.laneLead > 0 + kill/gank |
| `ctx_enchanter_saved_carry` | vitima e enchanter + comp "protect-carry" + savedCarry |
| `ctx_adc_cleaned_fight` | killer e ADC + teamKillsAfter >= 2 + bot lead > 0 |
| `ctx_scaling_survived_early` | comp "scaling" + teamKillsAfter < 3 + t < 900 + goldDelta > -800 |
| `ctx_support_died_warding` | vitima e support + dq != bad + prioScore < 0 |

### 16.2 Qualidade de morte - `deathQuality.ts`

`computeDeathQuality(ctx)` classifica cada morte como `"good"`, `"neutral"` ou
`"bad"` (campo interno de runtime, nunca exposto na UI):

```
// Override de engage-initiator (3 condicoes independentes):
se isEngageInitiator(vitima) E teamKillsAfter >= 2:     -> "good"
se isEngageInitiator(vitima) E teamObjectiveAfter >= 150: -> "good"
se isEngageInitiator(vitima) E savedCarry:               -> "good"

// Formula de score:
score = teamObjectiveAfter + teamKillsAfter*300 - allyGoldGiven
        + carrySaved(200 se true) - victim.shutdownGold - estimateMapLoss

if score >= 200:  "good"
if score <= -150: "bad"
senao:            "neutral"
```

`isEngageInitiator(p)`: campeo com functionalTag "engage" OU primaryClass em
{engage-support, diver, tank}.

`selectContextualTicker(dq, ctx)` seleciona a frase pt-BR correspondente ou
retorna `null` (ticker generico prevalece). Prioridade: derivados de dq primeiro,
depois derivados de estado.

### 16.3 Ticker (pt-BR) - `ticker.ts`

Padrao sempre "[quem] + [verbo] + [o que] + [em quem/onde]", garantindo um
protagonista por linha. `shortName` remove o ano do card ("Faker 2016" -> "Faker").
`placeLabel`, `dragonLabel`, `soulLabel` cuidam de rotulos.

### 16.4 Ponte para o contrato - `runMatchEngine.ts`

Mapeia cada `SimEvent` -> `GameEvent` (`types.ts`, validado por Zod). Distribui o
`playbackMs` proporcional ao tempo de jogo. O `MatchResult` final:
`{ winner, events[], totalPlaybackMs }`. `totalPlaybackMs` vem do
`SPEED_PRESET_MS[speedPreset]`.

### 16.5 Harness de calibracao micro (Fase 13)

```
scripts/calibrate-micro.ts
npm run calibrate:micro
```

Valida bandas de plausibilidade de K/D/A, economia e pressao de lane contra
cenarios nomeados (ex: "ADC stomped gold+2000", "scaling sobreviveu early").
Cada cenario e um fixture deterministico: mesma seed, mesmo roster, saidas
esperadas documentadas. O gate passa quando todas as bandas ficam dentro do
intervalo `PLAUSIBLE_BAND` para o role/archetype correspondente.

---

## 16.6 Plausibilidade probabilistica (v2.0)

Esta secao documenta o sistema de plausibilidade construido nas Fases 16-21 da
milestone Engine Plausibility Hardening. O objetivo e garantir que eventos grandes
(torres, multikills, objetivos) nao acontecam cedo demais nem de forma absurda.

### 16.6.1 Taxonomia probabilistica - `src/sim/plausibility.ts`

O modulo `src/sim/plausibility.ts` e um modulo de dados puros: sem funcoes de
classificacao em runtime, sem imports internos. Exporta o tipo `PlausibilityClass`
e a tabela `PLAUSIBILITY_EXAMPLES` com 14 entradas canonicas cobrindo as 5 classes.

**As 5 classes:**

| Classe | Significado | Enforcement |
|---|---|---|
| `illegal` | Regra dura -- nunca pode acontecer | Assert duro; gera erro se violado |
| `nearZero` | Quase impossivel; so em caos extremo | Probabilidade muito baixa; modulado pelo estado |
| `rare` | Raro, mas possivel | Probabilidade baixa; modulado pelo estado |
| `plausible` | Normal para o estado | Probabilidade media; esperada em jogos comuns |
| `expected` | Esperado pelo estado | Alta probabilidade; padrao do jogo em condicoes normais |

Apenas `illegal` e uma regra dura (assert que lanca erro). As demais classes
(`nearZero`, `rare`, `plausible`, `expected`) sao **moduladas por probabilidade**
conforme o estado da partida: o mesmo evento pode ser `rare` em 10min e `expected`
em 30min. Nenhum policiamento em runtime para as classes nao-`illegal`; elas orientam
a calibracao dos harnesses.

**Exemplos canonicos (selecao):**

| Evento | Condicao | Classe |
|---|---|---|
| `baron_taken` | antes dos 20:00 | `illegal` |
| `kill` | killer e vitima no mesmo time | `illegal` |
| `tower_destroyed` | antes de 00:45 | `nearZero` |
| `quadra_kill` | antes de 01:30 | `nearZero` |
| `first_tower` | entre 7-9min em stomp | `rare` |
| `baron_taken` | aos 20:00 com ace + setup perfeito | `rare` |
| `first_tower` | entre 9-14min com vantagem | `plausible` |
| `first_tower` | entre 10-15min em jogo normal | `expected` |
| `baron_taken` | apos 25min com setup adequado | `expected` |

A tabela completa (14 entradas) esta em `src/sim/plausibility.ts:PLAUSIBILITY_EXAMPLES`.

### 16.6.2 Estrutura por dano acumulado (Fase 17) - `structureTimePlausibility`

Antes da Fase 17, a logica de estrutura nao mantinha estado de dano acumulado entre
ticks: uma torre podia cair em qualquer momento sem relacao com o progresso anterior.
A Fase 17 introduziu `StructureDamageState` e a funcao `structureTimePlausibility`.

**`StructureDamageState`:** campo paralelo adicionado ao `TeamState`, persistido por
lane e por tier da estrutura. Acumula o dano ao longo do jogo sem substituir a logica
existente de `structures`.

**`structureTimePlausibility(tier, gameTimeSec)`:** retorna um fator multiplicativo
de plausibilidade temporal para aquela combinacao de tier + minuto de jogo. Torres
externas derrubadas muito cedo recebem fator proximo de zero; o fator cresce conforme
o jogo avanca. Os limiares calibrados satisfazem as bandas do `calibrate:structures`.

**Formula de dano (multiplicativa):**

```
danoEfetivo = waveMultiplier
            x siegeThreat
            x numbersAdvantage
            x timePlausibility
```

Cada fator e independente: `waveMultiplier` reflete o historico de ondas na lane;
`siegeThreat` captura a presenca do time atacante; `numbersAdvantage` penaliza ataques
sem vantagem numerica; `timePlausibility` aplica o freio temporal de `structureTimePlausibility`.
O produto final escala a chance de o evento `tower_destroyed` ser emitido no tick.

### 16.6.3 Actor plausibility (Fases 18-19) - freio de cascata e atores de objetivo

#### Freio de cascata (Fase 18) - `buildStructureActorCandidates`

Torres nao caem em cascata absurda porque o freio de cascata limita quantas estruturas
podem cair em sequencia curta por lane e entre lanes.

**Freio por-lane:** cada lane tem um cooldown de cascata (`CASCADE_N_LANE_SEC`). Apos
uma queda de estrutura numa lane, uma segunda queda na mesma lane dentro desse janela
temporal recebe reducao de probabilidade ate o maximo de `CASCADE_REDUCAO_MAX`. O freio
e aplicado como fator multiplicativo pre-draw, sem cortar o espaco de possibilidades.

**Freio cross-lane (Fase 18):** o freio se propaga parcialmente para lanes adjacentes:
uma cascata em bot reduz a probabilidade de queda simultanea em mid. Isso modela a
realidade de que um time nao consegue pressionar todas as lanes ao mesmo tempo.

**Bypass por ace/wipe:** se o time defensor tem 3+ jogadores mortos (`aliveCount(enemy) <= 2`),
o freio de cascata e bypassado. Maioria morta = janela aberta para fazer pressao total.

**`buildStructureActorCandidates`:** funcao rng-free que restringe o ator de cada
evento de estrutura por lane e por fase do jogo. Evita atores inconsistentes:
support raramente destroi torres sozinho no early; ADC so e ator de estrutura em bot
no early game. A funcao retorna candidatos filtrados; o draw de ator ocorre pos-filtragem.

#### Jungler como ator de secure de objetivos (Fase 19) - regras de Herald e Baron

**Jungler como ator padrao de secure:** em eventos `baron_taken`, `herald_taken` e
`elder_taken`, o jungler do time vencedor e o ator padrao (protagonista do secure).
Isso reflete o papel real do jungler em LoL profissional: e ele quem bate Smite.
Quando o jungler esta morto, outro ator e eleito, mas o jungler vivo tem prioridade.

**Herald nunca em Nexus turret:** `resolveHeraldUse` nunca emite `tower_destroyed` em
`nexusTurret`. O Herald e usado em torres externas ou internas -- jamais numa torre
do Nexus cedo, o que seria implausível no LoL real. Essa regra e um assert duro
(invariante §18 ponto 3): o evento `tower_low` e sempre emitido, nunca `tower_destroyed`
em nexusTurret via Herald.

**Baron setup antes do ataque:** o criterio de setup (`BARON_PRESSURE_THRESHOLD=35`)
exige vantagem de pressao clara antes de autorizar Baron ao spawn (20:00). Pressao
de lane normal nao qualifica -- so vantagem explicita mid/top (>35 signed) permite.
Isso modela que times profissionais nao arriscam Baron sem setup claro.

### 16.6.4 Harnesses de calibracao e workflow do golden deliberado

#### Os 3 harnesses de calibracao

Cada harness e um arquivo Vitest com config dedicada. Rodam isolados de `npm test`.

**`calibrate:structures`** -- `scripts/calibrate-structures.ts`

```
npm run calibrate:structures
```

Roda N=800 partidas e mede distribuicoes estruturais:
- 1a torre: p5/p50/p95 por tier de stomp/equilibrado/equilibrado-tardio
- Total de torres por jogo (gate duro: media >= 1, media <= 14, p95 <= 18)
- Frequencia de queda precoce de tier interno e Nexus turret
- Cascata entre lanes
- Herald: frequencia e tipo de estrutura alvo

Relatorio gerado em `tmp/calibration-structures.txt` (pt-BR).

**`calibrate:objectives`** -- `scripts/calibrate-objectives.ts`

```
npm run calibrate:objectives
```

Roda N=500 partidas e mede objetivos epicos:
- Baron ao 20:00: deve ser raro (< X% das partidas); apenas com setup forte
- Jungler como ator de secure: percentual de `baron_taken`/`herald_taken` onde ator[0] e jungler
- Elder: so apos soul desbloqueado (gate duro)
- Distribuicao de tempo de Baron (p5/p50/p95 de partidas com Baron)

Relatorio gerado em `tmp/calibration-objectives.txt` (pt-BR).

**`calibrate:combat`** -- `scripts/calibrate-combat.ts`

```
npm run calibrate:combat
```

Roda N=500 partidas e mede combate:
- Quadrakill antes de 01:30: deve ser zero (gate duro `nearZero`)
- Multikill por fase (triple/quadra/penta): distribuicao por janela de tempo
- Shutdown: sem spam (gate distribucional)
- Ticker com nome real: percentual de eventos com protagonista nomeado (nao role generico)
- Self-kill / duplicidade: zero (gate duro `illegal`)

Relatorio gerado em `tmp/calibration-combat.txt` (pt-BR).

#### Como ler os relatorios

Cada relatorio usa dois tipos de verificacao:

- **Gates duros:** violacoes de `illegal` ou de invariantes fisicos. Se um gate duro
  falha, ha um bug real no motor -- nao alargar a banda, corrigir o codigo.
- **Bandas distribucionais:** percentis e medias. Se uma banda falha por pouco e o
  motor esta se comportando como projetado, alargar a banda com justificativa documentada
  no harness (D-04). So mexer em tunable do motor se houver comportamento de fato
  implausiivel.

Os asserts ficam no proprio harness como `expect(...).toBeLessThan(...)` do Vitest.
A suite verde dos harnesses prova os criterios de aceite 1-12 da milestone v2.0.

#### Workflow do golden deliberado (D-08 -- fonte unica desta regra)

O golden (`src/__tests__/golden/golden.test.ts`) e uma rede de 15 snapshots
deterministicos (3 cenarios x 5 seeds fixas) que prova que nenhuma mudanca move o
baseline involuntariamente.

**Regra absoluta:** o golden e regenerado DELIBERADAMENTE, NUNCA em `npm test`.
O script `test` do `package.json` nunca deve receber o flag `--update`. Adicionar
`--update` ao script `test` e proibido (D-13 do golden.test.ts).

**Workflow correta:**

```
1. Suite principal verde:
   npm test

2. Regeneracao deliberada (ato explicito, nao automatico):
   npm run update-golden

3. Conferir o diff:
   git diff src/__tests__/golden/

4. Se o diff for so o esperado (ou vazio) -> commit isolado de aprovacao:
   git add src/__tests__/golden/
   git commit -m "chore(golden): regen deliberado vX.Y - aprovado apos recalibracao final"

5. Se o diff for nao trivial -> mostrar ao usuario antes de commitar.
```

O comando `npm run update-golden` executa:
```
vitest run src/__tests__/golden/golden.test.ts --update
```

Commits que movem baseline devem ser ISOLADOS do commit de feature. Um commit de
golden misturado com mudancas de logica e um sinal de que o golden foi atualizado
involuntariamente -- bug a corrigir, nao aceitar.

### 16.7 Regua de realismo (specs 2026-10-02)

Desde as specs de 2026-10-02 (luta, mapa e vitoria; calendario e volume de abates) o criterio de
aceite do motor e **proporcao real de LoL medida no caminho do app**, nao banda interna. Cenario
`app`: rosters reais de `public/players.json` mais campeoes de `assignFearlessChampionsBothTeams`,
N=1500, seed = indice da partida. Cenario `even75`: controle sintetico 75 contra 75 (so
informativo; sem favorito, as bandas de favorito nao se aplicam, e sem vantagem de rota o all-in
nao dispara). Fonte das referencias: `docs/references/ritmo.md` (Oracle's Elixir
2023-2025, ~6 mil partidas tier-1, e feed oficial da Riot).

| Peca | Arquivo | Comando |
|---|---|---|
| Medicao (corpus, metricas, bandas, relatorio) | `scripts/realism-metrics.ts` (`runCorpus`, `computeRealismMetrics`, `REALISM_BAND_SPECS`, `chaosKillsCurve`, `formatMetrics`) | - |
| Relatorio, sem assert | `scripts/realism-audit.ts` | `npm run realism` (`REALISM_N=600` para rodada rapida); escreve `docs/diagnostics/realism-audit.txt` |
| Gate de aceite (40 bandas, curva do Caos, 2 asserts duros e o assert do tempo de preparo) | `scripts/calibrate-realism.ts` | `npm run calibrate:realism` |
| Varredura de pontos de `RealismTuning` | `scripts/sweep-realism.ts` | `npx tsx scripts/sweep-realism.ts '<json de pontos>' [N] ['<json de SimConfig>']` |

O gate (`calibrate-realism`) tem **cinco testes**:

1. **Assert duro:** zero violacao de regra dura (torre antes de 7:00, Barao antes de 20:00, triple
   ou mais antes de 8:00, ACE antes de 8:00).
2. **Assert duro:** mesma seed gera a mesma partida.
3. **Bandas:** as 40 bandas de `REALISM_BAND_SPECS` (abaixo): 2 **travas**, que nunca podem ser
   afrouxadas (duracao media 29-36 min e fracao no teto de 60 min < 0.5%), e 38 de **aceite**.
4. **Curva do Caos:** os abates por partida **sobem a cada ponto** do slider 0 / 0.25 / 0.5 / 0.75
   / 1 e **passam de 38 no slider 1** (N=600 por ponto, `chaosKillsCurve`). Antes da spec de
   calendario e volume o volume saturava em ~50 em todos os pontos (47.3 / 50.4 / 51.5 / 52.3 /
   52.4); no ponto final a curva e **25.92 / 30.57 / 36.28 / 38.90 / 42.97**. A curva existe
   porque o slider tem dois efeitos (mais virada e mais sangue, 13.1) e o gate precisa pegar o
   dia em que o sangue deixar de acompanhar o Caos.
5. **Assert do tempo de preparo (emenda de 2026-10-02):** o preparo do Barao leva mais tempo que o
   do dragao (`baronSetupDelaySec > dragonSetupDelaySec`), medido como a mediana do tempo entre o
   nascimento do objetivo e o 1o evento `objective_setup` dele. E a forma de conferir, sem travar a
   taxa por tick (que e maior no epico, 12-a), que o epico demora mais para ficar pronto. No ponto
   final: dragao 75 s, Barao 150 s.

**As 18 bandas da spec de luta, mapa e vitoria que ficam** (a trava "mediana da 1a torre em
[8:00; 20:00]" saiu, substituida pela banda mais estreita da tabela seguinte): as 2 travas e 16
bandas de aceite:

| Metrica (cenario `app`) | Banda | Referencia real |
|---|---|---|
| lider de abates aos 20 vence | 0.70 a 0.82 | 0.764 |
| lider de ouro aos 15 / 20 / 25 vence | 0.66-0.78 / 0.72-0.84 / 0.77-0.89 | 0.716 / 0.782 / 0.830 |
| abates vencedor / perdedor | 1.8 a 2.6 | 2.15 |
| vencedor com mais abates | >= 0.85 | 0.90 |
| vencedor atras no ouro | <= 0.05 | 0.02 |
| ouro vencedor menos perdedor (fim) | 7000 a 13000 | 10000 |
| GPM por time | 1650 a 2050 | 1833 |
| GPM vencedor / perdedor | 1.12 a 1.26 | 1.19 |
| time do 1o Barao vence | 0.78 a 0.90 | 0.854 |
| time da Alma vence | 0.84 a 0.95 | 0.908 |
| time da 1a torre vence | 0.62 a 0.75 | 0.682 |
| roubos / objetivos tomados | <= 0.03 | 0.02 |
| favorito com gap de elenco >= 5 vence | 0.75 a 0.85 | 0.80 |
| favorito com gap de elenco < 1 vence | 0.45 a 0.55 | 0.50 |

**As 22 bandas de aceite do calendario e do volume** (spec calendario e volume, secao Medicao e
aceite; o valor final e do `npm run realism`, N=1500):

| Bloco | Metrica (cenario `app`) | Banda | Referencia real | Valor final |
|---|---|---|---|---|
| Early | first blood mediano | 4:00 a 6:30 | 4:54 | 5:30 |
| Early | first blood p10 | 2:30 a 4:00 | 3:13 | 3:30 |
| Early | first blood antes de 1:30 | <= 2% | 0 (minimo real 1:31) | 0% |
| Early | partidas sem abate ate 10:00 | 5% a 18% | 11% | 8.1% |
| Early | abates ate 10' | 2.2 a 4.5 | 3.2 | 3.85 |
| Early | abates ate 15' | 5.0 a 8.5 | 6.5 | 7.45 |
| Volume | abates por partida | 23 a 32 | 27 | 30.7 |
| Volume | abates ate 20' | 8.5 a 13 | 10.7 | 11.3 |
| Volume | abates por minuto entre 20' e 25' | 0.85 a 1.45 | 1.13 | 1.15 |
| Objetivos | 1o dragao mediano | 7:45 a 10:30 | 9:10 | 7:45 |
| Objetivos | 1o dragao antes de 6:00 | <= 3% | 0 (minimo real 6:31) | 0.5% |
| Objetivos | dragoes por partida (contando Elder) | 3.8 a 5.2 | 4.45 | 3.96 |
| Objetivos | partidas com Alma | 30% a 52% | 42% | 30.2% |
| Objetivos | partidas com Elder | 4% a 14% | 8% | 4.5% |
| Objetivos | Baroes por partida | 1.1 a 1.7 | ~1.45 | 1.37 |
| Objetivos | partidas com Barao | 80% a 98% | ~96% | 96.7% |
| Objetivos | 1o Barao ate 21:00, entre as partidas com Barao | <= 15% | sem fonte firme (alvo 5%) | 2.2% |
| Torres | 1a torre mediana | 14:30 a 18:30 | 16:34 | 14:30 |
| Torres | 1a torre p10 | >= 12:00 (teto 20:00) | 13:15 | 12:30 |
| Torres | torres ate 15' | 0.4 a 1.4 | 0.85 | 0.80 |
| Torres | torres ate 20' | 2.5 a 5.0 | 3.72 | 2.74 |
| Torres | torres por partida, **contando as torres do Nexus** | 10 a 14 | 11.9 (11 por lado) | 11.7 |

A metrica de torres por partida conta as torres do Nexus (como a referencia, que conta as 11 de
cada lado), nao so `towersDestroyed`, que e so de rota (emenda 1 de 2026-10-02). As regras duras
ficam em zero sempre.

**Acompanhadas sem gate** (para registro antes e depois; valores finais em
`docs/diagnostics/realism-audit.txt`): placas por partida (a referencia real de 8.2 e da regra
antiga), partidas com larvas e com Arauto tomados, 1o Barao mediano (sem fonte firme), abates por
ADC, mid e jungle (real: ADC > mid > jungle), shutdowns por partida, p10 e p90 de abates (real 16 e
38) e de duracao, partidas abaixo de 25 min (real ~6%) e o tempo ate o 1o aviso de preparo do
dragao e do Barao. O cenario sintetico 75 contra 75 continua so como controle.

**Antes e depois (cenario `app`, N=1500):** a linha de base de calendario e volume
(`docs/diagnostics/realism-audit-calendario-linha-de-base.txt`, o motor depois da spec de luta,
mapa e vitoria) tinha 20 das 22 bandas novas FORA (so torres aos 20' e torres por partida
dentro); o ponto final (`docs/diagnostics/realism-audit.txt`) tem **as 40 bandas dentro**.

**Estado ao fim das specs:** o gate passa as 40 bandas, a curva do Caos e o assert do tempo de
preparo no N=1500 (nenhuma banda afrouxada). Registros honestos:

1. As bandas de menor folga sao a mediana do 1o dragao (465 s, no piso, degrau de 15 s), a
   mediana da 1a torre (870 s, no piso), partidas com Alma (0.302 contra piso de 0.30), roubos
   (0.026 contra teto de 0.03) e partidas com Elder (0.045 contra piso de 0.04).
2. No N=3000 (informativo) as outras 39 bandas ficam dentro, mas a Alma cai para 0.297, 0.003
   abaixo do piso: o gate de N=1500, com seeds fixas, passa, mas a margem nao e robusta.
3. Fora do que o gate mede, a spec de luta, mapa e vitoria registrava como fora de escopo o
   volume de abates (~50 por partida contra 27 reais) e o calendario do early game (first blood
   em ~1 min contra 5 reais); os dois foram resolvidos pela spec de calendario e volume (ponto 19.7).

Registro completo e historico das varreduras: `docs/diagnostics/luta-mapa-vitoria-calibracao.md`
(a secao 9 traz a medicao final da spec de luta) e
`docs/diagnostics/calendario-e-volume-calibracao.md` (a secao 10.9 traz o ponto final da spec de
calendario e volume); registro de bandas e testes antigos revistos:
`docs/diagnostics/luta-mapa-vitoria-bandas.md` e `docs/diagnostics/calendario-e-volume-bandas.md`.

> Os gates `calibrate:*` anteriores (`pace`, `micro`, `structures`, `objectives`, `combat`,
> `assists`, `calibrate`) medem partes do modelo antigo e foram revistos contra a regua nova,
> um a um, nos dois registros de bandas. `npm run calibrate:all` NAO fica todo verde por
> desenho: `calibrate:pace` tem 4 bandas vermelhas na fixture sintetica 75 contra 75, das
> quais 3 sao regressao real da spec de calendario e volume (torres aos 20:00, densidade
> comparavel de 0 a 14 min e de 14 a 20 min) e 1 e herdada (razao de abates vencedor sobre
> perdedor), e `calibrate:micro` tem o cenario 4 vermelho (o efeito do scaling-comp nao
> existe).

---

## 17. Tabela mestra de tunables

Todos os numeros ajustaveis num so lugar (referencia rapida para calibrar). Os
valores canonicos vivem no codigo citado; esta tabela e espelho documental.

| Categoria | Tunable | Valor | Local |
|---|---|---|---|
| Tick | `tickSeconds` | 15 | `DEFAULT_SIM_CONFIG` |
| Caos | `comebackElasticity` (slider de Caos) | 0.25 | `DEFAULT_SIM_CONFIG` |
| Caos | `CHAOS_VOLATILITY_COEF` (volatilidade media dos jogadores) | 0.03 | `tuning.ts` |
| Caos | `effectiveChaos` | `clamp(slider + volatilidade*0.03, 0, 1)` | `tuning.ts` |
| Caos | `CHAOS_REFERENCE` (escala da recompensa de objetivo) | 0.25 | `tuning.ts` |
| Luta | sorteio por lado | `1 - w + rng*2w`, `w = fightNoiseBase + fightNoiseChaosCoef * caos`, clamp [0.02, 0.6] | `resolveTeamfight`, `fightNoiseHalfWidth` |
| Luta | `fightNoiseBase` / `fightNoiseChaosCoef` | 0.375 / 0.48 | `DEFAULT_REALISM_TUNING` |
| Luta | `ratingPowerD` (curva de rating) | 140 (era 525) | `DEFAULT_SIM_CONFIG` |
| Luta | reset entre lutas early/mid/late (`fightResetSec`, dividido por `bloodScale`) | 220/240/150 s | `fightResetEarly/Mid/Late` |
| Luta | minAlive early/resto, e os dois junglers com o 1o clear feito | 4 / 3 | `teamfightAllowed` |
| Luta | motivo de luta: janela de "nascendo" e de cerco recente | 60 s | `FIGHT_REASON_WINDOW_SEC` |
| Luta | luta sem motivo a partir do caos efetivo | 0.9 | `fightAnywhereChaos` |
| Buff | Baron fightPower | +14% (*vivos/5) | `fightPower` |
| Buff | Elder fightPower | +55% (*vivos/5) | `fightPower` |
| Buff | soul | +10% | `fightPower` |
| Buff | por dragao | +2% | `fightPower` |
| Buff | capitao luta / objetivo | +4% / +5% | `power.ts` |
| Traits | clamp do multiplicador | [0.7, 1.3] | `traitCombatMultiplier` |
| Steal | base (`stealBase`) / cap | 0.04 (era 0.12) / 0.45 | `stealChanceFor`, `DEFAULT_REALISM_TUNING` |
| Steal | sem jungler vivo | 0.02 | `stealChanceFor` |
| Steal | baron_stealer / objective_focused | +0.20 / +0.08 | `stealChanceFor` |
| Pick | `pickChance` | `clamp(clamp(0.25 + edge/300, 0.1, 0.6) * clamp(razaoDeOuro, 0.5, 2) * phasePickScale * bloodScale, 0.02, 0.75)` | `pickChance` |
| Pick | `phasePickScale` | `earlyPickScale` (0.15) ate 14:00, 1 depois | `readiness.ts` |
| Momentum | decay / clamp | *0.85 / [-100,100] | `decayMomentum`/`bumpMomentum` |
| Map | decay / por luta | *0.9 / +-14 | `decayMomentum`/`resolveTeamfight` |
| Siege | gate minimo de forca | 0.18 | `resolveStructurePressure` |
| Siege | lateRamp | +1 por 900s apos 2100s | `resolveStructurePressure` |
| Siege | `siegeAccrualBase` (canal da fase de rota, so ate 14:00 e so torre externa) | 1.5 | `DEFAULT_REALISM_TUNING` |
| Siege | `pressSiegeBase` (base do dano do press de rota) | 27 | `DEFAULT_REALISM_TUNING` |
| Estrutura | placas por torre de rota / limiares no pool / paga ao cair | 5 / 10, 25, 45, 70 / as que faltam ate 5 | `PLATES_PER_TURRET`, `PLATE_THRESHOLDS`, `damageStructure` |
| Estrutura | `outerTurretEarlyFactor` (fator de dano na torre externa) | 0.5 ate 11:00, reta ate 1.0 em 15:00 | `outerTurretDamageFactor` |
| Siege | regra dura de torre: `NO_TOWER_BEFORE_SEC` | 420 s | `structures.ts` |
| Janela | abre com `numbersAdvantage` e vivos | >= 1 e >= 3 | `conversionSide` |
| Janela | `conversionSiegeBase` | 50 | `DEFAULT_REALISM_TUNING` |
| Janela | `contestBaseEpic` / `contestBaseDragon` / `contestBaseMinor` | 0.85 / 0.45 / 0.25 | `DEFAULT_REALISM_TUNING` |
| Janela | converte objetivo so com preparo de pelo menos | 50 | `conversionTarget`, `PREP_ANNOUNCE_AT` |
| Janela | Barao e Elder exigem | 2 a mais, ou 1 a mais com o jungler inimigo morto | `conversionTarget` |
| Janela | fator por numeros em `contestChance` (adv 1 / 2 / 3+) | 1 / 0.5 / 0.2 | `contestChance` |
| Janela | fator por Smite em `contestChance` (jungler vivo / morto) | 1 / 0.3 | `contestChance` |
| Janela | `conversionStealFactor` | `max(0.2, 1 - 0.3*adv)` | `conversion.ts` |
| Janela | "Apos o ACE" so a partir de | 480 s (`ACE_MIN_SEC`) | `conversionLead` |
| Income | farm passivo (`passiveBasePerMin`, `passiveSlopePerMin`) | `(240 + 3.5*min) * roleShare * laningFarmFactor * (1 + lead/600)` | `passiveGoldPerMinute` |
| Income | `PASSIVE_ROLE_SHARE` adc/mid/top/jungle/support | 1.12 / 1.06 / 1.00 / 0.88 / 0.60 | `economy.ts` |
| Respawn | formula | `8 + min*1.6 (+rng*4)`, clamp 8-70 | `respawnSeconds` |
| Ouro real | abate / first blood / piso | 300 / 400 / 100 | `economy.ts` |
| Ouro real | assistencia | metade do abate, dividida | `ASSIST_SHARE` |
| Ouro real | torre externa / interna / inibidor / Nexus / inibidor-estrutura | 0 / 0 / 0 / 50 / 50 (a torre de rota paga nas placas) | `TOWER_GOLD` |
| Ouro real | 1a torre | 300 | `FIRST_TURRET_BONUS` |
| Ouro real | placa | 120 ate 11:00, menos 10 por minuto completo, piso 80 (15:00) | `plateGold` |
| Ouro real | Barao e Elder: por jogador do time (vivo ou morto) / a mais para quem confirma | 150 / 100 | `EPIC_GOLD_PER_PLAYER`, `EPIC_SECURE_GOLD` |
| Ouro real | dragao / larva / Arauto, para quem confirma | 75 / 30 / 100 | `DRAGON_SECURE_GOLD`, `GRUB_GOLD`, `HERALD_SECURE_GOLD` |
| Bounty | ganho e perda por ouro | 1 a cada 4 (`0.25`) | `earnBounty`, `settleVictimBounty` |
| Bounty | piso / pagamento maximo / shutdown a partir de | -200 / 700 / 150 | `economy.ts` |
| Recompensa de objetivo | `objectiveBountyMinDeficit` / `objectiveBountyFraction` / `objectiveBountyCap` | 1500 / 0.05 / 2500 | `DEFAULT_REALISM_TUNING` |
| WinProb | peso de ouro | 0 (substituido por goldFightMult) | `WINPROB_WEIGHTS.gold` |
| WinProb | demais pesos | ver secao 14 | `WINPROB_WEIGHTS` |
| WinProb | clamp | [0.005, 0.995] | `computeWinProbability` |
| Ouro | `goldFightExponent` (fatia de ouro no poder de luta) | 1.85 | `DEFAULT_REALISM_TUNING` |
| Ouro | `fullBuildStartPerPlayer` / `fullBuildEndPerPlayer` (`goldRelevance`) | 12000 / 18000 | `DEFAULT_REALISM_TUNING` |
| Ouro | `GOLD_SECURE_FACTOR` (canal secundario) | 0.40 | `power.ts` |
| Ouro | `goldFightMult` clamp | [0.6, 1.6] | `goldFightMult` |
| Ouro | `goldSecureMult` clamp | [0.8, 1.25] | `goldSecureMult` |
| Ouro | `K` do `effectiveGoldPower` | 1375 | `effectiveGoldPower` |
| Ouro esperado | formula base | `round(500 + integral(farm passivo, lead 0) * roleShare * laningFarmFactor)` | `expectedGoldForRoleAtMinute`, `expectedPassiveGold` |
| Jungler | 1o clear | `clamp(190 - (lanePhase - 75)*0.6, 170, 225)` s | `junglerFirstClearSec` |
| Early | all-in de rota: a partir de / piso de vantagem de laning / teto da chance | 90 s / 4 pontos / 0.5 | `LANE_ALL_IN_FROM_SEC`, `LANE_ALL_IN_EDGE_FLOOR`, `laneAllInChance` |
| Early | `laneAllInBase` (chance por 10 pontos de vantagem acima do piso) | 0.03 | `DEFAULT_REALISM_TUNING` |
| Early | `earlyPickScale` (fator de pick e gank ate 14:00) | 0.15 | `DEFAULT_REALISM_TUNING` |
| Caos | `bloodScale` | `max(0.6, 1 + bloodChaosCoef*(caos efetivo - 0.25))` | `readiness.ts` |
| Caos | `bloodChaosCoef` | 4.8 | `DEFAULT_REALISM_TUNING` |
| Preparo | `prepRateMinor` (dragao, larvas, Arauto) / `prepRateEpic` (Barao, Elder), por tick | 17 / 28 | `DEFAULT_REALISM_TUNING` |
| Preparo | `prepPrioScale` / `prepDecay` | 30 / 1.5 | `DEFAULT_REALISM_TUNING` |
| Preparo | aviso `objective_setup` / preparo cheio (tentativa de tomada) | 50 / 100 | `PREP_ANNOUNCE_AT`, `PREP_FULL` |
| Preparo | antecedencia do preparo do dragao antes do respawn (2o dragao em diante) | 60 s | `DRAGON_PRESPAWN_PREP_SEC` |
| Lane | `LANE_LEAD_CAP` | 60 | `laneState.ts` |
| Lane | `LANE_LEAD_DECAY` | 0.985 | `laneState.ts` |
| Lane | `LANE_LEAD_TO_PRESSURE_WEIGHT` | 0.15 | `laneState.ts` |
| Lane eventos | solo_kill | 16 | `LANE_EVENT_WEIGHTS` |
| Lane eventos | gank_converted | 14 | `LANE_EVENT_WEIGHTS` |
| Lane eventos | first_blood | 12 | `LANE_EVENT_WEIGHTS` |
| Lane eventos | dive | 10 | `LANE_EVENT_WEIGHTS` |
| Lane eventos | first_tower | 6 | `LANE_EVENT_WEIGHTS` |
| Lane eventos | plate | 4 | `LANE_EVENT_WEIGHTS` |
| Comp | `DOMINANCE_THRESHOLD` | 0.25 | `teamComp.ts` |
| Comp | `COMP_FIGHT_CLAMP` | [0.93, 1.07] | `teamComp.ts` |
| Comp | `COMP_SECURE_CLAMP` | [0.95, 1.05] | `teamComp.ts` |
| Comp | `COMP_FIGHT_BOOST` | 0.05 | `teamComp.ts` |
| DeathQuality | threshold "good" | >= 200 | `computeDeathQuality` |
| DeathQuality | threshold "bad" | <= -150 | `computeDeathQuality` |

### 17.1 `DEFAULT_REALISM_TUNING` completo (valores finais)

Os 29 campos de `RealismTuning` (`src/sim/tuning.ts`), com o valor final, o valor de antes da spec
de calendario e volume (a `master` em `50e1f68`) e onde esta o registro. `SimConfig.tuning`
sobrescreve qualquer campo (e e assim que a varredura mede pontos sem editar codigo). Os numeros
de secao sao de `docs/diagnostics/calendario-e-volume-calibracao.md`, salvo indicacao.

| Campo | Valor final | Antes | Registro e papel |
|---|---|---|---|
| `passiveBasePerMin` | 240 | 240 | farm passivo no minuto 0 (`luta-mapa-vitoria-calibracao.md`, secao 1) |
| `passiveSlopePerMin` | 3.5 | 2.5 | quanto o farm cresce por minuto; 6.7 (Etapa G) |
| `goldFightExponent` | 1.85 | 1.375 | expoente da fatia de ouro no poder de luta; 10.7.2 |
| `fightNoiseBase` | 0.375 | 0.255 | meia largura do sorteio de luta no Caos 0; 10.7.1 |
| `fightNoiseChaosCoef` | 0.48 | 0.48 | quanto a largura cresce por unidade de caos |
| `objectiveBountyMinDeficit` | 1500 | 1500 | deficit minimo para a recompensa de objetivo |
| `objectiveBountyFraction` | 0.05 | 0.05 | fracao do deficit paga |
| `objectiveBountyCap` | 2500 | 2500 | teto da recompensa por objetivo |
| `fullBuildStartPerPlayer` | 12000 | 12000 | onde o ouro comeca a pesar menos (desenho do dono do produto) |
| `fullBuildEndPerPlayer` | 18000 | 18000 | onde o ouro deixa de pesar (desenho do dono do produto) |
| `conversionSiegeBase` | 50 | 30 | dano da janela por tick com 1 de vantagem; 6.14 (65) e 10.6.2 (50) |
| `pressSiegeBase` | 27 | (literal 27) | base do dano do press de rota; campo novo, valor mantido (6.6) |
| `contestBaseEpic` | 0.85 | 0.7 | contestar Barao ou Anciao na janela; 6.14 |
| `contestBaseDragon` | 0.45 | 0.45 | contestar dragao na janela |
| `contestBaseMinor` | 0.25 | 0.25 | contestar Arauto ou larvas na janela |
| `siegeAccrualBase` | 1.5 | 2.2 | cerco da fase de rota; piso de 1.5 dos testes unitarios (8.6) |
| `outerTurretEarlyFactor` | 0.5 | (novo) | fator de dano na torre externa ate 11:00; fixo por decisao da controladoria |
| `laneAllInBase` | 0.03 | (novo) | all-in de rota antes do 1o clear; 6.14 (0.05 para 0.03) |
| `earlyPickScale` | 0.15 | (novo) | fator de pick e gank ate 14:00; 8.11 (0.45 para 0.15) |
| `prepRateMinor` | 17 | (novo) | preparo por tick de dragao, larvas e Arauto; 10.2 (16 para 17) |
| `prepRateEpic` | 28 | (novo) | preparo por tick de Barao e Elder; 8.2 (10 para 28) |
| `prepPrioScale` | 30 | (novo) | escala da prioridade de rota no preparo (piso do fator 0.25); ponto de partida, so explorado fora da tabela |
| `prepDecay` | 1.5 | (novo) | quanto o preparo cai por tick sem a intencao de preparar; 10.2 (3 para 1.5) |
| `fightResetEarly` | 220 | 220 (cooldown) | intervalo minimo entre lutas 5v5 no early, em s (antes da escala de sangue) |
| `fightResetMid` | 240 | 100 (cooldown) | idem no mid; 6.14 (150 para 240) |
| `fightResetLate` | 150 | 50 (cooldown) | idem no late; 6.14 (110 para 150) |
| `bloodChaosCoef` | 4.8 | (novo) | escala de sangue do Caos; 10.4 (3.2 para 4.8) |
| `fightAnywhereChaos` | 0.9 | (novo) | caos efetivo a partir do qual a luta 5v5 dispensa o motivo (emenda 2); 10.4 (0.6 para 0.9) |
| `stealBase` | 0.04 | (literal 0.12) | chance base de roubo com o jungler vivo (emenda 2); 10.3 |

---

## 18. Invariantes garantidas

O modelo garante (e os testes em `src/sim/*.test.ts` defendem):

1. **Determinismo total (INV-1):** mesma seed -> mesma partida. Nenhum `Math.random()`.
   A ordem e aridade de draws e estavel: `selectKiller`+`selectVictim` = exatamente
   2 draws; `assignAssists` = 0 draws. Mudar a aridade sem migrar seeds e um bug.

2. **Identidade em neutro (INV-2):** todo multiplicador novo = 1.0 em estado de economia
   flat (ouro igualado ao esperado) e comp neutra (sem champions curados). Isso garante
   que as fixtures de calibracao nao se movam pelo motivo errado:
   - `goldFightMult == 1.0` e `goldSecureMult == 1.0` em paridade de ouro (fatia 0.5,
     `(2 * 0.5)^k == 1`).
   - `compFightMult == 1.0` quando `dominantTags` e vazio.
   - `effectiveChaos == comebackElasticity` quando a volatilidade media dos jogadores e 0.
   - `flashUp = true` por padrao em estado inicial; nao muda nenhum golden.

3. **Eventos impossíveis nunca ocorrem:** Baron < 20:00, Elder sem soul, Arauto
   fora da janela (15:00 a 19:45), steal sem contest, take de epico morto - todos lancam erro.
   O preparo cheio nunca toma um objetivo ausente (`takeAttempt` exige o objetivo vivo, mesmo no
   dragao preparado antes do respawn), e o preparo zera quando o objetivo some ou e tomado.

4. **Ordem estrutural respeitada:** torre externa antes da interna antes do
   inibidor antes do Nexus.

5. **Buff de epico se perde na morte** e escala por portadores vivos.

6. **Toda partida termina:** Nexus, ou `lateRamp` forcando siege, ou cap de 60min
   decidindo por win prob.

7. **A partida nunca esta matematicamente decidida** antes do Nexus (clamp da win
   prob).

8. **Time atras tem caminho de volta real** (recompensa de objetivo, steal, objetivos,
   sorteio de luta ligado ao Caos), sem rubber-band no poder de luta (`behindBoost` foi removido).

9. **Contrato de saida validado por Zod** (`MatchResult`); estado interno nao.

10. **Regras duras em zero, medidas pelo gate `calibrate:realism`:** nenhuma torre antes de
    7:00 (garantida por `holdPoolBeforeTowerWindow` em todo ponto de queda por pool),
    Barao antes de 20:00, triple ou mais antes de 8:00, ACE antes de 8:00. Por construcao,
    **nenhum abate antes de 1:30**: o all-in de rota so existe a partir de 90 s, e picks e lutas
    exigem o 1o clear do jungler (170 s no minimo).

11. **Ouro de time = soma do ouro dos jogadores** (fonte unica: `creditPlayer`,
    `creditTeamSplit`); nao existe mais escala de ouro (`goldScale` removido).

12. **Mesma seed + mesmo config = mesma partida, byte a byte.** A ORDEM dos sorteios pode mudar
    entre versoes do motor (mudou duas vezes em 2026-10-02, golden regenerado nas duas); por
    isso o replay solo confere o vencedor gravado (`replayGuard.ts`).

13. **Uma torre de rota paga exatamente 5 placas no total** (`collectPlates` nunca passa de 5 por
    torre), seja qual for o caminho de queda (cerco, press, janela, Arauto): as placas que o pool
    ainda nao tinha tirado saem na queda, e a torre de rota nao paga ouro extra ao cair.

14. **O Caos nos extremos nao quebra o motor:** a escala de sangue fica no piso de 0.6 ou acima,
    sem NaN em ouro ou poder, e as partidas ficam longe do teto de 60 min (teste "caos nos
    extremos" de `economyWiring.test.ts` e o teste da escala em `readiness.test.ts`).

---

## 19. Pontos abertos para repensar

Tensoes conhecidas do design atual (candidatas a evolucao; documentar a decisao
aqui quando mexer):

1. **[RESOLVIDO em v1.1] Lane lead persistente.** `laneState.ts` (Fase 10)
   introduziu `LaneStateEntry.laneLead` que acumula eventos de lane e decai
   lentamente (0.985/tick). `recomputePressure` agora le `laneLead` com peso
   `LANE_LEAD_TO_PRESSURE_WEIGHT=0.15`. Ganhar a lane cedo vira pressao
   persistente que alimenta siege e objetivos.

2. **[RESOLVIDO em v1.1, REFEITO em v2.1] Ouro de time era decorativo.** Fase 9 introduziu
   `effectiveGoldPower` e os canais `goldFightMult`/`goldSecureMult` em
   `power.ts`. O peso de ouro na win prob e 0 porque o ouro ja esta
   incorporado nos resultados de luta (torres, kills, objetivos). Em v2.1 o canal deixou
   de comparar cada jogador com um ouro esperado (`K_GOLD=750`, que fazia os dois times
   subirem juntos e a vantagem relativa sumir no sorteio) e passou a usar a fatia relativa
   do time no ouro total, com saturacao de item (6.5). A economia e em ouro real (secao 8).

3. **[RESOLVIDO em v1.1] Draft / sinergia nao aparecia.** Fase 11 introduziu
   `teamComp.ts` com `CompProfile`, `compFightMult`/`compSecureMult` e
   `applyCompIntentBiases`. Dois times com numeros identicos mas comps
   diferentes agora bringam de formas diferentes (comp "dive" vs "protect-carry"
   tem vantagem distinta em cada contexto; counter-pairs assimetricos refletem
   matchups reais de LoL).

4. **Early game tem pouca consequencia de longo prazo.** A vantagem de lane
   agora e persistente (ponto 1 resolvido), mas nao modela CS/XP convertendo em
   itens especificos. Rosters "lane kingdom" e "scaling" se diferenciam melhor,
   mas ainda nao ao nivel que pro LoL mostra.

5. **Win prob e resolucao acoplados pelos mesmos pesos.** Calibrar o termometro
   mexe no juiz (via `chooseIntent` e `traitCombatMultiplier`). Pode ser intencional, mas
   dificulta ajustar drama narrativo sem mexer em quem ganha.

6. **Traits sao bonus planos pequenos.** `lane_bully` e +8 numa escala ate ~100.
   Se traits sao parte da identidade dos cards, talvez merecam efeitos mais
   visiveis e situacionais.

7. **[RESOLVIDO em v2.2, parcialmente] Calendario do early game e volume de abates.** A spec
   2026-10-02 de luta, mapa e vitoria deixou fora de escopo o calendario (first blood ~5 min,
   nenhum abate antes de 1:30, dragao ~9 min, 1a torre ~16 min, Arauto e Barao no spawn) e o
   volume (~50 abates por partida contra 27 reais). A spec de calendario e volume resolveu os
   dois com prontidao causal (1o clear do jungler, all-in de rota, preparo de objetivo, luta com
   motivo, reset, escala de sangue, placas e torre externa de 2026): as 40 bandas da regua
   passam no N=1500 (secao 16.7). Continuam abertos: (a) a **textura** (tempo continuo dentro do
   tick, acoes simultaneas no mapa, finais variados), item 4 da auditoria; (b) o 1o dragao
   mediano e a 1a torre mediana ficam **no piso** das bandas (7:45 e 14:30), e a 1a torre aos 20'
   fica perto do piso (2.74 contra 2.5); (c) 3 bandas do `calibrate:pace` (fixture sintetica 75
   contra 75) ficaram mais longe do alvo e seguem vermelhas, como regressao real registrada em
   `docs/diagnostics/calendario-e-volume-bandas.md` (torres aos 20:00, densidade comparavel de 0 a
   14 min e de 14 a 20 min); (d) o slider de Caos continua saturando o ruido de luta perto de
   0.45 (o teto de `w` em 0.6).

8. **Bandas no limite.** No gate de N=1500 as 40 bandas passam, mas no N=3000 (informativo) a
   Alma cai para 0.297 (0.003 abaixo do piso de 0.30) e a margem da Alma no gate e de 0.002; as
   outras 39 ficam dentro. Antes da spec de calendario e volume o par no limite era a Alma e o
   GPM vencedor/perdedor (`luta-mapa-vitoria-calibracao.md`, secoes 7.8 e 8). O registro da
   calibracao final e `calendario-e-volume-calibracao.md`, secoes 9 e 10.9.

9. **Roubos e o caminho do poco.** A taxa de roubo por objetivo tomado (0.026, teto 0.03) e
   controlada pelo campo `stealBase` (0.04) e pelos `contestBase*` do poco; como nasce da luta
   no poco do preparo, esta entre as bandas de menor folga (0.004 no ponto final;
   `calendario-e-volume-calibracao.md`, secoes 10.3 e 10.9).

---

## 20. Como atualizar este manual

Toda mudanca na engine deve atualizar este arquivo no mesmo commit. Checklist:

- [ ] O numero/formula que mudei esta na **secao tematica** correta?
- [ ] Esta tambem na **[tabela mestra de tunables](#17-tabela-mestra-de-tunables)**?
- [ ] Mudou uma **regra dura**? Atualize **[invariantes](#18-invariantes-garantidas)**.
- [ ] Resolvi ou criei uma tensao? Atualize **[pontos abertos](#19-pontos-abertos-para-repensar)**.
- [ ] Adicionei um **trait/evento/intencao**? Atualize a tabela/catalogo relevante.
- [ ] Incrementei a **versao** e adicionei linha no **[changelog](#21-changelog-do-manual)**.

Principio: o manual descreve o *modelo* (conceitos, formulas, porques), nao
reproduz o codigo linha a linha. Se precisar do valor exato, o codigo citado e a
verdade; o manual aponta para ele.

---

## 21. Changelog do manual

| Versao | Data | Mudanca |
|---|---|---|
| v1 | 2026-06-25 | Manual inicial. Cobre a engine state-driven completa (fases 3-9): estado, derivacao de poder, timers/objetivos, intencoes de macro, resolucao de interacao, lutas/picks/estruturas, win prob, escalares de campo, eventos e contrato de saida. |
| v1.1 | 2026-06-28 | Atualizado para cobrir sistemas das Fases 7-13: (1) Novos modulos: championMeta.ts, microMetrics.ts, laneState.ts, teamComp.ts, selection.ts, deathQuality.ts, scripts/calibrate-micro.ts. (2) Novos campos em PlayerState (metricsBase, meta, flashUp, flashCooldownUntilSec) e TeamState (laneState, compProfile). (3) Canal de ouro: effectiveGoldPower, goldFightMult (K_GOLD=750, clamp [0.7,1.4]), goldSecureMult (GOLD_SECURE_FACTOR=0.40, clamp [0.8,1.25]), expectedGoldForRoleAtMinute (500+68*min*roleMultiplier). (4) Peso de ouro na win prob corrigido de 0.00016 para 0 (substituido por goldFightMult). (5) Pressao de lane agora le laneState.laneLead (LANE_LEAD_DECAY=0.985, LANE_LEAD_CAP=60, peso=0.15); pesos de evento documentados; decayLaneState documentada no step 2. (6) Selecao de killer/vitima: priors por role/archetype (selectKiller+selectVictim=2 draws, assignAssists=0 draws); softCapDamp/PLAUSIBLE_BAND; chooseIntent com applyCompIntentBiases. (7) deathQuality: thresholds good>=200/bad<=-150; 8 kinds ctx_* e tickers contextuais. (8) Comeback: COMEBACK_VOLATILITY_COEF=0.03, teto 0.45. (9) Invariantes INV-1 (aridade de draws) e INV-2 (identidade em neutro) formalizados na secao 18. (10) Pontos abertos 1/2/3 marcados como RESOLVIDO em v1.1. |
| v2.0 | 2026-06-30 | Milestone Engine Plausibility Hardening (Fases 16-21). Nova secao 16.6 dedicada a plausibilidade probabilistica: (1) Taxonomia illegal/nearZero/rare/plausible/expected documentada com referencia a src/sim/plausibility.ts e PLAUSIBILITY_EXAMPLES (14 entradas canonicas); so illegal e regra dura, os demais sao modulados por probabilidade conforme o estado. (2) Estrutura por dano acumulado (Fase 17): StructureDamageState persistido por lane/tier, structureTimePlausibility(tier, gameTimeSec), formula multiplicativa waveMultiplier x siegeThreat x numbersAdvantage x timePlausibility. (3) Actor plausibility (Fases 18-19): freio de cascata por-lane e cross-lane com CASCADE_REDUCAO_MAX e CASCADE_N_LANE_SEC, bypass por ace/wipe (aliveCount <= 2), buildStructureActorCandidates rng-free restringindo ator por lane/fase; jungler como ator padrao de secure de objetivos; Herald nunca em nexusTurret (assert duro). (4) Harnesses de calibracao: calibrate:structures (N=800, distribuicoes de torre, relatorio em tmp/), calibrate:objectives (N=500, Baron/Herald/Elder, relatorio em tmp/), calibrate:combat (N=500, multikill/shutdown/ticker/self-kill, relatorio em tmp/); descricao de gates duros vs bandas distribucionais. (5) Workflow do golden deliberado como fonte unica: suite verde -> npm run update-golden -> conferir diff -> commit isolado de aprovacao; golden nunca regenerado em npm test (D-08). |
| v2.1 | 2026-10-02 | Luta, mapa e vitoria ligados (spec 2026-10-02, Tasks 1-11). (1) Economia em ouro real em `economy.ts`: `goldScale` removido, ouro do time = soma dos jogadores, abate 300 / first blood 400, assistencia metade do abate, bounty do patch 14.21 (1 por 4 de ouro, piso -200, shutdown >= 150 pago ate 700), torre/placa/Barao, farm passivo por funcao, tempo e vantagem de rota (secoes 8, 9.1, 13.3). (2) `tuning.ts`: `RealismTuning`, `DEFAULT_REALISM_TUNING` (valores finais), `effectiveChaos`, `fightNoiseHalfWidth`, `SimConfig.tuning` (secoes 6.5, 13.1, 17). (3) Luta: `goldFightMult`/`goldSecureMult` pela fatia relativa de ouro com saturacao de item (`goldRelevance`, 12000 a 18000 por jogador); sorteio uniforme de largura `w` ligada ao Caos; `behindBoost` removido, comeback vira recompensa de objetivo; `pickChance` pesa o ouro; `ratingPowerD` 525 para 140 (secoes 6.5, 6.6, 13.1, 13.4). (4) Janela de conversao (`conversion.ts`, `resolveConversion`): vantagem numerica com >= 3 vivos vira Barao/Anciao, dragao, Arauto/larvas ou empurrao; regra do lado do poco, regra da Smite, texto com `conversionLead` (secoes 12 passo 0b, 13.6). (5) Estruturas: canal de cerco so antes de 14:00 e so na torre externa; `siegeAdvantage` e `goldStructuralFactor` removidos; regra dura de 7:00 garantida por `holdPoolBeforeTowerWindow` (secao 13.5). (6) Objetivo disputado decidido pela luta no poco (`resolveContestedObjective`, `settlePitOwner`; secoes 12-a, 13.6). (7) Regua de realismo: `scripts/realism-metrics.ts`, `npm run realism`, `npm run calibrate:realism` (19 bandas), `scripts/sweep-realism.ts` (secao 16.7). (8) Replay solo protegido por `replayGuard.ts` (secao 4). Golden regenerado; ordem dos sorteios mudou. |
| v2.2 | 2026-10-02 | Calendario e volume de abates (spec 2026-10-02 calendario e volume, Tasks 1-9, itens 2 e 3 da auditoria, com as duas emendas de calibracao). (1) Modulo novo `readiness.ts` (secao 3): relogio do jungler (`junglerFirstClearSec`), all-in de rota a partir de 1:30, `phasePickScale`, preparo de objetivo (`prepGain`, `updateObjectivePrep`, `takeAttempt`), motivo de luta (`fightReason`), reset entre lutas (`fightResetSec`) e escala de sangue do Caos (`bloodScale`); estado novo `objectivePrep` e `prepAnnounced` e evento `objective_setup` (secoes 7.1, 11.5, 12, 13.1). (2) Regras do patch 26: larvas em leva unica aos 8:00 (somem 14:45), Arauto aos 15:00, 1o Elder 5:00 depois da Alma, ouro de objetivo (Barao e Elder 150 por jogador + 100, dragao 75, larva 30, Arauto 100, para quem confirma via `objectiveSecurer`) (secoes 8, 10.1, 10.3). (3) Estruturas: 5 placas em toda torre de rota (limiares 10/25/45/70, ouro de 120 a 80, paga as que faltam na queda), torre de rota sem ouro ao cair, resistencia da torre externa (`outerTurretDamageFactor`, 0.5 ate 11:00 e reta ate 1.0 em 15:00), `pressSiegeBase` campo de tuning (secao 13.5). (4) Janela de conversao: Barao e Elder so com 2 a mais (ou 1 a mais com o jungler inimigo morto) e so objetivo que o lado ja comecou a preparar (preparo de pelo menos 50) (secao 13.6). (5) Emenda 1: o preparo epico tem taxa propria (`prepRateEpic` 28), o que e mais longo no epico e o tempo de preparo, conferido pelo gate; torres por partida contam as torres do Nexus. (6) Emenda 2: a partir do 2o dragao o preparo pode comecar 60 s antes do respawn (`isObjectivePreparable`); com o caos efetivo em `fightAnywhereChaos` (0.9) a luta 5v5 dispensa o motivo; `stealBase` vira campo de tuning (secoes 12-a, 12-c, 13.6). (7) Regua: 40 bandas (as 22 do calendario e do volume), curva do Caos e assert do tempo de preparo (secao 16.7); `DEFAULT_REALISM_TUNING` completo na secao 17.1 (29 campos; mudaram `passiveSlopePerMin`, `goldFightExponent`, `fightNoiseBase`, `conversionSiegeBase`, `contestBaseEpic`, `siegeAccrualBase`). Golden regenerado; a ordem e a contagem dos sorteios mudaram. |
| v2.3 | 2026-10-05 | Traits novas no motor (spec 2026-10-05-traits-no-motor). (1) Modulos novos `traitEffects.ts` (funcoes puras por ponto de entrada, `TRAIT_TUNING`) e `quits.ts`. (2) `teamfights`, `flips`, `dragon_lover` (rotulo "Ama objetivos"), `roamer`, `side` e `quits` ligados (secao 5); o `side` soma `sidePressureBonus` (25) a pressao da rota dele no meio de jogo em `recomputePressure`. (3) `resolveLaneAllIn` aceita abatedor ou vitima fixos; passo 12-c1b do all-in do flips; `resolvePickoff` recebe a intencao do time da vitima; `FightContext.pitObjective`. (4) Estado: `PlayerState.away` e `quitTrack`; eventos `player_quit` e `player_returned`; snapshot do jogador com `away` opcional e `respawnInSec` null enquanto fora (quem assiste nao sabe se ele volta). (5) Chave do solo `MatchInput.newTraitEffects`. Sem portador o motor fica identico: goldens e snapshots nao mudaram. Calibracao (2026-10-05, decisao do dono): flipsVictimWeight 2,2; teamfightsSliceBonus 10; roamerGankBonus 1,5. Segunda rodada: teamfightsSliceBonus 5, para a vitoria do teamfights ficar dentro da trava de 5 pp. |
