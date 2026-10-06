# Fase 25C: o nulo pareado por ROTA, e o que ele fez com P1

**Data:** 2026-07-31
**Fase:** 25C-causalidade-entre-eventos
**Plano de origem:** 25C-07 (item carregado pelas ondas 5 e 6)
**Proposito, em uma linha:** resolver POR MEDICAO, e nao por argumento, a duvida de se o nulo pareado por contagem estava deixando de controlar por ROTA, e dizer o que a resposta muda.

---

## 0. A pergunta, nas palavras do desenvolvedor e nao reescrita

> A onda 5 descobriu que a leitura do controle **C1 DEPENDE DA TEMPERATURA DE FOCO DO GANK**. A preocupacao que a onda 7 tem que resolver: **o P1 e par de MESMA ROTA, e a alavanca concentra ganks nas rotas com lead.** Se concentrar ganks **E** quedas de torre nas mesmas rotas cria coincidencia sem causa, **o nulo pareado por contagem pode nao estar controlando por ROTA**, e o **1,832 medido em T1 seria parcialmente instrumento.**

O caminho pedido: construir um nulo que pareie por ROTA alem de por contagem, comparar P1 sob os dois nulos ao longo da grade de temperatura, e medir C1 tambem sob o nulo novo.

**O desfecho, antecipado aqui porque ele muda a leitura da fase:** a preocupacao esta **parcialmente confirmada e muito menor do que a medicao ingenua sugere**, e no ponto de operacao commitado ela e **nula**. Mas a investigacao pegou, de lado, um problema **maior** que o que foi mandada resolver: **o 1,832 de T1 nao se reproduz em replica disjunta**, e com ele cai o registro de que a regiao de fechamento de P1 existe. A secao 6 e sobre isso.

---

## 1. Procedencia, custo e o que NAO foi tocado

| item | valor |
| --- | --- |
| harness transitorio | `tmp/25C07-rota.test.ts`, config `tmp/vitest.25C07-rota.config.ts` |
| relatorios brutos | `tmp/25C07-rota-800.txt`, `tmp/25C07-rota-2400.txt`, `tmp/25C07-rota-s800.txt`, `tmp/25C07-rota-s1600.txt`, `tmp/25C07-rota-s2400.txt` |
| arvores medidas | `tmp/25C07/PRE` (commit base `4ede940`) e `tmp/25C07/T{1,2,4,8,16}`, todas extraidas por `git archive` |
| custo | 22 s por rodada de grade em N = 800; 84 s em N = 2400 |
| linhas de `src/` tocadas | **nenhuma** |

**A constante de temperatura foi trocada SO NA COPIA.** As cinco arvores saem de `git archive HEAD src`, a troca acontece dentro de `tmp/`, e a arvore de trabalho nunca e escrita. Isso dispensa a prova de restauracao por hash de blob que as ondas 5 e 6 precisaram fazer: nao ha o que restaurar. `git status --short src` fica vazio o tempo todo.

**A arvore PRE e o commit base gravado no Bloco 1 da ancoragem**, `4ede940dea9ef161860170fa72dd752005fa20d3`, lido do arquivo versionado e nao deduzido. Nela `GANK_FOCUS_TEMPERATURE` **nao existe** (contagem de ocorrencias: 0) porque a alavanca e da onda 4, e a rota do gank era `randomLane(rng)`, uniforme. Ela e a regua da secao 4.

### Validacao do instrumento ANTES de qualquer conclusao

O nulo pareado por contagem foi reimplementado no harness transitorio, e uma reimplementacao que divergisse em silencio produziria um "achado" que e so um bug. Por isso ele so pode ser citado depois de reproduzir numero por numero o que ja esta registrado:

| leitura | registrado antes | medido aqui | onde estava registrado |
| --- | --- | --- | --- |
| P1 no PRE (`4ede940`) | 1,593 | **1,593** | ancoragem, Bloco 3.1 |
| P1 em T1 | 1,832 | **1,832** | sweep, secao 3.8 |
| P1 em T2 | 1,716 | **1,716** | sweep, secao 3.8 |
| P1 em T4 | 1,635 | **1,635** | sweep, secao 3.8 |
| P1 em T8 | 1,476 | **1,476** | sweep, secao 3.8 |
| P1 em T16 | 1,507 | **1,507** | sweep, secao 3.8 |

**Seis reproducoes exatas.** O harness mede a mesma coisa que o gate.

---

