# DB-SAFE-03 — Preserve delivery data during SQLite re-import

12 November 2026, 23:41 IST

## Source and scope

Implemented against the active Windows worktree at `E:\TA Projects\EOD Charting Platform`, based on HEAD `19518fbcf721c27a891098824cca3cabe42f33fb`. Inspected the active Bhavcopy ingestion, date planning and recovery paths, Manual Import and its dialog, the SQLite bootstrap, and the existing Rust fixtures. The bootstrap declares the price key as `(symbol, exchange, date)` and the delivery fields as nullable.

- [Bhavcopy ingestion](../../src-tauri-shell/src/bhavcopy/ingestion.rs) now updates the eight supplied fields on a Hybrid SQLite conflict, including source `prev_close` and `trades`. Existing delivery fields survive. A fresh insert leaves them NULL. Journal replay uses the same write.
- [Manual Import](../../src-tauri-shell/src/imports.rs) now updates the six supplied fields on a Hybrid Overwrite conflict. Existing `prev_close`, `trades`, `delivery_qty`, and `delivery_pct` survive. The [import dialog](../../src/components/ImportCsvDialog.tsx) and backend already default to Skip. Skip and Error keep their existing SQL and transaction behavior. The audit's default Overwrite checkbox belongs to Merge Symbols.
- Instrument identity, transaction boundaries, counters, binary writes, recovery orchestration, and DB-SAFE-01 edits were preserved. Both statements use SQLite's existing price key. No schema or parser changes were needed.
- [Bhavcopy tests](../../src-tauri-shell/src/bhavcopy/tests.rs) cover a corrected re-import over populated and NULL delivery, binary replacement accounting, and a persisted journal round trip into the immediate replay write. The new Manual Import test uses the production schema on disposable databases and covers Overwrite, explicit and implicit Skip, Error rollback, populated fields, and a fresh insert with NULL delivery.

## Validation and evidence

Cargo commands used `scripts/Invoke-EOD-SharedCargo.ps1 -Mode Preview`, then `-Mode Run`, with the action and optional filter below passed through `-CargoAction` and `-CargoArguments`. The wrapper used the project-root `target`, the shell manifest, and `--offline --locked`. Test temp paths and logs were under `tmp/fixtures/db-safe-03-20261112/`.

| Command through the shared wrapper | Result | Evidence in the fixture directory |
| --- | --- | --- |
| `test db_safe_03` | PASS, 3 passed | `focused.log` |
| `test bhavcopy::` | PASS, 169 passed, 4 ignored | `bhavcopy.log` |
| `test bhavcopy_recovery::` | PASS, 16 passed | `recovery.log` |
| `test imports::tests` | PASS, 226 passed, 1 ignored. The substring matched other import modules and included all 9 Manual Import tests. | `imports.log` |
| `check` | PASS, 11.82 seconds | `cargo-check.log` |
| `build` | PASS, Windows debug build in 47.76 seconds | `windows-debug-build.log` |

`scripts/validate-change.ps1 -Profile docs -Paths <six changed paths>` passed documentation reference and scoped whitespace checks. A separate trailing-whitespace check passed for this new file. See `docs-validation.log`.

The debug executable is `target/debug/eod-charting-platform-shell.exe`. Its SHA-256 is `92F6099A7BBD41468EE6D52BD56C4AECB927E96768A9A474B0EDE1A1614016D0`. The ignored probes require explicit native, live-source or maintenance execution. No production database was accessed.

## Risks, rollback and acceptance

- Manual Import preserves stored SQLite `prev_close` even when a batch changes or adds the preceding bar. The regression verifies preservation with a preceding close of 96 and a stored previous close of 97. The current binary import path still queues its existing zero `prev_close` value. Recomputing either representation is outside this change.
- The fix preserves existing delivery values. It supplies no new delivery values and cannot reconstruct values lost before the fix.
- The pre-edit backup is `backups/pre_opencode_changes_20261112_233413_db-safe-03/`. For a source rollback, compare its manifest and copies with the current files, then reverse only the DB-SAFE-03 changes and remove its documentation entries with approval. Keep pre-existing DB-SAFE-01 and any later work. There is no migration to roll back.
- Windows debug compilation is verified. The portable rebuild and disposable native acceptance are recorded below.

