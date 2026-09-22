# Corporate Action UI/UX Reconstruction — Task 5D Review + Evidence Drawer

## IST timestamp
2026-09-02 20:07:31.637 IST

## Objective
Implement only the Normal-workflow Review stage: authoritative grouped economic-event cards, exception-first presentation, read-only evidence drawer, and Review checkpoint handoff to the accepted Task 2 Approve stage.

## Previous defect or limitation
Task 5C stopped after Load and deliberately rendered a Review placeholder. The accepted Task 3 economic-event model was present but not supplied with live normal-workflow evidence.

## Files inspected first
- Task 5C certified normal adapter/controller/workspace/test and matrix authority.
- Task 2 workflow model/test.
- Task 3 economic-event model/test.
- Task 5B shared import boundary.
- Existing Corporate Action validation, compound price presentation, event-identity presentation, platform API and legacy Review behavior.

## Files created
- src\features\corporateActions\__tests__\corporateActionNormalReviewAdapter.test.ts
- src\features\corporateActions\workspace\CorporateActionReviewWorkspace.tsx
- src\features\corporateActions\__tests__\corporateActionReviewWorkspace.test.tsx
- This change report.

## Files modified
- src\features\corporateActions\workflow\corporateActionNormalWorkflowAdapter.ts
- src\features\corporateActions\workspace\CorporateActionNormalWorkflowWorkspace.tsx
- src\features\corporateActions\__tests__\corporateActionNormalWorkflowWorkspace.test.tsx
- src\features\corporateActions\workspace\corporateActionWorkspace.css
- docs\superpowers\specs\2026-09-02-corporate-action-capability-preservation-matrix.md — Task 5D ownership metadata only for exact seven certified capability rows.

## Final implementation
- Loads existing event-time identity evidence in unchanged 500-ID read-only batches.
- Uses backend compound-validation fingerprints for compound event keys and per-import identity for ordinary already-deduped imports; no symbol/date grouping heuristic is introduced.
- Maps existing approval and price-validation states into Task 2 event statuses and feeds the accepted Task 3 economic-event model.
- Preserves all import/evidence rows for the drawer, including source provenance, identity evidence, scan evidence and existing price-validation presentation.
- Renders Needs Review and Conflict events before Ready/routine events, with lightweight normal Review search and status filtering.
- Keeps identity, price and specialist exceptions read-only and explicitly reserved for future Corporate Action Maintenance reconstruction.
- Review completion updates only Task 2 checkpoint facts and moves Ready events to the existing Approve stage. No approval API is executed by Task 5D.

## Behaviour deliberately preserved
- Task 5C Fetch and Load behavior is unchanged.
- Task 5B shared import boundary and legacy Review/Maintenance controls are unchanged.
- Task 2 workflow and Task 3 economic-event model are byte-preserved.
- Existing identity authority, equivalent-event dedupe, compound fingerprint/factor logic, price-validation math, approval eligibility/idempotency and provenance algorithms are not reimplemented.
- No Rust/backend source or database behavior is changed.
- No quick resolution, manual mapping, ISIN exception, price exception or approval execution is exposed by the Normal Review workspace.

## Validation commands and actual results
- Task 3 event-model baseline: PASS — 12 tests.
- Task 2 workflow baseline: PASS — 12 tests.
- Task 5C adapter baseline: PASS — 8 tests.
- Task 5C workspace baseline: PASS — 3 tests.
- Review adapter TDD: expected RED, then PASS — 6 tests.
- Review workspace TDD: expected RED, then PASS — 4 tests.
- Review controller TDD: expected RED, then PASS — 3 tests.
- Corporate Action regressions: PASS — 14 files / 86 tests.
- npm.cmd run typecheck:renderer: PASS.
- npm.cmd run build:renderer: PASS.
- Exact source delta: PASS — 7 frontend paths only.
- Matrix delta: PASS — exact 7 capability rows: IMP-001, IMP-004, IMP-020, AUTO-003, AUTO-007, AUTO-008, AUTO-009.
- Backend/package config/live DB/HEAD/tree/index/staged set: unchanged.

## Risks or limitations
- Review facts remain session-local because persistence authority is outside this task.
- A Review cycle with zero Ready events remains on Review; specialist exceptions require future Maintenance handling or a later explicit cycle-completion policy.
- Task 5D does not implement approval execution, partial approval recovery or authoritative approval recheck UX; those remain Task 5E.

## Rollback guidance
Restore the four modified Task 5C source/test files and the Task 5C matrix preimage from this evidence package, then delete the three additive Task 5D source/test files. No Task 5B, Task 2, Task 3, backend, database or Git-history rollback is required.

## Next step
STOP. Task 5E is not authorized until this Task 5D evidence is independently reviewed.
