# Baseline 16: Distribuicoes QUEBRADAS (pre-correcao)

**Gerado em:** 2026-06-29
**Harness:** `npm run calibrate:structures`
**N:** 800 partidas por tier (3 tiers = 2400 partidas no total)

> Este baseline documenta o estado QUEBRADO da engine antes das correcoes das Fases 17-22.
> Cada fase subsequente re-roda as mesmas seeds e compara contra estas distribuicoes.
> Os numeros vem diretamente de `tmp/calibration-structures.txt` (gerado pelo harness do Plano 03).
> NAO inventar ou interpolar valores: campos sem dado do harness estao marcados como "nao medido pelo harness".

---

## Estruturas

| Metrica | Equilibrado 70v70 | Gap-Leve 72v68 | Stomp 85v55 |
|---------|-------------------|----------------|-------------|
| 1a torre p5 (min) | 4:45 (285s) | 4:45 (285s) | 0:15 (15s) |
| 1a torre p50 (min) | 12:15 (735s) | 11:30 (690s) | 1:30 (90s) |
| 1a torre p95 (min) | 16:00 (960s) | 16:00 (960s) | 6:45 (405s) |
| Torres totais/jogo (media) | 8.09 | 8.08 | 7.50 |
| Torre < 5min (%) | 5.8% (46/800) | 5.6% (45/800) | 243.8% (1950/800)* |
| Inner < 10min, proxy (%) | 4.3% (34/800) | 7.8% (62/800) | 157.8% (1262/800)* |
| Inhib < 16min (%) | 3.3% (26/800) | 5.0% (40/800) | 125.6% (1005/800)* |
| NexusTurret < 20min, proxy (%) | 4.9% (39/800) | 6.1% (49/800) | 80.1% (641/800)* |
| Duracao media | 32:13 | 31:39 | 18:51 |

*Valores acima de 100% indicam multiplas ocorrencias por jogo (varias torres do mesmo tier caindo dentro do limiar de tempo por partida).

### Torres por checkpoint (media user | rival)

| Checkpoint | Equilibrado | Gap-Leve | Stomp |
|------------|-------------|----------|-------|
| 10min | user 0.22 / rival 0.20 | user 0.42 / rival 0.14 | user 4.75 / rival 0.01 |
| 15min | user 1.04 / rival 0.90 | user 1.50 / rival 0.74 | user 4.71 / rival 0.17 |
| 20min | user 1.71 / rival 1.43 | user 2.21 / rival 1.20 | user 2.82 / rival 0.21 |
| 25min | user 2.30 / rival 2.17 | user 2.76 / rival 1.92 | user 1.06 / rival 0.20 |
| 30min | user 2.16 / rival 2.13 | user 2.32 / rival 1.81 | user 0.35 / rival 0.10 |

**Limitacao do proxy de tier:** Os campos `inner < 10min` e `nexusTurret < 20min` usam
proxy sequencial por lane para inferir o tier da torre (outer > inner > inhibTurret > nexusTurret).
Nao e leitura exata de `ev.map` porque o campo `tier` nao existe no `EventKind` atual.
Sera refinado nas Fases 17-22 quando o modulo de estrutura for extraido. Os numeros de inner/nexusTurret
devem ser lidos como aproximacoes, nao como contagens exatas.

---

## Combate

| Metrica | Equilibrado 70v70 | Gap-Leve 72v68 | Stomp 85v55 |
|---------|-------------------|----------------|-------------|
| Quadra < 8min (%) | 1.1% (9/800) | 1.6% (13/800) | 1.9% (15/800) |
| Ace < 8min (%) | 18.3% (146/800) | 17.5% (140/800) | 40.3% (322/800) |
| Casualty early (< 14min) | 4590 (31.7% do total) | 4441 (32.1% do total) | 3735 (60.7% do total) |
| Casualty mid (14-25min) | 4078 (28.1% do total) | 4077 (29.5% do total) | 2058 (33.5% do total) |
| Casualty late (> 25min) | 5827 (40.2% do total) | 5325 (38.5% do total) | 356 (5.8% do total) |

### Multikill por faixa de 5 minutos

#### Tier Equilibrado 70v70

| Faixa | Double | Triple | Quadra | Penta |
|-------|--------|--------|--------|-------|
| 0-5min | 132 | 37 | 4 | 0 |
| 5-10min | 324 | 77 | 10 | 1 |
| 10-15min | 359 | 79 | 14 | 1 |
| 15-20min | 349 | 79 | 13 | 1 |
| 20-25min | 845 | 205 | 38 | 2 |
| 25-30min | 745 | 175 | 27 | 1 |
| 30-35min | 491 | 124 | 19 | 1 |
| 35-40min | 243 | 69 | 8 | 0 |
| 40-45min | 108 | 30 | 7 | 0 |
| 45-50min | 34 | 6 | 1 | 0 |
| 50-55min | 2 | 1 | 0 | 0 |

#### Tier Gap-Leve 72v68

| Faixa | Double | Triple | Quadra | Penta |
|-------|--------|--------|--------|-------|
| 0-5min | 131 | 38 | 4 | 0 |
| 5-10min | 289 | 67 | 13 | 1 |
| 10-15min | 361 | 69 | 9 | 0 |
| 15-20min | 394 | 96 | 18 | 0 |
| 20-25min | 836 | 222 | 29 | 0 |
| 25-30min | 694 | 181 | 21 | 0 |
| 30-35min | 433 | 125 | 14 | 1 |
| 35-40min | 218 | 65 | 7 | 1 |
| 40-45min | 103 | 24 | 5 | 0 |
| 45-50min | 18 | 4 | 1 | 0 |
| 50-55min | 2 | 0 | 1 | 0 |

