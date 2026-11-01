# CA-DIV-OBS-R1 — Dividend prepared-scope observability test alignment

**IST timestamp:** 2026-11-02 02:13 IST  
**Workstream:** EOD Charting Platform  
**Authorized Windows root:** `E:\TA Projects\EOD Charting Platform`  
**GitHub source authority:** `dhamnaik-lab/Eod-Charting-Platform`, main `cfba1cb3ca0e70c51604f0a5e9be2f36562f45ce` (merged PR #6).  
**Review branch:** `fix/ca-dividend-prepared-scope-observability-r1-20261102`.  
**Status:** Test-only correction committed for review; actual Windows Vitest/typecheck/build validation **NOT RUN**.

## Objective and previous defect

The user-approved bounded issue concerns exactly five failing assertions in `src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts`. Evidence: `EOD_CA_FULL_VITEST_POST_PR5_20261102_005928_IST.zip`, in which the broader Corporate Actions suite had 524 passes, 11 failures in 4 files. These five are source-text observations, not demonstrated production failures.

## Files inspected

- `src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts`, entire file, Git blob `82f69951c155640a25365a0b176de246c3409f98`.
- `src/components/DatabaseToolsDialogs.tsx`, targeted source read-only at main, Git blob `2e1d3a0dca96ff5f46bf23d9254b44120f2cd7bf`. Inspected current-cycle outcome gating, Classic/Advanced Pending details, status panel, verified Dividend readiness, approval reconciliation, resets and Approved view.
- `01_CorporateActions_Full_Vitest.log` from the previously uploaded evidence ZIP, the five exact failed assertions.
- Existing project documentation not read.

## Files changed

**Modified:** `src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts` (new Git blob `a1401b42b1698fca0a17259215616af691fb3f5f`).

1. Normalize CRLF to LF when reading the implementation source for exact string-inspection tests. This makes matching deterministic across Windows and GitHub checkouts.
2. Inspect the new compact status band through the current Advanced panel boundary, continuing to verify that Safe V2 summary and Dividend read-only summary display together.
3. Check exactly two prepared-scope row-disposition presentations: Classic details and expanded Advanced Pending rows. Check Approved rows do not include this diagnostics-only presentation.
4. Restrict the manual eligibility text slice to the actual `eligibleImportRows` expression instead of inadvertently including the later `lastScanReportRef`. Retain the `isOfficialRowReady(row)` assertion, and explicitly assert verified Dividend scope membership, backend `ELIGIBLE` disposition and non-null evidence in that readiness helper. The raw read-only outcome is not direct manual Apply authority.
5. Verify six explicit state invalidation calls, generation match, restored snapshot behavior, and the distinction between carrying forward a successfully reconciled scope and invalidating failed approval reconciliation. The original fixed count of seven did not reflect current implementation.

**Created:** this change record. No production source was changed.

## Exact behavior changed and preserved

Only tests and documentation changed. No user-visible behavior, backend logic, data, approval authorization, Dividend factor, evidence requirement, auto-approval, import workflow, database or binary EOD logic changed.

Existing source behavior specifically preserved: the completed current-generation, database-scoped read-only outcome may be displayed; the manual Apply readiness predicate must require a current verified write-stage scope and `ELIGIBLE` disposition with backend evidence; failures/stale generations do not become approval authority; Approved history remains independent of pending diagnostics; the two distinct Classic/Advanced Pending presentations remain.

## Validation and actual results

**Performed:**
- Verified GitHub `main` authority SHA before branching.
- Verified exact original test and production file blob IDs.
- Inspected logged five failure messages.
- Source-level static preflight **PASS** for ten targeted assertions, including exact JSX boundaries, both details locations, absence of diagnostic component from Approved map, isolated manual eligibility expression, verified readiness gating, six state resets, failure-clear condition, saved evidence restoration, and Approved view boundaries.
- GitHub test-file write/read authority recorded by returned blob and commit SHAs.

**Not executed:** Vitest; TypeScript typecheck; Vite production build; full Corporate Actions Vitest; Rust/Tauri checks; Windows runtime validation. This runtime lacks locally installed Vitest and Vite. Do not describe the five tests as passing yet.

Required Windows validation on an exact, non-overwritten local copy of this review branch, after safeguarding the existing two locally modified Tauri schema files:

```powershell
Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'
npm test -- src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts
npm test -- src/features/corporateActions/__tests__/corporateActionSafeV2SkippedFocusFilter.test.ts src/features/corporateActions/__tests__/corporateActionSafeV2OutcomeObservability.test.ts
npm run typecheck:renderer
npm run build:renderer
```

Capture command outputs/exit codes, exact source hashes, IST timestamp, ZIP SHA-256 and parser/test evidence under `C:\Users\dharm\Downloads`. Never claim passed without actual output. Keep PR Draft until evidence is reviewed.

## Risks, limitations and rollback

- Source-text tests may need adjustment after future intentional UI/layout refactors; static assertions do not substitute for actual runtime interaction.
- The six-reset assertion protects existing behavior but should be complemented by focused dynamic lifecycle tests if production lifecycle logic changes.
- This change does not address the other six failures shown in the older full-suite report, the 19 historical Rust failures, or manual UI acceptance.
- Preserve the locally modified `src-tauri-shell\gen\schemas\desktop-schema.json` and `windows-schema.json`. No local files or production database were accessed during this GitHub change.
- Roll back by restoring the original test blob `82f69951c155640a25365a0b176de246c3409f98` and removing this new change note on the review branch, without touching `main` or user data.

## Next step

Run the focused Windows validation using Codex or a reviewed manual command, inspect the resulting logs and evidence, then close the bounded issue if all required checks pass. Do not expand into other failure groups without approval.
