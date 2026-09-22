[CmdletBinding()]
param(
    [string]$Source = 'E:\TA Projects\EOD Charting Platform',
    [string]$AuditRoot = 'E:\TA Projects\EOD Charting Platform Source Audit',
    [switch]$SkipHashVerification
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
    throw "Source project folder not found: $Source"
}

$Source = (Resolve-Path -LiteralPath $Source).Path.TrimEnd('\')

$istZone = [System.TimeZoneInfo]::FindSystemTimeZoneById('India Standard Time')
$istNow = [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $istZone)
$timestamp = $istNow.ToString('yyyy-MM-dd_HHmmss')
$Destination = Join-Path $AuditRoot ("Eod Charting Platform Source Code {0}_IST" -f $timestamp)

# Source-bearing directories only. A directory is selected only when it exists.
$CandidateSourceDirectories = @(
    '.cargo',
    'src',
    'src-tauri-shell',
    'public',
    'scripts',
    'tests',
    'test',
    'e2e',
    'tools',
    'resources',
    'config',
    'fixtures',
    'patches',
    'types'
)

# Exact root-level Markdown files included in every source snapshot.
# All other Markdown files remain excluded.
$RequiredDocumentationFiles = @(
    'AGENTS.md',
    'README.md',
    'FILE_INVENTORY.md',
    'HANDOFF.md',
    'REQUIREMENTS.md',
    'ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md',
    'FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md',
    'PROJECT_STATE_EOD_CHARTING_PLATFORM.md'
)

# Complete project documentation included in every source snapshot.
# Markdown is allowed throughout this tree; generated/binary/archive/database/log/secret clutter remains excluded.
$DocumentationDirectory = 'docs'

# Critical source/build configuration that must be present in a reproducible snapshot.
$RequiredSourceFiles = @(
    '.cargo\config.toml'
)

# Markdown files imported as runtime/build source dependencies.
# These remain included even though ordinary Markdown stays excluded.
$RequiredRuntimeMarkdownResources = @(
    'src\features\identityRecovery\resources\Official-Source-Recovery-Brief-For-Any-AI.md',
    'src\features\identityRecovery\resources\Identity-Investigation-Brief-For-Any-AI.md',
    'src\features\identityRecovery\resources\Identity-Recovery-Guide.md'
)

# Root-level project/build configuration required to reproduce or inspect the source.
$RootFilePatterns = @(
    'package.json',
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lock',
    'bun.lockb',
    'index.html',
    'tsconfig*.json',
    'vite.config.*',
    'vitest.config.*',
    'playwright.config.*',
    'eslint.config.*',
    '.eslintrc*',
    '.prettierrc*',
    'prettier.config.*',
    'postcss.config.*',
    'tailwind.config.*',
    '.editorconfig',
    '.gitignore',
    '.npmrc',
    '.env.example',
    '.env.template',
    '.env.sample',
    'components.json',
    'env.d.ts',
    'vite-env.d.ts',
    'Cargo.toml',
    'Cargo.lock',
    'build.rs',
    'rust-toolchain*',
    'rustfmt.toml',
    'tauri.conf.*',
    'Makefile',
    'justfile'
)

# Build output, dependencies, caches, repositories, installers, and runtime output.
$ExcludedDirectories = @(
    'node_modules',
    'target',
    'dist',
    'build',
    'out',
    'release',
    'releases',
    'debug',
    'portable',
    'portable-output',
    'installer',
    'installers',
    'artifacts',
    'coverage',
    '.git',
    '.cache',
    '.turbo',
    '.vite',
    '.parcel-cache',
    'cache',
    'temp',
    'tmp',
    'logs'
)

# Generated binaries, archives, databases, logs, source maps, and local secrets.
$ExcludedFiles = @(
    '*.exe',
    '*.msi',
    '*.msix',
    '*.appx',
    '*.appxbundle',
    '*.dll',
    '*.pdb',
    '*.obj',
    '*.o',
    '*.rlib',
    '*.rmeta',
    '*.ilk',
    '*.exp',
    '*.lib',
    '*.zip',
    '*.7z',
    '*.rar',
    '*.tar',
    '*.gz',
    '*.log',
    '*.md',
    '*.markdown',
    '*.tmp',
    '*.temp',
    '*.bak',
    '*.old',
    '*.map',
    '*.db',
    '*.sqlite',
    '*.sqlite3',
    'Thumbs.db',
    'desktop.ini',
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test'
)

# The complete docs tree is documentation, so Markdown is intentionally allowed there.
# Generated, binary, archive, database, log, and secret files remain excluded.
$DocumentationExcludedFiles = @(
    $ExcludedFiles | Where-Object { $_ -notin @('*.md', '*.markdown') }
)

$SelectedDirectories = @(
    foreach ($relativeDirectory in $CandidateSourceDirectories) {
        $fullPath = Join-Path $Source $relativeDirectory
        if (Test-Path -LiteralPath $fullPath -PathType Container) {
            $relativeDirectory
        }
    }
)

$MissingRequiredDocumentationFiles = @(
    foreach ($fileName in $RequiredDocumentationFiles) {
        $fullPath = Join-Path $Source $fileName
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            $fileName
        }
    }
)

