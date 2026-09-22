# Sheets Persistence Report

## Historical Note
This report is preserved as a historical snapshot only. The current live behavior is superseded by `CHART_WINDOW_SHEETS_REFACTOR_REPORT.md`: sheets are no longer persisted through a separate global `localStorage` path and instead round-trip as per-chart-window workspace state inside the shared autosave/named-layout payload.

## Review
Sheet persistence implemented using `localStorage` for cross-runtime compatibility (Electron + Tauri). Sheets now survive app restarts. `layoutMode` is captured and restored. Rename sheet added via inline UI in toolbar.

## Backup Created
`D:\TA Projects\EOD Charting Platform\backups\pre_sheets_persistence_20260401_024537`

## Files Added
- `SHEETS_PERSISTENCE_REPORT.md`

## Files Modified
- `src/store/chartStore.ts` — Added `Sheet.layoutMode` field, `renameSheet` action, `persistSheets`/`loadPersistedSheets` via `localStorage`, sheets loaded from storage on init
- `src/components/Toolbar.tsx` — Added rename button (✎) and inline rename input for current sheet

## Markdown Files Updated
- `SHEETS_PERSISTENCE_REPORT.md` (created)

## Key Sheet Persistence Features Completed

### How Sheets Are Stored
- **Storage mechanism**: `localStorage` with key `eod-chart.sheets.v1`
- **Format**: JSON array of `Sheet` objects
- **Cross-runtime**: Works in both Electron and Tauri since `localStorage` is available in both webviews
- **Sanitization**: On load, sheets are validated to ensure `id`, `name`, and `workspace` fields exist
- **Error handling**: If localStorage is full or unavailable, sheets are lost on reload (graceful degradation)

### Existing Layout Persistence APIs
- **Not reused for sheets**: The existing `api.saveLayout()`/`api.loadLayout()` system uses the desktop API bridge which requires a database connection. Sheets use `localStorage` instead, which:
  - Works without a database being open
  - Is simpler and more reliable for lightweight workspace snapshots
  - Is available in both Electron and Tauri runtimes
  - Doesn't require changes to the Electron IPC layer or Tauri commands

### `layoutMode` Included
- ✅ `layoutMode: 'single' | 'tile'` is now part of the `Sheet` interface
- ✅ Captured when saving: `saveCurrentAsSheet` stores the current `layoutMode`
- ✅ Restored when loading: `loadSheet` sets `layoutMode` before calling `loadWorkspaceFromLayout`

### How Rename Works
- Click the ✎ (edit) button next to the sheet selector in the toolbar
- Inline input appears with current sheet name pre-filled
- Type new name → press Enter or click "OK" to confirm
- Press Escape or click × to cancel
- Rename updates the sheet in `localStorage` immediately

### What a Sheet Saves
- Chart tabs (id, title, instrument, timeframe)
- Active chart tab ID
- Each tab's viewport, indicators, drawings, indicator pane height
- `layoutMode` (single or tile)
- Creation timestamp

## Validation
- ✅ `npm run typecheck:renderer` — PASSED
- ✅ `npm run typecheck:electron` — PASSED
- ✅ `npm run build:electron` — PASSED
- ✅ `npm run build:renderer` — PASSED (467 modules, 4.09s)
- ✅ `npm run build` — PASSED (full pipeline)
- ✅ `npm run tauri:build` — PASSED (6m 39s)
- ✅ `npm run tauri:portable:win` — PASSED

## Runnable Build Output
- **`npm run tauri:portable:win` was run**: YES
- **Output location**: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\`
- **Launcher to use**: `Launch Portable EOD Chart.cmd`
- **Contents**:
  - `EOD Chart.exe` (14.7 MB) — Tauri portable executable
  - `Launch Portable EOD Chart.cmd` — Batch launcher
  - `portable-data/` — Runtime state directory
  - `README.txt` — Usage instructions

## Limitations (Honest Assessment)
- **localStorage-bound**: Sheets are stored in the browser's localStorage, which has size limits (~5-10MB). For most workspace snapshots this is fine, but very large sheet collections could hit limits.
- **No cross-machine sync**: Sheets are local to the machine/browser profile.
- **No sheet import/export**: Cannot share sheets between machines or backup externally.
- **No sheet descriptions**: Only name and timestamp are stored.
- **No sheet reordering**: Sheets appear in creation order.
- **No per-sheet tiling presets**: `layoutMode` is saved, but individual tile arrangements are not.

## What Remains for Later Sheet-Management Polish
- Sheet import/export (JSON file)
- Sheet descriptions/metadata
- Sheet reordering (drag to reorder)
- Cross-machine sync via cloud or file sharing
- Per-sheet tile layout presets
- Sheet duplication (save as copy)
- Sheet history/versioning
