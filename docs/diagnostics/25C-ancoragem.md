# Fase 25C: procedencia da fase e a definicao do instrumento de acoplamento

**Data:** 2026-07-30
**Fase:** 25C-causalidade-entre-eventos
**Plano de origem:** 25C-01 (Task 1)
**Proposito, em uma linha:** gravar o commit base da fase em arquivo versionado, no primeiro commit dela, e escrever a definicao inteira do instrumento de acoplamento, com a janela e os tres pisos justificados, ANTES de qualquer numero novo ser medido.

**Instrumento antes de motor, pela quinta vez nesta milestone.** A Fase 23 construiu o gate antes de qualquer conserto, o plano 24-01 construiu o gate de assistencia antes da correcao do 24-02, o plano 25-01 tirou o retrato PRE antes de o canal absoluto existir e o plano 25B-01 mediu a ancoragem de dispersao antes das tres ondas de motor. O criterio 1 do roadmap desta fase escreve o padrao com todas as letras.

**Por que este documento vem antes dos numeros, e nao junto com eles.** Um piso escrito depois da medicao e indistinguivel, para quem le o repositorio no futuro, de um piso escolhido para caber no numero que saiu. Escrever a banda primeiro, em commit proprio, transforma "o criterio veio antes da medicao" de afirmacao em fato verificavel por `git show`. O precedente e o plano 25B-05, que fez exatamente isso e ficou auditavel.

---

## Bloco 1: procedencia

| o que | SHA | como foi obtido |
| --- | --- | --- |
| **commit base da Fase 25C** | `4ede940dea9ef161860170fa72dd752005fa20d3` (`4ede940`) | `git rev-parse HEAD` no Task 1 do plano 25C-01, **antes** do primeiro commit desta fase. Assunto: `docs(25C): planos executaveis da fase, instrumento antes de motor e sweep sobre o conjunto` |
| **commit da medicao da pesquisa** | `137587ade0` (`137587a`) | arvore em que `25C-RESEARCH.md` mediu os 24 pares, os tres estimadores e as sete alavancas. Assunto: `docs(25B-07): fecha a Fase 25B com o aceite aprovado e o criterio 3 em aberto` |

**Por que o commit base esta GRAVADO aqui, e nao deduzido por quem precisar dele.** A regra de achar o commit base de uma fase procurando o commit mais antigo com escopo da fase no assunto **ja quase produziu prova falsa duas vezes nesta milestone**, e o modo de falha e silencioso: quando o topo da arvore e um commit de roadmap ou de planejamento, a regra devolve **o proprio HEAD**, e a prova por diff da onda de fechamento passa **vazia**, comparando a arvore com ela mesma. Um plano que se apoie nessa prova conclui que nada mudou quando na verdade nao comparou nada.

**A armadilha estava armada neste exato momento.** O topo da arvore quando este documento foi escrito era `4ede940`, um commit de planejamento, e antes dele `f71943f`, um commit de correcao de roadmap. Os dois tem escopo `25C` no assunto e nenhum dos dois muda uma linha de motor. Deduzir a base por assunto devolveria um deles.

**Contrato para os planos seguintes desta fase:** os planos 25C-02 a 25C-07 leem o commit base **deste arquivo** e nao o deduzem de novo. A onda 7, que precisa provar por diff o criterio 5 do roadmap, e a principal consumidora desta linha.

### Regra de sanidade da base, escrita como instrucao executavel para a onda 7

O script de prova por diff da onda de fechamento (`tmp/verify-25C-diff.cjs`, no molde de `verify-25B-diff.cjs`) le o SHA acima e, **antes de qualquer comparacao**, confere:

```
blob de src/sim/engine.ts em 4ede940   !=   blob de src/sim/engine.ts em HEAD
```

Se os dois forem **iguais**, a base esta errada ou o motor nao mudou, e nos dois casos o script **FALHA** em vez de reportar sucesso. Uma prova por diff que passa vazia e pior que nenhuma prova, porque produz um relatorio verde afirmando o contrario do que mediu.

A conferencia precisa normalizar fim de linha nos dois lados: `core.autocrlf` esta em `true` neste repositorio, a arvore de trabalho tem CRLF e o objeto do git tem LF, entao comparacao por bytes crus ou por data mentiria. Isso ja e armadilha registrada no plano 25-07 e reusada em toda a Fase 25B.

### Conferencia obrigatoria: a arvore da pesquisa e a arvore base sao o mesmo motor

A secao 12 de `25C-RESEARCH.md` prova por hash de blob que `src/sim/` estava intacto ao fim da pesquisa. Esta conferencia fecha o outro lado: que **a arvore em que a pesquisa mediu e a arvore base desta fase tem o MESMO motor**, ou seja que a coluna BASE de todas as tabelas da pesquisa continua valendo como leitura PRE.

`git diff --stat 137587a..4ede940 -- src/sim/` devolve **vazio**, e blob a blob:

| arquivo | blob em `137587a` (pesquisa) | blob em `4ede940` (base) | veredito |
| --- | --- | --- | --- |
| `src/sim/engine.ts` | `667e1fd30909abd038dd366c79d122b1fb85bf2d` | `667e1fd3...` | IDENTICO |
| `src/sim/structures.ts` | `8209a2d81abc06dd4dee17eb973cd1d8698f0aa2` | `8209a2d8...` | IDENTICO |
| `src/sim/laneState.ts` | `e90417e3039223590d421866e18cdc2dae3aff5b` | `e90417e3...` | IDENTICO |
| `src/sim/selection.ts` | `23dcfdf79a9af13441bcf67993e7b59775ba432a` | `23dcfdf7...` | IDENTICO |
| `src/sim/combat.ts` | `0a271ad9d00bad36c650a2c5fd85ca5a5f2bbaa9` | `0a271ad9...` | IDENTICO |

Contagem canonica de chamadas ao gerador em `src/sim/`: **72**, nos dois commits.

**O que teria acontecido se NAO estivessem identicos, escrito para o caso de a conferencia ser refeita:** a coluna BASE de todas as tabelas da pesquisa estaria invalidada, a leitura PRE precisaria ser inteiramente remedida antes de virar ancoragem, e este plano teria PARADO e reportado. O documento de pesquisa escreve o mesmo na secao 19: *"valido enquanto `src/sim/` estiver em `137587a`"*.

**Mesmo com a conferencia verde, a leitura PRE que vira ancoragem NAO e a da pesquisa.** A pesquisa mediu com N = 2000 e janelas de 120 e 180 s. A ancoragem da onda 2 mede com **N = 800** e **W = 60 s**, que sao o N e a janela do gate. A razao esta no Bloco 2, item "a ancora e o N do gate".

---

## Bloco 2: a definicao do instrumento, escrita ANTES de qualquer numero novo

Tudo neste bloco e definicao e criterio. **Nenhum numero novo foi medido para escrever este bloco**, e os numeros da pesquisa que aparecem aqui estao rotulados com a origem e com o N em que foram medidos.

### 2.1 As definicoes, cada uma com a razao

| item | definicao | razao |
| --- | --- | --- |
| **ancora** | uma ocorrencia de A em `t_A`, numa partida de duracao `dur`, que satisfaz o filtro de lado e de rota do par, e que satisfaz `t_A + W <= dur` | sem o filtro de truncamento, ancoras perto do fim teriam janela recortada |
| **acerto** | existe pelo menos um B em `(t_A, t_A + W]` compativel com a ancora | a janela e **ABERTA em `t_A`**: evento no mesmo tick NAO conta. A engine emite varios eventos por tick com o mesmo `timeSec`, e coemissao no mesmo tick e **simultaneidade**, nao "um evento puxou o outro". O tick e 15 s (`matchState.ts:478`) |
| **`p_obs`** | acertos dividido por ancoras | |
| **`p_nulo`** | a mesma probabilidade sob o caso independente, pelo estimador PAREADO POR CONTAGEM (2.2) | |
| **lift** | `p_obs / p_nulo` | **lift 1,000 e independencia exata, e essa e a ancora teorica. Nenhum dado externo e necessario**, ao contrario de toda outra banda desta milestone |
| **truncamento simetrico** | so entram ancoras com `t_A + W <= dur` da propria partida, **e** a partida parceira tambem precisa de `dur >= t_A + W` | sem a simetria, a ancora teria janela inteira e o parceiro teria janela recortada, e o lift de fim de jogo ficaria deprimido por artefato |
| **estratificacao** | decil de duracao, dez estratos | controla partida longa ter mais de tudo |
| **parceiros por ancora** | 24 | reduz a variancia do nulo sem custo perceptivel de tempo |
| **unidade de bootstrap** | a **PARTIDA**, com 600 reamostras | ancoras da mesma partida sao correlacionadas; tratar cada ancora como independente estreitaria o IC artificialmente |
| **IC95 e p** | percentis 2,5 e 97,5 da distribuicao de lift reamostrado; p bilateral pela fracao de reamostras do lado errado de 1,000, dobrada e limitada a 1 | percentil por `percentile` de `scripts/stats.ts`, nunca reimplementado (DEC-04) |
| **rota** | so `top`, `mid` e `bot` contam como mesma rota; regiao (`river_top` e similares) **desqualifica** a ancora | o campo `lane` e uma uniao de `Lane` com `Region` |

