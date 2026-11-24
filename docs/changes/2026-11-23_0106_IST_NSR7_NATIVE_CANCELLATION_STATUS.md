# NS-R7 — Report native cancellation target counts accurately

Recorded 23 November 2026 at 01:06 IST. This is the first bounded WP-02 correction. Local `main`/HEAD was `f78b034e91e2dd506d33ca0dd076f87c5eda6b9f` with tree `645ad1216ffa264fb0f6068d147e47c7d50802c2`. The WP-01 adapter fix and SCAN-PERF-01 local results changes were present before work.

## Reproduction and cause

WP-01's real Windows cancellation run returned `targets=3, matched=0, noMatch=0, skipped=3, failed=0`. Rust classified all three targets as skipped before scanning. The renderer reused the target total as `scannedSymbols` when formatting the generic cancellation message. The displayed text was “Scan cancelled after 3 symbols; 0 matches recorded.” [WP-01 runtime evidence](2026-11-23_0100_IST_WP01_NATIVE_SCANNER_RUNTIME_PARITY_AND_PATTERN_WARNINGS.md).

With the same retained outcome, the corrected renderer produces “Native scan cancelled. Recorded 0 matches. 3 target symbols (3 skipped, 0 failed).” It uses the backend's terminal target, skipped, and failed counts and the count of records actually published. The regression covers early cancellation, mixed terminal counts, and singular wording. TypeScript, fallback, database-change cancellation without terminal counts, and completed native summary behavior were preserved. Existing backend cancellation, discarded partial results, Rust/IPC, alerts, opt-in, and the SCAN-PERF-01 table were preserved.

## Historical path scope

The Rust numeric-history branch loops over a contiguous interval from the maximum of the warm-up boundary and the trailing `MAX_HISTORY_ENDPOINTS = 1000` boundary. It does not stride over the interval. The current read window is at most 5,000 bars. Pattern-only All History with an omitted lookback uses a separate paged branch with overlap for context and shared grouping across pages. The Scanner still routes built-in Core and Daily Market All History to TypeScript as a whole run. These are source observations. Historical endpoint changes and acceptance above 1,000 and 5,000 endpoints remain separate WP-02 work.

## Validation

- `node replay.mjs` — PASS, exit 0. Bundled the exact pre-edit and corrected renderer formatter and replayed the retained native Windows outcome. Both status strings were asserted. Evidence `tmp/NSR7_CANCELLATION_20261123_010431/cancelled-runtime-replay.json`.
- Focused `npm.cmd test -- src/plugins/scanner/__tests__/nativeCoreLatestRoutingNSR2.test.ts src/plugins/scanner/__tests__/nativeScannerRunNS04.test.ts src/components/__tests__/ScannerResultsPagination.test.tsx` — PASS, 41 tests in 3 files, exit 0.
- `npm.cmd run typecheck:renderer` — PASS, exit 0.
- `npm.cmd test` — PASS, 2,172 tests passed and 1 skipped, exit 0.
- `npm.cmd run build:renderer` — PASS, exit 0, 5.75 s.
- Documentation reference and whitespace checks, exact tested-source verification, and preservation checks are recorded in `tmp/NSR7_CANCELLATION_20261123_010431/`.

The renderer commands ran on isolated source using the installed dependencies. No database data was opened, and the runtime replay used retained outcome metadata. No Rust compilation or portable build was required for this renderer-only correction. There is no new Windows portable UI acceptance for the revised status.

## Files and rollback

Changed `src/plugins/scanner/nativeScannerRun.ts`, its status regression tests in `nativeCoreLatestRoutingNSR2.test.ts`, the root handoffs, and the [living roadmap](../plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md). Corrected the truncated WP-01 backup directory reference in its record and handoff. The pre-edit backup is `backups/pre_opencode_changes_20261123_010431_nsr7-cancellation-status/`. With approval, reverse this correction and its new expectations against that backup. Keep the WP-01 pattern warnings change and pre-existing local documentation.

This cancellation correction is closed. WP-02 remains open for separately approved history and operational work. The next bounded review should establish what is reachable through current routing, then verify endpoint continuity across the 1,000-endpoint and 5,000-bar boundaries before changing behavior.
