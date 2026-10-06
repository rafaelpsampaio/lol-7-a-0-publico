# Calibracao: luta, mapa, vitoria

Spec: `docs/superpowers/specs/2026-10-02-luta-mapa-vitoria-design.md`.
Plano: `docs/superpowers/plans/2026-10-02-luta-mapa-vitoria.md`.

Cada secao registra uma varredura de `RealismTuning` (`src/sim/tuning.ts`) feita com
`scripts/sweep-realism.ts`: o comando, o criterio de escolha, a saida inteira e o ponto
gravado em `DEFAULT_REALISM_TUNING`.

## 1. Farm passivo (Task 3)

Contexto: com a economia real ligada no motor (abate 300, torre 250, e assim por diante), o
unico parametro livre de ouro e o farm passivo por jogador vivo,
`(passiveBasePerMin + passiveSlopePerMin * minuto) * fatia da rota * fator de laning * (1 + lead / 600)`.
O resto do motor (luta, mapa, vitoria) ainda e o das tasks anteriores, entao so as metricas de
ouro (GPM e ouro do time aos 10 min) servem de alvo aqui. As demais colunas vao ser tratadas
nas Tasks 4 a 8.

Comando (cenario `app`, 600 partidas por ponto, mesmas seeds em todos os pontos):

```
npx tsx scripts/sweep-realism.ts '[{"passiveBasePerMin":240,"passiveSlopePerMin":2.5},{"passiveBasePerMin":240,"passiveSlopePerMin":3.5},{"passiveBasePerMin":240,"passiveSlopePerMin":4.5},{"passiveBasePerMin":265,"passiveSlopePerMin":2.5},{"passiveBasePerMin":265,"passiveSlopePerMin":3.5},{"passiveBasePerMin":265,"passiveSlopePerMin":4.5},{"passiveBasePerMin":290,"passiveSlopePerMin":2.5},{"passiveBasePerMin":290,"passiveSlopePerMin":3.5},{"passiveBasePerMin":290,"passiveSlopePerMin":4.5}]' 600
```

Criterio de escolha, nesta ordem:

1. `gpmTeamMean` dentro de [1650; 2050];
2. entre os que passam, o menor valor de `|gpmTeamMean - 1833|/1833 + |teamGoldAt10 - 15900|/15900`.

Saida inteira da varredura:

```
N=600 por ponto, cenario app

ponto {"passiveBasePerMin":240,"passiveSlopePerMin":2.5}
  durationMeanMin=28.498 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1884 | teamGoldAt10=17890 | teamGoldAt20=35636 | killsPerGame=48.227 | killLeaderAt20Wins=0.518 | goldLeaderAt20Wins=0.648 | goldLeaderAt25Wins=0.553 | killRatioWinnerLoser=0.986 | winnerBehindGoldFrac=0.340 | goldDiffWinnerLoserMean=2260 | gpmRatioWinnerLoser=1.046 | favoriteGap5Wins=0.840 | favoriteGapUnder1Wins=0.485 | firstBaronWins=0.672 | soulWins=0.427 | firstTowerWins=0.815 | firstTowerMedianSec=645 | stealFraction=0.092 | towersPerGame=8.735

ponto {"passiveBasePerMin":240,"passiveSlopePerMin":3.5}
  durationMeanMin=28.545 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1949 | teamGoldAt10=18137 | teamGoldAt20=36570 | killsPerGame=48.550 | killLeaderAt20Wins=0.521 | goldLeaderAt20Wins=0.650 | goldLeaderAt25Wins=0.550 | killRatioWinnerLoser=0.991 | winnerBehindGoldFrac=0.343 | goldDiffWinnerLoserMean=2286 | gpmRatioWinnerLoser=1.045 | favoriteGap5Wins=0.867 | favoriteGapUnder1Wins=0.485 | firstBaronWins=0.672 | soulWins=0.418 | firstTowerWins=0.813 | firstTowerMedianSec=645 | stealFraction=0.092 | towersPerGame=8.737

ponto {"passiveBasePerMin":240,"passiveSlopePerMin":4.5}
  durationMeanMin=28.534 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=2013 | teamGoldAt10=18384 | teamGoldAt20=37507 | killsPerGame=48.510 | killLeaderAt20Wins=0.518 | goldLeaderAt20Wins=0.648 | goldLeaderAt25Wins=0.550 | killRatioWinnerLoser=0.990 | winnerBehindGoldFrac=0.348 | goldDiffWinnerLoserMean=2345 | gpmRatioWinnerLoser=1.044 | favoriteGap5Wins=0.880 | favoriteGapUnder1Wins=0.491 | firstBaronWins=0.671 | soulWins=0.424 | firstTowerWins=0.817 | firstTowerMedianSec=645 | stealFraction=0.092 | towersPerGame=8.728

ponto {"passiveBasePerMin":265,"passiveSlopePerMin":2.5}
  durationMeanMin=28.655 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=2003 | teamGoldAt10=19108 | teamGoldAt20=38015 | killsPerGame=48.928 | killLeaderAt20Wins=0.523 | goldLeaderAt20Wins=0.655 | goldLeaderAt25Wins=0.548 | killRatioWinnerLoser=0.982 | winnerBehindGoldFrac=0.347 | goldDiffWinnerLoserMean=2227 | gpmRatioWinnerLoser=1.043 | favoriteGap5Wins=0.867 | favoriteGapUnder1Wins=0.473 | firstBaronWins=0.671 | soulWins=0.414 | firstTowerWins=0.813 | firstTowerMedianSec=645 | stealFraction=0.091 | towersPerGame=8.787

ponto {"passiveBasePerMin":265,"passiveSlopePerMin":3.5}
  durationMeanMin=28.631 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=2067 | teamGoldAt10=19355 | teamGoldAt20=38946 | killsPerGame=48.828 | killLeaderAt20Wins=0.514 | goldLeaderAt20Wins=0.647 | goldLeaderAt25Wins=0.547 | killRatioWinnerLoser=0.988 | winnerBehindGoldFrac=0.350 | goldDiffWinnerLoserMean=2347 | gpmRatioWinnerLoser=1.043 | favoriteGap5Wins=0.880 | favoriteGapUnder1Wins=0.491 | firstBaronWins=0.667 | soulWins=0.416 | firstTowerWins=0.815 | firstTowerMedianSec=645 | stealFraction=0.092 | towersPerGame=8.760

ponto {"passiveBasePerMin":265,"passiveSlopePerMin":4.5}
  durationMeanMin=28.645 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=2130 | teamGoldAt10=19601 | teamGoldAt20=39878 | killsPerGame=48.872 | killLeaderAt20Wins=0.523 | goldLeaderAt20Wins=0.660 | goldLeaderAt25Wins=0.537 | killRatioWinnerLoser=0.985 | winnerBehindGoldFrac=0.360 | goldDiffWinnerLoserMean=2196 | gpmRatioWinnerLoser=1.041 | favoriteGap5Wins=0.853 | favoriteGapUnder1Wins=0.497 | firstBaronWins=0.656 | soulWins=0.430 | firstTowerWins=0.825 | firstTowerMedianSec=645 | stealFraction=0.093 | towersPerGame=8.757

ponto {"passiveBasePerMin":290,"passiveSlopePerMin":2.5}
  durationMeanMin=28.678 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=2118 | teamGoldAt10=20325 | teamGoldAt20=40397 | killsPerGame=48.880 | killLeaderAt20Wins=0.518 | goldLeaderAt20Wins=0.652 | goldLeaderAt25Wins=0.547 | killRatioWinnerLoser=0.985 | winnerBehindGoldFrac=0.357 | goldDiffWinnerLoserMean=2269 | gpmRatioWinnerLoser=1.042 | favoriteGap5Wins=0.867 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.662 | soulWins=0.404 | firstTowerWins=0.820 | firstTowerMedianSec=645 | stealFraction=0.092 | towersPerGame=8.780

ponto {"passiveBasePerMin":290,"passiveSlopePerMin":3.5}
  durationMeanMin=28.577 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=2182 | teamGoldAt10=20571 | teamGoldAt20=41335 | killsPerGame=48.605 | killLeaderAt20Wins=0.525 | goldLeaderAt20Wins=0.663 | goldLeaderAt25Wins=0.537 | killRatioWinnerLoser=0.978 | winnerBehindGoldFrac=0.363 | goldDiffWinnerLoserMean=2122 | gpmRatioWinnerLoser=1.039 | favoriteGap5Wins=0.853 | favoriteGapUnder1Wins=0.491 | firstBaronWins=0.655 | soulWins=0.425 | firstTowerWins=0.823 | firstTowerMedianSec=645 | stealFraction=0.092 | towersPerGame=8.740

ponto {"passiveBasePerMin":290,"passiveSlopePerMin":4.5}
  durationMeanMin=28.621 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=2245 | teamGoldAt10=20817 | teamGoldAt20=42263 | killsPerGame=48.685 | killLeaderAt20Wins=0.525 | goldLeaderAt20Wins=0.663 | goldLeaderAt25Wins=0.535 | killRatioWinnerLoser=0.975 | winnerBehindGoldFrac=0.365 | goldDiffWinnerLoserMean=2085 | gpmRatioWinnerLoser=1.038 | favoriteGap5Wins=0.853 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.658 | soulWins=0.439 | firstTowerWins=0.823 | firstTowerMedianSec=645 | stealFraction=0.093 | towersPerGame=8.742
```

Aplicacao do criterio (valores copiados da saida acima):

| passiveBasePerMin | passiveSlopePerMin | gpmTeamMean | teamGoldAt10 | passa no item 1 | soma dos desvios relativos (item 2) |
|---|---|---|---|---|---|
| 240 | 2.5 | 1884 | 17890 | sim | 0.1530 |
| 240 | 3.5 | 1949 | 18137 | sim | 0.2040 |
| 240 | 4.5 | 2013 | 18384 | sim | 0.2544 |
| 265 | 2.5 | 2003 | 19108 | sim | 0.2945 |
| 265 | 3.5 | 2067 | 19355 | nao | - |
| 265 | 4.5 | 2130 | 19601 | nao | - |
| 290 | 2.5 | 2118 | 20325 | nao | - |
| 290 | 3.5 | 2182 | 20571 | nao | - |
| 290 | 4.5 | 2245 | 20817 | nao | - |

Quatro pontos passam no item 1, entao a grade nao precisou ser estendida.

**Ponto escolhido: `passiveBasePerMin = 240`, `passiveSlopePerMin = 2.5`** (menor soma de
desvios, 0.1530; GPM de time 1884, dentro da banda 1650-2050). Gravado em
`DEFAULT_REALISM_TUNING`.

Ressalva registrada: o ponto escolhido esta no canto da grade (menor base e menor inclinacao),
e o ouro do time aos 10 min (17890) segue 12,5% acima da referencia de 15900. A grade e o criterio
sao os do plano, entao o ponto fica assim. Na mesma saida, `killsPerGame` ficou perto de 48 e
`killRatioWinnerLoser` perto de 1,0, ou seja, o ouro de abates tambem entra nesse total e o motor
de luta ainda e o antigo. As Tasks 4 a 8 mudam a luta e o mapa, e a Task 8 refaz o ajuste fino
contra as bandas completas.


## 2. Luta (Task 4)

Contexto: a luta passou a ser decidida pelo estado. `goldFightMult` e `goldSecureMult` usam o ouro
RELATIVO ao inimigo, `(2 x fatia) ^ (goldFightExponent x elasticidade / referencia x goldRelevance)`;
o sorteio de cada lado numa luta e um uniforme em `[1 - w, 1 + w]` com
`w = fightNoiseBase + fightNoiseChaosCoef x caos` (0,48 de coeficiente, nao varrido); o
`behindBoost` e o `K_GOLD` foram removidos; o `pickChance` passou a ler a razao de
`goldFightMult` entre os lados. Neste ponto o padrao ainda era `fightNoiseBase = 0.08`,
`goldFightExponent = 5` e a recompensa de objetivo 0.25 x 2500 (cap), que e o padrao do plano.

Comando (cenario `app`, 600 partidas por ponto, mesmas seeds em todos os pontos), grade A:

```
npx tsx scripts/sweep-realism.ts '[{"goldFightExponent":3,"fightNoiseBase":0.05},{"goldFightExponent":3,"fightNoiseBase":0.08},{"goldFightExponent":3,"fightNoiseBase":0.12},{"goldFightExponent":5,"fightNoiseBase":0.05},{"goldFightExponent":5,"fightNoiseBase":0.08},{"goldFightExponent":5,"fightNoiseBase":0.12},{"goldFightExponent":8,"fightNoiseBase":0.05},{"goldFightExponent":8,"fightNoiseBase":0.08},{"goldFightExponent":8,"fightNoiseBase":0.12}]' 600
```

Criterio de escolha, nesta ordem:

1. `hardRuleViolations` = 0 e `capFraction` <= 0,005;
2. `favoriteGap5Wins` em [0,75; 0,85] e `favoriteGapUnder1Wins` em [0,45; 0,55];
3. entre os que passam, o menor valor de `|goldLeaderAt20Wins - 0.782| + |killLeaderAt20Wins - 0.764|`.

Saida inteira da grade A:

```
N=600 por ponto, cenario app

ponto {"goldFightExponent":3,"fightNoiseBase":0.05}
  durationMeanMin=24.802 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1873 | teamGoldAt10=18105 | teamGoldAt20=36347 | killsPerGame=43.317 | killLeaderAt20Wins=0.906 | goldLeaderAt20Wins=0.922 | goldLeaderAt25Wins=0.924 | killRatioWinnerLoser=4.388 | winnerBehindGoldFrac=0.047 | goldDiffWinnerLoserMean=11073 | gpmRatioWinnerLoser=1.271 | favoriteGap5Wins=0.693 | favoriteGapUnder1Wins=0.485 | firstBaronWins=0.894 | soulWins=0.714 | firstTowerWins=0.837 | firstTowerMedianSec=615 | stealFraction=0.091 | towersPerGame=8.258

ponto {"goldFightExponent":3,"fightNoiseBase":0.08}
  durationMeanMin=25.040 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1875 | teamGoldAt10=18123 | teamGoldAt20=36371 | killsPerGame=44.048 | killLeaderAt20Wins=0.888 | goldLeaderAt20Wins=0.908 | goldLeaderAt25Wins=0.887 | killRatioWinnerLoser=4.076 | winnerBehindGoldFrac=0.057 | goldDiffWinnerLoserMean=11012 | gpmRatioWinnerLoser=1.266 | favoriteGap5Wins=0.707 | favoriteGapUnder1Wins=0.455 | firstBaronWins=0.881 | soulWins=0.742 | firstTowerWins=0.828 | firstTowerMedianSec=630 | stealFraction=0.092 | towersPerGame=8.298

ponto {"goldFightExponent":3,"fightNoiseBase":0.12}
  durationMeanMin=24.851 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1874 | teamGoldAt10=18110 | teamGoldAt20=36390 | killsPerGame=43.437 | killLeaderAt20Wins=0.863 | goldLeaderAt20Wins=0.903 | goldLeaderAt25Wins=0.874 | killRatioWinnerLoser=3.888 | winnerBehindGoldFrac=0.052 | goldDiffWinnerLoserMean=10903 | gpmRatioWinnerLoser=1.266 | favoriteGap5Wins=0.693 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.874 | soulWins=0.655 | firstTowerWins=0.848 | firstTowerMedianSec=630 | stealFraction=0.092 | towersPerGame=8.212

ponto {"goldFightExponent":5,"fightNoiseBase":0.05}
  durationMeanMin=24.196 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1857 | teamGoldAt10=18149 | teamGoldAt20=36221 | killsPerGame=43.052 | killLeaderAt20Wins=0.933 | goldLeaderAt20Wins=0.960 | goldLeaderAt25Wins=0.920 | killRatioWinnerLoser=6.219 | winnerBehindGoldFrac=0.023 | goldDiffWinnerLoserMean=12017 | gpmRatioWinnerLoser=1.309 | favoriteGap5Wins=0.693 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.885 | soulWins=0.647 | firstTowerWins=0.860 | firstTowerMedianSec=615 | stealFraction=0.092 | towersPerGame=8.198

ponto {"goldFightExponent":5,"fightNoiseBase":0.08}
  durationMeanMin=24.240 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1859 | teamGoldAt10=18166 | teamGoldAt20=36234 | killsPerGame=43.123 | killLeaderAt20Wins=0.943 | goldLeaderAt20Wins=0.960 | goldLeaderAt25Wins=0.946 | killRatioWinnerLoser=6.437 | winnerBehindGoldFrac=0.018 | goldDiffWinnerLoserMean=12057 | gpmRatioWinnerLoser=1.309 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.895 | soulWins=0.644 | firstTowerWins=0.862 | firstTowerMedianSec=615 | stealFraction=0.092 | towersPerGame=8.217

ponto {"goldFightExponent":5,"fightNoiseBase":0.12}
  durationMeanMin=24.200 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1856 | teamGoldAt10=18157 | teamGoldAt20=36249 | killsPerGame=42.987 | killLeaderAt20Wins=0.941 | goldLeaderAt20Wins=0.963 | goldLeaderAt25Wins=0.960 | killRatioWinnerLoser=6.642 | winnerBehindGoldFrac=0.020 | goldDiffWinnerLoserMean=12163 | gpmRatioWinnerLoser=1.312 | favoriteGap5Wins=0.693 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.891 | soulWins=0.673 | firstTowerWins=0.868 | firstTowerMedianSec=615 | stealFraction=0.094 | towersPerGame=8.182

ponto {"goldFightExponent":8,"fightNoiseBase":0.05}
  durationMeanMin=23.895 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1851 | teamGoldAt10=18133 | teamGoldAt20=36086 | killsPerGame=42.807 | killLeaderAt20Wins=0.972 | goldLeaderAt20Wins=0.990 | goldLeaderAt25Wins=1.000 | killRatioWinnerLoser=9.441 | winnerBehindGoldFrac=0.002 | goldDiffWinnerLoserMean=12619 | gpmRatioWinnerLoser=1.331 | favoriteGap5Wins=0.653 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.885 | soulWins=0.755 | firstTowerWins=0.853 | firstTowerMedianSec=615 | stealFraction=0.091 | towersPerGame=8.240

ponto {"goldFightExponent":8,"fightNoiseBase":0.08}
  durationMeanMin=24.010 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=18137 | teamGoldAt20=36086 | killsPerGame=43.028 | killLeaderAt20Wins=0.975 | goldLeaderAt20Wins=0.990 | goldLeaderAt25Wins=0.992 | killRatioWinnerLoser=9.427 | winnerBehindGoldFrac=0.000 | goldDiffWinnerLoserMean=12686 | gpmRatioWinnerLoser=1.331 | favoriteGap5Wins=0.640 | favoriteGapUnder1Wins=0.449 | firstBaronWins=0.890 | soulWins=0.792 | firstTowerWins=0.848 | firstTowerMedianSec=615 | stealFraction=0.091 | towersPerGame=8.280

ponto {"goldFightExponent":8,"fightNoiseBase":0.12}
  durationMeanMin=24.094 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1849 | teamGoldAt10=18127 | teamGoldAt20=36080 | killsPerGame=43.053 | killLeaderAt20Wins=0.970 | goldLeaderAt20Wins=0.983 | goldLeaderAt25Wins=0.970 | killRatioWinnerLoser=8.708 | winnerBehindGoldFrac=0.007 | goldDiffWinnerLoserMean=12587 | gpmRatioWinnerLoser=1.329 | favoriteGap5Wins=0.653 | favoriteGapUnder1Wins=0.461 | firstBaronWins=0.893 | soulWins=0.768 | firstTowerWins=0.852 | firstTowerMedianSec=615 | stealFraction=0.092 | towersPerGame=8.322
```

Nenhum dos nove pontos passa no item 2 (o melhor `favoriteGap5Wins` foi 0,707, abaixo do piso 0,75),
entao o plano manda repetir com `fightNoiseBase` em {0,02; 0,16; 0,20} e `goldFightExponent` em
{4; 6; 10}. Grade B, mesmo criterio:

```
npx tsx scripts/sweep-realism.ts '[{"goldFightExponent":4,"fightNoiseBase":0.02},{"goldFightExponent":4,"fightNoiseBase":0.16},{"goldFightExponent":4,"fightNoiseBase":0.20},{"goldFightExponent":6,"fightNoiseBase":0.02},{"goldFightExponent":6,"fightNoiseBase":0.16},{"goldFightExponent":6,"fightNoiseBase":0.20},{"goldFightExponent":10,"fightNoiseBase":0.02},{"goldFightExponent":10,"fightNoiseBase":0.16},{"goldFightExponent":10,"fightNoiseBase":0.20}]' 600
```

Saida inteira da grade B:

```
N=600 por ponto, cenario app

ponto {"goldFightExponent":4,"fightNoiseBase":0.02}
  durationMeanMin=24.206 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1861 | teamGoldAt10=18133 | teamGoldAt20=36268 | killsPerGame=42.500 | killLeaderAt20Wins=0.933 | goldLeaderAt20Wins=0.943 | goldLeaderAt25Wins=0.947 | killRatioWinnerLoser=5.866 | winnerBehindGoldFrac=0.028 | goldDiffWinnerLoserMean=11776 | gpmRatioWinnerLoser=1.301 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.491 | firstBaronWins=0.907 | soulWins=0.711 | firstTowerWins=0.857 | firstTowerMedianSec=615 | stealFraction=0.094 | towersPerGame=8.200

ponto {"goldFightExponent":4,"fightNoiseBase":0.16}
  durationMeanMin=24.454 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1868 | teamGoldAt10=18142 | teamGoldAt20=36296 | killsPerGame=43.013 | killLeaderAt20Wins=0.906 | goldLeaderAt20Wins=0.932 | goldLeaderAt25Wins=0.925 | killRatioWinnerLoser=5.110 | winnerBehindGoldFrac=0.027 | goldDiffWinnerLoserMean=11545 | gpmRatioWinnerLoser=1.291 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.884 | soulWins=0.726 | firstTowerWins=0.867 | firstTowerMedianSec=615 | stealFraction=0.097 | towersPerGame=8.263

ponto {"goldFightExponent":4,"fightNoiseBase":0.2}
  durationMeanMin=24.602 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1868 | teamGoldAt10=18120 | teamGoldAt20=36251 | killsPerGame=43.135 | killLeaderAt20Wins=0.879 | goldLeaderAt20Wins=0.923 | goldLeaderAt25Wins=0.926 | killRatioWinnerLoser=4.728 | winnerBehindGoldFrac=0.032 | goldDiffWinnerLoserMean=11405 | gpmRatioWinnerLoser=1.285 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.449 | firstBaronWins=0.888 | soulWins=0.692 | firstTowerWins=0.868 | firstTowerMedianSec=615 | stealFraction=0.095 | towersPerGame=8.275

ponto {"goldFightExponent":6,"fightNoiseBase":0.02}
  durationMeanMin=24.107 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1851 | teamGoldAt10=18128 | teamGoldAt20=36114 | killsPerGame=42.692 | killLeaderAt20Wins=0.957 | goldLeaderAt20Wins=0.968 | goldLeaderAt25Wins=0.946 | killRatioWinnerLoser=7.604 | winnerBehindGoldFrac=0.013 | goldDiffWinnerLoserMean=12352 | gpmRatioWinnerLoser=1.321 | favoriteGap5Wins=0.640 | favoriteGapUnder1Wins=0.485 | firstBaronWins=0.885 | soulWins=0.748 | firstTowerWins=0.857 | firstTowerMedianSec=615 | stealFraction=0.090 | towersPerGame=8.253

ponto {"goldFightExponent":6,"fightNoiseBase":0.16}
  durationMeanMin=23.999 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1852 | teamGoldAt10=18124 | teamGoldAt20=36118 | killsPerGame=42.508 | killLeaderAt20Wins=0.958 | goldLeaderAt20Wins=0.973 | goldLeaderAt25Wins=0.969 | killRatioWinnerLoser=7.780 | winnerBehindGoldFrac=0.017 | goldDiffWinnerLoserMean=12285 | gpmRatioWinnerLoser=1.320 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.878 | soulWins=0.750 | firstTowerWins=0.873 | firstTowerMedianSec=615 | stealFraction=0.093 | towersPerGame=8.232

ponto {"goldFightExponent":6,"fightNoiseBase":0.2}
  durationMeanMin=24.155 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1854 | teamGoldAt10=18115 | teamGoldAt20=36103 | killsPerGame=42.732 | killLeaderAt20Wins=0.941 | goldLeaderAt20Wins=0.963 | goldLeaderAt25Wins=0.972 | killRatioWinnerLoser=7.412 | winnerBehindGoldFrac=0.015 | goldDiffWinnerLoserMean=12250 | gpmRatioWinnerLoser=1.316 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.491 | firstBaronWins=0.880 | soulWins=0.717 | firstTowerWins=0.865 | firstTowerMedianSec=615 | stealFraction=0.090 | towersPerGame=8.238

ponto {"goldFightExponent":10,"fightNoiseBase":0.02}
  durationMeanMin=23.840 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1844 | teamGoldAt10=18120 | teamGoldAt20=36069 | killsPerGame=42.135 | killLeaderAt20Wins=0.973 | goldLeaderAt20Wins=0.982 | goldLeaderAt25Wins=0.992 | killRatioWinnerLoser=9.906 | winnerBehindGoldFrac=0.008 | goldDiffWinnerLoserMean=12491 | gpmRatioWinnerLoser=1.330 | favoriteGap5Wins=0.653 | favoriteGapUnder1Wins=0.497 | firstBaronWins=0.886 | soulWins=0.752 | firstTowerWins=0.862 | firstTowerMedianSec=615 | stealFraction=0.089 | towersPerGame=8.235

ponto {"goldFightExponent":10,"fightNoiseBase":0.16}
  durationMeanMin=23.846 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1847 | teamGoldAt10=18108 | teamGoldAt20=36111 | killsPerGame=42.042 | killLeaderAt20Wins=0.972 | goldLeaderAt20Wins=0.985 | goldLeaderAt25Wins=0.984 | killRatioWinnerLoser=8.815 | winnerBehindGoldFrac=0.008 | goldDiffWinnerLoserMean=12379 | gpmRatioWinnerLoser=1.327 | favoriteGap5Wins=0.640 | favoriteGapUnder1Wins=0.485 | firstBaronWins=0.884 | soulWins=0.740 | firstTowerWins=0.863 | firstTowerMedianSec=615 | stealFraction=0.090 | towersPerGame=8.265

ponto {"goldFightExponent":10,"fightNoiseBase":0.2}
  durationMeanMin=23.902 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1848 | teamGoldAt10=18112 | teamGoldAt20=36108 | killsPerGame=42.107 | killLeaderAt20Wins=0.970 | goldLeaderAt20Wins=0.982 | goldLeaderAt25Wins=0.984 | killRatioWinnerLoser=8.657 | winnerBehindGoldFrac=0.010 | goldDiffWinnerLoserMean=12344 | gpmRatioWinnerLoser=1.325 | favoriteGap5Wins=0.640 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.887 | soulWins=0.714 | firstTowerWins=0.863 | firstTowerMedianSec=615 | stealFraction=0.090 | towersPerGame=8.275
```

Aplicacao do criterio aos 18 pontos (valores copiados das duas saidas acima; A e B sao as grades):

| grade | exp | noiseBase | hardRule | cap | fav5 | fav<1 | goldL@20 | killL@20 | item1 | item2 | item3 soma |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 3 | 0.05 | 0 | 0.000 | 0.693 | 0.485 | 0.922 | 0.906 | sim | nao | 0.2820 |
| A | 3 | 0.08 | 0 | 0.000 | 0.707 | 0.455 | 0.908 | 0.888 | sim | nao | 0.2500 |
| A | 3 | 0.12 | 0 | 0.000 | 0.693 | 0.479 | 0.903 | 0.863 | sim | nao | 0.2200 |
| A | 5 | 0.05 | 0 | 0.000 | 0.693 | 0.467 | 0.960 | 0.933 | sim | nao | 0.3470 |
| A | 5 | 0.08 | 0 | 0.000 | 0.680 | 0.479 | 0.960 | 0.943 | sim | nao | 0.3570 |
| A | 5 | 0.12 | 0 | 0.000 | 0.693 | 0.467 | 0.963 | 0.941 | sim | nao | 0.3580 |
| A | 8 | 0.05 | 0 | 0.000 | 0.653 | 0.479 | 0.990 | 0.972 | sim | nao | 0.4160 |
| A | 8 | 0.08 | 0 | 0.000 | 0.640 | 0.449 | 0.990 | 0.975 | sim | nao | 0.4190 |
| A | 8 | 0.12 | 0 | 0.000 | 0.653 | 0.461 | 0.983 | 0.970 | sim | nao | 0.4070 |
| B | 4 | 0.02 | 0 | 0.000 | 0.680 | 0.491 | 0.943 | 0.933 | sim | nao | 0.3300 |
| B | 4 | 0.16 | 0 | 0.000 | 0.667 | 0.467 | 0.932 | 0.906 | sim | nao | 0.2920 |
| B | 4 | 0.2 | 0 | 0.000 | 0.680 | 0.449 | 0.923 | 0.879 | sim | nao | 0.2560 |
| B | 6 | 0.02 | 0 | 0.000 | 0.640 | 0.485 | 0.968 | 0.957 | sim | nao | 0.3790 |
| B | 6 | 0.16 | 0 | 0.000 | 0.667 | 0.467 | 0.973 | 0.958 | sim | nao | 0.3850 |
| B | 6 | 0.2 | 0 | 0.000 | 0.667 | 0.491 | 0.963 | 0.941 | sim | nao | 0.3580 |
| B | 10 | 0.02 | 0 | 0.000 | 0.653 | 0.497 | 0.982 | 0.973 | sim | nao | 0.4090 |
| B | 10 | 0.16 | 0 | 0.000 | 0.640 | 0.485 | 0.985 | 0.972 | sim | nao | 0.4110 |
| B | 10 | 0.2 | 0 | 0.000 | 0.640 | 0.479 | 0.982 | 0.970 | sim | nao | 0.4060 |

Nenhum dos 18 pontos passa no item 2 (o melhor `favoriteGap5Wins` de todos e 0,707). Todos passam
no item 1 (regras duras em zero, `capFraction` 0,000). Pela regra de queda do plano, escolhe-se pelo
item 3 entre os que passam no item 1.

**Ponto escolhido: `goldFightExponent = 3`, `fightNoiseBase = 0.12`** (menor soma no item 3, 0,2200).
Gravado em `DEFAULT_REALISM_TUNING`. **O item 2 (`favoriteGap5Wins` em [0,75; 0,85]) fica para a
Task 8**, como o plano manda.

Ressalvas registradas (nada disto mudou a escolha, que seguiu o plano):

- O ponto escolhido esta no canto da grade em `goldFightExponent` (o menor valor varrido, 3) e perto do
  teto em `fightNoiseBase`. Em toda a grade, expoente menor e sorteio mais largo melhoraram o item 3.
  Esse eixo e muito sensivel: do 3 para o 5 o lider de ouro aos 20 vai de 0,903 a 0,963.
- Duracao media do cenario `app` no ponto escolhido: 24,852 min, abaixo do piso de 29 da trava
  (era 28,498 antes desta task). A trava de duracao e fechada na Task 8, como ja estava dito.
- Como a grade do plano nao cobre expoente abaixo de 3, rodei por informacao (sem uso na escolha)
  quatro pontos extras, com a recompensa de objetivo ja no padrao final (0.25 x 1500), mesmas seeds:

```
N=600 por ponto, cenario app

ponto {"goldFightExponent":1,"fightNoiseBase":0.12}
  durationMeanMin=27.634 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1909 | teamGoldAt10=18039 | teamGoldAt20=36267 | killsPerGame=44.755 | killLeaderAt20Wins=0.703 | goldLeaderAt20Wins=0.762 | goldLeaderAt25Wins=0.684 | killRatioWinnerLoser=1.507 | winnerBehindGoldFrac=0.177 | goldDiffWinnerLoserMean=5598 | gpmRatioWinnerLoser=1.115 | favoriteGap5Wins=0.867 | favoriteGapUnder1Wins=0.491 | firstBaronWins=0.761 | soulWins=0.641 | firstTowerWins=0.825 | firstTowerMedianSec=645 | stealFraction=0.096 | towersPerGame=8.505

ponto {"goldFightExponent":2,"fightNoiseBase":0.12}
  durationMeanMin=26.140 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1883 | teamGoldAt10=18070 | teamGoldAt20=36217 | killsPerGame=43.668 | killLeaderAt20Wins=0.785 | goldLeaderAt20Wins=0.813 | goldLeaderAt25Wins=0.713 | killRatioWinnerLoser=2.337 | winnerBehindGoldFrac=0.107 | goldDiffWinnerLoserMean=8552 | gpmRatioWinnerLoser=1.197 | favoriteGap5Wins=0.693 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.820 | soulWins=0.602 | firstTowerWins=0.828 | firstTowerMedianSec=630 | stealFraction=0.094 | towersPerGame=8.352

ponto {"goldFightExponent":2,"fightNoiseBase":0.2}
  durationMeanMin=26.373 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1892 | teamGoldAt10=18082 | teamGoldAt20=36347 | killsPerGame=44.212 | killLeaderAt20Wins=0.776 | goldLeaderAt20Wins=0.817 | goldLeaderAt25Wins=0.738 | killRatioWinnerLoser=2.104 | winnerBehindGoldFrac=0.125 | goldDiffWinnerLoserMean=8090 | gpmRatioWinnerLoser=1.181 | favoriteGap5Wins=0.760 | favoriteGapUnder1Wins=0.473 | firstBaronWins=0.816 | soulWins=0.587 | firstTowerWins=0.827 | firstTowerMedianSec=630 | stealFraction=0.097 | towersPerGame=8.333

ponto {"goldFightExponent":3,"fightNoiseBase":0.12}
  durationMeanMin=24.852 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1864 | teamGoldAt10=18109 | teamGoldAt20=36314 | killsPerGame=43.517 | killLeaderAt20Wins=0.863 | goldLeaderAt20Wins=0.902 | goldLeaderAt25Wins=0.879 | killRatioWinnerLoser=3.939 | winnerBehindGoldFrac=0.050 | goldDiffWinnerLoserMean=11427 | gpmRatioWinnerLoser=1.283 | favoriteGap5Wins=0.693 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.876 | soulWins=0.638 | firstTowerWins=0.848 | firstTowerMedianSec=630 | stealFraction=0.091 | towersPerGame=8.202
```

  Leitura: expoente 2 com `fightNoiseBase = 0.20` ja cai em banda em `favoriteGap5Wins` (0,760),
  `favoriteGapUnder1Wins` (0,473), `killLeaderAt20Wins` (0,776), `goldLeaderAt20Wins` (0,817),
  `killRatioWinnerLoser` (2,104), `goldDiffWinnerLoserMean` (8090) e `gpmRatioWinnerLoser` (1,181), e a
  duracao sobe a 26,4 min. Em compensacao `winnerBehindGoldFrac` fica em 0,125 e `goldLeaderAt25Wins` em
  0,738, ambos fora de banda. Fica registrado como ponto de partida para a Task 8.

