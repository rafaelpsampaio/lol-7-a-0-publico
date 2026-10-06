# ENGINE-DIAGNOSIS.md

> **Documento de diagnostico - Fase 16.** Mapa funcao-a-funcao dos callsites de evento da engine.
> Cobre os 7 grupos do spec paragrafos 38-48: onde cada classe de evento e decidida, com
> `arquivo:linha` verificados e logica atual descrita.
> Este documento e lido pelas Fases 17-22 como referencia de onde cada correcao deve ser aplicada.
> NAO contem correcoes: apenas diagnostico. Os comentarios inline em `engine.ts` continuam proibidos (D-01).

**Engine coberta:** `src/sim/engine.ts` (1708 linhas), `src/sim/objectives.ts`, `src/sim/matchState.ts`, `src/sim/deathQuality.ts`.

**Verificado em:** 2026-06-29 (leitura direta dos arquivos antes de qualquer modificacao da v2.0).

---

## Baseline oficial da v2.2

> **Antes de comparar qualquer numero de fase da v2.2, leia `docs/baselines/24-baseline-v2.2.md`.**
> Congelado em 2026-07-29, ao fim da Fase 24, com `npm run diagnose` no commit `d5ea94b`.
> Ele, e nao o diagnostico de 2026-07-28, e a regua das Fases 25 a 30: o diagnostico de abertura
> foi medido com tres rotas estruturalmente excluidas de receber assistencia, e corrigir isso ja foi
> uma mudanca de calibracao. Comparar contra o arquivo antigo faria cada fase seguinte se creditar
> um efeito que veio da Fase 24.
> Cuidado com o alvo movel: `docs/diagnostics/engine-diagnose.txt` e reescrito a cada `npm run diagnose`;
> o arquivo em `docs/baselines/` e o congelado.

Este documento continua sendo o mapa funcao-a-funcao da v2.0. A atualizacao dele para o modelo v2.2 e trabalho declarado da Fase 30 (DOCS-02).

---

## Indice

