# Bhavcopy Inline Log Scroll Report

## Scope

This slice corrects the Bhavcopy downloader layout after the separate log-window implementation misunderstood the intended UI.

## Changes

- Removed the separate `BhavcopyActivityLogWindow` floating window.
- Restored the Activity Log inside `src/components/BhavcopyDownloadWindow.tsx`.
- Kept the downloader as one floating window with a left control column and a right log panel.
- Kept log filtering, auto-scroll, copy, run counters, and progress inside the inline log panel.
- The log list itself is the scrollable area; the downloader does not open a second activity-log window.
- Kept the larger bounded retained log buffer in `src/store/bhavcopyStore.ts` from the previous slice.

## Behavior Notes

- Opening Bhavcopy now opens/focuses only `bhavcopy-download`.
- `Clear` still clears the shared run summary, progress, retained logs, and dedupe indexes.
- Download progress/result listeners, Bhavcopy parsing, storage, and chart/database refresh behavior are unchanged.

## Backup

- `backups/pre_opencode_changes_20260524_202159_bhavcopy-inline-log-scroll`

## Validation

- `npm run typecheck:renderer`: PASS
