[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = Split-Path -Parent $PSScriptRoot
$snapshotScript = Join-Path $PSScriptRoot 'Create-EOD-Source-Code-Snapshot-v3.ps1'
$testFixturePath = 'docs\changes\2026-10-30-bse-name-history\native-proof-1793303233854903400\official-name-history.json'
$scratchRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
    'eod-snapshot-zip-only-tests-' + [Guid]::NewGuid().ToString('N')
)
$results = New-Object 'System.Collections.Generic.List[object]'

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
        throw "Focused snapshot test failed: $Name - $Detail"
    }
}

function New-SnapshotFixture {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][bool]$IncludeSdk,
        [switch]$MinimalDocs,
        [switch]$OmitTestFixture
    )

    $base = Join-Path $scratchRoot $Name
    $source = Join-Path $base 'source'
    $audit = Join-Path $base 'audit'
    $directories = @(
        '.cargo',
        'src\features\identityRecovery\resources',
        'src\node_modules',
        'public',
        'scripts',
        'tests',
        'docs',
        'backups'
    )
    if ($IncludeSdk) {
        $directories += 'packages\eod-plugin-sdk'
    }

    foreach ($directory in $directories) {
        $null = New-Item -ItemType Directory -Path (Join-Path $source $directory) -Force
    }

    $requiredDocs = @(
        'AGENTS.md',
        'README.md',
        'FILE_INVENTORY.md',
        'HANDOFF.md',
        'REQUIREMENTS.md',
        'ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md',
        'FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md',
        'PROJECT_STATE_EOD_CHARTING_PLATFORM.md',
        'NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md'
    )
    if ($MinimalDocs) {
        $requiredDocs = @('AGENTS.md')
    }
    foreach ($fileName in $requiredDocs) {
        Set-Content -LiteralPath (Join-Path $source $fileName) -Value "# Snapshot test: $fileName"
    }
    if (-not $OmitTestFixture) {
        $fixtureDestination = Join-Path $source $testFixturePath
        $null = New-Item -ItemType Directory -Path (Split-Path -Parent $fixtureDestination)
        Copy-Item -LiteralPath (Join-Path $projectRoot $testFixturePath) -Destination $fixtureDestination
    }

    Copy-Item -LiteralPath (Join-Path $projectRoot '.cargo\config.toml') -Destination (Join-Path $source '.cargo\config.toml')
    $runtimeMarkdown = @(
        'Official-Source-Recovery-Brief-For-Any-AI.md',
        'Identity-Investigation-Brief-For-Any-AI.md',
        'Identity-Recovery-Guide.md'
    )
    foreach ($fileName in $runtimeMarkdown) {
        $runtimeSource = Join-Path $projectRoot ('src\features\identityRecovery\resources\' + $fileName)
        $runtimeDestination = Join-Path $source ('src\features\identityRecovery\resources\' + $fileName)
        Copy-Item -LiteralPath $runtimeSource -Destination $runtimeDestination
    }

    $representativeSource = Join-Path $projectRoot 'package.json'
    Copy-Item -LiteralPath $representativeSource -Destination (Join-Path $source 'package.json')
    Copy-Item -LiteralPath $representativeSource -Destination (Join-Path $source 'src\main.ts')
    Copy-Item -LiteralPath $representativeSource -Destination (Join-Path $source 'src\ordinary.md')
    Copy-Item -LiteralPath $representativeSource -Destination (Join-Path $source 'src\generated.dll')
    Copy-Item -LiteralPath $representativeSource -Destination (Join-Path $source 'src\market.eod')
    Copy-Item -LiteralPath $representativeSource -Destination (Join-Path $source 'src\node_modules\ignored.js')
    Copy-Item -LiteralPath $representativeSource -Destination (Join-Path $source 'public\asset.txt')
    Copy-Item -LiteralPath $snapshotScript -Destination (Join-Path $source 'scripts\Create-EOD-Source-Code-Snapshot-v3.ps1')
    Copy-Item -LiteralPath $representativeSource -Destination (Join-Path $source 'tests\sample.ts')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination (Join-Path $source 'docs\allowed.md')
    Copy-Item -LiteralPath $representativeSource -Destination (Join-Path $source 'docs\archive.zip')
    Copy-Item -LiteralPath $representativeSource -Destination (Join-Path $source 'backups\ignored.ts')

    if ($IncludeSdk) {
        Copy-Item -Path (Join-Path $projectRoot 'packages\eod-plugin-sdk\*') -Destination (Join-Path $source 'packages\eod-plugin-sdk')
    }

    return [PSCustomObject]@{
        Base = $base
        Source = $source
        Audit = $audit
    }
}

function Invoke-SnapshotProcess {
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Audit,
        [Parameter(Mandatory)][bool]$SkipHashVerification,
        [switch]$SourceAudit
    )

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = 'powershell.exe'
    $startInfo.Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + $snapshotScript +
        '" -Source "' + $Source + '" -AuditRoot "' + $Audit + '"'
    if ($SkipHashVerification) {
        $startInfo.Arguments += ' -SkipHashVerification'
    }
    if ($SourceAudit) {
        $startInfo.Arguments += ' -SourceAudit'
    }
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    $null = $process.Start()
    $process.StandardInput.WriteLine('COPY')
    $process.StandardInput.Close()
    $standardOutput = $process.StandardOutput.ReadToEnd()
    $standardError = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    return [PSCustomObject]@{
        ExitCode = $process.ExitCode
        Output = $standardOutput + $standardError
    }
}

