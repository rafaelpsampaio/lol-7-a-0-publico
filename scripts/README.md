# Convenção de Harness do Projeto

Registro da convenção que rege todo script de calibração/diagnóstico em `scripts/`. Existe porque a Fase 23 (INST-01) encontrou um gate de aceite que morria em silêncio por falta desta convenção estar escrita em algum lugar: sem ela, a próxima pessoa reintroduz o bug.

## 1. Regra de config: include literal, testTimeout obrigatório

Todo `vitest.<nome>.config.ts` novo declara `include` com caminho literal, um arquivo por entrada, e nunca um padrão com curinga (`*`). E declara `testTimeout` explicitamente.

Razão empírica: o default do vitest é 5000ms, menor que o tempo de um harness com N em torno de 800 partidas. Um config sem `testTimeout` declarado produz desfecho por estouro de tempo em vez de desfecho por assert, e isso passa despercebido porque os harnesses mais rápidos continuam completando normalmente. Foi exatamente isso que aconteceu com `vitest.calibrate.config.ts`: o `include` com curinga casava os seis harnesses de `scripts/`, e sem tempo limite os dois mais pesados morriam por timeout enquanto os outros quatro terminavam, misturando um resultado real com um estouro de tempo na mesma saída.

```ts
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/calibrate-nome.ts"], // caminho literal, nunca curinga
    testTimeout: 120_000, // sempre declarado, com margem sobre o medido
  },
});
```

## 2. Anatomia de um harness

Todo harness abre com um bloco de cabeçalho `/** ... */` citando o nome do arquivo, a fase e o requisito que o originou, o comando de execução via npm, e o bloco de invariantes não negociáveis:

```ts
/**
 * scripts/calibrate-exemplo.ts
 *
 * Harness de calibracao de exemplo (Fase N / REQ-01).
 * Executar: npm run calibrate:exemplo  (via vitest, config dedicada)
 *
 * Invariantes nao negociaveis:
 *   - Determinismo: seed = i por partida, nunca seed compartilhada
 *   - Sem Math.random: apenas mulberry32(seed)
 *   - Assert duro separado visualmente do assert tolerante (banda)
 *   - Relatorio pt-BR sem o caractere travessao
 */
```

Modelo canônico: `scripts/calibrate-structures.ts:1-24`.

## 3. Repetição deliberada de fixture

`makePlayer` e `roster` são copiados verbatim entre harnesses, sempre com um comentário citando o arquivo e as linhas de origem, e nunca extraídos para um módulo compartilhado. Cada harness precisa ser legível isoladamente, sem que o leitor tenha que pular para outro arquivo para entender a fixture que ele usa.

A única exceção é a estatística pura (`mean`, `stdev`, `percentile`, `summarize`, `histogram`, `shareWhere`, `inBand`, `bimodalityCoefficient`), que INST-06 manda centralizar em `scripts/stats.ts`: ali a extração é o pedido explícito, porque é lógica sem ligação nenhuma com a fixture de um harness específico.

## 4. Dois tipos de artefato, nunca misturados

- **Relatório**: sem assert, lente ampla, existe para dar panorama. Exemplo: `diagnose-engine.ts`.
- **Gate**: com assert, banda de dois lados, existe para reprovar miscalibração. Exemplo: `calibrate-pace.ts`.

Um harness que mistura os dois produz um resultado em que ninguém sabe o que "passar" significa: se o relatório tem asserts, alguém vai tratar um vermelho esperado como bug; se o gate não tem asserts, ele para de proteger qualquer coisa.

**Existe agora uma BIBLIOTECA de acoplamento importada pelos dois lados, e a regra que a governa é exatamente esta separação.** `scripts/lift.ts` (Fase 25C) implementa a matriz de lift inteira: os três estimadores do nulo, o bootstrap por cluster de partida, Benjamini-Hochberg e a definição dos pares. Ela é **módulo puro, sem I/O e sem asserção nenhuma**, e tem dois consumidores com necessidades opostas:

- `scripts/probe-lift.ts`, a **sonda**, que imprime e **nunca asserta**, e sai 0 seja qual for o número;
- `scripts/calibrate-pace.ts`, o **gate**, que asserta as seis linhas de banda de acoplamento.

**A razão de a definição viver na biblioteca e não em cada consumidor:** duas cópias divergiriam em silêncio, e a leitura PRE congelada pela sonda deixaria de ser comparável com a POS que o gate julga. **Um controle que mede outra coisa é pior que nenhum controle.**

