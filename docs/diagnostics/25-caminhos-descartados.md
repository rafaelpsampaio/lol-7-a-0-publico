# Fase 25: os caminhos medidos e descartados

**Data:** 2026-07-29
**Fase:** 25-throughput-estrutural-o-canal-absoluto
**Plano de origem:** 25-02 (Task 2)
**Proposito, em uma linha:** travar por escrito, com o numero que fecha cada assunto, os caminhos que a pesquisa desta fase ja mediu e descartou, para que ninguem gaste uma iteracao do sweep re-tentando um deles.

**Fonte de todo numero deste documento:** as oito sondas de `.planning/phases/25-throughput-estrutural-o-canal-absoluto/25-RESEARCH.md`, cerca de 60.000 partidas ao todo, rodadas contra o commit `a24ea23` da engine, com semente igual ao indice da partida e `mulberry32`. A base de comparacao e `docs/baselines/24-baseline-v2.2.md`, nunca o diagnostico de 2026-07-28. Cada secao abaixo cita o Achado de onde o numero saiu.

**Validade:** enquanto `src/sim/structures.ts` e `src/sim/engine.ts` nao mudarem. Um commit que toque `src/sim/` invalida os numeros absolutos, mas nao invalida os mecanismos, que e o que este documento existe para preservar.

---

## Antes de tudo: a correcao do diagnostico

Este documento existe, antes de mais nada, para propagar uma correcao de leitura. O texto do roadmap descreve o mecanismo de forma imprecisa, e a imprecisao leva direto aos caminhos descartados: a nota de sequenciamento da Fase 25 diz que "o gargalo e numero de tentativas, nao dano por tentativa".

**O gargalo nao e falta de tentativa e tambem nao e falta de magnitude. E distribuicao temporal.** (Achado 1, sonda `tmp/probe-gate-anatomy.test.ts`, N=400 por tier.)

No tier EQUILIBRADO 75 contra 75, medindo dentro do gate `if (force <= 0.18 || rng() > force)` de `src/sim/structures.ts:699`:

| Medida, por partida | Valor medido |
|---|---|
| avaliacoes do gate | **79,61** |
| passagens do gate | **30,10** (37,8 por cento das avaliacoes) |
| dano medio por passagem | **63,53**, num pool que precisa somar 100 |
| dano perdido no corte de `Math.min(100, ...)` | 26 por cento |

Isso e muita tentativa e muita magnitude. Nao existe escassez agregada. O que existe e escassez **temporal**:

| Ate 20:00, tier EQUILIBRADO | Valor medido |
|---|---|
| avaliacoes do gate | 30,25 |
| **passagens do gate** | **2,03** |
| taxa de passagem | **6,7 por cento** |
| torres aos 20:00 medidas pelo harness | 1,285 |

**A conferencia aritmetica que fecha a cadeia:** `2,03 passagens x 63,53 de dano / 100 de pool = 1,29 torre`, contra as **1,285** torres aos 20:00 que o harness mede de forma independente. Fecha em 0,4 por cento.

Ou seja: **93 por cento das passagens do gate acontecem depois dos 20 minutos.** A causa e que `force` e um diferencial puro, que so sai de perto de zero quando o Baron aparece ou quando o `lateRamp` cruza o limiar (e o `lateRamp` so cruza o `0,18` aos 37:42).

**Consequencia direta, e e o fio que amarra este documento inteiro:** qualquer alavanca que mexa em quanto o gate passa, ou em quanto ele bate, esta mexendo no numero errado. A alavanca certa e a que produz dano estrutural **cedo e continuamente**. Nenhum dos cinco caminhos abaixo faz isso, e e por isso que os cinco foram medidos e descartados.

---

## Os cinco caminhos descartados, em uma tabela

