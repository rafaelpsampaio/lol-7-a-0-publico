# Fase 28: ancoragem, derivacao de D e tabela de 6 pontos-ancora

**Data:** 2026-08-24
**Fase:** 28-curva-de-for-a-por-diferen-a-de-rating
**Plano de origem:** 28-01 (Task 1)
**Proposito, em uma linha:** gravar o SHA base da fase, o alvo declarado, a derivacao fechada de `D = 35,5`, o bracket de inclinacao aceitavel e a tabela de 6 pontos-ancora com piso e teto proprios, em arquivo versionado, ANTES de qualquer medicao nova ou mudanca de harness.

Instrumento antes de motor, mais uma vez nesta milestone (precedente em `docs/diagnostics/27-ancoragem.md`, `docs/diagnostics/25C-ancoragem.md`, `docs/diagnostics/25B-ancoragem.md`). Este arquivo e commitado SOZINHO, antes de qualquer outro commit da fase, para que `git log` prove que o criterio veio antes da medicao.

---

## Bloco 1: SHA base da fase e regra de sanidade por blob

| o que | SHA | como foi obtido |
| --- | --- | --- |
| **commit base da Fase 28 (lido na execucao)** | `6a7caaa4916daac1adf55efedf9147dddc0a8a38` (`6a7caaa`) | `git rev-parse HEAD`, executado no Task 1 do plano 28-01, ANTES de qualquer edicao de codigo desta fase. Assunto do commit no topo da arvore nesse instante: `docs(28): create phase plan` |

**Divergencia registrada em vez de omitida.** O plano 28-01 previa como valor esperado `ab6e2d853ba0620d0f781be7916f06790ce5ccc2` (assunto `docs(state): record phase 28 context session`). O HEAD lido na execucao diverge: e `6a7caaa4916daac1adf55efedf9147dddc0a8a38`, um commit filho do valor esperado (`ab6e2d8` e ancestral de `6a7caaa`, confirmado por `git merge-base --is-ancestor`), correspondente a criacao do proprio arquivo de plano `28-01-PLAN.md` depois da sessao de contexto. A regra do plano e clara: registrar o valor REAL lido, nunca o valor esperado, quando os dois divergirem. O SHA base oficial desta fase e portanto `6a7caaa4916daac1adf55efedf9147dddc0a8a38`.

**Contrato para os planos seguintes desta fase:** os planos 28-02 a 28-05 leem o SHA acima **deste arquivo** e NUNCA o deduzem por assunto de commit, por `git log`, nem por qualquer outra heuristica. `scripts/verify-28-diff.cjs` (plano 28-05) e o consumidor principal desta linha.

**Regra de sanidade por blob, escrita como instrucao executavel para os planos seguintes:** `scripts/verify-28-diff.cjs` le o SHA acima e, antes de qualquer outra comparacao, confere se o blob de `src/sim/power.ts` no SHA base e igual ao blob de `src/sim/power.ts` em `HEAD`. Em modo `--expect-change`, se os dois blobs forem IGUAIS, a base esta errada ou o motor nao mudou, e nos dois casos o script FALHA (`process.exitCode = 1`) em vez de reportar sucesso. Uma prova por diff que passa vazia e pior que nenhuma prova, porque produz um relatorio verde afirmando o contrario do que mediu.

**Registro de memoria institucional.** Essa armadilha, deduzir o commit base pelo assunto do commit mais recente em vez de ler o valor gravado em arquivo, ja devolveu o proprio HEAD duas vezes nesta milestone (registro em `.planning/STATE.md`, onda 1 da Fase 25C, e a mesma nota repetida em `docs/diagnostics/25B-ancoragem.md` e `docs/diagnostics/27-ancoragem.md`). Este bloco existe para que a Fase 28 nao seja a terceira.

---

## Bloco 2: o alvo declarado e a derivacao fechada de D

**A forma da curva alvo:**

```
P(gap) = 1 / (1 + 10^(-gap / D))
```

onde `gap` e a diferenca de rating entre os dois times em pontos de overall, e `P` e a win-rate de PARTIDA do time de maior rating.

**O alvo declarado:** em gap 30 a win-rate alvo e **0,875**. Fonte do alvo: e o ponto medio interpretavel entre o piso 0,80 (herdado do tier dominante de `scripts/calibrate.ts:46`) e o teto duro 0,97 (`docs/references/ritmo.md` secao 7), e e exatamente o exemplo que o proprio criterio 4 do `ROADMAP.md` usa.

**A derivacao:**

```
D = 30 / log10(0,875 / 0,125)
  = 30 / log10(7)
  = 30 / 0,845098
  = 35,4989...
```

Arredondado para **D = 35,5**.

**A PROVA de que D = 35,5 nao e inventado.** Avaliando a curva nos tres gaps dos tiers legados de `scripts/calibrate.ts`, os tres caem dentro das bandas que o criterio 2 do ROADMAP exige:

| gap | fixture legado (`scripts/calibrate.ts`) | `P(gap; D=35,5)` | banda do criterio 2 | dentro? |
| --- | --- | --- | --- | --- |
| 25 | 90 contra 65 (tier `dominant`) | **0,8350** | [0,80; 0,90] | sim |
| 15 | 82 contra 67 (tier `competitive`) | **0,7257** | [0,67; 0,78] | sim |
| 3 | 75 contra 72 (tier `close`) | **0,5486** | [0,48; 0,62] | sim |

