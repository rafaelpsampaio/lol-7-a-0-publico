# Fase 25C: relatorio de fechamento

**Data:** 2026-07-31
**Fase:** 25C-causalidade-entre-eventos
**Milestone:** v2.2, Realismo de Ritmo da Engine
**Planos:** sete, todos executados
**O que a fase ataca, em uma linha:** CAUSALIDADE entre eventos, ou seja se um evento puxa o outro. Volume e ritmo tem dono na Fase 26 e nao sao julgados aqui.

---

## 0. Base de comparacao, declarada ANTES de qualquer numero

Toda tabela deste relatorio tem tres colunas de referencia, e nenhuma delas e o diagnostico de abertura da milestone.

| coluna | o que e | fonte | harness | fixture | N |
| --- | --- | --- | --- | --- | --- |
| **baseline v2.2** | referencia de nivel, dispersao e forma congelada na Fase 24 | `docs/baselines/24-baseline-v2.2.md` | `diagnose-engine` | seis tiers | cerca de 15 500 |
| **fim da 25B** | o ponto de partida REAL desta fase | `docs/diagnostics/25B-relatorio-da-fase.md` | `calibrate-pace`, `probe-shape` | EQUILIBRADO 75x75 | 800 |
| **PRE de acoplamento** | a leitura congelada na onda 2, no commit base `4ede940` | `docs/diagnostics/25C-ancoragem.md` Bloco 3.1 | `probe-lift` | EQUILIBRADO 75x75 | **800** |
| **hoje** | o estado ao fechar a fase | os mesmos harnesses | as mesmas fixtures | 800 |

**O commit base da fase e `4ede940dea9ef161860170fa72dd752005fa20d3`**, LIDO do Bloco 1 do documento de ancoragem, que e arquivo versionado gravado no PRIMEIRO commit da fase. Ele nunca foi deduzido por assunto de commit, e a secao 7 explica por que essa distincao deixou de ser detalhe.

**O N de banda desta fase e 800**, igual ao do gate de ritmo. Toda leitura em N = 2000 ou maior neste documento esta rotulada como OBSERVACAO e nao e fonte de banda nenhuma (Bloco 2.8 da ancoragem).

---

## 1. Os cinco criterios do roadmap, cada um com o numero medido e o veredito

### Criterio 1, o instrumento antes do motor: **ATENDIDO**

| entrega | desfecho |
| --- | --- |
| sonda de acoplamento sem assercao | `scripts/probe-lift.ts`, onda 1 |
| biblioteca da matriz de lift | `scripts/lift.ts`, com os tres estimadores |
| calibracao do estimador contra independencia VERDADEIRA | `scripts/lift.test.ts`, corpus sintetico com lift 1,000 por construcao |
| tres controles internos na engine real | C1, C2, C3, medidos na onda 2 |
| leitura PRE congelada | `tmp/lift-pre-800.txt`, Bloco 3.1 da ancoragem |
| SHA que congelou | commit `10e9982`, o **primeiro** da fase, antes de qualquer linha de motor |

**A escolha do estimador e PARTE DO CRITERIO e foi feita por medicao, nao por gosto.** Tres estimadores do caso independente foram testados contra corpus onde o lift verdadeiro e 1,000 por construcao, e **dois erram o sinal**:

| estimador | leitura sob independencia verdadeira | veredito |
| --- | --- | --- |
| **pareado por contagem** | 0,967 a 1,043, o IC cobre 1,000 em 12 de 12 celulas | **ADOTADO** |
| cruzado simples | 1,065 a 1,111, o IC exclui 1,000 em 4 de 6 | REJEITADO: falso positivo |
| jitter | 0,609 a 0,882, o IC exclui 1,000 em 12 de 12 | REJEITADO: falso negativo |

Os dois recusados vivem no repositorio **apenas para serem refutados pelo teste**, e nenhum consumidor de veredito pode chama-los.

**O controle POSITIVO validou o instrumento contra um mecanismo de constante conhecida.** O par `torre depois de torre na mesma rota` e freado pelo `CASCADE_N_LANE_SEC` de 180 s, e o lift dele sobe monotonicamente nas oito janelas (0,194 / 0,282 / 0,346 / 0,440 / **0,802** / 1,005 / 1,074 / 1,102), com o **maior salto isolado exatamente no passo de 120 para 180 s**. O instrumento enxerga um mecanismo conhecido do codigo na escala de tempo em que ele foi escrito.

### Criterio 2, os tres pares e os tres pisos: **UM DE TRES FECHADO**

| par | a fase | **PRE** | **piso efetivo** | **hoje** | IC95 | veredito |
| --- | --- | --- | --- | --- | --- | --- |
| **P1** gank, depois torre MESMA rota | MOVE | 1,593 | **1,832** | **1,476** | [1,151; 1,833] | **NAO FECHADO**, faltam 0,356 |
| **P2** Barao, depois torre | PRESERVA | 2,054 | **1,951** | **2,013** | [1,904; 2,144] | **FECHADO** |
| **P3** luta ganha, depois epico | MOVE | 1,307 | **1,503** | **1,296** | [1,208; 1,395] | **NAO FECHADO**, faltam 0,207 |

Os tres pagam tambem o assert do **IC95 inferior contra o piso absoluto de 1,050**, e os tres passam nesse (1,151, 1,904 e 1,208).

