# Pesquisa 2 — Realismo micro da engine de LoL 7 a 0

## Resumo executivo

O salto de realismo que falta na sua engine não está mais em timers de mapa; está em **quem recebe recursos, quem converte recurso em pressão, quem morre primeiro em cada contexto, quem finaliza as kills e como draft, lane state e visão alteram essas probabilidades ao longo do tempo**. Em LoL real, raw RNG quase nunca “cria” um evento importante do nada: o estado anterior do jogo empurra o próximo evento para certos agentes, certas lanes e certos tipos de luta. Isso combina bem com a filosofia da sua engine state-driven e também com a forma como Riot modela win probability para o broadcast competitivo, que considera tempo, diferença de ouro, XP, jogadores vivos, torres, dragões, inibidores e buffs ativos, em vez de tratar todos os estados como equivalentes. citeturn15search6turn24view0turn13search16

Os padrões mais estáveis que aparecem nas fontes são estes: **support** tende a ter a maior participação em kills e o menor volume de abates; **jungle** tende a participar muito no early/mid, mas nem sempre é o finalizador; **mid** é o carry mais “elástico”, podendo ser o maior gerador de picks, roams e solo kills; **ADC** cresce como finalizador conforme o jogo se alonga e o ouro se converte em DPS estável; **top** é a role mais volátil, porque alterna entre weakside de absorção, split push, front line de engage e carry de 1v1/side lane dependendo do pick e do plano do time. Em outras palavras: o simulador precisa modelar **role, champion archetype e game context** separadamente. citeturn12view0turn41search6turn48view0turn32view0turn46view0

O segundo ponto crítico é economia. Em pro, análises baseadas nos dados do Oracle’s Elixir mostram que atravessar cerca de **+1k de ouro cedo** já empurra a probabilidade de vitória acima de 60%, enquanto leads maiores se tornam rapidamente esmagadores; o modelo Early Game Rating do Oracle’s Elixir também estimou que **+1.000 gold aos 15:00** implica algo perto de **64% de chance de vitória**, e **+2.500** sobe para **81%**, tudo o mais constante. Ao mesmo tempo, Riot vem usando bounty systems mais agressivos como mecanismo de comeback, ampliando o retorno de shutdowns e objective bounties para o time atrás. Isso significa que sua engine deve tratar ouro como vantagem forte, porém **não linear**, e precisa diferenciar **ouro espalhado** de **ouro concentrado em roles que escalam melhor com itens**. citeturn15search4turn24view0turn34search4turn34search1turn34search21

A recomendação central desta pesquisa é implementar quatro camadas novas. Primeiro, **priors por role** para kill share, death share, assist share e KP, com modificadores por fase, comp e archetype. Segundo, **estado persistente por lane**, com `csDiff`, `xpDiff`, `plateGold`, `resetAdvantage`, `laneVolatility`, `weakside/strongside` e `jungleAttentionReceived`, para impedir que a pressão seja recalculada “do zero” a cada tick. Terceiro, **camada de champion archetypes** baseada em classe primária, forma de luta, perfil econômico e perfil de mapa. Quarto, **effectiveGoldPower** individual e em time, com elasticidade diferente por role e bônus discretos por spike de item/nível. citeturn44search0turn29search2turn19search16turn21search5turn20search1turn20search15turn46view0

## O que os dados sugerem sobre roles, placar e economia

### Roles, kills, deaths, assists e participação

Em solo queue de elo alto, um dos poucos datasets grandes que separa KP por role mostrou um ordering muito consistente: **support com a maior kill participation**, depois **jungle**, depois **mid e marksman muito próximos**, e **top** por último. No recorte de Challenger daquele estudo, top ficou perto de **46,6%**, jungle perto de **56,1%**, mid perto de **52,5%**, marksman perto de **52,5%** e support perto de **57,9%**. O estudo é antigo, de patches 5.x em NA, então os números absolutos não devem ser copiados literalmente para 2026; ainda assim, a **ordem estrutural entre roles** continua útil, especialmente porque conversa bem com fontes mais recentes de pro play e com guias contemporâneos de macro. citeturn12view0turn41search6

No competitivo atual, o padrão é ainda mais forte para supports como **criadores de assistência** e mais concentrado para **ADC e mid como finalizadores**. Em amostras de LCK 2025 listadas pelo Games of Legends, supports como **Keria** e **Kellin** aparecem com cerca de **0,7 kill por jogo**, mas algo como **11,1** e **9,2 assists por jogo**, enquanto ADCs como **Gumayusi**, **Viper** e **Aiming** aparecem na faixa de aproximadamente **4,2–4,9 kills** e **6,4–6,8 assists** por jogo; mids como **Faker** e **Zeka** ficam perto de **3,3–4,2 kills** e **6,3–6,7 assists**; junglers como **GIDEON** por volta de **3,0 kills** e **7,5 assists**; tops como **Doran**, **Kiin** e **Zeus** perto de **3,4–4,2 kills** e **5,9–6,8 assists**. Isso não prova um “share” exato, mas mostra a estrutura: support quase nunca finaliza muito, jungle participa, e os maiores volumes de kill saem de ADC/mid com top variando bastante por pick e plano. citeturn39view0turn39view1turn39view3

Outros sinais atuais reforçam isso. No MSI 2025, os maiores KDAs listados pelo Games of Legends foram majoritariamente de ADCs; o support **Keria** aparece como exceção de elite, mas com uma linha que diz muito sobre a role: **19/55/255**, enquanto ADCs como **Gumayusi**, **Doggo** e **Ruler** acumulam volumes de kill muito maiores. No Worlds 2025 Main Event, o leaderboard de multikills foi dominado por **Gumayusi, deokdam, Viper e Doggo**, todos ADCs, o que é um excelente proxy para o comportamento do late game: quando a luta se estende e há front line suficiente, o marksman limpa a fight com muito mais frequência do que jungle ou support. citeturn28search5turn26view0

Em paralelo, estudos exploratórios sobre dados profissionais mostram que bot e mid tendem a aparecer como roles com mais jogos de “high-kill”, supports concentram assists e pouca kill, e jungle fica no meio-termo entre criador e finalizador. Um projeto recente de análise de roles em dados competitivos resumiu isso de forma bem compatível com o que se vê a olho nu: bot e mid concentram mais kills, support concentra assists, top tem mais jogos de zero kills do que mid/bot e jungle fica entre mid e top em potencial de kill. Também mostrou algo muito importante para a sua engine: **bot e mid têm mais DPS e tomam relativamente menos dano, enquanto top e jungle absorvem muito mais dano**. citeturn48view0

A tabela abaixo é uma **síntese operacional** dessas fontes. Ela não é um dado bruto oficial; é um conjunto de **priors iniciais recomendados** para engine, a ser modulado por archetype, estágio do jogo e estado do mapa. Em solo queue, assuma mais ruído e mais distribuição de kills entre jungle/mid/top; em competitivo, assuma mais concentração em ADC/mid e supports com kill share realmente baixo. citeturn12view0turn41search6turn39view0turn39view3turn48view0turn26view0

| Contexto | Top | Jungle | Mid | ADC | Support |
|---|---:|---:|---:|---:|---:|
| **Kill share base solo queue equilibrado** | 0.17 | 0.22 | 0.25 | 0.25 | 0.11 |
| **Kill share base competitivo equilibrado** | 0.16 | 0.21 | 0.26 | 0.31 | 0.06 |
| **Kill share late game com front-to-back** | 0.13 | 0.16 | 0.24 | 0.36 | 0.11 |
| **Kill share early game com skirmish/roam** | 0.17 | 0.25 | 0.28 | 0.21 | 0.09 |
| **Death share base equilibrado** | 0.22 | 0.20 | 0.18 | 0.17 | 0.23 |
| **KP esperado solo queue alto elo** | 0.45–0.52 | 0.53–0.65 | 0.50–0.62 | 0.48–0.60 | 0.55–0.70 |
| **KP esperado competitivo** | 0.50–0.60 | 0.60–0.75 | 0.58–0.72 | 0.58–0.70 | 0.65–0.80 |
| **Assist bias relativo** | médio-baixo | alto | médio | médio | muito alto |

