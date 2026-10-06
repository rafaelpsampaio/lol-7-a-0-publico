# Fase 25: relatorio de fechamento

**Data:** 2026-07-30
**Fase:** 25-throughput-estrutural-o-canal-absoluto
**Plano de origem:** 25-08 (fechamento)
**Commit da engine no momento da medicao:** `05fee32` (`roadmap: insere a Fase 25B, forma da distribuicao estrutural`)
**Commit base da fase, usado nas provas por diff:** `a24ea23` (`docs: relatorios de verificacao das fases 23 e 24`), o pai do primeiro commit com escopo da Fase 25
**Ultimo commit que tocou `src/sim/` nesta fase:** `fa59b9d` mais `4210538` (termo de vantagem estrutural e ponto de operacao)

**Comandos de medicao, todos rodados por inteiro neste plano:**

```bash
npm run calibrate:all      # os sete gates, sem curto-circuito  -> tmp/all-25-08.txt
npm run diagnose           # o painel amplo, 15.500 partidas    -> docs/diagnostics/engine-diagnose.txt
npm run probe:side-bias    # a leitura POS de vies, N = 1500    -> tmp/side-bias.txt
node tmp/verify-25-08-diff.cjs   # as provas por diff           -> tmp/diff-proof-25-08.txt
```

Nenhum dos sete gates, nem o painel, nem a sonda terminou por estouro de tempo. Todo desfecho e por assercao nomeada ou por relatorio completo.

---

## BASE DE COMPARACAO, declarada antes de qualquer numero

**Toda comparacao deste relatorio se refere a `docs/baselines/24-baseline-v2.2.md`, o baseline oficial congelado ao fim da Fase 24.**

O diagnostico de 2026-07-28, que abriu a milestone, **nunca** e usado aqui como base. Ele foi medido sobre uma engine com tres rotas estruturalmente excluidas de receber assistencia, e corrigir aquele defeito ja foi, por si so, uma mudanca de calibracao. Se esta fase se comparasse com ele, atribuiria a si mesma uma parte de efeito que veio da Fase 24, e a atribuicao causal da milestone inteira ficaria contaminada sem recuperacao possivel.

**Duas leituras diferentes convivem neste relatorio e nao devem ser somadas nem cruzadas linha a linha:**

- linhas do **painel amplo** (`npm run diagnose`, Cenario A sintetico equilibrado 75 contra 75, N = 1500);
- linhas marcadas com **`(pace)`** (`npm run calibrate:pace`, tier EQUILIBRADO 75 contra 75, N = 800).

As duas usam fixtures e N diferentes. O baseline oficial ja separa as duas do mesmo jeito, na secao 4.1 dele.

---

## O VEREDITO DA FASE, com a leitura humana junto

**A Fase 25 acertou o NIVEL do ritmo estrutural, colapsou a FORMA da distribuicao, e o desenvolvedor confirma por observacao direta que a CAMADA DE EVENTOS continua ruim.**

As seis bandas donas da fase estao dentro, as regras duras da v2.0 seguem em zero absoluto nos seis tiers, nenhuma regra de plausibilidade foi tocada e nenhum sorteio novo entrou. Ao mesmo tempo, a propria fase mediu, no seu fechamento, que a distribuicao de torres deixou de ter forma: o vencedor limpa as tres rotas em **90,8 por cento** das partidas e o perdedor termina com 0 ou 1 torre em **44,9 por cento** delas, num tier espelhado de gap zero.

**Isto nao e um sucesso liso e nao esta escrito como tal.** E uma meta cumprida com **dois defeitos introduzidos, medidos e atribuidos**, cada um ao plano que o produziu, por contrafactual de quatro estados. Os dois tem fase dona propria, a **Fase 25B: Forma da Distribuicao Estrutural**, ja inserida no roadmap entre a 25 e a 26. Nao ficam nesta fase e nao vao para a Fase 30.

E ha uma terceira camada, que so o playback revelou e que a secao seguinte registra por inteiro.

---

## Aceite final humano: PARCIAL

O checkpoint de aceite da fase pedia leitura do relatorio e observacao direta de uma Bo5 completa no app. O desenvolvedor assistiu e deu o veredito. **Ele nao e "aprovado" e nao esta arredondado para isso.**

### O veredito literal

> "Os eventos ainda estao muito ruins e descolados da realidade, mas melhorou bastante coisa."

### Os tres eixos que ele nomeou como ruins

Perguntado sobre o que exatamente esta ruim, entre quatro eixos oferecidos, ele marcou **tres**:

| Eixo reprovado por observacao | Como ele descreveu | Dono |
|---|---|---|
| **volume e mistura** | abate demais, evento demais | **Fase 26**, CBT-01 a CBT-04, banda **ja escrita** e ja vermelha (abates/min 1,383 contra o teto 1,000) |
| **ritmo dentro da partida** | os eventos nao se agrupam como no LoL: inicio quase vazio, meio com objetivo puxando luta, fim com teamfight decidindo | **Fase 26**, NAR-01, densidade gateada por fase de jogo |
| **coerencia e causalidade** | luta que sai do nada, objetivo tomado sem setup, abate que nao leva a nada; no LoL um evento puxa o outro, gank vira torre, Barao vira push | **SEM DONO NO ROADMAP HOJE.** Ver a secao de achado novo abaixo |

### O eixo que ele NAO marcou

**Texto do ticker.** A narracao em si nao e o problema. Isso importa para o sequenciamento: nao ha trabalho de redacao de evento a fazer, o que falta e o que os eventos **significam** e **quando** eles acontecem.

### O que ele reconheceu a favor da fase

> "melhorou bastante coisa"

Isso e **observacao humana de que as mudancas de ritmo tiveram efeito percebido**, e vale exatamente tanto quanto a critica no mesmo registro. A fase mudou duracao de 51:24 para 35:40, primeira torre de 22:45 para 15:45, placas de 0,79 para 10,66 e densidade de 1,82 para 2,33 eventos por minuto, e o efeito **apareceu no playback**, nao apenas na tabela.

### O QUE ESTE VEREDITO NAO REPROVA, e isto precisa estar escrito com estas palavras

