# Corporate Action UI/UX Reconstruction - Task 6A Maintenance Workspace / Navigation Foundation

**IST timestamp:** 2026-09-03 11:52:05.222 +05:30
**Classification:** CORPORATE_ACTION_UI_UX_RECONSTRUCTION_TASK6A_MAINTENANCE_FOUNDATION_AUTOMATED_GATES_PASSED__MANUAL_SCALE_CHECK_PENDING__TASK6B_NOT_AUTHORIZED

## Objective

Implement only the approved Task 6A Maintenance workspace/navigation foundation while preserving the certified Task 5E Normal workflow.

## Previous limitation

The application had one global Corporate Action open/request context for the Normal workflow. Maintenance capabilities remained source-preserved but did not have a separate full-page Maintenance entry/workspace.

## Files changed

Modified:
- src/RootApp.tsx
- src/store/uiStore.ts
- src/components/CommandPalette.tsx
- src/features/app/menuCommandRouter.ts
- src-tauri-shell/src/main.rs - menu declaration/wiring only
- src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx - test-contract migration only; production behavior unchanged

Created:
- src/features/corporateActions/maintenance/CorporateActionMaintenanceWorkspace.tsx
- src/features/corporateActions/maintenance/corporateActionMaintenanceWorkspace.css
- src/features/corporateActions/__tests__/corporateActionMaintenanceNavigation.test.ts
- src/features/corporateActions/__tests__/corporateActionMaintenanceWorkspace.test.tsx

## Final implementation

- Added a separate global Maintenance open/request state.
- Normal and Maintenance contexts are mutually exclusive.
- Existing Normal open action closes Maintenance.
- Maintenance open action closes Normal.
- Added a distinct Command Palette entry: Corporate Action Maintenance.
- Added a distinct Database menu event: menu:openCorporateActionMaintenance.
- Added the approved minimum Tauri shell Database-menu item only.
- Added a sibling full-page Maintenance shell.
- Added exactly six left-rail sections:
  1. Manual Actions
  2. Identity & History
  3. Official Data Fetch
  4. Historical Backfill
  5. Database Scan
  6. Issue Resolution
- Added no Maintenance business operations or platform API calls.
- Preserved the exact Task 5E Normal workspace host and underlying Normal business behavior.
- Migrated the pre-Task6A full-page host regression expectation so Database-tools suppression now requires both Normal and Maintenance workspaces to be closed.

## Validation commands

- 
pm.cmd test -- src/features/corporateActions/__tests__/corporateActionMaintenanceNavigation.test.ts
- 
pm.cmd test -- src/features/corporateActions/__tests__/corporateActionMaintenanceWorkspace.test.tsx
- Task 6A two-file focused regression
- Certified Task 5E three-file Normal regression
- Legacy corporateActionWorkspace.test.tsx RED against the new Maintenance exclusion guard
- Exact test-contract migration and GREEN rerun
- Task 5D R2 fifteen-file / 90-test behavioral regression after the host-contract migration
- 
pm.cmd run typecheck:renderer
- 
pm.cmd run build:renderer
- cargo.exe check --manifest-path src-tauri-shell\Cargo.toml with external CARGO_TARGET_DIR

## Actual validation results

All automated commands above returned exit code 0.
TDD RED evidence was captured before production implementation for navigation and workspace contracts.
Full command output is stored in the external Task 6A evidence directory.

Postflight:
- Task 5E Normal workflow production files: unchanged.
- The legacy full-page host test was intentionally updated only to recognize the approved Maintenance exclusion guard; its chart-restoration assertions remain intact.
- Capability preservation matrix: unchanged.
- package.json / package-lock.json: unchanged.
- Rust backend source excluding the approved main.rs shell-menu exception: unchanged.
- Live database/WAL/SHM family: unchanged.
- Git branch/HEAD/tree/index/staged set: unchanged.
- No Git staging or commit performed.
- No Maintenance business operations added.

## Risks / limitations

- The workspace intentionally contains navigation and explanatory foundation content only.
- Maintenance business capabilities remain in their preserved legacy implementation until Tasks 6B-6E.
- Automated checks do not replace visual scale verification.

## Manual gate

**PENDING:** 100% / 125% / 150% display-scale and chart-restoration checks.

**Task 6B is not authorized until the user explicitly passes this manual checkpoint.**

## Rollback guidance

Restore the six modified preimages from the Task 6A evidence backup directory and remove the four Task 6A-created source/test files plus this report. No database rollback is required because this task performs no database behavior change or business operation.