## 2. O que o nulo ADOTADO ja controlava, e onde estava de fato o buraco

Antes de construir nulo novo, foi preciso ler o que o antigo faz. **A afirmacao de que o pareado por contagem "nao controla por rota" esta errada pela metade, e a metade certa e a que importa.**

O pareamento exige que o parceiro tenha a **mesma contagem de B compativel com a ancora**, e "compativel" e decidido por `compat`, que para um par de MESMA ROTA **exige mesma rota**. Ou seja, para P1 o parceiro ja e obrigado a ter o **mesmo numero de quedas de torre, do mesmo lado, NA ROTA DA ANCORA**. A rota ja entrava, pelo lado do B.

**O buraco estava do lado do A**, e e exatamente onde a alavanca da onda 4 atua: nada obrigava o parceiro a ter recebido **a mesma quantidade de gank naquela rota**. Duas partidas em que a rota `bot` perdeu duas torres eram tratadas como intercambiaveis mesmo que numa a rota tivesse recebido quatro ganks e na outra um. E "quantos ganks aquele lado dirigiu aquela rota" e a leitura direta da concentracao que a alavanca produz.

### Os nulos comparados

| nulo | condicao do parceiro |
| --- | --- |
| **N-CONTAGEM** (adotado) | mesmo decil de duracao, mesma contagem de B compativel com a ancora |
| **N-ROTA** (novo) | o acima, **mais** a mesma contagem de eventos do tipo A do lado da ancora **na rota da ancora** |
| **N-ROTA-E** (novo, estrito) | o acima, **mais** o mesmo espalhamento de B, ou seja o numero de rotas distintas com ao menos um B daquele lado. Existe para os pares de ROTA QUALQUER, como C1, em que a contagem pareada e um total e ignora inteiramente como o total se distribuiu entre as rotas |

---

## 3. A armadilha que quase produziu o numero errado: populacao contra nulo

**A leitura ingenua diz que P1 desaba.** Em N = 800, T8: 1,476 sob N-CONTAGEM contra 1,021 sob N-ROTA. Seria uma queda de 31 por cento, e seria a confirmacao da preocupacao.

**Ela esta errada, e o erro tem direcao previsivel.** Pareamento mais estrito acha menos parceiro, e ancora sem o minimo de parceiros e **descartada**. A retencao de ancoras de P1 sob N-ROTA cai para **25 a 46 por cento** em N = 800. Ou seja o nulo novo nao muda so o denominador: ele muda a **populacao de ancoras**. E a ancora que fica sem parceiro e justamente a de **rota muito carregada de gank**, que e onde o acoplamento e maior. **O descarte anda junto com a grandeza medida.**

Por isso toda leitura sai em tres e nao em duas:

| | o que e |
| --- | --- |
| **(a)** | N-CONTAGEM sobre todas as ancoras que ele avalia |
| **(b)** | N-CONTAGEM sobre **as mesmas ancoras** que N-ROTA alcanca |
| **(c)** | N-ROTA sobre essas mesmas ancoras |

**(b) dividido por (a) e efeito de POPULACAO. (c) dividido por (b) e o EFEITO DO NULO**, e so ele responde a pergunta. O IC95 de (c)/(b) sai por **bootstrap pareado nos mesmos clusters**, porque as duas leituras vem das mesmas ancoras nas mesmas partidas e boa parte da variancia e comum e se cancela na razao: ler a razao comparando dois IC marginais seria conservador a ponto de nao decidir nada.

**Medido em N = 800, T8:** POP = 0,784 e NULO = 0,883. Ou seja **dois tercos da queda ingenua eram troca de populacao**, e nao o nulo.

---

## 4. A regua que separa artefato de supercontrole, e ela e o PRE

Restava um problema, e ele e o mais serio da investigacao: **um nulo mais estrito derruba o lift mesmo quando nao ha artefato nenhum para remover.** Parear o parceiro pela contagem de gank naquela rota condiciona por uma grandeza que, **se o acoplamento for real, e em parte CONSEQUENCIA dele**: a rota que recebeu mais gank perdeu mais torre por causa dos ganks. O parceiro herda parte do proprio efeito, o nulo sobe e o lift cai. E a mesma conservadoria que o Bloco 2.2 da ancoragem ja declarou para o pareado por contagem, **amplificada**.

