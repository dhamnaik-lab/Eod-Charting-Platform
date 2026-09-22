# Corporate Action UI/UX Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the normal Corporate Action workbench with a dedicated Fetch → Load → Review → Approve workspace while preserving all V1.14AD engine behavior.

**Architecture:** Add a pure workflow/view-model layer and a full-page React workspace over existing TypeScript helpers, desktop bridge methods, and Rust backend commands. Keep specialist maintenance in Database Tools. Derive status and workflow state from existing persisted/backend authority; do not recreate business rules in components.

**Tech Stack:** React 18, TypeScript, Vitest, Tauri 2, Rust, SQLite.

**Spec:** `docs/superpowers/specs/2026-09-01-corporate-action-ui-ux-modernization-phase-a-design.md`

## Global Constraints

- Project root: `E:\TA Projects\EOD Charting Platform`.
- Inspect and confirm the newest live repository source before editing.
- Preserve V1.14AD commit/tree behavior; the UI modernization is not authority to reset or discard existing working-tree edits.
- Do not change Corporate Action backend semantics, schema, identity rules, dedupe rules, compound rules, price validation, approval eligibility, idempotency, provenance, or <=100 batch limit.
- Do not auto-approve.
- Do not open or write the live NSE database during automated implementation validation.
- Use a private database for manual mutation smoke.
- Create a timestamped `docs/changes/` report after every meaningful source/config/build-system change.
- Do not stage or commit without separate explicit authorization.

---

### Task 1: Verify Live Source Authority and Freeze the UX Baseline

**Files:**
- Read: `src/components/DatabaseToolsDialogs.tsx`
- Read: `src/features/corporateActions/*.ts`
- Read: `src/features/corporateActions/__tests__/*.test.ts`
- Read: `src/platform/tauriDesktop.ts`
- Read: `src/platform/types.ts`
- Read: `src/types/desktop.ts`
- Read: `src-tauri-shell/src/database/corporate_action_imports.rs`
- Read: `src-tauri-shell/src/database/corporate_action_imports/**`
- Create: `docs/changes/<IST>_CORPORATE_ACTION_UI_UX_MODERNIZATION_IMPLEMENTATION_BASELINE.md`

**Interfaces:**
- Consumes: current repository and Phase A documentation.
- Produces: exact source hashes, current bridge method inventory, current command/result shapes, full-page host integration point, and approved implementation path list.

- [ ] **Step 1: Capture repository authority**

