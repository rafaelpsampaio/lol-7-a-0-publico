# Fase 25B: relatorio de fechamento

**Data:** 2026-07-30
**Fase:** 25B-forma-da-distribuicao-estrutural
**Plano de origem:** 25B-07 (fechamento)
**Commit base da fase, usado nas provas por diff:** `8721866` (`roadmap: insere a Fase 25C, causalidade entre eventos`)
**Como o commit base foi obtido:** **LIDO** de `docs/diagnostics/25B-ancoragem.md`, Bloco 1, arquivo versionado pela onda 1. **Nao deduzido.** A razao esta na secao 7 deste relatorio e ela nao e formalidade.
**Ultima mudanca de producao da fase:** `ec91483` (ponto de operacao da concentracao de rota em `T` = 9). Depois dela `src/sim/` so recebeu snapshot.
**Arvore no momento da medicao:** `b4ccad9` (`docs(25B-06): fecha a onda da regeneracao deliberada unica do golden`)

**Comandos de medicao, todos rodados por inteiro neste plano:**

```bash
npm run calibrate:all            # os sete gates, sem curto-circuito   -> tmp/all-25B-07.txt
npm run diagnose                 # o painel amplo, N = 1500 por cenario -> docs/diagnostics/engine-diagnose.txt
npm run probe:shape              # a sonda de forma, N = 800 por tier   -> tmp/shape.txt
npx vitest run --testTimeout=60000                                      # -> tmp/suite-25B-07.txt
node tmp/verify-25B-diff.cjs     # as provas por diff do criterio 5     -> tmp/diff-proof-25B.txt
```

Nenhum dos sete gates, nem o painel, nem a sonda, nem a suite terminou por estouro de tempo. Todo desfecho e por assercao nomeada ou por relatorio completo.

---

## BASE DE COMPARACAO, declarada antes de qualquer numero

Esta fase tem **duas** bases de comparacao e as duas importam ao mesmo tempo, porque a pergunta que ela responde e dupla: **a forma voltou** e **o nivel ficou**.

| coluna | de onde vem | harness | fixture | N |
| --- | --- | --- | --- | --- |
| **baseline oficial da v2.2** | `docs/baselines/24-baseline-v2.2.md`, congelado ao fim da Fase 24 | `npm run diagnose` | Cenario A sintetico equilibrado 75 contra 75 | 1500 |
| **pre-Fase-25 (forma e dispersao)** | `docs/diagnostics/25B-ancoragem.md`, Blocos 2 e 5, motor reconstruido por `git checkout a24ea23 -- src/sim/` | `npm run probe:shape` | EQUILIBRADO 75 contra 75 | 800 |
| **fim da Fase 25** | `docs/diagnostics/25-relatorio-da-fase.md` e `docs/diagnostics/25-sweep.md` secao 7 | `diagnose` e `calibrate:pace` | os mesmos das linhas acima | 1500 e 800 |
| **hoje (fim da Fase 25B)** | este relatorio | `calibrate:pace`, `probe:shape` e `diagnose` | os mesmos | 800 e 1500 |

**O diagnostico de abertura da milestone, de 2026-07-28, NUNCA e usado aqui como base.** Ele foi medido sobre uma engine com tres rotas estruturalmente excluidas de receber assistencia, e corrigir aquele defeito ja foi, por si so, uma mudanca de calibracao. Comparar contra ele atribuiria a esta fase um efeito que veio da Fase 24.

**As duas leituras de N nao devem ser somadas nem cruzadas linha a linha.** Linhas marcadas `(pace)` ou `(sonda)` sao N = 800 no tier EQUILIBRADO; linhas do painel amplo sao N = 1500 no Cenario A. O baseline oficial ja separa as duas do mesmo jeito.

**A ancoragem de dispersao foi RECONSTRUIDA e VALIDADA antes de ser usada:** sete dos coeficientes ja congelados foram reproduzidos com desvio maximo de **1,87 por cento** contra uma tolerancia declarada de 12 por cento, o que autorizou usar as tres entradas que a reconstrucao mediu pela primeira vez (`torres totais`, `torres por minuto`, `ouro por minuto`).

---

## O VEREDITO DA FASE, sem suavizar

**A Fase 25B recebeu tres defeitos da Fase 25 e o desfecho de cada um e diferente. Nao ha um veredito unico, e escrever um seria mentir por arredondamento.**

**1. COLAPSO DO NUMERADOR: RESOLVIDO.**

| leitura | fim da Fase 25 | **hoje** |
| --- | --- | --- |
| vencedor no maximo do contador | 0,908 | **0,134** |
| vitoria exigiu limpar as TRES rotas | 0,908 | **0,134** |
| bimodalidade das torres do vencedor | 0,785 **BIMODAL** | **0,441 unimodal** |
| dispersao das torres do vencedor (razao contra a ancoragem) | 0,202 | **0,921** |

No golden, as torres do vencedor eram **9 em 15 de 15 blocos** e passaram a distribuir em **3, 5, 7, 8 e 9**, com media de 9,00 para 7,07. Isso e a mesma assinatura medida por um instrumento **independente** do gate.

**2. VIOLACAO DO INVARIANTE de `src/sim/structures.test.ts:4-9`: MUITO MELHOR, NAO FECHADA.**

A vitoria por **uma** rota foi de **0,026 para 0,366**, ou seja **catorze vezes**, contra um piso de **0,500**. Ela parou onde a regra dura de plausibilidade manda parar: a faixa que fecharia a banda (`T` menor ou igual a 6,5) viola `primeira torre antes de 7:00` no tier PRO-GAP. **E fronteira do MODELO, nao de instrumento.** A distincao importa porque a outra fronteira desta fase, a de `torres/min`, era de instrumento e **dissolveu** quando o contador foi lido direito.

**3. SHUTOUT: NAO FECHA COM O TERMO DE VANTAGEM EM FAIXA VALIDA NENHUMA, E O NUMERO ANDOU PARA TRAS.**

**O shutout PIOROU: de 0,449 no fechamento da Fase 25 para 0,497 hoje.** Esta frase esta escrita sem amortecimento porque amortece-la seria pior que o proprio numero. A fase **recebeu** este defeito, **tentou** conserta-lo, **mediu por que nao conseguia** e o numero **andou para tras**. Isso e resultado, e resultado negativo medido vale mais que resultado positivo alegado.

Provado por grade de **nove tetos**, de 4,0 a 1,0, com o piso da grade justificado por **mecanismo** e nao por gosto. O shutout mede **0,497** hoje e **0,201** no piso legitimo da grade, contra um teto de banda de **0,120**. A fronteira esta medida **dos dois lados**, com **0,1 de largura**: teto 1,5 valido, teto 1,4 invalido. **Dono a definir (D-25B-05).**

---

## ACEITE FINAL HUMANO: APROVADO, com o criterio 3 declarado EM ABERTO

**Data:** 2026-07-30. **O desenvolvedor aprovou o fechamento nos dois pontos submetidos.**

### Decisao 1: fechar a fase com o criterio 3 NAO ATENDIDO, e isso e desfecho MEDIDO e nao desistencia

**O raciocinio, registrado junto do fechamento e nao em nota de rodape:**

> A fase provou, por **grade de nove tetos**, com o **piso justificado por mecanismo** e a **fronteira medida dos dois lados**, que a alavanca disponivel **nao alcanca o shutout em faixa valida nenhuma**. **Nao se fecha o que a alavanca nao alcanca**, e insistir seria procurar **mecanismo novo**, que e escopo de outra fase.

**O criterio 3 fica NAO ATENDIDO.** A distincao entre as duas leituras possiveis importa e esta escrita: **desistencia** e parar sem saber por que; **desfecho medido** e parar sabendo exatamente onde a fronteira esta, com numero dos dois lados dela e com a razao mecanica de ela existir. Este e o segundo caso, e o registro que sustenta isso e a secao 1 (criterio 3), a secao 8 e o item D-25B-05.

### Decisao 2: o contador de torres do Nexus tem DONO, e ele e a Fase 30

**D-25B-07 recebe dono: Fase 30, na revisao em bloco.** O argumento decisivo, nas palavras que o justificam:

