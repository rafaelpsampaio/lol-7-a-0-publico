$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Repository = 'rafaelpsampaio/lol-7-a-0-publico'
$AssetName = 'LoL-7-a-0-windows-x64.zip'

function Read-Version([string]$App) {
    $meta = Get-Content -LiteralPath (Join-Path $App 'app.json') -Raw | ConvertFrom-Json
    if ($meta.version -notmatch '^\d+\.\d+\.\d+$') { throw 'Versao invalida.' }
    foreach ($file in @('runtime/node.exe', 'runtime/cloudflared.exe', 'server/main.mjs', 'dist/index.html', 'launcher.ps1')) {
        if (!(Test-Path -LiteralPath (Join-Path $App $file) -PathType Leaf)) { throw "Pacote incompleto: $file" }
    }
    return $meta.version
}

function Install-Payload([string]$App, [string]$Root) {
    $version = Read-Version $App
    $versions = Join-Path $Root 'versions'
    New-Item -ItemType Directory -Path $versions -Force | Out-Null
    $destination = Join-Path $versions $version
    if (!(Test-Path -LiteralPath $destination)) {
        $staging = Join-Path $versions ('.staging-' + [guid]::NewGuid().ToString('N'))
        Copy-Item -LiteralPath $App -Destination $staging -Recurse
        Read-Version $staging | Out-Null
        Move-Item -LiteralPath $staging -Destination $destination
    }
    if ((Read-Version $destination) -ne $version) { throw 'A pasta instalada tem uma versao diferente.' }
    $pointer = Join-Path $Root 'current.txt'
    $next = Join-Path $Root 'current.next'
    [IO.File]::WriteAllText($next, $version)
    if (Test-Path -LiteralPath $pointer) {
        [IO.File]::Replace($next, $pointer, (Join-Path $Root 'previous.txt'))
    } else { [IO.File]::Move($next, $pointer) }
    return $destination
}

function Update-App([string]$Root, [string]$Current) {
    $version = Read-Version $Current
    Write-Host 'Buscando atualizacoes...'
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/releases/latest" -Headers @{ 'User-Agent' = 'LoL-7-a-0'; Accept = 'application/vnd.github+json' } -TimeoutSec 15
    if ($release.tag_name -notmatch '^v(\d+\.\d+\.\d+)$') { throw 'Release com versao invalida.' }
    $nextVersion = $Matches[1]
    if ([version]$nextVersion -le [version]$version) { return $Current }
    $asset = @($release.assets | Where-Object { $_.name -eq $AssetName })
    if ($asset.Count -ne 1 -or $asset[0].digest -notmatch '^sha256:([a-fA-F0-9]{64})$') { throw 'Release sem pacote ou checksum SHA-256.' }
    $digest = $Matches[1]
    $url = [uri]$asset[0].browser_download_url
    if ($url.Scheme -ne 'https' -or $url.Host -ne 'github.com' -or !$url.AbsolutePath.StartsWith("/$Repository/releases/download/")) { throw 'Endereco de download invalido.' }
    $temp = Join-Path $Root ('downloads/' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temp -Force | Out-Null
    try {
    $zip = Join-Path $temp 'update.zip'
    Write-Host "Baixando versao $nextVersion..."
    Invoke-WebRequest -Uri $url.AbsoluteUri -OutFile $zip -UseBasicParsing -TimeoutSec 180
    if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $digest) { throw 'Download corrompido: checksum diferente.' }
    $unpacked = Join-Path $temp 'unpacked'
    Expand-Archive -LiteralPath $zip -DestinationPath $unpacked
    $app = Join-Path $unpacked 'app'
    if ((Read-Version $app) -ne $nextVersion) { throw 'A versao do pacote difere da release.' }
    $installed = Install-Payload $app $Root
    Write-Host "Atualizado para $nextVersion."
    return $installed
    } finally {
        # Apenas o diretorio UUID criado acima, dentro de downloads desta instalacao.
        $downloads = [IO.Path]::GetFullPath((Join-Path $Root 'downloads')) + [IO.Path]::DirectorySeparatorChar
        $resolvedTemp = [IO.Path]::GetFullPath($temp)
        if (!$resolvedTemp.StartsWith($downloads, [StringComparison]::OrdinalIgnoreCase)) { throw 'Pasta temporaria fora da instalacao.' }
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force -ErrorAction SilentlyContinue
    }
}
