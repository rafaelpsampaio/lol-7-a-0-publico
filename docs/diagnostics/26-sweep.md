# Fase 26 Plano 04: a varredura da alavanca primaria, `maxCasualties`

**Fase:** 26-volume-de-combate-e-densidade-narrativa
**Plano de origem:** 26-04 (Task 1)
**Commit base da fase:** `d2bc5dc` (gravado em `docs/diagnostics/26-ancoragem.md`, Bloco 1)
**Proposito, em uma linha:** escrever o criterio de escolha da forma antes de rodar qualquer candidata, medir pelo menos tres formas candidatas contra o gate de ritmo COMPLETO (nao so a banda alvo `abates/min`), e escolher a vencedora pelo criterio escrito, mesmo que ela nao feche a banda.

---

## BLOCO 1: o criterio de escolha, escrito antes de qualquer numero de varredura

O criterio tem quatro clausulas, aplicadas **em ordem**. Uma candidata que perca numa clausula esta decidida ali; as clausulas seguintes so decidem entre as que empatam.

1. **Elegibilidade pela regra de parada da fase (Bloco 3 de `docs/diagnostics/26-ancoragem.md`).** Nenhuma forma que empurre `duracao media da partida` abaixo do piso de 29 min ou a `mediana da primeira torre` abaixo do piso de 780 s e elegivel, qualquer que seja o ganho em `abates/min`. Uma candidata inelegivel esta fora da disputa mesmo que feche a banda alvo.
2. **Entre as elegiveis, vence a que deixa `abates/min` mais perto do alvo 0,84** (distancia absoluta entre o valor medido e 0,84).
3. **Entre as que empatam na clausula 2 dentro de 0,02** (ou seja, a diferenca entre as distancias das duas candidatas ao alvo e menor ou igual a 0,02), vence a que deixa `fracao de abates ate 20:00` mais perto do alvo 0,39, porque a forma temporal e criterio proprio e nao subproduto do corte de volume.
4. **Persistindo empate**, vence a forma com MENOS degraus (menos ramos na funcao), porque cada degrau novo e um parametro novo a defender e documentar.

Se nenhuma candidata for elegivel pela clausula 1, o plano PARA: a colisao entre volume de combate e folga de duracao vira achado nomeado com os numeros dos dois lados, no padrao de D-03 do `26-CONTEXT.md`, e nenhum piso e encolhido para caber.

---

## BLOCO 2: as formas candidatas

Todas as candidatas mantem a forma de funcao pura de tempo de jogo para inteiro, com ramos em ordem crescente de tempo, e mantem os DOIS PRIMEIROS DEGRAUS intocados (`< 180s: teto 2`, `180s a 479s: teto 2`), porque eles ja estao calibrados contra os criterios de plausibilidade de multi abate da Fase 20 (FGT-01/FGT-02) e mexer neles reabriria um gate ja fechado. A diferenca entre as tres candidatas esta inteiramente no que acontece a partir de 480 s (8 min), onde a tabela atual salta direto para o teto 5 e nunca mais cai.

| candidata | tempo (s) | teto | observacao |
| --- | --- | --- | --- |
| **PRE (estado atual, sem mudanca)** | `< 180` | 2 | intocado |
| | `180 a 479` | 2 | intocado |
| | `480+` | 5 | um unico salto aos 8min, nunca mais cai |
| **A, um degrau, corte aos 15min** | `< 180` | 2 | intocado |
| | `180 a 479` | 2 | intocado |
| | `480 a 899` (8min a 15min) | **3** | degrau novo |
| | `900+` (15min+) | 5 | teto atual, depois do corte |
| **B, dois degraus, escalonando** | `< 180` | 2 | intocado |
| | `180 a 479` | 2 | intocado |
| | `480 a 839` (8min a 14min) | **3** | degrau novo 1 |
| | `840 a 1199` (14min a 20min) | **4** | degrau novo 2 |
| | `1200+` (20min+) | 5 | teto atual |
| **C, um degrau, corte aos 20min** | `< 180` | 2 | intocado |
| | `180 a 479` | 2 | intocado |
| | `480 a 1199` (8min a 20min) | **3** | degrau novo, corte diferente de A |
| | `1200+` (20min+) | 5 | teto atual, depois do corte |

**Por que estas tres.** A e C testam a MESMA forma (um unico degrau intermediario de teto 3) em dois instantes de corte diferentes (15min contra 20min), isolando a sensibilidade ao INSTANTE do corte. B testa uma forma DIFERENTE (dois degraus, 3 depois 4) para ver se escalonar em vez de saltar direto para 5 move mais volume sem custar folga de duracao. As tres preservam o teto final 5 a partir do instante escolhido, para que a fase nao mexa em teamfights de fim de jogo, que ja estao calibradas contra o teto historico.

---

## BLOCO 3: a varredura, contra o gate de ritmo COMPLETO

**Procedencia.** Cada linha roda `npm run calibrate:pace` (N=800, seis tiers, tier de referencia EQUILIBRADO) e `npm run calibrate:assists` (as tres configuracoes: CONTROLE-CARRIES, MISTO, SEM-CAMPEOES) com `maxCasualties` editado na arvore de trabalho para a forma da linha. A linha PRE roda sem nenhuma edicao, como regua. `razao agregada de assistencias por abate do time` e sempre a leitura CONTROLE-CARRIES (a config controlada por escolha de campeao), a mesma que o assert de `calibrate:assists` cobre. Artefatos: `tmp/pace-PRE-26-04.txt`, `tmp/pace-A.txt`, `tmp/pace-B.txt`, `tmp/pace-C.txt`, `tmp/assists-PRE-26-04.txt`, `tmp/assists-A.txt`, `tmp/assists-B.txt`, `tmp/assists-C.txt`.

| coluna | PRE | A (corte 15min) | B (dois degraus) | C (corte 20min) |
| --- | --- | --- | --- | --- |
| abates/min (alvo 0,84, banda [0,70; 1,00]) | 1,277 | 1,264 | 1,239 | 1,236 |
| razao de abates vencedor sobre perdedor (alvo 2,15, banda [1,80; 2,60]) | 1,120 | 1,103 | 1,102 | 1,089 |
| razao torres sobre abates (alvo 0,41, banda [0,33; 0,55]) | 0,224 | 0,225 | 0,228 | 0,230 |
| fracao de abates ate 20:00 (alvo 0,39, banda [0,32; 0,46]) | 0,506 | 0,496 | 0,503 | 0,487 |
| fracao de partidas sem abate ate 10:00 (alvo 0,11, banda [0,05; 0,20]) | 0,016 | 0,016 | 0,016 | 0,016 |
| **duracao media da partida (min)** (piso 29, teto 36) | 30,023 | 30,134 | 30,064 | 30,257 |
| **mediana da primeira torre (s)** (piso 780, teto 1140) | 810 | 810 | 810 | 810 |
| densidade comparavel 0-14min (banda [0,46; 0,68]) | 0,840 | 0,835 | 0,835 | 0,835 |
| densidade comparavel 14-20min (banda [1,19; 1,79]) | 1,224 | 1,220 | 1,207 | 1,203 |
| densidade comparavel 20min+ (banda [1,33; 1,99]) | 2,272 | 2,267 | 2,259 | 2,253 |
| densidade visivel 0-14min (banda [0,46; 1,90] PROVISORIA) | 1,830 | 1,808 | 1,808 | 1,808 |
| densidade visivel 14-20min (banda [1,19; 2,10] PROVISORIA) | 2,099 | 2,095 | 2,051 | 2,014 |
| densidade visivel 20min+ (banda [1,33; 3,60] PROVISORIA) | 3,553 | 3,547 | 3,546 | 3,517 |
| razao agregada de assistencias por abate do time (alvo 2,407, banda [2,10; 2,70], CONTROLE-CARRIES) | 1,770 | 1,779 | 1,776 | 1,776 |
| bandas vermelhas do gate inteiro (de 48 avaliadas por `expectBands`) | 17 | 17 | 17 | 17 |

**Leitura sem suavizar, antes do BLOCO 4.** Nenhuma das tres candidatas fecha `abates/min`, nenhuma fecha nenhuma banda que a linha PRE ja nao fechava, e nenhuma abre uma banda nova que a PRE fechava: **as 17 bandas vermelhas sao as mesmas 17 nas quatro linhas**, e a densidade comparavel de fase A e fase C continua estourando o teto nas quatro. O movimento em `abates/min` e pequeno (de 1,277 para 1,236 na melhor candidata, contra a distancia de 0,437 ate o alvo na linha PRE) porque a maioria das lutas do jogo ja produz poucas baixas: o teto so morde quando uma teamfight de fato tentaria concentrar 4 ou 5 mortes num tick, e isso e uma fracao pequena dos ticks de combate entre 8 e 20 minutos.

---

## BLOCO 4: a escolha

**Distancia de `abates/min` ate o alvo 0,84, clausula 1 (elegibilidade) e clausula 2 (distancia):**

| candidata | duracao media | mediana primeira torre | elegivel (clausula 1) | abates/min | distancia ate 0,84 |
| --- | --- | --- | --- | --- | --- |
| A | 30,134 (piso 29) | 810 (piso 780) | SIM | 1,264 | 0,424 |
| B | 30,064 (piso 29) | 810 (piso 780) | SIM | 1,239 | 0,399 |
| C | 30,257 (piso 29) | 810 (piso 780) | SIM | 1,236 | 0,396 |

As tres candidatas sao ELEGIVEIS pela clausula 1: nenhuma empurra a duracao media abaixo de 29 min nem a mediana da primeira torre abaixo de 780 s. A duracao media, alias, MOVEU PARA CIMA nas tres (30,064 a 30,257 contra 30,023 da PRE), o que devolve folga em vez de gasta-la, e a mediana da primeira torre nao se moveu um unico tick nas quatro linhas (810 s nas quatro).

**Clausula 2:** a candidata A tem distancia 0,424, contra 0,399 (B) e 0,396 (C). A diferenca entre A e as outras duas (0,025 e 0,028) e MAIOR que a janela de empate de 0,02 da clausula 3, entao **A esta eliminada aqui**, decidida pela clausula 2 sozinha, sem chegar a clausula 3.

B e C tem distancia 0,399 e 0,396: a diferenca entre elas e 0,003, MENOR que 0,02, entao **B e C empatam na clausula 2** e a decisao passa para a clausula 3.

**Clausula 3, fracao de abates ate 20:00 (alvo 0,39):**

| candidata | fracao de abates ate 20:00 | distancia ate 0,39 |
| --- | --- | --- |
| B | 0,503 | 0,113 |
| C | 0,487 | 0,097 |

**C tem distancia menor (0,097 contra 0,113). C VENCE pela clausula 3.**

### A candidata vencedora: C, um degrau novo, corte aos 20 minutos

```
gameTimeSec < 180   -> teto 2   (intocado)
180 <= t < 480      -> teto 2   (intocado)
480 <= t < 1200     -> teto 3   (degrau novo, 8min a 20min)
t >= 1200            -> teto 5   (teto atual, a partir de 20min)
```

**A candidata vencedora NAO fecha `abates/min`.** Isto e dito sem suavizar: 1,236 continua acima do teto da banda (1,000), a uma distancia de 0,236 do teto e 0,396 do alvo 0,84. O criterio da clausula 2 nao exige fechar a banda, exige a MENOR distancia entre as elegiveis, e C e a menor distancia medida nesta varredura. Fechar `abates/min` sozinho, sem consumir a folga de duracao/primeira torre, exigiria uma alavanca adicional (a nota de sequenciamento do roadmap ja preve `FIGHT_COOLDOWN_BY_PHASE` e os pesos de `force_fight` como as duas seguintes, planos 26-05 e adiante) ou um corte mais agressivo nos dois primeiros degraus, que este plano esta proibido de tocar.

---

## BLOCO 5: o efeito de mistura sobre a razao agregada de assistencias

**Razao agregada de assistencias por abate do time, leitura CONTROLE-CARRIES (a mesma configuracao que `calibrate:assists` asserta):**

| linha | razao agregada | diferenca contra PRE |
| --- | --- | --- |
| PRE | 1,770 | (regua) |
| C (vencedora) | 1,776 | **+0,006** |

**A alavanca primaria move a razao agregada em +0,006, praticamente nada, sem tocar em nenhuma das duas constantes do criterio 6** (`nAssists` em `engine.ts:1240` e `ASSIST_COUNT_BY_EVENT` em `selection.ts:306-313`). A candidata C reduz o teto de baixas por luta entre 8 e 20 minutos de 5 para 3, o que devia reduzir a fracao de eventos `double_kill`/`triple_kill`/`ace` (que truncam a contagem de assistencias em 4) a favor de `kill`/`gank`/`shutdown` isolados (que truncam em 2), empurrando a razao agregada PARA CIMA. O movimento medido (+0,006, 0,34 por cento relativo) e essa direcao, mas e pequeno demais para explicar qualquer fracao relevante do gap ate o alvo 2,407 (distancia de 0,631 na linha PRE, 0,631 tambem na linha C, arredondado a tres casas). **O insumo para o plano 26-06: o efeito de mistura desta alavanca isolada e desprezivel, e o gap de assistencias precisa ser fechado essencialmente pelas duas constantes do criterio 6 (`nAssists`/`ASSIST_COUNT_BY_EVENT`), nao por reducao adicional de volume de combate.**

