# V1.14AD R1B-R1 Watchlist Deterministic Test Timeout Reliability

IST timestamp: 2026-08-30 19:02:38 IST

## Objective
Remove the unintended five-second wall-clock assumption from the single Official Watchlist deterministic generation regression test while preserving the generator contract, Watchlist split architecture, Corporate Action source, Rust source, and all other current behavior.

## Previous defect or limitation
R1A passed renderer typecheck/build, Watchlist build preservation, Cargo metadata, four V1.14AD Rust tests, all old-baseline sentinels, the full Rust suite (375 passed / 0 failed / 1 ignored), and Cargo check. Full Vitest reached 631 passed / 1 failed only because regenerates deterministic byte-identical outputs took 7783 ms and exceeded Vitest's default 5000 ms timeout.

The first R1B operator stopped before creating a run directory because it incorrectly required this Watchlist split regression test to be tracked by Git. That contradicted the already-approved latest-source model: the verified source snapshot and exact build-relevant subset include source files regardless of Git tracking status. R1B-R1 removes only that invalid operator precondition and strengthens the snapshot-target hash guard.

## Files changed
- src/features/watchlists/__tests__/officialWatchlistDataSplit.test.ts
- No production source, generator, Vite/global Vitest configuration, Cargo/Rust file, production database, or Git index change.

## Final implementation
Only the deterministic-generation test invocation changed; its body is preserved and receives an explicit 15_000 ms timeout. File SHA-256 changed from BB7AE1AEBB19534DFAAB7BEC29ABA8E4C2F0F7088BE2A625CA3D5AFBD4CE6CFB to 5F2E5BA604E671A7748BD69C7020557CE3D9FB9748CB8ACD23CA00263EF1034A. The build-relevant source subset changed only at that test file and is locked at 508 files / 12758223 bytes / 9832CB8F74F3E404A52253A9CD073EDA63647C7C576AA6B32FF40B9A1FCDF71D.

## Validation commands and actual results
- npm ci --no-audit --no-fund: exit 0
- focused Watchlist split attempts: 0, 0, 0
- focused three-run signatures clean: True
- full npm test: exit 0
- exact 632-pass full Vitest signature: True
- npm run typecheck:renderer: exit 0
- npm run build:renderer: exit 0
- Watchlist build-preservation gate: exit 0
- candidate post-validation integrity: exit 0
- live exact one-file integrity: exit 0

Rust was deliberately not rerun because R1A already validated the same latest-source Rust tree before this test-only TypeScript change: 375 passed / 0 failed / 1 ignored and Cargo check exit 0.

## Fresh latest-source authority
- snapshot created: True
- snapshot path: E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-30_191107_IST
- snapshot build-relevant verification exit: 0
- snapshot error, if any: 

## Behavior deliberately preserved
The split generator, canonical Watchlist inputs, generated data, lazy loading, Vite manual chunk partitioning, Corporate Action implementation, bhavcopy/bootstrap fixes, Vitest tmp exclusion, all Rust behavior, package manifests, and production database behavior are unchanged.

## Risks or limitations
The 15-second value is test-scoped and does not alter the global Vitest timeout. A future substantial generator slowdown can still surface as a real test failure. Portable Windows packaging was not performed in R1B.

## Rollback guidance
Restore the single test file to SHA-256 BB7AE1AEBB19534DFAAB7BEC29ABA8E4C2F0F7088BE2A625CA3D5AFBD4CE6CFB from E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-08-29_233003_IST. No other source rollback is required.

## Final classification
R1B_WATCHLIST_TIMEOUT_VALIDATED__FRESH_LATEST_SOURCE_AUTHORITY_CREATED__READY_FOR_CONTROLLED_CA_STAGING