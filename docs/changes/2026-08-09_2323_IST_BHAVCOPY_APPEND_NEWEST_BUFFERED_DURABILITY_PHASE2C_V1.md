# Bhavcopy APPEND_NEWEST Buffered Durability — Phase 2C V1

Date: 2026-08-09 23:23 IST

## Status

**Accepted and runtime-proven.** This phase changes only Bhavcopy existing-file `APPEND_NEWEST` durability behavior. Manual Import and conservative binary mutation paths remain on immediate durability.

## Baseline

This change is designed for the validated Phase 2B.1 source state derived from:

- `Eod Charting Platform Source Code 2026-08-09_205627_IST`
- Manual Import Recovery History V1.2.1 already present in that snapshot
- Bhavcopy Recovery Hardening Phase 2B.1 V1 applied and validated afterward

Phase 2B.1 validation before this change:

- `bhavcopy_recovery`: 8 passed, 0 failed
- `binary_eod`: 20 passed, 0 failed
- `bhavcopy`: 35 passed, 0 failed
- renderer typecheck/tests/build and Tauri check: passed

## Problem being addressed

The controlled 4-worker benchmark showed that normal newest-date Bhavcopy imports spend nearly all binary write time waiting on one physical `sync_data()` per `APPEND_NEWEST` symbol. The previous measured reference was approximately:

- binary write wall time: 305.8 s
- `APPEND_NEWEST`: 8,132 symbols
- `sync_data`: 8,132 calls attributable to those appends
- summed `sync_data` time: approximately 1,168 s

Phase 1 reduced two physical barriers per append to one. Phase 2C removes that remaining per-symbol barrier from the foreground Bhavcopy apply path while keeping a durable replay contract.

## Safety prerequisite

This phase depends on Phase 2B.1. Before binary mutation begins, Bhavcopy already persists:

1. a durable normalized NDJSON journal;
2. journal byte length and SHA-256;
3. database-folder binding;
4. exact pre-import `APPEND_NEWEST` record count, price scale and file length;
5. target dates and binary row representations;
6. a durable recovery session state machine.

The journal and manifest are physically synchronized before the protected import mutates binary history.

## Phase 2C behavior

### 1. New typed binary durability policy

`binary_eod.rs` adds:

- `BinaryWriteDurability::Immediate`
- `BinaryWriteDurability::RecoveryJournalBuffered`

The existing public `append_or_merge_records_with_stats()` API remains immediate-durability by default. Existing callers therefore retain their prior behavior unless they explicitly opt into recovery-journal buffering.

### 2. Only `APPEND_NEWEST` may defer `sync_data()`

With `RecoveryJournalBuffered`:

- appended record bytes are written;
- header count/price scale are updated;
- `flush()` is still performed;
- the per-symbol `sync_data()` is deferred;
- diagnostics increment `deferred_sync_calls`.

`REWRITE_TAIL`, `UPDATE_EXISTING`, `INSERT_HISTORICAL` and other conservative paths still use their existing physical durability behavior.

Manual Import does not opt into this mode.

### 3. Successful buffered imports retain the recovery session

If the foreground Bhavcopy import reports one or more deferred append syncs:

- session state becomes `APPLIED`;
- the recovery session directory is **not removed**;
- the UI/runtime log reports how many `APPEND_NEWEST` checkpoints remain deferred.

This is essential. A buffered `.eod` write is not treated as durably checkpointed merely because the operating-system cache accepted it.

### 4. Deferred checkpoint verification

Before a later Bhavcopy download, an `APPLIED` buffered session is processed first.

For every captured `APPEND_NEWEST` baseline, the checkpoint verifies:

- exact final file length;
- exact expected header record count;
- expected Bhavcopy price scale;
- every appended binary tail record against the durable journal, in order;
- duplicate same-date journal rows are preserved and compared positionally rather than collapsed into a date-key map.

Only after verification does the checkpoint call `sync_data()` on the file.

After all buffered append files are physically synced:

- state becomes `CHECKPOINTED`;
- the recovery session can be removed.

### 5. Verification failure falls back to durable replay

If an `APPLIED` session cannot be verified — for example after a process/OS interruption where the buffered tail was only partially persisted — the session is not discarded.

Recovery instead:

1. moves back to `APPLYING`;
2. validates and restores each protected `APPEND_NEWEST` file to its exact pre-import boundary;
3. replays the durable normalized journal through `BinaryWriteDurability::Immediate`;
4. writes download-log state;
5. physically checkpoints and removes the recovery session only after durable replay succeeds.

