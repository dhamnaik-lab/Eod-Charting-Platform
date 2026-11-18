# Reusable Windows validation workspace — bounded infrastructure change

**IST timestamp:** 2026-11-18 12:40 (UTC+05:30)
**Workstream/root:** EOD Charting Platform, E:\TA Projects\EOD Charting Platform
**Source authority:** GitHub main at 8c309050df3c52b33e8ba2ab4dc8c07a04a75ad6
**Review branch:** infra/reusable-windows-validation-20261118
**PR:** https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/120 (draft; merge HOLD)

## Objective and previous limitation

Reuse one authorized Windows checkout and its existing Node dependencies and project-root Cargo artifacts across repeated bounded validation tasks. Previously, engineers manually combined npm renderer checks with the BUILD-01 Cargo wrapper and separately located their evidence; repeated isolated worktrees/build targets increased setup and compilation overhead.

This change does **not** claim proven time savings. It standardizes repeatable commands and evidence capture; timings and cache-hit benefit must be measured on Windows.

## Inspected existing implementation and preservation boundary

Inspected from pinned GitHub source: AGENTS.md; package.json and package-lock existence; .gitignore; .cargo/config.toml; scripts/Invoke-EOD-SharedCargo.ps1; scripts/Invoke-EOD-TmpLifecycle.ps1; scripts/validate-change.ps1; scripts/prepare-tauri-portable.ps1; scripts/generate-build-metadata.cjs; .github/workflows/renderer-ci.yml; src-tauri-shell/Cargo.toml; src-tauri-shell/tauri.conf.json; relevant F-30 change records.

Existing BUILD-01 uses root target, offline/locked Cargo, serialized execution, and explicit guards against secondary Cargo targets in tmp. TMP-01 protects only marked disposable scratch directories. The portable build writes to the established release path. These mechanisms remain unchanged.

## Files changed

1. **Created:** scripts/Invoke-EOD-WindowsValidation.ps1 — new non-destructive validation entry point.
2. **Created:** .github/workflows/windows-validation-runner-parser.yml — parse-only PowerShell syntax gate on GitHub-hosted Ubuntu when runner/workflow changes.
3. **Created:** this IST change record.

No existing application, package, Cargo, source-control, or packaging file was modified. No new dependency was added. No local Windows backup was created because no local existing file was edited; Git commits retain pre-change source authority for rollback.

## Final implementation

- Default mode Preview performs no validation commands or file writes. It prints the planned renderer actions; RustCheck delegates to the existing shared Cargo Preview.
- Run mode operates exclusively at the exact authorized root and does not fetch branches or inspect Git state. Checkout SHA/dirty-tree verification remains an independent operator prerequisite.
- FocusedRenderer requires explicit existing paths underneath src/. FullRenderer runs the full renderer suite. Both run a read-only npm dependency-list check with --offline, TypeScript, Vitest, and the renderer Vite build. No npm install/ci is issued.
- RustCheck delegates Preview then Run to existing Invoke-EOD-SharedCargo.ps1, retaining --offline --locked, project-root target and its concurrency/secondary-cache safety rules.
- Each Run creates a uniquely named IST directory under tmp/validation-workspace and a PowerShell transcript with a final SHA-256. Retained evidence is never auto-deleted. It is not placed under tmp/disposable.
- Reparse-point, wrong-workstream, missing-path and argument-traversal guards fail closed.
- The runner never builds a Tauri release, stages a portable executable, launches the app, modifies database settings, or invokes destructive cleanup. Existing npm lifecycle scripts (including theme generation) execute unchanged; they may maintain their established generated theme-token source artifact.

## Validation — actual results versus pending checks

- **Static source scan**: PASS for absence of else/elseif, deletion commands, and Git mutation commands. This is not a PowerShell parser run.
- **GitHub renderer CI at script-only implementation commit 41230846aa0bdee6a5954be9e021060b24545d8f**: https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44256394256 — SUCCESS. Log shows 273 test files passed / 1 skipped; 1,892 tests passed / 1 skipped, TypeScript typecheck PASS, renderer Vite build PASS (4.25s). This workflow did not execute the Windows runner.
- **PowerShell parser CI at d444559a5513dc21dc4056a2fa81acada273afea**: https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44256674579 — SUCCESS. GitHub-hosted Ubuntu pwsh parsed scripts/Invoke-EOD-WindowsValidation.ps1; log printed PASS. The runner was not executed.
- **Renderer CI for d444559**: https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44256674541 — in progress at the time of this record.
- **Windows PowerShell 7 parser, Preview, FocusedRenderer Run, FullRenderer Run, RustCheck Run, caching speed comparison, portable native build**: NOT RUN. Do not extrapolate GitHub results to Windows acceptance.

## Windows operator verification (after approved branch fetch and protected-document hash checks)

At the verified authorized root and exact PR commit, parse the runner **before** execution:

    $Script = 'E:\TA Projects\EOD Charting Platform\scripts\Invoke-EOD-WindowsValidation.ps1'
    $Tokens = $null
    $Errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($Script, [ref]$Tokens, [ref]$Errors) | Out-Null
    if ($Errors.Count -gt 0) { $Errors; throw 'PowerShell parser failed' }

Start with no-write preflight:

    & $Script -Mode Preview -Profile FocusedRenderer -TestPaths @('src/features/charts/__tests__/chartRequestConsistency.test.ts')
    & $Script -Mode Preview -Profile RustCheck

After verifying current source authority and existing node_modules, execute ONE selected profile serially:

    & $Script -Mode Run -Profile FocusedRenderer -TestPaths @('src/features/charts/__tests__/chartRequestConsistency.test.ts')

For full renderer verification, separately:

    & $Script -Mode Run -Profile FullRenderer

Rust check, when relevant and authorized:

    & $Script -Mode Run -Profile RustCheck

Validate exit status, full transcript and hash, source file preservation, and whether the standard target and node_modules were reused. Do not run profiles concurrently. Do not perform Git operations or build a portable as part of the runner task.

## Risks, limitations and rollback

- Existing installed node_modules may not match an updated lockfile. npm ls --depth=0 --offline checks the direct installed dependency tree, not byte-for-byte lockfile fidelity. On mismatch, fail; do not auto-install or assume a valid environment. Any npm ci/update is separately planned.
- The exact-root check intentionally rejects isolated source worktrees; this runner is for the regular authorized Windows checkout.
- Renderer tests and npm build lifecycle can update pre-existing generated theme files as before; inspect protected local changes before/after execution.
- Shared Cargo remains serialized and its compatible cache reuse cannot be guaranteed for different toolchains, features or compiler flags.
- Source-level guards and CI syntax validation do not establish runtime safety on the actual Windows machine. All Windows checks remain open.
- No production database access, local Git checkout modification, native app launch or portable build was performed by GitHub implementation.
- Rollback: close/revert draft PR #120 or remove the two newly added runner/CI files if later approved. Do not remove tmp evidence, protected untracked audit documents, shared target, node_modules or existing release files.

## Completion state

**GitHub source implementation: candidate, with parser CI PASS and initial renderer CI PASS. Windows validation: HOLD. GitHub main: unchanged. Merge: HOLD for user acceptance and separate approval.**
