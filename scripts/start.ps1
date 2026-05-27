$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendOut = Join-Path $projectRoot "backend.out.log"
$backendErr = Join-Path $projectRoot "backend.err.log"
$backendPort = 54321
$backendUrl = "http://127.0.0.1:$backendPort"

$existingBackend = Get-NetTCPConnection -LocalPort $backendPort -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  Where-Object { $_ -and $_ -ne 0 }

foreach ($processId in $existingBackend) {
  $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
  $commandLine = $processInfo.CommandLine

  if ($commandLine -and $commandLine -match "local-functions-server\.mjs") {
    Stop-Process -Id $processId -Force
  } else {
    throw "Port $backendPort is already in use by process $processId. Stop that process or set PORT in .env before starting Nex."
  }
}

if (Test-Path $backendOut) { Remove-Item -LiteralPath $backendOut -Force }
if (Test-Path $backendErr) { Remove-Item -LiteralPath $backendErr -Force }

Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "backend") `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $backendOut `
  -RedirectStandardError $backendErr | Out-Null

Start-Sleep -Milliseconds 700

$env:VITE_SUPABASE_FUNCTIONS_URL = $backendUrl

npm.cmd run dev -- --host 127.0.0.1