**HONESTIDADE METODOLOGICA, e ela precisa estar aqui e nao numa nota.** A versao original deste criterio no roadmap pedia "lift maior que 1 com IC que nao cruza 1", e ela **nascia verde nos tres pares antes de a fase comecar**, que e a definicao de gate vazio (DEC-02). A correcao foi feita por medicao e registrada no proprio roadmap, no commit `f71943f`, **antes** do primeiro numero novo. O piso absoluto de 1,050 nao e escolha de gosto: e o menor multiplo de 0,005 estritamente acima do maior vies medido do estimador adotado sob independencia verdadeira, que e 1,043. A armadilha que ele fecha tem numero: em 180 s o par P3 media **1,081 com IC95 inferior em 1,047**, ou seja a **0,004** do teto do vies do proprio instrumento.

### Criterio 3, o caminho morto: **ATENDIDO POR CONSTRUCAO**

| grandeza | antes | depois |
| --- | --- | --- |
| ticks silenciosos **por caminho morto** | **5,357 por cento** | **0,000 por cento** |

**A prova e POR CONSTRUCAO e nunca por medicao aproximada.** As duas intencoes que recebiam peso sem ter ramo no resolvedor (`cross_map` e `defend_base`) sairam da uniao `MacroIntent` e dos **dois** sitios que podiam dar peso a elas. O zero e verificavel pelo compilador e por teste de contagem que **enumera a uniao em tempo de execucao**, e nunca pela queda do total de ticks silenciosos, que se move por varios motivos ao mesmo tempo. Atribuir o movimento do total (0,5958 para 0,5901) ao caminho morto seria atribuicao causal sem base, e o documento de ancoragem instruiu isso **antes** de a onda 3 medir.

**A saida foi TIRAR O PESO, e nao dar resolvedor**, e as duas medicoes que sustentam a escolha estao no relatorio da onda 3. O controle negativo existe: um simbolo falso foi injetado transitoriamente na uniao e no mapa de vieses, e os **tres** asserts de contagem ficaram vermelhos, cada um nomeando o simbolo. A arvore foi restaurada com conferencia por hash dos dois arquivos.

> #### O ACHADO DESTE CRITERIO, e ele vale mais que o criterio
>
> **A prova do compilador em que o plano se apoiava NAO EXISTIA.** O plano supunha que remover as duas intencoes da uniao faria o mapa de vieses de comp deixar de compilar, e que assim o compilador acharia o segundo sitio sozinho. **Medido: isso nao acontecia.** O arquivo `teamComp.ts` carregava uma **COPIA LOCAL** da uniao `MacroIntent` e o mapa tipava contra a copia. Com as duas intencoes removidas da fonte, `npx tsc --noEmit` saiu **LIMPO com o segundo sitio inteiramente vivo**.
>
> **A consequencia, dita sem suavizar:** a fixture dos harnesses tem perfil de comp vazio, entao o laco de vieses **nunca itera** na calibracao. Sem descobrir a copia, o criterio 3 teria **fechado no harness com o caminho morto vivo no playback**, que e exatamente o app que o usuario assiste, com campeoes atribuidos. E a mesma forma de falha do bug de assistencia da Fase 24.
>
> A copia foi trocada por `import type`, e o compilador entao apontou os quatro pontos sozinho em tres linhas de erro. **Licao de forma: copia local de uma uniao de tipos e um buraco de compilador, e o buraco e silencioso.**

### Criterio 4, a decisao lendo o estado: **ATENDIDO**

Este criterio fecha **por diff e por teste**, e nao por opiniao.

| ligacao | prova |
| --- | --- |
| rota do gank ponderada pelo estado | **RNG-free por assinatura**: a funcao nao recebe gerador nenhum, provado pelo compilador e por assercao sobre o numero de parametros (`pickGankLane.length === 3`) |
| mortes de teamfight movem o lead da rota | teste de distribuicao **condicionada ao lead**, com identidade em neutralidade sobre grade densa |
| janela pos-evento alimenta a decisao de objetivo | a chamada que move o lead pos-luta, com o guarda do peso exigindo o ponto de operacao do sweep |

As tres nasceram de **testes vermelhos commitados antes da implementacao** (`b85791b`, `877aad9`, `803a699`), no ciclo RED e GREEN, e as tres preservam a aridade: a secao 3 traz a tabela.

**A variante DETERMINISTA da rota do gank foi medida e REJEITADA**, e a razao esta registrada: ela entrega o mesmo ganho de acoplamento (1,307 contra 1,308) mas **remove um sorteio**, desloca a sequencia dali para a frente e quebra o piso de duracao sozinha.

### Criterio 5, a aridade: **ATENDIDO, provado por verificacao automatizada**

Nove itens, todos verdes. A secao 6 traz a prova inteira.

---

## 2. A tabela de ACOPLAMENTO, o eixo novo desta fase

| par | **lift PRE** | **lift hoje** | **razao** | **alvo escrito ANTES** | IC95 inferior contra 1,050 | veredito |
| --- | --- | --- | --- | --- | --- | --- |
| **P1** | 1,593 | **1,476** | **0,927** | 1,150 | 1,151 > 1,050, OK | **NAO FECHADO** |
| **P2** | 2,054 | **2,013** | **0,980** | 0,950 (preservacao) | 1,904 > 1,050, OK | **FECHADO** |
| **P3** | 1,307 | **1,296** | **0,992** | 1,150 | 1,208 > 1,050, OK | **NAO FECHADO** |

**Os alvos foram escritos na onda 1 e na onda 2, antes do primeiro numero novo, e nenhuma onda seguinte podia reescreve-los.** Os seis numeros sao 1,593 / 1,832, 2,054 / 1,951 e 1,307 / 1,503.

