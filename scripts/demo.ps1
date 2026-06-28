#!/usr/bin/env pwsh
# ================================================
# IntelForge — One-shot demo bootstrap
# Brings the full automation stack from cold start
# to running, seeded, and verified.
# Use:  .\scripts\demo.ps1
# ================================================

$ErrorActionPreference = "Stop"

function Step([string]$message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Ok([string]$message) {
    Write-Host "    [OK] $message" -ForegroundColor Green
}

function Fail([string]$message) {
    Write-Host "    [FAIL] $message" -ForegroundColor Red
    exit 1
}

# Step 1 - Postgres
Step "Checking Postgres container"
$containerStatus = docker ps --filter "name=intelforge-postgres" --format "{{.Status}}" 2>$null
if (-not $containerStatus) {
    Step "Starting intelforge-postgres"
    docker start intelforge-postgres 2>$null | Out-Null
    Start-Sleep -Seconds 4
    $containerStatus = docker ps --filter "name=intelforge-postgres" --format "{{.Status}}"
}
if (-not $containerStatus) {
    Fail "intelforge-postgres container not found. Run: docker compose up -d"
}
Ok "Postgres: $containerStatus"

# Step 2 - Apply all migrations in order
Step "Applying migrations (idempotent)"
$migrations = @(
    "scripts\intel-feeds-migration.sql",
    "scripts\intel-advanced-feeds-migration.sql",
    "scripts\intel-automation-migration.sql",
    "scripts\intel-automation-v2-migration.sql",
    "scripts\intel-automation-v3-migration.sql",
    "scripts\intel-automation-v4-migration.sql",
    "scripts\seed-trend-history.sql",
    "scripts\seed-correlation-demo.sql"
)
foreach ($m in $migrations) {
    if (Test-Path $m) {
        $name = (Split-Path $m -Leaf)
        Get-Content $m -Raw | docker exec -i intelforge-postgres psql -U intelforge -d intelforge -q 2>$null | Out-Null
        Ok "Applied $name"
    } else {
        Write-Host "    [skip] $m not found" -ForegroundColor Yellow
    }
}

# Step 3 - Verify required env vars
Step "Verifying environment variables"
if (-not (Test-Path .env.local)) {
    Fail ".env.local not found"
}
$envText = Get-Content .env.local -Raw
$required = @("DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "SESSION_SECRET", "CRON_SECRET")
foreach ($k in $required) {
    if ($envText -notmatch "^\s*$k\s*=\s*\S") {
        Fail "$k missing or empty in .env.local"
    }
    Ok "$k present"
}

# Step 4 - Start dev server in the background if not already running
Step "Checking dev server"
$serverUp = $false
try {
    Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $serverUp = $true
} catch { }
if (-not $serverUp) {
    Write-Host "    Dev server not running. Start it manually:" -ForegroundColor Yellow
    Write-Host "      npm run dev" -ForegroundColor Yellow
    Write-Host "    Then re-run this script." -ForegroundColor Yellow
    exit 0
}
Ok "Dev server reachable on http://localhost:3000"

# Step 5 - Seed feed data + automation
$cronSecret = ($envText -split "`n" | Select-String -Pattern '^CRON_SECRET=' | ForEach-Object { ($_ -replace '^CRON_SECRET=','').Trim() })
$headers = @{ "Authorization" = "Bearer $cronSecret" }

Step "Triggering intel-sync (initial feed pull)"
try {
    Invoke-RestMethod -Uri "http://localhost:3000/api/cron/intel-sync" -Method Post -Headers $headers -TimeoutSec 180 | Out-Null
    Ok "Feeds synced"
} catch {
    Write-Host "    [warn] intel-sync did not complete cleanly: $($_.Exception.Message)" -ForegroundColor Yellow
}

Step "Triggering automation pipeline"
try {
    $r = Invoke-RestMethod -Uri "http://localhost:3000/api/cron/automation" -Method Post -Headers $headers -TimeoutSec 180
    Ok "Automation: score $($r.result.threatScore.score) ($($r.result.threatScore.severity)), $($r.result.correlation.persisted) clusters, $($r.result.actions.created) actions"
} catch {
    Fail "automation cron failed: $($_.Exception.Message)"
}

# Step 6 - Run the test suite
Step "Running defence test suite"
$testProc = Start-Process -FilePath "npm" -ArgumentList "run", "defence:test" -PassThru -NoNewWindow -Wait
if ($testProc.ExitCode -ne 0) {
    Fail "defence tests reported failures"
}
Ok "All test suites passed"

# Step 7 - Build the PDF
Step "Building defence PDF"
$pdfProc = Start-Process -FilePath "npm" -ArgumentList "run", "defence:pdf" -PassThru -NoNewWindow -Wait
if ($pdfProc.ExitCode -ne 0) {
    Fail "PDF build failed"
}
$pdfPath = "docs\defence\IntelForge_FYP_Defence.pdf"
if (Test-Path $pdfPath) {
    $pdfSize = [math]::Round((Get-Item $pdfPath).Length / 1024, 1)
    Ok "PDF written: $pdfPath ($pdfSize KB)"
}

# Step 8 - Open the Command Center in the default browser
Step "Opening Command Center"
Start-Process "http://localhost:3000/intelligence/command-center"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Demo bootstrap complete." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Useful URLs:" -ForegroundColor Cyan
Write-Host "  Command Center:  http://localhost:3000/intelligence/command-center"
Write-Host "  Correlation:     http://localhost:3000/intelligence/clusters"
Write-Host "  Action Queue:    http://localhost:3000/intelligence/action-queue"
Write-Host "  Hunt Builder:    http://localhost:3000/intelligence/hunt"
Write-Host "  Briefings:       http://localhost:3000/intelligence/briefings"
Write-Host "  API Docs:        http://localhost:3000/api-docs"
Write-Host "  Admin:           http://localhost:3000/admin-portal/automation"
Write-Host ""
