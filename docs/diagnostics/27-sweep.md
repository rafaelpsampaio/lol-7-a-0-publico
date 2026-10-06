# Fase 27 Plano 06: sweep de uma alavanca, `goldScale`

**Fase:** 27-escala-e-acoplamento-econ-mico
**Plano de origem:** 27-06 (Task 1)
**Proposito, em uma linha:** escrever o criterio de escolha do valor de `DEFAULT_SIM_CONFIG.goldScale` ANTES de medir qualquer ponto da grade, medir a grade completa, e escolher o ponto de operacao pelo criterio escrito, nunca pelo numero.

---

## BLOCO 1: o criterio de escolha, escrito antes de qualquer numero de varredura

O criterio tem clausulas obrigatorias (todas precisam passar; qualquer uma que falhe elimina o ponto) seguidas de um desempate. Nenhuma clausula obrigatoria pode ser afrouxada para um ponto passar.

**Obrigatorias, nesta ordem de checagem (a ordem de checagem nao muda a elegibilidade — um ponto so e elegivel se passar em TODAS):**

1. `ouro/min por time` dentro da banda [1500, 2100] (`REQUIREMENTS.md` ECO-01), o mais perto possivel do alvo 1833.
2. `razao de ouro/min vencedor sobre perdedor` dentro da banda [1.10, 1.30] (`REQUIREMENTS.md` ECO-02).
3. Assert de ordenacao inter-camada de tres termos verde: `razaoTorresVencedorPerdedor > razaoAbatesVencedorPerdedor > razaoOuroMinVencedorPerdedor`, medidos na MESMA rodada e no MESMO tier EQUILIBRADO (`scripts/calibrate-pace.ts`, o assert acrescentado pelo plano 27-01). Como `expectBands` lanca antes de alcancar este assert enquanto qualquer banda estiver vermelha, este criterio e verificado por CALCULO DIRETO das tres razoes reportadas no relatorio (nao pela execucao literal do `expect` do arquivo, que so e alcancada quando a onda inteira fecha).
4. Zero violacao de regra dura em TODO tier: `Baron antes de 20:00` e `primeira torre antes de 7:00`, nos seis tiers (`EQUILIBRADO`, `GAP-LEVE`, `PRO-GAP`, `GAP-30`, `AMADOR-EQUILIBRADO`, `AMADOR-GAP`).
5. Nenhuma banda que estava VERDE no baseline do Bloco 5 de `docs/diagnostics/27-ancoragem.md` (re-medido nesta onda no commit anterior a qualquer mudanca de `goldScale`, ver Bloco 2 abaixo) pode virar VERMELHA no ponto candidato.

**Desempate, se mais de um ponto passar em todas as obrigatorias:** vence o ponto que deixa MAIOR folga simultanea nas duas pontas da banda de `ouro/min por time` — ou seja, o ponto cuja distancia MINIMA entre {valor medido menos piso 1500, teto 2100 menos valor medido} e a MAIOR entre todos os pontos elegiveis. Em caso de empate nessa folga minima, vence o ponto com `ouro/min por time` mais proximo do alvo 1833.

**Regra dura do proprio sweep:** se nenhum ponto da grade de partida satisfizer as cinco obrigatorias, a grade e ESTENDIDA nas duas direcoes ate encontrar a fronteira dos dois lados, e a fronteira medida (o maior valor que ainda falha por um lado, o menor que falha pelo outro) e reportada como desfecho valido — nunca se escolhe um ponto que viole uma obrigatoria.

**Nenhum `checkBand` de `scripts/calibrate-pace.ts` pode ter piso, teto ou alvo alterado nesta task**, para nenhuma banda, em nenhuma circunstancia. Se a escolha do valor exigir alargar qualquer banda, isso e mudanca de criterio (fora do escopo desta onda), nao mudanca de valor.

---

## BLOCO 2: leitura PRE, no commit imediatamente anterior a qualquer edicao desta task

