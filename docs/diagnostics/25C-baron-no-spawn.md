# Fase 25C: a regressao do gate de objetivos, medida antes de qualquer decisao

**Data:** 2026-07-31
**Fase:** 25C-causalidade-entre-eventos
**Origem:** verificacao final da onda 6. `npm run calibrate:objectives` saiu de verde para vermelho.
**Estado da decisao ao escrever este documento:** PARADA. Nenhuma banda foi afrouxada, nenhuma constante de motor foi movida em carater definitivo e nenhum snapshot foi regenerado.

O assert que quebra:

```
[FALHA] [Fase 19] PROVISORIA Baron no spawn por partida = 0.316
estourou o TETO da banda [0.020, 0.240], alvo 0.164
```

**A banda fez exatamente o trabalho dela.** O teto de 0,240 foi dimensionado no plano 25-06 para reprovar uma alta de 21 por cento sobre o valor de entao, que era o tamanho da alta que aquele plano descobriu. A alta medida agora e de **60 por cento** sobre 0,198, quase o triplo do que o teto foi calibrado para pegar.

---

## Bloco 0: a disciplina da medicao, escrita antes dos numeros

**Toda constante movida neste documento foi movida SO PARA MEDIR e restaurada ao fim.** A restauracao esta provada por **hash de blob**, nunca por `git status`: `core.autocrlf` esta em `true` neste repositorio, a arvore de trabalho tem CRLF e o objeto do git tem LF, entao qualquer prova por data, por tamanho ou por bytes crus mentiria. Esta e a mesma armadilha registrada no plano 25-07 e reusada em toda a Fase 25B.

Prova final, executada ao fim de todas as medicoes deste documento:

```
53/53 blobs de src/sim IDENTICOS a HEAD
contagem canonica de chamadas ao gerador em src/sim: 72
linha do gate em structures.ts: 1 ocorrencia
git status --short src/sim: vazio
```

**O instrumento tambem foi validado antes de ser usado.** A sonda (`tmp/25C-baron/probe.ts`, nao versionada) copia a fixture do harness de objetivos verbatim (EQUILIBRADO 70 contra 70, N = 500, semente igual ao indice, uma instancia de gerador por partida) e, no estado de hoje, devolve **158 ocorrencias e taxa 0,316**, que sao exatamente os numeros que o gate imprime. Uma sonda que nao reproduzisse o gate nao poderia atribuir causa a coisa nenhuma.

A sonda nao contem assercao, nao e gate, nao entra em `scripts/calibrate-all.mjs` e **nunca importa `POST_FIGHT_OBJECTIVE_W`**, porque precisa rodar tambem contra a arvore base da fase, onde a constante ainda nao existe.

---

## Bloco 1: o contrafactual de quatro estados

Mesma fixture, mesmo N, mesma semente por partida nos quatro estados.

| estado | o que e | Baron no spawn por partida | veredito contra o teto 0,240 |
| --- | --- | --- | --- |
| **A** | hoje (T = 8, W = 1,0) | **0,316** | VERMELHO, 32 por cento acima |
| **B** | W = 0 (janela pos-luta DESLIGADA, T = 8) | **0,306** | VERMELHO, 27 por cento acima |
| **C** | T = 16, W = 0,5 (ponto de entrada da onda 5) | **0,328** | VERMELHO, 37 por cento acima |
| **D** | commit base da fase, `4ede940` | **0,234** | verde, com **2,5 por cento** de folga |

### A hipotese da janela pos-luta esta REFUTADA, e por tres medicoes independentes

**Primeira: desligar a alavanca inteira devolve 0,010 de 0,118.** O estado B tem `POST_FIGHT_OBJECTIVE_W = 0`, ou seja a janela pos-luta nao acrescenta peso nenhum a decisao (o peso zero e filtrado por `weightedPickIntent`, entao e no-op numerico e nao apenas pequeno). A taxa cai de 0,316 para 0,306. A alta a explicar, de 0,198 para 0,316, e de 0,118. A alavanca responde por **8,5 por cento** dela, e o gate continua vermelho por larga margem com ela completamente desligada.

**Segunda: a grade inteira de W e plana, e nenhum ponto dela alcanca a banda.**

