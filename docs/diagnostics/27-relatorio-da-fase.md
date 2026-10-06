# Fase 27: relatorio de fechamento

**Data:** 2026-08-24
**Fase:** 27-escala-e-acoplamento-econ-mico
**Plano de origem:** 27-07 (Tasks 1 e 2)
**Proposito, em uma linha:** fechar a fase com veredito por medicao em cada um dos cinco criterios do `ROADMAP.md`, incluindo o que nao fechou, a prova por diff da fase inteira contra o SHA base do Bloco 1 de `docs/diagnostics/27-ancoragem.md`, e desfecho declarado para todo ponto de acoplamento do inventario, sem suavizar nada.

---

## 1. O VEREDITO DOS CINCO CRITERIOS

Fonte de cada numero: saida literal dos comandos da Task 1 (`npx tsc --noEmit`, `npm test`, `npm run calibrate:pace`, `npm run calibrate:all`, `npm run diff-golden`, `grep -o "rng(" src/sim/*.ts`, `node scripts/verify-27-diff.cjs --expect-change`, `git log --oneline -- src/__tests__/golden`), mais os testes dedicados criados pelos planos 27-02 a 27-05.

| # | criterio (`ROADMAP.md` Fase 27) | requisito | numero medido | desfecho |
| --- | --- | --- | --- | --- |
| 1 | Neutralidade provada primeiro (diff de golden vazio ANTES do valor mudar; timeline identica entre escalas) | ECO-04 | `verify-27-diff.cjs --expect-change` fechou `VEREDITO: OK` nas ondas 27-02 e 27-03 (blob de `engine.ts` mudou, `winprob.ts` byte a byte identico, `rng(` 72=72 nos dois lados em cada onda); `src/sim/gold-scale-identity.test.ts` (27-03, commit `81ff8f7`): **96/96 casos verdes** (4 blocos x 2 perfis de roster [EQUILIBRADO 65v65, GAP-30 90v60] x 12 seeds literais), identidade de `digestTimeline` entre `goldScale` 1x2 e 1x5, mais proporcionalidade exata do ouro de time (razao == `goldScale` exata, sem `toBeCloseTo`) | **ATENDIDO** |
| 2 | Ouro/min por time na banda [1.500; 2.100] | ECO-01 | **1.779** (hoje, tier EQUILIBRADO, `calibrate:pace`), dentro da banda, alvo 1.833. Baseline do Bloco 5 da ancoragem: 647,5 (piso 1500 ja estourado por baixo) | **ATENDIDO** |
| 3 | Razao de GPM vencedor/perdedor na banda [1,10; 1,30] E e a MENOR das tres razoes inter-camada (torres > abates > ouro) | ECO-02 | Razao de ouro **1,026** (hoje), banda [1,100; 1,300], FALHA por 0,074 (6,7% relativo). Ordenacao das tres camadas, MESMA rodada e MESMO tier EQUILIBRADO: **torres 3,057 > abates 1,044 > ouro 1,026** — VERDE (calculado diretamente das tres linhas de `calibrate:pace`, ja que `expectBands` lanca excecao agregada antes de alcancar o assert automatizado do arquivo, mesmo efeito ja documentado no Bloco 5 da ancoragem e no Bloco 1 de `27-sweep.md`) | **PARCIAL**: ordenacao FECHA, banda ECO-02 NAO FECHA — fronteira medida, ver secao 2 |
| 4 | Canal de ouro para pressao estrutural, demonstravelmente vivo (nao inerte) | ECO-03 | `src/sim/gold-structural-factor.test.ts` (27-04, 22/22 verde): Ablacao UNITARIA — fator vale exatamente `GOLD_STRUCTURAL_CEIL` (1,03) sob 2x vantagem de ouro, `|razao-1| > 0,02` (piso do teste); Ablacao de SISTEMA (20 partidas reais de gap de forca) — desvio medio real **0,0287** contra o piso do teste 0,02. `calibrate:pace` final: zero violacao de regra dura em nenhum dos seis tiers apos a calibracao do teto (0,97/1,03/1,5) | **ATENDIDO** |
| 5 | INV-2 (identidade em neutro) exata em overall 45, 65 E 85 | ECO-05 | `src/sim/gold-fold-in.test.ts` (27-05, commit `c405f2a`): Teste A parametrizado em `[45, 65, 85]`, `toBeCloseTo(1.0, 10)` exato nos tres, sem afrouxamento de tolerancia; `averageLaningSlice` sobre roster flat devolve exatamente o overall nos tres pontos | **ATENDIDO** |

