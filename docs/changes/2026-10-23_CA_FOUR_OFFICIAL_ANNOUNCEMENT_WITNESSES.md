# Four historical Dividend announcements: live collection and guarded audit

Date: 23 October 2026. Project: `E:\TA Projects\EOD Charting Platform`.
Pre-edit backup: `backups/pre_opencode_changes_20261023_223824_ca_four_official_witnesses`.

Follow-up: [provenance-aware source selection is now fixed and validated](2026-10-23_CA_WITNESS_PROVENANCE_SELECTION.md). The four pass that source gate but remain excluded from new approval because matching canonical dividends already exist under EBIXFOREX. The source-gate diagnosis below records the earlier checkpoint.

## Collected evidence

A normal cookie session against the official NSE Corporate Actions page and the symbol-scoped API returned HTTP 200. The API query used DELPHIFX, equities, 01-01-2015 through 31-12-2018. Its six rows include all four exact Dividend announcements required by the dated-chain proof contract. This is a fresh official API capture of historical actions; it does not establish access to the originally filed announcement documents.

Retained response: `tmp/ca-four-official-witnesses-20261023/response-1.bin`, 1,885 bytes, SHA-256 `15474348c20ed404f29e39928954d456abdad6ad8a51fbb2b1931be349ce2922`. The adjacent `manifest.json` records URL, UTC capture time, HTTP status, byte length, final URL and hash. The original response is preserved before normalization. The official website also lists these events on its [DELPHIFX Corporate Actions page](https://www.nseindia.com/companies-listing/corporate-filings-actions?symbol=DELPHIFX).

| Import | Ex-date | Cash per share | Exact source ISIN |
|---|---|---:|---|
| 20928 | 2015-09-04 | 7.50 | INE726L01019 |
| 22118 | 2016-03-18 | 7.50 | INE726L01019 |
| 24836 | 2017-08-14 | 3.00 | INE726L01019 |
| 26670 | 2018-07-30 | 1.00 | INE726L01019 |

## Production-code evaluation on disposable copy

Created a fresh online SQLite backup from the source opened read-only into `tmp/ca-four-official-witnesses-20261023/audit`. The optional ignored audit now accepts a byte-retained response and manifest, verifies its hash and exact symbol/ISIN/purpose/date match, then uses the existing production candidate parser and evidence writer to attach the four witnesses. No source import terms are rewritten. Both old and new evidence remain retained.

The subsequent production identity resolver and read-only Dividend R1 evaluator ran with 66 non-resolution write guards plus import identity/financial-field guards:

- 39 affected unresolved Dividends checked.
- 35 recovered to Pending through the existing verified-pair proof.
- 4 recovered to Pending through the new dated-chain proof.
- 0 remaining unresolved identities in this group.
- 0 newly Ready among the four; all four rejected by the existing exact-one-witness rule.
- 0 financial approvals; source symbol/ISIN preserved.

Result: `tmp/ca-four-official-witnesses-20261023/audit/dated-chain-results.json`.

## Remaining application issue

Dividend R1's existing `load_exact_simple_cash_dividend_official_evidence` counts matching normalized evidence without distinguishing legacy import-row backfills from freshly retained official captures. Each of these four now has two matching witnesses in the disposable copy, so the policy returns: `Dividend R1 requires exactly one exact persisted NSE_API official-source witness.` The dated-chain identity reader correctly excludes backfills, but the cash-policy source reader still counts them.

The next focused fix should distinguish evidence provenance consistently, preserve all original records, and continue rejecting contradictory or multiple independent fresh witnesses. Do not simply delete older evidence, overwrite backfill notes or weaken the one-independent-witness requirement. After that fix, rerun the same four records through cash, EOD and all remaining policy checks. Resolving this source gate does not imply those later checks will pass.

No production runtime behavior changed in this step. Only the ignored audit harness and documentation were edited; the source database, raw EOD and sealed authority are untouched. Source Parsed/Pending Dividend candidates remain 7,847. No portable rebuild or application approval was performed.

## Validation

- PASS: live official HTTP collection, response hash and all four exact event matches.
- PASS: explicitly enabled `dated_chain_disposable_preparation_and_policy_audit`: 1 guarded audit, results above.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml dated_chain -- --nocapture`: 9 contract regressions; marked-copy audit separately invoked above.
- PASS: scoped whitespace checks, source candidate/status count checks and byte comparisons of production resolver, chain contract, Dividend policy and sealed authority against the pre-edit backup.