## 3. Recompensa de objetivo (Task 4)

Contexto: `objectiveBountyGold` paga ao time atras uma fracao do deficit de ouro (limiar 1500,
teto `objectiveBountyCap`, escalada pelo caos efetivo sobre o caos de referencia 0,25) quando ele
toma objetivo (`takeObjective`, que cobre roubo), torre ou inibidor (`damageStructure`). Esta varredura
roda com o ponto da secao 2 ja gravado como padrao (`goldFightExponent = 3`, `fightNoiseBase = 0.12`).

Comando (cenario `app`, 600 partidas por ponto, mesmas seeds em todos os pontos):

```
npx tsx scripts/sweep-realism.ts '[{"objectiveBountyFraction":0.15,"objectiveBountyCap":1500},{"objectiveBountyFraction":0.15,"objectiveBountyCap":2500},{"objectiveBountyFraction":0.25,"objectiveBountyCap":1500},{"objectiveBountyFraction":0.25,"objectiveBountyCap":2500},{"objectiveBountyFraction":0.35,"objectiveBountyCap":1500},{"objectiveBountyFraction":0.35,"objectiveBountyCap":2500}]' 600
```

Criterio de escolha, nesta ordem:

1. `winnerBehindGoldFrac` <= 0,05 e `goldLeaderAt25Wins` em [0,77; 0,89];
2. entre os que passam, o de maior `objectiveBountyFraction x objectiveBountyCap` (mais espaco de virada);
3. se nenhum passar, o de menor `winnerBehindGoldFrac`.

Saida inteira da varredura:

```
N=600 por ponto, cenario app

ponto {"objectiveBountyFraction":0.15,"objectiveBountyCap":1500}
  durationMeanMin=24.727 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1837 | teamGoldAt10=18000 | teamGoldAt20=35813 | killsPerGame=43.492 | killLeaderAt20Wins=0.890 | goldLeaderAt20Wins=0.907 | goldLeaderAt25Wins=0.899 | killRatioWinnerLoser=4.677 | winnerBehindGoldFrac=0.035 | goldDiffWinnerLoserMean=12584 | gpmRatioWinnerLoser=1.322 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.509 | firstBaronWins=0.878 | soulWins=0.689 | firstTowerWins=0.843 | firstTowerMedianSec=615 | stealFraction=0.094 | towersPerGame=8.182

ponto {"objectiveBountyFraction":0.15,"objectiveBountyCap":2500}
  durationMeanMin=24.727 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1840 | teamGoldAt10=18000 | teamGoldAt20=35817 | killsPerGame=43.500 | killLeaderAt20Wins=0.890 | goldLeaderAt20Wins=0.907 | goldLeaderAt25Wins=0.899 | killRatioWinnerLoser=4.673 | winnerBehindGoldFrac=0.035 | goldDiffWinnerLoserMean=12439 | gpmRatioWinnerLoser=1.318 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.509 | firstBaronWins=0.878 | soulWins=0.687 | firstTowerWins=0.843 | firstTowerMedianSec=615 | stealFraction=0.094 | towersPerGame=8.182

ponto {"objectiveBountyFraction":0.25,"objectiveBountyCap":1500}
  durationMeanMin=24.852 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1864 | teamGoldAt10=18109 | teamGoldAt20=36314 | killsPerGame=43.517 | killLeaderAt20Wins=0.863 | goldLeaderAt20Wins=0.902 | goldLeaderAt25Wins=0.879 | killRatioWinnerLoser=3.939 | winnerBehindGoldFrac=0.050 | goldDiffWinnerLoserMean=11427 | gpmRatioWinnerLoser=1.283 | favoriteGap5Wins=0.693 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.876 | soulWins=0.638 | firstTowerWins=0.848 | firstTowerMedianSec=630 | stealFraction=0.091 | towersPerGame=8.202

ponto {"objectiveBountyFraction":0.25,"objectiveBountyCap":2500}
  durationMeanMin=24.851 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1874 | teamGoldAt10=18110 | teamGoldAt20=36390 | killsPerGame=43.437 | killLeaderAt20Wins=0.863 | goldLeaderAt20Wins=0.903 | goldLeaderAt25Wins=0.874 | killRatioWinnerLoser=3.888 | winnerBehindGoldFrac=0.052 | goldDiffWinnerLoserMean=10903 | gpmRatioWinnerLoser=1.266 | favoriteGap5Wins=0.693 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.874 | soulWins=0.655 | firstTowerWins=0.848 | firstTowerMedianSec=630 | stealFraction=0.092 | towersPerGame=8.212

ponto {"objectiveBountyFraction":0.35,"objectiveBountyCap":1500}
  durationMeanMin=25.459 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1879 | teamGoldAt10=18193 | teamGoldAt20=36522 | killsPerGame=44.560 | killLeaderAt20Wins=0.851 | goldLeaderAt20Wins=0.870 | goldLeaderAt25Wins=0.831 | killRatioWinnerLoser=3.331 | winnerBehindGoldFrac=0.068 | goldDiffWinnerLoserMean=10652 | gpmRatioWinnerLoser=1.252 | favoriteGap5Wins=0.720 | favoriteGapUnder1Wins=0.461 | firstBaronWins=0.858 | soulWins=0.619 | firstTowerWins=0.825 | firstTowerMedianSec=630 | stealFraction=0.095 | towersPerGame=8.395

ponto {"objectiveBountyFraction":0.35,"objectiveBountyCap":2500}
  durationMeanMin=25.699 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1900 | teamGoldAt10=18204 | teamGoldAt20=36744 | killsPerGame=44.957 | killLeaderAt20Wins=0.846 | goldLeaderAt20Wins=0.866 | goldLeaderAt25Wins=0.827 | killRatioWinnerLoser=3.174 | winnerBehindGoldFrac=0.077 | goldDiffWinnerLoserMean=9611 | gpmRatioWinnerLoser=1.221 | favoriteGap5Wins=0.747 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.860 | soulWins=0.582 | firstTowerWins=0.823 | firstTowerMedianSec=630 | stealFraction=0.093 | towersPerGame=8.448
```

Aplicacao do criterio (valores copiados da saida acima):

| fracao | teto | winnerBehindGoldFrac | goldLeaderAt25Wins | passa no item 1 | fracao x teto |
|---|---|---|---|---|---|
| 0.15 | 1500 | 0.035 | 0.899 | nao | - |
| 0.15 | 2500 | 0.035 | 0.899 | nao | - |
| 0.25 | 1500 | 0.050 | 0.879 | sim | 375 |
| 0.25 | 2500 | 0.052 | 0.874 | nao | - |
| 0.35 | 1500 | 0.068 | 0.831 | nao | - |
| 0.35 | 2500 | 0.077 | 0.827 | nao | - |

Um unico ponto passa no item 1, entao o item 2 nao precisou desempatar.

**Ponto escolhido: `objectiveBountyFraction = 0.25`, `objectiveBountyCap = 1500`.** Gravado em
`DEFAULT_REALISM_TUNING` (`objectiveBountyMinDeficit` ficou em 1500, nao varrido).

Ressalva registrada: `winnerBehindGoldFrac` deste ponto e exatamente 0,05 (30 de 600 partidas),
ou seja, passa no limite do criterio sem folga. Nas seeds seguintes ele pode cair para 0,052. Como o
ponto da secao 2 ainda sera refeito na Task 8, esta escolha tambem e refeita la.

### Relatorio de realismo apos a Task 4 (cenario `app`, REALISM_N=600)

```
=== cenario app (N=600) ===
violacoes de regra dura: 0
FORA [trava] duracao media (min): 24.852  banda [29.000; 36.000] alvo 32.300
OK   [trava] fracao no teto de 60 min: 0.000  banda [0.000; 0.005] alvo 0.000
OK   [trava] mediana da 1a torre (s): 630  banda [480; 1200] alvo 975
FORA [aceite] lider de abates aos 20 vence: 0.863  banda [0.700; 0.820] alvo 0.764
FORA [aceite] lider de ouro aos 15 vence: 0.867  banda [0.660; 0.780] alvo 0.716
FORA [aceite] lider de ouro aos 20 vence: 0.902  banda [0.720; 0.840] alvo 0.782
OK   [aceite] lider de ouro aos 25 vence: 0.879  banda [0.770; 0.890] alvo 0.830
FORA [aceite] abates vencedor / perdedor: 3.939  banda [1.800; 2.600] alvo 2.150
OK   [aceite] vencedor com mais abates: 0.918  banda [0.850; 1.000] alvo 0.900
OK   [aceite] vencedor atras no ouro: 0.050  banda [0.000; 0.050] alvo 0.020
OK   [aceite] ouro vencedor menos perdedor: 11427  banda [7000; 13000] alvo 10000
OK   [aceite] GPM por time: 1864  banda [1650; 2050] alvo 1833
FORA [aceite] GPM vencedor / perdedor: 1.283  banda [1.120; 1.260] alvo 1.190
OK   [aceite] time do 1o Barao vence: 0.876  banda [0.780; 0.900] alvo 0.854
FORA [aceite] time da Alma vence: 0.638  banda [0.840; 0.950] alvo 0.908
FORA [aceite] time da 1a torre vence: 0.848  banda [0.620; 0.750] alvo 0.682
FORA [aceite] roubos / objetivos tomados: 0.091  banda [0.000; 0.030] alvo 0.020
FORA [aceite] favorito com gap >= 5 vence: 0.693  banda [0.750; 0.850] alvo 0.800
OK   [aceite] favorito com gap < 1 vence: 0.479  banda [0.450; 0.550] alvo 0.500
--- acompanhadas sem gate ---
     abates por partida: 43.517  (real 27)
     abates por minuto: 1.751  (real 0,84)
     mediana do first blood (s): 60.000  (real 300)
     mediana do 1o dragao (s): 315  (real 550)
     1o Barao no 1o minuto de spawn: 0.581  (real raro)
     partidas com Elder: 0.043  (real 0,08)
     torres por partida: 8.202  (real 11,9)
     lider de torres aos 20 vence: 0.874  (real sem fonte)
     ouro por time aos 10: 18109  (real 15900)
     ouro por time aos 15: 27322  (real 24700)
     ouro por time aos 20: 36314  (real 34200)
     abates aos 10: 11.375  (real 3,2)
     abates aos 20: 27.883  (real 10,7)
```

## 2b. Recalibracao por ruling do controlador (Task 4, fix 1)

Ruling (vinculante): o criterio de selecao do plano manda, a grade do plano (expoente 3 a 10) errou a regiao boa; refazer a varredura em volta do ponto fora da grade, com o criterio exato dos Steps 8 e 9.

Esta secao SUPERA as escolhas das secoes 2 e 3 (que ficam como registro da rodada com a grade do plano): os padroes gravados em `DEFAULT_REALISM_TUNING` agora sao os desta secao.

### Luta: expoente {1,5; 2; 2,5} x ruido {0,16; 0,20; 0,24}

Comando (cenario `app`, 600 partidas por ponto, mesmas seeds, recompensa de objetivo no padrao vigente 0.25 x 1500):

```
npx tsx scripts/sweep-realism.ts '[{"goldFightExponent":1.5,"fightNoiseBase":0.16},{"goldFightExponent":1.5,"fightNoiseBase":0.20},{"goldFightExponent":1.5,"fightNoiseBase":0.24},{"goldFightExponent":2,"fightNoiseBase":0.16},{"goldFightExponent":2,"fightNoiseBase":0.20},{"goldFightExponent":2,"fightNoiseBase":0.24},{"goldFightExponent":2.5,"fightNoiseBase":0.16},{"goldFightExponent":2.5,"fightNoiseBase":0.20},{"goldFightExponent":2.5,"fightNoiseBase":0.24}]' 600
```

Criterio, o mesmo do Step 8: item 1 (`hardRuleViolations` = 0 e `capFraction` <= 0,005); item 2 (`favoriteGap5Wins` em [0,75; 0,85] e `favoriteGapUnder1Wins` em [0,45; 0,55]); item 3 (menor `|goldLeaderAt20Wins - 0.782| + |killLeaderAt20Wins - 0.764|`).

Saida inteira:

```
N=600 por ponto, cenario app

ponto {"goldFightExponent":1.5,"fightNoiseBase":0.16}
  durationMeanMin=26.988 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1900 | teamGoldAt10=18057 | teamGoldAt20=36307 | killsPerGame=44.800 | killLeaderAt20Wins=0.768 | goldLeaderAt20Wins=0.792 | goldLeaderAt25Wins=0.684 | killRatioWinnerLoser=1.846 | winnerBehindGoldFrac=0.145 | goldDiffWinnerLoserMean=7023 | gpmRatioWinnerLoser=1.151 | favoriteGap5Wins=0.787 | favoriteGapUnder1Wins=0.509 | firstBaronWins=0.769 | soulWins=0.646 | firstTowerWins=0.810 | firstTowerMedianSec=630 | stealFraction=0.097 | towersPerGame=8.405

ponto {"goldFightExponent":1.5,"fightNoiseBase":0.2}
  durationMeanMin=26.785 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1904 | teamGoldAt10=18059 | teamGoldAt20=36354 | killsPerGame=44.468 | killLeaderAt20Wins=0.747 | goldLeaderAt20Wins=0.785 | goldLeaderAt25Wins=0.690 | killRatioWinnerLoser=1.726 | winnerBehindGoldFrac=0.157 | goldDiffWinnerLoserMean=6827 | gpmRatioWinnerLoser=1.147 | favoriteGap5Wins=0.813 | favoriteGapUnder1Wins=0.509 | firstBaronWins=0.783 | soulWins=0.601 | firstTowerWins=0.835 | firstTowerMedianSec=630 | stealFraction=0.095 | towersPerGame=8.322

ponto {"goldFightExponent":1.5,"fightNoiseBase":0.24}
  durationMeanMin=26.639 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1907 | teamGoldAt10=18038 | teamGoldAt20=36408 | killsPerGame=44.210 | killLeaderAt20Wins=0.754 | goldLeaderAt20Wins=0.797 | goldLeaderAt25Wins=0.687 | killRatioWinnerLoser=1.716 | winnerBehindGoldFrac=0.150 | goldDiffWinnerLoserMean=6532 | gpmRatioWinnerLoser=1.143 | favoriteGap5Wins=0.800 | favoriteGapUnder1Wins=0.491 | firstBaronWins=0.773 | soulWins=0.585 | firstTowerWins=0.833 | firstTowerMedianSec=630 | stealFraction=0.098 | towersPerGame=8.300

ponto {"goldFightExponent":2,"fightNoiseBase":0.16}
  durationMeanMin=26.101 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1889 | teamGoldAt10=18081 | teamGoldAt20=36318 | killsPerGame=43.485 | killLeaderAt20Wins=0.779 | goldLeaderAt20Wins=0.798 | goldLeaderAt25Wins=0.672 | killRatioWinnerLoser=2.201 | winnerBehindGoldFrac=0.132 | goldDiffWinnerLoserMean=8123 | gpmRatioWinnerLoser=1.184 | favoriteGap5Wins=0.787 | favoriteGapUnder1Wins=0.473 | firstBaronWins=0.819 | soulWins=0.557 | firstTowerWins=0.845 | firstTowerMedianSec=630 | stealFraction=0.096 | towersPerGame=8.295

ponto {"goldFightExponent":2,"fightNoiseBase":0.2}
  durationMeanMin=26.373 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1892 | teamGoldAt10=18082 | teamGoldAt20=36347 | killsPerGame=44.212 | killLeaderAt20Wins=0.776 | goldLeaderAt20Wins=0.817 | goldLeaderAt25Wins=0.738 | killRatioWinnerLoser=2.104 | winnerBehindGoldFrac=0.125 | goldDiffWinnerLoserMean=8090 | gpmRatioWinnerLoser=1.181 | favoriteGap5Wins=0.760 | favoriteGapUnder1Wins=0.473 | firstBaronWins=0.816 | soulWins=0.587 | firstTowerWins=0.827 | firstTowerMedianSec=630 | stealFraction=0.097 | towersPerGame=8.333

ponto {"goldFightExponent":2,"fightNoiseBase":0.24}
  durationMeanMin=26.477 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1895 | teamGoldAt10=18091 | teamGoldAt20=36384 | killsPerGame=44.637 | killLeaderAt20Wins=0.766 | goldLeaderAt20Wins=0.812 | goldLeaderAt25Wins=0.724 | killRatioWinnerLoser=2.091 | winnerBehindGoldFrac=0.127 | goldDiffWinnerLoserMean=8122 | gpmRatioWinnerLoser=1.177 | favoriteGap5Wins=0.747 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.805 | soulWins=0.615 | firstTowerWins=0.830 | firstTowerMedianSec=630 | stealFraction=0.097 | towersPerGame=8.347

ponto {"goldFightExponent":2.5,"fightNoiseBase":0.16}
  durationMeanMin=25.507 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1878 | teamGoldAt10=18104 | teamGoldAt20=36286 | killsPerGame=43.988 | killLeaderAt20Wins=0.836 | goldLeaderAt20Wins=0.872 | goldLeaderAt25Wins=0.819 | killRatioWinnerLoser=3.037 | winnerBehindGoldFrac=0.068 | goldDiffWinnerLoserMean=10141 | gpmRatioWinnerLoser=1.238 | favoriteGap5Wins=0.720 | favoriteGapUnder1Wins=0.449 | firstBaronWins=0.844 | soulWins=0.611 | firstTowerWins=0.827 | firstTowerMedianSec=630 | stealFraction=0.091 | towersPerGame=8.322

ponto {"goldFightExponent":2.5,"fightNoiseBase":0.2}
  durationMeanMin=25.570 | capFraction=0.002 | hardRuleViolations=0.000 | gpmTeamMean=1883 | teamGoldAt10=18131 | teamGoldAt20=36336 | killsPerGame=43.862 | killLeaderAt20Wins=0.809 | goldLeaderAt20Wins=0.862 | goldLeaderAt25Wins=0.780 | killRatioWinnerLoser=2.666 | winnerBehindGoldFrac=0.088 | goldDiffWinnerLoserMean=9371 | gpmRatioWinnerLoser=1.219 | favoriteGap5Wins=0.747 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.831 | soulWins=0.589 | firstTowerWins=0.828 | firstTowerMedianSec=630 | stealFraction=0.094 | towersPerGame=8.287

ponto {"goldFightExponent":2.5,"fightNoiseBase":0.24}
  durationMeanMin=25.597 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1886 | teamGoldAt10=18112 | teamGoldAt20=36370 | killsPerGame=43.658 | killLeaderAt20Wins=0.787 | goldLeaderAt20Wins=0.842 | goldLeaderAt25Wins=0.757 | killRatioWinnerLoser=2.492 | winnerBehindGoldFrac=0.112 | goldDiffWinnerLoserMean=9090 | gpmRatioWinnerLoser=1.211 | favoriteGap5Wins=0.760 | favoriteGapUnder1Wins=0.527 | firstBaronWins=0.830 | soulWins=0.692 | firstTowerWins=0.852 | firstTowerMedianSec=630 | stealFraction=0.094 | towersPerGame=8.227
```

Aplicacao do criterio (valores copiados da saida acima; o item 3 entre parenteses so aparece nos que passam no item 1 mas nao no 2):

| expoente | ruido | hardRule | capFraction | favGap>=5 | favGap<1 | goldL@20 | killL@20 | item 1 | item 2 | item 3 (soma) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.5 | 0.16 | 0 | 0.000 | 0.787 | 0.509 | 0.792 | 0.768 | sim | sim | 0.0140 |
| 1.5 | 0.2 | 0 | 0.000 | 0.813 | 0.509 | 0.785 | 0.747 | sim | sim | 0.0200 |
| 1.5 | 0.24 | 0 | 0.000 | 0.800 | 0.491 | 0.797 | 0.754 | sim | sim | 0.0250 |
| 2 | 0.16 | 0 | 0.000 | 0.787 | 0.473 | 0.798 | 0.779 | sim | sim | 0.0310 |
| 2 | 0.2 | 0 | 0.000 | 0.760 | 0.473 | 0.817 | 0.776 | sim | sim | 0.0470 |
| 2 | 0.24 | 0 | 0.000 | 0.747 | 0.467 | 0.812 | 0.766 | sim | nao | (0.0320) |
| 2.5 | 0.16 | 0 | 0.000 | 0.720 | 0.449 | 0.872 | 0.836 | sim | nao | (0.1620) |
| 2.5 | 0.2 | 0 | 0.002 | 0.747 | 0.467 | 0.862 | 0.809 | sim | nao | (0.1250) |
| 2.5 | 0.24 | 0 | 0.000 | 0.760 | 0.527 | 0.842 | 0.787 | sim | sim | 0.0830 |

Os 9 pontos passam no item 1. Seis passam tambem no item 2 (os tres de expoente 1,5, os dois primeiros de expoente 2 e o de expoente 2,5 com ruido 0,24). Entre eles, a menor soma do item 3 e a de expoente 1,5 com ruido 0,16 (0,0140), seguida de 1,5/0,20 (0,0200), 1,5/0,24 (0,0250), 2/0,16 (0,0310), 2/0,20 (0,0470) e 2,5/0,24 (0,0830).

**Ponto escolhido: `goldFightExponent = 1.5`, `fightNoiseBase = 0.16`.** Item 2 passa (favoriteGap5Wins 0,787, favoriteGapUnder1Wins 0,509), nao foi preciso cair para a regra de queda.

### Recompensa de objetivo: fracao {0,05; 0,10; 0,15; 0,25} x teto {1500; 2500}

Comando (ponto de luta acima ja gravado como padrao):

```
npx tsx scripts/sweep-realism.ts '[{"objectiveBountyFraction":0.05,"objectiveBountyCap":1500},{"objectiveBountyFraction":0.05,"objectiveBountyCap":2500},{"objectiveBountyFraction":0.10,"objectiveBountyCap":1500},{"objectiveBountyFraction":0.10,"objectiveBountyCap":2500},{"objectiveBountyFraction":0.15,"objectiveBountyCap":1500},{"objectiveBountyFraction":0.15,"objectiveBountyCap":2500},{"objectiveBountyFraction":0.25,"objectiveBountyCap":1500},{"objectiveBountyFraction":0.25,"objectiveBountyCap":2500}]' 600
```

Criterio, o mesmo do Step 9: item 1 (`winnerBehindGoldFrac` <= 0,05 e `goldLeaderAt25Wins` em [0,77; 0,89]); item 2 (maior fracao x teto entre os que passam); item 3, se nenhum passar (menor `winnerBehindGoldFrac`).

Saida inteira:

```
N=600 por ponto, cenario app

ponto {"objectiveBountyFraction":0.05,"objectiveBountyCap":1500}
  durationMeanMin=25.853 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1838 | teamGoldAt10=17904 | teamGoldAt20=35484 | killsPerGame=42.502 | killLeaderAt20Wins=0.832 | goldLeaderAt20Wins=0.868 | goldLeaderAt25Wins=0.822 | killRatioWinnerLoser=2.469 | winnerBehindGoldFrac=0.093 | goldDiffWinnerLoserMean=10172 | gpmRatioWinnerLoser=1.243 | favoriteGap5Wins=0.747 | favoriteGapUnder1Wins=0.497 | firstBaronWins=0.828 | soulWins=0.649 | firstTowerWins=0.823 | firstTowerMedianSec=630 | stealFraction=0.090 | towersPerGame=8.138

ponto {"objectiveBountyFraction":0.05,"objectiveBountyCap":2500}
  durationMeanMin=25.853 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1838 | teamGoldAt10=17904 | teamGoldAt20=35484 | killsPerGame=42.502 | killLeaderAt20Wins=0.832 | goldLeaderAt20Wins=0.868 | goldLeaderAt25Wins=0.822 | killRatioWinnerLoser=2.469 | winnerBehindGoldFrac=0.093 | goldDiffWinnerLoserMean=10172 | gpmRatioWinnerLoser=1.243 | favoriteGap5Wins=0.747 | favoriteGapUnder1Wins=0.497 | firstBaronWins=0.828 | soulWins=0.649 | firstTowerWins=0.823 | firstTowerMedianSec=630 | stealFraction=0.090 | towersPerGame=8.138

ponto {"objectiveBountyFraction":0.1,"objectiveBountyCap":1500}
  durationMeanMin=26.205 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1859 | teamGoldAt10=17944 | teamGoldAt20=35717 | killsPerGame=42.998 | killLeaderAt20Wins=0.808 | goldLeaderAt20Wins=0.840 | goldLeaderAt25Wins=0.776 | killRatioWinnerLoser=2.241 | winnerBehindGoldFrac=0.102 | goldDiffWinnerLoserMean=9052 | gpmRatioWinnerLoser=1.208 | favoriteGap5Wins=0.787 | favoriteGapUnder1Wins=0.551 | firstBaronWins=0.825 | soulWins=0.657 | firstTowerWins=0.835 | firstTowerMedianSec=630 | stealFraction=0.092 | towersPerGame=8.207

ponto {"objectiveBountyFraction":0.1,"objectiveBountyCap":2500}
  durationMeanMin=26.197 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1859 | teamGoldAt10=17944 | teamGoldAt20=35717 | killsPerGame=42.928 | killLeaderAt20Wins=0.808 | goldLeaderAt20Wins=0.840 | goldLeaderAt25Wins=0.776 | killRatioWinnerLoser=2.237 | winnerBehindGoldFrac=0.102 | goldDiffWinnerLoserMean=9008 | gpmRatioWinnerLoser=1.207 | favoriteGap5Wins=0.787 | favoriteGapUnder1Wins=0.551 | firstBaronWins=0.825 | soulWins=0.657 | firstTowerWins=0.835 | firstTowerMedianSec=630 | stealFraction=0.092 | towersPerGame=8.208

ponto {"objectiveBountyFraction":0.15,"objectiveBountyCap":1500}
  durationMeanMin=26.512 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1877 | teamGoldAt10=17983 | teamGoldAt20=35947 | killsPerGame=43.632 | killLeaderAt20Wins=0.792 | goldLeaderAt20Wins=0.818 | goldLeaderAt25Wins=0.714 | killRatioWinnerLoser=1.921 | winnerBehindGoldFrac=0.152 | goldDiffWinnerLoserMean=7487 | gpmRatioWinnerLoser=1.170 | favoriteGap5Wins=0.787 | favoriteGapUnder1Wins=0.527 | firstBaronWins=0.784 | soulWins=0.616 | firstTowerWins=0.837 | firstTowerMedianSec=630 | stealFraction=0.094 | towersPerGame=8.252

ponto {"objectiveBountyFraction":0.15,"objectiveBountyCap":2500}
  durationMeanMin=26.523 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1879 | teamGoldAt10=17983 | teamGoldAt20=35949 | killsPerGame=43.670 | killLeaderAt20Wins=0.790 | goldLeaderAt20Wins=0.817 | goldLeaderAt25Wins=0.718 | killRatioWinnerLoser=1.935 | winnerBehindGoldFrac=0.150 | goldDiffWinnerLoserMean=7473 | gpmRatioWinnerLoser=1.169 | favoriteGap5Wins=0.787 | favoriteGapUnder1Wins=0.521 | firstBaronWins=0.786 | soulWins=0.622 | firstTowerWins=0.835 | firstTowerMedianSec=630 | stealFraction=0.094 | towersPerGame=8.260

ponto {"objectiveBountyFraction":0.25,"objectiveBountyCap":1500}
  durationMeanMin=26.988 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1900 | teamGoldAt10=18057 | teamGoldAt20=36307 | killsPerGame=44.800 | killLeaderAt20Wins=0.768 | goldLeaderAt20Wins=0.792 | goldLeaderAt25Wins=0.684 | killRatioWinnerLoser=1.846 | winnerBehindGoldFrac=0.145 | goldDiffWinnerLoserMean=7023 | gpmRatioWinnerLoser=1.151 | favoriteGap5Wins=0.787 | favoriteGapUnder1Wins=0.509 | firstBaronWins=0.769 | soulWins=0.646 | firstTowerWins=0.810 | firstTowerMedianSec=630 | stealFraction=0.097 | towersPerGame=8.405

ponto {"objectiveBountyFraction":0.25,"objectiveBountyCap":2500}
  durationMeanMin=27.007 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1907 | teamGoldAt10=18057 | teamGoldAt20=36352 | killsPerGame=44.865 | killLeaderAt20Wins=0.765 | goldLeaderAt20Wins=0.787 | goldLeaderAt25Wins=0.672 | killRatioWinnerLoser=1.826 | winnerBehindGoldFrac=0.138 | goldDiffWinnerLoserMean=6764 | gpmRatioWinnerLoser=1.145 | favoriteGap5Wins=0.787 | favoriteGapUnder1Wins=0.503 | firstBaronWins=0.768 | soulWins=0.646 | firstTowerWins=0.810 | firstTowerMedianSec=630 | stealFraction=0.096 | towersPerGame=8.427
```

Aplicacao do criterio (valores copiados da saida acima):

| fracao | teto | winnerBehindGoldFrac | goldLeaderAt25Wins | passa no item 1 | fracao x teto |
|---|---|---|---|---|---|
| 0.05 | 1500 | 0.093 | 0.822 | nao | - |
| 0.05 | 2500 | 0.093 | 0.822 | nao | - |
| 0.1 | 1500 | 0.102 | 0.776 | nao | - |
| 0.1 | 2500 | 0.102 | 0.776 | nao | - |
| 0.15 | 1500 | 0.152 | 0.714 | nao | - |
| 0.15 | 2500 | 0.150 | 0.718 | nao | - |
| 0.25 | 1500 | 0.145 | 0.684 | nao | - |
| 0.25 | 2500 | 0.138 | 0.672 | nao | - |

passam item 1: 0
menor winnerBehindGoldFrac: 0.093 em 0.05 x 1500 e 0.05 x 2500

Nenhum dos 8 pontos passa no item 1 (o menor `winnerBehindGoldFrac` e 0,093, bem acima de 0,05), entao vale a regra de queda: o de menor `winnerBehindGoldFrac`. Os pontos 0.05 x 1500 e 0.05 x 2500 empatam e sao identicos em todas as colunas e no valor exato (56 de 600 partidas, 0,0933): com fracao 0,05 o teto de 1500 so morderia com deficit de 30000, o que nao acontece. Desempate pelo espirito do item 2 (mais espaco de virada): **ponto escolhido `objectiveBountyFraction = 0.05`, `objectiveBountyCap = 2500`**, gravado em `DEFAULT_REALISM_TUNING`. O `objectiveBountyMinDeficit` ficou em 1500 (nao varrido).

Informativo, fora da grade e sem uso na escolha: a recompensa DESLIGADA (`objectiveBountyFraction = 0`) no mesmo ponto de luta da `winnerBehindGoldFrac` 0,085, `goldLeaderAt25Wins` 0,862 e `favoriteGap5Wins` 0,733. Ou seja, com a recompensa desligada o excesso de vencedor atras no ouro (item 1 da recompensa) continua, entao ele nao vem da recompensa e sim do ponto de luta (com expoente baixo o ouro pesa pouco na luta). Fica para a Task 8.

```
N=600 por ponto, cenario app

ponto {"objectiveBountyFraction":0,"objectiveBountyCap":1500}
  durationMeanMin=25.610 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1814 | teamGoldAt10=17862 | teamGoldAt20=35170 | killsPerGame=42.478 | killLeaderAt20Wins=0.853 | goldLeaderAt20Wins=0.880 | goldLeaderAt25Wins=0.862 | killRatioWinnerLoser=2.816 | winnerBehindGoldFrac=0.085 | goldDiffWinnerLoserMean=11749 | gpmRatioWinnerLoser=1.290 | favoriteGap5Wins=0.733 | favoriteGapUnder1Wins=0.449 | firstBaronWins=0.843 | soulWins=0.648 | firstTowerWins=0.810 | firstTowerMedianSec=630 | stealFraction=0.093 | towersPerGame=8.117
```

### Relatorio de realismo com os padroes desta secao (cenario `app`, REALISM_N=600)