function Get-TreeHashes {
    param([Parameter(Mandatory)][string]$Root)

    $hashes = @{}
    foreach ($file in (Get-ChildItem -LiteralPath $Root -Recurse -Force -File)) {
        $relativePath = $file.FullName.Substring($Root.Length).TrimStart('\')
        $hashes[$relativePath] = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash
    }
    return $hashes
}

function Get-ExpectedRelativePaths {
    return @(
        'AGENTS.md',
        'README.md',
        'FILE_INVENTORY.md',
        'HANDOFF.md',
        'REQUIREMENTS.md',
        'ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md',
        'FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md',
        'PROJECT_STATE_EOD_CHARTING_PLATFORM.md',
        'NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md',
        'package.json',
        '.cargo\config.toml',
        'src\features\identityRecovery\resources\Official-Source-Recovery-Brief-For-Any-AI.md',
        'src\features\identityRecovery\resources\Identity-Investigation-Brief-For-Any-AI.md',
        'src\features\identityRecovery\resources\Identity-Recovery-Guide.md',
        'src\main.ts',
        'public\asset.txt',
        'scripts\Create-EOD-Source-Code-Snapshot-v3.ps1',
        'tests\sample.ts',
        'docs\allowed.md',
        $testFixturePath,
        'packages\eod-plugin-sdk\index.d.ts',
        'packages\eod-plugin-sdk\index.js',
        'packages\eod-plugin-sdk\package.json'
    )
}

function Import-ProductionVerifierFunctions {
    $tokens = $null
    $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        $snapshotScript,
        [ref]$tokens,
        [ref]$parseErrors
    )
    if ($parseErrors.Count -gt 0) {
        throw 'Cannot import verifier functions from a script with parser errors.'
    }

    $functionNames = @(
        'Get-StreamSha256',
        'Get-FileSha256WithMetadata',
        'Read-StreamFully',
        'Write-ProblemList',
        'Test-ZipSnapshot'
    )
    foreach ($functionName in $functionNames) {
        $definition = $ast.Find(
            {
                param($node)
                return $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
                    $node.Name -eq $functionName
            },
            $true
        )
        if ($null -eq $definition) {
            throw "Production verifier function not found: $functionName"
        }
        Invoke-Expression $definition.Extent.Text
    }
}

