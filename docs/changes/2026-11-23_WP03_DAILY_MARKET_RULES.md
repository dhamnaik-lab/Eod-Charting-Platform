# WP-03 — Daily Market rule decisions

The operator approved C-2 and C-3 separately on 23 November 2026 IST.

## C-2 · 52-Week High and Low

The Scanner descriptions and rule text now specify the executable check. The current completed bar's high or low must equal the corresponding extreme over the latest 20 to 252 bars, including the current bar. Ties qualify. The match predicates in both engines already implement this behavior. [Scanner definitions](../../src/plugins/scanner/dailyMarketScanners.ts#L131)

## C-3 · Volume Surge direction

For a qualifying Volume Surge, the exact close change determines direction. A flat close is Neutral, a higher close is Bullish, and a lower close is Bearish. The 1.5× threshold and preceding 20-bar average still determine eligibility. The native metadata gate permits all three directions at a displayed 0% because rounding can hide a small gain or loss. Shared parity fixtures cover exactly flat, slightly higher and slightly lower closes that all display as 0%. [TypeScript](../../src/plugins/scanner/dailyMarketScanners.ts#L201) · [Rust](../../src-tauri-shell/src/native_scanner/core_results.rs#L700) · [Metadata gate](../../src/features/scanner/nativeCoreResultMetadataGate.ts#L54)

Existing Scanner routing remains in effect. Production V2 stays disabled.

## Focused validation

- Shared Cargo Preview and Run with the `nsr2_daily_market` filter on the shell test binary — PASS. Two Rust tests passed, including full metadata comparison across 42 shared cases. The debug harness compiled and linked in 1m 28s and reported the existing unused `create_holiday_skip_result` warning. [Cargo log](../../tmp/fixtures/wp03-daily-market-20261123/shared-cargo-daily-market.log)
- `rustfmt --edition 2021 --check src-tauri-shell/src/native_scanner/core_results.rs` — PASS.
- Focused Vitest — PASS. Three files and 65 tests passed. The first run failed on a test that asserted the old 40-case fixture count. The test now checks the two formatting cases directly. [First run](../../tmp/fixtures/wp03-daily-market-20261123/vitest.log) · [Passing run](../../tmp/fixtures/wp03-daily-market-20261123/vitest-final.log)
- `npm run typecheck:renderer` — PASS. [Type check log](../../tmp/fixtures/wp03-daily-market-20261123/renderer-typecheck.log)

## Windows portable acceptance · 24 November 2026 IST

The operator's `npm run tauri:portable:win` passed. Vite built 851 modules and the shell release compiled in 2m 54s with the existing unused `create_holiday_skip_result` warning. The staged `EOD Chart.exe` and the shared release executable both had SHA-256 `8E77A8DAA4582F078F0EC433E9C656BB74CD27FB054BB1B8ABAC81E9933BDFCF`. Build metadata identified `20261123.235728`.

The normal Windows desktop ran the staged app on Windows `19045.7846` with WebView2 Edge `157.0.0.0`. The operator authorized normal read-write activation of the actual EOD database for these checks. The run used a separate app profile. Scanner Library displayed the approved session high and session low descriptions. The regular app reported production V2 unavailable.

| NSE:NTPC as-of date | Previous and current raw close | Volume ratio | Matched direction in both engines |
| --- | --- | ---: | --- |
| 2025-03-25 | 366.95 and 366.95 | 1.67× | Neutral |
| 2026-11-02 | 316.25 and 323.00 | 1.54× | Bullish |
| 2026-10-12 | 312.00 and 310.00 | 1.65× | Bearish |

Six Scanner UI runs returned one match each. Both engines agreed on identity, date, direction, reason and numeric values. The Rust runs showed native completion with zero diagnostic, skipped and failed targets. The comparison checked volume, prior 20-bar average, volume ratio, and price change against an independent decode of the actual NTPC binary. The engines display the same numeric fields in different orders. [Final desktop report](../../tmp/fixtures/wp03-portable-20261124_000439/desktop-result-final.json) · [Independent reference](../../tmp/fixtures/wp03-portable-20261124_000439/reference.json)

The initial automation selected the wrong Library control. After scoping the selection to Scanner, an intermediate comparison rejected the different numeric field order. The passing probe compared fields by key and retained both rendered rows. [First attempt](../../tmp/fixtures/wp03-portable-20261124_000439/desktop-result.json) · [Intermediate attempt](../../tmp/fixtures/wp03-portable-20261124_000439/desktop-result-retry.json)

The main SQLite file, database manifest and NTPC history retained their pre-activation hashes. Normal activation created SQLite WAL and SHM sidecars. In the final run, the WAL hash matched before and after, and the SHM hash changed. The app exited normally and the 98,912-byte WAL and 32,768-byte SHM remained in place. This was normal read-write activation. [Catalog and sidecar evidence](../../tmp/fixtures/wp03-portable-20261124_000439/desktop-result-final.json)

WP-03 Windows portable acceptance passed. Broader Scanner retirement gates still apply. Acceptance documentation backup `backups/pre_opencode_changes_20261124_001056_wp03-portable-acceptance/`.

## Backups

- Source and fixtures `backups/pre_opencode_changes_20261123_234618_wp03-daily-market-source/`
- Project records `backups/pre_opencode_changes_20261123_234911_wp03-daily-market-docs/`