As exceções que mais importam para engine são bem claras. **Supports de dano** — Brand, Swain, Lux, Vel’Koz, Pantheon e parecidos — desviam do padrão e podem encerrar jogos com kill share muito acima do normal; isso é coerente com o fato de esses picks existirem e performarem no role hoje em sites estatísticos correntes como Lolalytics. Ao mesmo tempo, guias e taxonomias de support continuam separando supports de **engage/aggressive**, **utility/enchanter** e **sustain/peel**, exatamente porque a função real muda muito de um pick para outro. citeturn18search1turn18search3turn18search9turn18search13turn18search18turn46view0

Para seleção de killer por contexto, os pesos abaixo funcionam bem como ponto de partida, sempre depois de aplicar os modificadores de champion archetype e estado individual. Eles refletem o fato de que **ADC limpa teamfight**, **mid e jungle geram pick/skirmish**, **top finaliza mais quando é carry/diver/split push**, e **support só finaliza com frequência em picks de dano ou em execuções de engage bem-sucedidas**. citeturn46view0turn22search10turn32view0turn26view0

| Evento | Top | Jungle | Mid | ADC | Support |
|---|---:|---:|---:|---:|---:|
| **2v2 / 3v3 early** | 1.00 | 1.20 | 1.20 | 0.95 | 0.55 |
| **Pickoff** | 0.95 | 1.15 | 1.25 | 0.80 | 0.60 |
| **Dive** | 1.05 | 1.15 | 1.00 | 0.80 | 0.65 |
| **Teamfight front-to-back** | 0.85 | 0.90 | 1.10 | 1.35 | 0.45 |
| **Cleanup chase** | 0.90 | 1.00 | 1.15 | 1.30 | 0.40 |
| **Side lane 1v1** | 1.25 | 0.60 | 1.10 | 0.40 | 0.10 |

Ajustes por archetype devem ser simples e fortes. **Mid assassin**: `+0.25` em pickoff, `+0.10` em skirmish, `-0.10` em front-to-back. **Control mage**: `+0.15` em siege/teamfight, `-0.15` em solo pick. **Hypercarry ADC**: `+0.20` no late front-to-back, `-0.10` no early. **Lane bully ADC**: `+0.10` no 2v2 bot e `+0.05` em first tower pressure. **Tank jungle**: `-0.15` em killer chance e `+0.20` em assist chance. **Carry jungle**: `+0.15` em skirmish/pick, `+0.10` em snowball. **Engage support**: `+0.10` em initiation, `+0.15` em death risk pós-engage, `-0.15` em finalização. **Poke/mage support**: `+0.15` em kills de siege/pick e `-0.05` em peel. **Top tank weakside**: `-0.10` em kill chance e `+0.15` em death risk. **Top split carry**: `+0.20` em side-lane kill chance e `+0.20` em death risk quando isolado. Esses desvios são exatamente o tipo de modulação que os dados de role, os guias de team comp e as descrições de classes suportam melhor do que um modelo puramente “overall”. citeturn46view0turn47search2turn22search1turn22search2turn21search23turn48view0

### Ouro, spikes, persistência de lane e snowball

Para modelar power de forma crível, vale ancorar a engine em dois fatos. Primeiro: Riot e Lolesports tratam **gold diff** como uma variável central de win probability, junto de XP, torres, dragões e número de vivos. Segundo: estudos usando Oracle’s Elixir em pro play mostram que pequenas vantagens de ouro cedo já deslocam bastante a chance de vitória. Em uma análise com **21.312 team rows** de partidas profissionais de 2022, um intervalo logo acima de zero até aproximadamente **+942 gold aos 10 minutos** já aparecia com **60% win rate**, e um bin entre cerca de **+2,8k e +3,8k** aos 10 minutos já batia **92%**; o autor resume que **+5k cedo** torna a vitória quase garantida em pro. O próprio Oracle’s Elixir, no Early Game Rating 2.0, já havia estimado que **+1.000 gold aos 15 minutos** vale cerca de **64%** de win probability e **+2.500** cerca de **81%**. citeturn15search6turn24view0turn15search4

O outro lado da moeda é o comeback. Riot revisou champion e objective bounties em 2024–2025 para que sirvam mais explicitamente como mecanismo de retorno: bounties positivas passaram a escalar a partir de ouro de kills e assists, objective bounties passaram a pagar até **10% da diferença de ouro**, limitadas a **1000g**, e a supressão de bounties ficou mais agressiva para times atrás em patches seguintes. Ao mesmo tempo, no patch 26.1, **First Blood voltou a dar +100g ao killer** e **First Turret voltou a dar +300g**, reforçando a persistência das vantagens iniciais. Em termos de engine, isso pede duas coisas: **snowball forte, mas com freios sistêmicos**, e um modelo de “boa morte / má morte” que leve em conta bounty entregue, lado do mapa, objetivo subsequente e trade real. citeturn34search4turn34search1turn34search21turn34search2

Para resource allocation por role, o dado mais importante não é apenas “quem tem mais ouro”, mas **quem converte melhor esse ouro em chance de vitória**. Um estudo recente de análise de roles em dados competitivos encontrou a maior diferença média de `earnedgold` entre derrotas e vitórias justamente para o **bot lane**, com o jungle aparecendo perto do fundo, acima apenas do support; o autor usa isso para argumentar que bot recebe e converte mais recursos, enquanto junglers frequentemente sacrificam ouro em prol dos carries. Isso casa tanto com o papel tradicional do marksman quanto com o discurso oficial da Riot em 26.1, quando o patch fala explicitamente em “**bot laners as the game’s defining gold income carries**”. citeturn48view0turn16search15

A tabela seguinte resume a heurística recomendada para `effectiveGoldPower`. Ela não tenta reproduzir shop math item a item; ela tenta traduzir o que as fontes deixam claro: **ADC e certos mids têm alta elasticidade ao ouro**, tanks e engagers convertem melhor em **survivability / setup** do que em dano bruto, e support converte pouco ouro em DPS, mas muito em **visão, utilidade e segurança de execução**. citeturn48view0turn16search15turn15search8

| Role / perfil | Elasticidade de ouro em dano | Elasticidade em sobrevivência | Elasticidade em objective DPS | Elasticidade em visão/controle |
|---|---:|---:|---:|---:|
| **ADC hypercarry** | muito alta | média | muito alta | baixa |
| **ADC utility/lane bully** | alta | média | alta | baixa |
| **Mid assassin/burst** | alta | baixa-média | baixa-média | baixa |
| **Mid control/artillery** | alta | média | média | média |
| **Top tank** | baixa | muito alta | baixa | média |
| **Top bruiser/diver** | média-alta | alta | média | baixa |
| **Jungle carry/farming** | alta | média | alta | média |
| **Jungle tank/gank** | média | alta | média em secure/setup | alta |
| **Support enchanter** | baixa | média | muito baixa | muito alta |
| **Support engage** | muito baixa | alta | muito baixa | alta |
| **Support poke/mage** | média | baixa | baixa | média |

Em implementação, um bom modelo é separar **ouro esperado por minuto/role** de **ouro real**, e transformar o delta em poder por meio de uma função com saturação, mais bônus discretos de spike. Algo como: `effectiveGoldPower = baseRoleCurve + sigmoid(goldDeltaRoleNormalized) * roleGoldElasticity + itemSpikeBonus + levelSpikeBonus + compSynergyBonus`. O `goldDeltaRoleNormalized` deve comparar o jogador com o valor esperado para aquela role naquele minuto; assim, 1k em cima do esperado para um ADC vale muito mais do que 1k distribuído acima do esperado em um support, e 3k concentrados em duas threats costuma ser melhor para teamfight do que 3k espalhados em cinco jogadores de baixa elasticidade ofensiva. Isso não é um dado oficial; é a heurística que mais respeita os sinais empíricos acima. citeturn15search6turn24view0turn48view0

