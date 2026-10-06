# Fase 25C: o sweep das alavancas de acoplamento

**Fase:** 25C-causalidade-entre-eventos
**Commit base da fase:** `4ede940` (gravado em `docs/diagnostics/25C-ancoragem.md`, Bloco 1)
**Proposito:** registrar, alavanca por alavanca, o criterio ESCRITO ANTES da medicao, a grade medida e o veredito, para que nenhuma escolha desta fase possa ser lida no futuro como retro-justificada.

---

## Secao 1: o destino do peso orfao das duas intencoes sem resolvedor

**Plano de origem:** 25C-03 (Task 3), onda 3.
**Estado de entrada:** o commit `00d394e` tirou `cross_map` e `defend_base` da uniao de intencoes e dos DOIS sitios que davam peso a elas. Este documento decide o que fazer com o peso que elas carregavam.

### 1.0 O CUSTO SEMANTICO, declarado e nao escondido

As duas intencoes removidas sao conceitos de macro legitimos. Elas eram, alem de `pickoff` e `split_push`, os unicos pesos que o ramo de **estar de frente para um Elder inimigo** aplicava: aquele ramo aplicava quatro conceitos e passa a aplicar dois. Remove-las muda esse ramo.

**Esse custo nao aparece em banda nenhuma.** Ele aparece no playback, e a pesquisa desta fase nao assistiu a nenhuma partida. Por isso ele vai ao **checkpoint humano da onda 6**, com a frase escrita aqui e nao inventada la:

> O ramo de jogar em volta de um Elder inimigo passou a aplicar menos conceitos de macro, e nenhuma banda desta milestone mede isso.

### 1.1 O CRITERIO, escrito ANTES de a variante B ser medida

**Este bloco foi commitado antes de qualquer numero da variante B existir, e essa ordem e verificavel por `git show`.** O precedente e o plano 25B-05 e o Bloco 2 da ancoragem desta fase. Um criterio escrito depois da medicao e indistinguivel, para quem le o repositorio no futuro, de um criterio escolhido para caber no numero que saiu.

Os criterios sao aplicados **em ordem**. Uma variante que falhe num criterio esta eliminada e os seguintes nao a resgatam.

1. **Regras duras da v2.0 em ZERO ABSOLUTO nos seis tiers**, e nenhuma torre antes de 7:00 nos seis tiers. Variante com qualquer violacao esta **eliminada**, sem discussao e sem compensacao.

2. **As cinco bandas de nivel do criterio 4 do roadmap dentro, no tier EQUILIBRADO.** As cinco sao torres por minuto, torres aos 20:00, mediana da primeira torre, placas por partida e razao de torres do vencedor sobre o perdedor. Atencao especial as duas mais apertadas:
   - a **duracao**, cujo piso deixa **0,987 min** de folga (media 29,99 min contra o piso de 29,000);
   - a **mediana da primeira torre**, cujo piso deixa **60 s** de folga (840 s contra o piso de 780 s), e que e **a restricao que morde primeiro nesta fase**.

3. **As bandas de dispersao e de forma da Fase 25B que estavam DENTRO continuam dentro.** Nenhuma delas pode ser devolvida para acomodar o resultado.

4. **CRITERIO 3b, ACRESCENTADO NESTA ONDA E ESCRITO ANTES DE MEDIR A VARIANTE B, com a razao.**
   **A banda de preservacao de P2 quebrou na variante A e isso muda o peso desta secao.** P2 (`baron_taken` depois de queda de torre) e o par que a fase declarou que iria **PRESERVAR**, com piso em 0,95 vezes o PRE, ou seja **1,951**. Medido depois do commit `00d394e`: **1,852**, razao **0,902**. A banda nasceu verde na onda 2 e **ficou vermelha nesta onda**.

   Isso nao e surpresa e o registro mostra que nao e: o Bloco 2.13 da ancoragem escreveu, antes do primeiro conserto, que *"P2 e o par mais fragil da fase apesar de ser o unico que ja esta acoplado: o risco dele nao e de nao alcancar, e de ser gasto para pagar P1"*. A banda existe exatamente para que isso nao passasse em silencio, e ela cumpriu a funcao dela na primeira onda de motor.

   **Portanto, e escrito antes de medir:** entre as variantes que sobreviverem aos criterios 1 a 3, **a que devolver P2 acima de 1,951 vence as que nao devolverem**, e esse criterio vem **antes** do criterio de duracao. A razao e de ordem: duracao e insumo da Fase 26 e nao e alvo declarado desta fase; P2 e banda ativa **desta** fase, e gastar um par preservado para pagar outro e o modo de falha que o piso de preservacao existe para fechar.

   **Se NENHUMA variante devolver P2**, a banda fica vermelha, declarada e com dono, e o desfecho vai junto com P1 e P3 ao checkpoint de decisao da onda 5, no molde do criterio 3 da Fase 25B, que fechou com banda em aberto e regiao provada vazia **em vez de afrouxar a banda**. Afrouxar o piso de P2 aqui esta proibido pelo plano e por este documento.

5. **Entre as variantes que sobreviverem aos criterios acima, a que deixar a duracao MAIOR**, porque folga de duracao e o insumo direto da Fase 26 e esta e a unica onda da fase que a devolve.

6. **Como desempate, a que mexer menos na share de decisao**, medida pela distancia total entre as distribuicoes de intencao antes e depois.

### 1.2 AS DUAS VARIANTES, declaradas antes de medidas

| variante | o que faz | estado |
| --- | --- | --- |
| **A, largar o peso** | o peso das duas intencoes simplesmente desaparece da tabela; a massa normalizada se redistribui entre as intencoes restantes | e o estado que o commit `00d394e` deixou, ja medido |
| **B, redirecionar o peso** | o peso das duas intencoes vai para `split_push`, que ja tem resolvedor e tem a semantica mais proxima de `cross_map`, preservando a massa que cada ramo e cada tag aplicavam | aplicada de forma **TRANSITORIA** para medicao, com o estado devolvido ao commitado ao fim e a restauracao provada por **hash de objeto** dos arquivos tocados, nunca por status de arvore |

**A variante B, ponto a ponto, para que ela seja reproduzivel sem ambiguidade:**

- ramo de time atras: `cross_map` 1,2 mais `defend_base` 1,0 viram **mais 2,2 em `split_push`** (de 0,8 para 3,0);
- ramo de estar de frente para um Elder inimigo: `defend_base` 2,0 mais `cross_map` 1,5 viram **mais 3,5 em `split_push`** (de 1,0 para 4,5);
- mapa de vieses de comp, tag `split`: `cross_map` 0,3 vai para `split_push` (de 0,7 para 1,0);
- mapa de vieses de comp, tag `pick`: `cross_map` 0,3 vira `split_push` 0,3 (chave nova);
- mapa de vieses de comp, tag `disengage`: `defend_base` 0,4 mais `cross_map` 0,3 viram `split_push` 0,7 (chave nova, e a tag volta ao mapa).

A opcao (b) que a pesquisa citou (manter `defend_base` com resolvedor proprio e remover so `cross_map`) **nao entra nesta grade**, e a razao esta medida e nao suposta: dar resolvedor a uma intencao roteando-a para a pressao estrutural leva o silencio a 4,872 por cento em vez de zero, porque o gate `force <= 0.18` curto-circuita, e reabriria o criterio 3 que esta secao existe para manter fechado.

### 1.3 A ESCOLHA E PROVISORIA, e isso precisa estar escrito

**As alavancas desta fase nao somam.** Uma variante medida com apenas esta ligacao ativa pode inverter quando as tres da onda 4 estiverem ligadas: a propria pesquisa mediu que as alavancas competem pela mesma massa de peso normalizada, que o efeito de forca **satura e depois inverte**, e que o conjunto recomendado devolve P2 a razao 0,959 enquanto esta alavanca sozinha a deixa em 0,947 na janela de observacao.

Por isso a variante escolhida aqui volta como **coluna binaria no ponto de operacao escolhido pelo sweep do conjunto**, na onda 5, e **nao** como grade cruzada, que dobraria o custo sem dobrar a informacao.

### 1.4 A GRADE MEDIDA

**Procedencia:** gate de ritmo nos seis tiers (`npm run calibrate:pace`, N = 800 por tier), gate estrutural (`npm run calibrate:structures`), sonda de forma (`npm run probe:shape`) e sonda de lift no tier de referencia (`LIFT_N=800 npm run probe:lift`, W = 60 s, tier EQUILIBRADO 75 contra 75). Artefatos: `tmp/pace-varA-25C-03.txt`, `tmp/pace-varB-25C-03.txt`, `tmp/lift-pos-25C-03.txt`, `tmp/lift-varB-25C-03.txt`.

A variante B foi aplicada de forma **transitoria** e o estado voltou ao commitado, com a restauracao provada por **hash de objeto** dos dois arquivos tocados e nao por status de arvore:

| arquivo | blob commitado | blob na arvore ao fim | veredito |
| --- | --- | --- | --- |
| `src/sim/engine.ts` | `0f8a5302cbe3` | `0f8a5302cbe3` | IDENTICO |
| `src/sim/teamComp.ts` | `04662412a259` | `04662412a259` | IDENTICO |

**NIVEL, FORMA E ACOPLAMENTO NA MESMA LINHA**, que e a unica forma de ver a troca:

| grandeza | banda | PRE (base da fase) | **VARIANTE A** | **VARIANTE B** | quem ganha |
| --- | --- | --- | --- | --- | --- |
| **regras duras da v2.0, seis tiers** | zero absoluto | 0 em 12 de 12 | **0 em 12 de 12** | **0 em 12 de 12** | empate, as duas sobrevivem |
| torres por minuto | [0,300; 0,450] | 0,357 | 0,357 | 0,360 | empate (dentro) |
| torres aos 20:00 | [2,500; 5,000] | 4,760 | 4,668 | 4,799 | empate (dentro) |
| **mediana da primeira torre (s)** | [780; 1140] | 840 | **840** | **840** | empate, e nenhuma consumiu a folga de 60 s |
| placas por partida | [5,000; 12,000] | 11,275 | 11,335 | 11,256 | empate (dentro) |
| razao de torres vencedor sobre perdedor | [2,500; 4,500] | 3,689 | 3,490 | 3,674 | empate (dentro) |
| **duracao media (min)** | [29,000; 36,000] | 29,986 | **30,091** | **29,074** | **A, com folga 15 vezes maior** |
| folga de duracao contra o piso | | 0,987 min | **1,091 min (DEVOLVE 0,104)** | **0,074 min (GASTA 0,912)** | **A** |
| dispersao e forma da Fase 25B | 10 linhas | 5 dentro, 5 fora | 5 dentro, 5 fora | 5 dentro, 5 fora | empate, nenhuma devolvida |
| **P1** gank depois de torre, W = 60 | piso 1,832 | 1,593 | 1,492 | 1,480 | A por 0,012, irrelevante |
| **P2** Barao depois de torre, W = 60 | piso 1,951 | 2,054 | **1,852** | **1,864** | **NENHUMA devolve** |
| razao de P2 contra o PRE | exige 0,950 | 1,000 | **0,902** | **0,907** | nenhuma passa |
| **P3** luta ganha depois de epico, W = 60 | piso 1,503 | 1,307 | 1,229 | **1,306** | **B por 0,077** |
| IC95 inferior de P1 / P2 / P3 | piso 1,050 | 1,256 / 1,921 / 1,216 | 1,180 / 1,749 / 1,140 | 1,155 / 1,743 / 1,215 | empate (as tres dentro) |
| **controles internos C1 / C2 / C3** | cobrir 1,000 | 0,973 / 1,130 / 1,103 | **0,914 / 0,787 / 0,949** | 0,985 / 1,078 / 1,133 | **B**, e ver 1.6 |
| draws por TICK | sem banda | 4,9991 | 5,1041 | 4,9712 | observacao |
| ticks silenciosos (total) | sem banda | 0,5958 | 0,5901 | 0,5940 | observacao |
| silencio por CAMINHO MORTO | criterio 3 | 5,357 por cento | **0,000 por construcao** | **0,000 por construcao** | empate, as duas fecham o criterio |
| contagem de bandas | | 26 verdes / 16 vermelhas | 26 / 16 | 26 / 16 | empate |

### 1.5 O VEREDITO, criterio por criterio e na ordem escrita

