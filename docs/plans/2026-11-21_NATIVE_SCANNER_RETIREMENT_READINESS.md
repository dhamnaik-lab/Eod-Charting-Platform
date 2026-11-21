# Native Rust scanner — current coverage, remaining work, and TypeScript retirement gates

**Status updated:** 2026-11-22 IST (UTC+05:30)  
**Workstream:** EOD Charting Platform — E:\TA Projects\EOD Charting Platform  
**Verified source authority:** GitHub main `09d329813706e3948820cc663507b197b5b07dd5`, also confirmed as local main by the user's NSR5/PR #134 guarded fast-forward output.  
**Current outcome:** NS-04 and the NS-R core latest-only / diagnostic corrections are merged; **native remains OFF by default, TypeScript remains the default and fallback, and full scanner retirement is NOT authorized**. No consolidated post-NSR5 Windows portable acceptance is recorded. CA-01 adjusted-native execution remains HOLD.

This is the **living** native-scanner roadmap. Earlier candidate-only statements in dated change records and the initial 21 Nov plan belong to their original evidence time; they do not override this verified main source. Historical records must not be silently rewritten.

## Source-confirmed execution matrix

| Scanner/workflow | Native routing on current main | Preservation / limitation |
|---|---|---|
| Four accepted gap patterns: Breakaway, Common, Runaway, Exhaustion | Explicit opt-in, latest and paged All History | Existing fixture-backed detector outputs/metadata, lookback warm-up, DB selection and cancellation protections remain. The 14-symbol Nifty Bank Exhaustion Gap observation of 128 TS / 128 Rust matches is **specific**, not full-catalog parity. |
| Ten built-in core OHLCV predicates | Explicit opt-in, latest/bounded endpoint only | Canonical versioned AST + Rust match metadata and fail-closed TS gate. Two completed bars are required for built-in core rules. Zero/one-bar targets count as native Skipped with a diagnostic; completed native scans display genuine skipped/failed counts. |
| Core OHLCV All History | TypeScript whole-run fallback | Do not claim native full-history equivalence. |
| Daily market (gainers, losers, volume surge, 52-week extremes) | TypeScript | Native implementation/parity not confirmed. |
| Other chart-pattern families | TypeScript/accepted chart-pattern worker paths | Only four gap patterns are approved for native routing. Do not conflate the Toolbar worker with the native scanner. |
| Built-in visual signals, custom signals and formula scans | TypeScript / existing owners | Native semantics, result metadata and historical behavior unverified. |
| Price, indicator, drawing and scanner-match alerts | TypeScript-owned | Native adapter refuses alert-bearing runs to avoid duplicate triggers and changed persistence. |
| External plugin scanners | Existing restricted plugin boundary | External packages remain metadata-only where applicable; no privileged untrusted execution. |
| Adjusted-price / CA-dependent native requests | **HOLD / fail-closed** | CA-01 issuer-event/adjustment ownership must be settled separately; do not mutate raw .eod data. |

**Operational:** The numeric Rust history executor still has a 1,000-endpoint cap (`MAX_HISTORY_ENDPOINTS` in `src-tauri-shell/src/native_scanner/scan.rs`); paged **gap-only** All History does not eliminate it. Supported IDs must be derived from the actual catalog, not an assumed 74-entry UI count. Native OFF by default is intentional.

## Merged evidence and bounded fixes

