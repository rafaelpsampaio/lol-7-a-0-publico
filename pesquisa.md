# Pesquisa aplicada para a engine de simulação do LoL 7 a 0

## Escopo e conclusão executiva

Esta pesquisa foi montada para **Summoner’s Rift normal/ranked de PC**, excluindo **Wild Rift, ARAM, Arena e Swiftplay**. Como base “mais recente”, considerei a patch note **26.13**, publicada em **23/06/2026**; para as regras sistêmicas de mapa e objetivos, as mudanças realmente relevantes continuam vindo principalmente da **26.1** e da **26.3**. Onde a Riot não entra no detalhe operacional de spawn/respawn/comportamento, complementei com a **League of Legends Wiki** atualizada. Quando há conflito, a regra mais recente da Riot prevalece. citeturn39view0turn42view3turn20view0

A principal consequência prática para sua engine é esta: **uma partida de LoL não deve ser simulada como “eventos independentes sorteados”**. O jogo real avança por **janelas de mapa**. Primeiro vêm lane priority, ganks e plates; depois surgem disputas por dragões, Voidgrubs e Herald; mais tarde, Baron, alma e Elder passam a redefinir a partida. A Riot reforçou isso em 2026 ao remover o Atakhan, devolver o Baron para **20:00**, dar mais peso a empurrar torres, espalhar plates por quase todas as torres e deixar monstros épicos mais contestáveis, com mais ênfase em **setup**, **Smite/jungler**, **lane priority** e **trade de mapa**. citeturn42view3turn41view3turn16search0turn34view2

A melhor engine para o “LoL 7 a 0”, portanto, é uma engine de **estado + intenção + resolução**, em que cada tick recalcula pressão de rota, visão, poder de luta, janela de objetivo, risco de pickoff e probabilidade de teamfight. O aleatório continua existindo, mas como **ruído em volta do estado do jogo**, não como causa principal dos acontecimentos.

## Regras reais de LoL que mais importam para a simulação

A condição real de vitória continua simples: **vence quem destrói o Nexus inimigo**. Em Summoner’s Rift, cada time tem um Nexus protegido por **duas Nexus turrets**, e o Nexus só fica vulnerável quando não resta nenhuma dessas torres de pé e pelo menos um inibidor já foi exposto/destruído no caminho correto; o próprio wiki resume que o Nexus é o objetivo primário e que destruir o Nexus encerra a partida. citeturn22view1turn22view0

Na estrutura do mapa, cada time tem **11 torres** em SR, distribuídas entre **outer, inner, inhibitor e Nexus turrets**. A atualização sistêmica mais relevante para sua engine é que, desde a **26.1**, **todas as torres exceto as do Nexus agora têm plates**, o que espalha o ouro estrutural em pequenos ganhos incrementais e torna a progressão por pressão/siege mais fiel do que um simples “ou derrubou a torre ou não aconteceu nada”. A mesma patch também introduziu/fortaleceu o **Crystalline Overgrowth**, um mecanismo de dano extra em torres ao longo do tempo, pensado exatamente para valorizar pushes pequenos e consistentes. citeturn23view0turn41view2turn41view3

Isso muda bastante a leitura de fases de jogo. **Riot não define um corte oficial rígido de “lane phase / mid game / late game”**, então o melhor é tratá-las como **faixas inferidas** a partir do próprio calendário do mapa. Como os minions agora nascem em **0:30**, os primeiros camps aparecem antes, o primeiro dragão e as Voidgrubs entram cedo, e as torres dão recompensas parciais por plates, a fase inicial é melhor modelada como um período em que **farm, plates, roams curtos e setup de objetivo** pesam mais do que teamfights 5v5 longas. Depois, com turrets externas caindo, Herald/dragões empilhando e respawns mais longos, a simulação deve naturalmente migrar para **mid game de rotação e picks**; quando Baron, alma, Elder, inibidores expostos e timers de morte altos entram em cena, você está no **late game**. Isso é uma inferência de design, mas é fortemente sustentada pelo calendário oficial do mapa e pelas regras atuais de torres/minions/objetivos. citeturn41view3turn41view2turn40view0

Outro ponto importante para a sua engine: **vantagem não é só ouro**. No LoL real, partidas mudam de rumo por uma combinação de **ouro, XP, kills, shutdowns, plates, torres, dragões, soul threat, visão, lane priority e estado do mapa**. O wiki resume que as **objective bounties** podem entrar a partir de **14:00** para o time que estiver atrás numa composição de ouro, experiência, dragões e torres, e que elas ainda podem “linger” por até 60 segundos; além disso, a Riot manteve/complementou mecanismos de comeback em dragões e Baron com **bonus XP para times atrás**, e ajustou bounties de campeão em 26.1/26.3 para reduzir o valor de mortes repetidas e devolver relevância ao farming para revalorizar o bounty. citeturn18view0turn16search0turn20view0

Para o seu simulador, isso implica uma regra simples e valiosa: **vantagem aumenta a chance de vitória, mas nunca garante o resultado**. Um time na frente deve converter melhor em dragões, torres e Baron; um time atrás ainda precisa ter caminhos reais de retorno via **shutdown, objective bounty, pickoff, soul deny, Baron/Elder steal e lutas com melhor execução**. Isso faz a partida parecer LoL de verdade em vez de parecer um RPG com “snowball irrecuperável”.

## Timers atuais dos objetivos e como traduzi-los para a engine

A tabela abaixo mistura duas coisas: **regra real do jogo** e **tradução recomendada para a simulação**. Nas colunas factuais, a prioridade foi Riot; na falta do detalhe operacional, usei a Wiki.

