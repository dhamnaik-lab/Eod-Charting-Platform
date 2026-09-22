# Bhavcopy Final Documentation Reconciliation V3

**Timestamp:** 2026-08-13 16:58 IST (+05:30)
**Project:** EOD Charting Platform
**Scope:** Documentation-only canonical reconciliation after August 12–13 Bhavcopy runtime acceptance

## Reconciliation basis

Fresh source snapshot supplied for this audit:

- folder: `Eod Charting Platform Source Code 2026-08-13_165308_IST`
- uploaded ZIP SHA-256: `a193a6630de691d148eb7abfe80485981b36a6339c7022d9f48a1ef1e83750dc`
- snapshot-policy file count before this reconciliation report: 484
- `src/`: 260 files
- `src-tauri-shell/`: 40 files
- `scripts/`: 7 files
- `resources/`: 5 files
- `patches/`: 1 file
- root config/canonical docs: 15 files
- `docs/changes/`: 155 files in the basis snapshot (91 top-level evidence files + 64 retained backup-evidence files)

Runtime source identities in the basis snapshot:

- `src-tauri-shell/src/bhavcopy.rs`: `b3e5a932804133744eb9b2b3f669c4c777e0c5fdf9cbf4f82efb0c1ee2386585`
- `src-tauri-shell/src/bhavcopy_recovery.rs`: `180b545f4b97b7afdeea341cc860c979eb222df45e37169d6410a97b73807bd1`

## Why the August 10 canonical text had to change

The August 10 documentation stated that a retained 9,312-file checkpoint had completed in about four seconds and therefore Phase 2D background checkpointing was not required. Later production evidence invalidated that operating conclusion.

On August 12, session `20260812T143215.473693Z-p11660-0` used the correct deferred-checkpoint path but checkpointed 8,570 APPEND_NEWEST files sequentially:

- start: 23:29:50
- complete: 23:47:27.969
- `elapsedMs=1057829`
- elapsed: about 17m38s

This proved that the recovery-state routing fix was correct but the physical checkpoint execution model still caused an unacceptable next-operation delay.

## Accepted August 12–13 corrections

### Interrupted CHECKPOINTING resume

`APPLIED` and `CHECKPOINTING` are the only resumable fast-checkpoint states. Exact file length, header count, price scale, and appended journal tail remain verified before accepting checkpoint completion. Verification failure retains conservative rollback and immediately durable replay.

Evidence: `docs/changes/2026-08-12_2102_IST_BHAVCOPY_INTERRUPTED_CHECKPOINT_RESUME_FIX_V1.md`.

### Phase 2D background checkpoint

Normal deferred APPEND_NEWEST durability work now runs after a successful import in a bounded background task. Physical checkpointing uses at most four workers after complete journal/binary verification. Foreground and background checkpoint/recovery lifecycle access is serialized by a process-local mutex.

Production acceptance session `20260813T110934.752306Z-p18044-0`:

- files: 8,406
- rows: 8,453
- workers: 4
- start: 16:40:39.245
- complete: 16:42:44.650
- `elapsedMs=125405`
- elapsed: about 2m05s

Against the earlier 8,570-file sequential checkpoint, this is about 8.44x faster / 88.1% lower elapsed. The workloads are close but not identical, so this is operational evidence rather than a controlled microbenchmark.

A later Update at 16:45 completed in roughly two seconds with zero jobs and no long retained-session recovery/checkpoint. That Update began after the background checkpoint had already completed, so this acceptance does not claim that a foreground command started during an active background checkpoint is wait-free. The architecture intentionally serializes that case.

Evidence: `docs/changes/2026-08-12_2353_IST_BHAVCOPY_PHASE2D_BACKGROUND_CHECKPOINT_V1.md` plus the supplied runtime log.

### August 13 import acceptance

Date Range run for 2026-08-01 through 2026-08-13, all four source categories, workers=2:

- BSE: 4,972 rows
- BSE Index: 77 rows
- NSE: 3,404 rows
- NSE Index 2026-08-13: source unavailable/missing
- imported total: 8,453 rows
- results: 3 success / 17 skipped / 0 failed
- symbols: 8,449
- new files: 43
- APPEND_NEWEST: 8,406
- rewrite/update/historical paths: 0
- binary errors: 0
- foreground `sync_data()`: 0 calls
- deferred APPEND_NEWEST syncs: 8,406
- binary-write wall time: 57,456 ms

### Update same-day cutoff

