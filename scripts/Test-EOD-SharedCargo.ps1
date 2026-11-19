#requires -Version 7.0
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$authorizedRoot = 'E:\TA Projects\EOD Charting Platform'
if ($root -cne $authorizedRoot) {
    throw "Wrong workstream root: $root"
}

$sharedCargoScript = Join-Path $PSScriptRoot 'Invoke-EOD-SharedCargo.ps1'
$selfScript = $PSCommandPath
$authorizedTarget = Join-Path $root 'target'
$tmpRoot = Join-Path $root 'tmp'

$results = [System.Collections.Generic.List[object]]::new()

function Add-TestResult {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][bool]$Passed,
        [Parameter(Mandatory)][AllowEmptyString()][string]$Detail
    )

    $status = 'FAIL'
    if ($Passed) {
        $status = 'PASS'
    }

    $results.Add([PSCustomObject]@{
        Test = $Name
        Status = $status
        Detail = $Detail
    })

    if (-not $Passed) {
        throw "BUILD-01 shared Cargo test failed: $Name - $Detail"
    }
}

function Test-NoElseBranches {
    param([Parameter(Mandatory)][string]$ScriptPath)

    $tokens = $null
    $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        $ScriptPath,
        [ref]$tokens,
        [ref]$parseErrors
    )

    $ifViolations = @()
    if ($parseErrors.Count -eq 0) {
        $ifViolations = @($ast.FindAll(
            {
                param($node)
                if (-not ($node -is [System.Management.Automation.Language.IfStatementAst])) {
                    return $false
                }
                return ($node.Clauses.Count -gt 1) -or ($null -ne $node.ElseClause)
            },
            $true
        ))
    }

    return [PSCustomObject]@{
        Ast = $ast
        ParseErrorCount = $parseErrors.Count
        ElseBranchCount = $ifViolations.Count
        Passed = ($parseErrors.Count -eq 0 -and $ifViolations.Count -eq 0)
    }
}

function Get-SharedCargoHelperScriptBlock {
    param([Parameter(Mandatory)]$Ast)

    $functionNames = @(
        'Get-NormalizedFullPath',
        'Test-IsOrdinaryDirectory',
        'Test-IsOrdinaryFile',
        'Get-RetainedHistoricalTargetSpecs',
        'Test-IsAuthorizedSharedTargetJunction',
        'Test-IsRetainedHistoricalTarget',
        'Find-TmpCargoTargetCandidates',
        'Get-SecondaryCargoTargetViolations'
    )

    $definitions = [System.Collections.Generic.List[string]]::new()
    foreach ($functionName in $functionNames) {
        $definition = $Ast.Find(
            {
                param($node)
                return $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
                    $node.Name -eq $functionName
            },
            $true
        )
        if ($null -eq $definition) {
            throw "Expected helper function missing from Invoke-EOD-SharedCargo.ps1: $functionName"
        }
        $definitions.Add($definition.Extent.Text)
    }

    $combinedSource = $definitions -join ([Environment]::NewLine + [Environment]::NewLine)
    return [scriptblock]::Create($combinedSource)
}

function New-SyntheticCandidate {
    param(
        [Parameter(Mandatory)][string]$FullName,
        [Parameter(Mandatory)][System.IO.FileAttributes]$Attributes,
        [Parameter()][AllowEmptyString()][string]$LinkType = '',
        [Parameter()][AllowEmptyCollection()][string[]]$Targets = @()
    )

    $name = Split-Path -Path $FullName -Leaf
    return [PSCustomObject]@{
        FullName = $FullName
        Name = $name
        Attributes = $Attributes
        LinkType = $LinkType
        Target = $Targets
    }
}

