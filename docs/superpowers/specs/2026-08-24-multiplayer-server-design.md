# Design — Servidor de Salas Multiplayer (LoL 7 a 0)

**Data:** 2026-08-24
**Status:** Aprovado em brainstorming; pronto para virar plano de implementação
**Escopo:** Camada de servidor + modo sala do cliente. Não altera a engine, o draft solo nem o torneio existentes.

## 1. Contexto e problema

Hoje o app é 100% client-side (SolidJS + Vite): dados vêm de `public/players.json` via `fetch`, ajustes ficam em `localStorage`, e o torneio é sempre 1 humano contra 7 bots. Não existe backend.

O objetivo é jogar com amigos em outros lugares: o host sobe um servidor na própria máquina sob demanda, manda um link, e de 2 a 8 pessoas draftam juntas e disputam o mesmo bracket.

Um segundo builder trabalha no mesmo repositório, em outro computador, sincronizando por `origin` (GitHub). A divisão combinada é: **ele mexe no jogo, este trabalho mexe no servidor.** O design é construído em torno dessa restrição.

## 2. Objetivos

- Host sobe um processo com um comando e obtém um link para compartilhar.
- Sala de 2 a 8 humanos; bots preenchem até os 8 times do bracket.
- Draft compartilhado por turnos, com baralho comum que encolhe.
- Base de jogadores no servidor, editada só pelo host.
- Assistir às Bo5 individualmente (padrão) ou em modo sincronizado.
- Eliminado vira espectador; todos eliminados votam continuar ou parar.
- Reconexão por link; quem cai tem o bot assumindo o turno.

## 3. Não-objetivos

- Hospedagem 24/7, contas, senhas ou qualquer identidade persistente além do apelido.
- Múltiplas salas por servidor.
- Bracket de tamanho variável (segue fixo em 8 times / 14 séries).
- Mudanças na engine de simulação, no `PlaybackScreen` ou nas telas de torneio existentes.

## 4. Decisões

| # | Decisão | Razão |
|---|---------|-------|
| D-01 | Servidor Node autoritativo, não relay | O navegador do host não pode ser a fonte de verdade: fechar a aba encerraria a noite, e a lógica de sala nasceria dentro do território do outro builder. |
| D-02 | Um processo servindo `dist/`, `/players.json` e `/ws` na mesma porta | Uma porta, um túnel, um link. |
| D-03 | O servidor roda as partidas e distribui `StoredGame` | `StoredGame` já carrega a timeline completa e o `PlaybackScreen` reproduz sem re-simular. Não é preciso confiar no determinismo entre máquinas diferentes. |
| D-04 | Servidor importa o código do jogo só através de `server/engine/` | Ponto único de reparo quando o outro builder mudar assinaturas na v2.1. |
| D-05 | Draft round-robin em ordem serpentina, mão individual tirada de baralho comum | Regra definida pelo dono do produto. Serpentina evita punir quem escolhe por último. |
| D-06 | `generateRound` consumido sem alteração, com `usedPersonIds` = união da sala | A função já é pura e semeada; a mudança de regra cabe no argumento. |
| D-07 | Bracket avança rodada a rodada, com barreira de "todos prontos" | Evita revelar o campeão enquanto alguém ainda assiste às quartas. |
| D-08 | `userFrameTeamId` fixo em `teamA` nas séries humano×humano | Espelhar a timeline exigiria mexer no playback — território do outro builder. Limitação conhecida. |
| D-09 | Estado da sala inteiro em cada atualização; sem protocolo de delta | O estado é pequeno; timelines viajam separadas e sob demanda. |
| D-10 | Base editável só no lobby | Alterar a base no meio de um torneio invalidaria times já draftados. |
| D-11 | Bots participam da ordem de draft e escolhem instantaneamente; `buildBotRosters` não é usado no modo sala | `buildBotRosters` monta 7 times de uma vez, número fixo, sem respeitar o baralho compartilhado. No modo sala os bots precisam consumir o mesmo baralho, na sua vez, como todo mundo. |
| D-12 | A regra de escolha do bot por carta vive em `server/engine/botPick.ts` | `BotTeamBuilder` só expõe `buildRoster` (time inteiro); o `weightedPick` interno (peso = `roleStrength + 1`) não é exportado. O servidor replica a mesma regra em ~15 linhas em vez de pedir mudança no arquivo do outro builder. |
| D-13 | No modo sala, a pessoa levada some para **todos** — inclusive para os bots **Substituída em 2026-10-02 (A-01/A-02 de 2026-10-02-pack-amigos-design.md).** | Diverge do D-04 do jogo solo (que permite a mesma pessoa em times diferentes) por decisão de produto: a disputa pelo baralho é o que dá graça à sala. |

