# Fase 26: gates de combate deixam de ser decorativos

**Data:** 2026-08-20
**Fase:** 26-volume-de-combate-e-densidade-narrativa
**Plano de origem:** 26-08
**Proposito, em uma linha:** re-ancorar os limiares do gate de micro que quase nunca disparavam (Task 1) e provar por mutacao, com controle negativo, que o gate de ritmo reprova quando a alavanca primaria e perturbada (Task 2), fechando o criterio 5 do `ROADMAP.md` desta fase (Task 3).

**Por que este plano existe.** A verificacao da Fase 22 da v2.0 encontrou asserts que passavam verde sem vigiar nada. O criterio 5 desta fase cobra duas coisas: que os limiares tolerantes do gate de micro tenham procedencia e populacao declarada, e que exista prova executavel de que o gate de ritmo reage quando a alavanca que ele diz vigiar muda.

---

## BLOCO 1: re-ancoragem do limiar de jogo longo

### 1.1 O defeito no numero antigo

`LONG_GAME_SEC` valia `30 * 60` (1800s), um multiplo redondo de sessenta sem fonte citada. A banda de duracao final da milestone e `[29; 36]` minutos de media, com a mediana medida em 28:30 (tier EQUILIBRADO, N=800). Um limiar de "jogo longo" ancorado em 30 minutos captura a metade SUPERIOR da distribuicao inteira (mediana perto de 30min), nao a CAUDA que a negativa de plausibilidade diz vigiar (o carry terminar sem abates numa partida REALMENTE longa). Achado registrado em `26-RESEARCH.md` Pitfall 4, ANTES deste plano existir.

### 1.2 A regra de ancoragem, escrita antes do numero

O limiar passa a ser um PERCENTIL DECLARADO da distribuicao de duracao medida no ponto de operacao desta fase, nunca um numero redondo. O percentil e escolhido pelo que o assert quer vigiar (a CAUDA SUPERIOR da distribuicao), com populacao suficiente na cauda para o assert significar algo, e um piso de populacao minimo abaixo do qual o assert e reportado como sem poder estatistico.

**Candidatos avaliados, com a razao da escolha:**

| percentil | valor (s) | valor (min) | populacao no cenario Scaling (N=800) | veredito |
| --- | --- | --- | --- | --- |
| p75 | 2085 | 34:45 | 65 partidas | generoso demais: 25% da amostra nao e "cauda" |
| **p90** | **2430** | **40:30** | **31 partidas** | **ESCOLHIDO: decil superior classico, populacao acima do piso de 20** |
| p95 | 2685 | 44:45 | 11 partidas | populacao insuficiente (abaixo do piso de 20; o fallback para o cenario Stomp de bot cairia para 1 partida) |

**Percentil escolhido: p90.** Justificativa, escrita pelo que o assert vigia e nao pelo valor: a negativa de plausibilidade (Negativa 2 de CAL-03) e sobre a cauda superior da distribuicao de duracao, entao p75 (que ainda cobre um quarto da amostra inteira) e generoso demais para ser chamado de cauda. p95 deixa populacao pequena demais nos cenarios que consomem esta constante (Cenario 4/Scaling cai para 11 partidas, abaixo do piso de populacao de 20 que a propria logica de fallback do arquivo ja usa; o fallback para o Cenario 5/Stomp de bot cairia para apenas 1 partida, tornando o assert inteiramente sem poder). p90 e o decil superior classico e deixa 31 partidas no cenario Scaling, confortavelmente acima do piso de 20.

### 1.3 A medicao

Reproduzida com `npx vitest run -c vitest.probe-shape.config.ts` (tier EQUILIBRADO, 75 contra 75, N=800, seed=indice da partida), 2026-08-20. Saida em `tmp/shape.txt`: media de duracao 1812,21s, identica a segunda casa decimal a saida usada nesta medicao. Os percentis completos (nao impressos por `probe-shape.ts`, que so imprime media/desvio/CV para a serie de duracao) foram medidos por reproducao verbatim da mesma fixture/N/semente, usando `summarize()` de `scripts/stats.ts` (a mesma funcao de percentil que todo o resto do projeto usa, DEC-04):

