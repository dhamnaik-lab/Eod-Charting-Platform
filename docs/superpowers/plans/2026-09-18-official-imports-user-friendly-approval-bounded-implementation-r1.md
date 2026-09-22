# Official Imports User-Friendly Approval — Bounded Implementation Plan R1

> For agentic workers: read the approved scope and exact source authority first. Execute this single bounded issue with internal RED→GREEN checkpoints; no Git/worktree/commit activity is authorized. Stop only for an actual scope/authority/safety blocker, not for each routine internal checkpoint.

**Prepared:** 2026-09-18 17:56:20 IST (UTC+05:30)  
**Goal:** automate permitted preparation and simplify pending approvals in the existing Official Imports tab.  
**Architecture:** preserve CorporateActionDialog, current backend owners, and platform APIs. Add only a small preparation coordinator and presentation-only grouping as needed; no replacement workspace or approval store.  
**Tech stack:** current snapshot React/TypeScript frontend; existing Tauri/Rust API unchanged. Do not upgrade dependencies.  
**Spec:** `docs/superpowers/specs/2026-09-18-official-imports-user-friendly-approval-approved-scope-r1.md`  
**Source:** `Eod Charting Platform Source Code 2026-09-18_140123_IST.zip` / `0EF8966CD8F4C29DAE0F032372322B88827FF44985968688AE1C4BFA6897666F` / 548 protected source files.  
**Authorized root:** `E:\TA Projects\EOD Charting Platform`.

## Start gate / file map

First read AGENTS.md and HANDOFF.md for boundaries, then the current override in docs/CURRENT_WORK_STATUS.md and the approved scope. Older handoffs and reconstruction documents are historical, not a reason to reactivate that design.

Read these active owners before any edit:

| File | Role / intended treatment |
|---|---|
| `src/components/DatabaseToolsDialogs.tsx` | Modify only Official Imports preparation, pending list, selection/confirmation integration; preserve sibling tabs and shared semantics. |
| `src/features/corporateActions/legacy/corporateActionImportOperations.ts` | Retain exported loader/fetch signatures. Extend by a small testable preparation helper, or create the optional file below rather than alter shared behavior. |
| `src/features/corporateActions/corporateActionValidation.ts` | Read-only policy owner: isSplitOrBonus, isCorporateActionScanCurrent, getCorporateActionApprovalState. |
| `src/features/corporateActions/corporateActionBulkApproval.ts` | Reuse selectCorporateActionApprovalTargetRows and chunkCorporateActionApprovalIds; no batch limit or approval-policy change. |
| `src/features/corporateActions/corporateActionIdentityRecommendations.ts` | Reuse bounded hint/recommendation batching. |
| `src/features/corporateActions/corporateActionEventIdentityPresentation.ts` | Preserve resolved event identity presentation/evidence. |
| `src/types/desktop.ts`, `src/platform/types.ts` | Read actual type/API declarations; no contract changes. |
| `src/features/corporateActions/__tests__/corporateActionExistingWorkflowRecovery.test.ts` | Preserve sole active existing workflow. |
| `src/features/corporateActions/__tests__/corporateActionLegacyImportOperations*.test.ts` | Preserve old helper behavior; do not update existing tests to mask changed legacy semantics. |

Optional new helper paths, only if needed for isolation: `src/features/corporateActions/legacy/corporateActionPendingPreparation.ts` and `src/features/corporateActions/corporateActionPendingGroups.ts`. New tests: `src/features/corporateActions/__tests__/corporateActionPendingPreparation.test.ts`, `corporateActionPendingGroups.test.ts`, and `corporateActionOfficialApprovalUx.test.tsx` in that same test directory. Proposed paths are not pre-existing files.

No RootApp/routing rewire, new database/schema, new IPC command, or whole-dialog split. Do not use frontend-created business rules to replace the backend. Any additional production file must have a direct necessity tied to this scope; no speculative cleanup.