| Objetivo | Regra real atual | Quando não pode aparecer | Efeito real ao ser feito | Impacto recomendado na engine | Fonte |
|---|---|---|---|---|---|
| Dragão elemental | Primeiro dragão nasce em **5:00**. Se for abatido, o próximo nasce **5:00** depois. Após o **segundo dragão abatido**, o mapa se transforma conforme o elemento do **terceiro** dragão, e esse elemento passa a ser o único que nasce dali em diante. citeturn14view4turn14view2 | Não há respawn enquanto o dragão atual estiver vivo. Antes de 5:00 ele simplesmente não existe. citeturn14view4 | Cada dragão dá um **buff permanente de time**; no 4º dragão do mesmo time, esse time pega a **Dragon Soul**. citeturn15view0turn33view0 | + ouro/XP moderado; + pressão futura em rotas e objetivos; + win probability progressiva. O valor do 1º/2º dragão é relevante, mas o valor do **3º e do soul point** deve ser bem maior. | citeturn14view4turn15view0turn33view0 |
| Dragon Soul | O primeiro time a chegar a **4 stacks de Dragon Slayer** recebe permanentemente a Alma do elemento dominante do Rift. Os efeitos variam por elemento: dano explosivo no Infernal, shield no Mountain, sustain no Ocean, lightning/slow no Hextech, MS no Cloud, dano+redução abaixo de 50% no Chemtech. citeturn33view0 | Não existe antes de um time fazer o 4º dragão. citeturn15view0turn33view0 | Buff permanente, de altíssimo impacto. Riot explicitamente diz que pegar Soul deve ser um compromisso comparável a Baron em importância. citeturn16search0 | + grande salto de win probability; + maior disposição do time com alma para forçar 5v5 e fechar mapa; + oponente passa a valorizar Elder deny/comeback muito mais. | citeturn16search0turn33view0 |
| Elder Dragon | Passa a nascer **depois que algum time obtém Dragon Soul**. Respawn de **6:00**. O buff dura **150s** para os aliados vivos que participam do kill. citeturn13view4turn31search1turn33view0 | Não existe antes de haver alma. Se um elemental/elder anterior ainda estiver vivo, também não nasce outro. citeturn14view2turn13view4 | Dá **Aspect of the Dragon**: burn verdadeiro e execute em campeões abaixo de 20% HP; o buff é **perdido na morte**. citeturn32view0turn33view0 | + enorme chance de vencer próximas lutas; + incentivo máximo a forçar fight/siege; + se só 2-3 jogadores sobreviverem com buff, o valor é menor que “Elder full team”. | citeturn32view0turn33view0 |
| Voidgrubs | Nascem aos **5:00** no Baron pit. O camp tem **3 Voidgrubs**. Cada grupo pode reaparecer **uma vez** com respawn compartilhado de **4:00** depois de os 3 morrerem; máximo de **6** por jogo. A 2ª leva só nasce se a 1ª for limpa antes de **9:45**. O camp despawna de vez em **13:45** (ou **13:55** em combate). citeturn37view2turn37view1 | Não existem depois do despawn; não existe 2ª leva se a 1ª não foi limpa até 9:45; não coexistem com Herald, que usa o mesmo pit às 14:00. citeturn37view2turn13view1 | Cada grub dá stack de **Touch of the Void**. O buff empodera dano em estruturas; com stacks mais altos, invoca **Voidmites** para ajudar a derrubar torres. citeturn27view0turn28search2 | + pressão de side lane e siege; + valor especialmente alto para comp de split, top forte e Herald follow-up. O ganho de 4/5/6 grubs deve aumentar muito a taxa de queda de torres na engine. | citeturn37view2turn27view0turn28search2 |
| Rift Herald | Nasce às **14:00**, apenas **uma vez** por jogo. Despawna em **19:45** (ou **19:55** em combate). Baron nasce no mesmo pit às **20:00**. citeturn13view3turn30view0 | Não existe antes de 14:00; não reaparece; não pode existir junto de Baron. citeturn13view3 | Derrubá-la solta o **Eye of the Herald** por 20s; alguém do time vencedor pode pegar, guardar por **240s** e invocar a Herald para empurrar rota e dar charge em estrutura. O summon pode ser “pilotado” e o charge causa muito dano em torre. citeturn13view3turn27view1 | + grande valor estrutural de mid game; + chance forte de first tower, mid tower ou quebrar outer+inner em sequência; + sinergia forte com lane prio, waves stacked e grubs. | citeturn13view3turn27view1 |
| Baron Nashor | Na SR normal/ranked, o Baron volta a nascer em **20:00**; respawn de **6:00**. A Riot explicitamente removeu Atakhan e devolveu o Baron para 20 minutos em 26.1. citeturn41view3turn42view3turn30view0 | **Nunca antes de 20:00**. Também não nasce enquanto o Baron anterior estiver vivo. citeturn41view3turn30view0 | Dá **Hand of Baron** por **180s** aos aliados vivos: AD/AP extra, recall fortalecido e aura que empodera minions. O buff é **perdido ao morrer**. citeturn30view0turn30view4turn30view3 | + maior salto de pressão de mapa no mid/late; + forte aumento da chance de derrubar inner/inhibitor; + grande buff de siege, mas não “fim automático”. Se o time conseguir Baron com pouca wave clear ou sem side pressure, o impacto deve ser menor. | citeturn30view0turn30view4turn30view3 |
| Atakhan | **Removido da SR** na 26.1; Riot disse que ele “não spawnará mais”. citeturn42view2turn42view3 | Sempre, no estado atual da SR normal/ranked. citeturn42view2 | Nenhum. Não usar. | Remover completamente da engine de SR. Não criar placeholder escondido, nem spawn raro. | citeturn42view2 |

Roubo de objetivo, no jogo real, só faz sentido quando há **tentativa ativa de um time** e **contestação do outro**. A Riot reforçou em 2026 que monstros épicos ficaram mais resistentes a dano físico/mágico, enquanto **Smite** e outras fontes de dano verdadeiro foram relativamente preservadas, elevando o peso do jungler; ao mesmo tempo, a própria Wiki destaca que dragões e outros objetivos costumam ser roubados por **Smite**, burst verdadeiro e colapso pela pit wall. Portanto, na sua engine, “steal” deve depender de **Smite tier**, burst finisher, visão/negação de visão, número de jogadores presentes, controle do choke, controle de wave e tempo de setup — nunca de um evento aleatório solto. citeturn16search0turn34view2turn15view3

## Taxonomia de eventos para a timeline