**O bracket de inclinacao aceitavel, tambem derivado e nao inventado.** Aplicando a tolerancia de mais ou menos 7 pontos percentuais em gap 30 (0,805 e 0,945), o `D` correspondente e:

```
lado achatado:  D = 30 / log10(0,805 / 0,195) = 48,72
lado inclinado: D = 30 / log10(0,945 / 0,055) = 24,29
```

**Bracket declarado: D em [24; 49].** Toda banda da tabela do Bloco 3 e imagem deste bracket: nenhum piso ou teto por ponto e numero solto.

---

## Bloco 3: a tabela de 6 pontos-ancora

| gap | fixture | alvo | D=49 | D=24 | piso | teto | N |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 75 x 75 | 0,5000 | 0,5000 | 0,5000 | 0,44 | 0,56 | 600 |
| 5 | 78 x 73 | 0,5803 | 0,5586 | 0,6178 | 0,52 | 0,66 | 600 |
| 10 | 80 x 70 | 0,6566 | 0,6155 | 0,7230 | 0,58 | 0,76 | 600 |
| 20 | 85 x 65 | 0,7853 | 0,7193 | 0,8720 | 0,69 | 0,90 | 600 |
| 30 | 90 x 60 | 0,8750 | 0,8037 | 0,9468 | 0,80 | 0,97 | 600 |
| 40 | 95 x 55 | 0,9305 | 0,8676 | 0,9789 | 0,85 | 0,97 | 600 |

**Regra que gerou piso e teto, para que a tabela seja reproduzivel:** piso = `P(gap; D=49)` menos 2 sigma binomiais em N = 600; teto = `P(gap; D=24)` mais 2 sigma, limitado a 0,97 por `STACK.md` secao 7.

**Duas excecoes declaradas e justificadas na propria tabela:**

- (a) gap 0 e independente de `D`, entao a banda e 0,500 mais ou menos 3 sigma, ou seja [0,44; 0,56], e mede so ruido amostral e vies de lado;
- (b) o piso de gap 30 e elevado de 0,7767 para 0,80 para nao nascer mais frouxo que a banda ja declarada em `scripts/calibrate-pace.ts:1700-1706`, que tem esta mesma fase como dona.

**Nota sobre o fixture de gap 5:** e 78 contra 73 e nao 77,5 contra 72,5 porque `PlayerVersionSchema` (`src/data/schema.ts:165-172`) exige inteiro em `lanePhase`/`midGame`/`lateGame`. Consequencia declarada: o ponto medio do fixture de gap 5 e 75,5 e nao 75 como nos outros cinco.

---

## Bloco 4: as duas bandas de sensibilidade (FRC-03) e o mapa de gates

**As duas distancias que o criterio 3 do ROADMAP exige**, com piso e teto derivados do MESMO bracket [24; 49]:

- distancia entre gap 10 e gap 0: piso `P(10; D=49) - 0,5 = 0,1155`, declarado **0,11**; teto `P(10; D=24) - 0,5` mais 2 sigma da diferenca, `0,2230 + 0,040 = 0,2630`, declarado **0,27**.
- distancia entre gap 20 e gap 5: piso `P(20; D=49) - P(5; D=49) = 0,1607`, declarado **0,16**; teto `P(20; D=24) - P(5; D=24)` mais 2 sigma, `0,2543 + 0,040 = 0,2943`, declarado **0,29**.

**Por que o piso NAO e alargado por ruido enquanto o teto e:** o piso e requisito duro do criterio 3 ("achatar demais e o pior desfecho possivel da milestone"), o teto e tolerancia.

**O mapa dos tres gates, e QUAL MOTOR cada um mede** (achado desta ancoragem, precisa ficar escrito):

- `npm run calibrate` roda DOIS harnesses (`vitest.calibrate.config.ts` linha 29): `scripts/calibrate.ts`, que dirige `runMatch` de `src/sim/runMatch.ts`, e `scripts/calibrate-engine.ts`, que dirige `simulateMatch` de `src/sim/engine.ts`.
- **ACHADO:** `src/sim/runMatch.ts` NAO importa `src/sim/power.ts` e nao esta no caminho de producao. O caminho de producao e `src/tournament/series.ts` -> `runMatchEngine` -> `simulateMatch`. `runMatch` so e alcancavel por `scripts/calibrate.ts` e por testes proprios. **Consequencia:** os 3 tiers de `scripts/calibrate.ts`, que o criterio 2 do ROADMAP chama de gate de aceite oficial, sao CEGOS a qualquer mudanca em `power.ts`. Por isso a tabela de 6 pontos vai para `scripts/calibrate-engine.ts` (que ve o motor real) e nao para `scripts/calibrate.ts`. Apagar ou religar o simulador legado NAO e escopo desta fase (candidato a revisao em bloco da Fase 30); os 3 tiers legados continuam tendo de ficar verdes pelo texto literal do criterio 2.
- `npm run calibrate:pace` mede o motor real em 6 tiers com N = 800 e ja carrega a banda `win-rate com gap de forca 30` [0,80; 0,97] com dono Fase 28, mais R1/R2 provisorias com dono Fase 28.

---

## Bloco 5: medicao de abertura, antes de qualquer mudanca em src/sim/

Medido em `npm run calibrate`, no commit desta Task 2 do plano 28-01, ANTES de qualquer linha de `src/sim/` mudar nesta fase (`git diff --stat` desta task nao lista nenhum arquivo sob `src/`). Fonte bruta: `tmp/calibration.txt`, gerado por `scripts/calibrate-engine.ts` com os 6 tiers-ancora e N = 600.

