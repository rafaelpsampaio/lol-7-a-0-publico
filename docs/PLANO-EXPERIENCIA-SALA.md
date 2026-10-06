# Plano de Ação — Experiência da Sala (MD5)

> **Origem:** mapeamento de UX feito em 2026-08-26, publicado como artifact "Rundown da Sala" (achados completos, com `file:linha` de cada problema). Este documento é o desdobramento em fases de trabalho — vamos marcando os checkboxes conforme avança.
>
> **Fora de escopo em todas as fases:** o motor de simulação (`src/sim/**`) e as regras de vitória/placar em si. O texto de fim de partida bateu errado num caso relatado, mas a causa provável está no motor (dois sinais — vitória e placar — calculados de forma independente, podendo legitimamente divergir); só a *comunicação* disso é trabalho nosso aqui.

**Status legenda:** `[ ]` não iniciado · `[~]` em andamento · `[x]` concluído · `[!]` bloqueado (anotar motivo ao lado)

---

## Visão geral das fases

| # | Fase | Tamanho | Por quê nessa ordem |
|---|------|---------|----------------------|
| 1 | Visibilidade de estado (lobby, espera, avisos) | P | Baixo risco, alto impacto, não toca telas de jogo |
| 2 | Fim de partida: texto e enquadramento de vitória/derrota | P | Contido a 2 arquivos, resolve o bug relatado |
| 3 | Início de partida: champion select na sala | M | O pedido mais explícito (animação tipo LoL antes de cada jogo) |
| 4 | Fim de série: tela dedicada + corrigir "Continuar" | M | Fecha o ciclo aberto pela Fase 3 |
| 5 | Chaveamento: fases nomeadas + bracket em árvore | M/G | Maior lacuna de "sensação de progressão" |
| 6 | Draft: visibilidade de turno e ritmo | P/M | Isolado, não bloqueia nada acima |
| 7 | Pódio: celebração final | P | Polimento, faz mais sentido depois que 3–5 já mudaram o ritmo geral |

P = pequeno (poucos arquivos, sem mudança de protocolo) · M = médio (mexe em protocolo/servidor e cliente) · G = grande (nova estrutura visual)

---

## Fase 1 — Visibilidade de estado

**Status:** `[x]` concluído em 2026-08-26 (1 item de baixa prioridade ficou de fora — ver nota abaixo)
**Objetivo:** parar de deixar o jogador no escuro em momentos de espera. Nenhuma dessas mudanças exige lógica nova — os dados já existem no servidor ou no protocolo, só não chegam à tela.

- [x] Lobby: mostrar aos não-host um estado claro tipo "Aguardando {host} começar" e, se a base estiver com problema, uma versão suavizada do aviso (`src/room/LobbyScreen.tsx:139-202`)
- [x] Lobby: exibir o link de convite (com botão "copiar") dentro da própria tela do host — hoje só sai no terminal (`server/main.ts:140-146`, `server/cli.ts:47-59`)
- [x] Lobby: loading state no botão "Entrar na sala" + aviso quando apelido/time estão vazios (`src/room/LobbyScreen.tsx:42-46, 96-116`)
- [x] Lobby: confirmação positiva de "Base pronta", reaproveitando `baseStatusMessage()` que o servidor já gera (`server/room/baseCheck.ts:50-64`)
- [x] Lobby: indicar "Você é o host" perto do topo, sem depender do jogador notar seções extras
- [x] Bracket: indicador "faltam N séries" para fechar o torneio, ao lado do progresso de onda (`src/room/BracketScreen.tsx:43`)
- [x] Bracket/espera: CTA quando um jogador é eliminado — "Seu time saiu. Acompanhar outro confronto agora?" com atalho direto (hoje ele só descobre voltando sozinho ao chaveamento)
- [x] Espera: redireciona jogadores eliminados para uma série ativa a cada nova onda, em vez de deixá-los presos na última que assistiram (`server/room/tournament.ts` — função nova `autoWatchEspectadores`, separada de `autoWatch`: o `autoWatch` original é preservado intacto porque tem um contrato de teste próprio — "preserva escolha manual de quem não joga na onda" — que um redirecionamento incondicional quebraria)
- [x] Torneio: aviso quando o campeão é definido enquanto alguém ainda assiste outra série (`src/room/SeriesWatch.tsx` — banner com link direto pro pódio)

**Baixa prioridade dentro da fase** (fazer se sobrar tempo, não bloqueia o resto):
- [x] Avisar quando o `hostToken` da URL parece inválido, em vez de rebaixar em silêncio — resolvido 100% client-side (compara `hostToken` recebido por prop com `isHost()` depois de conectar), sem mexer em `server/room/state.ts`
- [x] Esconder/desabilitar "Estou pronto" para quem já é espectador puro — **resolvido em 2026-08-26**: `espectadoresContam` passou a fazer parte do `TournamentWire` (`server/protocol.ts`), preenchido em `toTournamentWire` (`server/room/tournament.ts`). `src/room/BracketScreen.tsx` ganhou `souEspectadorPuro()` (`souEspectador() && espectadoresContam === false`), que esconde o botão sem quebrar o caso pós-votação "continuar" (D-29) — o teste `mostra Estou pronto de novo pro eliminado depois de 'continuar' na votacao (D-29)` trava exatamente esse comportamento.
- [x] Trocar os literais `8`/`2` no contador do lobby por `MAX_PLAYERS`/`MIN_PLAYERS_TO_START` (`src/room/LobbyScreen.tsx`)

