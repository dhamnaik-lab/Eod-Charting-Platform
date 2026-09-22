# Official Imports User-Friendly Approval — Approved Scope R1

**Prepared:** 2026-09-18 17:56:20 IST (UTC+05:30)  
**Workstream / authorized root:** `E:\TA Projects\EOD Charting Platform`  
**Status:** APPROVED BOUNDED DIRECTION; DOCUMENTATION FIRST; APPLICATION IMPLEMENTATION NOT STARTED  
**Parent source:** `Eod Charting Platform Source Code 2026-09-18_140123_IST.zip`  
**Parent ZIP SHA256:** `0EF8966CD8F4C29DAE0F032372322B88827FF44985968688AE1C4BFA6897666F`  
**Inventory:** 1,342 snapshot files; 548 protected source files. This approval is not a claim that the UX has been implemented or validated.

## 1. User decision and governing boundary

The user approved updating documentation first, then implementing the recommended Official Imports simplification. The adopted queue scope is **all outstanding pending imports, including older unapproved records**, not only the latest fetch. This document freezes that recommendation for the first implementation.

Work only inside the existing `CorporateActionDialog` / Official Imports surface. `Fetch -> Load & Prepare -> Review -> Apply` describes the operator journey, NOT a replacement four-stage application, new route, wizard architecture, Maintenance workspace, or separate approval store. The September 4 existing-workflow recovery remains governing authority: `docs/changes/2026-09-04_0105_IST_CORPORATE_ACTION_EXISTING_WORKFLOW_RECOVERY_MANUAL_ACCEPTANCE_CLOSEOUT.md`.

Implementation is authorized after successful documentation installation and exact source preflight. Do not require fresh approval for every internal test or small edit within this scope. Stop for a material backend gap, changed approval policy, source-authority mismatch, or architectural expansion. Manual acceptance and final snapshot acceptance remain required before completion.

## 2. One bounded issue

Simplify Official Imports preparation and pending approvals without changing financial calculations, eligibility policies, identity authority, persistence ownership, or backend command contracts.

Preserve the active window and tabs: Manual Entry, Identity Import, Official Imports, Scan Database, Review Issues. Identity Import UX is a separate later bounded task; no Identity current-universe or historical Apply is invoked by Official Imports preparation. ER5, Gann geometry/save freeze/Square-of-Nine, Rust warnings, BhavCopy, database creation, and Recent Databases maintenance remain outside this task.

Do not reactivate `CorporateActionNormalWorkflowWorkspace`, `CorporateActionWorkspace`, or `CorporateActionMaintenanceWorkspace`. Existing donor files may be read for a small proven utility only. Do not import their economic-event grouping/approval pipeline wholesale. Their compound-event consistency limitation remains unresolved.

## 3. Operator contract

### Fetch

Keep current source/date selection, NSE + BSE / NSE / BSE behavior, caching, Force Re-fetch, CSV fallback, historical backfill, ordered progress, and per-database Last Successful Fetch. Fetch inserts/stages evidence via existing commands but never approves a corporate action. Do not broaden date coverage or change retry/caching semantics.

The current fetch helper also reloads a list page. Preserve that internal behavior without presenting it as a completely prepared approval queue. Offer a clear transition to **Load & Prepare** in Review. Fetch dates govern acquisition; the pending queue includes older outstanding records and must say so plainly.

### Load & Prepare

A user action on the existing Review surface loads all outstanding pending records for the active database. Use available paginated APIs in bounded batches and keep the interface responsive. Preparation includes existing matching-evidence lookup, strict permitted quick resolution, and required Split/Bonus scans. No mandatory separate Validate Split/Bonus, Quick Resolve, Resolve Multiple, or Check Identity Recommendations clicks in the routine path.

Read-only lookup is not the same as database-free processing: strict quick resolution updates staged import identity/decision evidence and scans persist validation evidence through existing backend owners. These existing preparation writes are authorized by Load & Prepare. They must not create approved corporate actions or invoke exceptional approval operations.

Only automatically resolve rows when the existing backend hint and command permit it: unresolved row, exactly one active candidate, exact event-date historical ISIN evidence. Never infer a BSE trading symbol from a company name, select the first fuzzy match, or weaken evidence checks. Re-read affected records after resolution; validate using their resulting state. No new matching algorithm.

Checking recommended ISIN exceptions is automatic preparation. Granting the recommended exception remains explicit approval, NOT preparation. Preserve its current decision path in Details/exception review; do not silently include it in ordinary Apply All Ready.

### Review pending actions

Default view: **Pending Approval — All outstanding imports, including older unapproved records**. Retain Approved as the existing separate history view.

Show an All Symbols / chosen-symbol filter and expandable symbol groups. Prefer existing resolved event identity for display; preserve source identity evidence. Group by verified exchange + instrument/symbol identity, not company name alone. Unresolved or conflicting records must not be merged into a falsely identified company. Use stable import IDs for child selections; unidentifiable entries remain individually distinguishable.

Grouping is presentation only. A split, bonus, dividend, or rights issue remains its original independent record. No new economic event, factor aggregation, deduplication semantics, or approval identity is created.

Show action, ex-date, understandable action description, readiness/reason, and checkbox. Retain full source/matching/price evidence in Details. Expanding a group never selects records. Checking a group selects only its eligible actions; use mixed/partial checkbox state as needed. Unsupported and blocked actions remain visible but unselectable for ordinary approval. No default preselection.

Expose actionable statuses derived from existing outcomes: Ready to apply, Waiting for price data, Identity needs a decision, Price needs a decision, Could not check, Not approvable, and Applied. These are presentation labels, not new persistent statuses. Never equate an empty uninitialized view with zero pending actions.

