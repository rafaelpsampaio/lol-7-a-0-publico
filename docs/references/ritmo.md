# Stack Research: Números de Referência de Ritmo (v2.2)

**Domínio:** recalibração numérica de engine de simulação de partidas de LoL
**Pesquisado:** 2026-07-29
**Confiança geral:** ALTA para os números derivados de dataset primário, BAIXA para o que veio de busca web solta
**Escopo:** este documento **não** recomenda bibliotecas novas (ver §9). A seção principal é a **tabela de métricas de referência com fonte**.

---

## 1. TL;DR: o que mudou em relação ao que o projeto assumia

Consegui baixar e processar os **datasets primários** em vez de depender de artigos secundários. Três achados que contradizem a coluna "Referência pro (aprox.)" da tabela de sintomas em `PROJECT.md`:

| Métrica | `PROJECT.md` dizia | Dado medido | Veredito |
|---|---|---|---|
| Primeira torre | ~11 min | **15:00–16:40** (média, 4 amostras independentes) | ⚠️ **A referência do projeto está errada.** Calibrar para 11 min produziria uma engine rápida demais. |
| Kills por partida | ~22 | **25,1 (2023) / 26,2 (2024) / 29,0 (2025)** | ⚠️ Subestimado. A banda real é 25–29 e está **subindo** ano a ano. |
| Torres aos 20 min | ~2,5 | **3,72** (média Worlds 24+25) | ⚠️ Subestimado. |
| Kills aos 20 min | ~9 | **10,7** | Perto, levemente subestimado. |
| Duração média | ~31 min | **31,5–32,7 min** | ✅ Correto. |
| Torres/minuto | ~0,37 | **0,36–0,38** | ✅ Correto. |
| Barões/partida | ~1,3 (~70%) | **1,10–1,46 (86%–96% dos jogos)** | ⚠️ A **frequência** estava muito subestimada: quase todo jogo pro tem Baron. |
| Elder / Alma | ~28% / ~50% | **7,8%–8,5% / 39%–44%** | ⚠️ Elder é **muito mais raro** do que o projeto assume. |
| GPM por time | ~1.900 | **1.813 / 1.841 / 1.843** | ✅ Correto (levemente alto). |
| Assists do ADC | ~7 | **5,2–5,8** | ⚠️ Levemente superestimado, mas o ponto principal (nunca zero) está certo. |
| Acerto do favorito aos 20 min | ~70–75% | **78,2%** (por vantagem de ouro) | ⚠️ Subestimado. |

**Consequência prática para o roadmap:** as bandas-alvo do milestone precisam ser reescritas a partir da tabela §3 deste documento, não da tabela de `PROJECT.md`. Em particular, o alvo de primeira torre passa de "~11 min" para uma banda em torno de **14–18 min**.

---

## 2. Metodologia e fontes primárias

Não usei valores citados de artigos. Baixei os dados e calculei.

### Fonte A: Oracle's Elixir (dataset completo, CSV)

Tim Sevenhuysen mantém o dataset de referência do cenário competitivo de LoL. Os CSVs anuais estão publicados na pasta pública do Google Drive linkada em <https://oracleselixir.com/tools/downloads> (o bucket S3 antigo `oracleselixir-downloadable-match-data` foi desativado; a pasta atual é `1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH`).

| Ano | ID do arquivo no Drive | Tamanho | Linhas |
|---|---|---|---|
| 2023 | `1XXk2LO0CsNADBB1LRGOV5rUpyZdEZ8s2` | 86 MB | ~127k |
| 2024 | `1IjIEhLc9n8eLKeY-yh_YigKVWbhgGBsN` | 79 MB | ~118k |
| 2025 | `1v6LRphp2kYciU4SXp0PCjEMuev1bDejc` | 79 MB | ~120k |

```bash
curl -L "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t" \
  -o oe_<ano>.csv
```

Cada partida gera 12 linhas (10 jogadores + 2 linhas agregadas de time, `position == "team"`). Filtros aplicados: `datacompleteness in {complete, partial}`, exatamente 2 linhas de time por `gameid`, `gamelength >= 600s`.

**Pool "tier-1" usado:** LCK, LPL, LEC, LCS/LTA N, LTA S, LCP, WLDs, MSI. N por ano: 2023 = 2.007 partidas, 2024 = 1.895, 2025 = 2.056.

⚠️ **Limitação conhecida do dataset:** as linhas do **LPL** vêm com `datacompleteness = partial`. Elas têm duração, kills, torres, dragões, barões e ouro, mas **não** têm `turretplates`, `elders`, `elementaldrakes` nem os marcos `at10/15/20/25`. Por isso os N das métricas de placas/alma/elder são menores (~1.239 em vez de ~2.056). O viés é geográfico (exclui a LPL), não estatístico.

⚠️ **O que o Oracle's Elixir NÃO tem:** *timestamps* de eventos. Não existem colunas de "minuto da primeira torre" ou "minuto do first blood". Por isso a Fonte B.

### Fonte B: Feed oficial de live stats da Riot (`feed.lolesports.com`)

O feed público que alimenta o placar do lolesports.com expõe frames de estado a cada 10 segundos por partida:

```
GET https://feed.lolesports.com/livestats/v1/window/{gameId}?startingTime=<ISO8601>
```

Cada frame traz `blueTeam`/`redTeam` com `totalKills`, `towers`, `inhibitors`, `barons`, `dragons[]`, `totalGold`. Os `gameId` vêm de `https://esports-api.lolesports.com/persisted/gw/getCompletedEvents?tournamentId=<id>` (header de autenticacao usado pelo site; valor omitido).

O relógio de jogo 0:00 é identificado pelo primeiro frame com `totalGold == 2500` (5 jogadores × 500 de ouro inicial). Varredura de 0 a 26:40 em janelas de 100 s.

**Amostras coletadas:**

| Amostra | Torneio(s) | N partidas |
|---|---|---|
| Worlds 2023 | `worlds_2023` | 110 |
| Worlds 2024 | `worlds_2024` | 106 |
| Worlds 2025 | `worlds_2025` | 83 |
| Multi-liga 2026 | MSI, EWC, LEC, LCS, LCP, LJL, VCS, NACL, EM, CBLOL | 204 |
| Snapshots de estado | Worlds 2024 + 2025 combinados | 190 |

⚠️ **Limitações:** resolução de ±10 s; censura à direita em 26:40 (partidas cujo primeiro objetivo caiu depois disso saem da amostra, ~1 de 83 no Worlds 2025); os snapshots de 30 e 35 min sofrem **viés de sobrevivência** (só partidas longas chegam lá).

