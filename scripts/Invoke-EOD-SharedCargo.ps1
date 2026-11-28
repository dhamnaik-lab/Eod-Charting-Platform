#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter()][ValidateSet('Preview','Run','CachePreview')][string]$Mode = 'Preview',
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
$targetBudget = 25GB
$minimumFree = 8GB

if ($Mode -eq 'CachePreview' -and $CargoArguments.Count -gt 0) {
    throw 'CachePreview uses a fixed Cargo package/profile scope and does not accept CargoArguments.'
}

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

function Get-SharedTargetUsage {
    param([Parameter(Mandatory)][string]$TargetPath)

    $options = [System.IO.EnumerationOptions]::new()
    $options.AttributesToSkip = [IO.FileAttributes]::ReparsePoint
    $options.IgnoreInaccessible = $false
    $options.RecurseSubdirectories = $true

    [long]$bytes = 0
    foreach ($file in ([IO.DirectoryInfo]::new($TargetPath)).EnumerateFiles('*', $options)) {
        $bytes += $file.Length
    }

    $drive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($TargetPath))
    return [pscustomobject]@{ LogicalBytes = $bytes; FreeBytes = $drive.AvailableFreeSpace }
}

function Get-SharedTargetBudgetViolations {
    param([long]$LogicalBytes, [long]$FreeBytes, [long]$TargetBudget, [long]$MinimumFree)

    if ($LogicalBytes -ge $TargetBudget) {
        'shared target is at or above its size budget'
    }
    if ($FreeBytes -lt $MinimumFree) {
        'the target drive is below its free-space reserve'
    }
}

function Get-NormalizedFullPath {
    param([Parameter(Mandatory)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Test-IsOrdinaryDirectory {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return $false }
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $false }
    return $true
}

function Test-IsOrdinaryFile {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $false }
    return $true
}

function Get-RetainedHistoricalTargetSpecs {
    param([Parameter(Mandatory)][string]$TmpRoot)
    return @(
        [PSCustomObject]@{
            Id = 'PR102_NATIVE_WINDOWS_6CE03BE'
            TargetPath = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'fixtures\pr102-native-windows-6ce03be\source\target')
            OwnerRoot = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'fixtures\pr102-native-windows-6ce03be\source')
            RequiredManifest = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'fixtures\pr102-native-windows-6ce03be\source\src-tauri-shell\Cargo.toml')
            RequiredEvidencePath = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'fixtures\pr102-native-windows-6ce03be\pre-fast-forward-local-audit.md')
            RequiredEvidenceKind = 'File'
        }
        [PSCustomObject]@{
            Id = 'EOD_F30_PR118_ACCEPTANCE_20261118_HTTPS_RETRY_IST'
            TargetPath = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'EOD_F30_PR118_Acceptance_20261118_HTTPS_RETRY_IST\worktree\target')
            OwnerRoot = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'EOD_F30_PR118_Acceptance_20261118_HTTPS_RETRY_IST\worktree')
            RequiredManifest = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'EOD_F30_PR118_Acceptance_20261118_HTTPS_RETRY_IST\worktree\src-tauri-shell\Cargo.toml')
            RequiredEvidencePath = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'EOD_F30_PR118_Acceptance_20261118_HTTPS_RETRY_IST\evidence')
            RequiredEvidenceKind = 'Directory'
        }
        [PSCustomObject]@{
            Id = 'EOD_F30_PR118_PRICESCALEFIX_20261118_ALLOWED_DOCS_IST'
            TargetPath = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'EOD_F30_PR118_PriceScaleFix_20261118_ALLOWED_DOCS_IST\worktree\target')
            OwnerRoot = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'EOD_F30_PR118_PriceScaleFix_20261118_ALLOWED_DOCS_IST\worktree')
            RequiredManifest = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'EOD_F30_PR118_PriceScaleFix_20261118_ALLOWED_DOCS_IST\worktree\src-tauri-shell\Cargo.toml')
            RequiredEvidencePath = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'EOD_F30_PR118_PriceScaleFix_20261118_ALLOWED_DOCS_IST\evidence')
            RequiredEvidenceKind = 'Directory'
        }
        [PSCustomObject]@{
            Id = 'F52_WINDOWS_NATIVE_ACCEPTANCE_20261116_102754_IST'
            TargetPath = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'F52_Windows_Native_Acceptance_20261116_102754_IST\pr-source\target')
            OwnerRoot = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'F52_Windows_Native_Acceptance_20261116_102754_IST\pr-source')
            RequiredManifest = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'F52_Windows_Native_Acceptance_20261116_102754_IST\pr-source\src-tauri-shell\Cargo.toml')
            RequiredEvidencePath = Get-NormalizedFullPath -Path (Join-Path $TmpRoot 'F52_Windows_Native_Acceptance_20261116_102754_IST\F52_Windows_Native_Acceptance_20261116_102754_IST.md')
            RequiredEvidenceKind = 'File'
        }
    )
}

