# Bhavcopy Final Acceptance and Documentation Reconciliation

Date: 2026-08-10 12:12 IST

## Scope

This record consolidates the accepted August 8–10 EOD Charting Platform import/download work and reconciles the canonical documentation against the source snapshot:

`Eod Charting Platform Source Code 2026-08-10_121107_IST`

Inspected pre-reconciliation ZIP SHA-256:

`75afdd6c37312f78a8c87295eaed23486a2386699ff1aff8ceb4187e0720ab69`

This is a documentation-only reconciliation. It does not change renderer or Rust runtime behavior.

## Final current contract

### Manual Import Recovery

- Protected Binary Manual Import uses durable database-bound recovery sessions.
- Session history persists across restart and is listed newest-first.
- Session-specific Undo removes only proven inserted rows, restores overwrite before-images, and preserves later conflicting edits.
- Session-created placeholder instrument cleanup is allowed only when provenance proves the row belongs to that import session.
- Quotation Editor deletion does not auto-prune instrument identity.

### Bhavcopy Recovery Phase 2B.1

- Protected imports persist a normalized journal before mutation.
- Existing-file APPEND_NEWEST candidates have exact pre-import record count, price scale, and file length baselines.
- Baseline integrity is SHA-256 protected.
- Recovery refuses structurally inconsistent pre-import files and unknown/conflicting post-baseline records.
- Recovery restores the exact boundary before durable replay when required.

### Bhavcopy Phase 2C

- Binary worker cap remains 4.
- Only recovery-journal-governed existing-file APPEND_NEWEST may defer physical `sync_data()`.
- `REWRITE_TAIL`, `UPDATE_EXISTING`, `INSERT_HISTORICAL`, Manual Import, and recovery replay remain immediately durable.
- Successful buffered imports retain an `APPLIED` session until verification plus physical checkpoint completes.

## Runtime acceptance

### Append-heavy Phase 2C benchmark

Workload: 2026-08-03 through 2026-08-07, NSE Equity + BSE Equity + NSE Index + BSE Index.

Observed:

- rows: 43,081;
- symbols: 9,885;
- new files: 573;
- APPEND_NEWEST: 9,312;
- binary-write wall time: 23,325 ms;
- foreground `sync_data`: 0 calls;
- deferred APPEND_NEWEST sync: 9,312;
- binary write errors: 0.

Comparable prior 4-worker reference:

- binary-write wall time: approximately 305,827 ms;
- APPEND_NEWEST: 8,132;
- `sync_data`: 8,132 calls.

The accepted Phase 2C run reduced the binary-write wall phase by approximately 92% versus that reference.

### Deferred checkpoint

The next Bhavcopy operation detected the retained Phase 2C session and checkpointed all 9,312 APPEND_NEWEST files in about four seconds.

Decision:

**Do not implement Phase 2D background checkpointing now.**

The measured checkpoint cost is small enough that the additional lifecycle/concurrency complexity is not justified. Reopen Phase 2D only if future real workloads show materially blocking checkpoint latency.

### Historical BSE October 2023

Range: 2023-10-01 through 2023-10-31, BSE Equity + BSE Index.

Observed:

- 20 active trading days;
- 40 download jobs;
- 40 success;
- 0 failed;
- 84,212 imported rows.

This validated the repaired historical BSE source path for that period.

### Historical overlap/backfill behavior

A later 2023-08-01 through 2023-10-31 run correctly prefiltered the already imported October dates. Backfilling August/September behind October produced thousands of `REWRITE_TAIL` operations and therefore remained slower because conservative paths physically sync immediately.

Operational implication:

For large historical population, prefer oldest-to-newest chronological loading when practical. Do not treat a backward-fill workload as directly comparable to an APPEND_NEWEST benchmark.

### BSE Index literal-date defect

Previously missing/problematic BSE Index dates:

- 2023-09-08;
- 2023-09-14;
- 2023-09-20;
- 2023-09-25.

Root cause:

The BSE `IndexArchDailyAllPar` endpoint is sensitive to the literal `DD/MM/YYYY` query representation. Building the query through URL pair encoding changed slash characters to `%2F`, which could produce HTTP 200 with an empty result. The standalone working BSE Index implementation preserved literal slashes.

