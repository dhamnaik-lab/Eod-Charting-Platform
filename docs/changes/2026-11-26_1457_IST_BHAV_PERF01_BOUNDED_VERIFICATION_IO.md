# BHAV-PERF-01 — Bounded verification I/O optimization

IST: 2026-11-26T14:57:56+05:30

Status: LOCAL CANDIDATE; Rustfmt/compilation/tests and native performance comparison pending. Base `79429074ee174f9a1c982061187b0492524fd890`; accepted runtime remains portable SHA-256 `31262762F6DEE11A0B76B7F6065CFDD158E526FE09AA3E41F1B343925112AF4A` until an explicitly approved replacement build and native acceptance.

## Objective
Reduce repeated physical opens and metadata queries in planning and receipt finalization, while preserving exact existing calendar decisions, coverage verification and missing-only admission. Baselines: November 2026 planning 18/23 s; November 2025 log/receipt stage about 32.5 s; Update log/receipt stage 6,128 ms.

## Files changed
- `src-tauri-shell/src/bhavcopy/coverage/tests.rs`
- `src-tauri-shell/src/bhavcopy/coverage.rs`
- `src-tauri-shell/src/bhavcopy/ingestion.rs`
- `src-tauri-shell/src/bhavcopy/mod.rs`
- `src-tauri-shell/src/bhavcopy/tests.rs`
- `src-tauri-shell/src/database/binary_eod.rs`
- `HANDOFF.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `docs/changes/2026-11-26_1457_IST_BHAV03BCD_NATIVE_CLOSEOUT.md` (prior functional acceptance closeout)
- `docs/changes/2026-11-26_1457_IST_BHAV_PERF01_BOUNDED_VERIFICATION_IO.md` (this record)

## Implementation
- Preserve the existing header/record checks, exact binary search and 31-day receipt windows. Use a single read handle for the header and subsequent physical verification. Existing `open`, `forward_records` and `read_range` wrappers continue their established behavior for other callers.
- Cache only calendar contradiction physical-presence results within a window of up to 31 candidate dates and one exchange, using the existing per-date sidecar query and per-date physical search. Require matching size/mtime before reuse, discard changed files, keep identity checks and per-date error outcome. This is not source membership proof and never authorizes receipt-based skip. Hybrid retains its previous SQL probe. Cache is discarded at the window boundary; no persistent schema or cache changes.
- Read storage mode once per guarded verification pass and recheck at completion. Do not reuse proof if mode changes. Reuse prepared SQL for Hybrid rows and receipt upserts without changing SQL semantics, transaction boundaries, schema or checkpoint activation.
- Separate calendar-probe timing, physical receipt verification, serialization/receipt saving and outcome/log-writing measurements. Preserve existing total timing and chronological normal activity presentation.

## Preservation and validation
Retain accepted security admission, held/incomplete outcomes, archive date/identity/OHLC validation, alias/Hybrid parity, full structural scanning, receipt SHA-256 and pending-session checks, forced repair behavior, retry cap/lookback/cooldown, recovery journal and durability. No new dependencies or frontend changes; no database migration. Never replace member proof with sidecar counts.

New focused fixture tests cover batched calendar presence vs individual physical search (including gaps/missing/wrong identity), within-window invalidation after file change, and same-handle range/forward verification including duplicate-date rejection. Existing BHAV-03BCD and all relevant Bhavcopy, recovery and binary regressions must pass. Run canonical Rustfmt and shared Cargo serially with existing offline/locked wrapper; docs reference check. Actual Windows validation output will be appended by the guarded runner. No Git commands, source publication, native release/portable replacement, actual database access or network download in this runner.

## Risks and limitations
Calendar batching precomputes each required date for an encountered symbol; CPU/seek work and metadata checks may offset open savings on some histories. The run-local cache assumes the existing guarded price-store operation; external concurrent file writers are not an accepted workflow. Size/mtime guards are not a new content-identity guarantee. Performance remains unmeasured until matched Windows native comparison; do not claim speedups or completion based on focused tests alone. Existing source failures and held rows remain outside scope.

## Rollback
Use only the runner's exact scoped source/doc backup and recorded hashes; restore affected paths only with explicit authorization. Do not restore or remove database files, receipts, journals, evidence or shared build artifacts. Keep the accepted BHAV-03BCD portable until a new portable is explicitly approved and validated.

## Actual local validation

IST: 2026-11-26T15:11:33+05:30

Status: PASS_BHAV_PERF01_WINDOWS_AUTOMATED

- {"rustfmt": "PASS", "files": ["src-tauri-shell/src/database/binary_eod.rs", "src-tauri-shell/src/bhavcopy/mod.rs", "src-tauri-shell/src/bhavcopy/ingestion.rs", "src-tauri-shell/src/bhavcopy/tests.rs", "src-tauri-shell/src/bhavcopy/coverage.rs", "src-tauri-shell/src/bhavcopy/coverage/tests.rs"]}
- {"filter": "bhavperf01_", "passed": 3, "failed": 0, "ignored": 0}
- {"filter": "bhavcopy::", "passed": 204, "failed": 0, "ignored": 4}
- {"filter": "bhavcopy_recovery::", "passed": 19, "failed": 0, "ignored": 0}
- {"filter": "database::binary_eod::", "passed": 29, "failed": 0, "ignored": 0}
- {"docsReferences": "PASS"}

Scoped backup: E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261126_150151_BHAV-PERF-01-20261126-150150-428131

Native performance acceptance and release build remain pending. No automatic rollback.