Unknown or conflicting post-baseline records still fail closed into recovery error rather than being truncated silently.

## Deferred-checkpoint lifecycle and Phase 2D decision

Phase 2C defers the physical checkpoint; it does not make that checkpoint asynchronous. The accepted Windows run proved that this is sufficient for the current environment:

- append-heavy foreground import: 43,081 rows;
- `APPEND_NEWEST`: 9,312 files;
- foreground `sync_data`: 0 calls for those appends;
- deferred APPEND_NEWEST sync: 9,312 calls;
- binary-write wall time: 23.325 s;
- prior comparable 4-worker reference: approximately 305.8 s;
- next-operation checkpoint of all 9,312 retained files: approximately 4 s.

Because the checkpoint did **not** shift a multi-minute cost to the next download, Phase 2D background checkpointing is **not required at present**. Reconsider Phase 2D only if future real workloads show checkpoint latency that materially blocks the operator.

## Diagnostics added

The existing binary detail line now includes:

`deferred APPEND_NEWEST sync N calls`

For the controlled 07-Aug-2026 append-heavy benchmark, the acceptance signal is:

- `append newest` remains approximately the same as the reference workload;
- foreground `sync_data` calls for those append paths fall to zero;
- `deferred APPEND_NEWEST sync` is approximately equal to the `append newest` count;
- conservative rewrite/historical paths may still contribute a small number of foreground `sync_data` calls.

## Tests added/strengthened

### `binary_eod`

- buffered `APPEND_NEWEST` writes flush but report zero physical sync calls and one deferred sync call;
- default API remains immediate durability.

### `bhavcopy_recovery`

- complete buffered append tail verifies and checkpoints;
- missing/incomplete applied tail cannot be checkpointed and therefore cannot lose its journal;
- duplicate same-date journal rows are preserved in exact positional order during rollback validation;
- existing Phase 2B.1 conflict and integrity tests remain in force.

### `bhavcopy`

- Bhavcopy-specific buffered mode reaches `APPEND_NEWEST`, reports zero immediate sync calls and one deferred sync while preserving readable binary content.

## Validation commands

Run in order from the project root:

```powershell
cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  bhavcopy_recovery `
  -- --nocapture

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  binary_eod `
  -- --nocapture

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

Expected focused counts after this patch are approximately:

- `bhavcopy_recovery`: 11 tests
- `binary_eod`: 21 tests
- `bhavcopy` filter: 39 tests because it also matches the `bhavcopy_recovery` module

Do not build the portable package until the focused and broader validation gates pass.

## Controlled performance acceptance test

After validation and portable build, use the same known append-heavy workload used for the prior 4-worker reference where possible.

Capture the complete Bhavcopy log **before starting another Bhavcopy download**, because the next download intentionally performs the deferred checkpoint for the prior session.

Compare:

- binary write wall time;
- `APPEND_NEWEST` count;
- `sync_data` milliseconds/calls;
- `deferred APPEND_NEWEST sync` calls;
- p50/p95/max symbol write time;
- total imported rows and symbol counts;
- recovery-session state after completion.

The successful foreground import should leave one `APPLIED` recovery session when deferred appends occurred. That retained session is expected and is the durability guarantee, not a leak.

## Windows acceptance

Broader Phase 2C validation completed successfully:

- `binary_eod`: 21/21 PASS
- Bhavcopy/recovery filter: 39/39 PASS at the Phase 2C validation point
- `imports`: 104/104 PASS
- `cargo check`: PASS
- renderer typecheck: PASS
- repository tests: 36 files / 235 tests PASS
- renderer build: PASS
- Tauri check: PASS
- portable Windows build: PASS

The runtime benchmark above is the decisive acceptance evidence. Historical/backward fills can remain slower because `REWRITE_TAIL` and `INSERT_HISTORICAL` deliberately keep immediate physical durability; those workloads must not be compared directly with an APPEND_NEWEST benchmark.

## Non-goals

This patch does not:

- change provider URLs or download workers;
- change the 4-worker Bhavcopy binary cap;
- change Manual Import durability or Manual Import Recovery History;
- redesign prefiltering;
- alter series filtering/identity architecture;
- solve BSE historical chart-visibility issues;
- implement Phase 2D background checkpointing;
- remove conservative-path `sync_data()` calls.