**Dois invariantes da biblioteca que não são negociáveis:** toda estatística de base vem de `scripts/stats.ts` e nada é reimplementado ali (DEC-04: duas definições de percentil no repositório moveriam bandas em silêncio), e ela tem **zero dependência externa**, pelo mesmo motivo que INST-06 recusa dependência externa de estatística.

**Dois dos três estimadores existem APENAS para serem refutados pelo teste**, e nenhum consumidor de veredito pode chamá-los: o cruzado simples dá falso positivo e o de jitter dá falso negativo, os dois medidos contra corpus com lift verdadeiro 1,000 por construção.

### 4.1 Armadilha operacional: existem DOIS snapshots de valor, e um comando só cobre um deles

Esta nota existe porque a armadilha custou uma linha do plano de fechamento da Fase 25 e vai custar tempo de novo se não ficar escrita.

**O projeto tem dois snapshots que mudam de VALOR a cada fase que mexe em calibração**, e o comando de atualização de golden cobre apenas o primeiro:

| Snapshot | Coberto por `npm run update-golden`? | Comando que de fato o cobre |
|---|---|---|
| `src/__tests__/golden/__snapshots__/golden.test.ts.snap` (15 digests) | **sim** | `npm run update-golden`, que é `vitest run src/__tests__/golden/golden.test.ts --update` |
| `src/sim/__snapshots__/structures.test.ts.snap` (assinatura de linha do tempo, 2 entradas) | **NÃO** | `npx vitest run src/sim/structures.test.ts --update` |

Regenerar só com `npm run update-golden` deixa a suíte **vermelha** e dá a impressão de que sobrou uma regressão de motor onde só faltou um comando. Os dois entram na **mesma** regeneração deliberada da fase, cada um em **commit isolado**, e a regeneração continua sendo **uma por fase**.

### 4.2 Correção de leitura: os quatro canários de aridade NÃO são todos a mesma coisa

A tabela de invariantes do `ROADMAP.md` diz, sobre os quatro canários de INV-1, que "qualquer vermelho aqui é erro de implementação, não mudança esperada". **Isso é verdade para três deles e falso para o quarto**, e a distinção foi medida na pesquisa da Fase 25 (Achado 9).

| Canário | O que ele realmente testa | Vermelho nele significa |
|---|---|---|
| `selection.test.ts:266` (`assistWeight.length`) | aridade da **assinatura**: a função recebe 2 parâmetros e nenhum é gerador | **erro de implementação** |
| `structures.test.ts:443` (`drawCount`) | o caminho `nexusTurret` de `resolveHeraldUse` consome exatamente 1 draw | **erro de implementação** |
| `engine.test.ts:352` (auto-consistência) | `run1.drawCount() === run2.drawCount()` para a mesma seed, mais timeline idêntica entre duas rodadas. **Não trava nenhum valor histórico** | **erro de implementação** |
| **`structures.test.ts:81` e `:88`** (`toMatchSnapshot`) | **assinatura completa de linha do tempo** (`seed:tempo:kind:ator` de todos os eventos) para STOMP 85x55, seeds 0 e 5 | **snapshot de VALOR**, funcionalmente parte do golden: fica vermelho por design a cada fase que mexe em calibração, e entra na regeneração deliberada |

Ler o quarto como os três primeiros faz alguém procurar um bug de determinismo onde só houve mudança de calibração esperada.

## 5. Bandas: piso, teto, fonte e fase dona sempre declarados

Toda banda usada num gate declara piso, teto, fonte e a fase dona daquele número. Uma banda sem fonte externa citável só existe marcada explicitamente como provisória no comentário ao lado dela, até que uma fase futura a recalibre com dado real.

Assert de um lado só (só piso ou só teto) é regressão de processo nesta milestone: foi exatamente o padrão que a v2.0 usou e que produziu uma engine de 51 minutos aprovada 13/13 verde. `scripts/bands.ts` (`expectInBand`) torna o assert de dois lados o caminho de menor esforço, porque o TypeScript recusa compilar uma chamada que omita `floor` ou `ceiling`.

### 5.1 Regra de fechamento de fase, por dono de banda

Escrita na Fase 25B (plano 25B-02). Ela existe porque `calibrate:pace` é um gate **compartilhado**: ele já carregava bandas vermelhas com dono nas Fases 26, 27, 28 e 29 antes desta fase começar, e a Fase 25B acrescentou mais dezoito bandas, das quais doze nascem vermelhas. Sem regra escrita, uma fase ficaria refém do vermelho de outra, e a saída fácil (afrouxar a banda alheia para o gate passar) é exatamente o modo de falha da v2.0.

**A regra, em três frases:**

