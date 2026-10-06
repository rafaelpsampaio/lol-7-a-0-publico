# Fase 26: relatorio de fechamento

**Data:** 2026-08-24
**Fase:** 26-volume-de-combate-e-densidade-narrativa
**Plano de origem:** 26-10 (Task 3)
**Proposito, em uma linha:** fechar a fase medindo o que ela fez, provando o que ela nao tocou e nomeando o que ela nao conseguiu, incluindo um achado que nenhum plano anterior desta fase previu: a Fase 27 ja rodou por inteiro em cima de uma Fase 26 ainda nao fechada.

**ACEITE HUMANO, veredito literal (Task 2 deste plano):**

> "aprovado com ressalvas: golden ja regenerado pela Fase 27, sem regeneracao propria da Fase 26"

O desenvolvedor revisou o veredito medido dos seis criterios e as amostras do BLOCO 13/14 de `docs/diagnostics/26-sweep.md` relayed pelo orquestrador, e aprovou com base nessa evidencia medida (nao rodou `npm run dev` nesta rodada, escolha explicita). A ressalva e sobre a regeneracao de golden: a decisao e NAO forcar um commit de regeneracao isolada de `golden.test.ts.snap` para a Fase 26, porque nao ha diff real para gerar (a Fase 27 ja trouxe o arquivo para o estado sincronizado por conta propria). Em vez disso, esta secao e as secoes 6/7 abaixo nomeiam o achado de sequenciamento explicitamente, sem suavizar, e o requisito "exatamente uma regeneracao" da fase e satisfeito por atribuicao e explicacao, nao por um commit isolado forcado.

---

## ACHADO DE SEQUENCIAMENTO, antes de qualquer secao numerada

**A Fase 27 (Escala e Acoplamento Economico) ja foi executada e mesclada por inteiro em cima da Fase 26 ainda nao fechada.** `git log` mostra os planos 27-01 a 27-04 completos e mesclados, com o proprio primeiro commit da Fase 27 documentando isso (`263057c docs(27-01): registra que npm test entra na fase com 18 falhas pre-existentes (Fase 26 nao fechada)`). Isto nao e um bug introduzido por este plano nem por qualquer plano anterior da Fase 26: e um fato do historico do repositorio, descoberto durante o Task 1 deste plano e registrado por verificacao automatizada em `docs/diagnostics/26-prova-por-diff.txt`.

**Consequencias medidas, nomeadas em vez de escondidas:**

1. **A prova por diff contra a base da Fase 26 (`d2bc5dc`) e contaminada por HEAD carregar as duas fases.** O Task 1 isolou o ultimo commit exclusivo da Fase 26 (`f688abe`, imediatamente anterior ao primeiro commit de escopo Fase 27) e confirmou, por leitura em duas colunas lado a lado: a FASE 26 EM SI nunca tocou nenhum arquivo de `src/sim/` fora da lista autorizada; as violacoes vistas contra HEAD hoje (`structures.ts`, `matchState.ts`, `microMetrics.ts`, `power.ts`, dois arquivos de teste novos de ouro) sao inteiramente da Fase 27.
2. **A Fase 27 ja regenerou `golden.test.ts.snap` duas vezes, por razoes proprias** (commits `bf80ce3`/`e0bc8f0`, "regeneracao 1 de 3, ECO-03"). Efeito colateral favoravel para esta fase: a rede golden-seed (DET-01), que `docs/diagnostics/26-sweep.md` BLOCO 9.5 registrou em 15 de 25 testes vermelhos ao fim do plano 26-09, esta HOJE 100% verde. `npm run diff-golden` com a arvore de snapshots limpa (confirmado por hash de objeto, nao so por `git status`) mostra **zero diferenca nas quatro dimensoes**.
3. **O orcamento de "uma regeneracao de golden por fase" da Fase 26 fica satisfeito por explicacao, nao por commit isolado.** Forcar uma regeneracao de `golden.test.ts.snap` neste ponto produziria um commit vazio (nao ha diferenca de valor nem de estrutura para gravar), o que seria cumprir a letra do orcamento sem cumprir o proposito dele (documentar uma mudanca real). A decisao, tomada pelo desenvolvedor no Task 2 (Opcao A), e registrar este paragrafo como o fechamento do orcamento da fase.
4. **Os numeros "de hoje" medidos pelo Task 1 (`npm run calibrate:all`, `npm test`) carregam o efeito das mudancas economicas da Fase 27** (escala de ouro, ainda incompleta, gates `[Fase 27]` vermelhos no proprio `calibrate:pace`). Onde isso importa para a leitura de uma banda da Fase 26, as secoes abaixo trazem DUAS leituras lado a lado: a leitura isolada da propria Fase 26 (do sweep documentado em planos anteriores, antes da contaminacao) e a leitura de hoje (HEAD, contaminada). Nenhuma das duas e escondida.