**O veredito NAO reprova os cinco criterios de sucesso da Fase 25.** Os cinco sao sobre **ritmo estrutural** e estao **todos fechados por medicao**, com numero e veredito na secao 1 deste relatorio, mais duas provas por diff na secao 7.

**O que o desenvolvedor reprova e a CAMADA DE EVENTOS, que nao e escopo desta fase.** Volume de abates, mistura de tipos de evento, agrupamento temporal e causalidade entre eventos nao aparecem em nenhum dos cinco criterios da Fase 25, e dois dos tres eixos ja tem dono declarado na Fase 26 desde a escrita do roadmap da milestone.

**A leitura futura nao deve tratar esta fase como falhada nem como aprovada lisa.** Ela e: meta de ritmo estrutural cumprida por medicao, com um defeito de forma introduzido e atribuido (dono Fase 25B), e com a camada de eventos reprovada por observacao humana em tres eixos, dois com dono na Fase 26 e um sem dono nenhum.

---

## ACHADO NOVO SEM DONO: coerencia e causalidade entre eventos

**Aberto no aceite final da Fase 25, por observacao humana direta do playback de uma Bo5. Nenhuma medicao automatizada desta fase o detectou.**

**O achado, nas palavras do desenvolvedor:** luta que sai do nada, objetivo tomado sem setup, abate que nao leva a nada. **No LoL um evento puxa o outro: gank vira torre, Barao vira push.**

**Por que ele e diferente dos outros dois eixos reprovados.** Volume e mistura sao **quanto** de cada coisa acontece, e ritmo dentro da partida e **quando** acontece. Os dois sao medidos por contagem e por distribuicao temporal, e a Fase 26 tem instrumento para os dois. **Coerencia e causalidade e sobre o encadeamento**, ou seja se o evento seguinte e consequencia do anterior. Uma partida pode ter volume perfeito e distribuicao temporal perfeita e ainda assim ser uma sequencia de eventos independentes, que e exatamente a queixa.

**Estado do dono: NENHUMA fase de 23 a 30 tem criterio que o cubra.** Isso foi conferido contra os criterios de sucesso de cada fase do roadmap, e nao e um esquecimento de leitura: a milestone v2.2 foi desenhada por **camadas de calibracao** (estrutura, combate, economia, forca, probabilidade de vitoria), e encadeamento causal atravessa todas elas sem pertencer a nenhuma.

**O que NAO foi feito aqui, de proposito:** nenhuma fase nova foi inventada, nenhum criterio novo foi escrito e nenhuma banda foi proposta. Inventar destino para um achado no fechamento de uma fase de calibracao e como a atribuicao causal se perde, e o mesmo argumento ja barrou a forma estreita de D-25-05 e a banda de forma de D-25-06 nesta mesma fase.

**Proximo passo em andamento:** mapeamento do acoplamento causal que **ja existe** na engine (quais eventos hoje alteram estado que outro evento le, e quais sao independentes por construcao), para propor destino com dado em vez de com palpite.

**Registro versionado:** item **D-25-08** em `.planning/phases/25-throughput-estrutural-o-canal-absoluto/deferred-items.md`.

---

## 1. Os cinco criterios de sucesso do roadmap

Cada linha traz o numero medido, a banda e o veredito. Onde o criterio e sobre **diff** e nao sobre numero, a linha traz o resultado da prova automatizada da secao 7.

### Criterio 1: o canal absoluto existe

| Exigencia literal | Medido | Banda | Veredito |
|---|---|---|---|
| torres caidas ate 20:00 em partida equilibrada `(pace)` | **4,793** | [2,500; 5,000], alvo 3,720 | **ATENDIDO** |
| fracao de partidas cuja primeira torre depende do `lateRamp` (rampa ATIVA, >= 2100 s) `(pace)` | **0,0 por cento** (0 de 800) | perto de zero | **ATENDIDO** (era 1,5 por cento, 12 de 800) |
| fracao com a rampa SUFICIENTE sozinha (>= 2262 s) `(pace)` | **0,0 por cento** (0 de 800) | perto de zero | **ATENDIDO** (era 0,5 por cento, 4 de 800) |
| fracao com a primeira torre DEPOIS do primeiro Baron `(pace)` | **0,1 por cento** (1 de 800) | perto de zero | **ATENDIDO** (era 68,0 por cento, 544 de 800) |
| **o diff prova que o `lateRamp` NAO foi alterado** | linha byte a byte identica ao commit base, e o simbolo aparece as mesmas 2 vezes nos dois lados | prova por diff | **ATENDIDO**, ver secao 7 |

O numero central e o **68,0 para 0,1 por cento**. Como Baron antes de 20:00 e ilegal desde a v2.0, aquela linha dizia literalmente que em duas de cada tres partidas equilibradas a primeira torre so caia depois de existir buff de objetivo. Hoje ela cai antes em 799 de 800 partidas.

### Criterio 2: a taxa entra em banda

| Exigencia literal | Medido | Banda | Veredito |
|---|---|---|---|
| torres por minuto `(pace)` | **0,326** | [0,300; 0,450], alvo 0,370 | **ATENDIDO** |
| mediana da primeira torre `(pace)` | **945 s** (15:45) | [780; 1140] s, alvo 970 | **ATENDIDO** |
| ocorrencias de primeira torre antes de 7:00, **os seis tiers** `(pace)` | **0** | zero absoluto | **ATENDIDO** (eram 6 no GAP-30 antes da fase, 8 durante o sweep) |
| o gate de `calibrate-structures` ganhou teto e virou banda de dois lados | **825 s** dentro de [540; 1140] | banda de dois lados | **ATENDIDO** (o piso 540 da Fase 17 preservado byte a byte) |

**Ressalva registrada e nao suavizada:** a banda de `calibrate-structures` mede a mediana sobre uma **subamostra**, porque `st.firstTowerSec` daquele harness so acumula eventos de kind `first_tower`. E o item diferido **D-25-01**, aberto no plano 25-01, com o aviso impresso no proprio relatorio do harness. O numero que vale para o criterio 2 e o de `calibrate:pace`, que cobre 800 de 800 partidas.

### Criterio 3: a separacao estrutural volta a ser a mais extrema