1. **Uma fase fecha quando toda banda cujo dono é ela está DENTRO.** Nunca quando o gate inteiro fica verde: o gate inteiro só fica verde na Fase 30.
2. **Bandas com dono em outra fase seguem vermelhas e não bloqueiam.** Elas são listadas **nominalmente**, com o dono ao lado, no relatório de fechamento da fase, para que ninguém precise deduzir de quem é cada vermelho.
3. **Nenhuma banda pode ser afrouxada para fazer gate passar.** Alterar piso ou teto é sempre um item da revisão em bloco da Fase 30 (DOCS-01), com **valor antigo, valor novo, fase que pediu e justificativa** escritos. Uma alteração de banda dentro da fase que ela beneficia é a definição do pêndulo que esta milestone existe para não repetir.

**Corolário sobre bandas de vigia.** As bandas de dispersão que hoje não têm vermelho atribuído nascem com dono `Fase 30 (vigia)`. Isso é **endereço padrão, não atribuição de culpa**: quando uma dessas ficar vermelha, o dono passa a ser **a fase que produziu o vermelho**, e a reatribuição é obrigatória no fechamento daquela fase. Precedente já exercido: a banda de assistências do ADC por partida foi reatribuída de Fase 24 para Fase 26 com a justificativa aritmética escrita ao lado dela, sem que piso, teto ou alvo mudassem de valor.

### 5.2 Nota de eixo: a v2.2 passa a ter dois eixos de gate

| Eixo | O que ele mede | Quando nasceu |
|---|---|---|
| **NÍVEL** | média, mediana, taxa: torres/min, ouro/min, razão vencedor sobre perdedor, mediana da primeira torre | Fase 23 (INST-03) |
| **DISPERSÃO e FORMA** | coeficiente de variação ancorado no estado pré-Fase-25, frações de desfecho e coeficiente de bimodalidade das **distribuições** | Fase 25B (plano 25B-02) |

**O segundo existe porque apertar média colapsando distribuição passa por sucesso no primeiro.** Não é hipótese: a Fase 25 fechou seis bandas de nível e colapsou **quatro** distribuições, e o colapso só apareceu porque alguém pediu para olhar no último plano dela. O caso de manual é `torres por minuto`, cuja banda de nível está **verde** (0,326 dentro de [0,300; 0,450]) com a dispersão em **0,504** contra o piso 0,75, ou seja com a distribuição encolhida pela metade.

**Uma banda por defeito, no eixo em que o defeito aparece.** Corolário registrado na escolha do teto de dispersão (`docs/diagnostics/25B-ancoragem.md` Bloco 4): pegar o mesmo defeito por dois eixos tem custo concreto, porque a onda que conserta a causa vê a banda do outro eixo ficar vermelha durante o conserto e é empurrada a perseguir o número em vez da causa. Por isso `torres do perdedor` não tem teto de dispersão apertado para pegar o shutout: o shutout tem instrumento próprio e mais específico.

**Nenhuma banda de forma incide sobre razão**, e a proibição é por medição, não por gosto: o coeficiente de bimodalidade sobre quociente de inteiros pequenos é saturado e ficou acima do limiar nos quatro estados do contrafactual, inclusive no pré-fase, de modo que aplicado ao pé da letra teria **absolvido a Fase 25** (aviso de instrumento de `docs/diagnostics/25-sweep.md`).

## 6. Scripts npm de calibração existentes