function Test-PowerShell7ExecutableCandidate {
    param([Parameter()][AllowEmptyString()][string]$CandidatePath)

    if ([string]::IsNullOrWhiteSpace($CandidatePath)) {
        return $false
    }
    if (-not [System.IO.Path]::IsPathFullyQualified($CandidatePath)) {
        return $false
    }

    $normalizedPath = [System.IO.Path]::GetFullPath($CandidatePath)
    $leafName = [System.IO.Path]::GetFileName($normalizedPath)
    if ($leafName -ine 'pwsh.exe') {
        return $false
    }
    if (-not (Test-Path -LiteralPath $normalizedPath -PathType Leaf)) {
        return $false
    }

    $probeStartInfo = New-Object System.Diagnostics.ProcessStartInfo
    $probeStartInfo.FileName = $normalizedPath
    $probeStartInfo.WorkingDirectory = $root
    $probeStartInfo.UseShellExecute = $false
    $probeStartInfo.RedirectStandardOutput = $true
    $probeStartInfo.RedirectStandardError = $true
    $probeStartInfo.ArgumentList.Add('-NoLogo')
    $probeStartInfo.ArgumentList.Add('-NoProfile')
    $probeStartInfo.ArgumentList.Add('-Command')
    $probeStartInfo.ArgumentList.Add('$PSVersionTable.PSVersion.Major')

    $probeProcess = New-Object System.Diagnostics.Process
    $probeProcess.StartInfo = $probeStartInfo
    try {
        if (-not $probeProcess.Start()) {
            return $false
        }
        $probeStdout = $probeProcess.StandardOutput.ReadToEnd()
        $null = $probeProcess.StandardError.ReadToEnd()
        $probeProcess.WaitForExit()
        if ($probeProcess.ExitCode -ne 0) {
            return $false
        }
        if ([string]::IsNullOrWhiteSpace($probeStdout)) {
            return $false
        }
        [int]$majorVersion = 0
        if (-not [int]::TryParse($probeStdout.Trim(), [ref]$majorVersion)) {
            return $false
        }
        return ($majorVersion -ge 7)
    }
    catch {
        return $false
    }
    finally {
        $probeProcess.Dispose()
    }
}

function Resolve-PowerShell7Executable {
    $candidates = [System.Collections.Generic.List[string]]::new()
    $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    if (-not [string]::IsNullOrWhiteSpace($PSHOME)) {
        $psHomeCandidate = Join-Path $PSHOME 'pwsh.exe'
        if ([System.IO.Path]::IsPathFullyQualified($psHomeCandidate)) {
            $normalizedPsHome = [System.IO.Path]::GetFullPath($psHomeCandidate)
            if ($seen.Add($normalizedPsHome)) {
                $candidates.Add($normalizedPsHome)
            }
        }
    }

    $currentProcess = Get-Process -Id $PID -ErrorAction SilentlyContinue
    if ($null -ne $currentProcess -and $currentProcess.PSObject.Properties.Match('Path').Count -gt 0) {
        $processPath = [string]$currentProcess.Path
        if (-not [string]::IsNullOrWhiteSpace($processPath) -and [System.IO.Path]::IsPathFullyQualified($processPath)) {
            if ([System.IO.Path]::GetFileName($processPath) -ieq 'pwsh.exe') {
                $normalizedProcessPath = [System.IO.Path]::GetFullPath($processPath)
                if ($seen.Add($normalizedProcessPath)) {
                    $candidates.Add($normalizedProcessPath)
                }
            }
        }
    }

    $commandMatches = @(Get-Command 'pwsh.exe' -CommandType Application -All -ErrorAction SilentlyContinue)
    foreach ($commandMatch in $commandMatches) {
        if ($null -eq $commandMatch) {
            continue
        }
        if ($commandMatch.PSObject.Properties.Match('Source').Count -eq 0) {
            continue
        }
        $sourcePath = [string]$commandMatch.Source
        if ([string]::IsNullOrWhiteSpace($sourcePath)) {
            continue
        }
        if (-not [System.IO.Path]::IsPathFullyQualified($sourcePath)) {
            continue
        }
        $normalizedSource = [System.IO.Path]::GetFullPath($sourcePath)
        if ($seen.Add($normalizedSource)) {
            $candidates.Add($normalizedSource)
        }
    }

    $verifiedMatches = [System.Collections.Generic.List[string]]::new()
    foreach ($candidate in $candidates) {
        if (Test-PowerShell7ExecutableCandidate -CandidatePath $candidate) {
            $verifiedMatches.Add([string]$candidate)
            break
        }
    }

    if ($verifiedMatches.Count -ne 1) {
        throw "Unable to resolve exactly one verified PowerShell 7 executable. Candidates checked: $($candidates -join '; ')"
    }

    return [string]$verifiedMatches[0]
}

