# Design — Sala de ponta a ponta, Pacotes 2 a 5 (Rundown da Sala 2)

**Data:** 2026-10-01
**Base:** branch `sdd/sala-correcoes-da-noite` (Pacote 1, ainda não mergeado na `master`). Este trabalho empilha em `sdd/sala-ponta-a-ponta`.
**Achados de origem:** `docs/superpowers/specs/2026-10-01-sala-ponta-a-ponta-design.md` (S1–S26, U1–U27).
**Pedido:** "UI e UX completamente integrados, experiência fluida do começo ao fim, informações e nomenclaturas necessárias, sem ambiguidades (você ganhou quando você perdeu)".
**Fora de escopo:** o motor (`src/sim/**`) e as regras de vitória/placar; Pacote 6 (bugs do modo solo); editor de jogadores e a unificação visual do portal inteiro (Pacote 4 fora da sala).

## 1. Decisões (D1–D12 do design anterior)

| ID | Decisão | Origem |
|----|---------|--------|
| D1 | Revelação por pessoa, só no cliente. Cada navegador guarda quais séries já viu até o jogo decisivo. | recomendação aceita |
| D2 | A urna abre quando todos marcam pronto **depois** da onda em que o último humano caiu (quem caiu nela continua na barreira até lá). Aparece no chaveamento, sem tomar a partida. "Encerrar" vira **"Pular para o pódio"**: simula o resto na hora e coroa um campeão. "Continuar assistindo" já roda a próxima rodada. | usuário |
| D3 | Quem abre o link vai direto para a sala; o menu solo não é desenhado com a sala aberta; "Sair da sala" leva ao menu solo, que mostra uma faixa "Voltar para a sala". | recomendação aceita |
| D4 | Só nome do time; a sigla automática (única entre os 8) aparece já no lobby. Sem cor nem capitão na sala. | usuário |
| D7 | Narração e barra de probabilidade da sala usam os nomes/siglas dos times, nunca "Seu time"/"Rival"/"Você" fixos no lado A. "VOCÊ" marca o lado de quem assiste. | pedido explícito |
| D8 | "Rodada" em vez de "onda"; "melhor de 5" em vez de MD5 no texto corrido. | recomendação aceita |
| D9 | Pódio com classificação final, MVP por média por jogo e botão **"Revanche"** do host (volta ao lobby com a mesma turma). | usuário |
| D10 | O lobby oferece ao host os pacotes do navegador (Pros + próprios); o upload de `players.json` fica como opção avançada. | usuário |
| D5, D6, D11, D12 | Fora deste trabalho (solo/portal/motor). | — |

## 2. Fases de entrega

Cada fase termina com typecheck de cliente e servidor e a suíte da sala verdes, e vira um commit (ou poucos).

### Fase A — Partida sem ambiguidade (S9, U1)

- `SeriesWatch` reescreve, na exibição, o texto da narração: "Seu time" → nome do time do lado A da partida, "Rival" → nome do lado B (função pura `renomearNarracao`). O motor não muda.
- `PlaybackScreen` usa a `perspectiva` que já recebe para rotular os dois lados: o lado de quem assiste é "Você"; o outro é a sigla (sala) ou "Rival" (solo, `perspectiva` omitida). Vale para a barra de probabilidade, o texto "X% — Y%" e o selo **VOCÊ** no placar de transmissão.
- Veredito com nome: "Vitória — {time} venceu esta partida!" / "Derrota — {time} venceu esta partida." / neutro "{time} venceu esta partida.". Resumo com siglas: "Abates FUR 12 × 8 DRG · Torres 9 × 4 · Dragões 3 × 1". MVP/Bagre com a sigla do time.
- Placar de transmissão e painéis cabem em 390 px (sem rolagem lateral).

### Fase B — A sala é uma tela própria; conexão que se recupera sozinha (Pacote 2: S10, S11, S19, U7, U13)

- `src/room/modo.ts`: sinal `salaEmPrimeiroPlano`. Com a sala aberta, `App.tsx` não desenha nada do solo. Servidor de sala detectado → abre a sala direto.
- `RoomShell`: cabeçalho comum a todas as fases — marca "Sala", etapas (Lobby → Draft → Torneio → Pódio) com a atual destacada, meu time (sigla + nome + apelido), selo de host, estado da conexão, "Sair da sala".
- Identidade lembrada (`apelido`, `time`) junto do `clientId`; com identidade guardada o `hello` sai sozinho, sem formulário.
- Reconexão automática com espera crescente (1 s, 2 s, 4 s, 8 s, teto 10 s) e botão "Tentar agora". Estados: conectando, conectado, reconectando, sem conexão. Uma faixa só, em todas as fases, para conexão e para erro do servidor.
- Quem chega depois do lobby entra como **espectador** (sem time): assiste ao draft e às séries, não vota nem marca pronto. Protocolo v4: `RoomPlayerWire.spectator`.
- `<html lang="pt-BR">`.