```
=== cenario app (N=600) ===
violacoes de regra dura: 0
FORA [trava] duracao media (min): 25.853  banda [29.000; 36.000] alvo 32.300
OK   [trava] fracao no teto de 60 min: 0.000  banda [0.000; 0.005] alvo 0.000
OK   [trava] mediana da 1a torre (s): 630  banda [480; 1200] alvo 975
FORA [aceite] lider de abates aos 20 vence: 0.832  banda [0.700; 0.820] alvo 0.764
FORA [aceite] lider de ouro aos 15 vence: 0.862  banda [0.660; 0.780] alvo 0.716
FORA [aceite] lider de ouro aos 20 vence: 0.868  banda [0.720; 0.840] alvo 0.782
OK   [aceite] lider de ouro aos 25 vence: 0.822  banda [0.770; 0.890] alvo 0.830
OK   [aceite] abates vencedor / perdedor: 2.469  banda [1.800; 2.600] alvo 2.150
OK   [aceite] vencedor com mais abates: 0.855  banda [0.850; 1.000] alvo 0.900
FORA [aceite] vencedor atras no ouro: 0.093  banda [0.000; 0.050] alvo 0.020
OK   [aceite] ouro vencedor menos perdedor: 10172  banda [7000; 13000] alvo 10000
OK   [aceite] GPM por time: 1838  banda [1650; 2050] alvo 1833
OK   [aceite] GPM vencedor / perdedor: 1.243  banda [1.120; 1.260] alvo 1.190
OK   [aceite] time do 1o Barao vence: 0.828  banda [0.780; 0.900] alvo 0.854
FORA [aceite] time da Alma vence: 0.649  banda [0.840; 0.950] alvo 0.908
FORA [aceite] time da 1a torre vence: 0.823  banda [0.620; 0.750] alvo 0.682
FORA [aceite] roubos / objetivos tomados: 0.090  banda [0.000; 0.030] alvo 0.020
FORA [aceite] favorito com gap >= 5 vence: 0.747  banda [0.750; 0.850] alvo 0.800
OK   [aceite] favorito com gap < 1 vence: 0.497  banda [0.450; 0.550] alvo 0.500
--- acompanhadas sem gate ---
     abates por partida: 42.502  (real 27)
     abates por minuto: 1.644  (real 0,84)
     mediana do first blood (s): 60.000  (real 300)
     mediana do 1o dragao (s): 315  (real 550)
     1o Barao no 1o minuto de spawn: 0.520  (real raro)
     partidas com Elder: 0.070  (real 0,08)
     torres por partida: 8.138  (real 11,9)
     lider de torres aos 20 vence: 0.866  (real sem fonte)
     ouro por time aos 10: 17904  (real 15900)
     ouro por time aos 15: 26650  (real 24700)
     ouro por time aos 20: 35484  (real 34200)
     abates aos 10: 10.813  (real 3,2)
     abates aos 20: 26.180  (real 10,7)
```

Leitura: com o ponto final, `favoriteGap5Wins` e 0,747 (a 0,003 do piso; na varredura de luta, com a recompensa 0.25 x 1500, era 0,787). Dentro de banda: lider de ouro aos 25, abates venc/perd, vencedor com mais abates, delta de ouro, GPM do time, GPM venc/perd, 1o Barao e favorito gap < 1. Ainda fora: duracao 25,853 min (trava, Task 8), lider de abates aos 20 (0,832), lider de ouro aos 15 e 20 (0,862 e 0,868), vencedor atras no ouro (0,093), Alma (0,649), 1a torre (0,823), roubos (0,090) e favorito gap >= 5 (0,747).


## 4. Janela de conversao (Task 5)

Contexto: depois de uma luta ou pick, o lado com mais gente viva (e pelo menos 3 vivos) converte a
vantagem no passo 0b de `resolveInteraction`: Barao ou Anciao, dragao, Arauto ou larvas, senao dano
de torre na rota da luta. A intencao sorteada do tick fica sem efeito. Quatro campos novos em
`RealismTuning`: `conversionSiegeBase` (dano de cerco por tick com 1 de vantagem, pool de 100 por
torre), `contestBaseEpic`, `contestBaseDragon` e `contestBaseMinor` (chance base de o time em
desvantagem contestar o objetivo da janela, pela regra da Smite). Valores de partida:
35 / 0,7 / 0,45 / 0,25. Os padroes da Task 4 (`goldFightExponent` 1.5, `fightNoiseBase` 0.16,
`objectiveBountyFraction` 0.05, `objectiveBountyCap` 2500) ficaram como estao.

Comando (cenario `app`, 600 partidas por ponto, mesmas seeds em todos os pontos), grade do plano:

```
npx tsx scripts/sweep-realism.ts '[{"conversionSiegeBase":20},{"conversionSiegeBase":35},{"conversionSiegeBase":50},{"conversionSiegeBase":35,"contestBaseEpic":0.5,"contestBaseDragon":0.3},{"conversionSiegeBase":35,"contestBaseEpic":0.85,"contestBaseDragon":0.6}]' 600
```

Criterio de escolha, nesta ordem (o do plano, com o ruling do controlador para o caso de nenhum
ponto passar):

1. `hardRuleViolations` = 0, `capFraction` <= 0,005 e `durationMeanMin` em [29; 36];
2. `stealFraction` <= 0,03;
3. entre os que passam, o menor valor de
   `|firstBaronWins - 0.854| + |firstTowerWins - 0.682| + |goldLeaderAt20Wins - 0.782|`.

Ruling do controlador: se nenhum ponto passar o item 1 so por causa da duracao e/ou nenhum passar o
item 2, escolher pelo item 3 entre os pontos com `hardRuleViolations` 0 e `capFraction` <= 0,005,
e registrar aqui quais itens ficaram para a Task 8.

Saida inteira da varredura da grade (N=600):

```
N=600 por ponto, cenario app

ponto {"conversionSiegeBase":20}
  durationMeanMin=24.044 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1834 | teamGoldAt10=17862 | teamGoldAt20=35721 | killsPerGame=33.388 | killLeaderAt20Wins=0.862 | goldLeaderAt20Wins=0.885 | goldLeaderAt25Wins=0.755 | killRatioWinnerLoser=2.525 | winnerBehindGoldFrac=0.040 | goldDiffWinnerLoserMean=9363 | gpmRatioWinnerLoser=1.247 | favoriteGap5Wins=0.720 | favoriteGapUnder1Wins=0.497 | firstBaronWins=0.861 | soulWins=0.837 | firstTowerWins=0.800 | firstTowerMedianSec=630 | stealFraction=0.069 | towersPerGame=9.047

ponto {"conversionSiegeBase":35}
  durationMeanMin=23.409 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1839 | teamGoldAt10=17938 | teamGoldAt20=35846 | killsPerGame=32.567 | killLeaderAt20Wins=0.905 | goldLeaderAt20Wins=0.920 | goldLeaderAt25Wins=0.847 | killRatioWinnerLoser=2.677 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=9483 | gpmRatioWinnerLoser=1.256 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.419 | firstBaronWins=0.861 | soulWins=0.893 | firstTowerWins=0.808 | firstTowerMedianSec=585 | stealFraction=0.070 | towersPerGame=9.730

ponto {"conversionSiegeBase":50}
  durationMeanMin=23.335 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1841 | teamGoldAt10=17969 | teamGoldAt20=35824 | killsPerGame=32.335 | killLeaderAt20Wins=0.880 | goldLeaderAt20Wins=0.877 | goldLeaderAt25Wins=0.777 | killRatioWinnerLoser=2.585 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=8955 | gpmRatioWinnerLoser=1.242 | favoriteGap5Wins=0.627 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.859 | soulWins=0.844 | firstTowerWins=0.757 | firstTowerMedianSec=555 | stealFraction=0.070 | towersPerGame=10.377

ponto {"conversionSiegeBase":35,"contestBaseEpic":0.5,"contestBaseDragon":0.3}
  durationMeanMin=23.484 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1836 | teamGoldAt10=17929 | teamGoldAt20=35768 | killsPerGame=32.240 | killLeaderAt20Wins=0.898 | goldLeaderAt20Wins=0.913 | goldLeaderAt25Wins=0.850 | killRatioWinnerLoser=2.635 | winnerBehindGoldFrac=0.023 | goldDiffWinnerLoserMean=9303 | gpmRatioWinnerLoser=1.250 | favoriteGap5Wins=0.653 | favoriteGapUnder1Wins=0.413 | firstBaronWins=0.853 | soulWins=0.882 | firstTowerWins=0.798 | firstTowerMedianSec=585 | stealFraction=0.070 | towersPerGame=9.737

ponto {"conversionSiegeBase":35,"contestBaseEpic":0.85,"contestBaseDragon":0.6}
  durationMeanMin=23.412 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1841 | teamGoldAt10=17957 | teamGoldAt20=35891 | killsPerGame=33.048 | killLeaderAt20Wins=0.900 | goldLeaderAt20Wins=0.913 | goldLeaderAt25Wins=0.858 | killRatioWinnerLoser=2.704 | winnerBehindGoldFrac=0.018 | goldDiffWinnerLoserMean=9613 | gpmRatioWinnerLoser=1.260 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.425 | firstBaronWins=0.871 | soulWins=0.883 | firstTowerWins=0.803 | firstTowerMedianSec=585 | stealFraction=0.070 | towersPerGame=9.783
```

Aplicacao do criterio no N=600 (valores copiados da saida acima; a soma do item 3 vem dos tres
campos `firstBaronWins`, `firstTowerWins`, `goldLeaderAt20Wins`):

| siege | epic | dragon | duracao (min) | steal | item 1 (duracao) | item 2 (steal) | baron | torre | ouro@20 | soma item 3 |
|---|---|---|---|---|---|---|---|---|---|---|
| 20 | 0.7 | 0.45 | 24.044 | 0.069 | nao | nao | 0.861 | 0.800 | 0.885 | 0.2280 |
| 35 | 0.7 | 0.45 | 23.409 | 0.070 | nao | nao | 0.861 | 0.808 | 0.920 | 0.2710 |
| 50 | 0.7 | 0.45 | 23.335 | 0.070 | nao | nao | 0.859 | 0.757 | 0.877 | 0.1750 |
| 35 | 0.5 | 0.3 | 23.484 | 0.070 | nao | nao | 0.853 | 0.798 | 0.913 | 0.2480 |
| 35 | 0.85 | 0.6 | 23.412 | 0.070 | nao | nao | 0.871 | 0.803 | 0.913 | 0.2690 |

Nenhum dos cinco pontos passa o item 1 (a duracao media fica entre 23,3 e 24,0 min, abaixo da
trava de 29) nem o item 2 (roubos entre 0,069 e 0,070, contra o teto de 0,03). Vale o ruling:
escolha pelo item 3 entre os pontos com `hardRuleViolations` 0 e `capFraction` <= 0,005.

### Achado: a regra dura de 7:00 so fica limpa em N grande

No N=600 os cinco pontos da grade tem `hardRuleViolations` 0, e o de menor soma do item 3 seria
`conversionSiegeBase = 50` (0,1750). Mas 600 partidas nao enxergam a regra dura, que e "zero,
sempre". A mesma grade com N=6000 (comando igual, ultimo argumento 6000):

```
N=6000 por ponto, cenario app

ponto {"conversionSiegeBase":20}
  durationMeanMin=24.173 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1837 | teamGoldAt10=17912 | teamGoldAt20=35722 | killsPerGame=34.110 | killLeaderAt20Wins=0.864 | goldLeaderAt20Wins=0.888 | goldLeaderAt25Wins=0.788 | killRatioWinnerLoser=2.491 | winnerBehindGoldFrac=0.040 | goldDiffWinnerLoserMean=9397 | gpmRatioWinnerLoser=1.246 | favoriteGap5Wins=0.719 | favoriteGapUnder1Wins=0.501 | firstBaronWins=0.850 | soulWins=0.831 | firstTowerWins=0.789 | firstTowerMedianSec=615 | stealFraction=0.071 | towersPerGame=9.108

ponto {"conversionSiegeBase":35}
  durationMeanMin=23.576 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1841 | teamGoldAt10=17956 | teamGoldAt20=35832 | killsPerGame=32.974 | killLeaderAt20Wins=0.879 | goldLeaderAt20Wins=0.894 | goldLeaderAt25Wins=0.797 | killRatioWinnerLoser=2.555 | winnerBehindGoldFrac=0.028 | goldDiffWinnerLoserMean=9232 | gpmRatioWinnerLoser=1.247 | favoriteGap5Wins=0.686 | favoriteGapUnder1Wins=0.497 | firstBaronWins=0.858 | soulWins=0.841 | firstTowerWins=0.785 | firstTowerMedianSec=585 | stealFraction=0.071 | towersPerGame=9.802

ponto {"conversionSiegeBase":50}
  durationMeanMin=23.230 | capFraction=0.000 | hardRuleViolations=5.000 | gpmTeamMean=1844 | teamGoldAt10=17976 | teamGoldAt20=35936 | killsPerGame=32.412 | killLeaderAt20Wins=0.875 | goldLeaderAt20Wins=0.888 | goldLeaderAt25Wins=0.763 | killRatioWinnerLoser=2.542 | winnerBehindGoldFrac=0.029 | goldDiffWinnerLoserMean=8943 | gpmRatioWinnerLoser=1.242 | favoriteGap5Wins=0.626 | favoriteGapUnder1Wins=0.506 | firstBaronWins=0.859 | soulWins=0.850 | firstTowerWins=0.772 | firstTowerMedianSec=555 | stealFraction=0.073 | towersPerGame=10.346

ponto {"conversionSiegeBase":35,"contestBaseEpic":0.5,"contestBaseDragon":0.3}
  durationMeanMin=23.622 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1839 | teamGoldAt10=17944 | teamGoldAt20=35788 | killsPerGame=32.621 | killLeaderAt20Wins=0.879 | goldLeaderAt20Wins=0.892 | goldLeaderAt25Wins=0.795 | killRatioWinnerLoser=2.528 | winnerBehindGoldFrac=0.030 | goldDiffWinnerLoserMean=9107 | gpmRatioWinnerLoser=1.243 | favoriteGap5Wins=0.689 | favoriteGapUnder1Wins=0.495 | firstBaronWins=0.857 | soulWins=0.843 | firstTowerWins=0.781 | firstTowerMedianSec=585 | stealFraction=0.071 | towersPerGame=9.818

ponto {"conversionSiegeBase":35,"contestBaseEpic":0.85,"contestBaseDragon":0.6}
  durationMeanMin=23.541 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1842 | teamGoldAt10=17969 | teamGoldAt20=35878 | killsPerGame=33.327 | killLeaderAt20Wins=0.879 | goldLeaderAt20Wins=0.894 | goldLeaderAt25Wins=0.799 | killRatioWinnerLoser=2.590 | winnerBehindGoldFrac=0.026 | goldDiffWinnerLoserMean=9367 | gpmRatioWinnerLoser=1.251 | favoriteGap5Wins=0.685 | favoriteGapUnder1Wins=0.504 | firstBaronWins=0.861 | soulWins=0.845 | firstTowerWins=0.784 | firstTowerMedianSec=585 | stealFraction=0.072 | towersPerGame=9.814
```

| siege | epic | dragon | hardRuleViolations (N=6000) | soma item 3 (N=6000) |
|---|---|---|---|---|
| 20 | 0.7 | 0.45 | 0 | 0.2170 |
| 35 | 0.7 | 0.45 | 0 | 0.2190 |
| 50 | 0.7 | 0.45 | 5 | 0.2010 |
| 35 | 0.5 | 0.3 | 0 | 0.2120 |
| 35 | 0.85 | 0.6 | 0 | 0.2210 |

O ponto 50 tem 5 violacoes em 6000 partidas (3 em 3000). Informativo, fora da grade e sem uso na
escolha (N=600): `conversionSiegeBase` 5, 10, 65 e 80 deram 0, 0, 2 e 10 violacoes, e a duracao
media 25,411, 24,895, 22,815 e 22,760 min:

```
N=600 por ponto, cenario app

ponto {"conversionSiegeBase":5}
  durationMeanMin=25.411 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1820 | teamGoldAt10=17778 | teamGoldAt20=35376 | killsPerGame=36.428 | killLeaderAt20Wins=0.846 | goldLeaderAt20Wins=0.887 | goldLeaderAt25Wins=0.807 | killRatioWinnerLoser=2.402 | winnerBehindGoldFrac=0.083 | goldDiffWinnerLoserMean=9478 | gpmRatioWinnerLoser=1.233 | favoriteGap5Wins=0.773 | favoriteGapUnder1Wins=0.503 | firstBaronWins=0.829 | soulWins=0.814 | firstTowerWins=0.790 | firstTowerMedianSec=660 | stealFraction=0.064 | towersPerGame=7.950

ponto {"conversionSiegeBase":10}
  durationMeanMin=24.895 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1828 | teamGoldAt10=17814 | teamGoldAt20=35497 | killsPerGame=35.400 | killLeaderAt20Wins=0.847 | goldLeaderAt20Wins=0.893 | goldLeaderAt25Wins=0.779 | killRatioWinnerLoser=2.411 | winnerBehindGoldFrac=0.068 | goldDiffWinnerLoserMean=9359 | gpmRatioWinnerLoser=1.237 | favoriteGap5Wins=0.720 | favoriteGapUnder1Wins=0.509 | firstBaronWins=0.831 | soulWins=0.787 | firstTowerWins=0.795 | firstTowerMedianSec=645 | stealFraction=0.065 | towersPerGame=8.452

ponto {"conversionSiegeBase":65}
  durationMeanMin=22.815 | capFraction=0.000 | hardRuleViolations=2.000 | gpmTeamMean=1843 | teamGoldAt10=17993 | teamGoldAt20=36050 | killsPerGame=31.603 | killLeaderAt20Wins=0.869 | goldLeaderAt20Wins=0.895 | goldLeaderAt25Wins=0.806 | killRatioWinnerLoser=2.602 | winnerBehindGoldFrac=0.020 | goldDiffWinnerLoserMean=8856 | gpmRatioWinnerLoser=1.243 | favoriteGap5Wins=0.707 | favoriteGapUnder1Wins=0.431 | firstBaronWins=0.872 | soulWins=0.912 | firstTowerWins=0.783 | firstTowerMedianSec=525 | stealFraction=0.069 | towersPerGame=10.413

ponto {"conversionSiegeBase":80}
  durationMeanMin=22.760 | capFraction=0.000 | hardRuleViolations=10.000 | gpmTeamMean=1842 | teamGoldAt10=17996 | teamGoldAt20=36026 | killsPerGame=31.353 | killLeaderAt20Wins=0.872 | goldLeaderAt20Wins=0.896 | goldLeaderAt25Wins=0.743 | killRatioWinnerLoser=2.581 | winnerBehindGoldFrac=0.028 | goldDiffWinnerLoserMean=8760 | gpmRatioWinnerLoser=1.241 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.395 | firstBaronWins=0.875 | soulWins=0.898 | firstTowerWins=0.782 | firstTowerMedianSec=510 | stealFraction=0.070 | towersPerGame=10.792
```

Causa lida nos eventos das partidas violadoras (siege 80): o primeiro `first_tower` cai aos 405 s
(6:45) SEM a abertura de conversao no texto, ou seja, pelo canal de cerco ou de pressao
(`accrueSiegePressure`, `resolveStructurePressure`), logo depois de `plate_taken` da conversao
nos ticks anteriores. A trava do plano em `resolveConversionPush` (`after = min(after, 99)` antes de
7:00) impede que a CONVERSAO derrube a torre, mas deixa o pool em 99, e qualquer soma minima do
outro canal no tick seguinte cruza 100 antes de 420 s. Esses canais foram calibrados (Fase 25,
`base: 27`) para NUNCA chegar a 100 antes de 7:00 com o pool partindo de perto de zero; a
conversao quebra essa premissa quando o dano por tick e alto. Corrigido na rodada de correcao
da Task 5 (subsecao "Correcao: garantia da regra dura de 7:00", no fim desta secao).

### Escolha

Excluido o ponto 50 (hardRuleViolations > 0 em N grande), restam os quatro com 0 violacoes em
N=6000. Pelo item 3 no N=600 (o criterio do plano) o menor e **`conversionSiegeBase = 20`** com
`contestBaseEpic = 0.7`, `contestBaseDragon = 0.45`, `contestBaseMinor = 0.25` (0,2280, contra 0,2480
do ponto 35 / 0.5 / 0.3, 0,2690 e 0,2710). No N=6000 a ordem entre esses quatro muda por menos de
0,01 (0,2120 a 0,2210), dentro do ruido; ficou o ponto escolhido no N=600. Gravado em
`DEFAULT_REALISM_TUNING` (`conversionSiegeBase: 20`; as tres chances de contestar ficaram nos
valores de partida, porque nenhum dos dois pontos da grade com outras chances venceu).

Itens que ficaram para a Task 8:

- item 1, duracao media: 24,044 min contra a banda [29; 36] (era 25,853 no fim da Task 4). A
  janela encurta a partida porque cada abate com 3 ou mais vivos vira objetivo ou torre. O dano de
  cerco quase nao mexe nisso (de 5 a 80 a duracao vai de 25,4 a 22,8 min); quem encurta e a propria
  janela. Alvo de ajuste da Task 8: a regra de abertura e/ou o dano de torre da janela;
- item 2, roubos: 0,069 contra o teto de 0,03 (era 0,090). Vem do caminho disputado antigo
  (`resolveContestedObjective`), que a Task 7 reescreve, e da propria contestacao da janela;
- teto pre 7:00 da conversao (achado acima): resolvido na rodada de correcao (garantia em todo
  ponto de queda por pool); a escolha de `conversionSiegeBase` volta para a Task 8 (ver a
  subsecao de correcao).

### Relatorio de realismo com os padroes desta secao (cenario `app`, REALISM_N=600)

```
=== cenario app (N=600) ===
violacoes de regra dura: 0
FORA [trava] duracao media (min): 24.044  banda [29.000; 36.000] alvo 32.300
OK   [trava] fracao no teto de 60 min: 0.000  banda [0.000; 0.005] alvo 0.000
OK   [trava] mediana da 1a torre (s): 630  banda [480; 1200] alvo 975
FORA [aceite] lider de abates aos 20 vence: 0.862  banda [0.700; 0.820] alvo 0.764
FORA [aceite] lider de ouro aos 15 vence: 0.852  banda [0.660; 0.780] alvo 0.716
FORA [aceite] lider de ouro aos 20 vence: 0.885  banda [0.720; 0.840] alvo 0.782
FORA [aceite] lider de ouro aos 25 vence: 0.755  banda [0.770; 0.890] alvo 0.830
OK   [aceite] abates vencedor / perdedor: 2.525  banda [1.800; 2.600] alvo 2.150
OK   [aceite] vencedor com mais abates: 0.902  banda [0.850; 1.000] alvo 0.900
OK   [aceite] vencedor atras no ouro: 0.040  banda [0.000; 0.050] alvo 0.020
OK   [aceite] ouro vencedor menos perdedor: 9363  banda [7000; 13000] alvo 10000
OK   [aceite] GPM por time: 1834  banda [1650; 2050] alvo 1833
OK   [aceite] GPM vencedor / perdedor: 1.247  banda [1.120; 1.260] alvo 1.190
OK   [aceite] time do 1o Barao vence: 0.861  banda [0.780; 0.900] alvo 0.854
FORA [aceite] time da Alma vence: 0.837  banda [0.840; 0.950] alvo 0.908
FORA [aceite] time da 1a torre vence: 0.800  banda [0.620; 0.750] alvo 0.682
FORA [aceite] roubos / objetivos tomados: 0.069  banda [0.000; 0.030] alvo 0.020
FORA [aceite] favorito com gap >= 5 vence: 0.720  banda [0.750; 0.850] alvo 0.800
OK   [aceite] favorito com gap < 1 vence: 0.497  banda [0.450; 0.550] alvo 0.500
--- acompanhadas sem gate ---
     abates por partida: 33.388  (real 27)
     abates por minuto: 1.389  (real 0,84)
     mediana do first blood (s): 60.000  (real 300)
     mediana do 1o dragao (s): 315  (real 550)
     1o Barao no 1o minuto de spawn: 0.822  (real raro)
     partidas com Elder: 0.022  (real 0,08)
     torres por partida: 9.047  (real 11,9)
     lider de torres aos 20 vence: 0.890  (real sem fonte)
     ouro por time aos 10: 17862  (real 15900)
     ouro por time aos 15: 26663  (real 24700)
     ouro por time aos 20: 35721  (real 34200)
     abates aos 10: 10.090  (real 3,2)
     abates aos 20: 24.382  (real 10,7)
```

Leitura: dentro de banda, alem das travas de teto e 1a torre: vencedor com mais abates (0,902),
vencedor atras no ouro (0,040, passou de 0,093 para dentro da banda), delta de ouro, GPM do
time, GPM venc/perd, abates venc/perd, 1o Barao e favorito gap < 1. Ainda fora: duracao 24,044
(trava), lider de abates aos 20 (0,862), lider de ouro aos 15, 20 e 25 (0,852, 0,885, 0,755; o de 25
saiu da banda porque a partida acaba mais cedo), Alma (0,837), 1a torre (0,800), roubos (0,069) e
favorito gap >= 5 (0,720). Acompanhada sem gate: o 1o Barao no 1o minuto de spawn subiu de 0,520
para 0,822, ou seja, com o Barao vivo qualquer vantagem numerica vira Barao na hora. Fica para a
Task 8 junto com o resto.

### Correcao: garantia da regra dura de 7:00 (Task 5, fix 1)

A trava do plano (`min(after, 99)` so na conversao) deixava o pool em 99 e os outros dois canais
de queda por pool (`accrueSiegePressure` e o caminho do gate de `resolveStructurePressure`) nao
tinham guarda de tempo. Agora a regra "nenhuma torre cai antes de 420 s" e uma GARANTIA nos tres
pontos, nao uma margem de calibracao: `NO_TOWER_BEFORE_SEC` e `holdPoolBeforeTowerWindow` moram em
`src/sim/structures.ts`, e os tres pontos (canal absoluto, caminho do gate, conversao) gravam
`holdPoolBeforeTowerWindow(poolBefore, poolAfter, gameTimeSec)` em vez de `poolAfter`. Antes de
420 s um pool que chegaria a 100 fica em 99,9 (nunca baixa um pool que ja estava mais alto), o ramo
de queda nao e tomado e o fluxo segue como num tick sem queda (classificacao de placa e tower_low).
Depois de 420 s a funcao e identidade. O sorteio nao muda (o ator e sorteado antes do ramo de
queda, como sempre). O `min(after, 99)` antigo da conversao tambem podia BAIXAR um pool entre 99
e 100; o auxiliar nao baixa.

Evidencia (cenario `app`, mesmas seeds):

- teste de regressao em `src/sim/hardRules.test.ts` (600 partidas com `conversionSiegeBase: 80`,
  nenhuma 1a torre antes de 420 s): vermelho no comportamento antigo (`expected 10 to be +0`, as 10
  violacoes medidas) e verde com a garantia;
- `npx tsx scripts/sweep-realism.ts [{conversionSiegeBase:50},{conversionSiegeBase:80}] 6000`
  com a garantia: `hardRuleViolations` 0 e 0 (antes: 5 em 6000 no 50; 10 em 600 no 80);
  duracao 23,230 e 22,697 min; no 50, steal 0,073, baron 0,859, torre 0,772, ouro@20 0,888
  (soma do item 3 no N=6000: 0,2010; no 80: 0,2080).

Efeito na calibracao: nenhum no padrao. O relatorio de realismo do padrao (`conversionSiegeBase`
20, N=600) e identico ao da secao anterior (duracao 24,044, 1a torre 0,800, roubos 0,069, e assim
por diante), porque a garantia so age antes de 7:00 e so quando o pool cruzaria 100 ali, o que no
padrao nao acontecia. A varredura nao foi refeita (ruling). Ressalva para a Task 8: o motivo de
excluir o ponto 50 era a violacao da regra dura, e ele deixou de existir; pelo criterio do plano
(item 3 no N=600) o ponto de menor soma da grade seria o 50 (0,1750, contra 0,2280 do 20). O
padrao ficou em 20; a decisao de trocar fica com a Task 8, que refaz o ajuste fino contra as
bandas completas.

## 5. Estruturas (Task 6)

Contexto: a spec secao 5 tira a bola de neve estrutural propria do motor. Antes, o canal absoluto
de cerco (`accrueSiegePressure`) empurrava as tres rotas dos dois lados o jogo inteiro e ainda
multiplicava o dano por `siegeAdvantage` (participacao nas torres derrubadas, 0,25 a 4,0) e por
`goldStructuralFactor` (participacao no ouro, 0,97 a 1,03, via `goldPressureFactor`). Agora:

- o canal existe so ate 14:00 (`TIMERS.MID_PHASE_AT`) e so na torre externa (placas e a externa); a
  partir dai a torre cai por janela de conversao (Task 5), Barao/Anciao ou o gate de pressao;
- `siegeAdvantage`, `SIEGE_ADV_*`, `goldStructuralFactor`, `GOLD_STRUCTURAL_*`,
  `StructureDamageFactors.goldPressureFactor` e `SIEGE_ACCRUAL_BASE` saem de `structures.ts`; a
  taxa do canal vira `RealismTuning.siegeAccrualBase` (valor de partida 2,2, o mesmo da constante);
- a garantia de 7:00 (`holdPoolBeforeTowerWindow`) continua na mesma linha do canal.

Comando (cenario `app`, 600 partidas por ponto, mesmas seeds em todos os pontos), grade do plano:

```
npx tsx scripts/sweep-realism.ts '[{"siegeAccrualBase":1.4},{"siegeAccrualBase":2.2},{"siegeAccrualBase":3.0},{"siegeAccrualBase":2.2,"conversionSiegeBase":25},{"siegeAccrualBase":2.2,"conversionSiegeBase":50}]' 600
```

Criterio de escolha, nesta ordem:

1. `hardRuleViolations` = 0, `capFraction` <= 0,005, `durationMeanMin` em [29; 36] e
   `firstTowerMedianSec` em [480; 1200];
2. entre os que passam, o menor valor de
   `|firstTowerWins - 0.682| + |goldLeaderAt20Wins - 0.782| + |towersPerGame - 11.9| / 11.9`.

Ruling do controlador (nao foi preciso aplicar): se nenhum ponto passasse o item 1 so por causa da
duracao, escolher pelo item 2 entre os pontos com `hardRuleViolations` 0, `capFraction` <= 0,005 e
`firstTowerMedianSec` em [480; 1200], e registrar que a duracao fica para a Task 8. As grades extras
do plano (`conversionSiegeBase` em {15; 20} por duracao curta, {60; 75} por longa) so valem quando
nenhum ponto passa o item 1; quatro dos cinco passaram, entao nao foram rodadas.

Saida inteira da varredura da grade (N=600):

```
N=600 por ponto, cenario app

ponto {"siegeAccrualBase":1.4}
  durationMeanMin=35.043 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1824 | teamGoldAt10=17610 | teamGoldAt20=33902 | killsPerGame=57.970 | killLeaderAt20Wins=0.811 | goldLeaderAt20Wins=0.820 | goldLeaderAt25Wins=0.876 | killRatioWinnerLoser=2.902 | winnerBehindGoldFrac=0.010 | goldDiffWinnerLoserMean=17346 | gpmRatioWinnerLoser=1.336 | favoriteGap5Wins=0.733 | favoriteGapUnder1Wins=0.419 | firstBaronWins=0.837 | soulWins=0.828 | firstTowerWins=0.728 | firstTowerMedianSec=720 | stealFraction=0.067 | towersPerGame=9.533

ponto {"siegeAccrualBase":2.2}
  durationMeanMin=35.131 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1833 | teamGoldAt10=17882 | teamGoldAt20=34039 | killsPerGame=57.272 | killLeaderAt20Wins=0.802 | goldLeaderAt20Wins=0.797 | goldLeaderAt25Wins=0.846 | killRatioWinnerLoser=2.723 | winnerBehindGoldFrac=0.020 | goldDiffWinnerLoserMean=16263 | gpmRatioWinnerLoser=1.310 | favoriteGap5Wins=0.627 | favoriteGapUnder1Wins=0.461 | firstBaronWins=0.788 | soulWins=0.849 | firstTowerWins=0.673 | firstTowerMedianSec=630 | stealFraction=0.068 | towersPerGame=10.077

ponto {"siegeAccrualBase":3}
  durationMeanMin=34.740 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1836 | teamGoldAt10=18174 | teamGoldAt20=34289 | killsPerGame=56.538 | killLeaderAt20Wins=0.823 | goldLeaderAt20Wins=0.815 | goldLeaderAt25Wins=0.867 | killRatioWinnerLoser=2.819 | winnerBehindGoldFrac=0.013 | goldDiffWinnerLoserMean=16287 | gpmRatioWinnerLoser=1.314 | favoriteGap5Wins=0.613 | favoriteGapUnder1Wins=0.491 | firstBaronWins=0.788 | soulWins=0.841 | firstTowerWins=0.670 | firstTowerMedianSec=570 | stealFraction=0.070 | towersPerGame=10.172

ponto {"siegeAccrualBase":2.2,"conversionSiegeBase":25}
  durationMeanMin=33.007 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1831 | teamGoldAt10=17925 | teamGoldAt20=34209 | killsPerGame=52.550 | killLeaderAt20Wins=0.804 | goldLeaderAt20Wins=0.812 | goldLeaderAt25Wins=0.870 | killRatioWinnerLoser=2.828 | winnerBehindGoldFrac=0.010 | goldDiffWinnerLoserMean=15435 | gpmRatioWinnerLoser=1.309 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.473 | firstBaronWins=0.803 | soulWins=0.846 | firstTowerWins=0.683 | firstTowerMedianSec=615 | stealFraction=0.064 | towersPerGame=10.032

ponto {"siegeAccrualBase":2.2,"conversionSiegeBase":50}
  durationMeanMin=28.330 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1836 | teamGoldAt10=17977 | teamGoldAt20=34595 | killsPerGame=41.360 | killLeaderAt20Wins=0.812 | goldLeaderAt20Wins=0.813 | goldLeaderAt25Wins=0.852 | killRatioWinnerLoser=2.467 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=10727 | gpmRatioWinnerLoser=1.241 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.491 | firstBaronWins=0.820 | soulWins=0.812 | firstTowerWins=0.700 | firstTowerMedianSec=555 | stealFraction=0.067 | towersPerGame=10.473
```

Aplicacao do criterio no N=600 (valores copiados da saida acima):

| siege | conversao | duracao (min) | 1a torre mediana (s) | item 1 | torre | ouro@20 | torres/jogo | soma item 2 |
|---|---|---|---|---|---|---|---|---|
| 1,4 | 20 | 35,043 | 720 | sim | 0,728 | 0,820 | 9,533 | 0,2829 |
| 2,2 | 20 | 35,131 | 630 | sim | 0,673 | 0,797 | 10,077 | 0,1772 |
| 3,0 | 20 | 34,740 | 570 | sim | 0,670 | 0,815 | 10,172 | 0,1902 |
| 2,2 | 25 | 33,007 | 615 | sim | 0,683 | 0,812 | 10,032 | 0,1880 |
| 2,2 | 50 | 28,330 | 555 | nao (duracao abaixo de 29) | 0,700 | 0,813 | 10,473 | 0,1689 (excluido) |

Os cinco pontos tem `hardRuleViolations` 0 e `capFraction` 0,000. O ponto 2,2 / 50 teria a menor
soma, mas sai no item 1 (duracao 28,330 min).

