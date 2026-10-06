# Fase 25: o sweep de sensibilidade das alavancas de throughput estrutural

**Data:** 2026-07-29
**Fase:** 25-throughput-estrutural-o-canal-absoluto
**Plano de origem:** 25-05 (Task 1 e Task 2)
**Proposito, em uma linha:** registrar, ponto por ponto, o sweep de uma alavanca por commit que escolheu a taxa do canal absoluto e a constante base do caminho do gate, com o criterio escrito antes dos numeros e a margem declarada para o plano seguinte.

**Comando de medicao de cada ponto:** `npm run calibrate:pace` (seis tiers, N igual a 800 por tier, semente igual ao indice da partida) e `npm run calibrate:structures` (tres tiers, N igual a 800), os dois completos, rodados por inteiro entre uma iteracao e a proxima. Nenhum ponto deste documento foi medido so no tier EQUILIBRADO: medir so o tier de referencia esconderia o comportamento nos tiers de gap, que e onde a fase quebra, e o assert que decide a segunda alavanca vive no tier GAP-30.

**Bandas donas da fase**, as quatro de ritmo mais a razao, com a fonte em `STACK.md` secao 7:

| banda | piso | teto | alvo |
|---|---|---|---|
| torres/min | 0,300 | 0,450 | 0,370 |
| torres aos 20:00 | 2,500 | 5,000 | 3,720 |
| mediana da primeira torre (s) | 780 | 1140 | 970 |
| placas por partida | 5,000 | 12,000 | 8,200 |
| razao de torres vencedor sobre perdedor | 2,500 | 4,500 | 3,350 |

A razao de torres e **alavanca do plano 25-06**, nao deste. Ela aparece nas tabelas abaixo como coluna observada, porque a reducao da base a move, e esse efeito precisa ficar registrado onde o plano seguinte vai ler.

**Validade:** os numeros absolutos valem enquanto `src/sim/structures.ts` e `src/sim/engine.ts` nao mudarem. As sensibilidades (quanto cada alavanca move cada banda) sobrevivem a mudancas pequenas e sao o que este documento existe para preservar.

**Este documento vai receber o sweep bidimensional do plano 25-06**, quando o termo de vantagem estrutural entrar e as duas alavancas fixadas aqui tiverem de ser lidas em conjunto com ele. As secoes 1 e 2 abaixo sao os dois eixos daquele plano, ja com o ponto de operacao e a folga de cada um medidos.

---

## AVISO DE INSTRUMENTO, leia antes de medir qualquer RAZAO

**Coeficiente de bimodalidade sobre razao de inteiros pequenos e instrumento SATURADO e NAO deve ser usado como discriminante.** As Fases 26 a 30 vao querer medir razoes (razao de abates, razao de ouro por minuto, razao de torres), e este aviso existe para que o erro abaixo nao seja repetido.

**O que aconteceu, medido no plano 25-07.** O criterio de decisao daquele fechamento dizia, com todas as letras: "se o estado pre-fase ja e bimodal, o defeito precede a fase". Aplicado ao pe da letra sobre o coeficiente de bimodalidade da **razao de torres**, ele teria **ABSOLVIDO a Fase 25**, porque o coeficiente esta acima do limiar de 0,5556 nos **quatro** estados do contrafactual:

| estado | BC da razao por partida | leitura ingenua |
| --- | --- | --- |
| **D** pre-Fase-25 | **0,7359** | "ja era bimodal, logo nao e a fase" |
| **C** canal desligado | 0,6986 | idem |
| **B** termo desligado | 0,6451 | idem |
| **A** hoje | 0,7528 | idem |

**Por que a leitura e falsa.** A razao vencedor sobre perdedor e um **quociente de inteiros pequenos** (as duas contagens vao de 0 a 9) e tem tres propriedades que quebram o coeficiente:

1. **massa pontual**, com p25 = **1,000 exato** em B, C e D, porque empate de contagem e o caso mais comum;
2. **cauda longa a direita**, ilimitada por construcao quando o denominador cai para 1;
3. **indefinicao** quando o perdedor termina em zero torre, o que descarta de 0,8 a 22,9 por cento da amostra dependendo do estado, e o descarte **nao e aleatorio**: ele remove justamente os casos extremos.

O coeficiente de bimodalidade e `(assimetria ao quadrado mais 1) sobre (curtose de excesso mais correcao)`, entao massa pontual e cauda longa **inflam** o numerador e **deprimem** o denominador ao mesmo tempo. O resultado fica alto **sem que existam duas pilhas**. Em D a razao esta concentrada perto de 1,4 com p95 em 6; em A ela tem p50 3,0 e **p75 = p95 = 9,0**, que sao duas pilhas de verdade. **Os dois medem cerca de 0,73 e significam coisas opostas.**

**O instrumento que discrimina, e foi ele que resolveu o caso:** as distribuicoes das **duas contagens separadas** (torres do vencedor e torres do perdedor) e a **contagem de rotas limpas por inteiro**. Elas sao limitadas, sem massa pontual dominante e sempre definidas, e sao **unimodais em C e D e bimodais em B e A**, que e o sinal correto. O coeficiente de variacao das torres do vencedor (0,2777 para 0,0568) e monotono nos quatro estados e mede exatamente o colapso.

**Regra pratica para as fases seguintes:**

- **nunca** classificar forma de uma razao pelo coeficiente de bimodalidade dela;
- medir a forma do **numerador e do denominador separadamente**, que e onde o defeito de verdade aparece;
- quando for preciso uma unica variavel de forma, usar uma **transformacao limitada**, por exemplo a participacao `vencedor / (vencedor mais perdedor)` em [0, 1], que nao tem cauda nem indefinicao. Ressalva medida: no plano 25-07 essa participacao deu 0,5339, tecnicamente unimodal, a 4 por cento do limiar, e **no tier GAP-LEVE virou 0,6980 bimodal**, ou seja ela e melhor que a razao mas ainda nao e suficiente sozinha;
- e, na duvida, olhar o **histograma**. Em D-25-06 o histograma das torres do perdedor mostra as duas pilhas (183 partidas em zero e 176 em uma, contra 20 em oito) sem precisar de nenhum coeficiente.

**Lugar onde a razao continua sendo o instrumento certo:** para medir **nivel**, a razao de medias e adequada e e o que as bandas usam. O aviso e sobre **forma**, nao sobre nivel.

---

## Secao 1: a taxa do canal absoluto (Task 1)

### O criterio, escrito antes dos numeros

Na ordem de prioridade declarada pelo plano:

1. **regras duras em zero absoluto** (torre antes de 5:00 e Baron antes de 20:00) em todos os seis tiers. Ponto que viola isso esta fora, sem discussao.
2. **as quatro bandas de ritmo donas da fase dentro dos limites** no tier EQUILIBRADO.
3. **margem para o termo de vantagem do plano 25-06**, que acrescenta throughput. O acrescimo medido pela pesquisa (Achado 7, linha "torres ja derrubadas expoente 3") e de cerca de **mais 0,019 em torres/min** e **mais 1,50 em torres aos 20:00**. O ponto escolhido tem de deixar esse acrescimo caber dentro das bandas, e a conta tem de estar escrita.
4. **entre pontos empatados, preferir a menor taxa**, porque o termo de vantagem so acrescenta.

### Os pontos medidos

Todos com a constante base do caminho do gate parada em **45**, que e o valor que o plano anterior entregou e que so a Task 2 tem autorizacao para mover. Os cinco pontos obrigatorios sao 1,0 (menos 50 por cento), 1,6 (menos 20 por cento), 2,0 (o central, herdado do plano 25-04), 2,4 (mais 20 por cento) e 3,0 (mais 50 por cento). O ponto 2,2 e intermediario adicional, medido porque a leitura dos cinco mostrou que a decisao estava entre 2,0 e 2,4.

Os mesmos pontos na notacao do literal de `SIEGE_ACCRUAL_BASE` em `src/sim/structures.ts`, que e onde cada um foi aplicado para ser medido: `1.0`, `1.6`, `2.0`, `2.2`, `2.4` e `3.0`. As tabelas deste documento usam virgula decimal, que e a convencao de texto do projeto; o codigo usa ponto.

| taxa | torres/min | torres aos 20:00 | mediana 1a torre (s) | placas | razao torres | razao abates | torres totais | duracao (min) | teto de 60 min | 7:00 no GAP-30 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1,0 (menos 50%) | **0,248 FORA** | **1,749 FORA** | **1185 FORA** | **2,958 FORA** | 1,415 | 1,254 | 11,90 | 47,279 | 0,090 | 8 |
| 1,6 (menos 20%) | **0,293 FORA** | **2,074 FORA** | 960 | 7,793 | 1,322 | 1,236 | 13,20 | 44,642 | 0,034 | 8 |
| 2,0 (central) | 0,321 | 2,572 | 900 | 8,803 | 1,262 | 1,251 | 14,10 | 43,705 | 0,009 | 8 |
| **2,2 (escolhido)** | **0,331** | **3,010** | **885** | **9,751** | 1,270 | 1,239 | 14,20 | 42,712 | 0,003 | 9 |
| 2,4 (mais 20%) | 0,345 | 3,435 | 840 | 10,905 | 1,244 | 1,243 | 14,53 | 42,054 | 0,003 | 9 |
| 3,0 (mais 50%) | 0,380 | 4,390 | 810 | **14,654 FORA** | 1,200 | 1,262 | 15,16 | 39,963 | 0,000 | 14 |

Regras duras por tier, os seis tiers, em **todos** os seis pontos de taxa: **torre antes de 5:00 igual a zero** nos tres tiers do gate estrutural e **Baron antes de 20:00 igual a zero** nos seis tiers do gate de ritmo. Nenhum ponto da taxa foi eliminado pelo criterio 1. Gate cross-lane simultaneo igual a zero nos tres tiers em todos os pontos.

Veredito do bloco de ordem de entrada em banda: **alavanca-raiz DENTRO e zero derivadas dentro** nos pontos 1,0, 1,6 e 2,0 (nos dois primeiros a alavanca-raiz esta fora, ou seja a predicao ainda nao foi exercida); nos pontos 2,2, 2,4 e 3,0 o relator passa a "predicao confirmada parcialmente" com **uma** derivada dentro, e a derivada que entra e a fracao de partidas no teto de 60 minutos. Nenhuma derivada entrou antes da alavanca-raiz em nenhum ponto, que e o desfecho correto: derivada entrando primeiro seria o sinal de que o conserto veio pelo canal errado.

### Duas leituras que a tabela entrega e que valem nomear

**A taxa nao e a causa das violacoes de 7:00.** O contador do tier GAP-30 fica em 8 nas taxas 1,0, 1,6 e 2,0, sobe para 9 em 2,2 e 2,4 e para 14 em 3,0. Zerar o contador por reducao de taxa e impossivel: em 1,0 as quatro bandas ja estao fora e o contador continua em 8. Isso confirma por medicao, e nao por argumento, a atribuicao do Achado 6: a causa e a magnitude do caminho do gate, e a alavanca e a Task 2.

**A regiao de trabalho medida se confirma e se estreita.** A pesquisa deu de 1,5 a 3,0 com otimo perto de 2,0 a 2,5. Medido com o gate completo, a regiao em que as quatro bandas entram ao mesmo tempo e de **2,0 a 2,4 inclusive**: em 1,6 duas bandas ainda estao fora (torres/min 0,293 contra o piso 0,300, e torres aos 20:00 2,074 contra o piso 2,500) e em 3,0 as placas estouram o teto e as torres totais saem da faixa de 10 a 14.

### O ponto escolhido: taxa 2,2

Criterio 1 nao separa nenhum ponto. Criterio 2 elimina 1,0, 1,6 e 3,0, e deixa **2,0, 2,2 e 2,4**.

Criterio 3, com a conta escrita, aplicando o acrescimo medido do termo de vantagem sobre cada candidato:

| candidato | torres/min mais 0,019 | contra o teto 0,450 | torres aos 20:00 mais 1,50 | contra o teto 5,000 | placas projetadas | contra o teto 12 |
|---|---|---|---|---|---|---|
| 2,0 | 0,340 | folga 0,110 | 4,07 | folga 0,93 | cerca de 9,8 | folga 2,2 |
| 2,2 | 0,350 | folga 0,100 | 4,51 | folga 0,49 | cerca de 10,8 | folga 1,2 |
| 2,4 | 0,364 | folga 0,086 | 4,94 | **folga 0,06** | cerca de **12,0** | **folga zero** |

A taxa 2,4 e eliminada pelo criterio 3: com o termo de vantagem as placas chegam ao teto e torres aos 20:00 fica a 0,06 dele. Sobram 2,0 e 2,2, e pelo criterio 4 a preferencia seria 2,0.

**A restricao que desempatou, e ela e medida e nao suposta.** O criterio 4 do plano justifica preferir a menor taxa com a frase "porque o termo de vantagem so acrescenta". Isso e verdade para o plano 25-06, mas ignora que a **segunda alavanca deste mesmo plano SUBTRAI**: a reducao da constante base existe para zerar o assert de 7:00 e, ao enfraquecer o caminho do gate, tira throughput. Medido, com a base no valor que a Task 2 escolheu (30):

| taxa | base | torres/min | torres aos 20:00 | mediana 1a torre (s) | placas | 7:00 no GAP-30 |
|---|---|---|---|---|---|---|
| 2,0 | 30 | 0,309 (piso 0,300, folga 0,009) | **2,303, ABAIXO do piso 2,500** | 1005 | 9,236 | 0 |
| 2,2 | 30 | 0,324 (folga 0,024) | **2,794, dentro, folga 0,294** | 960 | 10,180 | 0 |

A taxa 2,0 **nao sobrevive a propria fase**: ela satisfaz as quatro bandas com a base em 45, e perde a banda de torres aos 20:00 assim que a base cai para o valor que zera o assert de 7:00 com folga. A taxa tem de absorver a subtracao desta fase antes de receber a adicao da proxima, e 2,0 nao absorve.