Run:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"
git rev-parse HEAD
git rev-parse 'HEAD^{tree}'
git status --short
git diff --cached --name-only
```

Expected: record actual output. Do not assume HEAD or a clean working tree.

- [ ] **Step 2: Capture exact hashes of first-inspection files**

```powershell
@(
  'src/components/DatabaseToolsDialogs.tsx',
  'src/features/corporateActions/corporateActionValidation.ts',
  'src/features/corporateActions/corporateActionCompoundValidation.ts',
  'src/features/corporateActions/corporateActionBulkApproval.ts',
  'src/features/corporateActions/corporateActionIdentityRecommendations.ts',
  'src/features/corporateActions/corporateActionEventIdentityPresentation.ts',
  'src/platform/tauriDesktop.ts',
  'src/platform/types.ts',
  'src/types/desktop.ts',
  'src-tauri-shell/src/database/corporate_action_imports.rs'
) | ForEach-Object {
  $p = Join-Path (Get-Location) $_
  [pscustomobject]@{ Path=$_; SHA256=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }
}
```

Expected: every path exists. Save output in the baseline report.

- [ ] **Step 3: Inventory exact existing UI actions and bridge calls**

Search `DatabaseToolsDialogs.tsx` for every Corporate Action button handler and record its bridge method. Record which controls move to normal workflow versus Advanced Maintenance.

- [ ] **Step 4: Run existing focused tests without modification**

```powershell
npx vitest run src/features/corporateActions/__tests__
```

Expected: record exact test-file and test counts. A failure blocks implementation and is investigated before source edits.

- [ ] **Step 5: Stop for baseline review**

Create the baseline change report. Do not stage or commit.

---

### Task 2: Add Pure Workflow Types and Stage Derivation

**Files:**
- Create: `src/features/corporateActions/workflow/corporateActionWorkflowTypes.ts`
- Create: `src/features/corporateActions/workflow/corporateActionWorkflowModel.ts`
- Create: `src/features/corporateActions/__tests__/corporateActionWorkflowModel.test.ts`
- Create: `docs/changes/<IST>_CORPORATE_ACTION_UI_UX_WORKFLOW_MODEL.md`

**Interfaces:**
- Produces: `CorporateActionWorkflowStage`, `CorporateActionUserStatus`, `CorporateActionWorkflowSnapshot`, `deriveCorporateActionWorkflowStage`, `mapCorporateActionUserStatus`, `summarizeCorporateActionWorkflow`.

- [ ] **Step 1: Write failing stage-order tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  deriveCorporateActionWorkflowStage,
  mapCorporateActionUserStatus,
} from '../workflow/corporateActionWorkflowModel';

const base = {
  fetchState: 'CURRENT' as const,
  fetchedPendingCount: 0,
  processingState: 'COMPLETE' as const,
  reviewCheckpointRequired: false,
  reviewCheckpointCompleted: false,
  approvalInProgress: false,
  events: [],
};

describe('deriveCorporateActionWorkflowStage', () => {
  it('returns fetch when new data is available', () => {
    expect(deriveCorporateActionWorkflowStage({ ...base, fetchState: 'AVAILABLE' })).toBe('fetch');
  });

  it('returns load when fetched rows are pending', () => {
    expect(deriveCorporateActionWorkflowStage({ ...base, fetchedPendingCount: 4 })).toBe('load');
  });

  it('returns review when the checkpoint is required', () => {
    expect(deriveCorporateActionWorkflowStage({
      ...base,
      reviewCheckpointRequired: true,
      events: [{ status: 'READY' } as never],
    })).toBe('review');
  });

  it('returns approve after review when ready events remain', () => {
    expect(deriveCorporateActionWorkflowStage({
      ...base,
      reviewCheckpointRequired: true,
      reviewCheckpointCompleted: true,
      events: [{ status: 'READY' } as never],
    })).toBe('approve');
  });
});

describe('mapCorporateActionUserStatus', () => {
  it('uses fail-closed precedence', () => {
    expect(mapCorporateActionUserStatus({ approved:false, alreadyProcessed:false, conflict:true, ready:true })).toBe('CONFLICT');
    expect(mapCorporateActionUserStatus({ approved:false, alreadyProcessed:false, conflict:false, ready:false })).toBe('NEEDS_REVIEW');
  });
});
```

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionWorkflowModel.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement the exact types and pure functions from the component/data-flow design**

Do not import the desktop bridge into the pure model.

- [ ] **Step 4: Verify GREEN and full focused regression**

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionWorkflowModel.test.ts
npx vitest run src/features/corporateActions/__tests__
```

- [ ] **Step 5: Create the change report and stop for review**

No staging or commit without explicit approval.

---

### Task 3: Add Fail-Closed Economic Event View Models

**Files:**
- Create: `src/features/corporateActions/workflow/corporateActionEventViewModel.ts`
- Create: `src/features/corporateActions/__tests__/corporateActionEventViewModel.test.ts`
- Reuse: existing validation, compound, identity-presentation helpers
- Create: `docs/changes/<IST>_CORPORATE_ACTION_UI_UX_EVENT_VIEW_MODEL.md`

**Interfaces:**
- Produces: `buildCorporateActionEventViewModels(rows, scansByImportId)`.
- Consumes: existing import rows, scan rows, compound metadata, event identity data, and approval state.

- [ ] **Step 1: Write failing genuine-compound test**

Create two component rows representing Split ×2 and Bonus ×2 with the existing validated compound fingerprint/message. Assert one event, two source-evidence rows, component factors preserved, effective factor 4, and one approval decision.

```ts
expect(events).toHaveLength(1);
expect(events[0].componentCount).toBe(2);
expect(events[0].effectiveFactor).toBe(4);
expect(events[0].sourceEvidence.map((row) => row.componentFactor)).toEqual([2, 2]);
```

- [ ] **Step 2: Write failing equivalent-duplicate test**

Assert equivalent duplicate Bonus evidence appears once as an event and duplicate source evidence is labelled `consolidatedEquivalent: true`; effective factor is not multiplied twice.

- [ ] **Step 3: Write failing conflict/no-guess test**

Provide same symbol/date rows with conflicting validated identity or factor metadata and assert separate `CONFLICT` events or one conflict event exactly as the current backend event identity indicates. The test must prove the view model never groups solely by symbol/date.

- [ ] **Step 4: Verify RED**

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionEventViewModel.test.ts
```

- [ ] **Step 5: Implement by composing existing helpers**

Use `getCorporateActionPriceValidationPresentation` for price presentation. Use existing event identity and recommendation presentation helpers. Do not reproduce their predicates.

