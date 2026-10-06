# Baseline oficial da v2.2 (pos-correcao do sistema de assistencia)

**Gerado em:** 2026-07-29
**Harness:** `npm run diagnose` (`scripts/diagnose-engine.ts`, via `vitest.diagnose.config.ts`)
**Relatorio de origem:** `docs/diagnostics/engine-diagnose.txt`
**Commit da engine no momento da geracao:** `d5ea94ba470ef5d4917c950236425dad5047c2f3` (`docs(24-04): fecha o plano de regeneracao deliberada de golden e a janela vermelha da fase`)
**Ultimo commit que tocou `src/sim/` antes desta medicao:** `daacf2d`
**Tamanho de amostra:** 1500 partidas em cada um dos cenarios A, B e C; 600 por ponto no cenario D (10 pontos); 600 por rota no cenario E. Total de 15.500 partidas deterministicas, seed = i por partida.

> Este arquivo e a **copia congelada** do relatorio. `npm run diagnose` reescreve
> `docs/diagnostics/engine-diagnose.txt` a cada execucao; este arquivo nunca e reescrito.
> Os numeros vem diretamente do que o harness imprimiu, nos dois lados da comparacao.
> **NAO inventar nem interpolar valores:** campo sem dado do harness fica marcado como
> "nao medido pelo harness", no mesmo padrao de `docs/baselines/16-baseline.md`.

---

## Instrucao de uso: as Fases 25 a 30 comparam contra ESTE arquivo

**Regra, sem rodeio: toda comparacao de fase da v2.2 se refere a este baseline, e nao ao diagnostico de 2026-07-28.**

O diagnostico de 2026-07-28, que abriu a milestone, foi medido sobre uma engine em que **tres rotas estavam estruturalmente excluidas de receber assistencia**: no relatorio daquele dia o ADC aparece com `A = 0.00` nos tres cenarios, e top e mid recebiam apenas o residual que sobrava do suporte. Corrigir esse defeito **ja e, por si so, uma mudanca de calibracao**, porque a cadeia causal e direta: assistencia vira `ASSIST_GOLD`, que vira `goldFightMult`, que vira `fightPower`, que vira desfecho de luta e probabilidade de vitoria.

Se as Fases 25 a 30 continuarem se comparando com o diagnostico de abertura, cada uma vai atribuir a si mesma uma parte do efeito que na verdade veio da Fase 24, e a atribuicao causal da milestone inteira fica contaminada sem recuperacao possivel depois. Este arquivo corta esse fio: tudo que mudar a partir daqui e efeito da fase que mudou, nao residuo da Fase 24.

Como reproduzir a medicao deste baseline:

```bash
git checkout d5ea94ba470ef5d4917c950236425dad5047c2f3
npm run diagnose
# o relatorio sai em docs/diagnostics/engine-diagnose.txt e deve bater com este arquivo
```

---

## 1. ANTES x DEPOIS: o que a Fase 24 moveu no diagnostico

Esta e a secao mais importante do arquivo. Ela responde a pergunta que a Fase 25 precisa ter respondida antes de comecar: **a correcao de assistencia mexeu no ritmo da partida, e de quanto?**

As duas medicoes usam **as mesmas sementes** (seed = i, i = 0..N-1) e o mesmo harness. A diferenca entre elas e integralmente atribuivel a mudanca de engine da Fase 24, e nao a sorteio.

### 1.1 A tabela

Cenario A (sintetico equilibrado 75 vs 75, N=1500) salvo onde indicado. "Ruido" e a escala de incerteza que o proprio harness declara: meia-largura do IC95 da media para metricas continuas, e meia-largura do IC95 binomial para proporcoes.

| Linha | ANTES (2026-07-28) | DEPOIS (baseline v2.2) | Delta | Ruido | Veredito |
|---|---|---|---|---|---|
| **duracao media da partida** | 51,39 min | **51,40 min** | **+0,01 min (+0,6 s, +0,02%)** | IC95 da media +/- 25 s | **IGUAL.** O movimento e 2,4% do ruido |
| duracao media, cenario B (rosters reais) | 50:32 | **50:48** | +16 s (+0,53%) | IC95 da media +/- 26 s | **PIOROU de leve**, dentro do ruido |
| duracao media, cenario C (85 vs 70) | 44:20 | **44:41** | +21 s (+0,79%) | IC95 da media +/- 28 s | **PIOROU de leve**, dentro do ruido |
| **fracao no limite de 60 minutos** | 27,73% | **27,20%** | **-0,53 pp (-1,9% relativo)** | IC95 binomial +/- 2,27 pp | **MELHOROU de leve**, dentro do ruido |
| **fracao acima de 45 minutos** | 76,3% | **77,3%** | **+1,0 pp (+1,3% relativo)** | IC95 binomial +/- 2,15 pp | **PIOROU de leve**, dentro do ruido |
| fracao abaixo de 25 minutos | 0,1% | **0,3%** | +0,2 pp | IC95 binomial +/- 0,28 pp | IGUAL, no limite do ruido |
| jogos acima de 40 minutos | 88,1% | **89,3%** | +1,2 pp | IC95 binomial +/- 1,64 pp | PIOROU de leve, dentro do ruido |
| **abates totais por partida** | 87,71 | **88,16** | **+0,45 (+0,51%)** | IC95 da media +/- 1,21 | **PIOROU de leve**, dentro do ruido |
| abates por minuto | 1,71 | **1,72** | +0,01 (+0,58%) | nao medido pelo harness | PIOROU de leve |
| **torres totais por partida** | 9,57 | **9,59** | **+0,02 (+0,21%)** | nao medido pelo harness | **IGUAL** |
| **torres por minuto** (derivada de A) | 0,1862 | **0,1866** | **+0,0004 (+0,19%)** | nao medido pelo harness | **IGUAL** |
| **primeira torre, mediana (A)** | 23:00 | **22:45** | **-15 s (-1,1%)** | resolucao do harness: 15 s | **MELHOROU de leve**, exatamente 1 passo de resolucao |
| primeira torre, mediana (B) | 20:45 | **20:45** | 0 s | resolucao do harness: 15 s | **IGUAL**, byte a byte |
| primeira torre, mediana (C) | 18:45 | **18:45** | 0 s | resolucao do harness: 15 s | **IGUAL**, byte a byte |
| primeira torre, media (A) | 22:25 | **22:20** | -5 s (-0,4%) | IC95 da media +/- 17 s | IGUAL |
| **assistencias por rota (A)** | ver 1.4 | ver 1.4 | ADC de **0,00 para 24,59** | nao aplicavel | **MELHOROU, e e a razao da fase existir** |
| baroes por partida | 4,28 | **4,28** | 0,00 | IC95 da media +/- 0,06 | **IGUAL**, byte a byte |
| dragoes por partida | 5,70 | **5,69** | -0,01 | nao medido pelo harness | IGUAL |
| fracao de partidas com Alma | 97,4% | **97,4%** | 0,0 pp | IC95 binomial +/- 0,81 pp | **IGUAL**, byte a byte |
| fracao de partidas com Elder | 91,7% | **92,1%** | +0,4 pp | IC95 binomial +/- 1,37 pp | IGUAL, dentro do ruido |
| diferenca de ouro venc/perd no fim | 2301 | **2416** | +115 (+5,0%) | nao medido pelo harness | MELHOROU de leve (a banda pede 7 mil a 14 mil) |
| win-rate do lado user (A, fixture 75x75) | 53,7% | **55,3%** | +1,6 pp | IC95 binomial +/- 2,52 pp | PIOROU de leve, dentro do ruido. Ver 4.3 |
| violacoes de plausibilidade (A, B e C) | 0 / 0 / 0 / 0 | **0 / 0 / 0 / 0** | 0 | assert duro | **IGUAL, zero absoluto nos dois lados** |

