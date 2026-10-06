param([string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'LoL7a0'), [switch]$NoShortcut)
. (Join-Path $PSScriptRoot 'app/common.ps1')
$mutex = New-Object Threading.Mutex($false, 'Local\LoL7a0-App')
$locked = $false
try {
    try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { throw 'Feche o app antes de instalar.' }
    $InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
    $app = Install-Payload (Join-Path $PSScriptRoot 'app') $InstallRoot
    foreach ($file in @('iniciar.ps1', 'Jogar.bat', 'Jogar-na-rede-local.bat')) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $InstallRoot $file) -Force
    }
    if (!$NoShortcut) {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'LoL 7 a 0.lnk'))
        $shortcut.TargetPath = Join-Path $InstallRoot 'Jogar.bat'
        $shortcut.WorkingDirectory = $InstallRoot
        $shortcut.Description = 'Abrir sala do LoL 7 a 0'
        $shortcut.Save()
    }
    Write-Host "Instalado em $InstallRoot. Abra LoL 7 a 0 na area de trabalho para jogar."
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