| Script npm | Config | O que mede |
|---|---|---|
| `npm run calibrate` | `vitest.calibrate.config.ts` | Gate de aceite original: `scripts/calibrate.ts` (win rate por tier via `runMatch`) e `scripts/calibrate-engine.ts` (distribuições da engine state-driven: win rate, stomp/comeback/equilibrado, duração, Baron/Alma/Elder, violações de regra dura) |
| `npm run calibrate:micro` | `vitest.calibrate-micro.config.ts` | K/D/A médio por role, bandas de plausibilidade e cenários arquetipados nomeados (Fase 13) |
| `npm run calibrate:structures` | `vitest.calibrate-structures.config.ts` | Distribuições estruturais e de combate: 1ª torre, torres por checkpoint, multikill, ace, Baron/setup, tickers (Fase 16) |
| `npm run calibrate:objectives` | `vitest.calibrate-objectives.config.ts` | Objetivos: Herald, distribuição de Baron/Alma/Elder por tier (Fase 19) |
| `npm run calibrate:combat` | `vitest.calibrate-combat.config.ts` | Combate cedo: baixas por fase inicial de jogo (Fase 20) |
| `npm run diagnose` | `vitest.diagnose.config.ts` | Panorama amplo da engine em 5 cenarios, sem assert (Fase 23) |
| `npm run probe:side-bias` | `vitest.probe-side-bias.config.ts` | **Sonda de observação, sem nenhum assert e fora de `calibrate:all`.** Mede a linha de viés de lado em fixture espelhada 75 contra 75, N = 1500, decomposta por tipo de desfecho (por nexo e no teto de 60 minutos), cada proporção com a meia-largura do IC95 e o n do recorte. Existe para comparar a mesma leitura **antes e depois** da Fase 25 com a mesma fixture e o mesmo N, e assim poder afirmar com número que a fase não amplificou o viés. Corrigir o viés está **fora de escopo** da Fase 25: a sonda mede, não gateia. Relatório em `tmp/side-bias.txt` (Fase 25) |
| `npm run calibrate:pace` | `vitest.calibrate-pace.config.ts` | Gate de ritmo de dois lados: torres/min, abates/min, ouro/min e relacoes metamorficas de invariancia de nivel (Fase 23). Desde a Fase 25B carrega tambem os **dois eixos**: onze bandas de **DISPERSAO** (coeficiente de variacao ancorado no motor pre-Fase-25, mais a fracao de comeback sobre o valor) e sete de **FORMA** (as cinco fracoes dos criterios 2 e 3 do roadmap e os dois coeficientes de bimodalidade das distribuicoes de torres) |
| `npm run calibrate:assists` | `vitest.calibrate-assists.config.ts` | Gate de distribuicao de assistencia por rota: o **unico gate do projeto que roda com campeoes atribuidos** (tres conjuntos: `CONTROLE-CARRIES`, `MISTO`, `SEM-CAMPEOES`) e que **reprova por elegibilidade estrutural de rota** (total de assistencias zero em N partidas), alem do piso duro do ADC, da banda-raiz de assistencias por abate do time e da ordenacao de participacao (Fase 24) |
| `npm run calibrate:all` | `scripts/calibrate-all.mjs` | Encadeador sem curto-circuito dos sete gates acima, com resumo pt-BR ao final (Fase 23) |
| `npm run diff-golden` | `scripts/diff-golden.ts` | CLI de diff estruturado do golden, compara a versao commitada com a arvore de trabalho por padrao (Fase 23) |

## 7. Baseline oficial da v2.2

**Onde mora:** `docs/baselines/24-baseline-v2.2.md`
**Como foi gerado:** `npm run diagnose` no commit `d5ea94b`, ao fim da Fase 24, com 15.500 partidas determinísticas em cinco cenários.

**Regra de leitura, em uma frase:** qualquer comparação de fase da v2.2 se refere a esse arquivo, e **não** ao diagnóstico de 2026-07-28 que abriu a milestone.

A razão é que o diagnóstico de abertura foi medido sobre uma engine com três rotas estruturalmente excluídas de receber assistência (o ADC aparecia com `A = 0.00` nos três cenários). Corrigir esse defeito já foi, por si só, uma mudança de calibração, porque assistência vira ouro individual, que vira multiplicador de luta, que vira desfecho de luta. Sem esse corte, cada fase de 25 a 30 atribuiria a si mesma uma parte de um efeito que veio da Fase 24.

**Dois arquivos, e só um deles é congelado.** Essa distinção é o que impede alguém comparar contra um alvo móvel sem perceber:

| Arquivo | Natureza | Quando muda |
|---|---|---|
| `docs/diagnostics/engine-diagnose.txt` | relatório **corrente** | `npm run diagnose` **reescreve o arquivo inteiro a cada execução** |
| `docs/baselines/24-baseline-v2.2.md` | baseline **congelado** | nunca; é a cópia da medição da Fase 24, com o commit de origem citado |

O baseline também carrega, para ser autossuficiente, o estado dos sete gates na data em que foi congelado, com a fase dona de cada vermelho. Quem o abrir na Fase 27 sabe o que já estava vermelho antes de o próprio trabalho começar.

A atualização completa de `docs/ENGINE-DIAGNOSIS.md` para o modelo v2.2 é trabalho declarado da Fase 30 (DOCS-02); lá o documento só recebeu o ponteiro para este baseline.

## Resultado do gate hoje (2026-07-29, Fase 23-02)

`npm run calibrate` termina em cerca de 3 segundos, sem nenhuma mensagem de estouro de tempo. Desfecho: `scripts/calibrate.ts` passa; `scripts/calibrate-engine.ts` falha por um assert nomeado em `scripts/calibrate-engine.ts:157` (`expected 1 to be less than 0.99`, o teto de win rate do tier DOMINANTE). Esse vermelho é o sintoma correto e esperado do win rate de 100% no tier dominante, e sua fase dona é a Fase 28 (FRC-02). O critério 1 do `ROADMAP.md` pede desfecho por assert, não pede verde.

