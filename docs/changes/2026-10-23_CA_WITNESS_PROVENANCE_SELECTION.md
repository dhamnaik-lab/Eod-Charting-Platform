# Dividend R1 source-witness provenance selection

Date: 23 October 2026. Project: `E:\TA Projects\EOD Charting Platform`.
Pre-edit backup: `backups/pre_opencode_changes_20261023_225120_ca_witness_provenance`.

## Fix

`src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs` now distinguishes matching legacy backfills from an independently captured official witness. When both are present, one fresh witness may supply the source proof only if every record agrees on the exact symbol, ISIN, ex-date and purpose, including consistency between normalized payload and evidence columns. The fresh capture must have a nonempty capture time and an official HTTPS NSE corporate-actions API locator. All stored evidence is retained unchanged.

Multiple independent fresh witnesses remain ineligible, including a contradictory record that previously could be discarded during exact-match filtering. Malformed evidence, mismatched identity/date/purpose, empty capture time and invalid fresh-source URLs do not qualify for backfill replacement. The existing legacy-only source-selection behavior is preserved; it does not supply the independent witness required by the separate dated-chain identity contract.

All downstream identity, forbidden/manual provenance, canonical-action, cash, EOD and explicit approval checks remain intact. This is a read-time selection change, not an evidence migration, financial application or deletion.

Three focused tests cover successful fresh selection and evidence immutability, unchanged legacy-only compatibility, conflicting/invalid captures and multiple independent observations. Changes are limited to this policy reader and its local tests, plus documentation.

## Guarded real-data result

A fresh SQLite online backup from the source opened read-only was created in `tmp/ca-witness-provenance-20261023`. The exact DELPHIFX binary EOD file (80,000 bytes) and binary-state sidecar were copied for local price validation. The retained official API response was hash-checked before using the production parser/evidence writer. After evidence loading, production reconciliation and read-only Dividend R1 evaluation ran under the existing 66 non-resolution write guards plus source import identity/financial-field guards.

- 39 audited identities reconciled: 35 through the existing pair proof and 4 through the dated chain.
- 0 unresolved identities remain in this audited group.
- All four newly recovered rows pass the source-witness gate.
- All four remain ineligible for new approval because an exact matching canonical Dividend already exists.
- 0 financial approvals; source import identity preserved.

| Import | Existing canonical ID | Stored symbol | Effective date | Cash per share |
|---|---:|---|---|---:|
| 20928 | 10199 | EBIXFOREX | 2015-09-04 | 7.50 |
| 22118 | 9769 | EBIXFOREX | 2016-03-18 | 7.50 |
| 24836 | 8699 | EBIXFOREX | 2017-08-14 | 3.00 |
| 26670 | 7991 | EBIXFOREX | 2018-07-30 | 1.00 |

These canonical records carry ISIN `INE726L01019`, source `NSE_API` and applied timestamps on 10 June 2026. The existing matcher recognizes the same ISIN/date/type/cash terms across the symbol change. This confirms stored canonical matches; it does not newly verify historic chart application, adjustment-ledger integrity or current-symbol chart routing. The duplicate guard must remain intact. Cash/EOD checks after this canonical-action guard are not reached by these four records.

Results: `tmp/ca-witness-provenance-20261023/dated-chain-results.json`; source canonical evidence: `existing-canonical-actions.json`; copied price hash: `price-copy-manifest.json`.

## Validation and remaining work

- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml dividend_policy_r1_witness_provenance -- --nocapture`: 3 new tests.
- PASS: explicitly enabled `dated_chain_disposable_preparation_and_policy_audit`: 1 guarded audit with the retained official response and copied prices.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml dividend_policy_r1 -- --nocapture`: 22 tests, including preservation of canonical-action and explicit-approval exclusions.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml dated_chain -- --nocapture`: 9 contract regressions; marked-copy audit separately invoked above.
- PASS: source Parsed/Pending Dividend count remains 7,847; all four source rows remain Unresolved and unapproved; original and copied DELPHIFX EOD hashes unchanged.
- PASS: scoped `git diff --check`, documentation whitespace and byte comparisons confirming the resolver, dated-chain contract/audit harness and sealed authority are unchanged from the pre-edit backup.

The remaining issue for these four is existing-action reconciliation and user-facing duplicate classification, not permission to apply another adjustment. Audit the canonical linkage/ledger and renamed-symbol chart routing before changing that behavior. No source DB edits, automatic approval, full validation profile, portable rebuild or commit occurred.
