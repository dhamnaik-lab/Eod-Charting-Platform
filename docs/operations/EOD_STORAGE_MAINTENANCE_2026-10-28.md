# EOD Charting Platform — Cargo and Temporary Workspace Maintenance

**Evidence cutoff:** 28 October 2026, 15:38:32 IST (UTC+05:30)  
**Authorized workstream:** `E:\TA Projects\EOD Charting Platform`  
**Scope:** DC-01, DC-02, BUILD-01, TMP-01 (R1 and R2 recovery). This document summarizes bounded storage operations only; it does not supersede the separate Bhavcopy, database, Corporate Actions or plugin handoffs.

## Current dispositions

| Workstream | Final disposition | Verified behavior / boundary |
|---|---|---|
| DC-01 | Closed — cleanup verified | Removed only `target\debug\incremental`, 3,950 files, 10.521 GiB logical, 9.419 GiB observed E: free-space increase. Rebuild of debug incremental cache may add time on the next Rust build. |
| DC-02 | Closed — cleanup verified | Removed exactly four individually pinned historical secondary `cargo-target` / `target` trees under diagnostic directories in `tmp` (17,174 files; 10.766 GiB logical); 9.422 GiB observed E: free-space increase. Diagnostic parent folders and unrelated `tmp` entries were preserved. |
| BUILD-01 | Closed — shared `cargo check` verified | `scripts\Invoke-EOD-SharedCargo.ps1` installed; `AGENTS.md` updated with shared-target policy. A repeated `cargo check --offline --locked` targeting the project-root `target` progressed from 21.79 s to 7.24 s to 1.25 s with no new compile/check lines on the third run. |
| TMP-01 | Closed — R2 recovery verified | `scripts\Invoke-EOD-TmpLifecycle.ps1` and `AGENTS.md` policy installed. Initial R1 smoke test failed while decoding a JSON timestamp; R2 corrected this with PowerShell 7.5+ `ConvertFrom-Json -DateKind String`. Exact R1 empty smoke orphan cleaned; a new marker-only Create / Preview / Cleanup smoke test passed. |

**Measured space increase:** DC-01 (9.419 GiB) + DC-02 (9.422 GiB) = **18.841 GiB** summed across their respective measurement intervals. This is not a new real-time free-space measurement. Logical file sizes exceeded the observed free-space changes; the difference was not separately attributed.

## Shared Cargo build workflow (BUILD-01)

Active Cargo configuration was already `[build] target-dir = "target"` before BUILD-01. Keep `E:\TA Projects\EOD Charting Platform\target` as the shared build-cache directory. Do not place compiled Cargo trees in `src`, `src-tauri-shell` or `tmp` except under a separately approved, fully bounded isolated-build case.

Use PowerShell 7+ from the verified EOD root:

```powershell
$root = 'E:\TA Projects\EOD Charting Platform'
Set-Location -LiteralPath $root
$shared = Join-Path $root 'scripts\Invoke-EOD-SharedCargo.ps1'
& $shared -Mode Preview -CargoAction check
& $shared -Mode Run -CargoAction check
```

The wrapper supports `check`, `test` and `build` with the shared target, locked/offline resolution and guards against conflicting Cargo target-directory overrides and detected secondary Cargo artifact trees under `tmp`. It does **not** alter `CARGO_INCREMENTAL`, Rust profile semantics, Tauri packaging or compiler flags, and does not delete caches. Repeat checks need not be no-op after source, feature, toolchain or flag changes. Direct `cargo`, `npm`, Tauri and external diagnostic runners **can bypass this wrapper**; BUILD-01 is a policy/guarded workflow, not a global interception mechanism.

The evidence for the three Cargo runs supports **cache reuse for the unchanged `cargo check` command only**; it is not a benchmark of all tests, feature combinations or portable builds. Seven existing compiler warnings were present during the recorded checks; no warning fixes were part of BUILD-01.

## Managed temporary scratch workflow (TMP-01)

TMP-01 manages **only newly marked scratch-only** directories beneath `tmp\disposable\<tag>_<unique-id>`.

```powershell
$root = 'E:\TA Projects\EOD Charting Platform'
$helper = Join-Path $root 'scripts\Invoke-EOD-TmpLifecycle.ps1'
& $helper -Action Create -Tag ExampleTest
# Save the exact WORKSPACE_ID printed by Create for any future action.
& $helper -Action Preview -RetentionDays 7
# After seven days, only for one reviewed, eligible, explicitly marked scratch workspace:
& $helper -Action Cleanup -WorkspaceId '<exact-workspace-id>' -ConfirmExactWorkspace -RetentionDays 7
```

Default retention is **7 days** according to both the marker and directory creation time. The `-RetentionDays 0` exception is **only for an empty marker-only workspace**, such as the bounded acceptance smoke test. Each cleanup requires the exact workspace ID and confirmation; the helper checks ownership, path ancestry, nested links, protected content and active EOD/build processes. **Never** bulk-delete the entire `tmp` or `tmp\disposable` tree.

