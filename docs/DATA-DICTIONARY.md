# Data Dictionary - Player Card Fields

This document describes every field of a player card in `public/players.json`.
Use the **faker-2016** entry as a copy-paste starting point (see the "Add a new
player in under 5 minutes" walkthrough at the bottom).

All field ranges and constraints are derived directly from `src/data/schema.ts`
and are enforced at runtime by the Zod validator on app startup.

---

## Top-Level Fields

### `$schema` (optional)

| Property | Value |
|----------|-------|
| Type | `string` |
| Required | No |
| Example | `"../.vscode/players.schema.json"` |

Points VS Code to the JSON Schema file for autocomplete and inline validation.
Leave it as-is - the app ignores it at runtime.

---

### `name` (opcional)

| Property | Value |
|----------|-------|
| Type | `string` (1 a 60 letras) |
| Required | No |
| Example | `"Amigos"` |

Nome do pacote, mostrado no menu e na lista de pacotes. Sem `name`, o nome do
pacote e o do arquivo (`public/packs/<id>.json` vira `<id>`; os Pros usam
"Pros / Mundial"). O editor de pacotes grava sempre `$schema`, `name` e `players`
nessa ordem.

---

## Player Card Fields

Each entry in the `players` array is one player card. All fields below are
required unless marked optional.

---

### `id`

| Property | Value |
|----------|-------|
| Type | `string` (non-empty) |
| Format | `"<name>-<year>"` by convention |
| Example | `"faker-2016"` |

Unique identifier for this card. The loader uses it in error messages
(e.g., `Card "faker-2016", field "lateGame": ...`). Must be unique across all
cards in the file.

---

### `personId`

| Property | Value |
|----------|-------|
| Type | `string` (non-empty) |
| Format | Player's handle, lowercase, no spaces |
| Example | `"faker"` |

Person-level identifier used by the draft engine to enforce the "no duplicate
person per team" rule. Multiple cards for the same player (e.g., `faker-2016`
and `faker-2013`) share the same `personId`. Once your team picks
`faker-2016`, no other Faker version will appear in the draft for you.

---

### `displayName`

| Property | Value |
|----------|-------|
| Type | `string` (non-empty) |
| Example | `"Faker 2016"` |

Human-readable name shown in the UI during draft and match display. Can include
spaces and uppercase letters. You can also include a friend's name or your own:
`"Rafael (Top 2024)"`.

---

### `year`

| Property | Value |
|----------|-------|
| Type | `integer` |
| Required | Não |
| Range | 2011–2035 |
| Example | `2016` |

Ano da carta. Opcional: carta sem ano não mostra ano nas telas. Quando presente, de 2011 a 2035. Só exibição por enquanto.

---

### `roles`

| Property | Value |
|----------|-------|
| Type | `array of role strings` |
| Allowed values | `"top"`, `"jungle"`, `"mid"`, `"adc"`, `"support"` |
| Constraints | Exactly 1 (E-06); the schema still accepts up to 5 |
| Example | `["top"]` |

The role this card plays. Since the pack editor (rule E-06) a card has exactly
one role: `roles` holds only `primaryRole`, e.g. `["top"]`. The same person in
another role is a different card (another `id`, same `personId`). Older files
with several roles still load, but the editor flags them as errors until fixed.

---

### `primaryRole`

| Property | Value |
|----------|-------|
| Type | `role string` |
| Allowed values | `"top"`, `"jungle"`, `"mid"`, `"adc"`, `"support"` |
| Constraint | Must be one of the values in `roles` |
| Example | `"top"` |

The role the draft engine uses when slotting this player into a team. This
field is explicit (not `roles[0]`) so the sim is immune to accidental array
reordering. With one role per card (E-06), `roles` is always `[primaryRole]`.

---

### `roleStrength`

| Property | Value |
|----------|-------|
| Type | `object with five keys` |
| Keys | `top`, `jungle`, `mid`, `adc`, `support` (all required) |
| Value range | Integer 0–100 per key |
| Convention | The primary role carries the overall; the other four carry `0` (E-07) |
| Example | `{ "top": 78, "jungle": 0, "mid": 0, "adc": 0, "support": 0 }` |

