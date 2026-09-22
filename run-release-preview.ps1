$ErrorActionPreference = "Stop"

$ProjectRoot = "E:\TA Projects\EOD Charting Platform"
$ExePath = Join-Path $ProjectRoot "target\release\eod-charting-platform-shell.exe"
if (-not (Test-Path $ExePath)) {
    $ExePath = Join-Path $ProjectRoot "src-tauri-shell\target\release\eod-charting-platform-shell.exe"
}

Set-Location $ProjectRoot

Write-Host "Closing old EOD Charting Platform process if running..." -ForegroundColor Yellow
Get-Process eod-charting-platform-shell -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Building release preview without installer..." -ForegroundColor Cyan
npm run tauri:build -- --no-bundle

if (-not (Test-Path $ExePath)) {
    throw "Release EXE not found at: $ExePath"
}

Write-Host "Launching updated release EXE:" -ForegroundColor Green
Write-Host $ExePath -ForegroundColor Green

Start-Process -FilePath $ExePath -WorkingDirectory (Split-Path $ExePath)