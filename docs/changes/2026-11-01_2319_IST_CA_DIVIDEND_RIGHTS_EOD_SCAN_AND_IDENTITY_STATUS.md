# Corporate Actions — targeted Dividend/Rights EOD scan and distinct historical-identity blocker

**IST timestamp:** 2026-11-01 23:19 IST
**Active workstream:** EOD Charting Platform
**Authorized local root:** `E:\TA Projects\EOD Charting Platform` (not directly accessible in this GitHub-only change)
**Remote source:** `dhamnaik-lab/Eod-Charting-Platform`, `fix/corporate-actions-financial-integrity-20261101`, Draft PR #3
**Status:** Changes committed, verified by GitHub source refetch only; not build-tested or approved for merge.

## Objective and previous defect
The normal Classic **Load & Validate** coordinator already collected Dividend/Rights validation IDs, and its Rust scanner could provide a targeted read-only local EOD price-window observation, but the coordinator only sent Split/Bonus IDs to the scanner. A Dividend/Rights event could thus appear as `Waiting for EOD Data` without actually checking its authoritative price window in the current Load operation. The Classic screen also overwrote a useful EOD/identity diagnostic with generic `Awaiting Dividend verification`.

## Files modified
- `src/features/corporateActions/legacy/corporateActionImportOperations.ts`: in explicit-approval mode, submit the existing complete validated ID scope, including parsed Dividend/Rights, to the targeted EOD scanner; maintain batches of 500. Legacy/automatic Split/Bonus validation and auto-approval scope remain unchanged.
- `src/features/corporateActions/corporateActionBulkApproval.ts`: preserve a scanner-produced, same-import historical price-route identity-proof failure as `Awaiting verified identity evidence` instead of mislabelling it as missing EOD data.
- `src/components/DatabaseToolsDialogs.tsx`: preserve a concrete EOD/identity blocker for a pending Dividend instead of always overwriting it with generic Dividend verification. Only replace a would-be `Ready to approve` status with `Awaiting Dividend verification` while that workflow's separate verifier runs.
- `src/features/corporateActions/__tests__/corporateActionPendingPreparation.test.ts`: cover combined Split+Dividend scan IDs, 1,001 Dividend/Rights IDs in 500/500/1 batches, review-only scan observations and no automatic approval.
- `src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2.test.ts`: cover genuine missing EOD vs historical identity-proof diagnostics, available EOD observation and defensive same-import binding.

## Final implementation and accepted behavior preserved
- No fabricated corporate-action terms, identities, ex-dates, EOD bars, or approvals. The scanner remains read-only with respect to prices and must prove the price window.
- The existing strict quick identity-resolution pass still executes before scans.
- Existing event-time historical-symbol route proof in Rust is reused, not bypassed. Where verified historical data are present, eligible Dividend/Rights imports may now have EOD availability observed on Load.
- If bars are absent, they stay `Waiting for EOD Data`. If the price-route proof explicitly identifies missing historical full-ISIN evidence, the UI says `Awaiting verified identity evidence`.
- Other ongoing dividend term and source witness certification, Split/Bonus confidence and duplicate checks, approval write guards, raw EOD persistence, user selection, and duplicate prevention remain unchanged.
- No network retrieval, new dependency, schema migration, source-file copy, database access or automatic approval is introduced.

## Source evidence
Direct GitHub fetch after commits confirmed these **Git blob SHA-1 identifiers (not SHA-256)**:
- `legacy/corporateActionImportOperations.ts`: `5d44d338d8a76c32156f32ca04aa64cbdadec6bc`
- `corporateActionBulkApproval.ts`: `8e5ff0c027a3aec450a970f3d31e24145d0f4adf`
- `src/components/DatabaseToolsDialogs.tsx`: `2e1d3a0dca96ff5f46bf23d9254b44120f2cd7bf`
- `__tests__/corporateActionPendingPreparation.test.ts`: `47cb66f3aa7b8cd4f2cef4787ef96bb67ef62c2d`
- `__tests__/corporateActionOfficialImportsFix2.test.ts`: `cba3eb38c81ed8de51188051b502e18ee2dbc104`

## Validation
**Performed:** GitHub file refetch and expected-code signature checks on all five paths: PASS (presence/integrity of source only).

**Not executed:** TypeScript parser/typecheck, Vitest, full regression suite, Vite/Tauri build, Windows runtime tests, database/EOD fixtures, network downloads.

Required commands after source authority and checkout are verified in the authorized Windows project:
```powershell
npm test -- src/features/corporateActions/__tests__/corporateActionPendingPreparation.test.ts src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2.test.ts
npm run typecheck:renderer
npm run build:renderer
```
Broader affected Corporate Actions regression suites, Rust tests, and a Windows runtime manual checkpoint remain required. Passing commands must be backed by real output.

## Risks / limits
- Scanning a large Dividend/Rights queue can add local I/O, particularly for binary files; runtime and pagination performance require measurement.
- This bounded repair does **not** download genuinely absent EOD bars, fetch new official evidence, or invent a missing historical identity. Those require a separately approved source-specific acquisition/recovery change.
- A historic identity route without verified full-ISIN witness remains blocked; no automatic override.
- The combined Draft PR #3 contains earlier unverified financial-integrity changes; this commit does not certify them.

## Rollback
Revert only the five commits of this bounded change from the feature branch or restore the five files to their immediate parent Git blobs. Leave approved baseline behavior, production databases, `main` and unrelated PR #3 changes intact. Do not use direct DB edits as rollback.