Para persistir lane lead, a engine deve abandonar recálculo “zerado” e passar a tratar a lane como um estado acumulativo. First Blood, solo kill, dive, plate e first tower não são eventos isolados: eles alteram **força de recall**, **tempo de retorno**, **controle de wave**, **janela de warding**, **ameaça de dive** e **jungle attention**. Guias atuais de macro reforçam que lane priority condiciona invade e objetivo; weakside/strongside são definidos justamente pelo tempo que o jungler ganka ou passa em cada lado, e o support pode alterar isso com roam timings. Em Worlds 2025, a distribuição de plates por lane variou bastante entre equipes como **T1, KT e Gen.G**, o que é um bom lembrete de que strongside é um estado contextual de draft e plano, não uma propriedade fixa da side ou da role. citeturn20search1turn20search15turn21search2turn21search5turn28search7turn28search8turn28search10

A proposta de estado persistente por lane é esta:

| Campo | Escala | Efeito primário |
|---|---|---|
| `laneLead` | -100 a +100 | resumo persistente de vantagem da lane |
| `csDiff` | inteiro | ouro e push lead |
| `xpDiff` | inteiro | breakpoint de all-in e prio |
| `plateGold` | inteiro | conversão material da vantagem |
| `resetAdvantage` | -2 a +2 | quem volta primeiro e compra melhor |
| `matchupVolatility` | 0 a 100 | chance de kill/dive/flip |
| `jungleAttentionReceived` | -100 a +100 | altera gank e countergank odds |
| `weaksideState` | booleano + intensidade | aumenta risco se pressão inimiga sobe |
| `prioScore` | -100 a +100 | libera invade, roam e setup de objetivo |

A atualização deve ser **parcialmente cumulativa** e com **decaimento lento**, não reset. First Blood na lane pode dar `+10` a `+16` em `laneLead`, solo kill `+12` a `+20`, gank convertido `+8` a `+14`, plate `+3` a `+5`, first tower local `+12` a `+18`, recall melhor `+2` a `+6`, freeze mantido `+2` por janela curta, wave crash negada `-3` a `-6` no outro lado. Lanes de scaling podem ter `laneLead` negativo com `futureThreat` positivo; esse é exatamente o caso que sua engine hoje provavelmente perde quando reseta a pressão em vez de persistir a história do matchup. citeturn20search1turn20search6turn20search14turn32view0

## Modelagem recomendada da engine

### Taxonomia de archetypes, comportamento por pick e composições

A taxonomia mínima mais útil não é uma lista única de 20 rótulos; é uma combinação de **classe primária + tags funcionais**. Riot continua a trabalhar com seis classes amplas — **Assassin, Fighter, Mage, Marksman, Support e Tank** — e o Data Dragon continua servindo `champion.json` e JSONs individuais com dados por campeão. Isso é suficiente para definir a camada de base. Em cima dela, a sua engine deve adicionar tags funcionais derivadas, porque “Mage” sozinho não distingue Orianna de LeBlanc, assim como “Support” não distingue Lulu de Nautilus. citeturn29search2turn44search0turn17search11

A taxonomia recomendada é esta: `primaryClass`, `damageProfile`, `engageProfile`, `econProfile`, `mapProfile`, `scalingProfile` e `resilienceProfile`. Em texto: **tank / bruiser / diver / juggernaut / assassin / control mage / burst mage / artillery mage / hypercarry marksman / lane bully marksman / engage support / enchanter / poke support / roaming support / carry jungle / tank jungle / farming jungle / ganking jungle / split pusher / utility core**. Isso engole quase todas as sugestões da sua lista, mas com menos sobreposição cognitiva na implementação. citeturn46view0turn22search13turn21search19turn22search2turn22search1

A tabela abaixo resume a leitura operacional desses archetypes para engine. Ela é uma síntese de classes oficiais, categorias de support, guias de macro por comp e dados de role; use-a como base do banco de champions, não como regra dura. citeturn29search2turn44search0turn46view0turn47search1

| Archetype | Kill bias | Death risk | Assist bias | Melhor fase | Estilo de evento |
|---|---|---|---|---|---|
| **Top tank weakside** | baixo | médio-alto | médio | mid/late | front line, peel, absorção |
| **Top bruiser/diver** | médio-alto | alto | médio | early/mid | flank, dive, side skirmish |
| **Top split pusher** | alto em side | alto isolado | baixo | mid | 1v1, torre, pull pressure |
| **Jungle tank/gank** | baixo-médio | médio | muito alto | early/mid | gank, setup, secure |
| **Jungle carry/farm** | alto | médio | médio | mid | invade, skirmish, snowball |
| **Mid assassin** | muito alto | alto | baixo-médio | early/mid | pickoff, roam, burst |
| **Mid control mage** | médio-alto | médio | alto | mid/late | teamfight, zone, siege |
| **Mid artillery** | médio | baixo-médio | alto | mid | poke, siege, objective setup |
| **ADC hypercarry** | muito alto late | médio-alto se exposto | médio | late | cleanup, front-to-back |
| **ADC lane bully** | alto early/mid | médio | médio | early/mid | 2v2, plate pressure |
| **Support engage** | muito baixo | alto | muito alto | early/mid | engage, roam, pick |
| **Support enchanter** | muito baixo | baixo-médio | muito alto | mid/late | peel, anti-dive, buff |
| **Support poke/mage** | médio | médio | médio-alto | lane/mid | poke, chip, pick |

O ponto mais importante para comportamento é que **o mesmo jogador muda radicalmente de função quando muda de campeão**. Isso não é detalhe cosmético; é central. Um top tank deve ter mais probabilidade de **iniciar e morrer bem**; um top split pusher deve ter mais eventos de **side lane, pressão de torre e morte isolada**; um jungle tank precisa aparecer como **gerador de kill participation com poucos last hits**; um jungle carry precisa ter chance real de concentrar kills e carregar fights; um mid assassin precisa puxar o simulador para **pickoffs, roams, no-flash punish e carries deletados**; um mid control mage precisa puxar para **setup de objective, follow-up, zone control e siege**; um ADC hypercarry precisa explodir em valor quando atinge item spikes e front line suficiente; um support engage precisa morrer mais; um enchanter precisa morrer menos e elevar muito a sobrevivência do carry. Tudo isso está muito alinhado tanto com guias modernos quanto com o perfil estatístico visto em datasets competitivos e de role analysis. citeturn46view0turn22search10turn20search4turn20search8turn48view0turn32view0

A matriz role × archetype recomendada, em termos de modificadores multiplicativos sobre o baseline do jogador, pode começar assim:

| Role × archetype | Killer | Vítima | Assist | Inicia luta | Morre após iniciar | Gera pickoff | Converte lead em objetivo |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Top tank** | 0.80 | 1.10 | 1.00 | 1.20 | 1.20 | 0.70 | 0.95 |
| **Top split** | 1.15 em side | 1.25 em side | 0.75 | 0.70 | 0.90 | 1.05 | 1.20 em torre |
| **Jungle tank** | 0.85 | 1.00 | 1.25 | 1.10 | 1.05 | 0.95 | 1.20 secure/setup |
| **Jungle carry** | 1.15 | 1.05 | 1.00 | 0.95 | 1.00 | 1.15 | 1.05 |
| **Mid assassin** | 1.25 | 1.10 | 0.90 | 1.00 | 1.05 | 1.30 | 0.95 |
| **Mid control** | 1.00 | 0.95 | 1.10 | 0.95 | 0.90 | 0.95 | 1.15 siege/setup |
| **ADC hypercarry** | 0.85 early / 1.30 late | 1.15 | 0.95 | 0.60 | 0.70 | 0.75 | 1.20 em objetivo/torre |
| **ADC lane bully** | 1.10 early | 1.00 | 0.95 | 0.75 | 0.80 | 0.90 | 1.10 plate/tower |
| **Support engage** | 0.65 | 1.25 | 1.30 | 1.35 | 1.35 | 1.10 | 1.05 |
| **Support enchanter** | 0.45 | 0.85 | 1.35 | 0.55 | 0.70 | 0.70 | 1.00 |
| **Support poke** | 0.85 | 1.00 | 1.15 | 0.80 | 0.90 | 1.00 | 1.05 siege |

