# POP2_FLOATING_WINDOW_FOUNDATION_REPORT

**Date**: May 18, 2026
**Target Branch**: `gemini-release-qa-20260512`

## 1. Scope
The goal of this phase was to implement the foundational pieces for a floating window system in the EOD Charting Platform. This includes a global window store, a reusable `FloatingWindow` component, and a `WindowTray` for managing minimized windows.

## 2. Verified Git State
- **Current Branch**: `gemini-release-qa-20260512`
- **HEAD Commit**: `f8d02ff Audit popup and modal system`
- **Recent Tags**: `pop1-popup-modal-system-audit-20260518`
- **Working Tree**: Clean (excluding untracked files).

## 3. Files Inspected
- `src/RootApp.tsx`
- `src/store/uiStore.ts`
- `src/components/DatabaseToolsDialogs.tsx`
- `src/components/FAQDialog.tsx`
- `src/components/BhavcopyDownloadWindow.tsx`
- `src/components/BhavcopySourceSettingsDialog.tsx`
- `package.json`
- `tsconfig.json`

## 4. Files Changed
- `src/store/windowStore.ts` (New)
- `src/components/FloatingWindow.tsx` (New)
- `src/components/WindowTray.tsx` (New)
- `src/RootApp.tsx` (Updated to mount `WindowTray`)

## 5. New Components/Store Added

### 5.1 `windowStore.ts`
A new Zustand store that manages:
- **Registry**: Track all floating windows (ID, title, state).
- **State**: `isOpen`, `isMinimized`, `isMaximized`.
- **Z-Index**: Manage active window focusing and stacking order.
- **Bounds**: Persistent tracking of X, Y, Width, and Height.
- **History**: Store `previousBounds` to allow restoration after maximize.

### 5.2 `FloatingWindow.tsx`
A reusable shell component for any floating content:
- **Title Bar**: Drag handles for moving the window.
- **Actions**: Standard Minimize, Maximize/Restore, and Close buttons.
- **Boundaries**: Movement is constrained to stay within the viewport (with a 100px/40px buffer to prevent lost windows).
- **Resizing**: A bottom-right handle for fluid resizing.
- **Focusing**: Clicking anywhere in the window brings it to the top (updates Z-index).
- **Double-click**: Double-clicking the title bar toggles maximization.

### 5.3 `WindowTray.tsx`
A compact, non-invasive tray that appears at the bottom-center of the app:
- Only renders when windows are minimized.
- Provides one-click restore functionality.
- Displays window titles for easy identification.

## 6. Behavior Change Summary
- **No changes to existing dialogs**: `FAQDialog`, `SettingsDialog`, `QuoteEditor`, etc., still use their old inline or `ModalShell` patterns.
- **New capability**: The foundation is ready for future migration of these dialogs.
- **Visual impact**: None until a window is minimized (which requires code that uses the new store).

## 7. Why Existing Dialogs Were Not Migrated
Migration was intentionally deferred to **POP3+** to ensure the foundation is stable and passes all validation checks first. This approach minimizes risk and allows for surgical migration of low-risk dialogs first.

## 8. Internal Tray Strategy
As recommended in the POP1 audit, an **Internal Tray** (Option A) was implemented. This allows all windows to share the same React context and Zustand state, ensuring perfect data consistency without complex IPC.

## 9. Boundary/Drag/Resize Safety Notes
- **Text Selection**: Header uses `userSelect: 'none'` to prevent accidental text selection while dragging.
- **Off-screen protection**: Logic ensures windows cannot be dragged entirely off-screen.
- **Event Cleanup**: `useEffect` hooks in `FloatingWindow` ensure that global `mousemove` and `mouseup` listeners are removed on component unmount, even if a drag or resize operation was active.
- **Interaction Safety**: Action buttons (Minimize/Maximize/Close) are excluded from triggering window drag, preventing accidental movement when clicking controls.
- **Resize Clamping**: Windows are clamped to the visible viewport during resize to prevent them from extending into unreachable areas.

## 10. Hardening Corrections
The following hardening steps were applied to the initial foundation:
- **State Guards**: Added missing-window guards to every action in `windowStore.ts`. Actions on non-existent window IDs now fail gracefully without creating corrupt state entries.
- **Constraint Support**: Added optional `maxWidth` and `maxHeight` fields to the window state, allowing future dialogs to define their maximum dimensions.
- **Resource Management**: Tightened global event listener management in `FloatingWindow.tsx` to prevent memory leaks.

## 11. Known Limitations
- **Persistence**: Window positions and sizes are not yet saved to disk; they reset on app reload.
- **Z-Index Collision**: The Z-index starts at 100. If other components use higher Z-indexes ad-hoc, they might overlap.

## 12. Validation Performed
- `npm run typecheck:renderer`: Passed.
- `npm run tauri:check`: Passed.
- `npm run build`: Verified successful compilation.

## 12. Recommended Next Phase
**POP3 — Low-Risk Migration**: Migrate the first few dialogs (e.g., `FAQDialog` and `SettingsDialog`) to use the new `FloatingWindow` component.