Antes da taxonomia, vale fixar quatro regras reais que devem contaminar toda a sua modelagem. **Base kill gold** padrão é **300**; multikills exigem kills em até **10 segundos** entre si, com extensão após quadra para possibilitar penta; um **ace** é matar o último campeão vivo do time inimigo; e as **objective bounties** só entram após **14:00** para o time atrás, com base em ouro/XP/dragões/torres. Além disso, os timers de morte crescem por **nível** e passam a escalar também com **tempo de jogo** a partir de 15 minutos, o que torna picks tardios e aces muito mais valiosos. citeturn18view0turn40view0

Abaixo está uma taxonomia recomendada para a engine. Os tempos são **faixas prováveis**, não timers rígidos.

### Eventos de early game

| Evento | Timer provável | Pré-condições | Protagonistas mais comuns | Atributos que aumentam chance | Impacto recomendado | Exemplo de ticker |
|---|---|---|---|---|---|---|
| First blood | 1:40–6:00 | lane trade all-in, invade, gank cedo, erro de posicionamento | JNG + solo lane; bot 2v2 | early power, engage, burst, CC, pathing | + ouro imediato; + momentum lane; + pressão para plate/gank chain | **Yampi abriu o placar em cima de Faker no mid.** |
| Kill normal | 1:30+ | alguém exposto, sem recurso, overpush, rotação | qualquer role | damage, CC, gap close, setup, visão | +300g base; + pressão local; + recall ruim do inimigo | **BrTT abateu Deft no bot.** |
| Morte de jogador | qualquer | consequência de kill, dive, fight, pickoff | qualquer | fragilidade, sem flash, sem ward | - presença no mapa; - prio; timer de morte cresce com nível/tempo | **Caps caiu no rio superior.** |
| Gank bem-sucedido | 2:30–12:00 | jungler consegue janela com lane em posição atacável | JNG, MID, SUP roam | jungle control, roam, CC chain, visão | + kill/flash burn; + plate; + setup de objetivo lado do mapa | **Canyon apareceu pelo tri-brush e garantiu o gank no bot.** |
| Solo kill | 2:00–14:00 | 1v1 de lane, erro mecânico, item spike local | TOP, MID, às vezes ADC | laning, matchup, burst, sustain, spacing | + ouro e xp concentrados; + pressão de wave e plate | **Zeus solou Bin no top.** |
| Dive | 3:30–16:00 | wave grande crashada, HP baixo, número favorável | JNG + solo lane; bot dives 3v2/4v2 | engage, tankiness, burst, minion wave, reset discipline | alto risco/alto retorno; se der certo gera placa/torre, se der errado devolve jogo | **Mikael mergulhou sob a torre e tirou Hans sama do mapa.** |
| Double kill | 2:00+ | duas kills em sequência curta | ADC, MID, assassin, jg | reset potential, burst, follow-up | salto forte de ouro e tempo de mapa | **Peyz encontrou o double kill na luta do rio.** |
| Triple/Quadra/Penta | 8:00+ mais comum | luta estendida com resets e cleanup | ADC, MID carry, assassin reset | teamfight, execute, chase, peel | explosão de ouro + moral + aceleração de fim | **Gumayusi limpou a fight com um TRIPLE KILL.** |
| Shutdown | 6:00+ | alvo com bounty positiva morre | qualquer carry que caia | contestação bem montada, pick, flank | comeback driver; aumentar bastante peso no time atrás | **Route encerrou a sequência de Chovy e coletou o shutdown.** |
| Dragão sem contestação | 5:00+ | bot/mid prio, jungler inimigo longe ou morto | JNG + BOT + MID | jungle control, bot prio, visão | + stack; + ameaça futura de soul; + acelera rota do jogo | **Kanavi garantiu o Dragão Infernal sem contestação.** |
| Luta pelo dragão | 5:00+ | dragão vivo, ambos próximos, visão disputada | JNG, MID, ADC, SUP | setup, engage, burst, Smite, posição | pode gerar kills + dragão + torre bot | **Os dois times colapsaram no pit para a primeira luta de dragão.** |
| Roubo de dragão | 5:00+ | um time está fazendo dragão e o outro contesta no pit | JNG principalmente; MID/ADC com burst | Smite, burst combo, acesso ao pit, visão negada | swing grande: negar stack + ganhar moral + muitas vezes virar fight | **Cuzz roubou o dragão de Oner no último instante.** |
| Larvas feitas | 5:00–13:45 | top/mid prio, jungler no lado superior, bot tradeado | JNG + TOP + MID | top prio, matchups de side, setup | + pressão estrutural futura; + vale mais em comp de push | **Jankos saiu do topo com três Larvas do Vazio.** |

### Eventos de mid game

| Evento | Timer provável | Pré-condições | Protagonistas mais comuns | Atributos que aumentam chance | Impacto recomendado | Exemplo de ticker |
|---|---|---|---|---|---|---|
| Arauto feito | 14:00–19:45 | prioridade top/mid, janela de reset boa, dragão trocado ou sem valor | JNG + TOP/MID | objective control, soloing speed, side prio | + grande ameaça estrutural | **Tarzan assegurou o Arauto do Vale.** |
| Arauto usado em torre | 14:20–23:00 | Eye disponível, wave preparada, lane aberta | quem pegou o Eye + lane com prio | push, wave stack, timing | + first tower ou quebra de outer/inner | **Bvoy invocou o Arauto no mid para abrir a rota.** |
| Torre derrubada | 5:00+ | plates acumuladas, push, Herald, ace local | qualquer lane, Herald | DPS em estrutura, wave state, grubs, overgrowth | + ouro, + mapa, + visão avançada | **A outer do bot caiu para o time azul.** |
| Primeira torre | 6:00–16:00 | domínio claro de uma rota ou uso eficiente de Herald | side dominante ou bot lane forte | siege, plates, Herald | +300g extra de first turret; + acelera rotações | **A primeira torre ficou com o time vermelho no top.** |
| Teamfight de mid game | 13:00–28:00 | dragão 2/3, Herald, pickoff, invade, mid prio | MID/ADC núcleo; JNG/SUP engajam | engage, peel, ult economy, visão | decide objetivo seguinte e 1-3 torres | **Explodiu a fight de cinco contra cinco no mid.** |
| Comeback fight | 14:00+ | time atrás contesta em número/ângulo melhor ou pega shutdown | time atrás | engage surpresa, flank, shutdown priority | + reduce gold diff; + pode ativar/consumir bounties | **Mesmo atrás, a equipe vermelha virou a luta no choke do rio.** |
| Baron fight | 20:00+ | Baron vivo, setup de visão, wave pressionada | JNG/MID/ADC com todo time | vision denial, pick, zone control, Smite | resultado mais explosivo do mid/late | **Os times se encaram no Nashor com tudo em jogo.** |
| Baron feito | 20:00+ | controle de rio/pit, inimigos mortos/longe, dano suficiente | JNG + DPS + setup | objective DPS, Smite, front line, zone | + maior aceleração de siege; + alta win probability, mas não 100% | **Wei confirmou o Baron Nashor para o time azul.** |
| Roubo de Baron | 20:00+ | tentativa ativa + contestação real | JNG; às vezes MID/ADC com burst | Smite tier, burst, acesso ao pit, mobility | um dos maiores swings da partida | **Closer roubou o Baron na cara do time vermelho.** |