### 1.2 A duracao: a resposta longa, porque e a metrica mais fora de banda de todo o diagnostico

O diff de golden do Plano 24-04 mostrou partidas ficando visivelmente mais longas depois da correcao: `balanced 999` de 2625s para 3600s (bateu no teto de 60 minutos), `close 42` de 1875s para 2955s, `close 777` de 2130s para 3270s, `stomp 777` de 1815s para 2640s. Sao aumentos de 37% a 58%. O mecanismo proposto era plausivel: distribuir assistencia distribui ouro, os times ficam mais parelhos, a partida se arrasta.

**Em escala isso nao se confirma.** O golden sao 15 sementes; este baseline mede as mesmas sementes de sempre em 15.500 partidas. Treze medicoes independentes de duracao media:

| Medicao | N | ANTES | DEPOIS | Delta |
|---|---|---|---|---|
| Cenario A (75x75) | 1500 | 51,39 min | 51,40 min | **+0,6 s** |
| Cenario B (rosters reais) | 1500 | 50:32 | 50:48 | +16 s |
| Cenario C (85x70) | 1500 | 44:20 | 44:41 | +21 s |
| Secao D, gap 0 | 600 | 51:48 | 51:54 | +6 s |
| Secao D, gap 4 | 600 | 50:06 | 50:24 | +18 s |
| Secao D, gap 10 | 600 | 47:34 | 47:25 | **-9 s** |
| Secao D, gap 14 | 600 | 44:50 | 45:04 | +14 s |
| Secao D, gap 20 | 600 | 41:05 | 41:11 | +6 s |
| Secao D, gap 26 | 600 | 36:33 | 36:52 | +19 s |
| Secao D, gap 30 | 600 | 35:08 | 35:08 | **0 s** |
| Secao D, gap 40 | 600 | 31:48 | 31:51 | +3 s |
| Secao D, gap 49 | 600 | 31:02 | 31:03 | +1 s |
| Secao D, gap 59 | 600 | 30:35 | 30:33 | **-2 s** |

**Leitura, e ela tem duas partes que precisam ser ditas juntas.**

**Primeira parte, o sinal existe.** Dez das treze medicoes sao positivas, duas negativas e uma empatada. Um teste de sinal binomial sobre as doze medicoes nao empatadas da **p = 0,039 bilateral**. Ou seja, a direcao nao e sorteio: a correcao de assistencia **de fato alonga** a partida. A leitura mecanicista do Plano 24-04 estava certa no sentido.

**Segunda parte, a magnitude e desprezivel.** O delta medio das treze medicoes e **+7,2 segundos** sobre partidas de 30 a 52 minutos, ou seja **+0,22% em media** e no maximo +0,87% em qualquer ponto isolado. Nenhuma das treze variacoes chega a meia-largura do IC95 da media do proprio cenario.

**Atribuicao contra o problema real.** A duracao media do cenario A e 51,40 min contra uma banda de 29 a 36 minutos. O excesso sobre o teto da banda e de **15,39 minutos, ou 923 segundos**. A Fase 24 acrescentou 0,6 segundo a esse excesso no cenario A, ou seja **0,065% dele**. Mesmo usando a maior variacao medida em qualquer cenario (+21 s no C) como se fosse o efeito no A, a contribuicao da Fase 24 seria de **2,27% do excesso**.

**Conclusao para a Fase 25: o problema de duracao que voce herda e o mesmo de antes, nao um maior.** As partidas ficaram mensuravelmente mais longas, e isso esta escrito aqui sem suavizacao, mas a diferenca e de segundos contra um excesso de quinze minutos. O que os 15 seeds do golden mostraram foi **redistribuicao por semente**, exatamente como o Plano 24-03 ja tinha medido para o volume de abates: partidas individuais se moveram muito, o agregado quase nao se moveu.

**Contra-indicacao registrada, para nao esconder o incomodo.** Duas linhas da tabela 1.1 andam em direcoes opostas: a fracao no teto de 60 minutos **caiu** 0,53 pp enquanto a fracao acima de 45 minutos **subiu** 1,0 pp. Se houvesse alongamento sistematico, as duas subiriam juntas. O padrao observado (mais partidas na faixa de 45 a 60, menos partidas empilhadas exatamente no teto) e o de embaralhamento, nao o de deslocamento. Nenhuma das duas variacoes sai do IC95 binomial.

### 1.3 Volume de abates e torres: praticamente parados

Abates totais por partida no cenario A: 87,71 para 88,16, ou **+0,51%**, contra um IC95 da media de +/- 1,21. Nos dez pontos da secao D a variacao relativa media e de **+0,41%**, com tres pontos negativos. E o mesmo tamanho de efeito que o Plano 24-03 mediu de forma independente nos conjuntos com campeoes (-0,4%, -0,1% e +1,4%).

Torres totais por partida: 9,57 para 9,59, ou +0,21%. **Torres por minuto, a alavanca-raiz da Fase 25, sai de 0,1862 para 0,1866: +0,19%.** O gate `calibrate:pace` mede 0,184 contra uma banda de 0,300 a 0,450. **A Fase 24 nao mexeu no gargalo estrutural, nem para melhor nem para pior.**

### 1.4 Assistencias por rota: a razao da fase existir

Cenario A (o gateado). Numeros do bloco `MICRO POR ROLE` dos dois relatorios, soma dos dois lados por jogo:

| Rota | A antes | A depois | Delta | Share antes | Share depois | KP-proxy antes | KP-proxy depois |
|---|---|---|---|---|---|---|---|
| top | 19,00 | **28,23** | +9,23 | 12,9% | 18,0% | 0,79 | 0,99 |
| jungle | 40,81 | **27,33** | -13,48 | 27,7% | 17,4% | 1,42 | 1,11 |
| mid | 17,10 | **25,38** | +8,28 | 11,6% | 16,1% | 0,89 | 1,08 |
| **adc** | **0,00** | **24,59** | **+24,59** | **0,0%** | **15,6%** | 0,52 | 1,08 |
| support | 70,44 | **51,65** | -18,79 | 47,8% | 32,9% | 1,74 | 1,31 |
| **soma** | 147,35 | **157,18** | +9,83 (+6,7%) | | | | |

**Veredito: MELHOROU, e e a unica linha do diagnostico em que a Fase 24 mudou de regime e nao de casa decimal.** O ADC sai de zero absoluto para 15,6% do total, contra uma referencia de 16,58% derivada de `STACK.md` secao 4.7. O suporte cai de 47,8% para 32,9%, contra uma referencia de 27,95%: o excesso passa de 1,71 vez a referencia para 1,18 vez.

Os cenarios B e C repetem o padrao com os mesmos numeros a menos de decimal: ADC de 0,00 para 24,36 (share 15,6%) no B e de 0,00 para 20,10 (share 15,5%) no C.

**Efeito colateral medido e registrado:** a soma de assistencias por partida **subiu 6,7%** (6,9% no B, 7,0% no C). Nao e ruido, e consequencia direta do conserto: antes, quando o filtro duro deixava menos jogadores elegiveis do que o evento creditava, o credito simplesmente se perdia. Agora ele e distribuido. `ASSIST_COUNT_BY_EVENT` nao foi tocado.

