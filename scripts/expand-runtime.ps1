param([string]$Archive, [string]$Destination, [string]$App)
$ErrorActionPreference = 'Stop'
Expand-Archive -LiteralPath $Archive -DestinationPath $Destination
$runtime = Get-ChildItem -LiteralPath $Destination -Directory | Select-Object -First 1
Copy-Item -LiteralPath (Join-Path $runtime.FullName 'node.exe') -Destination (Join-Path $App 'runtime/node.exe')
Copy-Item -LiteralPath (Join-Path $runtime.FullName 'LICENSE') -Destination (Join-Path $App 'runtime/node-LICENSE')
