# NS-04 — Registered database selection revision and native worker invalidation

**IST timestamp:** 2026-11-20 15:53 IST (UTC+05:30).
**Active root:** `E:\TA Projects\EOD Charting Platform`.
**Source authority:** PR #124, `arena/1a89772f-eod-charting-platform`, parent `be23d886903d7458ee5ecbd529b416703b9b921b`, accepted main `717eb6f00af96d8f717929eab2fc2d57cd7e5b6f`.

## Objective and previous limitation
Earlier native events used folder path plus folder mtime, and renderer selection checks alone could miss A → B → A re-selection before displaying results. A running backend could complete against the original database without checking the registered active selection or physical SQLite file identity again.

## Files changed and implementation
- `src-tauri-shell/src/database/connection_registry.rs`: add an optional, backward-compatible `activeSelectionRevision` registry field (default zero). Increment with checked arithmetic on active activation/create, close, invalid active-path recovery, and registered active deletion. Read active registry identity under existing database-use and registry locks, without creating or modifying a registry. Check registration, canonical directory, and underlying SQLite file identity (Windows existing file ID; Unix device/inode).
- `src-tauri-shell/src/database.rs`: expose the new read-only, crate-local native selection witness.
- `src-tauri-shell/src/native_scanner/database_source.rs`: bind the production source's published identity to registered path and selection revision instead of folder mtime; preserve the existing isolated fixture constructor.
- `src-tauri-shell/src/native_scanner/ipc.rs`: capture the selection before target resolution, recheck before admission, during progress, and immediately before terminal completion; cancel and emit a fail-closed database-changed terminal error on mismatch. Existing permit ownership and worker join/finalization remain unchanged.
- `src-tauri-shell/src/native_scanner/job.rs`: one stable error code for selection changes.
- `src/plugins/scanner/nativeScannerRun.ts`: on that error, cancel the native outcome without TypeScript fallback against a reselected A database.
- `src/plugins/scanner/__tests__/nativeScannerRunNS04.test.ts`: regression test for no-fallback behavior on a backend-detected A → B → A change.
- `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`: update current PR/resume state.
- This change record.

## Behavior preserved
Native scanner OFF by default; TypeScript scanner unchanged; raw-only native CA-01 HOLD unchanged; existing chart adjustments, registered database selection behavior, SQLite and `.eod` data, source storage layout, scanner scoring, cancellation and resource permits preserved. No new dependencies or user-database migration; optional registry field is additive.

## Validation and evidence
- Before publication: verified immutable parent head and PR state; inspected the affected registry, scanner IPC/job, source and renderer adapter.
- Added Rust tests for legacy registry decoding, checked monotone revision, A → B → A, physical file replacement, inactive and unregistered selection; added TypeScript backend-cancellation regression.
- **UNTESTED at publication:** no local Rust toolchain or Windows host is available to this GitHub-only edit. Rustfmt and Cargo compilation/tests must be taken from the GitHub Actions workflows on the NEW commit. Windows Tauri, PowerShell shared Cargo, portable UI, and disposable registered database acceptance remain manual gates.
- The existing Linux Cargo workflow filters the pre-existing Windows-only `nse_identity_imports` path test. That test still requires Windows execution.
- Local protected generated files, four audit plans, CA-01 HOLD and `.git/info/attributes` were not accessed. Remote parent commit and pre-edit blob IDs provide an immutable rollback reference; local SHA-256 preservation is not claimed.

## Risks and limitations
- The selection revision guarantees invalidation for database transitions performed through the accepted registry writers; it does not version every in-place SQLite price update by external processes. A native multi-target scan still does not guarantee one cross-symbol transactional data snapshot.
- NTFS physical file identity and junction behavior require explicit Windows disposable-directory validation. The backend checks the physical file before producing terminal success; a selection change after the terminal event still depends on the renderer's live selection guard.
- Database registration file representation gains an optional field. Older app versions that ignore it cannot enforce the new native selection guard; no automatic cleanup or downgrade is attempted.

## Rollback
Revert only this scoped PR change by an explicitly approved Git revert or immutable-parent restoration. Do not remove or rewrite real user databases, backups or unrelated work. Keep native scanning OFF if this protection cannot be validated.

## Next step
Check the new PR-head Rustfmt, Cargo native/full, renderer CI and documentation checks. Then perform Windows disposable-database A → B → A, database replacement/junction, cancellation and close stress tests; only consider merging after explicit acceptance.


## Hosted validation evidence (code commit `2f5ddf96`)

- Rust Compile and Test CI run `44718967375` **PASS**: `cargo check --tests --locked` successful; native scanner **101 passed / 0 failed**; RSC scanner regressions **18 passed / 0 failed**; full Rust suite **1,392 passed / 0 failed / 26 ignored / 1 filtered**. Full suite runs the two new registered-selection Rust tests.
- Renderer CI run `44718967423` **PASS**: renderer Vitest, TypeScript typecheck and Vite production build passed.
- Rustfmt CI run `44718968031` **FAIL** on exactly one import-layout diff in `native_scanner/ipc.rs`; no semantic change was needed. This follow-up commit applies the exact hosted Rustfmt correction.
- The revised follow-up commit requires its **own** CI verification; no check may be reported as passed on the follow-up without its own real workflow output.
- Windows physical identity, portable native UI, disposable database A → B → A switch, and the Linux-filtered Windows-only path test remain untested.
