# Status note — historical design boundary

> This document is retained as the Phase 2 durability design record. Its Phase 2D background-checkpoint section is **not an active next step**. Phase 2C was later accepted and runtime-proven, and the next-operation checkpoint of 9,312 deferred APPEND_NEWEST files completed in about four seconds. Current disposition: Phase 2D is not required unless future measured workloads show materially blocking checkpoint latency. See `2026-08-09_2323_IST_BHAVCOPY_APPEND_NEWEST_BUFFERED_DURABILITY_PHASE2C_V1.md` and `2026-08-10_1212_IST_BHAVCOPY_FINAL_ACCEPTANCE_AND_DOCUMENTATION_RECONCILIATION.md`.

# Bhavcopy Recoverable Durability Contract V1

## Timestamp

2026-08-09 12:40 +05:30

## Status

**DESIGN / CONTRACT ONLY. No runtime durability behavior is changed by this document.**

The currently validated runtime remains:

- Bhavcopy binary worker cap: **4**
- `APPEND_NEWEST`: **one final `flush()` + one final `sync_data()` per symbol**
- all other binary write paths: unchanged

This contract is the required design gate before any further reduction of synchronous per-symbol durability barriers.

---

## 1. Objective

Replace the current performance model:

```text
Bhavcopy source
    -> in-memory staged CSV
    -> parse / normalize
    -> metadata transaction
    -> thousands of .eod mutations
    -> sync_data() once per APPEND_NEWEST symbol
    -> download_log success
```

with a recoverable write-ahead model in which Bhavcopy can eventually avoid blocking the foreground import on thousands of independent physical file synchronizations without silently losing imported market data after a crash or power interruption.

The target architecture is:

```text
Bhavcopy source
    -> parse / normalize
    -> durable recovery journal + manifest   [small sequential durability barrier]
    -> metadata transaction
    -> .eod materialization
    -> logical verification
    -> download_log success
    -> background/checkpoint durability
    -> journal cleanup only after checkpoint
```

The journal is not a second permanent market-data database. It is a bounded recovery/WAL layer used to guarantee replay until the affected `.eod` files are checkpointed.

---

## 2. Evidence requiring Phase 2

### 2.1 Controlled 2026-08-07 NSE+BSE benchmark

The same one-day workload was measured after Phase 1 with 8 and 4 Bhavcopy binary workers.

Common workload:

- parsed rows: **8,314**
- symbols: **8,313**
- `NEW_FILE`: **181**
- `APPEND_NEWEST`: **8,132**
- errors: **0**
- Phase 1 active: one `sync_data()` call per `APPEND_NEWEST`

### 2.2 Eight-worker result

- binary-write wall time: **513,954 ms**
- `sync_data()`: **2,722,930.184 ms / 8,132 calls**
- parallel-summed symbol time: **3,061,997.401 ms**
- p50 symbol: **288.697 ms**
- p95 symbol: **940.393 ms**
- max symbol: **2,381.142 ms**

### 2.3 Four-worker result

- binary-write wall time: **305,827 ms**
- `sync_data()`: **1,168,083.986 ms / 8,132 calls**
- parallel-summed symbol time: **1,182,213.523 ms**
- p50 symbol: **136.598 ms**
- p95 symbol: **254.793 ms**
- max symbol: **1,549.744 ms**

Four workers reduced the binary-write wall time by approximately **40.5%** versus eight workers and are therefore the retained baseline.

### 2.4 Remaining bottleneck

In the four-worker run:

```text
parallel-summed symbol time = 1,182,213.523 ms
sync_data() summed time      = 1,168,083.986 ms
```

Approximately **98.8%** of the measured summed symbol-write time is now inside `sync_data()`.

The actual data/header work is comparatively small. Therefore further meaningful speed improvement requires changing the durability architecture rather than merely tuning parser, SQLite, HTTP, or worker counts.

---

## 3. Current-source audit

The current implementation was inspected in:

- `src-tauri-shell/src/bhavcopy.rs`
- `src-tauri-shell/src/database/binary_eod.rs`
- `src-tauri-shell/src/database/bootstrap.rs`
- `src-tauri-shell/src/database/connection_registry.rs`

### 3.1 Download staging is memory-only

`StagedDownloadContent::Csv(String)` retains downloaded/normalized CSV content only in process memory. A process or machine failure discards that staged payload.

### 3.2 CSV imports are parsed before symbol batching

`import_staged_csv_downloads()` parses staged CSV jobs into `ParsedBhavcopyFile` rows and then calls `insert_parsed_bhavcopy_files()`.

### 3.3 Metadata commits before binary writes

`insert_parsed_bhavcopy_files()` currently:

1. opens the database connection;
2. upserts instrument metadata in a SQLite transaction;
3. groups binary rows by exchange/symbol;
4. commits the SQLite transaction;
5. writes the per-symbol `.eod` files.

In binary storage mode, the authoritative price rows are not inserted into `eod_prices`; the `.eod` files carry the price history.

### 3.4 Download-log success is later

After the binary write stage completes, `import_staged_csv_downloads()` upserts `download_log` success entries.

This ordering is useful for recovery because a crash can leave metadata and/or partial binary state without a final successful download-log record. The existing prefilter reconciliation can then schedule a refresh. However, today the exact normalized source rows are no longer available locally after a crash.

### 3.5 Current APPEND_NEWEST durability

Phase 1 currently performs:

```text
append record bytes
update header
flush
sync_data
return success
```

This must remain unchanged until the recovery journal described here has been implemented and validated.

---

## 4. Phase 2 safety principle

**Never remove the foreground per-symbol `sync_data()` merely for speed.**

A faster Bhavcopy path is allowed only when all rows required to reconstruct the target mutations have first been committed to a small durable recovery journal.

The required invariant is:

> At every point after Bhavcopy begins mutating `.eod` files, either the target `.eod` state is recoverable from stable storage, or the foreground operation has not yet been allowed to report success.

---

## 5. Scope of V1 optimization

The first optimization release must target **Bhavcopy staged CSV `APPEND_NEWEST` only**.

Do not initially weaken durability for:

- `REWRITE_TAIL`
- `UPDATE_EXISTING`
- `INSERT_HISTORICAL`
- manual CSV/TXT import
- quote deletion
- corporate-action rewrites
- other binary-file mutation callers

`NEW_FILE` behavior also remains unchanged initially unless separately audited.

This narrow scope captures the dominant daily-update workload while minimizing recovery complexity.

---

## 6. Recovery storage layout

Recovery state belongs inside the active database folder so it moves with the database and cannot accidentally recover into another database.

Proposed layout:

```text
<database-folder>\
  eod_data\
  bhavcopy_recovery\
    sessions\
      <session-id>\
        manifest.json
        records.ndjson
        diagnostics.json          [optional]
```

Temporary atomic-write files may use:

```text
manifest.json.tmp
records.ndjson.tmp
```

Orphan `.tmp` files are never interpreted as committed recovery sessions.

### 6.1 Why normalized rows rather than only provider files

`records.ndjson` should contain the **post-parse normalized rows that are actually eligible for import**, not merely the raw provider response.

This binds recovery to the exact import decision already made at the time of the original run and avoids future parser/provider changes silently changing replay semantics.

It also allows replay without a network connection.

### 6.2 Required journal row fields

Each normalized row must contain enough data to rebuild both current metadata and binary price state:

- source job / trade-date identity
- exchange
- symbol
- instrument name
- series
- ISIN
- trade date
- open
- high
- low
- close
- previous close
- volume
- open interest
- trades
- canonical binary `EodRecord` values or enough information to reproduce them exactly

The journal **must preserve current series semantics exactly**. Phase 2 must not attempt to solve the separate all-series/storage-identity issue.

---

## 7. Manifest contract

Proposed schema identifier:

```text
eod-bhavcopy-recovery-v1
```

Minimum manifest fields:

```text
schemaVersion
sessionId
createdAt
updatedAt
state
app/build version
active database binding
price storage mode
Bhavcopy mode
requested start date
requested end date
selected exchanges
excluded-series configuration used for this run
HTTP/download worker count
binary worker count
journal row count
journal byte length
journal SHA-256
per exchange/date parsed-row counts
per exchange/date max volume
symbols touched
APPEND_NEWEST candidate count
non-APPEND write count
error summary
checkpoint progress
```

### 7.1 Database binding

A recovery session must be bound to the database folder in which it was created. Recovery must refuse to apply a journal to a different active database.

The binding should include at least:

- canonical database-folder path at creation time;
- database file name / manifest identity;
- recovery schema version.

If databases may be intentionally moved, the implementation should additionally use stable manifest characteristics rather than relying solely on the original absolute path.

### 7.2 Journal integrity

The manifest must contain a cryptographic digest (recommended SHA-256) of `records.ndjson`.

Recovery must refuse automatic replay when:

- the journal is missing;
- byte length differs;
- digest differs;
- schema version is unsupported.

Such sessions become operator-visible `RECOVERY_ERROR` sessions and must not be silently discarded.

---

## 8. State machine

V1 state names:

```text
STAGING
PREPARED
APPLYING
APPLIED
CHECKPOINTING
CHECKPOINTED
FAILED
RECOVERY_ERROR
```

### 8.1 STAGING

Session directory exists, but journal creation is not yet committed.

No `.eod` mutation is allowed in this state.

A crash in `STAGING` can safely discard the incomplete session unless a complete validated journal is present.

### 8.2 PREPARED

Required durability gate.

Before entering `PREPARED`:

1. normalized recovery rows are fully written;
2. the journal file is flushed and physically synchronized;
3. journal length/digest are computed;
4. the manifest referencing that journal is atomically written and physically synchronized.

Only after `PREPARED` is durable may binary mutation begin.

### 8.3 APPLYING

Metadata and `.eod` materialization are in progress.

A crash here is recoverable because the durable journal already exists.

### 8.4 APPLIED

All logical writes returned successfully, same-process verification passed, and successful `download_log` rows may be recorded.

`APPLIED` **does not mean every `.eod` file has reached stable storage** once foreground per-symbol syncs are removed.

Therefore its journal must remain available.

### 8.5 CHECKPOINTING

Background/maintenance durability checkpoint is synchronizing/coalescing touched `.eod` files.

Checkpoint progress must be resumable.

### 8.6 CHECKPOINTED

Every affected target record has been verified and every file required by the durability policy has passed the checkpoint barrier.

Only now is the session recovery payload eligible for cleanup.

### 8.7 FAILED

A controlled failure occurred before logical application completed. The journal remains for diagnosis/retry.

### 8.8 RECOVERY_ERROR

Automatic recovery cannot safely continue because the manifest/journal is corrupt, incompatible, or bound to the wrong database.

No silent deletion is permitted.

---

## 9. Foreground import protocol after Phase 2 is enabled

For the optimized `APPEND_NEWEST` path:

```text
1. Download and parse source jobs.
2. Produce normalized rows exactly as today.
3. Create recovery session.
4. Write + sync journal.
5. Write + sync PREPARED manifest.
6. Set manifest APPLYING.
7. Commit instrument metadata using existing transaction semantics.
8. Apply .eod mutations.
   - APPEND_NEWEST may use buffered flush without immediate per-symbol sync only under this journal.
   - all non-approved paths retain current sync behavior.
9. Read/validate expected target dates/records logically.
10. Upsert normal download_log results.
11. Mark session APPLIED.
12. Return foreground Bhavcopy completion.
13. Background checkpoint continues independently.
14. After durable checkpoint, mark CHECKPOINTED and clean journal according to retention policy.
```

No foreground-success path may bypass steps 3-5 when using reduced per-file synchronization.

---

## 10. Recovery protocol

Recovery should run when an active database is opened and before a new Bhavcopy mutation session is allowed to start.

### 10.1 Session discovery

Scan:

```text
<database-folder>\bhavcopy_recovery\sessions
```

