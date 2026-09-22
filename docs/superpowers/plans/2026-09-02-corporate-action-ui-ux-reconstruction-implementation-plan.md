# Corporate Action UI/UX Reconstruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruct the Corporate Action UI into a simple normal workflow plus a complete specialist Maintenance workspace without losing any intentional pre-modernization capability.

**Architecture:** Keep the V1.14AD backend/database command paths authoritative. Progressively extract only the smallest reusable legacy behavior needed by each slice, then feed the accepted Task 2 workflow model and Task 3 economic-event view-model. Retire the legacy presentation only after Task 7 parity certification.

**Tech Stack:** React, TypeScript, Zustand, Vitest, Vite, Tauri, Rust, SQLite.

**Specs:**
- `docs/superpowers/specs/2026-09-02-corporate-action-ui-ux-reconstruction-architecture.md`
- `docs/superpowers/specs/2026-09-02-corporate-action-capability-preservation-matrix-spec.md`

## Global constraints

- Project root: `E:\TA Projects\EOD Charting Platform`
- FRESH source authority: `Eod Charting Platform Source Code 2026-09-02_125004_IST` / `37437F713C20FD4C6419FFEA5D711C2108A82188678FDB697BB3B2AE79118C8F`
- OLD behavioral authority: `Eod Charting Platform Source Code 2026-09-01_203433_IST` / `ABEC169DD675B3AB319451BB95C152D9A24328F22F105D6495F5EC1157543581`
- Never replace FRESH whole files with OLD files.
- Preserve Task 2, Task 3, Task 4 accepted semantics.
- Preserve existing backend/database/identity/compound/validation/approval semantics.
- Use smallest maintainable change; no broad rewrite.
- Every implementation/config/build change gets a timestamped `docs/changes` report.
- No success claim without actual command output.
- No Git stage/commit unless separately authorized.
- PowerShell supplied for this project must not use the PowerShell `else` keyword.
- Functional parity first; UX simplification second; legacy retirement last.

---

## Task 5A — exhaustive capability inventory and matrix

**Inspect first:** `DatabaseToolsDialogs.tsx`, `RootApp.tsx`, `uiStore.ts`, platform bridge/types, all CA feature files/tests, relevant Rust CA modules.

**Create:** preservation matrix doc, Task 5A report, external audit evidence.

- [ ] Capture current source/Git/DB-family hashes without mutation.
- [ ] Enumerate every legacy control, row action, bulk action, filter, modal action, export, setting, and progress/cancel action.
- [ ] Cross-check the 35 observed API methods and all persisted settings.
- [ ] Assign exactly one of `NORMAL_WORKFLOW`, `MAINTENANCE`, `AUTOMATIC_APPLICATION_RESPONSIBILITY`.
- [ ] Prove `unclassifiedCount = 0`, `lostCount = 0`, `retiredBeforeParityCount = 0`.
- [ ] Package evidence and write the IST report.
- [ ] Stop. Task 5B remains blocked pending review.

---

## Task 5B — controlled legacy boundary extraction

**Modify only after Task 5A:** `src/components/DatabaseToolsDialogs.tsx`.

**Create only as required:** focused reusable modules under `src/features/corporateActions/legacy/` plus characterization tests.

- [ ] Select only the smallest legacy operation slice needed by Task 5C.
- [ ] Write a characterization test against current behavior before moving code.
- [ ] Run the focused test and record the pre-extraction PASS.
- [ ] Extract orchestration without changing API inputs, outputs, errors, or side effects.
- [ ] Make the legacy UI consume the extracted unit.
- [ ] Run all focused CA regressions and renderer typecheck.
- [ ] Mark only proven rows `DUAL_WIRED`.
- [ ] Write Task 5B report and stop.

---

## Task 5C — Normal Fetch + Load

**Create:**
- `src/features/corporateActions/workflow/corporateActionWorkflowAdapter.ts`
- focused adapter test
- `CorporateActionFetchStage.tsx`
- `CorporateActionLoadStage.tsx`

**Modify:** `CorporateActionWorkspace.tsx` and CSS only as needed.

- [ ] RED: prove routine fetch uses established acquisition behavior and does not expose specialist controls.
- [ ] RED: prove Load uses only Task 5A-approved deterministic automatic operations.
- [ ] Implement the minimal adapter; do not reimplement identity, dedupe, compound math, or price validation.
- [ ] GREEN focused tests.
- [ ] Replace hard-coded Fetch/zero-count placeholder with authoritative workflow facts.
- [ ] Run CA regressions, renderer typecheck, renderer build.
- [ ] Update matrix to `MIGRATED` only for proven rows.
- [ ] Write report and stop.

---

## Task 5D — Normal Review + evidence drawer

**Create:**
- `CorporateActionReviewStage.tsx`
- `CorporateActionEventCard.tsx`
- `CorporateActionEvidenceDrawer.tsx`
- focused Review tests

