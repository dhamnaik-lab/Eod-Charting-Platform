# NSE Index historical alias resolution - 29 October 2026

Later scope clarification: the user reports a loading/display regression, not
data loss. The [request-consistency implementation and read-only parity evidence](2026-10-29_CHART_HISTORY_REQUEST_CONSISTENCY.md)
supersede any suggestion here that backfilling should be the next diagnostic step.

## Cause and persisted evidence

Read-only inspection of `EOD DATABASE/database.json`, SQLite opened with
`mode=ro` and `PRAGMA query_only=ON`, and the relevant EOD1 files established:

- Price storage mode is binary. No NIFTY/CNXNIFTY identity-history links exist.
- `NIFTY.eod` has 2,718 records, including 35 in 2015 starting on November 9.
- `CNXNIFTY.eod` has 663 records from February 8, 2013 to November 6, 2015,
  including 204 in 2015. Those 204 plus NIFTY's 35 explain the 239 imported dates.
- `SPCNXNIFTY.eod` has 241 records from February 21, 2012 to February 7, 2013.
- `CNXBANK`/`BANKNIFTY` also have separate histories at the 2015 boundary.
- The old chart compared November 9, 2015 (7,915.20) with January 31, 2005
  (2,057.60). The stored November 6, 2015 close is 7,954.30; the boundary
  comparison should be -39.10 (-0.49%).

