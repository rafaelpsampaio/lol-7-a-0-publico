# Fase 27: ancoragem e instrumento antes do motor

**Data:** 2026-08-20
**Fase:** 27-escala-e-acoplamento-econ-mico
**Plano de origem:** 27-01 (Task 1)
**Proposito, em uma linha:** gravar o SHA base da fase em arquivo versionado, no primeiro commit dela, o inventario completo de acoplamento de ouro por simbolo, a disciplina de exatidao da escala, o orcamento de golden e o baseline economico medido, ANTES de qualquer linha de `src/sim/` mudar.

**Instrumento antes de motor, mais uma vez nesta milestone.** A Fase 23 construiu o gate antes de qualquer conserto, o plano 24-01 construiu o gate de assistencia antes da correcao do 24-02, o plano 25-01 tirou o retrato PRE antes de o canal absoluto existir, o plano 25B-01 mediu a ancoragem de dispersao antes das tres ondas de motor, e o plano 25C-01 gravou a definicao do instrumento de acoplamento antes do primeiro numero novo. A armadilha ja disparou nesta milestone (STATE.md, registro da onda 1 da Fase 25C): deduzir o commit base pelo assunto do commit mais recente devolveu o proprio HEAD, e a prova por diff de uma fase anterior teria passado VAZIA comparando a arvore com ela mesma, se a base tivesse sido deduzida em vez de gravada. Este documento existe para tornar isso impossivel na Fase 27.

---

## Bloco 1: SHA base da fase

| o que | SHA | como foi obtido |
| --- | --- | --- |
| **commit base da Fase 27** | `5af835c5c75b07a2d32614dd39ca705c870017de` (`5af835c`) | `git rev-parse HEAD`, executado no Task 1 do plano 27-01, ANTES de qualquer edicao de codigo desta fase. Assunto do commit no topo da arvore nesse instante: `docs(27): create phase plan` |

**Contrato para os planos seguintes desta fase:** os planos 27-02 a 27-07 leem o SHA acima **deste arquivo** e NUNCA o deduzem por assunto de commit, por `git log`, nem por qualquer outra heuristica. `scripts/verify-27-diff.cjs` (Task 2 desta onda) e o consumidor principal desta linha.

### Hashes de blob dos seis arquivos de motor no escopo da fase

Obtidos com `git rev-parse HEAD:<arquivo>`, no mesmo instante da leitura de `HEAD` acima, ANTES de qualquer edicao:

| arquivo | blob no commit base `5af835c` |
| --- | --- |
| `src/sim/matchState.ts` | `479dc01cba988871f179bfee947b3708476f6f04` |
| `src/sim/engine.ts` | `6f5d3f9e7a9b681a8b68afff575ba6eba5adecae` |
| `src/sim/structures.ts` | `8209a2d81abc06dd4dee17eb973cd1d8698f0aa2` |
| `src/sim/power.ts` | `5c3565fc642ebb0152121e2a133eb9fc869b71ef` |
| `src/sim/selection.ts` | `085a6c8c356793fdd3529b71d7ce7bcd9935c3d0` |
| `src/sim/microMetrics.ts` | `7331c3fc128f499b33c7e479d9b127c674c8246a` |

### Regra de sanidade por blob, escrita como instrucao executavel para as ondas seguintes

`scripts/verify-27-diff.cjs` le o SHA acima e, **antes de qualquer outra comparacao**, confere:

```
blob de src/sim/engine.ts em 5af835c   !=   blob de src/sim/engine.ts em HEAD (quando --expect-change)
```

Se os dois forem **iguais** e o script estiver rodando em modo `--expect-change`, a base esta errada ou o motor nao mudou, e nos dois casos o script **FALHA** (`process.exitCode = 1`) em vez de reportar sucesso. Uma prova por diff que passa vazia e pior que nenhuma prova, porque produz um relatorio verde afirmando o contrario do que mediu. Em modo `--expect-neutral` (o modo desta onda 1, onde nada de motor mudou ainda), blobs iguais sao o resultado ESPERADO e nao sao erro.

**Em uma linha para os planos 27-02 a 27-07:** leiam o SHA base deste arquivo, nunca o deduzam.

---

## Bloco 2: inventario de acoplamento de ouro, por NOME DE SIMBOLO

