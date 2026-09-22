# W1B: Already Imported Watchlist Indicator Audit

## 1. Summary
The goal of this audit is to identify a reliable method for detecting and indicating which official watchlist groups have already been imported into the active database when the user opens the "Import Watchlist Groups" window.

Current findings confirm that the system already uses a robust "Source Link Metadata" model. When an official watchlist is imported, it is stored with metadata (Exchange, Group Type, Source Key) that uniquely identifies its origin. The existing import logic already uses this metadata to perform "Update/Replace" instead of creating duplicates.

By exposing this metadata to the frontend dialog, we can reliably show "Imported" indicators for each group.

## 2. Files Inspected
- `src/components/OfficialWatchlistImportDialog.tsx`: The UI component for importing groups.
- `src/features/watchlists/officialWatchlistProviders.ts`: Defines official sources and group metadata.
- `src/features/watchlists/officialWatchlistResolver.ts`: Logic for building "Source Signatures".
- `src/features/watchlists/officialWatchlistImportService.ts`: Core import logic that handles matching and replacement.
- `src/store/chartStore.ts`: Holds the active snapshot with imported watchlists.
- `src-tauri-shell/src/database/watchlists.rs`: Database schema for watchlist metadata.
- `src/types/desktop.ts`: TypeScript interfaces for `Watchlist` and `WatchlistSourceMeta`.

## 3. Current Official Watchlist Import Flow
1. User selects an **Official Source** (e.g., NSE Sectors).
2. The UI fetches available **Groups** for that source.
3. User selects one or more groups and clicks **Import**.
4. `runOfficialWatchlistImport` is called:
   - It builds a `sourceSignature` for each requested group.
   - It checks existing watchlists for matching signatures.
   - If a match is found, it **replaces** (updates) the existing watchlist.
   - If no match is found, it creates a new watchlist.
5. The UI remains open (as of W1A), allowing further imports.

## 4. Current Imported Watchlist Storage Model
Watchlists are stored in the `watchlists` table with the following source-linked columns:
- `source_type`: Fixed as 'official' for these watchlists.
- `source_exchange`: 'NSE' or 'BSE'.
- `source_group_type`: 'sector' or 'index'.
- `source_key`: A normalized version of the internal group ID (e.g., 'AUTO' for 'auto').
- `source_display_name`: The original name of the group.
- `last_synced_at`: ISO timestamp of the last successful import/update.

## 5. Matching Keys Available for Already-Imported Detection
The `officialWatchlistSourceSignature` function in `officialWatchlistResolver.ts` provides the canonical matching key:
`SOURCE_TYPE:SOURCE_EXCHANGE:SOURCE_GROUP_TYPE:SOURCE_KEY`

Example: `OFFICIAL:NSE:SECTOR:AUTO`

This signature can be computed for any group in the import list and compared against the signatures of all watchlists currently in `useChartStore.getState().snapshot.watchlists`.

## 6. Risk Assessment
- **False Positives:** Very low. The signature is derived from unique source and group identifiers.
- **False Negatives:** Possible if a watchlist was created manually with the same name but without source metadata. However, W1B specifically targets "Source Linked" indicators.
- **Duplicate Imports:** Existing backend logic already prevents duplicates by favoring replacement of existing linked watchlists.
- **Source-linked update behavior:** Re-importing an "Already Imported" group is a valid action; it effectively performs a "Refetch & Replace" update.

## 7. Recommended UI Behavior
- **Badge/Label:** Add an "Imported" or "Linked" badge to each group row in the list if a matching signature exists.
- **Selection:** Keep imported rows selectable. Importing them again should remain allowed as it performs an update.
- **Secondary Info:** If a match exists, optionally show the "Last Synced" date (from `lastSyncedAt`) to inform the user how old their local copy is.
- **Dimming:** Avoid dimming or disabling rows, as re-importing is a useful way to refresh data from this window.

## 8. Recommended W1B Implementation Plan
1. **Prepare Data:**
   - Map existing watchlists to their signatures using `officialWatchlistSourceSignature`.
2. **UI Update:**
   - In `OfficialWatchlistImportDialog.tsx`, retrieve watchlists from `chartStore`.
   - For each group in the list, compute its potential signature using `buildOfficialWatchlistSourceLinkMeta` and `officialWatchlistSourceSignature`.
   - If the signature matches an existing watchlist, render a badge (e.g., a green "Imported" pill).
3. **Styling:**
   - Add a small `importedBadgeStyle` to the row layout.

## 9. Files Likely to Change in Implementation
- `src/components/OfficialWatchlistImportDialog.tsx`

## 10. Manual QA Checklist
- [ ] Open "Import Watchlist Groups" window.
- [ ] Import a group that hasn't been imported before.
- [ ] Verify that an "Imported" badge appears immediately for that row (since W1A keeps the window open).
- [ ] Close and reopen the window; verify the badge is still present.
- [ ] Verify that the badge appears correctly across different sources (NSE Sectors, BSE Indices, etc.).
- [ ] (Optional) Verify that if a watchlist is deleted from the sidebar, the badge disappears from the import window.

## 11. Git Status
```
M src-tauri-shell/src/bhavcopy.rs
M src/components/BhavcopyDownloadWindow.styles.ts
M src/components/BhavcopyDownloadWindow.tsx
M src/types/desktop.ts
?? W1B_ALREADY_IMPORTED_WATCHLIST_AUDIT_20260518.md
```
