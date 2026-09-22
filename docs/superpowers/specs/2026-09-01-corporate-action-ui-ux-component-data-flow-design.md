# Corporate Action UI/UX Modernization — Component and Data-Flow Design

## 1. Architecture

Add a new workflow/presentation layer over the existing Corporate Action engine and desktop bridge.

```text
CorporateActionWorkspace
        │
        ├── useCorporateActionWorkflow
        │       ├── existing desktop bridge calls
        │       ├── workflow-state derivation
        │       └── command orchestration
        │
        ├── FetchStage
        ├── LoadStage
        ├── ReviewStage
        │       ├── CorporateActionEventCard
        │       └── CorporateActionEvidenceDrawer
        └── ApproveStage
                └── existing approval command/batching
```

Business rules remain in existing TypeScript helpers and Rust backend. New files derive user-facing view models and orchestrate existing operations.

## 2. Proposed File Structure

```text
src/features/corporateActions/
├── workflow/
│   ├── corporateActionWorkflowTypes.ts
│   ├── corporateActionWorkflowModel.ts
│   ├── corporateActionEventViewModel.ts
│   ├── corporateActionWorkflowService.ts
│   └── useCorporateActionWorkflow.ts
├── workspace/
│   ├── CorporateActionWorkspace.tsx
│   ├── CorporateActionWorkflowHeader.tsx
│   ├── CorporateActionFetchStage.tsx
│   ├── CorporateActionLoadStage.tsx
│   ├── CorporateActionReviewStage.tsx
│   ├── CorporateActionApproveStage.tsx
│   ├── CorporateActionEventCard.tsx
│   ├── CorporateActionEvidenceDrawer.tsx
│   ├── CorporateActionStatusBadge.tsx
│   └── corporateActionWorkspace.css
└── __tests__/
    ├── corporateActionWorkflowModel.test.ts
    ├── corporateActionEventViewModel.test.ts
    ├── corporateActionWorkflowService.test.ts
    └── corporateActionWorkspace.test.tsx
```

Existing files reused unchanged at first:

```text
src/features/corporateActions/corporateActionValidation.ts
src/features/corporateActions/corporateActionCompoundValidation.ts
src/features/corporateActions/corporateActionBulkApproval.ts
src/features/corporateActions/corporateActionIdentityRecommendations.ts
src/features/corporateActions/corporateActionEventIdentityPresentation.ts
src/platform/tauriDesktop.ts
src/platform/types.ts
src/types/desktop.ts
src-tauri-shell/src/database/corporate_action_imports.rs
```

`DatabaseToolsDialogs.tsx` remains the initial host for legacy Advanced Maintenance until extraction. Normal workspace code must not duplicate its business predicates.

## 3. New Types

```ts
export type CorporateActionWorkflowStage =
  | 'fetch'
  | 'load'
  | 'review'
  | 'approve';

export type CorporateActionUserStatus =
  | 'READY'
  | 'NEEDS_REVIEW'
  | 'CONFLICT'
  | 'APPROVED'
  | 'ALREADY_PROCESSED';

export interface CorporateActionWorkflowCounts {
  ready: number;
  needsReviewNew: number;
  needsReviewPreviouslyReviewed: number;
  conflicts: number;
  approved: number;
  alreadyProcessed: number;
}

export interface CorporateActionSourceEvidenceViewModel {
  sourceRowId: string;
  source: string;
  actionType: string;
  exDate: string;
  componentFactor: number | null;
  officialSymbol: string | null;
  officialIsin: string | null;
  consolidatedEquivalent: boolean;
}

export interface CorporateActionEventViewModel {
  eventKey: string;
  symbol: string;
  companyName: string | null;
  exDate: string;
  actionLabel: string;
  status: CorporateActionUserStatus;
  statusReason: string;
  firstDetectedAt: string | null;
  lastReviewedAt: string | null;
  previouslyReviewed: boolean;
  componentCount: number;
  effectiveFactor: number | null;
  previousClose: number | null;
  theoreticalPrice: number | null;
  observedPrice: number | null;
  residualPct: number | null;
  identitySummary: string;
  validationSummary: string;
  approvalImportIds: number[];
  sourceEvidence: CorporateActionSourceEvidenceViewModel[];
  auditLines: string[];
}

export interface CorporateActionWorkflowSnapshot {
  fetchState: 'CURRENT' | 'AVAILABLE' | 'PARTIAL_FAILURE' | 'RUNNING';
  fetchedPendingCount: number;
  processingState: 'IDLE' | 'PENDING' | 'RUNNING' | 'COMPLETE' | 'FAILED';
  reviewCheckpointRequired: boolean;
  reviewCheckpointCompleted: boolean;
  approvalInProgress: boolean;
  events: CorporateActionEventViewModel[];
}

export interface CorporateActionApprovalResultViewModel {
  requested: number;
  approved: number;
  returnedToReview: number;
  existingExcluded: number;
  errors: string[];
}
```

The exact persisted row types remain existing desktop/Rust types. The new layer adapts them; it does not replace them.

## 4. Pure Workflow Model

```ts
export function deriveCorporateActionWorkflowStage(
  snapshot: CorporateActionWorkflowSnapshot,
): CorporateActionWorkflowStage {
  if (snapshot.fetchState === 'PARTIAL_FAILURE' || snapshot.fetchState === 'AVAILABLE') {
    return 'fetch';
  }
  if (snapshot.fetchedPendingCount > 0 || snapshot.processingState === 'PENDING' || snapshot.processingState === 'FAILED') {
    return 'load';
  }
  if (snapshot.reviewCheckpointRequired && !snapshot.reviewCheckpointCompleted) {
    return 'review';
  }
  if (snapshot.events.some((event) => event.status === 'READY')) {
    return 'approve';
  }
  return 'fetch';
}
```