| criterio | veredito | por que |
| --- | --- | --- |
| **1. regras duras em zero** | **as duas sobrevivem** | 0 em 12 de 12 contagens nas duas (seis tiers vezes duas regras) |
| **2. cinco bandas de nivel** | **as duas sobrevivem** | as cinco dentro nas duas, e a mediana da primeira torre ficou em 840 s nas duas, ou seja **nenhuma das duas consumiu um segundo da folga de 60 s** que e a restricao que morde primeiro nesta fase |
| **3. bandas da Fase 25B dentro continuam dentro** | **as duas sobrevivem** | nenhuma linha de dispersao ou forma mudou de cor em qualquer das duas |
| **3b. devolver P2 acima de 1,951** | **NAO DISCRIMINA** | A le 1,852 (razao 0,902) e B le 1,864 (razao 0,907). **Nenhuma das duas devolve P2**, e a diferenca entre elas (0,012) e menor que a largura do IC das duas. O criterio 3b nao elimina nenhuma e o desfecho de P2 esta em 1.6 |
| **5. duracao MAIOR** | **VENCE A VARIANTE A** | A deixa **30,091 min** e B deixa **29,074 min**. A **devolve** 0,104 min de folga e B **gasta** 0,912 dos 0,987 disponiveis, ou seja **92,4 por cento da folga com que a fase entra**, deixando 0,074 min ate o piso |
| **6. desempate por share de decisao** | **nao foi preciso** | o criterio 5 decidiu sozinho, por uma margem de 1,017 min |

**A ESCOLHA E A VARIANTE A: largar o peso.** Nenhum valor novo e commitado, e o estado do commit `00d394e` fica.

**O numero que decidiu, e vale registrar por que ele e tao grande:** a variante B custa **0,912 min**, praticamente identico aos **0,913 min** que a pesquisa mediu para a saida de *dar resolvedor* as duas intencoes (secao Z3 de `25C-RESEARCH.md`). As duas maneiras de manter o peso vivo (rotear para a pressao estrutural, ou redirecionar para `split_push`, que **e** roteado para a pressao estrutural) custam a mesma coisa, e a razao e a mesma: elas empurram massa de decisao para o ramo que derruba estrutura, e derrubar estrutura mais cedo encurta a partida. **A convergencia dos dois numeros por dois caminhos independentes e a evidencia mais forte desta secao de que o custo e mecanico e nao ruido.**

**O que se perde ao escolher A, dito sem suavizar:** B deixaria P3 em **1,306** contra **1,229** de A, ou seja praticamente de volta ao PRE de 1,307. P3 e o par de maior risco da fase, com distancia negativa declarada de 0,115 desde a onda 2. **Escolher A custa 0,077 de P3 hoje.** A escolha e assim mesmo porque o criterio foi escrito antes e porque a onda 5 tem alavanca declarada para P3 (`Z5`, a janela pos-evento) e **nao** tem alavanca declarada para devolver folga de duracao: esta e a unica onda da fase que devolve. Trocar a ordem dos criterios depois de ver o numero de P3 seria exatamente o vicio que esta secao existe para impedir.

### 1.6 DOIS ITENS ABERTOS QUE ESTA SECAO CRIA, com dono e sem escondimento

**(1) A banda de preservacao de P2 esta VERMELHA e nenhuma variante a devolve.**

P2 le **1,852** contra o piso de **1,951**, razao **0,902** contra os 0,950 exigidos. **O piso NAO foi afrouxado e nao pode ser**, pelo plano e pela secao 1.1.

O que a medicao autoriza dizer, e ela e menos ruim do que o numero isolado sugere:

- A pesquisa mediu a mesma alavanca em W = 180 s e achou razao **0,947** (1,612 sobre 1,702). Esta onda reproduziu **exatamente** esse numero (1,612 em W = 180 s), o que confirma que a alavanca aplicada e a que a pesquisa mediu e nao outra coisa.
- A mesma pesquisa mediu o **conjunto recomendado** `Z1+Z2+Z3b+Z5(1,0)` em razao **0,959** para P2, ou seja **acima** dos 0,950. As alavancas nao somam, e a onda 4 e a onda 5 podem devolver P2 sozinhas.
- Na janela em que a banda vive (60 s) a razao e pior (0,902) do que na janela de observacao (0,947), e **esse buraco de transporte entre janelas ja estava declarado** no Bloco 2.13 da ancoragem, antes do primeiro conserto.

**Dono: onda 5**, junto com P1 e P3, no checkpoint de decisao, no molde do criterio 3 da Fase 25B, que fechou com banda em aberto e regiao provada vazia por grade **em vez de afrouxar**. **Se a onda 5 nao devolver P2, o fechamento da fase precisa dizer que a fase gastou um par preservado para pagar os que ela move**, que e exatamente o que o piso de preservacao existe para tornar impossivel de esconder.

**(2) O controle interno C1 saiu de 1,000 na variante escolhida, e o alerta e do INSTRUMENTO.**

| controle | PRE | variante A (escolhida) | variante B |
| --- | --- | --- | --- |
| **C1** dragao sem contestacao, depois torre | 0,973 [0,881; 1,059] | **0,914 [0,832; 0,998]** | 0,985 [0,907; 1,066] |
| C2 voidgrubs, depois torre | 1,130 [0,774; 1,532] | 0,787 [0,466; 1,157] | 1,078 [0,706; 1,449] |
| C3 gank, depois gank mesma rota | 1,103 [0,896; 1,313] | 0,949 [0,774; 1,155] | 1,133 [0,920; 1,359] |

**C1 exclui 1,000 por 0,002, POR BAIXO.** C2 e C3 continuam cobrindo 1,000 com folga.

O que fica registrado agora, sem inventar explicacao:

- **A direcao e a conservadora.** Um controle que le abaixo de 1,000 nao fabrica acoplamento: ele subestima. Para um gate que asserta "existe acoplamento", errar para baixo e a direcao certa do erro, e por isso este alerta **nao** invalida a leitura dos tres pares desta onda.
- **O valor esta abaixo do envelope de vies ja medido.** O Bloco 2.12 da ancoragem mediu o vies do estimador no perfil temporal de dragao em **0,972 e 0,973** em W = 60 s. O 0,914 esta abaixo disso, ou seja **nao** e inteiramente explicado pelo vies conhecido do estimador.
- **Nenhum criterio, piso ou janela foi mexido por causa deste bloco**, pela mesma disciplina do Bloco 2.12: quando um controle dispara, a separacao das leituras possiveis vem **por medicao** e antes de qualquer criterio se mover. Esta onda nao fez essa separacao, e por isso ela nao afirma nada sobre a causa.
- **Dono: onda 7**, junto com o residuo de C3 que a onda 2 ja deixou aberto, e com a obrigacao de remedir a cobertura do proxy. A onda 7 tem de dizer se C1 volta a cobrir 1,000 com o motor ao fim das ondas de decisao, ou se o instrumento precisa de conserto proprio.

**Fica escrito para nao ser esquecido:** a variante B lia os tres controles cobrindo 1,000 com folga. Isso **nao** foi usado como criterio de escolha, porque o criterio foi escrito antes e nao inclui os controles, e porque controle e instrumento e nao alvo. Mas e um dado a favor de reexaminar B na onda 5, e por isso ele esta impresso aqui e nao apenas mencionado.

---

## Secao 2: as tres ligacoes de estado da onda 4

**Plano de origem:** 25C-04, onda 4.
**Estado de entrada:** o commit `fe248f5` fechou a onda 3. Esta secao registra as tres ligacoes de estado do criterio 4 do roadmap, **uma por commit**, com a medicao dos quatro harnesses em cada uma.

**Procedencia de toda a secao:** gate de ritmo nos seis tiers (`npm run calibrate:pace`, N = 800 por tier), gate estrutural (`npm run calibrate:structures`), sonda de forma (`npm run probe:shape`) e sonda de lift no tier de referencia (`LIFT_N=800 npm run probe:lift`, W = 60 s, tier EQUILIBRADO 75 contra 75). Artefatos: `tmp/pace-PRE-25C-04.txt`, `tmp/pace-t1-25C-04.txt`, `tmp/pace-t2-25C-04.txt`, `tmp/pace-t3-25C-04.txt`, `tmp/lift-pre-25C-04.txt`, `tmp/lift-t1-25C-04.txt`, `tmp/lift-t2-25C-04.txt`, `tmp/lift-t3-25C-04.txt` e `tmp/shape-PRE-25C-04.txt` a `tmp/shape-t3-25C-04.txt`.

### 2.0 A LEITURA PRE FOI REMEDIDA, e ela reproduz a onda 3 numero por numero

A leitura PRE desta onda **nao foi copiada da onda anterior**: ela foi remedida no proprio commit de entrada (`c5c2630`), devolvendo os dois arquivos de motor de forma **transitoria** e restaurando a arvore com prova por **hash de objeto**:

| arquivo | blob commitado | blob na arvore ao fim | veredito |
| --- | --- | --- | --- |
| `src/sim/engine.ts` | `5e3d85e07824` | `5e3d85e07824` | IDENTICO |
| `src/sim/engine.test.ts` | `84e9dbb92900` | `84e9dbb92900` | IDENTICO |

**O PRE remedido bate com a onda 3 em todas as grandezas de veredito:** P1 = 1,492; P2 = 1,852; P3 = 1,229; duracao 30,091 min; mediana da primeira torre 840 s; draws por tick 5,1041. Isso **valida a cadeia de medicao inteira** desta onda em vez de supor que ela mede a mesma coisa que a anterior. Todas as comparacoes desta secao sao contra este PRE.

### 2.1 AS TRES LIGACOES, com o commit e a constante de cada uma

| ordem | ligacao | commit | constante nova | grade declarada | valor de entrada |
| --- | --- | --- | --- | --- | --- |
| 1 | rota do gank ponderada pelo estado | `116b402` | `GANK_FOCUS_TEMPERATURE` | 1 / 2 / 4 / 8 / **16** | **16, o mais ACHATADO** |
| 2 | morte de teamfight move o lead da rota | `48295de` | nenhuma | | |
| 3 | janela pos-evento na camada de decisao | `03800e0` | `POST_FIGHT_OBJECTIVE_W` | **0,5** / 1,0 / 1,5 | **0,5, o mais BAIXO** |

**Nenhum dos dois valores de entrada e ponto de operacao, e isso e escolha e nao omissao.** O ponto de operacao e escolhido pelo sweep do **conjunto** na onda 5, porque as alavancas desta fase **nao somam**: a pesquisa mediu, sobre o conjunto, `Z5b(4,0)` derrubando P1 de 1,473 para 1,319 e P3 de 1,090 para 1,060. As leituras de lift desta onda sao modestas **por desenho** e nao por falha.

**A razao de entrar no mais achatado da grade de temperatura esta MEDIDA:** com temperatura 1, que foi o valor da sonda da pesquisa, a mediana da primeira torre cai de 840 para **795 s**, ou seja consome 45 dos 60 s de folga e fica **abaixo da regra de parada de 800 s da propria fase**. Entrar ali deixaria a arvore violando a regra da fase entre as ondas 4 e 5, e nao existiria ponto valido para o sweep escolher.

### 2.2 A DECISAO DE DESENHO DO MAPEAMENTO DE LOCAL DE LUTA, com a alternativa ao lado

Esta e uma **leitura narrativa e nao um fato do jogo**, e por isso ela esta registrada aqui e vai ao **checkpoint humano da onda 6**:

- **ADOTADO:** uma luta no rio de cima conta como vantagem da rota de **cima**; uma no rio de baixo, da rota de **baixo**. O mesmo para as duas metades da selva. A base nao mapeia.
- **ALTERNATIVA REJEITADA:** so a rota do meio contar. O resolvedor de teamfight escolhe o local entre duas regioes de rio e a rota do meio, e apenas a ultima ja e uma rota; com a alternativa, **dois tercos das lutas nao moveriam lead de rota nenhuma** e a ligacao ficaria quase inerte.

> Nenhuma banda desta milestone mede se essa leitura faz sentido para quem assiste a partida.

A exaustividade do mapeamento e provada **pelo compilador**: a tabela e tipada como `Record<Region, Lane | null>`, entao acrescentar uma regiao nova ao tipo quebra a compilacao ate ela ser mapeada.

### 2.3 A GRADE MEDIDA, commit a commit