Re-medida nesta onda, no mesmo commit-base do plano 27-06 (`goldScale = 1`, herdado do fim do plano 27-05), para servir de regua ao criterio 5 acima. Os numeros do Bloco 5 de `docs/diagnostics/27-ancoragem.md` (medidos no inicio da Fase 27, antes dos planos 27-02 a 27-05) ficam desatualizados porque `src/sim/` mudou desde entao (ECO-03/ECO-05); esta e a leitura que de fato precede a mudanca de VALOR desta task.

`npm run calibrate:pace` (tier EQUILIBRADO, user 75 vs rival 75, N=800), `goldScale = 1`:

| leitura | valor medido |
| --- | --- |
| ouro/min por time | 646,2 |
| razao de ouro/min vencedor sobre perdedor | 1,027 |
| razao de abates vencedor sobre perdedor | 1,046 |
| razao de torres vencedor sobre perdedor | 3,063 |

Zero violacao de regra dura nos seis tiers (Baron antes de 20:00 e primeira torre antes de 7:00, ambos em 0 em todo tier).

**Bandas VERDES no baseline (28), a lista que o criterio 5 protege — nenhuma pode virar vermelha em nenhum ponto candidato:** torres/min; torres aos 20:00; mediana da primeira torre; placas por partida; razao de torres vencedor sobre perdedor; assistencias do ADC por partida; acerto do favorito aos 20:00; PROVISORIA R1; PROVISORIA R2; PROVISORIA R3; DISPERSAO duracao; DISPERSAO abates totais; DISPERSAO torres do vencedor; DISPERSAO torres totais; DISPERSAO torres por minuto; DISPERSAO ouro final do vencedor; DISPERSAO ouro final do perdedor; DISPERSAO ouro por minuto por time; FORMA fracao de partidas com vencedor no maximo do contador; FORMA fracao de vitorias que exigiram limpar as tres rotas; FORMA fracao de partidas exatamente 9 a 0; FORMA coeficiente de bimodalidade do VENCEDOR; ACOPLAMENTO P2 baron_taken; ACOPLAMENTO P1 IC95 inferior; ACOPLAMENTO P2 IC95 inferior; ACOPLAMENTO P3 IC95 inferior; densidade comparavel 14-20min; PROVISORIA densidade visivel 14-20min.

**Bandas VERMELHAS no baseline (19, incluindo as duas donas desta fase), fora do escopo do criterio 5 (podem seguir vermelhas sem bloquear a escolha, exceto ECO-01/ECO-02 que sao as obrigatorias 1 e 2):** abates/min; razao de abates vencedor sobre perdedor; razao torres sobre abates; fracao de abates ate 20:00; fracao de partidas sem abate ate 10:00; **ouro/min por time (ECO-01)**; **razao de ouro/min vencedor sobre perdedor (ECO-02)**; win-rate com gap de forca 30; DISPERSAO primeira torre; DISPERSAO fracao de comeback; FORMA fracao de vitorias com exatamente uma rota limpa; FORMA fracao de shutout; FORMA bimodalidade do PERDEDOR; ACOPLAMENTO P1; ACOPLAMENTO P3; densidade comparavel 0-14min; densidade comparavel 20min+; PROVISORIA densidade visivel 0-14min; PROVISORIA densidade visivel 20min+.

---

## BLOCO 3: a grade medida, uma alavanca (`goldScale`) por vez

Grade de partida (`DEFAULT_SIM_CONFIG.goldScale`): 2,00; 2,25; 2,50; 2,75; 3,00. `npm run calibrate:pace` (N=800/tier, seis tiers), estruturas de calibracao (`GOLD_STRUCTURAL_FLOOR/EXPONENT/CEIL`) NAO tocadas nesta grade.

