# NEXT_SMALL_IMPLEMENTATION_PHASES_20260517.md - Planning Document

## Project Name
EOD Charting Platform

## Branch
gemini-release-qa-20260517 (Current active: gemini-release-qa-20260512)

## Latest Known State
- **HEAD:** f18d33d Harden NSE index bhavcopy redownload skip logic
- **Tag:** qe3-d1-nse-index-redownload-skip-logic-20260517
- **Stable State:** Stability S1A–S1E completed. Quote Editor resizable (QE1). Quote Delete fixes (QE2). Bhavcopy/NSE Index update fixes (QE3).

---

## Non-Negotiable Guardrails
- **Tauri-only:** No Electron remnants.
- **SQLite:** Mandatory for metadata, watchlists, settings, and logs.
- **Binary Default:** New databases create Binary mode by default.
- **No Refactor:** No broad architectural changes unless specifically requested.
- **Small Phases:** One task at a time with validation.
- **Preserve QE3:** Ensure Bhavcopy and Chart Refresh logic remains working.
- **Documentation Only:** This phase is for planning; no code changes implemented yet.

---

## Phase-by-Phase Roadmap

### Phase WIN1: Maximize Application on Startup
- **Goal:** Open application maximized/full window by default.
- **Type:** Low-risk implementation.
- **Expected files to inspect:**
  - `src-tauri-shell/tauri.conf.json`
  - `src-tauri-shell/src/main.rs`
- **Likely changes:**
  - Update `tauri.conf.json` window configuration or add `window.maximize()` in `main.rs` setup.
- **Validation:**
  - `npm run tauri:check`
- **Manual QA:** Verify app starts maximized on launch.
- **Commit/Tag:** `win1-open-maximized-20260517`

### Phase FAQ1: Help > FAQ Implementation
- **Goal:** Add "Help > FAQ" to the native menu bar with comprehensive user info.
- **Type:** UI/static-help implementation.
- **Suggested Content:**
  - Getting Started (Creating/Opening Databases)
  - Bhavcopy Downloads (NSE/BSE setup)
  - Watchlist Management
  - Chart Operations (Tabs, Sheets, Indicators, Drawings)
  - Quote Editor usage
- **Expected files to inspect:**
  - `src-tauri-shell/src/main.rs` (Native menu definition)
  - `src/store/uiStore.ts` (Dialog visibility state)
  - `src/RootApp.tsx` (Dialog mounting)
- **Likely changes:**
  - Create `src/components/FAQDialog.tsx`.
  - Add `MENU_OPEN_FAQ` to `main.rs`.
- **Validation:**
  - `npm run typecheck:renderer`
  - `npm run tauri:check`
- **Manual QA:** Click Help > FAQ and verify content readability.
- **Commit/Tag:** `faq1-help-faq-20260517`

### Phase W1A: Persistent Watchlist Import Window
- **Goal:** Import Watchlist Groups window should remain open after an import operation.
- **Type:** Narrow UI behavior fix.
- **Expected files to inspect:**
  - `src/components/OfficialWatchlistImportDialog.tsx`
- **Likely changes:**
  - Remove `closeDialog()` call inside `handleImport` success path.
- **Validation:**
  - `npm run typecheck:renderer`
- **Manual QA:** Import a watchlist group and confirm window stays open for further selections.
- **Commit/Tag:** `w1a-watchlist-import-window-stays-open-20260517`

### Phase CV1: Chart Viewport Restoration Audit
- **Goal:** Ensure chart position (viewport) is restored when switching between tabs or sheets.
- **Type:** Audit-only first.
- **Expected files to inspect:**
  - `src/store/chartStore.ts` (Viewport state management)
  - `src/components/ChartTabs.tsx`
  - `src/components/SheetTabs.tsx`
  - `src/components/ChartCanvas.tsx` (Viewport synchronization)
- **Investigation:** Identify if `syncViewport` is lost during component unmount/remount on tab switch.
- **Manual QA:** Pan chart, switch tabs, switch back, confirm position is identical.
- **Commit/Tag:** `cv1-chart-viewport-restore-audit-20260517`

