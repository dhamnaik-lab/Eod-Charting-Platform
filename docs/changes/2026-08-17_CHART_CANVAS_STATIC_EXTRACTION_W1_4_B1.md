# ChartCanvas Static Bundle Extraction W1.4-B1

## Purpose

W1.4-A removed the former `feature-chart-runtime` monolith and produced clean synchronous `feature-chart-analysis` and `vendor-technicalindicators` boundaries, but Windows bundle measurement left `feature-chart-core` at **501.44 kB / 131.65 kB gzip**, only 1.44 kB above the accepted 500.00 kB gate.

W1.4-B1 makes the smallest behavior-neutral follow-up: assign only `src/components/ChartCanvas.tsx` to a dedicated static `feature-chart-canvas` manual chunk.

## Production scope

The only production-source change is `vite.config.mts` manual-chunk classification:

- `src/components/ChartCanvas.tsx` -> `feature-chart-canvas`
- remaining chart engine/store/chart services -> `feature-chart-core`
- `src/indicators/**`, `src/engine/Patterns.ts`, and `src/engine/candlestick/**` remain `feature-chart-analysis`
- `technicalindicators` remains `vendor-technicalindicators`

`src/components/ChartCanvas.tsx` itself is byte-identical to the W1.4.1 basis.

## Preserved behavior

W1.4-B1 introduces no dynamic imports, loading states, delayed chart initialization, algorithm changes, persistence changes, database changes, or Rust changes. ChartEngine, Renderer, drawings, Renko transforms, indicators, chart services, workspace persistence, and W1.3 Official Watchlists retain their existing runtime contracts.

## Hard gates

Validation must stop if any of the following occurs:

- any `Circular chunk:` warning;
- Vite CJS Node API deprecation warning returns;
- `feature-chart-runtime` is emitted again;
- any of `feature-chart-canvas`, `feature-chart-core`, `feature-chart-analysis`, or `vendor-technicalindicators` exceeds 500.00 kB minified;
- any other JavaScript asset exceeds 500.00 kB;
- W1.3 Official Watchlists feature/lazy-payload architecture regresses;
- renderer typecheck, chart/indicator/workspace regressions, or Tauri Rust check fails.

No deeper split is authorized by this package.

<!-- W1.4-B1-VALIDATION-START -->
## Windows validation evidence

Validation status: **PASS**.
Bundle report: tmp/w1-4-b1-bundle-report_20260817_010615.txt

    W1.4-B1 ChartCanvas bundle report
    Assets: E:\TA Projects\EOD Charting Platform\dist\assets
    W1.4.1 baseline feature-chart-core: 501.44 kB / 131.65 kB gzip
    feature-chart-runtime monolith: ABSENT
    feature-chart-canvas: 204.51 kB / 52.95 kB gzip (feature-chart-canvas-BFgpzG2F.js)
    feature-chart-core: 297.30 kB / 79.20 kB gzip (feature-chart-core-DNZwyDUR.js)
    feature-chart-analysis: 164.42 kB / 45.41 kB gzip (feature-chart-analysis-BOqwZJhf.js)
    vendor-technicalindicators: 19.81 kB / 4.16 kB gzip (vendor-technicalindicators-Deq95r8j.js)
    feature-official-watchlists: 55.08 kB / 11.63 kB gzip (feature-official-watchlists-CvrxsEt8.js)
    W1.3 lazy payload: 32.62 kB / 6.56 kB gzip (officialWatchlistNseSectors.generated-RCDELx1K.js)
    W1.3 lazy payload: 376.09 kB / 77.00 kB gzip (officialWatchlistNseIndices.generated-ChHQl6pf.js)
    W1.3 lazy payload: 176.75 kB / 49.37 kB gzip (nseSectorUniverseWatchlistData.generated-Trju5gM9.js)
    W1.3 lazy payload: 118.90 kB / 29.99 kB gzip (officialWatchlistBseSectors.generated-Bo5HXBOF.js)
    W1.3 lazy payload: 363.45 kB / 89.72 kB gzip (officialWatchlistBseIndices.generated-8dZaVRCc.js)
    W1.3 lazy payload: 92.10 kB / 26.07 kB gzip (bseSectorUniverseWatchlistData.generated-BnAsP7iZ.js)
    All W1.4-B1 chart chunks <=500 kB: YES
    W1.3 six lazy Watchlist payload chunks present: YES
    Circular chunk warning: ABSENT
    Vite CJS warning: ABSENT
    Other >500 kB assets: NONE
    
    [PASS] W1.4-B1 bundle architecture and <=500 kB chart-chunk gate.

<!-- W1.4-B1-VALIDATION-END -->

