# Corporate Action UI/UX Modernization — Task 4 R1B Full-Page Workspace Shell Continuation

## IST timestamp
2026-09-02 11:16:52.521 IST

## Objective
Resume Task 4 from the valid R1A missing-shell RED evidence, correct the RootApp host-integration contract to preserve Quote Editor ownership, and complete the automated shell validation without repeating the original missing-shell RED.

## Previous defect or limitation
R1A correctly recorded the missing-shell RED and wrote the three shell files plus focused test. Its RootApp patch harness then blocked before writing RootApp because it expected an older databaseToolsDialogOpen expression that omitted quoteEditorOpen. The exact Task 1 live RootApp authority contains quoteEditorOpen || mergeSymbolsOpen || corporateActionOpen || binaryEodParityOpen.

## Files inspected
- Task 1 authority CSV and reviewed worktree patch
- src/RootApp.tsx exact Task 1 preimage
- R1A RED log and evidence ZIP
- src/features/corporateActions/workspace/CorporateActionWorkspace.tsx
- src/features/corporateActions/workspace/CorporateActionWorkflowHeader.tsx
- src/features/corporateActions/workspace/corporateActionWorkspace.css
- src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx
- src/features/corporateActions/corporateActionWorkflow.ts and focused test
- src/features/corporateActions/corporateActionEconomicEventViewModel.ts and focused test

## Files created
- docs/changes/2026-09-02_1116_IST_CORPORATE_ACTION_UI_UX_MODERNIZATION_TASK4_FULL_PAGE_WORKSPACE_SHELL_TDD_R1B_CONTINUATION.md

## Files modified
- src/RootApp.tsx
- src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx — expectation corrected only to preserve quoteEditorOpen in the host contract

## Final implementation
- Preserves the R1A workspace/header/CSS files byte-for-byte.
- Preserves the R1A missing-shell RED as historical TDD evidence.
- Adds a fresh R1B host-integration RED after correcting the test to require quoteEditorOpen preservation and before writing RootApp.
- RootApp renders the Corporate Action workspace as a sibling layer after the existing chart workspace, so chart tabs and sheets remain mounted.
- RootApp suppresses the legacy Corporate Action dialog while the dedicated workspace is open.
- RootApp preserves Quote Editor, Merge Symbols, and Binary EOD Parity ownership in DatabaseTools dialogs whenever the Corporate Action workspace is closed.
- Reuses existing corporateActionOpen and closeCorporateAction state without changing uiStore.
- Supplies only Task 4 shell placeholders: activeStage=fetch and zero counts.
- No router, Fetch/Load/Review/Approve backend wiring, Rust, bridge, database, or approval-engine change is introduced.

## Preservation authority
- Task 1 authority CSV SHA-256: C0337BFDB26734F141C36627803A60C58CA9DAFE53DADB0ECC33467735D06E12
- Task 1 reviewed patch SHA-256: 87FFAD2CAF632E38AD1EA881C215F46FE9883E2A26C642F48DFB5B80BF1D091E
- Task 1 authority files: 37
- Task 1 pre-existing drifts: 12
- RootApp Task 1 preimage SHA-256: AE36B18D5C225A049799C9226F5800D987466290B65F5CB9467D5CDE91A9AC00
- RootApp Task 4 post-patch SHA-256: 03336EA05F89D0D92FCE38DAF189E1E458A866F7568E3FAAE59C8E6A554DE172
- Task 2 evidence ZIP SHA-256: 475C3AAD679E3B7EF82548DA1B7050D1199174DA376C7245541B8AA10D4DF638
- Task 2 workflow model SHA-256: 1C1E9E584EA5E8BF90FDC886CC7C3E8645F7D29E39C9E6E6AA1EE0B7C535AD23
- Task 2 workflow test SHA-256: 0EF337A3650ECB57CE0353DA7B21C1C91B9D0B072051A0669601549C441F47F3
- Task 3 evidence ZIP SHA-256: 33B51BC26EDFEABE8CD23F23F333DBCF9FDB8C4B521C67A6B3D7523C8DE9415E
- Task 3 economic-event model SHA-256: 8D10D62C40F00D9C484E372D3DE43D02E3C5CC3018995C042A77892F96D7B814
- Task 3 economic-event test SHA-256: C642370878046EC03DE0ADBFC93B7670410DC8957A666D697FF3A6CEB2001A4C
- R1A evidence ZIP SHA-256: DC6492F38ABB05741A13DD524567D97A27E875221E58853E0E788AFA850C5F31
- Workspace SHA-256: B0F010C3F9768207E2AA86027A10E4074F4E2B6430F095009E448ED8150198F3
- Header SHA-256: 7520F51DE7626F25A1205EA0775D8347B60C203ACCD85A21CE8946645E2E3516
- CSS SHA-256: 0BEC7D4CA18E0E6DA3348A48712087B9E4FF6D4FEA80BBFEC3F3CD07AD21B3E7
- Corrected R1B focused test SHA-256: 2B3538F92AC700DCF946C48D5E846EDFB1BFE9FFA8F6ADF197B705F6717F657C

## Validation commands
- R1A historical RED log validation
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx (fresh host-integration RED before RootApp patch)
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx (GREEN after RootApp patch)
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
- R1A missing-shell RED evidence: PASS
- R1B corrected host RED: PASS — corrected host integration RED recorded
- Focused GREEN: PASS — 1 file / 2 tests
- Exact CA regression files executed: 8 / 8
- Exact CA regression tests proven: 58 / 58
- Renderer typecheck: PASS
- Renderer build: PASS
- Manual 100/125/150 percent Windows scaling: PENDING
- Failure: 
- Classification: CORPORATE_ACTION_UI_UX_MODERNIZATION_TASK4_AUTOMATED_VALIDATION_PASSED__QUOTE_EDITOR_PRESERVED__MANUAL_SCALE_CHECK_REQUIRED__TASK5_NOT_AUTHORIZED

## Behaviour deliberately preserved
The existing chart workspace remains mounted below the full-page Corporate Action layer. Quote Editor, Merge Symbols, Binary EOD Parity, uiStore, workspaceStore, DatabaseToolsDialogs, Task 2 workflow semantics, Task 3 event grouping semantics, backend/Rust, bridge APIs, database behavior, V1.14AD Corporate Action engine behavior, and raw EOD behavior remain unchanged except for the explicitly authorized RootApp host composition.

## Risks or limitations
- Task 4 still uses activeStage=fetch and zero counts; later workflow wiring must replace those placeholders without changing shell ownership.
- Automated tests prove chart-store object identity and host composition, but Windows 100/125/150 percent visual readability and visual restoration remain a required manual checkpoint.
- The legacy Corporate Action dialog code remains in DatabaseToolsDialogs for later Advanced Maintenance migration; it is not mounted while corporateActionOpen is true.

## Rollback guidance
Restore src/RootApp.tsx from RootApp.task1-preimage.tsx in this external audit directory and restore src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx from corporateActionWorkspace.r1a-preimage.test.tsx. The three R1A workspace files require no rollback for the R1B harness correction. No uiStore, database, backend, Task 2, Task 3, Git index/history, or other Task 1 drift rollback is required.

## Next step
Perform the manual readability/restoration checkpoint at 100%, 125%, and 150% Windows scaling. Task 5 remains not authorized.
