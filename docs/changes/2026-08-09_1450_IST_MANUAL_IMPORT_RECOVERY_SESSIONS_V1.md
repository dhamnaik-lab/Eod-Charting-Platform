# Manual Import Recovery Sessions V1

Date: 2026-08-09 IST
Status: implementation candidate; Windows validation required before release use
Scope: Binary-storage Manual CSV/TXT import and Quotation Editor deletion semantics

## Problem

A Manual Import can be pointed at the wrong exchange, wrong files, or wrong duplicate mode. A date-range deletion is not a correct recovery mechanism because quotation history and instrument identity are separate concerns. Deleting quotation rows must not implicitly delete valid NSE/BSE instrument metadata.

The incident that motivated this contract was a set of BSE Equity CSV files manually imported with target Exchange = NSE. Duplicate mode was `Skip`, so genuine existing NSE symbol/date rows were preserved while new BSE rows and placeholder NSE instrument entries were created.

## V1 decisions

1. Quotation Editor deletes quotation records only. It never removes instrument/catalog identity as a side effect.
2. Binary Manual Import creates a durable, session-scoped recovery journal before it mutates binary EOD files or creates placeholder instrument rows.
3. The Manual Import dialog warns when source paths clearly indicate NSE/BSE but the selected target exchange disagrees. The Rust command enforces the same guard unless the UI passes an explicit acknowledgement after confirmation.
4. A recoverable Binary Manual Import can be undone after the import completes, after the dialog closes, or after an application restart.
5. Undo is conflict-safe. It does not blindly delete a date range and it does not overwrite rows that no longer match the recorded import after-image.
6. Manual Import and Manual Import Undo are serialized by a process-level mutation lock so those two operations cannot run concurrently.

## Recovery storage

Each recoverable Binary Manual Import writes under the active database folder:

```text
manual_import_recovery/
  sessions/
    <session-id>/
      manifest.json
      manifest.json.bak
      changes.ndjson
```

The journal is prepared and physically synced before binary import mutation begins.

`manifest.json` records:

- schema version and session state
- database-folder binding
- target exchange and duplicate mode
- source file canonical path, byte length, and SHA-256
- journal byte length, row count, and SHA-256
- source/import row counts
- symbol count and date range
- exact list of instrument keys that did not exist before the import

`changes.ndjson` records the exact per-symbol/per-date mutation contract:

- `INSERT`: no before-image; exact imported after-image
- `OVERWRITE`: exact before-image plus exact imported after-image

No source CSV is required to exist later for undo; the source hashes are retained as provenance evidence and the row images needed for recovery are in the journal.

## Session states

```text
PREPARED
APPLYING
APPLIED
FAILED
UNDOING
UNDONE
PARTIAL_CONFLICT
RECOVERY_ERROR
```

`PREPARED`, `APPLYING`, `APPLIED`, `FAILED`, `UNDOING`, `PARTIAL_CONFLICT`, and `RECOVERY_ERROR` are retryable/undoable states. This makes an interrupted import or interrupted undo recoverable after restart.

## Undo rules

### Row inserted by the import

- current row equals recorded after-image -> delete it
- current row is already absent -> no-op
- current row exists but differs -> conflict; preserve current data

### Row overwritten by the import

- current row equals recorded after-image -> restore the recorded before-image
- current row already equals before-image -> no-op
- current row is absent or differs from both -> conflict; preserve current state

Undo rewrites per symbol, not one row at a time, and uses a staged/backup replacement path for the binary file.

## Instrument identity rollback

Only instrument rows proven to have been absent before the Manual Import are candidates for removal.

A session-created instrument is removed only after undo if all of the following remain true:

- no binary quotation remains
- no SQLite quotation remains
- the instrument still has the untouched Manual Import placeholder shape (`name = symbol`, `series = EQ`, no ISIN, no BSE security code, no sector/industry/series-as-of metadata, current/active lifecycle defaults)
- no other database table contains a symbol reference to it

The reference guard discovers symbol-like columns (`symbol` and `*_symbol`) across the current schema and loads referenced symbols before instrument cleanup. If identity metadata was enriched or another subsystem references the symbol, the instrument is preserved.

## Exchange mismatch prevention

The UI and backend inspect selected source paths for path components such as:

```text
.../BSE/...
.../NSE/...
```

Examples:

- BSE source path + target NSE -> warning and explicit confirmation required
- NSE source path + target BSE -> warning and explicit confirmation required
- mixed NSE and BSE source folders -> warning and explicit confirmation required
- custom paths with no clear hint -> no automatic inference

This is a guardrail, not an exchange-data classifier.

## Scope boundary

V1 recovery is implemented for **Binary Manual Import**. Hybrid/SQLite Manual Import continues to use the existing import path and does not receive this V1 recovery session contract.

This feature is prospective. It cannot reconstruct an exact recovery session for an import that occurred before this journaling code existed.

## Quotation Editor correction

The earlier `QUOTE_DELETE_ORPHAN_SYMBOL_PRUNE_V1` behavior is superseded. Ordinary quote deletion no longer prunes symbol metadata, even when the deleted quotation was the symbol's final stored price row.

Instrument lifecycle and quotation lifecycle remain separate.

## Validation required on Windows

Run from the project root:

```powershell
cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  manual_import_recovery `
  -- --nocapture

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  imports `
  -- --nocapture

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  quotes `
  -- --nocapture

cargo check `
  --manifest-path ".\src-tauri-shell\Cargo.toml"

npm run typecheck:renderer
npm test
npm run build:renderer
npm run tauri:check
```

Do not use a repo-wide `cargo fmt` as part of this validation; the current project contains pre-existing formatting differences outside this change.

Only after the tests/checks above pass:

```powershell
npm run tauri:portable:win
```

## Acceptance scenarios

1. Import BSE-folder files with target NSE: warning appears; cancelling performs no mutation.
2. Confirm the mismatch intentionally: Binary import completes and exposes a recovery session.
3. `Skip` import: undo removes only rows actually inserted by that session; pre-existing duplicate rows remain untouched.
4. `Overwrite` import: undo restores before-images.
5. Change an imported row after import, then undo: changed row is reported as conflict and preserved.
6. Create a new symbol through Manual Import, then undo immediately: its placeholder metadata is removed only if no quotes/references remain.
7. Add identity/watchlist/corporate-action reference after import, then undo: symbol metadata is preserved.
8. Close/restart after a completed import: latest recoverable Binary session remains available.
9. Interrupt an import or undo: retry remains possible from `APPLYING`/`UNDOING` state.
10. Use Quotation Editor to delete the final quote of a legitimate symbol: the instrument remains in the symbol catalog.
