# Design — Sala e portal de ponta a ponta (Rundown da Sala 2)

**Data:** 2026-10-01
**Status:** Achados verificados; Pacote 1 decidido e com plano (`docs/superpowers/plans/2026-10-01-sala-correcoes-da-noite.md`); Pacotes 2 a 6 aguardam as decisões da seção 6 (o 6 só depende de D12).
**Evidência:** artifact "Rundown da Sala 2" (capturas de cada achado). Teste feito com o build da `master` `1e55c7b`.
**Fora de escopo:** o motor (`src/sim/**`) e as regras de vitória/placar. Texto gerado pelo motor (narração) só entra como apresentação na tela da sala, nunca mudando o motor.

## 1. Como foi testado

1. **Noite de jogo simulada.** Servidor da sala na porta 7171 (`--nova-sala`), três perfis isolados do Edge via Playwright: Rafa pelo link de host do terminal, Bia pelo link de LAN, Caio pelo "Link de convite" do lobby. Cinco bots, 15 s por turno, caos 25%. Torneio inteiro: 6 ondas, votação, pódio. Rede lenta simulada (≈300 KB/s, 150 ms) na Bia durante a onda 2. Celular a 390 px.
2. **Passeio de UI/UX pelo portal.** Menu, pacotes, editor de jogadores, fluxo solo (seu time → draft → capitão → chaveamento → série → resultado) e a sala no celular (lobby, draft, partida, chaveamento).
3. **Auditoria de código das telas** (consistência visual, acessibilidade, textos, responsividade) — ver seção 4.

O `server/data` foi salvo antes e restaurado depois de cada sessão.

## 2. Critérios de "intuitivo" usados para julgar

- Quem recebe o link chega na sala sem precisar entender o resto do app.
- Toda tela diz onde estou, qual é a próxima ação (e ela é a mais visível) e como voltar.
- A tela não muda sozinha sem um motivo que a pessoa reconheça.
- Nada revela o resultado antes da partida que o decide.
- Funciona no celular sem rolar para o lado.
- Um vocabulário só: as mesmas palavras para as mesmas coisas no solo e na sala.

## 3. Achados da sala (noite de jogo)

Severidade: C crítico · A alto · M médio · B baixo. "Pacote" diz onde a correção mora (seção 5).