Fix:

`build_bse_index_archive_url()` now preserves literal slash-form dates.

Validation:

- focused regression: 1/1 PASS;
- Bhavcopy test filter: 40/40 PASS;
- `cargo check`: PASS.

Runtime acceptance:

- 2023-09-08: 57 rows;
- 2023-09-14: 57 rows;
- 2023-09-20: 57 rows;
- 2023-09-25: 57 rows;
- aggregate: 4 success, 0 failed, 228 rows.

### July 2026 missing-date backfill

Range: 2026-07-17 through 2026-07-31, BSE Equity + BSE Index.

Observed:

- 12 jobs;
- 12 success;
- 0 failed;
- 53,813 imported rows;
- 5,439 `REWRITE_TAIL`;
- 300 `INSERT_HISTORICAL`;
- 576 `APPEND_NEWEST`;
- 5,739 immediate `sync_data` calls;
- 576 deferred APPEND_NEWEST syncs.

The slower binary phase is expected because the majority of the workload is historical mutation behind later existing records.

## Remaining non-blocking performance observation

One BSE overlap run scanned 16,687 binary files during prefilter reconciliation and took about 39.1 seconds. This remains a measurable optimization opportunity, but it is not a correctness blocker and is not part of the accepted Bhavcopy closure.

## NSE equity series/group boundary

The accepted Bhavcopy close does **not** authorize a new equity-series ingest whitelist. Supported NSE equity/trade-for-trade/SME series such as `EQ`, `BE`, `BZ`, `SM`, `ST`, and `SZ` remain stored with series metadata. Normal daily filtering belongs in the Symbols/sidebar layer. Existing configured government-security exclusions are a separate non-equity rule.

## BSE symbol/identity boundary

The standalone EOD Downloader's BSE Equity path can derive normalized symbols from company/security-name text. That output must not be treated as canonical exchange-symbol data for Manual Import.

The Charting Platform must preserve official exchange identifiers. Current legacy BSE bhavcopy parsing can use official numeric `SC_CODE` when the source does not supply an alpha ticker. Do not convert company names into synthetic symbols. If the product requires canonical alpha trading symbols for historical BSE rows, implement a separate audited `SC_CODE`/ISIN identity mapping.

## Compact progress UI

The renderer-only compact progress correction keeps full diagnostics in the Activity Log while limiting the Bhavcopy footer/global status surface to compact progress text.

Validation:

- renderer typecheck: PASS;
- repository tests: 36 files / 235 tests PASS;
- renderer build: PASS.

The later portable source includes the change. A dedicated screenshot-based visual acceptance record was not separately captured, so this item remains a minor visual-verification boundary rather than a Bhavcopy correctness blocker.

## Documentation reconciliation

Updated canonical documents:

1. `AGENTS.md`
2. `HANDOFF.md`
3. `README.md`
4. `REQUIREMENTS.md`
5. `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
6. `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
7. `FILE_INVENTORY.md`
8. `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`

Updated current change evidence:

- `2026-08-09_1702_IST_MANUAL_IMPORT_RECOVERY_HISTORY_V1_2.md`
- `2026-08-09_2110_IST_BHAVCOPY_RECOVERY_HARDENING_PHASE2B_1_V1.md`
- `2026-08-09_2323_IST_BHAVCOPY_APPEND_NEWEST_BUFFERED_DURABILITY_PHASE2C_V1.md`
- `2026-08-10_0145_IST_BHAVCOPY_COMPACT_PROGRESS_UI_FIX_V1.md`
- `2026-08-10_BSE_INDEX_LITERAL_DATE_URL_FIX_V1.md`

## Final disposition

Bhavcopy is **complete for the current scope** and should be frozen.

No Phase 2D work is planned now.

Future Bhavcopy changes should require a new reproducible correctness defect or a measured performance case that justifies altering the accepted recovery/durability contract.

A final pre-handoff documentation consistency pass is recorded separately in `docs/changes/2026-08-10_1235_IST_FINAL_DOCUMENTATION_AUDIT_V2.md`.
