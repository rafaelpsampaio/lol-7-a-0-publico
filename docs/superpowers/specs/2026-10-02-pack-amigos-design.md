# Design: Pack dos Amigos (carga inicial do macacos.xlsx)

**Data:** 2026-10-02
**Status:** Desenho aprovado em brainstorming; aguardando revisão desta spec
**Escopo:** dados dos amigos na plataforma, regra do baralho (sala e solo), catálogo de traits, ano opcional. Não mexe em `src/sim/`.

## 1. Contexto

O dono do produto preencheu a aba `Planilha3` do `macacos.xlsx` com 71 cartas de 32 amigos (pessoa × rota × ano), cada uma com as 3 fases (`lanePhase`, `midGame`, `lateGame`), até 2 traits e 8 campeões com nota 1 a 5. A ideia é que isso vire o pack para jogar com os amigos. É uma carga inicial: depois os dados são editados direto na base (JSON) ou pelo app.

O importador inteligente (`src/data/packImport.ts`) já existe e já absorve quase tudo: acha a aba certa, normaliza rota e resolve nomes de campeão por chave canônica mais aproximação (`rek'sai` = `reksai` = `rek sai`; `vladmir`, `talliyah`, `nafiri`, `jarvan`, `yummi`, `gankplank`, `blitcrank`, `wukong` etc.). Rodado contra a planilha: 71 de 71 cartas válidas, 0 erros. O que falta são as decisões abaixo.

Um segundo builder trabalha no motor de simulação em outro computador. Este trabalho não toca `src/sim/`: os mapas de trait do motor (`TRAIT_SLICE_BONUS` em `power.ts`, `TRAIT_METRIC_BONUS` em `microMetrics.ts`) são `Partial`, e os `switch` de `traits.ts` têm `default`, então traits novas entram sem efeito e sem conflito de merge.

## 2. Decisões

| # | Decisão | Razão |
|---|---------|-------|
| A-01 | **Carta única no torneio; pessoa única só dentro do time.** Uma carta levada sai do baralho de todos. A mesma pessoa pode estar em times diferentes, desde que em cartas (versões) diferentes. Vale na sala e no solo. | Decisão do dono do produto. Substitui o D-13 da spec do servidor ("a pessoa levada some para todos"), que exigia 40 pessoas distintas; o pack tem 32. No solo, hoje a mesma carta pode cair em dois bots; passa a valer a mesma regra. |
| A-02 | **Checagem de pior caso da base** substitui a contagem de pessoas por rota (D-14). Para cada rota `r`: `folga(r) = cartas(r) - bloqueáveis(r)`, onde `bloqueáveis(r)` é o máximo de cartas de `r` que 4 pessoas de um mesmo time, cada uma ocupando uma das outras 4 rotas, conseguem tirar do alcance desse time. A base só serve se `folga(r) >= 8` em toda rota. | Com A-01, um time trava quando todas as cartas restantes de uma rota são de pessoas que ele já tem. Os outros 7 times levam no máximo 7 cartas de `r`; sobrando 8 fora do alcance do próprio time, nenhuma sequência de escolhas trava. Simulação de 360 mil drafts deu 0 travamentos mesmo com ADC em 7, mas o dono do produto quer garantia, não probabilidade. |
| A-03 | Sem fallback no meio do draft. | Com A-02 bloqueando bases inseguras, o caso não acontece. |
| A-04 | **6 traits novas** com os ids da planilha, sem efeito na simulação por enquanto: `teamfights`, `flips`, `dragon_lover`, `roamer`, `side`, `quits`. | O efeito será definido e implementado depois, no motor. |
| A-05 | **Até 4 traits por carta** (era 2). Traits de campeão continuam com no máximo 2. | Pedido do dono do produto. |
| A-06 | **`year` opcional.** Carta sem ano não mostra ano. A importação deixa vazio em vez de assumir 2024. | Pedido do dono do produto: "nos anos vazios, deixe vazio". |
| A-07 | **Força da rota (`roleStrength` da rota principal) = média arredondada das 3 fases.** | A coluna `Overall` da planilha é min-max relativo à própria planilha (o pior vira 0) e muda a cada jogador novo. A média segue o padrão dos pros (Faker 95/97/94 tem 96). |
| A-08 | **Nome da carta = pessoa + rota**, e o ano só entra quando a pessoa tem 2 ou mais cartas na mesma rota. | Com A-01, dois times podem ter a mesma pessoa na mesma partida: só "Rafa" deixaria placar e feed ambíguos. Com a regra, os 71 nomes saem únicos. |
| A-09 | **O pack mora em `public/packs/amigos.json`** (formato `players.json`). No solo aparece como pacote embutido "Amigos", lido desse arquivo. Na sala, aparece na lista de bases do lobby ("Usar esta base"), junto com a base padrão e os pacotes do navegador do host. | O JSON é a fonte da verdade depois da carga; editar o arquivo reflete no solo ao recarregar e na sala ao republicar. |

