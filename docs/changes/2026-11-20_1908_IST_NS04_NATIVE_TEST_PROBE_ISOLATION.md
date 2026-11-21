# NS-04 — Native scanner test-probe source isolation

- **IST:** 2026-11-20 19:08:23
- **Active root:** E:\TA Projects\EOD Charting Platform
- **Source authority:** PR #124 at f3cd2d99384d6c80e0fbb138e0236db7c520fb64
- **Status:** Windows automated validation PASS; PR publication, corrected-head CI, portable build and manual acceptance remain pending.

## Objective and previous defect

The Windows cargo test native_scanner run completed 100 tests and failed 1 at
src/native_scanner/database_source.rs:73 with attempt to add with overflow.
Test-only process-global ACTIVE_READS and MAX_ACTIVE_READS counters could be
reset by the concurrency test while an independent fixture's read was active.
A subsequent decrement underflowed the global counter, then another increment overflowed.
This is a test-state isolation problem; the failure alone does not establish a production
corporate-action calculation defect.

## Files changed

- src-tauri-shell/src/native_scanner/database_source.rs: move probe atomics to each
  ReadOnlyDatabaseSource instance under #[cfg(test)], preserving test instrumentation.
- src-tauri-shell/src/native_scanner/tests.rs: configure and inspect the probe through
  the owning source; add an isolation regression without production data.
- HANDOFF.md and NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md: checkpoint.
- This change record.

## Preserved behavior

Production compiled code excludes probe state; connection cache/locking, read-only
access, worker concurrency, scanner output, native default-OFF routing, TypeScript
fallback, CA-01 HOLD and raw .eod immutability are unchanged. No dependencies added.

## Windows validation closure — 2026-11-20

**Evidence basis:** Actual user-run Windows PowerShell 7 output captured 20 November 2026 IST.
The uploaded console-log SHA-256 is `6969596BF638A9CFA64351FAFA4AAF8A7533B6FAE671F93003F014BDFB04CFEC`.
The transcript is evidence from the user, not a command executed by ChatGPT against the Windows checkout.

| Validation | Actual outcome |
|---|---|
| Post-format `rustfmt --edition 2021 --check` (both changed Rust files) | PASS |
| Local source/runner structural checks | PASS |
| BUILD-01 `cargo check --offline --locked --tests`, shared root `target` | PASS |
| `cargo test ... p1_08_test_probe_counters_are_isolated_per_source` | 1 passed, 0 failed |
| `cargo test ... native_scanner` | 102 passed, 0 failed |
| `cargo test ... native_selection_revision_tests` | 2 passed, 0 failed |
| Full `cargo test --offline --locked` | 1,417 passed, 0 failed, 33 ignored |
| Focused Vitest scanner parity and NS-04 integration | 74 passed, 0 failed, 2 files |
| Renderer `npm run typecheck:renderer` | PASS |
| `scripts/check-doc-references.ps1` | PASS |
| Renderer production build, Windows portable build and manual disposable-database UI acceptance | NOT RUN |
| Publication to GitHub PR #124, corrected-head CI, merge | NOT PERFORMED |

The formerly failing `ca01_native_source_rejects_duplicate_and_conflicting_bse_settlement_actions`
test passed inside the regular 102-test native scanner suite and the full Windows Rust run.
The warning that `create_holiday_skip_result` is unused in `src/bhavcopy/calendar.rs` was non-blocking
and remains outside this bounded correction.

**Preservation:** Production native execution, default-OFF routing, TypeScript fallback,
CA-01 raw-only HOLD, database ownership and adjustment behavior, raw `.eod` bytes,
the four previously protected local change groups and original `main` remain unchanged
by this test-only correction. Windows portable/manual acceptance remains a separate gate.

**Publication boundary:** The original 32-file gate is pinned to the pre-fix PR head and
must be regenerated against a newly verified corrected commit before reuse. Do not claim
PR #124 accepted or merged from these local tests alone.

## Risks, rollback and evidence

The local fix changes only test instrumentation and test cases. Rustfmt and the
complete Windows test suite passed on 20 November 2026. If subsequent checks fail, preserve all
files and the backup rather than resetting the worktree. Rollback only this bounded
change from the scoped backup after explicit authorization and hash verification.
Do not modify production databases or mark PR #124 accepted or merged.

**Evidence finalized (IST):** 2026-11-20 19:54:42. The locally modified source SHA-256 values and scope are recorded in the validation evidence manifest under tmp/fixtures/pr124-probe-finalization/.
