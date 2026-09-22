# Bhavcopy Interrupted Deferred-Checkpoint Resume Fix V1

**Date:** 2026-08-12 IST  
**Project:** EOD Charting Platform  
**Scope:** Bhavcopy recovery lifecycle only  
**Runtime source files changed:** 2 (`bhavcopy.rs`; `bhavcopy_recovery.rs` test strengthening only)

## Runtime evidence

The 12-Aug-2026 runtime log showed session `20260812T053757.715156Z-p10752-0` complete its foreground import normally:

- recovery journal prepared: 8,631 rows;
- binary write: 8,598 `APPEND_NEWEST`, 32 new files, zero binary errors;
- immediate `sync_data`: 0 calls for the append path;
- `bhavcopy-deferred-checkpoint-retained`: 8,598 deferred append checkpoints;
- `bhavcopy-write-complete`: foreground import completed.

Later, the next Bhavcopy operation did **not** emit `bhavcopy-deferred-checkpoint-complete` or `bhavcopy-deferred-checkpoint-replay`. Instead, it performed full durable replay and emitted `bhavcopy-recovery-complete`, taking roughly 14 minutes 41 seconds before the new download began.

## Root cause

`recover_pending_bhavcopy_sessions()` used the fast buffered checkpoint path only when the persisted session state was exactly `APPLIED`.

Before checkpoint I/O begins, the code durably changes the session state to `CHECKPOINTING`. If the process/app is closed, crashes, or the machine stops during that checkpoint, the next run loads a valid `CHECKPOINTING` session. Because `CHECKPOINTING` was excluded from the fast-path predicate, the next run fell through to the much more expensive baseline restore + immediate durable journal replay path.

This is a restart-state lifecycle gap. A `CHECKPOINTING` session with intact `APPEND_NEWEST` baselines is safe to resume because the checkpoint operation first verifies exact file length, header count, price scale, and every appended tail record against the durable journal before calling `sync_data()`. Re-running `sync_data()` for a file already checkpointed by a prior partial attempt is idempotent. If verification fails, the existing conservative durable-replay fallback remains unchanged.

## Fix

1. The buffered-checkpoint fast path now accepts both:
   - `APPLIED`
   - `CHECKPOINTING`

2. No other recovery state is broadened. `PREPARED`, `APPLYING`, `FAILED`, and `RECOVERY_ERROR` continue to use existing conservative handling.

3. New runtime event:
   - `bhavcopy-deferred-checkpoint-start`
   - records `resumeState`, append-file count, row count.

4. `bhavcopy-deferred-checkpoint-complete` now also records `elapsedMs`.

5. Regression coverage verifies:
   - only `APPLIED` and `CHECKPOINTING` are resumable checkpoint states;
   - the buffered append checkpoint is safe to execute twice against the same already-complete tail, modeling restart after a partially completed checkpoint batch.

## Deliberately unchanged

- provider/download logic;
- NSE/BSE/BSE Index URL logic;
- 4-worker binary cap;
- Phase 2C foreground buffered `APPEND_NEWEST` behavior;
- conservative `REWRITE_TAIL`, `UPDATE_EXISTING`, and `INSERT_HISTORICAL` durability;
- Manual Import recovery;
- database schema;
- renderer/UI source.

## Baseline guards

The installer is file-hash guarded against the audited Bhavcopy runtime from source snapshot `Eod Charting Platform Source Code 2026-08-10_123114_IST`:

- `src-tauri-shell/src/bhavcopy.rs`  
  `c36f6d68e1477788f286f840ce416294082be1fdafcd7cb80058d06f7cf1e4ef`
- `src-tauri-shell/src/bhavcopy_recovery.rs`  
  `b57ce07055e294c09c9588dea8197fd0377a85c03033957b5731cc148889517d`

The later documentation-only reconciliations changed zero application runtime source files. If either guarded file has changed in the live project for any other reason, the installer fails closed rather than overwriting newer work.

## Validation required on Windows

Run:

```powershell
cargo test --manifest-path ".\src-tauri-shell\Cargo.toml" buffered_checkpoint -- --nocapture
cargo test --manifest-path ".\src-tauri-shell\Cargo.toml" bhavcopy_recovery -- --nocapture
cargo test --manifest-path ".\src-tauri-shell\Cargo.toml" bhavcopy -- --nocapture
cargo check --manifest-path ".\src-tauri-shell\Cargo.toml"
```

Then rebuild the portable application and perform a normal Bhavcopy update. The expected runtime sequence for a retained session is:

```text
bhavcopy-deferred-checkpoint-start | ... resumeState=Applied ...
bhavcopy-deferred-checkpoint-complete | ... elapsedMs=...
```

If a checkpoint is interrupted and later resumed, the expected start record becomes:

```text
bhavcopy-deferred-checkpoint-start | ... resumeState=Checkpointing ...
```

and it should still use the checkpoint path rather than full `bhavcopy-recovery-complete` replay when the tail verifies.

## Local artifact limitation

Rust/Cargo is not installed in the artifact-generation container, so compilation and Rust test execution were not claimed here. The patch was produced by exact guarded transformation and static diff review; Windows validation remains mandatory.
