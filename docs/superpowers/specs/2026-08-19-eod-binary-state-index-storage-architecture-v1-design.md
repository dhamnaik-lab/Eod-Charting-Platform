# EOD Charting Platform — Storage Architecture V1 Design

**Date:** 2026-08-19  
**Status:** Approved; implementation planning and staged V1.1 execution authorized  
**Scope:** EOD Binary State Index and Bhavcopy-first storage acceleration  
**Project:** `E:\TA Projects\EOD Charting Platform`

---

## 1. Executive Summary

The current EOD Charting Platform stores canonical quotation history in one `.eod` file per symbol. This design is correct and must remain unchanged in Storage Architecture V1.

Production measurements on the current desktop show that the dominant performance problem is not Bhavcopy download, CSV parsing, SQLite metadata work, or foreground `sync_data()`. The dominant problem is cold random access to thousands of small `.eod` files on a mechanical SATA HDD.

The approved solution is to add a **persistent EOD Binary State Index** as derived acceleration state while preserving:

- the current `.eod` binary format;
- one file per symbol;
- existing Bhavcopy multi-date symbol batching;
- existing recovery journal semantics;
- existing background checkpoint/durability verification;
- the current physical-file verification path as a permanent fallback;
- full user-selectable verification mode.

The state index will never become canonical. `.eod` files remain authoritative.

The first optimized consumer is Bhavcopy. Other actual `.eod` writers must integrate with the same invalidation/publication contract so that stale index state is never trusted.

---

## 2. Problem Statement

### 2.1 Observed production incident

A one-day Bhavcopy Update for trade date 2026-08-18 imported:

- 8,693 rows;
- 8,690 symbols;
- 8,664 `APPEND_NEWEST` paths;
- 26 new files;
- zero binary errors.

Download staging completed in seconds, while foreground import took roughly 28 minutes.

Key production timings included:

- recovery journal preparation gap: approximately 18 minutes, inferred from runtime timestamps;
- binary write wall time: approximately 603 seconds;
- parallel-summed header-read time: approximately 1,444 seconds;
- parallel-summed last-date read time: approximately 483 seconds;
- p50 symbol elapsed: approximately 127.8 ms;
- p95 symbol elapsed: approximately 743.5 ms.

The deferred-durability optimization remained active:

- foreground `sync_data()` calls: 0;
- deferred `APPEND_NEWEST` checkpoints: 8,664.

### 2.2 Storage evidence

The active EOD store is:

```text
E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse\eod_data
```

The physical storage is:

```text
TOSHIBA DT01ACA050
SATA HDD
~465.8 GB
```

`C:`, `D:`, and `E:` are partitions on the same physical HDD.

The database contains approximately:

```text
24,465 .eod files
0.878 GiB total
```

Distribution:

| Store | File count | Approx. size | Approx. average file |
|---|---:|---:|---:|
| BSE | 16,746 | 198.6 MB | 12.4 KB |
| NSE | 7,383 | 685.9 MB | 97.4 KB |
| NSE_INDEX | 178 | 12.5 MB | 73.5 KB |
| BSE_INDEX | 158 | 1.7 MB | 11.3 KB |

### 2.3 Cold/warm read evidence

Independent two-pass benchmarks repeatedly demonstrated severe cold-cache sensitivity.

Representative deterministic 1,000-file benchmark:

```text
PASS 1 - CURRENT/COLDER
wallSec      = 19.975
avgOpenMs    = 6.681
avgHeaderMs  = 11.392
avgTailMs    = 1.475
p50          = 13.969 ms
p95          = 57.182 ms
p99          = 95.941 ms

PASS 2 - IMMEDIATE WARM REPEAT
wallSec      = 0.533
avgOpenMs    = 0.302
avgHeaderMs  = 0.053
avgTailMs    = 0.016
p50          = 0.226 ms
p95          = 0.332 ms
p99          = 10.566 ms
```

