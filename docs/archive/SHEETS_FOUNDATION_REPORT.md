# Sheets Foundation Report

## Historical Note
This report is preserved as the original foundation snapshot only. The current live behavior is superseded by `CHART_WINDOW_SHEETS_REFACTOR_REPORT.md`: sheets are now owned by each chart window/tab and no longer rely on the original global sheet model described below.

## Review
Sheet foundation implemented as a thin wrapper over the existing workspace persistence system. Sheets are in-memory named workspace snapshots that can be saved, loaded, and deleted. No file I/O added — sheets live in Zustand store state for this first version.

## Backup Created
`D:\TA Projects\EOD Charting Platform\backups\pre_sheets_foundation_20260401_022515`

## Files Added
- `SHEETS_FOUNDATION_REPORT.md`

## Files Modified
- `src/store/chartStore.ts` — Added `Sheet` interface, `sheets`/`activeSheetId` state, `saveCurrentAsSheet`/`loadSheet`/`deleteSheet` actions
- `src/components/Toolbar.tsx` — Added sheet save button (💾), sheet selector dropdown, and sheet delete button to toolbar

## Markdown Files Updated
- `SHEETS_FOUNDATION_REPORT.md` (created)

## Key Sheet Foundation Features Completed

### What a Sheet Is in This Version
A sheet is a named snapshot of the current chart workspace state, stored in-memory in the Zustand store. Each sheet captures:
- All chart tabs (id, title, instrument, timeframe)
- Active chart tab ID
- Each tab's viewport, indicators, drawings, and indicator pane height
- Timestamp of when the sheet was created

### Where Sheet State Is Stored
- **In-memory only**: Sheets live in the Zustand `ChartStoreState` as `sheets: Sheet[]`
- **Not persisted to disk**: Sheets are lost on app reload (this is intentional for the foundation pass — persistence can be added later by wiring into the existing desktop API layout system)
- **Active sheet tracking**: `activeSheetId: string | null` tracks which sheet is currently loaded

### What Workspace State Is Included
Sheets reuse the existing `serializeWorkspaceState` / `PersistedChartWorkspace` format that the `LayoutManagerDialog` already uses. This means:
- Chart tabs with their instruments, timeframes, viewports
- Indicators per tab
- Drawings per tab
- Indicator pane heights
- Active chart tab ID

### How Save/Load Works
1. **Save**: Click the 💾 button in the toolbar → inline text input appears → type sheet name → press Enter or click "Save" → current workspace is serialized and stored as a new sheet
2. **Load**: Use the "Sheets..." dropdown in the toolbar → select a saved sheet → workspace is restored via the existing `loadWorkspaceFromLayout` function
3. **Delete**: Click the × button next to the sheet selector → confirms with dialog → removes the sheet

### UI Added
- 💾 save button — triggers inline name input
- "Sheets..." dropdown — lists all saved sheets, shows currently loaded sheet
- × delete button — removes the currently active sheet (with confirmation)
- All controls are compact (24px height) and placed at the left side of the toolbar controls

### What Was Intentionally Deferred
- **Sheet persistence to disk**: Sheets are in-memory only. Can be wired to the desktop API's layout save/load system in a later pass.
- **Rename sheet**: Not implemented. Delete and re-save works as a workaround.
- **Sheet import/export**: Not implemented.
- **Sheet-specific tiling presets**: Sheets capture whatever layout mode is active at save time, but don't have independent tiling configuration.
- **Sheet descriptions/metadata**: Only name and timestamp are stored.

## Validation
- ✅ `npm run typecheck:renderer` — PASSED
- ✅ `npm run typecheck:electron` — PASSED
- ✅ `npm run build:electron` — PASSED
- ✅ `npm run build:renderer` — PASSED (467 modules, 7.19s)
- ✅ `npm run build` — PASSED (full pipeline)
- No Rust/Tauri code changed — `cargo check` not needed
- No Tauri/platform behavior changed — `npm run tauri:build` not needed
- No renderer file outside `src/platform/*` imports Tauri packages

## Limitations (Honest Assessment)
- **In-memory only**: Sheets are lost on page reload. This is the biggest limitation. The next phase should wire sheet persistence to the existing desktop API layout storage.
- **No rename**: Users must delete and re-save to rename a sheet.
- **No sheet descriptions**: Only name and timestamp are stored.
- **Layout mode not explicitly saved**: The `layoutMode` (`'single' | 'tile'`) is not captured in the sheet's workspace snapshot. Sheets always restore to single mode since `loadWorkspaceFromLayout` doesn't set `layoutMode`.
- **No sheet reordering**: Sheets appear in the order they were created.

## Recommended Next Sheet-Management Phase
1. **Wire sheet persistence to desktop API**: Use `api.saveLayout()` / `api.loadLayout()` / `api.getSavedLayouts()` / `api.deleteLayout()` to persist sheets to disk, making them survive app restarts.
2. **Add layoutMode to sheet snapshots**: Capture and restore the layout mode (single/tile) when saving/loading sheets.
3. **Add rename sheet**: Inline rename in the sheet selector or a rename button.
4. **Add sheet descriptions**: Optional text field for describing what a sheet is for.
5. **Consider merging sheets with layouts**: Since both use the same underlying persistence mechanism, consider whether sheets should be a higher-level concept that wraps the existing layout system rather than duplicating storage.