---

## BLOCO 6: a medicao pos-alavanca, com o buraco narrativo em numero

**Procedencia.** `npm run calibrate:all` (`tmp/calibrate-all-POS-26-04.txt`) e `npm test` (`tmp/npmtest-POS-26-04.txt`), rodados na arvore com a candidata C ja implantada (commit `0967515`, Task 2 deste plano). Valores de entrada citados abaixo vem de `docs/diagnostics/26-ancoragem.md` Blocos 2, 3 e 6.

### 6.1 O placar dos gates e da suite, entrada contra agora

| medida | entrada (Bloco 4 da ancoragem) | agora | veredito |
| --- | --- | --- | --- |
| `calibrate:all` | 3 de 7 verdes (micro, structures, combat) | **3 de 7 verdes (micro, structures, combat)** | SEM MUDANCA, nenhum gate flipou |
| `npm test` (arquivos) | 58 arquivos, 0 com falha | 58 arquivos, **2 com falha** (`golden.test.ts`, `structures.test.ts`) | regressao de arquivo, detalhada em 6.1.1 |
| `npm test` (testes) | 944 testes, 0 vermelhos | **945 testes, 933 verdes, 12 vermelhos** | regressao de teste, detalhada em 6.1.1 |

**A contagem de testes subiu de 944 para 945 porque este plano ACRESCENTOU um teste** (Task 2, `combat.test.ts`: o bloco unico "8min+ retorna 5" virou dois blocos, "8-20min retorna 3" e "20min+ retorna 5"), nao porque algo dobrou.

### 6.1.1 Os doze testes vermelhos, nomeados um a um, sem misturar categorias

**Onze sao deslocamento de VALOR, esperado e documentado ANTES desta medicao:**

- **nove em `src/__tests__/golden/golden.test.ts`** (as nove sementes do golden): o comportamento de combate mudou de proposito (candidata C), e o golden mede exatamente esse comportamento por hash de timeline. O orcamento de regeneracao desta fase (uma unica vez) pertence ao plano de fechamento (26-10), nao a este Task, exatamente como a acao do Task 2 instruiu.
- **duas em `src/sim/structures.test.ts`, describe "extracao no-op -- aridade de RNG preservada (D-05)"** (seeds 0 e 5, tier STOMP 85v55): o proprio cabecalho deste describe (linhas 62-78 do arquivo) ja documenta a mesma distincao que o golden usa, escrita na Fase 25 para o canal de cerco estrutural e generica para qualquer alavanca que mude o throughput: "vermelho aqui e deslocamento de VALOR... a menos que os canarios de auto-consistencia (determinismo por seed, mesma seed produz timeline identica; ver o proprio describe, testes "simulacao com mesma seed produz resultado identico" e "seeds 0 e 5 produzem assinaturas distintas") fiquem vermelhos". **Os dois canarios de auto-consistencia continuam VERDES** nesta rodada (conferido em `tmp/npmtest-POS-26-04.txt`), confirmando que os dois vermelhos aqui sao deslocamento de valor pela candidata C, nao regressao de aridade de RNG. Nao regenerados neste Task pela mesma razao do golden: orcamento pertence ao fechamento.

**Um e um ACHADO NOMEADO, registrado por extenso em `.planning/phases/26-volume-de-combate-e-densidade-narrativa/deferred-items.md` (D-26-01), com o resumo aqui:**

- **`src/sim/structures.test.ts > win-condition structural gating > ordering: nexus_exposed precedes gg...`** falha na seed 44 do tier 72v70: nenhum evento `inhibitor_destroyed` aparece na timeline antes do `nexus_exposed`. A causa raiz esta em `resolveHeraldUse` (`src/sim/structures.ts:1077`, especificamente linhas 1137-1148): quando o Arauto e o ator que derruba especificamente o INIBIDOR (nao uma torre), a funcao SEMPRE emite `kind: "tower_low"` no evento da timeline, mascarando o `inhibitor_destroyed` real, embora a mutacao de estado (`team.inhibitorsDestroyed += 1`) esteja correta. **Provado pre-existente e nao causado por este plano:** o mesmo teste, rodado com `src/sim/combat.ts` restaurado temporariamente ao commit anterior a este plano (`f7b0ab4`, checkout de um unico arquivo seguido de restauracao para `HEAD` ao fim, arvore verificada limpa por `git status --short` e por `git diff --stat HEAD -- src/sim/combat.ts` vazio), **PASSA nas 60 seeds do tier**. O que este plano fez foi mudar quantas mortes cada luta permite entre 8 e 20 minutos, o que desloca a sequencia de sorteios consumidos a partir dali; para a seed 44 especificamente, essa mudanca de trajetoria fez o Arauto ser o ator que derruba o inibidor da lane vencedora, caminho que a trajetoria antiga (teto 5 direto aos 8min) nao percorria para essa seed. `resolveHeraldUse` esta fora dos arquivos que este plano autoriza tocar (`docs/diagnostics/26-sweep.md`, `src/sim/combat.ts`, `src/sim/combat.test.ts`), entao o conserto fica **SEM DONO**, candidato natural a Fase 30 (fechamento, revisao em bloco), no mesmo padrao de outros achados de rotulagem de evento estrutural desta milestone.

### 6.2 As duas bandas de folga, entrada contra agora

| grandeza | folga de entrada | folga agora | quanto a alavanca consumiu |
| --- | --- | --- | --- |
| duracao media da partida (min), piso 29 | 1,023 min (30,023 min) | **1,257 min (30,257 min)** | **DEVOLVEU 0,234 min** (a duracao subiu, nao caiu) |
| mediana da primeira torre (s), piso 780 | 30 s (810 s) | **30 s (810 s)** | **ZERO**, nao se moveu um unico tick |

**A alavanca primaria nao gastou a folga que a Fase 25C deixou: ela devolveu folga de duracao e nao tocou a folga de primeira torre.** Isto e o oposto do risco que `docs/diagnostics/26-ancoragem.md` Bloco 3 nomeou antes de qualquer numero mudar (cortar volume de combate tende a encurtar a partida): reduzir o teto de baixas por luta faz cada luta demorar mais para resolver o mesmo numero de objetivos (menos mortes por luta significa mais lutas ou lutas mais longas para alcancar o mesmo estado de jogo), o que empurra a duracao para CIMA em vez de para baixo nesta amostra.

### 6.3 As seis bandas de densidade, entrada contra agora, com a frase do criterio 4

| banda | piso | teto | entrada | agora | veredito |
| --- | --- | --- | --- | --- | --- |
| densidade comparavel 0-14min | 0,46 | 0,68 | 0,840 | 0,835 | **TETO estourado** (vermelha, sem mudanca de lado) |
| densidade comparavel 14-20min | 1,19 | 1,79 | 1,224 | 1,203 | dentro (verde), folga contra o piso caiu de 0,034 para 0,013 |
| densidade comparavel 20min+ | 1,33 | 1,99 | 2,272 | 2,253 | **TETO estourado** (vermelha, sem mudanca de lado) |
| densidade visivel 0-14min (PROVISORIA) | 0,46 | 1,90 | 1,830 | 1,808 | dentro (verde) |
| densidade visivel 14-20min (PROVISORIA) | 1,19 | 2,10 | 2,099 | 2,014 | dentro (verde) |
| densidade visivel 20min+ (PROVISORIA) | 1,33 | 3,60 | 3,553 | 3,517 | dentro (verde) |

**A frase que o criterio 4 do roadmap cobra, sem suavizar: NENHUMA fase de jogo ficou abaixo do piso de densidade nesta rodada.** As tres bandas comparaveis que ja estouravam o TETO na entrada (fase A e fase C) continuam estourando o TETO, muito pouco movidas (0,840 para 0,835; 2,272 para 2,253), porque esta candidata sozinha move `abates/min` muito pouco (BLOCO 3: de 1,277 para 1,236, contra a distancia de 0,437 ate o alvo 0,84). **O buraco narrativo que o objetivo deste plano previu ainda NAO apareceu como numero**, porque o corte de volume desta unica alavanca e pequeno demais para revelar-lo: a fase B comparavel, a mais proxima do piso, perdeu folga (de 0,034 para 0,013 contra o piso 1,19) mas continua verde. **A leitura para os planos seguintes (26-05, 26-06): a alavanca primaria sozinha nao fecha `abates/min` nem abre o buraco de densidade; as duas coisas dependem do efeito cumulativo das alavancas seguintes (`FIGHT_COOLDOWN_BY_PHASE`, pesos de `force_fight`), e a vigilancia da fase B comparavel (piso mais proximo) precisa continuar a cada alavanca nova.**

### 6.4 A razao agregada de assistencias, antes e depois, atribuida a mistura

| linha | razao agregada (CONTROLE-CARRIES) | diferenca |
| --- | --- | --- |
| entrada (PRE, sem a alavanca) | 1,770 | (regua) |
| agora (candidata C implantada) | 1,776 | **+0,006** |

**Confirmado nesta rodada (mesma leitura do BLOCO 5): a diferenca de +0,006 e inteiramente atribuivel ao efeito de mistura da alavanca primaria, nao a nenhuma constante do criterio 6** (`nAssists`/`ASSIST_COUNT_BY_EVENT`, nenhuma tocada por este plano). O movimento e pequeno demais para fechar qualquer fracao relevante do gap ate o alvo 2,407.

### 6.5 A leitura que fecha o bloco, em uma frase e sem suavizar

**O volume NAO esta dentro** (`abates/min` = 1,236 contra a banda [0,70; 1,00], distancia de 0,236 ate o teto e 0,396 ate o alvo) **e o playback do early game NAO ficou abaixo do piso de densidade** (as tres bandas visiveis e a comparavel de fase B seguem verdes; as comparaveis de fase A e C, que ja estouravam o TETO por excesso de sangue antes desta alavanca, continuam estourando o TETO, quase sem mudanca). As duas coisas nao colidiram nesta rodada: nenhuma banda de densidade caiu abaixo do piso, e a folga de duracao/primeira torre nao foi gasta (Bloco 6.2). O risco nomeado no objetivo deste plano (a colisao entre fechar `abates/min` e abrir o buraco narrativo) permanece **nao materializado** com apenas esta alavanca; ele so pode ser avaliado de fato depois que `FIGHT_COOLDOWN_BY_PHASE` e os pesos de `force_fight` (planos 26-05 e seguintes) tambem tiverem sido movidos, porque e o efeito cumulativo das tres alavancas, e nao esta sozinha, que a nota de sequenciamento do roadmap preve fechar a banda.

---

*Sweep completo: BLOCO 1 escrito antes de qualquer numero (verificavel por ordem de commit), tres candidatas medidas contra o gate de ritmo inteiro (48 bandas avaliadas por linha, nao so `abates/min`), efeito de folga e efeito de mistura registrados. A implantacao da candidata C aconteceu no Task 2 deste plano (commit `0967515`). A medicao pos-alavanca (BLOCO 6) confirma zero regressao de banda de gate, zero consumo de folga (a duracao ate devolveu folga), e um achado de rotulagem de evento pre-existente exposto pela mudanca de trajetoria de RNG, registrado sem dono em `deferred-items.md` (D-26-01) em vez de consertado fora do escopo deste plano.*

---
---

# Fase 26 Plano 05: as duas alavancas secundarias, espera entre lutas e pesos de luta forcada

**Fase:** 26-volume-de-combate-e-densidade-narrativa
**Plano de origem:** 26-05
**Commit base deste plano:** `db9d1ba` (HEAD ao abrir o plano; `src/sim/engine.ts` intocado por 26-01 a 26-04, unico arquivo de `src/sim/` mudado desde a ancoragem foi `combat.ts` no plano 26-04)
**Proposito, em uma linha:** consertar a FORMA temporal do combate (quando as lutas acontecem) e a separacao de placar entre vencedor e perdedor, com as duas alavancas secundarias autorizadas, cada uma varrida isoladamente e com linha PRE propria, sem tocar na janela de ruido das lutas nem no impulso do time atrasado.

---

## BLOCO 7: a varredura da espera entre lutas (`FIGHT_COOLDOWN_BY_PHASE`), isolada

### O CRITERIO, escrito antes dos numeros, valendo para os dois Tasks de varredura deste plano

Continua valendo a clausula 1 do BLOCO 1 (nenhuma configuracao que viole a regra de parada de folga de `docs/diagnostics/26-ancoragem.md` Bloco 3 e elegivel: piso de 29 min de duracao media, piso de 780 s de mediana da primeira torre). Entre as elegiveis, vence a que aproxima simultaneamente `fracao de abates ate 20:00` de 0,39 e `fracao de partidas sem abate ate 10:00` do intervalo declarado [0,05; 0,20], medindo a distancia como **soma das distancias relativas ao alvo (ou ao limite mais proximo da banda, quando a leitura esta fora dela) de cada uma**. Empate (diferenca de soma menor que 0,02, mesma janela usada pelo criterio do BLOCO 1) se resolve pela `razao de abates vencedor sobre perdedor` mais alta.

### AS CANDIDATAS, com o mecanismo declarado ANTES de rodar

A tabela de espera entre lutas completas hoje (linha PRE, commitada pelo plano 26-04):

