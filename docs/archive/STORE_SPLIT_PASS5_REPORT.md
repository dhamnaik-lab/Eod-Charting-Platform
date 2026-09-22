# Store Split Pass 5 Report

Date: 2026-04-07

## What Was Addressed

Seven pure official watchlist resolver/helper functions were extracted from `src/store/chartStore.ts` into a new dedicated module `src/features/watchlists/officialWatchlistResolver.ts`. All seven are stateless utility functions with no dependency on store state.

This pass is structural only. No lookup behavior, naming behavior, or import/update orchestration changed.

## Helpers Extracted

| Function | Purpose |
|----------|---------|
| `normalizeLookupToken` | Trims and uppercases a string token; returns null for empty/null input |
| `instrumentSymbolKey` | Builds a `EXCHANGE:SYMBOL` lookup key |
| `instrumentIsinKey` | Builds a `EXCHANGE:ISIN` lookup key |
| `buildUniqueWatchlistName` | Appends a numeric suffix to a watchlist name if the base name is already taken |
| `officialWatchlistSourceSignature` | Builds a canonical `official:EXCHANGE:GROUP_TYPE:KEY` signature string from watchlist source metadata |
| `resolveOfficialWatchlistMember` | Resolves an official watchlist member to a local `InstrumentSummary` using ISIN-first then symbol-fallback matching |
| `buildOfficialWatchlistLookupMaps` | Builds `bySymbol` and `byIsin` `Map` lookups from the full instrument catalog |

The ISIN-first then symbol-fallback resolution order in `resolveOfficialWatchlistMember` is preserved verbatim.

## What Was Added

- `src/features/watchlists/officialWatchlistResolver.ts`
  - imports `InstrumentSummary` from `@/platform`
  - imports `OfficialWatchlistMember` from `@/features/watchlists/officialWatchlistProviders`
  - exports all seven helpers with `export` prefix (previously module-private in `chartStore.ts`)

## What Changed in `chartStore.ts`

- removed `type OfficialWatchlistMember` from the `officialWatchlistProviders` import (no longer referenced directly in the store)
- added new import block:
  ```ts
  import {
    buildOfficialWatchlistLookupMaps,
    buildUniqueWatchlistName,
    instrumentSymbolKey,
    officialWatchlistSourceSignature,
    resolveOfficialWatchlistMember,
  } from '@/features/watchlists/officialWatchlistResolver';
  ```
- deleted seven function bodies (~97 lines including blank lines)
- all call sites in `importOfficialWatchlists` and `updateOfficialWatchlist` remain intact and unchanged — they now resolve through the import

## Line Delta

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `chartStore.ts` lines | 1,868 | 1,774 | −94 |

## Files Added

- `src/features/watchlists/officialWatchlistResolver.ts`
- `STORE_SPLIT_PASS5_REPORT.md`

## Files Modified

- `src/store/chartStore.ts`
- `README.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CURRENT_ARCHITECTURE_STRUCTURE_EOD_CHARTING_PLATFORM.md`

## Backup

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260407_014825_store_split_pass5`

## Validation Performed

Passed:

- `npm run typecheck:renderer`
- `npm run tauri:check`
- `npm run build`
- `npm run tauri:portable:win`

## Output

- Output folder: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`
- Launcher path: `D:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\Launch Portable EOD Chart.cmd`

## Remaining `chartStore.ts` Hotspots

- **Official watchlist import/update** (`importOfficialWatchlists`, `updateOfficialWatchlist` — ~260 lines): the pure resolution helpers have now been extracted; the remaining bodies still contain store-side orchestration (toast calls, `selectedWatchlistId` updates, `refreshWatchlistsOnly`, dialog close) woven through the business logic. Extraction is safer now that the helpers are out, but still requires careful separation of the pure resolution phase from the store effect phase.
- **Chart tab management** (`createChartTab`, `activateChartTab`, `closeChartTab`) — tightly coupled to store state; lowest extraction priority.
