# Traits novas no motor

**Data:** 2026-10-05
**Status:** desenho aprovado em brainstorming; aguardando revisão desta spec
**Escopo:** efeito na simulação das 6 traits da A-04 (`teamfights`, `flips`, `dragon_lover`, `roamer`, `side`, `quits`), o `quits` na tela e no contrato, uma chave de teste no solo e a medição de impacto antes de ir para o master. Não muda o canal de ouro (spec própria, logo depois desta).

## 1. Contexto

A spec do pack dos amigos (`2026-10-02-pack-amigos-design.md`, A-04) criou 6 traits com os ids da planilha, sem efeito no motor. As 9 traits antigas já agem (`TRAIT_SLICE_BONUS` e `traitCombatMultiplier` em `power.ts`, `TRAIT_METRIC_BONUS` em `microMetrics.ts`, `stealChanceFor` em `engine.ts`).

O motor de partida é o do master (motor de calendário e volume, `16d7ba1`), trazido para o `feat/pack-amigos` no merge `d95d581`. Todos os pontos de entrada citados abaixo são desse motor.

**Princípio do dono do produto:** as traits dizem como o jogador joga; o ouro mede o impacto dele. Uma trait muda decisões, envolvimento e habilidade numa situação. Ela não dá ouro nem poder genérico.

Uso no pack dos amigos (71 cartas): `flips` 19, `teamfights` 10, `dragon_lover` 2 (jungle), `roamer` 1 (mid), `side` 1 (top), `quits` 1 (mid). Os pros não têm nenhuma delas.

## 2. Decisões

| # | Decisão | Motivo |
|---|---------|--------|
| T-01 | **Código em dois módulos novos.** `src/sim/traitEffects.ts` tem uma função pura por ponto de entrada no motor. `src/sim/quits.ts` tem o gatilho, a saída e a volta do `quits`. Os números ficam em `TRAIT_TUNING`, dentro de `traitEffects.ts`, fora do `DEFAULT_REALISM_TUNING`. O `traits.ts` antigo não muda (só o motor legado `runMatch.ts` o usa). | Testável por função, calibração num lugar só, sem espalhar 6 traits por um `engine.ts` de 2.400 linhas. O `DEFAULT_REALISM_TUNING` é calibrado com os pros. |
| T-02 | **Neutra sem portador.** Sem as traits na partida, toda função devolve o valor neutro e nenhuma consome sorteio. | Pros, goldens, snapshots e régua de realismo ficam idênticos. |
| T-03 | **Muda pesos, não inventa jogada.** A trait mexe no peso de um sorteio que já existe. Só o all-in extra do `flips` e o quit do `quits` criam ocorrência nova. Os sorteios novos só existem quando há portador. | Respeita as regras do motor (preparo, reset, motivo de luta, guard de abate legal). |
| T-04 | **Só age com o portador em jogo.** Morto ou fora (quit), a trait dele não faz nada. A exceção é o próprio `quits`. | Mesmo critério das traits antigas (`traitCombatMultiplier` lê só vivos). |
| T-05 | **`dragon_lover` vira "Ama objetivos".** O id não muda. Vale para dragão, larvas e Arauto. Barão e Elder ficam de fora. | Pedido do dono: é sobre amar objetivos, e o Barão precisa do time. O Elder segue a mesma regra do Barão. |
| T-06 | **Gatilho do `quits`: partida ruim e momento ruim, juntos.** | Pedido do dono: "tem que estar mal na partida e passar por um momento ruim". |
| T-07 | **`quits` fora ganha só o ouro passivo do LoL** (20,4 a cada 10 s). Metade das vezes volta depois de 2 a 5 minutos e metade não volta. Quem volta joga normal. | Pedido do dono. O atraso de quem volta aparece no ouro; o efeito individual do ouro é da spec seguinte (T-08). |
| T-08 | **Ouro individual fica para a spec seguinte.** Hoje o ouro só pesa pela fatia do time. | Mexe em todas as partidas, inclusive dos pros, e precisa de calibração própria. Ordem escolhida pelo dono: traits primeiro. |
| T-09 | **Chave de teste no solo** para ligar e desligar os efeitos das 6 traits novas. | Pedido do dono: assistir à mesma partida com e sem as traits antes de aprovar. |
| T-10 | **Checkpoint de medição.** A implementação fica no branch. Vai para o master só depois de o dono aprovar o relatório de impacto. | O motor tem muitas regras se cruzando; os números decidem, não o desenho. |
| T-11 | **Replays antigos dos amigos ficam indisponíveis.** | O servidor já refaz e confere cada jogo (`server/room/replay.ts`). Jogo gravado antes da mudança cai em "gravação indisponível". Pros não são afetados (T-02). |