### Os controles internos, na MESMA pagina do veredito porque sao o alarme de instrumento

| controle | esperado | **hoje** | IC95 | cobre 1,000 | leitura |
| --- | --- | --- | --- | --- | --- |
| **C1** dragao SEM contestacao, depois torre | 1,000 | **0,911** | [0,827; 0,989] | **nao, por 0,011 POR BAIXO** | alerta, direcao conservadora |
| **C2** voidgrubs, depois torre | 1,000 | **0,839** | [0,556; 1,161] | sim | passa |
| **C3** gank, depois gank MESMA rota | (deixou de ser controle na onda 4) | 1,053 | [0,851; 1,262] | sim | observacao |
| **C1x** dragao COM LUTA, depois torre | observado | **1,235** | [1,082; 1,365] | (nao e controle) | o tamanho do caminho mecanico |

**C1 sai de 1,000 por 0,011, POR BAIXO.** Um controle que le abaixo de 1,000 **nao fabrica acoplamento: ele subestima**. Para um gate que asserta "existe acoplamento", errar para baixo e a direcao certa do erro, e por isso este alerta **nao invalida** a leitura de P1, P2 nem P3. A secao 8 registra o que a onda 7 mediu sobre ele e o que continua em aberto.

**C3 deixou de ser controle na onda 4 e isso foi dito naquela onda, e nao descoberto depois.** Ate ali a rota do gank era `randomLane(rng)`, uniforme, e o par era independente **por construcao**. A onda 4 mexeu exatamente nessa rota, entao existe caminho mecanico a partir dali e C3 passou a ser observacao. Restam C1 e C2 como controles.

### O item que as ondas 5 e 6 carregaram, resolvido por medicao

A pergunta era se o nulo pareado por contagem estava deixando de controlar por ROTA, e se por isso o 1,832 de T1 seria parcialmente instrumento. **Foi construido um nulo que pareia por rota alem de por contagem, e a resposta esta em `docs/diagnostics/25C-acoplamento-rota.md`.** O essencial:

| pergunta | resposta medida |
| --- | --- |
| o nulo adotado controlava por rota? | **pelo lado do B, SIM**: para par de mesma rota a contagem pareada ja exige mesma rota. O buraco estava do lado do A |
| o artefato de concentracao existe? | **sim**, e vale cerca de **menos 7 por cento em T1** |
| e no ponto de operacao commitado, T8? | **NULO**, media 1,000 em quatro replicas disjuntas. **O 1,476 nao tem componente de instrumento por rota** |
| a queda ingenua de 22 a 31 por cento? | **dois tercos eram troca de subconjunto de ancoras** e o resto e supercontrole do proprio nulo, medido na arvore base onde a alavanca nem existe |
| o acoplamento e coincidencia simetrica? | **nao.** Placebo de direcao com retencao cheia: razao frente sobre tras de 1,26 a 1,96 em toda amostra e toda temperatura, e tambem no PRE |

---

## 3. A tabela de ARIDADE, com uma linha por mudanca

**Tres nocoes que a fase teve de manter separadas o tempo todo, porque confundi-las bloquearia mudancas que sao seguras:**

| nocao | o que e | como se prova |
| --- | --- | --- |
| **sitios de chamada** | quantas vezes `rng(` aparece no texto de `src/sim/` | contagem canonica, hoje **72** nos dois lados |
| **draws consumidos** | quantos numeros o gerador entrega por TICK | contador que vive **inteiramente** na sonda, nunca em `src/sim/` |
| **determinismo por semente** | a mesma semente produz a mesma partida | golden e assinatura de timeline |

**Uma mudanca pode trocar a DISTRIBUICAO sem tocar em nenhuma das tres**, e foi exatamente isso que a onda 4 fez na rota do gank.

| mudanca | quantidade | ordem | posicao | draws por TICK | sitios `rng(` | canarios | golden |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rota do gank ponderada (`116b402`) | **igual** | **igual** | **igual** | preservada | 72 | verdes | deslocou VALOR |
| mortes de teamfight movem o lead (`48295de`) | **igual** | **igual** | **igual** | preservada | 72 | verdes | deslocou VALOR |
| janela pos-evento na decisao (`03800e0`) | **igual** | **igual** | **igual** | preservada | 72 | verdes | deslocou VALOR |
| remocao do simbolo de intencao (`d764d33`) | **igual** | **igual** | **igual** | preservada | 72 | verdes | **diff VAZIO** |
| peso das duas intencoes removido nos dois sitios (`00d394e`) | **igual** | **igual** | **igual** | preservada | 72 | verdes | deslocou VALOR |

**O sorteio da rota do gank continua no ponto de chamada, na mesma linha e na mesma posicao da sequencia: a funcao nova recebe o numero JA sorteado como argumento puro.** E por isso que a troca de um sorteio uniforme por um ponderado nao mexeu na contagem canonica.

**A leitura por TICK, contra o PRE congelado:**

| grandeza | PRE | hoje | delta |
| --- | --- | --- | --- |
| **draws por TICK** | **4,9991** | **5,1029** | **mais 0,1038, ou 2,08 por cento** |
| draws por PARTIDA | 609,8 | 624,0 | **CONFUNDIDO PELA DURACAO, registrado e nunca usado como veredito** |

**A armadilha esta fechada por escrito e ela ja enganou uma medicao desta milestone:** ligar estado **encurta** a partida, entao o total por partida cai mesmo quando o consumo por tick sobe, e as duas leituras contam historias **opostas** sobre a mesma mudanca. Medido na pesquisa: `Z3b` consome mais 2,29 por cento por tick e mostra sinal positivo no total por partida por acaso; `Z4a press 4,0` mostra menos 80,7 draws por partida e menos 5,30 por cento por tick.