The final implementation may extend the snapshot with current exact backend fields, but stage order and fail-closed behavior are binding.

## 5. Event View-Model Construction

```ts
export function buildCorporateActionEventViewModels(
  rows: readonly CorporateActionOfficialImport[],
  scansByImportId: ReadonlyMap<number, CorporateActionScanResultRow>,
): CorporateActionEventViewModel[];
```

Construction rules:

1. Reuse existing backend-provided event identity, compound fingerprints, equivalent-event metadata, and approval state.
2. Never group on symbol/date alone when validated event identity distinguishes records.
3. Equivalent evidence attaches to one event and receives `consolidatedEquivalent: true`.
4. Genuine compound components attach to one event with their component factors preserved.
5. Missing or malformed grouping metadata produces separate fail-closed events.
6. Status derives from existing identity, validation, and approval predicates.
7. `approvalImportIds` contains only backend-eligible component/import IDs.

## 6. Status Mapping

```ts
export function mapCorporateActionUserStatus(input: {
  approved: boolean;
  alreadyProcessed: boolean;
  conflict: boolean;
  ready: boolean;
}): CorporateActionUserStatus {
  if (input.approved) return 'APPROVED';
  if (input.alreadyProcessed) return 'ALREADY_PROCESSED';
  if (input.conflict) return 'CONFLICT';
  if (input.ready) return 'READY';
  return 'NEEDS_REVIEW';
}
```

This function maps validated states only. It does not define readiness or conflict business rules.

## 7. Workflow Service

```ts
export interface CorporateActionWorkflowService {
  getSnapshot(): Promise<CorporateActionWorkflowSnapshot>;
  fetchLatest(): Promise<CorporateActionWorkflowSnapshot>;
  loadAndProcess(): Promise<CorporateActionWorkflowSnapshot>;
  completeReviewCheckpoint(): Promise<CorporateActionWorkflowSnapshot>;
  approveReady(): Promise<CorporateActionApprovalResultViewModel>;
}
```

`corporateActionWorkflowService.ts` composes current desktop bridge calls. It may issue multiple existing calls in sequence, but it must not implement identity, validation, dedupe, compound, or approval predicates.

## 8. Fetch Data Flow

```text
FetchStage primary action
   ↓
existing missing-range/current-state query
   ↓
existing official fetch command(s)
   ↓
refresh snapshot
   ↓
show fetched/new/already-known/no-data/failed summary
```

The service accepts no normal-user date/source argument.

## 9. Load Data Flow

```text
LoadStage primary action
   ↓
existing import/load command
   ↓
existing identity and scan/recheck commands
   ↓
existing compound/dedupe/price-validation results
   ↓
build event view models
   ↓
refresh counts and require Review checkpoint
```

If existing commands require multiple calls, progress reflects those calls but exposes no choices.

## 10. Review Data Flow

```text
workflow snapshot
   ↓
filter NEEDS_REVIEW / CONFLICT
   ↓
partition new vs previously reviewed
   ↓
event cards
   ↓ optional
right-side evidence drawer
   ↓
completeReviewCheckpoint
```

Completing Review records only the workflow checkpoint. It cannot modify identity, evidence, approval, source rows, or EOD data.

## 11. Approve Data Flow

```text
Approve N confirmation
   ↓
collect READY event approvalImportIds
   ↓
existing <=100 batching helper
   ↓
backend approval command per batch
   ↓
refresh backend state after every batch
   ↓
approved IDs → APPROVED
changed/ineligible IDs → NEEDS_REVIEW or CONFLICT
   ↓
result summary
```

The service must distinguish:

- requested;
- actually approved;
- returned to Review;
- pre-existing excluded;
- command failures.

It cannot infer success from the requested count.

## 12. Full-Page Workspace Integration

Implementation begins by inspecting the current app’s full-page workspace host and chart workspace persistence service. The integration must:

- capture the current workspace selection before opening Corporate Actions;
- render `CorporateActionWorkspace` in the primary content region;
- restore the exact prior workspace state on close;
- avoid chart recreation when a preserved workspace can be hidden/restored;
- keep Database Tools navigation available for separate maintenance.

No new global routing framework is introduced solely for this feature.

## 13. Maintenance Migration

Migration is staged:

1. New normal workspace launches independently.
2. Existing technical workbench remains available under Database Tools.
3. Normal-user entry points to legacy Official Imports/Review Issues are removed.
4. Shared business helpers remain shared.
5. Only after regression validation may legacy normal-workflow markup be deleted.

## 14. Error and Busy States

Each stage owns one busy/error state:

- Fetch: `Fetching latest Corporate Actions…`
- Load: `Loading and processing Corporate Actions…`
- Review: snapshot load error; no mutation action
- Approve: `Approving verified events…`

While a primary action is running:

- the stage primary button is disabled;
- navigation to future stages is disabled;
- closing prompts only if an active mutation would be abandoned;
- errors provide `Retry` and `View Error Details`, not technical configuration.

## 15. No Backend-Change Default

The first implementation must use existing commands and persisted state. A new read-only aggregate command may be proposed only if current calls cannot produce a consistent workflow snapshot. Any new write command, schema change, readiness predicate, identity rule, validation rule, or approval rule requires a separate design amendment.
