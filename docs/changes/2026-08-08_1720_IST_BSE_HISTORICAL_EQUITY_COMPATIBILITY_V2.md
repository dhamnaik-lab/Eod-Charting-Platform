# BSE Historical Equity Compatibility V2

## IST timestamp

2026-08-08 17:20 +05:30

## Objective

Correct the two targeted Rust test failures exposed after BSE Historical Equity Compatibility V1, without changing the V1 historical-source fallback or any BSE Index, binary-storage, database-format, worker, or unrelated application behaviour.

## Previous defect or limitation

The V1 targeted Bhavcopy test run completed with 21 passed and 2 failed tests:

1. `test_parse_bse_udiff_equity_bhavcopy` expected `trades == Some(3466)` but received `None`. The UDiFF fixture header is `TtlNbOfTxsExctd`, which normalizes to `TTLNBOFTXSEXCTD`; the parser only contained the misspelled legacy alias `TTLNOOFTXSEXCTD`.
2. `test_bse_uses_shared_cash_market_holiday_calendar` expected 2026-06-26 to resolve as Muharram, but `setup_test_db()` did not create or seed the production `market_holidays` table used by `build_batch_plan()`.

## Files changed

Modified:

- `src-tauri-shell/src/bhavcopy.rs`

Created:

- `docs/changes/2026-08-08_1720_IST_BSE_HISTORICAL_EQUITY_COMPATIBILITY_V2.md`

## Final implementation

- Added the correct normalized BSE UDiFF transaction-count header alias `TTLNBOFTXSEXCTD` while retaining the existing alias for compatibility.
- Extended the Bhavcopy in-memory test database with the production-compatible `market_holidays` schema.
- Seeded the exact holiday fixture required by the existing shared-calendar test: `2026-06-26`, `Muharram`, source `BUILTIN`.
- Preserved the V1 BSE legacy equity fallback `EQDDMMYY_CSV.ZIP` unchanged.
- BSE Index source generation remains unchanged.
- Binary EOD diagnostics and durability behaviour remain unchanged.

## Validation commands

Required on the Windows project after applying this V2 patch:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"

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

If these pass, build the normal portable application:

```powershell
npm run tauri:portable:win
```

## Actual validation results

Validation evidence that motivated V2, supplied from the Windows project for V1:

- Bhavcopy Rust tests: **21 passed, 2 failed**.
- `cargo check`: **passed**, with the known unused `BinaryWritePath::as_str` warning.
- Renderer typecheck: **passed**.
- Vitest: **36 files / 235 tests passed**.
- Renderer production build: **passed**.
- `npm run tauri:check`: **passed**, with the same known unused `BinaryWritePath::as_str` warning.

Validation performed on this V2 artifact environment:

- Source-diff scope check: passed; only `bhavcopy.rs` changed versus V1 plus this report.
- `git diff --check` equivalent whitespace check: passed.
- Delimiter-balance/static source sanity check: passed.
- Cargo/Rust compilation and tests: **not run in the artifact environment because Cargo/Rust is unavailable**. Windows validation is therefore required before portable packaging.

## Risks or limitations

- The test fixture intentionally seeds only the holiday required by the existing test; it does not duplicate the full production holiday calendar.
- Historical BSE Index sourcing remains unresolved and was deliberately not modified.
- The unrelated diagnostic warning for unused `BinaryWritePath::as_str` remains and will be cleaned during the binary-write performance follow-up.

## Rollback guidance

Restore the V1 `src-tauri-shell/src/bhavcopy.rs` from the 2026-08-08 16:42 IST BSE Historical Equity Compatibility V1 snapshot and remove this V2 report. No database migration or data rollback is required because V2 changes parser aliases and test-fixture setup only.