### 2.2 O estimador do nulo e PARTE DO CRITERIO, e nao detalhe de implementacao

**Trocar o estimador troca o veredito da fase.** Tres estimadores do caso independente foram testados na pesquisa contra um corpus sintetico onde o lift verdadeiro e **1,000 por construcao**, e dois deles **erram o sinal**:

| estimador | como funciona | lift sob independencia VERDADEIRA (12 celulas, N sintetico = 5000) | veredito |
| --- | --- | --- | --- |
| **PAREADO POR CONTAGEM** | ancora avaliada contra os B de **outra** partida do mesmo decil de duracao, com o parceiro obrigado a ter a **mesma contagem** de B compativel com a ancora | **0,967 a 1,043**, e o IC95 cobre 1,000 em **12 de 12** | **ADOTADO** |
| CRUZADO simples | idem, sem o pareamento de contagem | **1,065 a 1,111**; o IC exclui 1,000 em **4 de 6** celulas | **REJEITADO: falso positivo em 4 de 6** |
| JITTER | desloca cada B por uma uniforme simetrica de amplitude quatro janelas, com reflexao na borda | **0,609 a 0,882**; o IC exclui 1,000 em **12 de 12** | **REJEITADO: falso negativo em 12 de 12** |

**Por que o jitter falha, e a licao vale para qualquer medicao de tempo nesta engine.** A e B vivem em fases de jogo diferentes: `gank` so recebe peso no early e mede 15,20 por cento das decisoes ali contra 0,00 por cento no mid e no late, enquanto a torre cai majoritariamente depois. Espalhar B por mais ou menos quatro janelas arrasta massa de torre tardia para dentro das janelas de gank precoce, o nulo sobe e o lift desaba. **Um estimador que erra o sinal sob independencia verdadeira nao e conservador: e errado.** Uma fase que escolhesse o jitter concluiria que a engine e anti-causal e gastaria ondas consertando o que nao esta quebrado.

**Consequencia para o codigo, e ela e obrigatoria:** os tres estimadores entram em `scripts/lift.ts` e o **teste** prova qual e o certo, contra corpus com independencia verdadeira por construcao. Nenhum comentario afirma; a assercao mede. Os dois recusados existem **apenas** para serem refutados pelo teste, e nenhum consumidor de veredito pode chama-los.

**Correcao obrigatoria de PAR REFLEXIVO, e ela e a diferenca entre 0,312 e 1,071.** Quando A e B compartilham tipo, na partida da ancora sobram (contagem menos 1) eventos capazes de cair na janela, porque a propria ancora esta em `t_A` e a janela e aberta ali; no parceiro sobram (contagem). O parceiro correto e o que tem **(contagem menos 1)**. Sem essa correcao, `gank depois de gank na mesma rota`, que e independente **por construcao** porque a rota do gank e hoje sorteada uniformemente, lia **0,312** em vez de 1,071.

**Vies residual declarado, e a direcao dele importa para a banda:** sob acoplamento verdadeiro forte, o pareado por contagem e **CONSERVADOR**, porque parte do proprio efeito aparece como contagem. Para um gate que asserta "existe acoplamento", subestimar e a direcao certa do erro. E por isso que o piso absoluto de 2.4 e 1,050 e nao 1,000.

### 2.3 A janela: 60 s para os tres pares pre-registrados

**W = 60 s** para P1, P2 e P3. As leituras de **120 s e 180 s** ficam ao lado no relatorio, **rotuladas como observacao**, e nao entram em banda nenhuma.

Tres motivos, os tres derivados da varredura de janela da pesquisa (N = 2000, tier EQUILIBRADO):

1. **O sinal e monotonicamente decrescente em W nos tres pares.** P1 vai de 1,946 em 30 s a 1,128 em 420 s; P2 de 2,191 a 1,198; P3 de 1,600 a 0,994. A janela curta e sempre a mais informativa.
2. **60 s coincide com `ACE_WINDOW_SEC = 60`**, a unica janela pos-evento que a engine ja possui. Isso faz o instrumento e o mecanismo falarem na mesma escala, o que importa porque a onda 4 vai ligar exatamente essa janela a decisao.
3. **Em 60 s a contagem de ancoras continua alta** (5907 para P1, 2615 para P2, 12408 para P3 em N = 2000), entao nao ha custo de poder.

**Por que as janelas da versao original do roadmap foram recusadas, e a recusa e por medicao.** A versao original pedia 3 min para gank e Barao e 2 min para luta e objetivo. Em **180 s** os tres pares ficam comprimidos (1,162, 1,691 e 1,024), ou seja e onde eles **menos** discriminam. E em **120 s** o par de luta ganha mede 1,081, praticamente em cima de 1,000, que e a pior escolha possivel para um gate: qualquer ruido cruza o limiar nas duas direcoes. A correcao ja esta no roadmap, registrada no commit `f71943f`.

**Controle positivo da janela, e ele valida o instrumento em vez de validar a engine.** O par `queda de torre depois de queda de torre na mesma rota` entra na varredura porque o freio de cascata da v2.0 tem constante conhecida de **180 s** (`CASCADE_N_LANE_SEC`), e o lift dele precisa **subir monotonicamente** com a janela (0,141 em 30 s ate 0,857 em 420 s na pesquisa). Se ele nao aparecer assim, **o instrumento esta errado, e nao a engine**.

### 2.4 Os tres pisos, cada um com a razao

Todo par asserido paga o **piso absoluto**. Alem dele, cada par paga **um** dos outros dois, conforme a fase pretenda move-lo ou preserva-lo.

#### Piso 1, absoluto de instrumento: **1,050**

```
lift >= 1,050  E  IC95 inferior > 1,050
```

**O 1,050 nao e escolha de gosto: e o menor multiplo de 0,005 estritamente acima do maior vies medido do estimador adotado sob independencia verdadeira, que e 1,043.**

**A armadilha que ele fecha, com o numero que a torna concreta:** na leitura de 180 s o par P3 media **1,081 com IC95 inferior em 1,047**, ou seja a **0,004** do teto do vies do proprio instrumento. Declarar acoplamento ali seria declarar o que o instrumento nao consegue distinguir do proprio erro. O criterio original do roadmap ("lift maior que 1 com IC que nao cruza 1") teria absolvido esse caso e teria nascido verde nos tres pares antes de a fase comecar, que e a definicao de gate vazio (DEC-02).

#### Piso 2, relativo contra a ancoragem PRE: **1,15**, para os pares que a fase MOVE

```
lift_pos / lift_pre >= 1,15
```

A leitura PRE e congelada na onda 2, em artefato versionado, com a fixture e o N do gate. Ela e a **unica** fonte legitima da banda. Mesma disciplina de `docs/diagnostics/25B-ancoragem.md`.

#### Piso 3, de preservacao: **0,95 vezes a leitura PRE**, para os pares que a fase NAO move de proposito

```
lift_pos >= 0,95 x lift_pre
```

**Ele existe porque o par de Barao caiu em quase toda alavanca testada na pesquisa** (1,702 para 1,595 no pior caso). Sem essa trava, a fase poderia comprar um par pagando com o outro sem que ninguem visse, e ainda assim reportar sucesso no par que ela declarou como alvo.

### 2.5 Quais pares a fase MOVE e quais ela PRESERVA

Isso precisa estar declarado aqui, e nao descoberto depois, porque e o que decide qual piso se aplica a qual par.

| par | definicao | a fase | pisos que paga |
| --- | --- | --- | --- |
| **P1** | `gank` depois de queda de torre, **mesmo lado, MESMA rota** | **MOVE** | absoluto 1,050 **e** relativo 1,15 |
| **P2** | `baron_taken` depois de queda de torre, mesmo lado | **PRESERVA** | absoluto 1,050 **e** preservacao 0,95 |
| **P3** | luta ganha depois de objetivo epico, mesmo lado | **MOVE** | absoluto 1,050 **e** relativo 1,15 |

