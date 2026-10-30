# BHAV-02 R2 — All supported NSE series ingestion

- IST: 2026-10-28 11:16:56
- Workstream: E:\TA Projects\EOD Charting Platform
- Objective: Move series filtering exclusively to Symbols sidebar; accept all valid supported NSE series in ingestion.
- Previous limitation: NSE parser discarded eight configured series; automatic NSE single-update independently discarded GS/GB; downloader exposed redundant Exclude Series controls.
- Files modified: five source files recorded in manifest and Apply evidence. No schema changes.
- Final implementation: CSV parser ignores legacy excluded series while retaining normal validation. Automatic updater supplies empty exclusions. New settings default empty, previously stored excluded-series values are preserved for wire/recovery compatibility. Downloader exclusion UI removed; Sidebar unchanged.
- Behavior preserved: BSE groups and indices, NSE identity/series metadata, OHLCV validation, binary writer/durability/recovery, Sidebar visibility settings, existing stored data and all unrelated UI.
- Validation commands: cargo test --offline --locked ... bhav02 -- --test-threads=1; cargo test ... bhavcopy; cargo test ... -- --test-threads=1; cargo check ...; cargo build ...; npm run typecheck:renderer; npm test; npm run build:renderer -- --outDir <project tmp>.
- Focused Rust: 4 passed; Bhavcopy regressions: 91 passed, 3 ignored.
- Full Rust: FAILED 1021 passed, exact pre-existing 10 failed, 25 ignored. Serial harness; parallel-suite stability not certified.
- Renderer typecheck and Vite build: PASS. Vitest: FAILED same pre-existing 14 failed and two unhandled errors, 1157 passed.
- Risks/limitations: Historical excluded rows are not automatically recovered; re-download requires explicit user authorization. Existing in-progress recovery sessions may retain previously filtered staged records. No live import, production DB, release/portable build, or manual UI checkpoint performed. Baseline test failures unresolved.
- Rollback: Invoke-EOD-BHAV02-R2.ps1 -Mode Rollback -BackupDirectory 'E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261028_111656_BHAV02_R2'; restore five source files with verified source hashes. Rebuild after rollback.
- Original and patched source SHA256: package manifest and evidence summary.
- Backup: E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261028_111656_BHAV02_R2
- Evidence: C:\Users\dharm\Downloads\EOD_BHAV02_R2_Apply_EVIDENCE_20261028_111656_IST.zip
