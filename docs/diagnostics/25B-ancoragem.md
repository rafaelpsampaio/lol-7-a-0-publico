# Fase 25B: a tabela de ancoragem de dispersao e forma, medida no motor pre-Fase-25

**Data:** 2026-07-30
**Fase:** 25B-forma-da-distribuicao-estrutural
**Plano de origem:** 25B-01 (Task 2 e Task 3)
**Proposito, em uma linha:** registrar a referencia contra a qual todo numero de dispersao e de forma desta fase sera lido, medida no motor pre-Fase-25 com o mesmo harness, a mesma fixture e o mesmo N do gate que vai receber a banda, e escolher o teto da banda por criterio declarado antes dos numeros novos.

**Comando de medicao de todo numero deste documento:** `npm run probe:shape` (sonda de observacao pura, `scripts/probe-shape.ts`, dois tiers, N igual a 800 por tier, semente igual ao indice da partida). A sonda nao contem assercao nenhuma e nao entra na cadeia de `npm run calibrate:all`.

**O problema de ancoragem que este documento resolve, e ele nao e detalhe.** D-25-07 entrega sete coeficientes de variacao do baseline congelado da Fase 24 e diz, com todas as letras, que `torres totais`, `torres por minuto` e `ouro por minuto` nao constam do relatorio com bloco estatistico e precisam ser medidos na onda 1. Ha um segundo desalinhamento, mais silencioso: os sete valores conhecidos vem de `npm run diagnose`, Cenario A, N igual a 1500, enquanto a banda vai viver em `scripts/calibrate-pace.ts`, tier EQUILIBRADO, N igual a 800. Ancorar uma banda medida num harness com numeros medidos noutro assina um erro sistematico de origem desconhecida na primeira casa decimal. **A solucao aplicada aqui foi reconstruir o estado pre-Fase-25 e medi-lo com o proprio instrumento desta fase.**

---

## Bloco 1: procedencia

| o que | SHA | como foi obtido |
| --- | --- | --- |
| **commit base da Fase 25B** | `87218663e17a08bae5952de4ed8529b55c112e3a` (`8721866`) | `git rev-parse HEAD` no Task 2 do plano 25B-01, **antes** do primeiro commit desta fase. Assunto: `roadmap: insere a Fase 25C, causalidade entre eventos` |
| **commit base da Fase 25** | `a24ea230301d88c363e32b762a39f58746dd7abd` (`a24ea23`) | pai de `0f6fae9`, o commit mais antigo com escopo da Fase 25. Assunto: `docs: relatorios de verificacao das fases 23 e 24` |

**Por que o commit base da Fase 25B esta gravado aqui, e nao deduzido por quem precisar dele.** A regra de achar o commit base de uma fase procurando o commit mais antigo com escopo no assunto **ja falhou duas vezes nesta milestone**, e o modo de falha e silencioso: quando o topo da arvore e um commit de roadmap sem escopo de fase, a regra devolve **o proprio HEAD**, e a prova por diff dos planos seguintes passa **vazia** comparando a arvore com ela mesma. Um plano que se apoie nessa prova conclui que nada mudou quando na verdade nao comparou nada.

**Contrato para os planos seguintes desta fase:** os planos 25B-02 a 25B-07 leem o commit base **deste arquivo** e nao o deduzem de novo. A onda 7, que precisa provar por diff o criterio 5 do roadmap, e a principal consumidora desta linha.

**A sanidade do commit base da Fase 25** ja tinha sido conferida no plano 25-08 (o blob de `src/sim/structures.ts` naquele commit e identico ao do commit que criou os planos da fase) e foi conferida de novo aqui pela forma do diff: `git diff --name-status a24ea23..HEAD -- src/sim/` devolve **cinco arquivos, todos com estado M**, ou seja nenhum arquivo nasceu nem sumiu em `src/sim/` durante a Fase 25. Essa conferencia e obrigatoria antes de reconstruir, porque `git checkout` de um caminho **nao apaga** arquivo que so existe no lado novo: com um arquivo nascido na fase, a reconstrucao ficaria hibrida em silencio.

### Como a reconstrucao foi feita, e como a restauracao foi provada

A reconstrucao foi **por commit e nao por edicao a mao**: `git checkout a24ea23 -- src/sim/`. Isso reproduz o motor pre-Fase-25 **exato**, e nao o estado D aproximado do contrafactual da secao 7 de `25-sweep.md`, que manteve os quatro guardas de freio cross-lane do plano 25-04 (custo medido de cerca de 1,6 por cento de duracao).