## 3. Mecânica por trait

Os valores são o ponto de partida. A calibração da seção 6 ajusta cada um contra o alvo.

### 3.1 `teamfights` (Bom de teamfight)

- Bônus de +6 na fatia `teamfight` do portador (mesmo mecanismo de `TRAIT_SLICE_BONUS`). A fatia entra no `fightPower`, que decide as lutas de `resolveTeamfight`: 5v5 e luta no poço. Pick, gank e all-in usam outras fatias e não mudam.
- Nas lutas de `resolveTeamfight`, peso 1,4× como quem mata e 0,85× como vítima.

### 3.2 `flips` (Flipa a lane)

Bola de neve para os dois lados: mata mais e morre mais. Alvo do dono: num stomp em que alguém ficaria 4/0, quem flipa fica perto de 8/3.

- **Envolvimento:** em todo sorteio de quem mata (`selectKiller`) e de quem morre (`selectVictim`), peso 1,5× nos dois. O `softCapDamp` continua por cima e segura placares absurdos.
- **All-in extra na rota dele:** de 1:30 a 14:00, com o portador vivo e pelo menos um inimigo vivo na rota, um sorteio por tick com chance de 0,04 × `bloodScale` abre um all-in. Não depende do 1º clear do jungler nem da vantagem mínima de `laneAllInChance`. Na rota de baixo, a rota dele é `bot` (ADC ou suporte).
- **Quem ganha:** chance do portador = 0,5 + vantagem de laning da rota / 40 + `laneLead` do time dele na rota / 120, limitada a [0,15; 0,85]. Ganhando, ele é quem mata e a vítima sai do sorteio de vítimas da rota. Perdendo, ele é a vítima e quem mata é o melhor laner inimigo da rota. O abate passa pelo `resolveLaneAllIn` de sempre (guard de abate legal, `solo_kill`/`first_blood`/`shutdown`, lane state). Como cada abate sobe o `laneLead`, quem está na frente tende a seguir ganhando.
- **Dois portadores na mesma rota, um de cada time:** um único sorteio por rota; a chance é calculada do lado `user`.

### 3.3 `dragon_lover` (Ama objetivos)

Vale para dragão, larvas e Arauto (T-05).

- **Insiste:** em `chooseIntent`, +1,5 no `setup_<objetivo>` de cada um desses que esteja preparável, com o portador vivo, à frente ou atrás.
- **Fecha rápido na frente:** com o time à frente (win prob do lado acima de 0,55), o `prepGain` desses objetivos sai 1,3×.
- **Rouba mais:** quando o preparo do inimigo num desses objetivos está em `PREP_ANNOUNCE_AT` (50) ou mais, o time do portador ganha +2 no `setup_` do mesmo objetivo. Isso leva à disputa no poço (`resolveContestedObjective`), que é onde o roubo existe. O `stealChanceFor` desses objetivos sobe 0,10 com o portador vivo.
- **Morre mais:** no tick em que o time dele escolheu preparar um desses objetivos, ele fica exposto (`FightContext.exposure`, que já existe, em 0,5) nos picks inimigos. Na luta no poço desses objetivos, peso 1,4× como vítima.