> Corrigir o contador **no motor** move **quatro bandas de torre de uma vez** (`torres por minuto`, `torres aos 20:00`, `torres totais` e a `razao de torres`), e faze-lo **dentro da Fase 25B** a tornaria **juiza do proprio criterio 4**, que e precisamente o criterio que proibe devolver o nivel.

A Fase 30 e o lugar certo porque ela ja tem criterio para tratar **re-ancoragem de banda em conjunto**, e porque ela ja e a dona proposta de D-25-04 e de D-25B-03, que sao o mesmo assunto visto de outros dois angulos.

---

## O QUE A FASE 26 PRECISA SABER ANTES DE COMECAR

**Bloco de destaque, e nao nota de rodape, porque esta e a informacao que evita a Fase 26 descobrir tarde.**

**A folga do criterio 4 foi quase toda consumida, e a duracao TROCOU DE LADO APERTADO.**

| banda | lado apertado no fim da Fase 25 | lado apertado hoje | folga consumida |
| --- | --- | --- | --- |
| **duracao media** | **teto**, folga **0,419 min** | **PISO, folga 0,987 min** | **trocou de lado**: antes o risco era a partida ser longa demais, hoje e ser curta demais |
| **mediana da primeira torre** | piso, folga 165 s | piso, folga **60 s** | **64 por cento** |
| **placas por partida** | teto, folga 1,340 | teto, folga **0,725** | **46 por cento** |
| torres aos 20:00 | teto, folga 0,207 | teto, folga 0,240 | devolveu 0,033 |
| torres por minuto | piso, folga 0,026 | piso, folga 0,057 | devolveu 0,031 |

**A Fase 26 vai cortar cerca de 40 por cento dos abates, e entra com MENOS DE UM MINUTO de margem contra o piso de duracao.** Cortar volume de combate tende a encurtar a partida, ou seja empurra a duracao **na direcao do lado que hoje esta apertado**. A leitura de 6,013 minutos de folga contra o **teto** e verdadeira e **irrelevante** para a Fase 26: o que a limita e o piso.

**Duas consequencias praticas, escritas para quem sequenciar:**

1. **A derivada `fracao abaixo de 25 minutos` ja esta FORA pelo teto** (29,2 por cento contra a banda `[1; 12]`, item D-25B-10). Ela e o sintoma antecipado do mesmo aperto: a media ainda esta dentro, mas a cauda curta ja engrossou.
2. **O conserto medido e nao aplicado do `BC do perdedor` (teto 1,75) consumiria 72 por cento da folga de duracao e 83 por cento da folga de razao de torres.** Se ele for adotado, tem de ser **depois** da Fase 26 e com a grade **re-medida**, nunca antes.

---

## O ACHADO QUE NAO ERA OBJETIVO DA FASE: o erro de especificacao do contador de torres

**Registrado com o mesmo peso dos tres acima, porque ele muda a leitura de quatro bandas e existia desde a Fase 23.**

**O erro.** A referencia externa das bandas de torre vem de partidas pro reais. Uma partida de LoL tem **onze** torres por lado, incluindo as duas do Nexus, e uma partida que termina tem as duas do Nexus do perdedor destruidas: **a referencia sempre contou as duas**. O contador `towersDestroyed` **nunca** contou, porque o ramo de torre do Nexus de `damageStructure` e o unico ramo de queda de torre que nao chama `recordTower()` (D-25-04). Quatro bandas comparavam um contador de **nove** contra uma referencia de **onze**, por tres fases seguidas.

**A correcao foi na LEITURA DO HARNESS, com `src/sim/` intocado.** Isso foi decisao de desenho e nao conveniencia: corrigir o contador no motor deslocaria o golden e misturaria a correcao de instrumento com a mudanca de comportamento da onda 3 no **mesmo** deslocamento, destruindo a atribuicao do diff da onda 6.

**A validacao, e ela e o que fecha o assunto:** sob a contagem completa, no momento da correcao, o vencedor destruia **9,19** torres por partida contra a referencia de pro play de **9,15**. Um erro de leitura de instrumento nao produz coincidencia de duas casas decimais contra uma fonte externa.

**A leitura de hoje, que e diferente e precisa estar escrita:** no ponto de operacao final (`T` = 9) o vencedor destroi **8,40** torres pela contagem completa e **6,40** pelo contador de nove, contra a referencia de 9,15. **O nivel do vencedor hoje esta ABAIXO da referencia**, e nao acima.

**AS DUAS LEITURAS, LADO A LADO, e a licao esta na frase e nao no numero:**

| momento | vencedor, contagem completa | referencia externa | leitura |
| --- | --- | --- | --- |
| **momento da correcao** (`T` = 14) | **9,19** | **9,15** | bate na segunda casa decimal, e e o que **valida** a correcao |
| **hoje**, ponto de operacao final (`T` = 9) | **8,40** | **9,15** | **ABAIXO da referencia** |

> **Reportar so a leitura favoravel seria escolher o numero.** A validacao de 9,19 contra 9,15 e legitima e prova o que se propos a provar (um erro de leitura de instrumento nao produz coincidencia de duas casas decimais contra fonte externa), mas ela **vale para o momento em que a correcao foi feita** e nao para o estado final. As duas ficam no relatorio, juntas, porque a segunda nao anula a primeira e a primeira nao dispensa a segunda.

**Piso e teto das quatro bandas NAO mudaram de valor.** A referencia externa nao mudou: mudou a metrica passar a medir a mesma coisa que a referencia mede. As duas bandas de **dispersao** afetadas **precisaram** ser re-ancoradas, e a re-ancoragem esta declarada, porque somar quantidade quase constante comprime o coeficiente de variacao e comparar contra a ancoragem antiga mediria **definicao** em vez de **motor** (`torres totais` 0,3015 para 0,2407, `torres por minuto` 0,2103 para 0,1648).

---

## 1. Os cinco criterios de sucesso do roadmap

Cada bloco traz o numero medido, a banda e o veredito. Onde o criterio e sobre **diff** e nao sobre numero, o veredito vem da verificacao automatizada da secao 7.

### Criterio 1: a onda 1 e instrumento, nao motor. **ATENDIDO**

| exigencia do roadmap | medido | veredito |
| --- | --- | --- |
| existe banda de dois lados sobre coeficiente de variacao | **onze** bandas em `scripts/calibrate-pace.ts`, todas com piso, teto, fonte e dono obrigatorios | **ATENDIDO** |
| ancorada no estado pre-Fase-25 | tabela de ancoragem em `docs/diagnostics/25B-ancoragem.md`, medida por reconstrucao `git checkout a24ea23 -- src/sim/` | **ATENDIDO** |
| cobre duracao, abates totais, torres do vencedor, torres do perdedor e ouro dos dois lados | cobre as seis exigidas mais `torres totais`, `torres por minuto`, `primeira torre`, `ouro por minuto` e a `fracao de comeback` | **ATENDIDO com folga** |
| o teto e escolhido **por medicao na propria onda 1**, nunca herdado | teto **2,00**, o menor multiplo de 0,25 estritamente acima do maior aumento de dispersao ja classificado como legitimo na milestone (`baroes por jogo`, 1,954) | **ATENDIDO** |
| o valor ilustrativo de 1,60 nao pode ser adotado | **RECUSADO por medicao**: reprovaria `baroes por jogo` (1,954, dispersao saudavel pela propria fonte) e `torres do perdedor` (1,731, confirmado em dois harnesses), esta ultima **pelo diagnostico errado**, porque o que inflou a dispersao dela e a segunda pilha do shutout e nao ruido | **ATENDIDO** |

**A onda 1 entregou mais do que o criterio pedia, e o excedente e o que importa:** ela mediu **quatro** colapsos onde D-25-07 tinha achado **dois**. As duas novas (`torres totais` 0,709 e `torres por minuto` 0,504) so puderam ser vistas porque a onda mediu, pela primeira vez, coeficientes que **nao constavam do baseline congelado**.

### Criterio 2: o numerador volta a variar. **PARCIAL, quatro de cinco**