function Test-IsAuthorizedSharedTargetJunction {
    param(
        [Parameter(Mandatory)]$Candidate,
        [Parameter(Mandatory)][string]$TmpRoot,
        [Parameter(Mandatory)][string]$AuthorizedTarget
    )
    if ($Candidate.Name -ine 'target') { return $false }
    if (($Candidate.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) { return $false }
    if ($Candidate.PSObject.Properties.Match('LinkType').Count -eq 0) { return $false }
    if ($Candidate.LinkType -cne 'Junction') { return $false }
    if ($Candidate.PSObject.Properties.Match('Target').Count -eq 0) { return $false }
    if ($null -eq $Candidate.Target) { return $false }

    $targets = @($Candidate.Target | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
    if ($targets.Count -ne 1) { return $false }
    $rawTarget = [string]$targets[0]
    if (-not [System.IO.Path]::IsPathFullyQualified($rawTarget)) { return $false }

    $normalizedDestination = Get-NormalizedFullPath -Path $rawTarget
    $normalizedAuthorizedTarget = Get-NormalizedFullPath -Path $AuthorizedTarget
    if ($normalizedDestination -ine $normalizedAuthorizedTarget) { return $false }

    $candidatePath = Get-NormalizedFullPath -Path $Candidate.FullName
    $normalizedTmpPrefix = (Get-NormalizedFullPath -Path $TmpRoot) + '\'
    if (-not $candidatePath.StartsWith($normalizedTmpPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { return $false }

    $parentDir = Split-Path -Parent $candidatePath
    if (-not (Test-IsOrdinaryDirectory -Path $parentDir)) { return $false }
    $manifestInParent = Join-Path $parentDir 'src-tauri-shell\Cargo.toml'
    if (-not (Test-IsOrdinaryFile -Path $manifestInParent)) { return $false }
    return $true
}

function Test-IsRetainedHistoricalTarget {
    param(
        [Parameter(Mandatory)]$Candidate,
        [Parameter(Mandatory)][object[]]$RetainedSpecs
    )
    if (($Candidate.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $false }
    $candidatePath = Get-NormalizedFullPath -Path $Candidate.FullName
    $matchedSpec = $null
    foreach ($spec in $RetainedSpecs) {
        if ($spec.TargetPath -ieq $candidatePath) {
            $matchedSpec = $spec
            break
        }
    }
    if ($null -eq $matchedSpec) { return $false }
    if (-not (Test-IsOrdinaryDirectory -Path $matchedSpec.OwnerRoot)) { return $false }
    if (-not (Test-IsOrdinaryFile -Path $matchedSpec.RequiredManifest)) { return $false }
    if ($matchedSpec.RequiredEvidenceKind -ceq 'File' -and -not (Test-IsOrdinaryFile -Path $matchedSpec.RequiredEvidencePath)) { return $false }
    if ($matchedSpec.RequiredEvidenceKind -ceq 'Directory' -and -not (Test-IsOrdinaryDirectory -Path $matchedSpec.RequiredEvidencePath)) { return $false }
    return $true
}

function Find-TmpCargoTargetCandidates {
    param([Parameter(Mandatory)][string]$TmpRoot)
    $candidates = [System.Collections.Generic.List[object]]::new()
    $pending = [System.Collections.Generic.Stack[string]]::new()
    $pending.Push((Get-NormalizedFullPath -Path $TmpRoot))

    while ($pending.Count -gt 0) {
        $currentDir = $pending.Pop()
        foreach ($dir in @(Get-ChildItem -LiteralPath $currentDir -Directory -Force -ErrorAction Stop)) {
            $isNamed = ($dir.Name -ieq 'target' -or $dir.Name -ieq 'cargo-target' -or $dir.Name -ieq 'rust-target')
            $isReparse = (($dir.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)
            $hasDeps = $false
            if ($isNamed) {
                $hasDeps = (Test-Path -LiteralPath (Join-Path $dir.FullName 'debug\deps') -PathType Container) -or
                    (Test-Path -LiteralPath (Join-Path $dir.FullName 'release\deps') -PathType Container)
            }
            if ($isNamed -and ($isReparse -or $hasDeps)) {
                $candidates.Add($dir)
                continue
            }
            if ($isReparse) { continue }
            if ($dir.Name -ieq '.git' -or $dir.Name -ieq 'node_modules') { continue }
            $pending.Push($dir.FullName)
        }
    }

    return @($candidates)
}

function Get-SecondaryCargoTargetViolations {
    param(
        [Parameter()][AllowNull()][AllowEmptyCollection()][object[]]$Candidates = @(),
        [Parameter(Mandatory)][string]$TmpRoot,
        [Parameter(Mandatory)][string]$AuthorizedTarget,
        [Parameter(Mandatory)][object[]]$RetainedSpecs
    )
    if ($null -eq $Candidates) { return @() }
    $violations = [System.Collections.Generic.List[string]]::new()
    foreach ($candidate in $Candidates) {
        if ($null -eq $candidate) { continue }
        if (Test-IsAuthorizedSharedTargetJunction -Candidate $candidate -TmpRoot $TmpRoot -AuthorizedTarget $AuthorizedTarget) {
            continue
        }
        if (Test-IsRetainedHistoricalTarget -Candidate $candidate -RetainedSpecs $RetainedSpecs) {
            continue
        }
        $violations.Add($candidate.FullName)
    }
    return @($violations)
}

# Read-only identification of secondary Cargo build trees in tmp; preserve verified shared-target junctions
# and narrowly scoped retained historical acceptance archives, while rejecting unknown targets or unsafe links.
$retainedHistoricalSpecs = @(Get-RetainedHistoricalTargetSpecs -TmpRoot $tmp)
$tmpCandidates = @(Find-TmpCargoTargetCandidates -TmpRoot $tmp)
$secondary = @(Get-SecondaryCargoTargetViolations `
    -Candidates $tmpCandidates `
    -TmpRoot $tmp `
    -AuthorizedTarget $target `
    -RetainedSpecs $retainedHistoricalSpecs)
if ($secondary.Count -gt 0) { throw "Secondary Cargo artifact roots detected in tmp: $($secondary -join '; ')" }

$pinnedArgs = @('--offline','--locked','--manifest-path',$manifest,'--target-dir',$target)
$commandArgs = @($CargoAction) + $pinnedArgs + $CargoArguments
if ($Mode -eq 'CachePreview') {
    $commandArgs = @('clean') + $pinnedArgs + @('--profile','dev','--package','eod-charting-platform-shell','--dry-run')
}
Write-Host "WORKSTREAM: $root"
Write-Host "MODE: $Mode"
Write-Host "CARGO ACTION: $($commandArgs[0])"
Write-Host "SHARED TARGET: $target"
Write-Host 'DEPENDENCY POLICY: --offline --locked; no custom rustflags or incremental overrides introduced.'
Write-Host ('COMMAND: cargo ' + ($commandArgs -join ' '))

$usage = Get-SharedTargetUsage -TargetPath $target
Write-Host ('TARGET LOGICAL SIZE: {0:F2} GiB / {1:F0} GiB budget' -f ($usage.LogicalBytes / 1GB), ($targetBudget / 1GB))
Write-Host ('TARGET DRIVE FREE: {0:F2} GiB / {1:F0} GiB reserve' -f ($usage.FreeBytes / 1GB), ($minimumFree / 1GB))
$violations = @(Get-SharedTargetBudgetViolations -LogicalBytes $usage.LogicalBytes -FreeBytes $usage.FreeBytes -TargetBudget $targetBudget -MinimumFree $minimumFree)
if ($violations.Count -gt 0) {
    $budgetMessage = "Shared Cargo build paused: $($violations -join '; '). Review the scoped cleanup with -Mode CachePreview."
    if ($Mode -eq 'Run') { throw $budgetMessage }
    Write-Warning $budgetMessage
}

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
if ($Mode -eq 'CachePreview') {
    Write-Output 'STATUS: BUILD01_SHARED_CARGO_CACHE_PREVIEW_PASS_NO_ARTIFACT_DELETION'
    return
}
Write-Output 'STATUS: BUILD01_SHARED_CARGO_COMMAND_PASS'
