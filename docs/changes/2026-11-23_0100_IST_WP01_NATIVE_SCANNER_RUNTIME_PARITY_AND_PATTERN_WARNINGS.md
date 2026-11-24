# WP-01 — Native scanner runtime parity and pattern warnings

Recorded 23 November 2026 at 01:00 IST. User authorization covered read-only use of `E:\TA Projects\EOD Charting Platform\EOD DATABASE` for the initial eligible native-versus-TypeScript comparisons. Local `main`/HEAD was `f78b034e91e2dd506d33ca0dd076f87c5eda6b9f`, tree `645ad1216ffa264fb0f6068d147e47c7d50802c2`. [WP-00 evidence](2026-11-23_0046_IST_DOCSYNC02_NATIVE_SCANNER_AND_SCAN_PERF_ACCEPTANCE.md).

## Runtime and data scope

The normal Windows desktop ran the existing NSR23 portable executable (SHA-256 `50A2255F84E885B816796F3BE21108D85A483D2068D32973E41BCB850124F6D2`). The harness loaded the actual renderer scanner and worker modules into that executable's WebView and used the Tauri desktop bridge, real native start/events, and the TypeScript runner. Only the worker URL was changed for the harness bundle. The existing portable binaries and assets were reused. The corrected renderer adapter was exercised through this harness. Manual Scanner UI interaction and a rebuilt portable containing the change remain separate checkpoints.

The app opened a working copy in an isolated profile. The copy used the database manifest, SQLite main/WAL bytes, binary state and only the three selected NSE binary histories from the approved folder. Snapshot copies matched their source SHA-256 and the copied SQLite database passed `PRAGMA quick_check`. SBIN, ICICIBANK and AXISBANK supplied 7,907, 7,195 and 4,734 raw rows, respectively, through 9 November 2026. Each pair used identical targets, lookback, as-of date, raw price basis and empty alert rules. No fallback was called on the five eligible runs. `generatedAt` was checked as a valid timestamp for both runs and recorded in the raw evidence. Other fields were compared exactly by exchange, symbol, scanner ID and date, including result order, score, reasons, scalars, source/category, pattern metadata, geometry/pivots and history grouping.

## Reproduced mismatch and correction

The baseline compared one positive latest pattern record and 990 historical pattern records. Every one of those records had `warnings: []` in TypeScript and a missing warnings field in the native renderer adapter. All other comparable fields and order matched. The adapter already supplied the empty array for built-in Core and Daily Market rules. The change extends that existing mapping to supported chart patterns, matching the shared TypeScript pattern result builder. It adds an assertion to the existing native adapter metadata test. Scanner calculations, Rust/IPC, native opt-in, fallback, alerts, the 32-rule limit, SCAN-PERF-01 pagination and database behavior were preserved.

| Pair | Selected rule IDs | As of / lookback | Exact positive records after correction |
| --- | --- | --- | ---: |
| Chart patterns, latest | `chart_common_gap`, `chart_exhaustion_gap` | 20 Nov / 250 | 0, three no-match targets |
| Chart patterns, latest positive | Same two | 8 Nov / 250 | 1 |
| Chart patterns, historical | Same two | 20 Nov / All History | 990 |
| Core, latest | `prev_day_high_break`, `inside_bar`, `close_near_low` | 20 Nov / 250 | 2 |
| Daily Market, latest | `top_gainers`, `top_losers`, `volume_surge` | 20 Nov / 252 | 5 |

All five eligible runs reported native completion with zero failed or skipped targets and zero TypeScript diagnostics. The final comparison passed with **998 exact positive records**, zero duplicates, zero missing records and identical order. Single-run elapsed times are retained in the evidence with separate native and TypeScript values. Shared cache state, IPC and renderer validation load make those values unsuitable for a performance comparison.

## Operational checks

- Unsupported Core All History fell back once as a whole TypeScript run and returned two records.
- Cancellation immediately after native start acknowledgement published zero matches and made zero fallback calls. The native report recorded three skipped targets. The existing completion text said “after 3 symbols” even though the diagnostics said the three targets were cancelled before scanning. Operational counter wording belongs to a later bounded issue.
- Closing the active working copy after native start cancelled the run with a database-change diagnostic. It published zero results and made zero fallback calls.
- A separate scratch copy held a deliberately malformed SBIN binary. Native reported one failed target and one read diagnostic, and TypeScript returned one scan error. Neither engine returned a match.

## Validation, preservation and rollback

| Check | Result |
| --- | --- |
| `npm.cmd test -- src/plugins/scanner/__tests__/nativeScannerRunNS04.test.ts src/features/scanner/__tests__/nativeChartPatterns50ParityNSR3.test.ts src/components/__tests__/ScannerResultsPagination.test.tsx` | PASS, 34 tests in 3 files, exit 0 |
| `npm.cmd run typecheck:renderer` | PASS, exit 0 |
| `npm.cmd test` | PASS, 2,169 tests passed and 1 skipped, exit 0 |
| `npm.cmd run build:renderer` | PASS, exit 0, 7.91 s |
| Windows paired runtime and operational comparison | PASS after the adapter fix, 998 exact positive records |
| Reference, whitespace and SHA-256 checks | PASS recorded in the evidence folder |

Renderer checks ran in an isolated source copy to preserve generated theme CSS and build metadata. Source preservation and the seven original dataset-file SHA-256 checks were repeated after testing. Evidence, raw before/after output, source hash manifests and command logs are in `tmp/fixtures/wp01-native-parity/20261123_005140/`.

Changed `src/plugins/scanner/nativeScannerRun.ts`, its focused adapter test, `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`, the [living roadmap](../plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md), and `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`. To roll back with approval, reverse the adapter and test diff and remove the WP-01 documentation entries, preserving earlier local changes. Original in-scope files were backed up at `backups/pre_opencode_changes_20261123_005525_wp01-pattern-warnings/`.

WP-01 is closed for the bounded suite. Other pattern families, BSE, broader history/endpoint operations, and manual acceptance of a rebuilt portable remain open. WP-02 (NS-R7) requires explicit approval before changes to historical or operational behavior.