### Apply

Two primary ordinary approval actions:

- **Apply All Ready (N):** every eligible pending action matching the currently displayed review filter, including collapsed/off-screen groups, NOT just one fetched page. Ignores checkmarks but never ignores blocking conditions.
- **Apply Selected (N):** eligible checked actions matching the current view. Hidden selections cannot enter approval; clear or visibly reconcile selection when filters change.

The queue is all outstanding records; visible filters define each approval target. Show total pending, filtered count, ready-in-view, selected-in-view, and excluded counts so scope is explicit. A symbol-filtered Apply All cannot approve another symbol. No new exchange/date query contract is invented.

Before writing, show one ordinary confirmation with exact count and scope; cancellation writes nothing. Capture exact reviewed IDs, refresh/recheck eligibility using existing policies, and never add newly ready IDs to a confirmed selection. If material reviewed identity/factor/ex-date/source evidence changes, invalidate the confirmation and request review again. Backend remains the final authority.

Existing identity/price exception approval retains its own reason/evidence authorization. It can be accessed contextually; it is not deleted or disguised as a routine Load operation.

After applying, reload pending records and preserve Approved history. Report approved, linked-existing, already-approved, failed, and still-pending results accurately. Do not replay confirmed successes after partial failure or claim multi-batch atomicity. Refresh existing chart/database summaries through their existing owners; raw .eod prices are not rewritten.

## 4. Loading, responsiveness, and context safety

Use the existing limit/offset contract; no manual Load More is needed for the ordinary pending queue. Finish enumeration before resolution writes that may change sorting/filter membership. Deduplicate retrieved IDs in memory; detect repeated/no-progress pages and stop with an incomplete-state message. The source list clamps offset at 1,000,000: a boundary/no-progress result must never be labelled complete. Do not pretend offset paging is an atomic database snapshot.

Do not enable ordinary Apply while enumeration is incomplete, cancelled, or failed. Row-specific check failures may leave unrelated fully verified rows ready after preparation finishes; failed rows remain blocked. Retry preparation must not approve anything. Clear/invalidate old readiness before a fresh preparation request.

Serialize mutating preparation/approval commands. Keep bounded lookup/scan batches, show stage/count progress, and yield control between batches. Filtering or expansion never triggers a fresh validation scan. Avoid rebuilding/rendering every child row when its group is collapsed.

Capture active database path and a request generation. Before scheduling each operation and before publishing a result or sending approval, verify that the context is still current. Ignore late results after close/database change/new run. Prevent a second preparation/approval run. Reuse existing cross-window guards; do not claim an in-flight backend command is cancellable or database-pinned when its API does not support that. If safe cross-database write isolation cannot be retained with existing contracts, stop and report the gap rather than changing Rust/schema silently.

## 5. Preservation and completion gates

Protected: backend Rust/Tauri files, IPC contracts, factor/price validation calculations and thresholds, ordinary/exception approval policies, Identity ER0–ER4, event-identity evidence, all other CA tabs, fetch/backfill/CSV functionality, Gann deferred status, source/build configuration.

Automated tests must exercise mock API call order and forbidden calls, not just button-name text. Cover multi-page queues, strict/ambiguous matching, no approval during preparation, stale results, no-price-data, selection/grouping, confirmation cancel, >100 approvals, and partial failures.

Then run affected CA/Identity tests, full frontend suite, renderer typecheck/build once on the stable candidate; prepare one portable for manual validation. Do not repeatedly rebuild Rust for UI text changes. Manual acceptance must use the TEST database and confirm the actual flow, colors/themes, scrolling, grouping, Apply Selected, and Apply All Ready.

**TEST:** `E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse`  
**ACTUAL — never for deliberate tests:** `D:\TA Projects\EOD Charting Platform DATABASE\EOD DATABASE\Nse`

Automated runners must not open either user database or perform live fetches. Manual fetch/preparation/approval is restricted to the explicitly selected TEST copy, with backup before mutations. No fabricated pass. Close only after source, documentation, automated results, portable build, manual checkpoint, and new snapshot are addressed.

## 6. Evidence basis

Snapshot source excerpts used to confirm these contracts (line numbers refer to the archived files):

- `src/components/DatabaseToolsDialogs.tsx`: buildOfficialImportListInput 1748–1754; loadOfficialImports 2816 onward; fetch/reload 3000–3059; ordinary selected/all-ready 3818–3834; validation 3837–3879; strict quick-resolution selection 6291–6345.
- `src/features/corporateActions/legacy/corporateActionImportOperations.ts`: existing single-page loader and fetch/reload, preserved when new preparation helper is added.
- `src/features/corporateActions/corporateActionValidation.ts`: existing readiness/scan currency, preserved as policy.
- `src/features/corporateActions/corporateActionBulkApproval.ts`: existing all-ready/selected targeting and 100-item batch constant.
- `src-tauri-shell/src/database/corporate_action_imports.rs`: ordinary bulk cap 4950–4972; strict quick resolution 5224–5282; hints 6020 onward; list pagination 6252 onward. Inspection only; not a modification target.
- `docs/changes/2026-09-04_0105_IST_CORPORATE_ACTION_EXISTING_WORKFLOW_RECOVERY_MANUAL_ACCEPTANCE_CLOSEOUT.md`: existing workflow first, no broad reconstruction.

Read the execution plan at `docs/superpowers/plans/2026-09-18-official-imports-user-friendly-approval-bounded-implementation-r1.md`. These documents are an approved implementation contract, not a replacement for checking the live source preflight.
