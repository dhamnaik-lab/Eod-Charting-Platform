# DBSAVE1_ACTIVE_DATABASE_SAVE_AUDIT_20260517.md - Database Save Audit

## Summary
The EOD Charting Platform employs a "continuous persistence" model where price data, watchlists, and settings are committed to SQLite or Binary storage immediately upon mutation. UI-heavy state (chart tabs, sheets, drawings, and indicators) is persisted via a throttled autosave mechanism (260ms delay) into the database's metadata table. This audit evaluates the risks of this model and designs a manual "Save" action to supplement it.

## Files Inspected
- `src-tauri-shell/src/main.rs`: Window close handling and menu definitions.
- `src/store/chartStore.ts`: Workspace autosave orchestration.
- `src/features/workspace/workspaceService.ts`: SQLite settings bridge.
- `src/features/workspace/workspacePersistence.ts`: Workspace serialization logic.
- `src-tauri-shell/src/database/settings.rs`: Backend settings persistence.

## Current Menu Behavior
The **Database** menu currently focuses on lifecycle and data management:
- New / Open / Close / Delete Database
- Quote Editor / Merge Symbols / Corporate Actions
- Binary EOD Parity Audit
- **Missing:** Any "Save" action (as the app relies on autosave).

## Current Autosave/Persistence Behavior
| State Type | Storage Location | Persistence Trigger |
| :--- | :--- | :--- |
| **Price Data** | `.eod` (Binary) or SQLite | Immediate on import/download/edit. |
| **Watchlists** | SQLite (`watchlists` table) | Immediate on create/add/remove. |
| **App Settings** | SQLite (`settings` table) | Immediate on change (e.g., Theme). |
| **Workspace State** | SQLite (`settings` table) | Throttled (260ms) after UI interaction. |
| **UI Flags** | Browser `localStorage` | Immediate (Sidebar width, collapsed state). |

## Current App-Close Persistence Behavior
- The Tauri backend listens for `CloseRequested` in `main.rs`.
- It currently logs the event and exits the process immediately.
- **Risk:** If a user makes a change (e.g., draws a line) and closes the app within 260ms, the change is lost because the frontend autosave timer is cancelled/terminated before it can fire.

## State Classification Table
| Data Type | Where Stored | When Persisted | Risk if App Closes |
| :--- | :--- | :--- | :--- |
| Quotes/Data | Filesystem | Immediate | Low (atomic writes). |
| Watchlists | SQLite DB | Immediate | Very Low. |
| Layouts/Tabs | SQLite DB | 260ms Delay | Low (last ~1/4 second lost). |
| Drawings | SQLite DB | 260ms Delay | Low. |
| Viewport | SQLite DB | 260ms Delay | Low. |
| DB Path | SQLite DB | Immediate | Very Low. |

## Gaps or Risks Found
1. **Closing Race Condition:** The 260ms delay in `chartStore.ts` creates a small window where data is not yet saved.
2. **User Anxiety:** In professional software, users often expect a manual "Save" action to confirm their work is safe, even if autosave is present.
3. **No "Flush" on Exit:** The app does not attempt one final synchronous save before terminating.

## Recommended Meaning of “Save Current Active Database”
The action should be implemented as a **Manual Workspace Flush**. 
- It should not copy files (the user didn't ask for "Save As").
- It should immediately execute `writeWorkspaceLayoutSetting` with the latest state, bypassing the timer.
- **Recommended Label:** `Database > Save Workspace State` or `Database > Save Current Workspace`. (The user suggested `Save Current Active Database`; I recommend adding a subtitle or tooltip: "Saves current chart tabs, layouts, and drawings").

## Proposed DBSAVE2 Implementation Plan
1. **Frontend:** Add a `saveWorkspace()` action to `chartStore.ts` that cancels the timer and calls the persistence service immediately.
2. **Menu:** Add `MENU_SAVE_WORKSPACE` to `main.rs`.
3. **Router:** Wire the menu command to the `saveWorkspace()` action.
4. **Hardening:** Update the `CloseRequested` handler in `main.rs` to potentially emit a "prepare-to-close" event to the frontend (though Alt+F4 is hard to catch reliably, the native Close button can be). *Correction: Keep it simple; the manual save button solves the primary user request.*

## Files Likely to Change in DBSAVE2
- `src-tauri-shell/src/main.rs` (Menu definition)
- `src/store/chartStore.ts` (Immediate save action)
- `src/features/app/menuCommandRouter.ts` (Routing)

## Manual QA Checklist for Implementation
- [ ] Make a drawing change, wait > 1s, restart app. Confirm saved (Existing behavior).
- [ ] Make a drawing change, click "Save Workspace", immediately Alt+F4. Restart app. Confirm saved.
- [ ] Verify that clicking "Save" while no database is open is disabled or handled gracefully.
- [ ] Verify the success toast appears: "Workspace saved successfully."

## Git Status
```bash
?? NEXT_SMALL_IMPLEMENTATION_PHASES_20260517.md
?? CV1_CHART_VIEWPORT_RESTORE_AUDIT_20260517.md
?? DBSAVE1_ACTIVE_DATABASE_SAVE_AUDIT_20260517.md
```
No implementation code was changed in this phase.
