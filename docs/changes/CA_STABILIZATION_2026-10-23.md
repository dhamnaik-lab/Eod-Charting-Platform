# Corporate Actions stabilization — 23 October 2026

## Scope and backup

Project: `E:\TA Projects\EOD Charting Platform`.

The user authorized a focused implementation pass with a pre-edit backup after a read-only audit. The existing dirty working tree was preserved. No production database, raw EOD file, official feed, package, or installed application was modified or exercised.

Backup PASS: `backups/pre_opencode_changes_20261023_012919_ca_approval_stabilization`.
The initial direct script invocation was blocked by Windows execution policy; the normal backup succeeded using a process-scoped `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-project-backup.ps1 -ShortName ca_approval_stabilization`. No persistent execution policy was changed.

## Changes

1. Approval requests now require `expectedDatabasePath`. Normal single/bulk approval and the existing ISIN/price-exception/recommended-identity paths check that database before opening the connection and again before their internal approval logic. Missing/mismatched contexts fail before import IDs are read or written. Active and retained alternate frontend callers pass the reviewed context.
2. Dividend approval preserves the official historical ISIN on the import while checking the canonical record against the current instrument ISIN. Historical identity still requires freshly verified machine evidence; a shared ISIN prefix alone no longer counts as exact identity. Regression coverage exercises the real writer and outer transaction.
3. Same-date exclusions now include canonical manual/legacy actions associated with the resolved instrument and its aliases, not only import peers. The exact existing-action link remains available for the legacy Split/Bonus policy; the normal workflow does not enable that automatic policy.
4. Dividend-adjusted reads use recorded factors instead of deriving a new factor from the last bar in a requested date range. Same-date dividend components combine their recorded cash-to-price fractions, preserving overlap between full and shortened history requests. Raw prices and volumes remain unchanged.

The normal workflow remains **Fetch from Officials → Load & Validate → explicitly Approve Ready**. Existing automatic parsing, proof-backed identity resolution, deduplication, EOD checks, and preparation remain in Load & Validate. No financial approval was added to Fetch or Load. Missing evidence remains pending.

Existing post-commit refresh is preserved: `db:changed` invalidates the desktop EOD cache, clears the renderer instrument cache, and rehydrates open chart tabs. The approval operation also reconciles stored rows and reloads affected instruments. A new behavior test checks commit-before-refresh ordering and one reload per affected instrument.

## Files changed in this pass

- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/corporate_action_imports.rs`
- `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs`
- `src-tauri-shell/src/database/corporate_action_imports/auto_approval/write_stage_tests.rs`
- `src-tauri-shell/src/database/eod_data.rs`
- `src/types/desktop.ts`
- `src/components/DatabaseToolsDialogs.tsx`
- `src/features/corporateActions/legacy/corporateActionImportOperations.ts`
- `src/features/corporateActions/workflow/corporateActionNormalWorkflowAdapter.ts`
- `src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx`
- `src/features/corporateActions/__tests__/corporateActionNormalApprovalAdapter.test.ts`
- `src/features/corporateActions/__tests__/corporateActionOfficialImportsFix2.test.ts`
- This handoff note.

## Validation

- PASS — `cargo test --manifest-path src-tauri-shell/Cargo.toml ca_stabilization --offline -- --nocapture`: 5/5 new regression tests. The initial run was FAIL (4/5) because the new audit-count assertion included the prior identity decision in a helper that counts only approval decisions; the assertion was corrected and rerun successfully.
- PASS — `cargo test --manifest-path src-tauri-shell/Cargo.toml database::corporate_action_imports::auto_approval --offline -- --quiet`: 94/94. Earlier runs were FAIL (93/94). An existing duplicate-link fixture lacked the production `adjust_volume NOT NULL DEFAULT 1` default, then lacked actual EOD bars required by the pre-existing readiness guard. The fixture was aligned with those requirements; no production readiness check was relaxed.
- PASS — `cargo test --manifest-path src-tauri-shell/Cargo.toml database::eod_data::tests --offline -- --quiet`: 8/8.
- PASS — focused Vitest run, explicitly restricted to `src/features/corporateActions/__tests__` with `--exclude 'tmp/**'`: 8 files, 67/67 tests. Files: OfficialImportsFix2, PendingPreparation, NormalApprovalAdapter, NormalApprovalWorkspace, DividendExplicitApprovalR1, ThreeActionCompletionR1, DividendWriteStageOrchestration, and DividendWriteStageTauriBridge (each with the `corporateAction` prefix and `.test.ts` suffix).
- INCOMPLETE / STOPPED — the initial Vitest invocation also matched archived copies under `tmp/`; it was interrupted and replaced by the bounded run above.
- PASS — `scripts/validate-change.ps1 -Profile renderer` with paths restricted to `src/types/desktop.ts`, `src/components/DatabaseToolsDialogs.tsx`, and `src/features/corporateActions`: renderer typecheck and scoped whitespace check.
- PASS — final `git diff --check` across all touched source files, handoff-note whitespace, and confirmation that no task Vitest process remained running.

No full validation profile, full test suite, release build, packaging, official network fetch, production approval, or desktop UI acceptance was run. Tests were run serially.

## Remaining acceptance

Observe the repaired workflow in a disposable test database: Fetch → Load & Validate → explicit approval → automatic chart refresh, preserving the chart viewport and adjustment settings. Production operation is not claimed as verified by unit tests. Unsupported announcements and insufficient identity/price evidence remain pending; this pass does not infer missing financial terms or approve unresolved actions.
