# Loads .env from the repo root and starts Spring Boot
# Usage: powershell -ExecutionPolicy Bypass -File backend/run.ps1

$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        $kv = $_ -split '=',2
        if ($kv.Count -eq 2) {
            $k = $kv[0].Trim()
            $v = $kv[1].Trim()
            Set-Item -Path "env:$k" -Value $v
            Write-Host "  $k=$v"
        }
    }
    Write-Host "Loaded env vars from $envFile" -ForegroundColor Green
} else {
    Write-Host "No .env at $root, falling back to the application.yml defaults" -ForegroundColor Yellow
}

Write-Host "Starting backend..." -ForegroundColor Cyan
# -f keeps this working no matter which directory the script is invoked from.
& "$PSScriptRoot/mvnw.cmd" -f "$PSScriptRoot/pom.xml" spring-boot:run
