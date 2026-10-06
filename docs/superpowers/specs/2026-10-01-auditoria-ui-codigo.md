# Auditoria de UI/UX no código: LoL 7 a 0

**Escopo:** camada de UI (`src/App.tsx`, `src/tournament/*.tsx`, `src/components/*`, `src/draft/DraftScreen.tsx`, `src/playback/**`, `src/room/**`, `src/styles.css`, `src/room/room.css`, `PackManager.css`, `PlayerEditor.css`), mais `index.html`. O motor (`src/sim/**`) entrou só pelos textos que o usuário vê (seção própria no fim).
**Método:** leitura de código, sem executar nada. Cada afirmação aponta arquivo:linha. Onde o efeito depende de rodar o app, o item traz a marca **(confirmar no navegador)**. Nenhum arquivo do repositório foi alterado.
**Severidade:** **crítico** = quebra o fluxo ou corrompe estado/permissão · **alto** = engana o usuário ou bloqueia uma tarefa comum · **médio** = atrito real, mas tem contorno · **baixo** = polimento.

---

## 0. As 12 correções que mais pesam (ordem sugerida)

| # | Sev. | Achado | Onde |
|---|---|---|---|
| 1 | crítico | A UI da sala é desenhada **em cima** do app solo, que continua renderizado embaixo. O botão "Jogar com amigos" aparece em todas as telas solo e a sala não tem como ser fechada. | `App.tsx:616`, `RoomEntry.tsx:120-147` |
| 2 | crítico | Solo: o **jogo que decide a série nunca é exibido**. O app pula direto para o resultado. Além disso, só o jogo 1 tem replay. | `App.tsx:513-533`, `App.tsx:596-600`, `BracketView.tsx:92` |
| 3 | crítico | Solo: depois de um replay, "Continuar" **simula um jogo extra numa série já encerrada** e chama `advanceSlot` de novo. O overlay do replay ainda mostra o placar final e um veredito "🏆 … venceu a série" que pode estar errado. | `App.tsx:438-443`, `App.tsx:571-579`, `series.ts:53-66`, `PlaybackScreen.tsx:115-144` |
| 4 | crítico | Solo: quem recarrega a página no meio de uma série e clica em "Continuar torneio" cai num chaveamento **sem nenhum botão de ação** (beco sem saída). | `BracketNode.tsx:109`, `App.tsx:493-499` |
| 5 | crítico | Sala: o "Link de convite" leva o **token de host**. Todo amigo que entra por ele vira host. | `LobbyScreen.tsx:49-52`, `server/room/state.ts:146` |
| 6 | alto | Solo: não existe tela de fim de torneio nem caminho do chaveamento de volta ao menu. Os stubs de campeão/eliminação nunca são acionados. | `App.tsx:712-718`, `App.tsx:787-803` |
| 7 | alto | O rótulo "Eliminado" e o título "Sua equipe foi eliminada." aparecem para quem perde na **chave superior**, que só cai para a inferior. | `BracketNode.tsx:57-65`, `SeriesResultScreen.tsx:195` |
| 8 | alto | O seletor "Velocidade da partida" do draft é **ignorado**: toda partida de torneio roda em `"fast"`. | `DraftScreen.tsx:209-224`, `series.ts:107` |
| 9 | alto | O título do draft diz "escolha um TOP", mas a tela oferece uma carta de **cada** rota aberta. | `DraftScreen.tsx:239`, `DraftScreen.tsx:300` |
| 10 | alto | "Editar jogadores" sempre edita o pacote Pros. Com um pacote próprio ativo, as edições e os jogadores adicionados não entram no torneio, e a tela não avisa. | `PlayerEditor.tsx:123-125`, `storage/packs.ts:164-166` |
| 11 | alto | Ações destrutivas sem confirmação: excluir pacote, remover jogador, "Restaurar padrão". | `PackManager.tsx:276-281`, `PlayerEditor.tsx:493-507` |
| 12 | alto | Sala, fase de torneio: erros e queda de conexão **não aparecem** em Chaveamento, Assistir, Votação e Pódio (falha silenciosa). | `BracketScreen.tsx`, `SeriesWatch.tsx`, `VotePanel.tsx`, `PodiumScreen.tsx` (nenhum lê `store.error()`/`connected()`) |

---

## 1. Padrões transversais

### T1. Duas aplicações na mesma página (crítico)
- **Evidência:** `src/App.tsx:616` renderiza `<RoomEntry />` sempre, antes de todos os `<Show>` de tela solo. Quando o jogador clica "Jogar com amigos" (`RoomEntry.tsx:139-141`), a sala (`tela()`, `RoomEntry.tsx:127-132`) entra **acima** e o `LaunchMenu`, o draft ou o playback solo continuam renderizados embaixo. `room.css:40-50` (`.room-lobby`) é um bloco comum no fluxo, sem overlay e sem tela cheia. Nenhum código chama `setAberto(false)`: a sala não fecha.
- **Por que atrapalha:** o usuário vê dois menus empilhados (lobby da sala e menu solo). Quem estava no meio de uma partida solo e abre a sala fica com o playback rodando lá embaixo. Não há "Sair da sala". O botão dourado "Jogar com amigos" aparece no topo de **todas** as telas solo (draft, chaveamento, partida).
- **Correção:** subir o modo para o roteador. Uma única variável `modo: "solo" | "sala"` no `App`; com a sala aberta, nenhuma tela solo é renderizada. Mostrar "Jogar com amigos" só no menu inicial, como um terceiro botão do `LaunchMenu` (mesmo estilo dos outros). Dar à sala um cabeçalho fixo com "Sair da sala", que fecha a conexão e volta ao menu.

### T2. Dois sistemas visuais convivendo (alto)
- **Evidência:** existem tokens em `styles.css:33-117` (`--c-gold #d4a843`, `--c-muted #7e8da0`, `--c-border #2a3545`, `--c-red #e84057`, `--c-blue #4a9eff`). Mesmo assim, o `styles.css` tem **~254 hex fixos fora do `:root`** (278 hex sem comentários, menos 20 do `:root` e 4 fallbacks). Quase todos são da paleta antiga do UI-SPEC: `#8b949e` (50×), `#c89b3c` (37×), `#30363d` (28×), `#e6edf3` (27×), `#d73a49` (20×), `#161b22` (20×). O resultado são **dois dourados** (`#c89b3c` × `#d4a843`), **dois vermelhos** (`#d73a49` × `#e84057`), **dois azuis de "seu time"** (`#3b82f6` em `App.tsx:281,318,611`/`styles.css:2316` × `#4a9eff` em `--c-blue`) e **dois cinzas de texto secundário**. Já o `room.css` usa token em 213 dos 219 hex (todos como fallback), mas consome **13 tokens que não existem** no `:root`: `--c-warn-*`, `--c-danger-*`, `--c-ok-*`, `--c-surface-4`, `--c-gold-soft`, `--c-on-gold`, `--c-focus`. Na prática sempre valem os fallbacks.
- **Por que atrapalha:** o mesmo "dourado de ação" muda de tom entre telas (o "Iniciar draft" `#c89b3c` chapado ao lado do `pick-btn` em gradiente `#f0c860→#d4a843`). As telas da sala parecem de outro produto, e o anel de foco muda de cor (`--c-focus` fallback `#6fa8ff`, azul, em `room.css:560,958`, contra dourado no resto).
- **Correção:** (a) declarar no `:root` os 13 tokens que a sala já usa (warn/danger/ok/focus/on-gold/gold-soft/surface-4); (b) trocar, por busca e substituição, `#c89b3c→var(--c-gold)`, `#8b949e→var(--c-muted)`, `#30363d→var(--c-border)`, `#e6edf3→var(--c-text)`, `#d73a49→var(--c-red)`, `#161b22→var(--c-surface-1)`, `#1f2937→var(--c-surface-3)`, `#0d1117→var(--c-bg-1)`; (c) remover os comentários de cabeçalho que ainda documentam a paleta antiga (`styles.css:6-13`, `:1535-1539`, `:2043-2047`, `PackManager.css:7-8`, `PlayerEditor.css:7-9`).

### T3. Fragmentação de botões (médio)
Dezessete classes diferentes fazem o papel de "botão de ação principal dourado", com 3 preenchimentos, 4 raios, 2 caixas de texto e 3 cores de foco:

| Classe | Arquivo:linha | Preenchimento | Raio | Caixa |
|---|---|---|---|---|
| `launch-menu__btn--primary` | styles.css:2120 | gradiente `--grad-gold` | 10px | normal |
| `team-edit__confirm` | styles.css:2534 | **cor do time** (`--user-team-color`) | 8px | MAIÚSC. |
| `start-draft-btn` | styles.css:313 | `#c89b3c` chapado | 6px | normal |
| `pick-btn` | styles.css:646 | gradiente | 10px | MAIÚSC. |
| `confirm-draft-btn` | styles.css:3005 | gradiente | 6px | MAIÚSC. (fonte display) |
| `bracket-node__start-btn` | styles.css:2362 | gradiente | 6px | MAIÚSC. |
| `play-again-btn` | styles.css:1511 | gradiente | 10px | MAIÚSC. |
| `series-result__btn--primary` | styles.css:2735 | `#c89b3c` chapado | 6px | normal |
| `pack-manager__btn--primary` | PackManager.css:54 | gradiente | 8px | normal |
| `player-editor__add-btn` / `player-add-form__save` | PlayerEditor.css:62/88 | gradiente | 8px | normal |
| `room-lobby__submit`, `room-lobby__invite-copy`, `room-draft__pick`, `room-draft__submit`, `room-bracket__ready`, `room-bracket__spectator-btn` | room.css:130, 306, 543, 696, 1100, 844 | `--c-gold` chapado | 6–8px | normal |

Os botões secundários e de voltar passam de 18 classes (`pack-manager__back-btn`, `player-editor__back-btn`, `launch-menu__btn--secondary`, `series-result__btn--secondary`, `room-watch__back-btn`, `room-watch__nav-btn`, `cs-skip`, `options-toggle`, `champion-editor-toggle`, `chaos-slider__reset`, `speed-controls__btn`, `speed-btn`, `player-card__reset-btn`, `champ-pool__add-btn`, `player-persona__advanced-toggle`, `bracket-node__replay-btn`, `room-entry__open`, `room-vote__choice`…). Há também quatro estilos de ação destrutiva: `launch-menu__btn--destructive`, `pack-manager__btn--danger`, `player-card__reset-btn--del` e `room-bracket__force-btn`.
- **Por que atrapalha:** o usuário não aprende "este é o botão que avança", porque o botão muda de forma a cada tela. Alguns estados disabled também ficam sem estilo (ver Menu e Lobby).
- **Correção:** criar 4 classes base em `styles.css` (`.btn`, `.btn--primary`, `.btn--secondary`, `.btn--danger`, mais `.btn:disabled` e `.btn:focus-visible`) usando só tokens, e fazer as classes atuais só herdarem (ou trocar o `class=` nos TSX). Uma regra só: um `--primary` por tela.

### T4. Navegação sem saída, sem histórico e sem orientação (alto)
- **Evidência:** a busca por `scrollTo|scrollIntoView|.focus()|document.title|pushState|popstate|keydown|Escape|beforeunload` em `src/` (fora do motor) volta vazia. Telas **sem** botão de voltar: `TeamEditScreen` (as props nem têm `onBack`, `TeamEditScreen.tsx:19-23`), `DraftScreen`, `ChampionSelect` (só "Pular"), `PlaybackScreen` (só speed/skip e, no fim, "Continuar"), `BracketView` (nenhum link para o menu). Na sala, `SeriesWatch` só oferece "Voltar ao chaveamento" quando a partida **não** carregou (`SeriesWatch.tsx:485-490`) ou no resultado da série (`:575`). Enquanto o jogo roda, a barra `room-watch__nav` (`:498-525`) tem só "Jogo anterior / Próximo jogo".
- **Por que atrapalha:** o botão Voltar do navegador **sai do site**. Trocar de tela mantém a posição de rolagem (quem clica "Continuar" no fim de um resultado longo chega ao chaveamento rolado para baixo). O foco do teclado fica no `<body>`, e a aba sempre se chama "LoL 7 a 0". Do chaveamento solo, o único jeito de voltar ao menu (Pacotes, Editar jogadores, Novo torneio) é recarregar a página.
- **Correção:** (1) um cabeçalho global fino em todas as telas, com "LoL 7 a 0" (link para o menu) e o nome da tela atual ("Seu time › Draft › Chaveamento › Jogo 2 de 5"); (2) sincronizar `currentScreen` com `history.pushState`/`popstate`, para o Voltar do navegador funcionar; (3) num `createEffect` sobre `currentScreen`, fazer `window.scrollTo(0,0)`, focar o `<h1>/<h2>` da tela e atualizar `document.title`; (4) botão "Voltar" em TeamEdit (→ menu) e no pré-draft (→ Seu time); (5) "Sair para o chaveamento" no playback, solo e sala.

### T5. Terminologia flutuante (médio, exemplos)

| Conceito | Variações encontradas |
|---|---|
| Rotas/posições | `TOP/JGL/MID/ADC/SUP` (`draft/hints.ts:24-30`, draft e sala) · `TOP/JG/MID/ADC/SUP` (`TeamPanel.tsx:25-27`) · `TOPO/CAÇADOR/MEIO/ATIRADOR/SUPORTE` (`ChampionSelect.tsx:32-34`) · `Topo/Caçador/Meio/Atirador/Suporte` (`hints.ts:33-39`, editor) · id cru `top/jungle/mid/adc/support` (`RosterPortraits.tsx:86` → aparece como "JUNGLE", "SUPPORT"; `LobbyScreen.tsx:235`; `DraftScreen.tsx:317`) |
| Fases do jogo | `Início/Meio/Fim/Versátil` (`hints.ts:63`) · `L/M/F` (`DraftScreen.tsx:285-287`, `RoomDraftScreen.tsx:339-341`) · `Rotas/Meio/Fim` (`PlayerEditor.tsx:539`) · `rotas/meio/fim` (`StatsVisibilityToggle.tsx:45`) · `early/late` (`ChampionEditor.tsx:37-38`, `presets.ts`) |
| Rodada do draft | "Rodada X de 5" (solo, `DraftScreen.tsx:239`) · "Volta X de 5" (sala, `RoomDraftScreen.tsx:159`) |
| Etapa do torneio | "Onda X de 6" + "Fase: …" (sala, `BracketScreen.tsx:87-90`) · nenhum indicador no solo · "Rodada 1 — Chave Inferior" (solo) × "Rodada 1" (sala) · "Semis — Chave Inferior" (solo, `BracketView.tsx:32`) × "Semifinal" (sala, `BracketSeriesList.tsx:50`) |
| Time | "Seu time venceu…" (`PlaybackScreen.tsx:136`) · "Sua equipe venceu a série!" / "Sua equipe foi eliminada." (`SeriesResultScreen.tsx:194-195`) |
| Host | "Você é o host desta sala." (`LobbyScreen.tsx:176`) · badge "host" (`:196`) · "Aguardando quem hospeda começar." (`:56`) · "Esperando o host começar o torneio." (`RoomDraftScreen.tsx:209`) |
| "caiu" | = desconectado (badge, `LobbyScreen.tsx:199`, `RoomDraftScreen.tsx:313`) · = eliminado ("Todo mundo caiu.", `VotePanel.tsx:57`) · "Seu time saiu." (`BracketScreen.tsx:155`) |
| Universo de jogadores | "Pacote" .xlsx (solo, `PackManager.tsx`) · "Base de jogadores" `players.json` (sala, `LobbyScreen.tsx:273-279`) |
| Série | "série" em toda parte · "MD5" uma vez só ("SÉRIE (MD5) ENCERRADA", `PlaybackScreen.tsx:389`) · placar "3 – 1" (solo) × "3 × 1" (sala, `BracketSeriesList.tsx:175`) · W/L em inglês (`SeriesResultScreen.tsx:255`) |
| Primeiro abate | "PRIMEIRO SANGUE" (`EventHighlight.tsx:23`) × "First blood alto" (`ChampionEditor.tsx:35`) |

- **Correção:** um `src/copy.ts` (glossário) exportando `ROLE_LABEL_CURTO`, `ROLE_LABEL_LONGO`, `FASE_LABEL`, `TERMOS` (time, série, host="anfitrião"), usado por todas as telas. Fixar: rota = "Topo / Selva / Meio / Atirador / Suporte" (ou a sigla, sempre a mesma); fase = "Início / Meio de jogo / Fim"; "desconectado" no lugar de "caiu"; "eliminado" sempre com o sentido real.

### T6. Acentuação e cedilha (médio)
Os problemas se concentram no Editor de Jogadores e nos presets (lista completa na seção 4 e na seção "Texto vindo do motor"). Exemplos: `"Nao foi possivel criar o jogador."` (`PlayerEditor.tsx:313`), `"Automatico (derivar da rota e tracas)"` (`:411`, `:673`; "tracas" é erro de digitação de "traços"), `"Tracos (maximo 2)"` (`:733`), `"Jogo vencido pelo time azarao"` (`SeriesResultScreen.tsx:272`), `"Cacar Isolados"` (`sim/teamComp.ts:302`, que aparece como "CACAR ISOLADOS" no HUD).

### T7. Foco e teclado (alto)
- O foco global só existe para `button` (`styles.css:151-154`). Seis regras tiram o contorno de campos e põem no lugar só uma troca de cor de borda: `PackManager.css:173`, `PlayerEditor.css:53`, `PlayerEditor.css:327-331`, `styles.css:2498-2500` (team-edit), `room.css:125-128`. Isso fica abaixo de 3:1 entre os estados e é sutil demais.
- Os inputs de arquivo do solo usam `style={{ display: "none" }}` dentro de `<label>` (`PackManager.tsx:171-180`, `PlayerEditor.tsx:459-467`): **não dá para alcançá-los por teclado**. A sala resolveu isso direito (`room.css:227-261`: input com `opacity:0` + `:focus-within`).
- **Correção:** `:where(input, select, textarea):focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px }` global, apagando os `outline:none`. Copiar o padrão de file input da sala para o solo.

