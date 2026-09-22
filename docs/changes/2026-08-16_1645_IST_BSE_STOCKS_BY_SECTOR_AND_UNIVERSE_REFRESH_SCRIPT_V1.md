# BSE Stocks by Sector & Automated Universe Refresh Script V1

Date: 2026-08-16 16:45 IST (+05:30)

## Scope
- Establish industry universe parity for BSE by adding the `BSE Stocks by Sector` source tab in the official watchlist importer.
- Introduce an automated, on-demand maintenance script `scripts/refresh-sector-universe.mjs` to fetch and rebuild sector snapshots for NSE and BSE.
- Ensure all update operations remain strictly user-initiated (no silent background fetching on app startup).

## Changes Implemented
1. **BSE Sector Universe Snapshot (`src/features/watchlists/bseSectorUniverseWatchlistData.generated.ts`)**:
   - Generated snapshot covering 1,527 BSE-listed equity stocks across 13 official BSE macro-economic sectors (*Commodities, Consumer Discretionary, Diversified, Energy, Fast Moving Consumer Goods, Financial Services, Healthcare, Industrials, Information Technology, Services, Telecommunication, Utilities, Other / Diversified*).
2. **Watchlist Provider Layer (`src/features/watchlists/officialWatchlistProviders.ts`)**:
   - Registered `bse-all-stocks-sectors` in `OfficialWatchlistSourceId`.
   - Wired `bseSectorUniverseWatchlistSourceSnapshot` into `snapshotSources`.
   - Added alphabetical member sorting in `sortOfficialWatchlistMembers` for `bse-all-stocks-sectors`.
3. **Automated Refresh Script (`scripts/refresh-sector-universe.mjs`)**:
   - CLI script with `--source nse|bse|all` support, parsing official `www.bseindices.com` API feeds and mapping ISINs/symbols.
4. **Unit Tests (`src/features/watchlists/__tests__/officialWatchlistProviders.test.ts`)**:
   - Added test cases verifying catalog listing of all 6 sources and `bse-all-stocks-sectors` integrity (10+ sector groups, 1500+ stocks).

## Validation
- `npm run test -- src/features/watchlists/` -> PASS (70/70 tests passed across 3 test files)
- `npm run typecheck:renderer` -> PASS (0 errors)
- `scripts/check-doc-references.ps1` -> PASS