| Caminho | Numero que fecha o assunto | Mecanismo | Sinal de alerta |
|---|---|---|---|
| 1. piso no `force`, de 0,18 para 0,40 | torres/min de **0,188** para **0,203**, contra piso de banda 0,300 | homeostato do freio de cascata | um sweep em que dobrar uma constante move a metrica menos de 5 por cento |
| 2. zerar o limiar 0,18 | torres/min de **0,188** para **0,186**, ou seja para baixo | mudanca de frequencia de consumo do gerador, nao de magnitude | qualquer plano da fase tocando a linha do gate em `src/sim/structures.ts:699` |
| 3. dobrar o `base` do gate, de 45 para 90 | mais 15 por cento de torres/min, mas placas de 0,76 para **0,36** | um golpe grande atravessa varios multiplos de 20 num tick e emite um unico evento de placa | placas caindo quando o throughput sobe |
| 4. fonte de vantagem por abates | razao de torres **1,64** com expoente 3 e 1,71 com expoente 4, contra piso 2,5 | abates nao separam a camada estrutural: e a camada errada | razao de torres presa perto de 1,6 depois de ligar o termo de vantagem |
| 5. fonte de vantagem por `winProbUser` | funciona numericamente, razao **2,54** com expoente 3 | mas cria um laco que a Fase 29 invalidaria | `winProbUser` sendo lido de dentro de `src/sim/structures.ts` |

---

## Caminho 1: piso no `force` (`forceFloor` de 0,18 para 0,40)

**O que e.** Impor um piso ao valor de `force` antes do gate, de modo que avaliacoes que hoje caem no curto-circuito passem a ter chance real de passar. E a alavanca 2 do roadmap, listada como segunda em ordem de eficacia.

**O numero medido.** (Achado 2, sonda `tmp/probe-sweep.test.ts`, EQUILIBRADO 75 contra 75, N=300, onze pontos de sweep.)

| Configuracao | torres/min | torres aos 20:00 | placas | avaliacoes / passagens | dano por passagem | produto |
|---|---|---|---|---|---|---|
| BASELINE | **0,188** | 1,31 | 0,76 | 80,2 / **30,5** | **63,5** | 1.937 |
| `forceFloor = 0,10` | 0,188 | 1,31 | 0,76 | 80,2 / 30,5 | 63,5 | 1.937 |
| `forceFloor = 0,15` | 0,188 | 1,31 | 0,76 | 80,2 / 30,5 | 63,5 | 1.937 |
| `forceFloor = 0,20` | 0,194 | 1,41 | 1,87 | 78,4 / 36,9 | 52,4 | 1.934 |
| `forceFloor = 0,30` | 0,201 | 1,59 | 2,58 | 77,7 / 40,3 | 49,4 | 1.991 |
| **`forceFloor = 0,40`** | **0,203** | 1,84 | 3,26 | 76,8 / **44,3** | **45,0** | 1.994 |

Uma perturbacao de **mais 122 por cento** no gate move torres/min de 0,188 para 0,203, contra um piso de banda de **0,300**. O produto de passagens por dano anda **2,9 por cento**.

**Por que nao funciona: o homeostato.** As passagens sobem de **30,5** para **44,3**, ou seja mais 45 por cento. O dano por passagem cai de **63,5** para **45,0**, ou seja menos 29 por cento. O produto se conserva. A causa esta em `cascadeDamageMultiplier` (`src/sim/structures.ts:104-129`): ele reduz o dano em ate 75 por cento na mesma lane por 180 s apos uma queda, e em ate 50 por cento em qualquer lane por 45 s. Mais passagens produzem mais quedas recentes, que produzem menos dano por passagem. **O sistema auto-regula o throughput estrutural e absorve qualquer aumento na frequencia de passagem.**

Como o freio de cascata e regra de plausibilidade da v2.0 e nao pode ser tocado nesta milestone, este caminho esta **estruturalmente vedado** a entregar o criterio 2. Nao e questao de achar o valor certo do piso: nao existe valor certo.

**Bonus ruim, e ele importa.** Esta e tambem a alavanca que **amplifica o vies de lado**: `forceFloor = 0,40` mede **58,3 por cento** de vitoria do lado `user` nas partidas decididas por nexo, o valor mais alto de toda a tabela do Achado 8. Ver a secao de vies de lado abaixo.

