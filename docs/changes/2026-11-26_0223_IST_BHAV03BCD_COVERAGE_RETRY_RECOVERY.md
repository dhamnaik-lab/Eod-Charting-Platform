# BHAV-03BCD — Coverage, retry and historical recovery

IST: 2026-11-26T02:23:21+05:30

Status: AUTOMATED RUST PASS; DOCS PENDING; unpublished local candidate. Base: `08895661bfc9199e6b5b8553115b72bbfee8c685`.

## Objective and defects
Remove reliance on legacy success/count markers, the 31-date bypass and worker one-bar short circuit; retain missed dates and isolate malformed NSE Index price rows. Recover missing normal quotations without changing existing quotations.

## Files changed
- `src-tauri-shell/src/bhavcopy/coverage.rs`
- `src-tauri-shell/src/bhavcopy/coverage/tests.rs`
- `src-tauri-shell/src/bhavcopy/index_fallback.rs`
- `src-tauri-shell/src/bhavcopy/ingestion.rs`
- `src-tauri-shell/src/bhavcopy/mod.rs`
- `src-tauri-shell/src/bhavcopy/parsers/csv.rs`
- `src-tauri-shell/src/bhavcopy/tests.rs`
- `src-tauri-shell/src/database/binary_eod.rs`
- `HANDOFF.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- `docs/changes/2026-11-26_0223_IST_BHAV03BCD_COVERAGE_RETRY_RECOVERY.md`

## Implementation
- Additive, lazy `bhavcopy_coverage_v1` receipt table. Receipt SHA-256, SQLite identity, storage mode, exchange/date and decoded source archive digest bind expected admitted source members. Incomplete, corrupt or pending receipts cannot authorize skipping. Physical verification is windowed (31 calendar days per window, no bypass) with structural file checks and per-member comparison. Hybrid needs both stores. No fixed expected symbol count; this certifies admitted archive scope only.
- Automatic earlier retries: 90 calendar days, up to 10 earlier dates per exchange per run, oldest attempt first; 24-hour cooldown, seven-day cooldown for confirmed absence with a matching saved holiday. Explicit Date Range handles older history; plan messages include chosen dates and deferred counts. Preserve automatic cutoff, known special sessions, latest-attempt diagnostics and accepted calendar behavior.
- NSE Index daily safe-subset parser isolates bad price rows only after archive structure/date validation. Existing evidence folder retains quarantined raw rows/reasons and decoded digest. All-invalid or wrong-date input is rejected. Close-only rows remain unsupported; 12-series historical fallback remains a subset; existing alias-aware additive guard is retained.
- Normal batch and single NSE imports filter exact and conflicting existing rows before journal preparation. Normal recovery writes missing records only. Explicit forced repair keeps the existing separate path; no relaxation of index protection. Existing checkpoint and recovery lifecycle retained; pending receipts become eligible only on checkpoint completion and physical re-verification. Legacy counts may be reconciled only after validated source membership.

## Behavior preserved
Accepted BHAV-01/02/03A and RECOVERY-01A admission, logging, identity, durability, binary format, explicit repair and checkpoint contracts remain regression requirements. No new dependencies, frontend API changes, Corporate Actions or RECOVERY-01B implementation. New Database native acceptance is a separate authorized manual gate; original EOD DATABASE untouched and HOLD.

## Validation (actual Windows commands/results)
- PASS: rustfmt --edition 2021 --check all 8 changed Rust files.
- PASS: shared Cargo test bhav03bcd_: 8 passed, 0 failed, 0 ignored (filters overlap; not summed).
- PASS: shared Cargo test bhavcopy::: 201 passed, 0 failed, 4 ignored (filters overlap; not summed).
- PASS: shared Cargo test bhavcopy_recovery::: 19 passed, 0 failed, 0 ignored (filters overlap; not summed).
- PASS: shared Cargo test database::binary_eod::: 29 passed, 0 failed, 0 ignored (filters overlap; not summed).

## Limitations and risks
No native archive availability, full-market completeness or real database certification. Legacy dates without receipts may require re-acquisition; partial/fallback-only dates remain unresolved. Full structural validation and receipt storage add I/O/metadata overhead; benchmark on the real test database before acceptance. No separate recovery UI is introduced; existing plan messages and Date Range are the recovery interface. No release executable was built here. Verify candidate and all required regressions before publication.

## Rollback and evidence
Exact pre-edit backup: `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261126_020511_BHAV03BCD-20261126-020510-464228`. Restore only the approved edited paths from that backup and remove only the new candidate paths with owner authorization; do not delete databases, receipts, journals or evidence automatically. This candidate must not run on production. Evidence is staged under project `tmp` and zipped to Downloads; summary records SHA-256 for exact source payloads, validation transcript and protected files. No automatic rollback on a failed gate.

Final documentation gate: PASS.
