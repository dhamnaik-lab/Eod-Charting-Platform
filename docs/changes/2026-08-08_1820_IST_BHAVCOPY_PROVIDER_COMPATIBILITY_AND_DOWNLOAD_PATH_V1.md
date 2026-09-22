# Bhavcopy Provider Compatibility and Download Path V1

## IST timestamp

2026-08-08 18:20 +05:30

## Objective

Use the separately proven Go/Wails `TA EOD Downloader` backend as an evidence source for the EOD Charting Platform Bhavcopy subsystem, then apply only the smallest provider-compatibility and network-path changes that are directly supported by that working implementation.

This change is intentionally separate from the binary `.eod` write-performance work. It does not alter binary record layout, database schema, import batching, or durability semantics.

## Previous defect or limitation

Observed runtime evidence on 2026-08-08 showed:

- EOD Charting Platform could not retrieve BSE Equity or BSE Index data for the trading dates 2023-12-01 through 2023-12-08 even though the standalone Go/Wails downloader retrieved the same dates successfully.
- The standalone downloader retrieved BSE Equity legacy archives and BSE Index archive-API rows with only two download workers.
- The Rust downloader retried HTTP 404 responses three times, adding avoidable 1s + 2s backoff for a definitive missing-file response.
- Rust NSE Equity source generation had legacy historical archive candidates commented out, while the working Go implementation still uses them for historical dates.
- Rust BSE Equity source generation did not use the proven date-aware source ordering from the working downloader.
- Rust BSE Index did not use the proven `IndexArchDailyAllPar` archive API path.
- Rust CSV source-date aliases omitted `DATE1`, `TRADE_DATE`, and `TRADE_DT` even though those names occur in supported exchange files.
- The preceding BSE V1 test run also exposed two pre-existing test/parser defects: the BSE UDiFF trade-count alias and the in-memory holiday fixture. Those corrections are retained in this consolidated source.

## Evidence used

### User-proven standalone downloader runtime

For 2023-12-01 through 2023-12-10, the Go/Wails downloader successfully retrieved:

- BSE Equity: six weekday sessions, about 4,191-4,372 rows per day.
- BSE Index: six weekday sessions, 57 rows per day.
- Weekend dates were skipped.

### Working Go source inspected

- `internal/bse/downloader.go`
- `internal/bseindex/downloader.go`
- `internal/nse/downloader.go`
- `internal/nseindex/downloader.go`
- `internal/mcx/downloader.go`
- `internal/httpx/client.go`
- `internal/app/app.go`

The Go reference uses:

- a 2024-07-08 source-order cutover for NSE/BSE Equity;
- BSE legacy `EQDDMMYY_CSV.ZIP` for historical Equity;
- BSE Index `IndexArchDailyAllPar` archive API with `index=All`;
- shared persistent HTTP client/cookie jar;
- 30-second request timeout;
- retries for transient HTTP/network failures but not HTTP 404;
- bounded worker concurrency.

## Files changed

### Modified

- `src-tauri-shell/src/bhavcopy.rs`

### Created

- `docs/changes/2026-08-08_1820_IST_BHAVCOPY_PROVIDER_COMPATIBILITY_AND_DOWNLOAD_PATH_V1.md`

## Final implementation

### NSE Equity

- Restored both proven historical archive hosts:
  - `archives.nseindia.com`
  - `nsearchives.nseindia.com`
- Added date-aware source ordering around 2024-07-08:
  - on/after cutover: UDiFF -> `sec_bhavdata_full` -> historical archive fallbacks;
  - before cutover: historical archive fallbacks -> UDiFF -> `sec_bhavdata_full`.
- Existing URL override remains first.

### BSE Equity

- Preserved the current direct UDiFF, live filename API, and older fallbacks.
- Added the proven 2024-07-08 source-order behavior:
  - on/after cutover: modern direct UDiFF -> legacy archive -> filename API -> older fallbacks;
  - before cutover: legacy archive -> modern direct UDiFF -> filename API -> older fallbacks.
- Legacy filename remains `EQDDMMYY_CSV.ZIP`.
- Existing URL override remains first.

### BSE Index

- Added the proven archive API as the first standard candidate:
  - `https://api.bseindia.com/BseIndiaAPI/api/IndexArchDailyAllPar/w`
  - query: `fmdt=DD/MM/YYYY`, `index=All`, `period=D`, `todt=DD/MM/YYYY`.
- Uses the proven index archive referer and `Origin: https://www.bseindia.com` request header.
- JSON `Table` rows are normalized into the existing internal CSV import contract, avoiding a second independent database-import implementation.
- Source date is validated against the requested date.
- Rows missing chartable OHLC are ignored.
- BSE archive `Volume` is converted from crore units to absolute units, matching the proven Go implementation.
- Preserved canonical BSE index symbols for the reference mappings `BSE SENSEX -> SENSEX`, `BSE BANKEX -> BANKEX`, `BSE SENSEX 50 -> SENSEX50`, and `BSE SENSEX NEXT 50 -> SENSEXNEXT50`.
- Existing BSE Index filename API and CSV paths remain as fallbacks.