### Nível de confiança por fonte

O seam `classify-confidence` do GSD classifica providers, não datasets. Ele devolve:

| Provider usado | Veredito do seam |
|---|---|
| `webfetch` / `websearch` (download e busca) | `LOW` |
| `npm` (registry, versões de biblioteca) | `LOW` |

Registro o veredito do seam por honestidade de protocolo, **mas anoto explicitamente**: os números das §3–§7 não são "achados numa busca". São agregações de datasets primários com N declarado e comando de reprodução publicado acima. Trato-os como **ALTA confiança** com base na evidência (dataset público + método reproduzível + concordância entre duas fontes independentes), e marco como BAIXA apenas os poucos itens que dependeram de busca web.

---

## 3. TABELA MESTRA DE REFERÊNCIA

Esta é a seção que o roadmap deve consumir. Onde há variação relevante por ano ou liga, dou **faixa**, não número único.

| # | Métrica | Faixa de referência (pro play) | Melhor ponto único | Fonte | N | Confiança |
|---|---|---|---|---|---|---|
| 1 | Duração média da partida | **31,5–32,7 min** | 32,3 min | OE 2023–2025, tier-1 | 5.958 | ALTA |
| 2 | Duração p10 / p50 / p90 | 25–27 / 30,8–31,6 / 38,8–40,1 min | 26,5 / 31,5 / 39,5 | OE 2023–2025 | 5.958 | ALTA |
| 3 | % de partidas < 25 min | **2,3%–9,8%** (caindo) | 6% | OE 2023–2025 | 5.958 | ALTA |
| 4 | % de partidas > 40 min | **7,9%–10,2%** | 9% | OE 2023–2025 | 5.958 | ALTA |
| 5 | % de partidas > 60 min | **0,00%** (máximo observado: 59:18) | 0% | OE 2023–2025 | 5.958 | ALTA |
| 6 | Abates totais por partida | **25,1–29,0** (subindo) | 27 | OE 2023–2025 | 5.958 | ALTA |
| 7 | Abates, split vencedor/perdedor | **17,3–19,9 / 7,8–9,2** (razão ~2,1–2,2:1) | 18,3 / 8,5 | OE 2023–2025 | 5.958 | ALTA |
| 8 | Abates por minuto | **0,81–0,89** | 0,84 | OE 2023–2025 | 5.958 | ALTA |
| 9 | Torres destruídas por partida | **11,66–12,12** | 11,9 | OE 2023–2025 | 5.958 | ALTA |
| 10 | Torres, split vencedor/perdedor | **9,0–9,2 / 2,6–2,9** | 9,15 / 2,75 | OE 2023–2025 | 5.958 | ALTA |
| 11 | Torres por minuto | **0,36–0,38** | 0,37 | OE 2023–2025 | 5.958 | ALTA |
| 12 | Inibidores por partida | **1,64–1,80** | 1,75 | OE 2023–2025 | 5.958 | ALTA |
| 13 | **Timing da primeira torre** | **15:04–16:37** (média) | **16:10** | Feed Riot, Worlds 23/24/25 + 2026 | 500 | ALTA |
| 14 | Primeira torre p10 / p50 / p90 | 11:45–14:50 / 14:57–16:38 / 18:13–20:00 | 13:45 / 16:15 / 18:50 | Feed Riot | 500 | ALTA |
| 15 | **Timing do first blood** | **5:19–6:33** (média), mediana **~5:00** | 5:50 | Feed Riot, 4 amostras | 503 | ALTA |
| 16 | First blood p10 / p90 | 3:12–3:17 / 8:18–11:33 | 3:15 / 10:00 | Feed Riot | 503 | ALTA |
| 17 | % de partidas sem nenhum abate até 10:00 | **11,0%** | 11% | OE 2024+2025 (`killsat10 == 0`) | 4.491 | ALTA |
| 18 | Timing do primeiro dragão | **8:40–9:36** | 9:10 | Feed Riot | 497 | ALTA |
| 19 | Dragões por partida | **4,37–4,51** | 4,45 | OE 2023–2025 | 5.958 | ALTA |
| 20 | **% de partidas com Alma do Dragão** | **39,3%–44,2%** | 42% | OE 2023–2025 (`elementaldrakes >= 4`) | 3.717 | ALTA |
| 21 | Barões por partida | **1,10–1,46** | 1,3 | OE 2023–2025 | 5.958 | ALTA |
| 22 | **% de partidas com ≥ 1 Baron** | **86,5%–96,4%** | 93% | OE 2023–2025 | 5.958 | ALTA |
| 23 | **% de partidas em que o Elder é tomado** | **7,8%–8,5%** | 8,2% | OE 2023–2025 | 3.717 | ALTA |
| 24 | Ouro total por time no fim | **57,0k–60,2k** | 59,3k | OE 2023–2025 | 11.916 times | ALTA |
| 25 | Ouro por minuto por time | **1.813–1.843** | 1.833 | OE 2023–2025 | 11.916 | ALTA |
| 26 | GPM vencedor / perdedor | **1.980–2.006 / 1.647–1.681** | 1.996 / 1.669 | OE 2023–2025 | 11.916 | ALTA |
| 27 | Diferença de ouro vencedor − perdedor no fim | **9,8k–10,2k** (p10 ≈ 4,8k, p90 ≈ 14,6k) | 10,0k | OE 2023–2025 | 5.958 | ALTA |
| 28 | **Placas de torre coletadas por partida** | **7,24–8,90** de 30 possíveis (~24%–30%) | 8,2 | OE 2023–2025 | 3.717 | ALTA |
| 29 | Acerto do favorito aos 20 min (lead de ouro) | **78,2%** | 78,2% | OE 2024+2025 | 4.881 | ALTA |
| 30 | Acerto do favorito aos 15 / 25 min | **71,6% / 83,0%** | — | OE 2024+2025 | 4.884 / 4.747 | ALTA |
| 31 | Atakhan (novo em 2025) por partida | **99,1% das partidas** | 99% | OE 2025 | 1.238 | ALTA |

---

## 4. Detalhe por métrica, com distribuição e variação por ano

### 4.1 Duração da partida

Pool tier-1 (LCK, LPL, LEC, LCS/LTA N, WLDs, MSI):

