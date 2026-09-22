# BSE Historical Equity Bhavcopy Compatibility V1

## IST timestamp

2026-08-08 16:42:00 +05:30

## Objective

Restore BSE Equity historical Bhavcopy compatibility for legacy dates while preserving the existing current BSE UDiFF/API path, database import semantics, binary EOD format, binary-write diagnostics, and worker settings.

## Baseline source

- Source snapshot: `Eod Charting Platform Source Code 2026-08-08_0116_IST_BHAVCOPY_BINARY_WRITE_DIAGNOSTICS_V1`
- This baseline already contains the Phase-1 binary-write diagnostics.
- The user subsequently validated that baseline on Windows with 20/20 targeted Rust binary tests passing, 235/235 frontend tests passing, renderer typecheck passing, production renderer build passing, `cargo check` passing, `npm run tauri:check` passing, and portable Windows release packaging completing successfully.

## Previous defect or limitation

A BSE/BSE Index date-range request for 2023-12-01 through 2023-12-10 produced zero imports. BSE Equity had one date prefiltered as already imported; the remaining BSE Equity trading-date jobs and all BSE Index jobs exhausted their configured source candidates and were logged as unavailable.

Inspection of `src-tauri-shell/src/bhavcopy.rs` showed that BSE Equity source generation only contained current/modern API and UDiFF-style candidates. It did not include the historical BSE Equity archive naming convention:

```text
EQDDMMYY_CSV.ZIP
```

For example, 2023-12-05 requires the legacy filename:

```text
EQ051223_CSV.ZIP
```

The parser also lacked aliases for the canonical legacy BSE Equity fields `SC_GROUP`, `NO_TRADES`, and `NO_OF_SHRS`. A legacy archive could therefore download successfully but lose group metadata and trade/volume values during parsing.

The prior generic source-exhaustion message, `No data available for this date (holiday or missing)`, also made a source-compatibility failure appear equivalent to a known exchange holiday.

## Files changed

1. `src-tauri-shell/src/bhavcopy.rs`
2. `docs/changes/2026-08-08_1642_IST_BSE_HISTORICAL_EQUITY_COMPATIBILITY_V1.md`

## Final implementation

### 1. Legacy BSE Equity archive fallback

The BSE Equity candidate sequence now preserves the current live API as the first candidate and the current UDiFF direct filename as the second candidate. It then adds the legacy BSE Equity ZIP archive before the older alternate CSV/API fallbacks:

```text
https://www.bseindia.com/download/BhavCopy/Equity/EQ{ddmmyy}_CSV.ZIP
```

This ordering avoids penalizing the normal current path when the live BSE API succeeds, while allowing older dates to fall through to the historical archive.

### 2. New `{ddmmyy}` template token

`apply_template` now supports `{ddmmyy}` using `DDMMYY`, required by the legacy BSE Equity filename convention.

The default BSE Equity template list also exposes the legacy archive pattern so the configured/default source surface reflects the actual fallback set.

### 3. Legacy BSE Equity parser aliases

The CSV parser now accepts:

- `SC_GROUP` as a series/group field
- `NO_TRADES` as the number-of-trades field
- `NO_OF_SHRS` as the volume/share-count field

Existing current aliases remain unchanged.

### 4. More precise BSE source-exhaustion logging

When all BSE source candidates are exhausted, the skip message now reports that no downloadable BSE source was found after trying the candidate set and states the remaining possibilities: holiday, unavailable archive, or source mismatch.

This does not classify a date as a holiday unless the existing holiday calendar already did so during planning.

### 5. Targeted tests added

Added tests that verify:

- a legacy BSE Equity row with `SC_GROUP`, `NO_TRADES`, and `NO_OF_SHRS` parses with correct series, volume, trades, and requested trade date;
- the 2023-12-05 candidate list generates `EQ051223_CSV.ZIP` and marks it as zipped;
- the existing live BSE API remains the first candidate and the modern UDiFF direct candidate remains ahead of the legacy fallback.

