param([Parameter(Mandatory = $true)][string]$InstallRoot, [switch]$Offline, [switch]$SkipUpdate)
. (Join-Path $PSScriptRoot 'common.ps1')
$mutex = New-Object Threading.Mutex($false, 'Local\LoL7a0-App')
$locked = $false
try {
    try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { Write-Host 'O app ja esta aberto. Use a janela existente.'; return }
    $app = $PSScriptRoot
    if (!$SkipUpdate) {
        try { $app = Update-App $InstallRoot $app } catch {
            Write-Host "Nao foi possivel atualizar. Abrindo a versao instalada. $($_.Exception.Message)"
        }
    }
    # A nova versao executa seu proprio launcher; permite atualizar este codigo.
    if ($app -ne $PSScriptRoot) {
        $mutex.ReleaseMutex(); $locked = $false
        & (Join-Path $app 'launcher.ps1') -InstallRoot $InstallRoot -Offline:$Offline -SkipUpdate
        return
    }
    $env:LOL_APP_ROOT = $app
    $env:LOL_DATA_DIR = Join-Path $InstallRoot 'data'
    $env:LOL_CLOUDFLARED = Join-Path $app 'runtime/cloudflared.exe'
    $env:LOL_OPEN_BROWSER = '1'
    $serverArgs = @((Join-Path $app 'server/main.mjs'))
    if (!$Offline) { $serverArgs += '--tunnel' }
    Write-Host 'Abrindo a sala. Mantenha esta janela aberta enquanto joga.'
    & (Join-Path $app 'runtime/node.exe') @serverArgs
    if ($LASTEXITCODE -ne 0) { throw "O servidor encerrou com erro ($LASTEXITCODE)." }
} catch {
    Write-Host "Nao foi possivel iniciar: $($_.Exception.Message)"
    Read-Host 'Pressione Enter para fechar'
    exit 1
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
