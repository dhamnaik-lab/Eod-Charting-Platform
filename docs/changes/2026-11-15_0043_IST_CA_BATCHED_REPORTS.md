# Batched Corporate Actions reports and price-evidence wording

15 November 2026, 00:43 IST. User authorized this focused correction after requiring approval before file edits. Implementation and regression preparation complete; all validation **Pending**.

Later desktop evidence and performance work are recorded in the [scan lookup index change](2026-11-15_1836_IST_CA_RECONCILIATION_SCAN_INDEX.md). The targeted nine-row CSV completed. A full-scope run captured multiple batches but did not establish full-queue acceptance.

## Problem and corrected behavior

The Dividend queue contained 14,045 IDs. The panel refused scopes over 500, while the backend correctly limited each read-only request to 500. Increasing the backend limit was not necessary.

- A report now processes the unique requested IDs sequentially in batches of at most 500. The 14,045-ID case is 29 requests: 28 x 500 plus 45. Existing per-batch response ownership, outcome/ID accounting, read-only and zero-write checks are reused.
- Progress shows captured versus requested IDs and completed batches. Cancellation waits for the current read to return, discards that in-flight response, and starts no further batches. It does not claim to terminate a backend query.
- Captured earlier batches remain exportable after cancellation or transport/response failure, explicitly marked CANCELLED or FAILED. Backend partial results remain PARTIAL. IDs not captured receive one NOT_CAPTURED export row each, without invented terms, readiness, timestamps or fingerprints.
- Database/path, scope, application build or schema changes invalidate the report. Late responses cannot repopulate a replaced/closed scope. A same-path database-change event also invalidates current exports.
- Each batch retains its own timestamp and fingerprint. The report explicitly identifies separate batch snapshots; it is not one atomic database snapshot and never certifies database completeness.
- CSV/TXT export covers the entire requested preview, including uncaptured IDs. Checkboxes now select rows for retry only; retry starts a new report for that subset. Retry uncaptured IDs is provided. The table displays 100 rows per page so a 14,045-row report does not render all detailed rows at once.
- Dividend/Rights diagnostics distinguish an explicit stored NO_PRICE_DATA result from an absent usable scan window. The latter is PRICE_WINDOW_NOT_CAPTURED: validation may have stopped at terms/identity checks, and missing EOD data is not established. Diagnostics still do not read raw EOD prices or revalidate coverage.

## Files

Modified:

- `src/features/corporateActions/reconciliation/corporateActionReconciliationPreflight.ts`
- `src/features/corporateActions/reconciliation/CorporateActionReconciliationPanel.tsx`
- `src/features/corporateActions/reconciliation/corporateActionReconciliationExport.ts`
- The corresponding three files under `src/features/corporateActions/__tests__/`.
- `src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight.rs`
- `src-tauri-shell/src/database/corporate_action_imports/reconciliation_preflight/tests.rs`
- `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` and this new record.

Inspected the current versions of these owners/tests, immediate handoff and shared Cargo wrapper. Existing source inspection established the frontend/backend 500-ID boundary and the Rights early-return scan behavior. No repository-wide search or source-control baseline was used.

## Boundaries and risks

Backend request limit, read-only database opening, financial readiness, approvals, factor calculations, identity writes, source fetching and database schemas are unchanged. No actual database, backup, Git, build, test, packaging or validation commands were accessed/executed by the agent. No dependency was added. Backups remain untouched under the user's prior constraint.

Cross-batch content can change without a detected database-change event; therefore separate snapshots are explicitly identified rather than claimed to be globally consistent. Each export row retains its originating snapshot provenance. Cancellation latency depends on the current backend request. Report memory grows with captured rows, although table rendering is paged. Native timing/memory behavior at 14,045 rows remains unverified. Complete means all requested IDs were accounted for, not that actions are eligible or the database is complete.

Combined exports add report status, requested/captured/not-captured counts, snapshot scope and report message columns. Consumers should use headers. Uncaptured placeholder rows are report-accounting records, not evidence that an import was deleted or absent. A full report export intentionally differs from the previous checkbox-selected export; this is stated next to the controls. Save dialog behavior is unchanged, including user-selected paths and cancellation.

## Prepared regressions — Pending

Frontend: 14,045 unique IDs plus duplicate input; 29 sequential calls and the 500-ID limit; cancellation between/in a batch; retained coverage after failure; per-batch partial/malformed responses; path/build/schema/file-identity invalidation and late responses; combined CSV/TXT provenance and order; explicit uncaptured ID rows; rejection of misleading COMPLETE, duplicate IDs and active reports; large-scope preview enabled. Existing session and export safety tests are retained.

Rust: Rights/Dividend empty REVIEW windows produce PRICE_WINDOW_NOT_CAPTURED; explicit NO_PRICE_DATA remains PRICE_DATA_MISSING. Existing read-only/fingerprint and no-write regressions remain in place.

## Manual validation commands — all Pending

Run serially in PowerShell 7 and stop on failure. Commands are prepared only, not executed. The focused Rust test may compile/link the Tauri harness in the shared root target. Do not add --ignored or use a separate Cargo target.

```powershell
Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform'
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('database::corporate_action_imports::reconciliation_preflight::tests::', '--', '--nocapture')
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction test -CargoArguments @('database::corporate_action_imports::reconciliation_preflight::tests::', '--', '--nocapture')
& .\node_modules\.bin\vitest.cmd run src/features/corporateActions/__tests__/corporateActionReconciliationPreflight.test.ts src/features/corporateActions/__tests__/corporateActionReconciliationPanel.test.tsx src/features/corporateActions/__tests__/corporateActionReconciliationExport.test.ts
npm.cmd run typecheck:renderer
npm.cmd run build:renderer
pwsh -NoProfile -File .\scripts\check-doc-references.ps1
```

The renderer build's existing hook generates theme tokens and writes dist. Portable packaging remains user-owned and follows successful checks. No general validation profile is used because it includes Git operations.

Native acceptance after the user's rebuild: select Dividend and preview all 14,045 unique IDs; confirm 29 sequential batches, final accounting, pagination and a combined export. Cancel during a read and inspect explicit uncaptured rows; retry them as a new report. Change the database or filters during a preview and verify invalidation. Re-export incomplete Rights and verify missing scan windows are no longer presented as proven EOD gaps. Confirm zero repairs/approvals. All native acceptance is Pending.

## Rollback and handoff

Reverse only this correction's frontend report orchestration/export/UI, Rust wording, test and documentation hunks after reviewing current files. Do not restore whole files or backups, and preserve earlier Rights safety and diagnostic-coverage work. No database rollback is needed or authorized. Next: user manual validation; no further CA workstream or approval is initiated by this task.
