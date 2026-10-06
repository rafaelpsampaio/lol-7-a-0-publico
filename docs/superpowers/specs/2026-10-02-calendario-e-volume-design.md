# Design: calendário e volume de abates do motor de simulação

**Data:** 2026-10-02
**Escopo:** `src/sim/**` (motor), harness de medição em `scripts/`, testes do motor.
**Antecede:** o spec `2026-10-02-luta-mapa-vitoria-design.md` (item 1 da auditoria), já na `master`. Este cobre os itens 2 (calendário) e 3 (volume de abates) da mesma auditoria.

## Contexto: o que foi medido

Sondagem de 2026-10-02 no caminho do app (rosters reais de `public/players.json` + campeões por `assignFearlessChampionsBothTeams`, N=600, `master` em `50e1f68`), contra a referência real de `docs/references/ritmo.md`:

| Evento | Real | Motor |
|---|---|---|
| First blood | p10 3:13, mediana 4:54, p90 8:18 (amostra 2026) | p10 0:15, mediana 1:00, p90 3:00; 61% antes de 1:30 |
| Partidas sem abate até 10:00 | 11% | 0% |
| Abates até 10' / até 20' / por partida | 3,2 / 10,7 / 27 | 9,7 / 21,2 / 49,6 |
| Dragões | 1º perto de 9:10, mínimo 6:31 | cada um cai ~15 s depois de nascer: 5:15, 10:15, 15:30, 20:45, 25:45 |
| Dragões por partida / Alma / Elder | 4,45 / 42% / 8% | 5,1 / 67% / 30% |
| Larvas / Arauto | | 5:15 / 14:00 cravado, em 100% dos jogos |
| 1ª torre | p10 13:15, mediana 16:34, p90 19:55 (amostra 2026) | p10 8:15, mediana 10:00, p90 12:00 |
| Torres aos 15' / aos 20' | 0,85 / 3,72 | 2,9 / 4,8 |
| Barão | ~1,45 por partida, em ~96% dos jogos (2023-24) | 2,25 por partida, 1º na mediana de 20:45, em 100% dos jogos |

Abates por minuto, por fase, e quem os produz:

| Fase | Real | Motor | Fonte principal no motor |
|---|---|---|---|
| 0-14' | ~0,4 | 0,99 | ganks e picks (~0,46 eventos/min, 1 abate cada) + lutas no poço e lutas cedo |
| 14-20' | ~0,8 | 1,23 | luta 5v5 a cada ~4 min, com ~3 abates |
| 20-25' | ~1,1 | 2,43 | luta 5v5 a cada ~2 min, com ~4 abates |
| 25'+ | ~0,9 | 2,49 | idem |

Caminho de cada objetivo tomado: 79% dos Barões vêm da janela de conversão (um pick ou luta ganha deixa um lado com gente a mais). Dragões: 44% sem disputa, 34% pela janela, 22% disputados.

Ablação das torres (N=400): sem o cerco automático da laning phase (`siegeAccrualBase = 0`), a 1ª torre vai de 9:45 para 14:30 e as torres aos 15' de 2,9 para 1,1. Sem o cerco da janela (`conversionSiegeBase = 0`), as partidas batem no teto de 60 min.

### Causas, lidas no código

1. **Gank desde o 1º tick.** `chooseIntent` dá peso a `gank` no early game sem relógio de selva, e `pickChance` vale ~0,25 por tick de agressão. Daí o first blood aos 0:15.
2. **Objetivo no cronômetro.** `setup_dragon` tem peso alto assim que o dragão nasce, e `resolveUncontestedObjective` toma na hora. O mesmo vale para larvas, Arauto e Barão.
3. **Luta sem motivo.** No mid e late game, agressão mútua vira 5v5 sempre que o intervalo mínimo passou (100 s no mid, 50 s no late).
4. **Barão de pick solto.** A janela de conversão converte qualquer 1 a mais em Barão.
5. **Torre cedo.** O cerco automático da laning phase derruba a torre externa antes de 14:00.
6. **Regras de 2024.** O motor segue o mapa de 2024. O patch 26.1 (janeiro de 2026) trouxe:
   - placas permanentes em toda torre de rota;
   - torre externa que perde resistência de 11:00 a 15:00;
   - larvas em leva única às 8:00;
   - Arauto às 15:00;
   - 1º Elder 5:00 depois da Alma;
   - ouro de objetivo novo.

