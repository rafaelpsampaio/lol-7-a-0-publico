# Design: Editor de pacotes

**Data:** 2026-10-05
**Status:** Desenho aprovado em brainstorming; aguardando revisão desta spec
**Escopo:** menu do dono da instância, editor de pacotes dentro do app gravando nos arquivos do jogo pelo servidor local, foto por pessoa, regra de uma rota por carta com força igual à média das fases. Não mexe em `src/sim/`.
**Mock aprovado:** `2026-10-05-editor-de-pacotes-mock.html` (abrir direto no navegador; usa as fotos e os campeões de `public/`) e `2026-10-05-editor-de-pacotes-mock.png`.

## 1. Contexto

Hoje existem duas telas de edição, e nenhuma resolve o caso de uso:

- **"Editar jogadores"** (`src/components/PlayerEditor.tsx`) edita nome, rota, força por rota, fases, traits, foto e campeões, e adiciona jogadores. Só enxerga o pacote Pros/Mundial e grava tudo no localStorage deste navegador (`src/storage/playerOverrides.ts`).
- **"Pacotes"** (`src/components/PackManager.tsx`) lista, seleciona, importa e exporta planilha e exclui. Não edita carta nenhuma.

O pacote Amigos mora em `public/packs/amigos.json` e é editado à mão. O dono alterna entre dois PCs pelo GitHub, e o jogo roda pelo servidor da sala (`jogar.bat`: build, servidor e túnel do cloudflared), com os amigos entrando pelo link de convite. O lobby publica o pacote cru, sem as edições do navegador, então o que se edita hoje no app nem chega à sala.

O objetivo: o dono abre o servidor, escolhe "Editar pacotes" e edita qualquer pacote (cartas, fotos, fases, traits, campeões, pessoas novas), com a mudança valendo no solo e na sala sem tocar em JSON à mão.

## 2. Decisões

| # | Decisão | Razão |
|---|---------|-------|
| E-01 | **Os arquivos do jogo são a única fonte da verdade.** O editor grava pelo servidor local em `public/`. Não existe mais camada de edição no navegador. | Vira commit, chega ao outro PC e à sala. Nada fica valendo escondido por cima do arquivo. |
| E-02 | **Dados antigos do navegador são ignorados.** Overrides, fotos e pacotes do localStorage deixam de ser lidos, e o código que os mantinha sai. | Decisão do dono. Os dados ficam lá, inertes. |
| E-03 | **Todos os pacotes são editáveis.** Pros/Mundial em `public/players.json`, Amigos em `public/packs/amigos.json`, pacotes novos em `public/packs/<id>.json`. | O dono quer editar "ambos" e criar novos. Não há mudança de lugar dos arquivos que já existem. |
| E-04 | **Menu do dono com 3 opções:** Jogo solo, Editar pacotes e Multiplayer. Quem abre o convite sem token vai direto para a sala, como hoje. | Fluxo descrito pelo dono. |
| E-05 | **Rascunho e botão Salvar.** O editor carrega o pacote, as mudanças ficam na memória e Salvar manda o pacote inteiro. O servidor recusa se o arquivo mudou por fora desde a carga. | Previsível com git e dois PCs. Protege contra sobrescrever trabalho vindo do outro PC. |
| E-06 | **Uma rota por carta.** `roles = [primaryRole]`. A mesma pessoa em outra rota é outra carta. | Nenhuma carta de Pros ou Amigos tem mais de uma rota hoje. |
| E-07 | **Força na rota = nota geral = `round(média das 3 fases)`**, a mesma conta de `playerOverall` em `src/data/playerPresentation.ts`. Não é editável: sai das fases. As outras 4 rotas ficam em 0. | Regra dos Amigos (A-03), estendida a todos. Os Pros, que hoje batem em só 5 de 40 cartas, são recalculados uma vez, em commit próprio (seção 9). |
| E-08 | **Foto é da pessoa:** `public/players/<personId>.jpg`, JPEG 512×512, recorte quadrado central feito no navegador. Todas as cartas da pessoa apontam para ela. | Mesmo formato das fotos que já existem. |
| E-09 | **Nome é da pessoa.** Edita-se no cabeçalho da pessoa, e o `displayName` de cada carta é montado sozinho (seção 4). | Hoje nenhuma pessoa tem nome divergente entre cartas; um campo por carta só abriria espaço para divergir. Refina o mock, que tinha "Nome" por carta. |
| E-10 | **Fora do editor:** persona avançada (`advanced`), estilo, frase curta e tags livres. Se uma carta já os tiver, o editor preserva sem mostrar. | Nenhuma carta usa, nenhuma tela mostra estilo e frase, e o dono não reconheceu esses campos. |
| E-11 | **Escrita exige o token do dono:** o token do link de host que o servidor imprime ao subir, guardado uma vez no arranque. Transferir o host da sala para um amigo não dá a ele acesso ao editor e não tira o acesso do dono. | O editor escreve no disco do dono. Checar "veio do localhost" não serve: pelo túnel, o cloudflared também conecta pelo localhost. |
| E-12 | **Visual das telas novas:** escuro, no estilo Apple (títulos grandes, listas agrupadas, controles segmentados, sliders), com dourado e creme do cliente do LoL e ícones de linha de inspiração LoL. Nada de emoji. O resto do app não muda neste projeto. | Pedido do dono, validado no mock v4. |
| E-13 | **A nota geral aparece em cada carta:** selo no canto da foto da prévia, nas abas das cartas e na lista de pessoas (a maior nota da pessoa). No `PlayerCard` do draft, o selo segue o `statsMode`. | Pedido do dono. No modo oculto, o selo não pode entregar o número antes da escolha. |
| E-14 | **Fotos no draft e na partida ficam para o projeto seguinte**, com spec e mocks próprios. | Mexe em outras telas e não depende de como o editor grava. Este projeto é o que coloca as fotos no jogo. |