| sub-criterio | banda | pre-Fase-25 | fim da Fase 25 | **hoje** | veredito |
| --- | --- | --- | --- | --- | --- |
| dispersao das torres do vencedor | razao dentro de `[0,750; 2,000]` | 1,000 | 0,202 | **0,921** | **ATENDIDO**, folga 0,171 do piso |
| bimodalidade das torres do vencedor | abaixo de 0,5556 | 0,459 | 0,785 | **0,441** | **ATENDIDO**, folga 0,115 |
| vencedor no maximo do contador | abaixo de 0,250 | 0,040 | 0,908 | **0,134** | **ATENDIDO**, folga 0,116 |
| vitoria exigiu limpar as TRES rotas | abaixo de 0,350 | 0,040 | 0,908 | **0,134** | **ATENDIDO**, folga 0,216 |
| **vitoria com exatamente UMA rota limpa** | `[0,500; 0,800]` | 0,583 | 0,026 | **0,366** | **NAO ATENDIDO**, faltam **0,134** |

**O que faltou e onde esta a fronteira, com numero.** A metrica subiu **catorze vezes** e parou. Ela so entra na banda com temperatura de concentracao `T` menor ou igual a **6,5**, e essa faixa inteira esta **proibida por regra dura**: `primeira torre antes de 7:00` no tier PRO-GAP mede **1 em 800** nos tetos `T` = 4, 5, 6, 6,5 e 7, e volta a **0** apenas a partir de `T` = 8. Uma segunda trava aparece em `T` = 8: a banda `Baron no spawn` (dono Fase 19), que **estava verde**, mede 0,250 contra o teto 0,240 e volta a passar em `T` = 9. **`T` = 9 e o menor valor que satisfaz as duas.**

**Esta e fronteira de MODELO.** Concentrar dano numa rota acelera a primeira queda, e o tier de gap ja e o que chega mais cedo. Fechar a banda exige alavanca fora do canal absoluto, e o plano da onda 3 foi explicitamente instruido a nao procurar uma terceira alavanca.

### Criterio 3: o shutout volta a ser raro. **NAO ATENDIDO**

| sub-criterio | banda | pre-Fase-25 | fim da Fase 25 | **hoje** | veredito |
| --- | --- | --- | --- | --- | --- |
| **fracao de shutout** | abaixo de 0,120 | 0,179 | 0,449 | **0,497** | **NAO ATENDIDO**, **4,14 vezes o teto** |
| fracao de 9 a 0 exatos | abaixo de 0,050 | 0,001 | 0,209 | **0,029** | **ATENDIDO**, folga 0,021 |
| razao de torres no EQUILIBRADO | `[2,500; 4,500]` | 1,487 (baseline) | 3,393 | **3,689** | **ATENDIDO** |
| bimodalidade das torres do vencedor | abaixo de 0,5556 | 0,459 | 0,785 | **0,441** | **ATENDIDO** |
| **bimodalidade das torres do perdedor** | abaixo de 0,5556 | 0,442 | 0,649 | **0,606** | **NAO ATENDIDO**, por 0,050 |

**O shutout PIOROU em relacao ao fim da Fase 25 (0,449 para 0,497), e isso esta escrito e nao arredondado.** A causa esta medida: a concentracao de rota nao toca o shutout em faixa nenhuma (entre 0,423 e 0,507 de `T` = 2 a `T` = 30), e o encurtamento da partida reduz o tempo em que o perdedor pode reagir. O autor do shutout continua sendo o **termo de vantagem** do plano 25-06, atribuicao confirmada duas vezes.

**A FRONTEIRA, medida dos dois lados por grade de nove tetos:**

| lado | teto | numeros |
| --- | --- | --- |
| **ultimo teto VALIDO** | **1,5** | razao de torres 2,545 (a 0,045 do piso), duracao 35,34 (a 0,66 do teto). **shutout 0,289, ou 2,41 vezes o teto da banda** |
| **primeiro teto INVALIDO** | **1,4** | razao de torres **2,468 FORA**, duracao **36,18 FORA**. **shutout 0,271, ou 2,26 vezes o teto da banda** |
| **piso legitimo da grade** | **1,0** | shutout **0,201**, com tres bandas de nivel ja fora (razao 2,144, duracao 38,62, torres/min 0,295) |

**A largura da fronteira e 0,1 de teto**, e dentro dela `razao de torres` e `duracao` quebram praticamente juntas. **Isso nao e coincidencia:** o teto do termo e o que faz o vencedor **separar**, e separar menos produz ao mesmo tempo razao menor e partida mais longa. **Nao existe teto que compre uma sem pagar a outra.**

**Por que a grade para em 1,0, e a razao e de MECANISMO.** A forma fechada e `min(teto, max(piso, (2 * participacao) ^ expoente))`, e na paridade a participacao vale 0,5 **por identidade**, o que da bruto exatamente 1. Com teto abaixo de 1,0 o termo passa a valer menos que 1 **tambem na paridade**, ou seja reduz o throughput do canal uniformemente para os dois lados, que e literalmente o **decaimento testado e refutado** na secao 2 de `25B-sweep.md`. Descer abaixo de 1,0 seria reintroduzir por uma porta lateral o mecanismo que a fase ja descartou com numero.

**A extrapolacao, declarada como extrapolacao:** levar o shutout a 0,120 exigiria teto de aproximadamente **0,66**, fora da grade por **dois** motivos independentes.

**O que a onda 5 CONSEGUIU, registrado junto:** a bimodalidade das torres do perdedor **ENTRA** a partir do teto 2,0 e mede **0,522** no teto 1,75, com o gate de ritmo caindo de 14 para 10 vermelhas e **nenhuma banda verde virando vermelha**. **Esse conserto esta medido e disponivel e NAO foi aplicado**, por decisao de sequenciamento tomada em checkpoint humano: ele custaria **72 por cento da folga de duracao** e **83 por cento da folga de razao de torres**, as vesperas de a Fase 26 mexer nessas duas grandezas, num criterio que fica aberto de todo jeito.

### Criterio 4: o nivel conquistado pela Fase 25 nao e devolvido. **ATENDIDO, cinco de cinco**

| banda do criterio 4 | banda | fim da Fase 25 | **hoje** | folga contra o lado apertado | veredito |
| --- | --- | --- | --- | --- | --- |
| torres por minuto | `[0,300; 0,450]` | 0,326 | **0,357** | 0,057 do piso | **DENTRO** |
| torres aos 20:00 | `[2,500; 5,000]` | 4,793 | **4,760** | **0,240 do teto** | **DENTRO** |
| mediana da primeira torre (s) | `[780; 1140]` | 945 | **840** | **60 s do piso** | **DENTRO** |
| placas por partida | `[5,000; 12,000]` | 10,660 | **11,275** | **0,725 do teto** | **DENTRO** |
| duracao media (min) | `[29; 36]` | 35,581 | **29,987** | **0,987 do piso** | **DENTRO** |

E as duas que nao estao no criterio 4 mas tem dono Fase 25:

| banda | banda | fim da Fase 25 | **hoje** | folga |
| --- | --- | --- | --- | --- |
| razao de torres vencedor sobre perdedor | `[2,500; 4,500]` | 3,393 | **3,689** | 0,811 do teto |
| fracao no teto de 60 minutos | `[0; 0,005]` | 0,006 **FORA** | **0,000** | **ENTROU** |

#### Quanto de folga a fase consumiu, e este numero e o insumo direto da Fase 26

**A fase nao consumiu folga de forma uniforme: ela MOVEU a folga da duracao de um lado da banda para o outro.**

| banda | lado apertado no fim da Fase 25 | lado apertado hoje | leitura |
| --- | --- | --- | --- |
| **duracao** | teto, folga **0,419 min** | **piso, folga 0,987 min** | a fase trocou o lado do risco. Antes o risco era a partida ser longa demais; hoje e ser curta demais |
| **mediana da primeira torre** | piso, folga 165 s | piso, folga **60 s** | **consumiu 105 s, ou 64 por cento da folga** |
| **placas** | teto, folga 1,340 | teto, folga **0,725** | **consumiu 0,615, ou 46 por cento da folga** |
| torres aos 20:00 | teto, folga 0,207 | teto, folga 0,240 | devolveu 0,033 |
| torres por minuto | piso, folga 0,026 | piso, folga 0,057 | devolveu 0,031, **mas ver a ressalva abaixo** |