## Objetivo

O motor acerta **quando** as coisas acontecem e **quanto sangue** sai:
- early game quase vazio até ~14';
- objetivos tomados com preparo, e não no cronômetro;
- torres a partir de ~14-16';
- lutas concentradas em volta de objetivos.

Tudo isso com as regras do mapa de 2026 e sem perder o acoplamento luta → mapa → vitória do item 1. O sucesso é medido no caminho do app contra a referência real (seção "Medição e aceite").

## Decisões do dono do produto

1. **Itens 2 e 3 juntos.** Calendário e volume dividem as mesmas alavancas: quantas lutas e picks acontecem e quantas janelas de conversão abrem.
2. **O Caos alto sangra mais.** No padrão (0,25) o alvo é o pro, ~27 abates por partida. No máximo do slider, perto de solo queue, ~40-45. O slider passa a ter dois efeitos: mais virada (o sorteio da luta, do item 1) e mais sangue.
3. **Abordagem: prontidão causal.** Cada canal só dispara quando o motivo real existe, e o calendário sai como consequência. Foram descartadas uma curva de ritmo copiada dos dados, por ser sintética, e travas fixas de tempo, porque deixariam o objetivo no cronômetro, só atrasado.
4. **Regras do mapa de 2026.** O motor adota as regras do patch 26 que mexem no calendário e no ouro (seção 6 do design).
5. **Régua.** As 19 bandas do item 1 continuam como gate, e as métricas de calendário e volume viram bandas de aceite. O golden regenera e o INV-1 (contagem de sorteios) pode mudar.
6. **Janela exige preparo começado (emenda de 2026-10-02).** Depois da calibração, a janela de conversão só toma objetivo que o time já começou a preparar (seção 4), e o preparo do Barão e do Elder pode ter taxa por tick maior, com o tempo de preparo ainda mais longo que o do dragão.
7. **Dragão e Caos (emenda 2 de 2026-10-02).** Depois da recalibração da emenda 1: a partir do 2º dragão, o preparo pode começar até 60 s antes do respawn; e com o Caos alto a luta 5v5 dispensa o motivo.

## Design

### 1. Arquitetura

Um módulo novo, `src/sim/readiness.ts`, com funções puras que respondem "este canal está pronto agora?". Elas não sorteiam nada: quem sorteia é o motor (`chooseIntent`, `resolveInteraction`), como na janela de conversão do item 1. A ordem do tick não muda.

Peças:

1. **Relógio do jungler:** a hora em que cada jungler termina o 1º clear (seção 2).
2. **Preparo de objetivo:** estado novo no `MatchState`, por lado e por objetivo (seção 4).
3. **Motivo de luta:** um 5v5 só acontece quando há motivo (seção 3).
4. **Escala de sangue do Caos:** um multiplicador sobre a frequência de picks e lutas (seção 3).
5. **Resistência da torre externa e placas de 2026:** em `structures.ts` (seção 5).

As constantes novas entram no `RealismTuning` (`tuning.ts`) e são calibradas por varredura, com registro em `docs/diagnostics/`. Os valores abaixo são pontos de partida, e a calibração fecha os números.

### 2. Early game, até 14:00

**Relógio do jungler.**
- `junglerFirstClearSec(card)` = `clamp(190 − (lanePhase − 75) × 0,6, 170, 225)` segundos. Os campos nascem aos 0:55 (patch 26), e um clear completo leva ~2:15, então ele termina perto de 3:10. Um jungler forte de early termina antes.
- Antes desse instante, o lado não tem a intenção `gank` (peso 0).
- Depois, o gank volta com o peso de hoje (força do jungler e prioridade de rota), e a chance de cada gank dar abate cai (ver "pick no early").
- O relógio é por lado e lê o jungler que começou a partida.

**Antes do clear, só o all-in de rota.**
- Até o jungler limpar, a agressão de um lado só vira abate por all-in de rota: a rota com a maior vantagem de laning (bot, mid ou top) tenta o abate.
- A chance é pequena, proporcional à vantagem acima de um limiar (`laneAllInBase`), e zero sem vantagem.
- O all-in só existe a partir de 1:30, quando as rotas chegam ao nível 2 (tropas aos 0:30). Antes de 1:30, nenhum abate.

