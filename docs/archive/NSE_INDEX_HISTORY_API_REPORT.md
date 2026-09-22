# NSE Index Historical API Report

## Scope

This slice changes the active Tauri Bhavcopy backend for `NSE Index` downloads when no custom NSE index source override is configured.

## Changes

- Updated `src-tauri-shell/src/bhavcopy.rs`.
  - `NSE_INDEX` full-history start is now `1990-07-03`, matching the earliest `NIFTY 50` rows observed from the official NSE historical index page.
  - The default `NSE Index` flow now uses the official NSE Historical Index Data endpoint:
    - Page: `https://www.nseindia.com/reports-indices-historical-index-data`
    - API: `https://www.nseindia.com/api/historicalOR/indicesHistory`
  - User-selected multi-year ranges are split internally into inclusive 365-day-or-less chunks, so the UI can keep one start/end range.
  - The first implementation imports only the two priority canonical indices:
    - `NIFTY 50` -> `NIFTY`
    - `NIFTY BANK` -> `BANKNIFTY`
  - Old official names are canonicalized:
    - `S&P CNX NIFTY`, `CNX NIFTY` -> `NIFTY`
    - `BANK NIFTY`, `CNX BANK` -> `BANKNIFTY`
  - Close-only historical NIFTY rows with zero open/high/low are skipped instead of being stored as artificial OHLC candles.
  - Imported API rows still write through the existing SQLite/binary storage path and add `download_log` rows per imported trade date so update-mode detection continues to work.
  - If a custom NSE index URL override is configured, the legacy per-day index archive path remains in use.

## Behavior Notes

- The user does not need to manually select one year at a time. A range such as `1993-01-01` to `2026-05-23` becomes a sequence of NSE API chunk requests internally.
- This first slice deliberately does not expand to every index returned by NSE. The immediate goal is full NIFTY/BANKNIFTY history and symbol continuity.
- Weekend/holiday skip-result spam is avoided for the new API path because the API returns only available index rows for each chunk.

## Backup

- `backups/pre_opencode_changes_20260524_124610_nse-index-history-api`

## Validation

- `cargo check --manifest-path src-tauri-shell/Cargo.toml`: PASS
- `cargo test --manifest-path src-tauri-shell/Cargo.toml -- --nocapture`: PASS (`27` tests, run with isolated `TEMP`/`TMP` to avoid stale global temp `.eod` test artifacts)
