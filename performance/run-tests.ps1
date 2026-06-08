# run-tests.ps1 - Sequential isolated stress test (Windows PowerShell version).
#
# Run 1: Microservices only  -> ./results/results-microservices.json
# Run 2: Monolith only       -> ./results/results-monolith.json
# Comparison summary printed at end.
#
# Usage:  .\run-tests.ps1

$ErrorActionPreference = "Continue"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path

# Configurable URLs
if ($env:MONOLITH_URL) { $MonolithURL = $env:MONOLITH_URL } else { $MonolithURL = "http://host.docker.internal:4000" }
if ($env:MICROSERVICES_URL) { $MicroservicesURL = $env:MICROSERVICES_URL } else { $MicroservicesURL = "http://host.docker.internal:8080" }

# Project directories
$MonolithDir      = Join-Path $ProjectRoot "monolith"
$MicroservicesDir = Join-Path $ProjectRoot "microservices"

# Ensure results directory exists
$ResultsDir = Join-Path $ScriptDir "results"
if (-not (Test-Path $ResultsDir)) { New-Item -ItemType Directory -Path $ResultsDir | Out-Null }

Write-Host ""
Write-Host "+==========================================================+" -ForegroundColor Cyan
Write-Host "|       Sequential Architectural Stress Test                |" -ForegroundColor Cyan
Write-Host "+==========================================================+" -ForegroundColor Cyan
Write-Host "|  Max VUs : 50                                            |" -ForegroundColor Yellow
Write-Host "|  Duration: ~3m30s per run                                |" -ForegroundColor Yellow
Write-Host "|  Grafana : http://localhost:3000                         |" -ForegroundColor Yellow
Write-Host "+==========================================================+" -ForegroundColor Cyan
Write-Host ""

# --- Helper functions (defined before use) ------------------------------------

function Load-Results {
    param([string]$FilePath)
    if (-not (Test-Path $FilePath)) {
        Write-Host "  [!] Could not load $FilePath - file not found" -ForegroundColor Yellow
        return $null
    }
    try {
        return Get-Content $FilePath -Raw | ConvertFrom-Json
    } catch {
        Write-Host "  [!] Could not parse $FilePath - $_" -ForegroundColor Yellow
        return $null
    }
}

function Get-MetricValue {
    param($Data, [string]$Key, [string]$Stat)
    try {
        $metric = $Data.metrics.PSObject.Properties[$Key]
        if ($null -eq $metric) { return $null }
        $statProp = $metric.Value.PSObject.Properties[$Stat]
        if ($null -eq $statProp) { return $null }
        return $statProp.Value
    } catch {
        return $null
    }
}

function Format-MetricValue {
    param($Value, [string]$Unit)
    if ($null -eq $Value) { return "n/a" }
    switch ($Unit) {
        "ms" {
            if ($Value -lt 1) { return "{0:F1}ms" -f ($Value * 1000) }
            else              { return "{0:F2}s"  -f $Value }
        }
        "%"     { return "{0:F1}%" -f ($Value * 100) }
        default { return [string][int]$Value }
    }
}

# --- RUN 1: MICROSERVICES ----------------------------------------------------
Write-Host "[>] Run 1/2 - MICROSERVICES  (target: $MicroservicesURL)" -ForegroundColor Green
Write-Host "    Starting in 3 seconds..."
Start-Sleep -Seconds 3

$composeFile = Join-Path $ScriptDir "docker-compose.yml"

docker compose -f $composeFile run --no-deps -T --rm -e "TARGET_URL=$MicroservicesURL" -e "ARCH=microservices" k6 run --tag arch=microservices --out influxdb=http://influxdb:8086/k6 --summary-export=/results/results-microservices.json /scripts/loadtest.js
$MsCode = $LASTEXITCODE

Write-Host ""
Write-Host "[OK] Run 1 complete (exit $MsCode). Stopping microservices app layer..." -ForegroundColor Green

Push-Location $MicroservicesDir
docker compose stop api-gateway product-service order-service auth-service llm-service recommendation-service content-creator
Pop-Location
Write-Host ""

# --- RUN 2: MONOLITH ---------------------------------------------------------
Write-Host "[>] Run 2/2 - MONOLITH  (target: $MonolithURL)" -ForegroundColor Green
Write-Host "    Starting in 3 seconds..."
Start-Sleep -Seconds 3

docker compose -f $composeFile run --no-deps -T --rm -e "TARGET_URL=$MonolithURL" -e "ARCH=monolith" k6 run --tag arch=monolith --out influxdb=http://influxdb:8086/k6 --summary-export=/results/results-monolith.json /scripts/loadtest.js
$MCode = $LASTEXITCODE