Draft deve importar mais porque comp muda **intenção de jogo**. As melhores simplificações para `teamCompProfile` são: `teamfight`, `pick`, `poke`, `siege`, `split`, `dive`, `protectCarry`, `earlySnowball`, `scaling`, `frontToBack`, `wombo`, `disengage`, `skirmish`, `objectiveControl`. Fontes de guia de composição convergem muito bem nessas famílias: poke/siege quer chipar de longe e controlar estrutura/objetivo; dive quer forçar entrada rápida em alvo-chave; split/1-3-1 quer pressão múltipla e evitar ser pego; protect-the-carry quer agrupar e manter o hypercarry vivo; counter-engage/disengage quer deixar o outro time entrar e virar a luta. citeturn21search0turn21search19turn22search1turn22search2turn22search4turn22search13turn22search18turn47search2turn47search9

A melhor forma de derivar automaticamente esse perfil é por soma de tags dos campeões escolhidos. Exemplo: somar `diveScore`, `peelScore`, `pokeScore`, `splitScore`, `frontlineScore`, `scalingScore`, `pickScore`, `objectiveDps`, `objectiveSecure`. Depois, converter em 1–3 tags dominantes do time. Se `diveScore + engageScore` passar do limiar, o `chooseIntent` do time sobe para forçar luta em jungle/torre. Se `pokeScore + siegeScore` dominar, o time prefere chip, visão, setup e evita all-in em corredor fechado. Se `splitScore` passar do limiar e houver waveclear suficiente no 4-man, o time passa a gerar `splitPushWindow` e diminui o desejo de 5v5 puro. Isso é muito mais fiel ao jogo do que um peso genérico de “teamfight comp boa”. citeturn47search1turn22search1turn22search2turn21search23

### Strongside, weakside, jungle atenção e timeline contextual

“Strong side” e “weak side” devem virar estado explícito. Leaguepedia define `weak side` como o lado do mapa em que o jungler **não ganka ou passa pouco tempo**, normalmente top; `strong side` é o lado em que ele mais ganka ou circula, normalmente bot. Guias atuais de jungle reforçam que a escolha depende de lane priority, setup da lane e win condition; guias de support mostram que roams alteram isso, porque podem temporariamente transformar mid ou top em lado forte. citeturn21search2turn21search5turn20search1turn20search7turn20search8

A forma mais simples e útil de calcular isso é:

`strongsideScore(lane) = resourceDemand + setupCC + waveState + objectiveProximity + supportRoamAccess + laneVolatility + carryPotential - weaksideTolerance`

Onde:
- `resourceDemand` vem do campeão e do jogador.
- `setupCC` vem do conjunto da lane.
- `waveState` vem de `prioScore`, `resetAdvantage` e posição da wave.
- `objectiveProximity` favorece bot/mid perto de dragão e top/mid perto de grubs/herald.
- `supportRoamAccess` sobe quando bot resetou junto, bot tem cobertura de ward ou o support é roam-heavy.
- `weaksideTolerance` sobe em picks como top tanks blindáveis e cai em tops carry voláteis. citeturn20search1turn20search15turn46view0turn32view0

Quando uma lane cai em weakside, a engine deve aumentar **risco de morte por gank/dive**, mas também permitir **valor sem kill**. Esse é o erro clássico de simuladores simplificados: top weakside parece só “pior”; no LoL real, top weakside pode morrer pouco, ceder CS, segurar wave e ainda cumprir função ótima. O artigo da Team Liquid sobre Canna é quase um retrato perfeito disso: ele manteve lane stats fortíssimos apesar de baixa jungle proximity, e o texto descreve explicitamente o top laner dominante como alguém que sabe operar no 2v1, no 1v1 e no 1v2. citeturn32view0

No bot side, strongside deve puxar a engine para três cadeias de eventos: **2v2 favorável → prio → plate gold → first tower/roam → dragão ou invasão de bot-side jungle**. Guias atuais de jungle e support são bastante diretos nesse ponto: se o win condition é bot, o jungler deve priorizar esse lado; suportes podem roam straight from base ou após recall sincronizado; e lane priority define se invade e objetivo são jogáveis. No atual ciclo de patches, Riot inclusive reforçou o papel do bot como principal receptor de gold income. citeturn20search7turn20search4turn20search8turn16search15

Para a timeline, isso significa que o jogo precisa emitir eventos menos genéricos e mais condicionais. Em vez de “Team A conseguiu uma kill”, você quer produzir coisas como: “support morreu wardando rio alto”, “ADC foi pego sem flash ao tentar pegar a wave lateral”, “top weakside sofreu dive de 3 homens e perdeu a wave, mas o time garantiu pressão no lado oposto”, “mid rotacionou primeiro e liberou invade”, “jungle carry ganhou o 2v2 top-side e transformou em tempo de grubs”, “enchanter salvou o ADC e negou reset de assassino”. Esses padrões são muito mais fiéis à macro descrita pelas fontes do que uma timeline de kills neutra. citeturn19search14turn20search19turn22search10turn20search10turn46view0

## Fórmulas e heurísticas implementáveis

### Killer, vítima, assists, lutas e placar plausível

A forma mais robusta de escolher o killer é trabalhar com **candidatos plausíveis** do evento, nunca com o time inteiro. Em um pickoff, os candidatos são quem tinha alcance, dano ou CC na jogada; em um front-to-back, os candidatos são quem realmente conseguiu uptime na luta; em um dive, os candidatos são quem entrou, quem tinha burst e quem podia resetar aggro com mais segurança. Depois disso, a engine sorteia dentro desse conjunto com pesos que já embutem estado, ouro e fit do campeão com o evento. A fórmula abaixo é simples o bastante para TypeScript e respeita a ideia de “aleatoriedade = ruído ao redor do estado”, não causa principal. As constantes devem vir das tabelas desta pesquisa. A lógica é apoiada pelo ordering de roles em KP/kill patterns, pelo peso de ouro na win probability e pelo fato de que supports/engagers existem mais para setup do que para finalização. citeturn12view0turn24view0turn48view0turn46view0

```ts
type Role = "top" | "jungle" | "mid" | "adc" | "support";
type EventType = "laneTrade" | "gank" | "dive" | "pickoff" | "teamfight" | "cleanup" | "side1v1";

function killerScore(p: SimPlayer, ctx: FightContext): number {
  const roleBase = KILLER_ROLE_WEIGHTS[ctx.eventType][p.role];           // tabela desta pesquisa
  const archetypeFit = ARCHETYPE_EVENT_FIT[p.archetype][ctx.eventType];  // ex.: assassin+pickoff
  const goldPower = 0.65 + p.effectiveGoldPower.damageThreat;            // 0.65..1.65
  const access = 0.7 + ctx.accessToTarget[p.id];                         // visão, range, posição
  const uptime = 0.7 + ctx.expectedFightUptime[p.id];                    // quanto consegue bater
  const resetBonus = p.tags.includes("resetCarry") && ctx.lowHpTargets > 0 ? 1.12 : 1.0;
  const targetFit =
    ctx.target.tags.includes("carry") && p.tags.includes("antiCarry") ? 1.10 : 1.0;

  return roleBase * archetypeFit * goldPower * access * uptime * resetBonus * targetFit;
}
```

Para seleção de vítima, o melhor caminho é modelar **exposição**. Morre quem está sem flash, sem visão, isolado no side, em weakside, sem peel, em rota de engage, ou quem é obrigado a facecheck/setup a jogada. Isso vale para support wardando, ADC andando na lane lateral, top splitando sem cobertura, jungle invadindo sem prio e mid tentando contestar wave/roam em matchups ruins. No LoL real, “fragilidade” não é só HP/armor; é também **posição tática**. As fontes sobre lane priority, weakside, roaming support e ADC survival sustentam muito bem esse modelo. citeturn20search1turn21search2turn21search5turn20search4turn22search10

