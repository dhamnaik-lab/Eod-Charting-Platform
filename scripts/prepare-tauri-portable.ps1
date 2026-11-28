param(
  [string]$CandidateRoot,
  [ValidatePattern('^[0-9A-Fa-f]{64}$')]
  [string]$ExpectedCandidateExeSha256
)

$ErrorActionPreference = 'Stop'

if ($CandidateRoot -and !$ExpectedCandidateExeSha256) {
  throw 'CandidateRoot requires ExpectedCandidateExeSha256 recorded from the candidate build.'
}
if ($ExpectedCandidateExeSha256 -and !$CandidateRoot) {
  throw 'ExpectedCandidateExeSha256 requires CandidateRoot.'
}

function Get-Sha256Hex {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
  $stream = [System.IO.File]::OpenRead($resolvedPath)

  try {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()

    try {
      $hashBytes = $sha256.ComputeHash($stream)
      return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '')
    }
    finally {
      $sha256.Dispose()
    }
  }
  finally {
    $stream.Dispose()
  }
}


$workspaceRoot = Split-Path -Parent $PSScriptRoot
$sourceExe = Join-Path $workspaceRoot 'target\release\eod-charting-platform-shell.exe'
$rendererDistRoot = Join-Path $workspaceRoot 'dist'
$portableBase = Join-Path $workspaceRoot 'release\tauri-portable-win'
$buildMetadataPath = Join-Path $workspaceRoot 'src-tauri-shell\gen\build-info.json'
if ($CandidateRoot) {
  $candidate = (Get-Item -LiteralPath $CandidateRoot -ErrorAction Stop).FullName
  $tmp = (Get-Item -LiteralPath (Join-Path $workspaceRoot 'tmp')).FullName
  $prefix = $tmp.TrimEnd('\') + '\'
  if (!$candidate.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'CandidateRoot must be below project tmp.'
  }
  $ancestor = Get-Item -LiteralPath $candidate
  while ($ancestor.FullName.Length -ge $tmp.Length) {
    if ($ancestor -isnot [IO.DirectoryInfo] -or ($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      throw "Candidate path is not an ordinary directory: $($ancestor.FullName)"
    }
    $ancestor = $ancestor.Parent
  }
  $rendererDistRoot = Join-Path $candidate 'renderer'
  $buildMetadataPath = Join-Path $candidate 'build-info.json'
  $portableBase = Join-Path $candidate 'portable'
  if (Test-Path -LiteralPath $portableBase) {
    throw "Candidate output already exists: $portableBase"
  }
}
$portableName = 'EOD Chart Portable'
$portableRoot = Join-Path $portableBase $portableName
$stagingRoot = Join-Path $portableBase "_staging-$portableName"

if (!(Test-Path $sourceExe)) {
  throw "Missing built Tauri executable: $sourceExe`nRun 'npm run tauri:build' first."
}

if (!(Test-Path (Join-Path $rendererDistRoot 'index.html'))) {
  throw "Missing built renderer assets: $rendererDistRoot`nRun 'npm run build:renderer' first."
}

if (!(Test-Path $buildMetadataPath)) {
  throw "Missing generated build metadata: $buildMetadataPath`nRun 'npm run tauri:build' first."
}

if ($CandidateRoot) {
  $sourceExeHash = Get-Sha256Hex -Path $sourceExe
  if ($sourceExeHash -ne $ExpectedCandidateExeSha256) {
    throw "Candidate executable hash mismatch before staging. Expected=$ExpectedCandidateExeSha256 Source=$sourceExeHash Path=$sourceExe"
  }
}

if ((Test-Path $stagingRoot) -and !$CandidateRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

$portableExe = Join-Path $stagingRoot 'EOD Chart.exe'
$portableLauncher = Join-Path $stagingRoot 'Launch Portable EOD Chart.cmd'
$portableDataDir = Join-Path $stagingRoot 'portable-data'
$portableStateDir = Join-Path $portableDataDir 'state'
$portableLogDir = Join-Path $portableDataDir 'logs'
$readmePath = Join-Path $stagingRoot 'README.txt'

$null = New-Item -ItemType Directory -Path $stagingRoot -Force
$null = New-Item -ItemType Directory -Path $portableStateDir -Force
$null = New-Item -ItemType Directory -Path $portableLogDir -Force

Copy-Item -LiteralPath $sourceExe -Destination $portableExe -Force
Copy-Item -Path (Join-Path $rendererDistRoot '*') -Destination $stagingRoot -Recurse -Force

if (!$CandidateRoot) {
  $sourceExeHash = Get-Sha256Hex -Path $sourceExe
}
$portableExeHash = Get-Sha256Hex -Path $portableExe

if ($sourceExeHash -ne $portableExeHash) {
  throw "Portable executable hash mismatch. Source=$sourceExeHash Portable=$portableExeHash"
}

Write-Host "Verified portable executable SHA-256: $portableExeHash"

$launcher = @"
@echo off
setlocal
set "EOD_CHART_PORTABLE_ROOT=%~dp0portable-data"
start "" /D "%~dp0" "%~dp0EOD Chart.exe"
"@

Set-Content -Path $portableLauncher -Value $launcher -Encoding ASCII

$buildMetadata = Get-Content -Path $buildMetadataPath -Raw | ConvertFrom-Json
$builtAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
$readme = @"
EOD Chart portable Windows preview

Version:
  $($buildMetadata.version)

Build Number:
  $($buildMetadata.buildNumber)

Build Metadata Timestamp:
  $($buildMetadata.builtAt)

Launch:
  Launch Portable EOD Chart.cmd

Fallback launch:
  EOD Chart.exe

Portable mode:
  Portable mode is guaranteed when you use the launcher because it sets EOD_CHART_PORTABLE_ROOT to the local portable-data folder.
  The launcher also forces the working directory to the portable app folder so frontend assets resolve consistently.
  The bare exe can still launch, but the launcher is the supported workflow for predictable portable paths and asset resolution.
  You can move this whole folder to another Windows PC and keep the app's runtime state with it.

Runtime state paths:
  Runtime state root: portable-data\state
  Profile bootstrap pointer: portable-data\state\app-profile-location.json
  Runtime log file: portable-data\logs\app-runtime.log
  Frontend assets: index.html and assets\ staged directly beside EOD Chart.exe

Application profile:
  Default profile root: Documents\EOD Chart Profile
  App settings file: <profile>\app-settings.json
  Recent database file: <profile>\database-registry.json
  The Settings dialog can browse to a different profile folder when you want app-level state to live outside the default Documents path.

Database note:
  Your actual chart database folders stay wherever you create or open them.
  The portable folder stores runtime diagnostics and profile bootstrap state, not the market database itself.

Requirement:
  Microsoft WebView2 Runtime must be available on the target Windows machine.

Built:
  $builtAt
"@

Set-Content -Path $readmePath -Value $readme -Encoding UTF8

$finalRoot = $portableRoot
if (Test-Path $portableRoot) {
  if ($CandidateRoot) { throw "Candidate output unexpectedly exists: $portableRoot" }
  try {
    Remove-Item -LiteralPath $portableRoot -Recurse -Force -ErrorAction Stop
  } catch {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $finalRoot = Join-Path $portableBase "$portableName $timestamp"
    Write-Warning "Could not replace '$portableRoot' because it is in use. Writing this build to '$finalRoot' instead. Close any running portable app before rebuilding the standard folder."
  }
}

Move-Item -LiteralPath $stagingRoot -Destination $finalRoot -Force
Write-Output $finalRoot