| fase | `FIGHT_COOLDOWN_BY_PHASE` hoje |
| --- | --- |
| early (< 14:00) | 165 s |
| mid (14:00 a 25:00, ou ate inibidor/Alma/Barao) | 100 s |
| late (>= 25:00, ou por gatilho) | 75 s |

O mecanismo declarado no objetivo deste plano: **espera MAIOR no inicio produz early game mais vazio** (mede `fracao de partidas sem abate ate 10:00`, hoje 0,016 contra a banda [0,05; 0,20], MUITO abaixo do piso); **espera MENOR no fim concentra sangue no late** (mede `fracao de abates ate 20:00`, hoje 0,487 contra a banda [0,32; 0,46], estourando o TETO). As duas fases (`early`, `late`) sao mutuamente distantes no tempo de jogo e a mudanca em uma nao deveria mascarar o efeito da outra, o que autoriza uma terceira candidata combinando as duas isoladas para medir se os efeitos se somam.

| candidata | `early` | `mid` | `late` | mecanismo, declarado antes do numero |
| --- | --- | --- | --- | --- |
| **A, so o early** | **220** (+55) | 100 (intocado) | 75 (intocado) | espera maior isolada na fase early: menos teamfights completos antes de 14:00 deveria esvaziar o early game e mover `fracao sem abate ate 10:00` para cima |
| **B, so o late** | 165 (intocado) | 100 (intocado) | **50** (-25) | espera menor isolada na fase late: mais teamfights completos depois da entrada em late deveria concentrar sangue depois de 20:00 e mover `fracao de abates ate 20:00` para baixo |
| **C, as duas juntas** | **220** (+55) | 100 (intocado) | **50** (-25) | soma das duas candidatas isoladas: testa se os dois mecanismos se acumulam sem interferencia, ja que agem em janelas de tempo de jogo distintas |

`mid` fica intocado nas tres candidatas porque a banda que mais precisa de causa isolada (`fracao de abates ate 20:00`) mistura tempo pre e pos 20:00 dentro da fase `mid` (14:00 a 25:00): mexer em `mid` moveria os dois lados do corte de 20:00 pelo mesmo mecanismo, o que impediria atribuir causa a um lado especifico do corte.

### A MEDICAO, identica em formato ao BLOCO 3

Cada linha roda `npm run calibrate:pace` (N=800, seis tiers, tier de referencia EQUILIBRADO) e `npm run calibrate:assists` (leitura CONTROLE-CARRIES) com `FIGHT_COOLDOWN_BY_PHASE` editado na arvore de trabalho para os valores da linha. A linha PRE roda sem nenhuma edicao (a tabela commitada pelo plano 26-04, identica a candidata C do BLOCO 3). Artefatos: `tmp/pace-PRE-26-05.txt`, `tmp/pace-A-26-05.txt`, `tmp/pace-B-26-05.txt`, `tmp/pace-C-26-05.txt`, `tmp/assists-PRE-26-05.txt`, `tmp/assists-A-26-05.txt`, `tmp/assists-B-26-05.txt`, `tmp/assists-C-26-05.txt`.

| coluna | PRE | A (so early +55) | B (so late -25) | C (as duas) |
| --- | --- | --- | --- | --- |
| abates/min (alvo 0,84, banda [0,70; 1,00]) | 1,236 | 1,235 | 1,300 | 1,296 |
| razao de abates vencedor sobre perdedor (alvo 2,15, banda [1,80; 2,60]) | 1,089 | 1,096 | 1,060 | 1,076 |
| razao torres sobre abates (alvo 0,41, banda [0,33; 0,55]) | 0,230 | 0,230 | 0,219 | 0,219 |
| **fracao de abates ate 20:00 (alvo 0,39, banda [0,32; 0,46])** | 0,487 | 0,484 | 0,470 | 0,467 |
| **fracao de partidas sem abate ate 10:00 (alvo 0,11, banda [0,05; 0,20])** | 0,016 | 0,016 | 0,016 | 0,016 |
| duracao media da partida (min) (piso 29, teto 36) | 30,257 | 30,198 | 30,345 | 30,314 |
| mediana da primeira torre (s) (piso 780, teto 1140) | 810 | 810 | 810 | 810 |
| densidade comparavel 0-14min (banda [0,46; 0,68]) | 0,835 | 0,829 | 0,835 | 0,829 |
| densidade comparavel 14-20min (banda [1,19; 1,79]) | 1,203 | 1,209 | 1,206 | 1,213 |
| densidade comparavel 20min+ (banda [1,33; 1,99]) | 2,253 | 2,276 | 2,307 | 2,322 |
| densidade visivel 0-14min (banda [0,46; 1,90] PROVISORIA) | 1,808 | 1,799 | 1,808 | 1,799 |
| densidade visivel 14-20min (banda [1,19; 2,10] PROVISORIA) | 2,014 | 2,019 | 2,019 | 2,025 |
| densidade visivel 20min+ (banda [1,33; 3,60] PROVISORIA) | 3,517 | 3,553 | 3,622 | 3,645 |
| razao agregada de assistencias por abate do time (alvo 2,407, banda [2,10; 2,70], CONTROLE-CARRIES) | 1,776 | 1,772 | 1,779 | 1,775 |
| bandas vermelhas do gate inteiro (de 48 avaliadas por `expectBands`) | 17 | 17 | **18** | **18** |

**A regressao nomeada, antes da escolha.** B e C abrem UMA banda nova em vermelho que a linha PRE fechava: `densidade visivel 20min+` (PROVISORIA), que sobe de 3,517/3,553 para 3,622 (B) e 3,645 (C), estourando o teto provisorio de 3,60. A causa e o mesmo mecanismo declarado: reduzir a espera em `late` faz mais teamfights completos caberem depois de 20:00, e cada teamfight emite mais eventos por minuto de exposicao do que a farm que ocupava aquele tempo antes. A banda e PROVISORIA (sem fonte externa citavel, dona Fase 26 por construcao, ver `docs/diagnostics/26-ancoragem.md` Bloco 6.5) e nao entra no criterio de elegibilidade da clausula 1 (que so cobre duracao e primeira torre), mas o achado fica registrado aqui e nao escondido: mover `late` para baixo tem custo narrativo mensuravel no proprio eixo (NAR-01) que este plano existe para servir.

### A ELEGIBILIDADE, clausula 1

| candidata | duracao media | mediana primeira torre | elegivel |
| --- | --- | --- | --- |
| A | 30,198 (piso 29) | 810 (piso 780) | SIM |
| B | 30,345 (piso 29) | 810 (piso 780) | SIM |
| C | 30,314 (piso 29) | 810 (piso 780) | SIM |

As tres sao ELEGIVEIS: nenhuma fere o piso de duracao nem o piso de primeira torre, e a mediana da primeira torre nao se move um unico tick nas quatro linhas (810 s), porque `FIGHT_COOLDOWN_BY_PHASE` gate teamfights completos e nao a queda de estrutura por dano acumulado, que e o mecanismo que decide a primeira torre.

### A CLAUSULA 2, a distancia relativa somada

Distancia relativa de `fracao de abates ate 20:00` ao alvo 0,39: `|valor - 0,39| / 0,39`. Distancia relativa de `fracao de partidas sem abate ate 10:00`: a leitura esta ABAIXO do piso da banda (0,05) nas quatro linhas, entao a distancia e ao piso, `(0,05 - valor) / 0,05`.

| candidata | fracao abates 20:00 | distancia | fracao sem abate 10:00 | distancia | **soma** |
| --- | --- | --- | --- | --- | --- |
| PRE | 0,487 | 0,2487 | 0,016 | 0,6800 | 0,9287 |
| A | 0,484 | 0,2410 | 0,016 | 0,6800 | 0,9210 |
| B | 0,470 | 0,2051 | 0,016 | 0,6800 | 0,8851 |
| **C** | **0,467** | **0,1974** | 0,016 | 0,6800 | **0,8774** |

**C tem a menor soma (0,8774), a diferenca contra B (0,8851) e 0,0077, MENOR que a janela de empate de 0,02.** Pela regra do criterio, isso e empate entre B e C, e a decisao passa para a clausula 3 (`razao de abates vencedor sobre perdedor` mais alta).

### A CLAUSULA 3, o desempate entre B e C

| candidata | razao de abates vencedor sobre perdedor |
| --- | --- |
| B | 1,060 |
| **C** | **1,076** |

**C tem a razao mais alta (1,076 contra 1,060). C VENCE o desempate da clausula 3.**

A vencedora e a candidata A? Nao: A foi decidida sozinha pela clausula 2 sem chegar ao empate, com soma 0,9210 contra 0,8774/0,8851 de C/B, uma diferenca de pelo menos 0,04, MAIOR que a janela de 0,02. **A esta eliminada na clausula 2.**

### A candidata vencedora: C, as duas fases juntas

```
early (< 14:00)                 -> 220 s  (era 165 s, +55 s)
mid   (14:00 a 25:00 ou gatilho) -> 100 s  (intocado)
late  (>= 25:00 ou gatilho)      ->  50 s  (era 75 s, -25 s)
```

**A candidata vencedora NAO fecha nenhuma das duas bandas que este Task ataca.** Isto e dito sem suavizar: `fracao de abates ate 20:00` fica em 0,467, ainda 0,007 acima do teto da banda (0,46); `fracao de partidas sem abate ate 10:00` fica em 0,016, distante 15 vezes do piso da banda (0,05). O criterio da clausula 2 nao exige fechar as bandas, exige a MENOR soma de distancia entre as elegiveis, e C e essa candidata. **O mecanismo de `fracao sem abate ate 10:00` nao respondeu de forma pratica a nenhuma das tres candidatas** (0,016 nas quatro linhas, PRE incluida): o corte de decimais escondia isso ate a quarta casa (0,0163 a 0,0165 nas quatro linhas, medido em `tmp/pace-*-26-05.txt`), e a razao esta no proprio mecanismo do gate: `FIGHT_COOLDOWN_BY_PHASE` so regula teamfights completos (5v5 ou perto disso), e os poucos abates que acontecem antes de 10:00 nesta engine vem majoritariamente de ganks e pickoffs isolados (`resolveGankOrPickoff`), que nao passam pelo gate de `fightCooldownSec`. Esticar a espera entre teamfights nao pode esvaziar um canal de abate que ele nunca controlou. Este e o insumo direto para o BLOCO 9: a banda `fracao de partidas sem abate ate 10:00` provavelmente precisa de uma alavanca em ganks/pickoffs, que este plano nao autoriza tocar, para se mover de fato.

**IMPLANTADO.** `src/sim/engine.ts`, `FIGHT_COOLDOWN_BY_PHASE`: `early` de 165 para 220 (BLOCO 7, candidata C, linha da clausula 3), `late` de 75 para 50 (BLOCO 7, candidata C, linha da clausula 3), `mid` mantido em 100 (intocado pelas tres candidatas). Comentario de uma linha por valor alterado citando este bloco, no proprio `engine.ts`.

---

## BLOCO 8: os pesos de luta forcada, isolados, e a fronteira da razao vencedor sobre perdedor

### O ALVO PRINCIPAL e o mecanismo, escritos antes dos numeros

A `razao de abates vencedor sobre perdedor` e a banda mais distante da fase: PRE deste Task (a tabela commitada pelo BLOCO 7) mede **1,076** contra a banda [1,80; 2,60], distancia de 0,724 ate o piso. O mecanismo esta no proprio `chooseIntent` (`src/sim/engine.ts`): seis ramos somam peso a `force_fight` hoje (`ownElder` +4, `ownBaron` +1.5, ambos +3, `ahead` +0.5, `late-phase` +0.7; `behind` **nao tem ramo**, so ganha `pickoff` +1.0 e `split_push` +0.8). O time a frente recebe pouco peso de luta forcada (0.5, o menor dos cinco ramos ja existentes) e o time atrasado nao recebe nenhum, o que produz uma partida em que os dois lados forcam luta com frequencia parecida e portanto morrem quase igual. O mecanismo declarado: **aumentar o peso do ramo `ahead` (e, separadamente, o do ramo `late-phase`, que tambem esta subponderado em 0.7) deveria fazer o time favorito converter mais vezes sua vantagem de `fightPower` em luta completa**, em vez de deixar essa vantagem represada em farm/press, empurrando a razao agregada de abates para cima ao longo de muitas partidas.

### AS CANDIDATAS, com a hipotese escrita ANTES da medicao

Nenhuma candidata introduz intencao nova, funcao nova ou consumo novo do gerador: todas sao valores dentro da mesma estrutura de `weights`/`add()` de `chooseIntent`, e nenhuma toca a janela de ruido das lutas nem o impulso do time atrasado (verificado byte a byte no verify deste Task).

