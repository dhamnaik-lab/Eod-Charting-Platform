# CA R1-B2 Inactive-Historical Existing-Event Reconciliation

IST timestamp: 2026-09-25T15:23:11.240962+05:30

## Objective
Extend the accepted R1-B1 existing-event reconciliation only for historical cases where there is no active identity target today, but exactly one inactive current-symbol target, exactly one inactive predecessor carrying the raw import ISIN, a direct predecessor-to-current-symbol identity edge on/before the Corporate Action ex-date, one exact canonical event, and current MATCHED Split/Bonus price validation.

## Previous defect / limitation
R1-B1 intentionally required exactly one active current identity target. The accepted R1-B2 RED proved five focused tests fail on that exact guard when the historical current-symbol instrument is inactive today. This blocked the retained BSLIMITED and DHFL existing-action cases even though their canonical actions already exist and the required direct predecessor lineage is present.

## Files changed
- `src-tauri-shell/src/database/corporate_action_imports.rs`

No frontend, schema, database, configuration, Safe V1 or price-adjustment source file changed.

## Final implementation
R1-B1 behavior is preserved when exactly one active target exists. Only when active-target count is zero, R1-B2 may select exactly one inactive identity-chain candidate whose symbol and exchange exactly match the stored import. The existing predecessor-ISIN, direct-edge, transition-date, canonical semantic, price-validation, idempotency, savepoint and audit-decision gates then execute unchanged. Ambiguous inactive current-symbol targets fail closed. The existing `VERIFIED_EXISTING_EVENT_RECONCILIATION` audit decision type remains authoritative; R1-B2 records a distinct reason string for inactive-historical proof. No new canonical corporate action is created by this path.

## Behavior preserved
- R1-B1 active-current-target behavior and ten tests.
- `AUTO_APPROVAL_SAFE_V1` and the 0.95 threshold.
- `PENDING_ISIN_MISMATCH` boundary.
- Ordinary Quick Resolve and AUTO-ID1.
- 20MICRONS behavior.
- Raw imported identity and raw-price adjustment-on-read.
- Frontend owners and database schema.
- SIGNET / COMPINFO / SONAMLTD / PCBL remain deferred.

## Validation commands / actual results
- Accepted R1-B2 RED evidence SHA-256: `2CD6DD6C9F3F2DDB74CCF237846883FB6DBFE667F581CAE3A17319273A1B813E` — 0 passed / 5 failed / 0 ignored; compile errors=0; all failures reached the accepted R1-B1 active-target boundary.
- Focused R1-B2 GREEN: 5/5 PASS.
- R1-B1 regression: 10/10 PASS.
- Quick Resolve regression: 5/5 PASS.
- AUTO-ID1 regression: 6/6 PASS.
- Auto-Approval regression: 11/11 PASS.
- R1-A reconciliation-preflight regression: 39/39 PASS (guarded copy-local test skipped here).
- Full Rust policy: 702 PASS / exact documented V1.14Y inherited RED only / 3 ignored.
- Candidate `cargo check --locked --offline --jobs 1`: PASS.
- Post-install R1-B2: 5/5 PASS.
- Post-install R1-B1: 10/10 PASS.
- Post-install `cargo check --locked --offline --jobs 1`: PASS.
- Source after install: 569 files; exactly 1 modified source path; 0 added / 0 removed.
- User/live DB access=0; Git=0; network=0; app launch=0.

## Risks / limitations
This source change proves the inactive-historical rule through in-memory TDD and regression suites only. It does not mutate the TEST database. Controlled TEST-DB application for import IDs 17846, 18044 and 20973 remains the separate R1-C2 checkpoint. Price-repair and broader historical-identity cases remain outside this bounded slice.

## Rollback guidance
Restore `src-tauri-shell/src/database/corporate_action_imports.rs` from `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260925_151454_CA_R1B2_INACTIVE_HISTORICAL`. No database rollback is required for R1-B2 because this implementation run does not access the TEST database.

## Hash evidence
Pre-change `src-tauri-shell/src/database/corporate_action_imports.rs` SHA-256: `34406DF99D6C8681081A010E4BD4F332202DF4C45F5909601D042DA5449BBFB0`
Post-change `src-tauri-shell/src/database/corporate_action_imports.rs` SHA-256: `B1A7FCDC1D1FCBE759DFB59D3A92B70418D05E48B3FE6447C8386A2A226E0D2B`
R1-B2 RED evidence SHA-256: `2CD6DD6C9F3F2DDB74CCF237846883FB6DBFE667F581CAE3A17319273A1B813E`
