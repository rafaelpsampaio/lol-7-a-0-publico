# Recalculo dos Pros (spec do editor de pacotes, secao 9)

Data: 2026-10-05. Migracao feita por `scripts/normalizar-pacotes.ts`: toda carta passa a ter uma rota so e forca = nota geral (media das 3 fases, arredondada); os dois arquivos ganham `name` ("Pros / Mundial" e "Amigos").

## Cartas que mudaram de forca

`public/players.json`: 35 de 40 cartas. `public/packs/amigos.json`: 0 de 71 (so ganhou `name`; em 8 cartas com `year` e `photo` a ordem das chaves passou a seguir a do schema).

```
public/players.json: 35 de 40 cartas mudaram de forca.
  faker-2016: 96 -> 95
  caps-2019: 91 -> 89
  showmaker-2020: 93 -> 92
  knight-2021: 89 -> 88
  uzi-2018: 98 -> 95
  ruler-2022: 93 -> 88
  rekkles-2020: 91 -> 89
  gumayusi-2022: 90 -> 87
  player-friend-2023: 78 -> 63
  zeus-2022: 92 -> 87
  flandre-2021: 87 -> 80
  bin-2021: 88 -> 83
  bengi-2015: 88 -> 80
  canyon-2021: 95 -> 87
  inspired-2021: 86 -> 81
  oner-2022: 89 -> 84
  wolf-2016: 85 -> 80
  beryl-2021: 90 -> 85
  keria-2021: 93 -> 88
  mikyx-2019: 88 -> 82
  theshy-2018: 94 -> 90
  nuguri-2020: 92 -> 90
  khan-2017: 90 -> 87
  peanut-2017: 90 -> 88
  jankos-2018: 89 -> 87
  tian-2019: 91 -> 90
  blaber-2021: 86 -> 85
  chovy-2023: 95 -> 94
  rookie-2018: 93 -> 92
  perkz-2019: 89 -> 88
  jackeylove-2018: 90 -> 89
  viper-2023: 93 -> 92
  mata-2014: 92 -> 90
  madlife-2012: 88 -> 86
  crisp-2020: 89 -> 88
public/packs/amigos.json: 0 de 71 cartas mudaram de forca.
```

A maior queda e `player-friend-2023` (78 para 63). As outras ficam entre 1 e 15 pontos abaixo.

## Calibracao antes e depois

Medida com `npm run calibrate:all`, `npm run calibrate:realism` e `npx vitest run src/__tests__/golden`, antes e depois da migracao (saidas em `tmp/`, fora do git).

| Gate | Antes | Depois |
| --- | --- | --- |
| calibrate | verde | verde |
| calibrate:micro | verde | verde |
| calibrate:structures | verde | verde |
| calibrate:objectives | verde | verde |
| calibrate:combat | verde | verde |
| calibrate:pace | vermelho (ja era, de proposito) | vermelho (mesmas 19 linhas FALHA, mesmos valores) |
| calibrate:assists | verde | verde |
| calibrate:realism | 5 de 5 testes ok | 5 de 5 testes ok |
| golden | 25 de 25 ok | 25 de 25 ok |

calibrate:all: 6 de 7 gates verdes antes e depois. As linhas `[FALHA]` do relatorio de calibrate:pace sao identicas antes e depois.

Nenhum gate passou de ok para vermelho.

Leitura: `calibrate:realism` e `calibrate:structures` leem `public/players.json` e continuam verdes com as forcas novas. Os gates de ritmo (`calibrate:pace`) e o golden usam fixtures proprias, por isso seus numeros nao se mexem.