### Eventos de late game

| Evento | Timer provável | Pré-condições | Protagonistas mais comuns | Atributos que aumentam chance | Impacto recomendado | Exemplo de ticker |
|---|---|---|---|---|---|---|
| Soul point tension | 18:00+ | um time está no 3º dragão | todo o time, especialmente JNG/MID/BOT | setup, reset efficiency, bot-side vision | eleva muito a chance de fight forçada | **Tudo aponta para a luta do soul point.** |
| Dragon Soul conquistada | 20:00–32:00 típico | time completa 4 dragões | time inteiro | controle de mapa contínuo | + salto grande de win probability | **A Alma Hextech está nas mãos do time azul.** |
| Elder fight | depois da alma | Elder vivo, ambos times com condição de contestar | todo time | visão, zone control, Smite, burst, engage | pode redefinir o jogo inteiro | **A próxima luta é pelo Elder Dragon.** |
| Elder feito | após alma | controle de área e execução do objetivo | JNG + carry DPS | Smite, front-to-back, zone | + capacidade de encerrar jogo em 1 push ou 1 fight | **Tian garantiu o Elder Dragon para o time vermelho.** |
| Inibidor derrubado | 18:00+ | inhibitor turret caiu, wave entrou | ADC/siege, side pusher, Baron holders | siege, super wave, Baron, grubs | + pressão permanente de lane até respawn do inibidor | **O inibidor do mid foi destruído.** |
| Nexus exposto | 18:00+ | dois Nexus turrets caíram e há lane aberta | todo time | siege contínuo, ace, wave control | estado crítico: fim pode acontecer no próximo wipe | **O Nexus inimigo está exposto.** |
| Ace | 15:00+ fica muito valioso | último inimigo vivo caiu | time inteiro | engage/cleanup, chase, timers altos | + janela de Baron/Elder/inibidor/Nexus | **ACE para o time azul.** |
| GG / fim de jogo | 18:00+ | Nexus vulnerável e destruído | time inteiro | tudo que levou à entrada final | fim da partida | **GG — o time vermelho destruiu o Nexus.** |

## Modelo de estado da partida

A sua engine precisa manter um **estado interno rico**, não só contadores. O núcleo mínimo deveria ser:

- **tempo de jogo** em segundos;
- **fase abstrata** da partida;
- **ouro total e ouro útil** por time;
- **kills, deaths, shutdown gold disponível e objective bounties prováveis**;
- **estado estrutural completo** por lane: outer, inner, inhibitor turret, inhibitor, Nexus turrets;
- **stacks de dragão**, tipo de soul em disputa, Elder disponível;
- **Voidgrubs por time**, número de stacks de Touch/Hunger of the Void;
- **Rift Herald**: vivo, abatido, Eye em posse, usado, lane do summon;
- **Baron**: vivo, no pit, em tentativa, buff holders vivos;
- **pressão por rota**;
- **visão/controle de mapa** por quadrante;
- **estado de wave** por rota;
- **timers de morte** individuais;
- **spikes de role/champion**: early, skirmish, teamfight, side lane, scaling, objective secure;
- **momento psicológico/momentum** do time para capturar “o time puxou o jogo” sem virar determinismo.

Essa modelagem conversa muito bem com o estado atual do SR. A Riot empurrou 2026 para valorizar **pushing**, **plates permanentes em torres não-Nexus**, **Faelights/visão**, **quest agency por role** e **contestação de monstros épicos mais dependente de jungler, Smite e lane priority**. Também reforçou papéis por posição: top ganhou mais agência e side influence; jungle ficou mais forte em objetivo/Smite; mid é uma role de dano/rotação; bot é o grande carregador de ouro; support ganhou ainda mais ferramentas de visão e control ward. citeturn41view2turn41view3turn34view0turn34view1turn34view2turn34view3turn20view3

### Como eu modelaria pressão de rota

Use uma variável contínua por lane, por exemplo **-100 a +100**.

A pressão de uma rota em cada tick pode ser calculada como:

```text
lanePressure[lane] =
  laningAdvantage
+ waveStateBonus
+ nearbyNumbers
+ visionEdgeNearLane
+ objectiveThreatSameSide
+ sideLanerQuality
- deadPlayerPenalty
- forcedRecallPenalty
```

Regras práticas:

- **top forte** aumenta mais a pressão de **top lane e side lane longa**;
- **support roam** altera principalmente **bot -> mid/dragon**;
- **jungler forte** amplifica pressão nos dois lados do mapa, mas mais no lado onde está posicionado;
- **Baron buff** aumenta pressão em lane com wave viva;
- **Voidgrubs** aumentam a eficiência estrutural da pressão;
- **inibidor inimigo já quebrado** gera pressão automática naquela lane.

### Como eu modelaria visão e controle de mapa

Não tente simular ward individual por coordenada se o foco é diversão crível. Use **regiões**:

- top river / herald side
- bot river / dragon side
- blue topside jungle
- red topside jungle
- blue botside jungle
- red botside jungle
- mid corridor

Cada região pode ter:

```text
visionScore[team][region] = wards + controlWards + prio + faelightControl - enemySweepPressure
```

Com isso você consegue governar:

- chance de **gank**;
- chance de **pickoff**;
- chance de **steal**;
- chance de objetivo ser **sem contestação**;
- chance de fight começar em posição boa ou ruim.

### Como eu modelaria poder por contexto

Em vez de um “overall de jogador”, use **power slices**:

- `laning`
- `roam`
- `skirmish`
- `teamfight`
- `pick`
- `peel`
- `engage`
- `siege`
- `sidelane`
- `objectiveDps`
- `objectiveSecure`
- `vision`
- `consistency`
- `clutch`
- `scaling`

Depois pese diferente por contexto:

- **gank**: jungle + roam + CC + burst + visão;
- **dragão**: jungle secure + bot/mid prio + teamfight curto;
- **Voidgrubs/Herald**: jungle secure + top/mid prio + side pressure;
- **Baron**: Smite secure + zone control + DPS + visão;
- **late teamfight**: ADC + MID + engage/peel + front line;
- **split push**: TOP + sidelaning + structural DPS + TP-like agency.

Isso deixa a simulação mais fiel ao jogo real e muito mais divertida do que “stat total”.

## Algoritmo de simulação proposto

O melhor formato aqui é uma **timeline por ticks curtos**, com resolução em camadas.

### Loop principal

Eu recomendo ticks de **10 a 20 segundos**. Em cada tick:

1. **Atualize tempo e disponibilidade de objetivos**
   - spawn/respawn dos objetivos;
   - timers de morte;
   - respawn de inibidor;
   - buff durations.

2. **Recalcule estado derivado**
   - pressão de rota;
   - visão por região;
   - liderança real;
   - threat de soul;
   - threat de Baron/Elder;
   - janelas de dive e pickoff.

3. **Cada time escolhe uma macro-intenção**
   - farm/reset;
   - pressionar top;
   - pressionar bot;
   - colapsar mid;
   - invadir selva;
   - gankar;
   - setupar dragão;
   - setupar grubs/Herald;
   - começar Baron;
   - forçar fight;
   - segurar mapa.

4. **Resolva interação entre intenções**
   - se ambos querem o mesmo objetivo, há disputa;
   - se um quer objetivo e outro quer trocar na side oposta, gera cross-map;
   - se um quer reset e outro quer pickoff, pode sair catch;
   - se um pressiona side e outro responde mal, torre/inibidor caem.

5. **Resolva o evento**
   - usa pesos do contexto + ruído controlado;
   - atualiza ouro/XP/estruturas/buffs;
   - grava ticker;
   - recalcula win probability.

### Regras duras que a engine deve obedecer

Estas regras não podem ser “quebradas por sorte”:

- **Baron nunca antes de 20:00**. citeturn41view3turn42view3
- **Elder nunca antes de existir alma**. citeturn13view4turn33view0
- **Rift Herald só 14:00–19:45/19:55**. citeturn13view3
- **Voidgrubs só até 13:45/13:55** e a segunda leva só existe se a primeira foi limpa cedo o bastante. citeturn37view2
- **Objetivo só pode ser roubado se houver tentativa ativa de outro time e contestação**. citeturn15view3turn16search0
- **Baron/Elder buff entram só para aliados vivos e são perdidos na morte**. citeturn30view0turn30view3turn33view0
- **First Blood dá +100g** e **first turret +300g**; portanto, esses eventos têm peso real e devem aparecer com impacto relevante. citeturn42view0turn42view1

### Como escolher a macro-intenção de cada time

Em vez de sortear evento direto, sorteie primeiro a **intenção** com base no estado:

```text
if objectiveAliveSoon and teamHasPriorityOnThatSide:
    increase chance of "setup objective"

if teamAhead and outerTowersDown and baronAlive:
    increase chance of "baron setup" and "pick around vision"

if teamHasHeraldEye and laneHasStackedWave:
    increase chance of "use herald"

if teamBehind and shutdownsAvailable:
    increase chance of "pick" and "crossmap trade"

if teamHasBaron:
    increase chance of "1-3-1 / siege"
```

### Como resolver lutas

Se houver luta, não faça um coinflip puro. Resolva com um score contextual:

```text
fightScore =
  teamfightPower
+ engageQuality
+ peelQuality
+ visionEdge
+ nearbyNumbers
+ objectiveBuffs
+ baronOrElderBuff
+ dragonSoul
+ momentum
+ clutchNoise
```

Depois traduza o resultado em um dos desfechos:

- pick isolado;
- trade 1 por 1;
- win curto;
- wipe parcial;
- ace.

A grande sacada é fazer o **tamanho do ganho** depender do momento do jogo. Aos 6 minutos, uma kill vale wave, reset ruim, plate. Aos 32 minutos, a mesma pick pode valer Baron, inibidor ou o Nexus.

### Como calcular objetivos

Para cada objetivo, recomendo duas fases:

**Fase de acesso**
- o time consegue chegar no objetivo com visão e prioridade?

**Fase de execução**
- dado que começou, ele finaliza limpo, toma contestação, ou é roubado?

Um score útil:

```text
objectiveTakeScore =
  objectiveDps
+ objectiveSecure
+ nearbyPriority
+ zoneControl
+ visionControl
- enemyContestThreat
```

Se o objetivo entra em faixa de execução e ambos estão presentes, resolva um **secure contest**:

```text
secureScore =
  junglerSmiteTier
+ objectiveSecure
+ burstWindow
+ pitAccess
+ visionDenial
+ clutch
```

Isso é bem mais fiel ao LoL real do que “chance fixa de roubo = 20%”.

### Como calcular win probability

Não recomendo uma regra “quem passou de 60% de chance ganhou”. Use isso só como **indicador**, não como determinismo.

Uma fórmula razoável:

```text
winProb(team) = sigmoid(
  goldDiff * 0.00018
+ xpDiff * 0.00010
+ towerDiff * 0.18
+ inhibitorDiff * 0.40
+ dragonStackDiff * 0.10
+ hasSoul * 0.55
+ aliveBaronBuffHolders * 0.08
+ aliveElderBuffHolders * 0.18
+ visionControlDiff * 0.06
+ scalingFutureEdge * 0.10
+ deathTimerEdge * 0.12
)
```

O ponto é: **Soul, Baron e Elder pesam muito**, mas não fecham sozinhos. Gold e torres importam muito. Scaling futuro importa. Um time atrás com 3 itens em carry e janela de Elder precisa seguir vivo no sistema.

## Regras de draft para corrigir seu app

O draft precisa parecer uma **nova rodada real**, não um carrossel estático.

### Regras funcionais

Quando o usuário escolhe um jogador em uma rodada, **todos os outros candidatos não escolhidos daquela rodada devem sair de circulação imediata para o usuário**. A rodada seguinte sempre precisa ser montada com **novos candidatos**, para dar sensação de avanço e decisão irreversível.

Se o usuário escolheu uma **versão** de uma pessoa — por exemplo, “Faker 2017 agressivo” — então **nenhuma outra versão dessa mesma pessoa pode voltar a aparecer para aquele usuário**. O ideal é controlar isso por `personId`, não por `cardId`.

Se o seu jogo permitir, **outros times ainda podem draftar outra versão da mesma pessoa**, desde que isso seja uma regra assumida do modo. Nesse caso, deixe a regra clara no onboarding: “você não pode repetir a pessoa no seu time; adversários podem ter outra versão”.

O usuário **não deveria ver stats completos antes de escolher**. Antes da pick, mostre só:

- posição principal;
- 2–4 tags;
- ano/fase;
- estilo;
- descrição curta;
- talvez uma “assinatura” vaga, tipo “forte em teamfight” ou “mestre em rota lateral”.

Depois da escolha, revele o pacote completo.

### Fluxo de implementação recomendado

1. Defina um `eligiblePool` por rodada com filtros:
   - não escolhido pelo usuário;
   - `personId` não presente no time do usuário;
   - posição compatível com vaga atual;
   - raridade/potência balanceadas.

2. Gere `N` candidatos novos para a rodada.

3. Ao escolher:
   - fixa a carta escolhida no slot;
   - remove do pool do usuário todos os cards com o mesmo `personId`;
   - descarta os demais cards daquela rodada;
   - gera nova rodada do zero.

4. Mantenha um `seenThisSession` se você quiser evitar repetição visual excessiva até como “quase saiu de novo o mesmo cara”.

Isso sozinho já melhora muito a sensação de draft.

## Estruturas TypeScript e exemplos de timelines

### Estruturas de dados sugeridas

```ts
type TeamId = "BLUE" | "RED";
type Role = "TOP" | "JNG" | "MID" | "ADC" | "SUP";
type Lane = "TOP" | "MID" | "BOT";
type Phase = "EARLY" | "MID" | "LATE";
type ObjectiveKind =
  | "DRAGON"
  | "ELDER"
  | "VOIDGRUBS"
  | "RIFT_HERALD"
  | "BARON";
type EventType =
  | "FIRST_BLOOD"
  | "KILL"
  | "DEATH"
  | "DOUBLE_KILL"
  | "TRIPLE_KILL"
  | "QUADRA_KILL"
  | "PENTAKILL"
  | "SHUTDOWN"
  | "GANK_SUCCESS"
  | "DIVE"
  | "SOLO_KILL"
  | "DRAGON_TAKEN"
  | "DRAGON_STOLEN"
  | "DRAGON_FIGHT"
  | "VOIDGRUBS_TAKEN"
  | "HERALD_TAKEN"
  | "HERALD_USED"
  | "BARON_TAKEN"
  | "BARON_STOLEN"
  | "BARON_FIGHT"
  | "TURRET_DESTROYED"
  | "FIRST_TURRET"
  | "INHIBITOR_DESTROYED"
  | "NEXUS_EXPOSED"
  | "COMEBACK_FIGHT"
  | "ACE"
  | "GAME_END";

interface PublicHints {
  position: Role;
  year?: number;
  tags: string[];
  style: string;
  shortDescription: string;
}

interface HiddenRatings {
  laning: number;          // 0-100
  roam: number;
  skirmish: number;
  teamfight: number;
  engage: number;
  peel: number;
  siege: number;
  sidelane: number;
  scaling: number;
  vision: number;
  objectiveDps: number;
  objectiveSecure: number;
  consistency: number;
  clutch: number;
}

interface Player {
  cardId: string;
  personId: string;        // dedupe por pessoa
  displayName: string;
  versionName: string;     // ex.: "2017 carry", "2023 weakside"
  primaryRole: Role;
  secondaryRoles?: Role[];
  publicHints: PublicHints;
  ratings: HiddenRatings;
}

interface DeathState {
  isDead: boolean;
  respawnAtSec: number | null;
}

interface PlayerMatchState {
  player: Player;
  role: Role;
  level: number;
  goldEarned: number;
  kills: number;
  deaths: number;
  assists: number;
  csScore: number;
  shutdownGold: number;
  currentForm: {
    earlyPower: number;
    currentPower: number;
    fatigue: number;       // opcional, para consistência de performance
    confidence: number;    // momentum individual
  };
  buffs: {
    baron: boolean;
    elder: boolean;
  };
  death: DeathState;
}

interface LaneStructureState {
  outerAlive: boolean;
  innerAlive: boolean;
  inhibitorTurretAlive: boolean;
  inhibitorAlive: boolean;
  inhibitorRespawnAtSec: number | null;
}

interface TeamState {
  teamId: TeamId;
  name: string;
  players: Record<Role, PlayerMatchState>;

  gold: number;
  kills: number;
  deaths: number;
  assists: number;

  towersDestroyed: number;
  inhibitorsDestroyed: number;

  dragons: number;
  dragonSoul: null | "CHEMTECH" | "CLOUD" | "HEXTECH" | "INFERNAL" | "MOUNTAIN" | "OCEAN";
  elderTakenCount: number;

  voidgrubsKilled: number; // 0..6
  heraldTaken: boolean;
  heraldEyeHolderRole: Role | null;
  heraldSummoned: boolean;

  baronBuffHolders: Role[];

  lanePressure: Record<Lane, number>;   // -100..100
  laneWaveState: Record<Lane, number>;  // -100..100
  visionControl: {
    topRiver: number;
    botRiver: number;
    topJungle: number;
    botJungle: number;
    midCorridor: number;
  };

  macro: {
    tempo: number;
    setupQuality: number;
    pickThreat: number;
    teamfightThreat: number;
    siegeThreat: number;
    splitPushThreat: number;
  };

  structures: Record<Lane, LaneStructureState>;
  nexusTurretsAlive: number; // 0, 1, 2
  nexusExposed: boolean;
}

interface ObjectiveWindow {
  kind: ObjectiveKind;
  alive: boolean;
  availableAtSec: number | null;
  despawnAtSec: number | null;
  respawnAtSec: number | null;
  inProgressBy: TeamId | null;
  contesting: boolean;
}

interface ObjectiveState {
  currentDragonElement: null | "CHEMTECH" | "CLOUD" | "HEXTECH" | "INFERNAL" | "MOUNTAIN" | "OCEAN";
  nextDragonSpawnAtSec: number | null;
  elderSpawnAtSec: number | null;

  voidgrubs: ObjectiveWindow;
  herald: ObjectiveWindow;
  baron: ObjectiveWindow;
  dragon: ObjectiveWindow;
  elder: ObjectiveWindow;
}

interface EventImpact {
  goldDelta: Partial<Record<TeamId, number>>;
  objectiveDelta?: string[];
  structureDelta?: string[];
  pressureDelta?: Partial<Record<TeamId, Partial<Record<Lane, number>>>>;
  winProbabilityDelta?: Partial<Record<TeamId, number>>;
}

interface Event {
  id: string;
  timeSec: number;
  type: EventType;
  teamId: TeamId | null;
  actors: string[];     // nomes dos protagonistas
  victims?: string[];
  lane?: Lane | "RIVER_TOP" | "RIVER_BOT" | "TOP_JG" | "BOT_JG" | "BASE";
  objectiveKind?: ObjectiveKind;
  stolen?: boolean;
  contested?: boolean;
  description: string;
  ticker: string;
  impact: EventImpact;
}

interface MatchState {
  patch: string; // ex.: "26.13 baseline with 26.1 SR systems"
  queueType: "NORMAL_DRAFT" | "RANKED_SOLO_DUO" | "RANKED_FLEX" | "CUSTOM_SIM";
  gameTimeSec: number;
  phase: Phase;

  blue: TeamState;
  red: TeamState;
  objectives: ObjectiveState;

  firstBloodTaken: boolean;
  firstTurretTaken: boolean;

  winProbability: Record<TeamId, number>;
  momentum: Record<TeamId, number>; // -100..100
  timeline: Event[];

  config: {
    tickSeconds: number;
    comebackElasticity: number;
    upsetNoise: number;
    objectiveThrowChance: number;
  };
}
```

