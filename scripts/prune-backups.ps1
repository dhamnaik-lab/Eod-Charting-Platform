param(
  [int]$KeepLatest = 30,

  [string[]]$PreserveNames = @(
    'pre_opencode_changes_20260404_150804_compact_backup_baseline'
  ),

  [switch]$Apply
)

$ErrorActionPreference = 'Stop'

if ($KeepLatest -lt 0) {
  throw 'KeepLatest must be zero or greater.'
}

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$backupsRoot = Join-Path $workspaceRoot 'backups'
if (-not (Test-Path -LiteralPath $backupsRoot)) {
  throw "Missing backups folder: $backupsRoot"
}

$backupDirs = Get-ChildItem -LiteralPath $backupsRoot -Directory -Force | Sort-Object LastWriteTime -Descending
$preserved = New-Object System.Collections.Generic.HashSet[string] ([System.StringComparer]::OrdinalIgnoreCase)
foreach ($name in $PreserveNames) {
  if (-not [string]::IsNullOrWhiteSpace($name)) {
    $null = $preserved.Add($name)
  }
}

$keptByName = @($backupDirs | Where-Object { $preserved.Contains($_.Name) })
$eligible = @($backupDirs | Where-Object { -not $preserved.Contains($_.Name) })
$keptRecent = @($eligible | Select-Object -First $KeepLatest)
$candidates = @($eligible | Select-Object -Skip $KeepLatest)

$rows = foreach ($dir in $candidates) {
  $measure = Get-ChildItem -LiteralPath $dir.FullName -Recurse -Force -File | Measure-Object -Property Length -Sum
  [PSCustomObject]@{
    Name = $dir.Name
    LastWrite = $dir.LastWriteTime
    SizeMB = [math]::Round(($measure.Sum / 1MB), 2)
    FileCount = $measure.Count
  }
}

$totalCandidateMB = [math]::Round((($rows | Measure-Object -Property SizeMB -Sum).Sum), 2)

if (-not $Apply) {
  Write-Output "Dry run only. Use -Apply to delete backup candidates."
  Write-Output "Preserved by name: $($keptByName.Count)"
  Write-Output "Kept recent backups: $($keptRecent.Count)"
  Write-Output "Prune candidates: $($rows.Count)"
  Write-Output "Candidate total MB: $totalCandidateMB"
  if ($rows.Count -gt 0) {
    $rows | Format-Table -AutoSize
  }
  return
}

foreach ($dir in $candidates) {
  $resolved = [System.IO.Path]::GetFullPath($dir.FullName)
  if (-not $resolved.StartsWith($backupsRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to delete outside backups folder: $resolved"
  }

  Remove-Item -LiteralPath $resolved -Recurse -Force
  Write-Output "DELETED $resolved"
}

Write-Output "Deleted $($rows.Count) backup directories totaling about $totalCandidateMB MB."
