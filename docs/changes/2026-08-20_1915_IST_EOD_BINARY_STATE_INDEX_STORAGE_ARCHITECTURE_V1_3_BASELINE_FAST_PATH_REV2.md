# EOD Binary State Index Storage Architecture V1.3 — Bhavcopy Baseline Fast Path Rev2

Date: 2026-08-20 19:15 IST

## Purpose

Activate the approved V1.3 Bhavcopy recovery-baseline fast path on top of the exact installed, post-V1.2/rustfmt source state.

Rev2 corrects the packaging/source-identity defect in the first V1.3 package. The first package was guarded against the pre-rustfmt V1.2 payload and correctly refused to apply when the installed `bhavcopy.rs` hash differed. That failed attempt reported `No files changed.` Rev2 is guarded against the exact installed source collection captured at 2026-08-20 19:09 IST.

## Exact-source provenance

Source collection ZIP SHA-256:

`8A2DEE7E72A50BB44AF2EB25313EF15C58C030324836C271BD426A2656894B0D`

The approved V1.3 delta was three-way reapplied using:
- base: V1.2 package payload;
- current: exact installed post-rustfmt V1.2 source;
- approved change: first V1.3 payload.

The Rev2 payload therefore preserves the exact installed V1.2 source as its current side of the merge and adds only the approved V1.3 behavior.

## Activated fast path

For each existing Bhavcopy target symbol, V1.3 reads file metadata only and may use the indexed recovery baseline when all trust gates pass:

- the existing sidecar opens read-only;
- bootstrap is complete and index status is healthy;
- a VERIFIED row exists for the exact exchange/symbol;
- row generation equals the current index generation;
- indexed relative path matches the expected canonical path;
- indexed record-count/date/file-length shape is internally valid;
- physical file length matches the indexed file length;
- physical file modification timestamp matches the indexed timestamp.

When trusted, Bhavcopy uses indexed `record_count`, `price_scale`, `file_length`, and `last_date` to build the recovery baseline without opening the `.eod` file for header/tail inspection.

## Fail-closed fallback

Any unavailable, unhealthy, missing, malformed, or metadata-mismatched state falls back to the pre-V1.3 physical baseline path. Existing structural checks and last-date reads remain authoritative on fallback. A physically missing file remains a conservative new-file baseline.

V1.3 does not write the sidecar. Therefore a successful Bhavcopy import makes affected rows stale; subsequent runs fail the length/mtime trust gate and physically fall back until the sidecar is refreshed or later state-publication work is implemented.

## Telemetry

Runtime event: `bhavcopy-eod-baseline-fast-path`

Reported fields include index availability/health/generation, candidates, eligible rows, fast-path count, fallback count, missing physical files, missing state rows, metadata/state mismatches, untrusted-index fallbacks, and physical baseline opens. Up to eight fallback samples are recorded.

V1.2 shadow comparison remains available for symbols that physically fall back under `bhavcopy-eod-state-shadow-fallback`.

## Tests

Focused V1.3 tests cover:

1. matching VERIFIED state uses the indexed recovery baseline with zero physical baseline opens;
2. changed file identity falls back to the physical path;
3. unavailable sidecar falls back to the physical path;
4. missing VERIFIED row falls back to the physical path.

V1.2 shadow tests and the read-only sidecar preservation test remain regression gates.

## Runtime acceptance

For a controlled run starting from a clean verified sidecar:

- index available = true;
- bootstrap complete = true;
- healthy = true;
- existing trusted targets use the fast path;
- physical baseline opens reduced by at least 90% versus target existing symbols;
- state/metadata trust violations = 0 for fast-path symbols;
- import/recovery/checkpoint correctness unchanged.

V1.4 APPEND_NEWEST writer classification optimization is explicitly out of scope.