function New-ExpectedVerificationObjects {
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string[]]$RelativePaths
    )

    $expectedObjects = @()
    foreach ($relativePath in $RelativePaths) {
        $item = Get-Item -LiteralPath (Join-Path $Source $relativePath)
        $expectedObjects += [PSCustomObject]@{
            RelativePath = $relativePath
            FullName = $item.FullName
            ArchivedLength = [long]$item.Length
            ArchivedLastWriteTimeUtc = $item.LastWriteTimeUtc
            VerifiedLength = [long]0
            VerifiedLastWriteTimeUtc = [DateTime]::MinValue
        }
    }
    return $expectedObjects
}

function Test-VerifierRejects {
    param(
        [Parameter(Mandatory)][string]$ZipPath,
        [Parameter(Mandatory)]$ExpectedFiles,
        [Parameter(Mandatory)][string]$ArchiveRoot
    )

    $detected = $false
    try {
        $null = Test-ZipSnapshot `
            -ZipPath $ZipPath `
            -ExpectedFiles $ExpectedFiles `
            -ArchiveRoot $ArchiveRoot `
            -SkipContentHashVerification $false
    }
    catch {
        $detected = $true
    }
    return $detected
}

function Assert-SafeScratchPath {
    param([Parameter(Mandatory)][string]$Path)

    $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\')
    $resolved = [System.IO.Path]::GetFullPath($Path)
    $requiredPrefix = $tempRoot + '\eod-snapshot-zip-only-tests-'
    if (-not $resolved.StartsWith($requiredPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing cleanup outside the validated test scratch prefix: $resolved"
    }
    return $resolved
}

$testSucceeded = $false
try {
    $null = New-Item -ItemType Directory -Path $scratchRoot -Force

    $tokens = $null
    $parserErrors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseFile(
        $snapshotScript,
        [ref]$tokens,
        [ref]$parserErrors
    )
    Add-TestResult -Name 'PowerShell parser' -Passed ($parserErrors.Count -eq 0) -Detail "errors=$($parserErrors.Count)"

    $main = New-SnapshotFixture -Name 'success' -IncludeSdk $true
    $beforeHashes = Get-TreeHashes -Root $main.Source
    $run = Invoke-SnapshotProcess -Source $main.Source -Audit $main.Audit -SkipHashVerification $false
    Add-TestResult -Name 'ZIP creation succeeds' -Passed ($run.ExitCode -eq 0) -Detail "exit=$($run.ExitCode)"

    $zipFiles = @(Get-ChildItem -LiteralPath $main.Audit -File -Filter '*.zip')
    $auditItems = @(Get-ChildItem -LiteralPath $main.Audit -Force)
    Add-TestResult `
        -Name 'Single final ZIP only' `
        -Passed ($zipFiles.Count -eq 1 -and $auditItems.Count -eq 1) `
        -Detail "zip=$($zipFiles.Count), items=$($auditItems.Count)"

    $zipPath = $zipFiles[0].FullName
    $archiveRoot = [System.IO.Path]::GetFileNameWithoutExtension($zipPath)
    $expectedRelativePaths = @(Get-ExpectedRelativePaths)
    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $entries = @($archive.Entries)
        $entryNames = @($entries | ForEach-Object { $_.FullName })
        $roots = @($entryNames | ForEach-Object { $_.Split('/')[0] } | Sort-Object -Unique)
        Add-TestResult `
            -Name 'Correct internal root' `
            -Passed ($roots.Count -eq 1 -and $roots[0] -eq $archiveRoot) `
            -Detail ($roots -join ',')

        $missing = @(
            $expectedRelativePaths | Where-Object {
                $entryNames -notcontains ($archiveRoot + '/' + $_.Replace('\', '/'))
            }
        )
        Add-TestResult `
            -Name 'All expected files present' `
            -Passed ($missing.Count -eq 0 -and $entries.Count -eq $expectedRelativePaths.Count) `
            -Detail "entries=$($entries.Count), missing=$($missing.Count)"

        $excluded = @(
            'src/ordinary.md',
            'src/generated.dll',
            'src/market.eod',
            'src/node_modules/ignored.js',
            'docs/archive.zip',
            'backups/ignored.ts'
        )
        $includedExcluded = @(
            $excluded | Where-Object { $entryNames -contains ($archiveRoot + '/' + $_) }
        )
        Add-TestResult `
            -Name 'Exclusions enforced' `
            -Passed ($includedExcluded.Count -eq 0) `
            -Detail ($includedExcluded -join ',')

        $runtimeEntries = @(
            $entryNames | Where-Object {
                $_ -like "$archiveRoot/src/features/identityRecovery/resources/*.md"
            }
        )
        Add-TestResult -Name 'Runtime Markdown included' -Passed ($runtimeEntries.Count -eq 3) -Detail "entries=$($runtimeEntries.Count)"

        $sdkEntries = @(
            $entryNames | Where-Object { $_ -like "$archiveRoot/packages/eod-plugin-sdk/*" }
        )
        Add-TestResult -Name 'SDK files included' -Passed ($sdkEntries.Count -eq 3) -Detail "entries=$($sdkEntries.Count)"

        $hashMismatches = New-Object 'System.Collections.Generic.List[string]'
        foreach ($relativePath in $expectedRelativePaths) {
            $entry = $archive.GetEntry($archiveRoot + '/' + $relativePath.Replace('\', '/'))
            $entryStream = $entry.Open()
            try {
                $sha256 = [System.Security.Cryptography.SHA256]::Create()
                try {
                    $entryHash = ([System.BitConverter]::ToString($sha256.ComputeHash($entryStream))).Replace('-', '')
                }
                finally {
                    $sha256.Dispose()
                }
            }
            finally {
                $entryStream.Dispose()
            }
            $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $main.Source $relativePath)).Hash
            if ($entryHash -ne $sourceHash) {
                $hashMismatches.Add($relativePath)
            }
        }
        Add-TestResult -Name 'ZIP hashes match source' -Passed ($hashMismatches.Count -eq 0) -Detail "mismatches=$($hashMismatches.Count)"
    }
    finally {
        $archive.Dispose()
    }

    $extractRoot = Join-Path $main.Base 'extract'
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot
    $extractMismatches = New-Object 'System.Collections.Generic.List[string]'
    foreach ($relativePath in $expectedRelativePaths) {
        $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $main.Source $relativePath)).Hash
        $extractedPath = Join-Path (Join-Path $extractRoot $archiveRoot) $relativePath
        $extractedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $extractedPath).Hash
        if ($sourceHash -ne $extractedHash) {
            $extractMismatches.Add($relativePath)
        }
    }
    Add-TestResult `
        -Name 'ZIP extracts and matches' `
        -Passed ($extractMismatches.Count -eq 0) `
        -Detail "mismatches=$($extractMismatches.Count)"

    $afterHashes = Get-TreeHashes -Root $main.Source
    $sourceChanges = @(
        $beforeHashes.Keys | Where-Object {
            -not $afterHashes.ContainsKey($_) -or $afterHashes[$_] -ne $beforeHashes[$_]
        }
    )
    Add-TestResult `
        -Name 'Source files unchanged' `
        -Passed ($beforeHashes.Count -eq $afterHashes.Count -and $sourceChanges.Count -eq 0) `
        -Detail "changed=$($sourceChanges.Count)"

    $noSdk = New-SnapshotFixture -Name 'no-sdk' -IncludeSdk $false
    $noSdkRun = Invoke-SnapshotProcess -Source $noSdk.Source -Audit $noSdk.Audit -SkipHashVerification $true
    $noSdkZip = @(Get-ChildItem -LiteralPath $noSdk.Audit -Filter '*.zip' -File)
    $noSdkArchive = [System.IO.Compression.ZipFile]::OpenRead($noSdkZip[0].FullName)
    try {
        $noSdkEntries = @(
            $noSdkArchive.Entries | Where-Object { $_.FullName -like '*/packages/eod-plugin-sdk/*' }
        )
    }
    finally {
        $noSdkArchive.Dispose()
    }
    $noSdkPassed = $noSdkRun.ExitCode -eq 0 -and
        $noSdkEntries.Count -eq 0 -and
        $noSdkRun.Output -match 'Plugin SDK\s+: ABSENT'
    Add-TestResult -Name 'Absent SDK handled' -Passed $noSdkPassed -Detail "exit=$($noSdkRun.ExitCode)"

    $skipHashPassed = $noSdkRun.Output -match 'Hash verification: SKIPPED BY REQUEST' -and
        $noSdkRun.Output -match 'ZIP integrity\s+: PASS'
    Add-TestResult -Name 'Skip hash compatibility' -Passed $skipHashPassed -Detail 'structure verified'

    $collision = New-SnapshotFixture -Name 'collision' -IncludeSdk $true
    $null = New-Item -ItemType Directory -Path $collision.Audit -Force
    $istZone = [System.TimeZoneInfo]::FindSystemTimeZoneById('India Standard Time')
    $istNow = [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $istZone)
    for ($index = 0; $index -lt 180; $index += 1) {
        $name = 'Eod Charting Platform Source Code ' +
            $istNow.AddSeconds($index).ToString('yyyy-MM-dd_HHmmss') + '_IST.zip'
        $null = New-Item -ItemType File -Path (Join-Path $collision.Audit $name) -Force
    }
    $collisionRun = Invoke-SnapshotProcess -Source $collision.Source -Audit $collision.Audit -SkipHashVerification $false
    $collisionPartials = @(Get-ChildItem -LiteralPath $collision.Audit -Filter '*.partial' -File)
    $collisionPassed = $collisionRun.ExitCode -ne 0 -and
        $collisionRun.Output -match 'Destination already exists' -and
        $collisionPartials.Count -eq 0
    Add-TestResult `
        -Name 'Existing destination collision fails safely' `
        -Passed $collisionPassed `
        -Detail "exit=$($collisionRun.ExitCode)"

    $missingRequired = New-SnapshotFixture -Name 'missing-required' -IncludeSdk $true
    Remove-Item -LiteralPath (Join-Path $missingRequired.Source '.cargo\config.toml') -Force
    $missingRun = Invoke-SnapshotProcess `
        -Source $missingRequired.Source `
        -Audit $missingRequired.Audit `
        -SkipHashVerification $false
    $missingPassed = $missingRun.ExitCode -ne 0 -and
        $missingRun.Output -match 'Critical source/build configuration files are missing' -and
        -not (Test-Path -LiteralPath $missingRequired.Audit)
    Add-TestResult -Name 'Missing required file fails' -Passed $missingPassed -Detail "exit=$($missingRun.ExitCode)"

    $minimal = New-SnapshotFixture -Name 'minimal-docs' -IncludeSdk $true -MinimalDocs
    $normalRun = Invoke-SnapshotProcess -Source $minimal.Source -Audit $minimal.Audit -SkipHashVerification $false
    Add-TestResult -Name 'Normal mode still requires root documents' `
        -Passed ($normalRun.ExitCode -ne 0 -and $normalRun.Output -match 'NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM\.md') `
        -Detail "exit=$($normalRun.ExitCode)"
    $auditRun = Invoke-SnapshotProcess -Source $minimal.Source -Audit $minimal.Audit -SkipHashVerification $false -SourceAudit
    Add-TestResult -Name 'Source audit mode accepts minimal docs' `
        -Passed ($auditRun.ExitCode -eq 0 -and $auditRun.Output -match 'ZIP integrity\s+: PASS') `
        -Detail "exit=$($auditRun.ExitCode)"
    $auditZip = Get-ChildItem -LiteralPath $minimal.Audit -Filter '*.zip' -File
    $auditArchive = [IO.Compression.ZipFile]::OpenRead($auditZip.FullName)
    try {
        $auditEntries = @($auditArchive.Entries | ForEach-Object { $_.FullName -replace '^[^/]+/', '' })
        $auditDocs = @($auditEntries | Where-Object { $_ -like 'docs/*' })
        Add-TestResult -Name 'Source audit includes fixture and excludes project docs' `
            -Passed ($auditDocs.Count -eq 1 -and $auditDocs[0] -eq ($testFixturePath.Replace('\', '/')) -and
                $auditEntries -contains 'AGENTS.md' -and $auditEntries -notcontains 'README.md') `
            -Detail "docs entries=$($auditDocs.Count)"
    }
    finally {
        $auditArchive.Dispose()
    }
    $missingFixture = New-SnapshotFixture -Name 'missing-fixture' -IncludeSdk $true -OmitTestFixture
    foreach ($sourceAuditMode in @($false, $true)) {
        $fixtureRun = Invoke-SnapshotProcess -Source $missingFixture.Source -Audit $missingFixture.Audit `
            -SkipHashVerification $false -SourceAudit:$sourceAuditMode
        Add-TestResult -Name 'Missing BSE fixture fails before ZIP creation' `
            -Passed ($fixtureRun.ExitCode -ne 0 -and $fixtureRun.Output -match 'official-name-history\.json' -and
                -not (Test-Path -LiteralPath $missingFixture.Audit)) `
            -Detail "SourceAudit=$sourceAuditMode, exit=$($fixtureRun.ExitCode)"
    }

    $locked = New-SnapshotFixture -Name 'locked-source' -IncludeSdk $true
    $null = New-Item -ItemType Directory -Path $locked.Audit -Force
    $lockedPath = Join-Path $locked.Source 'tests\sample.ts'
    $lockStream = [System.IO.File]::Open(
        $lockedPath,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::None
    )
    try {
        $lockedRun = Invoke-SnapshotProcess -Source $locked.Source -Audit $locked.Audit -SkipHashVerification $false
    }
    finally {
        $lockStream.Dispose()
    }
    $lockedItems = @(Get-ChildItem -LiteralPath $locked.Audit -Force)
    Add-TestResult `
        -Name 'Archive failure removes partial' `
        -Passed ($lockedRun.ExitCode -ne 0 -and $lockedItems.Count -eq 0) `
        -Detail "exit=$($lockedRun.ExitCode), items=$($lockedItems.Count)"

    Import-ProductionVerifierFunctions
    $expectedObjects = @(New-ExpectedVerificationObjects -Source $main.Source -RelativePaths $expectedRelativePaths)

    $mismatchZip = Join-Path $main.Base 'mismatch.zip'
    Copy-Item -LiteralPath $zipPath -Destination $mismatchZip
    $mismatchFileStream = [System.IO.File]::Open(
        $mismatchZip,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
    $mismatchArchive = New-Object System.IO.Compression.ZipArchive(
        $mismatchFileStream,
        [System.IO.Compression.ZipArchiveMode]::Update,
        $false
    )
    try {
        $target = $mismatchArchive.GetEntry($archiveRoot + '/public/asset.txt')
        $targetLength = [int]$target.Length
        $target.Delete()
        $replacement = $mismatchArchive.CreateEntry($archiveRoot + '/public/asset.txt')
        $replacementStream = $replacement.Open()
        try {
            $replacementBytes = [System.Text.Encoding]::ASCII.GetBytes(('X' * $targetLength))
            $replacementStream.Write($replacementBytes, 0, $replacementBytes.Length)
        }
        finally {
            $replacementStream.Dispose()
        }
    }
    finally {
        $mismatchArchive.Dispose()
        $mismatchFileStream.Dispose()
    }
    Add-TestResult `
        -Name 'Mismatched entry detected' `
        -Passed (Test-VerifierRejects -ZipPath $mismatchZip -ExpectedFiles $expectedObjects -ArchiveRoot $archiveRoot) `
        -Detail 'valid ZIP with altered entry'

    $truncatedZip = Join-Path $main.Base 'truncated.zip'
    Copy-Item -LiteralPath $zipPath -Destination $truncatedZip
    $truncatedStream = [System.IO.File]::Open(
        $truncatedZip,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::None
    )
    try {
        $truncatedStream.SetLength($truncatedStream.Length - 32)
    }
    finally {
        $truncatedStream.Dispose()
    }
    Add-TestResult `
        -Name 'Corrupted archive detected' `
        -Passed (Test-VerifierRejects -ZipPath $truncatedZip -ExpectedFiles $expectedObjects -ArchiveRoot $archiveRoot) `
        -Detail 'central directory truncated'

    $traversalZip = Join-Path $main.Base 'traversal.zip'
    Copy-Item -LiteralPath $zipPath -Destination $traversalZip
    $traversalFileStream = [System.IO.File]::Open(
        $traversalZip,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
    $traversalArchive = New-Object System.IO.Compression.ZipArchive(
        $traversalFileStream,
        [System.IO.Compression.ZipArchiveMode]::Update,
        $false
    )
    try {
        $badEntry = $traversalArchive.CreateEntry($archiveRoot + '/../escape.txt')
        $badStream = $badEntry.Open()
        $badStream.Dispose()
    }
    finally {
        $traversalArchive.Dispose()
        $traversalFileStream.Dispose()
    }
    Add-TestResult `
        -Name 'Path traversal detected' `
        -Passed (Test-VerifierRejects -ZipPath $traversalZip -ExpectedFiles $expectedObjects -ArchiveRoot $archiveRoot) `
        -Detail '../ entry'

    $duplicateZip = Join-Path $main.Base 'duplicate.zip'
    Copy-Item -LiteralPath $zipPath -Destination $duplicateZip
    $duplicateFileStream = [System.IO.File]::Open(
        $duplicateZip,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
    $duplicateArchive = New-Object System.IO.Compression.ZipArchive(
        $duplicateFileStream,
        [System.IO.Compression.ZipArchiveMode]::Update,
        $false
    )
    try {
        $duplicateEntry = $duplicateArchive.CreateEntry($archiveRoot + '/public/asset.txt')
        $duplicateStream = $duplicateEntry.Open()
        $duplicateStream.Dispose()
    }
    finally {
        $duplicateArchive.Dispose()
        $duplicateFileStream.Dispose()
    }
    Add-TestResult `
        -Name 'Duplicate ZIP path detected' `
        -Passed (Test-VerifierRejects -ZipPath $duplicateZip -ExpectedFiles $expectedObjects -ArchiveRoot $archiveRoot) `
        -Detail 'case-insensitive duplicate'

    $intermediateDirectories = @(
        Get-ChildItem -LiteralPath $scratchRoot -Recurse -Directory |
            Where-Object {
                $_.Name -like 'Eod Charting Platform Source Code *' -and
                    $_.Parent.Name -eq 'audit'
            }
    )
    Add-TestResult `
        -Name 'No intermediate snapshot directory' `
        -Passed ($intermediateDirectories.Count -eq 0) `
        -Detail "directories=$($intermediateDirectories.Count)"

    $testSucceeded = $true
}
finally {
    $results | Format-Table -AutoSize
    Write-Output "TOTAL=$($results.Count) PASS=$(@($results | Where-Object { $_.Status -eq 'PASS' }).Count)"
    if ($testSucceeded) {
        $safeScratchRoot = Assert-SafeScratchPath -Path $scratchRoot
        Write-Output "Removing snapshot test scratch directory: $safeScratchRoot"
        Remove-Item -LiteralPath $safeScratchRoot -Recurse -Force
        Write-Output 'Scratch cleanup: PASS'
    }
    if (-not $testSucceeded) {
        Write-Output "Scratch retained for diagnosis: $scratchRoot"
    }
}
