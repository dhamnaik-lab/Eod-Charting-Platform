# Indicator Pane Controls Report

Date: 2026-04-07

## Summary

Added per-pane gear (settings) and close (remove) action buttons in the indicator pane area of
`ChartCanvas.tsx`, and extracted the indicator settings dialog out of `Toolbar.tsx` into a
shared `IndicatorSettingsDialog` component. The pane drag-resize was already fully implemented
in `ChartCanvas.tsx` and required no changes.

---

## What Changed

### Goal 1 — Pane settings gear button (new)

Each indicator pane now renders two small overlay buttons in its top-right corner (inside the
chart viewport, just left of the right axis at `right: 68`):

- **&#9881; gear** — opens `IndicatorSettingsDialog` for that pane's indicator; same dialog
  already used by Toolbar.tsx
- **× close** — calls `removeIndicator(id)` directly; red tint to signal destructive action

Buttons are positioned at `splitterTop + index * layout.paneHeight + 6` vertically, matching
the index ordering that the chart engine uses for pane layout. `zIndex: 7` puts them above the
pane resize handle (z=6) and below drawing menus/dialogs (z=9/10).

### Goal 2 — Shared `IndicatorSettingsDialog` component (new)

Extracted from `Toolbar.tsx` into `src/components/IndicatorSettingsDialog.tsx`:

- Props: `{ indicator: OverlayIndicator, onSave, onRemove, onClose }`
- Internal draft state (`useState(() => cloneIndicator(indicator))`)
- `useEffect([indicator.id])` resets draft only when a different indicator is opened while
  the component stays mounted (handles rapid switching in Toolbar)
- Contains all `IndicatorFields`, `NumberField`, `ColorField`, `toHexColor`, `toRgbaColor`
  helper functions (unchanged logic, moved from Toolbar)
- Dialog backdrop uses `position: fixed, zIndex: 40` — modal overlay over the full window

`onSave(updated)` and `onRemove(id)` delegate to the caller; closing is always the caller's
responsibility, keeping the component stateless with respect to open/closed.

`Toolbar.tsx` now renders `<IndicatorSettingsDialog>` conditionally on `activeIndicator`:
```tsx
{activeIndicator ? (
  <IndicatorSettingsDialog
    indicator={activeIndicator}
    onSave={(updated) => { updateIndicator(updated); setEditingIndicatorId(null); }}
    onRemove={(id) => { removeIndicator(id); setEditingIndicatorId(null); }}
    onClose={() => setEditingIndicatorId(null)}
  />
) : null}
```

`ChartCanvas.tsx` renders `<IndicatorSettingsDialog>` when a pane gear button is clicked:
```tsx
{paneSettingsIndicator ? (
  <IndicatorSettingsDialog
    indicator={paneSettingsIndicator}
    onSave={(updated) => { updateIndicator(updated); setPaneSettingsIndicatorId(null); }}
    onRemove={(id) => { removeIndicator(id); setPaneSettingsIndicatorId(null); }}
    onClose={() => setPaneSettingsIndicatorId(null)}
  />
) : null}
```

### Goal 3 — Pane drag-resize (already implemented)

The resize handle was already in `ChartCanvas.tsx` lines 651–674 (prior pass). No changes
needed. The handle sits at `top: splitterTop - 8`, spans `left: 10` to `right: 66`, and
calls `setIndicatorPaneHeight(startHeight - delta)` via mouse drag.

---

## Files Backed Up

`backups/pre_opencode_changes_20260407_201556_indicator_pane_controls/`

Contents: `src/components/Toolbar.tsx`, `src/components/ChartCanvas.tsx`

---

## Files Created

### `src/components/IndicatorSettingsDialog.tsx`
- `IndicatorSettingsDialog` — shared indicator settings dialog component
- `IndicatorFields` — per-kind field switch (all 14+ indicator kinds)
- `NumberField`, `ColorField` — field primitives
- `cloneIndicator`, `toHexColor`, `toRgbaColor` — helpers
- All dialog styles (dialogBackdropStyle, dialogPanelStyle, etc.)

---

## Files Modified

### `src/components/Toolbar.tsx`
- Removed: `useEffect`, `type Dispatch, type SetStateAction` imports
- Removed: `getIndicatorCatalogItemByKind` import
- Removed: `indicatorDraft` state, the draft-sync `useEffect`
- Removed: inline dialog JSX block
- Removed: `IndicatorFields`, `NumberField`, `ColorField`, `cloneIndicator`,
  `toHexColor`, `toRgbaColor` function definitions
- Removed: `dialogBackdropStyle`, `dialogPanelStyle`, `dialogHeaderStyle`,
  `dialogCloseStyle`, `dialogBodyStyle`, `dialogPlacementStyle`, `dialogFooterStyle`,
  `fieldStyle`, `inputStyle`, `colorInputStyle` style constants
- Added: `import { IndicatorSettingsDialog } from './IndicatorSettingsDialog'`
- Added: `{activeIndicator ? <IndicatorSettingsDialog ... /> : null}` in JSX

### `src/components/ChartCanvas.tsx`
- Added: `import { IndicatorSettingsDialog } from './IndicatorSettingsDialog'`
- Added: `updateIndicator`, `removeIndicator` store hooks
- Added: `paneIndicators` useMemo (overlays filtered to `placement === 'pane'`)
- Added: `paneSettingsIndicatorId` useState
- Added: `paneSettingsIndicator` useMemo (finds indicator by id in overlays)
- Added: per-pane gear/close button overlay divs (positioned by pane index)
- Added: `<IndicatorSettingsDialog>` conditional render for pane settings
- Added: `paneActionButtonStyle` constant

---

## Validation

```
npm run test               →  2 files, 54 tests passed
npm run typecheck:renderer →  clean (0 errors)
npm run tauri:check        →  Finished dev profile (1m 09s) — no changes to Rust
npm run build              →  typecheck clean + tauri:check clean +
                               build:renderer 486 modules in 9.38s — exit 0
npm run tauri:portable:win →  Built release (7m 15s) + staged clean
```

Portable folder check:
- `EOD Chart.exe` ✓
- `index.html` ✓
- `assets/` ✓
- `Launch Portable EOD Chart.cmd` ✓

Output: `release/tauri-portable-win/EOD Chart Portable/`

---

## Behavior Preserved

- Toolbar indicator list click still opens the settings dialog (unchanged flow)
- Toolbar remove button (x) still calls `removeIndicator` directly (unchanged)
- Pane resize drag handle unchanged at `splitterTop - 8`
- Drawing tools, zoom/pan, pane-aware drawing, crosshair — unaffected
- All price pane overlays and main chart rendering — unaffected
- Test suite: 54/54 passing (no test changes required; extracted functions are pure)
