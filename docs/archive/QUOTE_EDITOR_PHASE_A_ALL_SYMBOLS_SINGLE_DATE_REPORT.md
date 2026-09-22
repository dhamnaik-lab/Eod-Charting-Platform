# Quote Editor Phase A: All Symbols / Date Tools

Date: 2026-06-29

## Scope

Add the missing AmiBroker-style Quotations Editor mode for:

- loading all quotes for one `exchange + date`
- deleting that one date across all symbols
- keeping the existing current-symbol/all-quotes workflow unchanged

## Files changed

- `src/components/DatabaseToolsDialogs.tsx`
- `src/types/desktop.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts`
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/quotes.rs`
- `src-tauri-shell/src/main.rs`
- `HANDOFF.md`

## Behavior

### UI

- `Single Symbol / Date Range` remains available.
- `All Symbols / Date Tools` is now selectable instead of disabled.
- In date mode:
  - `Load` fetches all quote rows for the chosen `exchange + date`
  - clicking a row fills the left-side form with that symbol/date OHLCV
  - `Save` updates the selected or typed symbol on that date
  - `Delete` will auto-load the requested single date if needed, then remove that exact date across all resolved symbols for the exchange
  - `Delete` also supports an exchange-wide `Delete From` / `Delete To` range across all symbols
  - the minimized quote-editor window should only restore on an explicit open request, not during normal active-symbol changes

### Backend

- Added list-by-date quote read path across binary `.eod` files with SQLite hybrid fallback merge.
- Added delete-by-date-across-symbols mutation across binary `.eod` files and SQLite rows.
- Moved `list_quotes_by_date` to `spawn_blocking` so the desktop UI does not freeze while scanning binary `.eod` files.
- The date-mode delete mutation now accepts an optional resolved symbol list plus an optional `toDate`, so the UI can:
  - delete only the exact loaded session symbols for a single date
  - delete an exchange-wide date range across all symbols when a range is requested
- The binary all-symbol delete path now processes target `.eod` files through a small bounded worker pool instead of one long serial file loop.
- The Tauri delete command wrappers now write quote-delete start/end/error timing to `app-runtime.log`, including delete kind, date range, deleted count, and `elapsedMs`.
- Existing symbol-specific quote list/save/delete paths are preserved.

## Validation

- `cargo test --manifest-path src-tauri-shell/Cargo.toml test_delete_quote_date_internal_binary_mode_removes_selected_day_across_symbols` PASS
- `cargo test --manifest-path src-tauri-shell/Cargo.toml test_delete_quote_date_internal_binary_mode_targets_loaded_symbols_only` PASS
- `cargo test --manifest-path src-tauri-shell/Cargo.toml test_delete_quote_date_internal_binary_mode_removes_selected_range_across_symbols` PASS
- `scripts/validate-change.ps1 -Profile renderer` PASS

## Manual QA still needed

- load one known populated `exchange + date` in the new mode
- verify the app remains responsive during the date-mode load
- verify the row count and row selection behavior
- verify all-symbol single-date delete count and chart refresh for the active symbol
- verify all-symbol multi-date range delete count
- verify saving one selected symbol in date mode reloads the same date view
- verify the minimized window stays minimized until explicitly reopened