| Exigencia literal | Medido | Banda | Veredito |
|---|---|---|---|
| razao de torres vencedor sobre perdedor `(pace)` | **3,393** | [2,500; 4,500], alvo 3,350 | **ATENDIDO**, a 0,043 do alvo |
| razao de torres MAIOR que a razao de abates da mesma rodada `(pace)` | 3,393 contra **0,891** | ordenacao inter-camada | **ATENDIDO** nos seis tiers |

**Duas ressalvas que precisam ir juntas com esse verde, porque sem elas o numero mente:**

1. **Parte da folga da ordenacao vem do denominador caindo, e nao so do numerador subindo.** A razao de abates saiu de 1,246 para **0,891**, ou seja o perdedor passou a somar mais abates que o vencedor. A banda dela e [1,800; 2,600] e a fase dona e a **Fase 26**. Nada de combate foi tocado nesta fase.
2. **A razao esta dentro da banda com a FORMA errada.** A banda avalia uma razao de **medias**, e razao de medias nao ve forma. Medida por partida no mesmo tier espelhado, ela e bimodal (coeficiente 0,7528 contra o limiar 0,5556), com p75 = p95 = 9,000. Ver a secao "os dois defeitos" abaixo e `docs/diagnostics/25-sweep.md` secoes 6 a 8.

### Criterio 4: nenhuma regra dura cedeu

| Exigencia literal | Medido | Veredito |
|---|---|---|
| torre antes de 5:00, tres tiers estruturais, N = 800 cada | **0** | **ATENDIDO** |
| torre antes de 5:00, Cenario A, B e C do painel, N = 1500 cada | **0 / 0 / 0** | **ATENDIDO** |
| Baron antes de 20:00, os seis tiers de ritmo | **0** | **ATENDIDO** |
| Baron antes de 20:00, Cenario A, B e C do painel | **0 / 0 / 0** | **ATENDIDO** |
| multikill cedo (`triple+ < 8min` e `ace < 8min`), Cenario A, B e C | **0 / 0 / 0** nos dois | **ATENDIDO** |
| ator estrutural early correto (gate >= 85 por cento) | **100,0 por cento** | **ATENDIDO** |
| suporte como ator (gate < 5 por cento) | **1,1 por cento** | **ATENDIDO** (era 9,5 por cento antes do plano 25-04) |
| ADC fora da bot early (gate < 2 por cento) | **0,0 por cento** | **ATENDIDO** |
| freio de cascata: cross-lane simultaneo (gate = 0 no STOMP-FORTE) | **0 eventos** | **ATENDIDO** |
| gap p50 same-lane (gate >= 120 s no EQUILIBRADO) | **285 s** | **ATENDIDO** |
| **o diff prova que `structureTimePlausibility`, o freio de cascata e a plausibilidade de ator NAO foram tocados** | quatro corpos de funcao e quatro constantes byte a byte identicos ao commit base | **ATENDIDO**, ver secao 7 |

**O throughput veio dos gates de MAGNITUDE e nunca dos de plausibilidade.** As duas alavancas foram a taxa do canal absoluto (`SIEGE_ACCRUAL_BASE = 2.2`) e a constante base do caminho do gate (`45` para `27`), mais o termo de vantagem estrutural (expoente 3,5, teto 4,0, piso 0,25). Nenhuma delas e limiar de plausibilidade.

### Criterio 5: a predicao narrativa fica registrada, nao esperada

| Exigencia literal | Medido | Banda | Veredito |
|---|---|---|---|
| placas por partida `(pace)` | **10,660** | [5,000; 12,000], alvo 8,200 | **ATENDIDO** (era 0,790) |
| eventos de torre em risco (`tower_low`) por partida `(pace)` | **13,53** | observado, sem banda | subiu de 6,21 |
| placas por partida, harness estrutural (70 contra 70) | **10,54** | leitura de controle | coerente |
| a compensacao prevista para a Fase 26 gravada com piso e teto **antes** de a Fase 26 rodar | banda `placas por partida` [5; 12] mais `fracao de abates ate 20:00` [0,320; 0,460] e `razao torres sobre abates` [0,330; 0,550], todas ja em `calibrate:pace` com fase dona | banda de dois lados | **ATENDIDO** |

---

## 2. ANTES e DEPOIS contra o baseline oficial da v2.2

Formato da secao 1 do `docs/baselines/24-baseline-v2.2.md`. A coluna ANTES vem daquele arquivo (Cenario A, N = 1500) ou, nas linhas marcadas `(pace)`, do retrato PRE do plano 25-01, que mediu a mesma engine com o harness de ritmo antes de qualquer mudanca de motor.