A restauracao foi `git checkout HEAD -- src/sim/`, e a prova **nao** foi so `git status`. Neste repositorio `core.autocrlf` esta em `true` e o `git status` marca por estado do arquivo, entao um arquivo recem reescrito pode aparecer vermelho com conteudo byte a byte identico, armadilha ja registrada no plano 25-07. A prova usada aqui e o **hash do blob do arquivo da arvore de trabalho contra o hash commitado**, arquivo por arquivo:

| arquivo | hash do blob, arvore de trabalho e HEAD |
| --- | --- |
| `src/sim/structures.ts` | `1bee99e49fa1fcc2774ec9fd2230b10aacba871c` |
| `src/sim/engine.ts` | `667e1fd30909abd038dd366c79d122b1fb85bf2d` |
| `src/sim/structures.test.ts` | `d68d4bda4d75e990da1c7bdae83fc294d99d71ac` |
| `src/sim/engineWiring.test.ts` | `d3428d38b844fe77e6035f5aae3eddb925cb355b` |
| `src/sim/__snapshots__/structures.test.ts.snap` | `bf7cb133f6795ef5d618cd76dd4435dc1953a69a` |

O hash de `src/sim/structures.ts` e **o mesmo** citado como prova de restauracao na secao 7 de `docs/diagnostics/25-sweep.md`, o que encadeia esta restauracao com a anterior. Alem disso: `git status --porcelain src/sim` vazio, `git diff --quiet HEAD -- src/sim` passou, `git diff --cached` vazio, a contagem canonica de chamadas ao gerador em `src/sim/` de volta em **72**, e `src/sim/structures.test.ts` verde em **52 de 52**.

---

## Bloco 2: a tabela de ancoragem

Tier **EQUILIBRADO** (75 contra 75), N igual a 800, semente igual ao indice, mesma fixture nos dois estados. Coeficiente de variacao e o desvio **populacional** dividido pela media, calculado por `mean` e `stdev` de `scripts/stats.ts`.

Veredito pelo corte ja aprovado em D-25-07: **COLAPSO** quando a razao hoje sobre pre-fase e menor ou igual a **0,75**; **AUMENTO** quando maior ou igual a **1,25**; **preservada** entre os dois.

| metrica | CV pre-Fase-25 (medido aqui) | CV congelado, baseline da Fase 24 | desvio relativo | CV hoje | razao hoje sobre pre-fase | veredito |
| --- | --- | --- | --- | --- | --- | --- |
| duracao | 0,1596 | 0,1599 | -0,19 por cento | 0,2386 | **1,495** | AUMENTO |
| abates totais | 0,2680 | 0,2731 | -1,87 por cento | 0,4330 | **1,616** | AUMENTO |
| torres do vencedor | 0,2803 | 0,2802 | +0,04 por cento | 0,0568 | **0,203** | **COLAPSO** |
| torres do perdedor | 0,5624 | 0,5567 | +1,02 por cento | 0,9734 | **1,731** | AUMENTO |
| **torres totais** | **0,3015** | **medido aqui pela primeira vez** | n/a | 0,2139 | **0,709** | **COLAPSO** |
| **torres por minuto** | **0,2103** | **medido aqui pela primeira vez** | n/a | 0,1060 | **0,504** | **COLAPSO** |
| primeira torre | 0,2539 | 0,2545 | -0,24 por cento | 0,1378 | **0,543** | **COLAPSO** |
| ouro do vencedor | 0,1952 | 0,1969 | -0,86 por cento | 0,2796 | **1,432** | AUMENTO |
| ouro do perdedor | 0,2326 | 0,2359 | -1,40 por cento | 0,3148 | **1,353** | AUMENTO |
| **ouro por minuto por time** | **0,0774** | **medido aqui pela primeira vez** | n/a | 0,0828 | 1,070 | preservada |

**Placar: 4 COLAPSO, 5 AUMENTO, 1 preservada.**

**As duas derivadas sao calculadas POR PARTIDA e nunca como razao de medias.** `torres por minuto` e as torres totais daquela partida divididas pela duracao daquela partida, e `ouro por minuto` e a media dos dois times daquela partida dividida pela duracao daquela partida. Coeficiente de variacao de uma razao de medias **nao existe**: a razao de medias e um unico numero, sem desvio. Para haver dispersao e preciso haver uma serie.

