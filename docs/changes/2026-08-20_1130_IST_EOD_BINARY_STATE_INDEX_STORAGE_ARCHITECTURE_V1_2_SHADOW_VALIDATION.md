# EOD Binary State Index Storage Architecture V1.2 — Bhavcopy Shadow Validation

**Date:** 2026-08-20  
**Scope:** Shadow-only Bhavcopy recovery-baseline comparison  
**Source basis ZIP SHA-256:** `DF081E63E35D5DEC8519166D7FD244A95449303E8096563F26FD80C9ADDDB0AE`

## Purpose

V1.2 wires the V1.1 EOD Binary State Index into the Bhavcopy recovery-baseline preparation path in **observation-only** mode.

The existing physical `.eod` path remains authoritative. V1.2 does not use indexed state to skip any physical read and does not change binary-write classification, recovery semantics, checkpoint semantics, or durability.

## Runtime behavior

For each symbol included in a staged Bhavcopy CSV import:

1. The V1.2 code opens the existing sidecar with SQLite read-only flags.
2. It loads VERIFIED state rows into memory.
3. Bhavcopy executes its existing physical baseline reads exactly as before.
4. The physical pre-state is compared against the corresponding VERIFIED state row.
5. Aggregate telemetry records:
   - `compared`
   - `matched`
   - `mismatched`
   - `unavailable`
   - index availability/bootstrap/health status
6. Up to eight mismatch samples are written to the runtime log.

The visible progress log includes:

```text
Bhavcopy EOD state shadow: index available=...; bootstrap complete=...; healthy=...; indexed rows=...; compared=...; matched=...; mismatched=...; unavailable=...
```

## Comparison contract

For an existing physical `.eod` file and corresponding VERIFIED sidecar row, V1.2 compares:

- `record_count`
- `price_scale`
- `file_length`
- `last_date`
- filesystem `mtime` in nanoseconds

A missing sidecar row is `unavailable`, not a mismatch. An indexed VERIFIED row whose physical file is absent is a mismatch.

If the sidecar cannot be opened/read, the import continues through the existing physical path and shadow rows are reported unavailable. Sidecar failure cannot block canonical Bhavcopy behavior in V1.2.

## New sidecar API

`BinaryStateIndex::open_existing_read_only(...)` opens an already-created sidecar with `SQLITE_OPEN_READ_ONLY`.

It:

- never creates a missing sidecar;
- never initializes or migrates schema;
- validates schema version;
- supports `status()` and `load_verified()` reads.

The existing writable `BinaryStateIndex::open(...)` remains unchanged.

## Tests

Added focused tests cover:

- read-only sidecar open requires an existing sidecar and preserves its bytes;
- equivalent physical/index state matches;
- mismatches in record count, scale, length, last date, or mtime are detected;
- missing index row reports unavailable;
- indexed row with absent physical file reports mismatch.

## Safety boundary

V1.2 explicitly does **not**:

- activate any Bhavcopy fast path;
- use indexed state as recovery authority;
- skip physical header/tail reads;
- modify `.eod` writer classification;
- publish/invalidate sidecar state after writes;
- change checkpoint/recovery semantics;
- repair the 693 legacy duplicate-date NSE files.

Because V1.2 is read-only with respect to the sidecar, a successful real Bhavcopy import will make the sidecar stale for the symbols it writes. The first runtime shadow gate must therefore be run against the currently verified V1.1 sidecar. Before V1.3 activation, the sidecar must again be reconciled/rebuilt or otherwise returned to a trusted current state.

## Acceptance gate

For the first controlled real Bhavcopy import against the verified V1.1 sidecar:

```text
unexplained mismatches = 0
```

`unavailable` is permitted for genuinely new/unindexed symbols and must be reviewed separately.

V1.3 fast-path work is prohibited until the V1.2 shadow gate is accepted.