**A RESSALVA de `torres por minuto`, que nao pode ficar de fora.** A banda so passa sob a **contagem completa**, que e a leitura corrigida nesta fase. Sob o contador de nove, a mesma metrica mede hoje **0,2843**, ou seja **FORA pelo piso de 0,300**. Piso e teto **nao mudaram de valor**, e a mudanca foi tornar a metrica comparavel com a referencia que ja contava onze torres. Registrar so o 0,357 sem esta linha faria a leitura de nivel parecer mais folgada do que ela e sob a leitura antiga.

**A conclusao para a Fase 26, em uma frase:** a folga de duracao contra o **teto** subiu de 0,419 para 6,013 minutos, e a folga contra o **piso** e de apenas 0,987. **A Fase 26 corta cerca de 40 por cento dos abates**, o que tende a encurtar mais, e o espaco dela e menos de um minuto antes de derrubar a banda pelo piso.

### Criterio 5: nenhuma regra dura cedeu e o determinismo por semente e preservado. **ATENDIDO**

| exigencia | medido | veredito |
| --- | --- | --- |
| regras da v2.0 em zero absoluto nos seis tiers | `Baron antes de 20:00` **0** nos 6, `primeira torre antes de 7:00` **0** nos 6, `queda cross-lane simultanea` **0** nos 3, `p5 da 1a torre no EQUILIBRADO` **615 s** contra o piso duro de 300 s, violacoes de plausibilidade do painel **0 / 0 / 0 / 0** | **ATENDIDO, zero absoluto** |
| `rng(` em `src/sim/` segue em **72** | **72 na base e 72 hoje**, delta zero em todos os 15 arquivos que consomem o gerador | **ATENDIDO** |
| gate `if (force <= 0.18 \|\| rng() > force) return null;` byte a byte intacto | **1 ocorrencia** na base e **1** hoje, literal identico | **ATENDIDO** |
| canarios de aridade verdes | `engine.test.ts`, `selection.test.ts` e `golden.test.ts` inteiros verdes | **ATENDIDO** |
| no maximo **uma** regeneracao de golden, em commit isolado, com diff estruturado em quatro dimensoes aprovado antes | **uma** regeneracao (plano 25B-06), **dois** commits de snapshot com **exatamente um arquivo cada**, relatorio commitado **antes** com a arvore de snapshots limpa | **ATENDIDO** |

**Provas por diff completas na secao 7.** Os sete itens passam.

---

## 2. A tabela de FORMA, nas tres colunas

Tier **EQUILIBRADO** (75 contra 75, gap **zero**), N = 800, mesma fixture e mesmo instrumento nas tres colunas.

| metrica de forma | **pre-Fase-25** | **fim da Fase 25** | **hoje (fim da 25B)** | banda | veredito |
| --- | --- | --- | --- | --- | --- |
| vencedor no maximo do contador (9 torres) | 0,040 | 0,908 | **0,134** | `[0,010; 0,250]` | **DENTRO** |
| vitoria exigiu limpar as TRES rotas | 0,040 | 0,908 | **0,134** | `[0,010; 0,350]` | **DENTRO** |
| **vitoria com exatamente UMA rota limpa** | 0,583 | 0,026 | **0,366** | `[0,500; 0,800]` | **FORA pelo PISO** |
| **shutout (perdedor com 0 ou 1 torre)** | 0,179 | 0,449 | **0,497** | `[0,020; 0,120]` | **FORA pelo TETO** |
| exatamente 9 a 0 | 0,001 | 0,209 | **0,029** | `[0,000; 0,050]` | **DENTRO** |
| bimodalidade das torres do VENCEDOR | 0,459 | 0,785 | **0,441** | `[0,250; 0,5556]` | **DENTRO** |
| **bimodalidade das torres do PERDEDOR** | 0,442 | 0,649 | **0,606** | `[0,250; 0,5556]` | **FORA pelo TETO** |
| perdedor em ZERO torres (contexto, sem banda) | 0,078 | 0,229 | **0,159** | sem banda | observada |

**Histograma da contagem de rotas do perdedor limpas por inteiro**, lido de `LaneStructures` do estado final e nunca inferido da timeline:

| rotas limpas | pre-Fase-25 | fim da Fase 25 | **hoje** |
| --- | --- | --- | --- |
| 0 | 1,0 por cento | 0,0 por cento | **0,0 por cento** |
| **1** | **58,3 por cento** | **2,6 por cento** | **36,6 por cento** |
| 2 | 36,8 por cento | 6,6 por cento | **50,0 por cento** |
| **3** | **4,0 por cento** | **90,8 por cento** | **13,4 por cento** |
| media de rotas limpas | 1,438 | 2,881 | **1,768** |

**A leitura do histograma e mais informativa que qualquer fracao isolada.** No fim da Fase 25 a distribuicao tinha **uma pilha unica em 3 rotas** com 90,8 por cento. Hoje a moda e **2 rotas** com 50,0 por cento, e as tres classes tem massa. A forma deixou de ser degenerada. O que ela **nao** fez foi voltar ao formato pre-fase, onde a moda era **1 rota**.

### A mesma tabela no tier GAP-LEVE, como OBSERVACAO: o conserto GENERALIZOU

Tier GAP-LEVE (80 contra 70), N = 800. **Nunca vira banda nesta fase.** A coluna existe para responder se o conserto acertou o motor ou apenas o tier onde a banda mora.

| metrica de forma | pre-Fase-25 | fim da Fase 25 | **hoje** | direcao |
| --- | --- | --- | --- | --- |
| vencedor no maximo do contador | 0,408 (contexto) | 0,963 | **0,276** | **melhorou** |
| vitoria exigiu limpar as TRES rotas | n/d | 0,963 | **0,276** | **melhorou** |
| vitoria com exatamente UMA rota limpa | n/d | 0,011 | **0,218** | **melhorou** |
| shutout | 0,408 | 0,703 | **0,731** | **piorou** |
| exatamente 9 a 0 | n/d | 0,416 | **0,136** | **melhorou** |
| bimodalidade das torres do VENCEDOR | 0,475 | 0,817 | **0,522 unimodal** | **melhorou** |
| bimodalidade das torres do PERDEDOR | n/d | 0,799 | **0,629** | melhorou, segue bimodal |

**O conserto do numerador generalizou sem excecao:** as cinco metricas que dependem de quantas rotas o vencedor precisa limpar melhoraram nos dois tiers. **O shutout nao generalizou e piorou nos dois**, o que e coerente com a atribuicao: ele e do termo de vantagem e nao do canal.

**A ressalva da onda 1 continua valendo e nao pode ser esquecida:** no pre-fase o GAP-LEVE **ja tinha shutout de 40,8 por cento** com o vencedor ainda unimodal. **Gap produz assimetria sozinho.** Cobrar daquele tier menos que isso seria cobrar o que nunca existiu.

---

## 3. A tabela de DISPERSAO, as onze linhas do eixo novo

Banda `[0,750; 2,000]` sobre a razao entre o coeficiente de variacao medido hoje e o do motor pre-Fase-25, avaliada **somente** no tier EQUILIBRADO, porque a ancoragem foi medida em fixture de gap zero.

