# Source-backed event-time price routing — 25 October 2026

## Implemented contract

Added `CA_EVENT_PRICE_ROUTE_R1`, a read-only stable-full-ISIN fallback for NSE official Dividend/Split/Bonus/Rights price windows. It supplements a missing/invalid ordinary requested-symbol/trusted-history window; it does not replace the existing identity-mismatch R1 contract or convert source retention into identity migration.

Proof requirements:

- Official HTTPS symbol-change CSV; bounded source size, retained-byte SHA-256 recheck and capture metadata. Parsed graphs are cached by content hash (four entries per thread); authority is not cached.
- Unique, acyclic, strictly dated whole-component chain, supporting single and multiple edges. Only identical CSV edges are deduplicated. Branches, merges, cycles, reused symbols and conflicting chronology are refused.
- Canonical full ISIN at every local chain member, no same-ISIN instrument outside the dated chain, matching current context, and an exact fresh official event witness matching raw symbol/event symbol, ISIN, event date, action, purpose and record date. Backfill-only, conflicting or missing evidence remains blocked. Dated source plus exact independent event evidence can substantiate stale active aliases; no active flags are changed.
- Cum/ex-date bars must be finite positive prices in the permitted seven-day window, taken strictly from the symbol valid on each bar's date. A wrong-date alias file cannot fill a gap. A verified rename-day boundary may use the old cum-date symbol and new ex-date symbol.
- Proof fingerprint binds database path, import/event inputs, retained source hash/ID, official witness, chain and selected price basis. It is freshly rebuilt in the guarded writer. Dividend audit identity text and canonical note retain the fingerprint.

The normal scanner supplements only missing legacy windows for complete matching stored imports, preserving its existing historical event-symbol contexts. Missing route identity proof, missing actual trading bars and upcoming dates remain distinguishable reasons. The Dividend policy uses the same routed previous close; the official writer independently recomputes Dividend/Rights factors from that verified basis. Manual adjustment behavior and existing math remain unchanged. Non-price/unsupported action handling remains on its previous path.

No new IPC, automatic approval, proof override, instrument merge/deactivation, live identity migration, source rewriting or raw EOD mutation was introduced. Fetch/Load remain non-financial; deliberate confirmation and the existing transaction owner are mandatory.

## Actual-price disposable-copy audit

The earlier triage identified 91 potential cases across 13 symbols. A fresh SQLite online backup and 43 relevant price files were placed in the exact marked folder `tmp/ca-event-price-route-20261025-r1`. Neither the production writer nor its factor loader received the live database/price folder.

| Symbol | Candidate events | Route verified | Dividends eligible and simulated |
|---|---:|---:|---:|
| DIGISPICE | 6 | 6 | 5 |
| GUJENERGY | 12 | 12 | 10 |
| HEGAM | 19 | 19 | 18 |
| ONIDA | 3 | 3 | 3 |
| Other nine symbols | 51 | 0 | 0 |
| Total | 91 | 40 | 36 |

All 36 eligible dividends passed the real transaction-owned writer on the copy, zero writer failures, followed by a deliberately forced outer rollback. Every copied main-table content hash was unchanged afterward. All 43 original and copied price-file hashes matched their preparation hashes. Both instrument-active flags and identity histories were preserved.

The other four routed events comprise two unsupported/qualified cash wordings and two Splits. Split financial approval was not exercised in the real-data audit; a valid price route alone does not waive Split price-validation gates. Among the 51 without new route admission, full-ISIN and machine-identity blockers remain (some policies stop earlier on independent cash/same-date-peer gates). Do not treat this as all 91 Ready, all symbols repaired, or an exhaustive BSE audit.

HEGAM import 44439 (July 22, 2026, Rs 3.40) passes. During the rolled-back simulation, the production chart context sees the new canonical event and HEG's July 21/22 raw bars. Applying that event's factor through production chart adjustment code changes the pre-event close and leaves the ex-date close unchanged. This is backend/chart-code acceptance, not native UI/cache-refresh acceptance.

Receipts: `tmp/ca-event-price-route-20261025-r1/manifest.json`, `acceptance.json` and final-code repeat `acceptance-final.json`. Final repeat PASS: the same 36 simulated approvals, zero failures, forced rollback and all hash guards; execution 140.64 seconds excluding compile/link. Neither receipt can be overwritten by the test.

## Focused validation

Serial Rust checks passed:

- `auto_approval::write_stage_tests`: final repeat 51 passed. Nine new routing tests cover active aliases, raw-date boundaries, multi-step chains, deduplication, branches/cycles, tampered source after a cache hit, event/record-date witnesses, competing identity, full-ISIN mismatch, missing/wrong-symbol prices, future dates, factor binding and non-Dividend gate preservation.
- `dividend_policy_r1`: 22 passed.
- `dividend_prepared_scope_r1`: 11 passed.
- `dated_chain`: 9 passed, unrelated opt-in audit ignored; the old narrow proof contract is unchanged.
- `simple_cash_dividend_transaction_owner_tests`: 27 passed.
- `scan_candidate`: 2 passed; `phase1_scanner`: 2 passed; `r1b3a1`: 10 passed (one overlaps `scan_candidate`).
- `instrument_mutations::tests`: 19 passed, including existing adjustment math and transaction behavior.
- Explicit `event_price_route_guarded_copy_acceptance -- --ignored --nocapture`: PASS, 36 simulated approvals, zero failures, forced rollback and hash checks; initial audit execution 90.32 seconds, excluding compile/link.

PASS: 43 frontend tests in DividendExplicitApprovalR1, DividendPreparedScopeOrchestration and DividendWriteStageOrchestration using the explicit `tmp/**` exclusion. UI/DTO types were not changed. No full validation profile, broad Rust suite, installer or portable build was run. Initial compilation found two ordinary type errors; corrected, then focused tests passed.

PASS: scoped whitespace and rustfmt checks for the two new Rust modules. Existing dirty work was preserved; no repository-wide formatting was applied. Backups: `backups/pre_opencode_changes_20261025_022406_ca_event_price_route` and `backups/pre_opencode_changes_20261025_022531_ca_event_price_route_tests`.

## Files and remaining work

Runtime: new `corporate_action_imports/event_price_route.rs`; focused integration in `corporate_action_imports.rs`, `auto_approval.rs`, `dated_symbol_chain.rs` and `instrument_mutations.rs`. Tests: `auto_approval/write_stage_tests.rs` and opt-in `auto_approval/event_price_route_copy_tests.rs`. Copy preparation: `outputs/prepare-event-price-route-copy-20261025.py`.

No live approvals, identity changes or price changes were made. After a user-controlled rebuild, a fresh Load & Validate can consume the retained evidence without a mandatory refetch. Native workflow/one deliberately selected approval/chart-cache refresh remains deferred. Remaining identity/ISIN cases need separate evidence-backed work; the BSE master-collection issue is unchanged.

## Subsequent user native evidence — 25 October 2026

The no-live-write/deferred statements above describe the implementation audit.
Later user-supplied screenshots show HEGAM's 22 July 2026 Rs 3.40 Dividend Ready,
one action explicitly confirmed, 1/1 committed, and import 44439 saved as the newest
approval at 25 October 2026 17:43:54 IST. The native HEGAM chart displays its Rs 3.40
dividend marker. This establishes selected native approval, saved history and chart
event visibility. It does not independently verify live raw-price hashes or the
July 21–22 adjusted/unadjusted price values. The September Demerger and the Split
were not exercised by this test. Later queue-refresh acceptance is recorded in
[the targeted-refresh record](2026-10-25_CA_POST_APPROVAL_QUEUE_REFRESH.md).