**A definicao de "luta ganha" e um PROXY declarado.** Ela usa o conjunto de tipos que **so** `resolveTeamfight` emite (`ace`, `double_kill`, `triple_kill`, `quadra_kill`, `penta_kill`, `comeback_fight`), entao o marcador nao tem falso positivo. Ele tem falso negativo: uma teamfight cujo maior matador fez exatamente um abate emite um `kill` simples, indistinguivel de um `kill` de pickoff pela timeline. **A onda 2 mede esse residuo com marcador transitorio antes de congelar a definicao no gate**, e ate la a sonda imprime a definicao em uso no cabecalho do relatorio.

### 2.6 Os tres controles internos, que sao a validacao mais forte disponivel sem dado externo

Alem dos tres pares pre-registrados, o instrumento mede tres pares escolhidos porque **nao existe caminho mecanico entre A e B no codigo**:

| par de controle | por que nao deveria ter acoplamento |
| --- | --- |
| ~~`dragon_taken` depois de queda de torre, mesmo lado~~ **REFUTADO NA ONDA 2, ver 2.12** | ~~dragao nao entra em `force`, nem em peso de press, nem em `bestPressureLane`~~ verdadeiro mas INCOMPLETO |
| **dragao tomado SEM CONTESTACAO** depois de queda de torre, mesmo lado (substituto, onda 2) | o mesmo par com o unico caminho mecanico conhecido removido **por construcao**: sem contestacao nao ha teamfight, e sem teamfight nao ha efeito de `aliveCount` |
| `voidgrubs_taken` depois de queda de torre | `voidgrubs` entra em `force` com peso 0,04 por unidade, quase nada |
| `gank` depois de `gank` na MESMA rota | a rota e `randomLane(rng)`, uniforme: independente **por construcao** |

**Esperado: os tres leem 1,000 dentro do IC.** Qualquer um deles sair de 1,000 e **sinal de alerta do INSTRUMENTO**, e nao achado do motor. A onda 4 mexe na rota do gank, e a partir dali o terceiro controle deixa de ser controle: ele passa a ter caminho mecanico, e isso precisa ser dito no relatorio daquela onda em vez de descoberto depois.

**O primeiro controle desta lista disparou na onda 1 e a onda 2 o resolveu por medicao.** O bloco 2.12 traz a separacao inteira. A licao curta: um controle nao vale pela afirmacao de que nao ha caminho, vale pelo mapeamento COMPLETO do caminho, e o mapeamento da onda 1 parou no termo de forca sem seguir a luta que acompanha o objetivo contestado.

### 2.7 Multiplas comparacoes

- Os **tres pares pre-registrados** sao reportados **SEM correcao**, porque hipotese pre-registrada nao paga o preco de busca. O pre-registro e este documento, commitado antes de qualquer mudanca de motor.
- Os **pares exploratorios** pagam **Benjamini-Hochberg com q = 0,05** sobre o p bilateral do bootstrap, no nulo pareado. Bonferroni foi descartado: com 18 exploratorios ele custaria poder demais para um conjunto de testes claramente correlacionados entre si.
- **A tabela reporta os DOIS para os pre-registrados**, para que ninguem precise deduzir qual regra foi usada.

### 2.8 A ancora e o N do GATE, e nao o N da pesquisa

**N de ANCORAGEM = 800**, igual ao N do gate de ritmo (`scripts/calibrate-pace.ts`), com a fixture copiada verbatim do tier EQUILIBRADO (75 contra 75, semente igual ao indice). **Esta e a unica leitura que pode virar banda.**

**N de OBSERVACAO = 2000**, mais poder, reportado ao lado e explicitamente rotulado como observacao. Ele existe porque os pares exploratorios e a varredura de janela precisam de poder que 800 nao da.

**Ancorar uma banda em numero medido com outro N assina um erro sistematico de origem desconhecida**, e esse foi exatamente o desalinhamento que o plano 25B-01 existiu para corrigir: os sete coeficientes ja conhecidos vinham de `npm run diagnose` com N = 1500 enquanto a banda ia viver com N = 800. **Todos os numeros de N = 2000 desta fase, inclusive os que aparecem neste documento, sao observacao rotulada e nunca fonte de banda.**

### 2.9 A aridade e medida por TICK, nunca por partida

Armadilha encontrada na pesquisa e registrada aqui para nao ser redescoberta: **ligar estado ENCURTA a partida**, e portanto reduz o total de draws mesmo quando o consumo por tick sobe. Medido: `Z3b` consome **mais 2,29 por cento de draws por TICK** e ao mesmo tempo mostra sinal positivo no total por partida por acaso, enquanto `Z4a press 4,0` mostra **menos 80,7 draws por partida** e **menos 5,30 por cento por tick**. **As duas leituras contam historias opostas sobre a mesma mudanca.**

Regra desta fase: **reportar sempre draws por TICK**, com o total por partida ao lado, rotulado como confundido pela duracao. O contador de draws vive **inteiramente** no arquivo da sonda: `src/sim/` nao recebe instrumentacao nenhuma.

### 2.10 O risco de P3, declarado AGORA e nao quando ele aparecer

**A pesquisa mediu sete alavancas e a melhor delas move P3 em mais 6,2 por cento** (1,057 para 1,122, com `Z5 ace 1,5` isolada), contra o piso relativo de **mais 15 por cento**. E o efeito **satura e depois inverte**: aumentar a forca PIORA (1,114 em 2,0 e 1,094 em 4,0), e sobre o conjunto recomendado `Z5b(4,0)` derruba P3 de 1,090 para 1,060 e P1 de 1,473 para 1,319. As alavancas competem pela mesma massa de peso normalizada, entao somar forca nao soma efeito.

**O que a fase vai fazer:** medir a fronteira dos dois lados, com grade sobre o conjunto, e leva-la ao **checkpoint de decisao da onda 5**. O precedente e o criterio 3 da Fase 25B, que fechou com banda em aberto, fronteira medida e regiao provada vazia por grade de nove tetos, em vez de afrouxar a banda.

**Isto esta escrito aqui, antes do primeiro numero desta fase, exatamente para que o desfecho de P3 nao possa ser apresentado como surpresa nem como escolha retro-justificada.** Se P3 fechar, o registro mostra que ele fechou contra uma previsao pessimista escrita antes. Se nao fechar, o registro mostra que a fase sabia e mediu, em vez de descobrir no fim.

### 2.11 O que este bloco deliberadamente NAO usa

- **Coeficiente de bimodalidade, em lugar nenhum desta fase.** A matriz de lift e razao de probabilidades com IC por bootstrap, que nao satura. BC sobre razao de inteiros pequenos e instrumento saturado, aviso herdado da Fase 25B: ele ficou acima do limiar nos quatro estados do contrafactual, inclusive no pre-fase.
- **Nenhuma dependencia externa.** A matriz inteira, incluindo bootstrap por cluster e Benjamini-Hochberg, cabe sobre `scripts/stats.ts`. Um bump de minor version que mudasse a interpolacao de percentil moveria bandas em silencio (INST-06, DEC-04).
- **Nenhuma referencia externa de pro play.** A ancora deste eixo e o proprio 1,000, e isso e uma vantagem rara em relacao a todas as outras bandas da milestone.

### 2.12 O alerta C1 da onda 1, separado nas tres leituras POR MEDICAO

**Este bloco e o unico da fase que foi escrito DEPOIS de um numero, e a razao esta declarada:** ele nao define criterio nenhum, ele investiga um alerta que o proprio criterio produziu. Nenhum piso, nenhuma janela e nenhuma banda mudou por causa dele. O que mudou foi a DEFINICAO DE UM CONTROLE, e a definicao de controle nao e alvo: e instrumento.

**O alerta.** A onda 1 mediu o controle interno `dragon_taken` depois de queda de torre em **1,086 com IC95 [1,004; 1,176]**, em W = 60 s e N = 800. Um controle tem de ler 1,000. O IC excluia 1,000 por 0,004. A onda 1 listou tres leituras possiveis e nao decidiu nenhuma, declarando a separacao como **bloqueante para qualquer banda**.

