# Official Watchlists Lazy Data W1.3

Date: 2026-08-16 IST

## Problem

The W1.2 renderer build emitted `feature-official-watchlists` at 1,179.22 kB minified / 280.18 kB gzip because the provider statically imported all six constituent universes. Opening the already-lazy Official Watchlist feature therefore brought every snapshot universe into one feature payload regardless of the operator-selected source.

## Change

- Added a deterministic split generator and a metadata-only six-source catalog.
- Split the four sources previously co-located in `officialWatchlistData.generated.ts` into four source-specific runtime modules under `src/features/watchlists/generated/`.
- Kept the NSE/BSE all-stock sector-universe snapshots as their own source-specific lazy modules.
- Replaced all static constituent imports in `officialWatchlistProviders.ts` with six literal dynamic imports.
- Added a session-memory promise cache that deduplicates in-flight/successful source loads and evicts rejected promises for Retry.
- Preserved `PARTIAL_GROUP_IDS` filtering in both catalog and payload paths.
- Kept persisted source-link lookup synchronous and metadata-only; source-linked update then loads exactly the resolved source payload.
- Preserved live official-source fetch, parse, normalization, logging, and snapshot-fallback behavior.
- Added request-ID dialog state so stale source completions cannot overwrite the active source, with `Loading constituents…`, Retry, and ready-only selection/import.
- No persistence schema, database, Corporate Action, or chart-runtime change is included.

## Canonical data counts

The deterministic generator preserves these canonical group/member totals before runtime partial-group filtering:

| Source | Groups | Total members across groups |
|---|---:|---:|
| `nse-sectors` | 22 | 413 |
| `nse-indices` | 21 | 5,327 |
| `bse-sectors` | 27 | 1,905 |
| `bse-indices` | 15 | 6,084 |
| `nse-all-stocks-sectors` | 80 | 2,368 |
| `bse-all-stocks-sectors` | 13 | 1,527 |

## Validation contract

The guarded Windows package runs, in order:

1. `node .\scripts\split-official-watchlist-data.mjs --check`
2. all `src/features/watchlists/__tests__` plus the dialog source-contract test
3. `npm run typecheck:renderer`
4. `npm run build:renderer`
5. `npm run tauri:check`
6. the W1.3 bundle checker against `dist/assets`

The bundle checker compares the static `feature-official-watchlists` chunk with the W1.2 baseline and requires six source-selective lazy payload chunks. It reports actual minified/gzip sizes to the validation console and a timestamped `tmp/w1-3-bundle-report_*.txt` artifact. This delivery environment cannot run the renderer build because its offline npm cache lacks project dependencies; therefore the operator's Windows validation is the authoritative bundle measurement gate.

The W1.3 package does not raise `chunkSizeWarningLimit`. Any remaining genuinely large individual lazy payload is reported rather than hidden. `feature-chart-runtime` remains deferred to W1.4.