- [ ] **Step 6: Verify GREEN plus existing five CA test files**

```powershell
npx vitest run src/features/corporateActions/__tests__
```

- [ ] **Step 7: Create report and stop for review**

---

### Task 4: Add the Dedicated Full-Page Workspace Shell

**Files:**
- Create: `src/features/corporateActions/workspace/CorporateActionWorkspace.tsx`
- Create: `src/features/corporateActions/workspace/CorporateActionWorkflowHeader.tsx`
- Create: `src/features/corporateActions/workspace/corporateActionWorkspace.css`
- Modify: exact current application workspace host identified in Task 1
- Create: `src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx`
- Create: `docs/changes/<IST>_CORPORATE_ACTION_UI_UX_WORKSPACE_SHELL.md`

**Interfaces:**
- Consumes: active stage and counts.
- Produces: full-page workspace open/close with chart-workspace restoration.

- [ ] **Step 1: Write failing workspace header test**

Render with active stage `review`; assert Fetch and Load are completed, Review is current, Approve is disabled, and only one stage has `aria-current="step"`.

- [ ] **Step 2: Write failing open/close preservation test**

Use the existing workspace host test utilities. Open Corporate Actions from a chart tab, close it, and assert the same chart tab/sheet selection is restored without recreation.

- [ ] **Step 3: Verify RED**

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx
```

- [ ] **Step 4: Implement the shell only**

Render placeholder stage slots with no new backend calls. Use existing application styling variables. Avoid introducing a new router.

- [ ] **Step 5: Verify GREEN, typecheck, and renderer build**

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx
npm run typecheck:renderer
npm run build:renderer
```

- [ ] **Step 6: Manual readability checkpoint**

At 100%, 125%, and 150% Windows scaling, confirm the full-page shell has no overlap and the chart workspace restores on close.

- [ ] **Step 7: Report and review stop**

---

### Task 5: Implement the One-Click Fetch Stage

**Files:**
- Create: `src/features/corporateActions/workflow/corporateActionWorkflowService.ts`
- Create: `src/features/corporateActions/workflow/useCorporateActionWorkflow.ts`
- Create: `src/features/corporateActions/workspace/CorporateActionFetchStage.tsx`
- Create/modify: `src/features/corporateActions/__tests__/corporateActionWorkflowService.test.ts`
- Create: `docs/changes/<IST>_CORPORATE_ACTION_UI_UX_FETCH_STAGE.md`

**Interfaces:**
- `fetchLatest(): Promise<CorporateActionWorkflowSnapshot>` has no normal-user source/date arguments.

- [ ] **Step 1: Write failing service orchestration test**

Mock the exact existing missing-range/current-state and fetch bridge methods captured in Task 1. Assert `fetchLatest()` computes/requests only missing ranges and refreshes the snapshot.

- [ ] **Step 2: Write failing UI test**

Assert one enabled primary button `Fetch Latest Corporate Actions`, no date/source/exchange inputs, and a partial failure exposes only `Retry Fetch` plus `View Error Details`.

- [ ] **Step 3: Verify RED**

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionWorkflowService.test.ts
```

- [ ] **Step 4: Implement using existing read/fetch commands**

Do not add a backend command if current commands provide a consistent result. If they do not, stop and write a read-only command design amendment before editing Rust.

- [ ] **Step 5: Verify GREEN and focused regressions**

```powershell
npx vitest run src/features/corporateActions/__tests__
npm run typecheck:renderer
```

- [ ] **Step 6: Report and review stop**

---

### Task 6: Implement One-Click Load & Automatic Processing

**Files:**
- Create: `src/features/corporateActions/workspace/CorporateActionLoadStage.tsx`
- Modify: `corporateActionWorkflowService.ts`
- Modify tests from Task 5
- Create: `docs/changes/<IST>_CORPORATE_ACTION_UI_UX_LOAD_STAGE.md`

**Interfaces:**
- `loadAndProcess(): Promise<CorporateActionWorkflowSnapshot>`.

- [ ] **Step 1: Write failing ordered-orchestration test**

Mock exact existing load/import, identity recheck, validation/recheck, and list-refresh methods. Assert they execute in the proven safe order captured in Task 1 and refresh state after each mutating command.

- [ ] **Step 2: Write failing idempotency presentation test**

Call Load twice with the same imported rows. Assert the second snapshot increases `alreadyProcessed` or leaves counts stable and creates no duplicate event view model.

- [ ] **Step 3: Verify RED**

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionWorkflowService.test.ts
```