**`razao de torres` NAO esta nesta tabela, e a ausencia e deliberada.** Ela e indefinida quando o perdedor termina com zero torres, o que hoje descarta **22,9 por cento** da amostra, e o descarte **nao e aleatorio**: ele remove justamente os extremos. Coeficiente de variacao sobre uma amostra truncada assim mede o truncamento, nao a dispersao. A razao continua sendo o instrumento certo para **nivel** (e a banda de nivel dela segue em `calibrate-pace.ts`), e este documento so a recusa para **forma e dispersao**. Fonte: bloco de aviso de instrumento de `docs/diagnostics/25-sweep.md`.

### As duas descobertas que esta tabela entrega e que nenhuma medicao anterior podia ver

**1. `torres totais` e `torres por minuto` COLAPSARAM, e ninguem sabia.** Elas colapsaram porque nao havia baseline para elas: D-25-07 registrou explicitamente que os dois valores nao constavam do relatorio de diagnose com bloco estatistico. Este documento acabou de medi-los, e os dois estao abaixo do piso 0,75 (0,709 e 0,504). **`torres por minuto` e uma das bandas de NIVEL que a Fase 25 conquistou** (0,326 hoje, dentro de [0,300; 0,450]): ela e o caso de manual do modo de falha que esta fase existe para pegar, com a banda de nivel verde e a distribuicao encolhida pela metade.

**2. O placar de colapso da fase e MAIOR do que os dois casos ja conhecidos.** D-25-07 achou dois colapsos (torres do vencedor e primeira torre). Medindo com o harness certo e com as tres metricas que faltavam, sao **quatro**. As duas novas nao aparecem como surpresa em relacao ao mecanismo ja atribuido: o canal absoluto encosta o vencedor no teto do contador, o que aperta tambem o total e a taxa.

**A quinta linha, sem coeficiente de variacao: a dinamica.** E proporcao agregada, entao ela nao tem dispersao por partida e entra na onda 2 como banda sobre o **valor**.

| classificacao | pre-Fase-25 (medido aqui) | baseline congelado da Fase 24 | hoje | movimento |
| --- | --- | --- | --- | --- |
| stomp | 9,3 por cento | 9,1 por cento | **26,0 por cento** | quase tres vezes |
| equilibrado | 25,6 por cento | 24,5 por cento | 42,5 por cento | mais 66 por cento |
| **comeback** | **65,1 por cento** | **66,5 por cento** | **31,5 por cento** | **caiu para menos da metade** |

Os tres valores reconstruidos batem com o baseline congelado dentro de 2,1 por cento relativo, o que e uma **oitava ancora** de validacao alem das sete da secao seguinte, e ela vale registrar porque a fracao de comeback e o proxy mais direto do core value declarado em `PROJECT.md` linha 9.

---

## Bloco 3: a validacao da reconstrucao

**A tolerancia foi declarada ANTES da medicao dos tres numeros novos, no Task 2 do plano: desvio relativo de ate 12 por cento em cada um dos sete coeficientes ja congelados.**

A tolerancia e larga de proposito, e a razao esta escrita: os sete valores congelados vem do painel amplo com **N igual a 1500** e a reconstrucao mede com **N igual a 800** na mesma fixture 75 contra 75, entao parte de qualquer desvio e amostral e nao de reconstrucao.

**Criterio de parada, declarado junto com a tolerancia:** se **dois ou mais** dos sete ficassem fora, a reconstrucao NAO estaria validada, os tres coeficientes novos NAO poderiam ser usados como ancora e o plano pararia e reportaria. Se exatamente um ficasse fora, o desvio seria registrado nominalmente com a hipotese de causa e a banda correspondente entraria na onda 2 marcada como provisoria.

| metrica | CV congelado (N=1500) | CV reconstruido (N=800) | desvio relativo | veredito contra 12 por cento |
| --- | --- | --- | --- | --- |
| duracao | 0,1599 | 0,1596 | **-0,19 por cento** | DENTRO |
| abates totais | 0,2731 | 0,2680 | **-1,87 por cento** | DENTRO |
| primeira torre | 0,2545 | 0,2539 | **-0,24 por cento** | DENTRO |
| torres do vencedor | 0,2802 | 0,2803 | **+0,04 por cento** | DENTRO |
| torres do perdedor | 0,5567 | 0,5624 | **+1,02 por cento** | DENTRO |
| ouro do vencedor | 0,1969 | 0,1952 | **-0,86 por cento** | DENTRO |
| ouro do perdedor | 0,2359 | 0,2326 | **-1,40 por cento** | DENTRO |