### 3.4 `roamer` (Roamer)

- Do 1º clear do jungler até 14:00, com o portador vivo, +0,6 no peso de `gank` do time (o gank continua zerado antes do clear).
- Num gank do time dele numa rota que não é a dele (a rota do gank sai de `pickGankLane`), com ele vivo: ele entra garantido nas assistências e, em metade das vezes (sorteio só quando há roamer), o abate fica com ele em vez de com o jungler. O guard de abate legal roda depois.
- **Custo:** a cada gank em que ele participa fora da rota, o `laneLead` do time dele na rota dele cai 6.
- A narração do gank cita o roam ("com o roam de Fulano").

### 3.5 `side` (Joga side)

- No meio de jogo (`state.phase === "mid"`), com o portador vivo, +1,0 no peso de `split_push`, e o `split_push` vai para a rota dele em vez de `bestPressureLane`.
- No `resolveStructurePressure` da rota dele, com ele vivo, +0,15 na força (a chance de a pressão virar dano na torre).
- Sem custo por enquanto.

Ajuste na implementação (2026-10-05): na medição, o split extra e a força de +0,15 sozinhos não derrubaram mais torres na rota do portador. Foi acrescentado um termo de +25 de pressão na rota dele no meio de jogo, enquanto ele está em jogo (`sidePressureBonus`, aplicado em `recomputePressure`; o time user soma e o rival subtrai).

### 3.6 `quits` (Quita)

- **Gatilho:** só numa morte dele, e só se as duas condições valem, contando essa morte:
  - partida ruim: 4 mortes ou mais, e mortes de pelo menos 2 × (abates + assistências);
  - momento ruim: 3 mortes ou mais nos últimos 300 s, sem nenhum abate dele depois da primeira dessas mortes.
- **Sorteio:** no fim do tick em que ele morreu, depois de todos os outros sorteios do tick. Chance de 1 em 3. No máximo um quit por partida.
- **Fora:** `away = true`, continua morto (`alive = false`), não farma e conta 0 em `teamSlice` e `laneLaningPower` (um morto comum conta 0,15 nas duas). Ganha 122,4 de ouro por minuto (o passivo do LoL), creditado a cada tick por `creditPlayer`. Um segundo sorteio decide a volta: metade das vezes `respawnAtSec` = agora + 120 a 300 s (terceiro sorteio), metade fica `null` e ele não volta.
- **Volta:** o `processRespawns` traz de volta como qualquer morto; `away` volta a `false`. Ele joga normal com o ouro que tem.
- **Narração:** "Fulano quitou a partida." e "Fulano voltou para a partida." (seção 4).
- Com um a menos, a janela de conversão do inimigo abre (`conversionSide`). Isso é esperado: tende a fechar rápido um jogo que já estava perdido.

### 3.7 Valores iniciais (`TRAIT_TUNING`)

| Campo | Valor |
|---|---|
| `teamfightsSliceBonus` | 6 |
| `teamfightsKillerWeight` / `teamfightsVictimWeight` | 1,4 / 0,85 |
| `flipsKillerWeight` / `flipsVictimWeight` | 1,5 / 1,5 |
| `flipsAllInChance` | 0,04 (× `bloodScale`) |
| `flipsAllInFromSec` / `flipsAllInUntilSec` | 90 / 840 |
| `flipsEdgeScale` / `flipsLeadScale` | 40 / 120 |
| `flipsWinMin` / `flipsWinMax` | 0,15 / 0,85 |
| `objectiveLoverSetupBonus` | 1,5 |
| `objectiveLoverAheadPrepMult` | 1,3 |
| `objectiveLoverContestBonus` | 2 |
| `objectiveLoverStealBonus` | 0,10 |
| `objectiveLoverExposure` | 0,5 |
| `objectiveLoverPitVictimWeight` | 1,4 |
| `roamerGankBonus` | 0,6 |
| `roamerKillShare` | 0,5 |
| `roamerLaneLeadCost` | 6 |
| `sideSplitBonus` | 1,0 |
| `sideForceBonus` | 0,15 |
| `sidePressureBonus` | 25 |
| `quitMinDeaths` / `quitDeathRatio` | 4 / 2 |
| `quitStreakDeaths` / `quitStreakWindowSec` | 3 / 300 |
| `quitChance` | 1/3 |
| `quitReturnChance` | 0,5 |
| `quitReturnMinSec` / `quitReturnMaxSec` | 120 / 300 |
| `afkGoldPerMin` | 122,4 |