| ID | Sev | Achado | Causa | Pacote |
|----|-----|--------|-------|--------|
| S1 | C | Qualquer `roomState` (alguém marca pronto, cai, reconecta) reinicia a partida de quem assiste: volta à seleção do Jogo 1; tira do chaveamento e do pódio. | Efeitos leem `tournament()`, objeto novo a cada mensagem: `src/room/RoomEntry.tsx:93`, `src/room/SeriesWatch.tsx:224`, `:258`. | 1 |
| S2 | C | Fim do Jogo 1: "a série continua", mas o único botão é "Ver resultado da série", que mostra o placar final. | `SeriesWatch.tsx:314` usa `status === "complete"`, verdade para toda série assistida (a onda simula a série inteira). | 1 |
| S3 | C | "Link de convite" do lobby = `localhost` + `?host=<token>`. Quem entra por ele vira segundo host. | `src/room/LobbyScreen.tsx:49`; servidor promove qualquer portador do token (`server/room/state.ts:113`, `:146`). | 1 |
| S4 | C | Resultado antes da partida: "Jogo 1 de 3"; placares e "Eliminado" no chaveamento das séries ainda não vistas; banner de campeão no Jogo 1 da Grande Final; com rede lenta, 8 s de "Eliminado" antes de a partida carregar. | Ondas inteiras simuladas (D-24); telas usam o `roomState` assim que chega. | 1 (parcial) e 3 |
| S5 | C | Eliminado é mandado para outra série, não para a própria queda. | `server/room/tournament.ts:392` sobrescreve quem caiu nesta onda com `daOnda[0]`. | 1 |
| S6 | C | Votação abre no instante em que a onda é simulada e toma a tela de todos. | `server/room/hub.ts:1205` + prioridade absoluta em `RoomEntry.tsx:67`. | 3 |
| S7 | A | Espectador lê "Seu time venceu esta partida!". | `src/playback/PlaybackScreen.tsx:197`: `null ?? "user"`. | 1 |
| S8 | A | Derrota na chave superior: "Sua equipe foi eliminada". | `src/tournament/SeriesResultScreen.tsx:195` (também no solo). | 1 |
| S9 | A | Narração e barra presas ao lado A ("Seu time", "Você 58%"): erradas para o humano do lado B e para espectadores. | Texto vem pronto do motor (D-08). | 4 |
| S10 | A | Sem reconexão automática; F5 = refazer o formulário; telas do torneio não mostram queda nem erro. | `src/net/store.ts:191`; banners só em lobby/draft. | 2 |
| S11 | A | Convidado cai no menu solo; o cartão do solo fica embaixo da sala o tempo todo. | `src/App.tsx:616`, `RoomEntry.tsx`. | 2 |
| S12 | A | Sem saída da partida para o chaveamento (só pela tela de resultado). | `SeriesWatch.tsx` barra de navegação. | 1 |
| S13 | M | Espectador arrancado da série quando os vivos avançam a onda. | Barreira não conta eliminados antes da votação (D-29) + `autoWatchEspectadores`. | 3 |
| S14 | M | "esperando 3 de 3" ambíguo, sem nomes; "Estou pronto" a ~1.140 px (3,5 telas no celular); "Liberar a próxima onda" em vermelho mais forte que "Estou pronto". | `src/room/BracketScreen.tsx:100`, `:191`. | 5 |
| S15 | M | "Onda 1 de 6" é jargão; fase mistura passado e próximo; "Seu time" sem situação; apelidos somem após o draft. | `BracketScreen.tsx`. | 5 |
| S16 | M | Modo sincronizado: sair da partida desliga a sincronia; religar a cada onda; convidado sem aviso de que o host controla. | `SeriesWatch.tsx` `sair()`; `hub.ts` `voltarAoChaveamento`. | 5 |
| S17 | M | Rolagem não volta ao topo ao trocar de tela. | `RoomEntry.tsx`. | 1 |
| S18 | M | Draft: nada avisa "Sua vez" fora da aba; assentos na ordem do índice, não da escolha. | `src/room/RoomDraftScreen.tsx`. | 5 |
| S19 | M | Quem chega atrasado: "A sala já começou. Peça o link…" (já tem o link) e não pode assistir. | `server/room/state.ts:127`. | 2 |
| S20 | M | Pódio só com o campeão; "ELIMINADO" em quase todo card; sem revanche; reconectar depois do fim cai no replay da GF. | `src/room/PodiumScreen.tsx`. | 5 |
| S21 | M | "Encerrar" na votação deixa o torneio sem campeão. | `applyVoteResult` (D-33). | 3 |
| S22 | M | MVP do torneio por soma bruta (favorece quem jogou mais séries). | `server/room/tournament.ts:511`. | 5 |
| S23 | B | "Faltam 1 voto". | `src/room/VotePanel.tsx:47`. | 1 |
| S24 | B | Terminal e lobby listam `172.31.*` (adaptador virtual) antes de `192.168.*`. | `server/cli.ts:48`. | 1 |
| S25 | B | `< 2` literal e limites de turno duplicados no lobby. | `LobbyScreen.tsx:79`, `:264`. | 1 |
| S26 | B | Quem caiu no lobby ocupa vaga para sempre; host não remove. | `server/room/state.ts`. | 5 |

## 4. Achados de UI/UX do portal