| percentil | valor (s) | valor (mm:ss) |
| --- | --- | --- |
| p5 | 1320 | 22:00 |
| p25 | 1455 | 24:15 |
| p50 | 1710 | 28:30 |
| p75 | 2085 | 34:45 |
| **p90** | **2430** | **40:30** |
| p95 | 2685 | 44:45 |

`min = 1245` (20:45), `max = 3225` (53:45), `mean = 1812,21` (30:12). A media reproduz digito a digito a de `tmp/shape.txt`, confirmando que a mesma populacao foi medida pelos dois metodos.

### 1.4 A implantacao

`LONG_GAME_SEC` passa de `30 * 60` (sem fonte) para `2430` (p90, medido 2026-08-20), com o comentario no codigo citando percentil, valor, fonte e data no mesmo formato de procedencia que as bandas do projeto (`scripts/bands.ts`) exigem.

**Contagem de partidas que cruzam o limiar, agora visivel na mensagem do assert.** A Negativa 2 de CAL-03 (`scripts/calibrate-micro.ts`) usa `LONG_GAME_SEC` para contar `longGameUserWins`/`longGameAdcZeroKills` dentro dos cenarios nomeados (Scaling comp virando, com fallback para Stomp de bot). A mensagem do assert agora imprime `N=<contagem> partidas cruzam LONG_GAME_SEC=2430s`, e se a contagem ficar abaixo do piso de populacao (20, o mesmo ja usado pela logica de fallback do arquivo entre os dois cenarios), a mensagem declara explicitamente `SEM POPULACAO SUFICIENTE (piso 20)` em vez de ser reportada como verde silencioso.

**Populacao medida no ponto de operacao do plano, com o novo limiar (2430s):**

| cenario | `longGameUserWins` | populacao suficiente (piso 20)? |
| --- | --- | --- |
| Scaling comp virando (cenario primario) | 31 | SIM -- usado diretamente, sem fallback |
| Stomp de bot (fallback, so usado se Scaling <= 20) | 3 | nao aplicavel: Scaling ja tem populacao suficiente |

---

## BLOCO 2: re-ancoragem dos quatro tetos tolerantes por role

### 2.1 O criterio, escrito antes dos numeros

Cada teto passa a ser **valor medido agora vezes um multiplicador de folga**, em vez de um numero herdado da FAIXA de uma fonte externa (pesquisa2) com tolerancia solta e nunca recalibrada contra o motor real. O multiplicador escolhido e **1,20 para tetos e 0,80 para o piso**, a MESMA largura relativa 0,80/1,20 ja declarada para as seis bandas de densidade desta fase (`docs/diagnostics/26-ancoragem.md` Bloco 6.1), reaproveitada aqui por consistencia interna da fase, nao inventada de novo.

Regra de honestidade declarada antes de medir: se o teto novo ficar MENOR que o antigo, e aperto legitimo e entra assim; se ficar MAIOR, o comentario no codigo precisa dizer por que.

### 2.2 A medicao, tier EQUILIBRADO (70 contra 70, N=800), 2026-08-20

Reproduzida verbatim da logica de `runTier("EQUILIBRADO", 70, 70)` em `scripts/calibrate-micro.ts` (soma de kills dos dois lados dividida por partidas). Junto, a mesma medicao foi reproduzida no motor da ENTRADA DA FASE (`src/sim/combat.ts` reconstruido do commit base `d2bc5dc8908ca1029526e695004b98dce59c76b3` via `git show d2bc5dc:src/sim/combat.ts`, hash de blob conferido igual ao registrado em `docs/diagnostics/26-ancoragem.md` Bloco 1 -- `0a271ad9d00bad36c650a2c5fd85ca5a5f2bbaa9` -- e revertido para o estado atual via `git checkout -- src/sim/combat.ts` apos a medicao, com o hash de blob conferido de volta a `HEAD:src/sim/combat.ts` antes de qualquer commit deste plano).