| candidata | ramo alterado | valor | hipotese, declarada antes do numero |
| --- | --- | --- | --- |
| **D** | `ahead` | 0,5 -> **3** (+2,5) | subir o peso do time a frente ao mesmo patamar do `ownBaron` (1,5) e metade do `ownElder` (4) deveria fazer o favorito forcar luta com muito mais frequencia quando tem vantagem, convertendo a vantagem de `fightPower` (ja existente e nao tocada) em mais vitorias de luta completa acumuladas ao longo da partida |
| **E** | `late-phase` | 0,7 -> **2,5** | subir o peso da fase final deveria concentrar mais luta completa depois da entrada em late, quando a diferenca de forca entre os times ja teve tempo de se expressar (gold, level), favorecendo o lado mais forte com mais consistencia que o early/mid |
| **F** | `ahead` | 0,5 -> **1,5** | um aumento mais moderado do mesmo ramo de D, para medir se a resposta e aproximadamente linear ou se ha retornos decrescentes antes do patamar de D |
| **G** | `ahead` | 0,5 -> **7** (mais que o dobro de D) | sonda de fronteira: se D melhora a razao, empurrar o mesmo ramo bem mais alem deveria mostrar se o mecanismo continua rendendo ou se ja saturou, respondendo diretamente "o que quebra quando se tenta passar dali" |

`mid`, `ownBaron`, `ownElder` e o ramo combinado `ownBaron && ownElder` ficam intocados nas quatro candidatas: o objetivo deste Task e isolar os dois ramos mais subponderados (`ahead`, `late-phase`), nao redistribuir peso nos ramos ja fortes.

### A MEDICAO, mesmo formato do BLOCO 7

PRE deste Task e a tabela commitada pelo BLOCO 7 (candidata C do `FIGHT_COOLDOWN_BY_PHASE`, ja implantada). Cada linha roda `npm run calibrate:pace` e `npm run calibrate:assists` (leitura CONTROLE-CARRIES) com o ramo de `chooseIntent` editado na arvore de trabalho. Artefatos: `tmp/pace-PRE-Task2-26-05.txt`, `tmp/pace-D-26-05.txt`, `tmp/pace-E-26-05.txt`, `tmp/pace-F-26-05.txt`, `tmp/pace-G-26-05.txt`, `tmp/assists-PRE-Task2-26-05.txt`, `tmp/assists-D-26-05.txt`, `tmp/assists-E-26-05.txt`, `tmp/assists-F-26-05.txt`.

| coluna | PRE | D (ahead=3) | E (late=2,5) | F (ahead=1,5) | G (ahead=7, sonda) |
| --- | --- | --- | --- | --- | --- |
| **razao de abates vencedor sobre perdedor (alvo 2,15, piso 1,80)** | 1,076 | **1,129** | 1,022 | 1,107 | 1,109 |
| abates/min (alvo 0,84, banda [0,70; 1,00]) | 1,296 | 1,700 | 1,587 | 1,494 | 1,959 |
| razao torres sobre abates (alvo 0,41, banda [0,33; 0,55]) | 0,219 | 0,178 | 0,182 | 0,195 | 0,153 |
| fracao de abates ate 20:00 (alvo 0,39, banda [0,32; 0,46]) | 0,467 | 0,496 | 0,387 (DENTRO) | 0,505 | 0,474 |
| fracao de partidas sem abate ate 10:00 | 0,016 | 0,016 | 0,016 | 0,016 | 0,016 |
| duracao media da partida (min) (piso 29) | 30,314 | 30,422 | 31,779 | 29,802 | 31,698 |
| mediana da primeira torre (s) (piso 780) | 810 | 795 | 810 | 810 | nao coletado (elegibilidade ja decidida por D/F) |
| densidade comparavel 0-14min (teto 0,68) | 0,829 | 0,920 | 0,829 | 0,880 | 1,009 |
| densidade comparavel 20min+ (teto 1,99) | 2,322 | 2,586 | 2,542 | 2,437 | 2,657 |
| razao agregada de assistencias (CONTROLE-CARRIES) | 1,775 | 1,772 | 1,764 | 1,771 | nao coletado |
| bandas vermelhas do gate inteiro (de 48) | **18** | **23** | 18 | 20 | **25** |

**Leitura sem suavizar, candidata a candidata.**

- **E (so `late-phase`) e a UNICA que fecha uma banda nova** (`fracao de abates ate 20:00` entra em [0,32; 0,46] com 0,387), mas faz isso as custas da propria razao vencedor sobre perdedor, que CAI para 1,022, abaixo da propria linha PRE (1,076). O mecanismo declarado nao se confirmou: subir peso de luta forcada na fase final aumenta a frequencia de luta completa para os DOIS lados igualmente (o ramo nao discrimina por `ahead`/`behind`), e mais luta completa symmetrica dilui a razao em vez de separa-la, alem de consumir 1,465 min de folga de duracao (de 1,257 min de folga do BLOCO 7 para -0,208, quase estourando o piso).
- **D (so `ahead`) e a que MAIS move a razao alvo** (1,076 para 1,129, um ganho de 0,053), confirmando parcialmente o mecanismo declarado, mas a **um custo desproporcional**: `abates/min` salta de 1,296 para 1,700 (31 por cento acima da propria linha PRE, que ja estava 30 por cento acima do teto da banda), e o gate inteiro perde CINCO bandas que estavam verdes (18 para 23 vermelhas), incluindo bandas de OUTRAS fases que a linha PRE fechava: `torres aos 20:00` (Fase 25), `DISPERSAO torres por minuto` (Fase 25B) e `ACOPLAMENTO P2 baron_taken depois torre` (Fase 25C, que a fase existe justamente para PRESERVAR, ver `docs/diagnostics/25C-ancoragem.md`).
- **F (`ahead` mais moderado, 1,5) confirma que a resposta NAO e linear**: com 3x menos peso adicional que D (1,0 contra 2,5), F entrega 72 por cento do ganho de razao de D (0,031 contra 0,053) mas ja abre DUAS bandas novas em vermelho (20 contra as 18 da PRE) e piora `fracao de abates ate 20:00` na direcao ERRADA (0,505, pior que a PRE 0,467, porque mais luta completa cedo tambem empurra sangue para antes de 20:00).
- **G (`ahead` = 7, sonda de fronteira) prova que o mecanismo SATUROU antes de D**: dobrar o peso de D (3 para 7) NAO melhora a razao (1,109, PIOR que os 1,129 de D) e piora TUDO o resto: `abates/min` sobe para 1,959 (51 por cento acima da PRE), `torres sobre abates` cai para 0,153 (o pior de toda a varredura deste plano) e o gate perde mais duas bandas (25 vermelhas). **Isto e o que quebra quando se tenta passar da regiao de D**: a partir de peso ~3 no ramo `ahead`, o retorno em razao ja e negativo e o custo em volume/densidade continua subindo, porque o ramo compete com `farm` (peso base 4,0) e, alem de um certo ponto, passa a dominar a selecao de intencao do time a frente em quase todo tick, tornando as partidas uma sequencia quase continua de teamfights em vez de farm pontuado por luta.

### A FRONTEIRA, medida dos dois lados

**O maior valor de razao alcancado nesta varredura e 1,129 (candidata D, `ahead` de 0,5 para 3), contra o piso 1,80: falta 0,671, ou 37 por cento do valor do piso.** A configuracao que o produziu esta descrita acima. O que quebra ao tentar passar dali (candidata G, o dobro do peso de D): a razao NAO continua subindo (1,109, abaixo de D) e o custo colateral cresce monotonicamente em toda outra dimensao medida (abates/min, torres/abates, densidade, contagem de bandas vermelhas do gate inteiro). **A regiao de fechamento para este par, com as alavancas autorizadas neste plano, esta PROVADA VAZIA**: nenhum ponto entre 0,5 e 7 no ramo `ahead`, isolado ou somado ao ramo `late-phase`, aproxima a razao do piso 1,80 sem primeiro destruir bandas que a linha PRE fechava, incluindo bandas de FORA da Fase 26 que outras fases desta milestone existem para preservar.

**NAO IMPLANTADO.** Nenhuma das quatro candidatas e implantada. A razao pela qual isto NAO e "a vencedora e a propria PRE, entao nada muda por omissao" (o caso trivial que o Task previa): D tecnicamente move a razao-alvo mais que a PRE (1,129 contra 1,076), mas o proprio padrao que este plano e a fase inteira praticam desde o BLOCO 1 (medir contra o GATE INTEIRO, nao so a banda alvo, e nunca afrouxar uma banda para acomodar outra) reprova D quando julgada pelo mesmo padrao: ela transforma 5 bandas verdes em vermelhas (17 para 22 fora da propria banda-alvo, isto e 18 para 23 no total incluindo a banda-alvo que ja era vermelha), tres delas de fases QUE NAO SAO A FASE 26 e que a nota de sequenciamento do roadmap e os proprios documentos daquelas fases (`25-ancoragem`, `docs/diagnostics/25B-ancoragem.md`, `docs/diagnostics/25C-ancoragem.md`) registram como fechadas por medicao. Implantar D trocaria um ganho de 0,053 na banda mais distante da fase por regressao medida em bandas de tres fases diferentes, o oposto do que T-26-16 (ver `threat_model` deste plano) existe para impedir. A engine permanece exatamente na configuracao commitada pelo BLOCO 7 ao fim deste Task.

### As duas alavancas fora de escopo, com o dono proposto

A leitura honesta desta fronteira: **as duas alavancas que provavelmente fechariam esta banda estao fora do escopo deste plano por desenho, nao por omissao.** A janela de ruido das lutas (`0.575 + rng() * 0.85` em `resolveTeamfight`, `src/sim/engine.ts` linhas 1133-1134) e o impulso do time atrasado (`behindBoost`, `src/sim/engine.ts` linhas 2154-2163) sao as duas unicas partes do calculo de `resolveTeamfight` que decidem o **tamanho** da vantagem entre `pInit` e `pDef`, isto e, o quanto o lado mais forte de fato vence mais folgado quando a luta acontece. Os pesos de `force_fight` varridos neste Task so controlam a **frequencia** com que a luta acontece e quem inicia, nunca o tamanho da vantagem dentro dela, e e por isso que mesmo saturando a frequencia (candidata G) a razao nao ultrapassa 1,13: o motor deliberadamente estreita a vantagem de qualquer lado dentro de cada luta individual (janela de +-42,5 por cento) e ainda reforca o lado atrasado com o `behindBoost`, os dois calibrados e documentados com dono em `docs/diagnostics/25C-ancoragem.md` e nos commits que fecharam o criterio 3 da Fase 25 (tier DOMINANTE, decisividade do Elder). Mexer nos dois aqui fecharia uma banda desta fase abrindo bandas da Fase 25/25C, exatamente a troca que a fase nao pode fazer sozinha.

**Dono proposto: Fase 30 (fechamento, revisao em bloco), na mesma decisao de escopo que ja existe para D-25C-06/07/08 e para D-25B-05** (`STATE.md`, registro da Fase 25C: "SEM DONO, decisao de escopo"). A Fase 30 e o unico ponto do roadmap desta milestone com mandato explicito de revisar em bloco constantes que atravessam fronteiras de fase (ver `ROADMAP.md`, Fase 30). Nenhuma das duas constantes foi editada por este Task: prova automatizada no verify (janela de ruido byte a byte) e leitura manual (impulso do time atrasado, byte a byte identico por `git diff` contra o commit do BLOCO 7).

Commit: `feat(26-05): pesos de luta forcada recalibrados com a fronteira da razao vencedor sobre perdedor medida`

---

## BLOCO 9: a medicao consolidada das quatro bandas de combate

**Procedencia.** `npm run calibrate:all` (`tmp/calibrate-all-POS-26-05.txt`) e `npm test` (`tmp/npmtest-POS-26-05.txt`), rodados na arvore com a candidata C do BLOCO 7 ja implantada e nada do BLOCO 8 implantado (a engine, portanto, esta identica ao commit do BLOCO 7). Valores de entrada da fase citados abaixo vem de `docs/diagnostics/26-ancoragem.md` Blocos 2 e 5; valores pos-plano-26-04 vem do BLOCO 6 deste mesmo arquivo.

### 9.1 As quatro bandas de CBT (CBT-01 a CBT-04), entrada contra pos-26-04 contra agora

Os quatro requisitos mapeiam cinco metricas medidas: CBT-01 (criterio 1 do roadmap, taxa de abates) e uma metrica; CBT-02 e CBT-03 (criterio 2, razao vencedor/perdedor e razao torres/abates) sao duas metricas; CBT-04 (criterio 3, forma temporal) e duas metricas (fracao ate 20:00 e fracao sem abate ate 10:00). A tabela traz as cinco, para que a contribuicao de cada onda (26-04 e 26-05) seja legivel numa unica linha por metrica.

| requisito | banda | entrada da fase | pos-26-04 | agora (pos-26-05) | piso | teto | veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CBT-01 | abates/min | 1,277 | 1,236 | **1,296** | 0,70 | 1,00 | **TETO estourado**, falta 0,296; PIOROU 0,060 nesta onda (26-05 nao e alavanca de volume, e o corte de folga de duracao ja estava esgotado no BLOCO 7) |
| CBT-02 | razao de abates vencedor/perdedor | 1,120 | 1,089 | **1,076** | 1,80 | 2,60 | **PISO estourado**, falta 0,724; PIOROU nas DUAS ondas desta fase (1,120 -> 1,089 -> 1,076), monotonicamente, apesar de duas alavancas dedicadas a ela |
| CBT-03 | razao torres sobre abates | 0,224 | 0,230 | **0,219** | 0,33 | 0,55 | **PISO estourado**, falta 0,111; melhorou no 26-04 e PIOROU no 26-05 (a razao e derivada do mesmo denominador de abates, que a alavanca de cooldown moveu na direcao errada) |
| CBT-04 | fracao de abates ate 20:00 | 0,506 | 0,487 | **0,467** | 0,32 | 0,46 | **TETO estourado, mas por pouco**: falta apenas 0,007, a menor distancia de toda a fase ate aqui; melhorou nas DUAS ondas |
| CBT-04 | fracao de partidas sem abate ate 10:00 | 0,016 | 0,016 | **0,016** | 0,05 | 0,20 | **PISO estourado**, falta 0,034; **ZERO movimento em toda a fase**, achado nomeado no BLOCO 7 (o canal e dominado por ganks/pickoffs, fora do alcance de `FIGHT_COOLDOWN_BY_PHASE` e de `force_fight`) |