**RECONSTRUCAO VALIDADA: sete de sete dentro da tolerancia. O maior desvio absoluto e 1,87 por cento, ou seja um sexto da tolerancia declarada, e nenhum dos sete precisou de ressalva.**

**Consequencia direta, e ela e a razao de ser deste bloco:** os tres coeficientes que a reconstrucao produz de novo (`torres totais` 0,3015, `torres por minuto` 0,2103, `ouro por minuto` 0,0774) sao confiaveis **pelo mesmo motivo** que os sete: foram produzidos pelo mesmo comando, sobre a mesma populacao e no mesmo estado de motor que reproduziu os sete conhecidos com erro maximo de 1,87 por cento.

**Leitura de magnitude, para calibrar a confianca.** O precedente citado no Task 2 era o contrafactual do 25-07, que reproduziu torres do vencedor e do perdedor em 5,755 e 3,875 contra 5,71 e 3,88 do baseline, menos de 1 por cento, com harness e N diferentes. Esta reconstrucao ficou na mesma ordem de grandeza e cobre sete grandezas em vez de duas. Ela tambem reproduz, na virgula, os numeros de forma do **estado D** da secao 7 de `25-sweep.md`: uma rota limpa 58,3 contra 58,0, tres rotas 4,0 contra 3,9, shutout 17,9 contra 17,9, 9 a 0 exato 0,1 contra 0,1, perdedor em zero 7,8 contra 7,8, media de rotas limpas 1,438 contra 1,436.

---

## Bloco 4: a escolha do teto

### O piso: 0,75, ja aprovado

O piso e **0,75** e nao e decisao desta onda: e o corte de colapso usado na medicao que abriu D-25-07 e foi aprovado ali. Valor de engenharia declarado, sem fonte externa, folgado o bastante para nao disparar por ruido amostral e apertado o bastante para pegar perda material.

### O criterio do teto, escrito antes dos numeros novos

> **O teto e o menor multiplo de 0,25 estritamente acima do maior aumento de dispersao que a milestone ja classificou como LEGITIMO.**

O maior aumento assim classificado ate hoje e **`baroes por jogo`, com razao 1,954**, declarado dispersao saudavel na secao 8 de `docs/diagnostics/25-sweep.md`. O menor multiplo de 0,25 estritamente acima de 1,954 e **2,00**.

### O teto escolhido: 2,00

```
CV_medido / CV_ancoragem  dentro de  [0,75 ; 2,00]
```

### O valor ilustrativo de 1,60 esta RECUSADO, e a recusa e por medicao

**Ele reprovaria duas coisas que nao sao defeito, e uma delas pelo diagnostico errado.**

**Primeira reprovacao indevida: `baroes por jogo`, razao 1,954.** Foi classificada como dispersao saudavel pela propria medicao que propos o teto. Um teto que reprova o exemplo que a fonte usa como legitimo esta errado por construcao.

**Segunda reprovacao indevida, e esta e a que importa: `torres do perdedor`, razao 1,731 medida aqui.** O numero fecha com o 1,749 medido no outro harness (N igual a 1500), ou seja **a excedencia foi confirmada em dois harnesses independentes** e nao e ruido amostral. E a reprovacao seria pelo **diagnostico errado**: o que explodiu a dispersao das torres do perdedor **nao e ruido**, e a **segunda pilha do shutout**. Metade da distribuicao foi para perto de zero e a outra metade ficou onde estava, o que infla o desvio sem que exista variacao nova. Esse defeito **ja tem instrumento proprio e mais especifico** nesta fase: o coeficiente de bimodalidade das distribuicoes de torres e a fracao de shutout, os dois criterios 2 e 3 do roadmap.

Pegar o mesmo defeito duas vezes por eixos diferentes tem um custo concreto e nao e redundancia inofensiva: a onda que consertar o shutout veria a banda de dispersao ficar vermelha **enquanto o conserto acontece** (o desvio cai antes de a forma fechar), e a fase seria empurrada a perseguir o numero em vez da causa. **Uma banda por defeito, no eixo em que o defeito aparece.**

### A regra de decisao para os tres numeros novos, escrita antes de eles serem lidos