**Pick no early fica mais caro.** `pickChance` ganha um fator de fase, `earlyPickScale` (menor que 1, ponto de partida 0,45), até 14:00. O fator vale para pick e gank, e a chance continua pesando controle de mapa e vantagem de ouro.

**5v5 no early só com motivo:** a regra da seção 3 vale também aqui, e o early continua exigindo `force_fight` explícito. Com o preparo da seção 4, larvas e dragão deixam de cair juntos no 5º minuto, e as lutas no poço daquele instante somem.

O early continua com eventos: placas, sinais de rota (`lane_advantage_building`, `lane_priority_shift`, `jungler_attention_shift`), o aviso de preparo (seção 4), larvas e dragão.

### 3. Lutas no mid e late game, e o Caos

**Luta 5v5 precisa de motivo.** `force_fight`, ou agressão mútua fora do early, só vira `resolveTeamfight` quando `fightReason(state)` é verdadeiro. Os motivos:
- objetivo vivo ou nascendo em até 60 s: dragão, Arauto, Barão ou Elder;
- torre sob cerco: alguma estrutura com o pool de dano em `tower_low` ou acima e dano recebido nos últimos 60 s;
- um time com buff de Barão ou Elder vivo.

Sem motivo, a agressão vira tentativa de pick, com a `pickChance` normal, ou não dá em nada. (**Emenda 2 de 2026-10-02**: com o Caos alto, a partir de um limiar calibrável de caos efetivo, a luta 5v5 dispensa o motivo: os times brigam em qualquer lugar, como em solo queue. No Caos padrão nada muda.)

**Reset depois da luta.** Os intervalos de `FIGHT_COOLDOWN_BY_PHASE` passam a ser tuning:

| Fase | Hoje | Ponto de partida |
|---|---|---|
| Early | 220 s | 220 s |
| Mid | 100 s | 150 s |
| Late | 50 s | 110 s |

Isso modela os times voltando para a base, comprando e reagrupando, e concentra as lutas em volta de objetivos.

**Escala de sangue.** `bloodScale(state) = max(0,6; 1 + bloodChaosCoef × (effectiveChaos(state) − CHAOS_REFERENCE))`. Ela usa o caos efetivo do item 1, que já soma a volatilidade dos jogadores, então jogadores voláteis deixam a partida um pouco mais sangrenta. Ela:
- multiplica a chance de pick, de gank e de all-in;
- divide o intervalo de reset;
- soma `(bloodScale − 1)` no cálculo de `loserDeaths` de `resolveTeamfight`, antes do arredondamento e do teto por fase. Os sorteios continuam consumidos na mesma ordem.

O `bloodChaosCoef` é calibrado para ~27 abates no padrão e ~40-45 no slider 1.

**Efeito colateral previsto.** Com menos lutas, abrem menos janelas de conversão. Isso atrasa o Barão (desejado), mas também derruba menos torres no late. O cerco da janela (`conversionSiegeBase`) e a força do press de rota são recalibrados para a duração continuar entre 29 e 36 min.

### 4. Objetivos com preparo

**Estado.** `objectivePrep[side][kind]`, de 0 a 100, para dragão, larvas, Arauto, Barão e Elder.

**Ganho.** Quando o lado escolhe `setup_<kind>` e o objetivo está disponível, o preparo sobe `prepGain` por tick:

```
prepGain = prepRate(kind)
         × (1 + prioEdge(kind) / prepPrioScale)    // vantagem de laning nas rotas do poço
         × (jungler vivo ? 1 : 0)                  // sem jungler, nao avanca
         × (numbersAdvantage >= 0 ? 1 : 0)         // com gente a menos, nao avanca
         × (1 + controleDeMapaDoLado / 200)
```

- `prioEdge` é a vantagem de laning do lado sobre o inimigo nas rotas do poço: bot + mid para dragão e Elder; top + mid para larvas, Arauto e Barão.
- `prepRate` tem dois valores: um para dragão, larvas e Arauto, e um para Barão e Elder. **Emenda de 2026-10-02 (decisão do dono do produto, depois da calibração):** o que precisa ser mais lento no Barão e no Elder é o **tempo de preparo** (do nascimento ao aviso), não a taxa por tick. Os times escolhem preparar o Barão bem menos vezes que o dragão, então a taxa por tick do épico pode ser maior, desde que o tempo medido continue maior que o do dragão. O gate confere isso.

