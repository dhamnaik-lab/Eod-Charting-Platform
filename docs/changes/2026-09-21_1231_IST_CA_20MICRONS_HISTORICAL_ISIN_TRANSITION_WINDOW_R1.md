# CA 20MICRONS Historical-ISIN Transition-Window R1

**IST timestamp:** 2026-09-21T12:31:50.944640+05:30  
**Objective:** Add the approved strictly pre-transition same-symbol DIVIDEND Quick Resolve proof without reopening AUTO-ID1.

## Previous limitation

Quick Resolve accepted exact event-date historical ISIN evidence and verified persisted AUTO-ID1 event identity. It deliberately did not treat `instrument_isin_history.effective_date` as an interval start. Consequently, the characterized pre-2013 `20MICRONS` dividend rows remained unresolved even though the approved 2013-01-28 split proves the historical-to-current ISIN transition.

## Files changed

- Modified `src-tauri-shell\src\database\corporate_action_imports.rs`.
- Created `src-tauri-shell\src\database\corporate_action_imports\historical_isin_transition.rs`.
- Created approved Design R1 and implementation-plan documentation.

## Final implementation

The new proof is evaluated only after the existing exact-event-date proof and AUTO-ID1 persisted-event proof. It requires NSE, `UNRESOLVED`, unapproved, parsed `DIVIDEND`, exactly one active same-symbol current target, differing historical/current ISIN, a linked approved same-symbol SPLIT carrying the current ISIN, strict `event_date < transition_date`, exact transition-date historical ISIN evidence without conflict, `HISTORICAL_ISIN_BOOTSTRAP_V1_9_2` tuple evidence, and `VERIFIED_QUICK_RESOLUTION` evidence. Ambiguous verified transitions fail closed.

Successful resolution reuses `apply_import_row_resolution()`, preserves the raw official ISIN, moves the import only to `PENDING`, and records `VERIFIED_HISTORICAL_ISIN_TRANSITION`. No Corporate Action is approved.

## Behaviour preserved

- AUTO-ID1 remains closed/current and its six focused regressions remain green.
- Exact-event-date Quick Resolve remains first authority at the transition date.
- `PENDING_ISIN_MISMATCH` remains excluded.
- Post-transition stale historical ISIN remains blocked.
- `OTHER`, `SPLIT`, `BONUS`, `RIGHTS`, symbol-change and BSE rows are not eligible for this new proof.
- No schema, migration, frontend, Tauri public API or dependency change.
- No user/application database access in implementation validation.

## Validation commands/results

- Focused behavioral RED: `test result: FAILED. 6 passed; 4 failed; 0 ignored; 0 measured; 628 filtered out; finished in 1.28s` with the four intended transition tests failing and exact-date preservation passing.
- Focused GREEN: `test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 628 filtered out; finished in 0.05s`.
- AUTO-ID1 regression: `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 632 filtered out; finished in 0.35s`.
- Quick Resolve regression: `test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 633 filtered out; finished in 1.17s`.
- Recheck regression: `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 632 filtered out; finished in 0.07s`.
- V1.9.2 historical-ISIN bootstrap regression: `test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 625 filtered out; finished in 1.01s`.
- Full `corporate_action_imports::tests::`: `test result: ok. 122 passed; 0 failed; 0 ignored; 0 measured; 516 filtered out; finished in 1.34s`.
- `cargo check --locked --offline`: PASS.
- Post-install focused transition suite: `test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 628 filtered out; finished in 0.04s`.

## Actual source hashes

- `corporate_action_imports.rs`: `9968D91EE99ECCF92B853E349734BF24BFA295477C2A28C89D67CAEF7181BE44`
- `historical_isin_transition.rs`: `D45AD89AEAB209D304A929F0112561CA0B82EAAF43CA30232BB5B04A698EC05D`

Protected-source authority transitions from **553 -> 554** because one Rust source module is added. The accepted `src + src-tauri-shell` inventory transitions **559 -> 560** with exactly one modified path and one added path.

## Backup / rollback

Pre-change backup: `E:\TA Projects\EOD Charting Platform\tmp\CA_20MICRONS_TRANSITION_R1_2026-09-21_122602_IST_PRECHANGE_BACKUP.zip`  
Backup SHA-256: `5891C6847075CCBCBE556462EEE2C411F4250FF07716DFABB05EC40A8D464CC2`

Rollback: restore the pre-change `corporate_action_imports.rs`, remove the newly created `historical_isin_transition.rs`, and remove this task's Design/Plan/change documentation. No database rollback is required because implementation validation performs no user/application database mutation.

## Risks / limitations

The source implementation is validated only with isolated/in-memory fixtures. Real `20MICRONS` TEST-DB behavior remains a separate stable-copy rollback acceptance gate. Expected real candidates are imports `41528`, `13307`, and `14958`; no claim is made here that those rows were mutated or tested against a user database.