## Internal checkpoint A — exact baseline and behavioral RED

1. Verify the parent ZIP hash plus installed 548-file source manifest and support-file hashes. Require the new approved docs and current-status override from this documentation installation. Stop on unexplained drift. Do not blindly re-copy the full snapshot over the working project.
2. Use a small isolated source sandbox. Copy only allowed source/config/resources/docs; do not recursively copy repo databases, tmp, node_modules, target, dist, release, or nested sandboxes. Reuse installed dependencies without modifying their contents. No unnecessary network retrieval.
3. Create executable mock-API tests for the agreed behavior before the new helper/integration. Capture actual assertion failures, not Unicode title markers, compile errors, or a mere non-zero command exit. Keep all stdout/stderr and structured results.

Required cases (fixture records must use actual CorporateActionImportRow contracts):

| Scenario | Observable assertion |
|---|---|
| Two full pages plus final short page, duplicate row ID | All distinct pending IDs loaded once; limit/offset advances; no fetch or approval invoked by Load. |
| Exact repeated page or offset boundary | Incomplete result; no Apply enabled; no infinite loop or truncated "all" claim. |
| Unresolved row with strict quickResolvable / ONE_ACTIVE / event-date evidence | Only existing quickResolveCorporateActionImport called; refreshed returned row used for subsequent checks. |
| Ambiguous or evidence-missing row | No quick resolution and no manual-reason fabrication. |
| Parsed split/bonus and ordinary dividend | Existing scan requested only for eligible validation targets; dividend does not become dependent on an unnecessary split scan. |
| Hint/scan failure on one batch | Failed rows identified and blocked; no silently inherited old READY state. |
| PENDING_ISIN_MISMATCH recommendation | Hints loaded; approveRecommendedCorporateActionIsinMismatches and all exceptional approve commands have zero calls during preparation. |
| Context changes while awaiting response | Late result not published; no next operation submitted; confirmation invalidated. |
| Symbol groups with same symbol on different exchanges | Separate groups; expanded/collapsed status never changes record IDs or eligibility. |
| Apply selected with hidden/unready checked rows | Only visible-filter eligible checked IDs sent; no approval on cancel. |
| 205 ready actions / failure in middle batch | Requests use existing <=100 batches; successes not replayed; residual failures stay pending; totals are honest. |

## Internal checkpoint B — minimal preparation implementation

Use the existing `listCorporateActionImports` limit/offset API to complete the pending enumeration before any resolution changes sort/filter membership. Default `excludeApproved: true`, no latest-fetch restriction. All action types remain available; presentation filtering does not trigger scans. Select a bounded page size within the backend's current 25–10,000 range and guard the 1,000,000 offset clamp and no-progress case.

Coordinate one preparation generation with one active database context. Resolve only strict backend-authorized unresolved IDs, through `quickResolveCorporateActionImport`. Use `listCorporateActionImportResolutionHints`, `runCorporateActionScan({ scope: 'official_imports', importIds })`, and existing row/evidence readers; no direct invoke/SQL outside the platform API. Read the backend quick-resolve and ordinary-approval contracts before wiring the new sequence.

Retain existing helper signatures for callers outside this new pending path. Do not call several component handlers that independently reset busy/status in a loop; the coordinator should own the whole operation and publish a final result plus progress/error details. Changes remain frontend-local; no durable workflow engine.

Run the new focused tests until GREEN. Re-run legacy helper characterization and validation/identity-recommendation tests to show preservation, not merely new behavior.

## Internal checkpoint C — pending list and explicit approval

Integrate Load & Prepare into the existing Review view. Use expandable symbol groups with stable child import IDs and a compact status. Keep Approved/history and contextual Details/exception operations. The two ordinary actions remain Apply All Ready / Apply Selected, each with count and explicit current filter scope.