---

## Fase 2 — Fim de partida: texto e enquadramento de vitória/derrota

**Status:** `[x]` concluído em 2026-08-26
**Objetivo:** o resultado de cada jogo parar de soar contraditório, e "seu time venceu" passar a ser relativo a quem está de fato assistindo.

- [x] Reescrever o texto de resumo em `PlaybackScreen.tsx` (função `awards()`) separando o fato do placar do fato da vitória — a linha de estatística virou fato bruto ("Partida encerrada em MM:SS — K/D, torres, dragões"), sem "{time} venceu" colado nela; o veredito já está acima, no título
- [x] Tornar "Seu time venceu!" / cor de vitória relativos ao time real de quem assiste, não sempre ao mesmo lado da série — nova função pura `resultadoDoJogo()` em `PlaybackScreen.tsx`, alimentada por um prop `perspectiva` que `SeriesWatch.tsx` calcula comparando o `publicId` de quem assiste com os times da série (`perspectivaDoEspectador()`, mesma ideia do `eMeu` de `BracketSeriesList.tsx`); espectador puro (sem time na série) ganha um terceiro estado — texto em 3ª pessoa, sem viés dourado/vermelho
- [x] Diferenciar visualmente vitória de derrota além do texto/cor — `.result-card--vitoria`/`--derrota`, duas animações de entrada distintas (`src/styles.css`)

**Achado durante a revisão do usuário (não estava no plano original):** um amigo jogando não percebeu que era MD5 — "Seu time venceu!" sozinho, no meio da série, lê como "acabou tudo". Fix aplicado: o veredito agora nomeia o escopo explicitamente ("venceu **esta partida**" vs "venceu **a série**" 🏆, só quando algum lado bate 3 vitórias), a pill de placar ganha um estado visual "ENCERRADA" (borda dourada) diferente de "EM ANDAMENTO", e uma linha nova ("A série continua — falta pelo menos N partida(s) para decidir") aparece enquanto a série não fechou.

**Nota:** manter o achado documentado no artifact original sobre a causa provável (motor calcula vencedor e placar de forma independente) — não investigar mais fundo aqui, é do outro time.

---

## Fase 3 — Início de partida: champion select na sala

**Status:** `[x]` concluído em 2026-08-26
**Objetivo:** cada jogo da MD5 ganhar o momento de antecipação que hoje só existe no modo solo.

- [x] Reaproveitar `src/playback/ChampionSelect.tsx` (já pronto: revelação por rota, botão "Pular") dentro do fluxo de `src/room/SeriesWatch.tsx`, antes de cada `PlaybackScreen`
- [x] Alimentar essa tela com os mesmos dados que `dadosPlayback()` já calcula (`SeriesWatch.tsx`) — não exigiu dado novo do servidor
- [x] Decidir o comportamento em modo sincronizado: **é lockstep, não local por cliente** (decisão do usuário, ver nota abaixo) — `sync` ganhou um campo `stage: "select" | "playback"` (`server/protocol.ts`, `server/room/tournament.ts`), resetado para `"select"` toda vez que o jogo sincronizado muda (`proximoJogo`/`jogoAnterior`/`reiniciar`/troca de série/ligar sincronia) e só adiantado para `"playback"` por uma ação nova, `pularSelecao`, que só o host pode mandar (`server/room/hub.ts`). Fora de sincronia (inclusive quando a sincronia da sala aponta para outra série que não a que esta tela acompanha), o controle continua 100% local — o próprio botão "Pular" do `ChampionSelect` cuida disso, sem tocar o servidor.

**Achado durante a revisão do usuário (não estava no plano original):** a primeira resposta a este item propunha pular sempre local, por cliente. O usuário apontou que isso quebraria a sensação de "evento ao vivo" em sincronia — alguém pulando sozinho entraria na partida antes dos outros, mesmo perspectiva (jogador ou espectador puro) tendo que ver a mesma coisa. Resolvido reaproveitando o mesmo padrão já usado por `restartCount` (D-28, Tarefa 8): um campo em `sync` que só o host altera e que a sala inteira recebe junto via broadcast. A revelação automática (sem clicar em nada) continua correndo local em cada tela, sem round-trip — o temporizador começa no mesmo instante em todo mundo, então já termina "junto" na prática; só o **pular manual** precisava virar uma decisão coletiva.

**Atenção arquitetural (resolvida):** `src/room/**` ampliou a lista combinada do D-30 para incluir `playback/ChampionSelect`, com teste de contrato próprio em `contract.test.tsx` (assinatura de props travada, igual já existia para `PlaybackScreen`).

---

## Fase 4 — Fim de série: tela dedicada + corrigir "Continuar"

**Status:** `[x]` concluído em 2026-08-26
**Objetivo:** fechar cada série MD5 com o mesmo cuidado que a Fase 3 dá para abrir cada jogo, e parar de expulsar o jogador da série no meio dela.