| `POST_FIGHT_OBJECTIVE_W` | 0,0 | 0,25 | 0,5 | 0,75 | 1,0 | 1,5 |
| --- | --- | --- | --- | --- | --- | --- |
| Baron no spawn por partida | 0,306 | 0,312 | 0,318 | 0,330 | **0,316** | 0,302 |

A amplitude inteira da grade e 0,028, e o excedente a eliminar e 0,076. **Nao existe valor de W que devolva a banda.** A leitura nem sequer e monotonica em W, o que ja indica que o que se ve aqui e ruido de trajetoria e nao efeito da alavanca.

**Terceira: a mesma coisa vale para a outra constante da onda 5.**

| `GANK_FOCUS_TEMPERATURE` (com W = 1,0) | 1 | 2 | 4 | 8 | 16 | 64 |
| --- | --- | --- | --- | --- | --- | --- |
| Baron no spawn por partida | 0,320 | 0,330 | 0,334 | **0,316** | 0,324 | 0,308 |

Amplitude de 0,026, tambem sem alcancar o teto em ponto nenhum. **As duas constantes que a onda 5 escolheu por grade de quinze pontos sao, as duas, inertes sobre esta metrica.**

### O achado que a hipotese escondia: a banda ja estava a 97,5 por cento do teto ANTES da fase comecar

O estado D nao e 0,198. E **0,234**. Ou seja, entre o fim da Fase 25 (quando a banda foi escrita) e o commit base da Fase 25C, a metrica ja tinha subido **18,2 por cento**, consumindo quase toda a folga de 21 por cento que o teto foi dimensionado para dar.

Isso aconteceu na **Fase 25B**, e passou despercebido porque 0,234 ainda esta dentro de 0,240. O gate ficou verde com **2,5 por cento** de folga onde o comentario do proprio arquivo afirmava, de boa fe, que a medida estava a 82,5 por cento do teto.

**Consequencia direta para as tres saidas:** mesmo o desfazimento integral do motor da Fase 25C nao devolve uma banda saudavel. Devolve uma banda a 2,5 por cento do teto, que a proxima fase que mexer em qualquer coisa estoura de novo.

---

## Bloco 2: a causa real, atribuida commit a commit

Cada linha e um retrato acumulado: `src/sim` inteiro conferido naquele commit, sonda rodada, arvore restaurada.

| # | commit | onda e assunto | taxa | delta | contestadas | limpas |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `4ede940` | base da fase | 0,234 | | 53 | 64 |
| 1 | `d764d33` | 25C-03, remove simbolo de intencao morto | 0,234 | +0,000 | 53 | 64 |
| 2 | `00d394e` | 25C-03, duas intencoes sem resolvedor perdem o peso | 0,260 | **+0,026** | 69 | 61 |
| 3 | `116b402` | 25C-04, ligacao 1: rota do gank ponderada pelo estado | 0,260 | +0,000 | 65 | 65 |
| 4 | `48295de` | 25C-04, ligacao 2: mortes de teamfight movem o lead da rota | 0,326 | **+0,066** | 102 | 61 |
| 5 | `03800e0` | 25C-04, ligacao 3: **a janela pos-evento na decisao** | 0,328 | **+0,002** | 96 | 68 |
| 6 | `f787026` | 25C-05, ponto de operacao T = 8 e W = 1,0 | 0,316 | -0,012 | 98 | 60 |

**O commit que introduziu a alavanca suspeita move a metrica em +0,002.** Os dois que fazem o trabalho todo sao `00d394e` e `48295de`, e juntos respondem por 0,092 de 0,082 liquidos (os outros quatro somam negativo).

### O mecanismo nomeado: `48295de`, mortes de teamfight movendo o lead da rota

O commit acrescenta uma unica chamada dentro do aplicador de baixas de teamfight:

```
applyFightLaneLead(state, killerSide, place);
```

Cada morte de teamfight passa a mover o lead da rota mapeada a partir do local da luta, com a magnitude de um mergulho bem sucedido. Como o resolvedor de teamfight escolhe o local entre duas regioes de rio e a rota do meio, e as regioes de rio e de selva mapeiam para cima e para baixo, **praticamente toda morte de teamfight agora empurra lead de rota**.

