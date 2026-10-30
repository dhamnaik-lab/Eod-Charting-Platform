# CA queue, identity-hint and scanner performance

## Changes

Project: `E:\TA Projects\EOD Charting Platform`.
Pre-edit backup: `backups/pre_opencode_changes_20261023_113343_ca_remaining_performance`.

- `src-tauri-shell/src/database/corporate_action_imports.rs`: queue pagination and identity-hint commands now use the existing active-connection owner. Schema/identity preparation occurs when the connection is first opened instead of for every page/batch. Results are queried anew, not cached; the existing connection mutex and active-folder selection remain authoritative. A missing database returns an error rather than creating one through these reads.
- `src/features/corporateActions/legacy/corporateActionImportOperations.ts`: send only supported Split/Bonus targets to the official-import scanner. Dividend/Rights previously incurred scan batches despite being excluded by the backend candidate query. Retain the wider validation-ID scope for clearing stale UI evidence, the independent read-only Dividend verifier, cancellation checks, and explicit financial approval.
- `corporateActionPendingPreparation.test.ts`: verify mixed queues send only Split/Bonus IDs, and 1,001 Dividend/Rights rows produce no scanner calls while remaining pending. Approval and legacy-setting APIs remain uncalled in explicit-only Load.
- `corporate_action_imports/real_data_performance_tests.rs`: add an ignored bounded before/after benchmark with exact output comparisons and financial-state invariants. The older full preparation harness remains historical: its reopen-per-read and broad scanner scope predate this change.

No readiness policy, cash parser, financial approval, adjustment calculation, source-fetch behavior, or raw EOD handling changed. Existing dirty-worktree changes were preserved.

## Measured backend reads

Used four fresh SQL-only copies under the previously marked disposable root `tmp/ca-real-data-20261023-0220`. The snapshot's WAL was empty before copying. The snapshot was opened read-only; its main database bytes were verified unchanged afterward. Financial-write-blocking triggers were required on every copy, and canonical actions, SQLite prices, and approved import mappings were verified unchanged. The operator's `EOD DATABASE/Nse` folder was not opened by this benchmark.

Each strategy reads three queue pages at offsets 0, 16,000 and 32,000 (up to 1,000 rows each), plus three 100-ID identity-hint batches spread across the remaining unresolved/mismatch queue. Two rounds alternate execution order. Every serialized page and full hint response must match exactly. Reuse totals include one cold connection initialization; reopen totals include preparation for each of the six calls.

| Round | Reopen per call | Reuse connection | Exact results |
| --- | ---: | ---: | --- |
| 1 | 36.170 s | 11.428 s | PASS |
| 2 | 35.202 s | 11.549 s | PASS |
| Combined | 71.372 s | 22.978 s | PASS |

The sampled backend reads were **3.11 times faster**, including initialization. This is an unoptimized Rust-test measurement on the existing snapshot after its earlier matching run. It excludes IPC, rendering, connection-mutex contention, network fetch, scanner execution, and Dividend policy evaluation. It is not a measured whole-app speedup or a replacement for the operator's earlier 11-minute preparation result.

Evidence: `tmp/ca-real-data-20261023-0220/queue-hint-reuse-results.json`. The four scratch folders `read-reopen-0`, `read-reuse-0`, `read-reopen-1`, and `read-reuse-1` are retained for inspection; they contain SQL copies only, with no EOD-file copies.

## Validation

- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml list_import_rows --offline -- --test-threads=1` — 3 tests.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml resolution_hints_summarize --offline -- --test-threads=1` — 1 test.
- PASS: with `CA_BENCH_DISPOSABLE_ROOT` set to the marked root, `cargo test --manifest-path src-tauri-shell/Cargo.toml ca_queue_hint_connection_reuse_benchmark --offline -- --ignored --nocapture --test-threads=1` — 1 test, 102.83 seconds excluding compile/startup.
- PASS: focused Vitest with `--exclude 'tmp/**'` — PendingPreparation, DividendPreparedScopeOrchestration, ThreeActionCompletionR1 and OfficialApprovalUx; 4 files, 48 tests. The initial invocation without that exclusion matched archived copies and was interrupted; the corrected invocation above assesses current source only.
- PASS: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-change.ps1 -Profile renderer -Paths src/features/corporateActions/legacy/corporateActionImportOperations.ts` — renderer typecheck and scoped whitespace.
- PASS: `git diff --check` scoped to the changed tracked Rust/TypeScript files, and `rustfmt --edition 2021 --check` on the benchmark file. Formatting the large pre-existing Rust module was intentionally avoided to preserve unrelated changes.

## Remaining acceptance

Rebuild the portable app, then repeat Load & Validate on the same temporary database and record total/stage timing and readiness counts. Check the earlier diagnostics-layout fix in the native window. Small explicit-approval/chart-refresh acceptance, blocked-case investigation, and BSE HTTP 403 remain separate work. No financial approvals, portable builds, commits, or pushes were performed here.
