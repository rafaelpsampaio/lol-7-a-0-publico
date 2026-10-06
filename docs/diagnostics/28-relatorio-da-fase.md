# Fase 28: relatorio de fechamento

**Data:** 2026-08-24
**Fase:** 28-curva-de-for-a-por-diferen-a-de-rating
**Plano de origem:** 28-05 (Task 4)
**Proposito, em uma linha:** fechar a fase com veredito por medicao em cada um dos 4 criterios do `ROADMAP.md`, com a adicao de escopo (zebra) julgada em secao separada, a prova por diff da fase inteira, o placar dos sete gates antes e depois, o custo de cada banda movida e a lista de itens que ficam sem dono, sem suavizar nenhum numero.

---

## 1. Veredito por criterio, sem suavizar

Fonte de cada numero: `docs/diagnostics/28-ancoragem.md` Bloco 9 (medido apos o plano 28-03), `docs/diagnostics/28-sweep.md` Blocos 2, 5 e 6 (grade e prova complementar de regiao vazia), e a rodada de `npm run calibrate:all` e `npm run calibrate:pace` executada nesta Task 4 apos a regeneracao unica do golden (os numeros de calibracao nao mudam entre as duas medicoes, porque a Task 4 nao tocou `src/sim/`, so regenerou o snapshot do golden e ajustou o proprio verificador de diff).

| # | criterio (`ROADMAP.md` Fase 28) | requisito | numero medido | desfecho |
| --- | --- | --- | --- | --- |
| 1 | Tabela de 6 pontos-ancora (gap 0, 5, 10, 20, 30, 40), cada um com piso e teto, N >= 500, todos verdes | FRC-01 | **0 de 6 pontos DENTRO** (`docs/diagnostics/28-ancoragem.md` Bloco 9, item 1). Assert de ordenacao nao chega a rodar porque `expectBands` lanca primeiro, mas a sequencia medida (0,5650 / 0,7983 / 0,9200 / 0,9950 / 1,0000 / 1,0000) e nao decrescente, verificado por inspecao direta | **NAO ATENDIDO** |
| 2 | Os 3 tiers legados de `scripts/calibrate.ts:141` nas bandas 80-90% / 67-78% / 48-62%, e gap grande NUNCA 100,0% em amostra de centenas de partidas | FRC-02 | Os 3 tiers legados PASSAM (84,4% / 69,1% / 53,5%), mas por construcao sao CEGOS ao canal desta fase (`runMatch.ts` nao importa `power.ts`, achado do Bloco 4 de `28-ancoragem.md`). A clausula literal que a fase existe para fechar, gap grande nunca 100,0%, MEDE **1,0000 exato em ANCORA-30 e ANCORA-40** (600 de 600 partidas cada) e **1,000 exato** na banda `win-rate com gap de forca 30` de `calibrate:pace` (N=800) | **NAO ATENDIDO** (a clausula dos 3 tiers fecha pelo texto literal, mas por um harness cego ao canal; a clausula do 100,0% nao fecha) |
| 3 | Distancia de win-rate entre gap 0 e gap 10, e entre gap 5 e gap 20, ficam acima de um piso declarado | FRC-03 | `gap10 menos gap0` = 0,3550 (piso 0,11, folga +0,245; teto 0,27, ESTOUROU por 0,085). `gap20 menos gap5` = 0,1967 (piso 0,16, folga +0,0367; teto 0,29, folga +0,0933, DENTRO). **O piso literal do criterio esta atendido nas DUAS distancias, com folga confortavel**; o teto do bracket de dois lados (que o proprio criterio nao pede, mas que `scripts/calibrate-engine.ts` tambem assert a) reprova 1 das 2 | **PARCIAL**: 1 de 2 bandas de dois lados fechada; o piso literal (o que o criterio realmente teme, achatar demais) fecha nas duas |
| 4 | `D` interpretavel derivado de alvo declarado, e o diff da fase prova que nenhuma constante de ruido de luta foi alterada | FRC-04 | `D = 35,5` derivado por escrito (secao 3 abaixo). `node scripts/verify-28-diff.cjs --expect-change`: as sete verificacoes ATENDIDAS, `VEREDITO: OK` (secao 4 abaixo) | **ATENDIDO** |

