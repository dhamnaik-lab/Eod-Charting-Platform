# Scrollbar Sheet Viewport Sync Report

Date: 2026-05-24

## Scope

- Fix the mismatch seen in video where the chart canvas could show one visible range while the bottom scrollbar/range label reported another range after tab or sheet switching.
- Preserve existing scrollbar drag behavior and sheet viewport preservation rules.

## Root Cause

- `ChartEngine.loadBars()` resets the engine's internal viewport to the latest bars whenever a new `bars` array is loaded.
- `ChartCanvas` separately reapplied the store viewport only when `viewport.startIndex` or `viewport.endIndex` changed.
- During some tab/sheet switches, the bars/instrument changed while the numeric viewport did not change, so the engine stayed on its reset viewport while React UI still used the stored viewport.

## Change

- `src/components/ChartCanvas.tsx`
  - Added `latestViewportRef`.
  - Updates that ref each render.
  - Reapplies `latestViewportRef.current` immediately after `engine.loadBars(bars)`.

## Preserved Behavior

- `syncingNativeScrollbarRef` guard behavior was not changed.
- User drag mapping from native scrollbar to `scrollToViewportStart()` was not changed.
- Sheet switch logic that preserves the current viewport was not changed.
- Chart store viewport mutation actions were not changed.

## Backup

- `backups/pre_opencode_changes_20260524_165914_scrollbar-sheet-viewport-sync`

## Validation

- `npm run typecheck:renderer`: PASS
- `npm run build:renderer`: PASS
  - Existing Vite CJS API deprecation warning remains.
  - Existing large chunk warning remains.

## Manual QA Checklist

- Switch chart tabs and confirm the canvas x-axis, bottom scrollbar thumb, and bottom date range all describe the same visible range.
- Switch sheets and confirm the chart does not jump to the latest bars unless the stored/preserved viewport says so.
- Drag the bottom scrollbar after switching tabs/sheets and confirm the chart moves with the scrollbar.
- Zoom in/out after switching tabs/sheets and confirm the bottom range updates consistently.