## 5. Arquitetura

```
server/
  main.ts            arranque, flags (--port, --tunnel), impressão dos links
  http.ts            estático (dist/) + /players.json + /api/*
  ws.ts              conexões, heartbeat, roteamento de mensagens
  protocol.ts        schemas Zod de todas as mensagens (fonte de verdade)
  room/
    state.ts         máquina de estados pura da sala
    draft.ts         baralho, mãos, turnos, timeout
    tournament.ts    orquestração de rodadas e séries
    persistence.ts   snapshot atômico em server/data/
  engine/
    index.ts         ÚNICO import do código do jogo (adaptadores + contrato)
src/
  net/               transporte e store da sala no cliente
  room/              telas: lobby, draft de sala, bracket, espectador
```

Fluxo: o cliente abre a URL, carrega o app estático, conecta no `/ws` e passa a espelhar o estado da sala. O servidor decide tudo que é compartilhado; o cliente decide só o que é local (velocidade de playback, qual série assistir, destaque do próprio time).

**Execução.** `npm run server` sobe o processo (assume `dist/` pronto); `npm run play` faz `build && server`. Com `--tunnel` e `cloudflared` instalado, o servidor sobe o túnel e imprime o link https; sem ele, imprime a URL de LAN e as instruções. Dependências novas: `ws`, `sirv`, e `tsx` como dev.

## 6. Ciclo da sala

`lobby` → `draft` → `tournament` → `finished`

**Lobby.** Cada um entra com apelido e nome de time e recebe um `clientId` guardado no `localStorage` do navegador — é ele que permite reconectar e retomar o time. O host é identificado por um token impresso no console (`?host=<token>`). Com 2 a 8 pessoas, o host começa.

**Draft.** Os 8 times — humanos e bots — entram numa única ordem sorteada e draftam em 5 voltas serpentinas (1→8, 8→1, ...). Na vez de alguém, o servidor tira do baralho uma carta por rota ainda aberta para ele — 5 na primeira volta, 4 na segunda, até 1 na quinta — via `generateRound(players, filledRoles, usedPersonIds, rng, seenCardIds)`, onde `usedPersonIds` é a união das pessoas já levadas por **todos** da sala (D-13) e `seenCardIds` continua individual. A carta escolhida sai do baralho para sempre; as outras voltam e podem cair na mão de outro depois.

Bots escolhem na hora, com a regra de peso replicada em `server/engine/botPick.ts` (D-12). Turno humano tem relógio (60s por padrão, ajustável pelo host); estourou ou o jogador caiu, o mesmo `botPick` escolhe por ele e a sala segue.

**Torneio.** Fechado o draft, o servidor converte os 8 rosters em `TournamentTeam` (nomes de bot via `assignTeamIdentities`, que já é exportado) e chama `createTournament(seed, teams)` — que não exige time humano, apenas 8 times. Então avança **uma rodada do bracket por vez**: roda todas as séries daquela rodada (humanas e de bots) via `runSeriesGame`, guarda os `StoredGame` e libera as timelines. A rodada seguinte só abre quando todos os jogadores **ainda vivos** marcarem "pronto" — ou quando o host forçar. Espectadores eliminados não travam a barreira.

**Assistir.** Padrão: cada um reproduz a própria série no `PlaybackScreen` existente, com pause e velocidade próprios. Modo sincronizado (ligado pelo host): o servidor dita o relógio e todos veem o mesmo minuto da mesma partida. Eliminado escolhe qual série da rodada acompanhar e recebe só a timeline pedida. Com todos os humanos eliminados, o servidor abre votação: maioria decide entre simular o resto do bracket para assistir ou encerrar no pódio. Empate mantém o torneio rodando.

## 7. Protocolo

JSON sobre WebSocket, validado por Zod nas duas pontas, com `protocolVersion` constante. Versão divergente recebe `protocolMismatch` e um pedido de reload.

**Cliente → servidor:** `hello` (protocolVersion, clientId?, nickname, teamName, hostToken?), `startDraft` (turnSeconds), `pick` (cardId), `ready`, `setWatch` (slotId), `setSyncMode` (enabled), `playbackControl` (action, gameIndex, ms), `vote` (continue), `publishBase` (players), `forceAdvance`, `pong`.