- [ ] **Step 4: Implement one primary action and descriptive progress**

The component contains no identity, dedupe, compound, price, batch, source, or date controls.

- [ ] **Step 5: Verify focused and full renderer gates**

```powershell
npx vitest run src/features/corporateActions/__tests__
npm test
npm run typecheck:renderer
npm run build:renderer
```

- [ ] **Step 6: Report and review stop**

---

### Task 7: Implement Exceptions-First Review Cards and Evidence Drawer

**Files:**
- Create: `CorporateActionReviewStage.tsx`
- Create: `CorporateActionEventCard.tsx`
- Create: `CorporateActionEvidenceDrawer.tsx`
- Create: `CorporateActionStatusBadge.tsx`
- Modify: workspace CSS
- Modify: `corporateActionWorkspace.test.tsx`
- Create: `docs/changes/<IST>_CORPORATE_ACTION_UI_UX_REVIEW_STAGE.md`

**Interfaces:**
- Consumes: event view models and counts.
- Produces: `onCompleteReview()`; no repair or approval mutation.

- [ ] **Step 1: Write failing exceptions-first test**

Render 531 Ready, 3 new review, 16 previously reviewed, and 1 conflict. Assert only the 20 exception cards are in the default list; Ready appears as a count and optional summary control.

- [ ] **Step 2: Write failing no-exception test**

Assert `No exceptions found`, Ready/Already Processed counts, optional `View Ready Summary`, and `Continue to Approve`.

- [ ] **Step 3: Write failing evidence-drawer test**

Click `View Evidence`; assert source components, identity evidence, compound calculation, price calculation, audit lines, and internal IDs are present. Assert no Resolve, Save, Backfill, Quick Resolve, or Approve control exists in the drawer.

- [ ] **Step 4: Verify RED**

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx
```

- [ ] **Step 5: Implement accessible cards and drawer**

Use natural-height cards. Status text is visible without color. Drawer closes by button and Escape and traps/restores focus according to existing modal/drawer utilities.

- [ ] **Step 6: Verify GREEN, typecheck, build, and scaling**

```powershell
npx vitest run src/features/corporateActions/__tests__
npm run typecheck:renderer
npm run build:renderer
```

Manually inspect at 100%, 125%, and 150% scaling.

- [ ] **Step 7: Report and review stop**

---

### Task 8: Implement One-Click Approve with Backend Recheck and Partial Result

**Files:**
- Create: `CorporateActionApproveStage.tsx`
- Modify: `corporateActionWorkflowService.ts`
- Modify: workflow service/workspace tests
- Reuse: `corporateActionBulkApproval.ts`
- Create: `docs/changes/<IST>_CORPORATE_ACTION_UI_UX_APPROVE_STAGE.md`

**Interfaces:**
- `approveReady(): Promise<CorporateActionApprovalResultViewModel>`.

- [ ] **Step 1: Write failing one-action test**

Render Ready events and assert there is one `Approve N Ready Events` button, no row checkboxes, no Select All Ready, and no individual Approve buttons.

- [ ] **Step 2: Write failing batching test**

Provide 231 eligible import IDs. Assert existing bulk helper/command is invoked in batches of 100, 100, and 31 under one user action.

- [ ] **Step 3: Write failing final-recheck test**

Mock 231 requested, 228 approved, and 3 returned in refreshed backend state. Assert the result displays 228 approved and 3 returned to Review. Assert no force-approve retry occurs.

- [ ] **Step 4: Verify RED**

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionWorkflowService.test.ts src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx
```

- [ ] **Step 5: Implement using the existing approval API and batch helper**

Refresh state after every batch. Count success from refreshed backend state, not requested IDs.

- [ ] **Step 6: Verify focused/full frontend and Rust gates**

```powershell
npx vitest run src/features/corporateActions/__tests__
npm test
npm run typecheck:renderer
npm run build:renderer
cargo test --manifest-path src-tauri-shell/Cargo.toml -- --test-threads=1
cargo check --manifest-path src-tauri-shell/Cargo.toml
npm run tauri:check
```

- [ ] **Step 7: Private-DB approval smoke**

Use a disposable/private DB. Confirm exact Ready count, confirmation count, multi-batch behavior, partial recheck behavior, and live DB-family immutability.

- [ ] **Step 8: Report and review stop**

---

### Task 9: Implement Persisted Resume and Carry-Forward Presentation

