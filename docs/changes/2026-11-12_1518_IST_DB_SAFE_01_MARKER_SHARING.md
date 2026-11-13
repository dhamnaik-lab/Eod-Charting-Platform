# DB-SAFE-01 safety-marker sharing fix

Completed on 12 November 2026 at 15:18 IST.

The Delete Databases dialog reported Windows sharing violation `0x80070020` while persisting the safety marker. The registry fixture reproduced the exact failure when it held the same directory handle as the desktop command. That handle requested delete access on the safety-store directory, which conflicted with atomic marker replacement.

[Windows deletion](../../src-tauri-shell/src/database/database_deletion/windows.rs) now pins the marker directory without requesting delete access. It continues to deny delete sharing, and the regression fixture verifies that renaming the pinned directory fails. The database target still uses the original delete-capable handle. [Registry deletion](../../src-tauri-shell/src/database/connection_registry.rs) persists the marker before clearing the active pointer or removing any database contents. A second regression fixture locks the marker file and verifies that deletion stops with the active pointer, recent entry, and SQLite file intact.

## Validation

All Rust checks ran through `.\scripts\Invoke-EOD-SharedCargo.ps1` on the shared target with a passing Preview before Run. Test arguments were `@('<filter>','--','--nocapture')`.

| Command or filter | Exit | Result |
| --- | --- | --- |
| `registered_deletion_requires_identity_and_removes_aliases_after_success` before the fix | Wrapper 1, Cargo 101 | Expected FAIL. Reproduced `0x80070020` at marker persistence. |
| `connection_registry` | 0 | PASS. 6 tests, including marker creation and replacement with the directory pinned and fail-closed behavior when the marker is locked. |
| `database_deletion` | 0 | PASS. 11 harness cases. The real symlink subcase reported SKIP because the host lacks creation privilege. |
| `price_store_operation_lock` | 0 | PASS. 3 tests. |
| `-CargoAction check` | 0 | PASS. |

The tests used isolated Windows fixtures. Production database data, the DB01-R4 allowlist and the renderer were unchanged by this fix. The user subsequently confirmed successful single-database deletion in the rebuilt app. [Desktop closeout](2026-11-12_1702_IST_DB_SAFE_01_DELETION_CONFIRMATION_ACCEPTANCE.md)

## Backup and evidence

Both edited source files matched their copies in `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261112_151334_DB-SAFE-01-marker-sharing` before editing. Backup manifest SHA-256 `A4A97FDB83D764E35B5DCBF4FD2F8301CC7B209E83C4D500D8989544B7318D65`. The registry test log is under `tmp/fixtures/db-safe-01-marker-sharing` with SHA-256 `69146EA59374D20A6EDB1F66337507DD9D8BD9133B67B57A8B3B2784EA964F8B`. An authorized rollback can reverse only the marker-directory access change and its test additions using the backup for comparison.
