# Fase 25B: o sweep do decaimento do canal absoluto por caminho de vitoria aberto

**Data:** 2026-07-30
**Fase:** 25B-forma-da-distribuicao-estrutural
**Plano de origem:** 25B-03 (Task 3)
**Proposito, em uma linha:** registrar, ponto por ponto, o efeito do decaimento do canal absoluto com FORMA e NIVEL na mesma linha, para que o ponto de operacao da onda 4 seja escolhido com os dois eixos visiveis ao mesmo tempo.

> **AVISO DE LEITURA, ESCRITO DEPOIS DA SECAO 1 E ANTES DELA DE PROPOSITO.**
> O mecanismo medido na secao 1, o DECAIMENTO do canal absoluto por caminho de vitoria aberto, esta **TESTADO E REFUTADO** e foi **REVERTIDO do codigo**. A secao 1 continua aqui na integra porque ela e a MEDICAO que produziu a refutacao, e apaga-la faria alguem tentar o mesmo mecanismo de novo. O veredito, a causa e o mecanismo que o substituiu estao na **secao 2**. Nao implemente decaimento de throughput a partir da secao 1: leia a secao 2 primeiro.

**A diferenca em relacao a `docs/diagnostics/25-sweep.md`, e ela e a razao deste arquivo existir:** aquele documento so tinha colunas de NIVEL, e foi exatamente por isso que a Fase 25 fechou seis bandas verdes com a distribuicao colapsada e ninguem viu ate o ultimo plano. Aqui cada ponto medido traz as colunas de forma (fracoes, bimodalidade, dispersao) ao lado das de nivel (torres/min, torres aos 20:00, primeira torre, placas, duracao), na MESMA linha.

## Comando de medicao de cada ponto

Os tres harnesses, por inteiro, entre uma iteracao e a proxima. Nenhum ponto deste documento foi medido so no tier de referencia:

| harness | comando | populacao | papel |
|---|---|---|---|
| sonda de forma | `npm run probe:shape` | 2 tiers, N = 800, semente igual ao indice | forma e dispersao, sem assercao |
| gate de ritmo | `npm run calibrate:pace` | 6 tiers, N = 800 | nivel, forma e dispersao com banda |
| gate estrutural | `npm run calibrate:structures` | 3 tiers, N = 800 | regras duras da v2.0 |

Os relatorios de cada ponto ficam em `tmp/` (`shape.txt`, `calibration-pace.txt`, `calibration-structures.txt`), e as copias do ponto de partida deste plano estao em `tmp/shape-antes-25B-03.txt`, `tmp/shape-depois-25B-03.txt`, `tmp/pace-antes-25B-03.txt`, `tmp/pace-depois-25B-03.txt`, `tmp/structures-antes-25B-03.txt` e `tmp/structures-depois-25B-03.txt`.

## Bandas donas da fase, com piso e teto

**FORMA (criterios 2 e 3 do roadmap, dono Fase 25B), tier EQUILIBRADO:**

| banda | piso | teto | alvo |
|---|---|---|---|
| vencedor no maximo do contador (9 torres) | 0,010 | 0,250 | 0,040 |
| vitoria exigiu limpar as TRES rotas | 0,010 | 0,350 | 0,040 |
| vitoria com exatamente UMA rota limpa | 0,500 | 0,800 | 0,721 |
| shutout (perdedor com 0 ou 1 torre) | 0,020 | 0,120 | 0,075 |
| exatamente 9 a 0 | 0,000 | 0,050 | 0,001 |
| bimodalidade das torres do VENCEDOR | 0,250 | 0,5556 | 0,459 |
| bimodalidade das torres do PERDEDOR | 0,250 | 0,5556 | 0,442 |

**DISPERSAO (razao do CV medido contra a ancoragem pre-Fase-25), banda `[0,750; 2,000]` para as dez.** As tres com dono Fase 25B sao torres do vencedor, torres por minuto e primeira torre.

**NIVEL (criterio 4 do roadmap, a trava da fase):**

| banda | piso | teto | fonte |
|---|---|---|---|
| torres/min | 0,300 | 0,450 | STACK.md secao 7 |
| torres aos 20:00 | 2,500 | 5,000 | STACK.md secao 7 |
| mediana da primeira torre (s) | 780 | 1140 | STACK.md secao 7 |
| placas por partida | 5,000 | 12,000 | STACK.md secao 7 |
| **duracao media (min)** | **29** | **36** | ROADMAP.md Fase 25B criterio 4 |
| razao de torres vencedor sobre perdedor | 2,500 | 4,500 | STACK.md secao 3 linha 10 |

## Validade declarada

Os numeros absolutos valem enquanto `src/sim/structures.ts` e `src/sim/engine.ts` nao mudarem. As SENSIBILIDADES (quanto o fator de decaimento move cada banda) sobrevivem a mudancas pequenas e sao o que este documento existe para preservar. Nenhum numero aqui foi medido so no tier EQUILIBRADO.

---

## Secao 1: o efeito medido do decaimento no ponto de partida (plano 25B-03, Task 3)

### O ponto medido

Uma unica alavanca movida em relacao ao estado em que a Fase 25 fechou: o termo `siegeVictoryPathDecay` entrou no canal absoluto, por multiplicacao, no valor de partida `SIEGE_DECAY_PER_LANE = 0,5` com `SIEGE_DECAY_FLOOR = 0,1`. Nenhuma outra constante de calibracao foi tocada, nenhum snapshot foi regenerado e a contagem de chamadas ao gerador em `src/sim/` segue em 72.

**A aritmetica do valor de partida, escrita antes da medicao:** cada rota do inimigo limpa por inteiro corta o dano do canal pela metade. Sobram 100 por cento com zero rotas limpas (identidade), 50 por cento com uma, 25 por cento com duas e 12,5 por cento com tres. O piso nao morde neste ponto.

**Este NAO e o ponto de operacao.** Ele e ponto de partida escolhido por aritmetica, no meio da grade natural que a onda 4 vai percorrer. O commit que move o fator e o da onda 4.

### A tabela: FORMA e NIVEL na mesma linha

Tier EQUILIBRADO (75 contra 75), N = 800, semente igual ao indice. "Antes" e o estado em que a Fase 25 fechou e que a onda 2 mediu.

| coluna | banda | antes (fator ausente) | depois (fator 0,5) | movimento | veredito depois |
|---|---|---|---|---|---|
| **FORMA** | | | | | |
| shutout (perdedor com 0 ou 1 torre) | `[0,020; 0,120]` | 0,449 | **0,225** | **menos 0,224** | FORA pelo teto |
| exatamente 9 a 0 | `[0,000; 0,050]` | 0,209 | **0,068** | **menos 0,141** | FORA pelo teto |
| vencedor no maximo do contador (9) | `[0,010; 0,250]` | 0,908 | **0,701** | **menos 0,207** | FORA pelo teto |
| vitoria com exatamente UMA rota limpa | `[0,500; 0,800]` | 0,026 | **0,084** | **mais 0,058** | FORA pelo piso |
| vitoria exigiu limpar as TRES rotas | `[0,010; 0,350]` | 0,908 | **0,701** | **menos 0,207** | FORA pelo teto |
| bimodalidade das torres do VENCEDOR | `[0,250; 0,5556]` | 0,785 | **0,731** | menos 0,054 | FORA pelo teto |
| bimodalidade das torres do PERDEDOR | `[0,250; 0,5556]` | 0,649 | **0,568** | menos 0,081 | FORA pelo teto |
| CV das torres do vencedor (razao) | `[0,750; 2,000]` | 0,202 | **0,396** | **quase o dobro** | FORA pelo piso |
| **NIVEL** | | | | | |
| razao de torres vencedor sobre perdedor | `[2,500; 4,500]` | 3,393 | **1,954** | **menos 1,439** | **FORA pelo piso (era DENTRO)** |
| torres por minuto | `[0,300; 0,450]` | 0,326 | **0,281** | menos 0,045 | **FORA pelo piso (era DENTRO)** |
| torres aos 20:00 | `[2,500; 5,000]` | 4,793 | **4,731** | menos 0,062 | DENTRO |
| mediana da primeira torre (s) | `[780; 1140]` | 945 | **945** | **zero** | DENTRO |
| placas por partida | `[5,000; 12,000]` | 10,660 | **10,660** | **zero** | DENTRO |
| **duracao media (min)** | `[29; 36]` | **35,58** | **46,06** | **mais 10,48** | **FORA pelo teto (era DENTRO)** |
| **REGRAS DURAS (seis tiers)** | | | | | |
| torre antes de 5:00 | igual a 0 | 0 | **0** | zero | **ZERO ABSOLUTO** |
| primeira torre antes de 7:00 | igual a 0 | 0 | **0** | zero | **ZERO ABSOLUTO** |
| Baron antes de 20:00 | igual a 0 | 0 | **0** | zero | **ZERO ABSOLUTO** |
| queda cross-lane simultanea (3 tiers) | igual a 0 | 0 | **0** | zero | **ZERO ABSOLUTO** |

Contagem de bandas do gate de ritmo: **20 vermelhas antes, 22 depois**. As duas que viraram sao `razao de torres` e `torres/min`, as duas com dono **Fase 25**.

### A leitura em duas linhas, sem suavizar

**O mecanismo funciona, e a direcao esta certa em todas as sete bandas de forma.** Toda coluna de forma andou para o lado do alvo, sem excecao, e duas andaram muito: o shutout caiu pela metade (0,449 para 0,225) e o 9 a 0 exato caiu a um terco (0,209 para 0,068). A dispersao das torres do vencedor quase dobrou (razao 0,202 para 0,396). Nenhuma banda de forma entrou, mas nenhuma andou para tras.

**O custo em duracao inviabiliza este ponto de operacao, e o numero e brutal.** A duracao foi de 35,58 para 46,06 minutos, ou seja **mais 10,48 minutos**, contra um teto de 36 e uma folga de partida de apenas 0,42 minuto. Ela nao estourou por pouco: estourou por vinte e cinco vezes a folga que existia.

### O custo em duracao, contra o orcamento

| leitura | valor |
|---|---|
| duracao no estado em que a Fase 25 fechou | 35,58 min |
| duracao com o fator 0,5 | **46,06 min** |
| custo do decaimento | **mais 10,48 min** |
| banda do criterio 4 | `[29; 36]` |
| folga contra o teto ANTES do decaimento | **0,42 min** |
| folga contra o teto DEPOIS | **menos 10,06 min** |
| mediana da duracao, antes e depois | 33:45 para **46:15** |
| **fracao de partidas terminando no teto de 60 minutos** | **0,006 para 0,146** (banda `[0; 0,005]`) |

**O ponto de partida escolhido pela aritmetica esta descartado como ponto de operacao, e a razao esta medida e nao argumentada.**

Duas leituras que a tabela entrega e que a onda 4 precisa carregar:

1. **A folga de duracao ja era essencialmente zero antes deste plano.** 35,58 contra o teto 36. Qualquer decaimento com efeito de forma mensuravel custa duracao, e nao existe meio minuto para gastar. A onda 4 nao esta escolhendo entre "bom" e "melhor": ela esta procurando o maior efeito de forma que caiba em uma folga de 0,42 minuto, e a medicao deste plano diz que essa folga compra muito pouco decaimento.
2. **A censura no teto de 60 minutos passou a distorcer a propria medicao.** Com 14,6 por cento das partidas truncadas (117 de 800, contra 5 antes), a media de duracao esta censurada por baixo e as fracoes de forma passam a incluir partidas que nunca terminaram. Qualquer ponto da grade da onda 4 que deixe essa fracao acima de alguns por cento produz numeros de forma que nao sao comparaveis com os deste documento. **Sugestao registrada para a onda 4:** tratar a fracao no teto de 60 minutos como criterio de ELIMINACAO de ponto, antes de comparar forma, e nao como coluna observada.

### A leitura de segunda ordem: a hipotese do plano esta REFUTADA

O plano 25B-03 previu, como hipotese explicita a medir e nao como premissa, que o custo em duracao seria de segunda ordem. O argumento era: depois de uma rota do perdedor estar limpa por inteiro, o fechamento passa por inibidor, torres do Nexus e Nexus, e o canal ja nao toca nenhum dos tres por contrato proprio; logo o unico trabalho que resta ao canal seria o excedente nas outras duas rotas.

**Qual dos dois aconteceu, com o numero: a duracao SE MOVEU MUITO, e a hipotese esta refutada. Mais 10,48 minutos, ou 29,5 por cento sobre o valor de partida.**

**A causa, identificada pela propria medicao e registrada para a onda 4 nao repetir o erro de leitura.** O argumento do plano estava certo sobre o CAMINHO (o canal de fato nao participa do fechamento depois da rota limpa) e errado sobre o EFEITO, porque ignorou o acoplamento indireto. As quedas de torre que o canal produzia nas outras duas rotas nao eram so contagem: elas alimentavam ouro, impulso e o diferencial estrutural, que sao insumos do CAMINHO DO GATE, que e quem derruba inibidor e Nexus. Tirar o excedente estrutural tira tambem o combustivel do gate, e o fechamento fica mais lento por um caminho que nao e o canal.

A evidencia direta dessa cadeia esta em duas colunas que se moveram na direcao oposta a que uma leitura ingenua esperaria:

- **`torres totais` SUBIU** de 11,471 para 12,863 por partida. O decaimento reduz a TAXA de dano estrutural, mas a partida ficou tao mais longa que o numero absoluto de torres cresceu. Foi a taxa que caiu (`torres/min` de 0,326 para 0,281), nunca o volume.
- **`razao de torres` DESABOU** de 3,393 para 1,954. Com o vencedor decaindo o proprio canal e o perdedor (que raramente limpa rota) mantendo o dele em 1, o termo virou uma vantagem liquida do PERDEDOR. Isso e efeito de desenho, previsto e desejado em direcao, mas a magnitude com o fator 0,5 apagou por inteiro o trabalho do termo de vantagem da Fase 25 e ainda passou do piso da banda.