- [x] Corrigir `onPlayAgain={sair}` em `src/room/SeriesWatch.tsx` — vira `continuar()`, que decide via nova função pura exportada `decidirContinuar(serieCompleta, podeNavegar)`: avança pro próximo jogo quando a série não terminou (mesma regra de `podeNavegar` da navegação — convidado sincronizado não decide sozinho), mostra a tela de resultado quando ela terminou
- [x] Trazer um momento de fim de série para o modo sala, reaproveitando `src/tournament/SeriesResultScreen.tsx` (o componente inteiro, não só a copy) — alimentado com `series`/`teams` montados a partir do que a sala já tem (`serie()`, `jogosDaSerie()`, `rosterDoTime()`); `isUser` de cada time vem de comparar com `meuTimeId()` (não de um lado fixo), então espectador puro cai sozinho na copy neutra que o componente já tinha ("{time} avançou") — mesmo princípio do `perspectiva` da Fase 2. Corrigido de passagem um ramo morto em `gameCells()` (nunca disparava no solo, só alcançável pela sala) que tratava "nenhum time é meu" como se fosse o time B
- [x] Ajustar o rótulo do botão de ação conforme o contexto: `PlaybackScreen` ganhou o prop opcional `continueLabel` (padrão "Continuar", solo não muda) — a sala passa "Próximo jogo" no meio da série e "Ver resultado da série" no jogo que decide; `SeriesResultScreen` ganhou o mesmo prop, e a sala passa "Voltar ao chaveamento" no botão de saída da tela de resultado

**Decisão de design:** mostrar a tela de resultado NÃO precisa de lockstep (ao contrário do "pular" da Fase 3) — o jogo que decide a série já é dado final do servidor, igual pra todo mundo, então cada tela pode chegar lá sozinha (via clique local) sem ninguém ficar pra trás. Só o AVANÇO de jogo (quando a série continua) precisa respeitar `podeNavegar`.

**Mesma atenção arquitetural da Fase 3 (resolvida)**: `SeriesResultScreen.tsx` entrou na lista combinada do D-30 (`src/room/contract.test.tsx`), com o mesmo teste de contrato compila-ou-quebra já usado para `PlaybackScreen`/`ChampionSelect`.

---

## Fase 5 — Chaveamento: fases nomeadas + bracket em árvore

**Status:** `[x]` concluído em 2026-08-26
**Objetivo:** o chaveamento da sala parecer um bracket de campeonato de verdade, com a mesma clareza que `BracketView`/`BracketNode` já têm no modo solo.

- [x] Agrupar as 14 séries de `src/room/BracketSeriesList.tsx` por rodada real (Quartas, Semis, Final — superior e inferior), em vez dos 3 blocos genéricos atuais — dois níveis agora: `Chave` (Superior/Inferior, título novo `.room-bracket__chave-title`) contendo as rodadas nomeadas (`RODADAS_SUPERIOR`/`RODADAS_INFERIOR`), cada uma no `SeriesGroup` que já existia. Grande Final continua isolada, sem chave ao redor (sempre foi uma rodada só)
- [x] Substituir ou complementar "Onda X de 6" (`src/room/BracketScreen.tsx`) por um rótulo de fase reconhecível — **complementado**, não substituído (a onda fala da mecânica de liberação simultânea da sala; a fase fala do momento do campeonato, coisas relacionadas mas não a mesma). Nova função pura exportada `faseAtual(series)`: acha, na ordem de dependência de `FASES_DO_TORNEIO` (8 rodadas, verificada contra `SLOT_FEED_IN` de `tournament/schema.ts`), a última rodada que já tem alguma série fora de `pending`
- [x] Portar (ou generalizar) o layout em colunas de `src/tournament/BracketView.tsx` + `BracketNode.tsx` para a sala — **generalizado, não portado como componente** (ver decisão de design abaixo): CSS de colunas lado a lado (`.room-bracket__rounds`) aplicado à estrutura já existente da sala, `SeriesCard` continua sendo o daqui
- [x] Adicionar conectores visuais entre séries (CSS puro, sem SVG) — traço curto antes do título de cada rodada depois da primeira dentro de uma chave, via `::before`; a ordem das colunas já é a ordem de `SLOT_FEED_IN`, então não precisou calcular grafo nenhum em JS
- [x] Destacar visualmente séries recém-liberadas ("prontas para rolar") vs. ainda aguardando alimentação — classes novas `is-ready` (borda + realce dourado, series com times definidos aguardando o primeiro jogo) e `is-pending` (ainda mais apagada que o `--locked` padrão, borda tracejada) em `SeriesCard`
- [x] Adicionar `aria-live="polite"` na seção do bracket da sala, em paridade com o solo (`BracketView.tsx:102`) — junto de `aria-label="Chaveamento do torneio"`, mesmo texto do solo

**Decisão de design:** não reaproveitei `tournament/BracketNode.tsx` como componente, ao contrário do que a Fase 3/4 fizeram com `ChampionSelect`/`SeriesResultScreen`. O modelo de clique diverge: o solo usa um botão de canto ("Iniciar série"/"Ver replay") só ativo em condições específicas; a sala usa o cartão inteiro clicável (`setWatch`) sempre que há jogo pra ver. Forçar `BracketNode` nesse molde distorceria a UX da sala sem necessidade — então só o *conceito* de layout (rodadas nomeadas, colunas lado a lado) foi portado, via CSS puro em cima da estrutura que a sala já tinha. Consequência prática: **nenhuma mudança na lista de importação do D-30** nesta fase — tudo ficou dentro de `src/room/**`, sem protocolo/servidor novo. Risco bem mais próximo de "P" do que o "M/G" que o plano original temia.