### T8. `aria-live` em excesso (médio)
- `BracketView.tsx:102` e `BracketScreen.tsx:118` põem `aria-live="polite"` na **tela inteira** do chaveamento.
- `EventHighlight.tsx:88-89` combina `role="status"` com `aria-live="assertive"` (papéis contraditórios) e repete o mesmo evento que o `role="log"` do ticker (`EventTicker.tsx:138-143`) já anuncia. Cada linha do ticker ainda tem `aria-label={text}` (`:160`), que duplica o conteúdo.
- Em 2x, um leitor de tela recebe dois anúncios por evento, um deles assertivo.
- **Correção:** tirar `aria-live` dos containers de chaveamento e anunciar só um resumo ("Sua próxima série: X contra Y") numa região pequena. No `EventHighlight`, usar `aria-hidden="true"` (é decorativo, o log já anuncia). Remover os `aria-label` duplicados das linhas.

### T9. Responsividade: poucos breakpoints (médio)
Breakpoints de largura que existem: `styles.css:446` (480px, grid do draft), `:742`/`:749` (980/620px, palco do playback), `PlayerEditor.css:100` (640px), `room.css:1145` (720px). **Sem nenhum:** menu inicial, Seu time, chaveamento solo (rolagem horizontal intencional), resultado da série, seleção de campeões, barra de transmissão e overlay de resultado. `.app` mantém `padding: 48px 24px` em qualquer largura (`styles.css:183-189`). Detalhes por tela abaixo.

### T10. Solo × sala: o mesmo conceito com comportamentos diferentes (médio)

| Conceito | Solo | Sala |
|---|---|---|
| Chaveamento | `BracketNode` em árvore, "Eliminado" errado na UB | `BracketSeriesList` em grid, "Eliminado" certo (vem do servidor) |
| Card de draft | foto, tags, animação, `pick-btn` | sem foto e sem tags, `room-draft__pick` |
| Indicador de jogo | nenhum ("Jogo N" não aparece) | "Jogo X de N" + anterior/próximo (`SeriesWatch.tsx:393,498-525`) |
| Placar no replay | placar **final** (bug, `App.tsx:438-439`) | `placarAteAqui` (correto, `SeriesWatch.tsx:79-90`) |
| Caos | escondido em "⚙ Opções" no draft | em destaque antes do torneio, com explicação (`RoomDraftScreen.tsx:219-221`) |
| Atributos visíveis | opção em "Opções" | sempre visíveis |
| Capitão | etapa própria | não existe |
| Base de jogadores | Pacotes .xlsx | `players.json` |
| "Ver replay" no resultado | volta ao jogo 1 (e quebra, ver S-10) | fecha o resultado e volta ao último jogo |
| Fim de torneio | não existe | Pódio |

- **Correção:** escolher um comportamento por linha e aplicar nos dois modos. A sala já está melhor em indicador de jogo, placar no replay, explicação do caos, pódio e file input: portar essas soluções para o solo.

---

## 2. Achados por tela

### 2.1 App shell / roteamento (`src/App.tsx`, `index.html`)

**[A-01] `<html lang="en">` num app 100% pt-BR** · *alto*
- Evidência: `index.html:2`.
- Por que atrapalha: o leitor de tela lê o português com pronúncia inglesa, e o Chrome oferece "Traduzir do inglês".
- Correção: `<html lang="pt-BR">`.

**[A-02] Stubs de campeão/eliminação inalcançáveis, com texto de dev** · *alto* (ver S-06)
- Evidência: `App.tsx:111-112`, `:787-803`, com os textos `"Campeão do torneio! (Tela completa disponível no próximo plano)"` e `"Eliminado. (Tela completa disponível no próximo plano)"`. Nenhum `setCurrentScreen("champion"|"elimination")` existe.
- Correção: implementar a tela de fim (reaproveitar `PodiumScreen` da sala, em versão solo) e rotear para ela quando o GF terminar ou o time do usuário for eliminado de verdade.

**[A-03] Erro de carregamento com jargão técnico e sem ação** · *médio*
- Evidência: `App.tsx:622-624`: `"Erro ao carregar os jogadores. Verifique o arquivo players.json e recarregue a página."`. Quando acontece, todas as telas somem (`!loadError()` em todos os `<Show>`).
- Correção: texto para jogador ("Não conseguimos carregar a lista de jogadores.") + botão "Tentar de novo" que repete `loadPlayers()`. O detalhe técnico vai para `console.error`.

**[A-04] Menu clicável antes dos jogadores carregarem** · *baixo*
- Evidência: durante o carregamento, `packCoverage()` devolve `playable:true` (`App.tsx:238`), e "Iniciar torneio" já funciona. Se o fetch atrasar, o draft abre com `players=[]` e mostra "Sem candidatos disponíveis" (`DraftScreen.tsx:313-319`).
- Correção: `canStart = !carregandoJogadores() && cov.playable` e rótulo "Carregando jogadores…" no botão.

**[A-05] Simulações síncronas sem estado de carregamento** · *baixo* **(confirmar no navegador)**
- Evidência: `onDraftComplete` roda `autoSimBotSeries` (`App.tsx:347`), e `playNextGame` roda simulações (`:477`, `:522`), tudo de forma síncrona e sem indicador.
- Correção: se demorar mais de ~150 ms, mostrar "Simulando a rodada…" e liberar um frame (`requestAnimationFrame`) antes de simular.

**[A-06] O save anterior é apagado antes de existir um novo** · *baixo*
- Evidência: `clearTournament()` roda já ao sair do menu (`App.tsx:273`). Quem desiste em "Seu time" ou no draft (recarregando a página) fica sem torneio nenhum.
- Correção: apagar o save só em `onDraftComplete`, logo antes de `saveTournament(newState)`.

### 2.2 Menu inicial (`LaunchMenu.tsx` + botão "Jogar com amigos")

**[M-01] Botões principais desabilitados parecem habilitados** · *alto*
- Evidência: `LaunchMenu.tsx:91,102` usam `disabled={!props.canStart}`, mas `.launch-menu__btn` (`styles.css:2104-2117`) e `--primary` (`:2120`) não têm regra `:disabled`. O gradiente dourado continua e o hover ainda levanta o botão (`:2117`).
- Correção: `.launch-menu__btn:disabled { opacity:.45; cursor:not-allowed; transform:none; filter:none }`.

**[M-02] Motivo do bloqueio sem cara de erro e estilo carregado tarde** · *médio*
- Evidência: o motivo usa a mesma classe do "Pacote ativo" (`LaunchMenu.tsx:75`, `launch-menu__active-pack`). Essa classe só é estilizada em `PackManager.css:175-176`, arquivo carregado **sob demanda** com o chunk do PackManager (`App.tsx:43-45`). Até o usuário abrir "Pacotes", a linha aparece sem estilo **(confirmar no navegador)**.
- Correção: mover as regras para `styles.css` e criar `.launch-menu__alert` com fundo/borda de aviso (tokens `--c-warn-*`). Incluir no alerta um link "Ajustar pacote" que abre Pacotes.

**[M-03] Confirmação de "Novo torneio" longe do clique e sem foco** · *médio*
- Evidência: o cartão de confirmação aparece **depois** de "Pacotes" e "Editar jogadores" (`LaunchMenu.tsx:127-150`). O foco não vai para ele, e "Continuar torneio"/"Novo torneio" continuam clicáveis.
- Correção: trocar os botões pelo cartão no mesmo lugar (ou abrir logo abaixo de "Novo torneio") e focar "Manter torneio atual" (a opção segura) ao abrir.
- Ponto positivo: a confirmação existe e o texto é claro (`:129-147`).

**[M-04] "Continuar torneio" continua como ação principal com o torneio encerrado** · *médio*
- Evidência: `LaunchMenu.tsx:79-95` só testa `existingSave !== null`.
- Correção: com o torneio terminado, a ação principal vira "Novo torneio" e o botão secundário vira "Ver chaveamento final".

**[M-05] O multijogador não aparece como modo de jogo** · *médio*
- Evidência: o botão "Jogar com amigos" fica fora do cartão do menu, acima do título (`App.tsx:616`; estilo próprio em `room.css:12-26`). Ele só aparece quando o servidor de salas responde, e as opções do torneio (caos, atributos) não ficam no menu.
- Correção: um bloco "Como jogar" com dois botões de mesmo peso, "Torneio solo" e "Jogar com amigos" (o segundo desabilitado com explicação quando não há servidor).

**[M-06] Subtítulo com jargão** · *baixo*
- Evidência: `"Simulador de torneio de pros"` (`LaunchMenu.tsx:67`).
- Correção: "Monte um time de jogadores profissionais e dispute um torneio de LoL".

