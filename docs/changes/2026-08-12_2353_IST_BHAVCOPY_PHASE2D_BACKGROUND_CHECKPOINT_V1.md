# Bhavcopy Phase 2D — Background Deferred Checkpoint V1

**IST timestamp:** 2026-08-12 23:53 +05:30  
**Project:** EOD Charting Platform  
**Scope:** Bhavcopy deferred APPEND_NEWEST checkpoint execution only

## Trigger evidence

A real post-Phase-2C runtime showed that foreground import performance remained healthy, but the next Bhavcopy operation was blocked by the deferred durability checkpoint:

- session: `20260812T143215.473693Z-p11660-0`
- deferred APPEND_NEWEST files: **8,570**
- foreground checkpoint start: **23:29:50**
- checkpoint complete: **23:47:28**
- blocking wall time: **17 minutes 38 seconds** (~1,058 seconds, ~123 ms/file)

The interrupted-checkpoint resume fix was already accepted before this change. That fix correctly routed `APPLIED` / `CHECKPOINTING` sessions through the checkpoint path instead of full journal replay. The remaining problem is checkpoint execution cost, not recovery-state correctness.

## Objective

Preserve Phase 2C's fast foreground APPEND_NEWEST writes and recovery guarantees while moving normal deferred durability work out of the next Bhavcopy operation.

## Implementation

### 1. Automatic background checkpoint after a successful batch import

After `bhavcopy-write-complete`, a successful batch with imported rows schedules a Tauri blocking background task. The task:

1. loads pending recovery sessions for the active database;
2. selects only sessions in `APPLIED` or `CHECKPOINTING` state that contain `APPEND_NEWEST` baselines;
3. persists `CHECKPOINTING` before physical checkpoint work;
4. verifies the exact deferred binary tails against the durable recovery journal;
5. checkpoints the verified files;
6. persists `CHECKPOINTED` and removes the recovery session only after success.

It never performs full journal replay in the background. A background failure leaves the durable session available for the existing foreground resume/fallback path.

### 2. Two-phase verification and checkpoint

`checkpoint_buffered_append_newest_files()` now separates:

- **Phase A — verification:** all candidate files must pass file-length, header record-count, price-scale, and exact tail-record checks before physical sync begins;
- **Phase B — durability barrier:** verified files are opened and `sync_data()` is executed with bounded parallelism.

This preserves the existing fail-closed verification contract.

### 3. Bounded four-worker physical checkpoint

Physical checkpointing uses at most **4 workers**, matching the already accepted Bhavcopy binary-storage worker cap. The intent is to avoid the pathological sequential 8,000+ `sync_data()` wall time while also avoiding the storage contention previously observed with 8 binary workers.

The cap is fixed and regression-tested.

### 4. Foreground/background lifecycle serialization

A process-local checkpoint lifecycle mutex serializes:

- background deferred checkpoint work; and
- foreground pending-session checkpoint/recovery.

This prevents a new Bhavcopy operation from racing a still-running background checkpoint on the same process. If the operator starts another Bhavcopy operation before the background worker finishes, the foreground operation waits for the current checkpoint lifecycle to settle rather than writing concurrently.

### 5. Interruption behavior remains safe

If the application exits or crashes during the background worker, the persisted state remains `CHECKPOINTING`. The already-accepted interrupted-checkpoint resume logic treats that state as resumable on the next Bhavcopy operation.

Re-syncing an already-synced file is idempotent; verification is repeated before checkpoint completion is accepted.

## Runtime diagnostics added

New runtime events:

- `bhavcopy-background-checkpoint-start`
- `bhavcopy-background-checkpoint-complete`
- `bhavcopy-background-checkpoint-deferred`
- `bhavcopy-background-checkpoint-error`

Start/completion events include session, file count, row count, worker cap, and elapsed time where applicable.

Existing foreground checkpoint runtime events now also record the checkpoint worker cap.

## Files modified

- `src-tauri-shell/src/bhavcopy.rs`
- `src-tauri-shell/src/bhavcopy_recovery.rs`

## File added

- `docs/changes/2026-08-12_2353_IST_BHAVCOPY_PHASE2D_BACKGROUND_CHECKPOINT_V1.md`

## Explicit non-scope

This change does **not** alter:

- NSE/BSE/BSE Index/NSE Index source URLs or parsing;
- symbol identity rules;
- series ingestion/filtering rules;
- metadata schema;
- binary EOD record format;
- APPEND_NEWEST foreground mutation semantics;
- conservative REWRITE_TAIL / INSERT_HISTORICAL durability;
- Manual Import Recovery;
- renderer/UI layout;
- database schema.

## Validation targets

The guarded installer runs:

1. background checkpoint four-worker cap test;
2. recovery four-worker cap test;
3. complete Bhavcopy-filtered Rust test suite;
4. `cargo check`.

Portable rebuild and real runtime timing remain separate operator acceptance steps.

## Runtime acceptance criteria

On the next normal import that creates deferred APPEND_NEWEST files:

1. foreground Bhavcopy reaches `Download complete` without waiting for thousands of `sync_data()` calls;
2. `bhavcopy-background-checkpoint-start` appears after foreground completion;
3. the app remains usable while checkpointing runs;
4. `bhavcopy-background-checkpoint-complete` appears later with `workers=4` and `elapsedMs=...`;
5. the following Bhavcopy operation should normally have no pending deferred session to checkpoint;
6. if the app is intentionally closed during background checkpointing, the next Bhavcopy operation must resume from `CHECKPOINTING` rather than perform an unnecessary full recovery.

## Documentation note

This report is additive and safe against concurrent drawing/indicator documentation changes. Root canonical documents should be reconciled after runtime acceptance so that the measured Phase 2D behavior, rather than an unverified estimate, becomes the canonical performance statement.