### Timeline de exemplo para um stomp rápido

| Tempo | Evento | Ticker |
|---|---|---|
| 2:20 | gank top bem-sucedido | **Canyon apareceu no top e Zeus saiu com o First Blood sobre Doran.** |
| 4:40 | solo kill mid | **Chovy vence o 1v1 e solou Scout no meio.** |
| 5:35 | dragão sem contestação | **Peanut garantiu o primeiro dragão sem resposta.** |
| 6:50 | dive bot 4v2 | **A lane inferior foi mergulhada — double kill para Viper.** |
| 8:10 | primeira torre bot | **A primeira torre do jogo caiu no bot para o time azul.** |
| 9:15 | Voidgrubs 3/3 | **O lado azul limpou as Larvas e agora pressiona melhor as estruturas.** |
| 12:20 | segunda torre no bot side | **A rota inferior já foi aberta até a inner.** |
| 14:40 | Herald feito | **O Arauto do Vale está nas mãos do time azul.** |
| 15:25 | Herald no mid | **O Arauto colidiu no mid e rachou a defesa vermelha.** |
| 16:10 | segundo dragão | **Soul point começa a entrar no radar do azul.** |
| 19:00 | ace no rio inferior | **ACE para o time azul após a fight do terceiro dragão.** |
| 20:10 | terceiro dragão | **Agora é soul point para o próximo spawn.** |
| 22:40 | fight curta + alma | **O time azul venceu a luta e conquistou a Alma Infernal.** |
| 24:15 | inibidor mid | **O inibidor do meio foi destruído.** |
| 25:05 | fim | **GG — o time azul destruiu o Nexus vermelho aos 25 minutos.** |

**Leitura de engine:** jogo decidido por **lane dominance -> first turret -> grubs -> Herald -> soul point -> alma -> inibidor -> fim**. Não precisa de Baron para todo stomp ficar crível.

### Timeline de exemplo para um jogo equilibrado

| Tempo | Evento | Ticker |
|---|---|---|
| 3:10 | first blood bot | **Elk abriu o placar na troca 2v2 do bot.** |
| 5:25 | primeiro dragão azul | **O primeiro dragão ficou com o lado azul.** |
| 7:40 | resposta top | **Bin devolveu com uma solo kill no topo.** |
| 9:20 | Voidgrubs vermelhas | **O lado vermelho saiu com as Larvas do topo.** |
| 11:05 | primeira torre azul no bot | **A primeira torre ficou com o azul na parte inferior.** |
| 14:30 | Herald vermelho | **O Arauto do Vale foi assegurado pelo vermelho.** |
| 16:00 | segundo dragão vermelho | **Tudo igualado em dragões: 1 a 1.** |
| 17:20 | Herald no mid | **O Arauto abriu espaço no meio para o time vermelho.** |
| 21:10 | terceiro dragão azul | **O azul chega a 2 dragões e ameaça soul point.** |
| 24:40 | fight no mid, 2 por 2 | **Ninguém descola: troca de dois por dois no corredor central.** |
| 26:30 | quarto dragão vermelho/deny | **O vermelho impede o soul point e empata o mapa.** |
| 28:10 | pickoff em support | **O support azul foi pego entrando cego no rio.** |
| 28:45 | Baron vermelho | **Com vantagem numérica, o vermelho confirmou o Baron.** |
| 30:20 | duas inner turrets | **O Baron virou ouro estrutural, não o fim da partida.** |
| 32:15 | fight de defesa azul | **O azul segurou a base e tirou três buffs de Baron.** |
| 34:10 | dragão azul | **Agora é soul point azul de novo.** |
| 36:00 | fight decisiva | **O ADC azul sobreviveu à engage e virou a teamfight.** |
| 36:50 | Elder ainda não existe; push final | **Sem Elder no jogo, o azul corre pelo mid para encerrar.** |
| 37:20 | fim | **GG — depois de 37 minutos, o azul fecha a série de lutas no Nexus.** |