### 9.2 As duas bandas de folga, entrada contra pos-26-04 contra agora

| grandeza | piso | entrada da fase | pos-26-04 | agora | folga agora (unidade absoluta) | leitura de consumo da fase inteira |
| --- | --- | --- | --- | --- | --- | --- |
| duracao media da partida (min) | 29 | 30,023 | 30,257 | **30,314** | **1,314 min** | **DEVOLVEU 0,291 min desde a entrada da fase** (30,314 menos 30,023), em vez de consumir; nenhuma das duas ondas gastou o orcamento de dois ticks que `docs/diagnostics/26-ancoragem.md` Bloco 3 declarou como o limite inteiro da fase |
| mediana da primeira torre (s) | 780 | 810 | 810 | **810** | **30 s (dois ticks)** | **ZERO consumido nas duas ondas**: a grandeza nao se moveu um unico tick desde a entrada da fase, porque nenhuma das alavancas de combate desta fase altera a curva de dano estrutural que decide a primeira torre |

**A regra de parada da ancoragem (Bloco 3) continua integralmente respeitada**: nenhuma das duas alavancas deste plano chegou perto de violar o piso de duracao ou de primeira torre em nenhuma linha de nenhuma varredura (BLOCO 7 e BLOCO 8), e a fase termina esta onda com MAIS folga do que entrou, nao menos.

### 9.3 As seis bandas de densidade, entrada contra pos-26-04 contra agora, com a frase do criterio 4 do roadmap

| banda | piso | teto | entrada | pos-26-04 | agora | veredito |
| --- | --- | --- | --- | --- | --- | --- |
| densidade comparavel 0-14min | 0,46 | 0,68 | 0,840 | 0,835 | **0,829** | TETO estourado nas tres leituras (vermelha, sem mudanca de lado) |
| densidade comparavel 14-20min | 1,19 | 1,79 | 1,224 | 1,203 | **1,213** | dentro (verde) nas tres leituras |
| densidade comparavel 20min+ | 1,33 | 1,99 | 2,272 | 2,253 | **2,322** | TETO estourado nas tres leituras (vermelha, sem mudanca de lado); PIOROU nesta onda |
| densidade visivel 0-14min (PROVISORIA) | 0,46 | 1,90 | 1,830 | 1,808 | **1,799** | dentro (verde) nas tres leituras |
| densidade visivel 14-20min (PROVISORIA) | 1,19 | 2,10 | 2,099 | 2,014 | **2,025** | dentro (verde) nas tres leituras |
| densidade visivel 20min+ (PROVISORIA) | 1,33 | 3,60 | 3,553 | 3,517 | **3,645** | **MUDOU DE LADO NESTA ONDA**: verde no pos-26-04 (3,517, dentro do teto 3,60), vermelha agora (3,645, estourando o teto) |

**A frase que o criterio 4 do roadmap cobra, sem suavizar: NENHUMA fase de jogo ficou ABAIXO do piso de densidade nesta rodada.** Todas as seis violacoes medidas em toda a historia da fase (entrada, pos-26-04, agora) sao estouro de TETO (excesso de sangue/eventos), nunca de PISO (silencio). **O buraco narrativo que o objetivo deste plano nomeou finalmente apareceu como numero nesta onda**: `densidade visivel 20min+` (PROVISORIA) sai do verde (3,517) para o vermelho (3,645), a primeira vez em toda a fase que uma leitura de densidade regride de veredito. A causa esta registrada no BLOCO 7 (candidatas B e C do `FIGHT_COOLDOWN_BY_PHASE`): reduzir a espera em `late` concentra mais teamfights completos depois de 20:00, e cada teamfight emite mais eventos por minuto de exposicao do que a farm que ocupava aquele tempo antes. **O risco nomeado no objetivo deste plano (fechar `abates/min`/`fracao de abates ate 20:00` colidindo com o buraco narrativo) MATERIALIZOU-SE parcialmente nesta onda**, ainda que por uma banda PROVISORIA (sem fonte externa citavel, dona Fase 26 por construcao) e nao por uma das seis bandas COMPARAVEIS que tem fonte externa direta.

### 9.4 A razao agregada de assistencias, atribuida a mistura e nao a constante

| linha | razao agregada (CONTROLE-CARRIES) | diferenca acumulada desde a entrada |
| --- | --- | --- |
| entrada da fase (antes de qualquer alavanca de combate) | 1,770 | (regua) |
| pos-26-04 (`maxCasualties` implantado) | 1,776 | +0,006 |
| agora (pos-26-05, `FIGHT_COOLDOWN_BY_PHASE` implantado) | **1,775** | **+0,005** |

**Nenhuma das duas ondas tocou `nAssists` (`engine.ts:1240`) ou `ASSIST_COUNT_BY_EVENT` (`selection.ts:306-313`), as duas constantes do criterio 6.** O movimento acumulado de +0,005 desde a entrada da fase e inteiramente efeito de MISTURA (a mudanca na proporcao entre `kill`/`gank`/`shutdown` isolados, que truncam assistencias em 2, e `double_kill`/`triple_kill`/`ace`, que truncam em 4), e e pequeno demais para fechar qualquer fracao relevante do gap ate o alvo 2,407 (distancia de 0,632 na entrada da fase, 0,632 tambem agora, arredondado a tres casas). O insumo para o plano 26-06 confirmado pela segunda vez: o gap de assistencias precisa ser fechado essencialmente pelas duas constantes do criterio 6, nao por nenhuma alavanca de volume ou forma de combate.

### 9.5 Bandas de outras fases que mudaram de veredito nesta onda

**Comparacao banda a banda entre o estado pos-26-04 (17 bandas vermelhas do gate inteiro) e o estado agora (18 bandas vermelhas), feita por nome de banda e nao por posicao na lista** (`tmp/pace-PRE-26-05.txt` contra `tmp/pace-PRE-Task2-26-05.txt`, os dois arquivos medidos na mesma rodada de execucao deste plano, antes e depois do BLOCO 7). **Nenhuma banda de OUTRA fase mudou de veredito nesta onda.** A unica diferenca entre as duas listas e a banda `[Fase 26] PROVISORIA densidade visivel 20min+`, que e da propria Fase 26 (documentada na secao 9.3 acima) e nao de outra fase. A banda `[Fase 25B] DISPERSAO primeira torre` permanece vermelha nas duas leituras (0,1316 antes, 0,1320 agora, a mesma leitura FORA do piso 0,750 nas duas), um deslocamento de quarta casa decimal sem mudanca de veredito, atribuivel a trajetoria de RNG e nao a uma regressao nova. `calibrate:all` permanece **3 de 7 verdes** (micro, structures, combat), identico ao placar de entrada da fase e ao placar pos-26-04: nenhum gate completo flipou de veredito nesta onda.

**Placar de `npm test`**: 945 testes, **928 verdes, 17 vermelhos**, 56 de 58 arquivos passando. Dos 17 vermelhos: **15 sao deslocamento de VALOR no golden** (`src/__tests__/golden/golden.test.ts`, as tres fixtures `stomp`/`balanced`/`close`, cinco seeds cada — mais fixtures vermelhas que os 9 casos do BLOCO 6 do plano 26-04, porque `FIGHT_COOLDOWN_BY_PHASE` desloca a trajetoria de RNG em mais pontos da timeline que `maxCasualties` sozinho), **2 sao deslocamento de VALOR no describe de aridade preservada** (`src/sim/structures.test.ts`, "extracao no-op -- aridade de RNG preservada (D-05)", seeds 0 e 5, tier STOMP), a mesma classe que o BLOCO 6 do 26-04 ja documentou (os dois canarios de auto-consistencia do mesmo describe continuam VERDES nesta rodada, confirmando deslocamento de valor e nao regressao de aridade). Nenhuma regeneracao de golden acontece neste plano, por proibicao explicita do frontmatter: os 15+2 vermelhos ficam para o orcamento unico de regeneracao do plano de fechamento (26-10). **O achado D-26-01 (`resolveHeraldUse` mascarando `inhibitor_destroyed`, registrado em `deferred-items.md` pelo plano 26-04) NAO aparece nesta rodada**: o teste `structures.test.ts > win-condition structural gating > ordering: nexus_exposed precedes gg` PASSA agora, porque a mudanca de trajetoria de RNG deste plano fez a seed 44 nao percorrer mais o caminho que expunha o bug. Isto NAO fecha D-26-01 (o bug em `resolveHeraldUse` continua no codigo, intocado, e pode reaparecer em qualquer futura mudanca de trajetoria); o registro em `deferred-items.md` permanece como esta, sem dono.

### A leitura de fechamento, um numero por criterio

**Criterio 1 (taxa de abates): NAO FECHADO.** `abates/min` mede 1,296 contra o teto 1,00, uma distancia de 0,296 (29,6 por cento acima do teto). A onda deste plano NAO e alavanca de volume (essa e a alavanca primaria do plano 26-04) e o numero PIOROU 0,060 nesta onda porque `FIGHT_COOLDOWN_BY_PHASE` afeta quando as lutas acontecem, nao quantas mortes cada uma produz; mais teamfights completos cabendo depois da entrada em `late` (cooldown reduzido de 75 para 50s) tambem significa mais teamfights completos no total.

**Criterio 2 (razao vencedor/perdedor e razao torres/abates): NAO FECHADO, e a razao vencedor/perdedor PIOROU nas duas ondas da fase.** `razao de abates vencedor sobre perdedor` mede 1,076 contra o piso 1,80, uma distancia de 0,724. A fronteira medida no BLOCO 8 com as duas alavancas autorizadas (`FIGHT_COOLDOWN_BY_PHASE` e pesos de `force_fight`) alcanca no maximo 1,129 (candidata D do BLOCO 8), ainda a 0,671 do piso, e a regiao de fechamento esta provada vazia para as alavancas que este plano autoriza: as duas constantes que provavelmente fechariam a banda (janela de ruido das lutas, impulso do time atrasado) tem calibracao documentada com dono em fase anterior e ficam fora de escopo por desenho, com dono proposto Fase 30. `razao torres sobre abates` mede 0,219 contra o piso 0,33, uma distancia de 0,111, e tambem piorou nesta onda (era 0,230 pos-26-04) porque e derivada do mesmo denominador de abates que a alavanca de cooldown moveu na direcao errada.

**Criterio 3 (forma temporal): PARCIALMENTE FECHADO, e mais perto do fechamento do que em qualquer ponto anterior da fase.** `fracao de abates ate 20:00` mede 0,467 contra o teto 0,46, uma distancia de apenas 0,007 (a menor de toda a fase; entrou a 0,046 do teto de banda avaliado contra a leitura de entrada da ancoragem, e a leitura absoluta contra o teto do gate caiu de 0,046 na entrada da fase para 0,027 pos-26-04 para 0,007 agora). `fracao de partidas sem abate ate 10:00` mede 0,016 contra o piso 0,05, uma distancia de 0,034, e **NAO se moveu um unico ponto percentual em toda a fase** (0,016 na entrada, 0,016 pos-26-04, 0,016 agora): o achado do BLOCO 7 explica a causa (o canal e dominado por ganks e pickoffs, que `FIGHT_COOLDOWN_BY_PHASE` nunca controlou), e nenhuma alavanca autorizada neste plano alcanca esse canal.

---
---

# Fase 26 Plano 06: o teto de construcao da razao de assistencias, elevado nos dois pontos que o impunham

**Fase:** 26-volume-de-combate-e-densidade-narrativa
**Plano de origem:** 26-06
**Commit base deste plano:** `d2bc5dc` (HEAD ao abrir o plano; `src/sim/engine.ts` e `src/sim/selection.ts` intocados desde o plano 26-05, unico arquivo de `src/sim/` mudado desde a ancoragem foram `combat.ts` no plano 26-04 e `engine.ts` no plano 26-05)
**Proposito, em uma linha:** elevar o teto aritmetico de construcao da razao de assistencias mexendo nos dois pontos que o impoem (o limite do sorteio de assistentes em `engine.ts` e a tabela de teto por tipo de evento em `selection.ts`), medindo o efeito das duas constantes separado do efeito de mistura ja registrado pelos planos 26-04 e 26-05.

---

## BLOCO 10: as duas constantes movidas, com o efeito medido em tres colunas de estado

### O CRITERIO DE PARADA DOS VALORES, escrito antes de medir