| grandeza | banda | **PRE** | **T1** rota do gank | **T2** lead da rota | **T3** janela pos-evento |
| --- | --- | --- | --- | --- | --- |
| **regras duras da v2.0, seis tiers** | zero absoluto | 0 em 12 de 12 | **0 em 12 de 12** | **0 em 12 de 12** | **0 em 12 de 12** |
| torres por minuto | [0,300; 0,450] | 0,357 | 0,356 | 0,365 | 0,366 |
| torres aos 20:00 | [2,500; 5,000] | 4,668 | 4,671 | 4,836 | 4,815 |
| **mediana da primeira torre (s)** | [780; 1140] | **840** | **825** | **810** | **810** |
| folga da primeira torre contra o piso | | 60 s | **45 s** | **30 s** | **30 s** |
| placas por partida | [5,000; 12,000] | 11,335 | 11,328 | 11,484 | 11,476 |
| razao de torres vencedor sobre perdedor | [2,500; 4,500] | 3,490 | 3,574 | 3,194 | 3,111 |
| **duracao media (min)** | [29,000; 36,000] | **30,091** | **29,792** | **30,680** | **30,368** |
| folga de duracao contra o piso | | 1,091 | **0,792** | **1,680** | **1,368** |
| **P1** gank depois de torre, W = 60 | piso 1,832 | 1,492 | 1,488 | 1,507 | **1,552** |
| **P2** Barao depois de torre, W = 60 | piso 1,951 | 1,852 | 1,827 | 1,812 | **1,911** |
| razao de P2 contra o PRE da fase (2,054) | exige 0,950 | 0,902 | 0,889 | 0,882 | **0,930** |
| **P3** luta ganha depois de epico, W = 60 | piso 1,503 | 1,229 | 1,263 | 1,369 | **1,364** |
| IC95 inferior de P1 / P2 / P3 | piso 1,050 | 1,180 / 1,749 / 1,140 | 1,200 / 1,691 / 1,179 | 1,189 / 1,702 / 1,278 | **1,175 / 1,793 / 1,273** |
| **controles internos C1 / C2 / C3** | cobrir 1,000 | 0,914 / 0,787 / 0,949 | 0,895 / 0,862 / 0,897 | 0,939 / 1,138 / 0,976 | **0,976 / 0,943 / 0,919** |
| C1x dragao COM luta, depois torre | observado | 1,246 | 1,221 | 1,369 | 1,278 |
| **draws por TICK** | sem banda | **5,1041** | **5,0906** | **5,1405** | **5,1133** |
| draws por PARTIDA | confundido pela duracao | 626,0 | 617,0 | 642,9 | 633,0 |
| ticks silenciosos (total) | sem banda | 0,5901 | 0,5906 | 0,5875 | 0,5876 |
| contagem canonica de `rng(` em `src/sim/` | exige 72 | 72 | **72** | **72** | **72** |
| contagem de bandas | | 26 verdes / 16 vermelhas | 26 / 16 | 26 / 16 | **26 / 16** |
| bandas que MUDARAM DE COR contra o PRE | zero | | **nenhuma** | **nenhuma** | **nenhuma** |

**A conferencia de cor foi feita linha a linha e nao pelo total.** A onda 3 mostrou que o total pode ficar constante com duas linhas trocando de cor, e por isso a comparacao aqui e da lista inteira de rotulos, com os valores numericos apagados. Resultado nas tres: **nenhuma banda mudou de cor em nenhum dos tres commits**.

### 2.4 O QUE CADA LIGACAO MOVEU, e o que ela NAO moveu

**T1, a rota do gank ponderada. Ela nao move par nenhum sozinha nesta temperatura, e isso era o esperado.** P1 le 1,488 contra 1,492 do PRE, uma diferenca de 0,004 dentro de um IC de largura 0,6. **Isso nao e falha da ligacao: e a consequencia direta de entrar no valor mais achatado da grade.** A pesquisa mediu esta mesma alavanca em temperatura 1 movendo P1 de 1,173 para 1,308, e a temperatura 16 divide o termo de estado por dezesseis. O mecanismo esta pousado e provado por teste; o ganho e da onda 5.

Os movimentos de NIVEL de T1 tambem **nao sao significativos**, e o numero que autoriza dizer isso: com desvio de duracao de 425 s e N = 800, o erro padrao e **0,250 min**, e a variacao PRE para T1 e de 0,299 min, ou seja **1,20 erro padrao**. A mediana da primeira torre se move em degraus de 15 s porque o tick e de 15 s, entao 840 para 825 e **um unico degrau**.

**T2, a morte de teamfight movendo o lead da rota. E ela que faz o par de luta ganha para objetivo epico andar de verdade:** P3 de 1,263 para **1,369**, mais 0,106, com o limite inferior do IC subindo junto (1,179 para 1,278). E ela **devolve folga de duracao**: 29,792 para 30,680 min, mais 0,888.

**A leitura que confirma a nao aditividade prevista pela pesquisa, medida DENTRO desta fase e nao importada:** isolada, esta ligacao movia P1 de 1,173 para apenas 1,195; aqui, **em cima da rota ponderada**, ela leva P1 de 1,488 para 1,507 e P3 de 1,263 para 1,369. Ela **potencializa** a anterior, exatamente como a pesquisa previu, porque so faz sentido gankar a rota certa se o lead da rota refletir o que aconteceu nas lutas. **Esta e a evidencia direta de que o sweep tem de ser sobre o conjunto e nunca uma alavanca por vez.**

**T3, a janela pos-evento. E a unica das tres que devolve P2**, e o faz sem custar as outras: P2 de 1,812 para **1,911** e P1 de 1,507 para **1,552**, com P3 praticamente parado (1,369 para 1,364, dentro do IC). O mecanismo e coerente com o que a pesquisa mediu: usar a vantagem numerica em `setup_*` rende mais do que usa-la em `force_fight`, porque e ali que P2 e P3 vivem.

### 2.5 O SALDO DA ONDA, contra o PRE e nao contra o commit anterior

| grandeza | PRE | fim da onda 4 | variacao | piso | veredito |
| --- | --- | --- | --- | --- | --- |
| **P1** gank depois de torre | 1,492 | **1,552** | **mais 0,060** | 1,832 | vermelha, faltam 0,280 |
| **P2** Barao depois de torre | 1,852 | **1,911** | **mais 0,059** | 1,951 | **vermelha, faltam 0,040** |
| razao de P2 contra o PRE da fase | 0,902 | **0,930** | mais 0,028 | 0,950 | **NAO devolveu, mas encostou** |
| **P3** luta ganha depois de epico | 1,229 | **1,364** | **mais 0,135** | 1,503 | vermelha, faltam 0,139 |
| duracao media (min) | 30,091 | **30,368** | mais 0,277 | 29,000 | dentro, folga 1,368 |
| mediana da primeira torre (s) | 840 | **810** | **menos 30** | 780 | dentro, folga 30 s |
| draws por TICK | 5,1041 | 5,1133 | mais 0,18 por cento | sem banda | observacao |

**As tres ligacoes juntas movem os tres pares na direcao certa, e nenhuma delas alcanca o piso.** Este e o ponto de partida do sweep da onda 5, e ele existe com as duas constantes no valor **mais proximo do no-op**: a onda 5 tem grade inteira para andar em cima disso e **nao precisa recuperar terreno perdido**.

**A duracao terminou ACIMA do PRE** (mais 0,277 min, ou seja mais folga do que a onda recebeu) e **a variacao inteira esta dentro de 1,2 erro padrao**, entao a leitura honesta e que **a onda 4 nao gastou folga de duracao**. Isso contraria a previsao da pesquisa, que projetava menos 0,714 min so na rota do gank, e a explicacao esta na temperatura: aquele numero foi medido em temperatura 1.

**A mediana da primeira torre gastou 30 dos 60 s de folga, e ela e a restricao que morde primeiro.** Ela foi medida a cada commit e **nunca cruzou os 800 s da regra de parada da fase**: 840, 825, 810 e 810. Os 810 s deixam **dois degraus de tick** ate a regra de parada e quatro ate o piso da banda. **A onda 5 comeca com metade da folga que a onda 4 recebeu, e o sweep dela precisa tratar isso como o primeiro orcamento a estourar.**

### 2.6 ARIDADE: aridade preservada contra efeito de trajetoria, e a distincao esta medida

**As tres ligacoes sao rng-free e a aridade esta exatamente preservada.** As provas, em ordem de forca:

1. **Por assinatura e pelo compilador.** `pickGankLane` declara 3 parametros e nenhum e gerador; `placeToLane` declara 1; `applyFightLaneLead` declara 3; `applyPostFightObjectiveWeights` declara 3. Os quatro sao asserados por `.length` no teste, no padrao que a Fase 25B usou em `accrueSiegePressure`.
2. **Pela contagem canonica.** `rng(` em `src/sim/` segue em **72** nos tres commits, e a linha do gate de pressao estrutural segue com **ocorrencia unica byte a byte**.
3. **Pelo consumo no ponto de chamada.** O sorteio de rota do gank continua na mesma linha e na mesma posicao: 1 draw, provado por gerador instrumentado dentro do proprio teste.
4. **Pelos quatro canarios de aridade**, verdes POR NOME nos tres commits.

**O que NAO e prova de aridade quebrada, e a distincao importa:** os draws por partida de uma semente fixa **mudam**, e devem mudar. Medido na fixture flat com 5 sementes por cenario: com a rota ponderada, **7 das 10 partidas medidas terminaram com o numero de sorteios IDENTICO ao de antes** e 3 divergiram; ao fim das tres ligacoes, todas divergiram. **Isso e efeito de TRAJETORIA:** o mesmo codigo consumindo o gerador em ramos diferentes porque o estado e outro, e nao consumo novo. A leitura de veredito da fase e **draws por TICK**, e ela andou de 5,1041 para 5,1133, ou seja **mais 0,18 por cento**.

### 2.7 A SONDA DE FORMA, e o ganho colateral que NAO existiu

A sonda de forma rodou nos tres commits porque **concentrar o gank numa rota e a mesma direcao do mecanismo de concentracao da Fase 25B**, e ha risco real de interacao nos dois sentidos.

| metrica de forma | PRE | T1 | T2 | T3 |
| --- | --- | --- | --- | --- |
| vitoria com exatamente UMA rota limpa | 38,8 por cento | 40,1 | 34,8 | **37,5** |
| shutout (perdedor com 0 ou 1 torre) | 46,0 por cento | 47,5 | 43,1 | **41,1** |
| vitoria que exigiu limpar as TRES rotas | 13,3 por cento | 12,6 | 15,8 | **14,8** |
| exatamente 9 a 0 | 1,9 por cento | 1,9 | 2,3 | **2,0** |

**A metrica de vitoria por uma rota terminou 1,3 ponto ABAIXO do PRE.** Ou seja: **nao ha ganho colateral para atribuir**, e essa e a leitura honesta. O plano mandava atribuir corretamente um ganho colateral caso ele aparecesse; ele nao apareceu, e registrar isso e tao importante quanto registrar o contrario teria sido. **Nenhuma das quatro mudou de cor**, e as duas vermelhas ja eram vermelhas com a Fase 25B como dona.

### 2.8 O CONTROLE C3 DEIXOU DE SER CONTROLE, e isso estava avisado

A onda 3 escreveu, antes desta onda existir: *"a onda 4 mexe na rota do gank, e a partir dali C3 deixa de ser controle por passar a existir caminho mecanico"*. **Confirmado, e o aviso se cumpriu exatamente como escrito.**

`C3` e *gank, depois gank na mesma rota*. Enquanto a rota era sorteada uniformemente, o valor verdadeiro dele era 1,000 **por construcao**, e era isso que fazia dele um controle. **A partir do commit `116b402` existe caminho mecanico:** o lead de rota deixado por um gank pondera o proximo, e dois ganks seguidos na mesma rota deixam de ser independentes por desenho.

**C3 sai da lista de controles a partir desta onda e passa a ser observacao.** Ele continua sendo impresso, porque o valor dele ainda informa, mas **nenhuma leitura futura pode usar C3 como validacao do instrumento**. Restam C1 e C2 como controles. **A onda 7, que ja e dona do residuo de C3 e do alerta de C1, herda tambem a pergunta de se um terceiro controle precisa ser construido** para repor o que C3 deixou de cobrir.

### 2.9 O QUE ESTA SECAO FECHA E O QUE ELA DEIXA ABERTO

**FECHA:**

- **O criterio 4 do roadmap tem as tres ligacoes pousadas**, com prova estrutural por assinatura e por teste, e nao por opiniao.
- **A identidade em neutro sobrevive POR CONSTRUCAO.** Com os tres pesos iguais, o acumulador de comparacao ESTRITA reproduz o sorteio uniforme byte a byte sobre 3000 pontos de grade densa, **inclusive nas duas fronteiras** onde a convencao `<= 0` divergiria. Isso **nao depende de valor de constante nenhum**, entao o sweep da onda 5 nao pode quebra-lo por calibracao.
- **O alerta C1 da onda 3 voltou a cobrir 1,000** (0,914 para **0,976 [0,890; 1,074]**). **Isto NAO esta sendo reivindicado como conserto**: nenhuma das tres ligacoes toca no estimador nem no perfil temporal do dragao, e o valor andou por deslocamento de trajetoria. **O item continua com o dono dele na onda 7**, pela mesma disciplina com que a onda 3 se recusou a reivindicar o verde acidental de `D-25B-01`.

**DEIXA ABERTO:**

- **A banda de preservacao de P2 segue VERMELHA**, agora em razao **0,930** contra os 0,950 exigidos. Ela **melhorou 0,028** nesta onda e **faltam 0,040** em valor absoluto. O piso **nao foi afrouxado**. Dono: **onda 5**.
- **C3 deixou de ser controle** (2.8). Dono: **onda 7**.
- **A folga da mediana da primeira torre caiu de 60 para 30 s.** Dono: **onda 5**, como primeiro orcamento do sweep.
- **A leitura narrativa do mapeamento de local de luta** (2.2). Dono: **checkpoint humano da onda 6**.

---

