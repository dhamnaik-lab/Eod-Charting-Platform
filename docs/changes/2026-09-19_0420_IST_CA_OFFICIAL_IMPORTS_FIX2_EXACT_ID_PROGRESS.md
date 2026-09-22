# CA Official Imports FIX2 RESUME1 — exact-ID recheck and visible preparation / Apply progress

IST installation timestamp: 2026-09-19 04:52:45 +05:30

## Objective and authorization

Implement the approved manual-checkpoint FIX2 in `E:\TA Projects\EOD Charting Platform`. Keep the existing CorporateActionDialog. The only new native capability is a bounded read-only import lookup; no approval bypass, schema migration, raw EOD rewrite, redesign, warning cleanup, or other workstream changes are authorized.

## Previous limitation

The manual checkpoint showed unselectable groups without an adequate summary of why, an Other checkbox that omitted stored OTHER actions, long preparation with stale progress, full pending-queue enumeration before applying only two reviewed actions, and a post-Apply list replacement with the initial 1,000-row page.

Correction to the initial diagnosis: the accepted implementation already grouped identity-hint requests into 100-ID batches. FIX2 preserves that batch limit and reports returned counts after each batch; it does not claim that batching is newly introduced or that a real-database speedup has already been measured.

## Files changed

Nine implementation replacements:
- `src/components/DatabaseToolsDialogs.tsx`
- `src/features/corporateActions/legacy/corporateActionImportOperations.ts`
- `src/features/corporateActions/corporateActionBulkApproval.ts`
- `src/types/desktop.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/corporate_action_imports.rs`
- `src-tauri-shell/src/main.rs`

One aligned existing characterization test:
- `src/features/corporateActions/__tests__/corporateActionLegacyImportOperations.characterization.test.ts` — assertion updated from the old raw selection array to the approved effective action-type filter used by FIX2. No runtime behavior is introduced by this test-only replacement.

Two added regression files:
- `src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2.test.ts`
- `src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2Wiring.test.ts`

Documentation: this dated change record and a new leading entry in `docs/CURRENT_WORK_STATUS.md`; prior status history is retained.


## RESUME1 validation-history note

The first FIX2 automated Windows run stopped before source installation at the Corporate Actions + Identity regression gate. The pinned failure evidence SHA256 is `323B91BFBB36B4D39234336D180B4802992827AC132966FE9917B7EA641CD0D7`; it reported 237 tests total, 236 passed, 1 failed. The only failing assertion was the legacy characterization expectation `actionTypes: selectedImportActionTypes`. Since FIX2 intentionally uses `effectiveImportActionTypes` for the approved Other = OTHER + DEMERGER presentation, RESUME1 aligns that characterization assertion. The FIX2 production payload is unchanged from the first candidate.

## Final implementation

1. Keep non-ready actions disabled. Symbol headers count the existing ready / identity decision / price decision / price data / check failure / not-approvable states. Individual actions retain their review reasons.
2. Expand the Official Imports Other presentation category to OTHER + DEMERGER, without changing stored action types. The native list's read-only action-type allowlist recognizes DEMERGER.
3. Report loading, returned identity batches, strict auto-resolution attempts, and returned Split/Bonus checks using counts. A separate small status component updates elapsed time without re-rendering the entire grouped table each second. No simulated percentage or invented ETA is shown. Preparation can stop between completed calls; it does not undo previously saved matching/check metadata or approve actions.
4. Add `getCorporateActionImportsByIds` / `get_corporate_action_imports_by_ids`: 1–100 unique positive JavaScript-safe integer IDs, required reviewed database context, one parameterized ID query using the existing full import/evidence projection and query-only connection owner. Missing/invalid/context-mismatched requests fail closed. Caller paths are not opened as databases.
5. Recheck only frozen reviewed IDs and their current scan evidence, retaining material-fingerprint and readiness checks; never fall back to the whole queue or to stale cached scan evidence.
6. Use the existing native approval command and 100-row batching. Update confirmed response counts immediately on return; distinguish Applying, affected-record reconciliation, application refresh, instrument refresh, and completion. Do not retry an uncertain write result automatically.
7. Reconcile the complete prepared queue only once after the batches, using exact affected IDs. Remove only confirmed applied rows; retain unqueried rows and block uncertain/failed IDs from automatic retry. A refresh failure does not erase a confirmed approval receipt.
8. The grouped pending view does not hydrate event-identity details for every collapsed row. It loads the opened identity-review action only; other views retain their existing detail behavior.

## Behavior preserved