---

## 4. O NIVEL E A FORMA QUE NAO PODEM SER DEVOLVIDOS

> ### BLOCO DE FOLGA PARA A FASE 26
>
> **Este e o insumo direto do sequenciamento da proxima fase, no mesmo formato do bloco que a Fase 25B escreveu para esta.**
>
> | banda | lado que aperta | folga ao fim da **25B** | folga **hoje** | o que a 25C fez |
> | --- | --- | --- | --- | --- |
> | **duracao media (min)** | piso 29 | 0,987 (29,987) | **1,023** (30,023) | **DEVOLVEU 0,036 min** |
> | **mediana da primeira torre (s)** | piso 780 | 60 s (840 s) | **30 s** (810 s) | **CONSUMIU 30 s, ou 50 por cento da folga** |
> | torres por minuto | teto 0,450 | | 0,084 (0,366) | dentro |
> | torres aos 20:00 | teto 5,000 | | 0,141 (4,859) | dentro, **apertado** |
> | placas por partida | teto 12,000 | | 0,576 (11,424) | dentro, **apertado** |
> | razao de torres | teto 4,500 | | 1,438 (3,062) | dentro |
>
> **AS TRES LINHAS QUE A FASE 26 PRECISA LER PRIMEIRO:**
>
> 1. **A mediana da primeira torre esta a 30 s do piso, e a grandeza e QUANTIZADA em degraus de 15 s.** Restam **DOIS TICKS**. A Fase 26 corta cerca de 40 por cento dos abates e pode empurrar a primeira torre para mais cedo.
> 2. **`torres aos 20:00` esta a 0,141 do teto e `placas por partida` a 0,576.** As duas sao bandas de nivel e nenhuma delas foi alvo desta fase.
> 3. **A licao da onda 6 vale para todas elas: verde e vermelho nao sao a informacao completa de uma banda.** A Fase 25B fechou LIMPA e ainda assim consumiu **18,2 dos 21 pontos** de folga da banda do Barao. Ninguem viu, porque o gate estava verde.

**As bandas de dispersao e de forma da Fase 25B que estavam dentro continuam dentro**, e as que estavam fora continuam fora com o dono delas. Nenhuma banda pre-existente passou de verde para vermelho por causa desta fase, com **uma excecao nomeada na secao 5**.

---

## 5. Estado dos SETE gates ao fechar a fase

| gate | desfecho | dono do vermelho |
| --- | --- | --- |
| `calibrate:micro` | **verde** | |
| `calibrate:structures` | **verde** | |
| `calibrate:combat` | **verde** | |
| `calibrate` | vermelho | Fase 28 (win-rate com gap 30) |
| `calibrate:objectives` | **vermelho** | **fase nova do Barao** (regressao acumulada, secao 9) |
| `calibrate:pace` | vermelho | quinze bandas, tabela abaixo |
| `calibrate:assists` | vermelho | Fase 24 (elegibilidade estrutural de rota) |

**3 de 7 verdes.** Nenhum gate terminou por estouro de tempo: todo desfecho e assercao nomeada.

### As quinze bandas vermelhas do gate de ritmo, nominalmente e com o dono de cada uma

| banda | medido | banda | dono |
| --- | --- | --- | --- |
| abates/min | 1,277 | teto 1,000 | **Fase 26** |
| razao de abates vencedor sobre perdedor | 1,120 | piso 1,800 | **Fase 26** |
| razao torres sobre abates | 0,224 | piso 0,330 | **Fase 26** |
| fracao de abates ate 20:00 | 0,506 | teto 0,460 | **Fase 26** |
| fracao de partidas sem abate ate 10:00 | 0,016 | piso 0,050 | **Fase 26** |
| ouro/min por time | 650 | piso 1500 | **Fase 27** |
| razao de ouro/min vencedor sobre perdedor | 1,051 | piso 1,100 | **Fase 27** |
| win-rate com gap de forca 30 | 1,000 | teto 0,970 | **Fase 28** |
| DISPERSAO primeira torre (CV) | 0,528 | piso 0,750 | **Fase 25B** |
| DISPERSAO fracao de comeback | 0,360 | piso 0,400 | Fase 30 (revisao em bloco) |
| FORMA vitorias com exatamente UMA rota limpa | 0,399 | piso 0,500 | **Fase 25B** |
| FORMA fracao de shutout | 0,398 | teto 0,120 | **Fase 25B** |
| FORMA bimodalidade das torres do perdedor | 0,572 | teto 0,556 | **Fase 25B** |
| **ACOPLAMENTO P1** | **1,476** | piso 1,832 | **Fase 25C, NAO FECHADO** |
| **ACOPLAMENTO P3** | **1,296** | piso 1,503 | **Fase 25C, NAO FECHADO** |

**As duas bandas de acoplamento que seguem vermelhas sao desta fase e estao declaradas como nao fechadas.** As outras treze ja entraram vermelhas e tem dono anterior.

**A UNICA banda que passou de verde para vermelho nesta fase e a do Barao**, e ela esta na secao 9 com a atribuicao commit a commit e a decisao ja tomada.

---

## 6. As provas por DIFF, e o criterio 5 e literalmente sobre elas

**Verificacao automatizada, `tmp/verify-25C-diff.cjs`, saida em `tmp/diff-proof-25C.txt`.** Nove itens, todos verdes.