## Resultado do gate de assistência hoje (2026-07-29, Fase 24-01)

`npm run calibrate:assists` termina em cerca de 8 segundos, por assert nomeado e nunca por estouro de tempo. Desfecho: **vermelho de propósito**, em H1 (elegibilidade estrutural), com 7 violações. No conjunto `CONTROLE-CARRIES` (quatro rotas com o mesmo `meta.assistBias` de 0,50) top, jungle, mid e ADC terminam em **zero absoluto** de assistências em 800 partidas nos dois lados; em `MISTO` são jungle e ADC; em `SEM-CAMPEOES` é o ADC. Esse vermelho é o retrato PRÉ-correção da Fase 24 e o insumo de abertura do Plano 24-02: o conserto do motor não pertence ao plano que criou o instrumento.

`npm run calibrate:all` passa a encadear **sete** gates sem curto-circuito. Nenhum dos sete termina por estouro de tempo.

## Desfecho dos sete gates ao FECHAR a Fase 24 (2026-07-29, Fase 24-05)

Estado medido no commit em que o baseline oficial da v2.2 foi congelado. **3 de 7 verdes, exatamente o mesmo placar do início da fase: nenhum gate mudou de verde para vermelho, ou seja zero regressão colateral.**

| Gate | Desfecho | Fase dona do vermelho | Assert em que para |
|---|---|---|---|
| `calibrate` | vermelho | **Fase 28** (FRC-02) | `calibrate-engine.ts:157`, `expected 1 to be less than 0.99` (teto de win rate do tier DOMINANTE). Valor idêntico ao do início da fase |
| `calibrate:micro` | vermelho | **Fase 26** | `média de kills de top 15,79 ultrapassou teto tolerante de 8`. É gate de **volume**, pré-existente e mascarado até a Fase 24 fazer o assert anterior passar |
| `calibrate:structures` | **verde** | | |
| `calibrate:objectives` | **verde** | | |
| `calibrate:combat` | **verde** | | |
| `calibrate:pace` | vermelho | **Fase 25** (falha dura) e Fases 26/27/28/29 (bandas) | `primeira torre antes de 7:00 no tier GAP-30`, com o mesmo valor 6 do início da fase |
| `calibrate:assists` | vermelho | **Fase 26** | Elegibilidade estrutural, piso duro do ADC e ordenação de participação estão **verdes**; sobra a banda-raiz de taxa em 0,266 contra piso 0,280, refém da razão agregada de assistências por abate |

**O que mudou dentro do vermelho de `calibrate:assists`, e é a razão da fase existir:** ele nasceu vermelho em H1 (elegibilidade estrutural) com **7 violações**, quatro rotas em zero absoluto de assistências. Hoje H1, H2 e a ordenação de participação estão em **zero violações** e o que sobra é uma única banda numérica. O relatório de `npm run diagnose` mostra as cinco rotas acima de zero nos três cenários.

Nenhum limiar de plausibilidade foi afrouxado para chegar a esse estado, e nenhum dos sete gates termina por estouro de tempo.

## Desfecho dos sete gates ao FECHAR a Fase 25 (2026-07-30, Fase 25-08)

Estado medido em `npm run calibrate:all`, saída completa em `tmp/all-25-08.txt`. **4 de 7 verdes, contra 3 de 7 no congelamento do baseline da v2.2. Nenhum gate passou de verde para vermelho: zero regressão colateral.** O gate que mudou de lado mudou para o lado bom.

| Gate | Desfecho no congelamento (Fase 24) | **Desfecho hoje** | Fase dona do vermelho | Assert em que para |
|---|---|---|---|---|
| `calibrate` | vermelho | **vermelho** | **Fase 28** (FRC-02) | `calibrate-engine.ts:157`, `expected 1 to be less than 0.99` (teto de win rate do tier DOMINANTE). Assert e valor **idênticos** aos do congelamento |
| `calibrate:micro` | vermelho | **verde** | | o assert que o prendia (`média de kills de top`) media **15,79** e hoje mede **7,99**, abaixo do teto tolerante de 8 |
| `calibrate:structures` | **verde** | **verde** | | |
| `calibrate:objectives` | **verde** | **verde** | | |
| `calibrate:combat` | **verde** | **verde** | | |
| `calibrate:pace` | vermelho | **vermelho** | **Fases 26, 27, 28 e 29** (oito bandas) | o assert duro de `primeira torre antes de 7:00 no tier GAP-30` **zerou** (era 6) e o gate passou a alcançar `expectBands`, que falha em 8 bandas. **Nenhuma delas é da Fase 25** |
| `calibrate:assists` | vermelho | **vermelho** | **Fase 26** (a razão agregada) | `assistências do ADC por abate do time [CONTROLE-CARRIES] = 0.262` contra o piso `0.280` |

