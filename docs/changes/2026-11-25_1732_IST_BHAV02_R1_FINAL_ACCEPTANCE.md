# BHAV-02 / R1 — Final native acceptance and publication authority

IST record timestamp: 2026-11-25T17:32:36+05:30. Owner approved guarded publication on 25 November 2026 after the 16:55 no-write test. Base `828c9172d46d3c6067995dcadfa30cc1cbdb8387`, branch `fix/bhav-02-date-activity-20261125`. Accepted candidate executable SHA-256 `1479F48B14298AD802B40710B590E54544C9C7AD2839613FE5C9FB554060DC09`. Resume evidence SHA-256 `B0AED50B563E778F708B6907C6A9AA2D1E99FCA2B6F5D59B7DA3672CE1B614BF`. Detailed monthly log SHA-256 `D232E1B1A99837595FB3CB54055A25ACA094F8A304A740B60EB6241EFC08E98A`.

## Objective and prior limitation
Complete the accepted date-wise logging scope. Previous logs were source-grouped, verbose for holidays/pending dates, and lacked an explicit no-new-write checkpoint confirmation.

## Implementation and preservation
Chronological date results, equivalent outcome grouping, saved holiday/special-session and IST cutoff context, detailed raw diagnostics with separate raw summary, and backend-proven no-new-quotation-write reporting. The tested source is unchanged by this publication step. Raw outcomes, source validation, planner, coverage rules, import/recovery/checkpoint algorithms and existing prices are not intentionally changed by this logging work. Protected Cargo/build metadata, the prior executables and RECOVERY-01B hold remain local and excluded. No production database access.

## Actual validation
- 237 distinct Rust tests passed (189 Bhavcopy, 19 recovery, 29 binary storage; focused test included), 4 ignored; 54 Vitest tests across 8 files passed. Rustfmt and diff check passed in prior evidence. Typecheck passed; renderer build 6.98 s; offline locked native release build 3 min 19 s. Earlier ANSI marker false failure was resolved by resume evidence. Existing unused-function warning remains.
- Operator monthly test on New Database, 25 Nov 16:48:22–16:50:43 IST: all 25 dates/100 source-date pairs; 48 existing, 3 imported, 32 skipped, 1 pending, 15 incomplete, 1 failed. Imported 8,856 rows (NSE 3,594; BSE 5,183; BSE Index 79); 14 new files and 8,842 APPEND_NEWEST, zero reported write errors or existing quotation changes. Fast path 8,842/8,842; background checkpoint reported complete in 93.137 s. Genuine Nifty50 USD invalid OHLC on Nov 6 remained an error. Detailed diagnostics retained; holiday/pending presentation correctly contextualized.
- Operator single-date test 2 Nov, 16:55:46–16:55:49 IST: 3 existing, 1 incomplete NSE Index, 0 inserted/failed; explicit `No new quotation writes in this download — no new checkpoint required`. Native logging acceptance PASS.

## Files in publication
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `HANDOFF.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `docs/changes/2026-11-25_1302_IST_BHAV02_DATE_ACTIVITY_LOG.md`
- `docs/changes/2026-11-25_1451_IST_BHAV02_R1_LOG_REFINEMENTS.md`
- `docs/changes/2026-11-25_1732_IST_BHAV02_R1_FINAL_ACCEPTANCE.md`
- `src-tauri-shell/src/bhavcopy/activity_report.rs`
- `src-tauri-shell/src/bhavcopy/ingestion.rs`
- `src-tauri-shell/src/bhavcopy/mod.rs`
- `src-tauri-shell/src/bhavcopy/tests.rs`
- `src-tauri-shell/src/bhavcopy/types.rs`
- `src/components/BhavcopyDownloadWindow.tsx`
- `src/components/__tests__/BhavcopyDownloadRerun.test.ts`
- `src/features/bhavcopy/__tests__/activityLog.test.ts`
- `src/features/bhavcopy/activityLog.ts`
- `src/store/bhavcopyStore.ts`
- `src/types/desktop.ts`

## Limitations and rollback
Runtime telemetry is not independent physical verification or source-price parity for the latest 8,856 rows. The 93-second checkpoint is an observation, not a proven regression. Historical special-session migration, NSE Index missing coverage/retries/invalid OHLC (BHAV-03), and production legacy recovery (RECOVERY-01B) remain outside scope. Do not open or repair the held original DB. Exact pre-publication backup: `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261125_173237_BHAV02-R1-Publish-20261125-173236-496915`. Restore or revert only with owner approval; do not reset/clean/force-push. Publication/PR merge and standard portable packaging are pending actual receipts; do not infer completion from this record.
