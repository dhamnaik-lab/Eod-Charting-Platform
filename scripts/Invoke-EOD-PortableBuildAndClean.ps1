#requires -Version 7.0
[CmdletBinding(SupportsShouldProcess)]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$authorizedRoot = 'E:\TA Projects\EOD Charting Platform'
$targetRoot = Join-Path $root 'target'
$releaseTarget = Join-Path $targetRoot 'release'
$portableBase = Join-Path $root 'release\tauri-portable-win'
$sourceExe = Join-Path $releaseTarget 'eod-charting-platform-shell.exe'

function Assert-OrdinaryDirectory {
    param([string]$Path)

    $item = Get-Item -LiteralPath $Path -Force
    if ($item -isnot [IO.DirectoryInfo] -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Expected an ordinary directory: $Path"
    }
}

function Assert-NoActiveRustBuild {
    $active = @(Get-Process -Name @('cargo','rustc','rustdoc','cl','link','lld-link') -ErrorAction SilentlyContinue)
    if ($active.Count -gt 0) {
        throw "Another build process is active: $($active.ProcessName -join ', ')"
    }
}

function Assert-ReleaseTargetSafe {
    Assert-OrdinaryDirectory $root
    Assert-OrdinaryDirectory $targetRoot
    Assert-OrdinaryDirectory $releaseTarget
    $linked = Get-ChildItem -LiteralPath $releaseTarget -Force -Recurse -Attributes ReparsePoint |
        Select-Object -First 1
    if ($null -ne $linked) { throw "Release target contains a reparse point: $($linked.FullName)" }
}

if ($root -cne $authorizedRoot) { throw "Wrong workstream root: $root" }
foreach ($name in @('CARGO_TARGET_DIR','CARGO_BUILD_TARGET_DIR','CARGO_BUILD_BUILD_DIR','CARGO_BUILD_TARGET')) {
    if ([Environment]::GetEnvironmentVariable($name, 'Process')) {
        throw "Clear $name before using the portable build with release cleanup."
    }
}

if (!$PSCmdlet.ShouldProcess($releaseTarget, 'Build and stage the portable app, then remove this release artifact tree after verification')) {
    return
}

Assert-OrdinaryDirectory $root
foreach ($directory in @((Join-Path $root 'release'), $portableBase, (Join-Path $portableBase 'EOD Chart Portable'))) {
    if (Test-Path -LiteralPath $directory) { Assert-OrdinaryDirectory $directory }
}
if (Test-Path -LiteralPath $targetRoot) { Assert-OrdinaryDirectory $targetRoot }
if (Test-Path -LiteralPath $releaseTarget) { Assert-ReleaseTargetSafe }
Assert-NoActiveRustBuild

Push-Location -LiteralPath $root
try {
    & npm.cmd run tauri:build
    if ($LASTEXITCODE -ne 0) { throw "Tauri build exited $LASTEXITCODE. Release cleanup skipped." }

    $finalRoot = & (Join-Path $PSScriptRoot 'prepare-tauri-portable.ps1')
    $finalRoot = [IO.Path]::GetFullPath([string]$finalRoot)
    if ([IO.Path]::GetDirectoryName($finalRoot) -ine $portableBase) {
        throw "Unexpected final portable directory: $finalRoot"
    }
    Assert-OrdinaryDirectory (Join-Path $root 'release')
    Assert-OrdinaryDirectory $portableBase
    Assert-OrdinaryDirectory $finalRoot
    Assert-ReleaseTargetSafe

    $finalExe = Join-Path $finalRoot 'EOD Chart.exe'
    foreach ($exe in @($sourceExe, $finalExe)) {
        $exeItem = Get-Item -LiteralPath $exe -Force
        if ($exeItem -isnot [IO.FileInfo] -or ($exeItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Expected an ordinary executable: $exe"
        }
    }
    $sourceHash = (Get-FileHash -LiteralPath $sourceExe -Algorithm SHA256).Hash
    $finalHash = (Get-FileHash -LiteralPath $finalExe -Algorithm SHA256).Hash
    if ($sourceHash -ne $finalHash) { throw "Final portable executable hash mismatch: $finalExe" }

    Write-Host "Portable EXE verified: $finalExe (SHA-256 $finalHash)"
    Assert-NoActiveRustBuild
    Write-Host "Removing release build artifacts: $releaseTarget"
    Remove-Item -LiteralPath $releaseTarget -Recurse -Force -ErrorAction Stop
    Write-Host 'Release cleanup complete.'
    Write-Output $finalRoot
}
finally {
    Pop-Location
}