Ordinary and exceptional approval authority, exact reviewed IDs, review confirmation, price-validation thresholds, identity decisions, official import/evidence projection, existing transaction and row-savepoint behavior, raw data and schema, Fetch & Import / Historical Backfill, Identity Import, Review Issues, Manual Entry, chart refresh options, and backend final checks remain intact. Five existing Rust warnings remain deferred. Gann and BSE referer dispositions are not reopened.

## Source authority and build metadata

Accepted parent evidence SHA256: `18E80B9101A268CBDE2D0D3E1CC8F92A5BDDB0B2A6D0E33682CD0245F933AF57`.

Accepted protected source: 550; FIX2 candidate: 552. The previous portable build legitimately regenerated `src-tauri-shell/gen/build-info.json`. This runner validates its three-field schema and timestamp/build-number consistency, captures its live SHA256, and preserves those exact bytes. It does not install an older metadata file. All other protected source is exact-hash checked.

## Validation commands and results

Actual Windows commands, arguments, exit codes, timings, reports, and stdout/stderr are in the evidence archive. This installation record is written only after the gated frontend and native checks have succeeded. The appended command journal supplies the actual result for each gate; no manual acceptance is implied.

Expected gates: frontend RED on accepted source; renderer `tsc -p tsconfig.json --noEmit`; focused FIX2 tests; Corporate Actions + Identity regressions; full Vitest; Vite renderer build; native RED for the missing exact-ID implementation; six new Rust tests; affected Corporate Action import Rust regressions; `cargo check`; post-install focused frontend checks; exact PRE/POST source and support verification.

Automated tests use synthetic fixtures only. No user database, network acquisition, Git operation, portable build, or snapshot is invoked.

## Risks and limitations

Manual WebView2 testing and real-data timings remain pending. Counted progress alone does not eliminate the intrinsic cost of the existing identity queries or price checks. Application refresh and instrument reload may still be slow; they are now visible phases. A native call cannot be cancelled mid-transaction by this UI. Cancellation waits for its current safe preparation call to return. An ambiguous Apply outcome must be checked in Approved before any retry.

## Rollback

Verified bounded pre-change backup: `E:\TA Projects\EOD Charting Platform\tmp\CA_OFFICIAL_IMPORTS_FIX2_RESUME1_2026-09-19_042022_IST_09f877f3_PRECHANGE_BACKUP.zip`

Backup SHA256: `21F5F9004F17698A961B2E1BAAB49FB87BB0F6EBFE89BF722A8ED251E9067FD3`

Stop the application. Verify and extract the backup outside the source directories. Restore the ten replaced files and `docs/CURRENT_WORK_STATUS.md` from its restore manifest. Remove only the two new FIX2 test files. Preserve this record and all evidence as historical material, then verify the 550-file authority, retaining the captured generated-metadata bytes. Rebuild the earlier executable only as a separately controlled action. This source rollback does not reverse user-approved database actions.

## Evidence

Evidence archive: `E:\TA Projects\EOD Charting Platform\tmp\CA_OFFICIAL_IMPORTS_FIX2_RESUME1_2026-09-19_042022_IST_09f877f3_evidence.zip`

The archive's own SHA256 is printed by the runner (not embedded recursively inside itself). Compact evidence includes installed changed files, authority/delta records, synthetic test logs, and delivery tooling.

Status: **automated installation checkpoint only; manual TEST-database acceptance and final snapshot remain pending.**

## Actual Windows command evidence

- 01-frontend-red: exit 1; 6 seconds. See 01-frontend-red.log.
- 02-renderer-typecheck: exit 0; 17 seconds. See 02-renderer-typecheck.log.
- 03-focused-fix2: exit 0; 3 seconds. See 03-focused-fix2.log.
- 04-corporate-actions-identity: exit 0; 10 seconds. See 04-corporate-actions-identity.log.
- 05-full-vitest: exit 0; 23 seconds. See 05-full-vitest.log.
- 06-renderer-build: exit 0; 9 seconds. See 06-renderer-build.log.
- 07-rustc-fingerprint: exit 0; 1 seconds. See 07-rustc-fingerprint.log.
- 08-rust-exact-id-red: exit 101; 466 seconds. See 08-rust-exact-id-red.log.
- 09-rust-exact-id-green: exit 0; 323 seconds. See 09-rust-exact-id-green.log.
- 10-rust-corporate-import-regression: exit 0; 635 seconds. See 10-rust-corporate-import-regression.log.
- 11-cargo-check: exit 0; 298 seconds. See 11-cargo-check.log.
- 13-post-install-focused: exit 0; 68 seconds. See 13-post-install-focused.log.
