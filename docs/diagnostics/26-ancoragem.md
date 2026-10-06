# Fase 26: ancoragem da fase, estado de entrada, folga e invariantes

**Data:** 2026-08-13
**Fase:** 26-volume-de-combate-e-densidade-narrativa
**Plano de origem:** 26-01 (Task 1)
**Proposito, em uma linha:** gravar o commit base da fase em arquivo versionado, no primeiro commit dela, e transcrever o estado de entrada das seis bandas com dono Fase 26, a folga contra o piso de duracao e a mediana da primeira torre, e os invariantes de orcamento, ANTES de qualquer numero novo mudar.

**Instrumento antes de motor, no mesmo padrao das Fases 23, 24, 25, 25B e 25C.** O criterio 1 do ROADMAP.md desta fase (nota de sequenciamento) e a licao herdada: um piso ou uma leitura escritos depois da medicao sao indistinguiveis, para quem le o repositorio no futuro, de um numero escolhido para caber no resultado que ja saiu. O precedente direto e `docs/diagnostics/25C-ancoragem.md`.

---

## Bloco 1: a base

| o que | valor | como foi obtido |
| --- | --- | --- |
| **SHA completo de HEAD na abertura da fase** | `d2bc5dc8908ca1029526e695004b98dce59c76b3` (`d2bc5dc`) | `git rev-parse HEAD`, no Task 1 deste plano, antes do primeiro commit desta fase. Assunto: `docs(26): create phase plan` |
| **hash de objeto de `src/sim/combat.ts`** | `0a271ad9d00bad36c650a2c5fd85ca5a5f2bbaa9` | `git rev-parse HEAD:src/sim/combat.ts` |
| **hash de objeto de `src/sim/engine.ts`** | `3550332bf4ed86b0c36da9aa6936353e8048e70e` | `git rev-parse HEAD:src/sim/engine.ts` |
| **hash de objeto de `src/sim/selection.ts`** | `23dcfdf79a9af13441bcf67993e7b59775ba432a` | `git rev-parse HEAD:src/sim/selection.ts` |

**Instrucao executavel para o plano de fechamento (26-10):** o fechamento LE este SHA e estes tres hashes DAQUI e nunca os deduz por assunto de commit. A armadilha esta registrada duas vezes nesta milestone (`25B-ancoragem.md` e `25C-ancoragem.md`): quando o topo da arvore e um commit de planejamento com escopo da propria fase no assunto, a regra de "achar o commit mais antigo com o escopo da fase no assunto" devolve o proprio HEAD, e a prova por diff do fechamento passa VAZIA, comparando a arvore com ela mesma. Este e exatamente o caso aqui: o topo da arvore na abertura desta fase e `d2bc5dc`, assunto `docs(26): create phase plan`, e o commit anterior a ele tambem tem escopo `26`. Se, no fechamento, o hash de objeto de `combat.ts` na base for igual ao de HEAD na hora do fechamento, a prova por diff esta VAZIA e o script de verificacao FALHA em vez de reportar sucesso.

**Sobre `src/sim/engine.ts` mudar de hash entre a base da Fase 25C (`667e1fd3...`, registrado em `25C-ancoragem.md`) e a base desta fase (`3550332b...`):** a mudanca e ESPERADA e ja esta contabilizada. A Fase 25C teve ondas de motor legitimas (25C-03, 25C-04, 25C-05), cada uma com commit proprio (`d764d33`, `00d394e`, `116b402`, `48295de`, `03800e0`, `f787026`), que moveram a rota do gank, o peso do lead de rota pos-luta e o ponto de operacao do conjunto de acoplamento. `src/sim/` NAO ficou intocado durante a Fase 25C inteira, apenas dentro de ondas especificas dela (as que a propria `25C-ancoragem.md` e o `STATE.md` documentam uma a uma). O hash gravado aqui e o do estado FINAL de `engine.ts` na abertura desta fase, e e esse que a Fase 26 preserva ou move a partir de agora.

### O veredito sobre `src/sim/__snapshots__/structures.test.ts.snap`

`git status --short` mostra este arquivo como modificado na abertura da fase. Conferencia feita ANTES de qualquer commit, comparando o hash de objeto do blob commitado contra o hash de objeto do arquivo na arvore de trabalho:

```
git cat-file -p HEAD:src/sim/__snapshots__/structures.test.ts.snap | git hash-object --stdin
  -> 391f67ba11963e338de5791aa36e4a68116b2a61
git hash-object src/sim/__snapshots__/structures.test.ts.snap
  -> 391f67ba11963e338de5791aa36e4a68116b2a61
```