**O que isso significa para a onda 5, e e melhor saber agora:** a onda 5 estava planejada para reavaliar o TETO do termo de vantagem "sobre o volume corrigido". Esta medicao mostra que os dois termos brigam pelo mesmo eixo em sentidos opostos, e que o decaimento e uma alavanca de razao de torres tao forte quanto o proprio termo de vantagem. As duas ondas nao sao independentes.

### O que NAO se moveu, e a prova de que o inicio de partida esta preservado por identidade

Esta e a coluna que o desenho do termo existia para garantir, e ela saiu exata:

| leitura do inicio de partida | antes | depois | diferenca |
|---|---|---|---|
| media da primeira torre (s) | 924,99 | **924,99** | **zero** |
| mediana da primeira torre (s) | 945 | **945** | **zero** |
| placas por partida | 10,660 | **10,660** | **zero** |
| CV da primeira torre | 0,1378 | **0,1378** | **zero** |
| torres aos 20:00 | 4,793 | 4,731 | menos 0,062 |

**A primeira torre e as placas ficaram identicas ate a segunda casa decimal.** Isso e consequencia direta da forma fechada: enquanto nenhuma rota do inimigo esta limpa por inteiro o termo vale 1 por identidade, e nenhuma rota fica limpa antes de a primeira torre cair e de as placas expirarem. **O gatilho por caminho de vitoria aberto entrega exatamente o que o gatilho por tempo de jogo nao entregaria**, e essa e a diferenca que o plano existia para provar.

Torres aos 20:00 mudou 1,3 por cento, o que e coerente: aos 20:00 raras partidas ja tem rota limpa por inteiro.

### Observacao no tier GAP-LEVE (nunca vira banda nesta fase)

| coluna | antes | depois | movimento |
|---|---|---|---|
| vencedor no maximo do contador | 0,963 | **0,891** | menos 0,072 |
| vitoria com UMA rota limpa | 0,011 | **0,028** | mais 0,017 |
| shutout | 0,703 | **0,485** | **menos 0,218** |
| exatamente 9 a 0 | 0,416 | **0,229** | **menos 0,187** |
| bimodalidade das torres do vencedor | 0,8169 | **0,8002** | menos 0,0167 |
| bimodalidade das torres do perdedor | 0,7988 | **0,6977** | menos 0,1011 |
| CV das torres do vencedor | 0,0417 | **0,0617** | mais 0,0200 |
| duracao media (min) | 30,81 | **40,58** | **mais 9,77** |

O mesmo padrao do tier de referencia: forma melhora em todas as colunas, duracao paga a conta. A ressalva ja registrada na onda 1 continua valendo e nao pode ser esquecida na onda 4: o GAP-LEVE ja tinha shutout de 40,8 por cento no motor pre-Fase-25, entao cobrar deste tier um shutout abaixo daquilo seria cobrar o que nunca existiu.

### Regras duras e determinismo, conferidos por inteiro

| verificacao | resultado |
|---|---|
| torre antes de 5:00, 3 tiers do gate estrutural | **0 eventos** |
| primeira torre antes de 7:00, 6 tiers do gate de ritmo | **0** |
| Baron antes de 20:00, 6 tiers do gate de ritmo | **0** |
| queda cross-lane simultanea (gap menor que 15 s), 3 tiers | **0 eventos** |
| inner antes de 10:00 e torre do Nexus antes de 20:00 | **0 eventos** |
| ator early correto (STR-06) | 100,0 / 99,8 / 100,0 por cento (gate maior ou igual a 85) |
| suporte como ator (STR-06b) | 1,8 / 1,5 / 1,0 por cento (gate abaixo de 5) |
| ADC fora da bot no early | 0,0 / 0,2 / 0,0 por cento (gate abaixo de 2) |
| chamadas ao gerador em `src/sim/` | **72**, a contagem canonica |
| linha do gate de pressao estrutural | **uma ocorrencia, byte a byte intacta** |
| `npx tsc --noEmit` | limpo |

**Zero violacao de regra dura da v2.0 nos seis tiers.** O gate estrutural inteiro continua verde.

### O desfecho colateral na cadeia de sete gates

`npm run calibrate:all` caiu de **4 de 7 verdes para 3 de 7**. O gate que virou e `calibrate:micro`, e a causa e a mesma da duracao, nao um defeito novo:

| gate | antes | depois | mudou? |
|---|---|---|---|
| `calibrate` | vermelho | vermelho | nao (Fase 28, FRC-02) |
| `calibrate:micro` | **verde** | **vermelho** | **sim, por consequencia da duracao** |
| `calibrate:structures` | verde | verde | nao |
| `calibrate:objectives` | verde | verde | nao |
| `calibrate:combat` | verde | verde | nao |
| `calibrate:pace` | vermelho | vermelho | so no conteudo, de 20 para 22 bandas |
| `calibrate:assists` | vermelho | vermelho | nao (Fase 26) |

**O assert que reprovou:** `placares absurdos: 47/800 (5,9 por cento)` contra o limiar `< 5 por cento` (PITFALLS P7, `scripts/calibrate-micro.ts` linha 571). O contador de absurdo conta partidas com estatistica extrema (por exemplo assistencias maiores ou iguais a 50), e ele sobe com a duracao por construcao: dez minutos e meio a mais de partida produzem mais abates e mais assistencias por partida.

**Classificacao, escrita para nao virar discussao na onda 4: e a MESMA falha da duracao, vista por outro instrumento, e nao um segundo defeito.** O limiar NAO deve ser afrouxado (a regra de fechamento por dono de banda proibe afrouxar banda para fazer gate passar, `scripts/README.md` secao 5.1). Ele volta sozinho quando a onda 4 escolher um fator que respeite o teto de duracao. **Sugestao registrada: usar `calibrate:micro` como sinal secundario de duracao na grade da onda 4**, porque ele reprova por um caminho independente e serve de conferencia cruzada do teto de 36 minutos.

### Insumo direto para a onda 4

1. **A grade tem de ser percorrida para CIMA a partir de 0,5**, ou seja em direcao a fatores mais brandos (0,6, 0,7, 0,8, 0,9), porque 0,5 ja estourou a duracao por dez minutos. Percorrer para baixo e desperdicio de medicao.
2. **A trava e a duracao, e ela e apertada por construcao**: teto 36 contra 35,58 de partida, folga de 0,42 minuto. Nenhum ponto da grade que estoure 36 pode ser escolhido, seja qual for o ganho de forma.
3. **A fracao no teto de 60 minutos e criterio de eliminacao antes de comparar forma**, pela censura que ela introduz na propria medicao.
4. **`razao de torres` passou a ser tao sensivel ao decaimento quanto ao termo de vantagem**, e cai rapido: 3,393 para 1,954 com o fator 0,5. A banda `[2,500; 4,500]` provavelmente sera a segunda trava da grade, junto com a duracao.
5. **A sensibilidade medida do ponto unico**, para dimensionar a grade (variacao por unidade de fator, entre o fator ausente e 0,5): shutout menos 0,45 por unidade, 9 a 0 menos 0,28 por unidade, maximo do contador menos 0,41 por unidade, duracao **mais 21 minutos por unidade** e razao de torres menos 2,9 por unidade. Estas taxas sao lineares por interpolacao de dois pontos e servem para escolher a grade, nunca para substituir a medicao de cada ponto.
6. **`calibrate:micro` e conferencia cruzada barata do teto de duracao**: ele reprova pelo contador de placares absurdos, que sobe com a duracao por um caminho independente do gate de ritmo. Ponto da grade que deixe `calibrate:micro` vermelho quase certamente estourou a duracao.
7. **Se nenhum ponto da grade fechar forma e duracao ao mesmo tempo**, a leitura deste plano diz por que: o orcamento de 22 minutos que o canal carrega ja estava inteiramente gasto no fechamento da Fase 25, e devolver forma sem outra fonte de encurtamento nao cabe. Nesse caso a decisao sai do escopo de uma alavanca e vira item de checkpoint, que e onde a onda 5 ja esta planejada para reabrir aprovacao humana.

---

---

## Secao 2: o decaimento esta TESTADO E REFUTADO, e por que (reversao, plano 25B-03)

### O veredito, em uma frase

**O decaimento move as sete bandas de forma na direcao certa e custa 10,48 minutos de duracao contra uma folga de 0,42, e a regiao da grade que fecharia os dois eixos ao mesmo tempo e VAZIA.** O mecanismo foi revertido do codigo em commit proprio. Esta secao existe para que ninguem o tente de novo.

### Por que ele falhou, e o diagnostico e de MECANISMO e nao de ponto de operacao

Isto e o que a secao 1 nao podia ver, porque ela media um mecanismo supondo que o defeito estava na magnitude:

**O decaimento reduz o throughput UNIFORMEMENTE.** Ele corta o dano do canal nas rotas que sobraram, igual para todas. Reduzir throughput uniforme **alonga a partida sem encurtar o caminho ate o Nexo**: o vencedor continua tendo de percorrer o mesmo caminho, so que mais devagar. Por isso a forma melhora (o vencedor chega a menos torres antes de a partida acabar) e a duracao explode ao mesmo tempo. Os dois efeitos sao a MESMA coisa vista por dois instrumentos, e nao um efeito com um custo: nao existe fator que produza um sem o outro. Isso torna a grade da onda 4 vazia por construcao, e nao por azar de calibracao.

### A causa real do defeito, confirmada por leitura de codigo

`accrueSiegePressure` tem `for (const side of ...)` e, dentro dele, `for (const lane of LANES)`. **O canal empurra AS TRES ROTAS EM PARALELO, todo tick, para os dois lados.**

Um time de verdade escolhe uma rota e concentra. Este espalha, entao as tres rotas progridem juntas, e quando uma fica funda as tres ficam. Dai o vencedor terminar com as tres limpas em 90,8 por cento das partidas, e dai a distribuicao de torres do vencedor virar massa pontual em 9.

**O defeito nunca foi o vencedor destruir DEMAIS. E ele PRECISAR destruir nove torres para ganhar**, quando o invariante escrito do proprio projeto (`src/sim/structures.test.ts` linhas 4 a 9) diz que basta limpar por inteiro UMA rota. Um mecanismo que reduz magnitude nao toca esse defeito, porque a magnitude nunca foi a variavel errada: a COBERTURA e.

### A evidencia da secao 1 relida sob o diagnostico correto

Tres numeros da secao 1, que pareciam efeitos colaterais, sao na verdade a assinatura do diagnostico:

1. **`torres totais` SUBIU** (11,471 para 12,863) enquanto a taxa caiu. O decaimento nao reduziu o trabalho: ele o esticou no tempo.
2. **A media de rotas limpas por vitoria continuou alta** mesmo com o fator em 0,5. O vencedor seguiu limpando as tres, so que mais devagar.
3. **A primeira torre e as placas ficaram identicas.** O mecanismo so agia depois da primeira rota limpa, que e tarde demais: a decisao de espalhar ja tinha sido tomada em todo tick desde o minuto zero.

### O mecanismo que o substitui: CONCENTRACAO DE ROTA

Em vez de reduzir o throughput, **REDISTRIBUIR** o mesmo throughput entre as tres rotas, favorecendo aquela em que o lado ja tem vantagem. Isso **encurta o caminho ate o Nexo** em vez de reduzir a velocidade, e portanto conserta a forma sem custo de duracao, possivelmente melhorando-a. O registro do desenho, das duas formas medidas e do resultado esta na secao 3.

### O que fica proibido a partir daqui, e por que

- **Nao reintroduzir decaimento de throughput do canal**, em nenhuma variante (por rota limpa, por tempo, por probabilidade de vitoria). A refutacao acima e de mecanismo, e vale para todas.
- **Nao ler a secao 1 como "o fator estava errado".** O fator nao estava errado: o eixo estava.

---

---

## Secao 3: a CONCENTRACAO DE ROTA, o mecanismo que substituiu o decaimento (plano 25B-03)

### O desenho, em uma frase

Em vez de REDUZIR o throughput do canal, **REDISTRIBUIR** o mesmo throughput entre as tres rotas, favorecendo aquela em que o lado ja tem vantagem de pressao. Os tres pesos somam exatamente 3 por construcao, entao **o total por tick nao muda**: a alavanca e de FORMA e o custo de nivel e proximo de zero por construcao, e nao por calibracao.

`siegeLaneFocus(state, side, lane)` le exclusivamente `state.pressure`, o MESMO campo que `bestPressureLane` ja usa para escolher a rota de macro. Forma fechada: quociente exponencial da vantagem de pressao dividida por uma temperatura, normalizado para somar 3.

### O resultado, contra o estado ANTES do decaimento (o que a onda 2 mediu)

**Duracao 35,58 para 30,87 minutos. O mecanismo ENCURTOU a partida em vez de alonga-la, que e exatamente a diferenca entre redistribuir e reduzir.**

| coluna | banda | antes (onda 2) | **depois (T=14)** | veredito |
|---|---|---|---|---|
| **FORMA** | | | | |
| vencedor no maximo do contador | `[0,010; 0,250]` | 0,908 | **0,236** | **ENTROU** |
| vitoria exigiu limpar as TRES rotas | `[0,010; 0,350]` | 0,908 | **0,236** | **ENTROU** |
| exatamente 9 a 0 | `[0,000; 0,050]` | 0,209 | **0,046** | **ENTROU** |
| bimodalidade das torres do VENCEDOR | `[0,250; 0,5556]` | 0,785 | **0,458** | **ENTROU** (alvo 0,459) |
| vitoria com exatamente UMA rota limpa | `[0,500; 0,800]` | 0,026 | **0,268** | fora pelo piso |
| shutout | `[0,020; 0,120]` | 0,449 | **0,491** | fora pelo teto |
| bimodalidade das torres do PERDEDOR | `[0,250; 0,5556]` | 0,649 | **0,633** | fora pelo teto |
| **DISPERSAO** (razao contra a ancoragem) | | | | |
| torres do vencedor | `[0,750; 2,000]` | 0,202 | **0,709** | fora, mas **3,5 vezes melhor** |
| torres por minuto | `[0,750; 2,000]` | 0,504 | **0,641** | fora |
| primeira torre | `[0,750; 2,000]` | 0,543 | **0,549** | fora |
| **NIVEL, o criterio 4** | | | | |
| torres/min | `[0,300; 0,450]` | 0,326 | **0,303** | **DENTRO** |
| torres aos 20:00 | `[2,500; 5,000]` | 4,793 | **4,825** | **DENTRO** |
| mediana da primeira torre (s) | `[780; 1140]` | 945 | **885** | **DENTRO** |
| placas por partida | `[5,000; 12,000]` | 10,660 | **11,411** | **DENTRO** |
| **duracao media (min)** | `[29; 36]` | 35,58 | **30,87** | **DENTRO, e com folga de 5,13** |
| razao de torres | `[2,500; 4,500]` | 3,393 | **3,274** | **DENTRO** |
| fracao no teto de 60 minutos | `[0; 0,005]` | 0,006 | **0,001** | **ENTROU** |
| **REGRAS DURAS (seis tiers)** | igual a 0 | 0 | **0** | **ZERO ABSOLUTO** |