**Servidor → cliente:** `welcome` (clientId, you, protocolVersion), `roomState` (snapshot completo), `hand` (cards, deadline — só para quem está na vez), `games` (slotId, storedGames), `syncTick` (slotId, gameIndex, ms), `error` (code, message), `protocolMismatch`, `ping`.

O `roomState` carrega fase, jogadores (apelido, time, conectado, rotas preenchidas, eliminado), configurações, estado do draft (ordem, vez, volta, cartas restantes, prazo) e uma **visão reduzida do torneio** — placares, vencedores e status, sem os arrays de eventos. As timelines completas viajam só na mensagem `games`, e só para quem está assistindo aquela série.

## 8. Base de jogadores

`server/data/players.json` é a base da sala, copiada de `public/players.json` na primeira subida. O servidor a serve em `/players.json`, de modo que `loadPlayers()` funciona sem alteração. O host edita como sempre (`PlayerEditor` + overrides locais) e aciona "publicar base" na tela de sala; o servidor valida com `PlayerDatabaseSchema`, grava de forma atômica (tmp + rename) e mantém o backup anterior. Base inválida é recusada com erro explícito. Publicação é permitida apenas na fase `lobby`.

## 9. Persistência e falhas

A sala vive em memória, com snapshot atômico em `server/data/room.json` a cada mudança. Se o processo cair, subir de novo restaura a sala e os amigos reconectam pelo mesmo link. `server/data/` entra no `.gitignore`.

Mensagem inválida é descartada e logada — nunca derruba a sala. Heartbeat a cada 10s; 30s sem resposta marca o cliente como caído e, se for a vez dele, o bot assume. Exceção da engine ao rodar uma série marca aquela série como falha e avisa a sala, em vez de matar o processo.

## 10. Testes

1. **Estado puro (maior parte do valor).** A máquina de estados da sala não depende de WebSocket: draft serpentino, baralho encolhendo, cartas não escolhidas retornando, timeout virando bot, reconexão por `clientId`, barreira de "todos prontos", votação final.
2. **Contrato com o jogo.** Testes em `server/engine/` fixam as assinaturas importadas (`generateRound`, `createTournament`, `runSeriesGame`, `advanceSlot`, `assignTeamIdentities`, schemas de dados). Mudança do outro builder quebra no `npm test`, não na noite de jogo. Um teste extra vigia o `botPick`: se a regra de peso do `BotTeamBuilder` mudar no jogo, o teste acusa a divergência (D-12).
3. **Integração.** Dois clientes WebSocket falsos jogam um draft completo contra o servidor real, in-process.

Tudo em Vitest, que já está no repositório.

## 11. Superfície de conflito com o outro builder

**Arquivos novos:** todo `server/**`, `src/net/**`, `src/room/**`, `tsconfig.server.json`.

**Arquivos existentes tocados:** `src/App.tsx` (entrada do modo sala, ~10 linhas), `package.json` (scripts e dependências), `.gitignore` (`server/data/`), `vitest.config.ts` (uma linha, incluindo `server/**/*.test.ts` — é o que faz o teste de contrato quebrar no `npm test` do outro builder; sem isso a rede de segurança não existe).

O `tsconfig.json` **não** é tocado: ele inclui apenas `src`, então o `npm run build` dele nunca typecheca o servidor. O servidor tem o seu próprio `tsconfig.server.json`.

**Consumido só como leitura:** `src/data/schema.ts`, `src/draft/orchestrator.ts`, `src/tournament/{bracket,series,seeds,schema,teamNames}.ts`, `src/sim/rng.ts` e `src/sim/**`.

`src/data/loader.ts` fica **fora** da lista: ele faz `fetch("/players.json")`, caminho que só existe no navegador. O servidor lê a base do disco e valida com `PlayerDatabaseSchema`.

## 12. Limitações conhecidas

- Em série humano×humano, a timeline é enquadrada pelo `teamA`; a UI se apoia nos nomes reais dos times para o jogador achar o seu lado.
- Um servidor hospeda uma sala.
- Sem autenticação: quem tem o link entra. Aceitável para uma sala efêmera entre amigos.
- O link depende de túnel externo (`cloudflared`/ngrok) ou de rede local.
- A regra de escolha do bot fica duplicada entre o jogo e o servidor (D-12). É pequena e vigiada por teste, mas é duplicação — some no dia em que `weightedPick` for exportado.

## 13. Restrições herdadas do Plano 1 (ler antes de planejar o Plano 2)

Três coisas que só apareceram durante a execução e que o próximo plano precisa respeitar:

- **Broadcast não pode ser o padrão daqui pra frente.** `server/ws.ts` entrega `to: "all"` para **todo** socket conectado, inclusive um que ainda não mandou `hello` ou cuja entrada foi recusada. Hoje isso é inofensivo porque `RoomWire` não carrega segredo nenhum. As mensagens do Plano 2 e 3 carregam: a mão de cartas de um jogador (`hand`) e a timeline de uma série (`games`) **nunca** podem usar `to: "all"` — precisam endereçar socketIds específicos.
- **`M3 × I4` são um par acoplado.** O token do host é apagado da URL na primeira carga (para não vazar em screen share), então um host que recarrega a página reconecta **sem** token e só mantém o papel por causa do `existing.isHost ||` no ramo de reconexão do `joinRoom`. Mexer num sem o outro tira o host do próprio jogo.
- **Múltiplos hosts simultâneos são possíveis por construção.** Qualquer `clientId` que apresente o token vira host, e ninguém é deposto. É consequência direta de nunca revogar host numa reconexão sem token. Se o Plano 2 precisar de host único, terá que resolver o conflito explicitamente.

## 14. Decisões do Plano 2 (draft compartilhado)

Tomadas ao planejar o draft, depois que a execução do Plano 1 e a base real do
repositório mostraram coisas que o desenho original não previa.

| # | Decisão | Razão |
|---|---------|-------|
| D-14 | O draft só abre com **8 pessoas distintas por rota** na base da sala. O lobby mostra o diagnóstico por rota o tempo todo; o `startDraft` recusa com a conta exata do que falta. **Substituída em 2026-10-02 (A-01/A-02 de 2026-10-02-pack-amigos-design.md).** | Decisão do dono do produto. O D-13 (a pessoa levada some para todos) e 8 times exigem 40 pessoas distintas, 8 por rota. O `players.json` do repositório tem 4 por rota — a sala precisa de uma base publicada antes da primeira noite de jogo, e precisa dizer isso antes de alguém esperar. |
| D-15 | `server/engine/` passa a ter dois arquivos: `schema.ts` (puro, seguro no navegador) e `index.ts` (disco). | O D-04 sempre falou do **diretório**; o Plano 1 usou um arquivo só porque bastava. O `protocol.ts` precisa do `PlayerVersionSchema` e roda nas duas pontas — se importasse do `index.ts`, o `node:fs` entraria no bundle do navegador. A regra não muda: nenhum arquivo fora de `server/engine/` importa de `src/`. |
| D-16 | O relógio do turno viaja como **tempo restante em ms**, nunca como instante absoluto. | O prazo é calculado no relógio do servidor e lido no relógio de quem joga. Máquinas diferentes têm relógios diferentes; mandar epoch faria o contador aparecer estourado ou eterno na tela de alguém. |
| D-17 | Assento humano desconectado recebe 15s de carência em vez do turno cheio; reconectar na sua vez devolve o turno cheio. | O texto original ("ou o jogador caiu, o bot escolhe por ele") escolheria por quem só recarregou a página. A carência protege o recarregamento sem deixar a sala parada um minuto por turno de quem foi embora. |
| D-18 | O snapshot guarda **ids de carta**, não cartas inteiras; a base vem do disco no arranque. Versão do snapshot vai para 2 e snapshots v1 são descartados. | Um snapshot com 40 cartas inteiras seria gravado a cada pick. O D-10 já congela a base durante o draft, então os ids sempre resolvem. |
| D-19 | As cartas já escolhidas são públicas para a sala inteira; a **mão** de quem está na vez é privada. | O D-13 já torna o baralho conhecimento compartilhado — esconder quem levou quem só atrapalharia. A mão é o contrário: é a decisão que está sendo tomada. |
| D-20 | O fio carrega um `publicId` por jogador; o `clientId` nunca sai do `welcome` de quem é dono dele. | O Plano 1 difundia o `clientId` de todo mundo no `roomState`, e o `clientId` é justamente a credencial de reconexão. Com um draft em jogo, isso deixaria qualquer um da sala assumir o assento e o time de outro. |
| D-21 | Terminado o draft, a fase continua `draft` com `finished: true`. | A transição para `tournament` é do Plano 3. Fechar aqui deixaria a sala numa fase sem tela. |

## 15. Decisões do Plano 3 (torneio, playback e espectadores)

