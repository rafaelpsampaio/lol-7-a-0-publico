# Conteudo publico do projeto

O pacote Amigos (`public/packs/amigos.json`) e as fotos (`public/players/` e `docs/fotos/`) fazem parte do projeto e da distribuicao do app, conforme autorizado pelo dono e pelos amigos.

A planilha original `macacos.xlsx`, os registros de planejamento (`.planning/`, `docs/superpowers/plans/`) e as notas de retomada sao materiais locais ignorados pelo Git. O app usa o JSON pronto e funciona sem esses arquivos. Para refazer a importacao com uma planilha sua, use `npm run pack:amigos -- caminho/da/planilha.xlsx`.

Os manuais, especificacoes, baselines e referencias tecnicas permanecem disponiveis. Caminhos pessoais, links de sessoes e chaves de API foram omitidos do conteudo preparado para publicacao. Os tokens de sala sao gerados ao executar o app e ficam na pasta de dados, fora do Git e do pacote distribuido.

## Historico privado e copia publica

Remover um arquivo do versionamento atual nao elimina suas versoes antigas. O repositorio de desenvolvimento conserva o historico privado e as outras copias de trabalho. Este repositorio publico comeca com uma copia revisada do projeto, identidade noreply e sem os commits antigos. Ela inclui a instalacao e as atualizacoes do app.

O destino publico e `rafaelpsampaio/lol-7-a-0-publico`. O repositorio antigo continua privado. Para publicar proximas versoes, use este repositorio publico e siga o guia de instalacao. Se criar um fork para distribuir seu proprio app, ajuste `Repository` em `distribution/common.ps1` para que o app encontre suas releases.

O ZIP do app em `release/LoL-7-a-0-windows-x64.zip` ja inclui o pacote Amigos com fotos e nao inclui a planilha, o historico Git ou os registros internos. As instrucoes para gerar e publicar novas versoes estao em [INSTALACAO.md](INSTALACAO.md).
