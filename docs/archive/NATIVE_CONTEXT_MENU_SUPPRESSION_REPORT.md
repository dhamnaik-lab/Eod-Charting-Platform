# Native Context Menu Suppression Report

Date: 2026-04-09

## Summary

Suppressed the default WebView/browser right-click context menu in the chart pane and sidebar, while keeping the app's custom right-click behavior intact.

## What Changed

- Updated `src/components/ChartCanvas.tsx`
  - the chart viewport now always calls `preventDefault()` on right-click
  - custom price-scale settings and drawing context-menu behavior remain active
- Updated `src/components/Sidebar.tsx`
  - the sidebar shell now suppresses the native browser/WebView context menu
  - the custom watchlist row delete menu remains available

## Result

- Right-clicking the chart pane no longer shows `Save image as`, `Copy image`, or `Inspect`
- Right-clicking the sidebar no longer shows the native browser menu
- Custom app menus still work where intended

## Validation

- `npm run typecheck:renderer`

## Backup

- `backups/pre_opencode_changes_20260409_163851_native_context_menu_suppression_fix`
