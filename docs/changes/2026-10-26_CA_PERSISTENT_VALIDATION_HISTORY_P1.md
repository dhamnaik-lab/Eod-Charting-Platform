# Corporate Actions persistent validation history — bounded P1

Date: 26 October 2026 IST.

## Result

Implemented the approved P0 ownership/schema mapping and a bounded additive P1
slice for Dividend validation history. One renderer Load & Validate lifecycle can
span several existing `scan_runs` plus many read-only Dividend batches, so the
existing scanner tables were not repurposed as the lifecycle owner.

The new diagnostic transaction owner atomically saves an immutable activity
header and import-level disposition/reason/evidence snapshots. It validates the
active database path, full requested ID scope, checked subset, aggregate counts,
policy/scope identity and UTC RFC3339 timestamps before commit. Duplicate/out-of-
scope IDs and local-offset timestamps fail closed. A stable database instance ID
is generated once inside the SQLite database and survives database copies/restores.

Reports → Dividend verification reasons and Activity and validation details can
now page the latest saved snapshot after reopening the app. These reads use the
read-only connection and invoke no Fetch, scan, identity repair or financial
writer. Stored `ELIGIBLE` is explicitly historical evidence and is never used to
recreate current Ready, a renderer generation or a write-stage scope. A history
write failure leaves the current read-only result visible and does not misstate or
retry financial work.

## Schema and protected behavior

Added `corporate_action_history_metadata`, `corporate_action_activity_runs` and
`corporate_action_validation_report_items` plus paging indexes. Migration is
idempotent and additive; existing timestamps/data are not rewritten. New times
are canonical UTC and UI display remains explicit Asia/Kolkata IST.

The evaluator remains read-only. Approval transaction ownership, exact backend
rechecks, Fetch → Load & Validate → explicit Approve Ready, targeted post-approval
refresh, quick search/Details, raw `.eod` immutability and source/identity/manual-
adjustment contracts are unchanged.

## Validation

- PASS: `cargo test corporate_action_history::tests --manifest-path src-tauri-shell/Cargo.toml -- --nocapture` — 4 passed, 0 failed, 987 filtered; disposable in-memory SQLite only.
- PASS: five focused Vitest files — 55 tests passed, including history mapping, Dividend batching, approval reports, targeted refresh and explicit approval preservation; `tmp/**` excluded.
- PASS: `npm run typecheck:renderer`.
- PASS: `rustfmt --check` for the new Rust owner and scoped `git diff --check`.
- NOT RUN: desktop build/package, live database migration, live scan, Fetch, financial approval or raw-price mutation.

Pre-edit backup: `backups/pre_opencode_changes_20261025_235346_ca_persistent_history_p1`.

## Remaining boundaries

Update, 26 October: user native evidence accepts saved-history persistence/reopen
(9,023 saved results; restart with Loaded 0; Reports paged 400/9,023 without scan).
The subsequent [bounded Dividend incremental slice](2026-10-26_CA_DIVIDEND_INCREMENTAL_VALIDATION.md)
adds backend checkpoints/current pointers; its native acceptance remains pending.
The original implementation boundary below is retained as historical context.

This is not all of P1. Fetch attempts, non-Dividend preparation activity,
cancelled runs with no evaluator outcome and current-result pointers remain to be
added. P2 general CSV/TXT/JSON exports and P3 dependency-aware incremental reuse
are not implemented. The existing reconciliation CSV/TXT path remains a separate
500-ID diagnostic tool. Rebuild/native persistence and restart observation belong
to the user-run acceptance phase.
