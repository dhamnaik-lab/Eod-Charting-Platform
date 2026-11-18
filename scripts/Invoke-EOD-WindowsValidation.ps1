#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter()][ValidateSet('Preview','Run')][string]$Mode = 'Preview',
    [Parameter()][ValidateSet('FocusedRenderer','FullRenderer','RustCheck')][string]$Profile = 'FullRenderer',
    [Parameter()][string[]]$TestPaths = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# This runner reuses the authorized checkout, installed node_modules and BUILD-01 Cargo target.
# It does not fetch Git branches, install packages, create Cargo targets or package releases.
$root = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$authorizedRoot = 'E:\TA Projects\EOD Charting Platform'
$tmp = Join-Path $root 'tmp'
$sharedCargo = Join-Path $root 'scripts\Invoke-EOD-SharedCargo.ps1'

if ($root -cne $authorizedRoot) { throw "Wrong EOD workstream root: $root" }
if (-not (Test-Path -LiteralPath $tmp -PathType Container)) { throw "Project tmp directory missing: $tmp" }
if (-not (Test-Path -LiteralPath (Join-Path $root 'package-lock.json') -PathType Leaf)) { throw 'package-lock.json missing' }
if (-not (Test-Path -LiteralPath (Join-Path $root 'package.json') -PathType Leaf)) { throw 'package.json missing' }
if (-not (Test-Path -LiteralPath $sharedCargo -PathType Leaf)) { throw "Shared Cargo wrapper missing: $sharedCargo" }
foreach ($path in @($root,$tmp)) {
    if (((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refuse reparse-point workstream/evidence location: $path"
    }
}

$paths = [System.Collections.Generic.List[string]]::new()
foreach ($candidate in $TestPaths) {
    if ([string]::IsNullOrWhiteSpace($candidate)) { throw 'Empty focused test path' }
    $relative = $candidate.Replace('\','/')
    if ($relative -cnotmatch '^src/[A-Za-z0-9_./-]+$') { throw "Test path must be under src/: $candidate" }
    if (@($relative.Split('/')) -contains '..') { throw "Parent traversal rejected: $candidate" }
    if (@($relative.Split('/')) -contains '.') { throw "Dot-segment rejected: $candidate" }
    $absolute = [IO.Path]::GetFullPath((Join-Path $root $relative))
    $sourcePrefix = [IO.Path]::GetFullPath((Join-Path $root 'src')) + '\'
    if (-not $absolute.StartsWith($sourcePrefix,[StringComparison]::OrdinalIgnoreCase)) {
        throw "Test path escapes source root: $candidate"
    }
    if (-not (Test-Path -LiteralPath $absolute)) { throw "Focused test path missing: $absolute" }
    $paths.Add($relative)
}

if ($Profile -eq 'FocusedRenderer' -and $paths.Count -eq 0) { throw 'FocusedRenderer requires -TestPaths' }
if ($Profile -ne 'FocusedRenderer' -and $paths.Count -gt 0) {
    throw '-TestPaths is permitted only for FocusedRenderer'
}

Write-Host "WORKSTREAM: $root"
Write-Host "MODE: $Mode"
Write-Host "PROFILE: $Profile"
Write-Host 'DEPENDENCIES: reuse existing node_modules; no npm install or network retrieval'
Write-Host 'RUST CACHE: use existing BUILD-01 shared Cargo wrapper and root target'
Write-Host 'RELEASE: no Tauri build, no portable packaging, no application launch'
Write-Host 'SOURCE AUTHORITY: verify checkout/commit separately before Run; this runner never executes Git'

if ($Profile -eq 'RustCheck') {
    & $sharedCargo -Mode Preview -CargoAction check
    if ($Mode -eq 'Preview') {
        Write-Output 'STATUS: EOD_WINDOWS_VALIDATION_PREVIEW_PASS_NO_CHANGES'
        return
    }
}

if ($Profile -ne 'RustCheck') {
    Write-Host 'COMMAND: npm.cmd ls --depth=0 --offline'
    Write-Host 'COMMAND: npm.cmd run typecheck:renderer'
    if ($Profile -eq 'FocusedRenderer') {
        Write-Host ('COMMAND: npm.cmd test -- ' + ($paths -join ' '))
    }
    if ($Profile -eq 'FullRenderer') {
        Write-Host 'COMMAND: npm.cmd test'
    }
    Write-Host 'COMMAND: npm.cmd run build:renderer'
}

if ($Mode -eq 'Preview') {
    Write-Output 'STATUS: EOD_WINDOWS_VALIDATION_PREVIEW_PASS_NO_CHANGES'
    return
}

if ($Profile -ne 'RustCheck') {
    if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules') -PathType Container)) {
        throw 'Existing node_modules missing. No installation is performed by this runner.'
    }
    $npm = Get-Command 'npm.cmd' -CommandType Application -ErrorAction Stop
}

function Invoke-CheckedNpm([string[]]$CommandArguments) {
    Write-Host ('RUN: npm.cmd ' + ($CommandArguments -join ' '))
    & $npm.Source @CommandArguments
    $code = $LASTEXITCODE
    if ($null -eq $code) { throw 'npm exit code unavailable' }
    if ($code -ne 0) { throw "npm command failed with exit code $code" }
}

# Evidence is retained; never place logs under the protected disposable scratch prefix.
$evidenceRoot = Join-Path $tmp 'validation-workspace'
if (Test-Path -LiteralPath $evidenceRoot) {
    if (-not (Test-Path -LiteralPath $evidenceRoot -PathType Container)) {
        throw "Evidence root is not a directory: $evidenceRoot"
    }
    if (((Get-Item -LiteralPath $evidenceRoot -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Evidence root is a reparse point: $evidenceRoot"
    }
}
if (-not (Test-Path -LiteralPath $evidenceRoot)) {
    $null = New-Item -ItemType Directory -Path $evidenceRoot -ErrorAction Stop
}
$istZone = [TimeZoneInfo]::FindSystemTimeZoneById('India Standard Time')
$ist = [TimeZoneInfo]::ConvertTimeFromUtc([datetime]::UtcNow,$istZone)
$runId = $ist.ToString('yyyy-MM-dd_HHmmss_IST') + '_' + [guid]::NewGuid().ToString('N').Substring(0,8)
$evidence = Join-Path $evidenceRoot $runId
$null = New-Item -ItemType Directory -Path $evidence -ErrorAction Stop
$log = Join-Path $evidence 'validation-transcript.txt'

$oldLocation = Get-Location
$transcriptStarted = $false
try {
    Start-Transcript -LiteralPath $log -NoClobber -ErrorAction Stop | Out-Null
    $transcriptStarted = $true
    Set-Location -LiteralPath $root
    Write-Host "EVIDENCE: $log"
    if ($Profile -eq 'RustCheck') {
        & $sharedCargo -Mode Run -CargoAction check
    }
    if ($Profile -ne 'RustCheck') {
        Invoke-CheckedNpm -CommandArguments @('ls','--depth=0','--offline')
        Invoke-CheckedNpm -CommandArguments @('run','typecheck:renderer')
        if ($Profile -eq 'FocusedRenderer') {
            Invoke-CheckedNpm -CommandArguments (@('test','--') + $paths.ToArray())
        }
        if ($Profile -eq 'FullRenderer') {
            Invoke-CheckedNpm -CommandArguments @('test')
        }
        Invoke-CheckedNpm -CommandArguments @('run','build:renderer')
    }
    Write-Output 'STATUS: EOD_WINDOWS_VALIDATION_RUN_PASS'
}
catch {
    Write-Host ('STATUS: EOD_WINDOWS_VALIDATION_RUN_FAIL: ' + $_.Exception.Message)
    throw
}
finally {
    Set-Location -LiteralPath $oldLocation.Path
    if ($transcriptStarted) { Stop-Transcript | Out-Null }
}
Write-Host ('EVIDENCE_SHA256: ' + (Get-FileHash -LiteralPath $log -Algorithm SHA256).Hash)