O teto de construcao recalculado, com a mesma ponderacao por tipo de evento usada na ancoragem do plano 26-02 (media de `min(sorteio, teto do tipo)` sobre o sorteio uniforme, cruzada com a participacao real de cada tipo medida em execucao), tem de ficar ESTRITAMENTE ACIMA do piso 2,1 da banda, com folga declarada. Se o par de valores nao satisfizer isso, o proximo passo e subir o teto do caminho de pickoff (`gank`, `solo_kill`) antes do caminho de teamfight (`comeback_fight`), porque o de pickoff e o que satura primeiro.

### OS DOIS PONTOS, o que mudou em cada um

**PONTO 1, `src/sim/engine.ts` (o sorteio da quantidade de assistentes, dentro de `applyKill`).** O limite subiu de 3 para 4, preservando a forma exata da expressao (uma unica chamada ao gerador, `1 + Math.floor(rng() * Math.min(LIMITE, mates.length))`): so o multiplicador do minimo mudou, nao a quantidade de consumo. A contagem canonica de chamadas ao gerador em `src/sim/` segue em **72**, conferida por grep antes e depois da mudanca.

**PONTO 2, `src/sim/selection.ts` (a tabela `ASSIST_COUNT_BY_EVENT`).** Os dois tipos de pickoff que a verificacao do plano 26-02 mostrou efetivamente alcancados subiram de 2 para 3: `gank` (2 -> 3) e `solo_kill` (2 -> 3). O tipo de teamfight (`comeback_fight`, teto 4) **NAO precisou de edicao propria**: seu teto ja era 4, e antes deste plano ficava represado pelo limite do sorteio (que era 3, PONTO 1), entao ele ja se beneficia por construcao da elevacao do PONTO 1 sem que a tabela precise mudar. Os tres tipos inalcancados pela verificacao do plano 26-02 (`first_blood`, `dive`, `kill`, o ultimo o default nunca exercitado de `applyKill`) **nao mudaram de valor**, cada um com um comentario de uma linha citando por qual caminho ficaria alcancavel se algum dia um call site novo passasse esse tipo explicitamente.

A escolha de elevar so os dois tipos de pickoff (sem tocar `comeback_fight`) satisfez o criterio de parada na primeira tentativa (ver tabela abaixo, teto recalculado 2,435 contra o piso 2,1, folga de 0,335), entao a regra de "subir pickoff antes de teamfight" nao precisou de uma segunda rodada.

### A MEDICAO, tres colunas de estado

**Procedencia.** `npm run calibrate:assists` roda nas tres configuracoes de arvore descritas abaixo; `npm run calibrate:pace` roda uma vez em cada configuracao para conferir que nenhuma banda do gate inteiro (fora das bandas de assistencia) flipou de veredito por causa das duas constantes deste plano. **Entrada da fase**: `src/sim/combat.ts` e `src/sim/engine.ts` reconstruidos por leitura do blob do commit `f7b0ab4` (o commit imediatamente anterior a implantacao do plano 26-04, ja citado como referencia em `docs/diagnostics/26-sweep.md` BLOCO 6.1.1 para o achado D-26-01), reproduzindo por execucao os mesmos numeros que o plano 26-02 mediu (razao agregada 1,770, teto de construcao 1,914, participacao gank 10,2%/solo_kill 15,5%/comeback_fight 74,3%, todos batendo dígito a dígito). **Pos-26-05**: arvore no commit `d2bc5dc` (HEAD ao abrir este plano), reproduzindo a mesma leitura ja registrada no BLOCO 9.4 (razao agregada 1,775). **Agora**: arvore com os dois pontos deste plano implantados. Os tres commits sao lidos, nao deduzidos, seguindo a mesma disciplina de ancoragem por SHA que os blocos anteriores desta fase praticam.

| medida | entrada da fase | pos-26-05 | agora | diferenca (agora menos pos-26-05, o efeito das duas constantes) |
| --- | --- | --- | --- | --- |
| razao agregada [CONTROLE-CARRIES] (piso 2,1, teto 2,7, alvo 2,407) | 1,770 | 1,775 | **2,177** | **+0,402** |
| razao agregada [MISTO] (observada) | 1,788 | 1,786 | 2,184 | +0,398 |
| razao agregada [SEM-CAMPEOES] (observada) | 1,784 | 1,783 | 2,199 | +0,416 |
| banda-raiz assistencias do ADC por abate do time [CONTROLE-CARRIES] (piso 0,280, dono Fase 24) | 0,262 | 0,262 | **0,357** | **+0,095** |
| assistencias do ADC por abate do time [MISTO] (observada) | 0,281 | 0,283 | 0,369 | +0,086 |
| assistencias do ADC por abate do time [SEM-CAMPEOES] (observada) | 0,278 | 0,276 | 0,364 | +0,088 |
| assistencias do ADC por partida [CONTROLE-CARRIES] (banda derivada [4; 8], dono Fase 26) | 7,063 | 7,068 | 9,501 | +2,433 |
| assistencias do ADC por partida [MISTO] (observada) | 7,457 | 7,282 | 9,556 | +2,274 |
| assistencias do ADC por partida [SEM-CAMPEOES] (observada) | 5,524 | 5,665 | 7,395 | +1,730 |
| teto aritmetico de construcao (ponderado pela participacao real medida) | 1,914 | 1,914 | **2,435** | **+0,521** |
| fracao do teto que o conjunto CONTROLE-CARRIES ja ocupa | 92,5% | 92,7% | 89,4% | -3,3 p.p. |
| participacao `gank` no conjunto CONTROLE-CARRIES (teto do tipo) | 10,2% (1,667) | 10,3% (1,667) | 10,4% (2,250) | -- |
| participacao `solo_kill` no conjunto CONTROLE-CARRIES (teto do tipo) | 15,5% (1,667) | 15,5% (1,667) | 15,5% (2,250) | -- |
| participacao `comeback_fight` no conjunto CONTROLE-CARRIES (teto do tipo) | 74,3% (2,000) | 74,2% (2,000) | 74,1% (2,500) | -- |

**O criterio de parada foi satisfeito na primeira tentativa.** O teto de construcao recalculado (2,435) fica ESTRITAMENTE ACIMA do piso 2,1, com folga de **0,335** (16% do valor do piso), a partir de elevar so os dois tipos de pickoff no PONTO 2, sem precisar tocar `comeback_fight`. A diferenca entre a coluna pos-26-05 e a coluna agora (a terceira coluna menos a segunda) e o efeito isolado das duas constantes do criterio 6, separado do efeito de mistura das alavancas de volume (`maxCasualties`, plano 26-04) e de forma temporal (`FIGHT_COOLDOWN_BY_PHASE`, plano 26-05), que ja estava medido e registrado nos BLOCOS 5, 6.4 e 9.4 (+0,005 acumulado desde a entrada da fase ate pos-26-05): **+0,402 na razao agregada CONTROLE-CARRIES vem inteiramente das duas constantes deste plano**, um efeito **80 vezes maior** que o efeito de mistura acumulado das duas ondas anteriores.

**A participacao por tipo de evento praticamente nao se mexeu entre as tres colunas** (gank 10,2% a 10,4%, solo_kill travado em 15,5%, comeback_fight 74,1% a 74,3%), o que confirma que a mudanca de teto por si so nao alterou a mistura entre pickoff e teamfight: o movimento da razao agregada vem do teto por chamada subir (o "quanto" por evento), nao de qual tipo de evento passou a dominar (o "quais" eventos acontecem). Isso e consistente com o Ponto 1 nao acrescentar nenhuma chamada nova ao gerador: a trajetoria de decisao de intencao (que decide gank/solo_kill/comeback_fight) e inteiramente anterior e independente do sorteio de `nAssists`.

**A banda-raiz de assistencias do ADC por abate do time (dono Fase 24, piso 0,280) fecha nesta rodada**, medindo 0,357 contra o piso, folga de 0,077 (27,5% do valor do piso). Ela estava VERMELHA nas duas colunas anteriores (0,262 na entrada da fase, 0,262 pos-26-05, as duas abaixo do piso 0,280) e passa a fechar exclusivamente pelo movimento das duas constantes deste plano, sem nenhuma mudanca no piso, teto, fonte ou dono da banda (prova por leitura: as tres linhas continuam citando a mesma derivacao de STACK.md secao 4.7 e o mesmo dono Fase 24 nas tres colunas).

### A VERIFICACAO DE NAO-REGRESSAO no gate inteiro

`npm run calibrate:pace` na coluna "agora" mede **18 bandas vermelhas de 48**, o mesmo total que a coluna pos-26-05 ja media (BLOCO 9.1/9.5), com os mesmos nomes de banda (`abates/min`, `razao de abates vencedor sobre perdedor`, `razao torres sobre abates`, `fracao de abates ate 20:00`, `fracao de partidas sem abate ate 10:00`, as duas de `Fase 27`, a de `Fase 28`, as quatro de `Fase 25B`, as duas de `Fase 25C`, as tres de densidade da propria Fase 26). **Nenhuma banda de nivel do gate inteiro mudou de veredito por causa das duas constantes deste plano**: as bandas de assistencia vivem exclusivamente em `calibrate:assists`, fora da lista de `expectBands` de `calibrate:pace`. Pequenas oscilacoes de quarta casa decimal aparecem em bandas nao relacionadas a assistencia (por exemplo `abates/min` = 1,293 agora contra 1,296 pos-26-05), atribuiveis ao mesmo mecanismo ja documentado nesta fase: o ouro de assistencia (`ASSIST_GOLD`) credita jogadores diferentes quando o teto por tipo muda, o que altera `effectiveGoldPower` e desloca decisoes probabilisticas subsequentes sem consumir nenhuma chamada nova ao gerador (a trajetoria de valores brutos do gerador e identica; so a interpretacao de alguns thresholds posteriores muda). Isso e o mesmo padrao de "mesma aridade, trajetoria de decisao diferente" ja registrado nos BLOCOS 6 e 9 desta fase para as alavancas anteriores.

**IMPLANTADO.** `src/sim/engine.ts`: limite do sorteio de assistentes de 3 para 4 (BLOCO 10, PONTO 1), comentario de uma linha citando o criterio 6 do roadmap. `src/sim/selection.ts`: `ASSIST_COUNT_BY_EVENT.gank` de 2 para 3 e `ASSIST_COUNT_BY_EVENT.solo_kill` de 2 para 3 (BLOCO 10, PONTO 2), com comentario em cada linha da tabela (inclusive nas que nao mudaram).

Commit: `feat(26-06): teto de construcao da razao de assistencias elevado nos dois pontos que o impoem`

---

## BLOCO 11: as ancoras de teste do teto novo e o veredito de AST-02

### AS AFIRMACOES DE TESTE, em `src/sim/selection.test.ts`

Tres afirmacoes novas no describe `teto elevado pelo plano 26-06 (AST-02)`, vigiando comportamento e nao so transcrevendo a tabela:

1. **o teto retornado pelo getter para os tres tipos alcancados tem o valor novo**: `ASSIST_COUNT_BY_EVENT["gank"]` = 3, `ASSIST_COUNT_BY_EVENT["solo_kill"]` = 3, `ASSIST_COUNT_BY_EVENT["comeback_fight"]` = 4 (inalterado, ver BLOCO 10).
2. **um tipo ausente da tabela continua caindo no fallback nomeado**: `double_kill` (um `EventKind` valido sem entrada propria) e testado com `nAssists` de 1 a 4, e `assignAssists` nunca devolve mais que 2 (`ASSIST_COUNT_FALLBACK`).
3. **afirmacao de comportamento**: dada uma populacao de companheiros de 3 a 4 e um tipo de evento de pickoff (`gank` ou `solo_kill`), a quantidade de assistentes atribuida por `assignAssists` nunca ultrapassa 3, testado com `nAssists` de 1 a 4 (o novo maximo do sorteio). Esta e a que impede a tabela e o consumidor de divergirem em silencio (T-26-20).

`npx tsc --noEmit` limpo e `npx vitest run src/sim/selection.test.ts` com 28/28 testes verdes (25 pre-existentes mais os 3 novos).

Commit: `test(26-06): ancoras do teto de assistencias e veredito de AST-02 com os tres numeros`

### O VEREDITO DE AST-02

**1. Razao agregada de assistencias por abate do time, conjunto CONTROLE-CARRIES.** Valor: **2,177**. Veredito: **DENTRO** da banda [2,1; 2,7], alvo 2,407 (fonte STACK.md secao 4.7, mesma banda com dono Fase 26 desde o plano 26-02). Distancia ate o piso: +0,077 (a favor). Distancia ate o alvo: -0,230 (abaixo do alvo, mas dentro da banda).

**2. Banda-raiz de assistencias do ADC por abate do time, conjunto CONTROLE-CARRIES.** Valor: **0,357**. Veredito: **DENTRO** da banda [0,280; 0,520], alvo 0,390 (fonte STACK.md secao 4.7, dono Fase 24, piso que o roadmap usa literalmente para encerrar AST-02: "com isso a banda-raiz de assistencias do ADC por abate (piso 0,280) fecha, encerrando AST-02"). Distancia ate o piso: +0,077 (a favor), a mesma folga absoluta da razao agregada porque as duas bandas compartilham a mesma fonte e o mesmo movimento causal (BLOCO 10).

