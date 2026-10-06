# Fase 28 Plano 03: sweep em grade de `ratingPowerD`

**Fase:** 28-curva-de-for-a-por-diferen-a-de-rating
**Plano de origem:** 28-03 (Task 1)
**Proposito, em uma linha:** escrever a REGRA DE ESCOLHA de `DEFAULT_SIM_CONFIG.ratingPowerD` antes de medir qualquer ponto de grade, medir a grade inteira (nao so o ponto escolhido), e trocar o valor NEUTRO (`null`, plano 28-02) por um numero medido.

Instrumento antes de motor, mesmo precedente ja usado em `docs/diagnostics/27-sweep.md` (`goldScale`) e em toda a milestone v2.2.

---

## Bloco 1: REGRA DE ESCOLHA, escrita antes de qualquer numero de grade

Copiada literalmente de `28-03-PLAN.md` Task 1 (o texto do plano, commitado muito antes desta execucao, e a fonte da regra, nao esta agente):

**A grade:** `ratingPowerD` em {170, 220, 280, 350, 450, 600}, mais a linha de referencia `null` (canal desligado, ja medida no plano 28-02, Bloco 7 de `docs/diagnostics/28-ancoragem.md`).

**Por que o ponto de partida e 170:** e a inclinacao efetiva do motor de hoje em gap 30, `30 / log10(90/60) = 30 / 0,176091 = 170,4`. A grade so anda para cima, porque valores maiores de `ratingPowerD` achatam mais e a leitura de abertura (Bloco 6 de `28-ancoragem.md`) mostra saturacao (nunca falta de separacao).

**Criterio de escolha, nesta ordem:**
1. Vence o ponto de grade com as 8 bandas de `scripts/calibrate-engine.ts` (6 ancoras + 2 sensibilidade) DENTRO.
2. Havendo mais de um, vence o que minimiza a soma dos quadrados dos desvios entre win-rate medida e alvo `targetWinProb(gap)` nas 6 ancoras.
3. Havendo empate, vence o menor `ratingPowerD` (menos achatamento, criterio 3 do ROADMAP.md).

**Regra de refino:** se nenhum ponto da grade fechar as 8, refinar UMA vez entre os dois pontos vizinhos mais promissores com 3 pontos intermediarios, registrar o refino na mesma tabela e parar. Se o refino tambem nao fechar, NAO alargar banda nenhuma: registrar a fronteira medida dos dois lados e o desfecho como nao fechado com dono, seguindo o precedente das Fases 25B e 26.

**Regra de instrumentacao:** nenhum ponto de grade intermediario e guardado no repositorio; os pontos rodam na arvore de trabalho e so o vencedor e commitado. A duracao media e a taxa de abates do tier `ANCORA-00` (canal identidade exata em gap 0, provado em `src/sim/ratingCurve.test.ts` do plano 28-02) sao registradas por ponto como efeito colateral mais barato de observar: qualquer movimento nelas seria sinal de vazamento do canal para fora do gap.

---

## Bloco 2: a grade principal, medida com `npm run calibrate`

Cada linha: `DEFAULT_SIM_CONFIG.ratingPowerD` trocado na arvore de trabalho, `npm run calibrate` rodado, `tmp/calibration.txt` lido. As 6 win-rates das ancoras (N=600 cada) e as 2 distancias de sensibilidade sao as mesmas colunas de `docs/diagnostics/28-ancoragem.md` Bloco 3/6.

