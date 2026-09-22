# Pending Actions Compact Layout R1 — approved design

**Status:** APPROVED FOR BOUNDED IMPLEMENTATION; not yet implemented or visually accepted.  
**Prepared:** 2026-09-19 16:31:34 +05:30.  
**Workstream:** EOD Charting Platform — `E:\TA Projects\EOD Charting Platform`.

## 1. User intent and design authority

The user needs substantially more screen area for reviewing pending Corporate Actions. The current progress/options stack consumes a large part of the display. The requested change is a compact arrangement of the existing controls, not another Corporate Actions architecture or workflow.

Approved scope, verbatim:

> Approved Pending Actions Compact Layout R1 — layout-only; preserve all FIX2 behavior; defer list-rendering optimization and runtime remediation.

The prior review's virtualization, caching, searchable-combobox and runtime profiling ideas are future recommendations, not permissions for R1. This design records the already approved in-chat layout. Implementation does not require another discussion of the same scope.

## 2. Starting state and evidence levels

**File evidence:** FIX2 RESUME1's `real-final.json` contains 552 protected paths. Its dialog is `src/components/DatabaseToolsDialogs.tsx`, 376,702 bytes, SHA256 `4951C7340F534ED2C401189877635E4F122C7B22089A5B17451B7FA392E8ACEF`. Exact evidence and file anchors are in the companion source map.

**Prior command-output evidence:** the parent frontend/native gates passed in the supplied archive. These results do not validate changes that have not been made.

**Screenshot evidence:** `reference/completed-preparation-before.png`, 1920×1080, shows 32,202 pending/visible and 7,108 ready, and a completed preparation duration of 5m49s. These are example data and timings, never application constants or a performance promise.

**Design target:** the completed progress/options region was measured in the prior review as about 420 original-image pixels between the subsection navigation separator and the list header. R1 aims for at most 200 at the same scale. Screen pixels are not automatically CSS pixels. The new candidate must be measured in a rendered UI, not by adding style constants.

**Untested:** the new compact layout, pixel reduction, keyboard flow and candidate runtime behavior remain untested until implementation and the specified checks.

## 3. Scope boundary

Permitted production owner: `src/components/DatabaseToolsDialogs.tsx`.

Permitted changes are layout wrappers, Review-specific inline styles, accessible labels/test hooks, the Pending Review group's header width/wrapping, and an opt-in compact presentation of the existing `OfficialImportTaskStatus`. A native `details/summary` disclosure for explanatory information is allowed. It must not introduce persistent application state, new timers, new network/database work, or new approval behavior.

New focused test: `src/features/corporateActions/__tests__/corporateActionPendingCompactLayout.test.ts`. Additional tests require a documented reason; prefer the single focused file and existing suites. Do not rewrite existing regression tests unless a specific presentation assertion is genuinely stale and its preserved behavior is covered equivalently.

Do not change:

- Rust, SQL, schema, raw EOD, Tauri command registration or TypeScript IPC contracts;
- matching, validation, fingerprinting, exact-ID recheck, approval, reconciliation or cancellation algorithms;
- group data creation, sorting, reason classification, selection storage or filter semantics;
- native Symbol selector into a custom searchable widget;
- dependencies, lockfiles, build configuration, chart engine, Gann, BSE, ER5 or compiler-warning cleanup;
- global/shared style definitions in a way that changes other dialogs or tabs.

## 4. Three compact bands

Keep the top-level Corporate Actions tabs and the Official Imports subsection navigation. Inside **Official Imports > Review > Review Queue**, use this order:

| Band | Required content | Behavior |
|---|---|---|
| Actions | Load & Prepare; Apply Selected (N); Apply All Ready (N); Review Queue / Approved | Existing labels, handlers and enabled/disabled predicates. Main actions stay directly accessible. |
| Filters | Native Symbol select with inline label; Find input; Current; Split/Bonus/Rights/Dividend/Other controls | Existing values, option ordering, callbacks, and selection/confirmation-clearing behavior. |
| Status | Pending/Filtered/Ready/Selected counts; current status; task elapsed/count metadata when present; Details; safe preparation cancellation when available | Counts derive from the current existing arrays. Messages and safety state remain truthful. |

