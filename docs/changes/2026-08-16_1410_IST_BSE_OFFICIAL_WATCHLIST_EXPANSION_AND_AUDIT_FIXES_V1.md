# BSE Official Watchlist Expansion & Audit Fixes V1

Date: 2026-08-16 14:10 IST (+05:30)

## Scope
- Expand BSE official watchlist catalog under `BSE Sectors` and `BSE Indices` to achieve parity with NSE official offerings.
- Unhide BSE 500 by fully populating its constituents and removing it from `PARTIAL_GROUP_IDS`.
- Separate `BSE Power` (Code: 69) and `BSE Energy` (Code: 90) URLs and metadata.
- Whitelist `www.bseindices.com` in Tauri backend for official unpaginated CSV constituent downloads.
- Add catalog integrity unit test coverage.

## Changes Implemented
1. **Rust Tauri Backend (`src-tauri-shell/src/main.rs`)**:
   - Added `"www.bseindices.com" | "bseindices.com" => "https://www.bseindices.com/"` to the official source host whitelist in `fetch_official_watchlist_source`.
2. **Watchlist Provider Layer (`src/features/watchlists/officialWatchlistProviders.ts`)**:
   - Removed `bse-500` from `PARTIAL_GROUP_IDS` (`const PARTIAL_GROUP_IDS = new Set<string>()`).
   - Generalized `parseOfficialWatchlistMembers` to auto-detect and parse official CSV constituent feeds (`Constituents`, `Symbol` / BSE security code, `Macro-Economic Sector`).
3. **Generated Data Catalog (`src/features/watchlists/officialWatchlistData.generated.ts`)**:
   - Expanded `bse-sectors` to 27 official sector & thematic groups.
   - Expanded `bse-indices` to 15 official broad & market-cap groups.
   - Disentangled `BSE Power` and `BSE Energy`.
4. **Unit Tests (`src/features/watchlists/__tests__/officialWatchlistProviders.test.ts`)**:
   - Added catalog integrity tests verifying 25+ BSE sectors, 14+ BSE broad indices, full BSE 500 inclusion, and separate Power/Energy mappings.

## Validation
- `npm run typecheck:renderer` -> PASS (0 errors)
- `npm run test -- src/features/watchlists/` -> PASS (69/69 tests passed across 3 test files)
- `npm run tauri:check` -> PASS (Cargo check passed in `src-tauri-shell`)
