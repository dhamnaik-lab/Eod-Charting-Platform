# Dated symbol-chain identity proof contract

Date: 23 October 2026. Project: `E:\TA Projects\EOD Charting Platform`.
Pre-edit backup: `backups/pre_opencode_changes_20261023_221408_ca_multistep_proof_contract`.
Implements the user-approved [multi-step evidence plan](2026-10-23_CA_MULTISTEP_CHAIN_EVIDENCE_AND_IMPLEMENTATION_PLAN.md).

## Runtime change

Explicit NSE Fetch now retains a validated official symbol-change CSV separately from instrument application. A valid snapshot from the configured URL is reused for 24 hours; force Fetch refreshes it. Collection also runs when the requested CA dates are already cached. A collection failure is reported and leaves unproven identities unresolved. Fetch dates still restrict announcement collection; this change does not silently fetch historical announcements outside that range.

Two additive metadata tables are created during source collection: `corporate_action_symbol_chain_sources` retains URL, SHA-256, capture time and exact CSV bytes; `corporate_action_symbol_chain_proofs` stores the per-import proof JSON and fingerprint. Offline Load, identity recheck and Dividend R1 evaluation consume retained evidence without downloading or creating these tables. No renderer/IPC contract or sealed 184-event authority JSON was changed.

The new `VERIFIED_DATED_SYMBOL_CHAIN_R1` decision requires a unique linear multi-step path, strictly increasing effective dates, one active current target and inactive historical names. Transition dates belong to the new symbol. Branches, merges, cycles, symbol reuse and competing proven identities are rejected. Rename chronology alone cannot explain an ISIN mismatch after the final rename and never creates historical ISIN validity intervals.

An independent exact retained NSE_API announcement witness must bind symbol, event date, ISIN and purpose. Backfilled import-row evidence is excluded; duplicate or contradictory fresh witnesses are rejected. The proof binds database path, raw import tuple and financial terms, current target ISIN, source bytes/hash/lines and witness content. Consumers recompute and compare the persisted proof. Refreshed or changed evidence invalidates the old proof until normal preparation rechecks it.

Normal cash, official-source, EOD, same-date-peer and existing-canonical-action policy checks remain mandatory. Preparation writes identity metadata only; financial application still requires explicit Approve and backend rechecks. Raw `.eod` files and source import symbol/ISIN are unchanged.

## Changed runtime files

- `src-tauri-shell/src/database/corporate_action_imports/dated_symbol_chain.rs`: retained evidence, dated path, proof persistence and independent verification.
- `src-tauri-shell/src/database/corporate_action_imports/dated_symbol_chain/tests.rs`: positive/negative contract cases and guarded disposable-copy audit.
- `src-tauri-shell/src/database/nse_identity_imports.rs`: reuse validated downloader and parse retained archive headers in memory, without applying instrument changes.
- `src-tauri-shell/src/database/corporate_action_imports.rs`: Fetch collection, strict resolution, related inactive-name deduplication and audited metadata decision.
- `src-tauri-shell/src/database/corporate_action_imports/identity_recheck.rs`: revoke changed or unsubstantiated chain claims.
- `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs`: independently verify the new proof before Dividend R1 eligibility.

## Real-data result and remaining evidence

A fresh SQLite online backup was made from the source opened read-only into `tmp/ca-dated-chain-contract-20261023`. The official CSV hash was verified against the retained evidence manifest. The audit used 66 non-resolution write guards plus import identity/financial-field guards.

| Result | Count |
|---|---:|
| Affected unresolved Dividends checked | 39 |
| Reconciled to Pending through existing verified pair | 35 |
| Reconciled through the new multi-step contract | 0 |
| Still policy-ineligible | 4 |
| Financial approvals | 0 |

The four imports 20928, 22118, 24836 and 26670 have independently established WEIZFOREX → EBIXFOREX → DELPHIFX chronology, but their retained announcement evidence explicitly says it was backfilled from import rows. They therefore do not yet satisfy this new independent-witness contract. The implementation must not fabricate the missing proof or label them Ready. Fresh exact official announcement evidence remains necessary; even then all other Dividend checks still apply. This audit does not claim recovery of the broader historical group or measure full Load & Validate performance.

Source Parsed/Pending Dividend count remains 7,847. The 35 recovered records are on the disposable copy only; Pending is not Ready or Approved. Audit result: `tmp/ca-dated-chain-contract-20261023/dated-chain-results.json`.

## Validation

- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml dated_chain -- --nocapture`: 9 focused tests; data audit ignored in the normal run.
- PASS: explicitly enabled `dated_chain_disposable_preparation_and_policy_audit`: 1 audit, results above.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml auto_id1 -- --nocapture`: 9 tests; older disposable audit ignored.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml identity_recheck -- --nocapture`: 4 tests; older disposable audit ignored.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml dividend_policy_r1 -- --nocapture`: 19 tests.
- PASS: `cargo check --manifest-path src-tauri-shell/Cargo.toml --offline`: production integration compiled; seven unused-import/dead-code warnings remain.
- PASS: post-format `dated_chain` rerun: 9 tests; scoped `git diff --check`, new-file whitespace checks and byte-for-byte sealed-authority comparison.

Initial focused failures exposed the official CSV header aliases and a test that attempted reconciliation before the normal stale-proof identity recheck. Both were corrected; no approval guard was relaxed. No source database writes, portable rebuild, full test profile or financial approval were performed.