**A mudança mais importante da fase não aparece no placar.** No congelamento, `calibrate:pace` parava no assert duro de 7:00 **antes** de `expectBands` rodar, ou seja as bandas vermelhas apareciam no relatório mas nunca chegavam a ser a causa nomeada da falha. Hoje aquele assert mede zero nos seis tiers e o gate falha **pelas bandas**, todas com dono em outra fase, e as **seis bandas donas da Fase 25 estão dentro**.

**Duas ressalvas registradas sem suavizar:**

- **`calibrate:micro` ficou verde por 0,01 de folga** (7,99 contra o teto de 8). Ele é gate de **volume**, dono declarado da **Fase 26**, e ficou verde como efeito colateral da queda de 42% nos abates. Qualquer movimento da Fase 26 na direção de mais volume o devolve ao vermelho. **Não contar este verde como entrega da Fase 25.**
- **`calibrate:assists` afastou-se do piso**, de 0,266 para **0,262**: a distância subiu de 0,014 para 0,018. A causa é a mesma queda de volume de abates, porque a taxa é um quociente e o denominador se moveu. A razão agregada segue em 1,776 contra 1,771. Nenhum limiar foi tocado.

Nenhum dos sete gates termina por estouro de tempo. O relatório completo de fechamento da fase está em `docs/diagnostics/25-relatorio-da-fase.md`.

## Desfecho dos sete gates ao FECHAR a Fase 25B (2026-07-30, Fase 25B-07)

Estado medido em `npm run calibrate:all`, saída completa em `tmp/all-25B-07.txt`. **4 de 7 verdes, o mesmo placar do fechamento da Fase 25. Nenhum gate passou de verde para vermelho: zero regressão colateral.**

| Gate | Desfecho ao fechar a Fase 25 | **Desfecho hoje** | Fase dona do vermelho | Assert em que para, com o valor medido |
|---|---|---|---|---|
| `calibrate` | vermelho | **vermelho** | **Fase 28** (FRC-02) | `calibrate-engine.ts:157`, `expected 1 to be less than 0.99`. Assert e valor **idênticos** aos do fechamento da Fase 25 |
| `calibrate:micro` | **verde** | **verde** | | |
| `calibrate:structures` | **verde** | **verde** | | regras duras em zero absoluto nos seis tiers |
| `calibrate:objectives` | **verde** | **verde** | | a banda `Baron no spawn` foi uma das duas travas que fixaram o ponto de operação em `T` = 9, e ela **continua verde** |
| `calibrate:combat` | **verde** | **verde** | | |
| `calibrate:pace` | vermelho (8 bandas) | **vermelho (14 bandas)** | **Fases 25B, 26, 27, 28, 29 e 30** | `expectBands`, falha agregada em 14 bandas. **Quatro têm dono Fase 25B** |
| `calibrate:assists` | vermelho | **vermelho** | **Fase 26** (a razão agregada; o rótulo no código ainda diz Fase 24) | `assistências do ADC por abate do time [CONTROLE-CARRIES] = 0.256` contra o piso `0.280` |

**O gate de ritmo passou a ter DOIS EIXOS, e é por isso que ele cresceu de 8 para 14 bandas vermelhas sem que nenhuma linha de `src/sim/` tenha regredido.** A onda 2 desta fase acrescentou **dezoito** bandas novas (onze de DISPERSÃO e sete de FORMA), das quais **doze nasceram vermelhas de propósito** (DEC-02: banda que nasce verde sobre engine não consertada é banda frouxa). As ondas de motor levaram as dez com dono Fase 25B de **dez vermelhas para quatro**, e **nenhuma banda pré-existente mudou de valor**. Ver seção 5.2 para a definição dos dois eixos.

**As quatro bandas vermelhas com dono Fase 25B ao fechar, nominalmente:**

