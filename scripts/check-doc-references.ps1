[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

# Maintained current authority. PROJECT_STATE is append-only history and is
# presence-checked, but its historical references are not required to resolve
# inside a clean source snapshot.
$documents = @(
    "AGENTS.md",
    "HANDOFF.md",
    "README.md",
    "REQUIREMENTS.md",
    "ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md",
    "FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md",
    "FILE_INVENTORY.md",
    "PROJECT_STATE_EOD_CHARTING_PLATFORM.md"
)

$referenceDocuments = @(
    "AGENTS.md",
    "HANDOFF.md",
    "REQUIREMENTS.md",
    "FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md",
    "FILE_INVENTORY.md"
)

$requiredTargets = @(
    "AGENTS.md",
    "HANDOFF.md",
    "README.md",
    "REQUIREMENTS.md",
    "ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md",
    "FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md",
    "FILE_INVENTORY.md",
    "PROJECT_STATE_EOD_CHARTING_PLATFORM.md",
    "scripts\validate-change.ps1",
    "scripts\check-doc-references.ps1",
    "src",
    "src\platform",
    "src-tauri-shell"
)

$issues = [System.Collections.Generic.List[string]]::new()

foreach ($relativePath in $documents + $requiredTargets | Select-Object -Unique) {
    $path = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path)) {
        $issues.Add("Missing required reference target: $relativePath")
    }
}

foreach ($relativePath in $documents) {
    $path = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path)) { continue }

    $content = [IO.File]::ReadAllText($path)
    foreach ($line in $content -split "`r?`n") {
        if ($line -match '\.codex[\\/]skills' -and $line -notmatch '(?i)archiv|removed|reference|do not|no active|without .*approval') {
            $issues.Add("Stale active .codex/skills reference: $relativePath")
        }
    }
    if ($content -match 'D:[\\/]TA Projects[\\/]EOD Charting Platform') {
        $issues.Add("Stale project-root reference: $relativePath")
    }
}

$referencePattern = '`([^`]+\.(?:md|ps1))`'
foreach ($relativePath in $referenceDocuments) {
    $path = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path)) { continue }

    $content = [IO.File]::ReadAllText($path)
    foreach ($match in [regex]::Matches($content, $referencePattern)) {
        $reference = $match.Groups[1].Value
        if ($reference -match '[<>*?]' -or $reference -match '^https?://') { continue }

        $candidate = if ([IO.Path]::IsPathRooted($reference)) {
            $reference
        } else {
            Join-Path $projectRoot $reference
        }

        if (-not (Test-Path -LiteralPath $candidate)) {
            $issues.Add("Missing referenced file in ${relativePath}: $reference")
        }
    }
}

if ($issues.Count -gt 0) {
    $issues | Sort-Object -Unique | ForEach-Object { Write-Host "[FAIL] $_" -ForegroundColor Red }
    exit 1
}

Write-Host "[PASS] Live documentation references are valid." -ForegroundColor Green
exit 0