## 3. Fluxo e telas

### 3.1 Quem vê o quê

- **Dono** (tem o token do dono no navegador e o servidor confirma em `GET /api/dono`): cai no menu do dono.
- **Amigo** (sem token, ou token que não é o do dono): vai direto para a sala, como hoje (D3 da spec da sala).
- **`npm run dev`** (sem servidor de sala): menu do dono sem a opção Multiplayer.
- O navegador guarda o token do link `?host=` no localStorage (chave `lolseteazero:dono`) antes de limpá-lo da barra, além de continuar entregando-o à sala como hoje.

### 3.2 Menu do dono

Título grande "LoL 7 a 0", subtítulo "Você é o host". Três blocos grandes:

- **Jogo solo:** ícone de espada em moldura hexagonal. "Torneio contra bots. Pacote: <nome do pacote ativo>". Abre o menu de torneio de hoje (`LaunchMenu`), sem os botões "Pacotes" e "Editar jogadores" e com um seletor de pacote no lugar.
- **Editar pacotes:** mosaico com as fotos das pessoas como fundo. Abre a lista de pacotes.
- **Multiplayer:** espadas cruzadas em moldura hexagonal, mais o número de pessoas na sala (`conectados` em `/api/room-info`). Coloca a sala em primeiro plano. Sair da sala volta para este menu.

### 3.3 Lista de pacotes

- Topo: voltar ("Início"), título "Pacotes", "Importar planilha" e "Novo pacote" (pede o nome).
- Cada pacote é um card com:
  - capa feita com até 5 fotos das pessoas (iniciais quando não há foto);
  - nome, "N cartas · M pessoas" (os Pros mostram "base padrão do jogo");
  - contagem por rota com ícone;
  - selo do baralho: verde "Pronto para torneio" ou laranja "Faltam cartas em Atirador e Suporte", com a mesma conta do menu e do lobby (`deckSafety`).
- Ações do card: botão "Editar" e menu "···" com "Exportar planilha" e "Excluir pacote". Os Pros não têm Excluir.
- O caminho do arquivo **não** aparece.

### 3.4 Editor do pacote

**Cabeçalho**
- Voltar ("Pacotes") e nome do pacote com lápis (renomeia).
- Selo do baralho e contagem por rota, ao vivo.
- "N alterações", "Descartar" e "Salvar". Salvar só acende com mudança e fica bloqueado enquanto houver carta com erro.

**Coluna das pessoas (esquerda)**
- Busca e filtro por rota (controle segmentado com os 5 ícones).
- Cada linha mostra:
  - foto redonda, ou iniciais;
  - nome e a maior nota geral da pessoa;
  - ícones das rotas de cada carta;
  - alerta vermelho se alguma carta tiver erro.
- No fim da lista, "Nova pessoa".