### 2.3 Pacotes de jogadores (`PackManager.tsx/.css`)

**[P-01] "Excluir" apaga o pacote na hora, sem desfazer** · *alto*
- Evidência: `PackManager.tsx:276-281` chama `deletePack` (`:141-144`) direto.
- Correção: confirmação inline ("Excluir 'Amigos'? Isso não pode ser desfeito." com os botões [Excluir] [Cancelar]) ou um aviso com "Desfazer" por 5 s.

**[P-02] O botão "Criar pacote de uma planilha" não funciona por teclado** · *alto*
- Evidência: `<label>` com `<input type="file" style={{display:"none"}}>` (`PackManager.tsx:169-181`).
- Correção: o padrão de `room.css:227-261`.

**[P-03] Sucesso e erro com o mesmo visual e o mesmo `role`** · *médio*
- Evidência: `pack-manager__notice role="status"` (`PackManager.tsx:184-186`) recebe tanto "Não consegui ler o arquivo…" quanto "Pacote … criado…", com o mesmo estilo dourado (`PackManager.css:71-78`).
- Correção: um sinal `{tipo:"ok"|"erro", texto}`. Erro usa `role="alert"` e estilo vermelho, sucesso fica verde.

**[P-04] Downloads falham em silêncio e o botão desabilitado não diz por quê** · *médio*
- Evidência: `downloadTemplate`/`exportPack` (`:69-81`) não têm `try/catch`. "Baixar planilha" fica `disabled={!champions()}` (`:165`) sem texto de carregamento.
- Correção: rótulo "Carregando campeões…" enquanto desabilitado, e `try/catch` com aviso de erro.

**[P-05] Prévia da importação com contadores zerados e linguagem técnica** · *baixo*
- Evidência: as pílulas "0 erros", "0 avisos" aparecem sempre (`:194-198`), e a mensagem de cabeçalho cita "a aba de jogadores tem o cabeçalho certo" (`:98`).
- Correção: esconder as pílulas com 0. Trocar a mensagem por "Não achamos jogadores na planilha. Use o modelo (botão acima) e preencha a aba 'Jogadores'."

**[P-06] Card de pacote não se adapta ao celular** · *baixo*
- Evidência: `.pack-card` é flex em linha sem `wrap` (`PackManager.css:83-92`), com até 3 botões à direita.
- Correção: `flex-wrap: wrap` e, abaixo de 480px, `.pack-card__actions { width:100%; justify-content:flex-start }`.

**[P-07] Cores fixas fora dos tokens** · *baixo*
- Evidência: `#1a1206`, `#f87171`, `#7f1d1d`, `#93c5fd`, `#1e3a8a`, `#4ade80`, `#fbbf24`, `#166534`, `#854d0e`, `#3b82f6`, `#f59e0b`, `#ef4444` (`PackManager.css:56-159`).

### 2.4 Editar jogadores (`PlayerEditor.tsx/.css`)

**[E-01] O editor ignora o pacote ativo** · *alto*
- Evidência: a lista vem de `buildPlayerPool(loaded() ?? [], …, addedPlayers)` (`PlayerEditor.tsx:123-125`), ou seja, sempre o pacote Pros com os adicionados. No torneio, `resolveBasePlayers` usa só `pack.players` quando o pacote ativo é próprio (`storage/packs.ts:164-166`). O texto de introdução promete: "valem para o draft e os times adversários" (`:337-340`).
- Por que atrapalha: com o pacote "Amigos" ativo, o usuário edita ou adiciona jogadores e nada muda no torneio.
- Correção: mostrar no topo "Editando: pacote Pros". Ou editar o pacote ativo, ou avisar "Você está com o pacote 'Amigos' ativo; estas edições só valem para o pacote Pros", com um link para trocar.

**[E-02] Ações destrutivas sem confirmação** · *alto*
- Evidência: "Remover jogador" (`:502-507`) apaga o jogador criado, as edições e a foto. "Restaurar padrão" (`:493-499`) zera todas as edições do card. "Remover" foto (`:470-475`). Nenhuma pede confirmação.
- Correção: confirmação inline nas duas primeiras. A da foto pode ficar sem.

**[E-03] Acentos faltando** · *médio*
- `"Nao foi possivel remover a persona."` (`:181`), `"Nao foi possivel criar o jogador."` (`:313`), `"Automatico (derivar da rota e tracas)"` (`:411`, `:673`), `"Fechar avancado"` / `"Avancado (opcional)"` (`:694`), `"Tolerancia ao weakside"` (`:701`), `"Tendencia ao roam"` (`:705`), `"Tendencia a abate"` (`:707`), `"Tendencia a assistencia"` (`:708`), `"Tracos (maximo 2)"` (`:733`).
- Nos presets exibidos no select e na descrição (`src/data/presets.ts`): `"erros basicos"` (:37), `"confiavel no basico"` (:54), `"Nao toma risco…"` (:88), `"resultado volatil"` (:105), `"Suporte util sem dano"` (:121), `"nao gera pressao de dano"` (:122), `"Comeca bem…"` (:173), `"Aguenta pressao…"` (:190), `"Mecanico sem macro"` / `"Mecanica apurada mas decisoes ruins"` (:206-207).
- Correção: corrigir as strings e acrescentar ao lint um teste simples que procura `\b(nao|possivel|avancado|tracos|maximo|automatico|tendencia)\b` dentro de literais de UI.

**[E-04] Sliders, selects e busca sem nome acessível** · *médio*
- Evidência: os ranges de "Fases do jogo", "Força por rota" e "Avançado" (`:546-553`, `:569-576`, `:717-725`) têm o rótulo num `<span>` irmão, não associado. O select de persona fica num `<label>` sem texto (`:664-681`; o "Persona" é um `<p>` à parte, `:663`). A busca (`:344-350`), o filtro de rota (`:351-360`) e a busca de campeão (`:638-644`) têm só placeholder.
- Correção: `aria-label` em cada um ("Fase de rotas de {nome}", etc.) ou `<label for>`.

**[E-05] Estrelas de conforto: estado só por cor, rótulos repetidos e contraste baixo** · *médio*
- Evidência: `aria-label={"Conforto " + n}` igual para todos os campeões, sem `aria-pressed` (`:599-610`). O estado está só na cor `#3a4150` → dourado (`PlayerEditor.css:217-221`), e `#3a4150` sobre `#0b111b` dá **~1,9:1** (abaixo de 3:1 para elemento gráfico).
- Correção: `role="radiogroup"` + `role="radio" aria-checked`, rótulo "{campeão}: conforto n de 5", estrela vazia com contorno (☆) e cor `--c-muted`.

**[E-06] Tela sobrecarregada** · *médio*
- Evidência: 40 jogadores (`public/players.json`) renderizados de uma vez. Cada card tem ~10 sliders, um pool com ≥8 campeões × 5 estrelas + remover, 9 chips de traço, select e mais 11 sliders em "Avançado" (`:440-760`): milhares de controles numa página.
- Correção: lista compacta (foto, nome, rota, botão "Editar") e o card completo num painel/rota de detalhe; paginação ou virtualização.

**[E-07] Erros silenciosos e estado vazio ausente** · *médio*
- Evidência: falha ao ler a foto é engolida (`:228-230`, `// best-effort; ignore decode failures`). Filtro sem resultado mostra só "0 de 40 jogadores" (`:436-438`). Um nome vazio dá "Valor inválido. A alteração não foi salva." (`:155`) enquanto o campo continua mostrando o texto digitado.
- Correção: avisar na foto ("Não deu para usar essa imagem"). Estado vazio "Nenhum jogador encontrado para '…'" com "Limpar busca". Validar o nome vazio no próprio campo.

**[E-08] Jargão e inglês** · *baixo*
- Evidência: "Linkar campeão" (`:633`), "pool" (`:584`), "weakside", "roam", "side lane", "Shotcaller", "carry" (`:699-709`). O texto de `:584` usa travessão, contrariando a regra do próprio arquivo ("no em-dash", `:15`).
- Correção: "Adicionar campeão", "campeões" e dicas (`title` + texto) nos termos técnicos que ficarem.

**[E-09] Botão de "Voltar" à direita e diferente das outras telas** · *baixo*
- Evidência: `player-editor__back-btn` (`:332`), `pack-manager__back-btn` (`PackManager.tsx:150`) e `room-watch__back-btn` são três classes para a mesma função.

### 2.5 Seu time (`TeamEditScreen.tsx`)

**[T-01] Sem caminho de volta** · *alto*
- Evidência: as props não incluem `onBack` (`TeamEditScreen.tsx:19-23`), e o save anterior já foi apagado (`App.tsx:273`).
- Correção: botão "Voltar ao menu" (secundário) ao lado de "Ir para o draft".