Automatic Update now uses an 18:00 local cutoff: before 18:00, its upper bound is yesterday; at/after 18:00, today may be probed. Manual Date Range and Full History remain unchanged.

Evidence: `docs/changes/2026-08-13_0030_IST_BHAVCOPY_UPDATE_SAME_DAY_CUTOFF_V1.md` plus before-cutoff runtime acceptance.

### Calendar Safety V1.1

Calendar precedence is exchange-aware:

1. known special trading session -> trading day;
2. otherwise weekend -> skip;
3. otherwise known exchange holiday -> skip;
4. otherwise probe the source.

Date-by-date weekend/holiday visibility is preserved. A date that reaches the downloader and has no source is unavailable/missing; it is not automatically a holiday.

Evidence: `docs/changes/2026-08-13_0232_IST_BHAVCOPY_CALENDAR_SAFETY_V1_1.md` plus focused tests and repeated Date Range runtime logs.

### Prefilter Range Scan V1

The previous Date Range binary reconciler repeatedly binary-searched each target date inside each overlapping `.eod` file. Range Scan V1 keeps the metadata-vs-binary safety contract and 80% usable-coverage threshold but uses bounded range reads plus at most four workers.

Same eight target dates:

- trigger: NSE 523,371 ms / BSE 171,131 ms;
- first optimized runtime: NSE 147,048 ms / BSE 77,687 ms;
- later same-range runtime: NSE 18,669 ms / BSE 2,593 ms / NSE Index 294 ms / BSE Index 27 ms.

Every run preserved eight already-imported dates for all four categories. The much faster later run is affected by file-system/OS caching; no fixed 23-second cold-run guarantee is claimed. Prefilter V2/persistent coverage indexing is deferred until repeated cold-run evidence demonstrates a real need.

Evidence: `docs/changes/2026-08-13_1305_IST_BHAVCOPY_PREFILTER_RANGE_SCAN_V1.md`.

### BSE/BSE Index candidate terminal classification

The live code already treated HTML instead of CSV as a soft candidate mismatch, but soft text could overwrite a genuine hard error in the terminal error state. V1.1 separates soft candidate outcomes from genuine hard errors in both staged and direct candidate paths.

Final validation:

- focused regression: 1/1 PASS;
- Bhavcopy filter: 50/50 PASS;
- `cargo check`: PASS.

The rebuilt current-day run then completed with zero failed jobs and successfully imported 77 BSE Index rows. Because the source had become available, the exact all-soft terminal branch was not re-triggered after the fix; the focused regression is the direct policy evidence.

Evidence: `docs/changes/2026-08-13_1555_IST_BHAVCOPY_BSE_INDEX_CANDIDATE_CLASSIFICATION_V1_1.md`.

## Canonical documents reconciled

This pass updates all eight maintained root documents because the behavior, architecture, source-snapshot identity, requirements, inventory, current handoff, feature status, and append-only project history all changed materially:

1. `AGENTS.md`
2. `HANDOFF.md`
3. `README.md`
4. `REQUIREMENTS.md`
5. `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
6. `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
7. `FILE_INVENTORY.md`
8. `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`

No Rust, TypeScript, renderer, provider, database, binary-format, or build-runtime source file is modified by this reconciliation.

## Superseded current guidance

The August 10 statement that Phase 2D background checkpointing was not required is retained only as historical evidence inside append-only/project-history records. Current authority now treats Phase 2D as implemented and production-accepted.

Likewise, the earlier large-prefilter note is superseded by Range Scan V1 measurements. A persistent Prefilter V2 index is not current work.

## Validation contract

Documentation-only validation must confirm:

1. all eight canonical root documents exist;
2. `scripts/check-doc-references.ps1` passes;
3. the changed documents contain no trailing whitespace and end with a newline;
4. stale current-authority phrases such as "Phase 2D background checkpointing is not currently required" no longer appear outside explicitly superseded historical context;
5. the two Bhavcopy runtime source hashes remain unchanged from the reconciliation basis;
6. the new change report exists under `docs/changes/`;
7. no portable rebuild is required because this pass changes documentation only.

## Final source-snapshot gate

After documentation validation passes, create a new source snapshot with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
    ".\scripts\Create-EOD-Source-Code-Snapshot-v3.ps1" `
    -Source "E:\TA Projects\EOD Charting Platform" `
    -AuditRoot "E:\TA Projects\EOD Charting Platform Source Audit"
```

Type `COPY` when the script prompts. The resulting post-reconciliation snapshot, not the `2026-08-13_165308_IST` basis ZIP, becomes the next canonical handoff archive.