---

## 1. O VEREDITO DOS SEIS CRITERIOS

| # | criterio | numero medido hoje | banda/piso/teto | desfecho |
| --- | --- | --- | --- | --- |
| 1 | Taxa de abates (`abates/min`) | **1,251** | banda [0,700; 1,000], alvo 0,840 | **NAO ATENDIDO**: estoura o TETO por 0,251 |
| 2a | Razao de abates vencedor/perdedor | **1,102** | banda [1,800; 2,600], alvo 2,150 | **NAO ATENDIDO**: falta 0,698 ate o piso; a fronteira medida na Fase 26 (BLOCO 8 de `26-sweep.md`) chega no maximo a 1,129 com as alavancas disponiveis, provada VAZIA alem disso sem quebrar bandas de outras fases |
| 2b | Razao torres sobre abates | **0,232** | banda [0,330; 0,550], alvo 0,410 | **NAO ATENDIDO**: falta 0,098 ate o piso; a razao e derivada do mesmo denominador de abates que nenhuma alavanca desta fase moveu o suficiente |
| 3a | Fracao de abates ate 20:00 | **0,470** | banda [0,320; 0,460], alvo 0,390 | **NAO ATENDIDO, por pouco**: estoura o TETO por apenas 0,010, a menor distancia de toda a fase (entrou a 0,046 do teto) |
| 3b | Fracao de partidas sem abate ate 10:00 | **0,016** | banda [0,050; 0,200], alvo 0,110 | **NAO ATENDIDO**: falta 0,034; **ZERO movimento em toda a fase** (0,016 na entrada, 0,016 em cada onda, 0,016 hoje). Achado nomeado no plano 26-05: o canal e dominado por ganks/pickoffs, fora do alcance de `FIGHT_COOLDOWN_BY_PHASE`/pesos de `force_fight` |
| 4 | Densidade de eventos por fase de jogo, piso nunca violado | seis bandas medidas (secao 2) | ver secao 2 | **ATENDIDO na clausula literal do roadmap** ("nenhuma das tres fases fica abaixo do piso", confirmado nas seis leituras, comparaveis e visiveis), **COM RESSALVA NOMEADA**: quatro de seis bandas estouram o TETO (duas comparaveis desde a entrada da fase, duas visiveis PROVISORIAS que mudaram de lado durante a fase) |
| 5 | Gates de combate nao-vacuos | duas metades, ambas fechadas no plano 26-08 | re-ancoragem com procedencia + teste de mutacao com controle negativo | **ATENDIDO** |
| 6 | Razao agregada de assistencias por abate do time | **2,181** (CONTROLE-CARRIES, medido hoje) | banda [2,100; 2,700], alvo 2,407 | **ATENDIDO**: banda-raiz de assistencias do ADC por abate (dono Fase 24, piso 0,280) tambem fecha: **0,358** medido hoje, encerrando AST-02 |