| Ano | N | média | sd | p10 | p25 | p50 | p75 | p90 | mín | máx | %<25 | %<30 | %>35 | %>40 | %>45 | %>60 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2023 | 2.007 | 31,45 | 5,40 | 25,05 | 27,64 | 30,75 | 34,55 | 38,82 | 16,83 | 54,85 | 9,8% | 42,7% | 22,7% | 7,9% | 1,6% | **0%** |
| 2024 | 1.895 | 32,38 | 5,61 | 26,01 | 28,43 | 31,55 | 35,59 | 40,11 | 17,57 | 55,15 | 6,3% | 37,2% | 28,0% | 10,2% | 2,9% | **0%** |
| 2025 | 2.056 | 32,69 | 5,22 | 27,28 | 28,88 | 31,58 | 35,40 | 39,78 | 20,45 | 59,30 | 2,3% | 35,8% | 27,3% | 9,6% | 2,8% | **0%** |

**Forma da distribuição:** assimétrica à direita, mas de cauda curta. Média > mediana em ~1,1 min. A cauda longa é fina: menos de 3% acima de 45 min e **nada** acima de 60 min em 5.958 partidas. Em 2025 o piso subiu (mínimo 20:45, apenas 2,3% abaixo de 25 min), ou seja a distribuição está ficando **mais concentrada**, não mais dispersa.

Variação por liga (2025, N ≥ 200):

| Liga | N | média | p10 | p50 | p90 | %<25 | %>40 |
|---|---|---|---|---|---|---|---|
| LPL | 805 | 32,47 | 27,1 | 31,37 | 39,75 | 2,9% | 9,4% |
| LCK | 555 | 32,26 | 27,1 | 31,07 | 39,30 | 2,7% | 8,5% |
| LEC | 306 | 33,59 | 27,7 | 32,56 | 41,71 | 1,3% | 12,4% |
| LCP | 291 | 32,31 | 26,9 | 30,95 | 39,70 | 2,4% | 9,3% |
| PCS | 302 | 30,14 | 24,5 | 29,36 | 36,31 | 11,6% | 5,6% |
| LTA N | 214 | 33,40 | 27,9 | 32,45 | 40,70 | 0,9% | 11,2% |
| WLDs | 96 | 32,62 | 27,2 | 31,77 | 38,70 | 3,1% | 8,3% |

**Conclusão:** a variação entre ligas tier-1 é pequena (32,3 ± 0,7 min). A PCS é a única outlier consistente (~2 min mais curta). A variação **entre anos** (31,5 → 32,7) é da mesma ordem que a variação entre ligas. Uma banda-alvo única de **30–34 min de média** cobre todo o cenário competitivo moderno.

### 4.2 Abates

| Ano | N | média | sd | p10 | p25 | p50 | p75 | p90 | mín | máx | vencedor | perdedor | kills/min |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2023 | 2.007 | 25,09 | 8,16 | 15 | 19 | 24 | 30 | 36 | 6 | 65 | 17,30 | 7,79 | 0,81 |
| 2024 | 1.895 | 26,17 | 8,28 | 16 | 20 | 25 | 31 | 37 | 6 | 64 | 17,69 | 8,49 | 0,82 |
| 2025 | 2.056 | 29,03 | 8,28 | 19 | 23 | 28 | 34 | 40 | 7 | 66 | 19,86 | 9,17 | 0,89 |

**Tendência clara e forte:** +16% de abates de 2023 para 2025, com duração praticamente constante. O jogo pro está ficando mais sangrento por minuto. Se a engine for calibrada contra 2023, ficará defasada.

**Razão vencedor:perdedor = 2,1:1 a 2,2:1**, muito estável entre anos. Esta é uma proporção-chave para a engine: o vencedor mata pouco mais que o dobro.

Variação por liga (2025): PCS 38,6 (outlier alto), LPL 30,1, WLDs 30,3, LCK 28,8, LTA S 28,4, LCP 27,8, LEC 27,1. A faixa útil é **27–31** para tier-1.

### 4.3 Torres, inibidores e placas

| Ano | torres total | p10/p50/p90 | vencedor | perdedor | torres/min | inibidores | placas |
|---|---|---|---|---|---|---|---|
| 2023 | 11,92 | 9 / 12 / 15 | 9,23 | 2,69 | 0,38 | 1,80 | 8,90 |
| 2024 | 12,12 | 10 / 12 / 15 | 9,22 | 2,90 | 0,38 | 1,80 | 8,50 |
| 2025 | 11,66 | 9 / 11 / 14 | 9,02 | 2,64 | 0,36 | 1,64 | 7,24 |

Observações relevantes para a engine:

- **O vencedor derruba ~9 torres, não 11.** Uma partida típica termina com o vencedor tendo derrubado 9 das 11 torres do inimigo (sobram tipicamente 2, e o Nexus cai antes de limpar o mapa).
- **A razão torres/abates é ~0,41** (11,9 torres ÷ 27 abates). Estável nos três anos.
- **Placas:** 7,2–8,9 por partida de **30 possíveis** (5 por torre externa × 3 torres × 2 times). Ou seja, só ~25%–30% das placas do jogo são coletadas. p10 ≈ 3–5, p90 ≈ 12–13. Tendência de queda ano a ano.
- Inibidores: mediana 1 (2025) a 2 (2023/2024). A partida típica é decidida abrindo **uma** rota.

### 4.4 Timings de primeiro evento (fonte: feed oficial da Riot)

| Amostra | N | First blood média | p10 | p50 | p90 | mín | máx |
|---|---|---|---|---|---|---|---|
| Worlds 2023 | 110 | 6:26 | 3:15 | 5:00 | 9:57 | 1:31 | 19:52 |
| Worlds 2024 | 106 | 6:20 | 3:12 | 4:58 | 11:33 | 1:32 | 19:56 |
| Worlds 2025 | 83 | 6:33 | 3:17 | 5:00 | 11:12 | 1:33 | 18:18 |
| Multi-liga 2026 | 204 | 5:19 | 3:13 | 4:54 | 8:18 | 1:32 | 16:39 |

| Amostra | N | **Primeira torre** média | sd | p10 | p25 | p50 | p75 | p90 | mín | máx |
|---|---|---|---|---|---|---|---|---|---|---|
| Worlds 2023 | 109 | **16:24** | 2:07 | 14:33 | 14:58 | 16:34 | 18:10 | 18:19 | 11:31 | 24:59 |
| Worlds 2024 | 106 | **15:04** | 2:28 | 11:45 | 13:19 | 14:57 | 16:34 | 18:13 | 8:15 | 23:20 |
| Worlds 2025 | 82 | **16:37** | 2:13 | 14:50 | 16:30 | 16:38 | 18:14 | 18:20 | 9:55 | 25:03 |
| Multi-liga 2026 | 203 | **16:22** | 2:42 | 13:15 | 14:52 | 16:34 | 18:15 | 19:55 | 9:51 | 26:38 |

