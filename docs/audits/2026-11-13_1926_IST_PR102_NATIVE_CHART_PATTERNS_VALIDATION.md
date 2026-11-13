# PR #102 native chart-pattern scanner validation

**13 November 2026, 19:26 IST**

The renderer checks passed on the exact PR source. The review found no new defect requiring a correction. Native Tauri/WebView2 interaction and packaged Windows acceptance remain unverified. Production databases were outside the audit.

## Source and scope

- GitHub PR and branch head `0e5872474d677ac0abe6c53feb3071c3a54408e6`; base and clean local `main` `b830573a8a491c207e9e853bc422ca62f8ebe45f`. PR state was open. The review used a GitHub archive pinned to the head and a Git archive of the local base. The project checkout, refs and index were preserved.
- All 33 changed files in the PR list matched their GitHub blob IDs in the archived head. GitHub tested generated merge commit `39170cbe717945730925f2a73c2f68cb21fe6d7e`. Its tree and the PR head tree were both `1269d44db536483bffe4d09a533e39367e600102`. PR archive SHA-256 was `A349098EF2730AA2526D3E155F5F127686EC303A52A2CA122275F3C3B1BF09EF`. [PR #102](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/102)
- Inspected the original and migrated detectors, all of `src/features/chartPatterns/`, `src/features/scanner/{catalog,types}.ts`, `src/plugins/scanner/{scannerPlugin,scannerRunner,scannerChartPriceBasis,scannerPatternMap}.ts`, legacy re-exports, plugin host and registry, `src/components/{ScannerWindow,Toolbar}.tsx`, focused scanner/plugin/overlay tests, and Vite, Vitest and Tauri configuration. The GitHub file list and PR change note were used to verify scope.

## Behavior and compatibility

- All 54 definition objects matched in order and content. Handler keys also matched in order, with one handler per definition and no duplicate native registrations. Handler groups contain 6 gap, 11 reversal, 27 structure and 10 complex-base handlers. The TypeScript AST comparison found identical bodies for the 54 individual handlers and all 96 other monolith declarations, including thresholds, scoring, dates, geometry, output assembly and definition metadata. The original scanner monolith blob was `69684551e72b75b0dabf2e97dcac5bfaecbbbed1`.
- Runtime comparison matched 31,104 base/head detector invocations across 32 deterministic OHLCV series and 18 history lengths. The inputs produced 657 non-null outputs across 33 patterns. It compared the full serialized results with `generatedAt` normalized and verified the new timestamp format. Six all-pattern history runs matched, including result grouping and progress. A separate run matched partial results at the cancellation boundary.
- Scanner Window used a real browser worker with mocked Tauri IPC. With Core EOD Scanner disabled, the native Common Gap scan returned 10 historical matches. The disabled gate still blocked mixed and plugin-only selections. Re-enabling the plugin returned a Top Gainers result. The focused plugin suites covered existing external scanner registration/disposal and unrelated plugin behavior.
- The production worker returned 162 historical results equal to the base evaluator for the same synthetic series. It sent six progress messages. The browser executor cancelled at endpoint 50, restarted successfully, and settled an active request on disposal.
- The Toolbar click path requested the chart's loaded adjusted, dividend and rights flags. It produced a V-bottom overlay with adjusted geometry, removed it on the second click and rejected a response with a different price basis. Existing regression suites also covered chart routing, timeframe, pattern-map entries, geometry and overlay removal.
- The runtime import graph reachable from changed production modules covered 251 PR modules and found no circular dependency or newly unresolved project import. All 88 existing named exports across 11 scanner modules remained available. `listCoreScannerDefinitions()` now omits the 54 patterns as intended. `listApplicationScannerDefinitions()` preserves their original catalog position. The pre-existing extension host accepts registration IDs that can collide with bundled IDs. PR #102 creates no new collision among the shipped registrations.

## Commands and results

Local renderer checks used the archived head, Node 24.21.0, npm 11.19.0 and the existing installed dependency tree. Git-normalized lockfile blob `cc4c5e6765b269430e6e0ddb5eacb2df7c150a08` matched the base. The Vite output went to the fixture's `renderer-dist/` directory.

| Command | Result |
| --- | --- |
| `npm.cmd test -- src/features/chartPatterns src/plugins/scanner src/plugins/__tests__ src/components/__tests__/ScannerOverlayRemoval.test.ts src/components/__tests__/ScannerOverlayGeometry.test.ts src/components/__tests__/ScannerChartRouting.test.ts src/components/__tests__/ToolbarAdjustedControls.test.tsx src/engine/__tests__/ScannerLabelLayout.test.ts` | **PASS**, exit 0. 22 files, 143 tests. |
| `npm.cmd test` | **PASS**, exit 0. 259 files and 1,793 tests passed. One evidence-gated selected-database transport file/test skipped because no capture was supplied. |
| `npm.cmd run typecheck:renderer` | **PASS**, exit 0. |
| `npm.cmd run build:renderer -- --outDir ../renderer-dist` | **PASS**, exit 0. 840 modules transformed, 6.99 s. Emitted `evaluation.worker-DwPfJi_h.js` (98,536 bytes). |
| `node parity-source.mjs`, `node parity-runtime.mjs`, `node check-imports.mjs`, `node check-exports.mjs` | **PASS**, exit 0 for each. |
| `node worker-browser.mjs`, `node ui-browser.mjs`, `node toolbar-browser.mjs` | **PASS**, exit 0 for each. The Scanner Window harness logged a non-blocking Vite pre-transform warning for its custom entry route before the fixture passed. |
| `node_modules/.bin/tauri.cmd info` | **PASS**, exit 0. Windows x64, WebView2 157.0.4341.46 and MSVC available. The Tauri CSP allows same-origin workers. |
| `./scripts/Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction check` | **PASS**. Verified the shared target and offline locked command. |
| `./scripts/Invoke-EOD-SharedCargo.ps1 -Mode Run -CargoAction check` | **PASS**, exit 0. Checked the local base shell after confirming the PR shell tree matches under line-ending normalization. Cargo finished in 9.44 s with one existing dead-code warning in `bhavcopy/calendar.rs`. This checks shell compilation with the existing local renderer assets. |

GitHub Renderer CI run `43435347733` passed `npm test` (259 files and 1,793 tests passed, one skipped), `npm run typecheck:renderer` and `npm run build:renderer`. Earlier run `43434529770` failed with six Vitest suites affected by an unresolved `./scannerChartPriceBasis` import after relocation. TypeScript and Vite also failed. The current head's corrected import passed both GitHub and local checks. [Passing CI](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43435347733) · [Earlier failure](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/43434529770)

## Risks

- Browser checks used synthetic bars and mocked desktop commands. The 21 patterns without a synthetic hit in the parity probe have declaration/handler equality evidence and the repository's fixture coverage, with no new positive example implied for each of those 21.
- Native Tauri/WebView2 interaction, the packaged portable app, and live-data acceptance remain unverified. The skipped transport test needs a separately supplied read-only capture.

## Files changed

- This audit is the only new repository file. No application source or test was edited. No correction-specific change note was needed.
- The source snapshots, scripts, synthetic fixture, logs and renderer build are under `tmp/fixtures/pr102-native-chart-patterns-0e587247/`. The shared Cargo check used the existing root `target/`.

## Next steps

- Use a disposable database in the exact PR desktop build for native acceptance of Scanner Window, historical cancellation, and raw/adjusted Toolbar overlays if desktop acceptance is required for merge.
