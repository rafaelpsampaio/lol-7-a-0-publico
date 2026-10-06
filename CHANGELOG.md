# Changelog - LoL 7 a 0

Todas as mudancas notaveis neste projeto estao documentadas aqui.
Versoes seguem [Semantic Versioning](https://semver.org/).
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## 2026-10-05 - Host remoto automático no multiplayer

- `npm run play:online` compila e abre o servidor com túnel e `--host-auto`:
  o primeiro jogador que entra pelo link comum assume os controles da sala.
- Após 60 segundos sem reconectar, o host passa ao próximo jogador conectado,
  inclusive durante draft, torneio e pódio. O modo e o papel sobrevivem a reinícios.
- A troca automática desliga "Assistir juntos"; o novo host pode ligá-lo novamente.
- O editor mantém um segredo separado, sem dar acesso aos arquivos para quem
  assume o multiplayer. O modo manual e o solo continuam disponíveis.
- Protocolo da sala v8; snapshots v5 anteriores continuam sendo restaurados.

---

---

## 2026-10-05 - Menu do dono e editor de pacotes

Os pacotes passaram a morar em arquivos do projeto e ganharam um editor de verdade, aberto só para quem é dono da instância.

### O que muda para quem joga

- **Menu do dono.** Quem abre o link de host cai num menu com Jogo solo, Editar pacotes e, com a sala no ar, Multiplayer. Amigos continuam entrando direto na sala.
- **Editor de pacotes.** Lista de pacotes (criar, importar e exportar planilha, excluir) e um editor por pacote: pessoas e cartas, fases, rota, ano, traits, campeões e foto. Nada vai para o arquivo até o Salvar; Descartar volta ao que estava salvo. O servidor grava em `public/packs/<id>.json` (`public/players.json` para os Pros) e a foto em `public/players/<personId>.jpg`, uma por pessoa, valendo para todas as cartas dela. Para levar ao outro PC, é só commitar.
- **Força dos Pros recalculada.** A força na rota virou a média arredondada das três fases (`round((lanePhase + midGame + lateGame) / 3)`), a mesma regra dos Amigos. 35 das 40 cartas dos Pros mudaram de força; os números estão em `docs/qa/2026-10-05-recalculo-dos-pros.md`. A calibração do motor ficou igual.
- **Uma rota por carta.** A mesma pessoa em outra rota é outra carta.
- **Saiu o editor antigo.** O gerenciador de pacotes e o editor de jogadores dentro do navegador, e as edições (overrides) que ele guardava, foram removidos. As edições antigas feitas no navegador não são mais lidas.
- **Pacote com arquivo quebrado** aparece na lista com o erro, em vez de sumir, e não entra no solo nem no lobby.

### Para quem mexe no código

- `server/pacotes/` (rotas `/api/pacotes`, `/api/fotos`, `/api/dono`) e `src/pacotes/` (telas e regras puras). As regras da carta moram em `src/pacotes/regrasDaCarta.ts` e o servidor as alcança só por `server/engine/pacotes.ts`.
- Escrita só com o token do dono (cabeçalho `x-dono`), guardado em `server/data/dono.token`. No `npm run dev`, o plugin do Vite aceita só loopback da própria página.
- Spec: `docs/superpowers/specs/2026-10-05-editor-de-pacotes-design.md`.

---

## 2026-10-02 - Pack dos amigos

As cartas dos amigos entraram no jogo, e o baralho do draft ganhou uma regra nova.

### O que muda para quem joga

- **Pacote Amigos.** 71 cartas de 32 amigos, prontas no solo (Pacotes) e na lista de bases do
  lobby da sala.
- **Carta única no torneio.** A carta escolhida sai do baralho de todos, mas a mesma pessoa pode
  aparecer em outro time com outra versão (outro ano ou outra rota). No mesmo time, nunca.
- **A base só libera o draft quando nenhum time pode ficar sem rota.** O lobby e o menu do solo
  dizem quantas cartas faltam e em qual rota.
- **Seis traits novas**: Bom de teamfight, Flipa a lane, Ama dragão, Roamer, Joga side e Quita.
  Ainda sem efeito na partida. Cada carta pode ter até 4 traits.
- **Ano opcional.** Carta sem ano não mostra ano.

### Para quem mexe no código

- `src/draft/deckSafety.ts`: conta de pior caso do baralho, usada pelo servidor, pelo lobby e
  pelo solo. Protocolo da sala v5 e snapshot v5 (sala em andamento da versão anterior é
  descartada).
- `npm run pack:amigos` gera `public/packs/amigos.json` a partir da aba Planilha3 do
  `macacos.xlsx`. A importação de planilhas lê `trait1` a `trait4`, deixa o ano vazio e usa a
  média das 3 fases quando a força está vazia.

---

## 2026-10-02 - Motor: calendário e volume de abates (itens 2 e 3 da auditoria)

As partidas agora seguem o ritmo de uma partida profissional real: começo quase vazio, objetivos
tomados com preparo, torres a partir dos 14 a 16 minutos e lutas concentradas em volta de
objetivos, com cerca de 30 abates por partida em vez de cerca de 50. Detalhes técnicos em
`docs/ENGINE-MANUAL.md` (versão 2.2) e a calibração completa em
`docs/diagnostics/calendario-e-volume-calibracao.md`.

### O que muda para quem joga

- **Começo de partida calmo.** O jungler só ganka depois de terminar o primeiro clear (perto dos
  3 minutos), e antes disso só sai abate por all-in de rota, a partir de 1:30. O first blood
  mediano passou de 1:00 para 5:30, e nenhum abate acontece antes de 1:30.
- **Objetivo com preparo.** Dragão, larvas, Arauto, Barão e Ancião deixam de cair assim que
  nascem. O time prepara (visão, prioridade de rota, Smite pronto), o relato mostra "O time
  começa a preparar o objetivo" e só então vem a tentativa de tomada. Se os dois times preparam o
  mesmo objetivo, vira luta no poço. A partir do 2º dragão o preparo pode começar até 60 segundos
  antes do respawn.
- **Barão só com vantagem de verdade.** Depois de uma luta ou pick ganho, a vantagem numérica só
  vira objetivo se o time já começou a prepará-lo; Barão e Ancião pedem dois jogadores a mais (ou
  um a mais com o jungler inimigo morto). Sem isso, a vantagem vira pressão de torre.
- **Luta com motivo.** O 5v5 só acontece quando há motivo (objetivo vivo ou nascendo, torre sob
  cerco ou buff de Barão ou Ancião) e depois de um intervalo de reagrupamento. No Caos alto
  (perto do máximo do slider) os times brigam em qualquer lugar.
- **O Caos controla o sangue.** O slider agora muda duas coisas: o quanto a partida pode virar e o
  quanto sangue sai. No padrão ficam cerca de 30 abates por partida, e no máximo do slider cerca
  de 43. A metade da virada (a largura do ruído da luta) agora satura perto do slider 0,45 (antes
  perto de 0,70), porque o ruído base da luta subiu de 0,255 para 0,375. Acima disso o slider só
  acrescenta sangue e, a partir de 0,9, dispensa o motivo de luta.
- **Torres a partir dos 14 a 16 minutos.** A torre externa resiste até 11:00 e perde resistência
  até 15:00. A primeira torre cai na mediana aos 14:30 (antes aos 9:45), com 0,8 torres derrubadas
  até os 15 minutos (antes 2,9). Nenhuma torre cai antes de 7:00.
- **Replays de torneios antigos podem aparecer como indisponíveis.** A mesma seed agora gera outra
  partida, então um torneio salvo antes desta versão pode mostrar "gravação indisponível" em vez da
  timeline. O guarda do replay solo (`src/tournament/replayGuard.ts`) compara só o vencedor: um
  jogo antigo de torneio solo cujo vencedor por acaso coincida será reproduzido como outra partida,
  em vez de mostrar "gravação indisponível".

### Regras do patch 26 adotadas

| Regra | Antes (2024) | Agora (patch 26) |
|---|---|---|
| Larvas do Vazio | 2 levas a partir de 5:00 | 1 leva de 3 às 8:00, sem respawn, somem às 14:45 |
| Arauto | 14:00 | 15:00 (some às 19:45) |
| 1º Ancião | 6:00 depois da Alma | 5:00 depois da Alma (respawn de 6:00) |
| Placas | só na torre externa, até 14:00 | 5 em toda torre de rota (limiares 10, 25, 45 e 70 de dano; a 5ª é a queda), sem corte de horário |
| Ouro da placa | 125 | 120, caindo 10 por minuto completo depois de 11:00, até 80 a partir de 15:00 |
| Ouro das torres | externa 250, interna 225, do inibidor 250 | 0 ao cair (o ouro vem nas placas); torre do Nexus e inibidor 50; 1ª torre mais 300 |
| Ouro do Barão e do Ancião | 300 por jogador vivo (só o Barão) | 150 para cada jogador do time, vivo ou morto, e mais 100 para quem confirma |
| Ouro do dragão, da larva e do Arauto | nenhum | 75, 30 por larva e 100, para quem confirma |

"Quem confirma" é o jungler vivo; com ele morto, o jogador vivo de melhor fatia de objetivo.

### Antes e depois (cenário do app, 1500 partidas)

Antes: `docs/diagnostics/realism-audit-calendario-linha-de-base.txt`. Depois:
`docs/diagnostics/realism-audit.txt`. Das 22 bandas novas do calendário e do volume, 20 estavam
fora antes e as 40 bandas da régua (as 22 novas e as 18 da spec anterior) estão dentro agora.

| Métrica | Referência real | Antes | Depois |
|---|---|---|---|
| First blood mediano | 4:54 | 1:00 | 5:30 |
| First blood antes de 1:30 | 0% | 63,1% | 0% |
| Abates até os 10 minutos | 3,2 | 10,2 | 3,9 |
| Abates por partida | 27 | 49,6 | 30,7 |
| 1º dragão mediano | 9:10 | 5:15 | 7:45 |
| 1º dragão antes de 6:00 | 0% (mínimo 6:31) | 93,7% | 0,5% |
| Dragões por partida (com Ancião) | 4,45 | 5,43 | 3,96 |
| Partidas com Alma | 42% | 67,5% | 30,2% |
| Partidas com Ancião | 8% | 28,5% | 4,5% |
| 1ª torre mediana | 16:34 | 9:45 | 14:30 |
| Torres até os 15 minutos | 0,85 | 2,87 | 0,80 |
| Barões por partida | cerca de 1,45 | 2,20 | 1,37 |
| 1º Barão até 21:00 (entre as partidas com Barão) | sem fonte firme | 63,2% | 2,2% |
| Duração média (min) | 32,3 | 31,6 | 34,5 |
| Abates por partida no slider de Caos 0 / 0,25 / 0,5 / 0,75 / 1 | sobe e passa de 38 no máximo | 47,3 / 50,4 / 51,5 / 52,3 / 52,4 | 25,9 / 30,6 / 36,3 / 38,9 / 43,0 |

A Alma ficou no piso da banda (0,302 contra 0,30), e no teste de robustez com 3000 partidas ela
cai para 0,297; as outras bandas ficam dentro.

### Regressões reais registradas

Três bandas do `calibrate:pace`, medidas na fixture sintética 75 contra 75 espelhada (sem
vantagem de rota, então o all-in de rota nunca dispara), ficaram mais longe da referência real.
Torres aos 20:00 estava dentro da faixa e ficou vermelha. As duas bandas de densidade já estavam
vermelhas e se afastaram ainda mais da faixa. Nenhuma banda da régua nova foi afrouxada; os gates
antigos que foram reancorados ou redefinidos estão listados mais abaixo (registro completo em
`docs/diagnostics/calendario-e-volume-bandas.md`):

| Banda (`calibrate:pace`) | Faixa | Antes | Depois | Situação |
|---|---|---|---|---|
| Torres aos 20:00 | 2,5 a 5,0 | 3,440 | 2,121 | estava dentro, ficou vermelha |
| Densidade comparável de 0 a 14 min (eventos por minuto) | 0,46 a 0,68 | 0,807 | 0,258 | já vermelha, mais longe |
| Densidade comparável de 14 a 20 min (eventos por minuto) | 1,19 a 1,79 | 0,787 | 0,735 | já vermelha, mais longe |

No caminho do app, as mesmas métricas ficam dentro da régua: torres aos 20 minutos em 2,74, e
abates aos 10 e aos 15 minutos em 3,9 e 7,5. O `calibrate:pace` segue com uma quarta banda
vermelha herdada (razão de abates do vencedor sobre o perdedor, agora mais perto da banda).

### Âncoras reancoradas e provas redefinidas

Nenhuma banda da régua nova (`calibrate:realism`) foi afrouxada. Na Task 8, alguns gates antigos
foram reancorados ou redefinidos pelas regras do registro
(`docs/diagnostics/calendario-e-volume-bandas.md`):

- `calibrate:micro`, abates do ADC: o piso caiu de 7,96 para 7,31, que fica abaixo da faixa real
  somada (8,06 a 9,14); o valor medido é 7,66.
- `calibrate:pace`, ACOPLAMENTO P2: a banda foi reancorada em [2,64; 3,00] depois que a armadilha
  de preservação disparou (o valor foi de 1,955 para 2,779).
- `calibrate:pace`, razão de torres por abates: agora conta as torres do Nexus, como a referência.
- `calibrate:pace`, dispersão da 1ª torre: a âncora passou para o CV real de 2026.
- Prova de mutação de `maxCasualties`: virou uma banda sobre o tamanho do efeito.

### Margens finas

Várias bandas passam por pouco e podem virar com outra seed ou outro N. A mediana do 1º dragão
(465 s) e a da 1ª torre (870 s) estão exatamente no piso da banda, e a Alma está em 0,302 contra
0,30 (0,297 com 3000 partidas). O 1º dragão medido ficou em cerca de 8:00 (480 s) em jogos
parelhos e em cerca de 7:15 (435 s) para o lado que domina bot e mid, contra o alvo da spec de
perto de 9:00 e perto de 7:00. As duas medidas são acompanhadas sem gate
(`firstDragonEvenMedianSec` e `firstDragonDominantMedianSec` em `scripts/realism-metrics.ts`).

---

## 2026-10-02 - Motor: luta, mapa e vitória ligados

O vencedor de cada partida agora sai das lutas e dos objetivos, como no jogo de verdade, e não
mais da corrida de torres. Detalhes técnicos em `docs/ENGINE-MANUAL.md` (versão 2.1).

### O que muda para quem joga

- **O vencedor sai das lutas e do mapa.** Ganhar uma luta ou um pick vira objetivo e torre, o
  objetivo vira ouro, e o ouro vira poder nas lutas seguintes. O líder de ouro e de abates passa
  a vencer na proporção de partidas reais, e o favorito claro vence cerca de 75% a 85% das
  vezes em jogos de liga, nunca 100%.
- **Ouro real.** Abate, assistência, torre, placa e Barão pagam o valor do jogo, com bounty e
  shutdown como no patch 14.21. O time atrás no ouro recebe um bônus ao pegar dragão, torre ou
  Barão, e o slider de Caos controla o quanto a partida pode virar.
- **Janela depois de luta ganha.** Quem sai da luta com mais gente viva aproveita: pega Barão,
  Ancião, dragão, Arauto ou larvas e, sem objetivo, derruba torre. O relato do jogo mostra a
  causa, por exemplo "Com dois a mais depois da luta no meio, ..." ou "Após o ACE, ...".
- **Roubo de objetivo mais raro e com Smite.** O objetivo continua disputável mesmo em
  inferioridade numérica, principalmente com o jungler vivo. Os roubos caíram de cerca de 9%
  para cerca de 2% dos objetivos tomados, e com o jungler morto quase nunca acontecem.
- **Partida longa.** Quando todo mundo fecha a build (perto dos 32 a 35 minutos), o ouro para de
  pesar e decidem o mapa, os dragões, a habilidade e a composição. Nenhuma torre cai antes de 7:00.
- **Replays de torneios antigos podem aparecer como indisponíveis.** A mesma seed agora gera
  outra partida, então um torneio salvo antes desta versão pode mostrar "gravação indisponível" em
  vez da timeline, no lugar de exibir um vencedor que não bate com o jogo refeito.

---

## [1.1.0] - 2026-06-28

Camada de micro-realismo da simulacao (Fases 7-14). A engine passou de uma base
puramente numerica (atributos de lane/mid/late + traits) para um modelo com
archetypes de campeao, ouro como canal de poder, estado de lane persistente,
perfil de composicao de time, selecao KDA com priors, classificacao de mortes e
personas de jogador configuradas por presets.

### Adicionado

- **`src/sim/championMeta.ts` - Archetypes de campeao**: modulo com interface
  `ChampionMeta` (7 campos: `primaryClass`, `functionalTags`, `econProfile`,
  `scalingCurve`, `killBias`, `assistBias`, `deathRisk`), tabela `CHAMPION_META`
  cobrindo aproximadamente 167 campeoes em lowercase-kebab, `ROLE_DEFAULTS` de
  fallback por role e `NEUTRAL_META` para estado neutro. A funcao
  `championMetaFor(championId, role)` nunca retorna NaN nem crasha; campeoes
  desconhecidos caem em `ROLE_DEFAULTS`. O `PlayerState.meta` e resolvido uma vez
  no build e congelado.

- **`src/sim/microMetrics.ts` - MetricsBase em 3 camadas**: interface plana com
  18 metricas divididas em quatro grupos (KDA/Selecao, Luta, Lane/Mapa, Macro).
  Camada 1: `baseMetrics(card)`, le apenas o card. Camada 2:
  `overlayChampion(base, meta, mastery)`, tempera com archetype e mastery. Camada
  3: `contextMetrics(p, state)`, 3 campos extras dependentes do estado da partida,
  nunca cacheados. O `PlayerState.metricsBase` armazena as camadas 1+2 congeladas
  no build.

- **`src/sim/power.ts` - effectiveGoldPower e canais de ouro**: funcao
  `effectiveGoldPower` com 8 componentes de decomposicao (`GoldPowerComponents`).
  O ouro agora alimenta `fightPower` via `goldFightMult` (sigmoid com K_GOLD=750,
  clamp [0.7, 1.4]) e `securePower` via `goldSecureMult` (GOLD_SECURE_FACTOR=0.40,
  clamp [0.8, 1.25]). A funcao `expectedGoldForRoleAtMinute` calcula a ancora de
  ouro esperado por role (base: 500 + 68 * minuto; multiplicadores: adc=1.12,
  mid=1.06, top=1.00, jungle=0.88, support=0.60).

- **`src/sim/laneState.ts` - Lane state persistente**: interface `LaneStateEntry`
  com 9 campos (`laneLead`, `csDiff`, `xpDiff`, `plateGold`, `resetAdvantage`,
  `matchupVolatility`, `jungleAttentionReceived`, `weaksideState`, `prioScore`).
  `TeamState.laneState` armazena o estado por lane. `updateLaneState` acumula
  eventos com pesos fixos (solo_kill=16, gank_converted=14, first_blood=12,
  dive=10, first_tower=6, plate=4). `decayLaneState` aplica LANE_LEAD_DECAY=0.985
  por tick, mantendo o lead no intervalo [-60, +60] (LANE_LEAD_CAP). Interface
  `StrongsideSnapshot` e funcao `computeStrongsideScore` calculam
  strongside/weakside a partir de blend de lead, scaling e estado de weakside.

- **`src/sim/teamComp.ts` - teamCompProfile**: interface `CompProfile` com
  `dominantTags` e `scores` por `CompTag` (14 tags: teamfight, pick, poke, siege,
  split, dive, protect-carry, early-snowball, scaling, front-to-back, wombo,
  disengage, skirmish, objective-control). `deriveCompProfile` e calculado uma vez
  no build e congelado em `TeamState.compProfile`. `compFightMult` (clamp
  [0.93, 1.07]) e `compSecureMult` (clamp [0.95, 1.05]) enviesam poder de luta e
  de objetivo conforme a composicao. `applyCompIntentBiases` aplica biases de
  intencao em `chooseIntent`. `COUNTER_PAIRS` define 5 pares de counter canonicos
  (ex.: dive > scaling).

- **`src/sim/selection.ts` - Priors de selecao KDA por role/archetype**: funcoes
  `selectKiller` e `selectVictim` (1 draw rng cada) usam priors derivados do
  archetype do campeao para escolher quem abate e quem morre. `assignAssists` e
  determinisfico (0 draws rng). `softCapDamp` aplica weight-damping gradual nos
  contadores de kills/mortes/assistencias sem cap rigido, baseado em
  `PLAUSIBLE_BAND` (tabela por Role x ArchBand x StatBand com `hiSoft`/`hiHard`).

- **`src/sim/deathQuality.ts` - DeathQuality e eventos contextuais**: funcao
  `computeDeathQuality` classifica cada morte como `"good"` (score >= 200),
  `"bad"` (score <= -150) ou `"neutral"`. Override: suporte de engage que inicia
  uma luta resultando em 2+ kills do time recebe `"good"` diretamente.
  `selectContextualTicker` retorna um ticker em pt-BR ou null. 8 EventKinds
  contextuais adicionados em `simEvents.ts`: `ctx_support_died_warding`,
  `ctx_adc_caught_no_flash`, `ctx_top_dive_weakside`, `ctx_bot_won_2v2`,
  `ctx_enchanter_saved_carry`, `ctx_adc_cleaned_fight`,
  `ctx_scaling_survived_early`, `ctx_support_engage_decisive`.

- **`scripts/calibrate-micro.ts` - Harness de calibracao micro**: script
  executavel via `npm run calibrate:micro` (config `vitest.calibrate-micro.config.ts`).
  Valida bandas de plausibilidade com N=800 partidas. Cenarios cobertos: stomp de
  bot, top weakside util, jungle carry snowball, scaling comp virando, support
  engage decisivo.

- **`src/data/presets.ts` - Catalogo de 12 presets de persona**: cada preset
  mapeia um rotulo em giria BR para um pacote completo dos 11 campos de `advanced`
  (escalas 0.0-1.0). Presets aprovados: Perna, Ok, Bom de lane, Farmador passivo,
  Agressivo e morre, Suporte util sem dano, Jungler perdido, Carrega se forte,
  Tilta quando morre, Segura weakside, Mecanico sem macro, Shotcaller nato.

- **Bloco `advanced` opcional no card**: 11 campos de persona (`riskProfile`,
  `resourceDemand`, `weaksideTolerance`, `carryPotential`, `volatility`,
  `shotcalling`, `roamTendency`, `sideLaneDiscipline`, `killBias`, `assistBias`,
  `deathRisk`) mais `advanced.notes` (max 500 chars) e `advanced.tags` (max 10,
  ganchos neutros sem impacto na simulacao). O bloco e completamente opcional
  (REG-01: cards sem `advanced` continuam validos).

- **Campos pre-pick no card** (`photo`, `tags`, `style`, `shortDescription`):
  campos opcionais de topo do card usados apenas na UI pre-draft; sem impacto na
  simulacao.

- **Picker de persona na UI** (Phase 14): bloco "Avancado" colapsavel no
  PlayerEditor com picker de preset e edicao individual dos 11 campos de persona.
  `effectiveAdvancedFields(card)` retorna os campos efetivos (preset ou override
  manual) para exibicao.

- **Invariante INV-1 (aridade de draws)**: `selectKiller` + `selectVictim` =
  exatamente 2 draws de rng por kill. `assignAssists` = 0 draws (determinisfico).

- **Invariante INV-2 (identidade em neutro)**: em fixtures com stats chapados e
  gold igual ao esperado, `effectiveGoldPower` == 1.0 e `microMetrics` nao altera
  a calibracao base.

### Modificado

- **Peso de ouro na win prob removido**: `WINPROB_WEIGHTS.gold` passou de
  0.00016 para 0. O ouro agora e considerado via `goldFightMult` e
  `goldSecureMult` em `fightPower`/`securePower`, eliminando o double-counting
  (resolucao de GOLD-02).

- **Pressao de lane lida de lane state persistente**: `recomputePressure` agora
  le `laneState.laneLead` (acumulado por tick) em vez de recomputar a pressao do
  zero a cada tick. `decayLaneState` e chamado no step 2 do loop de tick, ANTES
  de `recomputePressure`, garantindo que o lead decaia antes de influenciar a
  pressao do turno corrente. Peso de lane lead na pressao: LANE_LEAD_TO_PRESSURE_WEIGHT=0.15.

- **Resolucao de kills migrou de Fisher-Yates para selecao com priors**: a
  selecao de killer/vitima no `applyKill` v1.0 usava Fisher-Yates sem priors de
  archetype. A v1.1 usa `selectKiller`/`selectVictim` com priors por role e
  archetype (mesma aridade: 1 draw rng cada).

- **`chooseIntent` com biases de composicao**: `applyCompIntentBiases` aplica
  ajustes de peso nas intencoes de macro conforme as `CompTag` dominantes do time,
  tornando times com tag "poke" mais propensos a intencoes de assedio e times
  "scaling" mais propensos a defender objetivos.

### Corrigido

- **Ponto aberto 1 (lane lead inexistente) - RESOLVIDO em v1.1**: a Fase 10
  implementou `laneState.ts` com `LaneStateEntry` e decaimento por tick.

- **Ponto aberto 2 (ouro quase decorativo) - RESOLVIDO em v1.1**: a Fase 9
  conectou o ouro ao poder de luta via sigmoid (`goldFightMult`) e eliminou o
  peso decorativo de win prob.

- **Ponto aberto 3 (draft/sinergia ausente) - RESOLVIDO em v1.1**: a Fase 11
  adicionou `deriveCompProfile` e os multiplicadores `compFightMult`/`compSecureMult`
  que enviesam poder com base na composicao de cada time.

---

## [1.0.0] - 2026-06-25

Engine state-driven base (Fases 1-6). A simulacao cobre o estado completo de uma
partida de LoL do inicio ao fim, com determinismo via seed.

### Adicionado

- **Estado vivo da partida** (`src/sim/matchState.ts`): interfaces `MatchState`,
  `TeamState`, `PlayerState` cobrindo pontuacao KDA, ouro, torres, drakes e
  Barao por time; fases de jogo (early/mid/late) via `phaseBlend`; lado azul/vermelho.

- **Derivacao de poder contextual** (`src/sim/power.ts`): `fightPower` e
  `securePower` derivados dos atributos do card (`lanePhase`, `midGame`,
  `lateGame`, `roleStrength`, `traits`) combinados com o estado da partida. Sem
  campos extra no schema; o poder e derivado, nao armazenado.

- **Timers e objetivos com regras duras** (`src/sim/matchState.ts`,
  `src/sim/engine.ts`): temporizadores de Barao, Drakes e Torres com janelas
  fixas de spawn. Regras de jogo (primeiro sangue, torreta de inibidor, Nexus)
  implementadas como transicoes de estado, nao como probabilidades avulsas.

- **Intencoes de macro** (`src/sim/engine.ts` - `chooseIntent`): a cada tick, cada
  time escolhe uma intencao (contestar objetivo, pressionar lane, base, etc.)
  proporcional ao estado corrente. A intencao guia o tipo de interacao que pode
  ocorrer naquele tick.

- **Resolucao de interacao** (`src/sim/engine.ts` - `resolveInteraction`):
  encontros entre times sao resolvidos com base nos poderes derivados, intencoes e
  fatores aleatorios controlados pelo seed. Resultado: kill, estrutura tomada,
  objetivo neutro, ou passagem sem interacao.

- **Lutas, picks, estruturas e win prob**: resolucao de kills com assistentes por
  Fisher-Yates; destruicao de estruturas ligada a vantagem de poder; win prob
  por pesos ponderados de KDA, ouro, torres e Barao (`WINPROB_WEIGHTS`).

- **Eventos e contrato de saida** (`src/sim/simEvents.ts`): registro de eventos
  por tick (kills, torres, objetivos, base); saida estruturada do simulador com
  placar final, sequencia de eventos e win prob por minuto.

- **Determinismo via `mulberry32`**: toda a aleatoriedade da engine e derivada do
  seed inicial. O mesmo seed produz o mesmo resultado em qualquer ambiente.
