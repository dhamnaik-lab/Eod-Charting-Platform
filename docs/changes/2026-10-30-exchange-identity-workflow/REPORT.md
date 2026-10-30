# Shared NSE/BSE Identity Import workflow

Status: implemented; rebuilt desktop acceptance pending.

## Scope

The user approved correcting the NSE-only workflow so both supported exchange
choices share review, explicit confirmation, progress and saved-report behaviour.
This changes Identity Import, not financial-action approval or market downloads.
Exchange still selects the official source, identity namespace and matching rules.
It does not make an NSE symbol interchangeable with a BSE security code.

## Resulting behaviour

- Both Current universe Apply actions require an actionable preview bound to its
  reviewed fingerprint, database, source mode and source path. Cancel preserves
  review authority; confirmed Apply consumes it. Filters never limit the plan.
- Both actions use one renderer execution path for counted progress, committed
  results, cache/chart refresh, and separate post-commit refresh warnings. A known
  commit followed by a lost reply remains saved and directs the user to reports.
- Backend checks reject a changed destination database. BSE hashes the exact
  bytes it parsed plus its planned effects and relevant database snapshot. It
  rebuilds and checks the plan inside BEGIN IMMEDIATE. NSE now repeats its
  fingerprint check inside its write transaction too. Both reject zero changes.
- Both exchanges expose Recent Applied. Current universe receipts use the same
  report component, retaining BSE official IDs and security codes in Details.
  Current receipts show IST, UTC tooltips and run/source evidence. NSE historical
  receipts and legacy rows remain available in that tab as before.
- BSE receipts are saved in `bse_identity_apply_runs`, in the same transaction as
  instrument writes. Failure to save a receipt or commit rolls everything back.
  100 percent is emitted only after commit. History reads do not create tables or
  fabricate receipts for older runs; they return the latest 50 saved receipts.
- Switching exchange/source no longer clears the outgoing exchange's saved
  search preference. Existing per-database/exchange/source display keys remain.
- BSE Historical identity now has a clear unsupported-coverage explanation and
  no Historical Apply action. A verified dated BSE source and identity adapter
  remain necessary before implementing historical ingestion. This phase does
  not claim NSE/BSE historical-source parity or add speculative categories.

BSE matching, official lifecycle population safeguards, official security IDs,
security codes and existing missing-symbol lifecycle policy are preserved.
Counting now agrees with writes: already-saved inactive rows are not repeatedly
counted; absent optional CSV fields preserve stored values through COALESCE
without creating false metadata updates. Unchanged BSE rows are not rewritten.
`SUSPENDED` results are correctly labelled Applied in shared result tables.

## Files and backup

Main changes: `src/components/DatabaseToolsDialogs.tsx`, shared identity status,
history/model/table/styles under `src/features/corporateActions/identity/`, desktop
types and the platform bridge. Backend changes are in `database.rs`, `main.rs`,
`bse_identity_imports.rs`, its new `apply_reporting.rs` module and tests, and the
NSE Current universe Apply endpoint/reporting module.

Primary scoped pre-edit backup:
`backups/pre_opencode_changes_20261030_000122_exchange_identity_workflow`.
Additional scoped snapshots cover subsequent NSE endpoint/contract work:
`pre_opencode_changes_20261030_000929_nse_atomic_recheck_contract`,
`pre_opencode_changes_20261030_001151_exchange_ui_contracts`, and
`pre_opencode_changes_20261030_001837_nse_database_binding`, under `backups/`.
Pre-existing dirty worktree changes were retained; no commit or push occurred.

## Validation

- PASS: focused BSE receipt/transaction tests, 4 tests including successful
  commit, unchanged repeat, missing authority, source-byte/database drift,
  cross-exchange isolation, receipt failure, deferred COMMIT failure and read-only
  history. Synthetic CSV proof fixtures are retained under
  `tmp/bse-reviewed-proof-*`; database mutations are in-memory test fixtures.
- PASS: BSE identity module, 19 tests; NSE identity module, 122 tests with 2
  explicit fixture tests ignored. Focused NSE reporting tests passed, including
  the locked recheck and zero-change write guards.
- PASS: focused renderer/bridge tests, 102 tests in 18 files. Existing source
  contracts were updated for the shared execution path and stronger BSE gate.
- PASS after the final shared destination-path guard: 9 combined NSE/BSE
  reporting tests. Final harness compilation/linking took 1 minute 3 seconds;
  the tests themselves took 1.61 seconds. The final UI run again passed 102 tests.
- PASS: scoped renderer typecheck/whitespace and focused Rust format checks for
  the changed BSE modules and NSE reporting module. Unrelated modules were not
  reformatted and the full workspace suite was not run.
- The first Rust compile found a missing hash-finalization call and use of a
  rusqlite method unavailable in this version. Both were corrected; tests use
  SQL total_changes() and final successful compilation is recorded above.
- Existing compiler warnings in holiday_sync and the previously unused NSE
  master-upsert helpers were retained rather than changing unrelated code.
- NOT TESTED: rebuilt desktop interactions, official BSE network refresh, live
  coloured progress, real persisted BSE receipts, and restart acceptance.

No live database Apply/reversal, financial approval, official download, raw price
write, portable/release build or background server was performed by this phase.

## Desktop acceptance

After the user's normal portable rebuild:

1. Select BSE. Confirm the same Current universe, Historical identity, Recent
   Applied and Source diagnostics tabs appear. Historical explains its coverage
   limit and provides no Apply action.
2. Preview a chosen BSE source and inspect symbols, codes, counts and Details.
   Apply remains disabled before preview, after context changes, after a saved
   result, or when the preview has no actionable changes.
3. For a future legitimate actionable plan, inspect the full-plan confirmation.
   Cancel must keep the preview usable and must not write anything. Only confirm
   a change the user actually intends to apply; do not create a test live Apply.
4. On that legitimate Apply, verify counted coloured progress, green completion
   only after save, and its persisted Current universe receipt in Recent Applied.
5. Switch NSE/BSE and source modes, then restart. Confirm each display context
   retains its search preferences; stored reports never enable a new Apply.

NSE historical category coverage and BSE historical ingestion remain distinct
source-evidence concerns, not renderer filters that can safely invent mappings.