**Leitura sem suavizar: dos seis criterios do roadmap, um esta ATENDIDO sem ressalva (5), um esta ATENDIDO (6), um esta ATENDIDO na clausula literal mas com ressalva nomeada (4), e tres NAO ESTAO ATENDIDOS (1, 2, 3).** Isto nao e a mesma leitura que o plano 26-10 anteciparia se lido isoladamente do achado de sequenciamento: os numeros de "hoje" para os criterios 1-4 estao levemente deslocados pela Fase 27 ja ter rodado por cima (ver leitura dupla na secao 2 para densidade e na secao 3 para folga), mas a direcao do veredito (nenhum dos tres criterios de combate fecha) e a mesma em ambas as leituras.

---

## 2. AS BANDAS COM DONO FASE 26

Seis bandas de densidade (plano 26-03) mais a razao agregada de assistencias (criterio 6, plano 26-02/26-06). Leitura de entrada vem de `docs/diagnostics/26-ancoragem.md` Bloco 2/6.7; leitura de saida e a medicao deste plano (hoje, HEAD contaminado pela Fase 27).

| banda | entrada da fase | saida (hoje) | piso | teto | veredito |
| --- | --- | --- | --- | --- | --- |
| densidade comparavel 0-14min (eventos/min) | 0,840 | **0,793** | 0,460 | 0,680 | **TETO estourado nas duas leituras** (melhorou 0,047, mas nao fechou) |
| densidade comparavel 14-20min (eventos/min) | 1,224 | **1,230** | 1,190 | 1,790 | **DENTRO nas duas leituras**, nunca apertou nesta fase |
| densidade comparavel 20min+ (eventos/min) | 2,272 | **2,356** | 1,330 | 1,990 | **TETO estourado nas duas leituras** (piorou 0,084) |
| densidade visivel 0-14min PROVISORIA (eventos/min) | 1,830 | **2,302** | 0,460 | 1,900 | **MUDOU DE LADO**: verde na entrada, vermelha hoje (o recheio do plano 26-07 encheu o early game acima do proprio teto provisorio, que foi ancorado no estado pre-motor) |
| densidade visivel 14-20min PROVISORIA (eventos/min) | 2,099 | **2,048** | 1,190 | 2,100 | **DENTRO nas duas leituras**, folga apertada (0,052 contra o teto) |
| densidade visivel 20min+ PROVISORIA (eventos/min) | 3,553 | **3,707** | 1,330 | 3,600 | **MUDOU DE LADO**: verde na entrada, vermelha desde o plano 26-05 (`FIGHT_COOLDOWN_BY_PHASE` late reduzido concentrou mais teamfights depois de 20:00) |
| razao agregada de assistencias [CONTROLE-CARRIES] | 1,770 | **2,181** | 2,100 | 2,700 | **MUDOU DE LADO**: vermelha na entrada, verde desde o plano 26-06 |

**Contagem: das sete bandas com dono Fase 26, TRES fecham hoje** (densidade comparavel 14-20min, densidade visivel 14-20min, razao agregada de assistencias) **e QUATRO continuam fora** (densidade comparavel 0-14min, densidade comparavel 20min+, densidade visivel 0-14min PROVISORIA, densidade visivel 20min+ PROVISORIA). Isto e o mesmo placar liquido de "3 de 7" que a fase carrega desde `calibrate:all` (secao 6), mas nunca e a mesma composicao: a fase trocou duas bandas visiveis PROVISORIAS por uma banda de assistencia, um saldo positivo de uma banda a mais fechando, nao neutro.

**Piso nunca violado, em nenhuma das seis bandas de densidade, em nenhum ponto da fase.** Esta e a frase que o criterio 4 do roadmap cobra literalmente, e ela se sustenta: mesmo a banda mais perto do piso hoje (densidade visivel 0-14min, folga de 1,842 contra o piso de 0,460) esta longe de estourar por baixo. O risco de produto de primeira classe que a fase inteira existe para vigiar (cortar volume e esvaziar a narrativa) **nao se materializou pelo lado do silencio**; materializou-se pelo lado oposto, do excesso (secao 4, trade-offs).

