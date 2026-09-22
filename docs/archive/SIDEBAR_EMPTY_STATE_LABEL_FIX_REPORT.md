# Sidebar Empty-State Label Fix Report

Date: 2026-04-09

## Summary

This pass fixes the awkward `No chart data loaded` label placement when the sidebar is open.

The issue was not in the sidebar itself. The empty-state text was being painted by `src/engine/ChartEngine.ts` at a hardcoded left-edge position (`x = 12`), which made it look clipped and visually too close to the sidebar seam whenever the chart had no bars loaded.

## What Changed

- updated `src/engine/ChartEngine.ts` so the empty-state message is centered inside the visible chart viewport instead of being painted at a hardcoded left-edge x-position
- the centered placement now respects the reserved right-axis width and bottom x-axis strip, so the message stays inside the actual chart area

## Result

- the empty-state label no longer looks like it is sitting under or against the sidebar edge
- opening the Symbols / Indicators / Watchlist sidebar no longer makes the empty-state text feel clipped or misaligned
- the fix applies consistently regardless of whether the sidebar is pinned or in auto-hide mode

## Validation

- `npm run typecheck:renderer`
- `npm run tauri:portable:win`