**Tabela de 6 pontos-ancora, motor real (`simulateMatch`, N = 600 por ponto):**

| gap | fixture | win-rate medida | alvo | piso | teto | marca |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 75 x 75 | 0,5650 | 0,5000 | 0,44 | 0,56 | FORA (estourou o teto por 0,005) |
| 5 | 78 x 73 | 0,8200 | 0,5803 | 0,52 | 0,66 | FORA (estourou o teto) |
| 10 | 80 x 70 | 0,9517 | 0,6566 | 0,58 | 0,76 | FORA (estourou o teto) |
| 20 | 85 x 65 | 1,0000 | 0,7853 | 0,69 | 0,90 | FORA (estourou o teto) |
| 30 | 90 x 60 | 1,0000 | 0,8750 | 0,80 | 0,97 | FORA (estourou o teto) |
| 40 | 95 x 55 | 1,0000 | 0,9305 | 0,85 | 0,97 | FORA (estourou o teto) |

**As duas distancias de sensibilidade medidas:**

- gap10 menos gap0: **0,3867**, contra piso declarado 0,11 e teto declarado 0,27. FORA, estourou o TETO (a curva de hoje nao falta sensibilidade, ela e ingreme demais cedo demais).
- gap20 menos gap5: **0,1800**, contra piso declarado 0,16 e teto declarado 0,29. DENTRO.

**Leitura dos 3 tiers legados de `scripts/calibrate.ts` (criterio 2 do ROADMAP, bandas 80-90% / 67-78% / 48-62%):**

| tier | fixture | win-rate medida | banda | desfecho |
| --- | --- | --- | --- | --- |
| dominant (20+ pt gap) | 90 x 65 | 84,4% | [80%; 90%] | PASS |
| competitive (10-20 pt gap) | 82 x 67 | 69,1% | [67%; 78%] | PASS |
| close (0-10 pt gap) | 75 x 72 | 53,5% | [48%; 62%] | PASS |

Os 3 tiers legados de `scripts/calibrate.ts` (que dirigem `runMatch`, nao `simulateMatch`, conforme o achado do Bloco 4) continuam PASS, exatamente como esperado: eles sao CEGOS a esta ancoragem, porque nao passam por `power.ts`.

**Tempo de parede da rodada:** `npm run calibrate` (os dois harnesses juntos, `scripts/calibrate.ts` e `scripts/calibrate-engine.ts`) completou em **45,75s**. `scripts/calibrate-engine.ts` sozinho levou **41,16s** para as 3600 partidas de motor completo dos 6 tiers-ancora (N = 600 cada); `scripts/calibrate.ts` levou cerca de 1s para as 3000 partidas de `runMatch` dos 3 tiers legados (N = 1000 cada).

**Leitura preliminar (a decisao formal do branch "fechar sem mexer em D" fica no Bloco 6, Task 3):** a curva medida hoje no motor real esta muito mais ingreme do que a tabela de 6 pontos-ancora tolera. Todas as 6 ancoras estao FORA, sempre pelo lado do TETO (nunca do piso): em gap 10 a win-rate ja mede 95,17% contra um alvo de 65,66%, e a partir de gap 20 a curva ja satura em 100,0%. A distancia de sensibilidade gap10-gap0 tambem estoura o teto, pela mesma razao (a curva sobe rapido demais, nao devagar demais). Este e o retrato numerico do sintoma que a Fase 28 existe para corrigir.

---

## Bloco 6: decisao sobre o branch "fechar a fase sem mexer em D"

Medido de novo em `npm run calibrate` na Task 3 do plano 28-01, apos `scripts/calibrate-engine.ts` passar a assertar as 8 bandas de dois lados via `checkBand`/`expectBands` (`ANCHOR_BANDS` + `SENSITIVITY_BANDS`). A simulacao e deterministica por seed (`mulberry32`, seeds 0 a 599 por ancora) e nenhuma linha de `src/sim/` mudou entre a Task 2 e a Task 3 (`git diff --stat` desta task nao lista nenhum arquivo sob `src/`); por isso os oito valores medidos abaixo sao identicos, casa a casa, aos do Bloco 5.

**As 8 bandas, valor medido contra piso, teto e marca:**

| banda | valor medido | piso | teto | marca |
| --- | --- | --- | --- | --- |
| win-rate ANCORA-00 (gap 0) | 0,565 | 0,44 | 0,56 | FORA (estourou o teto) |
| win-rate ANCORA-05 (gap 5) | 0,820 | 0,52 | 0,66 | FORA (estourou o teto) |
| win-rate ANCORA-10 (gap 10) | 0,952 | 0,58 | 0,76 | FORA (estourou o teto) |
| win-rate ANCORA-20 (gap 20) | 1,000 | 0,69 | 0,90 | FORA (estourou o teto) |
| win-rate ANCORA-30 (gap 30) | 1,000 | 0,80 | 0,97 | FORA (estourou o teto) |
| win-rate ANCORA-40 (gap 40) | 1,000 | 0,85 | 0,97 | FORA (estourou o teto) |
| sensibilidade gap 10 contra gap 0 | 0,387 | 0,11 | 0,27 | FORA (estourou o teto) |
| sensibilidade gap 20 contra gap 5 | 0,180 | 0,16 | 0,29 | DENTRO |