## 4. `quits` no estado, no contrato e na tela

**Estado (`matchState.ts`).** O `PlayerState` ganha:
- `away: boolean` (falso por padrão);
- `quitTrack`, só para quem tem `quits`: horários das mortes recentes, horário do último abate, se o sorteio está pendente no tick e se o quit já foi usado.

**Contrato (`types.ts`, compartilhado com o servidor).**
- `PlayerMapSnapshotSchema` ganha `away: z.boolean().optional()`. Jogos antigos, sem o campo, continuam válidos. Enquanto ele está fora, `respawnInSec` é `null`: quem assiste não sabe se ele volta.
- Eventos novos `player_quit` e `player_returned`, no `EventKind` (`simEvents.ts`) e na lista persistida (`types.ts`), do mesmo jeito que o `objective_setup` entrou. Não mexem em placar nem em ouro. O ator é o jogador.
- `ticker.ts`: "Fulano quitou a partida." e "Fulano voltou para a partida."

**Tela.**
- `RiftMap`: ícone apagado, como o de um morto, com "SAIU" no lugar do relógio de renascimento.
- `TeamPanel` e `TabScoreboard`: a linha mostra "saiu" no lugar do estado de morto.
- `EventTicker`: os dois eventos entram nos Destaques (`SUMMARY_KINDS`) e ganham rótulo.
- Depois da volta, nenhuma marca.

## 5. Chave de teste no solo (T-09)

- `src/storage/traitEffects.ts`: sinal salvo no navegador, padrão ligado, no mesmo molde de `src/storage/chaosLevel.ts`.
- Interface: uma chave "Efeitos das traits novas" ao lado do slider de Caos no solo.
- `MatchInput` ganha `newTraitEffects: z.literal(false).optional()` (ausente = ligado). O `StoredGame` do torneio guarda o valor, para o replay de um jogo do solo refazer igual. `runMatchEngine` repassa para o `SimConfig` (`newTraitEffects`, padrão `true`).
- Desligada, o motor age como se ninguém tivesse as 6 traits novas. As 9 antigas continuam.
- Na sala, sempre ligada: o servidor não manda o campo.
- Depois da aprovação dos números, a chave sai da tela. O campo do contrato fica, para os jogos já gravados continuarem refazendo igual.

## 6. Medição e aprovação (T-10)

**Harness `scripts/calibrate-traits.ts`.** Para cada trait: mesmas sementes e mesmos elencos, com e sem a trait num jogador, cerca de 1.000 partidas. Elencos: cartas planas de mesma força (isola a trait) e cartas reais do pack dos amigos.

| Trait | O que mede | Alvo inicial |
|---|---|---|
| `flips` | Abates e mortes do portador nas vitórias com diferença de 15 abates ou mais | Abates cerca de 2× e mortes de perto de 0 para perto de 3 por partida (o "4/0 vira 8/3") |
| `teamfights` | Lutas de `resolveTeamfight` vencidas pelo time | +5 a +8 pontos percentuais |
| `dragon_lover` | Dragões, larvas e Arautos do time; roubos; mortes do portador | Mais objetivos, roubos cerca de 2×, mortes do portador de +10% a +25% |
| `roamer` | Ganks do time; abates e assistências do portador fora da rota; `laneLead` da rota dele | Os dois primeiros sobem; o `laneLead` cai |
| `side` | Torres derrubadas na rota dele no meio de jogo | Sobem |
| `quits` | Partidas do portador com quit; voltas | Cerca de 1 em 8 (12%); metade volta |

