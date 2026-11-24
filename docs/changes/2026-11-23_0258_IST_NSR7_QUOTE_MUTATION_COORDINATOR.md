# WP-02 / NS-R7 — Per-database coordination for quote upsert

Recorded 23 November 2026 at 02:58 IST on local main at f78b034e91e2dd506d33ca0dd076f87c5eda6b9f. This implements the coordinator and representative dual-store writer selected in the [canonical-read audit](2026-11-23_0238_IST_NSR7_CANONICAL_READ_CONSISTENCY.md).

## Implementation

- The [coordinator](../../src-tauri-shell/src/database/database_use/canonical_access.rs) keys an OS file lock by the physical database directory identity in the existing safety-state namespace. On Windows it uses the same volume and file identity mechanism as the deletion code. The lock file is separate from a versioned state marker. Mutation entry is nonblocking.
- The [quote upsert command](../../src-tauri-shell/src/database.rs) retains its existing database-use permit and in-process price-store operation lock. Its [owning quote function](../../src-tauri-shell/src/database/quotes.rs) validates the input and binary path, then begins coordination before opening the writable connection. It holds the lease across bootstrap, the SQLite transaction, the binary write and binary-state invalidation.
- A clean or new coordinator writes durable intent before mutation. Dual-store success clears only the intent created for that operation. A crash or binary error leaves intent present after lock release. The legacy SQL-success result on a binary error is preserved. A later successful quote upsert leaves a prior interruption marker in place. Opening or reading an unavailable coordination state can now fail before the writable connection is opened.
- A shared read lease is available to fixtures. Scanner V1, the quote delete paths and other writer families retain their existing behavior. The marker currently quarantines the database as a whole for future full paging. There is no production recovery command or reader admission for that capability.

## Verification

- Shared Cargo: Preview and Run PASS on retry. 11:00 IST, 23 November 2026. The focused database::quotes filter ran 29 tests with zero failures and 1,453 filtered out. Compile and link took 1 minute 6 seconds, test execution took 0.28 seconds, and the wrapper took 131.27 seconds. The only compile warning was the existing dead-code warning in src/bhavcopy/calendar.rs:160. The logs are in shared-cargo-quote-retry-20261123_105801.log and the retained fixture is in .tmpbLOC3m under the evidence directory below.
- The Windows child process was refused before it could open a writable connection while a shared read lease was held. After release it committed SQLite and exited before writing the binary quote. The test verified the missing binary row and persistent read refusal, including after a later successful upsert. The separate corrupt-file fixture retained SQLite success and kept the interruption marker. Existing quote deletion and binary-state invalidation tests passed.
- Canonical `rustfmt --edition 2021 --check` on all changed Rust files — FAIL on pre-existing formatting, including `database.rs`, `quotes.rs` and recursively included database modules. The coordinator and its parent pass the canonical check. File-local comparison with the pre-edit backup using `skip_children=true` found zero new formatter differences. No unrelated formatting was changed.
- Documentation references and scoped whitespace — PASS.
- Backup: `backups/pre_opencode_changes_20261123_024923_nsr7-quote-coordinator/`. Evidence directory: `tmp/fixtures/nsr7-quote-coordinator_20261123_024923/`. No live database access, portable build or desktop acceptance ran.

## Next boundary

The current durable marker records database-wide interruption and does not identify the target quote. The existing binary parity check compares counts and date ranges and performs no value-level check even with its deep-check option. Both limits matter for upserts on an existing date. A successful retry on one quote cannot clear an older database-wide interruption safely. [Parity checker](../../src-tauri-shell/src/database/binary_eod.rs) · [Marker](../../src-tauri-shell/src/database/database_use/canonical_access.rs).

The next implementation boundary is a versioned quote-specific intent and read-only recovery proof under the exclusive lease. Record normalized exchange, symbol and trade date and enough before/after evidence to identify the actual quote values in both stores, including scaling and any affected predecessor context. Preserve unresolved intents and keep legacy database-wide markers blocked pending reviewed reconciliation. Verify exact values before clearing a marker and fail closed on missing, mismatched or ambiguous rows. Leave price repair to an explicit reviewed action. After this boundary, enroll quote deletion and the remaining canonical writers, and verify lease deadlines and contention before extending scanner IPC. The V1 limits, routing, fallback, pattern paging and CA-01 HOLD remain in effect.

Validation documentation backup: backups/pre_opencode_changes_20261123_110015_nsr7-quote-coordinator-validation/.