O assert de ordenacao (sequencia de win-rate nas 6 ancoras nao-decrescente na ordem gap 0/5/10/20/30/40: 0,565 -> 0,820 -> 0,952 -> 1,000 -> 1,000 -> 1,000) passa: a curva de hoje e ingreme demais, mas nunca inverte a ordem do gap.

**Veredito explicito do branch.** Sete das oito bandas estao FORA, todas pelo lado do TETO: as seis ancoras de win-rate e a sensibilidade gap10-gap0. Apenas a sensibilidade gap20-gap5 esta DENTRO. O branch "fechar a fase sem mexer em `D`" esta portanto FECHADO por medicao: a curva atual satura em 100,0% a partir do gap 20 (FRC-02 violado, gap grande ja chega a 100% em centenas de partidas) e sobe rapido demais entre gap 0 e gap 10 (a maior parte da sensibilidade FRC-03 esta concentrada cedo, nao distribuida ao longo do gap). Os planos 28-02 (canal de `D` de primeira classe) e 28-03 (calibracao fina para trazer as 6 ancoras para dentro da banda) estao CONFIRMADOS: sao necessarios, nao apenas para FRC-04 (o parametro interpretavel), mas para FRC-01, FRC-02 e FRC-03, porque a curva medida hoje nao atende nenhuma das seis bandas de win-rate nem a banda de sensibilidade mais restritiva.

**Leitura dos 3 tiers legados de `scripts/calibrate.ts` (criterio 2 do ROADMAP, copiada do Bloco 5, para que o criterio 2 tenha numero dos dois lados):**

| tier | fixture | win-rate medida | banda | desfecho |
| --- | --- | --- | --- | --- |
| dominant (20+ pt gap) | 90 x 65 | 84,4% | [80%; 90%] | PASS |
| competitive (10-20 pt gap) | 82 x 67 | 69,1% | [67%; 78%] | PASS |
| close (0-10 pt gap) | 75 x 72 | 53,5% | [48%; 62%] | PASS |

Os 3 tiers legados continuam PASS nesta rodada tambem, pela mesma razao do Bloco 4 e do Bloco 5: dirigem `runMatch`, nao `simulateMatch`, e sao CEGOS a qualquer mudanca em `power.ts` que os planos 28-02/28-03 venham a fazer. O criterio 2 do ROADMAP fica satisfeito pelo texto literal (3 tiers legados verdes) enquanto o gate que de fato mede o motor de producao (esta tabela de 6 pontos) documenta o defeito real a corrigir.

---

## Bloco 7: prova de neutralidade do mecanismo, com `ratingPowerD = null`

Medido apos as Tasks 1 e 2 do plano 28-02 (`SimConfig.ratingPowerD`/`MatchState.ratingPowerD` no valor neutro `null`; o canal `ratingFightMult` existe em `src/sim/power.ts`, e ligado em `fightPower`, mas retorna `1.0` imediatamente enquanto `ratingPowerD` for `null`, identidade byte a byte). O objetivo deste bloco e provar que o mecanismo entrou sem mudar NENHUM comportamento medido: golden intocado, suite sem vermelho novo, gates de calibracao com os MESMOS numeros do Bloco 5/Bloco 6.

**Placar da suite `npm test`, antes e depois desta task:**

| momento | verdes | vermelhos | total |
| --- | --- | --- | --- |
| antes (fechamento do plano 28-01, registrado em `.planning/STATE.md`) | 1119 | 2 (D-26-03, `src/sim/structures.test.ts`) | 1121 |
| depois (esta task, com `src/sim/ratingCurve.test.ts` adicionado) | 1141 | 2 (D-26-03, os mesmos dois, inalterados) | 1143 |

Delta: +22 testes, dos quais 16 sao os novos de `src/sim/ratingCurve.test.ts` (Task 3); os vermelhos permanecem EXATAMENTE os dois ja registrados antes desta fase (D-26-03), nenhum vermelho novo em nenhum arquivo.

**Saida literal de `npm run diff-golden` (rodado apos as Tasks 1 e 2, com `ratingPowerD = null` em `DEFAULT_SIM_CONFIG`):**

```
Diff estruturado de golden (INST-07): 15 snapshot(s) comum(uns) comparado(s) (15 no lado antigo, 15 no lado novo).

1) Vencedores mudados: 0
   nenhum

2) Tipos de evento acrescentados ou removidos: 0 snapshot(s) afetado(s)
   nenhum

3) Delta de duracao aproximado (proxy = timeSec do ultimo evento): 0 snapshot(s) afetado(s)
   nenhum

4) Violacoes de ordem detectadas: 0 snapshot(s) afetado(s)
   nenhuma

5) Blocos presentes so num dos lados (mudanca de estrutura, nao de valor): 0
   nenhum

Nenhuma diferenca encontrada em nenhuma das quatro dimensoes (nem em blocos): golden inalterado.
```

**Confirmacao independente:** `npx vitest run src/__tests__/golden/golden.test.ts` passou com os 15 snapshots existentes (25 testes, 0 falhas), SEM `--update` e sem regravar `__snapshots__`. O conteudo do arquivo de snapshot (`src/__tests__/golden/__snapshots__/golden.test.ts.snap`) e byte a byte identico ao commitado (`git diff` vazio, `numstat` vazio); o unico sinal que `git status` mostra e um aviso de normalizacao de fim de linha do proprio git no checkout local, sem nenhum conteudo alterado, nao causado por nenhuma edicao desta task.