Por liga na amostra 2026: MSI 15:36 (n=71), EM 15:18 (n=9), CBLOL 15:56 (n=5), LJL 15:58 (n=16), VCS 16:09 (n=8), LEC 16:10 (n=8), LCS 16:24 (n=8), LCP 16:24 (n=8), Prime League 17:06 (n=30), EWC 17:25 (n=51), NACL 17:28 (n=19), LRN 19:05 (n=24).

**Este é o achado mais importante do documento.** Quatro amostras independentes, três anos, dez ligas, todas convergindo em **15–17 minutos** para a primeira torre. A referência de "~11 min" usada no diagnóstico do projeto não corresponde ao LoL moderno. Causa provável: desde a introdução das placas de torre (2019) e os buffs sucessivos de resistência das torres externas, é raro uma torre externa cair antes dos 14 minutos, e times pro raramente forçam torre antes de ter o Arauto ou uma vantagem de composição.

**Nunca antes de ~8 minutos.** O mínimo absoluto em 500 partidas foi 8:15. Isso é útil como regra dura de plausibilidade: primeira torre antes de 8:00 deveria ser `illegal` ou `nearZero` na taxonomia da v2.0.

Primeiro dragão: 8:40–9:36 de média, mínimo consistente em ~6:31 (o primeiro drake nasce aos 5:00, mas os times raramente o pegam antes de 6:30).

**Corroboração independente do first blood via Oracle's Elixir:** de 4.491 partidas tier-1 com dados completos (2024+2025), **11,04% não tiveram nenhum abate até 10:00**, 3,96% até 15:00 e 3,07% até 20:00. Isso é consistente com uma média de FB em torno de 5–6 min e cauda longa fina.

### 4.5 Objetivos épicos

| Ano | dragões/partida | barões/partida | % com ≥ 1 baron | % com Alma | % com Elder | % com Atakhan |
|---|---|---|---|---|---|---|
| 2023 | 4,37 | 1,46 | 96,3% | 44,2% | 7,8% | n/a |
| 2024 | 4,51 | 1,46 | 96,4% | 39,3% | 8,5% | n/a |
| 2025 | 4,51 | 1,10 | 86,5% | 42,9% | 8,3% | 99,1% |

Notas de leitura:

- **Baron é quase universal**, não raro: 86%–96% das partidas têm pelo menos um. A queda em 2025 (1,46 → 1,10 barões, 96% → 86%) é real e provavelmente ligada às mudanças de mapa de 2025 (Atakhan, Baron com variantes), não ruído: N = 2.056.
- **Alma sai em ~4 de cada 10 partidas.** Faz sentido: exige 4 drakes de um mesmo time, e a média total é 4,5 drakes por partida somando os dois lados.
- **Elder é raro: ~8%.** Só desbloqueia depois da Alma, e a maioria das partidas termina antes. A referência de "~28%" do `PROJECT.md` está 3,4× alta.
- **Atakhan (2025+) aparece em 99% das partidas.** Se a engine algum dia modelar Atakhan, é praticamente determinístico.

Variação por liga em 2025 é notável para Alma: LEC 48,0% e LTA S 48,6% no topo, PCS 30,5% no fundo, WLDs 56,0%. Elder: 4,3% (PCS) a 10,0% (MSI). Faixa honesta: **Alma 30%–50%, Elder 4%–10%**.

### 4.6 Economia

| Ano | ouro/time (fim) | vencedor | perdedor | diff W−L | GPM time | GPM vencedor | GPM perdedor |
|---|---|---|---|---|---|---|---|
| 2023 | 56.997 | 61.938 | 52.055 | 9.883 | 1.813 | 1.980 | 1.647 |
| 2024 | 59.601 | 64.491 | 54.710 | 9.781 | 1.841 | 2.001 | 1.681 |
| 2025 | 60.215 | 65.303 | 55.128 | 10.175 | 1.843 | 2.006 | 1.680 |

Distribuição do ouro de time no fim (2025): p10 46,3k, p25 52,2k, p50 59,6k, p75 66,9k, p90 74,5k.
Distribuição da diferença W−L (2025): p10 5,3k, p25 7,8k, p50 10,5k, p75 12,8k, p90 14,7k. **Mínimo −3,7k**: sim, times perdem partidas estando à frente no ouro.

**GPM tem variância surpreendentemente baixa.** O desvio-padrão do GPM de time é ~190 sobre uma média de 1.842 (≈10%), e o GPM do vencedor fica em 2.006 ± 98. Isso significa que a **taxa de ouro é quase uma constante física do jogo**: quem está ganhando gera ~2.000 g/min de time, quem está perdendo ~1.680 g/min. A razão vencedor/perdedor é **1,19:1**, muito estável.

Ouro por time nos marcos de tempo (média, 2025 / 2024 / 2023):

| Marco | 2025 | 2024 | 2023 |
|---|---|---|---|
| 10:00 | 15.918 | 15.934 | 15.778 |
| 15:00 | 24.724 | 25.165 | 24.900 |
| 20:00 | 34.228 | 34.703 | 34.278 |
| 25:00 | 43.534 | 44.041 | 43.486 |

Praticamente idênticos nos três anos. A curva de ouro é a coisa mais estável do jogo. Ajustando: ~15,9k aos 10, depois **+1.870 g/min** entre 10 e 15, **+1.900 g/min** entre 15 e 20, **+1.860 g/min** entre 20 e 25. Nota: inclui os 2.500 de ouro inicial.

### 4.7 KDA e participação em abate por rota

Pool tier-1, linhas de jogador. `bot` = ADC, `jng` = jungle, `sup` = support.

**2025 (n = 4.112 linhas por rota):**

| Rota | K méd | K p50 | K p90 | D méd | D p50 | D p90 | A méd | A p50 | A p90 | KP méd | KP p10 | KP p90 | earned GPM | dano % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| top | 2,75 | 2 | 6 | 2,91 | 3 | 5 | 5,60 | 5 | 11 | **56,2%** | 33,3% | 80,0% | 252 | 22,3% |
| jng | 3,05 | 3 | 6 | 2,99 | 3 | 6 | 7,63 | 7 | 14 | **73,4%** | 52,0% | 94,1% | 234 | 16,6% |
| mid | 3,45 | 3 | 7 | 2,66 | 3 | 5 | 6,52 | 6 | 12 | **67,5%** | 44,4% | 88,9% | 276 | 25,6% |
| bot | 4,57 | 4 | 9 | 2,38 | 2 | 5 | 5,78 | 5 | 11 | **70,0%** | 48,3% | 90,9% | 310 | 27,8% |
| sup | 0,70 | 0 | 2 | 3,60 | 3 | 6 | 10,26 | 10 | 18 | **74,8%** | 50,0% | 95,0% | 116 | 7,8% |