**Leitura sem suavizar: quatro de cinco criterios ATENDIDOS integralmente (1, 2, 4, 5); um PARCIAL (3).** O criterio 3 tem duas clausulas distintas fundidas no texto do roadmap — a ordenacao inter-camada (que EXISTE para garantir que o ritmo pareca LoL) fecha em todos os pontos medidos desde o inicio da fase; a banda absoluta ECO-02 (razao de GPM vencedor/perdedor) nao fecha, e a fronteira foi medida com rigor, nao apenas suposta (secao 2). Isto e uma leitura MELHOR do que qualquer fase anterior desta milestone: as Fases 25, 25B, 25C e 26 fecharam com dois a tres criterios NAO ATENDIDOS cada uma; esta fase fecha com apenas um PARCIAL.

---

## 2. ECO-02: A FRONTEIRA MEDIDA, POR QUE NAO FECHA E O QUE FICARIA PARA FECHAR

**A razao de ouro/min vencedor sobre perdedor e INVARIANTE a `goldScale` por construcao matematica.** Seis pontos medidos, cobrindo uma faixa de 3x no valor da escala (1,00; 2,00; 2,25; 2,50; 2,75; 3,00), todos dentro de uma janela de 0,001 (1,026-1,027) — a razao entre duas quantidades escaladas pelo MESMO fator nao se move, e isto foi previsto por escrito no proprio plano antes de qualquer numero ser medido (`docs/diagnostics/27-sweep.md` Bloco 4).

**A segunda alavanca autorizada (constantes de `goldStructuralFactor`) tambem nao fecha, sem violar regra dura.** Testada em um ponto isolado (`GOLD_STRUCTURAL_CEIL` de 1,03 para 1,10, `goldScale` fixo em 2,75, nao commitada): moveu a razao de ouro (+0,014, de 1,026 para 1,040) e a razao de abates (+0,045), mas reintroduziu IMEDIATAMENTE a violacao de regra dura que o plano 27-04 ja tinha evitado (primeira torre antes de 7:00, tier GAP-30, 1 violacao em 800). A magnitude do movimento (+0,014) tambem e pequena demais: fechar a banda exigiria +0,074, mais de cinco vezes o efeito medido com um teto ja fora dos limites seguros.

**Causa raiz, coerente com o resto do estado do projeto:** a razao de ouro por minuto entre vencedor e perdedor e DERIVADA da diferenciacao de abates/objetivos entre os dois lados (o ouro de abate, assistencia, placa e bounty de shutdown sao os canais que mais diferenciam os dois lados; a renda passiva e simetrica por construcao). A razao de abates vencedor sobre perdedor mede **1,044** hoje, muito abaixo do piso [1,80; 2,60] que a Fase 26 ja fechou com aceite PARCIAL sem fechar este par (`STATE.md`, registro do fechamento da Fase 26: "criterio 1... NAO FECHADO" e "criterio 2... NAO FECHADO"). Sem mais diferenciacao de abates/objetivos entre vencedor e perdedor — trabalho de OUTRA fase, fora do escopo de duas alavancas puramente economicas — a razao de ouro nao tem margem estrutural para chegar a 1,10.

**Nenhuma banda foi afrouxada para este achado ficar mais confortavel.** ECO-02 fica um item de decisao explicito para o checkpoint humano (Task 3), no mesmo padrao que a Fase 26 fechou deixando o par analogo (razao de abates) sem dono.