**As 6 win-rates das ancoras, medidas depois do mecanismo entrar, identicas as do Bloco 5/Bloco 6, delta ao lado (zero em todas):**

| gap | win-rate medida apos 28-02 Task 1/2 | win-rate do Bloco 5/6 | delta |
| --- | --- | --- | --- |
| 0 | 0,565 | 0,565 | 0,000 |
| 5 | 0,820 | 0,820 | 0,000 |
| 10 | 0,952 | 0,952 | 0,000 |
| 20 | 1,000 | 1,000 | 0,000 |
| 30 | 1,000 | 1,000 | 0,000 |
| 40 | 1,000 | 1,000 | 0,000 |

A sensibilidade gap10-gap0 tambem repete o valor do Bloco 5/6, 0,387, delta 0,000. `npm run calibrate` continua vermelho, pelas MESMAS sete bandas do Bloco 6 (as seis ancoras de win-rate mais a sensibilidade gap10-gap0), nenhuma nova, nenhuma removida. `npm run calibrate:pace` tambem continua vermelho, com a banda `[Fase 28] win-rate com gap de forca 30 = 1.000` presente e inalterada em relacao ao estado anterior a esta task; as demais bandas vermelhas ali (Fases 25B/25C/26/27, todas com dono ja registrado em `.planning/STATE.md`) sao pre-existentes e nao pertencem a esta fase.

**Veredito do bloco.** O mecanismo entrou (campo de config, canal em `power.ts`, ligacao em `fightPower`) sem mudar nenhum numero medido: golden identico bit a bit, suite sem vermelho novo, e as 8 bandas de calibracao com o MESMO valor, casa a casa, do Bloco 5/6. A neutralidade da refatoracao esta provada por medicao, nao por inspecao. O plano 28-03 e quem muda `ratingPowerD` de `null` para um numero e move estes valores deliberadamente.

---

## Bloco 8: recalibracao de R1 e R2 com dado medido (D-01), plano 28-03 Task 2

Medido apos a Task 1 do plano 28-03 (`DEFAULT_SIM_CONFIG.ratingPowerD = 525`, `docs/diagnostics/28-sweep.md` Bloco 6). Proposito: pagar a divida provisoria de invariancia de nivel de `scripts/calibrate-pace.ts` (R1 e R2, tolerancias de 8 pontos percentuais herdadas sem fonte, `owner: "Fase 28"`), fechando D-01.

### R1 e R2, antes e depois, quatro casas

`ANTES` = motor com o canal de rating DESLIGADO (`ratingPowerD = null`, o estado do projeto antes desta task); `DEPOIS` = motor com `ratingPowerD = 525` (o valor escolhido na Task 1), amostra de seed base 0 (a primeira das tres amostras disjuntas do proximo bloco).

| relacao | ANTES (canal desligado) | DEPOIS (ratingPowerD=525) |
| --- | --- | --- |
| R1 (EQUILIBRADO menos AMADOR-EQUILIBRADO) | 0,0170 | 0,0170 |
| R2 (PRO-GAP menos AMADOR-GAP) | 0,0000 | -0,0060 |

**R1 nao se move entre ANTES e DEPOIS, e isso e esperado por construcao, nao um defeito da medicao.** `EQUILIBRADO` (75x75) e `AMADOR-EQUILIBRADO` (45x45) tem gap ZERO cada um, e `ratingFightMult` retorna exatamente `1,0` quando `delta = rOwn - rFoe = 0`, para QUALQUER `ratingPowerD` finito (identidade provada em `src/sim/ratingCurve.test.ts`, plano 28-02). O canal de rating NUNCA chega a tocar `fightPower` em nenhum dos dois tiers de R1: o residuo de 0,0170 medido e inteiramente de OUTROS canais dependentes de nivel absoluto (ouro, principalmente), fora do escopo desta fase. R1 mede a invariancia de nivel do motor COMO UM TODO, nao especificamente do canal de rating -- e por isso continua valida como gate, so nao e sensivel a esta task especificamente.

**R2 se move na direcao prevista** (0,0000 para -0,0060), mas com uma ressalva honesta: `PRO-GAP` (80x60, gap 20) e `AMADOR-GAP` (60x40, gap 20) ja estavam ambos SATURADOS perto de 100% ANTES do canal entrar (100,0% e 100,0% exatos no ANTES), entao o valor 0,0000 do ANTES e verde por SATURACAO EM AMBOS OS LADOS (o mesmo modo de "verde por deslocamento e nao por conserto" ja registrado como D-25B-01 nesta milestone), nao porque o motor ja garantisse invariancia de nivel por formula. DEPOIS do canal, os dois tiers deixam de estar 100% saturados (99,3% e 99,9% na amostra de seed base 0) e a diferenca entre eles (-0,0060) passa a refletir de fato a formula de `ratingFightMult`, que faz a razao efetiva de poder depender SO da diferenca de rating (`10^(delta/ratingPowerD)`), nao do nivel absoluto -- a prova matematica ja feita em `src/sim/ratingCurve.test.ts` (invariancia de nivel, D-02).

### Tres amostras disjuntas de R1 e R2, com media e desvio

Medidas com `ratingPowerD = 525` (Task 1), deslocando a base de seed em `scripts/calibrate-pace.ts` por rodada (0, 800, 1600), sem alterar `N = 800`. Mudanca temporaria na arvore de trabalho, revertida antes do commit final desta task (o arquivo committed preserva `seed = i`, `i` de 0 a `N-1`, o invariante de sempre).

