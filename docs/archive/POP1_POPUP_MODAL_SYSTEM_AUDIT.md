# POP1 — Popup/Modal/Dialog System Audit

**Date**: May 18, 2026
**Target Branch**: `gemini-release-qa-20260512`

## 1. Scope
The goal of this audit is to evaluate the existing modal, popup, and dialog architecture in the EOD Charting Platform. This document identifies current implementation patterns, assesses risks, and recommends a safe, phased rollout plan for introducing global movable, resizable, maximize, and minimize behaviors (in upcoming phases POP2+). No application code changes were made during this audit phase.

## 2. Verified Git State
- **Current Branch**: `gemini-release-qa-20260512`
- **HEAD Commit**: `c0cf812 Add bhavcopy source settings popup`
- **Recent Tags**: `src2b-bhavcopy-source-settings-popup-20260518`, `w1b-already-imported-watchlist-indicator-20260518`
- **Working Tree**: Clean (excluding untracked audit/log files).

## 3. Files Inspected
- `src/RootApp.tsx`
- `src/store/uiStore.ts`
- `src/components/FAQDialog.tsx`
- `src/components/DatabaseToolsDialogs.tsx`
- `src/components/BhavcopyDownloadWindow.tsx`
- `src/components/BhavcopySourceSettingsDialog.tsx`
- `src/components/ChartCanvas.tsx`
- `src/components/Sidebar.tsx`

## 4. Popup/Modal/Dialog Inventory

### 4.1 Modals using Shared Infrastructure
- **Quote Editor, Merge Symbols, Corporate Actions**
  - **File**: `src/components/DatabaseToolsDialogs.tsx`
  - **Type**: Uses an internal shared `ModalShell` component.
  - **Resize Behavior**: The Quote Editor passes `resizable={true}`. The `ModalShell` implements this using pure CSS (`resize: both`, `overflow: auto`).
  - **Movable/Minimize**: None.

### 4.2 Modals using Custom Inline Overlays
The vast majority of dialogs use inline JSX patterns (`<div style={overlayStyle}><div style={dialogStyle}>...</div></div>`). They do **not** support resizing, moving, maximizing, or minimizing. They rely on flexbox centering.
- **BhavcopyDownloadWindow** (`src/components/BhavcopyDownloadWindow.tsx`)
- **BhavcopySourceSettingsDialog** (`src/components/BhavcopySourceSettingsDialog.tsx` - Nested inside Bhavcopy window)
- **FAQDialog** (`src/components/FAQDialog.tsx`)
- **SettingsDialog** (`src/components/SettingsDialog.tsx`)
- **OfficialWatchlistImportDialog** (`src/components/OfficialWatchlistImportDialog.tsx`)
- **ImportCsvDialog** (`src/components/ImportCsvDialog.tsx`)
- **DeleteDatabaseDialog** (`src/components/DeleteDatabaseDialog.tsx`)
- **LayoutManagerDialog** (`src/components/LayoutManagerDialog.tsx`)
- **WatchlistManagerDialog** (`src/components/WatchlistManagerDialog.tsx`)
- **BinaryEodParityDialog** (`src/components/BinaryEodParityDialog.tsx`)
- Various Chart-related dialogs (`ChartDrawingPropertiesDialog`, `IndicatorPickerDialog`, etc.)

## 5. Current Architecture Patterns
1. **Centering Strategy**: Almost all overlays use `display: flex; align-items: center; justify-content: center`.
2. **State Management**: Most dialogs are toggled via global boolean flags in `src/store/uiStore.ts`. Nested dialogs (like Source Settings) use local component state (`useState`).
3. **Backdrops**: Dialogs currently use blocking, semi-transparent backdrops (`backgroundColor: 'rgba(0, 0, 0, 0.65)'`). Clicking the backdrop often closes the dialog.