Abaixo de 720px as colunas empilham (mesma faixa de responsividade já usada pelo resto da sala) e os conectores somem junto — não fazem sentido numa pilha vertical.

---

## Fase 6 — Draft: visibilidade de turno e ritmo

**Status:** `[x]` concluído em 2026-08-26
**Objetivo:** dar ao draft o senso de fila e de "evento ao vivo" que ele perdeu em relação ao modo solo. Isolado das outras fases — pode entrar em paralelo a qualquer momento.

- [x] Mostrar "próximo: {time}" usando `draft.order` — função pura exportada `proximoDaVez` em `RoomDraftScreen.tsx`, anda uma posição na ordem fixa (Fase 8) e volta ao início no fim da volta. Só ficou simples de escrever depois da Fase 8: com a ordem antiga (serpentina), precisaria saber se a volta é par ou ímpar
- [x] Sinalizar quando uma escolha foi automática (timeout), com aviso para quem perdeu o prazo — exigiu campo novo no fio, `DraftWire.timedOutSeat: number | null` (`server/protocol.ts`), setado só em `RoomHub#onTurnTimeout` (nunca em bot: bot não tem `deadline`, D-17) e desarmado logo depois de montar o broadcast — vale só para o roomState que segue o timeout, qualquer evento seguinte já mostra `null` de novo
- [x] Relógio muda de cor / pulsa abaixo de ~10s — classe `is-urgent` em `.room-draft__clock`, `@keyframes` com `prefers-reduced-motion` desligando a animação
- [x] Toast leve para picks recém-acontecidos, inclusive sequências de bots — função pura exportada `picksNovos` compara o `seats` de dois snapshots consecutivos; cobre sequência de bots porque o hub roda `#driveDraft` (resolve vários bots) antes de mandar UM broadcast só
- [x] Contador geral de progresso ("escolha 12 de 40") ao lado de "Volta X de 5" — usa `turnIndex`/`totalTurns`, que já vinham no fio

**Baixa prioridade dentro da fase:**
- [x] Contagem regressiva real na carência de reconexão (hoje diz "alguns segundos") — **resolvido parcialmente em 2026-08-26**: investigação mostrou que uma contagem *ao vivo* pra quem está desconectado é arquiteturalmente impossível (sem socket, o cliente não tem como saber quando vai virar a sua vez nem receber um deadline novo). O que deu pra fazer sem inventar infraestrutura nova: trocar o "alguns segundos" vago pelo número real e fixo da carência (`DISCONNECTED_GRACE_SECONDS`, já existia em `server/protocol.ts`), em `src/room/RoomDraftScreen.tsx`. Quem está CONECTADO já vê a contagem ao vivo de verdade para o assento atual (inclusive quando esse assento está desconectado e a carência já está reduzida) — isso nunca precisou de mudança nenhuma.
- [x] Revelar estatísticas no roster fechado, como o modo solo já faz — **resolvido em 2026-08-26**: o dado (L/M/F) já chegava completo no fio (`RosterWireSchema` tipa cada rota como `PlayerVersion` inteiro), só faltava desenhar. `src/room/RoomDraftScreen.tsx` ganhou o mesmo padrão "reveal-after-pick" de `src/draft/DraftScreen.tsx`.
- [x] Slider (com exemplo) no lugar do input numérico cru de "Nível de caos" — **resolvido em 2026-08-26**: `src/components/ChaosSlider.tsx` (já usado no solo) ganhou um modo controlado (`value`/`onChange`, opcional — sem props continua preso ao `chaosLevelSignal` global, uso do solo intocado) e passou a ser reaproveitado no draft da sala, que mantém o caos em estado local próprio. A validação manual que existia antes (`caosValido`) virou código morto com o range (só emite valores em `[0,1]`) e foi removida junto.

---

## Fase 7 — Pódio: celebração final

**Status:** `[x]` concluído em 2026-08-26 (itens 1, 2 e 3 — item 3 resolvido em 2026-08-26 como unificação rasa, ver nota abaixo)
**Objetivo:** o maior momento do produto parar de ser o mais apagado — hoje tem menos animação que o fim de uma única partida.