## 3. Regra do baralho (A-01, A-02)

### 3.1 Função compartilhada

`src/draft/deckSafety.ts` (pura, sem I/O), reexportada por `server/engine/schema.ts` para respeitar a regra de que nada do servidor fora de `server/engine/` importa de `src/`.

```ts
deckSafety(players: PlayerVersion[], teams = 8): {
  ready: boolean;
  needed: number;                          // = teams
  spareByRole: Record<Role, number>;       // folga por rota
}
deckShortfalls(s): string[]                // uma frase por rota curta
```

`bloqueáveis(r)` é calculado de forma exata: para cada outra rota, os candidatos são as pessoas com carta naquela rota e com carta em `r`; percorre as combinações com pessoas distintas e fica com a maior soma de cartas de `r`. São no máximo algumas dezenas de pessoas por rota, então a força bruta é instantânea.

Mensagem quando falta: `adc (falta 1 carta de quem só joga adc)`, no plural quando faltar mais de uma. Uma carta de pessoa que só joga aquela rota sempre aumenta a folga em 1; outra versão de quem já joga a rota pode não aumentar.

Valores de referência (testes): base dos pros dá folga 8 em toda rota; `macacos.xlsx` antes do Valdir ADC dava ADC com folga 7; com ele, top 8, jungle 9, mid 13, adc 8, sup 9.

### 3.2 Sala

- `server/room/draft.ts`: sai `takenPersonIds`. O baralho exclui as cartas já escolhidas por qualquer assento (derivadas de `seats[].picks`); a mão do assento exclui as pessoas que ele já tem. A unicidade de pessoa dentro de uma mesma mão continua. `remainingCards` conta cartas não escolhidas.
- `server/room/persistence.ts`: `SNAPSHOT_VERSION` 4 → 5. Snapshot antigo é descartado (a sala recomeça), como nas trocas anteriores.
- `server/room/baseCheck.ts` passa a usar `deckSafety`. `BaseStatus` no protocolo troca `personsByRole` por `spareByRole` (mesmo formato, outro significado), e o `PROTOCOL_VERSION` vai de 4 para 5. O `startDraft` recusa com a mensagem de 3.1. No lobby, `src/room/bases.ts` (`coberturaDaBase`, que repetia a conta de pessoas no navegador) passa a usar `deckSafety`, tanto para a base da sala quanto para cada base da lista.
- Testes que fixavam o D-13 ("ninguém recebe uma pessoa já levada por outro", "nenhuma pessoa aparece em dois times") passam a fixar A-01: nenhuma carta em dois times; nenhuma pessoa repetida no mesmo time; outra versão da mesma pessoa continua disponível para outro time.
- A spec `2026-08-24-multiplayer-server-design.md` ganha uma nota nas linhas D-13 e D-14 apontando para esta.

### 3.3 Solo

- `BotTeamBuilder.buildRoster` ganha `excludedCardIds`. `buildBotRosters` recebe o roster do usuário e acumula as cartas levadas: cada bot pula as cartas do usuário e dos bots anteriores. Pessoa repetida dentro do time continua proibida.
- `packRoleCoverage` dá lugar a `deckSafety` no `App.tsx` (bloqueio do início do torneio) e no `PackManager` (selo "Pronto para torneio").

## 4. Traits (A-04, A-05)

- `PlayerTraitSchema` ganha os 6 ids; `traits` passa a `.max(4)`.
- `TRAIT_INFO` (`src/data/traitInfo.ts`):

| id | rótulo | descrição |
|----|--------|-----------|
| `teamfights` | Bom de teamfight | Rende mais nas lutas em grupo |
| `flips` | Flipa a lane | Tudo ou nada na fase de rotas: mais abates e mais mortes |
| `dragon_lover` | Ama dragão | Prioriza os dragões |
| `roamer` | Roamer | Sai da rota para ajudar o resto do mapa |
| `side` | Joga side | Pressiona a side lane e derruba mais torres no meio do jogo |
| `quits` | Quita | Pode abandonar a partida quando está muito atrás |