**Decaimento.** Quando o lado não escolhe preparar, o preparo cai `prepDecay` por tick (perde visão e prioridade). Ele zera quando o objetivo é tomado ou some, e só cresce com o objetivo vivo. (**Emenda 2 de 2026-10-02**, decisão do dono do produto depois da recalibração: a partir do 2º dragão, o preparo também cresce nos 60 s antes do respawn, porque no meio de jogo os times já agrupados montam visão antes. O 1º dragão continua só com ele vivo. A tomada continua exigindo o dragão vivo.)

**Tomada.** Com o preparo em 100 e o outro lado fora de agressão, o lado toma o objetivo sem disputa, pelo `resolveUncontestedObjective`. A trava `baronSetupSufficient` continua para o Barão. A disputa continua como hoje: os dois lados com a mesma intenção de preparo vira luta no poço (`resolveContestedObjective`). Quem domina as rotas prepara mais rápido, então jogo parelho demora mais.

**Calibração.** O 1º dragão deve cair perto de 9:00 em jogo parelho, perto de 7:00 para quem domina as rotas, e nenhum antes de ~6:30.

**Aviso de preparo.** Um evento novo, `objective_setup`, sai quando o preparo de um lado passa de 50, no máximo uma vez por objetivo e por nascimento: "O <time> começa a preparar o <objetivo>." Ele entra no `EventKind`, no contrato persistido (`src/sim/types.ts`) e no ticker. Ele não mexe em placar nem em win probability.

**Janela de conversão.** A janela converte um objetivo só se o lado já começou a prepará-lo: preparo de pelo menos 50, o ponto do aviso. Sem isso, a vantagem vira pressão de torre. Com o preparo começado, a janela pula o que falta dele, porque a vantagem numérica substitui o resto do preparo, e zera o preparo do objetivo tomado. (**Emenda de 2026-10-02**, decisão do dono do produto depois da calibração: com a janela pulando o preparo inteiro, todo dragão antes de 6:00 e quase todo Barão no spawn saíam de um abate convertido no tick seguinte.) A regra de alvo muda também para os épicos:
- **Barão e Elder:** exigem 2 a mais, ou 1 a mais com o jungler inimigo morto (ninguém para dar Smite).
- **Dragão, larvas e Arauto:** continuam com 1 a mais, no lado do mapa da luta (como hoje em `conversionTarget`).

### 5. Estruturas, com regras de 2026

**Placas permanentes em toda torre de rota.**
- Externa, interna e do inibidor têm 5 placas cada.
- No pool de dano (0 a 100), as placas caem em 10, 25, 45 e 70, e a 5ª é a queda da torre em 100. Isso substitui `PLATE_MULTIPLE = 20`.
- `classifyStructureCrossing` deixa de cortar a placa em 14:00 e deixa de exigir torre externa. Placa de torre interna e de inibidor também emite `plate_taken`.
- O `tower_low` continua no limiar de 70 (`TOWER_LOW_THRESHOLD`), que agora coincide com a 4ª placa. Quando o mesmo cruzamento tira a 4ª placa e entra em `tower_low`, sai só o evento de placa, e o estado crítico fica no texto.

**Ouro de torre (patch 26).**
- A placa paga 120 ao time, caindo 10 por minuto completo depois de 11:00, até 80 a partir de 15:00. A 5ª placa é o ouro da queda.
- Torre externa, interna e do inibidor não pagam ouro extra ao cair. O bônus de 1ª torre (+300) continua. Torre do Nexus (50) e inibidor (50) não mudam.

**A resistência da torre externa é o prazo.** `outerTurretDamageFactor(t)` multiplica todo dano em torre externa, venha do cerco automático, do press, da janela ou do Arauto:
- vale `outerTurretEarlyFactor` até 11:00 (ponto de partida 0,5);
- sobe em linha reta até 1,0 em 15:00.

É isso, e não uma trava, que segura a 1ª torre perto de 16:30. A regra dura das 7:00 (`holdPoolBeforeTowerWindow`) continua.