**Escolhido: taxa 2,2.** Ela e o unico ponto que satisfaz os quatro criterios declarados **e** sobrevive a reducao da base na mesma fase. Entre ela e 2,4, o criterio 4 seleciona a menor.

**Margem declarada para o plano 25-06**, no ponto de operacao final da fase (taxa 2,2 com base 30, medido, nao projetado):

- torres/min: **0,324** mais 0,019 da **0,343** contra o teto **0,450**, folga **0,107**;
- torres aos 20:00: **2,794** mais 1,50 da **4,29** contra o teto **5,000**, folga **0,71**;
- placas: **10,180** contra o teto **12,000**, folga **1,82**;
- mediana da primeira torre: **960 s**, banda [780; 1140]; o termo de vantagem a encurta, e a folga contra o piso e de **180 s**.

### Desvio de escopo registrado

O plano previa que a Task 1 escolhesse a taxa olhando somente pontos medidos com a base em 45, e que a interacao entre as duas alavancas fosse assunto do sweep bidimensional do plano 25-06. A medicao mostrou que essa separacao **nao e possivel dentro desta fase**, porque a Task 2 do proprio plano 25-05 move a base e, com isso, tira uma banda de dentro para fora na taxa que os quatro criterios teriam escolhido. As duas linhas de viabilidade acima foram medidas antes de a taxa ser commitada, e por isso a escolha e 2,2 e nao 2,0. A disciplina de **uma alavanca por commit foi preservada por inteiro**: o commit da taxa move somente a taxa, com a base parada em 45, e as duas linhas de viabilidade sao medicao, nao commit.

---

## Secao 2: a constante base do caminho do gate (Task 2)

### O criterio, escrito antes dos numeros

Na ordem de prioridade declarada pelo plano:

1. **zero violacoes de torre antes de 7:00 em todos os seis tiers**, e zero violacoes de torre antes de 5:00 e de Baron antes de 20:00.
2. **as quatro bandas de ritmo donas da fase seguem dentro dos limites** no tier EQUILIBRADO depois da mudanca.
3. **margem para o termo de vantagem do plano 25-06**, e o plano marca este como o ponto de maior risco da fase: sem teto, o termo de vantagem reintroduz violacao de 7:00 no tier de gap 30. A instrucao e explicita, **escolher a base com folga em vez de escolher o maior valor que apenas zera hoje**, e a recomendacao da pesquisa de fixar a base perto de 30 tem de ser considerada e aceita ou recusada com numero.
4. **entre pontos empatados nos criterios acima, preferir o que der mais placas e menos corte de pool.**

**Aumentar a base e proibido**, e a razao esta medida em `docs/diagnostics/25-caminhos-descartados.md`: base 90 da mais 15 por cento de torres/min mas derruba as placas de 0,76 para 0,36, leva o corte do pool a 41 por cento e reintroduz tres violacoes do assert de 7:00. Os criterios 2 e 4 puxam esta constante em direcoes opostas, e por isso ela precisa de sweep e nao de palpite.

### A aritmetica do Achado 6, reproduzida com a base antiga e com a nova

`structureTimePlausibility("outer", t)` e uma sigmoide centrada em 360 s com inclinacao 0,025, e aos 6:30 (390 s) ela vale **0,6792**, ou seja ja liberou 68 por cento do dano. Num tier de gap 30 (90 contra 60) o caso normal e `wave = 1,4` (pressao acima de 30 e vantagem de rota acima de 1), `numbersAdvantage = 1,15`, `tierMod = 1,0` para a torre externa e `objBuff = 1,12` pelas tres larvas do Vazio, que nascem as 5:00. O produto dos fatores sem a base:

```
1,4 x 1,0 x 1,15 x 0,6792 x 1,0 x 1,12 = 1,2247
```

| base | dano por passagem | passagens para 100 | leitura |
|---|---|---|---|
| **45 (antiga)** | 45 x 1,2247 = **55,1** | 100 / 55,1 = **1,81** | **duas passagens antes de 6:30 derrubam a primeira torre.** Num gap de 30 a forca fica acima do limiar desde os 5:00, entao duas passagens em seis minutos e trivial. Sao as violacoes. |
| **27 (nova)** | 27 x 1,2247 = **33,1** | 100 / 33,1 = **3,02** | tres passagens antes de 6:30 nao acontecem. |

**Nenhuma regra de plausibilidade foi tocada para chegar a esse resultado.** `structureTimePlausibility`, `cascadeDamageMultiplier`, as quatro constantes de cascata, `deriveBypass`, `buildStructureActorCandidates` e a rampa de fim de jogo seguem com os mesmos valores. A base e gate de **magnitude**, e foi a magnitude que mudou. Essa e a diferenca entre consertar o assert e afrouxa-lo.

### Classificacao registrada: a violacao de 7:00 nao e regressao da v2.0

Isto precisa ficar escrito porque muda a leitura do vermelho. A regra dura da v2.0 e **torre antes de 5:00**, ela e medida em `calibrate-structures` e esta em **zero absoluto** nos tres tiers estruturais, em **todos** os pontos de sweep deste documento, com a base antiga e com a nova. O limite de **7:00 e uma banda nova e mais rigorosa**, cuja fonte e o minimo absoluto observado de 8:15 em 500 jogos pro (`STACK.md` secao 7), e ela encontrou um cenario que a v2.0 nunca testou: um gap de 30 pontos com larvas do Vazio vivas aos 6:30. O vermelho ja existia com 6 violacoes **antes** de a Fase 25 encostar em `src/sim/`, e era divida herdada com dono declarado neste plano.

### Os pontos medidos

Todos com a taxa do canal absoluto parada em **2,2**, que e a alavanca da Task 1, commitada antes e nao tocada aqui. Os quatro pontos obrigatorios sao 36 (menos 20 por cento), 30, 27 e 22,5 (menos 50 por cento). O ponto 33 e intermediario adicional, medido para localizar exatamente onde esta a fronteira da violacao, porque o criterio 3 depende disso.

| base | 7:00 por tier (os seis) | passagens aos 6:30 | torres/min | torres aos 20:00 | mediana 1a torre (s) | placas | razao torres | razao abates | torres totais | duracao (min) | teto de 60 min |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 45 (antiga) | **8** (GAP-30 8) | 1,81 | 0,331 | 3,010 | 885 | 9,751 | 1,270 | 1,239 | 14,20 | 42,712 | 0,003 |
| 36 (menos 20%) | **2** (PRO-GAP 1, GAP-30 1) | 2,27 | 0,327 | 2,888 | 945 | 9,989 | 1,222 | 1,273 | 14,78 | 45,183 | 0,011 |
| 33 (adicional) | **0** | 2,47 | 0,327 | 2,855 | 960 | 10,105 | 1,231 | 1,233 | 14,85 | 45,438 | 0,014 |
| 30 (recomendado pela pesquisa) | **0** | 2,72 | 0,324 | 2,794 | 960 | 10,180 | 1,214 | 1,252 | 15,14 | 46,770 | 0,030 |
| **27 (escolhido)** | **0** | **3,02** | **0,321** | **2,751** | **990** | **10,279** | 1,202 | 1,233 | 15,33 | 47,719 | 0,046 |
| 22,5 (menos 50%) | **0** | 3,63 | 0,315 | 2,678 | 1020 | 10,394 | 1,177 | 1,256 | 15,68 | 49,847 | 0,069 |

Regras duras da v2.0 em **todos** os pontos: torre antes de 5:00 igual a zero nos tres tiers estruturais, Baron antes de 20:00 igual a zero nos seis tiers, cross-lane simultaneo igual a zero nos tres tiers. As quatro bandas donas da fase estao **dentro** em todos os pontos de 45 a 22,5, e o conjunto de bandas vermelhas de outras fases e **identico** em todos os pontos, ou seja nenhum ponto da base trocou uma banda por outra.

### A descoberta que muda a decisao: a pesquisa mediu a base antes de o canal existir

A pesquisa (Achado 6, secao C) mediu **base 36 dando zero violacoes**. Medido agora, com o canal absoluto ligado na taxa 2,2, **base 36 volta a violar**: 1 violacao no GAP-30 e 1 no PRO-GAP, um tier que estava limpo. A explicacao e direta e nao contradiz a pesquisa: as medicoes do Achado 6 foram feitas com o caminho do gate como **unica** fonte de dano estrutural, e agora sao **duas** fontes somando no mesmo pool. O canal contribui dano antes dos 6:30, entao o caminho do gate precisa de menos passagens que a conta de 100 dividido pelo dano por passagem sugere.

Consequencia para o criterio 3, e ela e o eixo da escolha: **a fronteira da violacao nao esta entre 45 e 36, esta entre 36 e 33.** O maior valor medido que ainda zera e **33**. Logo a base 30 recomendada pela pesquisa esta a **um unico passo** da fronteira.

### Quanto de folga cada candidato tem, em numero

O termo de vantagem do plano 25-06 acrescenta magnitude ao lado forte, que no GAP-30 e exatamente o lado que viola. Tratando esse acrescimo como um fator multiplicativo `A` sobre o dano do caminho do gate, a violacao volta quando o numero de passagens aos 6:30 cai ao patamar em que ela ja foi observada. A fronteira medida esta entre 2,27 passagens (base 36, viola) e 2,47 (base 33, zera), ou seja em cerca de **2,4 passagens**. Com `passagens = 100 / (base x 1,2247)`, a violacao volta quando `base x A` passa de cerca de **34**:

| candidato | passagens aos 6:30 | `A` que reintroduz a violacao | folga |
|---|---|---|---|
| 33 | 2,47 | 1,03 | **3 por cento** |
| 30 (recomendacao da pesquisa) | 2,72 | 1,13 | **13 por cento** |
| **27 (escolhido)** | 3,02 | 1,26 | **26 por cento** |
| 22,5 | 3,63 | 1,51 | 51 por cento |

### A recomendacao de fixar a base perto de 30: RECUSADA, com numero

O plano exige que essa recomendacao seja considerada explicitamente e aceita ou recusada com numero. Ela e **recusada**, e a razao e a propria instrucao do criterio 3, "escolher a base com folga em vez de escolher o maior valor que apenas zera hoje":

- a recomendacao de 30 nasceu da leitura de que a fronteira estava entre 45 e 36. Medido com o canal ligado, a fronteira esta entre **36 e 33**, e portanto **30 e apenas um passo abaixo dela**;
- a folga de 30 contra o termo de vantagem e de **13 por cento** de acrescimo de magnitude. O termo de vantagem do plano 25-06 tem de levar a razao de torres de cerca de 1,20 para o piso de 2,500, que e uma mudanca grande, e 13 por cento nao e uma folga proporcional a esse tamanho;
- a folga de **27 e de 26 por cento**, o dobro, e o custo de descer de 30 para 27 e pequeno e todo em metrica **observada** e nao em banda: duracao mais 0,95 min, fracao no teto de 60 min de 0,030 para 0,046, torres/min de 0,324 para 0,321 (folga de piso ainda de 0,021), torres aos 20:00 de 2,794 para 2,751 (folga de piso ainda de 0,251);
- pelo criterio 4, 27 ainda **ganha** de 30 e de 33 em placas (10,279 contra 10,180 e 10,105), porque base menor corta menos dano no limite de 100 do pool e atravessa menos multiplos de 20 por tick.

**Por que nao 22,5, que tem folga ainda maior.** Ela tambem zera e tambem mantem as quatro bandas, mas o custo sai de metrica observada e comeca a encostar em banda: torres/min cai para 0,315, a **0,015 do piso 0,300**, a mediana da primeira torre sobe para 1020 s contra o teto 1140, a duracao media vai a 49,8 min e a fracao de partidas terminando no teto de 60 minutos vai a **0,069**, ou seja quase 7 por cento das partidas deixam de se resolver dentro do tempo. O criterio de nunca empatar no teto tem precedencia declarada no projeto. A base 27 fica com 0,046 nessa metrica e com 0,021 de folga no piso de torres/min.

**Escolhido: base 27.** Ela zera o assert de 7:00 nos seis tiers, mantem as quatro bandas dentro, deixa 26 por cento de folga de magnitude para o termo de vantagem do plano 25-06 e da mais placas que qualquer ponto acima dela.

### Uma leitura honesta sobre quando o termo de vantagem morde

A tabela de folga acima trata o termo de vantagem como um fator multiplicativo ativo aos 6:30, que e a hipotese conservadora e e a que o plano usa. Vale registrar a leitura alternativa, porque ela muda o tamanho do risco: se o termo de vantagem do plano 25-06 for funcao de **torres ja derrubadas** (a forma que o Achado 7 mediu, com expoente 3), ele vale o piso dele aos 6:30, porque nesse instante **nenhuma torre caiu ainda**, e nesse caso ele nao pressiona o assert de 7:00 de forma nenhuma. Nos dois cenarios a base 27 e adequada: no conservador ela tem 26 por cento de folga, e no outro a folga e irrelevante porque a pressao nao existe. O que a base 27 **nao** faz e apostar num dos dois.

### O efeito colateral que o plano 25-06 precisa carregar

A reducao da base **piora a razao de torres vencedor sobre perdedor**, que e a banda do plano 25-06: de 1,270 na base 45 para 1,202 na base 27. O mecanismo e coerente e nao e defeito. O caminho do gate e o caminho **assimetrico** (a forca dele e um diferencial, logo favorece quem esta na frente) e o canal absoluto e **simetrico** por decisao do plano 25-04. Reduzir a base desloca a mistura na direcao do canal simetrico, e mistura mais simetrica separa menos vencedor de perdedor. O conserto e o termo de vantagem, e ele e a alavanca do plano seguinte.

**Assert de ordenacao inter-camada, o aviso ativo.** O assert exige razao de torres MAIOR que razao de abates na mesma rodada. As duas medidas, ponto por ponto:

| base | razao de torres | razao de abates | margem |
|---|---|---|---|
| 45 | 1,270 | 1,239 | +0,031 |
| 36 | 1,222 | 1,273 | **-0,051** |
| 33 | 1,231 | 1,233 | -0,002 |
| 30 | 1,214 | 1,252 | -0,038 |
| **27** | **1,202** | **1,233** | **-0,031** |
| 22,5 | 1,177 | 1,256 | -0,079 |

A margem vira negativa. Duas leituras que precisam ir juntas para que o numero seja interpretado certo:

1. **a razao de abates nao foi movida por este plano.** Ela oscila entre 1,233 e 1,273 sem ordem em relacao a base (1,239, 1,273, 1,233, 1,252, 1,233, 1,256), ou seja o que muda nela e ruido de forma de partida a N=800, nao efeito da alavanca. O que caiu de forma monotona foi a **razao de torres**, pelo mecanismo do paragrafo anterior;
2. **a margem de 0,011 do plano 25-04 ja estava dentro do ruido das duas medidas**, e portanto o sinal dela nunca foi informacao confiavel. A separacao das duas razoes so passa a ser mensuravel quando o termo de vantagem levar a razao de torres para a ordem de 2,5, que e o alvo do plano 25-06.

Este assert **nao esta alcancavel hoje**, e isso importa para a leitura do gate: ele roda depois de `expectBands`, que ja falha por 11 bandas de outras fases mais a razao de torres da propria Fase 25. Logo a execucao para antes dele. Ele volta a ser alcancavel quando as bandas fecharem, e a Fase 26 nao deve subir a razao de abates antes de o plano 25-06 subir a razao de torres.

### O conflito que este sweep descobriu, e que nenhuma das duas alavancas resolve

**`npm run calibrate:structures` sai 0 antes deste plano e sai 1 depois dele.** O assert duro que quebra e o do criterio 3, `scripts/calibrate-structures.ts`:

```
criterio 3: total de torres plausivel -- media por partida (15.14) deve ser <= 14 (EQUILIBRADO)
```

Isto **nao e afrouxamento de nada e nao foi tocado**: e consequencia medida das duas alavancas. Registro do valor ponto por ponto, no tier EQUILIBRADO do harness estrutural (70 contra 70):

| ponto | torres totais por partida | limite | 7:00 nos seis tiers |
|---|---|---|---|
| taxa 2,0 base 45 (estado do plano 25-04) | **13,95** | <= 14 | 8 |
| taxa 2,2 base 45 | 14,24 | <= 14 | 9 |
| taxa 2,0 base 33 | 14,60 | <= 14 | **0** |
| taxa 2,2 base 36 | 14,76 | <= 14 | 2 |
| taxa 2,2 base 33 | 14,82 | <= 14 | **0** |
| taxa 2,0 base 27 | 15,08 | <= 14 | **0** |
| taxa 2,2 base 30 | 15,13 | <= 14 | **0** |
| **taxa 2,2 base 27 (escolhido)** | **15,14** | <= 14 | **0** |
| taxa 2,2 base 22,5 | 15,56 | <= 14 | **0** |

**O assert e inalcancavel pelas duas alavancas desta fase, e a prova esta na tabela.** Zerar o assert de 7:00 exige base menor ou igual a 33. O menor valor de torres totais em qualquer ponto com o 7:00 zerado e **14,60**, e esse ponto (taxa 2,0 base 33) **ja perde a banda de torres aos 20:00**, que mede 2,365 contra o piso 2,500. O menor valor com o 7:00 zerado **e** as quatro bandas dentro e **14,82**, na base 33, ainda acima do limite de 14. Nao existe ponto no espaco das duas alavancas que satisfaca ao mesmo tempo o assert de 7:00, as quatro bandas e o limite de 14.

**A causa esta identificada, e o proprio assert aponta para ela.** O comentario do assert em `calibrate-structures.ts` diz com todas as letras: "Se este assert falhar com valores MAIORES, verificar cascata (STR-05) ou duracao media." A cascata nao foi tocada (as quatro constantes seguem intactas e o gate de cross-lane mede zero nos tres tiers). Sobra a **duracao media**, e ela e o numero que explica tudo:

```
torres totais = torres/min x duracao
```

Com torres/min corretamente dentro da banda em 0,321, o limite de 14 torres exige duracao de no maximo **43,6 min**. A duracao medida no ponto escolhido e **47,7 min**, contra a banda de aceite de **[29; 36] min**. Ou seja: o limite de 14 nao e alcancavel enquanto a duracao estiver 32 por cento acima do teto da banda dela.

**E a duracao nao e alavanca desta fase.** O bloco de ordem de entrada em banda do gate de ritmo diz isso explicitamente, e diz que ela nao pode virar criterio de parada da Fase 25: duracao, baroes, Alma e Elder sao **observados** aqui, com donos anotados nas Fases 26 a 29, e a previsao registrada e que caem sozinhos quando as camadas donas forem corrigidas. Reduzir a base, que e o que zera o assert de 7:00, **alonga** a partida (42,7 min na base 45 contra 47,7 na base 27), porque tira magnitude do caminho que fecha o jogo. As duas exigencias apontam para lados opostos.

**Decisao registrada, e ela precisa de confirmacao humana no fechamento da fase (plano 25-08).** O ponto escolhido mantem o assert de 7:00 em zero e as quatro bandas dentro, e deixa o assert de torres totais vermelho, com o dono do conserto sendo quem baixar a duracao. As alternativas foram consideradas e recusadas:

- **subir a base para manter torres totais abaixo de 14**: recusado, porque reintroduz a violacao do assert de 7:00, que e o alvo declarado deste plano, e porque a base 45 do plano anterior ja passava com margem de apenas 0,05;
- **afrouxar o limite de 14**: recusado, porque o plano proibe afrouxar limiar de teste ou de gate, e porque o limite tem origem fisica (cada lado tem 9 estruturas contadas em `towersDestroyed`, logo 18 no total, e 15,14 significa partida chegando perto da exaustao estrutural do mapa, o que e implausivel de verdade e nao um detalhe de calibracao);
- **acrescentar um decaimento tardio ao canal absoluto**, que resolveria a exaustao sem tocar o early: recusado **neste plano**, porque e termo novo e a disciplina e uma alavanca por commit. E o candidato natural para a fase que for dona da duracao, e fica registrado aqui como tal.

---

## Secao 3: quanto o caminho do Arauto esconde dos gates (medicao, nenhuma alavanca movida)

**Por que esta secao existe.** O plano 25-04 levantou que `resolveHeraldUse` derruba estrutura de verdade (ele chama `damageStructure`, que executa a queda e incrementa `towersDestroyed`) mas emite **sempre** o evento de kind `tower_low`, por decisao OBJ-01 de uma fase anterior. A hipotese a testar era grave: se essas quedas fossem invisiveis aos gates, `torres/min` estaria **subcontando**, e a banda [0,300; 0,450] estaria sendo satisfeita por uma metrica incompleta. Nesse caso a calibracao da taxa precisaria ser refeita para baixo.

**Nada foi alterado para medir isto.** A sonda (`tmp/probe-arauto.test.ts`, nao versionada) roda o mesmo tier e as mesmas sementes do gate de ritmo (N=800, semente igual ao indice) e classifica o texto do ticker, que carrega o `label` devolvido por `damageStructure`. O kind emitido pelo Arauto **nao foi tocado** (seria mexer em OBJ-01) e o gate **nao foi alterado** para incluir a queda.

### O achado que responde a hipotese: torres/min NAO subconta

A hipotese e **refutada por leitura de codigo confirmada por medicao**. `torres/min` do gate de ritmo nao e contado por evento: ele vem de `finalState.user.towersDestroyed` mais `finalState.rival.towersDestroyed` (`calibrate-pace.ts`), e o caminho do Arauto **incrementa esse contador**, porque `damageStructure` chama `recordTower()` antes de devolver. **A queda do Arauto ja esta dentro do 0,321.**

Metricas por origem do numero, que e a distincao que faltava estar escrita:

| metrica do gate | le de onde | ve a queda do Arauto? |
|---|---|---|
| torres/min | estado (`towersDestroyed`) | **SIM, ja incluida** |
| torres totais por partida | estado (`towersDestroyed`) | **SIM** |
| torres aos 20:00 | estado, via `score.userTowers` | **SIM** |
| razao de torres vencedor sobre perdedor | estado (`towersDestroyed`) | **SIM** |
| mediana da primeira torre | **evento** de kind `first_tower` / `tower_destroyed` | **NAO** |
| assert duro de torre antes de 7:00 | **evento** de kind `first_tower` / `tower_destroyed` | **NAO** |

### torres/min nas duas leituras, tier EQUILIBRADO, no ponto de operacao final

| leitura | torres/min | torres totais por partida |
|---|---|---|
| **pelo estado, que e a que o gate usa e que JA inclui o Arauto** | **0,321** | 15,329 |
| pelos eventos de kind de torre (exclui o Arauto, inclui torre do Nexus) | 0,327 | 15,621 |
| pelo estado, EXCLUINDO a queda do Arauto (contrafactual) | **0,300** | 14,329 |

**Contribuicao do Arauto: 1,000 queda real de torre por partida**, em 800 de 800 partidas (toda partida usa o Arauto uma vez e a queda sempre acontece). Distribuicao por tier de estrutura: 638 torres externas, 159 internas e 3 do inibidor. Ela responde por **0,021 dos 0,321**, ou 6,5 por cento do total.

**A leitura corrigida nao fica acima do teto**, e essa era a pergunta que decidia se a calibracao precisava ser refeita para baixo. Nao existe correcao para cima a fazer: a leitura do gate ja e a completa, com 0,321 contra o teto de 0,450. **A calibracao da taxa nao precisa ser refeita.** O numero contrafactual de 0,300 diz o contrario do temido: sem o Arauto a metrica cairia exatamente para o piso da banda.

### Uma discrepancia oposta, que ninguem tinha registrado

A conciliacao das duas contagens fecha na virgula e revela um segundo efeito, de sinal contrario ao do Arauto:

```
estado 15,329  mais  torre do Nexus 1,292  menos  Arauto 1,000  =  15,621  =  evento 15,621
```

**A queda de torre do Nexus emite evento `tower_destroyed` mas NAO incrementa `towersDestroyed`**, porque aquele ramo de `damageStructure` e o unico ramo de torre que nao chama `recordTower()`. Sao 1,292 por partida no EQUILIBRADO. Ou seja o estado subconta a torre do Nexus na mesma medida em que o evento subconta o Arauto, e os dois efeitos se cancelam em parte. Nenhum dos dois foi corrigido aqui: os dois estao fora do escopo de uma alavanca por commit, e o do Nexus toca a contagem que alimenta `torres/min` e portanto todas as bandas da fase. Fica registrado como item diferido.

### O assert de 7:00 e cego ao Arauto, mas o zero e real

Esta era a preocupacao mais seria, porque o assert e por evento e o Arauto e invisivel a ele: um Arauto derrubando a primeira torre antes de 7:00 nao seria contado. Medido nas duas leituras, nos dois tiers que importam:

| tier | antes de 7:00 pelo evento (o que o assert mede) | antes de 7:00 incluindo a queda do Arauto | violacoes que o assert nao ve |
|---|---|---|---|
| EQUILIBRADO | 0 | 0 | **0** |
| GAP-30 | 0 | 0 | **0** |

**Zero quedas de torre pelo Arauto acontecem antes de 7:00**, nos dois tiers, em 800 partidas cada. O zero do assert **nao e artefato da invisibilidade do Arauto**: ele e real nas duas leituras. O conserto da base fecha a divida de verdade.

### O que o Arauto de fato distorce: a mediana da primeira torre

| leitura, tier EQUILIBRADO | mediana da primeira torre | media |
|---|---|---|
| pelo evento (o que o gate mede e o que a banda avalia) | **990 s** (16:30) | 978,0 s |
| incluindo a queda pelo Arauto (a primeira torre que de fato caiu) | **870 s** (14:30) | 860,9 s |

A metrica do gate esta **120 s atrasada** em relacao ao que acontece na partida, e a causa e que em **59,4 por cento das partidas do EQUILIBRADO a primeira torre real e derrubada pelo Arauto** e narrada como `tower_low`. **As duas leituras caem dentro da banda [780; 1140]**, entao o veredito da banda nao muda, mas o vies existe, tem sinal conhecido e tem tamanho medido. No GAP-30 o efeito e nulo (a primeira torre real vem do Arauto em 1 partida de 800, e a mediana e 615 s nas duas leituras).

### Decisao registrada

**Nada foi mudado, por escolha.** Mexer no kind emitido pelo Arauto e mexer em OBJ-01, muda a linha do tempo e portanto os snapshots, e alterar o gate para incluir a queda mudaria a definicao de uma banda no meio da fase que a esta calibrando. As duas coisas ficam para o fechamento da fase (plano 25-08), agora com o dado na mesa: a decisao a tomar e sobre **narrativa e sobre a mediana da primeira torre**, nao sobre `torres/min`, que nunca subcontou.

---

## Secao 4: o sweep bidimensional do termo de vantagem estrutural (plano 25-06, Task 2)

**Nota de numeracao:** o plano 25-06 chama esta de "terceira secao". Ela e a **quarta** do documento, porque a secao 3 (a medicao do caminho do Arauto) foi escrita depois que o plano 25-06 foi redigido. A ordem e a numeracao dizem a mesma coisa: esta e a secao do sweep bidimensional, e ela e a terceira **de sweep**.

### A EXCECAO CONSCIENTE, declarada antes de qualquer numero desta secao

A disciplina desta fase e **uma alavanca por commit**, e ela existe porque a atribuicao causal da fase inteira depende dela. Esta secao registra a **unica excecao consciente** a essa regra, e a excecao vale **somente** para o par expoente e teto do termo de vantagem: nenhum outro commit da Fase 25 move duas constantes.

A justificativa e numerica e tem os dois lados da armadilha medidos pela pesquisa (Achado 7):