## Final verification — 13 November 2026, 00:43 IST

Reviewed the active worktree at HEAD `19518fbcf721c27a891098824cca3cabe42f33fb`, including both upserts, their regressions, the bootstrap key, the Manual Import dialog and the existing recovery dispatch. Both upserts update only supplied fields. The Hybrid write gates, Binary path, Skip and Error statements, journal routing and commit boundaries retain their existing behavior. The DB-SAFE-01 checkpoint signature change in Bhavcopy ingestion remains intact. No runtime source changes were made.

| Checkpoint | Result | Command and evidence |
| --- | --- | --- |
| Source and worktree | PASS | `git rev-parse --show-toplevel`, `git rev-parse HEAD`, `git status --short`, scoped `git diff` and `git diff --check`. Pre-existing modified and untracked files matched their starting SHA-256 before the documentation updates. |
| Focused tests | PASS | Shared Cargo Preview then Run, `test db_safe_03`. 3 passed. |
| Bhavcopy and recovery | PASS | Shared Cargo Preview then Run, `test bhavcopy::` (169 passed, 4 ignored) and `test bhavcopy_recovery::` (16 passed). |
| Import regressions | PASS | Shared Cargo Preview then Run, `test imports::tests`. 226 passed, 1 ignored, including all 9 Manual Import tests. |
| Cargo check | PASS | Shared Cargo Preview then Run, `check`. Finished in 8.97 seconds. |
| Portable Windows build | PASS | `npm run tauri:portable:win`. Renderer built in 11.60 seconds and the release Cargo profile finished in 2 minutes 55 seconds. Staged build `20261113.003937`. |
| Executable identity | PASS | `Get-FileHash -Algorithm SHA256` matched the release and staged executables at `63C8F87FEDDF1208EFBDDA5FC4C1D2B9A4090BE1230FB235F99F69446E853C9F`. |
| Native portable acceptance | PASS | `node --check <evidence>/native-portable.mjs`, then `node <evidence>/native-portable.mjs "<staged EOD Chart.exe>"`. Used a disposable Hybrid database and separate profile and WebView2 state. |
| Documentation and closeout | PASS | `scripts/validate-change.ps1 -Profile docs -Paths <three documentation paths>`, a direct whitespace check on the untracked record, and a final worktree hash comparison. |

The staged WebView2 renderer showed Skip selected and offered Overwrite and Error. The real native commands verified that implicit and explicit Skip preserved the row, Error rolled back the preceding insert, and Overwrite changed close from 101 to 105 and volume from 1,000 to 1,500. Delivery stayed at 500 and 50%, and SQLite previous close and trades stayed at 97 and 42. Normal Date Range skipped the imported date without requesting the source. Force Redownload fetched the loopback NSE CSV once, imported two rows, raised the populated row's close to 108 and volume to 1,600, and wrote source previous close and trades of 102 and 75. Delivery stayed at 500 and 50%, and the second row's NULL delivery stayed NULL. Both fixture symbols had binary files after the run.

Evidence is under `tmp/fixtures/db-safe-03-final-20261113/`. It includes Cargo and build logs, before-and-after worktree evidence, generated build metadata, executable hashes, the native runner, the fixture SQLite database and binary files, `native-1794510796928/native-results.json`, and the Manual Import dialog screenshot. The previous package was retained as `release/tauri-portable-win/EOD Chart Portable retained-before-DB-SAFE-03-20261113-003935`. The build-generated metadata was captured with the evidence and the pre-build workspace metadata bytes were preserved. The verification backup is `backups/pre_opencode_changes_20261113_003737_db-safe-03-final/`.

Native acceptance exercised the dialog's default and the packaged Tauri commands. It did not drive the Windows file picker or contact a live exchange. Binary mode and recovery were covered by the automated regressions. The stored SQLite previous-close limitation above remains. No production database was accessed.
