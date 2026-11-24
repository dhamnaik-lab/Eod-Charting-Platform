# NS-R7 — Report evaluated numeric history coverage through desktop IPC

Recorded 23 November 2026 at 01:42 IST. The user approved bounded coverage reporting for the existing direct desktop numeric-history route. Local `main` and HEAD were `f78b034e91e2dd506d33ca0dd076f87c5eda6b9f` with tree `645ad1216ffa264fb0f6068d147e47c7d50802c2`. [Earlier contract review](2026-11-23_0127_IST_NSR7_NATIVE_NUMERIC_HISTORY_CONTRACT.md).

## Correction

Before the change, a native numeric history completion reported matched, no-match, skipped and failed targets without the evaluated dates. The executor can read a bounded window and omit earlier eligible endpoints even when the target outcome is successful. The new optional `numericHistoryCoverage` field on the existing V1 completion event contains:

- Per successful target, the exchange, symbol, first and last input dates, number of loaded bars, and an `olderInputUnknown` flag. The flag is true when the effective read window filled. An exactly full window is indistinguishable from one with older bars outside it.
- Per numeric rule with completed history evaluation, the first and last evaluated dates, endpoint count and number of eligible endpoints omitted **within the loaded window** by the existing cap. Warm-up bars do not count as omitted endpoints. A no-match evaluation contributes to the evaluated count.
- No coverage for a failed or skipped target, an unevaluable rule, or a run that was cancelled or rejected after a database-selection change. Mixed requests report numeric coverage only. Latest-only and pattern-only completion events retain their previous JSON shape.

Rust captures the range from the actual successful endpoint loop. The shared completion emitter serializes it and continues to send the existing diagnostics and target counts. The TypeScript event contract accepts the optional field. The existing bridge forwards valid V1 events by run and sequence and the Scanner adapter continues to consume its existing fields. The 1,000-endpoint cap, 5,000-bar read window, 32-rule limit, fallback, opt-in, CA-01 HOLD, results, alert and cancellation behavior were preserved. No new user-visible numeric history mode was added.

For a 1,001-bar input and an immediately evaluable rule, the report distinguishes 1,001 loaded bars, 1,000 evaluations, and one omitted eligible endpoint. A rule requiring two bars on the same input can report the same evaluation dates with zero omissions. This range describes the actual input and evaluation. It does not certify history outside the loaded bars.

## Verification

Focused Rust tests cover ordinary and capped dates, the actual input date range, unknown older input at the full window, per-rule warm-up, an as-of cutoff, failed targets, skipped/warm-up cases, legacy completion decoding, additive V1 JSON and coverage suppression after cancellation. The earlier pattern-seam regression verifies that pattern-only execution produces no numeric coverage.

- `rustfmt --edition 2021 --check` on `scan.rs`, `job.rs` and `ipc.rs` — PASS, exit 0.
- Shared Cargo Preview and Run with `-CargoAction test -CargoArguments @('--bin','eod-charting-platform-shell','native_scanner')` — PASS, 128 passed, 0 failed and 1,348 filtered out. Run exit 0.
- Shared Cargo Preview and Run with `-CargoAction check` — PASS, Run exit 0. Cargo reported 25.37 seconds and the existing dead-code warning in `src/bhavcopy/calendar.rs:160`.
- `npm.cmd test -- src/features/scanner/__tests__/nativeScannerParityNS01.test.ts src/plugins/scanner/__tests__/nativeCoreLatestRoutingNSR2.test.ts src/plugins/scanner/__tests__/nativeScannerRunNS04.test.ts` — PASS, 117 focused tests in three files, exit 0.
- `npm.cmd run typecheck:renderer` — PASS, exit 0.
- `npm.cmd test` — PASS, 2,172 passed and 1 skipped, exit 0.
- `npm.cmd run build:renderer` — PASS, exit 0, 6.46 seconds.
- Reference, whitespace and source preservation checks are recorded in the evidence folder. The renderer commands ran in an isolated copy.

Validation used deterministic executor/job fixtures. No Windows portable build, live database read, production-data test or new desktop manual acceptance ran. A completion payload can grow with the number of eligible targets and rules. The maximum-size IPC payload has not been measured.

## Files and rollback

Changed `src-tauri-shell/src/native_scanner/{scan,job,ipc}.rs` and `src/features/scanner/nativeScanContract.ts`. Updated the two handoffs, architecture and living roadmap. Evidence logs and SHA-256 manifests are located under `tmp/NSR7_NUMERIC_COVERAGE_20261123_013056/`. The pre-edit backup is `backups/pre_opencode_changes_20261123_013056_nsr7-numeric-coverage/`. With approval, reverse only the evaluated-range reporting and associated tests/docs. The Rust backup already contains the previously accepted endpoint-continuity tests.

This reporting correction is closed. A full native numeric history contract, any Scanner UI exposure, and remaining NS-R7 operational work are separate decisions.