**Centro: a pessoa e a carta aberta**
- **Pessoa:** foto grande com botão de câmera (sobe ou troca), nome grande com lápis e "N cartas · a foto vale para todas · Remover foto".
- **Abas das cartas:** ícone da rota, ano ou nome da rota, e o selo da nota. A última aba é "Nova carta".
- **Formulário da carta**, em grupos no estilo dos Ajustes do iPhone:
  - **Carta:** ano (opcional) e rota, com 5 botões de ícone (Topo, Selva, Meio, Atirador, Suporte).
  - **Fases do jogo:** sliders de Rotas, Meio de jogo e Fim de jogo (1 a 100), e a linha "Nota geral" com o número grande e a explicação "Média das três fases. É a força da carta na rota, calculada sozinha."
  - **Traits · N de 4:** chips com as 15 traits do catálogo. A descrição de `traitInfo.ts` aparece ao passar o mouse e embaixo do grupo. Com 4 escolhidas, as outras ficam apagadas.
  - **Campeões · N no pool, mínimo 8:** retrato, nome e conforto de 1 a 5 em barrinhas clicáveis, mais "Adicionar" (busca no catálogo, com quem já está no pool fora da lista). Remover fica em cada campeão.
  - "Remover esta carta", em vermelho.

**Direita: prévia**
- "No draft": o `PlayerCard` real, com o selo da nota no canto da foto, atualizando ao vivo.

### 3.5 Operações

- **Nova pessoa:** pede o nome e cria a pessoa com uma carta vazia, para você escolher a rota.
- **Nova carta:** cria uma carta para a pessoa aberta.
- **Valores iniciais de uma carta nova:**
  - fases 70/70/70;
  - sem traits;
  - pool vazio, o que deixa a carta com erro até chegar a 8 campeões;
  - rota: a primeira que a pessoa ainda não tem.
- **Remover a última carta** de uma pessoa remove a pessoa. A foto em disco só sai se ela não estiver em uso em nenhum pacote.
- **Renomear pessoa:** troca o nome em todas as cartas dela (seção 4).
- **Foto:**
  - A escolha do arquivo abre uma prévia do recorte quadrado central.
  - Ao confirmar, a foto fica no rascunho como pendente (a prévia usa a imagem recortada) e conta como alteração.
  - Nada vai para o disco antes do Salvar. No Salvar, o editor primeiro sobe as fotos pendentes (`PUT /api/fotos/:pessoa`), depois grava o pacote, com `photo` apontando para `/players/<pessoa>.jpg` em todas as cartas da pessoa.
  - Remover a foto também só acontece no Salvar: o pacote é gravado sem `photo` e depois sai um `DELETE /api/fotos/:pessoa`, que só apaga o arquivo se nenhum pacote ainda o usar.
  - Descartar não deixa arquivo órfão.
- **Descartar:** volta ao que está no arquivo.
- **Sair com alterações não salvas:** modal próprio ("Sair sem salvar?"), não o `confirm` do navegador.

## 4. Regras da carta (`src/pacotes/regrasDaCarta.ts`)

Módulo puro (sem Solid, sem `node:`), usado pelo editor e pelo servidor.

**Invariantes de toda carta salva:**
1. `roles` tem exatamente 1 rota e `roles[0] === primaryRole`.
2. `roleStrength[primaryRole] === playerOverall(carta)` e as outras 4 rotas valem 0.
3. `photo` é ausente ou igual a `/players/<personId>.jpg`.
4. A carta passa no `PlayerVersionSchema` (pool ≥ 8, até 4 traits, fases de 1 a 100, ano de 2011 a 2035 ou ausente).

**Invariantes do pacote salvo:**
5. Os ids das cartas são únicos.
6. Os `personId` só usam `[a-z0-9-]`.
7. O pacote passa no `PlayerDatabaseSchema`, que ganha `name` opcional (seção 5).

**Ids:**
- `personId` de pessoa nova: `slug(nome)`, com `-2`, `-3` se já existir no pacote. Fica fixo depois de criado, porque é o nome do arquivo da foto.
- Id de carta nova: `<personId>-<rota>[-<ano>]`, no padrão de hoje (`rafa-top-2018`), com sufixo se já existir. Fica fixo depois de criado, mesmo que rota ou ano mudem.