| ID | Sev | Achado | Onde | Pacote |
|----|-----|--------|------|--------|
| U1 | A | A partida da sala no celular rola 184 px para o lado (574 px de largura em 390) e corta placar e nomes dos times. | `src/playback/**` (BroadcastBar, painéis) | 4 |
| U2 | A | Editor de jogadores: os 40 jogadores abertos de uma vez, cada um com fotos, sliders, 8 campeões, persona e traços — 48.800 px de página (75.000 no celular), 1 px de rolagem lateral no celular. | `src/components/PlayerEditor.tsx` | 4 |
| U3 | A | Duas linguagens visuais: solo com títulos condensados em caixa alta e botões grandes em gradiente; sala com títulos pequenos dourados e botões menores. Dois chaveamentos diferentes (árvore no solo, colunas na sala); dois cartões de draft diferentes (o do solo mostra traços, o da sala não). | `src/styles.css`, `src/room/room.css`, `BracketView` × `BracketSeriesList`, `DraftScreen` × `RoomDraftScreen` | 4 |
| U4 | M | Draft solo diz "Rodada 1 de 5 — escolha um TOP", mas aceita qualquer rota. | `src/draft/DraftScreen.tsx` | 4 |
| U5 | M | Até o primeiro jogador escolhido no solo são quatro telas (Iniciar torneio → Seu time → Monte seu time/velocidade → Iniciar draft), e nenhuma tem "Voltar". | `App.tsx`, `TeamEditScreen`, `DraftScreen` | 4 |
| U6 | M | A sala não tem as escolhas que o solo tem: sigla e cor do time, capitão ("influencia o time na simulação"). | `src/room/LobbyScreen.tsx`, `RoomDraftScreen.tsx` | decisão D4 |
| U7 | M | Botão "Jogar com amigos" flutuando no topo de todas as telas do solo, inclusive no meio do draft e do chaveamento. | `RoomEntry.tsx` | 2 |
| U8 | M | Chaveamento solo sem saída para o menu. | `BracketView.tsx` | 4 |
| U9 | B | Vocabulário misturado: TOP/JGL/MID/ADC/SUP, Topo/Caçador/Meio/Atirador/Suporte e TOP/JUNGLE/MID/ADC/SUPPORT (inglês) em telas diferentes; "EMBUTIDO"; "+ Linkar campeão". | várias | 4 |
| U10 | B | Acentos faltando em textos de tela: "Automatico (derivar da rota e tracas)", "TRACOS (MAXIMO 2)", "Suporte util sem dano", "Mecanico sem macro", "CACAR ISOLADOS". Narração do motor: "atencao", "critico" (motor: só registrar). | `PlayerEditor`, `ChampionSelect`; motor | 4 |
| U11 | B | Capitão: o escolhido aparece com estrela vazada e os outros com estrela cheia (afordância invertida); sem atributos visíveis para decidir. | `DraftScreen.tsx` | 4 |
| U12 | B | Chaveamento da sala no celular: painel com margens largas, cartões estreitos, "Estou pronto" a 2.940 px. | `room.css` | 5 |

### 4.1 Da auditoria de código (os que mais pesam)

Relatório completo da auditoria (≈80 achados com arquivo:linha e correção): `docs/superpowers/specs/2026-10-01-auditoria-ui-codigo.md`. Os itens abaixo são os que entram nos pacotes.