**Sinal de alerta.** Um sweep em que dobrar uma constante move a metrica-alvo menos de 5 por cento. Isso nao e "quase la, precisa de mais": e homeostato, e o proximo passo do sweep tambem nao vai entregar.

---

## Caminho 2: zerar o limiar 0,18

**O que e.** Baixar (ou zerar) o `0.18` de `if (force <= 0.18 || rng() > force)`, para tirar avaliacoes do curto-circuito. E a armadilha nomeada no proprio roadmap, e a que mais convida no meio de um sweep, porque parece a mudanca mais barata do arquivo.

**O numero medido.** (Achado 2, mesma sonda.)

| `threshold` | torres/min | torres aos 20:00 | placas |
|---|---|---|---|
| **0,000** | **0,186** | 1,41 | 1,26 |
| 0,050 | 0,185 | 1,38 | 1,26 |
| 0,100 | 0,188 | 1,41 | 1,26 |
| 0,144 (menos 20 por cento) | 0,184 | 1,30 | 0,96 |
| **0,180 (hoje)** | **0,188** | 1,31 | 0,76 |
| 0,216 (mais 20 por cento) | 0,183 | 1,31 | 0,67 |

Zerar o limiar por completo move torres/min de **0,188 para 0,186**, ou seja **para baixo**, dentro do ruido.

**Por que nao funciona.** Duas coisas ao mesmo tempo. A primeira: o limiar so decide **quem chega ao sorteio**, e quem chega ao sorteio com `force` baixo perde o sorteio de qualquer forma, porque a probabilidade de passar e o proprio `force`. Tirar do curto-circuito nao cria passagem, so muda onde a avaliacao morre.

A segunda, e e a cara: por causa do curto-circuito, mexer no `0.18` **nao e mudanca de magnitude, e mudanca de frequencia de consumo do gerador**. Quando `force <= 0,18` o `rng()` nem chega a ser chamado. Baixar o limiar coloca avaliacoes que hoje nao consomem draw a consumir draw, o que desloca a sequencia inteira do gerador dali para a frente e obriga a regeneracao de golden da fase. Medido: 1264 draws por partida hoje contra 1234 com o limiar zerado.

**Pior relacao custo e beneficio da fase:** o golden inteiro por um efeito nulo e de sinal negativo.

**Sinal de alerta.** Qualquer plano desta fase que toque a linha do gate em `src/sim/structures.ts:699`.

---

## Caminho 3: dobrar o `base` do caminho do gate (de 45 para 90)

**O que e.** Aumentar a constante de dano `base` que entra em `computeStructureDamage`, ou seja bater mais forte a cada passagem. E a alavanca 4 do roadmap.

**O numero medido.** (Achado 3, sonda `tmp/probe-sweep.test.ts`, EQUILIBRADO 75 contra 75, N=300, seis pontos.)

| `base` | torres/min | torres aos 20:00 | **placas** | dano por passagem | corte do pool | torre antes de 7:00 |
|---|---|---|---|---|---|---|
| 22,5 (menos 50 por cento) | 0,137 | 1,02 | 0,69 | 31,6 | 14 por cento | 0 |
| **45 (hoje)** | **0,188** | 1,31 | **0,76** | 63,5 | 26 por cento | 0 |
| 54 (mais 20 por cento) | 0,196 | 1,51 | 0,67 | 77,1 | 29 por cento | 0 |
| 67,5 (mais 50 por cento) | 0,203 | 1,76 | 0,52 | 96,9 | 34 por cento | 0 |
| **90 (dobro)** | 0,216 | 1,99 | **0,36** | 130,4 | **41 por cento** | **3** |

Dobrar `base` entrega **mais 15 por cento** de torres/min, ainda muito longe do piso 0,300, e em troca derruba as placas de 0,76 para **0,36** (menos 53 por cento) e reintroduz **tres** violacoes do assert duro de 7:00.

**Por que nao funciona.** A causa esta em tres linhas de `src/sim/structures.ts:838-850`: `plate_taken` so e emitido quando `Math.floor(poolAfter/20) > Math.floor(poolBefore/20)`, e **so um evento por tick**. Um golpe de 130 de dano atravessa seis multiplos de 20 de uma vez e emite **um unico** evento de placa. Quanto maior o golpe, menos placas. Alem disso o corte do pool em 100 sobe para 41 por cento: quase metade do dano e jogado fora.

