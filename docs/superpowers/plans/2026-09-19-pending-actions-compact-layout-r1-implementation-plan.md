# Pending Actions Compact Layout R1 — Implementation Plan

> **For the receiving agent:** Execute this bounded plan sequentially in the user's chosen GPT-5.6 Sol Extra High session or another authorized coding environment. Use an available execution/TDD workflow, but do not let a missing plugin prevent following these written steps. No new architecture planning cycle or repeated scope approval is required. No Git operations are authorized.

**Goal:** return at least half of the normal completed-state progress/options footprint to the existing Pending Actions list while preserving every FIX2 decision and operation.

**Architecture:** retain `CorporateActionDialog`, all existing state/handlers and the native Symbol selector. Change Pending Review JSX arrangement and private styles; give the existing status component an opt-in compact presentation. No new service, store, library, file-wide refactor or data-path change.

**Tech stack:** existing TypeScript/React frontend and installed Vitest/Vite tools. The supplied earlier package declares React 18 and Vitest's Node environment; inspect the live package/lock/configuration before execution rather than assuming different testing tools exist.

**Spec:** `docs/superpowers/specs/2026-09-19-pending-actions-compact-layout-r1-approved-design.md`.

## Global constraints

Active root is exactly `E:\TA Projects\EOD Charting Platform`.

Implementation is layout-only. Ordinary and exceptional approval, exact-ID recheck, raw EOD, schema, all native code and IPC contracts remain unchanged. Native Symbol select remains. No virtualization, paging, caching/search changes, chart GPU/CPU/memory work, warning cleanup, dependency retrieval, Git, user database access or snapshot.

Use the accepted **552-path** manifest, NOT the old package's 550-path preimage manifest. The dialog SHA256 is `4951C7340F534ED2C401189877635E4F122C7B22089A5B17451B7FA392E8ACEF`. Reconcile no drift automatically.

No build/dependency/evidence output inside `src` or `src-tauri-shell`. Evidence/backups/sandboxes belong under this root's declared `tmp` area or its authorized source-audit area. Capture and preserve the current generated `src-tauri-shell/gen/build-info.json`; do not reinstall the historical bytes.

## Review focus — cases easy to miss

1. A fresh error in `status` arrives after an old completed task: the fresh message must remain visible (tests C07, C08).
2. An uncertain/partial Apply receipt or exception panel needs height: do not clip it to satisfy the 200-pixel normal-state target (C08, C10).
3. Search/Symbol/type change clears existing selection and confirmation: retain this deliberate behavior (C05).
4. Approved/Fetch/Backfill share the same style helpers: private compact styling must not change those surfaces (C04, C11).
5. Long company/reason text, narrow windows and zoom can force wrapping: controls/focus/panels remain reachable (C09, C12).

## One bounded deliverable, five internal phases

These phases are checkpoints within the same authorized correction, not five separate implementations. Continue from one to the next when its gate passes. If authority is wrong or a gate fails, retain evidence and report the concrete blocker. Do not inflate unrelated work to fill the phases.

### Phase A — verify authority and create a bounded recovery point

**Inspect before edit:** approved design; live `AGENTS.md`; current relevant status; source map; current dialog; the FIX2 wiring, characterization and approval tests; package/lock/TypeScript/Vitest/Vite configs.

- [ ] Verify the supplied accepted evidence ZIP SHA256 `06B34E77ADA300A7755165B9C0180B4C3C65E1DCE793D2995B28F80DAA6A034F`, ZIP integrity and all 48 archive-manifest members. Paths in this Windows ZIP may contain backslashes; normalize separators and reject traversal/duplicate normalized paths.
- [ ] Compare live protected-source inventory with `authority/accepted-protected-source-552.json`. Require path set, byte lengths and hashes, not just the number 552. Use the inventory semantics described in SOURCE-MAP.md.
- [ ] Validate/capture current generated build metadata and substitute only that captured row in the run-specific PRE inventory. Do not edit the frozen accepted manifest itself.
- [ ] Read and capture hashes of live support/config files before use. If they differ from historical support references, inspect that difference; do not silently overwrite, pin or reject the unrelated docs tree wholesale.
- [ ] Check that `corporateActionPendingCompactLayout.test.ts` does not already exist. If it does, inspect it and stop for authority reconciliation rather than overwrite unknown work.
- [ ] Create an owned source-only sandbox under `tmp\CA_PENDING_COMPACT_LAYOUT_R1_<IST>_<unique>`. Copy source/runtime resources and required build support, not a whole-root copy containing databases/caches. Reuse installed dependencies outside source directories without retrieving packages. Do not run old archived install controllers.
- [ ] Save a byte-verified bounded backup of the dialog and any documentation files that will be updated. Record additions separately, so rollback removes only newly created task files. Preserve preexisting unknown documents.
- [ ] Capture candidate PRE/source-support manifests and declare the write inventory before editing. No application database is opened.