**Cerco automático da laning phase.** `accrueSiegePressure` continua até 14:00 e só na torre externa, com `siegeAccrualBase` recalibrado. Ele tira placa e raramente derruba a torre sozinho.

**Depois de 14:00**, as torres caem por:
- Arauto (nasce às 15:00);
- janela de conversão;
- press de rota com gente (`resolveStructurePressure`).

### 6. Regras do mapa do patch 26

| Regra | Hoje (2024) | Passa a ser (26.1) |
|---|---|---|
| Larvas | 2 levas a partir de 5:00, somem às 13:45 | 1 leva de 3 às 8:00, sem respawn, somem às 14:45 |
| Arauto | 14:00, some às 19:45 | 15:00, some às 19:45 |
| 1º Elder | 6:00 depois da Alma | 5:00 depois da Alma; respawn continua 6:00 |
| Ouro do Barão | 300 por jogador vivo | 150 para cada jogador do time + 100 para quem dá o Smite |
| Ouro do Elder | nenhum | 150 para cada jogador do time + 100 para quem dá o Smite |
| Ouro do dragão / larvas / Arauto | nenhum | 75 / 30 por larva / 100, para quem dá o Smite |
| Relógio do jungler | não existe | campos aos 0:55 (seção 2) |

O que não muda: dragão às 5:00 com respawn de 5:00, Alma no 4º dragão do time, Barão às 20:00 com respawn de 6:00, inibidor com respawn de 5:00, sem Atakhan.

Como o ouro de torre e de objetivo muda, o farm passivo (`passiveBasePerMin`, `passiveSlopePerMin`) e a recompensa de objetivo são recalibrados para o GPM e as bandas de ouro do item 1 continuarem verdes.