**Os dois hashes sao IDENTICOS.** `git diff` no arquivo nao produz nenhuma linha de conteudo, so o aviso `LF will be replaced by CRLF the next time Git touches it`, que e o comportamento esperado de `core.autocrlf = true` (a mesma armadilha ja registrada no plano 25-07 e reusada em toda a Fase 25B e 25C: o objeto do git carrega LF, a arvore de trabalho carrega CRLF, e comparacao por `git status`/timestamps mentiria). **Veredito: a diferenca e PURAMENTE de conversao de fim de linha, nenhum conteudo mudou, e a arvore esta limpa para efeito de ancoragem.** A fase abre sobre uma arvore que corresponde exatamente ao commit `d2bc5dc`.

---

## Bloco 2: o estado de entrada das bandas com dono Fase 26

Medido rodando `npm run calibrate:pace` (o comando exato do gate), saida bruta salva em `tmp/pace-ancoragem-26.txt`. O gate roda vermelho por desenho (DEC-02): a rodada terminou com `EXIT=1` e o relatorio completo foi escrito antes do assert, como o arquivo garante (T-23-12).

Tier de referencia: EQUILIBRADO (user 75 contra rival 75, N=800, seed=indice da partida).

| banda | valor medido | piso | teto | alvo | lado estourado | distancia ate o lado que aperta |
| --- | --- | --- | --- | --- | --- | --- |
| abates/min | 1.277 | 0.700 | 1.000 | 0.840 | TETO | 0.277 (1.277 menos 1.000) |
| razao de abates vencedor sobre perdedor | 1.120 | 1.800 | 2.600 | 2.150 | PISO | 0.680 (1.800 menos 1.120) |
| razao torres sobre abates | 0.224 | 0.330 | 0.550 | 0.410 | PISO | 0.106 (0.330 menos 0.224) |
| fracao de abates ate 20:00 | 0.506 | 0.320 | 0.460 | 0.390 | TETO | 0.046 (0.506 menos 0.460) |
| fracao de partidas sem abate ate 10:00 | 0.016 | 0.050 | 0.200 | 0.110 | PISO | 0.034 (0.050 menos 0.016) |
| assistencias do ADC por partida | 5.524 | 4.000 | 8.000 | 5.500 | nenhum, DENTRO | 1.524 ate o piso (o lado mais proximo) |

**Cinco de seis bandas estao FORA na abertura da fase.** A unica que ja fecha, assistencias do ADC por partida, fecha porque e banda DERIVADA (taxa vezes volume de abates) e o volume de hoje (39.72 abates por partida) ainda esta bem acima da faixa alvo: o comentario do proprio `calibrate-pace.ts` ja avisa que ela deixa de fechar assim que o volume de abates cair, a menos que o criterio 6 (razao agregada de assistencias por abate, plano 26-02) tambem feche primeiro.

### Bloco 2.1: a divergencia de CBT-03, nomeada e nao escondida

O texto do `ROADMAP.md` (Fase 26, criterio 2) diz: "a razao entre torres e abates no fim da partida fica entre **0,30 e 0,55**". O gate que de fato roda, em `scripts/calibrate-pace.ts`, usa:

```typescript
checkBand("razao torres sobre abates", razaoTorresAbates, {
  floor: 0.33,
  ceiling: 0.55,
  target: 0.41,
  source: "STACK.md secao 7",
  owner: "Fase 26",
})
```

**A fase calibra contra o piso do CODIGO, 0,330, e nao contra o 0,30 do texto do roadmap.** A divergencia entre 0,30 e 0,330 e ACHADO REGISTRADO nesta ancoragem, e nao bug corrigido em silencio: nenhuma linha de `scripts/calibrate-pace.ts` e alterada por este plano, porque este plano e instrumento e nao alavanca.

**O numerador desta razao usa o contador de NOVE torres (`towersTotal`, o contador que nao inclui as duas torres do Nexus, D-25-04) e nao a contagem completa (`towersTotalFull`).** O proprio arquivo documenta essa escolha como deliberada:

> `razao torres sobre abates` NAO FOI CORRIGIDA AQUI, E ISSO E DELIBERADO. Ela sofre do MESMO erro de especificacao (...), mas a banda tem dono Fase 26 e corrigi-la seria mover a regua de uma banda que a decisao desta onda nao alcanca.

O dono da correcao deste numerador esta declarado na Fase 30 (revisao em bloco), pela mesma razao que barrou a correcao das outras bandas de torre fora da Fase 25B: uma correcao de leitura de harness move o numero de varias bandas ao mesmo tempo e faria a fase que a executa juiza do proprio criterio. **Por transparencia, a leitura sob a contagem completa nesta mesma rodada e 0,2774** (11.02 torres totais divididas por 39.72 abates totais, ambos da tabela do tier EQUILIBRADO em `tmp/pace-ancoragem-26.txt`), ainda abaixo do piso 0,330 nas duas leituras. A Fase 26 nao muda o numerador; move o volume de abates, que e o denominador da razao.

