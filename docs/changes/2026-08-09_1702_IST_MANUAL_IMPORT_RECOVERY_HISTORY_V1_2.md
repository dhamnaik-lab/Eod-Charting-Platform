# Manual Import Recovery History V1.2

## Status

**Functionally accepted.** A restart-persistence check showed three independent persisted sessions newest-first (two `APPLIED`, one `UNDONE`), with Undo available only on undoable sessions. The broader Manual Import Recovery validation path also passed recovery/import/binary tests, renderer checks, Tauri checks, and portable build during the accepted recovery work. The later V1.2.1 renderer nullability hotfix is present in the August 10 source snapshot.

## Purpose

Expose every persisted Binary Manual Import recovery session for the active database instead of showing only the latest recoverable session.

The V1/V1.1 recovery journal already stores separate session directories under:

`<database-folder>\manual_import_recovery\sessions\<session-id>`

A real acceptance test on 2026-08-09 confirmed that three separate sessions survived application restarts: one `UNDONE` session and two `APPLIED` sessions. V1.2 makes that retained history operator-visible.

## Behavior

- Adds `list_manual_import_recovery_history` to return all valid sessions bound to the active database, newest first.
- Keeps `get_latest_manual_import_recovery` for backward compatibility.
- Manual Import UI shows `Manual Import Recovery History (Binary)` and the total session count.
- Every session shows timestamp, state, exchange, source-file count, inserted/skipped rows, planned changes, date range, and session ID.
- Every undoable session gets its own `Undo This Import` action.
- Undo remains session-specific and retains the V1 conflict rule: current rows that no longer match the recorded after-image are preserved as conflicts.
- `UNDONE` sessions remain visible as history but are not undoable again.
- `APPLYING`, `UNDOING`, `FAILED`, `PARTIAL_CONFLICT`, and `RECOVERY_ERROR` sessions remain visible and use the existing retryability contract.
- Recovery history is refreshed after successful import, failed import, and Undo.
- History is read from durable disk state each time the Manual Import window opens, so it survives application restart.

## Non-goals

- No change to journal schema.
- No change to binary `.eod` format.
- No change to Bhavcopy.
- No automatic symbol deletion from Quotation Editor.
- No deletion or compaction policy for old recovery sessions in this slice.

## Regression coverage

Adds `list_session_summaries_returns_all_sessions_newest_first`, proving that multiple states remain independently discoverable and ordered newest-first.

## Validation

Run in order:

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
  binary_eod `
  -- --nocapture

cargo check --manifest-path ".\src-tauri-shell\Cargo.toml"
npm run typecheck:renderer
npm test
npm run build:renderer
npm run tauri:check
```

After validation, build the portable package:

```powershell
npm run tauri:portable:win
```

## Functional acceptance

Open the existing disposable `New Database` used for recovery testing. Open Manual Import without selecting files. The history panel should immediately show the three already-persisted sessions, newest first:

- `APPLIED`, BSE, 6 files, 2023-11-12 to 2023-11-20
- `APPLIED`, BSE, 8 files, 2023-11-01 to 2023-11-10
- `UNDONE`, BSE, 8 files, 2023-11-01 to 2023-11-10

Undoing either `APPLIED` session must update only that selected session and preserve the remaining history entries.