**Leitura sem suavizar: um de quatro criterios ATENDIDO integralmente (4); um PARCIAL (3); dois NAO ATENDIDOS (1 e 2).** Os dois que nao fecharam (FRC-01 e FRC-02) tem a MESMA causa raiz, ja prevista por escrito na propria nota de sequenciamento do `ROADMAP.md` desde antes desta fase comecar: a saturacao em gap grande nao vem da formula de uma luta isolada (o teto assintotico do canal de rating de carta desconta ate 17-33% de poder por luta, substancial), vem do NUMERO DE RESOLUCOES POR PARTIDA. Uma partida resolve dezenas de lutas, e mesmo uma vantagem por luta reduzida em quase um terco ainda compoe para quase certeza no nivel da partida inteira. Isto foi PROVADO por medicao, nao apenas suposto: no teto matematico do canal (`ratingPowerD = 100000`, `docs/diagnostics/28-sweep.md` Bloco 5), ANCORA-30 e ANCORA-40 continuam em 1,0000 exato, e ANCORA-05/10/20 tambem continuam fora de seus respectivos tetos (0,7850 contra 0,66; 0,8883 contra 0,76; 0,9917 contra 0,90, esta ultima a mais proxima de fechar, faltando so 0,0917). **A regiao de fechamento para as 6 ancoras, isoladas neste canal, e VAZIA**, no mesmo sentido de fronteira de MODELO usado pelas Fases 25B e 26: nenhuma medicao adicional dentro do escopo desta fase resolveria. Consertar exige mexer no numero de resolucoes por partida (duracao) ou na formula de luta isolada, ambos fora do escopo autorizado pelo `ROADMAP.md` para a Fase 28.

---

## 2. Veredito da adicao de escopo (zebra, D-03/D-04/D-05), em secao SEPARADA

**Esta feature nao esta entre os 4 criterios do `ROADMAP.md` nem entre FRC-01 a FRC-04.** Ela entrou por pedido explicito do desenvolvedor durante a discussao da fase (`28-CONTEXT.md`), e o desenvolvedor foi avisado do trade-off (orcar a mesma unica regeneracao de golden da fase para cobrir as duas mudancas, em vez de gastar uma regeneracao propria) antes de confirmar.

| item | desfecho | evidencia |
| --- | --- | --- |
| D-03: limiar de zebra derivado (`UPSET_MIN_GAP` ~9,544, produto exato de `RATING_CURVE_D * log10(0,65/0,35)`) e taxonomia `upset_win` nos dois lados obrigatorios (`EventKind`, `EventTypeSchema`) | **ATENDIDO** | `src/sim/upset.test.ts` (23 testes: limiar, `isUpset`, contrato de null, conteudo do evento, determinismo, posicao unica, nao vacuidade do gate), todos verdes |
| D-04: destaque de zebra no HUD de playback (banner `ZEBRA!`, ticker) e na tela de resultado da serie, nos dois niveis (serie inteira e jogo isolado) | **ATENDIDO** | `src/tournament/SeriesResultScreen.test.ts` (8 testes cobrindo os quatro cenarios: favorito venceu; azarao venceu a serie; gap insuficiente; azarao venceu um jogo e perdeu a serie). Verificacao visual do banner e do bloco `ZEBRA DA SERIE` no checkpoint humano da Task 3 deste plano (o desenvolvedor teve a oportunidade de rodar `npm run dev` e simular uma Bo5 de gap grande antes de aprovar a regeneracao) |
| D-05: o evento e avaliado UMA UNICA vez no fim da partida, nunca por win probability momentanea, para nao colidir com a track de inercia da Fase 29 | **ATENDIDO** | `buildUpsetEvent` chamado uma unica vez no fim de `simulateMatch` (`src/sim/engine.ts`), depois do laco de ticks; `timeSec`/`winProbUserAfter` sobrescritos pelo ULTIMO evento da timeline em vez de reler `state` (testado explicitamente mutando `state` depois de capturar o ultimo evento) |