- [x] Dar ao `src/room/PodiumScreen.tsx` algum tratamento de celebração (animação de entrada, destaque do campeão) — `.room-podium__champion` ganhou entrada com bounce (`room-podium-entrada`, mesmo espírito do `card-in-vitoria` do solo) + brilho dourado ambiente contínuo (`room-podium-brilho`) e `text-shadow` no nome, com `prefers-reduced-motion` desligando as duas animações. Só no ramo COM campeão — o ramo "parou por votação" (`.room-podium__stopped`) fica neutro de propósito, não é vitória
- [x] MVP/retrospectiva do torneio inteiro, reaproveitando `src/playback/awards.ts` — **calculado no servidor**, não no cliente: o D-27 existe porque uma timeline chega a 1,7 MB, e 14 séries juntas estourariam isso. Nova função `tournamentAwards` em `server/room/tournament.ts`, reaproveitando `awardScore`/`objectiveValue` de `src/playback/awards.ts` (módulo puro, sem import nenhum — seguro de trazer pro servidor, conferido contra `server/quarentena.test.ts`), agregando por jogador do elenco em TODAS as séries que o time já jogou (generalização do mesmo algoritmo que `SeriesResultScreen.tsx` já fazia só por série). Campo novo no fio, `TournamentWire.awards: { mvp; bagre } | null`, só o resultado pronto — nunca timeline. `PodiumScreen.tsx` reaproveita visualmente `.award`/`.series-awards` que `SeriesResultScreen.tsx` já usa (`src/styles.css`)
- [x] ~~Unificar os dois mecanismos que hoje respondem "quem é o usuário"~~ — **resolvido em 2026-08-26 como unificação rasa, não a unificação completa originalmente cogitada**. Investigado a fundo: `isUser` (`TournamentTeam`) é "quem está assistindo agora", por sala/por pessoa; `userFrameTeamId` (`StoredGame`) é um detalhe de armazenamento decidido no instante da simulação, dentro de `src/tournament/series.ts` — que é a metade pesada que `server/quarentena.test.ts` isola de `server/protocol.ts`, e fica ao lado do cálculo de vitória/placar que esta linha de trabalho vem mantendo fora de escopo desde a Fase 1 (nunca tocou `src/sim/**`). Por isso `userFrameTeamId` continua separado por design — a unificação foi rasa de propósito: um helper `isUserTeam` novo centraliza os 4 lugares que calculavam "é o time do usuário" de forma ad hoc (`src/tournament/schema.ts`, `server/engine/schema.ts`, `src/tournament/bracket.ts`, `src/App.tsx`, `server/room/tournament.ts`, `src/room/SeriesWatch.tsx`), sem tocar `userFrameTeamId`/`series.ts`. Rationale completo na spec `docs/superpowers/specs/2026-08-26-isuser-unification-design.md`

---

## Fase 8 — Draft: ordem fixa (substitui a serpentina do D-05)

**Status:** `[x]` concluído em 2026-08-26
**Objetivo:** corrigir a regra de ordem do draft compartilhado — pedido explícito do dono do produto, contra o D-05 original (`docs/superpowers/specs/2026-08-24-multiplayer-server-design.md:40`). Não faz parte do checklist visual da sala; entrou fora de ordem porque o item 1 da Fase 6 depende da regra estar certa antes de ser desenhado em cima dela.

- [x] `createDraft` (`server/room/draft.ts`) para de alternar `ordem`/`ordem.reverse()` a cada volta — agora repete a mesma `ordem` sorteada em toda volta. Quem abre a mesa abre sempre, em todas as 5 voltas.
- [x] Comentários que citavam "serpentina"/D-05 como a regra vigente (cabeçalho do arquivo, schema de `turns`, o loop de `createDraft`) atualizados para descrever a ordem fixa, mantendo a menção ao D-05 só como contexto histórico da mudança.
- [x] Dois testes de `draft.test.ts` que travavam o comportamento antigo reescritos: "a ordem é serpentina: a volta 2 é o inverso da volta 1" → "a ordem é fixa: a volta 2 repete a volta 1"; e o describe "serpentina completa (A2)" → "ordem fixa: toda volta usa a mesma sequência sorteada" (checa as 5 voltas, não só a invariante de fechamento/abertura que só fazia sentido com inversão).

**Escopo confirmado como isolado:** nenhuma mudança de formato no fio (`DraftWire.order` continua a mesma lista, só passa a valer para toda volta em vez de só a primeira); nada em `src/draft/**` (solo) ou em golden/snapshots depende da serpentina — a busca por "serpentin" no repo, depois da mudança, só aparece nos dois comentários que explicam a mudança em si.

---

## Notas de acompanhamento

_(espaço livre para anotar decisões, bloqueios ou mudanças de escopo conforme as fases avançam — não é preciso formalismo aqui)_