Cold/warm p50 ratio: approximately 61.8x.

This confirms a storage architecture sensitivity: many small random file opens/reads are expensive on the current HDD, while the same workload is extremely fast once resident in the Windows filesystem cache.

---

## 3. Existing Architecture Findings

### 3.1 Current `.eod` model

The platform currently uses one canonical `.eod` file per symbol.

Storage Architecture V1 will **not** change this.

### 3.2 Existing Bhavcopy batching is already correct

A focused source audit confirmed that Bhavcopy already:

1. parses rows from multiple staged jobs;
2. groups rows by exchange and symbol;
3. accumulates multiple incoming records into a per-symbol vector;
4. sorts records by date;
5. invokes the binary writer once per symbol collection.

Therefore Storage Architecture V1 must **not** add a duplicate symbol-session batching subsystem.

The existing batching logic is retained.

### 3.3 Remaining redundant state discovery

The remaining performance problem is repeated discovery of existing physical file state.

Before and during a normal daily append, the platform may repeatedly obtain:

- file existence;
- record count;
- price scale;
- file length;
- last date;
- header state;
- tail state.

This occurs across recovery-baseline preparation, binary writer classification, and later checkpoint verification.

Storage Architecture V1 targets redundant **foreground state discovery**, not the canonical data model.

---

## 4. Goals

Storage Architecture V1 shall:

1. preserve `.eod` as the canonical quotation store;
2. preserve the current `.eod` file format;
3. preserve one file per symbol;
4. preserve the existing Bhavcopy recovery journal;
5. preserve the existing background durability checkpoint;
6. preserve the current physical verification path permanently;
7. add a compact persistent derived state index;
8. load trusted state into memory for Bhavcopy;
9. eliminate most redundant cold header/tail reads for normal `APPEND_NEWEST`;
10. support per-symbol physical fallback;
11. integrate all actual `.eod` writers with index invalidation/publication;
12. remain reversible without converting or rewriting canonical market data.

---

## 5. Non-Goals

Storage Architecture V1 shall **not**:

- replace `.eod` files with a new bundled database format;
- merge all symbols into one file;
- introduce a sequential delta/LSM storage engine;
- change chart-reader semantics;
- redesign Bhavcopy multi-date grouping;
- redesign checkpoint durability semantics;
- optimize every writer for performance immediately;
- trust stale or uncertain state;
- introduce a user option that force-trusts invalid state;
- make the sidecar index a new canonical database;
- automatically couple Corporate Action metadata/factor operations to binary invalidation unless they actually mutate `.eod`.

---

## 6. Architectural Overview

```text
                    canonical .eod files
                           ▲
                           │
                existing BinaryEodFile
                           ▲
                           │
         ┌─────────────────┴────────────────┐
         │                                  │
 Existing Bhavcopy batching          Other binary writers
         │                                  │
         └──────────────┬───────────────────┘
                        │
                        ▼
               EOD Binary State Index
               sidecar SQLite + RAM
                        │
        ┌───────────────┼────────────────┐
        │               │                │
      AUTO             FAST          FULL_VERIFY
```

The key trust hierarchy is:

```text
1. .eod files
   CANONICAL

2. Existing recovery journal / checkpoint
   RECOVERY AND DURABILITY AUTHORITY

3. EOD Binary State Index
   DERIVED PERFORMANCE STATE

4. Filesystem census
   CHEAP STALENESS DETECTOR
```

The performance layer never outranks the canonical or recovery layers.

---

## 7. Sidecar Database

### 7.1 Location

Recommended initial location:

```text
E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse\eod_binary_state.sqlite
```

This sidecar shall remain separate from the application's existing main SQLite database.

Rationale:

- it is derived acceleration state;
- it must be deletable/rebuildable without affecting canonical quotation history;
- sidecar failure must degrade performance only, not data correctness.

### 7.2 Main table

Conceptual schema:

```text
eod_binary_state
────────────────────────────────────────
exchange
symbol
relative_path

record_count
price_scale
file_length

first_date
last_date

file_mtime_ns

state_status
state_generation

verified_at
updated_at
```

Primary key:

```text
(exchange, symbol)
```

### 7.3 Metadata table

Conceptual metadata:

```text
schema_version
index_generation
bootstrap_status
bootstrap_completed_at
```

Example:

```text
schema_version    = 1
index_generation  = 42
bootstrap_status  = COMPLETE
```

A global generation identifies major state publication/rebuild epochs. It shall not be incremented for every individual symbol write.

---

## 8. State Model

V1 uses exactly three trust states:

```text
VERIFIED
DIRTY
UNKNOWN
```

### 8.1 VERIFIED

A row is eligible for fast-path use only when:

1. its sidecar state is `VERIFIED`;
2. bootstrap/schema state is valid;
3. filesystem census agrees with indexed identity;
4. the current operation has not invalidated that symbol.

### 8.2 DIRTY

`DIRTY` means a known mutation has started or completed without final verification/publication.

A `DIRTY` row is never eligible for the fast path.

### 8.3 UNKNOWN

`UNKNOWN` represents uncertainty such as:

- unexpected external modification;
- size/mtime mismatch;
- missing file;
- schema migration ambiguity;
- recovery ambiguity;
- unsupported mutation path;
- index corruption.

An `UNKNOWN` row is never eligible for the fast path.

---

## 9. Permanent Storage Modes

Storage Architecture V1 shall permanently retain three selectable modes.

### 9.1 AUTO — default

Per symbol:

```text
VERIFIED + census match
        → FAST PATH

anything else
        → PHYSICAL VERIFY FOR THAT SYMBOL
```

A single dirty symbol must not force the entire import onto the slow path.

### 9.2 FAST

FAST prefers trusted indexed state but retains all trust checks.

It shall **not** mean “force untrusted state”.

For:

```text
DIRTY
UNKNOWN
missing row
census mismatch
invalid schema/bootstrap
```

FAST must still fall back physically.

### 9.3 FULL_VERIFY

FULL_VERIFY ignores indexed classification and uses the existing physical `.eod` inspection behavior.

It also compares the observed physical state against the index and may repair/invalidate the index.

FULL_VERIFY is the permanent reference implementation and diagnostic mode.

---

## 10. Filesystem Census

The system shall distinguish cheap directory metadata enumeration from expensive physical content reads.

At appropriate startup/import boundaries:

1. enumerate `.eod` directory metadata;
2. collect:
   - relative path;
   - file size;
   - last modified time;
   - existence;
3. compare this census against the sidecar.

Representative production evidence showed enumeration of all 24,465 `.eod` files in approximately 1 second, far cheaper than opening and reading thousands of cold files.

If indexed identity matches census identity, a `VERIFIED` row may remain trusted.

If identity differs, the row must become `DIRTY` or `UNKNOWN` and require physical inspection.

---

## 11. Bootstrap / Rebuild

### 11.1 Initial bootstrap

If the index is missing:

```text
create new/temporary index
        ↓
enumerate canonical .eod files
        ↓
physically inspect each file
        ↓
populate state rows
        ↓
validate counts and keys
        ↓
mark bootstrap COMPLETE
```

The index is not trusted until:

```text
bootstrap_status = COMPLETE
```

### 11.2 Interrupted bootstrap

If bootstrap is interrupted:

- partial rows must not be trusted;
- V1 may perform a clean rebuild rather than complex resume logic;
- existing physical behavior remains available.

### 11.3 Rebuild triggers

Rebuild may be required for:

- first installation;
- manual deletion of sidecar;
- incompatible schema version;
- major structural validation failure;
- explicit user rebuild request.

---

## 12. In-Memory State

Bhavcopy shall not issue one SQLite query per symbol.

At import/session start:

```text
sidecar SQLite
      ↓
load relevant state rows
      ↓
HashMap<(Exchange, Symbol), BinaryState>
```

Normal per-symbol state lookup becomes an in-memory operation.

---

## 13. Mutation / Invalidation Contract

### 13.1 Core invariant

Before any known `.eod` mutation begins, the corresponding state must no longer be trusted.

Conceptually:

```text
VERIFIED
   ↓ before mutation
DIRTY
   ↓ successful verified completion
VERIFIED
```

Unexpected conditions may transition to:

```text
UNKNOWN
```

### 13.2 Batch invalidation

Bhavcopy shall mark its intended mutation set `DIRTY` in a bounded sidecar transaction before physical mutations begin.

This is preferred over thousands of individual SQLite transactions.

### 13.3 Failed mutation

If anything fails after `DIRTY`:

```text
DIRTY remains
```

The next operation physically verifies/reconciles that file.

### 13.4 Sidecar failure during writes

The sidecar is an optional acceleration subsystem, not a new write prerequisite.

If the index subsystem becomes unavailable:

```text
disable fast path for the operation/session
        ↓
use existing canonical physical path
        ↓
continue normal .eod write/recovery semantics
        ↓
require later index rebuild/reconciliation
```

The real fail-closed rule is:

> never trust stale index state.

It is **not**:

> block all canonical `.eod` writes when the optional index is unavailable.

---

## 14. Binary Writer Boundary

### 14.1 Preserve BinaryEodFile responsibilities

`binary_eod.rs` remains the canonical file-format engine responsible for:

- open;
- read;
- append;
- merge;
- delete;
- truncate;
- header maintenance.

Raw sidecar SQLite logic should not be scattered through `binary_eod.rs`.

### 14.2 New state subsystem

Recommended new module:

```text
src-tauri-shell/src/database/eod_binary_state.rs
```

Responsibilities:

- sidecar schema;
- open/load;
- bootstrap/rebuild;
- filesystem census reconciliation;
- state transitions;
- in-memory state;
- verification;
- storage-mode behavior.

### 14.3 Trusted state hint

The existing append/merge writer should accept an optional trusted state hint conceptually similar to:

```rust
Option<&VerifiedBinaryState>
```

If supplied and valid:

- skip redundant classification reads where safely possible;
- converge on the same canonical mutation implementation.

If absent:

- execute current physical classification behavior unchanged.

There should not be two independent mutation implementations such as unrelated `append_fast()` and `append_safe()` functions.

---

## 15. Binary Post-State

After a successful mutation, the writer already knows substantial post-state.

The writer should return a structured result conceptually containing:

```text
record_count
price_scale
first_date
last_date
file_length
write_path
```

plus appropriate filesystem metadata.

This becomes a `BinaryPostState`-like value retained until final publication.

The state index should not need to immediately reopen the file merely to rediscover values the writer already knows.

---

## 16. Bhavcopy Integration

Bhavcopy is the first optimized consumer.

### 16.1 Pre-import flow

```text
load index
   ↓
filesystem census
   ↓
build in-memory trusted state
   ↓
prepare incoming per-symbol batches
```

Existing incoming-data batching remains unchanged.

### 16.2 Recovery-baseline fast path

For each incoming symbol:

```text
VERIFIED + census match
        ↓
baseline from indexed/RAM state

otherwise
        ↓
existing physical .eod inspection
```

The physical path remains permanent.

### 16.3 Pre-mutation invalidation

Before binary mutations:

```text
intended symbols → DIRTY
```

This must occur before the first physical mutation that relies on prior trust.

### 16.4 Writer classification fast path

Once later rollout stages permit it, the writer may consume a trusted state hint to avoid redundant:

- existence check;
- header discovery;
- last-date discovery;
- repeated classification work.

### 16.5 Existing batching remains unchanged

Bhavcopy already performs:

```text
multiple staged dates
        ↓
exchange + symbol grouping
        ↓
date sort
        ↓
one binary writer call per symbol batch
```