## Secao 3: o sweep do CONJUNTO e o ponto de operacao da fase

**Plano de origem:** 25C-05, onda 5.
**Estado de entrada:** o commit `b77d5f4` fechou a onda 4, com as tres ligacoes ligadas e as duas constantes no valor mais proximo do no-op (`GANK_FOCUS_TEMPERATURE = 16` e `POST_FIGHT_OBJECTIVE_W = 0,5`).

**ESTE BLOCO 3.0 a 3.4 FOI COMMITADO ANTES DE QUALQUER NUMERO NOVO DA GRADE EXISTIR, e essa ordem e verificavel por `git show`.** O precedente e o Bloco 1.1 desta mesma pagina e o plano 25B-05. Um criterio escrito depois da medicao e indistinguivel, para quem le o repositorio no futuro, de um criterio escolhido para caber no numero que saiu.

### 3.0 A EXCECAO DECLARADA: este sweep varre DOIS parametros ao mesmo tempo

> **A disciplina desta milestone e um parametro por commit, e ela vale.** Esta secao abre uma **excecao consciente e declarada**, exatamente como o sweep bidimensional da Fase 25 abriu a dela. A excecao esta escrita aqui, antes da medicao, e nao justificada depois.

**O QUE A EXCECAO E, ponto a ponto:**

- a grade cruza **dois** parametros ao mesmo tempo, `GANK_FOCUS_TEMPERATURE` e `POST_FIGHT_OBJECTIVE_W`;
- as **duas ligacoes sem parametro** da onda 4 (o lead de rota movido pelas lutas, e a rota do gank ponderada como mecanismo) ficam **LIGADAS em todos os quinze pontos**;
- portanto nenhum ponto desta grade e a medicao de uma alavanca isolada, e nenhum numero desta secao pode ser citado no futuro como "o efeito de X".

**A JUSTIFICATIVA, e ela e uma MEDICAO e nao um argumento de conveniencia. As alavancas desta fase NAO SOMAM:**

| medicao | valor | fonte |
| --- | --- | --- |
| par de gank para torre com as tres ligadas, sem a janela pos-evento | **1,473** | `25C-RESEARCH.md`, conjunto `Z1+Z2+Z3b` |
| o mesmo par acrescentando a janela pos-evento no valor BAIXO | **1,487** | `25C-RESEARCH.md`, `Z5(1,0)` sobre o conjunto |
| o mesmo par acrescentando a janela pos-evento no valor ALTO | **1,319** | `25C-RESEARCH.md`, `Z5b(4,0)` sobre o conjunto |
| o par de luta para objetivo epico no mesmo ponto alto | **1,060**, contra 1,090 | `25C-RESEARCH.md`, `Z5b(4,0)` sobre o conjunto |

**Acrescentar forca sobre o conjunto DERRUBA o par que a fase mais quer mover, e o derruba para ABAIXO do que o subconjunto entregava.** O mecanismo esta escrito e nao suposto: todas as alavancas competem pela **mesma massa de peso normalizada**, entao reforcar a preparacao de objetivo rouba participacao de gank e de pressao, o que desfaz o ganho da rota ponderada.

**Consequencia direta:** varrer uma alavanca por vez atribuiria a cada uma um efeito que **depende das outras**, e o ponto escolhido seria o otimo de um problema que nao e o nosso. Um plano que medisse cada alavanca isolada e depois ligasse todas juntas entregaria **menos** que o subconjunto.

**A diferenca contra o precedente da Fase 25, dita para nao ser confundida:** la a excecao era sobre **duas constantes do mesmo resolvedor**; aqui e sobre **duas constantes de camadas diferentes** que disputam a mesma massa de peso. A excecao daqui e mais forte, e por isso ela precisa de justificativa medida em vez de precedente.

**Evidencia de nao aditividade medida DENTRO da fase e nao so importada da pesquisa** (Bloco 2.4): a segunda ligacao, isolada, movia P1 de 1,173 para 1,195; em cima da primeira ela move P1 de 1,488 para 1,507 e P3 de 1,263 para 1,369.

### 3.1 A GRADE, declarada antes de medida

| eixo | constante | valores | sentido |
| --- | --- | --- | --- |
| **temperatura de foco do gank** | `GANK_FOCUS_TEMPERATURE` | **1 / 2 / 4 / 8 / 16** | do mais CONCENTRADO ao mais ACHATADO; a temperatura DIVIDE o termo de estado, entao valor maior fica mais perto do sorteio uniforme |
| **peso da janela pos-evento** | `POST_FIGHT_OBJECTIVE_W` | **0,5 / 1,0 / 1,5** | do mais BAIXO ao mais alto |

**Quinze pontos.** O ponto (16; 0,5) e o estado commitado que a onda 4 deixou e entra na grade como qualquer outro.

**Custo de execucao MEDIDO antes de comecar**, para que a onda nao seja interrompida por surpresa de tempo:

| harness | custo por ponto |
| --- | --- |
| `npm run calibrate:pace` (6 tiers, N = 800) | 25 s |
| `LIFT_N=800 npm run probe:lift` (tier de referencia) | 24 s |
| `npm run calibrate:structures` (3 tiers) | 14 s |
| `npm run probe:shape` (2 tiers) | 11 s |
| **total por ponto** | **74 s** |
| **quinze pontos** | **cerca de 19 min** |

### 3.2 O CRITERIO DE ESCOLHA, em ordem, e cada item e eliminatorio ate o quarto

1. **REGRAS DURAS DA v2.0 EM ZERO ABSOLUTO NOS SEIS TIERS.** Nenhuma torre antes de 5:00, nenhum Baron antes de 20:00, nenhum multikill cedo, ator estrutural plausivel e freio de cascata; mais **nenhuma torre antes de 7:00 nos seis tiers**. Ponto com qualquer violacao esta **eliminado**, sem discussao e sem compensacao.
   **Este item roda nos SEIS tiers e nao no tier de referencia**, porque a violacao de 7:00 que barrou a Fase 25B apareceu no tier de **maior diferenca de roster** e nao no equilibrado. E ele e lido nos **contadores de assert duro** dos relatorios, e nao apenas nas linhas de banda: na Fase 25B tres pontos passaram por bons porque o retrato so conferia banda, e a violacao ja estava impressa no relatorio sem ninguem ver. **Regra dura em zero e condicao de EXISTENCIA do ponto, e nao mais uma linha da tabela.**

2. **A REGRA DE PARADA DA FASE, numerica e nao negociavel.** Duracao maior ou igual a **29,4 min** E mediana da primeira torre maior ou igual a **800 s**, no tier de referencia. Ponto abaixo de qualquer um dos dois esta **eliminado**, e **nao entra em desempate por ser "quase"**.
   **Os dois numeros sao METADE da folga com que a fase trabalha**, e a razao de reservar metade esta escrita: a Fase 26 corta cerca de 40 por cento dos abates e empurra as duas grandezas na **mesma** direcao ja apertada. **A alavanca e substituida em vez de calibrada para a fronteira.**

3. **AS CINCO BANDAS DE NIVEL DO CRITERIO 4 DO ROADMAP DENTRO no tier de referencia** (torres por minuto, torres aos 20:00, mediana da primeira torre, placas por partida e razao de torres do vencedor sobre o perdedor), **e nenhuma banda de dispersao ou de forma das Fases 25 e 25B que estava DENTRO pode sair**. Ponto que devolva qualquer uma delas esta **eliminado**. A conferencia e **linha a linha pela lista inteira de rotulos**, nunca pelo total: a onda 3 provou que o total pode ficar constante com duas linhas trocando de cor.

4. **AS BANDAS DE ACOPLAMENTO DA ONDA 2:** vence o ponto que colocar o **maior numero delas dentro**. Para cada par avalia-se o **valor** E o **IC95 inferior contra o piso absoluto**, que sao **dois asserts distintos**. Os seis numeros de alvo vem da ancoragem congelada e **nao podem ser reescritos aqui**: eles foram escritos antes de o motor mudar, e essa e a unica razao pela qual eles valem.

5. **DESEMPATE:** entre pontos empatados no item 4, vence o que deixar a **mediana da primeira torre mais alta**, ou seja o que devolve mais da folga que a Fase 26 vai precisar. A **duracao** entra como segundo desempate, na mesma direcao.

**A COLUNA BINARIA DO PESO ORFAO, herdada da onda 3:** no ponto escolhido pelos itens 1 a 5, e **apenas ali**, mede-se tambem a variante alternativa de destino do peso orfao (a variante B da secao 1). Sao **dois pontos** e nao uma grade cruzada, e a razao esta escrita: cruzar dobraria o custo sem dobrar a informacao, porque a escolha da onda 3 foi tomada com criterio proprio e so precisa ser **conferida contra a interacao**.

### 3.3 O CRITERIO DE PARADA, e ele e duro

- Se **nenhum** ponto satisfizer ao mesmo tempo os itens 1, 2 e 3, o plano **PARA** e registra a fronteira com numero **dos dois lados**, sem escolher o menos ruim.
- Se algum ponto satisfizer 1, 2 e 3 mas **nenhum** fechar as tres bandas de acoplamento, o plano registra **quais** fecham e **a que distancia** ficam as que nao fecham, e leva a decisao ao **checkpoint humano**.
- **Em nenhum dos dois casos o plano abre alavanca nova.** Isso seria escopo novo e nao ajuste, e o precedente e o criterio 3 da Fase 25B, que fechou com banda em aberto e regiao provada vazia por grade de nove pontos **em vez de afrouxar a banda**.
- **Nenhum piso e afrouxado**, nem os desta fase nem os das Fases 25 e 25B.

### 3.4 A FRONTEIRA DO PAR DE RISCO, medida DE PROPOSITO nos dois lados

**O que esta fase provavelmente nao alcanca, e isso esta escrito desde a onda 1:** o par de luta ganha seguida de objetivo epico foi testado em sete alavancas na pesquisa; a melhor o move em mais **6,2 por cento** contra o piso relativo de mais **15 por cento**, e **aumentar a forca piora**.

Por isso, **alem dos quinze pontos**, este sweep mede tambem o ponto **fora da grade** em que a pesquisa viu a inversao (`POST_FIGHT_OBJECTIVE_W = 4,0`, com a temperatura no melhor ponto), **mesmo sabendo que ele sera eliminado pelos itens anteriores**. A razao e a mesma que a Fase 25B usou na grade de nove tetos: **afirmar "a regiao e vazia" so vale se os dois lados da fronteira estiverem medidos.** Sem isso a afirmacao seria opiniao.

### 3.5 METODO, e ele e o mesmo ja usado quatro vezes nesta milestone

Cada ponto e aplicado de forma **TRANSITORIA** e o estado volta ao commitado entre um ponto e o proximo. A restauracao e provada por **hash de objeto** dos arquivos tocados e **nunca por status de arvore**, porque a conversao de fim de linha deste repositorio faz `git status` mentir nos dois sentidos.

**Nenhuma constante fica movida ao fim da medicao da grade.** O ponto de operacao so e commitado depois da decisao humana do checkpoint.

**Procedencia:** gate de ritmo nos seis tiers (`npm run calibrate:pace`, N = 800 por tier), gate estrutural nos tres (`npm run calibrate:structures`, N = 800 por tier), sonda de forma nos dois (`npm run probe:shape`) e sonda de lift no tier de referencia (`LIFT_N=800 npm run probe:lift`, W = 60 s, EQUILIBRADO 75 contra 75).

### 3.6 O QUE A GRADE VAI IMPRIMIR, todas as colunas NA MESMA LINHA

Isto esta declarado antes porque foi exatamente o que faltou no sweep da Fase 25 e custou uma fase inteira: nivel, forma e acoplamento precisam ser lidos **juntos** para que a troca seja visivel.

Por ponto: os dois parametros; a lista de **regras duras violadas**, que precisa estar vazia; duracao media; mediana da primeira torre; torres por minuto; torres aos 20:00; placas por partida; razao de torres; os **tres pares de lift com IC**; os **dois controles que ainda valem** (C1 e C2); a fracao de shutout; a vitoria por uma rota; os dois coeficientes de bimodalidade; e **draws por TICK**.

**C3 NAO entra como controle.** Ele deixou de ser controle na onda 4, porque o lead de rota deixado por um gank passa a ponderar o proximo e passou a existir caminho mecanico (Bloco 2.8). Ele segue impresso como observacao e **nenhuma leitura desta secao pode usa-lo como validacao do instrumento**.

---

### 3.7 A VALIDACAO DA CADEIA DE MEDICAO, feita antes de a grade valer

O ponto (16; 0,5) da grade **e** o estado commitado que a onda 4 deixou, e foi medido pelo mesmo caminho de todos os outros. Ele reproduz a onda 4 **numero por numero**: P1 1,552; P2 1,911; P3 1,364; duracao 30,367 min; mediana da primeira torre 810 s; draws por tick 5,1133; 26 bandas verdes e 16 vermelhas; regras duras 0 em 12 de 12.