| ID | Sev | Achado | Onde | Pacote |
|----|-----|--------|------|--------|
| U13 | A | Sala desenhada **em cima** do app solo, que continua renderizado; a sala não tem "Sair". | `src/App.tsx:616`, `RoomEntry.tsx:120-147` | 2 |
| U14 | A | `<html lang="en">` num app em pt-BR (leitor de tela lê com pronúncia inglesa; Chrome oferece tradução). | `index.html:2` | 4 |
| U15 | A | Dois sistemas visuais: ~254 cores fixas fora do `:root` em `styles.css` (dois dourados, dois vermelhos, dois azuis de "seu time"); `room.css` usa 13 tokens que não existem no `:root` (warn/danger/ok/focus…). | `styles.css`, `room.css` | 4 |
| U16 | M | 17 classes diferentes para o botão principal dourado (3 preenchimentos, 4 raios, 3 cores de foco) e ~18 para secundário/voltar. | `styles.css`, `room.css`, `PackManager.css`, `PlayerEditor.css` | 4 |
| U17 | A | Ações destrutivas sem confirmação: excluir pacote, remover jogador, "Restaurar padrão". | `PackManager.tsx:276-281`, `PlayerEditor.tsx:493-507` | 4 |
| U18 | A | "Editar jogadores" sempre edita o pacote Pros; com um pacote próprio ativo, as edições não entram no torneio e a tela não avisa. | `PlayerEditor.tsx:123-125`, `storage/packs.ts:164-166` | 4 |
| U19 | A | Botões desabilitados parecem habilitados (sem regra `:disabled`): "Iniciar torneio", "Começar o draft". | `styles.css:2104-2120`, `room.css:130-150` | 4 |
| U20 | A | Overlay de resultado (`role="dialog"`) não recebe foco, não prende o Tab e não rola em tela baixa. | `PlaybackScreen.tsx:367-372`, `styles.css:1427-1438` | 4 |
| U21 | M | Campos com `outline: none` sem substituto visível; inputs de arquivo do solo fora do teclado (`display:none`). | `PackManager.tsx:171-180`, `PlayerEditor.tsx:459-467`, 6 regras de CSS | 4 |
| U22 | M | A cor escolhida em "Seu time" quase não aparece: a transmissão e o mapa continuam azuis fixos; a opção vermelha confunde com o rival. | `styles.css:1144`, `:1197`, `RiftMap.tsx:31`, `TeamEditScreen.tsx:33` | 4 |
| U23 | M | `aria-live` na tela inteira do chaveamento; destaque de evento `role="status"` + `assertive` repetindo o ticker. | `BracketView.tsx:102`, `BracketScreen.tsx:118`, `EventHighlight.tsx:88-89` | 4 |
| U24 | M | Contraste: aviso legal ~1,6:1 (9 px), estrela vazia ~1,9:1, rótulos de 10–11 px entre 2,9:1 e 4:1. | `styles.css:1825`, `PlayerEditor.css:219`, `styles.css:1234`, `:2890` | 4 |
| U25 | M | Sem breakpoint: seleção de campeões (3 colunas fixas), barra de transmissão, tabela do resultado, navegação da série na sala. | `styles.css:2781`, `:1142`, `:2641`, `room.css:1265` | 4 |
| U26 | M | Sala e solo usam fontes de jogadores diferentes: "Pacote" (.xlsx) no solo, `players.json` na sala; pacotes do usuário não servem na sala. | `LobbyScreen.tsx:273-279`, `PackManager.tsx` | decisão D10 |
| U27 | B | Texto do motor sem acento ou em inglês: "Cacar Isolados", "Escaramuca", "estado critico", "atencao", "azarao", "siege". | `src/sim/teamComp.ts`, `structures.ts`, `laneSignals.ts`, `deathQuality.ts`, `upset.ts` | decisão D11 |

### 4.2 Modo solo (confirmado no navegador em 2026-10-01)

| ID | Sev | Achado | Causa | Pacote |
|----|-----|--------|-------|--------|
| O1 | C | O jogo que decide a série nunca é exibido: depois do card "2–0, a série continua", "Continuar" vai direto para o resultado 3–0. | `src/App.tsx:513-533` pula `champ-select`/`playback` quando alguém chega a 3. | 6 |
| O2 | C | "Ver replay" → "Continuar" simula um jogo extra numa série encerrada: a série salva virou 4–0 e o `advanceSlot` roda de novo. O replay do Jogo 1 mostra o placar final e "🏆 venceu a série". | `App.tsx:442`, `:571-579` chamam `playNextGame` em série completa; `src/tournament/series.ts:53-66` sem guarda; placar final em `App.tsx:438-439`. | 6 |
| O3 | C | Recarregar no meio de uma série e "Continuar torneio" leva a um chaveamento sem nenhum botão: o torneio trava. | Série salva `in_progress`; `BracketNode.tsx:109` só mostra ação para `ready`. | 6 |
| O4 | A | Chaveamento solo marca "ELIMINADO" em quem perdeu na chave superior e continua vivo (ex.: "Lobos do Nexus ELIMINADO" nas quartas, jogando a semifinal inferior). | `BracketNode.tsx:57-65`. | 6 |
| O5 | A | Sem tela de fim de torneio e sem caminho do chaveamento para o menu; os stubs ainda dizem "disponível no próximo plano". | `App.tsx:787-803`, `BracketView.tsx`. | 6 |
| O6 | A | "Velocidade da partida" não tem efeito: toda partida de torneio roda em "fast". | `src/tournament/series.ts:108`. | 6 (D12) |

## 5. Pacotes