**O criterio 2 (torres/min) e o criterio 5 (5 a 12 placas por partida) puxam esta constante em direcoes opostas.** Nao existe valor de `base` que atenda os dois.

**Nota importante, para nao virar leitura errada:** isto descarta **subir** o `base`. Reduzi-lo continua na mesa e e trabalho declarado do Plano 25-05, mas por outro motivo: `base = 36` zera as seis violacoes do assert de 7:00 no GAP-30 (Achado 6). A reducao existe para consertar o GAP-30 e o corte do pool, nunca para dar throughput.

**Sinal de alerta.** Placas caindo enquanto o throughput sobe. Se as duas metricas andam em sentidos opostos no mesmo commit, a alavanca e magnitude de golpe, e a resposta ja esta medida aqui.

---

## Caminho 4: fonte de vantagem por abates

**O que e.** O canal absoluto de cerco, sozinho, entrega dano igual aos dois lados por construcao, e por isso **comprime** a separacao entre vencedor e perdedor (razao de torres de 1,44 para 1,32, contra a banda [2,5; 4,5]). O conserto e um termo de vantagem rng-free dentro do acumulo. A pergunta e de onde tirar o sinal de vantagem. A primeira fonte testada foi a diferenca de abates.

**O numero medido.** (Achado 7, sondas `tmp/probe-ratio.test.ts` e `tmp/probe-advsrc.test.ts`, EQUILIBRADO 75 contra 75.)

| Fonte | expoente | razao de torres V/P (banda [2,5; 4,5]) | torres/min | placas | vencedor / perdedor |
|---|---|---|---|---|---|
| **abates** | 3 | **1,64 FALHA** | 0,337 | 10,33 | 8,22 / 5,00 |
| **abates** | 4 | **1,71 FALHA** | 0,345 | 10,79 | 8,29 / 4,84 |

Com abates como fonte, a razao fica **sempre abaixo do piso de 2,5**, e o perdedor termina com 5,00 torres contra a referencia pro de 2,75. Subir o expoente de 3 para 4 move a razao de 1,64 para 1,71: praticamente nada.

**Por que nao funciona.** Abates **nao separam a camada estrutural**. O vencedor de uma partida de LoL pro leva a maioria das torres, mas nao leva a maioria proporcional dos abates: a propria banda de razao de abates da milestone e [1,8; 2,6], contra [2,5; 4,5] da razao de torres. Tirar o sinal estrutural de uma camada que separa menos do que o alvo estrutural e pedir para o resultado ficar abaixo do alvo. E a camada errada.

**Sinal de alerta.** A razao de torres presa perto de 1,6 depois de ligar o termo de vantagem, com todas as outras bandas verdes. Isso quer dizer que a fonte de vantagem esta lendo a camada errada, nao que o expoente esta baixo.

---

## Caminho 5: fonte de vantagem por `winProbUser`

**O que e.** A segunda fonte de vantagem testada: usar a probabilidade de vitoria do lado como sinal de quem esta ganhando, e escalar o acumulo de cerco por ela.

**O numero medido.** (Achado 7, mesma sonda.) Este caminho **funciona numericamente**, e por isso ele e o mais perigoso da lista:

| Fonte | expoente | razao de torres V/P | torres/min | torres aos 20:00 | placas | vencedor / perdedor |
|---|---|---|---|---|---|---|
| `winProbUser` | 2 | 2,01 FALHA | 0,335 | 3,24 | 9,77 | 8,29 / 4,12 |
| **`winProbUser`** | **3** | **2,54 OK** | **0,363** | **3,72** | **10,28** | 8,66 / 3,41 |
| `winProbUser` | 4 | 2,91 OK | 0,384 | 4,63 | 10,84 | 8,73 / 3,00 |
| **torres ja derrubadas (a escolhida)** | **3** | **2,73 OK** | 0,340 | 4,13 | 9,08 | 8,49 / 3,11 |