**Aviso de desvio de linha, escrito antes da tabela.** Os `arquivo:linha` que o `ROADMAP.md` cita para esta fase sofreram desvio: as fases 25/25B/26 inseriram blocos inteiros de codigo (o canal absoluto de cerco, o recheio narrativo do early game, o termo de vantagem estrutural, a densidade comparavel) no meio de `engine.ts`, `structures.ts` e `selection.ts`, deslocando tudo que vem depois. `27-RESEARCH.md` (`## Common Pitfalls`, Pitfall 1) verificou linha a linha contra `HEAD` e confirmou o desvio em pelo menos quatro dos doze pontos citados. **Toda tarefa desta fase localiza o simbolo por `grep` de NOME, nunca por numero de linha herdado do roadmap.**

### Produtores de ouro

| Simbolo | Arquivo | Papel | Afeta `digestTimeline`? | Plano dono |
| --- | --- | --- | --- | --- |
| `BASE_KILL_GOLD` | `matchState.ts` | produtor (credito de abate) | sim (consumido em `engine.ts`/`structures.ts`) | 27-02 |
| `ASSIST_GOLD` | `matchState.ts` | produtor (credito de assistencia) | sim | 27-02 |
| `FIRST_BLOOD_BONUS` | `matchState.ts` | produtor (bonus primeiro sangue) | sim | 27-02 |
| `FIRST_TURRET_BONUS` | `matchState.ts` | produtor (bonus primeira torre) | sim | 27-02 |
| `passiveIncome` (o divisor `/10`) | `engine.ts` | produtor (renda passiva por tick) | sim | 27-02 |
| `recomputeBounty` | `engine.ts` | produtor (formula de bounty de shutdown, cap `450` + incremento `90` por streak) | sim (via `shutdownGold`, consumido por `bountyGreed` e por `applyKill`) | 27-02 |
| `PLATE_GOLD_EST` | `structures.ts` | produtor (estimativa de ouro de placa) | sim | 27-02 |

### Consumidores e limiares

| Simbolo | Arquivo | Papel | Afeta `digestTimeline`? | Plano dono |
| --- | --- | --- | --- | --- |
| `K_GOLD` (e o `K` local de `effectiveGoldPower`) | `power.ts` | consumidor (denominador de `sigmoid(delta/K)`) | sim (alimenta `fightPower`/`securePower`) | 27-03 |
| `expectedGoldForRoleAtMinute` | `power.ts` | consumidor/ancora (baseline de ouro esperado por role e minuto, hoje fixo em overall 65) | sim (via `goldFightMult`/`goldSecureMult`) | 27-05 (ECO-05: recebe `goldScale` e `avgLaningSlice` no mesmo commit, ver Bloco 4) |
| `goldFightMult` | `power.ts` | consumidor (canal de ouro no poder de luta) | sim | 27-03 |
| `goldSecureMult` | `power.ts` | consumidor (canal de ouro no poder de objetivo) | sim | 27-03 |
| `isStomping` contra `goldLead` | `selection.ts` | limiar absoluto (`> 1500`) | sim (afeta relaxamento de archetype) | 27-03 |
| `bountyGreed` contra `shutdownGold` | `selection.ts` | limiar absoluto (`>= 400`) | **sim, diretamente** (entra no peso de vitima da selecao ponderada, que consome o gerador) | 27-03 |
| `GOLD_DELTA_SCALE` e `expectedGoldByRole` em `contextMetrics` | `microMetrics.ts` | consumidor/duplicacao (denominador `500` e formula propria com constante `660`/min, divergente 10x de `power.ts`) | indireto (via `comebackThreat` -> `chooseIntent`) | 27-05 (a duplicacao e ELIMINADA na mesma mudanca de ancora de ECO-05, nao apenas escalada — ver Pitfall 5 do `27-RESEARCH.md`) |
| limiares de `computeDeathQuality` (`>= 200`, `<= -150`) e `tradeValue = kills*300` | `deathQuality.ts` | limiar cosmetico (classificacao de morte boa/neutra/ruim) | **nao** (so escolhe texto de ticker; confirmado por leitura de `digestTimeline`, `golden/fixtures.ts`) | 27-03 |
| retornos de `estimateMapLoss` (`50/80/100/150` por role) | `deathQuality.ts` | limiar cosmetico (perda de mapa estimada por role) | **nao** (mesma razao acima) | 27-03 |

### Os CINCO pontos que o `ROADMAP.md` NAO enumerou, marcados explicitamente