**2024 (n = 3.790):** top 2,49/2,74/4,85 KP 54,9%; jng 2,35/2,67/7,26 KP 73,4%; mid 3,48/2,36/5,35 KP 66,7%; bot 4,03/2,18/5,22 KP 69,3%; sup 0,73/3,17/8,80 KP 72,3%.

**2023 (n = 4.014):** top 2,31/2,58/4,54 KP 53,2%; jng 2,31/2,66/6,71 KP 72,3%; mid 3,16/2,39/5,27 KP 66,2%; bot 4,09/2,19/4,56 KP 67,2%; sup 0,68/2,75/8,55 KP 72,4%.

Padrões estáveis nos três anos, úteis como invariantes de calibração:

1. **Ordem de abates:** ADC > mid > jungle ≈ top >> support. O ADC mata ~6,5× mais que o support.
2. **Ordem de assistências:** support > jungle > mid > **ADC** > top. O ADC é o **quarto** em assistências, não o último, e nunca fica em zero: média **5,2–5,8 assists**. Isso confirma diretamente o bug descrito no milestone (`assignAssists` corta em n ≤ 3 e o ADC nunca entra). A referência de "~7" do `PROJECT.md` está um pouco alta; a banda real é **5–6**.
3. **Ordem de participação em abate:** support (74,8%) > jungle (73,4%) > ADC (70,0%) > mid (67,5%) >> top (56,2%). O top é o único claramente isolado, e sua KP tem a cauda mais longa para baixo (p10 = 33%).
4. **Ordem de mortes:** support (3,60) > jungle (2,99) ≈ top (2,91) > mid (2,66) > ADC (2,38).
5. **Ordem de ouro ganho por minuto:** ADC (310) > mid (276) > top (252) > jungle (234) >> support (116). O support recebe **37% do ouro do ADC**.
6. **Ordem de dano:** ADC (27,8%) > mid (25,6%) > top (22,3%) > jungle (16,6%) >> support (7,8%).
7. Todas as 5 rotas tiveram aumento de assistências de 2023 para 2025, consistente com o aumento geral de abates.

---

## 5. Curva de estado ao longo da partida (o dado mais útil para "ritmo")

Snapshots do feed oficial da Riot, Worlds 2024 + 2025 combinados. Cada linha é o estado **agregado dos dois times** naquele minuto.

| Minuto | N vivas | Abates (méd / p10 / p50 / p90) | Torres (méd / p10 / p50 / p90) | % jogos com ≥1 torre | Ouro total (2 times) | \|Δouro\| médio | Dragões | Barões | Inibidores |
|---|---|---|---|---|---|---|---|---|---|
| 10:00 | 190 | **3,24** / 0 / 3 / 6 | **0,03** / 0 / 0 / 0 | **2,6%** | 30.706 | 793 | 0,76 | 0 | 0 |
| 15:00 | 190 | **6,49** / 2 / 6 / 11 | **0,85** / 0 / 0 / 3 | **46,8%** | 48.514 | 1.569 | 1,61 | 0 | 0 |
| 20:00 | 190 | **10,69** / 5 / 10 / 17 | **3,72** / 1 / 4 / 6 | **96,8%** | 67.457 | 2.731 | 2,49 | 0 | 0 |
| 25:00 | 184 | **16,32** / 8,3 / 16 / 24,7 | **5,51** / 3 / 5,5 / 8 | 98,9% | 86.026 | 4.275 | 3,38 | 0,27 | 0,08 |
| 30:00 | 124 | 20,73 / 13 / 20,5 / 30 | 7,23 / 5 / 7 / 10 | 98,4% | 104.719 | 4.812 | 4,10 | 0,78 | 0,31 |
| 35:00 | 65 | 25,31 / 16 / 25 / 35,6 | 9,40 / 6,4 / 9 / 13 | 100% | 121.888 | 4.717 | 4,83 | 1,26 | 0,65 |

⚠️ As linhas de 30 e 35 min têm **viés de sobrevivência**: só partidas que ainda não acabaram entram. Trate 10/15/20/25 como confiáveis e 30/35 como indicativas.

Corroboração da curva de abates pelo Oracle's Elixir (independente, N muito maior):

| Marco | OE 2025 (n=1.239) | OE 2024 (n=1.087) | OE 2023 (n=1.239) | Feed Riot (n=190) |
|---|---|---|---|---|
| 10:00 | 3,23 | 3,33 | 3,59 | 3,24 |
| 15:00 | 6,40 | 6,74 | 6,69 | 6,49 |
| 20:00 | 10,81 | 10,57 | 10,46 | 10,69 |
| 25:00 | 16,28 | 15,50 | 14,97 | 16,32 |

Concordância excelente entre duas fontes independentes. Isso valida o método do feed e, por extensão, os timings de primeira torre.

**A forma do ritmo, em uma frase:** o LoL pro é **quase vazio até os 14 minutos** (3 abates, zero torre), **acelera entre 15 e 20** (a primeira torre cai e leva mais 3 junto), e **explode depois dos 20** (kills passam de 10 para 16 em 5 minutos, ouro dispara, Baron entra em jogo). A engine atual, com 15,9 abates e 0,27 torres aos 20, tem os dois eixos **invertidos**: sangue demais cedo, estrutura de menos sempre.

**Razões-chave derivadas (para asserts de harness):**

| Razão | Valor pro | Como usar |
|---|---|---|
| torres ÷ abates (fim de jogo) | **0,41** | invariante de proporção entre as duas camadas |
| abates aos 20 ÷ abates no fim | **0,39** | metade do sangue acontece depois dos 20 min |
| torres aos 20 ÷ torres no fim | **0,32** | dois terços das torres caem depois dos 20 min |
| ouro aos 20 ÷ ouro no fim | **0,56** | a curva de ouro é bem mais linear que a de eventos |
| GPM vencedor ÷ GPM perdedor | **1,19** | separação econômica muito menor do que a de abates |
| abates vencedor ÷ abates perdedor | **2,15** | separação de combate é 2× |
| torres vencedor ÷ torres perdedor | **3,35** | separação estrutural é a mais extrema das três |

