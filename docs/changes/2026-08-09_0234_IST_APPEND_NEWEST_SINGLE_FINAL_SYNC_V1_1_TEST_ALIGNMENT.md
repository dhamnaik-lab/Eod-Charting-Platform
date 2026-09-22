# APPEND_NEWEST Single Final Sync V1.1 — Test Alignment

## Timestamp

2026-08-09 02:34 +05:30

## Purpose

Align the Manual Import regression test with the already-implemented Phase 1 `APPEND_NEWEST` durability behavior.

## Trigger

Windows validation showed:

- `binary_eod`: 20 passed, 0 failed.
- `imports`: 101 passed, 1 failed.
- The sole failure was `test_import_csv_internal_binary_skip_skips_existing_dates`.
- Runtime diagnostics returned `sync_data_calls = 1`, while the test still asserted the previous pre-Phase-1 value `2`.

## Change

Modified only the test expectation in `src-tauri-shell/src/imports.rs`:

- before: `assert_eq!(diagnostics.sync_data_calls, 2);`
- after: `assert_eq!(diagnostics.sync_data_calls, 1);`

## Runtime behavior

No runtime behavior changed. The Phase 1 implementation remains:

- `APPEND_NEWEST` writes the new record and updated header,
- performs one final `flush()`,
- performs one final `sync_data()`,
- then reports success.

No worker counts, binary format, database schema, downloader behavior, series behavior, or other write paths were changed.

## Required validation

```powershell
cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  imports `
  -- --nocapture
```

Expected: 102 passed, 0 failed.

The previously passing `binary_eod` suite does not need a source correction, but it may be rerun if desired.