#### Tier Stomp 85v55

| Faixa | Double | Triple | Quadra | Penta |
|-------|--------|--------|--------|-------|
| 0-5min | 183 | 57 | 5 | 0 |
| 5-10min | 470 | 135 | 15 | 4 |
| 10-15min | 631 | 232 | 23 | 5 |
| 15-20min | 468 | 148 | 18 | 1 |
| 20-25min | 264 | 84 | 9 | 0 |
| 25-30min | 96 | 23 | 4 | 0 |
| 30-35min | 34 | 9 | 1 | 0 |
| 35-40min | 6 | 2 | 0 | 0 |
| 40-45min | 5 | 0 | 0 | 0 |

---

## Objetivos

| Metrica | Equilibrado 70v70 | Gap-Leve 72v68 | Stomp 85v55 |
|---------|-------------------|----------------|-------------|
| Baron total (800 jogos) | 1941 | 1859 | 415 |
| Baron no spawn exato 20:00 (%) | 12.9% (251/1941) | 13.2% (246/1859) | 28.7% (119/415) |
| Baron com setup forte (%) | 81.9% (1589/1941) | 82.5% (1533/1859) | 80.5% (334/415) |

### Top-5 atores de secure (Baron/Dragao/Herald combinados)

| Posicao | Equilibrado 70v70 | Gap-Leve 72v68 | Stomp 85v55 |
|---------|-------------------|----------------|-------------|
| 1 | u-jungle (2976) | u-jungle (3116) | u-jungle (2086) |
| 2 | r-jungle (2808) | r-jungle (2576) | r-jungle (980) |
| 3 | r-top (353) | u-top (350) | r-top (139) |
| 4 | u-top (351) | r-top (345) | u-top (133) |
| 5 | u-mid (63) | r-mid (61) | r-mid (24) |

**Sintoma Baron ao spawn:** Baron ao spawn exato (`timeSec === 1200`) sem gate de setup e
classificado como `rare` na taxonomia de plausibilidade, nao como `illegal` (pois o `isObjectiveAvailable`
permite `>= 1200`). O assert duro do harness cobre apenas `baronBeforeSpawn` (`timeSec < 1200`),
que nao ocorreu em nenhum dos 2400 jogos (invariante valido). O alto percentual de Baron no spawn
(~13% no equilibrado, ~29% no stomp) e o sintoma que as Fases 17-22 devem reduzir para `rare`.

---

## Tickers Contextuais

| Metrica | Equilibrado 70v70 | Gap-Leve 72v68 | Stomp 85v55 |
|---------|-------------------|----------------|-------------|
| Total eventos ctx_* | 0 | 0 | 0 |
| Com role generica (%) | 0 / 0 (0.0%) | 0 / 0 (0.0%) | 0 / 0 (0.0%) |

**Sintoma tickers ausentes:** O harness confirma que NENHUM evento `ctx_*` foi emitido em
2400 jogos com rosters sinteticos (overalls flat). Isso indica que `selectContextualTicker`
em `deathQuality.ts` nao retorna tickers contextuais nos cenarios de baseline -- possivelmente
porque as condicoes de deathQuality (lead, snowball, contexto de luta especifico) raramente sao
atingidas com rosters sinteticos sem `laneState` rico. A secao de tickers com role generica
medida pelo harness e 0/0 = nao mensuravel ate que tickers contextuais existam. O diagnostico
do Grupo 5 em `docs/ENGINE-DIAGNOSIS.md` continua valido como analise de codigo.

### Passada com Rosters Reais (players.json, 100 jogos)

| Metrica | Valor |
|---------|-------|
| user roster | Friend (Top 2023), Bengi 2015, Faker 2016, Uzi 2018, Wolf 2016 |
| rival roster | Zeus 2022, Canyon 2021, Caps 2019, Ruler 2022, Beryl 2021 |
| win-rate user | 29.0% |
| 1a torre p50 | 4:30 |
| quadra < 8min | 0.0% (0/100) |
| Baron no spawn (count) | 30 |
| tickers ctx_* com role generica | 0.0% |

---

## Seeds-ancora dos 8 Sintomas

Consultar a secao correspondente em `docs/ENGINE-DIAGNOSIS.md` (preenchida pelo Plano 04).

---

## Nota de Limitacao

**Proxy de tier (Pitfall 1):** Os campos `inner < 10min` e `nexusTurret < 20min` sao
inferidos via contagem sequencial por lane (a N-esima torre destruida na lane assume ser o
N-esimo tier: 1a = outer, 2a = inner, 3a = inhibTurret, 4a = nexusTurret). Isso subestima
ou superestima a contagem real porque o `EventKind` atual nao carrega o campo `tier` explicitamente.
Os valores de inner e nexusTurret neste baseline devem ser lidos como aproximacoes.

**Estado QUEBRADO documentado:** Este arquivo registra o comportamento da engine antes de
qualquer correcao das Fases 17-22. Os sintomas documentados (torre em 15s no stomp, ace <8min
em 18-40% das partidas, Baron no spawn em 13-29% dos casos, tickers contextuais ausentes)
sao exatamente os problemas de plausibilidade que as fases seguintes devem corrigir.

**Regua de comparacao:** Cada Fase 17-22 deve re-rodar `npm run calibrate:structures` com as
mesmas seeds (seed=i, i=0..799) e comparar as distribuicoes resultantes contra as tabelas
deste arquivo. Melhora = reducao das frequencias de eventos nearZero/rare para valores
condizentes com a taxonomia de plausibilidade.