Official authority for the 2015 equivalences is the
[September 22, 2015 NSE/IISL announcement and annexure](https://niftyindices.com/docs/default-source/press-release-upload/ind_prs22092015.pdf),
effective November 9, 2015. SPCNXNIFTY retains the importer's pre-existing
explicit equivalence. The registry does not infer aliases from prices or prefixes.

## Change

- A shared explicit NSE Index registry joins historical names during chart
  identity resolution and canonicalizes those same names for future imports.
  Existing canonical storage keys such as NIFTY, BANKNIFTY, FINNIFTY and
  SMALLCAP100 are retained. Distinct return/strategy indices are not inferred
  from a common prefix. The annexure's industry-indices category is not treated
  as one index.
- Both binary and Hybrid/SQLite chart reads use the resolved aliases. Equal
  duplicate bars are returned once. Conflicting OHLC, volume or open-interest
  values stop the read with the symbol/date evidence rather than silently choosing.
- Existing persisted identity events and corporate-action lookup are retained.
  Exact-symbol reads (`resolveIdentity: false`) retain exact symbol selection.
  The registry does not create persisted identity events or rewrite source data.
- NSE Index chart output clears previous close after breaks longer than seven
  calendar days and on the first returned bar. This is a conservative display
  guard, not a trading-calendar completeness test. Both canvas summary styles show
  `Change unavailable` when no valid index reference is supplied; equity fallback
  behavior is unchanged. The guard also runs after adjusted-row recomputation.
- Date Range logs distinguish exchange-day completion from per-index history
  coverage and explicitly disclose when the existing 31-date binary-reconciliation
  limit skips verification. Scheduling, the scan cap and imported-day status are
  unchanged; no automatic repair or forced redownload is introduced.

## Scope and recovery

Backup: `backups/pre_opencode_changes_20261029_105802_nse_index_alias_history`.
Existing dirty-worktree work is preserved. No production database writes, source
file merges/deletions, downloads, approvals, release builds or portable staging
are part of this change. This joins available alias history; genuinely absent
older periods still need an independently reviewed source backfill. Legacy
instrument entries remain present in the database/sidebar.

Implementation: `database/index_aliases.rs`,
`database/eod_data/index_alias_history.rs`, the chart-loader hooks in
`database/eod_data.rs`, CSV index mapping and Date Range diagnostics in
`bhavcopy`, and the two ChartEngine summary styles. New backend and renderer
regressions cover the November 2015 boundary, both storage modes, exact opt-out,
unchanged fixture files, persisted history, overlap conflicts and exchange isolation.

## Validation and acceptance

- PASS: shared-Cargo Preview and Run for `index_alias`: 11 tests; initial harness
  compile/link 1m04s, tests 0.06s. Three warnings in untouched `holiday_sync.rs`.
- PASS: shared-Cargo Preview and Run for `database::eod_data::`: 24 passed,
  1 existing ignored disposable-copy acceptance test. Recompile/link 31.56s;
  tests 0.06s. Covers the existing equity/corporate-action and BSE settlement
  regressions as well as the new index cases.
- PASS: shared-Cargo Preview and Run for `nse_index`: 3 tests, 0.01s;
  unchanged daily Full Index List planning and history normalization/chunking.
- PASS: `node node_modules/vitest/vitest.mjs run --dir src/engine/__tests__
  IndexAliasPriceSummary.test.ts ChartLayerPartition.test.ts`: 6 tests.
  The initial command without `--dir` failed on two old `tmp` test copies whose
  imports are absent; the corrected command tests the active tree only.
- PASS: `scripts/validate-change.ps1 -Profile renderer` with the two renderer
  paths: renderer typecheck and scoped whitespace check.
- PASS: `rustfmt --edition 2021 --config skip_children=true --check` on the
  three new Rust files; `git diff --check` on the changed tracked scope.
  Existing Rust files were not reformatted wholesale.
- PASS: read-only Python EOD1 coverage probe of the registry's existing files:
  65 files, 26 families with multiple stored names, no overlapping conflicts;
  before/after SHA-256 values unchanged for all 65 inspected files. NIFTY has
  3,622 available combined records and 239 stored 2015 dates; BANKNIFTY has
  3,580 combined records and 238 stored 2015 dates. These are available-record
  counts, not claims of complete exchange-calendar coverage or native acceptance.
- NOT TESTED: rebuilt native/portable UI acceptance. The user must rebuild and
  restart the portable app, reopen NSE_INDEX:NIFTY and inspect the November 6/9,
  2015 transition. Repeat for BANKNIFTY. No re-download is needed to expose bars
  that already exist under these aliases. Confirm any older actual gaps separately.

## Rebuilt native screenshots and visible-header correction

The user rebuilt and opened the app without downloading. The four supplied
screenshots show the previously stored SPCNXNIFTY bars beginning February 21,
2012 within the NIFTY chart. This supports the alias-read behavior; the remaining
2000-to-2005-to-2012 gaps are existing coverage gaps, not a completed backfill.
The running process was read from the expected portable path
`release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe`; generated build
metadata identifies build `20261029.111636`.

The screenshots also exposed a missed rendering path: the visible React header
is built by `ChartPriceLegendOverlay.tsx`, independently of the two canvas
summaries. Its old `prevClose ?? open` fallback showed +45.25 (+0.81%) on
February 21, 2012, and +35.00 (+1.68%) on January 3, 2005. Those values are
close minus open, not a verified previous-session comparison. The initial
canvas-only renderer tests did not cover this actual displayed header.

The overlay now applies the same NSE_INDEX reference guard, showing
`Change unavailable` in a neutral color for absent/invalid previous close.
Valid index comparisons, all OHLC values, and the existing equity fallback are
preserved. No backend, raw data, database, source-fetch or approval change is
part of this follow-up. It needs a new user portable rebuild/restart.

Backup: `backups/pre_opencode_changes_20261029_115409_nse_index_visible_legend_guard`.
PASS: focused `ChartPriceLegendIndexGap.test.ts`, restricted to active component
tests: 9/9. Cases cover both screenshot gaps, hover and last-visible selection,
January 2005 and November 2015 valid references, invalid references, and equity
fallback. PASS: `scripts/validate-change.ps1 -Profile renderer` for the overlay
and new component-test paths (typecheck and scoped whitespace). No Rust tests
were rerun for this UI-only correction. Native acceptance of the corrected React
header remains pending.
