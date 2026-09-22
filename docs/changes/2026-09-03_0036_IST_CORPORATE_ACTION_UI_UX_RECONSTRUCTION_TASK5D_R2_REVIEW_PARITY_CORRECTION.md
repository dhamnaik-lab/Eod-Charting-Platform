# Corporate Action UI/UX Reconstruction — Task 5D R2 Review Parity Correction

## IST timestamp
2026-09-03 00:36:27.251 IST

## Objective
Close the three independently identified Task 5D Review parity gaps only: IMP-020 ISIN search, IMP-021 Current-chart Review filtering, and evidence-row status-reason presentation.

## Previous defect or limitation
- Normal Review search omitted both raw import ISIN and authoritative event ISIN.
- The NORMAL_WORKFLOW Current-chart Review filter capability remained legacy-only.
- Evidence rows carried statusReason but the drawer did not render it.

## Files inspected first
- Certified Task 5D Review workspace/controller/tests and successful evidence package.
- Task 5D capability-matrix before/after authority.
- Legacy applyCurrentSymbolFilter and renderSearchBar behavior.
- Chart-store active-tab/instrument authority.

## Files created
- src\features\corporateActions\__tests__\corporateActionReviewParityR2.test.tsx
- This change report.

## Files modified
- src\features\corporateActions\workspace\CorporateActionReviewWorkspace.tsx
- src\features\corporateActions\workspace\CorporateActionNormalWorkflowWorkspace.tsx
- src\features\corporateActions\workspace\corporateActionWorkspace.css
- docs\superpowers\specs\2026-09-02-corporate-action-capability-preservation-matrix.md — exact IMP-020 / IMP-021 metadata only.

## Final implementation
- Review search now includes raw import ISIN and authoritative event-time ISIN while preserving existing symbol/company/action/date/source matching.
- Review exposes CURRENT, populated from the existing active chart symbol supplied by chart-store state; no new identity or backend mechanism is introduced.
- Evidence drawer renders each evidence row's existing statusReason.
- Existing read-only exception boundary and Task 5E approval block are unchanged.

## Behaviour deliberately preserved
- Task 5D adapter and all original Task 5D tests are byte-preserved.
- Task 5C Fetch/Load, Task 2 workflow, Task 3 event grouping, Task 5B shared import boundary, backend identity/dedupe/compound/price/approval semantics are unchanged.
- No approval, quick resolution, controlled override, backend, Rust or database behavior is added.
- Normal Review remains mixed-exchange and CURRENT populates the search with the active chart symbol, matching the preserved business capability without reintroducing a technical exchange selector.

## Validation commands and actual results
- Task 5D baseline: PASS — 3 files / 13 tests.
- R2 focused TDD: expected RED — 4/4 defect tests; GREEN — 4/4.
- Original Task 5D regression authority: PASS — 14 files / 86 tests.
- npm.cmd run typecheck:renderer: PASS.
- npm.cmd run build:renderer: PASS.
- Exact source delta: PASS — 4 frontend paths only.
- Matrix delta: PASS — IMP-020 and IMP-021 only.
- Adapter/Task2/Task3/Task5B/backend/package config/live DB/HEAD/tree/index/staged set: unchanged.

## Risks or limitations
- CURRENT is intentionally symbol-based because Normal Review combines routine NSE+BSE acquisition and exposes no technical exchange selector.
- Review facts remain session-local as documented by Task 5D.
- Task 5E approval behavior remains unimplemented and unauthorized.

## Rollback guidance
Restore the three modified Task 5D source files and matrix preimage from this evidence package, then delete the additive R2 focused test file. No backend, database or Git-history rollback is required.

## Next step
STOP. Task 5E remains unauthorized until independent Task 5D R2 review closes Task 5D.