| Linha | ANTES (baseline v2.2) | DEPOIS (fim da Fase 25) | Delta | Escala de incerteza | Veredito |
|---|---|---|---|---|---|
| **torres por minuto** `(pace)` | 0,184 | **0,326** | **+0,142 (+77,2 por cento)** | nao medido pelo harness | **DENTRO da banda [0,300; 0,450]** |
| torres por minuto (derivada do Cenario A) | 0,1866 | **0,3222** | +0,1356 (+72,7 por cento) | nao medido pelo harness | coerente com a linha `(pace)` |
| **torres aos 20:00** `(pace)` | 1,298 | **4,793** | **+3,495 (mais de tres vezes)** | nao medido pelo harness | **DENTRO da banda [2,500; 5,000]** |
| **mediana da primeira torre** `(pace)` | 1365 s (22:45) | **945 s (15:45)** | **-420 s (-30,8 por cento)** | resolucao do harness: 15 s | **DENTRO da banda [780; 1140]** |
| **placas por partida** `(pace)` | 0,790 | **10,660** | **+9,870 (treze vezes)** | nao medido pelo harness | **DENTRO da banda [5,000; 12,000]** |
| **eventos de torre em risco por partida** `(pace)` | 6,21 | **13,53** | **+7,32 (+117,9 por cento)** | nao medido pelo harness | observado, sem banda |
| **razao de torres vencedor sobre perdedor** `(pace)` | 1,487 | **3,393** | **+1,906** | nao medido pelo harness | **DENTRO da banda [2,500; 4,500]** |
| razao de torres, Cenario A do painel | 1,4716 (5,71 sobre 3,88) | **3,3321** (8,83 sobre 2,65) | +1,8605 | nao medido pelo harness | coerente com a linha `(pace)` |
| **razao de abates vencedor sobre perdedor** `(pace)` | 1,246 | **0,891** | **-0,355** | nao medido pelo harness | **FORA**, banda [1,800; 2,600], **dona Fase 26** |
| razao de abates, Cenario A do painel | 1,2438 (48,87 sobre 39,29) | **0,9116** (24,35 sobre 26,71) | -0,3322 | nao medido pelo harness | mesma leitura |
| **torres totais por partida** (Cenario A) | 9,59 | **11,49** | **+1,90 (+19,8 por cento)** | nao medido pelo harness | observada, banda final [10; 14], **DENTRO** |
| torres do vencedor (Cenario A) | 5,71 | **8,83** | +3,12 | IC95 da media +/- 0,03 | ver secao dos dois defeitos |
| torres do perdedor (Cenario A) | 3,88 | **2,65** | -1,23 | IC95 da media +/- 0,13 | ver secao dos dois defeitos |
| **1a torre DEPOIS do primeiro Baron** `(pace)` | **68,0 por cento** (544/800) | **0,1 por cento** (1/800) | **-67,9 pp** | denominador 800 de 800 nos dois lados | **criterio 1 ATENDIDO** |
| **1a torre com a rampa ATIVA (>= 2100 s)** `(pace)` | 1,5 por cento (12/800) | **0,0 por cento** (0/800) | -1,5 pp | denominador 800 de 800 | **criterio 1 ATENDIDO** |
| **1a torre com a rampa SUFICIENTE sozinha (>= 2262 s)** `(pace)` | 0,5 por cento (4/800) | **0,0 por cento** (0/800) | -0,5 pp | denominador 800 de 800 | **criterio 1 ATENDIDO** |
| primeira torre, media (Cenario A) | 22:20 | **15:24** | -6:56 | IC95 da media +/- 7 s | mesma direcao |
| primeira torre, mediana (Cenario A) | 22:45 | **15:45** | -7:00 | resolucao do harness: 15 s | mesma direcao |
| violacoes de plausibilidade (A, B e C) | 0 / 0 / 0 / 0 | **0 / 0 / 0 / 0** | 0 | assert duro | **IGUAL, zero absoluto nos dois lados** |
| primeira torre antes de 7:00, seis tiers `(pace)` | 6 (todas no GAP-30) | **0** | **-6** | assert duro | **ZERADO** |

### 2.1 Linhas de contexto do painel amplo, para a leitura nao ficar cega

| Linha (Cenario A) | ANTES (baseline v2.2) | DEPOIS | Delta |
|---|---|---|---|
| duracao media | 51:24 (51,40 min) | **35:40 (35,66 min)** | **-15:44 (-30,6 por cento)** |
| jogos acima de 40 minutos | 89,3 por cento | **28,8 por cento** | -60,5 pp |
| eventos por jogo | 93,46 | **83,09** | -10,37 |
| eventos por minuto | 1,82 | **2,33** | +0,51 (+28,0 por cento) |
| abates totais por partida | 88,16 | **51,06** | -37,10 (-42,1 por cento) |
| abates por minuto | 1,72 | **1,43** | -0,29 |
| ouro por minuto por time | 693 | **659** | -34 |
| diferenca de ouro venc/perd no fim | 2416 | **-397** | -2813 |
| first blood (media) | 2:37 | **2:37** | **0 s, byte a byte** |
| win-rate do lado user (fixture 75 contra 75) | 55,3 por cento | **53,3 por cento** | -2,0 pp, dentro do IC95 de +/- 2,5 |
| stomp / equilibrado / comeback | 9,1 / 24,5 / 66,5 por cento | **26,3 / 40,9 / 32,7 por cento** | ver a secao dos dois defeitos |

**A densidade narrativa por minuto SUBIU** (1,82 para 2,33 eventos por minuto) mesmo com a partida encurtando 30,6 por cento e os abates caindo 42,1 por cento, e a razao esta em NAR-02: os eventos estruturais menores substituiram volume de abate. E exatamente a compensacao que o criterio 5 mandava registrar antes de a Fase 26 rodar.

---

## 3. Metricas derivadas: OBSERVADAS, nunca metas desta fase

Formato da secao 4.1 do baseline oficial. **Nenhuma linha desta tabela e meta atingida pela Fase 25**, e nenhuma delas pode ser contada como entrega desta fase. Elas estao aqui porque o baseline manda carrega-las com a banda **final** de aceite e a fase dona ao lado, para que nenhuma fase seguinte as conte duas vezes.

| Metrica derivada | ANTES (baseline v2.2) | DEPOIS (fim da Fase 25) | Banda FINAL de aceite | Fase dona |
|---|---|---|---|---|
| duracao media da partida | 51,40 min | **35,66 min** | 29 a 36 min | **Fase 25 (via torres/min)**, hoje dentro |
| fracao no limite de 60 minutos | 27,20 por cento | **0,40 por cento** | abaixo de 0,5 por cento | Fase 25, hoje dentro pelo painel |
| fracao acima de 45 minutos | 77,3 por cento | **15,4 por cento** | abaixo de 8 por cento | Fase 25, ainda FORA |
| fracao abaixo de 25 minutos | 0,3 por cento | **5,1 por cento** | 1 a 12 por cento | Fase 25, entrou na banda |
| abates totais por partida | 88,16 | **51,06** | 22 a 34 | **Fase 26**, ainda FORA |
| abates por minuto `(pace)` | 1,698 | **1,383** | 0,700 a 1,000 | **Fase 26**, ainda FORA |
| torres totais por partida | 9,59 | **11,49** | 10 a 14 | Fase 25, entrou na banda |
| baroes por partida | 4,28 | **2,19** | 0,9 a 1,8 | Fase 25 (predicao a verificar), ainda FORA |
| fracao de partidas com >= 1 Baron | 100,0 por cento | **99,9 por cento** | 75 a 98 por cento | Fase 25 (predicao a verificar), ainda FORA |
| dragoes por partida | 5,69 | **5,28** | 3,8 a 5,2 | Fase 25 (predicao a verificar), a 0,08 do teto |
| fracao de partidas com Alma | 97,4 por cento | **67,8 por cento** | 30 a 55 por cento | Fase 25 (predicao a verificar), ainda FORA |
| fracao de partidas com Elder | 92,1 por cento | **41,5 por cento** | 4 a 18 por cento | Fase 25 (predicao a verificar), ainda FORA |
| ouro por minuto por time `(pace)` | 690 | **655** | 1500 a 2100 | **Fase 27**, ainda FORA |
| diferenca de ouro venc/perd | 2416 | **-397** | 7 mil a 14 mil | **Fase 27**, ainda FORA |
| acerto do favorito aos 20:00 `(pace)` | 0,615 | **0,890** | 0,700 a 0,850 | **Fase 29**, mudou de lado da banda |
| win-rate com gap de forca 30 `(pace)` | 1,000 | **1,000** | 0,800 a 0,970 | **Fase 28**, ainda FORA |