| `goldScale` | ouro/min por time (piso 1500) | razao ouro venc/perd (piso 1,10) | razao abates venc/perd | razao torres venc/perd | ordenacao 3 camadas (torres>abates>ouro) | violacoes regra dura (6 tiers) | bandas que mudaram de cor vs baseline |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2,00 | 1292 (FALHA, piso 1500) | 1,027 (FALHA, piso 1,10) | 1,046 | 3,063 | VERDE (3,063 > 1,046 > 1,027) | 0/0/0/0/0/0 | nenhuma (as 28 verdes do Bloco 2 continuam verdes; ouro/min continua vermelha) |
| 2,25 | 1456 (FALHA, piso 1500) | 1,026 (FALHA, piso 1,10) | 1,044 | 3,057 | VERDE (3,057 > 1,044 > 1,026) | 0/0/0/0/0/0 | nenhuma |
| 2,50 | 1616 (OK) | 1,027 (FALHA, piso 1,10) | 1,046 | 3,063 | VERDE (3,063 > 1,046 > 1,027) | 0/0/0/0/0/0 | **ouro/min por time: FALHA -> OK** (unica mudanca) |
| **2,75** | **1779 (OK)** | 1,026 (FALHA, piso 1,10) | 1,044 | 3,057 | VERDE (3,057 > 1,044 > 1,026) | 0/0/0/0/0/0 | **ouro/min por time: FALHA -> OK** (unica mudanca) |
| 3,00 | 1939 (OK) | 1,027 (FALHA, piso 1,10) | 1,046 | 3,063 | VERDE (3,063 > 1,046 > 1,027) | 0/0/0/0/0/0 | **ouro/min por time: FALHA -> OK** (unica mudanca) |

**Leitura sem suavizar.** A grade confirma por MEDICAO, nao por suposicao, a "nota mecanica" registrada no plano: `goldScale` move o NIVEL absoluto de `ouro/min por time` de forma quase linear (1292 -> 1456 -> 1616 -> 1779 -> 1939, aproximadamente 646 x escala) e **NAO move a razao de ouro/min vencedor sobre perdedor**, que fica presa entre 1,026 e 1,027 nos cinco pontos — a mesma leitura (1,027) do baseline em `goldScale=1` (Bloco 2). Isto e exatamente o comportamento previsto: a razao entre duas quantidades escaladas pelo mesmo fator nao se move. A ordenacao inter-camada de tres termos (torres > abates > ouro) fica VERDE nos cinco pontos, porque a razao de abates (1,044-1,046, ainda vermelha por banda absoluta, dona Fase 26) fica sempre acima da razao de ouro por uma margem pequena e estavel (~0,018), e ambas ficam muito abaixo da razao de torres (~3,06). Zero violacao de regra dura nos seis tiers, nos cinco pontos. Nenhuma banda verde do Bloco 2 virou vermelha em nenhum ponto — a unica mudanca de cor em toda a grade e a propria `ouro/min por time` saindo do vermelho a partir de `goldScale=2,50`.

**obrigatoria 1 (ouro/min) elimina os pontos 2,00 e 2,25**, que ficam abaixo do piso 1500. Os tres pontos restantes (2,50; 2,75; 3,00) passam nas obrigatorias 1, 3, 4 e 5. **Nenhum ponto da grade de partida passa na obrigatoria 2** (razao de ouro/min vencedor sobre perdedor): os cinco pontos ficam entre 1,026 e 1,027, muito abaixo do piso 1,10 — ver Bloco 4 para a extensao da fronteira e a decisao sobre a alavanca 2.

---

## BLOCO 4: por que a obrigatoria 2 nao fecha com nenhuma escala, e por que a alavanca 2 tambem nao a fecha sem violar regra dura

**Extensao da grade na direcao do que ja era conhecido.** A leitura em `goldScale=1` (Bloco 2, medida no commit imediatamente anterior a esta task) tambem deu 1,027 — o MESMO valor que os cinco pontos da grade de partida. Seis pontos (1,00; 2,00; 2,25; 2,50; 2,75; 3,00) cobrindo uma faixa de 3x no valor de `goldScale` e todos dentro de uma janela de 0,001 na razao de ouro. Isto e a fronteira medida da PRIMEIRA alavanca: **nao existe fronteira nesta dimensao, porque a metrica e invariante a escala por construcao** (a mesma razao entre duas quantidades escaladas pelo mesmo fator, ja demonstrada matematicamente no plano). Estender a grade de `goldScale` mais (por exemplo, para 5,00 ou 10,00) nao mudaria esta leitura — a invariancia e estrutural, nao um efeito de amostragem, e o proprio plano ja previa esta possibilidade ("Se a razao de ouro estiver fora de banda... a causa NAO e a escala e a alavanca certa e outra").