| metrica | CV de ancoragem | CV medido hoje | **razao** | banda | dono | veredito |
| --- | --- | --- | --- | --- | --- | --- |
| duracao | 0,1596 | 0,2364 | **1,481** | `[0,750; 2,000]` | Fase 30 (vigia) | dentro |
| abates totais | 0,2680 | 0,4713 | **1,759** | `[0,750; 2,000]` | Fase 30 (vigia) | dentro |
| **torres do vencedor** | 0,2803 | 0,2581 | **0,921** | `[0,750; 2,000]` | **Fase 25B** | **ENTROU** (era 0,202) |
| torres do perdedor | 0,5624 | 0,9095 | **1,617** | `[0,750; 2,000]` | Fase 30 (vigia) | dentro |
| **torres totais** | 0,2407 | 0,2612 | **1,085** | `[0,750; 2,000]` | Fase 30 (vigia) | **ENTROU** (era 0,710) |
| **torres por minuto** | 0,1648 | 0,1350 | **0,819** | `[0,750; 2,000]` | **Fase 25B** | **ENTROU** (era 0,504) |
| **primeira torre** | 0,2539 | 0,1372 | **0,540** | `[0,750; 2,000]` | **Fase 25B** | **FORA pelo PISO**, faltam 0,210 |
| ouro final do vencedor | 0,1952 | 0,2798 | **1,433** | `[0,750; 2,000]` | Fase 30 (vigia) | dentro |
| ouro final do perdedor | 0,2326 | 0,3015 | **1,296** | `[0,750; 2,000]` | Fase 30 (vigia) | dentro |
| ouro por minuto por time | 0,0774 | 0,0852 | **1,101** | `[0,750; 2,000]` | Fase 30 (vigia) | dentro |
| **fracao de comeback** (banda sobre o VALOR) | 0,651 | **0,315** | n/a | `[0,400; 0,600]` | Fase 30 (DOCS-01), **PROVISORIA** | **FORA pelo PISO** |

**Placar: dez das onze dentro, uma fora, mais a linha provisoria de comeback tambem fora. Nenhuma reprovou pelo TETO.** Isso e o comportamento correto de uma guarda contra explosao: ela nasceu sem morder nada e existe para as quatro fases que ainda vao apertar nivel.

### As duas que colapsaram na Fase 25 e o que aconteceu com elas

| metrica | ancoragem | fim da Fase 25 | **hoje** | movimento |
| --- | --- | --- | --- | --- |
| **torres do vencedor** | 1,000 | **0,202** | **0,921** | **4,6 vezes**, ENTROU |
| **torres por minuto** | 1,000 | **0,504** | **0,819** | **1,6 vezes**, ENTROU |
| **torres totais** (achado da onda 1) | 1,000 | **0,709** | **1,085** | ENTROU |
| **primeira torre** | 1,000 | **0,543** | **0,540** | **PARADA em tres casas decimais** |

**A linha da primeira torre e o achado negativo da fase e ela tem item proprio (D-25B-04).** Ela nao se moveu em **nenhum** dos dois mecanismos implementados: 0,543 no fechamento da Fase 25, 0,543 sob o decaimento refutado, **0,540** sob a concentracao em `T` = 9. O argumento mecanico fecha com o numero: a primeira torre cai **antes** de qualquer rota estar limpa e **antes** de a pressao diferenciar as rotas, e os dois mecanismos valem exatamente 1 naquele instante **por identidade**.

**A onda 5 acrescentou o que faltava para o item deixar de ser misterio:** a grade de teto do termo de vantagem mostra que ela **responde** ao teto, monotonicamente, de 0,540 a **0,770**. Mas ela **so entra na banda no teto 1,0**, que e o piso legitimo da grade e elimina tres bandas de nivel ao mesmo tempo. **A alavanca existe e e inutilizavel**, o que muda a natureza do item: ele deixa de ser "nao sabemos o que a move" e passa a ser "sabemos o que a move, e o preco e proibitivo".

---

## 4. Metricas derivadas: OBSERVADAS, nunca metas desta fase

**Nenhuma linha desta tabela e meta atingida pela Fase 25B**, e nenhuma pode ser contada como entrega dela. Elas estao aqui porque o baseline manda carrega-las com a banda **final** de aceite e a fase dona ao lado, para que nenhuma fase seguinte as conte duas vezes.

| Metrica derivada | baseline v2.2 | fim da Fase 25 | **hoje** | Banda FINAL de aceite | Fase dona |
| --- | --- | --- | --- | --- | --- |
| duracao media da partida | 51,40 min | 35,66 min | **30,12 min** | 29 a 36 min | Fase 25 (via torres/min), dentro |
| fracao no limite de 60 minutos | 27,20 por cento | 0,40 por cento | **0,00 por cento** | abaixo de 0,5 por cento | Fase 25, dentro |
| fracao acima de 45 minutos | 77,3 por cento | 15,4 por cento | **4,1 por cento** | abaixo de 8 por cento | Fase 25, **ENTROU** |
| **fracao abaixo de 25 minutos** | 0,3 por cento | 5,1 por cento | **29,2 por cento** | 1 a 12 por cento | Fase 25, **SAIU pelo TETO** (ver D-25B-10) |
| abates totais por partida | 88,16 | 51,06 | **38,68** | 22 a 34 | **Fase 26**, ainda FORA |
| abates por minuto `(pace)` | 1,698 | 1,383 | **1,244** | 0,700 a 1,000 | **Fase 26**, ainda FORA |
| torres totais por partida, contador de nove | 9,59 | 11,49 | **8,67** | 10 a 14 | Fase 25, **FORA sob esta leitura** |
| torres totais por partida, contagem completa `(pace)` | n/d | n/d | **10,68** | 10 a 14 | Fase 25, **DENTRO sob esta leitura** |
| baroes por partida | 4,28 | 2,19 | **1,57** | 0,9 a 1,8 | Fase 25 (predicao), **ENTROU** |
| fracao de partidas com >= 1 Baron | 100,0 por cento | 99,9 por cento | **97,7 por cento** | 75 a 98 por cento | Fase 25 (predicao), **ENTROU** |
| dragoes por partida | 5,69 | 5,28 | **4,80** | 3,8 a 5,2 | Fase 25 (predicao), **ENTROU** |
| fracao de partidas com Alma | 97,4 por cento | 67,8 por cento | **45,7 por cento** | 30 a 55 por cento | Fase 25 (predicao), **ENTROU** |
| fracao de partidas com Elder | 92,1 por cento | 41,5 por cento | **22,0 por cento** | 4 a 18 por cento | Fase 25 (predicao), ainda FORA |
| ouro por minuto por time `(pace)` | 690 | 655 | **645** | 1500 a 2100 | **Fase 27**, ainda FORA |
| diferenca de ouro venc/perd | 2416 | -397 | **558** | 7 mil a 14 mil | **Fase 27**, ainda FORA |
| acerto do favorito aos 20:00 `(pace)` | 0,615 | 0,890 | **0,855** | 0,700 a 0,850 | **Fase 29**, ainda FORA |
| win-rate com gap de forca 30 `(pace)` | 1,000 | 1,000 | **1,000** | 0,800 a 0,970 | **Fase 28**, ainda FORA |
| stomp / equilibrado / comeback | 9,1 / 24,5 / 66,5 | 26,3 / 40,9 / 32,7 | **26,5 / 41,3 / 32,3** | sem banda no painel; comeback tem banda provisoria `[0,40; 0,60]` no gate | Fase 30 (DOCS-01) |
| eventos por minuto | 1,82 | 2,33 | **2,27** | sem banda | observada |
| first blood (media) | 2:37 | 2:37 | **2:37** | sem banda | **identico nas tres colunas** |

**Leitura obrigatoria, e ela e o oposto de comemoracao.** Cinco derivadas entraram em banda nesta fase (`fracao acima de 45 minutos`, `baroes`, `>= 1 Baron`, `dragoes`, `Alma`) **sem que ninguem pedisse**, o que confirma de novo a predicao do roadmap de que derivada cai sozinha quando a alavanca-raiz e corrigida. **Isso nao e entrega desta fase e nao pode ser cobrado como tal.** E na direcao oposta, **uma derivada saiu de banda pelo outro lado**: a `fracao abaixo de 25 minutos` foi de 5,1 para 29,2 por cento contra um teto de 12, e a causa e a mesma que produziu os ganhos, o encurtamento da partida. Ela esta registrada como item com dono a definir e nao escondida.

**A fracao de comeback nao se recuperou:** 66,5 por cento no baseline, 32,7 no fim da Fase 25, **32,3** hoje. **Ela e o proxy mais direto do core value declarado em `PROJECT.md` linha 9** e o vermelho dela nao e do escopo desta fase, mas ele existe e esta anotado (D-25B-08).

---

## 5. Estado dos sete gates

Medido com `npm run calibrate:all` neste plano. **Nenhum dos sete terminou por estouro de tempo:** todo desfecho e por assercao nomeada.