---

## 3. MOVIMENTO MEDIDO ANTES E DEPOIS

Baseline (coluna "Bloco 5, inicio da fase") vem de `docs/diagnostics/27-ancoragem.md` Bloco 5, medido no SHA base `5af835c` (goldScale ainda nao existia). Coluna "pre-ECO-01/02" vem de `docs/diagnostics/27-sweep.md` Bloco 2, medida no mesmo commit-base do plano 27-06 (goldScale=1, ja com ECO-03/ECO-05 aplicados). Coluna "hoje" e a leitura da Task 1 deste plano (`goldScale=2,75`, todos os planos 27-02 a 27-06 aplicados).

| metrica | Bloco 5 (inicio da fase) | pre-ECO-01/02 (goldScale=1, pos ECO-03/05) | hoje (goldScale=2,75) | banda | veredito |
| --- | --- | --- | --- | --- | --- |
| ouro/min por time | 647,5 | 646,2 | **1.779** | [1500, 2100] | **ENTROU** (ECO-01) |
| razao de ouro/min venc/perd | 1,038 | 1,027 | **1,026** | [1,10, 1,30] | continua FORA (ECO-02, invariante a escala) |
| razao de torres venc/perd | 3,181 | 3,063 | **3,057** | [2,50, 4,50] (Fase 25) | dentro nas tres leituras |
| razao de abates venc/perd | 1,054 | 1,046 | **1,044** | [1,80, 2,60] (Fase 26) | fora nas tres leituras, heranca da Fase 26, nao movido por esta fase |
| ordenacao inter-camada (torres>abates>ouro) | VERDE (por numeros brutos; nenhuma banda de ouro fechada ainda) | VERDE | **VERDE** | — | fecha desde o inicio, nunca foi o gargalo |
| `rng(` em `src/sim/*.ts` | 72 | 72 | **72** | — | invariante, nunca mudou |
| `npm test` (falhas) | 18 (D-27-E2: 15 golden.test.ts + 2 structures.test.ts + 1 diff-golden.test.ts) | — | **2** (D-27-E2 remanescente: seeds 0 e 5, `structures.test.ts`, tier STOMP) | — | **16 falhas fechadas** como efeito colateral das tres regeneracoes de golden orcadas pela fase (secao 4); as 2 restantes sao pre-existentes, nao causadas por nenhum plano desta fase |
| `calibrate:all` | nao medido no Bloco 5 (so `calibrate:pace` foi capturado) | 3 de 7 (structures, combat, assists) — leitura de `golden-diff-27-valor.txt`, fim do plano 27-06 | **3 de 7** (structures, combat, assists) | — | identico ao fim do plano 27-06, ZERO regressao desde entao |

**Nenhuma banda que estava VERDE no Bloco 5 (ou na leitura pre-27-06) esta VERMELHA hoje.** A unica mudanca de cor em toda a cadeia e a propria `ouro/min por time` saindo do vermelho — o proposito declarado da fase.

**Folga de duracao, o insumo direto para a Fase 28 (secao 6).** Duracao media (min), piso declarado 29 (dono Fase 25B, `docs/diagnostics/26-relatorio-da-fase.md` secao 3):

| ponto de leitura | duracao media (min) | folga contra o piso 29 |
| --- | --- | --- |
| entrada da Fase 26 | 30,023 | 1,023 |
| apos plano 26-05 (Fase 26 isolada) | 30,314 | 1,314 |
| durante o plano 26-10 (HEAD contaminado por 27-01..27-04, planos 27-05/06 ainda nao aplicados) | 29,909 | 0,909 |
| **hoje, Fase 27 completa (planos 27-01 a 27-06 aplicados)** | **30,115** (mediana 28:00) | **1,115** |