### Escolha

**`siegeAccrualBase = 2,2` e `conversionSiegeBase = 20`** (soma 0,1772, a menor entre os quatro que
passam o item 1). Sao exatamente os padroes que ja estavam: `DEFAULT_REALISM_TUNING` nao muda de
valor, so ganha o campo `siegeAccrualBase: 2.2`.

Verificacao em N grande (a regra dura de 7:00 so aparece em N grande, achado da Task 5). Mesmos
comandos com N=6000, nos tres pontos de menor soma:

```
N=6000 por ponto, cenario app

ponto {"siegeAccrualBase":2.2}
  durationMeanMin=35.056 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1833 | teamGoldAt10=17942 | teamGoldAt20=34182 | killsPerGame=57.563 | killLeaderAt20Wins=0.798 | goldLeaderAt20Wins=0.803 | goldLeaderAt25Wins=0.855 | killRatioWinnerLoser=2.793 | winnerBehindGoldFrac=0.016 | goldDiffWinnerLoserMean=16703 | gpmRatioWinnerLoser=1.318 | favoriteGap5Wins=0.663 | favoriteGapUnder1Wins=0.514 | firstBaronWins=0.790 | soulWins=0.848 | firstTowerWins=0.687 | firstTowerMedianSec=615 | stealFraction=0.068 | towersPerGame=10.075

ponto {"siegeAccrualBase":3}
  durationMeanMin=34.943 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1837 | teamGoldAt10=18187 | teamGoldAt20=34290 | killsPerGame=57.098 | killLeaderAt20Wins=0.794 | goldLeaderAt20Wins=0.797 | goldLeaderAt25Wins=0.855 | killRatioWinnerLoser=2.759 | winnerBehindGoldFrac=0.017 | goldDiffWinnerLoserMean=16395 | gpmRatioWinnerLoser=1.312 | favoriteGap5Wins=0.665 | favoriteGapUnder1Wins=0.529 | firstBaronWins=0.787 | soulWins=0.850 | firstTowerWins=0.667 | firstTowerMedianSec=570 | stealFraction=0.067 | towersPerGame=10.279

ponto {"siegeAccrualBase":2.2,"conversionSiegeBase":25}
  durationMeanMin=33.039 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1833 | teamGoldAt10=17966 | teamGoldAt20=34302 | killsPerGame=52.699 | killLeaderAt20Wins=0.802 | goldLeaderAt20Wins=0.811 | goldLeaderAt25Wins=0.867 | killRatioWinnerLoser=2.738 | winnerBehindGoldFrac=0.017 | goldDiffWinnerLoserMean=15077 | gpmRatioWinnerLoser=1.300 | favoriteGap5Wins=0.665 | favoriteGapUnder1Wins=0.509 | firstBaronWins=0.801 | soulWins=0.849 | firstTowerWins=0.690 | firstTowerMedianSec=615 | stealFraction=0.068 | towersPerGame=10.078
```

`hardRuleViolations` 0 nos tres. Pela soma do item 2 no N=6000 a ordem muda (2,2 / 20: 0,1794;
3,0 / 20: 0,1662; 2,2 / 25: 0,1901), por menos de 0,03 e dominada pelo termo de torres por jogo
(10,08 a 10,28 contra 11,9), dentro do ruido; o criterio do plano e no N=600 e ficou o ponto
escolhido nele.

### Achado: a duracao subiu de 24,0 para 35,1 min

Sem o canal depois de 14:00, a partida deixa de acabar por cerco automatico e passa a depender da
janela de conversao, do Barao e do gate de pressao. A duracao media foi de 24,044 min (fim da Task 5)
para 35,131 (N=600; 35,056 no N=6000), dentro da banda [29; 36] mas com 0,87 min de folga no teto.
Junto vieram: abates por partida 33,4 para 57,3 (real 27), partidas com Elder 0,022 para 0,450 (real
0,08), delta de ouro vencedor menos perdedor 9363 para 16263 e GPM venc/perd 1,247 para 1,310 (os
dois fora de banda, junto com abates venc/perd 2,525 para 2,723), favorito com gap >= 5 de 0,720
para 0,627. Por outro lado entraram em banda lider de abates aos 20, lider de ouro aos 15, 20 e 25,
Alma e 1a torre. Esses efeitos (partida longa demais, mortes demais, ouro acumulando no vencedor)
ficam para a Task 8, que refaz o ajuste fino contra as bandas completas; esta task nao mexeu em
nenhum outro parametro.

### Relatorio de realismo com os padroes desta secao (cenario `app`, REALISM_N=600)

```
=== cenario app (N=600) ===
violacoes de regra dura: 0
OK   [trava] duracao media (min): 35.131  banda [29.000; 36.000] alvo 32.300
OK   [trava] fracao no teto de 60 min: 0.000  banda [0.000; 0.005] alvo 0.000
OK   [trava] mediana da 1a torre (s): 630  banda [480; 1200] alvo 975
OK   [aceite] lider de abates aos 20 vence: 0.802  banda [0.700; 0.820] alvo 0.764
OK   [aceite] lider de ouro aos 15 vence: 0.770  banda [0.660; 0.780] alvo 0.716
OK   [aceite] lider de ouro aos 20 vence: 0.797  banda [0.720; 0.840] alvo 0.782
OK   [aceite] lider de ouro aos 25 vence: 0.846  banda [0.770; 0.890] alvo 0.830
FORA [aceite] abates vencedor / perdedor: 2.723  banda [1.800; 2.600] alvo 2.150
OK   [aceite] vencedor com mais abates: 0.937  banda [0.850; 1.000] alvo 0.900
OK   [aceite] vencedor atras no ouro: 0.020  banda [0.000; 0.050] alvo 0.020
FORA [aceite] ouro vencedor menos perdedor: 16263  banda [7000; 13000] alvo 10000
OK   [aceite] GPM por time: 1833  banda [1650; 2050] alvo 1833
FORA [aceite] GPM vencedor / perdedor: 1.310  banda [1.120; 1.260] alvo 1.190
OK   [aceite] time do 1o Barao vence: 0.788  banda [0.780; 0.900] alvo 0.854
OK   [aceite] time da Alma vence: 0.849  banda [0.840; 0.950] alvo 0.908
OK   [aceite] time da 1a torre vence: 0.673  banda [0.620; 0.750] alvo 0.682
FORA [aceite] roubos / objetivos tomados: 0.068  banda [0.000; 0.030] alvo 0.020
FORA [aceite] favorito com gap >= 5 vence: 0.627  banda [0.750; 0.850] alvo 0.800
OK   [aceite] favorito com gap < 1 vence: 0.461  banda [0.450; 0.550] alvo 0.500
--- acompanhadas sem gate ---
     abates por partida: 57.272  (real 27)
     abates por minuto: 1.630  (real 0,84)
     mediana do first blood (s): 60.000  (real 300)
     mediana do 1o dragao (s): 315  (real 550)
     1o Barao no 1o minuto de spawn: 0.638  (real raro)
     partidas com Elder: 0.450  (real 0,08)
     torres por partida: 10.077  (real 11,9)
     lider de torres aos 20 vence: 0.755  (real sem fonte)
     ouro por time aos 10: 17882  (real 15900)
     ouro por time aos 15: 26341  (real 24700)
     ouro por time aos 20: 34039  (real 34200)
     abates aos 10: 10.105  (real 3,2)
     abates aos 20: 21.697  (real 10,7)
```

Leitura: dentro de banda as tres travas (duracao 35,131, teto 0,000, 1a torre 630 s) e, no aceite,
lider de abates aos 20 (0,802), lider de ouro aos 15, 20 e 25 (0,770, 0,797, 0,846), vencedor com
mais abates (0,937), vencedor atras no ouro (0,020), GPM do time, 1o Barao (0,788), Alma (0,849),
1a torre (0,673) e favorito gap < 1 (0,461). Ainda fora: abates venc/perd (2,723), delta de ouro
(16263), GPM venc/perd (1,310), roubos (0,068, Task 7) e favorito gap >= 5 (0,627). Fica para a
Task 8.

## 6. Objetivo disputado (Task 7)

Contexto: quando os dois times escolhem o mesmo objetivo disponivel, `resolveContestedObjective`
sorteava o dono por `securePower` ANTES da luta no poco e depois deixava o outro lado roubar por
`stealChanceFor`. A luta so decidia as mortes, nao o dono. Agora (spec secao 6):

1. quem inicia a luta no poco sai do sorteio leve de `securePower` (como antes, so decide o
   `initiator` de `resolveTeamfight`, nao o dono);
2. a luta no poco roda primeiro (`silentIfNoKills`);
3. o dono sai de `decidePitOwner`: mais gente viva leva, sem sorteio; empate numerico vira duelo de
   Smite (`securePower` com sorteio, como antes);
4. o jungler do outro lado, se ele ainda tem alguem vivo e `canStealObjective` deixa, rouba com
   `stealChanceFor * conversionStealFactor(gap)`, onde `gap` e a diferenca numerica do dono.

`resolveContestedObjective` passou a ser exportada (para teste). Nenhum parametro de tuning novo e
nenhum outro valor foi mexido. O ramo `contested` de `resolveConversionObjective` (janela da Task 5)
tinha a mesma sequencia luta, `decidePitOwner`, roubo atenuado, mas SEM a guarda de vivos depois da
luta (um time varrido ainda roubava com ~0,4%). A correcao 1 da Task 7 (abaixo) extrai o desfecho
para `settlePitOwner`, usado pelos dois caminhos, e so entao eles concordam de fato.

Teste novo: `src/sim/contested.test.ts` (3 testes: vantagem numerica sem sorteio, dono do dragao
igual a quem tem mais vivos em 400 seeds sem roubo, e nunca roubo sem ninguem vivo do lado que
perde o objetivo). Vermelho antes (`resolveContestedObjective is not a function`), verde depois.

### Medicao (cenario `app`, REALISM_N=600, mesmas seeds antes e depois)

| Metrica | Banda | Antes (fim da Task 6) | Depois (Task 7) |
|---|---|---|---|
| duracao media (min) | [29; 36] | 35,131 | 34,163 |
| fracao no teto de 60 min | [0; 0,005] | 0,000 | 0,000 |
| mediana da 1a torre (s) | [480; 1200] | 630 | 630 |
| lider de abates aos 20 vence | 0,70 a 0,82 | 0,802 | 0,817 |
| lider de ouro aos 15 vence | 0,66 a 0,78 | 0,770 | 0,802 (fora) |
| lider de ouro aos 20 vence | 0,72 a 0,84 | 0,797 | 0,818 |
| lider de ouro aos 25 vence | 0,77 a 0,89 | 0,846 | 0,873 |
| abates venc/perd | 1,8 a 2,6 | 2,723 (fora) | 3,069 (fora) |
| vencedor com mais abates | >= 0,85 | 0,937 | 0,955 |
| vencedor atras no ouro | <= 0,05 | 0,020 | 0,013 |
| delta de ouro venc menos perd | 7000 a 13000 | 16263 (fora) | 17685 (fora) |
| GPM por time | 1650 a 2050 | 1833 | 1820 |
| GPM venc/perd | 1,12 a 1,26 | 1,310 (fora) | 1,351 (fora) |
| 1o Barao vence | 0,78 a 0,90 | 0,788 | 0,853 |
| Alma vence | 0,84 a 0,95 | 0,849 | 0,891 |
| 1a torre vence | 0,62 a 0,75 | 0,673 | 0,685 |
| roubos / objetivos tomados | <= 0,03 | 0,068 (fora) | 0,018 |
| favorito gap >= 5 vence | 0,75 a 0,85 | 0,627 (fora) | 0,733 (fora) |
| favorito gap < 1 vence | 0,45 a 0,55 | 0,461 | 0,485 |

Leitura: `roubos` caiu de 0,068 para 0,018 e entrou na banda (<= 0,03), que era o objetivo da task.
Dono do objetivo passou a seguir a luta: 1o Barao 0,788 para 0,853 (alvo 0,854), Alma 0,849 para
0,891 (alvo 0,908), favorito gap >= 5 de 0,627 para 0,733 (ainda abaixo de 0,75). Efeito colateral
na outra direcao: o ouro e os abates acumulam mais no vencedor (abates venc/perd 2,723 para 3,069,
delta de ouro 16263 para 17685, GPM venc/perd 1,310 para 1,351, lider de ouro aos 15 de 0,770 para
0,802, saindo da banda). A duracao desceu 0,97 min (35,131 para 34,163), mais folga para o teto de
36. Regras duras: 0 violacoes. Esses desvios (ouro e abates concentrados no vencedor, porque agora quem
ganha a luta no poco tambem leva o objetivo) ficam para a Task 8, que refaz o ajuste fino contra
as bandas completas; esta task nao mexeu em nenhum outro parametro.

### Relatorio de realismo com o motor desta secao (cenario `app`, REALISM_N=600)

```
=== cenario app (N=600) ===
violacoes de regra dura: 0
OK   [trava] duracao media (min): 34.163  banda [29.000; 36.000] alvo 32.300
OK   [trava] fracao no teto de 60 min: 0.000  banda [0.000; 0.005] alvo 0.000
OK   [trava] mediana da 1a torre (s): 630  banda [480; 1200] alvo 975
OK   [aceite] lider de abates aos 20 vence: 0.817  banda [0.700; 0.820] alvo 0.764
FORA [aceite] lider de ouro aos 15 vence: 0.802  banda [0.660; 0.780] alvo 0.716
OK   [aceite] lider de ouro aos 20 vence: 0.818  banda [0.720; 0.840] alvo 0.782
OK   [aceite] lider de ouro aos 25 vence: 0.873  banda [0.770; 0.890] alvo 0.830
FORA [aceite] abates vencedor / perdedor: 3.069  banda [1.800; 2.600] alvo 2.150
OK   [aceite] vencedor com mais abates: 0.955  banda [0.850; 1.000] alvo 0.900
OK   [aceite] vencedor atras no ouro: 0.013  banda [0.000; 0.050] alvo 0.020
FORA [aceite] ouro vencedor menos perdedor: 17685  banda [7000; 13000] alvo 10000
OK   [aceite] GPM por time: 1820  banda [1650; 2050] alvo 1833
FORA [aceite] GPM vencedor / perdedor: 1.351  banda [1.120; 1.260] alvo 1.190
OK   [aceite] time do 1o Barao vence: 0.853  banda [0.780; 0.900] alvo 0.854
OK   [aceite] time da Alma vence: 0.891  banda [0.840; 0.950] alvo 0.908
OK   [aceite] time da 1a torre vence: 0.685  banda [0.620; 0.750] alvo 0.682
OK   [aceite] roubos / objetivos tomados: 0.018  banda [0.000; 0.030] alvo 0.020
FORA [aceite] favorito com gap >= 5 vence: 0.733  banda [0.750; 0.850] alvo 0.800
OK   [aceite] favorito com gap < 1 vence: 0.485  banda [0.450; 0.550] alvo 0.500
--- acompanhadas sem gate ---
     abates por partida: 55.855  (real 27)
     abates por minuto: 1.635  (real 0,84)
     mediana do first blood (s): 60.000  (real 300)
     mediana do 1o dragao (s): 315  (real 550)
     1o Barao no 1o minuto de spawn: 0.640  (real raro)
     partidas com Elder: 0.487  (real 0,08)
```

### Correcao (Task 7, fix 1): desfecho do poco compartilhado e teste de roubo que morde

1. O teste 3 do plano afirmava o lado errado: num roubo `obj.side` e o ladrao, entao
   `loser = opponent(obj.side)` e a vitima, que sempre tem gente viva, e o teste ficava verde mesmo
   sem a guarda `aliveCount(other) > 0`. Agora o teste afirma que quem roubou tem alguem vivo, usa um
   rng que devolve 0 assim que algum time esta todo morto (forca o sorteio de roubo a disparar) e
   afirma que nenhum time varrido rouba. Amostra: 400 de 400 lutas de poco (rival com 2 vivos contra
   5, nivel 55 contra 95) varrem um time; na janela de conversao (2 contra 1) 186 de 400 sao
   contestadas e as 186 varrem um time. Vermelho com a guarda removida, verde com ela.
2. `settlePitOwner(state, kind, initiator, rng)`: roda `decidePitOwner` e depois o roubo
   guardado (outro lado vivo, `canStealObjective`, `rng() < stealChanceFor * conversionStealFactor`).
   Os dois caminhos, `resolveContestedObjective` e `resolveConversionObjective`, chamam o mesmo
   helper. A ordem dos sorteios de cada caminho ficou como antes, salvo o curto-circuito da guarda
   (time varrido nao consome o draw de roubo). O ramo da conversao ganhou a guarda que lhe faltava,
   conforme a spec ("inimigo todo morto: nada a disputar").
3. Teste novo do duelo de Smite de `decidePitOwner` (mesmo numero de vivos): com sorteio neutro
   vence quem tem mais `securePower` de qualquer lado que tente, e com os draws [0,999; 0] o lado
   fraco que tenta vence (2 draws consumidos). Comentario do iniciador corrigido
   (`resolveTeamfight` nao da bonus de iniciador, entao o sorteio so desempata poder igual) e o
   `Math.abs` redundante saiu (o dono nunca fica em desvantagem numerica).

Efeito medido (cenario `app`, N=600): roubos continua 0,018, duracao 34,200 min, regras duras 0. As
demais metricas mudaram porque a guarda altera a trajetoria da partida (ordem dos sorteios, INV-1):
lider de abates aos 20 0,817 para 0,827 (passou do teto de 0,82), lider de ouro aos 15 0,802 para
0,813, aos 20 0,818 para 0,828, Alma 0,891 para 0,872, favorito gap >= 5 0,733 para 0,720. Tudo
dentro do ruido de 600 partidas (0,015 em proporcao perto de 0,8) e para a Task 8 ajustar. Os
mesmos 20 vermelhos de partida inteira do commit anterior, nenhum novo.

```
=== cenario app (N=600) ===
violacoes de regra dura: 0
OK   [trava] duracao media (min): 34.200  banda [29.000; 36.000] alvo 32.300
OK   [trava] fracao no teto de 60 min: 0.000  banda [0.000; 0.005] alvo 0.000
OK   [trava] mediana da 1a torre (s): 630  banda [480; 1200] alvo 975
FORA [aceite] lider de abates aos 20 vence: 0.827  banda [0.700; 0.820] alvo 0.764
FORA [aceite] lider de ouro aos 15 vence: 0.813  banda [0.660; 0.780] alvo 0.716
OK   [aceite] lider de ouro aos 20 vence: 0.828  banda [0.720; 0.840] alvo 0.782
OK   [aceite] lider de ouro aos 25 vence: 0.872  banda [0.770; 0.890] alvo 0.830
FORA [aceite] abates vencedor / perdedor: 3.081  banda [1.800; 2.600] alvo 2.150
OK   [aceite] vencedor com mais abates: 0.957  banda [0.850; 1.000] alvo 0.900
OK   [aceite] vencedor atras no ouro: 0.013  banda [0.000; 0.050] alvo 0.020
FORA [aceite] ouro vencedor menos perdedor: 17680  banda [7000; 13000] alvo 10000
OK   [aceite] GPM por time: 1821  banda [1650; 2050] alvo 1833
FORA [aceite] GPM vencedor / perdedor: 1.351  banda [1.120; 1.260] alvo 1.190
OK   [aceite] time do 1o Barao vence: 0.850  banda [0.780; 0.900] alvo 0.854
OK   [aceite] time da Alma vence: 0.872  banda [0.840; 0.950] alvo 0.908
OK   [aceite] time da 1a torre vence: 0.687  banda [0.620; 0.750] alvo 0.682
OK   [aceite] roubos / objetivos tomados: 0.018  banda [0.000; 0.030] alvo 0.020
FORA [aceite] favorito com gap >= 5 vence: 0.720  banda [0.750; 0.850] alvo 0.800
OK   [aceite] favorito com gap < 1 vence: 0.485  banda [0.450; 0.550] alvo 0.500
--- acompanhadas sem gate ---
     abates por partida: 56.225  (real 27)
     abates por minuto: 1.644  (real 0,84)
     mediana do first blood (s): 60.000  (real 300)
     mediana do 1o dragao (s): 315  (real 550)
     1o Barao no 1o minuto de spawn: 0.642  (real raro)
     partidas com Elder: 0.483  (real 0,08)
```

## 7. Calibracao final (Task 8)

Contexto: todas as pecas do modelo ja estao no motor (Tasks 2 a 7). Esta task so mexe nos valores
de `DEFAULT_REALISM_TUNING`: motor, testes e bandas ficam como estao, e nenhuma banda foi afrouxada.
Ponto de partida (fim da Task 7): `goldFightExponent` 1.5, `fightNoiseBase` 0.16,
`conversionSiegeBase` 20; os demais campos como na tabela final da secao 7.6.

Ferramentas:

- gate: `npm run calibrate:realism` (cenario `app`, N=1500, seeds 0 a 1499);
- varredura: `scripts/sweep-realism.ts`, cenario `app`, N=600, seeds 0 a 599, mesmas seeds em todos
  os pontos. Desde o fix 1 da Task 8 o script do repo imprime as 24 colunas das saidas abaixo
  (as 22 de antes mais `goldLeaderAt15Wins` e `winnerMoreKillsFrac`), seguidas de uma linha
  `FORA (k)` com as bandas de `REALISM_BAND_SPECS` (19, travas incluidas) fora no ponto, e aceita um
  terceiro argumento opcional com campos de `SimConfig` (por exemplo `'{"ratingPowerD":525}'`). As
  saidas foram geradas antes, com uma copia local que o fix 1 promoveu ao script; rodado de novo, o
  script do repo devolve as mesmas linhas (conferido byte a byte no desempate da 7.4.1, e pela receita
  de reproducao abaixo nas linhas de metricas da 7.2.2, da 7.4.2 e do segundo lote da 7.5).

Reproducao: cada varredura traz uma linha "Base" com o padrao vigente quando ela rodou (os tres
campos que esta task mudou; os demais campos de tuning ficam como na tabela da 7.6) e o
`ratingPowerD`, que em toda a secao 7 ate a 7.6 era 525. Os padroes mudaram depois (7.6 e 7.7), entao
para reproduzir com os padroes de hoje basta acrescentar os campos da Base a cada ponto do JSON (o
campo varrido prevalece) e passar `'{"ratingPowerD":525}'` como terceiro argumento; as linhas de
metricas saem iguais, so a linha `ponto` mostra o JSON completo. Exemplo, a varredura da 7.2.2:

```
npx tsx scripts/sweep-realism.ts '[{"fightNoiseBase":0.24,"conversionSiegeBase":20,"goldFightExponent":1.0},{"fightNoiseBase":0.24,"conversionSiegeBase":20,"goldFightExponent":1.25},{"fightNoiseBase":0.24,"conversionSiegeBase":20,"goldFightExponent":1.5},{"fightNoiseBase":0.24,"conversionSiegeBase":20,"goldFightExponent":1.75},{"fightNoiseBase":0.24,"conversionSiegeBase":20,"goldFightExponent":2.0}]' 600 '{"ratingPowerD":525}'
```

Criterio de escolha em cada varredura (Step 2 do plano; os itens 3 a 5 sao o desempate. O item 3
decidiu os empates das passadas 1 e 2. O item 4 foi escrito durante a 7.4.1, o primeiro empate em
que so o favorito gap >= 5 diferia: ali 0.255 foi gravado primeiro pelo item 3 e o gate rodou; ao
ver que a diferenca era so ruido, escrevi o item 4 e refiz aquele desempate no N=1500, que confirmou
0.255. Dali em diante o item 4 foi aplicado igual em todos os empates):

1. travas e regras duras intactas: `hardRuleViolations` 0, `capFraction` <= 0,005, duracao media em
   [29; 36] e mediana da 1a torre em [480; 1200];
2. o menor numero de bandas fora no N=600 (linha `FORA`);
3. empate, quando a diferenca vem de alguma banda alem do favorito gap >= 5: a menor soma das
   distancias normalizadas das bandas fora (distancia ate a borda mais proxima dividida pela largura
   da banda);
4. empate em que so o favorito gap >= 5 difere (as outras 18 bandas dentro nos dois pontos): essa
   banda tem so 75 partidas no N=600 (178 no N=1500), ou seja, um desvio padrao de cerca de
   0,053 (0,034 no N=1500), e a diferenca e ruido. Desempate no N=1500 (as mesmas seeds do gate):
   menos bandas fora e, depois, a maior margem minima normalizada entre as bandas dentro (distancia
   ate a borda dividida pela largura; nas bandas de um lado so, teto de 60 min, roubos, vencedor atras
   no ouro e vencedor com mais abates, conta so a borda que pode ser cruzada). Ou seja, o ponto mais
   robusto;
5. empate restante: manter o valor vigente.

A contagem da regra de parada (Step 3) usa as bandas dentro no gate (N=1500), nao no N=600.

As colunas "soma fora" e "margem minima" das tabelas abaixo foram calculadas das saidas
impressas, com a regra dos itens 3 e 4.

### 7.1 Gate inicial (Step 1, N=1500, padrao do fim da Task 7)

Asserts duros: os dois PASS ("zero violacao de regra dura" e "mesma seed gera a mesma partida").
Bandas (linhas do gate, sem o sufixo de fonte):

```
[OK] duracao media (min) = 34.097 dentro da banda [29.000, 36.000], alvo 32.300
[OK] fracao no teto de 60 min = 0.000 dentro da banda [0.000, 0.005], alvo 0.000
[OK] mediana da 1a torre (s) = 615 dentro da banda [480, 1200], alvo 975
[FALHA] lider de abates aos 20 vence = 0.827 estourou o TETO da banda [0.700, 0.820], alvo 0.764
[FALHA] lider de ouro aos 15 vence = 0.805 estourou o TETO da banda [0.660, 0.780], alvo 0.716
[OK] lider de ouro aos 20 vence = 0.828 dentro da banda [0.720, 0.840], alvo 0.782
[OK] lider de ouro aos 25 vence = 0.880 dentro da banda [0.770, 0.890], alvo 0.830
[FALHA] abates vencedor / perdedor = 3.098 estourou o TETO da banda [1.800, 2.600], alvo 2.150
[OK] vencedor com mais abates = 0.965 dentro da banda [0.850, 1.000], alvo 0.900
[OK] vencedor atras no ouro = 0.011 dentro da banda [0.000, 0.050], alvo 0.020
[FALHA] ouro vencedor menos perdedor = 17665 estourou o TETO da banda [7000, 13000], alvo 10000
[OK] GPM por time = 1823 dentro da banda [1650, 2050], alvo 1833
[FALHA] GPM vencedor / perdedor = 1.350 estourou o TETO da banda [1.120, 1.260], alvo 1.190
[OK] time do 1o Barao vence = 0.845 dentro da banda [0.780, 0.900], alvo 0.854
[OK] time da Alma vence = 0.885 dentro da banda [0.840, 0.950], alvo 0.908
[OK] time da 1a torre vence = 0.693 dentro da banda [0.620, 0.750], alvo 0.682
[OK] roubos / objetivos tomados = 0.019 dentro da banda [0.000, 0.030], alvo 0.020
[FALHA] favorito com gap >= 5 vence = 0.674 estourou o PISO da banda [0.750, 0.850], alvo 0.800
[OK] favorito com gap < 1 vence = 0.524 dentro da banda [0.450, 0.550], alvo 0.500
```

Fora (6): lider de abates aos 20 (0,827), lider de ouro aos 15 (0,805), abates venc/perd (3,098),
delta de ouro (17665), GPM venc/perd (1,350) e favorito gap >= 5 (0,674).

### 7.2 Passada 1

#### 7.2.1 Favorito gap >= 5, primeira alavanca: `fightNoiseBase`

Base: `goldFightExponent` 1.5, `fightNoiseBase` 0.16, `conversionSiegeBase` 20, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"fightNoiseBase":0.08},{"fightNoiseBase":0.12},{"fightNoiseBase":0.16},{"fightNoiseBase":0.20},{"fightNoiseBase":0.24}]' 600
```

```
N=600 por ponto, cenario app

ponto {"fightNoiseBase":0.08}
  durationMeanMin=33.446 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1807 | teamGoldAt10=17887 | teamGoldAt20=34132 | killsPerGame=55.040 | killLeaderAt20Wins=0.877 | goldLeaderAt20Wins=0.877 | goldLeaderAt25Wins=0.909 | killRatioWinnerLoser=3.631 | winnerBehindGoldFrac=0.007 | goldDiffWinnerLoserMean=18923 | gpmRatioWinnerLoser=1.390 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.858 | soulWins=0.923 | firstTowerWins=0.733 | firstTowerMedianSec=615 | stealFraction=0.019 | towersPerGame=9.430 | goldLeaderAt15Wins=0.842 | winnerMoreKillsFrac=0.973
  FORA (8): killLeaderAt20Wins, goldLeaderAt15Wins, goldLeaderAt20Wins, goldLeaderAt25Wins, killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"fightNoiseBase":0.12}
  durationMeanMin=34.278 | capFraction=0.002 | hardRuleViolations=0.000 | gpmTeamMean=1816 | teamGoldAt10=17903 | teamGoldAt20=34173 | killsPerGame=56.435 | killLeaderAt20Wins=0.860 | goldLeaderAt20Wins=0.863 | goldLeaderAt25Wins=0.901 | killRatioWinnerLoser=3.272 | winnerBehindGoldFrac=0.010 | goldDiffWinnerLoserMean=18291 | gpmRatioWinnerLoser=1.366 | favoriteGap5Wins=0.693 | favoriteGapUnder1Wins=0.473 | firstBaronWins=0.847 | soulWins=0.888 | firstTowerWins=0.722 | firstTowerMedianSec=615 | stealFraction=0.019 | towersPerGame=9.798 | goldLeaderAt15Wins=0.838 | winnerMoreKillsFrac=0.970
  FORA (8): killLeaderAt20Wins, goldLeaderAt15Wins, goldLeaderAt20Wins, goldLeaderAt25Wins, killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"fightNoiseBase":0.16}
  durationMeanMin=34.200 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1821 | teamGoldAt10=17913 | teamGoldAt20=34166 | killsPerGame=56.225 | killLeaderAt20Wins=0.827 | goldLeaderAt20Wins=0.828 | goldLeaderAt25Wins=0.872 | killRatioWinnerLoser=3.081 | winnerBehindGoldFrac=0.013 | goldDiffWinnerLoserMean=17680 | gpmRatioWinnerLoser=1.351 | favoriteGap5Wins=0.720 | favoriteGapUnder1Wins=0.485 | firstBaronWins=0.850 | soulWins=0.872 | firstTowerWins=0.687 | firstTowerMedianSec=630 | stealFraction=0.018 | towersPerGame=9.772 | goldLeaderAt15Wins=0.813 | winnerMoreKillsFrac=0.957
  FORA (6): killLeaderAt20Wins, goldLeaderAt15Wins, killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"fightNoiseBase":0.2}
  durationMeanMin=34.624 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1828 | teamGoldAt10=17904 | teamGoldAt20=34208 | killsPerGame=56.893 | killLeaderAt20Wins=0.803 | goldLeaderAt20Wins=0.797 | goldLeaderAt25Wins=0.869 | killRatioWinnerLoser=2.874 | winnerBehindGoldFrac=0.012 | goldDiffWinnerLoserMean=17127 | gpmRatioWinnerLoser=1.332 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.503 | firstBaronWins=0.822 | soulWins=0.894 | firstTowerWins=0.693 | firstTowerMedianSec=630 | stealFraction=0.017 | towersPerGame=9.912 | goldLeaderAt15Wins=0.772 | winnerMoreKillsFrac=0.962
  FORA (4): killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"fightNoiseBase":0.24}
  durationMeanMin=34.775 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1836 | teamGoldAt10=17897 | teamGoldAt20=34159 | killsPerGame=57.717 | killLeaderAt20Wins=0.777 | goldLeaderAt20Wins=0.792 | goldLeaderAt25Wins=0.844 | killRatioWinnerLoser=2.698 | winnerBehindGoldFrac=0.015 | goldDiffWinnerLoserMean=16450 | gpmRatioWinnerLoser=1.317 | favoriteGap5Wins=0.747 | favoriteGapUnder1Wins=0.533 | firstBaronWins=0.818 | soulWins=0.878 | firstTowerWins=0.695 | firstTowerMedianSec=630 | stealFraction=0.018 | towersPerGame=10.095 | goldLeaderAt15Wins=0.745 | winnerMoreKillsFrac=0.952
  FORA (4): killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins
```

| fightNoiseBase | duracao (min) | bandas fora | soma fora | soma fora sem fav >= 5 |
|---|---|---|---|---|
| 0.08 | 33.446 | 8 | 5.363 | 4.663 |
| 0.12 | 34.278 | 8 | 4.149 | 3.579 |
| 0.16 (vigente) | 34.200 | 6 | 2.665 | 2.365 |
| 0.20 | 34.624 | 4 | 2.375 | 1.545 |
| 0.24 | 34.775 | 4 | 1.135 | 1.105 |

**Escolha: `fightNoiseBase` 0.24.** Empate em 4 fora com 0.20; o item 3 decide (1,135 contra 2,375, e
a diferenca vem de abates venc/perd, delta de ouro e GPM venc/perd, nao so do favorito). O sorteio
mais largo tira bola de neve: lider de abates aos 20 de 0,827 para 0,777, lider de ouro aos 15 de
0,813 para 0,745, abates venc/perd de 3,081 para 2,698. O favorito gap >= 5 nao tem tendencia
(0,667 a 0,747, dentro do ruido). O ponto esta na borda da grade; a passada 2 varre em volta dele.

Gate (N=1500) com 0.24: asserts duros PASS.

```
[OK] duracao media (min) = 34.736 dentro da banda [29.000, 36.000], alvo 32.300
[OK] fracao no teto de 60 min = 0.000 dentro da banda [0.000, 0.005], alvo 0.000
[OK] mediana da 1a torre (s) = 615 dentro da banda [480, 1200], alvo 975
[OK] lider de abates aos 20 vence = 0.774 dentro da banda [0.700, 0.820], alvo 0.764
[OK] lider de ouro aos 15 vence = 0.756 dentro da banda [0.660, 0.780], alvo 0.716
[OK] lider de ouro aos 20 vence = 0.780 dentro da banda [0.720, 0.840], alvo 0.782
[OK] lider de ouro aos 25 vence = 0.850 dentro da banda [0.770, 0.890], alvo 0.830
[FALHA] abates vencedor / perdedor = 2.704 estourou o TETO da banda [1.800, 2.600], alvo 2.150
[OK] vencedor com mais abates = 0.951 dentro da banda [0.850, 1.000], alvo 0.900
[OK] vencedor atras no ouro = 0.015 dentro da banda [0.000, 0.050], alvo 0.020
[FALHA] ouro vencedor menos perdedor = 16433 estourou o TETO da banda [7000, 13000], alvo 10000
[OK] GPM por time = 1839 dentro da banda [1650, 2050], alvo 1833
[FALHA] GPM vencedor / perdedor = 1.314 estourou o TETO da banda [1.120, 1.260], alvo 1.190
[OK] time do 1o Barao vence = 0.818 dentro da banda [0.780, 0.900], alvo 0.854
[OK] time da Alma vence = 0.873 dentro da banda [0.840, 0.950], alvo 0.908
[OK] time da 1a torre vence = 0.680 dentro da banda [0.620, 0.750], alvo 0.682
[OK] roubos / objetivos tomados = 0.018 dentro da banda [0.000, 0.030], alvo 0.020
[FALHA] favorito com gap >= 5 vence = 0.697 estourou o PISO da banda [0.750, 0.850], alvo 0.800
[OK] favorito com gap < 1 vence = 0.526 dentro da banda [0.450, 0.550], alvo 0.500
```

Fora (4): abates venc/perd 2,704; delta de ouro 16433; GPM venc/perd 1,314; favorito gap >= 5 0,697.
Entraram: lider de abates aos 20 (0,774) e lider de ouro aos 15 (0,756).

#### 7.2.2 Favorito gap >= 5 (segunda alavanca) e abates venc/perd (primeira): `goldFightExponent`

Base: `goldFightExponent` 1.5, `fightNoiseBase` 0.24, `conversionSiegeBase` 20, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"goldFightExponent":1.0},{"goldFightExponent":1.25},{"goldFightExponent":1.5},{"goldFightExponent":1.75},{"goldFightExponent":2.0}]' 600
```

```
N=600 por ponto, cenario app

ponto {"goldFightExponent":1}
  durationMeanMin=37.133 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1875 | teamGoldAt10=17946 | teamGoldAt20=34135 | killsPerGame=60.577 | killLeaderAt20Wins=0.719 | goldLeaderAt20Wins=0.733 | goldLeaderAt25Wins=0.783 | killRatioWinnerLoser=1.998 | winnerBehindGoldFrac=0.027 | goldDiffWinnerLoserMean=13253 | gpmRatioWinnerLoser=1.226 | favoriteGap5Wins=0.560 | favoriteGapUnder1Wins=0.509 | firstBaronWins=0.728 | soulWins=0.809 | firstTowerWins=0.652 | firstTowerMedianSec=630 | stealFraction=0.020 | towersPerGame=10.977 | goldLeaderAt15Wins=0.700 | winnerMoreKillsFrac=0.915
  FORA (5): durationMeanMin, goldDiffWinnerLoserMean, firstBaronWins, soulWins, favoriteGap5Wins

ponto {"goldFightExponent":1.25}
  durationMeanMin=35.987 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1858 | teamGoldAt10=17937 | teamGoldAt20=34047 | killsPerGame=58.987 | killLeaderAt20Wins=0.717 | goldLeaderAt20Wins=0.730 | goldLeaderAt25Wins=0.791 | killRatioWinnerLoser=2.175 | winnerBehindGoldFrac=0.040 | goldDiffWinnerLoserMean=14295 | gpmRatioWinnerLoser=1.258 | favoriteGap5Wins=0.733 | favoriteGapUnder1Wins=0.533 | firstBaronWins=0.760 | soulWins=0.824 | firstTowerWins=0.670 | firstTowerMedianSec=630 | stealFraction=0.019 | towersPerGame=10.552 | goldLeaderAt15Wins=0.682 | winnerMoreKillsFrac=0.905
  FORA (4): goldDiffWinnerLoserMean, firstBaronWins, soulWins, favoriteGap5Wins

ponto {"goldFightExponent":1.5}
  durationMeanMin=34.775 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1836 | teamGoldAt10=17897 | teamGoldAt20=34159 | killsPerGame=57.717 | killLeaderAt20Wins=0.777 | goldLeaderAt20Wins=0.792 | goldLeaderAt25Wins=0.844 | killRatioWinnerLoser=2.698 | winnerBehindGoldFrac=0.015 | goldDiffWinnerLoserMean=16450 | gpmRatioWinnerLoser=1.317 | favoriteGap5Wins=0.747 | favoriteGapUnder1Wins=0.533 | firstBaronWins=0.818 | soulWins=0.878 | firstTowerWins=0.695 | firstTowerMedianSec=630 | stealFraction=0.018 | towersPerGame=10.095 | goldLeaderAt15Wins=0.745 | winnerMoreKillsFrac=0.952
  FORA (4): killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"goldFightExponent":1.75}
  durationMeanMin=33.598 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1818 | teamGoldAt10=17937 | teamGoldAt20=34177 | killsPerGame=55.993 | killLeaderAt20Wins=0.813 | goldLeaderAt20Wins=0.818 | goldLeaderAt25Wins=0.890 | killRatioWinnerLoser=3.238 | winnerBehindGoldFrac=0.015 | goldDiffWinnerLoserMean=17893 | gpmRatioWinnerLoser=1.362 | favoriteGap5Wins=0.733 | favoriteGapUnder1Wins=0.503 | firstBaronWins=0.867 | soulWins=0.873 | firstTowerWins=0.697 | firstTowerMedianSec=615 | stealFraction=0.015 | towersPerGame=9.707 | goldLeaderAt15Wins=0.780 | winnerMoreKillsFrac=0.958
  FORA (5): goldLeaderAt25Wins, killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"goldFightExponent":2}
  durationMeanMin=32.842 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1802 | teamGoldAt10=17940 | teamGoldAt20=34002 | killsPerGame=54.660 | killLeaderAt20Wins=0.873 | goldLeaderAt20Wins=0.867 | goldLeaderAt25Wins=0.916 | killRatioWinnerLoser=3.792 | winnerBehindGoldFrac=0.007 | goldDiffWinnerLoserMean=19006 | gpmRatioWinnerLoser=1.401 | favoriteGap5Wins=0.747 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.865 | soulWins=0.887 | firstTowerWins=0.765 | firstTowerMedianSec=615 | stealFraction=0.016 | towersPerGame=9.478 | goldLeaderAt15Wins=0.830 | winnerMoreKillsFrac=0.977
  FORA (9): killLeaderAt20Wins, goldLeaderAt15Wins, goldLeaderAt20Wins, goldLeaderAt25Wins, killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, firstTowerWins, favoriteGap5Wins
```

| goldFightExponent | duracao (min) | bandas fora | soma fora | soma fora sem fav >= 5 |
|---|---|---|---|---|
| 1.0 | 37.133 | 5 (trava de duracao fora) | excluido no item 1 | |
| 1.25 | 35.987 | 4 | 0.698 | 0.528 |
| 1.5 (vigente) | 34.775 | 4 | 1.135 | 1.105 |
| 1.75 | 33.598 | 5 | 2.512 | 2.342 |
| 2.0 | 32.842 | 9 | 4.944 | 4.914 |

Leitura: o expoente 1.0 tira a trava de duracao (37,133 min) e sai no item 1. Empate em 4 fora
entre 1.25 e 1.5; pelo item 3 ganharia 1.25 (0,698 contra 1,135), mas a duracao do 1.25 e 35,987
min, a 0,013 min do teto da trava, e no 1.25 ficam fora delta de ouro, 1o Barao, Alma e favorito.
O expoente baixo alonga a partida, e a alavanca que encurta e o `conversionSiegeBase` (Task 6, secao 5:
de 20 para 50 a duracao cai de 35,1 para 28,3 min e o delta de ouro de 16263 para 10727), que
tambem e a segunda alavanca da linha de lider de abates e de ouro e da linha de Barao e Alma na
tabela. As duas alavancas estao acopladas pela trava de duracao, entao em vez de gravar 1.25 colado
no teto rodei a grade acoplada do ruling 2 (2 alavancas, 2 x 3 valores): expoente {1.25; 1.375} x
`conversionSiegeBase` {20; 25; 30}.

#### 7.2.3 Grade acoplada `goldFightExponent` x `conversionSiegeBase`

Base: `goldFightExponent` 1.5, `fightNoiseBase` 0.24, `conversionSiegeBase` 20, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"goldFightExponent":1.25,"conversionSiegeBase":20},{"goldFightExponent":1.25,"conversionSiegeBase":25},{"goldFightExponent":1.25,"conversionSiegeBase":30},{"goldFightExponent":1.375,"conversionSiegeBase":20},{"goldFightExponent":1.375,"conversionSiegeBase":25},{"goldFightExponent":1.375,"conversionSiegeBase":30}]' 600
```

```
N=600 por ponto, cenario app

ponto {"goldFightExponent":1.25,"conversionSiegeBase":20}
  durationMeanMin=35.987 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1858 | teamGoldAt10=17937 | teamGoldAt20=34047 | killsPerGame=58.987 | killLeaderAt20Wins=0.717 | goldLeaderAt20Wins=0.730 | goldLeaderAt25Wins=0.791 | killRatioWinnerLoser=2.175 | winnerBehindGoldFrac=0.040 | goldDiffWinnerLoserMean=14295 | gpmRatioWinnerLoser=1.258 | favoriteGap5Wins=0.733 | favoriteGapUnder1Wins=0.533 | firstBaronWins=0.760 | soulWins=0.824 | firstTowerWins=0.670 | firstTowerMedianSec=630 | stealFraction=0.019 | towersPerGame=10.552 | goldLeaderAt15Wins=0.682 | winnerMoreKillsFrac=0.905
  FORA (4): goldDiffWinnerLoserMean, firstBaronWins, soulWins, favoriteGap5Wins

ponto {"goldFightExponent":1.25,"conversionSiegeBase":25}
  durationMeanMin=33.934 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1856 | teamGoldAt10=17966 | teamGoldAt20=34088 | killsPerGame=54.095 | killLeaderAt20Wins=0.733 | goldLeaderAt20Wins=0.755 | goldLeaderAt25Wins=0.777 | killRatioWinnerLoser=2.173 | winnerBehindGoldFrac=0.028 | goldDiffWinnerLoserMean=13263 | gpmRatioWinnerLoser=1.251 | favoriteGap5Wins=0.720 | favoriteGapUnder1Wins=0.395 | firstBaronWins=0.777 | soulWins=0.821 | firstTowerWins=0.675 | firstTowerMedianSec=615 | stealFraction=0.018 | towersPerGame=10.577 | goldLeaderAt15Wins=0.715 | winnerMoreKillsFrac=0.903
  FORA (5): goldDiffWinnerLoserMean, firstBaronWins, soulWins, favoriteGap5Wins, favoriteGapUnder1Wins

ponto {"goldFightExponent":1.25,"conversionSiegeBase":30}
  durationMeanMin=32.417 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1859 | teamGoldAt10=17986 | teamGoldAt20=34297 | killsPerGame=50.670 | killLeaderAt20Wins=0.714 | goldLeaderAt20Wins=0.713 | goldLeaderAt25Wins=0.782 | killRatioWinnerLoser=2.084 | winnerBehindGoldFrac=0.025 | goldDiffWinnerLoserMean=11842 | gpmRatioWinnerLoser=1.232 | favoriteGap5Wins=0.707 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.780 | soulWins=0.828 | firstTowerWins=0.648 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.805 | goldLeaderAt15Wins=0.702 | winnerMoreKillsFrac=0.908
  FORA (3): goldLeaderAt20Wins, soulWins, favoriteGap5Wins

ponto {"goldFightExponent":1.375,"conversionSiegeBase":20}
  durationMeanMin=35.556 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=17918 | teamGoldAt20=34123 | killsPerGame=58.525 | killLeaderAt20Wins=0.754 | goldLeaderAt20Wins=0.762 | goldLeaderAt25Wins=0.835 | killRatioWinnerLoser=2.390 | winnerBehindGoldFrac=0.027 | goldDiffWinnerLoserMean=15283 | gpmRatioWinnerLoser=1.283 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.533 | firstBaronWins=0.787 | soulWins=0.837 | firstTowerWins=0.693 | firstTowerMedianSec=615 | stealFraction=0.019 | towersPerGame=10.423 | goldLeaderAt15Wins=0.718 | winnerMoreKillsFrac=0.933
  FORA (4): goldDiffWinnerLoserMean, gpmRatioWinnerLoser, soulWins, favoriteGap5Wins

ponto {"goldFightExponent":1.375,"conversionSiegeBase":25}
  durationMeanMin=33.498 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=17950 | teamGoldAt20=34146 | killsPerGame=54.027 | killLeaderAt20Wins=0.746 | goldLeaderAt20Wins=0.775 | goldLeaderAt25Wins=0.813 | killRatioWinnerLoser=2.351 | winnerBehindGoldFrac=0.027 | goldDiffWinnerLoserMean=14005 | gpmRatioWinnerLoser=1.272 | favoriteGap5Wins=0.733 | favoriteGapUnder1Wins=0.443 | firstBaronWins=0.800 | soulWins=0.856 | firstTowerWins=0.680 | firstTowerMedianSec=615 | stealFraction=0.018 | towersPerGame=10.435 | goldLeaderAt15Wins=0.737 | winnerMoreKillsFrac=0.927
  FORA (4): goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins, favoriteGapUnder1Wins

ponto {"goldFightExponent":1.375,"conversionSiegeBase":30}
  durationMeanMin=31.805 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=17969 | teamGoldAt20=34434 | killsPerGame=50.048 | killLeaderAt20Wins=0.750 | goldLeaderAt20Wins=0.771 | goldLeaderAt25Wins=0.807 | killRatioWinnerLoser=2.270 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=12598 | gpmRatioWinnerLoser=1.255 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.803 | soulWins=0.837 | firstTowerWins=0.672 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.637 | goldLeaderAt15Wins=0.728 | winnerMoreKillsFrac=0.927
  FORA (2): soulWins, favoriteGap5Wins
```

| goldFightExponent | conversionSiegeBase | duracao (min) | bandas fora | soma fora | soma fora sem fav >= 5 |
|---|---|---|---|---|---|
| 1.25 | 20 | 35.987 | 4 | 0.698 | 0.528 |
| 1.25 | 25 | 33.934 | 5 | 1.092 | 0.792 |
| 1.25 | 30 | 32.417 | 3 | 0.597 | 0.167 |
| 1.375 | 20 | 35.556 | 4 | 1.272 | 0.572 |
| 1.375 | 25 | 33.498 | 4 | 0.493 | 0.323 |
| 1.375 | 30 | 31.805 | 2 | 0.727 | 0.027 |

**Escolha: `goldFightExponent` 1.375 e `conversionSiegeBase` 30** (o unico com 2 fora: Alma 0,837 e
favorito gap >= 5 0,680). Duracao 31,805 min, no meio da trava.

Gate (N=1500): asserts duros PASS.

```
[OK] duracao media (min) = 31.746 dentro da banda [29.000, 36.000], alvo 32.300
[OK] fracao no teto de 60 min = 0.000 dentro da banda [0.000, 0.005], alvo 0.000
[OK] mediana da 1a torre (s) = 600 dentro da banda [480, 1200], alvo 975
[OK] lider de abates aos 20 vence = 0.761 dentro da banda [0.700, 0.820], alvo 0.764
[OK] lider de ouro aos 15 vence = 0.729 dentro da banda [0.660, 0.780], alvo 0.716
[OK] lider de ouro aos 20 vence = 0.775 dentro da banda [0.720, 0.840], alvo 0.782
[OK] lider de ouro aos 25 vence = 0.826 dentro da banda [0.770, 0.890], alvo 0.830
[OK] abates vencedor / perdedor = 2.307 dentro da banda [1.800, 2.600], alvo 2.150
[OK] vencedor com mais abates = 0.933 dentro da banda [0.850, 1.000], alvo 0.900
[OK] vencedor atras no ouro = 0.022 dentro da banda [0.000, 0.050], alvo 0.020
[OK] ouro vencedor menos perdedor = 12585 dentro da banda [7000, 13000], alvo 10000
[OK] GPM por time = 1849 dentro da banda [1650, 2050], alvo 1833
[OK] GPM vencedor / perdedor = 1.254 dentro da banda [1.120, 1.260], alvo 1.190
[OK] time do 1o Barao vence = 0.802 dentro da banda [0.780, 0.900], alvo 0.854
[OK] time da Alma vence = 0.846 dentro da banda [0.840, 0.950], alvo 0.908
[OK] time da 1a torre vence = 0.660 dentro da banda [0.620, 0.750], alvo 0.682
[OK] roubos / objetivos tomados = 0.018 dentro da banda [0.000, 0.030], alvo 0.020
[FALHA] favorito com gap >= 5 vence = 0.674 estourou o PISO da banda [0.750, 0.850], alvo 0.800
[OK] favorito com gap < 1 vence = 0.507 dentro da banda [0.450, 0.550], alvo 0.500
```

Fora (1): favorito gap >= 5 0,674. Entraram abates venc/perd (2,307), delta de ouro (12585) e GPM
venc/perd (1,254). A Alma fica dentro no N=1500 (0,846) e fora no N=600 (0,837).

Fim da passada 1: de 6 bandas fora para 1 no gate. As outras linhas da tabela (lider de abates e de
ouro, delta de ouro e GPM venc/perd, GPM do time, 1o Barao e Alma, 1a torre, roubos) nao tem banda
fora no gate, entao a passada termina aqui.

### 7.3 Passada 2 (so o favorito gap >= 5 fora)

#### 7.3.1 `fightNoiseBase` em volta de 0.24

Base: `goldFightExponent` 1.375, `fightNoiseBase` 0.24, `conversionSiegeBase` 30, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"fightNoiseBase":0.16},{"fightNoiseBase":0.20},{"fightNoiseBase":0.24},{"fightNoiseBase":0.28},{"fightNoiseBase":0.32}]' 600
```

```
N=600 por ponto, cenario app

ponto {"fightNoiseBase":0.16}
  durationMeanMin=31.280 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1833 | teamGoldAt10=17968 | teamGoldAt20=34409 | killsPerGame=47.933 | killLeaderAt20Wins=0.801 | goldLeaderAt20Wins=0.798 | goldLeaderAt25Wins=0.866 | killRatioWinnerLoser=2.599 | winnerBehindGoldFrac=0.013 | goldDiffWinnerLoserMean=13486 | gpmRatioWinnerLoser=1.281 | favoriteGap5Wins=0.707 | favoriteGapUnder1Wins=0.485 | firstBaronWins=0.837 | soulWins=0.874 | firstTowerWins=0.712 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.015 | goldLeaderAt15Wins=0.782 | winnerMoreKillsFrac=0.950
  FORA (4): goldLeaderAt15Wins, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"fightNoiseBase":0.2}
  durationMeanMin=31.496 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1842 | teamGoldAt10=17965 | teamGoldAt20=34428 | killsPerGame=48.983 | killLeaderAt20Wins=0.771 | goldLeaderAt20Wins=0.776 | goldLeaderAt25Wins=0.827 | killRatioWinnerLoser=2.454 | winnerBehindGoldFrac=0.017 | goldDiffWinnerLoserMean=13077 | gpmRatioWinnerLoser=1.269 | favoriteGap5Wins=0.707 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.820 | soulWins=0.864 | firstTowerWins=0.702 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.257 | goldLeaderAt15Wins=0.752 | winnerMoreKillsFrac=0.942
  FORA (3): goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"fightNoiseBase":0.24}
  durationMeanMin=31.805 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=17969 | teamGoldAt20=34434 | killsPerGame=50.048 | killLeaderAt20Wins=0.750 | goldLeaderAt20Wins=0.771 | goldLeaderAt25Wins=0.807 | killRatioWinnerLoser=2.270 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=12598 | gpmRatioWinnerLoser=1.255 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.803 | soulWins=0.837 | firstTowerWins=0.672 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.637 | goldLeaderAt15Wins=0.728 | winnerMoreKillsFrac=0.927
  FORA (2): soulWins, favoriteGap5Wins

ponto {"fightNoiseBase":0.28}
  durationMeanMin=32.143 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1859 | teamGoldAt10=17972 | teamGoldAt20=34401 | killsPerGame=50.663 | killLeaderAt20Wins=0.730 | goldLeaderAt20Wins=0.731 | goldLeaderAt25Wins=0.782 | killRatioWinnerLoser=2.132 | winnerBehindGoldFrac=0.018 | goldDiffWinnerLoserMean=11938 | gpmRatioWinnerLoser=1.236 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.497 | firstBaronWins=0.772 | soulWins=0.795 | firstTowerWins=0.660 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.805 | goldLeaderAt15Wins=0.713 | winnerMoreKillsFrac=0.922
  FORA (3): firstBaronWins, soulWins, favoriteGap5Wins

ponto {"fightNoiseBase":0.32}
  durationMeanMin=32.065 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1861 | teamGoldAt10=17972 | teamGoldAt20=34355 | killsPerGame=50.827 | killLeaderAt20Wins=0.716 | goldLeaderAt20Wins=0.741 | goldLeaderAt25Wins=0.800 | killRatioWinnerLoser=2.130 | winnerBehindGoldFrac=0.027 | goldDiffWinnerLoserMean=11997 | gpmRatioWinnerLoser=1.235 | favoriteGap5Wins=0.693 | favoriteGapUnder1Wins=0.485 | firstBaronWins=0.752 | soulWins=0.810 | firstTowerWins=0.667 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.840 | goldLeaderAt15Wins=0.730 | winnerMoreKillsFrac=0.910
  FORA (3): firstBaronWins, soulWins, favoriteGap5Wins
```

| fightNoiseBase | duracao (min) | bandas fora | soma fora | soma fora sem fav >= 5 |
|---|---|---|---|---|
| 0.16 | 31.280 | 4 | 0.678 | 0.248 |
| 0.20 | 31.496 | 3 | 0.507 | 0.077 |
| 0.24 (vigente) | 31.805 | 2 | 0.727 | 0.027 |
| 0.28 | 32.143 | 3 | 1.306 | 0.476 |
| 0.32 | 32.065 | 3 | 1.076 | 0.506 |

**Escolha: 0.24 fica** (o unico com 2 fora). Sem mudanca de valor, o gate e o mesmo da 7.2.3.

#### 7.3.2 `goldFightExponent` em volta de 1.375

Base: `goldFightExponent` 1.375, `fightNoiseBase` 0.24, `conversionSiegeBase` 30, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"goldFightExponent":1.125},{"goldFightExponent":1.25},{"goldFightExponent":1.375},{"goldFightExponent":1.5},{"goldFightExponent":1.625}]' 600
```

```
N=600 por ponto, cenario app

ponto {"goldFightExponent":1.125}
  durationMeanMin=32.883 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1869 | teamGoldAt10=17996 | teamGoldAt20=34354 | killsPerGame=51.393 | killLeaderAt20Wins=0.702 | goldLeaderAt20Wins=0.703 | goldLeaderAt25Wins=0.760 | killRatioWinnerLoser=1.920 | winnerBehindGoldFrac=0.037 | goldDiffWinnerLoserMean=10858 | gpmRatioWinnerLoser=1.206 | favoriteGap5Wins=0.707 | favoriteGapUnder1Wins=0.473 | firstBaronWins=0.755 | soulWins=0.793 | firstTowerWins=0.637 | firstTowerMedianSec=600 | stealFraction=0.021 | towersPerGame=11.093 | goldLeaderAt15Wins=0.692 | winnerMoreKillsFrac=0.902
  FORA (5): goldLeaderAt20Wins, goldLeaderAt25Wins, firstBaronWins, soulWins, favoriteGap5Wins

ponto {"goldFightExponent":1.25}
  durationMeanMin=32.417 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1859 | teamGoldAt10=17986 | teamGoldAt20=34297 | killsPerGame=50.670 | killLeaderAt20Wins=0.714 | goldLeaderAt20Wins=0.713 | goldLeaderAt25Wins=0.782 | killRatioWinnerLoser=2.084 | winnerBehindGoldFrac=0.025 | goldDiffWinnerLoserMean=11842 | gpmRatioWinnerLoser=1.232 | favoriteGap5Wins=0.707 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.780 | soulWins=0.828 | firstTowerWins=0.648 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.805 | goldLeaderAt15Wins=0.702 | winnerMoreKillsFrac=0.908
  FORA (3): goldLeaderAt20Wins, soulWins, favoriteGap5Wins

ponto {"goldFightExponent":1.375}
  durationMeanMin=31.805 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=17969 | teamGoldAt20=34434 | killsPerGame=50.048 | killLeaderAt20Wins=0.750 | goldLeaderAt20Wins=0.771 | goldLeaderAt25Wins=0.807 | killRatioWinnerLoser=2.270 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=12598 | gpmRatioWinnerLoser=1.255 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.803 | soulWins=0.837 | firstTowerWins=0.672 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.637 | goldLeaderAt15Wins=0.728 | winnerMoreKillsFrac=0.927
  FORA (2): soulWins, favoriteGap5Wins

ponto {"goldFightExponent":1.5}
  durationMeanMin=31.544 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1841 | teamGoldAt10=17943 | teamGoldAt20=34381 | killsPerGame=49.328 | killLeaderAt20Wins=0.762 | goldLeaderAt20Wins=0.785 | goldLeaderAt25Wins=0.804 | killRatioWinnerLoser=2.392 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=13039 | gpmRatioWinnerLoser=1.269 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.491 | firstBaronWins=0.817 | soulWins=0.835 | firstTowerWins=0.682 | firstTowerMedianSec=600 | stealFraction=0.016 | towersPerGame=10.388 | goldLeaderAt15Wins=0.743 | winnerMoreKillsFrac=0.928
  FORA (4): goldDiffWinnerLoserMean, gpmRatioWinnerLoser, soulWins, favoriteGap5Wins

ponto {"goldFightExponent":1.625}
  durationMeanMin=31.012 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1835 | teamGoldAt10=17970 | teamGoldAt20=34362 | killsPerGame=48.552 | killLeaderAt20Wins=0.807 | goldLeaderAt20Wins=0.816 | goldLeaderAt25Wins=0.849 | killRatioWinnerLoser=2.673 | winnerBehindGoldFrac=0.017 | goldDiffWinnerLoserMean=13859 | gpmRatioWinnerLoser=1.292 | favoriteGap5Wins=0.707 | favoriteGapUnder1Wins=0.473 | firstBaronWins=0.835 | soulWins=0.835 | firstTowerWins=0.727 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.138 | goldLeaderAt15Wins=0.782 | winnerMoreKillsFrac=0.962
  FORA (6): goldLeaderAt15Wins, killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, soulWins, favoriteGap5Wins
```

| goldFightExponent | duracao (min) | bandas fora | soma fora | soma fora sem fav >= 5 |
|---|---|---|---|---|
| 1.125 | 32.883 | 5 | 1.291 | 0.861 |
| 1.25 | 32.417 | 3 | 0.597 | 0.167 |
| 1.375 (vigente) | 31.805 | 2 | 0.727 | 0.027 |
| 1.5 | 31.544 | 4 | 0.816 | 0.116 |
| 1.625 | 31.012 | 6 | 0.955 | 0.525 |

**Escolha: 1.375 fica.** Passada 2 completa sem banda nova no gate (segue so o favorito gap >= 5
fora).

### 7.4 Passada 3 (so o favorito gap >= 5 fora: passos mais finos e as duas alavancas extras do ruling 1)

#### 7.4.1 `fightNoiseBase` em passos de 0,015

Base: `goldFightExponent` 1.375, `fightNoiseBase` 0.24, `conversionSiegeBase` 30, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"fightNoiseBase":0.21},{"fightNoiseBase":0.225},{"fightNoiseBase":0.24},{"fightNoiseBase":0.255},{"fightNoiseBase":0.27}]' 600
```

```
N=600 por ponto, cenario app

ponto {"fightNoiseBase":0.21}
  durationMeanMin=31.529 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1844 | teamGoldAt10=17958 | teamGoldAt20=34440 | killsPerGame=49.262 | killLeaderAt20Wins=0.762 | goldLeaderAt20Wins=0.770 | goldLeaderAt25Wins=0.811 | killRatioWinnerLoser=2.392 | winnerBehindGoldFrac=0.025 | goldDiffWinnerLoserMean=12895 | gpmRatioWinnerLoser=1.265 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.815 | soulWins=0.866 | firstTowerWins=0.697 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.342 | goldLeaderAt15Wins=0.733 | winnerMoreKillsFrac=0.938
  FORA (2): gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"fightNoiseBase":0.225}
  durationMeanMin=31.830 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1847 | teamGoldAt10=17959 | teamGoldAt20=34419 | killsPerGame=49.763 | killLeaderAt20Wins=0.754 | goldLeaderAt20Wins=0.760 | goldLeaderAt25Wins=0.808 | killRatioWinnerLoser=2.337 | winnerBehindGoldFrac=0.027 | goldDiffWinnerLoserMean=12807 | gpmRatioWinnerLoser=1.260 | favoriteGap5Wins=0.640 | favoriteGapUnder1Wins=0.461 | firstBaronWins=0.798 | soulWins=0.856 | firstTowerWins=0.675 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.547 | goldLeaderAt15Wins=0.738 | winnerMoreKillsFrac=0.938
  FORA (1): favoriteGap5Wins

ponto {"fightNoiseBase":0.24}
  durationMeanMin=31.805 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=17969 | teamGoldAt20=34434 | killsPerGame=50.048 | killLeaderAt20Wins=0.750 | goldLeaderAt20Wins=0.771 | goldLeaderAt25Wins=0.807 | killRatioWinnerLoser=2.270 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=12598 | gpmRatioWinnerLoser=1.255 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.803 | soulWins=0.837 | firstTowerWins=0.672 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.637 | goldLeaderAt15Wins=0.728 | winnerMoreKillsFrac=0.927
  FORA (2): soulWins, favoriteGap5Wins

ponto {"fightNoiseBase":0.255}
  durationMeanMin=32.067 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1854 | teamGoldAt10=17974 | teamGoldAt20=34377 | killsPerGame=50.550 | killLeaderAt20Wins=0.721 | goldLeaderAt20Wins=0.730 | goldLeaderAt25Wins=0.783 | killRatioWinnerLoser=2.166 | winnerBehindGoldFrac=0.030 | goldDiffWinnerLoserMean=12093 | gpmRatioWinnerLoser=1.242 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.461 | firstBaronWins=0.783 | soulWins=0.841 | firstTowerWins=0.657 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.778 | goldLeaderAt15Wins=0.710 | winnerMoreKillsFrac=0.908
  FORA (1): favoriteGap5Wins

ponto {"fightNoiseBase":0.27}
  durationMeanMin=32.125 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1857 | teamGoldAt10=17969 | teamGoldAt20=34380 | killsPerGame=50.713 | killLeaderAt20Wins=0.736 | goldLeaderAt20Wins=0.728 | goldLeaderAt25Wins=0.771 | killRatioWinnerLoser=2.145 | winnerBehindGoldFrac=0.023 | goldDiffWinnerLoserMean=12019 | gpmRatioWinnerLoser=1.238 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.455 | firstBaronWins=0.767 | soulWins=0.834 | firstTowerWins=0.667 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.793 | goldLeaderAt15Wins=0.722 | winnerMoreKillsFrac=0.920
  FORA (3): firstBaronWins, soulWins, favoriteGap5Wins
```

| fightNoiseBase | duracao (min) | bandas fora | soma fora | soma fora sem fav >= 5 |
|---|---|---|---|---|
| 0.21 | 31.529 | 2 | 0.736 | 0.036 |
| 0.225 | 31.830 | 1 | 1.100 | 0.000 |
| 0.24 (vigente) | 31.805 | 2 | 0.727 | 0.027 |
| 0.255 | 32.067 | 1 | 0.830 | 0.000 |
| 0.27 | 32.125 | 3 | 0.863 | 0.163 |

Empate em 1 fora entre 0.225 e 0.255, e so o favorito gap >= 5 difere (0,640 contra 0,667, duas
partidas em 75): vale o item 4, no N=1500. Ordem real dos passos: primeiro gravei 0.255 pelo item 3
(soma fora 0,830 contra 1,100, diferenca que vem so do favorito) e rodei o gate mostrado abaixo; ao
ver que a diferenca era so ruido do favorito, escrevi o item 4 e refiz o desempate no N=1500, que
confirmou 0.255.

Base: `goldFightExponent` 1.375, `conversionSiegeBase` 30, `ratingPowerD` 525. O `fightNoiseBase` e o campo varrido nos dois pontos, entao o valor dele na base nao entra no resultado; o padrao gravado quando este desempate rodou ja era 0.255, porque o gate abaixo rodou antes dele (ver a ordem acima). O valor vigente no inicio da 7.4.1 era 0.24.

```
npx tsx scripts/sweep-realism.ts '[{"fightNoiseBase":0.225},{"fightNoiseBase":0.255}]' 1500
```

```
N=1500 por ponto, cenario app

ponto {"fightNoiseBase":0.225}
  durationMeanMin=31.674 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1846 | teamGoldAt10=17974 | teamGoldAt20=34413 | killsPerGame=49.434 | killLeaderAt20Wins=0.767 | goldLeaderAt20Wins=0.769 | goldLeaderAt25Wins=0.835 | killRatioWinnerLoser=2.363 | winnerBehindGoldFrac=0.021 | goldDiffWinnerLoserMean=12746 | gpmRatioWinnerLoser=1.259 | favoriteGap5Wins=0.635 | favoriteGapUnder1Wins=0.486 | firstBaronWins=0.809 | soulWins=0.859 | firstTowerWins=0.662 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.437 | goldLeaderAt15Wins=0.739 | winnerMoreKillsFrac=0.937
  FORA (1): favoriteGap5Wins

ponto {"fightNoiseBase":0.255}
  durationMeanMin=31.932 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1852 | teamGoldAt10=17976 | teamGoldAt20=34372 | killsPerGame=50.298 | killLeaderAt20Wins=0.742 | goldLeaderAt20Wins=0.753 | goldLeaderAt25Wins=0.804 | killRatioWinnerLoser=2.232 | winnerBehindGoldFrac=0.028 | goldDiffWinnerLoserMean=12291 | gpmRatioWinnerLoser=1.247 | favoriteGap5Wins=0.618 | favoriteGapUnder1Wins=0.505 | firstBaronWins=0.789 | soulWins=0.852 | firstTowerWins=0.636 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.650 | goldLeaderAt15Wins=0.714 | winnerMoreKillsFrac=0.922
  FORA (1): favoriteGap5Wins
```