---

## Bloco 3: a folga e o limite de consumo, escrito ANTES da primeira alavanca (D-03)

| grandeza | valor medido | piso | teto | folga contra o piso |
| --- | --- | --- | --- | --- |
| duracao media da partida (min) | 30.023 | 29 | 36 | **1.023 min** |
| mediana da primeira torre (s) | 810 | 780 | 1140 | **30 s** |

**Estes dois numeros batem, casa decimal por casa decimal, com o registro que a Fase 25C deixou em `STATE.md`** ("folga hoje: 1,023" para duracao media e "restam DOIS TICKS de 15 s" para a primeira torre), o que confirma que a arvore de abertura desta fase e exatamente a que a Fase 25C fechou.

**A grandeza da primeira torre e quantizada em degraus de 15 s** (o tick da engine, `matchState.ts:478`). A folga de 30 s portanto nao e uma margem continua: ela vale **exatamente DOIS TICKS**. Qualquer alavanca que consuma um unico tick de mais ja reduz a folga pela metade, e uma terceira consumiria o piso inteiro.

### Regra de parada da fase, declarada agora e nao quando o conflito aparecer

**Nenhuma alavanca desta fase pode empurrar a duracao media abaixo de 29 min nem a mediana da primeira torre abaixo de 780 s.** Se a unica configuracao capaz de fechar uma banda de CBT (abates/min, razao de abates, razao torres sobre abates, fracao de abates ate 20:00 ou fracao sem abate ate 10:00) violar um destes dois pisos, o desfecho e ACHADO NOMEADO com os numeros dos DOIS lados (o quanto a banda de CBT fecharia e o quanto o piso de duracao ou de primeira torre seria violado), nunca afrouxamento silencioso de piso ou teto em nenhuma das duas bandas. O precedente desta disciplina e o criterio 3 da Fase 25B, que fechou com banda em aberto e regiao de fechamento provada vazia por grade, em vez de mover a regua.

**Por que a folga foi consumida ate aqui e por que ela aperta justamente nesta fase:** o `STATE.md` registra que a duracao media TROCOU de lado apertado durante a Fase 25B (do teto para o piso) e que a Fase 26 corta cerca de 40 por cento dos abates. Cortar volume de combate tende a encurtar a partida (menos lutas resolvidas, menos mortes que atrasam objetivo), o que empurra a duracao na direcao do lado que ja esta apertado hoje. A folga de 1,023 min e de dois ticks nao e abstrata: e o orcamento inteiro que esta fase tem para gastar antes de estourar um piso que nenhuma fase desta milestone tem permissao de mover sem nomear o achado.

---

## Bloco 4: os invariantes e o orcamento

| item | valor | comando exato |
| --- | --- | --- |
| contagem canonica de chamadas ao gerador em `src/sim/` | **72** | `grep -o 'rng(' -r src/sim --include='*.ts' \| wc -l` |
| regeneracoes de golden autorizadas nesta fase | **1** | orcamento padrao da milestone (visto em todas as fases 23 a 25C); nenhum comando mede isso, e a contagem real e conferida no fechamento por numero de commits `test(26-*)` que tocam `__snapshots__/` |
| dependencias novas autorizadas nesta fase | **0** | `git diff d2bc5dc..HEAD -- package.json` deve retornar vazio no fechamento |
| resultado de `npm test` na entrada | **58 arquivos, 944 testes, 0 falhas** | `npm test` (vitest run), 82,61 s de duracao total nesta rodada |

**A contagem de 72 chamadas ao gerador e a mesma que a Fase 25C fechou** (`25C-relatorio-da-fase.md` secao 6: "`rng(` em 72"), e a mesma que `25C-ancoragem.md` registrou na abertura daquela fase. Nenhuma linha de `src/sim/` foi tocada entre o fechamento da Fase 25C e a abertura desta fase (as unicas mudancas na arvore desde entao sao os commits de planejamento `26-*`, todos em `.planning/` e `docs/`), entao a reproducao exata da contagem e esperada e nao coincidencia.

**A suite de 944 testes em 58 arquivos, zero vermelhos**, tambem reproduz exatamente o numero que `STATE.md` registrou ao fechar a Fase 25C ("Suite em 944 verdes, ZERO vermelhos, 58 de 58 arquivos"). A arvore de abertura desta fase esta portanto confirmada por TRES leituras independentes: o SHA de HEAD, a contagem de `rng(`, e o resultado da suite.