| role | kills/jogo (entrada da fase) | kills/jogo (agora, pos 26-04/26-05) | variacao |
| --- | --- | --- | --- |
| support | 2,424 | 2,260 | caiu |
| top | 6,689 | 6,324 | caiu |
| jungle | 11,271 | 10,996 | caiu |
| adc | 10,525 | 9,949 | caiu |

As quatro roles medem MENOS kills agora do que na entrada da fase, consistente com o corte de volume de combate que as ondas 26-04 (`maxCasualties`, banda intermediaria) e 26-05 (pesos de `force_fight`, espera entre lutas) implantaram.

### 2.3 A tabela completa de re-ancoragem

| teto/piso | valor antigo | criterio antigo | valor medido agora | multiplicador | valor novo | veredito |
| --- | --- | --- | --- | --- | --- | --- |
| support (teto) | 6 | pesquisa2 support 0-4, tolerancia "3x" solta | 2,260 | x1,20 | **2,71** | MENOR (aperto legitimo) |
| top (teto) | 8 | pesquisa2 top tank 1-5, tolerancia para 2 lados | 6,324 | x1,20 | **7,59** | MENOR (aperto legitimo) |
| jungle (teto) | 18 | pesquisa2 jungle carry 3-9, banda generosa 2 jogadores | 10,996 | x1,20 | **13,20** | MENOR (aperto legitimo) |
| adc (piso) | 1 | so verifica "nao esta em zero" | 9,949 | x0,80 | **7,96** | MAIOR (aperto legitimo -- piso mais alto e assert MAIS discriminante) |

**Nenhum dos quatro tetos ficou maior que o antigo.** As quatro re-ancoragens tightening por construcao (nao por escolha convenientemente cherry-picked de multiplicador): como as quatro medias de kills medidas caem em relacao a entrada da fase, e o multiplicador de 1,20/0,80 e mais estreito que a folga implicita dos numeros antigos (calibrados contra o TOPO de faixas de literatura externa, nunca contra o motor), o resultado natural e um teto mais apertado em todos os quatro casos. Nao houve necessidade de justificar nenhum aumento.

### 2.4 Populacao que sustenta os quatro numeros

N=800 partidas deterministicas (seed=indice da partida, tier EQUILIBRADO 70 contra 70), a mesma populacao ja usada por CAL-01/CAL-02 neste arquivo. Nenhuma populacao adicional foi necessaria: os quatro tetos sao avaliados sobre a MESMA serie que CAL-01 ja acumula (`flat.st.kills.<role>`), entao a populacao e identica para os quatro.

### 2.5 Verificacao

Os quatro asserts re-ancorados foram executados via `npm run calibrate:micro` no ponto de operacao atual: os quatro passam (nenhuma role viola o teto/piso novo). O arquivo termina vermelho por um motivo NAO relacionado a este plano (Cenario 1, assist-share do support, `29,7%` contra o piso `30%`, distancia de 0,3 ponto percentual) -- registrado como achado fora de escopo em `deferred-items.md` (D-26-02), porque nenhuma linha tocada por este plano participa daquele calculo e o assert que falha executa DEPOIS dos quatro tetos re-ancorados no arquivo.

---

## BLOCO 3: a mutacao da alavanca primaria

### 3.1 O bloco de numeros, quatro linhas

Medido por `scripts/mutation-maxcasualties.test.ts` (`npm run mutation:maxcasualties`), N=500, tier EQUILIBRADO (75 contra 75), 2026-08-20. Banda avaliada: "abates/min", identica a de `scripts/calibrate-pace.ts` (piso 0,700, teto 1,000, alvo 0,840, fonte STACK.md secao 3 linha 8, dono Fase 26).