**[T-02] A cor escolhida quase não aparece onde se espera** · *alto*
- Evidência: a cor vai para `--user-team-color` (`App.tsx:615`), que só pinta a borda do ticker (`styles.css:1403-1406`), a barra de probabilidade e a aba do chaveamento (`:2315-2317`). Na transmissão o "seu" lado continua **azul fixo**: `.bcast-team--user .bcast-tag` (`:1144`), `.tpanel--user` (`:1197`), `.cs-tag--user #4a9eff` (`:2778`), `.result-series-tag--user` (`:2887`), `RiftMap.tsx:31` `user:"#4a9eff"`. No ticker o nome do time aparece em **dourado** (`.event-team--user`, `:940`), e o mapa antigo pinta torres em dourado (`.rift-turret--user`, `:1005`). Há ainda a opção vermelha `#ef4444` (`TeamEditScreen.tsx:33`), que se confunde com o vermelho do rival.
- Correção: aplicar `var(--c-user)` em todos os pontos "do seu lado" e tirar o vermelho da paleta (ou trocar o rival para uma cor neutra quando o usuário escolher vermelho).

**[T-03] Seleção de cor inacessível** · *médio*
- Evidência: `role="radiogroup"` com filhos `<button aria-pressed>` (`:89-101`), quando o papel certo seria `radio/aria-checked`. Os rótulos são hex (`aria-label={"Cor " + c}` → "Cor #3b82f6"). O anel de seleção usa `currentColor` (`styles.css:2529-2532`), que num `<button>` sem `color` resolve para preto, invisível no fundo escuro. Na cor branca `#e6edf3`, a borda branca de seleção também não se distingue **(confirmar no navegador)**.
- Correção: nomes ("Azul", "Verde"…), `role="radio" aria-checked`, anel com `var(--c-text)` e um ✓ sobre a cor selecionada.

**[T-04] O botão de confirmar não acompanha a cor escolhida e o foco do input some** · *baixo*
- Evidência: o fundo do botão usa `var(--user-team-color)` (`styles.css:2534-2546`), que só muda depois de confirmar. O input tem `outline:none` (`:2498-2500`).

### 2.6 Draft solo (`DraftScreen.tsx` + Opções: `ChaosSlider`, `StatsVisibilityToggle`, `ChampionEditor`)

**[D-01] "Velocidade da partida" não tem efeito** · *alto*
- Evidência: a escolha (`DraftScreen.tsx:209-224`) vai para `App.speedPreset` (`App.tsx:309`). Mas `runSeriesGame` usa `speedPreset: "fast"` fixo (`tournament/series.ts:107`), e `PlaybackScreen` nunca lê `props.speedPreset` (só a declara, `PlaybackScreen.tsx:49`).
- Correção: passar o preset para `runSeriesGame` (e salvar no `TournamentState`) ou remover o seletor e deixar só o 1x/2x da partida.

**[D-02] O título manda escolher uma rota, mas a tela oferece todas** · *alto*
- Evidência: `"Rodada {n} de 5 — escolha um {currentRoleLabel()}"`. `currentRoleLabel` devolve só a **primeira** rota aberta (`:186-189`, `:239-241`), mas o grid mostra uma carta para **cada** rota aberta, e qualquer uma pode ser escolhida (`:300`).
- Correção: "Rodada 1 de 5: escolha 1 jogador entre os candidatos abaixo (rotas abertas: TOP, JGL, MID, ADC, SUP)".

**[D-03] Sem voltar, sem desfazer e sem confirmação visível da escolha** · *médio*
- Evidência: não há botão de voltar nem de desfazer. `setJustPickedRole(role)` (`:138`) é zerado na mesma função (`:177`), e a carta escolhida sai do grid na hora. Na prática o "Escolhido ✓" (`:357-361`) e a animação `card-pick` nunca aparecem **(confirmar no navegador)**.
- Correção: "Desfazer última escolha" até a próxima rodada; ~400 ms de "Escolhido ✓" antes de sortear a nova rodada.

**[D-04] "Meio" serve para duas coisas** · *médio*
- Evidência: na carta aparece `{ano} · {fase}`, onde a fase vem de `"Início"|"Meio"|"Fim"|"Versátil"` (`DraftScreen.tsx:341-345`, `hints.ts:63`). Para um jogador de Topo isso vira "2019 · Meio", e "Meio" também é o nome da rota mid (`ROLE_LONG_LABELS.mid`, `hints.ts:36`). Os números revelados usam "L/M/F" sem legenda (`:285-287`).
- Correção: "Pico: meio de jogo" e, nas estatísticas, "Início 82 · Meio 75 · Fim 70" (ou legenda com `title`).

**[D-05] Estado vazio técnico e com id cru** · *médio*
- Evidência: `"O arquivo players.json não tem jogadores suficientes para a rota {ROLE_LABELS[role]}. Adicione pelo menos 1 card de {role} para continuar."` (`:316-317`). Usa o id em inglês ("support"), fala de arquivo em vez de "pacote" e não oferece caminho de saída.
- Correção: "O pacote ativo não tem jogadores de SUP. [Ajustar pacote]".

**[D-06] Opções importantes escondidas e sobrecarregadas** · *médio*
- Evidência: Caos, atributos e editor de campeões ficam atrás de "⚙ Opções" (`App.tsx:674-700`), só na tela de draft. O `ChampionEditor` despeja uma tabela de **173 campeões × 5 checkboxes** sem busca (`ChampionEditor.tsx:95-141`). O caos não explica o que faz (a sala explica: `RoomDraftScreen.tsx:220-221`). `StatsVisibilityToggle` diz "rotas/meio/fim" (`:45`).
- Correção: levar Caos e Atributos para um passo "Regras do torneio" (junto de Seu time) com a explicação da sala. O editor de campeões vai para o menu inicial ("Editar campeões"), com busca e "Restaurar padrão".

**[D-07] Rótulos do editor de campeões em inglês** · *baixo*
- Evidência: `"First blood alto"`, `"Escala bem (late)"`, `"Domina early"`, `"Teamfight"` (`ChampionEditor.tsx:35-39`). O erro cita `champions.json` (`:90`).

**[D-08] Cores fixas do bloco de draft** · *baixo*
- Evidência: `.options-toggle`, `.speed-btn`, `.start-draft-btn`, `.role-slot*`, `.card-*` (`styles.css:236-470`) usam a paleta antiga. O `.start-draft-btn` chapado (`:313-323`) destoa do `.pick-btn` em gradiente.

### 2.7 Chaveamento solo (`BracketView.tsx`, `BracketNode.tsx`)

**[B-01] Beco sem saída ao retomar uma série em andamento** · *crítico* **(confirmar: iniciar uma série, recarregar depois do jogo 1, "Continuar torneio")**
- Evidência: `playNextGame` salva a série com `status:"in_progress"` (`App.tsx:493-499`, `:510-511`). `BracketView` marca o slot como ativo (`getActiveSlotId`, `BracketView.tsx:52-55`), mas `BracketNode` só mostra "Iniciar série" quando `isActive && isReady()` (`BracketNode.tsx:109`), e "Ver replay" só quando a série está completa (`:123`). `tournament/storage.ts` não normaliza `in_progress` ao carregar.
- Correção: no `BracketNode`, `isActive && (isReady() || status==="in_progress")` → "Continuar série (2–1)".

**[B-02] "Eliminado" aparece em quem só caiu para a chave inferior** · *alto*
- Evidência: `teamAEliminated = isComplete && winnerId !== teamAId` (`BracketNode.tsx:57-65`), sem considerar que perder na UB leva à LB.
- Correção: usar o mesmo critério da sala (eliminado só com 2 derrotas) ou exibir "→ Chave inferior" nos perdedores da UB.

**[B-03] Sem resumo do próximo passo, sem fim de torneio e sem menu** · *alto*
- Evidência: o único título é "Chaveamento" (`:103`), e a ação fica num nó que, no celular, pode estar fora da tela (colunas `min-width:230px` em rolagem horizontal, `styles.css:2225-2237`). Quando o usuário é eliminado ou campeão, a tela não diz nada nem oferece ação.
- Correção: faixa no topo com "Sua próxima série: Semis da chave inferior · ABC x XYZ [Iniciar série]", "Você foi eliminado em 5º–6º · [Novo torneio] [Menu]" ou "Campeão!". Mais botão "Menu" no cabeçalho.

**[B-04] Replay limitado ao jogo 1** · *médio*
- Evidência: `onReplaySeries(slotId, 0)` (`BracketView.tsx:92`, `:136`). O `aria-label` admite isso ("jogo 1", `BracketNode.tsx:127`), o texto visível não ("Ver replay").
- Correção: botões "J1 J2 J3…" ou um seletor.

**[B-05] Seu time marcado só por cor e affordance falsa** · *baixo*
- Evidência: o time do usuário só ganha fundo mais escuro, aba colorida e negrito (`styles.css:2309-2325`). A classe `bracket-node--user` é aplicada (`BracketNode.tsx:76`) mas não tem CSS. `.bracket-node--active` tem `cursor:pointer` e hover no **cartão inteiro** (`styles.css:2272-2277`), mas só o botão interno é clicável.
- Correção: selo "VOCÊ" no nome. O cursor fica só no botão, ou o cartão inteiro vira o botão.