| amostra (base de seed) | R1 medido | R2 medido |
| --- | --- | --- |
| 0 (seeds 0-799) | 0,0170 | -0,0060 |
| 800 (seeds 800-1599) | -0,0130 | 0,0000 |
| 1600 (seeds 1600-2399) | 0,0110 | -0,0080 |
| **media** | **0,0050** | **-0,0047** |
| **desvio padrao (amostral, n-1=2)** | **0,0159** | **0,0042** |
| **maior valor absoluto** | **0,0170** | **0,0080** |

Zero violacao de regra dura nas tres amostras, nos seis tiers. R1 e R2 ficam perto de zero nas tres amostras, confirmando a previsao teorica do plano (os testes do plano 28-02 ja sustentavam isso para R2; R1 e D-invariante por gap zero, Bloco acima).

### A tolerancia derivada, e a regra que a produziu

Regra do plano (28-03-PLAN.md Task 2): a tolerancia nova e o menor multiplo de 0,01 estritamente acima do maior valor absoluto observado nas tres amostras, com piso minimo de 0,03; se esse piso for menor que o teto de tres sigma da diferenca de duas proporcoes em N=800, ajustar para o valor de tres sigma medido (registrado por escrito).

**R1:** maior valor absoluto observado = 0,0170; menor multiplo de 0,01 estritamente acima = 0,02; piso minimo 0,03 e MAIOR que 0,02, entao o piso domina nesta primeira etapa. **Verificacao do teto de ruido amostral:** a formula correta de tres sigma da DIFERENCA de duas proporcoes independentes (nao a de uma proporcao isolada) e `3 * raiz(p1(1-p1)/n1 + p2(1-p2)/n2)`. Com `p` pooled das seis leituras de EQUILIBRADO/AMADOR-EQUILIBRADO (Bloco acima) igual a 0,5473 e `n1=n2=800`: `3 * raiz(2 * 0,5473 * 0,4527 / 800) = 3 * raiz(0,0006195) = 3 * 0,02489 = 0,0747`. **O piso de 0,03 e MENOR que 0,0747**, entao a regra manda ajustar para o valor de tres sigma medido, arredondado para cima ao multiplo de 0,01 mais proximo: **0,08**. Nota de correcao registrada por escrito: o texto do plano estimava "cerca de 0,05" para este teto; o calculo direto contra as leituras reais desta task da 0,0747, quase 50% maior. A diferenca vem de o plano ter usado (implicitamente) o erro padrao de UMA proporcao isolada (`raiz(0,25/800) = 0,0177`, cujo triplo e 0,053, perto do "0,05" citado) em vez do erro padrao da DIFERENCA de duas proporcoes independentes (que soma as duas variancias e por isso e `raiz(2)` vezes maior). Usado aqui o calculo correto para a grandeza que R1 de fato mede (uma diferenca, nao uma proporcao isolada).

**R2:** maior valor absoluto observado = 0,0080; menor multiplo de 0,01 estritamente acima = 0,01; piso minimo 0,03 e MAIOR que 0,01, piso domina. Teto de tres sigma para este par: `p1` (PRO-GAP) = 0,994, `p2` (AMADOR-GAP) = 0,9987 (medias das tres amostras); `3 * raiz(0,994*0,006/800 + 0,9987*0,0013/800) = 3 * raiz(0,0000091) = 3 * 0,00301 = 0,0090`. **O piso de 0,03 NAO e menor que o teto de ruido (0,0090 menor que 0,03)**, entao o piso permanece sem ajuste: **0,03**.

**Tolerancias finais aplicadas em `scripts/calibrate-pace.ts`:**

| relacao | tolerancia antiga | tolerancia nova | mudanca |
| --- | --- | --- | --- |
| R1 | plus/minus 0,08 (herdada, sem fonte propria) | plus/minus 0,08 (medida, tres sigma arredondado) | mesmo numero, agora com procedencia derivada |
| R2 | plus/minus 0,08 (herdada, sem fonte propria) | plus/minus 0,03 (medida, piso de ruido amostral) | banda quase tres vezes mais estreita |

`provisional: true` removido das duas; `source` de ambas atualizado para citar este Bloco 8. Contagem de bandas `provisional: true` em `scripts/calibrate-pace.ts`: **7 antes desta task, 5 depois** (queda de exatamente 2, verificavel por `grep -v '^ *[*/]' scripts/calibrate-pace.ts | grep -c 'provisional: true'`). R3 (invariancia de nivel de DURACAO, dono Fase 25) NAO foi tocada: continua `provisional: true`, com comentario novo explicando por que a Fase 28 nao a recalibrou (mede duracao, nao win-rate; fora do mandato desta task).

### Veredito do bloco

D-01 esta fechado: as duas tolerancias provisorias com dono Fase 28 foram pagas com dado medido (tres amostras disjuntas, media e desvio registrados acima), sem duplicar a tabela de 6 pontos-ancora no tier amador (a invariancia de nivel continua sendo propriedade da formula de `ratingFightMult`, nao de uma segunda tabela calibrada por tier, D-02). `npm run calibrate:pace` continua vermelho pelas mesmas bandas de sempre (nenhuma nova, nenhuma removida por esta task, exceto a marca PROVISORIA saindo de R1/R2): a banda `win-rate com gap de forca 30` (dona Fase 28, ver Bloco 6 de `docs/diagnostics/28-sweep.md`) e as bandas herdadas das Fases 25B/25C/26/27 permanecem exatamente como estavam.