**Isso valida a cadeia inteira desta onda em vez de supor que ela mede a mesma coisa que a anterior**, pela mesma disciplina com que a onda 4 remediu o PRE em vez de copia-lo.

### 3.8 A GRADE MEDIDA, quinze pontos, nivel e forma e acoplamento na mesma linha

**PARTE A: regras duras, regra de parada e nivel.**

| ponto | **regras duras (6 tiers + 3 tiers)** | **duracao (min)** | **1a torre p50 (s)** | torres/min | torres 20:00 | placas | razao de torres |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1; W0,5 | **0** | 29,755 | **795** | 0,361 | 4,854 | 11,357 | 2,986 |
| T1; W1,0 | **0** | 29,491 | **795** | 0,362 | 4,894 | 11,365 | 3,015 |
| T1; W1,5 | **0** | 29,527 | **795** | 0,362 | 4,914 | 11,345 | 2,904 |
| T2; W0,5 | **0** | 29,464 | **795** | 0,362 | 4,836 | 11,351 | 3,089 |
| T2; W1,0 | **0** | **29,206** | **795** | 0,363 | 4,866 | 11,360 | 3,081 |
| T2; W1,5 | **0** | 29,407 | **795** | 0,362 | 4,893 | 11,340 | 2,968 |
| T4; W0,5 | **0** | 30,131 | **795** | 0,362 | 4,835 | 11,365 | 2,963 |
| T4; W1,0 | **0** | 29,708 | **795** | 0,365 | 4,865 | 11,379 | 3,016 |
| T4; W1,5 | **0** | 29,497 | **795** | 0,364 | 4,891 | 11,359 | 3,025 |
| T8; W0,5 | **0** | 30,365 | **810** | 0,365 | 4,839 | 11,412 | 3,004 |
| **T8; W1,0** | **0** | **30,024** | **810** | 0,366 | 4,859 | 11,424 | 3,062 |
| T8; W1,5 | **0** | 29,726 | **810** | 0,365 | 4,886 | 11,406 | 3,105 |
| T16; W0,5 (entrada) | **0** | 30,367 | **810** | 0,366 | 4,815 | 11,476 | 3,111 |
| T16; W1,0 | **0** | 30,264 | **810** | 0,367 | 4,830 | 11,476 | 3,051 |
| T16; W1,5 | **0** | 29,893 | **810** | 0,366 | 4,849 | 11,459 | 3,124 |
| banda | zero absoluto | [29,000; 36,000] | [780; 1140] | [0,300; 0,450] | [2,500; 5,000] | [5,000; 12,000] | [2,500; 4,500] |
| **regra de parada da fase** | | **maior ou igual a 29,4** | **maior ou igual a 800** | | | | |

**PARTE B: acoplamento, controles, forma e aridade.**

| ponto | **P1** (piso 1,832) | P1 IC- | **P2** (piso 1,951) | P2 IC- | **P3** (piso 1,503) | P3 IC- | **C1** | **C2** | shutout | uma rota | BC venc | BC perd | draws/tick | bandas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1; W0,5 | 1,759 | 1,483 | **1,990 DENTRO** | 1,868 | 1,361 | 1,269 | 0,920 [0,834; 1,015] | 1,061 [0,737; 1,423] | 0,390 | 0,458 | 0,443 | 0,559 | 5,1051 | 27 / 15 |
| T1; W1,0 | **1,832 DENTRO** | 1,544 | **2,024 DENTRO** | 1,907 | 1,341 | 1,243 | 0,865 [0,778; 0,954] | 1,223 [0,868; 1,659] | 0,388 | 0,449 | 0,453 | 0,557 | 5,0910 | 28 / 14 |
| T1; W1,5 | 1,584 | 1,353 | **1,998 DENTRO** | 1,861 | 1,318 | 1,236 | 0,836 [0,764; 0,920] | 1,160 [0,838; 1,545] | 0,370 | 0,451 | 0,460 | 0,550 | 5,1129 | 28 / 14 |
| T2; W0,5 | 1,645 | 1,373 | **2,018 DENTRO** | 1,897 | 1,319 | 1,237 | 0,866 [0,780; 0,955] | 1,088 [0,745; 1,442] | 0,405 | 0,445 | 0,441 | 0,564 | 5,0991 | 27 / 15 |
| T2; W1,0 | 1,716 | 1,451 | **2,062 DENTRO** | 1,941 | 1,268 | 1,188 | 0,824 [0,745; 0,907] | 1,259 [0,908; 1,619] | 0,403 | 0,445 | 0,445 | 0,569 | 5,0833 | 27 / 15 |
| T2; W1,5 | 1,612 | 1,348 | **1,954 DENTRO** | 1,836 | 1,256 | 1,172 | 0,838 [0,765; 0,926] | 1,158 [0,827; 1,500] | 0,390 | 0,438 | 0,456 | 0,557 | 5,1123 | 27 / 15 |
| T4; W0,5 | 1,589 | 1,306 | **2,011 DENTRO** | 1,881 | 1,341 | 1,254 | 0,879 [0,791; 0,971] | 0,903 [0,611; 1,212] | 0,395 | 0,416 | 0,446 | 0,589 | 5,1185 | 27 / 15 |
| T4; W1,0 | 1,635 | 1,300 | **1,955 DENTRO** | 1,843 | 1,317 | 1,227 | 0,851 [0,771; 0,933] | 0,877 [0,574; 1,230] | 0,391 | 0,416 | 0,447 | 0,573 | 5,1084 | 27 / 15 |
| T4; W1,5 | 1,524 | 1,210 | 1,911 | 1,805 | 1,279 | 1,186 | 0,846 [0,775; 0,930] | 1,074 [0,751; 1,425] | 0,404 | 0,422 | 0,449 | 0,573 | 5,0897 | 26 / 16 |
| T8; W0,5 | 1,508 | 1,197 | 1,921 | 1,797 | 1,348 | 1,264 | 0,930 [0,848; 1,016] | 0,893 [0,594; 1,237] | 0,393 | 0,395 | 0,447 | 0,578 | 5,1158 | 26 / 16 |
| **T8; W1,0** | 1,476 | 1,151 | **2,013 DENTRO** | 1,904 | 1,296 | 1,208 | 0,911 [0,827; 0,989] | 0,839 [0,556; 1,161] | 0,398 | 0,399 | 0,466 | 0,572 | 5,1029 | **27 / 15** |
| T8; W1,5 | 1,366 | 1,071 | 1,937 | 1,809 | 1,273 | 1,178 | 0,915 [0,833; 1,003] | 0,981 [0,675; 1,296] | 0,416 | 0,409 | 0,458 | 0,566 | 5,0871 | 26 / 16 |
| T16; W0,5 (entrada) | 1,552 | 1,175 | 1,911 | 1,793 | **1,364** | 1,273 | 0,976 [0,890; 1,074] | 0,943 [0,614; 1,288] | 0,411 | 0,375 | 0,447 | 0,574 | 5,1133 | 26 / 16 |
| T16; W1,0 | 1,507 | 1,179 | 1,931 | 1,823 | 1,320 | 1,222 | 0,925 [0,844; 1,006] | 1,049 [0,704; 1,471] | 0,405 | 0,380 | 0,469 | 0,577 | 5,1142 | 26 / 16 |
| T16; W1,5 | 1,356 | **1,041 FORA** | 1,943 | 1,830 | 1,314 | 1,225 | 0,922 [0,836; 1,011] | 1,057 [0,744; 1,438] | 0,416 | 0,394 | 0,455 | 0,570 | 5,0953 | 25 / 17 |
| piso | 1,832 | 1,050 | 1,951 | 1,050 | 1,503 | 1,050 | cobrir 1,000 | cobrir 1,000 | | | | | | |

**CORRECAO DE UMA AFIRMACAO ERRADA DESTA MESMA SECAO, e ela fica registrada em vez de apagada.** A primeira redacao deste bloco dizia que "C1 e C2 cobrem 1,000 em todos os quinze pontos". **Isso e FALSO**, e o erro foi pego na medicao final da onda, ao conferir o IC do ponto commitado em vez de olhar so o valor central. A afirmacao correta esta abaixo, medida ponto a ponto.

| controle | cobre 1,000 em | nao cobre em |
| --- | --- | --- |
| **C2** voidgrubs, depois torre | **15 de 15** | nenhum |
| **C1** dragao sem contestacao, depois torre | **7 de 15** | **8 de 15**, sempre por BAIXO |

| ponto | C1 | cobre 1,000? |
| --- | --- | --- |
| T1; W0,5 | 0,920 [0,834; 1,015] | sim |
| T1; W1,0 | 0,865 [0,778; 0,954] | **nao** |
| T1; W1,5 | 0,836 [0,764; 0,920] | **nao** |
| T2; W0,5 | 0,866 [0,780; 0,955] | **nao** |
| T2; W1,0 | 0,824 [0,745; 0,907] | **nao** |
| T2; W1,5 | 0,838 [0,765; 0,926] | **nao** |
| T4; W0,5 | 0,879 [0,791; 0,971] | **nao** |
| T4; W1,0 | 0,851 [0,771; 0,933] | **nao** |
| T4; W1,5 | 0,846 [0,775; 0,930] | **nao** |
| T8; W0,5 | 0,930 [0,848; 1,016] | sim |
| **T8; W1,0 (escolhido)** | **0,911 [0,827; 0,989]** | **nao, por 0,011** |
| T8; W1,5 | 0,915 [0,833; 1,003] | sim |
| T16; W0,5 | 0,976 [0,890; 1,074] | sim |
| T16; W1,0 | 0,925 [0,844; 1,006] | sim |
| T16; W1,5 | 0,922 [0,836; 1,011] | sim |

**O que a medicao autoriza dizer, e nao mais que isso:**

- **O padrao e ordenado e nao aleatorio: C1 cai quanto mais CONCENTRADA a temperatura.** Nas temperaturas 1, 2 e 4 ele exclui 1,000 em oito de nove pontos; nas temperaturas 8 e 16 ele cobre em cinco de seis. Isso e informacao nova sobre o **instrumento** e nao sobre o motor.
- **A direcao e a CONSERVADORA, e isso e o que importa para a leitura dos pares.** Um controle que le abaixo de 1,000 nao fabrica acoplamento: ele subestima. Para um gate que asserta "existe acoplamento", errar para baixo e a direcao certa do erro, entao **este alerta nao invalida nenhuma leitura de P1, P2 ou P3 desta secao**. E a mesma leitura que o Bloco 1.6 registrou na onda 3.
- **O valor no ponto escolhido esta abaixo do envelope de vies ja medido.** O Bloco 2.12 da ancoragem mediu o vies do estimador no perfil temporal de dragao em 0,972 e 0,973 em W = 60 s. O 0,911 fica abaixo disso, ou seja **nao** e inteiramente explicado pelo vies conhecido.
- **Nenhum criterio, piso ou janela foi mexido por causa deste bloco.** A separacao das leituras possiveis vem por medicao e antes de qualquer criterio se mover, e esta onda **nao** fez essa separacao.

**Dono: onda 7**, somando-se ao alerta de C1 que a onda 3 ja abriu e ao residuo de C3. A onda 7 recebe agora um dado que ela nao tinha: **a leitura de C1 depende da temperatura de foco do gank**, o que e pista sobre o mecanismo do vies e nao apenas mais uma leitura fora de 1,000.

**C2 cobre 1,000 nos quinze pontos**, com IC largo em todos.

### 3.9 O VEREDITO PONTO A PONTO, na ordem escrita do criterio

| ponto | 1 duras | 2 parada | 3 nivel e forma | 4 acoplamento (de 6) | eliminado por |
| --- | --- | --- | --- | --- | --- |
| T1; W0,5 | passa | **FALHA** | passa | 4 | item 2: 1a torre **795 s** |
| T1; W1,0 | passa | **FALHA** | passa | **5** | item 2: 1a torre **795 s** |
| T1; W1,5 | passa | **FALHA** | passa | 4 | item 2: 1a torre **795 s** |
| T2; W0,5 | passa | **FALHA** | passa | 4 | item 2: 1a torre **795 s** |
| T2; W1,0 | passa | **FALHA** | passa | 4 | item 2: duracao **29,206** E 1a torre **795 s** |
| T2; W1,5 | passa | **FALHA** | passa | 4 | item 2: 1a torre **795 s** |
| T4; W0,5 | passa | **FALHA** | passa | 4 | item 2: 1a torre **795 s** |
| T4; W1,0 | passa | **FALHA** | passa | 4 | item 2: 1a torre **795 s** |
| T4; W1,5 | passa | **FALHA** | passa | 3 | item 2: 1a torre **795 s** |
| T8; W0,5 | passa | passa | passa | 3 | sobrevive |
| **T8; W1,0** | passa | passa | passa | **4** | **sobrevive, e VENCE o item 4** |
| T8; W1,5 | passa | passa | passa | 3 | sobrevive |
| T16; W0,5 | passa | passa | passa | 3 | sobrevive |
| T16; W1,0 | passa | passa | passa | 3 | sobrevive |
| T16; W1,5 | passa | passa | passa | 2 | sobrevive |