Database files, recovery materials, source, archives, evidence, backups, copied executables, dependency trees and compiled Cargo targets are **not scratch**. Historical unmarked `tmp` directories are deliberately excluded. The helper is opt-in and operator-driven: no scheduled cleanup, automatic migration or age-only sweep was installed. The acceptance test validated marker-only workspaces; seven-day populated-workspace retention and every protected-content rejection scenario were **not separately tested**.

## Preservation rules

- Preserve `src`, `src-tauri-shell`, app settings, data stores, backups, recovery files and official evidence. No production database access was authorized for these four storage workstreams.
- Preserve `.cargo\config.toml`, `src-tauri-shell\Cargo.toml`, root `target` (other than the approved DC-01 debug incremental path), release executables and portable output.
- Do not delete unmarked historical diagnostics from `tmp` or backups based on age/size alone; exact-path inspection and separate approval are required.
- Keep new documents under `docs/`, temporary kits/reports under project `tmp`, and only final evidence ZIPs under Downloads. Avoid placing build output or dependencies under source directories.
- Existing `scripts\validate-change.ps1` can invoke Git. Do **not** run it as part of documentation-only work when Git operations have not been authorized. Perform focused Markdown checks and hash/path verification instead.

## Evidence and chronology (SHA-256)

| Checkpoint (IST) | Evidence archive SHA-256 | Recorded status |
|---|---|---|
| DC-01 Apply 2026-10-28 12:42:44 | `EBCB7A11365847F9C9633A0C6B4EEB2789C781B832586B363ED822B48130F0FA` | `DC01_APPLIED_EXACT_CACHE_REMOVED_ANCHORS_PASS` |
| DC-02 Apply 2026-10-28 14:24:14 | `30918C543C86A3583A4CBEE03DFD960073778E2CFE05378C8DB55EED4723BEEE` | `DC02_APPLIED_EXACT_FOUR_TARGETS_REMOVED_ANCHORS_PASS` |
| BUILD-01 Apply 2026-10-28 15:01:58 | `6B5FC66CE0C7FB98EAB3C22C63A8390501F2C269EE08C3473B254E12D10E8874` | `BUILD01_APPLIED_POLICY_WRAPPER_PREVIEW_PASS` |
| TMP-01 R1 failed Apply 2026-10-28 15:31:00 | `C3B8919D9E832D11F1482C7F27A16BB6C9597342E2A4CA369D42CAA6AB1575E7` | `TMP01_FAILED_REVIEW_REQUIRED` |
| TMP-01 R2 Apply 2026-10-28 15:38:32 | `EB71B4EC994E30AE6C3C59CC8925AF7C2E759B8727491F9DF226D9F04D4816D4` | `TMP01_R2_RECOVERED_MARKED_SMOKE_PASS` |

Recorded change docs in the Windows workstream:

- `docs\changes\2026-10-28_1242_IST_DC01_RUST_INCREMENTAL_CACHE_CLEANUP.md`
- `docs\changes\2026-10-28_1424_IST_DC02_SECONDARY_CARGO_TARGET_CACHE_CLEANUP.md`
- `docs\changes\2026-10-28_1501_IST_BUILD01_SHARED_CARGO_ARTIFACT_POLICY.md`
- `docs\changes\2026-10-28_1538_IST_TMP01_R2_TIMESTAMP_PARSER_RECOVERY.md`

The first three records were reported by their Windows runners; the R2 changelog was included in the uploaded evidence. This summary does not independently confirm the contents of any other live change document.

## Source authority and rollback

- Pre-update source snapshot: `Eod Charting Platform Source Code 2026-10-28_010831_IST.zip`; SHA-256 `97B174FFB5B74F799D27D0C741D6F986282DA934B618526108A3230BC2B56432`. It is **historical** relative to subsequent BHAV-02, BUILD-01 and TMP-01 changes. Always treat current Windows files and their validated hashes as authoritative.
- BUILD-01 installed shared helper SHA-256: `0F37C5A53A93973F976A40589276ECB4998D893AA76092C0D3354827FC1E26D3`.
- TMP-01 R2 installed lifecycle helper SHA-256: `907B3F7E57B75167943F41E862A41CEB4A607DC5F91E66972AE8987CD11D0A0B`.
- TMP-01 installed `AGENTS.md` SHA-256: `C13E5EC6D4AE8390EFBE8B0F3A406026237AE0ECD1DCBA51F3537F9736BEB65B`.
- For documentation-only rollback, restore `docs\CURRENT_WORK_STATUS.md` from a verified pre-edit project-local backup, then remove **only** this newly added guide if its exact recorded SHA-256 matches. Retain change/evidence records for historical traceability.

**This document is operational documentation, not approval to change application architecture, perform broader cleanup, access production databases or run a deep audit.**
