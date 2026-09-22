param(
  [Parameter(Mandatory = $true)]
  [string]$ShortName,

  [string[]]$Paths = @(),

  [string[]]$ExtraExcludePaths = @()
)

$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$sanitizedShortName = ($ShortName -replace '[^A-Za-z0-9_-]+', '_').Trim('_')
if ([string]::IsNullOrWhiteSpace($sanitizedShortName)) {
  throw 'ShortName must contain at least one ASCII letter, number, underscore, or dash.'
}

$backupRoot = Join-Path $workspaceRoot "backups\pre_opencode_changes_${timestamp}_${sanitizedShortName}"
$defaultPaths = @(
  'src',
  'src-tauri-shell',
  'scripts',
  'resources',
  'docs',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.mts',
  'vitest.config.ts',
  'index.html',
  '.gitignore',
  'AGENTS.md',
  'README.md',
  'FILE_INVENTORY.md',
  'CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md',
  'PROJECT_STATE_EOD_CHARTING_PLATFORM.md',
  'PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md',
  'NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md',
  'CLAUDE_HANDOFF_PROMPT_EOD_CHARTING_PLATFORM.md',
  'RISK_REGISTER.md'
)

if ($Paths.Count -eq 0) {
  $Paths = $defaultPaths
}

$excludedPrefixes = @(
  '.git',
  '.claude',
  'node_modules',
  'backups',
  'dist',
  'release',
  'analysis',
  'test-output',
  'EOD DATABASE',
  'src-tauri-shell\target',
  'resources\release',
  'docs\changes\backups',
  'EOD Charting Platform'
) + $ExtraExcludePaths

$excludedPrefixes = $excludedPrefixes |
  Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
  ForEach-Object { ($_ -replace '/', '\').Trim('\') } |
  Sort-Object -Unique

$excludedLeafNames = @('nul')
$excludedLeafPatterns = @('*.log', 'tmp_*.png', 'temp*.txt')

function Convert-ToWorkspaceRelativePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $resolved = [System.IO.Path]::GetFullPath($Path)
  if (-not $resolved.StartsWith($workspaceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path resolves outside the workspace: $resolved"
  }

  return $resolved.Substring($workspaceRoot.Length).TrimStart('\', '/').Replace('/', '\')
}

function Test-IsExcludedPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath
  )

  $normalized = ($RelativePath -replace '/', '\').Trim('\')
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return $false
  }

  $leaf = Split-Path -Path $normalized -Leaf
  if ($excludedLeafNames -contains $leaf.ToLowerInvariant()) {
    return $true
  }

  foreach ($pattern in $excludedLeafPatterns) {
    if ($leaf -like $pattern) {
      return $true
    }
  }

  foreach ($prefix in $excludedPrefixes) {
    if (
      $normalized.Equals($prefix, [System.StringComparison]::OrdinalIgnoreCase) -or
      $normalized.StartsWith("$prefix\", [System.StringComparison]::OrdinalIgnoreCase)
    ) {
      return $true
    }
  }

  return $false
}

function Copy-BackupFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourceFile
  )

  $relativeFile = Convert-ToWorkspaceRelativePath -Path $SourceFile
  if (Test-IsExcludedPath -RelativePath $relativeFile) {
    return $null
  }

  $destinationFile = Join-Path $backupRoot $relativeFile
  $destinationDir = Split-Path -Parent $destinationFile
  $null = New-Item -ItemType Directory -Path $destinationDir -Force
  Copy-Item -LiteralPath $SourceFile -Destination $destinationFile -Force
  return Get-Item -LiteralPath $SourceFile
}

$null = New-Item -ItemType Directory -Path $backupRoot -Force

$copiedFiles = New-Object System.Collections.Generic.List[object]
$copiedRelativePaths = New-Object System.Collections.Generic.HashSet[string] ([System.StringComparer]::OrdinalIgnoreCase)

foreach ($inputPath in ($Paths | Sort-Object -Unique)) {
  if ([string]::IsNullOrWhiteSpace($inputPath)) {
    continue
  }

  $absolutePath = Join-Path $workspaceRoot $inputPath
  if (-not (Test-Path -LiteralPath $absolutePath)) {
    continue
  }

  $relativeInput = Convert-ToWorkspaceRelativePath -Path $absolutePath
  if (Test-IsExcludedPath -RelativePath $relativeInput) {
    throw "Backup path resolves into an excluded prefix: $relativeInput"
  }

  $item = Get-Item -LiteralPath $absolutePath
  if ($item.PSIsContainer) {
    $null = New-Item -ItemType Directory -Path (Join-Path $backupRoot $relativeInput) -Force
    Get-ChildItem -LiteralPath $absolutePath -Recurse -Force -File | ForEach-Object {
      $copied = Copy-BackupFile -SourceFile $_.FullName
      if ($null -ne $copied) {
        $copiedFiles.Add($copied)
        $null = $copiedRelativePaths.Add((Convert-ToWorkspaceRelativePath -Path $copied.FullName))
      }
    }
  }
  else {
    $copied = Copy-BackupFile -SourceFile $absolutePath
    if ($null -ne $copied) {
      $copiedFiles.Add($copied)
      $null = $copiedRelativePaths.Add((Convert-ToWorkspaceRelativePath -Path $copied.FullName))
    }
  }
}

$manifest = [PSCustomObject]@{
  createdAt = (Get-Date).ToString('o')
  workspaceRoot = $workspaceRoot
  backupRoot = $backupRoot
  shortName = $sanitizedShortName
  requestedPaths = $Paths
  excludedPrefixes = $excludedPrefixes
  excludedLeafNames = $excludedLeafNames
  excludedLeafPatterns = $excludedLeafPatterns
  fileCount = $copiedFiles.Count
  totalBytes = ($copiedFiles | Measure-Object -Property Length -Sum).Sum
  copiedPaths = @($copiedRelativePaths | Sort-Object)
}

$manifestPath = Join-Path $backupRoot 'backup-manifest.json'
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8

$summary = @(
  "Created: $($manifest.createdAt)"
  "Backup root: $backupRoot"
  "Files copied: $($manifest.fileCount)"
  "Total MB: $([math]::Round(($manifest.totalBytes / 1MB), 2))"
  "Manifest: backup-manifest.json"
) -join [Environment]::NewLine

Set-Content -Path (Join-Path $backupRoot 'backup-summary.txt') -Value $summary -Encoding UTF8
Write-Output $backupRoot