for all non-`CHECKPOINTED` sessions.

### 10.2 Integrity validation

For each session:

1. parse manifest;
2. validate schema;
3. validate database binding;
4. validate journal length and SHA-256;
5. reject unsafe/unknown state combinations.

### 10.3 Row verification

For every journal target row, compare the `.eod` record for the exact exchange/symbol/date to the canonical journal value.

Existence alone is insufficient. OHLC, previous close, volume and OI binary values must agree.

### 10.4 Structural tail repair

Recovery must explicitly handle an interrupted append where file length and header record count disagree.

Safe V1 rule for an affected APPEND_NEWEST file:

1. verify magic/version/header;
2. calculate complete physical records from file length;
3. reject or truncate any partial trailing record bytes;
4. if extra complete bytes exist beyond the declared header count, do not automatically trust them; trim back to the declared valid boundary unless validated by the journal;
5. if header count exceeds physically complete records, reduce to the physically valid boundary;
6. replay the journal target record using the conservative synchronized writer;
7. verify the final canonical record.

Recovery correctness is more important than recovery speed.

### 10.5 Replay durability

Any row/file actually repaired during recovery uses the current conservative durability path, including `sync_data()`.

Recovery is exceptional and must prefer correctness over performance.

### 10.6 Metadata and download-log reconciliation

After binary verification/replay:

- re-upsert instrument metadata idempotently from journal rows;
- reconstruct per exchange/date row counts and max volume from the journal;
- restore/update `download_log` success only after binary recovery has succeeded;
- leave an explicit error state if any target cannot be verified.

### 10.7 Recovery completion

When every target is correct and checkpoint durability requirements are satisfied:

```text
state = CHECKPOINTED
```

The session may then be cleaned according to retention rules.

---

## 11. Background checkpoint contract

The journal allows physical `.eod` synchronization to move off the foreground critical path.

The checkpoint worker should:

- use low concurrency;
- start with a maximum of **4** file workers and be independently tunable;
- coalesce repeated touches to the same exchange/symbol so one later checkpoint can cover multiple appended dates;
- yield/throttle when another import, deletion or heavy database operation is active;
- persist checkpoint progress in the session manifest;
- never delete an uncheckpointed journal merely because it is old.

This design can reduce both user-visible latency and redundant physical flushes across multiple daily imports.

---

## 12. Cleanup and retention

### 12.1 CHECKPOINTED sessions

May be deleted automatically after a short diagnostic retention period, for example on the next startup or after several days.

### 12.2 APPLIED but not CHECKPOINTED

Must never be deleted by age-based cleanup.

### 12.3 FAILED sessions

Retain for operator inspection/retry. A later UI can expose them, but UI work is not required for the initial backend implementation.

### 12.4 Temporary/orphan files

Unreferenced `.tmp` files may be removed safely when no committed manifest points to them.

---

## 13. Concurrency and locking rules

Only one mutating Bhavcopy recovery/import session may apply to a given active database at a time.

The existing Bhavcopy write lock should remain part of the synchronization strategy, but the recovery/session lock must also cover:

- journal state transition;
- metadata transaction;
- binary materialization;
- download-log finalization;
- recovery replay.

Background checkpointing may run separately only when it cannot race with another mutation of the same `.eod` file.

A per-symbol checkpoint lock or a global binary-mutation coordination layer may be required before asynchronous checkpointing is enabled.

---

## 14. Crash-window behavior required by contract

| Failure point | Required outcome |
|---|---|
| Before durable PREPARED | No `.eod` mutation has started; discard/re-download safely |
| After PREPARED, before metadata commit | Durable journal exists; replay is possible |
| After metadata commit, before first `.eod` write | Journal rebuilds binary state; metadata upsert is idempotent |
| During APPEND_NEWEST data/header write | Tail repair + journal replay reconstructs canonical record |
| After some symbols, before all symbols | Verify completed symbols; replay only missing/different targets |
| After binary writes, before `download_log` | Journal/recovery completes binary state then restores log |
| After `download_log`, before APPLIED manifest | Journal inspection overrides optimistic log and verifies/replays |
| APPLIED, before checkpoint | Journal remains authoritative recovery source |
| During checkpoint | Resume from persisted checkpoint progress |
| After CHECKPOINTED | Journal may be cleaned; normal `.eod` state is durable |