| Gate | fim da Fase 25 | **hoje** | Fase dona do vermelho | Assert em que para, com o valor medido |
| --- | --- | --- | --- | --- |
| `calibrate` | vermelho | **vermelho** | **Fase 28** (FRC-02) | `scripts/calibrate-engine.ts:157`, `expected 1 to be less than 0.99` (teto de win rate do tier DOMINANTE). **Assert e valor identicos aos do fechamento da Fase 25** |
| `calibrate:micro` | **verde** | **verde** | | |
| `calibrate:structures` | **verde** | **verde** | | regras duras em zero absoluto nos seis tiers |
| `calibrate:objectives` | **verde** | **verde** | | |
| `calibrate:combat` | **verde** | **verde** | | |
| `calibrate:pace` | vermelho (8 bandas) | **vermelho (14 bandas)** | **Fases 25B, 26, 27, 28, 29 e 30** | `expectBands`, falha agregada em 14 bandas. **Das 14, quatro tem dono Fase 25B** |
| `calibrate:assists` | vermelho | **vermelho** | **Fase 26** (a razao agregada; rotulo no codigo ainda diz Fase 24) | `assistencias do ADC por abate do time [CONTROLE-CARRIES] = 0.256` contra o piso `0.280` |

**4 de 7 gates verdes, o mesmo placar do fechamento da Fase 25. NENHUM gate passou de verde para vermelho: zero regressao colateral.**

**O gate de ritmo cresceu de 8 para 14 bandas vermelhas nesta fase e isso NAO e regressao de engine.** A onda 2 acrescentou **dezoito bandas novas**, das quais doze nasceram vermelhas de proposito (DEC-02: banda que nasce verde sobre engine nao consertada e banda frouxa). As ondas de motor levaram as dez com dono Fase 25B de **dez vermelhas para quatro**, e nenhuma banda pre-existente mudou de valor.

### As catorze bandas vermelhas do gate de ritmo, nominalmente e com dono

Aplicando a regra de fechamento por dono escrita na onda 2 (`scripts/README.md` secao 5.1): **uma fase fecha quando toda banda cujo dono e ela esta dentro; bandas com dono em outra fase seguem vermelhas e nao bloqueiam, e sao listadas nominalmente.**

| # | banda | valor medido | banda | dono | bloqueia a Fase 25B? |
| --- | --- | --- | --- | --- | --- |
| 1 | `abates/min` | 1,244 | `[0,700; 1,000]` | Fase 26 | nao |
| 2 | `razao de abates vencedor sobre perdedor` | 1,052 | `[1,800; 2,600]` | Fase 26 | nao |
| 3 | `razao torres sobre abates` | 0,223 | `[0,330; 0,550]` | Fase 26 | nao |
| 4 | `fracao de abates ate 20:00` | 0,519 | `[0,320; 0,460]` | Fase 26 | nao |
| 5 | `fracao de partidas sem abate ate 10:00` | 0,016 | `[0,050; 0,200]` | Fase 26 | nao |
| 6 | `ouro/min por time` | 645 | `[1500; 2100]` | Fase 27 | nao |
| 7 | `razao de ouro/min vencedor sobre perdedor` | 1,030 | `[1,100; 1,300]` | Fase 27 | nao |
| 8 | `win-rate com gap de forca 30` | 1,000 | `[0,800; 0,970]` | Fase 28 | nao |
| 9 | `acerto do favorito aos 20:00` | 0,855 | `[0,700; 0,850]` | Fase 29 | nao |
| 10 | `fracao de comeback` (PROVISORIA) | 0,315 | `[0,400; 0,600]` | Fase 30 (DOCS-01) | nao, **D-25B-08** |
| 11 | **`DISPERSAO primeira torre`** | **0,540** | `[0,750; 2,000]` | **Fase 25B**, causa medida fora das alavancas da fase | **NAO FECHOU, D-25B-04** |
| 12 | **`FORMA vitoria com UMA rota limpa`** | **0,366** | `[0,500; 0,800]` | **Fase 25B**, fronteira dura da onda 3 | **NAO FECHOU, fronteira de modelo** |
| 13 | **`FORMA shutout`** | **0,497** | `[0,020; 0,120]` | **Fase 25B**, fronteira da onda 5 | **NAO FECHOU, D-25B-05** |
| 14 | **`FORMA bimodalidade das torres do PERDEDOR`** | **0,606** | `[0,250; 0,5556]` | **Fase 25B**, com conserto **medido e nao aplicado** | **NAO FECHOU, decisao de sequenciamento** |

**Quatro das dez bandas com dono Fase 25B seguem vermelhas.** Pela regra escrita na onda 2, **a fase NAO fecha limpa**. Ela fecha com **quatro vermelhas proprias, todas com fronteira medida e nenhuma sem explicacao mecanica**.

---

## 6. As dez bandas com dono Fase 25B, de ponta a ponta

| banda | ao nascer (onda 2) | apos a onda 3 | **hoje** | veredito |
| --- | --- | --- | --- | --- |
| DISPERSAO torres do vencedor | 0,202 | 0,709 | **0,921** | **ENTROU** |
| DISPERSAO torres por minuto | 0,504 | 0,641 | **0,819** | **ENTROU** |
| DISPERSAO primeira torre | 0,543 | 0,549 | **0,540** | **FORA** |
| FORMA vencedor no maximo do contador | 0,907 | 0,236 | **0,134** | **ENTROU** |
| FORMA vitoria exigiu TRES rotas | 0,907 | 0,236 | **0,134** | **ENTROU** |
| FORMA vitoria com UMA rota limpa | 0,026 | 0,268 | **0,366** | **FORA** |
| FORMA shutout | 0,449 | 0,491 | **0,497** | **FORA** |
| FORMA exatamente 9 a 0 | 0,209 | 0,046 | **0,029** | **ENTROU** |
| FORMA bimodalidade das torres do VENCEDOR | 0,785 | 0,458 | **0,441** | **ENTROU** |
| FORMA bimodalidade das torres do PERDEDOR | 0,649 | 0,633 | **0,606** | **FORA** |

**Seis de dez entraram. Zero saiu. Nenhuma banda foi afrouxada para isso.**

---

## 7. Provas por diff

Verificacao automatizada, `node tmp/verify-25B-diff.cjs`, saida completa em `tmp/diff-proof-25B.txt`. Ela compara a versao do **commit base da fase** contra a arvore de hoje.

### Nota de metodo 1: de onde veio o commit base, e por que isso e um item de seguranca

**O commit base foi LIDO de `docs/diagnostics/25B-ancoragem.md`, Bloco 1, arquivo versionado pela onda 1 com contrato escrito de que os planos 25B-02 a 25B-07 leriam dali.**

A regra alternativa, achar o commit base procurando o commit mais antigo com escopo da fase no assunto, **ja falhou duas vezes nesta milestone**, e o modo de falha e silencioso: quando o topo da arvore e um commit de roadmap ou de docs, sem escopo de plano, a regra devolve **o proprio HEAD**, e a prova por diff passa **vazia**, comparando a arvore com ela mesma. Na Fase 25 isso quase declarou dois criterios provados sem terem sido testados.

**Sanidade da base, conferida ANTES de qualquer comparacao:** o blob de `src/sim/structures.ts` no commit base (`1bee99e`) e **diferente** do de hoje (`8209a2d`). Se fossem iguais, o script **falha** em vez de reportar sucesso, porque blobs identicos sao o sintoma de base devolvida como HEAD.

### Nota de metodo 2: normalizacao de fim de linha

`core.autocrlf` esta em **`true`** neste repositorio, entao o objeto guardado no git tem um fim de linha e a arvore de trabalho tem outro. **Comparacao de bytes crus acusaria TODA linha como alterada.** A normalizacao e aplicada aos **dois** lados antes da comparacao, e o que fica provado byte a byte e o **conteudo**, que e o que os criterios exigem.

### 7.1 Corpos das funcoes protegidas

| Funcao | O que ela e | Tamanho | Resultado |
| --- | --- | --- | --- |
| `structureTimePlausibility` | a curva temporal de plausibilidade | 28 linhas, 952 bytes | **IDENTICO** |
| `cascadeDamageMultiplier` | o freio de cascata | 27 linhas, 976 bytes | **IDENTICO** |
| `deriveBypass` | o desvio de freio | 14 linhas, 476 bytes | **IDENTICO** |
| `buildStructureActorCandidates` | a lista de candidatos de ator plausivel | 39 linhas, 1239 bytes | **IDENTICO** |