Storage Architecture V1 shall preserve this behavior.

---

## 17. Background Checkpoint

Checkpoint semantics remain conservative and physical in V1.

Conceptual flow:

```text
DIRTY
  ↓
existing physical checkpoint
  ↓
verify required physical state
  ↓
sync_data
  ↓
PASS
  ↓
publish VERIFIED
```

If checkpoint fails or is deferred:

```text
DIRTY remains
```

No V1 optimization may weaken this durability boundary.

---

## 18. Recovery Integration

Recovery may mutate files below the normal append/merge abstraction.

Examples include:

```text
truncate
restore baseline
repair interrupted append
```

Affected symbols must remain/become `DIRTY`.

After physical recovery:

```text
physical recovery
       ↓
physical verification
       ↓
reconstruct state
       ↓
VERIFIED
```

A recovery operation returning success is not, by itself, sufficient to publish a trusted state row.

---

## 19. Other Writer Integration

V1 performance optimization is Bhavcopy-first. Other actual `.eod` writers must at minimum integrate with trust invalidation/publication.

### 19.1 Quote Editor

Quote save/delete paths that mutate `.eod` must:

```text
mark symbol DIRTY
        ↓
perform existing mutation
        ↓
publish VERIFIED after appropriate success/verification
or leave DIRTY
```

Quote Editor does not need a fast read/classification path in V1.

### 19.2 Manual Import

Manual Import must:

```text
mark affected symbols DIRTY
        ↓
perform existing import/recovery semantics
        ↓
publish VERIFIED after successful final state
```

No Manual Import performance redesign is required in V1.

### 19.3 Manual Import Recovery

Any recovery/undo that restores previous binary content must explicitly preserve invalidation until physical reconciliation is complete.

### 19.4 Corporate Actions

Current Corporate Action Phase 1 behavior applies historical adjustment at read time and does not normally rewrite raw `.eod` history.

Therefore normal Corporate Action metadata/factor changes do **not** require EOD Binary State invalidation.

Only a future Corporate Action operation that actually mutates `.eod` files should participate.

### 19.5 Identity metadata

Changing identity/metadata such as ISIN, company identity, watchlist state, or other non-binary metadata does not automatically invalidate `.eod` state.

Only actual binary mutations participate.

---

## 20. Central State API

Consumers must not execute raw sidecar SQL directly.

Conceptual API:

```rust
BinaryStateIndex::open(...)
BinaryStateIndex::load_verified(...)
BinaryStateIndex::reconcile_census(...)

BinaryStateIndex::mark_dirty_batch(...)
BinaryStateIndex::mark_dirty(...)
BinaryStateIndex::publish_verified_batch(...)
BinaryStateIndex::publish_verified(...)

BinaryStateIndex::invalidate(...)
BinaryStateIndex::rebuild(...)
BinaryStateIndex::verify(...)
```

This provides one enforceable state machine.

---

## 21. Integration Matrix

| Component | Fast read | Invalidate | Publish |
|---|---:|---:|---:|
| Bhavcopy | Yes | Yes | Yes, after checkpoint |
| Bhavcopy Recovery | No | Yes | Yes, after physical verify |
| BinaryEod writer | Accepts trusted hint | No | Returns post-state |
| Quote Editor | No | Yes | Yes / rebuild |
| Manual Import | No | Yes | Yes |
| Manual Import Recovery | No | Yes | Yes, after verify |
| Corporate Actions | No | No, unless actual `.eod` mutation | No |
| Identity metadata | No | No | No |
| Chart reader | unchanged | — | — |

---

## 22. Shadow-Mode Rollout

The new architecture must not immediately control production writes.

### 22.1 Stage A — Index Infrastructure

Add:

```text
sidecar SQLite
bootstrap
filesystem census
VERIFIED/DIRTY/UNKNOWN
rebuild/verify commands
```