---

## BLOCO 5: a leitura pre-motor da densidade, congelada na ancoragem

**Medido no Task 3, depois de o instrumento de densidade por fase existir (Task 2).** Insumo direto de D-01 e D-04 do `26-CONTEXT.md` e da banda do plano 26-03. Fonte: `npm run calibrate:pace`, tier EQUILIBRADO, N=800, saida em `tmp/pace-densidade-26.txt`. Nenhuma linha de `src/sim/` foi tocada para produzir este bloco: o motor segue exatamente no estado do Bloco 1.

**As duas leituras deste bloco:** densidade visivel (todo `EventKind`, o playback inteiro) e densidade comparavel (so os tipos com contraparte externa, `EVENT_KINDS_COMPARAVEIS`). As duas nascem OBSERVADAS: nenhuma virou banda neste plano.

### 5.1 As duas densidades nos tres buckets

| bucket | densidade | media | mediana | p10 | p90 | partidas com exposicao |
| --- | --- | --- | --- | --- | --- | --- |
| faseA [0:00, 14:00) | visivel | 1.830 | 1.857 | 1.429 | 2.214 | 800/800 |
| faseA [0:00, 14:00) | comparavel | 0.840 | 0.857 | 0.571 | 1.143 | 800/800 |
| faseB [14:00, 20:00) | visivel | 2.099 | 2.167 | 1.333 | 2.833 | 800/800 |
| faseB [14:00, 20:00) | comparavel | 1.224 | 1.167 | 0.833 | 1.667 | 800/800 |
| faseC [20:00, fim) | visivel | 3.553 | 3.228 | 2.462 | 5.000 | 800/800 |
| faseC [20:00, fim) | comparavel | 2.272 | 2.118 | 1.587 | 3.200 | 800/800 |

**Todas as 800 partidas tem exposicao nos tres buckets** (nenhuma partida do tier EQUILIBRADO termina antes dos 20 minutos), entao nenhuma serie perdeu amostra por truncamento nesta rodada.

### 5.2 A mistura por bucket, tipos com pelo menos 5 por cento nomeados

| bucket (total de eventos) | tipo | participacao |
| --- | --- | --- |
| faseA (20.493 eventos, 800 partidas) | plate_taken | 44.6% |
| | gank | 11.5% |
| | voidgrubs_taken | 7.8% |
| | kill | 7.6% |
| | dragon_taken | 7.3% |
| | tower_low | 6.1% |
| | **demais** (first_blood, shutdown, double_kill, first_tower, tower_destroyed, ace, dragon_steal, triple_kill) | **15.1%** |
| faseB (10.077 eventos, 800 partidas) | tower_low | 32.7% |
| | tower_destroyed | 21.2% |
| | shutdown | 9.5% |
| | kill | 8.6% |
| | herald_taken | 7.9% |
| | dragon_taken | 7.5% |
| | double_kill | 5.2% |
| | **demais** (ace, first_tower, inhibitor_destroyed, triple_kill, dragon_steal, quadra_kill, first_blood) | **7.4%** |
| faseC (25.132 eventos, 800 partidas) | shutdown | 18.3% |
| | tower_destroyed | 16.8% |
| | tower_low | 16.5% |
| | kill | 8.9% |
| | double_kill | 7.6% |
| | dragon_taken | 7.0% |
| | **demais** (ace, inhibitor_destroyed, baron_taken, nexus_exposed, gg, triple_kill, elder_taken, baron_steal, quadra_kill, dragon_steal, penta_kill, elder_steal) | **25.0%** |

**Leitura da forma:** o early game (faseA) e dominado por placas (44,6 por cento) e ganks (11,5 por cento), com abate puro (`kill`) em apenas 7,6 por cento dos eventos visiveis. O late game (faseC) inverte a composicao: `shutdown`, `tower_destroyed` e `tower_low` somam 51,6 por cento sozinhos, e a presenca de `baron_taken`, `elder_taken`, `nexus_exposed` e `gg` (a categoria "demais") mostra que o final da partida concentra a resolucao, exatamente como o ROADMAP.md descreve ("o LoL pro e genuinamente quase vazio ate os 14 min e explode depois dos 20").

### 5.3 A fracao de sangue por bucket, com a conta explicita

"Sangue" aqui e a uniao de todos os tipos que representam um abate ou o resumo de uma sequencia de abates, tanto os comparaveis quanto os multi abate e o `ace` (que a Fase 26 vai cortar juntos, porque `maxCasualties` e as alavancas de luta nao distinguem entre eles): `kill`, `first_blood`, `gank`, `shutdown`, `double_kill`, `triple_kill`, `quadra_kill`, `penta_kill`, `ace`.