### Nota de metodo, e as quatro armadilhas que ela fecha

1. **O commit base e LIDO de arquivo versionado, nunca deduzido.** A regra de achar a base pelo assunto do commit **devolve o proprio HEAD** quando o topo da arvore e um commit de planejamento, e a prova por diff passa VAZIA comparando a arvore com ela mesma. **A armadilha estava armada nesta fase:** o topo era `4ede940`, um commit de planejamento com escopo `25C`, e antes dele `f71943f`, uma correcao de roadmap tambem com escopo `25C`. Deduzir devolveria um dos dois.
2. **Duas sanidades da base, conferidas ANTES de qualquer comparacao.** O SHA lido tem de existir na arvore de commits (`cat-file -t` devolve `commit`), e o blob de `src/sim/engine.ts` na base tem de ser DIFERENTE do de hoje. Medido: `667e1fd3...` na base contra `3550332b...` hoje. Se fossem iguais o script **falha** em vez de reportar sucesso.
3. **Fim de linha normalizado nos DOIS lados.** `core.autocrlf` esta em `true`, entao o objeto do git guarda LF e a arvore de trabalho tem CRLF. Comparar bytes crus acusaria **toda** linha como alterada. O que fica provado byte a byte e o CONTEUDO.
4. **Restauracao provada por HASH DE OBJETO e nunca por status de arvore**, pela mesma razao.

### Os nove itens

| # | item | resultado |
| --- | --- | --- |
| 1 | corpos das quatro funcoes protegidas | **IDENTICOS**: curva temporal de plausibilidade, freio de cascata, desvio de freio, lista de candidatos de ator |
| 2 | as quatro constantes de cascata | **IDENTICAS** nos dois lados |
| 3 | a linha da rampa de fim de jogo | **IDENTICA byte a byte, comentario incluso**, com o mesmo numero de usos do simbolo |
| 4 | a linha do gate de pressao estrutural | **IDENTICA byte a byte, uma unica ocorrencia nos dois lados** |
| 5 | contagem canonica de chamadas ao gerador | **72 na base e 72 hoje**, delta zero, com o delta por arquivo |
| 6 | constantes FORA do escopo autorizado | **as seis IDENTICAS**, e as duas autorizadas **nascem** nesta fase |
| 7 | regeneracoes de golden | **UMA**, plano 25C-06, dois commits de snapshot com **exatamente um arquivo cada** |
| 8 | quatro canarios e o teste de caminho morto | **os quatro VERDES**, executados por nome |
| 9 | aridade em draws por TICK contra o PRE | **5,1029 contra 4,9991**, mais 2,08 por cento |

**O item 5 e o coracao do criterio 5 desta fase**, porque ela trocou um sorteio uniforme por um ponderado e removeu uma funcao. O delta **por arquivo** prova que a troca foi de **distribuicao** e nao de **consumo**.

**O item 6 existe porque a fase tinha permissao de criar exatamente duas constantes de calibracao novas e de mexer em nenhuma outra.** Conferido: `SIEGE_ACCRUAL_BASE = 2.2`, `base: 27`, `SIEGE_ADV_FLOOR = 0.25`, `SIEGE_ADV_EXPONENT = 3.5`, `SIEGE_ADV_CEIL = 4.0` e `SIEGE_FOCUS_TEMPERATURE = 9` estao **identicas**. As duas autorizadas, `GANK_FOCUS_TEMPERATURE = 8` e `POST_FIGHT_OBJECTIVE_W = 1.0`, **nao existiam na base**, ou seja nenhuma constante pre-existente foi movida.

### A prova de ATRIBUICAO que esta fase tem e as anteriores nao tinham

**Existiu um commit ESTATICO na onda 3 cujo diff de snapshot foi VAZIO**, provado por SHA:

```
d764d3317b242aa9445726d316140eb55735d57e
refactor(25C-03): remove o simbolo de intencao que nunca recebe peso, sem deslocamento de golden
arquivos: 1, dos quais .snap: 0
```

Isso separa "mudanca que nao desloca o golden" de "mudanca que desloca". Sem essa separacao, a regeneracao da onda 6 teria de carregar a autoria de **todas** as mudancas da fase juntas.

### Checagem de travessao

| grandeza | valor |
| --- | --- |
| linhas ACRESCENTADAS pelo diff da fase | 12 316 |
| com travessao, total | **2** |
| destas, nomes de bloco gerados pelo vitest e **ja presentes na base** | **2** |
| destas, **escritas pela fase** (o que conta) | **0** |

**A checagem roda sobre as linhas acrescentadas, NUNCA sobre arquivo inteiro**, porque ha travessoes pre-existentes nos arquivos que a fase toca e checar arquivo inteiro produz vermelho que nao e da fase e treina o leitor a ignorar o alarme. As duas ocorrencias sao nomes de bloco que o vitest gera a partir do titulo do `describe` de `golden.test.ts`, que carrega travessao desde a Fase 7. **A excecao so vale porque foi CONFERIDA**: as duas linhas ja existem, identicas, no lado da base, e `golden.test.ts` **nao foi tocado** pela fase.

---

## 7. O QUE A FASE NAO RESOLVEU, sem suavizar

### 7.1 P1: NAO FECHADO, e a regiao de fechamento NAO ESTA ESTABELECIDA

**Faltam 0,356** (1,476 medido contra o piso 1,832).

**A redacao anterior deste bloco dizia que a regiao de fechamento EXISTE mas do lado proibido pela regra de parada, porque T1 lia 1,832 exato a 795 s. Essa afirmacao NAO se sustenta e a correcao esta aqui em vez de escondida.**

