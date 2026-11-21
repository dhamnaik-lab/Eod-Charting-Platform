# NS-05 — Six core OHLCV scanner predicates in native Rust

**Timestamp:** 2026-11-21 14:36 IST (UTC+05:30)  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Source authority:** GitHub `main@48da280cb37eeeef0e564e1c70b9db20f76bf567`  
**Implementation branch:** `feature/native-scanner-completion-20261121`  
**Status:** GitHub Rustfmt, Cargo, native/full Rust and Renderer CI **PASS** at source commit `b8908562892c1a1aaedc30388cd89c7edca409a7`; independent Windows real-data parity, portable acceptance and merge **PENDING**.

## Objective / previous limitation

The accepted NS-01..NS-04 scanner has a versioned numeric AST and four native Gap detectors but the production Scanner UI only permits those four ids. Core OHLCV patterns (high/low break, close near high/low, simple gaps) always fall back to the TypeScript runner, so the TypeScript scanner cannot yet be retired.

## Files changed

- `src/features/scanner/nativeScanContract.ts` — add a closed list of six explicitly supported core ids and their accepted names; preserve the separate four-gap pattern set and schema version.
- `src/plugins/scanner/nativeScannerRun.ts` — compile the exact six TypeScript core conditions to existing numeric AST; send core-only scans as **latest-only**, including when the UI history toggle is on; mix with gap rules in latest-only mode only. Historical mixed core/gap selections use whole-run TypeScript fallback. Keep alert/unsupported run fallback and database cancellation.
- `src-tauri-shell/src/native_scanner/core_ohlcv.rs` (new) — canonical AST definitions, matching numeric verdict result metadata (name, Price Action category, direction, source, values and reasons), and focused unit cases. Reserve the six ids against noncanonical AST claims.
- `src-tauri-shell/src/native_scanner/mod.rs` — include new core module.
- `src-tauri-shell/src/native_scanner/scan.rs` — enforce two-bar minimum for core scans (same as accepted TypeScript batch), reject noncanonical or direct historical core requests, decorate true numeric verdicts without modifying evaluator/bar source, and add read-only synthetic integration checks.
- `src/plugins/scanner/__tests__/nativeScannerRunNS04.test.ts` — closed-set compilation, missing rule fallback, mixed historical fallback and core-only history normalization.
- `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`, `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` — update current scanner state without rewriting historical records.
- `docs/plans/2026-11-21_NATIVE_RUST_SCANNER_COMPLETION_AND_TYPESCRIPT_RETIREMENT.md` — authoritative remaining implementation and removal gates.
- This change record.

## Exact behavior changed

With the **native toggle ON** and all selected ids among four native gap patterns or six new core ids, and no alert rules, six core predicates can now run through Rust with accepted result metadata:

`prev_day_high_break`, `prev_day_low_break`, `close_near_high`, `close_near_low`, `gap_up`, `gap_down`.

The existing TypeScript core scanner evaluates its conditions **only at the latest completed bar** even if the Chart Patterns historical option is selected. Rust receives `evaluateHistory=false` for core-only selections so it does not manufacture older matches. Historical **mixed** core+gap selections fall back entirely to TypeScript because a single native history flag cannot represent different per-family history semantics.

For each native core hit the Rust numeric verdict is decorated with original scanner names, `price_action`, `Price Action`, direction, source `EODScannerPlugin_v1`, reasons and numeric result fields. A direct malicious/malformed request reusing one of these six reserved ids with a different AST fails per-target instead of publishing misleading metadata.

## Existing accepted behavior preserved

- Four Rust gap detectors and paged gap-only All History including 128/128 manual accepted parity are untouched.
- TypeScript scanner remains the **default**, including all unsupported core/daily/pattern/signal/plugin families and all alert rules. No dual execution or merged partial results.
- No changes to formula grammar, on-chart chart-pattern worker or custom formula UI.
- Native uses raw-only prices; **CA-01 adjusted-mode HOLD remains fail-closed**, no issuer-event guessing, no corporate-action approvals.
- Read-only registered database selection/physical identity, worker cap, event sequence, cancel/close semantics, source/raw `.eod` immutability, no database writes, no dependencies added.

## Tests, validation, and evidence

- Baseline GitHub source and source-control instructions independently inspected on `main@48da280...`. The branch was created explicitly from this commit. **PASS, read-only inspection**.
- Rust unit/integration tests for six predicates, exact metadata, nonmatches, spoofed ids and historical rejection **EXECUTED / PASS** as part of [Native/Cargo CI #44888409609](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44888409609): **112 native passed / 0 failed**; RSC-01..06 **18 passed / 0 failed**; full Rust regressions **1,403 passed / 0 failed / 26 ignored / 1 filtered**; Cargo check **PASS**.
- TypeScript adapter tests for AST predicates, mixed historical fallback and core-only latest routing **EXECUTED / PASS** via [Renderer CI #44888409601](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44888409601): **285 test files passed / 1 skipped; 2,019 tests passed / 1 skipped**, TypeScript typecheck **PASS**, Vite production build **PASS**.
- [Rust Scanner Rustfmt CI #44888409623](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44888409623): **PASS**. Initial formatting-only differences were repaired before final-source checks. Actual CI evidence also posted to draft PR #127.
- Validation scope: GitHub CI is Linux-based; it does **not** constitute Windows Tauri/portable or real-data acceptance.
- Windows portable on pinned branch and manual latest-only core parity with TypeScript — **NOT PERFORMED**.
- No container Rust toolchain or Windows `E:\` access; no local `cargo`, `npm`, profile/database read or package build has been claimed. GitHub commit history is the immutable source rollback authority; no local `backups/` content has been created.

## Risks/limitations

- This is an **incremental** retirement step: 6/10 core definitions plus 4 gap detectors may be eligible for native execution; the other four core definitions, daily-market, remaining chart patterns, alerts, plugins, signal scans and custom formulas are still TypeScript.
- The AST clause matches the original TypeScript predicates; native metadata must still be independently compared on a Windows real-data corpus. Unsuitable numeric inputs and difference in number/string presentation are potential parity issues.
- Preserving latest-only core semantics intentionally avoids the numeric AST 1,000-historical-endpoint cap. That cap is still a separate outstanding issue and cannot be declared resolved.
- No native-by-default change is permitted until full migration and separate operator acceptance.

## Rollback

If CI or parity fails, keep the branch unmerged and revert only the NS-05 commits or close its PR. Source authority `48da280cb37eeeef0e564e1c70b9db20f76bf567` remains unchanged on `main`. Rollback needs no database or profile alteration.

**Next checkpoint:** Independently verify six-core behavior on an isolated Windows portable using matched TypeScript scanner results, then request explicit PR #127 merge approval. Do not move to NS-06 daily-market migration until that acceptance. No TypeScript scanner files were deleted.