**Placar: 5 bandas entraram, ZERO sairam.** O gate de ritmo foi de 20 vermelhas para **16**, e as vermelhas com dono Fase 25B de 10 para **6**. `npm run calibrate:all` segue em **4 de 7 gates verdes**, o mesmo placar do fechamento da Fase 25: zero regressao colateral.

Compare com o decaimento, medido na secao 1: ele fechou **zero** bandas e quebrou **tres** que estavam verdes.

### A grade medida que escolheu a temperatura

Tier EQUILIBRADO, N = 800, uma alavanca movida. Todas as linhas medidas com a sonda de forma.

| T | duracao | torres/min | maximo | UMA rota | shutout | 9 a 0 | BC venc | CV venc (razao) |
|---|---|---|---|---|---|---|---|---|
| ausente | 35,58 | **0,326** | 0,908 | 0,026 | 0,449 | 0,209 | 0,785 | 0,202 |
| 30 | 32,23 | **0,326** | 0,495 | 0,126 | 0,502 | 0,121 | 0,598 | 0,461 |
| 24 | 32,45 | **0,321** | 0,436 | 0,166 | 0,481 | 0,111 | 0,578 | 0,531 |
| 20 | 31,74 | **0,317** | 0,363 | 0,198 | 0,507 | 0,091 | 0,519 | 0,575 |
| 16 | 31,35 | **0,310** | 0,286 | 0,210 | 0,507 | 0,064 | 0,490 | 0,635 |
| **14 (escolhida)** | **30,87** | **0,303** | **0,236** | 0,268 | 0,491 | **0,046** | **0,458** | 0,709 |
| 12 | 30,54 | 0,297 FORA | 0,194 | 0,290 | 0,496 | 0,038 | 0,455 | 0,795 |
| 8 | 29,60 | 0,279 FORA | 0,109 | 0,411 | 0,505 | 0,025 | 0,433 | 0,944 |
| 6 | 29,31 | 0,264 FORA | 0,069 | **0,516** | 0,502 | 0,010 | 0,455 | **1,069** |
| 4 | 29,03 | 0,255 FORA | 0,056 | **0,589** | 0,483 | 0,009 | 0,446 | **1,088** |
| 3 | 29,05 | 0,249 FORA | 0,041 | **0,649** | 0,461 | 0,005 | 0,499 | **1,147** |
| 2 | 29,06 | 0,244 FORA | 0,029 | **0,694** | 0,423 | 0,004 | 0,499 | **1,128** |
| binaria (T tendendo a 0) | 29,04 | 0,245 FORA | **0,025** | **0,743** | 0,365 | 0,001 | 0,511 | **1,145** |

**O criterio que escolheu T = 14, escrito antes de olhar a coluna de forma:** a MENOR temperatura da grade que mantem **as seis bandas de nivel dentro**, ou seja o ponto de maior efeito de forma que nao devolve nada do que a Fase 25 conquistou. A trava e `torres/min`, que sai do piso a partir de T = 12.

### AS DUAS FRONTEIRAS MEDIDAS, e e aqui que este plano PARA

> **ATUALIZACAO, escrita depois da secao 4: a FRONTEIRA 1 abaixo DISSOLVE sob a leitura de `torres/min` que inclui as torres do Nexus.** Ela era artefato de INSTRUMENTO e nao restricao do motor. O texto original fica na integra porque a leitura A continua sendo o que a banda avalia hoje, e porque a distincao entre as duas leituras e o resultado. Ver secao 4.

**FRONTEIRA 1: as janelas de `UMA rota` e de `torres/min` NAO SE SOBREPOEM.**

- `vitoria com UMA rota limpa` maior ou igual a 0,500 exige **T menor ou igual a 6**.
- `torres/min` maior ou igual a 0,300 exige **T maior ou igual a 14**.

Nao existe temperatura que satisfaca as duas. A mesma leitura vale, com folga menor, para a banda de DISPERSAO das torres do vencedor (piso 0,750, alcancado a partir de T = 12, ou seja **a dois pontos** da trava de nivel).

**A causa e aritmetica e nao de calibracao.** Concentrar reduz quantas torres o vencedor precisa destruir (e esse e o conserto), e `torres/min` conta torres por minuto. Como a duracao tambem cai, o quociente cai junto: entre T = 14 e T = 6 as torres totais caem mais depressa do que a duracao. **Uma alavanca que corrige a COBERTURA nao pode preservar uma banda que mede VOLUME por tempo.** Fechar as duas exige uma segunda alavanca, e este plano nao a procura, por instrucao.

Registro honesto de um agravante ja conhecido: `towersDestroyed` **nao conta as duas torres do Nexus** (D-25-04, medido em `docs/diagnostics/25B-ancoragem.md`), entao `torres/min` ja e sistematicamente baixo por construcao contra uma referencia de pro play que soma onze torres por lado. O destino de D-25-04 e da Fase 30.

**FRONTEIRA 2: o shutout NAO E DESTE MECANISMO, e a medicao confirma a atribuicao do roadmap.**

O shutout ficou em 0,491 contra 0,449, ou seja praticamente parado em toda a grade (de 0,423 a 0,507 entre T = 2 e T = 30). Isso e coerente com a atribuicao ja escrita no roadmap: **o shutout foi criado pelo TERMO DE VANTAGEM do plano 25-06**, e a alavanca dele e o teto daquele termo, que e o assunto da onda 5. A bimodalidade das torres do PERDEDOR segue o shutout pela mesma razao.

### A distribuicao de rota: o desenho NAO virou trilho

O criterio de falha declarado era colapsar sempre na mesma rota. Medido, tier EQUILIBRADO, N = 800, fracao de partidas em que aquela rota do perdedor terminou limpa por inteiro:

| temperatura | top | mid | bot |
|---|---|---|---|
| T = 14 | 62,9 | **74,8** | 59,3 |
| T = 4 | 42,0 | **62,4** | 42,4 |

As tres rotas participam nas duas pontas da grade, com a mid a frente, que e o desfecho narrativamente correto (a mid e a rota mais curta e a que acumula mais pressao). **Nao ha colapso e nao ha trilho**, e a razao esta na forma fechada: com pressao uniforme os tres pesos valem exatamente 1, entao nao existe rota escolhida por desempate. Foi exatamente isso que descartou a variante binaria como implementacao, embora ela seja o limite da mesma familia.

### As duas formas que o desenho mandava comparar

| forma | como foi medida | desfecho |
|---|---|---|
| **espalhar com inclinacao** (peso linear com corte) | implementada e medida em 6 pontos | **satura**: de F = 0,95 para F = 0,99 o maximo do contador so vai de 0,209 para 0,184 e `UMA rota` para de subir em 0,21. A rota do meio fica presa em peso 1, entao a forma linear **nao alcanca** o regime de concentracao |
| **concentrar por inteiro** (binaria, toda a carga na rota de maior pressao) | implementada e medida | **fecha 6 das 7 bandas de forma** e derruba `torres/min` para 0,245, alem de concentrar desde o tique zero por desempate arbitrario |
| **quociente exponencial normalizado** (o escolhido) | grade de 12 pontos acima | **contem as duas pontas numa constante so**, com identidade exata em pressao uniforme. Foi escolhida por isso, e nao por ajuste fino |

### A fonte: `state.pressure` contra `laneLead`, medido e nao suposto

| fonte | ponto | duracao | torres/min | UMA rota | shutout | BC venc |
|---|---|---|---|---|---|---|
| `state.pressure` | T = 6 | 29,31 | 0,264 | 0,516 | 0,502 | **0,455 unimodal** |
| `laneLead` | T = 20 | 30,87 | 0,265 | 0,489 | **0,429** | **0,498 unimodal** |
| `laneLead` | T = 6 | 30,21 | 0,228 | 0,705 | **0,348** | **0,584 BIMODAL** |
| `laneLead` | T = 2 | 30,37 | 0,221 | 0,708 | 0,351 | **0,639 BIMODAL** |

**`laneLead` nao e pior em tudo, e vale registrar onde ele e melhor:** shutout mais baixo e um pouco mais de folga contra o piso de duracao. **O que o descartou foi a nao monotonicidade da bimodalidade do vencedor:** com `laneLead`, apertar a concentracao leva o coeficiente de 0,498 para 0,584 e depois 0,639, ou seja a distribuicao **volta a ser bimodal** justamente onde a concentracao deveria ser mais forte. Com `state.pressure` ele e monotono e permanece unimodal em toda a faixa util. A leitura mecanica: `laneLead` ignora o progresso ESTRUTURAL e decai por tick, entao sob concentracao forte ele passa a apontar para uma rota que nao e a que abriu, e o resultado reempilha o vencedor no maximo do contador.

O argumento de arquitetura vai no mesmo sentido e nao contra: `state.pressure` e o campo que o resto do motor ja usa para decidir onde o jogo esta acontecendo, e agrega poder de rota, `laneLead`, torre externa caida, inibidor caido e Baron num numero so.

### Um defeito PRE-EXISTENTE que a concentracao tornou alcancavel

**`resolveHeraldUse` destroi o inibidor e emite `tower_low`**, nunca `inhibitor_destroyed`. A causa esta escrita no proprio codigo, e e a decisao OBJ-01 da Fase 19: o Arauto nunca aparece em `kind` de queda, entao o evento real e substituido. Quando o Arauto e quem derruba o inibidor, **a linha do tempo perde o evento** e o invariante de ordenacao de `src/sim/structures.test.ts` ("um inibidor cai antes de qualquer torre do Nexus") fica sem como ser verificado.

**Medido, roster 72 contra 70, N = 1000, os dois estados:**

| estado | Arauto derrubou o inibidor | quebras do invariante |
|---|---|---|
| sem concentracao (onda 2) | 1 (0,10 por cento) | **0** |
| com concentracao (T = 14) | 9 (0,90 por cento) | **2 (0,20 por cento)** |

**O defeito ja existia**, e a concentracao apenas o tornou nove vezes mais frequente, porque as rotas ficam limpas por inteiro mais cedo, ainda dentro da janela do Arauto.

**Este plano NAO o conserta, e a razao e medida:** dos nove casos, **um aconteceu antes de 16:00**, e `inhibitor_destroyed` antes de 16:00 e evento de classe `nearZero` na tabela de plausibilidade (`src/sim/plausibility.ts`). Emitir o evento real, que e a correcao obvia, **criaria uma violacao de regra dura de plausibilidade**. A correcao certa exige decidir o que fazer com OBJ-01 e medir os seis tiers, o que e mudanca de outra fase e nao desta alavanca. Fica registrado como item diferido com dono.

### Insumo direto para a onda 4

1. **A alavanca do sweep passa a ser `SIEGE_FOCUS_TEMPERATURE`**, e nao mais o fator de decaimento. A grade util esta medida entre T = 2 e T = 30 e a regiao de decisao e **T entre 6 e 14**.
2. **A trava e `torres/min`, nao a duracao.** A duracao tem 5,13 minutos de folga contra o teto em T = 14 e nunca chega perto do piso 29 acima de T = 8. Isso inverte a trava da fase, que na secao 1 era duracao.
3. **A fronteira 1 esta medida e provavelmente nao se fecha com esta alavanca sozinha.** Se a onda 4 confirmar isso na grade fina, a decisao sai do escopo de uma alavanca.
4. **A onda 5 ficou mais importante, nao menos.** O shutout e a bimodalidade do perdedor sao insensiveis a esta alavanca em toda a grade, e a atribuicao do roadmap (termo de vantagem do plano 25-06) esta confirmada por medicao.
5. **Vigiar a densidade narrativa.** As duas ancoras de seed de `engineWiring.test.ts` cairam de alcancabilidade com o encurtamento: EVT-01 de 93,3 para 55,0 por cento e WR-02 de 19,5 para 16,5. As duas seguem em dois digitos e o dono e a Fase 26.

---

## Secao 4: as DUAS LEITURAS de torres/min, e a dissolucao da fronteira 1 (plano 25B-03)

### O que esta secao e, e o que ela explicitamente NAO e

Esta secao e **MEDICAO PARA DECIDIR**. Nada foi alterado por ela: **o contador segue o mesmo, a banda segue a mesma e o gate segue avaliando exatamente o que avaliava**. Trocar a base de medicao de uma banda no meio de uma fase seria mudar a regua durante a prova; se isso for feito algum dia, tem de ser decisao explicita com re-ancoragem declarada, e nunca efeito colateral de um sweep.

As duas leituras, ambas do estado final e ambas ja instrumentadas na onda 1:

- **Leitura A**, a que a banda avalia hoje: `user.towersDestroyed + rival.towersDestroyed` dividido pelos minutos.
- **Leitura B**, com as torres do Nexus incluidas: a mesma soma **mais** `(2 - nexusTurretsAlive)` de cada lado, que e a linha observada de D-25-04 registrada em `docs/diagnostics/25B-ancoragem.md` Bloco 5.

O motivo de B existir: `towersDestroyed` **nao conta as duas torres do Nexus**, porque o ramo de torre do Nexus de `damageStructure` e o unico ramo de queda que nao chama `recordTower()`. A referencia de pro play de `torres/min` e sobre **onze** torres por lado; a leitura A conta **nove**.

### A tabela das duas leituras, grade completa

