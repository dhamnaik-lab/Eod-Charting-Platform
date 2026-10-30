#requires -Version 7.5
[CmdletBinding()]
param(
    [Parameter()][ValidateSet('Create','Preview','Cleanup')][string]$Action = 'Preview',
    [Parameter()][ValidatePattern('^[A-Za-z][A-Za-z0-9_-]{1,30}$')][string]$Tag,
    [Parameter()][ValidatePattern('^[A-Za-z][A-Za-z0-9_-]{1,30}_[0-9a-f]{32}$')][string]$WorkspaceId,
    [Parameter()][ValidateRange(0,365)][int]$RetentionDays = 7,
    [Parameter()][switch]$ConfirmExactWorkspace
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = 'E:\TA Projects\EOD Charting Platform'
$managed = Join-Path $root 'tmp\disposable'
$markerName = '.eod-tmp01-disposable.json'
$schema = 'EOD_TMP01_V1'
$stampFormat = 'yyyy-MM-ddTHH:mm:ss.fffffffZ'

function Assert-OrdinaryPath([string]$path) {
    $item = Get-Item -LiteralPath $path -Force -ErrorAction Stop
    while ($null -ne $item) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Reparse point in ancestry: $($item.FullName)"
        }
        if ($item -is [IO.FileInfo]) {
            $item = $item.Directory
            continue
        }
        if ($null -eq $item.Parent) { break }
        $item = $item.Parent
    }
}
function Assert-ManagedRoot {
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw 'Wrong or missing workstream root' }
    if (-not (Test-Path -LiteralPath (Join-Path $root 'tmp') -PathType Container)) { throw 'Missing project tmp directory' }
    Assert-OrdinaryPath -path $root
    Assert-OrdinaryPath -path (Join-Path $root 'tmp')
    if (Test-Path -LiteralPath $managed) {
        if (-not (Test-Path -LiteralPath $managed -PathType Container)) { throw 'Managed scratch path is not a directory' }
        Assert-OrdinaryPath -path $managed
    }
}
function Assert-WorkspaceId([string]$id) {
    if ($id -cnotmatch '^[A-Za-z][A-Za-z0-9_-]{1,30}_[0-9a-f]{32}$') {
        throw "Invalid disposable workspace ID: $id"
    }
    $p = Join-Path $managed $id
    if ([IO.Path]::GetFullPath($p).TrimEnd('\') -cne ([IO.Path]::GetFullPath($managed).TrimEnd('\') + '\' + $id)) {
        throw 'Workspace path mismatch'
    }
    return $p
}
function Read-ManagedMarker([string]$id) {
    $path = Assert-WorkspaceId -id $id
    if (-not (Test-Path -LiteralPath $path -PathType Container)) { throw "Workspace missing: $id" }
    Assert-OrdinaryPath -path $path
    $markerPath = Join-Path $path $markerName
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) { throw "Unmarked directory is protected: $id" }
    Assert-OrdinaryPath -path $markerPath
    $m = Get-Content -LiteralPath $markerPath -Raw -ErrorAction Stop | ConvertFrom-Json -DateKind String -ErrorAction Stop
    if ($m.schema -cne $schema -or $m.workspaceId -cne $id -or $m.workstreamRoot -cne $root -or $m.purpose -cne 'scratch-only') {
        throw "Invalid workspace ownership marker: $id"
    }
    $utc = [datetime]::MinValue
    if (-not [datetime]::TryParseExact([string]$m.createdUtc,$stampFormat,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::AssumeUniversal,[ref]$utc)) {
        throw "Invalid marker creation timestamp: $id"
    }
    if ($utc.ToUniversalTime() -gt [datetime]::UtcNow.AddMinutes(5)) { throw "Marker timestamp is in the future: $id" }
    return [pscustomobject]@{ Path=$path; Marker=$markerPath; CreatedUtc=$utc.ToUniversalTime(); DirectoryCreatedUtc=(Get-Item -LiteralPath $path).CreationTimeUtc }
}
function Check-ProtectedContents([string]$workspace) {
    $deniedDirs = @('target','cargo-target','rust-target','src','src-tauri-shell','node_modules','docs','evidence','backup','backups','database','databases','recovery','journals','journal','release','dist','.git','snapshots','snapshot')
    $deniedPatterns = @('*.db','*.db3','*.sqlite','*.sqlite3','*.sqlite-*','*.sqlite3-*','*.eod','*.zip','*.7z','*.rar','*.bak','*.ps1','*.rs','*.tsx','*.ts','*.exe','*.dll','*.pdb','*.env','*.lock')
    $items = @(Get-ChildItem -LiteralPath $workspace -Recurse -Force -ErrorAction Stop)
    foreach ($item in $items) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Nested reparse point: $($item.FullName)" }
        if ($item -is [IO.DirectoryInfo] -and $deniedDirs -contains $item.Name.ToLowerInvariant()) {
            throw "Protected directory in scratch workspace: $($item.FullName)"
        }
        if ($item -is [IO.FileInfo]) {
            foreach ($pattern in $deniedPatterns) {
                if ($item.Name -like $pattern) { throw "Protected file in scratch workspace: $($item.FullName)" }
            }
            if ($item.Name -match '(?i)(?:^|[_\-.])(?:evidence|snapshot|recovery|credential|secret|database|backup)(?:[_\-.]|$)') {
                throw "Protected-looking file in scratch workspace: $($item.FullName)"
            }
        }
    }
    return $items
}
function Assert-NoActiveWriters {
    $names = @('EOD Chart','eod-charting-platform-shell','cargo','rustc','rustdoc','tauri','cl','link','lld-link')
    $active = @(Get-Process -Name $names -ErrorAction SilentlyContinue)
    if ($active.Count -gt 0) { throw ('Active app/build process: ' + ($active.ProcessName -join ', ')) }
}