> Se `torres totais`, `torres por minuto` ou `ouro por minuto` medirem razao acima de 2,00 no estado de hoje, **o teto NAO sobe automaticamente**. A onda 1 decide explicitamente entre duas saidas, com justificativa escrita: **subir o teto**, declarando por que aquele aumento e legitimo, ou **manter 2,00** e registrar aquela metrica como fora da banda com fase dona declarada.

**Resultado da aplicacao da regra: ela nao disparou.** Nenhum dos tres numeros novos excede 2,00. Ao contrario: dois deles ficaram **abaixo do piso** (`torres totais` 0,709 e `torres por minuto` 0,504), e o terceiro esta em 1,070, dentro da faixa preservada.

**Verificacao adicional, sobre as dez metricas e nao so sobre as tres novas:** a maior razao medida hoje no tier EQUILIBRADO e **1,731** (`torres do perdedor`), abaixo do teto de 2,00. **Nenhuma metrica reprova pelo teto hoje.** Isso e o comportamento correto de uma guarda contra explosao: ela existe para as quatro fases que ainda vao apertar nivel, e nasce sem morder nada, o oposto do piso, que ja nasce reprovando quatro linhas.

### O que este teto NAO cobre, dito para nao virar conclusao emprestada

O teto de 2,00 foi calibrado contra o maior aumento legitimo **ja observado** na milestone. Ele nao e afirmacao de que razao 2,01 seja necessariamente defeito nem de que 1,99 seja necessariamente saudavel: e um corte de engenharia com procedencia declarada, e a fase dona de cada banda continua sendo quem julga o caso concreto. A revisao em bloco da Fase 30 e o lugar de reavaliar o corte com quatro fases de dado em vez de zero.

---

## Bloco 5: o retrato de forma de hoje

Todos os numeros medidos por `npm run probe:shape`, N igual a 800 por tier. As colunas dos quatro estados vem da secao 7 de `docs/diagnostics/25-sweep.md` (mesma fixture, mesmo N, tier EQUILIBRADO).

**Legenda dos estados:** **D** pre-Fase-25, **C** canal absoluto desligado, **B** termo de vantagem desligado, **A** hoje.

| metrica de forma | **pre-fase, medido aqui** | D (25-sweep) | C | B | **hoje, EQUILIBRADO** | **hoje, GAP-LEVE** | alvo do roadmap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| vencedor no maximo do contador (9) | 4,0 | 3,9 | 0,4 | 52,9 | **90,8** | **96,3** | menos de 25 |
| vitoria exigiu limpar as TRES rotas | 4,0 | 3,9 | 0,4 | 52,9 | **90,8** | **96,3** | menos de 35 |
| vitoria com exatamente UMA rota limpa | 58,3 | 58,0 | 72,1 | 10,6 | **2,6** | **1,1** | entre 50 e 80 |
| shutout (perdedor com 0 ou 1 torre) | 17,9 | 17,9 | 13,9 | 1,4 | **44,9** | **70,3** | menos de 12 |
| exatamente 9 a 0 | 0,1 | 0,1 | 0,0 | 0,1 | **20,9** | **41,6** | menos de 5 |
| perdedor em ZERO torres (contexto) | 7,8 | 7,8 | 5,0 | 0,8 | **22,9** | **41,9** | sem alvo |

**Histograma da contagem de rotas do perdedor limpas por inteiro**, lido de `LaneStructures` do estado final (`outerAlive`, `innerAlive` e `inhibTurretAlive` todas falsas), nunca inferido da timeline:

| rotas limpas | pre-fase | hoje, EQUILIBRADO | hoje, GAP-LEVE |
| --- | --- | --- | --- |
| 0 | 1,0 | 0,0 | 0,0 |
| **1** | **58,3** | **2,6** | **1,1** |
| 2 | 36,8 | 6,6 | 2,6 |
| **3** | **4,0** | **90,8** | **96,3** |
| media | 1,438 | 2,881 | 2,951 |

**Os dois coeficientes de bimodalidade**, limiar unimodal 0,5556 (Kang 2019; Pfister et al. 2013):

| distribuicao | pre-fase | hoje, EQUILIBRADO | hoje, GAP-LEVE | alvo do roadmap |
| --- | --- | --- | --- | --- |
| torres do vencedor | **0,4594 unimodal** | **0,7853 BIMODAL** | **0,8169 BIMODAL** | abaixo de 0,5556 |
| torres do perdedor | **0,4416 unimodal** | **0,6493 BIMODAL** | **0,7988 BIMODAL** | abaixo de 0,5556 |