**Leitura obrigatoria desta tabela, e ela e o oposto de comemoracao:** as derivadas se moveram muito e quase todas na direcao certa, mas **isso e consequencia e nao entrega**. A previsao registrada no roadmap era exatamente essa, que elas cairiam sozinhas quando a alavanca-raiz fosse corrigida. Duas delas mudaram de lado sem ninguem pedir e precisam de atencao das fases donas: `acerto do favorito aos 20:00` saiu do piso e foi para acima do teto (0,615 para 0,890, dona Fase 29), e a `diferenca de ouro` virou negativa (2416 para -397, dona Fase 27), porque o perdedor agora acumula mais abates que o vencedor.

---

## 4. Ordem de entrada em banda: a predicao a verificar

Bloco `=== ORDEM DE ENTRADA EM BANDA (predicao da Fase 25, observacao) ===` de `tmp/calibration-pace.txt`, reproduzido literalmente. **Nenhuma destas linhas entra em `expectBands`: e observacao e nunca gate.**

| metrica | medido | banda de aceite | situacao |
|---|---|---|---|
| torres/min (alavanca-raiz) | 0,326 | [0,30; 0,45] | **DENTRO** |
| duracao media da partida (min) | 35,581 | [29; 36] | **DENTRO** |
| fracao de partidas no teto de 60 minutos | 0,006 | [0; 0,005] | FORA |
| baroes por partida | 2,159 | [0,9; 1,8] | FORA |
| fracao de partidas com Alma | 0,676 | [0,30; 0,55] | FORA |
| fracao de partidas com Elder | 0,401 | [0,04; 0,18] | FORA |

**VEREDITO impresso pelo gate:** `predicao confirmada parcialmente (alavanca-raiz DENTRO; derivadas DENTRO: 1 de 5)`.

### O que esse veredito significa, e por que ele importa

A predicao do roadmap **nao e meta e nao pode virar criterio de parada**. Ela e um teste de **atribuicao causal**: se alguma derivada entrasse na banda **antes** de `torres/min` entrar, isso seria o sinal de que o conserto veio pelo canal errado, ou seja que alguem apertou duracao, Baron, Alma ou Elder diretamente em vez de corrigir a alavanca-raiz.

**A predicao se confirmou e o conserto veio pelo canal certo.** A prova esta na ordem medida ponto a ponto no sweep, e nao apenas no estado final:

| momento da fase | torres/min | derivadas DENTRO | veredito impresso |
|---|---|---|---|
| retrato PRE (plano 25-01) | 0,184 **FORA** | **0 de 5** | predicao ainda nao exercida |
| sweep, taxa 1,0 e 1,6 (plano 25-05) | 0,248 e 0,293 **FORA** | **0 de 5** | predicao ainda nao exercida |
| sweep, taxa 2,0 (plano 25-05) | 0,321 **DENTRO** | **0 de 5** | alavanca-raiz entrou primeiro |
| sweep, taxa 2,2 e acima (plano 25-05) | 0,331 **DENTRO** | 1 de 5 | predicao confirmada parcialmente |
| **fim da fase (plano 25-06 em diante)** | **0,326 DENTRO** | **1 de 5** | **predicao confirmada parcialmente** |

**Em nenhum ponto da fase uma derivada entrou em banda com a alavanca-raiz fora.** A alavanca-raiz entrou primeiro, sozinha, e as derivadas seguiram.

**A regua da pesquisa, para o veredito ter escala** (`25-RESEARCH.md`, Achado 10): na taxa de acumulo 2 a `torres/min` entra em banda com 0,321 e **nenhuma** derivada entrou (duracao 42:20, baroes 3,07, Alma 91 por cento, Elder 73 por cento). As derivadas so chegam perto na taxa 6, e la `torres/min` ja estourou o teto com 0,517. A fase parou muito antes desse ponto.

---

## 5. Vies de lado: o par PRE e POS, sem conserto

**Corrigir o vies de lado esta declarado FORA DE ESCOPO da Fase 25**, pela pesquisa (Achado 8) e pelo roadmap. A sonda `npm run probe:side-bias` existe para que a fase possa afirmar **com numero**, e com a mesma fixture e o mesmo N nos dois lados, que nao amplificou o vies. Ela nao contem uma unica assercao e nao entra na cadeia de `calibrate:all`.

Confronto espelhado, fixture flat 75 contra 75 com stat uniforme em todos os campos nos dois lados, N = 1500, semente igual ao indice da partida, instancia nova de gerador por partida.

| Recorte | PRE (plano 25-02, commit `c542db9`) | POS (fim da fase) | Delta |
|---|---|---|---|
| **taxa total do lado user** | **55,3 por cento**, IC95 +/- 2,5, n = 1500 | **53,3 por cento**, IC95 +/- 2,5, n = 1500 | **-2,0 pp** |
| **taxa condicional por nexo** | **55,9 por cento**, IC95 +/- 2,9, n = 1092 | **53,3 por cento**, IC95 +/- 2,5, n = 1494 | **-2,6 pp** |
| **fracao da populacao decidida por nexo** | **72,8 por cento** | **99,6 por cento** | **+26,8 pp** |
| taxa condicional no teto de 60 minutos | 53,9 por cento, IC95 +/- 4,8, n = 408 | 33,3 por cento, IC95 +/- 37,7, **n = 6** | recorte esvaziou |
| desvio de 50 por cento na taxa total | 5,3 pp | **3,3 pp** | -2,0 pp |