**2026-10-01 — Pacotes 2 a 5 do Rundown da Sala 2 aplicados** (branch `sdd/sala-ponta-a-ponta`, empilhado no do Pacote 1). Design e decisões em `docs/superpowers/specs/2026-10-01-sala-pacotes-2-a-5-design.md` (o usuário escolheu as recomendações: "Pular para o pódio" simula o resto e coroa campeão; Revanche; pacotes do navegador no lobby; só nome + sigla visível). Entregue: (A) partida sem ambiguidade — narração com os nomes dos times em vez de "Seu time"/"Rival", "Você"/sigla por perspectiva na barra de probabilidade e selo VOCÊ no placar, veredito com o nome do time, resumo com siglas, placar de transmissão cabendo em 390 px; (B) a sala como tela própria (o solo não é desenhado; "Sair da sala"/"Voltar para a sala"), cabeçalho com etapas e conexão, reconexão automática com espera crescente e identidade lembrada (sem formulário), espectador para quem chega depois do lobby (protocolo v4), lobby com siglas, bots, trocar nome, remover quem caiu, pacotes do navegador e o que falta para começar; (C) sem spoiler por pessoa (`revelacao.ts`/`vistas.ts`), votação só depois de todos marcarem pronto e dentro do chaveamento, pódio só depois de ver a final; (D) "Rodada N de 6" com o que ela disputa, barra fixa "Pronto para seguir" com "Esperando: você, bia (VVO)", "Assistir juntos" que acompanha o host e deixa o host escolher a série, draft na ordem de escolha com "Sua vez!" e aviso no título da aba; (F) pódio com classificação final, MVP por média por jogo e Revanche. Teste de ponta a ponta (Edge via Playwright, host + 2 convidados + espectadora atrasada, 2 noites, reinícios de servidor, celular a 390 px, votação num cenário montado) achou e corrigiu: cartão de resultado sem saída para o chaveamento, recarregar voltando ao Jogo 1 de série já vista, host fora da própria sincronia, "🏆 Derrota", vice "eliminado", destaques contando só jogos com timeline depois de reiniciar. Fica de fora (fora do multiplayer): Pacote 6 (solo) e a unificação visual do portal inteiro.

**2026-10-01 — Pacote 1 do Rundown da Sala 2 aplicado.** Plano em `docs/superpowers/plans/2026-10-01-sala-correcoes-da-noite.md`, achados e decisões em `docs/superpowers/specs/2026-10-01-sala-ponta-a-ponta-design.md`. O pacote corrigiu: a partida de quem assiste reiniciando a cada atualização da sala (Tarefa 1, efeitos que reagiam a todo `roomState`); "Ver resultado da série" aparecendo já no fim do Jogo 1; o "Link de convite" que levava o token de host (agora o lobby mostra os links de LAN e do túnel, sem token, e espera o túnel ficar pronto); o eliminado mandado para outra série em vez da própria queda; o veredito "Seu time venceu" para espectador; "Sua equipe foi eliminada" ao perder na chave superior (agora "caiu para a chave inferior"); o indicador "Jogo 1 de 3" (agora "Jogo 1 · MD5"), a falta de saída da partida ("← Chaveamento") e o banner de campeão durante a própria Grande Final; "Falta 1 voto" no singular; e a rolagem que não voltava ao topo ao trocar de tela. O teste de mesa (Edge via Playwright, host e dois convidados, 5 bots) falhou na rodada 1 nos itens 4 e 5: quando o host marcou pronto, ou um convidado recarregou a página, a convidada que assistia ao Jogo 2 voltou à seleção do Jogo 1 e o host saiu do chaveamento. A causa era mais funda que a da Tarefa 1: as funções `tela()` de `RoomEntry` e `RoomScreen` recriavam a tela inteira a cada `roomState`. A Tarefa 1b (`src/room/telaEstavel.ts`) passou a recriar a tela só quando ela muda de verdade; na rodada 2, os 10 itens passaram. Verificação automatizada: typecheck de cliente e servidor limpos; suíte completa 1922/1925 (as 3 falhas são as pré-existentes de `src/sim/**`, que também falham na master). Ficam para depois: voltar à partida pelo card da série recomeça no Jogo 1; o título neutro do resultado da Grande Final diz "<time> avançou." em vez de falar em campeão; e a votação ainda abre no instante em que a onda é simulada (Pacote 3).

**2026-08-26 — as 4 pendências restantes fechadas (Fase 1 item bloqueado + 3 baixa prioridade da Fase 6).** Ordem: `espectadoresContam` no wire e o gate de "Estou pronto" em `BracketScreen.tsx` primeiro (Fase 1), depois os 3 itens de baixa prioridade da Fase 6 em commits separados (aviso de carência, stats reveladas, slider de caos) — ver os checkboxes correspondentes acima para o detalhe de cada um. Nenhum dos quatro precisou tocar `src/sim/**`, o motor, ou os snapshots dourados. Verificação automatizada: typecheck de cliente e servidor limpos; suíte completa 1500/1501 (a única falha é o flake conhecido e pré-existente de `src/sim/structures.test.ts`).

**2026-08-26 — Fase 7 item 3 fechado (unificação rasa de `isUser`).** Helper novo `isUserTeam` (`src/tournament/schema.ts`) centraliza o cálculo de "é o time do usuário", reexportado pro navegador via `server/engine/schema.ts`, e passou a ser usado nos 4 lugares que faziam essa conta ad hoc: `src/tournament/bracket.ts`, `src/App.tsx`, `server/room/tournament.ts`, `src/room/SeriesWatch.tsx`. `userFrameTeamId` (`StoredGame`, dentro de `src/tournament/series.ts`) permanece separado por design — é decidido no instante da simulação, na metade pesada que este trabalho vem mantendo fora de escopo desde a Fase 1; rationale completo em `docs/superpowers/specs/2026-08-26-isuser-unification-design.md`. Teste novo `src/tournament/schema.test.ts` (27 linhas, cobre `isUserTeam`). Verificação automatizada: typecheck de cliente e servidor limpos; suíte completa 1489/1489 (nenhuma falha, nem o flake usual de `src/sim/structures.test.ts`); `git diff` de arquivos `*.test.ts`/`*.test.tsx` contra o commit anterior ao início desta linha de trabalho mostra só o `schema.test.ts` novo — nenhum teste pré-existente foi tocado. Revisão final do branch conferiu as comparações `===` restantes com o mesmo sentido lógico e confirmou que ficaram raw de propósito: `src/tournament/bracket.ts` (`loserId`/`teamAId`/`teamBId` contra `state.userTeamId`) e `src/tournament/BracketView.tsx` (`isUserSlot`) porque ali `userTeamId` é sempre string não-nula, tornando o ramo de null-check do helper morto; e `perspectivaDoEspectador` (`src/room/SeriesWatch.tsx`) porque compara contra `enquadradoId`/`rivalId`, do domínio de `userFrameTeamId`, não do domínio de `isUserTeam` — passar por ele borraria a fronteira que esta linha de trabalho quis manter nítida.