A onda 7 mediu a razao de P1 contra o PRE, sob o estimador **pre-registrado**, no N da banda, em **quatro amostras disjuntas**:

| sementes | PRE | T1 | **razao** | piso 1,150 |
| --- | --- | --- | --- | --- |
| **0 a 799 (a fixture do gate)** | 1,593 | 1,832 | **1,150** | fecha, exatamente em cima |
| 800 a 1599 | 1,711 | 1,629 | **0,952** | nao fecha |
| 1600 a 2399 | 1,472 | 1,723 | **1,170** | fecha |
| 2400 a 3199 | 1,783 | 1,592 | **0,893** | nao fecha |

**Media 1,041. Desvio padrao 0,139.** O 1,150 exato da fixture do gate **nao se reproduz**.

**A leitura correta, e ela e mais fraca que a anterior:** em T1 a razao bateu o piso em **UMA de quatro amostras disjuntas**; **a regiao de fechamento de P1 nao esta estabelecida**; e **o instrumento nao tem poder para decidir isso no N do gate**.

> #### A CAUSA E DE DESENHO, E ELA ERA VERIFICAVEL ANTES DA PRIMEIRA MEDICAO
>
> **Isto nao e azar de amostra: e falha de FORMA do criterio, e a responsabilidade e de quem escreveu o piso.** O piso relativo de P1 foi escrito como `lift_pos / lift_pre >= 1,15` e ancorado num PRE cujo **IC95 ja era [1,256; 1,932], largura 0,676 sobre um ponto de 1,593**. Depois ele foi mandado julgar um POS medido com a mesma largura. **A razao entre duas medicoes com essa largura nao tem poder para discriminar 15 por cento, por construcao.** O numero 0,676 estava impresso na propria tabela que congelou o piso, no mesmo dia em que o piso foi escrito, e nao precisava de replica nenhuma para ser visto.
>
> **LICAO DE FORMA, e ela vale para as cinco fases desta milestone: um piso RELATIVO entre duas medicoes ruidosas precisa de CALCULO DE PODER ANTES de virar criterio. Nenhuma das cinco fases fez esse calculo.**
>
> As bandas de **nivel** escaparam porque comparam contra uma constante externa. O problema aparece quando os **dois** lados da comparacao sao medidos, que e o desenho dos pisos relativo e de preservacao desta fase.
>
> **Por que P2 nao sofre do mesmo mal:** P2 mede `p_obs = 0,596` sobre 1101 ancoras e P1 mede `0,037` sobre 2355. O IC95 do PRE de P2 tem largura **0,265** contra **0,676** de P1. O desenho do piso e o mesmo; o que difere e o poder que a populacao entrega, e isso nao foi conferido em nenhum dos dois.

**A DECISAO DE T8 SOBRE T1 FICA REFORCADA E NAO INVALIDADA.** A onda 5 recusou T1 pela regra de parada (mediana da primeira torre em 795 s contra o piso de 800 s), abrindo mao do unico ponto da grade que fechava P1, e a recusa foi por **custo de margem**. Agora se sabe que aquele fechamento **nem estava estabelecido**. A escolha conservadora foi feita **sem** essa informacao e sobreviveu a ela: quem escolhesse T1 teria comprado, com toda a folga de duracao da fase, um fechamento que replica disjunta nao reproduz. **E o argumento a favor de preservar folga quando a evidencia e fina.**

### 7.2 P3: NAO FECHADO, e a regiao e VAZIA

**Faltam 0,207** (1,296 medido contra o piso 1,503).

**A fronteira foi medida dos dois lados, e a regiao e VAZIA:** grade de dezesseis pontos, **maximo de 1,364**, e movimento maximo de **mais 0,3 por cento** contra os **mais 15** exigidos.

**Esta e fronteira de MODELO e nao de instrumento**, e a distincao importa: a fronteira de `torres/min` da Fase 25B era de instrumento e **dissolveu** quando o contador foi lido direito. Esta nao dissolve. **O efeito satura e depois inverte**: aumentar a forca PIORA (1,114 em forca 2,0 e 1,094 em 4,0), porque **todas as alavancas competem pela mesma massa de peso normalizada** e somar forca nao soma efeito.

**Isto estava PREVISTO por escrito antes do primeiro conserto.** O Bloco 2.10 da ancoragem, commitado na onda 1, registra: a melhor alavanca isolada move P3 em mais 6,2 por cento contra os 15 exigidos, e a distancia projetada era **negativa em 0,115**. **Se P3 tivesse fechado, o registro mostraria que fechou contra uma previsao pessimista escrita antes. Nao fechou, e o registro mostra que a fase sabia, mediu e disse, em vez de descobrir no fim.**

**Em W = 60 s, onde a banda vive, P3 le entre 1,296 e 1,364 com p = 0,002**, ou seja **o acoplamento existe e e detectavel**. O que nao existe e a alavanca barata que o move 15 por cento.

### 7.3 A incerteza declarada do proxy de luta ganha

| grandeza | valor |
| --- | --- |
| fracao de cobertura por LUTA | **0,5804** |
| desvio de lift entre o proxy e a definicao completa | **0,095** |

**A direcao do vies esta identificada e nao e acidente:** o proxy so ve a luta que produziu multikill ou ace, ou seja a luta **decisiva**, que e justamente a que converte em objetivo. Ele e uma amostra enviesada **para cima**.

