# Carga .env de la raiz y arranca Spring Boot
# Uso: powershell -ExecutionPolicy Bypass -File backend/run.ps1

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
    Write-Host "Variables cargadas desde $envFile" -ForegroundColor Green
} else {
    Write-Host ".env no encontrado en $root - usando defaults (postgres/postgres)" -ForegroundColor Yellow
}

Write-Host "Arrancando backend..." -ForegroundColor Cyan
& "$PSScriptRoot/mvnw.cmd" spring-boot:run