**Por que isso podia derrubar o criterio inteiro, e por que a separacao veio antes de tudo.** Na pesquisa, o mesmo controle lia **1,018 em W = 180 s**. Em W = 60 s leu 1,086. Se o vies do estimador CRESCESSE quando a janela encurta, o piso absoluto de 1,050, calibrado contra um vies de 1,043 medido em outras janelas, ficaria **abaixo do vies**, e o criterio 2 passaria por vies puro em vez de por acoplamento. A escolha de 60 s foi feita porque a varredura mostrou que 60 discrimina melhor o SINAL; podia ser que discriminasse melhor o sinal **e** o ruido.

**Comando, artefato e custo:** `npx vitest run -c tmp/vitest.c1-diag.config.ts`, relatorio bruto em `tmp/c1-diagnostico.txt`, 69,5 s. Nenhuma linha de `src/sim/` foi tocada: o diagnostico le a linha do tempo publica.

#### Leitura (a): vies do estimador em janela curta. **REFUTADA.**

Varredura de W sobre corpus sintetico com **lift verdadeiro 1,000 por construcao** (A e B como processos de Poisson independentes, com multiplicador de taxa por partida e lado COMPARTILHADO, que e o confundidor central). Todo desvio de 1,000 medido ali e vies do estimador.

Dois perfis temporais de A, e o segundo existe porque o primeiro nao representa C1:

| corte | W = 30 | W = 60 | W = 90 | W = 120 | W = 180 |
| --- | --- | --- | --- | --- | --- |
| perfil GANK, rota qualquer | 1,026 | **1,010** | 1,006 | 1,011 | 0,991 |
| perfil GANK, mesma rota | 1,043 | **1,006** | 1,034 | 1,037 | 1,024 |
| perfil DRAGAO, rota qualquer | 0,959 | **0,973** | 0,978 | 0,986 | 0,987 |
| perfil DRAGAO, mesma rota | 0,983 | **0,972** | 0,968 | 0,975 | 1,011 |

**O vies NAO cresce quando a janela encurta.** O maior valor de toda a varredura e **1,043**, e ele esta em W = 30 s, no perfil de gank. Ou seja e exatamente o **mesmo 1,043** que a pesquisa ja tinha medido e contra o qual o piso absoluto de 1,050 foi calibrado. Em W = 60 s, que e a janela da banda, o maior vies medido e **1,010**.

**E no perfil temporal que interessa a C1 o vies e NEGATIVO.** Dragao e evento de mid e late, quase uniforme depois dos 5 minutos, e nesse perfil o estimador le **0,972 e 0,973** em W = 60 s: ele SUBESTIMA. Para um gate que asserta "existe acoplamento", subestimar e a direcao certa do erro.

**Consequencia para o piso absoluto: ele fica CONFIRMADO em 1,050, e nao re-derivado.** O maior vies medido em W = 60 s (1,010) esta 0,040 abaixo dele, e o maior vies de toda a varredura (1,043) esta 0,007 abaixo. Nenhuma correcao de instrumento e necessaria, e nenhuma foi feita: mexer no piso aqui seria afrouxar sem causa medida.

#### Leitura (b): caminho mecanico nao mapeado. **CONFIRMADA. E esta e a explicacao.**

O mapeamento da onda 1 parou no termo de forca da camada estrutural, e la a afirmacao e verdadeira: dragao nao entra em `force`, nem em peso de pressao, nem em `bestPressureLane`. **O caminho nao passa por ali.**

**Caminho 1, a teamfight que acompanha o dragao contestado.** `resolveContestedObjective` (`engine.ts:775`) chama `resolveTeamfight` **antes** de tomar o objetivo, e essa luta mata jogadores dos dois lados. Dali `aliveCount` alimenta duas coisas na camada estrutural: `shouldPushStructure` devolve true direto quando o inimigo fica com dois ou menos vivos (`structures.ts:156`), e `numbersAdvantage`, que vale 1 mais 0,15 por aliado extra vivo (`structures.ts:885-889`), **multiplica** o dano estrutural (`structures.ts:412`). Dragao contestado vence luta, inimigo fica em desvantagem numerica, torre cai dentro da janela de respawn.

**Caminho 2, mais fraco e nao isolado aqui.** `bumpMomentum` no caminho de objetivo (`engine.ts:784` e `:800`) entra em `computeWinProbability` junto com `dragonDiff` (`winprob.ts:79` e `:86`); `state.winProbUser` e recalculado depois de cada evento (`engine.ts:371`); e `chooseIntent` le essa probabilidade de volta para derivar `behind` e `ahead` (`engine.ts:477-480`), que mudam o peso das intencoes de press e de siege. Este caminho afeta **todos** os pares da fase e nao so os de dragao, e por isso nao serve para escolher controle.

**A medicao que isola o caminho 1, e ela sai da linha do tempo PUBLICA, sem instrumentacao nenhuma.** Os dois ramos emitem tickers diferentes: `resolveUncontestedObjective` produz "garantiu ... sem contestacao" e `resolveContestedObjective` produz "venceu a luta e garantiu".

| corte | N | ancoras | p_obs | lift | IC95 | p |
| --- | --- | --- | --- | --- | --- | --- |
| `dragon_taken` agregado, W = 60 | 800 | 3501 | 0,176 | **1,086** | [1,004; 1,176] | 0,047 |
| dragao **COM luta**, W = 60 | 800 | 1090 | 0,232 | **1,311** | [1,161; 1,474] | 0,002 |
| dragao **SEM contestacao**, W = 60 | 800 | 2411 | 0,150 | **0,973** | [0,881; 1,059] | 0,513 |
| dragao COM luta, W = 60 | 2000 | 2935 | 0,222 | 1,235 | [1,160; 1,318] | 0,002 |
| dragao SEM contestacao, W = 60 | 2000 | 6604 | 0,159 | 0,986 | [0,936; 1,032] | 0,587 |
| dragao COM luta, W = 60 | 4000 | 5918 | 0,223 | 1,219 | [1,161; 1,270] | 0,002 |
| dragao SEM contestacao, W = 60 | 4000 | 13440 | 0,153 | 0,959 | [0,929; 0,992] | 0,020 |

**O acoplamento esta INTEIRAMENTE no subconjunto contestado.** O agregado de 1,086 e a mistura de 1,311 em 31 por cento das ancoras com 0,973 nas outras 69. O mesmo padrao aparece em 120 s (1,150 contra 0,961) e em 180 s (1,101 contra 0,974), o que descarta coincidencia de janela.

#### Leitura (c): ruido amostral. **REFUTADA.**

| corte | ancoras | lift | IC95 |
| --- | --- | --- | --- |
| C1 agregado, N = 800, sementes 0 a 799 | 3501 | 1,086 | [1,004; 1,176] |
| C1 agregado, N = 800, sementes 800 a 1599 (**replica disjunta**) | 3555 | 1,070 | [1,000; 1,149] |
| C1 agregado, N = 2000 | 9539 | 1,068 | [1,018; 1,112] |
| C1 agregado, N = 4000 | 19358 | 1,046 | [1,016; 1,078] |

**Com N maior o IC nao passa a cobrir 1,000: ele APERTA em torno de 1,05.** Uma replica independente do mesmo tamanho reproduz a leitura (1,070 contra 1,086), o que ja mostra que nao e sorte de amostra. O ponto desce um pouco com N porque a composicao da mistura muda, nao porque converge para 1,000. Fica registrado que o **N em que a leitura estabiliza e 2000**, com IC de largura 0,094 e ponto em 1,068.

#### O desfecho: qual leitura e, e o que muda

**E a leitura (b), com o numero 1,311 contra 0,973.** O controle C1 da onda 1 nao era controle: existia caminho mecanico entre A e B e o mapeamento nao o pegou.

**O controle substituto e o subconjunto SEM CONTESTACAO**, e a escolha nao e de conveniencia. Ele e o **mesmo par** com o unico caminho mecanico conhecido removido POR CONSTRUCAO, e por isso a diferenca entre os dois subconjuntos **e** o tamanho do caminho, medida e auditavel na mesma pagina. Trocar por um par de outra familia esconderia o achado; este o deixa impresso. O subconjunto contestado passa a sair no relatorio como **observado (C1x)**, nunca como controle e nunca como banda.

**O residuo do substituto esta declarado e nao escondido.** Em N = 4000 ele le 0,959 com IC [0,929; 0,992], que exclui 1,000 **por baixo**. Isso esta dentro do envelope de vies proprio do estimador medido em (a) para o perfil temporal de dragao (0,972 e 0,973 em W = 60 s), e a direcao e a conservadora. No N do gate, que e 800, o IC cobre 1,000 com folga.

