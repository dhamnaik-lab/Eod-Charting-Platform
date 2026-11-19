# BUILD-01 — Shared Cargo Wrapper Secondary-Target Detection Correction

**Timestamp:** 2026-11-18 19:25 IST (`UTC+05:30`); test-scope correction 2026-11-18 20:34 IST (`UTC+05:30`); subprocess executable resolution fix 2026-11-18 21:09 IST (`UTC+05:30`); runtime validation recorded 2026-11-18 21:46 IST (`UTC+05:30`)  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Task ID:** `BUILD-01`  
**Status:** Complete & verified — static AST parse check PASS, `scripts/Test-EOD-SharedCargo.ps1` **PASS (`TOTAL=16 PASS=16`)**, `scripts/check-doc-references.ps1` **PASS**, and `scripts/Invoke-EOD-SharedCargo.ps1` (`Mode Preview` + `Mode Run` for `scanner_contract::tests`) **PASS (`3 passed, 0 failed, 0 ignored; CARGO_EXIT=0`)** against shared root `E:\TA Projects\EOD Charting Platform\target`.

---

## 1. Objective

Correct `scripts/Invoke-EOD-SharedCargo.ps1` so that its secondary Cargo build-tree check under `tmp` distinguishes legitimate shared-target junctions pointing strictly to `E:\TA Projects\EOD Charting Platform\target` and narrowly scoped, evidence-backed retained historical acceptance directories from unauthorized secondary Cargo build trees, broken/relative/unsafe links, conflicting environment overrides, or disallowed Cargo flags.

---

## 2. Root Cause & Observed Evidence in `tmp`

Previously, `scripts/Invoke-EOD-SharedCargo.ps1` (lines 52–60) exempted only `tmp\fixtures\pr102-native-windows-6ce03be\source\target` by string comparison and threw on all other directories named `target`, `cargo-target`, or `rust-target` containing `debug\deps` or `release\deps`. As documented in [2026-11-18_1240_IST_REUSABLE_WINDOWS_VALIDATION_WORKSPACE.md](../changes/2026-11-18_1240_IST_REUSABLE_WINDOWS_VALIDATION_WORKSPACE.md), read-only inspection confirmed five additional matching entries in `tmp` that blocked `RustCheck` before Cargo ran:

1. `tmp\UX_Audit_Completion_20261117_IST\target` — NTFS `Junction` targeting `E:\TA Projects\EOD Charting Platform\target`; ordinary parent worktree with ordinary `src-tauri-shell\Cargo.toml`.
2. `tmp\UX_Audit_PR116_IA_20261117_IST\target` — NTFS `Junction` targeting `E:\TA Projects\EOD Charting Platform\target`; ordinary parent worktree with ordinary `src-tauri-shell\Cargo.toml`.
3. `tmp\EOD_F30_PR118_Acceptance_20261118_HTTPS_RETRY_IST\worktree\target` — ordinary directory (`Reparse=False`, `debug\deps` and `release\deps`), ordinary `src-tauri-shell\Cargo.toml`, ordinary `evidence` directory.
4. `tmp\EOD_F30_PR118_PriceScaleFix_20261118_ALLOWED_DOCS_IST\worktree\target` — ordinary directory (`Reparse=False`, `debug\deps` and `release\deps`), ordinary `src-tauri-shell\Cargo.toml`, ordinary `evidence` directory.
5. `tmp\F52_Windows_Native_Acceptance_20261116_102754_IST\pr-source\target` — ordinary directory (`Reparse=False`, `release\deps`), ordinary `src-tauri-shell\Cargo.toml`, ordinary `F52_Windows_Native_Acceptance_20261116_102754_IST.md` evidence file.
6. `tmp\fixtures\pr102-native-windows-6ce03be\source\target` — ordinary directory (`Reparse=False`, `release\deps`), ordinary `src-tauri-shell\Cargo.toml`, ordinary `pre-fast-forward-local-audit.md` evidence file.

---

## 3. Source Authority & Inspected Files