| `ratingPowerD` | ANCORA-00 (gap0) | ANCORA-05 (gap5) | ANCORA-10 (gap10) | ANCORA-20 (gap20) | ANCORA-30 (gap30) | ANCORA-40 (gap40) | sens 10-0 | sens 20-5 | bandas DENTRO | assert ordenacao |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `null` (referencia, 28-02 Bloco 7) | 0,5650 FORA | 0,8200 FORA | 0,9517 FORA | 1,0000 FORA | 1,0000 FORA | 1,0000 FORA | 0,3867 FORA | 0,1800 DENTRO | 1/8 | OK |
| 170 | 0,5650 FORA | 0,8183 FORA | 0,9500 FORA | 1,0000 FORA | 1,0000 FORA | 1,0000 FORA | 0,3850 FORA | 0,1817 DENTRO | 1/8 | OK |
| 220 | 0,5650 FORA | 0,8200 FORA | 0,9400 FORA | 1,0000 FORA | 1,0000 FORA | 1,0000 FORA | 0,3750 FORA | 0,1800 DENTRO | 1/8 | OK |
| 280 | 0,5650 FORA | 0,8100 FORA | 0,9317 FORA | 0,9983 FORA | 1,0000 FORA | 1,0000 FORA | 0,3667 FORA | 0,1883 DENTRO | 1/8 | OK |
| 350 | 0,5650 FORA | 0,8050 FORA | 0,9233 FORA | 0,9967 FORA | 1,0000 FORA | 1,0000 FORA | 0,3583 FORA | 0,1917 DENTRO | 1/8 | OK |
| 450 | 0,5650 FORA | 0,8033 FORA | 0,9217 FORA | 0,9950 FORA | 1,0000 FORA | 1,0000 FORA | 0,3567 FORA | 0,1917 DENTRO | 1/8 | OK |
| 600 | 0,5650 FORA | 0,8083 FORA | 0,9183 FORA | 0,9917 FORA | 1,0000 FORA | 1,0000 FORA | 0,3533 FORA | 0,1833 DENTRO | 1/8 | OK |

Zero violacao de regra dura (`baron<20:00`, `elder-sem-alma`, `roubo-sem-contest`, `atakhan`) em qualquer ponto, em qualquer um dos 6 tiers-ancora. O assert de ordenacao (sequencia de win-rate nao-decrescente gap 0 a 40) passa em toda a grade: a curva nunca inverte, so achata devagar.

**Leitura sem suavizar:** nenhum ponto da grade principal fecha as 8 bandas. `ANCORA-00` esta sempre FORA por 0,0050 acima do teto 0,56 em TODOS os pontos, inclusive `null` -- e um vies estrutural do fixture 75x75 (vantagem residual de primeiro-a-agir do motor), independente de `ratingPowerD` por construcao (identidade exata em `delta=0`, provada em `src/sim/ratingCurve.test.ts`, Task 3 do plano 28-02). Nenhum valor de `ratingPowerD` pode mover esta banda; ela fica fora do escopo que este canal consegue endereçar. `ANCORA-30` e `ANCORA-40` ficam em exatamente 1,0000 (zero derrotas em 600 partidas) em TODOS os 7 pontos medidos, do `null` ao 600 -- o achatamento move `ANCORA-05`/`ANCORA-10`/`ANCORA-20` na direcao certa (devagar), mas nao move `ANCORA-30`/`ANCORA-40` nem um decimo de ponto percentual dentro da resolucao de N=600.

---

## Bloco 3: efeito colateral do canal em `ANCORA-00` (gap 0), identidade exata

`duração média` e `eventos médios` do tier `ANCORA-00`, impressos por `scripts/calibrate-engine.ts` em cada um dos 7 pontos medidos no Bloco 2 (`null`, 170, 220, 280, 350, 450, 600): **30:08 e 77,5 EM TODOS OS PONTOS, sem nenhuma divergencia.**

`taxa de abates` (kills totais dos dois lados por partida) nao e um numero que `scripts/calibrate-engine.ts` imprime hoje (fora do escopo de arquivos deste plano modificar o harness); medida por instrumentacao de descarte (script temporario, nunca commitado, deletado apos a leitura) que reusa exatamente o mesmo fixture (`u-*`/`r-*`, 75x75), a mesma semente por partida (`mulberry32(seed)`, seed 0 a 599) e o `DEFAULT_SIM_CONFIG` com `ratingPowerD` variando, somando `finalState.user.kills + finalState.rival.kills` por partida:

| `ratingPowerD` | media de abates/partida (ANCORA-00) | duracao media (s) |
| --- | --- | --- |
| `null` | 39,4517 | 1808,45 |
| 170 | 39,4517 | 1808,45 |
| 600 | 39,4517 | 1808,45 |

**Identidade exata nos tres pontos medidos, sem nenhum digito de diferenca.** Isto e o comportamento matematicamente esperado (nao uma coincidencia de sorte de seed): em `ANCORA-00`, `rOwn == rFoe` (75 == 75), entao `delta = 0` em `ratingFightMult`, e a formula retorna `(rBar/rOwn) * 10^(0/(2D)) = 1 * 10^0 = 1,0` exatamente, para QUALQUER `D` finito -- o canal nunca chega a tocar `fightPower` em gap 0, independente do valor escolhido na grade. Nenhum vazamento do canal para fora do gap foi detectado.

---

## Bloco 4: refino, entre os dois pontos vizinhos mais promissores

Como nenhum ponto da grade principal fechou as 8 bandas (Bloco 2), a regra de refino do Bloco 1 se aplica: refinar UMA vez entre os dois pontos vizinhos mais promissores.

**Escolha dos dois vizinhos:** por soma dos quadrados dos desvios (SSD) contra `targetWinProb(gap)` nas 6 ancoras (formula do criterio 2), calculada para os 6 pontos da grade principal:

| `ratingPowerD` | SSD (6 ancoras) |
| --- | --- |
| 170 | 0,213504 |
| 220 | 0,208548 |
| 280 | 0,198491 |
| 350 | 0,190989 |
| 450 | 0,188661 |
| 600 | 0,187752 |

SSD decresce monotonicamente da esquerda para a direita (achatar mais sempre reduz o desvio quadratico total, ainda que devagar); os dois pontos vizinhos com MENOR SSD sao 450 e 600, os dois mais promissores. Refino: 3 pontos intermediarios igualmente espacados entre 450 e 600 -- **487,5; 525; 562,5**.

**A grade de refino, mesmo formato do Bloco 2:**

| `ratingPowerD` | ANCORA-00 | ANCORA-05 | ANCORA-10 | ANCORA-20 | ANCORA-30 | ANCORA-40 | sens 10-0 | sens 20-5 | bandas DENTRO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 487,5 | 0,5650 FORA | 0,8017 FORA | 0,9217 FORA | 0,9950 FORA | 1,0000 FORA | 1,0000 FORA | 0,3567 FORA | 0,1933 DENTRO | 1/8 |
| **525** | 0,5650 FORA | 0,7983 FORA | 0,9200 FORA | 0,9950 FORA | 1,0000 FORA | 1,0000 FORA | 0,3550 FORA | 0,1967 DENTRO | 1/8 |
| 562,5 | 0,5650 FORA | 0,8033 FORA | 0,9217 FORA | 0,9933 FORA | 1,0000 FORA | 1,0000 FORA | 0,3567 FORA | 0,1900 DENTRO | 1/8 |

Zero violacao de regra dura nos 3 pontos de refino, nos 6 tiers-ancora. Assert de ordenacao OK nos 3.

**O refino tambem nao fecha as 8 bandas.** `ANCORA-30`/`ANCORA-40` continuam em 1,0000 exato nos 3 pontos, `ANCORA-00` continua em 0,5650 (identidade, Bloco 3). Pela regra do Bloco 1, a busca PARA aqui: nenhuma banda e alargada.

**SSD dos 3 pontos de refino:**

| `ratingPowerD` | SSD (6 ancoras) |
| --- | --- |
| 487,5 | 0,187950 |
| **525** | **0,185558** |
| 562,5 | 0,187951 |
| (600, para comparacao) | 0,187752 |