**3. Contagem de assistencias do ADC por partida, conjunto CONTROLE-CARRIES.** Valor: **9,501**. Veredito: **FORA**, estourando o TETO da banda [4; 8], alvo 5,5 (fonte STACK.md secao 7; banda observada, nunca asserida, dono Fase 26). Distancia ate o teto: +1,501. **Esta banda e METRICA DERIVADA** (taxa vezes volume de abates, nota ja registrada em `scripts/calibrate-assists.ts`): ela depende do volume de abates que esta fase corta, e o volume de hoje (87,71 abates por partida, quase o dobro da banda de referencia de 22 a 34) e alavanca de OUTRO conjunto de tasks desta mesma fase (26-04/26-05 ja implantados, 26-07/26-09 ainda por vir), nao deste plano. Nenhuma constante deste plano foi tocada de novo para tentar fechar esta banda, exatamente a proibicao que o Task 2 registra: "nao voltar a mexer nas constantes deste plano para forcar o fechamento de uma banda de contagem derivada".

### A FRASE DE ENCERRAMENTO

**AST-02 esta ENCERRADO, com os dois numeros que o roadmap usa como criterio: razao agregada 2,177 dentro de [2,1; 2,7] e banda-raiz do ADC 0,357 acima do piso 0,280.** As duas leituras fecham na mesma direcao (nenhuma diverge), entao nao ha necessidade de registrar duas leituras lado a lado no padrao da Fase 25B: as duas bandas que o roadmap cita para encerrar o requisito estao verdes, com a mesma fonte e o mesmo mecanismo causal. A terceira banda medida neste bloco (contagem de assistencias do ADC por partida) permanece FORA, mas ela e explicitamente metrica DERIVADA e dependente de volume, nao um dos dois criterios de encerramento que o roadmap declara para AST-02, e sua distancia ate a banda (que so fecha quando o volume de abates entrar em [22; 34]) fica registrada aqui para os planos seguintes desta fase nao precisarem remedir.

---
---

# Fase 26 Plano 07: o recheio narrativo do early game e a decisao de D-04 por medicao

**Fase:** 26-volume-de-combate-e-densidade-narrativa
**Plano de origem:** 26-07
**Commit base deste plano:** `ebee6cf` (HEAD ao abrir o plano; `docs/diagnostics/26-sweep.md` intocado desde o plano 26-06, os unicos arquivos de `src/sim/` mudados desde entao foram `laneState.ts`, `laneSignals.ts` (novo), `simEvents.ts`, `types.ts` e `engine.ts`, todos deste plano)
**Proposito, em uma linha:** escrever o criterio que decide D-04 antes de medir, rodar a medicao contra as seis bandas de densidade do plano 26-03 com o recheio narrativo (Task 1/Task 2 deste plano) ja implantado, e aplicar o criterio ao numero, nomeando qual clausula decidiu.

---

## BLOCO 12: o criterio de decisao de D-04, escrito antes do numero

**Este bloco e commitado ANTES de rodar `npm run calibrate:pace`/`npm test` com o recheio narrativo implantado.** Nenhuma leitura de densidade pos-recheio existe em nenhum arquivo do repositorio no momento em que este bloco entra no historico de commits: a prova de precedencia e o proprio `git log` (T-26-24, ver `threat_model` do plano 26-07), no mesmo padrao que o BLOCO 1 deste documento e o BLOCO 3 de `docs/diagnostics/26-ancoragem.md` ja praticam para os criterios anteriores desta fase.

**O objeto da decisao.** D-04 (`.planning/phases/26-volume-de-combate-e-densidade-narrativa/26-CONTEXT.md`) determina que um tipo de evento visivel totalmente NOVO (narrativo, nao mecanico, alem dos tres tipos do recheio ja criados pelo Task 1/Task 2 deste plano: `lane_advantage_building`, `lane_priority_shift`, `jungler_attention_shift`) so nasce se a medicao mostrar que os eventos existentes nao bastam para fechar a banda de densidade por fase de jogo. O objeto medido sao as TRES bandas de densidade VISIVEL do BLOCO 6.7 de `docs/diagnostics/26-ancoragem.md` (fase A 0-14min `[0,46; 1,9 PROVISORIO]`, fase B 14-20min `[1,19; 2,1 PROVISORIO]`, fase C 20min+ `[1,33; 3,6 PROVISORIO]`), porque sao elas, e nao as comparaveis, que capturam o recheio narrativo (o conjunto comparavel exclui por desenho os tres tipos novos, ver `EVENT_KINDS_COMPARAVEIS` em `scripts/calibrate-pace.ts`).

**As cinco clausulas, aplicadas em ordem. Uma banda decidida numa clausula nao desce para a proxima.**

1. **Se as tres bandas de densidade visivel ficarem no piso ou acima**, D-04 esta **RESOLVIDO POR MEDICAO como desnecessario**, e nenhum tipo de evento novo alem dos do recheio e criado neste plano nem em nenhum plano futuro sem nova medicao que mude este veredito.
2. **Se alguma banda ficar abaixo do piso**, o proximo passo e medir PRIMEIRO quanto falta em eventos por minuto (a distancia ate o piso daquele bucket especifico) e traduzir essa distancia em eventos por partida naquele bucket (multiplicando pela exposicao em minutos do bucket), porque a decisao muda conforme a falta seja da ordem de um evento a cada duas partidas ou de tres eventos por partida: uma falta pequena pede um ajuste fino do recheio existente, uma falta grande pede um mecanismo novo.
3. **Se a falta puder ser fechada afrouxando a histerese** (`LANE_ADVANTAGE_FALL_THRESHOLD`/`JUNGLE_ATTENTION_FALL_THRESHOLD` mais proximos dos limiares de subida, dentro do que a formula ainda considera "estritamente menor") **ou ampliando a janela do recheio** (`EARLY_GAME_WINDOW_SEC`, hoje travado em 840s pela fronteira de bucket do plano 26-01) **SEM ultrapassar o teto PROVISORIO da banda visivel daquele bucket**, essa e a correcao PREFERIDA, porque ela fecha a banda sem criar tipo novo. Esta clausula so pode ser aplicada num plano FUTURO com o mesmo rigor de varredura que os planos 26-04/26-05/26-08 ja praticaram para as alavancas deles (criterio escrito antes do numero, pelo menos duas candidatas medidas contra o gate inteiro); este plano (26-07) NAO reabre `laneSignals.ts` para tentar isso na mesma onda, porque a Task 2 ja fechou o commit do recheio e reabri-lo aqui misturaria o efeito da medicao com o efeito da correcao, exatamente o que D-04 pede para evitar (decisao tomada DEPOIS de ver o numero, T-26-24).
4. **So se a falta persistir com o recheio no seu limite util** (a clausula 3 tentada e provada insuficiente, ou provada impossivel sem estourar o teto) **e que D-04 se justifica**, e nesse caso o tipo novo nasce em PLANO PROPRIO com o mesmo rigor deste (criterio de forma escrito antes da implementacao, teste de identidade simetrica, histerese se aplicavel, prova de aridade), nunca improvisado dentro deste bloco ou de qualquer bloco de medicao.
5. **Se a falta persistir E o teto PROVISORIO impedir o fechamento** (isto e, a clausula 3 mostra que qualquer afrouxamento de histerese ou ampliacao de janela suficiente para fechar o piso tambem estoura o teto visivel daquele bucket), **isso e a colisao que D-03 do `26-CONTEXT.md` preve**: vira achado nomeado com os numeros dos DOIS lados (a distancia ate o piso e a distancia ate o teto, medidas na mesma configuracao), sem afrouxar piso nem teto em silencio, no mesmo padrao de disciplina que o BLOCO 8 deste documento (a fronteira PROVADA VAZIA da razao vencedor/perdedor) ja praticou para uma colisao de natureza diferente na mesma fase.

**O que este criterio NAO permite.** Nao permite medir so a banda que falhou e ignorar as que passaram (o padrao "gate de densidade global" que o RESEARCH.md desta fase ja nomeia como anti-padrao). Nao permite comparar a leitura pos-recheio contra a leitura de ENTRADA da fase (BLOCO 6.7 de `26-ancoragem.md`, coluna "valor pre-motor") como se fosse o piso: a comparacao de decisao e sempre contra o PISO/TETO da banda (BLOCO 6.7, colunas proprias), e a leitura de entrada so entra na tabela do BLOCO 13 como contexto historico, no formato de quatro colunas que a Task 3 do plano ja pede. Nao permite decidir D-04 achando "parece que falta pouco": a clausula 2 exige o numero de eventos por partida, nao uma impressao qualitativa.

Commit: `docs(26-07): criterio de decisao de D-04 escrito antes da medicao`

---

## BLOCO 13: a medicao pos-recheio e o veredito de D-04

**Procedencia.** `npm run calibrate:pace` (tier EQUILIBRADO 75x75, N=800, `tmp` nao persistido nesta rodada mas saida completa capturada no terminal) e `npm test`, rodados na arvore com o Task 1 e o Task 2 deste plano (`51b511d`, `31245de`) ja commitados: `laneSignals.ts` existe e `accrueLaneSignals` esta ligado ao laco de tick de `engine.ts`. Coluna "entrada da fase" e coluna "depois do 26-05" vem literalmente do BLOCO 9.3 deste mesmo documento (que por sua vez cita `docs/diagnostics/26-ancoragem.md` BLOCO 6.7 e o BLOCO 6 do plano 26-04). O plano 26-06 (entre 26-05 e este plano) mexeu so nas duas constantes de teto de assistencia (BLOCO 10/11 deste documento) e nao acrescenta, remove nem reordena nenhum `SimEvent` na timeline, entao a coluna "depois do 26-05" continua sendo a leitura de densidade valida imediatamente antes deste plano, ja confirmado pelo BLOCO 9.4 ("Nenhuma das duas ondas tocou `nAssists`... nem `ASSIST_COUNT_BY_EVENT`" refere-se a 26-04/26-05, e o proprio BLOCO 10 registra que a mudanca do 26-06 nao move nenhuma banda do gate inteiro fora das bandas de assistencia).

### 13.1 As seis bandas, quatro colunas de estado

| banda | piso | teto | entrada da fase | depois do 26-05 | depois do recheio (26-07) | o que aperta |
| --- | --- | --- | --- | --- | --- | --- |
| densidade comparavel 0-14min | 0,46 | 0,68 | 0,840 | 0,829 | **0,788** | TETO (vermelha nas tres leituras; melhorou 0,041 nesta onda, mas por reducao de abates/torres/dragoes comparaveis, nao por acao deste plano, que nao toca o conjunto comparavel) |
| densidade comparavel 14-20min | 1,19 | 1,79 | 1,224 | 1,213 | **1,222** | dentro (verde nas tres leituras; nunca apertou) |
| densidade comparavel 20min+ | 1,33 | 1,99 | 2,272 | 2,322 | **2,331** | TETO (vermelha nas tres leituras; piorou 0,009 nesta onda, deslocamento residual de trajetoria de RNG, ver BLOCO 12 clausula sobre nao reabrir constantes de outras alavancas) |
| densidade visivel 0-14min (PROVISORIA) | 0,46 | 1,90 | 1,830 | 1,799 | **2,293** | **MUDOU DE LADO NESTA ONDA**: verde nas duas leituras anteriores (1,830 e 1,799, as duas dentro do teto 1,90), **vermelha agora** (2,293, estourando o teto por 0,393). O PISO continua largamente respeitado (2,293 contra 0,46, folga de 1,833) |
| densidade visivel 14-20min (PROVISORIA) | 1,19 | 2,10 | 2,099 | 2,025 | **2,044** | dentro (verde nas tres leituras; o recheio nao emite nada neste bucket por desenho, EARLY_GAME_WINDOW_SEC = 840s, o pequeno movimento de 2,025 para 2,044 e residual de trajetoria) |
| densidade visivel 20min+ (PROVISORIA) | 1,33 | 3,60 | 3,553 | 3,645 | **3,665** | TETO (ja tinha mudado de lado no 26-05, ver BLOCO 9.3; continua vermelha, piorou 0,020 nesta onda, residual de trajetoria, o recheio nao emite neste bucket) |

### 13.2 A contagem do recheio por partida e a participacao por tipo no bucket 0-14min

**Contagem do recheio por partida (tier EQUILIBRADO, N=800):** 5.999 eventos do recheio em 800 partidas, isto e **7,499 eventos do recheio por partida**, inteiramente dentro do bucket 0-14min (zero eventos do recheio nos buckets 14-20min e 20min+, confirmado por leitura direta da mistura de tipos de cada bucket: nenhum dos tres tipos novos aparece nas listas de `faseB`/`faseC`, so em `faseA`).

| tipo do recheio | contagem (800 partidas) | participacao no total de eventos do bucket 0-14min (25.681 eventos) | eventos por partida |
| --- | --- | --- | --- |
| jungler_attention_shift | 2.390 | 9,3% | 2,988 |
| lane_advantage_building | 2.030 | 7,9% | 2,538 |
| lane_priority_shift | 1.579 | 6,1% | 1,974 |
| **total do recheio** | **5.999** | **23,3%** | **7,499** |

**O recheio passou a ser quase um quarto de todos os eventos visiveis do early game** (23,3%), maior que a participacao de `gank` (9,6%) e comparavel a `plate_taken` (35,8%, ja existente desde a Fase 17), confirmando por medicao que os tres tipos novos nao sao um efeito marginal: sao a segunda maior fonte de eventos visiveis do bucket, atras so das placas.

