# Verified historical/current symbol pair reconciliation — 23 October 2026

## Scope and backup

Project: `E:\TA Projects\EOD Charting Platform`.
Pre-edit backup: `backups/pre_opencode_changes_20261023_191423_ca_verified_identity_pair`.

The user approved improving automatic historical-identity reconciliation after a read-only investigation of the lower Dividend candidate count. This change fixes a narrowly evidenced ambiguity in the existing resolver. It does not introduce inferred ISIN validity periods or restore old issuer-prefix matching.

## Finding

The active temporary database reproduced 16,241 unapproved Dividends, including exactly 7,847 Parsed/Pending candidates. There were 4,994 Parsed/Unresolved, 3,349 requiring parsing/terms review, and 51 Parsed/ISIN mismatch records. Audit decisions showed 4,729 parsed Dividends still unresolved after the stricter machine-identity recheck.

Among those records, 3,025 had a matching symbol/ISIN somewhere in stored history. That count is not an approval or recovery estimate: most stored ISIN history is sourced from previous corporate-action approvals, and an observation on another date does not prove a validity interval. No such interval was invented in this change.

A distinct, independently verifiable subset had two existing proof results:

1. An active current symbol named by an existing exact import-specific, fingerprint-verified V1.14D.1 event-identity resolution.
2. Its inactive predecessor, named by that same sealed resolution, with exact event-date ISIN history.

The resolver treated this verified rename pair as competing securities. For example, SURANASOL/SURANAVEL, PAISALO/SEINV and KSB/KSBPUMPS exhibited the problem.

## Implementation

`src-tauri-shell/src/database/corporate_action_imports.rs` now permits the existing persisted canonical-symbol proof only when there are exactly two proven suggestions and the other is its explicitly named inactive event symbol with exact dated proof. Both existing proofs are recomputed first; authority, row tuple, fingerprint and transition-date checks remain in force.

Two active targets, an additional proven identity, a different historical symbol, missing authority or tampered evidence do not qualify for this exception. Financial eligibility is still independently checked by Dividend R1. Pending is not Ready or Approved. Existing explicit approval, backend rechecks, chart refresh, canonical adjustment records and raw EOD behavior remain unchanged.

The same file adds three regression tests for successful reconciliation, active-symbol/missing-authority rejection, and additional-identity/tamper rejection. `corporate_action_imports/identity_recheck.rs` adds an opt-in disposable-copy audit harness.

## Disposable-data evidence

Source SQLite was opened using `mode=ro` and copied with SQLite's online backup API, including committed WAL contents. No source migrations, checkpoints, approval calls or EOD copying were performed.

Audit folder: `tmp/ca-verified-pair-audit-20261023-1920`.
Results: `verified-pair-results.json` in that folder.

The audit checked 39 previously machine-resolved, parsed/unresolved Dividends with persisted event-identity evidence. Production hint and Quick Resolve functions reconciled **35 to Pending**, leaving **4 unresolved**. The copy's Dividend candidate count increased from **7,847 to 7,882**. This is not a Ready count, a full Load & Validate result, or a source database change.

Sixty-three temporary triggers blocked writes to non-resolution tables, including canonical actions, instruments, history and evidence; three additional triggers blocked import insertion/deletion, approval fields, financial terms and raw identity rewrites. The successful run made **zero financial approvals**, preserved source symbol/ISIN values, and verified that recovered claims survive the current identity recheck. No price/EOD APIs were called.

The four retained unresolved rows are DELPHIFX events (IDs 20928, 22118, 24836 and 26670), with a longer chain containing DELPHIFX, EBIXFOREX and WEIZFOREX. They are outside the exact two-proof exception and require independent multi-step event-date reconciliation.

## Validation

- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml auto_id1 -- --nocapture`: 9 tests; the separate data audit is ignored by default.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml auto_id1_disposable_verified_rename_pair_audit -- --ignored --nocapture`, with `CA_VERIFIED_PAIR_AUDIT_ROOT` set only to the marked disposable folder: 1 test, 35 pending recoveries, 4 remaining, zero approvals.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml identity_recheck -- --nocapture`: 4 regression tests; the opt-in audit remains ignored in this command.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml dividend_policy_r1 -- --nocapture`: 19 tests, including read-only evaluation, current machine proof, official-witness requirements, cash/price basis and same-date peer exclusions.
- Total: 33 focused checks including the explicitly invoked disposable audit. Only the changed Rust snippets were rustfmt-formatted; existing unrelated formatting was preserved. Scoped code/docs whitespace checks passed.
- Compilation/linking for the focused Rust harness took approximately 30–37 seconds per changed-source run; this is not Load & Validate timing.

## Remaining work

The broad historical-ISIN problem remains evidence collection/reconciliation work. Do not promote the other thousands using undated history, a common ISIN prefix or approval-derived observations. The longer rename chain also remains unresolved.

Native rebuild, full Load & Validate, fresh Dividend readiness evaluation, approval and chart-refresh acceptance were not run in this task. The user's temporary source database was not modified. Existing unrelated working-tree changes were preserved; no commit or push was performed.
