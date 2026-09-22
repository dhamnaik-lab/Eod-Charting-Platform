# Corporate Action UI/UX Modernization — Task 2 Workflow Model TDD R1B Canonical Test Harness

## IST timestamp
2026-09-02 01:57:24.147 IST

## Objective
Complete Task 2 validation without rewriting the already-green workflow model/test, correcting the R1/R1A validation harness to use the repository's canonical npm test hygiene.

## Previous defect or limitation
R1 and R1A invoked Vitest directly. This repository has an established test-discovery guard in package.json: vitest run --exclude tmp/**. Direct Vitest invocation bypassed that tmp/** exclusion, so stale test copies under tmp whose paths contain src/features/corporateActions were included in aggregate summaries. R1 therefore reported 19/125 for a six-file CA directory filter, and R1A could not prove a one-file summary for an explicit CA path.

## Files changed
- Production source/config in R1B: none.
- R1 model/test: unchanged.
- docs/changes/2026-09-02_0157_IST_CORPORATE_ACTION_UI_UX_MODERNIZATION_TASK2_WORKFLOW_MODEL_TDD_R1B_CANONICAL_TEST_HARNESS.md

## Final implementation
- R1 model SHA-256 preserved: 1C1E9E584EA5E8BF90FDC886CC7C3E8645F7D29E39C9E6E6AA1EE0B7C535AD23
- R1 test SHA-256 preserved: 0EF337A3650ECB57CE0353DA7B21C1C91B9D0B072051A0669601549C441F47F3
- R1 evidence ZIP SHA-256: 52733413B6C937ECCCC4473F049255FF87D78C0887329B80157CBA8AB1C91DEB
- R1A evidence ZIP SHA-256: D37F11CFB48DB337090FF27F0F56FD79F19F78CCC8B84DD8C9A0834803D03623
- Canonical test script: vitest run --exclude tmp/**
- Six exact CA test paths are executed individually through npm test -- <path>, preserving the repository tmp/** exclusion.
- Exact CA aggregate authority: 6 files / 44 tests.
- Renderer typecheck follows the corrected regression gate.

## Validation commands
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionEventIdentityPresentation.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionIdentityRecommendations.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionValidation.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionWorkflow.test.ts
- npm.cmd run typecheck:renderer

## Actual validation results
- Exact CA regression commands executed: 6 / 6
- Exact CA aggregate tests proven: 44 / 44
- Renderer typecheck: PASS
- Failure: 
- Classification: CORPORATE_ACTION_UI_UX_MODERNIZATION_TASK2_WORKFLOW_MODEL_TDD_PASSED__CANONICAL_TMP_EXCLUSION_REGRESSIONS_GREEN__TASK3_NOT_AUTHORIZED

## Behaviour deliberately preserved
All 37 Task 1 authority files remain byte-identical, including all 12 pre-existing post-V1.14AD drifts. Task 2 workflow model/test remain byte-identical to the R1 GREEN hashes. package.json and package-lock.json are read and hashed but not modified. V1.14AD CA engine/database/approval semantics and Git history/index are untouched.

## Risks or limitations
Task 2 remains a pure frontend workflow model. Workspace rendering, persisted facts, Fetch/Load orchestration, Review cards, evidence drawer, approval execution, backend changes, and database changes remain out of scope.

## Rollback guidance
R1B changes no production source/config. If Task 2 is intentionally discarded, remove the R1 workflow model/test and Task 2 reports separately.

## Next step
STOP. Task 3 remains not authorized until R1B evidence is independently reviewed.