if ($MissingRequiredDocumentationFiles.Count -gt 0) {
    $missingList = $MissingRequiredDocumentationFiles -join [Environment]::NewLine
    throw "Required root-level documentation files are missing:`n$missingList"
}


$MissingRequiredSourceFiles = @(
    foreach ($relativePath in $RequiredSourceFiles) {
        $fullPath = Join-Path $Source $relativePath
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            $relativePath
        }
    }
)

if ($MissingRequiredSourceFiles.Count -gt 0) {
    $missingList = $MissingRequiredSourceFiles -join [Environment]::NewLine
    throw "Critical source/build configuration files are missing:`n$missingList"
}

$MissingRequiredRuntimeMarkdownResources = @(
    foreach ($relativePath in $RequiredRuntimeMarkdownResources) {
        $fullPath = Join-Path $Source $relativePath
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            $relativePath
        }
    }
)

if ($MissingRequiredRuntimeMarkdownResources.Count -gt 0) {
    $missingList = $MissingRequiredRuntimeMarkdownResources -join [Environment]::NewLine
    throw "Required runtime/build Markdown resources are missing:`n$missingList"
}

$DocumentationSource = Join-Path $Source $DocumentationDirectory
if (-not (Test-Path -LiteralPath $DocumentationSource -PathType Container)) {
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

Write-Host ''
Write-Host 'SOURCE SNAPSHOT PLAN' -ForegroundColor Cyan
Write-Host "Source      : $Source"
Write-Host "Destination : $Destination"
Write-Host ''
Write-Host 'Directories selected:' -ForegroundColor Cyan
if ($SelectedDirectories.Count -eq 0) {
    Write-Host '  (none)'
}
if ($SelectedDirectories.Count -gt 0) {
    $SelectedDirectories | ForEach-Object { Write-Host "  $_" }
}

Write-Host ''
Write-Host 'Complete documentation directory selected:' -ForegroundColor Cyan
Write-Host "  $DocumentationDirectory"

Write-Host ''
Write-Host 'Root configuration and required documentation selected:' -ForegroundColor Cyan
if ($RootFiles.Count -eq 0) {
    Write-Host '  (none)'
}
if ($RootFiles.Count -gt 0) {
    $RootFiles | ForEach-Object { Write-Host "  $($_.Name)" }
}

Write-Host ''
Write-Host 'Required build configuration:' -ForegroundColor Cyan
$RequiredSourceFiles | ForEach-Object { Write-Host "  $_" }

Write-Host ''
Write-Host 'Required runtime/build Markdown resources:' -ForegroundColor Cyan
$RequiredRuntimeMarkdownResources | ForEach-Object { Write-Host "  $_" }

Write-Host ''
Write-Host 'Automatically excluded:' -ForegroundColor Yellow
Write-Host '  dependencies, target/build output, installers, archives, executables, databases, logs, caches, .git, and ordinary Markdown outside the complete docs tree, the eight required root documentation files, and required runtime/build Markdown resources'
Write-Host ''
$confirmation = Read-Host 'Type COPY to create the timestamped source snapshot'
if ($confirmation -cne 'COPY') {
    Write-Host 'Cancelled. No files were copied.' -ForegroundColor Yellow
    exit 0
}

if (Test-Path -LiteralPath $Destination) {
    throw "Destination already exists: $Destination"
}

New-Item -ItemType Directory -Path $Destination -Force | Out-Null

foreach ($relativeDirectory in $SelectedDirectories) {
    $from = Join-Path $Source $relativeDirectory
    $to = Join-Path $Destination $relativeDirectory
    New-Item -ItemType Directory -Path $to -Force | Out-Null

    $robocopyArguments = @(
        $from,
        $to,
        '/E',
        '/COPY:DAT',
        '/DCOPY:DAT',
        '/R:2',
        '/W:1',
        '/XJ',
        '/NP',
        '/NFL',
        '/NDL',
        '/NJH',
        '/NJS',
        '/XD'
    ) + $ExcludedDirectories + @('/XF') + $ExcludedFiles

    & robocopy @robocopyArguments | Out-Null
    $robocopyExitCode = $LASTEXITCODE

    # Robocopy exit codes 0 through 7 are success/non-fatal states.
    if ($robocopyExitCode -ge 8) {
        throw "Robocopy failed for '$relativeDirectory' with exit code $robocopyExitCode."
    }
}

$DocumentationDestination = Join-Path $Destination $DocumentationDirectory
New-Item -ItemType Directory -Path $DocumentationDestination -Force | Out-Null

$documentationRobocopyArguments = @(
    $DocumentationSource,
    $DocumentationDestination,
    '/E',
    '/COPY:DAT',
    '/DCOPY:DAT',
    '/R:2',
    '/W:1',
    '/XJ',
    '/NP',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/XD'
) + $ExcludedDirectories + @('/XF') + $DocumentationExcludedFiles

& robocopy @documentationRobocopyArguments | Out-Null
$documentationRobocopyExitCode = $LASTEXITCODE

if ($documentationRobocopyExitCode -ge 8) {
    throw "Robocopy failed for '$DocumentationDirectory' with exit code $documentationRobocopyExitCode."
}

foreach ($file in $RootFiles) {
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $Destination $file.Name) -Force
}

