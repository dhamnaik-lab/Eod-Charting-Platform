# Corporate Action UI/UX Reconstruction — Task 5C Normal Fetch + Load Workflow Adapter

## IST timestamp
2026-09-02 17:34:13.848 IST

## Objective
Wire the approved normal-user Fetch Data and Load stages into the Task 4 full-page workspace through the certified Task 5B shared boundary and Task 2 workflow model.

## Previous defect or limitation
Task 4 still rendered hard-coded Fetch stage and zero counts. Task 5B extracted legacy load/fetch orchestration but deliberately did not route the normal workspace to it.

## Files created
- src\features\corporateActions\workflow\corporateActionNormalWorkflowAdapter.ts
- src\features\corporateActions\__tests__\corporateActionNormalWorkflowAdapter.test.ts
- src\features\corporateActions\workspace\CorporateActionNormalWorkflowWorkspace.tsx
- src\features\corporateActions\__tests__\corporateActionNormalWorkflowWorkspace.test.tsx
- docs\changes\2026-09-02_1734_IST_CORPORATE_ACTION_UI_UX_RECONSTRUCTION_TASK5C_NORMAL_FETCH_LOAD_WORKFLOW_ADAPTER.md

## Files modified
- src\RootApp.tsx
- src\features\corporateActions\workspace\CorporateActionWorkspace.tsx
- src\features\corporateActions\workspace\corporateActionWorkspace.css
- docs\superpowers\specs\2026-09-02-corporate-action-capability-preservation-matrix.md — Task 5C ownership metadata only for nine certified capability rows

## Final implementation
- FETCH LATEST DATA performs deterministic NSE then BSE routine acquisition for the legacy 90-day IST window through today, with force refresh disabled so existing saved coverage and duplicate protection remain authoritative.
- LOAD & PROCESS automatically expands the review queue in the same 1000-row increments as legacy Load More until the full queue is returned.
- Eligible parsed Split/Bonus rows use the existing runCorporateActionScan backend path in unchanged 500-ID batches.
- PENDING_ISIN_MISMATCH rows receive the existing strict resolution-hint read only check; no identity exception is approved automatically.
- Existing approval and price-validation helpers derive row-level Ready, Needs Review and Conflict counts only. Task 5D remains responsible for authoritative economic-event grouping and the evidence drawer.
- Task 2 workflow facts drive Fetch retry, Load resume and Review handoff. Review remains deliberately non-interactive in this task.
- Existing Corporate Action progress events are surfaced in the normal workspace without backend changes.

## Behaviour deliberately preserved
- Task 5B shared import operations and legacy visible controls remain unchanged and continue to pass characterization.
- No quick resolution, manual mapping, ISIN exception approval, price exception approval, ordinary approval, CSV fallback, force refetch or Maintenance-only operation is exposed by the normal Task 5C workspace.
- Existing backend identity, equivalent-event dedupe, compound factor/fingerprint, price validation, approval eligibility, idempotency and provenance algorithms are reused rather than reimplemented.
- No Rust/backend source or database behavior was changed.

## Validation commands
- Task 5B characterization baseline: npm.cmd test -- src/features/corporateActions/__tests__/corporateActionLegacyImportOperations.characterization.test.ts
- Task 5B shared-boundary baseline: npm.cmd test -- src/features/corporateActions/__tests__/corporateActionLegacyImportOperations.test.ts
- Adapter RED then GREEN: npm.cmd test -- src/features/corporateActions/__tests__/corporateActionNormalWorkflowAdapter.test.ts
- Managed-workspace RED then GREEN: npm.cmd test -- src/features/corporateActions/__tests__/corporateActionNormalWorkflowWorkspace.test.tsx
- Exact twelve Corporate Action regression files through npm test -- <file>
- npm.cmd run typecheck:renderer
- npm.cmd run build:renderer

## Actual validation results
- Task 5B baseline: PASS — 2 files / 7 tests
- Adapter TDD: PASS — expected missing-module RED, then 1 file / 8 tests GREEN
- Workspace TDD: PASS — expected missing-controller RED, then 1 file / 3 tests GREEN
- Corporate Action regressions: PASS — 12 files / 76 tests
- Renderer typecheck: PASS
- Renderer build: PASS
- Exact source delta: PASS — 7 frontend paths only
- Matrix delta: PASS — exact 9 capability rows
- Backend/package config/live DB/HEAD/tree/index/staged set: unchanged

## Risks or limitations
Task 5C intentionally stops at the Review handoff. Counts are still row-level because Task 5D owns authoritative grouped economic-event presentation. The Task 2 facts are session-local in this slice; process-restart persistence is not introduced because that would require a separate persistence authority and is outside this database-behavior-preserving task.

## Rollback guidance
Restore RootApp, CorporateActionWorkspace and its CSS from this Task 5C evidence package, delete the four additive Task 5C source/test files, and restore the Task 5B matrix preimage. No Task 5B shared-boundary, backend, database, Task 2, Task 3 or legacy Corporate Action rollback is required.

## Next step
STOP. Task 5D is not authorized until Task 5C evidence is independently reviewed.
