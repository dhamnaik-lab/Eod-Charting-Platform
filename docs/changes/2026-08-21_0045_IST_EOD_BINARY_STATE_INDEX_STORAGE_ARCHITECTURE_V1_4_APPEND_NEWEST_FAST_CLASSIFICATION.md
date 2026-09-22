# EOD Binary State Index Storage Architecture V1.4 — APPEND_NEWEST Fast Classification

Date: 2026-08-21 00:45 IST

## Purpose

V1.4 removes the remaining physical header and last-record reads used only to classify trusted Bhavcopy `APPEND_NEWEST` writes. The canonical `.eod` file remains authoritative, and every failed trust gate falls back to the existing physical classification path.

V1.4 builds on the accepted V1.3 recovery-baseline fast path. V1.3 proved that a healthy generation-3 EOD Binary State Index can identify existing files without physical baseline opens. V1.4 carries that trust into the writer only for recovery-journal-protected `APPEND_NEWEST` candidates.

## Exact source provenance

The package is guarded against the exact installed V1.3 source collection:

`v1-4-append-newest-fast-classification-source-preflight_20260821_001542.zip`

SHA-256:

`ED7087207A6195DA743263E5E8D8050123C87FBBB5BCB3EBA0E4273C75C73103`

Key installed source identities before V1.4:

- `src-tauri-shell/src/bhavcopy.rs` — `45C1A62A394F319DF15B9D6D59DA0AA9295A672F1C0D31EE653D55727062425D`
- `src-tauri-shell/src/database/binary_eod.rs` — `1D6AD4520D3496EF033BEF7D86465181E7207053AD3D26DC5D7AE4F4C1AFD02F`

## Trust model

A V1.4 hint is created only for a recovery baseline already classified `APPEND_NEWEST`, and only when the read-only sidecar is healthy and the exact VERIFIED row still agrees with that baseline:

- bootstrap complete / index healthy;
- row generation equals current generation;
- exact expected relative path;
- matching record count, price scale and file length;
- internally coherent record-count/file-length shape;
- indexed first/last dates present;
- first target date strictly later than indexed last date.

The writer then opens the target `.eod` file and performs a second trust check on the open file handle:

- open-handle file length equals the indexed file length;
- open-handle modification timestamp equals the indexed timestamp.

Only after both checks does the writer classify `APPEND_NEWEST` without reading the `.eod` header or physical last record.

## Fail-closed fallback

Any missing, unavailable, unhealthy, stale or mismatched state uses the existing writer classification unchanged. Open-handle metadata mismatch also falls back to the legacy header + last-date read path.

`APPEND_NEWEST` classification is independently rechecked against the incoming first date. If the incoming batch is not strictly newer than indexed `last_date`, the writer falls back to the legacy path.

## Canonical write behavior unchanged

The fast path reuses the existing APPEND_NEWEST mutation sequence:

1. open target file read/write;
2. seek to physical end;
3. write appended records;
4. update header record count and price scale when required;
5. flush;
6. either `sync_data()` immediately or defer the sync only under the existing durable recovery-journal contract.

The following remain unchanged:

- `.eod` format and record encoding;
- new-file path;
- rewrite-tail, update-existing and historical-insert paths;
- recovery journal contents and state machine;
- recovery replay;
- background checkpoint semantics and 4-worker cap;
- sidecar publication/invalidation;
- Corporate Action behavior.

V1.4 never writes the real state sidecar.

## Telemetry

Runtime event:

`bhavcopy-append-newest-fast-classification`

The summary reports:

- index availability / bootstrap / health / generation;
- candidates;
- hinted;
- open-handle trusted;
- fast;
- total fallback;
- missing rows;
- state mismatch;
- index untrusted;
- metadata changed;
- not-newest;
- physical header classification reads;
- physical last-date classification reads.

For a clean generation-3 one-day append run, the acceptance target is at least a 90% reduction in APPEND_NEWEST physical header/last-date classification reads, with zero trust violations.

## Test-first package

The apply script has an explicit RED/GREEN gate.

RED phase:
- installs only V1.4 tests on top of the exact current V1.3 source;
- runs the focused V1.4 filter;
- requires compilation to fail because the V1.4 APIs/implementation do not yet exist.

GREEN phase:
- installs the V1.4 implementation plus the same tests;
- runs the focused V1.4 tests;
- runs V1.3, V1.2, durability and read-only-sidecar regressions;
- runs `npm run tauri:check`;
- verifies the real generation-3 sidecar remained byte-identical.

No real Bhavcopy import is part of package validation.