**A arvore base resolve isso, e por isso ela foi medida.** Em `4ede940` a rota do gank e sorteada **uniformemente** e a alavanca de concentracao **nao existe**. Nao ha, ali, concentracao alguma para o nulo novo remover. **Todo movimento que ele produzir no PRE e supercontrole puro.**

| medida | N = 800 (fixture do gate) | N = 2400 |
| --- | --- | --- |
| efeito do nulo em P1 no **PRE** | **0,960** [0,850; 1,110] | **0,849** [0,810; 0,892] |

**O supercontrole existe e e grande.** Em N = 2400 o nulo novo derruba P1 em 15 por cento numa arvore em que a rota do gank e uniforme. Qualquer leitura que atribuisse esses 15 por cento a "coincidencia induzida pela concentracao" estaria atribuindo ao motor um efeito do proprio estimador.

### O artefato de concentracao, isolado

**Artefato = efeito do nulo em T, dividido pelo efeito do nulo no PRE.**

Quatro replicas **disjuntas** em N = 800 (sementes 0 a 799, 800 a 1599, 1600 a 2399, 2400 a 3199), mais a leitura de observacao em N = 2400:

| amostra | artefato em **T1** | artefato em **T8** |
| --- | --- | --- |
| sementes 0 a 799 (fixture do gate) | 1,043 | 0,920 |
| sementes 800 a 1599 | 0,910 | 1,153 |
| sementes 1600 a 2399 | 0,935 | 1,026 |
| sementes 2400 a 3199 | 0,817 | 0,902 |
| N = 2400 (observacao) | 0,883 | 0,969 |
| **media das quatro replicas de banda** | **0,926** | **1,000** |

**As duas leituras que isto autoriza, e nenhuma alem delas:**

1. **Em T1, a temperatura mais CONCENTRADA, existe artefato de concentracao, e ele vale cerca de menos 7 por cento.** A preocupacao do desenvolvedor esta **confirmada em direcao e em mecanismo**, e refutada em tamanho: nao sao os 22 a 31 por cento da leitura ingenua.
2. **No ponto de operacao commitado, T8, o artefato e NULO** (media 1,000 em quatro replicas). A alavanca commitada esta na temperatura achatada, e ali ela quase nao concentra. **O 1,476 de T8 nao tem componente de instrumento por rota.**

O artefato tambem e **ordenado pela temperatura** na leitura de maior poder (N = 2400: 0,883 em T1, 0,935 em T2, 0,949 em T4, 0,968 em T8, 0,975 em T16). **Quanto mais concentrada a rota do gank, maior o artefato.** Se essa coluna saisse plana, a explicacao por concentracao estaria refutada e o efeito do nulo seria supercontrole puro. Ela nao sai plana, e essa ordenacao e a assinatura do mecanismo que o desenvolvedor descreveu.

---

## 5. O placebo de DIRECAO, que e a evidencia mais forte e nao paga preco de retencao

O nulo novo tem dois defeitos: perde ancora e supercontrola. **Existe um teste que nao tem nenhum dos dois**, e ele decide a pergunta de fundo com mais autoridade.

**A construcao:** a mesma ancora, a mesma rota, a mesma partida, o mesmo instante, com a janela virada **para tras**: um gank em `t_A` e seguido de torre em `(t_A, t_A + 60]`, ou precedido de torre em `[t_A - 60, t_A)`? A retencao e cheia (97 a 99 por cento das ancoras), a rota e a mesma por construcao, e o momento e o mesmo.

**O argumento:** coincidencia por "rota quente num momento quente" e **SIMETRICA no tempo**. Se um gank cai numa rota quente e as torres daquela rota tambem caem ali por causa comum, elas caem dos **dois lados** da ancora. Causa nao e simetrica.

| amostra | P1 para FRENTE | P1 para TRAS | razao |
| --- | --- | --- | --- |
| PRE, sementes 0 a 799 | 1,593 | 0,968 | **1,645** |
| T1, sementes 0 a 799 | 1,832 | 1,191 | **1,539** |
| T8, sementes 0 a 799 | 1,476 | 1,056 | **1,398** |
| T1, sementes 800 a 1599 | 1,629 | 0,925 | **1,761** |
| T1, sementes 1600 a 2399 | 1,723 | 1,069 | **1,611** |
| T1, sementes 2400 a 3199 | 1,592 | 1,259 | **1,264** |
| T8, N = 2400 | 1,566 | 0,799 | **1,961** |