Assert-ManagedRoot
Write-Host "WORKSTREAM: $root"
Write-Host "TMP-01 ACTION: $Action"
Write-Host "MANAGED PREFIX: $managed"
Write-Host 'BOUNDARY: marked scratch-only workspace; no existing unmarked tmp, source, Cargo caches, databases, evidence or recovery files.'

if ($Action -eq 'Create') {
    if ([string]::IsNullOrWhiteSpace($Tag)) { throw 'Create requires -Tag' }
    if (-not [string]::IsNullOrWhiteSpace($WorkspaceId)) { throw 'Create accepts -Tag, not -WorkspaceId' }
    if (Test-Path -LiteralPath $managed) {
        Assert-OrdinaryPath -path $managed
    }
    if (-not (Test-Path -LiteralPath $managed)) {
        $null = New-Item -Path $managed -ItemType Directory -ErrorAction Stop
    }
    $id = '{0}_{1}' -f $Tag,([guid]::NewGuid().ToString('N'))
    $path = Assert-WorkspaceId -id $id
    if (Test-Path -LiteralPath $path) { throw 'Generated workspace ID collision' }
    $null = New-Item -Path $path -ItemType Directory -ErrorAction Stop
    $marker = [ordered]@{
        schema=$schema
        workspaceId=$id
        workstreamRoot=$root
        purpose='scratch-only'
        createdUtc=[datetime]::UtcNow.ToString($stampFormat,[Globalization.CultureInfo]::InvariantCulture)
    }
    $marker | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $path $markerName) -Encoding utf8 -ErrorAction Stop
    $null = Read-ManagedMarker -id $id
    Write-Output "WORKSPACE_ID: $id"
    Write-Host "WORKSPACE_PATH: $path"
    Write-Output 'STATUS: TMP01_CREATED_MARKED_SCRATCH_WORKSPACE'
    return
}

