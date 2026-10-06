param([string]$Package, [string]$Archive)
$ErrorActionPreference = 'Stop'
# Lista explicita: os downloads temporarios nao entram na distribuicao.
$files = @('app', 'Instalar.bat', 'install.ps1', 'iniciar.ps1', 'Jogar.bat', 'Jogar-na-rede-local.bat', 'LEIA-ME.md') | ForEach-Object { Join-Path $Package $_ }
Compress-Archive -LiteralPath $files -DestinationPath $Archive -Force
