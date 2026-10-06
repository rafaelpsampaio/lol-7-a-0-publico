# Calibracao das traits novas

Gerado por `npm run calibrate:traits` com N=1000 partidas por cenario (seed = indice). Spec: `docs/superpowers/specs/2026-10-05-traits-no-motor-design.md`, secao 6.

Valores em uso (`TRAIT_TUNING`):

```json
{
  "teamfightsSliceBonus": 5,
  "teamfightsKillerWeight": 1.4,
  "teamfightsVictimWeight": 0.85,
  "flipsKillerWeight": 1.5,
  "flipsVictimWeight": 2.2,
  "flipsAllInChance": 0.04,
  "flipsAllInFromSec": 90,
  "flipsAllInUntilSec": 840,
  "flipsEdgeScale": 40,
  "flipsLeadScale": 120,
  "flipsWinMin": 0.15,
  "flipsWinMax": 0.85,
  "objectiveLoverSetupBonus": 1.5,
  "objectiveLoverContestAt": 50,
  "objectiveLoverContestBonus": 2,
  "objectiveLoverAheadAt": 0.55,
  "objectiveLoverAheadPrepMult": 1.3,
  "objectiveLoverStealBonus": 0.1,
  "objectiveLoverExposure": 0.5,
  "objectiveLoverPitVictimWeight": 1.4,
  "roamerUntilSec": 840,
  "roamerGankBonus": 1.5,
  "roamerKillShare": 0.5,
  "roamerLaneLeadCost": 6,
  "sideSplitBonus": 1,
  "sideForceBonus": 0.15,
  "sidePressureBonus": 25,
  "quitMinDeaths": 4,
  "quitDeathRatio": 2,
  "quitStreakDeaths": 3,
  "quitStreakWindowSec": 300,
  "quitChance": 0.3333333333333333,
  "quitReturnChance": 0.5,
  "quitReturnMinSec": 120,
  "quitReturnMaxSec": 300,
  "afkGoldPerMin": 122.4
}
```

## Trava geral: taxa de vitoria no parelho 75 x 75

O erro padrao (EP) da diferenca e sqrt(p1(1-p1)/N + p2(1-p2)/N). Diferenca menor que 2 EP nao se distingue do acaso.

| Trait | Com | Sem | Diferenca (pp) | EP da diferenca (pp) | Dentro de 5 pp |
|---|---|---|---|---|---|
| `teamfights` | 55.2% | 51.7% | 3.5 | 2.2 | sim |
| `flips` | 53.3% | 51.7% | 1.6 | 2.2 | sim |
| `dragon_lover` | 52.6% | 51.7% | 0.9 | 2.2 | sim |
| `roamer` | 52.0% | 51.7% | 0.3 | 2.2 | sim |
| `side` | 52.4% | 51.7% | 0.7 | 2.2 | sim |
| `quits` | 51.8% | 51.7% | 0.1 | 2.2 | (pode derrubar) |

## `teamfights` (ADC, 75 x 75)

Alvo: lutas vencidas +5 a +8 pp.

| Medida | Com a trait | Sem a trait | Diferenca |
|---|---|---|---|
| Lutas de resolveTeamfight vencidas pelo user | 53.2% | 51.2% | +2.0 pp |
| Abates do portador por partida | 5.04 | 3.99 | 26.1% |
| Mortes do portador por partida | 2.55 | 2.81 | -9.2% |
| Janelas de conversao por partida | 23.86 | 23.70 | 0.7% |
| Abates antes de 14:00 (os dois times) | 4.87 | 4.86 | 0.2% |
| Abates depois de 14:00 (os dois times) | 22.63 | 22.51 | 0.5% |
| Duracao (min) | 34.51 | 34.41 | 0.3% |

## `flips` (mid, favorito 80 x 70)

Alvo: nos atropelos (vitoria com 15+ abates de diferenca), abates cerca de 2x e mortes de perto de 0 para perto de 3.

| Medida | Com a trait | Sem a trait | Diferenca |
|---|---|---|---|
| Partidas de atropelo | 673 | 519 | 29.7% |
| Abates do portador nos atropelos | 9.35 | 6.08 | 53.7% |
| Mortes do portador nos atropelos | 1.24 | 0.55 | 123.3% |
| Abates do portador (todas) | 8.40 | 5.10 | 64.8% |
| Mortes do portador (todas) | 1.78 | 1.06 | 68.7% |
| Abates por partida (os dois times) | 26.09 | 24.25 | 7.6% |
| Janelas de conversao por partida | 22.87 | 21.27 | 7.5% |
| Abates antes de 14:00 (os dois times) | 5.78 | 3.78 | 52.9% |
| Abates depois de 14:00 (os dois times) | 20.31 | 20.46 | -0.8% |
| Duracao (min) | 32.55 | 32.80 | -0.8% |

