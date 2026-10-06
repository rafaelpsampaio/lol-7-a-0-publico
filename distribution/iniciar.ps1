param([switch]$Offline)
$ErrorActionPreference = 'Stop'
try {
    $version = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'current.txt') -Raw).Trim()
    if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Instalacao invalida. Rode Instalar.bat novamente.' }
    & (Join-Path $PSScriptRoot "versions/$version/launcher.ps1") -InstallRoot $PSScriptRoot -Offline:$Offline
} catch {
    Write-Host $_.Exception.Message
    Read-Host 'Pressione Enter para fechar'
    exit 1
}