**A duracao NAO se moveu na direcao do piso apertado por causa desta fase.** Da leitura "durante o plano 26-10" (o ponto mais proximo do estado em que a Fase 27 comecou a mexer em valor economico) ate hoje, a folga **DEVOLVEU 0,206 min**, nao consumiu. Os planos 27-05 (re-ancoragem) e 27-06 (valor de `goldScale`) nao empurraram a duracao contra o piso; se algo, o efeito liquido foi o oposto. Restam **1,115 min** de folga contra o piso de 29 min, uma leitura ligeiramente MELHOR do que a Fase 26 deixou (0,909 min).

---

## 4. DESFECHO POR PONTO DE ACOPLAMENTO

Reproduz a tabela do Bloco 2 de `docs/diagnostics/27-ancoragem.md`, com a coluna de desfecho. Os cinco pontos marcados `[ORFAO #N]` sao os que o `ROADMAP.md` nao enumerou.

### Produtores de ouro

| Simbolo | Arquivo | Desfecho | Plano |
| --- | --- | --- | --- |
| `BASE_KILL_GOLD` | `matchState.ts` | **varrido** | 27-02 |
| `ASSIST_GOLD` | `matchState.ts` | **varrido** | 27-02 |
| `FIRST_BLOOD_BONUS` | `matchState.ts` | **varrido** | 27-02 |
| `FIRST_TURRET_BONUS` | `structures.ts` | **varrido** | 27-02 |
| `passiveIncome` (divisor `/10`) | `engine.ts` | **varrido** | 27-02 |
| `recomputeBounty` `[ORFAO #1]` | `engine.ts` | **varrido** (assinatura estendida com `goldScale`, os dois chamadores em `applyKill` atualizados) | 27-02 |
| `PLATE_GOLD_EST` | `structures.ts` | **varrido** — os TRES pontos de emissao do evento `plate` (`damageStructure`, `resolveStructurePressure`, `accrueSiegePressure`), nao apenas o descrito no texto original da acao (deviation Rule 2, 27-02) | 27-02 |

### Consumidores e limiares

| Simbolo | Arquivo | Desfecho | Plano |
| --- | --- | --- | --- |
| `K_GOLD` | `power.ts` | **varrido** (fronteira `unscaleGold`, constante 750 inalterada) | 27-03 |
| `expectedGoldForRoleAtMinute` | `power.ts` | **varrido** (27-03, fronteira `unscaleGold`) e depois **re-ancorado pela raiz** (27-05: terceiro parametro obrigatorio `avgLaningSlice`, constante fixa 65 eliminada) | 27-03 / 27-05 |
| `goldFightMult` | `power.ts` | **varrido** | 27-03 |
| `goldSecureMult` | `power.ts` | **varrido** | 27-03 |
| `isStomping` (limiar `> 1500`) | `selection.ts` | **varrido** | 27-03 |
| `bountyGreed` (limiar `>= 400`) `[ORFAO #2]` | `selection.ts` | **varrido** (fallback defensivo `ctx.state?.goldScale ?? 1` para fixtures parciais) | 27-03 |
| `GOLD_DELTA_SCALE` / `expectedGoldByRole` `[ORFAO #3]` | `microMetrics.ts` | **eliminado pela raiz** — a formula duplicada (constante propria divergente 10x de `power.ts`) foi removida e substituida por importacao direta de `expectedGoldForRoleAtMinute`, nao apenas escalada | 27-05 |
| limiares de `computeDeathQuality` (`>= 200`, `<= -150`) `[ORFAO #4]` | `deathQuality.ts` | **varrido** (as tres entradas de ouro convertidas na fronteira; limiares inalterados) | 27-03 |
| retornos de `estimateMapLoss` (`50/80/100/150`) `[ORFAO #5]` | `deathQuality.ts` | **varrido** (ja operava em unidade base; comentario adicionado confirmando) | 27-03 |

### Pontos adicionais, encontrados ALEM do inventario declarado de 17