Per-role strength rating used by the simulation engine when this player fills
a role in a game. Since the pack editor (rule E-07) it is not free: the value
of the primary role is the card's overall,
`round((lanePhase + midGame + lateGame) / 3)`, and the other four roles are `0`.
The editor computes it from the three phases and the pack check refuses a card
where it differs ("A força na rota precisa ser a nota geral"). Example: phases
80, 75 and 79 give `78`.

All five keys are required to avoid missing-key errors in the engine.

---

### `lanePhase`

| Property | Value |
|----------|-------|
| Type | `integer` |
| Range | 1–100 |
| Example | `95` |

Overall rating for the early game / laning phase (roughly 0–14 minutes).
Weighted heavily for the support role's contribution to lane outcomes. A `95`
means near-peak laning ability.

---

### `midGame`

| Property | Value |
|----------|-------|
| Type | `integer` |
| Range | 1–100 |
| Example | `97` |

Overall rating for the mid-game phase (roughly 14–25 minutes), covering
teamfights, rotations, and objective contests. Weighted for jungle and mid
roles.

---

### `lateGame`

| Property | Value |
|----------|-------|
| Type | `integer` |
| Range | 1–100 |
| Example | `94` |

Overall rating for the late game phase (25+ minutes), covering baron, elder
dragon, inhibitor pushes, and final teamfights. Weighted for ADC and mid roles.

---

### `photo` (opcional)

| Property | Value |
|----------|-------|
| Type | `string` (nao vazio) |
| Required | Nao |
| Range | Caminho `/players/<personId>.jpg` (JPEG 512x512, ate 1 MB) |
| Example | `"/players/rafa.jpg"` |

Foto do jogador. E uma propriedade da PESSOA (nao da versao do card): o editor de pacotes grava o arquivo `public/players/<personId>.jpg` e aplica o mesmo caminho a todos os cards que compartilham esse `personId`, inclusive em outros pacotes. Arquivos antigos com `data:...` ainda carregam, mas o editor nao os gera mais. Totalmente opcional - cards sem `photo` sao validos e o app funciona normalmente. Nao tem impacto na simulacao.

---

### `tags` (opcional, campo de pre-pick)

| Property | Value |
|----------|-------|
| Type | `array de strings` (cada item nao vazio) |
| Required | Nao |
| Constraint | Ate 6 etiquetas de exibicao |
| Example | `["teamfight", "hard carry"]` |

Etiquetas de exibicao mostradas ANTES do pick na tela de draft. Servem como dicas visuais rapidas sobre o estilo do jogador. Nao tem impacto na simulacao.

**Atencao:** este campo (`tags` de topo, max 6) e diferente de `advanced.tags` (max 10, etiquetas livres de anotacao). Os dois coexistem com propositos distintos: `tags` de topo e para a UI de draft pre-pick; `advanced.tags` e para anotacoes internas do usuario.

---

### `style` (opcional)

| Property | Value |
|----------|-------|
| Type | `string` (nao vazio) |
| Required | Nao |
| Range | Maximo 40 caracteres |
| Example | `"Carry de teamfight"` |

Rotulo curto de estilo de jogo exibido ANTES do pick. Funciona como uma "classe" ou arquetipo do jogador naquela versao. Nao tem impacto na simulacao.

---

### `shortDescription` (opcional)

| Property | Value |
|----------|-------|
| Type | `string` (nao vazio) |
| Required | Nao |
| Range | Maximo 160 caracteres |
| Example | `"O melhor mid da historia. Precisao cirurgica em qualquer meta."` |

Blurb de uma linha em pt-BR exibido ANTES do pick. Nunca deve revelar numeros brutos de atributos - serve para dar contexto narrativo ao jogador sem entregar vantagem de informacao durante o draft.

---

### `traits`

| Property | Value |
|----------|-------|
| Type | `array of trait strings` |
| Constraint | Maximum 4 per card; 0 is valid |
| Example | `["clutch_player", "mental_fort"]` |

Special attributes that alter the simulation formula for this player. Pick up
to 4 from the catalogue below. Leaving the array empty (`[]`) is valid and
means "no special trait." Using more than 4 will fail schema validation.

#### Trait Catalogue (15 total)

