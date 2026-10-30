# Corporate Action chart predecessor routing

Date: 24 October 2026.
Backup: `backups/pre_opencode_changes_20261024_002956_ca_chart_rename_chain`.

## Evidence and scope

Read-only inspection found one canonical Dividend for each recovered DELPHIFX event:

| Recovered import | Canonical action | Original approved WEIZFOREX import | Date | Cash | Previous raw close |
|---|---|---|---|---|---|
| 20928 | 10199 | 42566 | 2015-09-04 | 7.50 | 245.40 |
| 22118 | 9769 | 42584 | 2016-03-18 | 7.50 | 188.15 |
| 24836 | 8699 | 42626 | 2017-08-14 | 3.00 | 707.85 |
| 26670 | 7991 | 42655 | 2018-07-30 | 1.00 | 538.80 |

Each recorded factor exactly equals P / (P - D) for the retained WEIZFOREX raw previous close. The canonical rows are stored under EBIXFOREX with historical ISIN INE726L01019. The recovered imports remain unresolved and unlinked in the source database. Existing canonical guards must continue to prevent a second adjustment.

The chart resolver previously loaded DELPHIFX and EBIXFOREX but omitted WEIZFOREX because its earlier edge has no ISIN and neither endpoint is DELPHIFX. Binary history is separate: WEIZFOREX 2011-06-28 through 2020-03-19; EBIXFOREX 2020-03-20 through 2021-08-31; DELPHIFX 2021-09-01 through 2026-10-14. Consequently the four canonical dividends were discoverable but had no preceding loaded bars to adjust.

## Change

`src-tauri-shell/src/database/eod_data.rs` now follows persisted incoming SYMBOL_CHANGE/BOTH edges backwards from the resolved current symbol, within the requested exchange. It adds missing history rows once by ID before building related symbols and dated transitions. This restores the earlier price-file route and preserves current identity selection, exact-symbol mode, corporate-action ID deduplication, dividend opt-in and raw price immutability. It does not infer historical ISIN intervals or supply approval identity proof.

Traversal requires one incoming edge, a nonempty predecessor, strictly decreasing dates while walking backwards, no repeated symbols, and at most 32 transitions. Ambiguous or malformed chains return an error instead of selecting an arbitrary predecessor. Name-only history does not extend the route.

## Validation and remaining work

PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml database::eod_data::tests -- --nocapture`: 12 tests, including three new rename-chain tests. These exercise production context resolution, Hybrid and Binary price loading, read-time dividend adjustments for the four event terms, binary byte immutability, exchange isolation, exact-symbol mode, invalid-chain rejection and the 32-transition boundary. The earlier focused two-test run also passed. Compile/link took approximately 34 seconds on the final run; test execution took 0.03 seconds.

PASS: scoped `git diff --check` for the changed source and report.

FAIL: `scripts/validate-change.ps1 -Profile docs` stops at an existing missing reference in `FILE_INVENTORY.md`: `2026-10-23_CA_CLASSIC_UI_DESIGN_QA.md`. The unrelated inventory was left unchanged; scoped whitespace was checked separately.

No source database changes, canonical rewrites, approvals, evidence deletion, portable rebuild or commit were performed. Native UI acceptance remains pending. Existing-action classification is a separate follow-up: derive an already-processed view only from a unique verified canonical match and its existing approved source link, without manufacturing approval on the recovered imports.