**2026-08-26 — Fase 7 aplicada (itens 1 e 2; item 3 adiado).** Arquivos tocados: `src/room/PodiumScreen.tsx` (animação de campeão + seção de destaques), `src/room/PodiumScreen.test.tsx` (18 testes, 4 novos), `src/room/room.css` (`@keyframes` de entrada + brilho ambiente, `prefers-reduced-motion`), `server/protocol.ts` (`TournamentAwardWireSchema`, `TournamentWire.awards`), `server/room/tournament.ts` (`tournamentAwards`, `toTournamentWire` ganha o parâmetro `catalogue`), `server/room/hub.ts` (passa `this.#deps.catalogue`), `server/room/tournament.test.ts` (5 testes novos, incluindo um que roda DUAS ondas reais via `runWave` pra provar que a soma de K/D/A atravessa série — não reseta a cada uma). Fixtures de `TournamentWire` em `protocol.test.ts`, `store.test.ts`, `BracketScreen.test.tsx`, `VotePanel.test.tsx`, `SeriesWatch.test.tsx`, `PodiumScreen.test.tsx`, `RoomEntry.test.tsx` atualizadas com `awards: null` (schema `.strict()`).
Achado da investigação do item 2: não dava pra fazer no cliente (D-27), então virou uma agregação nova server-side sobre dado que o servidor já tinha em memória — maior do que "reaproveitar `awards.ts`" sugeria à primeira vista, mas confirmei contra `server/quarentena.test.ts` que o import continua seguro (`src/playback/awards.ts` não alcança a metade pesada).
Item 3 adiado por completo, não reduzido — decisão registrada no checkbox acima.
Verificação: rodei `runWave` de verdade (não só fixtures à mão) pra confirmar a agregação contra dado simulado real. Visual: gerei uma página HTML autônoma (SSR do componente real + `room.css`/`styles.css`) e abri no navegador — o brilho dourado, o bounce de entrada e os cartões de MVP/Bagre (com fallback de iniciais) renderizam como esperado.
Verificação automatizada: typecheck de cliente e servidor limpos; suíte completa 1484/1485 — a única falha foi o flake conhecido e pré-existente de `src/sim/**` (timeout sob carga do runner completo; confirmado que passa sozinho), fora de escopo desde o início desta linha de trabalho.

**2026-08-26 — Fase 8 aplicada, depois Fase 6 aplicada.** Ordem executada fora da numeração do plano por dependência real: o item 1 da Fase 6 ("próximo: {time}") só ficava simples de calcular com a ordem do draft já fixa (Fase 8), então a Fase 8 entrou primeiro. Arquivos tocados na Fase 6: `src/room/RoomDraftScreen.tsx` (funções puras novas `proximoDaVez`/`picksNovos`, sinais/efeito de toast), `src/room/RoomDraftScreen.test.tsx` (17 testes, 11 novos), `src/room/room.css` (relógio urgente + toasts), `server/protocol.ts` (`DraftWire.timedOutSeat`), `server/room/draft.ts` (`toDraftWire` ganha o parâmetro), `server/room/hub.ts` (rastreia e desarma o assento do timeout), `server/room/hub.test.ts` (1 teste novo). Fixtures de `DraftWire` em `protocol.test.ts`, `store.test.ts`, `SeriesWatch.test.tsx` atualizadas com o campo novo (schema é `.strict()`).
Os 3 itens de baixa prioridade da fase (contagem regressiva real na carência de reconexão, stats no roster fechado, slider de caos) ficaram de fora desta rodada, mesmo padrão do item de protocolo que a Fase 1 deixou pendente.
Verificação manual no navegador (2 abas, turno de 10s): "Próximo", contador de progresso, relógio pulsando vermelho abaixo de 10s e o aviso de prazo perdido apareceram corretamente. Um acidente de tooling travou uma aba no meio do teste — o jogador "caiu" de verdade e o servidor tratou a sequência de timeouts que se seguiu sem travar, fechando o draft com os 8 elencos completos; não achei bug nenhum, só validei o caminho de erro sem querer. Não consegui pegar visualmente o toast de pick (a janela de 4s some antes do round-trip da screenshot), mas a função de diff (`picksNovos`) tem 3 testes diretos e a parte reativa segue o mesmo padrão já usado pelo cronômetro nesta tela.
Verificação automatizada: typecheck de cliente e servidor limpos; `server/room/draft.test.ts` (ordem fixa) e `server/room/hub.test.ts` (`timedOutSeat`) verdes; suíte completa 1476/1476 (nenhuma falha, nem os flakes de `src/sim/**` que apareceram em toda fase anterior).