function Invoke-SharedCargoPreviewSubprocess {
    param(
        [Parameter()][AllowEmptyCollection()][string[]]$CargoArguments = @(),
        [Parameter()][hashtable]$EnvironmentOverrides = @{},
        [Parameter()][AllowEmptyString()][string]$PwshExecutable = ''
    )

    $resolvedPwsh = $PwshExecutable
    if ([string]::IsNullOrWhiteSpace($resolvedPwsh)) {
        $resolvedPwsh = Resolve-PowerShell7Executable
    }
    if (-not [System.IO.Path]::IsPathFullyQualified($resolvedPwsh) -or
        ([System.IO.Path]::GetFileName($resolvedPwsh) -ine 'pwsh.exe') -or
        -not (Test-Path -LiteralPath $resolvedPwsh -PathType Leaf)) {
        throw "Invalid PowerShell 7 executable path: $resolvedPwsh"
    }

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $resolvedPwsh
    $startInfo.WorkingDirectory = $root
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $null = $startInfo.Environment.Remove('CARGO_TARGET_DIR')
    $null = $startInfo.Environment.Remove('CARGO_BUILD_TARGET_DIR')
    $null = $startInfo.Environment.Remove('CARGO_BUILD_BUILD_DIR')
    foreach ($key in $EnvironmentOverrides.Keys) {
        $startInfo.Environment[$key] = [string]$EnvironmentOverrides[$key]
    }

    $startInfo.ArgumentList.Add('-NoLogo')
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-ExecutionPolicy')
    $startInfo.ArgumentList.Add('Bypass')

    if ($CargoArguments.Count -eq 0) {
        $startInfo.ArgumentList.Add('-File')
        $startInfo.ArgumentList.Add($sharedCargoScript)
        $startInfo.ArgumentList.Add('-Mode')
        $startInfo.ArgumentList.Add('Preview')
        $startInfo.ArgumentList.Add('-CargoAction')
        $startInfo.ArgumentList.Add('check')
    }

    if ($CargoArguments.Count -gt 0) {
        $quotedArgs = @($CargoArguments | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }) -join ', '
        $escapedScript = $sharedCargoScript.Replace("'", "''")
        $commandText = "& '$escapedScript' -Mode Preview -CargoAction check -CargoArguments @($quotedArgs)"
        $startInfo.ArgumentList.Add('-Command')
        $startInfo.ArgumentList.Add($commandText)
    }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    try {
        if (-not $process.Start()) {
            throw "Failed to launch PowerShell 7 subprocess: $resolvedPwsh"
        }
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        $process.WaitForExit()

        return [PSCustomObject]@{
            ExitCode = $process.ExitCode
            Output = ($stdout + [Environment]::NewLine + $stderr).Trim()
        }
    }
    finally {
        $process.Dispose()
    }
}