Com `winProbUser` no expoente 3 o tier EQUILIBRADO fica **6 de 6 bandas verdes**, com torres/min 0,363 contra o alvo 0,370 e torres aos 20:00 em 3,72, exatamente no alvo. E o melhor numero da tabela inteira.

**Por que foi descartado assim mesmo.** `winProbUser` **nao e indicador puro, e juiz e termometro ao mesmo tempo**. O roadmap da Fase 29 declara explicitamente que ela realimenta:

- `chooseIntent` (`src/sim/engine.ts:455-457`), ou seja a escolha de intencao de cada lado;
- `behindBoost` (`src/sim/engine.ts:1768-1777`), ou seja o impulso de quem esta atras;
- o desfecho da partida no teto de tempo (`src/sim/engine.ts:360`).

Por isso a Fase 29 e obrigatoriamente **isolada e ultima** entre as fases de motor. **Acoplar o throughput estrutural a `winProbUser` cria um laco que a Fase 29 invalidaria**, e obrigaria a recalibrar a Fase 25 inteira depois dela. Trocaria um ganho de calibracao hoje por uma divida de recalibracao garantida em quatro fases.

**A alternativa escolhida e estrutural.** A fonte "torres ja derrubadas", com expoente 3, entrega **2,73**, dentro da banda [2,5; 4,5], sem acoplar nada: e um snowball puramente estrutural, lido da mesma camada que a metrica-alvo. O custo honesto de escolher a fonte estrutural em vez da win prob e placas 9,08 em vez de 10,28 e razao 2,73 em vez de 2,54, **as duas dentro da banda**.

**Sinal de alerta.** `winProbUser` sendo lido de dentro de `src/sim/structures.ts`, ou qualquer termo do acumulo que dependa, mesmo indiretamente, da probabilidade de vitoria.

**Aviso que acompanha o caminho escolhido, e nao e opcional:** o termo de vantagem precisa de **teto**, nao so de piso. Sem teto ele compoe com o gap de roster e reintroduz o assert de 7:00 nos tiers de gap (medido: `winProbUser^3` sem teto da 22,67 de razao e 3 violacoes de 7:00 no GAP-30). Com teto 2,0 o problema inverte e a razao no EQUILIBRADO cai para 1,82, abaixo do piso. Achar o ponto de operacao e trabalho declarado do Plano 25-06 e **nao esta resolvido por esta pesquisa**.

---

## O caminho escolhido, e por que ele e diferente dos cinco acima

Esta secao existe para que o documento nao pareca uma lista de negativas. Os cinco caminhos acima falham todos pelo mesmo motivo estrutural: eles mexem em **rajada**, e a engine tem tres mecanismos que comem rajada (o freio de cascata, o corte do pool em 100, e a regra de um evento de placa por tick).

O caminho escolhido, o acumulo continuo `accrueSiegePressure` na secao time-driven do tick, entrega dano em **muitos ticks pequenos espalhados** em vez de poucos golpes grandes. Consequencia dos tres mecanismos, uma por uma:

1. **O freio de cascata quase nao morde nele**, porque ele nao concentra quedas: o dano chega distribuido no tempo, que e exatamente o que o Achado 1 mostrou faltar.
2. **O corte do pool em 100 quase nao descarta nada**, porque um incremento pequeno raramente ultrapassa o que falta para 100. Contra os 26 por cento de hoje e os 41 por cento do `base = 90`.
3. **Praticamente todo cruzamento de multiplo de 20 vira evento de placa**, porque um incremento pequeno atravessa um multiplo de cada vez, nunca seis de uma vez.

O numero que resume a diferenca (Achado 4): o teto fisico de cruzamentos de multiplo de 20 disponivel sob acumulo e **18,12** por partida, contra **2,33** hoje. Nenhuma configuracao que so mexe no gate passa de 5,68.

**Aviso que acompanha:** se `accrueSiegePressure` **nao** emitir `plate_taken`, ela **piora** as placas (medido: taxa 8 sem emissao derruba de 0,76 para 0,17, porque o acumulo come o pool da outer em silencio). A emissao de placas dentro do acumulo nao e um extra opcional, e obrigatoria para o criterio 5 e para nao regredir.