**Nove pontos eliminados pelo item 2, e os nove pela MESMA grandeza.** Seis sobrevivem. **O item 4 tem vencedor UNICO: T8; W1,0, com 4 dos 6 asserts de acoplamento dentro.** O desempate do item 5 nao foi preciso.

### 3.10 O ACHADO ESTRUTURAL DA GRADE: a mediana da primeira torre e QUANTIZADA, e a regra de parada cai entre dois degraus

Este e o resultado mais importante da secao e ele nao estava previsto.

**A mediana da primeira torre so assume dois valores na grade inteira: 795 s ou 810 s.** Nao existe ponto intermediario, e a razao e mecanica e nao estatistica: **o tick da simulacao e de 15 s**, entao a mediana de uma distribuicao de tempos de evento e sempre um multiplo de 15. Os 800 s da regra de parada caem **exatamente entre dois degraus adjacentes**.

| temperatura | 1 | 2 | 4 | **8** | 16 |
| --- | --- | --- | --- | --- | --- |
| mediana da 1a torre (s) | 795 | 795 | 795 | **810** | 810 |
| contra a regra de parada de 800 s | fora | fora | fora | **dentro** | dentro |

**Tres consequencias, e as tres importam para quem decidir:**

1. **A regra de parada nao e um piso ajustavel: ela e um interruptor.** Nenhum ponto da grade fica "quase" nos 800 s. Ou o ponto le 795 e esta fora por 5 s, ou le 810 e esta dentro por 10 s. **Nao existe calibracao fina possivel nesse eixo**, o que remove qualquer tentacao de calibrar para a fronteira: a fronteira nao tem interior.
2. **A fronteira esta entre a temperatura 4 e a temperatura 8**, e ela foi medida dos dois lados: T4; W1,0 le P1 **1,635** com 1a torre **795 s** (recusado) e T8; W1,0 le P1 **1,476** com 1a torre **810 s** (aceito). **O preco de um degrau de tick e 0,159 de P1.**
3. **A folga real do ponto escolhido contra a regra de parada e 10 s, mas a folga contra a BANDA e 30 s** (810 contra o piso de 780). A reserva de metade da folga, escrita antes, esta cumprida: a Fase 26 recebe 30 s, que sao dois degraus de tick.

### 3.11 A FRONTEIRA DE CADA PAR, medida dos dois lados

#### P1, gank seguido de queda de torre na mesma rota. Piso 1,832.

**O piso E alcancavel na janela em que a banda vive, e isso responde uma pergunta que a ancoragem deixou aberta.** O Bloco 3.3 da ancoragem escreveu que a projecao de P1 vinha de W = 180 s, que a unica evidencia de transporte sugeria que a razao **encolhe um pouco**, e que **a onda 5 tinha de medir o conjunto em W = 60 s antes de qualquer afirmacao**. Medido agora:

| ponto | P1 em W = 60 s | P1 em W = 180 s | razao contra a entrada em 60 s | razao contra a entrada em 180 s |
| --- | --- | --- | --- | --- |
| T16; W0,5 (entrada) | 1,552 | 1,258 | | |
| **T1; W1,0** | **1,832** | 1,487 | **1,180** | **1,182** |

**A razao transporta entre janelas quase exatamente: mais 18,0 por cento em 60 s contra mais 18,2 por cento em 180 s.** A suspeita de encolhimento **nao se confirmou**, e P1 alcanca o piso de 1,832 **exatamente**, com o proprio numero e nao por projecao.

**Logo, o problema de P1 nao e o piso nem a janela: e a regra de parada.** O unico ponto da grade que fecha P1 e `T1; W1,0`, e ele le **795 s** de mediana da primeira torre. **A regiao em que P1 fecha e nao vazia, e ela esta inteiramente do lado proibido da regra de parada.**

| lado da fronteira | ponto | P1 | 1a torre | veredito |
| --- | --- | --- | --- | --- |
| **dentro da regra de parada** | T8; W0,5 (melhor P1 entre os sobreviventes) | **1,508** | 810 s | faltam **0,324** |
| **fora da regra de parada** | T1; W1,0 | **1,832 FECHA** | 795 s | recusado pelo item 2 |

#### P2, Barao seguido de queda de torre. Piso de preservacao 1,951.

**P2 FECHA, e ele fecha em nove dos quinze pontos, inclusive no ponto escolhido.** Esta e a primeira vez na fase que a banda de preservacao volta ao verde.

| momento | P2 | razao contra o PRE da fase (2,054) | exigido |
| --- | --- | --- | --- |
| entrada da onda 5 (T16; W0,5) | 1,911 | 0,930 | 0,950 |
| **ponto escolhido pelo criterio (T8; W1,0)** | **2,013** | **0,980** | 0,950 |
| melhor da grade (T2; W1,0) | 2,062 | 1,004 | 0,950 |

**O piso nao foi afrouxado e nao precisou ser.** O sinal que a onda 4 entregou estava certo: a alavanca que move P2 e a da janela pos-evento, e ela tinha dois degraus para subir.

#### P3, luta ganha seguida de objetivo epico. Piso 1,503. **A REGIAO E VAZIA, e agora isso e medicao e nao previsao.**

**O maximo de P3 em toda a grade de quinze pontos e 1,364, e ele acontece no ponto de ENTRADA.** Os outros catorze pontos leem menos. O piso e 1,503.

| leitura | valor | contra o piso |
| --- | --- | --- |
| **maximo de P3 nos 15 pontos da grade** | **1,364** (T16; W0,5, o ponto de entrada) | faltam **0,139** |
| maximo de P3 nos 16 pontos medidos, incluindo o de fora da grade | **1,368** (T8; W4,0) | faltam **0,135** |
| minimo de P3 na grade | 1,256 (T2; W1,5) | faltam 0,247 |

**O movimento maximo de P3 em qualquer direcao, sobre dezesseis pontos medidos, e de mais 0,3 por cento contra o ponto de entrada.** O piso pede mais 15 por cento. **Nenhuma das duas alavancas move P3, e as duas o movem para BAIXO na maior parte da grade.**

**Os dois lados da fronteira, medidos de proposito:**

| lado | ponto | P3 | o que mais acontece la |
| --- | --- | --- | --- |
| **forca baixa** | T16; W0,5 | 1,364 | e o maximo da grade, e e o ponto de entrada |
| **forca alta, DENTRO da grade** | T16; W1,5 | 1,314 | P1 cai a 1,356 e o IC95 inferior de P1 **sai** do piso absoluto (1,041 contra 1,050) |
| **forca alta, FORA da grade** | **T8; W4,0** | 1,368 | **VIOLA REGRA DURA** (ver 3.12), P1 desaba a 1,228 e o IC95 inferior de P1 vai a **0,968**, ou seja **abaixo de 1,000** |

**A afirmacao "a regiao e vazia" esta autorizada pelos dois lados**, no precedente da grade de nove tetos da Fase 25B. Aumentar a forca nao move P3 e destroi P1, exatamente como a pesquisa previu.

### 3.12 O ACHADO QUE A LICAO DA FASE 25B EXISTE PARA PEGAR: DUAS violacoes de regra dura, as duas invisiveis em banda

**Os dois pontos medidos fora dos quinze violam regra dura, e nenhuma das duas violacoes aparece em linha de banda nenhuma.** Elas so aparecem nos **contadores de assert** dos relatorios, e as duas aparecem em **tiers de alta diferenca de roster**, nunca no equilibrado. E exatamente o modo de falha da Fase 25B, repetido duas vezes nesta onda.

| ponto | regra dura violada | contador | tier | aparece em banda? |
| --- | --- | --- | --- | --- |
| **T8; W4,0** (fronteira de P3) | `nexusTurret < 20min` | **5 eventos**, 0,01 por jogo | **STOMP-FORTE (85 contra 55)** | **NAO** |
| **T8; W1,0 variante B** (coluna do peso orfao) | `primeira torre antes de 7:00` | **1 evento** | **PRO-GAP (80 contra 60)** | **NAO** |

**Se o retrato desta onda tivesse conferido apenas as linhas de banda, os dois pontos teriam passado por validos.** O T8; W4,0 tem 25 verdes e 17 vermelhas, uma contagem que nao chama atencao; a variante B tem duracao de 28,7 min, que chamaria. **Regra dura em zero e condicao de EXISTENCIA do ponto**, e foi assim que ela foi lida.

### 3.13 A COLUNA BINARIA DO PESO ORFAO, no ponto escolhido e so ali

A variante B (redirecionar o peso orfao para `split_push`, secao 1.2) foi aplicada **por cima de T8; W1,0**, de forma transitoria, com `npx tsc --noEmit` limpo e restauracao provada por hash de objeto nos dois arquivos tocados.

| grandeza | **T8; W1,0 variante A** (escolha da onda 3) | **T8; W1,0 variante B** | veredito |
| --- | --- | --- | --- |
| **regras duras** | **0** | **1** (`primeira torre antes de 7:00`, tier PRO-GAP) | **B ELIMINADA pelo item 1** |
| duracao (min) | 30,024 | **28,705** | **B ELIMINADA pelo item 2**, e ela sai ate da banda [29,000; 36,000] |
| 1a torre p50 (s) | 810 | 810 | empate |
| torres aos 20:00 | 4,859 | **5,014** | **B ELIMINADA pelo item 3**: a banda [2,500; 5,000] estava dentro e **saiu** |
| P1 | 1,476 | 1,639 | B por 0,163, e irrelevante depois de tres eliminacoes |
| P2 | **2,013 DENTRO** | 1,803 | **A**, e B devolve a banda de preservacao ao vermelho |
| P3 | 1,296 | 1,330 | B por 0,034, dentro do IC |
| bandas | **27 / 15** | 25 / 17 | **A** |
| draws por tick | 5,1029 | 4,9783 | observacao |

**A escolha da onda 3 (variante A, largar o peso) esta CONFIRMADA contra a interacao, e por tripla eliminacao.** A variante B falha os itens 1, 2 e 3 do criterio ao mesmo tempo. A informacao que a onda 3 disse que faltava (conferir a escolha contra a interacao com as tres ligacoes no ponto de operacao) esta agora medida, e ela **nao inverte** a escolha: ela a reforca.

### 3.14 A VIGILANCIA HERDADA D-25B-06, medida ANTES de qualquer classificacao, e ela DISPARA

**Este bloco foi medido antes da onda 6 e o resultado bloqueia a leitura simples que aquela onda esperava fazer.**

**Validacao do instrumento nos dois lados, antes de qualquer conclusao:** o leitor do lado commitado (os arquivos `.snap` em HEAD) reproduz D-25B-06 **numero por numero**: `dragon_steal` 1/17, `elder_taken` 1/17, `baron_steal` 3/17, `triple_kill` 5/17, `ace` 10/17, `quadra_kill` 4/17, uniao **22**. O leitor do lado novo, rodado sobre o motor do **commit base da fase** (`4ede940`), devolve exatamente o mesmo: uniao **22**, `dragon_steal` 1/17, `elder_taken` 1/17. **Os dois instrumentos concordam no lado antigo, e so por isso a leitura do lado novo vale.**

**A medicao do lado novo:**

| tipo | commit base `4ede940` | **estado commitado da onda 4** | situacao |
| --- | --- | --- | --- |
| `dragon_steal` | 1/17 | **3/17** | **SUBIU, saiu da zona de risco** |
| `elder_taken` | 1/17 | **0/17** | **ZERO** |
| **uniao global do vocabulario** | **22** | **21** | **ENCOLHEU** |

**Pelo criterio escrito, uniao que encolhe e mudanca de ESTRUTURA e nao de valor.**

**E o ponto de operacao NAO muda isso.** A vigilancia foi medida em oito pontos, os seis sobreviventes mais T1; W1,0 e T4; W1,0: **a uniao le 21 em todos os oito, e `elder_taken` le 0/17 em todos os oito.** O achado e **ortogonal a decisao do checkpoint** e ja esta presente no estado que a onda 4 commitou.

**A classificacao POR MEDICAO, e nao por conveniencia, no mesmo molde com que a onda 4 classificou WR-02.** O repositorio ja carrega a regra de que a **um digito** de alcancabilidade a leitura muda de deslocamento de ancora para supressao de comportamento. Medido nos dois lados com o mesmo harness, 200 sementes por cenario, 600 partidas por lado:

| lado | partidas com `elder_taken` | alcancabilidade | eventos |
| --- | --- | --- | --- |
| commit base `4ede940` | 59/600 | **9,83 por cento** | 83 |
| estado commitado da onda 4 | 53/600 | **8,83 por cento** | 74 |