### HTTP/download path

- Added a 30-second HTTP client timeout.
- Configured up to 16 idle pooled connections per host; cloned `reqwest::Client` instances continue to share the underlying pool.
- HTTP 404 now returns `None` immediately instead of sleeping and retrying the same definitive missing-file response.
- HTTP 403 remains retryable with bounded exponential backoff, preserving the existing anti-bot/transient-access behavior.

### Parsing compatibility

Added source-date aliases:

- `DATE1`
- `TRADE_DATE`
- `TRADE_DT`

Also accepts ISO date-time responses by extracting the `YYYY-MM-DD` portion before source-date comparison.

### Consolidated preceding corrections retained

- Correct BSE UDiFF trade-count alias `TTLNBOFTXSEXCTD`.
- Legacy BSE `SC_GROUP`, `NO_TRADES`, `NO_OF_SHRS` compatibility.
- Unit-test `market_holidays` fixture with the Muharram date required by the existing test.

## Behavior deliberately preserved

- No `.eod` binary format change.
- No binary worker-count change.
- No `flush`/`sync_data` durability change.
- No SQLite schema change.
- No import transaction/order change.
- No frontend/UI change.
- No NSE Index current daily archive change.
- No MCX feature added to the EOD Charting Platform; MCX was reviewed only as a reference because the current platform Bhavcopy UI does not expose MCX.
- Existing provider URL overrides remain supported and retain priority.

## Audit findings not implemented in this change

### NSE Index history before the daily archive era

The standalone downloader has a more complete pre-2013 NSE Index architecture: it discovers the full historical index list and caches historical API data in year-sized ranges. The EOD Charting Platform contains a limited historical API implementation, but its helper is currently not wired into the normal batch plan and covers only NIFTY/BANKNIFTY.

This was not expanded in this patch because doing so is a larger behavioral change than the immediate proven BSE/NSE Equity compatibility correction. It should be addressed as a dedicated follow-up if full pre-2013 NSE Index parity is required.

### BSE Index full-history floor

The standalone downloader documents a BSE Index default start of 1986-01-01 while the EOD Charting Platform currently uses 1990-01-01. The start date was deliberately not changed until runtime coverage is verified against the new archive API.

## Validation commands

Static validation performed in the artifact environment:

- `git diff --no-index --check` against the previous V2 source; exit code `1` is expected because the files differ, and the command emitted no whitespace-error diagnostics.
- delimiter/balance scan of the modified Rust source.
- file-change inventory comparison.
- ZIP integrity and forbidden-build-artifact checks after packaging.

Required Windows validation after applying the patch:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  bhavcopy `
  -- --nocapture

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  binary_eod `
  -- --nocapture

cargo check `
  --manifest-path ".\src-tauri-shell\Cargo.toml"

npm run typecheck:renderer
npm test
npm run build:renderer
npm run tauri:check
```

After those pass:

```powershell
npm run tauri:portable:win
```

Runtime acceptance test:

- BSE + BSE Index
- Date range: `2023-12-01` to `2023-12-10`
- Download workers: `2`

Expected evidence:

- BSE weekday jobs stage/download successfully through the legacy archive path.
- BSE Index weekday jobs stage/download successfully through `IndexArchDailyAllPar`.
- weekends remain skipped.
- successful downloads reach the existing staged CSV/binary import path and emit binary diagnostics.

## Actual validation results

### Passed in artifact environment

- Source-change scope review: only `src-tauri-shell/src/bhavcopy.rs` modified, plus this report created.
- Static diff whitespace check: PASS (no whitespace-error diagnostics emitted; `git diff --no-index` returned `1` only because source content differs).
- Rust delimiter/balance scan: PASS.
- Go reference archive inspection: PASS; canonical downloader sources present.

### Not run in artifact environment

- Rust compilation: NOT RUN (`cargo` is not installed in the artifact runtime).
- Rust tests: NOT RUN.
- TypeScript tests/build: NOT RUN for this patch because frontend source is unchanged.
- Tauri build/package: NOT RUN.
- Live exchange requests: NOT RUN from the artifact runtime.

The Windows project remains the authoritative compile, test, package, and live-download validation environment.

## Risks or limitations

- Exchange upstream behavior can drift independently of this code.
- The BSE Index archive API is integrated from a currently working reference implementation and user runtime evidence, but the Rust port still requires Windows live validation.
- Older BSE Index history before 1990 is not enabled by this patch.
- Full pre-2013 NSE Index parity with the standalone downloader is not implemented here.
- Download-path improvements do not solve the separate binary-write bottleneck; binary performance must be evaluated once successful rows reach the importer.

## Rollback guidance

To roll back this change:

1. Restore `src-tauri-shell/src/bhavcopy.rs` from the previous confirmed source snapshot.
2. Remove this report if desired.
3. No database migration or data rollback is required because this patch changes download-source selection/network normalization only.
