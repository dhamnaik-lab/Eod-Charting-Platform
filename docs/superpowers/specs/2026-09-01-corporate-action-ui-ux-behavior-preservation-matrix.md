# Corporate Action UI/UX Modernization — Behavior Preservation Matrix

**Authority:** V1.14AD exact commit `2103e9ffcaaad28bd903c9cb71310316c68f2ffd`  
**Purpose:** Prevent a user-interface modernization from changing validated Corporate Action semantics.

## Preservation Matrix

| Behavior | Current authority / evidence | New UI treatment | Prohibited change | Required regression proof |
|---|---|---|---|---|
| Explicit human approval | Existing approval workflow and backend commands | One `Approve N Ready Events` action plus confirmation | No auto-approval after Fetch, Load, or Review | Test that Fetch/Load/Review issue no approval command |
| Backend eligibility authority | Rust Corporate Action imports engine | UI displays derived Ready status; backend rechecks before mutation | UI count cannot force approval | Integration test with one item becoming ineligible before approval |
| Approval batching ≤100 | Existing bulk approval helper/API | Hidden internal batches under one user action | No unbounded single mutation | Existing bulk approval tests plus multi-batch result test |
| Approval idempotency | Existing backend persistence and duplicate guards | Already Processed status, no action | Reapproval cannot duplicate approved action | Existing backend/idempotency tests |
| Partial approval result | Existing batch behavior and backend result | Approve valid subset; changed subset returns to Review | No silent drop and no force-approve | New workflow result-model test |
| Current identity matching | `corporate_action_imports.rs` and presentation helpers | Evidence drawer and user status mapping | No new identity inference in React | Existing identity tests remain green |
| Historical identity / ISIN evidence | Event identity authority/resolution modules | Needs Review or Conflict reason | No bypass of historical evidence or ISIN mismatch | Existing event identity presentation tests |
| Conflicting identity fail-closed | Backend classification | `CONFLICT`, excluded | No UI override in normal workflow | Runtime fixture showing unavailable approval action |
| Equivalent-event deduplication | V1.14AD dedupe behavior | Consolidated source evidence under one event | No duplicate event card or extra factor multiplication | V1.14AD compound/dedupe fixtures |
| Genuine same-date compound Split + Bonus | Compound parser/validation and backend fingerprint | One event card with component evidence and combined factor | No collapse into single component factor | BHARATRAS ×4 and FCL ×10 tests |
| Malformed compound metadata | Existing safe fallback | Needs Review or ordinary validated presentation | UI must not manufacture combined factor | Existing malformed metadata tests |
| Price validation math | `corporateActionValidation.ts` and compound presentation helper | Human-readable expected/observed/residual fields | No frontend recalculation inconsistent with shared helper | Existing validation and compound tests |
| Stale evidence rejection | Existing scan identity/date/factor staleness gates | Event returns to Needs Review | No reuse of stale Ready state after data changes | Existing stale scan tests plus workflow-stage test |
| Raw EOD immutability | Existing database safety contract | No normal UI control mutates raw EOD | No price correction or gap repair in workflow | Live DB family before/after validation |
| Rights behavior | Existing engine semantics | Event card/status only | No new automatic factor approval | Existing Rust/frontend regression suite |
| Dividend behavior | Existing engine semantics | Event card/status only | No Split/Bonus rules applied to Dividend | Existing regression suite |
| Demerger behavior | Existing engine semantics | Event card/status only | No guessed factor or automatic approval | Existing regression suite |
| Exception approval semantics | Existing backend rule | Evidence-only normal Review; maintenance remains separate | No normal-workflow shortcut | Backend tests and command audit |
| Fetch missing-range calculation | Existing `compute_missing_fetch_ranges` behavior | One-click automatic catch-up | No arbitrary fixed window or duplicate fetch | Existing Rust test plus stage model tests |
| Load idempotency | Existing import dedupe/persistence | Re-run shows Already Processed | No duplicate source/import rows | Existing import tests plus repeated Load test |
| Audit/provenance | Existing source/import/approval provenance | Drawer displays source and audit history | No loss of source IDs/fingerprints | Snapshot test of evidence model; backend suite |
| Unresolved carry-forward | Existing unresolved persisted evidence | New vs Previously Reviewed sections | No automatic archive/delete/approve | Workflow model persistence tests |
| Advanced maintenance behavior | Current specialist tools | Moved under Database Tools | No semantic rewrite during normal-workflow phases | Old maintenance regression/manual smoke |
| Chart workspace preservation | Existing workspace state services | Full-page CA workspace restores prior chart state | No chart/tab/drawing loss | Workspace integration test |
| Database selection safety | Existing active-database contract | Workspace displays active DB and uses current selected DB | No implicit live/private database switch | Manual private-DB smoke and runtime path evidence |

## Existing Focused Frontend Test Inventory

The confirmed V1.14AD combined-tree inventory contains five focused Corporate Action frontend test files with 32 tests:

- `corporateActionValidation.test.ts`
- `corporateActionCompoundValidation.test.ts`
- `corporateActionBulkApproval.test.ts`
- `corporateActionEventIdentityPresentation.test.ts`
- `corporateActionIdentityRecommendations.test.ts`

All must remain green. New workflow tests supplement them; they do not replace them.

## Required Implementation Validation

### Focused frontend

```powershell
npx vitest run src/features/corporateActions/__tests__
```

### New workflow model and workspace

```powershell
npx vitest run `
  src/features/corporateActions/__tests__/corporateActionWorkflowModel.test.ts `
  src/features/corporateActions/__tests__/corporateActionEventViewModel.test.ts `
  src/features/corporateActions/__tests__/corporateActionWorkspace.test.tsx
```

### Full renderer

```powershell
npm test
npm run typecheck:renderer
npm run build:renderer
```

### Rust/Tauri

```powershell
cargo test --manifest-path src-tauri-shell/Cargo.toml -- --test-threads=1
cargo check --manifest-path src-tauri-shell/Cargo.toml
npm run tauri:check
```

### Manual acceptance

- private DB only;
- Fetch/Load/Review without approval mutation;
- exceptions-first presentation;
- BHARATRAS/FCL compound evidence;
- conflicting identity excluded;
- one-click multi-batch approval on disposable/private DB;
- eligibility-change partial result;
- close/reopen stage resume;
- chart workspace restore;
- no multiline overlap at 100%, 125%, and 150% scaling.

## Change-Control Rule

A required behavior that cannot be implemented without changing backend semantics must stop the UI implementation. It requires a separate design amendment and explicit approval. The UI modernization itself does not authorize that change.