**2026-08-26 — Fase 1 aplicada.** 433 testes de `src/room` + `server/room` verdes, typecheck de cliente e servidor limpos. Dois desvios do texto original do plano, os dois documentados nos checkboxes acima:
- `autoWatch` não foi "estendido" — virou uma segunda função (`autoWatchEspectadores`) chamada depois dela. O `autoWatch` original tinha um teste que travava exatamente o comportamento que o item pedia mudar ("preserva escolha manual de quem não joga na onda"); misturar as duas regras teria quebrado esse contrato para todo mundo, não só para eliminados.
- "Esconder Estou pronto para espectador" ficou de fora — precisa de um campo novo no protocolo (`espectadoresContam`) que não existe hoje. Virou uma sub-tarefa de protocolo pendente, não um item de UI puro.

**2026-08-26 — Fase 2 aplicada.** 37 testes novos/atualizados (`PlaybackScreen.test.tsx` novo, `SeriesWatch.test.tsx` estendido), 485 testes de `src/room`+`src/playback`+`server/room` verdes, typecheck de cliente e servidor limpos. Um item a mais do que o texto original do plano: durante a revisão, apareceu o achado de que a distinção partida-vs-série precisava ficar explícita (ver nota na Fase 2 acima) — não era readequação de escopo, era o mesmo objetivo da fase ("enquadramento de vitória/derrota") um passo mais fundo.

**2026-08-26 — Fase 5 aplicada.** Mexeu só em cliente, dentro de `src/room/**`: `src/room/BracketSeriesList.tsx` (rodadas nomeadas via `RODADAS_SUPERIOR`/`RODADAS_INFERIOR`, wrapper `Chave` novo, `FASES_DO_TORNEIO` exportado, classes `is-ready`/`is-pending` no `SeriesCard`), `src/room/BracketScreen.tsx` (função pura exportada `faseAtual`, rótulo `textoFase()` — precisou virar string única, mesmo motivo de `textoOnda()`: SSR do Solid quebra "Fase: " e o valor dinâmico em nós de texto separados por comentário de hidratação, então `toContain("Fase: X")` só passa com os dois grudados na mesma expressão — achado ao rodar os testes novos pela primeira vez, corrigido antes deste registro), `src/room/room.css` (colunas + conectores + destaque de status + ajuste no breakpoint de 720px). Nenhuma mudança de protocolo/servidor, nenhuma ampliação do D-30 (ver decisão de design na Fase 5 acima — não reaproveitou `BracketNode.tsx`, só o conceito de layout). 13 testes novos (`src/room`+`src/playback`+`server/room`: 522 vs. 509 da Fase 4), typecheck de cliente e servidor limpos, suíte completa 1462/1464 (as 2 que falham são flakes de timeout pré-existentes em `src/sim/**` — `buffs.test.ts` e `structures.test.ts` — fora de escopo, mesma categoria já registrada em todas as fases anteriores, embora desta vez tenham sido 2 testes diferentes do flake usual, não sempre o mesmo).

**2026-08-26 — Fase 4 aplicada.** Mexeu só em cliente: `src/room/SeriesWatch.tsx` (função nova `continuar()` + pura exportada `decidirContinuar`, mais `dadosResultado()` montando as props do `SeriesResultScreen` reaproveitado), `src/playback/PlaybackScreen.tsx` e `src/tournament/SeriesResultScreen.tsx` (prop `continueLabel` nos dois, mais o fix do ramo morto em `gameCells()`), `src/room/contract.test.tsx` (lista D-30 ampliada). Nenhum protocolo/servidor novo — diferente da Fase 3, mostrar o resultado não precisou de nenhum campo em `sync` (ver decisão de design acima). 7 testes novos nesta fase (`src/room`+`src/playback`+`server/room`: 509 vs. 502 da Fase 3), typecheck de cliente e servidor limpos, suíte completa 1450/1451 (o 1 que falha é o mesmo flake pré-existente de `src/sim/structures.test.ts`, fora de escopo, já registrado em todas as fases anteriores).

**2026-08-26 — Fase 3 aplicada.** Mexeu em protocolo (`sync.stage` novo + ação `pularSelecao`), servidor (`server/room/hub.ts`, `server/room/tournament.ts`) e cliente (`SeriesWatch.tsx`, `ChampionSelect.tsx` ganhou o prop `canSkip`, `contract.test.tsx` ampliado). 502 testes de `src/room`+`src/playback`+`server/room` verdes (17 novos só nesta fase: 7 no hub, 9 no SeriesWatch, 1 no contract.test.tsx), typecheck de cliente e servidor limpos, suíte completa 1443/1444 (o 1 que falha é o flake pré-existente de `src/sim/structures.test.ts`, fora de escopo, o mesmo já registrado nas Fases 1 e 2). Mudança de rumo a meio da revisão: a primeira proposta era "pular local por cliente"; o usuário pediu que em sincronia todo mundo fosse "obrigado a ir junto" — virou o item 3 real da fase (ver nota acima), não um extra.