O piso **relativo** de P3 nao e afetado em primeira ordem, porque PRE e POS usam o mesmo proxy e um vies estavel se cancela na razao. O piso **absoluto** e afetado na direcao **permissiva**, com folga medida de 0,246 (1,296 contra 1,050).

---

## 8. O que a fase descobriu SEM SER OBJETIVO DELA

**Registrado com o mesmo peso dos criterios, porque foi aqui que a fase entregou mais do que prometeu.**

### 8.1 A regressao do Barao, acumulada em TRES fases

`calibrate:objectives` saiu de verde para vermelho: **Baron no spawn por partida = 0,316** contra o teto de **0,240**. A banda fez exatamente o trabalho dela: o teto foi dimensionado para reprovar uma alta de 21 por cento, e a alta medida e de **60 por cento**.

**A hipotese publica do desenvolvedor foi REFUTADA por quatro medicoes independentes**, e isso fica registrado sem suavizar: desligar `POST_FIGHT_OBJECTIVE_W` por inteiro devolve **0,010 de 0,118** e o gate continua vermelho com ela em zero; a grade inteira de W e plana e nem monotonica (amplitude 0,028 contra excedente 0,076); o commit que introduziu a alavanca move a metrica em **mais 0,002** contra mais 0,066 e mais 0,026 dos outros dois; e a alta esta **inteiramente na populacao contestada**.

**A atribuicao: 0,082 desta fase, 0,036 da 25B, e a base ja entrava a 2,5 por cento do teto. Nenhuma fase sozinha e dona.** Decisao tomada: **regressao declarada com fase propria**.

### 8.2 A Fase 25B consumiu 18,2 de 21 pontos de folga e ficou VERDE

**O achado mais importante dos quatro, e ele generaliza.** O commit base desta fase ja media **0,234** contra o teto de 0,240, ou seja **97,5 por cento**. Ninguem viu, porque ninguem tinha motivo para olhar: o gate estava verde. O comentario da banda afirmava, de boa fe, que a medida estava a 82,5 por cento do teto.

**A generalizacao vale para as sete bandas e para toda fase futura: verde e vermelho nao sao a informacao completa de uma banda. Uma fase pode fechar limpa e ainda assim deixar a proxima sem espaco para respirar.** Por isso a secao 4 deste relatorio registra **folga restante** e nao so veredito.

### 8.3 O caminho causal nao mapeado do dragao contestado

**Ele so apareceu porque um controle leu 1,086 e ninguem arredondou.** O IC95 excluia 1,000 por **0,004**, e a onda 1 declarou a separacao como bloqueante em vez de deixar passar.

O mapeamento original parava no termo de forca da camada estrutural, e ali a afirmacao era verdadeira: dragao nao entra em `force`, nem em peso de pressao, nem em `bestPressureLane`. **O caminho nao passava por ali.** Ele passa por `resolveContestedObjective`, que chama `resolveTeamfight` **antes** de tomar o objetivo; dali `aliveCount` alimenta `shouldPushStructure` e `numbersAdvantage`, que **multiplica** o dano estrutural.

**O acoplamento esta INTEIRAMENTE no subconjunto contestado:** 1,311 em 31 por cento das ancoras contra 0,973 nas outras 69. O agregado de 1,086 era a mistura.

**Licao de forma: um controle nao vale pela afirmacao de que nao ha caminho, vale pelo MAPEAMENTO COMPLETO do caminho.**

### 8.4 A excecao do 22 para 21, com o limite do criterio junto

A uniao do corpus de golden caiu de **22 para 21** tipos (`elder_taken` foi de 1/17 para 0/17), e a mudanca foi classificada como de **VALOR** por **alcancabilidade medida**, e nao por presenca no corpus: o tipo ficou **mais** alcancavel que na base da fase (**10,67 contra 9,83 por cento**), com o instrumento validado reproduzindo numero por numero leituras que outra onda ja tinha registrado.

**A excecao e um afrouxamento e esta rotulada como tal.** Foi feita **depois de ver o numero**, que e o vicio que a disciplina do projeto existe para impedir, e por isso existe como excecao declarada e nao como criterio reescrito em silencio.

**O limite real, e ele e o achado:** um corpus de 17 blocos **nao consegue vigiar por presenca** tipos com alcancabilidade de um digito. Com 10 por cento por partida, sair de todos os 15 blocos e desfecho de cerca de **um em cinco**. **O conserto real nao e mexer no criterio: e ampliar o corpus**, o que faz blocos NASCEREM e portanto e mudanca de ESTRUTURA, reservada ao passe unico da **Fase 30**.

### 8.5 O problema de PODER dos pisos relativos

**Achado da onda 7, detalhado na secao 7.1.** Um piso relativo entre duas medicoes com IC de largura 0,676 nao discrimina 15 por cento. **Nenhuma das cinco fases desta milestone fez calculo de poder antes de transformar uma razao em criterio.**

### 8.6 O placebo de DIRECAO, como tecnica reutilizavel

**Nasceu como ferramenta de uma investigacao e vale para qualquer fase futura que meca acoplamento.**

> Para julgar se uma associacao temporal entre A e B e causal ou coincidencia por causa comum, meca o **mesmo par com a janela virada para tras**, na mesma ancora, na mesma rota, na mesma partida. Coincidencia por contexto quente num momento quente e **simetrica no tempo**; causa nao e.

**Ele nao paga preco de retencao nenhum (97 a 99 por cento das ancoras), nao troca a populacao e nao supercontrola**, e nesta fase ele **decidiu a pergunta onde o pareamento estrito nao conseguiu**. A ordem certa de investimento e **placebo primeiro, nulo estrito depois** e so se o placebo deixar duvida.

