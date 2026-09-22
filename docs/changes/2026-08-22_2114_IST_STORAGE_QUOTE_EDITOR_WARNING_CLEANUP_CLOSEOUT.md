# August 22 Storage, Quote Editor, and Warning-Cleanup Closeout

Date: 2026-08-22 21:14 IST (+05:30)

## Scope

This documentation-only record reconciles the maintained current authority against `Eod Charting Platform Source Code 2026-08-22_211417_IST` (uploaded ZIP SHA-256 `1A8F96F4BB339AE9FD1A7995F36A7D3CA4668244D3F3DC0772E6FE19D8ADC81D`). It records the accepted source/runtime boundary after Bhavcopy V1.5–V1.7D, final Rust warning cleanup, the rejected native Quote Editor window experiment, and the restored embedded Quote Editor runtime.

No production source, SQLite database, binary `.eod` file, sidecar, recovery session, schema, or Git state is modified by this reconciliation.

## Source identities

- `src-tauri-shell/src/bhavcopy.rs`: `FD88890A7D1A3598C6C4A326BABB541C6181D24D0D2AC8B4B039E38A0BE85849`
- `src-tauri-shell/src/bhavcopy_recovery.rs`: `88FF1F2A8A450373A01C431A5718831095F9509543A61F8CC446C8F6BE5B6E93`
- `src-tauri-shell/src/database/binary_eod.rs`: `1C8A4B4ED0DB8EFB21034F75DE7CEC92FA3E07345C524DEDE3D8F2CBA618A0C1`
- `src-tauri-shell/src/database/eod_binary_state.rs`: `32D3BE4886A68E0620C4E26E34F8F324C9A71967CA2A223C7C1D7A88A268E9A4`
- `src-tauri-shell/src/database/corporate_action_imports/event_identity_resolution.rs`: `4F42C2CEF771C197BFD19A655F8967DABCB3B62F984ECF8035E541D8A0A0A215`
- `src/RootApp.tsx`: `AE36B18D5C225A049799C9226F5800D987466290B65F5CB9467D5CDE91A9AC00`
- `src/components/DatabaseToolsDialogs.tsx`: `EC482AD356CA63F8486CEB0BD6C700B2B9031D78BC3696EB2A4C3F40F3DCC846`
- `src/main.tsx`: `7B4A118EECAB1E480A02354761D21095B5C6ACDDA2A53E9085FB568B55EEB4C1`
- `src-tauri-shell/src/main.rs`: `5C474F03C7BB19B202C61C87BD73CADAB2D1123F7011A1A8723A0E477808FD65`
- `src-tauri-shell/capabilities/default.json`: `B1582A1587DFC5B20ABDB35395317A4B89C4E17655DCC392B1E662C7D5B11525`

## Accepted storage architecture

### V1.5

Successful Quote Editor save/delete/date-range mutation invalidates matching `download_log` completion metadata. Zero-row operations preserve metadata.

### V1.6

Successful Quote Editor binary mutation removes only affected Generation-6 sidecar rows. Missing rows cause localized fallback rather than global unhealthiness. A durable Bhavcopy checkpoint incrementally publishes fresh VERIFIED rows without a generation rebuild.

### V1.7A

New/full-file writes cross explicit `sync_data()` before rename, including recovery-journal-buffered mode. Existing-file APPEND_NEWEST remains the only path allowed to defer physical sync. Checkpoint telemetry reports files, workers, verify/sync/publish durations, and sync p50/p95/max.

### V1.7B–V1.7D

The same-drive 1,000-file checkpoint benchmark measured worker counts 1/2/4 and favored 2 by median. Production checkpoint cap was changed to 2 (V1.7C). A genuine 8,783-file full-market run with 2 workers was slower than the earlier close 8,769-file four-worker run, so no guaranteed speedup is documented. V1.7D separately caps binary import/write at 2 while preserving read-only prefilter cap 4 and checkpoint cap 2. Next genuine trading-day runtime evidence remains pending.

## Runtime evidence

- 2026-08-20 forced refresh: 8,804 source rows; 8,802 distinct symbols; 33 new files; 8,769 APPEND_NEWEST; 33 immediate new-file sync calls; 8,769 deferred syncs; zero binary errors; checkpoint 132,580 ms with four workers.
- 2026-08-21 genuine download: 8,810 source rows; 8,806 symbols; 23 new files; 8,783 APPEND_NEWEST; 23 immediate new-file sync calls; zero binary errors; checkpoint 146,799 ms with two workers. Binary import still used four workers in that run; V1.7D changed it to two afterward.

## Quote Editor closeout

- Exchange selector defaults to ALL and supports ALL/NSE/NSE-INDEX/BSE/BSE-INDEX/reserved MCX.
- ALL-load status includes per-exchange counts and long table text is contained within columns.
- Quote mutation retains audit events, metadata invalidation, identity-preserving deletion, and localized sidecar invalidation.
- The separate native/taskbar Tauri child-window implementation was rejected after runtime review.
- Exact pre-change source was restored from the original backup; embedded-window RED→GREEN contract, exchange/filter tests, renderer typecheck/build, warning-free Rust compile, portable build, and manual smoke test passed.
- Accepted architecture is `FloatingWindow` inside the main EOD Chart renderer.

## Warning-clean closeout

Production `cargo check`, Rust test compilation, and Tauri compile check passed with `RUSTFLAGS=-D warnings`. The cleanup removed a redundant Bhavcopy diagnostics projection, an unused Corporate Action table alias, unused state renderers, and release-only bootstrap/census exposure while preserving test coverage and runtime behavior.

## Portable evidence

Post-rollback runtime-validation portable executable SHA-256: `7C3E92E77ABBAD314F795C73577AED453E4641E6EB9C557C689019F14091847B`. This is not yet the final post-documentation release hash.

## Current operational boundary

Read-only audit after runtime smoke testing:

- SQLite integrity: `ok`;
- schema version: 1;
- generation: 6;
- bootstrap: `COMPLETE`;
- sidecar rows: 24,535 VERIFIED / 0 DIRTY / 0 UNKNOWN;
- physical `.eod` files: 24,536;
- recovery sessions: 0;
- sidecar SHA-256: `9467D8828D6993CF237540FF023DE0D1A4B4E66962CCC795D1BAD996212D1BF6`.

The one-row physical/index difference remains pending exact key/cause identification. It must not be silently repaired or described as fully reconciled.

## Documentation result

Updated maintained current authority:

- `README.md`
- `REQUIREMENTS.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `HANDOFF.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`

`AGENTS.md` is intentionally unchanged because repository operating rules did not change. Historical change records remain immutable.
