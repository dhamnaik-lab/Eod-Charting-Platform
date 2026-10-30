# Chart history request consistency - 29 October 2026

## Scope and conclusion

The user approved fixes from the deeper chart-history audit. This work repairs
confirmed request/cache, database-context, transport-integrity and reporting
defects. It does not claim that every defect caused the supplied cold-start
screenshots, or that the previously working release has been reproduced.
No data loss, incomplete past download, or required backfill is inferred from
the chart's visible-bar count. No historical download/source route is changed.

## Implemented corrections

1. `src/platform/tauriDesktop.ts`: cache entries include the caller's database
   context. Global invalidation revokes pending reads. A forced reload bypasses
   cached/in-flight data and supersedes older reads of that key. Stale results
   cannot repopulate the cache or remove a newer pending request during cleanup.
   Cache-only fields are stripped before IPC; they do not select a backend DB.
2. `chartInstrumentHydrationService.ts`, `compareOverlayService.ts` and the new
   `chartLoadGuard.ts`: forced refresh reaches both cache layers and comparison
   history. Shared generations revoke publication after a clear, while per-read
   revisions prevent an old response overwriting a newer forced refresh.
3. `chartInstrumentCompareController.ts` and
   `chartSnapshotHydrationService.ts`: results target the initiating tab IDs,
   database, instrument and price settings. Later requests supersede earlier
   requests across both controllers. Closed/replaced tabs and superseded startup
   callbacks cannot receive the old payload. Comparison results receive the same
   database/settings checks. A later hydration refresh is no longer dropped just
   because a previous hydration is pending.
4. Hydration failures report an actionable toast through the existing store.
   Retained bars retain their actual loaded-mode flags. Instrument changes reset
   those flags until a successful load; failure does not claim a requested mode
   has loaded.
5. `database/eod_data.rs`: a read resolves the selected folder once and uses
   `with_connection_for_folder` for that same folder. SQLite metadata and binary
   prices cannot resolve different active databases during that operation.
6. `binaryEodDecoder.ts`: reject malformed envelopes, missing/excess bytes,
   invalid/unordered dates and non-finite values. A shortened payload is not
   accepted as a successfully loaded shorter history. Missing IPC payloads are
   errors rather than silently cached empty charts.
7. `TileHeader.tsx`: missing index previous close displays `Change unavailable`,
   matching the corrected main header. Valid references and equity fallback are
   preserved.

Existing data files, index alias registry, exact-symbol reads, corporate-action
approval/adjustment rules, drawing geometry and viewport policy are preserved.

## Read-only loader/transport comparison

The opt-in ignored Rust acceptance test opens the selected database with
`SQLITE_OPEN_READ_ONLY`, sets `PRAGMA query_only=ON`, and uses an explicit read
transaction. It calls the same instrument-resolution, price-loading, adjustment
and packing functions as the chart command. It never calls database preparation,
imports, recovery, approvals or writable connection helpers.

Selected input: `EOD DATABASE`, `NSE_INDEX:NIFTY`, 1900-01-01 to 2100-12-31.
The capture includes direct JSON rows and packed bytes for raw and adjusted reads.
The actual TypeScript decoder is compared against every direct date and OHLC,
volume and optional previous-close value.

- PASS: 3,622 bars in raw mode; 3,622 bars in adjusted mode.
- PASS: all decoded dates and chart values match the direct rows.
- PASS: first date 2000-01-03; last date 2026-10-26.
- PASS: before/after SHA-256 values are unchanged for `NIFTY.eod`,
  `CNXNIFTY.eod`, `SPCNXNIFTY.eod`, `market-data.sqlite3` and its existing WAL.

Evidence is retained under `tmp/chart-history-parity-20261029_124116/`:
`nifty-parity.json` and `source-hashes.json`. These are separately owned audit
evidence, not managed disposable scratch or Cargo artifacts.

This measures the current loader and encoding/decoding functions on the selected
data. It does not exercise the actual native IPC channel, the previously built
release, native chart rendering, or desktop acceptance. It does not establish
the completeness of any historical download.

## Backup and verification

Backups:
- `backups/pre_opencode_changes_20261029_123101_chart_history_request_consistency`
- `backups/pre_opencode_changes_20261029_123457_chart_parity_test_evidence`

Measured checks so far:
- PASS: shared-Cargo Preview/Run for `database::eod_data::`: 24 passed,
  2 explicit ignored acceptance tests; compile/link 58.10s, tests 0.07s.
- PASS: shared-Cargo Preview/Run for the explicit
  `readonly_nifty_transport_parity_acceptance -- --ignored --nocapture`:
  1 passed; harness rebuild 33.80s, capture 0.31s.
- PASS: focused renderer/decoder/cache/controller/header and read-only parity
  tests: initial corrected run 36/36. Subsequent startup/comparison additions
  plus existing chart mutation/drawing-scope tests: 20/20.
- PASS: final selected run across nine active-source test files: 47/47,
  including the read-only parity comparison, cache races, startup callback,
  comparison refresh and existing chart mutation/drawing-scope regressions.
- PASS: final renderer profile (typecheck and scoped whitespace), after all
  code and test additions. Only ordinary LF-to-CRLF Git notices were reported.
- PASS: scoped Rust formatter/check on the acceptance-test source; no blanket
  reformatting of the existing dirty backend files. Existing warnings remain
  confined to untouched `bhavcopy/holiday_sync.rs`.
- Initial renderer run: 31 passed, 1 failed because the new tiled-header test
  omitted the existing positive percentage sign. The expectation was corrected;
  no product behavior was changed for that failure.

No release EXE, installer or portable staging was built. No commit or push.

## Native follow-up and remaining limits

The user has since rebuilt/restarted and supplied native daily/weekly/monthly/yearly
chart views, successful ordinary Adj OFF/ON reload notifications and a settled
database status. See [the scoped native closeout](2026-10-29_CHART_NATIVE_ACCEPTANCE_CLOSEOUT.md).
This replaces the obsolete rebuild-required note; it does not establish full
historical completeness or manually accept every request-consistency scenario.

Deliberate tab/symbol/database changes while reads are pending, comparison-refresh
stress and the original historical boundary investigation remain outside the
provided native acceptance evidence. If a discrepancy is reported, capture the source folder,
resolved aliases, loaded count, first/last date and displayed date range from
that same native request. Do not replace data or start a backfill as a diagnosis.