Este último bloco é provavelmente o mais valioso do documento: **o vencedor separa muito mais em torres (3,3×) do que em abates (2,2×), e muito mais em abates do que em ouro (1,19×).** Se a engine tem essa ordem trocada, o ritmo não vai parecer LoL por mais que as médias batam.

---

## 6. Curva de win-rate e poder preditivo (para a track de win probability)

Oracle's Elixir 2024 + 2025, ligas tier-1 e semi (LCK, LPL, LEC, LCS/LTA, LCP, PCS, VCS, LCKC, WLDs, MSI). N = 13.018 linhas de time.

### 6.1 Win rate por vantagem de ouro no marco

| Δouro | @15:00 | @20:00 | @25:00 |
|---|---|---|---|
| < −8.000 | 0,0% (n=20) | 0,0% (n=222) | 0,7% (n=832) |
| −8.000 a −5.000 | 2,0% | 4,3% | 2,9% |
| −5.000 a −3.000 | 8,0% | 10,3% | 13,4% |
| −3.000 a −1.500 | 21,4% | 24,9% | 26,7% |
| −1.500 a −500 | 36,7% | 36,4% | 40,3% |
| −500 a +500 | 50,1% | 50,0% | 50,0% |
| +500 a +1.500 | 63,1% | 63,5% | 59,6% |
| +1.500 a +3.000 | 78,6% | 75,2% | 73,3% |
| +3.000 a +5.000 | 92,0% | 89,7% | 86,6% |
| +5.000 a +8.000 | 98,0% | 95,7% | 97,1% |
| > +8.000 | 100,0% (n=20) | 100,0% (n=222) | 99,3% (n=832) |

**Acerto do "favorito" (qualquer lead de ouro):** 71,6% aos 15 min, **78,2% aos 20 min**, 83,0% aos 25 min.
Por lead de **abates** em vez de ouro: 71,2% / 76,4% / 82,2%. Praticamente idêntico.

Duas leituras importantes para o milestone:

1. O alvo de "~70–75% de acerto aos 20 min" do `PROJECT.md` está **baixo**. O valor real é **78,2%**.
2. **Win-rate de 100% existe de verdade em pro play**, mas só em estados de jogo extremos (≥ 8k de ouro aos 20 min, n = 222, zero reviravoltas). O que **não** pode dar 100% é a curva de **diferença de força dos jogadores** (o sintoma "gap 30 → 100%"). São coisas diferentes e o roadmap deve separá-las: achatar a curva de força **não** deve achatar a curva de estado de jogo.

### 6.2 Win rate por objetivo conquistado

| Objetivo | N | Win rate |
|---|---|---|
| First blood | 6.503 | **58,6%** |
| Primeiro dragão | 6.507 | 57,6% |
| Primeiro Arauto | 4.856 | 64,2% |
| Primeira torre | 6.509 | **68,2%** |
| Primeira torre do meio | 4.884 | 73,4% |
| Primeiro a 3 torres | 4.884 | 78,3% |
| Atakhan (≥1) | 2.693 | 78,9% |
| Baron (≥1) | 6.570 | 82,8% |
| Elder (≥1) | 423 | 83,5% |
| Primeiro Baron | 4.358 | **85,4%** |
| Alma do Dragão | 1.981 | **90,8%** |
| Inibidor (≥1) | 6.875 | **94,7%** |

Escada de importância bem definida: first blood (+8,6 pp) < dragão < arauto < torre (+18,2 pp) < baron (+35,4 pp) < alma (+40,8 pp) < inibidor (+44,7 pp). Se a engine usa pesos de win-prob por evento, esta tabela é a régua.

### 6.3 Distribuição de |Δouro| por marco (para escala de "quão desequilibrado é normal")

| Marco | N | média | p25 | p50 | p75 | p90 | p99 | máx |
|---|---|---|---|---|---|---|---|---|
| 10:00 | 9.768 | 952 | 361 | 774 | 1.354 | 1.985 | 3.380 | 7.330 |
| 15:00 | 9.768 | 1.839 | 689 | 1.482 | 2.571 | 3.900 | 6.759 | 12.425 |
| 20:00 | 9.762 | 3.086 | 1.229 | 2.540 | 4.377 | 6.373 | 10.801 | 16.712 |
| 25:00 | 9.494 | 4.735 | 1.935 | 4.041 | 6.820 | 9.957 | 14.793 | 19.029 |

A dispersão econômica cresce ~linearmente: |Δouro| mediano dobra a cada 5 minutos entre 10 e 20 min. Bom teste de snowball: se a engine mantém |Δouro| mediano abaixo de ~2.500 aos 20 min, o snowball está fraco; se passa de ~5.000, está forte demais.

---

## 7. Como traduzir isso em bandas-alvo (recomendação, não dado)

⚠️ Esta seção é **opinião derivada**, não medição. Está separada de propósito. As bandas abaixo abrem a faixa pro em ~±15% porque o simulador também precisa funcionar para amadores (overall 35–70), e o critério declarado do milestone é acertar a **forma** e as **proporções**, não o valor absoluto de uma liga.

| Métrica | Banda pro medida | Banda-alvo sugerida para o cenário equilibrado 75×75 | Assert duro sugerido |
|---|---|---|---|
| Duração média | 31,5–32,7 | **29–36 min** | — |
| % no cap de 60 min | 0,00% | **< 0,5%** | `illegal` acima de 1% |
| % < 25 min | 2%–10% | **1%–12%** | — |
| % > 45 min | 1,6%–2,9% | **< 8%** | — |
| Primeira torre (média) | 15:04–16:37 | **13:00–19:00** | `illegal` antes de **7:00** (mínimo observado em 500 jogos: 8:15) |
| First blood (média) | 5:19–6:33 | **4:00–8:00** | — |
| % de jogos sem abate até 10:00 | 11,0% | **5%–20%** | — |
| Abates por partida | 25–29 | **22–34** | — |
| Razão abates vencedor:perdedor | 2,15 | **1,8–2,6** | — |
| Torres por partida | 11,7–12,1 | **10–14** | vencedor nunca > 11 |
| Torres/minuto | 0,36–0,38 | **0,30–0,45** | — |
| Razão torres:abates | 0,41 | **0,33–0,55** | — |
| Torres aos 20 min | 3,72 | **2,5–5,0** | — |
| Abates aos 20 min | 10,7 | **8–14** | — |
| Barões por partida | 1,10–1,46 | **0,9–1,8** | `illegal` antes de 20:00 (já garantido na v2.0) |
| % de jogos com ≥1 Baron | 86%–96% | **75%–98%** | — |
| Dragões por partida | 4,4–4,5 | **3,8–5,2** | — |
| % com Alma | 39%–44% | **30%–55%** | — |
| % com Elder | 7,8%–8,5% | **4%–18%** | `rare`, nunca > 30% |
| GPM por time | 1.813–1.843 | **1.650–2.050** | — |
| Δouro W−L no fim | 9,8k–10,2k | **7k–14k** | — |
| Placas por partida | 7,2–8,9 | **5–12** (de 30) | — |
| Assists do ADC | 5,2–5,8 | **4–8**, e **nunca 0** | assert duro: média > 2 |
| KP: sup ≥ jng ≥ adc ≥ mid > top | — | manter a **ordem**, tolerar ±8 pp nos valores | assert de ordenação |
| Acerto do favorito aos 20 min | 78,2% | **70%–85%** | — |
| Win-rate com gap de força 30 | n/a | **< 97%** | nunca exatamente 100% |