- com **expoente 3 e sem teto**, o tier equilibrado da razao de torres 2,54, dentro da banda, mas os tiers de gap explodem: gap leve 4,71, gap 20 vai a 14,91, **gap 30 vai a 22,67 e reintroduz violacao do assert duro de torre antes de 7:00**, e o tier amador com gap vai a 21,25;
- com **teto 2,0** o problema inverte: a razao no tier equilibrado desaba para **1,82**, abaixo do piso 2,5 da banda. A tabela de teto medida pela pesquisa no tier equilibrado (1,5 da 1,73; 1,8 da 1,72; 2,0 da 1,82; 2,5 da 2,08; 3,0 da 2,20) mostra que mover um parametro sozinho nunca acha o ponto.

Varrer um de cada vez percorreria apenas as **bordas** de uma regiao que so existe no interior. E por isso, e so por isso, os dois se movem no mesmo commit.

**O piso do termo fica FIXO em 0,25 e FORA da grade.** Isso e o que mantem o sweep **bidimensional** em vez de tridimensional, e a razao de fixa-lo e de contrato e nao de conveniencia: o piso existe para que o lado que esta atras nunca fique sem throughput estrutural, ou seja para que a partida continue fechando por estrutura. Varre-lo transformaria uma garantia em parametro de ajuste.

### O criterio de escolha, escrito antes de olhar os numeros

Na ordem de prioridade declarada pelo plano:

1. **zero violacoes** de torre antes de 7:00, de torre antes de 5:00 e de Baron antes de 20:00 em **todos os seis tiers**. Ponto que viola isso esta fora, sem discussao. Este e o criterio que a pesquisa marcou como o de maior risco da fase;
2. **razao de torres vencedor sobre perdedor dentro de [2,500; 4,500]** no tier equilibrado, com o assert de ordenacao inter-camada passando (razao de torres maior que razao de abates);
3. **as quatro bandas de ritmo donas da fase seguem dentro dos limites** (torres/min, torres aos 20:00, mediana da primeira torre e placas);
4. entre pontos empatados, preferir o de **razao mais proxima da referencia de 3,350** e o de **menor teto**, porque teto menor e menos exposicao nos tiers de gap.

**A regra de escalada, escrita antes de varrer:** se nenhum ponto satisfizesse os criterios 1 e 2 ao mesmo tempo, a acao correta **nao** seria voltar e mexer na taxa do canal nem na constante base do caminho do gate (fixadas por medicao na secao 2), **nao** seria alargar banda e **nao** seria varrer para fora da regiao sem registrar por que. Seria parar e **escalar a decisao** ao desenvolvedor com a tabela completa. A regra nao precisou ser exercida: onze dos doze pontos satisfazem os criterios 1 a 3.

### O teste de sanidade da forma, feito ANTES do sweep

O plano exige, antes de varrer, conferir que a forma fechada implementada reproduz a medicao da pesquisa: com expoente 3 e teto folgado, o tier equilibrado deveria medir razao de torres **proxima de 2,7** (a pesquisa mediu 2,73 com a fonte estrutural e expoente 3, sem teto).

**Medido, e divergiu.** Duas leituras, porque uma sozinha nao separa as causas:

| configuracao | razao de torres no EQUILIBRADO | referencia da pesquisa |
| --- | --- | --- |
| expoente 3, teto 100 (folgado), no ponto de operacao **atual** (taxa 2,2 e base do gate 27) | **3,850** | 2,73 |
| expoente 3, teto 100 (folgado), no ponto de operacao **da propria pesquisa** (taxa 2,0 e base do gate 45) | **3,350** | 2,73 |

A segunda linha e a que decide a atribuicao, e ela foi medida **restaurando as duas constantes ao fim** (medicao, nunca commit, seguindo o precedente da secao 1). Ela diz que **metade da divergencia (0,50 de 1,12) e o ponto de operacao**, que mudou entre a pesquisa e a execucao, e a outra metade nao.

**A forma NAO foi torcida para reproduzir 2,73, e a razao esta escrita.** A implementacao do termo que a pesquisa usou **nao e recuperavel**: ela era um patch temporario em `src/sim/` acionado por `globalThis.__SIEGE_KNOBS`, nunca commitado, e o que sobrou em disco (`tmp/probe-advsrc.test.ts` e `tmp/probe-siege-lib.ts`) so passa os parametros, sem conter a formula. Diante disso, o que foi implementado e **exatamente a forma fechada que o plano prescreve**: a participacao do lado nas torres ja derrubadas, dobrada para que a paridade caia em 1, elevada ao expoente e cortada pelo piso e pelo teto, com guarda explicita do zero contra zero. Os cinco pontos do contrato tem teste e passam: paridade igual a 1 por identidade, monotonicidade, limites nos dois extremos, fonte exclusivamente estrutural e ausencia de sorteio.

**A hipotese mais provavel para a metade que sobra, registrada como hipotese e nao como fato:** um pseudo-contador de suavizacao na sonda, do tipo `(proprias mais 1) sobre (total mais 2)`, que e o jeito natural de escrever a mesma ideia **sem** precisar de guarda para o zero contra zero. Ele preserva a paridade em 1 e enfraquece os extremos de forma uniforme, que e exatamente o sinal observado (o termo medido aqui e cerca de duas vezes mais forte em efeito sobre torres/min: mais 0,037 contra mais 0,019 da pesquisa). Trocar a forma prescrita por essa para fazer o 2,73 aparecer seria **ajustar a forma a um numero**, que e a mesma falta que o plano proibe ao proibir varrer para compensar. Nao foi feito.

**Consequencia pratica, e ela e boa:** como o termo e mais forte que o da pesquisa, o ponto de operacao esta na **parte baixa** da regiao declarada, e nao acima dela. A grade nao precisou ser estendida.

### A grade medida: doze pontos, seis tiers, N=800 por tier

Taxa do canal parada em **2,2** e constante base do caminho do gate parada em **27** em todos os doze pontos, que sao os valores fixados nas secoes 1 e 2 e que este plano nao tem autorizacao para mover. Piso do termo parado em **0,25**.

A coluna do **tier GAP-LEVE** esta incluida por recomendacao literal da pesquisa (pergunta em aberto 2): ele e um proxy melhor de "dois times pro ligeiramente diferentes" que o espelho perfeito do tier equilibrado.

Linha de referencia, o estado **antes** do termo (o que a secao 2 entregou): razao de torres **1,202**, razao no gap leve 1,68, razao de abates 1,233, torres/min 0,321, torres aos 20:00 2,751, mediana da primeira torre 990 s, placas 10,279, vencedor e perdedor 8,37 e 6,96, torres totais 15,33, duracao 47,72 min, teto de 60 min 0,046, violacoes de 7:00 zero.

| expoente | teto | razao torres EQ | razao torres GAP-LEVE | razao abates | torres/min | torres aos 20:00 | mediana 1a torre (s) | placas | torres V / P | torres totais | duracao (min) | teto de 60 min | 7:00 nos 6 tiers | Baron nos 6 tiers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 2,5 | **2,474 FORA** | 4,95 | 0,991 | 0,304 | 3,522 | 975 | 10,496 | 8,73 / 3,53 | 12,26 | 40,42 | 0,010 | 0 | 0 |
| 3 | 3,0 | 2,765 | 5,03 | 0,962 | 0,313 | 3,990 | 960 | 10,565 | 8,77 / 3,17 | 11,95 | 38,28 | 0,005 | 0 | 0 |
| 3 | 3,5 | 2,977 | 5,20 | 0,935 | 0,319 | 4,438 | 960 | 10,611 | 8,80 / 2,96 | 11,76 | 37,20 | 0,007 | 0 | 0 |
| 3 | 4,0 | 3,182 | 5,50 | 0,889 | 0,325 | 4,751 | 945 | 10,660 | 8,85 / 2,78 | 11,63 | 36,17 | 0,007 | 0 | 0 |
| 3,5 | 2,5 | 2,576 | 4,97 | 0,966 | 0,304 | 3,531 | 975 | 10,496 | 8,74 / 3,39 | 12,13 | 39,95 | 0,007 | 0 | 0 |
| 3,5 | 3,0 | 2,781 | 5,13 | 0,995 | 0,314 | 4,013 | 960 | 10,565 | 8,76 / 3,15 | 11,91 | 38,18 | 0,004 | 0 | 0 |
| 3,5 | 3,5 | 3,055 | 5,32 | 0,932 | 0,320 | 4,468 | 960 | 10,611 | 8,79 / 2,88 | 11,67 | 36,78 | 0,010 | 0 | 0 |
| **3,5** | **4,0** | **3,393** | **5,60** | **0,891** | **0,326** | **4,793** | **945** | **10,660** | **8,86 / 2,61** | **11,47** | **35,58** | **0,006** | **0** | **0** |
| 4 | 2,5 | 2,589 | 4,98 | 0,961 | 0,304 | 3,531 | 975 | 10,496 | 8,74 / 3,38 | 12,12 | 39,98 | 0,010 | 0 | 0 |
| 4 | 3,0 | 2,817 | 5,23 | 0,954 | 0,313 | 4,022 | 960 | 10,565 | 8,79 / 3,12 | 11,90 | 38,20 | 0,007 | 0 | 0 |
| 4 | 3,5 | 3,077 | 5,45 | 0,959 | 0,322 | 4,487 | 960 | 10,611 | 8,80 / 2,86 | 11,66 | 36,54 | 0,009 | 0 | 0 |
| 4 | 4,0 | 3,310 | 5,70 | 0,899 | 0,328 | 4,808 | 945 | 10,660 | 8,86 / 2,68 | 11,54 | 35,60 | 0,006 | 0 | 0 |

Ponto extra da tabela, medido no teste de sanidade e mantido aqui porque e o que mede o risco do criterio 1: **expoente 3 com teto 100** (folgado) da razao 3,850 no equilibrado, 6,28 no gap leve, **26,18 no gap 30**, torres aos 20:00 6,619 (**fora** do teto de 5,000), torres totais 11,17, duracao 32,48 min e **zero violacoes de torre antes de 7:00 nos seis tiers**.

Bandas de aceite, para leitura da tabela: razao de torres [2,500; 4,500] alvo 3,350; torres/min [0,300; 0,450] alvo 0,370; torres aos 20:00 [2,500; 5,000] alvo 3,720; mediana da primeira torre [780; 1140] s alvo 970; placas [5,000; 12,000] alvo 8,200.

### As tres leituras que a grade entrega

**Primeira, e ela desarma o maior risco declarado da fase: o teto NAO e o que protege o assert de 7:00.** As violacoes sao **zero nos seis tiers em todos os doze pontos**, e tambem com teto 100, onde o tier de gap 30 chega a 26,18 de razao de torres. O mecanismo estava previsto na secao 2 deste documento e agora esta medido: o termo e funcao de **torres ja derrubadas**, e aos 6:30 nenhuma caiu, entao a guarda de paridade o deixa exatamente em 1 e ele **nao pressiona aquele assert de forma nenhuma**. A folga de 26 por cento de magnitude que a base 27 comprou nao precisou ser gasta. A previsao de que ela poderia nao ser necessaria estava escrita naquela secao, junto da decisao de nao apostar em nenhum dos dois cenarios.

**O que o teto de fato protege e a banda de torres aos 20:00.** Com teto folgado ela vai a 6,619 contra o teto de 5,000 da banda. O teto e obrigatorio, mas pelo motivo que a medicao mostra e nao pelo que a pesquisa previa.

**Segunda, o teto domina e o expoente e quase inerte dentro desta regiao.** Fixado o teto, mover o expoente de 3 para 4 muda a razao em no maximo **0,13** (2,765 a 2,817 no teto 3,0; 3,182 a 3,393 no teto 4,0). Fixado o expoente, mover o teto de 2,5 para 4,0 muda a razao entre **0,71 e 0,82**. O acoplamento entre os dois e real e continua justificando a excecao (foi ele que produziu o 22,67 da pesquisa), mas neste ponto de operacao, com a base do gate ja reduzida, **quem escolhe o ponto e o teto**. Ter varrido os dois juntos e o que permitiu descobrir isso: um sweep de uma dimensao teria atribuido ao expoente um efeito que e do teto.

**Terceira, e ela vale para a Fase 26: a razao de abates caiu abaixo de 1.** Ela vinha de 1,233 e mede entre 0,889 e 0,995 em todos os doze pontos, ou seja **o perdedor passa a somar mais abates que o vencedor**. O assert de ordenacao inter-camada (razao de torres MAIOR que razao de abates) passa com folga enorme, 3,393 contra 0,891, mas parte dessa folga vem do denominador caindo e nao so do numerador subindo, e isso precisa ficar escrito para nao ser lido como vitoria dupla. A banda da razao de abates e [1,800; 2,600] e e da **Fase 26**: ela ja estava vermelha em 1,233 e ficou mais vermelha. O mecanismo plausivel e que a partida agora se decide por estrutura e termina mais cedo, e o lado que esta atras continua acumulando abates de defesa enquanto o vencedor gasta o tempo derrubando estrutura. **Nada de combate foi tocado neste plano.** Fica registrado como leitura para quem pegar a Fase 26.

### O ponto escolhido: expoente 3,5 e teto 4,0

Criterio 1 nao separa nenhum ponto: os doze medem zero nas tres regras duras nos seis tiers. Criterio 2 elimina **um** ponto, o de expoente 3 com teto 2,5, que fica em 2,474, a 0,026 abaixo do piso. Criterio 3 nao elimina nenhum: as quatro bandas de ritmo ficam dentro em todos os doze pontos.

Sobram onze pontos empatados, e o criterio 4 tem duas preferencias que aqui **apontam para lados opostos**: a razao mais proxima de 3,350 esta no teto 4,0, e a preferencia por menor teto esta no 2,5. O desempate foi feito assim, e a razao e medida:

- a preferencia por **menor teto** vem acompanhada da propria justificativa no plano: "porque teto menor e menos exposicao nos tiers de gap", ou seja o risco de o termo compor com a diferenca de roster e reintroduzir a violacao de 7:00. Esse risco **nao se materializa em ponto nenhum da grade**, nem com teto 100. Com a justificativa vazia por medicao, a preferencia perde o que a sustentava;
- sobra a **proximidade da referencia de 3,350**, e o ponto de expoente 3,5 e teto 4,0 e o mais proximo dos doze: **3,393**, diferenca de **0,043**. Entre os tres pontos de teto 4,0, o expoente 3,5 ganha do 4 (3,310) e do 3 (3,182) por esse mesmo criterio.

**Escolhido: expoente 3,5 e teto 4,0.** Razao de torres **3,393**, dentro de [2,500; 4,500] e a 0,043 do alvo.

**O custo, declarado com numero e nao escondido:**

- **torres aos 20:00 fica em 4,793** contra o teto de 5,000 da banda, ou seja 0,207 de folga, com o alvo em 3,720. Ela continua dentro, e a folga e menor que a dos pontos de teto 3,0 (4,013, folga de 0,987). Nenhuma alavanca aditiva sobra nesta fase (o plano 25-07 regenera golden e o 25-08 fecha), entao a folga nao precisa cobrir nada mais desta fase, mas ela e o custo do ponto e fica registrada;
- **a fracao de partidas terminando no teto de 60 minutos fica em 0,006** contra a banda [0; 0,005], ou seja 5 partidas em 800. Ela vinha de **0,046** (37 partidas) antes do termo, ou seja melhorou por um fator de sete, e nesse patamar a diferenca entre 0,004 e 0,010 na tabela e ruido de contagem (3 a 8 partidas em 800). Ela nao foi usada para escolher o ponto, por isso.

**Os pontos alternativos estao medidos e a troca esta explicita**, para que a decisao do checkpoint humano seja de uma constante e nao de uma nova rodada de sweep: o teto 3,5 com expoente 3,5 da razao 3,055 com torres aos 20:00 em 4,468 (folga 0,532), e o teto 3,0 com expoente 3,5 da razao 2,781 com torres aos 20:00 em 4,013 (folga 0,987) e a menor fracao no teto de 60 min de toda a grade (0,004).

### A leitura honesta sobre o tier de gap leve, que e uma decisao de banda a tomar

A pesquisa recomendou medir tambem o **GAP-LEVE** (80 contra 70) porque ele e um proxy melhor de "dois times pro ligeiramente diferentes" que o espelho perfeito, e a referencia de 3,350 vem de pro play, onde os times sao proximos mas **nao identicos**. A coluna esta na tabela, e ela diz uma coisa que o tier equilibrado nao diz: **em todos os doze pontos a razao no gap leve fica entre 4,95 e 5,70, acima do teto de 4,500 da banda.** Ela vinha de 1,68 antes do termo.

Isso **nao reprova nenhum ponto**, porque a banda e definida e avaliada no tier equilibrado, e o gate de ritmo nao a avalia no gap leve. Mas e a informacao que a pesquisa pediu para trazer a mesa, e ela e do desenvolvedor: se o gap leve for aceito como o proxy pro, a leitura vira "o termo esta forte demais para um gap de 10 pontos de roster", e o ponto se moveria para o teto 2,5 (gap leve 4,95, o menor da grade), que e onde o tier equilibrado fica em 2,474 e **perde** o piso da propria banda. Ou seja: **nao existe ponto na grade em que as duas leituras fiquem dentro ao mesmo tempo**, e escolher qual das duas manda e decisao de banda, nao de constante. Este documento registra o par e nao torce nenhum dos dois.

### Efeitos colaterais medidos, e o item diferido que o termo fechou

**D-25-03 esta FECHADO por este plano, sem que nada tenha sido afrouxado.** O assert duro `criterio 3: total de torres plausivel -- media por partida deve ser <= 14` de `calibrate-structures` media 15,14 e reprovava, e a secao 2 provou que **nenhuma das duas alavancas daquele plano o alcancava** (o menor valor com o 7:00 zerado e as quatro bandas dentro era 14,82). O termo de vantagem o resolve: no ponto escolhido as torres totais medem **11,47** no gate de ritmo e **11,39** no harness estrutural, e `npm run calibrate:structures` volta a **sair 0**.

A mecanica e a que o proprio assert apontava e a duracao e o numero que fecha a conta: `torres totais = torres/min x duracao`. A duracao media do tier equilibrado cai de **47,72 para 35,58 min** (menos 25,4 por cento) enquanto torres/min **sobe** de 0,321 para 0,326. O termo nao produz menos torre por minuto, ele faz a partida **terminar**, porque dar vantagem estrutural a quem esta na frente e o que permite alguem ganhar a corrida.

E essa e a leitura de fundo do plano: **razao de torres baixa e total de torres alto eram o mesmo problema com dois nomes.** Um canal simetrico faz os dois lados perderem torre no mesmo ritmo, ninguem abre a vantagem necessaria para fechar o jogo, a partida se arrasta e acumula torre. O termo de vantagem conserta os dois pelo mesmo mecanismo, e os tres numeros se movem juntos: razao de 1,202 para 3,393, duracao de 47,72 para 35,58 min, torres totais de 15,33 para 11,47.

---

## Secao 5: a medicao condicional do Baron no spawn (plano 25-06, decisao do checkpoint)

**Por que esta secao existe.** O plano 25-06 re-ancorou o assert de Baron no spawn de fracao dos Barons para taxa por partida (secao propria em `scripts/calibrate-objectives.ts`), e a taxa medida (0,198 por partida) estourou por 6,7 por cento o teto derivado por equivalencia (0,1855). O teto **nao** foi alargado. O desenvolvedor decidiu **medir o condicional antes de mexer em qualquer constante**, que e exatamente a medicao que o comentario do proprio arquivo sugeria: a taxa condicionada ao estado no instante do spawn.

**Nada foi alterado para medir.** A sonda (`tmp/baron-spawn-25-06.test.ts` e as duas continuacoes, nao versionadas) le o estado do **snapshot que a propria engine ja carrega em cada evento** (`SimEvent.score` e `SimEvent.winProbUserAfter`, escritos em `baseEvent`), usando o **ultimo evento com tempo menor ou igual a 1200 s**. Esse snapshot e anterior a tomada do Baron, entao nao contem o efeito dela. Fixture e N identicos ao harness de objetivos: EQUILIBRADO 70 contra 70, N=500, semente igual ao indice.

**Populacao:** 1039 Barons em 500 partidas (2,078 por partida), dos quais **99 na janela de spawn** (1200 a 1259 s), ou 0,198 por partida.

### Distribuicao no instante do spawn, do lado que pegou menos o outro lado

| grandeza | media | mediana | min | p25 | p75 | max |
| --- | --- | --- | --- | --- | --- | --- |
| diferenca de torres | 0,58 | 1,00 | -9,00 | -4,00 | 5,00 | 8,00 |
| diferenca de ouro | 162 | 200 | -4458 | -1309 | 1354 | 5329 |
| diferenca de abates | 0,54 | 0,00 | -14,00 | -4,00 | 4,00 | 16,00 |
| win prob do lado que pegou | 0,562 | 0,588 | 0,196 | 0,367 | 0,722 | 0,942 |

### Histograma da diferenca de torres, e ele e o achado da secao

| dif de torres | -9 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ocorrencias | 1 | 7 | 9 | 17 | 5 | 2 | 3 | 4 | 4 | 2 | 2 | 15 | 13 | 5 | 6 | 4 |

**A distribuicao e BIMODAL e nao centrada.** Sao 44 ocorrencias claramente atras (de -3 a -9), 51 claramente a frente (de +4 a +8) e apenas **12 das 99 perto da paridade** (de -2 a +3). Ou seja: quase nao existe a populacao "vantagem marginal" que o corte de "vantagem clara" existiria para separar. O que existe sao duas populacoes distintas e de tamanho parecido.

### A classificacao pedida, com o corte variado

| corte de "vantagem estrutural clara" | SNOWBALL | PARELHA ou atras | fracao SNOWBALL |
| --- | --- | --- | --- |
| dif de torres >= 1 | 51 | 48 | **51,5%** |
| dif de torres >= 2 | 47 | 52 | **47,5%** |
| dif de torres >= 3 | 45 | 54 | **45,5%** |

**O corte muda o veredito de maioria.** Com corte 1 a maioria e SNOWBALL, com corte 2 a maioria e PARELHA. Desagregado: **atras em torres 44 (44,4%), empatado 4 (4,0%), a frente 51 (51,5%)**.

Pelo eixo pedido (vantagem **estrutural**), a leitura e ambigua por construcao, e por isso **a decisao nao foi tomada por conta propria**: a instrucao era parar e reportar se o corte mudasse o veredito, e ele muda.

### Tres leituras que o eixo estrutural sozinho esconde

**Primeira: "atras em torres" nao e "atras".** Cruzando os grupos de diferenca de torres com as outras grandezas:

| grupo | n | ouro mediano | abates mediano | win prob mediana |
| --- | --- | --- | --- | --- |
| torres >= 2 | 47 | 572 | 1,0 | 0,722 |
| torres == 1 | 4 | 1803 | 4,5 | 0,542 |
| torres == 0 | 4 | -613 | -2,0 | 0,479 |
| torres < 0 | 44 | -817 | -1,5 | 0,346 |

E **35 das 44 ocorrencias atras em torres tem o tomador com ZERO torres derrubadas**. Ou seja o grupo "atras" e majoritariamente "ainda nao derrubou torre nenhuma aos 20:00", que num tier espelhado 70 contra 70 e situacao comum e nao anomalia.

**Segunda: a maioria das tomadas atras foi CONTESTADA ou ROUBADA, e as duas coisas sao comportamento legitimo.**

| grupo | n | roubado | contestado | sem roubo e sem contestacao |
| --- | --- | --- | --- | --- |
| atras em torres | 44 | 6 (13,6%) | 35 (79,5%) | **9 (20,5%)** |
| empatado em torres | 4 | 1 | 3 | 1 |
| a frente em torres | 51 | 4 (7,8%) | 21 (41,2%) | 30 (58,8%) |
| todas | 99 | 11 (11,1%) | 59 (59,6%) | 40 (40,4%) |

Um Baron roubado ou tomado numa luta contestada pelo lado que esta atras e exatamente o jogo funcionando, nao defeito de setup.

**Terceira: a tabela dos tres eixos, e ela e a que fecha o tamanho do problema.**

| quem pegou estava a frente por | ocorrencias | fracao | dessas, sem roubo e sem contestacao |
| --- | --- | --- | --- |
| estrutura (dif de torres >= 1) | 51 | 51,5% | 30 |
| estrutura (dif de torres >= 2) | 47 | 47,5% | 27 |
| ouro (dif > 0) | 51 | 51,5% | 28 |
| ouro (dif >= 1000) | 34 | 34,3% | 20 |
| abates (dif > 0) | 46 | 46,5% | 26 |
| **win prob (> 0,5)** | **62** | **62,6%** | 36 |
| a frente nos TRES eixos | 33 | 33,3% | 22 |
| a frente em ALGUM eixo | 73 | **73,7%** | 37 |
| atras nos TRES eixos | 25 | 25,3% | 3 |
| atras em torres mas a frente em ouro ou win prob | 19 | 19,2% | 6 |

**O candidato mais estreito a defeito**, ou seja tomada limpa (sem roubo e sem contestacao) por um lado que estava atras nos **tres** eixos ao mesmo tempo: **3 ocorrencias de 99 (3,0 por cento), taxa de 0,006 por partida.**

### As 9 tomadas limpas por um lado atras em torres, uma por linha

| semente | tempo | torres do tomador / do outro | dif de ouro | win prob do tomador | ator |
| --- | --- | --- | --- | --- | --- |
| 54 | 1200 | 0 / 4 | 4371 | 0,670 | u-jungle |
| 77 | 1230 | 0 / 4 | 1000 | 0,608 | r-jungle |
| 82 | 1245 | 0 / 5 | -2392 | 0,324 | r-jungle |
| 96 | 1215 | 0 / 4 | 1084 | 0,503 | r-jungle |
| 344 | 1245 | 0 / 6 | -2023 | 0,292 | r-top |
| 395 | 1230 | 0 / 4 | 223 | 0,363 | u-jungle |
| 402 | 1245 | 0 / 4 | -418 | 0,421 | u-jungle |
| 415 | 1215 | 0 / 4 | 1086 | 0,570 | r-jungle |
| 454 | 1230 | 0 / 4 | 2490 | 0,510 | r-jungle |

Seis das nove tem o tomador **a frente em ouro**, e cinco tem win prob acima de 0,5. O ator e o jungler em oito das nove, o que e o esperado.

### Estado da decisao: PARADA, com os numeros na mesa

A instrucao do desenvolvedor foi explicita: **nao adivinhar a classificacao** e parar se a medicao ficasse ambigua ou se o corte mudasse o veredito. As duas condicoes aconteceram no eixo pedido (51,5 por cento contra 47,5 por cento conforme o corte). Portanto, e ate a decisao voltar:

- a banda `BARON_AT_SPAWN_PER_GAME` **nao foi re-derivada**: segue com teto 0,1855 e o gate segue vermelho por 6,7 por cento;
- **`baronSetupSufficient` nao foi tocado**, nem em valor nem em forma;
- nenhuma outra constante do motor foi tocada.

O que a medicao entrega para a decisao, sem escolher por ela: pelo eixo **estrutural** puro a populacao e meio a meio; pelo eixo de **win prob** a maioria dos tomadores era favorita (62,6 por cento); e o recorte que isola comportamento sem explicacao legitima (atras nos tres eixos, sem roubo e sem contestacao) tem **3 ocorrencias em 500 partidas**.

