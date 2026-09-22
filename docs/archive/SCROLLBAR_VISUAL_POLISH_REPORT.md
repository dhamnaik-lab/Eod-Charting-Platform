# Horizontal Scrollbar Visual Polish Report

Date: 2026-05-24

## Scope

- Visual-only polish for the bottom chart horizontal scrollbar.
- No changes to scrollbar drag handling, viewport synchronization, zoom/reset controls, sheet persistence, or chart store actions.

## Changes

- `src/components/ChartCanvas.tsx`
  - Added the scoped `chart-native-scrollbar` class to the native scrollbar element.
  - Reduced the bottom scrollbar strip from `24px` to `22px` minimum height.
  - Reduced native scrollbar host height from `14px` to `10px`.
  - Softened the bottom strip background and border opacity.

- `src/styles/global.css`
  - Added scoped scrollbar styling for `.chart-native-scrollbar`.
  - Uses a thin scrollbar, transparent track, subtle default thumb, and slightly stronger hover/focus thumb.

## Preserved Behavior

- `syncingNativeScrollbarRef` guard behavior was not changed.
- `useLayoutEffect` viewport-to-scrollbar synchronization was not changed.
- `onScroll` user-drag mapping to `scrollToViewportStart()` was not changed.
- Sheet switching, viewport clamping, and future-margin math were not changed.

## Backup

- `backups/pre_opencode_changes_20260524_140148_scrollbar-visual-polish`

## Validation

- `npm run typecheck:renderer`: PASS
- `npm run build:renderer`: PASS
  - Existing Vite CJS API deprecation warning remains.
  - Existing large chunk warning remains.

## Manual QA Checklist

- Drag the bottom scrollbar left and right slowly and quickly; chart viewport should move with it.
- Switch sheets; scrollbar should reflect the active sheet and should not auto-scroll left unexpectedly.
- Use zoom out, zoom in, reset, and left/right buttons; scrollbar should stay aligned with visible bars.
- Confirm the visual scrollbar is less prominent but still discoverable.