**Fragilidade declarada, com a mitigacao escrita.** O classificador le TICKER, e ticker e texto. Se uma onda futura reescrever aquela frase, o controle passaria a medir outra coisa em silencio. Por isso a sonda e o gate sao obrigados a conferir a identidade `solo mais luta igual ao total` a cada rodada e a reprovar a leitura quando uma das classes sair vazia: a falha vira ALTA em vez de silenciosa.

**O que NAO mudou por causa deste bloco, e a lista importa:** a janela continua 60 s, o piso absoluto continua 1,050, o piso relativo continua 1,15, o piso de preservacao continua 0,95, e os tres pares pre-registrados continuam identicos. A regua nao se mexeu; o que se mexeu foi um instrumento de aferimento da regua.

### 2.13 OS SEIS NUMEROS DE ALVO, instanciados e escritos ANTES de o motor mudar

Ate aqui o Bloco 2 tinha os pisos em forma de REGRA. Esta subsecao os instancia em NUMERO contra a leitura PRE congelada do Bloco 3, e **nenhuma onda seguinte pode reescreve-los**. Ela e escrita na onda 2, com o motor ainda intocado e com `src/sim/` provado byte a byte identico ao commit base.

| par | a fase | **PRE em 60 s** | piso do par (relativo ou de preservacao) | piso absoluto | **PISO EFETIVO** |
| --- | --- | --- | --- | --- | --- |
| **P1** gank, depois torre MESMA rota | **MOVE** | **1,593** | 1,15 vezes o PRE = **1,832** | 1,050 | **1,832** |
| **P2** Barao, depois torre | **PRESERVA** | **2,054** | 0,95 vezes o PRE = **1,951** | 1,050 | **1,951** |
| **P3** luta ganha, depois epico | **MOVE** | **1,307** | 1,15 vezes o PRE = **1,503** | 1,050 | **1,503** |

**Os seis numeros sao 1,593 / 1,832, 2,054 / 1,951 e 1,307 / 1,503.** O piso efetivo e o maior entre o piso do par e o piso absoluto, e nos tres casos o piso do par domina: o piso absoluto de 1,050 nao esta amarrando nenhum dos tres hoje, ele existe como fundo contra o vies do instrumento.

**Cada banda paga TAMBEM um segundo assert:** o **IC95 inferior** precisa ser estritamente maior que 1,050. Uma banda que avaliasse so o ponto aceitaria um lift alto com IC largo cruzando o vies do instrumento, que e exatamente o modo de falha que o piso absoluto existe para fechar.

#### A DISTANCIA ATE ELES, declarada agora e sem suavizar

Um alvo escrito antes vale porque nao pode ser movido. Declarar agora que ele pode nao ser alcancado e o que separa medir de torcer. Todas as razoes abaixo vem da secao 6.1 de `25C-RESEARCH.md`, medidas com a mesma fixture e o mesmo N, e estao expressas como **RAZAO contra a base da propria pesquisa**, que e a unica forma honesta de traduzir entre janelas.

| par | razao EXIGIDA | melhor razao MEDIDA na metade barata | onde foi medida | valor projetado sobre o PRE de 60 s | **distancia ate o piso** |
| --- | --- | --- | --- | --- | --- |
| **P1** | **1,150** | **1,268** (conjunto `Z1+Z2+Z3b+Z5(1,0)`: 1,487 sobre 1,173) | W = 180 s | 2,020 | **mais 0,188, FECHA** |
| **P2** | **0,950** (preservacao) | **0,959** (pior caso do conjunto recomendado: 1,633 sobre 1,702) | W = 180 s | 1,970 | **mais 0,019, PASSA RASPANDO** |
| **P3** | **1,150** | **1,062** (`Z5 ace 1,5` isolada: 1,122 sobre 1,057) | W = 120 s | 1,388 | **menos 0,115, NAO FECHA** |

**As tres leituras, cada uma com o que ela realmente autoriza dizer:**

- **P3 nao fecha com a metade barata, e isso esta medido em sete alavancas e nao suposto.** A melhor alavanca isolada move 6,2 por cento contra os 15 exigidos, e o efeito **satura e depois inverte**: forca 2,0 da 1,114 e forca 4,0 da 1,094, e sobre o conjunto recomendado P3 fica em razao 1,047, ainda pior que a alavanca isolada. As alavancas competem pela mesma massa de peso normalizada, entao somar forca nao soma efeito. **A distancia e NEGATIVA em 0,115 e esta escrita aqui antes do primeiro conserto.** O desfecho de P3 vai ao checkpoint de decisao da onda 5, com a fronteira medida dos dois lados, no molde do criterio 3 da Fase 25B, que fechou com banda em aberto e regiao provada vazia em vez de afrouxar.
- **P2 passa raspando, e "raspando" e o numero e nao uma impressao:** a margem e de 0,009 em razao (0,959 contra 0,950 exigidos). Qualquer alavanca que custe mais 1 por cento em P2 quebra a preservacao. **P2 e o par mais fragil da fase apesar de ser o unico que ja esta acoplado**, e essa inversao precisa estar dita: o risco dele nao e de nao alcancar, e de ser gasto para pagar P1.
- **P1 fecha com folga na projecao, MAS a projecao vem de outra janela e isso e um buraco declarado.** A razao de 1,268 foi medida em W = 180 s. A pesquisa mediu W = 60 s para P1 em apenas tres pontos, e nenhum deles e o conjunto recomendado: `Z2` isolada da 1,755 sobre 1,593, ou seja razao **1,102**, que fica **abaixo** dos 1,15 exigidos; `Z4b numbers 0,5` da 1,848, razao **1,160**, e e uma alavanca que a pesquisa recomenda **nao** usar. **Ou seja: na janela em que a banda vive, nenhuma alavanca RECOMENDADA foi medida alcancando o piso de P1 sozinha, e o conjunto nunca foi medido ali.** A projecao de 1,268 supoe que a razao se transporta de 180 s para 60 s, e a unica evidencia disponivel sobre esse transporte (`Z2`, 1,115 em 180 s contra 1,102 em 60 s) sugere que ela **encolhe um pouco**. A onda 5 tem de medir o conjunto em W = 60 s antes de qualquer afirmacao sobre P1 fechar.

**Nenhum destes numeros e desculpa antecipada.** Se P3 fechar, o registro mostra que fechou contra uma previsao pessimista escrita antes do primeiro conserto. Se nao fechar, o registro mostra que a fase sabia, mediu e disse, em vez de descobrir no fim.

---

## Bloco 3: a leitura PRE CONGELADA

**Congelada na onda 2 (plano 25C-02, Task 2), no motor do commit base `4ede940`, com `src/sim/` provado byte a byte identico ao commitado.**

**As duas leituras, e a distincao entre elas e o que impede o erro do plano 25B-01:**

| leitura | N | artefato | papel |
| --- | --- | --- | --- |
| **ANCORAGEM** | **800**, igual ao do gate de ritmo | `tmp/lift-pre-800.txt` | **UNICA FONTE DE BANDA** |
| observacao | 2000 | `tmp/lift-pre-2000.txt` | mais poder para exploratorios e varredura. **NUNCA fonte** |

Fixture: tier EQUILIBRADO 75 contra 75, copia verbatim de `scripts/calibrate-pace.ts`, semente igual ao indice da partida, uma instancia de `mulberry32` por partida. Comando: `LIFT_N=800 LIFT_TAG=pre-800 npm run probe:lift`.

**Populacao medida (N = 800):** duracao p5 1320 s, p50 1680 s, p95 2640 s, media 1799,2 s (29,99 min).

### 3.1 Os tres pares PRE-REGISTRADOS, em W = 60 s

Reportados **sem correcao de multiplas comparacoes**, porque hipotese pre-registrada nao paga o preco de busca. O `p` com Benjamini-Hochberg aparece ao lado mesmo assim, para que ninguem precise deduzir qual regra foi usada.

| par | W | ancoras | p_obs | p_nulo | **lift** | IC95 | p bilateral | p sob BH |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **P1** gank, depois torre MESMA rota | **60** | 2308 | 0,036 | 0,022 | **1,593** | [1,256; 1,932] | 0,002 | 0,002 (nao aplicavel: pre-registrado) |
| **P2** Barao, depois torre | **60** | 1049 | 0,619 | 0,302 | **2,054** | [1,921; 2,186] | 0,002 | 0,002 (nao aplicavel: pre-registrado) |
| **P3** luta ganha, depois epico | **60** | 4991 | 0,213 | 0,158 | **1,307** | [1,216; 1,400] | 0,002 | 0,002 (nao aplicavel: pre-registrado) |

