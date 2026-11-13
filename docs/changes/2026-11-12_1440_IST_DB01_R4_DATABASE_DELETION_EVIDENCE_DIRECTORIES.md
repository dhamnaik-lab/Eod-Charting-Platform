# DB01-R4 recognizes managed evidence directories during deletion

Completed on 12 November 2026 at 14:40 IST in `E:\TA Projects\EOD Charting Platform`.

DB-SAFE-01 refused databases containing `bhavcopy_admission` because the directory was missing from the database-root allowlist. The audit found two other omissions in active writers. [Bhavcopy admission](../../src-tauri-shell/src/bhavcopy/security_admission.rs#L323) writes `bhavcopy_admission`. [Index fallback](../../src-tauri-shell/src/bhavcopy/index_fallback.rs#L405) writes `bhavcopy_index_evidence`. [Nifty history preview](../../src-tauri-shell/src/nifty_history.rs#L542) writes `historical_index_review`.

The [Windows deletion adapter](../../src-tauri-shell/src/database/database_deletion/windows.rs) now recognizes those three exact names as directories. The same allowlist applies during preflight and the handle-bound walk. Database ownership, protected paths, reparse rejection, nested database rejection, and registry and marker behavior are unchanged. The [regression tests](../../src-tauri-shell/src/database/database_deletion/tests.rs) delete an isolated SQLite fixture containing all three directories and refuse a regular file and a real Windows junction named `bhavcopy_admission`. The junction's external target remains intact. DB01-R1, the evidence writers, and production databases were untouched.

## Validation

All Cargo commands used `.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run` with the shared target, `--offline --locked`, and a passing Preview first. The test rows use `-CargoAction test -CargoArguments @('<filter>','--','--nocapture')`.

| Command or test filter | Exit | Observed result |
| --- | --- | --- |
| `database_root_accepts_managed_evidence_directories` before the allowlist edit | Wrapper 1, Cargo 101 | Expected FAIL. Preflight reported `Unrecognized entry in the database folder: bhavcopy_admission`. |
| `database_deletion` | 0 | PASS. 11 harness tests passed. The existing symlink subcase reported SKIP because the host lacks creation privilege. The new junction test passed. |
| `connection_registry` | 0 | PASS. 5 passed. |
| `bhavcopy::security_admission` | 0 | PASS. 23 passed. |
| `bhavcopy::index_fallback` | 0 | PASS. 22 passed, 1 ignored. |
| `nifty_history::tests` | 0 | PASS. 13 passed. |
| `-CargoAction check` | 0 | PASS. |
| `-CargoAction build -CargoArguments @('--bin','eod-charting-platform-shell')` | 0 | PASS. Shared-target debug executable linked successfully. |
| `.\scripts\check-doc-references.ps1` | 0 | PASS. |

## Evidence and rollback

- Logs are under `tmp/fixtures/db01-r4`. Deletion-suite log SHA-256 `913994BD02464C159D0D22909C9FAA07029F97AA98E2CA9AE2D9F28E3B30E3E2`.
- Debug executable `target/debug/eod-charting-platform-shell.exe` SHA-256 `D82197CC9A6714618866CA2D110D109C17DFACC6E81E3EC0B908B0FABC61A3A2`. The existing generated CSS and Tauri build metadata matched their pre-validation hashes. The debug build was not launched.
- Both edited source files matched their copies in `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261112_143249_DB01-R4` before editing. Backup manifest SHA-256 `07173205FC5C7B7484A294342E489DB8C2127E5D16467206EEAF4997EA57B84F`. For an authorized rollback, reverse only the allowlist additions and the two new tests using that backup for comparison.
- The user subsequently confirmed deletion of `New Database` in the rebuilt app. The evidence-directory variants were covered by the isolated Rust fixtures above. [Desktop closeout](2026-11-12_1702_IST_DB_SAFE_01_DELETION_CONFIRMATION_ACCEPTANCE.md)