**`displayName`:**
- Carta nova: `<Nome> <Rota> [<Ano>]` (`Rafa Top 2018`, `Rafa Sup`), no padrão dos Amigos. As palavras de rota são as que o `playerName` já remove: Top, Jungle, Mid, Adc, Sup.
- Renomear a pessoa troca, em cada carta, o trecho que `playerName` devolve pelo nome novo e mantém o resto (`Faker 2016` vira `Lee Sang-hyeok 2016`).
- Mudar rota ou ano de uma carta no padrão `<Nome> <Rota> [<Ano>]` regera o sufixo. Fora desse padrão (Pros, `Faker 2016`), só o ano é trocado, se ele estiver no fim.

**Funções exportadas:** `notaGeral`, `normalizarCarta` (aplica 1 e 2), `validarCarta` e `validarPacote` (devolvem a lista de erros por carta em pt-BR), `novoIdDePessoa`, `novoIdDeCarta`, `nomeDaCarta`.

## 5. Arquivos e formato

- **Registro de pacotes:** o id `pros` aponta para `public/players.json`. Qualquer outro id aponta para `public/packs/<id>.json`. O id de pacote só aceita `[a-z0-9-]`, até 60 caracteres.
- **Compatibilidade:** o pacote ativo guardado como `amigos-embutido` passa a ser lido como `amigos`.
- **Nome do pacote:** o `PlayerDatabaseSchema` ganha `name: z.string().min(1).max(60).optional()`. `amigos.json` passa a ter `"name": "Amigos"` e `players.json` passa a ter `"name": "Pros / Mundial"`. Sem `name`, usa o id.
- **Gravação:**
  - `JSON.stringify(dados, null, 2)` com quebra de linha no fim (diff limpo no git);
  - ordem das chaves: `$schema`, `name`, `players`;
  - escrita atômica com tmp e rename, apagando o tmp se o rename falhar (mesmo padrão de `server/engine/index.ts`).
- **Fotos:** `public/players/<personId>.jpg`. Ao remover a foto de uma pessoa, o arquivo só é apagado se nenhum pacote ainda apontar para ele.
- **Pacote novo:** `public/packs/<id>.json`, com id derivado do nome (`uniquePackId` de hoje, que passa a olhar os arquivos que existem).

## 6. Servidor

### 6.1 Rotas

| Rota | Quem | O que faz |
|------|------|-----------|
| `GET /api/dono` | todos | `{ dono: boolean }`: o cabeçalho `x-dono` bate com o token do dono? |
| `GET /api/pacotes` | todos | `[{ id, nome, cartas, pessoas, versao }]` |
| `GET /api/pacotes/:id` | todos | `{ id, nome, players, versao }`. `versao` = sha1 do conteúdo do arquivo |
| `PUT /api/pacotes/:id` | dono | Corpo `{ nome, players, versaoBase }`. Valida (seção 4) e grava. 409 se a versão no disco não for `versaoBase`, a menos que venha `forcar: true` |
| `POST /api/pacotes` | dono | Corpo `{ nome, players }`. Cria `public/packs/<id>.json` e devolve o id |
| `DELETE /api/pacotes/:id` | dono | Apaga o arquivo. 400 para `pros` |
| `PUT /api/fotos/:pessoa` | dono | Corpo `image/jpeg`, até 1 MB. Confere os bytes de JPEG (`FF D8 FF`) e grava `public/players/<pessoa>.jpg` |
| `DELETE /api/fotos/:pessoa` | dono | Apaga a foto se nenhum pacote a usa (senão, 409 com a lista de pacotes) |
| `GET /packs/*`, `GET /players/*` | todos | Servidos de `public/` com `cache-control: no-cache`, antes do `dist/`, para uma edição aparecer sem rebuild |

- `/api/room-info` ganha `conectados: number`.
- **Respostas de erro:** `{ erro: string, cartas?: { id: string, erros: string[] }[] }`, com os códigos 400 (pedido malformado), 403 (sem token do dono), 404, 409, 413 (grande demais), 422 (validação) e 500 (falha de disco).
- **Limites:** 2 MB para JSON e 1 MB para foto.
- **Comparação do token:** `timingSafeEqual`.

### 6.2 Onde fica o código

