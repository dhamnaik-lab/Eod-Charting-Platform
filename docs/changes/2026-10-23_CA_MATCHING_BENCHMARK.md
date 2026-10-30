# CA matching connection benchmark — 23 October 2026

## Scope

Measured the connection-reuse change before another portable rebuild. No production database, active app, official feed, or financial approval was involved.

Backup: `backups/pre_opencode_changes_20261023_021315_ca_matching_benchmark_full` (source file presence verified).

## Method

An opt-in, ignored Rust test creates six disposable databases using the production schema and initialization code. Each contains 4,699 synthetic unresolved NSE dividend imports, one instrument, and exact event-date historical ISIN evidence. Each of three paired rounds resolves 50 rows in each database, alternating which strategy runs first.

- Before: reopen and prepare a connection for every row, then run the existing transaction and strict Quick Resolve function.
- After: open/prepare once per sample, reuse that connection, then run the same transaction and function for every row.
- Timed region includes connection initialization and matching/transaction work. Fixture creation, result verification, and compiler/linker time are excluded.
- This isolates the backend connection-lifetime change. It does not exercise the AppHandle cache mutex, IPC, rendering, pending-queue enumeration, hint preparation, EOD scanning, or dividend verification.
- All six runs assert that resolved imports remain unapproved and that canonical actions and prices remain empty. Each pair compares the full identity-resolution decision tuples, not just counts. Temporary directories are automatically removed.

## Results

| Round | Reopen per row (ms) | Reuse (ms) | Ratio | Identity/audit parity |
| --- | ---: | ---: | ---: | --- |
| 1 | 1175.514 | 92.119 | 12.761 | PASS |
| 2 | 1236.832 | 106.551 | 11.608 | PASS |
| 3 | 1115.126 | 110.301 | 10.110 | PASS |
| Total, 150 rows per strategy | 3527.473 | 308.972 | 11.417 | PASS |

The tested backend path was about **11.4 times faster** with connection reuse on this synthetic fixture. This is not an end-to-end speedup claim or an estimate for the user's 4,699-row workload. The fixture has a simple identity topology; real history/evidence volume, contention, storage, and UI costs can differ substantially. The Rust test profile is unoptimized; no release build was run.

## Reproduction and validation

`cargo test --manifest-path src-tauri-shell/Cargo.toml ca_matching_connection_benchmark --offline -- --ignored --nocapture --test-threads=1`

PASS: 1 benchmark test, three paired rounds, all parity and no-approval/no-price-write assertions. Test execution took 5.17 seconds including fixture creation; compilation/linking took 36.36 seconds separately. No performance threshold is asserted, avoiding hardware-dependent test failures.

Files changed: the test-only module declaration in `src-tauri-shell/src/database/corporate_action_imports.rs`, new `src-tauri-shell/src/database/corporate_action_imports/matching_performance_tests.rs`, and documentation. No runtime logic changed in this measurement pass.

## Remaining work

The supplied database was subsequently measured on a disposable copy; see [real-data timing and dividend profile](2026-10-23_CA_REAL_DATA_TIMING.md). Real matching samples were 9.84 times faster, and additional loading, scanning, and dividend query-planning bottlenecks were identified. The user chose bounded dividend profiling instead of completing the long full run. Complete Load & Validate timing and the running portable app's speed remain unverified. BSE HTTP 403 is still a separate unresolved fetch issue.