| bucket | eventos de sangue | eventos totais | fracao |
| --- | --- | --- | --- |
| faseA | 2355 (gank) + 1559 (kill) + 798 (first_blood) + 770 (shutdown) + 497 (double_kill) + 70 (triple_kill) + 124 (ace) = **6173** | 20493 | **30.1%** |
| faseB | 961 (shutdown) + 868 (kill) + 523 (double_kill) + 233 (ace) + 134 (triple_kill) + 12 (quadra_kill) + 2 (first_blood) = **2733** | 10077 | **27.1%** |
| faseC | 4593 (shutdown) + 2231 (kill) + 1908 (double_kill) + 1241 (ace) + 540 (triple_kill) + 73 (quadra_kill) + 6 (penta_kill) = **10592** | 25132 | **42.1%** |

**Esta e exatamente a fatia que a Fase 26 vai cortar.** No late game quase metade (42,1 por cento) de tudo que o playback mostra hoje e sangue; no early game e menos de um terco (30,1 por cento), e o resto ja e placa, gank sem abate, voidgrubs e torre. Cortar abates sem repor nada atinge o late game com mais forca proporcional que o early.

### 5.4 A projecao aritmetica pos-corte, marcada como PROJECAO e nao como medicao

**Hipotese que a projecao assume, declarada como FALSA em algum grau:** todo tipo de evento que nao e sangue permanece EXATAMENTE constante durante o corte, e o corte de sangue e proporcionalmente uniforme nos tres buckets. Isso e falso porque a mistura entre pickoff (`gank`, `kill`, `solo_kill`) e teamfight (`double_kill` em diante, `ace`) muda com o corte: `maxCasualties` age sobre o TAMANHO das lutas, nao sobre a contagem de ganks, entao o corte real tende a concentrar-se mais em `double_kill`/`triple_kill`/`ace` do que em `gank`/`kill` isolado, o que a projecao abaixo nao captura.

**A conta:** `abates/min` mede hoje 1,277 (Bloco 2) e o alvo declarado da banda e 0,840 (`STACK.md secao 3 linha 8`). A razao de corte necessaria e `0,840 / 1,277 = 0,6578`, ou seja os eventos de sangue precisam cair para 65,78 por cento do volume de hoje. Aplicando essa MESMA razao a fracao de sangue de cada bucket (Bloco 5.3) e mantendo os eventos que nao sao sangue constantes:

| bucket | densidade visivel hoje | densidade de sangue hoje | densidade de sangue projetada | densidade visivel projetada | variacao |
| --- | --- | --- | --- | --- | --- |
| faseA | 1.830 | 0.551 | 0.363 | **1.641** | -10.3% |
| faseB | 2.099 | 0.569 | 0.375 | **1.904** | -9.3% |
| faseC | 3.553 | 1.497 | 0.985 | **3.041** | -14.4% |

**Leitura da projecao:** mesmo cortando abates na proporcao necessaria para `abates/min` alcancar o alvo da banda, a densidade visivel projetada NAO desaba: o early game continua acima de 1,6 eventos por minuto e o late continua acima de 3,0. O corte encolhe mais o late game (-14,4 por cento) do que o early (-10,3 por cento) em termos proporcionais, porque e no late que a fracao de sangue e maior hoje. Isto e projecao aritmetica sob uma hipotese declaradamente falsa em algum grau, e serve como piso otimista: o corte real, ao concentrar-se em multikill/ace em vez de distribuir uniformemente, tende a produzir uma queda de densidade visivel MAIOR do que a projetada aqui, nao menor.

### 5.5 A leitura em uma frase

**Quantos eventos por minuto o playback mostra hoje entre 0 e 14 min, e quanto disso e sangue:** o early game mostra **1,830 eventos visiveis por minuto**, dos quais **30,1 por cento (0,551 eventos/min) sao sangue** (abate, resumo de abate ou `ace`); o resto (69,9 por cento) e placa, gank sem abate confirmado por evento proprio, voidgrubs e alerta de torre. Sem este numero, D-01 e D-04 do `26-CONTEXT.md` continuavam sendo opiniao; com ele, a decisao de quanto recheio o early game precisa (D-01) e se um `EventKind` novo e necessario (D-04) tem denominador.

### 5.6 Comparacao com o global de eventos/min medido no fechamento da Fase 25

O fechamento da Fase 25 (`docs/diagnostics/25-relatorio-da-fase.md`) registra **2,33 eventos por minuto** como leitura global (media sobre a partida inteira, sem quebra por fase de jogo). Esta rodada, agregando os tres buckets da mesma forma (total de eventos visiveis dividido pela duracao media, tier EQUILIBRADO, N=800), mede **2,319 eventos por minuto**.