**A leitura do GAP-LEVE, que e observacao e nunca banda nesta fase.** Ele confirma o que D-25-06 mediu: no tier com gap a mesma deformacao vai ao extremo, com shutout em 70,3 por cento e 9 a 0 exato em 41,6 por cento. **A funcao dessa coluna nas ondas seguintes e responder se o conserto GENERALIZOU ou se apenas acertou o tier de referencia**, pergunta que so tem resposta medindo os dois. Vale notar que no pre-fase o GAP-LEVE ja tinha shutout alto (40,8 por cento) com o vencedor ainda unimodal (BC 0,4750): gap produz assimetria sozinho, e o que a Fase 25 acrescentou foi o **encosto no teto**, que e outra coisa.

### A linha observada de D-25-04: torres do vencedor incluindo as duas do Nexus

| leitura | pre-Fase-25 | hoje, EQUILIBRADO | hoje, GAP-LEVE |
| --- | --- | --- | --- |
| torres do vencedor, contador (`towersDestroyed`) | 5,759 | **8,860** | 8,938 |
| torres do vencedor **com as duas do Nexus** | 7,370 | **10,854** | 10,935 |
| diferenca (torres do Nexus caidas por partida) | 1,611 | **1,994** | 1,997 |

Calculada como `towersDestroyed` do vencedor mais dois menos `nexusTurretsAlive` do perdedor, lido do **estado final**. Sem banda, sem mudanca de motor e sem mudanca de contador.

**Por que ela existe.** O ramo de torre do Nexus de `damageStructure` e o unico ramo de queda de torre que nao chama `recordTower()`, entao `towersDestroyed` conta no maximo **nove** torres por lado quando um lado real tem **onze**. A referencia de pro play de **9,15 torres do vencedor** e sobre as onze. Sem esta linha, toda leitura de nivel contra aquela referencia fica **otimista por construcao**, porque compara um contador de nove com uma referencia de onze.

**A leitura honesta, e ela e mais dura do que a estimativa que abriu o item.** O item foi aberto com a estimativa de cerca de 10,15 torres, obtida somando ao contador as **1,292 quedas de torre do Nexus por partida** medidas no plano 25-05. **A medicao do estado final de hoje da 10,854, e a diferenca tem causa conhecida:** aquele 1,292 foi medido num estado intermediario da Fase 25, e hoje praticamente toda partida termina por nexo, entao as **duas** torres do Nexus caem quase sempre (1,994 por partida, contra 1,611 no pre-fase, quando cerca de 27 por cento das partidas ainda batiam no teto de 60 minutos). Ou seja **a distorcao que D-25-04 aponta ficou maior, nao menor**, com o encurtamento da partida: o vencedor de hoje destroi **10,854** torres contra a referencia de **9,15**, e nao as 10,15 estimadas.

**Esta linha NAO vira banda nesta fase e NAO muda o contador.** Ela e observacao para a revisao em bloco da Fase 30, que e onde o destino de D-25-04 sera decidido. Corrigir o contador agora deslocaria `torres/min`, `torres totais`, `torres aos 20:00` e a `razao de torres`, ou seja **todas** as bandas que a Fase 25 acabou de calibrar, e o conserto tem de vir antes de uma calibracao e nunca no meio dela.

---

## Bloco 6: o que este documento NAO faz

- **Nenhuma banda foi implantada.** As dez bandas de dispersao, a de dinamica e as de forma sao a **onda 2**, em `scripts/calibrate-pace.ts`, pelo mecanismo `checkBand` que ja existe.
- **Nenhuma constante de calibracao foi movida.** A unica mudanca em `src/sim/` foi transitoria, por `git checkout` do commit base da Fase 25, e voltou no mesmo Task, provada por hash de blob no Bloco 1.
- **Nenhum limiar foi tocado.** O limiar unimodal segue em `BC_UNIMODAL_THRESHOLD` de `scripts/stats.ts` e o corte de colapso segue em 0,75.
- **O motor esta byte a byte no estado em que a Fase 25 o deixou.** Contagem de chamadas ao gerador em `src/sim/` em 72, `src/sim/structures.test.ts` em 52 de 52 e `npx tsc --noEmit` limpo.
- **Nenhum snapshot foi regenerado e nenhuma dependencia foi acrescentada.**
- **A sonda nao asserta nada.** `scripts/probe-shape.ts` nao contem uma unica assercao e nao entra na cadeia de sete gates de `scripts/calibrate-all.mjs`.