foreach ($relativePath in $RequiredRuntimeMarkdownResources) {
    $sourceFile = Join-Path $Source $relativePath
    $destinationFile = Join-Path $Destination $relativePath
    $destinationDirectory = Split-Path -Parent $destinationFile
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $sourceFile -Destination $destinationFile -Force
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
        [Parameter(Mandatory)][string[]]$ExcludedFilePatterns
    )

    $pending = New-Object 'System.Collections.Generic.Stack[string]'
    $pending.Push($Path)

    while ($pending.Count -gt 0) {
        $currentDirectory = $pending.Pop()

        foreach ($entry in [System.IO.Directory]::EnumerateFileSystemEntries($currentDirectory)) {
            $attributes = [System.IO.File]::GetAttributes($entry)

            if (($attributes -band [System.IO.FileAttributes]::Directory) -ne 0) {
                $directoryName = [System.IO.Path]::GetFileName($entry)

                if ($ExcludedDirectories -contains $directoryName) {
                    continue
                }

                if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
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

function Get-Sha256 {
    param([Parameter(Mandatory)][string]$Path)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::Open(
        $Path,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::ReadWrite
    )

    try {
        $hashBytes = $sha256.ComputeHash($stream)
        return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $stream.Dispose()
        $sha256.Dispose()
    }
}

$ExpectedSourceFiles = @(
    foreach ($relativeDirectory in $SelectedDirectories) {
        Get-FilteredFiles `
            -Path (Join-Path $Source $relativeDirectory) `
            -ExcludedFilePatterns $ExcludedFiles
    }

    Get-FilteredFiles `
        -Path $DocumentationSource `
        -ExcludedFilePatterns $DocumentationExcludedFiles

    foreach ($relativePath in $RequiredRuntimeMarkdownResources) {
        Get-Item -LiteralPath (Join-Path $Source $relativePath) -Force
    }

    $RootFiles
) | Sort-Object FullName -Unique

$ExpectedByRelativePath = @{}
foreach ($file in $ExpectedSourceFiles) {
    $relativePath = $file.FullName.Substring($Source.Length).TrimStart('\')
    $ExpectedByRelativePath[$relativePath] = $file.FullName
}

$MissingFiles = New-Object 'System.Collections.Generic.List[string]'
$HashMismatches = New-Object 'System.Collections.Generic.List[string]'

foreach ($relativePath in $ExpectedByRelativePath.Keys) {
    $sourceFile = $ExpectedByRelativePath[$relativePath]
    $destinationFile = Join-Path $Destination $relativePath

    if (-not (Test-Path -LiteralPath $destinationFile -PathType Leaf)) {
        $MissingFiles.Add($relativePath)
        continue
    }

    if (-not $SkipHashVerification) {
        $sourceHash = Get-Sha256 -Path $sourceFile
        $destinationHash = Get-Sha256 -Path $destinationFile

        if ($sourceHash -ne $destinationHash) {
            $HashMismatches.Add($relativePath)
        }
    }
}

$DestinationFiles = @(Get-ChildItem -LiteralPath $Destination -Recurse -File -Force)
$UnexpectedFiles = New-Object 'System.Collections.Generic.List[string]'

foreach ($file in $DestinationFiles) {
    $relativePath = $file.FullName.Substring($Destination.Length).TrimStart('\')
    if (-not $ExpectedByRelativePath.ContainsKey($relativePath)) {
        $UnexpectedFiles.Add($relativePath)
    }
}

$DestinationBytes = ($DestinationFiles | Measure-Object -Property Length -Sum).Sum
if ($null -eq $DestinationBytes) {
    $DestinationBytes = 0
}

Write-Host ''
Write-Host 'VERIFICATION RESULT' -ForegroundColor Cyan
Write-Host "Expected source files : $($ExpectedSourceFiles.Count)"
Write-Host "Copied files          : $($DestinationFiles.Count)"
Write-Host ("Copied size           : {0:N2} MB" -f ($DestinationBytes / 1MB))
Write-Host "Missing files          : $($MissingFiles.Count)"
Write-Host "Unexpected files       : $($UnexpectedFiles.Count)"
if ($SkipHashVerification) {
    Write-Host 'Hash verification     : SKIPPED'
}
if (-not $SkipHashVerification) {
    Write-Host "Hash mismatches        : $($HashMismatches.Count)"
}

if ($MissingFiles.Count -gt 0) {
    Write-Host ''
    Write-Host 'Missing:' -ForegroundColor Red
    $MissingFiles | ForEach-Object { Write-Host "  $_" }
}

if ($UnexpectedFiles.Count -gt 0) {
    Write-Host ''
    Write-Host 'Unexpected:' -ForegroundColor Red
    $UnexpectedFiles | ForEach-Object { Write-Host "  $_" }
}

if ($HashMismatches.Count -gt 0) {
    Write-Host ''
    Write-Host 'Hash mismatches:' -ForegroundColor Red
    $HashMismatches | ForEach-Object { Write-Host "  $_" }
}

if (
    $MissingFiles.Count -gt 0 -or
    $UnexpectedFiles.Count -gt 0 -or
    $HashMismatches.Count -gt 0
) {
    throw 'Source snapshot verification failed. Review the lists above.'
}

Write-Host ''
Write-Host 'SOURCE + COMPLETE DOCUMENTATION SNAPSHOT CREATED AND VERIFIED' -ForegroundColor Green
Write-Host $Destination -ForegroundColor Green