Write-Host ""
Write-Host "[OK] Run 2 complete (exit $MCode). Stopping monolith app layer..." -ForegroundColor Green

Push-Location $MonolithDir
docker compose stop monolith-backend
Pop-Location
Write-Host ""

# --- COMPARISON ---------------------------------------------------------------
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  RESULTS COMPARISON" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$MsResultPath = Join-Path $ResultsDir "results-microservices.json"
$MoResultPath = Join-Path $ResultsDir "results-monolith.json"

$ms = Load-Results -FilePath $MsResultPath
$mo = Load-Results -FilePath $MoResultPath

if ($ms -and $mo) {
    $p95 = 'p(95)'
    $rows = @(
        @{ Key="http_req_duration"; Stat="avg";   Unit="ms"; Label="Avg latency" },
        @{ Key="http_req_duration"; Stat=$p95;    Unit="ms"; Label="p95 latency" },
        @{ Key="http_req_duration"; Stat="max";   Unit="ms"; Label="Max latency" },
        @{ Key="http_req_failed";   Stat="rate";  Unit="%";  Label="Error rate" },
        @{ Key="iterations";        Stat="count"; Unit="";   Label="Iterations" },
        @{ Key="http_reqs";         Stat="count"; Unit="";   Label="HTTP requests" }
    )

    Write-Host ""
    Write-Host ("  {0,-22} {1,16} {2,16}" -f "Metric", "Microservices", "Monolith")
    Write-Host ("  {0} {1} {2}" -f ("-" * 22), ("-" * 16), ("-" * 16))

    foreach ($row in $rows) {
        $msVal = Get-MetricValue -Data $ms -Key $row.Key -Stat $row.Stat
        $moVal = Get-MetricValue -Data $mo -Key $row.Key -Stat $row.Stat
        $msFmt = Format-MetricValue -Value $msVal -Unit $row.Unit
        $moFmt = Format-MetricValue -Value $moVal -Unit $row.Unit
        Write-Host ("  {0,-22} {1,16} {2,16}" -f $row.Label, $msFmt, $moFmt)
    }
    Write-Host ""
} else {
    Write-Host "  Could not produce comparison - one or both result files are missing." -ForegroundColor Red
    Write-Host ""
}

Write-Host "Grafana dashboard    : http://localhost:3000"
Write-Host "Microservices JSON   : $MsResultPath"
Write-Host "Monolith JSON        : $MoResultPath"
Write-Host ""

# --- Restart stopped services -------------------------------------------------
Write-Host "Restarting stopped services..."

Push-Location $MicroservicesDir
docker compose up -d 2>&1 | Select-Object -Last 3
Pop-Location

Push-Location $MonolithDir
docker compose up -d monolith-backend 2>&1 | Select-Object -Last 3
Pop-Location

Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# --- CLEANUP: delete k6 test comments ----------------------------------------
Write-Host "Cleaning up k6 test comments..."
Write-Host "Waiting for services to be ready..."
Start-Sleep -Seconds 15

# Health checks
try {
    $null = Invoke-WebRequest -Uri "http://localhost:4000/products" -UseBasicParsing -TimeoutSec 5
    Write-Host "  Monolith ready" -ForegroundColor Green
} catch {
    Write-Host "  Monolith not ready" -ForegroundColor Yellow
}

try {
    $null = Invoke-WebRequest -Uri "http://localhost:8080/products" -UseBasicParsing -TimeoutSec 5
    Write-Host "  Microservices ready" -ForegroundColor Green
} catch {
    Write-Host "  Microservices not ready" -ForegroundColor Yellow
}

# Cleanup k6 comments - Monolith
try {
    $monoResponse = Invoke-WebRequest -Uri "http://localhost:4000/products/comments/k6" -Method DELETE -UseBasicParsing -TimeoutSec 10
    $monoBody = $monoResponse.Content
    Write-Host "  [OK] Monolith:      $monoBody" -ForegroundColor Green
} catch {
    $errCode = "N/A"
    if ($_.Exception.Response) { $errCode = [int]$_.Exception.Response.StatusCode }
    Write-Host "  [X] Monolith cleanup failed [HTTP $errCode]: $_" -ForegroundColor Red
}

# Cleanup k6 comments - Microservices
try {
    $microResponse = Invoke-WebRequest -Uri "http://localhost:8080/products/comments/k6" -Method DELETE -UseBasicParsing -TimeoutSec 10
    $microBody = $microResponse.Content
    Write-Host "  [OK] Microservices: $microBody" -ForegroundColor Green
} catch {
    $errCode = "N/A"
    if ($_.Exception.Response) { $errCode = [int]$_.Exception.Response.StatusCode }
    Write-Host "  [X] Microservices cleanup failed [HTTP $errCode]: $_" -ForegroundColor Red
}

Write-Host ""
