# WP-02 / NS-R7 — Quote-specific intent and recovery proof

Recorded 23 November 2026 at 11:17 IST on local main at f78b034e91e2dd506d33ca0dd076f87c5eda6b9f. This implements the next boundary in the [quote coordinator validation record](2026-11-23_0258_IST_NSR7_QUOTE_MUTATION_COORDINATOR.md).

## Implementation

- Before opening the writable connection, quote upsert holds the per-database lease and persists a versioned intent with normalized exchange, symbol, trade date, exact SQLite OHLC bits, volume and open interest. Before mutating the quote, it records the SQLite predecessor context when the binary file is absent or has a validated identity, length and expected scale. A file with an unsafe initial scale leaves the intent unprepared because changing its scale header can affect more than the edited row. [Quote owner and verifier](../../src-tauri-shell/src/database/quotes.rs).
- The completion check reads the exact SQLite values, verifies predecessor identity and value and the next SQLite row's previous close, then compares the single exact-date binary record against the writer's encoding at the validated identity and scale. It clears the completed intent under the same exclusive lease only after verification. A retry may clear an identical prepared intent after the same proof. Different targets, values, or contexts remain pending. The existing SQL-success result when the binary write fails is preserved.
- The bounded journal retains unresolved intents and preserves legacy database-wide interruption markers. It refuses an oversized or unknown state file and stops applying new quotes at 256 unresolved entries. The read-only recovery entry point is exercised by fixtures. No recovery command, automatic price repair, Scanner read admission or full paging was exposed. [Coordinator](../../src-tauri-shell/src/database/database_use/canonical_access.rs).

## Verification

- Shared Cargo Preview and Run with `-CargoAction test -CargoArguments @('--bin','eod-charting-platform-shell','database::quotes','--','--nocapture')` — PASS, exit 0. 31 passed, zero failed, 1,453 filtered out. Cargo reported 1 minute 50 seconds for compile and link, 0.44 seconds for tests and the existing dead-code warning in src/bhavcopy/calendar.rs:160. The wrapper took 172.25 seconds.
- The tests exercised cross-process contention and interruption after SQLite commit, an unrelated successful edit, SQLite and binary same-date value mismatches with unchanged counts and date ranges, exact matching before marker clearance, an unsafe initial binary scale, and legacy marker preservation.
- Canonical Rustfmt — coordinator and parent PASS. The full changed-file check still reports pre-existing quote file formatting. A comparison with the pre-edit backup found no new quote formatter differences. Documentation links and scoped whitespace checks passed.
- Backup: `backups/pre_opencode_changes_20261123_110817_nsr7-quote-recovery-proof/`. Test log: `tmp/fixtures/nsr7-quote-recovery-proof_20261123_110817/shared-cargo-quote-recovery.log`. Retained Windows interruption fixture: `tmp/fixtures/nsr7-quote-recovery-proof_20261123_110817/.tmpNIsPdo/`. No live database, release build or desktop acceptance ran.

## Next boundary

Enroll the single-quote deletion path under the canonical mutation lease and define a proof of exact absence in each applicable store, preserving the instrument record and quote-only behavior. Extend that work to range/date deletions and the remaining writer families before enabling full history. Keep legacy markers and unprepared or ambiguous intents blocked pending reviewed reconciliation. Scanner V1, fallback, limits and CA-01 HOLD remain in effect.
