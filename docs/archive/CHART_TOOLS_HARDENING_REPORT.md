# Chart Tools Hardening Report

Date: 2026-03-31

## Scope

This pass hardened the existing low-risk chart-tools baseline without redesigning the chart engine, without adding new runtime imports, and without touching the legacy `src-tauri` tree.

The goal was support-definition and state consistency, not new-tool expansion.

## What Behavior Was Hardened

### 1. Named layout fidelity

- Named layout save now uses the same serialized workspace shape as workspace autosave.
- `activeChartTabId` is now preserved in named layouts.
- Named layout load now uses the same parser/sanitizer path as workspace autosave instead of a separate ad hoc restore path.

### 2. Tool-state handling across chart tabs and workspace changes

- Active drawing tool state remains global after this change.
- That is intentional.
- The tool is treated as ephemeral UI intent, not persisted chart content.
- It now resets to `cursor` on:
  - chart-tab create
  - chart-tab activate
  - chart-tab close
  - workspace hydration
  - named layout load

This keeps the current multi-chart behavior low-risk and avoids carrying a live drawing mode into a different chart unexpectedly.

### 3. Magnet-state handling

- Magnet state remains global after this change.
- That is intentional.
- It is treated as a chart-input preference rather than a per-tab persisted chart property.

This was the safer choice for the current baseline because it avoids widening the persisted tab shape and avoids surprising cross-tab snapping differences.

### 4. Selection / delete / cancel UI cleanup

- `ChartCanvas.tsx` now clears stale drawing context menus when selection changes or is cleared.
- This makes tool switching, selection clearing, delete flows, and `Escape` behavior more predictable at the React-host layer.

## Current State Decisions

### Tool mode

- Global or per-tab: global
- Persistence: not persisted as chart content
- Behavior: explicitly reset to `cursor` on chart/workspace transitions

### Magnet

- Global or per-tab: global
- Persistence: not part of per-tab layout payload
- Behavior: preserved as a session-level chart-input preference

### Named layouts

- `activeChartTabId` preserved: yes
- Payload shape aligned with autosave: yes

## Files Added

- `CHART_TOOLS_HARDENING_REPORT.md`

## Files Modified

- `src/store/chartStore.ts`
- `src/components/LayoutManagerDialog.tsx`
- `src/components/ChartCanvas.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHART_ARCHITECTURE_AUDIT.md`
- `CHART_TOOLS_GAP_REPORT.md`
- `CHART_TOOLS_ADDITIONS_REPORT.md`

## Backup Location

- `backups/pre_opencode_changes_20260331_005437_chart_tools_hardening`

## Markdown Files Updated

- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHART_ARCHITECTURE_AUDIT.md`
- `CHART_TOOLS_GAP_REPORT.md`
- `CHART_TOOLS_ADDITIONS_REPORT.md`
- `CHART_TOOLS_HARDENING_REPORT.md`

## Validation

Validated in this pass:

- `npm run build`
- seam-purity check confirming no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`

Not rerun in this pass:

- `cargo check --manifest-path src-tauri-shell/Cargo.toml`
- `npm run tauri:build`
- `npm run tauri:portable:win`

Reason:

- this pass did not modify Rust, Tauri shell, or runtime/platform behavior

## What Should Be The Next Chart-Tools Step

The safest next step is:

1. Manually validate the hardened phase-1 baseline inside the portable Tauri runtime.
2. Confirm the full selection/delete/escape/layout round-trip behavior interactively.
3. Only then promote the first low-risk post-hardening additions.

The most reasonable low-risk additions after that are:

- text note
- rectangle
- stronger selected-drawing affordances

## Advanced Tools Intentionally Deferred

These remain intentionally deferred as officially hardened tools:

- ray
- arrow
- channel
- fib retracement
- gann fan
- any pane-aware drawing interaction
- any per-tab tool-mode redesign
- any chart-engine rewrite

## Bottom Line

This pass did not change the chart architecture. It tightened the existing path.

The result is:

- named layouts now preserve the active chart
- phase-1 drawing behavior is more internally consistent
- tool-mode and magnet decisions are now explicit instead of accidental
- the codebase is in a safer state for the next low-risk chart-tools phase