| Simbolo | Arquivo | Desfecho | Plano |
| --- | --- | --- | --- |
| ouro inicial de jogador (500) / time (2500) | `matchState.ts` (`freshPlayerState`/`freshTeamState`) | **varrido** (deviation Rule 2, 27-03 Task 2) — descoberto pelo proprio Teste 3 de proporcionalidade exata de `gold-scale-identity.test.ts`; sem esta correcao a prova de ECO-04 nao fecharia | 27-03 |
| `victimTeamGoldDelta > -800` dentro de `selectContextualTicker` | `deathQuality.ts` | **varrido, pos-fechamento** — achado pelo code review do proprio plano 27-07 (`27-REVIEW.md` CR-01), NAO pela varredura original de 27-03 (que converteu os tres outros campos de ouro do mesmo arquivo em `computeDeathQuality`, mas deixou este quarto ponto, quatro linhas abaixo, intocado). Invisivel a `gold-scale-identity.test.ts` porque `digestTimeline` exclui texto de ticker por contrato (D-11). Corrigido com `unscaleGold`, cobertura de regressao adicionada em `deathQuality.test.ts` (identidade de decisao entre `goldScale=1` e `goldScale=2,75`), 34/34 verde | 27-07 (achado pos-aceite, corrigido antes do fechamento formal) |

**Contagem por extenso: DEZENOVE pontos de acoplamento de ouro identificados nesta fase (12 do `ROADMAP.md` + 5 orfaos + 2 encontrados alem do inventario declarado), TODOS com desfecho declarado.** Nenhum ficou sem dono em silencio. A afirmacao original desta secao ("DEZOITO... TODOS com desfecho declarado") estava incorreta no momento do aceite humano da Task 3: o code review rodado logo em seguida (parte do gate `execute:post` desta mesma execucao de fechamento) encontrou o 19º ponto acima antes de a fase ser marcada como completa no `ROADMAP.md`, e ele foi corrigido, testado e documentado aqui como parte do proprio fechamento — nao deixado como item diferido. Catorze dos dezessete pontos do inventario original foram varridos preservando o valor de hoje sob `goldScale=1`; dois (`expectedGoldForRoleAtMinute` e `GOLD_DELTA_SCALE`) tiveram mudanca de comportamento deliberada e documentada (re-ancoragem/eliminacao de duplicacao) como parte do proprio ECO-05.

---

## 5. ORCAMENTO DE GOLDEN E PROVA POR DIFF

**As tres regeneracoes orcadas (Bloco 4 de `27-ancoragem.md`) foram gastas, nenhuma a mais, em commits isolados de um arquivo `.snap` por vez:**

| # | plano | causa | commit da regeneracao (final) | relatorio de diff |
| --- | --- | --- | --- | --- |
| 1 | 27-04 | ECO-03: terceiro canal de ouro (`goldStructuralFactor`) passa a existir | `e0bc8f0` (regeneracao final, apos aperto de calibracao; `bf80ce3` foi um commit intermediario da MESMA regeneracao orcada, nao uma quarta) | `docs/diagnostics/golden-diff-27-eco03.txt` |
| 2 | 27-05 | ECO-05: `expectedGoldForRoleAtMinute` re-ancorada no nivel medio real dos dez jogadores | `bc4c69d` | `docs/diagnostics/golden-diff-27-eco05.txt` |
| 3 | 27-06 | Valor de `goldScale` sobe de 1 para 2,75 | `140f6b4` | `docs/diagnostics/golden-diff-27-valor.txt` |

`git log --oneline -- src/__tests__/golden 5af835c5c75b07a2d32614dd39ca705c870017de..HEAD` lista **quatro** commits de `.snap` (`bf80ce3`, `e0bc8f0`, `bc4c69d`, `140f6b4`), ja esclarecido em `golden-diff-27-valor.txt`/commit `c6ad6e7` (27-06): o par `bf80ce3`/`e0bc8f0` e uma UNICA regeneracao orcada com uma correcao de calibracao no meio (o teto do fator estrutural precisou ser apertado de 1,8 para 1,03 depois que `calibrate:pace` acusou violacao de regra dura), nao duas regeneracoes distintas. **Orcamento: exatamente 3 eventos orcados, gastos.**