**Custo pago pela adicao de escopo, medido e nao suavizado:** o vocabulario global do corpus do golden sobe de 23 para 25 tipos de evento (Dimensao 2 de `docs/diagnostics/golden-diff-28.txt`), mas a causa medida NAO e `upset_win` (0 ocorrencias em todas as 15 combinacoes fixas do golden, confirmado por duas medicoes independentes). O ganho de `elder_taken` e `quadra_kill` e efeito colateral do proprio `ratingPowerD=525` (plano 28-03), nao da adicao de escopo deste plano. `upset_win` continua sem cobertura no corpus fixo de 15 blocos do golden (nenhuma seed fixa cruza o limiar de zebra com o time mais fraco vencendo), o que e coerente com a previsao registrada em `golden-diff-28.txt` item 1 (o evento nao deveria aparecer em `balanced` nem `close`, e de fato nao apareceu em nenhum dos tres cenarios).

---

## 3. A derivacao de `D`, resumida em cinco linhas

1. **Alvo declarado:** em gap 30, win-rate alvo de 0,875, o ponto medio interpretavel entre o piso 0,80 (tier `dominant` de `scripts/calibrate.ts`) e o teto duro 0,97 (`STACK.md` secao 7), exatamente o exemplo que o proprio criterio 4 do `ROADMAP.md` usa.
2. **A conta:** `D = 30 / log10(0,875/0,125) = 30 / log10(7) = 30 / 0,845098 = 35,4989...`, arredondado para **D = 35,5**.
3. **O bracket de inclinacao aceitavel:** aplicando tolerancia de +-7 pontos percentuais em gap 30 (0,805 e 0,945), o `D` correspondente cai em **[24; 49]**; toda banda da tabela de 6 pontos e imagem deste bracket, nenhum piso ou teto e numero solto.
4. **O ganho de agregacao medido:** `ratingPowerD = 525` (vencedor da grade + refino por menor SSD contra a tabela de 6 pontos, `docs/diagnostics/28-sweep.md` Blocos 2 e 4) dividido por `D = 35,5` da **14,79**: cada decada de razao de poder por PARTIDA corresponde a 14,79 decadas de razao de poder por LUTA individual.
5. **O que liga os dois:** `D = 35,5` e o UNICO parametro declarado e interpretavel (inclinacao da curva de win-rate de PARTIDA); `ratingPowerD = 525` e quantidade DERIVADA, a imagem de `D` no dominio de poder de luta, calibrada por medicao do motor real contra a MESMA tabela de 6 pontos que `D` define, nao escolhida a dedo. Isto fecha a primeira metade do criterio 4.

---

## 4. A prova por diff, as sete verificacoes

Fecha a segunda metade do criterio 4: que nenhuma constante de ruido de luta foi alterada. Saida completa em `docs/diagnostics/28-prova-por-diff.txt` (`node scripts/verify-28-diff.cjs --expect-change`, regravada nesta Task 4 apos a regeneracao unica do golden).

| # | verificacao | desfecho |
| --- | --- | --- |
| 1 | Ruido de luta intacto, byte a byte (linhas de resolucao de `resolveTeamfight`, localizadas por NOME de simbolo) | ATENDIDO |
| 2 | Constantes de ruido intactas (`upsetNoise`, `comebackElasticity`, corpo de `behindBoost`) | ATENDIDO |
| 3 | Contagem de chamadas ao gerador por arquivo de producao de `src/sim/*.ts`, delta zero | ATENDIDO |
| 4 | Inventario dos 15 simbolos novos da fase, presentes em HEAD e ausentes na base | ATENDIDO |
| 5 | Escopo do diff, todos os arquivos classificados nas categorias autorizadas | ATENDIDO (ver nota abaixo) |
| 6 | Regeneracao unica do golden (exatamente 1 commit tocando exatamente 1 arquivo) | ATENDIDO |
| 7 | Ausencia do caractere de travessao nas linhas de codigo acrescentadas | ATENDIDO (ver nota abaixo) |