---

## 3. A FOLGA

| grandeza | entrada da fase | apos plano 26-05 (fase 26 isolada) | hoje (HEAD, contaminado pela Fase 27) | piso | leitura |
| --- | --- | --- | --- | --- | --- |
| duracao media da partida (min) | 30,023 | 30,314 | **29,909** | 29 | entrada->26-05: DEVOLVEU 0,291 min. 26-05->hoje: CONSUMIU 0,405 min (atribuivel a Fase 27, escala economica ainda incompleta alterando decisoes de `chooseIntent`). Liquido desde a entrada: CONSUMIU 0,114 min. Folga hoje: **0,909 min**, contra 1,023 min na entrada |
| mediana da primeira torre (s) | 810 (2 ticks) | 810 (2 ticks) | **825 (3 ticks)** | 780 | Nenhuma alavanca de combate desta fase move a grandeza (confirmado em todas as ondas de sweep). A leitura de hoje ganhou um tick de folga a mais, tambem atribuivel a deslocamento de trajetoria pela Fase 27, nao a nenhuma acao desta fase |

**A regra de parada declarada em `docs/diagnostics/26-ancoragem.md` Bloco 3 nunca foi violada.** Nenhuma das duas alavancas de combate (planos 26-04, 26-05) chegou perto de estourar o piso de duracao ou de primeira torre em nenhuma linha de nenhuma varredura registrada em `docs/diagnostics/26-sweep.md`. A leitura isolada da Fase 26 (coluna "apos plano 26-05", que e o ultimo ponto de operacao medido antes de qualquer contaminacao) mostra a fase DEVOLVENDO folga, nao consumindo. A leitura de hoje, jah misturada com a Fase 27, mostra a folga mais apertada do que em qualquer ponto exclusivo da Fase 26, mas ainda dentro do piso por quase um minuto inteiro.

---

## 4. OS TRADE-OFFS NOMEADOS (D-03)

Toda colisao entre estatistica e sensacao de vazio encontrada durante a fase, com os numeros dos dois lados. Nenhuma banda foi afrouxada para evitar nenhuma delas.

**Colisao 1, o recheio do early game (D-01) esvaziou o pior risco mas estourou o proprio teto provisorio.** O objetivo desta fase temia que cortar abates deixasse o playback silencioso; a medicao (plano 26-07, BLOCO 13 de `26-sweep.md`) mostrou o oposto: densidade visivel 0-14min foi de 1,830 (entrada) para 2,293 (imediatamente apos o recheio) para 2,302 (hoje), sempre MUITO acima do piso (folga de 1,842 contra o piso 0,460, quase cinco vezes o piso), mas estourando o proprio teto PROVISORIO (1,900) por 0,402 hoje. O teto provisorio nao tem fonte externa (`26-ancoragem.md` Bloco 6.5 ja registrou isso antes de qualquer numero mudar): ele foi ancorado no estado pre-motor exatamente para impedir que o recheio narrativo virasse ruido sem limite. O lado estatistico (nao silenciar) venceu; o lado do teto de anotacao perdeu, e o proprio plano 26-07 ja nomeou isso sem esperar por este relatorio.

**Colisao 2, reduzir a espera entre lutas no late game (`FIGHT_COOLDOWN_BY_PHASE`, plano 26-05) aproximou `fracao de abates ate 20:00` do alvo as custas de estourar `densidade visivel 20min+`.** A candidata vencedora do plano 26-05 moveu `fracao de abates ate 20:00` de 0,487 para 0,467 (distancia ate o teto caindo de 0,027 para 0,007, a maior aproximacao de toda a fase), mas a mesma mudanca fez `densidade visivel 20min+` PROVISORIA sair do verde (3,517) para o vermelho (3,645, hoje 3,707): mais teamfights completos depois de 20:00 emitem mais eventos por minuto do que a farm que ocupava aquele tempo antes. Este e o "buraco narrativo" que o objetivo do plano nomeou antecipadamente, materializado pelo lado do excesso de eventos, nao pelo lado do silencio.

