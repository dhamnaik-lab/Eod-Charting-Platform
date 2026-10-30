# CA canonical-action lookup performance fix — 23 October 2026

## Change

The user authorized the next query-planning fix and clarified that `E:\TA Projects\EOD Charting Platform\EOD DATABASE\Nse` is already a temporary database. Measurements continued on the existing disposable snapshot for repeatability; no approval was performed.

Pre-edit backup: `backups/pre_opencode_changes_20261023_025444_ca_query_lookup_fix`.

`src-tauri-shell/src/database/eod_data.rs::load_corporate_actions` previously combined symbol aliases and ISIN in an OR predicate. Without useful planner statistics, SQLite selected the exchange prefix of an index and scanned all canonical actions for that exchange. Dividend policy calls this context lookup both from same-date exclusion checking and from price-readiness checking.

The lookup now collects IDs through separate symbol and ISIN subqueries, combines them with UNION, and retrieves the matching actions by integer primary key. The outer `NOT INDEXED` applies only to fetching those known IDs: SQLite still uses the integer primary key, while the subqueries use the existing symbol/ISIN indexes. This avoids the poor exchange-prefix plan without introducing global ANALYZE work, new indexes, or database migrations.

The outer exchange/type filters and date/ID ordering remain intact. UNION keeps a row that matches both identities unique. The ISIN branch can still discover historical aliases; it does not restrict results to the current symbol. Approval-time rechecks, evidence rules, and financial writers are unchanged.

## Validation

Commands ran serially:

- PASS — `cargo test --manifest-path src-tauri-shell/Cargo.toml corporate_action_lookup_preserves_alias_isin_union_and_order --offline -- --quiet`: 1 regression test; 32.14 seconds compile/link, 0.01 seconds execution.
- PASS — real-data `ca_dividend_component_profile` with `CA_BENCH_PROFILE_VARIANT=query-fix`: 1 test, 12 sampled full policy calls plus diagnostic helper calls; 2.53 seconds total test execution.
- PASS — `cargo test --manifest-path src-tauri-shell/Cargo.toml database::eod_data::tests --offline -- --quiet`: 9 tests, including the new regression.
- PASS — `cargo test --manifest-path src-tauri-shell/Cargo.toml database::corporate_action_imports::auto_approval:: --offline -- --quiet`: 94 tests, 1 opt-in profiler ignored.
- PASS — exact full policy/evidence comparison against the saved baseline for all 12 rows; financial-state fingerprint unchanged.
- PASS — scoped whitespace check.

The new regression covers symbol/ISIN overlap without duplicates, multiple aliases, date/ID ordering, symbol-only and ISIN-only lookup, exchange isolation, supported action types, absent identities, and the existing empty-string ISIN behavior.

## Measured result

Same 12 rows, same unmodified snapshot schema/statistics, same unoptimized Rust test profile:

| Measurement | Saved baseline (ms) | Patched query (ms) | Ratio |
| --- | ---: | ---: | ---: |
| Full dividend policy calls | 1667.908 | 648.135 | 2.57 |
| Separately measured instrument context calls | 559.185 | 33.871 | 16.51 |

All eligible evidence values and all ineligibility reasons matched exactly. These are bounded headless debug measurements, not portable-app or full-queue speedup claims. Component calls are diagnostic and must not be summed as an exclusive breakdown of policy execution.

Evidence remains in `tmp/ca-real-data-20261023-0220/dividend-component-profile-query-fix.json`, `dividend-query-fix.log`, and `query-fix-comparison.json`. No source database, schema, planner statistics, approval status, price, or adjustment was changed by these measurements.

## Files and remaining work

- Runtime: `src-tauri-shell/src/database/eod_data.rs` — targeted lookup rewrite and regression.
- Test instrumentation: `src-tauri-shell/src/database/corporate_action_imports/auto_approval/dividend_performance_tests.rs` — additional output variant to preserve prior measurements.
- Documentation: this note and a follow-up link in the prior profiling report.

Queue/hint commands still repeat connection preparation, and explicit preparation still sends Dividend/Rights IDs to the Split/Bonus scanner. Those measured bottlenecks are separate follow-ups. Complete Load & Validate timing, portable UI speed, official fetch acceptance, and manual approval/chart-refresh acceptance remain unverified. No portable rebuild or packaging was run.

Subsequent operator evidence: a rebuilt portable app completed preparation in 11 minutes with 7,503 Ready actions and no approvals. See the [desktop result and diagnostics layout fix](2026-10-23_CA_DIAGNOSTICS_LAYOUT_FIX.md). This is a reported completed desktop run, not a controlled full before/after speed comparison.