Tier EQUILIBRADO, 75 contra 75, N = 800, semente igual ao indice, fixture copiada do gate. Banda `[0,300; 0,450]`.

| T | **A** (contador de hoje) | **B** (com torres do Nexus) | delta | torres do Nexus por partida | duracao (min) | UMA rota |
|---|---|---|---|---|---|---|
| 30 | 0,3258 | **0,3923** | +0,0665 | 2,065 | 32,23 | 0,126 |
| 24 | 0,3208 | **0,3873** | +0,0665 | 2,067 | 32,45 | 0,166 |
| 20 | 0,3166 | **0,3844** | +0,0679 | 2,072 | 31,74 | 0,198 |
| 16 | 0,3100 | **0,3790** | +0,0690 | 2,083 | 31,35 | 0,210 |
| **14 (commitado)** | **0,3034** | **0,3732** | +0,0698 | 2,072 | 30,87 | 0,268 |
| 12 | 0,2971 FORA | **0,3676** | +0,0705 | 2,075 | 30,54 | 0,290 |
| 10 | 0,2908 FORA | **0,3628** | +0,0720 | 2,084 | 30,02 | 0,343 |
| 8 | 0,2788 FORA | **0,3517** | +0,0729 | 2,085 | 29,60 | 0,411 |
| **6** | **0,2636 FORA** | **0,3376** | +0,0739 | 2,092 | 29,31 | **0,516** |
| 5 | 0,2610 FORA | **0,3356** | +0,0747 | 2,089 | 28,97 | 0,539 |
| 4 | 0,2554 FORA | **0,3300** | +0,0746 | 2,090 | 29,03 | 0,589 |
| 3 | 0,2493 FORA | **0,3244** | +0,0750 | 2,109 | 29,05 | 0,647 |
| 2 | 0,2439 FORA | **0,3194** | +0,0755 | 2,127 | 29,06 | 0,693 |

**O delta e estavel e grande: de +0,0665 a +0,0755 em toda a grade**, ou seja entre 20 e 31 por cento do valor medido pela leitura A. Ele cresce quando T cai, e a razao e mecanica: a partida encurta e as torres do Nexus caem em quase toda partida (2,06 a 2,13 por partida, de um maximo de 4), entao o mesmo numerador ausente e dividido por menos minutos.

### As quatro respostas, com numero

**1. Sob a leitura B, qual e o T minimo que satisfaz `torres/min` maior ou igual a 0,300?**

**T = 2, que e o extremo inferior da grade medida, com B = 0,3194 e folga de +0,0194.** Nenhum ponto medido reprova sob B. Extrapolando para a variante binaria (leitura A de 0,245), B ficaria em cerca de 0,321, tambem dentro. **Sob a leitura B, `torres/min` deixa de ser restricao em toda a familia alcancavel.**

**2. Esse T minimo se sobrepoe com o `T menor ou igual a 6` que a banda `uma rota` exige?**

**SIM, e com folga larga.** A fronteira 1, como escrita na secao 3, **DISSOLVE sob a leitura B**: ela era inteiramente um artefato do contador nao ver as duas torres do Nexus.

**3. Qual e a regiao de sobreposicao, e o que as OUTRAS bandas fazem dentro dela?**

A sobreposicao nao e ilimitada, porque outras duas bandas passam a ser as travas. Medido ponto a ponto com o gate completo:

| banda | T = 7 | **T = 6,5** | **T = 6** | T = 5 | T = 4 |
|---|---|---|---|---|---|
| UMA rota `[0,500; 0,800]` | 0,485 FORA | **0,504** | **0,516** | 0,539 | 0,589 |
| mediana da 1a torre (s) `[780; 1140]` | 810 | **795** | **795** | 765 FORA | 735 FORA |
| duracao (min) `[29; 36]` | 29,49 | **29,61** | **29,31** | 28,97 FORA | 29,03 |
| torres/min, leitura B | 0,346 | 0,342 | **0,3376** | 0,3356 | 0,3300 |

**A REGIAO DE SOBREPOSICAO E `T` ENTRE APROXIMADAMENTE 5,5 E 6,5**, com o centro em **T = 6**. Ela e estreita mas nao e vazia. As travas mudaram de novo: agora sao a **mediana da primeira torre** (piso 780, que cai abaixo entre T = 6 e T = 5) e a **duracao** (piso 29).

**O retrato completo em T = 6**, medido com `npm run calibrate:pace` inteiro:

| banda | banda | valor em T = 6 | veredito |
|---|---|---|---|
| **FORMA** | | | |
| vencedor no maximo do contador | `[0,010; 0,250]` | **0,069** | DENTRO |
| vitoria exigiu limpar as TRES rotas | `[0,010; 0,350]` | **0,069** | DENTRO |
| **vitoria com exatamente UMA rota limpa** | `[0,500; 0,800]` | **0,516** | **DENTRO** |
| exatamente 9 a 0 | `[0,000; 0,050]` | **0,010** | DENTRO |
| bimodalidade das torres do VENCEDOR | `[0,250; 0,5556]` | **0,455** | DENTRO |
| shutout | `[0,020; 0,120]` | 0,502 | FORA (fronteira 2, onda 5) |
| bimodalidade das torres do PERDEDOR | `[0,250; 0,5556]` | 0,565 | FORA por **0,009** (fronteira 2) |
| **DISPERSAO** | | | |
| **torres do vencedor** | `[0,750; 2,000]` | **1,069** | **DENTRO** |
| **torres por minuto** | `[0,750; 2,000]` | **0,948** | **DENTRO** |
| primeira torre | `[0,750; 2,000]` | 0,519 | FORA |
| **NIVEL** | | | |
| torres/min, **leitura A** | `[0,300; 0,450]` | 0,264 | FORA |
| torres/min, **leitura B** | `[0,300; 0,450]` | **0,338** | **DENTRO** |
| torres aos 20:00 | `[2,500; 5,000]` | **4,593** | DENTRO |
| mediana da primeira torre (s) | `[780; 1140]` | **795** | DENTRO (folga 15 s) |
| placas por partida | `[5,000; 12,000]` | **10,781** | DENTRO |
| duracao media (min) | `[29; 36]` | **29,31** | DENTRO (folga 0,31) |
| razao de torres | `[2,500; 4,500]` | **2,720** | DENTRO |
| fracao no teto de 60 minutos | `[0; 0,005]` | **0,000** | DENTRO |

**Em T = 6, sob a leitura B, TODAS as bandas de nivel estao dentro, e das dez bandas com dono Fase 25B sete estao verdes.** As tres vermelhas sao shutout, bimodalidade do perdedor (a 0,009 do teto) e dispersao da primeira torre.

**O ponto vizinho T = 4 troca uma banda por outra**, e vale registrar porque delimita a regiao: a bimodalidade do PERDEDOR ENTRA (0,535, contra 0,565 em T = 6), mas a mediana da primeira torre SAI (735 contra o piso 780). Ou seja abaixo de T = 5,5 a fase compra forma pagando com o inicio de partida, que e exatamente o que a fase nao pode fazer.

**4. Se nao se sobrepoe, qual e a distancia que falta?** Nao se aplica: sobrepoe.

### A leitura, sem suavizar

**A fronteira 1 nao era uma restricao de fisica do motor: era uma restricao de INSTRUMENTO.** As duas janelas nao se sobrepunham porque a banda de `torres/min` avalia um contador que ignora dois nonos das torres do mapa, e o erro relativo desse contador **cresce** exatamente na direcao em que a fase precisa andar (partida mais curta, menos torres de rota, mesmas duas torres de Nexus).

Isso **nao autoriza mexer na banda agora**, e esta secao nao mexe. Ela entrega tres coisas:

1. a regiao de decisao da onda 4 deixa de ser vazia e passa a ser **`T` entre 5,5 e 6,5 sob a leitura B**, contra a regiao **`T` maior ou igual a 14 sob a leitura A**;
2. a escolha entre essas duas regioes e uma **decisao explicita de re-ancoragem de banda**, do usuario, e nao um efeito colateral de sweep;
3. a Fase 30 recebe a tabela completa das duas leituras, que serve a D-25-04 mesmo que a decisao de hoje seja nao mexer.

**Se a decisao for NAO re-ancorar**, o ponto de operacao continua sendo `T` maior ou igual a 14 e a fase fecha com quatro bandas de forma verdes. **Se a decisao for re-ancorar**, o ponto de operacao passa a ser `T = 6` e a fase fecha com sete das dez bandas dela verdes, restando so o que pertence a onda 5 e a primeira torre.

---

## Secao 5: a correcao da contagem de torres, e o que foi e o que NAO foi re-ancorado

### O enquadramento, e ele e o que separa isto de afrouxar banda

**Isto NAO e re-ancoragem de conveniencia. E correcao de ERRO DE ESPECIFICACAO.**

A referencia da banda de `torres/min` (0,36 a 0,38 torres por minuto, `STACK.md` secao 7, OE 2023 a 2025, N = 5.958) vem de partidas pro **reais**. Uma partida de LoL tem **onze** torres por lado, incluindo as duas do Nexus, e uma partida que termina necessariamente tem as duas torres do Nexus do perdedor destruidas. **Logo a referencia SEMPRE contou as torres do Nexus.**

O contador `towersDestroyed` **nunca** contou: o ramo de torre do Nexus de `damageStructure` e o unico ramo de queda que nao chama `recordTower()` (D-25-04). A banda vinha comparando uma metrica que **subconta** contra uma referencia que **conta tudo**, e isso existe **desde a Fase 23**, quando a banda foi escrita.

**Piso e teto NAO mudam de valor.** O que muda e a metrica passar a medir a mesma coisa que a referencia mede.

### Onde a correcao foi aplicada, e onde NAO foi

| banda | leitura | por que |
|---|---|---|
| `torres/min` (nivel) | **completa** | referencia externa conta onze torres |
| `torres aos 20:00` | **completa** | mesma referencia; ver a nota abaixo |
| `razao de torres` | **completa nos dois lados do quociente** | mesma referencia |
| `torres totais` (dispersao) | **completa** | mesma grandeza que `torres/min` |
| `torres por minuto` (dispersao) | **completa** | idem |
| as sete bandas de FORMA | **contador de nove, inalterado** | as duas torres do Nexus sao uma CONSTANTE (2,07 por partida). Somar constante a uma metrica de forma desloca a media e comprime o desvio **sem acrescentar informacao de forma**. As bandas de forma perguntam "quantas ROTAS o vencedor precisou limpar", que e pergunta sobre as nove torres de rota |
| dispersao de `torres do vencedor` e `do perdedor` | **contador de nove, inalterado** | idem: sao instrumentos de forma |
| `razao torres sobre abates` | **contador de nove, inalterado** | **dono Fase 26.** Sofre do mesmo erro, mas corrigi-la seria mover a regua de uma banda que esta decisao nao alcanca. O valor corrigido foi medido e escrito no codigo para a Fase 26 nao precisar remedir: **0,285 na leitura completa contra 0,233 no contador de nove**, banda `[0,330; 0,550]`, ou seja **vermelha nas duas** e a correcao apenas a aproxima do piso |

**Nota sobre `torres aos 20:00`, e ela responde a pergunta de como a leitura intermediaria foi resolvida.** Aos 20:00 nao existe estado final de onde ler `nexusTurretsAlive`, e `ev.score` le `towersDestroyed`, que carrega o mesmo erro. A contagem completa ate 20:00 foi entao derivada da **timeline**: cada `nexus_exposed` e a segunda torre do Nexus daquele lado e cada `tower_destroyed` com o ticker de torre do Nexus e a primeira.

**MEDIDO: a serie e IDENTICA a antiga, 4,825 antes e 4,825 depois, porque em 0 de 800 partidas alguma torre do Nexus ja tinha caido aos 20:00.** A razao e estrutural e nao amostral: uma torre do Nexus so pode cair depois de um inibidor cair, e `inhibitor_destroyed` antes de 16:00 e evento de classe `nearZero` na tabela de plausibilidade. A serie foi implementada assim mesmo para que a definicao da metrica seja a mesma nas quatro bandas, em vez de a de 20:00 ficar como excecao silenciosa.

### Onde a correcao foi feita, e por que ali

**Na LEITURA DO HARNESS (`scripts/calibrate-pace.ts`), com `src/sim/` INTOCADO.** Corrigir o proprio `towersDestroyed` seria mudanca de MOTOR: deslocaria o golden e **misturaria a correcao de instrumento com a mudanca de comportamento da onda 3 no mesmo deslocamento**, o que tornaria o diff da onda 6 impossivel de atribuir. A contagem completa e derivada do estado final como `towersDestroyed` do lado mais `(2 - nexusTurretsAlive)` do adversario, exatamente a linha observada que a onda 1 instrumentou.

### O que precisou de re-ancoragem, e o que explicitamente NAO precisou

**NAO precisaram: as quatro bandas de NIVEL.** Piso, teto e alvo continuam com os mesmos valores, porque a **referencia externa nao mudou**. Foi a metrica que passou a medir a coisa certa. Registrar isso explicitamente e obrigatorio: mexer nos limites aqui seria transformar uma correcao de especificacao numa mudanca de meta.

**PRECISARAM: as duas bandas de DISPERSAO corrigidas.** A razao e aritmetica e nao opcional: somar uma quantidade quase constante a uma serie **comprime** o coeficiente de variacao dela (a media sobe, o desvio quase nao muda). Comparar o coeficiente novo contra a ancoragem antiga mediria a mudanca de **DEFINICAO** e nao a mudanca de **MOTOR**, que e exatamente o erro que a onda 1 existiu para eliminar.

**Procedencia da ancoragem nova**, pelo mesmo procedimento da onda 1 e sem atalho: `git checkout a24ea23 -- src/sim/` reconstroi o motor pre-Fase-25 exato; a medicao roda na fixture EQUILIBRADO 75 contra 75, N = 800, semente igual ao indice; a restauracao foi provada por **hash de blob dos cinco arquivos** contra o commitado, nunca por `git status`, pela armadilha de `core.autocrlf`.