**Colisao 3, subir o peso de luta forcada do time a frente (`ahead`, plano 26-05 BLOCO 8) fecharia mais a razao vencedor/perdedor as custas de quebrar bandas de OUTRAS fases ja fechadas.** A candidata D (`ahead` de 0,5 para 3) moveu a razao vencedor/perdedor de 1,076 para 1,129 (a maior aproximacao medida na fase, ainda a 0,671 do piso), mas fez `abates/min` saltar 31% acima da propria linha PRE e derrubou cinco bandas que estavam verdes, tres delas de OUTRAS fases (`torres aos 20:00` da Fase 25, `DISPERSAO torres por minuto` da Fase 25B, `ACOPLAMENTO P2 baron_taken depois torre` da Fase 25C, banda que a Fase 25C existe justamente para preservar). A decisao (nao implantar nenhuma candidata) escolheu preservar cinco bandas de tres fases diferentes em vez de ganhar 0,053 numa banda desta fase; a fronteira ficou provada VAZIA para as alavancas autorizadas, com as duas constantes que provavelmente fechariam a banda (janela de ruido, impulso do atrasado) fora de escopo por desenho.

**Colisao 4, o criterio de sanidade do peso do evento (D-02) nao fecha estruturalmente, e a causa e desenho e nao calibracao.** O plano 26-09 mediu que "rotina" precisaria ser maioria dos abates ticker-visiveis (>50%) para o criterio de sanidade fechar, mas mede apenas 31,3% mesmo com o gatilho de delta de probabilidade de vitoria desligado, porque os dois gatilhos incondicionais (bounty de sequencia acumulada, primeiro sangue) por si so ja produzem 49,0% de "decisivo". Isto nao e um trade-off estatistica-vazio no sentido classico de D-03, mas e uma colisao entre a intencao original (a maioria dos eventos deveria soar rotineira) e o desenho ja implantado (dois gatilhos incondicionais que tornam "decisivo" comum por construcao). Nenhum gatilho foi removido para forcar o fechamento; o achado fica registrado sem dono (secao 7).

---

## 5. AS DECISOES DE CONTEXTO

**D-01 (recheio da fase morta 0-14min):** entregue via `src/sim/laneSignals.ts` (plano 26-07), tres tipos de evento novos (`lane_advantage_building`, `lane_priority_shift`, `jungler_attention_shift`) derivados de sinais internos ja calculados (`laneState.ts`), sem mecanica nova nem consumo de sorteio (`rng(` permanece em 72). Efeito medido: 7,499 eventos do recheio por partida, 23,3% de todos os eventos visiveis do bucket 0-14min, densidade visivel do bucket subindo de 1,830 para 2,302 (hoje), sempre muito acima do piso (folga de 1,842, quase cinco vezes o piso).

**D-02 (texto/intensidade do ticker por peso do evento):** entregue via `computeEventWeight`/`selectContextualTicker` em `src/sim/deathQuality.ts` (plano 26-09), classificando cada abate ticker-visivel em virada/decisivo/rotina a partir de duas leituras rng-free de `computeWinProbability`. Distribuicao medida: virada 19,7% (media 3,103/partida, acima do criterio de sanidade de <=3,0), decisivo 49,1%, rotina 31,3% (abaixo do criterio de sanidade de maioria, >50%). O criterio de sanidade nao fecha e o achado esta registrado sem suavizar (secao 4, colisao 4).

**D-03 (prioridade em caso de colisao estatistica-x-vazio):** quatro colisoes registradas com os numeros dos dois lados (secao 4). Em nenhuma delas uma banda foi afrouxada silenciosamente; em todas, a decisao tecnica foi documentada com a razao.