**Estas tres linhas em W = 60 s sao A FONTE DAS TRES BANDAS.** As de 120 e 180 s abaixo sao observacao e nenhuma delas vira banda:

| par | W = 120 | IC95 | W = 180 | IC95 |
| --- | --- | --- | --- | --- |
| P1 | 1,226 | [1,056; 1,392] | 1,173 | [1,056; 1,300] |
| P2 | 1,882 | [1,789; 1,979] | 1,702 | [1,640; 1,770] |
| P3 | 1,057 | [0,999; 1,114] | 1,038 | [0,982; 1,089] |

**A leitura de OBSERVACAO em N = 2000, ao lado e nunca como fonte:** P1 1,563 [1,379; 1,771], P2 1,928 [1,859; 1,999], P3 1,318 [1,263; 1,370] em W = 60 s. As tres batem com a leitura de ancoragem dentro do IC, o que mostra que o N do gate nao esta escolhendo um numero de sorte, mas **os numeros que valem sao os de N = 800**, pela razao do Bloco 2.8.

**Reproducao da pesquisa, numero por numero:** P1 em 180 s mede 1,173 contra 1,173 da pesquisa; P2 em 180 s mede 1,702 contra 1,702; P3 em 120 s mede 1,057 contra 1,057; P1 em 60 s mede 1,593 contra 1,593. Quatro reproducoes exatas de uma medicao independente.

### 3.2 Os CONTROLES INTERNOS, e este bloco e a validacao do instrumento

**Criterio de parada, escrito na onda 1 e antes desta medicao:** se qualquer um dos tres tiver IC95 que **nao cubra 1,000**, o instrumento esta sob suspeita e a fase PARA em vez de congelar uma ancoragem cuja procedencia nao se sustenta.

| controle interno | ancoras | **lift** | IC95 | cobre 1,000 | veredito |
| --- | --- | --- | --- | --- | --- |
| **C1** dragao SEM CONTESTACAO, depois torre | 2652 | **0,973** | [0,881; 1,059] | **sim** | PASSA |
| **C2** voidgrubs, depois torre | 1599 | **1,130** | [0,774; 1,532] | **sim** | PASSA |
| **C3** gank, depois gank MESMA rota | 2308 | **1,103** | [0,896; 1,313] | **sim** | PASSA |

**Os tres cobrem 1,000 na leitura de ancoragem. O criterio de parada nao disparou e a fase segue.**

**C1 nao e o mesmo controle da onda 1, e a troca esta medida no Bloco 2.12.** O da onda 1 era `dragon_taken` inteiro e lia 1,086 [1,004; 1,176], IC que exclui 1,000. A separacao das tres leituras achou **caminho mecanico** na teamfight que acompanha o dragao contestado, e o controle passou a ser o subconjunto sem contestacao. O subconjunto contestado sai como **observado**, nunca como controle:

| observado, com caminho mecanico | ancoras | lift | IC95 |
| --- | --- | --- | --- |
| **C1x** dragao COM LUTA, depois torre | 1213 | **1,311** | [1,161; 1,474] |

A distancia entre 1,311 e 0,973 **e** o tamanho do caminho, e ela fica impressa no relatorio do gate em vez de virar nota de rodape.

**Um segundo residuo, declarado e NAO resolvido nesta onda.** Na leitura de OBSERVACAO (N = 2000), C3 le **1,125 com IC95 [1,006; 1,251]**, que exclui 1,000 por 0,006. Na leitura de ancoragem (N = 800) ele cobre 1,000 e por isso o criterio de parada nao disparou, mas registrar so o numero que passa seria escolher o N depois de ver o resultado.

- **O que a construcao de C3 garante e o que ela NAO garante.** A rota do gank e `randomLane(rng)` (`engine.ts:1744`), uniforme sobre tres rotas e independente da intencao escolhida: essa parte da afirmacao esta conferida no codigo e continua valendo. O que a construcao **nao** garante e independencia no TEMPO. O peso de `gank` so entra em `chooseIntent` quando `gankThreat` passa de 55 (`engine.ts:583`), e `gankThreat` depende de `laneLaningPower`, que varia dentro da partida. Ou seja os ganks de uma partida compartilham uma **propensao latente que varia no tempo**.
- **Isso e CONFUNDIMENTO e nao caminho, e a diferenca importa.** Nao existe aresta de gank para gank; existe uma causa comum. O nulo pareado por contagem controla a contagem por partida, e nao o INSTANTE em que aquela latente cruza o limiar em cada partida. O estimador esta reportando associacao real induzida por causa comum, que e coisa diferente do vies medido em corpus sintetico.
- **A consequencia para o piso absoluto, dita sem suavizar:** o piso de 1,050 foi calibrado contra o **vies do estimador** (maximo medido 1,043, e 1,010 em W = 60 s, Bloco 2.12), e ele **nao cobre** associacao por latente compartilhada da ordem de 1,125. Nenhum numero desta fase muda por isso agora, porque os tres pares pre-registrados medem 1,593, 2,054 e 1,307, todos muito acima dessa escala. Fica como **item aberto com dono na onda 7**: remedir C3 em N = 2000 depois das ondas de motor e, se o residuo persistir, dizer no fechamento que o piso absoluto protege contra vies de instrumento e nao contra confundimento por latente.
- **Vigilancia ja registrada:** a onda 4 mexe na rota do gank, e a partir dali C3 **deixa de ser controle** por outro motivo, porque passa a existir caminho mecanico. As duas coisas precisam ser ditas juntas no relatorio daquela onda.

### 3.3 O CONTROLE POSITIVO: o freio de cascata aparece na escala de tempo certa

Um instrumento que so passa em controle negativo pode estar simplesmente cego. O controle positivo pergunta o contrario: **um mecanismo de constante conhecida no codigo aparece na varredura, na escala certa?**

O par E8 (`queda de torre, depois queda de torre na MESMA rota`) e freado pelo `CASCADE_N_LANE_SEC` da v2.0, cuja constante e **180 s**. O lift dele tem de **subir monotonicamente** com a janela, com o joelho perto de 180 s.

| W (s) | 30 | 60 | 90 | 120 | **180** | 240 | 300 | 420 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **E8 lift** | 0,194 | 0,282 | 0,346 | 0,440 | **0,802** | 1,005 | 1,074 | 1,102 |
| IC95 inf | 0,148 | 0,240 | 0,307 | 0,404 | 0,765 | 0,979 | 1,051 | 1,083 |

**Monotonico nas oito janelas, e o maior salto isolado e justamente o de 120 para 180 s (mais 0,362, contra mais 0,094 no passo anterior).** O instrumento enxerga um mecanismo conhecido do codigo na escala de tempo em que ele foi escrito. Se essa forma nao aparecesse, o problema seria do instrumento e nao da engine, e nenhuma conclusao sobre o motor poderia ser tirada.

Para escala, a mesma varredura nos dois pares que a fase MOVE, e ela mostra por que 60 s foi escolhida:

| W (s) | 30 | 60 | 90 | 120 | 180 | 240 | 300 | 420 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **P1** | 2,231 | **1,593** | 1,461 | 1,226 | 1,173 | 1,207 | 1,147 | 1,120 |
| **P3** | 1,551 | **1,307** | 1,157 | 1,057 | 1,038 | 0,997 | 1,006 | 0,991 |

### 3.4 Os pares EXPLORATORIOS, com Benjamini-Hochberg a q = 0,05

**Bloco separado de proposito: exploratorio nunca se mistura com pre-registrado.** Leitura de ancoragem, N = 800, W = 60 s.

