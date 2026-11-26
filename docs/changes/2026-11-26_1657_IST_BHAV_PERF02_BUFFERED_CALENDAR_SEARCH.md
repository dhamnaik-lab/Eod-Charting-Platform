# BHAV-PERF-02 — Bounded buffered calendar search

IST: 2026-11-26T16:57:54+05:30

Status: LOCAL CANDIDATE; Windows Rustfmt, tests, read-only benchmark and native release acceptance pending. Base `a698559c6f86facff9cbb24a244378c40f6067b9`. Accepted portable remains `CCD5C0753E74D39E46D4C494AC1E6CD24855D799665F6960A9F7C47F30B6F53F`.

## Objective and limitation

BHAV-PERF-01 functional acceptance passed, but calendar contradiction probes consumed 16.824 s of approximately 17 s of December 2025 planning. NSE 6.214 s; BSE 10.423 s; indices 0.187 s. November probes took 16.175 s. Target monthly planning below 3 s; not a guaranteed result. See [BHAV-PERF-01 closeout](2026-11-26_1457_IST_BHAV_PERF01_BOUNDED_VERIFICATION_IO.md).

## Scope / implementation

- `src-tauri-shell/src/bhavcopy/ingestion.rs` only: bounded whole-declared-file read up to 1 MiB, then same per-date binary lower/upper-bound and record-membership search via `Read + Seek` cursor; fallback to original per-date physical reads on oversized/short/unreadable buffers. Buffer released before next file. No persistent cache/schema changes.
- Preserve exact sidecar query order, per-date termination on error, path/header identity validation, size/mtime invalidation, per-window memo and storage-mode checks. Hybrid and singleton/>31 date fallback unchanged. No skip authorized by bounds alone. No coverage receipt, retry, source admission, force mode, write or journal changes.
- Three fixture regressions: gaps and malformed order equivalence, cap/overflow/truncated read fallback, candidate ordering and identity/missing file errors; existing PERF-01 cache invalidation test runs the buffered path.
- Operator-only ignored test `bhavperf02_calendar_read_only_benchmark` uses the same query and old/new read strategies on identical December 2025 and November 2026 calendar candidates for all four exchanges, two rounds with reversed order. Read-only EOD handles and a copied test sidecar; no live SQLite writes, downloads, or production access. Require exact decision equality. Benchmarks are debug harness times, not full native release planning times.

## Validation

Canonical Rustfmt, focused `bhavperf02_`, Bhavcopy, recovery and binary EOD regressions through shared Cargo offline/locked wrapper, doc-reference check, read-only matched benchmark. Check accepted test metadata hashes and EOD file inventory/size/mtime before/after benchmark. Report actual command results. No new dependencies, source-control mutation or portable build.

## Risks / rollback

Reading more bytes may hurt long-history workloads; bounded fallback limits temporary memory and keeps existing semantics. Existing size/mtime guards and app price-store lock remain; external concurrent file writers not supported. Benchmark cache temperature and debug profile affect elapsed time. Do not claim native performance target without measurement. Restore only scoped source/doc files from exact backup on explicit approval. Never restore or delete actual databases, journal evidence or shared build artifacts.

## Actual Windows validation

IST: 2026-11-26T17:16:52+05:30

Status: PASS_BHAV_PERF02_WINDOWS_VALIDATION

- {"rustfmt": "PASS", "files": ["src-tauri-shell/src/bhavcopy/ingestion.rs"]}
- {"args": ["bhavperf02_"], "passed": 3, "failed": 0, "ignored": 1}
- {"args": ["bhavcopy::"], "passed": 207, "failed": 0, "ignored": 5}
- {"args": ["bhavcopy_recovery::"], "passed": 19, "failed": 0, "ignored": 0}
- {"args": ["database::binary_eod::"], "passed": 29, "failed": 0, "ignored": 0}
- {"docsReferences": "PASS"}
- {"args": ["bhavperf02_calendar_read_only_benchmark", "--", "--ignored", "--nocapture", "--test-threads=1"], "passed": 1, "failed": 0, "ignored": 0}
- {"window": "December2025", "round": 1, "legacyMs": 21145, "bufferedMs": 8283, "equivalent": true}
- {"window": "December2025", "round": 2, "legacyMs": 15995, "bufferedMs": 8002, "equivalent": true}
- {"window": "November2026", "round": 1, "legacyMs": 13687, "bufferedMs": 6845, "equivalent": true}
- {"window": "November2026", "round": 2, "legacyMs": 12904, "bufferedMs": 6771, "equivalent": true}

Scoped backup: E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261126_170001_BHAV-PERF-02-20261126-165959-800954

Benchmark is read-only debug-harness evidence, not native release planning time. Publication and portable build require separate approval.