Contrafactual dessa ligacao **no estado de hoje**, ou seja controlando a interacao com todo o resto da fase, com a chamada desligada e nada mais movido:

| metrica | hoje | com a ligacao 2 desligada |
| --- | --- | --- |
| Baron no spawn por partida | 0,316 | **0,282** (segue VERMELHO) |
| ACOPLAMENTO P2 | 2,013 (verde) | **1,834** (VERMELHO, banda [1,951; 2,250]) |
| ACOPLAMENTO P1 | 1,476 | 1,478 |
| ACOPLAMENTO P3 | 1,296 | 1,247 |

**Nem desfazer o maior contribuidor individual devolve a banda**, e ele cobra o P2 exatamente como a alavanca suspeita cobraria.

---

## Bloco 3: a classificacao condicional, no molde da secao 5 de `25-sweep.md`

A pergunta pedida era: quem pega Baron no spawn agora tinha acabado de vencer uma luta? A sonda le o snapshot que a propria engine ja carrega em cada evento, usando o **ultimo evento com tempo estritamente anterior ao tick do Baron**, para que uma morte da propria luta contestada do mesmo tick nao contamine a contagem de vivos.

**Definicao do eixo novo, escrita antes dos numeros.** `janela aberta` e o proxy literal de `hasRecentAceOrPick`: houve evento de luta em `(t - 60, t)` **e** o inimigo tinha **2 ou menos vivos** no tick anterior. Essa e a precondicao exata de `applyPostFightObjectiveWeights`.

| | base `4ede940` | hoje |
| --- | --- | --- |
| ocorrencias na janela de spawn | 117 | 158 |
| luta nos 60 s anteriores | 59 (50,4%) | 86 (54,4%) |
| ace do tomador nos 60 s anteriores | 9 (7,7%) | 21 (13,3%) |
| **JANELA POS-LUTA ABERTA** | 28 (23,9%) | 48 (30,4%) |
| **contestadas** | **53 (45,3%)** | **98 (62,0%)** |
| roubadas | 17 (14,5%) | 20 (12,7%) |
| limpas (sem roubo e sem contestacao) | 64 (54,7%) | 60 (38,0%) |
| a frente em ALGUM dos tres eixos | 91 (77,8%) | 122 (77,2%) |
| atras nos TRES eixos | 23 (19,7%) | 32 (20,3%) |
| **candidato a defeito** (atras nos 3, limpa) | **3 (0,006 por partida)** | **7 (0,014 por partida)** |

### A quarta refutacao, e ela e a mais limpa das quatro

**A alta inteira esta na populacao CONTESTADA, e a populacao LIMPA nao se moveu.**

| populacao | base, por partida | hoje, por partida | delta |
| --- | --- | --- | --- |
| contestadas | 0,106 | **0,196** | **+0,090** |
| limpas | 0,128 | 0,120 | -0,008 |
| **total** | **0,234** | **0,316** | **+0,082** |

A coluna de contestadas responde por **110 por cento** do delta. A coluna de limpas anda de lado nos sete estados medidos, sempre entre 60 e 68 ocorrencias.

**Isto sozinho refuta a hipotese por construcao.** `applyPostFightObjectiveWeights` acrescenta peso de `setup_baron` para **um** lado, o que ganhou a luta. Uma tomada contestada exige que **os dois** lados escolham o mesmo objetivo no mesmo tick. A alavanca empurra a decisao de um lado so, entao ela nao pode ser o motor de uma alta que e inteiramente de disputa entre dois lados.

O que ela de fato faz aparece no commit `03800e0` da tabela do Bloco 2: **contestadas caem de 102 para 96 e limpas sobem de 61 para 68**, com o total praticamente parado. A alavanca troca disputa por tomada limpa, que e o comportamento que o comentario dela descreve, e nao cria ocorrencia.

### O veredito sobre o mecanismo: funcionando, mas nao e este o mecanismo em julgamento

Das 48 ocorrencias de hoje com a janela pos-luta aberta, **50 por cento das tomadas limpas** estao nessa classe, o ator e o jungler em 87,5 por cento delas e a diferenca mediana de abates do tomador e **+4,5**. Ou seja: quando a janela pos-luta age, quem pega o Baron e mesmo um time que acabou de dizimar o outro, o que e o jogo funcionando. **Esse mecanismo esta correto e nao e o reu.**