**O excesso esta inteiramente na direcao para frente, em todas as amostras, em todas as temperaturas, e tambem no PRE.** A leitura para tras fica entre 0,71 e 1,26, ou seja em torno de 1,000, que e o que independencia diz. **A explicacao por coincidencia simetrica esta refutada, e o acoplamento de gank para torre e direcional.**

Este resultado tambem vale para o PRE, onde a alavanca nao existe: **o acoplamento de P1 nao foi fabricado pela onda 4, ele ja estava na engine e a onda 4 mexeu na margem dele.**

---

## 6. O QUE A INVESTIGACAO PEGOU DE LADO, E E MAIOR QUE O QUE ELA FOI RESOLVER

As quatro replicas disjuntas foram rodadas para separar artefato de supercontrole. Elas responderam isso, e responderam outra coisa que ninguem tinha perguntado.

**A razao de P1 contra o PRE, sob o estimador PRE-REGISTRADO, no N da banda, em quatro amostras disjuntas:**

| sementes | PRE | T1 | **razao** | piso 1,150 |
| --- | --- | --- | --- | --- |
| **0 a 799 (a fixture do gate)** | 1,593 | 1,832 | **1,150** | **FECHA, exatamente em cima** |
| 800 a 1599 | 1,711 | 1,629 | **0,952** | nao fecha |
| 1600 a 2399 | 1,472 | 1,723 | **1,170** | fecha |
| 2400 a 3199 | 1,783 | 1,592 | **0,893** | nao fecha |
| N = 2400 (as tres primeiras juntas) | 1,537 | 1,679 | **1,093** | nao fecha |

**Media das quatro replicas de banda: 1,041. Desvio padrao: 0,139.**

**O 1,150 exato da fixture do gate nao se reproduz.** Ele e uma amostra de uma distribuicao cuja media esta em 1,041, ou seja **abaixo do piso**, e cujo desvio padrao e grande o bastante para que o piso esteja a menos de um desvio da media. Duas das quatro replicas leem abaixo de 1,00.

**A causa nao e o nulo e nao e a alavanca: e PODER.** O IC95 de P1 na propria ancoragem ja era [1,256; 1,932], largura 0,676, sobre um ponto de 1,593. O piso relativo de 1,15 foi ancorado num **ponto** com essa largura, e depois julgado contra outro **ponto** com largura parecida. **A razao entre duas leituras imprecisas e mais imprecisa que as duas**, e nada no processo da fase mediu essa imprecisao ate agora, porque o gate assere sobre o ponto e imprime o IC ao lado.

**O que isto derruba, dito sem suavizar:** o registro de que **"a regiao de fechamento de P1 EXISTE mas do lado proibido pela regra de parada"** se apoia numa unica leitura que caiu exatamente no piso. Em replica disjunta essa leitura da 0,952, 1,170 e 0,893. **A afirmacao correta e mais fraca:** em T1 a razao medida foi compativel com o piso **em uma amostra de quatro**, e a evidencia disponivel **nao sustenta** que o piso seja alcancavel em T1. Nao sustenta o contrario tampouco: sustenta que **o instrumento nao tem poder para decidir isso no N do gate**.

**O que isto NAO derruba:**

- **Nao derruba P2.** P2 le 2,013 contra piso 1,951, e o IC95 dele e estreito ([1,921; 2,186] no PRE) porque a taxa base do par e alta (p_obs 0,619 contra 0,036 de P1). O problema de poder e **especifico de P1**, e a razao e a quantidade de ancoras com acerto, nao o desenho da banda.
- **Nao derruba a existencia do acoplamento de P1.** O placebo de direcao da secao 5 e robusto em todas as amostras. O que nao tem poder e a **razao contra o PRE**, nao a existencia.
- **Nao derruba nada de T8**, que e o ponto commitado: la P1 sempre esteve declarado como NAO FECHADO, e continua.

### 6.1 A causa esta no desenho do piso, e ela era verificavel ANTES da primeira medicao

**Isto nao e um azar de amostra: e uma falha de forma do criterio, e ela nao precisava de replica nenhuma para ser vista.** O piso relativo de P1 foi escrito como `lift_pos / lift_pre >= 1,15` e ancorado num PRE cujo **IC95 ja era [1,256; 1,932], largura 0,676 sobre um ponto de 1,593**. Depois ele foi mandado julgar um POS medido com a mesma largura. **A razao entre duas medicoes com essa largura nao tem poder para discriminar 15 por cento, por construcao.** O numero 0,676 estava impresso na propria tabela que congelou o piso, no Bloco 3.1 da ancoragem, no mesmo dia em que o piso foi escrito.