### Fase C — Sem spoiler (Pacote 3: resto de S4, S6, S13, S21)

- `src/room/revelacao.ts` (puro): `ONDA_DO_SLOT` estático (4, 4, 3, 1, 1, 1 — preso por teste contra o `runWave` real); série da onda atual só é "revelada" para mim depois que vi o jogo decisivo dela ou cliquei "Mostrar resultados desta rodada". Séries de ondas anteriores estão sempre reveladas (os confrontos novos já contam quem passou).
- Série não revelada no chaveamento: sem placar, sem vencedor, status "jogando agora · assista"; times que ela decide aparecem como "A definir" nos cards seguintes; "Eliminado" (cards, lista de times, "Seu time") só aparece depois de revelado.
- Pódio só depois de ver a Grande Final; antes disso o chaveamento mostra "Assistir à Grande Final". Banner de campeão só com a final revelada.
- Votação: sai da prioridade absoluta; aparece no chaveamento. Servidor: barreira inclui quem caiu na onda atual; com todos os humanos fora, a barreira satisfeita abre a urna em vez de rodar a onda; "continuar" roda a próxima onda na hora; "pular" roda todas até o campeão e encerra.
- A memória do que vi é por torneio (`TournamentWire.id`), para a Revanche não herdar séries "vistas".

### Fase D — Chaveamento e ritmo (Pacote 5: S14, S15, S16, S18, U12)

- Cabeçalho do chaveamento: "Rodada 2 de 6 — Semifinais da chave superior e 1ª rodada da chave inferior" (rótulo pela composição estática da rodada) e "A seguir: …".
- "Seu time: FUR Fúria — chave superior / chave inferior / eliminado / campeão" (respeitando a revelação). Apelido do dono ao lado de cada time humano; "bot" nos demais.
- Barra de ação fixa no rodapé: "Pronto para a próxima rodada" (ativo: "Pronto ✓ — clique para desfazer"), "Esperando: Bia, Caio" (novo `TournamentWire.aguardando`, publicIds de quem a barreira ainda espera), host: "Começar a próxima rodada agora" em estilo secundário.
- "Modo sincronizado" vira "Assistir juntos (o host controla)"; a sincronia acompanha o host quando uma rodada nova roda; convidado vê "O host controla esta exibição".
- Draft: assentos na ordem de escolha; "Sua vez!" no título da aba; selo "você" no meu assento.
- Chaveamento legível no celular.

### Fase E — Lobby (S26, D4, D10)

- Etapas para quem chega: formulário → "Você está na sala. Aguardando {host} começar o draft".
- Host: lista de pacotes do navegador com cobertura ("dá para 8 times" / "faltam 2 suportes") e "Usar esta base"; "Base padrão do jogo" (rota nova `/api/base-padrao`); upload de `players.json` em "Opções avançadas". `App.tsx` passa os pacotes como prop — `src/room/**` não importa `storage/`.
- Sigla de cada time ao lado do nome; "N pessoas + {8−N} bots"; tempo por turno com atalhos (30 / 60 / 90 / 120 s).
- Trocar o próprio nome/time no lobby; host remove quem caiu (`removePlayer`, só lobby, só desconectado).

### Fase F — Fim de noite (S20, S22, D9)

- Pódio com classificação final (1º, 2º, 3º, 4º, 5º–6º, 7º–8º, pelo chaveamento), apelidos dos humanos, sem a enxurrada de "Eliminado".
- MVP/Bagre por média por jogo (`K/D/A em N jogos`).
- "Revanche" (host): `rematch` volta a sala ao lobby com as mesmas pessoas e nomes; espectadores viram jogadores se houver vaga.

## 3. Verificação

- Funções puras novas com teste unitário (revelação, rótulos de rodada, narração, perspectiva, classificação, barreira/urna).
- Suíte da sala + `server/` + `src/playback` + `src/tournament`, typecheck de cliente e servidor.
- Noite de jogo de ponta a ponta com o driver Playwright (host + 2 convidados + bots, uma reconexão, um atrasado como espectador, votação, Revanche, celular a 390 px), com `server/data` salvo antes e restaurado depois.
