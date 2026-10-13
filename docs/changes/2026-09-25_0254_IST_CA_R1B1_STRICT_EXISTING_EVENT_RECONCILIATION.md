# CA R1-B1 — Strict Existing-Event Identity Reconciliation

**IST timestamp:** 2026-09-25T02:54:31.166213+05:30
**Workstream:** EOD Charting Platform
**Authorized root:** `E:\TA Projects\EOD Charting Platform`

## Objective

Implement the first bounded R1-B repair class: strictly reconcile an unresolved parsed NSE Split/Bonus import to an already-existing canonical Corporate Action when identity lineage, canonical semantics and current price validation are all machine-proven.

## Previous defect / limitation

The accepted R1-A preflight identified imports 819, 19896 and 22888 as existing-event reconciliation candidates. Each has one active current target and one same-symbol/date canonical action, while the raw import ISIN belongs to a retained inactive predecessor. The existing approval path rejected the imports at `UNRESOLVED`; there was no strict dedicated reconciliation owner.

## Files changed

- `src-tauri-shell/src/database/corporate_action_imports.rs`
- this change record

No frontend file, schema, data file or Safe V1 policy file is changed.

## Final implementation

`reconcile_existing_corporate_action_import_internal()` requires all of the following before linking:

1. unresolved + PARSED + NSE + Split/Bonus scope;
2. exactly one active current identity target matching the import symbol/exchange;
3. exactly one inactive instrument carrying the raw imported ISIN;
4. exactly one direct predecessor -> current `instrument_identity_history` edge whose retained current ISIN matches the active target and whose transition date is on/before the CA ex-date;
5. exactly one existing canonical action for current symbol + effective date;
6. exact canonical current ISIN, action type, record date, factor, ratio/face/cash terms, volume-adjustment flag and trimmed purpose/note semantics;
7. current existing MATCHED Split/Bonus price validation;
8. no orphaned prior `VERIFIED_EXISTING_EVENT_RECONCILIATION` decision.

The function then reuses `mark_import_approved()` and `record_corporate_action_import_decision()` inside a savepoint. Decision type: `VERIFIED_EXISTING_EVENT_RECONCILIATION`. No new canonical Corporate Action is created. The raw imported ISIN is retained.

## Behaviour preserved

- `AUTO_APPROVAL_SAFE_V1` and its 0.95 threshold unchanged.
- AUTO-ID1 unchanged.
- 20MICRONS historical-ISIN transition behavior unchanged.
- ordinary exact-event-date Quick Resolve unchanged.
- `PENDING_ISIN_MISMATCH` remains excluded.
- raw EOD prices and adjustment-on-read behavior unchanged.
- frontend owners and DB schema unchanged.
- legacy external `Corporate Actions Raw` path is not accessed by R1-B1; active cleanup is deferred to a separate bounded task and historical provenance is not rewritten.

## Validation commands / actual results

- accepted TDD RED evidence: `651C473AA0C7CBCE197DB3DB449F8151EE1822A9E939C899287D6482E47D7580` — clean E0425 missing-function RED.
- focused `r1b1_`: 10/10 PASS in isolated tested candidate.
- Quick Resolve regression: 5 PASS / 0 failed.
- recheck regression: 6 PASS / 0 failed.
- AUTO-ID1 regression: 6 PASS / 0 failed.
- historical-ISIN transition regression: 10 PASS / 0 failed.
- Auto-Approval regression: 11 PASS / 0 failed.
- R1-A reconciliation-preflight regression: 39 PASS / 0 failed.
- full Rust suite: 697 passed / 1 exact documented inherited V1.14Y RED / 3 ignored.
- `cargo check --locked --offline --jobs 1`: PASS in isolated tested candidate.
- post-install focused `r1b1_`: 10/10 PASS.
- post-install `cargo check --locked --offline --jobs 1`: PASS.
- source candidate/install equality: PASS.
- change-record trailing-whitespace check + `scripts\check-doc-references.ps1`: PASS (no Git invoked).

No user/live database test is part of R1-B1 source/TDD. R1-C remains NOT STARTED.

## Hashes / evidence

- preimage `src-tauri-shell/src/database/corporate_action_imports.rs`: `752DCAA4AEE446D2D59A4E2AA94664604F22855F3C1435C8F396108D9DC0F018`
- installed `src-tauri-shell/src/database/corporate_action_imports.rs`: `34406DF99D6C8681081A010E4BD4F332202DF4C45F5909601D042DA5449BBFB0`
- pre-change backup: `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260925_022824_CA_R1B1_STRICT_EXISTING_EVENT`

## Risks / limitations

- R1-B1 installs a strict internal reconciliation owner and its regression tests; controlled real TEST-DB application remains R1-C work.
- The legacy manual identity-import path cleanup is deliberately separate.
- The accepted full-suite inherited V1.14Y RED remains unresolved and unchanged.

## Rollback guidance

Restore `src-tauri-shell/src/database/corporate_action_imports.rs` from the pre-change backup above and remove this change record only if rolling back R1-B1. Do not modify CA database rows as part of source rollback.