```ts
function victimScore(p: SimPlayer, ctx: FightContext): number {
  const roleBase = VICTIM_ROLE_WEIGHTS[ctx.eventType][p.role];
  const deathRisk = 0.7 + p.metrics.deathRisk;               // 0.7..1.7
  const exposed = 1 + ctx.exposure[p.id];                    // 0..1.0
  const noFlash = p.flashUp ? 1.0 : 1.18;
  const isolated = ctx.isolated[p.id] ? 1.20 : 1.0;
  const weakside = ctx.lane && ctx.lane.weaksideFor === p.team ? 1.12 : 1.0;
  const noPeel = 1 + Math.max(0, 0.45 - ctx.peelCoverage[p.id]);
  const engageTax = (p.tags.includes("engage") && ctx.eventType === "teamfight") ? 1.15 : 1.0;
  const bountyGreed = p.bountyGold >= 500 ? 1.05 : 1.0;

  return roleBase * deathRisk * exposed * noFlash * isolated * weakside * noPeel * engageTax * bountyGreed;
}
```

Assistência precisa ser distribuída sem inflar kills. A melhor regra prática é usar uma **janela curta de contribuição**, inspirada na regra real de assist no jogo, em que contribuidores recentes recebem assist; a wiki competitiva/comunitária resume isso como contribuidores nos últimos **10 segundos**. Para o simulador, não precisa ser second-perfect: basta uma lista de participantes da jogada com `contributionScore` por dano, hard CC, peel decisivo, shield/heal relevante, reveal/vision setup e body-block/zone. Depois, aplica-se um limiar e um cap médio por tipo de evento. Os averages de pro teams com **2,3–2,6 assists por kill** são uma ótima âncora para não explodir o placar. citeturn11search14turn25search1turn25search3turn28search8turn28search10

```ts
function assignAssists(killerId: string, participants: EventParticipant[], ctx: FightContext): string[] {
  const targetAssistCount = ASSIST_COUNT_BY_EVENT[ctx.eventType]; // ex.: gank 1-2, teamfight 3-4
  const eligible = participants
    .filter(p => p.id !== killerId)
    .filter(p => p.contributionScore >= ASSIST_MIN_SCORE[ctx.eventType])
    .map(p => ({
      id: p.id,
      score:
        p.contributionScore *
        (0.8 + p.player.metrics.assistBias) *
        (p.player.role === "support" ? 1.20 : 1.0) *
        (p.player.role === "jungle" ? 1.10 : 1.0),
    }))
    .sort((a, b) => b.score - a.score);

  return weightedTopN(eligible, targetAssistCount);
}
```

Para casualties de teamfight, o melhor é estimar **intensidade da luta** e **assimetria de poder**, e então converter isso em mortes esperadas por lado. Em vez de simular cinco duelos independentes, trate a luta como um pacote que produz de 0 a 5 mortes por lado, distribuídas de acordo com ameaça, controle, front line, peel e posicionamento. Se o time tem dive forte contra backline frágil sem peel, a chance de o ADC morrer primeiro sobe muito; se o time tem comp front-to-back com enchanter e tank, a chance de carry sobreviver aumenta, e as primeiras mortes migram para frontline/engage. Isso conversa bem com o modelo de team comps e com a literatura que diferencia kills/deaths por impacto real na win probability, não só por contagem. citeturn47search2turn22search18turn11search12turn15search6

```ts
function expectedTeamfightDeaths(teamA: TeamState, teamB: TeamState, ctx: FightContext) {
  const powerA = teamFightPower(teamA, ctx);
  const powerB = teamFightPower(teamB, ctx);
  const delta = powerA - powerB;

  const fightIntensity = ctx.intensity; // 0..1
  const baseTotalDeaths = lerp(1.2, 5.5, fightIntensity);

  const aDeathShare = sigmoid((-delta) / 18); // delta em "pontos de power"
  const bDeathShare = 1 - aDeathShare;

  return {
    deathsA: clamp(Math.round(baseTotalDeaths * aDeathShare), 0, 5),
    deathsB: clamp(Math.round(baseTotalDeaths * bDeathShare), 0, 5),
  };
}
```

A distinção entre **boa morte** e **má morte** merece existir explicitamente. A literatura de analytics em LoL já argumentou que kills e deaths têm valores muito diferentes quando condicionados à mudança na chance de vitória; em resumo, há “smart kills” e “worthless deaths”, e o correlato inverso também é verdadeiro. Na engine, uma “boa morte” é uma morte que sacrifica um iniciador, weakside ou frontline, mas gera uma troca favorável, salva um carry, compra tempo de objective, força summoners-chave ou converte em Baron/Dragon/Tower/Inhib. Uma “má morte” entrega bounty, remove setup, quebra wave state, dá janela de objetivo ao oponente ou mata a principal threat antes da fight. citeturn11search12turn15search6

```ts
function deathQuality(death: DeathEvent): "good" | "neutral" | "bad" {
  const objectiveGain = death.teamObjectiveValueAfter - death.teamObjectiveValueBefore;
  const tradeValue = death.enemyGoldGiven - death.allyGoldGiven;
  const carrySaved = death.savedCarry ? 250 : 0;
  const bountyLost = death.victimBountyGold;
  const mapLoss = death.waveLossGold + death.towerPressureLost + death.visionLossPenalty;

  const score = objectiveGain + tradeValue + carrySaved - bountyLost - mapLoss;
  if (score >= 250) return "good";
  if (score <= -200) return "bad";
  return "neutral";
}
```

A regra especial de **“engage support morreu, mas ganhou a luta”** deve existir porque é parte muito recognoscível do LoL. Em geral: se o initiator morre nos primeiros segundos, mas seu time pega pelo menos **2 kills de vantagem**, ou garante objetivo importante, ou preserva as duas principais threats, a engine deve marcar esse evento como sucesso tático, não como falha individual. Isso é exatamente o tipo de nuance que diferencia um placar “ruim” porém crível de um placar “ruim” e absurdo. citeturn46view0turn22search18

Para evitar placares absurdos, use **soft caps por role/archetype**, não caps rígidos por jogador. O bloco abaixo é um bom conjunto de bandas plausíveis para partidas de 25–35 minutos em Summoner’s Rift competitivo/ranqueado de PC. Ele vem de síntese das distribuições de role, do ritmo atual de pro (em torno de 30 kills totais por jogo no Worlds 2025 Main Event) e do padrão de supports como assist machines e ADCs como cleanup carries. citeturn26view0turn28search5turn39view0turn39view3turn48view0

| Role/archetype | Placar plausível em jogo “normal” 25–35m |
|---|---|
| **Top tank** | 1–5 / 3–7 / 6–14 |
| **Top carry/diver** | 3–8 / 2–6 / 4–10 |
| **Jungle tank** | 1–5 / 3–7 / 7–16 |
| **Jungle carry** | 3–9 / 2–6 / 5–12 |
| **Mid control mage** | 4–9 / 2–5 / 5–12 |
| **Mid assassin** | 5–11 / 3–7 / 3–9 |
| **ADC padrão** | 5–10 / 2–5 / 4–10 |
| **ADC hypercarry late** | 7–13 / 2–5 / 4–9 |
| **Support engage** | 0–4 / 4–9 / 10–22 |
| **Support enchanter** | 0–3 / 2–6 / 10–22 |
| **Support poke/mage** | 2–7 / 3–7 / 6–14 |

As regras adicionais de plausibilidade devem ser duras. Support **9/1/2** deve ser raro e quase sempre exigir mage support ou stomp caótico. ADC de time vencedor em jogo longo **não deve frequentemente terminar sem kills**, a menos que seja comp de hard funnel para mid/top ou vitória extremamente controlada sem muitas fights. Top tank **15/0** deve ser quase inexistente. Jungle com “todas as kills” deve ser reservado a assassin/carry jungle em fiesta ou stomp curtíssimo. E assistências absurdamente altas no time inteiro devem ser contidas usando a média de participantes por evento, não assistindo automaticamente todos os vivos. citeturn25search1turn25search3turn28search8turn28search10turn43view2

### effectiveGoldPower, snowball, comeback, throw e stomp

O melhor modelo prático para `effectiveGoldPower` é decompor em componentes. Um jogador não ganha apenas “+X power” por ouro; ele ganha parcelas em **damageThreat**, **survivability**, **objectiveDps**, **siegeThreat**, **teamfightValue**, **pickThreat** e, no caso de jungle/support, **visionControl / objectiveSetup**. Isso é coerente com o próprio broadcast model da Riot, que não usa apenas gold diff, e com trabalhos recentes que criticam métricas isoladas sem contexto. citeturn15search6turn13search11