### 1.5 O que a Fase 24 NAO mudou, e isso tambem e resultado

- **Violacoes de plausibilidade continuam em zero absoluto** nos tres cenarios, 4500 partidas: nenhum Baron antes de 20 min, nenhuma torre antes de 5 min, nenhum triple ou superior antes de 8 min, nenhum ace antes de 8 min.
- **Baroes por partida: 4,28 nos dois lados, byte a byte.**
- **Fracao de partidas com Alma: 97,4% nos dois lados, byte a byte.**
- **Mediana da primeira torre nos cenarios B e C: identica ao segundo.**
- **Ouro por minuto por time:** 691 para 693 no A (+0,3%), 711 para 711 no B (identico), 674 para 675 no C.

---

## 2. Tabelas do harness, copiadas dos dois relatorios

Tudo abaixo e copia fiel do que o harness imprimiu. A coluna ANTES vem de `git show e77acd6:docs/diagnostics/engine-diagnose.txt` (o diagnostico de abertura da milestone, gerado no Plano 23-03); a coluna DEPOIS vem do relatorio deste baseline.

### A. Sintetico equilibrado (75 vs 75), N=1500

**MACRO**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| win-rate lado user | 53.7% | 55.3% |
| duracao media | 51:24 | 51:24 |
| duracao min/max | 23:15 / 60:00 | 23:15 / 60:00 |
| jogos < 20 min | 0.0% | 0.0% |
| jogos > 40 min | 88.1% | 89.3% |
| eventos por jogo (media) | 93.21 | 93.46 |
| eventos/min | 1.81 | 1.82 |

**Duracao, distribuicao completa como o harness imprimiu**

```
ANTES : media 51:24 | dp 8:17 | p5 35:45 p25 45:45 p50 52:45 p75 60:00 p95 60:00 | IC95 [50:59, 51:49] | bc (limiar bimodal 0.5556) 0.581 (bimodal ou multimodal)
DEPOIS: media 51:24 | dp 8:13 | p5 36:00 p25 45:45 p50 52:45 p75 60:00 p95 60:00 | IC95 [50:59, 51:49] | bc (limiar bimodal 0.5556) 0.558 (bimodal ou multimodal)
```

**Eventos por jogo, distribuicao completa como o harness imprimiu**

```
ANTES : media 93.21 | dp 23.09 | p5 52.00 p25 77.00 p50 96.00 p75 112.00 p95 127.00 | IC95 [92.04, 94.38] | bc (limiar bimodal 0.5556) 0.462 (unimodal)
DEPOIS: media 93.46 | dp 22.94 | p5 53.00 p25 77.00 p50 96.00 p75 111.00 p95 128.00 | IC95 [92.30, 94.63] | bc (limiar bimodal 0.5556) 0.429 (unimodal)
```

**PLACAR**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| kills totais/jogo (media) | 87.71 | 88.16 |
| kills vencedor (media) | 48.32 | 48.87 |
| kills perdedor (media) | 39.39 | 39.29 |
| kills por minuto | 1.71 | 1.72 |
| distribuicao temporal | <15min 19.2% \| 15-25min 10.4% \| >25min 70.4% | <15min 19.2% \| 15-25min 10.5% \| >25min 70.3% |

**Kills totais por jogo, distribuicao completa como o harness imprimiu**

```
ANTES : media 87.71 | dp 23.92 | p5 46.00 p25 72.00 p50 89.00 p75 106.00 p95 124.00 | IC95 [86.50, 88.92] | bc (limiar bimodal 0.5556) 0.422 (unimodal)
DEPOIS: media 88.16 | dp 24.08 | p5 46.00 p25 70.00 p50 90.00 p75 106.00 p95 125.00 | IC95 [86.94, 89.38] | bc (limiar bimodal 0.5556) 0.405 (unimodal)
```

**ESTRUTURAS E OBJETIVOS**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| torres vencedor (media) | 5.68 | 5.71 |
| torres perdedor (media) | 3.89 | 3.88 |
| inibidores do vencedor (media) | 2.41 | 2.43 |
| dragoes vencedor (media) | 3.30 | 3.37 |
| dragoes perdedor (media) | 2.40 | 2.32 |
| jogos com Alma | 97.4% | 97.4% |
| baroes por jogo (media) | 4.28 | 4.28 |
| jogos com >=1 Baron | 100.0% | 100.0% |
| jogos com Elder | 91.7% | 92.1% |
| jogos com Arauto | 100.0% | 100.0% |
| ouro final vencedor (media) | 36671 | 36810 |
| ouro final perdedor (media) | 34371 | 34394 |
| diferenca de ouro | 2301 | 2416 |
| ouro/min por time | 691 | 693 |

**TIMINGS**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| first blood (media) | 2:37 | 2:37 |
| primeira torre (media) | 22:25 | 22:20 |

**Primeira torre, distribuicao completa como o harness imprimiu**

```
ANTES : media 22:25 | dp 5:32 | p5 11:30 p25 20:15 p50 23:00 p75 26:00 p95 30:15 | IC95 [22:08, 22:42] | bc (limiar bimodal 0.5556) 0.371 (unimodal)
DEPOIS: media 22:20 | dp 5:41 | p5 11:30 p25 20:00 p50 22:45 p75 26:00 p95 30:30 | IC95 [22:03, 22:37] | bc (limiar bimodal 0.5556) 0.338 (unimodal)
```

**MICRO POR ROLE (soma dos 2 lados por jogo, agregado)**

| Rota | A antes | A depois | delta | KDA antes | KDA depois | KP-proxy antes | KP-proxy depois |
|---|---|---|---|---|---|---|---|
| top | 19.00 | **28.23** | +9.23 | 2.16 | 2.72 | 0.79 | 0.99 |
| jungle | 40.81 | **27.33** | -13.48 | 3.57 | 2.78 | 1.42 | 1.11 |
| mid | 17.10 | **25.38** | +8.28 | 2.26 | 2.72 | 0.89 | 1.08 |
| adc | 0.00 | **24.59** | +24.59 | 1.34 | 2.77 | 0.52 | 1.08 |
| support | 70.44 | **51.65** | -18.79 | 3.83 | 2.90 | 1.74 | 1.31 |
| **soma** | 147.35 | **157.18** | +9.83 | | | | |

Share de assistencias por rota no mesmo bloco:

| Rota | share antes | share depois |
|---|---|---|
| top | 12.9% | **18.0%** |
| jungle | 27.7% | **17.4%** |
| mid | 11.6% | **16.1%** |
| adc | 0.0% | **15.6%** |
| support | 47.8% | **32.9%** |

K, D e kill-share do mesmo bloco, sem alteracao de leitura:

| Rota | K antes | K depois | D antes | D depois | kill-share antes | kill-share depois |
|---|---|---|---|---|---|---|
| top | 15.44 | 15.52 | 15.95 | 16.11 | 17.5% | 17.5% |
| jungle | 21.42 | 21.54 | 17.44 | 17.58 | 24.8% | 24.8% |
| mid | 21.94 | 22.02 | 17.29 | 17.39 | 25.1% | 25.1% |
| adc | 23.01 | 23.18 | 17.12 | 17.23 | 26.1% | 26.1% |
| support | 5.89 | 5.90 | 19.91 | 19.85 | 6.6% | 6.6% |

