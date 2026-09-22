# Chart Tools Gap Report

## Audit Summary

The current codebase already contains a meaningful chart-tool implementation layer. This is not a case where chart tools are entirely missing.

What already exists today:

- drawing data types
- drawing mode selection
- drawing creation on chart click
- drawing previews
- drawing hit testing
- drawing selection
- drawing drag editing
- drawing properties editing
- drawing lock/delete/clear/undo-last actions
- drawing persistence through workspace autosave and named layouts

That means the main gap is not "build a drawing framework from zero". The main gap is "formalize, tighten, and safely extend the existing framework".

The low-risk phase-1 hardening pass is now complete for:

- horizontal line
- vertical line
- trend line
- drawing selection
- drawing delete
- escape cancel
- named layout `activeChartTabId` preservation

## What Already Exists

### Core drawing/tool infrastructure

- `ChartDrawing` and `DrawingTool` are already defined in `src/engine/types.ts`.
- `ChartEngine.ts` already creates, previews, selects, drags, and updates drawings.
- `Renderer.ts` already renders all current drawing kinds.
- `chartStore.ts` already persists drawings inside per-tab chart state.

### Tools already implemented in code

- cursor
- horizontal line
- vertical line
- trend line
- ray
- arrow
- rectangle
- text
- parallel channel
- fib retracement
- gann fan

### Supporting chart interaction already implemented

- crosshair with axis labels
- hover-bar propagation to header/readout UI
- mouse wheel zoom
- drag pan
- shift-wheel pan
- keyboard pan/zoom/reset
- chart tab isolation for bars/viewports/drawings
- drawing properties modal
- drawing context menu
- magnet snap to high/low
- menu-command bridges for Electron and Tauri

## What Is Partially Present

### Multi-chart tool isolation

Per-tab drawings, indicators, viewports, and selected drawing ids already exist, but:

- active tool mode is global
- magnet is global
- drawing-properties target is global
- tab switches and workspace/layout loads force cursor mode instead of restoring tab-specific tool mode

That is now an explicit product choice for the hardened baseline rather than an accidental gap.

### Keyboard / command surfaces

Keyboard support exists, but it depends on chart viewport focus.

Command palette support exists, but it is mostly:

- symbol search
- app commands

not chart-tool commands.

### Crosshair / hover / pane behavior

Crosshair and hover readout exist, but the interaction model is still price-pane-first rather than pane-aware.

## What Is Missing

These are the main missing pieces for a cleaner next phase:

- a more explicit tool registry or tool helper layer for adding new tools without editing several hard-coded switches
- tab-scoped tool-mode persistence if that behavior is desired
- stronger validation/versioning around saved drawing payloads
- chart-specific automated tests
- pane-aware interaction if future tools need indicator-pane placement

## Tool Area Classification

| Tool Area | Classification | Current State |
| --- | --- | --- |
| crosshair improvements | partially supported | Crosshair, axis labels, and hover propagation already exist; improvements would be polish on an existing system. |
| zoom improvements | partially supported | Wheel zoom, button zoom, keyboard zoom, and reset already exist. |
| pan improvements | partially supported | Drag pan, shift/horizontal-wheel pan, keyboard nudge, and native scrollbar pan already exist. |
| OHLC hover readout | already supported | Hover card, header metrics, and OHLCV bar all update from hover or latest bar. |
| drawing tool framework | already supported | There is already a working drawing model, creation flow, selection flow, edit flow, and persistence path. |
| horizontal line | already supported | Implemented end to end: tool button, hotkey, engine creation, render, select, edit, delete, persistence. |
| vertical line | already supported | Implemented end to end. |
| trend line | already supported | Implemented end to end. |
| drawing selection | already supported | Hit testing, selection, context menu, and properties targeting already exist. |
| drawing delete | already supported | Delete selected, clear all, undo last, menu command, dock command, and context menu all exist. |
| drawing persistence | already supported | Workspace autosave and named layout save/load both include drawings. |
| multi-chart tool isolation | partially supported | Drawings are per-tab, but active tool state and magnet state remain global by design; tool mode now resets to `cursor` on tab/workspace transitions. |
| keyboard cancel / escape handling | already supported | Escape returns to cursor mode, clears selection/context menu, and closes drawing properties. |

## Easiest Wins

These are the safest, highest-leverage follow-ups without changing the engine shape:

1. Add chart-focused smoke coverage:
   - tab switching
   - persistence round-trip
   - delete / escape / selection flows
2. Add a small internal helper pattern for new tools:
   - creation helper
   - hit-test helper
   - render helper
3. Add the next low-risk price-pane tools:
   - text note
   - rectangle
4. Revisit whether per-tab tool mode is worth the added state complexity only after the current baseline is manually proven

## Risky Areas

### 1. Adding more tools by copying the current pattern repeatedly

This is possible, but every tool touches multiple places:

- drawing union
- engine creation logic
- engine hit testing
- engine drag/update logic
- renderer logic
- dock/menu exposure

That is manageable for a few more tools, but it increases maintenance cost.

### 2. Treating advanced existing tools as production-ready without hardening

The repo already contains ray/arrow/rect/text/channel/fib/gann. The code is there, but the safest plan is still to harden the simpler tool subset first before broadening the officially supported surface.

### 3. Expanding into pane-aware tools too early

The current interaction model clamps pointer logic to the price pane. Tools that need indicator-pane interaction would be a higher-risk architectural step.

### 4. Ignoring persistence asymmetry

The active-tab named-layout gap is fixed, but persistence still assumes drawing payload compatibility and does not yet include explicit schema/version validation for drawing kinds.

## Safest Implementation Order

### Step 1

Stabilize and formalize the current low-risk tool path:

- horizontal line
- vertical line
- trend line
- selection
- delete
- escape/cancel
- persistence round-trip

Status: completed through the phase-1 hardening pass.

### Step 2

Manually validate and support the hardened baseline:

- tab switching
- persistence round-trip
- delete / escape / selection flows
- context-menu and properties interactions

### Step 3

Only after the above, add the next low-risk tool if needed:

- text note
- rectangle

Those still fit the current price-pane drawing model without forcing a larger architectural change.

### Step 4

After the simple tools are proven, revisit the more complex existing tools:

- channel
- fib retracement
- gann fan

These have more complex hit testing, render rules, and QA surface.

## Recommendation For Phase 1 Chart Tools

The safest phase-1 chart-tools batch is:

1. Horizontal line
2. Vertical line
3. Trend line
4. Selection
5. Delete
6. Escape cancel
7. Persistence verification

Important note:

- these are already implemented in code
- phase 1 should therefore be treated as a hardening and support-definition pass, not a greenfield build

## Recommendation For What Should Wait Until Later

These should wait until the simple path is formally hardened:

- channel
- fib retracement
- gann fan
- any tool that needs pane-aware interaction
- any attempt to redesign or rewrite the engine

## Bottom-Line Recommendation

Yes, chart tools can be added without rewriting the engine.

The safest next step is not a rewrite and not a new framework. The safest next step is:

- keep the existing React + Zustand + canvas-engine shape
- use the current `ChartDrawing` union and engine/renderer switch points
- keep the phase-1 hardening decisions explicit:
  - tool mode stays global + ephemeral
  - magnet stays global
- only then extend the tool set further

That approach preserves the current architecture, preserves the `src/platform/*` seam, and keeps Electron/Tauri runtime behavior aligned.
