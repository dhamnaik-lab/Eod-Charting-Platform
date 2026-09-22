# Official Watchlist Last Synced UI Report

Date: 2026-04-07

## Summary

Added a small "Last synced" date readout in the Watchlists sidebar panel. The readout appears only for the selected official source-linked watchlist and only when `sourceMeta.lastSyncedAt` is non-null. Manual watchlists are unaffected. No sidebar redesign, no import/update behavior changes.

---

## UI Change

**Before:** The watchlist hint line showed `"Official linked - <sourceDisplayName>"` for official watchlists. No sync timestamp was visible in the UI.

**After:** Directly below the hint line, when the selected watchlist is official and has a non-null `lastSyncedAt`, a second line appears:

```
Last synced: 07 Apr 2026, 11:15
```

The line is rendered in a subdued color (`#6b8a9e`, 10px) to stay visually secondary to the hint text. It is hidden when:
- the selected watchlist is not official
- `lastSyncedAt` is null (watchlist was just created but never synced — not currently possible, but defensive)
- `lastSyncedAt` cannot be parsed as an ISO date string (defensive try/catch)

---

## Files Backed Up

`backups/pre_opencode_changes_20260407_123049_last_synced_ui/`

Contents: `package.json`, `package-lock.json`, `vitest.config.ts`, `src/components/Sidebar.tsx`

---

## Files Modified

### `src/components/Sidebar.tsx`

1. **Import added** (line 2):
   ```typescript
   import { format, parseISO } from 'date-fns';
   ```
   `date-fns` is already a production dependency — no new package install needed.

2. **Computed value added** (near line 165):
   ```typescript
   const lastSyncedDisplay = useMemo(() => {
     const raw = selectedOfficialWatchlist ? (selectedWatchlist?.sourceMeta?.lastSyncedAt ?? null) : null;
     if (!raw) return null;
     try {
       return format(parseISO(raw), 'dd MMM yyyy, HH:mm');
     } catch {
       return null;
     }
   }, [selectedOfficialWatchlist, selectedWatchlist?.sourceMeta?.lastSyncedAt]);
   ```

3. **JSX added** (below the existing hint div):
   ```tsx
   {lastSyncedDisplay && (
     <div style={watchlistLastSyncedStyle}>
       Last synced: {lastSyncedDisplay}
     </div>
   )}
   ```

4. **Style constant added**:
   ```typescript
   const watchlistLastSyncedStyle: React.CSSProperties = {
     color: '#6b8a9e',
     fontSize: 10,
     lineHeight: 1.3,
   };
   ```

---

## Validation

```
npm run test                →  2 files, 54 tests passed (unchanged)
npm run typecheck:renderer  →  clean (0 errors)
npm run tauri:check         →  Finished (dev profile)
npm run tauri:portable:win  →  Built + staged clean
```

Portable folder check:
- `EOD Chart.exe` ✓
- `index.html` ✓
- `assets/` ✓
- `Launch Portable EOD Chart.cmd` ✓

Output: `release/tauri-portable-win/EOD Chart Portable/`
Launcher: `release/tauri-portable-win/EOD Chart Portable/Launch Portable EOD Chart.cmd`

---

## Remaining Limitations (as of this pass — see next pass for resolutions)

- The timestamp did not include a timezone label (**resolved in `OFFICIAL_WATCHLIST_SYNC_STATUS_COMPLETION_REPORT.md`**)
- The readout showed only for the currently selected watchlist; no bulk view (**resolved — WatchlistManagerDialog per-row sub-line added in next pass**)
- No tooltip showing the full ISO string (**resolved in next pass**)
- `lastSyncedAt` is only updated when an import or update action completes successfully; it is not updated by any background process (intentional — manual-only)

---

## Continuation Prompt

See `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` for the ready continuation state.
