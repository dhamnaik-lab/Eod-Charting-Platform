# Chart Market-Price Two-Decimal Fix — Manual Acceptance Closeout

Status: CURRENT NSE/BSE COMPATIBILITY FIX ACCEPTED  
Date: 2026-09-04

## Purpose

This document closes the immediate chart display defect in which large market prices, especially NSE and BSE indices, lost decimal places on primary chart price surfaces.

This is a **current compatibility fix for the presently supported NSE/BSE chart workflow**. It is not the final multi-asset precision architecture.

## Automated authority

Automated evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\CHART_MARKET_PRICE_TWO_DECIMAL_2026-09-04_182452_IST_evidence.zip`

SHA-256:

`91544E6226E3ED4E68E00E21FE3FD2F5E9425FC5A4EB4DE63CF2D3C24D8FD1A3`

Accepted portable:

`E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable\EOD Chart.exe`

SHA-256:

`1CEC1A31C1848EBB714EECABD4E0F64A0598E889E4DD858836563F1498C9C541`

Accepted production authorities:

- `src/components/ChartPriceLegendOverlay.tsx`
  - SHA-256 `2A910F1346392F381067F4C825055E0DB4C94A0335B9AA9F20E950A753559B78`
- `src/engine/ChartEngine.ts`
  - SHA-256 `50F78B724756358FE3E0CA04E2FD1438AEB4B89C19E8E677859BFC6C928E6B63`
- `src/engine/Renderer.ts`
  - preserved SHA-256 `1BC8F2AF71B7B1C08D045FF703E3E1C4DD17B6838C37D2440BB8730D69884B68`
- `src/components/ChartCanvas.tsx`
  - preserved SHA-256 `079797BE553E5C3A2390A9C477AF3B6780FB94D1E441E4DACD670013B7D0359A`

Focused test:

`src/engine/__tests__/ChartMarketPriceFormatting.test.ts`

SHA-256:

`654B75DB4E1ED717E8556A85CB26BC8401544089481BEAB3091277D676419EA0`

Automated validation recorded:

- TDD RED confirmed the missing market-price two-decimal wiring
- focused GREEN passed
- engine regression passed
- renderer typecheck passed
- renderer build passed
- portable Windows build passed
- generic `Renderer.formatPrice` remained byte-preserved
- `ChartCanvas` remained byte-preserved
- Corporate Action R1C-I1 authorities remained preserved
- no database access by the runner
- no source-control command by the runner

## Manual runtime acceptance

### NSE index

NIFTY was manually checked in the rebuilt portable.

The chart legend displayed two decimal places, including values ending in zero, for example:

- `24,284.05`
- `24,206.80`
- `24,252.00`

The current-price tag displayed:

- `24,252.00`

This confirms the original high-value index formatting defect is corrected on NSE index charts.

### BSE index

BSE SENSEX was manually checked in the rebuilt portable.

The chart legend displayed two decimal places, for example:

- `78,263.33`
- `77,447.93`
- `77,966.35`

The current-price tag displayed:

- `77,537.72`

This confirms the same defect is corrected on BSE index charts.

### Ordinary stocks

Ordinary NSE/BSE stocks were already displaying two decimals correctly before this fix. The production change only made the primary market-price call sites explicitly request two decimals, and the engine regression passed.

A separate post-build ordinary-stock screenshot was not recorded in this manual checkpoint. Do not describe that as a separate manual stock acceptance unless it is performed later.

## Current behavior accepted

For the current NSE/BSE product baseline, these primary chart price surfaces request exactly two decimals:

- OHLC legend O/H/L/C
- current-price tag
- previous-close tag
- high tag
- low tag

The Y-axis retains its existing scale-step precision logic with a minimum of two decimals.

The following were intentionally not globally changed:

- generic adaptive `Renderer.formatPrice`
- crosshair formatting
- indicator formatting
- drawing values
- measurement values
- volume/quantity formatting
- percentage formatting
- unrelated utility numeric displays

## Important future-architecture warning

This two-decimal fix is **not** a universal solution for future asset classes.

Do not generalize it to Forex, crypto, futures, commodities, bonds, or other instruments whose market conventions require different precision.

Examples:

- an NSE/BSE equity or index may display at 2 decimals
- an FX pair such as EURUSD may require 5 displayed decimals
- a JPY FX pair may require 3 displayed decimals
- a low-priced digital asset may require substantially more decimals

Future multi-asset support must implement the instrument-aware precision contract defined in:

`docs\superpowers\specs\2026-09-04-market-price-precision-future-implementation-requirements.md`

## Preservation rule

Do not remove the current explicit two-decimal NSE/BSE market-price wiring until:

1. instrument-aware precision metadata exists end-to-end,
2. every primary chart price surface consumes it,
3. NSE stock, NSE index and BSE index parity tests pass,
4. at least one high-precision future-asset fixture passes,
5. storage precision has been independently verified not to truncate raw source precision.

This avoids reintroducing the original index defect while the future architecture is built.