Bhavcopy still uses the existing physical path.

Acceptance:

- sidecar state mirrors physical state;
- no production mutation behavior changes.

### 22.2 Stage B — Shadow Bhavcopy Comparison

The index predicts pre-state independently while the physical path remains authoritative.

Example telemetry:

```text
[EOD State Shadow]
symbol=RELIANCE
indexed_last_date=2026-08-18
physical_last_date=2026-08-18
match=true
```

Aggregate target:

```text
Shadow compared : N
Matched         : N
Mismatched      : 0 unexplained
```

No fast-path activation until unexplained mismatches are zero.

### 22.3 Stage C — Recovery-Baseline Fast Path

The first production acceleration uses trusted index state for Bhavcopy recovery-baseline preparation.

The binary writer still performs current physical classification.

This isolates the first optimization.

### 22.4 Stage D — APPEND_NEWEST Fast Classification

After Stage C passes runtime proof, the binary writer may consume trusted state hints for qualifying paths.

### 22.5 Stage E — Cross-Writer Invalidation

Integrate Quote Editor, Manual Import, and recovery paths with invalidation/publication.

### 22.6 Stage F — UI Controls

Add user-facing storage mode and state-index controls only after backend runtime proof.

---

## 23. User-Facing Controls

Final UI concept:

```text
EOD Binary State Index

Status: Healthy
Indexed symbols: 24,465
Verified: 24,465
Dirty: 0
Unknown: 0

Storage Mode:
● Auto
○ Fast
○ Full Verify

[ Verify Index ]
[ Rebuild Index ]
```

Backend validation must precede UI implementation.

---

## 24. Runtime Telemetry

Every Bhavcopy operation should report enough detail to prove which path was used.

Example:

```text
[EOD State]
mode=AUTO
index_status=HEALTHY
indexed=24465
verified=24461
dirty=3
unknown=1

Bhavcopy symbols=8690
fast_baseline=8678
physical_baseline=12

fast_writer_classification=8664
physical_writer_classification=26

census_ms=...
state_load_ms=...
fallback_verify_ms=...
binary_write_ms=...
```

The platform must not require inference to determine whether acceleration was active.

---

## 25. Validation Requirements

### 25.1 Bootstrap validation

After bootstrap:

- expected file count equals indexed row count;
- exchange counts reconcile;
- no duplicate primary keys;
- no unexplained missing rows;
- no unexplained extra rows;
- indexed core state agrees with physical inspection.

Any structural mismatch means bootstrap failure.

### 25.2 Deterministic sample validation

Sample across:

- NSE;
- BSE;
- NSE_INDEX;
- BSE_INDEX;
- small files;
- large files;
- old histories;
- recent histories;
- newly created symbols.

Compare indexed state with physical state.

### 25.3 FULL_VERIFY equivalence

For equivalent staged inputs, AUTO/FAST and FULL_VERIFY must agree on:

- inserted dates;
- inserted symbols;
- duplicates;
- binary write path classification;
- record counts;
- last dates;
- errors;
- recovery outcome.

Performance may differ. Correctness must not.

---

## 26. Performance Acceptance

Storage Architecture V1 shall not promise a fixed final runtime before production measurement.

Acceptance targets:

```text
Recovery baseline physical reads
→ reduced by at least 90% for a normal one-day Update when state is trusted

APPEND_NEWEST classification physical reads
→ reduced by at least 90% when state is trusted

Correctness mismatch
→ 0 unexplained

Binary errors
→ 0

Recovery/checkpoint semantics
→ unchanged
```

Production timing shall then determine the actual wall-time improvement.

If unavoidable random writes remain the dominant bottleneck after V1, later architectural work may evaluate sequential delta/compaction. That is explicitly outside V1.

---

## 27. Rollback

The architecture must remain immediately reversible.

### 27.1 Runtime rollback

Set:

```text
Storage Mode = FULL_VERIFY
```

to disable acceleration.