- **Authorized root:** `E:\TA Projects\EOD Charting Platform`
- **Files inspected before editing:**
  1. `AGENTS.md`
  2. `HANDOFF.md`
  3. `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
  4. `scripts/Invoke-EOD-SharedCargo.ps1`
  5. `scripts/Invoke-EOD-WindowsValidation.ps1`
  6. `scripts/Invoke-EOD-TmpLifecycle.ps1`
  7. `scripts/Test-EOD-Source-Code-Snapshot-v3.ps1`
  8. `scripts/Create-EOD-Source-Code-Snapshot-v3.ps1`
  9. `.github/workflows/windows-validation-runner-parser.yml`
  10. `docs/changes/2026-11-18_1240_IST_REUSABLE_WINDOWS_VALIDATION_WORKSPACE.md`

---

## 4. Backup & SHA-256 Evidence

- **Initial pre-edit backup directory:** `backups/pre_opencode_changes_20261118_192400_build01-shared-cargo-secondary-targets` (`backup-manifest.json`, `fileCount: 3`, `totalBytes: 187992`)
- **Test-scope correction backup directory:** `backups/pre_opencode_changes_20261118_203331_build01-test-scope-fix` (`backup-manifest.json`, `fileCount: 4`, `totalBytes: 216152`)
- **Subprocess executable resolution backup directory:** `backups/pre_opencode_changes_20261118_210816_build01-pwsh-subprocess-fix` (`backup-manifest.json`, `fileCount: 4`, `totalBytes: 219799.0`)
- **Validation-evidence doc backup directory:** `backups/pre_opencode_changes_20261118_214555_rsc01-build01-validation-docs` (`backup-manifest.json`, `fileCount: 4`)

| File | Before SHA-256 | After SHA-256 |
|---|---|---|
| `scripts/Invoke-EOD-SharedCargo.ps1` | `B704E74D55EB88E09F413AFC671A4A807151502E86296D711BC703535F6FFE82` | `F7CD6D9C67CE9FD004E1C2CAD29CBB5D3772A7B848290E77B51CF8836E39F9FD` *(unchanged in 20:34 and 21:09 IST follow-ups)* |
| `scripts/Test-EOD-SharedCargo.ps1` | *(new file)* `FFBA9B2A475CCB8CD891DCF651045C9E94F6F81F3577BEF8C113B038DBA3566B` *(initial)* / `17C0A13D0E5D760319FE5456194F664365371A899E4578A5FD34244B6D81BFAF` *(pre-21:09)* | `F3F9877B1A4F246E71F5FCBE12DAFE0E666C7242AC973846FD484B0B42DC3034` *(21:09 IST subprocess fix)* |
| `HANDOFF.md` | `8317E054BE61CEAD3D0B09E62A1570C1363432744485EEC51E12E3AB582FB2A1` *(initial)* / `BFF3B458D7E7C81D31D4A67FF0DFC097D15CCBC0FA04B7B4E1CC848E2AC35060` *(pre-20:34)* / `8FFD7A00F3ABCFA6028263FFF1D7B349159F290D2A604049534E936B89C60D4D` *(pre-21:09)* | `90FCA02A0795E3DA7F009A4A1858C7A8E98466512B750DCF9FA3510071D836E0` *(21:09 IST)* |
| `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` | `D224F2761FD5A7D788ED6E8E362FABA82FCF1990D27839BA77FD7EAC6C6745F4` *(initial)* / `4150819C34B75F5E2FEFCF649F623B56330E0B1D03D80D85FE8E2DBA721D72F4` *(pre-20:34)* / `FFB2B7F3FEB6B5DA08D44F92AC86D0DD6F97A8557AE6B128364581C7FEE63BA5` *(pre-21:09)* | `8359C4AEB2FC78CCFCF041D09EDDE6C408C41FD17A580D76260B17EAE711E469` *(21:09 IST)* |
| `docs/changes/2026-11-18_1925_IST_BUILD01_SHARED_CARGO_SECONDARY_TARGETS.md` | `7C18DB7247FC08B862F6A5260AA48CF7E61F40CE940857A476AE060A09416A92` *(pre-20:34)* / `D2418A60519090687E314674320E9167E9A6C637DF5FCE3055F2A685D3947071` *(pre-21:09)* | *(updated in 21:09 IST follow-up)* |

---

## 5. Implementation Summary (Changed vs. Preserved Behavior)

### Changed
- Updated `scripts/Invoke-EOD-SharedCargo.ps1` using guard clauses and separate `if` blocks only (zero `else` / `elseif`) with:
  - `Get-NormalizedFullPath`, `Test-IsOrdinaryDirectory`, `Test-IsOrdinaryFile`
  - `Get-RetainedHistoricalTargetSpecs` defining exact `TargetPath`, `OwnerRoot`, `RequiredManifest`, `RequiredEvidencePath`, and `RequiredEvidenceKind` for the 4 retained historical archives (`PR102_NATIVE_WINDOWS_6CE03BE`, `EOD_F30_PR118_ACCEPTANCE_20261118_HTTPS_RETRY_IST`, `EOD_F30_PR118_PRICESCALEFIX_20261118_ALLOWED_DOCS_IST`, `F52_WINDOWS_NATIVE_ACCEPTANCE_20261116_102754_IST`).
  - `Test-IsAuthorizedSharedTargetJunction`: admits only directory junctions named `target` under `tmp\` with a single fully qualified destination resolving strictly to `E:\TA Projects\EOD Charting Platform\target`, whose parent directory is an ordinary directory containing an ordinary `src-tauri-shell\Cargo.toml`.
  - `Test-IsRetainedHistoricalTarget`: admits only ordinary (non-reparse-point) directories matching one of the 4 exact historical target specs whose owner root, manifest, and acceptance evidence exist as ordinary paths on disk.
  - `Find-TmpCargoTargetCandidates`: stack-walks `tmp` safely without traversing reparse points, matched target roots, `.git`, or `node_modules`, capturing both `debug\deps`/`release\deps` target directories and any reparse point named `target`, `cargo-target`, or `rust-target`.
  - `Get-SecondaryCargoTargetViolations`: rejects any candidate that is neither a verified shared-target junction nor a verified retained historical target.
- Created read-only regression test script `scripts/Test-EOD-SharedCargo.ps1` (16 assertions covering AST & zero-`else` checks, live `tmp` inventory & classification, authorized junction admission, external/tmp/broken/relative/multi-target/symlink/misnamed/non-manifest junction rejection, spoofed historical target rejection, missing-evidence historical rejection, unknown ordinary `target`/`cargo-target`/`rust-target` rejection, and `Invoke-EOD-SharedCargo.ps1 -Mode Preview` positive & negative override checks).
- **20:34 IST regression test scope correction (`scripts/Test-EOD-SharedCargo.ps1`):** In the initial script, `Import-SharedCargoHelpers` ran `Invoke-Expression $definition.Extent.Text` inside its own local function scope, so the 8 extracted helper functions (including `Get-RetainedHistoricalTargetSpecs`) were discarded on return and tests 3–11 failed with `Get-RetainedHistoricalTargetSpecs` unrecognized. Replaced `Import-SharedCargoHelpers` with `Get-SharedCargoHelperScriptBlock` (extracting and validating all 8 `FunctionDefinitionAst` nodes into one `[scriptblock]` without `Invoke-Expression`) and dot-sourced it (`. $helperScriptBlock`, guarded against `$null`) directly in the test script's executing scope. `scripts/Invoke-EOD-SharedCargo.ps1` was inspected and left unmodified.
- **21:09 IST subprocess executable resolution fix (`scripts/Test-EOD-SharedCargo.ps1`):** After the 20:34 IST scope fix, 11/16 regression cases passed while `Invoke-SharedCargoPreviewSubprocess` failed at case 12 because `(Get-Command 'pwsh.exe' -CommandType Application -ErrorAction Stop).Source` returned 2 Windows Store `WindowsApps` `ApplicationInfo` matches (`AppData\Local\Microsoft\WindowsApps\Microsoft.PowerShell_8wekyb3d8bbwe\pwsh.exe` and `AppData\Local\Microsoft\WindowsApps\pwsh.exe`), causing member-access enumeration to produce a `[string[]]` array that coerced with a space into `$startInfo.FileName`. Added `Test-PowerShell7ExecutableCandidate` and `Resolve-PowerShell7Executable` (zero `else`/`elseif`, strict-mode safe) to deduplicate candidates from `$PSHOME\pwsh.exe`, current process path (when `pwsh.exe`), and `@(Get-Command 'pwsh.exe' -CommandType Application -All)` element-by-element, verify file existence and `PSVersion.Major >= 7` via `ProcessStartInfo` probe, resolve `$verifiedPwshExe = Resolve-PowerShell7Executable` once before the 5 subprocess tests, pass `-PwshExecutable $verifiedPwshExe` (validated as a single leaf `pwsh.exe` path) into `Invoke-SharedCargoPreviewSubprocess`, and dispose `Process` handles cleanly. All 16 regression cases and assertions remain unchanged; `scripts/Invoke-EOD-SharedCargo.ps1` remained untouched (only one `cargo.exe` exists on `PATH` and wrapper Cargo check/RustCheck already passed).

### Preserved
- Project-root `target`, `.cargo/config.toml` (`target-dir = "target"`), `--offline --locked` policy, root/target reparse-point checks, `CARGO_TARGET_DIR`/`CARGO_BUILD_TARGET_DIR`/`CARGO_BUILD_BUILD_DIR` rejection, disallowed Cargo CLI flags (`--target-dir`, `--manifest-path`, `--config`, `--build-dir`, `-Z`), concurrency guard, and all files/junctions in `tmp` (zero deletions or relocations).

---

## 6. Validation Results & Commands (Verified PASS)

- **Static PowerShell 7 AST parse & guard-clause check (after 21:09 IST fix; re-verified on `Invoke-EOD-SharedCargo.ps1` at 21:38 IST):**
  - `scripts\Invoke-EOD-SharedCargo.ps1 => errors=0 elseTokens=0 elseAst=0 elseTextHits=0` (`SHA-256: F7CD6D9C67CE9FD004E1C2CAD29CBB5D3772A7B848290E77B51CF8836E39F9FD`) (**PASS**)
  - `scripts\Test-EOD-SharedCargo.ps1 => errors=0 elseTokens=0 elseAst=0 elseTextHits=0` (`SHA-256: F3F9877B1A4F246E71F5FCBE12DAFE0E666C7242AC973846FD484B0B42DC3034`) (**PASS**)
- **Agent-executed runtime validation (2026-11-18 21:22–21:46 IST):**
  - `scripts\Test-EOD-SharedCargo.ps1`: exit code `0`, `TOTAL=16 PASS=16` (**PASS**, covering all 16 cases including all 5 `Invoke-SharedCargoPreviewSubprocess` cases).
  - `scripts\check-doc-references.ps1`: exit code `0`, `[PASS] Live documentation references are valid.` (**PASS**; re-run after 21:46 IST doc updates).
  - `scripts\Invoke-EOD-SharedCargo.ps1` `Mode Preview` + `Mode Run` (`-CargoAction test -CargoArguments @('scanner_contract::tests')`): `STATUS: BUILD01_SHARED_CARGO_PREVIEW_PASS_NO_BUILD_NO_CHANGES` then `STATUS: BUILD01_SHARED_CARGO_COMMAND_PASS`, `3 passed; 0 failed; 0 ignored; 0 measured; 1331 filtered out; finished in 0.02s`, `CARGO_EXIT=0`, shared target `E:\TA Projects\EOD Charting Platform\target`, `--offline --locked` (**PASS**).
- **Prior user-reported validation (wrapper unchanged since 19:25 IST):**
  - User reported `scripts/Invoke-EOD-SharedCargo.ps1` Cargo check and `scripts/Invoke-EOD-WindowsValidation.ps1` `RustCheck` passed.
- **Reference validation commands (run serially from `E:\TA Projects\EOD Charting Platform`):**

1. **Static PowerShell parser & `else`/`elseif` guard check:**
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "foreach (`$path in @('scripts\Invoke-EOD-SharedCargo.ps1','scripts\Test-EOD-SharedCargo.ps1')) { `$tokens = `$null; `$errors = `$null; `$ast = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path -LiteralPath `$path).Path, [ref]`$tokens, [ref]`$errors); `$elseTokens = @(`$tokens | Where-Object { `$_.Kind -eq 'Else' -or `$_.Kind -eq 'ElseIf' }); `$elseAst = @(`$ast.FindAll({ param(`$n) (`$n -is [System.Management.Automation.Language.IfStatementAst]) -and (`$n.Clauses.Count -gt 1 -or `$null -ne `$n.ElseClause) }, `$true)); Write-Host `"`$path => errors=`$(`$errors.Count) elseTokens=`$(`$elseTokens.Count) elseAst=`$(`$elseAst.Count)`"; if (`$errors.Count -gt 0 -or `$elseTokens.Count -gt 0 -or `$elseAst.Count -gt 0) { throw `"Validation failed for `$path`" } }"
   ```
2. **Focused BUILD-01 shared Cargo regression tests:**
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File '.\scripts\Test-EOD-SharedCargo.ps1'
   ```
3. **Shared Cargo `Preview` then `Run` (`cargo check --offline --locked`):**
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Preview -CargoAction check
   ```
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File '.\scripts\Invoke-EOD-SharedCargo.ps1' -Mode Run -CargoAction check
   ```
4. **Windows validation runner `RustCheck` (`Preview` then `Run`):**
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File '.\scripts\Invoke-EOD-WindowsValidation.ps1' -Mode Preview -Profile RustCheck
   ```
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File '.\scripts\Invoke-EOD-WindowsValidation.ps1' -Mode Run -Profile RustCheck
   ```
5. **Documentation reference validation:**
   ```powershell
   Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'; powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\check-doc-references.ps1'
   ```

---

## 7. Risks, Limitations & Rollback

- **Risks & limitations:**
  - `Invoke-EOD-WindowsValidation.ps1 -Profile RustCheck` was not re-run separately after the 21:09 IST test-harness fix, though `scripts/Invoke-EOD-SharedCargo.ps1` (`F7CD6D9C67CE9FD004E1C2CAD29CBB5D3772A7B848290E77B51CF8836E39F9FD`) has been unmodified since 19:25 IST and passed `Mode Preview` + `Mode Run` on `scanner_contract::tests` (`CARGO_EXIT=0`).
  - `Resolve-PowerShell7Executable` selects the first verified `pwsh.exe` candidate (`$PSHOME\pwsh.exe`, current process path when `pwsh.exe`, then `Get-Command 'pwsh.exe' -CommandType Application -All` matches in `PATH` order) that exits `0` with `$PSVersionTable.PSVersion.Major -ge 7`; if `$PSHOME\pwsh.exe` is inaccessible under an unusual MSIX execution policy, it falls through to the first working `PATH` `pwsh.exe` candidate.
  - Adding any future retained historical acceptance target under `tmp` requires an explicit, evidence-backed spec entry in `Get-RetainedHistoricalTargetSpecs` (or converting its build `target` into a junction to the shared root `target` via separate authorization).
  - Any intermediate directory named `.git` or `node_modules` inside `tmp` is skipped during `Find-TmpCargoTargetCandidates` traversal to avoid false directory scans; Cargo build trees placed inside a legitimate `.git`/`node_modules` folder would not be traversed.
- **Rollback instructions (requires user approval before restoring from backup):**
  - Restore the pre-21:09 IST versions from `backups/pre_opencode_changes_20261118_210816_build01-pwsh-subprocess-fix`, the pre-20:34 IST versions from `backups/pre_opencode_changes_20261118_203331_build01-test-scope-fix`, or restore the pre-BUILD-01 baseline (`scripts/Invoke-EOD-SharedCargo.ps1`, `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`) from `backups/pre_opencode_changes_20261118_192400_build01-shared-cargo-secondary-targets` and remove `scripts/Test-EOD-SharedCargo.ps1` and `docs/changes/2026-11-18_1925_IST_BUILD01_SHARED_CARGO_SECONDARY_TARGETS.md`.
