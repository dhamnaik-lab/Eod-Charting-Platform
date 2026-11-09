[CmdletBinding()]
param(
    [string]$Source = 'E:\TA Projects\EOD Charting Platform',
    [string]$AuditRoot = 'E:\TA Projects\EOD Charting Platform Source Audit',
    [switch]$SourceAudit,
    [switch]$SkipHashVerification
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-NormalizedFullPath {
    param([Parameter(Mandatory)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path).TrimEnd([char[]]@('\', '/'))
}

function Test-IsPathWithinOrEqual {
    param(
        [Parameter(Mandatory)][string]$CandidatePath,
        [Parameter(Mandatory)][string]$RootPath
    )
    $candidate = Get-NormalizedFullPath -Path $CandidatePath
    $root = Get-NormalizedFullPath -Path $RootPath
    if ($candidate.Equals($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }
    $rootPrefix = $root + [System.IO.Path]::DirectorySeparatorChar
    return $candidate.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-NoReparsePointInExistingPath {
    param([Parameter(Mandatory)][string]$Path)
    $current = Get-Item -LiteralPath $Path -Force
    while ($null -ne $current) {
        if (($current.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Path contains a reparse point and is not allowed: $($current.FullName)"
        }
        $parentPath = Split-Path -Parent $current.FullName
        if ([string]::IsNullOrWhiteSpace($parentPath)) {
            break
        }
        if ($parentPath.Equals($current.FullName, [System.StringComparison]::OrdinalIgnoreCase)) {
            break
        }
        $current = Get-Item -LiteralPath $parentPath -Force
    }
}

function Test-ExcludedFileName {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string[]]$Patterns
    )
    foreach ($pattern in $Patterns) {
        if ($Name -like $pattern) {
            return $true
        }
    }
    return $false
}

function Get-FilteredFiles {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$ExcludedFilePatterns,
        [Parameter(Mandatory)]$ExcludedDirectoryNames
    )
    $rootItem = Get-Item -LiteralPath $Path -Force
    if (($rootItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Selected source directory is a reparse point: $Path"
    }
    $pending = New-Object 'System.Collections.Generic.Stack[string]'
    $pending.Push($rootItem.FullName)
    while ($pending.Count -gt 0) {
        $currentDirectory = $pending.Pop()
        foreach ($entry in [System.IO.Directory]::EnumerateFileSystemEntries($currentDirectory)) {
            $attributes = [System.IO.File]::GetAttributes($entry)
            if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                continue
            }
            if (($attributes -band [System.IO.FileAttributes]::Directory) -ne 0) {
                $directoryName = [System.IO.Path]::GetFileName($entry)
                if ($ExcludedDirectoryNames.Contains($directoryName)) {
                    continue
                }
                $pending.Push($entry)
                continue
            }
            $fileName = [System.IO.Path]::GetFileName($entry)
            if (-not (Test-ExcludedFileName -Name $fileName -Patterns $ExcludedFilePatterns)) {
                Get-Item -LiteralPath $entry -Force
            }
        }
    }
}

function Add-ExpectedFile {
    param(
        [Parameter(Mandatory)]$ExpectedByRelativePath,
        [Parameter(Mandatory)][string]$SourceRoot,
        [Parameter(Mandatory)][System.IO.FileInfo]$File
    )
    if (($File.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Explicitly selected source file is a reparse point: $($File.FullName)"
    }
    if (-not (Test-IsPathWithinOrEqual -CandidatePath $File.FullName -RootPath $SourceRoot)) {
        throw "Selected file resolves outside the authorized source root: $($File.FullName)"
    }
    $relativePath = $File.FullName.Substring($SourceRoot.Length).TrimStart([char[]]@('\', '/'))
    $relativePath = $relativePath.Replace('/', '\')
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
        throw "Could not determine a relative archive path for: $($File.FullName)"
    }
    if ($ExpectedByRelativePath.ContainsKey($relativePath)) {
        $existing = $ExpectedByRelativePath[$relativePath]
        if (-not $existing.FullName.Equals($File.FullName, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Duplicate archive path maps to more than one source file: $relativePath"
        }
        return
    }
    $ExpectedByRelativePath.Add($relativePath, [PSCustomObject]@{
        RelativePath = $relativePath
        FullName = $File.FullName
        InitialLength = [long]$File.Length
        InitialLastWriteTimeUtc = $File.LastWriteTimeUtc
        ArchivedLength = [long]0
        ArchivedLastWriteTimeUtc = [DateTime]::MinValue
        VerifiedLength = [long]0
        VerifiedLastWriteTimeUtc = [DateTime]::MinValue
    })
}

function Get-StreamSha256 {
    param([Parameter(Mandatory)][System.IO.Stream]$Stream)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha256.ComputeHash($Stream)
        return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '')
    }
    finally {
        $sha256.Dispose()
    }
}

function Get-FileSha256WithMetadata {
    param([Parameter(Mandatory)][string]$Path)
    $before = Get-Item -LiteralPath $Path -Force
    if (($before.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Source file became a reparse point: $Path"
    }
    $stream = [System.IO.File]::Open(
        $before.FullName,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::Read
    )
    try {
        $hash = Get-StreamSha256 -Stream $stream
    }
    finally {
        $stream.Dispose()
    }
    $after = Get-Item -LiteralPath $Path -Force
    if ($before.Length -ne $after.Length -or $before.LastWriteTimeUtc -ne $after.LastWriteTimeUtc) {
        throw "Source file changed while it was being hashed: $Path"
    }
    return [PSCustomObject]@{
        Hash = $hash
        Length = [long]$after.Length
        LastWriteTimeUtc = $after.LastWriteTimeUtc
    }
}

function Read-StreamFully {
    param([Parameter(Mandatory)][System.IO.Stream]$Stream)
    $buffer = New-Object byte[] 131072
    while (($bytesRead = $Stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $null = $bytesRead
    }
}

function Write-SourceFileToZipEntry {
    param(
        [Parameter(Mandatory)][System.IO.Compression.ZipArchive]$Archive,
        [Parameter(Mandatory)]$ExpectedFile,
        [Parameter(Mandatory)][string]$ArchiveRoot
    )
    $before = Get-Item -LiteralPath $ExpectedFile.FullName -Force
    if (($before.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Source file became a reparse point before archiving: $($ExpectedFile.RelativePath)"
    }
    if ($before.Length -ne $ExpectedFile.InitialLength -or $before.LastWriteTimeUtc -ne $ExpectedFile.InitialLastWriteTimeUtc) {
        throw "Source file changed after selection and before archiving: $($ExpectedFile.RelativePath)"
    }
    $entryPath = $ArchiveRoot + '/' + $ExpectedFile.RelativePath.Replace('\', '/')
    $entry = $Archive.CreateEntry($entryPath, [System.IO.Compression.CompressionLevel]::Optimal)
    $sourceStream = $null
    $entryStream = $null
    try {
        $sourceStream = [System.IO.File]::Open(
            $before.FullName,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            [System.IO.FileShare]::Read
        )
        $entryStream = $entry.Open()
        $sourceStream.CopyTo($entryStream, 131072)
    }
    finally {
        if ($null -ne $entryStream) {
            $entryStream.Dispose()
        }
        if ($null -ne $sourceStream) {
            $sourceStream.Dispose()
        }
    }
    $after = Get-Item -LiteralPath $ExpectedFile.FullName -Force
    if ($before.Length -ne $after.Length -or $before.LastWriteTimeUtc -ne $after.LastWriteTimeUtc) {
        throw "Source file changed while it was being archived: $($ExpectedFile.RelativePath)"
    }
    $ExpectedFile.ArchivedLength = [long]$after.Length
    $ExpectedFile.ArchivedLastWriteTimeUtc = $after.LastWriteTimeUtc
}

function Write-ProblemList {
    param(
        [Parameter(Mandatory)][string]$Heading,
        [Parameter(Mandatory)]$Items
    )
    if ($Items.Count -gt 0) {
        Write-Host ''
        Write-Host $Heading -ForegroundColor Red
        $Items | ForEach-Object { Write-Host "  $_" }
    }
}

function Test-ZipSnapshot {
    param(
        [Parameter(Mandatory)][string]$ZipPath,
        [Parameter(Mandatory)]$ExpectedFiles,
        [Parameter(Mandatory)][string]$ArchiveRoot,
        [Parameter(Mandatory)][bool]$SkipContentHashVerification
    )
    $expectedByEntryPath = New-Object 'System.Collections.Generic.Dictionary[string,object]' ([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($expectedFile in $ExpectedFiles) {
        $entryPath = $ArchiveRoot + '/' + $expectedFile.RelativePath.Replace('\', '/')
        if ($expectedByEntryPath.ContainsKey($entryPath)) {
            throw "Duplicate expected ZIP path: $entryPath"
        }
        $expectedByEntryPath.Add($entryPath, $expectedFile)
    }
    $seenEntryPaths = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
    $missingFiles = New-Object 'System.Collections.Generic.List[string]'
    $unexpectedFiles = New-Object 'System.Collections.Generic.List[string]'
    $hashMismatches = New-Object 'System.Collections.Generic.List[string]'
    $entryCount = 0
    $zipFileStream = $null
    $archive = $null
    try {
        $zipFileStream = [System.IO.File]::Open(
            $ZipPath,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            [System.IO.FileShare]::Read
        )
        $archive = New-Object System.IO.Compression.ZipArchive(
            $zipFileStream,
            [System.IO.Compression.ZipArchiveMode]::Read,
            $false
        )
        foreach ($entry in $archive.Entries) {
            $entryCount += 1
            $entryPath = $entry.FullName
            if ([string]::IsNullOrWhiteSpace($entryPath)) {
                throw 'ZIP contains an empty entry path.'
            }
            if ($entryPath.Contains('\')) {
                throw "ZIP entry uses a non-canonical path separator: $entryPath"
            }
            if ($entryPath.StartsWith('/') -or $entryPath.StartsWith('\') -or $entryPath -match '^[A-Za-z]:') {
                throw "ZIP contains an absolute entry path: $entryPath"
            }
            $segments = @($entryPath.Split('/'))
            if ($segments -contains '..' -or $segments -contains '.') {
                throw "ZIP contains a path traversal entry: $entryPath"
            }
            if (-not $entryPath.StartsWith($ArchiveRoot + '/', [System.StringComparison]::Ordinal)) {
                throw "ZIP entry is outside the expected root '$ArchiveRoot': $entryPath"
            }
            if (-not $seenEntryPaths.Add($entryPath)) {
                throw "ZIP contains a duplicate entry path: $entryPath"
            }
            $entryStream = $null
            try {
                $entryStream = $entry.Open()
                if ($SkipContentHashVerification) {
                    Read-StreamFully -Stream $entryStream
                }
                if (-not $SkipContentHashVerification) {
                    $archiveHash = Get-StreamSha256 -Stream $entryStream
                }
            }
            finally {
                if ($null -ne $entryStream) {
                    $entryStream.Dispose()
                }
            }
            if (-not $expectedByEntryPath.ContainsKey($entryPath)) {
                $unexpectedFiles.Add($entryPath)
                continue
            }
            $expectedFile = $expectedByEntryPath[$entryPath]
            if ($entry.Length -ne $expectedFile.ArchivedLength) {
                $hashMismatches.Add($expectedFile.RelativePath)
                continue
            }
            $currentSource = Get-Item -LiteralPath $expectedFile.FullName -Force
            if ($currentSource.Length -ne $expectedFile.ArchivedLength -or $currentSource.LastWriteTimeUtc -ne $expectedFile.ArchivedLastWriteTimeUtc) {
                throw "Source file changed after archiving: $($expectedFile.RelativePath)"
            }
            if (-not $SkipContentHashVerification) {
                $sourceResult = Get-FileSha256WithMetadata -Path $expectedFile.FullName
                if ($archiveHash -ne $sourceResult.Hash) {
                    $hashMismatches.Add($expectedFile.RelativePath)
                    continue
                }
                $expectedFile.VerifiedLength = $sourceResult.Length
                $expectedFile.VerifiedLastWriteTimeUtc = $sourceResult.LastWriteTimeUtc
            }
            if ($SkipContentHashVerification) {
                $expectedFile.VerifiedLength = [long]$currentSource.Length
                $expectedFile.VerifiedLastWriteTimeUtc = $currentSource.LastWriteTimeUtc
            }
        }
    }
    finally {
        if ($null -ne $archive) {
            $archive.Dispose()
        }
        if ($null -ne $zipFileStream) {
            $zipFileStream.Dispose()
        }
    }
    foreach ($expectedEntryPath in $expectedByEntryPath.Keys) {
        if (-not $seenEntryPaths.Contains($expectedEntryPath)) {
            $missingFiles.Add($expectedByEntryPath[$expectedEntryPath].RelativePath)
        }
    }
    if ($entryCount -ne $ExpectedFiles.Count -and $unexpectedFiles.Count -eq 0 -and $missingFiles.Count -eq 0) {
        throw "ZIP entry count mismatch. Expected $($ExpectedFiles.Count), found $entryCount."
    }
    Write-ProblemList -Heading 'Missing:' -Items $missingFiles
    Write-ProblemList -Heading 'Unexpected:' -Items $unexpectedFiles
    Write-ProblemList -Heading 'Hash mismatches:' -Items $hashMismatches
    if ($missingFiles.Count -gt 0 -or $unexpectedFiles.Count -gt 0 -or $hashMismatches.Count -gt 0) {
        throw 'ZIP snapshot verification failed. Review the lists above.'
    }
    return [PSCustomObject]@{
        EntryCount = $entryCount
        MissingCount = $missingFiles.Count
        UnexpectedCount = $unexpectedFiles.Count
        HashMismatchCount = $hashMismatches.Count
    }
}

function Assert-VerifiedSourcesStable {
    param([Parameter(Mandatory)]$ExpectedFiles)
    foreach ($expectedFile in $ExpectedFiles) {
        $current = Get-Item -LiteralPath $expectedFile.FullName -Force
        if (($current.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Verified source file became a reparse point: $($expectedFile.RelativePath)"
        }
        if ($current.Length -ne $expectedFile.VerifiedLength -or $current.LastWriteTimeUtc -ne $expectedFile.VerifiedLastWriteTimeUtc) {
            throw "Verified source file changed before ZIP publication: $($expectedFile.RelativePath)"
        }
    }
}

if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
    throw "Source project folder not found: $Source"
}
$Source = Get-NormalizedFullPath -Path (Resolve-Path -LiteralPath $Source).Path
Assert-NoReparsePointInExistingPath -Path $Source
$AuditRootPath = Get-NormalizedFullPath -Path $AuditRoot
if (Test-Path -LiteralPath $AuditRootPath -PathType Leaf) {
    throw "Audit destination is a file, not a directory: $AuditRootPath"
}

$istZone = [System.TimeZoneInfo]::FindSystemTimeZoneById('India Standard Time')
$istNow = [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $istZone)
$timestamp = $istNow.ToString('yyyy-MM-dd_HHmmss')
$archiveBaseName = "Eod Charting Platform Source Code ${timestamp}_IST"
$Destination = Join-Path $AuditRootPath ($archiveBaseName + '.zip')
$TemporaryZipPath = Join-Path $AuditRootPath ($archiveBaseName + ".$PID.$([Guid]::NewGuid().ToString('N')).partial")
if (Test-IsPathWithinOrEqual -CandidatePath $Destination -RootPath $Source) {
    throw "Snapshot destination must not resolve inside the source project: $Destination"
}
if (Test-IsPathWithinOrEqual -CandidatePath $TemporaryZipPath -RootPath $Source) {
    throw "Temporary snapshot path must not resolve inside the source project: $TemporaryZipPath"
}

$CandidateSourceDirectories = @(
    '.cargo', 'src', 'src-tauri-shell', 'public', 'scripts', 'tests', 'test', 'e2e',
    'tools', 'resources', 'config', 'fixtures', 'patches', 'types'
)
$OptionalSdkDirectory = 'packages\eod-plugin-sdk'
$RequiredDocumentationFiles = @(
    'AGENTS.md', 'README.md', 'FILE_INVENTORY.md', 'HANDOFF.md', 'REQUIREMENTS.md',
    'ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md',
    'FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md',
    'PROJECT_STATE_EOD_CHARTING_PLATFORM.md',
    'NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md'
)
if ($SourceAudit) {
    $RequiredDocumentationFiles = @('AGENTS.md')
}
$DocumentationDirectory = 'docs'
$RequiredTestFixture = 'docs\changes\2026-10-30-bse-name-history\native-proof-1793303233854903400\official-name-history.json'
$RequiredSourceFiles = @('.cargo\config.toml', $RequiredTestFixture)
$RequiredRuntimeMarkdownResources = @(
    'src\features\identityRecovery\resources\Official-Source-Recovery-Brief-For-Any-AI.md',
    'src\features\identityRecovery\resources\Identity-Investigation-Brief-For-Any-AI.md',
    'src\features\identityRecovery\resources\Identity-Recovery-Guide.md'
)
$RootFilePatterns = @(
    'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock',
    'bun.lock', 'bun.lockb', 'index.html', 'tsconfig*.json', 'vite.config.*', 'vitest.config.*',
    'playwright.config.*', 'eslint.config.*', '.eslintrc*', '.prettierrc*', 'prettier.config.*',
    'postcss.config.*', 'tailwind.config.*', '.editorconfig', '.gitignore', '.npmrc', '.env.example',
    '.env.template', '.env.sample', 'components.json', 'env.d.ts', 'vite-env.d.ts', 'Cargo.toml',
    'Cargo.lock', 'build.rs', 'rust-toolchain*', 'rustfmt.toml', 'tauri.conf.*', 'Makefile', 'justfile'
)
$ExcludedDirectories = @(
    'node_modules', 'target', 'dist', 'build', 'out', 'release', 'releases', 'debug', 'portable',
    'portable-output', 'installer', 'installers', 'artifacts', 'coverage', '.git', '.cache', '.turbo',
    '.vite', '.parcel-cache', 'cache', 'temp', 'tmp', 'logs', 'backups'
)
$ExcludedFiles = @(
    '*.exe', '*.msi', '*.msix', '*.appx', '*.appxbundle', '*.dll', '*.pdb', '*.obj', '*.o',
    '*.rlib', '*.rmeta', '*.ilk', '*.exp', '*.lib', '*.zip', '*.7z', '*.rar', '*.tar', '*.gz',
    '*.log', '*.md', '*.markdown', '*.tmp', '*.temp', '*.bak', '*.old', '*.map', '*.db',
    '*.sqlite', '*.sqlite3', '*.eod', 'Thumbs.db', 'desktop.ini', '.env', '.env.local',
    '.env.development', '.env.production', '.env.test'
)
$DocumentationExcludedFiles = @($ExcludedFiles | Where-Object { $_ -notin @('*.md', '*.markdown') })
$ExcludedDirectoryNames = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
foreach ($directoryName in $ExcludedDirectories) {
    $null = $ExcludedDirectoryNames.Add($directoryName)
}

$SelectedDirectories = New-Object 'System.Collections.Generic.List[string]'
foreach ($relativeDirectory in $CandidateSourceDirectories) {
    $fullPath = Join-Path $Source $relativeDirectory
    if (Test-Path -LiteralPath $fullPath -PathType Container) {
        $SelectedDirectories.Add($relativeDirectory)
    }
}
$sdkSource = Join-Path $Source $OptionalSdkDirectory
$SdkIncluded = Test-Path -LiteralPath $sdkSource -PathType Container
if ($SdkIncluded) {
    $SelectedDirectories.Add($OptionalSdkDirectory)
}

$missingRequiredDocumentationFiles = New-Object 'System.Collections.Generic.List[string]'
foreach ($fileName in $RequiredDocumentationFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $Source $fileName) -PathType Leaf)) {
        $missingRequiredDocumentationFiles.Add($fileName)
    }
}
if ($missingRequiredDocumentationFiles.Count -gt 0) {
    throw "Required root-level documentation files are missing:`n$($missingRequiredDocumentationFiles -join [Environment]::NewLine)"
}
$missingRequiredSourceFiles = New-Object 'System.Collections.Generic.List[string]'
foreach ($relativePath in $RequiredSourceFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $Source $relativePath) -PathType Leaf)) {
        $missingRequiredSourceFiles.Add($relativePath)
    }
}
if ($missingRequiredSourceFiles.Count -gt 0) {
    throw "Critical source/build configuration files are missing:`n$($missingRequiredSourceFiles -join [Environment]::NewLine)"
}
$missingRequiredRuntimeMarkdownResources = New-Object 'System.Collections.Generic.List[string]'
foreach ($relativePath in $RequiredRuntimeMarkdownResources) {
    if (-not (Test-Path -LiteralPath (Join-Path $Source $relativePath) -PathType Leaf)) {
        $missingRequiredRuntimeMarkdownResources.Add($relativePath)
    }
}
if ($missingRequiredRuntimeMarkdownResources.Count -gt 0) {
    throw "Required runtime/build Markdown resources are missing:`n$($missingRequiredRuntimeMarkdownResources -join [Environment]::NewLine)"
}
$DocumentationSource = Join-Path $Source $DocumentationDirectory
if (-not $SourceAudit -and -not (Test-Path -LiteralPath $DocumentationSource -PathType Container)) {
    throw "Required documentation directory is missing: $DocumentationDirectory"
}

$RootFiles = @(
    foreach ($pattern in $RootFilePatterns) {
        Get-ChildItem -Path (Join-Path $Source $pattern) -File -Force -ErrorAction SilentlyContinue
    }
    foreach ($fileName in $RequiredDocumentationFiles) {
        Get-Item -LiteralPath (Join-Path $Source $fileName) -Force
    }
) | Sort-Object FullName -Unique

$ExpectedByRelativePath = New-Object 'System.Collections.Generic.Dictionary[string,object]' ([System.StringComparer]::OrdinalIgnoreCase)
foreach ($relativeDirectory in $SelectedDirectories) {
    foreach ($file in (Get-FilteredFiles -Path (Join-Path $Source $relativeDirectory) -ExcludedFilePatterns $ExcludedFiles -ExcludedDirectoryNames $ExcludedDirectoryNames)) {
        Add-ExpectedFile -ExpectedByRelativePath $ExpectedByRelativePath -SourceRoot $Source -File $file
    }
}
if ($SourceAudit) {
    Add-ExpectedFile -ExpectedByRelativePath $ExpectedByRelativePath -SourceRoot $Source -File (Get-Item -LiteralPath (Join-Path $Source $RequiredTestFixture) -Force)
}
else {
    foreach ($file in (Get-FilteredFiles -Path $DocumentationSource -ExcludedFilePatterns $DocumentationExcludedFiles -ExcludedDirectoryNames $ExcludedDirectoryNames)) {
        Add-ExpectedFile -ExpectedByRelativePath $ExpectedByRelativePath -SourceRoot $Source -File $file
    }
}
foreach ($relativePath in $RequiredRuntimeMarkdownResources) {
    Add-ExpectedFile -ExpectedByRelativePath $ExpectedByRelativePath -SourceRoot $Source -File (Get-Item -LiteralPath (Join-Path $Source $relativePath) -Force)
}
foreach ($file in $RootFiles) {
    Add-ExpectedFile -ExpectedByRelativePath $ExpectedByRelativePath -SourceRoot $Source -File $file
}
foreach ($relativePath in $RequiredSourceFiles) {
    if (-not $ExpectedByRelativePath.ContainsKey($relativePath)) {
        throw "Required source file was not selected for the ZIP: $relativePath"
    }
}
foreach ($relativePath in $RequiredRuntimeMarkdownResources) {
    if (-not $ExpectedByRelativePath.ContainsKey($relativePath)) {
        throw "Required runtime Markdown resource was not selected for the ZIP: $relativePath"
    }
}

$ExpectedSourceFiles = @($ExpectedByRelativePath.Values | Sort-Object RelativePath)
$SourceBytes = ($ExpectedSourceFiles | Measure-Object -Property InitialLength -Sum).Sum
if ($null -eq $SourceBytes) {
    $SourceBytes = 0
}

Write-Host ''
Write-Host 'EOD SOURCE SNAPSHOT PLAN' -ForegroundColor Cyan
Write-Host "Source           : $Source"
Write-Host "Output           : $Destination"
Write-Host "Source files     : $($ExpectedSourceFiles.Count)"
Write-Host ("Source size      : {0:N2} MB" -f ($SourceBytes / 1MB))
if ($SourceAudit) {
    Write-Host 'Documentation    : AGENTS.md only (runtime resources and test fixture included)'
}
else {
    Write-Host "Documentation    : $DocumentationDirectory (complete eligible tree)"
}
if ($SdkIncluded) {
    Write-Host "Plugin SDK       : INCLUDED ($OptionalSdkDirectory)"
}
if (-not $SdkIncluded) {
    Write-Host "Plugin SDK       : ABSENT (optional)"
}
Write-Host 'Intermediate dir : NONE'
Write-Host 'Exclusions       : dependencies, generated output, binaries, archives, databases, market data, logs, caches, secrets, backups, Git metadata, and reparse points'
Write-Host ''
$confirmation = Read-Host 'Type COPY to create and verify the timestamped source ZIP'
if ($confirmation -cne 'COPY') {
    Write-Host 'Cancelled. No archive was created.' -ForegroundColor Yellow
    exit 0
}
if (Test-Path -LiteralPath $Destination) {
    throw "Destination already exists: $Destination"
}

$TemporaryZipOwned = $false
try {
    $null = [System.IO.Directory]::CreateDirectory($AuditRootPath)
    Assert-NoReparsePointInExistingPath -Path $AuditRootPath
    if (Test-Path -LiteralPath $Destination) {
        throw "Destination already exists: $Destination"
    }
    if (Test-Path -LiteralPath $TemporaryZipPath) {
        throw "Temporary ZIP path already exists: $TemporaryZipPath"
    }
    $TemporaryZipOwned = $true
    $zipFileStream = $null
    $archive = $null
    try {
        $zipFileStream = [System.IO.File]::Open(
            $TemporaryZipPath,
            [System.IO.FileMode]::CreateNew,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::None
        )
        $archive = New-Object System.IO.Compression.ZipArchive(
            $zipFileStream,
            [System.IO.Compression.ZipArchiveMode]::Create,
            $false
        )
        foreach ($expectedFile in $ExpectedSourceFiles) {
            Write-SourceFileToZipEntry -Archive $archive -ExpectedFile $expectedFile -ArchiveRoot $archiveBaseName
        }
    }
    finally {
        if ($null -ne $archive) {
            $archive.Dispose()
        }
        if ($null -ne $zipFileStream) {
            $zipFileStream.Dispose()
        }
    }
    $verification = Test-ZipSnapshot -ZipPath $TemporaryZipPath -ExpectedFiles $ExpectedSourceFiles -ArchiveRoot $archiveBaseName -SkipContentHashVerification ([bool]$SkipHashVerification)
    Assert-VerifiedSourcesStable -ExpectedFiles $ExpectedSourceFiles
    $zipItem = Get-Item -LiteralPath $TemporaryZipPath -Force
    $zipSize = [long]$zipItem.Length
    $zipHashResult = Get-FileSha256WithMetadata -Path $TemporaryZipPath
    $zipHash = $zipHashResult.Hash
    if (Test-Path -LiteralPath $Destination) {
        throw "Destination appeared before publication and will not be overwritten: $Destination"
    }
    Move-Item -LiteralPath $TemporaryZipPath -Destination $Destination
    $TemporaryZipOwned = $false

    Write-Host ''
    Write-Host 'EOD SOURCE SNAPSHOT' -ForegroundColor Cyan
    Write-Host ''
    Write-Host "Source           : $Source"
    Write-Host "Output           : $Destination"
    Write-Host ''
    Write-Host "Source files     : $($ExpectedSourceFiles.Count)"
    Write-Host ("Source size      : {0:N2} MB" -f ($SourceBytes / 1MB))
    Write-Host ("ZIP size         : {0:N2} MB" -f ($zipSize / 1MB))
    Write-Host "Missing files    : $($verification.MissingCount)"
    Write-Host "Unexpected files : $($verification.UnexpectedCount)"
    if ($SkipHashVerification) {
        Write-Host 'Hash verification: SKIPPED BY REQUEST'
    }
    if (-not $SkipHashVerification) {
        Write-Host "Hash mismatches  : $($verification.HashMismatchCount)"
    }
    Write-Host 'ZIP integrity    : PASS'
    Write-Host "ZIP SHA-256      : $zipHash"
    Write-Host ''
    Write-Host 'STATUS: SNAPSHOT CREATED AND VERIFIED' -ForegroundColor Green
}
catch {
    if ($TemporaryZipOwned -and (Test-Path -LiteralPath $TemporaryZipPath -PathType Leaf)) {
        Remove-Item -LiteralPath $TemporaryZipPath -Force
    }
    throw
}
