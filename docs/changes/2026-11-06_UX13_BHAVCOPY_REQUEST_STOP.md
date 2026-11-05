# UX-13 — Bhavcopy cooperative Request Stop

6 November 2026 (IST). The original batch download lacked an operator stop that could preserve completed work safely. [PR #23](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/23) merged accepted head `c660f6383683cf7d51ed2cbf6bdfb84f76d46b08` into main at `09d20595bdc2ccbb6f11320fea3caf32c606c940`.

## Accepted behavior

- During staging, the tracked run accepts a stop for its matching run ID. Workers cease taking queued jobs, finish admitted source operations and join. The run can exit before remaining parsing or journal preparation.
- The UI shows **Stopping...** after acknowledgement. During import, admitted writes finish through their existing journal and recovery boundary. Later admissions stop. Worker, checkpoint and durability policy remain in force.
- Cancellation reports completed successes, skips and actual imported rows. Prior successful download logs survive staging and failed replacements. Results can be reopened, and a later run can proceed.
- The accepted NSE index fallback remains additive, with twelve supported indices and separate incomplete coverage reporting. Admitted writes follow the same recovery boundary. A stop can skip later fallback imports.

## Changed files

The merge diff contains these 31 paths, including fallback fixtures and documentation reconciliations.

- [ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md](../../ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md)
- [FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md](../../FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md)
- [REQUIREMENTS.md](../../REQUIREMENTS.md)
- [src-tauri-shell/src/bhavcopy/batch_runtime.rs](../../src-tauri-shell/src/bhavcopy/batch_runtime.rs)
- [src-tauri-shell/src/bhavcopy/bse_browser_fallback.rs](../../src-tauri-shell/src/bhavcopy/bse_browser_fallback.rs)
- [src-tauri-shell/src/bhavcopy/index_fallback.rs](../../src-tauri-shell/src/bhavcopy/index_fallback.rs)
- [src-tauri-shell/src/bhavcopy/index_fallback/fixtures/finnifty-20260525-20260529.json](../../src-tauri-shell/src/bhavcopy/index_fallback/fixtures/finnifty-20260525-20260529.json)
- [src-tauri-shell/src/bhavcopy/index_fallback/fixtures/midcap-select-20260525-20260529.json](../../src-tauri-shell/src/bhavcopy/index_fallback/fixtures/midcap-select-20260525-20260529.json)
- [src-tauri-shell/src/bhavcopy/index_fallback/fixtures/midcap100-20160708-20160715.json](../../src-tauri-shell/src/bhavcopy/index_fallback/fixtures/midcap100-20160708-20160715.json)
- [src-tauri-shell/src/bhavcopy/index_fallback/fixtures/midcap150-20260525-20260529.json](../../src-tauri-shell/src/bhavcopy/index_fallback/fixtures/midcap150-20260525-20260529.json)
- [src-tauri-shell/src/bhavcopy/index_fallback/fixtures/nifty500-20110103-20110107.json](../../src-tauri-shell/src/bhavcopy/index_fallback/fixtures/nifty500-20110103-20110107.json)
- [src-tauri-shell/src/bhavcopy/index_fallback/fixtures/nse-indices-20261103.csv](../../src-tauri-shell/src/bhavcopy/index_fallback/fixtures/nse-indices-20261103.csv)
- [src-tauri-shell/src/bhavcopy/index_fallback/fixtures/smallcap100-20160708-20160715.json](../../src-tauri-shell/src/bhavcopy/index_fallback/fixtures/smallcap100-20160708-20160715.json)
- [src-tauri-shell/src/bhavcopy/index_fallback/fixtures/smallcap250-20260525-20260529.json](../../src-tauri-shell/src/bhavcopy/index_fallback/fixtures/smallcap250-20260525-20260529.json)
- [src-tauri-shell/src/bhavcopy/index_fallback/tests.rs](../../src-tauri-shell/src/bhavcopy/index_fallback/tests.rs)
- [src-tauri-shell/src/bhavcopy/ingestion.rs](../../src-tauri-shell/src/bhavcopy/ingestion.rs)
- [src-tauri-shell/src/bhavcopy/mod.rs](../../src-tauri-shell/src/bhavcopy/mod.rs)
- [src-tauri-shell/src/bhavcopy/parsers/csv.rs](../../src-tauri-shell/src/bhavcopy/parsers/csv.rs)
- [src-tauri-shell/src/bhavcopy/tests.rs](../../src-tauri-shell/src/bhavcopy/tests.rs)
- [src-tauri-shell/src/bhavcopy/types.rs](../../src-tauri-shell/src/bhavcopy/types.rs)
- [src-tauri-shell/src/database/index_aliases.rs](../../src-tauri-shell/src/database/index_aliases.rs)
- [src-tauri-shell/src/main.rs](../../src-tauri-shell/src/main.rs)
- [src/components/BhavcopyDownloadWindow.tsx](../../src/components/BhavcopyDownloadWindow.tsx)
- [src/components/__tests__/BhavcopyDownloadRerun.test.ts](../../src/components/__tests__/BhavcopyDownloadRerun.test.ts)
- [src/features/bhavcopy/__tests__/downloadRunState.test.ts](../../src/features/bhavcopy/__tests__/downloadRunState.test.ts)
- [src/features/bhavcopy/__tests__/fallbackProgress.test.ts](../../src/features/bhavcopy/__tests__/fallbackProgress.test.ts)
- [src/features/bhavcopy/downloadRunState.ts](../../src/features/bhavcopy/downloadRunState.ts)
- [src/platform/tauriDesktop.ts](../../src/platform/tauriDesktop.ts)
- [src/platform/types.ts](../../src/platform/types.ts)
- [src/store/bhavcopyStore.ts](../../src/store/bhavcopyStore.ts)
- [src/types/desktop.ts](../../src/types/desktop.ts)

## Validation and native acceptance

The promotion evidence is `tmp/UX13_PR23_20261106_001316_IST`. Its logs record `npm ci --no-audit --no-fund` PASS, `npm run test -- --reporter=verbose` with tracked filters PASS (15) and regression filters PASS (51), `npm run typecheck:renderer` PASS and `npm run build:renderer` PASS (7.39 s). Shared-target Cargo Preview/Run logs record `cargo test --offline --locked` for `bhavcopy::` PASS (119 passed, four ignored), `bhavcopy_recovery::` PASS (16), `price_store_operation_lock::` PASS (3), and `cargo check --offline --locked` PASS. The first Bhavcopy run failed one separate local-only BSE holiday assertion before that assertion was removed from the PR projection.

The user reported cancellation during staging and **Stopping...** during journal-protected import, followed by completion through the protected boundary. The cancelled run reported 84 successes, 36 calendar skips, zero failures and 179,325 imported rows. A subsequent run succeeded, and reopening results showed completed and cancelled outcomes. The reconciled local portable's SHA-256 was `63EF06EAA071C129747837669E567708D959E1942C48D6DD839EFF4EFC008E6D`.

Independent database-integrity certification and native acceptance of a portable rebuilt from the exact merged tree remain unverified. Promotion evidence lists zero CI runs at that checkpoint. See the [sync record](2026-11-06_MAIN_SYNCHRONIZATION.md) for the separately tested local projection.

## Rollback

Use an isolated, reviewed inverse patch for the affected UX-13 paths. A whole-merge revert would also remove the NSE fallback included in that merge. Review that dependency explicitly before any rollback. Keep recovery data and completed imports outside a source rollback.