| id | par | ancoras | lift | IC95 | p | BH q = 0,05 |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | gank, depois torre, rota qualquer | 2308 | 1,570 | [1,359; 1,801] | 0,002 | **rejeitado** |
| E2 | gank, depois placa MESMA rota | 2308 | 1,337 | [1,262; 1,410] | 0,002 | **rejeitado** |
| E3 | gank, depois tower_low MESMA rota | 2308 | 0,956 | [0,762; 1,170] | 0,730 | nao rejeitado |
| E4 | luta ganha, depois torre | 4991 | 1,940 | [1,856; 2,026] | 0,002 | **rejeitado** |
| E5 | luta ganha, depois Barao | 4991 | 1,947 | [1,786; 2,128] | 0,002 | **rejeitado** |
| E6 | Arauto, depois torre | 800 | 0,917 | [0,795; 1,059] | 0,277 | nao rejeitado |
| E7 | dragao, depois luta ganha | 3865 | 0,726 | [0,625; 0,841] | 0,002 | **rejeitado** |
| E8 | torre, depois torre MESMA rota | 6578 | 0,282 | [0,240; 0,321] | 0,002 | **rejeitado** |
| E9 | Barao, depois inibidor | 1049 | 2,009 | [1,825; 2,184] | 0,002 | **rejeitado** |
| E10 | Barao, depois nexus_exposed | 1049 | 0,923 | [0,682; 1,202] | 0,547 | nao rejeitado |
| E11 | abate qualquer, depois torre | 13085 | 1,542 | [1,484; 1,599] | 0,002 | **rejeitado** |
| E12 | placa, depois torre MESMA rota | 9020 | 0,977 | [0,842; 1,106] | 0,640 | nao rejeitado |
| E13 | luta ganha, depois luta ganha | 4991 | 0,399 | [0,343; 0,458] | 0,002 | **rejeitado** |
| E14 | gank, depois luta ganha | 2308 | 1,334 | [1,058; 1,659] | 0,013 | **rejeitado** |
| E15 | torre, depois objetivo epico | 6578 | 0,852 | [0,790; 0,914] | 0,002 | **rejeitado** |

**Rejeicoes por BH: 11 de 15** (E1, E2, E4, E5, E7, E8, E9, E11, E13, E14, E15). Nao rejeitados: E3, E6, E10, E12.

**A leitura que interessa a fase, e ela nao vira banda nenhuma:** quatro dos onze rejeitados apontam para BAIXO (E7 0,726, E8 0,282, E13 0,399, E15 0,852), ou seja a engine tem **anti-acoplamento** medido em quatro relacoes. E8 e E13 sao freios explicitos do codigo e portanto esperados. E7 (`dragao, depois luta ganha` em 0,726) e E15 (`torre, depois objetivo epico` em 0,852) nao tem freio declarado, e sao **material para as ondas 3 a 5** e nao para banda desta onda: transformar um exploratorio em banda no mesmo documento que o descobriu seria escolher a hipotese depois de ver o dado.

## Bloco 4: o RESIDUO DO PROXY DE LUTA GANHA, medido antes de a definicao ser congelada

**Medido na onda 2 (plano 25C-02, Task 1), com marcador transitorio em `resolveTeamfight` e restauracao provada por hash de blob dos cinco arquivos.** Relatorio completo: `tmp/proxy-residuo.txt`. Definicao congelada: `scripts/lift.ts`, constante `LUTA_GANHA`.

**A ORDEM IMPORTA E ESTA REGISTRADA:** o criterio de decisao com limiar numerico foi escrito no arquivo **antes** de a instrumentacao existir, e as duas candidatas de reconstrucao foram declaradas **antes** de qualquer uma ser medida. P3 e o par de maior risco da fase, e congelar a regua dele depois de ver o resultado seria exatamente o vicio que esta fase existe para evitar.

### 4.1 A cobertura, medida por LUTA e nunca por evento

A unidade certa e a luta: o proxy existe para marcar uma **ocorrencia** de luta ganha, e uma luta emite varios eventos. Contar por evento responderia outra pergunta.

| grandeza | por partida |
| --- | --- |
| lutas no resolvedor de teamfight | **8,126** |
| lutas que o proxy **captura** | 4,716 |
| lutas que o proxy **perde** | 3,410 |
| das quais silenciosas (nenhum evento emitido) | 0,000 |
| eventos do proxy emitidos | 6,571 |
| **FRACAO DE COBERTURA** | **0,5804** |

Origem dos abates individuais, que dimensiona a ambiguidade declarada no Bloco 2.5: **8,150** por partida vem do resolvedor de teamfight e **5,884** vem de outra origem (pickoff, gank, execucao).

### 4.2 O lift de P3 sob as tres definicoes, em W = 60 s e N = 800

| definicao | ancoras | p_obs | **lift** | IC95 |
| --- | --- | --- | --- | --- |
| **D1** proxy de hoje (ace, multikill, comeback_fight) | 4435 | 0,213 | **1,307** | [1,216; 1,400] |
| **D2** completa, uma ancora por luta e por LADO | 11264 | 0,128 | 0,891 | [0,856; 0,923] |
| **D3** completa, uma ancora por luta, so no LADO VENCEDOR | 5618 | 0,184 | **1,212** | [1,154; 1,278] |

**D2 esta fora da disputa por razao SEMANTICA e nao numerica:** ela poe ancora no lado perdedor tambem, entao mede "houve luta" e nao "luta GANHA". Usar D2 trocaria a grandeza do criterio 2. A definicao completa da grandeza certa e D3.

**Desvio medido: |D3 menos D1| = 0,095**, acima do limiar de 0,050 escrito antes. O criterio disparou.

### 4.3 As duas candidatas sem instrumentacao, declaradas antes de medidas, e as duas refutadas

| candidata | lutas por partida | lift | IC95 | desvio de lift | desvio de contagem | veredito |
| --- | --- | --- | --- | --- | --- | --- |
| verdade (D3) | 8,126 | 1,212 | [1,154; 1,278] | | | |
| **R1** tick com 2 ou mais abates | 1,269 | 1,561 | [1,359; 1,772] | 0,349 | 84,4 por cento | **NAO REPRODUZ** |
| **R2** R1 unido com os tipos do proxy | 4,963 | 1,330 | [1,246; 1,414] | 0,118 | 38,9 por cento | **NAO REPRODUZ** |

As duas falham nos **dois** criterios, nao em um so. **A causa e estrutural e nao de calibragem:** a engine emite 8,150 abates do resolvedor distribuidos em 8,126 lutas, ou seja **a luta tipica desta engine emite UM abate so**, e um abate solitario num tick e indistinguivel de um pickoff pela linha do tempo publica.

**O que R2 acerta, e isso limita o tamanho do problema:** quando R2 acha uma luta, ela acerta o lado vencedor em **100,0 por cento** dos casos (3970 de 3970 ticks com exatamente uma luta). O residuo e problema de **recall** e nunca de precisao.

### 4.4 A decisao, aplicando a regra escrita antes

**O proxy fica congelado como esta, e o desvio de 0,095 entra aqui como INCERTEZA DECLARADA da banda de P3.**

**A direcao do vies esta identificada e nao e acidente:** o proxy so ve a luta que produziu multikill ou ace, ou seja a luta **decisiva**, que e justamente a que converte em objetivo. Ele e uma amostra enviesada **para cima** das lutas ganhas.

| piso de P3 | afetado? | como |
| --- | --- | --- |
| **relativo** (1,15 vezes o PRE) | **nao em primeira ordem** | PRE e POS usam o MESMO proxy, e um vies estavel se cancela na razao |
| **absoluto** (1,050) | **sim, na direcao PERMISSIVA** | um lift de proxy acima de 1,050 pode corresponder a um lift verdadeiro menor. Folga medida hoje: 1,212 contra 1,050, ou seja 0,162 |

**O que sobreviveria ao cancelamento e uma MUDANCA do vies**, e as ondas 3 a 5 podem produzi-la: qualquer alavanca que mude a distribuicao de baixas por luta muda a fracao de lutas que emitem multikill e portanto muda a composicao do proxy. **A onda 7 tem de remedir a cobertura de 0,5804 e reportar o deslocamento**, e essa obrigacao fica escrita aqui e nao inferida depois.

**Por que a definicao nao foi trocada por D3, dito por extenso para nao parecer omissao:** a restricao dura do Task 1 e que a definicao final seja computavel a partir da linha do tempo PUBLICA. D3 so existe com marcador dentro de `src/sim/`, e instrumentacao permanente no motor para alimentar um gate seria mudanca de **estrutura** e nao de valor, fora do escopo desta fase. Entre um gate com definicao imperfeita e incerteza medida e declarada, e um gate perfeito que exige o motor carregar instrumentacao de teste, a fase escolhe o primeiro e escreve o numero da imperfeicao.

## Bloco 5: o RETRATO DE ARIDADE E DE DECISAO PRE

Insumo direto da onda 3 (que leva o caminho morto a zero) e da onda 7 (que prova o invariante). Leitura de ancoragem, N = 800.

### 5.1 Aridade, medida POR TICK

| grandeza | media | mediana | papel |
| --- | --- | --- | --- |
| **draws por TICK** | **4,9991** | **5,0000** | **LEITURA DE VEREDITO** |
| draws por PARTIDA | 609,8 | 557,0 | **CONFUNDIDO PELA DURACAO** |
| ticks por partida | 119,9 | 112,0 | |

