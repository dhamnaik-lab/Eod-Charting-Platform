# Verified existing Dividend classification

Date: 24 October 2026.
Backup: `backups/pre_opencode_changes_20261024_013322_ca_existing_dividend_classification`.
Handoff backup: `backups/pre_opencode_changes_20261024_014158_ca_existing_dividend_handoff`.

## Result and acceptance limits

The rebuilt native app screenshots supplied by the user establish DELPHIFX routing into the WEIZFOREX era, raw 2015/2016 OHLC display, dividend-toggle response, and a March 2016 adjusted return consistent with the Rs7.50 event. They do not provide separate visual acceptance for all four dates.

An explicitly enabled read-only production-code audit now verifies all four records with all three ticker files. Each action occurs once in the resolved chart context, its factor matches the historical previous close, an isolated dividend changes the pre-ex-date close by its cash amount, the ex-date close stays unchanged, and volume stays unchanged. These isolated values exclude later cumulative actions; they should not be compared directly to a fully adjusted chart's displayed rupee values.

| Import | Canonical | Ex-date | Raw previous close | Cash | Isolated adjusted previous close |
|---|---|---|---|---|---|
| 20928 | 10199 | 2015-09-04 | 245.40 | 7.50 | 237.90 |
| 22118 | 9769 | 2016-03-18 | 188.15 | 7.50 | 180.65 |
| 24836 | 8699 | 2017-08-14 | 707.85 | 3.00 | 704.85 |
| 26670 | 7991 | 2018-07-30 | 538.80 | 1.00 | 537.80 |

## Implementation

- `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs`: new read-only `verified_existing_dividend` proof and focused tests. Classification is limited to parsed Pending NSE_API cash-only Dividends. It requires exact official witness selection, freshly revalidated machine identity, no forbidden provenance, one canonical event candidate with identical ISIN/cash terms and valid non-volume-adjusting official factor, an existing approved official source-import link, current chart inclusion, and a factor matching local historical prices. Unresolved/unproved or conflicting records remain unclassified.
- `src-tauri-shell/src/database/corporate_action_imports.rs`: enrich the existing read-only event-identity listing command with verified existing Dividend matches inside a consistent read transaction. Errors drop the read-only connection; no mutation or approval occurs.
- `src-tauri-shell/src/database.rs`, `corporate_action_imports/event_identity_resolution.rs`, `src/types/desktop.ts`: additive `existingDividends` response metadata. The core effective-identity loader remains independent; the command enriches its result.
- `src/components/DatabaseToolsDialogs.tsx`: active classic queue consumes matches in bounded batches, ties cached results to the exact loaded row object, shows Already Processed and the canonical ID in details, and excludes the row from readiness/approval selection. Reads are cancelled when the existing queue context changes. Pending Dividend rows are included in this lookup even where identity details were previously lazy.
- `src/features/corporateActions/workspace/corporateActionClassicModel.ts`, `CorporateActionClassicWorkspace.tsx`: Already Processed category and filter.
- `src/features/corporateActions/workflow/corporateActionNormalWorkflowAdapter.ts`, `workspace/CorporateActionNormalWorkflowWorkspace.tsx`: the normal adapter also presents Already Processed, excludes it from Ready IDs and review-exception counts, and recognizes it during approval rechecks.
- Focused normal-review and classic-model tests cover presentation and exclusion from Ready selection without altering import approval fields.

Normal Fetch / Load & Validate / explicit Approve ownership, backend canonical guards, canonical rows and stored approval fields remain unchanged. Classification does not certify every corporate action in the database and is not generalized to Split, Bonus, Rights or Demerger. It can only appear in the live database after its ordinary workflow supplies valid source and persisted identity proof; this change does not migrate the acceptance-copy evidence into the source database.

## Validation

- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml existing_dividend_classification -- --nocapture`: 2 tests passed, 1 explicitly guarded local-data test ignored by default.
- PASS: explicitly enabled `existing_dividend_classification_real_copy_acceptance`: all four identities/actions and actual binary-price boundaries passed. Final execution took 0.53 seconds after cached compilation.
- PASS: focused Vitest for normal review, normal approval and classic model: 3 files, 26 tests.
- PASS: `scripts/validate-change.ps1 -Profile renderer` with touched renderer paths: typecheck and scoped whitespace.
- PASS: scoped Rust/docs whitespace checks.

Earlier failures were retained as diagnostics: one unit assertion expected the canonical guard but the approved peer triggered an earlier policy exclusion; the assertion now verifies ineligibility and the exact canonical match. The real-copy audit initially relocated a path-bound dated proof, then omitted the Windows canonical `\\?\` prefix. Inspection of persisted proof JSON established that path mismatch; the final audit opens the original marked evidence copy read-only via its canonical path. No production identity gate was weakened.

The separate `tmp/ca-existing-dividend-acceptance-20261024` folder contains an online backup of the prepared evidence copy and copies of the three binary price files. The audit uses its copied prices but opens `tmp/ca-witness-provenance-20261023/market-data.sqlite3` read-only at the original proof-bound path. Its SHA256 remained `6EFB00939A779079666E6DB16C432518B81039AB0BF18C1D268C641629EACD59`. All three source EOD hashes remained unchanged. The live source DB was locked by the running app, so a fresh source-file hash was unavailable; no source DB mutation was performed by this work.

No financial approvals, evidence deletion, canonical rewrite, commit, push, or portable rebuild. Native observation of the new classification remains pending after a rebuild; do not describe the four live source imports as already reclassified or approved.