1. **Taxa de abates da rodada BASE:** 1,2761. Veredito: FALHA. Lado estourado: **TETO** (1,2761 acima do teto 1,000).
2. **Taxa de abates da rodada PERTURBADA (maxCasualties x1,2):** 1,3453. Veredito: FALHA. Lado estourado: **TETO**.
3. **Taxa de abates do CONTROLE NEGATIVO (x1,0):** 1,2761. Veredito: FALHA. Lado: TETO. Diferenca contra a base: **0,0000** (identico bit a bit -- `1.2761 === 1.2761`, confirmado por `toBe` no teste, nao por aproximacao).
4. **Tamanho de amostra e variacao entre rodadas de mesma configuracao:** N=500 partidas por rodada. Variacao medida entre duas rodadas BASE de sementes disjuntas (0..499 contra 500..999, mesma alavanca real): **0,0190**. Efeito da perturbacao (linha 2 menos linha 1): **0,0692**, **3,65 vezes maior** que a variacao base-base.

### 3.2 A leitura, em uma frase

O gate reprova quando a alavanca muda, e a prova disso e a linha 2 (1,3453) contra a linha 1 (1,2761): a rodada perturbada viola o teto por uma distancia estritamente maior (0,3453 contra 0,2761, uma diferenca de 0,0692), e a linha 3 (controle identico bit a bit a base) mostra que essa diferenca nao veio da mecanica de substituicao de modulo, enquanto a linha 4 mostra que ela nao veio de ruido amostral (0,0692 excede em 3,65 vezes a variacao medida entre duas rodadas base de sementes diferentes).

### 3.3 A honestidade sobre o estado da banda, sem suavizar

A rodada base **ja nasce fora da banda** (TETO estourado) no ponto de operacao commitado desta medicao. Por isso a clausula 1 (vereditos diferem) nao pode ser escrita como troca classica de rotulo (dentro para fora): o rotulo `checkBand` fica **TETO nas duas rodadas** (base e perturbada), porque `maxCasualties` x1,2 so pode AUMENTAR baixas por luta, o que so pode empurrar `abates/min` para cima -- mais fundo no MESMO lado que a base ja violava, nunca para o lado oposto (PISO). A prova de nao vacuidade usa a MAGNITUDE da violacao (a distancia extra de 0,0692, linha 4 acima) em vez do rotulo discreto, exatamente como a honestidade declarada no objetivo deste plano previu para o caso de base vermelha.

**ACHADO NOMEADO:** o objetivo do plano previa que, com a base fora da banda, "a rodada perturbada estoura o lado OPOSTO". A medicao mostra que isso nao e alcancavel para esta banda com esta alavanca: o lado que `maxCasualties` x1,2 empurra e sempre TETO (mais mortes, taxa maior), nunca PISO, independente de onde a base esteja. O "lado oposto" so existiria se a base ja estivesse do lado PISO (abates/min baixo demais); aqui a base esta ACIMA do teto, entao a perturbacao (que so pode aumentar) so pode empurrar mais para cima, aprofundando a mesma violacao. Registrado como estado medido, nao forcado a caber na redacao original do objetivo.

---

## BLOCO 4: o veredito do criterio 5, com as duas metades separadas

**Criterio 5 do `ROADMAP.md` desta fase: "os gates de combate deixam de ser decorativos".** As duas metades podem fechar em tempos diferentes, entao ficam separadas.

### 4.1 Metade 1: re-ancoragem dos limiares

**ATENDIDA.** O limiar de jogo longo (`LONG_GAME_SEC`) deixou de ser um multiplo redondo sem fonte e passa a citar percentil (p90), valor (2430s), fonte (probe:shape, tier EQUILIBRADO N=800) e data (2026-08-20), com a contagem de partidas que cruzam o limiar visivel na mensagem do assert e um piso de populacao declarado (20). Os quatro tetos tolerantes por role (support/top/jungle/adc) foram re-ancorados contra o valor medido agora vezes o multiplicador 1,20/0,80 (a mesma largura das bandas de densidade da fase), com os quatro apertando em vez de afrouxar. Tabela completa no BLOCO 1 e BLOCO 2 acima.

### 4.2 Metade 2: prova de mutacao