A varredura por simbolo (nao por linha) de `27-RESEARCH.md` encontrou cinco pontos de acoplamento de ouro fora da lista de doze do `ROADMAP.md`. **Nenhum deles fica sem dono nesta fase:**

| # | Ponto orfao | Localizacao | Plano dono |
| --- | --- | --- | --- |
| 1 | Formula de bounty de shutdown (`recomputeBounty`, cap `450`, incremento `90`) | `engine.ts` | **27-02** |
| 2 | Limiar `bountyGreed` (`>= 400`) | `selection.ts` | **27-03** |
| 3 | `GOLD_DELTA_SCALE` (`500`) | `microMetrics.ts` | **27-05** (eliminado por importacao de `expectedGoldForRoleAtMinute`, nao apenas escalado) |
| 4 | Limiares de `computeDeathQuality` (`>= 200`, `<= -150`) | `deathQuality.ts` | **27-03** |
| 5 | Retornos de `estimateMapLoss` (`50/80/100/150`) | `deathQuality.ts` | **27-03** |

Nenhum destes e opcional para a varredura ser "coordenada e atomica" (decisao travada do `ROADMAP.md`): se `GOLD_SCALE` subir e algum destes nao acompanhar, o ponto fica economicamente defasado. Os itens 2 e 3 afetam `digestTimeline` de verdade (a `bountyGreed` diretamente por entrar na selecao ponderada que consome o gerador; o `GOLD_DELTA_SCALE` indiretamente via `comebackThreat`); os itens 1, 4 e 5 nao afetam `digestTimeline` diretamente (item 1 afeta indiretamente via item 2), mas ficam silenciosamente errados em unidade antiga se nao forem tocados.

**ADENDO pos-fechamento (nao fazia parte da ancoragem original, gravado apos o commit inicial da fase — ver `docs/diagnostics/27-relatorio-da-fase.md` secao 4 para o registro completo):** um SEXTO ponto orfao existia em `deathQuality.ts` e nao foi enumerado aqui nem pela varredura de 27-03: o limiar `victimTeamGoldDelta > -800` dentro de `selectContextualTicker` (limiar cosmetico, mesma categoria dos itens 4 e 5 desta tabela — nao afeta `digestTimeline`, so escolhe texto de ticker). Achado pelo code review do plano 27-07 (`27-REVIEW.md` CR-01) apos o aceite humano da fase, corrigido com `unscaleGold` e coberto por teste de identidade entre escalas antes do fechamento formal em `ROADMAP.md`. Este bloco fica sem edicao retroativa na tabela acima porque `Bloco 1` desta ancoragem e um registro do que era conhecido ANTES da primeira mudanca de motor; o adendo existe para que a lacuna original nao fique invisivel a uma leitura futura.

---

## Bloco 3: a disciplina de exatidao da escala, escrita antes do primeiro commit de motor

As duas regras abaixo tornam a prova de identidade de ECO-04 EXATA, e nao apenas aproximada.

**Regra do PRODUTOR:** todo credito de ouro e calculado exatamente como hoje, produzindo um inteiro `g`, e so entao emitido como `scaleGold(g, goldScale)`, definida como `Math.round(g * goldScale)`. Escalar o inteiro ja arredondado, nunca o real antes do arredondamento. Consequencia: para `goldScale` inteiro, todo saldo de ouro guardado e EXATAMENTE `goldScale` vezes o saldo da escala 1.

**Regra do CONSUMIDOR:** todo ponto que compara ouro contra uma constante fixa ou o normaliza por um denominador fixo primeiro converte para unidade base com `unscaleGold(ouro, goldScale)`, definida como `ouro / goldScale`, e so entao aplica a expressao de hoje INALTERADA. Nenhuma constante de consumo muda de valor.

**O argumento de exatidao.** Em IEEE 754 a divisao e corretamente arredondada, entao `(S * g) / S` com `g` inteiro devolve `g` bit a bit, para qualquer `S` positivo; e `x / 1` devolve `x` bit a bit. Logo a escala 1 e neutra por construcao (diff de golden vazio, porque `scaleGold`/`unscaleGold` sao identidade quando `goldScale = 1`) e a escala inteira e exata por construcao (timeline identica entre `goldScale=1` e `goldScale=N` inteiro, porque `unscaleGold(scaleGold(g, N), N) === g` bit a bit).