**OUTLIERS INDIVIDUAIS**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| max kills de 1 jogador (media) | 15.20 | 15.23 |
| jogos c/ alguem >=10 kills | 94.8% | 95.2% |
| jogos c/ alguem >=15 kills | 56.9% | 55.6% |
| jogos c/ alguem 0 mortes | 2.4% | 2.5% |
| jogos c/ alguem 0 kills | 15.4% | 15.5% |

**Multikills e ritmo de luta (por jogo, agregado)**

```
ANTES : double 8.81 | triple 2.43 | quadra 0.30 | penta 0.01 | ace 5.60
DEPOIS: double 8.90 | triple 2.40 | quadra 0.31 | penta 0.01 | ace 5.67
```

**Dinamica e violacoes de plausibilidade**

```
ANTES : stomp / equilibrado / comeback: 8.5% / 21.9% / 69.7%
DEPOIS: stomp / equilibrado / comeback: 9.1% / 24.5% / 66.5%
```

```
ANTES
VIOLACOES DE PLAUSIBILIDADE (total absoluto em 1500 jogos)
    Baron < 20min ............ 0
    torre < 5min .............. 0
    triple+ < 8min ............ 0
    ace < 8min ................ 0

DEPOIS
VIOLACOES DE PLAUSIBILIDADE (total absoluto em 1500 jogos)
    Baron < 20min ............ 0
    torre < 5min .............. 0
    triple+ < 8min ............ 0
    ace < 8min ................ 0
```

---

### B. Rosters reais sorteados (players.json), N=1500

**MACRO**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| win-rate lado user | 56.2% | 56.2% |
| duracao media | 50:32 | 50:48 |
| duracao min/max | 23:45 / 60:00 | 23:45 / 60:00 |
| jogos < 20 min | 0.0% | 0.0% |
| jogos > 40 min | 86.2% | 85.7% |
| eventos por jogo (media) | 95.01 | 95.35 |
| eventos/min | 1.88 | 1.88 |

**Duracao, distribuicao completa como o harness imprimiu**

```
ANTES : media 50:32 | dp 8:39 | p5 34:30 p25 44:30 p50 52:00 p75 59:30 p95 60:00 | IC95 [50:06, 50:59] | bc (limiar bimodal 0.5556) 0.564 (bimodal ou multimodal)
DEPOIS: media 50:48 | dp 8:49 | p5 34:15 p25 44:45 p50 52:15 p75 60:00 p95 60:00 | IC95 [50:22, 51:15] | bc (limiar bimodal 0.5556) 0.584 (bimodal ou multimodal)
```

**Eventos por jogo, distribuicao completa como o harness imprimiu**

```
ANTES : media 95.01 | dp 24.01 | p5 51.00 p25 78.00 p50 98.00 p75 114.00 p95 129.00 | IC95 [93.79, 96.22] | bc (limiar bimodal 0.5556) 0.455 (unimodal)
DEPOIS: media 95.35 | dp 24.19 | p5 51.00 p25 79.00 p50 99.00 p75 114.00 p95 131.00 | IC95 [94.13, 96.58] | bc (limiar bimodal 0.5556) 0.460 (unimodal)
```

**PLACAR**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| kills totais/jogo (media) | 86.96 | 87.69 |
| kills vencedor (media) | 45.60 | 45.90 |
| kills perdedor (media) | 41.36 | 41.79 |
| kills por minuto | 1.72 | 1.73 |
| distribuicao temporal | <15min 20.0% \| 15-25min 11.4% \| >25min 68.6% | <15min 19.9% \| 15-25min 11.4% \| >25min 68.7% |

**Kills totais por jogo, distribuicao completa como o harness imprimiu**

```
ANTES : media 86.96 | dp 25.01 | p5 42.00 p25 70.00 p50 89.00 p75 105.00 p95 124.00 | IC95 [85.70, 88.23] | bc (limiar bimodal 0.5556) 0.428 (unimodal)
DEPOIS: media 87.69 | dp 25.56 | p5 43.00 p25 69.00 p50 90.00 p75 107.00 p95 125.00 | IC95 [86.39, 88.98] | bc (limiar bimodal 0.5556) 0.438 (unimodal)
```

**ESTRUTURAS E OBJETIVOS**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| torres vencedor (media) | 5.75 | 5.74 |
| torres perdedor (media) | 4.11 | 4.15 |
| inibidores do vencedor (media) | 2.60 | 2.58 |
| dragoes vencedor (media) | 3.08 | 3.10 |
| dragoes perdedor (media) | 2.64 | 2.61 |
| jogos com Alma | 96.8% | 97.0% |
| baroes por jogo (media) | 4.23 | 4.25 |
| jogos com >=1 Baron | 100.0% | 100.0% |
| jogos com Elder | 90.7% | 90.3% |
| jogos com Arauto | 100.0% | 100.0% |
| ouro final vencedor (media) | 36535 | 36622 |
| ouro final perdedor (media) | 35377 | 35671 |
| diferenca de ouro | 1158 | 951 |
| ouro/min por time | 711 | 711 |

**TIMINGS**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| first blood (media) | 2:20 | 2:20 |
| primeira torre (media) | 19:14 | 19:17 |

**Primeira torre, distribuicao completa como o harness imprimiu**

```
ANTES : media 19:14 | dp 6:17 | p5 9:30 p25 13:15 p50 20:45 p75 23:45 p95 28:45 | IC95 [18:55, 19:33] | bc (limiar bimodal 0.5556) 0.500 (unimodal)
DEPOIS: media 19:17 | dp 6:18 | p5 9:30 p25 13:30 p50 20:45 p75 23:45 p95 28:45 | IC95 [18:58, 19:37] | bc (limiar bimodal 0.5556) 0.471 (unimodal)
```

**MICRO POR ROLE (soma dos 2 lados por jogo, agregado)**

| Rota | A antes | A depois | delta | KDA antes | KDA depois | KP-proxy antes | KP-proxy depois |
|---|---|---|---|---|---|---|---|
| top | 18.85 | **28.21** | +9.36 | 2.13 | 2.71 | 0.77 | 0.98 |
| jungle | 40.41 | **27.21** | -13.20 | 3.57 | 2.79 | 1.42 | 1.11 |
| mid | 16.48 | **24.81** | +8.33 | 2.25 | 2.72 | 0.89 | 1.08 |
| adc | 0.00 | **24.36** | +24.36 | 1.36 | 2.78 | 0.53 | 1.09 |
| support | 70.23 | **51.52** | -18.71 | 3.86 | 2.88 | 1.74 | 1.30 |
| **soma** | 145.97 | **156.11** | +10.14 | | | | |

Share de assistencias por rota no mesmo bloco:

| Rota | share antes | share depois |
|---|---|---|
| top | 12.9% | **18.1%** |
| jungle | 27.7% | **17.4%** |
| mid | 11.3% | **15.9%** |
| adc | 0.0% | **15.6%** |
| support | 48.1% | **33.0%** |

K, D e kill-share do mesmo bloco, sem alteracao de leitura:

| Rota | K antes | K depois | D antes | D depois | kill-share antes | kill-share depois |
|---|---|---|---|---|---|---|
| top | 14.79 | 14.95 | 15.77 | 15.90 | 16.6% | 16.7% |
| jungle | 21.18 | 21.29 | 17.27 | 17.41 | 25.0% | 24.9% |
| mid | 22.29 | 22.42 | 17.26 | 17.37 | 25.7% | 25.6% |
| adc | 23.09 | 23.38 | 17.02 | 17.15 | 26.4% | 26.6% |
| support | 5.62 | 5.66 | 19.64 | 19.86 | 6.3% | 6.3% |