**Proposed inventory:** one production replacement, one test addition, additive approved docs/change record/current-status entry. With one new test and no other protected-file additions, expected protected count is **553**, derived from 552 + 1; this is a plan, not an observed POST result.

### Phase B — write and run a genuine focused RED

**Create:** `src/features/corporateActions/__tests__/corporateActionPendingCompactLayout.test.ts`.

**Production unchanged at this point.** The initial test must fail because the real parent has the old separated progress/options structure, not because TypeScript/Vitest cannot start or a fixture is missing.

Use syntactic inspection for structure/binding contracts in the existing Node test environment. Do not install jsdom, Playwright, a grid library or a new React test renderer just for R1. Existing authorized browser tooling may be used if present; otherwise the manual WebView2 gate supplies actual geometric proof.

This is a concrete starting test, not a completed test suite or geometry proof:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'), 'utf8',
);
const ast = ts.createSourceFile(
  'DatabaseToolsDialogs.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
);
function literalAttributes(name: string): string[] {
  const result: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === name
        && node.initializer && ts.isStringLiteral(node.initializer)) {
      result.push(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return result;
}

describe('Pending Actions compact layout R1', () => {
  it('declares exactly the three compact review bands in the rendered controls', () => {
    expect(literalAttributes('data-ca-review-band')).toEqual([
      'actions', 'filters', 'status',
    ]);
    expect(literalAttributes('aria-label').filter(
      (value) => value === 'Pending Actions compact controls',
    )).toHaveLength(1);
  });

  it('retains the explicit reviewed approval region and entry points', () => {
    expect(literalAttributes('aria-label')).toContain('Confirm Corporate Action approval');
    expect(source).toContain("requestOfficialImportApproval('selected')");
    expect(source).toContain("requestOfficialImportApproval('all-ready')");
    expect(source).toContain('confirmOfficialImportApproval()');
  });
});
```

Expand the test file to cover the C01–C11 structure/binding assertions in the validation document. Check that the new wrapper is in the active Pending Review render path, not unused markup or a hidden dummy subtree. Use the pinned baseline for exact handler/function comparisons in the validation evidence. Test markers are observational hooks, not new workflow state.

- [ ] Run the focused file against the exact accepted source with the new test only.
- [ ] Save JSON/text output, exit code and exact failing assertion. Expect the missing three-band contract to fail and preserved entry-point checks to pass.
- [ ] Confirm no product file changed to manufacture the RED.

### Phase C — implement the bounded JSX/style correction

**Modify only production file:** `src/components/DatabaseToolsDialogs.tsx`.

Keep the existing source style and avoid a whole-file formatter. Line numbers below identify the inspected parent; use exact named anchors after any edit shifts them.

#### C1. Isolate the Pending Review branch

Immediately before the existing `renderImportsTab`, derive a presentation-only predicate:

```ts
const compactPendingReview =
  activeOfficialImportSection === 'review' && !showingApprovedImports;
```

Do not change the setters or view state. The old Approved header remains in its existing branch; use the new compact presentation only when this predicate is true. The subsection navigation remains unchanged.

Add one labelled compact wrapper with three bands:

```tsx
<div style={pendingCompactControlsStyle} aria-label="Pending Actions compact controls">
  <div data-ca-review-band="actions" style={pendingCompactActionsStyle}>
    {/* Move the existing pending action buttons and view-toggle buttons here. */}
  </div>
  <div data-ca-review-band="filters" style={pendingCompactFiltersStyle}>
    {/* Move the existing native Symbol select, Find/Current and type controls here. */}
  </div>
  <div data-ca-review-band="status" style={pendingCompactStatusBandStyle}>
    {/* Show existing counts and canonical current status/task presentation here. */}
  </div>
</div>
```

The comments above denote precise existing JSX blocks listed below, not permission to create alternate handlers. Copy those blocks into their indicated band, remove the former pending-only copies, and keep one instance of each interactive control per visible view.

#### C2. Move controls without changing behavior

From parent lines 5644–5666, move the three pending action buttons verbatim, including all disabled expressions. From 5623–5640, use the same `switchOfficialImportView` calls and gates. Do not call final approval directly from an Apply Selected/All button.

From 5679–5709, move the native Symbol selector and existing Find/Current binding. Use an inline Symbol label instead of its vertical shared field-group style. Keep `value`, option keys/values/order, `disabled={busy}` and the entire onChange body. The selected IDs and confirmation are intentionally cleared by that body.

Use `renderImportActionTypeFilters()` inside a compact row wrapper without changing its checkbox callbacks or data. Do not shrink `corporateImportFilterRowStyle` globally. For Find, use the original `updateOfficialImportSearchQuery` and Current callback directly in pending-only markup; retain `renderSearchBar` unchanged for the other callers. This is a small duplicate of control markup, not a duplicate search implementation.

Exact callback requirement:

```tsx
onChange={(event) => updateOfficialImportSearchQuery(event.target.value)}
```

Current remains:

```tsx
onClick={() => applyCurrentSymbolFilter(updateOfficialImportSearchQuery, importExchange)}
disabled={busy || !hasDatabase}
```

Do not narrow `updateOfficialImportSearchQuery` from `React.Dispatch<React.SetStateAction<string>>` to a string-only setter. That regression previously caused TS2345.

Pending/Filtered/Ready/Selected values are respectively `importRows.length`, `visibleImportRows.length`, `eligibleImportRows.length`, and `selectedEligibleImportRows.length`. Do not calculate new eligibility or hardcode screenshot counts.

#### C3. Consolidate status safely

Create a presentation-only current-message expression using the pending branch of the old footer:

```ts
const pendingCompactMessage = busy && officialTaskProgress
  ? officialTaskProgress.message
  : status || (officialPreparationComplete
      ? `Prepared ${importRows.length} pending action(s). Ready ${eligibleImportRows.length}; selected ${selectedEligibleImportRows.length}.`
      : 'Choose Load & Prepare. The app will perform routine matching and Split/Bonus checks before you review and apply.');
```

Retain the existing `OfficialImportTaskStatus` name and extend its props only with optional presentation inputs, for example:

```ts
compact?: boolean;
messageOverride?: string;
```

Default behavior remains the existing noncompact presentation. Its timer/state/effect dependencies and stopped-elapsed calculation remain unchanged. When compact, change only its returned wrappers/styles; show `messageOverride ?? progress.message` as the current status. Render it in the status band only when progress exists. With no task, show `pendingCompactMessage` in a plain status element with no timer.

The compact call retains the exact cancellation behavior:

```tsx
<OfficialImportTaskStatus
  progress={officialTaskProgress}
  canCancel={officialCanCancelPreparation}
  onCancel={() => {
    officialCancelPreparationRef.current = true;
    setOfficialCanCancelPreparation(false);
  }}
  compact
  messageOverride={pendingCompactMessage}
/>
```

Keep current text, elapsed, returned counts/unknown-total and allowed Cancel visible. Put only explanatory/secondary information into native `<details><summary>Details</summary>…</details>`. Do not infer success from `endedAt`, parse warning strings to hide them, add a persistent log, or change task producers. If `status` differs from the old task message, the new current message wins; the old one may be labelled historical in Details.

Suppress the previous upper task panel and lower footer only for `compactPendingReview`. Preserve them for their remaining original callers. The bottom footer’s Fetch/Backfill/Approved branches must remain untouched. All unique status information removed from a pending location must now be visible in the new band or safely secondary in Details; errors and uncertain/partial receipts are never secondary.

#### C4. Use private styles, not global scaling

These example styles are starting values to adapt by measured layout, not final validated dimensions:

```ts
const pendingCompactControlsStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
  minWidth: 0, flexShrink: 0, padding: '8px 10px',
  border: '1px solid var(--border)', background: 'var(--control-bg)',
};
const pendingCompactActionsStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center',
  justifyContent: 'space-between', gap: 8, minWidth: 0,
};
const pendingCompactFiltersStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0,
};
const pendingCompactStatusBandStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center',
  gap: '4px 12px', minWidth: 0,
};
```

Use local input/label wrappers with `minWidth: 0` and a flexible Find field. Give the native Symbol select a bounded useful width while allowing wrapping at narrow widths. Keep control font sizes and height from the existing styles rather than shrinking the entire app. Do not set `maxHeight: 200` with hidden overflow: the 200-pixel requirement is a normal-state visual measurement, not a clipping rule.

#### C5. Correct header space allocation only

In the existing group-header JSX at approximately 6069, remove the reason span's `maxWidth:'55%'` restriction; replace it with a local reason style allowing its allocated column width and readable wrapping. Inspect the current `officialPendingGroupHeaderStyle`/toggle style at approximately 8193 and allocate widths so long text cannot cover selection/expansion controls. A local wrapping flex arrangement or a properly shrinking grid is sufficient; do not add another component hierarchy or change `group.rows` calculations.

Preserve the `title={reasonSummary}` and `{group.rows.length} pending · {reasonSummary}` content. The action rows, table visibility expression and exception panels remain unchanged. Do not change shared `corporateIssueHintTextStyle` globally.

#### C6. Preserve approval confirmation

Leave parent lines 5993–6005's reviewed-confirmation logic intact. Keep all reviewed IDs, fingerprints, scopeLabel, databasePath, generation and exact-ID backend rechecks unchanged. Normal compact height measurement excludes an open confirmation; never hide it or compress its warning text.

### Phase D — GREEN, preservation and appropriate regressions

- [ ] Run the new focused test and the existing FIX2 focused/wiring/characterization tests. Save actual results and verify zero failures; do not accept missing tests.
- [ ] Check the one-file production delta. Exact function-body comparisons must show unchanged preparation, approval, filter, selection, fingerprint, error-producing and API-calling logic. Allow only the specified render/status presentation changes, optional presentation props, private styles and test hooks.
- [ ] Verify every other protected source file byte-for-byte, with the captured metadata exception; confirm exactly the declared test addition. Compare support/lockfile hashes before and after.
- [ ] Run CA + Identity regression, full Vitest, renderer typecheck and renderer Vite build, using the existing toolchain. The validation document gives commands. Do not claim a native runtime test has run when only a frontend test passed.
- [ ] Because native source/contracts are unchanged, a new Rust RED cycle is not required. Do not repeat the previous 106-test native suite after each cosmetic edit. If the frontend failures reveal a native contract change is necessary, stop: it exceeds R1. Portable compile is a later manual-build checkpoint.
- [ ] Inspect the existing source contract assertions that mention the old layout. Change an assertion only when its exact expectation was intentionally superseded, keeping equivalent preservation coverage. Do not disable suites, widen global exclusions, use `any`/`ts-ignore`, or raise unrelated timeouts to force GREEN.

### Phase E — documentation, controlled delivery and manual acceptance

- [ ] Add a fresh actual-IST implementation change record at `docs/changes/YYYY-MM-DD_HHMM_IST_PENDING_ACTIONS_COMPACT_LAYOUT_R1.md`. Record actual files, before/after hashes, behavior changes/preservation, commands/results, limitations and rollback. Do not copy the documentation-preparation record as proof of implementation.
- [ ] Prepend a scoped current-status entry preserving all old content. State implementation/automated/manual stages separately. Keep deferred issues separate.
- [ ] Prepare complete changed files and compact evidence, not a fragile text-replacement runner. A user-run delivery should consist of one full package plus one standalone PowerShell runner. Use only guard clauses/separate if blocks, native parser preflight and explicit exit checks. Verify a bounded backup before any real source install, and verify evidence readback before cleanup.
- [ ] Hand back the actual source inventory, focused/full reports, support-preservation proof, change record, risks and next checkpoint. Default status is **AUTOMATED GREEN / MANUAL PENDING**, not CLOSED.
- [ ] After automated evidence review and the operator's build checkpoint, create/verify one fresh portable with the existing build system. This updates generated build metadata as already documented. Do not change native warnings, and do not open the user's database automatically.
- [ ] Obtain same-scale WebView2 screenshots and geometry measurements, keyboard/resize/theme checks and TEST-only approval-preservation evidence. The validation checklist names each case. Any newly necessary database operation requires explicit confirmation of the backed-up TEST copy.
- [ ] Stop before final source snapshot or broader Official Imports closure. Layout acceptance does not resolve outstanding list/runtime performance issues or automatically complete prior manual approval checks.

## Stop conditions

Stop on source mismatch, missing full source, unknown preexisting target, unapproved dependency download, necessary extra production owner, hidden/clipped safety information, failing regression or unverifiable manual result. Report the exact evidence and next safe action. Do not reconstruct missing source from memory, quietly replace expected hashes, bypass validation, or invoke old package installers.
