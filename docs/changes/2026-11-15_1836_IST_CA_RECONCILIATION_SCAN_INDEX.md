# Corporate Actions reconciliation scan lookup index

Portable build `20261115.183601` is ready. Index application and the post-index benchmark are pending.

## Measured baseline

On the actual project `EOD DATABASE`, portable `20261115.163121` took 240.094 s and 236.101 s for the same 500 pending import IDs. Each run captured all 500 and reported zero approvals and zero repairs. The repeated batch fingerprint was `42115A5E2393732668E5A748FA5D98A37CADE5868C6E2F2F882862D7533A227D`.

SQLite appeared in 172 of 175 sampled worker stacks. Read-only query plans showed full scans of the 344,461-row `corporate_action_scan_results` table for latest completed scan lookup, per-import scan history, and the related scan-run subquery. The existing run-ID index does not serve import-ID filters. The earlier same-date cache passed the user-run Rust reconciliation suite (51 passed, 2 ignored), which predates this index.

The targeted desktop CSV exported nine requested rows completely. It showed LMW import 35963 ready for writer recheck with a 10× Split and separate percentage Dividend review. That export establishes targeted desktop behavior. Full-queue performance remains open.

## Source and portable

[Database setup](../../src-tauri-shell/src/database/bootstrap.rs) now creates `idx_corporate_action_scan_results_import_latest` on `(corporate_action_import_id, scanned_at DESC, id DESC)`. The run-ID index, report queries and their ordering are unchanged. Index creation happens through ordinary schema setup when the rebuilt portable opens the database.

The user rebuilt the portable in `release/tauri-portable-win/EOD Chart Portable`. Its executable contains the new index definition and matches `target/release/eod-charting-platform-shell.exe` by SHA-256 `9B804C1160F3D881EFBD52577BD352180C9B215556C0BB9D48643EE46D481035`. A read-only SQLite schema check at handoff found the index absent from the actual database.

- [Source pre-backup](../../backups/pre_opencode_changes_20261115_183401_ca-scan-lookup-index-31e45aa9/backup-manifest.json)
- [Documentation pre-backup](../../backups/pre_opencode_changes_20261115_184436_ca-index-doc-handoff-668cd77b/backup-manifest.json)

## Next chat

1. Verify that the specified portable and actual project database are the intended pair. Open the portable normally to apply the approved index. Avoid financial actions and any other database writes.
2. Verify the index definition and the latest-scan, scan-history, and scan-run query plans read-only.
3. Use the native read-only preview on the first 500 unapproved imports. The original response order ran from ID 46782 through 45310. SHA-256 of its compact JSON ID array is `d33cdad4f2f38a800f97a51852636a73b13230f6a356e1302860580c068f514f`. If the selection differs, report the drift before claiming a like-for-like comparison.
4. Report elapsed time, captured IDs, and outcome counts. Baseline outcomes were 474 evidence blocked, 21 deferred scope, 3 classification review, and 2 repair candidates. Expect zero approvals and zero repairs. The outer batch fingerprint can change with build and schema identity. The earlier baseline did not retain individual row fingerprints.

The user requires the specified portable and actual database for performance work. Windows Sandbox and synthetic databases are excluded. No migration, post-index benchmark, docs validator, or rebuild was run by the agent during this documentation handoff.