1. **Pacote 1 — A noite para de quebrar.** S1, S2, S3, S5, S7, S8, S12, S17, S23, S24, S25 e a parte de S4 que não exige design ("Jogo N · MD5"; sem banner de campeão durante a própria Grande Final). Plano pronto: `docs/superpowers/plans/2026-10-01-sala-correcoes-da-noite.md`.
2. **Pacote 2 — Entrada e conexão.** S10, S11, S19, U7, U13: modo único "solo" ou "sala" no `App` (com a sala aberta, nada do solo é renderizado; "Sair da sala"), reconexão automática com espera crescente, `hello` automático com identidade lembrada, faixa única de conexão/erro em todas as fases, abrir a sala direto para quem chega pelo link. Depende de D3.
3. **Pacote 3 — Sem spoiler.** Resto de S4, S6, S13, S21. Depende de D1 e D2.
4. **Pacote 4 — Um portal só.** U1–U5, U8–U11, U14–U25, S9: tokens completos no `:root` e troca das cores fixas, 4 classes de botão (`.btn`, `--primary`, `--secondary`, `--danger`), foco visível global, `lang="pt-BR"`, confirmação nas ações destrutivas, glossário único (`src/copy.ts`), breakpoints da partida/seleção/resultado, editor em lista + detalhe. Depende de D5, D6, D7, D8.
5. **Pacote 5 — Social e fechamento.** S14, S15, S16, S18, S20, S22, S26, U12. Depende de D9.
6. **Pacote 6 — Solo: série e chaveamento.** O1–O6: mostrar o jogo decisivo antes do resultado; replay em modo próprio (só navega, placar até o jogo exibido, guarda em `playNextGame` para série completa); "Continuar série (2–1)" para série `in_progress`; "Eliminado" só com a segunda derrota (ou "→ chave inferior"); tela de fim de torneio reaproveitando o pódio da sala; voltar ao menu a partir do chaveamento. Independe da sala e das decisões, exceto D12.

## 6. Decisões pendentes (com recomendação)

- **D1 — Como esconder resultado ainda não visto.** Recomendado: revelação por pessoa só no cliente (cada navegador guarda até onde viu cada série; o chaveamento mostra "jogada · assista" em vez de placar, esconde "Eliminado" e o convite de espectador até a pessoa ver o jogo decisivo). Alternativa: servidor só libera o resultado quando a pessoa termina de assistir (protocolo novo, mais caro).
- **D2 — Quando a urna abre e o que "Encerrar" faz.** Recomendado: a urna abre depois que todos marcam pronto após a onda (quem caiu nela continua na barreira até lá) e aparece como painel no chaveamento, sem tomar a partida. "Encerrar" passa a "Pular para o pódio": simula o resto na hora e coroa um campeão.
- **D3 — Entrada pelo link.** Recomendado: quem abre o link da sala vai direto para o formulário (ou volta sozinho, se o navegador já tem identidade); o menu solo some enquanto a sala está aberta; o host acessa "Pacotes" e "Editar jogadores" por um link discreto no lobby.
- **D4 — Paridade sala × solo.** Recomendado: no lobby, cada um escolhe nome, sigla e cor (reaproveitar a tela "Seu time" do solo); a cor marca o time no chaveamento e na partida. Capitão na sala: decidir se entra (mexe no que vai para a simulação).
- **D5 — Um chaveamento só.** Recomendado: um componente para os dois modos, com a árvore do solo como base e os estados da sala (pronta, assistindo, meu time) por cima.
- **D6 — Editor de jogadores.** Recomendado: lista compacta com busca e filtro; clicar abre um jogador por vez.
- **D7 — Narração da sala.** Recomendado: na exibição, trocar "Seu time"/"Rival"/"Você" pelas siglas dos times (sem tocar no motor).
- **D8 — Vocabulário.** Recomendado: rotas por extenso em português nas telas de leitura (Topo, Caçador, Meio, Atirador, Suporte) e siglas TOP/JGL/MID/ADC/SUP só onde falta espaço; "série" em vez de MD5/Bo5 no texto corrido; "rodada" em vez de "onda".
- **D9 — Fim de noite.** Recomendado: classificação final dos times humanos, botão "Revanche" do host (volta ao lobby com as mesmas pessoas), MVP por média por jogo.
- **D10 — Uma fonte de jogadores.** Recomendado: o lobby da sala oferece os pacotes que o host já tem no navegador (Pros + próprios) em vez de pedir um `players.json`.
- **D11 — Texto do motor.** Os acentos e termos da narração moram em `src/sim/**`, fora do escopo combinado. Recomendado: corrigir só as strings (sem tocar em lógica) num commit separado, ou deixar registrado para o dono do motor.
- **D12 — Velocidade da partida.** Recomendado: remover o seletor do draft (o 1x/2x da partida já cobre) em vez de passar o preset ao motor.