Fontes: [notas do patch 26.1](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/), [/dev da temporada 2026](https://www.leagueoflegends.com/en-us/news/dev/dev-2026-season-one-gameplay-preview/), wiki oficial ([Turret](https://wiki.leagueoflegends.com/en-us/Turret), [Voidgrub](https://wiki.leagueoflegends.com/en-us/Voidgrub), [Rift Herald](https://wiki.leagueoflegends.com/en-us/Rift_Herald), [Dragon pit](https://wiki.leagueoflegends.com/en-us/Dragon_pit)).

## Medição e aceite

**Régua:** `npm run calibrate:realism`, caminho do app, N=1500, com seeds fixas. As 19 bandas do item 1 continuam como gate, com uma exceção: a trava "mediana da 1ª torre" em [480; 1200] sai, substituída pela banda mais estreita abaixo. As bandas novas (referência real entre parênteses):

| Bloco | Métrica | Banda |
|---|---|---|
| Early | first blood mediano | 4:00-6:30 (4:54) |
| Early | first blood p10 | 2:30-4:00 (3:13) |
| Early | first blood antes de 1:30 | ≤ 2% (mínimo real 1:31) |
| Early | partidas sem abate até 10:00 | 5-18% (11%) |
| Early | abates até 10' | 2,2-4,5 (3,2) |
| Early | abates até 15' | 5,0-8,5 (6,5) |
| Volume | abates por partida | 23-32 (27) |
| Volume | abates até 20' | 8,5-13 (10,7) |
| Volume | abates por minuto entre 20' e 25' | 0,85-1,45 (1,13) |
| Objetivos | 1º dragão mediano | 7:45-10:30 (9:10) |
| Objetivos | 1º dragão antes de 6:00 | ≤ 3% (mínimo real 6:31) |
| Objetivos | dragões por partida | 3,8-5,2 (4,45) |
| Objetivos | partidas com Alma | 30-52% (42%) |
| Objetivos | partidas com Elder | 4-14% (8%) |
| Objetivos | Barões por partida | 1,1-1,7 (~1,45) |
| Objetivos | partidas com Barão | 80-98% (~96%) |
| Objetivos | 1º Barão até 21:00, entre as partidas com Barão | ≤ 15% |
| Torres | 1ª torre mediana | 14:30-18:30 (16:34) |
| Torres | 1ª torre p10 | ≥ 12:00 (13:15) |
| Torres | torres até 15' | 0,4-1,4 (0,85) |
| Torres | torres até 20' | 2,5-5,0 (3,72) |
| Torres | torres por partida, contando as torres do Nexus (como a referência: 11 por lado) | 10-14 (11,9) |

As regras duras continuam em zero.

**Caos.** Uma varredura própria, N=600 por ponto, no slider 0 / 0,25 / 0,5 / 0,75 / 1. Abates por partida sobem a cada ponto e passam de 38 no slider 1.

**Acompanhadas sem gate:**
- placas por partida (a referência real de 8,2 é da regra antiga);
- partidas com larvas e com Arauto tomados;
- 1º Barão mediano (sem fonte firme);
- abates por rota (real: ADC > mid > jungle);
- shutdowns por partida;
- p10 e p90 de abates (real 16 e 38) e de duração;
- partidas abaixo de 25 min (real ~6%).

O cenário sintético 75×75 continua só como controle.

## Testes

**Peças novas com teste unitário:**
- relógio do jungler: valor por `lanePhase`, sem gank antes do clear, nenhum abate antes de 1:30;
- preparo de objetivo: cresce, decai, zera na tomada e no despawn, não avança sem jungler ou com gente a menos, e prioridade acelera;
- tomada só com preparo cheio, e o aviso de preparo sai uma vez por nascimento;
- motivo de luta: cada motivo isolado e a ausência de motivo;
- reset por fase e escala de sangue (monotônica no caos, piso 0,6);
- placas: limiares 10/25/45/70/100 nas três torres de rota, sem corte em 14:00, ouro caindo de 120 a 80 entre 11:00 e 15:00, queda da torre sem ouro extra;
- curva de `outerTurretDamageFactor`;
- janela de conversão: Barão e Elder exigem 2 a mais, ou 1 a mais com o jungler inimigo morto;
- timers do patch 26 e ouro de objetivo.

**Testes que existem hoje:**
- Testes que fixam regras de 2024 (larvas em 2 levas, Arauto às 14:00, placa só até 14:00, `PLATE_MULTIPLE`) são atualizados para as regras de 2026.
- Testes de banda antigos que conflitarem com a régua são atualizados ou aposentados, com justificativa em `docs/diagnostics/`. Nenhum some calado.
- Golden regenerado no fim, com diff documentado. Mesma seed, mesmo jogo.
- Testes da sala (`server/room/hub.test.ts`, `server/room/tournament.test.ts`) rodam no fim, porque procuram sementes por trajetória simulada e quebram com mudanças do motor.

## Ordem de implementação

Mede-se a cada etapa, para ver o que cada peça move:

1. Regras e economia do patch 26 (timers e ouro de objetivo).
2. Estruturas: placas de 2026, ouro de placa e resistência da torre externa.
3. Relógio do early game: jungler, all-in e pick no early.
4. Preparo de objetivo, aviso de preparo e regra do Barão e do Elder na janela.
5. Motivo de luta, reset e escala de sangue do Caos.
6. Calibração final e golden.

## Fora de escopo

- Item 4 da auditoria (textura): relógio contínuo dentro do tick, ações simultâneas no mapa, finais variados.
- Nexus turret com respawn a 40% de vida (patch 26), porque o motor não modela respawn de torre do Nexus.
- Velocidade das ondas de tropa, Role Quests e itens do patch 26.
- Remapear o slider de Caos para o ruído de luta não saturar em ~0,70 (pendência do item 1).
- Efeito de comp de scaling no late (pendência do item 1, Cenário 4 do `calibrate:micro`).

## Riscos

- **As bandas do item 1 podem sair do lugar.** Menos abates, menos janelas e ouro novo de torre e de objetivo mexem no ouro e na conversão. A ordem de implementação mede o efeito de cada peça, e a calibração final fecha tudo junto.
- **Duração.** Menos lutas e torre externa mais dura alongam a partida. O cerco da janela e o press são as alavancas para manter 29-36 min.
- **Alma e Elder dependem do ritmo de dragões, e o ritmo de dragões depende do preparo.** Se a Alma ficar alta, o ajuste é o `prepRate` do dragão, não uma trava.
- **A referência do Barão é mais fraca que as outras:** dados de 2023-24, sem amostra de 2026. A banda é larga de propósito.
- **Testes da sala** podem quebrar por fragilidade de fixture, como aconteceu no merge do item 1.
