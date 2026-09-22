# Corporate Action UI/UX Reconstruction — Task 5B Controlled Legacy Import Boundary Extraction

## IST timestamp
2026-09-02 15:34:04.541 IST

## Objective
Extract only the existing Official Imports fetch/load orchestration needed by Task 5C into a shared feature boundary while preserving legacy behavior exactly.

## Previous defect or limitation
DatabaseToolsDialogs.tsx directly owned official fetch, review reload, and approved Split/Bonus validation evidence batching. Task 5C needs those established operations behind a reusable boundary without duplicating the engine or moving Maintenance-only behavior.

## Files inspected
- src\components\DatabaseToolsDialogs.tsx
- Task 5A certified preservation matrix and corrected Task 5A report
- Task 2 workflow and Task 3 economic-event model
- Task 4 workspace host files
- platform DesktopApi types and Corporate Action import/fetch/scan contracts

## Files created
- src\features\corporateActions\legacy\corporateActionImportOperations.ts
- src\features\corporateActions\__tests__\corporateActionLegacyImportOperations.characterization.test.ts
- src\features\corporateActions\__tests__\corporateActionLegacyImportOperations.test.ts
- docs\changes\2026-09-02_1534_IST_CORPORATE_ACTION_UI_UX_RECONSTRUCTION_TASK5B_CONTROLLED_LEGACY_IMPORT_BOUNDARY_EXTRACTION.md

## Files modified
- src\components\DatabaseToolsDialogs.tsx
- docs\superpowers\specs\2026-09-02-corporate-action-capability-preservation-matrix.md — migration metadata only for IMP-006, IMP-007, FET-004

## Final implementation
- loadCorporateActionImportRows owns the existing listCorporateActionImports call and the approved-only Split/Bonus validation evidence batching at the unchanged 500-ID batch size.
- fetchOfficialCorporateActionsAndReload owns the existing fetchOfficialCorporateActions then listCorporateActionImports sequence.
- The legacy dialog still owns all UI state, exact user-visible status text, progress state, mergeOfficialValidationRows, selection state, filters, and error presentation.
- No Maintenance-only identity repair, historical backfill, scan, exception, CSV, source-setting, or approval handler was extracted.
- NOR-001 routine Fetch Latest Data remains LEGACY_ONLY for Task 5C; this task does not wire the new normal workspace.

## Behaviour deliberately preserved
- Review/Approved list filtering and exact no-auto-approval language.
- Approved view validation evidence loads only for Split/Bonus IDs and retains 500-ID batching and result order.
- Official fetch occurs before review reload and failures propagate to the legacy catch path without a reload after failed fetch.
- Existing backend/Rust, database, Task 2, Task 3, Task 4, approval, identity, dedupe, compound, validation, provenance and exception behavior is unchanged.

## Validation commands
- characterization baseline: npm.cmd test -- src/features/corporateActions/__tests__/corporateActionLegacyImportOperations.characterization.test.ts
- TDD RED then GREEN: npm.cmd test -- src/features/corporateActions/__tests__/corporateActionLegacyImportOperations.test.ts
- exact ten Corporate Action regression files through canonical npm test script
- npm.cmd run typecheck:renderer
- npm.cmd run build:renderer

## Actual validation results
- Characterization baseline: PASS — 1 file / 3 tests
- TDD RED: PASS — missing shared module produced the expected failure
- Focused GREEN: PASS — 1 file / 4 tests
- Corporate Action regressions: PASS — 10 files / 65 tests
- Renderer typecheck: PASS
- Renderer build: PASS
- Exact source delta: PASS — 4 paths only
- Backend source / package config / live DB family / HEAD / tree / index / staged set: unchanged
- Matrix postimage SHA-256: 563D8F1C359DE2B63C052B096521D28524E26E19F20A23C855B23BF9922E5131

## Risks or limitations
This is an extraction boundary, not the Task 5C workflow adapter. The normal workspace remains unwired to the shared operations. The extracted API surface intentionally remains narrow and still relies on existing upstream list/fetch inputs supplied by the caller.

## Rollback guidance
Restore src\components\DatabaseToolsDialogs.tsx from the Task 5B before-evidence copy, delete the three additive Task 5B source/test files, and restore the matrix before-evidence copy. No backend, database, package, Task 2, Task 3, or Task 4 rollback is required.

## Next step
STOP. Task 5C is not authorized until this Task 5B evidence is reviewed.
