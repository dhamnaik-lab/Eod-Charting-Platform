# AmiBroker-Style Database Open Flow Report

Date: 2026-04-08

## Goal

Reduce the visible "Not Responding" feel during `Open Database` by making the open path metadata-first, similar to AmiBroker:

- keep the current chart/workspace visible during database activation
- avoid loading DB stats in the critical open path
- defer symbol-browser hydration until the Symbols panel actually needs it
- hydrate watchlists before slower summary metadata

## Files Changed

- `src/store/chartStore.ts`
- `src/features/workspace/databaseSnapshotService.ts`
- `src/components/Sidebar.tsx`
- `src/components/StatusBar.tsx`

## What Changed

### `src/store/chartStore.ts`

- `applySnapshot(...)` no longer clears the chart workspace immediately when a database is opened.
- Active DB switches now:
  - apply the lightweight snapshot first
  - preserve the current visible chart until the persisted workspace is restored
  - defer watchlist hydration
  - defer DB stats hydration
- Added store state for:
  - `isDatabaseTransitioning`
  - `databaseTransitionMessage`
  - `isSymbolBrowserLoading`
  - `symbolBrowserLoadedDatabasePath`
- `refreshSymbolBrowser(...)` now tracks active DB ownership and loading state explicitly.

### `src/features/workspace/databaseSnapshotService.ts`

- `loadSnapshotHydrationDetails(...)` now hydrates only watchlists.
- `loadDeferredDbStats(...)` now owns deferred DB stats loading separately.

### `src/components/Sidebar.tsx`

- Symbols panel now lazy-loads the symbol browser after DB open instead of forcing it through `applySnapshot(...)`.
- Header/meta text now distinguishes:
  - opening database
  - connected but loading stats
  - loading symbols

### `src/components/StatusBar.tsx`

- Status bar now shows database-transition messaging while the DB switch is in progress instead of looking idle/blank.

## Resulting Open Flow

1. User opens a database.
2. Lightweight snapshot activates the DB quickly.
3. Existing chart remains visible during transition.
4. Persisted workspace is restored.
5. Watchlists hydrate first.
6. DB stats hydrate later.
7. Symbol browser loads only when the Symbols panel needs it.

## Validation

- `npm run typecheck:renderer`
- `npm run build`

## Backup

- `backups/pre_opencode_changes_20260408_231250_amibroker_style_db_open_flow`
