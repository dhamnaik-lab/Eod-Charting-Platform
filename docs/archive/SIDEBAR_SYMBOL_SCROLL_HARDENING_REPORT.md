# SIDEBAR_SYMBOL_SCROLL_HARDENING_REPORT

Date: 2026-04-09

## Summary

Hardened the Symbols sidebar scroll behavior so the virtualized symbol list remains the single real scroll owner.

## Changes

- replaced the Symbols sidebar's virtualized list path with a normal native scroll list in `src/components/Sidebar.tsx`
- kept explicit vertical-only scrolling with hidden horizontal overflow and stable scrollbar gutter reservation
- changed alphabet jumps to use real group-header DOM anchors inside the symbol list
- forwarded mouse-wheel input from the alphabet index rail into the real symbol-list scroll container
- kept alphabet jumps click-only; moving the mouse across the letters still does nothing

## User-visible result

- the symbol list keeps a stable native scrollbar
- wheel scrolling over the alphabet strip now scrolls the actual symbol list instead of feeling disconnected
- clicking a letter now jumps to the corresponding real symbol section instead of relying on virtual row math
- the alphabet strip and the symbol rows now behave like one scroll region rather than two unrelated columns

## Files changed

- `src/components/Sidebar.tsx`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`

## Validation

- `npm run typecheck:renderer`
