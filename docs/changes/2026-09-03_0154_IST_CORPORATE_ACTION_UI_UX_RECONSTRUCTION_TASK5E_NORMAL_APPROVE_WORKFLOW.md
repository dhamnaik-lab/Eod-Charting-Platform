# Corporate Action UI/UX Reconstruction — Task 5E Normal Approve Workflow

## IST timestamp
2026-09-03 01:54:42.508 IST

## Objective
Implement only the Normal Approve stage: authoritative pre-approval recheck, Approve All Ready, valid-subset handling, idempotent already-processed outcomes, partial resume, and cycle completion.

## Previous defect or limitation
Certified Task 5D R2 stopped at the Approve handoff and intentionally executed no approval API.

## Files changed
- src\features\corporateActions\workflow\corporateActionNormalWorkflowAdapter.ts
- src\features\corporateActions\workspace\CorporateActionNormalWorkflowWorkspace.tsx
- src\features\corporateActions\workspace\CorporateActionApproveWorkspace.tsx
- src\features\corporateActions\__tests__\corporateActionNormalApprovalAdapter.test.ts
- src\features\corporateActions\__tests__\corporateActionApproveWorkspace.test.tsx
- src\features\corporateActions\__tests__\corporateActionNormalApprovalWorkspace.test.ts
- docs\superpowers\specs\2026-09-02-corporate-action-capability-preservation-matrix.md — exact IMP-014 and AUTO-013 metadata only.

## Final implementation
- Rechecks the exact reviewed Ready import IDs against fresh normal queue/validation/economic-event evidence before approval.
- Detects reviewed IDs that are already APPROVED separately from rows that are no longer eligible.
- Submits only the currently valid Ready subset through existing chunkCorporateActionApprovalIds and approveCorporateActionImports 100-ID-safe batches.
- Preserves backend linked-existing, already-approved, per-row failure and savepoint/idempotency outcomes rather than reimplementing them.
- Stops subsequent batches on a command-level batch failure, then rechecks current state so successful prior batches and remaining Ready work are explicit.
- Maps post-recheck event Ready count to existing Task 2 processing/partial/complete approval facts.
- Normal UI exposes only Approve All Ready; selected approval, ISIN exception, price exception, quick resolution and manual mapping remain Maintenance-only.

## Behaviour deliberately preserved
- Certified Task 5D R2 Review workspace, Current filter, ISIN search, evidence drawer and focused R2 test are byte-preserved.
- Existing corporateActionBulkApproval helper and test are byte-preserved.
- Task 2 workflow model/test and Task 3 economic-event model are byte-preserved.
- Backend/Rust approval implementation, 100-item cap, item savepoints, equivalent-event linking and idempotency semantics are unchanged.
- No live database is mutated by implementation tests because all approval APIs are mocked.
- No Git staging or commit is performed.

## Validation commands and actual results
- Certified Review + approval semantics baseline: PASS — 6 files / 35 tests.
- Approval adapter TDD: expected RED, GREEN — 7 tests.
- Approve workspace TDD: expected RED, GREEN — 3 tests.
- Approve controller TDD: expected RED, GREEN — 3 tests.
- Task 5D R2 regression authority: PASS — 15 exact files / 90 tests.
- npm.cmd run typecheck:renderer: PASS.
- npm.cmd run build:renderer: PASS.
- Exact source delta: PASS — 6 frontend paths only.
- Matrix delta: PASS — IMP-014 and AUTO-013 only.
- Task 5D R2/bulk helper/Task2/Task3/backend/package config/live DB/HEAD/tree/index/staged set: unchanged.

## Final hashes
- Adapter: 7F909D7E026EB8F36DCD8D2A875EDF188C31C991D44A937CAF49E49407F601E9
- Controller: E2AEAF488D7A94C6BB7CD6F0B55F6598D43E8D7C98491CADD4A42B9D76FD2A5A
- Approve workspace: 3BCFD50E5766BA5A48B44E3276F0AE0C852957066B987FDD40B0007A0D0A1230
- Approval adapter test: DC4814C0DBBEE65E2EAE19546F07566E25DD12092E8405989509C45B146B17C2
- Approve workspace test: AACFC789AE2D5B60BB956561814AA9152BDB6975D1657CCF6F54A81695AEB5C5
- Approval controller test: D82A737716DB8BCEC3AE0791BF0087B79BA7929866C72D423937CDDC180EBF36
- Matrix: 4092563C0F271996BE9FC179472A352AEF87ECBF8BB491AF35A49867607137C5

## Risks or limitations
- Approval facts remain session-local, consistent with the existing accepted Task 2/Task 5D workflow boundary.
- Command-level batch failure stops later batches and requires the same Approve stage to resume remaining Ready work.
- Specialist controlled exceptions remain unavailable until the separately authorized Maintenance reconstruction.

## Rollback guidance
Restore the Task 5D R2 adapter/controller/matrix preimages from this evidence package and delete the four additive Task 5E source/test files. No backend, database or Git-history rollback is required.

## Next step
STOP. Task 6A is not authorized until independent Task 5E review closes this task.