- [ ] RED: exception-first ordering.
- [ ] RED: one authoritative `eventKey` = one event card.
- [ ] RED: every source row remains in evidence.
- [ ] RED: BHARATRAS ×4 and FCL ×10 evidence passes through without new factor math.
- [ ] RED: normal Review exposes no repair/override controls.
- [ ] Implement cards using Task 3.
- [ ] Implement right-side evidence drawer using existing presentation/evidence facts.
- [ ] Add Maintenance escalation intent containing identifiers only.
- [ ] Run CA regressions, typecheck, build.
- [ ] Manual 100/125/150 percent visual check when a portable build is separately authorized.
- [ ] Update matrix/report and stop.

---

## Task 5E — Normal Approve

**Create:** approval controller, focused tests, `CorporateActionApproveStage.tsx`.

- [ ] RED: all still valid → all approve.
- [ ] RED: changed authority → valid subset approves; changed subset returns to Review.
- [ ] RED: already processed reports separately.
- [ ] RED: backend failure produces no false success.
- [ ] RED: zero Ready disables approval.
- [ ] Implement through existing batching/idempotency and final recheck.
- [ ] Expose only `Approve All Ready` in normal flow.
- [ ] Run CA regressions, typecheck, build.
- [ ] Update matrix/report and stop.

---

## Task 6A — Maintenance shell/navigation

**Create:** Maintenance workspace, navigation, CSS, focused host/restoration test.

**Modify minimally:** `uiStore.ts`, `RootApp.tsx`, and the Database Tools entry point.

- [ ] RED: Normal and Maintenance are mutually exclusive.
- [ ] RED: chart workspace remains mounted and Close/Return preserves tab/sheet state.
- [ ] Add section/context state carrying only section/event/import IDs and return target.
- [ ] Add approved Maintenance section navigation.
- [ ] Wire Normal Review escalation and Return with authoritative recheck.
- [ ] Run regressions/typecheck/build/manual scale check.
- [ ] Report and stop.

---

## Task 6B — Maintenance Manual Actions + Identity

- [ ] RED parity tests for every manual action type and conditional field.
- [ ] Reuse existing `applyCorporateAction` path; no direct DB bypass.
- [ ] RED parity tests for NSE/BSE download/preview/apply/archive/import actions.
- [ ] Reuse existing identity APIs/settings.
- [ ] Run parity/regressions/typecheck/build.
- [ ] Update matrix/report and stop.

---

## Task 6C — Maintenance Custom Fetch + Historical Backfill

- [ ] RED parity tests for exchange/date/action filters, Fetch Official, Force Re-fetch, CSV.
- [ ] Wire existing acquisition paths.
- [ ] RED parity tests for single-symbol and batch candidate sources.
- [ ] Wire existing backfill/run-history/progress behavior.
- [ ] Run parity/regressions/typecheck/build.
- [ ] Update matrix/report and stop.

---

## Task 6D — Maintenance Database Scan + Issue Resolution

- [ ] RED tests for Scan Official, Blind Scan, paging, filters.
- [ ] Wire existing scan API.
- [ ] RED tests for Load/Recheck/Quick Resolve/hint categories/manual search.
- [ ] Wire existing resolve/recheck/recommendation paths.
- [ ] Prove unresolved cases remain fail-closed.
- [ ] Run parity/regressions/typecheck/build.
- [ ] Update matrix/report and stop.

---

## Task 6E — Maintenance Exceptions + Sources + Audit/Export

- [ ] RED tests for Historical ISIN and price-validation exceptions, including required reason.
- [ ] Wire exact existing controlled-override APIs.
- [ ] RED tests for source settings/archive root/local paths.
- [ ] Wire existing settings.
- [ ] RED tests for audit/export/progress/cancel.
- [ ] Wire existing save/export behavior.
- [ ] Run parity/regressions/typecheck/build.
- [ ] Update matrix/report and stop.

---

## Task 7 — full parity certification

- [ ] Prove matrix: unclassified 0, lost 0, legacy-only 0, all target dispositions implemented.
- [ ] Run all CA frontend tests with canonical tmp exclusion.
- [ ] Run full frontend test suite; record actual current cardinality.
- [ ] Run renderer typecheck and renderer build.
- [ ] Run relevant Rust CA sentinels and required full Rust/Tauri validation.
- [ ] Build the current-working-tree portable and record EXE SHA-256.
- [ ] Manual smoke: routine flow, Ready-only, Needs Review, Conflict, compound events, Maintenance escalation/return, identity repair, controlled exception, restart/resume, Quote Editor preservation, chart restoration, 100/125/150 percent scaling.
- [ ] Certify Task 8 only if every gate passes.
- [ ] Write parity report and evidence ZIP.

---

## Task 8 — legacy CorporateActionDialog retirement

**Modify:** `src/components/DatabaseToolsDialogs.tsx` and only imports/support proven dead by Task 7.

- [ ] Prove no matrix row is owned only by the legacy dialog.
- [ ] RED: legacy presentation is no longer routed/rendered.
- [ ] Remove only dead legacy presentation code; preserve shared services/controllers/types.
- [ ] Run focused CA and all required full validation.
- [ ] Rebuild portable and repeat critical manual smoke.
- [ ] Write final retirement report and rollback guidance.

Task 8 does not imply Git staging/commit; those remain separately authorized.

## Self-review

Spec coverage is complete across Tasks 5A–8. The plan contains no implementation placeholders. Exact line numbers and current type signatures must be read from the confirmed current source at execution time rather than invented in advance.