1. [Grupo 1: Onde estrutura e destruida](#grupo-1-onde-estrutura-e-destruida)
2. [Grupo 2: Onde a engine decide lane / proxima-estrutura / wave / ator / dano-parcial](#grupo-2-onde-a-engine-decide-lane--proxima-estrutura--wave--ator--dano-parcial)
3. [Grupo 3: Onde multikill nasce](#grupo-3-onde-multikill-nasce)
4. [Grupo 4: Onde objetivos escolhem protagonista](#grupo-4-onde-objetivos-escolhem-protagonista)
5. [Grupo 5: Onde tickers contextuais sao montados](#grupo-5-onde-tickers-contextuais-sao-montados)
6. [Grupo 6: Onde shutdown e emitido](#grupo-6-onde-shutdown-e-emitido)
7. [Grupo 7: Onde rosters/sides sao montados (diagnostico de duplicidade)](#grupo-7-onde-rosterssides-sao-montados-diagnostico-de-duplicidade)
8. [Spike-Flag da Fase 17](#spike-flag-da-fase-17)
9. [Seeds-ancora dos 8 sintomas](#seeds-ancora-dos-8-sintomas)

---

## Grupo 1: Onde estrutura e destruida

| Funcao | Arquivo:Linha | Logica Atual |
|--------|---------------|--------------|
| `damageStructure()` | `engine.ts:1038` | Desce a cadeia `outer -> inner -> inhibTurret -> inhibitor -> nexusTurrets -> nexus` em `enemy.structures[lane]`. Cada tier e um `if (s.xxxAlive)` que muta para `false` e retorna `StructureDamage`. Nenhum cooldown, nenhuma acumulacao de dano: queda instantanea pelo roll de pressao. Os parametros `_strength` e `_rng` sao recebidos mas ignorados na decisao de queda (apenas o roll de pressao em `resolveStructurePressure` gatea o chamado). |
| `recordTower()` (closure interna) | `engine.ts:1061` | Incrementa `team.towersDestroyed`, aplica `FIRST_TURRET_BONUS` e bump de momentum. Closure definida dentro de `damageStructure`. |
| `finishGameStructures()` | `engine.ts:1290` | Marca `state.winner` quando o Nexus cai. Chamado de dentro de `damageStructure` via `nexusExposed`. |

**Sintoma raiz estrutural:** `damageStructure` nao tem estado persistente de dano. A estrutura vai de `alive=true` para `alive=false` em um unico tick de pressao. Nao existem campos `plates_taken`, `tower_chipped` nem `tower_low`. A progressao e binaria: intacta ou destruida.

---

## Grupo 2: Onde a engine decide lane / proxima-estrutura / wave / ator / dano-parcial

| Funcao | Arquivo:Linha | Logica Atual |
|--------|---------------|--------------|
| `resolveStructurePressure()` | `engine.ts:979` | Seleciona a lane (via `bestPressureLane` ou intent explicito), calcula `force = pressure/100 + (baron?0.5:0) + voidgrubs*0.04 + lateRamp`, entao `if (force <= 0.18 || rng() > force) return null`. Se passa, chama `damageStructure`. Nao ha verificacao de wave, wave favoravel, minion push, ou dano parcial. |
| `bestPressureLane()` | `engine.ts:1629` | Escolhe a lane com maior `state.pressure[lane]` para o side. Funcao de selecao simples por maximo. |
| `recomputePressure()` | `engine.ts:308` | Deriva `state.pressure[lane]` de `laneLaningPower`, estruturas mortas, Baron buff e `laneState.laneLead`. Nao modela waves de minions. |
| `resolveInteraction()` - secao (d) | `engine.ts:584` | Despacha `resolveStructurePressure` para intents `siege_baron`, `split_push`, `press_top/mid/bot`. |

**Ausencia critica:** Nao existe logica de "wave favoravel" nem "minions vivos". A pressao e um escalar estatico por lane, sem modelagem de wave timing. O dano e atomico: ou a estrutura cai neste tick, ou nada acontece.

---

## Grupo 3: Onde multikill nasce

| Funcao | Arquivo:Linha | Logica Atual |
|--------|---------------|--------------|
| `decorateMultikill()` | `engine.ts:935` | Apos `applyFightCasualties`, conta kills por killer via `Map<string,number>`. Se `topN >= 2`, emite `double_kill`/`triple_kill`/`quadra_kill`/`penta_kill`. Nao tem nenhuma verificacao de `gameTimeSec`: um quadrakill aos 01:30 e possivel se o contador atingir 4. |
| `applyFightCasualties()` | `engine.ts:879` | Loop de `deaths` iteracoes; cada iteracao chama `selectVictim` + `selectKiller` + `applyKill`. O numero de mortes (`loserDeaths`) vem de `clamp(round(1 + (ratio-1)*4 + rng()*1.5), 1, 5)`: ate 5 mortes no mesmo tick. |
| `resolveTeamfight()` | `engine.ts:809` | Computa `pInit`/`pDef`, calcula `loserDeaths`/`winnerDeaths`, chama `applyFightCasualties` para cada lado, depois `decorateMultikill`. |

**Sintoma raiz multikill:** `decorateMultikill` e puramente um contador de kills por jogador. Se `loserDeaths >= 4` e todas as kills foram atribuidas ao mesmo jogador, nasce um quadrakill independentemente do minuto do jogo. Nao ha gate temporal nem verificacao de plausibilidade.

---

## Grupo 4: Onde objetivos escolhem protagonista

| Funcao | Arquivo:Linha | Logica Atual |
|--------|---------------|--------------|
| `objectiveSecurer()` | `engine.ts:1623` | `if (team.players.jungle.alive) return team.players.jungle; else return bestPlayer(team, "objective")`. O jungler vivo e sempre o ator padrao de secure. Se morto, pega o melhor jogador por `objective` slice, que pode ser o ADC. |
| `makeObjectiveEvent()` | `engine.ts:1518` | Chama `objectiveSecurer(team)` para obter o ator, monta o ticker com `shortName(secured.card)`. Baron tomado exatamente no spawn: se `isObjectiveAvailable(state, "baron")` retorna `true` no tick de `TIMERS.BARON_SPAWN` (1200s), qualquer intent `setup_baron` pode triggerar o take imediatamente, sem verificacao de setup (numero de vivos, pressao, pick/ace recente). |
| `resolveUncontestedObjective()` | `engine.ts:648` | Chama `takeObjective` diretamente se o rival nao esta contestando, sem gate de setup adicional. |
| `isObjectiveAvailable()` | `objectives.ts:229` | Para Baron: `return o.baronAlive && state.gameTimeSec >= TIMERS.BARON_SPAWN`. Apenas "esta vivo e passou dos 20:00". Nenhuma condicao de setup. |

**Sintoma raiz Baron:** Baron pode ser tomado no instante exato do spawn (`gameTimeSec = 1200s`) sem qualquer setup gate. Nao ha verificacao de jungler vivo, numero de aliados vivos, pressao recente, pick ou ace anterior.

---

## Grupo 5: Onde tickers contextuais sao montados

| Funcao | Arquivo:Linha | Logica Atual |
|--------|---------------|--------------|
| `selectContextualTicker()` | `deathQuality.ts` (importado) | Retorna `string \| null`. Se `null`, o ticker generico prevalece. Se retorna string, substitui o ticker via `_lastCtxTicker` (variavel de modulo em `engine.ts`). |
| `makeKillEvent()` | `engine.ts:1435` | Le `_lastCtxTicker` (variavel de modulo scoped). Se nao null, usa como `finalTicker`. Constroi ticker generico caso contrario. |
| `applyKill()` | `engine.ts:1154` | Apos todos os `rng()`, chama `computeDeathQuality(deathCtx)` + `selectContextualTicker(dq, deathCtx)` e grava em `_lastDeathQuality`/`_lastCtxTicker`. |
| `resolveHeraldUse()` | `engine.ts:694` | Monta ticker manualmente: `${shortName(actor.card)} invocou o Arauto ${placeLabel(lane)} e ${dmg.label}.` Usa `shortName` (nome real). |
| `resolveStructurePressure()` | `engine.ts:979` | Ticker via `dmg.ticker(shortName(actor.card))`: sempre com nome real via `shortName`. |
| Tickers de objetivo | `engine.ts:1518` | `objectiveSecurer` retorna o player; `shortName(secured.card)` sempre usa nome real. |

**Sintoma raiz ticker contextual:** O problema nao esta nos tickers de estrutura/objetivo (sempre usam `shortName` e portanto nome real). O problema esta nos eventos `ctx_*` emitidos por `selectContextualTicker` via `deathQuality.ts`. Se as condicoes de um ticker contextual nao forem satisfeitas, o fallback e o ticker generico. O diagnostico atual suspeita que `selectContextualTicker` pode retornar frases com role generica em algum path de `deathQuality.ts` - a passada do harness com rosters reais vai confirmar a frequencia de tickers com role generica vs. nome real.

---

## Grupo 6: Onde shutdown e emitido

| Funcao | Arquivo:Linha | Logica Atual |
|--------|---------------|--------------|
| `applyFightCasualties()` | `engine.ts:916-929` | `const shutdown = victim.shutdownGold > 0`. Se true, emite evento `"shutdown"` via `makeKillEvent`. Cada morte em teamfight verifica independentemente: se 3 jogadores tem `shutdownGold > 0`, emite 3 eventos `shutdown` no mesmo `gameTimeSec`. |
| `resolvePickoff()` | `engine.ts:774` | `const shutdown = victim.shutdownGold > 0; if (shutdown) kind = "shutdown"`. Em pickoff, apenas 1 kill, entao no maximo 1 shutdown. |
| `recomputeBounty()` | `engine.ts:1281` | `p.shutdownGold = streak >= 2 ? Math.min(450, (streak-1)*90) : 0`. Streak = kills - deaths. |

**Sintoma raiz shutdown spam:** Em teamfight com multiplos jogadores com streak, `applyFightCasualties` emite N eventos `"shutdown"` com o mesmo `timeSec`. Nao ha deduplicacao nem agregacao de shutdowns no mesmo tick. Cada morte e processada independentemente, sem visibilidade das outras mortes do mesmo tick.

---

## Grupo 7: Onde rosters/sides sao montados (diagnostico de duplicidade)

| Funcao | Arquivo:Linha | Logica Atual |
|--------|---------------|--------------|
| `simulateMatch()` | `engine.ts:191` | Recebe `userRoster: PlayerVersion[]` e `rivalRoster: PlayerVersion[]`. Passa para `createInitialMatchState`. Nao valida duplicidade entre os dois arrays. |
| `createInitialMatchState()` | `matchState.ts` (importado) | Chama `freshTeamState("user", ..., userRoster, ...)` e `freshTeamState("rival", ..., rivalRoster, ...)`. |
| `freshTeamState()` | `matchState.ts:240` | Itera `roster` e popula `players[card.primaryRole]`. Se dois cards do mesmo roster tem o mesmo `primaryRole`, o segundo sobrescreve o primeiro silenciosamente (sem erro, sem log). |
| `selectKiller` / `selectVictim` | `engine.ts:1594-1606` | `buildKillerCandidates` e `buildVictimCandidates` iteram `ROLES.map(r => team.players[r])`: sempre 5 jogadores por time (um por role). Killer e victim sao sempre de sides opostos. |

**Diagnostico "Gumayusi vs Gumayusi":** O sintoma nao e um bug de selecao dentro do engine. Killer e victim sao sempre de sides opostos (um do `killerSide`, outro do `opponent(killerSide)`). O ticker "Gumayusi encerrou a sequencia de Gumayusi" indica que o mesmo `personId` apareceu em ambos os rosters de entrada para `simulateMatch`. O engine recebe rosters pre-montados e nao valida se o mesmo card (ou pessoa) esta nos dois lados. O problema esta no codigo de bracket/draft antes de chegar no engine.

**Para o harness (sem resolver):** Chamar `simulateMatch` com `gumayusi-2022` em ambos os rosters e logar `cardId`, `personId`, `displayName`, `teamId` de killer e victim para cada kill event onde os displayNames coincidem. A resolucao do problema de draft/bracket esta fora do escopo da Fase 16 e das Fases 17-22.

---

## Spike-Flag da Fase 17

**Resposta definitiva: `src/sim/structures.ts` NAO existe.** [VERIFIED: filesystem lido em 2026-06-29]

A logica de estrutura esta inteiramente embutida em `engine.ts`. Os pontos exatos:

| Funcao | Arquivo:Linha | Descricao |
|--------|---------------|-----------|
| `damageStructure()` | `engine.ts:1038-1139` | Decide qual estrutura cai (`outer -> inner -> inhibTurret -> inhibitor -> nexusTurret -> nexus`), muta `enemy.structures[lane]` diretamente, retorna `StructureDamage \| null`. |
| `resolveStructurePressure()` | `engine.ts:979-1025` | Decide SE ha pressao suficiente para chamar `damageStructure`, seleciona a lane e o ator. |
| `resolveHeraldUse()` | `engine.ts:694-724` | Chama `damageStructure` com `strength=1.0` para o Herald. |

**Sobre `src/sim/structures.test.ts`:** O arquivo existe e testa invariantes da win-condition via `simulateMatch`. E um teste de integracao, NAO o modulo de estruturas que falta. Nao confundir: a existencia do `.test.ts` nao implica a existencia do modulo correspondente.

**Conclusao para a Fase 17:** A Fase 17 deve comecar pela extracao de `damageStructure`, `resolveStructurePressure` e `resolveHeraldUse` de `engine.ts` para um novo modulo `src/sim/structures.ts`. Qualquer extracao deve preservar a aridade exata do RNG (ordem de chamadas a `rng()`) para nao quebrar o determinismo. O risco de regressao deterministica e alto: spike obrigatorio antes de implementar.

---

## Seeds-ancora dos 8 sintomas

> Sweep de seeds executado pelo Plano 04 com `seed=i` (i=0..199) via `scripts/find-seed-anchors.ts`.
> Resultado em `tmp/seed-anchors.txt`. Para sintomas nao encontrados no sweep, aplica-se o fallback
> de evidencia por distribuicao agregada (D-09): citar a frequencia da metrica correspondente no
> baseline de `docs/baselines/16-baseline.md`.

| Sintoma | Seed | Tier | Roster | Observado |
|---------|------|------|--------|-----------|
| 1. Torre destruida antes de 00:45 | seed=5 | STOMP 85v55 | sintetico flat | `first_tower` t=15s ticker: "u-mid derrubou a PRIMEIRA torre do jogo no meio para o Seu time." (D-09: 5.8% do total no equilibrado; p5=4:45) |
| 2. Quadrakill antes de 01:30 | seed=36 | STOMP 85v55 | sintetico flat | `quadra_kill` t=210s (3:30) ticker: "u-adc limpou a luta no meio com um QUADRA KILL!" (D-09: 4 quadra_kill na faixa 0-5min no stomp; 1.9% < 8min) |
| 3. Estruturas avancadas cedo (Herald derruba nexusTurret) | fallback D-09 | qualquer tier | n/a | Seed-ancora nao encontrada no sweep de 200 sementes: o evento `herald_used` com nexusTurret logo apos requer Herald tomado + usado na mesma partida + torre avancada ja derrubada, combinacao rara nos 200 jogos testados. Evidencia agregada: inhib < 16min e nexusTurret < 20min (proxy) ocorrem em frequencia nao desprezivel em todos os tiers -- confirma que a progressao e possivel precocemente, mas o Herald como vetor exige jogo mais longo. (NOTA WR-05: os numeros antigos "inhib 3.3%-125.6%" e "nexusTurret 4.9%-80.1%" eram erro de categoria -- contagem de EVENTOS apresentada como % de jogos, dai valores > 100%. O harness agora reporta media de eventos por jogo; rode `npm run calibrate:structures` para os valores corretos.) |
| 4. Volume e progressao de torres inconsistente (sem chip/plate) | seed=0 | STOMP 85v55 | sintetico flat | `first_tower` t=120s (2:00) sem nenhum evento de chip/plate anterior na timeline -- a torre cai diretamente sem acumulacao de dano. Evidencia estrutural: `damageStructure` nao tem estado de dano; queda e binaria (Grupo 1 acima). |
| 5. Baron tomado exatamente no spawn (20:00) sem setup | seed=21 | STOMP 85v55 | sintetico flat | `baron_taken` t=1200s (20:00 exatos) ticker: "u-jungle confirmou o Barao Nashor para o Seu time." Sem verificacao de setup em `isObjectiveAvailable` (apenas `>= 1200s`). (D-09: 12.9% dos barons no equilibrado; 28.7% no stomp) |
| 6. Ticker contextual com role generica (sem nome real) | fallback D-09 | qualquer tier | n/a | Seed-ancora nao encontrada: harness confirma 0 eventos `ctx_*` em 2400 jogos com rosters sinteticos -- `selectContextualTicker` nao dispara sem o contexto rico de `laneState`/`deathQuality`. Evidencia agregada: Grupo 5 acima mostra que o path de fallback (ticker generico) e o unico ativo atualmente; tickers `ctx_*` estao ausentes no baseline (0/0 = 0.0% de role generica, pois nenhum ctx_* foi emitido). |
| 7. Shutdown spam (N shutdowns no mesmo timeSec) | seed=2 | STOMP 85v55 | sintetico flat | 3 eventos `shutdown` no mesmo `timeSec=1020s` (17:00). Causa: `applyFightCasualties` processa cada morte independentemente em teamfight; sem deduplicacao (Grupo 6 acima). |
| 8. Gumayusi vs Gumayusi (mesmo personId nos dois rosters) | seed=0 | PROPOSITAL (real roster) | Gumayusi 2022 em user-ADC e rival-ADC | `shutdown` t=1305s actors=[Gumayusi] victims=[Gumayusi] ticker: "Gumayusi encerrou a sequencia de Gumayusi e coletou o shutdown no rio inferior." Reproducao per RESEARCH.md secao 5; o engine nao valida personId duplicado entre rosters (Grupo 7 acima). |
