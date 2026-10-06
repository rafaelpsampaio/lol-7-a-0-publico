# Design — Unificar o cálculo de `isUser` (fecha a Fase 7, item 3, do plano da sala)

**Origem:** `docs/PLANO-EXPERIENCIA-SALA.md`, Fase 7, item 3 — deixado deliberadamente adiado ("não reduzido de escopo") por depender de decisão do dono do produto sobre até onde ir. Pedido explícito: "quero cruzar o limite e unificar de verdade."

## Contexto

`TournamentTeam.isUser` (`src/tournament/schema.ts`) e `StoredGame.userFrameTeamId` (mesmo arquivo) foram originalmente descritos no plano como "os dois mecanismos que hoje respondem 'quem é o usuário'". Uma investigação dedicada (ver histórico da sessão) confirmou que eles **não computam o mesmo fato**:

- `isUser` responde "quem está assistindo agora" — no solo, uma constante por torneio (`state.userTeamId`, sempre `"user"`); na sala, uma projeção por espectador, recalculada a cada render, porque até 8 pessoas podem assistir times diferentes ao mesmo tempo (D-22: nenhum time da sala é "o" usuário).
- `userFrameTeamId` responde "qual lado deste jogo específico, já simulado, é o azul" — decidido uma única vez em `src/tournament/series.ts:93-94`, no instante em que `runMatchEngine` roda, porque a partir daí a timeline (`GameEvent[]`) só fala `"user"`/`"rival"` — a identidade do time do bracket se perde depois disso. Não tem como recalcular sem re-simular (viola D-08) ou sem redesenhar `GameEventSchema` em `src/sim/**` para carregar IDs de time reais.

Uma unificação de verdade (um único campo/mecanismo para os dois) exigiria cruzar a fronteira de `src/sim/**` que este trabalho manteve fora de escopo desde a Fase 1 — envolve mudar o schema de eventos do motor, o motor em si, o playback, e provavelmente regenerar os snapshots dourados (`golden.test.ts.snap`, `structures.test.ts.snap`). Apresentado ao usuário como opção "profunda"; a opção escolhida foi a "rasa": unificar só o lado que dá pra unificar sem tocar no motor.

## Decisão

Unificar apenas o cálculo de `isUser`. `userFrameTeamId` permanece exatamente como está — não é mais tratado como "a outra metade de um par a unificar", e sim reconhecido como um conceito genuinamente separado (documentado como tal no código, para que ninguém tente unificar de novo sem reler esta análise).

## Problema concreto

`isUser` é computado de forma independente em 4 lugares, cada um respondendo a mesma pergunta ("este time é o do usuário?") com sua própria lógica:

1. `src/App.tsx:256` — solo, cria o time do jogador com `isUser: true` hardcoded.
2. `src/tournament/bracket.ts:452` — solo, cria cada time bot com `isUser: false` hardcoded.
3. `server/room/tournament.ts:133` — sala, cria os 8 times com `isUser: false` hardcoded pra todos (comentário cita D-22).
4. `src/room/SeriesWatch.tsx:342` — sala (cliente), computa via `wire.id === meuId` ad hoc, onde `meuId` vem de `meuTimeId()`.

Nenhum bug conhecido resulta disso hoje, mas a duplicação é o tipo de coisa que convida a um bug futuro (ex.: alguém "conserta" o hardcoded `false` da sala sem entender por que ele é `false` de propósito).

## Solução

Uma função pura nova em `src/tournament/schema.ts` (já importado, direta ou via tipos, pelos 4 pontos acima — nenhuma aresta nova no grafo de imports, `server/quarentena.test.ts` não é afetado):

```ts
/** Um time é "do usuário" só quando bate com um id de referência conhecido.
 *  O solo passa state.userTeamId (sempre "user"); a sala passa null no servidor
 *  (D-22: nenhum time da sala é inerentemente do usuário) ou o id do time de
 *  quem está assistindo agora, no cliente. Nunca inferir isso de
 *  userFrameTeamId — aquilo é uma decisão de enquadramento presa a um jogo já
 *  simulado, não "quem está assistindo agora" (ver docs/superpowers/specs/
 *  2026-08-26-isuser-unification-design.md para o porquê de não unificar). */
export function isUserTeam(teamId: string, userTeamId: string | null): boolean {
  return userTeamId !== null && teamId === userTeamId;
}
```

Os 4 pontos passam a chamar `isUserTeam(...)` em vez de hardcodar/duplicar a comparação:

1. `src/App.tsx:256` → `isUserTeam(team.id, state.userTeamId)` (equivale a `true`, já que o time do jogador sempre recebe `id: "user"` e `state.userTeamId === "user"`).
2. `src/tournament/bracket.ts:452` → `isUserTeam(id, state.userTeamId)` (equivale a `false` pra todo bot).
3. `server/room/tournament.ts:133` → `isUserTeam(id, null)` (sempre `false` — mas agora com a razão centralizada na doc do helper, não só num comentário local).
4. `src/room/SeriesWatch.tsx:342` → `isUserTeam(wire.id, meuTimeId())` (idêntico a `wire.id === meuId`).

**Substituição pura — nenhuma mudança de comportamento.** Nenhum schema muda (`TournamentTeamSchema.isUser` continua `z.boolean()` obrigatório, serializado normalmente).

## Testes

- Arquivo novo `src/tournament/schema.test.ts` (ou adição a um existente, se já houver testes de schema puro): 3-4 casos pra `isUserTeam` — match, no-match, referência `null`.
- Nenhum teste existente deveria precisar mudar — isso é o próprio critério de aceite de que a refatoração preserva comportamento. Rodar a suíte completa depois confirma.

## Fora desta mudança

`TournamentTeamSchema`, `TournamentWireSchema`, `StoredGameSchema`, `userFrameTeamId`, `src/sim/**`, o motor, replay, snapshots dourados.