| banda | medido | banda | por que não fechou |
|---|---|---|---|
| `DISPERSÃO primeira torre` | **0,540** | `[0,750; 2,000]` | não responde a nenhuma alavanca da fase; responde ao teto do termo de vantagem mas só entra no teto 1,0, que derruba três bandas de nível (D-25B-04) |
| `FORMA vitória com UMA rota limpa` | **0,366** | `[0,500; 0,800]` | subiu catorze vezes e parou na **regra dura** de `primeira torre antes de 7:00` no tier PRO-GAP. Fronteira de **modelo** |
| `FORMA shutout` | **0,497** | `[0,020; 0,120]` | região **vazia** por grade de nove tetos do termo de vantagem, com o piso da grade justificado por mecanismo (D-25B-05) |
| `FORMA bimodalidade das torres do PERDEDOR` | **0,606** | `[0,250; 0,5556]` | **tem conserto medido** (teto 1,75 leva a 0,522) e ele não foi aplicado, por decisão de sequenciamento tomada em checkpoint humano |

**Três ressalvas registradas sem suavizar:**

- **A suíte fecha em 908 verdes e 1 vermelho.** O vermelho é **D-25B-01**, por asserção e por design: `resolveHeraldUse` destrói o inibidor sem emitir `inhibitor_destroyed`, e a correção óbvia **criaria uma violação de regra dura de plausibilidade**. Ele não é snapshot e não é resolvível dentro do escopo desta fase.
- **`torres/min` só passa sob a contagem completa.** Sob o contador de nove ela mede **0,2843** contra o piso 0,300. Piso e teto **não mudaram de valor**: o que mudou foi a métrica passar a contar as duas torres do Nexus, que a referência externa sempre contou (D-25B-07).
- **`calibrate:assists` afastou-se mais do piso**, de 0,262 para **0,256**, pela mesma aritmética de quociente já registrada no fechamento da Fase 25: o denominador (abates do time) continuou caindo. Nenhum limiar foi tocado.

**Artefato novo desta fase, fora da cadeia de gates:**

| Script npm | Config | O que mede |
|---|---|---|
| `npm run probe:shape` | `vitest.probe-shape.config.ts` | **Sonda de observação, sem nenhum assert e fora de `calibrate:all`.** Mede DISPERSÃO (dez séries por partida com média, desvio populacional e coeficiente de variação) e FORMA (as cinco frações de desfecho, o histograma de rotas do perdedor limpas por inteiro e os dois coeficientes de bimodalidade das **distribuições** de torres), em dois tiers, N = 800 por tier. Ela **não** mede forma de razão, por decisão de instrumento. Relatório em `tmp/shape.txt` (Fase 25B) |

Nenhum dos sete gates termina por estouro de tempo. O relatório completo de fechamento da fase está em `docs/diagnostics/25B-relatorio-da-fase.md`.

## Desfecho dos sete gates ao FECHAR a Fase 25C (2026-07-31, Fase 25C-07)

Estado medido em `npm run calibrate:all`, saída completa em `tmp/25C07-calibrate-all.log`. **3 de 7 verdes, contra 4 de 7 no fechamento da Fase 25B. UM gate passou de verde para vermelho, e ele está atribuído commit a commit com decisão já tomada.**

| Gate | Desfecho ao fechar a Fase 25B | **Desfecho hoje** | Fase dona do vermelho | Assert em que para, com o valor medido |
|---|---|---|---|---|
| `calibrate` | vermelho | **vermelho** | **Fase 28** (FRC-02) | win-rate com gap de força 30 = `1.000` contra o teto `0.970` |
| `calibrate:micro` | **verde** | **verde** | | |
| `calibrate:structures` | **verde** | **verde** | | regras duras em zero absoluto nos seis tiers |
| `calibrate:objectives` | **verde** | **VERMELHO** | **fase nova do Barão**, a criar | `Baron no spawn por partida = 0.316` estourou o teto `[0.020, 0.240]`, alvo `0.164` |
| `calibrate:combat` | **verde** | **verde** | | |
| `calibrate:pace` | vermelho (14 bandas) | **vermelho (15 bandas)** | **Fases 25B, 25C, 26, 27, 28 e 30** | `expectBands`, falha agregada em 15 bandas. **Duas têm dono Fase 25C** |
| `calibrate:assists` | vermelho | **vermelho** | **Fase 24** (elegibilidade estrutural de rota) | quatro rotas em zero absoluto de assistências no conjunto controlado |

**O único gate que mudou de lado é o de objetivos, e a regressão NÃO é desta fase sozinha.** A atribuição está medida commit a commit: **0,082 desta fase, 0,036 da Fase 25B, e o commit base já entrava a 2,5% do teto**. Nenhuma fase sozinha é dona, e por isso a decisão tomada foi **regressão declarada com fase própria** (D-25C-02). Nenhuma banda foi afrouxada e nenhuma constante foi movida por causa dela. Investigação completa em `docs/diagnostics/25C-baron-no-spawn.md`.