- `server/pacotes/`: handler HTTP, leitura e escrita dos arquivos, registro de pacotes.
- Pela quarentena D-04, `server/pacotes/` não importa de `src/` direto. O schema e as regras da carta chegam por um portal leve novo, `server/engine/pacotes.ts`, que reexporta `src/data/schema.ts` e `src/pacotes/regrasDaCarta.ts`. Esse portal não alcança a metade pesada (`server/engine/tournament.ts`), e o `server/quarentena.test.ts` continua valendo.
- `server/http.ts` delega `/api/pacotes`, `/api/fotos`, `/api/dono`, `/packs/*` e `/players/*` para esse handler.
- `server/main.ts` guarda o token do dono no arranque e troca a lista fixa de candidatos (`players.json` e `amigos.json`) pelo registro de pacotes.

### 6.3 `npm run dev` e `vite preview`

Um plugin no `vite.config.ts` monta o mesmo handler em `configureServer` e `configurePreviewServer`. Sem sala, não há token do dono: a escrita é aceita só de endereço loopback, e `GET /api/dono` responde `true` para loopback.

## 7. Cliente

### 7.1 Carregamento

- **Solo:** `App.tsx` carrega a lista de `GET /api/pacotes` e as cartas do pacote ativo de `GET /api/pacotes/:id`.
  - O pool é o pacote como está no arquivo, sem `activePool`, overrides ou fotos.
  - Id desconhecido cai para `pros`, como hoje.
  - Um torneio solo em andamento não é afetado, porque guarda cópia das cartas (`TournamentTeam.roster`).
  - Isso também acaba com a esquisitice de, pelo servidor, o `/players.json` devolver a base da sala no lugar dos Pros.
- **Lobby:** a lista de bases vem de `GET /api/pacotes`, e "Usar esta base" busca o conteúdo na hora de publicar.

### 7.2 O que sai

- `src/storage/playerOverrides.ts` e o teste dele.
- Em `src/storage/packs.ts`: o store de pacotes, `activePool`, `packSafetyOf`, `BuiltinPack` e `resolveBasePlayers`. Fica só o sinal do pacote ativo e os ids conhecidos.
- `src/components/PackManager.tsx`, `src/components/PlayerEditor.tsx` e os CSS deles. O que vale reaproveitar (seletor de campeões, resize de imagem) migra para `src/pacotes/`.
- Em `LaunchMenu`: `onEditPlayers` e `onManagePacks`, que dão lugar ao seletor de pacote.
- As telas `"packs"` e `"player-editor"` do `App.tsx`.

### 7.3 O que entra (`src/pacotes/`)

| Arquivo | Papel |
|---------|-------|
| `regrasDaCarta.ts` | Seção 4 |
| `rascunho.ts` | Estado do editor como funções puras sobre o pacote: adicionar e remover pessoa e carta, mudar rota, ano, fases, traits e campeões, renomear pessoa e pacote, e marcar foto pendente ou removida. Inclui a contagem de alterações e os erros por carta |
| `api.ts` | Chamadas às rotas da seção 6, mandando `x-dono` |
| `foto.ts` | Recorte quadrado central 512×512 em JPEG via canvas (qualidade 0,85) |
| `MenuDoDono.tsx` | Seção 3.2 |
| `ListaDePacotes.tsx` | Seção 3.3 |
| `EditorDoPacote.tsx`, `ListaDePessoas.tsx`, `FormularioDaCarta.tsx`, `PreviaDaCarta.tsx` | Seção 3.4 |
| `IconeDeRota.tsx` | Os 5 SVGs de rota do mock |
| `Modal.tsx` | Confirmações (sair sem salvar, excluir pacote, conflito) |
| `pacotes.css` | Tokens e estilos da seção E-12 (só estas telas) |

- **`PlayerCard`:** o "OVR" sai do bloco de stats e vira um selo no canto da foto. Ele aparece quando `visibleStats(mode, picked) !== "none"`. A prévia do editor usa `mode="overall"`.
- **Importar planilha:** reaproveita `parseWorkbook`, aplica `normalizarCarta` (fica a rota principal; força = média) e cria o pacote por `POST /api/pacotes`. Exportar reaproveita `buildPackWorkbook`.

## 8. Erros