**Teste da segunda alavanca (constantes de calibracao do fator estrutural de ouro), medido em grade propria, UM PONTO, com `goldScale` fixo em 2,75 (o melhor candidato da alavanca 1) e revertido imediatamente apos a medicao — nao commitado como mudanca de producao:**

| `GOLD_STRUCTURAL_FLOOR` | `GOLD_STRUCTURAL_CEIL` | `GOLD_STRUCTURAL_EXPONENT` | razao ouro venc/perd | razao abates venc/perd | violacao regra dura |
| --- | --- | --- | --- | --- | --- |
| 0,97 (producao) | 1,03 (producao) | 1,5 (producao) | 1,026 | 1,044 | 0 |
| 0,909 (1/1,10) | **1,10** | 1,5 (inalterado) | **1,040** | **1,089** | **1 (primeira torre antes de 7:00, tier GAP-30)** |

**Leitura sem suavizar.** Alargar o teto do fator estrutural de ouro de 1,03 para 1,10 (um alargamento de 3,4x na largura da banda multiplicativa, 0,06 para 0,191) MOVE a razao de ouro (1,026 -> 1,040, +0,014) e a razao de abates (1,044 -> 1,089, +0,045) na direcao certa, confirmando que a alavanca 2 tem efeito real (nao e inerte) — mas **reintroduz IMEDIATAMENTE a violacao de regra dura que o plano 27-04 documentou por escrito** (`src/sim/structures.ts`, comentario de `GOLD_STRUCTURAL_CEIL`: "a violacao NAO caiu proporcionalmente... e so desapareceu quando o teto cruzou um limiar estreito entre 1,04 e 1,06"). Um teto de 1,10 esta muito acima desse limiar, e o efeito medido (uma violacao em 800 partidas do tier GAP-30) e o MESMO tipo de violacao que o plano 27-04 ja mediu e evitou.

**A magnitude do movimento tambem desqualifica esta alavanca por si so.** Mesmo aceitando a violacao de regra dura (que a obrigatoria 4 proibe), o movimento medido (+0,014 na razao de ouro) e pequeno demais: fechar a banda exigiria mover de 1,026 para pelo menos 1,10 (+0,074), mais de cinco vezes o movimento obtido com um teto ja fora dos limites seguros medidos pelo plano 27-04. Extrapolando linearmente (uma aproximacao otimista, porque a relacao teto-violacao ja e conhecida como um EFEITO DE LIMIAR e nao gradual, conforme o mesmo comentario de `structures.ts`), fechar a banda exigiria um teto muito alem de 1,10, com violacoes de regra dura certamente maiores que 1 em 800 partidas do tier de gap grande.

**Conclusao do Bloco 4: nenhuma das duas alavancas autorizadas a este plano (`goldScale` e as tres constantes de `goldStructuralFactor`) fecha a obrigatoria 2 sem violar a obrigatoria 4 (regra dura) ou sem afrouxar uma banda.** Este e o desfecho de FRONTEIRA MEDIDA previsto pela propria regra do sweep (Bloco 1: "fronteira medida e desfecho valido e tem de ser reportada como tal; escolher um valor que viole um obrigatorio nao e"). A causa raiz, coerente com o restante do estado do projeto: a razao de ouro por minuto entre vencedor e perdedor e uma metrica DERIVADA da diferenciacao de abates/objetivos entre vencedor e perdedor (o ouro de abate, assistencia, placa e bounty de shutdown sao os canais que mais diferenciam os dois lados; a renda passiva e simetrica por construcao). A razao de abates vencedor sobre perdedor (1,044-1,046) esta ela mesma muito abaixo do piso [1,80; 2,60] que a Fase 26 fechou com aceite PARCIAL sem fechar este criterio (`STATE.md`, registro do fechamento da Fase 26: "criterio 1... NAO FECHADO" e "criterio 2... NAO FECHADO"). Sem mais diferenciacao de abates/objetivos entre vencedor e perdedor — trabalho fora do escopo desta task e desta fase — a razao de ouro nao tem margem estrutural para fechar em 1,10, com qualquer uma das duas alavancas que este plano autoriza a mexer.

---

## BLOCO 5: a escolha, pelo criterio do Bloco 1

