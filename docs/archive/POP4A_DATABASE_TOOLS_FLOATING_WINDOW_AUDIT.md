# POP4A_DATABASE_TOOLS_FLOATING_WINDOW_AUDIT

**Date**: May 18, 2026
**Target Branch**: `gemini-release-qa-20260512`

## 1. Scope
The goal of this audit is to evaluate the `DatabaseToolsDialogs` component and its internal sub-dialogs before migrating them to the `FloatingWindow` foundation. This phase focus on identifying inventory, state models, and risks without performing any implementation.

## 2. Verified Git State
- **Current Branch**: `gemini-release-qa-20260512`
- **HEAD Commit**: `15f5258 Migrate settings dialog to floating window`
- **Recent Tags**: `pop3b-settings-floating-window-migration-20260518`
- **Working Tree**: Clean (excluding untracked session logs).

## 3. Files Inspected
- `src/components/DatabaseToolsDialogs.tsx`: Contains Quote Editor, Merge Symbols, Corporate Action dialogs and `ModalShell`.
- `src/components/BinaryEodParityDialog.tsx`: Contains the Binary Parity Audit dialog.
- `src/components/FloatingWindow.tsx`: The target foundation component.
- `src/components/WindowTray.tsx`: Minimized window management.
- `src/store/windowStore.ts`: Global window state.
- `src/store/uiStore.ts`: Current UI toggles.
- `src/RootApp.tsx`: Top-level mount points.

## 4. Database Tools Inventory

### 4.1 Quote Editor Dialog
- **Purpose**: Manual entry and modification of EOD price data (OHLCV + OI).
- **Complexity**: High. Includes a search/load form, a data entry form, and a large scrollable table of quotes (limited to 500 rows).
- **Data Loading**: Fetches data from `api.listQuotes` on "Load".
- **Mutations**: `api.upsertQuote`, `api.deleteQuote`.
- **Resizing**: Currently uses `ModalShell` with `resizable={true}`.

### 4.2 Merge Symbols Dialog
- **Purpose**: Merges EOD history from one symbol into another.
- **Complexity**: Medium. Small form with several checkboxes and text inputs.
- **Mutations**: `api.mergeSymbols`.
- **Resizing**: Fixed size in `ModalShell` (width 480).

### 4.3 Corporate Action Dialog
- **Purpose**: Applies splits, bonuses, and identity changes (symbol/name).
- **Complexity**: Medium. A multi-field form that toggles inputs based on the selected "Action" type. Includes a preview for the adjustment factor.
- **Mutations**: `api.applyCorporateAction`.
- **Resizing**: Fixed size in `ModalShell` (width 520).

### 4.4 Binary EOD Parity Dialog
- **Purpose**: Validates data consistency between SQLite and Binary EOD backends.
- **Complexity**: Medium. Controls for scope, a status panel, a summary panel, and a large scrollable issues table (limited to 500 rows).
- **Resizing**: Hardcoded fixed size (900x600) with its own custom backdrop implementation.

## 5. Current ModalShell Architecture
- **Wrapper**: Uses an absolute positioned backdrop (`background: rgba(6, 10, 15, 0.48)`) with `zIndex: 40`.
- **Centering**: Uses `display: grid; placeItems: 'center'`.
- **Resize**: Implements resizing via pure CSS: `resize: both` and `overflow: auto` on the modal container.
- **Header**: Hardcoded title and "x" button.
- **Closing**: Clicking the backdrop triggers `onClose`.

## 6. Current Open/Close State Model
All tools are managed via `useUiStore`:
- **Quote Editor**: `quoteEditorOpen`, `openQuoteEditor()`, `closeQuoteEditor()`.
- **Merge Symbols**: `mergeSymbolsOpen()`, `openMergeSymbols()`, `closeMergeSymbols()`.
- **Corporate Action**: `corporateActionOpen()`, `openCorporateAction()`, `closeCorporateAction()`.
- **Binary Parity**: `binaryEodParityOpen()`, `openBinaryEodParity()`, `closeBinaryEodParity()`.