### 2.8 Seleção de campeões (`ChampionSelect.tsx`)

**[C-01] Parece interativa, mas é só animação** · *médio*
- Evidência: o título é "SELEÇÃO DE CAMPEÕES" (`:145`) e não há texto dizendo que os campeões são atribuídos automaticamente (fearless). A tela avança sozinha em ~5 s (`:87-98`). Também não mostra **qual jogo** é ("Jogo 3 de 5") nem o placar da série.
- Correção: subtítulo "Jogo 3 · Série 1–1 · campeões definidos automaticamente (sem repetir na série)".

**[C-02] Layout fixo de 3 colunas sem breakpoint** · *médio*
- Evidência: `.cs-board { grid-template-columns: 1fr 60px 1fr }` (`styles.css:2781`), com retrato de 64px + padding (`:2799-2810`). Em ~360px sobram ~108px por coluna e o nome do jogador corta quase inteiro.
- Correção: abaixo de 560px, empilhar as colunas e reduzir o retrato para 44px.

**[C-03] Rótulos de rota diferentes do resto** · *baixo*
- Evidência: "TOPO/CAÇADOR/…" (`:32-34`) contra "TOP/JGL" no draft e "TOP/JG" no painel lateral. Ver T5.

### 2.9 Partida (`PlaybackScreen.tsx` e componentes)

**[J-01] O jogo decisivo nunca é mostrado (solo)** · *crítico*
- Evidência: quando um lado chega a 3 vitórias, `playNextGame` vai direto para `"series-result"` (`App.tsx:513-533`) e pula `champ-select`/`playback`. O overlay do jogo anterior acabou de dizer "A série continua — falta pelo menos 1 partida…" (`PlaybackScreen.tsx:393-398`). Os textos "SÉRIE (MD5) ENCERRADA" e "🏆 Seu time venceu a série!" (`:389`, `:122-138`) nunca aparecem no fluxo normal do solo.
- Correção: no `winnerId`, guardar o estado avançado, mostrar o jogo decisivo (champ-select → playback) e, no "Continuar" desse overlay, ir para `series-result`.

**[J-02] Replay corrompe a série e mente no veredito (solo)** · *crítico* **(confirmar: Resultado da série → "Ver replay" → "Continuar")**
- Evidência: `handleReplaySeries` faz `setActiveSeriesSlotId(slotId)` (`App.tsx:442`). No overlay, "Continuar" chama `onPlayAgain` → `playNextGame(slotId)` (`:571-579`), e `runSeriesGame` não testa se a série acabou (`series.ts:53-66`): entra um jogo extra e `advanceSlot` roda de novo (`App.tsx:519`). O replay ainda recebe o placar **final** (`App.tsx:438-439`), então o overlay sempre diz "SÉRIE (MD5) ENCERRADA" e "🏆 {vencedor do jogo 1} venceu a série", o que está errado quando o vencedor do jogo 1 perdeu a série. A sala já corrigiu isso com `placarAteAqui` (`SeriesWatch.tsx:79-90`).
- Correção: o replay entra num modo próprio, com `continueLabel="Voltar ao resultado"`/`"Voltar ao chaveamento"` e `onPlayAgain` que só navega. Placar calculado até o jogo exibido. Guard em `playNextGame`: `if (series.status === "complete") return`.

**[J-03] Overlay de resultado: diálogo sem foco e cortado em telas baixas** · *alto*
- Evidência: `role="dialog" aria-modal="true"` (`PlaybackScreen.tsx:367-372`) sem mover o foco, sem prender o foco e sem Esc. O foco fica no botão "Pular para o fim", que fica desabilitado (`:342`). `.result-overlay` é `position:fixed` + `align-items:center`, sem `overflow:auto` (`styles.css:1427-1438`), e o `.result-card` tem padding de 48/32px, sem `max-height`. Em celular na horizontal, o "Continuar" pode ficar fora da tela, sem rolagem **(confirmar no navegador)**.
- Correção: focar o botão "Continuar" ao abrir. `overflow-y:auto` no overlay, `max-height: calc(100dvh - 32px)` no card e padding menor em telas baixas.

**[J-04] Sem indicação de série durante o jogo e sem saída** · *alto*
- Evidência: `seriesUserWins/RivalWins` só são usados no overlay final (`PlaybackScreen.tsx:384-390`). `BroadcastBar` não mostra "Jogo 2 · 1–0". Não há botão de sair (ver T4).
- Correção: no centro da `BroadcastBar`, "JOGO 2 DE 5 · SÉRIE 1–0". Botão discreto "Sair para o chaveamento".

**[J-05] "Continuar" genérico no solo** · *médio*
- Evidência: o padrão é `"Continuar"` (`PlaybackScreen.tsx:427-429`). Para a mesma ação, a sala usa "Próximo jogo"/"Ver resultado da série" (`SeriesWatch.tsx:550`).
- Correção: passar `continueLabel` no solo também ("Ir para o jogo 3").

**[J-06] Rodapé legal ilegível** · *médio*
- Evidência: `.attribution-notice` com `font-size:9px`, `color:#4b5563` e `opacity:.6` (`styles.css:1825-1835`) dá **~1,6:1** de contraste sobre o fundo.
- Correção: 11–12px, `color: var(--c-muted)`, sem opacidade.

**[J-07] Barra de transmissão sem breakpoint** · *médio*
- Evidência: `.bcast-team-top` traz tag, nome, comp, torres, ouro e buffs numa linha só (`styles.css:1142`, `BroadcastBar.tsx:43-51`), e o placar central tem 38px (`:1165`). Não há `@media` para `.bcast`.
- Correção: abaixo de 620px, esconder `bcast-name`/`bcast-comp` e reduzir o placar para 28px.

**[J-08] Ícones e números sem legenda** · *baixo*
- Evidência: "⌂ {torres}" só com `title="Torres"` (`BroadcastBar.tsx:47`). O ouro de shutdown aparece só como número (`TeamPanel.tsx:77-79`). Morto/vivo é indicado só por opacidade e cinza (`styles.css:1224`, `:1227`). `alt={el}` dos dragões usa o id em inglês ("infernal", "ocean"…, `BroadcastBar.tsx:54`; `playbackDefaults.ts:13`). `alt="objetivo"` é genérico (`:75`). `aria-label` em inglês no mapa: `` `${side} strongside ${lane()}` `` (`RiftMap.tsx:219`).

**[J-09] Painel lateral mostra o jogador, não o campeão** · *baixo*
- Evidência: `info()` devolve `name: shortName(p)` (o jogador) e usa esse nome como `alt` do retrato do campeão (`TeamPanel.tsx:40-43`, `:68`). O nome do campeão não aparece.

**[J-10] Speed sem pausa** · *baixo*
- Evidência: só 1x/2x e "Pular para o fim" (`SpeedControls.tsx:38-60`).
- Correção: botão "Pausar".

**[J-11] Contraste baixo em rótulos pequenos** · *baixo*
- Evidência: `--c-faint #5a6678` sobre a superfície dá **~2,9:1** em `.tpanel-role` de 11px (`styles.css:1234`). `#6b7280` sobre `#0a0e14` dá **~4,0:1** em `.result-series-label` de 10px (`:2890`) e `.cs-role` (`:2841`). `.win-prob-bar__label--user` é branco sobre a cor do time: com âmbar `#f59e0b` dá ~2,1:1 (`:1981`).

**[J-12] CSS morto e duplicado que alimenta a inconsistência** · *baixo*
- Evidência: `Scoreboard.tsx` e `TabScoreboard.tsx` não são importados em lugar nenhum, mas o estilo deles continua (`.scoreboard`, `.sb-*`, `.tab-*`, `styles.css:1274-1390`). `.rift-champ-ring--user` está definido duas vezes, em dourado (`:1038`) e em azul (`:1251`).

### 2.10 Resultado da série (`SeriesResultScreen.tsx`)

**[R-01] "Sua equipe foi eliminada." quando não foi** · *alto*
- Evidência: o título usa `loserIsUser()` em qualquer série (`:185-198`), inclusive na chave superior.
- Correção: receber a informação "eliminado de verdade?" (o slot do perdedor alimenta outro slot?) e usar "Você caiu para a chave inferior" quando for o caso.

**[R-02] Ação principal no fim de uma página longa** · *médio*
- Evidência: "Continuar" vem depois do placar, da zebra, dos prêmios, da tabela e de **um bloco por jogo** com dois `RosterPortraits` (`:361-403`).
- Correção: repetir as ações logo abaixo do placar ou fixá-las num rodapé grudado. Os blocos por jogo ficam num `<details>` "Campeões por jogo".

**[R-03] Tabela não cabe no celular** · *médio*
- Evidência: 6 colunas ("Time" + "Jogo 1…5") com `padding: 8px 12px` (`styles.css:2641-2667`), dentro de um card com `padding 48/32` (`:2561-2573`) e do `.app` com 24px de cada lado. Abaixo de ~400px a página rola na horizontal **(confirmar no navegador)**.
- Correção: cabeçalhos "J1…J5" e um wrapper com `overflow-x:auto`.

