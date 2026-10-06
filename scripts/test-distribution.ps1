param([string]$Archive = (Join-Path $PSScriptRoot '../release/LoL-7-a-0-windows-x64.zip'))
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../tmp'))
New-Item -ItemType Directory -Path $root -Force | Out-Null
$temp = Join-Path $root ('distribution-test-' + [guid]::NewGuid().ToString('N'))
$server = $null
$envNames = @('LOL_APP_ROOT', 'LOL_DATA_DIR', 'LOL_OPEN_BROWSER')
$oldEnv = @{}
foreach ($name in $envNames) { $oldEnv[$name] = [Environment]::GetEnvironmentVariable($name) }
try {
    $package = Join-Path $temp 'package'
    Expand-Archive -LiteralPath $Archive -DestinationPath $package
    $installation = Join-Path $temp 'installed with spaces'
    & (Join-Path $package 'install.ps1') -InstallRoot $installation -NoShortcut
    . (Join-Path $package 'app/common.ps1')
    $version = Read-Version (Join-Path $package 'app')
    $app = Join-Path $installation "versions/$version"
    if ((Get-Content (Join-Path $installation 'current.txt') -Raw) -ne $version) { throw 'Ponteiro de instalacao errado.' }
    # Servidor executa com Node distribuido e sem node_modules na instalacao.
    $env:LOL_APP_ROOT = $app
    $env:LOL_DATA_DIR = Join-Path $installation 'data'
    $env:LOL_OPEN_BROWSER = '0'
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
    $listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
    $server = Start-Process -FilePath (Join-Path $app 'runtime/node.exe') -ArgumentList @(('"' + (Join-Path $app 'server/main.mjs') + '"'), '--port', $port) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $temp 'server.log') -RedirectStandardError (Join-Path $temp 'server-error.log')
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        if ($server.HasExited) { throw (Get-Content (Join-Path $temp 'server-error.log') -Raw) }
        try {
            $response = Invoke-WebRequest "http://localhost:$port/healthz" -UseBasicParsing -TimeoutSec 2
            if ($response.Content -eq 'ok') { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 300 }
    }
    if (!$ready) { throw 'Servidor nao iniciou.' }
    $room = Invoke-RestMethod "http://localhost:$port/api/room-info"
    if (!$room.room) { throw 'Sala indisponivel.' }
    $page = Invoke-WebRequest "http://localhost:$port/" -UseBasicParsing
    if ($page.Content -notmatch '<html') { throw 'Interface indisponivel.' }
    Stop-Process -Id $server.Id -Force
    $server.WaitForExit(); $server = $null
    $sentinel = Join-Path $installation 'data/public/packs/meu-pacote.json'
    [IO.File]::WriteAllText($sentinel, 'dados personalizados')
    # Simula uma versao antiga e entrega o ZIP real pelo adaptador de download.
    $oldApp = Join-Path $temp 'old-app'
    Copy-Item -LiteralPath (Join-Path $package 'app') -Destination $oldApp -Recurse
    [IO.File]::WriteAllText((Join-Path $oldApp 'app.json'), '{"version":"0.0.0"}')
    $oldInstalled = Install-Payload $oldApp $installation
    $script:fakeVersion = $version
    $script:fakeArchive = [IO.Path]::GetFullPath($Archive)
    $script:fakeDigest = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLower()
    function Invoke-RestMethod {
        return @{ tag_name = "v$script:fakeVersion"; assets = @(@{ name = 'LoL-7-a-0-windows-x64.zip'; digest = "sha256:$script:fakeDigest"; browser_download_url = "https://github.com/rafaelpsampaio/lol-7-a-0-publico/releases/download/v$script:fakeVersion/LoL-7-a-0-windows-x64.zip" }) }
    }
    function Invoke-WebRequest { param($Uri, $OutFile, [switch]$UseBasicParsing, $TimeoutSec); Copy-Item -LiteralPath $script:fakeArchive -Destination $OutFile }
    $updated = Update-App $installation $oldInstalled
    if ($updated -ne $app) { throw 'Atualizacao nao ativou a versao nova.' }
    if ((Get-Content (Join-Path $installation 'previous.txt') -Raw) -ne '0.0.0') { throw 'Rollback ausente.' }
    if ((Get-Content $sentinel -Raw) -ne 'dados personalizados') { throw 'Dados alterados pela atualizacao.' }
    Install-Payload $oldApp $installation | Out-Null
    $script:fakeDigest = '0' * 64
    $rejected = $false
    try { Update-App $installation $oldInstalled | Out-Null } catch { $rejected = $true }
    if (!$rejected -or (Get-Content (Join-Path $installation 'current.txt') -Raw) -ne '0.0.0') { throw 'Checksum invalido foi aceito.' }
    Write-Host 'OK: instalacao, servidor standalone, interface, atualizacao, rollback, dados e checksum.'
} finally {
    if ($server -and !$server.HasExited) { Stop-Process -Id $server.Id -Force; $server.WaitForExit() }
    foreach ($name in $envNames) { [Environment]::SetEnvironmentVariable($name, $oldEnv[$name]) }
    $resolvedTemp = [IO.Path]::GetFullPath($temp)
    if (!$resolvedTemp.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Pasta de teste fora do workspace.' }
    if (Test-Path -LiteralPath $resolvedTemp) { Remove-Item -LiteralPath $resolvedTemp -Recurse -Force }
}