## 6. Risk Assessment for Global Move/Resize
1. **Layout Paradigm Shift**: Making dialogs movable requires changing from `flex` centering to absolute/fixed positioning with top/left coordinates. Incorrect initial calculations could cause dialogs to render off-screen.
2. **Viewport Overflow (Lost Windows)**: Draggable windows can be dragged outside the visible viewport. Boundary constraints must be enforced during the `mousemove` handler.
3. **Modality vs. Modeless (Z-Index Management)**: If dialogs become floating panels (modeless), the blocking backdrops must be removed. This creates a need for an internal "Window Manager" to handle active z-indexes (bringing the clicked panel to the front).
4. **Nested Popups**: `BhavcopySourceSettingsDialog` is nested. If the parent `BhavcopyDownloadWindow` is minimized, the child must be hidden or correctly parented in the new window management system.
5. **State Loss on Minimize**: If "Minimize" simply unmounts the component, any unsaved local state (e.g., text in an input field) will be lost. Minimized windows must remain mounted but visually hidden (or stored safely).

## 7. Minimize Strategy Analysis

### Option A: Internal Minimized-Dialog Tray (React/DOM)
- **Description**: Windows are managed inside the React app. When minimized, they visually shrink to a "Taskbar" or "Tray" rendered within the main application layout.
- **Pros**: Perfectly retains Zustand state. No complex IPC (Inter-Process Communication) required. Keeps the app contained within a single OS window. Much lower development overhead.
- **Cons**: Tool windows cannot be dragged to a secondary physical monitor outside the main app window.
- **Recommendation**: **Highly Recommended.** Given the single-page architecture and reliance on global Zustand state, this is the safest and most standard approach for complex trading dashboards in the browser/Tauri environment.

### Option B: Native Separate Tauri Windows
- **Description**: Spawning actual OS-level windows via Tauri's WindowBuilder.
- **Pros**: Native OS integration; can be spread across multiple monitors.
- **Cons**: Massive architectural rewrite. Tauri windows do not share React context or Zustand state. Each window requires its own webview. Deep synchronization via Rust backend channels would be required for everything (theme, data, user actions).
- **Risk Level**: Extremely High.

## 8. Recommended Safe Rollout Plan
To mitigate risks, the transition should be incremental:

- **POP2**: **Foundation.** Create a `windowStore.ts` to manage coordinates, sizes, z-indexes, and minimized states. Create a reusable `<FloatingWindow>` component that handles dragging (with boundaries), resizing, and maximizing. Create a `<WindowTray>` at the bottom of `RootApp.tsx`.
- **POP3**: **Low-Risk Migration.** Migrate non-destructive, non-blocking dialogs to the new `<FloatingWindow>` system (e.g., `FAQDialog`, `SettingsDialog`, `ChartDrawingPropertiesDialog`).
- **POP4**: **Medium-Risk Migration.** Migrate `DatabaseToolsDialogs` (Quote Editor), replacing its internal CSS-based `ModalShell` with the new global component.
- **POP5**: **Complex Migration.** Migrate `BhavcopyDownloadWindow` and its nested dialogs. Ensure parent-child nesting is handled gracefully in the window manager.
- **POP6**: **Validation.** Final QA pass for boundary checks, responsive behavior, and memory leaks from event listeners.

## 9. Files Likely to Change in Future Phases
- `src/store/windowStore.ts` *(New)*
- `src/components/FloatingWindow.tsx` *(New)*
- `src/components/WindowTray.tsx` *(New)*
- `src/RootApp.tsx`
- Most files matching `src/components/*Dialog*.tsx` and `src/components/*Window*.tsx`

## 10. Conclusion
The audit confirms that the current system relies heavily on hardcoded, flex-centered overlays. The transition to a movable/resizable system is entirely feasible but requires standardizing on a new `<FloatingWindow>` component and implementing a global Z-index/Positioning manager. Adopting an **Internal Tray** strategy for minimization is the only safe path forward given the current state architecture.