| fightNoiseBase | bandas fora (N=1500) | margem minima (banda) |
|---|---|---|
| 0.225 | 1 | 0.007 (GPM venc/perd 1,259) |
| 0.255 | 1 | 0.075 (1o Barao 0,789) |

**Escolha: `fightNoiseBase` 0.255.** Gate (N=1500): asserts duros PASS.

```
[OK] duracao media (min) = 31.932 dentro da banda [29.000, 36.000], alvo 32.300
[OK] fracao no teto de 60 min = 0.000 dentro da banda [0.000, 0.005], alvo 0.000
[OK] mediana da 1a torre (s) = 600 dentro da banda [480, 1200], alvo 975
[OK] lider de abates aos 20 vence = 0.742 dentro da banda [0.700, 0.820], alvo 0.764
[OK] lider de ouro aos 15 vence = 0.714 dentro da banda [0.660, 0.780], alvo 0.716
[OK] lider de ouro aos 20 vence = 0.753 dentro da banda [0.720, 0.840], alvo 0.782
[OK] lider de ouro aos 25 vence = 0.804 dentro da banda [0.770, 0.890], alvo 0.830
[OK] abates vencedor / perdedor = 2.232 dentro da banda [1.800, 2.600], alvo 2.150
[OK] vencedor com mais abates = 0.922 dentro da banda [0.850, 1.000], alvo 0.900
[OK] vencedor atras no ouro = 0.028 dentro da banda [0.000, 0.050], alvo 0.020
[OK] ouro vencedor menos perdedor = 12291 dentro da banda [7000, 13000], alvo 10000
[OK] GPM por time = 1852 dentro da banda [1650, 2050], alvo 1833
[OK] GPM vencedor / perdedor = 1.247 dentro da banda [1.120, 1.260], alvo 1.190
[OK] time do 1o Barao vence = 0.789 dentro da banda [0.780, 0.900], alvo 0.854
[OK] time da Alma vence = 0.852 dentro da banda [0.840, 0.950], alvo 0.908
[OK] time da 1a torre vence = 0.636 dentro da banda [0.620, 0.750], alvo 0.682
[OK] roubos / objetivos tomados = 0.018 dentro da banda [0.000, 0.030], alvo 0.020
[FALHA] favorito com gap >= 5 vence = 0.618 estourou o PISO da banda [0.750, 0.850], alvo 0.800
[OK] favorito com gap < 1 vence = 0.505 dentro da banda [0.450, 0.550], alvo 0.500
```

Fora (1): favorito gap >= 5 0,618 (0,674 com 0.24). Nenhuma banda entrou nem saiu. A margem minima
das 18 bandas dentro subiu de 0,043 (GPM venc/perd 1,254, gate da 7.2.3) para 0,075 (1o Barao
0,789): delta de ouro 12585 para 12291, GPM venc/perd 1,254 para 1,247, Alma 0,846 para 0,852; em
troca 1o Barao 0,802 para 0,789 e 1a torre 0,660 para 0,636. O favorito gap >= 5 caiu 0,056 (10 de
178 partidas, cerca de 1,6 desvio padrao); na exploracao da 7.5 ele oscila entre 0,59 e 0,70 sem
tendencia com a largura do sorteio.

#### 7.4.2 `goldFightExponent` em passos de cerca de 0,035

Base: `goldFightExponent` 1.375, `fightNoiseBase` 0.255, `conversionSiegeBase` 30, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"goldFightExponent":1.3},{"goldFightExponent":1.34},{"goldFightExponent":1.375},{"goldFightExponent":1.41},{"goldFightExponent":1.45}]' 600
```

```
N=600 por ponto, cenario app

ponto {"goldFightExponent":1.3}
  durationMeanMin=32.425 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1861 | teamGoldAt10=17979 | teamGoldAt20=34320 | killsPerGame=51.182 | killLeaderAt20Wins=0.725 | goldLeaderAt20Wins=0.723 | goldLeaderAt25Wins=0.750 | killRatioWinnerLoser=2.073 | winnerBehindGoldFrac=0.033 | goldDiffWinnerLoserMean=11675 | gpmRatioWinnerLoser=1.229 | favoriteGap5Wins=0.693 | favoriteGapUnder1Wins=0.461 | firstBaronWins=0.765 | soulWins=0.819 | firstTowerWins=0.653 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.945 | goldLeaderAt15Wins=0.715 | winnerMoreKillsFrac=0.905
  FORA (4): goldLeaderAt25Wins, firstBaronWins, soulWins, favoriteGap5Wins

ponto {"goldFightExponent":1.34}
  durationMeanMin=32.222 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1856 | teamGoldAt10=17974 | teamGoldAt20=34330 | killsPerGame=50.788 | killLeaderAt20Wins=0.730 | goldLeaderAt20Wins=0.731 | goldLeaderAt25Wins=0.759 | killRatioWinnerLoser=2.132 | winnerBehindGoldFrac=0.028 | goldDiffWinnerLoserMean=12032 | gpmRatioWinnerLoser=1.239 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.467 | firstBaronWins=0.767 | soulWins=0.835 | firstTowerWins=0.653 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.818 | goldLeaderAt15Wins=0.713 | winnerMoreKillsFrac=0.905
  FORA (4): goldLeaderAt25Wins, firstBaronWins, soulWins, favoriteGap5Wins

ponto {"goldFightExponent":1.375}
  durationMeanMin=32.067 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1854 | teamGoldAt10=17974 | teamGoldAt20=34377 | killsPerGame=50.550 | killLeaderAt20Wins=0.721 | goldLeaderAt20Wins=0.730 | goldLeaderAt25Wins=0.783 | killRatioWinnerLoser=2.166 | winnerBehindGoldFrac=0.030 | goldDiffWinnerLoserMean=12093 | gpmRatioWinnerLoser=1.242 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.461 | firstBaronWins=0.783 | soulWins=0.841 | firstTowerWins=0.657 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.778 | goldLeaderAt15Wins=0.710 | winnerMoreKillsFrac=0.908
  FORA (1): favoriteGap5Wins

ponto {"goldFightExponent":1.41}
  durationMeanMin=31.965 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1852 | teamGoldAt10=17963 | teamGoldAt20=34437 | killsPerGame=50.268 | killLeaderAt20Wins=0.745 | goldLeaderAt20Wins=0.751 | goldLeaderAt25Wins=0.795 | killRatioWinnerLoser=2.247 | winnerBehindGoldFrac=0.020 | goldDiffWinnerLoserMean=12424 | gpmRatioWinnerLoser=1.250 | favoriteGap5Wins=0.640 | favoriteGapUnder1Wins=0.455 | firstBaronWins=0.790 | soulWins=0.841 | firstTowerWins=0.668 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.673 | goldLeaderAt15Wins=0.720 | winnerMoreKillsFrac=0.918
  FORA (1): favoriteGap5Wins

ponto {"goldFightExponent":1.45}
  durationMeanMin=31.755 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1847 | teamGoldAt10=17952 | teamGoldAt20=34438 | killsPerGame=49.870 | killLeaderAt20Wins=0.763 | goldLeaderAt20Wins=0.763 | goldLeaderAt25Wins=0.807 | killRatioWinnerLoser=2.308 | winnerBehindGoldFrac=0.028 | goldDiffWinnerLoserMean=12635 | gpmRatioWinnerLoser=1.257 | favoriteGap5Wins=0.640 | favoriteGapUnder1Wins=0.449 | firstBaronWins=0.805 | soulWins=0.850 | firstTowerWins=0.670 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.512 | goldLeaderAt15Wins=0.727 | winnerMoreKillsFrac=0.917
  FORA (2): favoriteGap5Wins, favoriteGapUnder1Wins
```

| goldFightExponent | duracao (min) | bandas fora | soma fora | soma fora sem fav >= 5 |
|---|---|---|---|---|
| 1.3 | 32.425 | 4 | 1.053 | 0.483 |
| 1.34 | 32.222 | 4 | 1.075 | 0.245 |
| 1.375 (vigente) | 32.067 | 1 | 0.830 | 0.000 |
| 1.41 | 31.965 | 1 | 1.100 | 0.000 |
| 1.45 | 31.755 | 2 | 1.110 | 0.010 |

Empate em 1 fora entre 1.375 e 1.41, so no favorito gap >= 5: item 4, no N=1500.

Base: `goldFightExponent` 1.375, `fightNoiseBase` 0.255, `conversionSiegeBase` 30, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"goldFightExponent":1.41}]' 1500
```

```
N=1500 por ponto, cenario app

ponto {"goldFightExponent":1.41}
  durationMeanMin=31.829 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1849 | teamGoldAt10=17973 | teamGoldAt20=34399 | killsPerGame=50.048 | killLeaderAt20Wins=0.762 | goldLeaderAt20Wins=0.769 | goldLeaderAt25Wins=0.813 | killRatioWinnerLoser=2.305 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=12523 | gpmRatioWinnerLoser=1.253 | favoriteGap5Wins=0.629 | favoriteGapUnder1Wins=0.498 | firstBaronWins=0.789 | soulWins=0.851 | firstTowerWins=0.652 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=10.565 | goldLeaderAt15Wins=0.729 | winnerMoreKillsFrac=0.927
  FORA (1): favoriteGap5Wins
```

Margem minima no N=1500: 1.41 tem 0,050 (GPM venc/perd 1,253); o vigente 1.375 tem 0,075 (gate da
7.4.1). **Escolha: 1.375 fica.**

#### 7.4.3 `fightNoiseChaosCoef` (ruling 1)

No cenario `app` o caos efetivo e cerca de 0,267 (slider 0,25 mais a volatilidade media), entao
0,06 de coeficiente equivale a cerca de 0,016 de `fightNoiseBase`. O coeficiente tambem define
quanto o slider de Caos abre a luta fora do padrao.

Base: `goldFightExponent` 1.375, `fightNoiseBase` 0.255, `conversionSiegeBase` 30, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"fightNoiseChaosCoef":0.36},{"fightNoiseChaosCoef":0.42},{"fightNoiseChaosCoef":0.48},{"fightNoiseChaosCoef":0.54},{"fightNoiseChaosCoef":0.60}]' 600
```

```
N=600 por ponto, cenario app

ponto {"fightNoiseChaosCoef":0.36}
  durationMeanMin=31.772 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1847 | teamGoldAt10=17957 | teamGoldAt20=34419 | killsPerGame=49.635 | killLeaderAt20Wins=0.749 | goldLeaderAt20Wins=0.758 | goldLeaderAt25Wins=0.804 | killRatioWinnerLoser=2.325 | winnerBehindGoldFrac=0.030 | goldDiffWinnerLoserMean=12740 | gpmRatioWinnerLoser=1.259 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.461 | firstBaronWins=0.805 | soulWins=0.853 | firstTowerWins=0.683 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.540 | goldLeaderAt15Wins=0.737 | winnerMoreKillsFrac=0.937
  FORA (1): favoriteGap5Wins

ponto {"fightNoiseChaosCoef":0.42}
  durationMeanMin=31.825 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=17969 | teamGoldAt20=34450 | killsPerGame=50.078 | killLeaderAt20Wins=0.741 | goldLeaderAt20Wins=0.765 | goldLeaderAt25Wins=0.807 | killRatioWinnerLoser=2.262 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=12618 | gpmRatioWinnerLoser=1.255 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.473 | firstBaronWins=0.807 | soulWins=0.841 | firstTowerWins=0.668 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.633 | goldLeaderAt15Wins=0.722 | winnerMoreKillsFrac=0.923
  FORA (1): favoriteGap5Wins

ponto {"fightNoiseChaosCoef":0.48}
  durationMeanMin=32.067 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1854 | teamGoldAt10=17974 | teamGoldAt20=34377 | killsPerGame=50.550 | killLeaderAt20Wins=0.721 | goldLeaderAt20Wins=0.730 | goldLeaderAt25Wins=0.783 | killRatioWinnerLoser=2.166 | winnerBehindGoldFrac=0.030 | goldDiffWinnerLoserMean=12093 | gpmRatioWinnerLoser=1.242 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.461 | firstBaronWins=0.783 | soulWins=0.841 | firstTowerWins=0.657 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.778 | goldLeaderAt15Wins=0.710 | winnerMoreKillsFrac=0.908
  FORA (1): favoriteGap5Wins

ponto {"fightNoiseChaosCoef":0.54}
  durationMeanMin=32.103 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1857 | teamGoldAt10=17969 | teamGoldAt20=34386 | killsPerGame=50.572 | killLeaderAt20Wins=0.734 | goldLeaderAt20Wins=0.725 | goldLeaderAt25Wins=0.770 | killRatioWinnerLoser=2.134 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=11945 | gpmRatioWinnerLoser=1.237 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.491 | firstBaronWins=0.765 | soulWins=0.836 | firstTowerWins=0.660 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.787 | goldLeaderAt15Wins=0.720 | winnerMoreKillsFrac=0.920
  FORA (4): goldLeaderAt25Wins, firstBaronWins, soulWins, favoriteGap5Wins

ponto {"fightNoiseChaosCoef":0.6}
  durationMeanMin=32.107 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1860 | teamGoldAt10=17973 | teamGoldAt20=34363 | killsPerGame=50.738 | killLeaderAt20Wins=0.734 | goldLeaderAt20Wins=0.736 | goldLeaderAt25Wins=0.783 | killRatioWinnerLoser=2.136 | winnerBehindGoldFrac=0.020 | goldDiffWinnerLoserMean=11910 | gpmRatioWinnerLoser=1.235 | favoriteGap5Wins=0.640 | favoriteGapUnder1Wins=0.479 | firstBaronWins=0.772 | soulWins=0.811 | firstTowerWins=0.648 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.763 | goldLeaderAt15Wins=0.717 | winnerMoreKillsFrac=0.927
  FORA (3): firstBaronWins, soulWins, favoriteGap5Wins
```

| fightNoiseChaosCoef | duracao (min) | bandas fora | soma fora | soma fora sem fav >= 5 |
|---|---|---|---|---|
| 0.36 | 31.772 | 1 | 0.830 | 0.000 |
| 0.42 | 31.825 | 1 | 0.700 | 0.000 |
| 0.48 (vigente) | 32.067 | 1 | 0.830 | 0.000 |
| 0.54 | 32.103 | 4 | 0.991 | 0.161 |
| 0.60 | 32.107 | 3 | 1.430 | 0.330 |

Empate em 1 fora entre 0.36, 0.42 e 0.48, so no favorito gap >= 5: item 4, no N=1500.

Base: `goldFightExponent` 1.375, `fightNoiseBase` 0.255, `conversionSiegeBase` 30, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"fightNoiseChaosCoef":0.36},{"fightNoiseChaosCoef":0.42}]' 1500
```

```
N=1500 por ponto, cenario app

ponto {"fightNoiseChaosCoef":0.36}
  durationMeanMin=31.689 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1847 | teamGoldAt10=17973 | teamGoldAt20=34418 | killsPerGame=49.415 | killLeaderAt20Wins=0.768 | goldLeaderAt20Wins=0.771 | goldLeaderAt25Wins=0.831 | killRatioWinnerLoser=2.359 | winnerBehindGoldFrac=0.024 | goldDiffWinnerLoserMean=12723 | gpmRatioWinnerLoser=1.259 | favoriteGap5Wins=0.646 | favoriteGapUnder1Wins=0.483 | firstBaronWins=0.807 | soulWins=0.857 | firstTowerWins=0.663 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.447 | goldLeaderAt15Wins=0.739 | winnerMoreKillsFrac=0.938
  FORA (1): favoriteGap5Wins

ponto {"fightNoiseChaosCoef":0.42}
  durationMeanMin=31.735 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1848 | teamGoldAt10=17978 | teamGoldAt20=34429 | killsPerGame=49.737 | killLeaderAt20Wins=0.763 | goldLeaderAt20Wins=0.778 | goldLeaderAt25Wins=0.827 | killRatioWinnerLoser=2.315 | winnerBehindGoldFrac=0.021 | goldDiffWinnerLoserMean=12647 | gpmRatioWinnerLoser=1.256 | favoriteGap5Wins=0.669 | favoriteGapUnder1Wins=0.500 | firstBaronWins=0.805 | soulWins=0.848 | firstTowerWins=0.659 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.509 | goldLeaderAt15Wins=0.729 | winnerMoreKillsFrac=0.933
  FORA (1): favoriteGap5Wins
```

Margem minima no N=1500: 0.36 tem 0,007 (GPM venc/perd 1,259), 0.42 tem 0,029 (GPM venc/perd
1,256), o vigente 0.48 tem 0,075. **Escolha: 0.48 fica** (o valor de partida da spec).

#### 7.4.4 `objectiveBountyMinDeficit` (ruling 1)

Base: `goldFightExponent` 1.375, `fightNoiseBase` 0.255, `conversionSiegeBase` 30, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"objectiveBountyMinDeficit":750},{"objectiveBountyMinDeficit":1000},{"objectiveBountyMinDeficit":1500},{"objectiveBountyMinDeficit":2500},{"objectiveBountyMinDeficit":4000}]' 600
```

```
N=600 por ponto, cenario app

ponto {"objectiveBountyMinDeficit":750}
  durationMeanMin=32.179 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1856 | teamGoldAt10=17984 | teamGoldAt20=34378 | killsPerGame=50.713 | killLeaderAt20Wins=0.712 | goldLeaderAt20Wins=0.718 | goldLeaderAt25Wins=0.780 | killRatioWinnerLoser=2.145 | winnerBehindGoldFrac=0.028 | goldDiffWinnerLoserMean=12051 | gpmRatioWinnerLoser=1.240 | favoriteGap5Wins=0.653 | favoriteGapUnder1Wins=0.443 | firstBaronWins=0.775 | soulWins=0.841 | firstTowerWins=0.662 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.820 | goldLeaderAt15Wins=0.702 | winnerMoreKillsFrac=0.905
  FORA (4): goldLeaderAt20Wins, firstBaronWins, favoriteGap5Wins, favoriteGapUnder1Wins

ponto {"objectiveBountyMinDeficit":1000}
  durationMeanMin=32.149 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1855 | teamGoldAt10=17981 | teamGoldAt20=34384 | killsPerGame=50.683 | killLeaderAt20Wins=0.716 | goldLeaderAt20Wins=0.725 | goldLeaderAt25Wins=0.784 | killRatioWinnerLoser=2.153 | winnerBehindGoldFrac=0.030 | goldDiffWinnerLoserMean=12072 | gpmRatioWinnerLoser=1.241 | favoriteGap5Wins=0.653 | favoriteGapUnder1Wins=0.455 | firstBaronWins=0.775 | soulWins=0.846 | firstTowerWins=0.662 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.810 | goldLeaderAt15Wins=0.702 | winnerMoreKillsFrac=0.907
  FORA (2): firstBaronWins, favoriteGap5Wins

ponto {"objectiveBountyMinDeficit":1500}
  durationMeanMin=32.067 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1854 | teamGoldAt10=17974 | teamGoldAt20=34377 | killsPerGame=50.550 | killLeaderAt20Wins=0.721 | goldLeaderAt20Wins=0.730 | goldLeaderAt25Wins=0.783 | killRatioWinnerLoser=2.166 | winnerBehindGoldFrac=0.030 | goldDiffWinnerLoserMean=12093 | gpmRatioWinnerLoser=1.242 | favoriteGap5Wins=0.667 | favoriteGapUnder1Wins=0.461 | firstBaronWins=0.783 | soulWins=0.841 | firstTowerWins=0.657 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.778 | goldLeaderAt15Wins=0.710 | winnerMoreKillsFrac=0.908
  FORA (1): favoriteGap5Wins

ponto {"objectiveBountyMinDeficit":2500}
  durationMeanMin=32.067 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1852 | teamGoldAt10=17957 | teamGoldAt20=34345 | killsPerGame=50.403 | killLeaderAt20Wins=0.753 | goldLeaderAt20Wins=0.747 | goldLeaderAt25Wins=0.799 | killRatioWinnerLoser=2.225 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=12295 | gpmRatioWinnerLoser=1.246 | favoriteGap5Wins=0.627 | favoriteGapUnder1Wins=0.461 | firstBaronWins=0.782 | soulWins=0.852 | firstTowerWins=0.668 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.768 | goldLeaderAt15Wins=0.723 | winnerMoreKillsFrac=0.932
  FORA (1): favoriteGap5Wins

ponto {"objectiveBountyMinDeficit":4000}
  durationMeanMin=31.856 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1846 | teamGoldAt10=17949 | teamGoldAt20=34294 | killsPerGame=50.053 | killLeaderAt20Wins=0.757 | goldLeaderAt20Wins=0.762 | goldLeaderAt25Wins=0.815 | killRatioWinnerLoser=2.275 | winnerBehindGoldFrac=0.015 | goldDiffWinnerLoserMean=12639 | gpmRatioWinnerLoser=1.255 | favoriteGap5Wins=0.653 | favoriteGapUnder1Wins=0.455 | firstBaronWins=0.778 | soulWins=0.850 | firstTowerWins=0.673 | firstTowerMedianSec=600 | stealFraction=0.017 | towersPerGame=10.607 | goldLeaderAt15Wins=0.730 | winnerMoreKillsFrac=0.928
  FORA (2): firstBaronWins, favoriteGap5Wins
```

| objectiveBountyMinDeficit | duracao (min) | bandas fora | soma fora | soma fora sem fav >= 5 |
|---|---|---|---|---|
| 750 | 32.179 | 4 | 1.098 | 0.128 |
| 1000 | 32.149 | 2 | 1.012 | 0.042 |
| 1500 (vigente) | 32.067 | 1 | 0.830 | 0.000 |
| 2500 | 32.067 | 1 | 1.230 | 0.000 |
| 4000 | 31.856 | 2 | 0.987 | 0.017 |

Empate em 1 fora entre 1500 e 2500, so no favorito gap >= 5: item 4, no N=1500.

Base: `goldFightExponent` 1.375, `fightNoiseBase` 0.255, `conversionSiegeBase` 30, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"objectiveBountyMinDeficit":2500}]' 1500
```

```
N=1500 por ponto, cenario app

ponto {"objectiveBountyMinDeficit":2500}
  durationMeanMin=31.857 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1849 | teamGoldAt10=17963 | teamGoldAt20=34346 | killsPerGame=50.076 | killLeaderAt20Wins=0.767 | goldLeaderAt20Wins=0.769 | goldLeaderAt25Wins=0.813 | killRatioWinnerLoser=2.295 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=12514 | gpmRatioWinnerLoser=1.252 | favoriteGap5Wins=0.601 | favoriteGapUnder1Wins=0.490 | firstBaronWins=0.785 | soulWins=0.859 | firstTowerWins=0.649 | firstTowerMedianSec=585 | stealFraction=0.019 | towersPerGame=10.580 | goldLeaderAt15Wins=0.733 | winnerMoreKillsFrac=0.935
  FORA (1): favoriteGap5Wins
```

Margem minima no N=1500: 2500 tem 0,042 (1o Barao 0,785); o vigente 1500 tem 0,075. **Escolha: 1500
fica.**

Passada 3 completa sem banda nova no gate (segue so o favorito gap >= 5 fora, com as tres travas e
as outras 18 bandas dentro). Passadas 2 e 3 sem banda nova: a regra de parada do Step 3 dispara
(secao 8).

### 7.5 Exploracao informativa do favorito gap >= 5 (N=1500, sem uso na escolha)

Para saber se alguma alavanca permitida move o favorito gap >= 5 alem do ruido, rodei pontos
extremos no N=1500 a partir do ponto da 7.2.3 (`fightNoiseBase` 0.24, `goldFightExponent` 1.375,
`conversionSiegeBase` 30). Cada ponto muda so os campos listados; alguns campos sao alavancas de
outras linhas da tabela e entram aqui so como medida.

Base: `goldFightExponent` 1.375, `fightNoiseBase` 0.24, `conversionSiegeBase` 30, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{},{"fightNoiseBase":0.02},{"fightNoiseBase":0.12},{"goldFightExponent":1.0},{"goldFightExponent":2.0},{"objectiveBountyFraction":0},{"objectiveBountyFraction":0.15},{"passiveSlopePerMin":5},{"passiveBasePerMin":300},{"conversionSiegeBase":45},{"contestBaseEpic":0.4}]' 1500
```

```
N=1500 por ponto, cenario app

ponto {}
  durationMeanMin=31.746 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1849 | teamGoldAt10=17977 | teamGoldAt20=34427 | killsPerGame=49.765 | killLeaderAt20Wins=0.761 | goldLeaderAt20Wins=0.775 | goldLeaderAt25Wins=0.826 | killRatioWinnerLoser=2.307 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=12585 | gpmRatioWinnerLoser=1.254 | favoriteGap5Wins=0.674 | favoriteGapUnder1Wins=0.507 | firstBaronWins=0.802 | soulWins=0.846 | firstTowerWins=0.660 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.521 | goldLeaderAt15Wins=0.729 | winnerMoreKillsFrac=0.933
  FORA (1): favoriteGap5Wins

ponto {"fightNoiseBase":0.02}
  durationMeanMin=30.266 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1809 | teamGoldAt10=17953 | teamGoldAt20=34297 | killsPerGame=46.383 | killLeaderAt20Wins=0.871 | goldLeaderAt20Wins=0.873 | goldLeaderAt25Wins=0.907 | killRatioWinnerLoser=3.394 | winnerBehindGoldFrac=0.004 | goldDiffWinnerLoserMean=15399 | gpmRatioWinnerLoser=1.341 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.517 | firstBaronWins=0.891 | soulWins=0.938 | firstTowerWins=0.750 | firstTowerMedianSec=600 | stealFraction=0.022 | towersPerGame=9.472 | goldLeaderAt15Wins=0.852 | winnerMoreKillsFrac=0.977
  FORA (8): killLeaderAt20Wins, goldLeaderAt15Wins, goldLeaderAt20Wins, goldLeaderAt25Wins, killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"fightNoiseBase":0.12}
  durationMeanMin=31.168 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1829 | teamGoldAt10=17977 | teamGoldAt20=34365 | killsPerGame=48.031 | killLeaderAt20Wins=0.814 | goldLeaderAt20Wins=0.822 | goldLeaderAt25Wins=0.865 | killRatioWinnerLoser=2.735 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=13903 | gpmRatioWinnerLoser=1.294 | favoriteGap5Wins=0.657 | favoriteGapUnder1Wins=0.519 | firstBaronWins=0.840 | soulWins=0.880 | firstTowerWins=0.711 | firstTowerMedianSec=600 | stealFraction=0.020 | towersPerGame=10.029 | goldLeaderAt15Wins=0.792 | winnerMoreKillsFrac=0.939
  FORA (5): goldLeaderAt15Wins, killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"goldFightExponent":1}
  durationMeanMin=33.280 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1874 | teamGoldAt10=17996 | teamGoldAt20=34441 | killsPerGame=51.968 | killLeaderAt20Wins=0.702 | goldLeaderAt20Wins=0.703 | goldLeaderAt25Wins=0.757 | killRatioWinnerLoser=1.861 | winnerBehindGoldFrac=0.043 | goldDiffWinnerLoserMean=10404 | gpmRatioWinnerLoser=1.195 | favoriteGap5Wins=0.590 | favoriteGapUnder1Wins=0.493 | firstBaronWins=0.730 | soulWins=0.798 | firstTowerWins=0.607 | firstTowerMedianSec=600 | stealFraction=0.021 | towersPerGame=11.252 | goldLeaderAt15Wins=0.669 | winnerMoreKillsFrac=0.897
  FORA (6): goldLeaderAt20Wins, goldLeaderAt25Wins, firstBaronWins, soulWins, firstTowerWins, favoriteGap5Wins

ponto {"goldFightExponent":2}
  durationMeanMin=29.801 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1810 | teamGoldAt10=17954 | teamGoldAt20=34334 | killsPerGame=47.067 | killLeaderAt20Wins=0.861 | goldLeaderAt20Wins=0.858 | goldLeaderAt25Wins=0.924 | killRatioWinnerLoser=3.461 | winnerBehindGoldFrac=0.003 | goldDiffWinnerLoserMean=15449 | gpmRatioWinnerLoser=1.348 | favoriteGap5Wins=0.640 | favoriteGapUnder1Wins=0.495 | firstBaronWins=0.884 | soulWins=0.870 | firstTowerWins=0.741 | firstTowerMedianSec=585 | stealFraction=0.016 | towersPerGame=9.588 | goldLeaderAt15Wins=0.835 | winnerMoreKillsFrac=0.976
  FORA (8): killLeaderAt20Wins, goldLeaderAt15Wins, goldLeaderAt20Wins, goldLeaderAt25Wins, killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"objectiveBountyFraction":0}
  durationMeanMin=31.245 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1829 | teamGoldAt10=17949 | teamGoldAt20=34242 | killsPerGame=48.897 | killLeaderAt20Wins=0.803 | goldLeaderAt20Wins=0.815 | goldLeaderAt25Wins=0.850 | killRatioWinnerLoser=2.527 | winnerBehindGoldFrac=0.021 | goldDiffWinnerLoserMean=13759 | gpmRatioWinnerLoser=1.288 | favoriteGap5Wins=0.669 | favoriteGapUnder1Wins=0.507 | firstBaronWins=0.813 | soulWins=0.857 | firstTowerWins=0.687 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.254 | goldLeaderAt15Wins=0.772 | winnerMoreKillsFrac=0.948
  FORA (3): goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"objectiveBountyFraction":0.15}
  durationMeanMin=32.307 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1878 | teamGoldAt10=18027 | teamGoldAt20=34701 | killsPerGame=50.673 | killLeaderAt20Wins=0.716 | goldLeaderAt20Wins=0.745 | goldLeaderAt25Wins=0.793 | killRatioWinnerLoser=2.101 | winnerBehindGoldFrac=0.027 | goldDiffWinnerLoserMean=11233 | gpmRatioWinnerLoser=1.218 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.488 | firstBaronWins=0.764 | soulWins=0.817 | firstTowerWins=0.635 | firstTowerMedianSec=600 | stealFraction=0.019 | towersPerGame=10.771 | goldLeaderAt15Wins=0.696 | winnerMoreKillsFrac=0.909
  FORA (3): firstBaronWins, soulWins, favoriteGap5Wins

ponto {"passiveSlopePerMin":5}
  durationMeanMin=32.107 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=2034 | teamGoldAt10=18596 | teamGoldAt20=36675 | killsPerGame=50.377 | killLeaderAt20Wins=0.747 | goldLeaderAt20Wins=0.765 | goldLeaderAt25Wins=0.815 | killRatioWinnerLoser=2.215 | winnerBehindGoldFrac=0.027 | goldDiffWinnerLoserMean=13146 | gpmRatioWinnerLoser=1.238 | favoriteGap5Wins=0.680 | favoriteGapUnder1Wins=0.512 | firstBaronWins=0.787 | soulWins=0.833 | firstTowerWins=0.654 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.688 | goldLeaderAt15Wins=0.720 | winnerMoreKillsFrac=0.921
  FORA (3): goldDiffWinnerLoserMean, soulWins, favoriteGap5Wins

ponto {"passiveBasePerMin":300}
  durationMeanMin=32.497 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=2138 | teamGoldAt10=20923 | teamGoldAt20=40019 | killsPerGame=50.791 | killLeaderAt20Wins=0.745 | goldLeaderAt20Wins=0.751 | goldLeaderAt25Wins=0.792 | killRatioWinnerLoser=2.105 | winnerBehindGoldFrac=0.026 | goldDiffWinnerLoserMean=12566 | gpmRatioWinnerLoser=1.213 | favoriteGap5Wins=0.652 | favoriteGapUnder1Wins=0.498 | firstBaronWins=0.762 | soulWins=0.825 | firstTowerWins=0.651 | firstTowerMedianSec=600 | stealFraction=0.019 | towersPerGame=10.872 | goldLeaderAt15Wins=0.717 | winnerMoreKillsFrac=0.919
  FORA (4): gpmTeamMean, firstBaronWins, soulWins, favoriteGap5Wins

ponto {"conversionSiegeBase":45}
  durationMeanMin=28.892 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=18006 | teamGoldAt20=34733 | killsPerGame=42.857 | killLeaderAt20Wins=0.761 | goldLeaderAt20Wins=0.771 | goldLeaderAt25Wins=0.810 | killRatioWinnerLoser=2.158 | winnerBehindGoldFrac=0.036 | goldDiffWinnerLoserMean=10168 | gpmRatioWinnerLoser=1.221 | favoriteGap5Wins=0.635 | favoriteGapUnder1Wins=0.502 | firstBaronWins=0.802 | soulWins=0.841 | firstTowerWins=0.671 | firstTowerMedianSec=570 | stealFraction=0.020 | towersPerGame=10.671 | goldLeaderAt15Wins=0.743 | winnerMoreKillsFrac=0.914
  FORA (2): durationMeanMin, favoriteGap5Wins

ponto {"contestBaseEpic":0.4}
  durationMeanMin=31.977 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1849 | teamGoldAt10=17977 | teamGoldAt20=34406 | killsPerGame=49.558 | killLeaderAt20Wins=0.760 | goldLeaderAt20Wins=0.773 | goldLeaderAt25Wins=0.831 | killRatioWinnerLoser=2.283 | winnerBehindGoldFrac=0.025 | goldDiffWinnerLoserMean=12376 | gpmRatioWinnerLoser=1.249 | favoriteGap5Wins=0.691 | favoriteGapUnder1Wins=0.505 | firstBaronWins=0.793 | soulWins=0.839 | firstTowerWins=0.667 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.607 | goldLeaderAt15Wins=0.734 | winnerMoreKillsFrac=0.927
  FORA (2): soulWins, favoriteGap5Wins