**525 tem o MENOR SSD de toda a grade principal + refino** (0,185558, contra 0,187752 do proprio 600 e 0,187950/0,187951 dos vizinhos imediatos 487,5/562,5). A curva de SSD nao e perfeitamente monotonica no refino: a variacao residual entre 487,5/525/562,5 (diferenca de 0,0000-0,0024) e da ordem do ruido amostral em N=600 por ancora (sigma binomial ~0,02 em p=0,5), nao um segundo minimo real. **`ratingPowerD = 525` VENCE pelo criterio 2 do Bloco 1** (nenhum ponto fechou o criterio 1; 525 minimiza a SSD entre todos os pontos medidos na grade principal e no refino).

---

## Bloco 5: prova complementar de que a regiao de ANCORA-30/ANCORA-40 e VAZIA (fora do processo formal de escolha)

**Este bloco NAO compete pela escolha do Bloco 4.** A regra do Bloco 1 autoriza a grade principal (6 pontos) mais UM refino (3 pontos) e manda PARAR depois disso. O ponto abaixo e medido a parte, como prova complementar, para caracterizar por que `ANCORA-30`/`ANCORA-40` nao fecham nem no limite teorico do canal -- nao para escolher um valor fora do processo declarado.

**O teto matematico do canal.** Em `ratingFightMult`, quando `D -> infinito`, o termo `10^(delta/(2D)) -> 10^0 = 1`, entao o multiplicador do lado mais forte tende a `rBar/rOwn` (um valor FIXO, independente de quao grande `D` fica) e o do lado mais fraco tende a `rBar/rFoe`. Para o fixture de `ANCORA-30` (90 contra 60), `rBar = raiz(90*60) = 73,485`, entao o teto assintotico do desconto no lado forte e `73,485/90 = 0,8165` (17,35% de desconto no MAXIMO possivel, para qualquer `D` por maior que seja).

**Medido, nao so calculado:** com `ratingPowerD = 100000` (delta/2D = 30/200000 = 0,00015, essencialmente no limite assintotico), `ANCORA-30` e `ANCORA-40` continuam em **1,0000** (zero derrotas em 600 partidas cada), identico aos 7 pontos da grade principal e aos 3 do refino. `ANCORA-05`/`ANCORA-10`/`ANCORA-20` continuam a se mover na direcao certa (0,7850 / 0,8883 / 0,9917), confirmando que o canal continua vivo e funcionando no limite -- so nao alcanca `ANCORA-30`/`ANCORA-40`.

**Leitura sem suavizar:** mesmo no teto matematico deste canal (achatamento maximo possivel por diferenca de rating de CARTA), a win-rate de PARTIDA em gap 30/40 nao sai de 1,0000 em 600 partidas. Isto confirma por medicao a nota de sequenciamento ja registrada em `28-CONTEXT.md` e `docs/diagnostics/27-relatorio-da-fase.md` linha 153: a saturacao nao vem da formula de uma luta isolada (o teto assintotico de 17-33% de desconto por luta e substancial), vem do NUMERO DE RESOLUCOES POR PARTIDA -- cada partida resolve dezenas de lutas, e mesmo uma vantagem por luta reduzida em quase um terco ainda compoe para quase-certeza no nivel da partida inteira quando ha muitas lutas. **A regiao de fechamento de `ANCORA-30` e `ANCORA-40` para este canal (curva de forca por diferenca de rating de CARTA, isolada) e VAZIA**, no mesmo sentido que as Fases 25B e 26 usaram a distincao entre fronteira de INSTRUMENTO (mais medicao resolveria) e fronteira de MODELO (nenhuma medicao adicional dentro do escopo autorizado resolveria). Consertar isto exigiria mexer no NUMERO de resolucoes por partida ou na formula de luta isolada (`engine.ts:1146-1147`), ambos fora do escopo desta fase pela nota de sequenciamento do ROADMAP.md ("o ruido de luta... nao deve ser alterado por esta fase").

---

## Bloco 6: o ponto escolhido e a aplicacao