**Sobre o alvo de amadores:** não achei fonte confiável e citável para distribuição de partidas de baixo elo (ver §10). A recomendação prática é usar as **mesmas proporções** e afrouxar a duração para cima (jogos amadores são mais longos e mais bagunçados: mais abates por minuto, torres mais lentas). Como o milestone declara que o critério é forma e proporção, isso é suficiente sem inventar números.

---

## 8. O que NÃO fazer

| Evitar | Por quê | Fazer em vez disso |
|---|---|---|
| Calibrar primeira torre para ~11 min | Referência desatualizada. Quatro amostras independentes dizem 15–17 min. Torre cedo demais cascateia e encurta artificialmente a partida | Banda 13:00–19:00, chão duro em 7:00 |
| Usar um único número de liga como alvo | LEC 33,6 min vs PCS 30,1 min; PCS 38,6 abates vs LEC 27,1. A variação entre ligas é real | Usar as faixas da §3 |
| Calibrar contra dados de 2023 | Abates subiram 16% em dois anos com duração constante. 2023 já é ritmo antigo | Priorizar 2025, usar 2024 como corroboração |
| Tratar Elder como comum | Só 8% das partidas. A engine hoje faz 91,7% | `rare` na taxonomia, não `plausible` |
| Tratar Baron como raro | 86%–96% das partidas têm pelo menos um. O `PROJECT.md` dizia ~70% | Alvo ~1,3 barões e ~90% dos jogos |
| Achatar a curva de win-prob por **estado de jogo** | Com 8k de vantagem aos 20 min o time realmente ganha 100% das vezes (n = 222) | Achatar só a curva de **diferença de força dos jogadores** |
| Usar `datacompleteness = partial` (LPL) para métricas de placa/alma/elder | Essas colunas vêm vazias e enviesam a média para baixo | Filtrar por `complete` nessas métricas específicas |
| Comparar GPM individual com GPM de time | O `earned gpm` do OE é por jogador e **exclui** renda passiva; o GPM de time (~1.842) é `totalgold / minutos` e inclui tudo | Não misturar as duas escalas |

---

## 9. Pergunta 2: vale adicionar dependência de estatística?

**Recomendação: NÃO. Manter funções próprias, e refatorar as que já existem para um módulo compartilhado.**

### Estado atual do projeto

O harness já implementa o que precisa, três vezes:

- `scripts/calibrate-combat.ts:63`, `function percentile(sorted, p)`
- `scripts/calibrate-objectives.ts:69`, mesma função
- `scripts/calibrate-structures.ts:255`, mesma função

Dependências de produção hoje: `exceljs`, `solid-js`, `zod`. Dev: `vitest`, `vite`, `typescript`, `playwright`, `@solid-primitives/storage`, `vite-plugin-solid`. Uma árvore enxuta e deliberada.

### Bibliotecas avaliadas (registry npm, consultado 2026-07-29)

| Biblioteca | Versão atual | Deps | Tipos TS | Veredito |
|---|---|---|---|---|
| `simple-statistics` | 7.9.3 | **0** | inclusos | A única defensável, mas ainda desnecessária |
| `d3-array` | 3.2.4 | 1 (`internmap`) | requer `@types/d3-array` | ESM-only, atrito com config de vitest, ganho zero |
| `@stdlib/stats` | 0.4.1 | árvore grande (`@stdlib/blas`, `math`, `napi`, `array`, `types`…) | inclusos | Desproporcional. Inclui binding nativo |
| `jstat` | 1.9.6 | 0 | **sem tipos** | Sem manutenção ativa relevante, sem tipos |
| `mathjs` | 15.2.0 | 5+ (`decimal.js`, `complex.js`, `fraction.js`, `@babel/runtime`, `escape-latex`) | inclusos | Muito grande para o caso de uso |

### Por que nenhuma justifica a dependência

1. **O que o harness precisa cabe em ~40 linhas:** média, desvio-padrão, percentil por interpolação linear, histograma por bucket fixo, contagem condicional. Foi exatamente isso que usei para produzir este documento inteiro (`analyze.js`, ~120 linhas, zero deps).
2. **Determinismo é invariante do projeto (INV-1).** Código próprio garante que nenhuma dependência introduza `Math.random`, ordenação instável ou mudança de comportamento numérico entre versões. Uma bump de minor version numa lib de estatística que mude o método de interpolação de percentil moveria todas as bandas de calibração de uma vez, silenciosamente. Esse é exatamente o tipo de drift que a rede de golden snapshot existe para pegar, e é caro descobrir por lá.
3. **Testes de aderência de distribuição não resolvem o problema real.** Um Kolmogorov-Smirnov ou qui-quadrado entre a distribuição simulada e a pro daria um p-valor, mas o milestone não quer "a distribuição é estatisticamente indistinguível da pro" (não é, nem deveria ser: overalls 35–70). Quer "média/p10/p50/p90 dentro de banda". Isso é comparação de percentis, não teste de hipótese. Adicionar `simple-statistics` pelo `kolmogorovSmirnovTest` seria comprar uma ferramenta para uma pergunta que o projeto não está fazendo.
4. **O constraint declarado do projeto é simplicidade.** Três dependências de produção depois de 22 fases é um ativo, não um acidente.

### Recomendação concreta

Criar `scripts/stats.ts` (novo arquivo, sem dependência) exportando o mínimo, e fazer os cinco harnesses importarem dali em vez de redeclarar:

```ts
export function mean(a: readonly number[]): number
export function stdev(a: readonly number[]): number      // populacional
export function percentile(sorted: readonly number[], p: number): number
export function summarize(a: readonly number[]): {       // p10/p25/p50/p75/p90 de uma vez
  n: number; mean: number; sd: number;
  p10: number; p25: number; p50: number; p75: number; p90: number;
  min: number; max: number;
}
export function histogram(a: readonly number[], edges: readonly number[]): number[]
export function shareWhere(a: readonly number[], pred: (x: number) => boolean): number
export function inBand(value: number, lo: number, hi: number): boolean
```