Tomadas ao planejar o torneio, depois de medir o código real do jogo. Três
medições sustentam quase tudo o que vem abaixo, e estão anotadas onde pesam:
um jogo custa 15–25 ms; a onda mais cara do bracket bloqueia 335 ms e o torneio
inteiro fecha em 0,9 s; a timeline de um jogo ocupa 346 KB e a do torneio
inteiro, 17 MB.

| # | Decisão | Razão |
|---|---------|-------|
| D-22 | Nenhum time da sala se chama `user`. Os assentos viram `assento-0`..`assento-7`, todos com `isUser: false`. `state.userTeamId` e `state.status` do torneio do jogo ficam inertes; a sala calcula eliminação por conta própria e só aproveita `championId` e o `status: "complete"` da Grande Final. | `TournamentState.userTeamId` é `z.literal("user")` e a sala tem até 8 humanos — nenhum é "o usuário". `createTournament` não valida a existência desse time (só documenta), e `advanceSlot` nunca casa `loserId === state.userTeamId`. Efeito colateral bom: `runSeriesGame` cai sempre no enquadramento por `teamA`, que é exatamente o D-08. |
| D-23 | A unidade da barreira é a **onda**: o conjunto de séries em `ready` num dado momento. São exatamente 6 ondas — 4, 4, 3, 1, 1, 1 séries. | O bracket de dupla eliminação não tem "rodadas" alinhadas: `LB_R1` abre junto com `UB_SF`. Onda é a única definição que se sustenta sozinha, e ela cai naturalmente do `advanceSlot`, que já vira `pending` em `ready` quando os dois times ficam conhecidos. |
| D-24 | O servidor roda a onda inteira de forma síncrona, sem worker e sem fatiar. | Medido: 15–25 ms por jogo, 335 ms na onda mais pesada, 0,9 s no torneio inteiro. O heartbeat é de 10 s com corte em 30 s — 335 ms não chega perto. O servidor loga a duração de cada onda; passar de 2 s é sinal de que esta medição envelheceu e a decisão precisa ser revista. |
| D-25 | O snapshot guarda o torneio **sem as timelines**: `events` sai de cada `StoredGame`. Na volta, a timeline é regenerada rodando `runSeriesGame` de novo. `SNAPSHOT_VERSION` vai para 3; snapshots v2 são descartados. | 346 KB por jogo viram 362 bytes — mil vezes menos, num arquivo reescrito a cada mudança da sala. Verificado que `runSeriesGame` é determinística tanto na mesma execução quanto num estado reconstruído do zero: bytes idênticos. A regeneração confere `seed` e `winnerId` contra o que ficou guardado; se divergir, a sala responde "gravação indisponível" em vez de exibir um jogo diferente do que de fato aconteceu. |
| D-26 | `chaosLevel` é ajuste da sala, congelado quando o torneio começa e guardado no snapshot. O catálogo de campeões não é congelado. | Medido: mudar o chaos mudou 32 de 32 jogos; sem ele guardado, a regeneração do D-25 devolveria outra partida. O catálogo, ao contrário, não mudou nenhum jogo em 32 — ele entra só como dado de tela (retrato e nome do campeão), então pode ser lido do disco a qualquer momento. |
| D-27 | A mensagem `games` viaja endereçada, sob demanda e uma série por vez. Nunca `to: "all"`, nunca dentro do `roomState`. | Mesma regra da mão do Plano 2 (spec §13), pelo mesmo motivo e com um payload muito maior: 346 KB por jogo, até 1,7 MB numa Bo5, 17 MB o torneio inteiro. Difundir isso derrubaria a sala num túnel. |
| D-28 | Modo sincronizado é "mesma série, mesmo jogo, começando juntos" — **não** é relógio compartilhado. Em sincronia, os controles de velocidade ficam desligados. A mensagem `syncTick` da §7 não é implementada; o estado de sincronia viaja dentro do `roomState`. | O `PlaybackScreen` tem relógio próprio em `requestAnimationFrame` e não aceita posição inicial nem clock externo — sincronizar quadro a quadro exigiria uma prop nova nele, e `src/playback/**` é território do outro builder. A deriva entre telas fica na casa dos segundos ao longo de uma partida. Limitação conhecida: sincronia de verdade volta à mesa no dia em que o `PlaybackScreen` aceitar `startAtMs`. |
| D-29 | A barreira conta os humanos **vivos e conectados**. Depois que a votação decide "continuar", passa a contar todos os humanos conectados, eliminados inclusive. | Com todos eliminados, uma barreira que só conta vivos fica sem ninguém para esperar e dispara o bracket inteiro sozinho — o oposto do que a votação pediu. Quem está desconectado não trava a sala (mesmo espírito do D-17) e não perde nada: as séries passadas continuam assistíveis. |
| D-30 | O cliente da sala importa `PlaybackScreen` direto, mais os tipos de `src/tournament/schema.ts` e o `tagFromName`. Um teste de contrato em `src/room/` prende essas props. | É a mesma exceção do `src/draft/hints.ts` no Plano 2, com o mesmo remédio: se o outro builder mudar a assinatura, quebra no `npm test` dele, não na noite de jogo. A quarentena do D-04 continua valendo inteira para o **servidor**: nada fora de `server/engine/` importa de `src/`. |
| D-31 | `playbackControl` não tem seek nem pause compartilhado. As ações são `proximoJogo`, `jogoAnterior`, `reiniciar` e `voltarAoChaveamento`; em modo sincronizado, só o host as emite. | Consequência direta do D-28: sem posição inicial no `PlaybackScreen`, "pular para o minuto 12" não tem como ser honrado. Prometer o botão e não mover a tela seria pior que não ter o botão. |
| D-32 | Qualquer série já completa pode ser assistida a qualquer momento, não só a da onda corrente. | Torna inofensivo o caso do D-29 em que a sala avança sem quem estava desconectado, e é praticamente de graça: a timeline é regenerável (D-25). |
| D-33 | A votação fecha quando todos os humanos conectados votarem, ou quando o host forçar. Empate mantém o torneio rodando. Quem não votou não entra na conta. | A §6 já decidiu o empate; o que faltava era quando a urna fecha. Esperar voto de quem fechou o navegador travaria o pódio. |
| D-34 | Sair do draft para o torneio é ação do host (`startTournament`), não automática. | O D-21 deixou a sala parada em `draft`/`finished: true` de propósito. Um instante para todo mundo olhar os 8 rosters antes de o bracket começar vale mais que a transição automática. |