O reu e a populacao contestada, que **nenhum gate desta engine olha**: `baronSetupSufficient` e consultado apenas no caminho solo (`engine.ts:805` e `engine.ts:814`), e o proprio codigo escreve isso ("So gateia o caminho uncontested"). O caminho contestado dispara quando os dois lados escolhem o mesmo objetivo disponivel no mesmo tick, e passa direto.

---

## Bloco 4: o teto do que a alavanca nomeada pelo proprio comentario alcanca

O comentario da banda instrui: *"NAO afrouxar esta banda, ajustar `baronSetupSufficient` se marginal."* Essa instrucao foi escrita quando a alta era de tomadas limpas. Medida hoje, ela nao alcanca:

| estado medido | Baron no spawn | P2 | veredito |
| --- | --- | --- | --- |
| hoje | 0,316 | 2,013 | banda VERMELHA |
| ramo de pressao do setup desligado (`BARON_PRESSURE_THRESHOLD` no infinito) | **0,262** | | segue VERMELHO |
| **setup solo do Baron fechado por inteiro na janela de spawn** | **0,212** | **2,108** | verde, e P2 segue verde |

**A leitura estrutural que estes dois numeros entregam:** com o caminho solo **inteiramente** fechado durante a janela de spawn, sobram as 98 tomadas contestadas, ou **0,196 por partida**, que ja e **81,7 por cento do teto de 0,240**. O gate de setup, mesmo levado ao extremo de proibir por construcao qualquer Baron solo entre 20:00 e 21:00, deixa a banda com 12 por cento de folga e nada mais.

**Nao existe ajuste de `baronSetupSufficient` que devolva folga confortavel.** A banda passou a medir, majoritariamente, uma populacao que ela nunca foi desenhada para vigiar.

---

## Bloco 5: a lacuna de cobertura, registrada como licao para a Fase 26

**O sweep da onda 5 varreu quinze pontos em seis tiers e nao viu isto.** Ele mediu, por ponto: as bandas de `calibrate:pace`, as tres de acoplamento, as de forma e dispersao, e os **contadores de assert duro** (foi exatamente isso que pegou as duas violacoes de regra dura que nenhuma linha de banda mostrava). O que ele **nao** mediu foi o **gate de objetivos**.

A consequencia esta na tabela do Bloco 2: os quinze pontos passaram por cima de uma metrica que ja estava a 97,5 por cento do teto na entrada e que subiu 35 por cento durante a fase, e o sweep nao tinha como ver.

**A licao, escrita para quem varrer grade de novo:** um sweep que mede um subconjunto dos gates nao esta medindo o efeito colateral, esta medindo o efeito colateral **naquele subconjunto**. A regra que a onda 5 ja aplicou aos asserts duros ("conferir CONTADOR DE ASSERT DURO nos seis tiers, e nao a linha de banda") precisa valer para **os sete gates**, e nao so para os que a fase escolheu como alvo. O custo de rodar os sete e baixo: `calibrate:objectives` roda em 2 s e `calibrate:pace` em 14 s.

**A Fase 26 varre grade de novo.** Sem esta correcao de procedimento, ela repete o mesmo modo de falha em qualquer gate que nao esteja na mira dela.

---

## Bloco 6: a decisao, posta na mesa e NAO TOMADA

A instrucao foi explicita: trazer a decisao, nao escolher. As tres saidas do enunciado foram medidas, e a medicao acrescentou uma quarta e mudou o custo de duas delas.

### Saida 1: reduzir `POST_FIGHT_OBJECTIVE_W` ate a banda voltar

**ELIMINADA POR MEDICAO, e nao por julgamento.** Nenhum valor da grade alcanca a banda (0,302 a 0,330 contra teto 0,240), e o custo em P2 e real:

| W | 0,0 | 0,25 | 0,5 | 0,75 | **1,0** | 1,5 |
| --- | --- | --- | --- | --- | --- | --- |
| Baron no spawn | 0,306 | 0,312 | 0,318 | 0,330 | **0,316** | 0,302 |
| **P2** (banda [1,951; 2,250]) | **1,861** | **1,882** | **1,921** | 1,979 | **2,013** | **1,937** |
| P2 verde? | nao | nao | nao | sim | **sim** | nao |
| P1 | 1,458 | 1,461 | 1,508 | 1,462 | 1,476 | 1,366 |
| P3 | 1,358 | 1,349 | 1,348 | 1,298 | 1,296 | 1,273 |

**W = 1,0 e o melhor ponto de P2 da grade inteira.** Qualquer reducao troca a unica banda de acoplamento que a fase fechou por **nada** no Baron. Esta saida e custo puro.

### Saida 2: re-derivar o teto com o mecanismo nomeado

**Custo, dito sem suavizar:** o teto de 0,240 foi dimensionado de proposito para pegar uma alta deste tamanho, e re-ancorar aqui esvazia a banda. Alem disso, ela ja foi re-ancorada uma vez, na Fase 25, e o Bloco 1 mostra que a folga daquela re-ancoragem foi consumida em uma fase e meia sem ninguem ver.

**O que a medicao acrescenta a favor, e e material:** a banda hoje mede majoritariamente uma populacao (tomada contestada) que ela nao foi desenhada para vigiar e que **nenhum gate desta engine olha**. O proprio comentario da banda ja recomendava, para a Fase 30, medir a **populacao estreita** em vez da taxa agregada. Essa populacao estreita e o candidato a defeito, e ela mede **0,014 por partida hoje contra 0,006 na base**: dobrou em termos relativos, segue minuscula em termos absolutos (7 ocorrencias em 500 partidas).

**O que a medicao acrescenta contra:** re-derivar o teto agora, no fim de uma fase, para acomodar um numero que a propria fase produziu, e precisamente o movimento que o comentario da banda existe para impedir. E a fase nao pode nomear o mecanismo como "correto" sem julgamento humano, porque a leitura narrativa da ligacao 2 (uma luta no rio de cima conta como vantagem da rota de cima) **ja estava marcada no proprio codigo como pendente de checkpoint humano da onda 6**, e esse checkpoint nao aconteceu.

### Saida 3: aceitar como regressao declarada e escalar para fase propria

**Custo:** a fase fecha com um gate que estava verde vermelho, e a contagem cai de 4 para 3 de 7.

**O que a medicao acrescenta:** a regressao **nao e inteiramente da Fase 25C**. Do excedente de 0,076 sobre o teto, a Fase 25C responde por 0,082 e a Fase 25B por 0,036, e a base ja entrava a 2,5 por cento do teto. Uma fase propria pega o problema inteiro, o que nenhuma das outras saidas faz.

### Saida 4, que a medicao acrescentou: fechar o caminho solo do Baron na janela de spawn

**Nao estava no enunciado e por isso vem com etiqueta de aviso.** E a unica intervencao medida que devolve a banda sem custar P2:

| | Baron no spawn | P2 | P1 | P3 |
| --- | --- | --- | --- | --- |
| hoje | 0,316 | 2,013 | 1,476 | 1,296 |
| com o caminho solo fechado na janela | **0,212** | **2,108** | 1,488 | 1,252 |

**Custo, e ele e alto:** isto e mudanca de mecanismo e nao calibracao. Proibe por construcao um evento que o jogo real tem (o time que ganhou a luta das 19:5x pega o Barao limpo), o que contradiz o proprio texto que justifica o piso de 0,02 da banda. Deixa a banda com 12 por cento de folga sustentada por uma populacao contestada que segue sem gate nenhum. E e decisao arquitetural, ou seja fora do que uma onda de fechamento pode tomar sozinha.

### O que este documento NAO fez, de proposito

- a banda **nao foi afrouxada**;
- `POST_FIGHT_OBJECTIVE_W`, `GANK_FOCUS_TEMPERATURE`, `BARON_PRESSURE_THRESHOLD`, `baronSetupSufficient` e `applyFightLaneLead` **nao foram tocados** em carater definitivo, e a restauracao esta provada por hash de blob;
- nenhum snapshot foi regenerado;
- nenhuma das quatro saidas foi escolhida.
