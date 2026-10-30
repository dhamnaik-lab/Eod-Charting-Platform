# NSE Current universe apply status and history

Implemented 29 October 2026 in `E:\TA Projects\EOD Charting Platform`.

## Behavior

- Checks show indeterminate progress. Instrument writes report processed / total
  records and a blue percentage capped at 99 until commit. These are record-work
  counters, including unchanged master records, not an estimate of elapsed time.
- A committed result shows green 100%, change counts and a saved timestamp.
  View refresh runs separately. A refresh failure preserves the committed result
  and asks for refresh retry instead of reporting a failed apply.
- The footer changes from Preview loaded to Completed. The result table uses
  Outcome / Before / After, with Applied, Held for review and Outside coverage
  filters. Applied details retain the original review reason as historical evidence.
- Source diagnostics contains **Saved identity apply history**. Load / Refresh
  reads up to the latest 50 receipts from the selected database. A receipt's rows
  never become new preview authority and the reader has no Apply control.
- `identity_apply_runs` is created on the first successful apply in the same
  transaction as the instrument changes. Failed receipt writes or failed commits
  roll back changes and cannot publish 100%. History uses the existing verified
  read-only connection and does not create a table when opened on an older DB.
- The sticky preview header uses the actual theme background variable, preventing
  underlying scrolled rows from showing through.

Scope: NSE Current universe apply. Historical identity and BSE have no new progress
or receipt mechanism in this phase. Their existing gates and behavior are preserved.
Raw prices, financial CA approvals, source fetching and lifecycle policy are unchanged.

## Counts and earlier applies

The screenshot's completed run represents **291** changes: 7 new + 23 reactivated +
261 metadata updates. The displayed Activate 30 already includes the 7 new records;
the earlier conversational total of 298 double-counted them.

Applies made before this update have no atomic receipt and are not backfilled or
represented as historical proof. The previously completed run must not be repeated
merely to create a receipt. Future deliberate applies generate receipts, including
runs with zero material changes.

## Backups

- `backups/pre_opencode_changes_20261029_033454_identity_apply_reporting`
- `backups/pre_opencode_changes_20261029_034100_identity_reporting_contract_test`

All changes are patches on the existing dirty worktree. No commit, push, live
database apply, download, portable build or release build was performed.

## Validation

- PASS: focused reporting Rust tests initially 3/3; later added commit-failure case
  and verified the complete NSE Identity module: **105 passed, 1 existing ignored**.
  Command: `scripts/Invoke-EOD-SharedCargo.ps1 -Mode Preview` then `-Mode Run`
  with `-CargoAction test -CargoArguments @('database::nse_identity_imports::','--','--nocapture')`.
  Final compile/link 49.42 seconds; tests 0.58 seconds. Shared root target used.
- PASS: Identity UI/bridge tests, 86/86 across 16 files, including operation event
  isolation, listener cleanup, correct totals, outcomes and saved-history controls.
- PASS: renderer validation profile (typecheck and scoped whitespace check), final
  UI/bridge run 86/86, and isolated Rust reporting-module formatting.
- PASS: documentation validation profile (live references and scoped whitespace).
- Existing unrelated unused imports/mut warning in `bhavcopy/holiday_sync.rs`
  remain unchanged.
- NOT TESTED: native visual acceptance in the user-rebuilt portable application.

## Native acceptance after the user's portable rebuild

1. Scroll an Identity preview: the header stays opaque and readable.
2. On a separately reviewed and deliberately confirmed future NSE Current universe
   apply, observe checking, counted writes, committing, then green Completed 100%.
3. Confirm the footer says Completed; Applied shows only changed rows, Held and
   Outside coverage show unchanged instruments. A fresh preview is required to Apply again.
4. Open Source diagnostics -> Saved identity apply history -> Load / Refresh Apply
   History. Reopen the application and load the same receipt; it remains read-only.
5. A view-refresh warning after commit must say changes were saved. Rollback and
   commit failures were tested in isolated SQLite fixtures; do not inject failures
   into the live database for visual acceptance.