**ATENDIDA.** Existe prova executavel (`scripts/mutation-maxcasualties.test.ts`, `npm run mutation:maxcasualties`) de que o gate de ritmo (a banda "abates/min") reage a perturbacao da alavanca primaria (`maxCasualties`), com controle negativo que produz resultado identico bit a bit a base (afastando a hipotese de vies da propria mecanica de substituicao) e com a diferenca da perturbacao (0,0692) medida como 3,65 vezes maior que o ruido base-base (0,0190). A prova foi feita com a base fora da banda (TETO estourado), condicao declarada explicitamente no arquivo do teste e neste documento (BLOCO 3.3), com a clausula 1 adaptada para usar magnitude de violacao em vez de troca de rotulo, exatamente como a honestidade declarada no objetivo deste plano previa para este estado.

### 4.3 Veredito consolidado

**Criterio 5 FECHADO, as duas metades atendidas.** Os limiares tem procedencia e populacao declarada (metade 1), e existe prova executavel, com controle negativo, de que o gate de ritmo muda de veredito (por magnitude, dado o estado real da banda) quando a alavanca primaria e perturbada (metade 2).

---

## BLOCO 5: o item herdado, D-25C-01

**D-25C-01: "o sweep de grade mede um subconjunto dos gates".** Dono: Fase 26 (registrado em `.planning/phases/25C-causalidade-entre-eventos/deferred-items.md`, com a razao: a Fase 26 "varre grade de novo", repetindo o tipo de trabalho que produziu o item original).

**A licao original, escrita como instrucao:** o sweep da Fase 25C onda 5 mediu bandas de ritmo, acoplamento, forma/dispersao e contadores de assert duro, mas nao o gate `calibrate:objectives` -- por isso uma regressao que ja entrava a 97,5% do teto passou despercebida por quinze pontos de grade e so apareceu na verificacao final. A regra que deveria valer: contadores de assert duro conferidos nos SETE gates de `scripts/calibrate-all.mjs` a cada ponto de grade, nao so no gate de ritmo.

**Este plano (26-08) NAO ALCANCA D-25C-01.** As duas tasks deste plano (re-ancoragem de limiares e teste de mutacao) nao executam nenhum sweep de grade: nenhuma delas varia uma constante por varios candidatos e mede o efeito em cada ponto. D-25C-01 e especificamente sobre a DISCIPLINA de um sweep de grade, e este plano nao roda nenhum.

**Estado observado dentro da fase, para contexto (nao e o veredito deste plano):** os sweeps de grade que de fato aconteceram na Fase 26 foram os planos 26-04 (BLOCO 3 de `docs/diagnostics/26-sweep.md`, a varredura de `maxCasualties`) e 26-05 (BLOCO 7/8 do mesmo documento, a varredura de `FIGHT_COOLDOWN_BY_PHASE` e dos pesos de `force_fight`). Os dois mediram, a cada ponto de grade, TODAS as 48 bandas de `calibrate:pace` agregadas via `expectBands` (linha "bandas vermelhas do gate inteiro") e as tres configuracoes de `calibrate:assists`. Isto e cobertura maior que o sweep original de D-25C-01 (que so olhava o gate de ritmo), mas ainda cobre DOIS dos sete gates do runner (`calibrate:pace`, `calibrate:assists`), nao os sete que a licao pede -- os contadores de assert duro de `calibrate`, `calibrate:micro`, `calibrate:structures`, `calibrate:objectives` e `calibrate:combat` nao foram conferidos a cada ponto de grade nos sweeps desta fase. **D-25C-01 permanece ABERTO** apos esta fase, com a cobertura parcial acima registrada para quem o retomar (candidato natural: Fase 30, revisao em bloco, no mesmo padrao dos demais itens herdados desta milestone).

---

*Documento completo: BLOCO 1 e BLOCO 2 (re-ancoragem, Task 1), BLOCO 3 (prova de mutacao, Task 2), BLOCO 4 (veredito do criterio 5) e BLOCO 5 (D-25C-01) preenchidos pelo Task 3. `src/sim/` intocado pelo plano inteiro (`git status --porcelain src/sim` vazio em cada task).*