**[R-04] W/L em inglês, zebra só por cor e retratos sem nome de time** · *baixo*
- Evidência: rótulos `"W"/"L"` (`:255`, `:258`). A célula de zebra fica roxa, com a explicação só no `title` e ainda sem acento ("Jogo vencido pelo time azarao", `:272`). Os `RosterPortraits` de cada jogo não dizem qual é o time A e qual é o B (só a borda dourada/vermelha, `styles.css:1896-1902`), e o rótulo de rota é o id cru (`RosterPortraits.tsx:86` → "JUNGLE"/"SUPPORT").
- Correção: "V"/"D", um "★" com legenda "Zebra" visível, a tag do time antes de cada fileira e `ROLE_LABELS`.

**[R-05] "Ver replay" muda de sentido entre solo e sala** · *baixo*
- Evidência: no solo, volta ao jogo 1 (e dispara J-02). Na sala, `onReplay={fecharResultado}` volta ao último jogo (`SeriesWatch.tsx:344-346`, `:574`).

### 2.11 Sala: Lobby (`LobbyScreen.tsx`)

**[L-01] O link de convite dá poder de host** · *crítico*
- Evidência: `linkDeConvite = ${window.location.origin}/?host=${props.hostToken}` (`:49-52`), com rótulo "Link de convite" e botão "Copiar" (`:212-219`). No servidor, `isHost = req.hostToken === room.hostToken` (`server/room/state.ts:146`). O próprio `RoomEntry.tsx:30-33` avisa que "o token na URL entrega o controle da sala". Ainda por cima, se o host abriu por `localhost`, o link copiado aponta para `localhost`, que não funciona para os amigos. O CLI já gera URLs LAN sem token (`server/cli.ts:48-57`).
- Correção: o convite é `origin` **sem** `?host=`, e a origem vem do IP de LAN informado pelo servidor (ex.: `/api/room-info` devolvendo `lanUrls`). O link de host, se for exibido, fica separado, rotulado "Seu link de anfitrião (não compartilhe)".

**[L-02] Base da sala ≠ pacotes do solo** · *alto*
- Evidência: a sala pede um `players.json` ("Escolha um players.json…", `:274-279`; erro "Escolha o arquivo players.json do jogo.", `:116`). O solo trabalha com pacotes .xlsx (`PackManager.tsx`), e os pacotes que o usuário criou não podem ser usados na sala.
- Correção: um seletor "Pacote da sala" listando os pacotes locais (Pros + próprios) e publicando o escolhido. Aceitar .xlsx pelo mesmo `parseWorkbook`.

**[L-03] "Começar o draft" desabilitado sem cara de desabilitado** · *médio*
- Evidência: `disabled={jogadoresConectados() < 2 || !turnSecondsValido()}` (`:264`), mas `.room-lobby__submit` não tem `:disabled` (`room.css:130-150`). O mesmo vale para "Entrando…" (`:169-171`).
- Correção: regra `:disabled` e uma frase ao lado, "Falta 1 jogador conectado".

**[L-04] Aviso de base com ids em inglês** · *médio*
- Evidência: `{rota} {n}` com `rota` em `["top","jungle","mid","adc","support"]` (`:13`, `:231-237`), o que gera "top 3, jungle 2, …".
- Correção: `ROLE_LABELS[rota]`.

**[L-05] Reconexão com atrito e erros sem `role`** · *médio*
- Evidência: "Recarregue a página para voltar — seu lugar continua guardado." (`:129-132`). Depois do reload, `aberto` volta a `false` (`RoomEntry.tsx:122`): o jogador cai no menu solo, precisa clicar "Jogar com amigos" e **digitar apelido e time de novo** (`entrar`, `:86-92`), sem que nada avise isso. O erro (`:135-137`) não tem `role="alert"`.
- Correção: botão "Reconectar" que chama `connect` com o `clientId` salvo. Abrir a sala automaticamente quando houver `clientId` salvo. `role="alert"` no erro.

**[L-06] Título e termos** · *baixo*
- Evidência: o título é só "Sala" (`:126`). "host"/"quem hospeda"/"caiu" (ver T5). "Segundos por turno" não diz que é do draft (`:248`).
- Correção: "Sala de {anfitrião}" e "Tempo por escolha no draft (segundos)".

### 2.12 Sala: Draft (`RoomDraftScreen.tsx`)

**[RD-01] Termos diferentes do solo** · *médio*
- Evidência: "Volta {n} de 5 · {k} cartas no baralho · escolha {i} de {t}" (`:159-162`) contra "Rodada X de 5" no solo. "cartas no baralho" é jargão interno.
- Correção: "Rodada 2 de 5 · escolha 9 de 40 · 23 jogadores restantes".

**[RD-02] Card de escolha diferente do solo** · *baixo*
- Evidência: `room-draft__card` (`:274-289`) não tem foto, tags nem animação, e o botão é `room-draft__pick` com foco azul (`room.css:559-562`). O solo usa `.draft-card`/`.pick-btn`. Ver T10.
- Correção: extrair um `<PlayerCard>` compartilhado.

**[RD-03] Perda de conexão sem botão** · *médio*
- Evidência: o texto "Você perdeu a conexão. Recarregue a página…" (`:189-191`) não vem acompanhado de ação, e o erro (`:194-196`) não tem `role="alert"`.
- Correção: igual a L-05.

**[RD-04] Página longa com 8 rosters × 5** · *baixo*
- Evidência: `room-draft__seats` lista todos os assentos (`:296-353`), e a "sua vez" fica no topo. Está aceitável, mas destacar o próprio time primeiro (`is-mine`) ajudaria.

### 2.13 Sala: Chaveamento (`BracketScreen.tsx`, `BracketSeriesList.tsx`)

**[RB-01] O título principal é jargão de mecânica** · *alto*
- Evidência: `<h2>` = `"Onda X de 6"` (`BracketScreen.tsx:87`, `:120`). O momento do campeonato vem só em segundo plano ("Fase: …", `:121`). "Onda" não é explicado em lugar nenhum da UI.
- Correção: `<h2>` "Chaveamento · Quartas de final" e, embaixo, "Rodada 2 de 6 (as séries de cada rodada rodam juntas quando todos marcam 'Estou pronto')".

**[RB-02] A ação principal fica no fim e a do host no topo** · *alto*
- Evidência: "Estou pronto" vem depois da lista de séries **e** da lista de times (`:191-203`), enquanto "Liberar a próxima onda" (ação de força do host, em vermelho) fica no cabeçalho (`:126-139`).
- Correção: "Estou pronto" grande no cabeçalho, ao lado de "esperando 2 de 5". As ações de host ficam num bloco "Controles do anfitrião" no fim.

**[RB-03] Séries clicáveis sem dizer que são clicáveis** · *médio*
- Evidência: o `<button class="room-bracket__series">` (`BracketSeriesList.tsx:223-234`) só mostra nomes, placar e status, sem "Assistir". O hover muda apenas a cor da borda (`room.css:953-955`).
- Correção: um "▶ Assistir" visível em cada série jogável.

**[RB-04] "Modo sincronizado" sem explicação para o host** · *médio*
- Evidência: um checkbox com o rótulo cru (`BracketScreen.tsx:216-223`). A explicação só aparece para os convidados, depois de ligado (`:208-213`).
- Correção: uma dica abaixo do checkbox: "Todos assistem o mesmo jogo, controlado por você".

**[RB-05] Falhas silenciosas** · *alto*
- Evidência: `setReady`, `setWatch`, `setSyncMode` e `forceAdvance` gravam o erro em `store.error()` (`net/store.ts:252-282`), mas `BracketScreen` não renderiza `error()` nem `connected()`.
- Correção: um `<RoomStatusBar>` comum a todas as telas da sala (erro + desconectado + Reconectar).

### 2.14 Sala: Assistir série (`SeriesWatch.tsx`)

**[RW-01] Sem saída durante o jogo** · *alto*
- Evidência: "Voltar ao chaveamento" só aparece no estado sem partida (`:485-490`), no banner de campeão (`:473-475`) e na tela de resultado (`:575`). Enquanto `ChampionSelect`/`PlaybackScreen` estão na tela, `room-watch__nav` (`:498-525`) não tem botão de voltar. O comentário em `:482-484` reconhece que uma tela sem saída é a pior falha.
- Correção: um "← Chaveamento" fixo em `room-watch__nav`, chamando `sair()`.

**[RW-02] Navegação quebra no celular** · *médio*
- Evidência: `.room-watch__nav` é flex sem `wrap` (`room.css:1265-1271`), com até 4 itens ("Jogo anterior", "Jogo 1 de 5", "Próximo jogo", "Pular introdução →").
- Correção: `flex-wrap: wrap` e rótulos curtos ("‹ Anterior", "Próximo ›").

**[RW-03] Texto confuso** · *baixo*
- Evidência: `"A sala está sincronizada num jogo que esta série não tem."` (`:405`).
- Correção: "O anfitrião está mostrando outro jogo. [Voltar ao chaveamento]".

