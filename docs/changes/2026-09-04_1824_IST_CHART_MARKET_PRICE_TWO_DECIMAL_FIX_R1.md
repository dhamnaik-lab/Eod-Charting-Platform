# Chart Market-Price Two-Decimal Fix R1

Status: AUTOMATED PASS / MANUAL CHART CHECK REQUIRED
Generated: 2026-09-04 18:24:52 IST

## Goal

Primary chart market-price surfaces now request exactly two decimal places even for values at or above 10,000.

## Modified production files

- src/components/ChartPriceLegendOverlay.tsx
- src/engine/ChartEngine.ts

## Preserved

- Renderer.formatPrice adaptive generic policy: byte-preserved
- ChartCanvas: byte-preserved
- Y-axis minimum two-decimal precision logic: preserved
- indicator numeric formatting: preserved
- crosshair formatting: preserved
- Corporate Action R1C-I1 source/test/history authorities: byte-preserved
- Rust main source: byte-preserved
- package.json and package-lock.json: byte-preserved
- database behavior: unchanged

## Validation

- TDD RED: expected missing two-decimal wiring confirmed
- focused GREEN: PASS
- engine regression: PASS
- renderer typecheck: PASS
- renderer build: PASS
- portable Windows build: PASS

## Hashes

- ChartPriceLegendOverlay post: 2A910F1346392F381067F4C825055E0DB4C94A0335B9AA9F20E950A753559B78
- ChartEngine post: 50F78B724756358FE3E0CA04E2FD1438AEB4B89C19E8E677859BFC6C928E6B63
- Renderer preserved: 1BC8F2AF71B7B1C08D045FF703E3E1C4DD17B6838C37D2440BB8730D69884B68
- Focused test: 654B75DB4E1ED717E8556A85CB26BC8401544089481BEAB3091277D676419EA0
- Portable: 1CEC1A31C1848EBB714EECABD4E0F64A0598E889E4DD858836563F1498C9C541

## Manual checkpoint

Verify the rebuilt portable on:
1. NSE index such as NIFTY: OHLC legend and current-price tag show two decimals.
2. BSE index: same two-decimal behavior.
3. Ordinary NSE/BSE stock: existing two-decimal behavior remains correct.

Expected examples: 24,022 -> 24,022.00; 24,022.35 -> 24,022.35; 701.70 -> 701.70.