### As tres leituras, e a segunda e a que importa

**Primeira: a fase NAO amplifica o vies.** A taxa total cai 2,0 pp e a condicional por nexo cai 2,6 pp, as duas na direcao de 50 por cento, com meia-largura de IC95 de +/- 2,5 pontos. **A regra de alerta declarada nao disparou:** ela exige taxa condicional por nexo **acima de 58 por cento** com N maior ou igual a 1500, e a medida e 53,3 por cento.

**Segunda, e ela e o achado real: a fase muda QUEM esta exposto.** Antes, 27,2 por cento das partidas terminavam no teto de 60 minutos, e essas eram muito menos enviesadas (53,9 contra 55,9 por cento): elas funcionavam como escapatoria estatistica. Hoje praticamente 100 por cento das partidas terminam por nexo, e o recorte do teto tem **n = 6**, ou seja deixou de existir. **A populacao inteira passa a ficar exposta ao vies, mesmo com o vies medindo menos.** O contraponto honesto ja registrado no plano 25-02: isso **facilita** o trabalho de quem pegar o conserto, porque some a variavel de confusao "partida decidida por tempo".

**Terceira: o caminho descartado era o que amplificaria de verdade.** A alavanca de piso no `force` (`forceFloor = 0,40`), descartada pela fase, mede **58,3 por cento** no recorte por nexo, o valor mais alto de toda a tabela da pesquisa. Ela nao e apenas inerte para o throughput (torres/min de 0,188 para 0,203 contra um piso de banda de 0,300): e a **unica** alavanca medida que amplifica o vies.

**Nada foi corrigido.** Este relatorio registra o par de leituras e nada mais. O item vai para o backlog, sem fase dona, com o criterio de reabertura escrito: taxa condicional por nexo acima de 58 por cento com N maior ou igual a 1500.

---

## 6. Estado dos sete gates

Medido com `npm run calibrate:all` neste plano. **Nenhum dos sete terminou por estouro de tempo:** todo desfecho e por assercao nomeada. Formato da secao 6 do baseline oficial.

| Gate | Desfecho no congelamento do baseline | **Desfecho hoje** | Fase dona do vermelho | Assert em que para, com o valor medido |
|---|---|---|---|---|
| `calibrate` | vermelho | **vermelho** | **Fase 28** (FRC-02) | `calibrate-engine.ts:157`, `expected 1 to be less than 0.99` (teto de win rate do tier DOMINANTE). **Assert e valor identicos aos do congelamento** |
| `calibrate:micro` | vermelho | **VERDE** | | o assert que o prendia (`media de kills de top`) media **15,79** e hoje mede **7,99**, abaixo do teto tolerante de 8 |
| `calibrate:structures` | verde | **verde** | | |
| `calibrate:objectives` | verde | **verde** | | |
| `calibrate:combat` | verde | **verde** | | |
| `calibrate:pace` | vermelho | **vermelho** | **Fases 26, 27, 28 e 29** (oito bandas) | **o assert duro de 7:00 no GAP-30 ZEROU** e o gate agora alcanca `expectBands`, que falha em 8 bandas. **Nenhuma delas e da Fase 25** |
| `calibrate:assists` | vermelho | **vermelho** | **Fase 26** (a razao agregada) | `assistencias do ADC por abate do time [CONTROLE-CARRIES] = 0.262` contra o piso `0.280` |

**4 de 7 gates verdes, contra 3 de 7 no congelamento. NENHUM gate passou de verde para vermelho: zero regressao colateral.** O gate que mudou de lado mudou para o lado bom.

### O que mudou dentro de cada vermelho, e as ressalvas honestas

**`calibrate:pace` e a mudanca mais importante da fase, e ela nao aparece no placar.** No congelamento ele parava no assert duro `primeira torre antes de 7:00 no tier GAP-30, expected 6 to be +0`, **antes** de `expectBands` rodar. Ou seja, as bandas vermelhas apareciam no relatorio mas nunca chegavam a ser a causa nomeada da falha. Hoje aquele assert mede **zero nos seis tiers** e o gate falha pelas bandas, todas com dono em outra fase:

| banda vermelha hoje | valor | banda | fase dona |
|---|---|---|---|
| abates/min | 1,383 | [0,700; 1,000] | Fase 26 |
| razao de abates vencedor sobre perdedor | 0,891 | [1,800; 2,600] | Fase 26 |
| razao torres sobre abates | 0,226 | [0,330; 0,550] | Fase 26 |
| fracao de partidas sem abate ate 10:00 | 0,016 | [0,050; 0,200] | Fase 26 |
| ouro/min por time | 655 | [1500; 2100] | Fase 27 |
| razao de ouro/min vencedor sobre perdedor | 0,991 | [1,100; 1,300] | Fase 27 |
| acerto do favorito aos 20:00 | 0,890 | [0,700; 0,850] | Fase 29 |
| win-rate com gap de forca 30 | 1,000 | [0,800; 0,970] | Fase 28 |

**`calibrate:micro` ficou verde por margem apertada, e isso precisa estar escrito.** A media de kills de top mede **7,99** contra o teto tolerante de **8**, ou seja **0,01 de folga**. Ele e gate de **volume**, dono declarado da **Fase 26**, e ficou verde como efeito colateral da queda de 42 por cento nos abates. Qualquer movimento da Fase 26 na direcao de mais volume o devolve ao vermelho. **Nao contar este verde como entrega da Fase 25.**

**`calibrate:assists` afastou-se do piso, e isso tambem precisa estar escrito sem suavizar.** A taxa media **0,262** contra **0,266** no congelamento, ou seja a distancia do piso 0,280 subiu de 0,014 para **0,018**. A razao agregada de assistencias por abate do time segue em 1,776, praticamente parada contra os 1,771 do congelamento. A causa e a mesma queda de volume de abates: a taxa e o quociente e o denominador se moveu. Fase dona: **Fase 26**. Nenhum limiar foi tocado.

---

## 7. Provas por diff

