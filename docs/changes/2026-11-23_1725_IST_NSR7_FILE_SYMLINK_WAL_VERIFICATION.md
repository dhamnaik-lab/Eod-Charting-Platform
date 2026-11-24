# WP-02 / NS-R7 — File-symlink WAL verification

23 November 2026 IST. Scope was to verify one SQLite write-ahead log (WAL) through a file-symlink manifest before starting production full-history paging. Validation used disposable files. [Prior cursor and coordination record](2026-11-23_1713_IST_NSR7_SHARED_SQLITE_AND_FORWARD_CURSOR.md).

## Windows fixture

The fixture writes `1` in a committed transaction while automatic checkpointing is disabled and the writer stays open. It verifies that the writer filename reads `1`, that the WAL contains the transaction, and that the original and alternate filenames identify one physical file. The alternate name comes from a disposable `database.json` using the app's manifest fields. The fixture attempts both writer directions when file-symlink creation is available. [Fixture](../../tmp/fixtures/nsr7-file-symlink-wal-20261123_172050/verify_wal_paths.py).

- Hardlink control — PASS. The writer filename read `1` and the alternate filename read `0` from the same physical file. The fixture used native Windows Python SQLite 3.50.4. [Fixture log](../../tmp/fixtures/nsr7-file-symlink-wal-20261123_172050/windows-fixture-final.log).
- Initial file-symlink comparison — INCOMPLETE. Windows returned error 1314 before the fixture could compare committed values. [Initial fixture log](../../tmp/fixtures/nsr7-file-symlink-wal-20261123_172050/windows-fixture-final.log).

## Bundled SQLite source

The shell locks physical SQLite identity but passes the manifest filename to SQLite for writable and read-only opens. The locked `libsqlite3-sys` 0.28.0 bundles SQLite 3.45.0. Its Windows VFS uses `GetFullPathNameW` for path expansion. The pager derives the WAL filename by appending `-wal` to the resulting path. Microsoft documents `GetFullPathNameW` as expanding the name without verifying whether it identifies an existing file. These source paths indicate that physical file identity alone cannot establish one WAL for a file-symlink alias. [Registry opens](../../src-tauri-shell/src/database/connection_registry.rs) · [Physical lease](../../src-tauri-shell/src/database/database_use/canonical_access/sqlite_scope.rs) · [Bundled source trace](../../tmp/fixtures/nsr7-file-symlink-wal-20261123_172050/bundled-sqlite-wal-source.txt) · [Microsoft path expansion](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfullpathnamew).

## Resume point

The 18:08 IST repeat ran the same fixture in a fresh retained directory. The hardlink again read `1` under the writer filename and `0` under the alternate filename. The process exited `2` after `os.symlink` raised Windows error `1314` (`A required privilege is not held by the client`). Neither writer direction reached the file-symlink WAL comparison. [Repeat probe log](../../tmp/fixtures/nsr7-windows-acceptance-20261123_180826/windows-wal.log).

Full numeric paging stays disabled. The elevated repeat below finished the two-direction WAL comparison. Before any future change to SQLite open filenames, review existing alias WAL sidecars and retain the physical lease. The V2 implementation refuses hardlinks, file reparse points, registered file-symlink aliases and durable observed alias markers. [V2 acceptance](2026-11-23_1758_IST_NSR7_NUMERIC_HISTORY_V2.md#windows-acceptance-follow-up).

## Elevated Windows result and desktop follow-up

The operator ran the fixture from elevated PowerShell. The hardlink control and both file-symlink directions resolved to the same physical file. In all three cases, the writer filename read the committed `1` while the alternate filename read `0` before checkpoint. Fixture exit `1` accompanied both file-symlink results and records separate WAL views in native Windows Python SQLite 3.50.4. [Operator results](../../tmp/fixtures/wp02-windows-symlink-acceptance-20261123_224313/operator-wal-result.json).

The ordinary session received access denied on the elevated scratch directories. A separate disposable pair was prepared in the normal session and the operator created its file link from the elevated session. The release executable's positive WebView2 control returned 1,250 matches from the owner database. [Desktop control](../../tmp/fixtures/wp02-windows-symlink-acceptance-20261123_224313/desktop-control.json).

The same release executable then refused both slots through WebView2. Selecting the physical filename reported a registered SQLite WAL alias. Selecting the file-symlink filename reported an alternate SQLite WAL filename. The rejected selections left the session without an active database, and V2 start refused. The owner database hash and fixture directory entries matched before and after. The native disposable WAL gate is complete. [Desktop refusal result](../../tmp/fixtures/wp02-windows-symlink-acceptance-20261123_224313/desktop-alias.json).

Pre-backup: `backups/pre_opencode_changes_20261123_172050_nsr7-file-symlink-wal-verification`. Production code and database files were outside this verification run. No app build or Windows configuration changes ran.