**OUTLIERS INDIVIDUAIS**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| max kills de 1 jogador (media) | 15.08 | 15.21 |
| jogos c/ alguem >=10 kills | 92.5% | 92.9% |
| jogos c/ alguem >=15 kills | 55.1% | 56.5% |
| jogos c/ alguem 0 mortes | 1.7% | 1.3% |
| jogos c/ alguem 0 kills | 18.5% | 19.4% |

**Multikills e ritmo de luta (por jogo, agregado)**

```
ANTES : double 8.70 | triple 2.48 | quadra 0.33 | penta 0.02 | ace 5.64
DEPOIS: double 8.83 | triple 2.51 | quadra 0.33 | penta 0.02 | ace 5.66
```

**Dinamica e violacoes de plausibilidade**

```
ANTES : stomp / equilibrado / comeback: 5.3% / 19.5% / 75.2%
DEPOIS: stomp / equilibrado / comeback: 6.2% / 18.7% / 75.1%
```

```
ANTES
VIOLACOES DE PLAUSIBILIDADE (total absoluto em 1500 jogos)
    Baron < 20min ............ 0
    torre < 5min .............. 0
    triple+ < 8min ............ 0
    ace < 8min ................ 0

DEPOIS
VIOLACOES DE PLAUSIBILIDADE (total absoluto em 1500 jogos)
    Baron < 20min ............ 0
    torre < 5min .............. 0
    triple+ < 8min ............ 0
    ace < 8min ................ 0
```

---

### C. Favorito claro (85 vs 70), N=1500

**MACRO**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| win-rate lado user | 95.3% | 94.7% |
| duracao media | 44:20 | 44:41 |
| duracao min/max | 22:30 / 60:00 | 22:30 / 60:00 |
| jogos < 20 min | 0.0% | 0.0% |
| jogos > 40 min | 65.6% | 66.3% |
| eventos por jogo (media) | 76.51 | 77.23 |
| eventos/min | 1.73 | 1.73 |

**Duracao, distribuicao completa como o harness imprimiu**

```
ANTES : media 44:20 | dp 9:15 | p5 29:30 p25 37:15 p50 44:00 p75 51:00 p95 60:00 | IC95 [43:52, 44:49] | bc (limiar bimodal 0.5556) 0.455 (unimodal)
DEPOIS: media 44:41 | dp 9:24 | p5 29:45 p25 37:45 p50 44:00 p75 52:00 p95 60:00 | IC95 [44:12, 45:09] | bc (limiar bimodal 0.5556) 0.463 (unimodal)
```

**Eventos por jogo, distribuicao completa como o harness imprimiu**

```
ANTES : media 76.51 | dp 22.60 | p5 43.00 p25 59.00 p50 74.00 p75 92.00 p95 117.00 | IC95 [75.36, 77.65] | bc (limiar bimodal 0.5556) 0.450 (unimodal)
DEPOIS: media 77.23 | dp 23.20 | p5 43.00 p25 59.00 p50 75.00 p75 95.00 p95 118.00 | IC95 [76.06, 78.41] | bc (limiar bimodal 0.5556) 0.458 (unimodal)
```

**PLACAR**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| kills totais/jogo (media) | 71.46 | 72.25 |
| kills vencedor (media) | 47.27 | 47.40 |
| kills perdedor (media) | 24.19 | 24.85 |
| kills por minuto | 1.61 | 1.62 |
| distribuicao temporal | <15min 23.7% \| 15-25min 14.6% \| >25min 61.6% | <15min 23.3% \| 15-25min 14.3% \| >25min 62.4% |

**Kills totais por jogo, distribuicao completa como o harness imprimiu**

```
ANTES : media 71.46 | dp 24.87 | p5 33.00 p25 52.00 p50 70.00 p75 89.00 p95 114.00 | IC95 [70.20, 72.72] | bc (limiar bimodal 0.5556) 0.425 (unimodal)
DEPOIS: media 72.25 | dp 25.33 | p5 33.00 p25 53.00 p50 71.00 p75 91.00 p95 116.00 | IC95 [70.96, 73.53] | bc (limiar bimodal 0.5556) 0.437 (unimodal)
```

**ESTRUTURAS E OBJETIVOS**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| torres vencedor (media) | 6.09 | 6.06 |
| torres perdedor (media) | 1.79 | 1.90 |
| inibidores do vencedor (media) | 2.47 | 2.49 |
| dragoes vencedor (media) | 3.39 | 3.37 |
| dragoes perdedor (media) | 2.20 | 2.18 |
| jogos com Alma | 92.2% | 91.1% |
| baroes por jogo (media) | 3.47 | 3.50 |
| jogos com >=1 Baron | 100.0% | 100.0% |
| jogos com Elder | 75.3% | 78.2% |
| jogos com Arauto | 100.0% | 100.0% |
| ouro final vencedor (media) | 33306 | 33438 |
| ouro final perdedor (media) | 26478 | 26914 |
| diferenca de ouro | 6827 | 6524 |
| ouro/min por time | 674 | 675 |

**TIMINGS**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| first blood (media) | 2:46 | 2:46 |
| primeira torre (media) | 18:28 | 18:28 |

**Primeira torre, distribuicao completa como o harness imprimiu**

```
ANTES : media 18:28 | dp 6:18 | p5 9:15 p25 12:30 p50 18:45 p75 23:00 p95 28:15 | IC95 [18:09, 18:47] | bc (limiar bimodal 0.5556) 0.502 (unimodal)
DEPOIS: media 18:28 | dp 6:21 | p5 9:15 p25 12:30 p50 18:45 p75 23:15 p95 28:30 | IC95 [18:09, 18:47] | bc (limiar bimodal 0.5556) 0.509 (unimodal)
```

**MICRO POR ROLE (soma dos 2 lados por jogo, agregado)**

| Rota | A antes | A depois | delta | KDA antes | KDA depois | KP-proxy antes | KP-proxy depois |
|---|---|---|---|---|---|---|---|
| top | 15.47 | **23.31** | +7.84 | 2.16 | 2.75 | 0.78 | 0.99 |
| jungle | 33.42 | **22.60** | -10.82 | 3.68 | 2.87 | 1.43 | 1.12 |
| mid | 13.79 | **20.81** | +7.02 | 2.23 | 2.73 | 0.89 | 1.07 |
| adc | 0.00 | **20.10** | +20.10 | 1.31 | 2.72 | 0.52 | 1.08 |
| support | 58.31 | **42.69** | -15.62 | 3.88 | 2.88 | 1.76 | 1.31 |
| **soma** | 120.99 | **129.51** | +8.52 | | | | |

Share de assistencias por rota no mesmo bloco:

| Rota | share antes | share depois |
|---|---|---|
| top | 12.8% | **18.0%** |
| jungle | 27.6% | **17.5%** |
| mid | 11.4% | **16.1%** |
| adc | 0.0% | **15.5%** |
| support | 48.2% | **33.0%** |

K, D e kill-share do mesmo bloco, sem alteracao de leitura:

| Rota | K antes | K depois | D antes | D depois | kill-share antes | kill-share depois |
|---|---|---|---|---|---|---|
| top | 12.38 | 12.57 | 12.88 | 13.03 | 17.1% | 17.2% |
| jungle | 17.84 | 18.01 | 13.94 | 14.16 | 26.4% | 26.2% |
| mid | 17.85 | 17.97 | 14.16 | 14.21 | 24.8% | 24.6% |
| adc | 18.70 | 18.99 | 14.23 | 14.36 | 25.3% | 25.6% |
| support | 4.69 | 4.70 | 16.25 | 16.48 | 6.4% | 6.3% |

**OUTLIERS INDIVIDUAIS**

| Metrica | ANTES (2026-07-28) | DEPOIS (baseline v2.2) |
|---|---|---|
| max kills de 1 jogador (media) | 14.31 | 14.35 |
| jogos c/ alguem >=10 kills | 87.7% | 88.1% |
| jogos c/ alguem >=15 kills | 43.3% | 45.0% |
| jogos c/ alguem 0 mortes | 13.3% | 12.6% |
| jogos c/ alguem 0 kills | 38.5% | 37.1% |

**Multikills e ritmo de luta (por jogo, agregado)**

```
ANTES : double 7.15 | triple 2.11 | quadra 0.27 | penta 0.02 | ace 4.94
DEPOIS: double 7.20 | triple 2.11 | quadra 0.29 | penta 0.02 | ace 4.98
```

**Dinamica e violacoes de plausibilidade**

```
ANTES : stomp / equilibrado / comeback: 35.8% / 31.3% / 32.9%
DEPOIS: stomp / equilibrado / comeback: 35.5% / 28.9% / 35.6%
```

```
ANTES
VIOLACOES DE PLAUSIBILIDADE (total absoluto em 1500 jogos)
    Baron < 20min ............ 0
    torre < 5min .............. 0
    triple+ < 8min ............ 0
    ace < 8min ................ 0

DEPOIS
VIOLACOES DE PLAUSIBILIDADE (total absoluto em 1500 jogos)
    Baron < 20min ............ 0
    torre < 5min .............. 0
    triple+ < 8min ............ 0
    ace < 8min ................ 0
```

---

### D. Curva de win-rate por diferenca de forca (N=600 por ponto)

```
ANTES (2026-07-28)
user  rival   gap    win-rate user   duracao media   kills tot
      75     75     0       52.7%         51:48       88.41
      77     73     4       75.2%         50:06       84.96
      80     70    10       91.2%         47:34       78.63
      82     68    14       95.0%         44:50       73.58
      85     65    20       99.5%         41:05       64.33
      88     62    26       99.7%         36:33       55.48
      90     60    30      100.0%         35:08       53.60
      95     55    40      100.0%         31:48       47.40
      99     50    49      100.0%         31:02       47.49
      99     40    59      100.0%         30:35       47.42
```

```
DEPOIS (baseline v2.2)
user  rival   gap    win-rate user   duracao media   kills tot
      75     75     0       56.2%         51:54       89.52
      77     73     4       75.7%         50:24       85.14
      80     70    10       90.3%         47:25       78.65
      82     68    14       95.0%         45:04       74.31
      85     65    20       99.3%         41:11       64.69
      88     62    26       99.8%         36:52       56.25
      90     60    30      100.0%         35:08       53.52
      95     55    40      100.0%         31:51       47.39
      99     50    49      100.0%         31:03       47.54
      99     40    59      100.0%         30:33       47.27
```

---

### E. Impacto de um unico jogador forte (base 75; um role em 95)

```
ANTES (2026-07-28)
role sup.   win-rate   K/D/A do reforcado   kill-share dele
    top           72.2%        8.24/6.89/9.59        18.7%
    jungle        75.2%      12.36/7.92/21.97        26.6%
    mid           85.8%       10.35/6.23/7.30        27.0%
    adc           72.7%       13.46/7.68/0.00        28.3%
    support       64.2%       3.31/9.43/38.03        7.0%
```

```
DEPOIS (baseline v2.2)
role sup.   win-rate   K/D/A do reforcado   kill-share dele
    top           72.2%       8.21/7.21/14.09        18.6%
    jungle        74.0%      12.56/8.07/14.82        26.4%
    mid           86.0%      10.47/6.34/11.22        26.7%
    adc           69.2%      13.71/7.84/13.69        28.3%
    support       65.3%       3.37/9.39/27.75        7.2%
```

---

### Metricas derivadas observadas (Cenario A, sem veredito)

| Metrica | ANTES | DEPOIS | Banda de aceite final |
|---|---|---|---|
| duracao media da partida | 51.39 min | **51.40 min** | 29 a 36 minutos |
| fracao no limite de 60 minutos | 27.73% | **27.20%** | abaixo de 0,5 por cento |
| fracao abaixo de 25 minutos | 0.1% | **0.3%** | 1 a 12 por cento |
| fracao acima de 45 minutos | 76.3% | **77.3%** | abaixo de 8 por cento |
| abates totais por partida | 87.71 | **88.16** | 22 a 34 |
| torres totais por partida | 9.57 | **9.59** | 10 a 14 |
| baroes por partida | 4.28 | **4.28** | 0,9 a 1,8 |
| fracao de partidas com >=1 Baron | 100.0% | **100.0%** | 75 a 98 por cento |
| dragoes por partida | 5.70 | **5.69** | 3,8 a 5,2 |
| fracao de partidas com Alma | 97.4% | **97.4%** | 30 a 55 por cento |
| fracao de partidas com Elder | 91.7% | **92.1%** | 4 a 18 por cento |
| diferenca de ouro venc/perd no fim | 2301 | **2416** | 7 mil a 14 mil |

---

## 3. Comparacao com o diagnostico de abertura, restrita ao que o defeito movia

Esta secao existe separada da secao 1 porque cobre exatamente as tres familias de metrica que o defeito de assistencia tocava diretamente. As demais linhas da secao 1 estao la para provar o **contrario**: que o resto nao se moveu.

### 3.1 Assistencias por rota, os dois lados com a data de cada um

| Rota | 2026-07-28 (A) | 2026-07-29 (A) | 2026-07-28 (B) | 2026-07-29 (B) | 2026-07-28 (C) | 2026-07-29 (C) |
|---|---|---|---|---|---|---|
| top | 19,00 | **28,23** | 18,85 | **28,21** | 15,47 | **23,31** |
| jungle | 40,81 | **27,33** | 40,41 | **27,21** | 33,42 | **22,60** |
| mid | 17,10 | **25,38** | 16,48 | **24,81** | 13,79 | **20,81** |
| **adc** | **0,00** | **24,59** | **0,00** | **24,36** | **0,00** | **20,10** |
| support | 70,44 | **51,65** | 70,23 | **51,52** | 58,31 | **42,69** |

**Rotas em zero absoluto no relatorio de diagnose: 3 de 15 pares (cenario, rota) antes, ZERO agora.** O criterio 1 da Fase 24 le direto desta tabela.

### 3.2 Participacao em abate por rota (KP-proxy do harness)

| Rota | 2026-07-28 (A) | 2026-07-29 (A) | Referencia STACK.md 4.7 (2025) |
|---|---|---|---|
| top | 0,79 | **0,99** | 56,2% (o mais isolado para baixo) |
| jungle | 1,42 | **1,11** | 73,4% |
| mid | 0,89 | **1,08** | 67,5% |
| adc | 0,52 | **1,08** | 70,0% |
| support | 1,74 | **1,31** | 74,8% |