**Dois digitos nos dois lados, queda de 1,0 ponto: DESLOCAMENTO, e nao supressao.** O comportamento segue alcancavel em cerca de uma partida em onze. O que aconteceu e que a **unica** aparicao que ele tinha dentro dos 17 blocos amostrados (`golden:close:seed999`) saiu por deslocamento de trajetoria. A duracao media do corpus **subiu** de 24,24 para 26,09 min, ou seja a causa **nao** e o encurtamento que D-25B-06 antecipava.

**A consequencia, e ela e da onda 6 e nao desta:** pela letra do criterio a regeneracao do golden nesta fase e mudanca de estrutura e exige o passe deliberado reservado a outra fase; pela medicao de comportamento, nada foi suprimido. **As duas leituras estao aqui com numero, e a escolha entre elas nao e desta onda.** O que esta onda garantia era medir antes de classificar, e isso esta feito.

### 3.15 O QUE A GRADE FECHA E O QUE ELA DEIXA ABERTO

**FECHA:**

- **A regiao util esta mapeada nos quinze pontos**, com regra dura, regra de parada, nivel, forma e acoplamento na mesma linha, e com a cadeia de medicao validada contra a onda 4.
- **P2 volta ao verde** no ponto que o criterio escolheu (2,013, razao 0,980), e a banda de preservacao deixa de estar em divida.
- **A escolha do peso orfao da onda 3 esta confirmada contra a interacao**, por tripla eliminacao.
- **A duvida de transporte de janela que a ancoragem deixou aberta para P1 esta respondida:** a razao transporta (mais 18,0 por cento em 60 s contra mais 18,2 por cento em 180 s) e o piso de P1 e alcancavel na janela da banda.

**DEIXA ABERTO:**

- **P1 nao fecha dentro da regra de parada.** A regiao onde ele fecha existe e esta inteiramente do lado proibido. Falta **0,324** no melhor ponto sobrevivente. Dono: **checkpoint humano**.
- **P3 nao fecha em lugar nenhum, e a regiao e vazia dos dois lados.** Movimento maximo medido: mais 0,3 por cento contra o piso de mais 15 por cento. Dono: **checkpoint humano**.
- **A uniao do corpus do golden caiu de 22 para 21** (3.14), com o comportamento **nao** suprimido. Dono: **onda 6**.

---

### 3.16 A DECISAO DO DESENVOLVEDOR, e o raciocinio dela registrado junto

**Decisao tomada em 2026-07-30, no checkpoint do plano 25C-05: `adotar-o-ponto-do-criterio`.**

**O ponto de operacao passa a ser `GANK_FOCUS_TEMPERATURE = 8` e `POST_FIGHT_OBJECTIVE_W = 1,0`**, commitado em `src/sim/engine.ts` num unico commit de valor.

**O raciocinio, registrado com a decisao e nao reconstruido depois:**

> A regra de parada em 800 s foi **mantida** mesmo sabendo que ela nao tem interior, e mesmo sabendo que `T1; W1,0` fecharia P1 exatamente no piso e daria 28 verdes contra 27.
>
> O motivo e **o mesmo que levou a recusar o teto 1,75 na Fase 25B**: nao gastar folga por ganho parcial as vesperas da Fase 26. La eram 72 por cento da folga de duracao por um par; aqui seria **um degrau de tick inteiro**, de 30 s para 15 s de margem, pelo mesmo tipo de troca. A Fase 26 corta cerca de 40 por cento dos abates e pode empurrar a primeira torre para mais cedo, e **com um unico tick de margem nao ha para onde recuar**.

**Isto e precedente e nao preferencia:** e a segunda vez na milestone que a mesma troca aparece e a segunda vez que ela e recusada pela mesma razao. Quem encontrar a terceira ja sabe como as duas anteriores foram decididas.

### 3.17 O PONTO `T1; W1,0` FICA MEDIDO E DISPONIVEL, e ele NAO foi rejeitado por ser ruim

**Registrado com retrato completo para que quem revisitar P1 depois da Fase 26 nao precise remedir a grade inteira.**

| grandeza | `T1; W1,0` | ponto escolhido `T8; W1,0` |
| --- | --- | --- |
| **P1** | **1,832, EXATAMENTE no piso, FECHA** | 1,476, faltam 0,356 |
| P1 IC95 inferior | 1,544 | 1,151 |
| **P2** | **2,024, FECHA** | **2,013, FECHA** |
| **P3** | 1,341, faltam 0,162 | 1,296, faltam 0,207 |
| **bandas** | **28 verdes / 14 vermelhas** | 27 / 15 |
| duracao (min) | 29,491 | 30,024 |
| **mediana da primeira torre** | **795 s**, um unico tick ate o piso da banda | **810 s**, dois ticks |
| **regras duras, 6 tiers mais 3 tiers** | **ZERO** | **ZERO** |
| torres/min, torres 20:00, placas, razao | 0,362; 4,894; 11,365; 3,015, as quatro DENTRO | 0,366; 4,859; 11,424; 3,062, as quatro DENTRO |
| C1 | 0,865 [0,778; 0,954] | 0,911 [0,827; 0,989] |
| draws por tick | 5,0910 | 5,1029 |

**Ele NAO foi rejeitado por ser um ponto ruim.** Ele tem **mais** bandas verdes que o ponto escolhido, fecha **dois** dos tres pares, e passa em regra dura com zero absoluto nos seis tiers. **Ele foi rejeitado por CUSTO DE MARGEM**, e a margem e emprestimo da Fase 26.

**A ressalva obrigatoria, a mesma que a Fase 25B escreveu para o teto 1,75:** os numeros acima valem para o motor de hoje e **precisam ser remedidos depois da Fase 26**, porque e ela que muda as duas grandezas que fizeram a recusa.

---

## Secao 4: O BLOCO DE MARGEM, insumo direto da onda de fechamento e da Fase 26

**Medicao final da onda, rodada sobre a arvore commitada:** gate de ritmo nos seis tiers, gate estrutural nos tres, sonda de forma nos dois e sonda de lift no tier de referencia, com N de ancoragem. Artefatos: `tmp/25C05/FINAL-pace.txt`, `FINAL-struct.txt`, `FINAL-shape.txt`, `FINAL-lift.txt`.

**A arvore commitada reproduz o ponto `T8; W1,0` da grade numero por numero**, o que confirma que o que foi commitado e o que foi medido.

### 4.1 As cinco bandas de nivel do criterio 4, com a folga de cada uma

| banda | valor | banda | **folga** | |
| --- | --- | --- | --- | --- |
| **mediana da primeira torre (s)** | 810 | [780; 1140] | **30 s ate o piso** | **A MAIS APERTADA** |
| **torres aos 20:00** | 4,859 | [2,500; 5,000] | **0,141 ate o teto** | **A SEGUNDA MAIS APERTADA** |
| torres por minuto | 0,366 | [0,300; 0,450] | 0,066 ate o piso | |
| razao de torres vencedor sobre perdedor | 3,062 | [2,500; 4,500] | 0,562 ate o piso | |
| placas por partida | 11,424 | [5,000; 12,000] | 0,576 ate o teto | |
| duracao media (min), observada | 30,024 | [29,000; 36,000] | 1,024 ate o piso | |

**AS DUAS MAIS APERTADAS ESTAO NOMEADAS PORQUE A FASE 26 EMPURRA AS DUAS.**

1. **A mediana da primeira torre tem 30 s, ou seja DOIS DEGRAUS DE TICK.** E ela e quantizada (3.10), entao a folga real e "dois degraus" e nao "30 s continuos". **A Fase 26 nao tem meio degrau para gastar.**
2. **Torres aos 20:00 tem 0,141 ate o teto, e essa folga NAO e teorica:** a variante B do peso orfao a estourou nesta mesma onda, chegando a 5,014 (3.13). Ela e a banda que quebra quando a partida fica mais rapida.

### 4.2 As bandas de dispersao e de forma da Fase 25B que estavam dentro: TODAS continuam dentro

| banda | valor | banda | folga | dono |
| --- | --- | --- | --- | --- |
| **DISPERSAO torres por minuto** | 0,826 | [0,750; 2,000] | **0,076 ate o piso** | Fase 25B, **a mais apertada das treze** |
| **FORMA BC das torres do VENCEDOR** | 0,466 | [0,250; 0,556] | **0,090 ate o teto** | Fase 25B, **a segunda** |
| DISPERSAO torres do vencedor | 0,994 | [0,750; 2,000] | 0,244 | Fase 25B |
| FORMA vencedor no maximo do contador | 0,146 | [0,010; 0,250] | 0,104 | Fase 25B |
| FORMA limpar as TRES rotas | 0,146 | [0,010; 0,350] | 0,204 | Fase 25B |
| FORMA exatamente 9 a 0 | 0,022 | [0,000; 0,050] | 0,028 | Fase 25B |
| DISPERSAO duracao | 1,427 | [0,750; 2,000] | 0,573 | Fase 30 (vigia) |
| DISPERSAO abates totais | 1,732 | [0,750; 2,000] | 0,268 | Fase 30 (vigia) |
| DISPERSAO torres do perdedor | 1,426 | [0,750; 2,000] | 0,574 | Fase 30 (vigia) |
| DISPERSAO torres totais | 1,137 | [0,750; 2,000] | 0,387 | Fase 30 (vigia) |
| DISPERSAO ouro final do vencedor | 1,428 | [0,750; 2,000] | 0,572 | Fase 30 (vigia) |
| DISPERSAO ouro final do perdedor | 1,268 | [0,750; 2,000] | 0,518 | Fase 30 (vigia) |
| DISPERSAO ouro por minuto por time | 1,095 | [0,750; 2,000] | 0,655 | Fase 30 (vigia) |

**NENHUMA BANDA QUE ESTAVA DENTRO SAIU.** A conferencia foi feita pela lista inteira de rotulos com os valores apagados, e nao pelo total.

**Exatamente UMA banda mudou de cor contra o ponto de entrada da onda, e ela mudou PARA MELHOR:** `ACOPLAMENTO P2` saiu do vermelho.

### 4.3 As tres bandas de acoplamento contra o alvo da ancoragem

| par | valor | IC95 inferior | piso (ancoragem congelada) | razao contra o PRE | veredito |
| --- | --- | --- | --- | --- | --- |
| **P1** gank, depois torre na mesma rota | **1,476** | 1,151 | **1,832** (1,15 vezes o PRE 1,593) | 0,927 | **VERMELHA, faltam 0,356** |
| **P2** Barao, depois torre | **2,013** | 1,904 | **1,951** (0,95 vezes o PRE 2,054) | **0,980** | **VERDE, preservado** |
| **P3** luta ganha, depois epico | **1,296** | 1,208 | **1,503** (1,15 vezes o PRE 1,307) | 0,992 | **VERMELHA, faltam 0,207** |
| IC95 inferior dos tres contra o piso absoluto 1,050 | | 1,151 / 1,904 / 1,208 | 1,050 | | **os tres VERDES** |

**Os seis numeros de alvo vieram da ancoragem congelada e nao foram reescritos aqui.** Eles foram escritos antes de o motor mudar, e essa e a unica razao pela qual eles valem.

**Os tres IC95 inferiores estao acima do piso absoluto**, ou seja **os tres pares sao estatisticamente distinguiveis de independencia** mesmo os dois que nao alcancam o piso relativo. O que falta a P1 e a P3 e magnitude, e nao existencia.

### 4.4 As quinze bandas VERMELHAS, nominais e com a fase dona de cada uma

| dono | bandas vermelhas | quantas |
| --- | --- | --- |
| **Fase 26** | abates/min (1,277 contra teto 1,000); razao de abates (1,120 contra piso 1,800); razao torres sobre abates (0,224 contra piso 0,330); fracao de abates ate 20:00 (0,506 contra teto 0,460); fracao sem abate ate 10:00 (0,016 contra piso 0,050) | **5** |
| **Fase 27** | ouro/min por time (650 contra piso 1500); razao de ouro/min (1,051 contra piso 1,100) | **2** |
| **Fase 28** | win-rate com gap de forca 30 (1,000 contra teto 0,970) | **1** |
| **Fase 25B** | DISPERSAO primeira torre (0,528 contra piso 0,750); FORMA uma rota (0,399 contra piso 0,500); FORMA shutout (0,398 contra teto 0,120); FORMA BC do perdedor (0,572 contra teto 0,556) | **4** |
| **Fase 30** | PROVISORIA DISPERSAO comeback (0,360 contra piso 0,400) | **1** |
| **Fase 25C (esta fase)** | **ACOPLAMENTO P1 (1,476 contra piso 1,832)** e **ACOPLAMENTO P3 (1,296 contra piso 1,503)** | **2** |

**As treze de outras fases nao mudaram de cor nesta onda.** As duas desta fase estao declaradas em 4.6.

### 4.5 Aridade por TICK, e a leitura de veredito

| leitura | entrada da onda | **ponto commitado** | variacao |
| --- | --- | --- | --- |
| **draws por TICK** (leitura de veredito) | 5,1133 | **5,1029** | **menos 0,20 por cento** |
| draws por PARTIDA (confundido pela duracao) | 633,0 | 624,0 | menos 1,42 por cento |
| ticks silenciosos (total) | 0,5876 | 0,5871 | observacao |

