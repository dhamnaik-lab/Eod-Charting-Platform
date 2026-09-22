# Bhavcopy Recovery Hardening Phase 2B.1 V1

## Timestamp

2026-08-09 21:10 +05:30

## Status

**Accepted prerequisite for Phase 2C.** This patch itself is recovery hardening only: it does not reduce a Bhavcopy foreground durability barrier. At the Phase 2B.1 validation point, `APPEND_NEWEST` still performed its existing final `flush()` + `sync_data()` per symbol. The later accepted Phase 2C change deliberately modifies only that APPEND_NEWEST foreground durability behavior while relying on the baselines defined here.

Accepted validation before Phase 2C:

- `bhavcopy_recovery`: 8/8 PASS
- `binary_eod`: 20/20 PASS
- `bhavcopy`: 35/35 PASS
- `imports`: 104/104 PASS
- `cargo check`: PASS
- renderer typecheck/tests/build: PASS
- Tauri check: PASS

## Why this patch exists

The Phase 2 durability contract requires structural interrupted-append repair before Phase 2C is allowed to omit foreground per-symbol `sync_data()`. The Phase 2B implementation present in the 2026-08-09_205627_IST baseline had durable journal/manifest integrity and replay, but it did not yet persist a pre-mutation binary baseline for each APPEND_NEWEST candidate or test safe rollback of an interrupted append tail.

Phase 2B.1 closes that safety gap before any speed behavior is changed.

## Quote Editor audit result

The fresh baseline code is already correct: quotation deletion keeps instrument identity even when the final quote is removed. The regression test `test_delete_quote_range_keeps_instrument_when_last_quote_is_removed` proves this.

The older `2026-08-09_1418_IST_QUOTE_DELETE_ORPHAN_SYMBOL_PRUNE_V1.md` document contradicted the current code, so it is marked **SUPERSEDED** rather than being treated as current architecture.

## Recovery changes

### 1. Pre-mutation binary baselines

Before the PREPARED journal is committed, the Bhavcopy parser now captures a small baseline record for every touched exchange/symbol. For existing structurally valid files it records:

- exchange and symbol;
- pre-import header record count;
- pre-import price scale;
- exact pre-import file length;
- journal target dates for that symbol;
- classification as `APPEND_NEWEST` candidate or `CONSERVATIVE`.

A file qualifies as an APPEND_NEWEST candidate only when the earliest incoming journal date is strictly later than the existing last binary date. Missing/new files remain `CONSERVATIVE` in Phase 2B.1 because Phase 2C V1 is scoped to existing-file APPEND_NEWEST only.

If an existing file is already structurally inconsistent before mutation (header count does not match exact expected file length), protected Bhavcopy import is refused before mutation.

### 2. Backward-compatible manifest extension

`binaryBaselines` is added to the existing `eod-bhavcopy-recovery-v1` manifest with `serde(default)`. A SHA-256 digest of the canonical serialized baseline list is stored in `binaryBaselinesSha256` and validated before recovery can use those boundaries. Older pending Phase 2B sessions that do not contain these fields remain readable and use the previous conservative replay behavior.

### 3. Recovery rollback before replay

For an APPEND_NEWEST baseline, recovery now restores the file to the recorded pre-import boundary before replaying the durable journal:

1. require the pre-existing `.eod` file to still exist;
2. require the file to be at least as long as its pre-import length;
3. inspect every complete post-baseline tail record;
4. permit rollback only when each tail record exactly matches a canonical journal row for the same exchange/symbol/date;
5. refuse rollback if an unknown later date exists or if a journal date has since been changed;
6. truncate to the pre-import length;
7. restore header record count and price scale;
8. `flush()` + `sync_data()` the restored baseline;
9. replay the durable journal using the current conservative synchronized binary writer.

This prevents recovery from deleting unrelated later mutations while giving Phase 2C a deterministic pre-import boundary for interrupted buffered appends.

## Tests added

The recovery test suite adds:

- binary-baseline manifest SHA-256 integrity is enforced;
- APPEND_NEWEST baseline restores the exact pre-import tail/header;
- APPEND_NEWEST rollback refuses an unknown post-baseline date;
- APPEND_NEWEST rollback refuses a same-date tail record whose binary values no longer match the recovery journal.

Expected targeted recovery count after this patch: **8 tests** (previous 4 + 4 hardening tests).

## Explicitly unchanged

- Bhavcopy binary workers remain **4**.
- `APPEND_NEWEST` still calls `sync_data()` once per symbol in normal foreground imports.
- `REWRITE_TAIL`, `UPDATE_EXISTING`, `INSERT_HISTORICAL` are unchanged.
- Manual CSV/TXT import is unchanged.
- binary `.eod` format is unchanged.
- provider/download logic is unchanged.
- download-log semantics are unchanged.
- no database migration is introduced.

## Windows validation

Run from `E:\TA Projects\EOD Charting Platform`:

```powershell
cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  bhavcopy_recovery `
  -- --nocapture

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
npm run tauri:check
```

After all validation is green, Phase 2C can introduce a **Bhavcopy-only, journal-governed APPEND_NEWEST buffered mode**.
