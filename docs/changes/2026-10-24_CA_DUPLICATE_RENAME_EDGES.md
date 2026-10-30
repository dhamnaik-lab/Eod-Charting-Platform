# Duplicate chart rename-edge handling

Date: 24 October 2026.
Backup: `backups/pre_opencode_changes_20261024_160847_ca_duplicate_chart_edges`.

## Cause and fix

The chart predecessor reader rejected two incoming persisted rows as ambiguity before distinguishing repeated observations of the same logical edge. The live CHEMBONDCH dividend was candidate 7,346 (batch 74 of 100-row batches). Its CHEMBONDIN -> CHEMBONDCH edge dated 2025-07-21 is stored twice, with matching ISIN and ticker fields but different descriptive old_name values. This exposed a regression introduced by the earlier multi-step chart routing change.

`src-tauri-shell/src/database/eod_data.rs` now groups incoming history by exchange, ISIN, current/old/new symbols, effective date and change type before applying the two-candidate ambiguity check. The minimum stored ID supplies a deterministic representative; descriptive company names and ingestion provenance do not create a second ticker edge. The in-memory chart history uses the same identity fields to suppress repeated transitions/markers. No persisted evidence is deleted or rewritten.

Different predecessors, dates, ISINs or other grouped identity fields still create separate candidates and remain blocked. Cycle, date ordering, exchange isolation and the 32-transition limit remain intact. Approval, canonical-action and raw-price behavior are unchanged.

## Validation

- PASS: first focused duplicate-edge unit test. The first real-copy run then failed because the initial grouping included company-name fields; read-only inspection exposed the old_name-only difference. The final implementation groups on ticker identity fields and adds name enrichment to the regression fixture.
- PASS: `cargo test --manifest-path src-tauri-shell/Cargo.toml database::eod_data::tests -- --include-ignored --nocapture`, with `CA_DUPLICATE_EDGE_AUDIT` explicitly set to the marked disposable folder: 14 tests, including the actual CHEMBONDCH case. Final compile/link took 38.34 seconds; execution took 0.04 seconds.
- PASS: scoped `git diff --check` for the changed Rust source.

The guarded local-data test opens `tmp/ca-duplicate-chart-edges-20261024/market-data.sqlite3` read-only. That file is a fresh online backup from the live source opened read-only. It confirms both stored evidence rows remain and exactly one logical transition resolves. Unit tests also verify that a contradictory row following several duplicates is not hidden by the query limit.

No source database edits, financial approvals, evidence deletion, canonical rewrite, commit or portable rebuild. The next step is one native rebuild with this fix and the session navigation-retention change, then verify report retention and completion of all 79 batches. This focused check does not certify the full live validation run. Historical witness collection/reconciliation for the four DELPHIFX imports remains separate.