The Filter band may wrap into two lines at narrower widths; never force overlap to keep it to one line. Preserve useful input width and readable text. Use local `minWidth: 0`, natural wrapping and restrained gaps instead of a fixed-height clipped container.

The UI text `visible` may become `Filtered` to clarify meaning, while retaining the exact `visibleImportRows.length` calculation. The code variable need not be renamed. Neither field means the number of DOM rows mounted.

The Approved view keeps `Load Approved` and `Load More Approved`, existing flat approved rows, existing search and filter behavior, and view-switch loading behavior. It must not unexpectedly show pending Apply controls. Prefer retaining its existing header presentation rather than redesigning it with this change.

## 5. Status and Details contract

### Always-visible information

Current operation/result text must remain readable without opening Details. In particular, do not hide errors, stale-review rejection, cancellation instructions, partial Apply receipts, refresh warnings, or uncertain write outcomes. Allow those messages to wrap and grow. The 200-pixel normal-state target does not override safety.

Retain the baseline message precedence for Pending Review: while `busy` with `officialTaskProgress`, show its current message; otherwise use current `status` when nonempty; otherwise use the existing preparation-complete or initial helper fallback. An old completed task message must not cover a newer `status` error.

If the historical task message differs from the current message, it may appear in Details labelled as earlier operation information, not as current success. Never infer readiness or success from an `endedAt` timestamp alone: a stopped operation also has `endedAt`.

### State matrix

| State | Normal presentation | Required preservation |
|---|---|---|
| No preparation | One short helper sentence plus counters | Apply unavailable according to the original predicates. |
| Loading/preparing | Stage/message, returned count or “Total not yet known”, elapsed, permitted Cancel | No invented percentage/ETA; counters advance only when existing producers report completion. |
| Completed preparation | Compact result line and stopped elapsed timer | Readiness remains calculated by existing evidence/policy; no automatic Apply. |
| Confirmation open | Existing confirmation region, exact count/scope and both buttons | Do not collapse/hide it to meet the height target. |
| Rechecking/applying/refreshing | Existing active phase message/count and elapsed | Do not offer in-flight Apply cancellation or claim success before native response. |
| Cancelled/stopped/error/uncertain | Full current warning/result visible; allow extra height | Existing fail-closed state and instructions remain intact. |
| Approved view | Existing approved load/status workflow | No stale pending-progress panel introduced by the compact branch. |

### Details content

Use a small native disclosure for existing explanations such as “counts advance only after completion,” full historical operation text when distinct, and start/end/count metadata already available. Do not imply that the app has a persistent log or new diagnostics store. Details opening/closing must not reset selection, trigger preparation, fetch data or restart the elapsed timer.

The elapsed clock remains in `OfficialImportTaskStatus`, not in `CorporateActionDialog`. Retain the existing effect dependencies, interval cleanup and ended-time behavior. Do not put a new timer in the parent to drive a single status line. Preserve the current status announcement behavior; do not turn every timer tick into an intrusive repeated announcement.

### Duplicate footer

Suppress the old bottom `utilityStatusStyle` region only for the compact Pending Review branch after its full current message has been relocated to the status band. Keep the existing footer logic for Fetch & Import, Historical Backfill and Approved. Do not remove a unique warning merely because the text looks similar to a progress summary.

## 6. Controls and state invariants

Move existing control JSX, do not reimplement its workflow. Preserve these bindings:

| Control | Existing owner / predicate |
|---|---|
| Load & Prepare | `loadAndPrepareOfficialImports`; disabled `busy || !hasDatabase` |
| Apply Selected | `approveSelectedOfficialImports`; disabled additionally when preparation incomplete or selected eligible count is zero |
| Apply All Ready | `approveAllReadyOfficialImports`; disabled additionally when preparation incomplete or eligible count is zero |
| Review Queue / Approved | `switchOfficialImportView('review' / 'approved')`; same busy/database gate |
| Symbol | `officialReviewSymbolFilter`; existing three-state setter sequence including clearing selected IDs and confirmation |
| Find | `updateOfficialImportSearchQuery`, whose type is `React.Dispatch<React.SetStateAction<string>>` |
| Current | `applyCurrentSymbolFilter(updateOfficialImportSearchQuery, importExchange)` with current disabled predicate |
| Types | `toggleImportActionType`; preserve existing `expandOfficialImportActionTypes(selectedImportActionTypes)` |
| Cancel preparation | Existing ref setter and `setOfficialCanCancelPreparation(false)` only; same `canCancel` authority |
| Confirm Apply | `confirmOfficialImportApproval`; exact review IDs, fingerprints, generation and database context unchanged |

Filter changes intentionally clear selection and confirmation in the accepted implementation. This R1 must not introduce cross-filter retained selections under the guise of usability.

The type checkboxes currently do not carry the same `busy` disabled attribute as some neighboring controls. Preserve actual behavior; adding a new disabled condition is not part of this layout change. If the implementer finds that policy undesirable, record it separately instead of silently “fixing” it.

## 7. Group-header allocation

Change only the Pending group's header styles and the reason-summary span's layout. Remove the span's `maxWidth: '55%'` restriction within its already allocated grid cell. Allocate sufficient space to the reason summary, permit readable wrapping, and give the company label a shrinking/wrapping region with `minWidth: 0`.

Keep the displayed pending count and complete `reasonSummary`; no new summary calculations, reason relabelling or truncation that makes a reason inaccessible. Keep `title` information and expand controls. Long labels must not cover the checkbox or block the summary.

Leave `readyRows`, `selectedReady`, `reasonCounts`, `reasonSummary`, `expandedOfficialGroupKeys`, child-row lazy mounting and each current handler unchanged. No virtualization, caching, pagination, “Select all” redesign or default expansion change.

Exception panels keep their existing reachability: the table is hidden when `resolveTargetRow` or `priceExceptionTargetRow` requires that existing review panel. Do not break that layout relationship by changing an ancestor's overflow or fixed height.

## 8. Sizing and accessibility

Aim for approximately 6–8 CSS-pixel inter-control gaps, 30–34 CSS-pixel existing control heights and unchanged application font sizes as starting values, not a pass certificate. Use natural sizing and compare at the operator's actual scale.

At the original 1920×1080 capture scale, completed preparation, Details/confirmation closed, require the documented >=50% reduction and target <=200 original-image pixels for the navigation-to-list control/status region. Record exact before/after bounds. A 420→200 reduction is 52.38%, returning 220 pixels.

At smaller windows or higher zoom, wrapping and access take priority over maintaining a fixed number of bands. Keyboard users must reach primary actions, native select, search, type checkboxes, Details, Cancel, group expand/select, confirmation and exception controls. Keep visible focus, labels, theme variables and readable contrast. Do not use `transform: scale(...)`, smaller fonts, hidden overflow or clipped warning text to manufacture compliance.

## 9. Acceptance and handback

Automated structure/wiring checks and full frontend regressions must pass on the candidate. Layout geometry, focus, theme and overflow need actual browser/WebView2 evidence. Node source tests or mocked rectangles do not prove pixel reduction.

A source candidate may be classified AUTOMATED GREEN while manual visual acceptance remains pending. The parent Official Imports task is not fully closed merely because layout code compiles. Runtime/list-performance issues remain open and deferred.

Execution details: companion plan `docs/superpowers/plans/2026-09-19-pending-actions-compact-layout-r1-implementation-plan.md`. Requirements/tests mapping: `docs/superpowers/handoffs/pending-actions-compact-layout-r1/VALIDATION-AND-HANDBACK.md`.