try {
    $sharedAstCheck = Test-NoElseBranches -ScriptPath $sharedCargoScript
    Add-TestResult `
        -Name 'Wrapper AST parse and guard-clause policy' `
        -Passed $sharedAstCheck.Passed `
        -Detail "parseErrors=$($sharedAstCheck.ParseErrorCount), elseBranches=$($sharedAstCheck.ElseBranchCount)"

    $selfAstCheck = Test-NoElseBranches -ScriptPath $selfScript
    Add-TestResult `
        -Name 'Test script AST parse and guard-clause policy' `
        -Passed $selfAstCheck.Passed `
        -Detail "parseErrors=$($selfAstCheck.ParseErrorCount), elseBranches=$($selfAstCheck.ElseBranchCount)"

    $helperScriptBlock = Get-SharedCargoHelperScriptBlock -Ast $sharedAstCheck.Ast
    if ($null -eq $helperScriptBlock) {
        throw 'Failed to construct helper script block from Invoke-EOD-SharedCargo.ps1'
    }
    . $helperScriptBlock

    $retainedSpecs = @(Get-RetainedHistoricalTargetSpecs -TmpRoot $tmpRoot)
    $liveCandidates = @(Find-TmpCargoTargetCandidates -TmpRoot $tmpRoot)
    $liveCandidatePaths = @($liveCandidates | ForEach-Object { Get-NormalizedFullPath -Path $_.FullName })

    $expectedJunctions = @(
        (Get-NormalizedFullPath -Path (Join-Path $tmpRoot 'UX_Audit_Completion_20261117_IST\target')),
        (Get-NormalizedFullPath -Path (Join-Path $tmpRoot 'UX_Audit_PR116_IA_20261117_IST\target'))
    )
    $expectedRetained = @($retainedSpecs | ForEach-Object { $_.TargetPath })
    $missingExpected = @($expectedJunctions + $expectedRetained | Where-Object { $liveCandidatePaths -notcontains $_ })
    Add-TestResult `
        -Name 'Live tmp inventory discovers both junctions and all four retained historical targets' `
        -Passed ($missingExpected.Count -eq 0) `
        -Detail "discovered=$($liveCandidates.Count), missing=$($missingExpected.Count)"

    $junctionClassificationOk = $true
    foreach ($junctionPath in $expectedJunctions) {
        $candidate = $liveCandidates | Where-Object { (Get-NormalizedFullPath -Path $_.FullName) -ieq $junctionPath } | Select-Object -First 1
        if ($null -eq $candidate) {
            $junctionClassificationOk = $false
            continue
        }
        $isJunctionOk = Test-IsAuthorizedSharedTargetJunction -Candidate $candidate -TmpRoot $tmpRoot -AuthorizedTarget $authorizedTarget
        $isRetained = Test-IsRetainedHistoricalTarget -Candidate $candidate -RetainedSpecs $retainedSpecs
        if (-not $isJunctionOk -or $isRetained) {
            $junctionClassificationOk = $false
        }
    }
    Add-TestResult `
        -Name 'Live UX Audit junctions classify strictly as authorized shared-target aliases' `
        -Passed $junctionClassificationOk `
        -Detail "checked=$($expectedJunctions.Count)"

    $retainedClassificationOk = $true
    foreach ($retainedPath in $expectedRetained) {
        $candidate = $liveCandidates | Where-Object { (Get-NormalizedFullPath -Path $_.FullName) -ieq $retainedPath } | Select-Object -First 1
        if ($null -eq $candidate) {
            $retainedClassificationOk = $false
            continue
        }
        $isJunctionOk = Test-IsAuthorizedSharedTargetJunction -Candidate $candidate -TmpRoot $tmpRoot -AuthorizedTarget $authorizedTarget
        $isRetained = Test-IsRetainedHistoricalTarget -Candidate $candidate -RetainedSpecs $retainedSpecs
        if ($isJunctionOk -or -not $isRetained) {
            $retainedClassificationOk = $false
        }
    }
    Add-TestResult `
        -Name 'Live historical directories classify strictly via verified retention specs' `
        -Passed $retainedClassificationOk `
        -Detail "checked=$($expectedRetained.Count)"

    $liveViolations = @(Get-SecondaryCargoTargetViolations `
        -Candidates $liveCandidates `
        -TmpRoot $tmpRoot `
        -AuthorizedTarget $authorizedTarget `
        -RetainedSpecs $retainedSpecs)
    Add-TestResult `
        -Name 'Live tmp secondary-target check produces zero violations' `
        -Passed ($liveViolations.Count -eq 0) `
        -Detail "violations=$($liveViolations.Count)"

    $validSyntheticJunction = New-SyntheticCandidate `
        -FullName (Join-Path $tmpRoot 'UX_Audit_Completion_20261117_IST\target') `
        -Attributes ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint) `
        -LinkType 'Junction' `
        -Targets @($authorizedTarget)
    $validSyntheticViolations = @(Get-SecondaryCargoTargetViolations `
        -Candidates @($validSyntheticJunction) `
        -TmpRoot $tmpRoot `
        -AuthorizedTarget $authorizedTarget `
        -RetainedSpecs $retainedSpecs)
    Add-TestResult `
        -Name 'Synthetic authorized junction resolving to shared target passes' `
        -Passed ($validSyntheticViolations.Count -eq 0) `
        -Detail "violations=$($validSyntheticViolations.Count)"

    $unsafeJunctionCases = @(
        (New-SyntheticCandidate `
            -FullName (Join-Path $tmpRoot 'UX_Audit_Completion_20261117_IST\target') `
            -Attributes ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint) `
            -LinkType 'Junction' `
            -Targets @('E:\ExternalCargoTarget\target')),
        (New-SyntheticCandidate `
            -FullName (Join-Path $tmpRoot 'UX_Audit_Completion_20261117_IST\target') `
            -Attributes ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint) `
            -LinkType 'Junction' `
            -Targets @((Join-Path $tmpRoot 'unapproved\target'))),
        (New-SyntheticCandidate `
            -FullName (Join-Path $tmpRoot 'UX_Audit_Completion_20261117_IST\target') `
            -Attributes ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint) `
            -LinkType 'Junction' `
            -Targets @()),
        (New-SyntheticCandidate `
            -FullName (Join-Path $tmpRoot 'UX_Audit_Completion_20261117_IST\target') `
            -Attributes ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint) `
            -LinkType 'Junction' `
            -Targets @('..\target')),
        (New-SyntheticCandidate `
            -FullName (Join-Path $tmpRoot 'UX_Audit_Completion_20261117_IST\target') `
            -Attributes ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint) `
            -LinkType 'Junction' `
            -Targets @($authorizedTarget, 'E:\OtherTarget\target')),
        (New-SyntheticCandidate `
            -FullName (Join-Path $tmpRoot 'UX_Audit_Completion_20261117_IST\target') `
            -Attributes ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint) `
            -LinkType 'SymbolicLink' `
            -Targets @($authorizedTarget)),
        (New-SyntheticCandidate `
            -FullName (Join-Path $tmpRoot 'UX_Audit_Completion_20261117_IST\cargo-target') `
            -Attributes ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint) `
            -LinkType 'Junction' `
            -Targets @($authorizedTarget)),
        (New-SyntheticCandidate `
            -FullName (Join-Path $tmpRoot 'validation-workspace\target') `
            -Attributes ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint) `
            -LinkType 'Junction' `
            -Targets @($authorizedTarget))
    )
    $unsafeJunctionViolations = @(Get-SecondaryCargoTargetViolations `
        -Candidates $unsafeJunctionCases `
        -TmpRoot $tmpRoot `
        -AuthorizedTarget $authorizedTarget `
        -RetainedSpecs $retainedSpecs)
    Add-TestResult `
        -Name 'Unsafe, broken, relative, symlink, non-manifest, and misnamed junctions are rejected' `
        -Passed ($unsafeJunctionViolations.Count -eq $unsafeJunctionCases.Count) `
        -Detail "expected=$($unsafeJunctionCases.Count), rejected=$($unsafeJunctionViolations.Count)"

    $spoofedHistoricalJunction = New-SyntheticCandidate `
        -FullName (Join-Path $tmpRoot 'EOD_F30_PR118_Acceptance_20261118_HTTPS_RETRY_IST\worktree\target') `
        -Attributes ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint) `
        -LinkType 'Junction' `
        -Targets @('E:\ExternalSpoofTarget\target')
    $spoofRetainedOk = -not (Test-IsRetainedHistoricalTarget -Candidate $spoofedHistoricalJunction -RetainedSpecs $retainedSpecs)
    $spoofViolations = @(Get-SecondaryCargoTargetViolations `
        -Candidates @($spoofedHistoricalJunction) `
        -TmpRoot $tmpRoot `
        -AuthorizedTarget $authorizedTarget `
        -RetainedSpecs $retainedSpecs)
    Add-TestResult `
        -Name 'Retained historical target path spoofed as unsafe reparse point is rejected' `
        -Passed ($spoofRetainedOk -and $spoofViolations.Count -eq 1) `
        -Detail "retainedRejected=$spoofRetainedOk, violations=$($spoofViolations.Count)"

    $firstRetainedCandidate = New-SyntheticCandidate `
        -FullName $retainedSpecs[1].TargetPath `
        -Attributes ([IO.FileAttributes]::Directory)
    $missingManifestSpec = [PSCustomObject]@{
        Id = $retainedSpecs[1].Id
        TargetPath = $retainedSpecs[1].TargetPath
        OwnerRoot = $retainedSpecs[1].OwnerRoot
        RequiredManifest = Join-Path $tmpRoot 'missing-Cargo.toml'
        RequiredEvidencePath = $retainedSpecs[1].RequiredEvidencePath
        RequiredEvidenceKind = $retainedSpecs[1].RequiredEvidenceKind
    }
    $missingEvidenceSpec = [PSCustomObject]@{
        Id = $retainedSpecs[1].Id
        TargetPath = $retainedSpecs[1].TargetPath
        OwnerRoot = $retainedSpecs[1].OwnerRoot
        RequiredManifest = $retainedSpecs[1].RequiredManifest
        RequiredEvidencePath = Join-Path $tmpRoot 'missing-evidence-dir'
        RequiredEvidenceKind = $retainedSpecs[1].RequiredEvidenceKind
    }
    $missingManifestRejected = -not (Test-IsRetainedHistoricalTarget -Candidate $firstRetainedCandidate -RetainedSpecs @($missingManifestSpec))
    $missingEvidenceRejected = -not (Test-IsRetainedHistoricalTarget -Candidate $firstRetainedCandidate -RetainedSpecs @($missingEvidenceSpec))
    Add-TestResult `
        -Name 'Retained historical specs fail closed when manifest or evidence is missing' `
        -Passed ($missingManifestRejected -and $missingEvidenceRejected) `
        -Detail "manifestRejected=$missingManifestRejected, evidenceRejected=$missingEvidenceRejected"

    $unknownOrdinaryTargets = @(
        (New-SyntheticCandidate `
            -FullName (Join-Path $tmpRoot 'rogue-worktree\target') `
            -Attributes ([IO.FileAttributes]::Directory)),
        (New-SyntheticCandidate `
            -FullName (Join-Path $tmpRoot 'rogue-worktree\cargo-target') `
            -Attributes ([IO.FileAttributes]::Directory)),
        (New-SyntheticCandidate `
            -FullName (Join-Path $tmpRoot 'rogue-worktree\rust-target') `
            -Attributes ([IO.FileAttributes]::Directory))
    )
    $unknownOrdinaryViolations = @(Get-SecondaryCargoTargetViolations `
        -Candidates $unknownOrdinaryTargets `
        -TmpRoot $tmpRoot `
        -AuthorizedTarget $authorizedTarget `
        -RetainedSpecs $retainedSpecs)
    Add-TestResult `
        -Name 'Unknown ordinary secondary target directories are rejected' `
        -Passed ($unknownOrdinaryViolations.Count -eq $unknownOrdinaryTargets.Count) `
        -Detail "expected=$($unknownOrdinaryTargets.Count), rejected=$($unknownOrdinaryViolations.Count)"

    $verifiedPwshExe = Resolve-PowerShell7Executable

    $cleanPreview = Invoke-SharedCargoPreviewSubprocess -PwshExecutable $verifiedPwshExe
    $cleanPreviewPassed = ($cleanPreview.ExitCode -eq 0) -and
        ($cleanPreview.Output -match 'STATUS: BUILD01_SHARED_CARGO_PREVIEW_PASS_NO_BUILD_NO_CHANGES') -and
        ($cleanPreview.Output -match '--offline --locked')
    Add-TestResult `
        -Name 'Invoke-EOD-SharedCargo Preview passes cleanly without compilation' `
        -Passed $cleanPreviewPassed `
        -Detail "exitCode=$($cleanPreview.ExitCode)"

    $badTargetDirEnv = Invoke-SharedCargoPreviewSubprocess -PwshExecutable $verifiedPwshExe -EnvironmentOverrides @{ CARGO_TARGET_DIR = 'E:\OtherTarget' }
    $badTargetDirPassed = ($badTargetDirEnv.ExitCode -ne 0) -and
        ($badTargetDirEnv.Output -match 'Conflicting CARGO_TARGET_DIR detected')
    Add-TestResult `
        -Name 'Conflicting CARGO_TARGET_DIR override is rejected' `
        -Passed $badTargetDirPassed `
        -Detail "exitCode=$($badTargetDirEnv.ExitCode)"

    $badBuildDirEnv = Invoke-SharedCargoPreviewSubprocess -PwshExecutable $verifiedPwshExe -EnvironmentOverrides @{ CARGO_BUILD_BUILD_DIR = 'E:\OtherBuildDir' }
    $badBuildDirPassed = ($badBuildDirEnv.ExitCode -ne 0) -and
        ($badBuildDirEnv.Output -match 'CARGO_BUILD_BUILD_DIR override detected')
    Add-TestResult `
        -Name 'CARGO_BUILD_BUILD_DIR override is rejected' `
        -Passed $badBuildDirPassed `
        -Detail "exitCode=$($badBuildDirEnv.ExitCode)"

    $badTargetFlag = Invoke-SharedCargoPreviewSubprocess -PwshExecutable $verifiedPwshExe -CargoArguments @('--target-dir=tmp\bad')
    $badTargetFlagPassed = ($badTargetFlag.ExitCode -ne 0) -and
        ($badTargetFlag.Output -match 'Unsupported Cargo override in routine shared build')
    Add-TestResult `
        -Name 'Disallowed --target-dir Cargo argument is rejected' `
        -Passed $badTargetFlagPassed `
        -Detail "exitCode=$($badTargetFlag.ExitCode)"

    $badZFlag = Invoke-SharedCargoPreviewSubprocess -PwshExecutable $verifiedPwshExe -CargoArguments @('-Z', 'unstable-options')
    $badZFlagPassed = ($badZFlag.ExitCode -ne 0) -and
        ($badZFlag.Output -match 'Unsupported Cargo override in routine shared build')
    Add-TestResult `
        -Name 'Disallowed -Z Cargo argument is rejected' `
        -Passed $badZFlagPassed `
        -Detail "exitCode=$($badZFlag.ExitCode)"
}
finally {
    $results | Format-Table -AutoSize
    $passedCount = @($results | Where-Object { $_.Status -eq 'PASS' }).Count
    Write-Output "TOTAL=$($results.Count) PASS=$passedCount"
}