**Os dois numeros sao quase identicos (2,33 contra 2,319), e isso e o ponto do criterio 4 do ROADMAP.md e nao coincidencia vazia.** Uma media global correta (2,3 eventos/min) esconde uma variacao real de quase o dobro entre o bucket mais vazio (faseA, 1,830) e o mais cheio (faseC, 3,553). **A diferenca de definicao entre os dois numeros:** o 2,33 da Fase 25 e uma UNICA leitura sobre a partida inteira, cega a fase de jogo; os tres numeros desta ancoragem (1,830 / 2,099 / 3,553) sao a MESMA grandeza de base (contagem de eventos visiveis dividida por minutos de exposicao) mas medida SEPARADAMENTE em cada bucket, com exposicao por partida em vez de duracao total. Comparar os dois como se fossem a mesma grandeza esconderia exatamente a forma que o criterio 4 exige medir: "um gate global mediria a media certa e produziria a forma errada" (`ROADMAP.md`, Fase 26, criterio 4).

---

## BLOCO 6: a referencia de densidade por fase de jogo, derivada por aritmetica explicita

**Escrito no plano 26-03 (Task 1), antes de qualquer linha de codigo deste plano existir.** Este bloco produz os doze numeros (piso e teto das seis bandas de densidade) que o Task 2 do mesmo plano transcreve para `scripts/calibrate-pace.ts` sem recalcular. Fonte principal: `docs/references/ritmo.md` secoes 4.3 e 5. Fonte do valor pre-motor de cada teto provisorio: BLOCO 5 deste mesmo documento.

### 6.1 A regra de largura, declarada ANTES de qualquer numero novo

**Piso igual a 0,80 vez a referencia, teto igual a 1,20 vez a referencia, arredondados a duas casas decimais.** Esta e a mesma largura relativa que as bandas de combate ja existentes em `scripts/calibrate-pace.ts` usam, e o objetivo do plano 26-03 ja cita os dois exemplos: `abates/min` vale `[0,70; 1,00]` em torno do alvo 0,84, ou seja 0,83 e 1,19 vezes o alvo; `fracao de abates ate 20:00` vale `[0,32; 0,46]` em torno do alvo 0,39, ou seja 0,82 e 1,18 vezes. As duas bandas existentes usam uma largura relativa proxima de 0,80/1,20 mas nao identica (porque nasceram de arredondamento independente na fase que as criou). A regra desta fase fixa 0,80 e 1,20 exatos, porque usar uma largura diferente para a banda nova seria mudar a regua sem mudar a fonte, e a regra fica escrita aqui antes de qualquer referencia numerica ser calculada abaixo.

### 6.2 Interpolacao ate 14:00

`STACK.md` secao 5 (curva de estado por minuto, agregado dos dois times) so fornece marcos em 10:00, 15:00, 20:00, 25:00 (30:00 e 35:00 tem vies de sobrevivencia declarado na propria secao e nao entram nesta derivacao). A fronteira da fase A deste gate e 840 s (14:00), que cai entre os marcos de 10:00 e 15:00. **A interpolacao e linear entre as linhas de 10:00 e 15:00**, com 14:00 a quatro quintos do caminho entre os dois marcos (`(14-10)/(15-10) = 0,8`):

`valor(14:00) = valor(10:00) + 0,8 * (valor(15:00) - valor(10:00))`

As tres grandezas que a tabela fornece e que tem contraparte direta na engine sao abates acumulados, torres acumuladas e dragoes acumulados (baroes e inibidores valem **zero** nas linhas de 10:00, 15:00 e 20:00 da secao 5, e so aparecem na linha de 25:00 com 0,27 e 0,08; essa e a razao declarada de eles so entrarem no terceiro bucket, fase C):

| grandeza | valor em 10:00 | valor em 15:00 | interpolacao em 14:00 |
| --- | --- | --- | --- |
| abates acumulados | 3,24 | 6,49 | 3,24 + 0,8 * (6,49 - 3,24) = 3,24 + 2,60 = **5,84** |
| torres acumuladas | 0,03 | 0,85 | 0,03 + 0,8 * (0,85 - 0,03) = 0,03 + 0,656 = **0,686** |
| dragoes acumulados | 0,76 | 1,61 | 0,76 + 0,8 * (1,61 - 0,76) = 0,76 + 0,68 = **1,44** |

### 6.3 Referencia por bucket, leitura comparavel, com a conta explicita

