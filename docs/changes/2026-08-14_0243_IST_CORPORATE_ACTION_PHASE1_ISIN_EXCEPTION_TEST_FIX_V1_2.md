# Corporate Action Phase 1 — ISIN Exception Test Fixture Fix V1.2

**IST timestamp:** 2026-08-14 02:43 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`

## Objective

Correct one pre-existing Corporate Action Rust test fixture so it supplies current Split/Bonus price-validation evidence for the action date it is testing, without weakening any Phase 1 production approval rule.

## Previous defect / limitation

After Phase 1 V1.1, `cargo test ... corporate_action_imports` compiled successfully and ran 90 tests. 89 passed and one failed:

`database::corporate_action_imports::tests::phase2b_decision_audit_records_individual_isin_exception`

The test action uses ex-date `2026-06-04`, but the shared Phase 1 scan-result test helper inserts hard-coded scan dates `2026-08-13` / `2026-08-14`. Phase 1 correctly treats that evidence as stale because the previous-trade date is after the action ex-date. The test already intended to provide a `MATCHED` price validation before exercising the separate ISIN-exception approval path.

## Files changed

- `src-tauri-shell\src\database\corporate_action_imports.rs`
- `docs\changes\2026-08-14_0243_IST_CORPORATE_ACTION_PHASE1_ISIN_EXCEPTION_TEST_FIX_V1_2.md`

## Final implementation

Production code is unchanged.

Only the failing test fixture is corrected. Immediately after its existing `MATCHED` scan insertion, the test updates that scan row to:

- previous trade date: `2026-06-03`
- ex trade date: `2026-06-04`

This aligns the validation evidence with the test action's `2026-06-04` ex-date and lets the test reach the behavior it was originally designed to verify: audited individual ISIN-mismatch approval.

## Behavior deliberately preserved

- Split/Bonus ordinary approval still requires current `MATCHED` validation.
- Stale validation is still rejected.
- Price-validation exceptions still cannot bypass an ISIN mismatch.
- ISIN-mismatch exceptional approval still requires a written audited reason.
- No UI, database schema, scan calculation, adjustment math, or production approval behavior is changed.

## Validation commands

Run on the project machine:

```powershell
npx vitest run 'src/features/corporateActions/__tests__/corporateActionValidation.test.ts'
cargo test --manifest-path 'src-tauri-shell/Cargo.toml' corporate_action_imports -- --nocapture
cargo test --manifest-path 'src-tauri-shell/Cargo.toml' eod_data -- --nocapture
npm run typecheck:renderer
npm run build:renderer
npm run tauri:check
```

## Actual validation results before V1.2

From the user's V1.1 run:

- focused Corporate Action Vitest: PASS, 10/10 tests
- Rust compile: PASS
- Corporate Action Rust tests: 89 PASS / 1 FAIL
- failing test: `phase2b_decision_audit_records_individual_isin_exception`
- failure reason: expected `MATCHED` evidence was rejected as stale due to fixture dates
- later validation gates were not reached because the apply script stopped on the Rust test failure

V1.2 has not been executed on the project machine yet. No PASS is claimed for the post-V1.2 Rust test suite until actual command output confirms it.

## Risks / limitations

Very low risk. This change affects test data only. The main risk is that another latent test failure may become visible after this test passes; the validation sequence must therefore continue through all remaining gates.

## Rollback guidance

Restore `src-tauri-shell\src\database\corporate_action_imports.rs` from the V1.2 apply-script backup under `tmp\corporate-action-phase1-v1-2-backup_<timestamp>` and remove this V1.2 change report if rollback is required.