---

## Bloco 9: desfecho medido de FRC-01, FRC-02 e FRC-03

Medido apos as Tasks 1 e 2 do plano 28-03, rodando em sequencia e sem curto-circuito `npm run calibrate`, `npm run calibrate:pace` e `npm test`, com `DEFAULT_SIM_CONFIG.ratingPowerD = 525` (o valor final desta fase, `docs/diagnostics/28-sweep.md` Bloco 6).

### 1. FRC-01: a tabela de 6 ancoras

| gap | fixture | win-rate medida | piso | teto | marca |
| --- | --- | --- | --- | --- | --- |
| 0 | 75 x 75 | 0,5650 | 0,44 | 0,56 | FORA (teto) |
| 5 | 78 x 73 | 0,7983 | 0,52 | 0,66 | FORA (teto) |
| 10 | 80 x 70 | 0,9200 | 0,58 | 0,76 | FORA (teto) |
| 20 | 85 x 65 | 0,9950 | 0,69 | 0,90 | FORA (teto) |
| 30 | 90 x 60 | 1,0000 | 0,80 | 0,97 | FORA (teto) |
| 40 | 95 x 55 | 1,0000 | 0,85 | 0,97 | FORA (teto) |

**Placar: 0 de 6 pontos DENTRO.** Assert de ordenacao: o codigo de `scripts/calibrate-engine.ts` roda `expectBands` ANTES do assert de sequencia nao-decrescente, e `expectBands` lanca nesta rodada (7 bandas fora, ver item 2/3 abaixo) -- o assert de ordenacao no arquivo nunca chega a executar. Verificado por inspecao direta da sequencia medida: `0,5650 -> 0,7983 -> 0,9200 -> 0,9950 -> 1,0000 -> 1,0000`, nao decrescente em toda a extensao, mesmo desfecho que o codigo teria reportado se tivesse alcancado aquela linha.

### 2. FRC-02: gap 30 e gap 40 contra o teto 0,97

| leitura | valor (4 casas) | teto | desfecho |
| --- | --- | --- | --- |
| ANCORA-30 (`scripts/calibrate-engine.ts`, N=600) | 1,0000 | 0,97 | FORA |
| ANCORA-40 (`scripts/calibrate-engine.ts`, N=600) | 1,0000 | 0,97 | FORA |
| `win-rate com gap de forca 30` (`scripts/calibrate-pace.ts`, N=800) | 1,0000 | 0,97 | FORA |

As tres leituras dao exatamente `1,0000` (800 de 800 partidas em `calibrate:pace`; 600 de 600 em cada ancora de `calibrate-engine`), nao um valor que arredonda para `1,0000` a partir de uma fracao menor. **FRC-02 NAO fechou.** A regiao de fechamento para `ANCORA-30`/`ANCORA-40` foi provada VAZIA por medicao no Bloco 5 de `docs/diagnostics/28-sweep.md`: mesmo no teto assintotico deste canal (`ratingPowerD = 100000`, achatamento maximo matematico possivel), as duas leituras continuam em `1,0000`.

### 3. FRC-03: as duas distancias de sensibilidade

| distancia | valor medido | piso | teto | folga contra o piso | folga contra o teto | lado apertado |
| --- | --- | --- | --- | --- | --- | --- |
| gap10 menos gap0 | 0,3550 | 0,11 | 0,27 | 0,2450 | -0,0850 (estourou) | TETO, faltam 0,0850 para fechar |
| gap20 menos gap5 | 0,1967 | 0,16 | 0,29 | 0,0367 | 0,0933 | PISO, folga de so 0,0367 |

`gap10 menos gap0` esta FORA pelo TETO (a curva ainda sobe rapido demais entre gap 0 e gap 10, herdando o mesmo excesso que faz `ANCORA-10` estourar seu proprio teto). `gap20 menos gap5` esta DENTRO, mas com o lado do PISO como o mais apertado dos dois -- registrado explicitamente para a Fase 29, que vai mexer na win probability: ha MENOS espaco do lado do piso desta banda do que do lado do teto.

### 4. Criterio 2 do ROADMAP, texto literal

| tier | fixture | win-rate medida | banda | desfecho |
| --- | --- | --- | --- | --- |
| dominant (20+ pt gap) | 90 x 65 | 84,4% | [80%; 90%] | PASS |
| competitive (10-20 pt gap) | 82 x 67 | 69,1% | [67%; 78%] | PASS |
| close (0-10 pt gap) | 75 x 72 | 53,5% | [48%; 62%] | PASS |

Os tres numeros sao byte a byte identicos aos medidos no Bloco 5/6 (`git diff --stat` do intervalo inteiro do plano 28-03 nao lista `scripts/calibrate.ts` nem `src/sim/runMatch.ts`, verificado). **Isto e a confirmacao empirica do achado do Bloco 4 (`scripts/calibrate.ts` dirige `runMatch`, que nao importa `power.ts` e e cego a qualquer mudanca no canal de rating), nao sucesso da fase**: os 3 tiers legados continuariam PASS mesmo que `ratingPowerD` tivesse sido escolhido de forma a piorar a curva, porque este harness simplesmente nao ve o canal.

### 5. Sem regressao colateral