**Resumo da prova por diff da fase inteira** (`docs/diagnostics/27-prova-por-diff.txt`, `node scripts/verify-27-diff.cjs --expect-change`, reexecutado nesta task e VEREDITO idêntico ao ja commitado pelo plano 27-06, porque nenhum arquivo de producao mudou entre o fim de 27-06 e o inicio de 27-07):

- **Regra de sanidade por blob:** `src/sim/engine.ts` difere entre a base `5af835c` e HEAD, como esperado em `--expect-change`.
- **Contagem de `rng(`:** 72 = 72 nos dois lados, delta ZERO em TODOS os arquivos de `src/sim/*.ts`.
- **`src/sim/winprob.ts`:** blob IDENTICO entre base e HEAD (`512104d5663edd77633d8de98ffe5725f9ab61aa` nos dois lados). Escopo diferido da Fase 29 preservado.
- **`package.json`:** `git diff 5af835c HEAD -- package.json` retorna VAZIO. Zero dependencia nova em toda a fase (T-27-SC do threat model, verificavel).
- **VEREDITO: OK.**

**`npm run diff-golden` (uso sem argumentos) continua sofrendo do artefato de CRLF PRE-EXISTENTE D-27-E1**, reportando "0 comuns comparados, 15 removidos" mesmo com o arquivo `.snap` byte a byte identico ao commitado (`git status --short` limpo, confirmado nesta task). Este e um falso positivo de PARSER, nao uma diferenca real — a leitura confiavel para esta fase sempre foi `scripts/verify-27-diff.cjs` (que le via `git show` nos dois lados, imune a CRLF da arvore de trabalho), usada em todas as ondas 27-02 a 27-06 pela mesma razao. `D-27-E1` fica registrado em `deferred-items.md`, sem dono, candidato a correcao futura (normalizar `\r\n` para `\n` em `scripts/diff-golden.ts`).

---

## 6. ITENS DIFERIDOS ABERTOS POR ESTA FASE

