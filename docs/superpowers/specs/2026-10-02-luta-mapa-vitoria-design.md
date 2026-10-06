# Design — Ligar luta → mapa → vitória no motor de simulação

**Data:** 2026-10-02
**Escopo:** `src/sim/**` (motor), harness de medição em `scripts/`, testes do motor.
**Substitui:** as Fases 29 e 30 do milestone v2.2 em `.planning/` (inércia de win probability e revisão em bloco). Este trabalho muda o modelo que aquelas fases iam calibrar.

## Contexto: o que a auditoria mediu

Auditoria de 2026-10-02 (`tmp/realism-audit.ts`, 1.500 partidas no caminho do app: rosters reais de `public/players.json` + campeões por `assignFearlessChampionsBothTeams`), comparada com a referência real de `docs/references/ritmo.md` (Oracle's Elixir 2023-2025, ~6 mil partidas tier-1, e feed oficial da Riot).

O vencedor da partida é decidido pela corrida de torres, e as lutas geram abates que quase não pesam no resultado:

| Quem vence a partida? | Real | Motor |
|---|---|---|
| Líder de torres aos 20' | (1ª torre: 68%) | 86% |
| Líder de abates aos 20' | 76% | 52% |
| Líder de ouro aos 20' | 78% | 53% |
| Líder de ouro aos 25' | 83% | 42% |
| Time do 1º Barão | 85% | 62% |
| Time da Alma | 91% | 48% |
| Vencedor termina com mais abates | ~90% | 43% |
| Vencedor termina atrás no ouro | raro (p10 da diferença é +5,3k) | 51% |

Abates do vencedor e do perdedor: 24,3 × 25,9 (real 18,3 × 8,5).

### Causas, lidas no código e confirmadas por medição

1. **Luta quase cara ou coroa.** `resolveTeamfight` (`src/sim/engine.ts`) multiplica o poder de cada lado por um sorteio uniforme em [0,575; 1,425]. O ouro entra por `goldFightMult` (`src/sim/power.ts`), que compara cada jogador com uma curva de ouro esperado, e não com o inimigo: os dois times sobem juntos e a vantagem relativa de 3k de ouro vale ~10% de poder, que o sorteio engole.
2. **Torre anda por um canal próprio.** `accrueSiegePressure` (`src/sim/structures.ts`) acumula dano nas 3 rotas dos 2 lados a cada tick, a partir da força de rota (`state.pressure`, que vem do rating de laning dos jogadores) e de uma bola de neve por contagem de torres (`siegeAdvantage`, expoente 3,5, teto 4×). O ouro entra travado em ±3% (`goldStructuralFactor`, teto 1,03). Abates só contam enquanto o inimigo está morto naquele tick (`numbersAdvantage`). Medido: 41% das torres caem sem nenhum abate do time nos 60 s anteriores e sem Barão.
3. **Igualadores somados.** `behindBoost` dá poder extra para quem está atrás na win probability, e o ouro de abate e de bounty é multiplicado por `goldScale = 2,75`. Um double kill chega a render 3-4k e vira a liderança de ouro (11 shutdowns por partida).
4. **Objetivo disputado decidido antes da luta.** `resolveContestedObjective` sorteia o dono pelo `securePower` antes de resolver a luta no poço. Daí o roubo de Ancião logo depois do próprio ACE (19 de 512 roubos).

Ablação (N=600): `comebackElasticity = 0` leva "vencedor com mais abates" de 45% a 59%; `goldScale = 1` não muda nenhuma partida, porque o ouro só pesa em termos relativos. Ou seja, o problema é de arquitetura, não de constante. É por isso que as Fases 26 e 28 fecharam com bandas de "região de fechamento vazia".

## Objetivo

O vencedor deve emergir da cadeia do LoL real: **luta ou pick ganho → janela de vantagem → objetivo ou torre → ouro → poder de luta**. O sucesso é medido no caminho do app contra as proporções reais (seção "Medição e aceite").

## Decisões do dono do produto

- **Régua nova.** As métricas de realismo do `STACK.md`, medidas no caminho do app, viram o critério de aceite. As regras duras de plausibilidade ficam. O golden é regenerado. A ordem de sorteios (INV-1) pode mudar. Bandas antigas que conflitarem com a referência real são revistas ou aposentadas, com registro escrito.
- **Favorito como em liga real.** O favorito claro vence ~75-85% das partidas isoladas, nunca 100%. Diferença pequena fica perto de 50-60%.
- **Abordagem A, janela de conversão.** O loop de ticks continua. Foram descartadas a "vantagem latente única" (correlaciona tudo por construção e fica previsível) e a reescrita do loop em jogadas (reescrita grande demais para este passo).
- **Objetivo da jungle é disputável mesmo em inferioridade numérica,** principalmente com o jungler vivo (Smite).
- **Em partida muito longa o ouro para de pesar** (build completa); decidem mapa, dragões, habilidade e composição.
- **Três detalhes aprovados com o plano:**
  - com só 1 a mais, a janela toma apenas o objetivo do lado do mapa onde a luta aconteceu;
  - a chance de pick também pesa a vantagem de ouro;
  - a janela não derruba torre antes de 7:00.
- **O slider de Caos mantém o significado** ("o quanto a partida pode virar"). O valor padrão (0,25) é calibrado para reproduzir as estatísticas reais.

## Design

### 1. Fluxo causal

```
luta / pick ganho ──► JANELA de vantagem (inimigos mortos × segundos)
        ▲                     │
        │                     ▼
   poder de luta ◄── OURO ◄── conversão: objetivo disponível ou dano de torre
   (ouro relativo,
    vivos, buffs, elenco)
```

O tick de 15 s, a escolha de intenção por pesos (só os pesos mudam), as regras duras e o determinismo por seed continuam.

### 2. Luta

- **Poder:** continua sendo o de `fightPower`, ou seja `teamSlice("teamfight")` (morto vale 15%), Barão, Ancião, Alma, dragões, traços, capitão, comp e curva de rating. Muda só o termo de ouro.
- **Ouro relativo ao inimigo.** `goldFightMult` deixa de comparar cada jogador com `expectedGoldForRoleAtMinute` e passa a usar a fatia do time no ouro total da partida (participação dobrada para que a paridade valha 1, elevada a um expoente, com teto e piso), modulada pela elasticidade por classe que já existe (carry escala mais com ouro, tank menos). A forma é invariante à escala do ouro. O expoente é calibrado para a vantagem de ouro aos 20' reproduzir a tabela real de vitória da partida (1,5-3k → ~75%, 3-5k → ~90%). `goldSecureMult` segue a mesma mudança.
- **Saturação de item (pedido do dono do produto).** Em partida muito longa todo mundo fecha a build, e o ouro para de fazer diferença: sobram mapa, dragões, habilidade e composição. O peso do ouro no poder de luta e de objetivo é multiplicado por uma relevância que vale 1 enquanto o time mais pobre tem menos de 12.000 de ouro por jogador e cai linearmente até 0 em 18.000 por jogador (build completa). Isso começa perto dos 32-35 min de uma partida típica e zera perto dos 45-50 min. Os outros termos do poder (Alma, dragões, Barão, Ancião, traços, comp, curva de rating, escalonamento) continuam valendo.
- **Sorteio mais estreito.** O fator uniforme por lado passa de ±42,5% para ±`w`, com `w = 0,08 + 0,48 × Caos` como ponto de partida: ±8% no Caos 0, ±20% no Caos padrão (0,25) e ±56% no Caos 1. Os dois coeficientes são calibrados pelo critério "favorito com gap 5+ vence 75-85%" no Caos padrão.
- **Sai o `behindBoost`.** O comeback passa a viver só na economia (seção 3, recompensa de objetivo).
- **Contagem de baixas, teto por fase, multikill e ACE:** sem mudança.

### 3. Economia

Valores reais conferidos na wiki oficial (torre, assistência) e no patch 14.21 (bounties):

- **Sai o multiplicador `goldScale` (2,75).** Todos os valores ficam em ouro real. A escala de ouro (`goldScale`, `scaleGold`, `unscaleGold`) é removida do motor.
- **Ouro do time = soma do ouro dos jogadores.** Fonte única. Hoje `team.gold` e `player.gold` são contas separadas, e a assistência não entra no time.
- **Abate:** 300; first blood: 400. Assistência: metade do valor do abate, dividida entre quem ajudou.
- **Bounty (modelo 14.21, simplificado):**
  - cada jogador acumula bounty de 1 a cada 4 de ouro ganho em abates e assistências;
  - perde 1 a cada 4 de ouro entregue ao morrer;
  - o bounty pode ficar negativo até −200 (abate passa a valer no mínimo 100).

  O abate vale 300 + bounty. Ser abatido zera o bounty positivo, e o excedente acima de 700 passa para a próxima vida. É "shutdown" quando o bounty for ≥ 150.
- **Fontes que existem no jogo e faltam no motor:**
  - **torres:** externa 250 (175 local + 75 global), interna 225, do inibidor 250, cada uma creditada ao time;
  - **torres do Nexus e inibidor:** 50 cada (aproximação);
  - **placa:** 125, creditada ao time (hoje fica só em `laneState`);
  - **Barão:** 300 para cada jogador vivo.

  O bônus de primeira torre (`FIRST_TURRET_BONUS`) continua.
- **Farm passivo:** só vivos farmam, como hoje. A taxa base é recalibrada para o GPM médio por time ficar em ~1.830 sem o 2,75, e a vantagem de rota (`laneLead`) acrescenta farm à rota que está ganhando.
- **Comeback = recompensa de objetivo.** Se o time está atrás no ouro além de um limiar e conquista dragão, torre ou Barão, ganha ouro extra proporcional ao déficit, com teto.
  - **Ponto de partida:** ativa com déficit ≥ 1.500; valor = 25% do déficit, teto de 2.500 por objetivo; o Caos escala o valor.
  - **Ajuste:** limiar, fração e teto são calibrados pela trava "vencedor atrás no ouro ≤ 5%" e pela curva de vitória por vantagem de ouro.

### 4. Janela de conversão

**Abertura.** Depois de qualquer resolução de luta ou pick no tick, se um lado tem mais jogadores vivos que o outro, esse lado está em janela. A janela não guarda cronômetro: dura enquanto a vantagem numérica existir, e quem mede isso são os tempos de renascimento que o estado já tem. O estado guarda só o lugar e o instante da última luta ganha (`lastFightWon: { side, place, atSec }`), para escolher a rota e escrever o texto do evento.

**Consumo.** Em cada tick em que um lado tem vantagem numérica e pelo menos 3 vivos, a intenção sorteada desse lado é substituída pela conversão, nesta prioridade:

1. Barão ou Ancião disponível;
2. dragão disponível;
3. Arauto ou larvas disponíveis;
4. dano de torre na rota da última luta ganha (se ela não tiver torre de pé, a rota mais avançada). Esse dano escala com a vantagem numérica e não passa pelo sorteio de força do caminho de intenção. Depois que a última torre do inibidor de uma rota cai, a conversão segue para o inibidor, as torres do Nexus e o Nexus.

**Objetivo épico na janela (regra da Smite).**
- **Jungler do time em desvantagem vivo:** o objetivo é disputável. O time decide se contesta. A chance de contestar cresce com a importância do objetivo (Barão/Ancião > dragão > Arauto/larvas) e cai com a diferença numérica. Se contestar:
  - **roubo:** chance pelo nível de objetivo do jungler e pelo traço `baron_stealer`, reduzida pela diferença numérica;
  - **luta:** acontece em inferioridade numérica, então quem contesta pode perder mais gente.
- **Jungler morto:** roubo só por acaso raro (2%, como `stealChanceFor` já faz). O objetivo sai sem disputa, salvo se o time ainda tiver número para brigar.
- **Inimigo todo morto:** nada a disputar.

**Regras que continuam.** `structureTimePlausibility` (nenhuma torre antes de 7:00), Barão só depois de 20:00, freio de uma estrutura por tick (`lastAnyStructureDestroyedAtSec`).

**Eventos.** O texto mostra a causa. Exemplos: "Com dois a mais depois da luta no rio, a T1 derrubou a torre interna do meio." e "Após o ACE, a Gen.G confirma o Barão."

### 5. Estruturas

- **`accrueSiegePressure` fica restrito à fase de rota** (antes de 14:00, quando as placas caem) **e à torre externa.** Ele empurra placas e torre externa pela vantagem de rota (`laneLead`, prioridade, ganks convertidos).
- **Removidos:** `siegeAdvantage` (bola de neve por contagem de torres) e `goldStructuralFactor` (travado em ±3%). A vantagem estrutural passa a vir da janela e do ouro (via poder de luta).
- **Depois de 14:00, torre cai por três caminhos:**
  1. janela de conversão (o principal);
  2. cerco com Barão ou Ancião;
  3. `resolveStructurePressure` pelas intenções de pressão e split push, que continua exigindo pressão de rota ou buff.
- **Fechamento:** com o Nexus exposto, continua como hoje.
- **`lateRamp` (a partir de 35'):** continua, para nenhuma partida travar no teto de 60'.
- **Timing da 1ª torre:** vai se mover, porque hoje quem a derruba é o canal de cerco. É medido e registrado, mas o ajuste fino do calendário (alvo ~16 min) é trabalho do item 2 (fora de escopo). Trava: a mediana não pode sair de [8:00; 20:00].

### 6. Objetivos fora da janela

- **Disputado** (os dois times escolheram o mesmo objetivo disponível):
  1. resolve primeiro a luta no poço;
  2. quem sai da luta com vantagem numérica leva, sujeito à regra da Smite da seção 4 para o jungler do outro lado;
  3. com a luta empatada (sem mortes ou baixas iguais), decide o duelo de Smite (`securePower` + sorteio, como hoje), e o roubo é possível pelo `stealChanceFor`.

  Sai o sorteio de dono antes da luta.
- **Sem disputa:** sem mudança.
- **Peso de vitória dos objetivos vem do efeito,** sem número mágico:
  - Barão: buff de cerco e de luta + 300 de ouro por vivo;
  - Alma: poder permanente;
  - Ancião: execução.

  Critério: "1º Barão vence ~85%" e "Alma vence ~90%" saem como consequência medida.

## Medição e aceite

**Harness.** `tmp/realism-audit.ts` vira `scripts/realism-audit.ts`, com o script npm `realism`. Os cenários são o caminho do app (rosters reais + campeões fearless, cenário principal) e o sintético 75×75 (controle), com N=1500 e seed = índice da partida. O relatório é escrito em `docs/diagnostics/realism-audit.txt`. É relatório, não teste: os asserts de aceite ficam num gate separado (`scripts/calibrate-realism.ts`, rodado por `npm run calibrate:realism`), no padrão dos gates existentes descrito em `scripts/README.md`.

**Critérios de aceite** (cenário principal; referência real entre parênteses):

| Métrica | Banda |
|---|---|
| Líder de abates aos 20' vence | 70%-82% (76,4%) |
| Líder de ouro aos 15' vence | 66%-78% (71,6%) |
| Líder de ouro aos 20' vence | 72%-84% (78,2%) |
| Líder de ouro aos 25' vence | 77%-89% (83,0%) |
| Abates vencedor ÷ perdedor (médias) | 1,8-2,6 (2,15) |
| Vencedor termina com mais abates | ≥ 85% |
| Vencedor termina atrás no ouro | ≤ 5% |
| Diferença de ouro vencedor − perdedor no fim, média | 7k-13k (10k) |
| GPM por time | 1.650-2.050 (1.833) |
| GPM vencedor ÷ perdedor | 1,12-1,26 (1,19) |
| Time do 1º Barão vence | 78%-90% (85,4%) |
| Time da Alma vence | 84%-95% (90,8%) |
| Time da 1ª torre vence | 62%-75% (68,2%) |
| Roubos ÷ objetivos épicos tomados | ≤ 3% |
| Favorito com gap de elenco ≥ 5 (média de lanePhase/midGame/lateGame) vence | 75%-85% |
| Favorito com gap de elenco < 1 vence | 45%-55% |

**Travas (não podem ser violadas):**
- regras duras de plausibilidade em zero: torre antes de 7:00, Barão antes de 20:00, triple ou mais antes de 8:00, ACE antes de 8:00;
- duração média entre 29 e 36 min;
- fração no teto de 60' abaixo de 0,5%;
- mediana da 1ª torre em [8:00; 20:00];
- mesma seed gera a mesma partida.

**Acompanhado sem gate** (itens 2-3 da lista, registro antes e depois): abates por partida, abates por minuto, first blood, 1ª torre, 1º dragão, Barão no spawn, Elder, curva por minuto.

## Testes

- **Unitários das peças novas:**
  - janela: abre com vantagem numérica, prioridade de consumo, regra da Smite com jungler vivo e morto, ACE sem roubo;
  - ouro relativo no poder de luta: paridade vale 1, monotonicidade, invariância à escala;
  - economia: abate, first blood, assistência dividida, bounty acumulando e zerando, piso de 100, torre, placa, Barão por vivo, recompensa de objetivo só para quem está atrás;
  - objetivo disputado: dono decidido pela luta.
- **Determinismo:** a mesma seed gera a mesma timeline.
- **Golden:** regenerado no fim, com o diff documentado em `docs/diagnostics/`.
- **Bandas antigas:** os gates `calibrate:*` e os testes com bandas numéricas são rodados. Cada um que conflitar com a régua nova é atualizado para a referência real ou aposentado. A decisão de cada um fica em `docs/diagnostics/luta-mapa-vitoria-bandas.md`, com o número antes e depois e a justificativa. Nenhum teste é removido sem registro.

## Ordem de implementação

Cada etapa termina com medição pelo harness e registro do que ela moveu:

1. **Harness:** `scripts/realism-audit.ts` + gate `calibrate:realism`, com a medição do motor atual como linha de base.
2. **Economia:** valores reais, ouro do time como soma dos jogadores, novas fontes de ouro, bounty, fim do `goldScale`.
3. **Luta:** ouro relativo, sorteio estreito ligado ao Caos, fim do `behindBoost`, recompensa de objetivo.
4. **Janela de conversão.**
5. **Estruturas:** cerco restrito à fase de rota, fim do `siegeAdvantage` e do `goldStructuralFactor`.
6. **Objetivo disputado** decidido pela luta.
7. **Calibração final** contra as bandas, golden regenerado, revisão das bandas antigas e trava de replay solo (seção "Riscos").

## Fora de escopo

- **Item 2, calendário do early game:** first blood ~5 min, nenhum abate antes de ~1:30, dragão ~9 min, 1ª torre ~16 min, Arauto e Barão no spawn.
- **Item 3, volume de abates:** 27 por partida.
- **Item 4, textura:** tempo contínuo dentro do tick, ações simultâneas no mapa, finais variados.
- **Interface:** o slider de Caos muda o que controla por dentro, mas não muda na tela. A única mudança de tela é a trava de replay solo (seção "Riscos").

## Riscos

- **Mais decisividade pode encurtar partidas.** A trava de duração (29-36 min) e o `lateRamp` seguram. Se a média cair abaixo de 29, a calibração do sorteio de luta e da recompensa de objetivo é o primeiro ajuste.
- **Sem o `goldScale`, o ouro absoluto muda em todo lugar que lê ouro.** Leitores: HUD, `computeWinProbability` (peso zero hoje), contexto de `deathQuality`, `laneState`. Todos são revistos na etapa 2.
- **Partidas salvas (replay por seed) mudam de timeline.** O motor novo refaz uma seed antiga como outra partida.
  - **Sala multiplayer:** já se protege. `server/room/replay.ts` confere campos e hash da timeline e responde "gravação indisponível".
  - **Modo solo:** não se protege. `src/App.tsx` refaz a timeline pela seed e a exibe com o vencedor gravado, então um torneio salvo antes da mudança pode mostrar o outro time vencendo.

  **Incluído neste trabalho (etapa 7):** no replay solo, se o vencedor da partida refeita não bater com o `winnerId` gravado, a tela mostra "gravação indisponível" em vez da timeline, no mesmo espírito da sala. Este trabalho não promete compatibilidade de replay de séries antigas.