```

Base: `goldFightExponent` 1.375, `fightNoiseBase` 0.24, `conversionSiegeBase` 30, `ratingPowerD` 525 (padrao vigente quando rodou; o campo varrido prevalece).

```
npx tsx scripts/sweep-realism.ts '[{"fightNoiseBase":0.02,"fightNoiseChaosCoef":0},{"fightNoiseBase":0.02,"fightNoiseChaosCoef":0,"goldFightExponent":0.75},{"fightNoiseBase":0.40},{"fightNoiseChaosCoef":0.8},{"objectiveBountyMinDeficit":500},{"objectiveBountyMinDeficit":5000}]' 1500
```

```
N=1500 por ponto, cenario app

ponto {"fightNoiseBase":0.02,"fightNoiseChaosCoef":0}
  durationMeanMin=29.267 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1794 | teamGoldAt10=17917 | teamGoldAt20=34190 | killsPerGame=44.734 | killLeaderAt20Wins=0.950 | goldLeaderAt20Wins=0.947 | goldLeaderAt25Wins=0.970 | killRatioWinnerLoser=4.186 | winnerBehindGoldFrac=0.001 | goldDiffWinnerLoserMean=16371 | gpmRatioWinnerLoser=1.375 | favoriteGap5Wins=0.657 | favoriteGapUnder1Wins=0.500 | firstBaronWins=0.943 | soulWins=0.964 | firstTowerWins=0.777 | firstTowerMedianSec=600 | stealFraction=0.023 | towersPerGame=8.953 | goldLeaderAt15Wins=0.935 | winnerMoreKillsFrac=0.992
  FORA (11): killLeaderAt20Wins, goldLeaderAt15Wins, goldLeaderAt20Wins, goldLeaderAt25Wins, killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, firstBaronWins, soulWins, firstTowerWins, favoriteGap5Wins

ponto {"fightNoiseBase":0.02,"fightNoiseChaosCoef":0,"goldFightExponent":0.75}
  durationMeanMin=32.224 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1825 | teamGoldAt10=17881 | teamGoldAt20=34016 | killsPerGame=46.085 | killLeaderAt20Wins=0.817 | goldLeaderAt20Wins=0.820 | goldLeaderAt25Wins=0.868 | killRatioWinnerLoser=2.606 | winnerBehindGoldFrac=0.009 | goldDiffWinnerLoserMean=13536 | gpmRatioWinnerLoser=1.273 | favoriteGap5Wins=0.702 | favoriteGapUnder1Wins=0.543 | firstBaronWins=0.851 | soulWins=0.947 | firstTowerWins=0.691 | firstTowerMedianSec=600 | stealFraction=0.029 | towersPerGame=9.935 | goldLeaderAt15Wins=0.790 | winnerMoreKillsFrac=0.951
  FORA (5): goldLeaderAt15Wins, killRatioWinnerLoser, goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins

ponto {"fightNoiseBase":0.4}
  durationMeanMin=32.350 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1872 | teamGoldAt10=17973 | teamGoldAt20=34414 | killsPerGame=52.103 | killLeaderAt20Wins=0.718 | goldLeaderAt20Wins=0.730 | goldLeaderAt25Wins=0.794 | killRatioWinnerLoser=1.990 | winnerBehindGoldFrac=0.041 | goldDiffWinnerLoserMean=11133 | gpmRatioWinnerLoser=1.215 | favoriteGap5Wins=0.657 | favoriteGapUnder1Wins=0.529 | firstBaronWins=0.752 | soulWins=0.794 | firstTowerWins=0.641 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=11.153 | goldLeaderAt15Wins=0.696 | winnerMoreKillsFrac=0.891
  FORA (3): firstBaronWins, soulWins, favoriteGap5Wins

ponto {"fightNoiseChaosCoef":0.8}
  durationMeanMin=32.027 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1862 | teamGoldAt10=17973 | teamGoldAt20=34403 | killsPerGame=51.002 | killLeaderAt20Wins=0.734 | goldLeaderAt20Wins=0.743 | goldLeaderAt25Wins=0.812 | killRatioWinnerLoser=2.118 | winnerBehindGoldFrac=0.028 | goldDiffWinnerLoserMean=11769 | gpmRatioWinnerLoser=1.232 | favoriteGap5Wins=0.685 | favoriteGapUnder1Wins=0.493 | firstBaronWins=0.771 | soulWins=0.805 | firstTowerWins=0.650 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=10.843 | goldLeaderAt15Wins=0.711 | winnerMoreKillsFrac=0.915
  FORA (3): firstBaronWins, soulWins, favoriteGap5Wins

ponto {"objectiveBountyMinDeficit":500}
  durationMeanMin=31.840 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1851 | teamGoldAt10=17988 | teamGoldAt20=34435 | killsPerGame=49.920 | killLeaderAt20Wins=0.749 | goldLeaderAt20Wins=0.762 | goldLeaderAt25Wins=0.821 | killRatioWinnerLoser=2.280 | winnerBehindGoldFrac=0.020 | goldDiffWinnerLoserMean=12498 | gpmRatioWinnerLoser=1.252 | favoriteGap5Wins=0.674 | favoriteGapUnder1Wins=0.514 | firstBaronWins=0.800 | soulWins=0.847 | firstTowerWins=0.659 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.563 | goldLeaderAt15Wins=0.718 | winnerMoreKillsFrac=0.930
  FORA (1): favoriteGap5Wins

ponto {"objectiveBountyMinDeficit":5000}
  durationMeanMin=31.462 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1838 | teamGoldAt10=17950 | teamGoldAt20=34298 | killsPerGame=49.176 | killLeaderAt20Wins=0.789 | goldLeaderAt20Wins=0.797 | goldLeaderAt25Wins=0.836 | killRatioWinnerLoser=2.432 | winnerBehindGoldFrac=0.021 | goldDiffWinnerLoserMean=13129 | gpmRatioWinnerLoser=1.270 | favoriteGap5Wins=0.652 | favoriteGapUnder1Wins=0.517 | firstBaronWins=0.804 | soulWins=0.854 | firstTowerWins=0.670 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.341 | goldLeaderAt15Wins=0.759 | winnerMoreKillsFrac=0.941
  FORA (3): goldDiffWinnerLoserMean, gpmRatioWinnerLoser, favoriteGap5Wins
```

Resumo do favorito gap >= 5 (N=1500, 178 partidas):

| ponto | favoriteGap5Wins | bandas fora |
|---|---|---|
| ponto da 7.2.3 | 0.674 | 1 |
| fightNoiseBase 0.02 | 0.680 | 8 |
| fightNoiseBase 0.12 | 0.657 | 5 |
| fightNoiseBase 0.40 | 0.657 | 3 |
| fightNoiseBase 0.02, coef 0 (sorteio de +-2%) | 0.657 | 11 |
| fightNoiseBase 0.02, coef 0, goldFightExponent 0.75 | 0.702 | 5 |
| fightNoiseChaosCoef 0.8 | 0.685 | 3 |
| goldFightExponent 1.0 | 0.590 | 6 |
| goldFightExponent 2.0 | 0.640 | 8 |
| objectiveBountyFraction 0 | 0.669 | 3 |
| objectiveBountyFraction 0.15 | 0.680 | 3 |
| objectiveBountyMinDeficit 500 | 0.674 | 1 |
| objectiveBountyMinDeficit 5000 | 0.652 | 3 |
| passiveSlopePerMin 5 | 0.680 | 3 |
| passiveBasePerMin 300 | 0.652 | 4 |
| conversionSiegeBase 45 | 0.635 | 2 |
| contestBaseEpic 0.4 | 0.691 | 2 |

Sao 16 variantes em volta do ponto da 7.2.3 (17 linhas com ele), movendo 9 campos de
`RealismTuning`: `fightNoiseBase`, `fightNoiseChaosCoef`, `goldFightExponent`,
`objectiveBountyFraction`, `objectiveBountyMinDeficit`, `passiveSlopePerMin`, `passiveBasePerMin`,
`conversionSiegeBase` e `contestBaseEpic` (alguns em extremos muito fora da regiao util: sorteio de
+-2%, expoente 0,75 ou 2,0, recompensa desligada). `objectiveBountyCap`, `contestBaseDragon`,
`contestBaseMinor` e `siegeAccrualBase` nao foram mexidos em nenhum ponto da Task 8, nem aqui nem
nas passadas (e `fullBuild*` fica fora por regra). Nas 17 linhas o favorito gap >= 5 fica em
[0,590; 0,702] e nunca chega a 0,75. Nenhuma alavanca testada moveu a banda de forma distinguivel
do ruido (desvio padrao de cerca de 0,034 no N=1500, 178 partidas): o maior valor, 0,702, veio do
ponto com expoente 0,75 e sorteio zerado (+-2%), que tem outras 4 bandas fora, e o menor, 0,590, do
expoente 1,0, a cerca de 1,8 desvio padrao da diferenca abaixo do ponto da 7.2.3.

Taxa de vitoria do favorito por faixa de gap no ponto da 7.6 (Base `goldFightExponent` 1.375,
`fightNoiseBase` 0.255, `conversionSiegeBase` 30, `ratingPowerD` 525; N=1500; gap = rating medio do
roster user menos o do rival, como na metrica):

```
N 1500 gap>=5 178 gap<1 431 mean|gap| ge5 6.331086142322098 max 10.26666666666668
gap [0,1) n=420 favWins=0.505
gap [1,2) n=370 favWins=0.516
gap [2,3) n=260 favWins=0.596
gap [3,4) n=169 favWins=0.621
gap [4,5) n=92 favWins=0.598
gap [5,6) n=79 favWins=0.671
gap [6,8) n=86 favWins=0.558
gap [8,10) n=12 favWins=0.667
gap [10,15) n=1 favWins=1.000
gap [15,99) n=0 favWins=NaN
```

Leitura: o motor da ao favorito cerca de 0,50 com gap < 2, cerca de 0,60 com gap 2 a 5 e entre 0,56
e 0,67 com gap 5 a 10 (media do grupo gap >= 5: 6,33). A curva alvo declarada do canal de rating,
`P(gap) = 1/(1 + 10^(-gap/RATING_CURVE_D))` com `RATING_CURVE_D` 35,5 (`src/sim/power.ts`), da 0,601
no gap 6,33; a banda pede 0,75 a 0,85. Para 0,80 no gap 6,33 a mesma forma de curva precisaria de
`D` perto de 10,5. Ou seja, com `ratingPowerD` 525 o motor entrega perto do que a curva de rating
declarada pede, e a banda pede uma curva cerca de 3,4 vezes mais inclinada. A inclinacao do canal
vem de `SimConfig.ratingPowerD` (525 ate aqui), que nao e campo de `RealismTuning`; a tentativa
autorizada por ruling com esse campo esta na 7.7.

### 7.6 Ponto final do tuning (com `ratingPowerD` 525)

Esta subsecao e o fim das passadas, ainda com `ratingPowerD` 525. Depois so o `ratingPowerD` mudou:
125 no fix 1 (secao 7.7) e 140 no fix 2 (secao 7.8). Os valores de `RealismTuning` abaixo continuam os
gravados, e o gate e o relatorio com o ponto final do motor estao na 7.8.

`DEFAULT_REALISM_TUNING` gravado (mudancas em relacao ao fim da Task 7 marcadas):

| campo | fim da Task 7 | Task 8 |
|---|---|---|
| passiveBasePerMin | 240 | 240 |
| passiveSlopePerMin | 2.5 | 2.5 |
| goldFightExponent | 1.5 | **1.375** |
| fightNoiseBase | 0.16 | **0.255** |
| fightNoiseChaosCoef | 0.48 | 0.48 |
| objectiveBountyMinDeficit | 1500 | 1500 |
| objectiveBountyFraction | 0.05 | 0.05 |
| objectiveBountyCap | 2500 | 2500 |
| fullBuildStartPerPlayer | 12000 | 12000 (valor de desenho, nao varrido) |
| fullBuildEndPerPlayer | 18000 | 18000 (valor de desenho, nao varrido) |
| conversionSiegeBase | 20 | **30** |
| contestBaseEpic | 0.7 | 0.7 |
| contestBaseDragon | 0.45 | 0.45 |
| contestBaseMinor | 0.25 | 0.25 |
| siegeAccrualBase | 2.2 | 2.2 |

Gate final (`npm run calibrate:realism -- --reporter=verbose`, N=1500):

```
✓ scripts/calibrate-realism.ts > calibrate-realism > ASSERT DURO: zero violacao de regra dura 2ms
✓ scripts/calibrate-realism.ts > calibrate-realism > ASSERT DURO: mesma seed gera a mesma partida 30ms
× scripts/calibrate-realism.ts > calibrate-realism > BANDAS: travas e aceite no cenario app 8ms
```

```
[OK] duracao media (min) = 31.932 dentro da banda [29.000, 36.000], alvo 32.300
[OK] fracao no teto de 60 min = 0.000 dentro da banda [0.000, 0.005], alvo 0.000
[OK] mediana da 1a torre (s) = 600 dentro da banda [480, 1200], alvo 975
[OK] lider de abates aos 20 vence = 0.742 dentro da banda [0.700, 0.820], alvo 0.764
[OK] lider de ouro aos 15 vence = 0.714 dentro da banda [0.660, 0.780], alvo 0.716
[OK] lider de ouro aos 20 vence = 0.753 dentro da banda [0.720, 0.840], alvo 0.782
[OK] lider de ouro aos 25 vence = 0.804 dentro da banda [0.770, 0.890], alvo 0.830
[OK] abates vencedor / perdedor = 2.232 dentro da banda [1.800, 2.600], alvo 2.150
[OK] vencedor com mais abates = 0.922 dentro da banda [0.850, 1.000], alvo 0.900
[OK] vencedor atras no ouro = 0.028 dentro da banda [0.000, 0.050], alvo 0.020
[OK] ouro vencedor menos perdedor = 12291 dentro da banda [7000, 13000], alvo 10000
[OK] GPM por time = 1852 dentro da banda [1650, 2050], alvo 1833
[OK] GPM vencedor / perdedor = 1.247 dentro da banda [1.120, 1.260], alvo 1.190
[OK] time do 1o Barao vence = 0.789 dentro da banda [0.780, 0.900], alvo 0.854
[OK] time da Alma vence = 0.852 dentro da banda [0.840, 0.950], alvo 0.908
[OK] time da 1a torre vence = 0.636 dentro da banda [0.620, 0.750], alvo 0.682
[OK] roubos / objetivos tomados = 0.018 dentro da banda [0.000, 0.030], alvo 0.020
[FALHA] favorito com gap >= 5 vence = 0.618 estourou o PISO da banda [0.750, 0.850], alvo 0.800
[OK] favorito com gap < 1 vence = 0.505 dentro da banda [0.450, 0.550], alvo 0.500
```

Relatorio de realismo (`npm run realism`, N=1500 nos dois cenarios; o arquivo inteiro esta em
`docs/diagnostics/realism-audit.txt`), cenario `app`:

```
=== cenario app (N=1500) ===
violacoes de regra dura: 0
OK   [trava] duracao media (min): 31.932  banda [29.000; 36.000] alvo 32.300
OK   [trava] fracao no teto de 60 min: 0.000  banda [0.000; 0.005] alvo 0.000
OK   [trava] mediana da 1a torre (s): 600  banda [480; 1200] alvo 975
OK   [aceite] lider de abates aos 20 vence: 0.742  banda [0.700; 0.820] alvo 0.764
OK   [aceite] lider de ouro aos 15 vence: 0.714  banda [0.660; 0.780] alvo 0.716
OK   [aceite] lider de ouro aos 20 vence: 0.753  banda [0.720; 0.840] alvo 0.782
OK   [aceite] lider de ouro aos 25 vence: 0.804  banda [0.770; 0.890] alvo 0.830
OK   [aceite] abates vencedor / perdedor: 2.232  banda [1.800; 2.600] alvo 2.150
OK   [aceite] vencedor com mais abates: 0.922  banda [0.850; 1.000] alvo 0.900
OK   [aceite] vencedor atras no ouro: 0.028  banda [0.000; 0.050] alvo 0.020
OK   [aceite] ouro vencedor menos perdedor: 12291  banda [7000; 13000] alvo 10000
OK   [aceite] GPM por time: 1852  banda [1650; 2050] alvo 1833
OK   [aceite] GPM vencedor / perdedor: 1.247  banda [1.120; 1.260] alvo 1.190
OK   [aceite] time do 1o Barao vence: 0.789  banda [0.780; 0.900] alvo 0.854
OK   [aceite] time da Alma vence: 0.852  banda [0.840; 0.950] alvo 0.908
OK   [aceite] time da 1a torre vence: 0.636  banda [0.620; 0.750] alvo 0.682
OK   [aceite] roubos / objetivos tomados: 0.018  banda [0.000; 0.030] alvo 0.020
FORA [aceite] favorito com gap >= 5 vence: 0.618  banda [0.750; 0.850] alvo 0.800
OK   [aceite] favorito com gap < 1 vence: 0.505  banda [0.450; 0.550] alvo 0.500
--- acompanhadas sem gate ---
     abates por partida: 50.298  (real 27)
     abates por minuto: 1.575  (real 0,84)
     mediana do first blood (s): 60.000  (real 300)
     mediana do 1o dragao (s): 315  (real 550)
     1o Barao no 1o minuto de spawn: 0.621  (real raro)
     partidas com Elder: 0.305  (real 0,08)
     torres por partida: 10.650  (real 11,9)
     lider de torres aos 20 vence: 0.721  (real sem fonte)
     ouro por time aos 10: 17976  (real 15900)
     ouro por time aos 15: 26381  (real 24700)
     ouro por time aos 20: 34372  (real 34200)
     abates aos 10: 10.161  (real 3,2)
     abates aos 20: 22.021  (real 10,7)
```

Leitura: no cenario `app` as tres travas e 18 das 19 bandas de aceite estao dentro, com 0 violacao
de regra dura; fica fora so o favorito gap >= 5 (0,618), registrado na secao 8. O cenario de controle
`even75` (75 contra 75 sem campeoes, fora do gate) fica com abates venc/perd 2,992, delta de ouro
13602 e GPM venc/perd 1,296 acima das bandas do `app`, e as duas bandas de favorito sem amostra
(n/a, nao ha gap). Acompanhadas sem gate no `app`: abates por partida 50,3 (real 27), partidas com
Elder 0,305 (real 0,08), 1o Barao no 1o minuto de spawn 0,621 (real raro), first blood mediano em 60 s
(real 300).

Suite inteira (`npm test`) no ponto final: 19 vermelhos, os mesmos do fim da Task 7 menos
`src/sim/scenarios.test.ts` (viradas em partida equilibrada), que voltou a verde: 15 do golden,
`engineWiring.test.ts` EVT-01, `upset.test.ts` nao-vacuidade e os 2 herdados de `structures.test.ts`.
Nenhum vermelho novo; linhas em `docs/diagnostics/luta-mapa-vitoria-bandas.md`.

Saturacao do slider de Caos: a meia largura do sorteio de luta e
`fightNoiseBase + fightNoiseChaosCoef x caos efetivo`, com teto de 0,6 em `fightNoiseHalfWidth`
(`src/sim/tuning.ts`). Com `fightNoiseBase` 0.255 e coeficiente 0.48 o teto e atingido a partir de
caos efetivo de cerca de 0,72 (antes, com 0.16, de cerca de 0,92). O caos efetivo e o slider mais
cerca de 0,017 de volatilidade, entao a partir de um slider perto de 0,70 o topo do slider deixa de
abrir a luta. No Caos padrao a meia largura e cerca de 0,38 (era 0,29 no fim da Task 7).

### 7.7 Curva de rating (fix 1)

Ruling do controlador (fix 1 da Task 8, vinculante): uma tentativa limitada de fechar o favorito
gap >= 5 com `SimConfig.ratingPowerD`, a alavanca que a 7.5 apontou (inclinacao da curva de rating no
dominio de poder; padrao 525 desde a Fase 28). O dono do produto escolheu explicitamente "favorito
claro vence 75-85%". Regras:

- varrer `ratingPowerD` em {525; 350; 250; 175; 125} no N=1500, com o `DEFAULT_REALISM_TUNING`
  da 7.6;
- adotar um valor SO se o favorito gap >= 5 ficar em [0,75; 0,85], o favorito gap < 1 em
  [0,45; 0,55] e as outras 17 linhas de banda (14 de aceite e as 3 travas) e 0 violacao de regra dura
  ficarem dentro,
  tudo no N=1500;
- se mais de um passar, desempate pelo item 4 (maior margem minima); se nenhum passar, fica 525;
- depois, no maximo UMA passada curta (3 a 5 pontos) de `fightNoiseBase` ou `goldFightExponent` em
  volta do vigente, so se alguma banda sair na adocao;
- se adotar, mudar `DEFAULT_SIM_CONFIG.ratingPowerD` em `src/sim/matchState.ts` (o unico arquivo de
  motor que este fix pode tocar) e atualizar o comentario.

Base de todas as linhas: `goldFightExponent` 1.375, `fightNoiseBase` 0.255, `conversionSiegeBase`
30 (o `DEFAULT_REALISM_TUNING` da 7.6). Um comando por valor, com o terceiro argumento do script:

```
npx tsx scripts/sweep-realism.ts '[{}]' 1500 '{"ratingPowerD":525}'
npx tsx scripts/sweep-realism.ts '[{}]' 1500 '{"ratingPowerD":350}'
npx tsx scripts/sweep-realism.ts '[{}]' 1500 '{"ratingPowerD":250}'
npx tsx scripts/sweep-realism.ts '[{}]' 1500 '{"ratingPowerD":175}'
npx tsx scripts/sweep-realism.ts '[{}]' 1500 '{"ratingPowerD":125}'
```

Saidas inteiras:

```
N=1500 por ponto, cenario app, SimConfig {"ratingPowerD":525}

ponto {}
  durationMeanMin=31.932 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1852 | teamGoldAt10=17976 | teamGoldAt20=34372 | killsPerGame=50.298 | killLeaderAt20Wins=0.742 | goldLeaderAt20Wins=0.753 | goldLeaderAt25Wins=0.804 | killRatioWinnerLoser=2.232 | winnerBehindGoldFrac=0.028 | goldDiffWinnerLoserMean=12291 | gpmRatioWinnerLoser=1.247 | favoriteGap5Wins=0.618 | favoriteGapUnder1Wins=0.505 | firstBaronWins=0.789 | soulWins=0.852 | firstTowerWins=0.636 | firstTowerMedianSec=600 | stealFraction=0.018 | towersPerGame=10.650 | goldLeaderAt15Wins=0.714 | winnerMoreKillsFrac=0.922
  FORA (1): favoriteGap5Wins

N=1500 por ponto, cenario app, SimConfig {"ratingPowerD":350}

ponto {}
  durationMeanMin=31.801 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1851 | teamGoldAt10=17978 | teamGoldAt20=34400 | killsPerGame=49.979 | killLeaderAt20Wins=0.749 | goldLeaderAt20Wins=0.761 | goldLeaderAt25Wins=0.809 | killRatioWinnerLoser=2.284 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=12502 | gpmRatioWinnerLoser=1.252 | favoriteGap5Wins=0.691 | favoriteGapUnder1Wins=0.488 | firstBaronWins=0.795 | soulWins=0.845 | firstTowerWins=0.657 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=10.551 | goldLeaderAt15Wins=0.730 | winnerMoreKillsFrac=0.926
  FORA (1): favoriteGap5Wins

N=1500 por ponto, cenario app, SimConfig {"ratingPowerD":250}

ponto {}
  durationMeanMin=31.874 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1852 | teamGoldAt10=17982 | teamGoldAt20=34418 | killsPerGame=50.143 | killLeaderAt20Wins=0.755 | goldLeaderAt20Wins=0.763 | goldLeaderAt25Wins=0.817 | killRatioWinnerLoser=2.285 | winnerBehindGoldFrac=0.019 | goldDiffWinnerLoserMean=12537 | gpmRatioWinnerLoser=1.252 | favoriteGap5Wins=0.713 | favoriteGapUnder1Wins=0.512 | firstBaronWins=0.799 | soulWins=0.837 | firstTowerWins=0.668 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=10.588 | goldLeaderAt15Wins=0.731 | winnerMoreKillsFrac=0.931
  FORA (2): soulWins, favoriteGap5Wins

N=1500 por ponto, cenario app, SimConfig {"ratingPowerD":175}

ponto {}
  durationMeanMin=31.726 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1851 | teamGoldAt10=17981 | teamGoldAt20=34422 | killsPerGame=49.859 | killLeaderAt20Wins=0.770 | goldLeaderAt20Wins=0.779 | goldLeaderAt25Wins=0.830 | killRatioWinnerLoser=2.340 | winnerBehindGoldFrac=0.019 | goldDiffWinnerLoserMean=12573 | gpmRatioWinnerLoser=1.254 | favoriteGap5Wins=0.708 | favoriteGapUnder1Wins=0.512 | firstBaronWins=0.795 | soulWins=0.834 | firstTowerWins=0.665 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=10.525 | goldLeaderAt15Wins=0.730 | winnerMoreKillsFrac=0.941
  FORA (2): soulWins, favoriteGap5Wins

N=1500 por ponto, cenario app, SimConfig {"ratingPowerD":125}

ponto {}
  durationMeanMin=31.515 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1849 | teamGoldAt10=17981 | teamGoldAt20=34433 | killsPerGame=49.434 | killLeaderAt20Wins=0.760 | goldLeaderAt20Wins=0.775 | goldLeaderAt25Wins=0.827 | killRatioWinnerLoser=2.345 | winnerBehindGoldFrac=0.025 | goldDiffWinnerLoserMean=12652 | gpmRatioWinnerLoser=1.257 | favoriteGap5Wins=0.831 | favoriteGapUnder1Wins=0.517 | firstBaronWins=0.804 | soulWins=0.843 | firstTowerWins=0.676 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=10.420 | goldLeaderAt15Wins=0.733 | winnerMoreKillsFrac=0.933
  FORA (0): 
```

Aplicacao do criterio (valores copiados das saidas; travas: duracao, teto de 60 min e mediana da 1a
torre):

| ratingPowerD | fav gap >= 5 | fav gap < 1 | outras 14 bandas de aceite | travas | regras duras | margem minima (banda) | passa |
|---|---|---|---|---|---|---|---|
| 525 (vigente) | 0.618 (fora) | 0.505 | todas dentro | dentro (31,932 min; 0,000; 600 s) | 0 | 0.075 (1o Barao 0,789) | nao |
| 350 | 0.691 (fora) | 0.488 | todas dentro | dentro (31,801; 0,000; 585 s) | 0 | 0.045 (Alma 0,845) | nao |
| 250 | 0.713 (fora) | 0.512 | Alma 0,837 fora | dentro (31,874; 0,000; 585 s) | 0 | 0.057 (GPM venc/perd 1,252) | nao |
| 175 | 0.708 (fora) | 0.512 | Alma 0,834 fora | dentro (31,726; 0,000; 585 s) | 0 | 0.043 (GPM venc/perd 1,254) | nao |
| 125 | 0.831 | 0.517 | todas dentro | dentro (31,515; 0,000; 585 s) | 0 | 0.021 (GPM venc/perd 1,257) | **sim** |

Um unico valor passa, o 125, entao o desempate do item 4 nao foi preciso. Nenhuma banda saiu na
adocao (no N=1500 as 19 ficam dentro), entao a passada curta de re-ajuste autorizada pelo ruling nao
se aplica e nao foi rodada.

**Decisao (fix 1): `ratingPowerD` 125**, gravado em `DEFAULT_SIM_CONFIG` (`src/sim/matchState.ts`),
com o comentario apontando para esta secao. Substituido no fix 2 por 140 (secao 7.8), pela checagem
de robustez no N=3000. `DEFAULT_REALISM_TUNING` nao mudou. Para referencia, a razao
efetiva de poder de luta do canal e `10^(gap / ratingPowerD)`: no gap 6,33 (media do grupo gap >= 5)
ela vai de 1,028 (525) para 1,124 (125).

Gate (`npm run calibrate:realism -- --reporter=verbose`, N=1500) com o ponto final do motor:

```
✓ scripts/calibrate-realism.ts > calibrate-realism > ASSERT DURO: zero violacao de regra dura 2ms
✓ scripts/calibrate-realism.ts > calibrate-realism > ASSERT DURO: mesma seed gera a mesma partida 30ms
✓ scripts/calibrate-realism.ts > calibrate-realism > BANDAS: travas e aceite no cenario app 1ms
Tests  3 passed (3)
```

```
[OK] duracao media (min) = 31.515 dentro da banda [29.000, 36.000], alvo 32.300
[OK] fracao no teto de 60 min = 0.000 dentro da banda [0.000, 0.005], alvo 0.000
[OK] mediana da 1a torre (s) = 585 dentro da banda [480, 1200], alvo 975
[OK] lider de abates aos 20 vence = 0.760 dentro da banda [0.700, 0.820], alvo 0.764
[OK] lider de ouro aos 15 vence = 0.733 dentro da banda [0.660, 0.780], alvo 0.716
[OK] lider de ouro aos 20 vence = 0.775 dentro da banda [0.720, 0.840], alvo 0.782
[OK] lider de ouro aos 25 vence = 0.827 dentro da banda [0.770, 0.890], alvo 0.830
[OK] abates vencedor / perdedor = 2.345 dentro da banda [1.800, 2.600], alvo 2.150
[OK] vencedor com mais abates = 0.933 dentro da banda [0.850, 1.000], alvo 0.900
[OK] vencedor atras no ouro = 0.025 dentro da banda [0.000, 0.050], alvo 0.020
[OK] ouro vencedor menos perdedor = 12652 dentro da banda [7000, 13000], alvo 10000
[OK] GPM por time = 1849 dentro da banda [1650, 2050], alvo 1833
[OK] GPM vencedor / perdedor = 1.257 dentro da banda [1.120, 1.260], alvo 1.190
[OK] time do 1o Barao vence = 0.804 dentro da banda [0.780, 0.900], alvo 0.854
[OK] time da Alma vence = 0.843 dentro da banda [0.840, 0.950], alvo 0.908
[OK] time da 1a torre vence = 0.676 dentro da banda [0.620, 0.750], alvo 0.682
[OK] roubos / objetivos tomados = 0.018 dentro da banda [0.000, 0.030], alvo 0.020
[OK] favorito com gap >= 5 vence = 0.831 dentro da banda [0.750, 0.850], alvo 0.800
[OK] favorito com gap < 1 vence = 0.517 dentro da banda [0.450, 0.550], alvo 0.500
```

O gate fica verde inteiro pela primeira vez: os dois asserts duros e as 19 linhas de banda (3 travas
e 16 de aceite).

Relatorio de realismo (`npm run realism`, N=1500; o arquivo inteiro esta em
`docs/diagnostics/realism-audit.txt`), cenario `app`:

```
=== cenario app (N=1500) ===
violacoes de regra dura: 0
OK   [trava] duracao media (min): 31.515  banda [29.000; 36.000] alvo 32.300
OK   [trava] fracao no teto de 60 min: 0.000  banda [0.000; 0.005] alvo 0.000
OK   [trava] mediana da 1a torre (s): 585  banda [480; 1200] alvo 975
OK   [aceite] lider de abates aos 20 vence: 0.760  banda [0.700; 0.820] alvo 0.764
OK   [aceite] lider de ouro aos 15 vence: 0.733  banda [0.660; 0.780] alvo 0.716
OK   [aceite] lider de ouro aos 20 vence: 0.775  banda [0.720; 0.840] alvo 0.782
OK   [aceite] lider de ouro aos 25 vence: 0.827  banda [0.770; 0.890] alvo 0.830
OK   [aceite] abates vencedor / perdedor: 2.345  banda [1.800; 2.600] alvo 2.150
OK   [aceite] vencedor com mais abates: 0.933  banda [0.850; 1.000] alvo 0.900
OK   [aceite] vencedor atras no ouro: 0.025  banda [0.000; 0.050] alvo 0.020
OK   [aceite] ouro vencedor menos perdedor: 12652  banda [7000; 13000] alvo 10000
OK   [aceite] GPM por time: 1849  banda [1650; 2050] alvo 1833
OK   [aceite] GPM vencedor / perdedor: 1.257  banda [1.120; 1.260] alvo 1.190
OK   [aceite] time do 1o Barao vence: 0.804  banda [0.780; 0.900] alvo 0.854
OK   [aceite] time da Alma vence: 0.843  banda [0.840; 0.950] alvo 0.908
OK   [aceite] time da 1a torre vence: 0.676  banda [0.620; 0.750] alvo 0.682
OK   [aceite] roubos / objetivos tomados: 0.018  banda [0.000; 0.030] alvo 0.020
OK   [aceite] favorito com gap >= 5 vence: 0.831  banda [0.750; 0.850] alvo 0.800
OK   [aceite] favorito com gap < 1 vence: 0.517  banda [0.450; 0.550] alvo 0.500
--- acompanhadas sem gate ---
     abates por partida: 49.434  (real 27)
     abates por minuto: 1.569  (real 0,84)
     mediana do first blood (s): 60.000  (real 300)
     mediana do 1o dragao (s): 315  (real 550)
     1o Barao no 1o minuto de spawn: 0.642  (real raro)
     partidas com Elder: 0.271  (real 0,08)
     torres por partida: 10.420  (real 11,9)
     lider de torres aos 20 vence: 0.758  (real sem fonte)
     ouro por time aos 10: 17981  (real 15900)
     ouro por time aos 15: 26405  (real 24700)
     ouro por time aos 20: 34433  (real 34200)
     abates aos 10: 10.185  (real 3,2)
     abates aos 20: 22.107  (real 10,7)
```

O cenario de controle `even75` nao muda (rosters iguais, gap 0, o canal de rating vale 1 dos dois
lados): abates venc/perd 2,992, delta de ouro 13602 e GPM venc/perd 1,296, como na 7.6.

Checagem informativa de robustez, sem uso na decisao (a regra do ruling e no N=1500): o mesmo ponto
no N=3000 (seeds 0 a 2999, 346 partidas com gap >= 5).

```
npx tsx scripts/sweep-realism.ts '[{}]' 3000 '{"ratingPowerD":125}'
```

```
N=3000 por ponto, cenario app, SimConfig {"ratingPowerD":125}