### 7.2 As quatro constantes de cascata

| Constante | Valor nos dois lados | Resultado |
| --- | --- | --- |
| `CASCADE_REDUCAO_MAX` | `0.25` | **IDENTICA** |
| `CASCADE_N_LANE_SEC` | `180` | **IDENTICA** |
| `CASCADE_REDUCAO_GLOBAL` | `0.50` | **IDENTICA** |
| `CASCADE_N_GLOBAL_SEC` | `45` | **IDENTICA** |

### 7.3 A rampa de fim de jogo

```
antes  : const lateRamp = Math.max(0, (state.gameTimeSec - 2100) / 900); // +0 at 35:00, +1 at 50:00
depois : const lateRamp = Math.max(0, (state.gameTimeSec - 2100) / 900); // +0 at 35:00, +1 at 50:00
```

**IDENTICA byte a byte, comentario incluso.** O simbolo `lateRamp` aparece **2 vezes** nos dois lados: nenhum uso novo entrou nem saiu.

### 7.4 A linha do gate de pressao estrutural

```
if (force <= 0.18 || rng() > force) return null;
```

**IDENTICA byte a byte, com exatamente UMA ocorrencia nos dois lados.** Essa e a armadilha central do roadmap: a expressao faz curto-circuito, entao mexer no `0.18` pareceria mudanca de magnitude mas seria mudanca de **frequencia de consumo do gerador**, deslocando a sequencia inteira dali para frente.

### 7.5 Chamadas ao gerador em `src/sim/`

Contagem canonica do projeto, o literal `rng(`. **Todos os 15 arquivos com delta zero.**

| Arquivo | base | hoje | delta |
| --- | --- | --- | --- |
| `src/sim/engine.ts` | 25 | **25** | 0 |
| `src/sim/structures.ts` | 12 | **12** | 0 |
| `src/sim/runMatch.ts` | 11 | **11** | 0 |
| `src/sim/laneState.ts` | 4 | **4** | 0 |
| `src/sim/teamComp.ts` | 4 | **4** | 0 |
| `src/sim/combat.ts` | 3 | **3** | 0 |
| `src/sim/championMeta.ts`, `deathQuality.ts`, `objectives.ts`, `selection.ts` | 2 cada | **2 cada** | 0 |
| `src/sim/laneState.test.ts`, `matchState.ts`, `microMetrics.ts`, `rng.test.ts`, `rng.ts` | 1 cada | **1 cada** | 0 |
| **`src/sim/`, so producao** | **70** | **70** | **0** |
| **`src/sim/`, contagem CANONICA com testes** | **72** | **72** | **0** |

**Nenhuma chamada nova ao gerador entrou em `src/sim/` na fase inteira.** Vale registrar que a onda 3 **acrescentou uma funcao de motor** (`siegeLaneFocus`) e o contrato foi preservado por desenho: ela e termo **puro** e livre de gerador **por assinatura**, provado por teste (`expect(accrueSiegePressure.length).toBe(1)`).

### 7.6 As constantes FORA do escopo autorizado da fase

**Este item e novo em relacao ao 25-08 e existe por uma razao especifica:** esta fase tinha permissao de mexer em **duas** constantes e em nenhuma outra. Este bloco prova que ela nao mexeu nas demais.

| Constante | Valor nos dois lados | Resultado |
| --- | --- | --- |
| `SIEGE_ACCRUAL_BASE` (taxa do canal absoluto) | `2.2` | **IDENTICA** |
| `base: 27,` (constante base do caminho do gate) | `27` | **IDENTICA** |
| `SIEGE_ADV_FLOOR` (piso do termo de vantagem) | `0.25` | **IDENTICA** |
| `SIEGE_ADV_EXPONENT` (expoente do termo de vantagem) | `3.5` | **IDENTICA** |

E as duas **autorizadas**, reportadas como contexto e nunca como reprovacao:

| Constante | base | hoje | leitura |
| --- | --- | --- | --- |
| `SIEGE_ADV_CEIL` | `4.0` | **`4.0`** | reavaliada por grade de nove pontos e **MANTIDA por decisao de checkpoint humano** |
| `SIEGE_FOCUS_TEMPERATURE` | **nao existia** | **`9`** | a alavanca nova da fase, com ponto de operacao fixado por duas travas medidas |

### 7.7 Regeneracoes de golden na fase

| Commit | Arquivos | Arquivo |
| --- | --- | --- |
| `df9bcdf` | **1** | `src/__tests__/golden/__snapshots__/golden.test.ts.snap` |
| `c023c5d` | **1** | `src/sim/__snapshots__/structures.test.ts.snap` |

**Commits de snapshot na fase: 2. Planos que regeneraram: 25B-06, ou seja UMA regeneracao. Cada commit com exatamente UM arquivo: SIM.**

**A ordem foi tornada verificavel por `git log` em vez de afirmada:** o relatorio de diff (`9794f4d`) foi commitado **sozinho**, com os dois snapshots ainda no estado da Fase 25, provado por hash de blob e nao por `git status`. `git show 9794f4d --name-only` nao contem um unico arquivo `.snap`.

### 7.8 Checagem de travessao, nas linhas ACRESCENTADAS

**A checagem roda sobre as linhas acrescentadas pelo diff da fase (`git diff -U0`, prefixo `+`), NUNCA sobre arquivo inteiro.** Ha travessoes pre-existentes em arquivos que a fase toca, e checar arquivo inteiro produz vermelho que nao e da fase.

| leitura | contagem |
| --- | --- |
| linhas acrescentadas na fase | **8877** |
| com travessao, total | **6** |
| destas, **nomes de bloco gerados pelo vitest e ja presentes na base** | **6** |
| destas, **escritas pela fase** | **0** |

**As seis ocorrencias estao todas em `src/__tests__/golden/__snapshots__/golden.test.ts.snap` e sao a excecao que o plano previu.** O titulo do `describe` em `src/__tests__/golden/golden.test.ts` carrega travessao **desde a Fase 7**, e o vitest o reproduz no nome do bloco de snapshot. Elas aparecem como linha `+` apenas porque a regeneracao da onda 6 reordenou blocos dentro do arquivo.

**A excecao foi conferida e nao apenas afirmada**, por dois caminhos: cada uma das seis linhas existe **identica** no lado da base, e `src/__tests__/golden/golden.test.ts` esta **ausente** do diff da fase inteira.

---

## 8. O QUE A FASE NAO RESOLVEU

Escrito sem suavizar, com o numero e o dono de cada item.

| # | o que ficou aberto | numero medido | banda | fronteira medida | dono |
| --- | --- | --- | --- | --- | --- |
| 1 | **shutout** | **0,497** | teto 0,120 | **regiao VAZIA** por grade de nove tetos: 0,201 no piso legitimo da grade, contra teto de banda 0,120. Fronteira de **0,1 de largura** (1,5 valido, 1,4 invalido) | **NAO ATRIBUIDO** (D-25B-05) |
| 2 | **vitoria com UMA rota limpa** | **0,366** | piso 0,500 | so entra em `T` menor ou igual a 6,5, faixa **proibida** por `primeira torre antes de 7:00` no PRO-GAP. Fronteira de **MODELO** | Fase 25B, sem conserto no alcance da fase |
| 3 | **bimodalidade das torres do perdedor** | **0,606** | teto 0,5556 | **tem conserto medido**: teto 1,75 leva a 0,522, com o gate de 14 para 10 vermelhas | adiado por sequenciamento; revisitar **depois** da Fase 26 |
| 4 | **dispersao da primeira torre** | **0,540** | piso 0,750 | responde ao teto do termo (0,540 a 0,770) mas so entra em teto 1,0, que elimina **tres** bandas de nivel. **Alavanca existe e e inutilizavel** | **NAO ATRIBUIDO** (D-25B-04) |
| 5 | **fracao de comeback** | **0,315** | piso 0,400 (provisorio) | nao investigada nesta fase | Fase 30, DOCS-01 (D-25B-08) |
| 6 | **fracao abaixo de 25 minutos** | **29,2 por cento** | teto 12 por cento | derivada, saiu pelo teto durante esta fase | **NAO ATRIBUIDO** (D-25B-10) |
| 7 | **o contador de torres do Nexus** | vencedor **8,40** completa contra **6,40** de contador | quatro bandas leem contagem completa e sete leem contador de nove | corrigido na **leitura do harness**, nao no motor | **Fase 30, revisao em bloco** (D-25B-07, dono atribuido no aceite) |
| 8 | **o Arauto derruba o inibidor sem emitir o evento** | **1 vermelho por assercao** na suite | invariante de `structures.test.ts` | correcao obvia **criaria violacao de regra dura** (1 dos 9 casos antes de 16:00, classe `nearZero`) | **NAO ATRIBUIDO** (D-25B-01) |