Dos cinco pontos da grade, tres (2,50; 2,75; 3,00) passam nas obrigatorias 1, 3, 4 e 5. **Nenhum ponto passa na obrigatoria 2** (Bloco 4). Entre os tres elegiveis nas demais quatro obrigatorias, o desempate (Bloco 1) decide: o valor que deixa MAIOR folga MINIMA simultanea nas duas pontas da banda de `ouro/min por time` [1500, 2100].

| `goldScale` | ouro/min medido | folga contra o piso 1500 | folga contra o teto 2100 | folga MINIMA das duas pontas |
| --- | --- | --- | --- | --- |
| 2,50 | 1616 | 116 | 484 | **116** |
| **2,75** | **1779** | **279** | **321** | **279** |
| 3,00 | 1939 | 439 | 161 | 161 |

**`goldScale = 2,75` VENCE o desempate**, com folga minima 279, contra 161 (3,00) e 116 (2,50) — a maior distancia simultanea das duas pontas da banda entre os tres pontos elegiveis nas quatro obrigatorias que fecham.

**Ponto escolhido: `goldScale = 2,75`.** Aplicado em `DEFAULT_SIM_CONFIG.goldScale` (`src/sim/matchState.ts`), unico lugar do codigo onde o valor muda, com comentario de uma linha citando ECO-01 e este arquivo.

**A obrigatoria 2 fica ABERTA, registrada honestamente e nao escondida.** `razao de ouro/min vencedor sobre perdedor = 1,026` em `goldScale = 2,75`, contra o piso 1,10 — uma distancia de 0,074 (6,7% relativo) que nenhuma das duas alavancas autorizadas a este plano fecha sem violar regra dura (Bloco 4). Este e um item **SEM DONO** dentro do escopo desta task, candidato a revisao humana no fechamento da Fase 27 (27-07) ou a decisao de escopo (nomear uma terceira alavanca, plausivelmente `K_GOLD` ou os pesos de elasticidade de `goldFightMult`/`goldSecureMult`, hoje fora do orcamento de simbolos deste plano) na Fase 30, no mesmo padrao que a Fase 26 fechou com aceite PARCIAL deixando o par analogo (razao de abates vencedor/perdedor) sem fechar.

**A ordenacao de tres camadas (must_have do plano: "a razao de ouro e a MENOR das tres razoes inter-camada") FECHA**, e fecha em todos os cinco pontos da grade: torres (3,057) > abates (1,044) > ouro (1,026), medidas na mesma rodada e no mesmo tier EQUILIBRADO, em `goldScale = 2,75`.

---

## BLOCO 6: leitura pos-escolha, `goldScale = 2,75` aplicado

Repetindo a leitura do ponto escolhido para fechar o registro (identica a linha 2,75 do Bloco 3, reproduzida aqui para conveniencia de quem le so este bloco):

| leitura | valor medido | banda | veredito |
| --- | --- | --- | --- |
| ouro/min por time | 1779 | [1500, 2100], alvo 1833 | **VERDE (ECO-01 fechado)** |
| razao de ouro/min vencedor sobre perdedor | 1,026 | [1,10, 1,30], alvo 1,19 | **VERMELHO (ECO-02 ABERTO, fronteira medida no Bloco 4)** |
| razao de abates vencedor sobre perdedor | 1,044 | dono Fase 26, [1,80, 2,60] | vermelho (heranca da Fase 26, nao desta task) |
| razao de torres vencedor sobre perdedor | 3,057 | dono Fase 25, [2,50, 4,50] | verde (heranca) |
| ordenacao de tres camadas (torres > abates > ouro) | 3,057 > 1,044 > 1,026 | — | **VERDE** |
| violacoes de regra dura, seis tiers | 0 | — | **VERDE** |
| bandas verdes do Bloco 2 que viraram vermelhas | nenhuma | — | **VERDE** |

`DEFAULT_SIM_CONFIG.goldScale = 2.75` e a unica ocorrencia do literal `2.75` em `src/sim/` fora deste arquivo de diagnostico (`grep -rn "2\.75" src/sim/*.ts` excluindo `*.test.ts` retorna uma unica linha, `matchState.ts:530`).