**Fase A, de 0 a 14 min:** soma dos acumulados interpolados em 14:00 dividida por 14.

`(5,84 + 0,686 + 1,44) / 14 = 7,966 / 14 = 0,569 eventos/min`

**Fase B, de 14 a 20 min:** diferenca entre os acumulados de 20:00 e os interpolados de 14:00, dividida por 6.

| grandeza | valor em 20:00 | interpolado em 14:00 | diferenca |
| --- | --- | --- | --- |
| abates | 10,69 | 5,84 | 4,85 |
| torres | 3,72 | 0,686 | 3,034 |
| dragoes | 2,49 | 1,44 | 1,05 |

`(4,85 + 3,034 + 1,05) / 6 = 8,934 / 6 = 1,489 eventos/min`

**Fase C, de 20 min em diante:** diferenca entre os acumulados de 25:00 e os de 20:00, dividida por 5.

| grandeza | valor em 25:00 | valor em 20:00 | diferenca |
| --- | --- | --- | --- |
| abates | 16,32 | 10,69 | 5,63 |
| torres | 5,51 | 3,72 | 1,79 |
| dragoes | 3,38 | 2,49 | 0,89 |

`(5,63 + 1,79 + 0,89) / 5 = 8,31 / 5 = 1,662 eventos/min`

**Nota obrigatoria sobre 25:00 como proxy do bucket aberto.** A fase C deste gate nao tem teto de tempo (vai de 20:00 ate o fim da partida), mas `STACK.md` secao 5 so tem marco confiavel ate 25:00; as linhas de 30:00 e 35:00 sao explicitamente marcadas na secao 5 como enviesadas por sobrevivencia ("so partidas que ainda nao acabaram entram"). **Usar a janela de 20:00 a 25:00 como proxy da densidade de todo o bucket aberto e uma ESCOLHA declarada, nao uma medicao do bucket inteiro.** O vies de sobrevivencia das linhas de 30 e 35 min e exatamente por que elas nao entram nesta conta: incluir um marco enviesado na direcao de partidas mais longas (que tendem a ter densidade de eventos por minuto diferente do inicio do late game) distorceria a referencia na direcao errada, entao a escolha conservadora e parar em 25:00 e nomear a escolha em vez de escondê-la.

### 6.4 Referencia por bucket, leitura visivel

**Fase A:** a referencia comparavel de fase A mais a referencia de placas por partida dividida por 14. `STACK.md` secao 4.3 da a contagem de placas por partida em tres anos: 2023 = 8,90, 2024 = 8,50, 2025 = 7,24. Media dos tres anos: `(8,90 + 8,50 + 7,24) / 3 = 24,64 / 3 = 8,213`, arredondado a duas casas: **8,21**. As placas so existem antes de 840 s (14:00) por construcao do detector de cruzamento de estrutura (o mesmo detector documentado no plano 26-01 e no proprio `scripts/calibrate-pace.ts`), entao a media inteira de placas por partida e atribuivel ao bucket fase A, e a taxa e:

`8,21 / 14 = 0,586 eventos/min de placas`

`referencia visivel fase A = referencia comparavel fase A + placas/14 = 0,569 + 0,586 = 1,155 eventos/min`

**Fases B e C:** iguais as comparaveis, porque nenhuma grandeza externa nova entra nesses buckets (placas ja se esgotaram no bucket A, e nenhuma outra fonte da secao 4.3 ou 5 cobre eventos exclusivamente visiveis em B ou C). Referencia visivel fase B = 1,489 eventos/min; referencia visivel fase C = 1,662 eventos/min.

### 6.5 Os tetos da leitura visivel, PROVISORIOS por construcao

A leitura visivel soma tipos de evento que nenhum dataset externo registra (placas fora do bucket A ja contadas, mas tambem ticker de alerta de torre em risco, eventos de luta sem abate confirmado, e a camada contextual pt-BR). O teto externo derivado na secao 6.3/6.4 nao cobre esses tipos. Por isso **os tres tetos da leitura visivel NAO usam a regra de largura da secao 6.1**: cada um e PROVISORIO e vale o valor pre-motor medido no BLOCO 5 (secao 5.1 deste mesmo documento) daquele bucket, arredondado para cima ao decimo mais proximo.

| bucket | valor pre-motor (BLOCO 5, media visivel) | arredondado para cima ao decimo |
| --- | --- | --- |
| fase A | 1,830 | **1,9** |
| fase B | 2,099 | **2,1** |
| fase C | 3,553 | **3,6** |