**Nenhuma banda foi afrouxada para fazer qualquer um destes parecer melhor.** Alterar piso ou teto e sempre item da revisao em bloco da Fase 30, com valor antigo, valor novo, fase que pediu e justificativa escritos.

### RECOMENDACAO PARA QUEM SEQUENCIAR AS PROXIMAS FASES: ha CINCO itens SEM DONO

**A contagem esta aqui, nomeada e visivel, exatamente para que a decisao de escopo seja tomada de olho aberto. Nenhum dono foi inventado.**

| # | ID | assunto | numero medido |
| --- | --- | --- | --- |
| 1 | **D-25B-01** | o Arauto derruba o inibidor sem emitir `inhibitor_destroyed` | **1 vermelho por assercao** na suite, incidencia de 0,90 por cento |
| 2 | **D-25B-04** | a dispersao da PRIMEIRA TORRE | **0,540** contra o piso 0,750 |
| 3 | **D-25B-05** | o SHUTOUT | **0,497** contra o teto 0,120 |
| 4 | **D-25B-09** | a alternancia de ator do canal parecendo mecanica | julgamento humano, **sem medicao que o resolva** |
| 5 | **D-25B-10** | a fracao de partidas abaixo de 25 minutos | **29,2 por cento** contra o teto 12 |

**A leitura, e ela e desconfortavel de proposito: a divida esta acumulando mais rapido do que esta sendo paga.** A Fase 25 fechou deixando **um** item sem dono (D-25-08, coerencia e causalidade). Ele **ganhou** dono, porque a Fase 25C foi criada para ele. A Fase 25B fecha deixando **cinco**.

**Por que nenhum foi inventado, e a regra e da milestone:** inventar fase ou criterio no meio de uma fase de calibracao e como a atribuicao causal se perde, e o mesmo argumento ja barrou a forma estreita de D-25-05 e a banda de forma de D-25-06 na Fase 25. **Dois dos cinco (D-25B-04 e D-25B-05) tem fronteira medida dos dois lados e hipotese de causa rotulada como nao testada**, ou seja quem os pegar nao comeca do zero. Os outros tres precisam de decisao de escopo antes de qualquer medicao.

**O que este relatorio NAO faz:** nao escolhe entre "banda fora com dono declarado" e "fase nova de escopo" para nenhum dos cinco. Isso e decisao de quem tem escopo sobre os criterios.

---

## 9. Registro de conformidade da fase

| Invariante | Estado |
| --- | --- |
| regras duras da v2.0 em zero absoluto, seis tiers | **zero**: `Baron antes de 20:00` 0/6, `primeira torre antes de 7:00` 0/6, `cross-lane simultaneo` 0/3, `p5 da 1a torre` 615 s contra piso duro 300 s, plausibilidade do painel 0/0/0/0 |
| `rng(` em `src/sim/`, contagem canonica | **72**, delta zero contra o commit base, em todos os 15 arquivos |
| linha do gate `if (force <= 0.18 \|\| rng() > force) return null;` | **byte a byte intacta, uma ocorrencia nos dois lados** |
| regeneracoes de golden na fase | **uma**, deliberada, cobrindo os dois snapshots de valor em commits isolados com um arquivo cada |
| constantes fora do escopo autorizado | **quatro conferidas, quatro identicas** |
| dependencias novas no `package.json` | **zero** |
| gates que passaram de verde para vermelho | **zero** |
| bandas afrouxadas | **zero** |
| suite completa (`npx vitest run --testTimeout=60000`) | **908 verdes, 1 vermelho** em 57 arquivos. O vermelho e o **D-25B-01**, por assercao e por design |
| travessao nas linhas ACRESCENTADAS pela fase | **zero autorais**; 6 nomes de bloco gerados pelo vitest, ja presentes na base |
| travessao nas mensagens de commit da fase | **zero** |

---

## 10. Onde cada numero deste relatorio pode ser reconferido

| Assunto | Arquivo |
| --- | --- |
| os sete gates | `tmp/all-25B-07.txt` |
| bandas, dispersao, forma e observacao nos seis tiers | `tmp/calibration-pace.txt` |
| regras duras estruturais, cascata e ator | `tmp/calibration-structures.txt` |
| a sonda de forma, dois tiers | `tmp/shape.txt` |
| painel amplo pos-fase | `docs/diagnostics/engine-diagnose.txt` |
| provas por diff | `tmp/diff-proof-25B.txt` |
| suite completa | `tmp/suite-25B-07.txt` |
| tabela de ancoragem, reconstrucao validada e escolha do teto | `docs/diagnostics/25B-ancoragem.md` |
| decaimento refutado, concentracao de rota e grade do termo de vantagem | `docs/diagnostics/25B-sweep.md` |
| diff estruturado do golden em quatro dimensoes | `docs/diagnostics/golden-diff-25B.txt` |
| baseline oficial congelado da Fase 24 | `docs/baselines/24-baseline-v2.2.md` |
| estado de fechamento da Fase 25 | `docs/diagnostics/25-relatorio-da-fase.md` |
| itens diferidos com dono, Fase 25B | `.planning/phases/25B-forma-da-distribuicao-estrutural/deferred-items.md` |
| itens diferidos com dono, Fase 25 | `.planning/phases/25-throughput-estrutural-o-canal-absoluto/deferred-items.md` |

---

## 11. O que esta fase NAO promete, e isto precisa estar escrito antes do aceite

O aceite final da Fase 25 foi **PARCIAL**, com o veredito literal do desenvolvedor: *"os eventos ainda estao muito ruins e descolados da realidade, mas melhorou bastante coisa."* Ele nomeou **tres eixos** como ruins: **volume e mistura**, **ritmo dentro da partida** e **coerencia e causalidade**.

**A Fase 25B nao ataca nenhum dos tres.** Ela conserta **forma de distribuicao estrutural**, ou seja quantas torres o vencedor precisa destruir e com que dispersao. Os donos dos tres eixos ja estao declarados no roadmap:

| eixo reprovado no aceite da Fase 25 | dono |
| --- | --- |
| volume e mistura (abate demais, evento demais) | **Fase 26**, CBT-01 a CBT-04 |
| ritmo dentro da partida (eventos nao se agrupam) | **Fase 26**, NAR-01 |
| coerencia e causalidade (evento nao puxa evento) | **Fase 25C**, inserida no roadmap por causa de D-25-08 |

**O que o playback desta fase PODE mostrar:** partidas em que o vencedor fecha limpando uma ou duas rotas em vez de tres, torres do vencedor variando entre 3 e 9 em vez de parar em 9, e placar estrutural menos perfeito. **O que ele NAO vai mostrar:** menos abates, eventos mais agrupados ou eventos que puxem uns aos outros. Cobrar isso desta fase seria cobrar o que ela nao prometeu.

**E o que ele ainda vai mostrar de ruim, com numero:** partida parelha ainda termina com o perdedor em 0 ou 1 torre em **49,7 por cento** dos casos, contra um alvo de menos de 12. Isso e o criterio 3, que **nao fechou**, e a fronteira esta medida dos dois lados.

**O aceite final humano aconteceu em 2026-07-30, com leitura do relatorio e playback**, e foi **APROVADO com o criterio 3 declarado em aberto**. O registro da decisao e do raciocinio esta na secao de aceite, no topo deste relatorio.