**VEREDITO: OK**, regra de sanidade por blob confirmada (o blob de `src/sim/power.ts` difere entre base e HEAD, como esperado em `--expect-change`).

**Nota sobre as verificacoes 5 e 7 (achado desta Task 4, deviation Rule 1):** ao rodar o script pela primeira vez apos a regeneracao, as verificacoes 5 e 7 falsearam positivo. A verificacao 5 classificava `src/styles.css` (CSS legitimo da adicao de escopo D-03/D-04, plano 28-04) e `vitest.calibrate.config.ts` (harness com `testTimeout` elevado no plano 28-01 Task 2, ja documentado em `docs/diagnostics/28-ancoragem.md` Bloco 5) como fora das cinco categorias autorizadas, porque a Task 1 so previa `src/playback/`/`src/tournament/` e `scripts/` literalmente. A verificacao 7 contava travessao em duas fontes legitimas nao previstas pela Task 1: a chave do snapshot regenerado do golden, que reproduz nomes de `describe`/`it` de `golden.test.ts` que ja usam travessao desde ANTES desta fase (confirmado no SHA base), e o proprio codigo de `verify-28-diff.cjs`, que precisa definir e casar o caractere literal (`EM_DASH`, `SANCTIONED_EXCEPTION`) para poder detecta-lo. As duas categorizacoes foram corrigidas no proprio script (commit `56a758e`), documentadas com comentario no codigo, e o script voltado a rodar: as sete verificacoes ficam ATENDIDAS sem afrouxar nenhuma regra real (nenhum arquivo fora de escopo genuino, nenhum travessao novo usado como pontuacao de ligacao).

---

## 5. Placar dos sete gates, antes e depois

"Antes" = fim da Fase 27 (`docs/diagnostics/27-relatorio-da-fase.md` secao 3, coluna "hoje"). "Depois" = esta Task 4, apos a regeneracao unica do golden (`npm run calibrate:all` completo).

| gate | antes | depois | fase dona do vermelho |
| --- | --- | --- | --- |
| `calibrate` | vermelho | vermelho | **Fase 28**: as 6 ancoras + `sensibilidade gap10-gap0` (7 bandas de `scripts/calibrate-engine.ts`, substituindo as bandas antigas de 3 tiers que a Task 2 do plano 28-01 aposentou) |
| `calibrate:micro` | vermelho | vermelho | Heranca **sem dono** (D-26-02): Cenario 1, assist-share do support 29,7% contra piso 30%. Nao causado por esta fase, fora do escopo de simbolos que a Fase 28 toca |
| `calibrate:structures` | verde | verde | (nenhum) |
| `calibrate:objectives` | vermelho | vermelho | Heranca **[Fase 19] PROVISORIA**, sem fonte externa (Baron no spawn = 0,270 contra teto 0,240), com recomendacao de forma ja registrada no proprio codigo para a Fase 30. Nao causado por esta fase |
| `calibrate:combat` | verde | verde | (nenhum) |
| `calibrate:pace` | vermelho | vermelho | 18 bandas vermelhas nos dois momentos, MESMA composicao: 1 e da **Fase 28** (`win-rate com gap de forca 30` = 1,000 contra teto 0,970, ja vermelha antes da fase por saturacao pre-existente e continua vermelha depois, regiao VAZIA provada); as 17 restantes sao heranca das Fases 25B, 25C, 26, 27 e 30 (revisao em bloco), todas ja registradas com dono ou sem dono em relatorios anteriores, nenhuma nova |
| `calibrate:assists` | verde | verde | (nenhum) |