### Phase DBSAVE1: Database Save Audit
- **Goal:** Audit "Database > Save Current Active Database" behavior and persistence.
- **Type:** Audit-only first.
- **Requirements:**
  - Existing autosave must remain.
  - Secondary manual save option requested.
  - Confirm settings/layout/workspace state are saved on close.
- **Expected files to inspect:**
  - `src-tauri-shell/src/main.rs`
  - `src/store/workspaceStore.ts`
  - `src/store/chartStore.ts` (Autosave logic)
- **Commit/Tag:** `dbsave1-active-database-save-audit-20260517`

### Phase SRC1: Bhavcopy Source URL Configuration Audit
- **Goal:** Enable URL/Template updates for Bhavcopy downloads inside the window.
- **Type:** Audit-only first.
- **Requirements:**
  - Preserve QE3 logic.
  - Identify hardcoded templates in Rust backend.
  - Design UI for overrides, testing, and resetting.
- **Expected files to inspect:**
  - `src-tauri-shell/src/bhavcopy.rs` (Hardcoded URLs)
  - `src/components/BhavcopyDownloadWindow.tsx`
- **Commit/Tag:** `src1-bhavcopy-source-url-audit-20260517`

### Phase W1B: Already-Imported Watchlist Indicator
- **Goal:** Show an indicator for watchlists already present in the workspace.
- **Type:** Audit first, then small implementation.
- **Expected files to inspect:**
  - `src/components/OfficialWatchlistImportDialog.tsx`
  - `src/store/chartStore.ts` (Snapshot watchlists list)
- **UI Recommendation:** Dim or add a checkmark to rows in the import list if the name/source ID matches an existing watchlist.
- **Commit/Tag:** `w1b-watchlist-imported-indicator-20260517`

### Phase POP1: Modal Architecture Audit
- **Goal:** Audit popup/modal architecture for move/resize/maximize/minimize support.
- **Type:** Audit-only first.
- **Expected files to inspect:**
  - `src/RootApp.tsx` (Dialog mounting)
  - `src/components/` (Dialog implementations)
- **Investigation:** Check for shared CSS or component wrappers that can be enhanced to support window-like behavior.
- **Commit/Tag:** `pop1-modal-architecture-audit-20260517`

---

## Recommended Execution Order
1. **WIN1** (Maximized startup) - High visibility, low risk.
2. **FAQ1** (FAQ Content) - Static UI, low risk.
3. **W1A** (Watchlist window persistence) - Tiny fix, high utility.
4. **CV1 Audit** (Viewport restoration) - Performance/UX stability.
5. **DBSAVE1 Audit** (Save behavior) - Core data safety.
6. **SRC1 Audit** (Bhavcopy URLs) - Long-term maintainability.
7. **W1B Audit/Impl** (Import indicator) - UX polish.
8. **POP1 Audit** (Modal architecture) - Complex architectural task.

---

## Risk Table

| Phase | Risk Level | Reason | Mitigation |
| :--- | :--- | :--- | :--- |
| WIN1 | Low | Standard Tauri config. | Revert config if window fails to open correctly. |
| FAQ1 | Low | Purely additive UI. | None needed. |
| W1A | Very Low | Simple UI flag change. | None needed. |
| CV1 | Medium | Viewport logic is complex. | Audit only; do not change engine code yet. |
| DBSAVE1 | Medium | Affects data persistence. | Verify autosave remains untouched. |
| SRC1 | Medium | Bhavcopy logic is sensitive. | Audit only; use current working URLs as fallbacks. |
| W1B | Low | Read-only state check. | Ensure comparison logic is robust to name changes. |
| POP1 | High | Shared component changes. | Audit only; propose a non-breaking wrapper. |

---

## Validation Section
Standard commands to be run after each implementation turn:
- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build` (Full build for final verification)
- **Manual QA:** Exhaustive testing of the specific feature and related regressions.

---

## Git Discipline
- Execute phases sequentially.
- Branch per phase or clean HEAD for each turn.
- Tag after successful validation.
- Format: `<phase-id>-<description>-<date>` (e.g., `win1-open-maximized-20260517`)