## Behaviour deliberately preserved

Unchanged:

- current BSE live API candidate remains first
- current BSE UDiFF direct candidate remains available
- BSE Equity URL override remains first when configured
- BSE Index candidate generation and parser behaviour
- NSE/NSE Index download paths
- holiday/weekend planning
- imported-date prefiltering
- SQLite schema and transaction ordering
- binary `.eod` format and write algorithms
- Phase-1 binary-write diagnostic instrumentation
- binary worker count
- download worker count
- frontend behaviour except the more precise BSE source-exhaustion text

## External evidence used

- BSE/SEBI UDiFF guidance documents the standardized `BhavCopy_BSE_..._<trade-date>...` filename family used by the modern path.
- Historical BSE downloader references independently document the legacy direct BSE Equity archive form `.../download/BhavCopy/Equity/EQDDMMYY_CSV.ZIP` and the legacy columns including `SC_GROUP`, `NO_TRADES`, and `NO_OF_SHRS`.

The exact continued availability of the 2023 archive on BSE infrastructure cannot be proven from this artifact environment and must be validated by the Windows runtime test below.

## Validation performed in artifact environment

The artifact environment does not provide Cargo/Rust, so no new Rust compile or unit-test pass is claimed for this patch.

Static validation performed:

- only `src-tauri-shell/src/bhavcopy.rs` is changed relative to the source baseline, apart from this report;
- legacy URL template is generated from `{ddmmyy}`;
- candidate order preserves live API first and modern direct UDiFF second;
- legacy candidate is marked zipped;
- legacy parser aliases are present;
- BSE Index source generation is unchanged;
- Rust delimiter balance check: PASS;
- `git diff --no-index --check` for `bhavcopy.rs`: PASS.

## Required Windows validation

Run from:

```text
E:\TA Projects\EOD Charting Platform
```

```powershell
cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  bhavcopy `
  -- --nocapture

cargo check `
  --manifest-path ".\src-tauri-shell\Cargo.toml"

npm run typecheck:renderer
npm test
npm run build:renderer
npm run tauri:check
```

If those pass, package with the user's normal workflow:

```powershell
npm run tauri:portable:win
```

Then retry BSE Equity first for the known test range:

```text
2023-12-01 to 2023-12-10
```

For the first compatibility verification, BSE Index may remain selected, but its failures must be evaluated separately because this V1 does not modify BSE Index historical sourcing.

## Expected runtime evidence

For BSE Equity, a successful legacy fallback should change at least some weekday results from:

```text
SKIP: [BSE] ... No downloadable BSE source found ...
```

to staged/imported success entries.

If historical rows reach binary storage, the existing Phase-1 diagnostics should also emit:

```text
Bhavcopy binary write stats: ...
Bhavcopy binary write paths: ...
Bhavcopy binary write detail: ...
Bhavcopy staged CSV timings: ...
```

Those lines remain required for the original binary-write performance investigation.

## Risks and limitations

- Continued availability of old `EQDDMMYY_CSV.ZIP` files on current BSE infrastructure is runtime-dependent and not verified in this artifact environment.
- BSE Index historical archive compatibility remains unresolved and intentionally unchanged in this patch.
- Legacy BSE files do not necessarily contain a date column; the parser therefore continues to use the requested task date when no date field is present. This is existing parser behaviour.
- The patch adds one fallback request only when earlier BSE Equity candidates do not succeed; the normal current API success path is unchanged.
- The Phase-1 diagnostic `BinaryWritePath::as_str` dead-code warning remains in the baseline and is not touched here to keep this change scoped to BSE historical compatibility.

## Rollback guidance

Restore:

```text
src-tauri-shell\src\bhavcopy.rs
```

from:

```text
Eod Charting Platform Source Code 2026-08-08_0116_IST_BHAVCOPY_BINARY_WRITE_DIAGNOSTICS_V1
```

and remove this report. No database migration, binary conversion, or data rollback is required because this change only affects source candidate selection, parser aliases, and logging.