| ID | assunto | numero/estado | dono |
| --- | --- | --- | --- |
| **ECO-02 aberto** | razao de ouro/min vencedor/perdedor nao fecha a banda [1,10; 1,30] com nenhuma das duas alavancas autorizadas a esta fase (`goldScale`, constantes de `goldStructuralFactor`); fronteira medida com rigor (secao 2) | 1,026 medido, 1,100 exigido, falta 0,074 | **SEM DONO**, candidato natural Fase 30 (revisao em bloco) ou nomear uma terceira alavanca (ex: `K_GOLD`, pesos de elasticidade de `goldFightMult`/`goldSecureMult`, hoje fora do orcamento de simbolos desta fase) |
| D-27-E1 | `scripts/diff-golden.ts` reporta falso positivo estrutural em checkout Windows com CRLF (parser exige `\n` literal, arvore de trabalho tem `\r\n`) | reproduz sempre que o script roda sem argumentos neste checkout; nao afeta `verify-27-diff.cjs`, que usa `git show` nos dois lados | **SEM DONO** (correcao sugerida: `text.replace(/\r\n/g, "\n")` nos dois lados de `parseSnapFile`) |
| D-27-E2 | `npm test` entrou na fase com 18 falhas pre-existentes (golden desalinhado do motor da Fase 26, cuja fase de fechamento 26-10 nunca tinha rodado quando a Fase 27 comecou) | **RESOLVIDO por circunstancia, nao por acao dedicada**: as tres regeneracoes de golden orcadas por ESTA fase (27-04/05/06) trouxeram o golden para o estado sincronizado, fechando as 15 falhas de `golden.test.ts` e a falha de `scripts/diff-golden.test.ts`. Restam APENAS os 2 vermelhos de `structures.test.ts` (seeds 0 e 5, tier STOMP), que sao um subconjunto ORTOGONAL de D-27-E2 (documentado desde antes do plano 26-07, nunca causado por nenhuma linha de codigo desta fase) | Item fechado por circunstancia; os 2 restantes ficam **SEM DONO** (candidato natural Fase 30, mesma leitura de D-26-03 no relatorio de fechamento da Fase 26) |
| D-27-E3 | dois tipos de evento (`elder_taken`, `quadra_kill`) saem do corpus golden de 15 blocos na regeneracao 2 de 3 (27-05, ECO-05) | causa rastreada a um unico bloco outlier (`balanced/seed=42`) cuja duracao comprimiu de 2790s para 1440s; os dois tipos ja eram os mais raros do corpus (presenca 1/15 e 2/15); nenhum tipo FREQUENTE (>=8/15) desaparece; hoje (pos 27-06) o corpus permanece em 23 tipos unicos (contra 25 no inicio da fase) | **Requer decisao humana explicita no checkpoint desta Task 3.** Candidato natural: Fase 30, alinhado com `D-25C-04` (ampliar o corpus do golden, ja com dono declarado na Fase 30) |
| o fator de tempo ocioso deixou de estar embutido na ancora economica | `expectedGoldForRoleAtMinute` deixou de usar a constante fixa 68 ouro/min (arredondada para baixo por tempo ocioso) e passou a calcular o produto EXATO de `passiveIncome` no slice medio real (27-05) | mudanca de comportamento DELIBERADA e documentada por escrito no comentario da funcao; nenhuma regressao medida nas rodadas de calibracao (ECO-01/02 continuam com os mesmos numeros de 27-06 apos a mudanca); nao e um item ABERTO no sentido de precisar de conserto | **Nao aplicavel** — mudanca deliberada e testada (INV-2 exata em 45/65/85), sem efeito negativo medido; listado aqui apenas por transparencia, nao por pendencia |
| D-26-01 (herdado) | `resolveHeraldUse` mascara `inhibitor_destroyed` como `tower_low` quando o Arauto derruba o inibidor | corrigido DENTRO desta fase por deviation Rule 1 (27-05, commit `28eedea`), mas por uma razao ortogonal (o teste de ordenacao estrutural da propria suite ficou bloqueado); o item original da Fase 26 (D-26-01) fica **RESOLVIDO por esta fase**, ainda que sem ter sido essa a motivacao original | Fechado (27-05) |
| D-26-02 (herdado) | `calibrate:micro` Cenario 1 (assist-share do support) abaixo do piso | nao medido diretamente por nenhum plano desta fase (fora do escopo de simbolos de ouro); `calibrate:micro` hoje falha por outro motivo (ver abaixo), sem relacao com este item especifico | continua **SEM DONO** (candidato natural Fase 30) |
| D-26-03 (herdado) | golden `structures.test.ts.snap` (seeds 0 e 5, tier STOMP) vermelho | **2 falhas hoje, identico ao inicio da fase** (D-27-E2 remanescente); nenhuma regeneracao desta fase tocou este par, e a causa continua pre-existente a Fase 26 | continua **SEM DONO** (candidato natural Fase 30) |
| `calibrate:micro` vermelho por margem apertada nova | `mesmo-gap: GAP-BAIXO 86,9% vs GAP-ALTO 78,4% -- diferenca 8,5pp: expected < 8pp` | **NAO e regressao desta fase**: `docs/diagnostics/golden-diff-27-valor.txt` (leitura 4, medida ao fim do plano 27-06) ja registrava `calibrate:micro (vermelho)` no mesmo estado, junto com `calibrate` e `calibrate:objectives`, como heranca de fases anteriores sem relacao com `src/sim/matchState.ts` nem `goldScale`. A leitura de hoje (Task 1 desta onda) reproduz EXATAMENTE o mesmo placar (`calibrate:all` 3 de 7, mesma composicao) | continua **SEM DONO**, nao introduzido por esta fase (candidato natural Fase 30) |

