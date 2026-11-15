# Rights adjustment safety correction

Date: 14 November 2026, 17:38 IST. Status: implemented locally; all validation **Pending**.

## Scope and evidence

Current source in `E:\TA Projects\EOD Charting Platform` was the authority. The scanner admitted incomplete Rights terms using an observed opening/closing price decline of at least 1%, persisted a factor, and promoted the import to PARSED. Frontend readiness admitted reciprocal EOD factors, and the mutation layer could retrieve a stored Rights factor when terms were missing. Ordinary trading movement does not verify Rights economics. The reported approximately 404 Ready records were not independently counted: no actual database was accessed.

## Correction

- Rights scan and official approval now require finite positive ratio numerator, denominator and issue price. Missing/invalid terms produce an official-terms blocker before price evidence or exception approval can authorize an adjustment.
- Removed Rights from EOD-implied factor generation and removed the mutation-layer stored Rights factor fallback. Complete official terms retain the existing TERP calculation using the previous close.
- Frontend ordinary/normal approval rejects incomplete Rights even with a stale PARSED row, reciprocal factors and MATCHED scan. Deferred grouping requires complete parsed terms; stale pending EOD factors are no longer presented as a Rights adjustment description. Already-approved descriptions remain available.
- No database migration or cleanup. Existing unapproved factors/messages may remain stored, but cannot establish financial readiness. Approved links and stored adjustments are unchanged. No independently verified alternative Rights adjustment mechanism was found in the inspected paths; the removed fallback had no independent financial authority.

## Files

Modified runtime and colocated Rust tests:

- `src-tauri-shell/src/database/corporate_action_imports.rs`
- `src-tauri-shell/src/database/instrument_mutations.rs`
- `src/features/corporateActions/corporateActionValidation.ts`
- `src/features/corporateActions/legacy/corporateActionLater.ts`

Modified Vitest regressions:

- `src/features/corporateActions/__tests__/corporateActionValidation.test.ts`
- `src/features/corporateActions/__tests__/corporateActionLater.test.ts`
- `src/features/corporateActions/__tests__/corporateActionOfficialReadinessController.test.ts`

Documentation: this new record, `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, and `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`.

Also inspected relevant portions of `legacy/corporateActionOfficialReadiness.ts`, `workspace/corporateActionClassicModel.ts`, its test, `corporateActionAllTypeReadinessSummary.test.ts`, `corporateActionReviewParityR2.test.tsx`, `package.json`, `src-tauri-shell/Cargo.toml`, `scripts/Invoke-EOD-SharedCargo.ps1`, `scripts/validate-change.ps1`, and `scripts/check-doc-references.ps1`. No additional nested AGENTS.md was found in the targeted source/document/script directories.

## Preserved behavior and risks

Explicit approval, transaction owners, duplicate checks, existing identity/freshness and price-window checks, raw EOD immutability and chart refresh were not redesigned. Split, Bonus, Dividend, Demerger, informational closure and symbol-history behavior remain unchanged by design. Demerger retains its existing separate EOD mechanism. No new dependency, database operation, backup change, Git operation, build, test, packaging, validation runner or approval was executed. Existing local edits were retained using bounded changes; no Git baseline was inspected. Entire help was read as required by the session instructions; no checkpoint/source-control operation was performed.

Risks: compilation and test results are unknown; native UI, live-data acceptance and the reported population are unverified. Numeric fields continue to rely on the existing official import/provenance pipeline; this correction does not re-audit official source documents. Existing approved Rights actions are not reassessed. Existing binaries retain old behavior until the user rebuilds. Complete terms combined with an inconsistent old stored factor may still fail the existing approval factor-equality safeguard; this correction does not clear that evidence or bypass that check.

## Manual validation — all Pending

Run in PowerShell 7, serially, stopping on failure. Commands were checked against repository script parameters and package scripts, not executed. Rust checks reuse the root `target`; filtered tests can still compile/link the Tauri harness. Do not add `--ignored` (some historical tests use live sources). The general validation runner includes Git operations, so it is deliberately not used here.

```powershell
Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'

# 1. Focused Rights tests (includes parser, safety, TERP and duplicate coverage).
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('rights', '--', '--nocapture')
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('rights', '--', '--nocapture')

# 2. Relevant CA backend regressions, serially.
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('database::corporate_action_imports::', '--', '--nocapture')
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('database::corporate_action_imports::', '--', '--nocapture')
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('database::instrument_mutations::', '--', '--nocapture')
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('database::instrument_mutations::', '--', '--nocapture')

# 3. Focused frontend regressions (installed Vitest; no package download).
& .\node_modules\.bin\vitest.cmd run src/features/corporateActions/__tests__/corporateActionValidation.test.ts src/features/corporateActions/__tests__/corporateActionLater.test.ts src/features/corporateActions/__tests__/corporateActionOfficialReadinessController.test.ts src/features/corporateActions/__tests__/corporateActionAllTypeReadinessSummary.test.ts

# 4. Renderer TypeScript.
npm.cmd run typecheck:renderer

# 5. Frontend build and documentation references.
npm.cmd run build:renderer
pwsh -NoProfile -File .\scripts\check-doc-references.ps1
```

The frontend build runs the existing theme-generation prebuild hook and writes `dist`; it does not build/stage the portable EXE. The shared Cargo wrapper may stop on existing conflicting artifact directories; do not clean them or create a separate target to bypass it.

Prepared tests exercise: EOD decline with stale parsed Rights factor rejected without writes; ordinary and both exception flags blocked; complete positive terms accepted by the guard; invalid terms rejected; an already-approved link/factor preserved; manual factor computation rejects missing issue price despite a stored factor; existing TERP/economic-duplicate regression retained; UI stale MATCHED factor denied in Classic/Advanced and Deferred summaries; complete terms retain EOD-availability gating.

After these pass, the user can rebuild the portable application and perform isolated native acceptance: incomplete Rights remain Deferred even with a decline/current scan; complete official terms follow TERP and explicit approval; existing approved actions remain unchanged. Native acceptance is **Pending** and no actual-data approval is requested by this handoff.

## Rollback and resume

No backups were created or modified, per task constraint. To roll back, manually reverse only this correction's source/test/document hunks after reviewing the current files; preserve all pre-existing local work and never restore whole files from a backup without separate authorization. Re-enabling the removed fallback would restore the unsafe behavior, so keep incomplete Rights blocked if rolling back for diagnosis. No database rollback is required or authorized. Resume with the manual validation above; this bounded task does not open another CA workstream.