**A faixa de draws por tick em toda a grade de quinze pontos e de 5,0833 a 5,1185**, ou seja 0,69 por cento entre o extremo baixo e o alto. **Nenhuma linha de codigo executavel mudou nesta onda**: as unicas mudancas foram os dois valores de constante e comentario. A variacao e inteiramente de trajetoria.

**Contagem canonica de `rng(` em `src/sim/` = 72**, e a linha do gate de pressao estrutural `if (force <= 0.18 || rng() > force) return null;` com **ocorrencia unica byte a byte**.

### 4.6 O QUE A FASE NAO ALCANCOU, com numero, fronteira e sem suavizar

#### P1: faltam 0,356, e a regiao onde ele fecha NAO e vazia

| leitura | valor |
| --- | --- |
| P1 no ponto commitado | **1,476** |
| piso | **1,832** |
| **falta** | **0,356** |
| razao contra o PRE da fase (1,593) | **0,927**, contra os 1,150 exigidos |

**A fronteira, medida dos dois lados:**

| lado | ponto | P1 | 1a torre | por que esta desse lado |
| --- | --- | --- | --- | --- |
| **dentro da regra de parada** | T8; W0,5 | 1,508 | 810 s | melhor P1 sobrevivente, faltam 0,324 |
| **fora da regra de parada** | **T1; W1,0** | **1,832, FECHA** | **795 s** | recusado por custo de margem (3.16) |

**O que se pode afirmar:** o piso de P1 **e alcancavel** na janela em que a banda vive, e o ponto que o alcanca esta medido e disponivel (3.17). **O que impede nao e o piso, nem a janela, nem o mecanismo: e a regra de parada da propria fase**, e a recusa foi decisao humana registrada com o raciocinio.

**O dono NAO esta atribuido aqui, de proposito.** Este item precisa ser revisitado **depois da Fase 26**, que e quem muda as duas grandezas que produziram a recusa.

#### P3: faltam 0,207, e a regiao E vazia, por medicao dos dois lados

| leitura | valor |
| --- | --- |
| P3 no ponto commitado | **1,296** |
| piso | **1,503** |
| **falta** | **0,207** |
| **maximo de P3 em DEZESSEIS pontos medidos** | **1,368** (`T8; W4,0`, que viola regra dura) |
| maximo em ponto VALIDO | **1,364** (`T16; W0,5`, o ponto de entrada da onda) |
| **movimento maximo em qualquer direcao** | **mais 0,3 por cento**, contra os **mais 15 por cento** exigidos |

**A fronteira e de MODELO e nao de instrumento, e isso esta medido:**

- Em **W = 180 s**, que e a janela de onde o multiplicador de 1,15 veio, P3 le **1,034 a 1,038 com p entre 0,127 e 0,187**, ou seja **nao e distinguivel de independencia**. A ancoragem ja registrava que ali o IC95 inferior ficava a **0,004** do teto do vies do proprio estimador.
- Em **W = 60 s**, onde a banda vive, P3 le **1,296 a 1,364 com p = 0,002**, ou seja o acoplamento **existe e e detectavel**.

**Logo: a janela de 60 s foi a escolha certa, e mesmo assim o mecanismo nao alcanca.** O problema nao e o instrumento nem a janela: **as duas alavancas desta fase nao movem P3**, e na maior parte da grade elas o movem para baixo.

**HIPOTESE NAO TESTADA, e ela esta rotulada como tal:** o par de luta ganha seguida de objetivo epico pode exigir **mecanismo diferente**, e nao outro valor das alavancas existentes. **Esta hipotese NAO foi testada por esta fase** e nao ha nenhuma medicao aqui que a apoie ou a refute. Testa-la seria escopo novo, e o roadmap poe "janelas pos-evento como conceito geral" explicitamente **fora** de escopo desta fase.

**O dono NAO esta atribuido aqui, de proposito**, no precedente direto do criterio 3 da Fase 25B, que fechou com banda em aberto, regiao provada vazia e dono nao atribuido. Escolher entre "banda fora com dono declarado" e "fase nova de escopo" e decisao de quem tem escopo sobre o criterio 2 do roadmap.

### 4.7 A LINHA DE VIGILANCIA HERDADA, remedida sobre a arvore commitada

**Medida ANTES de qualquer classificacao, que era a obrigacao desta onda.**

| tipo | commit base `4ede940` | **arvore commitada da onda 5** | situacao |
| --- | --- | --- | --- |
| `dragon_steal` | 1/17 | **4/17** | SUBIU, saiu da zona de risco |
| `elder_taken` | 1/17 | **0/17** | **ZERO** |
| **uniao global do vocabulario** | **22** | **21** | **ENCOLHEU** |
| duracao media do corpus (min) | 24,24 | 25,25 | SUBIU |

**PELA LETRA DO CRITERIO ESCRITO, UNIAO QUE ENCOLHE E MUDANCA DE ESTRUTURA E NAO DE VALOR.**

**A classificacao POR MEDICAO**, no mesmo molde com que a onda 4 classificou WR-02 (a **um digito** de alcancabilidade a leitura muda de deslocamento de ancora para supressao de comportamento), 200 sementes por cenario, 600 partidas por lado:

| lado | partidas com `elder_taken` | alcancabilidade | eventos |
| --- | --- | --- | --- |
| commit base `4ede940` | 59/600 | **9,83 por cento** | 83 |
| motor da onda 5 | 53/600 | **8,83 por cento** | 74 |

**DOIS DIGITOS NOS DOIS LADOS, QUEDA DE 1,0 PONTO: DESLOCAMENTO, E NAO SUPRESSAO.** O comportamento segue alcancavel em cerca de uma partida em onze. A unica aparicao que o tipo tinha dentro dos 17 blocos saiu por deslocamento de trajetoria.

**E a causa NAO e a que D-25B-06 antecipava:** aquele item registrou que a Fase 26 empurraria os dois tipos na direcao errada por **encurtar** a partida. **A duracao media do corpus SUBIU** (24,24 para 25,25 min). O encurtamento nao aconteceu, e o tipo saiu mesmo assim.

**O ponto de operacao NAO muda isso:** a uniao le 21 e `elder_taken` le 0/17 nos **oito** pontos medidos, incluindo o de entrada da onda. **O achado ja estava presente no estado que a onda 4 commitou e e ortogonal a decisao do checkpoint.**

**PASSA PARA A ONDA 6 COM ESTA CLASSIFICACAO E ESTE NUMERO**, porque e la que a uniao do corpus vira criterio de regeneracao. As duas leituras estao aqui, com numero, e a escolha entre elas nao e desta onda.

### 4.8 A LICAO DA FASE 25B, aplicada de novo e registrada com destaque

**Nesta onda, DOIS pontos candidatos violaram regra dura, e NENHUMA das duas violacoes aparecia em linha de banda.**

| ponto | regra dura violada | contador | tier | contagem de bandas | aparece em banda? |
| --- | --- | --- | --- | --- | --- |
| **T8; W4,0** | `nexusTurret < 20min` | **5 eventos** | **STOMP-FORTE (85 contra 55)** | 25 verdes / 17 vermelhas | **NAO** |
| **T8; W1,0 variante B** | `primeira torre antes de 7:00` | **1 evento** | **PRO-GAP (80 contra 60)** | 25 verdes / 17 vermelhas | **NAO** |

**As duas em tier de roster DESIGUAL, nenhuma no equilibrado.** A contagem 25/17 nao chama atencao nenhuma: ela e uma banda pior que o estado de entrada, o que qualquer ponto ruim produziria.

**REGRA, e ela vale para qualquer fase futura desta milestone:** o retrato de um ponto candidato confere **CONTADOR DE ASSERT DURO nos seis tiers**, e nao a linha de banda. **Regra dura em zero e condicao de EXISTENCIA do ponto**, e nao mais uma linha da tabela.

### 4.9 O ACHADO DE QUANTIZACAO, registrado com destaque para quem vier depois

**A mediana da primeira torre e QUANTIZADA em degraus de 15 s, porque o tick da simulacao e de 15 s.** Na grade inteira ela assume **dois** valores e nenhum outro:

| temperatura | 1 | 2 | 4 | **8** | 16 |
| --- | --- | --- | --- | --- | --- |
| mediana da 1a torre (s) | 795 | 795 | 795 | **810** | 810 |
| contra a regra de parada de 800 s | fora por 5 s | fora | fora | **dentro por 10 s** | dentro |

**OS 800 s DA REGRA DE PARADA CAEM EXATAMENTE ENTRE DOIS DEGRAUS ADJACENTES. A FRONTEIRA NAO TEM INTERIOR.**

**Consequencias para qualquer fase futura que tente calibrar contra esta metrica:**

1. **NAO EXISTE CALIBRACAO FINA NESTE EIXO.** Varrer uma grade densa aqui supondo continuidade e desperdicio de tempo: nao ha ponto entre 795 e 810. **Sem este registro alguem vai varrer uma grade fina achando que existe continuidade ali.**
2. **O preco de um degrau esta MEDIDO: 0,159 de lift de P1.** Temperatura 4 le P1 1,635 a 795 s; temperatura 8 le 1,476 a 810 s.
3. **Uma folga expressa em segundos nesta metrica e enganosa.** Os "30 s de folga" do ponto commitado sao **dois degraus**, e nao 30 segundos continuos. Qualquer orcamento de margem sobre esta grandeza deve ser contado em **degraus de tick**.
4. **A regra vale para qualquer metrica de TEMPO DE EVENTO deste motor**, e nao so para a primeira torre: todas sao multiplas de 15 s pela mesma razao.

### 4.10 O PISO RELATIVO DE 1,15 ESTA ABSOLVIDO PARA P1, com o numero que o absolve

**A suspeita levantada publicamente pelo desenvolvedor era que o piso relativo de 1,15 tinha sido derivado de medicoes em janela de 180 s enquanto a banda vive em 60 s, e que a correcao de janela podia ter endurecido a fase sem fundamento.** A ancoragem registrava a mesma duvida no Bloco 3.3, com a obrigacao explicita de que **a onda 5 media o conjunto em W = 60 s antes de qualquer afirmacao**.

**Medido, entre os MESMOS dois pontos:**

| ponto | P1 em W = 60 s | P1 em W = 180 s |
| --- | --- | --- |
| T16; W0,5 (entrada da onda) | 1,552 | 1,258 |
| T1; W1,0 | 1,832 | 1,487 |
| **razao entre os dois pontos** | **1,180 (mais 18,0 por cento)** | **1,182 (mais 18,2 por cento)** |

**A RAZAO TRANSPORTA ENTRE JANELAS QUASE EXATAMENTE: 18,0 contra 18,2 por cento, uma diferenca de 0,2 ponto.**

E a evidencia mais forte ainda: **o piso de 1,832 e atingido EXATAMENTE na janela em que a banda vive** (`T1; W1,0` le 1,832), com o proprio numero e nao por projecao.

**A SUSPEITA NAO SE CONFIRMA PARA P1, e isso fica escrito porque a suspeita foi levantada publicamente.** A correcao de janela **nao** endureceu a fase indevidamente: o piso e alcancavel, foi alcancado, e o que impediu de commitar o ponto que o alcanca foi a **regra de parada** e nao a banda.

**A absolvicao vale para P1 e NAO se estende a P3**, cuja situacao esta em 4.6: la, na janela de 180 s de onde o multiplicador veio, o par **nao e distinguivel de independencia**. Os dois casos sao diferentes e estao registrados separados de proposito.

### 4.11 O QUE A ONDA 5 ENTREGA PARA A ONDA 6 E PARA A FASE 26

**Para a onda 6:**

- **o ponto de operacao esta fechado e commitado**, e as tres ondas de motor da fase estao no lugar;
- **a vigilancia herdada esta medida e classificada** (4.7): uniao 22 para 21, `elder_taken` 0/17, **deslocamento e nao supressao** por alcancabilidade de dois digitos nos dois lados. **A uniao do corpus vira criterio la, e o numero ja esta aqui**;
- **nenhum snapshot foi regenerado nesta onda.**

**Para a Fase 26, o orcamento de margem:**

| grandeza | folga | contada em |
| --- | --- | --- |
| **mediana da primeira torre** | 30 s | **DOIS DEGRAUS DE TICK**, e nao 30 s continuos (4.9) |
| **torres aos 20:00** | 0,141 ate o teto | banda que a variante B ja estourou nesta onda |
| duracao media | 1,024 min ate o piso | |
| DISPERSAO torres por minuto | 0,076 ate o piso | a mais apertada das treze de forma e dispersao |
| BC das torres do vencedor | 0,090 ate o teto | |

**A Fase 26 empurra as duas primeiras na mesma direcao.** E ela e tambem quem deve permitir revisitar P1 (4.6 e 3.17).

