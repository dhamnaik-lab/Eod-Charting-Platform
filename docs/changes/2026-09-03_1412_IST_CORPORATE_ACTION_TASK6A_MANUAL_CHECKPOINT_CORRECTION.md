# Corporate Action Task 6A Manual Checkpoint Correction

**IST timestamp:** 2026-09-03 15:38:17.916 +05:30
**Classification:** TASK6A_MANUAL_CHECKPOINT_CORRECTION_AUTOMATED_GATES_PASSED__RUNTIME_FETCH_RECHECK_AND_100_125_150_SCALE_CHECK_PENDING__TASK6B_NOT_AUTHORIZED

## Objective

Correct the user-observed Task 6A manual-checkpoint issues before certification.

## User-approved corrections

1. Restore internal application-window functions for Normal Corporate Actions and Maintenance: minimize, maximize/restore, close, drag, resize.
2. Add editable Normal Fetch From and To dates while keeping the default last-90-days-to-today range.
3. Preserve and display real non-empty Tauri/string/object rejection text so the runtime official-fetch failure can be diagnosed.
4. Preserve NSE+BSE acquisition, cache reuse, duplicate protection, and orceRefresh=false.

## Files modified

- src/RootApp.tsx
- src/components/FloatingWindow.tsx
- src/features/corporateActions/workspace/corporateActionWorkspace.css
- src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx
- src/features/corporateActions/workflow/corporateActionNormalWorkflowAdapter.ts

## Files created

- src/features/corporateActions/workspace/CorporateActionManagedWindow.tsx
- src/features/corporateActions/workspace/corporateActionManagedWindow.css
- src/features/corporateActions/__tests__/corporateActionManualCheckpointCorrection.test.tsx

## Behavior changed

- Both Corporate Action contexts now use the established FloatingWindow/windowStore mechanics.
- They open maximized by default.
- Restore returns to a centered resizable/drag-capable internal window.
- Minimize preserves mounted workflow children rather than resetting controller state.
- Existing internal Close buttons remain source-compatible but are hidden inside managed-window chrome to avoid duplicate Close controls.
- Normal Fetch exposes editable From/To dates.
- Default date range remains the existing 90-day IST lookback through today.
- Explicit dates are sent to both NSE and BSE with orceRefresh=false.
- Non-empty string or object message rejection text is surfaced to the operator.

## Behavior deliberately preserved

- Task 5E Normal Load/Review/Approve semantics.
- Existing backend Corporate Action commands and algorithms.
- Existing Task 5B authoritative fetch/reload boundary.
- Maintenance remains navigation/presentation only.
- Normal/Maintenance mutual exclusion.
- No database schema, Rust backend, package dependency, or API-surface change.
- Existing FloatingWindow behavior for all non-Corporate-Action windows remains unchanged because minimized-child preservation is opt-in.

## Validation

- TDD correction RED captured before implementation.
- Correction GREEN.
- Task 6A navigation/Maintenance regression.
- Certified Task 5E Normal regression.
- Task 5D R2 15-file / 90-test regression.
- Renderer typecheck.
- Renderer production build.
- Cargo check using external target directory.
- Portable Windows build.
- Backend source byte-manifest unchanged.
- DB/WAL/SHM byte state unchanged.
- Git HEAD/tree/index/staged set unchanged.

## Runtime limitation still pending

The prior portable displayed only the generic Could not fetch routine Corporate Action data. message. This correction intentionally does not guess or alter backend fetch behavior. Re-run Fetch on the newly built portable and capture the now-visible authoritative error if Fetch still fails.

## Manual gate

Task 6A remains pending until all are verified on the newly built portable:

- Normal and Maintenance minimize/maximize/restore/close/drag/resize.
- Minimize + restore retains current Corporate Action workflow state.
- Editable From/To dates are visible and default correctly.
- Runtime Fetch succeeds, or the exact authoritative failure text is captured for a separate diagnosis.
- 100% / 125% / 150% display scale checks pass.
- Closing returns to the same chart tab/sheet state.

**Task 6B remains unauthorized.**

## Rollback

Restore the modified preimages from:
$BackupDir

Remove the three created Task 6A correction files and this report. No database rollback is required because this correction changes no backend/database behavior.