**Leitura de engine:** este é o jogo em que o estado importa mais do que o ouro bruto. Baron gera pressão, mas defesa boa segura. O valor vem de **timers de morte, wave state e qualidade de siege**.

### Timeline de exemplo para um comeback com roubo de Baron e Elder

| Tempo | Evento | Ticker |
|---|---|---|
| 4:00 | first blood vermelho | **O primeiro abate ficou com o vermelho no topo.** |
| 5:20 | primeiro dragão vermelho | **O lado vermelho começou acelerando o mapa inferior.** |
| 9:00 | Voidgrubs vermelhas | **As Larvas do Vazio também ficaram com o vermelho.** |
| 12:30 | primeira torre vermelha | **O vermelho já abriu a primeira torre e empilhou vantagem.** |
| 16:10 | segundo dragão vermelho | **Soul point futuro começa a ameaçar o azul.** |
| 18:20 | Herald vermelho usado no mid | **O Arauto rasgou a defesa central do azul.** |
| 21:30 | terceiro dragão vermelho | **É soul point para o próximo dragão.** |
| 24:50 | shutdown em carry vermelho | **Mesmo atrás, o azul encontrou o shutdown no carry adversário.** |
| 27:10 | vermelho inicia Baron | **Com mapa aberto, o vermelho chamou o Baron Nashor.** |
| 27:18 | fight caótica no pit | **O azul entra tarde, mas entra inteiro pelo choke.** |
| 27:22 | roubo de Baron azul | **Oner ROUBOU o Baron Nashor!** |
| 29:00 | Baron defensivo | **O azul não derruba base, mas recupera visão e ouro de mapa.** |
| 31:40 | quarto dragão vermelho = alma | **Apesar do roubo do Baron, a Alma fica com o vermelho.** |
| 36:05 | Elder nasce e ambos setam visão | **Tudo converge para o pit do Elder Dragon.** |
| 36:35 | vermelho começa Elder | **O vermelho tenta fechar a partida pelo execute.** |
| 36:39 | roubo de Elder azul | **TitaN entrou no pit com burst e o azul roubou o Elder!** |
| 36:50 | comeback fight | **Com o Elder na mão, o azul vence a luta mais importante do jogo.** |
| 37:40 | mid + inibidor | **O corredor central caiu inteiro para o time azul.** |
| 38:20 | Nexus exposto | **As torres do Nexus já não seguram mais.** |
| 38:45 | fim | **GG — que virada: o azul saiu do quase perdido para destruir o Nexus.** |

**Leitura de engine:** esse é exatamente o tipo de partida que o seu simulador precisa preservar. O time atrás não vence “apesar do estado”; ele vence porque o estado deixou um **caminho estreito, mas real**, de shutdown -> Baron steal -> segurar soul -> Elder steal -> fight -> fim.

### Mensagens de ticker que soam mais LoL e sempre mostram quem fez o quê

Prefira sempre o formato **[quem] + [verbo] + [o quê] + [em quem/onde]**.

Boas estruturas:

- **Faker abriu o placar sobre Scout no mid.**
- **Canyon apareceu pelo topo e o gank encaixou.**
- **Viper venceu o 2v2 e saiu com o double kill.**
- **Bin solou Zeus na side superior.**
- **Peanut garantiu o Dragão Hextech sem contestação.**
- **Oner roubou o dragão na cara do time vermelho.**
- **Jankos limpou as Larvas do Vazio e aumentou a pressão estrutural do azul.**
- **Tarzan assegurou o Arauto do Vale.**
- **O Arauto foi invocado no meio por Caps.**
- **A primeira torre do jogo caiu para o time azul no bot.**
- **O inibidor do mid foi destruído por Gumayusi.**
- **Wei confirmou o Baron Nashor para o vermelho.**
- **Cuzz roubou o Baron Nashor no último instante.**
- **O time azul venceu a luta do soul point.**
- **A Alma Infernal ficou com o lado vermelho.**
- **Tian garantiu o Elder Dragon.**
- **Mesmo atrás, o time azul virou a luta no choke do rio.**
- **ACE para o time vermelho.**
- **O Nexus inimigo está exposto.**
- **GG — o time azul destruiu o Nexus vermelho.**

Uma regra boa de UX: o ticker curto vai para a timeline; a descrição longa pode virar tooltip ou card expandido.

## Limitações abertas

Alguns detalhes de **ouro e experiência exatos** de monstros épicos aparecem de forma mais consistente na Wiki do que nas patch notes da Riot; por isso, para a engine, eu recomendo tratar esses valores como **pesos relativos de impacto** em vez de tentar reproduzir números exatos em todos os casos. Já os pontos realmente críticos para fidelidade — **timers, disponibilidade, ordem dos objetivos, buffs principais, perda de Baron/Elder na morte, retirada do Atakhan e retorno do Baron a 20:00** — estão suficientemente claros e bem sustentados pelas fontes usadas aqui. citeturn42view3turn30view0turn30view3turn33view0turn37view2

Se eu tivesse que resumir tudo em uma única diretriz de produto: **faça a partida andar por pressão, setup e conversão de vantagem**, não por RNG de evento. É isso que vai fazer o “LoL 7 a 0” parecer uma partida de LoL — e não só uma sequência de notificações.