### 27.2 Sidecar rollback

The sidecar may be:

```text
renamed
deleted
rebuilt
```

without converting or rewriting:

- canonical `.eod` files;
- the application's main SQLite database;
- recovery journals.

### 27.3 Source rollout boundaries

Recommended patch sequence:

```text
V1.1 State Index Infrastructure
V1.2 Shadow Validation
V1.3 Bhavcopy Baseline Fast Path
V1.4 APPEND_NEWEST Fast Classification
V1.5 Cross-Writer Invalidation
V1.6 UI / Storage Mode Controls
```

Each patch shall have:

- source backup;
- payload hashes;
- focused tests;
- full relevant validation;
- runtime evidence;
- documentation;
- rollback instructions.

No single giant patch.

---

## 28. Safety Invariants

The implementation must preserve all of the following:

1. `.eod` remains canonical.
2. The sidecar is derived acceleration state only.
3. `DIRTY` state is never used for fast classification.
4. `UNKNOWN` state is never used for fast classification.
5. A census mismatch invalidates fast-path trust.
6. A missing row never causes guessed state.
7. Sidecar failure disables acceleration but does not corrupt canonical write behavior.
8. FULL_VERIFY remains available permanently.
9. Existing recovery journal semantics remain authoritative.
10. Existing checkpoint verification/durability remains authoritative.
11. Fast and slow paths converge on the same canonical mutation implementation.
12. No unsafe “force fast even when untrusted” user mode is permitted.
13. A per-symbol fallback is preferred over a global slow-path fallback.
14. Corporate Action metadata changes do not invalidate binary state unless they actually mutate `.eod`.
15. Non-binary identity metadata does not invalidate binary state.
16. Existing Bhavcopy multi-date symbol batching remains unchanged.

---

## 29. Deferred Future Work

Only if V1 measurement shows the remaining random writes are still unacceptable should later work consider:

### 29.1 Storage worker/concurrency tuning

Benchmark HDD-appropriate worker counts such as:

```text
1
2
4
```

Higher parallelism may worsen mechanical seek behavior.

### 29.2 Sequential delta + background compaction

Potential future architecture:

```text
daily import
     ↓
sequential delta/segment
     ↓
foreground completion
     ↓
background compaction into symbol files
```

This could eliminate thousands of random foreground writes but would significantly change chart-read and recovery semantics.

### 29.3 Bundled storage engine

A future new storage engine could partition/bundle symbols, but this is a major architectural replacement and is outside Storage Architecture V1.

---

## 30. Final Decision

Storage Architecture V1 is approved in principle with the following frozen direction:

```text
Canonical .eod format                unchanged
One file per symbol                  unchanged
Existing symbol batching             unchanged
Existing recovery journal            unchanged
Existing checkpoint                  unchanged

Sidecar SQLite state index           ADD
In-memory state table                ADD
Filesystem census                    ADD
Per-symbol trust/fallback            ADD
AUTO / FAST / FULL_VERIFY            ADD
Universal actual-writer invalidation ADD
Bhavcopy-first acceleration          ADD

Unsafe force-fast mode               NO
Checkpoint semantic optimization     NO in V1
Storage-engine replacement           NO
```

The next step after written-spec approval is a detailed implementation plan. Production implementation must not begin before that approval.

---

## 31. Evidence Basis

This specification is based on:

- production Bhavcopy timing evidence from 2026-08-19;
- physical disk identification as a SATA HDD;
- cold/warm `.eod` read benchmarks;
- Storage Architecture Audit V1;
- Bhavcopy Multi-Date Symbol Batching Audit V1;
- current source architecture observations;
- the accepted existing recovery/checkpoint design;
- comparative architectural observations from supplied AmiBroker material.

No claim in this specification requires AmiBroker internals to be copied. AmiBroker served only as comparative evidence that one-file-per-symbol storage can remain performant when symbol state and append paths are cached/reused efficiently.