**A hipótese pública de que `POST_FIGHT_OBJECTIVE_W` era a causa foi REFUTADA por quatro medições independentes**, e o registro fica aqui porque a alavanca continua no código: desligá-la por inteiro devolve **0,010 de 0,118** e o gate segue vermelho com ela em zero; a grade inteira de W é plana e nem monotônica; o commit que a introduziu move a métrica em **mais 0,002** contra mais 0,066 e mais 0,026 dos outros dois; e a alta está **inteiramente na população contestada**, que é a população que `baronSetupSufficient` não gateia.

### O gate de ritmo passou a ter TRÊS EIXOS

**Ele cresceu de 14 para 15 bandas vermelhas sem que nenhuma banda pré-existente mudasse de piso, de teto ou de cor.** A onda 2 da Fase 25C acrescentou **seis** linhas novas, das quais **duas nasceram vermelhas de propósito** (DEC-02).

| eixo | quem trouxe | o que ele mede |
|---|---|---|
| **NÍVEL** | Fases 23 a 25 | onde a distribuição está centrada: duração, torres por minuto, primeira torre, abates por minuto |
| **DISPERSÃO e FORMA** | Fase 25B | como a distribuição se espalha e que formato ela tem: coeficientes de variação, shutout, vitória por uma rota, bimodalidade |
| **ACOPLAMENTO** | **Fase 25C** | se um evento **puxa** o outro: lift temporal entre pares de eventos, com IC95 por bootstrap por partida |

**São SEIS linhas de banda e não três**, porque cada par paga a banda do VALOR **e** o assert próprio do **IC95 inferior contra o piso absoluto de 1,050**. Uma banda que avaliasse só o ponto aceitaria um lift alto com IC largo cruzando o viés do próprio instrumento.

**As duas bandas vermelhas com dono Fase 25C ao fechar, nominalmente:**

| banda | medido | banda | por que não fechou |
|---|---|---|---|
| `ACOPLAMENTO P1` gank, depois torre na mesma rota | **1,476** | `[1,832; 2,250]` | a alavanca satura e aumentar a força piora, porque todas competem pela mesma massa de peso normalizada. **A região de fechamento NÃO ESTÁ ESTABELECIDA**: em T1 a razão bateu o piso em uma de quatro amostras disjuntas, e o instrumento não tem poder no N do gate (D-25C-06 e D-25C-07) |
| `ACOPLAMENTO P3` luta ganha, depois objetivo épico | **1,296** | `[1,503; 1,750]` | região **VAZIA** por grade de dezesseis pontos, máximo 1,364, movimento máximo de mais 0,3% contra os mais 15% exigidos. Fronteira de **MODELO** (D-25C-06) |

**A banda de preservação P2 FECHOU** (2,013 contra o piso 1,951), e ela é a que pegou o par sendo empurrado sem querer numa onda intermediária. **Os três asserts de IC95 inferior passam** (1,151, 1,904 e 1,208 contra 1,050).

**Duas ressalvas registradas sem suavizar:**

- **A suíte fecha em 944 verdes e ZERO vermelhos, em 58 de 58 arquivos.** O vermelho de asserção que a Fase 25B deixou (D-25B-01) está verde, **mas por deslocamento de trajetória e não por conserto**: a causa (`resolveHeraldUse` emitindo `tower_low` no lugar de `inhibitor_destroyed`) não foi tratada, e **o item continua aberto com o dono dele**.
- **`abates totais por partida` subiu de 38,68 para 39,33.** É derivada observada, já estava fora da banda `[22; 34]`, e o dono é a Fase 26. Não é entrega nem regressão de banda desta fase.

**Artefato novo desta fase, fora da cadeia de gates:**

| Script npm | Config | O que mede |
|---|---|---|
| `npm run probe:lift` | `vitest.probe-lift.config.ts` | **Sonda de observação, sem nenhum assert e fora de `calibrate:all`.** Mede a MATRIZ DE LIFT (acoplamento temporal entre pares de eventos) com os três estimadores do nulo, IC95 por bootstrap com a **partida** como cluster, e Benjamini-Hochberg nos pares exploratórios. Mede também **aridade em draws por TICK** e a distribuição de tipo de evento. `LIFT_N` e `LIFT_TAG` controlam N e o nome do relatório, em `tmp/lift-{TAG}.txt` (Fase 25C) |

Nenhum dos sete gates termina por estouro de tempo. O relatório completo de fechamento da fase está em `docs/diagnostics/25C-relatorio-da-fase.md`, e a investigação do nulo pareado por rota em `docs/diagnostics/25C-acoplamento-rota.md`.
