# LoL 7 a 0 para Windows

## Para quem vai hospedar

1. Baixe `LoL-7-a-0-windows-x64.zip` na [ultima release](https://github.com/rafaelpsampaio/lol-7-a-0-publico/releases/latest).
2. Clique com o botao direito no ZIP e escolha **Extrair tudo**.
3. Abra `Instalar.bat` na pasta extraida. A instalacao e por usuario, sem administrador, Node, Git ou comandos.
4. Abra o atalho **LoL 7 a 0** na area de trabalho. O navegador abre a sala e a janela mostra o link para os amigos.

Os amigos so precisam abrir o link no navegador. Qualquer amigo com o app instalado pode hospedar outra sala. O computador do anfitriao precisa continuar ligado, com a janela do app aberta. Feche a janela para encerrar. O link publico muda a cada abertura.

Windows 10/11 de 64 bits (x64). O pacote nao e assinado; o Windows pode pedir confirmacao para executar um download.

## Atualizacoes e dados

Cada abertura procura uma release estavel mais nova no GitHub, baixa o ZIP, confere SHA-256 e troca a versao antes de abrir a sala. Nao interrompe uma partida para atualizar. Se nao houver internet, a API limitar consultas ou o download falhar, abre a versao instalada. A primeira release e as atualizacoes precisam estar acessiveis publicamente; repositorio privado exige outra forma de distribuicao.

O app fica em `%LOCALAPPDATA%\LoL7a0`. Pacotes e fotos editados ficam em `data\public`; a sala, a base publicada e os logs ficam em `data\room`. As atualizacoes preservam esses arquivos. As bases e fotos editaveis sao copiadas do pacote somente na primeira abertura; novas bases oficiais nao substituem suas edicoes. A base padrao oferecida pelo lobby acompanha a versao do programa. Faca backup da pasta `data` para mudar de computador.

Para jogar apenas na rede local, abra `%LOCALAPPDATA%\LoL7a0\Jogar-na-rede-local.bat`. O app ainda busca atualizacoes, mas nao abre tunel.

Se uma versao nova nao funcionar, com o app fechado copie o conteudo de `previous.txt` para `current.txt` e abra sem buscar atualizacao usando PowerShell:

```powershell
$root = Join-Path $env:LOCALAPPDATA 'LoL7a0'
$version = (Get-Content (Join-Path $root 'current.txt') -Raw).Trim()
& (Join-Path $root "versions/$version/launcher.ps1") -InstallRoot $root -SkipUpdate
```

Para desinstalar, feche o app, remova a pasta `%LOCALAPPDATA%\LoL7a0` e o atalho. Isso tambem apaga seus dados; copie `data` antes se quiser guarda-los.

## Para publicar uma versao

O fluxo `.github/workflows/release.yml` monta o pacote em Windows e publica a release ao receber uma tag `vX.Y.Z`. A tag precisa coincidir com `version` no `package.json`. O pacote inclui Node 24.19.0, o servidor compilado, a interface e cloudflared com suas licencas. Os downloads dos runtimes sao conferidos com os checksums oficiais.

1. Atualize `version` no `package.json` e no lock com `npm version patch --no-git-tag-version` (ou `minor`/`major`).
2. Commit e envie as mudancas ao GitHub.
3. Crie e envie a tag correspondente, por exemplo `git tag v1.0.1` e `git push origin v1.0.1`.
4. Aguarde o workflow e compartilhe o link da release com os amigos.

Tambem e possivel executar manualmente o workflow para baixar um artifact de teste, sem publicar. Localmente no Windows: `npm ci`, `npm run build`, `npm run package:windows`. O ZIP sai em `release/`.

As consultas de versao e os hashes usam a [API de releases do GitHub](https://docs.github.com/en/rest/releases/releases). O tunel usa o [cloudflared oficial](https://developers.cloudflare.com/tunnel/downloads/).