O KP-proxy do harness e `(K + A) / kills do proprio time` e por isso passa de 1,0 sem ser erro: ele conta o proprio abate mais as assistencias, sem deduplicar. **A leitura util e a ordem, nao o nivel.** Antes: support > jungle > mid > top > adc, com o ADC em ultimo por construcao. Depois: support > jungle > mid ~ adc > top, que e a ordem da fonte (support > jungle > ADC > mid > top) a menos da inversao de 0,00 entre mid e adc. **A ordenacao asserida em `calibrate:assists` esta verde com zero violacoes**, medida no conjunto com campeoes atribuidos (Plano 24-03).

### 3.3 Fracao de placares absurdos (AST-04)

Medida em `scripts/calibrate-micro.ts` no fixture EQUILIBRADO 70x70, N=800, com o limiar `p.assists >= 50` **intacto**:

| Estado | Data | Fracao de placares absurdos |
|---|---|---|
| Pre-correcao (24-01) | 2026-07-28 | **30,6%** |
| Motor corrigido (24-02) | 2026-07-29 | 13,5% |
| **Final da Fase 24 (24-03)** | 2026-07-29 | **4,6%** |

Teto do gate: 5,0%. **Criterio numerico de AST-04 atingido, com a regra de plausibilidade byte a byte inalterada.** As tres regras de placar absurdo e o teto de `toBeLessThan(0.05)` foram conferidos identicos.

Decomposicao por regra no estado final: `support com kills >= 9 e deaths <= 1` em 0 de 800; `top/jungle com kills >= 15 e deaths == 0` em 0 de 800; `qualquer jogador com assists >= 50` em 37 de 800. Todos os 37 disparos sao do suporte. O que se moveu foi o p95 do suporte, de 52 para 44, cruzando para baixo do limiar de 50.

---

## 4. Limitacoes conhecidas deste baseline

### 4.1 O ritmo ainda e o pre-Fase-25, e isso e esperado

Este baseline foi medido com a engine **ainda no ritmo pre-Fase-25**: partida longa, muitos abates, torres lentas. **Isso nao e defeito do baseline: e o estado que ele existe para registrar.** A Fase 24 corrigiu um defeito de distribuicao de assistencia, nunca de ritmo, e o congelamento acontece de proposito **antes** de qualquer mudanca de ritmo.

As metricas derivadas seguem fora das bandas de aceite finais, com a fase dona anotada. As linhas marcadas com `(pace)` vem de `npm run calibrate:all` na mesma data, e nao do bloco de metricas derivadas do `diagnose`; as duas medicoes usam fixtures diferentes e por isso nao devem ser somadas nem cruzadas linha a linha:

| Metrica derivada | Medida neste baseline | Banda final | Fase dona |
|---|---|---|---|
| duracao media da partida | 51,40 min | 29 a 36 min | Fase 25 (via torres/min) |
| fracao no limite de 60 minutos | 27,20% | abaixo de 0,5% | Fase 25 |
| fracao acima de 45 minutos | 77,3% | abaixo de 8% | Fase 25 |
| torres por minuto `(pace)` | 0,184 | 0,300 a 0,450 | **Fase 25** |
| torres aos 20:00 `(pace)` | 1,298 | 2,500 a 5,000 | **Fase 25** |
| mediana da primeira torre `(pace)` | 1365 s | 780 a 1140 s | **Fase 25** |
| placas por partida `(pace)` | 0,790 | 5,000 a 12,000 | **Fase 25** |
| abates totais por partida | 88,16 | 22 a 34 | **Fase 26** |
| abates por minuto `(pace)` | 1,698 | 0,700 a 1,000 | **Fase 26** |
| baroes por partida | 4,28 | 0,9 a 1,8 | Fase 25 (predicao a verificar) |
| dragoes por partida | 5,69 | 3,8 a 5,2 | Fase 25 (predicao a verificar) |
| fracao de partidas com Alma | 97,4% | 30 a 55% | Fase 25 (predicao a verificar) |
| fracao de partidas com Elder | 92,1% | 4 a 18% | Fase 25 (predicao a verificar) |
| ouro por minuto por time `(pace)` | 690 | 1500 a 2100 | **Fase 27** |
| diferenca de ouro venc/perd | 2416 | 7 mil a 14 mil | **Fase 27** |
| acerto do favorito aos 20:00 `(pace)` | 0,615 | 0,700 a 0,850 | **Fase 29** |
| win-rate com gap de forca 30 `(pace)` | 1,000 | 0,800 a 0,970 | **Fase 28** |

### 4.2 A contagem de assistencias do ADC por partida esta acima do teto, e isso e aritmetica, nao regressao

`calibrate:pace` e `calibrate:assists` reportam **assistencias do ADC por partida = 12,395** contra uma banda de 4,000 a 8,000 (alvo 5,500). **Fase dona: Fase 26. Aceitacao final: criterio 5 da Fase 30.**

Esta metrica e **derivada**: e o produto da **taxa** (assistencias do ADC por abate do time, alavanca da Fase 24) pelo **volume** de abates do time (alavanca da Fase 26). A decomposicao fecha exatamente:

```
taxa medida 0,279  x  abates por time 44,37  =  12,38   (o relatorio imprime 12,395)
```

O volume esta em **43,9 a 44,4 abates por time**, contra uma banda de referencia de 22 a 34 por partida (11 a 17 por time). **Com o volume dentro da referencia, a mesma taxa daria entre 3,1 e 4,7 assistencias de ADC por partida**, ou seja praticamente dentro da banda. A banda so fecha pelo volume, e a taxa que a multiplica ja esta no lugar certo.

Nenhum piso, teto, alvo, fonte ou fase dona foi alterado para acomodar isso.

### 4.3 Movimentos observados que este baseline nao explica e nao atribui

- **Win-rate do lado user no fixture simetrico 75x75:** 53,7% para 55,3% no cenario A (N=1500, IC95 binomial +/- 2,52 pp) e 52,7% para 56,2% no ponto de gap 0 da secao D (N=600, IC95 +/- 3,99 pp). Os dois movimentos estao dentro do IC95, mas apontam para o mesmo lado, e **o desvio de 50% ja existia antes da Fase 24**. Este baseline registra o numero; nao propoe causa e nao atribui dono.
- **Coeficiente de bimodalidade da duracao no cenario A:** 0,581 para 0,558, ou seja passou de claramente acima do limiar 0,5556 para em cima dele. No cenario B foi de 0,564 para 0,584. Sem leitura conclusiva.

### 4.4 Limitacoes herdadas do proprio harness

- `scripts/diagnose-engine.ts` **nao contem nenhuma assercao, por design.** Ele e relatorio, nao gate. Os asserts vivem em `scripts/calibrate-*.ts`. Um numero ruim aqui nunca reprova nada sozinho.
- O metodo de percentil e o canonico do projeto (`scripts/stats.ts`, DEC-04, indice arredondado sobre n-1). Percentis deste baseline **nao sao comparaveis linha a linha** com o antigo `tmp/diagnostic-report.txt`, anterior a Fase 23.
- As linhas do bloco `METRICAS DERIVADAS OBSERVADAS` existem apenas para o **cenario A**. Para B e C as mesmas metricas ficam **nao medidas pelo harness** e nao foram interpoladas aqui.
- `eventos/min` e `torres/min` deste documento sao calculados sobre a **media** de duracao, nao sobre a media das razoes por partida. As duas leituras diferem quando a distribuicao e assimetrica, e a duracao aqui e bimodal.

