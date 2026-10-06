# Revisão do draft e dos cards

## Comportamento

- O lobby e o draft identificam a base ativa, a quantidade de cartas e de pessoas e exemplos. Bases padrão e Amigos antigas são identificadas ao abrir o servidor; novas publicações guardam o nome escolhido.
- Todos acompanham as cartas oferecidas ao jogador da vez. Só ele pode escolher.
- Nome, rota e ano aparecem separados. O componente compartilhado aceita foto e usa iniciais quando ela falta ou falha.
- Tags vêm dos campos cadastrados: traits, tags e advanced.tags. Descrições ficam em tooltip por hover ou foco. Não há estilos ou descrições de rota inferidos nos cards.
- Cinco modos de atributos, padrão Nunca ver. Nos modos depois do draft, a carta revela atributos depois de ser escolhida. Overall é a média arredondada de início, meio e fim.
- Caos e atributos são escolhidos no lobby e ficam fixos quando começa o draft. O servidor usa o caos salvo para iniciar o torneio.
- O contador reinicia pela identidade do turno, mesmo quando dois turnos consecutivos recebem o mesmo tempo restante.
- A seleção de campeões reage ao catálogo carregado depois da montagem inicial.
- Foram removidos os atalhos de revelar resultados/pódio antes de assistir. Avançar jogo fica indisponível até acabar a reprodução atual.
- A moldura da sala mostra o estado de pronto de cada participante esperado, inclusive enquanto se assiste a outra série.
- Textos apresentados ao usuário não contêm travessões.

## Séries

O snapshot local foi lido sem alterações. As quatro quartas de final eram 3 a 0; a rodada seguinte tinha três 3 a 1 e um 3 a 2. Os jogos tinham sementes distintas.

Repetição dos quatro confrontos originais com 50 sementes por confronto, caos 0,25:

| Confronto | Ratings aproximados | 3 a 0 antes | 3 a 0 depois |
| --- | --- | --- | --- |
| Quartas 1 | 53 / 65 | 44/50 | 18/50 |
| Quartas 2 | 63 / 61 | 32/50 | 17/50 |
| Quartas 3 | 73 / 56 | 50/50 | 34/50 |
| Quartas 4 | 62 / 65 | 15/50 | 17/50 |
| Total | | 141/200 | 86/200 |

Novas partidas usam forma de equipe e individual sorteada pela semente da partida. O caos amplia sua variação; as cartas originais não são alteradas e o motor continua decidindo o vencedor pelos eventos. O campo formVersion é salvo por jogo para reproduzir a mesma regra. A variação é uma escolha de equilíbrio do jogo, não um modelo validado de desempenho esportivo real. A amostra não garante uma distribuição fixa de placares.

Para repetir a auditoria, com o snapshot local disponível:

~~~powershell
node --import tsx scripts/audit-series-variation.ts server/data/room.json --legacy
node --import tsx scripts/audit-series-variation.ts server/data/room.json
~~~

## Verificação

- 123 arquivos de teste, 2.072 testes aprovados.
- Build de produção e verificação de tipos do servidor aprovados.
- Navegador Chromium: contador 0 → novo turno → 60; catálogo inicialmente vazio → Aatrox após carregamento; tooltip visível no hover; alternância de atributos; ausência de overflow horizontal em 390px.
- Cards verificados em 1280px e 390px: sem foto, foto disponível, foto indisponível e nome longo.
- [Desktop](cards-desktop.png) e [celular](cards-mobile.png).
- Foto ilustrativa de teste: [Unsplash](https://images.unsplash.com/photo-1500648767791-00dcc994a43e). Não foi adicionada à base de jogadores.

O protocolo de sala passou para versão 6. Reinicie o servidor e recarregue os navegadores para usar a mesma versão. Séries já salvas não são recalculadas. Replays antigos continuam sujeitos à verificação de compatibilidade da gravação quando textos ou motor mudam.