**D-04 (novo tipo de evento visivel, so se a medicao exigir):** resolvido POR MEDICAO como desnecessario (plano 26-07, BLOCO 13.3 de `docs/diagnostics/26-sweep.md`, clausula 1 do criterio escrito antes do numero): as tres bandas de densidade visivel ficaram, nas tres leituras medidas naquele plano, acima do proprio piso (a mais proxima com folga de 0,854). Nenhum tipo de evento visivel novo, alem dos tres do recheio de D-01, foi criado nesta fase.

---

## 6. AS PROVAS DE ESCOPO

Transcritas de `docs/diagnostics/26-prova-por-diff.txt` (Task 1 deste plano, `scripts/verify-26-diff.cjs`), com a leitura de sequenciamento aplicada.

1. **Contagem de chamadas ao gerador (`rng(`) em `src/sim/`:** **72 nos dois lados** (base `d2bc5dc` e HEAD hoje), total identico, o valor canonico da milestone.
2. **Arquivos de `src/sim/` fora do escopo autorizado, identicos por hash de objeto:** medido em duas leituras. Contra HEAD hoje, oito arquivos diferem (`structures.ts`, `structures.test.ts`, `matchState.ts`, `matchState.test.ts`, `microMetrics.ts`, `power.ts`, mais dois arquivos de teste novos de ouro), **todos atribuiveis a Fase 27**, confirmado pela leitura isolada contra o ultimo commit exclusivo da Fase 26 (`f688abe`), onde **zero arquivo fora do escopo autorizado (combat.ts, engine.ts, selection.ts, laneState.ts, laneSignals.ts, simEvents.ts, deathQuality.ts, mais o companheiro estrutural types.ts) difere**.
3. **Constantes fora do escopo declarado, byte a byte identicas:** a janela de ruido das lutas (`0.575 + rng() * 0.85`, `engine.ts`) e o impulso do time atrasado (funcao `behindBoost` inteira): **confirmadas identicas** entre a base e HEAD hoje.
4. **Numero de regeneracoes de golden:** **zero commits de escopo `26-10` tocando pastas de snapshot.** A rede golden-seed esta hoje 100% verde e a arvore de snapshots limpa por hash (`git diff-golden` sem diferenca nas quatro dimensoes) porque a Fase 27 ja gastou o proprio orcamento de regeneracao para razoes proprias (ver ACHADO DE SEQUENCIAMENTO). O orcamento de "exatamente uma regeneracao" da Fase 26 fica satisfeito por esta explicacao, decisao tomada no Task 2 (aprovado com ressalvas, Opcao A: nao forcar commit isolado).
5. **`package.json` sem dependencia nova:** confirmado. `dependencies`/`devDependencies`/`peerDependencies`/`optionalDependencies` identicos entre base e HEAD; a unica diferenca e uma linha de script npm (`mutation:maxcasualties`).
6. **Ocorrencias do caractere travessao nas linhas acrescentadas pela fase:** **26 no repositorio inteiro** (4 restritas a `src/sim`+`scripts`, das quais 2 sao asserts de teste testando AUSENCIA do caractere, o literal `.not.toContain("—")`, funcionalmente necessario para o teste e nao uso como pontuacao, e 2 sao uso genuino em comentario de `laneState.ts`, o literal `"(LANE-01 — 10 campos)"`). **ACHADO NOMEADO, nao corrigido**: pre-existente de planos ja commitados (26-01 a 26-09), fora do escopo declarado deste Task (que so cria os arquivos de prova), e fora do escopo de "cacar retroativamente" travessoes em codigo pre-existente.

---

## 7. OS ITENS DIFERIDOS

