# Official Watchlist Sync-Status Completion Report

Date: 2026-04-07

## Summary

Completed the remaining sync-status UX gaps for official watchlists in one low-risk pass.
Sync updates remain **manual-only** — no background or scheduled sync was added.
No sidebar redesign. No import/update behavior changes. No new runtime dependencies.

---

## UI Completions Made

### 1. Sidebar — timezone label on "Last synced" readout (`Sidebar.tsx`)

**Before:** `"Last synced: 07 Apr 2026, 11:15"` (no timezone context)

**After:** `"Last synced: 07 Apr 2026, 11:15 IST"` (local timezone abbreviation appended)

Implementation: `LOCAL_TZ_LABEL` module-level constant computed once at load time via `Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts()`. Returns empty string defensively if the Intl API is unavailable.

### 2. Sidebar — tooltip with raw ISO timestamp on "Last synced" readout (`Sidebar.tsx`)

**Before:** No tooltip.

**After:** Hovering the "Last synced" line shows the raw ISO string stored in `sourceMeta.lastSyncedAt` as a native browser tooltip (`title` attribute), e.g. `"2026-04-07T05:45:17.000Z"`.

### 3. Watchlist Manager Dialog — per-row last-synced sub-line (`WatchlistManagerDialog.tsx`)

**Before:** Official watchlist rows showed only: `"N symbols | Official linked | <sourceDisplayName>"` and a badge.

**After:** Official watchlist rows now also show a third sub-line below the meta line:

```
Last synced: 07 Apr 2026, 11:15 IST
```

Rendered with the same subdued style (`#6b8a9e`, 10px) as the sidebar readout. The raw ISO string is available as a `title` tooltip. Manual watchlist rows are unaffected — the line is hidden.

This provides the requested compact bulk view: opening Manage Watchlists shows all official watchlists' sync dates at a glance without any sidebar redesign.

---

## What Is Intentionally Manual-Only

- Sync (`runOfficialWatchlistUpdate`) is triggered only by the "Update" toolbar button in the sidebar
- Import (`runOfficialWatchlistImport`) is triggered only by Watchlist > Import Official Watchlists
- `lastSyncedAt` is written only at the end of a successful import or update operation
- No background polling, no CronJob, no scheduled task, no auto-refresh
- No changes to `officialWatchlistImportService.ts`, `chartStore.ts`, or any backend Rust code

---

## Files Backed Up

`backups/pre_opencode_changes_20260407_150030_sync_status_completion/`

Contents: `src/components/Sidebar.tsx`, `src/components/WatchlistManagerDialog.tsx`, `OFFICIAL_WATCHLIST_TESTING_FOUNDATION_REPORT.md`

---

## Files Modified

### `src/components/Sidebar.tsx`
1. Added `LOCAL_TZ_LABEL` module-level constant (after `date-fns` import)
2. Updated `lastSyncedDisplay` memo: appends `LOCAL_TZ_LABEL` to the formatted string
3. Added `title={selectedWatchlist?.sourceMeta?.lastSyncedAt ?? undefined}` to the last-synced div

### `src/components/WatchlistManagerDialog.tsx`
1. Added `import { format, parseISO } from 'date-fns'`
2. Added `LOCAL_TZ_LABEL` module-level constant (same pattern as Sidebar)
3. Added `formatSyncDate(raw)` module-level helper
4. Per official row: compute `syncedDisplay`; render `watchlistSyncedStyle` sub-line with tooltip
5. Added `watchlistSyncedStyle` constant (`color: '#6b8a9e'`, `fontSize: 10`)

### `OFFICIAL_WATCHLIST_TESTING_FOUNDATION_REPORT.md`
- Fixed backup section: acknowledged that `package.json` modification was a process gap per AGENTS.md; nearest captured state is `pre_opencode_changes_20260407_123049_last_synced_ui`
- Added note that `npm run build` (combined) was not run as a combined command in that pass; individual components were run with equivalent coverage

---

## Validation

```
npm run test                →  2 files, 54 tests passed (unchanged)
npm run typecheck:renderer  →  clean (0 errors)
npm run tauri:check         →  Finished dev profile [unoptimized + debuginfo]
npm run build               →  typecheck:renderer clean + tauri:check Finished (2.97s) +
                                build:renderer ✓ 485 modules built in 3.23s — exit 0
npm run tauri:portable:win  →  Built + staged clean
```

Portable folder check (`release/tauri-portable-win/EOD Chart Portable/`):
- `EOD Chart.exe` ✓
- `index.html` ✓
- `assets/` ✓
- `Launch Portable EOD Chart.cmd` ✓ — sets `EOD_CHART_PORTABLE_ROOT`, starts `EOD Chart.exe` with `/D` working directory

Output: `release/tauri-portable-win/EOD Chart Portable/`
Launcher: `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`

---

## Remaining Limitations

- `LOCAL_TZ_LABEL` is computed once at module load — does not react to DST transitions during a running session (acceptable for a desktop app that restarts daily)
- Timezone abbreviation comes from `Intl.DateTimeFormat` which may show "GMT+5:30" instead of "IST" on some Windows locale configurations (still correct and readable)
- The bulk view is in the Manage Watchlists dialog, not an always-visible panel — users must open the dialog to see all sync dates
- No "never synced" differentiation in the bulk view (null `lastSyncedAt` rows just show no sub-line, which is clear)
- Tests for `Sidebar.tsx` and `WatchlistManagerDialog.tsx` were not added (UI component tests are out of scope for this project's current test foundation; unit tests cover the underlying `officialWatchlistResolver` and `officialWatchlistImportService` pure logic)

---

## Continuation Prompt

See `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` for the ready continuation state.
