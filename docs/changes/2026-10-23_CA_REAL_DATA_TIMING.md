# Corporate Actions preparation timing on a disposable database copy

## Scope and safety

Source folder explicitly supplied by the user: `E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse`.

The original database was opened through SQLite's read-only URI for an online backup, including committed WAL content. No source migrations, checkpoint, financial approval, or source EOD writes were performed. The copied main database passed `PRAGMA quick_check`. The binary-state database was separately backed up. All 25,269 EOD files were copied successfully; copied sizes and modification times matched the source before testing. SHA256 hashes of the copied EOD files were recorded for post-test comparison.

Disposable work folder: `tmp/ca-real-data-20261023-0220`. It contains the marked snapshot, paired sample databases, two experimental SQLite copies, logs, and machine-readable results. It is retained for inspection and consumes about 1.8 GB; it is not an active database selection.

Pre-edit project backup: `backups/pre_opencode_changes_20261023_021959_ca_real_data_timing`.
Additional backups before the harness path correction and component profiling: `backups/pre_opencode_changes_20261023_023553_ca_timing_path_fix` and `backups/pre_opencode_changes_20261023_024141_ca_dividend_profiling`.

The ignored test accepts only a marked folder under this project's `tmp` directory, rejects overlap with the original source, and refuses to overwrite an existing results file. Scratch-only SQLite triggers reject changes to canonical actions/prices and financial approval fields. A before/after fingerprint additionally checks canonical actions, SQLite prices, and existing approved import mappings. No automatic approval or write-stage API is called.

## Method

`ca_real_data_preparation_benchmark` invokes the production internal backend functions using the renderer's current orchestration rules:

- Enumerate all non-approved imports in pages of 1,000, with a prepared connection per page.
- Read strict matching hints in batches of 100, with a prepared connection per batch.
- On three pairs of identical database copies, compare reopening a prepared connection per match with reusing one connection. Each pair uses ten real eligible imports from a different third of the queue. Execution order alternates; resolved identity/status results must agree. These samples are excluded from the full preparation timing.
- Run all eligible strict matching transactions using one prepared connection; reuse fetched identity hints.
- Scan the same Split/Bonus/Dividend/Rights targets selected by explicit-approval-only preparation, in batches of 500.
- Evaluate the current pending Dividend prepared scope in batches of 100 through read-only connections.

This is headless backend timing on real data in the unoptimized Rust test profile. It excludes Fetch/network, IPC, AppHandle/cache-mutex contention, renderer processing, UI responsiveness, snapshot copying, compiler/linker time, and final invariant checks. No full before-change pipeline is timed; only paired matching samples compare both strategies. It cannot establish the running portable application's end-to-end speedup.

Command (with `CA_BENCH_DISPOSABLE_ROOT` set to the marked work folder):

`cargo test --manifest-path src-tauri-shell/Cargo.toml ca_real_data_preparation_benchmark --offline -- --ignored --nocapture --test-threads=1`

## Results

### Real-data matching comparison

The snapshot contained 32,632 non-approved imports, including 4,726 unresolved/ISIN-review rows. Of these, 4,354 qualified for strict matching. All three paired samples produced identical resolved identity/status results and preserved financial state.

| Ten-row sample | Reopen per row (seconds) | Reuse (seconds) |
| --- | ---: | ---: |
| 1 | 34.299 | 3.373 |
| 2 | 33.166 | 3.448 |
| 3 | 33.592 | 3.453 |
| Total, 30 rows per strategy | 101.057 | 10.274 |

The measured matching sample was **9.84 times faster** with connection reuse. The complete new-strategy matching pass resolved **4,354 rows in 64.925 seconds**, with zero matching errors. No full old-strategy matching pass was run; do not extrapolate these sample ratios into a measured full-app speedup.

### Preparation stages completed before dividend profiling

| Stage | Work | Seconds |
| --- | --- | ---: |
| Queue enumeration | 32,632 rows, 1,000 per page | 127.581 |
| Strict identity hints | 4,726 rows, 100 per batch | 209.543 |
| Strict matching with connection reuse | 4,354 rows | 64.925 |
| Official-import scanner | 13,799 supplied IDs, 28 batches, 116 Split/Bonus results | 97.505 |

All 28 new scan-run records were independently verified as COMPLETED, with 116 total results. The frontend supplies Dividend/Rights IDs in explicit-approval preparation, but `load_scan_candidates` accepts only Split/Bonus. Many scan batches therefore pay connection-preparation costs without evaluating their supplied Dividend/Rights rows. Dividend checks occur in the separate policy stage.