## `dragon_lover`, Ama objetivos (jungle, 75 x 75)

Alvo: mais objetivos, roubos cerca de 2x, mortes do portador de +10% a +25%.

| Medida | Com a trait | Sem a trait | Diferenca |
|---|---|---|---|
| Dragoes, larvas e Arautos do user por partida | 3.28 | 2.61 | 25.8% |
| Roubos do user por partida | 0.10 | 0.05 | 75.9% |
| Mortes do portador por partida | 2.77 | 2.50 | 10.5% |
| 1o dragao do user (s, media) | 696.93 | 746.25 | -6.6% |
| Janelas de conversao por partida | 23.45 | 23.70 | -1.1% |
| Abates antes de 14:00 (os dois times) | 5.87 | 4.86 | 20.9% |
| Abates depois de 14:00 (os dois times) | 22.25 | 22.51 | -1.2% |
| Duracao (min) | 33.40 | 34.41 | -2.9% |

## `roamer` (mid, 75 x 75)

Alvo: ganks e K+A do portador sobem; a rota dele perde (placas e torres cedidas no mid antes de 14:00).

| Medida | Com a trait | Sem a trait | Diferenca |
|---|---|---|---|
| Ganks do user por partida (so o evento gank) | 0.19 | 0.09 | 119.5% |
| Abates do user com roam por partida (gank, primeiro sangue e shutdown) | 0.26 | 0.00 | - |
| Abates + assistencias do portador | 9.37 | 8.96 | 4.5% |
| Placas e torres do mid cedidas antes de 14:00 | 0.93 | 0.91 | 2.3% |
| Janelas de conversao por partida | 24.01 | 23.70 | 1.3% |
| Abates antes de 14:00 (os dois times) | 4.61 | 4.86 | -5.1% |
| Abates depois de 14:00 (os dois times) | 22.64 | 22.51 | 0.5% |
| Duracao (min) | 34.65 | 34.41 | 0.7% |

## `side` (top, 75 x 75)

Alvo: mais torres na rota dele no meio de jogo.

| Medida | Com a trait | Sem a trait | Diferenca |
|---|---|---|---|
| Torres do user no top entre 14:00 e 25:00 | 0.85 | 0.66 | 28.1% |
| Janelas de conversao por partida | 23.32 | 23.70 | -1.6% |
| Abates antes de 14:00 (os dois times) | 4.83 | 4.86 | -0.6% |
| Abates depois de 14:00 (os dois times) | 22.43 | 22.51 | -0.4% |
| Duracao (min) | 34.33 | 34.41 | -0.2% |

## `quits` (mid, azarao 70 x 80)

Alvo: cerca de 1 em 8 partidas do portador com quit (12%); metade volta.

| Medida | Valor |
|---|---|
| Partidas com quit | 4.3% (43 de 1000) |
| Das com quit, voltou | 11.6% (5) |
| Das com quit, sorteou volta | 58.1% (25) |
| Das com quit, sorteou volta mas a partida acabou antes | 46.5% (20) |
| Das com quit, nao sorteou volta | 41.9% (18) |
| Tempo do quit ao fim da partida (s, mediana e p75) | 135.00 e 165.00 |
| Janela de volta sorteada (s, minimo e maximo) | 120 e 300 |
| Duracao media com quit (min) | 29.37 |
| Duracao media sem a trait (min) | 32.74 |

| Medida | Com a trait | Sem a trait | Diferenca |
|---|---|---|---|
| Janelas de conversao por partida | 21.25 | 21.26 | -0.0% |
| Abates antes de 14:00 (os dois times) | 3.89 | 3.89 | 0.0% |
| Abates depois de 14:00 (os dois times) | 20.33 | 20.52 | -0.9% |
| Duracao (min) | 32.66 | 32.74 | -0.2% |

## Pack dos amigos com e sem as traits novas (N=600)

Trava: abates por partida e duracao a ate 15%.

| Medida | Com a trait | Sem a trait | Diferenca |
|---|---|---|---|
| Abates por partida | 30.33 | 27.36 | 10.9% |
| Abates antes de 14:00 | 9.02 | 5.62 | 60.5% |
| Duracao media (min) | 31.90 | 32.43 | -1.6% |
| 1o dragao (s, mediana) | 450.00 | 450.00 | 0.0% |
| 1a torre (s, mediana) | 750.00 | 795.00 | -5.7% |
| Fracao de roubos | 0.6% | 0.5% | +0.1 pp |
| Violacoes de regra dura | 0 | 0 | - |

