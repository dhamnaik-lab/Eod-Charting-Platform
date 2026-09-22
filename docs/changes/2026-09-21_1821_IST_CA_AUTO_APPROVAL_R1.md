# Corporate Action Auto-Approval R1

**IST timestamp:** 2026-09-21T18:21:11.090994+05:30  
**Objective:** implement backend-owned NSE Split/Bonus Auto-Approval Safe V1 from the accepted Design R1 and Implementation Plan R1.

## Previous limitation

Corporate Action preparation could auto-resolve and validate routine rows, but final approval still required explicit Apply. R1 adds a stricter backend-owned autonomous approval subset without changing manual approval authority.

## Files changed

- `src\components\DatabaseToolsDialogs.tsx`
- `src\features\corporateActions\__tests__\corporateActionOfficialImportsFix2.test.ts`
- `src\features\corporateActions\__tests__\corporateActionOfficialImportsFix2Wiring.test.ts`
- `src\features\corporateActions\__tests__\corporateActionPendingPreparation.test.ts`
- `src\features\corporateActions\legacy\corporateActionImportOperations.ts`
- `src\platform\tauriDesktop.ts`
- `src\platform\types.ts`
- `src\types\desktop.ts`
- `src-tauri-shell\src\database\corporate_action_imports\auto_approval.rs`
- `src-tauri-shell\src\database\corporate_action_imports.rs`
- `src-tauri-shell\src\database.rs`
- `src-tauri-shell\src\main.rs`

## Final implementation

- NSE `SPLIT`/`BONUS` only.
- review status must be ordinary `PENDING`; parse status `PARSED`.
- backend independently verifies machine identity and latest current `MATCHED` price validation.
- confidence threshold is `>= 0.95`.
- same-date compound Split/Bonus, BSE, Dividend, Rights, manual resolution, ISIN exception and price exception are excluded.
- caller IDs are preparation scope only; backend owns eligibility.
- existing `approve_corporate_action_import_without_transaction` remains the canonical writer.
- every successful autonomous approval records `AUTO_APPROVAL_SAFE_V1`.
- existing manual Apply controls are preserved.
- raw EOD prices remain unchanged; adjustment-on-read remains the existing owner.

## Validation commands/results

- behavioral RED: `test result: FAILED. 1 passed; 10 failed; 0 ignored; 0 measured; 638 filtered out; finished in 0.95s`.
- focused Auto-Approval GREEN: `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 638 filtered out; finished in 0.04s`.
- AUTO-ID1: `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 643 filtered out; finished in 0.35s`.
- 20MICRONS historical transition: `test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 639 filtered out; finished in 0.04s`.
- Quick Resolve: `test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 644 filtered out; finished in 0.92s`.
- Recheck: `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 643 filtered out; finished in 0.07s`.
- price-validation regressions: `test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 647 filtered out; finished in 0.01s`.
- CA UX exact-read regressions: `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 643 filtered out; finished in 0.01s`.
- full `corporate_action_imports::tests::`: `test result: ok. 122 passed; 0 failed; 0 ignored; 0 measured; 527 filtered out; finished in 1.49s`.
- focused frontend Vitest: PASS.
- TypeScript typecheck: PASS.
- frontend build: PASS.
- `cargo check --locked --offline`: PASS.
- stable-copy TEST-DB rollback characterization: PASS; candidates=9, eligible=2, formalRealEligibleAcceptanceAvailable=True.
- post-install focused Rust: `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 638 filtered out; finished in 0.04s`.
- post-install focused frontend: PASS.

## Behaviour preserved

AUTO-ID1 and the 20MICRONS transition-window remain closed/current. `PENDING_ISIN_MISMATCH`, manual approval, exception approval, Dividend/Rights/BSE/compound behavior, source provenance and chart/raw-price behavior are preserved. No schema migration was introduced.

## Risks / limitations

R1 intentionally excludes all action classes and exception paths outside the frozen policy. If the TEST DB contains no currently eligible strong-match Split/Bonus row, the stable-copy characterization proves zero unsafe approvals but formal real-eligible autonomous-write acceptance remains pending for the later controlled TEST-DB checkpoint.

## Backup / rollback

Pre-change backup: `E:\TA Projects\EOD Charting Platform\tmp\CA_AUTO_APPROVAL_R1_2026-09-21_181227_IST_PRECHANGE_BACKUP.zip`  
Backup SHA-256: `1E229571D29DB84C37A91428FF4963F8321BCD9E02CE3D622BFF4CE48F5CDCFC`

Rollback restores the preimages of the source files listed above and removes the newly added private auto-approval module. Database rollback is not required for this automated implementation cycle because all TEST-DB approval writes occurred only on the stable copy and were rolled back.