---

## 15. Explicit non-goals

Phase 2 V1 does **not** solve or change:

- BSE historical chart visibility correctness issue;
- NSE `TRIDENT` duplicate symbol/date / series-identity question;
- storage identity for multiple series sharing symbol/date;
- prefilter full-file scan architecture;
- provider availability gaps such as specific BSE Index dates;
- manual CSV/TXT durability behavior;
- database schema for market prices;
- binary `.eod` format;
- chart loader semantics.

Those remain separate workstreams.

---

## 16. Implementation sequence

### Phase 2B — Recovery infrastructure, no speed behavior change

Implement:

- recovery-session data structures;
- session directory management;
- canonical normalized journal serialization;
- SHA-256 integrity binding;
- atomic manifest transitions;
- startup/database-open recovery discovery;
- verify/replay helpers;
- structural interrupted-append repair tests;
- fault-injection unit/integration tests.

**Keep the existing per-symbol `sync_data()` in place.**

Purpose: validate recovery mechanics before relying on them.

### Phase 2C — Journal-governed APPEND_NEWEST buffered mode

Only after Phase 2B passes recovery/fault tests:

- add a Bhavcopy-only write policy flag/context;
- allow `APPEND_NEWEST` under a durable PREPARED journal to omit the foreground `sync_data()`;
- retain ordinary `flush()` and logical verification;
- retain current sync semantics for every other path;
- mark APPLIED only after all logical writes and logs succeed.

### Phase 2D — Background checkpoint and coalescing

Implement resumable low-impact checkpointing and cleanup. Measure whether delayed/coalesced synchronization materially lowers total physical-sync cost.

### Phase 2E — Controlled benchmark and acceptance

Repeat the exact 2026-08-07 NSE+BSE workload and compare against the retained Phase 1.5 baseline:

```text
rows                  8,314
symbols               8,313
APPEND_NEWEST          8,132
binary workers         4
binary write           305,827 ms
sync_data              1,168,083.986 ms / 8,132 calls
p50                    136.598 ms
p95                    254.793 ms
max                    1,549.744 ms
```

Acceptance requires:

1. no row/data parity regression;
2. no binary-format regression;
3. forced-crash recovery tests pass;
4. normal restart recovery tests pass;
5. corrupt-journal handling fails safe;
6. no silent `download_log` success when recovery is unresolved;
7. foreground binary-write time materially improves;
8. recovery/checkpoint workload does not corrupt concurrent reads or later imports.

---

## 17. Required fault-injection tests before Phase 2C

At minimum, tests must simulate failure:

1. after journal write but before PREPARED manifest;
2. immediately after PREPARED;
3. after metadata transaction commit;
4. after appended data bytes but before header update;
5. after header update but before flush;
6. after a subset of symbols have been written;
7. after all binary writes but before download-log update;
8. after download-log update but before APPLIED manifest;
9. during checkpoint;
10. with corrupted/truncated journal;
11. with journal bound to a different database;
12. with an `.eod` file containing an incomplete trailing record;
13. with header count greater than physical complete records;
14. with complete extra bytes beyond header count;
15. with an existing target date containing different OHLCV/OI values.

Every recoverable case must converge to exactly the same final canonical records as an uninterrupted import.

---

## 18. Decision

The measured worker experiment is complete:

- **retain Bhavcopy binary workers = 4**;
- **retain Phase 1 single-final-sync APPEND_NEWEST behavior** until Phase 2B is fully implemented and validated;
- **do not reduce per-symbol synchronization yet**;
- proceed next with **Phase 2B recovery infrastructure**.

This sequencing preserves the performance gains already achieved while preventing a speed optimization from weakening data-integrity guarantees without a tested recovery path.