## Regua dos pros

Sem nenhum portador das traits novas a partida e a mesma de antes (T-02). Medido em 2026-10-05 no commit c3175f5 (nao e rerodado por este script): `REALISM_N=600 npm run realism` na base ea9ea18 e neste ramo, e `docs/diagnostics/realism-audit.txt` ficou identico nos dois.

## Partidas de exemplo (mesma semente, com e sem a trait)

### `flips`

- Semente 0. Com: vitoria em 28.50 min, portador 13/1/8. Sem: vitoria em 35.75 min, mesmo jogador 2/0/8.
  - 7:00 Umid: decide a troca de rota com esse abate.
  - 7:00 Umid limpou a luta no rio inferior com um DOUBLE KILL!
  - 7:30 Umid solou Rmid no meio.
  - 7:45 Umid segura a lane no meio ha rodadas, e a vantagem da Seu time vira consistente.
- Semente 1. Com: vitoria em 35.25 min, portador 7/1/5. Sem: vitoria em 37.50 min, mesmo jogador 11/1/12.
  - 8:45 Umid: decide a troca de rota com esse abate.
  - 9:00 Umid consolida a vantagem no meio e a Seu time nao da espaco para o adversario reagir.
  - 9:00 Com prioridade solida no meio, Umid abre a rota para o resto da Seu time.
  - 9:15 Umid passa a receber atencao constante do jungler da Seu time no meio.
- Semente 2. Com: vitoria em 23.00 min, portador 11/1/8. Sem: vitoria em 38.00 min, mesmo jogador 5/2/8.
  - 3:00 Rmid: o abate vira o favorito da partida.
  - 5:15 Umid solou Rmid no meio.
  - 5:45 Umid passa a receber atencao constante do jungler da Seu time no meio.
  - 6:15 Umid pressiona a torre no meio e coleta uma placa para o Seu time.

### `dragon_lover`

- Semente 0. Com: vitoria em 36.25 min, portador 4/0/13. Sem: derrota em 36.50 min, mesmo jogador 2/5/2.
  - 5:30 O Seu time começa a preparar o Dragão Hextech.
  - 6:15 Ujungle garantiu o Dragão Hextech sem contestação.
  - 9:15 O Seu time começa a preparar as Larvas do Vazio.
  - 11:45 O Seu time começa a preparar o Dragão das Nuvens.
- Semente 1. Com: vitoria em 44.00 min, portador 3/5/11. Sem: vitoria em 39.75 min, mesmo jogador 2/1/16.
  - 6:15 O Seu time começa a preparar o Dragão Hextech.
  - 6:45 Ujungle: cobra a recompensa acumulada com um abate que pesa na partida.
  - 7:45 Ujungle garantiu o Dragão Hextech sem contestação.
  - 8:15 Ujungle pressiona a torre no topo e coleta uma placa para o Seu time.
- Semente 2. Com: vitoria em 26.00 min, portador 1/2/7. Sem: vitoria em 37.00 min, mesmo jogador 3/3/6.
  - 6:00 O Seu time começa a preparar o Dragão do Oceano.
  - 7:45 O Seu time venceu a luta e garantiu o Dragão do Oceano.
  - 10:00 O Seu time começa a preparar as Larvas do Vazio.
  - 10:15 Ujungle pressiona a torre no bot e coleta uma placa para o Seu time.

### `roamer`

- Semente 3. Com: vitoria em 31.00 min, portador 6/1/13. Sem: derrota em 34.50 min, mesmo jogador 1/4/0.
  - 3:30 Ujungle abriu o placar em cima de Rmid no bot com o roam de Umid.
  - 7:00 Umid passa a receber atencao constante do jungler da Seu time no meio.
  - 18:15 Umid invocou o Arauto no bot e quebrou a torre interna.
  - 21:30 Umid limpou a luta no rio inferior com um DOUBLE KILL!
- Semente 9. Com: derrota em 42.75 min, portador 5/3/7. Sem: vitoria em 39.25 min, mesmo jogador 7/4/10.
  - 6:15 Ujungle abriu o placar em cima de Radc no topo com o roam de Umid.
  - 7:30 Umid venceu a troca no rio inferior.
  - 10:30 Ujungle apareceu no bot com o roam de Umid e garantiu o gank em cima de Rsupport.
  - 24:45 Umid: decide a troca de rota com esse abate.