- `PlayerEditor`: `MAX_TRAITS` 4.
- Importador: lê `trait1` a `trait4`; corta em 4.
- Planilha modelo (`packSheet.ts`): colunas `trait3` e `trait4` com o mesmo menu. A lista de rótulos do menu precisa caber nos 255 caracteres do Excel (estimativa: ~190).
- `docs/DATA-DICTIONARY.md`: catálogo com 15 traits, limite 4, indicando quais ainda não têm efeito.

## 5. Ano opcional (A-06)

- `year` vira opcional no schema (continua 2011 a 2035 quando presente).
- `playerHints().year` fica opcional; `DraftScreen` e `RoomDraftScreen` omitem o ano (e o separador " · ") quando ausente; o `PlayerEditor` mostra só o id.
- Importador: ano vazio fica vazio. Planilha modelo e instruções atualizadas.
- O formulário de jogador novo do editor continua sugerindo o ano atual.

## 6. Carga dos dados (A-07, A-08, A-09)

`scripts/importar-amigos.ts` (rodado com `npx tsx`, também como `npm run pack:amigos`):

1. Lê a aba `Planilha3` do `macacos.xlsx` com ExcelJS.
2. Aplica as correções na linha crua, antes do importador:
   - `louis_sup_2017` da linha com ano 2026 → `louis_sup_2026`;
   - `rafa_top_2019` → `rafa_top_2018` (o ano 2018 é o certo);
   - Junão Sup: o segundo `braum` vira `nautilus`, nota 1.
3. Roda `buildPlayersFromRows` (correção de campeões, rotas e traits já é dele).
4. Pós-processa cada carta: `roleStrength` da rota principal = média das 3 fases (A-07); `displayName` pela regra A-08, com o nome da pessoa vindo de uma tabela `personId → nome` no script (ex.: `leite` → Igor, `raidenchups` → Igão, `gului` → Iago Lui, `oadamo` → Adamo, `titcher` → Titcher, `luan50` → Luan) e o rótulo da rota em Top, Jungle, Mid, Adc, Sup.
5. Falha alto se: alguma linha der erro ou aviso não previsto, algum nome sair repetido, ou `deckSafety` não der `ready`.
6. Valida com `PlayerDatabaseSchema` e grava `public/packs/amigos.json`; imprime o relatório.

Melhoria genérica no importador: quando a coluna de força geral está vazia, usar a média das fases em vez de 70.

Ids saem em kebab-case pelo `slug` do importador (`rafa_top` → `rafa-top`), seguindo a convenção do repositório.

### Pacote embutido (solo e lobby da sala)

`src/storage/packs.ts` passa a ter dois pacotes embutidos, "Pros / Mundial" (`/players.json`) e "Amigos" (`/packs/amigos.json`), com o mesmo tratamento virtual que o pros já tem. O loader ganha a leitura do segundo arquivo; se ele faltar ou for inválido, o pacote não aparece e o resto do app segue normal. O `App.tsx` também põe o pacote na frente da lista de bases que o lobby da sala oferece ao host.

## 7. Fora do escopo

- Efeito das 6 traits novas na simulação (vai para o motor, com o outro builder).
- Editar o pack dos amigos pelo editor do app: hoje o `PlayerEditor` só lista os pros e os jogadores adicionados.
- Coluna `volatilidade` (vazia; ignorada).
- Mudar o número de times da sala (segue 8).

## 8. Testes

- `deckSafety`: pros pronto; cenário do ADC com folga 7 recusado com a mensagem certa; carta de pessoa de uma rota só resolve; outra versão de quem já joga a rota não resolve.
- Draft da sala: carta escolhida some para todos; outra versão da mesma pessoa aparece para outro assento; a pessoa não volta para o mesmo assento; draft completo com a base dos amigos fecha os 8 times sem vaga vazia (várias sementes).
- Solo: `buildBotRosters` com roster do usuário: nenhuma carta em dois dos 8 times, nenhuma pessoa repetida dentro de um time.
- Schema: as 15 traits aceitas; carta com 4 traits válida e com 5 recusada; carta sem ano válida.
- Importador: `trait3`/`trait4`, ano vazio, força vazia vira média.
- Contrato: `public/packs/amigos.json` valida no schema e dá `deckSafety().ready`.
- Antes de concluir: `npm test`, `npm run typecheck:server` e `npm run build`.
