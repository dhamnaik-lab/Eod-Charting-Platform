# BHAV-PERF-02 — Bounded buffered calendar search

IST: 2026-11-26T16:57:54+05:30

Status: NATIVE ACCEPTANCE PASS; see final closeout below. Historical candidate context: Base `a698559c6f86facff9cbb24a244378c40f6067b9`. Accepted portable remains `CCD5C0753E74D39E46D4C494AC1E6CD24855D799665F6960A9F7C47F30B6F53F`.

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

## Native acceptance closeout — 26 November 2026, 22:56 IST

Status: **PASS — functional preservation and observed performance improvement; three-second planning goal not met.** Owner approved closeout. PR #145 merged at `cef2a4a72a52ba50846231183b4a4a5e90889c6b`; validated candidate `32873efc49932b16a4ffdc448c89e7dd4fd64ed3`; Renderer CI #230 and Rust Compile and Test CI #46 passed. Local synchronization receipt SHA-256 `117E00A0058B7E21FB46AF0C52FC403A3993186135EB627D01F1562BB27A256E`; unrelated remote-tracking ref lock warning did not invalidate exact main/tree checks. Standard `npm.cmd run tauri:portable:win` passed (Vite 6.74 s; Rust release 4m03s; 11 existing dead-code warnings). Portable SHA-256 `36187516702E2E1E03EE4A1AEB749AFEC6591A77B68B294FA73B04929C8C9662`. Build log `tmp/BHAV-PERF-02-Build-20261126-184107/BUILD.log`.

| Calendar probe sum | PERF-01 | PERF-02 |
|---|---:|---:|
| December 2025 | 16.824 s | 8.368 s |
| November 2026 | 16.175 s | 6.318 s |
| Combined | 32.999 s | 14.686 s |
| Total planning, December | 17 s | 11 s |
| Total planning, November | 21 s | 13 s |

Matched read-only debug benchmark 63.731 s to 29.901 s (53.08% reduction); observed native calendar reduction 55.50%, not a matched benchmark. Different receipt coverage, candidate sets and cache temperature limit comparison. November accumulated binary reconciliation 6.760 s; no further optimization approved here.

Native test ranges 2025-12-01..2025-12-31 and 2026-11-01..2026-11-26, all four exchanges, two workers. December 9 jobs: 0 successful, 1 incomplete, 8 failed, 0 imported. November 12 jobs: 2 successful, 3 incomplete, 7 failed, 5,263 imported. New BSE 5,126 and NSE_INDEX 137 records on 2026-11-26; 9 new files, 5,254 append-newest, zero changed dates and write errors. Background checkpoint completed 5,254 files in 6,326 ms. Existing 2,210,913 quotation records preserved; 2,216,176 final, 14,050 EOD files, no missing files or additions outside authorized ranges. 180 existing receipt summaries preserved and 2 new valid receipts with matched members; no pending receipts or sessions; 17 held source rows remain. Source errors include wrong-date archive rejection, HTTP 403/invalid HTTP headers and unavailable index data. No independent exchange-price parity or full-history certification.

Evidence (SHA-256):
- Windows validation ZIP `3B3B86E166B73B4211251F6DCD1CA937E553132DD8CA8A34088B92B353AF72CA`; 207 Bhavcopy, 19 recovery, 29 binary EOD tests passed (255 distinct regression tests; 3 focused overlap; 5 Bhavcopy ignored, one operator benchmark explicitly executed and passed).
- Prior reconciled native ZIP `E139603DEEEE94D26F15902622B570EBA27656AD2269E06DE6D15B7F467B68AB`; baseline manifest `7E46F305477621B274D79C4BDE1635BB2F8FC3A5D00FCB3217D464777635031B`.
- Final native ZIP `7ECA086AEBEA7CD83E02669855C6CA082BB4EBCDF0439A78C70EA8AA88435311`; local final manifest `24A0B8388E7691384AEF10950E776AFBF02255D17D90CF17B07380AF9FA41D80`; six preservation checks passed. ZIP holds summary/metadata/preview, not raw manifest or original quotation bytes; those checks were executed on operator Windows machine.
- December log `E194E4BBE0E76F022ACC5B8CEBAE51A820609DA5C02763BB111F0D4C5D92DDF1`.
- November log `65A1C5AFCE95681559E7FCECC301C5E49275A9C1620E0DECBC9D3DEC549FD76F`.

The initial verifier used a two-window filter (152) while expecting 180 receipts. Corrected R1 checks the full accepted receipt scope without relaxing physical preservation; original HOLD evidence retained. Premature After run confirmed unchanged baseline before real downloads, not native acceptance. Final post-download ZIP is the accepted evidence. No production DB access or changes to recovery HOLD. This closeout updates only this record and three trackers; accepted runtime unchanged. For rollback of documentation only, restore the exact four original files from scoped closeout backup. No full backup, source change, dependency change, rebuild or new database scan required. BHAV-CLEANUP-01 is separate; review 11 warnings before changing source. Do not suppress warnings or change behavior.