Comparadas TODAS as linhas de banda de `npm run calibrate:pace` entre o estado imediatamente anterior a esta task (`ratingPowerD = null`, tolerancias R1/R2 antigas de +-0,08 provisorias) e o estado apos as Tasks 1 e 2 (`ratingPowerD = 525`, R1 +-0,08 medida, R2 +-0,03 medida), rotulo por rotulo: **nenhuma banda mudou de cor em nenhum sentido.** A UNICA diferenca textual entre os dois relatorios e a remocao da marca `PROVISORIA` de R1 e R2 (mesmo desfecho `[OK]` nas duas leituras). Isto inclui as onze bandas de DISPERSAO, as bandas de FORMA, as tres de ACOPLAMENTO e as quatro de densidade -- todas identicas casa a casa nas duas rodadas.

### 6. Golden

Os snapshots de `src/__tests__/golden/golden.test.ts` ficam VERMELHOS a partir desta onda, de proposito: a mudanca de `ratingPowerD` de `null` para `525` altera o resultado de partidas com gap de rating diferente de zero, e os tres fixtures do golden (`stomp` 84x58, `balanced` 70x68, `close` 65x57) tem gap diferente de zero. **Dono da regeneracao: plano 28-05**, que faz a regeneracao unica da fase depois que o plano 28-04 (destaque de upset) tambem tiver entrado, para a fase gastar UMA regeneracao e nao duas (Objective do plano 28-03).

**Numero exato medido, sem arredondar para "todos os 15":** de 15 entradas de snapshot (`scripts/diff-golden.test.ts` confirma 15 entradas no arquivo `.snap` atual), **14 NAO batem mais** (`stomp`: 5 de 5 seeds; `close`: 5 de 5 seeds; `balanced`: 4 de 5 seeds -- a seed 123 de `balanced` continua batendo, por coincidencia de nao cruzar nenhuma decisao sensivel ao canal nesta seed especifica). `structures.test.ts` mantem os MESMOS 2 vermelhos ja registrados antes desta fase (D-26-03, sem mudanca).

**Placar da suite `npm test`, medido em tres rodadas completas para confirmar reprodutibilidade:** **1125 verdes, 18 vermelhos, 1143 no total**, estavel nas tres rodadas. Dos 18 vermelhos, 17 sao SEMPRE os mesmos: os 14 snapshots de golden (acima), os 2 de `structures.test.ts` (D-26-03, heranca), e 1 novo em `src/sim/gold-scale-identity.test.ts` (`perfil GAP, seed 999`) -- este ultimo E atribuivel a esta task (confirmado desaparecer quando `ratingPowerD` volta a `null`), e E o modo de falha que o proprio cabecalho daquele arquivo de teste ja antecipa e autoriza por escrito ("cruzamento de limiar por ultimo bit de ponto flutuante... registrar o caso... NUNCA relaxar o teste"): a nova multiplicacao de `ratingFightMult` em `fightPower` introduz mais uma operacao de ponto flutuante que, nesta unica seed, empurra uma decisao ja no limite para o lado oposto entre a rodada com `goldScale` implicito (2,75) e a rodada com `goldScale=1` explicito -- ambas com o MESMO `ratingPowerD=525`, entao a causa e ruido de ultimo bit somado, nao logica de rating incorreta. O 18o vermelho ALTERNA entre rodadas (`scripts/diff-golden.test.ts` numa rodada, `src/sim/buffs.test.ts` nas outras duas), sem nenhuma mudanca de codigo entre as rodadas -- registrado como item fora do escopo desta task em `.planning/phases/28-curva-de-for-a-por-diferen-a-de-rating/deferred-items.md` (D-28-03-01), com hipotese de dependencia de ordem/tempo do pool de workers do vitest, nao investigada.

### Veredito do bloco

FRC-01, FRC-02 e FRC-03 NAO fecharam nenhuma das 7 bandas restantes (a oitava, sensibilidade gap20-gap5, ja fechava desde a leitura de abertura e continua fechada). Nenhum piso nem teto de `scripts/calibrate-engine.ts` foi alterado por esta task (`git diff` desta task nao lista o arquivo). A causa de `ANCORA-30`/`ANCORA-40`/`gap de forca 30` esta provada como regiao VAZIA para o canal isolado de curva de rating (Bloco 5 de `docs/diagnostics/28-sweep.md`); a causa de `ANCORA-05`/`10`/`20` e da sensibilidade gap10-gap0 continua sem fronteira estabelecida (a grade nao alcancou, so se aproximou -- Bloco 5 mostra movimento continuo ate o teto assintotico). O criterio 2 do ROADMAP (texto literal) fecha pelos 3 tiers legados, que sao cegos ao canal desta fase por construcao, nao por merito da mudanca desta task.

---

*Este arquivo recebeu o Bloco 5 (leitura de abertura) e o Bloco 6 (decisao formal sobre o branch "fechar a fase sem mexer em D") nas Tasks 2 e 3 do plano 28-01, o Bloco 7 (prova de neutralidade do mecanismo com `ratingPowerD = null`) na Task 3 do plano 28-02, o Bloco 8 (recalibracao medida de R1/R2, D-01) na Task 2 do plano 28-03, e o Bloco 9 (desfecho medido de FRC-01/02/03) na Task 3 do plano 28-03. Regra de escrita do arquivo inteiro: pt-BR, e nenhuma linha acrescentada pode conter o caractere de travessao.*
