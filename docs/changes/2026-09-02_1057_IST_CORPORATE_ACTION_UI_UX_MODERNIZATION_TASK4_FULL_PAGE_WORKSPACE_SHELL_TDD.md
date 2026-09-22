# Corporate Action UI/UX Modernization — Task 4 Dedicated Full-Page Workspace Shell TDD

## IST timestamp
2026-09-02 10:57:49.052 IST

## Objective
Add only the dedicated full-page Corporate Action workspace shell defined by Phase A Task 4, while keeping the existing chart workspace mounted so closing Corporate Actions restores the exact prior chart state without recreation.

## Previous defect or limitation
Corporate Actions still opened inside the dense DatabaseToolsDialogs composition. The approved UX requires a dedicated full-page workspace with the four-stage header before workflow controls and review cards are wired.

## Files inspected
- docs/superpowers/plans/2026-09-01-corporate-action-ui-ux-modernization-implementation-plan.md
- src/RootApp.tsx
- src/store/uiStore.ts (Task 1 authority preserved; existing corporateActionOpen/open/close reused)
- src/features/corporateActions/corporateActionWorkflow.ts
- src/features/corporateActions/corporateActionEconomicEventViewModel.ts
- Task 1 authority CSV and reviewed worktree patch

## Files created
- src/features/corporateActions/workspace/CorporateActionWorkspace.tsx
- src/features/corporateActions/workspace/CorporateActionWorkflowHeader.tsx
- src/features/corporateActions/workspace/corporateActionWorkspace.css
- src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx
- docs/changes/2026-09-02_1057_IST_CORPORATE_ACTION_UI_UX_MODERNIZATION_TASK4_FULL_PAGE_WORKSPACE_SHELL_TDD.md

## Files modified
- src/RootApp.tsx

## Final implementation
- Added a dedicated fixed full-page Corporate Action workspace layer with existing application CSS variables.
- Added a four-stage header consuming activeStage and counts.
- Header marks previous stages complete, one stage current, and future stages locked.
- Added placeholder content only; no Fetch/Load/Review/Approve backend calls are introduced.
- RootApp keeps the chart workspace tree mounted and renders the Corporate Action workspace later as a sibling overlay.
- RootApp suppresses the legacy Corporate Action dialog composition while corporateActionOpen is true.
- Existing uiStore corporateActionOpen/openCorporateAction/closeCorporateAction behavior is reused unchanged.
- RootApp placeholder integration starts at Fetch with zero counts until a later task wires persisted workflow facts.
- No router was introduced.

## Task 1 preservation
- Task 1 authority CSV SHA-256: C0337BFDB26734F141C36627803A60C58CA9DAFE53DADB0ECC33467735D06E12
- Task 1 reviewed patch SHA-256: 87FFAD2CAF632E38AD1EA881C215F46FE9883E2A26C642F48DFB5B80BF1D091E
- RootApp Task 1 live preimage SHA-256: AE36B18D5C225A049799C9226F5800D987466290B65F5CB9467D5CDE91A9AC00
- RootApp Task 4 post-patch SHA-256: AE36B18D5C225A049799C9226F5800D987466290B65F5CB9467D5CDE91A9AC00
- Untouched Task 1 authority files preserved: 36 / 36
- Pre-existing Task 1 drifts outside authorized RootApp host edit preserved.

## Task 2 / Task 3 preservation
- Task 2 workflow model SHA-256: 1C1E9E584EA5E8BF90FDC886CC7C3E8645F7D29E39C9E6E6AA1EE0B7C535AD23
- Task 2 workflow test SHA-256: 0EF337A3650ECB57CE0353DA7B21C1C91B9D0B072051A0669601549C441F47F3
- Task 3 economic-event model SHA-256: 8D10D62C40F00D9C484E372D3DE43D02E3C5CC3018995C042A77892F96D7B814
- Task 3 economic-event test SHA-256: C642370878046EC03DE0ADBFC93B7670410DC8957A666D697FF3A6CEB2001A4C

## Validation commands
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx (RED before shell exists)
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx (GREEN)
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionEventIdentityPresentation.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionIdentityRecommendations.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionValidation.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionWorkflow.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionEconomicEventViewModel.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx
- npm.cmd run typecheck:renderer
- npm.cmd run build:renderer

## Actual validation results
- TDD RED exit code: 1
- Focused GREEN: NOT PASS
- Exact CA regression files executed: 0 / 8
- Exact CA regression tests proven: 0 / 58
- Renderer typecheck: NOT PASS
- Renderer build: NOT PASS
- Manual 100/125/150 percent Windows scaling: PENDING_USER_MANUAL_CHECK_100_125_150_PERCENT
- Failure: ROOTAPP_PATCH_TOKEN_NOT_FOUND_SUPPRESS_LEGACY_CA_DIALOG
- Classification: CORPORATE_ACTION_UI_UX_MODERNIZATION_TASK4_BLOCKED__TASK5_NOT_AUTHORIZED

## Behaviour deliberately preserved
The existing chart workspace remains mounted under the full-page Corporate Action layer; no chart tab/sheet recreation path is introduced. uiStore, workspaceStore, DatabaseToolsDialogs, backend/Rust, bridge APIs, database behavior, Task 2 workflow semantics, Task 3 event grouping semantics, V1.14AD Corporate Action engine behavior, and raw EOD behavior are untouched.

## Risks or limitations
- The RootApp integration intentionally supplies activeStage=fetch and zero counts as shell placeholders; later workflow wiring must replace those placeholders without changing the shell ownership model.
- The automated test proves chart store object identity and host composition, but Windows 100/125/150 percent visual readability remains a required manual checkpoint.
- The old CorporateActionDialog remains in DatabaseToolsDialogs for Advanced Maintenance migration work later; RootApp does not mount that dialog while the dedicated Corporate Action workspace is open.

## Rollback guidance
Restore src/RootApp.tsx from the byte-exact pre-Task4 copy in the external Task 4 audit directory, then delete the three workspace files and focused test. No uiStore, database, backend, Task 2, Task 3, Git index/history, or other Task 1 drift rollback is required.

## Next step
Perform the required manual readability/restoration checkpoint at 100%, 125%, and 150% Windows scaling. Task 5 remains not authorized.