**`DEFAULT_SIM_CONFIG.ratingPowerD = 525`**, vencedor pelo criterio 2 do Bloco 1 (menor SSD entre os 6 pontos da grade principal e os 3 do refino, Bloco 4). Aplicado em `src/sim/matchState.ts`, unico lugar do codigo onde o valor muda, com o comentario do campo e do valor por extenso citando este arquivo.

**Bandas que fecham com `ratingPowerD = 525`:** 1 de 8 (`sensibilidade gap 20 contra gap 5`, 0,1967, dentro de [0,16; 0,29]). As 7 restantes ficam registradas como NAO FECHADAS, sem nenhum piso ou teto alterado:

| banda | valor em D=525 | piso | teto | lado apertado | regiao de fechamento |
| --- | --- | --- | --- | --- | --- |
| ANCORA-00 (gap 0) | 0,5650 | 0,44 | 0,56 | TETO (falta 0,0050) | VAZIA para este canal (identidade em gap 0, Bloco 3) |
| ANCORA-05 (gap 5) | 0,7983 | 0,52 | 0,66 | TETO (falta 0,1383) | nao estabelecida (grade nao alcancou; movimento residual visto na assintota, Bloco 5) |
| ANCORA-10 (gap 10) | 0,9200 | 0,58 | 0,76 | TETO (falta 0,1600) | nao estabelecida (idem) |
| ANCORA-20 (gap 20) | 0,9950 | 0,69 | 0,90 | TETO (falta 0,0950) | nao estabelecida (idem, mais perto: assintota chega a 0,9917) |
| ANCORA-30 (gap 30) | 1,0000 | 0,80 | 0,97 | TETO (falta 0,0300) | **VAZIA, provado por medicao no teto assintotico (Bloco 5)** |
| ANCORA-40 (gap 40) | 1,0000 | 0,85 | 0,97 | TETO (falta 0,0300) | **VAZIA, provado por medicao no teto assintotico (Bloco 5)** |
| sensibilidade gap 10 contra gap 0 | 0,3550 | 0,11 | 0,27 | TETO (falta 0,0850) | nao estabelecida (mesma causa de ANCORA-10, herda o excesso) |

**Nenhum piso nem teto de `scripts/calibrate-engine.ts` foi alterado nesta task.**

---

## Bloco 7: Derivacao do ganho de agregacao

```
ganho de agregacao = ratingPowerD / RATING_CURVE_D
                    = 525 / 35,5
                    = 14,79
```

**`D = 35,5` continua sendo o UNICO parametro declarado e interpretavel** (inclinacao da curva de win-rate de PARTIDA, `docs/diagnostics/28-ancoragem.md` Bloco 2: `D = 30 / log10(0,875/0,125) = 35,4989...`, arredondado para 35,5). `ratingPowerD = 525` e quantidade DERIVADA: e o valor que, no dominio de PODER de luta (nao no dominio de win-rate de partida), produz o melhor ajuste medido (menor SSD) contra a tabela de 6 pontos-ancora que `D = 35,5` define -- obtido por medicao do proprio motor (grade + refino, Blocos 2 e 4), nao escolhido a dedo nem inventado. O ganho de agregacao de **14,79** e a razao entre os dois: cada decada de razao de poder por PARTIDA (o que `D = 35,5` declara) corresponde a `14,79` decadas de razao de poder por LUTA individual (o que `ratingPowerD` regula), refletindo que uma partida resolve muitas lutas e cada luta isolada precisa de uma inclinacao muito mais suave para que a partida inteira, apos compor dezenas de resolucoes, tenha a inclinacao agregada que `D = 35,5` declara. `ratingPowerD` NAO e um segundo parametro livre: e a imagem de `D = 35,5` no dominio de poder, calibrada por medicao contra a mesma tabela que `D` define.

---

*Regra de escrita do arquivo inteiro: pt-BR, e nenhuma linha acrescentada pode conter o caractere de travessao.*
