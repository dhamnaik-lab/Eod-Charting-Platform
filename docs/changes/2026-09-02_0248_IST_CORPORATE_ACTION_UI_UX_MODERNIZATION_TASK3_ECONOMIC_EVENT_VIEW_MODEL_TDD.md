# Corporate Action UI/UX Modernization — Implementation Task 3 Economic-Event View-Model TDD

## IST timestamp
2026-09-02 02:48:36.665 IST

## Objective
Implement only the pure grouped economic-event presentation/view-model layer for the approved Corporate Action Review experience.

## Previous defect or limitation
The existing normal-user presentation exposes source/import rows directly. The approved UX requires one understandable economic event per authoritative event key while preserving all underlying evidence rows and existing engine semantics.

## Files changed
- src/features/corporateActions/corporateActionEconomicEventViewModel.ts
- src/features/corporateActions/__tests__/corporateActionEconomicEventViewModel.test.ts
- docs/changes/2026-09-02_0248_IST_CORPORATE_ACTION_UI_UX_MODERNIZATION_TASK3_ECONOMIC_EVENT_VIEW_MODEL_TDD.md

## Final implementation
- Groups rows only by an authoritative eventKey supplied upstream; it never guesses identity from symbol/date.
- Preserves every underlying source row in evidence order by import ID.
- Collapses equivalent duplicate action rows into one user-facing component while retaining full evidence rows.
- Produces Split + Bonus compound action labels without multiplying factors in this new layer.
- Carries the existing validated CorporateActionPriceValidationPresentation through unchanged; no compound price math is duplicated.
- Reuses the accepted Task 2 CorporateActionEventStatus and READY approval-candidate rule.
- Fails closed on inconsistent status, identity presentation, duplicate-component factor, or supplied price presentation.
- Sorts Needs Review and Conflict cards before Ready and completed states.
- No React component, full-page workspace, bridge/API, Rust/backend, database, or approval-engine change is part of Task 3.

## Preservation authority
- Task 1 authority CSV SHA-256: C0337BFDB26734F141C36627803A60C58CA9DAFE53DADB0ECC33467735D06E12
- Task 1 reviewed patch SHA-256: 87FFAD2CAF632E38AD1EA881C215F46FE9883E2A26C642F48DFB5B80BF1D091E
- Task 1 authority files preserved: 37
- Pre-existing post-V1.14AD drifts preserved: 12
- Accepted Task 2 evidence ZIP SHA-256: 475C3AAD679E3B7EF82548DA1B7050D1199174DA376C7245541B8AA10D4DF638
- Task 2 workflow model SHA-256: 1C1E9E584EA5E8BF90FDC886CC7C3E8645F7D29E39C9E6E6AA1EE0B7C535AD23
- Task 2 workflow test SHA-256: 0EF337A3650ECB57CE0353DA7B21C1C91B9D0B072051A0669601549C441F47F3

## Validation commands
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionEconomicEventViewModel.test.ts (RED before model exists)
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionEconomicEventViewModel.test.ts (GREEN)
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionBulkApproval.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionEventIdentityPresentation.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionIdentityRecommendations.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionValidation.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionWorkflow.test.ts
- npm.cmd test -- src/features/corporateActions/__tests__/corporateActionEconomicEventViewModel.test.ts
- npm.cmd run typecheck:renderer

## Actual validation results
- TDD RED exit code: 1
- Focused GREEN: PASS — 1 file / 12 tests
- Exact CA regression files executed: 7 / 7
- Exact CA regression tests proven: 56 / 56
- Renderer typecheck: PASS
- Failure: 
- Classification: CORPORATE_ACTION_UI_UX_MODERNIZATION_TASK3_ECONOMIC_EVENT_VIEW_MODEL_TDD_PASSED__TASK4_NOT_AUTHORIZED

## Behaviour deliberately preserved
All 37 Task 1 live-source authority files remain byte-identical, including the 12 pre-existing drifts. The accepted Task 2 workflow model/test remain byte-identical. Existing V1.14AD identity, historical ISIN, equivalent-event dedupe, compound validation, price validation, fail-closed conflict handling, eligibility, batching, idempotency, provenance, raw EOD behavior, and database behavior are untouched.

## Risks or limitations
The new view model requires an authoritative eventKey and already-derived status/price presentation from a later adapter. It deliberately does not infer grouping from raw symbol/date, calculate compound factors, persist review history, render cards, or execute approvals. Those remain later tasks.

## Rollback guidance
Delete src/features/corporateActions/corporateActionEconomicEventViewModel.ts and src/features/corporateActions/__tests__/corporateActionEconomicEventViewModel.test.ts to remove Task 3 production/test behavior. Delete this report only if intentionally discarding Task 3 evidence. No database, Rust, bridge, Git history/index, Task 1 drift, or Task 2 rollback is required.

## Next step
STOP. Task 4 remains not authorized until this Task 3 evidence is reviewed.