**Efeito colateral a considerar caso a saida seja apertar o setup**, e ele foi pedido junto: `baroes por partida` mede hoje **2,159** contra a banda [0,9; 1,8] (vinha de 3,780 antes do termo de vantagem). Apertar `baronSetupSufficient` empurra essa metrica **na direcao certa** ao mesmo tempo que reduz a taxa no spawn, entao as duas exigencias andariam juntas em vez de opostas, o que e informacao util para a fase dona daquela banda. Isso e predicao aritmetica, **nao foi medido**: nenhum ponto de sweep de setup foi rodado.

---

## Secao 6: a FORMA da razao de torres, e nao o nivel (plano 25-07, pedido no checkpoint)

**Por que esta secao existe.** A banda da Fase 25 avalia `mean(towersWinner) / mean(towersLoser)`, ou seja uma **razao de MEDIAS**, e ela esta dentro em 3,393 contra a banda [2,500; 4,500] e o alvo 3,350. Razao de medias **nao diz nada sobre a forma** da distribuicao por partida. A pergunta levantada no checkpoint do plano 25-07 foi: se a forma for **bimodal** (ou 9 a 0, ou 0 a 9) em vez de concentrada perto de 3,35, a banda fica verde com o comportamento errado, porque significaria partida parelha decidida por snowball desgovernado em vez de disputada.

**O gatilho da pergunta.** No diff de golden do plano 25-07, em **13 dos 15 blocos** o vencedor termina com exatamente 9 torres e o perdedor com 0 ou 1, e um dos casos e `balanced (70 vs 68)`, dois pontos de diferenca de rating, terminando **9 a 0**.

**Metodo.** Sonda transitoria sob vitest, fixture copiada verbatim de `scripts/calibrate-pace.ts` (`makePlayer`, `roster`, N=800, semente igual ao indice), tiers EQUILIBRADO 75 contra 75 e GAP-LEVE 80 contra 70. Percentis, desvio e coeficiente de bimodalidade vindos de `summarize` e `bimodalityCoefficient` de `scripts/stats.ts`, com o limiar unimodal **0,5556** (5/9, Kang 2019) que os outros harnesses ja usam. **Nada de motor foi tocado e nenhuma constante foi movida para medir.** Arquivo de sonda descartado na mesma sessao.

### O resultado, e ele confirma a suspeita

| leitura, tier EQUILIBRADO (75 contra 75), N=800 | valor |
| --- | --- |
| razao de MEDIAS, o que a banda avalia | **3,393 DENTRO** de [2,500; 4,500] |
| media das torres do vencedor | 8,860 |
| media das torres do perdedor | 2,611 |
| **razao POR PARTIDA, coeficiente de bimodalidade** | **0,7528, BIMODAL** (limiar 0,5556) |
| razao por partida: p5 / p25 / p50 / p75 / p95 | 1,000 / 1,800 / **3,000** / **9,000** / **9,000** |
| partidas com o perdedor em ZERO torres (razao indefinida) | **183 de 800, 22,9 por cento** |
| partidas com o perdedor em 0 ou 1 torre (SHUTOUT) | **359 de 800, 44,9 por cento** |
| partidas exatamente 9 a 0 | **167 de 800, 20,9 por cento** |
| partidas 9 a 0 ou 9 a 1 | **324 de 800, 40,5 por cento** |
| torres do perdedor, coeficiente de bimodalidade | **0,6493, BIMODAL** |
| torres do vencedor, coeficiente de bimodalidade | 0,7853, e o motivo esta abaixo |
| fracao de partidas com o vencedor em exatamente 9 torres | **90,8 por cento** |

**A leitura mais dura, e ela nao depende de nenhuma referencia externa: o numerador virou constante.** As torres do vencedor tem desvio de **0,503** e p25 = p50 = p75 = p95 = **9**, que e o maximo estrutural que `towersDestroyed` pode assumir (tres rotas vezes tres torres; as duas torres do Nexus nao entram no contador, item diferido D-25-04). Em 90,8 por cento das partidas o vencedor limpa **as tres rotas por inteiro**. Consequencia direta: a razao por partida deixou de ser uma razao entre duas grandezas que variam e passou a ser **9 dividido pela contagem do perdedor**, ou seja a distribuicao da razao e apenas o reciproco da distribuicao do perdedor. O numerador nao carrega informacao nenhuma.

**Isso contradiz um invariante declarado do proprio projeto**, escrito no cabecalho de `src/sim/structures.test.ts:4-9`: para vencer e preciso limpar por inteiro ao menos UMA rota do perdedor, e **nao** e preciso destruir todas as torres do mapa. Hoje o vencedor destroi praticamente todas.

**A media esconde a forma exatamente como se temia.** A mediana da razao e 3,000, perto do alvo 3,350, mas p75 e p95 estao os dois no teto 9,000: a distribuicao tem **duas pilhas** e a media de 3,393 cai no vale entre elas. Histograma das torres do perdedor, que e onde a bimodalidade se ve a olho:

| torres do perdedor | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| partidas | **183** | **176** | 122 | 80 | 63 | 48 | 41 | 36 | 20 | **31** |
| por cento | 22,9 | 22,0 | 15,3 | 10,0 | 7,9 | 6,0 | 5,1 | 4,5 | 2,5 | 3,9 |

### A comparacao de FORMA entre os dois tiers: a forma e a mesma, o gap so a desloca

| leitura | EQUILIBRADO (75 x 75) | GAP-LEVE (80 x 70) |
| --- | --- | --- |
| razao de medias | 3,393 | 5,603 |
| media vencedor / perdedor | 8,860 / 2,611 | 8,938 / 1,595 |
| razao por partida, BC | **0,7528 BIMODAL** | **0,7714 BIMODAL** |
| razao por partida, p50 / p75 / p95 | 3,000 / 9,000 / 9,000 | 4,500 / 9,000 / 9,000 |
| perdedor em ZERO torres | **22,9 por cento** | **41,9 por cento** |
| perdedor em 0 ou 1 (shutout) | **44,9 por cento** | **70,3 por cento** |
| exatamente 9 a 0 | 20,9 por cento | **41,6 por cento** |
| vencedor em exatamente 9 torres | 90,8 por cento | **96,3 por cento** |
| torres do perdedor, BC | 0,6493 BIMODAL | 0,7988 BIMODAL |
| participacao do vencedor, BC | 0,5339 unimodal, a 4 por cento do limiar | **0,6980 BIMODAL** |
| duracao media | 35,58 min | 30,81 min |

**A forma nao e efeito do gap:** ela ja esta bimodal no tier ESPELHADO, com gap ZERO. O gap de 10 pontos apenas empurra a mesma forma para o extremo, dobrando a fracao de shutout de 44,9 para 70,3 por cento.

### A variavel limitada, reportada porque e o unico numero que nao acusa

Para separar forma de cauda foi medida tambem a **participacao do vencedor**, `vencedor / (vencedor + perdedor)`, que e sempre definida em [0, 1] e nao tem cauda infinita. No EQUILIBRADO ela da **BC = 0,5339, tecnicamente unimodal**, e este numero esta escrito aqui de proposito para nao parecer omitido. **Ele nao absolve nada, por tres razoes medidas:** esta a apenas 4 por cento abaixo do limiar de 0,5556; o maior balde do histograma e de longe o de 0,90 a 1,00, com **340 de 800 partidas**; e no GAP-LEVE a mesma variavel vira **0,6980, bimodal**. As duas variaveis que o checkpoint pediu explicitamente (a razao e as torres do perdedor) acusam bimodalidade nos dois tiers.

### O que a medicao NAO prova, escrito para nao virar conclusao emprestada

**O nivel das duas medias esta perto da referencia, e isso e verdade e precisa estar dito.** `STACK.md` secao 3 linha 10 (OE 2023-2025, N=5.958) da vencedor **9,15** e perdedor **2,75**, e a linha 9 da total **11,9**. Medido: 8,860 e 2,611, total 11,47. **A referencia da a media, e nao a distribuicao**, entao a fracao de 22,9 por cento de perdedores em zero torre **nao pode ser declarada implausivel a partir de `STACK.md`**: nao existe ali a distribuicao de pro play para comparar. O que esta provado e a forma **interna** ser bimodal pelo criterio do proprio projeto, e o numerador ter colapsado num ponto.

**E ha uma ressalva que corta na direcao contraria ao conforto do nivel:** os 9,15 da referencia sao sobre **11 torres** por lado (nove de rota mais duas do Nexus), enquanto `towersDestroyed` **exclui as duas do Nexus** (D-25-04, medido em 1,292 quedas por partida invisiveis ao contador). Corrigindo pela subcontagem, o vencedor destroi cerca de **10,15** e nao 8,86, contra a referencia de 9,15, e deixa de pe cerca de **0,14** torre de rota das 11 do adversario, quando a referencia deixa cerca de **1,85**. Ou seja o nivel do vencedor esta **acima** da referencia, nao dentro dela, e so parece dentro porque o contador subconta.

### Decisao: PARADA, sem conserto e sem tocar constante

Pelo criterio declarado no checkpoint, razao bimodal ou fracao de shutout alta significa **parar e reportar**, porque e decisao de escopo e nao ajuste de fim de fase. As duas condicoes ocorreram. **Nenhuma constante foi movida, nenhuma linha de motor foi tocada e nenhum limiar foi alterado neste plano.** Item diferido **D-25-06**.

**A resposta explicita a pergunta que originou a secao, com numero, para nao voltar:** o 9 a 0 dos blocos do golden **NAO e artefato de amostra de 15 sementes**. Ele e um desfecho de peso real: **20,9 por cento** das partidas do tier espelhado terminam exatamente 9 a 0 e **40,5 por cento** terminam 9 a 0 ou 9 a 1.

**A medicao seguinte que a decisao vai querer, e que este plano deliberadamente NAO fez** porque exigiria mover constante: o contrafactual de forma antes da fase, ou seja o mesmo par de tabelas com o termo de vantagem desligado e com a taxa do canal em zero, para separar quanto da bimodalidade e do canal absoluto, quanto e do termo de vantagem e quanto ja existia antes da Fase 25.

**Esse contrafactual foi autorizado e rodado em seguida, e esta na secao 7.**

---

## Secao 7: o contrafactual de forma em quatro estados, e a atribuicao causal (plano 25-07, autorizado no checkpoint)

**Metodo.** Constante movida **SO PARA MEDIR** e restaurada ao fim, precedente da secao 1 do 25-05 e da secao 4 do 25-06. Quatro estados, mesma fixture nos quatro (tier EQUILIBRADO 75 contra 75, N=800, semente igual ao indice, copiada verbatim de `scripts/calibrate-pace.ts`) para o delta ser atribuivel. Estatistica de `scripts/stats.ts`, limiar unimodal 0,5556.

| estado | canal absoluto | termo de vantagem | base do caminho do gate |
| --- | --- | --- | --- |
| **A** hoje | ligado, taxa 2,2 | ligado, exp 3,5 teto 4,0 | 27 |
| **B** termo desligado | ligado, taxa 2,2 | **neutro, vale 1 sempre** | 27 |
| **C** canal desligado | **desligado** | desligado | 27 |
| **D** pre-Fase-25 | **desligado** | desligado | **45** |

**Como o canal foi desligado, e por que NAO foi pela taxa.** Zerar `SIEGE_ACCRUAL_BASE` **nao** desliga o canal: a linha `pool.lastStructureDamageAtSec = state.gameTimeSec` roda em todo tick antes de qualquer teste de dano, entao com taxa zero o canal continuaria escrevendo estado a cada tick e o contrafactual mediria outra coisa. O desligamento correto e um retorno antecipado em `accrueSiegePressure`, que reproduz o estado anterior ao wiring do plano 25-04.

> **CORRECAO DE MECANISMO (2026-07-30, levantada no planejamento da Fase 25B e verificada).** A versao original deste paragrafo dizia que `pool.lastStructureDamageAtSec` "alimenta `cascadeDamageMultiplier`, o freio de cascata". **Isso esta errado.** O campo e escrito em dois lugares de producao (`structures.ts:987` e `:1567`) e **nao tem nenhum leitor em producao**: o unico leitor no repositorio e `structures.test.ts:201`, que so verifica que ele comeca nulo. Quem alimenta o freio de cascata e `lastStructureDestroyedAtSec`, que e outro campo.
>
> **A conclusao operacional nao muda e o contrafactual continua valido:** o retorno antecipado era o desligamento correto de qualquer forma, e por uma razao mais forte que a alegada (ele nao deixa nenhuma escrita de estado acontecer, em vez de depender de saber quais escritas importam). O que estava errado era a justificativa, nao a decisao.
>
> **Achado colateral, sem dono declarado:** `lastStructureDamageAtSec` e **campo morto**. Duas escritas em producao, zero leituras. Candidato a remocao na revisao em bloco da Fase 30, junto com o destino de `_strength` em `damageStructure`, que esta na mesma categoria.

**Ressalva de fidelidade do estado D, declarada:** D e **pre-Fase-25 aproximado**. Os quatro guardas de freio cross-lane que o plano 25-04 acrescentou aos outros caminhos de queda continuam presentes, porque remove-los seria desfazer o plano e nao desligar uma alavanca. O 25-04 mediu o custo deles em cerca de 1,6 por cento de duracao.

### As quatro ancoras que validam o contrafactual

Antes de qualquer leitura, os quatro estados foram conferidos contra medicoes independentes ja registradas. **Os quatro batem:**

| estado | grandeza | medido aqui | registro independente |
| --- | --- | --- | --- |
| D | razao de torres | **1,485** | 1,487 no retrato PRE do plano 25-04 |
| D | duracao media | **51,65 min** | 51,571 min no PRE do 25-04, e 51:24 no baseline v2.2 congelado |
| D | torres vencedor / perdedor | **5,755 / 3,875** | **5,71 / 3,88** no baseline oficial da v2.2 (Cenario A, N=1500) |
| B | razao e duracao | **1,202** e **47,72 min** | 1,202 e 47,719 min no plano 25-05 |
| A | razao e duracao | **3,393** e **35,58 min** | 3,393 e 35,581 min no plano 25-06 |