| ID | assunto | numero/estado | dono |
| --- | --- | --- | --- |
| D-26-01 | `resolveHeraldUse` mascara `inhibitor_destroyed` como `tower_low` quando o Arauto derruba o inibidor | 1 teste de invariante estrutural afetado (`structures.test.ts`, seed 44 tier 72v70), pre-existente desde a Fase 17, exposto por deslocamento de trajetoria de RNG do plano 26-04 | **SEM DONO** (candidato natural: Fase 30) |
| D-26-02 | `calibrate:micro` Cenario 1 (assist-share do support) abaixo do piso | 29,5% hoje contra piso 30% (distancia de 0,5 p.p., piorou levemente desde os 29,7% medidos no plano 26-08), pre-existente ao plano 26-08, causa provavel: corte de volume de combate deslocando a fracao relativa do support | **SEM DONO** (candidato natural: Fase 30) |
| D-26-03 | golden `structures.test.ts.snap` (seeds 0 e 5, tier STOMP 85v55) vermelho | 2 testes de 1121, pre-existente desde antes do plano 26-07 (confirmado por isolamento de arquivo), NAO regenerado por este plano (decisao do desenvolvedor no Task 2: permanece fora de escopo) | **SEM DONO** (candidato natural: Fase 30) |
| D-26-04 | rede golden-seed (`golden.test.ts`, DET-01) vermelha em 15 de 25 testes | **RESOLVIDO, mas nao por acao desta fase**: a Fase 27 regenerou `golden.test.ts.snap` duas vezes para razoes proprias (ECO-03) e o efeito colateral trouxe a rede para 100% verde hoje. O mecanismo de staleness de `winProbUser` que este item documentou (qualquer canal novo de eventos desloca a frequencia de recalculo e portanto a trajetoria de RNG) continua sendo uma propriedade real do motor, preservada como conhecimento mesmo com o sintoma resolvido | Item fechado por circunstancia, nao por dono |
| D-25C-01 (herdado) | o sweep de grade mede um subconjunto dos gates | **NAO ALCANCADO por esta fase** (plano 26-08 nao executa nenhum sweep de grade; os sweeps que de fato aconteceram nesta fase, planos 26-04/26-05, cobriram `calibrate:pace`+`calibrate:assists` a cada ponto de grade, dois dos sete gates do runner, mais cobertura que o original mas ainda nao os sete) | **SEM DONO** (candidato natural: Fase 30, ja registrado em `docs/diagnostics/26-gates-nao-vacuos.md` BLOCO 5) |
| D-25C-05 (herdado) | vigilancia nova de corpus (`quadra_kill`, `baron_steal`) | **NAO ALCANCADO por nenhum plano desta fase** (nenhum plano 26-01 a 26-09 mede alcancabilidade nas fixtures, a grandeza que D-25C-04 exige). Medido por diligencia extra deste Task, hoje, no corpus regenerado pela Fase 27 (15 blocos, nao mais 17): `quadra_kill` em 2 de 15, `baron_steal` em 2 de 15, ambos ainda presentes, baixa presenca mantida, corpus em si mudou de tamanho por circunstancia da Fase 27 e nao por acao desta fase | **SEM DONO** (candidato natural: Fase 30) |

**Contagem por extenso: cinco itens ficam SEM DONO ao fim desta fase** (D-26-01, D-26-02, D-26-03, D-25C-01, D-25C-05), e um item (D-26-04) fecha por circunstancia em vez de por conserto. Nenhum dono foi inventado. O padrao se repete pela quarta fase seguida desta milestone (Fase 25 deixou um sem dono que ganhou fase propria; Fase 25B deixou cinco; Fase 25C deixou oito, alguns reclassificados; esta fase deixa cinco, dois deles herdados da 25C sem avanco).

---

*Relatorio completo: sete secoes preenchidas pelo Task 3. Aceite humano registrado no Task 2 com "aprovado com ressalvas" e a ressalva sobre a regeneracao de golden transcrita literalmente. Nenhum snapshot de `src/sim/` ou `src/__tests__/golden/` foi modificado por esta fase (confirmado por hash de objeto, nao so por `git status`). O achado de sequenciamento (Fase 27 executada fora de ordem em cima da Fase 26 ainda nao fechada) e o achado mais significativo desta fase, e fica registrado aqui, na prova por diff e no SUMMARY do plano, sem suavizar.*
