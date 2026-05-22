$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendOut = Join-Path $projectRoot "backend.out.log"
$backendErr = Join-Path $projectRoot "backend.err.log"

$existingBackend = Get-NetTCPConnection -LocalPort 54321 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  Where-Object { $_ -and $_ -ne 0 }

if (-not $existingBackend) {
  if (Test-Path $backendOut) { Remove-Item -LiteralPath $backendOut -Force }
  if (Test-Path $backendErr) { Remove-Item -LiteralPath $backendErr -Force }

  Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "backend") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError $backendErr | Out-Null

  Start-Sleep -Milliseconds 700
}

npm.cmd run dev -- --host 127.0.0.1