> As descricoes abaixo sao conceituais (intencao de design). Para os efeitos
> numericos exatos no motor (bonus de slice, multiplicadores de luta, bonus de
> steal), ver ENGINE-MANUAL.md secao 5 (Catalogo de traits), que e a fonte
> mecanicamente autoritativa.

| Trait key | What it changes in the sim |
|-----------|---------------------------|
| `tilts_on_death` | Penalty to this player's combat contribution when behind AND already dead - models players who visibly deteriorate after feeding |
| `plays_worse_when_behind` | Reduces this player's combat power while their team is behind - models players who struggle under adverse conditions |
| `clutch_player` | Slice bonus to teamfight/pickoff plus a small combat bonus when far behind AND late - models players who elevate their game when it matters most |
| `objective_focused` | Slice bonus to objective/siege plus a steal-chance bonus on dragon/baron contests |
| `baron_stealer` | Slice bonus to objective plus a larger steal-chance bonus on baron/dragon contests |
| `strong_laner` | Slice bonus to laning/objective - pairs well with high `lanePhase` ratings |
| `mental_fort` | Slice bonus to teamfight/scaling plus a small combat bonus while behind - the opposite of `plays_worse_when_behind` |
| `lane_bully` | Slice bonus to laning/skirmish - the strongest early-lane trait |
| `trash_talker` | Cross-team trait: reduces the ENEMY team's fight power by 1.5% per living holder - models players who get in opponents' heads |
| `teamfights` | Stronger and more decisive in group fights: teamfight slice bonus and more kills, fewer deaths in 5v5 and pit fights |
| `flips` | All-in player: more kills and more deaths in every fight, plus extra lane all-ins from 1:30 to 14:00 that snowball both ways |
| `dragon_lover` | "Ama objetivos": insists on dragon, voidgrubs and herald (not Baron or Elder), preps faster when ahead, steals more and dies more trying |
| `roamer` | Leaves lane to gank until 14:00: guaranteed assist and half the kills on ganks in other lanes; own lane loses lead per roam |
| `side` | Mid game split pusher: more split pushes in their own lane and extra tower-taking force there; also keeps their lane's pressure up in mid game (a fixed +25 on that lane, added for the user and subtracted for the rival) |
| `quits` | Troll: when feeding (bad game and a bad streak), may leave the match; earns only passive gold while away and returns half of the time |

---

### `championPool`

| Property | Value |
|----------|-------|
| Type | `array of champion entries` |
| Minimum length | **8** (required for fearless Bo5 draft) |
| Example | `[{ "championId": "leblanc", "mastery": 5 }, ...]` |

The champions this player knows and will have auto-picked from during the
fearless Bo5. Needs at least 8 entries so that by game 5 (with 4 champions
already used) there are still valid picks available.

Each entry has two sub-fields:

#### `championId`

| Property | Value |
|----------|-------|
| Type | `string` (non-empty) |
| Convention | Lowercase, hyphens for spaces (e.g., `"kog-maw"`, `"twisted-fate"`) |
| Example | `"leblanc"` |

The champion identifier. Use lowercase with hyphens. This is used internally
to track which champions have been used in the fearless draft - it does not
need to match Riot's exact API key (yet), just be consistent within your file.

#### `mastery`

| Property | Value |
|----------|-------|
| Type | `integer` |
| Allowed values | `1`, `2`, `3`, `4`, `5` (literal; decimals rejected) |
| Example | `5` |

How well this player knows this champion, on a 1–5 scale:
- `5` - Signature champion; picked when possible, highest sim weight
- `4` - Strong comfort pick
- `3` - Reliable but not signature
- `2` - Situational; played but not optimal
- `1` - Low mastery; picked only when all better options are used in fearless

---

## Bloco `advanced` (opcional)

O bloco `advanced` e um sub-objeto OPCIONAL aninhado no card. Ele contem os 11 campos de persona que o motor pode usar para refinar o comportamento simulado do jogador, mais dois ganchos neutros (`notes` e `tags`) para anotacoes livres do usuario.

**Compatibilidade REG-01:** um card sem o campo `advanced` continua valido. O arquivo `players.json` atual (que nao tem este campo) parseia normalmente. Nenhum campo novo sera obrigatorio para nao quebrar cards existentes.