**Files:**
- Modify: workflow model/service/hook
- Modify: Review stage
- Modify: workflow tests
- Create: `docs/changes/<IST>_CORPORATE_ACTION_UI_UX_RESUME_CARRY_FORWARD.md`

**Interfaces:**
- Produces: deterministic stage after workspace reopen and new/previous exception partition.

- [ ] **Step 1: Write failing reopen tests**

Cover fetched-pending → Load, processed/unreviewed → Review, reviewed/Ready → Approve, and completed → Fetch.

- [ ] **Step 2: Write failing carry-forward test**

Load a snapshot with unresolved first/last timestamps and assert separation into New and Previously Reviewed without hiding or blocking Ready events.

- [ ] **Step 3: Verify RED, implement derived state, and verify GREEN**

```powershell
npx vitest run src/features/corporateActions/__tests__/corporateActionWorkflowModel.test.ts src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx
```

Do not add a new database schema solely to remember the UI step when existing persisted state can derive it.

- [ ] **Step 4: Close/reopen manual smoke on private DB**

Verify automatic resume and exact chart-workspace restoration.

- [ ] **Step 5: Report and review stop**

---

### Task 10: Separate Advanced Maintenance and Retire Legacy Normal Entry Points

**Files:**
- Modify: `src/components/DatabaseToolsDialogs.tsx`
- Modify: Database Tools navigation/menu file identified in Task 1
- Create focused maintenance wrapper if needed
- Modify component tests
- Create: `docs/changes/<IST>_CORPORATE_ACTION_UI_UX_ADVANCED_MAINTENANCE_SEPARATION.md`

**Interfaces:**
- Produces: `Database Tools → Corporate Action Maintenance`.
- Removes: normal-user links to legacy Official Imports/Review Issues workbench.

- [ ] **Step 1: Write failing navigation test**

Assert normal Corporate Actions opens the new full-page workspace and Database Tools opens maintenance. Assert normal workspace has no Advanced link.

- [ ] **Step 2: Implement navigation separation without deleting maintenance behavior**

Retain existing maintenance handlers. Move presentation first; do not rewrite their backend semantics.

- [ ] **Step 3: Remove only legacy normal-workflow markup proven unreachable**

Before deletion, map every handler to either new workflow or maintenance. No handler is silently discarded.

- [ ] **Step 4: Run all frontend/Rust/Tauri gates**

Use the commands from Task 8 and record actual results.

- [ ] **Step 5: Report and review stop**

---

### Task 11: Package and Manual Acceptance

**Files:**
- Modify no source unless a separately reviewed defect is found.
- Create: `docs/changes/<IST>_CORPORATE_ACTION_UI_UX_MODERNIZATION_FINAL_VALIDATION.md`

**Interfaces:**
- Produces: certified portable and manual acceptance evidence.

- [ ] **Step 1: Capture exact source/index/tree authority**

Record HEAD, tree, staged set, source hashes, and live DB-family baseline.

- [ ] **Step 2: Run complete validation**

```powershell
npm ci
npm test
npm run typecheck:renderer
npm run build:renderer
cargo test --manifest-path src-tauri-shell/Cargo.toml -- --test-threads=1
cargo check --manifest-path src-tauri-shell/Cargo.toml
npm run tauri:check
npm run tauri:portable:win
```

Never claim PASS without actual command output.

- [ ] **Step 3: Manual private-DB workflow acceptance**

Perform Fetch → Load → Review → Approve on a private DB. Verify exceptions-first, event cards, evidence drawer, compound controls, conflict exclusion, one-click batches, partial recheck, restart resume, and chart restore.

- [ ] **Step 4: Readability acceptance**

Capture 100%, 125%, and 150% scaling screenshots. No wrapped text may overlap another card or row.

- [ ] **Step 5: Live-state postflight**

Require live DB-family, source, index, and unrelated workspace state to remain unchanged.

- [ ] **Step 6: Final report and package review**

Do not promote or commit without explicit approval.

## Plan Self-Review

- **Spec coverage:** Every approved product decision maps to Tasks 2–10.
- **Behavior preservation:** Matrix gates are enforced in Tasks 1, 3, 6, 8, and 11.
- **Placeholders:** None; implementation discovery is an explicit fail-closed Task 1 deliverable.
- **Type consistency:** New type/function names match the component/data-flow design.
- **Backend changes:** None authorized by this plan; any required backend write/schema change triggers a design amendment.

## Execution Handoff

Implementation remains blocked until these Phase A documents are reviewed and explicitly approved. After approval, execute one task at a time with TDD and a review checkpoint; do not stage or commit automatically.