- **Trava geral:** nenhuma trait sozinha muda a taxa de vitória do time em mais de 5 pontos percentuais. O `quits` é exceção e pode derrubar.
- **Sanidade do pack:** torneios com o pack dos amigos, com a chave ligada e desligada: abates por partida e duração ficam a até 15%.
- **Efeitos colaterais reportados:** hora do 1º dragão e da 1ª torre, abates por fase, roubos, duração das partidas com quit, número de janelas de conversão.
- **Pros:** `calibrate:realism` sem diferença nenhuma (T-02).

**Relatório de impacto.** `docs/diagnostics/traits-calibracao.md`, publicado também como página para revisão, com: os números de cada trait contra o alvo, o pack com e sem as traits, a régua dos pros e partidas de exemplo lado a lado (mesma semente, com e sem as traits, com placar e eventos dos portadores).

**Processo.** O dono revisa o relatório e assiste partidas no solo com a chave (seção 5). O que não bater, ajusta-se no `TRAIT_TUNING` e mede-se de novo. Só com a aprovação dos números o branch vai para o master.

## 7. Testes

- **Neutralidade:** goldens e snapshots passam sem regeneração. Para cada função de `traitEffects.ts` e `quits.ts`: sem portador, valor neutro e zero sorteios (gerador contador).
- **Unidade:** cada função com e sem portador, portador morto e fora, limites de fase e de horário. `quits`: cada condição sozinha não dispara; as duas juntas disparam com o sorteio; um quit por partida; volta e não volta; ouro passivo por tick.
- **Motor:** quem quitou sai de `aliveCount` e conta 0 em `teamSlice` e `laneLaningPower`; volta pelo `processRespawns`; `player_quit` e `player_returned` saem na timeline e validam no contrato; o all-in do `flips` respeita o guard de abate legal; o `split_push` do `side` vai para a rota dele.
- **Contrato:** fixture antiga sem `away` valida; os eventos novos validam.
- **Tela:** `RiftMap`, `TeamPanel` e `TabScoreboard` mostram "SAIU"/"saiu" com `away`; os eventos aparecem nos Destaques.
- **Chave:** mesma semente com a chave desligada dá a mesma partida que sem as traits; o replay de um jogo do solo com a chave desligada refaz igual.
- Antes de concluir: `npm test`, `npm run typecheck:server`, `npm run build` e `calibrate:realism` sem diferença.

## 8. Documentação

- `src/data/traitInfo.ts`: `dragon_lover` com rótulo "Ama objetivos" e descrição nova; descrições das 6 batendo com o efeito; sai o comentário "efeito na simulacao ainda nao implementado".
- `docs/ENGINE-MANUAL.md`: catálogo da seção 5 com as 15 traits e onde cada uma age; `quits` nas seções de estado e de eventos; linha no changelog.
- `docs/DATA-DICTIONARY.md`: catálogo atualizado, sem a marca de "sem efeito".

## 9. Fora do escopo

- **Ouro individual (spec seguinte).** Registro do pedido do dono: o ouro de cada jogador deve medir o impacto dele. Quem está atrás no ouro pesa menos na luta 5v5 e é menos focado nela, mas é mais fácil de pegar em pick; quem está na frente pesa mais, é mais focado e mata mais. Dá para ganhar com um jogador afundando, mais difícil quanto maior o buraco. Depois dessa spec, a calibração das traits roda de novo.
- Custo opcional do `side` (chegar atrasado na luta depois do split).
- Mudar as 9 traits antigas ou as traits de campeão.
