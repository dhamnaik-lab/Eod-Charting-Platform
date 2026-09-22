# Official Watchlist Update All Report

Date: 2026-04-07

## Summary

Added a manual "Update All" bulk action that updates every official source-linked watchlist in one click. Reuses the existing `runOfficialWatchlistUpdate` service function. No background sync, no scheduled sync, no behavior changes to single-watchlist Update or Import.

---

## Where Update All Was Added

**`WatchlistManagerDialog.tsx` toolbar** — the Manage Watchlists dialog (opened from the Watchlist menu) already has New / Rename / Delete buttons. "Update All" was added as a fourth button in the same toolbar row.

The sidebar's "Update" button is unchanged — it remains the compact single-watchlist update action for the currently selected watchlist.

---

## Exact Behavior

1. User opens **Watchlist > Manage Watchlists**
2. Clicks **Update All**
3. The button label changes to **"Updating…"** and is disabled while running
4. The store loops through all watchlists whose `sourceMeta.sourceType === 'official'`, calling `runOfficialWatchlistUpdate(watchlist)` for each in sequence
5. Manual watchlists (no `sourceMeta`) are automatically skipped — they are never passed to the update function
6. Each watchlist's `lastSyncedAt` is updated on success (same as single Update)
7. After all updates complete, a single **summary toast** is shown:
   - All succeeded: `"Updated N official watchlist(s)"` — type `success`
   - Some failed: `"Updated N of M — K failed"` — type `warning`
   - No official watchlists: `"No official watchlists to update."` — type `info`
8. `refreshWatchlistsOnly()` is called once at the end (not per-watchlist)
9. Individual failures are logged to console but do not abort the loop
10. The "Update All" button is disabled when:
    - no database is open
    - no official watchlists exist (`officialWatchlistCount === 0`)
    - an update-all is already running (`isUpdatingAll`)
11. Toolbar meta shows e.g. `"4 watchlists · 2 official"` so the user knows the official count before clicking

---

## What Stays Manual-Only

- `runOfficialWatchlistUpdate` is only ever called from explicit user actions (single Update or Update All)
- No polling, no CronJob, no scheduled task, no Tauri event listener triggering updates
- `lastSyncedAt` is only written on successful update completion
- Import (`runOfficialWatchlistImport`) is unchanged

---

## Files Backed Up

`backups/pre_opencode_changes_20260407_160731_update_all_official_watchlists/`

Contents: `src/store/chartStore.ts`, `src/components/WatchlistManagerDialog.tsx`

---

## Files Modified

### `src/store/chartStore.ts`
- Added `updateAllOfficialWatchlists: () => Promise<void>` to the store type interface
- Added `updateAllOfficialWatchlists` action implementation:
  - guards: checks `getApi()` and `activeDatabasePath`
  - filters `snapshot.watchlists` to `sourceType === 'official'`
  - loops and calls `runOfficialWatchlistUpdate(watchlist)` per entry
  - catches per-watchlist failures, logs to console, increments `failed` count
  - calls `refreshWatchlistsOnly()` once after the loop
  - shows summary toast

### `src/components/WatchlistManagerDialog.tsx`
- Added `updateAllOfficialWatchlists` from `useChartStore`
- Added `isUpdatingAll` state (`useState(false)`)
- Added `officialWatchlistCount` computed from `watchlists.filter`
- Added `handleUpdateAll` async handler with loading state and error catch
- Added "Update All" button in the toolbar (`updateAllButtonStyle`)
- Added `updateAllButtonStyle` function (blue emphasis, matches sidebar's emphasized Update style)
- Updated dialog subtitle: "Create, rename, delete, and bulk-update official watchlists."
- Updated toolbar meta to show `"N watchlists · M official"` count

---

## Testing

No new test files added. Rationale:
- `runOfficialWatchlistUpdate` is already covered by 6 tests in `officialWatchlistImportService.test.ts`
- `updateAllOfficialWatchlists` is store-level orchestration (loop + toast + refresh) — not a pure or service function, and the project has no store-level test setup
- The underlying per-watchlist update logic is the same code path as the existing tested service

Existing test suite: 54/54 passed (unchanged).

---

## Validation

```
npm run test                →  2 files, 54 tests passed
npm run typecheck:renderer  →  clean (0 errors)
npm run tauri:check         →  Finished dev profile (45.04s)
npm run build               →  typecheck clean + tauri:check Finished (45.04s) +
                                build:renderer ✓ 485 modules in 5.82s — exit 0
npm run tauri:portable:win  →  Built release + staged clean
```

**Follow-up fix (same day):** Two mojibake strings corrected in `WatchlistManagerDialog.tsx`:
- `'Updating…'` (U+2026 rendered as `â€¦`) → `'Updating...'`
- `` ` · ${n} official` `` (U+00B7 rendered as `Â·`) → `` ` | ${n} official` ``
Backup: `backups/pre_opencode_changes_20260407_163820_mojibake_fix`
`npm run build` → clean after fix.

Portable folder check:
- `EOD Chart.exe` ✓
- `index.html` ✓
- `assets/` ✓
- `Launch Portable EOD Chart.cmd` ✓

Output: `release/tauri-portable-win/EOD Chart Portable/`
Launcher: `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`

---

## Remaining Limitations

- Updates run **sequentially**, not in parallel — if there are many official watchlists, the "Updating…" state may be held for several seconds (each update involves a live network fetch to the official source)
- No per-watchlist progress indicator during the bulk run — only the final summary toast
- If a single watchlist's live source is unavailable, that watchlist will fall back to the packaged snapshot (existing provider behavior), and will still count as "updated" since `runOfficialWatchlistUpdate` succeeds
- If `runOfficialWatchlistUpdate` throws (e.g. no API, bad metadata), that watchlist is counted as "failed" but the loop continues for the rest
- The "Update All" button is in the Manage Watchlists dialog only — it is not in the sidebar toolbar (intentional: sidebar toolbar is kept compact for the single-watchlist case)