**Schema estrito:** o sub-schema usa modo estrito (`.strict()`), ou seja, qualquer chave fora da lista abaixo causa erro de parse. Nao adicione campos extras dentro de `advanced` sem atualizar o schema.

**Opcionalidade:** o bloco inteiro e opcional. Cada campo dentro dele tambem e opcional individualmente. E valido ter `advanced: {}` (bloco vazio) ou omitir o bloco completamente.

### Campos de persona (11 campos)

Todos os 11 campos abaixo seguem o mesmo padrao: `number`, escala `0.0` a `1.0`, opcinal. Valores intermediarios sao validos (ex: `0.35`). Nenhum deles tem efeito se o campo `advanced` for omitido.

| Campo | Escala | Descricao |
|-------|--------|-----------|
| `riskProfile` | 0 (cauteloso) a 1 (agressivo) | Apetite a risco geral do jogador |
| `resourceDemand` | 0 (autonomo) a 1 (exige recursos) | Quanto o jogador precisa de ouro, farm e atencao do time |
| `weaksideTolerance` | 0 (nao aguenta) a 1 (aguenta bem) | Tolerancia a jogar o lado fraco em desvantagem |
| `carryPotential` | 0 (baixo) a 1 (alto) | Potencial de carregar o jogo sozinho |
| `volatility` | 0 (consistente) a 1 (imprevisivel) | Variabilidade do resultado de jogo a jogo |
| `shotcalling` | 0 (passivo) a 1 (lider de calls) | Capacidade de liderar decisoes e calls do time |
| `roamTendency` | 0 (fica na lane) a 1 (roama muito) | Tendencia a roamar e abandonar a lane |
| `sideLaneDiscipline` | 0 (bagunca) a 1 (disciplinado) | Disciplina no side lane, joga o mapa corretamente |
| `killBias` | 0 (evita abates) a 1 (busca kills) | Vies para buscar e executar abates |
| `assistBias` | 0 (solo) a 1 (joga pro time) | Vies para assistencias e jogo cooperativo |
| `deathRisk` | 0 (raramente morre) a 1 (morre muito) | Frequencia de mortes esperada para este perfil |

#### Exemplo de sub-objeto completo

```json
"advanced": {
  "riskProfile": 0.7,
  "resourceDemand": 0.4,
  "weaksideTolerance": 0.3,
  "carryPotential": 0.5,
  "volatility": 0.5,
  "shotcalling": 0.3,
  "roamTendency": 0.2,
  "sideLaneDiscipline": 0.7,
  "killBias": 0.6,
  "assistBias": 0.4,
  "deathRisk": 0.5
}
```

---

### `advanced.notes` (opcional)

| Property | Value |
|----------|-------|
| Type | `string` |
| Required | Nao |
| Range | Maximo 500 caracteres |
| Example | `"Melhor desempenho em metas de teamfight. Evitar picks de split push."` |

Anotacao livre do usuario sobre a persona do jogador. Gancho neutro (D-14): nao tem impacto na simulacao, serve apenas para o usuario registrar observacoes contextuais sobre o perfil. O texto e armazenado e exibido no editor, sem processar nem influenciar os calculos do motor.

---

### `advanced.tags` (opcional)

| Property | Value |
|----------|-------|
| Type | `array de strings` |
| Required | Nao |
| Constraint | Ate 10 etiquetas; cada etiqueta entre 1 e 30 caracteres |
| Example | `["split pusher", "high elo", "clutch"]` |

Etiquetas livres para anotacao e filtragem interna. Gancho neutro (D-14): nao tem impacto na simulacao. Diferente do campo `tags` de topo do card (max 6 etiquetas de exibicao pre-pick), este campo e para uso do usuario como anotacao interna.

**Resumo da distincao:**
- `tags` (topo, max 6): exibido na UI de draft antes do pick, contexto de jogador publico
- `advanced.tags` (max 10): anotacao livre interna do usuario, sem exibicao automatica

---

## Presets de persona

O picker de personas (implementado na Fase 14) permite escolher um preset ao preencher o card. Ao selecionar um preset, os 11 campos do bloco `advanced` sao preenchidos automaticamente com um pacote de valores pre-aprovados. Cada preset representa um arquetipo de jogador reconhecivel na cultura LoL.