| ancoragem | contador de nove | **contagem completa** | compressao |
|---|---|---|---|
| `torres totais` | 0,3015 | **0,2407** | 20 por cento |
| `torres por minuto` | 0,2103 | **0,1648** | 22 por cento |

**A validacao que autoriza usar estes dois numeros:** a mesma rodada reproduziu as tres ancoragens antigas na quarta casa decimal (`torres totais` 0,3015, `torres por minuto` 0,2103, `torres do vencedor` 0,2803) e as medias correspondentes (9,631, 0,1839 e 5,759). O instrumento novo mede o mesmo estado que o da onda 1 mediu, e a unica diferenca entre as duas linhas e a definicao da metrica.

### O efeito medido da correcao sozinha, com o motor parado em T = 14

Nenhuma constante de motor foi movida entre estas duas colunas: a unica diferenca e a leitura.

| banda | banda | contador de nove | **contagem completa** | veredito |
|---|---|---|---|---|
| torres/min | `[0,300; 0,450]` | 0,303 | **0,373** | dentro nas duas |
| torres aos 20:00 | `[2,500; 5,000]` | 4,825 | **4,825** | **identico** |
| **razao de torres** | `[2,500; 4,500]` | 3,274 | **4,048** | **dentro nas duas**, folga de 0,452 contra o teto |
| dispersao `torres totais` | `[0,750; 2,000]` | 0,866 | **1,003** | dentro nas duas |
| dispersao `torres por minuto` | `[0,750; 2,000]` | 0,641 | **0,680** | fora nas duas |
| torres por partida (media) | observado | 9,39 | **11,46** | mais 2,07 |
| torres do vencedor (media) | observado | 7,19 | **9,19** | mais 2,00 |

**A `razao de torres` e a linha que exigia medicao antes e depois, e ela se moveu muito: de 3,274 para 4,048.** A causa e assimetrica por construcao e vale escrever: as duas torres do Nexus somam quase sempre **2 ao vencedor** e quase sempre **0 ao perdedor**, entao a correcao empurra o quociente para cima. **Ela NAO saiu da banda**, e fica com folga de 0,452 contra o teto 4,500 em T = 14 (e mais folga ainda no ponto de operacao escolhido, T = 6, onde mede **3,517**, a 0,167 do alvo de 3,350). Se tivesse saido, a instrucao era parar e reportar em vez de compensar com a temperatura.

**Leitura de sanidade que vale mais que a banda:** sob a contagem completa o vencedor destroi **9,19** torres por partida, contra a referencia de pro play de **9,15** (`STACK.md` secao 3 linha 10). A metrica corrigida cai praticamente em cima da referencia, o que e a evidencia mais direta de que ela passou a medir a mesma grandeza.

---

## Secao 6: o ponto de operacao final, e as DUAS TRAVAS que as bandas sozinhas nao mostravam

### Uma correcao de medicao minha, escrita antes do resultado

A secao 4 concluiu que a regiao de decisao era `T` entre 5,5 e 6,5 e recomendou T = 6. **Aquele retrato estava INCOMPLETO por erro meu:** eu conferi apenas as linhas de banda (`[OK]` e `[FALHA]`) dos relatorios e **nao os contadores de assert duro**, que sao impressos noutra parte do arquivo e nao passam por `checkBand`.

**A violacao ja estava nos relatorios de T = 6, T = 5 e T = 4 que eu reportei, e passou sem mencao.** Fica registrada aqui em vez de corrigida em silencio, porque o modo de falha e exatamente o que esta fase existe para eliminar: um numero verde escondendo um vermelho que ninguem olhou.

### TRAVA 1: regra dura de plausibilidade, nao negociavel

O assert `primeira torre antes de 7:00 igual a zero`, exigido nos **seis** tiers (`STACK.md` secao 7: minimo absoluto observado de 8:15 em 500 jogos pro). Contador do tier **PRO-GAP**, 800 partidas:

| T | 4 | 5 | 6 | 6,5 | 7 | **8** | **9** | 10 | 12 | 14 |
|---|---|---|---|---|---|---|---|---|---|---|
| primeira torre antes de 7:00 | 1 | 1 | 1 | 1 | 1 | **0** | **0** | 0 | 0 | 0 |

**Abaixo de T = 8 a concentracao leva UMA partida em 800 do PRO-GAP a derrubar a primeira torre antes de 7:00.** O mecanismo e direto e previsivel em retrospecto: concentrar dano numa rota so **acelera a primeira queda**, e o tier de gap ja e o que chega mais cedo. Zero absoluto significa zero, entao a regra dura sozinha ja proibe toda a regiao `5,5 a 6,5` da secao 4.

### TRAVA 2: uma banda que estava VERDE e virou

`Baron no spawn por partida` (`scripts/calibrate-objectives.ts`, dono **Fase 19**, banda `[0,020; 0,240]`, PROVISORIA) mede **0,250 em T = 8** e volta a passar em **T = 9**. Partida mais curta e progresso estrutural mais rapido tornam o Baron no instante do spawn mais frequente.

**Afrouxar a banda esta proibido** pela regra de fechamento por dono (`scripts/README.md` secao 5.1), e ela tinha sido escrita com procedencia explicita ("a taxa medida 0,198 mais dois desvios de contagem"). Pela regra de reatribuicao da mesma secao, **um vermelho produzido por esta fase passa a ser desta fase**, entao a saida correta e nao produzir o vermelho.

### O ponto de operacao: T = 9

**O menor valor que satisfaz as duas travas.** Retrato completo, tier EQUILIBRADO, N = 800, com a contagem de torres ja corrigida:

| banda | banda | **T = 9** | veredito |
|---|---|---|---|
| **REGRAS DURAS (seis tiers)** | igual a 0 | **0** | **ZERO ABSOLUTO** |
| torre antes de 5:00 (tres tiers) | igual a 0 | **0** | zero |
| queda cross-lane simultanea | igual a 0 | **0** | zero |
| **NIVEL** | | | |
| torres/min | `[0,300; 0,450]` | **0,357** | **DENTRO** |
| torres aos 20:00 | `[2,500; 5,000]` | **4,760** | **DENTRO** |
| mediana da primeira torre (s) | `[780; 1140]` | **840** | **DENTRO** |
| placas por partida | `[5,000; 12,000]` | **11,275** | **DENTRO** |
| duracao media (min) | `[29; 36]` | **29,99** | **DENTRO** |
| razao de torres | `[2,500; 4,500]` | **3,689** | **DENTRO** |
| fracao no teto de 60 minutos | `[0; 0,005]` | **0,000** | **DENTRO** |
| **FORMA** | | | |
| vencedor no maximo do contador | `[0,010; 0,250]` | **0,134** | **DENTRO** |
| vitoria exigiu limpar as TRES rotas | `[0,010; 0,350]` | **0,134** | **DENTRO** |
| exatamente 9 a 0 | `[0,000; 0,050]` | **0,029** | **DENTRO** |
| bimodalidade das torres do VENCEDOR | `[0,250; 0,5556]` | **0,441** | **DENTRO** (alvo 0,459) |
| vitoria com exatamente UMA rota limpa | `[0,500; 0,800]` | 0,366 | FORA |
| shutout | `[0,020; 0,120]` | 0,497 | FORA (onda 5) |
| bimodalidade das torres do PERDEDOR | `[0,250; 0,5556]` | 0,606 | FORA (onda 5) |
| **DISPERSAO** | | | |
| torres do vencedor | `[0,750; 2,000]` | **0,921** | **DENTRO** |
| torres por minuto | `[0,750; 2,000]` | **0,819** | **DENTRO** |
| primeira torre | `[0,750; 2,000]` | 0,540 | FORA |

**Placar contra o estado em que a onda 2 mediu: as dez bandas com dono Fase 25B foram de 10 vermelhas para 4.** O gate de ritmo foi de 20 vermelhas para 14, e `npm run calibrate:all` segue em **4 de 7 gates verdes**, o mesmo placar do fechamento da Fase 25.

### A fronteira que esta fase NAO fecha, agora com a causa completa

`vitoria com exatamente UMA rota limpa` mede **0,366** contra o piso 0,500. Ela so entra em `T` menor ou igual a 6,5, **que e faixa proibida pela regra dura**. Isto e diferente da fronteira 1 da secao 3, que era artefato de instrumento e dissolveu: esta e **real e dura**.

A leitura honesta: **a concentracao de rota, sozinha, nao consegue levar a vitoria por uma rota de volta a banda sem violar a plausibilidade da primeira torre no tier de gap.** Ela leva de 0,026 para 0,366, ou seja catorze vezes, e para onde a regra dura manda parar.

### Sobre a dispersao da primeira torre (0,540), e de quem ela e

A pergunta e se ela e da onda 5 ou precisa de dono proprio. **O numero diz que precisa de dono proprio, e nao e da onda 5.**

| estado | CV da primeira torre | razao contra a ancoragem 0,2539 |
|---|---|---|
| pre-Fase-25 | 0,2539 | 1,000 |
| fechamento da Fase 25 (onda 2) | 0,1378 | 0,543 |
| decaimento (secao 1) | 0,1378 | 0,543 |
| **concentracao, T = 9** | **0,1372** | **0,540** |

**Ela nao se moveu em nenhum dos dois mecanismos desta fase: 0,543 para 0,543 para 0,540, ou seja tres casas decimais paradas.** Isso e evidencia forte de que a causa nao esta em nenhuma das duas alavancas de canal, e o argumento mecanico fecha com o numero: a primeira torre cai **antes** de qualquer rota estar limpa e **antes** de a pressao diferenciar as rotas, entao os dois mecanismos desta fase valem exatamente 1 naquele instante por identidade. O que comprimiu a dispersao da primeira torre foi o canal absoluto do plano 25-04 dar dano **continuo e igual nas tres rotas desde o minuto zero**, o que faz a primeira queda acontecer sempre na mesma janela.

**Nao e do termo de vantagem (onda 5) tampouco:** o contrafactual da secao 7 de `25-sweep.md` mostra a primeira torre ja comprimida no estado B, com o termo desligado.

**Recomendacao registrada:** dono proprio, e a alavanca provavel e a taxa base do canal ou a curva temporal de plausibilidade, nenhuma das duas no escopo desta fase. A onda 7 deve decidir entre abrir item diferido com dono ou reatribuir a banda.

---

---

## Secao 7: o TETO do termo de vantagem estrutural, reavaliado sobre o volume corrigido (plano 25B-05)

> **NOTA DE NUMERACAO.** O plano 25B-05 chama esta secao de "secao 3" porque ela e a terceira secao que aquele plano produziria num documento vazio. Este documento ja tinha seis secoes escritas pelo plano 25B-03, entao ela entra como **secao 7** e a referencia cruzada fica registrada aqui em vez de haver duas secoes 3.

> **ESTA SUBSECAO E O CRITERIO, E ELA FOI ESCRITA E COMMITADA ANTES DE QUALQUER NUMERO NOVO.** O commit que a introduz nao contem uma unica medicao desta onda. A grade medida entra no commit seguinte. Isso e o que impede que o criterio seja escrito para caber no resultado, que e a ameaca T-25B-27 do plano.

### Por que esta secao existe, e por que ela reabre uma decisao ja aprovada

O ponto de operacao do termo de vantagem estrutural (`SIEGE_ADV_EXPONENT = 3,5` e `SIEGE_ADV_CEIL = 4,0`) foi aprovado num **checkpoint humano do plano 25-06**. Ele foi escolhido por uma grade bidimensional de doze pontos, registrada na secao 4 de `docs/diagnostics/25-sweep.md`, que avaliava **exclusivamente NIVEL de banda**: nao havia nenhuma coluna de forma, de dispersao nem de shutout na grade. E ele foi calibrado sobre um volume que hoje nao existe mais, por duas razoes independentes:

1. **a distribuicao ja estava deformada** pelo canal absoluto, com o vencedor encostado no teto do contador em 90,8 por cento das partidas;
2. **a leitura de torres subcontava**, porque `towersDestroyed` nunca contou as duas torres do Nexus (D-25-04). A correcao dessa leitura, feita na onda 3, moveu a `razao de torres` de 3,274 para 4,048 no mesmo estado de motor.

**O sweep de 25-06 nao errou o que mediu: ele nunca mediu isto.** Reavaliar o ponto sobre o volume corrigido, com a coluna de forma que faltava, e o proposito desta secao. **Manter o ponto sem remedi-lo seria herda-lo, e herdar nao e decidir.**

### A atribuicao ja esta provada duas vezes, e esta secao NAO a reinvestiga

| prova | onde | o que mediu |
|---|---|---|
| contrafactual de quatro estados | `25-sweep.md` secao 7 | ligar o termo leva o shutout de **1,4 para 44,9 por cento**, o perdedor em ZERO de 0,8 para 22,9, o 9 a 0 exato de 0,1 para 20,9 e o vencedor no maximo do contador de 52,9 para 90,8 |
| grade de concentracao, T de 2 a 30 | secao 3 desta pagina | o shutout fica entre **0,423 e 0,507 em TODA a grade**, ou seja **nao responde a concentracao em faixa nenhuma** |

**O autor do shutout e o termo de vantagem, e a alavanca dele e o teto.** Essa e a premissa desta secao, e ela e medicao e nao hipotese.

### Por que a alavanca e o TETO e nao o expoente, e isso tambem e medicao

A propria grade de doze pontos de 25-06 mediu a dominancia de uma dimensao sobre a outra, no tier EQUILIBRADO e sobre a `razao de torres`:

| dimensao movida | dimensao fixa | variacao maxima da razao |
|---|---|---|
| expoente, de 3 para 4 | teto fixo | **no maximo 0,13** |
| teto, de 2,5 para 4,0 | expoente fixo | **entre 0,71 e 0,82** |

O teto move a metrica **entre cinco e seis vezes mais** que o expoente. Varrer o teto sozinho:

- mantem a regra de **uma alavanca por commit** desta fase;
- **nao reabre** a excecao bidimensional que a Fase 25 declarou como unica e nominal;
- percorre a dimensao que decide, e nao a que e quase inerte.

**O expoente e o piso ficam FIXOS**, e isso e conferido por grep literal no verify de cada Task deste plano.

### A GRADE, declarada antes de medir