```ts
function effectiveGoldPower(p: SimPlayer, ctx: GameContext) {
  const expectedGold = expectedGoldForRoleAtMinute(p.role, ctx.minute);
  const goldDelta = p.gold - expectedGold;

  const goldTerm = sigmoid(goldDelta / 1200);          // -1..+1 aproximado
  const itemSpike = itemSpikeScore(p.itemsCompleted, p.componentsHeld, p.role, p.archetype);
  const levelSpike = levelSpikeScore(p.level, p.archetype); // ex.: 6, 11, 16
  const compFit = teamCompFitBonus(p, ctx.teamCompProfile);

  return {
    damageThreat:
      BASE_DAMAGE[p.role] *
      (1 + goldTerm * GOLD_DAMAGE_ELASTICITY[p.role][p.archetype]) *
      (1 + itemSpike.damage + levelSpike.damage + compFit.damage),

    survivability:
      BASE_SURVIVABILITY[p.role] *
      (1 + goldTerm * GOLD_TANKINESS_ELASTICITY[p.role][p.archetype]) *
      (1 + itemSpike.tank + levelSpike.tank + compFit.survive),

    objectiveDps:
      BASE_OBJECTIVE_DPS[p.role] *
      (1 + goldTerm * GOLD_OBJECTIVE_ELASTICITY[p.role][p.archetype]) *
      (1 + itemSpike.objective + compFit.objective),

    teamfightValue:
      BASE_TEAMFIGHT[p.role] *
      (1 + goldTerm * GOLD_TEAMFIGHT_ELASTICITY[p.role][p.archetype]) *
      (1 + itemSpike.teamfight + levelSpike.teamfight + compFit.teamfight),

    pickThreat:
      BASE_PICK[p.role] *
      (1 + goldTerm * GOLD_PICK_ELASTICITY[p.role][p.archetype]) *
      (1 + itemSpike.pick + levelSpike.pick + compFit.pick),

    visionControl:
      BASE_VISION[p.role] *
      (1 + goldTerm * GOLD_VISION_ELASTICITY[p.role][p.archetype]) *
      (1 + itemSpike.utility + compFit.vision),
  };
}
```

Para time gold versus gold individual, use duas leituras. `teamGoldLead` afeta **macro confidence**, pressão de visão, poder de contestar objetivo e número esperado de mortes em lutas. Já `carryGoldConcentration` altera **quem fecha a fight** e **quão frágil fica o plano do time**. Ouro concentrado em ADC/mid com peel suficiente aumenta muito `teamfightCeiling`; ouro concentrado em assassin sem cobertura aumenta `pickThreat`, mas também `throwRisk`, porque a composição depende mais de execução perfeita. Essa é uma distinção importante que os dados de pro e a modelagem de win probability implicitamente sugerem: nem todo 5k lead “vale o mesmo”, dependendo de onde ele está. citeturn15search6turn48view0

Um mapeamento inicial útil de lead para estado de jogo é este. Ele não substitui o modelo de win probability; ele dá nomes operacionais para a engine decidir ritmo e agressividade. As âncoras vêm do EGR do Oracle’s Elixir e da análise exploratória em dados profissionais. citeturn15search4turn24view0

| Lead de ouro | Leitura sugerida |
|---|---|
| **1k** | leve vantagem; luta ainda altamente jogável |
| **3k** | vantagem clara; pressiona objetivo e side, mas não mata comeback |
| **5k** | snowball forte; time à frente escolhe lutas com mais conforto |
| **8k** | quase stomp se antes de 30–35m e sem comp de scaling excelente do outro lado |
| **10k+** | estado de fechamento; throw ainda possível, mas precisa de erro grande |

Para comeback e throw, as fórmulas mais úteis são probabilísticas. Se o time atrás tem **scaling better + bounty access + pick comp + visão defensiva boa + inimigo com concentração excessiva de ouro em carry frágil**, a `comebackThreat` sobe. Se o time na frente tem **baixa disciplina de mapa, dive excessivo, pouca visão lateral, split sem cobertura ou carry muito avançado**, o `throwRisk` sobe. Bounties oficiais mais generosas para o time atrás e a própria lógica do broadcast de win probability sustentam isso bem. citeturn34search4turn34search21turn15search6

```ts
function comebackThreat(teamBehind: TeamState, teamAhead: TeamState, ctx: GameContext): number {
  return clamp01(
    0.20 +
    0.20 * teamBehind.metrics.scalingAdvantage +
    0.15 * teamBehind.metrics.pickThreat +
    0.15 * teamBehind.metrics.visionControl +
    0.15 * bountyAccessScore(teamAhead, ctx) +
    0.10 * teamAhead.metrics.throwRisk +
    0.05 * hasHyperCarryAlive(teamBehind, ctx)
  );
}

function throwRisk(teamAhead: TeamState, ctx: GameContext): number {
  return clamp01(
    0.08 +
    0.18 * overforceTendency(teamAhead) +
    0.16 * sideLaneExposure(teamAhead) +
    0.14 * noFlashCarryExposure(teamAhead) +
    0.12 * lowVisionControl(teamAhead) +
    0.10 * goldConcentrationFragility(teamAhead) +
    0.10 * objectiveFlipHabit(teamAhead)
  );
}

function stompChance(teamA: TeamState, teamB: TeamState, ctx: GameContext): number {
  const lead = Math.abs(teamA.gold - teamB.gold);
  const laneSnowball = Math.abs(teamA.laneLeadSum - teamB.laneLeadSum);
  const draftGap = Math.abs(teamA.draftSynergy - teamB.draftSynergy);

  return clamp01(sigmoid((lead - 3500) / 1600) * 0.55 + laneSnowball * 0.25 + draftGap * 0.20);
}
```

## Schema e métricas internas sugeridas

### Campos novos para cards e championPool

O princípio aqui deve ser: **o usuário não precisa preencher manualmente dados muito técnicos do campeão**. A melhor arquitetura é separar **dados do card do jogador** e **dados da base de campeões**. O usuário edita poucos sliders do jogador; o banco de champions injeta defaults fortes por `championId`. Se o usuário quiser, pode sobrescrever um ou outro campo avançado. Isso mantém o cadastro amigável e, ao mesmo tempo, permite uma engine muito mais rica. A necessidade dessa separação aparece claramente nas fontes que diferenciam role, champion e contexto, e também em estudos que mostram que estatísticas isoladas sem contexto são insuficientes. citeturn13search11turn48view0turn44search0

Para o **card do jogador**, eu sugiro adicionar: `preferredStyle`, `riskProfile`, `resourceDemand`, `weaksideTolerance`, `carryPotential`, `killBias`, `assistBias`, `engageBias`, `peelBias`, `objectiveBias`, `scalingCurve`, `volatility`, `shotcalling`, `roamTendency`, `sideLaneDiscipline`. Todos podem ser escalas simples de **0 a 100**. Dessas, eu deixaria `preferredStyle`, `riskProfile`, `resourceDemand`, `weaksideTolerance`, `carryPotential`, `volatility` e `shotcalling` como opcionais com defaults neutros; o resto pode ser inteiramente derivado de `role + traits + champion pick` se o usuário não quiser preencher. citeturn20search0turn46view0turn32view0

Para o **championPool entry**, eu sugiro que além de `championId` e `mastery` existam campos automáticos: `primaryClass`, `secondaryTags`, `damageProfile`, `engageProfile`, `econProfile`, `mapProfile`, `scalingProfile`, `objectiveDps`, `objectiveSecure`, `killBias`, `deathRisk`, `assistBias`, `laneVolatility`, `weaksideTolerance`, `fromBehindValue`, `snowballIndex`, `splitPushThreat`, `siegeThreat`, `pickThreat`, `peelValue`. Todos também em 0–100 ou enum curta. O usuário comum não precisa tocar nisso; vem do banco de campeões e pode ser ajustado por patch/versionamento depois. citeturn29search2turn44search0turn17search11

A tabela abaixo resume uma proposta prática de schema.