Verificacao automatizada, `node tmp/verify-25-08-diff.cjs`, saida completa em `tmp/diff-proof-25-08.txt`. Ela compara, byte a byte, a versao do **commit base da fase** (`a24ea23`, o pai de `0f6fae9`, que e o primeiro commit com escopo da Fase 25) contra a arvore de hoje.

**Sanidade da base, conferida antes de qualquer comparacao:** o blob de `src/sim/structures.ts` no commit base e identico ao do commit que criou os planos da fase (`4183bb1`), ou seja a base representa mesmo o estado pre-fase.

**Nota de metodo, declarada porque ela e a diferenca entre uma comparacao valida e uma que sempre acusa:** `core.autocrlf` esta em `true` neste repositorio, entao o blob no git guarda LF e a arvore de trabalho tem CRLF. A normalizacao de fim de linha e aplicada aos **dois** lados antes da comparacao. O que fica provado byte a byte e o **conteudo**, que e o que os criterios 1 e 4 exigem.

### 7.1 Corpos das funcoes protegidas (criterio 4)

| Funcao | Tamanho | Resultado |
|---|---|---|
| `structureTimePlausibility` (a curva temporal de plausibilidade) | 28 linhas, 952 bytes | **IDENTICO** |
| `cascadeDamageMultiplier` (o freio de cascata) | 27 linhas, 976 bytes | **IDENTICO** |
| `deriveBypass` (o desvio de freio) | 14 linhas, 476 bytes | **IDENTICO** |
| `buildStructureActorCandidates` (a lista de candidatos de ator plausivel) | 39 linhas, 1239 bytes | **IDENTICO** |

### 7.2 Constantes de cascata (criterio 4)

| Constante | Valor nos dois lados | Resultado |
|---|---|---|
| `CASCADE_REDUCAO_MAX` | `0.25` | **IDENTICA** |
| `CASCADE_N_LANE_SEC` | `180` | **IDENTICA** |
| `CASCADE_REDUCAO_GLOBAL` | `0.50` | **IDENTICA** |
| `CASCADE_N_GLOBAL_SEC` | `45` | **IDENTICA** |

### 7.3 A rampa de fim de jogo (criterio 1)

```
antes  : const lateRamp = Math.max(0, (state.gameTimeSec - 2100) / 900); // +0 at 35:00, +1 at 50:00
depois : const lateRamp = Math.max(0, (state.gameTimeSec - 2100) / 900); // +0 at 35:00, +1 at 50:00
```

**IDENTICA byte a byte**, comentario incluso. O simbolo `lateRamp` aparece **2 vezes** nos dois lados, ou seja nenhum uso novo foi acrescentado nem removido.

**O criterio 1 exige as duas coisas ao mesmo tempo, e as duas estao provadas:** a rampa nao foi alterada, e a fracao de partidas que dependem dela caiu de **1,5 por cento para 0,0 por cento** (rampa ativa) e de **0,5 por cento para 0,0 por cento** (rampa suficiente sozinha), medida antes e depois com a mesma fixture e o mesmo N.

### 7.4 A linha do gate de pressao estrutural

```
if (force <= 0.18 || rng() > force) return null;
```

**IDENTICA byte a byte, com exatamente uma ocorrencia nos dois lados.** Essa e a armadilha central do roadmap: a expressao faz curto-circuito, entao mexer no `0.18` pareceria mudanca de magnitude mas seria mudanca de **frequencia de consumo do gerador**, deslocando a sequencia inteira dali para frente.

### 7.5 Chamadas ao gerador em `src/sim/`, por contagem

Contagem canonica do projeto, o literal `rng(` (a mesma de `grep -ro "rng(" src/sim --include="*.ts"`).

| Arquivo de producao tocado pela fase | chamadas `rng(` antes | depois | delta | identificador `rng` antes | depois |
|---|---|---|---|---|---|
| `src/sim/engine.ts` | 25 | **25** | **0** | 98 | 98 |
| `src/sim/structures.ts` | 12 | **12** | **0** | 28 | **22** |
| **soma dos arquivos tocados** | **37** | **37** | **0** | | |
| `src/sim/` inteiro, so producao | 70 | **70** | **0** | | |
| `src/sim/` inteiro, contagem canonica com testes | **72** | **72** | **0** | | |

**Nenhuma chamada nova ao gerador entrou em `src/sim/` na fase inteira.** Os 72 do contrato de determinismo por semente estao intactos.

**Uma correcao de leitura sobre a expectativa do plano.** O plano previa que a contagem tivesse **caido**, porque o plano 25-03 removeu argumentos de gerador de quatro pontos de chamada. Medido, a contagem de **chamadas** nao caiu (12 para 12 em `structures.ts`): o que o 25-03 removeu foi o **parametro**, e isso aparece na contagem do **identificador** `rng`, que cai de **28 para 22** naquele arquivo. As duas leituras dizem coisas diferentes e as duas estao na tabela: a exposicao ao gerador diminuiu, e o numero de sorteios consumidos ficou igual. Para o contrato de determinismo o que importa e a segunda, e ela esta em zero delta.

---

## 8. Caminhos descartados, confirmados

O registro versionado esta em `docs/diagnostics/25-caminhos-descartados.md`, escrito no plano 25-02, **antes** de qualquer plano de motor comecar. **Nenhum dos cinco foi usado nesta fase**, e a arvore de hoje prova isso:

| Caminho descartado | Numero que fechou o assunto | Confirmacao na arvore de hoje |
|---|---|---|
| 1. piso no `force`, de 0,18 para 0,40 | torres/min de 0,188 para 0,203 contra piso de banda 0,300; e o unico que **amplifica** o vies (58,3 por cento por nexo) | nao existe `forceFloor` em `src/sim/`; a linha do gate esta byte a byte intacta (secao 7.4) |
| 2. zerar o limiar 0,18 | torres/min de 0,188 para **0,186**, ou seja para baixo | o literal `0.18` esta intacto na linha do gate (secao 7.4) |
| 3. **subir** o `base` do gate, de 45 para 90 | mais 15 por cento de torres/min mas placas de 0,76 para 0,36, corte de pool em 41 por cento e tres violacoes do assert de 7:00 | a fase **reduziu** a base de 45 para 27, que e o movimento oposto e pelo motivo oposto (zerar o assert de 7:00) |
| 4. fonte de vantagem por abates | razao de torres 1,64 com expoente 3, contra piso 2,5 | o termo de vantagem le **exclusivamente** contagem de torres ja derrubadas, com teste de contrato proprio |
| 5. fonte de vantagem por `winProbUser` | funciona numericamente (2,54) e foi recusada por acoplamento com a Fase 29 | `winProbUser` nao e lido de dentro de `src/sim/structures.ts` |

