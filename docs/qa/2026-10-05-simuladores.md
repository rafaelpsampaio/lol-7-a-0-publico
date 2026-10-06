# Draft, objetivos e transmissão

## Interface

- A base selecionada aparece em destaque no lobby, com nome e estado de prontidão. A opção correspondente tem borda dourada, indicação de seleção e `aria-pressed`. A confirmação vem do estado publicado pelo servidor.
- Os elencos usam colunas próprias para rota, nome e ano. Atributos revelados ocupam uma linha separada. Em telas largas, os oito times formam duas fileiras de quatro cards.
- A transmissão abre em Destaques: objetivos, estruturas, primeiro sangue e momentos decisivos. Todos os eventos preserva o histórico completo. Ambos mostram apenas eventos já alcançados pelo relógio.
- Pausar congela a reprodução. Retomar não acumula o tempo passado em pausa. Pular para o fim continua funcionando enquanto a partida está pausada.
- Em desktop, a narração ocupa uma coluna ao lado do mapa e dos times. Em celular, mapa e narração vêm antes dos painéis individuais.
- O resumo da série ocupa uma área central mais larga. Placar e ações vêm primeiro; escalações por jogo ficam em detalhes expansíveis.
- Separadores com hífens e travessões foram retirados dos textos da interface. Placares usam ×. Hífens de palavras, identificadores e operações do código foram preservados.

## Objetivos

O caminho de captura sem contestação considerava a intenção do adversário suficiente para dar acesso ao objetivo. Agora exige equipe viva e considera pressão nas duas rotas próximas e desvantagem relativa de ouro. Uma janela de superioridade numérica ainda permite capturas pelo time que está atrás. Disputas e roubos mantêm seus caminhos próprios.

Comparação determinística com 200 sementes (0 a 199), elencos planos de força 85 contra 55, alternando o lado do time forte, configuração padrão:

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Dragões do time mais fraco, somados | 249 | 13 |
| Partidas com alma do time mais fraco | 3 | 0 |
| Stomps (forte ≥20 abates, fraco ≤3) | 176 | 178 |
| Stomps com alma do time mais fraco | 2 | 0 |

As sementes 37 (32 a 3) e 138 (31 a 0) reproduziam a falha anterior e têm testes de regressão. Essa amostra não representa uma garantia sobre toda combinação de jogadores e sementes. A partida específica relatada pelo usuário não estava disponível com sua timeline no snapshot local.

## Verificação

Capturas com dados de teste: [draft](2026-10-05-draft.png), [transmissão](2026-10-05-playback.png), [resultado](2026-10-05-result.png).

- Chromium com componentes reais e dados de teste em 1440 × 900 e 390 × 900: lobby, draft, transmissão e resultado sem overflow horizontal; filtros e pausa funcionando.
- Testes de acesso ao objetivo cobrem os dois lados, equipe morta, pressão específica de cada lado do rio e oportunidades de superioridade numérica.
- Oito snapshots de simulação atualizados após a mudança intencional do motor.
- Os testes de integração do torneio foram alinhados à regra já existente: Ready libera resultados e o host inicia a próxima rodada.
- Suíte completa: 2.090 testes passaram; a única falha era a espera antiga pelo encerramento da final. Após corrigir o helper para aguardar o Ready final, os 10 testes de integração passaram na repetição isolada, validando os 2.091 testes no total.
- Build de produção, tipos do servidor e `git diff --check` aprovados.

O motor novo só afeta novas simulações. Partidas gravadas não foram reescritas. Reinicie o servidor para carregar o motor novo e recarregue os navegadores para receber a interface compilada.

## Atualização após o merge com o master (2026-10-05)

O gate de captura sem contestação descrito em "Objetivos" (`objectiveSetupSufficient`) não foi mantido. O master trouxe o preparo de objetivo do motor de calendário e volume (`readiness.ts`), que reescreveu esse trecho e já exige vantagem de rota, controle de mapa, jungler vivo e número de vivos para o objetivo sair. As sementes 37 e 138 passam no motor novo sem o gate e seguem como testes de regressão em `src/sim/objectiveAccess.test.ts`. A tabela acima foi medida contra o motor anterior e não vale para o motor atual.