Alavanca: `SIEGE_ADV_CEIL`. Expoente parado em 3,5, piso parado em 0,25, temperatura de concentracao parada em 9, taxa do canal parada em 2,2, base do caminho do gate parada em 27.

| ponto | teto | origem |
|---|---|---|
| P0 | **4,0** | o ponto commitado, e a linha de comparacao |
| P1 | 3,5 | ja medido por NIVEL na grade de 25-06 |
| P2 | 3,0 | ja medido por NIVEL na grade de 25-06 |
| P3 | 2,5 | ja medido por NIVEL na grade de 25-06, o menor da grade antiga |
| P4 | 2,0 | abaixo da grade antiga; medido ali como ponto solto (razao 1,82 no estado da Fase 25) |
| P5 | 1,5 | abaixo da grade antiga, ponto novo |
| P6 | **1,0** | **o extremo inferior legitimo da grade**, ver abaixo |

**O PISO DA GRADE E 1,0, E A RAZAO E DE MECANISMO E NAO DE GOSTO.** A forma fechada do termo e `min(teto, max(piso, (2 * participacao) ^ expoente))`, e na paridade a participacao vale 0,5 por identidade, o que da bruto **exatamente 1**. Logo:

- com teto **maior ou igual a 1,0**, o termo vale 1 na paridade e a alavanca so mexe na **assimetria** entre os dois lados;
- com teto **menor que 1,0**, o termo passa a valer menos que 1 tambem na paridade, ou seja ele **reduz o throughput do canal uniformemente para os dois lados**. Isso e **exatamente o mecanismo de decaimento que a secao 2 desta pagina TESTOU E REFUTOU**, e a proibicao escrita la ("nao reintroduzir decaimento de throughput do canal, em nenhuma variante") vale aqui sem excecao.

Descer o teto abaixo de 1,0 seria reintroduzir por uma porta lateral o mecanismo que a fase ja descartou com numero. **Nenhum ponto abaixo de 1,0 sera medido, e essa e a fronteira declarada da grade.**

**Em teto exatamente 1,0 o termo deixa de ser vantagem e vira somente desvantagem:** o lado a frente e cortado em 1 e o lado atras continua descendo ate o piso 0,25. Esse e o extremo da familia que ainda respeita a refutacao, e por isso ele delimita a grade por baixo.

Cada ponto e medido com os **tres harnesses completos entre uma iteracao e a proxima**, exatamente como as secoes 1 a 6: gate de ritmo nos seis tiers, gate estrutural nos tres, sonda de forma nos dois. Nenhum ponto e medido so no tier de referencia.

### O CRITERIO, em ordem de prioridade

**1. REGRAS DURAS DA v2.0 EM ZERO ABSOLUTO NOS SEIS TIERS.** Ponto com qualquer violacao esta **ELIMINADO**, seja qual for o ganho de forma. Os quatro contadores conferidos, e os quatro sao contadores de assert duro e nao linhas de banda:

- `primeira torre antes de 7:00`, nos seis tiers do gate de ritmo;
- `Baron antes de 20:00`, nos seis tiers do gate de ritmo;
- `torre antes de 5:00`, nos tres tiers do gate estrutural;
- `queda cross-lane simultanea`, nos tres tiers do gate estrutural.

> **ESTE ITEM E O PRIMEIRO POR ERRO MEDIDO E NAO POR FORMALIDADE.** Na onda 3 os retratos de T = 6, T = 5 e T = 4 foram reportados como bons porque so as linhas `[OK]` e `[FALHA]` foram conferidas, e a violacao de `primeira torre antes de 7:00` no tier PRO-GAP **ja estava nos relatorios** e passou sem mencao (secao 6). **Regra dura em zero absoluto e condicao de EXISTENCIA do ponto, nao mais uma linha da tabela.** Nesta secao os quatro contadores sao extraidos por script do relatorio, nos seis tiers, e impressos junto de cada ponto.
>
> **A leitura ja medida na Fase 25 que ajuda a dimensionar o risco, e ela e favoravel:** o risco de o termo compor com a diferenca de roster e reintroduzir a violacao de 7:00 **NAO se materializou em ponto nenhum** da grade de doze pontos, e nem com teto **100**, quando o tier de gap 30 chegou a 26,18 de razao de torres e o contador continuou em ZERO nos seis tiers. O mecanismo esta escrito no cabecalho da constante: o termo e funcao de torres **ja derrubadas**, e aos 6:30 nenhuma caiu, entao a guarda de paridade o deixa exatamente em 1 e ele nao pressiona aquele assert. Este criterio provavelmente nao separa nenhum ponto **para cima**; ele e conferido de todo modo, e agora tambem **para baixo**, que e a direcao que a grade antiga nunca percorreu.

**2. AS CINCO BANDAS DE NIVEL DO CRITERIO 4 DO ROADMAP, TODAS DENTRO NO TIER EQUILIBRADO.** `torres/min` em `[0,300; 0,450]`, `torres aos 20:00` em `[2,500; 5,000]`, `mediana da primeira torre` em `[780; 1140]` s, `placas por partida` em `[5,000; 12,000]` e `duracao media` em `[29; 36]` min. Mais a `fracao de partidas no teto de 60 minutos` em `[0; 0,005]`, que entra como criterio de **eliminacao** e nao como coluna observada, pela censura que ela introduz na propria medicao (registro da secao 1).

**A DURACAO E A QUE APERTA, e o numero vem da propria Fase 25:** com o expoente em 3,5, baixar o teto de 4,0 para 3,0 levava a duracao de 35,58 para **38,18** minutos naquele estado, ou seja **a duracao SOBE quando o teto desce**, e a banda termina em 36. O que mudou desde entao e a folga: a concentracao de rota da onda 3 levou a duracao de 35,58 para **29,99**, o que devolveu **6,01 minutos** de folga contra o teto. **Esse numero e o insumo direto desta secao**, e e ele que torna a grade possivel de percorrer para baixo.

**3. A BANDA DE `razao de torres` DENTRO, de 2,500 a 4,500.** Ela e a banda dona de PACE-04 e nao pode sair. **Ela e o custo declarado desta alavanca e esta escrito antes de medir:** o teto e o parametro que cria a separacao estrutural, entao **baixar o teto derruba a razao**, e ela hoje mede 3,689, a 1,189 do piso. A razao e o shutout estao no **mesmo eixo e em sentidos opostos**, e por isso as duas sao medidas na **mesma linha** de cada ponto da grade, e a fronteira entre elas, se houver, e reportada com numero dos dois lados.

**4. ENTRE OS PONTOS QUE SOBREVIVEREM A 1, 2 E 3, O QUE LEVA A `fracao de shutout` E A `fracao de 9 a 0 exatos` PARA DENTRO DAS BANDAS DA ONDA 2.** Shutout em `[0,020; 0,120]` e 9 a 0 exato em `[0,000; 0,050]`. **Estas duas sao as que o termo e autor de deformar, e sao a razao de esta secao existir.**

**5. DESEMPATE: o que deixa o `coeficiente de bimodalidade das torres do PERDEDOR` mais abaixo do limiar 0,5556.** Ele segue o shutout pela mesma causa e hoje mede 0,606.

### A DELIMITACAO DE LEGITIMIDADE, no mesmo espirito da secao 6

Duas colunas de forma tem **autor medido e ele NAO e esta alavanca**:

| coluna | autor medido | onde |
|---|---|---|
| `fracao do vencedor no maximo do contador` | o **CANAL ABSOLUTO** (plano 25-04), consertado pela concentracao de rota na onda 3 | `25-sweep.md` secao 7, passo C para B |
| `vitoria com exatamente UMA rota limpa` | idem, e a fronteira dura dela esta na secao 6 desta pagina | secao 6 |

**As duas entram nesta secao como colunas OBSERVADAS**, para provar que esta onda **nao as desfez**, e nunca como alvo desta alavanca. Cobrar delas desta alavanca seria repetir o erro que esta fase existe para eliminar: perseguir o numero em vez da causa.

A mesma delimitacao vale para a `dispersao da primeira torre` (0,540), cuja causa esta medida e registrada em D-25B-04: ela nao se moveu em nenhum dos dois mecanismos desta fase e **nao e do termo de vantagem tampouco**, porque o contrafactual ja a mostra comprimida no estado B, com o termo desligado.

### O CRITERIO DE PARADA, declarado antes de medir

**Se nenhum ponto da grade satisfizer ao mesmo tempo os itens 1, 2, 3 e 4, este plano PARA.** Ele nao escolhe o menos ruim, nao afrouxa banda e nao busca alavanca nova sozinho. O que ele entrega nesse caso e a **fronteira medida com numero dos dois lados**, e a escolha volta ao desenvolvedor, entre:

- aceitar uma banda fora com **dono declarado**, ou
- abrir uma alavanca nova, que e **escopo novo e nao ajuste**.

### O METODO DE MEDICAO, e ele e o mesmo ja usado quatro vezes

**NENHUMA constante e movida por esta subsecao de medicao.** Cada ponto e uma alteracao **transitoria** de `SIEGE_ADV_CEIL`, medida com os tres harnesses e desfeita em seguida. Ao fim do commit da grade, `src/sim/` esta **byte a byte no estado commitado**, provado por `git diff --quiet HEAD -- src/sim` e `git status --porcelain src/sim` vazio. Este e o metodo das secoes 1, 4 e 5 desta pagina e da secao 7 de `25-sweep.md`.

---

### A GRADE MEDIDA, com FORMA, NIVEL e ASSERT DURO na mesma linha

Tier EQUILIBRADO (75 contra 75), N = 800, semente igual ao indice. Nove pontos, cada um com o gate de ritmo nos seis tiers, o gate estrutural nos tres e a sonda de forma nos dois. Expoente parado em 3,5, piso parado em 0,25, temperatura parada em 9. **A grade foi estendida abaixo de 2,5, que era o menor ponto da grade de 25-06, porque a regiao de forma estava inteiramente abaixo dela.**

| teto | **shutout** `[0,020; 0,120]` | **BC perdedor** `[0,250; 0,5556]` | **razao de torres** `[2,500; 4,500]` | 9 a 0 `[0; 0,050]` | duracao `[29; 36]` | torres/min `[0,300; 0,450]` | torres 20:00 `[2,5; 5,0]` | placas `[5; 12]` | 1a torre (s) `[780; 1140]` | teto 60 min `[0; 0,005]` | **REGRAS DURAS** | veredito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **4,0 (commitado)** | 0,497 **FORA** | 0,606 **FORA** | **3,689** | 0,029 | 29,99 | 0,357 | 4,760 | 11,275 | 840 | 0,000 | **0 / 0 / 0 / 0** | sobrevive a 1, 2 e 3; **falha o item 4** |
| 3,5 | 0,474 **FORA** | 0,592 **FORA** | **3,464** | 0,024 | 30,54 | 0,351 | 4,551 | 11,216 | 840 | 0,000 | **0 / 0 / 0 / 0** | sobrevive a 1, 2 e 3; **falha o item 4** |
| 3,0 | 0,434 **FORA** | 0,565 **FORA** | **3,208** | 0,014 | 31,63 | 0,342 | 4,290 | 11,155 | 840 | 0,000 | **0 / 0 / 0 / 0** | sobrevive a 1, 2 e 3; **falha o item 4** |
| 2,5 | 0,409 **FORA** | 0,562 **FORA** | **3,219** | 0,011 | 31,88 | 0,333 | 4,064 | 11,090 | 840 | 0,000 | **0 / 0 / 0 / 0** | sobrevive a 1, 2 e 3; **falha o item 4** |
| 2,0 | 0,365 **FORA** | **0,511 ENTROU** | **2,884** | 0,009 | 33,36 | 0,322 | 3,745 | 11,041 | 840 | 0,000 | **0 / 0 / 0 / 0** | sobrevive a 1, 2 e 3; **falha o item 4** |
| **1,75** | **0,328 FORA** | **0,522 DENTRO** | **2,706** | 0,007 | **34,34** | 0,316 | 3,596 | 11,012 | 840 | 0,000 | **0 / 0 / 0 / 0** | **melhor ponto que sobrevive a 1, 2 e 3; falha o item 4** |
| 1,5 | 0,289 **FORA** | 0,478 DENTRO | **2,545** | 0,007 | **35,34** | 0,310 | 3,422 | 10,967 | 840 | 0,001 | **0 / 0 / 0 / 0** | ultimo ponto que sobrevive a 2 e 3; **falha o item 4** |
| **1,4** | 0,271 **FORA** | 0,483 DENTRO | **2,468 FORA** | 0,005 | **36,18 FORA** | 0,306 | 3,365 | 10,953 | 840 | 0,001 | **0 / 0 / 0 / 0** | **ELIMINADO pelos itens 2 e 3** |
| 1,25 | 0,260 **FORA** | 0,496 DENTRO | **2,370 FORA** | 0,004 | **36,65 FORA** | 0,301 | 3,232 | 10,920 | 840 | 0,001 | **0 / 0 / 0 / 0** | **ELIMINADO pelos itens 2 e 3** |
| **1,0 (piso da grade)** | **0,201 FORA** | 0,460 DENTRO | **2,144 FORA** | 0,003 | **38,62 FORA** | **0,295 FORA** | 2,961 | 10,883 | 840 | 0,003 | **0 / 0 / 0 / 0** | **ELIMINADO pelos itens 2 e 3** |

A coluna **REGRAS DURAS** traz, nesta ordem, os quatro contadores somados: `primeira torre antes de 7:00` nos seis tiers, `Baron antes de 20:00` nos seis tiers, `torre antes de 5:00` nos tres tiers do gate estrutural e `queda cross-lane simultanea` nos tres. **Os quatro estao em ZERO ABSOLUTO nos nove pontos da grade**, extraidos por script do relatorio e nao pela leitura das linhas de banda, exatamente pela razao registrada no criterio.

Colunas OBSERVADAS, com autor declarado em outra alavanca, aqui apenas para provar que esta onda **nao as desfez**:

| teto | vencedor no maximo do contador `[0,010; 0,250]` | TRES rotas `[0,010; 0,350]` | UMA rota `[0,500; 0,800]` | BC vencedor `[0,250; 0,5556]` | DISP torres do vencedor `[0,750; 2,000]` | DISP torres/min `[0,750; 2,000]` | DISP 1a torre `[0,750; 2,000]` | bandas vermelhas no gate |
|---|---|---|---|---|---|---|---|---|
| **4,0 (commitado)** | 0,134 | 0,134 | 0,366 FORA | 0,441 | 0,921 | 0,819 | 0,540 FORA | **14** |
| 3,5 | 0,140 | 0,140 | 0,407 FORA | 0,440 | 0,948 | 0,774 | 0,553 FORA | 13 |
| 3,0 | 0,115 | 0,115 | 0,405 FORA | 0,440 | 0,951 | 0,760 | 0,570 FORA | 13 |
| 2,5 | 0,104 | 0,104 | 0,455 FORA | 0,427 | 0,961 | 0,775 | 0,593 FORA | 12 |
| 2,0 | 0,084 | 0,084 | 0,496 FORA | 0,429 | 0,967 | 0,754 | 0,630 FORA | 11 |
| **1,75** | **0,074** | **0,074** | **0,491 FORA por 0,009** | **0,440** | **0,983** | **0,779** | **0,655 FORA** | **10** |
| 1,5 | 0,065 | 0,065 | 0,496 FORA | 0,446 | 0,991 | **0,743 FORA** | 0,683 FORA | 11 |
| 1,4 | 0,072 | 0,072 | 0,492 FORA | 0,429 | 0,984 | 0,761 | 0,697 FORA | 11 |
| 1,25 | 0,064 | 0,064 | **0,537 DENTRO** | 0,446 | 1,011 | 0,823 | 0,721 FORA | 10 |
| 1,0 | 0,060 | 0,060 | **0,557 DENTRO** | 0,444 | 0,996 | 0,786 | **0,770 DENTRO** | 11 |

**Nenhuma coluna observada andou para tras em ponto nenhum da grade.** As duas que o canal absoluto consertou na onda 3 (`maximo do contador` e `TRES rotas`) **melhoram** de 0,134 para 0,060 ao longo da grade, e as tres bandas de dispersao com dono Fase 25B tambem melhoram monotonicamente. Esta onda nao desfez o trabalho da anterior em nenhuma linha.

### O VEREDITO: a regiao que satisfaz os quatro itens do criterio e VAZIA, e a fronteira esta medida dos dois lados

**O item 4 do criterio nunca e satisfeito.** O `shutout` **nao entra na banda em ponto nenhum da grade legitima**, incluindo o piso 1,0, onde o termo ja deixou de ser vantagem e virou somente desvantagem:

| leitura | valor |
|---|---|
| shutout no ponto commitado (teto 4,0) | **0,497** |
| shutout no piso legitimo da grade (teto 1,0) | **0,201** |
| teto da banda | **0,120** |
| **distancia que sobra no extremo da grade** | **0,081, ou seja 1,68 vezes o teto da banda** |

**E a fronteira dos dois lados, que e o que este plano existe para entregar:**

| lado | ponto | numero |
|---|---|---|
| **ultimo teto que satisfaz os itens 1, 2 e 3** | **1,5** | razao de torres **2,545** (a 0,045 do piso), duracao **35,34** (a 0,66 do teto), torres/min **0,310** |
| **primeiro teto que os viola** | **1,4** | razao de torres **2,468 FORA** (0,032 abaixo do piso), duracao **36,18 FORA** (0,175 acima do teto) |
| **shutout na fronteira** | em 1,5 | **0,289**, ou seja **2,41 vezes** o teto da banda de 0,120 |
| **shutout na fronteira** | em 1,4 | **0,271**, ou seja **2,26 vezes** o teto da banda |

**A largura da fronteira e 0,1 de teto**, e dentro dela **duas bandas quebram praticamente ao mesmo tempo**: a `razao de torres` pelo piso e a `duracao` pelo teto. Isso nao e coincidencia e vale escrever: as duas sao a mesma grandeza vista por dois instrumentos. O teto do termo e o que faz o vencedor separar; separar menos significa ao mesmo tempo **razao menor** e **partida mais longa**, porque o fechamento por estrutura demora mais.

**A extrapolacao que fecharia o shutout esta fora da grade por DOIS motivos independentes, e ela e extrapolacao declarada e nao medicao.** A inclinacao medida entre os dois pontos mais baixos da grade e de `(0,260 menos 0,201) / 0,25`, ou seja cerca de **0,236 de shutout por unidade de teto**. Levar o shutout de 0,201 ate 0,120 exigiria mais **0,34 de teto**, ou seja um teto de aproximadamente **0,66**. Esse ponto:

1. esta **abaixo de 1,0**, ou seja dentro da faixa em que o termo reduz o throughput do canal uniformemente para os dois lados, que e o **mecanismo de decaimento TESTADO E REFUTADO** na secao 2 desta pagina;
2. estaria **muito alem** das duas bandas que ja quebram em 1,4: em teto 1,0 a duracao ja mede 38,62 (2,62 acima do teto de 36) e a razao ja mede 2,144 (0,356 abaixo do piso de 2,500), as duas piorando monotonicamente na direcao da extrapolacao.

**Conforme o criterio de parada escrito antes de medir, este plano PARA aqui e nao escolhe o menos ruim sozinho.**

### O QUE A GRADE ENTREGA APESAR DA REGIAO VAZIA, e isso nao e consolo

A onda atacava **duas** bandas. **Uma delas fecha, e fecha com folga:**

| banda alvo da onda | teto 4,0 (hoje) | **teto 1,75** | banda | veredito em 1,75 |
|---|---|---|---|---|
| **bimodalidade das torres do PERDEDOR** | 0,606 | **0,522** | `[0,250; 0,5556]` | **ENTROU**, com folga de 0,034 |
| **shutout** | 0,497 | 0,328 | `[0,020; 0,120]` | **FORA**, e melhorou **34 por cento** em relativo |

O `BC do perdedor` **entra a partir do teto 2,0 e continua dentro em toda a grade abaixo**, o que faz dele um resultado robusto e nao um ponto de sorte.

**O melhor ponto que sobrevive aos itens 1, 2 e 3 e o teto 1,75**, escolhido pelo item 5 do criterio (desempate pelo BC do perdedor mais abaixo do limiar entre os que ficam dentro) combinado com a contagem de bandas vermelhas. O retrato dele contra o ponto commitado:

| leitura | teto 4,0 | **teto 1,75** | movimento |
|---|---|---|---|
| bandas vermelhas no gate de ritmo | 14 | **10** | **menos 4** |
| bandas vermelhas com dono **Fase 25B** | 4 | **3** | menos 1 |
| shutout | 0,497 | **0,328** | menos 0,169 |
| BC do perdedor | 0,606 FORA | **0,522 DENTRO** | **ENTROU** |
| 9 a 0 exato | 0,029 | **0,007** | menos 0,022 |
| vitoria com UMA rota | 0,366 | **0,491** | mais 0,125, a **0,009** de entrar |
| vencedor no maximo do contador | 0,134 | **0,074** | menos 0,060 |
| dispersao das torres do vencedor | 0,921 | **0,983** | mais 0,062 |
| dispersao da primeira torre | 0,540 | **0,655** | mais 0,115 |
| razao de torres | 3,689 | **2,706** | **menos 0,983**, folga de 0,206 contra o piso |
| duracao (min) | 29,99 | **34,34** | **mais 4,35**, folga de 1,66 contra o teto |
| torres/min | 0,357 | **0,316** | menos 0,041, folga de 0,016 contra o piso |
| torres aos 20:00 | 4,760 | **3,596** | menos 1,164 |
| regras duras nos seis tiers | **0** | **0** | **ZERO ABSOLUTO nos dois** |

**Duas bandas que estavam vermelhas por outros donos tambem entram no caminho:** `acerto do favorito aos 20:00` (dono Fase 29) entra ja em teto 3,5, e `fracao de abates ate 20:00` (dono Fase 26) entra em teto 2,5. A `fracao de comeback` (dono Fase 30, provisoria) entra em teto 2,0. **Nenhuma banda que estava verde ficou vermelha em 1,75.**

**O CUSTO DECLARADO DO PONTO 1,75, sem suavizar:** ele consome a folga que a onda 3 tinha aberto. A duracao vai de 29,99 para 34,34, ou seja **a folga contra o teto de 36 cai de 6,01 para 1,66 minuto**, e a razao de torres vai de 3,689 para 2,706, ou seja **a folga contra o piso de 2,500 cai de 1,189 para 0,206**. As duas continuam DENTRO, e as duas ficam com a fase seguinte tendo muito menos espaco para se mover.

### A generalizacao nos seis tiers, porque um conserto que so acerta o tier de referencia nao e conserto

`fracao de shutout`, os seis tiers, sem veredito (a banda so e avaliada no EQUILIBRADO):

| teto | EQUILIBRADO | GAP-LEVE | PRO-GAP | GAP-30 | AMADOR-EQUILIBRADO | AMADOR-GAP |
|---|---|---|---|---|---|---|
| **4,0 (commitado)** | 0,497 | 0,731 | 0,964 | 0,994 | 0,596 | 0,991 |
| **1,75** | **0,328** | **0,623** | **0,927** | **0,989** | **0,416** | **0,976** |

**O conserto anda na direcao certa nos seis tiers, sem excecao.** A ressalva ja registrada na onda 1 continua valendo e nao pode ser esquecida na leitura: no pre-fase o GAP-LEVE ja tinha shutout de 40,8 por cento, entao cobrar daquele tier um shutout abaixo daquilo seria cobrar o que nunca existiu.

### A restauracao, provada

Ao fim desta grade `src/sim/` esta **byte a byte no estado commitado**: `git diff --quiet HEAD -- src/sim` passou, `git status --porcelain src/sim` vazio, e os **53 arquivos** de `src/sim/` conferidos um a um por `git hash-object` contra `git rev-parse HEAD:<arquivo>`, todos identicos. `SIEGE_ADV_CEIL` esta de volta em **4.0**, `SIEGE_ADV_EXPONENT` em **3.5** e `SIEGE_ADV_FLOOR` em **0.25**.

**Prova de segunda ordem, mais forte que o hash:** o estado commitado foi **re-medido com os tres harnesses depois de toda a grade** e reproduziu o ponto de partida **em todas as casas decimais**: shutout 0,497, BC do perdedor 0,606, razao de torres 3,689, duracao 29,987, torres/min 0,357, 14 bandas vermelhas. Nenhum efeito residual das nove alteracoes transitorias sobreviveu.

### A DECISAO: TOMADA. `SIEGE_ADV_CEIL` FICA EM 4,0

**Decisao do desenvolvedor, no checkpoint do plano 25B-05, em 2026-07-30.** Ela NAO esta mais em aberto. A saida escolhida entre as tres foi **manter o teto em 4,0**, e o teto 1,75 fica registrado como **MEDIDO E DISPONIVEL** na subsecao seguinte, com todos os numeros, para que quem pegar o shutout **nao precise remedir a grade**.

**Como se chegou aqui, e a ordem importa.** O criterio de parada disparou, e ele estava escrito e commitado antes de qualquer numero desta grade (commit `9804c21`, sem uma unica medicao dentro). Nenhum ponto satisfaz ao mesmo tempo os itens 1, 2, 3 e 4. O plano PAROU, apresentou as tres saidas com numero e **nao escolheu sozinho**, porque o ponto de operacao de hoje foi aprovado por um **checkpoint humano explicito** no plano 25-06 e troca-lo por decisao de agente seria a ameaca T-25B-23. A escolha abaixo e do desenvolvedor.

#### O RACIOCINIO DA DECISAO, registrado junto dela

**O ponto de partida do raciocinio e que o criterio 3 da fase fica em aberto NOS DOIS CENARIOS.** O shutout nao fecha em ponto valido nenhum da grade, entao nem manter 4,0 nem adotar 1,75 fecha o criterio. **A escolha nao e entre fechar e nao fechar: e entre dois estados que deixam o mesmo criterio aberto, um deles pagando por isso.**

Dado isso, o que o teto 1,75 compraria e o que ele custaria, lado a lado:

| o que 1,75 compra | o que 1,75 custa |
|---|---|
| `BC do perdedor` entra (0,606 para 0,522) | **72 por cento da folga de duracao**: de 6,01 para 1,66 minuto contra o teto de 36 |
| `UMA rota` chega a 0,009 de entrar (0,366 para 0,491) | **83 por cento da folga de razao de torres**: de 1,189 para 0,206 contra o piso de 2,500 |
| shutout melhora 34 por cento, mas **continua fora** | |

**A trava do raciocinio e a Fase 26, e ela e a proxima.** A Fase 26 calibra volume de combate e densidade narrativa, com corte previsto de cerca de **40 por cento dos abates**, e ela mexe **exatamente nessas duas grandezas**: menos combate significa partida diferente em duracao e separacao estrutural diferente. **Gastar agora 72 e 83 por cento da folga, por um ganho parcial, num criterio que fica aberto de todo jeito, e trocar margem futura por numero presente.**

**Quem resolver o shutout revisita o termo com contexto completo**, ou seja com a Fase 26 ja calibrada e sabendo quanta folga sobrou de verdade. A grade fica medida e disponivel para essa hora, e por isso a subsecao seguinte existe.

#### O que a decisao NAO significa, escrito para nao ser mal lido depois

- **Nao significa que o teto 1,75 esta descartado.** Ele esta **medido, valido e disponivel**, com o retrato completo abaixo. O que aconteceu foi uma decisao de **sequenciamento**, e nao de rejeicao do numero.
- **Nao significa que o BC do perdedor esta sem conserto.** Ele tem conserto medido; o conserto e que nao foi aplicado agora.
- **Nao significa que o criterio 3 fechou.** Ele fica **em aberto**, com a fronteira medida e registrada em D-25B-05, e o dono dele ainda **nao existe** e nao foi inventado.

#### A consequencia direta para a onda 6, e ela e a razao de esta decisao importar para o golden