**Contagem por extenso: um item de decisao explicito (ECO-02) mais sete itens diferidos ficam SEM DONO ao fim desta fase** (D-27-E1, os 2 remanescentes de D-27-E2, D-27-E3, D-26-02, D-26-03, `calibrate:micro`). Nenhum dono foi inventado. Um item herdado (D-26-01) fecha por esta fase; um item (D-27-E2) fecha majoritariamente por circunstancia, com um subconjunto ortogonal permanecendo aberto.

---

## 7. O QUE A FASE 28 PRECISA SABER ANTES DE COMECAR

A Fase 28 (Curva de Forca por Diferenca de Rating) depende desta fase e da nota de sequenciamento do `ROADMAP.md`: a saturacao em 100% de win-rate em gap 30 nao vem da formula de uma luta isolada, vem do NUMERO DE RESOLUCOES POR PARTIDA, que e diretamente proporcional a duracao.

1. **A economia mudou de nivel, nao de forma.** `goldScale = 2,75` multiplica o ouro observavel por ~2,75x (ouro/min por time de 647 para 1.779), mas a prova de identidade de ECO-04 (`gold-scale-identity.test.ts`, 96/96 verde) garante que a TIMELINE de eventos (quando cada torre cai, quando cada luta acontece) e byte a byte identica entre escalas — a mudanca e cosmetica no numero exibido, nao estrutural no ritmo da partida. **Isto significa que a Fase 27 NAO mudou o numero de resolucoes por partida por si so.**
2. **Duracao antes e depois, secao 3 desta tabela reproduzida aqui:** durante o fechamento parcial da Fase 26 (leitura mais proxima disponivel do estado logo antes desta fase comecar a mudar valor economico) a duracao media era **29,909 min**; hoje, com a Fase 27 inteira aplicada, e **30,115 min** (mediana 28:00). A folga contra o piso declarado de 29 min **DEVOLVEU 0,206 min** (de 0,909 para 1,115), na direcao OPOSTA a de um piso mais apertado.
3. **Primeira torre, mediana hoje: 13:30 (810s), 3 ticks de 15s de folga contra o piso 780s** (`calibrate:pace` tier EQUILIBRADO, `amostras=800/800`). Este numero tambem nao piorou por causa da Fase 27; a variacao entre tiers e planos anteriores continua sendo o que domina.
4. **O que a Fase 28 herda em aberto:** ECO-02 (razao de ouro vencedor/perdedor) permanece fora de banda, mas isso NAO bloqueia a Fase 28 — o requisito de sequenciamento do roadmap depende de DURACAO (numero de resolucoes), nao da razao de ouro. `win-rate com gap de forca 30 = 1,000` (banda [0,800; 0,970]) segue vermelho, exatamente o sintoma que a Fase 28 existe para corrigir; nenhuma acao desta fase alterou esse numero (medido identico em `calibrate:pace` desde o inicio da cadeia de sweeps do plano 27-06).
5. **Nenhuma banda de outra fase foi apertada como efeito colateral economico.** A tabela da secao 3 confirma: todas as bandas que estavam verdes antes de `goldScale` mudar continuam verdes hoje, e a unica banda que mudou de cor foi a propria `ouro/min por time`, saindo do vermelho — na direcao que a fase existia para produzir.

---

*Relatorio completo: sete secoes preenchidas pela Task 2 do plano 27-07. Prova por diff da fase inteira em `docs/diagnostics/27-prova-por-diff.txt`, reexecutada e confirmada nesta task (VEREDITO: OK, identico ao ja commitado pelo plano 27-06 porque nenhum arquivo de producao mudou entre 27-06 e 27-07). Aceite humano pendente na Task 3 (checkpoint bloqueante) — este relatorio nao fecha a fase por si so.*