**3 de 7 gates verdes, ANTES e DEPOIS. Nenhum gate mudou de cor.** A Fase 28 substituiu o CONTEUDO das bandas vermelhas que ja lhe pertenciam (`calibrate` e a banda de `calibrate:pace`) por medicoes proprias, sem esconder nenhum vermelho atras de outro e sem introduzir vermelho novo em gate que estava verde.

**Placar de `npm test`, antes e depois, comparado com a previsao escrita antes da regeneracao:**

| momento | verdes | vermelhos | total |
| --- | --- | --- | --- |
| placar de partida (fim da Fase 26, `.planning/STATE.md`) | 1119 | 2 (D-26-03) | 1121 |
| imediatamente antes desta Task 4 (`docs/diagnostics/golden-diff-28.txt` item 5, medido apos os planos 28-01 a 28-04) | 1152 | 18 | 1170 |
| **previsao escrita para depois da regeneracao** (mesmo item 5) | 1166 | 4 ou 3 | 1170 |
| **medido nesta Task 4, depois da regeneracao unica** | **1166** | **3** | **1169** |

A previsao acertou os verdes (1166) e o numero de vermelhos caiu dentro do intervalo previsto (3, o item flaky D-28-03-01 nao apareceu nesta rodada). **O total medido (1169) diverge da previsao (1170) por 1 teste, e essa divergencia e registrada e nao apagada** (secao 8, D-28-03-01): o mesmo item flaky que ja alternava de arquivo entre rodadas, sem mudanca de codigo, parece tambem alternar a CONTAGEM total de testes coletados, hipotese nao investigada nesta task por estar fora do escopo de `src/sim/`/`scripts/` que a Fase 28 toca. Os 3 vermelhos finais sao os ja esperados e atribuidos: 2 em `structures.test.ts` (D-26-03, heranca) e 1 em `gold-scale-identity.test.ts` (efeito colateral determinista do plano 28-03, coberto por contrato escrito no proprio cabecalho do teste).

---

## 6. Custo de banda

Para cada banda que esta fase MOVEU (as 6 ancoras + 2 sensibilidades de `calibrate-engine.ts`, e a banda `win-rate com gap de forca 30` de `calibrate-pace.ts`). "Antes" = `ratingPowerD = null` (canal neutro, plano 28-02), "depois" = `ratingPowerD = 525` (plano 28-03, valor ainda em vigor apos a Task 4 desta plano, que nao mudou codigo de motor).

| banda | valor antes | folga antes | valor depois | folga depois | lado apertado |
| --- | --- | --- | --- | --- | --- |
| ANCORA-00 (gap 0, teto 0,56) | 0,5650 | -0,0050 | 0,5650 | -0,0050 | TETO, sem mudanca (identidade matematica em gap 0, delta=0 para qualquer `D`) |
| ANCORA-05 (gap 5, teto 0,66) | 0,8200 | -0,1600 | 0,7983 | -0,1383 | TETO, folga melhorou em 0,0217 |
| ANCORA-10 (gap 10, teto 0,76) | 0,9517 | -0,1917 | 0,9200 | -0,1600 | TETO, folga melhorou em 0,0317 |
| ANCORA-20 (gap 20, teto 0,90) | 1,0000 | -0,1000 | 0,9950 | -0,0950 | TETO, folga melhorou em 0,0050 |
| ANCORA-30 (gap 30, teto 0,97) | 1,0000 | -0,0300 | 1,0000 | -0,0300 | TETO, sem mudanca (regiao VAZIA, provada no teto assintotico) |
| ANCORA-40 (gap 40, teto 0,97) | 1,0000 | -0,0300 | 1,0000 | -0,0300 | TETO, sem mudanca (regiao VAZIA, provada no teto assintotico) |
| sensibilidade gap10-gap0 (piso 0,11, teto 0,27) | 0,3867 | -0,1167 (teto) | 0,3550 | -0,0850 (teto) | TETO, folga melhorou em 0,0317; PISO com folga de +0,245, nunca em risco |
| sensibilidade gap20-gap5 (piso 0,16, teto 0,29) | 0,1800 | +0,0200 (piso) / +0,1100 (teto) | 0,1967 | **+0,0367 (piso)** / +0,0933 (teto) | **PISO**, folga de so 0,0367, o mais apertado das oito bandas |
| `win-rate com gap de forca 30` (calibrate:pace, teto 0,97) | 1,0000 | -0,0300 | 1,0000 | -0,0300 | TETO, sem mudanca (mesma regiao VAZIA) |

