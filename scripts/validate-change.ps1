[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("docs", "renderer", "tauri", "corporate-actions")]
    [string]$Profile,

    [switch]$Full,

    [string[]]$Paths = @()
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

$steps = [System.Collections.Generic.List[object]]::new()

function Add-Step {
    param([string]$Name, [string]$Command, [string[]]$Arguments)
    $steps.Add([pscustomobject]@{ Name = $Name; Command = $Command; Arguments = $Arguments })
}

function Invoke-Step {
    param([pscustomobject]$Step)

    Write-Host "`n[RUN ] $($Step.Name)" -ForegroundColor Cyan
    & $Step.Command @($Step.Arguments)
    $exitCode = $LASTEXITCODE
    if ($null -eq $exitCode) { $exitCode = 0 }

    if ($exitCode -ne 0) {
        Write-Host "[FAIL] $($Step.Name) (exit $exitCode)" -ForegroundColor Red
        exit $exitCode
    }

    Write-Host "[PASS] $($Step.Name)" -ForegroundColor Green
}

switch ($Profile) {
    "docs" {
        Add-Step "Live documentation references" "powershell" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\scripts\check-doc-references.ps1")
    }
    "renderer" {
        Add-Step "Renderer typecheck" "npm" @("run", "typecheck:renderer")
        if ($Full) {
            Add-Step "Unit tests" "npm" @("run", "test")
            Add-Step "Renderer build" "npm" @("run", "build:renderer")
        }
    }
    "tauri" {
        Add-Step "Rust format check" "cargo" @("fmt", "--manifest-path", "src-tauri-shell/Cargo.toml", "--check")
        Add-Step "Renderer typecheck" "npm" @("run", "typecheck:renderer")
        Add-Step "Tauri compile check" "npm" @("run", "tauri:check")
        if ($Full) { Add-Step "Unit tests" "npm" @("run", "test") }
    }
    "corporate-actions" {
        Add-Step "Rust format check" "cargo" @("fmt", "--manifest-path", "src-tauri-shell/Cargo.toml", "--check")
        Add-Step "Corporate-action tests" "cargo" @("test", "--manifest-path", "src-tauri-shell/Cargo.toml", "corporate_action_imports", "--", "--nocapture")
        Add-Step "Renderer typecheck" "npm" @("run", "typecheck:renderer")
        Add-Step "Tauri compile check" "npm" @("run", "tauri:check")
        if ($Full) { Add-Step "Unit tests" "npm" @("run", "test") }
    }
}

$diffArguments = [System.Collections.Generic.List[string]]::new()
$diffArguments.Add("diff")
$diffArguments.Add("--check")
if ($Paths.Count -gt 0) {
    $diffArguments.Add("--")
    foreach ($path in $Paths) { $diffArguments.Add($path) }
}
Add-Step "Whitespace check" "git" $diffArguments.ToArray()

Write-Host "Validation profile: $Profile$(if ($Full) { ' (Full)' })"
foreach ($step in $steps) { Invoke-Step $step }
Write-Host "`nAll selected checks passed." -ForegroundColor Green
