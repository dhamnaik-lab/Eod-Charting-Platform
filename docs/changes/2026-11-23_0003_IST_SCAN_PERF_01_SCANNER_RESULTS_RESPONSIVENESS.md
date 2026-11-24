# SCAN-PERF-01 — Scanner Results responsiveness

Recorded 23 November 2026 at 00:03 IST. The authorized checkout is `E:\TA Projects\EOD Charting Platform`, with base commit `f78b034e91e2dd506d33ca0dd076f87c5eda6b9f` and tree `645ad1216ffa264fb0f6068d147e47c7d50802c2`. The eight pre-existing local files were inventoried and hashed before work.

## Defect and cause

The reported portable reproduction scanned the 14-symbol NSE Sector - Nifty Bank universe with all 74 scanners, including 54 chart patterns, using All history and Responsive execution. It returned 55,497 matches, 55,450 grouped episodes and zero alerts. The reported scan progress reached approximately 40 seconds, then Results took additional time to appear. Open Results slowed chart interaction until the window closed.

Before the correction, `ScannerWindow` created React elements, formatted metadata, and mounted cells and two action controls for every filtered row. The filtered results, historical count, and Pattern Map entries were already memoized. The chart's `syncViewport` action replaces the `chartTabs` array, which the Scanner subscribed to even though it only used the active instrument. Viewport updates consequently reconciled the entire visible Results table. Isolated hover actions produced zero Scanner renders in both variants. The benchmark reproduced expensive mount and viewport reconciliation independent of scanner execution, the Rust backend, and data reads. Closing followed the existing RootApp unmount path.

## Implementation and preserved behavior

- The Results table slices the filtered collection into pages of 100 and keeps the original order. It displays the filtered and overall counts, current and total pages, and First, Previous, Next and Last. The controls disable at the appropriate boundaries. Table filters and workspace application reset to page one. Starting and completing a scan reset the page. The rendered page also clamps to the available range.
- ScannerWindow subscribes to the active instrument, database path and watchlists it consumes. Memoization skips parent renders with unchanged props. An instrument change still updates the Scanner. Compact, Pattern Detail, Values and Debug share the same bounded table and pass the original records to the existing Show and Alert handlers.
- Historical Pattern Map filtering and publishing continue to consume the complete scan output, including confirmed episode metadata, instrument and date, geometry, selection and marker behavior. The reported 55,450 historical episodes and the benchmark's 55,497 eligible synthetic episodes are different input compositions.
- Scanner execution, predicates, native opt-in and 32-rule limit, TypeScript fallback, historical calculation, progress, cancellation, alert behavior, corporate-action safety, and database behavior were preserved.

## Performance comparison

A local headless Chrome harness mounted the production-built ScannerWindow with 55,497 deterministic synthetic results for both variants. It used the real chart store, an in-memory Show destination, a stubbed settings write, and the same open/close mounting boundary as RootApp. It measured from result assignment to the second animation-frame callback with Results mounted. Six synthetic viewport actions and six hover actions sampled the same two-frame interval. No chart canvas, database, or native WebView was involved. These single-run measurements describe the renderer workload and DOM impact.

| Measurement | Before | After |
| --- | ---: | ---: |
| Completion payload to Results with rows | 40,846 ms | 190 ms |
| Mounted result rows | 55,497 | 100 |
| Scanner renders across six viewport actions | 7 | 0 |
| Median open-window viewport interval | 759 ms | 33 ms |
| Median closed-window viewport interval | 33 ms | 33 ms |
| Scanner renders across six hover actions | 0 | 0 |
| DOM nodes with Results open | 1,720,797 | 3,504 |
| Used JS heap after GC, Results open | 525.0 MiB | 31.4 MiB |
| Used JS heap after GC, Scanner closed | 2.52 MiB | 2.20 MiB |
| Remaining result rows after close | 0 | 0 |

The close measurements were taken with the same full result set and before publishing the map. An explicitly published Pattern Map still retains its entries in the chart UI store according to existing behavior. Evidence and the benchmark harness are under `tmp/SCAN_PERF_01_20261122_182621/`.

## Checks

- `npm.cmd run typecheck:renderer` — PASS.
- `npm.cmd test -- src/components/__tests__/ScannerResultsPagination.test.tsx src/components/__tests__/ScannerChartRouting.test.ts src/plugins/scanner/__tests__/scannerPatternMap.test.ts` — PASS, 28 tests in 3 files.
- `npm.cmd test` — PASS, 2,169 tests passed and 1 skipped across 293 files.
- `npm.cmd run build:renderer` — PASS in 6.02 seconds. Vite transformed 851 modules. Both benchmark-only builds emitted a chart-analysis/chart-core circular chunk warning.
- `node scanner-perf.mjs before` and `node scanner-perf.mjs after` — PASS. The corrected browser run verified boundary controls, filtering and counts, replacement with a smaller collection, Show and Alert on page two, full map publication, and zero viewport-triggered Scanner renders. The focused tests also cover a middle page, metadata and each view preset.
- The npm commands ran on the isolated source copy using the installed dependencies. Theme regeneration and build output stayed in that copy. SHA-256 matched for all eight unrelated Git entries and the existing ignored audit archive. The validated source copy hashes match the edited source files.

- `scripts/validate-change.ps1 -Profile docs` — PASS for live documentation references and changed-line whitespace.

## Rollback and native acceptance

The pre-edit backup is `backups/pre_opencode_changes_20261122_235621_scan-perf-01/`. With approval, revert the ScannerWindow patch, remove the added test and change record, and remove the SCAN-PERF-01 entries from the two current status documents. Preserve any subsequent changes and existing local files when reversing those edits.

Windows portable acceptance is pending. On a separately authorized portable rebuild and live-data session, repeat the original 14-symbol scan with the same settings. Verify the time from final scan status to usable Results, then zoom, pan, and move the crosshair with the Scanner open and closed. Check keyboard/page boundaries and all view presets, inspect a historical episode from a non-first page, and confirm map marker selection and pattern geometry on the chart. Verify the Alert action through the operator-approved test procedure.

## Files changed

- `src/components/ScannerWindow.tsx`
- `src/components/__tests__/ScannerResultsPagination.test.tsx`
- `HANDOFF.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- This change record.

## Windows responsiveness acceptance — 23 November 2026 at 00:46 IST

**PASS, operator-confirmed.** With 55,497 results on the 14-symbol Nifty Bank All History run, the user confirmed chart interaction remained responsive while Scanner Results was open. The 74-rule selection used TypeScript because it exceeds the 32-rule native limit and includes unsupported native history. Eligible native-versus-TypeScript runtime parity remains pending. The earlier NS-R2/NS-R3 portable hash is evidence for that build only. This closeout has no independently verified SCAN-PERF-01 executable hash or separate operator results for alert, map, and keyboard checkpoints. [DOCSYNC-02 acceptance evidence](2026-11-23_0046_IST_DOCSYNC02_NATIVE_SCANNER_AND_SCAN_PERF_ACCEPTANCE.md).