**Leitura sem suavizar, o insumo direto para a Fase 29:** das 8 bandas de `calibrate-engine.ts`, a fase melhorou a folga em 5 (ANCORA-05/10/20 e a sensibilidade gap10-gap0, todas ainda vermelhas mas menos apertadas), nao moveu 3 por regiao VAZIA (ANCORA-00 por identidade, ANCORA-30/40 pelo teto assintotico do canal), e a UNICA banda que fecha, `sensibilidade gap20-gap5`, tem a folga MAIS APERTADA de todo o conjunto: apenas 0,0367 contra o piso, e essa folga JA ENCOLHEU em relacao ao estado neutro anterior a esta fase (era +0,0200 com `ratingPowerD=null`, subiu para +0,0367 com `ratingPowerD=525`; o piso em si (0,16) nao mudou, so o valor medido se afastou um pouco dele). **A Fase 29 mexe na win probability e move todas as distribuicoes de novo**; se ela empurrar o agregado de resultados por gap na direcao de achatar mais, esta e a banda com menos espaco de sobra antes de reabrir. R1 e R2 (invariancia de nivel, fechadas pelo plano 28-03 via D-01) nao sao tocadas por esta Task 4 e continuam fechadas: R1 em 0,0170 contra banda +-0,08 (folga 0,063), R2 em -0,0060 contra banda +-0,03 (folga 0,024 no pior ponto das tres amostras).

---

## 7. O que a Fase 29 precisa saber antes de comecar

1. **`winProbUser` realimenta `behindBoost`, que multiplica `fightPower` diretamente**, e portanto interage com o canal novo de rating de carta (`ratingFightMult`). As duas multiplicacoes compoem no mesmo termo de poder de luta; qualquer mudanca na inercia ou no poder preditivo de `winProbUser` muda o INSUMO que `behindBoost` usa, e isso se soma ao efeito de `ratingFightMult`, nao o substitui.
2. **O canal de rating le rating de CARTA** (`teamCardRating`/`rosterRating` em `src/sim/power.ts`) e, por construcao, **NAO achata a curva de win-prob por estado de jogo**: a Fase 29 nao herda flatness dele. `ratingFightMult` e uma funcao pura da diferenca de rating dos dois times no INICIO da partida, nunca do estado corrente do jogo (ouro, torres, vantagem no momento).
3. **O evento de zebra e avaliado uma UNICA vez no fim da partida, nunca por win probability momentanea**, por decisao deliberada (D-05) para nao colidir com a track de inercia que a Fase 29 vai construir. Se a Fase 29 introduzir qualquer leitura de win-prob momentanea que precise saber "isto seria uma zebra se acabasse agora", ela precisa de um mecanismo PROPRIO: `buildUpsetEvent` nao serve para isso por design.
4. **A regiao de fechamento de FRC-01/FRC-02 e VAZIA para o canal isolado de rating de carta**, mas NAO necessariamente para a combinacao de rating + inercia de win-prob que a Fase 29 vai introduzir. A causa raiz documentada (numero de resolucoes por partida, nao a formula de uma luta) sugere que qualquer mecanismo que reduza o numero EFETIVO de lutas decisivas por partida (inercia que suaviza reversoes, por exemplo) pode mover essas bandas na direcao certa como efeito colateral, mesmo sem essa ser a motivacao da Fase 29.
5. **A banda `sensibilidade gap20-gap5` fecha com folga de apenas 0,0367** (secao 6 acima), a mais apertada de toda a fase. Se a Fase 29 achatar a curva de win-prob por estado de jogo, ela nao move esta banda diretamente (que mede win-rate de PARTIDA por gap de RATING, nao win-prob por estado), mas se qualquer mudanca da Fase 29 acabar alterando o AGREGADO de resultados por gap (por exemplo, mudando quantas partidas realmente terminam decididas pela vantagem inicial), a folga de 0,0367 e o numero a vigiar primeiro.