Benefício adicional: `summarize()` produz exatamente o formato das tabelas da §4, o que torna trivial comparar saída de harness contra este documento lado a lado.

**Se no futuro a resposta mudar:** o único gatilho realista para adicionar `simple-statistics@7.9.3` seria precisar de regressão linear, correlação de Pearson/Spearman ou intervalo de confiança bootstrap para a track de win probability. Mesmo aí, cada um desses é 15–30 linhas. Reavaliar só se aparecerem três ou mais desses casos ao mesmo tempo.

### Instalação

```bash
# Nada a instalar. Esta é a recomendação.
# Se e somente se a track de win-prob exigir regressão/correlação/bootstrap:
# npm install -D simple-statistics@7.9.3
```

---

## 10. Gaps e itens não encontrados

| Item | Status | Observação |
|---|---|---|
| Duração média de partida de **baixo elo / amadores** com fonte citável | **[NÃO ENCONTRADO]** | Encontrei referência de terceiro grau a um post do Riot Phroxzon (patch 14.24, percentis 10/50/90 de 20,7 / 30,2 / 39,6 min em ranked) via resultado de busca, mas **não consegui verificar o post original** (x.com devolveu HTTP 402). Não use este número sem verificar. |
| Percentis de duração no **próprio Worlds** separadamente por ano | Parcial | Tenho médias e percentis por liga na §4.1, mas o N de Worlds isolado (84–132 partidas/ano) é pequeno para percentis de cauda |
| Timing médio do **primeiro Baron** e do **primeiro inibidor** | Parcial | Dá para inferir da §5 (Baron médio 0,27 aos 25 min, 0,78 aos 30; inibidor 0,08 aos 25, 0,31 aos 30), mas não medi o timing direto. Seria ~1 hora de trabalho a mais no mesmo script do feed |
| Distribuição de **multikills** (double/triple/quadra/penta) por partida | Não coletado | As colunas `doublekills`/`triplekills`/`quadrakills`/`pentakills` **existem** no CSV do Oracle's Elixir. Se a v2.0 quiser recalibrar a curva de multikill, é uma consulta trivial no dataset já baixado |
| Timing de **cada** torre (não só a primeira) | Não coletado | Obtível pelo mesmo feed da Riot, varrendo até o fim da partida em vez de parar em 26:40. Custo: ~3× mais requisições |
| Dados de **2026** para as métricas do Oracle's Elixir | Não processado | O CSV 2026 existe (`1hnpbrUpBMS1TZI7IovfpKeZfWJH1Aptm`) e a temporada está em andamento. Deixei de fora porque splits incompletos enviesam. A amostra multi-liga 2026 do feed (§4.4) já cobre o essencial e concorda com 2025 |
| Efeito de **patch** dentro de um mesmo ano | Não analisado | A coluna `patch` existe no CSV. Se alguma banda parecer instável, dá para segmentar |

---

## 11. Fontes

| Fonte | URL | O que forneceu | Provider | Confiança do seam | Confiança na evidência |
|---|---|---|---|---|---|
| Oracle's Elixir, CSVs 2023/2024/2025 | <https://oracleselixir.com/tools/downloads> (Drive `1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH`) | Duração, abates, torres, inibidores, dragões, barões, alma, elder, placas, ouro, GPM, KDA e KP por rota, marcos at10/15/20/25, curvas de win-rate | `webfetch` | LOW | **ALTA** (dataset primário, N = 5.958 partidas, método reproduzível) |
| Riot / LoL Esports live stats feed | `https://feed.lolesports.com/livestats/v1/window/{gameId}` | Timings de first blood, primeira torre, primeiro dragão; snapshots de estado em 10/15/20/25/30/35 min | `webfetch` | LOW | **ALTA** (feed oficial da Riot, 4 amostras independentes, corroborado pelo OE na curva de abates) |
| Riot / LoL Esports API | `https://esports-api.lolesports.com/persisted/gw/getCompletedEvents` | IDs de partida por torneio (Worlds 2023/2024/2025, MSI, EWC, ligas regionais) | `webfetch` | LOW | ALTA |
| npm registry | <https://registry.npmjs.org/> | Versões atuais e árvore de dependências de `simple-statistics`, `d3-array`, `@stdlib/stats`, `jstat`, `mathjs` | `npm` | LOW | ALTA (registry oficial, consulta direta) |
| Inven Global, "Games have become longer in leagues around the world" | <https://www.invenglobal.com/articles/10384/games-have-become-longer-in-leagues-around-the-world-is-this-what-riot-games-intended> | Contexto histórico de duração (2019–2020): LCK 33:38 → 35:39, LPL 31:55 → 33:32, LEC 32:15 → 34:35, LCS 33:42 → 35:29 | `websearch` | LOW | MÉDIA (artigo de imprensa, dados de 2020, usado só como contexto) |
| Post atribuído a Riot Phroxzon sobre métricas de ranked | <https://x.com/RiotPhroxzon/status/1878597645889069254> | Percentis de duração em ranked e win rate de first blood/first turret | `websearch` | LOW | **NÃO VERIFICADO** (HTTP 402 na tentativa de leitura direta). Não usar sem confirmação |
| `gol.gg` (Games of Legends) | <https://gol.gg/> | Tentado como fonte alternativa. Páginas de estatística de torneio retornaram vazias/404 via fetch automatizado | `webfetch` | LOW | **DESCARTADO** |

### Scripts de reprodução

Os scripts usados vivem em scratchpad de sessão e não foram commitados (são ~350 linhas de Node puro, zero deps). Se o roadmap quiser reproduzir ou estender:

| Script | O que faz |
|---|---|
| `analyze.js` | Lê `oe_<ano>.csv`, filtra ligas, imprime todas as distribuições da §4 |
| `byleague.js` | Mesma coisa quebrado por liga+ano (tabela da §4.1) |
| `winprob.js` | Curvas de win-rate por Δouro e por objetivo (§6) |
| `timings.js` | Varre o feed da Riot procurando o primeiro frame com kill/torre/dragão (§4.4) |
| `snapshots.js` | Varre o feed capturando estado em 10/15/20/25/30/35 min (§5) |

---
*Stack research for: recalibração de ritmo de engine de simulação de LoL (milestone v2.2)*
*Researched: 2026-07-29*