- Semente 11. Com: vitoria em 39.00 min, portador 10/0/7. Sem: derrota em 37.75 min, mesmo jogador 2/5/2.
  - 10:30 Ujungle apareceu no bot com o roam de Umid e garantiu o gank em cima de Rmid.
  - 11:00 O jungler da Seu time vira o mapa no meio, e Umid sente a pressao extra.
  - 11:15 Umid pressiona a torre no meio e coleta uma placa para o Seu time.
  - 18:15 Umid limpou a luta no rio superior com um DOUBLE KILL!

### `side`

- Semente 0. Com: vitoria em 27.50 min, portador 2/1/14. Sem: derrota em 36.50 min, mesmo jogador 1/4/4.
  - 11:45 Utop consolida a vantagem no topo e a Seu time nao da espaco para o adversario reagir.
  - 11:45 Com prioridade solida no topo, Utop abre a rota para o resto da Seu time.
  - 17:00 O Seu time venceu a luta e garantiu o Dragão do Oceano.
  - 17:30 Com dois a mais depois da luta no rio inferior, Utop derrubou a PRIMEIRA torre do jogo no bot para o Seu time.
- Semente 1. Com: derrota em 38.25 min, portador 6/2/5. Sem: vitoria em 39.75 min, mesmo jogador 9/2/11.
  - 7:00 Utop consolida a vantagem no topo e a Seu time nao da espaco para o adversario reagir.
  - 7:00 Com um a mais depois da luta no topo, Utop pressiona a torre no topo e coleta uma placa para o Seu time.
  - 7:15 Utop libera prioridade no topo, e a Seu time ganha espaco para rotacionar o mapa.
  - 9:30 Utop venceu a troca no rio inferior.
- Semente 2. Com: derrota em 28.50 min, portador 0/4/0. Sem: vitoria em 37.00 min, mesmo jogador 4/1/7.
  - 12:15 Utop pressiona a torre no topo e coleta uma placa para o Seu time.
  - 20:30 Rtop abateu Utop no rio inferior.
  - 27:00 Rjungle abateu Utop no rio inferior.

### `teamfights`

- Semente 1. Com: vitoria em 34.50 min, portador 11/1/6. Sem: vitoria em 39.75 min, mesmo jogador 10/1/12.
  - 9:45 Uadc segura a lane no bot ha rodadas, e a vantagem da Seu time vira consistente.
  - 9:45 Uadc libera prioridade no bot, e a Seu time ganha espaco para rotacionar o mapa.
  - 25:30 Uadc limpou a luta no rio inferior com um DOUBLE KILL!
  - 26:15 Com quatro a mais depois da luta no rio inferior, Uadc pressiona a torre do inibidor no bot e coleta 4 placas para o Seu time. A torre fica em estado crítico.
- Semente 2. Com: vitoria em 40.25 min, portador 5/2/8. Sem: vitoria em 37.00 min, mesmo jogador 5/4/6.
  - 15:45 Uadc: abate decisivo, o mapa se abre para o time.
  - 21:15 Uadc: abate decisivo, o mapa se abre para o time.
  - 23:45 Uadc pressiona a torre do inibidor no bot e coleta uma placa para o Seu time.
  - 27:45 Com quatro a mais depois da luta no rio superior, Uadc quebrou a torre interna no topo.
- Semente 3. Com: vitoria em 33.00 min, portador 6/1/7. Sem: derrota em 34.50 min, mesmo jogador 0/5/3.
  - 8:00 Uadc pressiona a torre no bot e coleta uma placa para o Seu time.
  - 8:00 Uadc segura a lane no bot ha rodadas, e a vantagem da Seu time vira consistente.
  - 18:15 Uadc: abate decisivo, o mapa se abre para o time.
  - 18:15 Uadc limpou a luta no rio superior com um TRIPLE KILL!

### `quits`

- Semente 11. Com: derrota em 29.00 min, portador 0/4/1. Sem: derrota em 33.25 min, mesmo jogador 0/5/1.
  - 13:30 Umid pressiona a torre no meio e coleta uma placa para o Seu time.
  - 26:30 Umid quitou a partida.
- Semente 17. Com: derrota em 26.75 min, portador 0/4/1. Sem: derrota em 32.00 min, mesmo jogador 0/7/1.
  - 13:45 Umid pressiona a torre no meio e coleta uma placa para o Seu time.
  - 23:30 Umid quitou a partida.
- Semente 52. Com: derrota em 25.75 min, portador 0/6/0. Sem: derrota em 30.50 min, mesmo jogador 0/8/0.
  - 12:00 Umid pressiona a torre no meio e coleta uma placa para o Seu time.
  - 21:45 Rjungle abateu Umid no rio superior.
  - 23:15 Umid quitou a partida.