---

## 9. METRICAS DERIVADAS, observadas e NUNCA metas

**Nenhuma linha desta tabela e entrega desta fase.** Elas sao observadas porque um movimento nelas informa, e nao porque a fase se compromete com elas.

| metrica | baseline v2.2 | fim da 25B | **hoje** | banda FINAL de aceite | fase dona |
| --- | --- | --- | --- | --- | --- |
| duracao media da partida | 51,40 min | 30,12 min | **29,85 min** | 29 a 36 min | Fase 25, **dentro** |
| fracao no limite de 60 minutos | 27,20 por cento | 0,40 por cento | **0,00 por cento** | abaixo de 0,5 por cento | Fase 25, **dentro** |
| abates totais por partida | 88,16 | 38,68 | **39,33** | 22 a 34 | **Fase 26**, ainda FORA |
| torres totais por partida | 9,59 | 8,67 | **8,83** | 10 a 14 | Fase 25, FORA sob esta leitura |
| baroes por partida | 4,28 | 1,57 | **1,63** | 0,9 a 1,8 | Fase 25, **dentro** |
| fracao de partidas com Alma | 97,4 por cento | 45,7 por cento | **42,7 por cento** | 30 a 55 por cento | Fase 25, **dentro** |
| fracao de partidas com Elder | 92,1 por cento | 22,0 por cento | **19,3 por cento** | 4 a 18 por cento | Fase 25, ainda FORA |

**Abates totais subiram de 38,68 para 39,33**, e isso e observacao e nao regressao de banda desta fase: a metrica ja estava fora, o dono e a Fase 26, e ela corta cerca de 40 por cento dos abates.

---

## 10. REGISTRO DE CONFORMIDADE

| item | desfecho |
| --- | --- |
| regras duras da v2.0 em zero absoluto nos seis tiers | `primeira torre antes de 7:00` **0**, `Baron antes de 20:00` **0**, `queda cross-lane simultanea` **0** |
| contagem canonica de chamadas ao gerador em `src/sim/` | **72** na base e **72** hoje |
| linha do gate de pressao estrutural | **1 ocorrencia**, identica byte a byte nos dois lados |
| regeneracoes de golden na fase | **1 de 1**, em dois commits com **um arquivo cada** |
| dependencias novas em `package.json` | **zero** |
| gates que passaram de verde para vermelho | **um**: `calibrate:objectives`, atribuido e com decisao tomada (secao 8.1) |
| bandas afrouxadas para o fechamento parecer melhor | **nenhuma** |
| suite completa | **944 verdes, ZERO vermelhos, 58 de 58 arquivos.** Nenhum vermelho pre-existente restou para ser nomeado |
| travessao nas linhas ACRESCENTADAS pela fase | **0** autorais, 2 geradas pelo vitest e ja presentes na base |
| `src/sim/` tocado pelo plano de fechamento | **nenhuma linha**, `git diff --quiet HEAD -- src/sim` vazio |

---

## 11. O que a fase PROMETE e o que ela NAO PROMETE

**Isto precisa estar escrito para que o aceite julgue a coisa certa.**

**A fase ataca CAUSALIDADE:** se um gank vira torre, se o Barao vira push, se luta ganha vira objetivo. O instrumento dela e a matriz de lift, e a ancora teorica e o proprio 1,000, que e uma vantagem rara nesta milestone: nenhum dado externo e necessario.

**A fase NAO promete volume nem ritmo.** Abates por minuto, fracao de abates ate 20:00, ouro por minuto e a distribuicao dos eventos no tempo tem dono na **Fase 26** e na **Fase 27**, e as bandas correspondentes estao vermelhas com esses donos desde antes desta fase comecar.

**Se o playback continuar com abate demais ou com evento espalhado no tempo, isso NAO e reprovacao desta fase.** A pergunta que fecha esta fase e outra: **a partida ainda parece uma sequencia de sorteios independentes, ou um evento passou a puxar o outro?**

---

## 12. Onde cada numero pode ser reconferido

| assunto | arquivo |
| --- | --- |
| definicao do instrumento, pisos, janela e os seis alvos | `docs/diagnostics/25C-ancoragem.md` Blocos 2 e 3 |
| leitura PRE congelada e os controles internos | `docs/diagnostics/25C-ancoragem.md` Bloco 3.1 e 3.2 |
| residuo do proxy de luta ganha | `docs/diagnostics/25C-ancoragem.md` Bloco 4 |
| retrato de aridade PRE | `docs/diagnostics/25C-ancoragem.md` Bloco 5 |
| sweep do conjunto e a grade de quinze pontos | `docs/diagnostics/25C-sweep.md` |
| diff estruturado do golden em quatro dimensoes | `docs/diagnostics/golden-diff-25C.txt` |
| regressao do Barao, contrafactual e atribuicao | `docs/diagnostics/25C-baron-no-spawn.md` |
| **nulo pareado por rota, artefato e o problema de poder** | **`docs/diagnostics/25C-acoplamento-rota.md`** |
| provas por diff, saida completa | `tmp/diff-proof-25C.txt` e `tmp/verify-25C-diff.json` |
| leitura POS de acoplamento e aridade | `tmp/lift-pos-800.txt` |
| painel amplo pos-fase | `docs/diagnostics/engine-diagnose.txt` |
| desfecho dos sete gates | `tmp/25C07-calibrate-all.log` |
| itens diferidos com dono | `.planning/phases/25C-causalidade-entre-eventos/deferred-items.md` |