**Justificativa completa, escrita por extenso.** O trabalho deste teto e impedir que o recheio narrativo do plano 26-07 compense o corte de abates inundando o ticker com ruido: se o teto da leitura visivel usasse a regra de largura de 1,20 vez um alvo derivado de fonte externa parcial, ele legitimaria um volume de anotacao maior do que a engine ja produz hoje, sem nenhuma fonte que diga que este volume maior seria correto. Ancorar o teto no estado pre-motor de hoje (BLOCO 5) significa que a Fase 26 pode REDISTRIBUIR densidade entre fases (por exemplo, dar mais recheio ao early game as custas do late), mas NAO PODE aumentar o volume total de anotacao acima do que ja existia antes desta fase comecar. Isto e provisorio porque nao existe fonte externa que cubra a camada de anotacao da engine (nenhum dataset de pro play tem "eventos de ticker pt-BR"); a fase dona de recalibrar este teto com dado real, se algum dia existir, precisa nomear a mudanca como achado, nunca mover o numero em silencio.

### 6.6 O piso da leitura visivel

**O piso da leitura visivel e o mesmo piso da leitura comparavel do bucket**, numero identico, nao recalculado a partir do alvo visivel. Justificativa: a linha do tempo completa (leitura visivel) e superconjunto do subconjunto comparavel (a leitura comparavel e um filtro dos mesmos eventos, nunca uma serie separada), entao qualquer piso valido para o subconjunto e piso valido para o conjunto que o contem. **E este piso, herdado do comparavel, que o criterio 4 do roadmap cobra quando diz que nenhuma das tres fases de jogo pode ficar abaixo do piso.**

### 6.7 A tabela final de doze numeros

Nenhum numero desta tabela pode ser alterado por onda posterior sem virar achado nomeado, no mesmo padrao de disciplina que os pisos/tetos do BLOCO 3 (folga e regra de parada) e do BLOCO 2 (bandas com dono Fase 26) ja seguem neste documento.

| banda | piso | teto | alvo | valor pre-motor (BLOCO 5) | veredito de entrada |
| --- | --- | --- | --- | --- | --- |
| densidade comparavel 0-14min (eventos/min) | 0,46 | 0,68 | 0,57 | 0,840 | **TETO estourado** (vermelha) |
| densidade comparavel 14-20min (eventos/min) | 1,19 | 1,79 | 1,49 | 1,224 | dentro da banda (verde) |
| densidade comparavel 20min+ (eventos/min) | 1,33 | 1,99 | 1,66 | 2,272 | **TETO estourado** (vermelha) |
| densidade visivel 0-14min (eventos/min) | 0,46 | 1,9 PROVISORIO | 1,16 | 1,830 | dentro da banda (verde) |
| densidade visivel 14-20min (eventos/min) | 1,19 | 2,1 PROVISORIO | 1,49 | 2,099 | dentro da banda (verde) |
| densidade visivel 20min+ (eventos/min) | 1,33 | 3,6 PROVISORIO | 1,66 | 3,553 | dentro da banda (verde) |

**Leitura do veredito de entrada, sem suavizar.** Das seis bandas, tres nascem VERDES por medicao: as tres visiveis, porque o teto delas foi ancorado no proprio valor pre-motor de hoje (secao 6.5) e por isso o valor de entrada nunca pode estourar o teto no dia zero. As tres comparaveis nascem em dois estados diferentes: fase B ja fecha dentro da banda hoje (1,224 dentro de `[1,19; 1,79]`), e fases A e C estouram o TETO (0,840 contra 0,68; 2,272 contra 1,99), porque o volume de abates de hoje (39,72 por partida, Bloco 2) ainda esta bem acima do alvo `abates/min` que a Fase 26 vai perseguir. **As tres bandas visiveis, que nascem verdes hoje, precisam CONTINUAR verdes depois do corte de abates**: um corte que reduza tambem o volume de eventos nao-sangue (placas, ganks sem abate, alertas de torre) empurraria a leitura visivel para baixo do proprio teto provisorio que ela mesma ancorou, o que seria uma contradicao logica (o teto foi calibrado no valor de hoje, entao so um AUMENTO de volume visivel pode estourá-lo). O risco real desta fase esta nas comparaveis: cortar demais empurraria fase A e C para dentro do teto (o objetivo declarado do corte), mas cortar sem repor nada empurraria a densidade visivel de fase A e C para baixo do PISO visivel, que e o mesmo risco de produto de primeira classe que o objetivo deste plano ja nomeia.

---

*Ancoragem completa: seis blocos preenchidos, `src/sim/` intocado (`git status --porcelain src/sim` vazio). BLOCO 6 deriva os doze numeros das seis bandas de densidade; a assercao delas em `scripts/calibrate-pace.ts` acontece no Task 2 deste mesmo plano (26-03).*