## 16. Limitações do Plano 3, descobertas na execução

Nenhuma delas é defeito em aberto: são consequências assumidas, cada uma com o
motivo de não ter sido resolvida. Estão aqui para não virarem surpresa.

- **Controles de velocidade em modo sincronizado.** O D-28 diz que eles ficam
  desligados em sincronia. Não ficam. Eles vivem dentro do `PlaybackScreen`, que
  é território do outro builder, e desligá-los exigiria uma prop nova lá. A
  alternativa — esconder por CSS ou mexer no DOM alheio — quebraria em silêncio
  na primeira vez que ele tocasse naquele arquivo. Some no dia em que o
  `PlaybackScreen` aceitar controle externo, junto com a sincronia de relógio de
  verdade que o D-28 também abriu mão.

- **Sincronia órfã.** Só o host desliga o modo sincronizado. Se ele cair e não
  voltar, os outros continuam presos à mesma série — mas **o torneio não trava**:
  a barreira não conta quem está desconectado, e as ondas seguem andando.
  Limpar a sincronia a cada queda do host puniria um F5, que é o caso comum.

- **Tráfego de uma troca de série em sincronia.** Quando o host muda a série com
  a sincronia ligada, todo mundo é reapontado e a gravação nova viaja para cada
  um: até 1,7 MB por pessoa, num clique só. É inerente ao que a sincronia
  promete. O envio já é limitado a quem de fato mudou de série.

- **Fila de gravação por processo.** As gravações do snapshot são serializadas
  dentro de um processo. Dois servidores apontando para o mesmo diretório de
  dados continuam sem ordenação entre si — o nome de temporário único evita o
  arquivo rasgado, mas o último a gravar vence. A spec sempre disse um servidor,
  uma sala; isto é o limite dessa premissa dito em voz alta.

- **A rede da quarentena é textual.** Os dois testes que prendem as fronteiras
  (nada fora de `server/engine/` importa de `src/`; `protocol.ts` não alcança a
  metade pesada) seguem literais de caminho no código-fonte, não o resolvedor do
  bundler. Cobrem o que existe hoje e falham alto quando um caminho relativo não
  resolve; um alias de build ou um caminho montado em tempo de execução
  passariam. O projeto não usa alias.

- **O que os testes de tela não exercitam.** As telas da sala são testadas com
  renderização de servidor, sem navegador. Isso prende o que a tela **afirma** no
  primeiro quadro; não dispara evento, não roda o relógio do playback, não mede
  layout e não fala com leitor de tela. A partida avançando, a barra de
  probabilidade se movendo e o placar final aparecendo não têm cobertura
  automática nenhuma — dependem de olho humano.