| Situação | O que o dono vê |
|----------|-----------------|
| Servidor fora do ar | Aviso no topo: "Sem conexão com o servidor. Suas alterações continuam aqui." Salvar tenta de novo |
| 403 | "Só o dono pode salvar. Abra pelo link de host que o servidor mostra ao subir." |
| 409 | Modal: "Este pacote mudou fora do editor (git pull ou edição à mão)." Botões: **Recarregar** (descarta as suas alterações) e **Salvar por cima** (`forcar: true`) |
| 422 | As cartas com erro ficam em vermelho na aba e na pessoa, com a lista de erros no topo do formulário |
| Carta com erro no rascunho | Salvar bloqueado, com "2 cartas com erro" ao lado |
| Baralho incompleto | Não bloqueia. Selo laranja no cabeçalho |
| Foto que não é imagem, grande demais ou que falha ao decodificar | Mensagem embaixo da foto, sem mudar nada |
| Excluir o pacote ativo do solo | O solo volta para os Pros |
| Falha de disco (500) | "Não consegui gravar o arquivo (<motivo>)." O rascunho continua |
| Foto sobe, mas o pacote falha ao gravar | O rascunho marca a foto como já enviada, para não subir de novo. Se o dono descartar, o editor pede `DELETE` da foto, e o servidor só apaga se nenhum pacote a usa. Ou seja: foto nova de quem não tinha foto some; troca de foto de quem já tinha fica valendo, porque o arquivo tem o mesmo nome |

## 9. Migração e ordem

1. **Pré-requisito de branch.** O `feat/pack-amigos` tem 43 arquivos de 2026-10-05 sem commit e está 26 commits atrás do `origin/master` (motor e integração dos Amigos). Antes de codar: commitar o trabalho de hoje e trazer o `origin/master`, resolvendo conflitos com cuidado em `src/sim/engine.ts` e `src/sim/structures.ts`, que mudaram dos dois lados.
2. **Recálculo dos Pros, em commit próprio:** `roleStrength[primaryRole] = playerOverall` em `public/players.json`, mais `"name"` nos dois arquivos. Logo depois, rodar o golden e a calibração (`npm run calibrate:all`) e registrar o impacto. Os scripts de calibração e realismo usam os Pros como régua. Se alguma banda quebrar, isso vai para o builder do motor antes de seguir.
3. Um teste de dados garante as invariantes da seção 4 em `players.json` e `amigos.json`.
4. O resto segue o plano de implementação.

## 10. Fora do escopo

- Fotos no draft, na partida, na chave e no pódio (projeto seguinte, E-14).
- Restilizar o resto do app no estilo das telas novas.
- Commit ou push automático pelo editor. Depois de salvar, aparece só o lembrete "Salvo. Commite para levar ao outro PC."
- Editar o catálogo de traits ou o de campeões.
- Desfazer e refazer além de "Descartar".
- Ajustar o enquadramento da foto (o recorte é sempre central).

## 11. Testes

- **Unitários:**
  - `regrasDaCarta`: nota, normalização, ids, `displayName` (os dois padrões e o rename), erros;
  - `rascunho`: cada operação, contagem de alterações, erros por carta;
  - `foto`: bytes de JPEG;
  - validação de ids de pacote e de pessoa.
- **Servidor**, no padrão de `server/http.test.ts`, com diretório temporário:
  - todas as rotas;
  - escrita sem token, com token errado e com o token novo de uma transferência de host na sala (precisa dar 403);
  - 409 e `forcar`;
  - path traversal (`..%2F`, ids com ponto ou barra);
  - 413;
  - nenhum tmp sobrando depois de falha no rename;
  - `/packs` e `/players` servidos de `public/` sem cache;
  - `/api/room-info` com `conectados`.
- **Quarentena:** `server/quarentena.test.ts` segue passando, com `server/engine/pacotes.ts` fora da metade pesada.
- **Telas**, com a API simulada:
  - editar uma fase muda a nota na aba, na lista e na prévia;
  - "N alterações" conta certo;
  - Salvar manda o corpo esperado;
  - fluxo do 409;
  - Salvar bloqueado com carta inválida;
  - menu do dono com e sem token;
  - Multiplayer some sem sala.
- **Dados:** invariantes em `players.json` e `amigos.json`. Depois do recálculo dos Pros, golden e calibração com o resultado registrado.
- **Manual:**
  - subir pelo servidor com o link de host;
  - editar e salvar um pacote, conferindo o diff do arquivo;
  - subir uma foto;
  - criar e excluir um pacote;
  - publicar no lobby e ver a edição chegar;
  - abrir o convite sem token e cair direto na sala.
