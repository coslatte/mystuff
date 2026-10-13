# Loads .env from the repo root and starts Spring Boot
# Usage: powershell -ExecutionPolicy Bypass -File src/backend/run.ps1

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$envFile = Join-Path $root ".env"
$localEnvFile = Join-Path $root ".env.local"

foreach ($file in @($envFile, $localEnvFile)) {
if (Test-Path $file) {
    Get-Content $file | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        $kv = $_ -split '=',2
        if ($kv.Count -eq 2) {
            $k = $kv[0].Trim()
            $v = $kv[1].Trim()
            Set-Item -Path "env:$k" -Value $v
            Write-Host "  Loaded $k"
        }
    }
    Write-Host "Loaded env vars from $file" -ForegroundColor Green
}
}

Write-Host "Starting backend..." -ForegroundColor Cyan
# -f keeps this working no matter which directory the script is invoked from.
& "$PSScriptRoot/mvnw.cmd" -f "$PSScriptRoot/pom.xml" spring-boot:run
