# V1.7A Parallel Test Isolation Fix

**IST timestamp:** 2026-08-25 16:21:56 +05:30 IST

## Objective

Remove intermittent V1.7A parallel-test interference without changing Binary EOD production durability behavior.

## Previous defect or limitation

P1 reproduced five parallel failure runs. The cfg(test) sync_data probe used one process-global AtomicUsize; tests independently reset and read that shared value. Parallel execution therefore allowed one test to erase another test's increment or to contribute extra increments.

Observed P1 failure modes included:
- existing-append probe expected 1 but observed 2 or 3;
- new-file probes expected at least 1 but could observe 0 after another test reset the counter.

## Files changed

- src-tauri-shell\src\database\binary_eod.rs

## Final implementation

- Added deterministic regression test v17a_sync_probe_counter_is_thread_local_across_test_threads.
- Replaced process-global cfg(test) AtomicUsize state with std::thread_local! Cell<usize>.
- Counter reset/read/increment operations are isolated to the invoking test thread.
- File::sync_data invocation and all release Binary EOD behavior remain unchanged.

## Validation commands and actual results

- Deterministic RED: expected failure confirmed.
- Deterministic GREEN: test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 369 filtered out; finished in 0.45s
- V1.7A explicit 8-thread stress: 12/12 attempts PASS, 5 tests each.
- binary_eod explicit 8-thread stress: 8/8 attempts PASS, 28 tests each.
- Full Rust explicit 8-thread stress: 3/3 attempts PASS.
- Full Rust default parallel: test result: ok. 369 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 62.70s
- Full Rust serial: test result: ok. 369 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 108.42s
- cargo check: PASS.

## Behaviour deliberately preserved

- Binary EOD file format and write paths.
- File::sync_data durability barriers.
- Immediate vs RecoveryJournalBuffered production semantics.
- V1.14X Corporate Action source and live database state.

## Risks or limitations

- Thread-local probe accounting is test-only and intentionally does not aggregate sync_data calls across worker threads.
- Current sync_data calls under test are synchronous on the invoking thread; if that architecture changes, the test instrumentation should be revisited.

## Rollback guidance

- Restore binary_eod.rs from E:\TA Projects\EOD Charting Platform\tmp\v1-7a-parallel-test-isolation-fix_20260825_162156_793\source-before\binary_eod.rs
- Pre-fix SHA-256: 1C8A4B4ED0DB8EFB21034F75DE7CEC92FA3E07345C524DEDE3D8F2CBA618A0C1
- Post-fix SHA-256: 1DD7CB201E7A7A514263E530426DD0C3C032FFE4ACDA9EA282CEED3F7D927397