**A armadilha, repetida aqui porque ela ja enganou uma medicao nesta milestone:** ligar estado a decisao **encurta** a partida e portanto reduz o total de draws mesmo quando o consumo por tick sobe. Medido na pesquisa: `Z3b` consome mais 2,29 por cento por TICK e ao mesmo tempo mostra sinal positivo no total por partida por acaso, enquanto `Z4a press 4,0` mostra menos 80,7 draws por partida e menos 5,30 por cento por tick. **As duas leituras contam historias opostas sobre a mesma mudanca.** A leitura de veredito desta fase e sempre por tick.

O contador vive inteiramente no arquivo da sonda, embrulhando o gerador no ponto de chamada. **`src/sim/` nao recebe instrumentacao nenhuma**, e a contagem canonica de sitios de `rng(` segue em **72**.

### 5.2 Ticks silenciosos, e a parte da causa que a sonda NAO consegue ver

**Fracao de ticks que passam sem emitir evento nenhum: media 0,5958, mediana 0,5962.**

**Este e o TOTAL e nao a parcela, e a distincao e o ponto inteiro desta subsecao.** A causa do silencio de cada tick nao e observavel de fora. Um tick mudo pode ser um **caminho morto** (`cross_map` e `defend_base` recebem peso e nao tem ramo em `resolveInteraction`), pode ser o gate `force <= 0.18` fazendo curto-circuito, ou pode ser uma decisao legitima que nao produz evento visivel. Separar as tres exige instrumentacao dentro de `src/sim/`, que esta onda proibe.

**A pesquisa da fase mediu 5,357 por cento de ticks silenciosos POR CAMINHO MORTO**, com motor instrumentado e restaurado por hash de blob, e a onda 3 leva esse numero a **zero POR CONSTRUCAO**, tirando o peso das duas intencoes.

**E aqui esta a instrucao que a onda 3 e a onda 7 tem de seguir, escrita agora para nao ser inventada depois:** a parte da causa que nao e observavel de fora **sera provada por CONSTRUCAO e nunca por contagem indireta**. Ou seja a prova de que o caminho morto foi a zero e que **as duas intencoes deixaram de receber peso**, verificavel por leitura de codigo e por assercao sobre a tabela de pesos, e nao uma queda medida nesta fracao de 0,5958. Essa fracao vai se mover por varios motivos ao mesmo tempo nas ondas 3 a 5, e atribuir o movimento dela ao caminho morto seria atribuicao causal sem base.

### 5.3 A share por tipo de evento

| tipo | total | por partida | share |
| --- | --- | --- | --- |
| plate_taken | 9020 | 11,275 | 0,1659 |
| tower_low | 8643 | 10,804 | 0,1590 |
| tower_destroyed | 6371 | 7,964 | 0,1172 |
| shutdown | 6032 | 7,540 | 0,1110 |
| kill | 4395 | 5,494 | 0,0809 |
| dragon_taken | 3967 | 4,959 | 0,0730 |
| double_kill | 2848 | 3,560 | 0,0524 |
| gank | 2308 | 2,885 | 0,0425 |
| voidgrubs_taken | 1599 | 1,999 | 0,0294 |
| ace | 1548 | 1,935 | 0,0285 |
| inhibitor_destroyed | 1271 | 1,589 | 0,0234 |
| baron_taken | 1121 | 1,401 | 0,0206 |
| first_blood | 800 | 1,000 | 0,0147 |
| herald_taken | 800 | 1,000 | 0,0147 |
| nexus_exposed | 800 | 1,000 | 0,0147 |
| gg | 800 | 1,000 | 0,0147 |
| triple_kill | 762 | 0,953 | 0,0140 |
| first_tower | 587 | 0,734 | 0,0108 |
| elder_taken | 247 | 0,309 | 0,0045 |

**A distribuicao de INTENCAO nao aparece aqui, e a ausencia esta declarada em vez de estimada.** Intencao e estado interno da decisao e nunca chega a linha do tempo. O que a linha do tempo mostra e o tipo de evento **emitido**, que e o que sai acima.

## Bloco 6: as tres bandas de acoplamento implantadas

**Implantadas na onda 2 (plano 25C-02, Task 3) em `scripts/calibrate-pace.ts`, por `checkBand`, todas de dois lados, todas na lista agregada de `expectBands`, com `source` apontando para o Bloco 3 deste documento e `owner` na Fase 25C.**

Sao **seis linhas de banda** e nao tres: cada par paga a banda do VALOR e mais o assert proprio do **IC95 inferior contra o piso absoluto**. Uma banda que avaliasse so o ponto aceitaria um lift alto com IC largo cruzando o vies do instrumento, que e exatamente o modo de falha que o piso absoluto existe para fechar.

**Desfecho medido na rodada de implantacao:**

| linha de banda | valor | banda | nasce |
| --- | --- | --- | --- |
| **P1** valor | 1,593 | [1,832; 2,250] | **VERMELHA** (estourou o piso) |
| **P2** valor | 2,054 | [1,951; 2,250] | verde |
| **P3** valor | 1,307 | [1,503; 1,750] | **VERMELHA** (estourou o piso) |
| P1 IC95 inferior | 1,256 | [1,050; 2,250] | verde |
| P2 IC95 inferior | 1,921 | [1,050; 2,250] | verde |
| P3 IC95 inferior | 1,216 | [1,050; 1,750] | verde |

**As duas bandas dos pares que a fase MOVE nascem vermelhas, e isso e desenho.** O motor ainda nao mudou, e banda que nasce verde sobre engine nao consertada e banda frouxa (DEC-02). O vermelho de P1 e de P3 **e** a lista de trabalho das ondas 3 a 5.

**P2 nasce VERDE, e isso e ESTRUTURAL e nao banda frouxa.** O plano desta onda escreveu que "as tres nascem vermelhas"; medido, isso e impossivel para P2 e a razao e aritmetica, nao de calibragem. P2 e banda de **preservacao**: o piso e 0,95 vezes o PRE e o valor medido no PRE e o proprio PRE, logo a razao no PRE e exatamente 1,000 e ela esta dentro da banda por construcao. Faze-la nascer vermelha exigiria piso acima do PRE, ou seja exigiria que a fase **movesse** um par que ela declarou que iria **preservar**, o que contradiz o Bloco 2.5. **P2 e uma ARMADILHA e nao uma meta:** ela fica verde ate que alguma onda estrague o par, e e exatamente ai que ela serve. A margem medida na pesquisa e de **0,009** (razao 0,959 do conjunto recomendado contra os 0,950 exigidos), o que faz de P2 **o par mais fragil da fase apesar de ser o unico que ja esta acoplado**.

**Os tres asserts de IC95 inferior tambem nascem verdes, pela mesma logica.** O piso absoluto de 1,050 e **fundo** contra o vies do instrumento e nao alvo de conserto. Os tres pares ja leem acima dele hoje (1,256, 1,921 e 1,216), e o valor deles e impedir que uma rodada futura declare acoplamento com IC largo cruzando o proprio erro do estimador.

**Nenhuma banda pre-existente mudou de piso, de teto ou de cor.** Conferido por diff do conjunto de rotulos com status entre a rodada anterior e esta: as unicas linhas novas sao as seis de acoplamento, e a contagem passou de 22 verdes e 14 vermelhas para 26 verdes e 16 vermelhas, ou seja exatamente as quatro verdes e as duas vermelhas acrescentadas.

**O gate reproduz a ancoragem numero por numero**, o que prova que ele e a sonda medem a mesma coisa: 1,593, 2,054 e 1,307, identicos ao Bloco 3.1. Os tres controles internos e o observado C1x saem no relatorio do gate como **alarme de instrumento**, na mesma pagina em que sai o veredito.

**Comando que avalia:** `npm run calibrate:pace`. Os seis numeros de alvo estao no Bloco 2.13.

---

## Bloco 7: o que este documento NAO faz

- **Nenhum numero novo foi medido para escreve-lo.** Todo numero citado aqui vem de `25C-RESEARCH.md`, com o N de origem declarado ao lado, e nenhum deles e fonte de banda.
- **Nenhuma banda foi implantada.** As tres bandas de acoplamento sao a onda 2.
- **Nenhuma linha de `src/sim/` foi tocada.** `git diff --quiet HEAD -- src/sim` passa, e a contagem canonica de chamadas ao gerador segue em **72**.
- **Nenhuma dependencia foi acrescentada e nenhum snapshot foi regenerado.**
- **A sonda desta onda nao asserta nada** e nao entra na cadeia de sete gates de `scripts/calibrate-all.mjs`.
