# Full Zoom-Out Viewport Fix Report

Date: 2026-06-26

## Scope

- Fix the chart viewport issue seen when zooming out completely.
- Preserve existing zoom buttons, wheel zoom, pan behavior, scrollbar mapping, future-bar margin modes, and price/indicator scale behavior.
- Keep the change inside the shared X-scale math instead of adding renderer-specific compensation.

## Root Cause

- `src/engine/ScaleManager.ts` forced `barWidth` to at least `1px`.
- At full zoom-out, a long history can contain more visible bars than the plot has horizontal pixels.
- The logical viewport could correctly span the full history, but the rendered X positions could not fit inside the chart width, so the fully zoomed-out view looked clipped or viewport-limited.

## Changes

- `src/engine/ScaleManager.ts`
  - Allows sub-pixel X spacing when the visible span is wider than the plot width.
  - Keeps candle/body spacing for normal zoom levels.
  - Removes forced gaps at dense zoom-out levels so the complete logical viewport can fit in the plot.

- `src/engine/__tests__/ScaleManager.test.ts`
  - Adds a regression test proving the last visible bar remains inside the plot at a dense full-history span.
  - Adds a repeated zoom-out test proving the viewport stays clamped to the allowed full-history span.

## Preserved Behavior

- Right-edge anchored zoom behavior is unchanged.
- Viewport clamping and future-margin limits are unchanged.
- Scrollbar drag/sync logic is unchanged.
- Renderer drawing helpers are unchanged.
- Corporate-action import behavior is unchanged.

## Backup

- Code backup: `backups/pre_opencode_changes_20260626_182803_zoom-viewport`
- Docs backup: `backups/pre_opencode_changes_20260626_190346_docs-zoom-viewport`

## Validation

- `npm test -- --run src/engine/__tests__/ScaleManager.test.ts`: PASS
  - 1 test file passed
  - 2 tests passed
- `scripts/validate-change.ps1 -Profile renderer`: PASS
  - Renderer typecheck: PASS
  - Whitespace check: PASS

## Portable QA

- User rebuilt the Windows portable app and confirmed the full zoom-out path works without other observed issues.

## Manual QA Checklist

- Open a long-history chart.
- Press chart zoom-out until it reaches the full-history limit.
- Confirm the leftmost history and latest/future-margin right edge fit inside the plot.
- Confirm the bottom scrollbar and visible range label stay aligned with the displayed chart.
- Zoom back in and pan to confirm normal chart interaction still behaves as before.