A coincidencia de D com o **baseline congelado na Fase 24**, em duas grandezas e com harness e N diferentes, e a validacao mais forte: o contrafactual reconstroi o estado pre-fase de verdade.

### A tabela dos quatro estados

| grandeza | **D** pre-fase | **C** canal off | **B** termo off | **A** hoje |
| --- | --- | --- | --- | --- |
| duracao media (min) | 51,65 | 57,62 | 47,72 | **35,58** |
| razao de MEDIAS (o que a banda ve) | 1,485 | 1,487 | 1,202 | **3,393** |
| razao por partida, media | 1,921 | 1,867 | 1,338 | 4,422 |
| razao por partida, desvio | 1,540 | 1,415 | 0,657 | 3,023 |
| razao por partida p50 / p75 / p95 | 1,400 / 2,000 / 6,000 | 1,500 / 2,000 / 5,000 | 1,125 / 1,400 / 2,250 | **3,000 / 9,000 / 9,000** |
| razao por partida, BC | 0,7359 BIMODAL | 0,6986 BIMODAL | 0,6451 BIMODAL | 0,7528 BIMODAL |
| torres do VENCEDOR, media | 5,755 | 5,189 | 8,367 | 8,860 |
| torres do VENCEDOR, desvio | 1,598 | 1,364 | 0,811 | **0,503** |
| **torres do VENCEDOR, coef. de variacao** | **0,2777** | **0,2629** | **0,0969** | **0,0568** |
| torres do VENCEDOR, BC | **0,4542 unimodal** | **0,3849 unimodal** | 0,5570 BIMODAL | 0,7853 BIMODAL |
| torres do PERDEDOR, media | 3,875 | 3,489 | 6,961 | 2,611 |
| torres do PERDEDOR, coef. de variacao | 0,5612 | 0,4826 | 0,2837 | 0,9734 |
| torres do PERDEDOR, BC | **0,4406 unimodal** | **0,3777 unimodal** | 0,5851 BIMODAL | 0,6493 BIMODAL |
| **fracao SHUTOUT (perdedor 0 ou 1)** | 17,9 | 13,9 | **1,4** | **44,9** |
| fracao perdedor em ZERO | 7,8 | 5,0 | 0,8 | **22,9** |
| fracao exatamente 9 a 0 | 0,1 | 0,0 | 0,1 | **20,9** |
| **fracao do vencedor no maximo do contador (9)** | 3,9 | **0,4** | **52,9** | **90,8** |
| rotas do perdedor limpas: exatamente **1** | 58,0 | **72,1** | 10,6 | **2,6** |
| rotas do perdedor limpas: exatamente 2 | 37,0 | 20,4 | 36,5 | 6,6 |
| rotas do perdedor limpas: exatamente **3** | 3,9 | **0,4** | **52,9** | **90,8** |
| rotas limpas, media | 1,436 | 1,140 | 2,422 | 2,881 |

### O VEREDITO, e ele e o quarto ramo do criterio: a deformacao cresce em VARIOS passos

**A bimodalidade cresce em mais de um passo, e cada passo tem autor diferente, entao a contribuicao de cada um esta reportada abaixo em vez de eleger um culpado.** E mais: **nao ha um defeito, ha DOIS**, com autores distintos.

**Antes de atribuir, um alerta sobre o instrumento, porque ele muda a leitura do criterio.** O coeficiente de bimodalidade **da razao** esta acima do limiar nos **quatro** estados, incluindo o pre-fase D (0,7359). Pela letra do primeiro ramo do criterio isso significaria "o defeito precede a Fase 25". **Essa leitura seria errada, e a razao e medida:** a razao e um quociente de inteiros pequenos com massa pontual em 1,000 exato (p25 = 1,000 em B, C e D) e cauda longa a direita, e o BC e inflado por discretizacao e por cauda, nao por duas pilhas separadas. Em D a razao esta concentrada em 1,4 com p95 em 6; em A ela tem p50 3,0 e p75 = p95 = 9,0, que sao duas pilhas de verdade. **O BC da razao esta saturado em todo estado e portanto nao carrega sinal sobre o que a fase mudou.** As variaveis que discriminam sao as distribuicoes de torres e a contagem de rotas limpas, e essas sao **unimodais em C e D** e viram bimodais em B e A.

**Passo D para C (base 45 para 27, plano 25-05): a base esta ABSOLVIDA.** Tudo segue unimodal, o vencedor segue longe do teto (3,9 para 0,4 por cento) e a fracao de vitoria por **uma** rota **melhora**, de 58,0 para 72,1 por cento. A base nao e autora de nada aqui.

**Passo C para B (ligar o canal absoluto, plano 25-04): AUTOR DO COLAPSO DO NUMERADOR E DA VIOLACAO DO INVARIANTE.**

| efeito | C | B |
| --- | --- | --- |
| coef. de variacao das torres do vencedor | 0,2629 | **0,0969** |
| BC das torres do vencedor | 0,3849 unimodal | **0,5570 BIMODAL** |
| vencedor no maximo do contador | 0,4 por cento | **52,9 por cento** |
| vitoria limpando **tres** rotas | 0,4 por cento | **52,9 por cento** |
| vitoria limpando **uma** rota | 72,1 por cento | **10,6 por cento** |

O canal absoluto e o que tira o vencedor da distribuicao com forma e o encosta no teto estrutural. **E ele o autor da contradicao com o invariante de `src/sim/structures.test.ts:4-9`**, que declara que para vencer basta limpar por inteiro **uma** rota: o caminho tipico de vitoria deixa de ser uma rota e passa a ser tres.

**Passo B para A (ligar o termo de vantagem, plano 25-06): AUTOR DO SHUTOUT.**

| efeito | B | A |
| --- | --- | --- |
| fracao SHUTOUT | **1,4 por cento** | **44,9 por cento** |
| perdedor em ZERO torres | 0,8 por cento | **22,9 por cento** |
| exatamente 9 a 0 | 0,1 por cento | **20,9 por cento** |
| vencedor no maximo do contador | 52,9 por cento | **90,8 por cento** |
| vitoria limpando tres rotas | 52,9 por cento | **90,8 por cento** |
| torres do perdedor, media | 6,961 | 2,611 |

O termo de vantagem e o que **retira as torres do perdedor** e completa o encosto do vencedor no teto. Sozinho ele multiplica o shutout por **32 vezes**.

**Uma leitura que impede atribuir tudo a um passo so, e ela e contra-intuitiva:** o canal absoluto **sozinho REDUZ** o shutout, de 17,9 por cento no pre-fase para **1,4 por cento** em B, porque ele e simetrico e enche os dois lados de torre (o perdedor sobe de 3,875 para 6,961). O termo entao redistribui violentamente esse volume para o vencedor. **Nenhum dos dois isolado produz o estado A: um cria o teto, o outro cria a assimetria, e o desfecho de hoje exige os dois.**

### A consequencia que precisa estar escrita mesmo reabrindo decisao tomada

**O ponto de operacao do termo de vantagem que foi aprovado no checkpoint do plano 25-06 (expoente 3,5 e teto 4,0) precisa ser reaberto**, porque foi escolhido por sweep de doze pontos que avaliava **exclusivamente nivel de banda**, sem nenhuma coluna de forma. O sweep nao errou o que mediu: ele nunca mediu isto. A tabela de doze pontos daquela secao 4 pode ser relida com colunas de forma sem nova mudanca de motor, e provavelmente ha pontos com razao dentro da banda e shutout muito menor, dado que o teto e a dimensao dominante e o proprio 25-06 mediu que teto 3,0 e 3,5 trocam folga de razao por menos separacao.

**Isso reabre uma decisao que o usuario ja tomou, e esta escrito assim de proposito: e melhor reabrir com dado do que fechar sem.**

**A mesma reabertura vale para o canal absoluto**, e ela e mais estrutural: o colapso do numerador nao e um ponto de operacao mal escolhido, e a consequencia de um canal que roda em **todas as tres rotas dos dois lados em todo tick**. Reduzir a taxa nao conserta a forma, porque a forma vem da cobertura e nao da magnitude: com taxa menor o vencedor chega ao teto mais tarde, mas ainda chega. As duas coisas sao decisao de escopo.

### O que este contrafactual NAO fez

Nenhum ponto de operacao novo foi escolhido, nenhuma banda foi mexida, nenhum limiar foi tocado e **nenhuma constante ficou movida**. A restauracao esta provada por tres verificacoes: `git status` vazio, o hash do blob de `src/sim/structures.ts` de volta em `1bee99e49fa1fcc2774ec9fd2230b10aacba871c`, e o estado A **re-medido apos a restauracao reproduzindo byte a byte** o estado A medido antes do contrafactual. `rng(` em `src/sim/` segue em **72** e a linha do gate segue byte a byte intacta. A suite completa segue em **901 de 901** e `npx tsc --noEmit` limpo.

---

## Secao 8: a VARIANCIA sobreviveu? Comparacao de DISPERSAO contra o baseline congelado (plano 25-07)

**Por que esta secao existe.** O core value declarado em `.planning/PROJECT.md` linha 9 e "resultados criveis **com variacao**: um jogador com overall maior geralmente ganha, mas **nao sempre**; lanes apertadas **podem virar**". **Todas as bandas da v2.2 sao sobre NIVEL. Nao existe gate nenhum sobre VARIACAO.** Apertar media e colapsar distribuicao e o modo de falha classico, e ele passaria por sucesso.

**Metodo.** `npm run diagnose` rodado agora contra o **baseline oficial da v2.2** congelado na Fase 24 (`docs/baselines/24-baseline-v2.2.md`, coluna DEPOIS), Cenario A (sintetico equilibrado 75 contra 75, N=1500), mesmo harness e mesmo N nos dois lados. O harness ja imprime desvio, os cinco percentis e coeficiente de bimodalidade em toda metrica, porque a Fase 23 construiu `scripts/stats.ts` para isso. **Existia o antes e existia o instrumento; nunca tinham sido cruzados neste eixo.** `docs/diagnostics/engine-diagnose.txt` foi restaurado apos a leitura e **nao** entra em commit de valor novo.

**O corte declarado, e por que ele e sobre coeficiente de variacao e nao sobre desvio.** A duracao caiu 31 por cento entre os dois estados, entao desvio absoluto menor pode ser a **mesma** dispersao relativa. A classificacao usa a razao dos **coeficientes de variacao** (desvio sobre media):

- **COLAPSADA:** CV_depois / CV_antes menor ou igual a **0,75** (perda de 25 por cento ou mais de dispersao relativa);
- **AUMENTADA:** razao maior ou igual a **1,25**;
- **preservada:** entre os dois.

O corte de 25 por cento e valor de engenharia declarado, sem fonte externa, escolhido para ser folgado o suficiente para nao disparar por ruido de amostra em N=1500 e apertado o suficiente para pegar perda material.

### A tabela ANTES x DEPOIS de dispersao, Cenario A, N=1500

| metrica | media | desvio | **CV** | razao CV | amplitude p5 a p95 | BC | classificacao |
| --- | --- | --- | --- | --- | --- | --- | --- |
| duracao | 51:24 para 35:40 | 8:13 para 8:30 | 0,1599 para 0,2383 | **1,491** | 1440 s para 1650 s | 0,558 para 0,542 | **AUMENTADA** |
| eventos por jogo | 93,46 para 83,09 | 22,94 para 21,50 | 0,2455 para 0,2588 | 1,054 | 75 para 69 | 0,429 para 0,518 | preservada |
| abates totais por jogo | 88,16 para 51,06 | 24,08 para 22,03 | 0,2731 para 0,4315 | **1,580** | 79 para 74 | 0,405 para 0,508 | **AUMENTADA** |
| abates do vencedor | 48,87 para 24,35 | 14,78 para 11,99 | 0,3024 para 0,4924 | **1,628** | 49 para 36 | 0,371 para 0,506 | **AUMENTADA** |
| abates do perdedor | 39,29 para 26,71 | 15,35 para 15,36 | 0,3907 para 0,5751 | **1,472** | 49 para 50 | 0,390 para 0,499 | **AUMENTADA** |
| **torres do vencedor** | 5,71 para 8,83 | **1,60 para 0,56** | **0,2802 para 0,0634** | **0,226** | **5 para 1** | **0,457 para 0,789** | **COLAPSADA** |
| torres do perdedor | 3,88 para 2,65 | 2,16 para 2,58 | 0,5567 para 0,9736 | **1,749** | 7 para 8 | **0,448 para 0,648** | **AUMENTADA** |
| inibidores do vencedor | 2,43 para 2,11 | 1,24 para 1,00 | 0,5103 para 0,4739 | 0,929 | 4 para 3 | 0,435 para 0,467 | preservada |
| dragoes do vencedor | 3,37 para 2,79 | 1,09 para 1,22 | 0,3234 para 0,4373 | **1,352** | 3 para 4 | 0,813 para 0,611 | **AUMENTADA** |
| dragoes do perdedor | 2,32 para 2,49 | 1,38 para 1,28 | 0,5948 para 0,5141 | 0,864 | 4 para 4 | 0,592 para 0,559 | preservada |
| baroes por jogo | 4,28 para 2,19 | 1,13 para 1,13 | 0,2640 para 0,5160 | **1,954** | 4 para 3 | 0,422 para 0,541 | **AUMENTADA** |
| ouro final do vencedor | 36810 para 23294 | 7247 para 6476 | 0,1969 para 0,2780 | **1,412** | 23732 para 21030 | 0,391 para 0,549 | **AUMENTADA** |
| ouro final do perdedor | 34394 para 23691 | 8114 para 7430 | 0,2359 para 0,3136 | **1,329** | 26312 para 24124 | 0,393 para 0,495 | **AUMENTADA** |
| first blood | 2:37 para 2:37 | 2:16 para 2:16 | 0,8662 para 0,8662 | 1,000 | 375 s para 375 s | 0,522 para 0,522 | preservada |
| **primeira torre** | 22:20 para 15:24 | **5:41 para 2:06** | **0,2545 para 0,1364** | **0,536** | **1140 s para 420 s** | 0,338 para 0,421 | **COLAPSADA** |
| max abates de um jogador | 15,23 para 10,50 | 3,52 para 3,79 | 0,2311 para 0,3610 | **1,562** | 12 para 12 | 0,297 para 0,405 | **AUMENTADA** |