**Nota de honestidade, escrita agora e nao descoberta depois:** para `goldScale` NAO inteiro (o valor de producao final provavelmente sera fracionario, algo perto de 2,5-3x segundo a projecao de `27-RESEARCH.md` Assumptions Log A1), `Math.round(g * goldScale)` introduz arredondamento e a proporcionalidade deixa de ser exata bit a bit. Isso NAO invalida nada: a prova de identidade de ECO-04 e uma prova de NEUTRALIDADE DE REFATORACAO (que `scaleGold`/`unscaleGold` compoem para identidade quando `goldScale` e o MESMO inteiro dos dois lados, tipicamente 1 e um segundo inteiro de teste como 5), e o `ROADMAP.md` a especifica sobre exatamente esse par inteiro. O valor fracionario final de producao (Wave 6) nao precisa reproduzir esta prova bit a bit; ele precisa apenas preservar a estrutura da timeline (o que os gates de calibracao, nao a prova de identidade, verificam). Este limite fica registrado por escrito aqui, antes de qualquer numero de producao ser escolhido.

---

## Bloco 4: orcamento de regeneracoes de golden da fase, declarado ANTES da primeira mudanca de comportamento

A fase gasta **EXATAMENTE TRES** regeneracoes de golden, cada uma em commit isolado de um arquivo por vez, cada uma com o relatorio de `diff-golden` commitado ANTES da regeneracao:

1. **Plano 27-04**, causa: o canal de ouro para pressao estrutural (ECO-03) passa a existir e muda a taxa estrutural em partidas com vantagem de ouro.
2. **Plano 27-05**, causa: `expectedGoldForRoleAtMinute` passa a ser ancorada no nivel medio real dos dez jogadores (ECO-05), e a duplicacao de formula em `microMetrics.ts` e eliminada na mesma mudanca de ancora.
3. **Plano 27-06**, causa: o VALOR de `goldScale` sobe de 1 para o valor que fecha a banda de ECO-01.

**Os planos 27-02 e 27-03 tem orcamento ZERO de regeneracao.** Se o `diff-golden` deles nao vier vazio, a varredura esta INCOMPLETA, e a correcao e completar a varredura (achar o ponto de acoplamento que ficou de fora), NUNCA regenerar o golden para fazer o diff sumir. Regenerar ali esconderia exatamente o bug que a prova de identidade de ECO-04 existe para pegar.

---

## Bloco 5: baseline economico pre-fase, MEDIDO

**Nenhum numero deste bloco foi estimado.** Cada leitura abaixo e a saida literal de um comando executado nesta onda, no commit base `5af835c`, antes de qualquer edicao de `src/sim/` (as leituras de `calibrate:pace` foram recapturadas apos a Task 3 desta mesma onda adicionar o terceiro termo do assert de ordenacao em `scripts/calibrate-pace.ts` — um arquivo de `scripts/`, fora de `src/sim/` — para o baseline incluir o veredito do novo assert; a engine em si permaneceu intocada durante toda a onda, confirmado no fim deste bloco por `git diff --name-only -- src/sim`).

### `npm run calibrate:pace` (tier EQUILIBRADO, user 75 vs rival 75, N=800)

As quatro razoes do assert de ordenacao inter-camada (ROADMAP.md Fase 27 criterio 3), medidas na MESMA rodada e no MESMO tier EQUILIBRADO:

| leitura | valor medido | dono da banda |
| --- | --- | --- |
| ouro/min por time | **647,5** (arredondado a 647 na tabela de bandas) | Fase 27 (ECO-01), banda [1500, 2100] |
| razao de ouro/min vencedor sobre perdedor | **1,038** (ouro/min vencedor 659,5 / perdedor 635,5) | Fase 27 (ECO-02), banda [1,10, 1,30] |
| razao de torres vencedor sobre perdedor | **3,181** | Fase 25, banda [2,50, 4,50] |
| razao de abates vencedor sobre perdedor | **1,054** | Fase 26, banda [1,80, 2,60] |