**Usar um preset e totalmente opcional.** O bloco `advanced` continua opcional com ou sem preset. O usuario pode:
1. Omitir o `advanced` completamente (card simples, valido)
2. Escolher um preset e aceitar os valores automaticos
3. Escolher um preset e depois ajustar campos individuais no bloco avancado colapsavel
4. Preencher o `advanced` manualmente, campo a campo, sem usar preset

Cada preset e um pacote completo dos 11 campos. O picker nao preenche `advanced.notes` nem `advanced.tags` - esses ficam a criterio do usuario.

### Catalogo de presets (12 personas)

Os slugs e labels abaixo sao extraidos diretamente de `src/data/presets.ts` (array `PRESET_KEYS` e campo `label` de cada entrada).

| Slug | Label | Descricao |
|------|-------|-----------|
| `perna` | Perna | Joga abaixo do esperado, erros basicos frequentes |
| `ok` | Ok | Competente sem se destacar, confiavel no basico |
| `bom-de-lane` | Bom de lane | Ganha a fase de laning mas some no teamfight |
| `farmador-passivo` | Farmador passivo | Nao toma risco, farma bem, nunca inicia nada |
| `agressivo-e-morre` | Agressivo e morre | Sempre inicia, resultado volatil, pode explodir ou dominar |
| `suporte-util-sem-dano` | Suporte util sem dano | Salva o carry, nao gera pressao de dano |
| `jungler-perdido` | Jungler perdido | Gosta de jungliar, nunca aparece nas lanes no momento certo |
| `carrega-se-forte` | Carrega se forte | Escala bem, precisa de recursos, decide o jogo no late |
| `tilta-quando-morre` | Tilta quando morre | Comeca bem mas desanda depois de morrer |
| `segura-weakside` | Segura weakside | Aguenta pressao no lado fraco, trabalha bem com desvantagem |
| `mecanico-sem-macro` | Mecanico sem macro | Mecanica apurada mas decisoes ruins de macro |
| `shotcaller-nato` | Shotcaller nato | Leva o time nas costas com calls certeiros, mesmo sem mecanica top |

O slug e a chave usada no `PRESETS` de `src/data/presets.ts`. O label e o texto exibido no picker de personas na UI.

---

## Adicionar um jogador em menos de 5 minutos

**Passo 1 - Copie o card faker-2016** de `public/players.json`. E o card mais simples com uma unica role.

**Passo 2 - Altere estes quatro campos:**

| Campo | O que preencher |
|-------|-----------------|
| `id` | `"seunome-AAAA"` (deve ser unico) |
| `personId` | `"seunome"` (sem espacos, minusculo) |
| `displayName` | `"Seu Nome AAAA"` |
| `year` | O ano que o card representa (2011-2035), ou omita o campo |

**Passo 3 - Configure os campos de role:**

- `roles`: so a rota do card (ex: `["mid"]`). Uma rota por carta (E-06): a mesma pessoa em outra rota e outra carta
- `primaryRole`: a mesma rota de `roles`
- `roleStrength`: a rota do card vale a nota geral, `round((lanePhase + midGame + lateGame) / 3)`, e as outras quatro valem `0` (E-07). Calcule depois do passo 4

**Passo 4 - Defina os overalls** (`lanePhase`, `midGame`, `lateGame`): de 1 a 100 cada.
Um amigo casual pode ser 50-65; um pro no auge pode ser 90-99.

**Passo 5 - Escolha até 4 traits** do catalogo acima (ou deixe `[]`).

**Passo 6 - Preencha o champion pool** com pelo menos 8 entradas. Copie o formato do array e altere os `championId` e os valores de `mastery` (1-5).

**Passo 7 (opcional) - Escolha uma persona:** se quiser adicionar profundidade ao perfil do jogador, abra o bloco `advanced` colapsavel no editor e escolha uma persona no picker (ex: `bom-de-lane`, `tilta-quando-morre`). O preset preenche automaticamente os 11 campos. Voce pode ajustar os valores depois.

Salve o arquivo e atualize o app. O loader valida em cada carregamento e indica exatamente qual campo tem problema caso algo esteja errado.