| Campo | Onde fica | Escala | Obrigatório | Default seguro | Motivo |
|---|---|---|---|---|---|
| `preferredStyle` | player card | enum curta | não | `"balanced"` | altera chooseIntent |
| `riskProfile` | player card | 0–100 | não | 50 | afeta engage, greed e deaths |
| `resourceDemand` | player card | 0–100 | não | 50 | define weak/strong side e funnel |
| `weaksideTolerance` | player card | 0–100 | não | 50 | define estabilidade sem ajuda |
| `carryPotential` | player card | 0–100 | não | derivado de roleStrength+lateGame | ceiling real de snowball |
| `volatility` | player card | 0–100 | não | 50 | amplitude de melhora/piora por lead |
| `shotcalling` | player card | 0–100 | não | 50 | macro, objective setup, throw reduction |
| `roamTendency` | player card | 0–100 | não | derivado de role/traits | support/mid/jg |
| `primaryClass` | champion entry | enum | sim no banco, não no cadastro manual | via base de champions | classe base Riot |
| `secondaryTags` | champion entry | string[] | sim no banco | `[]` | engage, peel, poke, split etc. |
| `econProfile` | champion entry | enum | sim no banco | `"medium"` | elasticidade ao ouro |
| `scalingProfile` | champion entry | enum | sim no banco | `"medium"` | curva early/mid/late |
| `killBias` | champion entry | 0–100 | sim no banco | 50 | killer score |
| `deathRisk` | champion entry | 0–100 | sim no banco | 50 | victim score |
| `assistBias` | champion entry | 0–100 | sim no banco | 50 | placar e narrativa |
| `objectiveDps` | champion entry | 0–100 | sim no banco | 50 | dragon/baron/tower |
| `objectiveSecure` | champion entry | 0–100 | sim no banco | 30 | smite + burst + zone |
| `fromBehindValue` | champion entry | 0–100 | sim no banco | 50 | utilidade quando atrás |
| `snowballIndex` | champion entry | 0–100 | sim no banco | 50 | valor quando na frente |

Para compatibilidade com cards antigos, faça migração em duas etapas. Se os novos campos não existirem, derive `carryPotential`, `resourceDemand` e `scalingCurve` de `roleStrength`, `lanePhase`, `midGame`, `lateGame`; derive `riskProfile` e `volatility` a partir de `traits`; e preencha tudo que faltar do champion side através da base de campeão. Assim, nenhum card antigo quebra e nenhum amigo precisa preencher 20 sliders para entrar no app. citeturn44search0turn29search2

Um molde enxuto de Zod pode ser algo assim:

```ts
import { z } from "zod";

const Scale100 = z.number().min(0).max(100).default(50);

const ChampionTag = z.enum([
  "engage", "peel", "poke", "burst", "dps", "roam", "split",
  "zone", "secure", "farm", "gank", "scaling", "laneBully", "antiCarry"
]);

const ChampionEntrySchema = z.object({
  championId: z.string(),
  mastery: z.number().min(0).max(100),
  primaryClass: z.enum(["tank", "fighter", "assassin", "mage", "marksman", "support"]).optional(),
  secondaryTags: z.array(ChampionTag).default([]),
  econProfile: z.enum(["low", "medium", "high"]).default("medium"),
  scalingProfile: z.enum(["early", "mid", "late", "hybrid"]).default("hybrid"),
  killBias: Scale100,
  deathRisk: Scale100,
  assistBias: Scale100,
  objectiveDps: Scale100,
  objectiveSecure: Scale100.default(30),
  snowballIndex: Scale100,
  fromBehindValue: Scale100,
}).passthrough();

const PlayerCardV2Schema = z.object({
  role: z.enum(["top", "jungle", "mid", "adc", "support"]),
  roleStrength: Scale100,
  lanePhase: Scale100,
  midGame: Scale100,
  lateGame: Scale100,
  traits: z.array(z.string()).default([]),
  preferredStyle: z.enum(["balanced", "aggressive", "control", "selfless", "split", "teamfight"]).default("balanced"),
  riskProfile: Scale100,
  resourceDemand: Scale100,
  weaksideTolerance: Scale100,
  carryPotential: Scale100,
  volatility: Scale100,
  shotcalling: Scale100,
  roamTendency: Scale100,
  championPool: z.array(ChampionEntrySchema).min(1),
}).passthrough();
```

### Métricas internas para a engine

As métricas internas mais úteis são as que ajudam a decidir **probabilidade de evento**, não apenas a exibir pós-jogo. O bloco abaixo é o conjunto mínimo que eu considero de maior retorno prático. Ele se inspira nos próprios inputs de win probability da Riot, na crítica a métricas isoladas da literatura recente e nas distinções de role/champion encontradas nas fontes de analytics e macro. citeturn15search6turn13search11turn48view0

| Métrica | Escala | Derivação | Efeito principal |
|---|---|---|---|
| `killShareBias` | 0–100 | role + archetype + current gold | chance de ser killer |
| `deathRisk` | 0–100 | role + champ + vision + exposure | chance de ser vítima |
| `assistBias` | 0–100 | role + archetype + utility | chance de receber assist |
| `damageThreat` | 0–100 | effectiveGoldPower + class | resolução de luta |
| `burstThreat` | 0–100 | assassin/burst + gold + noFlash targets | pickoffs e deletes |
| `pickThreat` | 0–100 | burst + vision + CC + roam | picks no rio/jungle/side |
| `engageScore` | 0–100 | tank/diver/support engage + cooldowns | iniciar fight |
| `peelScore` | 0–100 | enchanter/tank/control mage | salvar carry |
| `frontLineScore` | 0–100 | tankiness + CC + willingness | absorção útil |
| `scalingCurve` | 0–100 | champ + player lateGame | power futuro |
| `laneVolatility` | 0–100 | matchup + summoners + archetype | frequência de kill/dive |
| `weaksideTolerance` | 0–100 | player + champ | estabilidade sem jungle |
| `resourceDemand` | 0–100 | champ + player | decide strongside |
| `jungleAttentionReceived` | -100..100 | pathing + side plan | ganks e counterganks |
| `objectiveSetup` | 0–100 | vision + zone + prio | drag/baron/elder fight |
| `visionScoreInternal` | 0–100 | role + items + map state | picks e segurança |
| `mapControl` | 0–100 | towers + prio + vision + tempo | chooseIntent e risk |
| `sideLaneThreat` | 0–100 | split profile + duel power | 1-3-1 e picks laterais |
| `siegeThreat` | 0–100 | poke + range + turret DPS | push e chip |
| `comebackThreat` | 0–100 | scaling + bounty access + pick | chance de virar |
| `throwRisk` | 0–100 | greed + low vision + comp fragility | chance de entregar |

Minha recomendação é que quase todas essas métricas sejam derivadas em três camadas: **base do jogador**, **overlay do campeão escolhido** e **modificador contextual do minuto atual**. Exemplo: `deathRisk` base de um support engage pode ser 62; com champion `Leona` sobe para 72; com ausência de visão lateral e sem flash sobe para 88. Isso é mais fiel ao jogo do que guardar um número fixo e usá-lo em todos os contexts. citeturn46view0turn20search19turn22search10

## Eventos contextuais, timelines e checklist final

A tabela seguinte traz um conjunto de eventos narrativamente fortes e mecanicamente úteis. A ideia é que eles só possam ocorrer quando as pré-condições são coerentes com o estado. É isso que vai impedir o simulador de soar “genérico”. citeturn20search4turn22search10turn21search2turn21search5turn46view0