The initial full benchmark **FAILED** before dividend evaluation because canonicalizing the test path introduced a Windows `\\?\` prefix that the read-only SQLite URI encoder rejected (`invalid uri authority: %3F`). The test harness now canonicalizes only for containment checks and retains the ordinary absolute path for database access. No production path-handling code changed.

The read-only continuation was then **INCOMPLETE by explicit user choice**: 900 of 13,367 dividend candidates were checked in 164.237 seconds before the user chose bounded profiling instead of completing the long run. This early sample suggested about 41 minutes if that rate persisted; that is an extrapolation, not a measured full-stage duration. No full preparation total or portable-app end-to-end timing is established.

### Bounded dividend profile and controlled experiments

Twelve rows spread across the pending dividend queue were profiled. Each full policy call was timed first; individual helpers were then timed separately. Helpers can overlap internally or be skipped by an early policy rejection, so their times must not be summed as an exclusive breakdown of the full call. The first profile found ordinary context lookup around 58–65 ms and same-date exclusion around 75–90 ms for the first nine rows; official witness lookup was below 1 ms. The exclusion function itself resolves context, and the policy resolves it again afterward.

Query plans showed exchange-prefix scans for symbol/ISIN `OR` lookups, including canonical-action context. The following experiments used separate copied SQLite databases and the same disposable EOD files. They did not modify app logic or the original database.

| Variant, 12 full policy calls | Total milliseconds | Baseline ratio | Exact policy/evidence parity |
| --- | ---: | ---: | --- |
| Baseline verification | 1667.908 | 1.00 | PASS |
| Five candidate indexes, existing planner statistics | 1462.730 | 1.14 | PASS |
| Existing indexes, statistics refreshed with ANALYZE | 390.603 | 4.27 | PASS |
| Six candidate indexes plus refreshed statistics | 289.206 | 5.77 | PASS |

The index experiments cover identity-history lookup branches, same-date import lookup, and canonical exchange/ISIN lookup. Definitions and query plans are in `dividend-index-experiment.json`. Several candidate indexes duplicate or extend existing indexes; this is a diagnostic package, **not** an accepted migration to copy wholesale into the app. With refreshed statistics and index coverage, the inspected alias/canonical queries selected MULTI-INDEX OR lookups instead of exchange-prefix scans.

All variants produced exactly the same twelve full policy results, including eligible identity proof, official witness, cash amount, previous trade date/close, and adjustment factor, or the same ineligibility reason. Six sampled rows were eligible and six ineligible; eligibility did not trigger approval. These small, ordered, warm-cache debug samples establish a useful optimization direction, not a release or full-queue performance guarantee.

## Validation and limits

- PASS: initial component profile (1 test, 4.65 seconds, 30.09 seconds compile/link separately).
- PASS: baseline-verification and indexed component profiles, run serially (1 test each; first compile/link 27.64 seconds).
- PASS: indexed-plus-statistics profile (1 test, 1.49 seconds).
- PASS: statistics-only profile (1 test, 1.92 seconds; 20.73 seconds compile/link separately after adding the variant).
- PASS: exact full-policy result/evidence comparison for all twelve rows across the three experimental variants.
- PASS: canonical actions, SQLite prices, and approved import mappings match the pre-preparation paired-copy baseline in the snapshot and both experimental copies.
- PASS: all 25,269 copied EOD files have identical pre/post SHA256 hashes. Disposable artifacts total 1,749,516,675 bytes (about 1.75 GB).
- PASS: focused Rust formatting and scoped whitespace checks. No benchmark/compiler processes remain running.
- Initial full-run FAIL and continuation INCOMPLETE are retained above; no complete full-run PASS is claimed. No portable build, UI acceptance, Fetch/network test, or financial approval was performed.

Machine-readable evidence: `preparation-checkpoint.json`, `dividend-component-profile*.json`, `dividend-index-experiment.json`, `validation-summary.json`, and the saved timing/profile logs under the disposable work folder. Completed stage timings recovered from the first log are rounded to milliseconds.

## Recommended next patch

1. Address dividend query planning first: select the minimum necessary lookup/index/statistics change from these experiments and keep strict identity, same-date exclusion, official evidence, and approval-time rechecks intact. Avoid rerunning database-wide maintenance per row or page. Investigate reusing context within one policy evaluation, rather than caching approval evidence across cycles.
2. Remove repeated schema/source preparation from queue and hint read commands. These two stages alone consumed 337.124 seconds in the measured debug run.
3. Send only supported Split/Bonus candidates to their scanner, while retaining the separate Dividend policy verification and explicit unsupported-type handling.
4. Repeat the disposable-copy stage measurements after the patch, then rebuild once and measure the real portable workflow. Do not ask the user to run manual SQL against the original database.

Only test instrumentation and documentation changed during this profiling pass. Runtime edits from earlier CA work remain separate and were preserved.

Follow-up: the authorized [canonical-action lookup fix](2026-10-23_CA_QUERY_LOOKUP_PERFORMANCE.md) now avoids the exchange-prefix scan using existing indexes and primary-key retrieval. On the same 12-row snapshot sample, full policy calls were 2.57 times faster with exact evidence parity, without new indexes or statistics changes. Queue/hint setup and scanner batching remain open.
