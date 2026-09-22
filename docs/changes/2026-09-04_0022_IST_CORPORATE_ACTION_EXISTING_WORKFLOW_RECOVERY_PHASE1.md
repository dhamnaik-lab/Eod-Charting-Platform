# Corporate Action Existing-Workflow Recovery Phase 1

## IST timestamp
2026-09-04 00:22:09.018 IST

## Objective
Restore the preserved working Corporate Action dialog as the active Corporate Actions / Identity experience while retaining newer reconstruction code only as donor/reference material.

## Previous defect or limitation
The active RootApp route had been redirected to the reconstructed Fetch -> Load -> Review -> Approve workflow, while the original working CorporateActionDialog capabilities remained present in DatabaseToolsDialogs.tsx but unreachable. A separate Maintenance entry also exposed a second competing Corporate Action surface.

## Files inspected first
- src/RootApp.tsx
- src/components/DatabaseToolsDialogs.tsx
- src/components/CommandPalette.tsx
- src/features/app/menuCommandRouter.ts
- src-tauri-shell/src/main.rs
- src/store/uiStore.ts
- src/features/corporateActions/legacy/corporateActionImportOperations.ts
- current reconstruction host tests
- Phase 0 R1C donor ZIP
- historical Before-CA-UX authority ZIP

## Files modified
Production:
- src\RootApp.tsx
- src\components\CommandPalette.tsx
- src\features\app\menuCommandRouter.ts
- src-tauri-shell\src\main.rs

Test contracts:
- src\features\corporateActions\__tests__\corporateActionWorkspace.test.tsx
- src\features\corporateActions\__tests__\corporateActionNormalWorkflowWorkspace.test.tsx
- src\features\corporateActions\__tests__\corporateActionMaintenanceNavigation.test.ts
- src\features\corporateActions\__tests__\corporateActionMaintenanceWorkspace.test.tsx
- src\features\corporateActions\__tests__\corporateActionManualCheckpointCorrection.test.tsx
- src\features\corporateActions\__tests__\corporateActionPostR1BIndependentWindowsFetch.test.ts

Created:
- src\features\corporateActions\__tests__\corporateActionExistingWorkflowRecovery.test.ts
- docs\changes\2026-09-04_0022_IST_CORPORATE_ACTION_EXISTING_WORKFLOW_RECOVERY_PHASE1.md

## Final implementation
- Corporate Actions / Identity now mounts the existing DatabaseToolsDialogs host, which exposes the preserved CorporateActionDialog.
- The reconstructed Normal workflow is no longer mounted by RootApp.
- The reconstructed Maintenance workspace is no longer mounted by RootApp.
- The separate Corporate Action Maintenance Command Palette, menu-router and native shell-menu entry is removed from active navigation.
- R1C reconstruction source remains present and byte-preserved as donor code.
- Current DatabaseToolsDialogs.tsx remains byte-identical to its Task 5B postimage: F96BBD084058C95BC019EA5D5F8B1AE56DA75614CE6265396996F707A27773C1.
- corporateActionImportOperations.ts remains byte-identical: 71AB68E06056B0A147AE6139D6CD327873B1116ED3B4BF6B85456F70E2721709.
- No backend Corporate Action business behavior was changed.
- No database was opened or inspected.

## Behaviour restored
The active Corporate Action surface returns to the preserved legacy capabilities:
- Manual Entry
- Identity Import
- Official Imports
- Scan Database
- Review Issues
- existing exchange/date/fetch/re-fetch/CSV/backfill/review functionality contained by that dialog

## Behaviour deliberately preserved
- Task 5B extracted legacy fetch/load operation boundary.
- Existing current Corporate Action backend and API semantics.
- R1C donor source for possible future selective reuse.
- uiStore R1C state remains present but is not actively exposed through a separate Maintenance entry.
- Package dependencies and lockfile.
- Git HEAD/tree/index/staged state.

## Validation performed and actual results
- Exact Phase 0/R1C source fingerprint preflight: PASS
- Phase 1 recovery contract TDD RED: PASS
- Phase 1 recovery contract GREEN: PASS
- Task 5B legacy characterization + behavior tests: PASS
- Rebased reconstruction-donor host contracts: PASS
- Full Corporate Action Vitest directory: PASS
- Renderer typecheck: PASS
- Renderer build: PASS
- Cargo check: PASS
- Portable Windows build: PASS
- DatabaseToolsDialogs preservation SHA: PASS
- corporateActionImportOperations preservation SHA: PASS
- Backend Rust source preservation except main.rs shell-menu removal: PASS
- package.json/package-lock.json preservation: PASS
- Git HEAD/tree/index/staged preservation: PASS
- SQLite access: NONE

## Final hashes
- RootApp.tsx: C9BEA99AA6C2192103169BEFD088CB339B9B06C215B49A2FB23A5BC06AB480A3
- CommandPalette.tsx: F73BAC8CFB0F9A3B985E1DC5FBDA93BD16DD192B8536EA9B4101766AE1BB178D
- menuCommandRouter.ts: 4CF8D74A4AA4CC6E19CAE7373D51C17A2868F5A619B3703D84F5C882F21543C5
- main.rs: 1785FBC94BA334ED0D03A19D490D5B1E446216A13C5C0F2BF682104D3A87BF75
- recovery test: 8A84F8E26080A2337878C9213F017EDCCC2B93CBE236CEFF0B8F1C9FAF2FF76D
- portable executable: D4E7E3EFA9A6E2CC663F22E145ABB2CD3B3487EB8B4F760AD0A01C8EBCB99808

## Risks / limitations
- This phase intentionally restores routing and navigation only; it does not redesign the old Corporate Action UI.
- Newer fetch log, last-success timestamp and other R1C presentation ideas are donor features only and are not merged into the old dialog in this phase.
- Manual runtime parity with a private/test database is still required before any incremental UX improvement.
- Display-scale validation remains deferred.
- Task 6B is not authorized.

## Rollback
Exact preimages for every modified production/test path are retained under:
E:\TA Projects\EOD Charting Platform Source Audit\CA_EXISTING_WORKFLOW_RECOVERY_PHASE1_2026-09-04_002209_IST\preimages

The complete R1C Corporate Action donor is frozen separately at:
E:\TA Projects\EOD Charting Platform Source Audit\CA_EXISTING_WORKFLOW_RECOVERY_PHASE0_2026-09-03_233615_IST\Current_R1C_CA_Donor_2026-09-03_233615_IST.zip
SHA-256: 0F55A69FD205B7F5C76372550B13B3ACC2B761FC8230EAE0CBDA2C6BA82FD094

## Next step
Run the portable application with the private/test database and verify the five original Corporate Action tabs/capability areas. Stop after parity review. Do not begin incremental improvement until the user supplies the first requested change.