---

## 5. Achado sem dono declarado: a razao agregada de assistencias por abate do time

**O numero.** A engine credita, por abate do time, muito menos assistencias do que o pro play:

| Fonte | Assistencias por time | Abates por time | **Razao** |
|---|---|---|---|
| Engine, diagnostico de abertura (2026-07-28, cenario A) | 73,67 | 43,85 | **1,68** |
| **Engine, este baseline (2026-07-29, cenario A)** | **78,59** | **44,08** | **1,78** |
| Engine, este baseline (cenario B) | 78,06 | 43,84 | 1,78 |
| Engine, este baseline (cenario C) | 64,75 | 36,13 | 1,79 |
| Referencia derivada de `STACK.md` 4.7, **2024** | 31,48 | 13,08 | **2,41** |
| Referencia derivada de `STACK.md` 4.7, **2023** | 29,63 | 12,55 | **2,36** |

As contas das referencias, explicitas, porque o numero nao aparece pronto em tabela nenhuma:

```
2024: assistencias de time = 4,85 + 7,26 + 5,35 + 5,22 + 8,80 = 31,48
      abates de time       = 2,49 + 2,35 + 3,48 + 4,03 + 0,73 = 13,08
      razao                = 31,48 / 13,08 = 2,4067  ->  2,41

2023: assistencias de time = 4,54 + 6,71 + 5,27 + 4,56 + 8,55 = 29,63
      abates de time       = 2,31 + 2,31 + 3,16 + 4,09 + 0,68 = 12,55
      razao                = 29,63 / 12,55 = 2,3610  ->  2,36
```

**O que este achado NAO e.** Ele **nao e o mesmo defeito das tres rotas em zero**, que a Fase 24 corrigiu e que este baseline registra corrigido na secao 3.1. E um segundo defeito, independente, de nivel agregado: mesmo com a distribuicao entre rotas consertada, **cada abate credita menos assistencias do que deveria**. A correcao da Fase 24 melhorou a razao de 1,68 para 1,78, ou seja fechou cerca de 14% da distancia ate 2,41, mas isso foi efeito colateral e **nao foi meta desta fase**.

**Por que ele importa para quem ler depois.** Ele consome praticamente toda a margem da unica banda que a Fase 24 nao fechou. A taxa de assistencias do ADC por abate do time decompoe em `razao agregada x share do ADC`:

```
medido:     1,771 x 15,0%  = 0,266   (piso da banda: 0,280)
referencia: 2,407 x 16,58% = 0,399   (alvo da banda:  0,390)
```

O **share do ADC ja esta praticamente na fonte** (15,0% medido contra 16,58%, distancia de 1,6 ponto). O que sobra e a razao agregada, em **74% do valor esperado**. Mesmo com um share perfeito, a taxa daria `1,771 x 0,1658 = 0,294`, apenas 0,014 acima do piso.

**Sobre o dono, e aqui e preciso ser exato, porque ha duas leituras no registro do projeto:**

1. O Plano 24-05, ao ser escrito, classificou esta razao como **achado sem dono declarado**, e mandou que o baseline a carregasse nesse estado para que ela parasse de ser invisivel.
2. O `24-03-SUMMARY.md` registra, na secao "Decisoes de escopo registradas (tomadas pelo usuario)", uma decisao **posterior**: "A razao agregada de assistencias por abate do time passa a ter dono Fase 26. Deixa de ser achado sem dono declarado."

Este baseline registra **as duas coisas, com a data de cada uma**, e nao escolhe por conta propria. A leitura corrente do projeto e a do item 2 (dono Fase 26, porque a Fase 26 e "Volume de Combate e Densidade Narrativa" e portanto o lugar certo para decidir quantas assistencias um abate credita). O que continua verdadeiro do item 1 e o essencial: **nenhuma banda foi criada para esta razao, nenhum gate a assere hoje, e nenhum numero de `calibrate-assists.ts` foi tocado para registra-la.** Ela e um numero medido e carregado, nao uma meta. Atribuir banda a ela e decisao a tomar, nao a inferir deste arquivo.

---

## 6. Estado dos sete gates na data em que este baseline foi congelado

Esta secao existe para que o baseline seja **autossuficiente**: quem abrir este arquivo na Fase 27 sabe exatamente o que ja estava vermelho quando ele foi congelado, e nao vai atribuir esse vermelho ao proprio trabalho.

Medido com `npm run calibrate:all` em 2026-07-29, no mesmo commit da geracao do relatorio. **Nenhum dos sete gates terminou por estouro de tempo:** todo desfecho e por assercao nomeada. A cadeia foi rodada **duas vezes** e os dois resumos, alem dos valores de cada assert que falhou, sairam identicos.

| Gate | Desfecho | Fase dona do vermelho | Assert em que para, com o valor medido |
|---|---|---|---|
| `calibrate` | **vermelho** | **Fase 28** (FRC-02) | `calibrate-engine.ts:157`, `expected 1 to be less than 0.99` (teto de win rate do tier DOMINANTE). Assert e valor **identicos** aos do inicio da Fase 24 |
| `calibrate:micro` | **vermelho** | **Fase 26** | `media de kills de top 15.79 ultrapassou teto tolerante de 8`. Gate de **volume**, pre-existente (15,67 no estado 24-02) e mascarado ate a Fase 24 fazer o assert anterior passar |
| `calibrate:structures` | **verde** | | |
| `calibrate:objectives` | **verde** | | |
| `calibrate:combat` | **verde** | | |
| `calibrate:pace` | **vermelho** | **Fase 25** (falha dura); 19 bandas em FALHA com dono anotado nas Fases 25, 26, 27, 28 e 29 | `primeira torre antes de 7:00 (420s) no tier GAP-30`, `expected 6 to be +0`. **Mesmo valor 6** do inicio da fase |
| `calibrate:assists` | **vermelho** | **Fase 26** (a razao agregada da secao 5) | Elegibilidade estrutural (H1), piso duro do ADC (H2) e ordenacao de participacao estao em **zero violacoes**. Sobra a banda-raiz: `assistencias do ADC por abate do time [CONTROLE-CARRIES] = 0.266` contra piso `0.280` |

**3 de 7 gates verdes, exatamente o mesmo placar do inicio da Fase 24. Nenhum gate mudou de verde para vermelho: zero regressao colateral.**

**O que mudou dentro do vermelho de `calibrate:assists`, e e a razao de a fase existir:** ele nasceu vermelho em H1 com **7 violacoes**, quatro rotas em zero absoluto de assistencias no conjunto controlado. Hoje H1, H2 e a ordenacao estao em zero violacoes e o que sobra e uma unica banda numerica, a 0,014 do piso, contra 0,031 no inicio do sweep. **A distancia caiu 55% e nenhum limiar de plausibilidade foi tocado para isso.**

**Nota de leitura sobre o resumo impresso pelo proprio `calibrate:all`:** o texto de rodape que ele imprime ainda diz que `calibrate:assists` "continua vermelho ate o Plano 24-02 corrigir o motor: hoje quatro rotas terminam em zero absoluto de assistencias". Esse paragrafo esta **desatualizado** desde o Plano 24-02 e e texto fixo de `scripts/calibrate-all.mjs`. A tabela acima e a leitura correta. Corrigir o rodape ficou fora do escopo desta fase, que nao commita arquivos de `scripts/` a nao ser o `README.md`.

---
