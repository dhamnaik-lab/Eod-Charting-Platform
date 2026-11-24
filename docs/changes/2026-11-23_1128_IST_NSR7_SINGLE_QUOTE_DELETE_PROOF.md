# WP-02 / NS-R7 — Single-quote deletion coordination and absence proof

Recorded 23 November 2026 at 11:28 IST on local main at f78b034e91e2dd506d33ca0dd076f87c5eda6b9f. This follows the [quote-specific upsert intent](2026-11-23_1117_IST_NSR7_QUOTE_INTENT_RECOVERY_PROOF.md).

## Implementation

The [single-quote command](../../src-tauri-shell/src/database.rs) retains the database-use permit and the existing price-operation guard. Its [owner](../../src-tauri-shell/src/database/quotes.rs) persists the normalized exchange, symbol and trade date under the exclusive canonical lease before opening the writable connection. The versioned journal adds deletion intents alongside upserts and retains legacy interruptions. The existing mutation order is SQLite first, then binary removal, followed by existing metadata invalidation. Return counts and quote-only deletion semantics are preserved.

Before deletion, the owner captures instrument presence, the SQLite predecessor, and expected binary state. The proof requires the target row to be absent in SQLite and binary, preserves instrument presence and checks the SQLite predecessor and successor context. A sequential bounded-memory pass validates strictly ascending binary dates and hashes every retained record. The post-delete proof checks the expected file presence, identity, scale, record count and retained-record digest. This distinguishes a valid last-row file removal from an unexpectedly missing populated file. The proof reads an existing binary file up to twice and its latency on production histories remains unmeasured.

An interruption, unavailable proof or mismatch leaves the deletion intent pending. A successful matching retry may clear the identical prepared deletion intent after verification. Other pending operations remain in the journal. [Lease and journal](../../src-tauri-shell/src/database/database_use/canonical_access.rs).

## Verification

- Shared Cargo Preview and Run with `-CargoAction test -CargoArguments @('--bin','eod-charting-platform-shell','database::quotes','--','--nocapture')` — PASS, exit 0. 33 passed, zero failed, 1,453 filtered out. Cargo reported 1 minute 43 seconds for compile and link, 0.44 seconds for tests, and the existing dead-code warning in src/bhavcopy/calendar.rs:160. The wrapper took 168.92 seconds.
- The new fixtures proved busy rejection before the writable connection, last-row removal with preserved instrument identity, an already-absent retry, and a simulated interruption after SQLite commit. They rejected unexpected binary file loss and an unrelated binary record change and verified that a matching retry cleared the deletion marker. The existing upsert Windows subprocess interruption fixture also passed.
- The coordinator and its parent passed Rustfmt. The whole changed-file command still reports pre-existing formatter differences in database modules. File-local comparisons against the pre-edit backup found no new formatter differences in database.rs or quotes.rs. Documentation links and scoped whitespace checks passed.
- Backup: `backups/pre_opencode_changes_20261123_112010_nsr7-single-quote-deletion/`. Test log: `tmp/fixtures/nsr7-single-quote-deletion_20261123_112010/shared-cargo-single-delete.log`. No live database access, release build or Windows desktop acceptance ran.

## Next boundary

Design and enroll the remaining range and date-wide quote deletion owners with bounded intent coverage. Then enroll the other canonical writers before enabling full numeric paging. Existing range/date routing, V1 Scanner behavior, fallback, limits and CA-01 HOLD remain in effect.