**Placar: 10 AUMENTADA, 4 preservada, 2 COLAPSADA.**

### A leitura principal, e ela e boa: a variancia NAO colapsou em geral

**A resposta a pergunta do usuario e SIM, a aleatoriedade sobreviveu na maior parte do sistema, e em varias metricas ela AUMENTOU.** Dez das dezesseis metricas ganharam dispersao relativa, algumas de forma grande: baroes por jogo quase dobrou o CV, abates do vencedor subiu 63 por cento, torres do perdedor subiu 75 por cento. E a duracao, que era **bimodal** no baseline por acumulo no teto de 60 minutos, virou **unimodal** (BC 0,558 para 0,542) com CV subindo de 0,1599 para 0,2383: as partidas nao terminam mais todas grudadas no teto, e isso e ganho de variedade genuino.

**Nenhuma das metricas ANTES bimodais piorou, e uma melhorou.** As tres que cruzaram o limiar sao: duracao **bimodal para unimodal** (ganho), torres do vencedor **unimodal para bimodal** (perda), torres do perdedor **unimodal para bimodal** (perda). As duas perdas sao exatamente D-25-06.

### As duas que COLAPSARAM, e as duas sao achado que para a fase

**1. TORRES DO VENCEDOR: CV de 0,2802 para 0,0634, razao 0,226.** Perda de **77 por cento** da dispersao relativa. A amplitude p5 a p95 vai de **5 torres para 1**. E o mesmo colapso do numerador de D-25-06, agora medido contra o **baseline congelado da Fase 24**, com harness diferente e N=1500 em vez de 800, e a coerencia entre as duas medicoes independentes e total. Autor atribuido na secao 7: o **canal absoluto** (plano 25-04), completado pelo termo de vantagem.

**2. PRIMEIRA TORRE: CV de 0,2545 para 0,1364, razao 0,536. ACHADO NOVO, que nenhuma medicao anterior desta fase tinha visto.** Perda de **46 por cento** da dispersao relativa, e a amplitude p5 a p95 cai de **1140 s (19 minutos) para 420 s (7 minutos)**. O desvio vai de 5:41 para 2:06.

Este e o caso de manual do modo de falha que esta secao existe para pegar: **a banda esta DENTRO e a distribuicao encolheu por mais de dois tercos.** A mediana da primeira torre e avaliada em [780; 1140] s e mede 945, confortavelmente dentro. O nivel esta certo. O que se perdeu e que **a primeira torre agora cai quase sempre na mesma janela de 7 minutos**, quando antes havia 19 minutos de variedade possivel. Partidas em que a primeira torre caia aos 11:30 ou aos 30:15 praticamente desapareceram.

Consequencia narrativa direta, e ela e do core value e nao de banda: o inicio de partida ficou **previsivel**. A referencia externa, por sinal, tem a dispersao larga e nao a estreita: `STACK.md` linha 14 da p10 / p50 / p90 da primeira torre em **13:45 / 16:15 / 18:50** para pro play, e essa amplitude p10 a p90 de cerca de 5 minutos e sobre uma populacao de partidas profissionais reais. A comparacao direta nao e possivel porque os percentis nao sao os mesmos (p5 a p95 contra p10 a p90), e isso esta dito para nao virar conclusao emprestada.

### O core value medido diretamente: a DINAMICA, e aqui esta o numero mais grave da sessao

O harness classifica cada partida em stomp, equilibrado ou comeback. **Isto e a medicao mais direta possivel de "lanes apertadas podem virar":**

| classificacao | ANTES (baseline v2.2) | **DEPOIS** | movimento |
| --- | --- | --- | --- |
| stomp | 9,1 por cento | **26,3 por cento** | quase **tres vezes** |
| equilibrado | 24,5 por cento | 40,9 por cento | mais 67 por cento |
| **comeback** | **66,5 por cento** | **32,7 por cento** | **caiu para menos da metade** |

**A fracao de partidas com virada caiu de 66,5 para 32,7 por cento, e a de atropelo quase triplicou.** Esta e a metrica que fala a mesma lingua do core value, e ela **piorou muito**, num tier ESPELHADO de gap zero. Nenhuma banda da v2.2 vigia esta linha.

Ressalva honesta: 66,5 por cento de comeback no baseline e um numero **alto demais** para ser saudavel (dois tercos das partidas viravam, o que e o outro extremo), e parte da queda pode ser correcao de um excesso anterior e nao perda pura. Mas cair para **metade** e um movimento de magnitude grande demais para ser lido como so correcao, e o salto de stomp para 26,3 por cento aponta na direcao ruim. **Nao existe referencia externa desta classificacao no `STACK.md`**, entao nao ha como declarar qual dos dois valores e o certo: o que esta provado e a magnitude do movimento.

### O rating continua importando? SIM, e ele importa MAIS

Curva de win-rate por diferenca de forca, N=600 por ponto, os dois lados do mesmo harness:

| gap | ANTES | **DEPOIS** | duracao ANTES | duracao DEPOIS |
| --- | --- | --- | --- | --- |
| 0 (75 x 75) | 56,2 por cento | **55,8 por cento** | 51:54 | 35:47 |
| 4 (77 x 73) | 75,7 por cento | **78,2 por cento** | 50:24 | 33:51 |
| 10 (80 x 70) | 90,3 por cento | **93,0 por cento** | 47:25 | 30:43 |
| 14 (82 x 68) | 95,0 por cento | **95,8 por cento** | 45:04 | 28:47 |
| 20 (85 x 65) | 99,3 por cento | **100,0 por cento** | 41:11 | 25:28 |
| 26 (88 x 62) | 99,8 por cento | **100,0 por cento** | 36:52 | 24:07 |
| 30 e acima | 100,0 por cento | 100,0 por cento | | |

**O desfecho NAO virou determinado pelo snowball em partida parelha:** com gap zero a win-rate e **55,8 por cento**, praticamente identica aos 56,2 do baseline, ou seja a incerteza de desfecho no tier espelhado esta **preservada**. O draft e o rating continuam sendo decisao real, e por isso o item 4 do pedido **nao** dispara.

**Mas a curva ficou mais INGREME, e a ponta dela perdeu a excecao.** Em gap 20 a win-rate era 99,3 por cento (cerca de 4 zebras em 600 partidas) e passou a **100,0 por cento, zero zebra em 600**. Em gap 26 idem, de 99,8 para 100,0. O core value diz "geralmente ganha, mas **nao sempre**", e em gap 20 ou mais o "nao sempre" **deixou de existir na amostra**. Em gap 10 a win-rate sobe de 90,3 para 93,0 por cento. Registrado como observacao, nao como colapso: gap 20 e uma diferenca grande e 100 por cento em 600 partidas nao prova impossibilidade, so que a taxa caiu abaixo de cerca de 1 em 600.

Win-rate por tier em `calibrate:pace` (N=800 por tier), para o registro: EQUILIBRADO **54,3**, GAP-LEVE **92,8**, PRO-GAP **100,0**, GAP-30 **100,0**, AMADOR-EQUILIBRADO **53,3**, AMADOR-GAP **100,0**. R4 (monotonicidade no gap) segue verde e R1 e R2 (invariancia de nivel entre pro e amador) seguem dentro de [-0,080; 0,080].

**Um efeito colateral na leitura de "os atributos importam", que aparece no Cenario E e nao estava sendo vigiado.** Impacto de um unico jogador reforcado (base 75, um role em 95):

| role reforcado | ANTES | **DEPOIS** |
| --- | --- | --- |
| top | 72,2 por cento | **85,5 por cento** |
| jungle | 74,0 por cento | **65,8 por cento** |
| mid | 86,0 por cento | **91,0 por cento** |
| adc | 69,2 por cento | **73,7 por cento** |

O peso relativo das rotas **mudou de ordem**: o top salta 13 pontos e passa a ser o segundo mais decisivo, enquanto o jungler **cai 8 pontos** e passa a ser o menos decisivo dos quatro. Isso e coerente com uma fase que transferiu decisao de objetivo (dominio do jungler) para estrutura de rota, e nao e regressao por si, mas e mudanca de identidade de jogo que nenhuma banda vigia. Registrado como observacao para as fases donas de combate e de objetivos.

### O custo de VARIEDADE que a fase assumiu de proposito, medido

O plano 25-04 trocou a escolha de ator ponderada por sorteio (que o canal nao pode usar, porque consumir sorteio violaria INV-1) pela **rotacao determinista por indice de tick**. Foi troca consciente. Medido agora, comparando o estado A (canal mais caminho do gate) com o estado C (somente o caminho do gate, que e o que usa sorteio), EQUILIBRADO 75 contra 75, N=800, sobre 28.589 e 13.298 eventos estruturais com ator de rota:

| leitura | **C**, somente gate (por sorteio) | **A**, com o canal (rotacao determinista) |
| --- | --- | --- |
| top | 17,02 por cento | 24,87 por cento |
| jungle | 21,24 por cento | 20,96 por cento |
| mid | 27,59 por cento | 26,36 por cento |
| adc | 31,47 por cento | 27,28 por cento |
| **support** | **2,68 por cento** | **0,53 por cento** |
| indice de Herfindahl (0,2000 e uniforme) | **0,2499** | **0,2497** |
| maior participacao | 31,47 por cento | 27,28 por cento |

**O resultado contraria a hipotese, e esta escrito como contrariando: a distribuicao de ator NAO ficou visivelmente mais concentrada.** O indice de Herfindahl e praticamente identico (0,2499 contra 0,2497) e, entre as quatro rotas elegiveis, a rotacao determinista e de fato **mais uniforme**: a amplitude entre a maior e a menor participacao cai de 14,5 pontos para 6,3 pontos.

**O custo real e outro e esta num lugar so: o suporte.** A participacao dele cai de **2,68 para 0,53 por cento**, ou seja um quinto. Isso e o efeito direto e deliberado da decisao do 25-04 de tirar o suporte da rotacao enquanto houver outro candidato, que existiu para consertar o gate de suporte como ator (media 9,5 por cento contra o limite de 5). O conserto funcionou e o custo de variedade e este numero.

**Limitacao desta medicao, declarada porque ela e importante e o numero acima nao a cobre:** participacao **agregada** nao mede "parecer mecanico". Uma rotacao circular produz distribuicao agregada muito uniforme e ao mesmo tempo uma sequencia **previsivel dentro da partida**, que e precisamente o que um sorteio ponderado nao faz. O indice de Herfindahl sobre o agregado e cego a isso. A leitura de "a alternancia parece mecanica demais" continua sendo item de julgamento humano, ja levantado no checkpoint do plano 25-06 e **nao** resolvido por esta medicao.

### Proposta de BANDA DE DOIS LADOS SOBRE DISPERSAO, para as Fases 26 a 30 (NAO implementada)

**O problema que ela resolve.** Restam quatro fases que vao apertar nivel quatro vezes. Sem gate neste eixo, um colapso apareceria so no fim, quando a atribuicao causal ja estivesse perdida. Esta sessao so achou os dois colapsos porque alguem pediu para olhar; nada no projeto obriga a olhar.

**Forma proposta, deliberadamente conservadora:** bandas de dois lados sobre o **coeficiente de variacao**, e nao sobre o desvio, ancoradas nos valores do **baseline congelado da Fase 24**, com tolerancia relativa declarada:

```
CV_medido / CV_baseline  dentro de  [0,75 ; 1,60]
```

O piso 0,75 e o mesmo corte de colapso usado nesta secao. O teto 1,60 existe porque dispersao **explodindo** tambem e defeito (ruido em vez de variacao com causa), e foi posto acima do maior aumento medido nesta fase que e considerado saudavel (baroes por jogo, 1,954, ficaria FORA e por isso o teto precisa de decisao humana: ou 1,60 e o valor certo e aquele item precisa de dono, ou o teto tem de subir para cerca de 2,0).

**Metricas propostas para entrar, as sete pedidas mais duas que esta secao mostrou serem necessarias:** duracao, abates totais, torres totais, torres por minuto, ouro por minuto, primeira torre, razao de torres, **torres do vencedor** (a que colapsou e que nenhuma lista anterior incluia) e a **fracao de comeback** (o proxy direto do core value).

**Onde ela viveria.** Em `scripts/calibrate-pace.ts`, pelo mecanismo `checkBand` que ja existe e que ja carrega piso, teto, alvo, fonte e dono. Nao precisa de arquivo novo, nao precisa de campo novo em `SimEvent` e nao toca uma linha de motor. As estatisticas vem de `summarize` de `scripts/stats.ts`, ja importado por harness.

**Alternativa mais barata, caso o teto seja polemico:** entrar primeiro como **linhas observadas sem veredito** (o padrao que o proprio gate de ritmo ja usa para derivadas), so imprimindo CV medido, CV do baseline e a razao. Isso ja tira o eixo da invisibilidade sem arbitrar corte, e permite escolher o corte na Fase 30 com quatro fases de dado em vez de zero.

**Dimensionamento:** cerca de **50 a 70 linhas** em `scripts/calibrate-pace.ts` (uma tabela de CV de baseline com nove entradas, o calculo do CV por metrica que ja tem o vetor coletado, e nove chamadas de `checkBand` ou nove linhas de relatorio), mais a citacao do baseline como fonte. Zero dependencia nova, zero mudanca de motor, zero risco para o golden.

**NAO implementada neste plano, por decisao explicita:** inventar gate novo no ultimo plano de uma fase de calibracao e como a fase perde a atribuicao causal, o mesmo argumento que barrou a forma estreita de D-25-05 e a banda de forma de D-25-06. Fica como **D-25-07**, aguardando aprovacao.

---