ponto {}
  durationMeanMin=31.514 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1849 | teamGoldAt10=17994 | teamGoldAt20=34469 | killsPerGame=49.611 | killLeaderAt20Wins=0.773 | goldLeaderAt20Wins=0.781 | goldLeaderAt25Wins=0.827 | killRatioWinnerLoser=2.363 | winnerBehindGoldFrac=0.025 | goldDiffWinnerLoserMean=12794 | gpmRatioWinnerLoser=1.261 | favoriteGap5Wins=0.853 | favoriteGapUnder1Wins=0.499 | firstBaronWins=0.791 | soulWins=0.833 | firstTowerWins=0.686 | firstTowerMedianSec=600 | stealFraction=0.019 | towersPerGame=10.425 | goldLeaderAt15Wins=0.745 | winnerMoreKillsFrac=0.937
  FORA (3): gpmRatioWinnerLoser, soulWins, favoriteGap5Wins
```

No N=3000 ficam fora, todas por pouco: favorito gap >= 5 0,853 (teto 0,85), GPM venc/perd 1,261
(teto 1,26) e Alma 0,833 (piso 0,84). Ou seja, o ponto adotado passa no gate, mas com tres bandas na
borda: o favorito gap >= 5 pulou de 0,708 (175) para 0,831 (125) e agora encosta no TETO, e a margem
minima no N=1500 e 0,021 (GPM venc/perd). A grade do ruling nao tem ponto entre 175 e 125, e nenhum
foi rodado.

Suite inteira (`npx vitest run src scripts server`) com `ratingPowerD` 125: 105 arquivos, 1818
testes, 19 vermelhos, exatamente os mesmos 19 do commit anterior da Task 8 (15 do golden,
`engineWiring.test.ts` EVT-01, `upset.test.ts` nao-vacuidade e os 2 herdados de `structures.test.ts`).
Nenhum vermelho novo, inclusive nos testes de curva de rating e de zebra da Fase 28
(`ratingCurve.test.ts` e o resto de `upset.test.ts` verdes). Os snapshots regravados so com LF foram
restaurados.

### 7.8 Robustez da curva de rating (fix 2)

Motivo: a checagem informativa da 7.7 mostrou o 125 fragil no N=3000 (favorito gap >= 5 0,853, GPM
venc/perd 1,261 e Alma 0,833, todos fora por pouco), e a grade da 7.7 pulou de 175 (0,708) para 125
(0,831) sem nada medido no meio.

Ruling do controlador (fix 2 da Task 8, vinculante):

1. varrer `ratingPowerD` em {175; 160; 150; 140; 125} no N=3000 com o `DEFAULT_REALISM_TUNING`
   vigente, e medir os mesmos pontos no N=1500 (as seeds 0 a 1499 do gate);
2. criterio, nesta ordem: (a) todas as bandas de aceite, todas as travas e 0 violacao de regra dura
   dentro no N=3000 E no N=1500; (b) entre os que passam (a), a maior margem minima no N=3000 (a
   definicao do item 4); (c) se nenhum passar (a), a maior margem minima no N=3000 entre os que passam
   o gate no N=1500; se nem isso, fica 125;
3. se o valor mudar, atualizar `DEFAULT_SIM_CONFIG.ratingPowerD` e o comentario, confirmar com o gate
   (3/3 e 19/19) e com o relatorio, e rodar a suite inteira.

Base de todas as linhas: `goldFightExponent` 1.375, `fightNoiseBase` 0.255, `conversionSiegeBase` 30
(o `DEFAULT_REALISM_TUNING` da 7.6), os demais campos de `SimConfig` no padrao.

```
npx tsx scripts/sweep-realism.ts '[{}]' 3000 '{"ratingPowerD":175}'
npx tsx scripts/sweep-realism.ts '[{}]' 3000 '{"ratingPowerD":160}'
npx tsx scripts/sweep-realism.ts '[{}]' 3000 '{"ratingPowerD":150}'
npx tsx scripts/sweep-realism.ts '[{}]' 3000 '{"ratingPowerD":140}'
npx tsx scripts/sweep-realism.ts '[{}]' 3000 '{"ratingPowerD":125}'
npx tsx scripts/sweep-realism.ts '[{}]' 1500 '{"ratingPowerD":175}'
npx tsx scripts/sweep-realism.ts '[{}]' 1500 '{"ratingPowerD":160}'
npx tsx scripts/sweep-realism.ts '[{}]' 1500 '{"ratingPowerD":150}'
npx tsx scripts/sweep-realism.ts '[{}]' 1500 '{"ratingPowerD":140}'
npx tsx scripts/sweep-realism.ts '[{}]' 1500 '{"ratingPowerD":125}'
```

Saidas inteiras, N=3000 (346 partidas com gap >= 5):

```
N=3000 por ponto, cenario app, SimConfig {"ratingPowerD":175}

ponto {}
  durationMeanMin=31.710 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1852 | teamGoldAt10=17997 | teamGoldAt20=34477 | killsPerGame=50.028 | killLeaderAt20Wins=0.772 | goldLeaderAt20Wins=0.781 | goldLeaderAt25Wins=0.827 | killRatioWinnerLoser=2.332 | winnerBehindGoldFrac=0.020 | goldDiffWinnerLoserMean=12641 | gpmRatioWinnerLoser=1.256 | favoriteGap5Wins=0.751 | favoriteGapUnder1Wins=0.501 | firstBaronWins=0.784 | soulWins=0.833 | firstTowerWins=0.678 | firstTowerMedianSec=585 | stealFraction=0.019 | towersPerGame=10.544 | goldLeaderAt15Wins=0.738 | winnerMoreKillsFrac=0.939
  FORA (1): soulWins

N=3000 por ponto, cenario app, SimConfig {"ratingPowerD":160}

ponto {}
  durationMeanMin=31.640 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1851 | teamGoldAt10=17995 | teamGoldAt20=34491 | killsPerGame=49.920 | killLeaderAt20Wins=0.777 | goldLeaderAt20Wins=0.785 | goldLeaderAt25Wins=0.826 | killRatioWinnerLoser=2.338 | winnerBehindGoldFrac=0.022 | goldDiffWinnerLoserMean=12663 | gpmRatioWinnerLoser=1.257 | favoriteGap5Wins=0.795 | favoriteGapUnder1Wins=0.504 | firstBaronWins=0.783 | soulWins=0.825 | firstTowerWins=0.682 | firstTowerMedianSec=585 | stealFraction=0.019 | towersPerGame=10.496 | goldLeaderAt15Wins=0.746 | winnerMoreKillsFrac=0.939
  FORA (1): soulWins

N=3000 por ponto, cenario app, SimConfig {"ratingPowerD":150}

ponto {}
  durationMeanMin=31.580 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=17993 | teamGoldAt20=34480 | killsPerGame=49.808 | killLeaderAt20Wins=0.774 | goldLeaderAt20Wins=0.785 | goldLeaderAt25Wins=0.822 | killRatioWinnerLoser=2.348 | winnerBehindGoldFrac=0.023 | goldDiffWinnerLoserMean=12735 | gpmRatioWinnerLoser=1.259 | favoriteGap5Wins=0.818 | favoriteGapUnder1Wins=0.509 | firstBaronWins=0.784 | soulWins=0.831 | firstTowerWins=0.685 | firstTowerMedianSec=585 | stealFraction=0.019 | towersPerGame=10.479 | goldLeaderAt15Wins=0.745 | winnerMoreKillsFrac=0.939
  FORA (1): soulWins

N=3000 por ponto, cenario app, SimConfig {"ratingPowerD":140}

ponto {}
  durationMeanMin=31.539 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=17995 | teamGoldAt20=34471 | killsPerGame=49.742 | killLeaderAt20Wins=0.776 | goldLeaderAt20Wins=0.785 | goldLeaderAt25Wins=0.823 | killRatioWinnerLoser=2.357 | winnerBehindGoldFrac=0.024 | goldDiffWinnerLoserMean=12762 | gpmRatioWinnerLoser=1.260 | favoriteGap5Wins=0.818 | favoriteGapUnder1Wins=0.496 | firstBaronWins=0.786 | soulWins=0.838 | firstTowerWins=0.686 | firstTowerMedianSec=585 | stealFraction=0.019 | towersPerGame=10.441 | goldLeaderAt15Wins=0.747 | winnerMoreKillsFrac=0.938
  FORA (1): soulWins

N=3000 por ponto, cenario app, SimConfig {"ratingPowerD":125}

ponto {}
  durationMeanMin=31.514 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1849 | teamGoldAt10=17994 | teamGoldAt20=34469 | killsPerGame=49.611 | killLeaderAt20Wins=0.773 | goldLeaderAt20Wins=0.781 | goldLeaderAt25Wins=0.827 | killRatioWinnerLoser=2.363 | winnerBehindGoldFrac=0.025 | goldDiffWinnerLoserMean=12794 | gpmRatioWinnerLoser=1.261 | favoriteGap5Wins=0.853 | favoriteGapUnder1Wins=0.499 | firstBaronWins=0.791 | soulWins=0.833 | firstTowerWins=0.686 | firstTowerMedianSec=600 | stealFraction=0.019 | towersPerGame=10.425 | goldLeaderAt15Wins=0.745 | winnerMoreKillsFrac=0.937
  FORA (3): gpmRatioWinnerLoser, soulWins, favoriteGap5Wins
```

Saidas inteiras, N=1500 (175 e 125 iguais as da 7.7, mesmas seeds):

```
N=1500 por ponto, cenario app, SimConfig {"ratingPowerD":175}

ponto {}
  durationMeanMin=31.726 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1851 | teamGoldAt10=17981 | teamGoldAt20=34422 | killsPerGame=49.859 | killLeaderAt20Wins=0.770 | goldLeaderAt20Wins=0.779 | goldLeaderAt25Wins=0.830 | killRatioWinnerLoser=2.340 | winnerBehindGoldFrac=0.019 | goldDiffWinnerLoserMean=12573 | gpmRatioWinnerLoser=1.254 | favoriteGap5Wins=0.708 | favoriteGapUnder1Wins=0.512 | firstBaronWins=0.795 | soulWins=0.834 | firstTowerWins=0.665 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=10.525 | goldLeaderAt15Wins=0.730 | winnerMoreKillsFrac=0.941
  FORA (2): soulWins, favoriteGap5Wins

N=1500 por ponto, cenario app, SimConfig {"ratingPowerD":160}

ponto {}
  durationMeanMin=31.740 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1851 | teamGoldAt10=17978 | teamGoldAt20=34458 | killsPerGame=49.892 | killLeaderAt20Wins=0.766 | goldLeaderAt20Wins=0.775 | goldLeaderAt25Wins=0.825 | killRatioWinnerLoser=2.321 | winnerBehindGoldFrac=0.021 | goldDiffWinnerLoserMean=12535 | gpmRatioWinnerLoser=1.253 | favoriteGap5Wins=0.753 | favoriteGapUnder1Wins=0.521 | firstBaronWins=0.790 | soulWins=0.820 | firstTowerWins=0.667 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=10.517 | goldLeaderAt15Wins=0.734 | winnerMoreKillsFrac=0.938
  FORA (1): soulWins

N=1500 por ponto, cenario app, SimConfig {"ratingPowerD":150}

ponto {}
  durationMeanMin=31.669 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1851 | teamGoldAt10=17977 | teamGoldAt20=34466 | killsPerGame=49.757 | killLeaderAt20Wins=0.761 | goldLeaderAt20Wins=0.773 | goldLeaderAt25Wins=0.823 | killRatioWinnerLoser=2.320 | winnerBehindGoldFrac=0.024 | goldDiffWinnerLoserMean=12540 | gpmRatioWinnerLoser=1.254 | favoriteGap5Wins=0.787 | favoriteGapUnder1Wins=0.524 | firstBaronWins=0.794 | soulWins=0.832 | firstTowerWins=0.663 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=10.497 | goldLeaderAt15Wins=0.729 | winnerMoreKillsFrac=0.935
  FORA (1): soulWins

N=1500 por ponto, cenario app, SimConfig {"ratingPowerD":140}

ponto {}
  durationMeanMin=31.602 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1850 | teamGoldAt10=17978 | teamGoldAt20=34444 | killsPerGame=49.625 | killLeaderAt20Wins=0.762 | goldLeaderAt20Wins=0.773 | goldLeaderAt25Wins=0.826 | killRatioWinnerLoser=2.332 | winnerBehindGoldFrac=0.023 | goldDiffWinnerLoserMean=12603 | gpmRatioWinnerLoser=1.255 | favoriteGap5Wins=0.798 | favoriteGapUnder1Wins=0.507 | firstBaronWins=0.796 | soulWins=0.847 | firstTowerWins=0.671 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=10.459 | goldLeaderAt15Wins=0.729 | winnerMoreKillsFrac=0.937
  FORA (0): 

N=1500 por ponto, cenario app, SimConfig {"ratingPowerD":125}

ponto {}
  durationMeanMin=31.515 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1849 | teamGoldAt10=17981 | teamGoldAt20=34433 | killsPerGame=49.434 | killLeaderAt20Wins=0.760 | goldLeaderAt20Wins=0.775 | goldLeaderAt25Wins=0.827 | killRatioWinnerLoser=2.345 | winnerBehindGoldFrac=0.025 | goldDiffWinnerLoserMean=12652 | gpmRatioWinnerLoser=1.257 | favoriteGap5Wins=0.831 | favoriteGapUnder1Wins=0.517 | firstBaronWins=0.804 | soulWins=0.843 | firstTowerWins=0.676 | firstTowerMedianSec=585 | stealFraction=0.018 | towersPerGame=10.420 | goldLeaderAt15Wins=0.733 | winnerMoreKillsFrac=0.933
  FORA (0): 
```

Margem minima: a do item 4 (distancia ate a borda dividida pela largura, so o lado cruzavel nas
bandas de um lado so). A coluna "margem minima assinada" toma o minimo sobre as 19 linhas contando
como negativa a distancia das bandas fora; serve para comparar pontos que tem banda fora. Em todos
os pontos as travas ficam dentro (duracao entre 31,51 e 31,74 min, teto 0,000, 1a torre 585 ou 600 s) e
as regras duras em 0, nos dois N.

| ratingPowerD | N | fav gap >= 5 | fav gap < 1 | bandas fora | margem minima entre as dentro (banda) | margem minima assinada (banda) |
|---|---|---|---|---|---|---|
| 175 | 3000 | 0.751 | 0.501 | Alma 0,833 | 0.010 (fav gap >= 5) | -0.064 (Alma) |
| 175 | 1500 | 0.708 | 0.512 | Alma 0,834; fav gap >= 5 0,708 | 0.043 (GPM venc/perd 1,254) | -0.420 (fav gap >= 5) |
| 160 | 3000 | 0.795 | 0.504 | Alma 0,825 | 0.021 (GPM venc/perd 1,257) | -0.136 (Alma) |
| 160 | 1500 | 0.753 | 0.521 | Alma 0,820 | 0.030 (fav gap >= 5) | -0.182 (Alma) |
| 150 | 3000 | 0.818 | 0.509 | Alma 0,831 | 0.007 (GPM venc/perd 1,259) | -0.082 (Alma) |
| 150 | 1500 | 0.787 | 0.524 | Alma 0,832 | 0.043 (GPM venc/perd 1,254) | -0.073 (Alma) |
| 140 | 3000 | 0.818 | 0.496 | Alma 0,838 | 0.000 (GPM venc/perd 1,260, dentro no valor exato) | -0.018 (Alma) |
| 140 | 1500 | 0.798 | 0.507 | nenhuma | 0.036 (GPM venc/perd 1,255) | 0.036 (GPM venc/perd) |
| 125 | 3000 | 0.853 | 0.499 | GPM venc/perd 1,261; Alma 0,833; fav gap >= 5 0,853 | 0.034 (delta de ouro 12794) | -0.064 (Alma) |
| 125 | 1500 | 0.831 | 0.517 | nenhuma | 0.021 (GPM venc/perd 1,257) | 0.021 (GPM venc/perd) |

Aplicacao do criterio:

- (a) nenhum ponto passa: a Alma fica fora no N=3000 em todos os cinco (0,825 a 0,838);
- (b) nao se aplica;
- (c) passam o gate no N=1500 so o 140 e o 125. No N=3000, pela definicao do item 4 (primeiro menos
  bandas fora, depois a maior margem minima), o 140 tem 1 banda fora (Alma 0,838) e o 125 tem 3. A
  margem minima assinada concorda: -0,018 no 140 contra -0,064 no 125.

**Decisao (fix 2): `ratingPowerD` 140**, gravado em `DEFAULT_SIM_CONFIG` (`src/sim/matchState.ts`),
com o comentario apontando para as secoes 7.7 e 7.8. `DEFAULT_REALISM_TUNING` nao mudou. No gap 6,33
a razao efetiva de poder do canal fica em `10^(6,33/140)` = 1,110 (1,124 no 125, 1,028 no 525).

Gate (`npm run calibrate:realism -- --reporter=verbose`, N=1500) com o ponto final do motor:

```
✓ scripts/calibrate-realism.ts > calibrate-realism > ASSERT DURO: zero violacao de regra dura 2ms
✓ scripts/calibrate-realism.ts > calibrate-realism > ASSERT DURO: mesma seed gera a mesma partida 32ms
✓ scripts/calibrate-realism.ts > calibrate-realism > BANDAS: travas e aceite no cenario app 1ms
Tests  3 passed (3)
```

```
[OK] duracao media (min) = 31.602 dentro da banda [29.000, 36.000], alvo 32.300
[OK] fracao no teto de 60 min = 0.000 dentro da banda [0.000, 0.005], alvo 0.000
[OK] mediana da 1a torre (s) = 585 dentro da banda [480, 1200], alvo 975
[OK] lider de abates aos 20 vence = 0.762 dentro da banda [0.700, 0.820], alvo 0.764
[OK] lider de ouro aos 15 vence = 0.729 dentro da banda [0.660, 0.780], alvo 0.716
[OK] lider de ouro aos 20 vence = 0.773 dentro da banda [0.720, 0.840], alvo 0.782
[OK] lider de ouro aos 25 vence = 0.826 dentro da banda [0.770, 0.890], alvo 0.830
[OK] abates vencedor / perdedor = 2.332 dentro da banda [1.800, 2.600], alvo 2.150
[OK] vencedor com mais abates = 0.937 dentro da banda [0.850, 1.000], alvo 0.900
[OK] vencedor atras no ouro = 0.023 dentro da banda [0.000, 0.050], alvo 0.020
[OK] ouro vencedor menos perdedor = 12603 dentro da banda [7000, 13000], alvo 10000
[OK] GPM por time = 1850 dentro da banda [1650, 2050], alvo 1833
[OK] GPM vencedor / perdedor = 1.255 dentro da banda [1.120, 1.260], alvo 1.190
[OK] time do 1o Barao vence = 0.796 dentro da banda [0.780, 0.900], alvo 0.854
[OK] time da Alma vence = 0.847 dentro da banda [0.840, 0.950], alvo 0.908
[OK] time da 1a torre vence = 0.671 dentro da banda [0.620, 0.750], alvo 0.682
[OK] roubos / objetivos tomados = 0.018 dentro da banda [0.000, 0.030], alvo 0.020
[OK] favorito com gap >= 5 vence = 0.798 dentro da banda [0.750, 0.850], alvo 0.800
[OK] favorito com gap < 1 vence = 0.507 dentro da banda [0.450, 0.550], alvo 0.500
```

Relatorio de realismo (`npm run realism`, N=1500; o arquivo inteiro esta em
`docs/diagnostics/realism-audit.txt`), cenario `app`:

```
=== cenario app (N=1500) ===
violacoes de regra dura: 0
OK   [trava] duracao media (min): 31.602  banda [29.000; 36.000] alvo 32.300
OK   [trava] fracao no teto de 60 min: 0.000  banda [0.000; 0.005] alvo 0.000
OK   [trava] mediana da 1a torre (s): 585  banda [480; 1200] alvo 975
OK   [aceite] lider de abates aos 20 vence: 0.762  banda [0.700; 0.820] alvo 0.764
OK   [aceite] lider de ouro aos 15 vence: 0.729  banda [0.660; 0.780] alvo 0.716
OK   [aceite] lider de ouro aos 20 vence: 0.773  banda [0.720; 0.840] alvo 0.782
OK   [aceite] lider de ouro aos 25 vence: 0.826  banda [0.770; 0.890] alvo 0.830
OK   [aceite] abates vencedor / perdedor: 2.332  banda [1.800; 2.600] alvo 2.150
OK   [aceite] vencedor com mais abates: 0.937  banda [0.850; 1.000] alvo 0.900
OK   [aceite] vencedor atras no ouro: 0.023  banda [0.000; 0.050] alvo 0.020
OK   [aceite] ouro vencedor menos perdedor: 12603  banda [7000; 13000] alvo 10000
OK   [aceite] GPM por time: 1850  banda [1650; 2050] alvo 1833
OK   [aceite] GPM vencedor / perdedor: 1.255  banda [1.120; 1.260] alvo 1.190
OK   [aceite] time do 1o Barao vence: 0.796  banda [0.780; 0.900] alvo 0.854
OK   [aceite] time da Alma vence: 0.847  banda [0.840; 0.950] alvo 0.908
OK   [aceite] time da 1a torre vence: 0.671  banda [0.620; 0.750] alvo 0.682
OK   [aceite] roubos / objetivos tomados: 0.018  banda [0.000; 0.030] alvo 0.020
OK   [aceite] favorito com gap >= 5 vence: 0.798  banda [0.750; 0.850] alvo 0.800
OK   [aceite] favorito com gap < 1 vence: 0.507  banda [0.450; 0.550] alvo 0.500
--- acompanhadas sem gate ---
     abates por partida: 49.625  (real 27)
     abates por minuto: 1.570  (real 0,84)
     mediana do first blood (s): 60.000  (real 300)
     mediana do 1o dragao (s): 315  (real 550)
     1o Barao no 1o minuto de spawn: 0.632  (real raro)
     partidas com Elder: 0.285  (real 0,08)
     torres por partida: 10.459  (real 11,9)
     lider de torres aos 20 vence: 0.749  (real sem fonte)
     ouro por time aos 10: 17978  (real 15900)
     ouro por time aos 15: 26399  (real 24700)
     ouro por time aos 20: 34444  (real 34200)
     abates aos 10: 10.180  (real 3,2)
     abates aos 20: 22.096  (real 10,7)
```

O cenario de controle `even75` nao muda (gap 0).

Checagem informativa, sem uso na decisao: o ponto de tuning com `ratingPowerD` 525 no N=3000, para
saber se a Alma fora no N=3000 vem da curva de rating ou do tuning.

```
npx tsx scripts/sweep-realism.ts '[{}]' 3000 '{"ratingPowerD":525}'
```

```
N=3000 por ponto, cenario app, SimConfig {"ratingPowerD":525}

ponto {}
  durationMeanMin=31.957 | capFraction=0.000 | hardRuleViolations=0.000 | gpmTeamMean=1854 | teamGoldAt10=17992 | teamGoldAt20=34445 | killsPerGame=50.470 | killLeaderAt20Wins=0.754 | goldLeaderAt20Wins=0.761 | goldLeaderAt25Wins=0.809 | killRatioWinnerLoser=2.236 | winnerBehindGoldFrac=0.028 | goldDiffWinnerLoserMean=12304 | gpmRatioWinnerLoser=1.246 | favoriteGap5Wins=0.665 | favoriteGapUnder1Wins=0.509 | firstBaronWins=0.775 | soulWins=0.848 | firstTowerWins=0.651 | firstTowerMedianSec=600 | stealFraction=0.019 | towersPerGame=10.689 | goldLeaderAt15Wins=0.731 | winnerMoreKillsFrac=0.926
  FORA (2): firstBaronWins, favoriteGap5Wins
```

Com 525 a Alma fica dentro no N=3000 (0,848) e caem fora o 1o Barao (0,775) e o favorito (0,665).
Ou seja, a curva mais inclinada tira a Alma da banda no N=3000 (0,825 a 0,838 com 175 a 125), e o
proprio ponto de tuning ja tinha o 1o Barao na borda.

Leitura: o 140 e o ponto mais robusto da grade dentro da regra, mas nao e robusto de verdade. No
N=3000 ele tem a Alma fora por 0,002 e o GPM venc/perd no teto (1,260). Nenhum valor da grade fecha
todas as bandas no N=3000. O que se mediu: quanto mais inclinada a curva, mais o favorito gap >= 5
sobe e mais a Alma cai no N=3000 (0,848 com 525; 0,825 a 0,838 com 175 a 125); a causa dessa queda
nao foi isolada.

Suite inteira (`npx vitest run src scripts server`) com `ratingPowerD` 140: 105 arquivos, 1818
testes, 19 vermelhos, exatamente os mesmos 19 do fix 1 (15 do golden, `engineWiring.test.ts` EVT-01,
`upset.test.ts` nao-vacuidade e os 2 herdados de `structures.test.ts`). Nenhum vermelho novo. Os
snapshots regravados so com LF foram restaurados.

## 8. Bandas que nao fecharam

Historico: nas passadas de tuning (secoes 7.2 a 7.4) a regra de parada do Step 3 disparou. As
passadas 2 e 3 passaram pela linha da tabela da unica banda fora, mais as duas alavancas extras do
ruling 1, sem colocar banda nova dentro, e o favorito gap >= 5 ficou aberto. Nenhuma banda foi
afrouxada.

Estado depois dos fixes: o fix 1 (secao 7.7) fechou a banda no gate com `ratingPowerD` 125, e o fix 2
(secao 7.8) trocou por 140, o valor mais robusto da grade de N=3000 que ainda passa no gate. Com 140
nenhuma banda fica aberta no gate (favorito gap >= 5 0,798 no N=1500). Ressalva: no N=3000
(informativo) o 140 fica com a Alma em 0,838, abaixo do piso de 0,84, e o GPM venc/perd no teto
(1,260); nenhum valor testado fecha todas as bandas no N=3000.

| banda | faixa | fim das passadas (N=1500, `ratingPowerD` 525) | melhor valor com alavancas de `RealismTuning` | alavanca que mais a moveu | depois dos fixes (N=1500 / N=3000) |
|---|---|---|---|---|---|
| favorito com gap >= 5 vence | 0,75 a 0,85 | 0,618 | 0,702 no N=1500 (ponto de exploracao com sorteio de +-2% e expoente 0,75, com 4 outras bandas fora); 0,674 no N=1500 entre os pontos com as outras 18 bandas dentro (ponto da 7.2.3 e ponto `objectiveBountyMinDeficit` 500 da 7.5); 0,747 no N=600 (passada 1, `fightNoiseBase` 0.24 com expoente 1.5, 75 partidas) | nenhuma alavanca de `RealismTuning` a moveu de forma distinguivel do ruido (desvio padrao de cerca de 0,034 no N=1500; faixa medida 0,590 a 0,702 em 16 variantes). A que a moveu foi `SimConfig.ratingPowerD`: no N=1500, 525, 350, 250, 175, 160, 150, 140 e 125 dao 0,618, 0,691, 0,713, 0,708, 0,753, 0,787, 0,798 e 0,831 | 0,798 / 0,818, dentro (`ratingPowerD` 140) |
| time da Alma vence (so no N=3000) | 0,84 a 0,95 | 0,852 no N=1500; 0,848 no N=3000 com 525 | (dentro no gate em todas as passadas) | `ratingPowerD`: no N=3000 a Alma cai para 0,825 a 0,838 com 175 a 125 | 0,847 / 0,838: dentro no gate, fora por 0,002 no N=3000 |

Troca consciente registrada: no desempate da 7.4.1 (item 4, so o favorito gap >= 5 diferia no N=600)
o criterio escolheu o ponto mais robusto nas outras 18 bandas (`fightNoiseBase` 0.255, margem minima
0,075), e ele tinha o MENOR favorito gap >= 5 no N=1500: 0,618, contra 0,635 do outro empatado
(0.225) e 0,674 do valor anterior (0.24, que nao entrou no empate por ter a Alma fora no N=600). A
escolha seguiu o criterio escrito, sabendo que a banda aberta piorava dentro do ruido.

Por que a banda nao fechou com `RealismTuning` (detalhe na 7.5): com `ratingPowerD` 525 o motor dava
ao favorito de gap medio 6,33 uma taxa perto da curva de rating declarada (`RATING_CURVE_D` 35,5 da
0,601), e a banda pede 0,75 a 0,85, uma inclinacao cerca de 3,4 vezes maior. O mecanismo pelo qual
nem o sorteio nem o expoente de ouro movem a banda nao foi medido. O que fechou a banda foi a
inclinacao do canal de rating (7.7 e 7.8). `RATING_CURVE_D` (35,5, usado tambem pelo limiar de zebra)
nao mudou.

## 9. Medicao final

Medicao do motor final desta spec (Task 11), depois de todas as tasks, com o golden regenerado e a
documentacao atualizada. Nenhum valor de `DEFAULT_REALISM_TUNING` nem de `DEFAULT_SIM_CONFIG` mudou
nesta task: a task so mexeu em documentacao.

Verificacao final (worktree `sdd/motor-luta-mapa-vitoria`):

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | sem erro |
| `npm run typecheck:server` | sem erro |
| `npm test` | verde: 106 arquivos, 1820 testes passando, 0 vermelhos |
| `npm run calibrate:realism` | PASS: 3 testes (2 asserts duros e as bandas), as 19 bandas dentro no N=1500 |
| `npm run build` | sem erro (`tsc && vite build`) |
| `npm run realism` | relatorio abaixo (N=1500, seeds 0 a 1499), gravado em `docs/diagnostics/realism-audit.txt` |

Cenario `app` (rosters reais de `public/players.json` mais campeoes fearless), saida de `npm run realism`:

```
=== cenario app (N=1500) ===
violacoes de regra dura: 0
OK   [trava] duracao media (min): 31.602  banda [29.000; 36.000] alvo 32.300
OK   [trava] fracao no teto de 60 min: 0.000  banda [0.000; 0.005] alvo 0.000
OK   [trava] mediana da 1a torre (s): 585  banda [480; 1200] alvo 975
OK   [aceite] lider de abates aos 20 vence: 0.762  banda [0.700; 0.820] alvo 0.764
OK   [aceite] lider de ouro aos 15 vence: 0.729  banda [0.660; 0.780] alvo 0.716
OK   [aceite] lider de ouro aos 20 vence: 0.773  banda [0.720; 0.840] alvo 0.782
OK   [aceite] lider de ouro aos 25 vence: 0.826  banda [0.770; 0.890] alvo 0.830
OK   [aceite] abates vencedor / perdedor: 2.332  banda [1.800; 2.600] alvo 2.150
OK   [aceite] vencedor com mais abates: 0.937  banda [0.850; 1.000] alvo 0.900
OK   [aceite] vencedor atras no ouro: 0.023  banda [0.000; 0.050] alvo 0.020
OK   [aceite] ouro vencedor menos perdedor: 12603  banda [7000; 13000] alvo 10000
OK   [aceite] GPM por time: 1850  banda [1650; 2050] alvo 1833
OK   [aceite] GPM vencedor / perdedor: 1.255  banda [1.120; 1.260] alvo 1.190
OK   [aceite] time do 1o Barao vence: 0.796  banda [0.780; 0.900] alvo 0.854
OK   [aceite] time da Alma vence: 0.847  banda [0.840; 0.950] alvo 0.908
OK   [aceite] time da 1a torre vence: 0.671  banda [0.620; 0.750] alvo 0.682
OK   [aceite] roubos / objetivos tomados: 0.018  banda [0.000; 0.030] alvo 0.020
OK   [aceite] favorito com gap >= 5 vence: 0.798  banda [0.750; 0.850] alvo 0.800
OK   [aceite] favorito com gap < 1 vence: 0.507  banda [0.450; 0.550] alvo 0.500
--- acompanhadas sem gate ---
     abates por partida: 49.625  (real 27)
     abates por minuto: 1.570  (real 0,84)
     mediana do first blood (s): 60.000  (real 300)
     mediana do 1o dragao (s): 315  (real 550)
     1o Barao no 1o minuto de spawn: 0.632  (real raro)
     partidas com Elder: 0.285  (real 0,08)
     torres por partida: 10.459  (real 11,9)
     lider de torres aos 20 vence: 0.749  (real sem fonte)
     ouro por time aos 10: 17978  (real 15900)
     ouro por time aos 15: 26399  (real 24700)
     ouro por time aos 20: 34444  (real 34200)
     abates aos 10: 10.180  (real 3,2)
     abates aos 20: 22.096  (real 10,7)
```

Leitura:

- As 19 bandas (3 travas e 16 de aceite) ficam dentro, com zero violacao de regra dura. Duas ficam
  encostadas no limite: GPM vencedor/perdedor (1,255, teto 1,26) e ouro vencedor menos perdedor
  (12603, teto 13000); a Alma (0,847, piso 0,84) e o 1o Barao (0,796, piso 0,78) tambem tem pouca
  margem. Nenhuma banda foi afrouxada.
- O cenario sintetico `even75` (75 contra 75, sem campeoes) sai no mesmo relatorio como controle e
  NAO e gate: com elenco igual nao ha favorito (as duas bandas de favorito saem `n/a`), e tres
  bandas de aceite saem fora (abates vencedor/perdedor 2,992, ouro vencedor menos perdedor 13602,
  GPM vencedor/perdedor 1,296); a causa nao foi investigada, porque o controle nao e criterio de
  aceite. As travas e as regras duras ficam dentro tambem nele.
- Acompanhadas sem gate e fora do escopo desta spec: abates por partida 49,6 (real 27), first blood
  mediano em 60 s (real 300 s) e Elder em 28,5% das partidas (real 8%). O motor segue com mais
  abates e mais cedo do que o jogo real; isso e o calendario do early game e o volume de abates, itens
  2 e 3 do fora de escopo da spec.
- Ressalva do N=3000 (informativo), ja registrada na secao 8: Alma em 0,838 e GPM vencedor/perdedor no
  teto (1,260) com `ratingPowerD` 140.
