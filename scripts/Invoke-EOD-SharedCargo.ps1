#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter()][ValidateSet('Preview','Run')][string]$Mode = 'Preview',
    [Parameter()][ValidateSet('check','test','build')][string]$CargoAction = 'check',
    [Parameter()][string[]]$CargoArguments = @()
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# BUILD-01: normal project checks/builds share one root target; this script NEVER deletes caches.
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$authorized = 'E:\TA Projects\EOD Charting Platform'
$target = Join-Path $root 'target'
$manifest = Join-Path $root 'src-tauri-shell\Cargo.toml'
$config = Join-Path $root '.cargo\config.toml'
$tmp = Join-Path $root 'tmp'

if ($root -cne $authorized) { throw "Wrong workstream root: $root" }
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { throw "Missing Rust manifest: $manifest" }
if (-not (Test-Path -LiteralPath $config -PathType Leaf)) { throw "Missing Cargo configuration: $config" }
if (-not (Test-Path -LiteralPath $target -PathType Container)) { throw "Shared Cargo target missing: $target" }
if (-not (Test-Path -LiteralPath $tmp -PathType Container)) { throw "Project tmp directory missing: $tmp" }
if ((Get-Item -LiteralPath $root).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Project root is a reparse point' }
if ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Shared target is a reparse point' }

$configContent = Get-Content -LiteralPath $config -Raw -ErrorAction Stop
if ($configContent -notmatch '(?m)^\s*target-dir\s*=\s*"target"\s*$') { throw 'Expected project Cargo config target-dir="target"' }

foreach ($name in @('CARGO_TARGET_DIR','CARGO_BUILD_TARGET_DIR')) {
    $value = [Environment]::GetEnvironmentVariable($name,'Process')
    if (-not [string]::IsNullOrWhiteSpace($value)) {
        $resolved = $value
        if (-not [IO.Path]::IsPathFullyQualified($value)) { $resolved = Join-Path $root $value }
        $resolved = [IO.Path]::GetFullPath($resolved).TrimEnd('\')
        if ($resolved -ine $target) { throw "Conflicting $name detected: $value" }
    }
}
if (-not [string]::IsNullOrWhiteSpace($env:CARGO_BUILD_BUILD_DIR)) {
    throw 'CARGO_BUILD_BUILD_DIR override detected; refuse potentially separate intermediate cache.'
}

foreach ($argument in $CargoArguments) {
    if ($argument -match '^(?i:--target-dir|--manifest-path|--config|--build-dir)(?:=|$)' -or
        $argument -match '^(?i:-Z)(?:$|.+)') {
        throw "Unsupported Cargo override in routine shared build: $argument"
    }
}

# Read-only identification of new nested Cargo build trees; do not inspect file contents.
# The already-retained PR #102 acceptance archive is evidence. Cargo still writes only to $target.
$retainedPr102Target = Join-Path $tmp 'fixtures\pr102-native-windows-6ce03be\source\target'
$secondary = @(Get-ChildItem -LiteralPath $tmp -Directory -Recurse -Force -ErrorAction Stop |
    Where-Object {
        $_.FullName -ine $retainedPr102Target -and
        ($_.Name -eq 'target' -or $_.Name -eq 'cargo-target' -or $_.Name -eq 'rust-target') -and
        ((Test-Path -LiteralPath (Join-Path $_.FullName 'debug\deps') -PathType Container) -or
         (Test-Path -LiteralPath (Join-Path $_.FullName 'release\deps') -PathType Container))
    } | Select-Object -ExpandProperty FullName)
if ($secondary.Count -gt 0) { throw "Secondary Cargo artifact roots detected in tmp: $($secondary -join '; ')" }

$commandArgs = @($CargoAction,'--offline','--locked','--manifest-path',$manifest,'--target-dir',$target) + @($CargoArguments)
Write-Host "WORKSTREAM: $root"
Write-Host "MODE: $Mode"
Write-Host "CARGO ACTION: $CargoAction"
Write-Host "SHARED TARGET: $target"
Write-Host 'DEPENDENCY POLICY: --offline --locked; no custom rustflags or incremental overrides introduced.'
Write-Host ('COMMAND: cargo ' + ($commandArgs -join ' '))

if ($Mode -eq 'Preview') {
    Write-Output 'STATUS: BUILD01_SHARED_CARGO_PREVIEW_PASS_NO_BUILD_NO_CHANGES'
    return
}

$active = @(Get-Process -Name @('cargo','rustc','rustdoc','cl','link','lld-link') -ErrorAction SilentlyContinue)
if ($active.Count -gt 0) { throw "Another build process is active: $($active.ProcessName -join ', ')" }
$cargo = Get-Command 'cargo.exe' -CommandType Application -ErrorAction Stop
$oldLocation = Get-Location
try {
    Set-Location -LiteralPath $root
    & $cargo.Source @commandArgs
    $resultCode = $LASTEXITCODE
    if ($null -eq $resultCode) { throw 'Cargo exit status unavailable' }
    if ($resultCode -ne 0) { throw "Cargo exited $resultCode" }
}
finally {
    Set-Location -LiteralPath $oldLocation.Path
}
Write-Output 'STATUS: BUILD01_SHARED_CARGO_COMMAND_PASS'
