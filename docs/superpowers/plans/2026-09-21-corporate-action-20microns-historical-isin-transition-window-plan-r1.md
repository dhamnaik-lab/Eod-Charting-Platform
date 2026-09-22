# Corporate Action — 20MICRONS Historical-ISIN Transition-Window Implementation Plan R1

**Date:** 2026-09-21 IST  
**Design authority:** `2026-09-21-corporate-action-20microns-historical-isin-transition-window-design-r1.md`

## Bounded source delta

Create:

`src-tauri-shell\src\database\corporate_action_imports\historical_isin_transition.rs`

Modify:

`src-tauri-shell\src\database\corporate_action_imports.rs`

No frontend, schema, migration, dependency, Tauri public API, or database bootstrap change is authorized.

## TDD

### RED

Inject only the new transition-window tests into the accepted parent `corporate_action_imports.rs`. Production behavior remains parent behavior. Require intended failing tests while the exact-transition-date preservation test remains GREEN. Reject compile/Tauri sandbox contamination.

### Minimal GREEN

Install the new read-only transition-evidence module in the sandbox and wire it as the third Quick Resolve proof. Require all transition-window tests to pass.

## Required validation

- focused `historical_isin_transition_` GREEN;
- existing `auto_id1_` suite;
- existing `quick_resolve_` suite;
- existing `recheck_` suite;
- `phase1_v192_` historical-ISIN bootstrap suite;
- full `corporate_action_imports::tests::` suite;
- `cargo check --locked --offline`;
- post-install focused transition-window suite.

Cargo must be offline and its target must remain under project `tmp`. No application/user database is opened. Test-owned in-memory SQLite fixtures are permitted.

## Install gate

Real source remains byte-identical until all isolated RED/GREEN/regression/Cargo gates pass. Then create a bounded backup, install exactly the two intended source changes, verify the exact expected source inventory, create the required `docs\changes` record, run the post-install focused suite, and package evidence under project `tmp`.

## Later runtime gate

Real TEST-DB characterization is a separate authorization. It must use a writer-excluded stable copy and a rollback transaction. No live TEST DB access is part of this implementation step.