Currently, none of these have request counters for repeated open requests.

## 7. Current Resize/Scroll Behavior
- **Resize**: The Quote Editor is the only one utilizing the `ModalShell`'s CSS resize. This allows the user to expand the dialog to see more table rows or wider form fields.
- **Scrolling**:
  - `ModalShell` body has `overflow: auto` (via styles or the resizable property).
  - Internal tables (Quote Editor and Binary Parity) have their own `overflow: auto` on `quotesBodyStyle` / `tableBodyStyle`.

## 8. FloatingWindow Compatibility Assessment
- **Direct Replacement**: `FloatingWindow` can replace `ModalShell` for each dialog.
- **Coordination**: Each dialog should be refactored to register its own unique window ID with `windowStore`.
- **Z-Index**: `FloatingWindow` uses `zIndex` starting at 100+, which is higher than the current `ModalShell` (40). This is safe.
- **Resize Handling**: `FloatingWindow` uses a custom JS-based resize handle at the bottom-right. The `ModalShell` CSS `resize: both` should be removed to avoid conflict.
- **Backdrop removal**: Since `FloatingWindow` is modeless by design, the blocking backdrops in `ModalShell` and `BinaryEodParityDialog` will be removed.

## 9. Repeated Open Request Requirements
To match the UX of FAQ and Settings, the following request counters should be added to `uiStore`:
- `quoteEditorOpenRequestCount`
- `mergeSymbolsOpenRequestCount`
- `corporateActionOpenRequestCount`
- `binaryEodParityOpenRequestCount`

These will ensure that clicking the menu item while a tool is minimized restores and focuses it.

## 10. Data/Unsaved State Risk Assessment
- **Quote Editor**: High risk. Users might fill out a "New" quote or edit an existing row and then minimize to check the chart. Using `FloatingWindow` with the internal tray strategy preserves the component instance, so unsaved state is retained.
- **Data Reload**: Currently, `QuoteEditorDialog` reloads its initial symbol/exchange from the active instrument via `useEffect`. If a user is mid-edit, a repeated trigger should **not** reload this instrument from the chart store if the dialog is already open (following the SettingsDialog pattern).

## 11. Recommended POP4B Implementation Strategy
The most stable path is a **single-phase migration of the DatabaseToolsDialogs container**:
1. Update `uiStore.ts` with the 4 missing request counters.
2. Refactor `DatabaseToolsDialogs.tsx`:
   - Replace each of the 3 internal dialogs (`QuoteEditorDialog`, `MergeSymbolsDialog`, `CorporateActionDialog`) with their `FloatingWindow` counterparts.
   - Assign stable IDs: `quote-editor`, `merge-symbols`, `corporate-actions`.
   - Set initial bounds to match or slightly exceed current hardcoded widths.
3. Refactor `BinaryEodParityDialog.tsx`:
   - Replace its custom backdrop/modal with `FloatingWindow`.
   - Assign stable ID: `binary-parity-audit`.
4. Remove the now-unused `ModalShell` and its related styles.

## 12. Files Likely To Change In POP4B
- `src/components/DatabaseToolsDialogs.tsx`
- `src/components/BinaryEodParityDialog.tsx`
- `src/store/uiStore.ts`
- `POP4B_DATABASE_TOOLS_FLOATING_WINDOW_MIGRATION_REPORT.md` (New)

## 13. Files Changed In This Audit
- `POP4A_DATABASE_TOOLS_FLOATING_WINDOW_AUDIT.md` (New)

## 14. Validation Performed
- `git status --short`: Verified no accidental code changes.
- `git diff --check`: Verified markdown integrity.

## 15. Final Recommendation
The `DatabaseToolsDialogs` suite is ready for migration. The primary technical requirement is ensuring that `QuoteEditorDialog` does not overwrite unsaved form data on repeated open requests, and that the `FloatingWindow` resize handle correctly replaces the legacy CSS `resize: both` behavior.
