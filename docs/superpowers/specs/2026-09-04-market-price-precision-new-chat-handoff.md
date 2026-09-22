# Market-Price Precision — New-Chat Handoff

Status: READ THIS FIRST FOR FUTURE DECIMAL / MULTI-ASSET PRICE WORK  
Date: 2026-09-04

## Current state

The current NSE/BSE chart price defect is fixed and manually demonstrated on NSE NIFTY and BSE SENSEX.

Primary chart market-price surfaces now request exactly two decimals for the current product baseline.

This is intentionally **not** the final architecture for future assets such as Forex.

## Current accepted chart authorities

`src\components\ChartPriceLegendOverlay.tsx`

SHA-256:

`2A910F1346392F381067F4C825055E0DB4C94A0335B9AA9F20E950A753559B78`

`src\engine\ChartEngine.ts`

SHA-256:

`50F78B724756358FE3E0CA04E2FD1438AEB4B89C19E8E677859BFC6C928E6B63`

Preserved generic formatter:

`src\engine\Renderer.ts`

SHA-256:

`1BC8F2AF71B7B1C08D045FF703E3E1C4DD17B6838C37D2440BB8730D69884B68`

Preserved chart host:

`src\components\ChartCanvas.tsx`

SHA-256:

`079797BE553E5C3A2390A9C477AF3B6780FB94D1E441E4DACD670013B7D0359A`

Focused test:

`src\engine\__tests__\ChartMarketPriceFormatting.test.ts`

SHA-256:

`654B75DB4E1ED717E8556A85CB26BC8401544089481BEAB3091277D676419EA0`

Accepted portable SHA-256:

`1CEC1A31C1848EBB714EECABD4E0F64A0598E889E4DD858836563F1498C9C541`

Automated evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\CHART_MARKET_PRICE_TWO_DECIMAL_2026-09-04_182452_IST_evidence.zip`

SHA-256:

`91544E6226E3ED4E68E00E21FE3FD2F5E9425FC5A4EB4DE63CF2D3C24D8FD1A3`

## Read order for future price-precision work

1. `docs\superpowers\specs\2026-09-04-market-price-precision-new-chat-handoff.md`
2. `docs\superpowers\specs\2026-09-04-market-price-precision-future-implementation-requirements.md`
3. `docs\superpowers\specs\2026-09-04-market-price-precision-current-audit-matrix.md`
4. `docs\changes\2026-09-04_1900_IST_CHART_MARKET_PRICE_TWO_DECIMAL_MANUAL_ACCEPTANCE_CLOSEOUT.md`
5. existing chart engine/source tests

## Core rule

Do not solve future decimal requirements by editing each display surface independently.

The target is an **instrument-aware price precision contract propagated with instrument metadata**.

## Current architectural facts

- `Renderer.formatPrice` uses magnitude-based adaptive precision when digits are not explicitly supplied.
- `InstrumentSummary` currently has no first-class display precision or tick-size fields.
- `chartStore` already carries `instrumentMeta`.
- `OhlcvBar` currently uses `.toFixed(2)` for O/H/L/C.
- `TileHeader` currently uses `.toFixed(2)` for price display.
- the binary EOD header has `price_scale`
- core binary code currently defines `DEFAULT_SCALE = 10000`
- current NSE/NSE_INDEX evidence commonly reports `priceScale = 10000`

Storage precision and display precision are different concepts.

## Future examples

These are examples of desired flexibility, not hard-coded market rules:

```text
NSE equity  -> 3,412.50
NSE index   -> 24,252.00
EURUSD-like -> 1.08456
USDJPY-like -> 147.325
```

Actual future precision must come from instrument/provider/market metadata.

## Important prohibition

Do not implement:

```text
if forex then 4 decimals
```

and do not implement:

```text
display decimals = digits in priceScale
```

Both are oversimplifications.

## Storage caution

Before accepting a future feed with more than four fractional digits, audit all paths that convert prices using `DEFAULT_SCALE`.

The UI being able to render five decimals does not prove the database/binary path retained five decimals.

## Formatter domains

Keep these separate:

- market price
- indicator/calculated value
- percentage
- quantity/volume
- counts/identifiers

Do not introduce one universal decimal rule.

## Migration safety

Keep the current two-decimal NSE/BSE wiring until the future instrument-aware path is fully tested.

Do not temporarily remove it during refactoring.

## Corporate Action isolation

The price-precision project is unrelated to Corporate Action.

Current Corporate Action R1C-I1 authority remains frozen unless a separate Corporate Action task explicitly changes it.

## Next action when future multi-asset work starts

Start with a **read-only P0 precision inventory**, then implement metadata/resolution before changing chart surfaces.

Do not begin by editing chart labels.