| Evento | Pré-condições | Impacto de estado | Ticker recomendado |
|---|---|---|---|
| **Support morreu wardando** | support avançado, visão contestada, pouca cobertura | `mapControl -`, `deathRisk support +` | “Suporte é pego tentando estabelecer visão.” |
| **ADC foi pego sem flash** | carry lateral/forward, `flashUp=false`, pouca peel | `throwRisk +`, chance de objetivo inimigo + | “ADC é achado sem Flash e cai antes da luta.” |
| **Top morreu no split push** | `splitPlan=true`, pouca visão lateral, sem TP/sem cobertura | torre pressionada, mas abre janela de Baron/dragon | “Top pressiona demais no side e é abatido.” |
| **Jungle foi pego invadindo** | invade sem prio ou sem info de mid/support | `mapControl -`, objetivo contestável some | “Caçador é punido tentando invadir sem cobertura.” |
| **Mid rotacionou primeiro** | `prioScore mid > limiar` | gank/invade/objetivo setup + | “Mid chega primeiro e libera a jogada no rio.” |
| **Bot ganhou 2v2** | matchup favorável, sums, prio, support fit | `laneLead bot ++`, `plateGold +`, dragon pressure + | “Bot vence o 2v2 e assume o controle da rota.” |
| **Top sofreu dive weakside** | weakside top, wave stacked, jungle enemy nearby | `laneLead top --`, pode gerar crossmap | “Top toma dive no weakside enquanto o time joga do outro lado.” |
| **Support achou engage** | engage support com ângulo e follow-up | start de teamfight com death risk próprio | “Suporte encontra o engage e força a luta.” |
| **Enchanter salvou carry** | carry focado, peel/shield/heal disponível | carry death negada, swing de teamfight + | “Enchanter mantém o carry vivo no limite.” |
| **ADC limpou a fight** | front line viva, uptime alto, alvos baixos | multikill, objetivo pós-luta + | “ADC encontra espaço e limpa a luta.” |
| **Assassino deletou carry** | flank, no-flash, visão ruim, target exposto | fight trunca instantaneamente | “Assassino acha o ângulo e remove o carry.” |
| **Tank iniciou e morreu, mas ganhou a luta** | engage bom, follow-up forte, trade favorável | morte marcada como boa | “Frontline sacrifica o corpo, e o time converte a luta.” |
| **Jungler perdeu smite fight** | objetivo 50/50, setup ruim | objetivo -, moral -, mapa - | “O smite fight escapa das mãos do jungler.” |
| **Jungle roubou objetivo** | burst+smite ou pick antes do objetivo | comeback/stall + | “Roubo no covil! O caçador muda o rumo do jogo.” |
| **Time trocou dragão por Herald** | lado oposto com prio/tempo | neutral trade, local pressure muda | “Time troca o dragão por pressão de topo com Herald.” |
| **Time trocou Baron por inibidor** | base aberta, tempo curto, comp de siege/split | macro trade complexo | “Em vez do Baron, o time abre a base inimiga.” |
| **Scaling comp sobreviveu ao early** | déficit controlado, spikes próximos, sem colapso estrutural | `comebackThreat ++` | “A composição de scaling atravessa o early sem quebrar.” |

As cinco timelines abaixo mostram como isso fica muito mais LoL-like quando se usa estado persistente, archetypes e strong/weak side.

**Stomp de bot lane.** Aos 4–7 minutos, bot lane lane bully + engage support ganha o 2v2, garante recall melhor e abre `laneLeadBot`. O jungler identifica `strongside=bot`, volta para um dive de wave stacked e converte em plates. O support usa a janela para roam curto em mid na volta da base, não para abandonar o ADC aleatoriamente. Aos 12–16, o first tower de bot transforma a lane em engine de visão e dragões. O ADC passa a herdar o maior `killShareBias` do time, support explodindo em assistências e jungle mantendo alto KP sem necessariamente estar com as kills. Se o outro time não tiver engage de pick forte ou shutdown cedo, o jogo entra em estado de snowball clássico de bot-side. citeturn20search7turn20search8turn16search15turn22search10

**Top weakside sofrendo, mas time vencendo.** O top é um tank/utility com `weaksideTolerance` alta. O jungle abre path para bot, e a split line do top recebe pouca atenção. Aos 6–10, ele perde CS, toma um dive ou morre segurando wave, mas o evento é marcado como `good` ou `neutral` porque o outro lado do mapa converte em dragon, plates ou first tower. O `laneLeadTop` fica negativo, porém `teamState` fica positivo. No mid game, esse top passa a valer pela front line e pelo engage, não por kill count. O placar final 1/5/14 ou 2/6/16 soa mais realista do que tentar “compensar” com kills artificiais. citeturn21search2turn21search5turn32view0turn46view0

**Jungle carry snowballando.** O jungler é carry/farming ou assassin, recebe prio de mid cedo e encontra invade/gank bem encaixados. Em vez de simplesmente “dar todas as kills” a ele, a engine deve fazê-lo acumular kills em **skirmish, invade e cleanup**, enquanto mid e support ainda coletam várias assists. Se a lead é alta, `pickThreat` e `burstThreat` sobem muito; porém o `throwRisk` também sobe se o ouro ficar concentrado demais nele sem peel ou sem acompanhamento de visão. Esse é o cenário certo para placares como 8/3/9 ou 10/4/7, não 14/0/2 toda vez. citeturn32view0turn20search1turn20search16

**Scaling comp sobrevivendo e virando.** O time de scaling toma pressão early, perde first blood ou primeiras plates, mas mantém `structureLoss` e `goldLead` dentro de uma faixa recuperável. Os carries chegam a seus spikes, o enchanter ou control mage eleva `peelScore`, o time evita lutas ruins e joga por visão mais profunda perto dos objetivos decisivos. Um shutdown relevante ou uma pick em carry sem flash reduz rapidamente a distância, exatamente porque Riot tem bounty systems desenhados para tornar esse tipo de retorno mais potente. A partir daí, o front-to-back passa a favorecer o time que antes só “aguentava”. citeturn34search4turn34search21turn15search6turn22search2turn47search4

**Support engage morrendo muito, mas sendo decisivo.** O support é Leona/Nautilus/Rakan-like: alto `engageScore`, alto `assistBias`, alta chance de morrer após iniciar. No early, gera roams e picks; no mid, contesta visão e acha ângulo. O placar pode terminar 1/8/19, 2/9/22 ou 0/7/18 — e isso não é “jogar mal” se a maioria dessas mortes estiver ligada a engages que abrem luta favorável, salvam carrys ou garantem objetivo. Essa é uma das narrativas mais importantes para sua engine, porque hoje simuladores simplificados tendem a tratar 8 mortes de support como fracasso automático. No LoL real, muitas vezes é o contrário. citeturn46view0turn22search18turn19search14

O checklist final de adequação da engine, depois desta Pesquisa 2, deveria ser este:

- O simulador diferencia **role**, **jogador** e **campeão escolhido** em toda decisão relevante. citeturn44search0turn48view0
- `kill`, `death`, `assist` e `KP` saem de **priors distintos**, não de um mesmo bloco genérico. citeturn12view0turn41search6
- Support tem **poucos abates**, **muitas assists** e **alto risco contextual** de morrer em engage/visão. citeturn46view0turn28search5turn39view3
- ADC e mid assumem maior peso de finalização no mid/late, com ADC ficando ainda mais forte em front-to-back. citeturn26view0turn28search5turn48view0
- Jungle tem alta participação de early/mid, mas o finisher depende do archetype. citeturn12view0turn32view0
- Top é a role mais volátil e precisa reagir a weakside, split, tank e carry picks. citeturn32view0turn21search2
- Ouro individual é convertido em poder com **elasticidade por role/archetype** e **spikes discretos**. citeturn15search4turn24view0turn48view0
- Lane advantage persiste em `csDiff/xpDiff/plateGold/reset/prio`, em vez de ser recalculada do zero. citeturn20search1turn20search14
- Strongside/weakside é estado explícito e aparece na timeline. citeturn21search2turn21search5
- Draft gera `teamCompProfile` e altera `chooseIntent`, resolução de luta e prioridade de mapa. citeturn21search19turn22search1turn22search2turn47search2
- Eventos contextuais substituem mensagens genéricas de kill/objective. citeturn20search4turn22search10turn46view0
- Placares são limitados por role/archetype/contexto e por duração da partida. citeturn26view0turn43view2
- “Boa morte” e “má morte” existem como conceitos internos separados do placar bruto. citeturn11search12turn15search6

Se você transformar esta pesquisa em `pesquisa2.md`, o resultado prático para a refatoração é: **parar de simular jogadores genéricos em um mapa com timers corretos** e começar a simular **agentes com função, risco, economia, comp e contexto**. É exatamente isso que faz uma partida parecer LoL, mesmo quando a engine ainda é divertida, simplificada e não pretende ser um clone 1:1. citeturn15search6turn13search11turn48view0