### 13.3 Aplicacao do criterio do BLOCO 12

**As tres bandas de densidade VISIVEL (o objeto da decisao de D-04, secao "O objeto da decisao" do BLOCO 12) ficam, nas tres leituras, ACIMA do proprio piso:**

- fase A (0-14min): 2,293 contra piso 0,46, folga de **1,833** (o valor mede quase 5 vezes o piso).
- fase B (14-20min): 2,044 contra piso 1,19, folga de **0,854**.
- fase C (20min+): 3,665 contra piso 1,33, folga de **2,335**.

**A CLAUSULA 1 do BLOCO 12 decide: D-04 esta RESOLVIDO POR MEDICAO como DESNECESSARIO.** As tres bandas de densidade visivel ficam no piso ou acima (nas tres, muito acima), a condicao exata que a clausula 1 escreve antes de qualquer numero existir. Nenhum tipo de evento visivel novo, alem dos tres do recheio ja criados por este plano (`lane_advantage_building`, `lane_priority_shift`, `jungler_attention_shift`), e justificado por esta medicao. As clausulas 2 a 5 do BLOCO 12 nao se aplicam: elas so entram em jogo se alguma banda ficasse ABAIXO do piso, o que nao aconteceu em nenhuma das tres.

### 13.4 O achado que NAO e D-04: o teto PROVISORIO estourou em duas das tres bandas visiveis

**Isto NAO e o objeto da decisao de D-04 (que e exclusivamente sobre PISO, ver BLOCO 12), mas e um custo real do recheio que precisa ficar registrado, no mesmo padrao de nao suavizar que esta fase inteira pratica.** Duas das tres bandas de densidade visivel (fase A e fase C) MUDARAM DE LADO OU PIORARAM contra o proprio TETO PROVISORIO desta onda: fase A vira de verde (1,799) para vermelha (2,293, +0,393 acima do teto 1,90), e fase C, ja vermelha desde o 26-05, piora de 3,645 para 3,665 (+0,065 acima do teto 3,60). Fase B permanece verde (2,044 dentro de [1,19; 2,10]), consistente com o recheio nao emitir nada la.

**A causa e conhecida e esperada, nao um efeito colateral misterioso**: `docs/diagnostics/26-ancoragem.md` BLOCO 6.5 ja escreveu, antes de qualquer linha deste plano existir, que o teto PROVISORIO "foi ancorado no estado pre-motor de hoje" e que "so um AUMENTO de volume visivel pode estoura-lo". Este plano aumentou o volume visivel do bucket 0-14min por desenho (essa e a definicao de D-01: dar visibilidade a sinais que ja existiam internos), e o teto PROVISORIO, que nao tem fonte externa (a mesma secao 6.5 registra isso), reagiu exatamente como o proprio texto da ancoragem previu que reagiria. O piso, que E o objeto de D-04, nunca esteve em risco: a folga contra o piso em fase A (1,833) e maior que o proprio VALOR do teto (1,90).

**Dono proposto: nenhum dono novo criado por este plano.** `docs/diagnostics/26-ancoragem.md` BLOCO 6.5 ja registrou, por escrito e antes deste plano existir, que recalibrar o teto PROVISORIO com dado real (se algum dia existir) "precisa nomear a mudanca como achado, nunca mover o numero em silencio": este paragrafo E esse nome. A fase 26 (planos 26-08/26-09 restantes, ou revisao em bloco na Fase 30) e quem decide se o teto PROVISORIO deve subir para acomodar o volume que D-01 releitura como legitimo, ou se o volume do recheio deve ser podado; nenhuma das duas decisoes acontece neste plano, porque este Task e de medicao e decisao de D-04, nao de recalibracao de teto.

### A FRASE OBRIGATORIA DE FECHAMENTO

**O playback mostra 2,293 eventos por minuto entre 0 e 14 minutos agora (depois do recheio narrativo deste plano), contra 1,830 na entrada da fase (antes de qualquer alavanca de combate ou narrativa desta fase), e o piso de 0,46 esta cumprido com folga de 1,833, quase cinco vezes o proprio piso.**

Commit: `docs(26-07): decisao de D-04 por medicao, com o criterio escrito antes do numero`

---

## BLOCO 14: a distribuicao dos niveis de intensidade, medida e os limiares confirmados

**Fase:** 26-volume-de-combate-e-densidade-narrativa
**Plano de origem:** 26-09 (Task 3)
**Proposito, em uma linha:** medir a distribuicao dos tres niveis de peso do evento (virada/decisivo/rotina, Tasks 1/2 deste plano) sobre corpus com semente fixa, contra um criterio de sanidade escrito ANTES do primeiro numero, e confirmar ou ajustar o limiar declarado no Task 1.

### 14.1 O criterio de sanidade, escrito antes de rodar a medicao

Dois numeros, decididos antes de qualquer leitura da distribuicao existir:

1. **Virada precisa ser RARA:** media de abates classificados "virada" **menor ou igual a 3,0 por partida** ("um punhado", a linguagem do Task 3).
2. **Rotina precisa continuar sendo a MAIORIA dos abates:** participacao percentual do nivel "rotina" no total de abates com peso **maior que 50%**.

Estes dois numeros sao o criterio inteiro. Nenhum deles foi ajustado depois de ver a tabela abaixo.

### 14.2 O que a populacao medida e, e por que ela e a correta

`_eventWeight` (Tasks 1/2) so e anexado ao `SimEvent` para abates que chegam ao ticker via `makeKillEvent`: first blood, ate dois shutdowns destacados por tick de teamfight, e todo abate solo/gank/pickoff. Abates absorvidos por `decorateMultikill` (DOUBLE KILL/TRIPLE KILL/etc) nunca carregam `_eventWeight`, pelo mesmo motivo por que nunca carregaram `_deathQuality` (padrao pre-existente da Fase 12, nao alterado por este plano: a variavel de modulo `_lastEventWeight` so e lida por `makeKillEvent`). Esta e, portanto, exatamente a populacao que **o ticker de fato comunica** linha a linha, o dominio literal de D-02. Medir "todo `applyKill` interno" incluiria abates que o usuario nunca ve isolados numa linha propria, o que mediria a coisa errada para uma feature sobre texto do ticker.

Procedencia: `scripts/probe-event-weight.ts` (sonda nova deste plano, sem assercao, no molde de `scripts/probe-shape.ts`/`scripts/probe-lift.ts`), `npx vitest run -c vitest.probe-event-weight.config.ts`, tier EQUILIBRADO (75 contra 75, o mesmo tier de referencia do gate de ritmo), N = 800, semente igual ao indice da partida. Relatorio completo em `tmp/event-weight.txt`.

### 14.3 Duas leituras: a estimativa inicial do Task 1 e a medicao final

O Task 1 estimou `DECISIVE_WIN_PROB_DELTA = 0,05` por calculo teorico (inclinacao maxima do sigmoide vezes o peso de `aliveEdge`). A primeira leitura, com esse valor, jah mostrou o criterio de rotina violado com folga larga:

| leitura | `DECISIVE_WIN_PROB_DELTA` | virada | decisivo | rotina |
| --- | --- | --- | --- | --- |
| **inicial (Task 1)** | 0,05 | 19,7% (2482/12601) | **70,0%** (8825/12601) | **10,3%** (1294/12601) |
| **controle (delta desligado)** | 1,0 (nunca dispara por delta) | 19,7% (2482/12601) | **49,0%** (6180/12601) | **31,3%** (3939/12601) |
| **final (confirmada)** | **0,1** | 19,7% (2482/12601) | **49,1%** (6181/12601) | **31,3%** (3938/12601) |

A leitura de controle (limiar elevado ate o ponto de o gatilho por delta nunca disparar) isola o piso estrutural de "decisivo" que vem exclusivamente dos outros dois gatilhos do proprio texto do Task 1 (bounty de sequencia acumulada e primeiro sangue, os dois **incondicionais**). A leitura final (0,1) fica a **0,1 ponto percentual** da leitura de controle: o limiar de 0,1 ja esgota essencialmente todo o efeito que o delta pode produzir isoladamente nesta populacao, confirmado por medicao e nao por suposicao. Subir o limiar além de 0,1 não move mais nada de forma perceptível. `DECISIVE_WIN_PROB_DELTA` foi ajustado de 0,05 para **0,1** no codigo (`src/sim/deathQuality.ts`), e o comentario ao lado da constante cita esta medicao como fonte, com as duas leituras registradas.

### 14.4 A tabela da distribuicao final (limiar 0,1), por partida

| nivel | media | mediana | p10 | p90 | participacao |
| --- | --- | --- | --- | --- | --- |
| virada | 3,103 | 3,000 | 1,000 | 6,000 | 19,7% |
| decisivo | 7,726 | 6,000 | 2,000 | 16,000 | 49,1% |
| rotina | 4,923 | 5,000 | 2,000 | 8,000 | 31,3% |

População total: 12.601 abates com peso em 800 partidas (15,751 por partida).

### 14.5 O veredito contra o criterio de sanidade, sem suavizar

**Clausula 1 (virada rara, media <= 3,0): NAO FECHADA por 0,103.** A media medida e 3,103, contra o piso 3,0 escrito antes da medicao. A folga negativa e pequena (3,4% acima do limite), mas o criterio foi escrito como numero exato e o numero medido excede esse numero. Nenhum ajuste de `DECISIVE_WIN_PROB_DELTA` move esta clausula: a classificacao "virada" e inteiramente independente do limiar de delta (e o cruzamento da linha de 50%, uma definicao estrutural, nao um limiar numerico ajustavel), confirmado pelas tres leituras da tabela 14.3, onde a participacao de virada e **identica** (19,7%, 2482/12601) nas tres, qualquer que seja o valor do limiar.

**Clausula 2 (rotina e maioria, > 50%): NAO FECHADA, e a REGIAO DE FECHAMENTO E VAZIA para este limiar.** Rotina mede 31,3% no melhor ponto de operacao alcancavel por este limiar (leitura de controle e leitura final, praticamente identicas). O piso estrutural de "decisivo" sozinho (49,0% na leitura de controle, delta nunca disparando) ja excede a fatia que "rotina" precisaria ocupar para virar maioria. **Isto e fronteira de DESENHO e nao de calibracao**: os dois gatilhos que dominam "decisivo" (bounty de sequencia acumulada, `hadShutdownBounty`; primeiro sangue, `isFirstBlood`) sao **incondicionais** no proprio texto do Task 1 ("...OU o abate carrega recompensa de sequencia acumulada, OU e o primeiro sangue"), nao numeros ajustaveis. Nenhum valor de `DECISIVE_WIN_PROB_DELTA` fecha esta clausula, porque o delta nunca foi o termo dominante: a leitura de controle (delta desligado) ja mostra o piso de 49,0% vindo inteiramente dos outros dois gatilhos.

**O que NAO foi feito para fechar as duas clausulas.** Nenhuma banda foi afrouxada, nenhum gatilho incondicional do Task 1 foi removido ou tornado condicional, e a definicao de "virada" (cruzamento de 50%) nao foi redefinida para ficar mais rara. As duas mudancas resolveriam as clausulas por decreto, nao por medicao, e a primeira delas (remover um gatilho incondicional do texto do proprio Task 1) e mudanca de desenho fora do escopo de ajuste de limiar que o Task 3 autoriza.

**Leitura final, sem suavizar:** o ticker comunica peso corretamente (cada nivel tem texto proprio, escolha deterministica, invariante de nome preservado, e a amostra da secao 14.6 mostra isso em linhas reais), mas a proporcao "a maioria dos abates e rotina" que o criterio de sanidade pedia **nao se sustenta** nesta populacao (kills ticker-visiveis): quase metade de todo abate que o usuario ve isolado numa linha carrega bounty acumulado ou e primeiro sangue, o que este mesmo texto do plano define como "decisivo" sem condicao. Item registrado sem dono: a decisao de tornar o gatilho de bounty CONDICIONAL (por exemplo exigindo um valor minimo, hoje qualquer `shutdownGold > 0` conta) e uma mudanca de desenho, candidata natural para revisao em bloco na Fase 30, e nao foi tomada aqui.

### 14.6 Amostra de dez linhas de ticker reais (tier EQUILIBRADO, seed 0)

Duas de virada, quatro de decisivo, quatro de rotina, direto da simulacao (sem edicao):

**virada:**
1. `u-jungle: com essa troca, o jogo muda de mao.`
2. `r-jungle: com essa troca, o jogo muda de mao.`

**decisivo:**
3. `u-jungle: cobra a recompensa acumulada com um abate que pesa na partida.`
4. `r-support: cobra a recompensa acumulada com um abate que pesa na partida.`
5. `u-top: abate decisivo, o mapa se abre para o time.`
6. `r-mid: decide a troca de rota com esse abate.`

**rotina:**
7. `r-jungle apareceu no meio e garantiu o gank em cima de u-jungle.`
8. `u-jungle abateu r-jungle no rio superior.`
9. `r-top abateu u-mid no rio inferior.`
10. `r-mid abateu u-top no rio superior.`

Commit: `docs(26-09): distribuicao dos niveis de intensidade medida e limiares confirmados`

---