Reuse existing selected/all-ready target semantics. Confirmation captures IDs and material reviewed fields. At Apply, refresh/recheck; changed material fields invalidate review instead of silently applying updated data. No grant of ISIN/price exceptions inside ordinary Apply. Preserve onRefresh/onReloadInstrument behavior after approved records. Retain history, raw evidence and all non-Official-Imports tabs.

Run interaction tests with mocked APIs to prove click -> preparation -> no hidden approval; expand -> no selection; checkbox -> exact IDs; confirmation cancel -> zero mutations. Static source-text tests remain supplements, not primary proof.

## Internal checkpoint D — final automated verification once stable

Use existing locally installed tools and the verified configuration. Commands below are validation expectations, not results already obtained:

```powershell
# From a verified small candidate sandbox; no live database/network.
node "E:\TA Projects\EOD Charting Platform\node_modules\vitest\vitest.mjs" run --exclude 'tmp/**' src/features/corporateActions/__tests__/corporateActionPendingPreparation.test.ts src/features/corporateActions/__tests__/corporateActionPendingGroups.test.ts src/features/corporateActions/__tests__/corporateActionOfficialApprovalUx.test.tsx
node "E:\TA Projects\EOD Charting Platform\node_modules\vitest\vitest.mjs" run --exclude 'tmp/**' src/features/corporateActions src/features/identityRecovery
node "E:\TA Projects\EOD Charting Platform\node_modules\vitest\vitest.mjs" run --exclude 'tmp/**'
node "E:\TA Projects\EOD Charting Platform\node_modules\typescript\bin\tsc" -p tsconfig.json --noEmit
node "E:\TA Projects\EOD Charting Platform\node_modules\vite\bin\vite.js" build
```

The runner must verify those existing local tool paths before invoking them. The working directory is the isolated candidate sandbox; the tool paths resolve back to the installed dependencies. Exclude historical/nested sandbox copies; verify test file inventory. Run serially, including frontend full regression only once the candidate stabilizes. No redundant Rust suite when Rust is unchanged. One portable Windows build remains necessary for manual UI acceptance.

Before real-source installation, independently compare the candidate's exact changed-file inventory, unchanged Rust/Identity/Gann/policy owners and result logs. Capture a bounded prechange backup. Fail/rollback on unexpected writes. No Git commands. Produce one full package and one standalone runner rather than a package for every internal checkpoint.

## Manual checkpoint / finish

Prepare one portable containing the validated candidate using the verified existing build/packaging system. Reuse known compatible Cargo cache where the build supports it; preserve current packaging path assumptions rather than guessing CARGO_TARGET_DIR. Build outputs/dependencies/evidence stay outside source-only directories except already verified build-metadata requirements, recorded explicitly.

Use only the declared TEST database, with a backup before manual writes. User verifies same flow in the real WebView2 window: fetch, Load & Prepare, older pending records visible, no unwanted auto-approval, responsive progress, symbol expansion, selective apply, all-ready within a filter, partial failure reporting, and unchanged sibling tabs. Also inspect light/dark layout, scroll reachability and active database label.

On pass create the implementation change record under `docs/changes/YYYY-MM-DD_HHMM_IST_CA_OFFICIAL_IMPORTS_USER_FRIENDLY_APPROVAL.md`, update the scoped current-status block, preserve full failure/success evidence before scratch cleanup, and prepare a fresh source snapshot for independent acceptance. Do not label complete if manual results fail.

## Stop / authorization boundaries

- Documentation stage: no source, DB, network, Git, tests, builds, or snapshot execution.
- Application implementation: authorized within this R1 once docs/source preflight succeeds; existing backend policies remain frozen.
- Automated validation: mocks/test-owned fixtures only; no operational or TEST user database opened by runners.
- Manual runtime acceptance: explicit operator activity on TEST, using the existing online fetch as needed; no ACTUAL-database tests.
- Missing backend capability, unsafe context isolation, changed exceptional approval semantics, or new architecture: stop and explain; do not widen the task.
- Identity Import UX follows separately after Official Imports closes; not an extra change inside this delivery.
