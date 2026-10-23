# Starts the frontend dev server (Astro).
# Usage: powershell -ExecutionPolicy Bypass -File f-run.ps1
$frontendDir = Join-Path $PSScriptRoot "src\frontend"
if (-not (Test-Path $frontendDir)) { Write-Host "Frontend dir not found" -ForegroundColor Red; exit 1 }
Set-Location $frontendDir
& bun run dev