---

## Os dois defeitos que a fase introduziu, mediu e atribuiu

Esta secao existe porque o relatorio nao seria honesto sem ela, e porque a Fase 25B precisa herdar a atribuicao pronta em vez de remedir.

**A fase acertou o nivel e colapsou a forma.** O achado nasceu no proprio fechamento, no plano 25-07, quando o diff de golden mostrou 13 de 15 blocos com o vencedor em exatamente 9 torres. A medicao que se seguiu confirmou que aquilo **nao** era artefato de 15 sementes.

| leitura, tier EQUILIBRADO 75 contra 75, gap ZERO, N = 800 | pre-Fase-25 | hoje |
|---|---|---|
| vencedor no maximo do contador (9 torres) | 3,9 por cento | **90,8 por cento** |
| vitoria limpando **uma** rota (o que o invariante declara suficiente) | 58,0 por cento | **2,6 por cento** |
| vitoria limpando **tres** rotas | 3,9 por cento | **90,8 por cento** |
| coeficiente de variacao das torres do vencedor | 0,2777 | **0,0568** |
| fracao SHUTOUT (perdedor com 0 ou 1 torre) | 17,9 por cento | **44,9 por cento** |
| partidas exatamente 9 a 0 | 0,1 por cento | **20,9 por cento** |

**Sao dois defeitos com autores distintos, e nenhum deles isolado produz o estado de hoje.** Atribuicao fechada por contrafactual de quatro estados, validado contra cinco registros independentes, entre eles o **baseline oficial congelado na Fase 24** (torres vencedor sobre perdedor 5,755 e 3,875 medidos contra 5,71 e 3,88 do baseline, com harness e N diferentes):

- **o canal absoluto (plano 25-04) e o autor do colapso do numerador** e da violacao do invariante escrito em `src/sim/structures.test.ts:4-9`;
- **o termo de vantagem (plano 25-06) e o autor do shutout**, que ele multiplica por **32 vezes**;
- **a constante base do caminho do gate (plano 25-05) esta ABSOLVIDA**: no passo dela tudo segue unimodal e a vitoria por uma rota **melhora**.

**Um terceiro achado, que ficou sem dono declarado:** a **primeira torre** perdeu 46 por cento da dispersao relativa (coeficiente de variacao de 0,2545 para 0,1364, amplitude p5 a p95 de 1140 s para 420 s) com a **banda DENTRO** em 945 s. E o caso de manual do modo de falha que nenhuma banda da v2.2 vigia: o nivel esta certo e a distribuicao encolheu por mais de dois tercos. Junto dele, a fracao de partidas com **virada** caiu de 66,5 para **32,7 por cento** e a de atropelo quase triplicou, num tier espelhado de gap zero. A causa **nao** foi atribuida por contrafactual, e atribui-la sem medir seria adivinhar.

**Destino, ja decidido:** os dois defeitos atribuidos vao para a **Fase 25B: Forma da Distribuicao Estrutural**, inserida no roadmap entre a 25 e a 26, com orcamento proprio de regeneracao de golden e cinco criterios de sucesso proprios. A onda 1 dela e a banda de dispersao aprovada, pelo padrao instrumento antes de motor. **Eles nao ficam na Fase 25 e nao vao para a Fase 30.**

**Aviso de instrumento herdado, e ele muda a leitura de quem for medir razao depois:** o coeficiente de bimodalidade sobre **razao de inteiros pequenos** e instrumento **saturado**. Ele esta acima do limiar nos **quatro** estados do contrafactual, inclusive no pre-fase, e aplicado ao pe da letra teria **ABSOLVIDO** a Fase 25. Medir forma nas **distribuicoes** separadas e na contagem de rotas limpas, nunca na razao. Registro completo em `docs/diagnostics/25-sweep.md`, o bloco `AVISO DE INSTRUMENTO`.

---

## Registro de conformidade da fase

| Invariante | Estado |
|---|---|
| regras duras da v2.0 em zero absoluto, seis tiers e tres cenarios | **zero** |
| `rng(` em `src/sim/`, contagem canonica | **72**, delta zero contra o commit base |
| linha do gate `if (force <= 0.18 \|\| rng() > force) return null;` | byte a byte intacta |
| regeneracoes de golden na fase | **uma**, deliberada, cobrindo os dois snapshots de valor em commits isolados |
| dependencias novas no `package.json` | **zero** |
| gates que passaram de verde para vermelho | **zero** |
| suite completa (`npx vitest run --testTimeout=60000`) | **901 de 901**, 57 arquivos, `tmp/suite-25-08.txt` |
| travessao em codigo, documento ou mensagem de commit | **zero** |

---

## Onde cada numero deste relatorio pode ser reconferido

| Assunto | Arquivo |
|---|---|
| os sete gates | `tmp/all-25-08.txt` |
| bandas, ordem de entrada e as tres fracoes de dependencia | `tmp/calibration-pace.txt` |
| regras duras estruturais, cascata e ator | `tmp/calibration-structures.txt` |
| painel amplo pos-fase | `docs/diagnostics/engine-diagnose.txt` |
| baseline congelado da Fase 24 | `docs/baselines/24-baseline-v2.2.md` |
| vies de lado, leitura POS | `tmp/side-bias.txt` |
| provas por diff | `tmp/diff-proof-25-08.txt` |
| sweeps, contrafactual, forma e dispersao | `docs/diagnostics/25-sweep.md` |
| caminhos descartados | `docs/diagnostics/25-caminhos-descartados.md` |
| itens diferidos com dono | `.planning/phases/25-throughput-estrutural-o-canal-absoluto/deferred-items.md` |