---

## Custo de gerador: a armadilha central do roadmap, e a leitura que a torna barata

A armadilha central declarada no roadmap e que mexer no throughput estrutural custa draws novos de `rng()`, o que violaria a parte de ORDEM de INV-1 e reescreveria o golden. A pesquisa mediu que **essa armadilha nao se aplica ao caminho escolhido**, e o motivo e uma leitura de codigo que ninguem tinha feito:

- **Derrubar uma estrutura ja e uma operacao livre de gerador hoje.** `damageStructure` recebe o gerador num parametro chamado `_rng` (`src/sim/structures.ts:557`) e **nunca o usa**. O prefixo de sublinhado ja declarava isso, e ninguem tinha lido.
- **O unico consumidor de gerador no caminho estrutural e `selectKiller`**, e ele existe **so para escolher o nome do ator** do evento. Ele e substituivel por indice determinista sobre `buildStructureActorCandidates` (`src/sim/structures.ts:237`), lista que **ja e livre de gerador**.

Logo o acumulo pode acumular, emitir `plate_taken` e `tower_low`, e derrubar a estrutura quando o pool chega a 100, **sem um unico draw novo**.

| Alternativa | Draws novos | Ordem de consumo | Call site novo |
|---|---|---|---|
| **acumulo puro com emissao e queda (a escolhida)** | **zero** | inalterada dentro do tick | **nenhum** |
| piso no `force` | zero em codigo, mais em execucao (30,5 para 44,3 passagens) | **deslocada a partir da primeira avaliacao que muda** | mesmo call site |
| limiar 0,18 | idem, e e o caso canonico da armadilha | deslocada | mesmo call site |
| `base` | zero | inalterada no proprio tick | nenhum |
| termo de vantagem no acumulo | zero (le `state` e multiplica) | inalterada | nenhum |
| **variante rejeitada: emitir eventos do acumulo via `selectKiller`** | **mais 1 draw por evento**, ou seja 10 a 25 por partida | deslocada e intercalada | **call site NOVO** |

### A regra pratica que a fase inteira carrega

> **Nenhuma tarefa da Fase 25 pode acrescentar ao codigo de `src/sim/` uma chamada nova ao gerador.**

E verificavel, e o diff da fase precisa provar: a contagem de ocorrencias de `rng(` em `src/sim/` antes e depois da fase deve dar o **mesmo numero**. Se um plano precisar de um draw novo para funcionar, ele esta no caminho errado, e a variante rejeitada da ultima linha da tabela acima e o exemplo concreto de como isso aparece.

---

## Vies de lado: a leitura PRE, e a declaracao de fora de escopo

**Corrigir o vies de lado NAO e escopo desta fase.** A pesquisa e o roadmap declaram isso, e o motivo e mecanico: mudar a ordem de iteracao de lado (`src/sim/engine.ts:377`, `:399`, `:614` e `src/sim/laneState.ts:254`) muda a **ORDEM** de consumo do gerador, o que reescreve o golden inteiro e e a classe de mudanca que a convencao do projeto exige que tenha fase propria. O achado original esta em `docs/diagnostics/achado-vies-de-lado.md`, sem dono declarado no roadmap v2.2.

Entao por que a fase mede? Porque o canal absoluto **muda quem esta exposto ao vies**, e isso precisa estar registrado com numero antes e depois.

### Leitura PRE, medida pela sonda versionada desta fase

`npm run probe:side-bias` (`scripts/probe-side-bias.ts`), confronto espelhado 75 contra 75, N = 1500, semente igual ao indice da partida, relatorio em `tmp/side-bias.txt`. Cada proporcao vem com a meia-largura do **IC95** binomial e o n do proprio recorte:

| Recorte | Fracao da populacao | Taxa de vitoria do lado `user` | Meia-largura IC95 | n |
|---|---|---|---|---|
| **total** | 100,0 por cento | **55,3 por cento** | mais ou menos 2,5 pontos | 1500 |
| **por nexo** | **72,8 por cento** | **55,9 por cento** | mais ou menos 2,9 pontos | 1092 |
| **no teto de 60 minutos** | 27,2 por cento | 53,9 por cento | mais ou menos 4,8 pontos | 408 |

A leitura PRE **reproduz o Achado 8 da pesquisa numero a numero** (55,3 / 55,9 / 72,8 / 53,9), o que confirma que a sonda versionada e a sonda descartavel da pesquisa medem a mesma coisa, e que a comparacao PRE contra POS no fechamento e valida.

### O que o canal absoluto faz com esse numero

| Configuracao (Achado 8) | Taxa total | Taxa por nexo | Fracao decidida por nexo |
|---|---|---|---|
| BASELINE (hoje) | 55,3 por cento mais ou menos 2,5 | 55,9 por cento mais ou menos 3,0 | 72,8 por cento (n=1092) |
| candidato (acumulo taxa 2 mais vantagem) | 54,1 por cento mais ou menos 2,5 | 54,1 por cento mais ou menos 2,5 | **100,0 por cento** (n=1500) |
| **alavanca descartada: `forceFloor = 0,40`** | 56,3 por cento mais ou menos 2,5 | **58,3 por cento mais ou menos 2,9** | 78,1 por cento (n=1172) |

**Primeira leitura: o vies nao aumenta.** 54,1 contra 55,3, uma diferenca de 1,2 ponto percentual com IC95 de mais ou menos 2,5 pontos nos dois lados. A taxa condicional por nexo, que e onde o achado original localiza o mecanismo, vai de 55,9 para 54,1: tambem nao piora.

**Segunda leitura: a exposicao muda de verdade.** Hoje 27,2 por cento das partidas terminam no teto de 60 minutos, e essas partidas sao muito menos enviesadas (53,9 por cento contra 55,9 por cento). Sob o canal absoluto praticamente 100 por cento das partidas terminam por nexo. **A Fase 25 nao amplifica o vies, mas passa a expor a populacao inteira a ele.** Vale registrar o contraponto honesto: isso na verdade **facilita** o trabalho de quem pegar o conserto, porque some a variavel de confusao "partida decidida por tempo".

**Terceira leitura, e ela e mais um argumento contra o caminho 1:** o piso no `force` mede **58,3 por cento** no recorte por nexo, o valor mais alto de toda a tabela. O caminho descartado nao e apenas inerte: e o unico da tabela que **amplifica** o vies.

### Regra de alerta (nao e criterio de parada desta fase)

> Se a taxa condicional nas partidas decididas por nexo subir acima de **58 por cento** com N maior ou igual a 1500, isso e sinal de amplificacao REAL. A acao correta e abrir **item novo de backlog** com dono, **nunca** um conserto dentro da Fase 25.

---

## Como usar este documento

**Se voce esta calibrando no meio da fase** e sentiu vontade de mexer no limiar `0,18`, de por um piso no `force`, ou de subir o `base`, leia a secao correspondente aqui **antes** de gastar uma iteracao. Cada uma tem o numero que fecha o assunto e o mecanismo que o produz. Os tres foram medidos, os tres falham, e dois deles custam a regeneracao de golden da fase.

**Se o termo de vantagem nao esta entregando a razao de torres**, veja os caminhos 4 e 5 antes de subir o expoente: a fonte pode estar lendo a camada errada, e nesse caso nenhum expoente resolve.

**Se voce esta numa fase futura** e quer reabrir um destes caminhos, o requisito e simples e nao e negociavel: **traga medicao nova**. Cada linha aqui tem numero e mecanismo, contra um commit nomeado da engine. Reabrir com argumento e mais barato do que com dado, e foi exatamente assim que a v2.0 chegou a uma engine de 51 minutos aprovada com 13 de 13 gates verdes.

**Se um gate da fase ficar vermelho de forma inesperada**, confira antes a lista de sinais de alerta da tabela do topo: quatro dos cinco caminhos descartados tem uma assinatura reconhecivel no relatorio, e reconhece-la economiza a iteracao inteira.