**Ordem medida hoje:** torres (3,181) > abates (1,054) > ouro (1,038). A cadeia completa do criterio 3 (torres > abates > ouro) esta, pela comparacao NUMERICA isolada dos tres valores, tecnicamente na ordem certa hoje, com a margem entre abates e ouro estreita (0,016). **Isso nao significa que o criterio esta fechado**, pelas quatro razoes registradas no comentario do proprio assert em `scripts/calibrate-pace.ts` (Task 3 desta onda): nenhuma banda de ouro fechou ainda (ambas [Fase 27] estao em FALHA na tabela de bandas abaixo), as ondas seguintes desta fase escalam ouro em ~2,5-3x, a Fase 26 corta abates em ~40%, e os dois movimentos podem inverter essa margem estreita por caminhos independentes.

**Execucao literal do novo assert de ordenacao (Task 3), registrada com honestidade:** `npm run calibrate:pace` chama `expectBands(bandResults)` ANTES dos tres asserts de ordenacao (R4, torres-contra-abates, e o novo abates-contra-ouro). Como ha bandas em FALHA hoje (nascidas vermelhas por design, DEC-02: "ESTE GATE NASCE VERMELHO DE PROPOSITO"), `expectBands` lanca uma excecao agregada e os tres asserts de ordenacao que vem depois dele no arquivo **nao sao alcancados nesta execucao** — comportamento herdado do arquivo, nao introduzido nesta onda (o assert torres-contra-abates, da Fase 25, ja estava nessa mesma posicao e ja sofria do mesmo efeito). O novo assert esta sintaticamente correto, tipado (`npx tsc --noEmit` limpo) e posicionado no padrao exigido; ele fica pronto para disparar assim que as bandas anteriores fecharem. Saida completa da execucao, incluindo a excecao agregada de `expectBands`, gravada em `docs/diagnostics/27-relatorio-da-fase.md` da onda de fechamento (27-07); aqui ficam registradas as quatro leituras que alimentam o baseline.

**Codigo de saida:** `npm run calibrate:pace` sai com codigo 1 (esperado: o gate nasce vermelho de proposito por bandas ja conhecidas, nenhuma delas causada por esta onda).

### `grep -o "rng(" src/sim/*.ts | wc -l`

```
72
```

Valor esperado e obtido: **72**, o mesmo numero que a Fase 25C fechou e verificou. Nenhuma linha de `src/sim/` foi tocada nesta onda, entao a contagem nao podia ter mudado.

### `npm run diff-golden`

Saida literal:

```
Diff estruturado de golden (INST-07): 0 snapshot(s) comum(uns) comparado(s) (15 no lado antigo, 0 no lado novo).

1) Vencedores mudados: 0
   nenhum

2) Tipos de evento acrescentados ou removidos: 0 snapshot(s) afetado(s)
   nenhum

3) Delta de duracao aproximado (proxy = timeSec do ultimo evento): 0 snapshot(s) afetado(s)
   nenhum

4) Violacoes de ordem detectadas: 0 snapshot(s) afetado(s)
   nenhuma

5) Blocos presentes so num dos lados (mudanca de estrutura, nao de valor): 15
   - removido: golden-seed — balanced (70 vs 68) > digest matches snapshot — seed 1 1
   [... treze blocos identicos omitidos, todos "removido" ...]

Limitacao conhecida: o digest do golden nao guarda a lane (D-11, src/__tests__/golden/fixtures.ts). [...]
```

Codigo de saida: 0.

