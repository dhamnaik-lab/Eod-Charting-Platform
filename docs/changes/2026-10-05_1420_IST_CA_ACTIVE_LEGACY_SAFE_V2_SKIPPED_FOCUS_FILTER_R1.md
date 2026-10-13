# CA_ACTIVE_LEGACY_SAFE_V2_SKIPPED_FOCUS_FILTER_R1

IST timestamp: 2026-10-05 14:20 IST

## Objective

Add a presentation-only **Safe V2 skipped** focus filter to the active Legacy Corporate Actions Pending Actions compact filter band. The filter uses only current-cycle backend-returned `SKIPPED` disposition IDs that are already retained by the accepted Safe-V2 outcome observability implementation.

Active root: `E:\TA Projects\EOD Charting Platform`.

Fresh source authority: `Eod Charting Platform Source Code 2026-10-05_141122_IST.zip`, SHA256 `3FBFDD747B7DA665D01F266A64EF06E42086B9AEDE87EC40C917077218AF3D3C`.

## Previous limitation

The active Legacy UI already displayed current-cycle Safe-V2 aggregate counts and exact backend `SKIPPED` reasons, but an operator still had to scan the complete Pending Actions list to locate those rows. Existing symbol, action-type and text filters could not directly focus the current Safe-V2 skipped cohort.

## Files changed

- `src/components/DatabaseToolsDialogs.tsx` — production presentation/filter wiring only.
- `src/features/corporateActions/__tests__/corporateActionSafeV2SkippedFocusFilter.test.ts` — new 10-case source-execution/contract regression.
- this change record.

No Rust/backend, Legacy orchestration, desktop type, Tauri bridge, RootApp, schema or database file is changed.

## Final implementation

- Add `officialSafeV2SkippedOnly`, default `false`.
- Derive `officialSafeV2SkippedFocusActive` only while the active official-import view is `review`, the toggle is enabled, and a current authoritative Safe-V2 outcome exists.
- When active, `visibleImportRows` remains the intersection of existing action-type, text-search and symbol filters and the existing current-cycle `officialAutoApprovalSkippedReasons` ID map.
- Approved view is unaffected.
- Losing the current authoritative outcome clears the ephemeral toggle so a future preparation cannot silently reactivate an old focus.
- Add one compact checkbox labelled `Safe V2 skipped (N)`. It is disabled while busy, when there is no current outcome, or when the current outcome contains zero `SKIPPED` rows.
- Changing the focus clears current row selection and pending approval confirmation, matching the existing symbol-filter safety behavior.
- The focus feature does not evaluate eligibility and does not persist anything.

## Behavior preserved

- `SKIPPED` remains informational: it is not a manual Apply veto.
- The existing `eligibleImportRows` predicate is unchanged and contains no Safe-V2 focus condition.
- Manual Apply, price/identity validation, Safe-V2 eligibility/policy, R1-B4 identity/provenance, k=0.40, G=7, same-date exclusions, and backend reason text are unchanged.
- Final preparation status remains `setStatus(result.message)` and orchestration-owned.
- Existing Safe-V2 outcome summary/reason presentation is preserved.
- RootApp/Legacy routing, desktop/Tauri contracts, DB/schema/persistence, Dividend/Rights/Demerger behavior are unchanged.
- Phase5E4 network gate remains **OPEN / UNSATISFIED / DEFERRED**. No new EOD/Prepare/network-acceptance cycle is authorized by this task.

## Generation validation commands/results

These checks were run in the generation environment against the fresh source snapshot. They are supplementary and do **not** substitute for the required target-host project toolchain validation.

1. Fresh snapshot SHA256 + ZIP CRC: PASS; 1,446 files / 23,678,492 bytes.
2. New final test source executed through Node 22.16.0 built-in tests + TypeScript 5.8.3 extracted-source execution against unchanged baseline: expected RED, **4 PASS / 6 FAIL / 10 tests**.
3. Same final test bytes against the candidate: GREEN, **10/10 PASS**.
4. Generation-only TypeScript 5.8.3 semantic check of the new test with minimal `describe`/`it` declarations: **0 diagnostics**. This is not the project TypeScript check.
5. TSX/TS parse diagnostics for production/new test: **0 / 0**.
6. Source comparison before adding this record: exactly one existing production file changed and one new test added; no original file missing.

Required target-host gates before installation: baseline focused Vitest, exact RED, GREEN, focused regression, full Corporate Actions regression, TypeScript `--noEmit`, Vite build, exact source recheck and scoped pre-edit backup. After installation: focused regression, TypeScript, Vite build and exact protected-source recheck.

## Risks / limitations

- No EOD UI was launched, so there is no manual visual-layout checkpoint in this task.
- The new checkbox shares the existing wrapping compact filter band; Vite compilation validates source/build integrity but not pixel-level visual layout.
- The filter is intentionally current-cycle only. If Safe-V2 outcome state becomes invalid, the focus turns off rather than reconstructing historical skip membership.
- Applying `Apply All Ready` while the focus is active naturally uses the current visible/eligible scope, the same semantics as the existing symbol/action/search filters; row eligibility itself is unchanged.

## Rollback guidance

Restore only `src/components/DatabaseToolsDialogs.tsx` from the task-owned pre-edit backup after verifying the current postimage hash, remove the newly created focus-filter test only if it still matches the task postimage hash, and remove this change record only if it still matches the task-owned version. Do not restore a whole project snapshot or any database for this presentation-only change.

## Source hashes at generation time

- `src/components/DatabaseToolsDialogs.tsx` PRE: `DA8370E393647F6A0D7A456898E076A30CC27AE130689AD74B976A77E82F0D05`
- `src/components/DatabaseToolsDialogs.tsx` candidate POST: `0F918D6702CBA0229D99DC2610454FAE2767476BBFEBA49D0C8A15C69BE975A5`
- `src/features/corporateActions/__tests__/corporateActionSafeV2SkippedFocusFilter.test.ts` candidate POST: `BF454E7DA6160D8D27EB82C01901CC44CC381921EEA88E2579500EBF39E072B8`

Target-host validation receipt is appended by the guarded installer only after all required validations and installation succeed.

## Target-host validation receipt

IST: 2026-10-05T14:54:54.567+05:30
Fresh snapshot SHA256: 3FBFDD747B7DA665D01F266A64EF06E42086B9AEDE87EC40C917077218AF3D3C
Protected source pre-install: 594 exact
Protected source post-install: 595 exact
Backup: E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261005_145420_CA_SAFE_V2_SKIPPED_FOCUS_R1
Evidence: E:\TA Projects\EOD Charting Platform\tmp\CA_SAFE_V2_SKIP_FOCUS_R1_2026-10-05_145301_IST_5e4fcd8a\evidence
- 01-baseline-focused: {"files":3,"tests":36}
- 02-red-focus-filter: {"tests":10,"passed":4,"failed":6}
- 03-green-focus-filter: {"tests":10,"passed":10,"failed":0}
- 04-focused-regression: {"files":4,"tests":46}
- 05-full-ca-regression: {"files":47,"tests":295}
- typecheck: PASS
- 07-vite-build: PASS
- 09-post-install-focused: {"files":4,"tests":46}
- postInstallTypecheck: PASS
- 11-post-install-vite-build: PASS
- Post-install Vite build: PASS
- Manual visual checkpoint: NOT RUN; no EOD launch authorized.
- Phase5E4 network gate: OPEN / UNSATISFIED / DEFERRED.