**A licao de forma, e ela vale para as cinco fases desta milestone:** um **piso relativo entre duas medicoes ruidosas precisa de calculo de poder ANTES de virar criterio**. Nenhuma das cinco fases fez esse calculo. As bandas de NIVEL escaparam porque comparam contra uma constante externa e nao contra outra medicao; o problema aparece quando os **dois** lados da comparacao sao medidos, que e o desenho dos pisos relativo e de preservacao desta fase.

**Por que P2 nao sofre do mesmo mal, e a explicacao e a taxa base.** P2 mede `p_obs = 0,619` sobre 1049 ancoras; P1 mede `p_obs = 0,036` sobre 2308. A variancia de uma proporcao perto de 0,6 com mil ancoras e pequena; perto de 0,036 ela e enorme em termos relativos. **O IC95 do PRE de P2 tem largura 0,265 contra 0,676 de P1.** O desenho do piso e o mesmo nos dois; o que difere e o poder que a populacao entrega, e isso nao foi conferido em nenhum dos dois.

### 6.2 Qual N seria necessario, estimado do desvio medido

Do desvio padrao medido nas quatro replicas (**0,1395** sobre a razao, em N = 800), e supondo que o erro cai com a raiz de N:

| objetivo | erro padrao alvo | **N necessario** | multiplo do N de hoje |
| --- | --- | --- | --- |
| 80 por cento de poder para distinguir razao 1,15 de 1,00 | 0,054 | **cerca de 5 400** | 6,8 vezes |
| IC95 da razao mais estreito que o proprio efeito exigido (meia largura 0,075) | 0,038 | **cerca de 10 600** | 13,3 vezes |
| IC95 da razao com meia largura 0,050 | 0,026 | **cerca de 23 900** | 29,9 vezes |

**A leitura honesta da tabela:** mesmo o objetivo mais modesto, que e apenas conseguir distinguir "a fase moveu 15 por cento" de "a fase nao moveu nada", pede **quase sete vezes** o N do gate. O objetivo de ter um intervalo que decida o veredito pede **treze vezes**.

**O custo nao e do gate de ritmo sozinho.** O Bloco 2.8 da ancoragem proibe ancorar banda em N diferente do N do gate que a avalia, e essa regra existe porque foi exatamente o desalinhamento que o plano 25B-01 teve de consertar. Subir o N para P1 obriga a re-ancorar **todas** as bandas que vivem no mesmo harness, e o precedente de disciplina empurra a mesma pergunta para **os sete gates**. **Isso e decisao de escopo e nao conserto de onda**, e por isso sai daqui como item diferido e nao como conserto.

### 6.3 A decisao do usuario sobre a temperatura NAO fica invalidada: fica REFORCADA

**Vale registrar porque a conclusao e contra-intuitiva.** A onda 5 recusou T1 e escolheu T8 pela **regra de parada** (mediana da primeira torre em 795 s contra o piso de 800 s), abrindo mao do unico ponto da grade que fechava P1. A recusa foi por **custo de margem**: T1 deixaria um unico tick de 15 s de folga, e a Fase 26 corta cerca de 40 por cento dos abates.

**Agora se sabe que aquele fechamento nem estava estabelecido.** A escolha conservadora foi feita **sem** essa informacao e sobreviveu a ela: quem escolheu T1 teria comprado, com toda a folga de duracao da fase, um fechamento que uma replica disjunta nao reproduz. **E o argumento a favor de preservar folga quando a evidencia e fina**, e ele fica registrado como tal e nao como sorte.

---

## 7. C1 sob o nulo novo, que era a outra metade da tarefa

A suspeita partiu de C1 depender da temperatura, entao C1 tinha de ser medido sob o nulo novo.

**Efeito do nulo (c/b) sobre C1, N = 2400:** PRE 1,022, T1 1,033, T2 1,009, T4 0,986, T8 0,999, T16 1,011.
**Em N = 800, fixture do gate:** PRE 0,998, T1 0,987, T2 1,041, T4 1,069, T8 1,081, T16 1,005.

**O nulo pareado por rota nao move C1.** Todas as leituras ficam entre 0,986 e 1,081, ou seja em torno de 1,000, e nenhuma delas explica a dependencia de C1 com a temperatura.