### 2.15 Sala: Votação (`VotePanel.tsx`)

**[V-01] "caiu" ambíguo e voto marcado só por cor** · *médio*
- Evidência: `"Todo mundo caiu."` (`:57`), sendo que "caiu" = desconectado em outras telas (T5). Os botões marcam o voto só por `is-active` (fundo dourado, `room.css:1349-1353`), sem `aria-pressed` (`:61-76`).
- Correção: "Todos os times humanos foram eliminados." e `aria-pressed={meuVoto()==="continuar"}`. Rótulo explícito: "Continuar assistindo (simula o resto)" / "Encerrar e ver o pódio".

**[V-02] Sem saída nem erro** · *baixo*
- Evidência: se o voto falhar, nenhum erro aparece (RB-05).

### 2.16 Sala: Pódio (`PodiumScreen.tsx`)

**[PD-01] Fim sem próximo passo** · *médio*
- Evidência: não há "Nova sala", "Voltar ao menu" nem "Jogar solo" (`:51-127`).
- Correção: pelo menos "Voltar ao menu", que fecha a sala (depende de T1).

**[PD-02] Bom exemplo a portar para o solo** · *(positivo)*
- Evidência: campeão com animação e respeito a `prefers-reduced-motion` (`room.css:1421-1455`) e destaques do torneio. É a tela de fim que falta ao solo (A-02).

---

## 3. Acessibilidade: consolidado

| Item | Sev. | Evidência | Correção |
|---|---|---|---|
| `lang="en"` | alto | `index.html:2` | `pt-BR` |
| Diálogo sem gestão de foco | alto | `PlaybackScreen.tsx:367-372` | focar "Continuar", prender Tab, Esc = continuar |
| File input fora do teclado | alto | `PackManager.tsx:171-180`, `PlayerEditor.tsx:459-467` | padrão `room.css:227-261` |
| `outline:none` em campos | médio | `PackManager.css:173`, `PlayerEditor.css:53,327-331`, `styles.css:2498`, `room.css:125-128` | foco global para inputs |
| Controles sem nome | médio | `PlayerEditor.tsx:344,351,546,569,664,717`, `:638` | `aria-label`/`<label for>` |
| Estado só por cor | médio | estrelas (`PlayerEditor.tsx:602-608`), voto (`VotePanel.tsx:61-76`), zebra (`SeriesResultScreen.tsx:270-273`), seu time no chaveamento (`styles.css:2309-2325`), morto/vivo (`styles.css:1224`) | texto/ícone + `aria-pressed`/`aria-checked` |
| `radiogroup` com `aria-pressed` | médio | `TeamEditScreen.tsx:89-99` | `role="radio" aria-checked` |
| `aria-live` em excesso | médio | `BracketView.tsx:102`, `BracketScreen.tsx:118`, `EventHighlight.tsx:88-89`, `EventTicker.tsx:160` | ver T8 |
| Contraste | médio | atribuição ~1,6:1 (`styles.css:1825`), estrela vazia ~1,9:1 (`PlayerEditor.css:219`), `--c-faint` ~2,9:1 em texto de 11px (`styles.css:1234`), `#6b7280` ~4,0:1 em 10px (`:2890`, `:2841`), `.load-status` com borda `#d0d7de` de tema claro (`:221`) | tokens `--c-muted`/`--c-text-dim` para texto |
| `aria-label` em `div` sem papel | baixo | `TeamEditScreen.tsx:51`, `DraftScreen.tsx:201,313,329`, `ChampionSelect.tsx:142`, `PlaybackScreen.tsx:283`, `TeamPanel.tsx:52` | usar `<section aria-labelledby>` ou remover |
| `prefers-reduced-motion` | ok | a regra global `styles.css:192-198` cobre as animações CSS, e a sala tem regras próprias (`room.css:454-458`, `:1450-1455`). As animações por JS (revelação do `ChampionSelect`, intervalo de 420 ms) são temporização de conteúdo e são aceitáveis. | n/a |
| Botões como `div`/`span` | ok | nenhum `onClick` em elemento que não seja botão | n/a |

---

## 4. Texto vindo do motor (`src/sim/**`): aparece no ticker, nos destaques e no HUD

| Arquivo:linha | Texto atual | Correção |
|---|---|---|
| `sim/teamComp.ts:302` | "Cacar Isolados" (aparece como **CACAR ISOLADOS** no HUD e na seleção) | "Caçar Isolados" |
| `sim/teamComp.ts:313` | "Escaramuca" | "Escaramuça" |
| `sim/teamComp.ts:312` | "Recua e Puna" | "Recua e Pune" |
| `sim/teamComp.ts:310`, `:315` | "Carrinho Forte", "Engaja e Destroca" | revisar ("Linha de Frente", "Engaja e Troca") |
| `sim/structures.ts:1075`, `:1976` | "…em estado critico! … lidera o siege." | "crítico", "o cerco" |
| `sim/structures.ts:738` | "O Nexus do X esta EXPOSTO!" | "está" |
| `sim/laneSignals.ts:219` | "…a ${team} nao da espaco…" | "não dá espaço" |
| `sim/laneSignals.ts:220` | "…segura a lane … ha rodadas…" | "há" |
| `sim/laneSignals.ts:229` | "…sente a pressao extra." | "pressão" |
| `sim/laneSignals.ts:230` | "…receber atencao constante do jungler…" | "atenção" |
| `sim/deathQuality.ts:264` | "…o jogo muda de mao." | "mão" |
| `sim/deathQuality.ts:365` | "…encontra o angulo, forca a luta…" | "ângulo, força" |
| `sim/deathQuality.ts:428` | "…enchanter mantem o carry vivo…" | "mantém" |
| `sim/deathQuality.ts:472` | "…a composicao de scaling atravessa o early…" | "composição" |
| `sim/deathQuality.ts:493` | "…suporte e pego tentando estabelecer visao…" | "é pego", "visão" |
| `sim/upset.ts:34` | "ZEBRA: o X venceu jogando de azarao." | "azarão" |
| `sim/upset.ts:35` | "…pontos de diferenca no papel…" | "diferença" |
| Inglês recorrente | "siege", "dive", "weakside", "gank", "carry", "early", "lane", "jungler", "bot" (`deathQuality.ts:396,412,428,472`; `engine.ts:1737`; `ticker.ts:29`), "ACE", "PENTAKILL"/"QUADRA KILL"/"TRIPLE KILL" (`EventHighlight.tsx:24-27`, grafia mista) | decidir uma política (gíria de LoL aceita × pt-BR) e aplicar igual em todo o texto. No mínimo "QUADRAKILL/TRIPLEKILL" juntos, como "PENTAKILL". |

---

## 5. O que já está bom (preservar ao refatorar)
- Confirmação de sobrescrever torneio, com texto claro (`LaunchMenu.tsx:127-150`).
- `prefers-reduced-motion` global (`styles.css:192-198`) e por componente na sala.
- File input acessível na sala (`room.css:227-261`), mensagens de validação do lobby por campo (`LobbyScreen.tsx:151-168`).
- A sala tem indicador "Jogo X de N", placar até o jogo exibido, banner de campeão com link para o pódio e um "Voltar" no estado sem partida (`SeriesWatch.tsx`).
- Botões são `<button>` de verdade, com `aria-pressed` nos toggles de velocidade, capitão e atributos (`SpeedControls.tsx`, `DraftScreen.tsx:417`, `StatsVisibilityToggle.tsx:32-33`).
- "Eliminado" com texto, não só cor (`BracketNode.tsx:86-88`), apesar do critério errado (B-02).
- O overlay de resultado já separa "esta partida" de "a série" (`PlaybackScreen.tsx:115-145`).

## 6. Para o revisor do navegador confirmar
1. T1: abrir "Jogar com amigos" e ver o lobby **e** o menu solo ao mesmo tempo. Testar também a partir de uma partida solo em andamento.
2. J-01: jogar uma série até 3 vitórias e ver que o jogo decisivo não aparece.
3. J-02: "Resultado da série" → "Ver replay" → "Continuar". Observar se entra um jogo 4/5/6 e o chaveamento muda.
4. B-01: iniciar uma série, recarregar depois do jogo 1, "Continuar torneio" e verificar que não há botão.
5. B-02/R-01: perder uma série na chave superior e ler "Eliminado"/"Sua equipe foi eliminada".
6. D-01: escolher "Super devagar ~90s" e cronometrar a partida (deve sair igual ao "Rápido").
7. M-01/M-02: com um pacote incompleto, ver o botão dourado desabilitado e a linha de motivo sem estilo antes de abrir Pacotes.
8. L-01: copiar o "Link de convite" e abrir em outra aba anônima. Conferir se vem o selo "Você é o host desta sala.".
9. J-03, C-02, J-07, R-03, RW-02: testar em 360×640 e 640×360.
10. T-03: escolher a cor branca e verificar se dá para ver que ela está selecionada.
