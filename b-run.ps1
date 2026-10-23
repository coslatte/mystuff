# Starts the backend (Spring Boot) via src/backend/run.ps1.
# Usage: powershell -ExecutionPolicy Bypass -File b-run.ps1
$runScript = Join-Path $PSScriptRoot "src\backend\run.ps1"
if (-not (Test-Path $runScript)) { Write-Host "Backend run script not found" -ForegroundColor Red; exit 1 }
& $runScript