**A consequencia e um item que fica ABERTO com hipotese diferente.** A explicacao "o nulo nao controla por rota" esta **refutada para C1**. C1 e par de ROTA QUALQUER e a contagem pareada dele ja e um total; o espalhamento por rota, testado por N-ROTA-E, tambem nao o move de forma consistente. **A dependencia de C1 com a temperatura de foco do gank continua sem mecanismo identificado**, e este documento fecha uma hipotese sem abrir a substituta.

Fica registrado o que a medicao autoriza: a direcao de C1 continua **conservadora** (abaixo de 1,000 nas temperaturas concentradas), entao ele nao fabrica acoplamento, e por isso o alerta **nao invalida** nenhuma leitura de P1, P2 ou P3. E o que ja estava escrito na onda 3 e na onda 5, e continua sendo a leitura correta.

---

## 8. O veredito da tarefa, em quatro linhas

1. **O nulo pareado por contagem controlava por rota pelo lado do B e nao pelo lado do A.** O buraco existia e foi fechado por construcao.
2. **O artefato de concentracao existe, vale cerca de menos 7 por cento em T1 e e NULO no ponto de operacao commitado T8.** A leitura ingenua de menos 22 a menos 31 por cento e maioritariamente supercontrole do proprio nulo, provado medindo o nulo novo na arvore base onde a rota e uniforme.
3. **O acoplamento de P1 e direcional e nao coincidencia simetrica**, por placebo de direcao com retencao cheia, em todas as amostras e tambem no PRE.
4. **O achado que obriga decisao humana nao e este: e o da secao 6.** O 1,832 de T1 nao se reproduz em replica disjunta, e com ele nao se sustenta o registro de que a regiao de fechamento de P1 existe. A causa e falta de poder de P1 no N do gate, e ela e anterior a esta fase.

---

## 8.1 O PLACEBO DE DIRECAO como TECNICA reutilizavel, e nao como resultado desta fase

**Escrito como instrucao geral porque foi ele que decidiu, e nao o nulo mais estrito em que a investigacao apostou.**

> Para julgar se uma associacao temporal entre A e B e causal ou coincidencia por causa comum, meca o **mesmo par com a janela virada para tras**, na mesma ancora, na mesma rota, na mesma partida. Coincidencia por "contexto quente num momento quente" e **simetrica no tempo**; causa nao e. Se o excesso estiver so na direcao para frente, a explicacao por coincidencia esta refutada.

**Por que ele deve ser tentado ANTES de investir em nulo mais estrito**, e esta fase e o caso de teste:

| | placebo de direcao | nulo pareado mais estrito |
| --- | --- | --- |
| retencao de ancora | **cheia (97 a 99 por cento)** | 25 a 46 por cento |
| troca de populacao a controlar | **nenhuma** | severa, e correlacionada com a grandeza medida |
| supercontrole | **nenhum**: nao condiciona por nada | grande, e so mensuravel com uma arvore de controle |
| custo de construcao | inverter dois sinais de comparacao | um estimador novo mais a decomposicao de tres leituras |
| decidiu a pergunta? | **sim, em todas as amostras** | nao: precisou de arvore base para ser interpretado |

**O nulo estrito nao foi inutil**: foi ele que produziu o numero do artefato (menos 7 por cento em T1, nulo em T8). Mas ele so pode ser lido depois de duas correcoes que quase ninguem faria, e sem elas ele teria condenado o resultado da fase. **O placebo nao precisa de correcao nenhuma.** A ordem certa de investimento e placebo primeiro, nulo estrito depois e so se o placebo deixar duvida.

---

## 9. Onde cada numero pode ser reconferido

| assunto | arquivo |
| --- | --- |
| grade completa em N = 800, com os tres nulos e os tres resumos | `tmp/25C07-rota-800.txt` |
| grade completa em N = 2400 | `tmp/25C07-rota-2400.txt` |
| replicas disjuntas | `tmp/25C07-rota-s800.txt`, `tmp/25C07-rota-s1600.txt`, `tmp/25C07-rota-s2400.txt` |
| definicao dos nulos e a decomposicao populacao contra nulo | `tmp/25C07-rota.test.ts` |
| definicao do instrumento adotado, pisos e janela | `docs/diagnostics/25C-ancoragem.md` Bloco 2 |
| leitura PRE congelada | `docs/diagnostics/25C-ancoragem.md` Bloco 3.1 |
| grade de temperatura da onda 5 | `docs/diagnostics/25C-sweep.md` secao 3.8 |
