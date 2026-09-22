# Bhavcopy Recovery Infrastructure Phase 2B V1

## Timestamp

2026-08-09 12:47 +05:30

## Objective

Implement the first executable layer of the approved Bhavcopy Recoverable Durability Contract **without reducing any existing per-symbol `sync_data()` durability barrier**.

This phase introduces a durable normalized-row recovery journal and manifest before staged Bhavcopy CSV rows are allowed to mutate the active database/binary store. It also adds idempotent replay of an unfinished session before a later Bhavcopy operation begins.

## Baseline retained

The current validated performance baseline remains unchanged:

- Bhavcopy binary worker cap: **4**
- `APPEND_NEWEST`: **one final `flush()` + one final `sync_data()` per symbol**
- other binary write paths: unchanged
- manual CSV/TXT binary workers: unchanged

Phase 2B is a recoverability prerequisite, not yet the speed-release that removes foreground append synchronization.

## Design authority

The implementation follows:

`docs/changes/2026-08-09_1240_IST_BHAVCOPY_RECOVERABLE_DURABILITY_CONTRACT_V1.md`

## Files modified

- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/Cargo.lock`
- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/bhavcopy.rs`
- `FILE_INVENTORY.md`

## Files added

- `src-tauri-shell/src/bhavcopy_recovery.rs`
- `docs/changes/2026-08-09_1240_IST_BHAVCOPY_RECOVERABLE_DURABILITY_CONTRACT_V1.md`
- `docs/changes/2026-08-09_1247_IST_BHAVCOPY_RECOVERY_INFRASTRUCTURE_PHASE2B_V1.md`

## Implementation

### 1. Durable recovery-session module

Added `bhavcopy_recovery.rs` with:

- recovery schema `eod-bhavcopy-recovery-v1`;
- session manifest and state model;
- normalized-row NDJSON journal;
- SHA-256 integrity binding;
- journal byte-length validation;
- active-database-folder binding;
- manifest state persistence with backup fallback;
- pending-session discovery;
- checkpointed-session cleanup;
- focused filesystem/integrity tests.

Recovery files are stored under the active database folder:

```text
<database-folder>\bhavcopy_recovery\sessions\<session-id>\
  manifest.json
  records.ndjson
```

### 2. Journal contents

The journal stores the exact post-parser rows being sent to the current import engine, including:

- exchange/date/symbol;
- instrument name;
- series;
- ISIN;
- OHLC / previous close;
- volume / OI / trades;
- exact canonical binary `EodRecord` fields.

This preserves current import semantics and avoids needing provider/network access for replay.

### 3. PREPARED gate before mutation

For staged CSV batch imports, Phase 2B now:

1. parses/normalizes source jobs using the existing parser;
2. writes the normalized journal;
3. flushes and `sync_data()`s the journal file;
4. writes a SHA-256-bound PREPARED manifest and physically syncs it;
5. changes state to APPLYING;
6. only then calls the existing metadata/binary import path.

The existing `.eod` synchronization remains intact.

### 4. Successful-session completion

Because current Phase 1 durability remains active, a successful Phase 2B import is already physically synchronized by the existing binary writer.

After binary writes and normal `download_log` writes succeed:

- the recovery session is marked CHECKPOINTED;
- the temporary recovery session is removed.

Therefore normal successful imports do not accumulate journal files indefinitely.

### 5. Interrupted-session replay

Before either the single NSE Bhavcopy operation or batch Bhavcopy operation begins, the backend scans for unfinished recovery sessions.

For a valid pending session it:

1. validates schema/database binding/journal length/SHA-256;
2. reconstructs `ParsedBhavcopyFile` rows from the durable journal;
3. re-runs the existing idempotent metadata/binary import path;
4. retains the existing conservative `sync_data()` behavior during recovery;
5. reconstructs successful `download_log` entries;
6. marks the session CHECKPOINTED;
7. removes the recovered session directory.

### 6. Failure behavior

If the protected import returns an error or reports binary symbol-write errors:

- the recovery journal is retained;
- the session is marked FAILED where possible;
- the operation returns an error rather than silently discarding the recovery source.

If automatic recovery itself fails, the session is marked RECOVERY_ERROR where possible and a later Bhavcopy mutation is blocked rather than proceeding on uncertain state.

### 7. Panic/crash behavior

A process panic or machine interruption after PREPARED/APPLYING can leave the session directory on disk. The next Bhavcopy operation discovers and replays it before building a new download plan.

This is the first executable proof of the recovery model required before a later Phase 2C may reduce foreground per-symbol append synchronization.

## Dependency

Added direct dependency:

```toml
sha2 = "0.10"
```

The same `sha2 0.10.9` package already existed transitively in the current Cargo lockfile; the lockfile root package dependency list is updated accordingly.

## Tests added in `bhavcopy_recovery.rs`

1. prepared session round-trip and SHA-256 validation;
2. persisted state transition and checkpoint cleanup;
3. corrupted journal rejection;
4. wrong-database binding rejection.

## Behavior deliberately unchanged

Phase 2B does **not** change:

- `APPEND_NEWEST` `sync_data()` call count;
- `REWRITE_TAIL`, `UPDATE_EXISTING`, `INSERT_HISTORICAL` durability;
- binary EOD format;
- SQLite price schema;
- Bhavcopy binary worker cap (remains 4);
- user HTTP/download worker setting;
- manual CSV/TXT import path;
- series/exclusion semantics;
- duplicate symbol/date handling;
- BSE/NSE provider selection;
- prefilter reconciliation;
- chart loading;
- the separate BSE historical visibility issue;
- the separate `NSE:TRIDENT` series/identity issue.

## Expected normal-run log addition

A staged CSV import should now expose a message similar to:

```text
Bhavcopy recovery journal prepared: session <id> / <rows> rows
```

The ordinary binary diagnostic line must still show the existing one-sync-per-append behavior.

For the 2026-08-07 NSE+BSE benchmark, the expected Phase 2B binary relationship remains approximately:

```text
APPEND_NEWEST = 8132
sync_data calls = 8132
binary workers = 4
```

Phase 2B may add a small sequential journal preparation overhead. A major binary-write speed gain is **not** expected until Phase 2C.

## Windows validation required

Run from:

```text
E:\TA Projects\EOD Charting Platform
```

### Targeted tests

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
```

### Compile checks

```powershell
cargo check `
  --manifest-path ".\src-tauri-shell\Cargo.toml"

npm run tauri:check
```

### Portable build after all tests pass

```powershell
npm run tauri:portable:win
```

## Phase 2B functional validation

After the portable build, first run a normal small Bhavcopy import and confirm:

- recovery journal prepared message appears;
- import succeeds;
- binary diagnostics still show current sync policy;
- no leftover normal-session folder remains under `bhavcopy_recovery\sessions` after successful checkpoint/cleanup.

A deliberate crash/fault-injection validation should be performed only after normal validation is green. Do not simulate power loss on the production database for the first recovery test; use a disposable database copy.

## Rollback

Restore the pre-Phase-2B versions of:

- `Cargo.toml`
- `Cargo.lock`
- `main.rs`
- `bhavcopy.rs`

and remove `bhavcopy_recovery.rs`.

No database migration or `.eod` format rollback is required because Phase 2B creates only transient recovery-session files under `bhavcopy_recovery`.