**Achado de instrumento, declarado aqui e nao escondido, com dono no `deferred-items.md` desta fase (fora do escopo desta onda para consertar).** A leitura acima NAO significa que o golden mudou de estrutura: e um artefato de CRLF. `scripts/diff-golden.ts`, quando chamado sem argumentos, compara o texto lido de `git show HEAD:<snap>` (que devolve LF puro, verificado diretamente) contra o texto lido por `readFileSync` da arvore de trabalho (que tem CRLF neste checkout, porque `core.autocrlf = true` e nao ha `.gitattributes` forcando LF). O parser `BLOCK_RE` de `diff-golden.ts` exige `` `\n" `` (LF literal) logo apos o backtick de abertura de cada bloco; com CRLF na arvore de trabalho, o padrao nunca casa, e o lado "novo" sempre reporta zero blocos — nao porque o golden mudou, mas porque o parser nao reconhece o proprio formato do arquivo neste ambiente. Confirmado por leitura direta de byte: `git show HEAD:<snap>` comeca com `"...snapshot.html\n\nexports[..."` (LF), a arvore de trabalho comeca com o mesmo texto mas `\r\n`. Esta e uma limitacao PRE-EXISTENTE do script (nao causada por nenhuma edicao desta fase, e `scripts/diff-golden.ts` nao foi tocado nesta onda), reproduzivel sempre que o script roda neste checkout Windows sem edicao no arquivo alvo. Registrado em `deferred-items.md` desta fase; nao corrigido aqui porque esta fora do escopo dos arquivos desta tarefa (`docs/diagnostics/27-ancoragem.md`, `scripts/verify-27-diff.cjs`, `docs/diagnostics/27-prova-por-diff.txt`, `scripts/calibrate-pace.ts`) e corrigir o parser de `diff-golden.ts` e uma mudanca de escopo maior que esta onda nao precisa fazer para provar neutralidade (o Bloco 2 de `scripts/verify-27-diff.cjs`, Task 2 desta mesma onda, usa `git show` dos DOIS lados, nunca `readFileSync` da arvore de trabalho, e por isso nao herda este problema).

**Leitura honesta do estado real do golden, obtida por meio que nao sofre do problema acima:** `git status --short` nao lista `src/__tests__/golden/__snapshots__/golden.test.ts.snap` como modificado (arquivo identico ao commitado, confirmado por ausencia na saida de `git diff --stat -- src/__tests__/golden`), e nenhuma edicao de `src/sim/` ocorreu nesta onda. **O ARQUIVO** golden esta, de fato, byte a byte inalterado nesta onda — essa parte da conclusao e correta e obtida por um caminho diferente do relatorio textual acima.

**Correcao necessaria, para nao deixar a frase acima incompleta: arquivo inalterado NAO significa que o golden bate com o motor.** `npm test` (vitest run, config default) roda 996 testes e falha 18: 15 blocos de `src/__tests__/golden/golden.test.ts` (mismatch de conteudo real, timeline mudou), 2 blocos de `src/sim/structures.test.ts` ("extracao no-op", mesma causa), e 1 falha em `scripts/diff-golden.test.ts` (o proprio artefato de CRLF acima, agora como assercao de teste, nao so como uso manual do script). Causa raiz verificada por `git log`: o ultimo commit que regenerou o golden foi `60b74fe` (Fase 25C, plano 06); DEZ commits da Fase 26 (planos 26-04 a 26-09) mudaram `src/sim/` depois disso, e `.planning/phases/26-.../26-10-PLAN.md` — o plano de FECHAMENTO da Fase 26, dono da unica regeneracao de golden orcada para aquela fase, com aprovacao humana obrigatoria antes de regenerar — foi ESCRITO mas NUNCA EXECUTADO (nao existe `26-10-SUMMARY.md`). O golden ficou orfao do motor que deveria descrever ANTES de a Fase 27 comecar, por uma lacuna de fechamento da Fase 26, nao por nada desta onda. Detalhe completo, causa raiz e recomendacao para o dono real em `deferred-items.md` desta fase, item **D-27-E2**. Nenhum commit de 27-01 toca `src/sim/`, `src/__tests__/` ou `scripts/diff-golden.ts` — confirmado durante toda a onda por `git diff --name-only -- src/sim` vazio.

---

## Resumo para os planos seguintes

- **SHA base:** `5af835c5c75b07a2d32614dd39ca705c870017de` — leia, nao deduza.
- **17 pontos de acoplamento de ouro** (12 do `ROADMAP.md` + 5 orfaos) com dono declarado, nenhum esquecido.
- **Disciplina de exatidao:** `scaleGold`/`unscaleGold` como as duas unicas portas de conversao de escala.
- **Orcamento de golden:** exatamente 3 regeneracoes (27-04, 27-05, 27-06); 27-02 e 27-03 com orcamento zero.
- **Baseline medido:** ouro/min 647,5 (piso 1500), razao ouro 1,038 (piso 1,10), `rng(` em 72, arquivo golden byte a byte inalterado (confirmado por `git status`, independente do artefato de CRLF do relatorio textual).
- **ATENCAO (D-27-E2, deferred-items.md):** `npm test` entra nesta fase com 18 falhas PRE-EXISTENTES (golden desalinhado do motor da Fase 26, cuja fase de fechamento 26-10 nunca rodou). Nenhuma causada por 27-01. O plano 27-04 (dono da primeira regeneracao de golden desta fase) deve ler o item antes de regenerar, para nao misturar o deslocamento herdado da Fase 26 com o deslocamento real da Fase 27 no mesmo diff.