if ($Action -eq 'Preview') {
    $ids = @()
    if (-not [string]::IsNullOrWhiteSpace($WorkspaceId)) { $ids = @($WorkspaceId) }
    if ([string]::IsNullOrWhiteSpace($WorkspaceId) -and (Test-Path -LiteralPath $managed -PathType Container)) {
        $ids = @(Get-ChildItem -LiteralPath $managed -Directory -Force -ErrorAction Stop | Select-Object -ExpandProperty Name)
    }
    foreach ($id in $ids) {
        $status = 'PROTECTED_OR_UNMARKED'
        $gib = $null
        $older = $false
        try {
            $entry = Read-ManagedMarker -id $id
            $items = @(Check-ProtectedContents -workspace $entry.Path)
            $bytes = [double]0
            foreach ($item in $items) {
                if ($item -is [IO.FileInfo]) { $bytes += [double]$item.Length }
            }
            $gib = [math]::Round($bytes / 1GB,5)
            $threshold = [datetime]::UtcNow.AddDays(-$RetentionDays)
            $older = ($entry.CreatedUtc -le $threshold -and $entry.DirectoryCreatedUtc -le $threshold)
            $status = 'RETAIN_AGE'
            if ($older) { $status = 'ELIGIBLE_WITH_EXACT_CONFIRMATION' }
        }
        catch {
            if (-not [string]::IsNullOrWhiteSpace($WorkspaceId)) { throw }
            Write-Host "CANDIDATE: $id; STATUS: PROTECTED; REASON: $($_.Exception.Message)"
            continue
        }
        Write-Host "CANDIDATE: $id; SIZE_GIB: $gib; STATUS: $status"
    }
    Write-Host 'Unmarked historical tmp directories are excluded from this managed prefix and are never removed.'
    Write-Output 'STATUS: TMP01_PREVIEW_COMPLETE_NO_DELETION'
    return
}

if ($Action -eq 'Cleanup') {
    if ([string]::IsNullOrWhiteSpace($WorkspaceId)) { throw 'Cleanup requires one exact -WorkspaceId' }
    if (-not $ConfirmExactWorkspace) { throw 'Cleanup requires -ConfirmExactWorkspace' }
    $entry = Read-ManagedMarker -id $WorkspaceId
    $items = @(Check-ProtectedContents -workspace $entry.Path)
    $threshold = [datetime]::UtcNow.AddDays(-$RetentionDays)
    if ($entry.CreatedUtc -gt $threshold -or $entry.DirectoryCreatedUtc -gt $threshold) {
        throw "Retention period not elapsed for $WorkspaceId"
    }
    if ($RetentionDays -eq 0) {
        if ($items.Count -ne 1 -or $items[0].FullName -cne $entry.Marker) {
            throw 'Zero-day cleanup allowed only for an empty scratch workspace containing its marker'
        }
    }
    Assert-NoActiveWriters
    $beforeNames = @(Get-ChildItem -LiteralPath $managed -Force | Select-Object -ExpandProperty Name | Sort-Object)
    # Recheck exact path/marker and content before deletion.
    $entry = Read-ManagedMarker -id $WorkspaceId
    $null = Check-ProtectedContents -workspace $entry.Path
    Write-Host "CLEANUP EXACT WORKSPACE: $($entry.Path)"
    Remove-Item -LiteralPath $entry.Path -Recurse -Force -ErrorAction Stop
    if (Test-Path -LiteralPath $entry.Path) { throw 'Workspace still present after deletion' }
    $expectedNames = @($beforeNames | Where-Object { $_ -cne $WorkspaceId })
    $afterNames = @(Get-ChildItem -LiteralPath $managed -Force | Select-Object -ExpandProperty Name | Sort-Object)
    if ([string]::Join([char]0,$expectedNames) -cne [string]::Join([char]0,$afterNames)) {
        throw 'Unrelated managed workspace entry mismatch after cleanup'
    }
    Write-Output 'STATUS: TMP01_EXACT_MARKED_WORKSPACE_REMOVED'
    return
}
throw "Unsupported action: $Action"