| Source event | Recorded outcome | Limitation |
|---|---|---|
| [PR #124](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/124) / [#125](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/125) | NS-01..NS-04 architecture, read-only registered DB selection safeguards, four native gap patterns, paged gap-only history and existing focused acceptance integrated | Not complete scanner parity |
| [PR #128](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/128) / [#129](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/129) | Ten canonical core predicates, full result metadata, cross-language fixtures, latest-only native routing, and fail-closed fallback merged | Historical core still TypeScript |
| [PR #127](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/127) | Superseded draft **closed unmerged** after checking the newer ten-core implementation | Do not rebase/merge the old six-core implementation |
| [PR #132](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/132) / [issue #131](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/131) | Two-completed-bar native core warm-up. [Rust CI](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44935559512): 115 native scanner tests passed, 18 RSC tests passed, full Rust suite 1,406 passed / 26 ignored; [Renderer CI](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44935559542) passed 2,104 tests / 1 skipped | CI source and final-head evidence documented; no consolidated Windows portable acceptance |
| [PR #134](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/134) / [issue #133](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/133) | Native short-history warnings already reached the UI; final summary now exposes real skipped/failed/diagnostic counts without changing Rust classifications. [Final-head Renderer CI](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44938860710): 2,108 tests passed / 1 skipped; typecheck and Vite build PASS | Windows UI acceptance is pending |

**Local integration evidence:** The user-provided guarded NSR4/PR #132 and NSR5/PR #134 fast-forward outputs report exact incoming Git blobs, no staged files, and preservation of 10 existing worktree entries / file hashes. These are **user command outputs**, not live access to the local Windows drive.

## Broader retirement gates (NS-R1–NS-R9)

The **gate IDs** below are the original migration roadmap; they must not be confused with the individual bounded NSR4 and NSR5 fixes already merged.

| Gate | Current disposition | Required evidence before gate closes |
|---|---|---|
| NS-R1: ten-core predicates and result metadata | **Implemented for latest-only**, automated fixture/metadata tests passed; Windows rollout pending | Final bundled native/TS differential acceptance at selected-symbol endpoints, including values, reasons, source, category, direction and metadata |
| NS-R2: daily market scanners | **Not migrated** | Full gain/loss denominator, volume, 52-week, warm-up, equality and ordering parity |
| NS-R3: remaining chart patterns | **Not migrated** beyond four gaps | Geometry, pivots, score, family, no-look-ahead and historical results |
| NS-R4: visual signals, custom signals, formulas | **Not migrated** | Indicator/AST, warm-up, output, grouping and user formula parity |
| NS-R5: alert-equivalent execution | **Not migrated**; TypeScript-owned | Exactly-once triggers, persisted alert history, cancellation and fallback safeguards |
| NS-R6: external plugin compatibility | **Boundary unresolved for retirement** | Explicit safe execution owner without auto-running untrusted plugin code |
| NS-R7: historical and operational parity | **Partial**: gap-only history works; generic numeric 1,000-cap persists | No silent truncation; correct lookback/UI (including reported fixed 20-bar input), cancellation/partial/error counts, DB switch/ABA, NSE/BSE and performance |
| NS-R8: native-default migration | **Blocked / native OFF** | All intended supported paths plus one bundled Windows portable acceptance; explicit user approval |
| NS-R9: remove obsolete TypeScript execution | **Blocked** | Prove no worker, alerts, formula, signal, plugin or chart consumer still needs each removed path; preserve public contracts |

## Required implementation and final acceptance order

1. **Finish missing source capabilities**, one bounded issue at a time, starting with daily-market scanner parity; then remaining patterns, signal/formula, alert and plugin boundaries. Preserve existing TypeScript functionality until each equivalent path is accepted.
2. **Resolve history and operational gaps**: no silent 1,000-endpoint truncation, explicit lookback editing, exact historical grouping, cancellation and DB identity. Test against deterministic fixtures and relevant Rust/renderer suites.
3. **Run automated cross-backend parity** using equal source data and configuration; compare exact symbols, dates, counts, reasons, values, categories and grouping, not only matches. Record both passes and unsupported paths.
4. **One consolidated Windows portable-build acceptance** after implementation reaches a release candidate: use the authorized portable workflow, read-only registered DB, all four gap detectors and ten core rules, 20→250 lookback editing, cancellation, native disabled fallback, alert behavior and multiple symbols. No Windows Sandbox or database mutation.
5. Consider enabling native by default only after a reviewed acceptance decision. **Do not remove TypeScript scanner execution before all retirement gates and independent approval**; CA-01 adjusted-native HOLD remains a separate blocking boundary for adjusted scans.

## Source map / inspection and validation boundaries

Read `AGENTS.md` and the current top checkpoint of `HANDOFF.md` first, then the specific affected paths:
- `src/plugins/scanner/nativeScannerRun.ts`, `scannerRunner.ts`, `coreOhlcvScanners.ts` and scanner tests;
- `src/features/scanner/nativeCoreRuleExpressions.ts`, `nativeCoreResultMetadataGate.ts`, `nativeScanContract.ts`;
- `src/components/ScannerWindow.tsx` and `src/platform/nativeScannerBridge.ts`;
- `src-tauri-shell/src/native_scanner/{scan,core_results,patterns,ipc,database_source,reader,job}.rs`, plus relevant parity fixtures;
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` and `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`.

No new dependencies, no raw data/DB operations without task-specific authorization, and no generated output under source directories. Do not change other workstreams.

**Validation truth:** For Rust edits, actual rustfmt then Cargo check/focused/wider tests and GitHub CI; for renderer edits, focused/full relevant Vitest, typecheck, and Vite build. An older green CI run is not proof of a new change. Windows native/portable acceptance is explicitly **NOT RUN** for the current post-PR #134 main. No code or Windows build is requested by this documentation refresh.

## Document authority and preservation

This file is the active **scanner roadmap**, not an audit of the whole repo. The 2026-11-04 ZIP snapshot in `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` is historical. Dated NS-R, NS-04 and RSC change records must retain their original status at the time written. The two root handoff files are known locally modified; their content must be reconciled with verified local SHA-256 evidence before any merge overwrites them. Docs refresh is separate from scanner implementation and does not itself authorize native retirement.