**Nenhuma constante de motor muda nesta onda.** Portanto **NAO HA deslocamento de golden vindo do plano 25B-05**, e a janela vermelha dos 17 snapshots continua tendo **UMA causa e nao duas**: a concentracao de rota da onda 3. **Isso e o que torna o diff estruturado da onda 6 atribuivel**, e teria deixado de valer se o teto tivesse sido adotado aqui.

### O TETO 1,75, MEDIDO E DISPONIVEL, para quem pegar o shutout nao remedir a grade

**Esta subsecao e entrega e nao rascunho.** Ela existe para que a decisao de hoje possa ser revisitada mais tarde **sem custo de medicao**, com a Fase 26 ja calibrada.

**O ponto:** `SIEGE_ADV_CEIL = 1.75`, com `SIEGE_ADV_EXPONENT = 3.5` e `SIEGE_ADV_FLOOR = 0.25` **inalterados**, e `SIEGE_FOCUS_TEMPERATURE = 9`, `SIEGE_ACCRUAL_BASE = 2.2` e a base do caminho do gate em 27, tambem inalterados. **Uma constante, um valor.**

**Por que 1,75 e nao outro da grade:** ele e o **melhor ponto que sobrevive aos itens 1, 2 e 3** do criterio. Tem a menor contagem de bandas vermelhas entre os pontos validos (10 contra 11 em 1,5 e 12 em 2,5), e o item 5 do criterio (desempate pelo BC do perdedor abaixo do limiar) nao o desempata contra 1,5, mas a contagem de bandas e a folga o fazem: em 1,5 a `DISPERSAO torres por minuto` sai da banda (0,743 contra o piso 0,750), e em 1,75 ela fica dentro (0,779).

**As tres verificacoes duras que este ponto ja passou, e elas nao precisam ser refeitas:**

1. **regras duras da v2.0 em ZERO ABSOLUTO** nos seis tiers, os quatro contadores extraidos por script;
2. **as sete bandas de nivel DENTRO**, com a folga de cada uma na tabela abaixo;
3. **nenhuma banda que estava verde ficou vermelha.**

**O que ainda precisa ser feito por quem adotar o ponto**, e esta lista e curta de proposito: reescrever o cabecalho de `SIEGE_ADV_CEIL` em `src/sim/structures.ts` com esta grade; medir de novo **depois** da Fase 26, porque os numeros abaixo valem para o motor de hoje; e commitar o teto **ANTES** de qualquer regeneracao de golden, nunca depois, para o diff nao ganhar duas causas.

**Validade declarada:** os numeros abaixo valem enquanto `src/sim/structures.ts` e `src/sim/engine.ts` nao mudarem. As **sensibilidades** (quanto o teto move cada banda) sobrevivem a mudancas pequenas e sao o que esta subsecao existe para preservar.

#### O RETRATO COMPLETO do teto 1,75, autocontido

Tier EQUILIBRADO, N = 800, semente igual ao indice, os tres harnesses.

| grupo | banda | banda declarada | **valor em 1,75** | veredito e folga |
|---|---|---|---|---|
| **REGRAS DURAS** | primeira torre antes de 7:00 (6 tiers) | igual a 0 | **0** | **ZERO ABSOLUTO** |
| | Baron antes de 20:00 (6 tiers) | igual a 0 | **0** | **ZERO ABSOLUTO** |
| | torre antes de 5:00 (3 tiers) | igual a 0 | **0** | **ZERO ABSOLUTO** |
| | queda cross-lane simultanea (3 tiers) | igual a 0 | **0** | **ZERO ABSOLUTO** |
| **NIVEL** | torres/min | `[0,300; 0,450]` | **0,316** | DENTRO, folga **0,016** do piso |
| | torres aos 20:00 | `[2,500; 5,000]` | **3,596** | DENTRO, folga 1,096 do piso |
| | mediana da primeira torre (s) | `[780; 1140]` | **840** | DENTRO, folga 60 s do piso |
| | placas por partida | `[5,000; 12,000]` | **11,012** | DENTRO, folga 0,988 do teto |
| | duracao media (min) | `[29; 36]` | **34,34** | DENTRO, folga **1,66** do teto |
| | razao de torres | `[2,500; 4,500]` | **2,706** | DENTRO, folga **0,206** do piso |
| | fracao no teto de 60 minutos | `[0; 0,005]` | **0,000** | DENTRO |
| **FORMA** | vencedor no maximo do contador | `[0,010; 0,250]` | **0,074** | DENTRO |
| | vitoria exigiu limpar as TRES rotas | `[0,010; 0,350]` | **0,074** | DENTRO |
| | exatamente 9 a 0 | `[0,000; 0,050]` | **0,007** | DENTRO |
| | bimodalidade das torres do VENCEDOR | `[0,250; 0,5556]` | **0,440** | DENTRO |
| | **bimodalidade das torres do PERDEDOR** | `[0,250; 0,5556]` | **0,522** | **ENTRA**, folga 0,034 |
| | vitoria com exatamente UMA rota limpa | `[0,500; 0,800]` | **0,491** | FORA por **0,009** |
| | **shutout** | `[0,020; 0,120]` | **0,328** | **FORA por 0,208, ou 2,73 vezes o teto** |
| **DISPERSAO** | torres do vencedor | `[0,750; 2,000]` | **0,983** | DENTRO |
| | torres por minuto | `[0,750; 2,000]` | **0,779** | DENTRO |
| | primeira torre | `[0,750; 2,000]` | **0,655** | FORA (D-25B-04) |
| **PLACAR** | bandas vermelhas no gate de ritmo | | **10** (contra 14 hoje) | menos 4 |
| | vermelhas com dono Fase 25B | | **3** (contra 4 hoje) | menos 1 |

**Bandas de outros donos que entram no caminho ate 1,75, e elas nao sao merito desta alavanca mas precisam estar registradas:** `acerto do favorito aos 20:00` (Fase 29) entra ja em teto 3,5; `fracao de abates ate 20:00` (Fase 26) entra em 2,5; `fracao de comeback` (Fase 30, provisoria) entra em 2,0.

**A generalizacao nos seis tiers ja esta medida** e esta na subsecao de generalizacao acima: o shutout cai nos **seis** tiers entre 4,0 e 1,75, sem excecao.

### O BLOCO DE MARGEM do estado que fica (teto 4,0), medido depois de toda a grade

**BANDAS DE NIVEL, todas DENTRO:**

| banda | banda | medido | folga contra o lado apertado |
|---|---|---|---|
| torres/min | `[0,300; 0,450]` | **0,357** | 0,057 do piso |
| torres aos 20:00 | `[2,500; 5,000]` | **4,760** | **0,240 do teto** |
| mediana da primeira torre (s) | `[780; 1140]` | **840** | 60 s do piso |
| placas por partida | `[5,000; 12,000]` | **11,275** | **0,725 do teto** |
| duracao media (min) | `[29; 36]` | **29,987** | **0,987 do piso**, 6,013 do teto |
| razao de torres | `[2,500; 4,500]` | **3,689** | 0,811 do teto, 1,189 do piso |
| fracao no teto de 60 minutos | `[0; 0,005]` | **0,000** | 0,005 do teto |

**BANDAS DE FORMA:**

| banda | banda | medido | folga ou distancia |
|---|---|---|---|
| vencedor no maximo do contador | `[0,010; 0,250]` | **0,134** | DENTRO, folga 0,116 |
| vitoria exigiu limpar as TRES rotas | `[0,010; 0,350]` | **0,134** | DENTRO, folga 0,216 |
| exatamente 9 a 0 | `[0,000; 0,050]` | **0,029** | DENTRO, folga 0,021 |
| bimodalidade das torres do VENCEDOR | `[0,250; 0,5556]` | **0,441** | DENTRO, folga 0,115 |
| **vitoria com exatamente UMA rota limpa** | `[0,500; 0,800]` | **0,366** | **FORA, faltam 0,134** |
| **shutout** | `[0,020; 0,120]` | **0,497** | **FORA por 0,377, ou seja 4,14 vezes o teto** |
| **bimodalidade das torres do PERDEDOR** | `[0,250; 0,5556]` | **0,606** | **FORA por 0,050** |

**BANDAS DE DISPERSAO com dono Fase 25B:**

| banda | banda | medido | situacao |
|---|---|---|---|
| torres do vencedor | `[0,750; 2,000]` | **0,921** | DENTRO, folga 0,171 |
| torres por minuto | `[0,750; 2,000]` | **0,819** | DENTRO, folga 0,069 |
| **primeira torre** | `[0,750; 2,000]` | **0,540** | **FORA, faltam 0,210** (D-25B-04, dono nao e desta onda) |

### A LISTA NOMINAL das catorze bandas vermelhas do gate de ritmo, com dono

Insumo direto do plano de fechamento e do diff de golden.

| # | banda | valor | dono | bloqueia a Fase 25B? |
|---|---|---|---|---|
| 1 | `abates/min` | 1,244 | Fase 26 | nao |
| 2 | `razao de abates vencedor sobre perdedor` | 1,052 | Fase 26 | nao |
| 3 | `razao torres sobre abates` | 0,223 | Fase 26 | nao |
| 4 | `fracao de abates ate 20:00` | 0,519 | Fase 26 | nao |
| 5 | `fracao de partidas sem abate ate 10:00` | 0,016 | Fase 26 | nao |
| 6 | `ouro/min por time` | 645 | Fase 27 | nao |
| 7 | `razao de ouro/min vencedor sobre perdedor` | 1,030 | Fase 27 | nao |
| 8 | `win-rate com gap de forca 30` | 1,000 | Fase 28 | nao |
| 9 | `acerto do favorito aos 20:00` | 0,855 | Fase 29 | nao |
| 10 | `fracao de comeback` (PROVISORIA) | 0,315 | Fase 30 (DOCS-01) | nao |
| 11 | **`DISPERSAO primeira torre`** | **0,540** | **Fase 25B**, mas com causa medida fora das alavancas da fase (D-25B-04) | **decisao da onda 7** |
| 12 | **`FORMA vitoria com UMA rota limpa`** | **0,366** | **Fase 25B**, fronteira dura da onda 3 (secao 6) | **sim, e a fronteira esta medida** |
| 13 | **`FORMA shutout`** | **0,497** | **Fase 25B**, fronteira desta onda | **sim, e a fronteira esta medida** |
| 14 | **`FORMA bimodalidade das torres do PERDEDOR`** | **0,606** | **Fase 25B**, e ela TEM conserto medido (teto 1,75) | **sim, e depende da decisao acima** |

**Quatro das catorze tem dono Fase 25B.** Tres delas sao fronteiras medidas com numero dos dois lados (11, 12 e 13) e **uma tem conserto disponivel e medido** (14), preso a decisao do checkpoint.

### O estado da cadeia de sete gates, e ele nao mudou

| gate | desfecho | mudou nesta onda? |
|---|---|---|
| `calibrate` | vermelho | nao (Fase 28) |
| `calibrate:micro` | **verde** | nao |
| `calibrate:structures` | **verde** | nao |
| `calibrate:objectives` | **verde** | nao |
| `calibrate:combat` | **verde** | nao |
| `calibrate:pace` | vermelho (14 bandas) | nao |
| `calibrate:assists` | vermelho | nao (Fase 26) |

**4 de 7 verdes**, o mesmo placar do fechamento da Fase 25 e do fechamento da onda 3. **Esta onda nao commitou valor de motor e portanto nao podia mudar nenhum**, o que e a conferencia cruzada de que a restauracao funcionou.

---

## O que este documento NAO faz

- **Nao escolhe o ponto de operacao.** Isso e a onda 4, com sweep de uma alavanca e o criterio escrito antes dos numeros.
- **Nao move constante nenhuma.** A Task 3 do plano 25B-03 e medicao e registro.
- **Nao regenera snapshot.** A janela vermelha dos dois snapshots de assinatura de linha do tempo e dos quinze do golden e esperada e a regeneracao unica e da onda 6.
- ~~**Nao reavalia o teto do termo de vantagem.** Isso e a onda 5, e a secao 3 registra por medicao que o shutout e a bimodalidade do perdedor sao insensiveis a alavanca desta onda.~~ **FEITO na secao 7** (plano 25B-05). A frase fica riscada em vez de apagada para que a leitura de quem chegar pela secao 3 continue correta: a secao 3 remete a onda 5, e a onda 5 esta na secao 7.
- **Nao move o expoente nem o piso do termo de vantagem.** A secao 7 varre o TETO sozinho, e a razao esta medida ali: dentro daquela regiao o teto move a razao de torres entre cinco e seis vezes mais que o expoente.
- **Nao mede teto de termo de vantagem abaixo de 1,0.** Abaixo de 1,0 o termo passa a valer menos que 1 tambem na paridade, ou seja vira reducao uniforme de throughput, que e o mecanismo de decaimento TESTADO E REFUTADO na secao 2. A fronteira esta declarada na secao 7.
- **Nao muda `SIEGE_ADV_CEIL`.** A regiao que satisfaz os quatro itens do criterio e vazia e o criterio de parada disparou. A decisao voltou ao desenvolvedor, que foi quem aprovou o ponto de hoje num checkpoint, e ele **decidiu manter o teto em 4,0**, com o raciocinio registrado na secao 7. O teto 1,75 fica **medido e disponivel** na mesma secao.
- **Nao busca uma alavanca nova para o shutout.** A grade de teto esta percorrida ate o extremo legitimo e a fronteira esta medida. Abrir outra alavanca e escopo novo, e nao ajuste.
- **Nao conserta o defeito do Arauto no inibidor.** Ele e pre-existente (OBJ-01, Fase 19), esta medido na secao 3 e fica como item diferido: a correcao obvia criaria violacao de plausibilidade de classe `nearZero`.
- **Nao busca uma terceira alavanca para fechar a fronteira 1.** A secao 4 mostra que ela nao precisa de alavanca nova: ela dissolve sob a leitura B.
- **NAO altera o contador, NAO altera a banda e NAO troca o que o gate avalia.** A secao 4 e medicao para decidir. Re-ancorar a banda de `torres/min` na leitura B seria mudar a regua durante a prova, e so pode acontecer por decisao explicita do usuario, com re-ancoragem declarada.