---

## 8. Itens diferidos abertos por esta fase, com dono ou declarados sem dono

Nenhum dono inventado.

| ID | assunto | numero | dono |
| --- | --- | --- | --- |
| FRC-01 aberto | 0 de 6 pontos-ancora dentro da banda; regiao VAZIA para o canal isolado, provada no teto assintotico | 0,5650/0,7983/0,9200/0,9950/1,0000/1,0000 contra tetos 0,56/0,66/0,76/0,90/0,97/0,97 | **SEM DONO**, candidato Fase 30 (revisao em bloco) ou fase que mexa no numero de resolucoes por partida (duracao) |
| FRC-02 aberto | ANCORA-30/40 e `win-rate com gap de forca 30` em 1,0000/1,000 exatos; regiao VAZIA no teto matematico do canal | 1,0000 contra teto 0,970 nos tres pontos | **SEM DONO**, mesma causa raiz de FRC-01 |
| FRC-03 parcial | `gap10 menos gap0` estoura o teto por 0,085 (piso literal do criterio atendido com folga de 0,245) | 0,3550 contra teto 0,27 | **SEM DONO**, candidato Fase 30; nao e o modo de falha que o criterio teme (achatar demais) |
| D-28-03-01 (herdado) | flakiness de suite em `npm test`: um slot de falha alterna entre `scripts/diff-golden.test.ts` e `src/sim/buffs.test.ts` sem mudanca de codigo entre rodadas; nesta Task 4 o slot NAO apareceu como falha, e o total de testes medido (1169) ficou 1 abaixo da previsao escrita antes da regeneracao (1170), divergencia registrada e nao investigada (mesma familia de causa, hipotese de dependencia de ordem/tempo do pool de workers do vitest) | 1166 verdes, 3 vermelhos, 1169 total medidos; previsao era 1166/4-ou-3/1170 | **SEM DONO**, candidato Fase 30 ou fase de infraestrutura de teste |
| src/sim/runMatch.ts | simulador legado que sustenta o gate nomeado pelo criterio 2 do `ROADMAP.md` mas nao esta no caminho de producao (achado do Bloco 4 de `28-ancoragem.md`, confirmado nesta fase) | os 3 tiers legados de `scripts/calibrate.ts` continuam PASS mas sao cegos a qualquer mudanca em `power.ts` | candidato **Fase 30** (revisao em bloco), ja registrado antes desta fase |
| R3 de `scripts/calibrate-pace.ts` | tolerancia provisoria de invariancia de nivel de DURACAO, nao recalibrada por nenhum plano desta fase (fora do mandato de FRC-01..04) | `provisional: true` mantido, comentario explicando o motivo | dono **Fase 25**, ja registrado antes desta fase |
| `calibrate:micro` Cenario 1 | assist-share do support 29,7% contra piso 30% (D-26-02) | falta 0,3 pontos percentuais | **SEM DONO**, candidato Fase 30, heranca nao causada por esta fase |
| `calibrate:objectives` | Baron no spawn 0,270 contra teto 0,240 ([Fase 19] PROVISORIA, sem fonte externa) | falta 0,030 | **SEM DONO** com recomendacao de forma ja registrada no proprio codigo, candidato Fase 30, heranca nao causada por esta fase |

---

*Relatorio completo: oito secoes preenchidas pela Task 4 do plano 28-05. Prova por diff da fase inteira em `docs/diagnostics/28-prova-por-diff.txt`, regravada nesta task apos a regeneracao unica do golden e a correcao dos dois falsos positivos do proprio verificador (commit `56a758e`). Aceite humano final pendente na Task 5 deste plano (checkpoint bloqueante) - este relatorio nao fecha a fase por si so.*
